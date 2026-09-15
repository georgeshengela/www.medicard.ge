/**
 * MediCard Admin V3 — თბილისი მოძრაობს
 * URL: #/tbilisi-moves?tab=overview|districts|rules|rounds|review|rewards
 */
(function adminV3TbilisiMoves(global) {
  const Shell = () => global.AdminV3Shell || {};
  const $ = (id) => document.getElementById(id);
  const TABS = [
    ['overview', 'მიმოხილვა'],
    ['districts', 'რაიონები'],
    ['rules', 'წესები'],
    ['rounds', 'რაუნდები'],
    ['review', 'გადახედვა'],
    ['rewards', 'ჯილდოები'],
  ];
  const TAB_KEYS = new Set(TABS.map(([k]) => k));
  const ui = { preview: null, roundDate: '', busy: false, clockTimer: 0, serverNowMs: 0, clockOrigin: 0 };

  function esc(v) {
    if (typeof escapeHtml === 'function') return escapeHtml(v);
    return String(v ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;');
  }
  function escA(v) {
    return typeof escapeAttr === 'function' ? escapeAttr(v) : esc(v).replaceAll("'", '&#39;');
  }
  function fmt(n) {
    if (typeof opsFmt === 'function') return opsFmt(n);
    const v = Number(n);
    if (!Number.isFinite(v)) return n == null ? '—' : String(n);
    return v.toLocaleString('ka-GE');
  }
  function fmtWhen(iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    if (!Number.isFinite(d.getTime())) return '—';
    return new Intl.DateTimeFormat('ka-GE', {
      timeZone: 'Asia/Tbilisi',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(d);
  }
  function pct(ratio) {
    if (ratio == null || !Number.isFinite(Number(ratio))) return '—';
    return `${(Number(ratio) * 100).toLocaleString('ka-GE', { maximumFractionDigits: 2 })}%`;
  }
  function can(cap) {
    const caps = state.admin?.capabilities;
    if (caps == null) return true;
    return Array.isArray(caps) && caps.includes(cap);
  }
  function params() {
    return Shell().hashParams ? Shell().hashParams() : new URLSearchParams((location.hash || '').split('?')[1] || '');
  }
  function activeTab() {
    const tab = params().get('tab') || 'overview';
    return TAB_KEYS.has(tab) ? tab : 'overview';
  }
  function go(tab) {
    Shell().writeModuleHash?.('tbilisi-moves', { tab, range: null, grain: null, from: null, to: null });
    void renderTbilisiMoves();
  }
  function tmApi(path, options) {
    return api(`/tbilisi-moves${path}`, options);
  }
  function toastOk(msg) {
    if (typeof toast === 'function') toast(msg);
  }
  function toastErr(err) {
    const code = err?.code || err?.data?.code;
    const msg =
      code === 'PREVIEW_STALE'
        ? 'გადახედვა აღარ ემთხვევა. თავიდან გადახედეთ.'
        : code === 'RESULT_STALE' || code === 'CONFIG_STALE'
          ? 'რევიზია შეიცვალა. განაახლეთ გვერდი.'
          : err?.message || 'შეცდომა';
    if (typeof toast === 'function') toast(msg, 'bad');
  }
  function setBusy(btn, on) {
    if (!btn) return;
    btn.disabled = on;
    btn.dataset.busy = on ? '1' : '';
    if (on) btn.textContent = 'მუშავდება…';
  }

  function visualBanner(live) {
    if (!live?.visualQaFixture) return '';
    return alertBox(
      'warn',
      'სინთეზური ვიზუალური QA',
      'ეს ნაბიჯები სენსორიდან არ არის. ეს არ არის owner-pilot-ის ნამდვილი გარემო.',
    );
  }

  function shellHtml(active, body) {
    const S = Shell();
    const nav = S.subnav ? S.subnav(TABS, active, 'data-tm-sub') : '';
    const inner = `<div class="v3-tab-shell v3-tbilisi-moves-shell">${nav}<div class="v3-tbilisi-moves-pane">${body}</div></div>`;
    return S.workspace
      ? S.workspace(inner, 'v3-tbilisi-moves')
      : `<div class="v3-workspace-wide v3-module v3-tbilisi-moves">${inner}</div>`;
  }

  function bindSubnav(root) {
    const S = Shell();
    if (S.bindSubnav) {
      S.bindSubnav(root, 'data-tm-sub', (key) => go(key));
      return;
    }
    root.querySelectorAll('[data-tm-sub]').forEach((btn) => {
      btn.addEventListener('click', () => go(btn.getAttribute('data-tm-sub')));
    });
  }

  function kpi(label, value, hint, key, icoName, tone) {
    const toneClass = tone === 'warn' ? ' is-amber' : tone === 'ok' ? ' is-ok' : tone === 'soft' ? ' is-soft' : '';
    return `<article class="v3-settings-kpi${toneClass}">
      <span class="v3-settings-kpi-ico" aria-hidden="true">${ico(icoName || 'activity')}</span>
      <div class="v3-settings-kpi-copy">
        <span>${esc(label)}</span>
        <strong ${key ? `data-tm-live="${escA(key)}"` : ''}>${esc(value)}</strong>
        ${hint ? `<em>${esc(hint)}</em>` : ''}
      </div>
    </article>`;
  }

  function ico(name) {
    return typeof icon === 'function' ? icon(name) : '';
  }

  function roundStatusKa(status) {
    if (status === 'PROVISIONAL') return 'მიმდინარე';
    if (status === 'FINALIZED') return 'დასრულებული';
    return 'ჯერ არ გახსნილა';
  }

  function liveBar({ date, status, ingestOpen, socket, title }) {
    const live = socket === 'live';
    return `
      <div class="v3-settings-toolbar" data-tm-livebar>
        <div class="v3-settings-toolbar-copy">
          <strong>${esc(title || 'თბილისი მოძრაობს')}</strong>
          <span>თბილისის დრო · <time data-tm-clock>—</time> · <span data-tm-live="date">${esc(date || '—')}</span> · <span data-tm-live="roundStatus">${esc(roundStatusKa(status))}</span></span>
          <span class="tm-toolbar-note"><span data-tm-ingest-line>${ingestOpen ? 'ინგესტია ღიაა' : 'ინგესტია დახურულია'}</span> · რაიონული სიარული, არა სამედიცინო რეიტინგი</span>
        </div>
        <div class="v3-settings-toolbar-actions">
          <span class="status-pill ${live ? 'ok' : 'warn'}" data-tm-socket="${escA(socket || 'offline')}">${live ? 'ცოცხალი' : 'კავშირი დაიკარგა'}</span>
          <button type="button" class="btn ghost compact" data-tm-refresh>${ico('refresh')} განახლება</button>
        </div>
      </div>`;
  }

  function alertBox(tone, title, body) {
    return `<div class="v3-settings-alert is-${escA(tone)}">
      <span class="v3-settings-alert-ico">${ico('alert')}</span>
      <div><strong>${esc(title)}</strong>${body ? `<p>${esc(body)}</p>` : ''}</div>
    </div>`;
  }

  function toggleRow({ id, title, body, checked, disabled, tone }) {
    return `
      <div class="v3-settings-toggle${tone ? ` is-${tone}` : ''}">
        <div class="v3-settings-toggle-copy">
          <div class="v3-title-row"><strong>${esc(title)}</strong></div>
          ${body ? `<p>${esc(body)}</p>` : ''}
        </div>
        <label class="toggle v3-settings-switch">
          <span class="switch"><input id="${escA(id)}" type="checkbox" ${checked ? 'checked' : ''} ${disabled ? 'disabled' : ''}/><i></i></span>
        </label>
      </div>`;
  }

  function fieldBlock({ id, label, value, hint, disabled, min, max, type, placeholder, maxlength }) {
    const t = type || 'number';
    return `<label class="v3-settings-field" for="${escA(id)}">
      <span>${esc(label)}</span>
      <input id="${escA(id)}" class="v3-settings-control" type="${escA(t)}" value="${escA(value ?? '')}" ${placeholder ? `placeholder="${escA(placeholder)}"` : ''} ${maxlength != null ? `maxlength="${escA(maxlength)}"` : ''} ${min != null ? `min="${escA(min)}"` : ''} ${max != null ? `max="${escA(max)}"` : ''} ${disabled ? 'disabled' : ''}/>
      ${hint ? `<em>${esc(hint)}</em>` : ''}
    </label>`;
  }

  function panel({ title, description, content, tone }) {
    const toneClass = tone === 'warn' ? ' is-warn' : tone === 'danger' ? ' is-danger' : '';
    return `<section class="v3-settings-panel${toneClass}">
      <div class="v3-settings-head">
        <div class="v3-settings-head-copy">
          <div class="v3-title-row"><h3>${esc(title)}</h3></div>
          ${description ? `<p class="muted">${esc(description)}</p>` : ''}
        </div>
      </div>
      <div class="v3-settings-panel-body">${content}</div>
    </section>`;
  }

  function tableWrap(head, rows, empty, cols) {
    return `<div class="table-wrap"><table class="v3-table">
      <thead>${head}</thead>
      <tbody>${rows || `<tr><td colspan="${cols || 5}">${esc(empty || 'ცარიელია')}</td></tr>`}</tbody>
    </table></div>`;
  }

  function flagChip(on, onLabel, offLabel, key) {
    return `<span class="status-pill ${on ? 'ok' : ''}" data-tm-flag="${escA(key)}">${esc(on ? onLabel : offLabel)}</span>`;
  }

  function startTbilisiClock(serverNow) {
    if (ui.clockTimer) clearInterval(ui.clockTimer);
    ui.serverNowMs = serverNow ? Date.parse(serverNow) : Date.now();
    if (!Number.isFinite(ui.serverNowMs)) ui.serverNowMs = Date.now();
    ui.clockOrigin = Date.now();
    const tick = () => {
      const el = document.querySelector('#tab-tbilisi-moves [data-tm-clock]');
      if (!el) {
        if (ui.clockTimer) clearInterval(ui.clockTimer);
        ui.clockTimer = 0;
        return;
      }
      const now = new Date(ui.serverNowMs + (Date.now() - ui.clockOrigin));
      el.textContent = new Intl.DateTimeFormat('ka-GE', {
        timeZone: 'Asia/Tbilisi',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      }).format(now);
    };
    tick();
    ui.clockTimer = setInterval(tick, 1000);
  }

  function patchTbilisiMovesSocket(state) {
    document.querySelectorAll('#tab-tbilisi-moves [data-tm-socket]').forEach((el) => {
      el.dataset.tmSocket = state === 'live' ? 'live' : 'offline';
      el.classList.toggle('ok', state === 'live');
      el.classList.toggle('warn', state !== 'live');
      el.textContent = state === 'live' ? 'ცოცხალი' : 'კავშირი დაიკარგა';
    });
  }

  function applyLiveKpis(root, snap) {
    const k = snap?.kpis || {};
    const set = (key, value) => {
      root.querySelectorAll(`[data-tm-live="${key}"]`).forEach((el) => {
        el.textContent = value;
      });
    };
    set('enrolledUsers', fmt(k.enrolledUsers));
    set('contributingUsers', fmt(k.contributingUsers));
    set('eligibleSteps', fmt(k.eligibleSteps));
    set('lastObservationAt', fmtWhen(k.lastObservationAt));
    set('date', snap.date || '—');
    set('roundStatus', roundStatusKa(snap.round?.status));
    const ingestLine = root.querySelector('[data-tm-ingest-line]');
    const open = Boolean(snap.round?.ingestOpen);
    if (ingestLine) ingestLine.textContent = open ? 'ინგესტია ღიაა' : 'ინგესტია დახურულია';
  }

  function rulesFormDirty(root) {
    return root.querySelector('[data-tm-rules]')?.classList.contains('is-dirty');
  }

  function applyLiveFlags(root, snap) {
    const map = [
      ['tm-feature', snap.featureEnabled],
      ['tm-enroll', snap.enrollmentOpen],
      ['tm-ingest', snap.ingestionEnabled],
      ['tm-comp-pause', snap.competitionPaused],
      ['tm-rewards', snap.rewardsEnabled],
      ['tm-leader-on', snap.leaderRecognitionEnabled !== false],
      ['tm-goal-badge', snap.districtGoalBadgeEnabled !== false],
    ];
    for (const [id, on] of map) {
      const el = root.querySelector(`#${id}`);
      if (!el || document.activeElement === el) continue;
      el.checked = Boolean(on);
    }
    const nums = [
      ['tm-target', snap.defaultDailyTarget],
      ['tm-cap', snap.competitiveCap],
      ['tm-cool', snap.cooldownDays],
      ['tm-minp', snap.minParticipantsForRank],
      ['tm-grace', snap.lateSyncGraceHours],
      ['tm-sanity', snap.sanityMaxRawSteps],
      ['tm-drop', snap.correctionDropFlagPct],
      ['tm-leader-n', snap.leaderRewardedRanks],
    ];
    for (const [id, value] of nums) {
      const el = root.querySelector(`#${id}`);
      if (!el || document.activeElement === el || value == null) continue;
      el.value = value;
    }
    const rev = root.querySelector('#tm-revision');
    if (rev && snap.revision != null) rev.value = snap.revision;
    root.querySelectorAll('[data-tm-flag]').forEach((el) => {
      const key = el.getAttribute('data-tm-flag');
      const on = key === 'competitionActive' ? !snap.competitionPaused : Boolean(snap[key]);
      el.classList.toggle('ok', on);
      if (key === 'featureEnabled') el.textContent = on ? 'ფიჩერი ჩართულია' : 'ფიჩერი გამორთულია';
      if (key === 'enrollmentOpen') el.textContent = on ? 'რეგისტრაცია ღიაა' : 'რეგისტრაცია დახურულია';
      if (key === 'ingestionEnabled') el.textContent = on ? 'ინგესტია ღიაა' : 'ინგესტია პაუზაზეა';
      if (key === 'competitionActive') el.textContent = on ? 'შეჯიბრი აქტიურია' : 'შეჯიბრი პაუზაზეა';
    });
    const flagKpis = [
      ['featureEnabled', Boolean(snap.featureEnabled), 'ჩართულია', 'გამორთულია'],
      ['enrollmentOpen', Boolean(snap.enrollmentOpen), 'ღიაა', 'დახურულია'],
      ['ingestionEnabled', Boolean(snap.ingestionEnabled), 'ღიაა', 'პაუზაზეა'],
      ['competitionActive', !snap.competitionPaused, 'აქტიურია', 'პაუზაზეა'],
    ];
    for (const [key, on, onText, offText] of flagKpis) {
      root.querySelectorAll(`[data-tm-live="${key}"]`).forEach((el) => {
        el.textContent = on ? onText : offText;
        const art = el.closest('.v3-settings-kpi');
        if (!art) return;
        art.classList.toggle('is-ok', on);
        art.classList.toggle('is-amber', !on);
        art.classList.remove('is-soft');
      });
    }
  }

  function patchTbilisiMovesLive(snap) {
    const root = $('tab-tbilisi-moves');
    if (!root || !snap) return;
    if (snap.serverNow) startTbilisiClock(snap.serverNow);
    applyLiveKpis(root, snap);
    const rules = root.querySelector('[data-tm-rules]');
    if (!rules) return;
    const formRev = Number(rules.querySelector('#tm-revision')?.value);
    const remoteRev = Number(snap.revision);
    const stale = rules.querySelector('[data-tm-stale]');
    if (Number.isFinite(remoteRev) && Number.isFinite(formRev) && remoteRev > formRev) {
      if (rulesFormDirty(root)) {
        if (stale) stale.hidden = false;
        return;
      }
      applyLiveFlags(root, snap);
      if (stale) stale.hidden = true;
    }
  }

  function renderDenied() {
    return `<div class="v3-settings-empty">
      <strong>წვდომა შეზღუდულია</strong>
      <p>თბილისი მოძრაობს სანახავად საჭიროა TBILISI_MOVES_VIEW.</p>
    </div>`;
  }

  function rankClass(rank) {
    if (rank === 1) return 'tm-rank-1';
    if (rank === 2) return 'tm-rank-2';
    if (rank === 3) return 'tm-rank-3';
    return '';
  }

  async function renderOverview() {
    const data = await tmApi('/overview');
    const round = data.round || {};
    const k = data.kpis || {};
    const issues = data.syncIssues || {};
    const ignored = (issues.ignoredObservations7d || [])
      .map((row) => `${row.reason}: ${fmt(row.count)}`)
      .join(' · ');
    const rows = (data.districts || [])
      .map((d) => {
        const ratio = Number(d.goalRatio);
        const bar = Number.isFinite(ratio) ? Math.max(0, Math.min(100, Math.round(ratio * 100))) : 0;
        return `<tr>
          <td><strong>${esc(d.nameKa)}</strong></td>
          <td>
            <div class="tm-mini-goal">
              <span>${fmt(d.eligibleSteps)} / ${fmt(d.target)}</span>
              <span class="tm-mini-goal-track"><i style="width:${bar}%"></i></span>
            </div>
          </td>
          <td>${esc(pct(d.goalRatio))}</td>
          <td>${fmt(d.participantCount)}</td>
          <td class="${rankClass(d.rank)}">${d.rank == null ? 'არ არის რეიტინგში' : fmt(d.rank)}</td>
        </tr>`;
      })
      .join('');
    return `
      ${liveBar({
        title: 'ცოცხალი მიმოხილვა',
        date: data.date || round.date,
        status: round.status,
        ingestOpen: round.ingestOpen,
        socket: window.__adminSocketConnected ? 'live' : 'offline',
      })}
      <div class="v3-settings-kpis" role="group" aria-label="დღის სიგნალები">
        ${kpi('რეგისტრირებული', fmt(k.enrolledUsers), 'აქტიური წევრები', 'enrolledUsers', 'users', 'ok')}
        ${kpi('მონაწილეები', fmt(k.contributingUsers), 'დადებითი კრედიტი დღეს', 'contributingUsers', 'activity', 'soft')}
        ${kpi('დაშვებული ნაბიჯები', fmt(k.eligibleSteps), 'დღევანდელი ჯამი', 'eligibleSteps', 'zap')}
        ${kpi('ბოლო დაკვირვება', fmtWhen(k.lastObservationAt), 'სერვერის მიღება', 'lastObservationAt', 'clock')}
      </div>
      ${alertBox(
        'warn',
        'პილოტი ჩაკეტილია',
        'pilotMode მუდმივად ჩართულია. იგივე ნაკადი „verified“ რეჟიმად ვერ გამოცხადდება. ფინალიზაცია, მოდერაცია და კოსმეტიკური ჯილდოები რაუნდების/გადახედვის ჩანართებშია.',
      )}
      ${panel({
        title: 'რაიონების პროგრესი',
        description: `რაუნდი: ${roundStatusKa(round.status)}${round.scoringFrozen ? ' · დღევანდელი წესები დაფიქსირებულია' : ' · წესების ცვლილება ჯერ მოქმედებს დღევანდელ გაუხსნელ რაუნდზე'}`,
        content: tableWrap(
          '<tr><th>რაიონი</th><th>ნაბიჯები</th><th>თანაფარდობა</th><th>მონაწილე</th><th>ადგილი</th></tr>',
          rows,
          'დღეს კრედიტი არ არის.',
          5,
        ),
      })}
      ${panel({
        title: 'სინქის სიგნალები',
        description: 'რუკა და ავტომატური კრონი ამ ფაზაში არ არის.',
        content: `<p class="tm-meta">მონიშნული კრედიტები: <strong>${fmt(issues.flaggedCredits)}</strong></p>
          <p class="tm-meta">უგულებელყოფილი დაკვირვებები (7 დღე): ${esc(ignored || 'არ არის')}</p>`,
      })}`;
  }

  async function renderDistricts() {
    const data = await tmApi('/districts');
    const manage = can('TBILISI_MOVES_MANAGE');
    const def = data.config?.defaultDailyTarget;
    const rows = (data.districts || [])
      .map((d) => {
        const override = d.dailyTargetOverride;
        return `<tr data-district-id="${escA(d.id)}" data-revision="${escA(d.revision)}">
          <td><strong>${esc(d.nameKa)}</strong><div class="muted">${esc(d.slug)}</div></td>
          <td><span class="status-pill ${d.status === 'ACTIVE' ? 'ok' : ''}">${esc(d.status)}</span></td>
          <td><input class="v3-settings-control tm-sort" type="number" min="0" value="${escA(d.sortOrder)}" ${manage ? '' : 'disabled'}/></td>
          <td>
            <input class="v3-settings-control tm-override" type="number" min="1000" placeholder="${escA(def)}" value="${override == null ? '' : escA(override)}" ${manage ? '' : 'disabled'}/>
            <em class="tm-field-hint">${override == null ? `ნაგულისხმევი (${fmt(def)})` : 'გადაფარვა'}</em>
          </td>
          <td class="tm-row-actions">${manage ? `<button class="btn compact tm-save-district" type="button">შენახვა</button>
            ${d.status === 'ACTIVE' ? '<button class="btn ghost compact tm-archive" type="button">არქივი</button>' : ''}` : '—'}</td>
        </tr>`;
      })
      .join('');
    return `
      ${panel({
        title: 'რაიონები',
        description: 'მიზნის ცვლილება მოქმედებს შემდეგ გაუხსნელ რაუნდზე. არსებული რაუნდის snapshot უცვლელია.',
        content: tableWrap(
          '<tr><th>რაიონი</th><th>სტატუსი</th><th>რიგი</th><th>დღიური მიზანი</th><th></th></tr>',
          rows,
          'რაიონი არ არის.',
          5,
        ),
      })}`;
  }

  async function renderRules() {
    const data = await tmApi('/config');
    const live = data.live || {};
    const current = data.currentRound || {};
    const stats = data.liveStats || {};
    const k = stats.kpis || {};
    const manage = can('TBILISI_MOVES_MANAGE');
    const dis = !manage;
    const snap = current.rulesSnapshot || {};
    const Av = global.AdminV3 || {};
    const sticky = manage
      ? Av.stickyActions
        ? Av.stickyActions({
            dirty: false,
            cancel: `<button class="btn ghost" id="tm-cancel-rules" type="button">გაუქმება</button>`,
            save: `<button class="btn primary" id="tm-save-rules" type="button">${ico('check')} შენახვა</button>`,
          })
        : `<footer class="v3-sticky-actions" id="v3-sticky-actions">
            <div class="v3-sticky-actions-main">
              <button class="btn ghost" id="tm-cancel-rules" type="button">გაუქმება</button>
              <button class="btn primary" id="tm-save-rules" type="button">${ico('check')} შენახვა</button>
            </div>
          </footer>`
      : '';
    return `
      <div class="tm-rules" data-tm-rules>
        ${liveBar({
          title: 'წესების ობსერვატორია',
          date: stats.date || current.date,
          status: current.status || stats.round?.status,
          ingestOpen: current.ingestOpen || stats.round?.ingestOpen,
          socket: window.__adminSocketConnected ? 'live' : 'offline',
        })}
        <div class="v3-settings-kpis" role="group" aria-label="ოპერაციული მდგომარეობა">
          ${kpi('ფიჩერი', live.featureEnabled ? 'ჩართულია' : 'გამორთულია', 'ჰაბი და API', 'featureEnabled', 'zap', live.featureEnabled ? 'ok' : 'warn')}
          ${kpi('რეგისტრაცია', live.enrollmentOpen ? 'ღიაა' : 'დახურულია', 'ახალი წევრები', 'enrollmentOpen', 'users', live.enrollmentOpen ? 'ok' : 'warn')}
          ${kpi('ინგესტია', live.ingestionEnabled ? 'ღიაა' : 'პაუზაზეა', 'სენსორის ნაბიჯები', 'ingestionEnabled', 'activity', live.ingestionEnabled ? 'ok' : 'warn')}
          ${kpi('შეჯიბრი', live.competitionPaused ? 'პაუზაზეა' : 'აქტიურია', 'დღიური კრედიტი', 'competitionActive', 'shield', live.competitionPaused ? 'warn' : 'ok')}
        </div>
        <div class="v3-settings-kpis" role="group" aria-label="დღის სიგნალები">
          ${kpi('რეგისტრირებული', fmt(k.enrolledUsers), 'აქტიური წევრები', 'enrolledUsers', 'users', 'ok')}
          ${kpi('მონაწილეები', fmt(k.contributingUsers), 'დადებითი კრედიტი დღეს', 'contributingUsers', 'activity', 'soft')}
          ${kpi('დაშვებული ნაბიჯები', fmt(k.eligibleSteps), 'დღევანდელი ჯამი', 'eligibleSteps', 'zap')}
          ${kpi('ბოლო დაკვირვება', fmtWhen(k.lastObservationAt), 'სერვერის მიღება', 'lastObservationAt', 'clock')}
        </div>
        ${alertBox('warn', 'პილოტი ჩაკეტილია', 'იგივე ნაკადი verified რეჟიმად ვერ გამოცხადდება. ქულები აქტივობის რეიტინგია — არა სამედიცინო.')}
        <div class="tm-stale" data-tm-stale hidden>${alertBox('warn', 'კონფიგურაცია განახლდა', 'სხვა ადმინმა შეცვალა წესები. შეინახეთ ან განაახლეთ გვერდი.')}</div>
        <div class="v3-settings-grid">
          ${panel({
            title: 'ოპერაციული კონტროლი',
            description: 'ძალაში ახლავე — ჰაბი, რეგისტრაცია და ინგესტია.',
            content: `
              ${toggleRow({ id: 'tm-feature', title: 'ფიჩერი', body: 'ჰაბი და API ჩანს მხოლოდ ჩართვისას.', checked: live.featureEnabled, disabled: dis })}
              ${toggleRow({ id: 'tm-enroll', title: 'რეგისტრაცია', body: 'ახალი წევრები რაიონს ირჩევენ მხოლოდ ღია რეჟიმში.', checked: live.enrollmentOpen, disabled: dis })}
              ${toggleRow({ id: 'tm-ingest', title: 'ინგესტია', body: 'სენსორის ნაბიჯები მიიღება, სანამ პაუზა არ არის.', checked: live.ingestionEnabled, disabled: dis })}
              ${toggleRow({ id: 'tm-comp-pause', title: 'შეჯიბრი შეჩერებულია', body: 'პაუზის ინტერვალში მოხვედრილი სრული დღიური ჯამი არ მიიღება. ფინალიზაცია არ უქმდება.', checked: live.competitionPaused, disabled: dis, tone: 'warn' })}
            `,
          })}
          ${panel({
            title: 'ქულების წესები',
            description: current.scoringFrozen
              ? `დღეს ${roundStatusKa(current.status)} · snapshot cap ${fmt(snap.competitiveCap)} / მიზანი ${fmt(snap.defaultDailyTarget)}`
              : `დღეს ${roundStatusKa(current.status)} · snapshot ჯერ არ არის, ეს რიცხვები დღესაც იმოქმედებს`,
            tone: current.scoringFrozen ? 'warn' : '',
            content: `
              ${current.scoringFrozen ? alertBox('warn', 'დღევანდელი snapshot დაფიქსირებულია', 'ახალი რიცხვები შემდეგ გაუხსნელ რაუნდზე იმოქმედებს.') : ''}
              <div class="v3-settings-fields">
                ${fieldBlock({ id: 'tm-target', label: 'ნაგულისხმევი მიზანი', value: live.defaultDailyTarget, hint: 'რაიონის დღიური ნაბიჯები', disabled: dis, min: 1000 })}
                ${fieldBlock({ id: 'tm-cap', label: 'ინდივიდუალური ლიმიტი', value: live.competitiveCap, disabled: dis, min: 1000 })}
                ${fieldBlock({ id: 'tm-cool', label: 'რაიონის cooldown (დღე)', value: live.cooldownDays, hint: 'არსებული lockUntilDate არ გადაიწერება', disabled: dis, min: 1 })}
                ${fieldBlock({ id: 'tm-minp', label: 'მინ. მონაწილე რეიტინგისთვის', value: live.minParticipantsForRank, disabled: dis, min: 1 })}
                ${fieldBlock({ id: 'tm-grace', label: 'გვიანი სინქის grace (საათი)', value: live.lateSyncGraceHours, disabled: dis, min: 1, max: 24 })}
                ${fieldBlock({ id: 'tm-sanity', label: 'სანიტარული მაქს. ნაბიჯი', value: live.sanityMaxRawSteps, disabled: dis })}
                ${fieldBlock({ id: 'tm-drop', label: 'ვარდნის flag ზღვარი (%)', value: live.correctionDropFlagPct, disabled: dis, min: 10, max: 90 })}
                ${fieldBlock({ id: 'tm-leader-n', label: 'დაჯილდოებული ადგილები', value: live.leaderRewardedRanks || 3, disabled: dis, min: 1, max: 10 })}
              </div>
              <input id="tm-revision" type="hidden" value="${escA(live.revision)}"/>
            `,
          })}
          ${panel({
            title: 'კოსმეტიკური ჯილდოები',
            description: 'ფულადი პრიზი და Medi Coin არ გაიცემა. ძველ რაუნდზე რეტროაქტიულად არ გამოიგონება.',
            content: `
              ${toggleRow({ id: 'tm-rewards', title: 'კოსმეტიკური ჯილდოები', body: 'ჩართვა მხოლოდ შემდეგ დაფიქსირებულ რაუნდზე იმოქმედებს.', checked: live.rewardsEnabled, disabled: dis })}
              ${toggleRow({ id: 'tm-leader-on', title: 'რაიონის ლიდერების აღიარება', checked: live.leaderRecognitionEnabled !== false, disabled: dis })}
              ${toggleRow({ id: 'tm-goal-badge', title: 'რაიონის მიზნის ბეჯი', checked: live.districtGoalBadgeEnabled !== false, disabled: dis })}
            `,
          })}
          ${manage ? panel({
            title: 'აუდიტი',
            description: 'შენახვა იწერს მიზეზს ოპერაციულ ჟურნალში.',
            content: fieldBlock({ id: 'tm-reason', label: 'აუდიტის მიზეზი', value: '', hint: 'სავალდებულოა, თუ კონსოლი ითხოვს', placeholder: 'rules_update', maxlength: 400, disabled: false, type: 'text' }),
          }) : ''}
        </div>
        ${sticky}
      </div>`;
  }

  async function renderRounds() {
    const list = await tmApi('/rounds');
    const rows = (list.items || [])
      .map(
        (row) => `<tr>
          <td><button class="btn ghost tm-open-round" type="button" data-date="${escA(row.date)}">${esc(row.date)}</button></td>
          <td>${esc(row.lifecycle || row.status)}</td>
          <td>${fmt(row.resultRevision)}</td>
          <td>${row.graceEndsAt ? new Date(row.graceEndsAt).toLocaleString('ka-GE') : '—'}</td>
          <td>${row.canFinalize ? 'მზადაა' : esc(row.blocker || '—')}</td>
        </tr>`,
      )
      .join('');
    return `
      ${panel({
        title: 'დღიური რაუნდები',
        description: 'გამოტოვებული დღეები დღევანდელი წესებით არ რეკონსტრუირდება.',
        content: tableWrap(
          '<tr><th>თარიღი</th><th>ციკლი</th><th>რევიზია</th><th>Grace</th><th></th></tr>',
          rows,
          'რაუნდი არ არის.',
          5,
        ),
      })}
      <div id="tm-round-detail">${panel({
        title: 'რაუნდის დეტალი',
        description: 'აირჩიეთ თარიღი ცხრილიდან.',
        content: '<p class="tm-meta">დეტალი აქ გამოჩნდება.</p>',
      })}</div>`;
  }

  function renderRoundDetail(detail) {
    const life = detail.lifecycle || {};
    const preview = detail.preview;
    const published = detail.published;
    const manage = can('TBILISI_MOVES_MANAGE');
    const correct = can('TBILISI_MOVES_CORRECT');
    const award = preview?.awardCounts || {};
    const blockers = life.canFinalize ? 'ბლოკერი არ არის' : life.blocker || '—';
    const districtRows = ((preview && preview.districts) || (published && published.districts) || [])
      .map((d) => `<tr><td>${esc(d.nameKa)}</td><td>${fmt(d.eligibleSteps)}</td><td>${d.rank == null ? '—' : fmt(d.rank)}</td><td>${d.goalReached ? 'კი' : 'არა'}</td></tr>`)
      .join('');
    return `
      ${panel({
        title: `${detail.date} · ${life.phase || detail.status}`,
        description: `Grace ${detail.graceEndsAt ? new Date(detail.graceEndsAt).toLocaleString('ka-GE') : '—'} · რევიზია ${fmt(detail.resultRevision)} · ${blockers}`,
        content: `
          ${published
            ? `<p class="tm-meta">გამოქვეყნებულია r${fmt(published.revision)} · ჯილდო ${fmt(published.awardCount)} · ${published.kind === 'CORRECTION' ? 'კორექცია' : 'საწყისი'}</p>`
            : '<p class="tm-meta">გამოქვეყნებული შედეგი არ არის.</p>'}
          <p class="tm-meta">მოსალოდნელი ჯილდოები: ლიდერი ${fmt(award.districtLeader || 0)} · მიზანი ${fmt(award.districtGoal || 0)}</p>
          ${tableWrap(
            '<tr><th>რაიონი</th><th>ნაბიჯები</th><th>ადგილი</th><th>მიზანი</th></tr>',
            districtRows,
            'ცარიელი შედეგი — გამარჯვებული არ გამოიგონება.',
            4,
          )}
          <div class="v3-settings-actions">
            ${manage ? `<button class="btn" id="tm-preview" type="button">გადახედვა</button>
              <button class="btn primary" id="tm-finalize" type="button" ${life.canFinalize ? '' : 'disabled'}>ფინალიზაცია</button>` : ''}
          </div>
          ${correct && detail.status === 'FINALIZED' ? `
            ${fieldBlock({ id: 'tm-correct-reason', label: 'კორექციის მიზეზი', value: '', type: 'text', maxlength: 400, placeholder: 'correction' })}
            <div class="v3-settings-actions">
              <button class="btn" id="tm-correct-preview" type="button">კორექციის გადახედვა</button>
              <button class="btn primary" id="tm-correct" type="button">კორექციის დადასტურება</button>
            </div>` : ''}
          <p id="tm-round-status" class="tm-meta"></p>
        `,
      })}`;
  }

  async function renderReview() {
    const review = can('TBILISI_MOVES_REVIEW');
    const list = await tmApi('/rounds');
    const first = list.items?.[0]?.date || '';
    return panel({
      title: 'წვლილის გადახედვა',
      description: 'წყაროს ეტიკეტი დამოწმებული მტკიცებულება არ არის. გამორიცხვა პირად ჯანმრთელობის ჩანაწერს არ ცვლის და შემდეგი სინქი excluded სტატუსს არ აბრუნებს.',
      content: `
        <div class="tm-tools">
          ${fieldBlock({ id: 'tm-review-date', label: 'თარიღი', value: first, type: 'date' })}
          <button class="btn compact" id="tm-load-credits" type="button">ჩატვირთვა</button>
        </div>
        <div id="tm-credit-table" class="table-wrap"></div>
        ${review
          ? fieldBlock({ id: 'tm-review-reason', label: 'მიზეზი', value: '', hint: 'სავალდებულოა გამორიცხვისას', type: 'text', maxlength: 400, placeholder: 'review' })
          : '<p class="tm-meta">გამორიცხვა საჭიროებს TBILISI_MOVES_REVIEW.</p>'}
      `,
    });
  }

  async function renderRewards() {
    const policy = await tmApi('/rewards');
    const awards = await tmApi('/awards?limit=50');
    const live = policy.live || {};
    const rows = (awards.awards || [])
      .map(
        (row) => `<tr>
          <td>${esc(row.date)}</td>
          <td>${esc(row.districtNameKa || row.districtId)}</td>
          <td>${esc(row.publicHandle)}</td>
          <td>${esc(row.titleKa)}</td>
          <td>${esc(row.status)}</td>
          <td>${fmt(row.resultRevision)}</td>
        </tr>`,
      )
      .join('');
    return `
      ${panel({
        title: 'კოსმეტიკური წესები',
        description: `${policy.policy?.note || ''} ფულადი პრიზი / Medi Coin არ გაიცემა. წესების შეცვლა „წესები“ ჩანართშია.`,
        content: `<p class="tm-meta">ჩართული: <strong>${live.rewardsEnabled ? 'კი' : 'არა'}</strong> · ლიდერი 1–${fmt(live.leaderRewardedRanks || 3)} · მიზნის ბეჯი: ${live.districtGoalBadgeEnabled !== false ? 'კი' : 'არა'}</p>`,
      })}
      ${panel({
        title: 'გაცემული ჯილდოები',
        content: tableWrap(
          '<tr><th>თარიღი</th><th>რაიონი</th><th>სახელი</th><th>ჯილდო</th><th>სტატუსი</th><th>რევიზია</th></tr>',
          rows,
          'ჯილდო არ არის.',
          6,
        ),
      })}`;
  }

  function bindDistrictActions(root) {
    root.querySelectorAll('.tm-save-district').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const tr = btn.closest('tr');
        const overrideRaw = tr.querySelector('.tm-override').value.trim();
        try {
          await tmApi(`/districts/${tr.dataset.districtId}`, {
            method: 'PATCH',
            body: {
              revision: Number(tr.dataset.revision),
              sortOrder: Number(tr.querySelector('.tm-sort').value),
              dailyTargetOverride: overrideRaw === '' ? null : Number(overrideRaw),
              reason: 'district_update',
            },
          });
          toastOk('რაიონი შენახულია');
          void renderTbilisiMoves(true);
        } catch (err) {
          toastErr(err);
        }
      });
    });
    root.querySelectorAll('.tm-archive').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const tr = btn.closest('tr');
        try {
          await tmApi(`/districts/${tr.dataset.districtId}/archive`, {
            method: 'POST',
            body: { revision: Number(tr.dataset.revision), reason: 'archive' },
          });
          toastOk('რაიონი დაარქივდა');
          void renderTbilisiMoves(true);
        } catch (err) {
          toastErr(err);
        }
      });
    });
  }

  function bindRules(root) {
    const rules = root.querySelector('[data-tm-rules]') || root;
    const save = root.querySelector('#tm-save-rules');
    const baseline = () => {
      const ids = [
        'tm-feature',
        'tm-enroll',
        'tm-ingest',
        'tm-comp-pause',
        'tm-target',
        'tm-cap',
        'tm-cool',
        'tm-minp',
        'tm-grace',
        'tm-sanity',
        'tm-drop',
        'tm-rewards',
        'tm-leader-on',
        'tm-leader-n',
        'tm-goal-badge',
        'tm-reason',
      ];
      return ids
        .map((id) => {
          const el = root.querySelector(`#${id}`);
          if (!el) return '';
          return el.type === 'checkbox' ? `${id}:${el.checked}` : `${id}:${el.value}`;
        })
        .join('|');
    };
    let start = baseline();
    rules.addEventListener('input', () => {
      const dirty = baseline() !== start;
      rules.classList.toggle('is-dirty', dirty);
      global.AdminV3?.setDirty?.(dirty);
    });
    root.querySelector('#tm-cancel-rules')?.addEventListener('click', () => void renderTbilisiMoves(true));
    if (!save) return;
    save.addEventListener('click', async () => {
      setBusy(save, true);
      try {
        await tmApi('/config', {
          method: 'PATCH',
          body: {
            revision: Number(root.querySelector('#tm-revision').value),
            reason: root.querySelector('#tm-reason').value || 'rules_update',
            featureEnabled: root.querySelector('#tm-feature').checked,
            enrollmentOpen: root.querySelector('#tm-enroll').checked,
            ingestionEnabled: root.querySelector('#tm-ingest').checked,
            competitionPaused: root.querySelector('#tm-comp-pause').checked,
            defaultDailyTarget: Number(root.querySelector('#tm-target').value),
            competitiveCap: Number(root.querySelector('#tm-cap').value),
            cooldownDays: Number(root.querySelector('#tm-cool').value),
            minParticipantsForRank: Number(root.querySelector('#tm-minp').value),
            lateSyncGraceHours: Number(root.querySelector('#tm-grace').value),
            sanityMaxRawSteps: Number(root.querySelector('#tm-sanity').value),
            correctionDropFlagPct: Number(root.querySelector('#tm-drop').value),
            rewardsEnabled: root.querySelector('#tm-rewards').checked,
            leaderRecognitionEnabled: root.querySelector('#tm-leader-on').checked,
            leaderRewardedRanks: Number(root.querySelector('#tm-leader-n').value),
            districtGoalBadgeEnabled: root.querySelector('#tm-goal-badge').checked,
          },
        });
        toastOk('წესები შენახულია');
        void renderTbilisiMoves(true);
      } catch (err) {
        toastErr(err);
        save.textContent = 'შენახვა';
        setBusy(save, false);
      }
    });
  }

  function bindRounds(root) {
    const pane = root.querySelector('#tm-round-detail');
    async function openDate(date) {
      if (!pane || !date) return;
      pane.innerHTML = '<div class="v3-settings-empty"><strong>იტვირთება…</strong></div>';
      try {
        const detail = await tmApi(`/rounds/${date}`);
        ui.roundDate = date;
        ui.preview = detail.preview || null;
        pane.innerHTML = renderRoundDetail(detail);
        bindRoundActions(pane, date, detail);
      } catch (err) {
        pane.innerHTML = `<p>${esc(err.message || err)}</p>`;
      }
    }
    root.querySelectorAll('.tm-open-round').forEach((btn) => {
      btn.addEventListener('click', () => void openDate(btn.dataset.date));
    });
  }

  function bindRoundActions(pane, date, detail) {
    const status = pane.querySelector('#tm-round-status');
    const previewBtn = pane.querySelector('#tm-preview');
    const finalizeBtn = pane.querySelector('#tm-finalize');
    const correctPreviewBtn = pane.querySelector('#tm-correct-preview');
    const correctBtn = pane.querySelector('#tm-correct');
    if (previewBtn) {
      previewBtn.addEventListener('click', async () => {
        setBusy(previewBtn, true);
        try {
          ui.preview = await tmApi(`/rounds/${date}/finalize/preview`, { method: 'POST', body: {} });
          status.textContent = ui.preview.canFinalize
            ? `გადახედვა მზადაა · ჯილდო ${ui.preview.awardCounts?.total || 0}`
            : `ბლოკერი: ${ui.preview.blocker}`;
          toastOk('გადახედვა განახლდა');
        } catch (err) {
          toastErr(err);
        } finally {
          previewBtn.textContent = 'გადახედვა';
          setBusy(previewBtn, false);
        }
      });
    }
    if (finalizeBtn) {
      finalizeBtn.addEventListener('click', async () => {
        if (!ui.preview?.previewHash) {
          toastErr({ message: 'ჯერ გადახედეთ.' });
          return;
        }
        setBusy(finalizeBtn, true);
        try {
          const result = await tmApi(`/rounds/${date}/finalize`, {
            method: 'POST',
            body: { previewHash: ui.preview.previewHash, revision: ui.preview.round.resultRevision },
          });
          toastOk(result.idempotent ? 'უკვე დაფიქსირებულია' : 'რაუნდი დაფიქსირდა');
          void renderTbilisiMoves(true);
        } catch (err) {
          toastErr(err);
          finalizeBtn.textContent = 'ფინალიზაცია';
          setBusy(finalizeBtn, false);
        }
      });
    }
    if (correctPreviewBtn) {
      correctPreviewBtn.addEventListener('click', async () => {
        setBusy(correctPreviewBtn, true);
        try {
          ui.preview = await tmApi(`/rounds/${date}/correct/preview`, { method: 'POST', body: {} });
          status.textContent = `კორექციის გადახედვა · ჯილდო ${ui.preview.awardCounts?.total || 0}`;
          toastOk('კორექციის გადახედვა მზადაა');
        } catch (err) {
          toastErr(err);
        } finally {
          correctPreviewBtn.textContent = 'კორექციის გადახედვა';
          setBusy(correctPreviewBtn, false);
        }
      });
    }
    if (correctBtn) {
      correctBtn.addEventListener('click', async () => {
        const reason = pane.querySelector('#tm-correct-reason')?.value || '';
        if (!ui.preview?.previewHash) {
          toastErr({ message: 'ჯერ გადახედეთ.' });
          return;
        }
        setBusy(correctBtn, true);
        try {
          await tmApi(`/rounds/${date}/correct`, {
            method: 'POST',
            body: {
              previewHash: ui.preview.previewHash,
              fromRevision: detail.resultRevision || ui.preview.round.resultRevision,
              reason,
            },
          });
          toastOk('კორექცია გამოქვეყნდა');
          void renderTbilisiMoves(true);
        } catch (err) {
          toastErr(err);
          correctBtn.textContent = 'კორექციის დადასტურება';
          setBusy(correctBtn, false);
        }
      });
    }
  }

  function bindReview(root) {
    const load = root.querySelector('#tm-load-credits');
    const table = root.querySelector('#tm-credit-table');
    if (!load || !table) return;
    load.addEventListener('click', async () => {
      const date = root.querySelector('#tm-review-date').value;
      table.innerHTML = '<p>იტვირთება…</p>';
      try {
        const data = await tmApi(`/credits?date=${encodeURIComponent(date)}&limit=50`);
        const review = can('TBILISI_MOVES_REVIEW');
        const rows = (data.credits || [])
          .map(
            (row) => `<tr data-credit-id="${escA(row.id)}">
              <td>${esc(row.publicHandle)}</td>
              <td>${esc(row.districtNameKa || '')}</td>
              <td>${fmt(row.eligibleSteps)} / ${fmt(row.rawObservedSteps)}</td>
              <td>${esc(row.provider)}<div class="muted">${esc(row.sourceInstallationId || '')}</div></td>
              <td>${row.excluded ? 'გამორიცხული' : row.flagged ? 'მონიშნული' : 'აქტიური'}</td>
              <td>${review ? `<button class="btn tm-exclude" type="button">${row.excluded ? 'დაბრუნება' : 'გამორიცხვა'}</button>` : '—'}</td>
            </tr>`,
          )
          .join('');
        table.innerHTML = `<p class="muted">${esc(data.evidenceNote || '')}</p>
          <table class="v3-table"><thead><tr><th>სახელი</th><th>რაიონი</th><th>ნაბიჯები</th><th>წყარო</th><th>სტატუსი</th><th></th></tr></thead>
          <tbody>${rows || '<tr><td colspan="6">კრედიტი არ არის.</td></tr>'}</tbody></table>`;
        table.querySelectorAll('.tm-exclude').forEach((btn) => {
          btn.addEventListener('click', async () => {
            const reason = root.querySelector('#tm-review-reason')?.value || '';
            const tr = btn.closest('tr');
            const excluded = btn.textContent.includes('დაბრუნება');
            setBusy(btn, true);
            try {
              await tmApi(`/credits/${tr.dataset.creditId}/${excluded ? 'reinstate' : 'exclude'}`, {
                method: 'POST',
                body: { reason },
              });
              toastOk(excluded ? 'დაბრუნდა' : 'გამოირიცხა');
              load.click();
            } catch (err) {
              toastErr(err);
              btn.textContent = excluded ? 'დაბრუნება' : 'გამორიცხვა';
              setBusy(btn, false);
            }
          });
        });
      } catch (err) {
        table.innerHTML = `<p>${esc(err.message || err)}</p>`;
      }
    });
  }

  async function renderTbilisiMoves(force) {
    const root = $('tab-tbilisi-moves');
    if (!root) return;
    if (!can('TBILISI_MOVES_VIEW')) {
      root.innerHTML = shellHtml(activeTab(), renderDenied());
      bindSubnav(root);
      return;
    }
    const tab = activeTab();
    Shell().writeModuleHash?.('tbilisi-moves', { tab, range: null, grain: null, from: null, to: null });
    const purpose =
      tab === 'rules'
        ? 'ოპერაციული კონტროლი და ქულების წესები — რაიონული სიარული, არა სამედიცინო რეიტინგი.'
        : tab === 'districts'
          ? 'რაიონების მიზნები და რიგი. უკვე გახსნილი რაუნდის snapshot უცვლელია.'
          : tab === 'rounds'
            ? 'დღიური რაუნდები, გადახედვა და ფინალიზაცია.'
            : tab === 'review'
              ? 'წვლილის გადახედვა — წყაროს ეტიკეტი მტკიცებულება არ არის.'
              : tab === 'rewards'
                ? 'კოსმეტიკური ჯილდოები. ფული და Medi Coin არ გაიცემა.'
                : 'რაიონული სიარულის შეჯიბრის კონფიგურაცია და მიმოხილვა.';
    const mountHead = () =>
      Shell().mountHeader?.({
        tab: 'tbilisi-moves',
        kicker: 'Engagement',
        title: 'თბილისი მოძრაობს',
        purpose,
      });
    mountHead();
    let visual = '';
    try {
      const cfg = await tmApi('/config');
      visual = visualBanner(cfg.live);
    } catch {
      visual = '';
    }
    root.innerHTML = shellHtml(tab, `${visual}<div class="v3-settings-empty"><strong>იტვირთება…</strong></div>`);
    bindSubnav(root);
    try {
      let body = '';
      if (tab === 'districts') body = await renderDistricts();
      else if (tab === 'rules') body = await renderRules();
      else if (tab === 'rounds') body = await renderRounds();
      else if (tab === 'review') body = await renderReview();
      else if (tab === 'rewards') body = await renderRewards();
      else body = await renderOverview();
      root.innerHTML = shellHtml(tab, `${visual}${body}`);
      bindSubnav(root);
      mountHead();
      root.querySelector('[data-tm-refresh]')?.addEventListener('click', () => void renderTbilisiMoves(true));
      if (tab === 'districts') bindDistrictActions(root);
      if (tab === 'rules') bindRules(root);
      if (tab === 'rounds') bindRounds(root);
      if (tab === 'review') bindReview(root);
      startTbilisiClock();
    } catch (err) {
      root.innerHTML = shellHtml(tab, `<div class="v3-settings-empty is-err"><strong>ვერ ჩაიტვირთა</strong><p>${esc(err.message || err)}</p></div>`);
      bindSubnav(root);
    }
    void force;
  }

  global.renderTbilisiMoves = renderTbilisiMoves;
  global.patchTbilisiMovesLive = patchTbilisiMovesLive;
  global.patchTbilisiMovesSocket = patchTbilisiMovesSocket;
})(window);
