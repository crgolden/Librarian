import { isSpanContextValid, trace } from '@opentelemetry/api';
import type { Request, Response, NextFunction } from 'express';

const TRACE_PARENT_VERSION = '00';

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
    const entry = `traceparent;desc="${traceParent}"`;
    const existing = res.getHeader('Server-Timing');

    res.setHeader('Server-Timing', existing ? `${existing.toString()}, ${entry}` : entry);
  }

  next();
}
