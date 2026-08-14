import {
  AngularNodeAppEngine,
  createNodeRequestHandler,
  isMainModule,
  writeResponseToNodeResponse,
} from '@angular/ssr/node';
import express from 'express';
import { join } from 'node:path';
import { applySession } from './bff/session';
import { buildBffRouter } from './bff/routes';
import { csrfForMutating, createCuratorProxy } from './bff/proxy';
import { getOidcConfig } from './bff/oidc';
import { robotsHandler, createSitemapHandler } from './bff/sitemap';
import { logger, requestLogger } from './telemetry/logging';
import { environment } from './environments/environment';

const browserDistFolder = join(import.meta.dirname, '../browser');

const app = express();

app.set('trust proxy', 1);

const angularApp = new AngularNodeAppEngine({
  allowedHosts: environment.allowedHosts,
  trustProxyHeaders: ['x-forwarded-for', 'x-forwarded-host', 'x-forwarded-port', 'x-forwarded-proto', 'x-forwarded-tlsversion'],
});

app.get('/health', (_req, res) => {
  res.type('text/plain').send('Healthy');
});

app.use(requestLogger);

applySession(app, {
  isProduction: process.env['NODE_ENV'] === 'production',
  logger,
});

app.use('/bff', buildBffRouter({ getOidcConfig, logger }));

app.use('/curator/api', csrfForMutating, createCuratorProxy({ getOidcConfig, logger }));

app.get('/sitemap.xml', createSitemapHandler({ logger }));

app.get('/robots.txt', robotsHandler);

app.use(
  express.static(browserDistFolder, {
    maxAge: '1y',
    index: false,
    redirect: false,
  }),
);

app.use((req, res, next) => {
  angularApp
    .handle(req)
    .then((response) =>
      response ? writeResponseToNodeResponse(response, res) : next(),
    )
    .catch(next);
});

if (isMainModule(import.meta.url) || process.env['pm_id']) {
  const port = process.env['PORT'] ?? 4100;
  app.listen(port, (error) => {
    if (error) {
      throw error;
    }
    logger.info({ port }, `Node Express server listening on http://localhost:${port}`);
  });
}

export const reqHandler = createNodeRequestHandler(app);
