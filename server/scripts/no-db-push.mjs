// `prisma db push` against the main database would drop the tables and foreign keys that the
// additive raw-SQL installers created (see the end of prisma/schema.prisma). It is allowed only
// on a local, disposable Postgres (localhost / 127.0.0.1 / ::1) for a fresh development setup.
import 'dotenv/config';
import { spawnSync } from 'node:child_process';

export function isLocalDatabaseUrl(raw) {
  try {
    const host = new URL(String(raw || '')).hostname.replace(/^\[|\]$/g, '');
    return host === 'localhost' || host === '127.0.0.1' || host === '::1';
  } catch {
    return false;
  }
}

if (process.argv[1]?.endsWith('no-db-push.mjs')) {
  if (!isLocalDatabaseUrl(process.env.DATABASE_URL)) {
    console.error('Refused: `prisma db push` is blocked on non-local databases. Ship schema changes as an additive SQL installer (prisma/*.sql + scripts/install-*.mjs).');
    process.exit(1);
  }
  const result = spawnSync('npx', ['prisma', 'db', 'push', ...process.argv.slice(2)], { stdio: 'inherit', shell: true });
  process.exit(result.status ?? 1);
}
