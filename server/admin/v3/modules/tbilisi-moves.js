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
  const ui = { preview: null, roundDate: '', busy: false };

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
    Shell().writeModuleHash?.('tbilisi-moves', { tab });
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
    return `<div class="v3-tm-visual-banner" role="status">სინთეზური ვიზუალური QA — ეს ნაბიჯები სენსორიდან არ არის. ეს არ არის owner-pilot-ის ნამდვილი გარემო.</div>`;
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

  function kpi(label, value, hint) {
    return `<article class="v3-settings-kpi">
      <div class="v3-settings-kpi-copy">
        <span>${esc(label)}</span>
        <strong>${esc(value)}</strong>
        ${hint ? `<em>${esc(hint)}</em>` : ''}
      </div>
    </article>`;
  }

  function renderDenied() {
    return `<div class="empty">
      <h3>წვდომა შეზღუდულია</h3>
      <p>თბილისი მოძრაობს სანახავად საჭიროა TBILISI_MOVES_VIEW.</p>
    </div>`;
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
      .map(
        (d) => `<tr>
          <td>${esc(d.nameKa)}</td>
          <td>${fmt(d.eligibleSteps)}</td>
          <td>${fmt(d.target)}</td>
          <td>${esc(pct(d.goalRatio))}</td>
          <td>${fmt(d.participantCount)}</td>
          <td class="${d.rank === 1 ? 'tm-rank-1' : d.rank === 2 || d.rank === 3 ? 'tm-rank-podium' : ''}">${d.rank == null ? 'არ არის რეიტინგში' : fmt(d.rank)}</td>
        </tr>`,
      )
      .join('');
    return `
      <div class="v3-settings-kpis">
        ${kpi('რეგისტრირებული', fmt(k.enrolledUsers), 'აქტიური წევრები')}
        ${kpi('მონაწილეები', fmt(k.contributingUsers), 'დადებითი კრედიტი დღეს')}
        ${kpi('დაშვებული ნაბიჯები', fmt(k.eligibleSteps), 'დღევანდელი ჯამი')}
        ${kpi('ბოლო დაკვირვება', k.lastObservationAt ? new Date(k.lastObservationAt).toLocaleString('ka-GE') : '—', 'სერვერის მიღება')}
      </div>
      <div class="v3-card">
        <p class="kicker">პილოტი</p>
        <h3>ინგესტია არ არის დამოწმებული</h3>
        <p>pilotMode მუდმივად ჩართულია. იგივე ნაკადი „verified“ რეჟიმად ვერ გამოცხადდება.</p>
        <p>რაუნდი: <strong>${esc(round.status || 'NOT_OPENED')}</strong>
          ${round.scoringFrozen ? ' · დღევანდელი წესები დაფიქსირებულია' : ' · წესების ცვლილება ჯერ მოქმედებს დღევანდელ გაუხსნელ რაუნდზე'}
          ${round.ingestOpen ? ' · ინგესტია ღიაა' : ' · ინგესტია დახურულია'}</p>
      </div>
      <div class="v3-card">
        <h3>რაიონების პროგრესი</h3>
        <div class="table-wrap"><table class="v3-table">
          <thead><tr><th>რაიონი</th><th>ნაბიჯები</th><th>მიზანი</th><th>თანაფარდობა</th><th>მონაწილე</th><th>ადგილი</th></tr></thead>
          <tbody>${rows || '<tr><td colspan="6">დღეს კრედიტი არ არის.</td></tr>'}</tbody>
        </table></div>
      </div>
      <div class="v3-card">
        <h3>სინქის სიგნალები</h3>
        <p>მონიშნული კრედიტები: <strong>${fmt(issues.flaggedCredits)}</strong></p>
        <p>უგულებელყოფილი დაკვირვებები (7 დღე): ${esc(ignored || 'არ არის')}</p>
        <p class="muted">რუკა და ავტომატური კრონი ამ ფაზაში არ არის. ფინალიზაცია, მოდერაცია და კოსმეტიკური ჯილდოები რაუნდების/გადახედვის ჩანართებშია.</p>
      </div>`;
  }

  async function renderDistricts() {
    const data = await tmApi('/districts');
    const manage = can('TBILISI_MOVES_MANAGE');
    const def = data.config?.defaultDailyTarget;
    const rows = (data.districts || [])
      .map((d) => {
        const override = d.dailyTargetOverride;
        return `<tr data-district-id="${escA(d.id)}" data-revision="${escA(d.revision)}">
          <td>${esc(d.nameKa)}<div class="muted">${esc(d.slug)}</div></td>
          <td>${esc(d.status)}</td>
          <td><input class="tm-sort" type="number" min="0" value="${escA(d.sortOrder)}" ${manage ? '' : 'disabled'}/></td>
          <td>
            <input class="tm-override" type="number" min="1000" placeholder="${escA(def)}" value="${override == null ? '' : escA(override)}" ${manage ? '' : 'disabled'}/>
            <div class="muted">${override == null ? `ნაგულისხმევი (${fmt(def)})` : 'გადაფარვა'}</div>
          </td>
          <td>${manage ? `<button class="btn tm-save-district" type="button">შენახვა</button>
            ${d.status === 'ACTIVE' ? '<button class="btn ghost tm-archive" type="button">არქივი</button>' : ''}` : '—'}</td>
        </tr>`;
      })
      .join('');
    return `
      <div class="v3-card">
        <h3>რაიონები</h3>
        <p>მიზნის ცვლილება მოქმედებს შემდეგ გაუხსნელ რაუნდზე. არსებული რაუნდის snapshot უცვლელია.</p>
        <div class="table-wrap"><table class="v3-table">
          <thead><tr><th>რაიონი</th><th>სტატუსი</th><th>რიგი</th><th>დღიური მიზანი</th><th></th></tr></thead>
          <tbody>${rows}</tbody>
        </table></div>
      </div>`;
  }

  async function renderRules() {
    const data = await tmApi('/config');
    const live = data.live || {};
    const current = data.currentRound || {};
    const manage = can('TBILISI_MOVES_MANAGE');
    const dis = manage ? '' : 'disabled';
    const snap = current.rulesSnapshot || {};
    return `
      <div class="v3-card">
        <p class="kicker">პილოტური რეჟიმი · ჩართულია და არ ირთვება</p>
        <h3>ოპერაციული კონტროლი · ძალაში ახლავე</h3>
        <label class="v3-settings-toggle"><span>ფიჩერი</span>
          <input id="tm-feature" type="checkbox" ${live.featureEnabled ? 'checked' : ''} ${dis}/></label>
        <label class="v3-settings-toggle"><span>რეგისტრაცია</span>
          <input id="tm-enroll" type="checkbox" ${live.enrollmentOpen ? 'checked' : ''} ${dis}/></label>
        <label class="v3-settings-toggle"><span>ინგესტია</span>
          <input id="tm-ingest" type="checkbox" ${live.ingestionEnabled ? 'checked' : ''} ${dis}/></label>
        <label class="v3-settings-toggle"><span>შეჯიბრი შეჩერებულია</span>
          <input id="tm-comp-pause" type="checkbox" ${live.competitionPaused ? 'checked' : ''} ${dis}/></label>
        <p class="muted">პაუზის დროს სრული დღიური ჯამი, რომელიც პაუზის ინტერვალს ემთხვევა, არ მიიღება. შეჯიბრის პაუზა ფინალიზაციას არ აუქმებს — ჯილდოები არ გაიცემა.</p>
      </div>
      <div class="v3-card">
        <h3>ქულების წესები · შემდეგი გაუხსნელი რაუნდი</h3>
        <p>დღეს: <strong>${esc(current.status || 'NOT_OPENED')}</strong>
          ${current.scoringFrozen ? ` · snapshot cap ${fmt(snap.competitiveCap)} / მიზანი ${fmt(snap.defaultDailyTarget)}` : ' · snapshot ჯერ არ არის, ეს რიცხვები დღესაც იმოქმედებს'}</p>
        <label>ნაგულისხმევი მიზანი <input id="tm-target" type="number" value="${escA(live.defaultDailyTarget)}" ${dis}/></label>
        <label>ინდივიდუალური ლიმიტი <input id="tm-cap" type="number" value="${escA(live.competitiveCap)}" ${dis}/></label>
        <label>რაიონის შეცვლის cooldown (დღე) <input id="tm-cool" type="number" value="${escA(live.cooldownDays)}" ${dis}/></label>
        <label>მინ. მონაწილე რეიტინგისთვის <input id="tm-minp" type="number" value="${escA(live.minParticipantsForRank)}" ${dis}/></label>
        <label>გვიანი სინქის grace (საათი) <input id="tm-grace" type="number" value="${escA(live.lateSyncGraceHours)}" ${dis}/></label>
        <label>სანიტარული მაქს. ნაბიჯი <input id="tm-sanity" type="number" value="${escA(live.sanityMaxRawSteps)}" ${dis}/></label>
        <label>ვარდნის flag ზღვარი (%) <input id="tm-drop" type="number" value="${escA(live.correctionDropFlagPct)}" ${dis}/></label>
        <label class="v3-settings-toggle"><span>კოსმეტიკური ჯილდოები</span>
          <input id="tm-rewards" type="checkbox" ${live.rewardsEnabled ? 'checked' : ''} ${dis}/></label>
        <label class="v3-settings-toggle"><span>რაიონის ლიდერების აღიარება</span>
          <input id="tm-leader-on" type="checkbox" ${live.leaderRecognitionEnabled !== false ? 'checked' : ''} ${dis}/></label>
        <label>დაჯილდოებული ადგილები (dense 1–N) <input id="tm-leader-n" type="number" min="1" max="10" value="${escA(live.leaderRewardedRanks || 3)}" ${dis}/></label>
        <label class="v3-settings-toggle"><span>რაიონის მიზნის ბეჯი</span>
          <input id="tm-goal-badge" type="checkbox" ${live.districtGoalBadgeEnabled !== false ? 'checked' : ''} ${dis}/></label>
        <p class="muted">არსებული lockUntilDate cooldown-ის შეცვლაზე არ გადაიწერება. ჯილდოს წესები ძველ რაუნდზე რეტროაქტიულად არ გამოიგონება.</p>
        ${manage ? `<label>მიზეზი <input id="tm-reason" type="text" maxlength="400" placeholder="აუდიტის მიზეზი"/></label>
          <input id="tm-revision" type="hidden" value="${escA(live.revision)}"/>
          <button class="btn primary" id="tm-save-rules" type="button">შენახვა</button>` : ''}
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
      <div class="v3-card">
        <h3>დღიური რაუნდები</h3>
        <p>გამოტოვებული დღეები დღევანდელი წესებით არ რეკონსტრუირდება.</p>
        <div class="table-wrap"><table class="v3-table">
          <thead><tr><th>თარიღი</th><th>ციკლი</th><th>რევიზია</th><th>Grace</th><th></th></tr></thead>
          <tbody>${rows || '<tr><td colspan="5">რაუნდი არ არის.</td></tr>'}</tbody>
        </table></div>
      </div>
      <div id="tm-round-detail" class="v3-card"><p class="muted">აირჩიეთ თარიღი დეტალისთვის.</p></div>`;
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
      <p class="kicker">${esc(detail.date)} · ${esc(life.phase || detail.status)}</p>
      <h3>რაუნდის დეტალი</h3>
      <p>Grace: <strong>${detail.graceEndsAt ? new Date(detail.graceEndsAt).toLocaleString('ka-GE') : '—'}</strong>
        · რევიზია ${fmt(detail.resultRevision)} · ${esc(blockers)}</p>
      ${published ? `<p>გამოქვეყნებულია r${fmt(published.revision)} · ჯილდო ${fmt(published.awardCount)} · ${published.kind === 'CORRECTION' ? 'კორექცია' : 'საწყისი'}</p>` : '<p>გამოქვეყნებული შედეგი არ არის.</p>'}
      <p>მოსალოდნელი ჯილდოები: ლიდერი ${fmt(award.districtLeader || 0)} · მიზანი ${fmt(award.districtGoal || 0)}</p>
      <div class="table-wrap"><table class="v3-table">
        <thead><tr><th>რაიონი</th><th>ნაბიჯები</th><th>ადგილი</th><th>მიზანი</th></tr></thead>
        <tbody>${districtRows || '<tr><td colspan="4">ცარიელი შედეგი — გამარჯვებული არ გამოიგონება.</td></tr>'}</tbody>
      </table></div>
      ${manage ? `<button class="btn" id="tm-preview" type="button">გადახედვა</button>
        <button class="btn primary" id="tm-finalize" type="button" ${life.canFinalize ? '' : 'disabled'}>ფინალიზაცია</button>` : ''}
      ${correct && detail.status === 'FINALIZED' ? `<label>კორექციის მიზეზი <input id="tm-correct-reason" type="text" maxlength="400"/></label>
        <button class="btn" id="tm-correct-preview" type="button">კორექციის გადახედვა</button>
        <button class="btn primary" id="tm-correct" type="button">კორექციის დადასტურება</button>` : ''}
      <p id="tm-round-status" class="muted"></p>`;
  }

  async function renderReview() {
    const review = can('TBILISI_MOVES_REVIEW');
    const list = await tmApi('/rounds');
    const first = list.items?.[0]?.date || '';
    return `
      <div class="v3-card">
        <h3>წვლილის გადახედვა</h3>
        <p>წყაროს ეტიკეტი დამოწმებული მტკიცებულება არ არის. გამორიცხვა პირად ჯანმრთელობის ჩანაწერს არ ცვლის და შემდეგი სინქი excluded სტატუსს არ აბრუნებს.</p>
        <label>თარიღი <input id="tm-review-date" type="date" value="${escA(first)}"/></label>
        <button class="btn" id="tm-load-credits" type="button">ჩატვირთვა</button>
        <div id="tm-credit-table" class="table-wrap"></div>
        ${review ? `<label>მიზეზი <input id="tm-review-reason" type="text" maxlength="400" placeholder="სავალდებულო მიზეზი"/></label>` : '<p class="muted">გამორიცხვა საჭიროებს TBILISI_MOVES_REVIEW.</p>'}
      </div>`;
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
      <div class="v3-card">
        <h3>კოსმეტიკური წესები</h3>
        <p>ჩართული: ${live.rewardsEnabled ? 'კი' : 'არა'} · ლიდერი 1–${fmt(live.leaderRewardedRanks || 3)} · მიზნის ბეჯი: ${live.districtGoalBadgeEnabled !== false ? 'კი' : 'არა'}</p>
        <p class="muted">${esc(policy.policy?.note || '')} ფულადი პრიზი / Medi Coin არ გაიცემა. წესების შეცვლა „წესები“ ჩანართშია.</p>
      </div>
      <div class="v3-card">
        <h3>გაცემული ჯილდოები</h3>
        <div class="table-wrap"><table class="v3-table">
          <thead><tr><th>თარიღი</th><th>რაიონი</th><th>სახელი</th><th>ჯილდო</th><th>სტატუსი</th><th>რევიზია</th></tr></thead>
          <tbody>${rows || '<tr><td colspan="6">ჯილდო არ არის.</td></tr>'}</tbody>
        </table></div>
      </div>`;
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
    const save = root.querySelector('#tm-save-rules');
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
      pane.innerHTML = '<p>იტვირთება…</p>';
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
    let visual = '';
    try {
      const cfg = await tmApi('/config');
      visual = visualBanner(cfg.live);
    } catch {
      visual = '';
    }
    root.innerHTML = shellHtml(tab, `${visual}<div class="empty">იტვირთება…</div>`);
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
      if (tab === 'districts') bindDistrictActions(root);
      if (tab === 'rules') bindRules(root);
      if (tab === 'rounds') bindRounds(root);
      if (tab === 'review') bindReview(root);
    } catch (err) {
      root.innerHTML = shellHtml(tab, `<div class="empty"><h3>ვერ ჩაიტვირთა</h3><p>${esc(err.message || err)}</p></div>`);
      bindSubnav(root);
    }
    void force;
  }

  global.renderTbilisiMoves = renderTbilisiMoves;
})(window);
