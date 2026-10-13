// MEDIHOROSCOPE library writer: sign profiles, natal placements, transits, compatibility, tarot, numbers,
// Chinese zodiac and dream symbols. Same three passes as the readings (Georgian author → Georgian editor →
// English author); entries are written in small batches and never overwrite an admin edit.
import { SIGN_INFO, PLANET_NAMES, HOUSE_THEMES, MOON_PHASE_NAMES, ELEMENT_NAMES, CHINESE_NAMES, ASPECT_NAMES } from './signs.js';
import { TAROT, DREAMS, compatScore, compatRelation, chineseBestMatches, chineseRelation, yearAnimal, libraryKeys } from './catalog.js';
import { EDITOR_KA } from './writer.js';
import { askJson } from './llm.js';
import { existingLibraryKeys, saveLibraryEntry } from './store.js';
import { brokenRule } from './contentRules.js';

const ka = (k) => PLANET_NAMES[k]?.ka || SIGN_INFO[k]?.ka || k;
const en = (k) => PLANET_NAMES[k]?.en || SIGN_INFO[k]?.en || k;

/** Namespace → what to write (subject per key, Georgian/English shape, batch size). */
const SPECS = {
  sign: {
    batch: 3,
    subject: (k) => { const s = k.split(':')[1]; const i = SIGN_INFO[s]; return `ნიშანი ${i.ka} (${i.en}), ${i.from}–${i.to}, სტიქია ${ELEMENT_NAMES[i.element].ka}, მმართველი ${ka(i.ruler)}`; },
    ka: '{"title":"ნიშნის მოკლე, ლამაზი ეპითეტი, 2–4 სიტყვა","text":"ხასიათი, 5–6 წინადადება","strengths":["3–5 მოკლე თვისება"],"challenges":["3–4 მოკლე თვისება"],"love":"2–3 წინადადება","work":"2–3 წინადადება"}',
    en: '{"title":"2–4 word epithet","text":"personality, 5–6 sentences","strengths":["3–5 short traits"],"challenges":["3–4 short traits"],"love":"2–3 sentences","work":"2–3 sentences"}',
  },
  compat: {
    batch: 6,
    subject: (k) => { const [, a, b] = k.split(':'); return `თავსებადობა: ${SIGN_INFO[a].ka} + ${SIGN_INFO[b].ka} (${compatRelation(a, b)}; ქულა ${compatScore(a, b)}/100 — ტექსტი ამ ქულას უნდა შეესაბამებოდეს)`; },
    ka: '{"headline":"მაქს. 6 სიტყვა","text":"3–4 წინადადება წყვილზე","love":1-5,"friendship":1-5,"work":1-5,"loveText":"1–2 წინადადება","friendText":"1–2 წინადადება","workText":"1–2 წინადადება"}',
    en: '{"headline":"≤ 6 words","text":"3–4 sentences","loveText":"1–2 sentences","friendText":"1–2 sentences","workText":"1–2 sentences"}',
  },
  tarot: {
    batch: 6,
    subject: (k) => { const t = TAROT.find((x) => x.id === k.split(':')[1]); return `ტაროს დიდი არკანი ${t.n} — „${t.ka}“ (${t.en})`; },
    ka: '{"keywords":["3 სიტყვა"],"text":"დღის კარტად ამოსვლისას რას ნიშნავს — 3 წინადადება, იდუმალი, მაგრამ გასაგები","advice":"1 მოკლე რჩევა"}',
    en: '{"keywords":["3 words"],"text":"what it means as the card of the day, 3 sentences","advice":"1 short piece of advice"}',
  },
  number: {
    batch: 4,
    subject: (k) => `ნუმეროლოგია: ცხოვრების გზის რიცხვი ${k.split(':')[1]}`,
    ka: '{"title":"რიცხვის სახელი, 1–3 სიტყვა (მაგ. „ლიდერი“)","text":"4–5 წინადადება","strengths":["3–4 თვისება"],"love":"2 წინადადება","work":"2 წინადადება"}',
    en: '{"title":"1–3 words","text":"4–5 sentences","strengths":["3–4 traits"],"love":"2 sentences","work":"2 sentences"}',
  },
  pday: {
    batch: 9,
    subject: (k) => `ნუმეროლოგია: პირადი დღის რიცხვი ${k.split(':')[1]} — როგორი დღეა`,
    ka: '{"title":"1–3 სიტყვა","text":"2 წინადადება"}',
    en: '{"title":"1–3 words","text":"2 sentences"}',
  },
  pyear: {
    batch: 9,
    subject: (k) => `ნუმეროლოგია: პირადი წლის რიცხვი ${k.split(':')[1]} — როგორი წელია`,
    ka: '{"title":"1–3 სიტყვა","text":"3 წინადადება"}',
    en: '{"title":"1–3 words","text":"3 sentences"}',
  },
  moon_phase: {
    batch: 8,
    subject: (k) => `მთვარის ფაზა: ${MOON_PHASE_NAMES[k.split(':')[1]].ka} — რისთვის არის კარგი ეს დრო`,
    ka: '{"text":"2 წინადადება"}',
    en: '{"text":"2 sentences"}',
  },
  retro: {
    batch: 8,
    subject: (k) => `რეტროგრადული (უკუსვლაში მყოფი) ${ka(k.split(':')[1])} — რას ნიშნავს ადამიანისთვის ეს პერიოდი`,
    ka: '{"text":"2–3 წინადადება"}',
    en: '{"text":"2–3 sentences"}',
  },
  aspect_kind: {
    batch: 5,
    subject: (k) => `ასპექტი „${ASPECT_NAMES[k.split(':')[1]].ka}“ — რას ნიშნავს ზოგადად`,
    ka: '{"text":"2 წინადადება"}',
    en: '{"text":"2 sentences"}',
  },
  planet: {
    batch: 6,
    subject: (k) => `ნატალურ რუკაში: ${ka(k.split(':')[1])} — რას განასახიერებს`,
    ka: '{"text":"2 წინადადება"}',
    en: '{"text":"2 sentences"}',
  },
  house: {
    batch: 6,
    subject: (k) => `ნატალური რუკის მე-${k.split(':')[1]} სახლი (${HOUSE_THEMES[k.split(':')[1]].ka})`,
    ka: '{"title":"2–4 სიტყვა","text":"2 წინადადება"}',
    en: '{"title":"2–4 words","text":"2 sentences"}',
  },
  element: {
    batch: 4,
    subject: (k) => `სტიქია: ${ELEMENT_NAMES[k.split(':')[1]].ka} — როცა რუკაში ჭარბობს`,
    ka: '{"text":"2 წინადადება"}',
    en: '{"text":"2 sentences"}',
  },
  chinese: {
    batch: 4,
    subject: (k) => { const a = k.split(':')[1]; return `ჩინური ჰოროსკოპი: ${CHINESE_NAMES[a].ka} (${CHINESE_NAMES[a].en}); საუკეთესო წყვილები: ${chineseBestMatches(a).map((x) => CHINESE_NAMES[x].ka).join(', ')}`; },
    ka: '{"title":"2–4 სიტყვა","text":"ხასიათი, 4–5 წინადადება","strengths":["3–4 თვისება"],"love":"2 წინადადება","work":"2 წინადადება"}',
    en: '{"title":"2–4 words","text":"4–5 sentences","strengths":["3–4 traits"],"love":"2 sentences","work":"2 sentences"}',
  },
  chinese_year: {
    batch: 4,
    subject: (k) => {
      const [, y, a] = k.split(':');
      const ya = yearAnimal(Number(y));
      const rel = { same: 'შენი წელია (ბენ მინ ნიენ)', trine: 'ჰარმონიული წელი', harmony: 'მეგობრული წელი', clash: 'დაპირისპირების წელი — ფრთხილი, მაგრამ შიშის გარეშე', neutral: 'ნეიტრალური წელი' }[chineseRelation(a, ya)];
      return `${y} წელი (წლის ცხოველი: ${CHINESE_NAMES[ya].ka}) ნიშნისთვის ${CHINESE_NAMES[a].ka}: ${rel}`;
    },
    ka: '{"headline":"მაქს. 6 სიტყვა","text":"4–5 წინადადება","love":"2 წინადადება","work":"2 წინადადება"}',
    en: '{"headline":"≤ 6 words","text":"4–5 sentences","love":"2 sentences","work":"2 sentences"}',
  },
  asc: {
    batch: 6,
    subject: (k) => `ასცენდენტი (აღმავალი ნიშანი) ${SIGN_INFO[k.split(':')[1]].ka}`,
    ka: '{"text":"3 წინადადება: პირველი შთაბეჭდილება, სტილი, როგორ ხვდება სამყაროს"}',
    en: '{"text":"3 sentences"}',
  },
  planet_sign: {
    batch: 8,
    subject: (k) => { const [, p, s] = k.split(':'); return `ნატალურ რუკაში ${ka(p)} — ნიშანში ${SIGN_INFO[s].ka}`; },
    ka: '{"text":"2–3 წინადადება"}',
    en: '{"text":"2–3 sentences"}',
  },
  planet_house: {
    batch: 8,
    subject: (k) => { const [, p, h] = k.split(':'); return `ნატალურ რუკაში ${ka(p)} — მე-${h} სახლში (${HOUSE_THEMES[h].ka})`; },
    ka: '{"text":"2 წინადადება"}',
    en: '{"text":"2 sentences"}',
  },
  transit: {
    batch: 10,
    subject: (k) => { const [, t, a, n] = k.split(':'); return `ტრანზიტი: ცაზე მოძრავი ${ka(t)} — ${ASPECT_NAMES[a].ka} — შენს ნატალურ ${ka(n)}სთან (რას მოაქვს ეს დღეები)`; },
    ka: '{"title":"მაქს. 5 სიტყვა","text":"2 წინადადება"}',
    en: '{"title":"≤ 5 words","text":"2 sentences"}',
  },
  aspect: {
    batch: 10,
    subject: (k) => { const [, a, asp, b] = k.split(':'); return `ნატალური ასპექტი: ${ka(a)} — ${ASPECT_NAMES[asp].ka} — ${ka(b)}`; },
    ka: '{"text":"2 წინადადება"}',
    en: '{"text":"2 sentences"}',
  },
  dream: {
    batch: 8,
    subject: (k) => { const d = DREAMS.find((x) => x.id === k.split(':')[1]); return `სიზმარში: ${d.ka} (${d.en})`; },
    ka: `{"word":"სიმბოლოს სახელი, როგორც სიაშია","text":"3 წინადადება — ხალხური და თანამედროვე ახსნა, თბილად","variants":["2–3 ვარიანტი: „თუ …“ და მოკლე ახსნა"]}`,
    en: '{"word":"symbol name","text":"3 sentences","variants":["2–3 short \\"if …\\" variants"]}',
  },
};

