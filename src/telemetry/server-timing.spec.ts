import { randomBytes, randomUUID } from 'node:crypto';
import { INVALID_SPANID, INVALID_TRACEID, TraceFlags, type Span, type SpanContext } from '@opentelemetry/api';
import type { Request, Response, NextFunction } from 'express';
import {
  SERVER_TIMING_HEADER,
  TRACE_PARENT_ENTRY,
  TRACE_PARENT_VERSION,
  exposeTraceParentToBrowser,
} from './server-timing';
import { HEX_ENCODING, SPAN_ID_BYTES, TRACE_ID_BYTES, W3cTraceFlagsHex } from '../testing/w3c-trace-context-constants';

const { getActiveSpan } = vi.hoisted(() => ({ getActiveSpan: vi.fn() }));

vi.mock('@opentelemetry/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@opentelemetry/api')>();
  return { ...actual, trace: { ...actual.trace, getActiveSpan } };
});

const SAMPLED_FLAG = W3cTraceFlagsHex.sampled;
const UNSAMPLED_FLAG = W3cTraceFlagsHex.unsampled;

function makeRes() {
  const headers: Record<string, string> = {};
  return {
    headers,
    getHeader: vi.fn((name: string) => headers[name]),
    setHeader: vi.fn((name: string, value: string) => {
      headers[name] = value;
    }),
  } as unknown as Response & { headers: Record<string, string> };
}

function spanWith(spanContext: SpanContext): Span {
  return { spanContext: () => spanContext } as unknown as Span;
}

function newSpanContext(traceFlags: TraceFlags): SpanContext {
  return {
    traceId: randomBytes(TRACE_ID_BYTES).toString(HEX_ENCODING),
    spanId: randomBytes(SPAN_ID_BYTES).toString(HEX_ENCODING),
    traceFlags,
  };
}

const traceParentEntry = (spanContext: SpanContext, flag: string): string =>
  `${TRACE_PARENT_ENTRY};desc="${TRACE_PARENT_VERSION}-${spanContext.traceId}-${spanContext.spanId}-${flag}"`;

const REQ = {} as Request;

describe('exposeTraceParentToBrowser', () => {
  beforeEach(() => {
    getActiveSpan.mockReset();
  });

  it('writes the active trace and span id as a W3C traceparent', () => {
    const res = makeRes();
    const next = vi.fn() as NextFunction;
    const spanContext = newSpanContext(TraceFlags.SAMPLED);
    getActiveSpan.mockReturnValue(spanWith(spanContext));

    exposeTraceParentToBrowser(REQ, res, next);

    expect(res.headers[SERVER_TIMING_HEADER]).toBe(traceParentEntry(spanContext, SAMPLED_FLAG));
  });

  it('encodes an unsampled span with the 00 flag rather than omitting it', () => {
    const res = makeRes();
    const spanContext = newSpanContext(TraceFlags.NONE);
    getActiveSpan.mockReturnValue(spanWith(spanContext));

    exposeTraceParentToBrowser(REQ, res, vi.fn() as NextFunction);

    expect(res.headers[SERVER_TIMING_HEADER]).toBe(traceParentEntry(spanContext, UNSAMPLED_FLAG));
  });

  it('sets no header when there is no active span', () => {
    const res = makeRes();
    getActiveSpan.mockReturnValue(undefined);

    exposeTraceParentToBrowser(REQ, res, vi.fn() as NextFunction);

    expect(res.setHeader).not.toHaveBeenCalled();
  });

  it('sets no header for the all-zero span context a non-recording span reports', () => {
    const res = makeRes();
    getActiveSpan.mockReturnValue(
      spanWith({
        traceId: INVALID_TRACEID,
        spanId: INVALID_SPANID,
        traceFlags: TraceFlags.NONE,
      }),
    );

    exposeTraceParentToBrowser(REQ, res, vi.fn() as NextFunction);

    expect(res.setHeader).not.toHaveBeenCalled();
  });

  it('appends to an existing Server-Timing header instead of replacing it', () => {
    const res = makeRes();
    const existingEntry = randomUUID();
    res.setHeader(SERVER_TIMING_HEADER, existingEntry);
    (res.setHeader as ReturnType<typeof vi.fn>).mockClear();
    const spanContext = newSpanContext(TraceFlags.SAMPLED);
    getActiveSpan.mockReturnValue(spanWith(spanContext));

    exposeTraceParentToBrowser(REQ, res, vi.fn() as NextFunction);

    expect(res.headers[SERVER_TIMING_HEADER]).toBe(`${existingEntry}, ${traceParentEntry(spanContext, SAMPLED_FLAG)}`);
  });

  it('always continues the middleware chain', () => {
    const next = vi.fn() as NextFunction;
    getActiveSpan.mockReturnValue(undefined);

    exposeTraceParentToBrowser(REQ, makeRes(), next);

    expect(next).toHaveBeenCalledOnce();
  });
});
