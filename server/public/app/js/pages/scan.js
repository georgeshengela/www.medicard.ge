// MEDICARD web — MEDISCAN (/scan): lab results, imaging (X-ray, ultrasound, MRI, CT) and skin photos read in
// ONE chat, mirrors mobile/src/components/scan/ScanChat.tsx + lib/scanThread.ts (owner 2026-10-03).
// Endpoints: /api/ai/extract-lab (+ /api/ai/explain-lab on „ამიხსენი შედეგები“), /api/ai/analyze-image.
// A question typed after a result goes to /api/ai/query DOCTOR with only that result's values / review as
// `context` (never the photo). Each choice follows its own admin switch (labs, imaging, skin).
// Nothing is sent before the person presses „წაკითხვა“ / send, and every AI call goes through withAiConsent.
import {
  h, mount, clear, icon, button, markdown, ymd, textarea,
} from '../ui.js';
import { put, request, stream, invalidate, ApiError } from '../api.js';
import { withAiConsent } from '../aiConsent.js';
import { featureOn } from '../session.js';
import { t, isEn } from '../i18n.js';
import { wordmark } from '../brand.js';
import { dropzone, checkFile, explainPanel, flagBadge, nameOf, isOff, labDate } from './lab.js';
import { IMAGING_REGIONS } from './records.js';

const CSS = ['/app/css/lab.css', '/app/css/scan.css'];
function ensureCss() {
  for (const href of CSS) if (!document.querySelector(`link[href="${href}"]`)) document.head.append(h('link', { rel: 'stylesheet', href }));
}

const KINDS = ['LAB', 'IMAGING', 'SKIN'];
const FEATURE = { LAB: 'labs', IMAGING: 'imaging', SKIN: 'skin' };
const MAX_FILES = 8;
const CONTEXT_LIMIT = 3800;
const DISCLAIMER = t('ეს არ არის დიაგნოზი — საჭიროებისას ექიმს მიმართე.', 'This is not a diagnosis — see a doctor when needed.');
const INFO = {
  LAB: {
    icon: 'flask', label: t('ანალიზი', 'Lab test'), hint: t('ანალიზის ფურცელი ან PDF — რამდენიმე გვერდიც', 'A lab sheet or PDF — several pages too'),
    note: t('მაგ. ასაკი, ჩივილები, მიმდინარე მკურნალობა', 'e.g. age, symptoms, current treatment'), accept: 'image/jpeg,image/png,image/webp,application/pdf',
  },
  IMAGING: {
    icon: 'scanLine', label: t('გამოსახულება', 'Imaging'), hint: t('რენტგენი, ექო, MRI ან CT — სურათი ან ეკრანი', 'X-ray, ultrasound, MRI or CT — a photo or the screen'),
    note: t('მაგ. ტკივილი მარცხენა ბარძაყში, ოპერაციის შემდეგ', 'e.g. pain in the left thigh, after surgery'), accept: 'image/jpeg,image/png,image/webp',
  },
  SKIN: {
    icon: 'scanFace', label: t('კანი', 'Skin'), hint: t('ხალი, ლაქა ან გამონაყარი — დღის სინათლეზე', 'A mole, spot or rash — in daylight'),
    note: t('მაგ. ხალი ორი თვეა გამუქდა და ოდნავ გაიზარდა', 'e.g. a mole got darker over two months and grew slightly'), accept: 'image/jpeg,image/png,image/webp',
  },
};
const kindFromParam = (raw) => {
  const v = String(raw || '').trim().toLowerCase();
  return v === 'lab' || v === 'labs' ? 'LAB' : v === 'imaging' ? 'IMAGING' : v === 'skin' ? 'SKIN' : null;
};

/** Merge several pages' extracts (mobile mergeLabExtracts): one value per key, the latest page wins. */
function mergeExtracts(list) {
  const byKey = new Map();
  let date = null;
  for (const ex of list) {
    if (!ex) continue;
    if (!date && ex.date) date = ex.date;
    for (const p of ex.parameters || []) {
      const key = String(p.key || p.nameEn || p.nameKa || '').trim().toLowerCase();
      if (key) byKey.set(key, p);
    }
  }
  return { date, parameters: [...byKey.values()] };
}

