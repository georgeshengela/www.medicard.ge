// MEDICARD web — SVG charts. Responsive (ResizeObserver), themed by CSS variables, hover tooltips.
import { h } from './ui.js';

const NS = 'http://www.w3.org/2000/svg';
function s(tag, attrs = {}, ...kids) {
  const el = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) if (v !== undefined && v !== null) el.setAttribute(k, String(v));
  for (const k of kids.flat()) if (k) el.appendChild(typeof k === 'string' ? document.createTextNode(k) : k);
  return el;
}

let uid = 0;
const nextId = (p) => `${p}${++uid}`;

/** Wraps a render(width) → svg function so the chart follows its container width. */
function responsive(className, height, draw) {
  const box = h('div', { class: `chart ${className}`, style: { height: `${height}px` } });
  const tip = h('div', { class: 'chart-tip', hidden: true });
  box.appendChild(tip);
  let last = 0;
  const paint = () => {
    const w = Math.round(box.clientWidth);
    if (!w || w === last) return;
    last = w;
    box.querySelector('svg')?.remove();
    box.insertBefore(draw(w, height, tip, box), tip);
  };
  const ro = new ResizeObserver(paint);
  ro.observe(box);
  requestAnimationFrame(paint);
  return box;
}

function niceMax(v) {
  if (v <= 0) return 1;
  const exp = 10 ** Math.floor(Math.log10(v));
  const f = v / exp;
  const nice = f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10;
  return nice * exp;
}

function ticks(min, max, n = 4) {
  const step = (max - min) / n;
  return Array.from({ length: n + 1 }, (_, i) => min + step * i);
}

function fmtTick(v) {
  const a = Math.abs(v);
  if (a >= 10000) return `${Math.round(v / 1000)}k`;
  if (a >= 1000) return `${(v / 1000).toFixed(1).replace(/\.0$/, '')}k`;
  return Number.isInteger(v) ? String(v) : v.toFixed(1);
}

function showTip(tip, box, x, y, html) {
  tip.innerHTML = html;
  tip.hidden = false;
  const bw = box.clientWidth;
  const tw = tip.offsetWidth;
  tip.style.left = `${Math.max(4, Math.min(bw - tw - 4, x - tw / 2))}px`;
  tip.style.top = `${Math.max(0, y - tip.offsetHeight - 12)}px`;
}

const esc = (t) => String(t ?? '').replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));

/**
 * lineChart({ labels: [...], series: [{ name, values, color, area }], height, goal, goalLabel, unit, min, max, fmt })
 * values may contain null (gap).
 */