export const LIBRARY_NAMESPACES = Object.keys(SPECS);
export const namespaceOf = (key) => key.split(':')[0];

const LIB_WRITER_KA = `შენ ხარ MEDIHOROSCOPE-ის ასტროლოგი და ავტორი — უფასო ქართული აპის ნაწილი. წერ ცნობარის მოკლე სტატიებს პირდაპირ ქართულად, როგორც კარგი ქართველი ავტორი: ბუნებრივი ქართული, ცოცხალი და თბილი ენა, მიმართვა „შენ“-ით, სქესის გარეშე. ეს არ არის თარგმანი.
არასოდეს: ჯანმრთელობა და მედიცინა (დაავადება, სიმპტომი, სხეული, დიეტა, წამალი, ორსულობა, ექიმი), ფინანსური რჩევა (ინვესტიცია, კრიპტო, აზარტი, სესხი), შიში და ბედისწერა (წყევლა, საფრთხე, უბედური შემთხვევა, სიკვდილი), პოლიტიკა, რელიგია, რეალური ადამიანები. შტამპები აკრძალულია („ვარსკვლავები გეუბნებიან“, „სამყარო გიგზავნის“). ემოჯი არა.
პასუხი — მხოლოდ JSON ობიექტი: {"items":[{"key":"…", …ველები…}]} — ყველა მოცემული გასაღებისთვის, იმავე რიგით.`;

