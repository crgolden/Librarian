import { RenderMode, ServerRoute } from '@angular/ssr';

export const serverRoutes: ServerRoute[] = [
  { path: '', renderMode: RenderMode.Server },
  { path: 'psn', renderMode: RenderMode.Client },
  { path: '**', renderMode: RenderMode.Client },
];
