import { TraceFlags, type Span, type SpanContext } from '@opentelemetry/api';
import type { Request, Response, NextFunction } from 'express';
import { exposeTraceParentToBrowser } from './server-timing';

const { getActiveSpan } = vi.hoisted(() => ({ getActiveSpan: vi.fn() }));

vi.mock('@opentelemetry/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@opentelemetry/api')>();
  return { ...actual, trace: { ...actual.trace, getActiveSpan } };
});

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

const REQ = {} as Request;

describe('exposeTraceParentToBrowser', () => {
  beforeEach(() => {
    getActiveSpan.mockReset();
  });

  it('writes the active trace and span id as a W3C traceparent', () => {
    const res = makeRes();
    const next = vi.fn() as NextFunction;
    getActiveSpan.mockReturnValue(
      spanWith({
        traceId: '4bf92f3577b34da6a3ce929d0e0e4736',
        spanId: '00f067aa0ba902b7',
        traceFlags: TraceFlags.SAMPLED,
      }),
    );

    exposeTraceParentToBrowser(REQ, res, next);

    expect(res.headers['Server-Timing']).toBe(
      'traceparent;desc="00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01"',
    );
  });

  it('encodes an unsampled span with the 00 flag rather than omitting it', () => {
    const res = makeRes();
    getActiveSpan.mockReturnValue(
      spanWith({
        traceId: '4bf92f3577b34da6a3ce929d0e0e4736',
        spanId: '00f067aa0ba902b7',
        traceFlags: TraceFlags.NONE,
      }),
    );

    exposeTraceParentToBrowser(REQ, res, vi.fn() as NextFunction);

    expect(res.headers['Server-Timing']).toBe(
      'traceparent;desc="00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-00"',
    );
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
        traceId: '00000000000000000000000000000000',
        spanId: '0000000000000000',
        traceFlags: TraceFlags.NONE,
      }),
    );

    exposeTraceParentToBrowser(REQ, res, vi.fn() as NextFunction);

    expect(res.setHeader).not.toHaveBeenCalled();
  });

  it('appends to an existing Server-Timing header instead of replacing it', () => {
    const res = makeRes();
    res.setHeader('Server-Timing', 'cache;desc="hit"');
    (res.setHeader as ReturnType<typeof vi.fn>).mockClear();
    getActiveSpan.mockReturnValue(
      spanWith({
        traceId: '4bf92f3577b34da6a3ce929d0e0e4736',
        spanId: '00f067aa0ba902b7',
        traceFlags: TraceFlags.SAMPLED,
      }),
    );

    exposeTraceParentToBrowser(REQ, res, vi.fn() as NextFunction);

    expect(res.headers['Server-Timing']).toBe(
      'cache;desc="hit", traceparent;desc="00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01"',
    );
  });

  it('always continues the middleware chain', () => {
    const next = vi.fn() as NextFunction;
    getActiveSpan.mockReturnValue(undefined);

    exposeTraceParentToBrowser(REQ, makeRes(), next);

    expect(next).toHaveBeenCalledOnce();
  });
});
