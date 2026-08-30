import { trace } from '@opentelemetry/api';
import type { Request, Response, NextFunction } from 'express';

const HTTP_ROUTE_ATTRIBUTE = 'http.route';
const UNMATCHED_SUFFIX = '/*';
const ROOT_ROUTE = '/';

export function routeTemplateFor(req: Request): string {
  const matched = req.route as { path?: string } | undefined;
  const matchedPath = matched?.path;

  if (matchedPath) {
    const templateSegments: string[] = [];

    if (req.baseUrl) {
      templateSegments.push(req.baseUrl);
    }

    if (matchedPath !== ROOT_ROUTE) {
      templateSegments.push(matchedPath);
    }

    return templateSegments.join('') || ROOT_ROUTE;
  }

  if (req.baseUrl) {
    return `${req.baseUrl}${UNMATCHED_SUFFIX}`;
  }

  const [firstSegment] = (req.path ?? ROOT_ROUTE).split('/').filter(Boolean);

  return firstSegment ? `/${firstSegment}${UNMATCHED_SUFFIX}` : ROOT_ROUTE;
}

export function nameSpansByRoute(req: Request, res: Response, next: NextFunction): void {
  const span = trace.getActiveSpan();

  if (span) {
    res.on('finish', () => {
      const route = routeTemplateFor(req);
      span.updateName(`${req.method} ${route}`);
      span.setAttribute(HTTP_ROUTE_ATTRIBUTE, route);
    });
  }

  next();
}
