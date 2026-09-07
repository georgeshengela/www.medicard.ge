/**
 * MediCard Admin V3 — Orders queue observatory (full override of renderOrders).
 * Operational queue: visits, meds, signups — not commerce checkout.
 * URL range/grain are preserved by shell but unused by this API.
 */
(function adminV3Orders(global) {
  const Shell = () => global.AdminV3Shell || {};
  const V = () => global.AdminV3 || {};
  const $ = (id) => document.getElementById(id);

  const DOCTOR_TYPE_KA = global.DOCTOR_TYPE_KA || {
    GP: 'ოჯახის ექიმი',
    DENTIST: 'სტომატოლოგი',
    CARDIO: 'კარდიოლოგი',
    GYN: 'გინეკოლოგი',
    NEURO: 'ნევროლოგი',
    ORTHO: 'ორთოპედი',
    THERAPIST: 'თერაპევტი',
    OPHTHALMO: 'ოფთალმოლოგი',
    DERM: 'დერმატოლოგი',
    PED: 'პედიატრი',
    OTHER: 'სხვა',
  };

  const FILTERS = [
    ['all', 'ყველა'],
    ['today', 'დღეს'],
    ['visits', 'ვიზიტები'],
    ['meds', 'მედიკამენტები'],
    ['new', 'ახალი ანგარიშები'],
  ];

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
  function doctorLabel(type) {
    if (typeof global.doctorLabel === 'function') return global.doctorLabel(type);
    return DOCTOR_TYPE_KA[String(type || '').toUpperCase()] || type || 'ვიზიტი';
  }
  function doctorName(v) {
    if (typeof global.doctorName === 'function') return global.doctorName(v);
    const name = [v.doctorFirstName, v.doctorLastName].filter(Boolean).join(' ').trim();
    return name || doctorLabel(v.doctorType);
  }
  function initialsOf(name) {
    if (typeof global.initialsOf === 'function') return global.initialsOf(name);
    const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return '•';
    return ((parts[0][0] || '') + (parts[1]?.[0] || '')).toUpperCase();
  }
  function shortDate(iso) {
    if (typeof fmtDateShort === 'function') return fmtDateShort(iso);
    return iso || '—';
  }
  function packageBadge(pkg) {
    if (typeof pkgBadge === 'function') return pkgBadge(pkg);
    if (!pkg) return '<span class="badge neutral">—</span>';
    return `<span class="badge">${esc(pkg.nameKa || pkg.code || '—')}</span>`;
  }
  function openUser(id) {
    if (!id) return;
    if (typeof editUser === 'function') editUser(id);
    else if (typeof global.editUser === 'function') global.editUser(id);
  }

  function kpiCell(icoName, label, value, hint, key, tone, active) {
    const toneClass =
      tone === 'warn'
        ? ' is-amber'
        : tone === 'ok'
          ? ' is-ok'
          : tone === 'soft'
            ? ' is-soft'
            : '';
    const on = active ? ' is-active' : '';
    return `<button type="button" class="v3-orders-kpi${toneClass}${on}" data-orders-filter="${esc(key)}" aria-pressed="${active ? 'true' : 'false'}">
      <span class="v3-orders-kpi-ico" aria-hidden="true">${ico(icoName)}</span>
      <div class="v3-orders-kpi-copy">
        <span>${esc(label)}</span>
        <strong>${value}</strong>
        ${hint ? `<em>${esc(hint)}</em>` : ''}
      </div>
    </button>`;
  }

  function emptyCol(title) {
    return `<div class="v3-orders-empty-col"><span class="v3-orders-empty-ico">${ico('layers')}</span><strong>${esc(title)}</strong></div>`;
  }

  function visitCard(v, tone) {
    const place = v.addressLabel || v.address || 'მისამართი არ არის';
    const chip = tone === 'today' ? 'დღეს' : 'დაგეგმილი';
    const when = `${v.visitTime || '—'} · ${shortDate(`${v.visitDate}T12:00:00`)}`;
    return `<button type="button" class="v3-orders-card is-visit is-${tone}" data-open-user="${esc(v.user?.id || '')}">
      <div class="v3-orders-card-meta">
        <time>${esc(when)}</time>
        <span class="v3-orders-chip is-${tone}">${esc(chip)}</span>
      </div>
      <div class="v3-orders-card-main">
        <strong>${esc(doctorName(v))}</strong>
        <p>${esc(doctorLabel(v.doctorType))}</p>
      </div>
      <div class="v3-orders-who">
        <i>${esc(initialsOf(v.user?.fullName))}</i>
        <div>
          <b>${esc(v.user?.fullName || '—')}</b>
          <span>${esc(place)}</span>
        </div>
      </div>
    </button>`;
  }

  function medCard(m) {
    return `<button type="button" class="v3-orders-card is-med" data-open-user="${esc(m.user?.id || '')}">
      <div class="v3-orders-card-meta">
        <time>${esc(shortDate(m.createdAt))}</time>
        <span class="v3-orders-chip is-med">აქტიური</span>
      </div>
      <div class="v3-orders-card-main">
        <strong>${esc(m.medName)}</strong>
        <p>${esc(m.dosage || '—')}${m.frequency ? ` · ${esc(m.frequency)}` : ''}</p>
      </div>
      <div class="v3-orders-who">
        <i>${esc(initialsOf(m.user?.fullName))}</i>
        <div>
          <b>${esc(m.user?.fullName || '—')}</b>
          <span>${esc(m.user?.email || '')}</span>
        </div>
      </div>
    </button>`;
  }

  function signupRow(u) {
    return `<button type="button" class="v3-orders-card is-signup" data-open-user="${esc(u.id)}">
      <div class="v3-orders-who is-lead">
        <i>${esc(initialsOf(u.fullName))}</i>
        <div>
          <b>${esc(u.fullName)}</b>
          <span>${esc(u.email)}</span>
        </div>
      </div>
      ${packageBadge(u.package)}
    </button>`;
  }

  function sectionPanel(opts) {
    return `<section class="v3-orders-panel" data-orders-col="${esc(opts.key)}" ${opts.hidden ? 'hidden' : ''}>
      <div class="v3-orders-head">
        <div class="v3-orders-head-copy">
          <div class="v3-title-row">
            <span class="v3-orders-dot is-${esc(opts.tone)}" aria-hidden="true"></span>
            <h3>${esc(opts.title)}</h3>
          </div>
          <p class="muted">${esc(opts.subtitle || '')}</p>
        </div>
        <span class="v3-orders-count">${fmt(opts.count)}</span>
      </div>
      <div class="v3-orders-list" id="${esc(opts.listId)}"></div>
    </section>`;
  }

  async function renderOrdersV3() {
    Shell().mountHeader?.({
      tab: 'orders',
      kicker: 'Operations',
      title: 'შეკვეთები',
      purpose: 'დღევანდელი ვიზიტები, მედიკამენტები და ახალი ანგარიშები — ერთ რიგში.',
      helpKey: 'orders.page',
    });

    const root = $('tab-orders');
    if (!root) return;

    root.classList.add('v3-workspace-wide', 'v3-module', 'v3-orders');
    root.innerHTML = `<div class="v3-orders-body dash-enter" data-v3-orders="loading">
      <div class="v3-orders-toolbar">
        <div class="v3-orders-toolbar-copy">
          <strong>ოპერაციების რიგი</strong>
          <span>იტვირთება…</span>
        </div>
      </div>
    </div>`;

    let data;
    try {
      data = await api('/orders');
    } catch (e) {
      root.innerHTML = `<div class="v3-orders-body" data-v3-orders="error">
        <div class="v3-orders-empty is-err">
          <strong>რიგი ვერ ჩაიტვირთა</strong>
          <p>${esc(e.message || 'უცნობი შეცდომა')}</p>
          <button type="button" class="btn ghost compact" id="ord-retry">${ico('refresh')} ხელახლა ცდა</button>
        </div>
      </div>`;
      $('ord-retry')?.addEventListener('click', () => void renderOrdersV3());
      return;
    }

    const today = data.today;
    const visits = data.visits || [];
    const todayVisits = visits.filter((v) => v.visitDate === today);
    const laterVisits = visits.filter((v) => v.visitDate !== today);
    const medsAll = data.medications || [];
    const signupsAll = data.signups || [];
    const k = data.kpis || {};
    const jobs = data.jobs || [];

    let filter = 'all';
    let query = '';

    function paint() {
      const q = query.trim().toLowerCase();
      const match = (text) => !q || String(text || '').toLowerCase().includes(q);
      const visFilter = (v) => {
        const hay = [v.user?.fullName, v.user?.email, doctorName(v), v.addressLabel, v.address, v.doctorType].join(' ');
        if (!match(hay)) return false;
        if (filter === 'today') return v.visitDate === today;
        if (filter === 'visits') return true;
        if (filter === 'meds' || filter === 'new') return false;
        return true;
      };
      const meds = medsAll.filter((m) => {
        if (filter === 'visits' || filter === 'today' || filter === 'new') return false;
        return match([m.medName, m.user?.fullName, m.dosage].join(' '));
      });
      const signups = signupsAll.filter((u) => {
        if (filter === 'visits' || filter === 'today' || filter === 'meds') return false;
        return match([u.fullName, u.email, u.package?.nameKa].join(' '));
      });
      const shownToday = todayVisits.filter(visFilter);
      const shownLater = laterVisits.filter(visFilter);

      const todayEl = root.querySelector('#orders-today-list');
      const laterEl = root.querySelector('#orders-later-list');
      const medsEl = root.querySelector('#orders-meds-list');
      const feedEl = root.querySelector('#orders-feed');
      if (todayEl) {
        todayEl.innerHTML = shownToday.length
          ? shownToday.map((v) => visitCard(v, 'today')).join('')
          : emptyCol('დღეს ვიზიტი არ არის');
      }
      if (laterEl) {
        laterEl.innerHTML = shownLater.length
          ? shownLater.map((v) => visitCard(v, 'soon')).join('')
          : emptyCol('მოახლოებული ვიზიტი არ არის');
      }
      if (medsEl) {
        medsEl.innerHTML = meds.length ? meds.map(medCard).join('') : emptyCol('აქტიური მედიკამენტი არ ჩანს');
      }
      if (feedEl) {
        feedEl.innerHTML = signups.length ? signups.map(signupRow).join('') : emptyCol('ახალი ანგარიში არ არის');
      }

      const show = {
        today: filter === 'all' || filter === 'today' || filter === 'visits',
        later: filter === 'all' || filter === 'visits',
        meds: filter === 'all' || filter === 'meds',
        new: filter === 'all' || filter === 'new',
      };
      root.querySelectorAll('[data-orders-col]').forEach((el) => {
        el.hidden = !show[el.dataset.ordersCol];
      });

      root.querySelectorAll('[data-orders-filter]').forEach((btn) => {
        const on = btn.dataset.ordersFilter === filter;
        btn.classList.toggle('is-active', on);
        btn.classList.toggle('active', on);
        if (btn.hasAttribute('aria-pressed')) btn.setAttribute('aria-pressed', String(on));
        if (btn.getAttribute('role') === 'tab') btn.setAttribute('aria-selected', String(on));
      });

      root.querySelectorAll('[data-open-user]').forEach((el) => {
        el.onclick = () => openUser(el.getAttribute('data-open-user'));
      });
    }

    root.innerHTML = `
      <div class="v3-orders-body dash-enter" data-v3-orders="page">
        ${
          jobs.length
            ? `<div class="v3-orders-live" role="status">
                <span class="v3-orders-live-ico">${ico('activity')}</span>
                <div><strong>სინქი მიმდინარეობს</strong><span>${jobs.map((j) => esc(j.source)).join(' · ')}</span></div>
                <span class="v3-orders-live-dot" aria-hidden="true"></span>
              </div>`
            : ''
        }

        <div class="v3-orders-toolbar">
          <div class="v3-orders-toolbar-copy">
            <strong>ოპერაციების რიგი</strong>
            <span>თბილისის დღე · ვიზიტები, მედიკამენტები და ახალი ანგარიშები</span>
          </div>
          <div class="v3-orders-toolbar-actions">
            ${helpBtn('orders.queue')}
            <button type="button" class="btn ghost compact" id="ord-refresh">${ico('refresh')} განახლება</button>
          </div>
        </div>

        <div class="v3-orders-kpis" role="group" aria-label="რიგის მდგომარეობა">
          ${kpiCell('calendar', 'დღეს', fmt(k.visitsToday), 'ვიზიტი თბილისის დღეს', 'today', Number(k.visitsToday) > 0 ? 'ok' : 'soft', false)}
          ${kpiCell('activity', '7 დღე', fmt(k.visitsWeek), 'მოახლოებული ვიზიტი', 'visits', 'soft', false)}
          ${kpiCell('pill', 'მედიკამენტები', fmt(k.activeMeds), 'აქტიური გრაფიკი', 'meds', Number(k.activeMeds) > 0 ? 'ok' : '', false)}
          ${kpiCell('zap', 'ახალი', fmt(k.newUsersToday), 'რეგისტრაცია დღეს', 'new', Number(k.newUsersToday) > 0 ? 'ok' : 'soft', false)}
        </div>

        <div class="v3-orders-controls">
          <div class="v3-orders-filters" role="tablist" aria-label="რიგის ფილტრი">
            ${FILTERS.map(
              ([key, label]) =>
                `<button type="button" role="tab" data-orders-filter="${key}" aria-selected="${key === 'all' ? 'true' : 'false'}" class="${key === 'all' ? 'is-active' : ''}">${esc(label)}</button>`,
            ).join('')}
          </div>
          <label class="v3-orders-search">
            <span class="sr-only">ძებნა</span>
            ${ico('search')}
            <input id="orders-q" type="search" placeholder="სახელი, ექიმი, მედიკამენტი…" autocomplete="off" />
          </label>
        </div>

        <div class="v3-orders-queue">
          ${sectionPanel({
            key: 'today',
            tone: 'now',
            title: 'დღეს',
            subtitle: 'დღევანდელი ვიზიტები',
            count: todayVisits.length,
            listId: 'orders-today-list',
          })}
          ${sectionPanel({
            key: 'later',
            tone: 'soon',
            title: 'მოახლოებული',
            subtitle: 'შემდეგი 21 დღე',
            count: laterVisits.length,
            listId: 'orders-later-list',
          })}
          ${sectionPanel({
            key: 'meds',
            tone: 'med',
            title: 'მედიკამენტები',
            subtitle: 'აქტიური გრაფიკები',
            count: medsAll.length,
            listId: 'orders-meds-list',
          })}
          ${sectionPanel({
            key: 'new',
            tone: 'new',
            title: 'ახალი ანგარიშები',
            subtitle: 'ბოლო რეგისტრაციები',
            count: signupsAll.length,
            listId: 'orders-feed',
          })}
        </div>
      </div>
    `;

    paint();

    $('ord-refresh')?.addEventListener('click', () => void renderOrdersV3());
    root.querySelectorAll('[data-orders-filter]').forEach((btn) => {
      btn.addEventListener('click', () => {
        filter = btn.dataset.ordersFilter || 'all';
        paint();
      });
    });
    $('orders-q')?.addEventListener('input', (e) => {
      query = e.target.value || '';
      paint();
    });
  }

  global.renderOrders = renderOrdersV3;
})(window);
