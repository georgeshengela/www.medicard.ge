/**
 * MediCard Admin V3 — Packages observatory (full override of renderPackages).
 * URL: #/packages — catalog, limits, feature matrix. Range/grain in URL are unused.
 */
(function adminV3Packages(global) {
  const Shell = () => global.AdminV3Shell || {};
  const V = () => global.AdminV3 || {};
  const $ = (id) => document.getElementById(id);

  const FEATURE_LABELS = {
    doctorChat: 'Medi-სთან საუბარი',
    consilium: 'კონსილიუმი',
    labAnalysis: 'ლაბორატორია',
    imaging: 'რენტგენი / CT',
    skin: 'კანი',
    skincare: 'სკინქეარი',
    medicationReview: 'მედიკამენტები',
    prioritySupport: 'პრიორიტეტული მხარდაჭერა',
  };

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
  function pkgTone(code) {
    const key = String(code || '').toLowerCase();
    if (key === 'ultimate') return 'ultimate';
    if (key === 'standard') return 'standard';
    return 'free';
  }
  function pkgIco(code) {
    const t = pkgTone(code);
    if (t === 'ultimate') return 'zap';
    if (t === 'standard') return 'layers';
    return 'users';
  }
  function aiLabel(p) {
    if (p.unlimited) return '∞ AI';
    if (p.monthlyAiLimit != null) return `${fmt(p.monthlyAiLimit)} AI`;
    return '—';
  }
  function priceLabel(p) {
    if (p.priceGel == null || !Number.isFinite(Number(p.priceGel))) return '—';
    return `${Number(p.priceGel).toFixed(2)} ₾`;
  }
  function helpBtn(key) {
    return V().infoButton ? V().infoButton(key) : '';
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
    return `<article class="v3-packages-kpi${toneClass}">
      <span class="v3-packages-kpi-ico" aria-hidden="true">${ico(icoName || 'layers')}</span>
      <div class="v3-packages-kpi-copy">
        <span>${esc(label)}</span>
        <strong>${value}</strong>
        ${hint != null && hint !== '' ? `<em>${esc(hint)}</em>` : ''}
      </div>
    </article>`;
  }

  function sharePct(part, total) {
    if (!total) return 0;
    return Math.round((part / total) * 100);
  }

  function distributionBars(packages, totalUsers) {
    if (typeof opsBarChart === 'function') {
      const items = packages.map((p) => ({
        label: p.code,
        count: Number(p.userCount) || 0,
        htmlLabel: `<span class="badge ${pkgTone(p.code)}">${esc(p.code)}</span>`,
      }));
      if (!items.some((x) => x.count > 0)) {
        return '<div class="v3-packages-empty"><strong>მომხმარებლები ჯერ არ არის</strong><p>პაკეტზე მინიჭება აქ გამოჩნდება.</p></div>';
      }
      return `<div class="v3-packages-chart">${opsBarChart(items)}</div>`;
    }
    const max = Math.max(1, ...packages.map((p) => Number(p.userCount) || 0));
    return `<div class="v3-packages-dist">${packages
      .map((p) => {
        const n = Number(p.userCount) || 0;
        const w = Math.max(n ? 6 : 0, Math.round((n / max) * 100));
        const pct = sharePct(n, totalUsers);
        return `<div class="v3-packages-dist-row">
          <span class="badge ${pkgTone(p.code)}">${esc(p.code)}</span>
          <span class="v3-packages-dist-track"><i style="width:${w}%"></i></span>
          <strong>${fmt(n)}<em>${pct}%</em></strong>
        </div>`;
      })
      .join('')}</div>`;
  }

  function catalogRow(p, totalUsers) {
    const tone = pkgTone(p.code);
    const inactive = p.active === false;
    return `<article class="v3-packages-row${inactive ? ' is-inactive' : ''}" data-pkg-code="${esc(p.code)}">
      <span class="v3-packages-row-ico tone-${tone}" aria-hidden="true">${ico(pkgIco(p.code))}</span>
      <div class="v3-packages-row-copy">
        <div class="v3-packages-row-title">
          <span class="badge ${tone}">${esc(p.code)}</span>
          <h3>${esc(p.nameKa)}</h3>
          ${inactive ? '<span class="badge warn">გამორთული</span>' : ''}
        </div>
        <p class="muted">${esc(p.descriptionKa || p.nameEn || '—')}</p>
      </div>
      <div class="v3-packages-row-metric">
        <span>ფასი</span>
        <strong>${esc(priceLabel(p))}</strong>
      </div>
      <div class="v3-packages-row-metric">
        <span>მომხმარებლები</span>
        <strong>${fmt(p.userCount ?? 0)}${totalUsers ? `<em> / ${fmt(totalUsers)}</em>` : ''}</strong>
      </div>
      <div class="v3-packages-row-metric">
        <span>თვიური AI</span>
        <strong>${esc(aiLabel(p))}</strong>
      </div>
      <div class="v3-packages-row-actions">
        <button type="button" class="btn ghost compact" data-pkg="${esc(p.code)}">${ico('settings')} რედაქტირება</button>
      </div>
    </article>`;
  }

  function featureCell(on) {
    return on
      ? `<td class="v3-packages-yes"><span aria-label="ჩართული">✓</span></td>`
      : `<td class="v3-packages-no"><span aria-label="გამორთული">—</span></td>`;
  }

  function comparisonTable(packages) {
    const head = packages
      .map((p) => `<th><span class="badge ${pkgTone(p.code)}">${esc(p.code)}</span></th>`)
      .join('');
    const priceRow = packages.map((p) => `<td class="mono">${esc(priceLabel(p))}</td>`).join('');
    const aiRow = packages
      .map((p) => `<td class="mono">${p.unlimited ? '∞' : fmt(p.monthlyAiLimit)}</td>`)
      .join('');
    const subRow = packages
      .map((p) => {
        const free = pkgTone(p.code) === 'free' || Number(p.priceGel) === 0;
        return `<td class="mono">${free ? 'კალენდარული თვე' : '30 დღე'}</td>`;
      })
      .join('');
    const featureRows = Object.entries(FEATURE_LABELS)
      .map(
        ([key, label]) =>
          `<tr><td>${esc(label)}</td>${packages.map((p) => featureCell(!!p.features?.[key])).join('')}</tr>`,
      )
      .join('');

    return `<div class="v3-packages-table-wrap">
      <table class="v3-packages-table">
        <thead><tr><th>ფუნქცია</th>${head}</tr></thead>
        <tbody>
          <tr><td>ფასი</td>${priceRow}</tr>
          <tr><td>თვიური AI</td>${aiRow}</tr>
          <tr><td>გამოწერა</td>${subRow}</tr>
          ${featureRows}
        </tbody>
      </table>
    </div>`;
  }

  async function renderPackagesV3() {
    Shell().mountHeader?.({
      tab: 'packages',
      kicker: 'Commerce',
      title: 'პაკეტები',
      purpose: 'ტარიფები, ლიმიტები და უფლებები.',
      helpKey: 'packages.page',
    });

    const root = $('tab-packages');
    if (!root) return;

    root.classList.add('v3-workspace-wide', 'v3-module', 'v3-packages');
    root.innerHTML = `<div class="v3-packages-body dash-enter" data-v3-packages="loading">
      <div class="v3-packages-toolbar">
        <div class="v3-packages-toolbar-copy">
          <strong>პაკეტების ობსერვატორია</strong>
          <span>იტვირთება…</span>
        </div>
      </div>
    </div>`;

    let packages = [];
    try {
      const data = await api('/packages');
      packages = data.packages || [];
    } catch (e) {
      root.innerHTML = `<div class="v3-packages-body" data-v3-packages="error">
        <div class="v3-packages-empty is-err">
          <strong>ჩატვირთვა ვერ მოხერხდა</strong>
          <p>${esc(e.message || 'უცნობი შეცდომა')}</p>
          <button type="button" class="btn ghost compact" id="pkg-retry">${ico('refresh')} ხელახლა სცადე</button>
        </div>
      </div>`;
      $('pkg-retry')?.addEventListener('click', () => void renderPackagesV3());
      return;
    }

    const totalUsers = packages.reduce((sum, p) => sum + (Number(p.userCount) || 0), 0);
    const paidUsers = packages
      .filter((p) => Number(p.priceGel) > 0)
      .reduce((sum, p) => sum + (Number(p.userCount) || 0), 0);
    const freeUsers = Math.max(0, totalUsers - paidUsers);
    const activeCount = packages.filter((p) => p.active !== false).length;
    const inactiveCount = packages.length - activeCount;
    const premiumUsers = packages
      .filter((p) => {
        const t = pkgTone(p.code);
        return t === 'standard' || t === 'ultimate';
      })
      .reduce((sum, p) => sum + (Number(p.userCount) || 0), 0);

    root.innerHTML = `
      <div class="v3-packages-body dash-enter" data-v3-packages="page">
        <div class="v3-packages-toolbar">
          <div class="v3-packages-toolbar-copy">
            <strong>პაკეტების ობსერვატორია</strong>
            <span>ტარიფები და უფლებები · 30-დღიანი გადახდილი პერიოდი · უფასო — კალენდარული თვე</span>
          </div>
          <div class="v3-packages-toolbar-actions">
            ${helpBtn('packages.page')}
            <button type="button" class="btn ghost compact" id="pkg-refresh">${ico('refresh')} განახლება</button>
          </div>
        </div>

        <div class="v3-packages-kpis" role="group" aria-label="პაკეტების მდგომარეობა">
          ${kpiCell('users', 'სულ მომხმარებელი', fmt(totalUsers), `${packages.length} პაკეტი`, 'soft')}
          ${kpiCell('zap', 'გადახდილი', fmt(paidUsers), `${sharePct(paidUsers, totalUsers)}% სულიდან`, paidUsers > 0 ? 'ok' : '')}
          ${kpiCell('users', 'უფასო', fmt(freeUsers), `${sharePct(freeUsers, totalUsers)}% სულიდან`)}
          ${kpiCell('layers', 'პრემიუმი', fmt(premiumUsers), 'STANDARD · ULTIMATE', premiumUsers > 0 ? 'ok' : 'soft')}
          ${kpiCell('check', 'აქტიური პაკეტი', fmt(activeCount), inactiveCount ? `${fmt(inactiveCount)} გამორთული` : 'ყველა აქტიურია', inactiveCount ? 'warn' : 'ok')}
        </div>

        <div class="v3-packages-split">
          <section class="v3-packages-panel" data-v3-packages="distribution">
            <div class="v3-packages-head">
              <div class="v3-packages-head-copy">
                <div class="v3-title-row"><h3>განაწილება</h3></div>
                <p class="muted">მომხმარებლები პაკეტების მიხედვით</p>
              </div>
            </div>
            ${distributionBars(packages, totalUsers)}
          </section>

          <section class="v3-packages-panel" data-v3-packages="notes">
            <div class="v3-packages-head">
              <div class="v3-packages-head-copy">
                <div class="v3-title-row"><h3>ბილინგის წესები</h3>${helpBtn('packages.limits')}</div>
                <p class="muted">AI ლიმიტი იხარჯება პერიოდის განმავლობაში</p>
              </div>
            </div>
            <ul class="v3-packages-notes">
              <li>
                <span class="v3-packages-note-ico">${ico('zap')}</span>
                <div><strong>გადახდილი პაკეტები</strong><p>30-დღიანი პერიოდი · AI ლიმიტი იხარჯება ამ პერიოდში</p></div>
              </li>
              <li>
                <span class="v3-packages-note-ico is-soft">${ico('users')}</span>
                <div><strong>უფასო</strong><p>კალენდარული თვე · ლიმიტი იწყება თავიდან ყოველ თვეს</p></div>
              </li>
              <li>
                <span class="v3-packages-note-ico is-amber">${ico('settings')}</span>
                <div><strong>რედაქტირება</strong><p>სახელი, ფასი, AI ლიმიტი და აქტიური სტატუსი იცვლება პირდაპირ კატალოგიდან</p></div>
              </li>
            </ul>
          </section>
        </div>

        <section class="v3-packages-panel" data-v3-packages="catalog">
          <div class="v3-packages-head">
            <div class="v3-packages-head-copy">
              <div class="v3-title-row"><h3>კატალოგი</h3></div>
              <p class="muted">ყველა პაკეტი — ფასი, მომხმარებლები და AI ლიმიტი</p>
            </div>
          </div>
          <div class="v3-packages-catalog">
            ${packages.map((p) => catalogRow(p, totalUsers)).join('') || '<div class="v3-packages-empty"><strong>პაკეტები არ არის</strong></div>'}
          </div>
        </section>

        <section class="v3-packages-panel" data-v3-packages="compare">
          <div class="v3-packages-head">
            <div class="v3-packages-head-copy">
              <div class="v3-title-row"><h3>შედარება</h3></div>
              <p class="muted">ფასი, AI და ფუნქციების მატრიცა</p>
            </div>
          </div>
          ${comparisonTable(packages)}
        </section>
      </div>
    `;

    $('pkg-refresh')?.addEventListener('click', () => void renderPackagesV3());
    root.querySelectorAll('[data-pkg]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const pkg = packages.find((p) => p.code === btn.getAttribute('data-pkg'));
        if (pkg && typeof global.editPackage === 'function') global.editPackage(pkg);
        else if (pkg && typeof editPackage === 'function') editPackage(pkg);
      });
    });
  }

  global.renderPackages = renderPackagesV3;
})(window);
