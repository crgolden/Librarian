
import { createCuratorApp } from './curator.js';
import { MOCK_CURATOR_ORIGIN, MOCK_CURATOR_PORT } from './mock-endpoints.js';

const app = createCuratorApp();

app.listen(MOCK_CURATOR_PORT, () => {
  console.log(`[MockCurator] Listening on ${MOCK_CURATOR_ORIGIN}`);
});
