import type { Route } from '@angular/router';
import { routes } from '../app.routes';
import { authGuard } from '../auth.guard';
import { adminGuard } from '../admin.guard';
import { PRIMARY_NAV_LINKS } from './site-nav.component';

const routeFor = (path: string): Route | undefined => {
  const bare = path.replace(/^\//, '');
  return routes.find((route) => route.path === bare);
};

const guardsOn = (route: Route | undefined): unknown[] => route?.canActivate ?? [];

describe('PRIMARY_NAV_LINKS is pinned to app.routes.ts', () => {
  it.each(PRIMARY_NAV_LINKS.map((link) => [link.label, link] as const))(
    '%s resolves to a real route',
    (_label, link) => {
      expect(routeFor(link.path)).toBeDefined();
    },
  );

  it.each(PRIMARY_NAV_LINKS.map((link) => [link.label, link] as const))(
    '%s advertises anonymous reachability iff its route carries no authGuard',
    (_label, link) => {
      const guarded = guardsOn(routeFor(link.path)).includes(authGuard);

      expect(link.reachableWithoutSigningIn === true).toBe(!guarded);
    },
  );

  it.each(PRIMARY_NAV_LINKS.map((link) => [link.label, link] as const))(
    '%s is marked admin-only iff its route carries adminGuard',
    (_label, link) => {
      const adminGuarded = guardsOn(routeFor(link.path)).includes(adminGuard);

      expect(link.adminOnly === true).toBe(adminGuarded);
    },
  );

  it('offers exactly four bottom tabs, so the bar plus More is a five-slot row', () => {
    expect(PRIMARY_NAV_LINKS.filter((link) => link.tab === true)).toHaveLength(4);
  });

  it('offers no admin-only destination as a bottom tab', () => {
    const adminTabs = PRIMARY_NAV_LINKS.filter((link) => link.tab === true && link.adminOnly === true);

    expect(adminTabs).toEqual([]);
  });

  it('leaves no authGuard-protected page reachable only by typing its URL', () => {
    const advertised = new Set(PRIMARY_NAV_LINKS.map((link) => link.path.replace(/^\//, '')));

    const reachable = (path: string): boolean =>
      path
        .split('/')
        .map((_segment, index, segments) => segments.slice(0, index + 1).join('/'))
        .some((ancestor) => advertised.has(ancestor));

    const unreachable = routes
      .filter((route) => guardsOn(route).includes(authGuard))
      .flatMap((route) => (typeof route.path === 'string' ? [route.path] : []))
      .filter((path) => !path.includes(':') && path !== '**')
      .filter((path) => !reachable(path));

    expect(unreachable).toEqual([]);
  });
});
