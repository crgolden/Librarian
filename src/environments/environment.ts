// environment.ts — production defaults (used by the default `production` build configuration).
// Hosts allowed for SSR (Angular rejects non-allow-listed Host headers and silently falls back to
// CSR, which would defeat SSR/SEO). No custom domain has been confirmed for Librarian yet, so this
// uses the safe Azure App Service default; add the custom domain here once one is registered.
export const environment = {
  production: true,
  allowedHosts: ['*.azurewebsites.net'],
};
