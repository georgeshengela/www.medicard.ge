// MEDICARD web — „ჩემი ბარათი“ (/records, /records/:id). Mirrors mobile/app/(tabs)/records.tsx and record/[id].tsx.
// Records come from the AI modules (lab, imaging, skin, symptoms, skincare); saved Medi conversations
// (/api/chats) are listed here too and reopen in /medi. Private files are fetched with the Bearer token.
import {
  h, mount, icon, tile, pageHead, section, card, button, iconButton, busy, badge, empty, skeleton,
  errorBox, field, textarea, input, toast, openModal, confirmDialog, markdown, fmtDateTime, relDay, debounce,
} from '../ui.js';
import { get, del, request, invalidate, authedBlobUrl } from '../api.js';
import { donut } from '../charts.js';
import { withAiConsent } from '../aiConsent.js';
import { openLabUpload, dropzone, checkFile } from './lab.js';
import { featureOn } from '../session.js';

function ensureCss() {
  // lab.css styles the shared upload modal (dropzone, progress, result).
  for (const href of ['/app/css/lab.css', '/app/css/records.css']) {
    if (!document.querySelector(`link[href="${href}"]`)) document.head.append(h('link', { rel: 'stylesheet', href }));
  }
}

const DISCLAIMER = 'ეს არ არის დიაგნოზი — საჭიროებისას ექიმს მიმართე.';
const TYPE_LABEL = {
  LAB: 'ანალიზები', XRAY: 'რენტგენი', CT_MRI: 'CT / MRI', SKIN: 'კანი', SKINCARE: 'კანის მოვლა', PRESCRIPTION: 'რეცეპტი', SYMPTOM: 'სიმპტომები',
};
const TYPE_LOOK = {
  LAB: { icon: 'flask', ink: 'blue', color: 'var(--c2)' },
  CT_MRI: { icon: 'scanLine', ink: 'sky', color: 'var(--c5)' },
  XRAY: { icon: 'scanLine', ink: 'sky', color: 'var(--c5)' },
  SKIN: { icon: 'scanFace', ink: 'rose', color: 'var(--c4)' },
  SKINCARE: { icon: 'sparkles', ink: 'violet', color: 'var(--c3)' },
  SYMPTOM: { icon: 'stethoscope', ink: 'teal', color: 'var(--c1)' },
  PRESCRIPTION: { icon: 'pill', ink: 'amber', color: 'var(--c6)' },
};
const FILTERS = ['ALL', 'LAB', 'CT_MRI', 'SKIN', 'SKINCARE', 'SYMPTOM'];
const MEDI_MODE = { ASSISTANT: { label: 'Medi', ink: 'sky' }, DOCTOR: { label: 'ექიმთან', ink: 'teal' }, CONSILIUM: { label: 'ღრმა ანალიზი', ink: 'violet' } };
const look = (t) => TYPE_LOOK[t] || { icon: 'file', ink: 'neutral', color: 'var(--text3)' };
const typeLabel = (t) => TYPE_LABEL[t] || t;

const IMAGING_REGIONS = [
  { id: 'hip-femur', ka: 'ბარძაყი / თეძო', en: 'hip / femur' },
  { id: 'knee', ka: 'მუხლი', en: 'knee' },
  { id: 'tibia-fibula', ka: 'წვივი / ფეხი', en: 'tibia / fibula / leg' },
  { id: 'ankle-foot', ka: 'ტერფი / კოჭი', en: 'ankle / foot' },
  { id: 'pelvis', ka: 'მენჯი', en: 'pelvis' },
  { id: 'spine', ka: 'ხერხემალი', en: 'spine' },
  { id: 'chest', ka: 'გულმკერდი', en: 'chest' },
  { id: 'abdomen', ka: 'მუცელი', en: 'abdomen' },
  { id: 'shoulder', ka: 'მხარი', en: 'shoulder' },
  { id: 'arm', ka: 'მკლავი / იდაყვი', en: 'humerus / elbow / forearm' },
  { id: 'hand', ka: 'მაჯა / ხელი', en: 'wrist / hand' },
  { id: 'head-neck', ka: 'თავი / კისერი', en: 'skull / cervical spine' },
];

