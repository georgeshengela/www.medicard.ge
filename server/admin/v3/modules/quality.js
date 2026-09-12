/**
 * MediCard Admin V3 — Quality observatory (full override of renderQualityOps).
 * Versions + outcomes-extra respect range; integrity/permissions are snapshots.
 */
(function adminV3Quality(global) {
  const Shell = () => global.AdminV3Shell || {};
  const V = () => global.AdminV3 || {};
  const $ = (id) => document.getElementById(id);

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
  function rate(r) {
    if (typeof opsRate === 'function') return opsRate(r);
    return r == null ? '—' : `${r}%`;
  }
  function ico(name) {
    return typeof icon === 'function' ? icon(name) : '';
  }
  function helpBtn(key) {
    return V().infoButton ? V().infoButton(key) : '';
  }
  function coveragePct(value) {
    if (value == null || Number.isNaN(Number(value))) return '—';
    return `${value}%`;
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
    return `<article class="v3-quality-kpi${toneClass}">
      <span class="v3-quality-kpi-ico" aria-hidden="true">${ico(icoName || 'activity')}</span>
      <div class="v3-quality-kpi-copy">
        <span>${esc(label)}</span>
        <strong>${value}</strong>
        ${hint != null && hint !== '' ? `<em>${esc(hint)}</em>` : ''}
      </div>
    </article>`;
  }

  function issueCard(label, count, href, tone) {
    const n = Number(count) || 0;
    const toneClass = tone === 'warn' ? ' is-warn' : tone === 'ok' ? ' is-ok' : '';
    return `<button type="button" class="v3-quality-issue${toneClass}" data-href="${esc(href || '#/quality')}">
      <span class="v3-quality-issue-label">${esc(label)}</span>
      <strong>${fmt(n)}</strong>
      <em>ნახვა</em>
    </button>`;
  }

  function policyCell(label, value) {
    return `<div class="v3-quality-policy-cell">
      <span>${esc(label)}</span>
      <strong class="mono">${esc(value || '—')}</strong>
    </div>`;
  }

  function miniKpi(icoName, label, value) {
    return `<article class="v3-quality-mini">
      <span class="v3-quality-mini-ico">${ico(icoName)}</span>
      <div>
        <span>${esc(label)}</span>
        <strong>${value}</strong>
      </div>
    </article>`;
  }

  function bindNav(root) {
    root.querySelectorAll('[data-href]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const href = btn.getAttribute('data-href');
        if (href) location.hash = href;
      });
    });
  }

  async function renderQualityOpsV3() {
    const root = $('tab-quality');
    if (!root) return;
    const Sh = Shell();
    const Av = V();

    Sh.mountHeader?.({
      tab: 'quality',
      kicker: 'Production',
      title: 'ხარისხი',
      purpose: 'ვერსიები, ტელემეტრია და მონაცემები სანდოა თუ არა.',
      helpKey: 'quality.page',
    });

    const rangeHtml = Av.filterBar ? Av.filterBar() : typeof opsRangeBar === 'function' ? opsRangeBar() : '';

    root.classList.add('v3-workspace-wide', 'v3-module', 'v3-quality');
    root.innerHTML = `
      <div class="v3-quality-body dash-enter" data-v3-quality="loading">
        <div class="v3-quality-toolbar">
          <div class="v3-quality-toolbar-copy">
            <strong>ხარისხის ობსერვატორია</strong>
            <span>იტვირთება…</span>
          </div>
        </div>
        <div id="quality-body">${Av.skeleton ? Av.skeleton(6) : typeof opsSkeleton === 'function' ? opsSkeleton(6) : '<p class="muted">იტვირთება…</p>'}</div>
      </div>
    `;

    if (typeof bindOpsRange === 'function') bindOpsRange(renderQualityOpsV3);

    try {
      const qs = typeof opsQs === 'function' ? opsQs() : '';
      const [quality, versions, permissions, extra] = await Promise.all([
        api('/analytics/quality'),
        api(`/analytics/versions?${qs}`),
        api('/analytics/permissions'),
        api(`/analytics/outcomes-extra?${qs}`),
      ]);

      const versionCoverage =
        quality.versionCoverageRate != null
          ? coveragePct(quality.versionCoverageRate)
          : quality.activeUsersSampled
            ? coveragePct(
                Math.round(
                  100 - (100 * (quality.usersMissingAppVersion || 0) / Math.max(1, quality.activeUsersSampled)),
                ),
              )
            : '—';

      const telemetryCoverage = versions.belowOutcomeSync?.rate?.hidden
        ? '—'
        : versions.belowOutcomeSync?.rate?.value == null
          ? '—'
          : `${Math.max(0, 100 - versions.belowOutcomeSync.rate.value)}%`;

      const permCoverage = permissions.enabledRate?.hidden
        ? '—'
        : permissions.enabledRate?.value == null
          ? '—'
          : `${permissions.enabledRate.value}%`;

      const policy = versions.policy || {};
      const minOutcome = policy.minimumOutcomeSyncVersion || '24.0.0';
      const minBrain = policy.minimumBrainSyncVersion || '23.0.3';

      const barChart =
        typeof opsBarChart === 'function'
          ? opsBarChart(
              (versions.versions || []).map((row) => ({
                label: row.version,
                count: row.users,
                href: `#/users?appVersion=${encodeURIComponent(row.version)}`,
              })),
            )
          : `<ul class="v3-quality-ver-list">${(versions.versions || [])
              .map(
                (row) =>
                  `<li><a href="#/users?appVersion=${encodeURIComponent(row.version)}">${esc(row.version)}</a> — ${fmt(row.users)}</li>`,
              )
              .join('')}</ul>`;

      const missVer = Number(quality.usersMissingAppVersion) || 0;
      const missPlat = Number(quality.usersMissingPlatform) || 0;
      const orphan = Number(quality.orphanOutcomes) || 0;
      const dupes = Number(quality.duplicateDecisionIds) || 0;
      const belowOutcome = Number(versions.belowOutcomeSync?.users) || 0;
      const belowBrain = Number(versions.belowBrainSync?.users) || 0;
      const inactive = Number(quality.usersWithoutRecentActivity) || 0;
      const futureTs = Number(quality.futureTimestamps) || 0;

      root.innerHTML = `
        <div class="v3-quality-body dash-enter" data-v3-quality="page">
          <div class="v3-quality-toolbar">
            <div class="v3-quality-toolbar-copy">
              <strong>ხარისხის ობსერვატორია</strong>
              <span>ვერსიები და კვირის მეტრიკები — არჩეული პერიოდი · მთლიანობა / ნებართვა — სნეპშოტი</span>
            </div>
            <div class="v3-quality-toolbar-actions">
              ${helpBtn('quality.page')}
              <button type="button" class="btn ghost compact" id="quality-refresh">${ico('refresh')} განახლება</button>
            </div>
          </div>

          ${rangeHtml ? `<div class="v3-quality-range">${rangeHtml}</div>` : ''}

          <div class="v3-quality-kpis" role="group" aria-label="დაფარვის მდგომარეობა">
            ${kpiCell('layers', 'ვერსიის დაფარვა', esc(versionCoverage), missVer ? `${fmt(missVer)} აკლია ვერსია` : 'ყველას აქვს ვერსია', missVer > 0 ? 'warn' : 'ok')}
            ${kpiCell('activity', 'ტელემეტრიის დაფარვა', esc(telemetryCoverage), 'პერიოდის აქტიური', 'soft')}
            ${kpiCell('bell', 'ნებართვის დაფარვა', esc(permCoverage), 'ჩართული push', permCoverage !== '—' && Number(String(permCoverage).replace('%', '')) < 50 ? 'warn' : 'soft')}
            ${kpiCell('users', 'აქტიური ნიმუში', fmt(quality.activeUsersSampled), quality.sampleWindowDays ? `${quality.sampleWindowDays}დ ფანჯარა` : '', '')}
          </div>

          <section class="v3-quality-panel" data-v3-quality="policy">
            <div class="v3-quality-head">
              <div class="v3-quality-head-copy">
                <div class="v3-title-row"><h3>ვერსიის პოლიტიკა</h3>${helpBtn('quality.versions')}</div>
                <p class="muted">რეკომენდებული და მინიმალური სინქ ვერსიები</p>
              </div>
            </div>
            <div class="v3-quality-policy">
              ${policyCell('რეკომენდებული', policy.currentRecommendedVersion)}
              ${policyCell('მინ. Brain sync', minBrain)}
              ${policyCell('მინ. Outcome sync', minOutcome)}
              ${policyCell('მინ. მხარდაჭერილი', policy.minimumSupportedVersion)}
              ${policyCell('იძულებითი განახლება', policy.forceUpdateVersion || 'გამორთული')}
            </div>
          </section>

          <section class="v3-quality-panel" data-v3-quality="integrity">
            <div class="v3-quality-head">
              <div class="v3-quality-head-copy">
                <div class="v3-title-row"><h3>ოპერაციული დიაგნოსტიკა</h3>${helpBtn('quality.integrity')}</div>
                <p class="muted">მონაცემების მთლიანობა და კლიენტების ჩამორჩენა · 90დ ნიმუში</p>
              </div>
            </div>
            <div class="v3-quality-groups">
              <div class="v3-quality-group">
                <h4>მონაცემები</h4>
                ${issueCard('ვერსია არ არის', missVer, '#/users', missVer > 0 ? 'warn' : 'ok')}
                ${issueCard('პლატფორმა არ არის', missPlat, '#/users', missPlat > 0 ? 'warn' : 'ok')}
                ${issueCard('უპატრონო შედეგი', orphan, '#/push', orphan >= 10 ? 'warn' : '')}
                ${issueCard('დუბლიკატი ID', dupes, '#/push', dupes > 0 ? 'warn' : 'ok')}
                ${issueCard('მომავალი timestamp', futureTs, '#/quality', futureTs > 0 ? 'warn' : 'ok')}
                ${issueCard('ბოლო აქტივობა არა', inactive, '#/users', inactive > 0 ? 'warn' : '')}
              </div>
              <div class="v3-quality-group">
                <h4>შეტყობინებები</h4>
                ${issueCard('არასწორი route', quality.invalidRoutes, '#/push', Number(quality.invalidRoutes) > 0 ? 'warn' : 'ok')}
                ${issueCard('უცნობი action', quality.unknownActionKeys, '#/push', Number(quality.unknownActionKeys) > 0 ? 'warn' : 'ok')}
                ${issueCard('რევალიდაცია არ არის', quality.decisionsMissingRevalidation, '#/push', '')}
              </div>
              <div class="v3-quality-group">
                <h4>კლიენტები</h4>
                ${issueCard(`${minOutcome}-ზე დაბლა`, belowOutcome, '#/users?activity=outdated', versions.belowOutcomeSync?.rate?.value >= 15 ? 'warn' : '')}
                ${issueCard(`${minBrain}-ზე დაბლა`, belowBrain, '#/users?activity=outdated', versions.belowBrainSync?.rate?.value >= 15 ? 'warn' : '')}
              </div>
            </div>
          </section>

          <div class="v3-quality-split">
            <section class="v3-quality-panel" data-v3-quality="versions">
              <div class="v3-quality-head">
                <div class="v3-quality-head-copy">
                  <div class="v3-title-row"><h3>ვერსიები</h3>${helpBtn('quality.versions')}</div>
                  <p class="muted">${esc(versions.definition || 'რომელი აპის ვერსიები აქტიურ მომხმარებლებშია')}</p>
                </div>
              </div>
              <div class="v3-quality-chart">${barChart}</div>
              <div class="v3-quality-platforms">
                <span>iOS <strong>${fmt(versions.platformUsers?.ios)}</strong></span>
                <span>Android <strong>${fmt(versions.platformUsers?.android)}</strong></span>
                <span>უცნობი <strong>${fmt(versions.platformUsers?.unknown)}</strong></span>
              </div>
            </section>

            <section class="v3-quality-panel" data-v3-quality="permissions">
              <div class="v3-quality-head">
                <div class="v3-quality-head-copy">
                  <div class="v3-title-row"><h3>ნებართვა</h3>${helpBtn('quality.telemetry')}</div>
                  <p class="muted">Push ნებართვის სნეპშოტი</p>
                </div>
              </div>
              <div class="v3-quality-minis">
                ${miniKpi('bell', 'ჩართული', fmt(permissions.enabled))}
                ${miniKpi('x', 'გამორთული', fmt(permissions.disabled))}
                ${miniKpi('shield', 'შეზღუდული', fmt(permissions.provisional))}
                ${miniKpi('users', 'უცნობი', fmt(permissions.unknown))}
              </div>
            </section>
          </div>

          <section class="v3-quality-panel" data-v3-quality="extra">
            <div class="v3-quality-head">
              <div class="v3-quality-head-copy">
                <div class="v3-title-row"><h3>კვირა · ინსაითი · მედიკამენტი</h3></div>
                <p class="muted">არჩეული პერიოდის ოპერაციული მეტრიკები</p>
              </div>
            </div>
            <div class="v3-quality-minis is-wide">
              ${miniKpi('file', 'ანგარიში შეიქმნა', fmt(extra.weekly?.generated))}
              ${miniKpi('bell', 'კვირის გაგზავნა', fmt(extra.weekly?.sent))}
              ${miniKpi('check', 'ანგარიში გაიხსნა', fmt(extra.weekly?.opened))}
              ${miniKpi('activity', 'გახსნის წილი', rate(extra.weekly?.openRate))}
              ${miniKpi('layers', 'ინსაითი', fmt(extra.insights?.generated))}
              ${miniKpi('pill', 'მიღება ნოტიფით', fmt(extra.medications?.takenViaNotification))}
              ${miniKpi('users', 'მიღება აპში', fmt(extra.medications?.takenInApp))}
            </div>
          </section>
        </div>
      `;

      $('quality-refresh')?.addEventListener('click', () => void renderQualityOpsV3());
      bindNav(root);
      if (typeof bindOpsRange === 'function') bindOpsRange(renderQualityOpsV3);
    } catch (err) {
      const body = $('quality-body') || root;
      body.innerHTML = Av.errorState
        ? Av.errorState('ხარისხის მონაცემები ვერ ჩაიტვირთა', err.message, 'quality-retry')
        : typeof opsError === 'function'
          ? opsError(err.message, 'quality-retry')
          : `<div class="v3-quality-empty is-err"><strong>ჩატვირთვა ვერ მოხერხდა</strong><p>${esc(err.message)}</p>
              <button type="button" class="btn ghost compact" id="quality-retry">${ico('refresh')} ხელახლა სცადე</button></div>`;
      $('quality-retry')?.addEventListener('click', () => void renderQualityOpsV3());
    }
  }

  global.renderQualityOps = renderQualityOpsV3;
})(window);
