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

export interface PsnPreferences {
  harvest_trophies: boolean;
  harvest_identity: boolean;
  harvest_presence: boolean;
  harvest_devices: boolean;
}

export interface UserRecord {
  sub: string;
  email: string | null;
  psn: PsnLink | null;
  psnPreferences: PsnPreferences;
}

const DEFAULT_PSN_PREFERENCES: PsnPreferences = {
  harvest_trophies: false,
  harvest_identity: false,
  harvest_presence: false,
  harvest_devices: false,
};

export interface GameSummary {
  game_id: string;
  canonical_title: string;
  franchise: string | null;
  genre: string | null;
  aaa_tier: string | null;
}

interface CollectionGame {
  game_id: string;
  title: string;
  genre: string;
  aaa_tier: string;
  franchise: string;
  composite_score: number | null;
  rank_score: number;
  size_gb: number;
}

interface DefinitionRecord {
  definition_id: string;
  name: string;
  kind: string;
  console_id: string | null;
  genre_filter: string[];
  min_score: number | null;
  aaa_tier_filter: string | null;
}

interface LibraryRun {
  sub: string;
  status: 'queued' | 'running' | 'succeeded' | 'failed';
  error: string | null;
}

interface LibraryRefreshOutcome {
  status: 'succeeded' | 'failed';
  error?: string;
}

// ── In-memory store ───────────────────────────────────────────────────────────

interface ActionLogEntry {
  action: string;
  detail: string | null;
  occurred_at: string;
}

const users = new Map<string, UserRecord>();
const consoles = new Map<string, Set<string>>();
const definitions = new Map<string, DefinitionRecord[]>();
const libraryRuns = new Map<string, LibraryRun>();
const nextLibraryOutcome = new Map<string, LibraryRefreshOutcome>();
const actionLog = new Map<string, ActionLogEntry[]>();

const DEFAULT_SUB = 'e2e-user-id';

function logAction(action: string, detail: string | null = null): void {
  const entries = actionLog.get(DEFAULT_SUB) ?? [];
  entries.push({ action, detail, occurred_at: new Date().toISOString() });
  actionLog.set(DEFAULT_SUB, entries);
}

let CATALOG_GAMES: GameSummary[] = [
  { game_id: 'g-uncharted-4', canonical_title: 'Uncharted 4: A Thief’s End', franchise: 'Uncharted', genre: 'Action-Adventure', aaa_tier: 'AAA' },
  { game_id: 'g-tlou2', canonical_title: 'The Last of Us Part II', franchise: 'The Last of Us', genre: 'Action-Adventure', aaa_tier: 'AAA' },
  { game_id: 'g-bloodborne', canonical_title: 'Bloodborne', franchise: null, genre: 'RPG', aaa_tier: 'AAA' },
  { game_id: 'g-hades', canonical_title: 'Hades', franchise: null, genre: 'Roguelike', aaa_tier: 'Indie' },
  { game_id: 'g-hollow-knight', canonical_title: 'Hollow Knight', franchise: null, genre: 'Metroidvania', aaa_tier: 'Indie' },
  { game_id: 'g-gt7', canonical_title: 'Gran Turismo 7', franchise: 'Gran Turismo', genre: 'Racing', aaa_tier: 'AAA' },
  { game_id: 'g-returnal', canonical_title: 'Returnal', franchise: null, genre: 'Roguelike', aaa_tier: 'AA' },
  { game_id: 'g-stray', canonical_title: 'Stray', franchise: null, genre: 'Adventure', aaa_tier: 'Indie' },
];

const TROPHY_SUMMARY = {
  level: 42,
  progress: 65,
  tier: 3,
  earned: { bronze: 120, silver: 45, gold: 12, platinum: 3 },
  account_id: 'psn-account-e2e',
};

const IDENTITY = {
  account_id: 'psn-account-e2e',
  online_id: 'e2e_gamer',
  region: 'US',
};

const PRESENCE = {
  online_status: 'online',
  platform: 'PS5',
  last_online_date: '2026-07-16T12:00:00Z',
  game_title: 'Bloodborne',
};

const DEVICES = {
  devices: [
    {
      device_id: 'dev-1',
      device_type: 'PS5',
      device_name: 'My PS5',
      activation_type: 'primary',
      activation_date: '2024-01-01T00:00:00Z',
      deactivation_date: null,
    },
  ],
};

