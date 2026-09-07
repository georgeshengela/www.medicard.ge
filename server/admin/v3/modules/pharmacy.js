/**
 * MediCard Admin V3 — Pharmacy observatory (full override of renderPharmacy).
 * Price-compare catalog sync ops. URL range/grain are unused by pharmacy APIs.
 */
(function adminV3Pharmacy(global) {
  const Shell = () => global.AdminV3Shell || {};
  const V = () => global.AdminV3 || {};
  const $ = (id) => document.getElementById(id);

  const SOURCES = [
    { id: 'PHARMADEPOT', label: 'ფარმადეპო' },
    { id: 'AVERSI', label: 'ავერსი' },
    { id: 'PSP', label: 'PSP' },
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
  function shortDate(iso) {
    if (typeof fmtDateShort === 'function') return fmtDateShort(iso);
    return iso || '—';
  }
  function gel(value) {
    if (typeof global.gel === 'function') return global.gel(value);
    if (value == null || Number.isNaN(Number(value))) return '—';
    return `${Number(value).toFixed(2)} ₾`;
  }
  function syncDuration(startedAt, finishedAt) {
    if (typeof global.syncDuration === 'function') return global.syncDuration(startedAt, finishedAt);
    if (!startedAt) return '—';
    const end = finishedAt ? new Date(finishedAt).getTime() : Date.now();
    const sec = Math.max(0, Math.round((end - new Date(startedAt).getTime()) / 1000));
    if (sec < 60) return `${sec}წ`;
    return `${Math.floor(sec / 60)}წ ${sec % 60}წ`;
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
      if (global.state?.tab === 'pharmacy') void renderPharmacyV3();
    }, 8000);
  }

  function kpiCell(icoName, label, value, hint, tone) {
    const toneClass =
      tone === 'warn'
        ? ' is-amber'
        : tone === 'bad'
          ? ' is-danger'
          : tone === 'ok'
            ? ' is-ok'
            : tone === 'soft'
              ? ' is-soft'
              : '';
    return `<article class="v3-pharmacy-kpi${toneClass}">
      <span class="v3-pharmacy-kpi-ico" aria-hidden="true">${ico(icoName || 'pill')}</span>
      <div class="v3-pharmacy-kpi-copy">
        <span>${esc(label)}</span>
        <strong>${value}</strong>
        ${hint != null && hint !== '' ? `<em>${esc(hint)}</em>` : ''}
      </div>
    </article>`;
  }

  function runBadge(status) {
    if (typeof syncRunBadge === 'function') return syncRunBadge(status);
    if (status === 'DONE') return '<span class="badge ok">მზადა</span>';
    if (status === 'FAILED') return '<span class="badge bad">ჩავარდა</span>';
    if (status === 'RUNNING') return '<span class="badge std">მიმდ.</span>';
    return `<span class="badge neutral">${esc(status || '—')}</span>`;
  }

  function sourceCard(src, catalog, sourceStatus, syncMeta) {
    const last = sourceStatus[src.id];
    const offers = catalog.offersBySource?.[src.id] || 0;
    const meta = syncMeta[src.id];
    const share = catalog.offers ? Math.round((offers / catalog.offers) * 100) : 0;
    const tone =
      last?.status === 'DONE' ? 'ok' : last?.status === 'FAILED' ? 'bad' : last?.status === 'RUNNING' ? 'run' : 'idle';
    const badge =
      last?.status === 'DONE'
        ? '<span class="badge ok">ონლაინ</span>'
        : last?.status === 'FAILED'
          ? '<span class="badge bad">ჩავარდა</span>'
          : last?.status === 'RUNNING'
            ? '<span class="badge std">სინქი</span>'
            : '<span class="badge neutral">გამორთ.</span>';

    return `<article class="v3-pharmacy-source is-${tone}">
      <div class="v3-pharmacy-source-top">
        <span class="v3-pharmacy-source-ico">${ico('pill')}</span>
        <div class="v3-pharmacy-source-copy">
          <strong>${esc(src.label)}</strong>
          <span>${meta ? `ბოლო · ${esc(shortDate(meta.finishedAt))}` : 'ჯერ არ გაუშვებულა'}</span>
        </div>
        ${badge}
      </div>
      <div class="v3-pharmacy-source-val">${fmt(offers)}</div>
      <div class="v3-pharmacy-source-meta">
        <span>შეთავაზება</span>
        <strong>${share}% კატალოგის</strong>
      </div>
      <div class="v3-pharmacy-bar"><i style="width:${Math.max(share, 2)}%"></i></div>
      <div class="v3-pharmacy-source-stats">
        <div><span>ჩატვირთული</span><strong>${last?.itemsFetched != null ? fmt(last.itemsFetched) : '—'}</strong></div>
        <div><span>ხანგრძლ.</span><strong>${last ? esc(syncDuration(last.startedAt, last.finishedAt)) : '—'}</strong></div>
      </div>
      ${
        last?.error
          ? `<p class="v3-pharmacy-source-err">${esc(last.error.slice(0, 140))}${last.error.length > 140 ? '…' : ''}</p>`
          : ''
      }
      ${
        last?.status === 'FAILED'
          ? `<button type="button" class="btn ghost compact v3-pharmacy-retry" data-source="${esc(src.id)}">${ico('refresh')} ხელახლა</button>`
          : ''
      }
    </article>`;
  }

  function dealRow(deal, rank) {
    const name = String(deal.name || '');
    return `<div class="v3-pharmacy-deal">
      <span class="v3-pharmacy-deal-rank">${rank}</span>
      <div class="v3-pharmacy-deal-body">
        <strong>${esc(name.slice(0, 64))}${name.length > 64 ? '…' : ''}</strong>
        <span>${fmt(deal.offerCount)} აფთიაქი · საუკეთესო · ${esc(deal.bestSource)}</span>
      </div>
      <div class="v3-pharmacy-deal-prices">
        <strong>${esc(gel(deal.bestPriceGel))}</strong>
        <em>${esc(gel(deal.maxPriceGel))}</em>
        <span>−${esc(deal.savePct)}%</span>
      </div>
    </div>`;
  }

  function livePreview(topDeal) {
    if (!topDeal) {
      return `<div class="v3-pharmacy-preview is-empty">
        <strong>აპის პრევიუ</strong>
        <p>სინქის შემდეგ აქ გამოჩნდება რეალური ტოპ დაზოგვა.</p>
      </div>`;
    }
    const saveGel =
      topDeal.maxPriceGel != null && topDeal.bestPriceGel != null
        ? (Number(topDeal.maxPriceGel) - Number(topDeal.bestPriceGel)).toFixed(2)
        : null;
    return `<div class="v3-pharmacy-preview">
      <div class="v3-pharmacy-preview-label">აპში გამოჩენა</div>
      <div class="v3-pharmacy-preview-phone">
        <div class="v3-pharmacy-preview-head">
          <span>ფასების შედარება</span>
          <span>${fmt(topDeal.offerCount)} აფთიაქი</span>
        </div>
        <div class="v3-pharmacy-preview-product">
          <span class="v3-pharmacy-preview-thumb">${ico('pill')}</span>
          <div>
            <strong>${esc(String(topDeal.name || '').slice(0, 48))}</strong>
            <span>საუკეთესო · ${esc(topDeal.bestSource)}</span>
          </div>
        </div>
        <div class="v3-pharmacy-preview-rows">
          <div class="v3-pharmacy-preview-row is-best">
            <span>${esc(topDeal.bestSource)}</span>
            <strong>${esc(gel(topDeal.bestPriceGel))}</strong>
          </div>
          <div class="v3-pharmacy-preview-row">
            <span>მაქს. ფასი</span>
            <strong>${esc(gel(topDeal.maxPriceGel))}</strong>
          </div>
        </div>
        <div class="v3-pharmacy-preview-foot">
          <span>${saveGel != null ? `დაზოგავთ ${esc(saveGel)} ₾` : 'დაზოგვა'}</span>
          <em>−${esc(topDeal.savePct)}%</em>
        </div>
      </div>
    </div>`;
  }

  function filteredRuns() {
    const runs = logState.allRuns || [];
    if (logState.status === 'ALL') return runs;
    return runs.filter((r) => r.status === logState.status);
  }

  function historyRowsHtml() {
    const runs = filteredRuns().slice(logState.offset, logState.offset + logState.limit);
    if (!runs.length) {
      return `<tr><td colspan="6"><div class="v3-pharmacy-empty-inline">სინქრონიზაციის ისტორია ჯერ არ არის</div></td></tr>`;
    }
    return runs
      .map((r) => {
        const durSec = r.startedAt
          ? Math.max(
              0,
              Math.round(
                ((r.finishedAt ? new Date(r.finishedAt) : new Date()).getTime() - new Date(r.startedAt).getTime()) /
                  1000,
              ),
            )
          : 0;
        const durPct = Math.min(100, Math.round((durSec / 3600) * 100));
        return `<tr class="v3-pharmacy-run${r.status === 'RUNNING' ? ' is-running' : ''}">
          <td><strong>${esc(r.source)}</strong></td>
          <td>${runBadge(r.status)}</td>
          <td class="mono">${fmt(r.itemsFetched ?? 0)}</td>
          <td class="muted">${esc(shortDate(r.startedAt))}</td>
          <td>
            <div class="v3-pharmacy-dur">
              <span class="mono">${esc(syncDuration(r.startedAt, r.finishedAt))}</span>
              <div class="v3-pharmacy-bar sm"><i style="width:${durPct || 4}%"></i></div>
            </div>
          </td>
          <td class="v3-pharmacy-run-err">${esc((r.error || '—').slice(0, 80))}${(r.error || '').length > 80 ? '…' : ''}</td>
        </tr>`;
      })
      .join('');
  }

  function paintHistory() {
    const tbody = document.querySelector('#pharm-log-body');
    const meta = document.querySelector('#pharm-log-meta');
    if (!tbody) return;
    const all = filteredRuns();
    const total = all.length;
    tbody.innerHTML = historyRowsHtml();
    if (meta) meta.textContent = `${fmt(total)} ჩანაწერი`;
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

  async function renderPharmacyV3() {
    Shell().mountHeader?.({
      tab: 'pharmacy',
      kicker: 'Operations',
      title: 'ფარმაცია',
      purpose: 'ფასების შედარება — სინქი, მდგომარეობა და შეცდომები.',
      helpKey: 'pharmacy.page',
    });

    const root = $('tab-pharmacy');
    if (!root) return;

    clearPoll();
    root.classList.add('v3-workspace-wide', 'v3-module', 'v3-pharmacy');

    if (!root.querySelector('[data-v3-pharmacy="page"]')) {
      root.innerHTML = `<div class="v3-pharmacy-body dash-enter" data-v3-pharmacy="loading">
        <div class="v3-pharmacy-toolbar">
          <div class="v3-pharmacy-toolbar-copy">
            <strong>ფარმაციის ობსერვატორია</strong>
            <span>იტვირთება…</span>
          </div>
        </div>
      </div>`;
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
      total = history.total || runs.length;
      logState.allRuns = runs;
    } catch (e) {
      root.innerHTML = `<div class="v3-pharmacy-body" data-v3-pharmacy="error">
        <div class="v3-pharmacy-empty is-err">
          <strong>ჩატვირთვა ვერ მოხერხდა</strong>
          <p>${esc(e.message || 'უცნობი შეცდომა')}</p>
          <button type="button" class="btn ghost compact" id="pharm-retry">${ico('refresh')} ხელახლა ცდა</button>
        </div>
      </div>`;
      $('pharm-retry')?.addEventListener('click', () => void renderPharmacyV3());
      return;
    }

    const comparedPct = catalog.products ? Math.round((catalog.comparedProducts / catalog.products) * 100) : 0;
    const triplePct = catalog.products ? Math.round((insights.tripleCompare / catalog.products) * 100) : 0;
    const stockPct = catalog.offers ? Math.round((insights.inStockOffers / catalog.offers) * 100) : 0;
    const coverTone = comparedPct >= 70 ? 'ok' : comparedPct >= 40 ? 'soft' : catalog.products ? 'warn' : '';
    const topDeals = insights.topDeals || [];
    const prevSource = $('pharm-source')?.value;
    const prevPages = $('pharm-pages')?.value;

    root.innerHTML = `
      <div class="v3-pharmacy-body dash-enter" data-v3-pharmacy="page">
        ${
          running
            ? `<div class="v3-pharmacy-live" role="status">
                <span class="v3-pharmacy-live-ico">${ico('activity')}</span>
                <div>
                  <strong>სინქრონიზაცია მიმდინარეობს</strong>
                  <span>${esc(running.source)} · ${esc(syncDuration(running.startedAt, null))} · ${fmt(running.itemsFetched ?? 0)} ჩანაწერი</span>
                </div>
                <span class="v3-pharmacy-live-dot" aria-hidden="true"></span>
              </div>`
            : ''
        }

        <div class="v3-pharmacy-toolbar">
          <div class="v3-pharmacy-toolbar-copy">
            <strong>ფარმაციის ობსერვატორია</strong>
            <span>კატალოგი · წყაროები · სინქი · ტოპ დაზოგვები</span>
          </div>
          <div class="v3-pharmacy-toolbar-actions">
            ${helpBtn('pharmacy.page')}
            <button type="button" class="btn ghost compact" id="pharm-refresh">${ico('refresh')} განახლება</button>
          </div>
        </div>

        <div class="v3-pharmacy-kpis" role="group" aria-label="კატალოგის მდგომარეობა">
          ${kpiCell('layers', 'კატალოგი', fmt(catalog.products), 'კანონიკური პროდუქტი', 'soft')}
          ${kpiCell('wallet', 'შეთავაზებები', fmt(catalog.offers), `${fmt(insights.inStockOffers)} მარაგში · ${stockPct}%`, '')}
          ${kpiCell('globe', '2-წყარო+', fmt(catalog.comparedProducts), `${comparedPct}% დაფარვა`, coverTone)}
          ${kpiCell('check', '3-წყარო', fmt(insights.tripleCompare), `${triplePct}% სრული შედარება`, triplePct >= 40 ? 'ok' : 'soft')}
        </div>

        <section class="v3-pharmacy-panel" data-v3-pharmacy="sources">
          <div class="v3-pharmacy-head">
            <div class="v3-pharmacy-head-copy">
              <div class="v3-title-row"><h3>აფთიაქის წყაროები</h3></div>
              <p class="muted">შეთავაზებების წილი, ბოლო სინქი და სტატუსი</p>
            </div>
          </div>
          <div class="v3-pharmacy-sources">
            ${SOURCES.map((src) => sourceCard(src, catalog, sourceStatus, syncMeta)).join('')}
          </div>
        </section>

        <div class="v3-pharmacy-split">
          <section class="v3-pharmacy-panel" data-v3-pharmacy="sync">
            <div class="v3-pharmacy-head">
              <div class="v3-pharmacy-head-copy">
                <div class="v3-title-row"><h3>სინქრონიზაცია</h3>${helpBtn('pharmacy.sync')}</div>
                <p class="muted">ხელით გაშვება · ავტო-განახლება სინქის დროს</p>
              </div>
            </div>
            <div class="v3-pharmacy-sync">
              <div class="v3-pharmacy-sync-form">
                <label class="v3-pharmacy-field">
                  <span>წყარო</span>
                  <select id="pharm-source">
                    <option value="ALL">ყველა (ფარმადეპო + ავერსი + PSP)</option>
                    <option value="PHARMADEPOT">ფარმადეპო</option>
                    <option value="AVERSI">ავერსი</option>
                    <option value="PSP">PSP</option>
                  </select>
                </label>
                <label class="v3-pharmacy-field">
                  <span>მაქს. გვერდები</span>
                  <input id="pharm-pages" type="number" min="1" max="500" placeholder="ცარიელი = სრული კატალოგი" />
                </label>
                <button type="button" class="btn primary" id="pharm-sync" ${running ? 'disabled' : ''}>
                  ${ico('activity')} ${running ? 'სინქრონიზაცია მიმდინარეობს…' : 'სინქის გაშვება'}
                </button>
                <p class="v3-pharmacy-note">ფარმადეპო ~3300 SKU · 30–90 წთ. ავერსი/PSP შეიძლება bot-დაცვით დაბლოკილი იყოს.</p>
                <div class="v3-pharmacy-sync-meta">
                  <div><span>ბოლო ALL</span><strong>${syncMeta.ALL ? esc(shortDate(syncMeta.ALL.finishedAt)) : '—'}</strong></div>
                  <div><span>ჩატვირთული</span><strong>${syncMeta.ALL?.itemsFetched != null ? fmt(syncMeta.ALL.itemsFetched) : '—'}</strong></div>
                </div>
              </div>
              ${livePreview(topDeals[0])}
            </div>
          </section>

          <section class="v3-pharmacy-panel" data-v3-pharmacy="deals">
            <div class="v3-pharmacy-head">
              <div class="v3-pharmacy-head-copy">
                <div class="v3-title-row"><h3>ტოპ დაზოგვები</h3></div>
                <p class="muted">ყველაზე დიდი ფასის სხვაობა მრავალწყარო პროდუქტებში</p>
              </div>
            </div>
            ${
              topDeals.length
                ? `<div class="v3-pharmacy-deals">${topDeals.map((d, i) => dealRow(d, i + 1)).join('')}</div>`
                : `<div class="v3-pharmacy-empty-inline"><strong>ჯერ არ არის შედარება</strong><p>გაუშვით სინქი — დაზოგვის ტოპი აქ გამოჩნდება.</p></div>`
            }
          </section>
        </div>

        ${
          recentFailures.length
            ? `<section class="v3-pharmacy-alert" data-v3-pharmacy="failures">
                <span class="v3-pharmacy-alert-ico">${ico('alert')}</span>
                <div class="v3-pharmacy-alert-copy">
                  <strong>${fmt(recentFailures.length)} ბოლო შეცდომა</strong>
                  <p>გადახედეთ და გაუშვით ხელახლა დაბლოკილი წყარო</p>
                </div>
                <div class="v3-pharmacy-alert-list">
                  ${recentFailures
                    .map(
                      (r) => `<div class="v3-pharmacy-alert-item">
                        <span class="badge bad">${esc(r.source)}</span>
                        <span class="muted">${esc(shortDate(r.startedAt))}</span>
                        <span>${esc((r.error || '—').slice(0, 100))}${(r.error || '').length > 100 ? '…' : ''}</span>
                      </div>`,
                    )
                    .join('')}
                </div>
              </section>`
            : ''
        }

        <section class="v3-pharmacy-panel" data-v3-pharmacy="history">
          <div class="v3-pharmacy-head">
            <div class="v3-pharmacy-head-copy">
              <div class="v3-title-row"><h3>სინქის ისტორია</h3></div>
              <p class="muted"><span id="pharm-log-meta">${fmt(total)} ჩანაწერი</span></p>
            </div>
            <select id="pharm-filter-status" aria-label="სტატუსი" class="v3-pharmacy-filter">
              <option value="ALL"${logState.status === 'ALL' ? ' selected' : ''}>ყველა სტატუსი</option>
              <option value="DONE"${logState.status === 'DONE' ? ' selected' : ''}>მზადა</option>
              <option value="FAILED"${logState.status === 'FAILED' ? ' selected' : ''}>ჩავარდა</option>
              <option value="RUNNING"${logState.status === 'RUNNING' ? ' selected' : ''}>მიმდინარე</option>
            </select>
          </div>
          <div class="v3-pharmacy-table-wrap">
            <table class="v3-pharmacy-table">
              <thead>
                <tr>
                  <th>წყარო</th>
                  <th>სტატუსი</th>
                  <th>ჩატვირთული</th>
                  <th>დაწყება</th>
                  <th>ხანგრძლ.</th>
                  <th>შეცდომა</th>
                </tr>
              </thead>
              <tbody id="pharm-log-body">${historyRowsHtml()}</tbody>
            </table>
          </div>
          <div class="v3-pharmacy-pager">
            <button type="button" class="btn ghost compact" id="pharm-log-prev" disabled>წინა</button>
            <button type="button" class="btn ghost compact" id="pharm-log-next">შემდეგი</button>
          </div>
        </section>
      </div>
    `;

    if (prevSource && $('pharm-source')) $('pharm-source').value = prevSource;
    if (prevPages != null && $('pharm-pages')) $('pharm-pages').value = prevPages;
    paintHistory();

    $('pharm-refresh')?.addEventListener('click', () => void renderPharmacyV3());
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

    $('pharm-sync')?.addEventListener('click', async () => {
      const source = $('pharm-source')?.value || 'ALL';
      const pagesRaw = ($('pharm-pages')?.value || '').trim();
      const maxPages = pagesRaw ? parseInt(pagesRaw, 10) : undefined;
      if (pagesRaw && (Number.isNaN(maxPages) || maxPages < 1)) {
        toastMsg('მაქს. გვერდები არასწორია', 'bad');
        return;
      }
      if (!confirm(`გაუშვებთ ${source} სინქს?${maxPages ? ` (max ${maxPages} გვ.)` : ' (სრული კატალოგი)'}`)) return;
      const btn = $('pharm-sync');
      if (btn) {
        btn.disabled = true;
        btn.textContent = 'იწყება…';
      }
      try {
        await startSync(source, maxPages);
        toastMsg('სინქრონიზაცია დაიწყო — განახლება ავტომატურად', 'ok');
        await renderPharmacyV3();
      } catch (err) {
        toastMsg(err.message || 'სინქი ვერ დაიწყო', 'bad');
        if (btn) {
          btn.disabled = false;
          btn.innerHTML = `${ico('activity')} სინქის გაშვება`;
        }
      }
    });

    root.querySelectorAll('.v3-pharmacy-retry').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const source = btn.getAttribute('data-source');
        if (!source || !confirm(`${source} — ხელახლა გაუშვებთ სინქს?`)) return;
        btn.disabled = true;
        try {
          await startSync(source);
          toastMsg(`${source} სინქი დაიწყო`, 'ok');
          await renderPharmacyV3();
        } catch (err) {
          toastMsg(err.message || 'სინქი ვერ დაიწყო', 'bad');
          btn.disabled = false;
        }
      });
    });

    if (running) startPoll();
  }

  global.renderPharmacy = renderPharmacyV3;
})(window);