/** The latest result as context for a follow-up question (mobile latestResultContext) — values and the review, never photos. */
function latestResultContext(turns) {
  for (let i = turns.length - 1; i >= 0; i -= 1) {
    const turn = turns[i];
    if (turn.kind === 'result') {
      const head = turn.scan === 'IMAGING' ? `Imaging review${turn.region ? ` (${turn.region})` : ''}` : 'Skin photo review';
      return `${head} from MEDISCAN, the question below is about it:\n${turn.text}`.slice(0, CONTEXT_LIMIT);
    }
    if (turn.kind === 'lab' && turn.extract.parameters.length) {
      const lines = turn.extract.parameters.map((p) => {
        const range = p.refLow != null || p.refHigh != null ? ` (norm ${p.refLow ?? ''}–${p.refHigh ?? ''})` : '';
        const flag = p.flag === 'H' ? ' [high]' : p.flag === 'L' ? ' [low]' : '';
        return `${p.nameEn || p.nameKa}: ${p.display} ${p.unit || ''}${range}${flag}`.trim();
      }).join('\n');
      const body = `Lab results${turn.date ? ` from ${turn.date}` : ''} read by MEDISCAN, the question below is about them:\n${lines}${turn.analysis ? `\n\nReview:\n${turn.analysis}` : ''}`;
      return body.slice(0, CONTEXT_LIMIT);
    }
  }
  return null;
}

