import { isSpanContextValid, trace } from '@opentelemetry/api';
import type { Request, Response, NextFunction } from 'express';

export const TRACE_PARENT_VERSION = '00';

export const SERVER_TIMING_HEADER = 'Server-Timing';

export const TRACE_PARENT_ENTRY = 'traceparent';

export function exposeTraceParentToBrowser(
  _req: Request,
  res: Response,
  next: NextFunction,
): void {
  const spanContext = trace.getActiveSpan()?.spanContext();

  if (spanContext && isSpanContextValid(spanContext)) {
    const flags = spanContext.traceFlags.toString(16).padStart(2, '0');
    const traceParent = [
      TRACE_PARENT_VERSION,
      spanContext.traceId,
      spanContext.spanId,
      flags,
    ].join('-');
    const entry = `${TRACE_PARENT_ENTRY};desc="${traceParent}"`;
    const existing = res.getHeader(SERVER_TIMING_HEADER);

    res.setHeader(SERVER_TIMING_HEADER, existing ? `${existing.toString()}, ${entry}` : entry);
  }

  next();
}