const KINDS = {
  IMAGING: {
    title: 'ატვირთე სნიმარის ფოტო', hint: 'გადაუღე ეკრანს ან ფირს კარგ განათებაზე, ბრჭყვიალის გარეშე',
    contextLabel: 'დამატებითი ინფორმაცია', placeholder: 'მაგ. ტკივილი მარცხენა ბარძაყში, ოპერაციის შემდეგ', regions: true,
  },
  SKIN: {
    title: 'გადაუღე ფოტო კანის უბანს', hint: 'გადაიღე დღის განათებაზე, 10-15 სმ მანძილიდან, მკვეთრად',
    contextLabel: 'რამდენი ხანია და როგორ იცვლება?', placeholder: 'მაგ. ხალი ორი თვეა გამუქდა და ოდნავ გაიზარდა',
  },
};

/** First readable sentence of the Markdown analysis, for the list preview (mobile plainSummary). */
function plainSummary(md) {
  const line = String(md || '').split('\n').map((l) => l.trim())
    .find((l) => l.length > 0 && !l.startsWith('#') && !l.startsWith('-') && !l.startsWith('|'));
  if (!line) return '';
  const clean = line.replace(/\[([^\]]*)\]\([^)]+\)/g, '$1').replace(/[*`>]/g, '');
  return clean.length <= 130 ? clean : `${clean.slice(0, 127)}…`;
}

/** `/uploads/<uuid>.ext` → `/api/files/<name>` (owner-only route). */
function fileUrl(stored) {
  if (!stored) return null;
  const name = String(stored).split('?')[0].replace(/\\/g, '/').split('/').pop() || '';
  return /^[0-9a-f-]{36}\.(jpg|jpeg|png|webp|gif|pdf|bin)$/i.test(name) ? `/api/files/${name}` : null;
}
const isPdf = (stored) => /\.pdf$/i.test(String(stored || '').split('?')[0]);

async function openPrivateFile(stored) {
  const url = fileUrl(stored);
  if (!url) { toast('ფაილი ვერ მოიძებნა.', 'error'); return; }
  // Open the tab synchronously (popup blockers), then point it at the blob once it is ready.
  const win = window.open('', '_blank');
  const blob = await authedBlobUrl(url).catch(() => null);
  if (!blob) { win?.close(); toast('ფაილი ვერ ჩაიტვირთა. შესაძლოა სერვერზე აღარ ინახება.', 'error'); return; }
  if (win) win.location.href = blob; else window.location.assign(blob);
}

/** Imaging / skin: POST /api/ai/analyze-image (field `file`, `kind`, `context`) behind AI consent. */
function openImageUpload(kind, { navigate, onSaved }) {
  const cfg = KINDS[kind];
  let file = null;
  let region = null;
  const err = h('div', { class: 'form-error', hidden: true });
  const preview = h('div', { class: 'rec-pick', hidden: true });
  const ctxInput = textarea({ placeholder: cfg.placeholder, maxlength: 2000, rows: 3 });
  const stage = h('div', { class: 'lab-stage', hidden: true });
  const body = h('div', { class: 'stack', style: { gap: '16px' } });
  let submitBtn;
  let openBtn;
  let objectUrl = null;
  const showErr = (m) => { err.textContent = m || ''; err.hidden = !m; };

  const setFile = (list) => {
    showErr('');
    const f = list[0];
    if (!f) return;
    const bad = checkFile(f, { pdf: false });
    if (bad) { showErr(bad); return; }
    file = f;
    if (objectUrl) URL.revokeObjectURL(objectUrl);
    objectUrl = URL.createObjectURL(f);
    mount(preview, h('img', { src: objectUrl, alt: '' }),
      h('div', { class: 'row-main' }, h('div', { class: 'row-title' }, f.name), h('div', { class: 'row-sub' }, `${Math.max(1, Math.round(f.size / 1024))} კბ`)),
      iconButton('x', { title: 'მოშორება', onClick: () => { file = null; preview.hidden = true; } }));
    preview.hidden = false;
  };

  const regionChips = cfg.regions ? h('div', { class: 'chips' }, IMAGING_REGIONS.map((r) => h('button', {
    type: 'button', class: 'chip', onClick: (e) => {
      region = r;
      e.currentTarget.parentElement.querySelectorAll('.chip').forEach((c) => c.classList.remove('on'));
      e.currentTarget.classList.add('on');
    },
  }, r.ka))) : null;

  mount(body,
    dropzone({ multiple: false, accept: 'image/jpeg,image/png,image/webp', hint: `${cfg.hint} · JPG, PNG, WEBP · 12 მბ-მდე`, onFiles: setFile }),
    preview,
    regionChips ? h('div', { class: 'field' }, h('span', { class: 'field-label' }, 'რომელი ნაწილია გადაღებული?'), regionChips) : null,
    field(cfg.contextLabel, ctxInput, 'არასავალდებულო'),
    stage, err);

  const run = async () => {
    if (!file) { showErr('ჯერ აირჩიე ფაილი'); return; }
    if (cfg.regions && !region) { showErr('აირჩიე სხეულის არე. ბარძაყი და გულმკერდი ერთმანეთს არ უნდა ერეოდეს.'); return; }
    showErr('');
    const regionContext = region
      ? `AUTHORITATIVE BODY REGION (stated by the patient; do not override with chest/spine unless landmarks clearly contradict): ${region.en} (${region.ka}).`
      : '';
    const context = [regionContext, ctxInput.value.trim()].filter(Boolean).join('\n');
    const out = await withAiConsent(async () => {
      stage.hidden = false;
      mount(stage, h('span', { class: 'lab-spinner' }), h('span', null, 'გამოსახულება მუშავდება…'));
      const fd = new FormData();
      fd.append('file', file, file.name);
      fd.append('kind', kind);
      if (context) fd.append('context', context);
      return request('/api/ai/analyze-image', { method: 'POST', body: fd, timeoutMs: 150_000 });
    }).finally(() => { stage.hidden = true; });
    if (!out || out.declined) return;
    const analysis = String(out.analysis || '').trim();
    invalidate('/api/records');
    onSaved?.();
    mount(body,
      h('div', { class: 'lab-saved' }, tile('check', 'green', 40), h('div', null, h('div', { class: 'card-title' }, 'დასკვნა შენახულია ჩემს ბარათში'), h('div', { class: 'card-sub' }, fmtDateTime(out.record?.createdAt || new Date())))),
      analysis ? h('div', { class: 'lab-analysis' }, markdown(analysis)) : h('p', { class: 'muted' }, 'Medi-მ დასკვნა ვერ დაასრულა. სცადე ხელახლა.'),
      h('p', { class: 'disclaimer', style: { marginTop: 0 } }, icon('info', { size: 15 }), DISCLAIMER));
    submitBtn.hidden = true;
    if (out.record?.id) { openBtn.hidden = false; openBtn.dataset.id = out.record.id; }
  };

  openModal({
    title: cfg.title,
    size: 'md',
    body,
    onClose: () => { if (objectUrl) URL.revokeObjectURL(objectUrl); },
    footer: (close) => {
      submitBtn = button('გაანალიზე', { icon: 'sparkles', onClick: () => busy(submitBtn, async () => { try { await run(); } catch (e) { showErr(e.message); } }) });
      openBtn = button('შენახული ჩანაწერის ნახვა', { variant: 'secondary', onClick: () => { close(); navigate(`/records/${openBtn.dataset.id}`); } });
      openBtn.hidden = true;
      return [button('დახურვა', { variant: 'ghost', onClick: () => close() }), submitBtn, openBtn];
    },
  });
}

function openUploadChooser({ navigate, onSaved }) {
  const opt = (ic, ink, title, sub, fn) => h('button', { type: 'button', class: 'rec-choice', onClick: fn }, tile(ic, ink, 44),
    h('div', { class: 'row-main' }, h('div', { class: 'row-title' }, title), h('div', { class: 'row-sub' }, sub)), icon('chevronRight', { size: 18, className: 'row-chev' }));
  const m = openModal({
    title: 'ატვირთვა',
    size: 'sm',
    body: h('div', { class: 'stack', style: { gap: '8px' } },
      h('p', { class: 'muted', style: { fontSize: '14px', marginBottom: '6px' } }, 'ატვირთე ანალიზი ან სნიმარი და დასკვნა აქ შეინახება.'),
      opt('flask', 'blue', 'ანალიზი', 'ფოტო ან PDF — ნორმებით', () => { m.close(); openLabUpload({ navigate, onSaved }); }),
      opt('scanLine', 'sky', 'სნიმარი', 'რენტგენი, ექო, MRI', () => { m.close(); openImageUpload('IMAGING', { navigate, onSaved }); }),
      opt('scanFace', 'rose', 'კანი', 'ფოტოს შეფასება', () => { m.close(); openImageUpload('SKIN', { navigate, onSaved }); })),
  });
}

/* ── List page ────────────────────────────────────────── */
async function listPage(root, ctx) {
  const state = { records: [], total: 0, chats: [], filter: 'ALL', query: '', lab: null };
  const uploadBtn = button('ატვირთვა', { icon: 'upload', onClick: () => openUploadChooser({ navigate: ctx.navigate, onSaved: () => refresh().catch(() => {}) }) });
  const body = h('div');
  mount(root, pageHead('ჩემი ბარათი', 'ანალიზები, დასკვნები და საუბრები Medi-სთან ერთ ადგილას', uploadBtn), body);

  mount(body, h('div', { class: 'stack', style: { gap: '16px' } },
    h('div', { class: 'stats-row' }, [0, 1, 2, 3].map(() => skeleton(2))),
    h('div', { class: 'grid grid-main' }, skeleton(7), skeleton(5))));

  const refresh = async () => {
    invalidate('/api/records');
    invalidate('/api/chats');
    const [recs, chats, app] = await Promise.all([
      get('/api/records', { take: 100 }),
      get('/api/chats').catch(() => ({ sessions: [] })),
      get('/api/account/app-state').catch(() => null),
    ]);
    state.records = recs.records || [];
    state.total = recs.total ?? state.records.length;
    state.chats = chats.sessions || [];
    const panels = (app?.state?.labPanels || []).filter((p) => p?.date && p.parameters?.length).sort((a, b) => b.date.localeCompare(a.date));
    state.lab = panels.length ? { latest: panels[0], count: panels.length } : null;
    render();
  };

  const listHost = h('div');
  const chipsHost = h('div', { class: 'chips' });

  const render = () => {
    const { records, chats } = state;
    if (!records.length && !chats.length) {
      mount(body,
        card({ class: 'spotlight hero-card pad-lg rec-hero' },
          tile('file', 'teal', 48),
          h('h2', { style: { fontSize: '22px', marginTop: '14px' } }, 'ჩანაწერები ჯერ არ გაქვს'),
          h('p', { class: 'muted', style: { marginTop: '6px', maxWidth: '52ch' } }, 'ატვირთე ანალიზი ან სნიმარი და დასკვნა აქ შეინახება. Medi-სთან საუბრებიც აქ გამოჩნდება.'),
          h('div', { class: 'hstack', style: { marginTop: '18px' } }, button('ატვირთვა', { variant: 'light', icon: 'upload', onClick: () => openUploadChooser({ navigate: ctx.navigate, onSaved: () => refresh().catch(() => {}) }) }))),
        addSection());
      return;
    }

    const counts = {};
    for (const r of records) counts[r.type] = (counts[r.type] || 0) + 1;
    const lastAt = [...records.map((r) => r.createdAt), ...chats.map((c) => c.updatedAt)].filter(Boolean).sort().at(-1);

    const parts = Object.entries(counts).map(([t, v]) => ({ name: typeLabel(t), value: v, color: look(t).color }));
    const overview = card({ class: 'rec-overview' },
      h('div', { class: 'rec-donut' }, donut({ parts: parts.length ? parts : [{ name: '', value: 1, color: 'var(--track)' }], size: 132, stroke: 14,
        center: [h('strong', { style: { fontSize: '26px' } }, String(state.total)), h('span', null, 'ჩანაწერი')] })),
      h('div', { class: 'rec-overview-stats' },
        h('div', { class: 'rec-legend' }, parts.length ? parts.map((p) => h('div', { class: 'rec-legend-row' }, h('i', { style: { background: p.color } }), h('span', null, p.name), h('b', { class: 'num' }, String(p.value))))
          : h('span', { class: 'faint', style: { fontSize: '13.5px' } }, 'დასკვნები ჯერ არ არის')),
        h('div', { class: 'rec-kpis' },
          kpi('messageText', 'sky', 'საუბრები Medi-სთან', String(chats.length)),
          kpi('clock', 'violet', 'ბოლო განახლება', lastAt ? relDay(lastAt) : '—'))));

    const labCard = state.lab ? h('a', { class: 'card hover rec-lab', href: '/lab', 'data-link': '' },
      tile('flask', 'blue', 42),
      h('div', { class: 'row-main' },
        h('div', { class: 'card-title' }, 'ლაბორატორია'),
        h('div', { class: 'card-sub' }, `ბოლო კვლევა ${relDay(state.lab.latest.date)} · ${state.lab.latest.parameters.length} მაჩვენებელი`)),
      (() => { const off = state.lab.latest.parameters.filter((p) => p.flag === 'H' || p.flag === 'L').length; return off ? badge(`${off} საყურადღებო`, 'danger') : badge('ნორმაში', 'ok'); })(),
      icon('chevronRight', { size: 18, className: 'row-chev' })) : h('a', { class: 'card hover rec-lab', href: '/lab', 'data-link': '' },
      tile('flask', 'blue', 42),
      h('div', { class: 'row-main' }, h('div', { class: 'card-title' }, 'ლაბორატორია'), h('div', { class: 'card-sub' }, 'მაჩვენებლები ნორმებით და გრაფიკებით')),
      icon('chevronRight', { size: 18, className: 'row-chev' }));

    const search = input({ type: 'search', placeholder: 'ძიება ჩანაწერებში…', value: state.query, 'aria-label': 'ძიება ჩანაწერებში' });
    search.addEventListener('input', debounce(() => { state.query = search.value; paintList(); }, 150));

    const chatsCard = chats.length ? section('საუბრები', card({ class: 'flush' }, h('div', { class: 'list rec-list' }, chats.slice(0, 30).map((c) => {
      const mode = MEDI_MODE[c.mode] || MEDI_MODE.ASSISTANT;
      return recRow({
        ic: 'messageText', ink: mode.ink, title: c.title || 'საუბარი Medi-სთან',
        meta: `${mode.label} · ${relDay(c.updatedAt)}`, body: c.preview,
        href: `/medi?session=${encodeURIComponent(c.id)}`,
        onDelete: async (rowEl) => {
          const ok = await confirmDialog({ title: 'საუბრის წაშლა', body: 'ნამდვილად გინდა საუბრის წაშლა?', confirm: 'წაშლა', danger: true });
          if (!ok) return;
          try {
            await del(`/api/chats/${c.id}`);
            state.chats = state.chats.filter((x) => x.id !== c.id);
            rowEl.remove();
            toast('საუბარი წაიშალა');
            if (!state.chats.length && !state.records.length) render();
          } catch (e) { toast(e.message, 'error'); }
        },
      });
    }))), { link: { href: '/medi', label: 'Medi' } }) : null;

    mount(body,
      h('div', { class: 'grid grid-main rec-top' }, overview, h('div', { class: 'stack', style: { gap: '16px' } }, labCard, featureOn('medi') ? mediHint() : null)),
      h('div', { class: 'grid grid-main' },
        h('div', null, section('ანალიზები და დასკვნები', h('div', { class: 'stack', style: { gap: '12px' } },
          h('div', { class: 'rec-tools' }, search, chipsHost), listHost))),
        h('div', null, chatsCard, addSection())),
      h('p', { class: 'disclaimer' }, icon('info', { size: 15 }), DISCLAIMER));
    paintChips(counts);
    paintList();
  };

  const paintChips = (counts) => mount(chipsHost, FILTERS.filter((f) => f === 'ALL' || counts[f] || state.filter === f).map((f) => h('button', {
    type: 'button', class: `chip ${state.filter === f ? 'on' : ''}`, 'aria-pressed': state.filter === f ? 'true' : 'false',
    onClick: () => { state.filter = f; paintChips(counts); paintList(); },
  }, f === 'ALL' ? 'ყველა' : typeLabel(f), h('span', { class: 'lab-chip-n' }, String(f === 'ALL' ? state.records.length : counts[f] || 0)))));

  const paintList = () => {
    const q = state.query.trim().toLowerCase();
    const rows = state.records.filter((r) => (state.filter === 'ALL' || r.type === state.filter)
      && (!q || `${typeLabel(r.type)} ${r.aiAnalysis || ''}`.toLowerCase().includes(q)));
    if (!state.records.length) {
      mount(listHost, card(empty('დასკვნები ჯერ არ გაქვს', 'ატვირთე ანალიზი ან სნიმარი და დასკვნა აქ შეინახება.')));
      return;
    }
    mount(listHost, card({ class: 'flush' }, rows.length ? h('div', { class: 'list rec-list' }, rows.map((r) => {
      const l = look(r.type);
      return recRow({
        ic: l.icon, ink: l.ink, title: typeLabel(r.type), meta: fmtDateTime(r.createdAt), body: plainSummary(r.aiAnalysis),
        attach: r.imageUrl ? (isPdf(r.imageUrl) ? 'PDF' : 'ფოტო') : null,
        href: `/records/${r.id}`,
        onDelete: async (rowEl) => {
          const ok = await confirmDialog({ title: 'ჩანაწერის წაშლა', body: 'ნამდვილად გინდა ამ ჩანაწერის წაშლა? ეს ვერ დაბრუნდება.', confirm: 'წაშლა', danger: true });
          if (!ok) return;
          try {
            await del(`/api/records/${r.id}`);
            state.records = state.records.filter((x) => x.id !== r.id);
            state.total = Math.max(0, state.total - 1);
            rowEl.remove();
            toast('ჩანაწერი წაიშალა');
            render();
          } catch (e) { toast(e.message, 'error'); }
        },
      });
    })) : h('p', { class: 'faint', style: { padding: '22px 20px', fontSize: '14px' } }, q ? 'ვერაფერი მოიძებნა.' : 'ამ ტიპის ჩანაწერი ჯერ არ გაქვს.')));
  };

  function addSection() {
    const t = (ic, ink, title, sub, onClick, href) => h(href ? 'a' : 'button', { class: 'card hover rec-add', type: href ? undefined : 'button', href, 'data-link': href ? '' : undefined, onClick },
      tile(ic, ink, 40), h('div', null, h('div', { class: 'card-title' }, title), h('div', { class: 'card-sub' }, sub)));
    return section('დამატება', h('div', { class: 'rec-add-grid' },
      t('flask', 'blue', 'ანალიზი', 'ფოტო ან PDF — ნორმებით', () => openLabUpload({ navigate: ctx.navigate, onSaved: () => refresh().catch(() => {}) })),
      t('scanLine', 'sky', 'სნიმარი', 'რენტგენი, ექო, MRI', () => openImageUpload('IMAGING', { navigate: ctx.navigate, onSaved: () => refresh().catch(() => {}) })),
      t('scanFace', 'rose', 'კანი', 'ფოტოს შეფასება', () => openImageUpload('SKIN', { navigate: ctx.navigate, onSaved: () => refresh().catch(() => {}) })),
      featureOn('medi') ? t('sparkles', 'teal', 'ჰკითხე Medi-ს', 'აღწერე, რა გაწუხებს', null, '/medi') : null));
  }

  try { await refresh(); } catch (e) { mount(body, errorBox(e, () => listPage(root, ctx))); }
}

function mediHint() {
  return h('a', { class: 'card hover rec-lab', href: '/medi', 'data-link': '' },
    tile('sparkles', 'teal', 42),
    h('div', { class: 'row-main' }, h('div', { class: 'card-title' }, 'Medi'), h('div', { class: 'card-sub' }, 'საუბრები ავტომატურად ინახება ამ ბარათში')),
    icon('chevronRight', { size: 18, className: 'row-chev' }));
}

function kpi(ic, ink, label, value) {
  return h('div', { class: 'rec-kpi' }, tile(ic, ink, 34), h('div', null, h('div', { class: 'stat-label' }, label), h('div', { class: 'rec-kpi-v' }, value)));
}

/** List row: the open link and the delete button are siblings, never a button inside a link. */
function recRow({ ic, ink, title, meta, body, attach, href, onDelete }) {
  const el = h('div', { class: 'rec-row' });
  el.append(
    h('a', { class: 'rec-row-main', href, 'data-link': '', 'aria-label': `${title}. ${meta}` },
      tile(ic, ink, 40),
      h('div', { class: 'row-main' },
        h('div', { class: 'rec-row-top' }, h('span', { class: 'row-title' }, title), attach ? badge(attach, 'neutral') : null),
        h('div', { class: 'faint', style: { fontSize: '12.5px', marginTop: '1px' } }, meta),
        body ? h('div', { class: 'rec-row-body' }, body) : null)),
    iconButton('trash', { title: 'წაშლა', size: 17, class: 'rec-del', onClick: () => onDelete(el) }));
  return el;
}

/* ── Detail page ──────────────────────────────────────── */
async function detailPage(root, ctx) {
  const { id } = ctx.params;
  const back = h('a', { class: 'back', href: '/records', 'data-link': '' }, icon('chevronLeft', { size: 16 }), 'ჩემი ბარათი');
  const host = h('div');
  mount(root, back, host);
  mount(host, h('div', { class: 'grid grid-main', style: { marginTop: '24px' } }, skeleton(8), skeleton(4)));
  let record;
  try {
    ({ record } = await get(`/api/records/${encodeURIComponent(id)}`));
  } catch (e) {
    mount(host, h('div', { style: { marginTop: '24px' } }, e.status === 404 || e.status === 400
      ? card(empty('ჩანაწერი ვერ მოიძებნა', 'შესაძლოა უკვე წაშლილია.', button('ჩემს ბარათზე დაბრუნება', { href: '/records', variant: 'secondary' })))
      : errorBox(e, () => detailPage(root, ctx))));
    return;
  }
  const l = look(record.type);
  ctx.setTitle(typeLabel(record.type));
  const delBtn = button('წაშლა', { variant: 'ghost', icon: 'trash', onClick: async () => {
    const ok = await confirmDialog({ title: 'ჩანაწერის წაშლა', body: 'ნამდვილად გინდა ამ ჩანაწერის წაშლა? ეს ვერ დაბრუნდება.', confirm: 'წაშლა', danger: true });
    if (!ok) return;
    await busy(delBtn, async () => {
      try {
        await del(`/api/records/${record.id}`);
        invalidate('/api/records');
        toast('ჩანაწერი წაიშალა');
        ctx.navigate('/records', { replace: true });
      } catch (e) { toast(e.message, 'error'); }
    });
  } });

  const fileSide = record.imageUrl ? filePreview(record.imageUrl) : null;
  mount(host,
    h('header', { class: 'page-head' },
      h('div', { class: 'hstack', style: { gap: '14px', flexWrap: 'nowrap' } }, tile(l.icon, l.ink, 52),
        h('div', null, h('h1', null, typeLabel(record.type)), h('p', null, fmtDateTime(record.createdAt)))),
      h('div', { class: 'page-head-actions' },
        record.type === 'LAB' ? button('ლაბორატორია', { variant: 'secondary', icon: 'activity', href: '/lab' }) : null,
        delBtn)),
    h('div', { class: `grid ${fileSide ? 'grid-main' : ''}` },
      card({ class: 'pad-lg rec-analysis' },
        h('div', { class: 'hstack', style: { marginBottom: '14px' } }, badge(typeLabel(record.type), 'brand'), h('span', { class: 'faint', style: { fontSize: '13px' } }, relDay(record.createdAt))),
        record.aiAnalysis?.trim() ? markdown(record.aiAnalysis) : h('p', { class: 'muted' }, 'დასკვნის ტექსტი არ არის.')),
      fileSide),
    h('p', { class: 'disclaimer' }, icon('info', { size: 15 }), DISCLAIMER));
}

function filePreview(stored) {
  const pdf = isPdf(stored);
  const frame = h('div', { class: 'rec-file-frame' });
  const openBtn = button(pdf ? 'PDF-ის გახსნა' : 'სრულ ზომაზე გახსნა', { variant: 'secondary', icon: 'externalLink', class: 'btn-block', onClick: () => openPrivateFile(stored) });
  if (pdf) {
    mount(frame, h('div', { class: 'rec-file-pdf' }, tile('file', 'rose', 56), h('div', { class: 'card-title' }, 'PDF დოკუმენტი'), h('div', { class: 'card-sub' }, 'გაიხსნება ახალ ჩანართში')));
  } else {
    mount(frame, h('div', { class: 'sk', style: { height: '100%', borderRadius: '16px' } }));
    const url = fileUrl(stored);
    (url ? authedBlobUrl(url) : Promise.resolve(null)).then((blob) => {
      if (!blob) { mount(frame, h('div', { class: 'rec-file-pdf' }, tile('image', 'neutral', 48), h('div', { class: 'card-sub' }, 'ფოტო ვერ ჩაიტვირთა'))); return; }
      const img = h('img', { src: blob, alt: 'ატვირთული ფოტო', onClick: () => openPrivateFile(stored) });
      img.addEventListener('error', () => mount(frame, h('div', { class: 'rec-file-pdf' }, tile('image', 'neutral', 48), h('div', { class: 'card-sub' }, 'ფოტო ვერ ჩაიტვირთა'))));
      mount(frame, img);
    }).catch(() => mount(frame, h('div', { class: 'rec-file-pdf' }, tile('image', 'neutral', 48), h('div', { class: 'card-sub' }, 'ფოტო ვერ ჩაიტვირთა'))));
  }
  return h('aside', { class: 'rec-file' }, section('ატვირთული ფაილი', card({ class: 'stack', style: { gap: '12px' } }, frame, openBtn)));
}

export default async function recordsPage(root, ctx) {
  ensureCss();
  if (ctx.params?.id) return detailPage(root, ctx);
  return listPage(root, ctx);
}

