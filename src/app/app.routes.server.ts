import { RenderMode, ServerRoute } from '@angular/ssr';

export const serverRoutes: ServerRoute[] = [
  { path: '', renderMode: RenderMode.Server },
  { path: 'psn', renderMode: RenderMode.Client },
  { path: 'faq', renderMode: RenderMode.Server },
  { path: 'privacy', renderMode: RenderMode.Server },
  { path: '**', renderMode: RenderMode.Client },
];
