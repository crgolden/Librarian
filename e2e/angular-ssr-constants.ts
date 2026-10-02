export const AngularSsrMarkers = {
  serverContextAttribute: 'ng-server-context',
  dehydratedSelector: '[ngh], [jsaction]',
  bootstrapScript: /\/main-[A-Z0-9]+\.js$/,
} as const;
