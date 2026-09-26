import { RenderMode, ServerRoute } from '@angular/ssr';
import { AppPaths } from './app-paths';

export const serverRoutes: ServerRoute[] = [
  { path: AppPaths.home, renderMode: RenderMode.Server },
  { path: AppPaths.account, renderMode: RenderMode.Client },
  { path: AppPaths.psn, renderMode: RenderMode.Client },
  { path: AppPaths.catalog, renderMode: RenderMode.Server },
  { path: AppPaths.catalogGame, renderMode: RenderMode.Server },
  { path: AppPaths.collections, renderMode: RenderMode.Client },
  { path: AppPaths.collectionDefinition, renderMode: RenderMode.Client },
  { path: AppPaths.userCollections, renderMode: RenderMode.Client },
  { path: AppPaths.consoles, renderMode: RenderMode.Client },
  { path: AppPaths.sharedCollection, renderMode: RenderMode.Client },
  { path: AppPaths.library, renderMode: RenderMode.Client },
  { path: AppPaths.psPlus, renderMode: RenderMode.Client },
  { path: AppPaths.userLibrary, renderMode: RenderMode.Client },
  { path: AppPaths.profile, renderMode: RenderMode.Client },
  { path: AppPaths.profileFollowers, renderMode: RenderMode.Client },
  { path: AppPaths.profileFollowing, renderMode: RenderMode.Client },
  { path: AppPaths.profileSettings, renderMode: RenderMode.Client },
  { path: AppPaths.userProfile, renderMode: RenderMode.Client },
  { path: AppPaths.userFollowers, renderMode: RenderMode.Client },
  { path: AppPaths.userFollowing, renderMode: RenderMode.Client },
  { path: AppPaths.adminEnrichment, renderMode: RenderMode.Client },
  { path: AppPaths.faq, renderMode: RenderMode.Server },
  { path: AppPaths.privacy, renderMode: RenderMode.Server },
  { path: AppPaths.notFound, renderMode: RenderMode.Server },
];
