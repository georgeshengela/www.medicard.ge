/**
 * MediCard Admin V4 — #/pets MEDIVET (/api/admin/pets/overview).
 * Who uses „ჩემი ცხოველები“ and how: what the numbers say, the ladder from adding a pet to asking Medi Vet,
 * every pet as a card with its usage track (the page's one bold element, in the MEDIVET sky), the period
 * trend, who the pets are, care + reminders and Medi Vet quality. Team (@medicard.ge) accounts are left out
 * unless „გუნდის ჩათვლით“ — the App Review demo's seeded pets would otherwise look like real use.
 * Never shows chat text, allergy / condition names or notes: the conversations stay in Medi (#/ai).
 */
(function adminV4Pets(global) {
  const doc = document;
  const $ = (id) => doc.getElementById(id);
  const V = () => global.AdminV3 || {};
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const ico = (n) => (typeof global.icon === 'function' ? global.icon(n) : '');
  const fmt = (n) => (Number.isFinite(Number(n)) ? Number(n).toLocaleString('ka-GE') : '—');
  const pct = (n) => (n == null || !Number.isFinite(Number(n)) ? '—' : `${Number(n).toLocaleString('ka-GE', { maximumFractionDigits: 1 })}%`);
  const share = (part, whole) => (whole ? Math.round((part / whole) * 1000) / 10 : null);
  const when = (iso, mode = 'datetime') => (!iso ? '—' : V().formatDate ? V().formatDate(iso, mode) : String(iso).slice(0, 10));
  const skel = () => `<div class="s-stack"><div class="v3-skel" aria-hidden="true">${'<i></i>'.repeat(6)}</div></div>`;
  const PAGE = 24;

  let days = 30;
  let team = false;
  let filter = 'all';
  let query = '';
  let shown = PAGE;
  let data = null;
  let ticket = 0;

  // Sidebar + species glyphs, same 24px stroke family as the rest of the admin.
  if (typeof ICONS === 'object') {
    Object.assign(ICONS, {
      paw: '<ellipse cx="6.2" cy="10.2" rx="1.7" ry="2.1"/><ellipse cx="9.7" cy="6" rx="1.7" ry="2.2"/><ellipse cx="14.3" cy="6" rx="1.7" ry="2.2"/><ellipse cx="17.8" cy="10.2" rx="1.7" ry="2.1"/><path d="M12 11.5c-2.6 0-5 3.1-5 5.6 0 1.7 1.2 2.6 2.6 2.6 1 0 1.6-.5 2.4-.5s1.4.5 2.4.5c1.4 0 2.6-.9 2.6-2.6 0-2.5-2.4-5.6-5-5.6z"/>',
      petDog: '<path d="M8.2 5.5h7.6l2.4 1.2c1.5.8 2.3 2.4 2.3 4.1v1.4l-2.6-1.4v3.1c0 3.6-2.7 6.6-5.9 6.6s-5.9-3-5.9-6.6v-3.1L3.5 12.2v-1.4c0-1.7.8-3.3 2.3-4.1z"/><path d="M10.6 16.4h2.8L12 17.9z"/><path d="M9.6 11.6h.01M14.4 11.6h.01"/>',
      petCat: '<path d="M4.8 10.3 4.3 3.8l4.4 3.1a8.4 8.4 0 0 1 6.6 0l4.4-3.1-.5 6.5c.6 1 .9 2.2.9 3.4 0 4.3-3.8 7.3-8.1 7.3S3.9 18 3.9 13.7c0-1.2.3-2.4.9-3.4z"/><path d="M10.8 15.4h2.4L12 16.7z"/><path d="M9.2 12.4h.01M14.8 12.4h.01"/><path d="M6.5 15.2 3 14.6M6.7 16.6l-3.2.9M17.5 15.2l3.5-.6M17.3 16.6l3.2.9"/>',
      petBird: '<path d="M15.5 8.2a3.2 3.2 0 0 0-6.1-1.3L4 15.6c2.3 1.5 5.6 1.9 8.2.8"/><path d="M15.5 8.2 20 7.4l-4.1 2.4c.2 3-1.1 5.5-3.7 6.6l1.6 4.1"/><path d="M12.6 7.6h.01"/>',
      petFish: '<path d="M4.5 12c2.4-3.6 5.6-5.2 9-5.2 3 0 5.4 2 6.6 5.2-1.2 3.2-3.6 5.2-6.6 5.2-3.4 0-6.6-1.6-9-5.2z"/><path d="M4.5 12 2 8.8M4.5 12 2 15.2"/><path d="M16.2 11h.01"/><path d="M11 9.4c.8 1.6.8 3.6 0 5.2"/>',
      petRabbit: '<path d="M10 9.8C8.8 7 8.4 3.4 9.7 2.9s2.4 2.9 2.3 6.4"/><path d="M14 9.8c1.2-2.8 1.6-6.4.3-6.9S11.9 5.8 12 9.3"/><circle cx="12" cy="15" r="5.6"/><path d="M10 14.4h.01M14 14.4h.01"/><path d="M11 17.2h2"/>',
    });
    doc.querySelectorAll('[data-icon="paw"]').forEach((el) => {
      el.querySelector('svg.icon')?.remove();
      el.insertAdjacentHTML('afterbegin', ico('paw'));
    });
  }

  const SPECIES = { dog: 'ძაღლი', cat: 'კატა', bird: 'ფრინველი', rabbit: 'კურდღელი', rodent: 'მღრღნელი', fish: 'თევზი', reptile: 'ქვეწარმავალი', horse: 'ცხენი', other: 'სხვა' };
  const GLYPH = { dog: 'petDog', cat: 'petCat', bird: 'petBird', fish: 'petFish', rabbit: 'petRabbit' };
  const SEX = { MALE: 'მამრი', FEMALE: 'მდედრი', UNKNOWN: 'სქესი უცნობია' };
  const KINDS = { VACCINATION: 'ვაქცინა', FLEA_TICK: 'რწყილი და ტკიპა', DEWORMING: 'ჭიებისგან დამუშავება', MEDICATION: 'წამალი', OTHER: 'სხვა მოვლა' };
  const RECURRENCE = { ONCE: 'ერთჯერადი', EVERY_N_DAYS: 'რამდენიმე დღეში ერთხელ', EVERY_N_WEEKS: 'რამდენიმე კვირაში ერთხელ', EVERY_N_MONTHS: 'რამდენიმე თვეში ერთხელ', DAILY_COURSE: 'ყოველდღიური კურსი' };
  const SOURCES = { VETERINARIAN: 'ვეტერინარის დანიშნულებით', PRODUCT_INSTRUCTIONS: 'ინსტრუქციით', USER_ENTERED: 'პატრონის გადაწყვეტილებით' };
  const ALLERGY = { food: 'საკვები', medication: 'წამალი', environmental: 'გარემო', other: 'სხვა', unknown: 'უცნობი' };
  const TOPICS = {
    food: 'კვება და საკვები', digestion: 'კუჭ-ნაწლავი', skin: 'კანი, ბეწვი, ყურები', parasites: 'ვაქცინა და პარაზიტები',
    behavior: 'ქცევა', weight: 'წონა და აქტივობა', visit: 'ვიზიტი და ისტორია', medication: 'წამლები და მკურნალობა', other: 'სხვა თემა',
  };
  const LADDER = {
    owners: 'დაამატა ცხოველი',
    recorded: 'ჩაწერა რამე',
    planned: 'შექმნა მოვლის გეგმა',
    reminders: 'ჩართო შეხსენება',
    vet: 'ჰკითხა MEDIVET-ს',
    returned: 'დაბრუნდა სხვა დღეს',
  };
  const TRACK = [
    ['profile', 'პროფილი'],
    ['weight', 'წონა'],
    ['health', 'ჯანმრთელობა'],
    ['care', 'მოვლა'],
    ['reminders', 'შეხსენება'],
    ['vet', 'MEDIVET'],
  ];
  const PROFILE_PARTS = { photo: 'ფოტო', breed: 'ჯიში', age: 'ასაკი', sex: 'სქესი', neutered: 'სტერილიზაცია', vet: 'ვეტერინარი' };
  const FILTERS = [['all', 'ყველა'], ['idle', 'მხოლოდ დაამატა'], ['using', 'იყენებს'], ['vet', 'MEDIVET'], ['archived', 'არქივი']];

  const used = (p) => p.usage.weight + p.usage.health + p.usage.care + p.usage.vet > 0;
  const matches = {
    all: (p) => !p.archived,
    idle: (p) => !p.archived && !used(p),
    using: (p) => !p.archived && used(p),
    vet: (p) => p.usage.vet > 0,
    archived: (p) => p.archived,
  };

  function ageText(age) {
    if (!age || age.kind === 'UNKNOWN' || age.years == null) return '';
    const approx = age.kind === 'APPROXIMATE' ? '~' : '';
    if (age.years >= 1) return `${approx}${age.years} წლის`;
    return `${approx}${Math.max(0, age.months || 0)} თვის`;
  }

  function breedText(p) {
    if (p.breedKind === 'mixed') return 'შერეული';
    if (p.breedKind === 'unknown') return '';
    return p.breed || '';
  }

  function hoursText(h) {
    if (h == null) return '—';
    if (h < 1) return `${Math.max(1, Math.round(h * 60))} წთ`;
    if (h < 48) return `${Math.round(h)} სთ`;
    return `${Math.round(h / 24)} დღე`;
  }

  const initials = (name) => String(name || '?').trim().split(/\s+/).slice(0, 2).map((w) => w[0] || '').join('').toUpperCase() || '?';
  const userHref = (id) => (typeof global.userPageHref === 'function' ? global.userPageHref(id) : `#/users/${encodeURIComponent(id)}`);
  const metric = (label, value, hint, tone = '') => `<div class="s-metric${tone ? ` is-${tone}` : ''}"><span>${esc(label)}</span><strong>${value}</strong>${hint ? `<small>${hint}</small>` : ''}</div>`;
  const empty = (text) => `<div class="s-empty">${ico('info')}<span>${esc(text)}</span></div>`;
  const card = (title, note, body, { flush = false, action = '' } = {}) => `<section class="s-card">
    <header class="s-card-head"><div><h3>${esc(title)}</h3>${note ? `<p>${note}</p>` : ''}</div>${action}</header>
    <div class="s-card-body${flush ? ' is-flush' : ''}">${body}</div>
  </section>`;
  const facts = (rows) => `<dl class="p3-facts">${rows.map(([dt, dd]) => `<div><dt>${esc(dt)}</dt><dd>${dd}</dd></div>`).join('')}</dl>`;

  /** Ranked share rows (label · meter · count · %). */
  function shares(rows, total) {
    const list = rows.filter(([, n]) => n > 0);
    if (!list.length) return '';
    return `<ul class="s-share-list">${list.map(([label, n]) => {
      const p = share(n, total) || 0;
      return `<li><span title="${esc(label)}">${esc(label)}</span><div class="s-meter"><i style="width:${Math.max(2, Math.min(100, p))}%"></i></div><b>${fmt(n)}</b><em>${pct(p)}</em></li>`;
    }).join('')}</ul>`;
  }

  /* ─────────────── What the numbers say ─────────────── */
  function insights(d) {
    const t = d.totals;
    const L = Object.fromEntries(d.ladder.map((s) => [s.key, s.count]));
    const rows = [];
    if (!t.owners) {
      rows.push(['info', `ცხოველი ჯერ არცერთ ${d.includeTeam ? '' : 'რეალურ '}მომხმარებელს არ დაუმატებია.`]);
    } else {
      const fp = d.firstPet || {};
      rows.push(['info', `<b>${fmt(t.owners)} ადამიანს</b> დამატებული აქვს ცხოველი — ${fmt(t.accounts)} ანგარიშის ${pct(t.ownerRate)}.${fp.sameDay ? ` ${fmt(fp.sameDay)} მათგანმა რეგისტრაციის დღესვე დაამატა.` : ''}`]);
      if (t.onlyProfile) {
        const p = share(t.onlyProfile, t.owners);
        rows.push([p >= 50 ? 'warn' : 'info', `<b>${fmt(t.onlyProfile)} პატრონმა (${pct(p)})</b> ცხოველის დამატების შემდეგ მეტი არაფერი გააკეთა — არც წონა, არც მოვლა, არც MEDIVET-ის კითხვა.`]);
      }
      if (!L.vet) rows.push(['warn', `<b>MEDIVET-ს ჯერ არცერთ პატრონს არაფერი უკითხავს.</b>${d.vet.openedSessions ? ` საუბარი ${fmt(d.vet.openedSessions)}-ჯერ გაიხსნა, მაგრამ კითხვა არ დაწერილა.` : ''}`]);
      else rows.push(['ok', `<b>${fmt(L.vet)} პატრონმა</b> ჰკითხა MEDIVET-ს — სულ ${fmt(d.vet.questions)} კითხვა, ${fmt(d.vet.sessions)} საუბარში.`]);
      if (L.reminders) rows.push(['ok', `${fmt(L.reminders)} პატრონს მოვლის შეხსენება აქვს ჩართული (${fmt(d.care.plans.remindersOn)} გეგმა).`]);
      if (d.care.plans.overdue) rows.push(['warn', `${fmt(d.care.plans.overdue)} მოვლის გეგმას ვადა გაუვიდა და შესრულებულად არ მონიშნულა.`]);
    }
    if (!d.includeTeam && d.team.pets) rows.push(['muted', `გუნდის ${fmt(d.team.accounts)} ანგარიში (${fmt(d.team.pets)} ცხოველი, მათ შორის App Review-ს დემო) აქ არ ითვლება. „გუნდის ჩათვლით“ მათაც აჩვენებს.`]);
    const glyph = { info: 'info', warn: 'alert', ok: 'check', muted: 'users' };
    return `<section class="s-card s-pets-read">
      <header class="s-card-head"><div><h3>რას აჩვენებს მონაცემები</h3></div></header>
      <ul class="s-card-body s-pets-insights">${rows.map(([tone, html]) => `<li class="is-${tone}">${ico(glyph[tone])}<p>${html}</p></li>`).join('')}</ul>
    </section>`;
  }

  /* ─────────────── Ladder: from adding a pet to Medi Vet ─────────────── */
  function ladder(d) {
    const steps = d.ladder;
    const top = Math.max(1, steps[0]?.count || 0);
    if (!steps[0]?.count) return empty('ცხოველი ჯერ არავის დაუმატებია.');
    return `<ol class="s-funnel s-pets-ladder" style="--n:${steps.length}">${steps.map((s, i) => {
      const v = Math.max(s.count ? 3 : 0, Math.min(100, (s.count / top) * 100));
      return `<li class="s-funnel-step">
        <div class="s-funnel-head"><span>${esc(LADDER[s.key] || s.key)}</span><strong>${fmt(s.count)}</strong></div>
        <div class="s-funnel-bar" role="img" aria-label="${esc(`${LADDER[s.key]}: ${fmt(s.count)}`)}" style="--v:${v.toFixed(1)}%;--lost:0%"><b></b><i></i></div>
        <div class="s-funnel-foot">${i ? `<span class="s-badge is-plain">${pct(s.rate)}</span><span>პატრონებიდან</span>` : '<span>ყველა პატრონი</span>'}</div>
      </li>`;
    }).join('')}</ol>`;
  }

  /* ─────────────── Pet wall ─────────────── */
  function track(p) {
    const filled = Object.values(p.profile || {}).filter(Boolean).length;
    const missing = Object.entries(p.profile || {}).filter(([, v]) => !v).map(([k]) => PROFILE_PARTS[k]);
    const value = {
      profile: [Math.round((filled / 6) * 100), `პროფილი ${filled}/6${missing.length ? ` · აკლია: ${missing.join(', ')}` : ''}`],
      weight: [p.usage.weight ? 100 : 0, `წონის ჩანაწერი: ${fmt(p.usage.weight)}`],
      health: [p.usage.health ? 100 : 0, `ალერგია და მდგომარეობა: ${fmt(p.usage.health)}`],
      care: [p.usage.care ? 100 : 0, `მოვლის ჩანაწერი: ${fmt(p.usage.care)}`],
      reminders: [p.usage.reminders ? 100 : 0, `ჩართული შეხსენება: ${fmt(p.usage.reminders)}`],
      vet: [p.usage.vet ? 100 : 0, `MEDIVET-ის კითხვა: ${fmt(p.usage.vet)}`],
    };
    const label = TRACK.map(([k]) => value[k][1]).join('; ');
    return `<div class="s-pet-track" role="img" aria-label="${esc(label)}">${TRACK.map(([k]) => `<i style="--fill:${value[k][0]}%" title="${esc(value[k][1])}"></i>`).join('')}</div>`;
  }

  function useLine(p) {
    const parts = [
      p.usage.weight && `წონა ${fmt(p.usage.weight)}`,
      p.usage.health && `ჯანმრთელობა ${fmt(p.usage.health)}`,
      p.usage.care && `მოვლა ${fmt(p.usage.care)}`,
      p.usage.reminders && `შეხსენება ${fmt(p.usage.reminders)}`,
      p.usage.vet && `MEDIVET ${fmt(p.usage.vet)} კითხვა`,
    ].filter(Boolean);
    if (parts.length) return `<p class="s-pet-use">${esc(parts.join(' · '))}</p>`;
    const filled = Object.values(p.profile || {}).filter(Boolean).length;
    return `<p class="s-pet-use is-idle">მხოლოდ პროფილი · შევსებულია ${filled}/6</p>`;
  }

  function petCard(p) {
    const meta = [SPECIES[p.speciesId] || 'სხვა', breedText(p), ageText(p.age)].filter(Boolean).join(' · ');
    const badges = [
      p.archived ? '<span class="s-badge is-plain">არქივშია</span>' : '',
      p.owner.team ? '<span class="s-badge is-info">გუნდი</span>' : '',
    ].join('');
    const seen = p.owner.lastSeenAt ? `აპში ${esc(when(p.owner.lastSeenAt))}` : 'აპში ჯერ არ ჩანს';
    return `<article class="s-pet${p.archived ? ' is-archived' : ''}">
      <header class="s-pet-head">
        <span class="s-pet-glyph" aria-hidden="true">${ico(GLYPH[p.speciesId] || 'paw')}</span>
        <div class="s-pet-id"><b title="${esc(p.name)}">${esc(p.name)}</b><small title="${esc(meta)}">${esc(meta)}</small></div>
        ${badges}
      </header>
      ${track(p)}
      ${useLine(p)}
      <footer class="s-pet-owner">
        <a class="s-pet-person" href="${esc(userHref(p.owner.id))}" title="პროფილის გახსნა">
          <span class="s-pet-ava" aria-hidden="true">${esc(initials(p.owner.name))}</span>
          <span><b>${esc(p.owner.name || 'უსახელო')}</b><small>${esc(p.owner.contact || '')}</small></span>
        </a>
        <span class="s-pet-when">დაემატა ${esc(when(p.createdAt, 'date'))}<br>${seen}</span>
      </footer>
    </article>`;
  }

  function wallList() {
    const q = query.trim().toLowerCase();
    return (data?.pets || []).filter((p) => matches[filter](p) && (!q || `${p.name} ${p.owner.name} ${p.owner.contact} ${p.breed || ''}`.toLowerCase().includes(q)));
  }

  function wallBody() {
    const list = wallList();
    if (!list.length) {
      const text = query ? 'ამ ძებნით ცხოველი ვერ მოიძებნა.' : filter === 'vet' ? 'MEDIVET-ისთვის ჯერ არავის უკითხავს.' : filter === 'archived' ? 'არქივში ცხოველი არ არის.' : filter === 'using' ? 'დამატების შემდეგ ჯერ არავის არაფერი ჩაუწერია.' : 'ცხოველი ჯერ არ არის.';
      return empty(text);
    }
    const more = list.length > shown
      ? `<div class="s-pet-more"><button type="button" class="btn compact" data-pet-more>კიდევ ${fmt(Math.min(PAGE, list.length - shown))} · ნაჩვენებია ${fmt(shown)} / ${fmt(list.length)}</button></div>`
      : '';
    return `<div class="s-pet-wall">${list.slice(0, shown).map(petCard).join('')}</div>${more}`;
  }

  function wallCard(d) {
    const counts = Object.fromEntries(FILTERS.map(([k]) => [k, d.pets.filter(matches[k]).length]));
    const seg = `<div class="s-segment" role="tablist" aria-label="ცხოველების ფილტრი">${FILTERS.map(([k, label]) => `<button type="button" role="tab" aria-selected="${k === filter}" data-pet-filter="${k}">${esc(label)}${counts[k] ? ` <i>${fmt(counts[k])}</i>` : ''}</button>`).join('')}</div>`;
    const legend = `<div class="s-pet-legend" aria-hidden="true">${TRACK.map(([, label]) => `<span>${esc(label)}</span>`).join('')}</div>`;
    const capped = d.petsTotal > d.pets.length ? ` ნაჩვენებია ბოლო აქტივობის ${fmt(d.pets.length)} ცხოველი ${fmt(d.petsTotal)}-დან.` : '';
    return `<section class="s-card s-pets-wallcard">
      <header class="s-card-head"><div><h3>ცხოველები და რას აკეთებენ</h3>
        <p>თითო ბარათი ერთი ცხოველია. ზოლი აჩვენებს, რა გამოიყენა პატრონმა: ანთებული — გამოიყენა, ცარიელი — ჯერ არა. ახალი აქტივობა პირველია.${capped}</p></div>
        ${legend}</header>
      <div class="s-pet-tools">${seg}
        <label class="p2-search">${ico('search')}<input type="search" data-pet-search placeholder="ცხოველი, პატრონი ან ჯიში" aria-label="ცხოველის ან პატრონის ძებნა" value="${esc(query)}"></label>
      </div>
      <div data-pet-wall>${wallBody()}</div>
    </section>`;
  }

  function paintWall(root) {
    const host = root.querySelector('[data-pet-wall]');
    if (!host) return;
    host.innerHTML = wallBody();
    host.querySelector('[data-pet-more]')?.addEventListener('click', () => {
      shown += PAGE;
      paintWall(root);
    });
  }

  /* ─────────────── Period ─────────────── */
  function periodBlock(d) {
    const p = d.period;
    const C = global.AdminCharts;
    const chart = C?.line
      ? C.line([
        { label: 'ახალი ცხოველი', tone: 'blue', points: p.trend.pets },
        { label: 'აქტიური პატრონი', tone: 'teal', points: p.trend.active },
        { label: 'MEDIVET კითხვა', tone: 'violet', points: p.trend.questions },
      ], { label: 'ცხოველები დღეების მიხედვით', height: 220, empty: 'ამ პერიოდში ცხოველებში არაფერი მომხდარა.' })
      : '';
    return `<div class="s-section-title"><h3>ბოლო ${fmt(p.days)} დღე · ${esc(when(p.from, 'date'))} – ${esc(when(p.to, 'date'))}</h3>
        <div class="s-segment" role="tablist" aria-label="პერიოდი">${[7, 30, 90].map((n) => `<button type="button" role="tab" aria-selected="${n === days}" data-pet-days="${n}">${n} დღე</button>`).join('')}</div></div>
      <div class="s-metrics">
        ${metric('ახალი ცხოველი', fmt(p.newPets), `${fmt(p.newOwners)} ახალი პატრონი`)}
        ${metric('აქტიური პატრონი', fmt(p.activeOwners), 'ვინც ცხოველებში რამე გააკეთა')}
        ${metric('MEDIVET-ის კითხვა', fmt(p.questions), `${fmt(p.questionUsers)} ადამიანისგან`)}
        ${metric('ახალმა ანგარიშმა დაამატა', pct(p.signupPetRate), `${fmt(p.signupsWithPet)} / ${fmt(p.signups)} ახალი ანგარიში`)}
      </div>
      ${card('დღიური ტრენდი', 'ახალი ცხოველები, პატრონები, ვინც იმ დღეს ცხოველებში რამე გააკეთა, და MEDIVET-ის კითხვები — თბილისის დღეების მიხედვით.', chart)}`;
  }

  /* ─────────────── Who the pets are · owners ─────────────── */
  function compositionCard(d) {
    const c = d.composition;
    const total = d.totals.petsActive;
    if (!total) return card('ვინ არიან ცხოველები', '', empty('აქტიური ცხოველი ჯერ არ არის.'));
    const species = shares(c.species.map((s) => [SPECIES[s.id] || 'სხვა', s.count]), total);
    const breeds = c.breeds.length
      ? `<div class="s-chips s-pets-chips">${c.breeds.map((b) => `<span class="s-badge is-plain">${esc(b.label)} · ${fmt(b.count)}</span>`).join('')}</div>`
      : '';
    const profile = shares(Object.entries(PROFILE_PARTS).map(([k, label]) => [label, c.profile[k]]), total);
    return card('ვინ არიან ცხოველები', `აქტიური ცხოველები (${fmt(total)}), არქივის გარეშე.`, `
      <h4 class="p2-h">სახეობა</h4>${species}
      <h4 class="p2-h s-pets-gap">ჯიში</h4>
      ${facts([
        ['ცნობილი ჯიში', fmt(c.breedKind.known)],
        ['შერეული', fmt(c.breedKind.mixed)],
        ['საკუთარი ჩაწერილი', fmt(c.breedKind.custom)],
        ['უცნობი', fmt(c.breedKind.unknown)],
      ])}
      ${breeds}
      <h4 class="p2-h s-pets-gap">სქესი, სტერილიზაცია, ასაკი</h4>
      ${facts([
        ['მდედრი / მამრი', `${fmt(c.sex.FEMALE)} / ${fmt(c.sex.MALE)}${c.sex.UNKNOWN ? ` <small class="s-muted">· უცნობი ${fmt(c.sex.UNKNOWN)}</small>` : ''}`],
        ['სტერილიზებული', `${fmt(c.neutered.yes)} <small class="s-muted">· არა ${fmt(c.neutered.no)} · უცნობი ${fmt(c.neutered.unknown)}</small>`],
        ['1 წლამდე', fmt(c.ages.young)],
        ['1–7 წლის', fmt(c.ages.adult)],
        ['8 წლის და მეტი', fmt(c.ages.senior)],
        ['ასაკი უცნობია', fmt(c.ages.unknown)],
      ])}
      <h4 class="p2-h s-pets-gap">რა შეავსეს პროფილში</h4>${profile || empty('პროფილის დამატებითი ველი ჯერ არავის შეუვსია.')}`);
  }

  function ownersCard(d) {
    const t = d.totals;
    const fp = d.firstPet || {};
    const po = d.composition.perOwner;
    if (!t.owners) return card('პატრონები', '', empty('პატრონი ჯერ არ არის.'));
    const timing = shares([
      ['რეგისტრაციის დღესვე', fp.sameDay],
      ['პირველ კვირაში', fp.week],
      ['მოგვიანებით', fp.later],
    ], t.owners);
    return card('პატრონები', 'როდის ამატებენ ცხოველს და ბრუნდებიან თუ არა.', `
      ${facts([
        ['ცხოველის პატრონი', `${fmt(t.owners)} <small class="s-muted">· ანგარიშების ${pct(t.ownerRate)}</small>`],
        ['აქტიური ცხოველით', fmt(t.ownersActive)],
        ['ერთი / ორი / სამი და მეტი', `${fmt(po.one)} / ${fmt(po.two)} / ${fmt(po.more)}`],
        ['აპში დაბრუნდა დამატების შემდეგ', `${fmt(t.appReturned)} <small class="s-muted">· ${pct(share(t.appReturned, t.owners))}</small>`],
      ])}
      <h4 class="p2-h s-pets-gap">პირველი ცხოველი რეგისტრაციიდან</h4>
      ${timing}
      <p class="p2-note s-pets-note">მედიანა: ${esc(hoursText(fp.medianHours))} რეგისტრაციიდან. „აპში დაბრუნდა“ — ცხოველის დამატების შემდეგ სხვა დღეს გახსნა აპი (ნებისმიერი გვერდი).</p>`);
  }

  /* ─────────────── Care + reminders · Medi Vet ─────────────── */
  /** „ · დასრულდა 2 · გაუქმდა 1“ — only the parts that are not zero. */
  const extras = (parts) => {
    const list = parts.filter(([, n]) => n > 0).map(([label, n]) => `${label} ${fmt(n)}`);
    return list.length ? ` <small class="s-muted">· ${esc(list.join(' · '))}</small>` : '';
  };
  const kindBadges = (obj) => {
    const list = Object.entries(obj).filter(([, n]) => n > 0);
    return list.length ? `<div class="s-pets-kinds">${list.map(([k, n]) => `<span class="s-badge is-plain">${esc(KINDS[k] || 'სხვა მოვლა')} · ${fmt(n)}</span>`).join('')}</div>` : '';
  };
  const joinCounts = (obj, names) => Object.entries(obj).filter(([, n]) => n > 0).map(([k, n]) => `${names[k] || 'სხვა'} ${fmt(n)}`).join(' · ');

  function careCard(d) {
    const c = d.care;
    const p = c.plans;
    const title = 'მოვლა და შეხსენებები';
    const note = 'რას იწერენ ცხოველზე და მუშაობს თუ არა შეხსენება.';
    const any = c.weight.logs + c.allergies.total + c.conditions.total + c.products.total + p.total + c.events.recorded + c.events.skipped + c.delivery.SCHEDULED_LOCAL;
    if (!any) return card(title, note, empty('ცხოველზე წონა, ჯანმრთელობა ან მოვლა ჯერ არავის ჩაუწერია.'));
    const allergyCats = joinCounts(c.allergies.categories, ALLERGY);
    const records = facts([
      ['წონის ჩანაწერი', `${fmt(c.weight.logs)}${extras([['ცხოველი', c.weight.pets], ['ორი და მეტი აწონვით', c.weight.trackedPets]])}`],
      ['ალერგია', `${fmt(c.allergies.total)}${extras([['ცხოველი', c.allergies.pets], ['ვეტერინარის დადასტურებული', c.allergies.confirmed]])}${allergyCats ? ` <small class="s-muted">· ${esc(allergyCats)}</small>` : ''}`],
      ['ჯანმრთელობის მდგომარეობა', `${fmt(c.conditions.total)}${extras([['ახლა აქტიური', c.conditions.active], ['ვეტერინარის დადასტურებული', c.conditions.confirmed]])}`],
      ['მოვლის საშუალება', fmt(c.products.total)],
    ]) + kindBadges(c.products.kinds);
    const plans = p.total
      ? facts([
        ['აქტიური გეგმა', `${fmt(p.status.ACTIVE)}${extras([['ცხოველი', p.pets], ['დასრულდა', p.status.COMPLETED], ['გაუქმდა', p.status.CANCELLED]])}`],
        ['შეხსენება ჩართულია', `${fmt(p.remindersOn)} <small class="s-muted">· ${pct(share(p.remindersOn, p.status.ACTIVE))} აქტიურიდან</small>`],
        ['ვადა გაუვიდა', p.overdue ? `<span class="s-pets-warn">${fmt(p.overdue)}</span> <small class="s-muted">· მონიშვნას ელოდება</small>` : '0'],
        ['მომდევნო 7 დღეში', fmt(p.dueSoon)],
        ['რა სიხშირით', esc(joinCounts(p.recurrence, RECURRENCE) || '—')],
        ['ვინ დანიშნა', esc(joinCounts(p.sources, SOURCES) || '—')],
      ]) + kindBadges(p.kinds)
      : '<p class="p2-note">მოვლის გეგმა (ვაქცინა, ჭიებისგან დამუშავება, წამალი…) ჯერ არავის შეუქმნია.</p>';
    const done = c.events.recorded + c.events.skipped + c.delivery.SCHEDULED_LOCAL
      ? `<h4 class="p2-h s-pets-gap">შესრულება და შეხსენებები</h4>${facts([
        ['მონიშნა „გავაკეთე“', `${fmt(c.events.recorded)}${extras([['შეხსენებიდან', c.events.fromReminder]])}`],
        ['გამოტოვა', fmt(c.events.skipped)],
        ['ტელეფონზე დაგეგმილი შეხსენება', `${fmt(c.delivery.SCHEDULED_LOCAL)}${extras([['ადამიანი', c.delivery.users], ['ვერ დაიგეგმა', c.delivery.SCHEDULE_FAILED]])}`],
        ['შეხსენებაზე უპასუხა', fmt(c.delivery.USER_RESPONSE + c.delivery.COMPLETION_CONFIRMED)],
      ])}
      <p class="p2-note s-pets-note">შეხსენება ლოკალურია: ტელეფონი თვითონ გეგმავს და სერვერს მხოლოდ ატყობინებს. „დაგეგმილი“ არ ნიშნავს, რომ შეტყობინება ეკრანზე გამოჩნდა.</p>`
      : '';
    return card(title, note, `${records}<h4 class="p2-h s-pets-gap">მოვლის გეგმები</h4>${plans}${done}`);
  }

  function vetCard(d) {
    const v = d.vet;
    const a = v.ai;
    const flag = d.flags.mediVet;
    const topics = v.topics.length ? shares(v.topics.map((t) => [TOPICS[t.key] || 'სხვა თემა', t.count]), v.topicSample || 1) : '';
    const sec = (ms) => (ms == null ? '—' : `${(ms / 1000).toLocaleString('ka-GE', { maximumFractionDigits: 1 })} წმ`);
    const body = !v.questions
      ? `${empty(d.includeTeam ? 'MEDIVET-ისთვის ჯერ არავის უკითხავს.' : 'MEDIVET-ისთვის ჯერ არცერთ რეალურ მომხმარებელს არ უკითხავს.')}
        ${v.openedSessions ? `<p class="p2-note s-pets-note">საუბარი გაიხსნა ${fmt(v.openedSessions)}-ჯერ, კითხვის გარეშე.</p>` : ''}`
      : `${facts([
        ['ადამიანი', `${fmt(v.users)} <small class="s-muted">· ${fmt(v.pets)} ცხოველზე</small>`],
        ['კითხვა', `${fmt(v.questions)} <small class="s-muted">· ${fmt(v.sessions)} საუბარში, საშუალოდ ${v.perSession == null ? '—' : v.perSession.toLocaleString('ka-GE')}</small>`],
        ['პასუხი', `${fmt(v.answers.COMPLETE)}${v.answers.FAILED ? ` <small class="s-muted">· ვერ გაეცა ${fmt(v.answers.FAILED)}</small>` : ''}${v.answers.CANCELLED ? ` <small class="s-muted">· შეწყდა ${fmt(v.answers.CANCELLED)}</small>` : ''}`],
        ['ბოლო კითხვა', esc(when(v.lastAt))],
        ['პასუხის დრო', `${sec(a.avgMs)} <small class="s-muted">· p95 ${sec(a.p95Ms)}</small>`],
        ['AI შეცდომა', a.errors ? `<span class="s-pets-warn">${fmt(a.errors)}</span>` : '0'],
        ['ხარჯი', `$${(a.costUsd || 0).toLocaleString('en-US', { maximumFractionDigits: 3 })}`],
        ['შეფასება', `${fmt(v.feedback.up)} სასარგებლო · ${fmt(v.feedback.down)} არა`],
        ['მოვლის გეგმის შეთავაზება', fmt(v.drafts)],
        ['სასწრაფო ნიშნები კითხვაში', v.safety.emergency ? `<span class="s-pets-warn">${fmt(v.safety.emergency)}</span>` : '0'],
        ['დოზას ითხოვდა', fmt(v.safety.dose)],
      ])}
      <h4 class="p2-h s-pets-gap">რაზე ეკითხებიან</h4>
      ${topics}
      <p class="p2-note s-pets-note">თემები ითვლება საკვანძო სიტყვებით (მიახლოებით, ბოლო ${fmt(v.topicSample)} კითხვიდან); ერთი კითხვა შეიძლება რამდენიმე თემას ეხებოდეს. თავად ტექსტი აქ არ ჩანს.</p>`;
    const action = `<button type="button" class="btn ghost compact" data-vet-log>${ico('message')} საუბრები Medi-ში</button>`;
    const off = !flag.effective ? `<div class="s-callout is-warn s-pets-flag">${ico('alert')}<p><b>MEDIVET შეჩერებულია.</b> <a href="#/features">მოდულები</a></p></div>` : '';
    return card('MEDIVET', 'ცხოველების AI: რამდენი ეკითხება, რაზე და როგორ პასუხობს.', `${off}${body}`, { action });
  }

  function definitions() {
    return `<section class="s-card"><details class="s-details s-pets-defs"><summary>${ico('info')} როგორ ითვლება</summary><div>
      <p><b>პატრონი</b> — ანგარიში, რომელსაც ერთი ცხოველი მაინც დაუმატებია (არქივშიც). <b>აქტიური პატრონი</b> — ვინც პერიოდში ცხოველს დაამატა ან შეცვალა, ჩაწერა წონა, ჯანმრთელობა ან მოვლა, გამოტოვა მოვლა ან ჰკითხა MEDIVET-ს.</p>
      <p><b>სხვა დღესაც შემოიარა</b> — ცხოველებში რამე გააკეთა ორ სხვადასხვა დღეს მაინც (თბილისის დროით). აპის უბრალოდ გახსნა აქ არ ითვლება — ის ცალკეა: „აპში დაბრუნდა“.</p>
      <p><b>გუნდი</b> — ზუსტად @medicard.ge ელფოსტით შესული ანგარიშები (დემო და თანამშრომლები). ტელეფონით და Apple-ით შესულები ჩვეულებრივი მომხმარებლები არიან.</p>
      <p>ეკრანების ნახვას აპი ცალკე არ აგზავნის, ამიტომ „გახსნა და დაბრუნდა“ ჩანს მხოლოდ ჩანაწერებით. კონფიდენციალობა: აქ არ ჩანს MEDIVET-ის ტექსტი, ალერგიის და მდგომარეობის სახელები, შენიშვნები და ფოტოები.</p>
    </div></details></section>`;
  }

  /* ─────────────── Page ─────────────── */
  function paint(root, d) {
    const t = d.totals;
    const flags = d.flags || {};
    const offPets = flags.pets && !flags.pets.effective;
    const idleShare = share(t.onlyProfile, t.owners);
    root.innerHTML = `<div class="s-stack v3-tab-shell s-pets-page">
      <div class="s-toolbar">
        <div class="s-segment" role="tablist" aria-label="ვინ ითვლება">
          <button type="button" role="tab" aria-selected="${!team}" data-pet-team="0">რეალური მომხმარებლები</button>
          <button type="button" role="tab" aria-selected="${team}" data-pet-team="1">გუნდის ჩათვლით</button>
        </div>
        <div class="s-funnel-tools">
          <span class="s-funnel-meta">განახლდა ${esc(when(d.generatedAt))}</span>
          <button type="button" class="btn ghost compact" data-refresh>${ico('refresh')} განახლება</button>
        </div>
      </div>
      ${offPets ? `<div class="s-callout is-warn">${ico('alert')}<p><b>„ჩემი ცხოველები“ შეჩერებულია.</b> ახალი ჩანაწერი ვერ ინახება. ჩართვა: <a href="#/features">მოდულები</a>.</p></div>` : ''}
      ${insights(d)}
      <div class="s-metrics">
        ${metric('ცხოველის პატრონი', fmt(t.owners), `ანგარიშების ${pct(t.ownerRate)} · ${fmt(t.accounts)}-დან`)}
        ${metric('ცხოველი', fmt(t.petsActive), t.petsArchived ? `აქტიური · ${fmt(t.petsArchived)} არქივში` : 'აქტიური')}
        ${metric('მხოლოდ დაამატა', fmt(t.onlyProfile), `${pct(idleShare)} პატრონებიდან · მეტი არაფერი`, idleShare >= 50 ? 'warn' : '')}
        ${metric('MEDIVET-ს ჰკითხა', fmt(d.vet.users), `${fmt(d.vet.questions)} კითხვა`)}
      </div>
      ${card('ცხოველის დამატებიდან MEDIVET-მდე', 'რამდენმა პატრონმა გამოიყენა თითო შესაძლებლობა, მთელი დროის განმავლობაში. „ჩაწერა რამე“ — წონა, ალერგია, მდგომარეობა ან მოვლა; „დაბრუნდა სხვა დღეს“ — ცხოველებში რამე გააკეთა ორ სხვადასხვა დღეს. % ითვლება ყველა პატრონიდან.', ladder(d))}
      ${wallCard(d)}
      ${periodBlock(d)}
      <div class="p3-split s-pets-split">${compositionCard(d)}${ownersCard(d)}</div>
      <div class="p3-split s-pets-split">${careCard(d)}${vetCard(d)}</div>
      ${definitions()}
    </div>`;

    root.querySelectorAll('[data-pet-team]').forEach((btn) => btn.addEventListener('click', () => {
      const next = btn.dataset.petTeam === '1';
      if (next === team) return;
      team = next;
      shown = PAGE;
      void renderPetsAdmin();
    }));
    root.querySelectorAll('[data-pet-days]').forEach((btn) => btn.addEventListener('click', () => {
      const next = Number(btn.dataset.petDays) || 30;
      if (next === days) return;
      days = next;
      void renderPetsAdmin({ keepScroll: true });
    }));
    root.querySelectorAll('[data-pet-filter]').forEach((btn) => btn.addEventListener('click', () => {
      filter = btn.dataset.petFilter;
      shown = PAGE;
      root.querySelectorAll('[data-pet-filter]').forEach((b) => b.setAttribute('aria-selected', String(b === btn)));
      paintWall(root);
    }));
    const search = root.querySelector('[data-pet-search]');
    search?.addEventListener('input', () => {
      query = search.value;
      shown = PAGE;
      paintWall(root);
    });
    root.querySelector('[data-refresh]')?.addEventListener('click', () => void renderPetsAdmin());
    root.querySelector('[data-vet-log]')?.addEventListener('click', () => {
      // Medi's log (#/ai) keeps its filter in admin.js `aiLog`; open it on MEDIVET.
      if (typeof aiLog === 'object' && aiLog) Object.assign(aiLog, { mode: 'VET', status: '', offset: 0 });
      const ai = $('tab-ai');
      if (ai) ai.innerHTML = '';
      location.hash = '#/ai';
    });
    paintWall(root);
  }

  async function renderPetsAdmin({ keepScroll = false } = {}) {
    const root = $('tab-pets');
    if (!root) return;
    const mine = ++ticket;
    const y = global.scrollY;
    if (!data || !keepScroll) root.innerHTML = skel();
    let next;
    try {
      next = await global.api(`/pets/overview?days=${days}${team ? '&team=1' : ''}`);
    } catch (err) {
      if (mine !== ticket) return;
      const denied = err?.status === 403;
      root.innerHTML = `<div class="s-card"><div class="s-empty" role="alert">${ico('alert')}<strong>MEDIVET-ის მონაცემები ვერ ჩაიტვირთა</strong><span>${denied ? 'შენს ანგარიშს არ აქვს ამ გვერდის ნახვის უფლება (PETS_VIEW).' : 'სერვერმა პასუხი ვერ დააბრუნა — სცადე ხელახლა.'}</span>${!denied && err?.message ? `<small>${esc(err.message)}</small>` : ''}<button type="button" class="btn compact" data-retry>ხელახლა ცდა</button></div></div>`;
      root.querySelector('[data-retry]').onclick = () => void renderPetsAdmin();
      return;
    }
    if (mine !== ticket) return;
    if (next?.installed === false) {
      root.innerHTML = `<div class="s-card"><div class="s-empty">${ico('info')}<strong>ცხოველების ცხრილები ამ ბაზაში არ არის</strong><span>„ჩემი ცხოველების“ სქემა ჯერ არ არის დაყენებული.</span></div></div>`;
      return;
    }
    data = next;
    paint(root, data);
    if (keepScroll) global.scrollTo({ top: y });
  }

  global.renderPetsAdmin = renderPetsAdmin;
  global.AdminV4Pets = { renderPetsAdmin };
})(window);
