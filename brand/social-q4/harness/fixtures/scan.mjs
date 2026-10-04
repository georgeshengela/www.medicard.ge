// MEDISCAN (/scan) and MEDILAB AI endpoints: reading a lab sheet, explaining it, imaging/skin reviews.
//
// The MEDISCAN thread lives only in the screen's memory (mobile/src/components/scan/ScanChat.tsx); nothing
// reloads a finished thread from the server, so a result screenshot is produced by uploading a file:
//   „PDF ფაილი“ (or „გალერეიდან“) → „წაკითხვა“  → POST /api/ai/extract-lab   (multipart `files`)
//   „ამიხსენი შედეგები“                          → POST /api/ai/explain-lab   (JSON)
//   a typed question after the result            → POST /api/ai/query DOCTOR  (medi.mjs, SSE)
// Imaging / skin photos                          → POST /api/ai/analyze-image (multipart `file` + `kind`)
//
// Shapes: server/src/routes/ai.routes.js (extract-lab 201, explain-lab, align-lab, analyze-image 201).
// The uploaded bytes are ignored (mock-api.mjs does not parse multipart), so the sheet that comes back is
// always the persona's latest sheet from lab.mjs (same date and values → saving it merges into that date,
// MEDILAB history stays three sheets). `POST /__scan/config?date=today` makes it a new sheet dated today;
// `?kind=SKIN|IMAGING` picks what analyze-image answers (multipart `kind` is not readable here);
// `?delayMs=` sets the "reading…" pause (default 900 ms).

import { curatedAnalysis, latestPanel } from './lab.mjs';
import { sleep, t, unauthorized, usageFor, userIdOf, uuidFrom } from './_mockkit.mjs';

const MODEL = 'google/gemini-3.8-flash';

function scanState(state) {
  state.scan = state.scan ?? { date: 'latest', imageKind: 'SKIN', delayMs: 900, reads: 0 };
  return state.scan;
}

export function init(state) {
  state.scan = { date: 'latest', imageKind: 'SKIN', delayMs: 900, reads: 0 };
}

/** The OCR/vision notes the server keeps as the record text: a pipe table the app's parser reads back. */
function notesFor(date, parameters) {
  const rows = parameters.map((p) => {
    const range = p.refLow != null && p.refHigh != null ? `${p.refLow}-${p.refHigh}` : p.refHigh != null ? `<${p.refHigh}` : p.refLow != null ? `>${p.refLow}` : '';
    return `| ${p.nameEn} (${p.nameKa}) | ${p.display} | ${p.unit} | ${range} | ${p.flag} |`;
  });
  return [
    `თარიღი: ${date}`,
    'სისხლის საერთო და ბიოქიმიური ანალიზი',
    '',
    '| ანალიზი | შედეგი | ერთეული | ნორმა | ნიშანი |',
    '|---|---|---|---|---|',
    ...rows,
  ].join('\n');
}

const fmtRange = (p) => (p.refLow != null && p.refHigh != null ? `${p.refLow}–${p.refHigh}` : p.refHigh != null ? `≤ ${p.refHigh}` : p.refLow != null ? `≥ ${p.refLow}` : '');

/** A calm explanation built from whatever values were sent (sheets the fixtures do not know). */
function generatedAnalysis(rq, parameters) {
  const off = parameters.filter((p) => p.flag === 'H' || p.flag === 'L');
  const ok = parameters.filter((p) => p.flag === 'N');
  const name = (p) => (rq.lang === 'en' ? p.nameEn || p.nameKa : p.nameKa || p.nameEn);
  if (rq.lang === 'en') {
    const lines = [
      off.length
        ? `Most of your ${parameters.length} values are within the printed range; ${off.length} ${off.length === 1 ? 'is' : 'are'} slightly outside it.`
        : `All ${parameters.length} values are within the printed reference ranges.`,
    ];
    if (off.length) {
      lines.push('', '## What to keep an eye on');
      for (const p of off) lines.push(`- **${name(p)} — ${p.display} ${p.unit}** (range ${fmtRange(p)}) is ${p.flag === 'H' ? 'slightly high' : 'slightly low'}.`);
    }
    if (ok.length) lines.push('', '## What looks good', `- ${ok.slice(0, 6).map(name).join(', ')} are within range.`);
    lines.push('', '## Questions for your doctor', '- When should I repeat these tests?', '- Is there anything I should change in my diet or activity?', '', 'This is not a diagnosis — go over the results with your doctor.');
    return lines.join('\n');
  }
  const lines = [
    off.length
      ? `${parameters.length} მაჩვენებლიდან უმეტესობა ნორმაშია, ${off.length} კი ფურცელზე დაბეჭდილ ნორმას ოდნავ სცდება.`
      : `ყველა ${parameters.length} მაჩვენებელი ფურცელზე დაბეჭდილ ნორმაშია.`,
  ];
  if (off.length) {
    lines.push('', '## რას მიაქციო ყურადღება');
    for (const p of off) lines.push(`- **${name(p)} — ${p.display} ${p.unit}** (ნორმა ${fmtRange(p)}) ${p.flag === 'H' ? 'ოდნავ მაღალია' : 'ოდნავ დაბალია'}.`);
  }
  if (ok.length) lines.push('', '## რა არის კარგად', `- ${ok.slice(0, 6).map(name).join(', ')} ნორმაშია.`);
  lines.push('', '## რა ჰკითხო ექიმს', '- როდის გავიმეორო ეს ანალიზები?', '- კვებასა თუ მოძრაობაში რამე უნდა შევცვალო?', '', 'ეს დიაგნოზი არ არის — შედეგები შენს ექიმთან განიხილე.');
  return lines.join('\n');
}

