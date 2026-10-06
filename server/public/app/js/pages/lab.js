// MEDICARD web — „ანალიზები“ (/lab). Mirrors mobile/app/lab/** + AnalysisModule (kind LAB).
// Lab panels live in the account app-state (GET/PUT /api/account/app-state, server merges by date).
// Upload = POST /api/ai/extract-lab (multipart field `files`, one page per call, `append=1` for the
// next pages of the same test) — the server stores the panel itself. Write-up = POST /api/ai/explain-lab.
import {
  h, mount, clear, icon, tile, pageHead, section, card, button, iconButton, busy, badge, empty, skeleton,
  errorBox, segmented, field, textarea, input, openModal, markdown, fmtDate, relDay, ymd,
  parseDate, KA_MONTHS_SHORT, debounce,
} from '../ui.js';
import { get, put, request, invalidate } from '../api.js';
import { sparkline } from '../charts.js';
import { withAiConsent, aiDeclinedSlot } from '../aiConsent.js';
import { featureOn } from '../session.js';
import { wordmark } from '../brand.js';
import { t, isEn } from '../i18n.js';

const CSS = '/app/css/lab.css';
function ensureCss() {
  if (!document.querySelector(`link[href="${CSS}"]`)) document.head.append(h('link', { rel: 'stylesheet', href: CSS }));
}

export const MEDI_PREFILL_KEY = 'medicard.web.mediPrefill';
const MAX_FILES = 8;
const MAX_BYTES = 12 * 1024 * 1024;
const ACCEPT = 'image/jpeg,image/png,image/webp,application/pdf';
const DISCLAIMER = t('ეს არ არის დიაგნოზი — საჭიროებისას ექიმს მიმართე.', 'This is not a diagnosis — see a doctor when needed.');
const FLAG_NOTE = t('ნიშანი ლაბორატორიის ფურცელზე დაბეჭდილ ნიშანს ან საცნობარო დიაპაზონს ეფუძნება, არა აპის საკუთარ ნორმებს.', 'The flag is based on the mark or reference range printed on the lab sheet, not on the app’s own ranges.');

const FLAG = {
  H: { label: t('მაღალი', 'High'), tone: 'danger' },
  L: { label: t('დაბალი', 'Low'), tone: 'danger' },
  N: { label: t('ნორმა', 'Normal'), tone: 'ok' },
  U: { label: t('უცნობი', 'Unknown'), tone: 'neutral' },
};
const FLAG_PROMPT = isEn ? { H: 'high', L: 'low', U: 'not assessed', N: 'in range' } : { H: 'მაღალი', L: 'დაბალი', U: 'შეუფასებელი', N: 'ნორმაში' };
export const isOff = (f) => f === 'H' || f === 'L';

/* ── Data helpers ─────────────────────────────────────── */
const keyOf = (p) => String(p.key || p.nameEn || p.nameKa || '').trim().toLowerCase();
export const nameOf = (p) => (isEn ? p.nameEn || p.nameKa : p.nameKa || p.nameEn) || p.key;

export function formatNorm(p) {
  const u = p.unit ? ` ${p.unit}` : '';
  if (p.refLow != null && p.refHigh != null) return `${p.refLow} – ${p.refHigh}${u}`;
  if (p.refHigh != null) return `≤ ${p.refHigh}${u}`;
  if (p.refLow != null) return `≥ ${p.refLow}${u}`;
  return null;
}

function num(n) {
  if (n == null || Number.isNaN(n)) return '—';
  return Number.isInteger(n) ? String(n) : n.toFixed(Math.abs(n) >= 10 ? 1 : 2).replace(/\.?0+$/, '');
}

export function labDate(d) { return d === ymd() ? t('დღეს', 'Today') : fmtDate(d, { year: true }); }

function sortPanels(panels) {
  return [...(panels || [])].filter((p) => p && p.date && Array.isArray(p.parameters))
    .sort((a, b) => b.date.localeCompare(a.date) || String(b.createdAt).localeCompare(String(a.createdAt)));
}

/** key → { key, name, nameEn, unit, points: [{date, panelId, param}] oldest first } */
function buildSeries(panels) {
  const map = new Map();
  for (const panel of [...panels].reverse()) {
    for (const p of panel.parameters) {
      const k = keyOf(p);
      if (!k) continue;
      const s = map.get(k) || { key: k, name: nameOf(p), nameEn: p.nameEn, unit: p.unit, points: [] };
      s.name = nameOf(p) || s.name;
      s.nameEn = p.nameEn || s.nameEn;
      s.unit = p.unit || s.unit;
      if (!s.points.some((x) => x.date === panel.date)) s.points.push({ date: panel.date, panelId: panel.id, param: p });
      map.set(k, s);
    }
  }
  for (const s of map.values()) {
    s.points.sort((a, b) => a.date.localeCompare(b.date));
    s.latest = s.points[s.points.length - 1];
  }
  return map;
}

function movers(series, limit = 3) {
  return [...series.values()].map((s) => {
    if (s.points.length < 2) return null;
    const prev = s.points[s.points.length - 2].param;
    const last = s.latest.param;
    if (prev.value === 0 && last.value === 0) return null;
    const pct = prev.value === 0 ? 100 : Math.round((Math.abs(last.value - prev.value) / Math.abs(prev.value)) * 100);
    if (pct < 1) return null;
    const ratio = prev.value === 0 ? 0 : last.value / prev.value;
    const up = last.value > prev.value;
    const change = ratio >= 10 ? `×${ratio.toFixed(1)}` : ratio > 0 && ratio <= 0.1 ? `×${ratio.toFixed(2)}` : `${up ? '+' : '−'}${pct}%`;
    return { s, prev, last, pct, up, change };
  }).filter(Boolean).sort((a, b) => b.pct - a.pct).slice(0, limit);
}