const LIB_WRITER_EN = `You are the astrologer of MEDIHOROSCOPE (a free Georgian app). Write short reference entries in natural, warm English, addressing the reader as "you", gender-neutral.
Never: health or medicine, money advice, fear or fate (curses, danger, accidents, death), politics, religion, real people, clichés, emojis.
Return ONLY JSON: {"items":[{"key":"…", …fields…}]} — one item per given key, same order.`;


function cleanItem(spec, item, lang) {
  const out = {};
  for (const [k, v] of Object.entries(item || {})) {
    if (k === 'key') continue;
    if (typeof v === 'string') out[k] = v.trim();
    else if (Array.isArray(v)) out[k] = v.map((x) => String(x).trim()).filter(Boolean).slice(0, 6);
    else if (typeof v === 'number') out[k] = Math.max(1, Math.min(5, Math.round(v)));
  }
  const text = JSON.stringify(out);
  if (!out.text && !out.title) throw new Error('entry has no text');
  if (brokenRule(text)) throw new Error(`entry broke a content rule („${brokenRule(text)}“)`);
  if (lang === 'ka' && /[A-Za-z]{4,}/.test(text.replace(/"[a-zA-Z]+":/g, '').replace(/MEDI[A-Z]+/g, ''))) throw new Error('Georgian entry has Latin words');
  return out;
}

