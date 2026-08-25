/**
 * Check that all 12 Welcome Screen PNGs exist and aren't duplicate placeholders.
 * Usage: node scripts/figma/verify-welcome-assets.mjs
 */
import { readFile, stat } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');
const ASSET_DIR = join(ROOT, 'mobile', 'assets', 'figma', 'welcome');

const REQUIRED = [
  '01-landing.png',
  '02-health-score.png',
  '03-metrics.png',
  '04-assessment.png',
  '05-doctor.png',
  '06-pharmacy.png',
  '07-medications.png',
  '08-lab.png',
  '09-wellness.png',
  '10-family.png',
  '11-insights.png',
  '12-achievements.png',
];

async function hashFile(path) {
  const buf = await readFile(path);
  return createHash('md5').update(buf).digest('hex');
}

async function main() {
  const hashes = new Map();
  let ok = true;

  for (const file of REQUIRED) {
    const path = join(ASSET_DIR, file);
    try {
      const st = await stat(path);
      const hash = await hashFile(path);
      const dup = [...hashes.entries()].find(([, h]) => h === hash);
      if (dup) {
        console.warn(`⚠ ${file} — identical to ${dup[0]} (placeholder copy?)`);
        ok = false;
      } else {
        hashes.set(file, hash);
      }
      console.log(`✓ ${file} (${Math.round(st.size / 1024)} KB)`);
    } catch {
      console.error(`✗ MISSING: ${file}`);
      ok = false;
    }
  }

  if (!ok) {
    console.log('\nFix: export from Figma → see mobile/design-references/figma/welcome/MANUAL_EXPORT.md');
    process.exit(1);
  }
  console.log('\nAll 12 welcome assets look unique.');
}

main();
