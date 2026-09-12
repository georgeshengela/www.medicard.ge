import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const url = process.env.PHASE38_TEST_DATABASE_URL;
if (!url) {
  console.error('BLOCKED: PHASE38_TEST_DATABASE_URL is not set');
  process.exit(2);
}
process.env.DATABASE_URL = url;

const serverDir = dirname(dirname(fileURLToPath(import.meta.url)));
const prismaCli = join(serverDir, 'node_modules', 'prisma', 'build', 'index.js');

function run(args) {
  return execFileSync(process.execPath, [prismaCli, ...args], {
    cwd: serverDir,
    encoding: 'utf8',
    env: process.env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

console.log('prisma validate...');
console.log(run(['validate', '--schema', 'prisma/schema.prisma']).trim());

console.log('prisma generate...');
console.log(run(['generate', '--schema', 'prisma/schema.prisma']).trim());

console.log('migrate diff from empty...');
const sql = run(['migrate', 'diff', '--from-empty', '--to-schema-datamodel', 'prisma/schema.prisma', '--script']);
const fullPath = join(process.env.TEMP || '/tmp', 'medicard-phase38-full-schema.sql');
writeFileSync(fullPath, sql);
console.log(`wrote full schema SQL bytes=${sql.length}`);

console.log('apply full schema to disposable database...');
run(['db', 'execute', '--file', fullPath, '--schema', 'prisma/schema.prisma']);
console.log('full schema apply ok');

console.log('re-apply canonical Phase 38 SQL (idempotent)...');
run(['db', 'execute', '--file', 'prisma/phase38-medi-world-foundation.sql', '--schema', 'prisma/schema.prisma']);
console.log('canonical Phase 38 SQL apply ok');
