import { HttpInterceptorFn } from '@angular/common/http';
import { inject, REQUEST } from '@angular/core';

export const appInterceptor: HttpInterceptorFn = (req, next) => {
  const headers = req.headers.set('X-CSRF', '1');
  const cookie = inject(REQUEST)?.headers.get('cookie');
  const withCookie = cookie !== null && cookie !== undefined ? headers.set('Cookie', cookie) : headers;
  return next(req.clone({ withCredentials: true, headers: withCookie }));
};