export function lineChart(opts) {
  const height = opts.height || 220;
  return responsive('chart-line', height, (W, H, tip, box) => {
    const pad = { l: 38, r: 12, t: 14, b: 26 };
    const iw = W - pad.l - pad.r;
    const ih = H - pad.t - pad.b;
    const all = opts.series.flatMap((x) => x.values).filter((v) => v !== null && v !== undefined && !Number.isNaN(v));
    if (opts.goal != null) all.push(opts.goal);
    let lo = opts.min ?? (all.length ? Math.min(...all) : 0);
    let hi = opts.max ?? (all.length ? Math.max(...all) : 1);
    if (opts.min === undefined && opts.zero !== false && lo > 0 && lo / (hi || 1) < 0.4) lo = 0;
    if (hi === lo) { hi += 1; lo = Math.max(0, lo - 1); }
    const span = hi - lo;
    if (opts.min === undefined && lo !== 0) lo = Math.floor((lo - span * 0.12) * 10) / 10;
    hi = opts.max ?? (lo === 0 ? niceMax(hi * 1.08) : Math.ceil((hi + span * 0.12) * 10) / 10);
    const n = opts.labels.length;
    const x = (i) => pad.l + (n <= 1 ? iw / 2 : (i / (n - 1)) * iw);
    const y = (v) => pad.t + ih - ((v - lo) / (hi - lo || 1)) * ih;
    const svg = s('svg', { width: W, height: H, viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': opts.ariaLabel || '' });
    const defs = s('defs');
    svg.appendChild(defs);

    for (const t of ticks(lo, hi, 4)) {
      svg.appendChild(s('line', { x1: pad.l, x2: W - pad.r, y1: y(t), y2: y(t), class: 'grid' }));
      svg.appendChild(s('text', { x: pad.l - 8, y: y(t) + 4, class: 'axis', 'text-anchor': 'end' }, fmtTick(t)));
    }
    const every = Math.max(1, Math.ceil(n / Math.max(2, Math.floor(iw / 64))));
    opts.labels.forEach((lb, i) => {
      if (i % every !== 0 && i !== n - 1) return;
      svg.appendChild(s('text', { x: x(i), y: H - 6, class: 'axis', 'text-anchor': i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle' }, lb));
    });

    if (opts.goal != null) {
      svg.appendChild(s('line', { x1: pad.l, x2: W - pad.r, y1: y(opts.goal), y2: y(opts.goal), class: 'goal' }));
      if (opts.goalLabel) svg.appendChild(s('text', { x: W - pad.r, y: y(opts.goal) - 6, class: 'goal-label', 'text-anchor': 'end' }, opts.goalLabel));
    }

    opts.series.forEach((ser, si) => {
      const color = ser.color || `var(--c${si + 1})`;
      const segs = [];
      let cur = [];
      ser.values.forEach((v, i) => {
        if (v === null || v === undefined || Number.isNaN(v)) { if (cur.length) segs.push(cur); cur = []; } else cur.push([x(i), y(v)]);
      });
      if (cur.length) segs.push(cur);
      const gid = nextId('g');
      if (ser.area !== false) {
        defs.appendChild(s('linearGradient', { id: gid, x1: 0, x2: 0, y1: 0, y2: 1 },
          s('stop', { offset: '0%', 'stop-color': color, 'stop-opacity': 0.22 }),
          s('stop', { offset: '100%', 'stop-color': color, 'stop-opacity': 0 })));
      }
      for (const seg of segs) {
        const d = smooth(seg);
        if (ser.area !== false && seg.length > 1) {
          svg.appendChild(s('path', { d: `${d} L${seg[seg.length - 1][0]},${pad.t + ih} L${seg[0][0]},${pad.t + ih} Z`, fill: `url(#${gid})` }));
        }
        const line = s('path', { d, fill: 'none', stroke: color, 'stroke-width': ser.width || 2.5, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', class: 'draw', 'stroke-dasharray': ser.dashed ? '5 5' : undefined });
        svg.appendChild(line);
        if (seg.length === 1) svg.appendChild(s('circle', { cx: seg[0][0], cy: seg[0][1], r: 3.5, fill: color }));
      }
      if (ser.dots) ser.values.forEach((v, i) => { if (v != null) svg.appendChild(s('circle', { cx: x(i), cy: y(v), r: 3, fill: 'var(--surface)', stroke: color, 'stroke-width': 2 })); });
    });

    // Hover
    const guide = s('line', { y1: pad.t, y2: pad.t + ih, class: 'hover-guide', opacity: 0 });
    const dots = opts.series.map((ser, si) => s('circle', { r: 5, fill: ser.color || `var(--c${si + 1})`, stroke: 'var(--surface)', 'stroke-width': 2.5, opacity: 0 }));
    svg.appendChild(guide);
    dots.forEach((d) => svg.appendChild(d));
    const hit = s('rect', { x: pad.l, y: 0, width: iw, height: H, fill: 'transparent' });
    svg.appendChild(hit);
    const move = (ev) => {
      const r = svg.getBoundingClientRect();
      const px = (ev.touches ? ev.touches[0].clientX : ev.clientX) - r.left;
      const i = Math.max(0, Math.min(n - 1, Math.round(((px - pad.l) / (iw || 1)) * (n - 1))));
      guide.setAttribute('x1', x(i)); guide.setAttribute('x2', x(i)); guide.setAttribute('opacity', 1);
      let topY = H;
      const rows = [];
      opts.series.forEach((ser, si) => {
        const v = ser.values[i];
        if (v == null) { dots[si].setAttribute('opacity', 0); return; }
        dots[si].setAttribute('cx', x(i)); dots[si].setAttribute('cy', y(v)); dots[si].setAttribute('opacity', 1);
        topY = Math.min(topY, y(v));
        rows.push(`<div class="tip-row"><i style="background:${ser.color || `var(--c${si + 1})`}"></i>${esc(ser.name || '')}<b>${esc(opts.fmt ? opts.fmt(v) : fmtTick(v))}${opts.unit ? ` ${esc(opts.unit)}` : ''}</b></div>`);
      });
      if (!rows.length) { tip.hidden = true; return; }
      showTip(tip, box, x(i), topY, `<div class="tip-title">${esc((opts.tipLabels || opts.labels)[i])}</div>${rows.join('')}`);
    };
    const leave = () => { tip.hidden = true; guide.setAttribute('opacity', 0); dots.forEach((d) => d.setAttribute('opacity', 0)); };
    hit.addEventListener('mousemove', move);
    hit.addEventListener('touchmove', move, { passive: true });
    hit.addEventListener('mouseleave', leave);
    return svg;
  });
}

function smooth(pts) {
  if (pts.length < 3) return pts.map((p, i) => `${i ? 'L' : 'M'}${p[0]},${p[1]}`).join(' ');
  let d = `M${pts[0][0]},${pts[0][1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] || p2;
    const t = 0.18;
    const c1 = [p1[0] + (p2[0] - p0[0]) * t, p1[1] + (p2[1] - p0[1]) * t];
    const c2 = [p2[0] - (p3[0] - p1[0]) * t, p2[1] - (p3[1] - p1[1]) * t];
    d += ` C${c1[0]},${c1[1]} ${c2[0]},${c2[1]} ${p2[0]},${p2[1]}`;
  }
  return d;
}

/**
 * barChart({ labels, values, height, goal, color, unit, highlightLast, stacked: [{name, values, color}] , fmt })
 */
export function barChart(opts) {
  const height = opts.height || 220;
  return responsive('chart-bar', height, (W, H, tip, box) => {
    const pad = { l: 38, r: 10, t: 14, b: 26 };
    const iw = W - pad.l - pad.r;
    const ih = H - pad.t - pad.b;
    const stacks = opts.stacked || [{ name: opts.name || '', values: opts.values, color: opts.color }];
    const n = opts.labels.length;
    const totals = Array.from({ length: n }, (_, i) => stacks.reduce((a, st) => a + (Number(st.values[i]) || 0), 0));
    const hi = niceMax(Math.max(opts.goal || 0, ...totals, 1) * 1.08);
    const y = (v) => pad.t + ih - (v / hi) * ih;
    const band = iw / Math.max(1, n);
    const bw = Math.max(3, Math.min(34, band * 0.62));
    const svg = s('svg', { width: W, height: H, viewBox: `0 0 ${W} ${H}` });
    for (const t of ticks(0, hi, 4)) {
      svg.appendChild(s('line', { x1: pad.l, x2: W - pad.r, y1: y(t), y2: y(t), class: 'grid' }));
      svg.appendChild(s('text', { x: pad.l - 8, y: y(t) + 4, class: 'axis', 'text-anchor': 'end' }, fmtTick(t)));
    }
    const every = Math.max(1, Math.ceil(n / Math.max(2, Math.floor(iw / 44))));
    const bars = [];
    for (let i = 0; i < n; i++) {
      const cx = pad.l + band * i + band / 2;
      let acc = 0;
      const g = s('g', { class: 'bar-g' });
      stacks.forEach((st, si) => {
        const v = Number(st.values[i]) || 0;
        if (v <= 0) return;
        const top = y(acc + v);
        const hgt = y(acc) - top;
        const last = si === stacks.length - 1 || stacks.slice(si + 1).every((x2) => !(Number(x2.values[i]) > 0));
        const color = st.color || (opts.highlightLast && i === n - 1 ? 'var(--brand)' : `var(--c${si + 1})`);
        const r = last ? Math.min(6, bw / 2, hgt) : 0;
        g.appendChild(s('path', { d: roundedTop(cx - bw / 2, top, bw, hgt, r), fill: color, class: 'bar', style: `animation-delay:${i * 18}ms` }));
        acc += v;
      });
      if (totals[i] <= 0) g.appendChild(s('rect', { x: cx - bw / 2, y: pad.t + ih - 3, width: bw, height: 3, rx: 1.5, class: 'bar-empty' }));
      svg.appendChild(g);
      bars.push({ cx, g });
      if (i % every === 0 || i === n - 1) svg.appendChild(s('text', { x: cx, y: H - 6, class: 'axis', 'text-anchor': 'middle' }, opts.labels[i]));
    }
    if (opts.goal) {
      svg.appendChild(s('line', { x1: pad.l, x2: W - pad.r, y1: y(opts.goal), y2: y(opts.goal), class: 'goal' }));
      if (opts.goalLabel) svg.appendChild(s('text', { x: W - pad.r, y: y(opts.goal) - 6, class: 'goal-label', 'text-anchor': 'end' }, opts.goalLabel));
    }
    const hit = s('rect', { x: pad.l, y: 0, width: iw, height: H, fill: 'transparent' });
    svg.appendChild(hit);
    const move = (ev) => {
      const r = svg.getBoundingClientRect();
      const px = (ev.touches ? ev.touches[0].clientX : ev.clientX) - r.left;
      const i = Math.max(0, Math.min(n - 1, Math.floor((px - pad.l) / band)));
      bars.forEach((b, j) => b.g.classList.toggle('dim', j !== i));
      const rows = stacks.length > 1
        ? stacks.map((st, si) => `<div class="tip-row"><i style="background:${st.color || `var(--c${si + 1})`}"></i>${esc(st.name)}<b>${esc(opts.fmt ? opts.fmt(Number(st.values[i]) || 0) : fmtTick(Number(st.values[i]) || 0))}</b></div>`).join('')
        : `<div class="tip-big">${esc(opts.fmt ? opts.fmt(totals[i]) : fmtTick(totals[i]))}${opts.unit ? ` <small>${esc(opts.unit)}</small>` : ''}</div>`;
      showTip(tip, box, bars[i].cx, y(totals[i]), `<div class="tip-title">${esc((opts.tipLabels || opts.labels)[i])}</div>${rows}`);
    };
    hit.addEventListener('mousemove', move);
    hit.addEventListener('touchmove', move, { passive: true });
    hit.addEventListener('mouseleave', () => { tip.hidden = true; bars.forEach((b) => b.g.classList.remove('dim')); });
    return svg;
  });
}

function roundedTop(x, y, w, hgt, r) {
  if (hgt <= 0) return '';
  r = Math.max(0, Math.min(r, w / 2, hgt));
  return `M${x},${y + hgt} L${x},${y + r} Q${x},${y} ${x + r},${y} L${x + w - r},${y} Q${x + w},${y} ${x + w},${y + r} L${x + w},${y + hgt} Z`;
}

/** ring({ value, max, size, stroke, color, label, sub }) — single progress ring with centred text. */
export function ring(opts) {
  const size = opts.size || 120;
  const sw = opts.stroke || Math.round(size * 0.1);
  const r = (size - sw) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(1, opts.max ? opts.value / opts.max : 0));
  const svg = s('svg', { width: size, height: size, viewBox: `0 0 ${size} ${size}`, class: 'ring-svg' },
    s('circle', { cx: size / 2, cy: size / 2, r, fill: 'none', stroke: opts.track || 'var(--track)', 'stroke-width': sw }),
    s('circle', {
      cx: size / 2, cy: size / 2, r, fill: 'none', stroke: opts.color || 'var(--brand)', 'stroke-width': sw,
      'stroke-linecap': 'round', 'stroke-dasharray': `${c} ${c}`, 'stroke-dashoffset': c,
      transform: `rotate(-90 ${size / 2} ${size / 2})`, class: 'ring-arc', style: `--to:${c * (1 - pct)}`,
    }));
  return h('div', { class: 'ring', style: { width: `${size}px`, height: `${size}px` } }, svg,
    h('div', { class: 'ring-center' },
      opts.label !== undefined ? h('strong', { style: { fontSize: `${Math.round(size * (opts.labelScale || 0.2))}px` } }, opts.label) : null,
      opts.sub ? h('span', null, opts.sub) : null));
}

/** Concentric rings (Apple-style day rings). rings: [{ value, max, color, name }] */
export function rings(list, opts = {}) {
  const size = opts.size || 150;
  const sw = opts.stroke || 13;
  const gap = opts.gap || 4;
  const svg = s('svg', { width: size, height: size, viewBox: `0 0 ${size} ${size}`, class: 'ring-svg' });
  list.forEach((rg, i) => {
    const r = size / 2 - sw / 2 - i * (sw + gap);
    if (r <= 4) return;
    const c = 2 * Math.PI * r;
    const pct = Math.max(0, Math.min(1, rg.max ? rg.value / rg.max : 0));
    svg.appendChild(s('circle', { cx: size / 2, cy: size / 2, r, fill: 'none', stroke: rg.color, 'stroke-opacity': 0.16, 'stroke-width': sw }));
    svg.appendChild(s('circle', {
      cx: size / 2, cy: size / 2, r, fill: 'none', stroke: rg.color, 'stroke-width': sw, 'stroke-linecap': 'round',
      'stroke-dasharray': `${c} ${c}`, 'stroke-dashoffset': c, transform: `rotate(-90 ${size / 2} ${size / 2})`,
      class: 'ring-arc', style: `--to:${c * (1 - pct)};animation-delay:${i * 120}ms`,
    }));
  });
  return h('div', { class: 'ring', style: { width: `${size}px`, height: `${size}px` } }, svg, opts.center ? h('div', { class: 'ring-center' }, opts.center) : null);
}

/** donut({ parts: [{ name, value, color }], size, stroke, center }) */
export function donut(opts) {
  const size = opts.size || 140;
  const sw = opts.stroke || 16;
  const r = (size - sw) / 2;
  const c = 2 * Math.PI * r;
  const total = opts.parts.reduce((a, p) => a + (Number(p.value) || 0), 0) || 1;
  const svg = s('svg', { width: size, height: size, viewBox: `0 0 ${size} ${size}`, class: 'ring-svg' },
    s('circle', { cx: size / 2, cy: size / 2, r, fill: 'none', stroke: 'var(--track)', 'stroke-width': sw }));
  let off = 0;
  const gapLen = opts.parts.filter((p) => p.value > 0).length > 1 ? 3 : 0;
  opts.parts.forEach((p) => {
    const len = (Math.max(0, p.value) / total) * c;
    if (len <= 0) return;
    svg.appendChild(s('circle', {
      cx: size / 2, cy: size / 2, r, fill: 'none', stroke: p.color, 'stroke-width': sw,
      'stroke-dasharray': `${Math.max(0, len - gapLen)} ${c}`, 'stroke-dashoffset': -off,
      transform: `rotate(-90 ${size / 2} ${size / 2})`, class: 'donut-seg',
    }));
    off += len;
  });
  return h('div', { class: 'ring', style: { width: `${size}px`, height: `${size}px` } }, svg, opts.center ? h('div', { class: 'ring-center' }, opts.center) : null);
}

/** sparkline(values, { width, height, color }) — tiny inline trend. */
export function sparkline(values, opts = {}) {
  const W = opts.width || 120;
  const H = opts.height || 36;
  const v = values.filter((x) => x != null);
  const svg = s('svg', { width: W, height: H, viewBox: `0 0 ${W} ${H}`, class: 'spark' });
  if (v.length < 2) return svg;
  const lo = Math.min(...v); const hi = Math.max(...v);
  const pts = [];
  values.forEach((x, i) => { if (x != null) pts.push([(i / (values.length - 1)) * (W - 4) + 2, H - 3 - ((x - lo) / (hi - lo || 1)) * (H - 6)]); });
  const color = opts.color || 'var(--brand)';
  const gid = nextId('sp');
  svg.appendChild(s('defs', {}, s('linearGradient', { id: gid, x1: 0, x2: 0, y1: 0, y2: 1 },
    s('stop', { offset: '0%', 'stop-color': color, 'stop-opacity': 0.25 }), s('stop', { offset: '100%', 'stop-color': color, 'stop-opacity': 0 }))));
  const d = smooth(pts);
  svg.appendChild(s('path', { d: `${d} L${pts[pts.length - 1][0]},${H} L${pts[0][0]},${H} Z`, fill: `url(#${gid})` }));
  svg.appendChild(s('path', { d, fill: 'none', stroke: color, 'stroke-width': 2, 'stroke-linecap': 'round' }));
  svg.appendChild(s('circle', { cx: pts[pts.length - 1][0], cy: pts[pts.length - 1][1], r: 3, fill: color }));
  return svg;
}

/**
 * heatmap({ days: [{ date:'YYYY-MM-DD', value, label? }], weeks: 12, max, color }) — GitHub-style.
 */
export function heatmap(opts) {
  const weeks = opts.weeks || 12;
  const cell = opts.cell || 14;
  const gap = 3;
  const map = new Map(opts.days.map((d) => [d.date, d]));
  const end = new Date(); end.setHours(0, 0, 0, 0);
  const start = new Date(end); start.setDate(end.getDate() - (weeks * 7 - 1) - ((end.getDay() + 6) % 7 === 6 ? 0 : 0));
  // Align start to Monday
  const dow = (start.getDay() + 6) % 7; start.setDate(start.getDate() - dow);
  const W = weeks * (cell + gap) + 2;
  const Hh = 7 * (cell + gap);
  const svg = s('svg', { width: W, height: Hh, viewBox: `0 0 ${W} ${Hh}`, class: 'heat' });
  const max = opts.max || Math.max(1, ...opts.days.map((d) => d.value || 0));
  const color = opts.color || 'var(--brand)';
  const wrap = h('div', { class: 'chart chart-heat' });
  const tip = h('div', { class: 'chart-tip', hidden: true });
  for (let w = 0; w <= weeks; w++) {
    for (let d = 0; d < 7; d++) {
      const date = new Date(start); date.setDate(start.getDate() + w * 7 + d);
      if (date > end) continue;
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
      const row = map.get(key);
      const v = row?.value || 0;
      const rect = s('rect', { x: w * (cell + gap), y: d * (cell + gap), width: cell, height: cell, rx: 4, fill: v > 0 ? color : 'var(--track)', 'fill-opacity': v > 0 ? 0.25 + 0.75 * Math.min(1, v / max) : 1 });
      rect.addEventListener('mouseenter', () => {
        const rr = rect.getBoundingClientRect(); const br = wrap.getBoundingClientRect();
        showTip(tip, wrap, rr.left - br.left + cell / 2, rr.top - br.top, `<div class="tip-title">${esc(row?.label || key)}</div><div class="tip-big">${esc(opts.fmt ? opts.fmt(v) : v)}</div>`);
      });
      rect.addEventListener('mouseleave', () => { tip.hidden = true; });
      svg.appendChild(rect);
    }
  }
  wrap.appendChild(svg);
  wrap.appendChild(tip);
  return wrap;
}

/** Horizontal meter list: [{ name, value, max, color, right }] */
export function meters(list) {
  return h('div', { class: 'meters' }, list.map((m) => h('div', { class: 'meter' },
    h('div', { class: 'meter-top' }, h('span', null, m.name), h('b', null, m.right ?? `${m.value}/${m.max}`)),
    h('div', { class: 'meter-track' }, h('span', { style: { width: `${Math.max(0, Math.min(100, (m.value / (m.max || 1)) * 100))}%`, background: m.color || 'var(--brand)' } })))));
}
