import { HttpInterceptorFn } from '@angular/common/http';
import { inject, REQUEST } from '@angular/core';

// `withCredentials: true` makes the browser attach the session cookie automatically -- but that is a
// browser-only mechanism. Under SSR, Angular's HttpClient issues these requests via Node's fetch with
// no cookie jar, so every SSR HTTP call (including AuthService's `bff/user` check that every guarded
// route depends on) went out unauthenticated regardless of the visitor's real session, permanently
// redirecting signed-in users to login on first render. REQUEST carries the original incoming
// Request during SSR (null in the browser, where the browser's own cookie handling already applies),
// so forwarding its Cookie header here is what makes SSR requests carry the same session as the
// browser that made them.
export const appInterceptor: HttpInterceptorFn = (req, next) => {
  const headers = req.headers.set('X-CSRF', '1');
  const cookie = inject(REQUEST)?.headers.get('cookie');
  const withCookie = cookie !== null && cookie !== undefined ? headers.set('Cookie', cookie) : headers;
  return next(req.clone({ withCredentials: true, headers: withCookie }));
};
