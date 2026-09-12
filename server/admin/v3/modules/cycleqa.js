/**
 * MediCard Admin V3 — Cycle / QA phase board.
 * URL: #/cycleqa?family=overview|cycle|medi|home|admin&p=<folder>
 */
(function adminV3CycleQa(global) {
  const Shell = () => global.AdminV3Shell || {};
  const V = () => global.AdminV3 || {};
  const $ = (id) => document.getElementById(id);

  const FAMILIES = [
    ['overview', 'მიმოხილვა'],
    ['cycle', 'ციკლი'],
    ['medi', 'Medi'],
    ['home', 'სახლი'],
    ['admin', 'ადმინი'],
  ];
  const FAMILY_KEYS = new Set(FAMILIES.map(([k]) => k));

  let boardCache = null;
  let boardAt = 0;
  const blobUrls = new Set();
  const CACHE_MS = 20_000;

  function esc(v) {
    if (typeof opsEscape === 'function') return opsEscape(v);
    if (typeof escapeHtml === 'function') return escapeHtml(v);
    return String(v ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;');
  }
  function fmt(n) {
    if (typeof opsFmt === 'function') return opsFmt(n);
    const v = Number(n);
    if (!Number.isFinite(v)) return n == null ? '—' : String(n);
    return v.toLocaleString('ka-GE');
  }
  function ico(name) {
    return typeof icon === 'function' ? icon(name) : '';
  }
  function helpBtn(key) {
    return V().infoButton ? V().infoButton(key) : '';
  }
  function apiBase() {
    return typeof API === 'string' ? API : '';
  }

  function params() {
    return Shell().hashParams ? Shell().hashParams() : new URLSearchParams((location.hash || '').split('?')[1] || '');
  }
  function familyFromHash() {
    const f = params().get('family') || 'overview';
    return FAMILY_KEYS.has(f) ? f : 'overview';
  }
  function phaseFromHash() {
    return params().get('p') || '';
  }
  function go(updates) {
    Shell().writeModuleHash?.('cycleqa', updates);
    void renderCycleQa();
  }

  function forgetBlobs() {
    blobUrls.forEach((u) => URL.revokeObjectURL(u));
    blobUrls.clear();
  }

  async function loadBoard(force) {
    if (!force && boardCache && Date.now() - boardAt < CACHE_MS) return boardCache;
    boardCache = await api('/cycle-qa');
    boardAt = Date.now();
    return boardCache;
  }

  async function fetchFile(folder, file) {
    const res = await fetch(
      `${apiBase()}/api/admin/cycle-qa/file/${encodeURIComponent(folder)}/${encodeURIComponent(file)}`,
      { headers: state.token ? { Authorization: `Bearer ${state.token}` } : {} },
    );
    if (!res.ok) throw new Error('ფაილი ვერ ჩაიტვირთა.');
    return res;
  }

  async function blobUrl(folder, file) {
    const res = await fetchFile(folder, file);
    const url = URL.createObjectURL(await res.blob());
    blobUrls.add(url);
    return url;
  }

  function statusTone(status) {
    if (/FINAL-FROZEN/i.test(status || '')) return 'ok';
    if (/FROZEN/i.test(status || '')) return 'ok';
    if (/PARTIAL|UNKNOWN/i.test(status || '')) return 'warn';
    return '';
  }

  function statusBadge(p) {
    const Av = V();
    const tone = p.iosDeferred && p.screenshotCount < 8 ? 'warn' : statusTone(p.status) || 'neutral';
    const label = p.current ? 'ახლა · გაყინული' : (p.status || '—');
    return Av.statusBadge
      ? Av.statusBadge(tone, { label, tone })
      : `<span class="v3-badge is-${tone}">${esc(label)}</span>`;
  }

  function kpiCell(icoName, label, value, hint, tone) {
    const toneClass =
      tone === 'warn' ? ' is-amber' : tone === 'ok' ? ' is-ok' : tone === 'soft' ? ' is-soft' : '';
    return `<article class="v3-cycleqa-kpi${toneClass}">
      <span class="v3-cycleqa-kpi-ico" aria-hidden="true">${ico(icoName || 'layers')}</span>
      <div class="v3-cycleqa-kpi-copy">
        <span>${esc(label)}</span>
        <strong>${value}</strong>
        ${hint != null && hint !== '' ? `<em>${esc(hint)}</em>` : ''}
      </div>
    </article>`;
  }

  function toolsRow(board, extraLeft = '', opts = {}) {
    const when = String(board.generatedAt || '').slice(0, 16).replace('T', ' ');
    const meta = opts.meta === false
      ? ''
      : `<span class="v3-cycleqa-meta">qa/ · აპი ${esc(board.appVersion || '—')}${when ? ` · ${esc(when)}` : ''}</span>`;
    return `<div class="v3-cycleqa-tools">
      <div class="v3-cycleqa-tools-left">
        ${extraLeft}
        ${meta}
      </div>
      <div class="v3-cycleqa-tools-right">
        ${helpBtn('cycleqa.page')}
        <button type="button" class="btn ghost compact" id="cycleqa-refresh">${ico('refresh')} განახლება</button>
      </div>
    </div>`;
  }

  function redactJson(value, depth = 0) {
    if (value == null || depth > 6) return value;
    if (Array.isArray(value)) return value.slice(0, 20).map((v) => redactJson(v, depth + 1));
    if (typeof value !== 'object') return value;
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      if (/placeSample|plannedPlace|password|token|secret|email|phone/i.test(k)) continue;
      out[k] = redactJson(v, depth + 1);
    }
    return out;
  }

  function phaseRow(p, compact) {
    const ios = p.iosDeferred ? '<em class="v3-cycleqa-ios">iOS გადავადებული</em>' : '';
    const miss = p.missingFolder ? '<em class="v3-cycleqa-miss">qa საქაღალდე არ არის</em>' : '';
    const num = p.phase != null ? esc(String(p.phase)) : '·';
    return `<button type="button" class="v3-cycleqa-row${p.current ? ' is-current' : ''}${compact ? ' is-compact' : ''}" data-folder="${esc(p.folder)}" data-family="${esc(p.family)}">
      <span class="v3-cycleqa-row-num" aria-hidden="true">${num}</span>
      <span class="v3-cycleqa-row-copy">
        <strong>${esc(p.titleKa)}</strong>
        ${compact ? '' : `<span>${esc(p.summary)}</span>`}
      </span>
      <span class="v3-cycleqa-row-meta">
        ${statusBadge(p)}
        <span class="v3-cycleqa-row-stats">${esc(p.version || '—')} · ${fmt(p.screenshotCount)} კადრი</span>
        ${ios}${miss}
      </span>
    </button>`;
  }

  function bindRows(root) {
    root.querySelectorAll('[data-folder]').forEach((btn) => {
      btn.addEventListener('click', () => {
        go({ family: btn.getAttribute('data-family') || 'cycle', p: btn.getAttribute('data-folder') });
      });
    });
  }

  function overviewHtml(board) {
    const now = board.now;
    const recent = (board.phases || []).filter((p) => p.family === 'cycle').slice(0, 8);
    const fixes = (board.importantFixes || []).slice(0, 8);
    return `
      ${toolsRow(board)}
      <div class="v3-cycleqa-kpis" role="group" aria-label="ფაზების მდგომარეობა">
        ${kpiCell('layers', 'ფაზა', now?.phase != null ? String(now.phase) : '—', now?.titleKa || '', 'ok')}
        ${kpiCell('check', 'ვერსია', esc(board.kpis?.appVersion || '—'), 'mobile/app.json', 'ok')}
        ${kpiCell('shield', 'გაყინული', fmt(board.kpis?.frozenCount), `${fmt(board.kpis?.cyclePhaseCount)} Cycle`, 'ok')}
        ${kpiCell('activity', 'კადრები', fmt(board.kpis?.screenshotCount), `${fmt(board.kpis?.iosDeferredCount)} iOS გადავადებული`, 'soft')}
      </div>

      <section class="v3-cycleqa-panel" data-v3-cycleqa="now">
        <div class="v3-cycleqa-head">
          <div class="v3-cycleqa-head-copy">
            <div class="v3-title-row"><h3>რა ხდება ახლა</h3>${helpBtn('cycleqa.now')}</div>
          </div>
          <button type="button" class="btn primary compact" data-folder="${esc(now?.folder || '')}" data-family="cycle">ფაზის დეტალი</button>
        </div>
        <div class="v3-cycleqa-now">
          <div class="v3-cycleqa-now-main">
            <strong>${esc(now ? `ფაზა ${now.phase} · ${now.titleKa}` : '—')}</strong>
            <p>${esc(now?.summary || '')}</p>
            ${(now?.notInScope || []).length ? `<div class="v3-cycleqa-chips">${now.notInScope.map((x) => `<span>${esc(x)}</span>`).join('')}</div>` : ''}
          </div>
          <ul class="v3-cycleqa-notes">${(board.notes || []).map((n) => `<li>${esc(n)}</li>`).join('')}</ul>
        </div>
      </section>

      <div class="v3-cycleqa-split">
        <section class="v3-cycleqa-panel">
          <div class="v3-cycleqa-head">
            <div class="v3-cycleqa-head-copy">
              <div class="v3-title-row"><h3>მნიშვნელოვანი ფიქსები</h3>${helpBtn('cycleqa.fixes')}</div>
            </div>
          </div>
          ${fixes.length ? `<ul class="v3-cycleqa-fixes">${fixes.map((f) => `
            <li>
              <button type="button" class="v3-cycleqa-fix" data-folder="${esc(f.folder)}" data-family="cycle">
                <span class="v3-cycleqa-sev is-${esc(String(f.severity || '').toLowerCase())}">${esc(f.severity || '')}</span>
                <strong>${esc(f.title)}</strong>
                <span>${esc(f.detail || '')}</span>
                <em>ფაზა ${esc(String(f.phase ?? '—'))} · ${esc(f.titleKa || '')}</em>
              </button>
            </li>`).join('')}</ul>` : '<p class="v3-cycleqa-empty-line">ფიქსების სია ცარიელია.</p>'}
        </section>
        <section class="v3-cycleqa-panel">
          <div class="v3-cycleqa-head">
            <div class="v3-cycleqa-head-copy">
              <div class="v3-title-row"><h3>ბოლო Cycle ფაზები</h3></div>
            </div>
          </div>
          <div class="v3-cycleqa-list is-inset">${recent.map((p) => phaseRow(p, true)).join('')}</div>
        </section>
      </div>
    `;
  }

  function listHtml(board, family) {
    const rows = (board.phases || []).filter((p) => (family === 'overview' ? true : p.family === family));
    const search = `<label class="v3-cycleqa-search">
        <span class="sr-only">ძებნა</span>
        ${ico('search')}
        <input type="search" id="cycleqa-q" placeholder="ფაზა, სათაური, საქაღალდე…" autocomplete="off" />
      </label>
      <span class="v3-cycleqa-count">${fmt(rows.length)} ჩანაწერი</span>`;
    return `
      ${toolsRow(board, search, { meta: false })}
      <section class="v3-cycleqa-panel">
        <div class="v3-cycleqa-list is-inset" id="cycleqa-list">${rows.map((p) => phaseRow(p, false)).join('')}</div>
      </section>
    `;
  }

  function proofHtml(p) {
    const fw = p.proofs?.firewall;
    const brain = p.proofs?.brain;
    const bits = [];
    if (fw) {
      const rows = [
        ['Medi prompt', fw.aiPromptIncludesPlace],
        ['ექიმის შეჯამება', fw.doctorSummaryIncludesPlace],
        ['შეხსენება', fw.reminderHasPlaceField],
        ['Calendar location', fw.calendarHasLocation],
      ];
      bits.push(`<div class="v3-cycleqa-checks" aria-label="Leak firewall">
        ${rows.map(([label, on]) => `<span class="${on ? 'is-warn' : 'is-ok'}"><i aria-hidden="true">${on ? '!' : '✓'}</i>${esc(label)} · ${on ? 'კი' : 'არა'}</span>`).join('')}
      </div>`);
    }
    if (brain?.cases?.length) {
      bits.push(`<div class="v3-cycleqa-brain">${brain.cases.map((c) => `<span>${esc(c.id)} · ${esc(c.mode || '—')}</span>`).join('')}</div>`);
    }
    return bits.join('');
  }

  function detailHtml(p, board) {
    const shots = (p.screenshots || []).map((s, i) => `
      <button type="button" class="v3-cycleqa-shot" data-shot="${esc(s.file)}" data-label="${esc(s.label)}" data-idx="${i}">
        <span class="v3-cycleqa-shot-ph">იტვირთება…</span>
        <span>${esc(s.label)}</span>
      </button>`).join('');
    const arts = (p.artifacts || []).map((a) => `
      <button type="button" class="v3-cycleqa-art" data-art="${esc(a.file)}" data-kind="${esc(a.kind)}">
        ${ico('file')} ${esc(a.file)}
      </button>`).join('');
    const fixes = (p.fixes || []).map((f) => `
      <li class="v3-cycleqa-fix-static">
        <span class="v3-cycleqa-sev is-${esc(String(f.severity || '').toLowerCase())}">${esc(f.severity || '')}</span>
        <strong>${esc(f.title)}</strong>
        <span>${esc(f.detail || '')}</span>
      </li>`).join('');
    const left = `
      <button type="button" class="btn ghost compact" id="cycleqa-back">${ico('chevronLeft')} სიაში</button>
      ${p.contract ? `<button type="button" class="btn ghost compact" id="cycleqa-contract">${ico('file')} კონტრაქტი</button>` : ''}`;
    return `
      ${toolsRow(board, left)}
      <section class="v3-cycleqa-panel">
        <div class="v3-cycleqa-head">
          <div class="v3-cycleqa-head-copy">
            <p class="v3-cycleqa-kicker">${p.phase != null ? `ფაზა ${esc(String(p.phase))}` : esc(p.familyLabel || '')} · ${esc(p.version || '—')} · <span class="mono">${esc(p.folder)}</span></p>
            <div class="v3-title-row"><h3>${esc(p.titleKa)}</h3>${helpBtn('cycleqa.page')}</div>
          </div>
          ${statusBadge(p)}
        </div>
        <div class="v3-cycleqa-detail-body">
          <p class="v3-cycleqa-summary">${esc(p.summary)}</p>
          ${(p.notInScope || []).length ? `<div class="v3-cycleqa-chips">${p.notInScope.map((x) => `<span>${esc(x)}</span>`).join('')}</div>` : ''}
          ${p.iosDeferred ? `<p class="v3-cycleqa-ios-banner">iOS native QA გადავადებულია პროდუქტის გადაწყვეტილებით.${p.iosNote ? ` <span class="mono">${esc(p.iosNote.slice(0, 180))}</span>` : ''}</p>` : ''}
          ${fixes ? `<ul class="v3-cycleqa-fixes is-static">${fixes}</ul>` : ''}
          ${proofHtml(p)}
        </div>
      </section>
      <section class="v3-cycleqa-panel">
        <div class="v3-cycleqa-head">
          <div class="v3-cycleqa-head-copy">
            <div class="v3-title-row"><h3>Android კადრები</h3>${helpBtn('cycleqa.shots')}</div>
            <p>${fmt(p.screenshotCount)} კადრი · დააკლიკე გასადიდებლად</p>
          </div>
        </div>
        ${shots ? `<div class="v3-cycleqa-shots" id="cycleqa-shots">${shots}</div>` : '<p class="v3-cycleqa-empty-line">სქრინშოტი ამ საქაღალდეში არ არის.</p>'}
      </section>
      <section class="v3-cycleqa-panel">
        <div class="v3-cycleqa-head">
          <div class="v3-cycleqa-head-copy">
            <div class="v3-title-row"><h3>არტეფაქტები</h3></div>
          </div>
        </div>
        ${arts ? `<div class="v3-cycleqa-arts">${arts}</div>` : '<p class="v3-cycleqa-empty-line">ტექსტური არტეფაქტი არ არის.</p>'}
        <pre class="v3-cycleqa-pre hidden" id="cycleqa-art-view"></pre>
      </section>
    `;
  }

  function bindSearch(root) {
    const input = $('cycleqa-q');
    const list = $('cycleqa-list');
    if (!input || !list) return;
    input.addEventListener('input', () => {
      const q = input.value.trim().toLowerCase();
      list.querySelectorAll('.v3-cycleqa-row').forEach((row) => {
        const hay = row.textContent.toLowerCase();
        row.hidden = Boolean(q) && !hay.includes(q);
      });
    });
  }

  async function fillShots(p) {
    const root = $('cycleqa-shots');
    if (!root) return;
    const buttons = [...root.querySelectorAll('[data-shot]')];
    const items = new Array(buttons.length);
    await Promise.all(buttons.map(async (btn, i) => {
      try {
        const url = await blobUrl(p.folder, btn.getAttribute('data-shot'));
        const img = document.createElement('img');
        img.src = url;
        img.alt = btn.getAttribute('data-label') || btn.getAttribute('data-shot') || '';
        btn.querySelector('.v3-cycleqa-shot-ph')?.replaceWith(img);
        items[i] = { url, alt: img.alt };
        btn.addEventListener('click', () => {
          const packed = items.filter(Boolean);
          openLightbox(packed, Math.max(0, packed.indexOf(items[i])));
        });
      } catch {
        const ph = btn.querySelector('.v3-cycleqa-shot-ph');
        if (ph) ph.textContent = 'ვერ ჩაიტვირთა';
      }
    }));
  }

  function openLightbox(items, startIndex) {
    if (!items?.length) return;
    $('cycleqa-lightbox')?.remove();
    let index = Math.max(0, Math.min(startIndex, items.length - 1));
    let scale = 1;
    let panX = 0;
    let panY = 0;
    let dragging = false;
    let lastX = 0;
    let lastY = 0;

    document.body.insertAdjacentHTML('beforeend', `
      <div id="cycleqa-lightbox" class="v3-cycleqa-lightbox" role="dialog" aria-modal="true">
        <button type="button" class="v3-cycleqa-lightbox-scrim" data-close="1" aria-label="დახურვა"></button>
        <div class="v3-cycleqa-lb-bar">
          <div class="v3-cycleqa-lb-nav">
            <button type="button" class="v3-cycleqa-lb-btn" id="cycleqa-lb-prev" aria-label="წინა">${ico('chevronLeft')}</button>
            <span id="cycleqa-lb-count"></span>
            <button type="button" class="v3-cycleqa-lb-btn is-next" id="cycleqa-lb-next" aria-label="შემდეგი">${ico('chevronLeft')}</button>
          </div>
          <strong id="cycleqa-lb-caption"></strong>
          <div class="v3-cycleqa-lb-zoom">
            <button type="button" class="v3-cycleqa-lb-btn" id="cycleqa-lb-minus" aria-label="შეამცირე">−</button>
            <span id="cycleqa-lb-pct">100%</span>
            <button type="button" class="v3-cycleqa-lb-btn" id="cycleqa-lb-plus" aria-label="გაადიდე">+</button>
            <button type="button" class="v3-cycleqa-lb-btn is-text" id="cycleqa-lb-fit">მორგება</button>
            <button type="button" class="v3-cycleqa-lb-btn" data-close="1" aria-label="დახურვა">${ico('x')}</button>
          </div>
        </div>
        <div class="v3-cycleqa-lb-stage" id="cycleqa-lb-stage">
          <div class="v3-cycleqa-lb-frame" id="cycleqa-lb-frame">
            <img id="cycleqa-lb-img" alt="" />
          </div>
        </div>
      </div>`);

    const root = $('cycleqa-lightbox');
    const img = $('cycleqa-lb-img');
    const frame = $('cycleqa-lb-frame');
    const stage = $('cycleqa-lb-stage');
    const prev = $('cycleqa-lb-prev');
    const next = $('cycleqa-lb-next');
    document.body.classList.add('v3-cycleqa-lb-open');

    function paint() {
      if (frame) frame.style.transform = `translate(${panX}px, ${panY}px) scale(${scale})`;
      const pct = $('cycleqa-lb-pct');
      if (pct) pct.textContent = `${Math.round(scale * 100)}%`;
      stage?.classList.toggle('is-zoomed', scale > 1.02);
    }

    function resetView() {
      scale = 1;
      panX = 0;
      panY = 0;
      paint();
    }

    function zoomBy(factor, cx, cy) {
      const nextScale = Math.min(6, Math.max(1, scale * factor));
      if (stage && Number.isFinite(cx) && Number.isFinite(cy) && scale > 0) {
        const rect = stage.getBoundingClientRect();
        const ox = cx - rect.left - rect.width / 2;
        const oy = cy - rect.top - rect.height / 2;
        const k = nextScale / scale;
        panX = ox - (ox - panX) * k;
        panY = oy - (oy - panY) * k;
      }
      scale = nextScale;
      if (scale <= 1.02) {
        scale = 1;
        panX = 0;
        panY = 0;
      }
      paint();
    }

    function show(i) {
      index = (i + items.length) % items.length;
      const item = items[index];
      img.src = item.url;
      img.alt = item.alt || '';
      $('cycleqa-lb-caption').textContent = item.alt || '';
      $('cycleqa-lb-count').textContent = `${index + 1} / ${items.length}`;
      prev.disabled = items.length < 2;
      next.disabled = items.length < 2;
      resetView();
    }

    const close = () => {
      document.removeEventListener('keydown', onKey);
      document.body.classList.remove('v3-cycleqa-lb-open');
      root?.remove();
    };
    const onKey = (e) => {
      if (e.key === 'Escape') close();
      if (e.key === 'ArrowLeft') show(index - 1);
      if (e.key === 'ArrowRight') show(index + 1);
      if (e.key === '+' || e.key === '=') zoomBy(1.25);
      if (e.key === '-') zoomBy(0.8);
      if (e.key === '0') resetView();
    };
    document.addEventListener('keydown', onKey);

    root?.addEventListener('click', (e) => {
      if (e.target?.closest?.('[data-close]')) close();
    });
    prev?.addEventListener('click', () => show(index - 1));
    next?.addEventListener('click', () => show(index + 1));
    $('cycleqa-lb-plus')?.addEventListener('click', () => zoomBy(1.25));
    $('cycleqa-lb-minus')?.addEventListener('click', () => zoomBy(0.8));
    $('cycleqa-lb-fit')?.addEventListener('click', resetView);

    stage?.addEventListener('wheel', (e) => {
      e.preventDefault();
      zoomBy(e.deltaY > 0 ? 0.9 : 1.12, e.clientX, e.clientY);
    }, { passive: false });

    stage?.addEventListener('dblclick', (e) => {
      e.preventDefault();
      if (scale > 1.05) resetView();
      else zoomBy(2 / scale, e.clientX, e.clientY);
    });

    stage?.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      dragging = scale > 1.02;
      lastX = e.clientX;
      lastY = e.clientY;
      stage.setPointerCapture?.(e.pointerId);
    });
    stage?.addEventListener('pointermove', (e) => {
      if (!dragging) return;
      panX += e.clientX - lastX;
      panY += e.clientY - lastY;
      lastX = e.clientX;
      lastY = e.clientY;
      paint();
    });
    stage?.addEventListener('pointerup', () => { dragging = false; });
    stage?.addEventListener('pointercancel', () => { dragging = false; });

    show(index);
  }

  async function openArtifact(p, file, kind) {
    const view = $('cycleqa-art-view');
    if (!view) return;
    view.classList.remove('hidden');
    view.textContent = 'იტვირთება…';
    try {
      const res = await fetchFile(p.folder, file);
      if (kind === 'html') {
        const url = URL.createObjectURL(await res.blob());
        blobUrls.add(url);
        window.open(url, '_blank', 'noopener');
        view.textContent = `${file} გაიხსნა ახალ ჩანართში.`;
        return;
      }
      const text = await res.text();
      if (kind === 'json') {
        try {
          view.textContent = JSON.stringify(redactJson(JSON.parse(text)), null, 2).slice(0, 20_000);
        } catch {
          view.textContent = text.slice(0, 20_000);
        }
      } else {
        view.textContent = text.slice(0, 20_000);
      }
    } catch (err) {
      view.textContent = err.message || 'ვერ ჩაიტვირთა';
    }
  }

  async function openContract(file) {
    const host = $('cycleqa-art-view');
    if (!host) return;
    host.classList.remove('hidden');
    host.textContent = 'იტვირთება…';
    try {
      const data = await api(`/cycle-qa/contract/${encodeURIComponent(file)}`);
      host.textContent = data.markdown || '';
    } catch (err) {
      host.textContent = err.message || 'კონტრაქტი ვერ ჩაიტვირთა';
    }
  }

  async function renderCycleQa() {
    const root = $('tab-cycleqa');
    if (!root) return;
    const Sh = Shell();
    const Av = V();
    const family = familyFromHash();
    const folder = phaseFromHash();

    Sh.mountHeader?.({
      tab: 'cycleqa',
      kicker: 'Production',
      title: 'ფაზები',
      purpose: 'რა გაყინულია, როგორ მიდის QA და რა დაფიქსირდა თითო ფაზაზე.',
      helpKey: 'cycleqa.page',
    });

    root.classList.add('v3-workspace-wide', 'v3-module', 'v3-cycleqa');
    forgetBlobs();
    $('cycleqa-lightbox')?.remove();
    document.body.classList.remove('v3-cycleqa-lb-open');

    const nav = Sh.subnav ? Sh.subnav(FAMILIES, family, 'data-v3-family') : '';
    root.innerHTML = `<div class="v3-tab-shell v3-cycleqa-shell">${nav}
      <div class="v3-cycleqa-pane" id="cycleqa-body">${Av.skeleton ? Av.skeleton(6) : '<p class="muted">იტვირთება…</p>'}</div>
    </div>`;

    Sh.bindSubnav?.(root, 'data-v3-family', (key) => go({ family: key, p: '' }));

    try {
      const board = await loadBoard();
      const body = $('cycleqa-body');
      if (!body) return;
      const phase = folder ? (board.phases || []).find((p) => p.folder === folder) : null;

      body.innerHTML = `<div class="v3-cycleqa-body dash-enter">
          ${phase ? detailHtml(phase, board) : family === 'overview' ? overviewHtml(board) : listHtml(board, family)}
        </div>`;

      $('cycleqa-refresh')?.addEventListener('click', () => {
        boardCache = null;
        void renderCycleQa();
      });
      $('cycleqa-back')?.addEventListener('click', () => go({ family: phase?.family || family, p: '' }));
      $('cycleqa-contract')?.addEventListener('click', () => {
        const file = phase?.contract ? String(phase.contract).split('/').pop() : '';
        if (file) void openContract(file);
      });
      bindRows(body);
      bindSearch(body);
      body.querySelectorAll('[data-art]').forEach((btn) => {
        btn.addEventListener('click', () => void openArtifact(phase, btn.getAttribute('data-art'), btn.getAttribute('data-kind')));
      });
      if (phase) await fillShots(phase);
    } catch (err) {
      const body = $('cycleqa-body') || root;
      body.innerHTML = Av.errorState
        ? Av.errorState('ფაზების დაფა ვერ ჩაიტვირთა', err.message, 'cycleqa-retry')
        : `<div class="v3-cycleqa-empty is-err"><strong>ჩატვირთვა ვერ მოხერხდა</strong><p>${esc(err.message)}</p>
            <button type="button" class="btn ghost compact" id="cycleqa-retry">${ico('refresh')} ხელახლა სცადე</button></div>`;
      $('cycleqa-retry')?.addEventListener('click', () => {
        boardCache = null;
        void renderCycleQa();
      });
    }
  }

  global.renderCycleQa = renderCycleQa;
})(window);
