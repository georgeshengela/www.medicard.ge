import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DOCTOR_PHRASE_EN,
  DOCTOR_PHRASE_KA,
  LEARN_MORE,
  LEARN_MORE_BLOCKED_IDS,
  LEARN_MORE_GROUPS,
  LEARN_MORE_PRIVATE_IDS,
  learnMoreFor,
  learnMoreGroup,
  type LearnMoreEntry,
  type LearnMoreKind,
} from './learnMore.ts';
import { medicalSources } from '../../constants/medicalSources.ts';
import { SEXUAL_OPTIONS } from '../../constants/cycle.ts';
import { ka } from '../ka.ts';
import { FULL_LOG_ORDER, SYMPTOM_GROUPS, flowTiles, moodTiles, mucusTiles, symptomTiles } from '../../lib/cycleFullLog.ts';
import { dayFactSections } from '../../lib/cycleDayFacts.ts';
import type { CycleLog } from '../../lib/api.ts';

/** Every option id the full log (`/cycle/log`) renders, by kind. */
function fullLogIds(): Array<[LearnMoreKind, string]> {
  const out: Array<[LearnMoreKind, string]> = [];
  for (const o of flowTiles()) out.push(['flow', o.id]);
  for (const id of Object.keys(ka.cycle.painType)) out.push(['pain', id]);
  for (const o of moodTiles()) out.push(['mood', o.id]);
  for (const g of SYMPTOM_GROUPS) for (const o of symptomTiles(g)) out.push(['symptom', o.id]);
  for (const o of mucusTiles()) out.push(['mucus', o.id]);
  for (const id of ['ovulationTest', 'pregnancyTest', 'bbt']) out.push(['test', id]);
  for (const id of ['energy', 'sleepQuality', 'stressLevel', 'exerciseLevel', 'caffeine', 'alcohol']) out.push(['lifestyle', id]);
  return out;
}

function allEntries(): Array<[string, LearnMoreEntry]> {
  const rows: Array<[string, LearnMoreEntry]> = [];
  for (const [kind, table] of Object.entries(LEARN_MORE)) for (const [id, e] of Object.entries(table)) rows.push([`${kind}:${id}`, e]);
  for (const [id, e] of Object.entries(LEARN_MORE_GROUPS)) rows.push([`group:${id}`, e]);
  return rows;
}

const SEX_IDS = new Set(SEXUAL_OPTIONS.map((o) => o.id));

test('every option the full log renders has an entry in both languages with non-empty fields', () => {
  const ids = fullLogIds();
  assert.ok(ids.length >= 85, `expected the whole catalogue, got ${ids.length}`);
  for (const [kind, id] of ids) {
    if (SEX_IDS.has(id)) continue;
    const e = learnMoreFor(kind, id, { allowPrivate: true });
    assert.ok(e, `missing learn-more entry ${kind}:${id}`);
    for (const lang of ['ka', 'en'] as const) {
      for (const field of ['what', 'typical', 'whenDoctor'] as const) {
        assert.ok(e[lang][field].trim().length > 10, `${kind}:${id} ${lang}.${field} is empty`);
      }
    }
  }
});

test('every group with a title ⓘ has an entry', () => {
  for (const g of FULL_LOG_ORDER) {
    if (g === 'private' || g === 'tags' || g === 'journal') {
      assert.equal(learnMoreGroup(g), null, `${g} must not have a group entry`);
      continue;
    }
    assert.ok(learnMoreGroup(g), `missing group entry ${g}`);
  }
});

test('sex and other highly sensitive ids are never explained', () => {
  const sensitive = [...SEX_IDS, 'sex', 'intercourse', 'sexual', 'sexualActivity', 'libido', 'notes', 'customTagIds'];
  for (const id of sensitive) {
    assert.ok(LEARN_MORE_BLOCKED_IDS.has(id), `${id} must be blocked`);
    for (const kind of Object.keys(LEARN_MORE) as LearnMoreKind[]) {
      assert.equal(LEARN_MORE[kind][id], undefined, `${kind}:${id} must have no entry`);
      assert.equal(learnMoreFor(kind, id, { allowPrivate: true }), null);
    }
  }
  // Intimate symptoms: only with the private group unlocked.
  for (const id of LEARN_MORE_PRIVATE_IDS) {
    assert.equal(learnMoreFor('symptom', id), null, `${id} must stay hidden while locked`);
    assert.ok(learnMoreFor('symptom', id, { allowPrivate: true }));
  }
});

