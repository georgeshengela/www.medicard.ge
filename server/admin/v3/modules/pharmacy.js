/**
 * MediCard Admin V3 — Pharmacy price catalog (full override of renderPharmacy).
 * Source sync operations and coverage. URL range/grain are unused by pharmacy APIs.
 */
(function adminV3Pharmacy(global) {
  const Shell = () => global.AdminV3Shell || {};
  const V = () => global.AdminV3 || {};
  const $ = (id) => document.getElementById(id);

  const SOURCES = [
    { id: 'PHARMADEPOT', label: 'ფარმადეპო' },
    { id: 'PSP', label: 'PSP' },
    { id: 'GPC', label: 'ჯიპისი' },
  ];
  /** One name per source everywhere (cards, history, failures, toasts) — server lib/pharmacy/constants.js nameKa. */
  const SOURCE_KA = { PHARMADEPOT: 'ფარმადეპო', PSP: 'PSP', GPC: 'ჯიპისი', AVERSI: 'ავერსი', ALL: 'ყველა წყარო' };
  const RUN_STATUS = {
    DONE: ['დასრულდა', 'ok'],
    FAILED: ['ჩავარდა', 'bad'],
    RUNNING: ['მიმდინარეობს', 'info'],
  };
  /** Crawler errors are English (Playwright / fetch) — say what happened in Georgian, keep the raw text as a detail. */
  const SYNC_ERROR_KA = [
    [/stale run/i, 'შეწყდა — სერვერი სინქის დროს გადაიტვირთა'],
    [/timeout|timed out/i, 'აფთიაქის საიტი დროულად არ ჩაიტვირთა'],
    [/fetch failed|ECONN|ENOTFOUND|network|socket hang up/i, 'აფთიაქის საიტთან კავშირი ვერ დამყარდა'],
    [/unique constraint/i, 'ზოგი პროდუქტი დუბლიკატის გამო გამოტოვდა'],
    [/executable|chromium|browser/i, 'სერვერზე ბრაუზერი ვერ ჩაირთო'],
    [/\b40[13]\b|forbidden|captcha|blocked/i, 'საიტმა მოთხოვნა დაბლოკა'],
  ];

  let pollTimer = null;
  let logState = { status: 'ALL', offset: 0, limit: 40, allRuns: [] };

  function esc(v) {
    return typeof escapeHtml === 'function' ? escapeHtml(v) : String(v ?? '');
  }
  function fmt(n) {
    const v = Number(n);
    if (!Number.isFinite(v)) return '—';
    return v.toLocaleString('ka-GE');
  }
  function ico(name) {
    return typeof icon === 'function' ? icon(name) : '';
  }
  function helpBtn(key) {
    return V().infoButton ? V().infoButton(key) : '';
  }
  function toastMsg(msg, tone) {
    if (typeof toast === 'function') toast(msg, tone);
  }
  function when(iso) {
    if (!iso) return '—';
    return V().formatDate ? V().formatDate(iso, 'datetime') : String(iso);
  }
  function sourceLabel(id) {
    return SOURCE_KA[id] || id || '—';
  }
  function gel(value) {
    if (value == null || Number.isNaN(Number(value))) return '—';
    return `${Number(value).toFixed(2)} ₾`;
  }
  function durationSec(startedAt, finishedAt) {
    if (!startedAt) return null;
    const end = finishedAt ? new Date(finishedAt).getTime() : Date.now();
    return Math.max(0, Math.round((end - new Date(startedAt).getTime()) / 1000));
  }
  /** "45 წმ" · "8 წთ 12 წმ" · "1 სთ 5 წთ". */
  function syncDuration(startedAt, finishedAt) {
    const sec = durationSec(startedAt, finishedAt);
    if (sec == null) return '—';
    if (sec < 60) return `${sec} წმ`;
    if (sec < 3600) return `${Math.floor(sec / 60)} წთ ${sec % 60} წმ`;
    return `${Math.floor(sec / 3600)} სთ ${Math.floor((sec % 3600) / 60)} წთ`;
  }
  function syncError(err) {
    const raw = String(err || '').trim();
    if (!raw) return { ka: '', raw: '' };
    const skipped = /^(\d+) გამოტოვებული/.exec(raw);
    if (skipped) return { ka: `${skipped[1]} პროდუქტი გამოტოვდა`, raw };
    const m = /^(PSP|PHARMADEPOT|GPC|ALL|AVERSI):\s*([\s\S]*)$/.exec(raw);
    const prefix = m ? `${sourceLabel(m[1])}: ` : '';
    const hit = SYNC_ERROR_KA.find(([re]) => re.test(m ? m[2] : raw));
    return { ka: hit ? prefix + hit[1] : '', raw };
  }
  function errorHtml(err, maxRaw = 160) {
    const { ka, raw } = syncError(err);
    if (!raw) return '<span class="s-muted">—</span>';
    const short = raw.length > maxRaw ? `${raw.slice(0, maxRaw)}…` : raw;
    return `<span class="p2-err-text">${esc(ka || 'სინქი შეცდომით დასრულდა')}</span><small class="p2-raw" title="${esc(raw)}">${esc(short)}</small>`;
  }
  function runBadge(status) {
    const [label, tone] = RUN_STATUS[status] || [status || '—', ''];
    return `<span class="s-badge${tone ? ` is-${tone}` : ''}">${esc(label)}</span>`;
  }
  function panelVisible() {
    const panel = $('tab-pharmacy');
    return Boolean(panel) && !panel.classList.contains('hidden');
  }
  function clearPoll() {
    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
  }
  function startPoll() {
    clearPoll();
    pollTimer = setInterval(() => {
      if (!panelVisible()) {
        clearPoll();
        return;
      }
      if (!document.hidden) void renderPharmacyV3();
    }, 8000);
  }

  function sourceCard(src, catalog, sourceStatus, syncMeta) {
    const last = sourceStatus[src.id];
    const offers = catalog.offersBySource?.[src.id] || 0;
    const meta = syncMeta[src.id];
    const share = catalog.offers ? Math.round((offers / catalog.offers) * 100) : 0;
    const status = last?.status;
    const badge = status
      ? runBadge(status)
      : '<span class="s-badge">ჯერ არ გაშვებულა</span>';
    return `<article class="p2-source${status === 'FAILED' ? ' is-bad' : status === 'RUNNING' ? ' is-run' : ''}">
      <header><b>${esc(src.label)}</b>${badge}</header>
      <div class="p2-source-num"><strong>${fmt(offers)}</strong><span>შეთავაზება · ${share}% კატალოგის</span></div>
      <div class="s-meter"><i style="width:${Math.max(share, 2)}%"></i></div>
      <dl class="p2-source-facts">
        <div><dt>ბოლო წარმატებული სინქი</dt><dd>${meta ? esc(when(meta.finishedAt)) : 'ჯერ არ ყოფილა'}</dd></div>
        <div><dt>ბოლო გაშვება</dt><dd>${last ? `${last.itemsFetched != null ? `${fmt(last.itemsFetched)} ჩანაწერი · ` : ''}${esc(syncDuration(last.startedAt, last.finishedAt))}` : '—'}</dd></div>
      </dl>
      ${last?.error ? `<div class="p2-source-err">${errorHtml(last.error, 140)}</div>` : ''}
      ${status === 'FAILED'
        ? `<button type="button" class="btn compact v3-pharmacy-retry" data-source="${esc(src.id)}">${ico('refresh')} ხელახლა გაშვება</button>`
        : ''}
    </article>`;
  }

  function filteredRuns() {
    const runs = logState.allRuns || [];
    if (logState.status === 'ALL') return runs;
    return runs.filter((r) => r.status === logState.status);
  }

  function historyRowsHtml() {
    const all = filteredRuns();
    const runs = all.slice(logState.offset, logState.offset + logState.limit);
    if (!runs.length) {
      return `<tr><td colspan="6"><div class="s-empty p2-empty-sm">${ico('activity')}<span>${logState.status === 'ALL' ? 'სინქრონიზაციის ისტორია ჯერ არ არის' : 'ამ სტატუსით გაშვება არ არის'}</span></div></td></tr>`;
    }
    const longest = Math.max(60, ...runs.map((r) => durationSec(r.startedAt, r.finishedAt) || 0));
    return runs
      .map((r) => {
        const sec = durationSec(r.startedAt, r.finishedAt) || 0;
        return `<tr class="v3-pharmacy-run${r.status === 'RUNNING' ? ' is-running' : ''}">
          <td><b>${esc(sourceLabel(r.source))}</b></td>
          <td>${runBadge(r.status)}</td>
          <td class="num">${fmt(r.itemsFetched ?? 0)}</td>
          <td class="s-muted p2-nowrap">${esc(when(r.startedAt))}</td>
          <td><div class="p2-dur"><span>${esc(syncDuration(r.startedAt, r.finishedAt))}</span><div class="s-meter${r.status === 'FAILED' ? ' is-warn' : ''}"><i style="width:${Math.max(3, Math.round((sec / longest) * 100))}%"></i></div></div></td>
          <td class="p2-run-err">${r.error ? errorHtml(r.error, 90) : '<span class="s-muted">—</span>'}</td>
        </tr>`;
      })
      .join('');
  }

  function paintHistory() {
    const tbody = document.querySelector('#pharm-log-body');
    const meta = document.querySelector('#pharm-log-meta');
    const range = document.querySelector('#pharm-log-range');
    if (!tbody) return;
    const all = filteredRuns();
    const total = all.length;
    const loaded = (logState.allRuns || []).length;
    tbody.innerHTML = historyRowsHtml();
    if (meta) {
      meta.textContent = logState.status === 'ALL'
        ? `ბოლო ${fmt(loaded)} გაშვება${logState.serverTotal > loaded ? ` (სულ ${fmt(logState.serverTotal)})` : ''}`
        : `${fmt(total)} — „${(RUN_STATUS[logState.status] || [logState.status])[0]}“ ბოლო ${fmt(loaded)} გაშვებიდან`;
    }
    if (range) range.textContent = total ? `${fmt(logState.offset + 1)}–${fmt(Math.min(logState.offset + logState.limit, total))} / ${fmt(total)}` : '0';
    const prev = $('pharm-log-prev');
    const next = $('pharm-log-next');
    if (prev) prev.disabled = logState.offset <= 0;
    if (next) next.disabled = logState.offset + logState.limit >= total;
  }

  async function startSync(source, maxPages) {
    await api('/pharmacy/sync', {
      method: 'POST',
      body: { source, ...(maxPages ? { maxPages } : {}) },
    });
  }

  function confirmSync({ source, maxPages, title, onError }) {
    const open = V().openConfirm;
    if (!open) {
      toastMsg('დადასტურების ფანჯარა ვერ გაიხსნა — განაახლე გვერდი.', 'bad');
      return;
    }
    open({
      title,
      message: `${sourceLabel(source)}: ${maxPages ? `მაქსიმუმ ${maxPages} გვერდი` : 'სრული კატალოგი'}. სინქი რამდენიმე წუთს გრძელდება — გვერდი თავად განახლდება.`,
      confirmLabel: 'გაშვება',
      onConfirm: async () => {
        try {
          await startSync(source, maxPages);
          toastMsg(`${sourceLabel(source)} — სინქრონიზაცია დაიწყო`, 'ok');
          await renderPharmacyV3();
        } catch (err) {
          toastMsg(err.message || 'სინქი ვერ დაიწყო', 'bad');
          onError?.();
        }
      },
    });
  }

  async function renderPharmacyV3() {
    Shell().mountHeader?.({
      tab: 'pharmacy',
      kicker: 'Operations',
      title: 'ფარმაცია',
      purpose: 'აფთიაქების ფასები: წყაროების სინქი, დაფარვა და შეცდომები.',
      helpKey: 'pharmacy.page',
      actionsHtml: `<button type="button" class="btn ghost compact" id="pharm-refresh">${ico('refresh')} განახლება</button>`,
    });
    $('pharm-refresh')?.addEventListener('click', () => void renderPharmacyV3());

    const root = $('tab-pharmacy');
    if (!root) return;

    clearPoll();
    root.classList.add('v3-workspace-wide', 'v3-pharmacy');

    if (!root.querySelector('[data-v3-pharmacy="page"]')) {
      root.innerHTML = `<div class="s-stack v3-tab-shell p2-ops" data-v3-pharmacy="loading">${V().skeleton ? V().skeleton(6) : ''}</div>`;
    }

    let catalog;
    let syncMeta;
    let running;
    let sourceStatus;
    let recentFailures;
    let insights;
    let runs = [];
    let total = 0;
    try {
      const [stats, history] = await Promise.all([
        api('/pharmacy/stats'),
        api('/pharmacy/sync-runs?limit=80'),
      ]);
      catalog = stats.catalog || {};
      syncMeta = stats.syncMeta || {};
      running = stats.running;
      sourceStatus = stats.sourceStatus || {};
      recentFailures = stats.recentFailures || [];
      insights = stats.insights || { topDeals: [], tripleCompare: 0, inStockOffers: 0 };
      runs = history.runs || [];
      total = Number(history.total) || runs.length;
      logState.allRuns = runs;
      logState.serverTotal = total;
    } catch (e) {
      root.innerHTML = `<div class="s-stack v3-tab-shell p2-ops" data-v3-pharmacy="error">
        <div class="s-card"><div class="s-empty">${ico('alert')}<strong>ფარმაციის მონაცემები ვერ ჩაიტვირთა</strong><span>${esc(e.message || 'უცნობი შეცდომა')}</span>
          <button type="button" class="btn compact" id="pharm-retry">${ico('refresh')} ხელახლა ცდა</button></div></div>
      </div>`;
      $('pharm-retry')?.addEventListener('click', () => void renderPharmacyV3());
      return;
    }

    const comparedPct = catalog.products ? Math.round((catalog.comparedProducts / catalog.products) * 100) : 0;
    const triplePct = catalog.products ? Math.round((insights.tripleCompare / catalog.products) * 100) : 0;
    const stockPct = catalog.offers ? Math.round((insights.inStockOffers / catalog.offers) * 100) : 0;
    const topDeals = insights.topDeals || [];
    const prevSource = $('pharm-source')?.value;
    const prevPages = $('pharm-pages')?.value;
    const lastAll = syncMeta.ALL;

    const dealRows = topDeals.map((d, i) => {
      const name = String(d.name || '');
      const save = d.maxPriceGel != null && d.bestPriceGel != null ? Number(d.maxPriceGel) - Number(d.bestPriceGel) : null;
      return `<tr>
        <td class="p2-rank-no">${i + 1}</td>
        <td><div class="p2-two"><b title="${esc(name)}">${esc(name.length > 70 ? `${name.slice(0, 70)}…` : name)}</b><small>${fmt(d.offerCount)} აფთიაქი · საუკეთესო: ${esc(d.bestSource)}</small></div></td>
        <td class="num"><b>${esc(gel(d.bestPriceGel))}</b></td>
        <td class="num s-muted"><s>${esc(gel(d.maxPriceGel))}</s></td>
        <td class="num"><span class="s-badge is-ok">−${esc(d.savePct)}%</span>${save != null ? `<small class="p2-sub">${esc(save.toFixed(2))} ₾</small>` : ''}</td>
      </tr>`;
    }).join('');

    const failureRows = recentFailures.map((r) => `<div class="s-switch-row">
        <div><b>${esc(sourceLabel(r.source))}</b><small>${errorHtml(r.error, 140)}</small></div>
        <span class="p2-meta">${esc(when(r.startedAt))}</span>
      </div>`).join('');

    root.innerHTML = `
      <div class="s-stack v3-tab-shell p2-ops" data-v3-pharmacy="page">
        ${
          running
            ? `<div class="s-callout is-info p2-live" role="status">${ico('activity')}<p><b>სინქრონიზაცია მიმდინარეობს — ${esc(sourceLabel(running.source))}.</b> ${esc(syncDuration(running.startedAt, null))} · ${fmt(running.itemsFetched ?? 0)} ჩანაწერი. გვერდი თავად ახლდება.</p></div>`
            : ''
        }

        <div class="s-metrics" role="group" aria-label="კატალოგის მდგომარეობა">
          <div class="s-metric"><span>კატალოგი</span><strong>${fmt(catalog.products)}</strong><small>უნიკალური პროდუქტი</small></div>
          <div class="s-metric"><span>შეთავაზებები</span><strong>${fmt(catalog.offers)}</strong><small>${fmt(insights.inStockOffers)} მარაგშია · ${stockPct}%</small></div>
          <div class="s-metric${catalog.products && comparedPct < 40 ? ' is-warn' : ''}"><span>შედარებადი</span><strong>${fmt(catalog.comparedProducts)}</strong><small>2+ აფთიაქში · ${comparedPct}% კატალოგის</small></div>
          <div class="s-metric"><span>სრული შედარება</span><strong>${fmt(insights.tripleCompare)}</strong><small>3 აფთიაქში · ${triplePct}% კატალოგის</small></div>
        </div>

        <section class="s-card" data-v3-pharmacy="sources">
          <header class="s-card-head"><div><h3>აფთიაქები</h3><p>თითო აფთიაქის წილი კატალოგში, ბოლო სინქი და მდგომარეობა.</p></div></header>
          <div class="s-card-body"><div class="p2-sources">${SOURCES.map((src) => sourceCard(src, catalog, sourceStatus, syncMeta)).join('')}</div></div>
        </section>

        <div class="p2-split is-side-left">
          <section class="s-card" data-v3-pharmacy="sync">
            <header class="s-card-head"><div><h3>ხელით სინქრონიზაცია</h3><p>ჩვეულებრივ ავტომატურად ხდება — ხელით მხოლოდ საჭიროებისას.</p></div>${helpBtn('pharmacy.sync')}</header>
            <div class="s-card-body">
              <div class="s-stack p2-form p2-sync-form">
                <label class="s-field" for="pharm-source">
                  <span>წყარო</span>
                  <select id="pharm-source">
                    <option value="ALL">ყველა წყარო (PSP, ფარმადეპო, ჯიპისი)</option>
                    <option value="PHARMADEPOT">ფარმადეპო</option>
                    <option value="PSP">PSP</option>
                    <option value="GPC">ჯიპისი</option>
                  </select>
                </label>
                <label class="s-field" for="pharm-pages">
                  <span>მაქსიმუმ გვერდი</span>
                  <input id="pharm-pages" type="number" min="1" max="500" placeholder="სრული კატალოგი" />
                  <small>ცარიელი = სრული კატალოგი · სატესტოდ 1–500</small>
                </label>
                <button type="button" class="btn primary" id="pharm-sync" ${running ? 'disabled' : ''}>
                  ${ico('activity')} ${running ? 'სინქრონიზაცია მიმდინარეობს…' : 'სინქის გაშვება'}
                </button>
                <dl class="p2-facts">
                  <div><dt>ბოლო სრული სინქი</dt><dd>${lastAll ? esc(when(lastAll.finishedAt)) : '—'}</dd></div>
                  <div><dt>მაშინ ჩაიტვირთა</dt><dd>${lastAll?.itemsFetched != null ? `${fmt(lastAll.itemsFetched)} ჩანაწერი` : '—'}</dd></div>
                </dl>
                <p class="p2-note">სრული სინქი ≈ 30 წთ. პროდუქტები: PSP ~5 300 · ფარმადეპო ~3 300 · ჯიპისი ~3 300.</p>
              </div>
            </div>
          </section>

          <section class="s-card" data-v3-pharmacy="deals">
            <header class="s-card-head"><div><h3>ყველაზე დიდი დაზოგვა</h3><p>პროდუქტები, რომელთა ფასი აფთიაქებს შორის ყველაზე მეტად განსხვავდება.</p></div></header>
            <div class="s-card-body is-flush">
              ${
                topDeals.length
                  ? `<div class="s-table-wrap"><table class="s-table"><thead><tr><th>#</th><th>პროდუქტი</th><th class="num">საუკეთესო</th><th class="num">მაქს.</th><th class="num">დაზოგვა</th></tr></thead><tbody>${dealRows}</tbody></table></div>`
                  : `<div class="s-empty p2-empty-sm">${ico('pill')}<span>შედარება ჯერ არ არის — სინქის შემდეგ აქ გამოჩნდება.</span></div>`
              }
            </div>
          </section>
        </div>

        ${
          recentFailures.length
            ? `<section class="s-card" data-v3-pharmacy="failures">
                <header class="s-card-head"><div><h3>ბოლო შეცდომები</h3><p>ჩავარდნილი გაშვებები, ბოლო პირველი. ახლანდელ მდგომარეობას „აფთიაქები“ აჩვენებს.</p></div><span class="p2-meta">${fmt(recentFailures.length)}</span></header>
                <div class="s-card-body"><div class="p2-rows">${failureRows}</div></div>
              </section>`
            : ''
        }

        <section class="s-card" data-v3-pharmacy="history">
          <header class="s-card-head">
            <div><h3>სინქის ისტორია</h3><p id="pharm-log-meta"></p></div>
            <select id="pharm-filter-status" aria-label="სტატუსი" class="p2-select-sm">
              <option value="ALL"${logState.status === 'ALL' ? ' selected' : ''}>ყველა სტატუსი</option>
              <option value="DONE"${logState.status === 'DONE' ? ' selected' : ''}>დასრულდა</option>
              <option value="FAILED"${logState.status === 'FAILED' ? ' selected' : ''}>ჩავარდა</option>
              <option value="RUNNING"${logState.status === 'RUNNING' ? ' selected' : ''}>მიმდინარეობს</option>
            </select>
          </header>
          <div class="s-table-wrap">
            <table class="s-table">
              <thead>
                <tr>
                  <th>წყარო</th>
                  <th>სტატუსი</th>
                  <th class="num">ჩატვირთული</th>
                  <th>დაწყება</th>
                  <th>ხანგრძლივობა</th>
                  <th>შეცდომა</th>
                </tr>
              </thead>
              <tbody id="pharm-log-body"></tbody>
            </table>
          </div>
          <div class="s-pager">
            <span id="pharm-log-range"></span>
            <div>
              <button type="button" class="btn ghost compact" id="pharm-log-prev" disabled>წინა</button>
              <button type="button" class="btn ghost compact" id="pharm-log-next">შემდეგი</button>
            </div>
          </div>
        </section>
      </div>
    `;

    if (prevSource && $('pharm-source')) $('pharm-source').value = prevSource;
    if (prevPages != null && $('pharm-pages')) $('pharm-pages').value = prevPages;
    paintHistory();

    $('pharm-filter-status')?.addEventListener('change', (e) => {
      logState.status = e.target.value || 'ALL';
      logState.offset = 0;
      paintHistory();
    });
    $('pharm-log-prev')?.addEventListener('click', () => {
      logState.offset = Math.max(0, logState.offset - logState.limit);
      paintHistory();
    });
    $('pharm-log-next')?.addEventListener('click', () => {
      logState.offset += logState.limit;
      paintHistory();
    });

    $('pharm-sync')?.addEventListener('click', () => {
      const source = $('pharm-source')?.value || 'ALL';
      const pagesRaw = ($('pharm-pages')?.value || '').trim();
      const maxPages = pagesRaw ? parseInt(pagesRaw, 10) : undefined;
      if (pagesRaw && (Number.isNaN(maxPages) || maxPages < 1)) {
        toastMsg('გვერდების რაოდენობა 1-დან 500-მდე უნდა იყოს.', 'bad');
        $('pharm-pages')?.focus();
        return;
      }
      const btn = $('pharm-sync');
      confirmSync({
        source,
        maxPages,
        title: 'სინქის გაშვება',
        onError: () => {
          if (btn) {
            btn.disabled = false;
            btn.innerHTML = `${ico('activity')} სინქის გაშვება`;
          }
        },
      });
    });

    root.querySelectorAll('.v3-pharmacy-retry').forEach((btn) => {
      btn.addEventListener('click', () => {
        const source = btn.getAttribute('data-source');
        if (!source) return;
        confirmSync({
          source,
          title: 'სინქის ხელახლა გაშვება',
          onError: () => {
            btn.disabled = false;
          },
        });
      });
    });

    if (running) startPoll();
  }

  global.renderPharmacy = renderPharmacyV3;
})(window);