/** Draft question for Medi from the newest lab day (mobile labMediPrompt). Only prefills — nothing is sent. */
function mediPrompt(panels) {
  if (!panels.length) return null;
  const latest = panels[0].date;
  const rows = panels.filter((p) => p.date === latest).flatMap((p) => p.parameters);
  if (!rows.length) return null;
  const rank = (f) => (isOff(f) ? 0 : f === 'U' ? 1 : 2);
  const sorted = [...rows].sort((a, b) => rank(a.flag) - rank(b.flag));
  const shown = sorted.slice(0, 25);
  const word = t('ნორმა', 'range');
  const range = (p) => (p.refLow != null && p.refHigh != null ? ` (${word} ${p.refLow}–${p.refHigh})` : p.refHigh != null ? ` (${word} ≤${p.refHigh})` : p.refLow != null ? ` (${word} ≥${p.refLow})` : '');
  const lines = shown.map((p) => `• ${nameOf(p)}: ${p.display}${p.unit ? ` ${p.unit}` : ''}${range(p)} — ${FLAG_PROMPT[p.flag] || FLAG_PROMPT.U}`);
  const left = rows.length - shown.length;
  const more = left > 0 ? t(`\n…და კიდევ ${left} მაჩვენებელი.`, `\n…and ${left} more ${left === 1 ? 'value' : 'values'}.`) : '';
  return t(
    `გამიანალიზე ჩემი ლაბორატორიული შედეგები (${latest}).\n${lines.join('\n')}${more}\nრას ნიშნავს ეს ჩემთვის და რა უნდა ვკითხო ექიმს?`,
    `Please go over my lab results (${latest}).\n${lines.join('\n')}${more}\nWhat does this mean for me, and what should I ask my doctor?`,
  );
}

function askMedi(panels, navigate) {
  const text = mediPrompt(panels);
  try { if (text) sessionStorage.setItem(MEDI_PREFILL_KEY, JSON.stringify({ mode: 'doctor', text, at: Date.now() })); } catch { /* private mode */ }
  navigate('/medi?mode=doctor');
}

export function flagBadge(flag) { const f = FLAG[flag] || FLAG.U; return badge(f.label, f.tone); }