export default async function scanPage(root, ctx) {
  ensureCss();
  let alive = true;
  let gen = 0;
  const kinds = KINDS.filter((k) => featureOn(FEATURE[k]));
  const st = {
    kind: (() => { const k = kindFromParam(ctx.query.type); return k && kinds.includes(k) ? k : kinds[0] || null; })(),
    files: [],
    region: null,
    turns: [],
    busy: null,
    error: null,
    declined: null, // { what: 'read' | 'explain' | 'ask', ... }
    doctorSession: null,
    controller: null,
  };

  const head = h('header', { class: 'page-head' },
    h('div', { class: 'page-head-text' }, h('h1', null, wordmark('scan')), h('p', null, t('ანალიზები, გამოსახულება და კანი — ერთ ჩატში', 'Lab tests, imaging and skin — in one chat'))),
    h('div', { class: 'page-head-actions' }, button(t('ახალი შემოწმება', 'New check'), { variant: 'ghost', icon: 'squarePen', onClick: () => reset() })));

  if (!kinds.length) {
    mount(root, head, h('div', { class: 'empty', style: { paddingTop: '60px' } },
      h('div', { class: 'empty-art' }, icon('lock', { size: 26 })), h('h3', null, t('MEDISCAN დროებით შეჩერებულია.', 'MEDISCAN is paused for now.'))));
    return () => { alive = false; };
  }

  const threadEl = h('div', { class: 'scan-thread', role: 'log', 'aria-live': 'polite' });
  const dock = h('div', { class: 'scan-dock' });
  mount(root, head, h('div', { class: 'scan' }, threadEl, dock));

  const note = textarea({ rows: 2, maxlength: 2000, class: 'input textarea scan-note' });
  const ask = h('textarea', {
    rows: 1, maxlength: 4000, class: 'scan-ask-input', 'aria-label': t('შეკითხვა შედეგზე', 'A question about the result'),
    placeholder: t('ჰკითხე შედეგზე — მაგ. „რას ნიშნავს მაღალი ფერიტინი?“', 'Ask about the result — e.g. “What does high ferritin mean?”'),
    onKeydown: (e) => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); askQuestion(); } },
  });

  const scrollEnd = () => requestAnimationFrame(() => threadEl.lastElementChild?.scrollIntoView({ block: 'end', behavior: 'smooth' }));
  const canAsk = () => latestResultContext(st.turns) !== null;

  /* ── Thread ─────────────────────────────────────────── */
  function choiceCards() {
    return h('div', { class: 'scan-choices', role: 'radiogroup', 'aria-label': t('რა წავიკითხოთ?', 'What shall we read?') }, kinds.map((k) => {
      const info = INFO[k];
      const on = st.kind === k;
      return h('button', {
        type: 'button', role: 'radio', 'aria-checked': on ? 'true' : 'false', class: `scan-choice${on ? ' on' : ''}`,
        onClick: () => choose(k),
      }, h('span', { class: 'scan-choice-ic' }, icon(info.icon, { size: 20 })),
      h('span', { class: 'scan-choice-text' }, h('b', null, info.label), h('span', null, info.hint)),
      h('span', { class: 'scan-radio' }));
    }));
  }

  function renderThread() {
    clear(threadEl);
    if (!st.turns.length) {
      threadEl.append(h('div', { class: 'scan-hero' },
        h('div', { class: `scan-lens${st.busy ? ' busy' : ''}`, 'aria-hidden': 'true' }, h('i'), icon('scanLine', { size: 30 })),
        h('h2', null, t('რა წავიკითხოთ?', 'What shall we read?')),
        h('p', null, t('აირჩიე და ატვირთე — წაგიკითხავ და აგიხსნი. მერე შეგიძლია შეკითხვაც დამისვა.', 'Choose and upload — I read it and explain. Then ask me anything about it.')),
        choiceCards()));
    }
    for (const turn of st.turns) threadEl.append(turnEl(turn));
    if (st.busy && st.turns.at(-1)?.kind !== 'answer') threadEl.append(h('div', { class: 'scan-progress' }, h('span', { class: 'lab-spinner' }), h('span', null, st.busy)));
    if (st.turns.some((x) => x.kind !== 'upload')) threadEl.append(h('p', { class: 'disclaimer' }, icon('info', { size: 14 }), DISCLAIMER));
  }

  function turnEl(turn) {
    if (turn.kind === 'upload') {
      return h('div', { class: 'scan-msg me' }, h('div', { class: 'scan-bubble' },
        h('div', { class: 'scan-upload-kind' }, icon(INFO[turn.scan].icon, { size: 14 }), INFO[turn.scan].label, turn.region ? ` · ${turn.region}` : ''),
        h('div', { class: 'scan-files' }, turn.files.map((f) => h('span', { class: 'scan-file' }, icon(f.type === 'application/pdf' ? 'file' : 'image', { size: 13 }), f.name))),
        turn.note ? h('div', { class: 'scan-upload-note' }, turn.note) : null));
    }
    if (turn.kind === 'question') return h('div', { class: 'scan-msg me' }, h('div', { class: 'scan-bubble' }, turn.text));
    if (turn.kind === 'result') {
      return h('div', { class: 'scan-msg ai' }, orb(), h('div', { class: 'scan-col' },
        h('div', { class: 'scan-result-head' }, turn.scan === 'IMAGING' ? t('გამოსახულების შეფასება', 'Imaging review') : t('კანის შეფასება', 'Skin review')),
        h('div', { class: 'scan-answer' }, markdown(turn.text)),
        turn.recordId && featureOn('records') ? h('a', { class: 'link', href: `/records/${encodeURIComponent(turn.recordId)}`, 'data-link': '', style: { fontSize: '13px' } }, t('შენახულია ჩანაწერებში — გახსნა', 'Saved to your records — open'), icon('chevronRight', { size: 14 })) : null));
    }
    if (turn.kind === 'lab') {
      const params = turn.extract.parameters;
      const off = params.filter((p) => isOff(p.flag)).length;
      const explainBtn = !turn.analysis && params.length
        ? button(t('ამიხსენი შედეგები', 'Explain my results'), { icon: 'sparkles', size: 'sm', disabled: Boolean(st.busy), onClick: () => explain(turn) })
        : null;
      return h('div', { class: 'scan-msg ai' }, orb(), h('div', { class: 'scan-col' },
        h('div', { class: 'scan-result-head' }, params.length
          ? t(`ანალიზის მაჩვენებლები · ${labDate(turn.date)} · ${params.length}`, `Lab values · ${labDate(turn.date)} · ${params.length}`)
          : t('მაჩვენებლები ვერ ამოვიკითხეთ — სცადე უფრო მკვეთრი ფოტო.', 'We couldn’t read any values — try a sharper photo.')),
        params.length ? h('div', { class: 'scan-sub' }, off ? t(`${off} მაჩვენებელი ნორმის გარეთაა`, `${off} ${off === 1 ? 'value is' : 'values are'} out of range`) : t('ყველა ამოკითხული მაჩვენებელი ნორმაშია', 'All values read are in range')) : null,
        params.length ? h('div', { class: 'lab-mini-table' }, params.slice(0, 60).map((p) => h('div', { class: 'lab-mini-row' },
          h('span', { class: 'lab-mini-name' }, nameOf(p)), h('span', { class: 'num' }, `${p.display} ${p.unit || ''}`.trim()), flagBadge(p.flag)))) : null,
        turn.analysis ? h('div', { class: 'scan-answer' }, markdown(turn.analysis)) : null,
        explainBtn ? h('div', null, explainBtn) : null,
        params.length && featureOn('labs') ? h('a', { class: 'link', href: '/lab', 'data-link': '', style: { fontSize: '13px' } }, t('შენახულია ანალიზებში — ტენდენციები', 'Saved to Labs — see trends'), icon('chevronRight', { size: 14 })) : null));
    }
    // answer
    const body = h('div', { class: 'scan-answer' });
    turn.el = body;
    paintAnswer(turn);
    return h('div', { class: 'scan-msg ai' }, orb(), h('div', { class: 'scan-col' }, body));
  }
  const orb = () => h('span', { class: 'scan-orb', 'aria-hidden': 'true' }, icon('scanLine', { size: 14 }));
  function paintAnswer(turn) {
    if (!turn.el) return;
    if (turn.streaming && !turn.text) mount(turn.el, h('div', { class: 'medi-thinking' }, h('span', { class: 'lab-spinner' }), h('span', null, t('პასუხს ვწერ…', 'Writing the answer…'))));
    else mount(turn.el, markdown(turn.text));
  }

  /* ── Composer ───────────────────────────────────────── */
  function renderDock() {
    const info = st.kind ? INFO[st.kind] : null;
    const started = st.turns.length > 0;
    note.placeholder = info?.note || '';
    const err = st.error ? h('div', { class: 'form-error' }, st.error) : null;
    const declined = st.declined && !st.error ? h('div', { class: 'medi-note scan-declined' }, icon('shield', { size: 16 }),
      h('span', null, t('AI-ს არაფერი გაეგზავნა. როცა გინდა, შეგიძლია ხელახლა სცადო.', 'Nothing was sent to the AI. You can try again whenever you like.')),
      h('button', { type: 'button', class: 'medi-retry', onClick: retryDeclined }, t('ხელახლა ცდა', 'Try again'))) : null;

    const fileList = st.files.length ? h('div', { class: 'scan-picked' }, st.files.map((f, i) => h('span', { class: 'scan-file' },
      icon(f.type === 'application/pdf' ? 'file' : 'image', { size: 13 }), f.name,
      h('button', { type: 'button', class: 'scan-file-x', 'aria-label': t('მოშორება', 'Remove'), onClick: () => { st.files.splice(i, 1); renderDock(); } }, icon('x', { size: 12 }))))) : null;
    const regions = st.kind === 'IMAGING' ? h('div', { class: 'scan-regions' },
      h('span', { class: 'field-label' }, t('რომელი ნაწილია გადაღებული?', 'Which part of the body is shown?')),
      h('div', { class: 'chips' }, IMAGING_REGIONS.map((r) => h('button', {
        type: 'button', class: `chip${st.region?.id === r.id ? ' on' : ''}`, 'aria-pressed': st.region?.id === r.id ? 'true' : 'false',
        onClick: () => { st.region = st.region?.id === r.id ? null : r; renderDock(); },
      }, isEn ? r.en.charAt(0).toUpperCase() + r.en.slice(1) : r.ka)))) : null;
    const readBtn = button(t('წაკითხვა', 'Read'), { icon: 'sparkles', disabled: !st.files.length || Boolean(st.busy), onClick: () => read() });

    const segmented = started ? h('div', { class: 'scan-seg', role: 'radiogroup' }, kinds.map((k) => h('button', {
      type: 'button', role: 'radio', 'aria-checked': st.kind === k ? 'true' : 'false', class: st.kind === k ? 'on' : '', onClick: () => choose(k),
    }, icon(INFO[k].icon, { size: 15 }), INFO[k].label))) : null;

    const askRow = canAsk() ? h('div', { class: 'scan-ask' }, ask,
      h('button', { type: 'button', class: 'medi-send', 'aria-label': t('გაგზავნა', 'Send'), disabled: Boolean(st.busy), onClick: () => (st.controller ? st.controller.abort() : askQuestion()) }, icon(st.controller ? 'stopSquare' : 'arrowUp', { size: 18 }))) : null;

    // After a result the upload panel folds into one row, so the chat keeps the room (a click unfolds it).
    if (started && !st.files.length && !st.showUpload) {
      mount(dock, declined, err, askRow,
        h('div', { class: 'scan-upload card compact' }, segmented,
          button(t('ახალი ფაილი', 'New file'), { variant: 'ghost', size: 'sm', icon: 'upload', disabled: Boolean(st.busy), onClick: () => { st.showUpload = true; renderDock(); } })));
      return;
    }
    mount(dock, declined, err,
      askRow,
      h('div', { class: 'scan-upload card' },
        segmented,
        dropzone({ multiple: st.kind === 'LAB', accept: info?.accept || 'image/*', hint: st.kind === 'LAB' ? t('JPG, PNG, WEBP ან PDF · 12 მბ-მდე · 8 გვერდამდე', 'JPG, PNG, WEBP or PDF · up to 12 MB · up to 8 pages') : t('JPG, PNG, WEBP · 12 მბ-მდე', 'JPG, PNG, WEBP · up to 12 MB'), onFiles: addFiles }),
        fileList, regions,
        h('div', { class: 'scan-note-row' }, note, readBtn)));
  }

  function choose(k) {
    if (st.busy || !kinds.includes(k)) return;
    st.kind = k;
    if (k !== 'LAB') st.files = st.files.filter((f) => f.type !== 'application/pdf').slice(0, 1);
    if (k !== 'IMAGING') st.region = null;
    st.error = null;
    renderThread();
    renderDock();
  }

  function addFiles(list) {
    st.error = null;
    for (const f of list) {
      if (st.kind !== 'LAB' && f.type === 'application/pdf') { st.error = t('PDF მხოლოდ ანალიზებისთვისაა. აქ ფოტო ატვირთე.', 'PDFs are for lab results only. Upload a photo here.'); continue; }
      const bad = checkFile(f, { pdf: st.kind === 'LAB' });
      if (bad) { st.error = bad; continue; }
      if (st.kind !== 'LAB') st.files = [f];
      else if (st.files.length >= MAX_FILES) { st.error = t('ერთ ჯერზე მაქსიმუმ 8 გვერდი შეგიძლია დაამატო.', 'You can add up to 8 pages at a time.'); break; } else st.files.push(f);
    }
    renderDock();
  }

  function reset() {
    if (st.busy) return;
    gen++;
    Object.assign(st, { files: [], region: null, turns: [], error: null, declined: null, doctorSession: null, showUpload: false });
    note.value = '';
    ask.value = '';
    renderThread();
    renderDock();
  }

  function retryDeclined() {
    const d = st.declined;
    st.declined = null;
    if (d?.what === 'explain') explain(d.turn);
    else if (d?.what === 'ask') { ask.value = d.text; askQuestion(); } else read();
  }

  /* ── Read (nothing is sent before this click) ───────── */
  async function read() {
    if (!st.files.length || st.busy) return;
    const scan = st.kind;
    const region = st.region;
    if (scan === 'IMAGING' && !region) { st.error = t('აირჩიე სხეულის არე. ბარძაყი და გულმკერდი ერთმანეთს არ უნდა ერეოდეს.', 'Choose the body area, so a thigh isn’t mistaken for a chest.'); renderDock(); return; }
    const files = st.files;
    const text = note.value.trim();
    const my = ++gen;
    st.error = null; st.declined = null;
    const upload = { kind: 'upload', scan, files, note: text, region: region ? (isEn ? region.en : region.ka) : null };
    st.turns.push(upload);
    st.files = []; st.region = null; note.value = ''; st.showUpload = false;
    st.busy = scan === 'LAB' ? t('ვკითხულობთ ანალიზს…', 'Reading the lab sheet…') : scan === 'SKIN' ? t('ფოტოს ვაკვირდები…', 'Looking at the photo…') : t('გამოსახულებას ვკითხულობ…', 'Reading the image…');
    renderThread(); renderDock(); scrollEnd();
    const regionContext = region ? `AUTHORITATIVE BODY REGION (stated by the patient; do not override with chest/spine unless landmarks clearly contradict): ${region.en} (${region.ka}).` : '';
    const context = [regionContext, text].filter(Boolean).join('\n');
    const restore = () => { st.turns = st.turns.filter((x) => x !== upload); st.files = files; note.value = text; st.kind = scan; st.region = region; };
    try {
      const out = await withAiConsent(async () => {
        if (scan === 'LAB') {
          let record = null;
          let notes = '';
          const extracts = [];
          for (let i = 0; i < files.length; i += 1) {
            if (my !== gen || !alive) return null;
            if (files.length > 1) { st.busy = t(`ვკითხულობთ გვერდს ${i + 1} / ${files.length}`, `Reading page ${i + 1} / ${files.length}`); renderThread(); }
            const fd = new FormData();
            fd.append('files', files[i], files[i].name);
            if (context) fd.append('context', context);
            if (record?.id) fd.append('recordId', record.id);
            if (i > 0) fd.append('append', '1');
            const res = await request('/api/ai/extract-lab', { method: 'POST', body: fd, timeoutMs: 150_000 });
            record = res.record || record;
            notes = res.notes || notes;
            if (res.labExtract) extracts.push(res.labExtract);
          }
          return { lab: true, record, notes, extract: mergeExtracts(extracts) };
        }
        const fd = new FormData();
        fd.append('file', files[0], files[0].name);
        fd.append('kind', scan);
        if (context) fd.append('context', context);
        return request('/api/ai/analyze-image', { method: 'POST', body: fd, timeoutMs: 150_000 });
      });
      if (my !== gen || !alive) return;
      if (out?.declined) { restore(); st.declined = { what: 'read' }; return; }
      if (!out) { restore(); return; }
      invalidate('/api/records');
      if (out.lab) {
        const created = String(out.record?.createdAt || new Date().toISOString());
        const date = out.extract.date || created.slice(0, 10) || ymd();
        const turn = { kind: 'lab', extract: out.extract, date, recordId: out.record?.id || '', notes: out.notes, note: text, panelId: `lab-${date}-${out.record?.id || Date.now()}`, createdAt: created };
        st.turns.push(turn);
        // The values land in Labs at once (mobile persistLab); the write-up is added when she asks for it.
        if (out.extract.parameters.length) {
          await put('/api/account/app-state', { labPanels: [{ id: turn.panelId, date, createdAt: created, recordIds: turn.recordId ? [turn.recordId] : [], analysis: '', parameters: out.extract.parameters }] }).catch(() => undefined);
          invalidate('/api/account');
        }
      } else {
        const analysis = String(out.analysis || '').trim();
        if (!analysis) throw new ApiError(t('Medi-მ დასკვნა ვერ დაასრულა. სცადე ხელახლა.', 'Medi couldn’t finish the review. Please try again.'), 502);
        st.turns.push({ kind: 'result', scan, text: analysis, recordId: out.record?.id || '', region: upload.region });
      }
    } catch (e) {
      if (my !== gen || !alive) return;
      restore();
      st.error = e?.message || t('კავშირი შეფერხდა. სცადე ხელახლა.', 'Connection problem. Please try again.');
    } finally {
      if (my === gen && alive) { st.busy = null; renderThread(); renderDock(); scrollEnd(); }
    }
  }

  async function explain(turn) {
    if (st.busy || !turn?.extract?.parameters?.length) return;
    const my = ++gen;
    st.busy = t('Medi ხსნის შედეგებს…', 'Medi is explaining your results…');
    st.error = null; st.declined = null;
    renderThread(); renderDock();
    try {
      const analysis = await explainPanel({ id: turn.panelId, date: turn.date, parameters: turn.extract.parameters, recordIds: turn.recordId ? [turn.recordId] : [], visionNotes: turn.notes, createdAt: turn.createdAt }, turn.note);
      if (my !== gen || !alive) return;
      if (!analysis) { st.declined = { what: 'explain', turn }; return; }
      turn.analysis = analysis;
    } catch (e) {
      if (my === gen && alive) st.error = e?.message || t('Medi-მ დასკვნა ვერ დაასრულა. სცადე ხელახლა.', 'Medi couldn’t finish the review. Please try again.');
    } finally {
      if (my === gen && alive) { st.busy = null; renderThread(); renderDock(); scrollEnd(); }
    }
  }

  /** A question about the latest result: the doctor model answers with that result as context. */
  async function askQuestion() {
    const question = ask.value.trim();
    const context = latestResultContext(st.turns);
    if (question.length < 2 || !context || st.busy) return;
    const my = ++gen;
    st.error = null; st.declined = null;
    const q = { kind: 'question', text: question };
    const slot = { kind: 'answer', text: '', streaming: true };
    st.turns.push(q, slot);
    ask.value = '';
    st.busy = t('პასუხს ვწერ…', 'Writing the answer…');
    const ctrl = new AbortController();
    st.controller = ctrl;
    renderThread(); renderDock(); scrollEnd();
    let done = null;
    try {
      const res = await withAiConsent(async () => {
        await stream('/api/ai/query', { message: question, mode: 'DOCTOR', ...(st.doctorSession ? { sessionId: st.doctorSession } : {}), context, stream: true }, (event, data) => {
          if (my !== gen || !alive) return;
          const type = (data && typeof data === 'object' && data.type) || event;
          if (type === 'delta' && data.text) { slot.text += data.text; paintAnswer(slot); }
          else if (type === 'done') done = data;
          else if (type === 'error') throw new ApiError(data?.error || t('პასუხი ვერ მივიღე. სცადე ხელახლა.', 'I couldn’t get an answer. Please try again.'), Number(data?.status) || 502);
        }, { signal: ctrl.signal });
        return done;
      });
      if (my !== gen || !alive) return;
      if (res?.declined) { st.turns = st.turns.filter((x) => x !== q && x !== slot); ask.value = question; st.declined = { what: 'ask', text: question }; return; }
      if (!done?.answer?.trim()) throw new ApiError(t('პასუხი სრულად ვერ მივიღეთ. გთხოვ, სცადე ხელახლა.', 'The answer didn’t arrive in full. Please try again.'), 502);
      Object.assign(slot, { text: done.answer, streaming: false });
      st.doctorSession = done.sessionId || st.doctorSession;
      invalidate('/api/chats');
    } catch (e) {
      if (my !== gen || !alive) return;
      st.turns = st.turns.filter((x) => x !== q && x !== slot);
      if (!ask.value.trim()) ask.value = question;
      if (!(ctrl.signal.aborted)) st.error = e?.message || t('კავშირი შეფერხდა. სცადე ხელახლა.', 'Connection problem. Please try again.');
    } finally {
      if (st.controller === ctrl) st.controller = null;
      if (my === gen && alive) { st.busy = null; renderThread(); renderDock(); scrollEnd(); }
    }
  }

  renderThread();
  renderDock();
  return () => { alive = false; gen++; try { st.controller?.abort(); } catch { /* ignore */ } };
}
