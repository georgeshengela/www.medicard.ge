/**
 * MediCard Admin V3 — Operational queue (full override of renderOrders).
 * Visits, medication schedules and new accounts — not commerce checkout.
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
  /** Sign-ups without a name get this placeholder (server/src/lib/socialAuth.js DEFAULT_SOCIAL_NAME). */
  const PLACEHOLDER_NAME = 'Medicard მომხმარებელი';
  const WEEKDAYS = ['კვირა', 'ორშაბათი', 'სამშაბათი', 'ოთხშაბათი', 'ხუთშაბათი', 'პარასკევი', 'შაბათი'];
  const MONTHS = ['იან', 'თებ', 'მარ', 'აპრ', 'მაი', 'ივნ', 'ივლ', 'აგვ', 'სექ', 'ოქტ', 'ნოე', 'დეკ'];

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
  function openUser(id) {
    if (!id) return;
    if (typeof editUser === 'function') editUser(id);
    else if (typeof global.editUser === 'function') global.editUser(id);
  }
  function when(iso) {
    if (!iso) return '—';
    return V().formatDate ? V().formatDate(iso, 'datetime') : String(iso);
  }
  /** "+995 591 00 00 00" for a Georgian mobile, otherwise the digits as given. */
  function fmtPhone(raw) {
    const d = String(raw || '').replace(/\D/g, '');
    if (/^9955\d{8}$/.test(d)) return `+995 ${d.slice(3, 6)} ${d.slice(6, 8)} ${d.slice(8, 10)} ${d.slice(10)}`;
    return raw ? String(raw) : '';
  }
  /**
   * Phone and Apple sign-ups carry a synthetic login (…@phone.medicard.ge / …@apple.medicard.ge) and often the
   * placeholder name — show the person by what is real: name, phone or "Apple-ით შესული".
   */
  function personOf(u) {
    const email = String(u?.email || '');
    const domain = email.split('@')[1] || '';
    const phoneLogin = domain === 'phone.medicard.ge' ? email.split('@')[0] : '';
    const apple = domain === 'apple.medicard.ge';
    const phone = fmtPhone(u?.phone || phoneLogin);
    const name = String(u?.fullName || '').trim();
    const named = Boolean(name) && name !== PLACEHOLDER_NAME;
    const contact = apple ? 'Apple-ით შესული' : phoneLogin || !email ? phone : email;
    if (named) return { main: name, sub: contact || '' };
    return { main: contact || 'უცნობი ანგარიში', sub: 'სახელი არ აქვს' };
  }
  function two(main, sub) {
    return `<div class="p2-two"><b>${main}</b>${sub ? `<small>${sub}</small>` : ''}</div>`;
  }
  function personCell(u) {
    const p = personOf(u);
    return two(esc(p.main), esc(p.sub));
  }
  function doctorCell(v) {
    const name = [v.doctorFirstName, v.doctorLastName].filter(Boolean).join(' ').trim();
    return name ? two(esc(name), esc(doctorLabel(v.doctorType))) : two(esc(doctorLabel(v.doctorType)), 'ექიმის სახელი არ არის');
  }
  function placeCell(v) {
    if (!v.addressLabel && !v.address) return '<span class="s-muted">მისამართი არ არის</span>';
    return two(esc(v.addressLabel || v.address), v.addressLabel && v.address ? esc(v.address) : '');
  }
  /** "3 ოქტ, პარასკევი" for a Tbilisi calendar day key. */
  function dayTitle(ymd) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(ymd || ''));
    if (!m) return String(ymd || '—');
    const wd = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]))).getUTCDay();
    return `${Number(m[3])} ${MONTHS[Number(m[2]) - 1]}, ${WEEKDAYS[wd]}`;
  }
  function addDays(ymd, n) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(ymd || ''));
    if (!m) return '';
    return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]) + n)).toISOString().slice(0, 10);
  }
  function emptyHtml(text) {
    return `<div class="s-empty p2-empty-sm">${ico('calendar')}<span>${esc(text)}</span></div>`;
  }
  function table(head, rows) {
    return `<div class="s-table-wrap"><table class="s-table"><thead><tr>${head}</tr></thead><tbody>${rows}</tbody></table></div>`;
  }

  function visitRow(v) {
    return `<tr class="is-click" tabindex="0" data-open-user="${esc(v.user?.id || '')}">
      <td class="p2-time"><b>${esc(v.visitTime || '—')}</b></td>
      <td>${doctorCell(v)}</td>
      <td>${personCell(v.user)}</td>
      <td>${placeCell(v)}</td>
    </tr>`;
  }

  function section({ key, title, desc, countId, listId, help }) {
    return `<section class="s-card" data-orders-col="${esc(key)}">
      <header class="s-card-head">
        <div><h3>${esc(title)}</h3>${desc ? `<p>${desc}</p>` : ''}</div>
        <div class="p2-row-end"><span class="p2-meta" id="${esc(countId)}"></span>${help || ''}</div>
      </header>
      <div class="s-card-body is-flush" id="${esc(listId)}"></div>
    </section>`;
  }

  async function renderOrdersV3() {
    Shell().mountHeader?.({
      tab: 'orders',
      kicker: 'Operations',
      title: 'ოპერაციული რიგი',
      purpose: 'ექიმთან ვიზიტები, მედიკამენტები და ახალი ანგარიშები.',
      helpKey: 'orders.page',
      actionsHtml: `<button type="button" class="btn ghost compact" id="ord-refresh">${ico('refresh')} განახლება</button>`,
    });
    $('ord-refresh')?.addEventListener('click', () => void renderOrdersV3());

    const root = $('tab-orders');
    if (!root) return;

    root.classList.add('v3-workspace-wide', 'v3-orders');
    root.innerHTML = `<div class="s-stack v3-tab-shell p2-ops" data-v3-orders="loading">${V().skeleton ? V().skeleton(6) : ''}</div>`;

    let data;
    try {
      data = await api('/orders');
    } catch (e) {
      root.innerHTML = `<div class="s-stack v3-tab-shell p2-ops" data-v3-orders="error">
        <div class="s-card"><div class="s-empty">${ico('alert')}<strong>რიგი ვერ ჩაიტვირთა</strong><span>${esc(e.message || 'უცნობი შეცდომა')}</span>
          <button type="button" class="btn compact" id="ord-retry">${ico('refresh')} ხელახლა ცდა</button></div></div>
      </div>`;
      $('ord-retry')?.addEventListener('click', () => void renderOrdersV3());
      return;
    }

    const today = data.today;
    const tomorrow = addDays(today, 1);
    const visits = data.visits || [];
    const todayVisits = visits.filter((v) => v.visitDate === today);
    const laterVisits = visits.filter((v) => v.visitDate !== today);
    const medsAll = data.medications || [];
    const signupsAll = data.signups || [];
    const k = data.kpis || {};
    const jobs = data.jobs || [];

    let filter = 'all';
    let query = '';
    let laterExpanded = false;
    const weekEnd = addDays(today, 7);

    function paint() {
      const q = query.trim().toLowerCase();
      const match = (text) => !q || String(text || '').toLowerCase().includes(q);
      const personText = (u) => {
        const p = personOf(u);
        return [u?.fullName, u?.email, u?.phone, p.main, p.sub].join(' ');
      };
      const visFilter = (v) => {
        const hay = [personText(v.user), v.doctorFirstName, v.doctorLastName, doctorLabel(v.doctorType), v.addressLabel, v.address, v.doctorType].join(' ');
        if (!match(hay)) return false;
        if (filter === 'today') return v.visitDate === today;
        if (filter === 'visits') return true;
        if (filter === 'meds' || filter === 'new') return false;
        return true;
      };
      const meds = medsAll.filter((m) => {
        if (filter === 'visits' || filter === 'today' || filter === 'new') return false;
        return match([m.medName, personText(m.user), m.dosage].join(' '));
      });
      const signups = signupsAll.filter((u) => {
        if (filter === 'visits' || filter === 'today' || filter === 'meds') return false;
        return match([personText(u), u.package?.nameKa].join(' '));
      });
      const shownToday = todayVisits.filter(visFilter);
      const shownLater = laterVisits.filter(visFilter);
      const counted = (shown, total, unit) => `${q && shown !== total ? `${fmt(shown)} / ${fmt(total)}` : fmt(total)} ${unit}`;

      const todayEl = root.querySelector('#orders-today-list');
      const laterEl = root.querySelector('#orders-later-list');
      const medsEl = root.querySelector('#orders-meds-list');
      const feedEl = root.querySelector('#orders-feed');
      const visitHead = '<th>დრო</th><th>ექიმი</th><th>მომხმარებელი</th><th>ადგილი</th>';
      if (todayEl) {
        todayEl.innerHTML = shownToday.length
          ? table(visitHead, shownToday.map(visitRow).join(''))
          : emptyHtml(q ? 'ძიებას დღევანდელი ვიზიტი არ ემთხვევა' : 'დღეს ვიზიტი არ არის');
      }
      if (laterEl) {
        // The next week first; the rest of the 21 days opens on request (search and the visits filter show all).
        const all = laterExpanded || q || filter === 'visits';
        const listed = all ? shownLater : shownLater.filter((v) => v.visitDate < weekEnd);
        const rest = shownLater.length - listed.length;
        let lastDay = '';
        const rows = listed.map((v) => {
          let head = '';
          if (v.visitDate !== lastDay) {
            lastDay = v.visitDate;
            const n = listed.filter((x) => x.visitDate === v.visitDate).length;
            head = `<tr class="p2-group"><td colspan="4">${v.visitDate === tomorrow ? 'ხვალ · ' : ''}${esc(dayTitle(v.visitDate))}<span>${fmt(n)} ვიზიტი</span></td></tr>`;
          }
          return head + visitRow(v);
        }).join('');
        laterEl.innerHTML = shownLater.length
          ? `${listed.length ? table(visitHead, rows) : emptyHtml('მომდევნო 7 დღეში ვიზიტი არ არის')}${rest > 0 ? `<div class="s-pager"><span>ნაჩვენებია მომდევნო 7 დღე</span><div><button type="button" class="btn ghost compact" id="orders-later-more">კიდევ ${fmt(rest)} ვიზიტი — 21 დღემდე</button></div></div>` : ''}`
          : emptyHtml(q ? 'ძიებას მომავალი ვიზიტი არ ემთხვევა' : 'მომდევნო 21 დღეში ვიზიტი არ არის');
        laterEl.querySelector('#orders-later-more')?.addEventListener('click', () => {
          laterExpanded = true;
          paint();
        });
      }
      if (medsEl) {
        medsEl.innerHTML = meds.length
          ? table('<th>მედიკამენტი</th><th>მომხმარებელი</th><th>დაემატა</th>', meds.map((m) => `<tr class="is-click" tabindex="0" data-open-user="${esc(m.user?.id || '')}">
              <td>${two(esc(m.medName), esc([m.dosage, m.frequency].filter(Boolean).join(' · ')))}</td>
              <td>${personCell(m.user)}</td>
              <td class="s-muted p2-nowrap">${esc(when(m.createdAt))}</td>
            </tr>`).join(''))
          : emptyHtml(q ? 'ძიებას მედიკამენტი არ ემთხვევა' : 'აქტიური მედიკამენტი არ ჩანს');
      }
      if (feedEl) {
        feedEl.innerHTML = signups.length
          ? table('<th>ანგარიში</th><th>რეგისტრაცია</th>', signups.map((u) => `<tr class="is-click" tabindex="0" data-open-user="${esc(u.id)}">
              <td>${personCell(u)}</td>
              <td class="s-muted p2-nowrap">${esc(when(u.createdAt))}</td>
            </tr>`).join(''))
          : emptyHtml(q ? 'ძიებას ანგარიში არ ემთხვევა' : 'ახალი ანგარიში არ არის');
      }
      const setCount = (id, text) => {
        const el = root.querySelector(`#${id}`);
        if (el) el.textContent = text;
      };
      setCount('orders-today-count', counted(shownToday.length, todayVisits.length, 'ვიზიტი'));
      setCount('orders-later-count', counted(shownLater.length, laterVisits.length, 'ვიზიტი'));
      setCount('orders-meds-count', counted(meds.length, medsAll.length, 'გრაფიკი'));
      setCount('orders-new-count', counted(signups.length, signupsAll.length, 'ანგარიში'));

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
        if (btn.hasAttribute('aria-pressed')) btn.setAttribute('aria-pressed', String(on));
        if (btn.getAttribute('role') === 'tab') btn.setAttribute('aria-selected', String(on));
      });

      root.querySelectorAll('[data-open-user]').forEach((el) => {
        el.onclick = () => openUser(el.getAttribute('data-open-user'));
        el.onkeydown = (e) => {
          if (e.key !== 'Enter' && e.key !== ' ') return;
          e.preventDefault();
          openUser(el.getAttribute('data-open-user'));
        };
      });
    }

    const tile = (key, label, value, hint, tone) => `<button type="button" class="s-metric p2-metric-btn${tone ? ` is-${tone}` : ''}" data-orders-filter="${key}" aria-pressed="false">
        <span>${esc(label)}</span><strong>${value}</strong><small>${esc(hint)}</small>
      </button>`;

    root.innerHTML = `
      <div class="s-stack v3-tab-shell p2-ops" data-v3-orders="page">
        <div class="s-toolbar">
          <div class="s-segment" role="tablist" aria-label="რიგის ფილტრი">
            ${FILTERS.map(([key, label]) => `<button type="button" role="tab" data-orders-filter="${key}" aria-selected="${key === 'all'}">${esc(label)}</button>`).join('')}
          </div>
          <div class="p2-row-end">
            ${jobs.length ? `<a class="s-badge is-info p2-link-badge" href="#/pharmacy" title="${esc(jobs.map((j) => j.source).join(' · '))}">ფარმაციის სინქი მიმდინარეობს</a>` : ''}
            <label class="p2-search">
              <span class="sr-only">ძებნა</span>
              ${ico('search')}
              <input id="orders-q" type="search" placeholder="სახელი, ტელეფონი, ექიმი, მედიკამენტი…" autocomplete="off" />
            </label>
            ${helpBtn('orders.queue')}
          </div>
        </div>

        <div class="s-metrics" role="group" aria-label="რიგის მდგომარეობა">
          ${tile('today', 'ვიზიტები დღეს', fmt(k.visitsToday), 'თბილისის დროით')}
          ${tile('visits', 'ვიზიტები 7 დღეში', fmt(k.visitsWeek), 'დღეს და მომდევნო 6 დღე')}
          ${tile('meds', 'აქტიური მედიკამენტები', fmt(k.activeMeds), 'მიღების გრაფიკი, ყველა ანგარიშზე')}
          ${tile('new', 'ახალი ანგარიშები დღეს', fmt(k.newUsersToday), 'რეგისტრაცია თბილისის დღეში')}
        </div>

        ${section({
          key: 'today',
          title: 'დღეს',
          desc: esc(dayTitle(today)),
          countId: 'orders-today-count',
          listId: 'orders-today-list',
        })}
        ${section({
          key: 'later',
          title: 'მომდევნო 21 დღე',
          desc: `ხვალიდან, დღეების მიხედვით${visits.length >= 80 ? ' · ნაჩვენებია უახლოესი 80 ვიზიტი' : ''}.`,
          countId: 'orders-later-count',
          listId: 'orders-later-list',
        })}
        <div class="p2-split">
          ${section({
            key: 'meds',
            title: 'ბოლოს დამატებული მედიკამენტები',
            desc: `უახლესი ${fmt(medsAll.length)} აქტიური გრაფიკი (სულ ${fmt(k.activeMeds)}).`,
            countId: 'orders-meds-count',
            listId: 'orders-meds-list',
          })}
          ${section({
            key: 'new',
            title: 'ახალი ანგარიშები',
            desc: `ბოლო ${fmt(signupsAll.length)} რეგისტრაცია.`,
            countId: 'orders-new-count',
            listId: 'orders-feed',
          })}
        </div>
      </div>
    `;

    paint();

    root.querySelectorAll('[data-orders-filter]').forEach((btn) => {
      btn.addEventListener('click', () => {
        filter = btn.dataset.ordersFilter === filter && btn.hasAttribute('aria-pressed') ? 'all' : (btn.dataset.ordersFilter || 'all');
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
