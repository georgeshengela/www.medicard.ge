// Writes board-data.js for board.html: today's real sky, a sample natal chart and glyph paths.
import { writeFileSync, readFileSync } from 'node:fs';
import * as X from '../../server/src/lib/horoscope/astro.js';

const now = X.zonedToUtc(X.civilDate(new Date()), '12:00', 'Asia/Tbilisi');
const sky = X.skyAt(now);
const events = X.skyEvents(new Date(), new Date(Date.now() + 75 * 86400000)).filter((e) => e.type !== 'moon_ingress');
const chart = X.natalChart({ date: '1990-05-15', time: '14:30', tz: 'Asia/Tbilisi', lat: 41.7151, lon: 44.8271 });
const transits = X.transitsFor(chart, now).slice(0, 4);
const glyphs = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const data = { today: X.civilDate(new Date()), sky, events, chart, transits, glyphs,
  chinese: X.chineseZodiac('1990-05-15'), lifePath: X.lifePath('1990-05-15'), personalDay: X.personalDay('1990-05-15', X.civilDate(new Date())) };
writeFileSync(new URL('./board-data.js', import.meta.url), `window.BOARD = ${JSON.stringify(data)};\n`);
console.log('ok', events.length, transits.map((t) => `${t.transit} ${t.aspect} ${t.natal} ${t.orb}`));
