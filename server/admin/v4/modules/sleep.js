/**
 * MediCard Admin V4 — #/sleep MEDISLEEP (/api/admin/sleep), on the usage kit (usageKit.js).
 * Four page tabs: „გამოყენება“ (who uses the module and how — counts and people, never anyone's sleep values;
 * the sleep picture and bedtime hours only when 5+ different people are behind them), „ხმები“ (the sound
 * library: fields, status, order, audio / fade-out tail / art uploads to "SleepFile"), „რჩევები“ (the evening
 * and morning advice, grouped by when the app offers it) and „პარამეტრები“ (timer, fade, mixer, check-in factors).
 */
(function adminV4Sleep(global) {
  const K = global.AdminUsage;
  if (!K) return;
  const doc = document;
  const { esc, ico, fmt, pct, share, when, metric, metrics, card, facts, shares, empty, note, h4 } = K;
  const V = () => global.AdminV3 || {};
  const toast = (m, k) => global.toast?.(m, k);
  const api = (path, opts) => global.api(`/sleep${path}`, opts);
  /** The server's message when it is Georgian; otherwise our sentence. */
  const say = (err, fallback) => (/[ა-ჿ]/.test(err?.message || '') ? err.message : fallback);
  const base = () => (typeof API === 'string' ? API : '');
  const src = (url) => (url && url.startsWith('/') ? `${base()}${url}` : url || '');
  const skel = () => `<div class="s-stack"><div class="v3-skel" aria-hidden="true">${'<i></i>'.repeat(6)}</div></div>`;
  const pane = (key) => doc.querySelector(`#tab-sleep [data-uw-pane="${key}"]`);

  K.glyphs({
    // A crescent with a small „z“ — distinct from the theme switch's plain moon.
    sleep: '<path d="M20 14.6A8.2 8.2 0 0 1 9.4 4a8.2 8.2 0 1 0 10.6 10.6z"/><path d="M14.2 3.4h4.2l-4.2 4.6h4.2"/>',
  });
  if (typeof ICONS === 'object') {
    ICONS['sl-up'] = ICONS['sl-up'] || '<polyline points="18 15 12 9 6 15"/>';
    ICONS['sl-down'] = ICONS['sl-down'] || '<polyline points="6 9 12 15 18 9"/>';
    ICONS.upload = ICONS.upload || '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>';
    ICONS.edit = ICONS.edit || '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>';
  }

  /* ───────────── shared words ───────────── */
  const CATEGORIES = { rain: 'წვიმა', nature: 'ბუნება', noise: 'ხმაური', music: 'მელოდიები' };
  const SOUND_STATUS = { LIVE: ['is-ok', 'აპში ჩანს'], DRAFT: ['', 'მონახაზი'], HIDDEN: ['is-plain', 'დამალული'] };
  const TIP_STATUS = { LIVE: ['is-ok', 'აპში ჩანს'], HIDDEN: ['is-plain', 'დამალული'], ARCHIVED: ['is-plain', 'არქივში'] };
  /** SleepTip.trigger → [title, when the app offers it] (sleepInsights.js tipTriggers). */
  const TRIGGERS = {
    always: ['ყველასთვის', 'ავსებს დარჩენილ ადგილს, როცა სხვა მიზეზი არ არის.'],
    short: ['ცოტა სძინავს', 'ბოლო ღამეებში საშუალოდ მიზანზე 30+ წუთით ნაკლები.'],
    irregular: ['არარეგულარული რიტმი', 'ძილის შუა დრო ღამიდან ღამემდე 1 საათზე მეტით იცვლება.'],
    late: ['გეგმაზე გვიან წვება', 'დაწოლა გეგმაზე 30+ წუთით გვიან.'],
    weekend: ['შაბათ-კვირის რიტმი', 'შაბათ-კვირას ძილი 1+ საათით იწევს.'],
    latency: ['დიდხანს ვერ იძინებს', 'ჩაძინებას საშუალოდ 30+ წუთი სჭირდება.'],
    wakeups: ['ღამით იღვიძებს', 'ღამეში საშუალოდ 2+ გაღვიძება.'],
    poor: ['ხშირად ცუდად სძინავს', 'დილის შეფასება საშუალოდ 2.5 ან ნაკლები.'],
    caffeine: ['ყავა ან ჩაი გვიან', 'დილის შეფასებაში ეს ფაქტორი 2+-ჯერ ან ძილს აუარესებს.'],
    alcohol: ['ალკოჰოლი', 'დილის შეფასებაში ეს ფაქტორი 2+-ჯერ ან ძილს აუარესებს.'],
    screens: ['ეკრანი საწოლში', 'დილის შეფასებაში ეს ფაქტორი 2+-ჯერ ან ძილს აუარესებს.'],
    stress: ['სტრესი', 'დილის შეფასებაში ეს ფაქტორი 2+-ჯერ ან ძილს აუარესებს.'],
    late_meal: ['გვიანი ვახშამი', 'დილის შეფასებაში ეს ფაქტორი 2+-ჯერ ან ძილს აუარესებს.'],
    noise: ['ხმაური', 'დილის შეფასებაში ეს ფაქტორი 2+-ჯერ ან ძილს აუარესებს.'],
    heat: ['სიცხე ოთახში', 'დილის შეფასებაში ეს ფაქტორი 2+-ჯერ ან ძილს აუარესებს.'],
  };
  /** Check-in factors (server sleep.js SLEEP_FACTORS), in the app's order. */
  const FACTORS = {
    caffeine: 'ყავა ან ჩაი გვიან', alcohol: 'ალკოჰოლი', late_meal: 'გვიანი ვახშამი', screens: 'ეკრანი საწოლში', stress: 'სტრესი',
    exercise: 'ვარჯიში', nap: 'დღის ძილი', noise: 'ხმაური', pain: 'ტკივილი', illness: 'ავად ვიყავი', period: 'მენსტრუაცია',
    kids: 'ბავშვმა გამაღვიძა', heat: 'სიცხე ოთახში', travel: 'მოგზაურობა',
  };
  const QUALITY = { 1: 'ძალიან ცუდად', 2: 'ცუდად', 3: 'საშუალოდ', 4: 'კარგად', 5: 'ძალიან კარგად' };

  const mins = (m) => {
    if (m == null || !Number.isFinite(Number(m))) return '—';
    const v = Math.round(Number(m));
    if (v < 60) return `${fmt(v)} წთ`;
    const h = Math.floor(v / 60);
    const r = v % 60;
    return r ? `${fmt(h)} სთ ${r} წთ` : `${fmt(h)} სთ`;
  };
  const timerLabel = (n) => (Number(n) === 0 ? 'მთელი ღამე' : mins(n));
  const size = (bytes) => {
    const b = Number(bytes);
    if (!Number.isFinite(b) || b <= 0) return '';
    return b < 1024 * 1024 ? `${fmt(Math.max(1, Math.round(b / 1024)))} კბ` : `${(b / 1048576).toLocaleString('ka-GE', { maximumFractionDigits: 1 })} მბ`;
  };
  const clock = (ms) => {
    const s = Math.round(Number(ms) / 1000);
    if (!Number.isFinite(s) || s <= 0) return '';
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  };
  const hex = (t) => (/^#[0-9A-Fa-f]{6}$/.test(String(t || '')) ? t : '#2B2452');
  const badge = ([cls, label]) => `<span class="s-badge${cls ? ` ${cls}` : ''}">${esc(label)}</span>`;
  const failHtml = (err, capability) => {
    const denied = err?.status === 403;
    const missing = err?.status === 404;
    return `<div class="s-card"><div class="s-empty" role="alert">${ico('alert')}<strong>მონაცემები ვერ ჩაიტვირთა</strong><span>${denied
      ? `შენს ანგარიშს არ აქვს ამის უფლება (${esc(capability)}).`
      : missing ? 'სერვერზე MEDISLEEP ჯერ არ არის — ჩანს შემდეგი დეპლოის შემდეგ.' : 'სერვერმა პასუხი ვერ დააბრუნა — სცადე ხელახლა.'}</span>${!denied && !missing && err?.message ? `<small>${esc(err.message)}</small>` : ''}<button type="button" class="btn compact" data-retry>ხელახლა ცდა</button></div></div>`;
  };
  const retry = (host, run) => { const b = host.querySelector('[data-retry]'); if (b) b.onclick = () => void run(); };

  /* ═════════════ გამოყენება ═════════════ */
  const LADDER = {
    people: 'გამოიყენა MEDISLEEP', plan: 'დააყენა გეგმა', listened: 'მოუსმინა ხმას', logged: 'ჩაწერა ღამე',
    checkin: 'დილის შეფასება', week3: '3+ ღამე ერთ კვირაში', returned: 'სხვა კვირასაც დაბრუნდა',
  };
  const TRACK = ['გეგმა', 'ხმები', 'ღამეები', 'შეფასება', 'დაბრუნება'];
  /** Bedtime hours from 18:00 round to 17:00, so one night reads left to right. */
  const NIGHT_HOURS = Array.from({ length: 24 }, (_, i) => (i + 18) % 24);

  function personCard(it) {
    const title = it.nights ? `${fmt(it.nights)} ღამე` : it.plays ? 'მხოლოდ ხმები' : 'მხოლოდ გეგმა';
    const parts = [
      it.nights && `ღამე ${fmt(it.nights)}`,
      it.checkins && `შეფასება ${fmt(it.checkins)}`,
      it.plays && `ხმა ${fmt(it.plays)}-ჯერ · ${mins(it.listenMinutes)}`,
    ].filter(Boolean);
    return K.itemCard({
      glyph: 'sleep',
      title,
      meta: `${fmt(it.activeDays)} აქტიური დღე · პერიოდში ${fmt(it.periodDays)}`,
      badges: `${it.week3 ? '<span class="s-badge is-ok" title="3+ ღამე ჩაწერა ერთ კვირაში">რეგულარული</span>' : ''}${it.person.team ? '<span class="s-badge is-info">გუნდი</span>' : ''}`,
      track: K.track([
        { fill: it.plan ? 100 : 0, title: it.plan ? 'ძილის გეგმა დაყენებულია' : 'გეგმა არ აქვს' },
        { fill: Math.round(Math.min(1, it.plays / 3) * 100), title: `ხმა ჩართო ${fmt(it.plays)}-ჯერ, სულ ${mins(it.listenMinutes)} (3+ = სავსე)` },
        { fill: Math.round(Math.min(1, it.nights / 3) * 100), title: `ჩაწერა ${fmt(it.nights)} ღამე (3+ = სავსე)` },
        { fill: it.nights ? Math.round((it.checkins / it.nights) * 100) : 0, title: `დილით შეაფასა ${fmt(it.checkins)} ღამე ${fmt(it.nights)}-დან` },
        { fill: it.returned ? 100 : 0, title: it.returned ? 'პირველი დღიდან კვირის შემდეგაც დაბრუნდა' : 'კვირის შემდეგ ჯერ არ დაბრუნებულა' },
      ]),
      line: parts.length ? parts.join(' · ') : 'გეგმა დააყენა, სხვა ჯერ არაფერი',
      idle: !parts.length,
      person: it.person,
      foot: [`ბოლოს ${when(it.lastDay, 'date')}`, it.person.lastSeenAt ? `აპში ${when(it.person.lastSeenAt)}` : 'აპში ჯერ არ ჩანს'],
      dim: !it.periodDays,
    });
  }

  const wall = K.createWall({
    title: 'ვინ იყენებს MEDISLEEP-ს',
    sub: 'თითო ბარათი ერთი ადამიანია — მხოლოდ რაოდენობები: რამდენს სძინავს, როდის წვება, როგორ შეაფასა და რა იმოქმედა, აქ არ ჩანს. პირველია, ვინც ბოლო პერიოდში ყველაზე მეტ დღეს გამოიყენა.',
    legendLabels: TRACK,
    filters: [
      ['all', 'ყველა', () => true],
      ['nights', 'წერს ღამეებს', (it) => it.nights > 0],
      ['checkin', 'აფასებს დილით', (it) => it.checkins > 0],
      ['sounds', 'მხოლოდ ხმები', (it) => it.plays > 0 && !it.nights],
      ['plan', 'მხოლოდ გეგმა', (it) => it.plan && !it.plays && !it.nights],
    ],
    search: (it) => `${it.person.name} ${it.person.contact}`,
    placeholder: 'სახელი, ტელეფონი ან ელფოსტა',
    render: personCard,
    emptyText: {
      all: 'MEDISLEEP ჯერ არავის გამოუყენებია.', nights: 'ღამე ჯერ არავის ჩაუწერია.', checkin: 'დილის შეფასება ჯერ არავის შეუვსია.',
      sounds: 'ვინც ხმებს უსმენს, ღამესაც წერს.', plan: 'გეგმის შემდეგ ყველამ რაღაც გააკეთა.',
    },
  });

  function kNote(hidden, what) {
    return `<div class="s-sl-knote">${ico('users')}<p><b>დამალულია, სანამ ${fmt(hidden.min)}+ სხვადასხვა ადამიანი არ დაგროვდება</b> — ახლა ${fmt(hidden.people)}. ${esc(what)} ასე ერთი ადამიანის ძილს ვერავინ ამოიცნობს.</p></div>`;
  }

  function insights(d) {
    const t = d.totals;
    const p = d.period;
    const L = Object.fromEntries(d.ladder.map((s) => [s.key, s.count]));
    const lib = d.sounds.library;
    const rows = [];
    if (!t.people) {
      rows.push(['info', `MEDISLEEP ჯერ არცერთ ${d.includeTeam ? '' : 'რეალურ '}მომხმარებელს არ გამოუყენებია.`]);
    } else {
      rows.push(['info', `<b>${fmt(t.people)} ადამიანი</b> იყენებს MEDISLEEP-ს — ${fmt(t.accounts)} ანგარიშის ${pct(t.peopleRate)}. გეგმა აქვს ${fmt(L.plan)}-ს, ღამე ჩაწერა ${fmt(L.logged)}-მა, ხმას მოუსმინა ${fmt(L.listened)}-მა.`]);
      if (p.nights.total) {
        const r = share(p.checkins, p.nights.total);
        rows.push([r < 30 ? 'warn' : 'ok', `ბოლო ${fmt(p.days)} დღეში ჩაწერილი ${fmt(p.nights.total)} ღამიდან დილით შეაფასეს <b>${fmt(p.checkins)} (${pct(r)})</b>. ძილის რეჟიმით — ${fmt(p.modeNights)}.`]);
      }
      if (t.onlyPlan) {
        const r = share(t.onlyPlan, t.people);
        rows.push([r >= 40 ? 'warn' : 'info', `<b>${fmt(t.onlyPlan)} ადამიანმა (${pct(r)})</b> მხოლოდ გეგმა დააყენა — არც ღამე ჩაუწერია, არც ხმა ჩაურთავს.`]);
      }
      if (t.onlySounds) rows.push(['info', `${fmt(t.onlySounds)} ადამიანი მხოლოდ ხმებს უსმენს — ღამე არ ჩაუწერია.`]);
      const top = d.sounds.rows.find((s) => s.plays > 0);
      if (top) rows.push(['ok', `ყველაზე ხშირად ჩართული ხმა: <b>„${esc(top.title)}“</b> — ${fmt(top.plays)} ჩართვა, ${fmt(top.listeners)} ადამიანი.`]);
    }
    if (!lib.live) rows.push(['warn', '<b>აპში ჯერ არცერთი ხმა არ ჩანს.</b> „ხმები“ ჩანართში ატვირთე ფაილი და გამოაქვეყნე.']);
    else if (lib.noAudio) rows.push(['warn', `${fmt(lib.noAudio)} ხმას ფაილი არ აქვს — აპში ის არ გამოჩნდება.`]);
    if (d.picture.hidden && t.people) rows.push(['muted', `ძილის საერთო სურათი დამალულია, სანამ პერიოდში ${fmt(d.picture.min)}+ ადამიანი ღამეს არ ჩაწერს (ახლა ${fmt(d.picture.people)}).`]);
    return K.insights([...rows.slice(0, 6), K.teamInsight(d, d.team.people ? `${fmt(d.team.nights)} ღამით, ${fmt(d.team.plays)} მოსმენით` : '')]);
  }

  function periodBlock(d, ctx) {
    const p = d.period;
    return `${K.periodTitle(p, ctx.days)}
      ${metrics([
        metric('აქტიური ადამიანი', fmt(p.activePeople), `ვინც MEDISLEEP-ში რამე გააკეთა · ${fmt(p.plans.new)} ახალი გეგმა`),
        metric('ჩაწერილი ღამე', fmt(p.nights.total), `რეჟიმით ${fmt(p.nights.mode)} · ხელით ${fmt(p.nights.manual)} · Health ${fmt(p.nights.health)}`),
        metric('დილის შეფასება', fmt(p.checkins), p.nights.total ? `ღამეების ${pct(share(p.checkins, p.nights.total))}` : 'ღამე არ ჩაწერილა'),
        metric('მოსმენა', fmt(p.plays), `${mins(p.listenMinutes)} · ${fmt(p.listeners)} ადამიანი`),
        metric('ახალმა ანგარიშმა დაიწყო', pct(p.signupRate), `${fmt(p.signupsWithSleep)} / ${fmt(p.signups)} ახალი ანგარიში`),
      ])}
      ${card('დღიური ტრენდი', 'ჩაწერილი ღამეები (იმ დილით, როცა დასრულდა), ხმის ჩართვები და ადამიანები, ვინც იმ დღეს MEDISLEEP-ში რამე გააკეთა — თბილისის დღეებით.', K.chart([
        { label: 'ჩაწერილი ღამე', tone: 'violet', points: p.trend.nights },
        { label: 'ხმის ჩართვა', tone: 'blue', points: p.trend.plays },
        { label: 'აქტიური ადამიანი', tone: 'teal', points: p.trend.active },
      ], { label: 'MEDISLEEP დღეების მიხედვით', empty: 'ამ პერიოდში MEDISLEEP-ში არაფერი მომხდარა.' }))}`;
  }

  function soundsCard(d) {
    const s = d.sounds;
    const lib = s.library;
    const action = '<button type="button" class="btn ghost compact" data-sl-pane="sounds">ბიბლიოთეკა</button>';
    const libLine = `ბიბლიოთეკაში ${fmt(lib.total)} ხმა: აპში ჩანს ${fmt(lib.live)}${lib.draft ? ` · მონახაზი ${fmt(lib.draft)}` : ''}${lib.hidden ? ` · დამალული ${fmt(lib.hidden)}` : ''}${lib.noAudio ? ` · ფაილის გარეშე ${fmt(lib.noAudio)}` : ''}.`;
    const title = 'რას უსმენენ';
    const sub = `ბოლო ${fmt(d.period.days)} დღე: ჩართვა, წუთები და მსმენელები. რამდენიმე ხმა ერთად — თითოეულს ეთვლება.`;
    if (!s.rows.length) return card(title, sub, `${empty('ბიბლიოთეკაში ხმა ჯერ არ არის.')}`, { action });
    const top = Math.max(1, ...s.rows.map((r) => r.plays));
    const list = `<div class="s-sl-rank" role="table" aria-label="ხმები ჩართვით">
      <div class="s-sl-rank-row is-head" role="row"><span role="columnheader">ხმა</span><span aria-hidden="true"></span><span role="columnheader">ჩართვა</span><span role="columnheader">წუთი</span><span role="columnheader">ადამიანი</span></div>
      ${s.rows.map((r) => `<div class="s-sl-rank-row${r.status === 'LIVE' ? '' : ' is-off'}" role="row">
        <span role="cell" title="${esc(r.title)}"><b>${esc(r.title)}</b><small>${esc(r.categoryLabel)}${r.status === 'LIVE' ? '' : ` · ${esc(r.statusLabel)}`}${r.featured ? ' · რჩეული' : ''}</small></span>
        <div class="s-meter" aria-hidden="true"><i style="width:${r.plays ? Math.max(3, (r.plays / top) * 100).toFixed(1) : 0}%"></i></div>
        <b role="cell">${fmt(r.plays)}</b><em role="cell">${fmt(r.minutes)}</em><em role="cell">${fmt(r.listeners)}</em>
      </div>`).join('')}
    </div>`;
    const unknown = s.unknown.plays ? note(`ამოღებული ან უცნობი ხმა: ${fmt(s.unknown.plays)} ჩართვა, ${fmt(s.unknown.listeners)} ადამიანი.`) : '';
    return card(title, sub, `${list}${unknown}${note(esc(libLine))}`, { action });
  }

  function bedtimeCard(d) {
    const b = d.bedtimes;
    const title = 'როდის წვებიან';
    const sub = `ძილის რეჟიმის ღამეები დაწყების საათით (თბილისის დროით), ბოლო ${fmt(d.period.days)} დღე. მხოლოდ საერთო რიცხვები.`;
    if (b.hidden) return card(title, sub, kNote(b, 'საათები ჩანს მხოლოდ საერთო სურათად.'));
    const points = NIGHT_HOURS.map((h) => ({ label: `${String(h).padStart(2, '0')}:00`, count: b.hours[h] || 0 }));
    const peak = points.reduce((a, x) => (x.count > a.count ? x : a), points[0]);
    return card(title, sub, `${global.AdminCharts?.bars ? global.AdminCharts.bars(points, { label: 'ღამე', tone: 'violet', partial: false, empty: 'ძილის რეჟიმი ამ პერიოდში არ გამოუყენებიათ.' }) : ''}
      ${note(`${fmt(b.nights)} ღამე, ${fmt(b.people)} ადამიანი. ყველაზე ხშირად იწყებენ ${esc(peak.label)}-ზე.`)}`);
  }

  function pictureCard(d) {
    const p = d.picture;
    const title = 'ძილის საერთო სურათი';
    const sub = `ყველა ჩაწერილი ღამე ერთად, ბოლო ${fmt(d.period.days)} დღე — არასდროს ერთი ადამიანის.`;
    if (p.hidden) return card(title, sub, kNote(p, 'საშუალო ძილი, შეფასება და ფაქტორები ჩანს მხოლოდ საერთოდ.'));
    const q = p.avgQuality == null ? '—' : `${p.avgQuality.toLocaleString('ka-GE')} / 5 <small class="s-muted">· ${esc(QUALITY[Math.round(p.avgQuality)] || '')}</small>`;
    return card(title, sub, `
      ${facts([
        ['საშუალო ძილი', `${esc(mins(p.avgSleptMinutes))} <small class="s-muted">· ${fmt(p.sleptNights)} ღამით</small>`],
        ['დილის საშუალო შეფასება', `${q}`],
        ['დილის შეფასება', `${fmt(p.checkins)} <small class="s-muted">· ${fmt(p.nights)} ღამიდან, ${fmt(p.people)} ადამიანი</small>`],
      ])}
      ${h4('რამდენი სძინავთ')}${shares(p.buckets.map((b) => [b.label, b.count]), p.sleptNights) || empty('ხანგრძლივობა ჯერ არცერთ ღამეს არ აქვს.')}
      ${h4('რამ იმოქმედა — დილის შეფასებიდან')}${p.factors.length ? shares(p.factors.map((f) => [f.label, f.count]), p.checkins) : '<p class="p2-note">ფაქტორი ჯერ არავის მოუნიშნავს.</p>'}
      ${note('ხანგრძლივობა: Health-ის „ეძინა“ ან, თუ ის არ არის, საწოლში დრო მინუს ჩაძინებამდე დრო. ფაქტორის % — დილის შეფასებებიდან.')}`);
  }

  function remindersCard(d) {
    const r = d.reminders;
    const t = d.totals;
    const title = 'გეგმა, შეხსენებები და მაღვიძარა';
    const sub = 'ვისაც გეგმა აქვს: რა ჩართო. შეხსენებები და მაღვიძარა ტელეფონზე მუშაობს.';
    if (!r.plans) return card(title, sub, empty('გეგმა ჯერ არავის დაუყენებია.'));
    const row = (label, n) => [label, `${fmt(n)} <small class="s-muted">· ${pct(share(n, r.plans))}</small>`];
    return card(title, sub, `
      ${facts([
        ['ძილის გეგმა', fmt(r.plans)],
        row('დაწოლის შეხსენება', r.bedtimeReminder),
        row('დილის შეფასების შეხსენება', r.checkinReminder),
        row('მაღვიძარა', r.alarm),
        row('ქულა დამალა', r.hideScore),
      ])}
      ${h4('ადამიანები')}
      ${facts([
        ['MEDISLEEP-ის მომხმარებელი', `${fmt(t.people)} <small class="s-muted">· ანგარიშების ${pct(t.peopleRate)}</small>`],
        ['ღამე ჩაწერა', fmt(t.nightPeople)],
        ['მხოლოდ ხმები', fmt(t.onlySounds)],
        ['მხოლოდ გეგმა', fmt(t.onlyPlan)],
      ])}`);
  }

  function paintUsage(d, ctx) {
    const t = d.totals;
    wall.set(d.people, { total: d.peopleTotal });
    // The ladder's bars are against everyone in MEDISLEEP: the steps are not nested (sounds work without a plan).
    const steps = [{ key: 'people', count: t.people, rate: null }, ...d.ladder];
    return `${K.flagCallout(d.flag, '<b>MEDISLEEP შეჩერებულია.</b> ახალი ღამე ვერ ჩაიწერება და გეგმა ვერ შეიცვლება; ჩართული ხმა და მაღვიძარა ტელეფონზე გრძელდება.')}
      ${insights(d)}
      ${metrics([
        metric('MEDISLEEP-ის მომხმარებელი', fmt(t.people), `ანგარიშების ${pct(t.peopleRate)} · ${fmt(t.accounts)}-დან`),
        metric('ჩაწერილი ღამე', fmt(t.nights), `${fmt(t.nightPeople)} ადამიანი · დილით შეფასდა ${fmt(t.checkins)}`),
        metric('ხმის ჩართვა', fmt(t.plays), `${mins(t.listenMinutes)} · ${fmt(t.listeners)} ადამიანი`),
        metric('ძილის გეგმა', fmt(t.plans), `მაღვიძარა ${fmt(d.reminders.alarm)} · დაწოლის შეხსენება ${fmt(d.reminders.bedtimeReminder)}`),
      ])}
      ${card('პირველი გამოყენებიდან რეგულარულ ძილამდე', 'რამდენმა ადამიანმა გაიარა თითო ნაბიჯი, მთელი დროის განმავლობაში. ნაბიჯები ერთმანეთზე არ არის დამოკიდებული — ხმა გეგმის გარეშეც ირთვება. „3+ ღამე ერთ კვირაში“ — სამი ღამე ნებისმიერ შვიდ დღეში; „სხვა კვირასაც დაბრუნდა“ — პირველი დღიდან 7+ დღის შემდეგაც გამოიყენა. % ითვლება ყველა მომხმარებლიდან.',
        K.ladder(steps, LADDER, { first: 'ყველა მომხმარებელი', unit: '', emptyText: 'MEDISLEEP ჯერ არავის გამოუყენებია.' }))}
      ${wall.html()}
      ${periodBlock(d, ctx)}
      ${K.split(soundsCard(d), bedtimeCard(d))}
      ${K.split(pictureCard(d), remindersCard(d))}
      ${K.definitions([
        '<b>მომხმარებელი</b> — ვინც დააყენა ძილის გეგმა, ჩაწერა ღამე ან ჩართო ხმა. აპი MEDISLEEP-ის ეკრანების ნახვას ცალკე არ აგზავნის, ამიტომ „გამოიყენა“ ნიშნავს შენახულ ჩანაწერს. <b>აქტიური ადამიანი</b> — ვინც პერიოდში გეგმა დააყენა ან შეცვალა, ღამე ჩაწერა ან შეაფასა, ან ხმა ჩართო (თბილისის დღეებით).',
        '<b>ღამე</b> ითვლება იმ დილით, როცა დასრულდა. დრო მოდის ძილის რეჟიმიდან, ხელით ჩაწერიდან ან Apple Health / Health Connect-იდან — „რეჟიმით / ხელით / Health“ აჩვენებს, რომელმა გაიმარჯვა. „ძილის რეჟიმით“ — დრო რეჟიმიდანაა ან იმ ღამეს რეჟიმში ხმა ჩაირთო.',
        '<b>ხმის ჩართვა</b> — ერთი მოსმენა (ერთი ან რამდენიმე ხმა ერთად); წუთები — რამდენ ხანს უკრავდა. ხმების ცხრილში ერთად ჩართული თითოეული ხმა იღებს ამ ჩართვას და მის წუთებს.',
        `<b>კონფიდენციალობა</b> — ადამიანის ბარათზე მხოლოდ რაოდენობებია: ძილის ხანგრძლივობა, დაწოლისა და გაღვიძების დრო, შეფასება და ფაქტორები არ ჩანს, ბოლო აქტივობა ჩანს დღით, საათის გარეშე. საერთო სურათი და დაწოლის საათები ჩანს მხოლოდ მაშინ, როცა პერიოდში ${fmt(d.kMin)}+ სხვადასხვა რეალური ადამიანია (გუნდი არ ითვლება).`,
        '<b>გუნდი</b> — ზუსტად @medicard.ge ელფოსტით შესული ანგარიშები (დემო და თანამშრომლები). ტელეფონით და Apple-ით შესულები ჩვეულებრივი მომხმარებლები არიან.',
      ])}`;
  }

  function afterUsage(root) {
    wall.bind(root);
    root.querySelectorAll('[data-sl-pane]').forEach((b) => b.addEventListener('click', () => void global.renderSleepHost?.select(b.dataset.slPane)));
  }

  const renderSleepUsage = K.page({ tab: 'sleep', path: '/sleep/overview', capability: 'SLEEP_VIEW', paint: paintUsage, after: afterUsage });

  /* ═════════════ ხმები ═════════════ */
  const AUDIO_ACCEPT = 'audio/mp4,audio/x-m4a,audio/mpeg,.m4a,.mp3';
  const AUDIO_MAX = 12 * 1024 * 1024;
  const IMAGE_MAX = 2 * 1024 * 1024;
  const SLUG = /^[a-z0-9-]{2,40}$/;
  const lib = { sounds: [], category: 'all' };

  /** Admin token for the multipart upload (the JSON helper `api()` cannot send FormData). */
  const token = () => {
    try {
      return (typeof state !== 'undefined' && state && state.token) || localStorage.getItem('medicard.admin.token') || '';
    } catch {
      return '';
    }
  };

  /** Length of an audio file, read by the browser (sent along so the app knows it before downloading). */
  function audioDuration(file) {
    return new Promise((resolve) => {
      let settled = false;
      const url = URL.createObjectURL(file);
      const a = new Audio();
      const done = (value) => {
        if (settled) return;
        settled = true;
        URL.revokeObjectURL(url);
        resolve(value);
      };
      a.preload = 'metadata';
      a.onloadedmetadata = () => done(Number.isFinite(a.duration) && a.duration > 0 ? Math.round(a.duration * 1000) : null);
      a.onerror = () => done(null);
      setTimeout(() => done(null), 8000);
      a.src = url;
    });
  }

  async function uploadFile(id, slot, file) {
    const fd = new FormData();
    if (slot !== 'art') {
      const ms = await audioDuration(file);
      if (ms) fd.append('durationMs', String(ms));
    }
    fd.append('file', file, file.name);
    const t = token();
    let res;
    try {
      res = await fetch(`${base()}/api/admin/sleep/sounds/${encodeURIComponent(id)}/${slot}`, {
        method: 'POST',
        headers: t ? { Authorization: `Bearer ${t}` } : {},
        body: fd,
      });
    } catch {
      throw Object.assign(new Error('სერვერთან კავშირი ვერ დამყარდა.'), { status: 0 });
    }
    const text = await res.text();
    let data = {};
    try { data = text ? JSON.parse(text) : {}; } catch { data = {}; }
    if (!res.ok) {
      const msg = res.status === 401 ? 'სესია ამოიწურა — თავიდან შედი.'
        : res.status === 413 ? 'ფაილი ძალიან დიდია.'
          : data.error || 'ფაილი ვერ აიტვირთა.';
      throw Object.assign(new Error(msg), { status: res.status });
    }
    return data.sound;
  }

  function soundRow(s, i, n, canMove) {
    const st = SOUND_STATUS[s.status] || ['', 'უცნობი'];
    const art = s.art ? `<img src="${esc(src(s.art.url))}" alt="" loading="lazy" decoding="async">` : ico('sleep');
    const chips = [
      `<span class="s-badge is-plain">${esc(CATEGORIES[s.category] || 'სხვა')}</span>`,
      s.audio
        ? `<span class="s-badge is-plain" title="ხმის ფაილი">ხმა${s.audio.size ? ` · ${esc(size(s.audio.size))}` : ''}${s.durationMs ? ` · ${esc(clock(s.durationMs))}` : ''}</span>`
        : '<span class="s-badge is-warn">ხმის ფაილი არ არის</span>',
      s.tail ? '<span class="s-badge is-plain" title="ტაიმერის ბოლოს ჩასაქრობი ნაწილი">დასასრული</span>' : '<span class="s-badge s-sl-faint">დასასრულის გარეშე</span>',
      s.art ? '<span class="s-badge is-plain">სურათი</span>' : '<span class="s-badge s-sl-faint">სურათის გარეშე</span>',
      `<span class="s-badge s-sl-faint">${s.loop ? 'უკრავს განმეორებით' : 'უკრავს ერთხელ'}</span>`,
    ].join('');
    const move = canMove
      ? `<div class="s-sl-move"><button type="button" class="btn compact ghost icon-only" data-act="up" ${i === 0 ? 'disabled' : ''} aria-label="ზემოთ აწევა" title="ზემოთ">${ico('sl-up')}</button><button type="button" class="btn compact ghost icon-only" data-act="down" ${i === n - 1 ? 'disabled' : ''} aria-label="ქვემოთ ჩაწევა" title="ქვემოთ">${ico('sl-down')}</button></div>`
      : '';
    const status = s.status === 'LIVE'
      ? '<button type="button" class="btn compact ghost" data-act="hide">დამალვა</button>'
      : `<button type="button" class="btn compact" data-act="publish" ${s.audio ? '' : 'disabled title="ჯერ ხმის ფაილი ატვირთე"'}>გამოქვეყნება</button>`;
    const up = (slot, label, accept, enabled = true) => `<label class="btn compact ghost s-sl-up${enabled ? '' : ' is-disabled'}"${enabled ? ' tabindex="0"' : ' title="ჯერ ხმის ფაილი ატვირთე"'}>${ico('upload')} ${label}<input type="file" hidden data-up="${slot}" accept="${accept}" ${enabled ? '' : 'disabled'}></label>`;
    return `<article class="s-sl-sound${s.status === 'LIVE' ? '' : ' is-off'}" data-sound="${esc(s.id)}" data-focus="${esc(s.id)}">
      <div class="s-sl-art" style="--tint:${esc(hex(s.tint))}">${art}</div>
      <div class="s-sl-main">
        <div class="s-sl-title"><b>${esc(s.titleKa)}</b>${badge(st)}${s.featured ? '<span class="s-badge is-info">რჩეული</span>' : ''}</div>
        <p class="s-sl-sub">${esc(s.titleEn)}${s.subtitleKa ? ` · ${esc(s.subtitleKa)}` : ''}</p>
        <div class="s-sl-chips">${chips}</div>
        ${s.audio ? `<audio class="s-sl-audio" controls preload="none" src="${esc(src(s.audio.url))}" aria-label="${esc(`${s.titleKa} — მოსმენა`)}"></audio>` : ''}
        ${s.tail ? `<details class="s-sl-tail"><summary>დასასრულის მოსმენა</summary><audio class="s-sl-audio" controls preload="none" src="${esc(src(s.tail.url))}"></audio></details>` : ''}
        <p class="s-sl-msg" data-row-msg role="status"></p>
      </div>
      <div class="s-sl-actions">
        <div class="s-sl-row">${move}<button type="button" class="btn compact" data-act="edit">${ico('edit')} რედაქტირება</button>${status}</div>
        <div class="s-sl-row">${up('audio', s.audio ? 'ხმის შეცვლა' : 'ხმის ფაილი', AUDIO_ACCEPT)}${up('tail', 'დასასრული', AUDIO_ACCEPT, Boolean(s.audio))}${up('art', 'სურათი', 'image/jpeg,image/png,image/webp')}</div>
      </div>
    </article>`;
  }

  async function renderSounds({ quiet = false, focus = null } = {}) {
    const host = pane('sounds');
    if (!host) return;
    if (!quiet || !lib.sounds.length) host.innerHTML = skel();
    let data;
    try {
      data = await api('/sounds');
    } catch (err) {
      host.innerHTML = failHtml(err, 'SLEEP_VIEW');
      retry(host, renderSounds);
      return;
    }
    lib.sounds = data.sounds || [];
    paintSounds(host);
    if (focus) global.AdminFocus?.flash(host, focus);
  }

  function paintSounds(host) {
    const all = lib.sounds;
    const live = all.filter((s) => s.status === 'LIVE').length;
    const noAudio = all.filter((s) => !s.audio).length;
    const counts = Object.fromEntries(Object.keys(CATEGORIES).map((k) => [k, all.filter((s) => s.category === k).length]));
    const rows = lib.category === 'all' ? all : all.filter((s) => s.category === lib.category);
    const canMove = lib.category === 'all';
    host.innerHTML = `<div class="s-stack v3-tab-shell s-sl">
      ${metrics([
        metric('ხმა ბიბლიოთეკაში', fmt(all.length), Object.entries(CATEGORIES).map(([k, l]) => `${l} ${fmt(counts[k])}`).join(' · ')),
        metric('აპში ჩანს', fmt(live), 'გამოქვეყნებული, ფაილით'),
        metric('მონახაზი და დამალული', fmt(all.length - live), 'აპში არ ჩანს'),
        metric('ფაილის გარეშე', fmt(noAudio), noAudio ? 'ატვირთე, რომ გამოქვეყნდეს' : 'ყველას აქვს ფაილი', noAudio ? 'warn' : ''),
      ])}
      <div class="s-toolbar">
        <div class="s-segment" role="tablist" aria-label="კატეგორია">
          <button type="button" role="tab" data-cat="all" aria-selected="${lib.category === 'all'}">ყველა <i>${fmt(all.length)}</i></button>
          ${Object.entries(CATEGORIES).map(([k, l]) => `<button type="button" role="tab" data-cat="${k}" aria-selected="${lib.category === k}">${esc(l)}${counts[k] ? ` <i>${fmt(counts[k])}</i>` : ''}</button>`).join('')}
        </div>
        <div class="s-sl-row">
          <button type="button" class="btn ghost compact" data-refresh>${ico('refresh')} განახლება</button>
          <button type="button" class="btn primary" data-new-sound>${ico('plus')} ახალი ხმა</button>
        </div>
      </div>
      <section class="s-card">
        <header class="s-card-head"><div><h3>ხმების ბიბლიოთეკა</h3>
          <p>რიგი აქაც და აპშიც ერთია${canMove ? ' — ისრებით შეცვალე' : ' — რიგის შესაცვლელად აირჩიე „ყველა“'}. აპში ჩანს მხოლოდ „აპში ჩანს“ ხმა, რომელსაც ფაილი აქვს. ხმა: M4A ან MP3, 12 მბ-მდე; სურათი: JPG, PNG ან WEBP, 2 მბ-მდე. ახალი ხმის ფაილი ძველ დასასრულს მოხსნის.</p></div></header>
        <div class="s-card-body">${rows.length
          ? `<div class="s-sl-sounds">${rows.map((s, i) => soundRow(s, i, rows.length, canMove)).join('')}</div>`
          : empty(lib.category === 'all' ? 'ბიბლიოთეკა ცარიელია — დაამატე პირველი ხმა.' : 'ამ კატეგორიაში ხმა არ არის.')}</div>
      </section>
    </div>`;

    host.querySelectorAll('[data-cat]').forEach((b) => b.addEventListener('click', () => {
      lib.category = b.dataset.cat;
      paintSounds(host);
    }));
    host.querySelector('[data-refresh]')?.addEventListener('click', () => void renderSounds());
    host.querySelector('[data-new-sound]')?.addEventListener('click', () => soundDialog(null));
    host.querySelectorAll('[data-sound]').forEach((row) => {
      const sound = lib.sounds.find((s) => s.id === row.dataset.sound);
      if (!sound) return;
      row.querySelectorAll('[data-act]').forEach((btn) => btn.addEventListener('click', () => {
        const act = btn.dataset.act;
        if (act === 'up' || act === 'down') void move(sound.id, act === 'up' ? -1 : 1, btn);
        else if (act === 'edit') soundDialog(sound);
        else if (act === 'publish') publish(sound, btn);
        else if (act === 'hide') void setStatus(sound, 'HIDDEN', btn);
      }));
      row.querySelectorAll('[data-up]').forEach((input) => input.addEventListener('change', () => {
        const file = input.files?.[0];
        input.value = '';
        if (file) void upload(sound, input.dataset.up, file, row);
      }));
    });
  }

  async function upload(sound, slot, file, row) {
    const msg = row.querySelector('[data-row-msg]');
    const image = slot === 'art';
    if (file.size > (image ? IMAGE_MAX : AUDIO_MAX)) {
      toast(image ? 'სურათი 2 მბ-ზე ნაკლები უნდა იყოს.' : 'ხმის ფაილი 12 მბ-ზე ნაკლები უნდა იყოს.', 'bad');
      return;
    }
    // The server checks the first bytes too; this only saves a pointless upload.
    if (image ? !/^image\/(jpeg|png|webp)$/.test(file.type) : !/\.(m4a|mp3)$/i.test(file.name)) {
      toast(image ? 'სურათი უნდა იყოს JPG, PNG ან WEBP.' : 'ხმა უნდა იყოს M4A (AAC) ან MP3.', 'bad');
      return;
    }
    row.classList.add('is-busy');
    row.querySelectorAll('button, input').forEach((el) => { el.disabled = true; });
    if (msg) msg.textContent = `იტვირთება: ${file.name} (${size(file.size)})…`;
    try {
      await uploadFile(sound.id, slot, file);
      const words = { audio: 'ხმის ფაილი აიტვირთა', tail: 'დასასრული აიტვირთა', art: 'სურათი აიტვირთა' };
      toast(`„${sound.titleKa}“ — ${words[slot]}`, 'ok');
      if (slot === 'audio' && sound.tail) toast('ძველი დასასრული მოიხსნა — ახალ ხმას ახალი დასასრული სჭირდება.', 'warn');
      await renderSounds({ quiet: true, focus: sound.id });
    } catch (err) {
      toast(say(err, 'ფაილი ვერ აიტვირთა. სცადე ხელახლა.'), 'bad');
      row.classList.remove('is-busy');
      if (msg) msg.textContent = '';
      paintSounds(pane('sounds'));
    }
  }

  async function move(id, dir, btn) {
    const ids = lib.sounds.map((s) => s.id);
    const i = ids.indexOf(id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    btn.disabled = true;
    try {
      await api('/sounds/order', { method: 'POST', body: { ids } });
      toast('რიგი შეიცვალა', 'ok');
      await renderSounds({ quiet: true, focus: id });
    } catch (err) {
      toast(say(err, 'რიგი ვერ შეიცვალა. სცადე ხელახლა.'), 'bad');
      btn.disabled = false;
    }
  }

  async function setStatus(sound, status, btn) {
    if (btn) btn.disabled = true;
    try {
      await api(`/sounds/${encodeURIComponent(sound.id)}`, { method: 'PATCH', body: { status } });
      toast(status === 'LIVE' ? `„${sound.titleKa}“ აპში გამოჩნდა` : status === 'HIDDEN' ? `„${sound.titleKa}“ აპიდან დაიმალა` : `„${sound.titleKa}“ მონახაზად დაბრუნდა`, status === 'LIVE' ? 'ok' : 'warn');
      await renderSounds({ quiet: true, focus: sound.id });
    } catch (err) {
      toast(say(err, 'სტატუსი ვერ შეიცვალა. სცადე ხელახლა.'), 'bad');
      if (btn) btn.disabled = false;
    }
  }

  function publish(sound, btn) {
    if (!sound.audio) {
      toast('გამოსაქვეყნებლად ჯერ ხმის ფაილი ატვირთე.', 'bad');
      return;
    }
    const confirm = V().openConfirm;
    if (!confirm) { void setStatus(sound, 'LIVE', btn); return; }
    confirm({
      title: `„${sound.titleKa}“ — გამოქვეყნება?`,
      message: `ხმა გამოჩნდება აპის ხმების სიაში ყველასთვის, ვინც MEDISLEEP-ს ხსნის${sound.tail ? '' : ' (დასასრულის გარეშე: ტაიმერის ბოლოს აპი თავად ჩააქრობს)'}.`,
      confirmLabel: 'გამოქვეყნება',
      onConfirm: () => setStatus(sound, 'LIVE', btn),
    });
  }

  function soundDialog(sound) {
    const isNew = !sound;
    const s = sound || { id: '', category: 'rain', titleKa: '', titleEn: '', subtitleKa: '', subtitleEn: '', tint: '#2B2452', loop: true, featured: false, status: 'DRAFT' };
    const statusField = isNew ? '' : `<label class="s-field"><span>სტატუსი</span><select name="status">
      ${Object.entries(SOUND_STATUS).map(([k, [, l]]) => `<option value="${k}" ${s.status === k ? 'selected' : ''} ${k === 'LIVE' && !s.audio ? 'disabled' : ''}>${esc(l)}${k === 'LIVE' && !s.audio ? ' — ჯერ ფაილი ატვირთე' : ''}</option>`).join('')}
    </select></label>`;
    const dialog = V().openDialog?.({
      title: isNew ? 'ახალი ხმა' : `რედაქტირება · ${s.titleKa}`,
      description: isNew ? 'ხმა იქმნება მონახაზად: შემდეგ ატვირთე ფაილი და გამოაქვეყნე.' : 'ცვლილება აპში ჩანს მომდევნო გახსნისას.',
      wide: true,
      body: `<form id="sl-sound-form" class="s-stack" novalidate>
        ${isNew ? `<label class="s-field"><span>ID *</span><input name="id" required maxlength="40" placeholder="rain-roof" autocomplete="off" spellcheck="false"><small>ლათინური პატარა ასოები, ციფრები და ტირე (2–40). აპი ხმას ამით იმახსოვრებს — მერე ვეღარ შეიცვლება.</small></label>` : ''}
        <div class="s-form-grid">
          <label class="s-field"><span>სახელი ქართულად *</span><input name="titleKa" required maxlength="60" value="${esc(s.titleKa)}" placeholder="წვიმა სახურავზე"></label>
          <label class="s-field"><span>სახელი ინგლისურად *</span><input name="titleEn" required maxlength="60" value="${esc(s.titleEn)}" placeholder="Rain on the roof"></label>
        </div>
        <div class="s-form-grid">
          <label class="s-field"><span>მოკლე აღწერა ქართულად</span><input name="subtitleKa" maxlength="90" value="${esc(s.subtitleKa)}" placeholder="თანაბარი, რბილი წვიმა"></label>
          <label class="s-field"><span>მოკლე აღწერა ინგლისურად</span><input name="subtitleEn" maxlength="90" value="${esc(s.subtitleEn)}" placeholder="Soft, steady rain"></label>
        </div>
        <div class="s-form-grid">
          <label class="s-field"><span>კატეგორია</span><select name="category">${Object.entries(CATEGORIES).map(([k, l]) => `<option value="${k}" ${s.category === k ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select></label>
          <div class="s-field"><span>ფერი (ბარათის ფონი, სურათის გარეშე)</span><div class="s-sl-tint"><input type="color" name="tintPick" value="${esc(hex(s.tint))}" aria-label="ფერის არჩევა"><input name="tint" maxlength="7" value="${esc(hex(s.tint))}" spellcheck="false" aria-label="ფერი (#RRGGBB)"></div></div>
          ${statusField}
        </div>
        <label class="s-switch-row"><span><b>უკრავს განმეორებით</b><small>წვიმა და ხმაური — კი; მელოდია, რომელიც ბოლომდე უნდა მოისმინონ — არა.</small></span><input class="s-switch" type="checkbox" role="switch" name="loop" ${s.loop ? 'checked' : ''}></label>
        <label class="s-switch-row"><span><b>რჩეული</b><small>აპში ზედა რიგში გამოჩნდება.</small></span><input class="s-switch" type="checkbox" role="switch" name="featured" ${s.featured ? 'checked' : ''}></label>
      </form>`,
      footer: `<p class="s-form-msg" role="alert"></p><button type="button" class="btn" data-cancel>გაუქმება</button><button type="submit" class="btn primary" form="sl-sound-form">${isNew ? 'შექმნა' : 'შენახვა'}</button>`,
    });
    const form = doc.getElementById('sl-sound-form');
    const panel = form?.closest('.v3-dialog-panel');
    if (!form || !panel || !dialog) return;
    const alertEl = panel.querySelector('[role=alert]');
    /** The named „id“ input (form.id would be the form’s own id attribute in older engines). */
    const idInput = () => form.elements.namedItem('id');
    panel.querySelector('[data-cancel]').onclick = () => void dialog.close();
    form.tintPick.addEventListener('input', () => { form.tint.value = form.tintPick.value.toUpperCase(); });
    form.tint.addEventListener('input', () => { if (/^#[0-9A-Fa-f]{6}$/.test(form.tint.value)) form.tintPick.value = form.tint.value; });
    (isNew ? idInput() : form.titleKa).focus();
    form.onsubmit = async (ev) => {
      ev.preventDefault();
      alertEl.textContent = '';
      const next = {
        category: form.category.value,
        titleKa: form.titleKa.value.trim(),
        titleEn: form.titleEn.value.trim(),
        subtitleKa: form.subtitleKa.value.trim(),
        subtitleEn: form.subtitleEn.value.trim(),
        tint: form.tint.value.trim().toUpperCase(),
        loop: form.loop.checked,
        featured: form.featured.checked,
      };
      if (!isNew) next.status = form.status.value;
      const id = isNew ? idInput().value.trim() : s.id;
      if (isNew && !SLUG.test(id)) { alertEl.textContent = 'ID: მხოლოდ ლათინური პატარა ასოები, ციფრები და ტირე (2–40).'; idInput().focus(); return; }
      if (isNew && lib.sounds.some((x) => x.id === id)) { alertEl.textContent = 'ამ ID-ით ხმა უკვე არსებობს.'; idInput().focus(); return; }
      if (!next.titleKa || !next.titleEn) { alertEl.textContent = 'სახელი ორივე ენაზე სავალდებულოა.'; (next.titleKa ? form.titleEn : form.titleKa).focus(); return; }
      if (!/^#[0-9A-F]{6}$/.test(next.tint)) { alertEl.textContent = 'ფერი უნდა იყოს #RRGGBB ფორმატში, მაგ. #2B2452.'; form.tint.focus(); return; }
      if (next.status === 'LIVE' && !s.audio) { alertEl.textContent = 'გამოსაქვეყნებლად ჯერ ხმის ფაილი ატვირთე.'; return; }
      let body = next;
      if (!isNew) {
        body = Object.fromEntries(Object.entries(next).filter(([k, v]) => (k === 'tint' ? hex(s[k]).toUpperCase() !== v : s[k] !== v)));
        if (!Object.keys(body).length) {
          V().setDirty?.(false);
          await dialog.close();
          toast('ცვლილება არ არის', 'info');
          return;
        }
      }
      const submit = panel.querySelector('[type=submit]');
      submit.disabled = true;
      submit.classList.add('is-loading');
      try {
        if (isNew) {
          const order = Math.max(0, ...lib.sounds.map((x) => Number(x.sortOrder) || 0)) + 10;
          await api('/sounds', { method: 'POST', body: { id, ...body, sortOrder: order } });
        } else {
          await api(`/sounds/${encodeURIComponent(s.id)}`, { method: 'PATCH', body });
        }
        V().setDirty?.(false);
        await dialog.close();
        toast(isNew ? `„${next.titleKa}“ შეიქმნა მონახაზად — ახლა ატვირთე ფაილი.` : 'ცვლილებები შენახულია', 'ok');
        if (isNew) lib.category = 'all';
        await renderSounds({ quiet: true, focus: id });
      } catch (err) {
        alertEl.textContent = say(err, 'ვერ შეინახა. შეამოწმე ველები და სცადე ხელახლა.');
        submit.disabled = false;
        submit.classList.remove('is-loading');
      }
    };
  }

  /* ═════════════ რჩევები ═════════════ */
  const tipsState = { tips: [], triggers: Object.keys(TRIGGERS), view: 'active' };

  async function renderTips({ quiet = false, focus = null } = {}) {
    const host = pane('tips');
    if (!host) return;
    if (!quiet || !tipsState.tips.length) host.innerHTML = skel();
    let data;
    try {
      data = await api('/tips');
    } catch (err) {
      host.innerHTML = failHtml(err, 'SLEEP_VIEW');
      retry(host, renderTips);
      return;
    }
    tipsState.tips = data.tips || [];
    if (Array.isArray(data.triggers) && data.triggers.length) tipsState.triggers = data.triggers;
    paintTips(host);
    if (focus) global.AdminFocus?.flash(host, focus);
  }

  function tipRow(t) {
    const st = TIP_STATUS[t.status] || ['', 'უცნობი'];
    const actions = t.status === 'ARCHIVED'
      ? '<button type="button" class="btn compact ghost" data-tip-act="restore">აღდგენა</button>'
      : `<button type="button" class="btn compact" data-tip-act="edit">${ico('edit')} რედაქტირება</button>
        <button type="button" class="btn compact ghost" data-tip-act="${t.status === 'LIVE' ? 'hide' : 'show'}">${t.status === 'LIVE' ? 'დამალვა' : 'ჩვენება'}</button>
        <button type="button" class="btn compact ghost" data-tip-act="archive">არქივში</button>`;
    return `<article class="s-sl-tip${t.status === 'LIVE' ? '' : ' is-off'}" data-tip="${esc(t.id)}" data-focus="${esc(t.id)}">
      <div class="s-sl-main">
        <div class="s-sl-title"><b>${esc(t.titleKa)}</b>${badge(st)}</div>
        <p class="s-sl-sub">${esc(t.titleEn)}</p>
        <p class="s-sl-body">${esc(t.bodyKa)}</p>
      </div>
      <div class="s-sl-actions"><div class="s-sl-row">${actions}</div></div>
    </article>`;
  }

  function paintTips(host) {
    const all = tipsState.tips;
    const archived = all.filter((t) => t.status === 'ARCHIVED');
    const active = all.filter((t) => t.status !== 'ARCHIVED');
    const shown = tipsState.view === 'archive' ? archived : active;
    const groups = tipsState.triggers
      .map((key) => [key, shown.filter((t) => t.trigger === key).sort((a, b) => a.sortOrder - b.sortOrder)])
      .filter(([, list]) => list.length);
    const live = active.filter((t) => t.status === 'LIVE');
    const uncovered = tipsState.triggers.filter((k) => !live.some((t) => t.trigger === k));
    host.innerHTML = `<div class="s-stack v3-tab-shell s-sl">
      <div class="s-toolbar">
        <div class="s-segment" role="tablist" aria-label="რჩევების ფილტრი">
          <button type="button" role="tab" data-tview="active" aria-selected="${tipsState.view === 'active'}">აქტიური <i>${fmt(active.length)}</i></button>
          <button type="button" role="tab" data-tview="archive" aria-selected="${tipsState.view === 'archive'}">არქივი${archived.length ? ` <i>${fmt(archived.length)}</i>` : ''}</button>
        </div>
        <div class="s-sl-row">
          <button type="button" class="btn ghost compact" data-refresh>${ico('refresh')} განახლება</button>
          <button type="button" class="btn primary" data-new-tip>${ico('plus')} ახალი რჩევა</button>
        </div>
      </div>
      <div class="s-callout">${ico('info')}<p>აპი ერთდროულად მაქსიმუმ <b>3 რჩევას</b> აჩვენებს: ჯერ ადამიანის ძილის მიხედვით — თითო მიზეზზე ერთს, „რიგის“ მიხედვით პირველს — დანარჩენ ადგილს კი „ყველასთვის“ ჯგუფი ავსებს. დამალული და არქივში გადატანილი რჩევა აპში არ ჩანს.${tipsState.view === 'active' && uncovered.length ? ` <b>აქტიური რჩევა არ აქვს:</b> ${esc(uncovered.map((k) => (TRIGGERS[k] || [k])[0]).join(', '))}.` : ''}</p></div>
      <section class="s-card">
        <header class="s-card-head"><div><h3>${tipsState.view === 'archive' ? 'არქივი' : 'რჩევები — როდის ჩანს'}</h3><p>${tipsState.view === 'archive' ? 'აპში არ ჩანს; „აღდგენა“ აბრუნებს დამალულად.' : 'დალაგებულია მიზეზის მიხედვით, რომლითაც აპი რჩევას სთავაზობს.'}</p></div></header>
        <div class="s-card-body">${groups.length ? groups.map(([key, list]) => `<div class="s-sl-group">
            <div class="s-sl-group-head"><h4>${esc((TRIGGERS[key] || ['სხვა'])[0])}</h4><p>${esc((TRIGGERS[key] || ['', ''])[1])}</p><span class="s-badge is-plain">${fmt(list.length)}</span></div>
            <div class="s-sl-tips">${list.map(tipRow).join('')}</div>
          </div>`).join('')
          : empty(tipsState.view === 'archive' ? 'არქივში რჩევა არ არის.' : 'რჩევა ჯერ არ არის — დაამატე პირველი.')}</div>
      </section>
    </div>`;
    host.querySelectorAll('[data-tview]').forEach((b) => b.addEventListener('click', () => {
      tipsState.view = b.dataset.tview;
      paintTips(host);
    }));
    host.querySelector('[data-refresh]')?.addEventListener('click', () => void renderTips());
    host.querySelector('[data-new-tip]')?.addEventListener('click', () => tipDialog(null));
    host.querySelectorAll('[data-tip]').forEach((row) => {
      const tip = all.find((t) => t.id === row.dataset.tip);
      if (!tip) return;
      row.querySelectorAll('[data-tip-act]').forEach((btn) => btn.addEventListener('click', () => {
        const act = btn.dataset.tipAct;
        if (act === 'edit') tipDialog(tip);
        else if (act === 'hide') void saveTip(tip, { status: 'HIDDEN' }, btn, 'რჩევა დაიმალა');
        else if (act === 'show') void saveTip(tip, { status: 'LIVE' }, btn, 'რჩევა აპში გამოჩნდა');
        else if (act === 'restore') void saveTip(tip, { status: 'HIDDEN' }, btn, 'რჩევა არქივიდან დაბრუნდა დამალულად');
        else if (act === 'archive') {
          const run = () => saveTip(tip, { status: 'ARCHIVED' }, btn, 'რჩევა არქივში გადავიდა');
          if (V().openConfirm) {
            V().openConfirm({
              title: `„${tip.titleKa}“ — არქივში გადატანა?`,
              message: 'რჩევა აპიდან გაქრება. ნებისმიერ დროს შეგიძლია აღადგინო „არქივიდან“.',
              confirmLabel: 'არქივში',
              variant: 'danger',
              onConfirm: run,
            });
          } else void run();
        }
      }));
    });
  }

  const tipBody = (t, patch = {}) => ({
    trigger: t.trigger,
    titleKa: t.titleKa,
    titleEn: t.titleEn,
    bodyKa: t.bodyKa,
    bodyEn: t.bodyEn,
    status: t.status,
    sortOrder: Number(t.sortOrder) || 0,
    ...patch,
  });

  async function saveTip(tip, patch, btn, okText) {
    if (btn) btn.disabled = true;
    try {
      await api(`/tips/${encodeURIComponent(tip.id)}`, { method: 'PUT', body: tipBody(tip, patch) });
      toast(okText, patch.status === 'LIVE' ? 'ok' : 'warn');
      if (patch.status === 'ARCHIVED') tipsState.view = 'active';
      await renderTips({ quiet: true, focus: tip.id });
    } catch (err) {
      toast(say(err, 'რჩევა ვერ შეინახა. სცადე ხელახლა.'), 'bad');
      if (btn) btn.disabled = false;
    }
  }

  function tipDialog(tip) {
    const isNew = !tip;
    const nextOrder = (trigger) => Math.max(-10, ...tipsState.tips.filter((t) => t.trigger === trigger).map((t) => Number(t.sortOrder) || 0)) + 10;
    const t = tip || { id: '', trigger: 'always', titleKa: '', titleEn: '', bodyKa: '', bodyEn: '', status: 'LIVE', sortOrder: nextOrder('always') };
    const dialog = V().openDialog?.({
      title: isNew ? 'ახალი რჩევა' : `რედაქტირება · ${t.titleKa}`,
      description: 'რჩევა მოკლე და კონკრეტული უნდა იყოს: რა გააკეთოს დღეს საღამოს ან ხვალ დილით.',
      wide: true,
      body: `<form id="sl-tip-form" class="s-stack" novalidate>
        <div class="s-form-grid">
          ${isNew ? '<label class="s-field"><span>ID *</span><input name="id" required maxlength="40" placeholder="cool-room" autocomplete="off" spellcheck="false"><small>ლათინური პატარა ასოები, ციფრები და ტირე (2–40).</small></label>' : ''}
          <label class="s-field"><span>როდის ჩანს</span><select name="trigger">${tipsState.triggers.map((k) => `<option value="${esc(k)}" ${t.trigger === k ? 'selected' : ''}>${esc((TRIGGERS[k] || [k])[0])}</option>`).join('')}</select><small data-trigger-hint>${esc((TRIGGERS[t.trigger] || ['', ''])[1])}</small></label>
          <label class="s-field"><span>სტატუსი</span><select name="status">${['LIVE', 'HIDDEN'].map((k) => `<option value="${k}" ${t.status === k ? 'selected' : ''}>${esc(TIP_STATUS[k][1])}</option>`).join('')}</select></label>
          <label class="s-field"><span>რიგი</span><input type="number" name="sortOrder" min="0" max="100000" step="1" value="${esc(t.sortOrder)}"><small>ნაკლები = პირველი ამ ჯგუფში.</small></label>
        </div>
        <div class="s-form-grid">
          <label class="s-field"><span>სათაური ქართულად *</span><input name="titleKa" required maxlength="80" value="${esc(t.titleKa)}"></label>
          <label class="s-field"><span>სათაური ინგლისურად *</span><input name="titleEn" required maxlength="80" value="${esc(t.titleEn)}"></label>
        </div>
        <label class="s-field"><span>ტექსტი ქართულად *</span><textarea name="bodyKa" rows="4" maxlength="600" required>${esc(t.bodyKa)}</textarea><small data-count="bodyKa"></small></label>
        <label class="s-field"><span>ტექსტი ინგლისურად *</span><textarea name="bodyEn" rows="4" maxlength="600" required>${esc(t.bodyEn)}</textarea><small data-count="bodyEn"></small></label>
      </form>`,
      footer: `<p class="s-form-msg" role="alert"></p><button type="button" class="btn" data-cancel>გაუქმება</button><button type="submit" class="btn primary" form="sl-tip-form">${isNew ? 'დამატება' : 'შენახვა'}</button>`,
    });
    const form = doc.getElementById('sl-tip-form');
    const panel = form?.closest('.v3-dialog-panel');
    if (!form || !panel || !dialog) return;
    const alertEl = panel.querySelector('[role=alert]');
    /** The named „id“ input (form.id would be the form’s own id attribute in older engines). */
    const idInput = () => form.elements.namedItem('id');
    panel.querySelector('[data-cancel]').onclick = () => void dialog.close();
    const counts = () => ['bodyKa', 'bodyEn'].forEach((k) => { panel.querySelector(`[data-count="${k}"]`).textContent = `${form[k].value.length} / 600`; });
    counts();
    form.bodyKa.addEventListener('input', counts);
    form.bodyEn.addEventListener('input', counts);
    form.trigger.addEventListener('change', () => {
      panel.querySelector('[data-trigger-hint]').textContent = (TRIGGERS[form.trigger.value] || ['', ''])[1];
      if (isNew) form.sortOrder.value = String(nextOrder(form.trigger.value));
    });
    (isNew ? idInput() : form.titleKa).focus();
    form.onsubmit = async (ev) => {
      ev.preventDefault();
      alertEl.textContent = '';
      const id = isNew ? idInput().value.trim() : t.id;
      const body = {
        trigger: form.trigger.value,
        titleKa: form.titleKa.value.trim(),
        titleEn: form.titleEn.value.trim(),
        bodyKa: form.bodyKa.value.trim(),
        bodyEn: form.bodyEn.value.trim(),
        status: form.status.value,
        sortOrder: Math.max(0, Math.min(100000, Math.round(Number(form.sortOrder.value) || 0))),
      };
      if (isNew && !SLUG.test(id)) { alertEl.textContent = 'ID: მხოლოდ ლათინური პატარა ასოები, ციფრები და ტირე (2–40).'; idInput().focus(); return; }
      if (isNew && tipsState.tips.some((x) => x.id === id)) { alertEl.textContent = 'ამ ID-ით რჩევა უკვე არსებობს (შესაძლოა არქივში).'; idInput().focus(); return; }
      if (!body.titleKa || !body.titleEn || !body.bodyKa || !body.bodyEn) { alertEl.textContent = 'სათაური და ტექსტი ორივე ენაზე სავალდებულოა.'; return; }
      const submit = panel.querySelector('[type=submit]');
      submit.disabled = true;
      submit.classList.add('is-loading');
      try {
        await api(`/tips/${encodeURIComponent(id)}`, { method: 'PUT', body });
        V().setDirty?.(false);
        await dialog.close();
        toast(isNew ? 'რჩევა დაემატა' : 'რჩევა შენახულია', 'ok');
        tipsState.view = 'active';
        await renderTips({ quiet: true, focus: id });
      } catch (err) {
        alertEl.textContent = say(err, 'ვერ შეინახა. შეამოწმე ველები და სცადე ხელახლა.');
        submit.disabled = false;
        submit.classList.remove('is-loading');
      }
    };
  }

  /* ═════════════ პარამეტრები ═════════════ */
  const TIMER_PRESETS = [5, 10, 15, 20, 30, 45, 60, 90, 120, 180, 0];

  async function renderSettings() {
    const host = pane('settings');
    if (!host) return;
    host.innerHTML = skel();
    let data;
    try {
      data = await api('/config');
    } catch (err) {
      host.innerHTML = failHtml(err, 'SLEEP_VIEW');
      retry(host, renderSettings);
      return;
    }
    paintSettings(host, data.config || {});
  }

  function paintSettings(host, c) {
    const options = [...new Set([...TIMER_PRESETS, ...(c.timerOptions || [])])].sort((a, b) => (a === 0 ? 1 : b === 0 ? -1 : a - b));
    const chosen = new Set(c.timerOptions || []);
    const factors = new Set(c.checkinFactors || Object.keys(FACTORS));
    const volume = Math.round((Number(c.defaultVolume) || 0.7) * 100);
    host.innerHTML = `<div class="s-stack v3-tab-shell s-sl">
      <form class="s-stack" data-sl-config novalidate>
        <section class="s-card"><header class="s-card-head"><div><h3>ხმის ტაიმერი</h3><p>რა ვარიანტები ჩანს ტაიმერში და რომლით იწყება.</p></div></header>
          <div class="s-card-body s-stack">
            <div class="s-field"><span>ტაიმერის ვარიანტები (1–8)</span>
              <div class="s-chips" role="group" aria-label="ტაიმერის ვარიანტები">${options.map((n) => `<label class="s-chip-check"><input type="checkbox" name="timer" value="${n}" ${chosen.has(n) ? 'checked' : ''}><span>${esc(timerLabel(n))}</span></label>`).join('')}</div>
              <small>„მთელი ღამე“ — ხმა არ ჩერდება, სანამ თვითონ არ გამორთავს.</small></div>
            <div class="s-form-grid">
              <label class="s-field"><span>ტაიმერი იწყება</span><select name="defaultTimerMinutes" data-default-timer></select></label>
              <label class="s-field"><span>ჩაქრობა ტაიმერის ბოლოს (წამი)</span><input type="number" name="fadeSeconds" min="0" max="300" step="5" value="${esc(c.fadeSeconds ?? 60)}"><small>0–300. ამ დროში ხმა ნელა ჩუმდება; ხმის „დასასრული“ თუ აქვს, ის უკრავს.</small></label>
            </div>
          </div></section>
        <section class="s-card"><header class="s-card-head"><div><h3>მიქსერი და ხმა</h3><p>რამდენი ხმა ერთად და რა ხმამაღლა იწყება.</p></div></header>
          <div class="s-card-body s-stack">
            <div class="s-form-grid">
              <label class="s-field"><span>ერთად ჩართული ხმები</span><select name="maxLayers">${[1, 2, 3, 4].map((n) => `<option value="${n}" ${Number(c.maxLayers) === n ? 'selected' : ''}>${n === 1 ? 'მხოლოდ ერთი' : `${n}-მდე`}</option>`).join('')}</select></label>
              <label class="s-field"><span>საწყისი ხმამაღლობა: <output data-volume-out>${volume}%</output></span><input type="range" name="defaultVolume" min="10" max="100" step="5" value="${volume}"></label>
            </div>
            <label class="s-switch-row"><span><b>სუნთქვის ვარჯიში</b><small>ძილის წინ სუნთქვის ვარჯიში ჩანს MEDISLEEP-ში.</small></span><input class="s-switch" type="checkbox" role="switch" name="breathing" ${c.breathing !== false ? 'checked' : ''}></label>
          </div></section>
        <section class="s-card"><header class="s-card-head"><div><h3>დილის შეფასება</h3><p>რა ჩანს კითხვაში „რამ იმოქმედა?“ — ამ რიგით. ერთი მაინც მონიშნე.</p></div></header>
          <div class="s-card-body">
            <div class="s-chips" role="group" aria-label="დილის შეფასების ფაქტორები">${Object.entries(FACTORS).map(([k, l]) => `<label class="s-chip-check"><input type="checkbox" name="factor" value="${k}" ${factors.has(k) ? 'checked' : ''}><span>${esc(l)}</span></label>`).join('')}</div>
          </div></section>
        <div class="s-toolbar s-sl-save">
          <p class="s-form-msg" role="alert" data-msg></p>
          <button type="submit" class="btn primary">შენახვა</button>
        </div>
      </form>
    </div>`;
    const form = host.querySelector('[data-sl-config]');
    const msg = form.querySelector('[data-msg]');
    const select = form.querySelector('[data-default-timer]');
    const fillDefault = (wanted) => {
      const picked = [...form.querySelectorAll('[name="timer"]:checked')].map((el) => Number(el.value)).sort((a, b) => (a === 0 ? 1 : b === 0 ? -1 : a - b));
      const keep = picked.includes(wanted) ? wanted : picked[0];
      select.innerHTML = picked.length
        ? picked.map((n) => `<option value="${n}" ${n === keep ? 'selected' : ''}>${esc(timerLabel(n))}</option>`).join('')
        : '<option value="">ჯერ მონიშნე ვარიანტი</option>';
    };
    fillDefault(Number(c.defaultTimerMinutes));
    form.querySelectorAll('[name="timer"]').forEach((el) => el.addEventListener('change', () => fillDefault(Number(select.value))));
    const out = form.querySelector('[data-volume-out]');
    form.defaultVolume.addEventListener('input', () => { out.textContent = `${form.defaultVolume.value}%`; });
    V().setDirty?.(false);
    V().watchDirty?.(form);
    form.onsubmit = async (ev) => {
      ev.preventDefault();
      msg.textContent = '';
      const timerOptions = [...form.querySelectorAll('[name="timer"]:checked')].map((el) => Number(el.value));
      const checkinFactors = Object.keys(FACTORS).filter((k) => form.querySelector(`[name="factor"][value="${k}"]`)?.checked);
      const fade = Number(form.fadeSeconds.value);
      if (!timerOptions.length || timerOptions.length > 8) { msg.textContent = 'ტაიმერს 1-დან 8-მდე ვარიანტი სჭირდება.'; return; }
      if (!Number.isInteger(fade) || fade < 0 || fade > 300) { msg.textContent = 'ჩაქრობა — მთელი რიცხვი 0-დან 300 წამამდე.'; form.fadeSeconds.focus(); return; }
      if (!checkinFactors.length) { msg.textContent = 'დილის შეფასებას ერთი ფაქტორი მაინც სჭირდება.'; return; }
      const config = {
        defaultTimerMinutes: Number(select.value),
        timerOptions: timerOptions.sort((a, b) => (a === 0 ? 1 : b === 0 ? -1 : a - b)),
        fadeSeconds: fade,
        maxLayers: Number(form.maxLayers.value),
        checkinFactors,
        breathing: form.breathing.checked,
        defaultVolume: Math.round(Number(form.defaultVolume.value)) / 100,
      };
      const submit = form.querySelector('[type=submit]');
      submit.disabled = true;
      submit.classList.add('is-loading');
      try {
        const res = await api('/config', { method: 'PUT', body: { config } });
        V().setDirty?.(false);
        toast('პარამეტრები შენახულია — აპში ჩანს მომდევნო გახსნისას', 'ok');
        paintSettings(host, res.config || config);
      } catch (err) {
        msg.textContent = say(err, 'ვერ შეინახა. სცადე ხელახლა.');
        submit.disabled = false;
        submit.classList.remove('is-loading');
      }
    };
  }

  /* ═════════════ page tabs ═════════════ */
  global.renderSleepHost = K.hostTabs({
    tab: 'sleep',
    label: 'MEDISLEEP-ის განყოფილებები',
    panes: [
      ['usage', 'გამოყენება', renderSleepUsage, 'page'],
      ['sounds', 'ხმები', () => renderSounds(), 'legacy'],
      ['tips', 'რჩევები', () => renderTips(), 'legacy'],
      ['settings', 'პარამეტრები', renderSettings, 'legacy'],
    ],
  });
  global.renderSleepUsage = renderSleepUsage;
  global.AdminV4Sleep = { renderSleepUsage, renderSounds, renderTips, renderSettings };
})(window);