function currentUser(): UserRecord {
  let user = users.get(DEFAULT_SUB);
  if (!user) {
    user = { sub: DEFAULT_SUB, email: 'e2e@test.invalid', psn: null, psnPreferences: { ...DEFAULT_PSN_PREFERENCES } };
    users.set(DEFAULT_SUB, user);
  }
  return user;
}

function ownedConsoles(): Set<string> {
  let owned = consoles.get(DEFAULT_SUB);
  if (!owned) {
    owned = new Set();
    consoles.set(DEFAULT_SUB, owned);
  }
  return owned;
}

function userDefinitions(): DefinitionRecord[] {
  let list = definitions.get(DEFAULT_SUB);
  if (!list) {
    list = [];
    definitions.set(DEFAULT_SUB, list);
  }
  return list;
}

/** Deterministic mock size/score fixtures, matched to CATALOG_GAMES's fixed rows. */
function toCollectionGame(game: GameSummary): CollectionGame {
  return {
    game_id: game.game_id,
    title: game.canonical_title,
    genre: game.genre ?? 'Unclassified',
    aaa_tier: game.aaa_tier ?? 'Indie',
    franchise: game.franchise ?? game.canonical_title,
    composite_score: 8,
    rank_score: 1,
    size_gb: 40,
  };
}

function generateCollection(spec: {
  kind: string;
  genre_filter: string[];
  min_score: number | null;
  aaa_tier_filter: string | null;
}): { included: CollectionGame[]; excluded: CollectionGame[]; used_gb: number | null } {
  const matches = (game: GameSummary): boolean => {
    if (spec.genre_filter.length > 0 && !spec.genre_filter.includes(game.genre ?? '')) {
      return false;
    }
    if (spec.aaa_tier_filter && game.aaa_tier !== spec.aaa_tier_filter) {
      return false;
    }
    return true;
  };

  const included: CollectionGame[] = [];
  const excluded: CollectionGame[] = [];
  for (const game of CATALOG_GAMES) {
    (matches(game) ? included : excluded).push(toCollectionGame(game));
  }

  const usedGb = included.length > 0 ? included.reduce((sum, game) => sum + game.size_gb, 0) : null;
  return { included, excluded, used_gb: usedGb };
}

// ── Express app factory ───────────────────────────────────────────────────────

