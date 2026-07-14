/**
 * Mock Curator API — stands in for the real FastAPI Curator backend during E2E tests.
 *
 * Serves real HTTP routes matching the real Curator API's actual shape (no path prefix — the
 * Node SSR server's curatorProxy strips the '/curator/api' mount prefix before forwarding) so
 * the server can proxy to it server-side (Playwright page.route() only intercepts browser
 * requests, not outbound Node fetch calls). Tests manipulate state via the control API at /_test/*.
 */

import express, { type Express, type Request, type Response } from 'express';

// ── Data model ────────────────────────────────────────────────────────────────

export interface PsnLink {
  access_token_expires_at: string | null;
  refresh_token_expires_at: string | null;
}

export interface UserRecord {
  sub: string;
  email: string | null;
  psn: PsnLink | null;
}

// ── In-memory store ───────────────────────────────────────────────────────────

const users = new Map<string, UserRecord>();

const DEFAULT_SUB = 'e2e-user-id';

function currentUser(): UserRecord {
  let user = users.get(DEFAULT_SUB);
  if (!user) {
    user = { sub: DEFAULT_SUB, email: 'e2e@test.invalid', psn: null };
    users.set(DEFAULT_SUB, user);
  }
  return user;
}

// ── Express app factory ───────────────────────────────────────────────────────

export function createCuratorApp(): Express {
  const app = express();
  app.use(express.json());

  // ── Control API (/_test/*) — test state management ──────────────────────

  /** Clear all state (called at the start of each test). */
  app.post('/_test/reset', (_req: Request, res: Response) => {
    users.clear();
    res.status(204).end();
  });

  /** Seed the current user's PSN link state. */
  app.post('/_test/psn-link', (req: Request, res: Response) => {
    const body = req.body as Partial<PsnLink>;
    const user = currentUser();
    user.psn = {
      access_token_expires_at: body.access_token_expires_at ?? '2026-08-01T00:00:00Z',
      refresh_token_expires_at: body.refresh_token_expires_at ?? '2027-01-01T00:00:00Z',
    };
    res.status(204).end();
  });

  // ── Curator API routes (no path prefix, matches the real upstream API) ──────

  /** GET /health — anonymous liveness check. */
  app.get('/health', (_req: Request, res: Response) => {
    res.type('text/plain').send('Healthy');
  });

  /** GET /me — current user + PSN link status. */
  app.get('/me', (_req: Request, res: Response) => {
    const user = currentUser();
    res.json({
      sub: user.sub,
      email: user.email,
      linked: user.psn !== null,
      psn: user.psn,
    });
  });

  /** POST /psn/link — link a PSN account via NPSSO token. */
  app.post('/psn/link', (req: Request, res: Response) => {
    const body = req.body as Record<string, unknown>;
    const npsso = body['npsso'] as string | undefined;
    if (!npsso) {
      res.status(400).json({ error: 'npsso is required' });
      return;
    }

    const user = currentUser();
    user.psn = { access_token_expires_at: '2026-08-01T00:00:00Z', refresh_token_expires_at: '2027-01-01T00:00:00Z' };
    res.status(200).json({ linked: true, psn: user.psn });
  });

  /** DELETE /psn/link — unlink the PSN account. */
  app.delete('/psn/link', (_req: Request, res: Response) => {
    const user = currentUser();
    user.psn = null;
    res.status(204).end();
  });

  return app;
}
