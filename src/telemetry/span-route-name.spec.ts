import type { Request, Response, NextFunction } from 'express';
import { nameSpansByRoute, routeTemplateFor } from './span-route-name';

const { getActiveSpan } = vi.hoisted(() => ({ getActiveSpan: vi.fn() }));

vi.mock('@opentelemetry/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@opentelemetry/api')>();
  return { ...actual, trace: { ...actual.trace, getActiveSpan } };
});

function makeReq(parts: Partial<Request>): Request {
  return { method: 'GET', path: '/', baseUrl: '', ...parts } as Request;
}

function makeRes() {
  const listeners: Record<string, (() => void)[]> = {};
  return {
    on: vi.fn((event: string, cb: () => void) => {
      (listeners[event] ??= []).push(cb);
    }),
    finish: () => (listeners['finish'] ?? []).forEach((cb) => cb()),
  } as unknown as Response & { finish: () => void };
}

describe('routeTemplateFor', () => {
  it('joins the mount point to the matched route pattern', () => {
    expect(routeTemplateFor(makeReq({ baseUrl: '/bff', route: { path: '/login' } as never }))).toBe('/bff/login');
  });

  it('keeps a parameterised pattern rather than the concrete value', () => {
    const req = makeReq({ baseUrl: '', route: { path: '/catalog/:id' } as never, path: '/catalog/9182' });

    expect(routeTemplateFor(req)).toBe('/catalog/:id');
  });

  it('buckets a mounted proxy that matched no inner route', () => {
    expect(routeTemplateFor(makeReq({ baseUrl: '/curator/api', path: '/library/refresh/abc' }))).toBe('/curator/api/*');
  });

  it('buckets an unmounted path by its first segment, so ids cannot mint span names', () => {
    expect(routeTemplateFor(makeReq({ path: '/catalog/9182' }))).toBe('/catalog/*');
    expect(routeTemplateFor(makeReq({ path: '/catalog/7' }))).toBe('/catalog/*');
  });

  it('names the root request /', () => {
    expect(routeTemplateFor(makeReq({ path: '/' }))).toBe('/');
  });
});

describe('nameSpansByRoute', () => {
  beforeEach(() => getActiveSpan.mockReset());

  it('renames the span only once the response is finished and the route is known', () => {
    const span = { updateName: vi.fn(), setAttribute: vi.fn() };
    getActiveSpan.mockReturnValue(span);
    const req = makeReq({ method: 'POST', baseUrl: '/bff', route: { path: '/login' } as never });
    const res = makeRes();

    nameSpansByRoute(req, res, vi.fn() as NextFunction);
    expect(span.updateName).not.toHaveBeenCalled();

    res.finish();
    expect(span.updateName).toHaveBeenCalledWith('POST /bff/login');
    expect(span.setAttribute).toHaveBeenCalledWith('http.route', '/bff/login');
  });

  it('continues the chain when nothing is being traced', () => {
    getActiveSpan.mockReturnValue(undefined);
    const next = vi.fn() as NextFunction;

    nameSpansByRoute(makeReq({}), makeRes(), next);

    expect(next).toHaveBeenCalledOnce();
  });
});