/* ── Trend chart with reference band ─────────────────────── */
function trendChart(points, { unit = '', height = 260 } = {}, observers) {
  const box = h('div', { class: 'chart lab-chart', style: { height: `${height}px` } });
  const tip = h('div', { class: 'chart-tip', hidden: true });
  box.appendChild(tip);
  const last = points[points.length - 1]?.param || {};
  const refLow = last.refLow ?? null;
  const refHigh = last.refHigh ?? null;
  const NS = 'http://www.w3.org/2000/svg';
  const s = (tag, attrs = {}) => { const el = document.createElementNS(NS, tag); for (const [k, v] of Object.entries(attrs)) if (v != null) el.setAttribute(k, String(v)); return el; };

  let lastW = 0;
  const draw = () => {
    const W = Math.round(box.clientWidth);
    if (!W || W === lastW) return;
    lastW = W;
    box.querySelector('svg')?.remove();
    const H = height;
    const pad = { l: 44, r: 16, t: 16, b: 28 };
    const iw = W - pad.l - pad.r;
    const ih = H - pad.t - pad.b;
    const vals = points.map((p) => p.param.value).filter((v) => Number.isFinite(v));
    const all = [...vals, refLow, refHigh].filter((v) => v != null && Number.isFinite(v));
    let lo = Math.min(...all);
    let hi = Math.max(...all);
    if (hi === lo) { hi += Math.abs(hi) * 0.2 || 1; lo -= Math.abs(lo) * 0.2 || 1; }
    const span = hi - lo;
    lo -= span * 0.15; hi += span * 0.15;
    if (lo < 0 && Math.min(...all) >= 0) lo = 0;
    const n = points.length;
    // Real time axis: spacing follows dates, not sample order.
    const t0 = parseDate(points[0].date).getTime();
    const t1 = parseDate(points[n - 1].date).getTime();
    const x = (i) => (n <= 1 || t1 === t0 ? pad.l + iw / 2 : pad.l + ((parseDate(points[i].date).getTime() - t0) / (t1 - t0)) * iw);
    const y = (v) => pad.t + ih - ((v - lo) / (hi - lo || 1)) * ih;
    const svg = s('svg', { width: W, height: H, viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': t('ტენდენციის გრაფიკი', 'Trend chart') });

    for (let k = 0; k <= 4; k++) {
      const v = lo + ((hi - lo) / 4) * k;
      svg.appendChild(s('line', { x1: pad.l, x2: W - pad.r, y1: y(v), y2: y(v), class: 'grid' }));
      const label = s('text', { x: pad.l - 8, y: y(v) + 4, class: 'axis', 'text-anchor': 'end' });
      label.textContent = num(v);
      svg.appendChild(label);
    }
    // Reference band (printed on the sheet) — both bounds = soft band, one bound = dashed line.
    if (refLow != null && refHigh != null) {
      svg.appendChild(s('rect', { x: pad.l, width: iw, y: y(refHigh), height: Math.max(1, y(refLow) - y(refHigh)), class: 'lab-band', rx: 6 }));
      for (const v of [refLow, refHigh]) svg.appendChild(s('line', { x1: pad.l, x2: W - pad.r, y1: y(v), y2: y(v), class: 'lab-band-edge' }));
    } else if (refLow != null || refHigh != null) {
      const v = refLow ?? refHigh;
      svg.appendChild(s('line', { x1: pad.l, x2: W - pad.r, y1: y(v), y2: y(v), class: 'goal' }));
      const label = s('text', { x: W - pad.r, y: y(v) - 6, class: 'goal-label', 'text-anchor': 'end' });
      label.textContent = refLow != null ? t(`ნორმა ≥ ${v}`, `Range ≥ ${v}`) : t(`ნორმა ≤ ${v}`, `Range ≤ ${v}`);
      svg.appendChild(label);
    }
    // X labels: first, last and a few in between (no overlap).
    const every = Math.max(1, Math.ceil(n / Math.max(2, Math.floor(iw / 78))));
    points.forEach((p, i) => {
      if (i % every !== 0 && i !== n - 1) return;
      if (i !== n - 1 && n > 1 && x(n - 1) - x(i) < 60) return;
      const d = parseDate(p.date);
      const label = s('text', { x: x(i), y: H - 8, class: 'axis', 'text-anchor': n === 1 ? 'middle' : i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle' });
      label.textContent = `${d.getDate()} ${KA_MONTHS_SHORT[d.getMonth()]}${d.getFullYear() !== new Date().getFullYear() ? ` ${String(d.getFullYear()).slice(2)}` : ''}`;
      svg.appendChild(label);
    });
    const pts = points.map((p, i) => [x(i), y(p.param.value)]);
    if (pts.length > 1) {
      const d = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0]},${p[1]}`).join(' ');
      const gid = `lg${Math.random().toString(36).slice(2, 8)}`;
      const defs = s('defs');
      const grad = s('linearGradient', { id: gid, x1: 0, x2: 0, y1: 0, y2: 1 });
      grad.append(s('stop', { offset: '0%', 'stop-color': 'var(--brand-2)', 'stop-opacity': 0.2 }), s('stop', { offset: '100%', 'stop-color': 'var(--brand-2)', 'stop-opacity': 0 }));
      defs.appendChild(grad);
      svg.appendChild(defs);
      svg.appendChild(s('path', { d: `${d} L${pts[pts.length - 1][0]},${pad.t + ih} L${pts[0][0]},${pad.t + ih} Z`, fill: `url(#${gid})` }));
      svg.appendChild(s('path', { d, fill: 'none', stroke: 'var(--brand-2)', 'stroke-width': 2.5, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', class: 'draw' }));
    }
    points.forEach((p, i) => {
      svg.appendChild(s('circle', { cx: pts[i][0], cy: pts[i][1], r: 4.5, class: `lab-dot ${isOff(p.param.flag) ? 'off' : p.param.flag === 'N' ? 'ok' : ''}` }));
    });
    const ring = s('circle', { r: 8, class: 'lab-dot-ring', opacity: 0 });
    svg.appendChild(ring);
    const hit = s('rect', { x: 0, y: 0, width: W, height: H, fill: 'transparent' });
    svg.appendChild(hit);
    const move = (ev) => {
      const r = svg.getBoundingClientRect();
      const px = (ev.touches ? ev.touches[0].clientX : ev.clientX) - r.left;
      let best = 0;
      pts.forEach((p, i) => { if (Math.abs(p[0] - px) < Math.abs(pts[best][0] - px)) best = i; });
      const p = points[best];
      ring.setAttribute('cx', pts[best][0]); ring.setAttribute('cy', pts[best][1]); ring.setAttribute('opacity', 1);
      clear(tip);
      tip.append(
        h('div', { class: 'tip-title' }, fmtDate(p.date, { year: true })),
        h('div', { class: 'tip-big' }, p.param.display || num(p.param.value), unit ? h('small', null, ` ${unit}`) : null),
        h('div', null, (FLAG[p.param.flag] || FLAG.U).label));
      tip.hidden = false;
      const tw = tip.offsetWidth;
      tip.style.left = `${Math.max(4, Math.min(W - tw - 4, pts[best][0] - tw / 2))}px`;
      tip.style.top = `${Math.max(0, pts[best][1] - tip.offsetHeight - 14)}px`;
    };
    const leave = () => { tip.hidden = true; ring.setAttribute('opacity', 0); };
    hit.addEventListener('mousemove', move);
    hit.addEventListener('touchstart', move, { passive: true });
    hit.addEventListener('touchmove', move, { passive: true });
    hit.addEventListener('mouseleave', leave);
    box.insertBefore(svg, tip);
  };
  const ro = new ResizeObserver(draw);
  ro.observe(box);
  observers?.push(ro);
  requestAnimationFrame(draw);
  return box;
}

/* ── Upload (shared with the records page) ─────────────────── */
function fileSize(b) { return b > 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1)} ${t('მბ', 'MB')}` : `${Math.max(1, Math.round(b / 1024))} ${t('კბ', 'KB')}`; }

export function dropzone({ multiple, accept, hint, onFiles }) {
  const inp = h('input', { type: 'file', accept, multiple, hidden: true, onChange: () => { onFiles([...inp.files]); inp.value = ''; } });
  const zone = h('div', {
    class: 'dropzone', role: 'button', tabindex: '0',
    onClick: () => inp.click(),
    onKeydown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); inp.click(); } },
    onDragover: (e) => { e.preventDefault(); zone.classList.add('over'); },
    onDragleave: () => zone.classList.remove('over'),
    onDrop: (e) => { e.preventDefault(); zone.classList.remove('over'); onFiles([...(e.dataTransfer?.files || [])]); },
  },
  h('div', { class: 'lab-drop-art' }, icon('upload', { size: 24 })),
  h('div', { class: 'lab-drop-title' }, t('ჩააგდე ფაილი აქ ან აირჩიე', 'Drop a file here or choose one')),
  h('div', { class: 'faint', style: { fontSize: '13px', marginTop: '4px' } }, hint),
  inp);
  return zone;
}

export function checkFile(f, { pdf = true } = {}) {
  const okType = /^image\/(jpeg|png|webp)$/.test(f.type) || (pdf && f.type === 'application/pdf');
  if (/heic|heif/i.test(f.type) || /\.hei[cf]$/i.test(f.name)) return t('iPhone-ის HEIC ფოტო ვერ წავიკითხეთ. ატვირთე სურათი JPEG ან PNG ფორმატში.', 'We couldn’t read the iPhone HEIC photo. Upload the image as JPEG or PNG.');
  if (!okType) return pdf ? t('დაშვებულია მხოლოდ JPG, PNG, WEBP ან PDF ფაილი.', 'Only JPG, PNG, WEBP or PDF files are allowed.') : t('დაშვებულია მხოლოდ JPG, PNG ან WEBP სურათი.', 'Only JPG, PNG or WEBP images are allowed.');
  if (f.size > MAX_BYTES) return t('ფაილი ძალიან დიდია. მაქსიმალური ზომაა 12 მეგაბაიტი.', 'The file is too large. The maximum size is 12 MB.');
  return null;
}

/**
 * Lab upload modal: pick pages (photos/PDF, ≤8), optional context, read & save.
 * onSaved({ date, count }) after the server stored the panel.
 */
export function openLabUpload({ onSaved, navigate } = {}) {
  let files = [];
  let running = false;
  let batch = null; // resume a partly read batch like the app (same files + context)
  const err = h('div', { class: 'form-error', hidden: true });
  // Declined / closed the AI disclosure: a calm note with „ხელახლა ცდა“, the picked pages stay.
  const declined = aiDeclinedSlot();
  const list = h('div', { class: 'lab-files' });
  const ctx = textarea({ placeholder: t('მაგ. ასაკი, სქესი, ჩივილები, მიმდინარე მკურნალობა', 'e.g. age, sex, symptoms, current treatment'), maxlength: 2000, rows: 3 });
  const stage = h('div', { class: 'lab-stage', hidden: true });
  const body = h('div', { class: 'stack', style: { gap: '16px' } });
  let submitBtn;

  const showErr = (m) => { err.textContent = m; err.hidden = !m; if (m) declined.hide(); };
  const renderFiles = () => {
    clear(list);
    files.forEach((f, i) => list.appendChild(h('div', { class: 'lab-file' },
      tile(f.type === 'application/pdf' ? 'file' : 'image', 'blue', 34),
      h('div', { class: 'row-main' }, h('div', { class: 'row-title' }, f.name), h('div', { class: 'row-sub' }, `${f.type === 'application/pdf' ? 'PDF' : t('სურათი', 'Image')} · ${fileSize(f.size)}`)),
      running ? h('span', { class: 'faint', style: { fontSize: '12.5px' } }, batch && i < batch.next ? t('მზადაა', 'Done') : t('რიგშია', 'Queued'))
        : iconButton('x', { title: t('მოშორება', 'Remove'), size: 18, onClick: () => { files.splice(i, 1); batch = null; renderFiles(); } }))));
    list.hidden = !files.length;
  };
  const addFiles = (picked) => {
    showErr('');
    for (const f of picked) {
      if (files.length >= MAX_FILES) { showErr(t(`ერთ კვლევაში მაქსიმუმ ${MAX_FILES} გვერდია.`, `A single test can have up to ${MAX_FILES} pages.`)); break; }
      const bad = checkFile(f);
      if (bad) { showErr(bad); continue; }
      files.push(f);
    }
    batch = null;
    renderFiles();
  };

  const pickView = () => mount(body,
    h('p', { class: 'muted', style: { fontSize: '14px' } }, t('შეგიძლია რამდენიმე გვერდი ერთად — ყველა ციფრი და ნორმა კარგად უნდა იკითხებოდეს.', 'You can add several pages at once — every number and range should be clearly readable.')),
    dropzone({ multiple: true, accept: ACCEPT, hint: t('JPG, PNG, WEBP ან PDF · 12 მბ-მდე · 8 გვერდამდე', 'JPG, PNG, WEBP or PDF · up to 12 MB · up to 8 pages'), onFiles: addFiles }),
    list,
    field(t('დამატებითი ინფორმაცია', 'Additional information'), ctx, t('არასავალდებულო', 'Optional')),
    stage,
    declined,
    err);

  const resultView = (res) => {
    const params = res.extract?.parameters || [];
    const off = params.filter((p) => isOff(p.flag)).length;
    let analysisBox = h('div', { class: 'lab-analysis' },
      h('p', { class: 'muted', style: { fontSize: '14px' } }, t('ეს ერთი კვლევაა. Medi ერთხელ ახსნის ყველა მაჩვენებელს.', 'This is one test. Medi will explain all of its values at once.')));
    const explainBtn = button(t('გაანალიზე Medi-სთან', 'Analyze with Medi'), { icon: 'sparkles', onClick: async () => {
      showErr('');
      declined.hide();
      await busy(explainBtn, async () => {
        try {
          const out = await explainPanel({ id: res.panelId, date: res.date, parameters: params, recordIds: res.recordId ? [res.recordId] : [], visionNotes: res.notes, createdAt: res.createdAt }, ctx.value.trim());
          if (!out) { declined.show(() => explainBtn.click()); return; }
          const fresh = h('div', { class: 'lab-analysis' }, markdown(out));
          analysisBox.replaceWith(fresh);
          analysisBox = fresh;
          explainBtn.remove();
          onSaved?.({ date: res.date, count: params.length });
        } catch (e) { showErr(e.message); }
      });
    } });
    mount(body,
      h('div', { class: 'lab-saved' }, tile('check', 'green', 40),
        h('div', null,
          h('div', { class: 'card-title' }, params.length ? t(`შენახულია ${labDate(res.date)} · ${params.length} მაჩვენებელი`, `Saved ${labDate(res.date)} · ${params.length} ${params.length === 1 ? 'value' : 'values'}`) : t('ფურცელი შენახულია', 'Sheet saved')),
          h('div', { class: 'card-sub' }, params.length ? (off ? t(`${off} მაჩვენებელი ნორმის გარეთაა`, `${off} ${off === 1 ? 'value is' : 'values are'} out of range`) : t('ყველა ამოკითხული მაჩვენებელი ნორმაშია', 'All values read are in range')) : t('მაჩვენებლები ვერ ამოვიკითხეთ — სცადე უფრო მკვეთრი ფოტო.', 'We couldn’t read any values — try a sharper photo.')))),
      params.length ? h('div', { class: 'lab-mini-table' }, params.slice(0, 40).map((p) => h('div', { class: 'lab-mini-row' },
        h('span', { class: 'lab-mini-name' }, nameOf(p)),
        h('span', { class: 'num' }, `${p.display} ${p.unit || ''}`.trim()),
        flagBadge(p.flag)))) : null,
      params.length ? analysisBox : null,
      params.length ? explainBtn : null,
      declined,
      err,
      h('p', { class: 'disclaimer' }, icon('info', { size: 15 }), DISCLAIMER));
  };

  const run = async () => {
    if (!files.length) { showErr(t('ჯერ აირჩიე ფაილი', 'Choose a file first')); return; }
    showErr('');
    declined.hide();
    const context = ctx.value.trim();
    const signature = JSON.stringify([files.map((f) => `${f.name}|${f.size}|${f.lastModified}`), context]);
    if (batch?.signature !== signature) batch = { signature, next: 0, last: null };
    const out = await withAiConsent(async () => {
      running = true;
      renderFiles();
      stage.hidden = false;
      for (let i = batch.next; i < files.length; i += 1) {
        mount(stage, h('span', { class: 'lab-spinner' }), h('span', null, files.length > 1 ? t(`ვკითხულობთ გვერდს ${i + 1} / ${files.length}`, `Reading page ${i + 1} / ${files.length}`) : t('ვკითხულობთ სურათს…', 'Reading the image…')));
        const fd = new FormData();
        fd.append('files', files[i], files[i].name);
        if (context) fd.append('context', context);
        if (batch.last?.record?.id) fd.append('recordId', batch.last.record.id);
        if (i > 0) fd.append('append', '1');
        batch.last = await request('/api/ai/extract-lab', { method: 'POST', body: fd, timeoutMs: 180_000 });
        batch.next = i + 1;
        renderFiles();
      }
      return batch.last;
    }).finally(() => { running = false; stage.hidden = true; renderFiles(); });
    if (out?.declined) { declined.show(() => submitBtn.click()); return; }
    if (!out) return;
    invalidate('/api/account');
    invalidate('/api/records');
    const extract = out.labExtract || { date: null, parameters: [] };
    const created = String(out.record?.createdAt || new Date().toISOString());
    const date = extract.date || created.slice(0, 10);
    const res = { extract, date, notes: out.notes, recordId: out.record?.id, createdAt: created, panelId: `lab-${date}-${out.record?.id || Date.now()}-web` };
    batch = null;
    onSaved?.({ date, count: extract.parameters?.length || 0 });
    resultView(res);
    submitBtn.hidden = true;
    doneBtn.hidden = false;
  };

  let doneBtn;
  pickView();
  renderFiles();
  openModal({
    title: t('ატვირთე ანალიზის ფოტოები ან PDF', 'Upload lab test photos or a PDF'),
    size: 'md',
    body,
    footer: (close) => {
      submitBtn = button(t('წაიკითხე და შეინახე', 'Read and save'), { icon: 'sparkles', onClick: () => busy(submitBtn, async () => { try { await run(); } catch (e) { showErr(e.message); } }) });
      doneBtn = button(t('ლაბორატორიაში ნახვა', 'View in Lab tests'), { variant: 'secondary', onClick: () => { close(); if (navigate && location.pathname !== '/app/lab') navigate('/lab'); } });
      doneBtn.hidden = true;
      return [button(t('დახურვა', 'Close'), { variant: 'ghost', onClick: () => close() }), submitBtn, doneBtn];
    },
  });
}

/** POST /api/ai/explain-lab (consent first), then store the write-up on the panel. Returns text or null. */
export async function explainPanel(panel, context) {
  const parameters = panel.parameters.slice(0, 80).map((p) => ({
    key: String(p.key || keyOf(p)).slice(0, 80),
    nameKa: String(p.nameKa || p.nameEn || p.key).slice(0, 160),
    nameEn: String(p.nameEn || '').slice(0, 160),
    display: String(p.display || num(p.value)).slice(0, 40) || '—',
    unit: String(p.unit || '').slice(0, 40),
    value: Number.isFinite(p.value) ? p.value : undefined,
    refLow: p.refLow ?? null,
    refHigh: p.refHigh ?? null,
    flag: FLAG[p.flag] ? p.flag : 'U',
  }));
  const res = await withAiConsent(() => request('/api/ai/explain-lab', {
    method: 'POST',
    timeoutMs: 150_000,
    body: {
      parameters,
      visionNotes: panel.visionNotes ? String(panel.visionNotes).slice(0, 40_000) : undefined,
      date: panel.date,
      context: context || undefined,
      recordId: panel.recordIds?.[0],
    },
  }));
  // null = declined / closed the disclosure (callers show the calm note); nothing was sent.
  if (!res || res.declined) return null;
  const analysis = String(res.analysis || '').trim();
  if (!analysis) throw new Error(t('Medi-მ დასკვნა ვერ დაასრულა. სცადე ხელახლა.', 'Medi couldn’t finish the review. Please try again.'));
  // Server merge keeps an existing write-up and fills an empty one — same as the app's push.
  await put('/api/account/app-state', {
    labPanels: [{ id: panel.id, date: panel.date, createdAt: panel.createdAt || `${panel.date}T00:00:00.000Z`, recordIds: panel.recordIds || [], analysis, parameters: panel.parameters }],
  }).catch(() => undefined);
  invalidate('/api/account');
  return analysis;
}

/* ── Page ─────────────────────────────────────────────── */
export default async function labPage(root, ctx) {
  ensureCss();
  const observers = [];
  const state = { panels: [], series: new Map(), selected: null, period: 'all', query: '', flag: 'all' };

  const uploadBtn = button(t('ატვირთვა', 'Upload'), { icon: 'upload', onClick: () => openLabUpload({ onSaved: () => reload(true), navigate: ctx.navigate }) });
  const body = h('div');
  mount(root, pageHead(wordmark('lab'), t('ანალიზების მაჩვენებლები თარიღებით, ნორმებით და ტენდენციებით', 'Lab values by date, with reference ranges and trends'),
    featureOn('records') ? button(t('ჩანაწერები', 'Records'), { variant: 'ghost', icon: 'folder', href: '/records' }) : null, uploadBtn), body);

  const reload = async (silent) => {
    if (!silent) mount(body, h('div', { class: 'stack' }, h('div', { class: 'stats-row' }, [0, 1, 2, 3].map(() => skeleton(2))), h('div', { class: 'lab-layout' }, skeleton(6), skeleton(8))));
    try {
      invalidate('/api/account/app-state');
      const { state: st } = await get('/api/account/app-state');
      state.panels = sortPanels(st?.labPanels);
      state.series = buildSeries(state.panels);
      if (!state.selected || !state.series.has(state.selected)) state.selected = pickDefault();
      render();
    } catch (e) {
      mount(body, errorBox(e, () => reload()));
    }
  };

  const pickDefault = () => {
    const latest = state.panels[0];
    if (!latest) return null;
    const ranked = [...latest.parameters].sort((a, b) => (isOff(b.flag) - isOff(a.flag)) || ((state.series.get(keyOf(b))?.points.length || 0) - (state.series.get(keyOf(a))?.points.length || 0)));
    return ranked[0] ? keyOf(ranked[0]) : null;
  };

  const render = () => {
    observers.splice(0).forEach((o) => o.disconnect());
    const { panels, series } = state;
    if (!panels.length) {
      mount(body, card({ class: 'pad-lg' }, empty(t('ჯერ ანალიზი არ არის', 'No lab tests yet'), t('ატვირთე ლაბორატორიის ფოტო ან PDF — მაჩვენებლები აქ შეინახება თარიღით, ნორმებით და გრაფიკებით.', 'Upload a photo or PDF of your lab results — the values are saved here with dates, reference ranges and charts.'),
        button(t('ანალიზის ატვირთვა', 'Upload a lab test'), { icon: 'upload', onClick: () => openLabUpload({ onSaved: () => reload(), navigate: ctx.navigate }) }))),
      h('p', { class: 'disclaimer' }, icon('info', { size: 15 }), DISCLAIMER));
      return;
    }
    const latest = panels[0];
    const offLatest = latest.parameters.filter((p) => isOff(p.flag)).length;

    const stats = h('div', { class: 'stats-row' },
      statCard('flask', 'blue', t('კვლევები', 'Tests'), String(panels.length), t(`${fmtDate(panels[panels.length - 1].date, { year: true })}-დან`, `Since ${fmtDate(panels[panels.length - 1].date, { year: true })}`)),
      statCard('activity', 'teal', t('მაჩვენებლები', 'Values'), String(series.size), t('სხვადასხვა სახეობა', 'Different types')),
      statCard('alert', offLatest ? 'rose' : 'green', t('საყურადღებო', 'To watch'), String(offLatest), offLatest ? t('ბოლო კვლევაში', 'In the latest test') : t('ბოლო კვლევაში ყველა ნორმაშია', 'All in range in the latest test'), offLatest ? 'danger' : ''),
      statCard('calendar', 'violet', t('ბოლო კვლევა', 'Latest test'), relDay(latest.date), t(`${latest.parameters.length} მაჩვენებელი`, `${latest.parameters.length} ${latest.parameters.length === 1 ? 'value' : 'values'}`)));

    const mediCard = !featureOn('medi') ? null : h('button', { class: 'card hover lab-medi', type: 'button', onClick: () => askMedi(panels, ctx.navigate) },
      tile('message', 'teal', 42),
      h('div', { class: 'row-main' },
        h('div', { class: 'card-title' }, t('ჰკითხე Medi-ს შედეგებზე', 'Ask Medi about your results')),
        h('div', { class: 'card-sub' }, t('ბოლო შედეგებს კითხვად მოვამზადებ — გაგზავნამდე ნახავ და შეცვლი.', 'I’ll turn your latest results into a question — you can review and edit it before sending.'))),
      icon('chevronRight', { size: 18, className: 'row-chev' }));

    const chartHost = h('div');
    const listHost = h('div');
    const layout = h('div', { class: 'lab-layout' },
      h('div', { class: 'lab-main' }, chartHost),
      h('aside', { class: 'lab-side' }, listHost));

    const mv = movers(series);
    const moversSec = mv.length ? section(t('რა შეიცვალა', 'What changed'), h('div', { class: 'grid grid-3' }, mv.map((m) =>
      h('button', { type: 'button', class: 'card hover lab-mover', onClick: () => select(m.s.key) },
        h('div', { class: 'between' }, h('div', { class: 'card-title lab-ellipsis' }, m.s.name), badge(m.change, isOff(m.last.flag) ? 'danger' : m.up ? 'brand' : 'neutral')),
        h('div', { class: 'lab-mover-vals' },
          h('span', { class: 'faint num' }, m.prev.display), icon('arrowRight', { size: 14, className: 'faint' }),
          h('strong', { class: 'num' }, m.last.display), h('span', { class: 'faint' }, m.s.unit || '')),
        spark(m.s.points.slice(-8).map((p) => p.param.value), isOff(m.last.flag) ? 'var(--danger)' : 'var(--brand-2)'))))) : null;

    const datesSec = section(t('კვლევები თარიღებით', 'Tests by date'), card({ class: 'flush' }, h('div', { class: 'list lab-dates' }, panels.map((p) => {
      const off = p.parameters.filter((x) => isOff(x.flag)).length;
      return h('button', { type: 'button', class: 'row row-link', onClick: () => openDate(p) },
        tile('flask', off ? 'rose' : 'blue', 38),
        h('div', { class: 'row-main' },
          h('div', { class: 'row-title' }, labDate(p.date)),
          h('div', { class: 'row-sub' }, off ? t(`${p.parameters.length} მაჩვენებელი · ${off} ყურადღება`, `${p.parameters.length} values · ${off} to watch`) : t(`${p.parameters.length} მაჩვენებელი`, `${p.parameters.length} ${p.parameters.length === 1 ? 'value' : 'values'}`))),
        h('div', { class: 'row-trail' }, p.analysis ? badge(t('Medi-ს დასკვნა', 'Medi’s review'), 'brand') : null, icon('chevronRight', { size: 18, className: 'row-chev' })));
    }))));

    mount(body,
      h('div', { class: 'stack', style: { gap: '16px', marginBottom: '28px' } }, stats, mediCard),
      layout,
      h('div', { class: 'lab-below' }, moversSec, datesSec),
      h('p', { class: 'disclaimer' }, icon('info', { size: 15 }), DISCLAIMER));

    renderChart(chartHost);
    renderList(listHost);
  };

  const select = (key) => {
    state.selected = key;
    const chartHost = body.querySelector('.lab-main');
    const listHost = body.querySelector('.lab-side');
    if (!chartHost || !listHost) return;
    observers.splice(0).forEach((o) => o.disconnect());
    renderChart(chartHost);
    renderList(listHost);
    const top = chartHost.getBoundingClientRect().top;
    if (top < 0 || top > window.innerHeight * 0.6) chartHost.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const renderChart = (host) => {
    const s = state.series.get(state.selected);
    if (!s) { mount(host, card(empty(t('აირჩიე მაჩვენებელი', 'Choose a value'), t('სიიდან აირჩიე მაჩვენებელი და აქ მისი ცვლილება გამოჩნდება.', 'Pick a value from the list to see how it changes here.')))); return; }
    const latest = s.latest.param;
    const prev = s.points.length > 1 ? s.points[s.points.length - 2].param : null;
    const norm = formatNorm(latest);
    const delta = prev ? latest.value - prev.value : null;
    const chartBox = h('div', { class: 'lab-chart-host' });
    const paintChart = () => {
      observers.splice(0).forEach((o) => o.disconnect());
      const days = { '6m': 183, '1y': 366 }[state.period];
      const cutoff = days ? ymd(new Date(Date.now() - days * 86400000)) : '';
      const list = s.points.filter((p) => p.date >= cutoff);
      mount(chartBox, list.length
        ? trendChart(list, { unit: s.unit }, observers)
        : h('div', { class: 'lab-chart-empty' }, t('ამ პერიოდში შედეგი არ არის.', 'No results in this period.')));
    };
    const legend = h('div', { class: 'legend' },
      latest.refLow != null && latest.refHigh != null ? h('span', null, h('i', { class: 'lab-legend-band' }), t('ფურცლის ნორმა', 'Sheet range')) : null,
      h('span', null, h('i', { style: { background: 'var(--brand-2)' } }), t('შენი შედეგი', 'Your result')),
      h('span', null, h('i', { style: { background: 'var(--danger)', borderRadius: '50%' } }), t('ნორმის გარეთ', 'Out of range')));

    mount(host, h('div', { class: 'stack', style: { gap: '16px' } },
      card({ class: 'pad-lg lab-chart-card' },
        h('div', { class: 'lab-chart-head' },
          h('div', { style: { minWidth: 0 } },
            h('h2', { class: 'lab-param-title' }, s.name),
            s.nameEn && s.nameEn !== s.name ? h('div', { class: 'faint', style: { fontSize: '13.5px', marginTop: '2px' } }, s.nameEn) : null),
          segmented([{ value: '6m', label: t('6 თვე', '6 months') }, { value: '1y', label: t('1 წელი', '1 year') }, { value: 'all', label: t('ყველა', 'All') }], state.period, (v) => { state.period = v; paintChart(); })),
        h('div', { class: 'lab-latest' },
          h('div', { class: 'lab-latest-val' }, h('strong', { class: 'num' }, latest.display || num(latest.value)), latest.unit ? h('span', null, latest.unit) : null),
          flagBadge(latest.flag),
          delta != null ? h('span', { class: `lab-delta ${delta === 0 ? '' : isOff(latest.flag) ? 'bad' : 'good'}` },
            icon(delta > 0 ? 'arrowUp' : delta < 0 ? 'arrowDown' : 'minus', { size: 14 }),
            t(`${delta > 0 ? '+' : ''}${num(delta)}${latest.unit ? ` ${latest.unit}` : ''} წინა კვლევასთან`, `${delta > 0 ? '+' : ''}${num(delta)}${latest.unit ? ` ${latest.unit}` : ''} vs. previous test`)) : null),
        chartBox,
        legend,
        s.points.length < 2 ? h('p', { class: 'faint', style: { fontSize: '13px', marginTop: '10px' } }, t('კიდევ ერთი ანალიზი საკმარისია ტენდენციისთვის.', 'One more test is enough to show a trend.')) : null),
      h('div', { class: 'grid grid-2' },
        card(h('div', { class: 'card-title', style: { marginBottom: '10px' } }, t('ბოლო შედეგი', 'Latest result')),
          h('div', { class: 'lab-meta' },
            metaRow(t('კვლევის თარიღი', 'Test date'), fmtDate(s.latest.date, { year: true })),
            norm ? metaRow(t('ფურცლის ნორმა', 'Sheet range'), norm) : metaRow(t('ფურცლის ნორმა', 'Sheet range'), t('არ არის მითითებული', 'Not given')),
            metaRow(t('გაზომვები', 'Results'), String(s.points.length))),
          h('p', { class: 'faint', style: { fontSize: '12px', marginTop: '10px', lineHeight: 1.5 } }, FLAG_NOTE)),
        card(h('div', { class: 'card-title', style: { marginBottom: '6px' } }, t('ისტორია თარიღებით', 'History by date')),
          h('div', { class: 'list lab-hist' }, [...s.points].reverse().map((p) => h('button', { type: 'button', class: 'row row-link', onClick: () => { const panel = state.panels.find((x) => x.date === p.date); if (panel) openDate(panel); } },
            h('div', { class: 'row-main' }, h('div', { class: 'row-title' }, fmtDate(p.date, { year: true })), h('div', { class: 'row-sub num' }, `${p.param.display} ${p.param.unit || ''}`.trim())),
            flagBadge(p.param.flag))))))));
    paintChart();
  };

  const renderList = (host) => {
    const counts = { all: 0, watch: 0, H: 0, L: 0, N: 0 };
    const rows = [...state.series.values()].map((s) => {
      const f = s.latest.param.flag;
      counts.all += 1;
      if (isOff(f)) counts.watch += 1;
      if (counts[f] != null && f !== 'U') counts[f] += 1;
      return s;
    });
    const search = input({ type: 'search', placeholder: t('მაჩვენებლის ძიება…', 'Search values…'), value: state.query, 'aria-label': t('მაჩვენებლის ძიება', 'Search values') });
    const chips = h('div', { class: 'chips' });
    const listEl = h('div', { class: 'list lab-params' });
    const paintChips = () => mount(chips, [
      ['all', t('ყველა', 'All')], ['watch', t('საყურადღებო', 'To watch')], ['H', t('მაღალი', 'High')], ['L', t('დაბალი', 'Low')], ['N', t('ნორმა', 'Normal')],
    ].filter(([k]) => k === 'all' || counts[k] > 0).map(([k, label]) => h('button', {
      type: 'button', class: `chip ${state.flag === k ? 'on' : ''}`, 'aria-pressed': state.flag === k ? 'true' : 'false',
      onClick: () => { state.flag = k; paintChips(); paintRows(); },
    }, label, h('span', { class: 'lab-chip-n' }, String(counts[k])))));
    const paintRows = () => {
      const q = state.query.trim().toLowerCase();
      const flagWords = { H: 'მაღალი high', L: 'დაბალი low', N: 'ნორმა normal', U: 'უცნობი unknown' };
      const shown = rows.filter((s) => {
        const f = s.latest.param.flag;
        if (state.flag === 'watch' && !isOff(f)) return false;
        if (['H', 'L', 'N'].includes(state.flag) && f !== state.flag) return false;
        if (!q) return true;
        return `${s.name} ${s.nameEn || ''} ${s.key} ${s.unit || ''} ${flagWords[f] || ''}`.toLowerCase().includes(q);
      }).sort((a, b) => (isOff(b.latest.param.flag) - isOff(a.latest.param.flag)) || b.latest.date.localeCompare(a.latest.date) || a.name.localeCompare(b.name, 'ka'));
      mount(listEl, shown.length ? shown.map((s) => {
        const p = s.latest.param;
        return h('button', { type: 'button', class: `row row-link lab-param ${s.key === state.selected ? 'on' : ''}`, 'aria-current': s.key === state.selected ? 'true' : undefined, onClick: () => select(s.key) },
          h('span', { class: `lab-flag-dot f-${p.flag}` }),
          h('div', { class: 'row-main' },
            h('div', { class: 'row-title' }, s.name),
            h('div', { class: 'row-sub' }, `${relDay(s.latest.date)}${s.points.length > 1 ? t(` · ${s.points.length} გაზომვა`, ` · ${s.points.length} results`) : ''}`)),
          h('div', { class: 'lab-param-val' }, h('strong', { class: 'num' }, p.display || num(p.value)), h('span', null, p.unit || '')));
      }) : h('p', { class: 'faint', style: { padding: '18px 8px', fontSize: '14px' } }, state.flag === 'watch' && !counts.watch ? t('საყურადღებო მაჩვენებელი არ არის — ყველა ნორმაშია', 'Nothing to watch — everything is in range') : t('ამ ფილტრში მაჩვენებელი არ არის', 'No values in this filter')));
    };
    search.addEventListener('input', debounce(() => { state.query = search.value; paintRows(); }, 150));
    paintChips();
    paintRows();
    mount(host, card({ class: 'lab-side-card' },
      h('div', { class: 'between', style: { marginBottom: '12px' } }, h('div', { class: 'card-title' }, t('მაჩვენებლები', 'Values')), h('span', { class: 'faint', style: { fontSize: '13px' } }, t(`${counts.all} სულ`, `${counts.all} total`))),
      search, h('div', { style: { height: '10px' } }), chips, h('div', { style: { height: '8px' } }), listEl));
  };

  const openDate = (panel) => {
    let flag = 'all';
    let q = '';
    const off = panel.parameters.filter((p) => isOff(p.flag)).length;
    const tableHost = h('div');
    const err = h('div', { class: 'form-error', hidden: true });
    const declined = aiDeclinedSlot();
    const analysisHost = h('div', { class: 'lab-analysis' });
    const paintAnalysis = () => {
      if (panel.analysis?.trim()) { mount(analysisHost, h('div', { class: 'lab-analysis-head' }, tile('sparkles', 'teal', 32), h('strong', null, t('Medi-ს დასკვნა', 'Medi’s review'))), markdown(panel.analysis)); return; }
      const btn = button(t('გაანალიზე Medi-სთან', 'Analyze with Medi'), { icon: 'sparkles', onClick: () => busy(btn, async () => {
        err.hidden = true;
        declined.hide();
        try {
          const text = await explainPanel(panel);
          if (!text) { declined.show(() => btn.click()); return; }
          panel.analysis = text;
          paintAnalysis();
          reload(true);
        } catch (e) { err.textContent = e.message; err.hidden = false; }
      }) });
      mount(analysisHost, h('p', { class: 'muted', style: { fontSize: '14px', marginBottom: '12px' } }, t('ეს ერთი კვლევაა. Medi ერთხელ ახსნის ყველა მაჩვენებელს.', 'This is one test. Medi will explain all of its values at once.')), btn, declined, err);
    };
    const paintTable = () => {
      const ql = q.trim().toLowerCase();
      const rows = panel.parameters.filter((p) => {
        if (flag === 'watch' && !isOff(p.flag)) return false;
        if (!ql) return true;
        return `${nameOf(p)} ${p.nameEn || ''} ${p.key}`.toLowerCase().includes(ql);
      });
      mount(tableHost, rows.length ? h('div', { class: 'table-wrap' }, h('table', { class: 'table lab-table' },
        h('thead', null, h('tr', null, h('th', null, t('მაჩვენებელი', 'Value')), h('th', null, t('შედეგი', 'Result')), h('th', { class: 'lab-hide-sm' }, t('ნორმა', 'Normal')), h('th', null, ''))),
        h('tbody', null, rows.map((p) => h('tr', { class: 'lab-tr', tabindex: '0', onClick: () => { m.close(); select(keyOf(p)); }, onKeydown: (e) => { if (e.key === 'Enter') { m.close(); select(keyOf(p)); } } },
          h('td', null, h('div', { style: { fontWeight: 600 } }, nameOf(p)), p.nameEn && p.nameEn !== nameOf(p) ? h('div', { class: 'faint', style: { fontSize: '12px' } }, p.nameEn) : null),
          h('td', { class: 'num', style: { whiteSpace: 'nowrap' } }, h('strong', null, p.display || num(p.value)), ` ${p.unit || ''}`),
          h('td', { class: 'lab-hide-sm faint num', style: { whiteSpace: 'nowrap' } }, formatNorm(p) || '—'),
          h('td', { style: { textAlign: 'right' } }, flagBadge(p.flag))))))) : h('p', { class: 'faint', style: { padding: '14px 4px' } }, t('ამ ფილტრში მაჩვენებელი არ არის', 'No values in this filter')));
    };
    const search = input({ type: 'search', placeholder: t('მაჩვენებლის ძიება…', 'Search values…'), 'aria-label': t('მაჩვენებლის ძიება', 'Search values') });
    search.addEventListener('input', debounce(() => { q = search.value; paintTable(); }, 120));
    paintAnalysis();
    paintTable();
    const m = openModal({
      title: labDate(panel.date),
      size: 'lg',
      body: h('div', { class: 'stack', style: { gap: '16px' } },
        h('p', { class: 'muted', style: { fontSize: '14px' } }, off ? t(`${panel.parameters.length} მაჩვენებელი · ${off} ნორმის გარეთ. დააჭირე მაჩვენებელს, რომ ნახო როგორ იცვლება.`, `${panel.parameters.length} values · ${off} out of range. Click a value to see how it changes.`) : t(`${panel.parameters.length} მაჩვენებელი. დააჭირე მაჩვენებელს, რომ ნახო როგორ იცვლება.`, `${panel.parameters.length} values. Click a value to see how it changes.`)),
        analysisHost,
        h('div', { class: 'lab-modal-filters' }, search,
          segmented([{ value: 'all', label: t('ყველა', 'All') }, { value: 'watch', label: t(`საყურადღებო · ${off}`, `To watch · ${off}`) }], flag, (v) => { flag = v; paintTable(); })),
        tableHost,
        panel.recordIds?.[0] ? h('a', { class: 'link', href: `/records/${panel.recordIds[0]}`, 'data-link': '', onClick: () => m.close() }, t('ორიგინალი ფურცელი ჩანაწერებში', 'Original sheet in your records'), icon('chevronRight', { size: 16 })) : null,
        h('p', { class: 'disclaimer', style: { marginTop: 0 } }, icon('info', { size: 15 }), DISCLAIMER)),
    });
  };

  await reload();
  if (ctx.query?.upload) openLabUpload({ onSaved: () => reload(), navigate: ctx.navigate });
  return () => observers.forEach((o) => o.disconnect());
}

function statCard(ic, ink, label, value, sub, tone = '') {
  return card({ class: 'kpi' },
    h('div', { class: 'hstack', style: { gap: '10px' } }, tile(ic, ink, 34), h('span', { class: 'stat-label' }, label)),
    h('div', { class: `stat-value ${tone === 'danger' ? 'lab-danger' : ''}` }, value),
    sub ? h('div', { class: 'stat-delta' }, sub) : null);
}

function spark(values, color) {
  const svg = sparkline(values, { width: 220, height: 36, color });
  svg.setAttribute('preserveAspectRatio', 'none');
  return svg;
}

function metaRow(label, value) {
  return h('div', { class: 'lab-meta-row' }, h('span', { class: 'faint' }, label), h('strong', null, value));
}

