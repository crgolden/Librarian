import { ContentKind } from '../curator/curator.models';

const CONTENT_KIND_LABELS: Readonly<Partial<Record<ContentKind, string>>> = {
  media_app: 'Media app',
  add_on: 'Add-on',
  demo: 'Demo',
  soundtrack: 'Soundtrack',
  theme: 'Theme',
  subscription: 'Subscription',
};

export function contentKindLabel(kind: ContentKind | null | undefined): string | null {
  return kind ? (CONTENT_KIND_LABELS[kind] ?? null) : null;
}
