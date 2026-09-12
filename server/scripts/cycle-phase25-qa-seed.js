/**
 * Cycle Phase 25 — doctor-summary QA seed.
 *
 *   node scripts/cycle-phase25-qa-seed.js peri|track|pregnancy
 *
 * Account: cycle.qa.phase6@medicard.ge / CycleQaPhase6a
 */
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const FIXTURE = process.argv[2] || 'peri';
const dir = path.dirname(fileURLToPath(import.meta.url));

function run(script, arg) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [path.join(dir, script), arg], {
      cwd: path.join(dir, '..'),
      stdio: 'inherit',
    });
    child.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`${script} ${arg} exit ${code}`))));
  });
}

async function main() {
  if (FIXTURE === 'pregnancy') {
    await run('cycle-phase18-qa-seed.js', 'lmp');
    return;
  }
  await run('cycle-phase24-qa-seed.js', 'rich');
  if (FIXTURE === 'track') {
    const { prisma } = await import('../src/lib/prisma.js');
    const user = await prisma.user.findUnique({ where: { email: 'cycle.qa.phase6@medicard.ge' } });
    await prisma.cycleProfile.update({
      where: { userId: user.id },
      data: { mode: 'TRACK_PERIOD' },
    });
    await prisma.$disconnect();
    console.log('Phase 25 seed track: mode=TRACK_PERIOD (same logs)');
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
