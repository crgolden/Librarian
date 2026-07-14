/**
 * Standalone entry point for the mock Curator API.
 * Launched by Playwright's webServer config via: npx tsx e2e/mocks/curator-server.ts
 */

import { createCuratorApp } from './curator.js';

const PORT = parseInt(process.env['MOCK_CURATOR_PORT'] ?? '4101', 10);
const app = createCuratorApp();

app.listen(PORT, () => {
  console.log(`[MockCurator] Listening on http://localhost:${PORT}`);
});
