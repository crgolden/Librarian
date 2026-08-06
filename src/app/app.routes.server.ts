import { RenderMode, ServerRoute } from '@angular/ssr';

export const serverRoutes: ServerRoute[] = [
  { path: '', renderMode: RenderMode.Server },
  // Auth-gated, per-user routes are never SEO-relevant, and authGuard only works correctly in
  // the browser (it reads AuthService's client-fetched session state, and Node has no
  // `location` global for the anonymous redirect) — Client-render all of them, not just `psn`.
  { path: 'psn', renderMode: RenderMode.Client },
  { path: 'catalog', renderMode: RenderMode.Client },
  { path: 'collections', renderMode: RenderMode.Client },
  { path: 'collections/d/:definitionId', renderMode: RenderMode.Client },
  { path: 'collections/:sub', renderMode: RenderMode.Client },
  { path: 'consoles', renderMode: RenderMode.Client },
  // Anonymous (no authGuard), but still data-fetching like every other per-entity route above — same
  // Client treatment, not Server: this app has no precedent yet for a data-fetching route rendering on
  // the server (only '', faq, and privacy are Server, and none of them make an HTTP call in ngOnInit),
  // and there's no SEO/link-unfurl payoff to justify being the first, given the page is noindex anyway.
  { path: 'c/:slug', renderMode: RenderMode.Client },
  { path: 'library', renderMode: RenderMode.Client },
  { path: 'library/:sub', renderMode: RenderMode.Client },
  { path: 'profile', renderMode: RenderMode.Client },
  { path: 'profile/followers', renderMode: RenderMode.Client },
  { path: 'profile/following', renderMode: RenderMode.Client },
  { path: 'profile/settings', renderMode: RenderMode.Client },
  { path: 'u/:sub', renderMode: RenderMode.Client },
  { path: 'u/:sub/followers', renderMode: RenderMode.Client },
  { path: 'u/:sub/following', renderMode: RenderMode.Client },
  { path: 'admin/enrichment', renderMode: RenderMode.Client },
  { path: 'faq', renderMode: RenderMode.Server },
  { path: 'privacy', renderMode: RenderMode.Server },
  // Server-rendered (not Client) so the NotFoundComponent can set a real HTTP 404 via
  // RESPONSE_INIT — a client-rendered response has no server response to set a status on.
  { path: '**', renderMode: RenderMode.Server },
];