const IMAGE_REVIEW = {
  SKIN: {
    ka: `ფოტოზე ჩანს მცირე ზომის, მომრგვალო ხალი ერთგვაროვანი ყავისფერი ფერით და მკაფიო, თანაბარი კიდეებით. ასიმეტრია, ფერის რამდენიმე ელფერი ან ანთების ნიშნები არ ჩანს.

## რას დააკვირდე
- ზომის, ფორმის ან ფერის ცვლილებას
- ქავილს, სისხლდენას ან ქერქის გაჩენას

## შემდეგი ნაბიჯი
- 3 თვეში იმავე სინათლეზე და მანძილიდან გადაიღე და შეადარე.
- წელიწადში ერთხელ კანის შემოწმება დერმატოლოგთან.

ეს დიაგნოზი არ არის — ცვლილებას თუ შეამჩნევ, დერმატოლოგს მიმართე.`,
    en: `The photo shows a small, round mole with an even brown colour and clear, regular borders. There is no asymmetry, mixed colour or sign of inflammation.

## What to watch
- Any change in size, shape or colour
- Itching, bleeding or crusting

## Next step
- Take a photo in the same light and distance in 3 months and compare.
- A yearly skin check with a dermatologist.

This is not a diagnosis — if you notice a change, see a dermatologist.`,
  },
  IMAGING: {
    ka: `გამოსახულებაზე მკაფიოდ ჩანს მუხლის სახსრის ძვლოვანი სტრუქტურები. ძვლის მთლიანობის დარღვევა არ ჩანს, სახსრის ხვრელი ორივე მხარეს თანაბარია.

## რას ნიშნავს
- მოტეხილობის ან ამოვარდნილობის ნიშნები არ ჩანს.
- რბილი ქსოვილები (მყესები, მენისკი) რენტგენზე კარგად არ ჩანს — ტკივილი თუ გრძელდება, ექიმმა შეიძლება ექოსკოპია ან MRI გირჩიოს.

## რა ჰკითხო ექიმს
- ტკივილის მიზეზი რბილი ქსოვილი ხომ არ არის?
- რამდენ ხანს შევიკავო სირბილისგან?

ეს დიაგნოზი არ არის — საბოლოო დასკვნას რადიოლოგი და შენი ექიმი გააკეთებენ.`,
    en: `The image clearly shows the bony structures of the knee joint. There is no break in the bones and the joint space looks even on both sides.

## What it means
- No sign of a fracture or dislocation.
- Soft tissues (tendons, meniscus) do not show well on X-ray — if the pain continues, your doctor may suggest an ultrasound or MRI.

## Questions for your doctor
- Could the pain come from soft tissue?
- How long should I hold off running?

This is not a diagnosis — the radiologist and your doctor make the final call.`,
  },
};

function recordOut(r) {
  return { id: r.id, type: r.type, imageUrl: r.imageUrl, aiAnalysis: r.aiAnalysis, createdAt: r.createdAt };
}

