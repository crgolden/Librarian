import { HttpInterceptorFn } from '@angular/common/http';

export const appInterceptor: HttpInterceptorFn = (req, next) => {
  const headers = req.headers.set('X-CSRF', '1');
  return next(req.clone({ withCredentials: true, headers }));
};
