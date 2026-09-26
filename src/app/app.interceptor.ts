import { HttpInterceptorFn } from '@angular/common/http';
import { inject, REQUEST } from '@angular/core';
import { COOKIE_HEADER, CSRF_HEADER, CSRF_HEADER_VALUE } from '../shared/bff-contract';

export const appInterceptor: HttpInterceptorFn = (req, next) => {
  const headers = req.headers.set(CSRF_HEADER, CSRF_HEADER_VALUE);
  const request = inject(REQUEST);
  const cookie = request?.headers.get(COOKIE_HEADER);
  const withCookie =
    cookie !== null && cookie !== undefined && request && sameOrigin(req.url, request.url)
      ? headers.set(COOKIE_HEADER, cookie)
      : headers;
  return next(req.clone({ withCredentials: true, headers: withCookie }));
};

function sameOrigin(requestedUrl: string, renderedUrl: string): boolean {
  if (isRelative(requestedUrl)) {
    return true;
  }

  const renderedOrigin = new URL(renderedUrl).origin;
  return requestedUrl === renderedOrigin || requestedUrl.startsWith(`${renderedOrigin}/`);
}

function isRelative(url: string): boolean {
  return !url.startsWith('//') && !/^[a-z][a-z0-9+.-]*:/i.test(url);
}