const RAW_ROUTES = [
  // QA control (not an app route).
  {
    method: 'ANY',
    path: '/__scan/config',
    handler: (rq) => {
      const s = scanState(rq.state);
      if (rq.query.date === 'today' || rq.query.date === 'latest') s.date = rq.query.date;
      if (['SKIN', 'IMAGING'].includes(String(rq.query.kind || '').toUpperCase())) s.imageKind = String(rq.query.kind).toUpperCase();
      if (rq.query.delayMs != null && Number.isFinite(Number(rq.query.delayMs))) s.delayMs = Math.max(0, Math.min(20000, Number(rq.query.delayMs)));
      return { ok: true, scan: s };
    },
  },
  {
    method: 'POST',
    path: '/api/ai/extract-lab',
    handler: async (rq) => {
      const s = scanState(rq.state);
      const latest = latestPanel(rq.state);
      if (!latest) return rq.reply(422, { error: t(rq, 'ანალიზის მაჩვენებლები ვერ წავიკითხეთ.', 'We could not read the lab values.') });
      await sleep(s.delayMs);
      const date = s.date === 'today' ? rq.today : latest.date;
      const parameters = latest.parameters.map((p) => ({ ...p }));
      const notes = notesFor(date, parameters);
      const append = ['1', 'true', 'yes'].includes(String(rq.body?.append ?? '').toLowerCase());
      s.reads += 1;
      const records = rq.state.records ?? (rq.state.records = []);
      const record = {
        id: uuidFrom(`scan-lab:${rq.state.resetAt}:${s.reads}`),
        userId: userIdOf(rq.state),
        type: 'LAB',
        imageUrl: null,
        aiAnalysis: notes,
        createdAt: new Date().toISOString(),
      };
      if (!append) records.push(record);
      return rq.reply(append ? 200 : 201, {
        record: recordOut(record),
        notes,
        labExtract: { date, parameters },
        interactionId: null,
        pipeline: { extractor: { provider: 'openrouter', model: MODEL }, reasoning: null },
        usage: usageFor(rq.today),
      });
    },
  },
  {
    method: 'POST',
    path: '/api/ai/explain-lab',
    handler: async (rq) => {
      const body = rq.body && typeof rq.body === 'object' ? rq.body : {};
      const parameters = (Array.isArray(body.parameters) ? body.parameters : []).filter((p) => p && (p.nameKa || p.nameEn) && p.display);
      if (!parameters.length) {
        return rq.reply(400, { error: t(rq, 'შევსებული მონაცემები არასწორია.', 'Some of the details you entered are not valid.'), fields: [{ field: 'parameters', message: 'Too small' }] });
      }
      await sleep(Math.min(scanState(rq.state).delayMs + 600, 4000));
      const date = typeof body.date === 'string' ? body.date.slice(0, 10) : null;
      const analysis = (rq.lang !== 'en' && date && curatedAnalysis(rq.state, date)) || generatedAnalysis(rq, parameters);
      if (body.recordId) {
        const record = (rq.state.records ?? []).find((r) => r.id === body.recordId);
        if (record) record.aiAnalysis = analysis;
      }
      return { analysis, interactionId: uuidFrom(`explain:${date}:${Date.now()}`), usage: usageFor(rq.today) };
    },
  },
  {
    // „სახელების გაერთიანება“ on /lab: every key is already canonical, so nothing to join.
    method: 'POST',
    path: '/api/ai/align-lab',
    handler: async (rq) => {
      const analytes = Array.isArray(rq.body?.analytes) ? rq.body.analytes : [];
      await sleep(800);
      return { maps: [], joined: 0, already: analytes.length, leftover: [], model: MODEL, engine: 'openrouter', usage: usageFor(rq.today) };
    },
  },
  {
    method: 'POST',
    path: '/api/ai/analyze-image',
    handler: async (rq) => {
      const s = scanState(rq.state);
      await sleep(s.delayMs + 400);
      const kind = s.imageKind === 'IMAGING' ? 'IMAGING' : 'SKIN';
      const analysis = IMAGE_REVIEW[kind][rq.lang === 'en' ? 'en' : 'ka'];
      s.reads += 1;
      const record = {
        id: uuidFrom(`scan-image:${rq.state.resetAt}:${s.reads}`),
        userId: userIdOf(rq.state),
        type: kind === 'IMAGING' ? 'CT_MRI' : 'SKIN',
        imageUrl: null,
        aiAnalysis: analysis,
        createdAt: new Date().toISOString(),
      };
      (rq.state.records ?? (rq.state.records = [])).push(record);
      return rq.reply(201, {
        record: recordOut(record),
        analysis,
        interactionId: uuidFrom(`image:${record.id}`),
        pipeline: { extractor: { provider: 'openrouter', model: MODEL }, reasoning: { provider: 'openrouter', model: MODEL } },
        usage: usageFor(rq.today),
      });
    },
  },
];

export const routes = RAW_ROUTES.map((route) =>
  String(route.path).startsWith('/api/') ? { ...route, handler: (rq) => unauthorized(rq) ?? route.handler(rq) } : route,
);

export { notesFor, generatedAnalysis };
