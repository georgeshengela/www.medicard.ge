/**
 * MediCard Admin V4 — chart engine.
 * Replaces the fixed-viewBox polylines with charts drawn at the real pixel width:
 * monotone curves, gradient area wash, clean nice ticks, Georgian date axis,
 * end-dot with surface ring, crosshair + tooltip on hover, keyboard scrubbing,
 * a visually-hidden data table, and redraw on resize / theme change.
 *
 * Series identity uses a validated categorical order (light + dark, CVD-checked):
 *   1 teal · 2 blue · 3 orange · 4 violet. Errors use the status red; a previous
 *   period ("ink"/"muted") is a dashed neutral line.
 *
 * Public API
 *   AdminCharts.line(seriesList, { label, height, sub })  → HTML string (hydrates itself)
 *   AdminCharts.spark(points, { tone })                   → HTML string
 * Overrides window.opsLineChart / window.opsSpark so every module picks it up.
 */
(function adminV4Charts(global) {
  const doc = document;
  const SERIES_SLOT = { teal: 1, blue: 2, amber: 3, orange: 3, green: 4, violet: 4 };
  const configs = new Map();
  let seq = 0;

  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmt = (n) => {
    const v = Number(n);
    if (!Number.isFinite(v)) return '—';
    if (Math.abs(v) >= 10000) return `${(v / 1000).toLocaleString('ka-GE', { maximumFractionDigits: 1 })}K`;
    return v.toLocaleString('ka-GE', { maximumFractionDigits: 1 });
  };
  const MONTHS = ['იან', 'თებ', 'მარ', 'აპრ', 'მაი', 'ივნ', 'ივლ', 'აგვ', 'სექ', 'ოქტ', 'ნოე', 'დეკ'];
  function dayLabel(day, long = false) {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(day || ''));
    if (!m) return String(day ?? '');
    const d = Number(m[3]);
    const mon = MONTHS[Number(m[2]) - 1] || m[2];
    return long ? `${d} ${mon}, ${m[1]}` : `${d} ${mon}`;
  }

  function toneKey(tone, idx) {
    if (tone === 'rose' || tone === 'red' || tone === 'bad') return 'bad';
    if (tone === 'ink' || tone === 'muted') return 'prev';
    return `s${SERIES_SLOT[tone] || ((idx % 4) + 1)}`;
  }

  /** Nice axis: 0 … niceMax in 3–5 steps; integer-only when data is integer. */
  function niceScale(max, integer) {
    if (max <= 0) return { max: integer ? 4 : 1, step: integer ? 1 : 0.25 };
    const rough = max / 4;
    const pow = 10 ** Math.floor(Math.log10(rough));
    const unit = [1, 2, 2.5, 5, 10].map((m) => m * pow).find((s) => s >= rough) || 10 * pow;
    let step = integer ? Math.max(1, Math.ceil(unit)) : unit;
    let top = Math.ceil(max / step) * step;
    if (top === max && max > 0 && top / step < 5) top += 0; // keep flush
    if (top / step > 5) { step *= 2; top = Math.ceil(max / step) * step; }
    return { max: top, step };
  }

  /** Fritsch–Carlson monotone cubic → SVG path (no overshoot below zero). */
  function monotonePath(pts) {
    const n = pts.length;
    if (!n) return '';
    if (n === 1) return `M${pts[0][0]},${pts[0][1]}`;
    const dx = [];
    const slope = [];
    for (let i = 0; i < n - 1; i += 1) {
      dx[i] = pts[i + 1][0] - pts[i][0];
      slope[i] = dx[i] ? (pts[i + 1][1] - pts[i][1]) / dx[i] : 0;
    }
    const m = [slope[0]];
    for (let i = 1; i < n - 1; i += 1) {
      m[i] = slope[i - 1] * slope[i] <= 0 ? 0 : (slope[i - 1] + slope[i]) / 2;
    }
    m[n - 1] = slope[n - 2];
    for (let i = 0; i < n - 1; i += 1) {
      if (slope[i] === 0) { m[i] = 0; m[i + 1] = 0; continue; }
      const a = m[i] / slope[i];
      const b = m[i + 1] / slope[i];
      const h = a * a + b * b;
      if (h > 9) {
        const t = 3 / Math.sqrt(h);
        m[i] = t * a * slope[i];
        m[i + 1] = t * b * slope[i];
      }
    }
    let d = `M${pts[0][0].toFixed(1)},${pts[0][1].toFixed(1)}`;
    for (let i = 0; i < n - 1; i += 1) {
      const c1x = pts[i][0] + dx[i] / 3;
      const c1y = pts[i][1] + (m[i] * dx[i]) / 3;
      const c2x = pts[i + 1][0] - dx[i] / 3;
      const c2y = pts[i + 1][1] - (m[i + 1] * dx[i]) / 3;
      d += ` C${c1x.toFixed(1)},${c1y.toFixed(1)} ${c2x.toFixed(1)},${c2y.toFixed(1)} ${pts[i + 1][0].toFixed(1)},${pts[i + 1][1].toFixed(1)}`;
    }
    return d;
  }

  function emptyHtml(text) {
    return `<div class="s-chart-empty"><svg viewBox="0 0 120 40" aria-hidden="true"><path d="M2 32 C 22 30, 30 14, 48 18 S 78 34, 96 16 S 112 8, 118 10" /></svg><strong>${esc(text || 'ამ პერიოდში მონაცემი არ არის')}</strong></div>`;
  }

  /* ─────────────── Line / area chart ─────────────── */
  function line(seriesList, opts = {}) {
    const series = (seriesList || [])
      .filter((s) => s && Array.isArray(s.points) && s.points.length)
      .map((s, idx) => ({ ...s, key: toneKey(s.tone, idx), label: s.label || '' }));
    if (!series.length || !series.some((s) => s.points.some((p) => Number(p.count) > 0))) {
      return `<figure class="s-chart is-empty">${opts.label && opts.showTitle ? `<figcaption class="s-chart-cap"><b>${esc(opts.label)}</b></figcaption>` : ''}${emptyHtml(opts.empty)}</figure>`;
    }
    const id = `sc${(seq += 1)}`;
    configs.set(id, { series, opts: { height: 220, ...opts } });
    const named = series.filter((s) => s.label);
    const legend = named.length >= 2 || (named.length === 1 && opts.legend)
      ? `<div class="s-chart-legend">${named.map((s) => {
        const last = s.points[s.points.length - 1];
        return `<span class="s-chart-key is-${s.key}"><i></i>${esc(s.label)}<b>${fmt(last?.count)}</b></span>`;
      }).join('')}</div>`
      : '';
    const head = opts.label && opts.showTitle !== false && (legend || opts.showTitle)
      ? `<figcaption class="s-chart-cap">${opts.showTitle ? `<b>${esc(opts.label)}</b>` : ''}${legend}</figcaption>`
      : (legend ? `<figcaption class="s-chart-cap">${legend}</figcaption>` : '');
    const table = `<table class="sr-only"><caption>${esc(opts.label || 'ტრენდი')}</caption><thead><tr><th>დღე</th>${series.map((s) => `<th>${esc(s.label || opts.label || 'მნიშვნელობა')}</th>`).join('')}</tr></thead><tbody>${series[0].points.map((p, i) => `<tr><td>${esc(p.day)}</td>${series.map((s) => `<td>${esc(s.points[i]?.count ?? '')}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
    return `<figure class="s-chart" data-s-chart="${id}">${head}<div class="s-chart-plot" style="height:${Number(opts.height) || 220}px" tabindex="0" role="img" aria-label="${esc(opts.label || 'ტრენდი')}"></div>${table}</figure>`;
  }

  function draw(fig) {
    const cfg = configs.get(fig.dataset.sChart);
    const plot = fig.querySelector('.s-chart-plot');
    if (!cfg || !plot) return;
    const width = Math.floor(plot.clientWidth);
    if (width < 40) return;
    if (plot.__w === width && plot.__theme === doc.documentElement.dataset.theme) return;
    plot.__w = width;
    plot.__theme = doc.documentElement.dataset.theme;
    const { series } = cfg;
    const height = plot.clientHeight || cfg.opts.height;
    const n = Math.max(...series.map((s) => s.points.length));
    const values = series.flatMap((s) => s.points.map((p) => Number(p.count) || 0));
    const integer = values.every((v) => Number.isInteger(v));
    const scale = niceScale(Math.max(...values), integer);
    const ticks = [];
    for (let v = 0; v <= scale.max + 1e-9; v += scale.step) ticks.push(v);
    const tickLen = Math.max(...ticks.map((t) => fmt(t).length));
    const padL = 10 + tickLen * 7;
    const padR = 14;
    const padT = 10;
    const padB = 26;
    const plotW = width - padL - padR;
    const plotH = height - padT - padB;
    const xAt = (i) => padL + (n > 1 ? (i / (n - 1)) * plotW : plotW / 2);
    const yAt = (v) => padT + plotH - ((Number(v) || 0) / scale.max) * plotH;
    const uid = fig.dataset.sChart;

    const grid = ticks.map((t) => {
      const y = yAt(t).toFixed(1);
      return `<line class="s-grid${t === 0 ? ' is-base' : ''}" x1="${padL}" x2="${width - padR}" y1="${y}" y2="${y}"/><text class="s-axis" x="${padL - 8}" y="${(+y + 4).toFixed(1)}" text-anchor="end">${fmt(t)}</text>`;
    }).join('');

    const labelsFit = Math.max(2, Math.floor(plotW / 72));
    const every = Math.max(1, Math.ceil(n / labelsFit));
    const days = series[0].points;
    const xLabels = days.map((p, i) => {
      if (i % every !== 0 && i !== n - 1) return '';
      if (i !== n - 1 && n - 1 - i < every * 0.6) return '';
      const anchor = i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle';
      return `<text class="s-axis" x="${xAt(i).toFixed(1)}" y="${height - 6}" text-anchor="${anchor}">${esc(dayLabel(p.day))}</text>`;
    }).join('');

    const defs = [];
    const bodies = [];
    series.forEach((s, idx) => {
      const pts = s.points.map((p, i) => [xAt(i), yAt(p.count)]);
      const d = monotonePath(pts);
      if (idx === 0 && s.key !== 'prev') {
        defs.push(`<linearGradient id="${uid}-g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" class="s-grad-top is-${s.key}"/><stop offset="1" class="s-grad-bot is-${s.key}"/></linearGradient>`);
        const base = (padT + plotH).toFixed(1);
        bodies.push(`<path class="s-area" fill="url(#${uid}-g)" d="${d} L${pts[pts.length - 1][0].toFixed(1)},${base} L${pts[0][0].toFixed(1)},${base} Z"/>`);
      }
      bodies.push(`<path class="s-line is-${s.key}" d="${d}"${s.key === 'prev' ? '' : ' pathLength="1"'}/>`);
      if (s.key !== 'prev') {
        const last = pts[pts.length - 1];
        bodies.push(`<circle class="s-end is-${s.key}" cx="${last[0].toFixed(1)}" cy="${last[1].toFixed(1)}" r="4"/>`);
      }
    });

    plot.innerHTML = `<svg class="s-chart-svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" aria-hidden="true">
      <defs>${defs.join('')}</defs>${grid}${bodies.join('')}${xLabels}
      <g class="s-cross" style="display:none"><line class="s-cross-line" y1="${padT}" y2="${padT + plotH}"/>${series.map((s) => `<circle class="s-cross-dot is-${s.key}" r="4.5"/>`).join('')}</g>
      <rect class="s-hit" x="${padL}" y="${padT}" width="${Math.max(1, plotW)}" height="${Math.max(1, plotH)}"/>
    </svg><div class="s-tip" hidden></div>`;
    if (!plot.__animated && !global.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      plot.__animated = true;
      plot.classList.add('is-enter');
      setTimeout(() => plot.classList.remove('is-enter'), 900);
    }

    const svg = plot.querySelector('svg');
    const cross = svg.querySelector('.s-cross');
    const crossLine = svg.querySelector('.s-cross-line');
    const dots = [...svg.querySelectorAll('.s-cross-dot')];
    const tip = plot.querySelector('.s-tip');
    let active = -1;
    const show = (i) => {
      if (i < 0 || i >= n) return;
      active = i;
      const x = xAt(i);
      cross.style.display = '';
      crossLine.setAttribute('x1', x);
      crossLine.setAttribute('x2', x);
      series.forEach((s, k) => {
        const p = s.points[i];
        dots[k].style.display = p ? '' : 'none';
        if (p) { dots[k].setAttribute('cx', x); dots[k].setAttribute('cy', yAt(p.count)); }
      });
      const day = days[i]?.day;
      tip.innerHTML = `<b>${esc(dayLabel(day, true))}</b>${series.map((s) => {
        const p = s.points[i];
        return `<span class="s-tip-row is-${s.key}"><i></i>${esc(s.label || cfg.opts.label || 'მნიშვნელობა')}<em>${fmt(p?.count)}</em></span>`;
      }).join('')}`;
      tip.hidden = false;
      const tw = tip.offsetWidth;
      const left = x + 14 + tw > width ? x - 14 - tw : x + 14;
      const topY = Math.min(...series.map((s) => yAt(s.points[i]?.count ?? 0)));
      tip.style.transform = `translate(${Math.max(0, left)}px, ${Math.max(0, Math.min(height - tip.offsetHeight - 4, topY - tip.offsetHeight / 2))}px)`;
    };
    const hide = () => { cross.style.display = 'none'; tip.hidden = true; active = -1; };
    const indexAt = (clientX) => {
      const r = svg.getBoundingClientRect();
      const rel = (clientX - r.left - padL) / Math.max(1, plotW);
      return Math.round(Math.min(1, Math.max(0, rel)) * (n - 1));
    };
    svg.addEventListener('pointermove', (e) => show(indexAt(e.clientX)));
    svg.addEventListener('pointerleave', hide);
    plot.onkeydown = (e) => {
      if (e.key === 'ArrowRight') { e.preventDefault(); show(Math.min(n - 1, active < 0 ? n - 1 : active + 1)); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); show(Math.max(0, active < 0 ? n - 1 : active - 1)); }
      else if (e.key === 'Escape') hide();
    };
    plot.onblur = hide;
  }

  /* ─────────────── Sparkline ─────────────── */
  function spark(points, opts = {}) {
    const rows = (points || []).slice(-24).map((p) => Number(p?.count ?? p) || 0);
    if (!rows.length || !rows.some((v) => v > 0)) return '<svg class="ops-spark s-spark is-flat" viewBox="0 0 96 28" aria-hidden="true"><line x1="2" x2="94" y1="25" y2="25"/></svg>';
    const w = 96;
    const h = 28;
    const max = Math.max(1, ...rows);
    const pts = rows.map((v, i) => [rows.length > 1 ? (i / (rows.length - 1)) * (w - 4) + 2 : w / 2, h - 3 - (v / max) * (h - 6)]);
    const d = monotonePath(pts);
    const key = toneKey(opts.tone || 'teal', 0);
    const gid = `sp${(seq += 1)}`;
    const last = pts[pts.length - 1];
    return `<svg class="ops-spark s-spark" viewBox="0 0 ${w} ${h}" aria-hidden="true"><defs><linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" class="s-grad-top is-${key}"/><stop offset="1" class="s-grad-bot is-${key}"/></linearGradient></defs><path class="s-area" fill="url(#${gid})" d="${d} L${last[0].toFixed(1)},${h} L${pts[0][0].toFixed(1)},${h} Z"/><path class="s-line is-${key}" d="${d}"/><circle class="s-end is-${key}" cx="${last[0].toFixed(1)}" cy="${last[1].toFixed(1)}" r="2.5"/></svg>`;
  }

  /* ─────────────── Hydration ─────────────── */
  const resize = typeof ResizeObserver === 'function'
    ? new ResizeObserver((entries) => entries.forEach((en) => { const fig = en.target.closest('[data-s-chart]'); if (fig) draw(fig); }))
    : null;
  function hydrate(root = doc) {
    root.querySelectorAll?.('[data-s-chart]:not([data-s-drawn])').forEach((fig) => {
      fig.dataset.sDrawn = '1';
      draw(fig);
      const plot = fig.querySelector('.s-chart-plot');
      if (resize && plot) resize.observe(plot);
    });
  }
  let pending = false;
  const mo = new MutationObserver(() => {
    if (pending) return;
    pending = true;
    requestAnimationFrame(() => { pending = false; hydrate(); });
  });
  function boot() {
    mo.observe(doc.body, { childList: true, subtree: true });
    new MutationObserver(() => doc.querySelectorAll('[data-s-chart][data-s-drawn]').forEach((fig) => {
      const plot = fig.querySelector('.s-chart-plot');
      if (plot) plot.__theme = null;
      draw(fig);
    })).observe(doc.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    hydrate();
  }

  global.AdminCharts = { line, spark, hydrate, dayLabel };
  global.opsLineChart = (seriesList, opts = {}) => line(seriesList, { ...opts, showTitle: false });
  global.opsSpark = (points) => spark(points);
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', boot); else boot();
})(window);