export function createCuratorApp(): Express {
  const app = express();
  app.use(express.json());

  // ── Control API (/_test/*) — test state management ──────────────────────

  /** Clear all state (called at the start of each test). */
  app.post('/_test/reset', (_req: Request, res: Response) => {
    users.clear();
    consoles.clear();
    definitions.clear();
    libraryRuns.clear();
    nextLibraryOutcome.clear();
    actionLog.clear();
    res.status(204).end();
  });

  /** Override the fixed catalog fixture (defaults back to the built-in list on reset). */
  app.post('/_test/catalog-games', (req: Request, res: Response) => {
    const body = req.body as { games?: GameSummary[] };
    CATALOG_GAMES = body.games ?? CATALOG_GAMES;
    res.status(204).end();
  });

  /** Seed the current user's owned console ids (empty by default — capacity_fill/install-toggle
   * 404s are the default path, matching the real "no console CRUD" situation). */
  app.post('/_test/consoles', (req: Request, res: Response) => {
    const body = req.body as { consoleIds?: string[] };
    consoles.set(DEFAULT_SUB, new Set(body.consoleIds ?? []));
    res.status(204).end();
  });

  /** Configure the outcome the next `/library/refresh` job resolves to (default: succeeded). */
  app.post('/_test/library-refresh-outcome', (req: Request, res: Response) => {
    const body = req.body as LibraryRefreshOutcome;
    nextLibraryOutcome.set(DEFAULT_SUB, body);
    res.status(204).end();
  });

  /** Seed the current user's PSN link state. */
  app.post('/_test/psn-link', (req: Request, res: Response) => {
    const body = req.body as Partial<PsnLink>;
    const user = currentUser();
    const accessTokenExpiresAt: string | null =
      'access_token_expires_at' in body ? (body.access_token_expires_at ?? null) : '2026-08-01T00:00:00Z';
    const refreshTokenExpiresAt: string | null =
      'refresh_token_expires_at' in body ? (body.refresh_token_expires_at ?? null) : '2027-01-01T00:00:00Z';
    user.psn = { access_token_expires_at: accessTokenExpiresAt, refresh_token_expires_at: refreshTokenExpiresAt };
    res.status(204).end();
  });

  /** Seed the current user's PSN harvest preferences (defaults back to all-false on reset). */
  app.post('/_test/psn-preferences', (req: Request, res: Response) => {
    const body = req.body as Partial<PsnPreferences>;
    const user = currentUser();
    user.psnPreferences = { ...DEFAULT_PSN_PREFERENCES, ...body };
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

  /** DELETE /me — permanently delete the caller's account and all associated data. */
  app.delete('/me', (_req: Request, res: Response) => {
    logAction('account_deleted');
    users.delete(DEFAULT_SUB);
    consoles.delete(DEFAULT_SUB);
    definitions.delete(DEFAULT_SUB);
    res.status(204).end();
  });

  /** GET /me/actions — the caller's own action-history log. */
  app.get('/me/actions', (_req: Request, res: Response) => {
    res.json({ actions: actionLog.get(DEFAULT_SUB) ?? [] });
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
    logAction('link_succeeded');
    res.status(200).json({ linked: true, psn: user.psn });
  });

  /** DELETE /psn/link — unlink the PSN account. */
  app.delete('/psn/link', (_req: Request, res: Response) => {
    const user = currentUser();
    user.psn = null;
    logAction('unlinked');
    res.status(204).end();
  });

  /** GET /me/psn-preferences — the caller's PSN harvest preference flags. 404 if not linked. */
  app.get('/me/psn-preferences', (_req: Request, res: Response) => {
    const user = currentUser();
    if (!user.psn) {
      res.status(404).json({ detail: 'PSN account is not linked.' });
      return;
    }
    res.json(user.psnPreferences);
  });

  /** PUT /me/psn-preferences — replace all 4 harvest preference flags. 404 if not linked. */
  app.put('/me/psn-preferences', (req: Request, res: Response) => {
    const user = currentUser();
    if (!user.psn) {
      res.status(404).json({ detail: 'PSN account is not linked.' });
      return;
    }
    const body = req.body as Partial<PsnPreferences>;
    user.psnPreferences = { ...DEFAULT_PSN_PREFERENCES, ...body };
    res.status(204).end();
  });

  /** GET /trophies/summary — 404 if unlinked, 403 if harvest_trophies is off. */
  app.get('/trophies/summary', (_req: Request, res: Response) => {
    const user = currentUser();
    if (!user.psn) {
      res.status(404).json({ detail: 'PSN account is not linked.' });
      return;
    }
    if (!user.psnPreferences.harvest_trophies) {
      res.status(403).json({ detail: 'Trophy harvesting is disabled for this account.' });
      return;
    }
    res.json(TROPHY_SUMMARY);
  });

  /** GET /identity — 404 if unlinked, 403 if harvest_identity is off. */
  app.get('/identity', (_req: Request, res: Response) => {
    const user = currentUser();
    if (!user.psn) {
      res.status(404).json({ detail: 'PSN account is not linked.' });
      return;
    }
    if (!user.psnPreferences.harvest_identity) {
      res.status(403).json({ detail: 'Identity harvesting is disabled for this account.' });
      return;
    }
    res.json(IDENTITY);
  });

  /** GET /presence — 404 if unlinked, 403 if harvest_presence is off. */
  app.get('/presence', (_req: Request, res: Response) => {
    const user = currentUser();
    if (!user.psn) {
      res.status(404).json({ detail: 'PSN account is not linked.' });
      return;
    }
    if (!user.psnPreferences.harvest_presence) {
      res.status(403).json({ detail: 'Presence harvesting is disabled for this account.' });
      return;
    }
    res.json(PRESENCE);
  });

  /** GET /devices — 404 if unlinked, 403 if harvest_devices is off. */
  app.get('/devices', (_req: Request, res: Response) => {
    const user = currentUser();
    if (!user.psn) {
      res.status(404).json({ detail: 'PSN account is not linked.' });
      return;
    }
    if (!user.psnPreferences.harvest_devices) {
      res.status(403).json({ detail: 'Device harvesting is disabled for this account.' });
      return;
    }
    res.json(DEVICES);
  });

  /** GET /catalog/games — filter + paginate the fixed catalog fixture. */
  app.get('/catalog/games', (req: Request, res: Response) => {
    const franchise = req.query['franchise'] as string | undefined;
    const genre = req.query['genre'] as string | undefined;
    const aaaTier = req.query['aaaTier'] as string | undefined;
    const limit = req.query['limit'] ? parseInt(req.query['limit'] as string, 10) : 50;
    const offset = req.query['offset'] ? parseInt(req.query['offset'] as string, 10) : 0;

    const filtered = CATALOG_GAMES.filter(
      (game) =>
        (!franchise || game.franchise === franchise) &&
        (!genre || game.genre === genre) &&
        (!aaaTier || game.aaa_tier === aaaTier),
    );
    res.json({ games: filtered.slice(offset, offset + limit) });
  });

  /** POST /collections/preview — generate an unpersisted collection from an inline spec. */
  app.post('/collections/preview', (req: Request, res: Response) => {
    const spec = req.body as {
      kind: string;
      console_id?: string | null;
      genre_filter?: string[];
      min_score?: number | null;
      aaa_tier_filter?: string | null;
    };

    if (spec.kind !== 'capacity_fill' && spec.kind !== 'filter_list') {
      res.status(400).json({ detail: "kind must be 'capacity_fill' or 'filter_list'." });
      return;
    }
    if (spec.kind === 'capacity_fill' && (!spec.console_id || !ownedConsoles().has(spec.console_id))) {
      res.status(400).json({ detail: 'console_id is missing or unknown.' });
      return;
    }

    res.json(
      generateCollection({
        kind: spec.kind,
        genre_filter: spec.genre_filter ?? [],
        min_score: spec.min_score ?? null,
        aaa_tier_filter: spec.aaa_tier_filter ?? null,
      }),
    );
  });

  /** POST /collections — save a named collection definition. */
  app.post('/collections', (req: Request, res: Response) => {
    const body = req.body as {
      name: string;
      kind: string;
      console_id?: string | null;
      genre_filter?: string[];
      min_score?: number | null;
      aaa_tier_filter?: string | null;
    };

    if (body.kind !== 'capacity_fill' && body.kind !== 'filter_list') {
      res.status(400).json({ detail: "kind must be 'capacity_fill' or 'filter_list'." });
      return;
    }

    const definition: DefinitionRecord = {
      definition_id: `def-${userDefinitions().length + 1}`,
      name: body.name,
      kind: body.kind,
      console_id: body.console_id ?? null,
      genre_filter: body.genre_filter ?? [],
      min_score: body.min_score ?? null,
      aaa_tier_filter: body.aaa_tier_filter ?? null,
    };
    userDefinitions().push(definition);
    res.status(201).json(definition);
  });

  /** GET /collections — list the caller's saved definitions. */
  app.get('/collections', (_req: Request, res: Response) => {
    res.json(userDefinitions());
  });

  /** POST /collections/{id}/runs — generate + persist a run against a saved definition. */
  app.post('/collections/:id/runs', (req: Request, res: Response) => {
    const definition = userDefinitions().find((d) => d.definition_id === req.params['id']);
    if (!definition) {
      res.status(404).json({ detail: 'Collection definition not found.' });
      return;
    }

    const result = generateCollection(definition);
    res.status(201).json({ run_id: `run-${Date.now()}`, ...result });
  });

  /** PUT /consoles/{consoleId}/installs/{gameId} — set install-checked state on an owned console. */
  app.put('/consoles/:consoleId/installs/:gameId', (req: Request, res: Response) => {
    const { consoleId, gameId } = req.params;
    if (!ownedConsoles().has(consoleId)) {
      res.status(404).json({ detail: 'Console not found.' });
      return;
    }

    const body = req.body as { installed: boolean };
    res.json({ console_id: consoleId, game_id: gameId, installed: body.installed });
  });

  /** POST /library/refresh — queue a job that transitions queued -> running -> a terminal status
   * on short timers, so the real Angular poll loop observes a genuine state transition. */
  app.post('/library/refresh', (_req: Request, res: Response) => {
    const runId = `lib-run-${Date.now()}`;
    libraryRuns.set(runId, { sub: DEFAULT_SUB, status: 'queued', error: null });

    setTimeout(() => {
      const run = libraryRuns.get(runId);
      if (run) {
        run.status = 'running';
      }
    }, 300);

    setTimeout(() => {
      const run = libraryRuns.get(runId);
      if (run) {
        const outcome = nextLibraryOutcome.get(DEFAULT_SUB) ?? { status: 'succeeded' };
        run.status = outcome.status;
        run.error = outcome.error ?? null;
      }
    }, 900);

    res.status(202).json({ run_id: runId });
  });

  /** GET /library/refresh/{runId} — poll a queued library-refresh job's status. */
  app.get('/library/refresh/:runId', (req: Request, res: Response) => {
    const run = libraryRuns.get(req.params['runId']);
    if (!run || run.sub !== DEFAULT_SUB) {
      res.status(404).json({ detail: 'Library refresh run not found.' });
      return;
    }
    res.json({ run_id: req.params['runId'], status: run.status, error: run.error });
  });

  return app;
}