test('every sourceId resolves to a medical source with a link', () => {
  for (const [key, e] of allEntries()) {
    const source = (medicalSources as Record<string, { url: string | null }>)[e.sourceId];
    assert.ok(source, `${key} cites unknown source ${e.sourceId}`);
    assert.match(String(source.url), /^https:\/\//);
  }
});

test('copy rules: plain words, no diagnoses or study claims, the doctor phrase last', () => {
  const FORBIDDEN_KA = [/ინსაით/, /პატერნ/, /დიაგნოზ/, /კვლევები ადასტურებ/, /ენდომეტრიოზ/, /პოლიკისტოზ/, /ანემი/, /ინფექცი/, /დეპრესი/, /კიბო/, /\bmg\b|მგ\b/];
  const FORBIDDEN_EN = [/insight/i, /pattern/i, /diagnos/i, /studies (show|confirm)/i, /endometriosis/i, /PCOS/, /anaemia|anemia/i, /infection/i, /depression/i, /cancer/i, /\d+\s?mg\b/i, /PMDD/];
  for (const [key, e] of allEntries()) {
    const kaText = `${e.ka.what} ${e.ka.typical} ${e.ka.whenDoctor}`;
    const enText = `${e.en.what} ${e.en.typical} ${e.en.whenDoctor}`;
    for (const re of FORBIDDEN_KA) assert.doesNotMatch(kaText, re, `${key} ka: ${re}`);
    for (const re of FORBIDDEN_EN) assert.doesNotMatch(enText, re, `${key} en: ${re}`);
    assert.ok(e.ka.whenDoctor.endsWith(DOCTOR_PHRASE_KA), `${key} ka whenDoctor must end with „${DOCTOR_PHRASE_KA}“`);
    assert.ok(e.en.whenDoctor.endsWith(DOCTOR_PHRASE_EN), `${key} en whenDoctor must end with "${DOCTOR_PHRASE_EN}"`);
    assert.doesNotMatch(kaText, /reviewed|byline|მიმოიხილა/i);
  }
});

test('the flow row is „სისხლდენა“ and mucus is „ლორწო“ — never „გამონადენი“', () => {
  const rows: LearnMoreEntry[] = [...Object.values(LEARN_MORE.flow), ...Object.values(LEARN_MORE.mucus), LEARN_MORE_GROUPS.flow];
  for (const e of rows) {
    assert.doesNotMatch(`${e.ka.what} ${e.ka.typical} ${e.ka.whenDoctor}`, /გამონადენ/);
  }
  // The discharge symptom keeps its own word.
  assert.match(LEARN_MORE.symptom.discharge.ka.what, /^გამონადენი/);
});

test('pain places logged as old symptom ids read the pain entry', () => {
  assert.equal(learnMoreFor('symptom', 'back_pain'), LEARN_MORE.pain.lower_back);
  assert.equal(learnMoreFor('symptom', 'cramps'), LEARN_MORE.pain.cramps);
});

test('every public fact tile of the day sheet has an entry', () => {
  const log: CycleLog = {
    id: 'l1',
    userId: 'u1',
    date: '2026-10-01',
    flow: 'heavy',
    symptoms: ['bloating', 'acne', 'fatigue', 'discharge', 'vaginal_dryness', 'pain_sex'],
    moods: ['calm', 'irritable', 'lonely'],
    sexualActivity: true,
    libido: 2,
    bbt: 36.7,
    cervicalMucus: 'eggwhite',
    ovulationTest: 'positive',
    pregnancyTest: 'negative',
    notes: 'x',
    painEntries: [{ type: 'cramps', severity: 'severe' }, { type: 'ovulation_side', severity: 'mild' }],
    sleepQuality: 'okay',
    stressLevel: 'high',
    exerciseLevel: 'light',
    caffeine: 'low',
    alcohol: 'none',
    customTagIds: [],
    observations: { energy: 'low' },
  };
  const tiles = dayFactSections(log, { showFertility: true }).flatMap((s) => s.tiles);
  assert.ok(tiles.length >= 15);
  for (const tile of tiles) {
    assert.ok(learnMoreFor(tile.kind as LearnMoreKind, tile.id), `day tile ${tile.kind}:${tile.id} has no entry`);
    assert.ok(!LEARN_MORE_PRIVATE_IDS.has(tile.id) && !SEX_IDS.has(tile.id));
  }
});
