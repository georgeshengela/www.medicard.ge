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
  const share = (part, total) => `${(total > 0 ? (100 * (Number(part) || 0)) / total : 0).toLocaleString('ka-GE', { maximumFractionDigits: 1 })}%`;

  function metric(label, value, hint, tone = '') {
    return `<div class="s-metric ${tone}"><span>${esc(label)}</span><strong>${value}</strong><small>${hint || ''}</small></div>`;
  }

  /** One check of the integrity table: a zero is fine; a non-zero count is either worth a look or just context. */
  function checkRow(label, hint, count, href, attention) {
    const n = Number(count) || 0;
    const status = !n
      ? '<span class="s-badge is-ok">რიგზეა</span>'
      : attention
        ? '<span class="s-badge is-warn">შესამოწმებელი</span>'
        : '<span class="s-badge is-plain">ცნობისთვის</span>';
    return `<tr${href ? ` class="is-click" data-href="${esc(href)}" tabindex="0"` : ''}>
      <td><b>${esc(label)}</b><span class="p3-sub">${esc(hint)}</span></td>
      <td class="num">${fmt(n)}</td>
      <td>${status}</td>
    </tr>`;
  }
  const groupRow = (title, note) => `<tr class="p3-group-row"><td colspan="3">${esc(title)}${note ? `<span>${esc(note)}</span>` : ''}</td></tr>`;

  /** Ranked meter rows (part of a whole); rows with an href open that filter. */
  function meterRows(rows, { total, empty }) {
    const list = rows.filter((r) => Number(r.count) > 0);
    if (!list.length) return `<div class="s-empty">${esc(empty)}</div>`;
    const max = Math.max(1, ...list.map((r) => Number(r.count) || 0));
    const sumAll = total || list.reduce((s, r) => s + (Number(r.count) || 0), 0);
    return `<div class="p3-meters">${list.map((r) => {
      const width = Math.max(2, Math.round(((Number(r.count) || 0) / max) * 100));
      const inner = `<span class="p3-meter-label">${r.labelHtml || esc(r.label)}</span>
        <span class="s-meter" aria-hidden="true"><i style="width:${width}%"></i></span>
        <span class="p3-meter-val"><b>${fmt(r.count)}</b><small>${share(r.count, sumAll)}</small></span>`;
      return r.href
        ? `<button type="button" class="p3-meter-row is-link" data-href="${esc(r.href)}">${inner}</button>`
        : `<div class="p3-meter-row">${inner}</div>`;
    }).join('')}</div>`;
  }

  function bindNav(root) {
    root.querySelectorAll('[data-href]').forEach((el) => {
      const go = () => {
        const href = el.getAttribute('data-href');
        if (href) location.hash = href;
      };
      el.addEventListener('click', go);
      if (el.tagName === 'TR') {
        el.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            go();
          }
        });
      }
    });
  }

  function toolbar(rangeHtml) {
    return `<div class="s-toolbar">
      <div class="p3-tools">${rangeHtml}</div>
      <div class="p3-tools">
        <button type="button" class="btn ghost compact" id="quality-refresh">${ico('refresh')} განახლება</button>
      </div>
    </div>`;
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
      purpose: 'აპის ვერსიები, Push-ის ნებართვა და მონაცემების მთლიანობა.',
      helpKey: 'quality.page',
    });

    const rangeHtml = Av.filterBar ? Av.filterBar() : typeof opsRangeBar === 'function' ? opsRangeBar() : '';

    // No "v3-module": its legacy field styles (unify.css) would restyle the range date inputs.
    root.classList.add('v3-workspace-wide', 'v3-quality');
    root.innerHTML = `<div class="s-stack v3-tab-shell" data-v3-quality="loading">
      ${toolbar(rangeHtml)}
      <div id="quality-body">${Av.skeleton ? Av.skeleton(6) : '<div class="v3-skel" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i></div>'}</div>
    </div>`;

    $('quality-refresh')?.addEventListener('click', () => void renderQualityOpsV3());
    if (typeof bindOpsRange === 'function') bindOpsRange(renderQualityOpsV3);

    try {
      const qs = typeof opsQs === 'function' ? opsQs() : '';
      const [quality, versions, permissions, extra] = await (async () => {
        const bundle = await api(`/analytics/quality-bundle?${qs}`).catch(() => null);
        if (bundle && bundle.quality) {
          return [bundle.quality, bundle.versions, bundle.permissions, bundle.extra];
        }
        return Promise.all([
          api('/analytics/quality'),
          api(`/analytics/versions?${qs}`),
          api('/analytics/permissions'),
          api(`/analytics/outcomes-extra?${qs}`),
        ]);
      })();

      const versionCoverageRate =
        quality.versionCoverageRate != null
          ? Number(quality.versionCoverageRate)
          : quality.activeUsersSampled
            ? Math.round(100 - (100 * (quality.usersMissingAppVersion || 0)) / Math.max(1, quality.activeUsersSampled))
            : null;
      const versionCoverage = coveragePct(versionCoverageRate);

      const permRate = permissions.enabledRate?.hidden || permissions.enabledRate?.value == null ? null : Number(permissions.enabledRate.value);
      const permTotal = Number(permissions.total) || (Number(permissions.enabled) || 0) + (Number(permissions.disabled) || 0) + (Number(permissions.provisional) || 0) + (Number(permissions.unknown) || 0);

      const policy = versions.policy || {};
      const minOutcome = policy.minimumOutcomeSyncVersion || versions.belowOutcomeSync?.minimum || '24.0.0';
      const minBrain = policy.minimumBrainSyncVersion || versions.belowBrainSync?.minimum || '23.0.3';
      const current = policy.currentRecommendedVersion || versions.current || null;

      const missVer = Number(quality.usersMissingAppVersion) || 0;
      const missPlat = Number(quality.usersMissingPlatform) || 0;
      const orphan = Number(quality.orphanOutcomes) || 0;
      const dupes = Number(quality.duplicateDecisionIds) || 0;
      const belowOutcome = Number(versions.belowOutcomeSync?.users) || 0;
      const belowBrain = Number(versions.belowBrainSync?.users) || 0;
      const inactive = Number(quality.usersWithoutRecentActivity) || 0;
      const futureTs = Number(quality.futureTimestamps) || 0;
      const windowDays = Number(quality.sampleWindowDays) || 90;
      const gateRate = (gate) => (gate?.rate?.hidden || gate?.rate?.value == null ? '' : ` · ${gate.rate.value}% აქტიურიდან`);

      const versionList = (versions.versions || []).map((row) => ({
        label: row.version,
        labelHtml: `${row.version === 'unknown' ? 'უცნობი ვერსია' : esc(row.version)}${current && row.version === current ? ' <span class="s-badge is-accent is-plain">ბოლო</span>' : ''}`,
        count: row.users,
        href: `#/users?appVersion=${encodeURIComponent(row.version)}`,
      })).sort((a, b) => (Number(b.count) || 0) - (Number(a.count) || 0));
      const pu = versions.platformUsers || {};
      const platformList = [
        { label: 'iOS', count: pu.ios },
        { label: 'Android', count: pu.android },
        { label: 'ვები', count: pu.web },
        { label: 'უცნობი', count: pu.unknown },
      ];
      const permissionList = [
        { label: 'ჩართული', count: permissions.enabled },
        { label: 'გამორთული', count: permissions.disabled },
        { label: 'ჩუმი მიწოდება (iOS)', count: permissions.provisional },
        { label: 'უცნობი', count: permissions.unknown },
      ];

      root.innerHTML = `<div class="s-stack v3-tab-shell" data-v3-quality="page">
        ${toolbar(rangeHtml)}

        <div class="s-metrics" role="group" aria-label="დაფარვის მდგომარეობა">
          ${metric('ვერსიის დაფარვა', esc(versionCoverage), missVer ? `${fmt(missVer)} ადამიანს ვერსია არ აქვს · ${windowDays} დღე` : `ყველას აქვს ვერსია · ${windowDays} დღე`, versionCoverageRate != null && versionCoverageRate < 90 ? 'is-warn' : '')}
          ${metric('Push ნებართვა', permRate == null ? '—' : esc(`${permRate}%`), permTotal ? `ჩართული აქვს ${fmt(permissions.enabled)} / ${fmt(permTotal)}` : 'მონაცემი ჯერ არ არის', permRate != null && permRate < 50 ? 'is-warn' : '')}
          ${metric(`აქტიური · ${windowDays} დღე`, fmt(quality.activeUsersSampled), inactive ? `${fmt(inactive)} ანგარიში ამ დროში არ შემოსულა` : 'ყველა ანგარიში აქტიურია')}
        </div>

        <section class="s-card" data-v3-quality="integrity">
          <header class="s-card-head"><div><div class="p3-title"><h3>მონაცემების შემოწმება</h3>${helpBtn('quality.integrity')}</div><p>ბოლო ${windowDays} დღის ჩანაწერები. დააჭირე სტრიქონს — გაიხსნება შესაბამისი გვერდი.</p></div></header>
          <div class="s-card-body is-flush"><div class="s-table-wrap"><table class="s-table p3-checks">
            <thead><tr><th>შემოწმება</th><th class="num">რაოდენობა</th><th>მდგომარეობა</th></tr></thead>
            <tbody>
              ${groupRow('მონაცემები')}
              ${checkRow('ვერსიის გარეშე', 'აქტიური ადამიანის ბოლო ჩანაწერს აპის ვერსია არ აქვს', missVer, '#/users', missVer > 0)}
              ${checkRow('პლატფორმის გარეშე', 'ბოლო ჩანაწერში უცნობია iOS თუ Android', missPlat, '#/users', missPlat > 0)}
              ${checkRow('შედეგი გადაწყვეტილების გარეშე', 'შეტყობინების გახსნას ან ქმედებას Brain-ის გადაწყვეტილება არ მოეძებნა', orphan, '#/push', orphan >= 10)}
              ${checkRow('გამეორებული გადაწყვეტილება', 'ერთი და იგივე გადაწყვეტილება ორჯერ ჩაიწერა', dupes, '#/push', dupes > 0)}
              ${checkRow('მომავლის თარიღი', 'ჩანაწერის დრო მომავალშია — ხშირად მოწყობილობის საათის ბრალია', futureTs, null, futureTs > 0)}
              ${groupRow('შეტყობინებები')}
              ${checkRow('არასწორი გადასასვლელი გვერდი', 'შეტყობინების ბმული „/“-ით არ იწყება — აპი გვერდს ვერ გახსნის', quality.invalidRoutes, '#/push', Number(quality.invalidRoutes) > 0)}
              ${checkRow('უცნობი ღილაკი', 'შეტყობინების შედეგში ისეთი ქმედებაა, რომელსაც სისტემა არ იცნობს', quality.unknownActionKeys, '#/push', Number(quality.unknownActionKeys) > 0)}
              ${checkRow('გაგზავნა ბოლო შემოწმების გარეშე', 'დაგეგმილი შეტყობინება გაიგზავნა გაგზავნისწინა შემოწმების გარეშე', quality.decisionsMissingRevalidation, '#/push', false)}
              ${groupRow('ძველი ბილდები', 'ორივე ზღვარი ძველ ნუმერაციას ეხება — ყველა 1.0.0.x ბილდი მათ აკმაყოფილებს.')}
              ${checkRow(`${minOutcome}-მდე ვერსია`, `შეტყობინების შედეგებს არ აგზავნის${gateRate(versions.belowOutcomeSync)}`, belowOutcome, '#/users?activity=outdated', versions.belowOutcomeSync?.rate?.value >= 15)}
              ${checkRow(`${minBrain}-მდე ვერსია`, `Brain-ის გადაწყვეტილებებს ვერ სინქრონიზებს${gateRate(versions.belowBrainSync)}`, belowBrain, '#/users?activity=outdated', versions.belowBrainSync?.rate?.value >= 15)}
            </tbody>
          </table></div></div>
        </section>

        <div class="p3-split">
          <section class="s-card" data-v3-quality="versions">
            <header class="s-card-head"><div><div class="p3-title"><h3>ვერსიები</h3>${helpBtn('quality.versions')}</div><p>ვინ რომელი ვერსიით გამოიყენა აპი არჩეულ პერიოდში. დააჭირე ვერსიას — გაიხსნება მისი მომხმარებლები.</p></div></header>
            <div class="s-card-body is-flush">${meterRows(versionList, { empty: 'ამ პერიოდში აქტივობა არ არის.' })}</div>
          </section>
          <div class="s-stack">
            <section class="s-card">
              <header class="s-card-head"><div><h3>პლატფორმა</h3><p>არჩეული პერიოდის აქტიური ადამიანები.</p></div></header>
              <div class="s-card-body is-flush">${meterRows(platformList, { total: Number(versions.activeUsers) || 0, empty: 'ამ პერიოდში აქტივობა არ არის.' })}</div>
            </section>
            <section class="s-card" data-v3-quality="permissions">
              <header class="s-card-head"><div><div class="p3-title"><h3>Push ნებართვა</h3>${helpBtn('quality.permissions')}</div><p>ახლანდელი მდგომარეობა — თითო ადამიანის ბოლო სტატუსი.</p></div></header>
              <div class="s-card-body is-flush">${meterRows(permissionList, { total: permTotal, empty: 'ნებართვის მონაცემი ჯერ არ არის.' })}</div>
            </section>
          </div>
        </div>

        <div class="s-section-title"><h3>კვირის ანგარიში · არჩეული პერიოდი</h3></div>
        <div class="s-metrics" data-v3-quality="extra">
          ${metric('შეიქმნა', fmt(extra.weekly?.generated), 'კვირის ანგარიში')}
          ${metric('გაიგზავნა', fmt(extra.weekly?.sent), 'Push შეტყობინებით')}
          ${metric('გაიხსნა', fmt(extra.weekly?.opened), 'ანგარიში ნახეს')}
          ${metric('გახსნის წილი', esc(rate(extra.weekly?.openRate)), 'გახსნილი / შექმნილი')}
        </div>
        <div class="s-section-title"><h3>ინსაითები და წამლები · არჩეული პერიოდი</h3></div>
        <div class="s-metrics">
          ${metric('ინსაითი შეიქმნა', fmt(extra.insights?.generated), 'Brain-ის ინსაითები')}
          ${metric('მიღება შეტყობინებიდან', fmt(extra.medications?.takenViaNotification), 'წამალი მონიშნეს შეტყობინებიდან')}
          ${metric('მიღება აპში', fmt(extra.medications?.takenInApp), 'წამალი მონიშნეს აპის შიგნით')}
        </div>

        <section class="s-card" data-v3-quality="policy">
          <header class="s-card-head"><div><div class="p3-title"><h3>ვერსიის პოლიტიკა</h3>${helpBtn('quality.policy')}</div><p>რომელი ვერსიაა ბოლო და რომლის ქვემოთ ითხოვს აპი განახლებას.</p></div>
            <button type="button" class="btn ghost compact" data-href="#/settings">${ico('settings')} აპის რეჟიმი</button></header>
          <div class="s-card-body">
            <dl class="p3-facts">
              <div><dt>ბოლო ვერსია</dt><dd class="p3-mono">${esc(current || '—')}</dd></div>
              <div><dt>მინიმალური მხარდაჭერილი</dt><dd class="p3-mono">${esc(policy.minimumSupportedVersion || '—')}</dd></div>
              <div><dt>იძულებითი განახლება</dt><dd>${policy.forceUpdateVersion ? `<span class="p3-mono">${esc(policy.forceUpdateVersion)}</span>-ზე დაბლა` : 'გამორთული'}</dd></div>
              <div><dt>ძველი ზღვარი · შედეგების სინქი</dt><dd class="p3-mono">${esc(minOutcome)}</dd></div>
              <div><dt>ძველი ზღვარი · Brain-ის სინქი</dt><dd class="p3-mono">${esc(minBrain)}</dd></div>
            </dl>
          </div>
        </section>
      </div>`;

      $('quality-refresh')?.addEventListener('click', () => void renderQualityOpsV3());
      bindNav(root);
      if (typeof bindOpsRange === 'function') bindOpsRange(renderQualityOpsV3);
    } catch (err) {
      const body = $('quality-body') || root;
      body.innerHTML = `<div class="s-card"><div class="s-empty">${ico('alert')}<strong>ხარისხის მონაცემები ვერ ჩაიტვირთა</strong><span>შეამოწმე კავშირი და სცადე ხელახლა.</span>${err?.message ? `<small class="p3-raw">${esc(err.message)}</small>` : ''}<button type="button" class="btn" id="quality-retry">${ico('refresh')} ხელახლა ცდა</button></div></div>`;
      $('quality-retry')?.addEventListener('click', () => void renderQualityOpsV3());
    }
  }

  global.renderQualityOps = renderQualityOpsV3;
})(window);
