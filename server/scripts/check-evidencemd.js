/**
 * Verifies connectivity to EvidenceMD and that the clinical engine answers in Georgian.
 *   node scripts/check-evidencemd.js
 */
import { askEvidenceMd } from '../src/lib/evidencemd.js';
import { env } from '../src/config/env.js';

console.log(`\nEvidenceMD → ${env.EVIDENCEMD_BASE_URL} (${env.EVIDENCEMD_MODEL})\n`);

const started = Date.now();
const result = await askEvidenceMd({
  mode: 'DOCTOR',
  messages: [
    {
      role: 'user',
      content: '35 წლის ვარ, სამი დღეა მაქვს ყელის ტკივილი და 37.8 გრადუსი ტემპერატურა. რა შეიძლება იყოს მიზეზი?',
    },
  ],
});

const georgianChars = (result.content.match(/[\u10A0-\u10FF]/g) ?? []).length;
const ratio = georgianChars / result.content.length;

console.log(result.content);
console.log('\n──────────────────────────────────────────');
console.log(`model            : ${result.model}`);
console.log(`latency          : ${((Date.now() - started) / 1000).toFixed(1)}s`);
console.log(`georgian density : ${(ratio * 100).toFixed(1)}%`);
console.log(`disclaimer       : ${result.content.includes('არ არის საბოლოო დიაგნოზი') ? 'present' : 'MISSING'}`);
console.log(`tokens           : ${JSON.stringify(result.usage)}`);
console.log('──────────────────────────────────────────\n');

process.exitCode = ratio > 0.4 ? 0 : 1;