function mapItems(data, keys) {
  const items = Array.isArray(data?.items) ? data.items : [];
  const byKey = new Map(items.map((it) => [String(it?.key || ''), it]));
  return keys.map((k, i) => byKey.get(k) || items[i] || null);
}

/** Writes one batch of keys from the same namespace. Returns { ok, failed, cost }. */
export async function writeLibraryBatch(keys, { models = {}, db } = {}) {
  const spec = SPECS[namespaceOf(keys[0])];
  const subjects = keys.map((k) => `- key: ${k} — ${spec.subject(k)}`).join('\n');
  let cost = 0;
  const track = (res) => { cost += Number(res.usage?.cost) || 0; return res.data; };
  const tokens = 1800 + keys.length * 900;

  const draft = track(await askJson({
    system: LIB_WRITER_KA,
    user: `დაწერე ცნობარის სტატიები ამ გასაღებებისთვის:\n${subjects}\n\nთითო item-ის ფორმა: {"key":"…", ${spec.ka.slice(1)}`,
    model: models.writer, maxTokens: tokens, temperature: 0.8,
  }));
  let kaItems = mapItems(draft, keys);
  if (models.editor !== 'none') {
    try {
      const edited = track(await askJson({
        system: EDITOR_KA,
        user: JSON.stringify({ items: kaItems.map((it, i) => ({ ...(it || {}), key: keys[i] })) }, null, 1),
        model: models.editor, maxTokens: tokens, temperature: 0.2,
      }));
      const mapped = mapItems(edited, keys);
      kaItems = kaItems.map((it, i) => mapped[i] || it);
    } catch { /* keep the draft */ }
  }
  const enData = track(await askJson({
    system: LIB_WRITER_EN,
    user: `Write reference entries for these keys:\n${keys.map((k) => `- key: ${k} — ${spec.subject(k)}`).join('\n')}\n\nEach item: {"key":"…", ${spec.en.slice(1)}`,
    model: models.english || models.writer, maxTokens: tokens, temperature: 0.7,
  }));
  const enItems = mapItems(enData, keys);

  let ok = 0;
  let failed = 0;
  for (let i = 0; i < keys.length; i++) {
    try {
      const kaData = cleanItem(spec, kaItems[i], 'ka');
      const enEntry = cleanItem(spec, enItems[i], 'en');
      for (const n of ['love', 'friendship', 'work']) if (typeof kaData[n] === 'number') enEntry[n] = kaData[n];
      await saveLibraryEntry({ key: keys[i], lang: 'ka', data: kaData, model: models.writer }, db);
      await saveLibraryEntry({ key: keys[i], lang: 'en', data: enEntry, model: models.english || models.writer }, db);
      ok += 1;
    } catch {
      failed += 1;
    }
  }
  return { ok, failed, cost };
}

/** Keys still missing in either language, in fill order. */
export async function missingLibraryKeys({ year, only } = {}, db) {
  const all = libraryKeys({ year }).filter((k) => !only || only.includes(namespaceOf(k)));
  const have = await existingLibraryKeys(all, db);
  return all.filter((k) => !have.has(k));
}

/** Groups keys into same-namespace batches of the namespace's size. */
export function batchKeys(keys) {
  const batches = [];
  let cur = [];
  for (const k of keys) {
    if (cur.length && (namespaceOf(cur[0]) !== namespaceOf(k) || cur.length >= SPECS[namespaceOf(k)].batch)) {
      batches.push(cur);
      cur = [];
    }
    cur.push(k);
  }
  if (cur.length) batches.push(cur);
  return batches;
}

/** Fills up to `maxBatches` batches of missing entries (priority keys first). */
export async function fillLibrary({ models, maxBatches = 6, priority = [], year, db } = {}) {
  const missing = await missingLibraryKeys({ year }, db);
  const set = new Set(missing);
  const ordered = [...priority.filter((k) => set.has(k)), ...missing.filter((k) => !priority.includes(k))];
  const batches = batchKeys(ordered).slice(0, maxBatches);
  const total = { ok: 0, failed: 0, cost: 0, remaining: missing.length };
  for (const batch of batches) {
    try {
      const r = await writeLibraryBatch(batch, { models, db });
      total.ok += r.ok;
      total.failed += r.failed;
      total.cost += r.cost;
    } catch {
      total.failed += batch.length;
    }
  }
  total.remaining = Math.max(0, missing.length - total.ok);
  return total;
}

