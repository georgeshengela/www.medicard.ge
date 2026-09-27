// Local API + admin on the main database with every background job switched off
// (no community push, price-drop alerts, referral rewards or pharmacy sync), so
// testing new admin endpoints never sends pushes or pays coins twice.
//   node scripts/admin-local-server.mjs   →  http://localhost:4390/admin/
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const serverDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../server');
process.chdir(serverDir);
process.env.PORT = process.env.PORT || '4390';
process.env.COMMUNITY_ENABLED = 'false';
process.env.PRICE_DROP_ALERTS = 'false';
process.env.REFERRAL_REWARDS_DISABLED = 'true';
if (process.env.NODE_ENV === 'production') process.env.NODE_ENV = 'development';
await import('../server/src/server.js');
