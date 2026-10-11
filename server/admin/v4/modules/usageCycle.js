/**
 * MediCard Admin V4 — #/cycle MEDICYCLE „ვინ იყენებს და როგორ“ (/api/admin/usage/cycle/overview), on the usage kit.
 * Cycle tracking, trying to conceive, pregnancy, perimenopause, postpartum: what the numbers say, the ladder from the
 * automatic profile to regular logging, an ANONYMOUS wall (owner 2026-10-11: „nobody can tell whose period started
 * when“ — no names, contacts, user links, dates or logged values; a running number, the mode, usage-length and
 * last-activity buckets and counts only), the period trend, what fields people use, modes and forecast readiness,
 * Medi's cycle tips, reminders and privacy settings — all as counts.
 */
(function adminV4CycleUsage(global) {
  const K = global.AdminUsage;
  if (!K) return;
  const { esc, fmt, num, pct, share, metric, metrics, card, facts, shares, extras, empty, note, h4, warn } = K;

  K.glyphs({
    mcDrop: '<path d="M12 3.5c3.1 3.7 5.6 7 5.6 10.1a5.6 5.6 0 0 1-11.2 0C6.4 10.5 8.9 7.2 12 3.5z"/>',
    mcHeart: '<path d="M12 19.6s-7.2-4.4-7.2-9.8A4.2 4.2 0 0 1 12 7.4a4.2 4.2 0 0 1 7.2 2.4c0 5.4-7.2 9.8-7.2 9.8z"/>',
    mcSeed: '<circle cx="12" cy="12" r="8.4"/><circle cx="12" cy="12.6" r="3.4"/>',
    mcMoon: '<path d="M19.4 14.6A7.6 7.6 0 1 1 9.4 4.6a6.1 6.1 0 0 0 10 10z"/>',
    mcSprout: '<path d="M12 20.5v-8.2"/><path d="M12 12.3c0-3.6-2.6-6.2-6.2-6.2 0 3.6 2.6 6.2 6.2 6.2z"/><path d="M12 14.4c0-3.1 2.3-5.4 5.4-5.4 0 3.1-2.3 5.4-5.4 5.4z"/>',
  });

  const MODES = {
    TRACK_PERIOD: 'ციკლის თვალყური', TRY_TO_CONCEIVE: 'დაორსულების მცდელობა', PREGNANCY: 'ორსულობა',
    PERIMENOPAUSE: 'პერიმენოპაუზა', POSTPARTUM: 'მშობიარობის შემდეგ',
  };
  const MODE_GLYPH = { TRACK_PERIOD: 'mcDrop', TRY_TO_CONCEIVE: 'mcHeart', PREGNANCY: 'mcSeed', PERIMENOPAUSE: 'mcMoon', POSTPARTUM: 'mcSprout' };
  const LADDER = {
    profile: 'ციკლის პროფილი', started: 'მიუთითა მენსტრუაცია', logged: 'ჩაწერა დღე',
    details: 'დეტალებიც ჩაწერა', multiDay: 'ჩაწერა 2+ დღე', returned: 'დაბრუნდა სხვა დღეს',
  };
  const PARTS = {
    flow: 'მენსტრუაცია ან ლაქები', symptoms: 'სიმპტომი ან ტკივილი', mood: 'განწყობა', sex: 'სექსი და ლიბიდო',
    lifestyle: 'ძილი, სტრესი, ვარჯიში', signs: 'ტემპერატურა, გამონადენი, ტესტები', notes: 'შენიშვნა', tags: 'საკუთარი ნიშანი',
    other: 'სხვა (ენერგია და სხვ.)', pregnancy: 'ორსულობის დღიური',
  };
  const LOG_SOURCES = { quick: 'სწრაფი ჩანაწერი', full: 'სრული ჩანაწერი', home: 'მთავარი გვერდი', day_sheet: 'დღის ფანჯარა', other: 'სხვა' };
  const START_SOURCES = { hero: 'ციკლის გვერდის ღილაკი', home: 'მთავარი გვერდი', strip: 'კვირის ზოლი', day_sheet: 'დღის ფანჯარა', widget: 'ვიჯეტი', other: 'სხვა' };
  const EXPLAIN = {
    ring: 'ციკლის რგოლი', fertile: 'ნაყოფიერი დღეები', stats: 'ჩემი ციკლი', deviation: 'გადახრები',
    learn_more: '„გაიგე მეტი“', ttc_signal: 'დაორსულების ნიშნები', tracking: 'თვალყურის რეჟიმი', other: 'სხვა',
  };
  const SINCE_USE = { week: 'იყენებს ამ კვირიდან', twoWeeks: 'იყენებს 1–2 კვირაა', month: 'იყენებს 2–4 კვირაა', quarter: 'იყენებს 1–3 თვეა', older: 'იყენებს 3 თვეზე მეტია' };
  const SINCE_PROFILE = { week: 'პროფილი ამ კვირისაა', twoWeeks: 'პროფილი 1–2 კვირისაა', month: 'პროფილი 2–4 კვირისაა', quarter: 'პროფილი 1–3 თვისაა', older: 'პროფილი 3 თვეზე ძველია' };
  const LAST = { week: 'ბოლოს: ამ კვირაში', month: 'ბოლოს: ამ თვეში', earlier: 'ბოლოს: უფრო ადრე', never: 'ჯერ არაფერი გაუკეთებია' };
  const TRACK = ['დაწყება', 'ჩანაწერი', 'დეტალები', 'Medi', 'დაბრუნება'];

  const depthFill = (n) => (n >= 10 ? 100 : n >= 4 ? 75 : n >= 2 ? 50 : n === 1 ? 25 : 0);
  const returnFill = (n) => (n >= 2 ? Math.min(100, n * 20) : 0);
  const sec = (ms) => (ms == null ? '—' : `${num(ms / 1000)} წმ`);
  const sinceText = (s) => (s?.kind === 'use' ? SINCE_USE[s.bucket] : SINCE_PROFILE[s?.bucket]) || '';
  const sourceShares = (obj, names, total) => shares(Object.entries(obj || {}).sort((a, b) => b[1] - a[1]).map(([k, n]) => [names[k] || 'სხვა', n]), total);

  function personCard(it) {
    const parts = [
      it.days && `${fmt(it.days)} დღე ჩაწერა`,
      it.detailDays && `${fmt(it.detailDays)} დეტალით`,
      it.tips && `Medi ${fmt(it.tips)}`,
    ].filter(Boolean);
    const idle = !parts.length;
    return K.itemCard({
      glyph: MODE_GLYPH[it.mode] || 'mcDrop',
      title: it.mark,
      meta: MODES[it.mode] || MODES.TRACK_PERIOD,
      badges: it.team ? '<span class="s-badge is-info">გუნდი</span>' : '',
      track: K.track([
        { fill: it.started ? 100 : 0, title: it.started ? 'ბოლო მენსტრუაცია მითითებულია' : 'ბოლო მენსტრუაცია არ მიუთითებია' },
        { fill: depthFill(it.days), title: `კალენდარში ჩაწერილი დღე: ${fmt(it.days)}` },
        { fill: depthFill(it.detailDays), title: `დღე, სადაც მენსტრუაციის გარდა სხვა ველიც შეავსო: ${fmt(it.detailDays)}` },
        { fill: it.tips >= 2 ? 100 : it.tips ? 50 : 0, title: `Medi-ს რჩევა ციკლის გვერდზე: ${fmt(it.tips)}` },
        { fill: returnFill(it.activeDays), title: `აქტიური დღე MEDICYCLE-ში: ${fmt(it.activeDays)}` },
      ]),
      line: idle ? (it.started ? 'მიუთითა ბოლო მენსტრუაცია — მეტი არაფერი' : 'მხოლოდ პროფილი — ჯერ არაფერი') : parts.join(' · '),
      idle,
      personText: esc(sinceText(it.since)),
      foot: [LAST[it.last] || '', it.activeDays ? `${fmt(it.activeDays)} აქტიური დღე` : ''],
    });
  }

  const wall = K.createWall({
    title: 'ვინ როგორ იყენებს — ანონიმურად',
    sub: 'თითო ბარათი ერთი ქალია — სახელის, კონტაქტის და თარიღების გარეშე, ვინ რომელია, აქედან ვერ გაიგებ. ზოლი: მიუთითა თუ არა მენსტრუაცია, რამდენი დღე ჩაწერა, რამდენ დღეს შეავსო სხვა ველიც (რომელი — არ ჩანს), Medi-ს რჩევები და რამდენ დღეს დაბრუნდა. რიგი: ბოლო აქტივობა (კვირა / თვე), მერე ჩანაწერების რაოდენობა.',
    legendLabels: TRACK,
    filters: [
      ['all', 'ყველა', () => true],
      ['idle', 'მხოლოდ პროფილი', (it) => !it.days],
      ['logging', 'იწერს', (it) => it.days > 0],
      ['returning', 'ბრუნდება', (it) => it.activeDays >= 2],
      ['week', 'ამ კვირაში', (it) => it.last === 'week'],
    ],
    search: (it) => `${it.mark} ${MODES[it.mode] || ''}`,
    placeholder: 'ნომერი ან რეჟიმი',
    render: personCard,
    emptyText: {
      all: 'ციკლის პროფილი ჯერ არავის აქვს.', idle: 'ყველამ ჩაწერა ერთი დღე მაინც.', logging: 'კალენდარში ჯერ არავის არაფერი ჩაუწერია.',
      returning: 'სხვა დღეს ჯერ არავინ დაბრუნებულა.', week: 'ამ კვირაში MEDICYCLE-ში არავის არაფერი გაუკეთებია.',
    },
  });

  function insights(d) {
    const t = d.totals;
    const L = Object.fromEntries(d.ladder.map((s) => [s.key, s.count]));
    const rows = [];
    if (!t.profiles) {
      rows.push(['info', `ციკლის პროფილი ჯერ არცერთ ${d.includeTeam ? '' : 'რეალურ '}ქალს არ აქვს.`]);
    } else if (!t.loggers) {
      rows.push(['warn', `ციკლის პროფილი <b>${fmt(t.profiles)} ქალს</b> აქვს (ავტომატურად), მაგრამ კალენდარში ჯერ არავის არაფერი ჩაუწერია.`]);
    } else {
      rows.push(['info', `<b>${fmt(t.loggers)} ქალმა</b> ჩაწერა ერთი დღე მაინც — ${fmt(t.profiles)} ციკლის პროფილის ${pct(t.loggerRate)}. პროფილი ყველა ქალს ავტომატურად ექმნება, ამიტომ თავად ის გამოყენებას არ ნიშნავს.`]);
      if (t.goalCycle) {
        const r = share(t.goalCycleLogged, t.goalCycle);
        rows.push([r < 50 ? 'warn' : 'info', `ონბორდინგში ${fmt(t.goalCycle)}-მა მთავარ მიზნად ციკლი აირჩია; მათგან დღე <b>${fmt(t.goalCycleLogged)}-მა (${pct(r)})</b> ჩაწერა.`]);
      }
      if (t.onlyProfile) {
        const p = share(t.onlyProfile, t.profiles);
        rows.push([p >= 50 ? 'warn' : 'info', `<b>${fmt(t.onlyProfile)} ქალს (${pct(p)})</b> კალენდარში ჯერ არაფერი ჩაუწერია${t.startedOnly ? ` — ${fmt(t.startedOnly)} მათგანმა ბოლო მენსტრუაცია მიუთითა და იქ გაჩერდა` : ''}.`]);
      }
      const one = d.logging.perPerson.one;
      const oneShare = share(one, t.loggers);
      rows.push([oneShare >= 50 ? 'warn' : 'ok', `ჩამწერთა ${pct(oneShare)}-მა (${fmt(one)}) მხოლოდ ერთი დღე ჩაწერა; 2+ დღე — <b>${fmt(L.multiDay)}</b>, MEDICYCLE-ში სხვა დღეს დაბრუნდა <b>${fmt(L.returned)}</b>.`]);
    }
    const m = d.medi;
    if (m.ok) {
      const slow = m.avgMs != null && m.avgMs > 10_000;
      rows.push([slow || m.errors ? 'warn' : 'ok', `Medi-ს ციკლის რჩევები <b>${fmt(m.users)} ქალმა</b> ნახა (${fmt(m.ok)} რჩევა).${slow ? ` რჩევის მომზადებას საშუალოდ ${sec(m.avgMs)} სჭირდება (p95 ${sec(m.p95Ms)}) — ნელია.` : ''}${m.errors ? ` ${fmt(m.errors)} ვერ მომზადდა.` : ''}`]);
    }
    const f = d.profile.forecast;
    if (t.loggers && (f.ready || f.learning || f.first)) {
      rows.push(['info', `სრული პროგნოზისთვის (3 დასრულებული ციკლი) საკმარისი ისტორია <b>${fmt(f.ready)} ქალს</b> აქვს; ${fmt(f.learning)} ჯერ სწავლობს, ${fmt(f.first)}-ს ერთი მენსტრუაცია აქვს ჩაწერილი.`]);
    }
    rows.push(K.teamInsight(d, d.team.logs ? `${fmt(d.team.logs)} ჩაწერილი დღე` : ''));
    return K.insights(rows);
  }

  function periodBlock(d, ctx) {
    const p = d.period;
    return `${K.periodTitle(p, ctx.days)}
      ${metrics([
        metric('აქტიური ქალი', fmt(p.active), 'ვინც MEDICYCLE-ში რამე გააკეთა'),
        metric('ჩაწერილი დღე', fmt(p.logs), `${fmt(p.loggers)} ქალისგან · ${fmt(p.newLoggers)} პირველად`),
        metric('Medi-ს რჩევა', fmt(p.tips), `${fmt(p.tipUsers)} ქალს`),
        metric('ახალმა ქალმა დაიწყო', pct(p.signupRate), `${fmt(p.signupsLogged)} / ${fmt(p.signups)} ახალი ანგარიში`),
      ])}
      ${card('დღიური ტრენდი', 'ჩაწერილი დღეები (ითვლება ჩაწერის დღით და არა იმ თარიღით, რომელზეც ჩაწერა), ქალები, ვინც იმ დღეს MEDICYCLE-ში რამე გააკეთა, და Medi-ს რჩევები — თბილისის დღეების მიხედვით.', K.chart([
        { label: 'ჩაწერილი დღე', tone: 'blue', points: p.trend.logs },
        { label: 'აქტიური ქალი', tone: 'teal', points: p.trend.active },
        { label: 'Medi-ს რჩევა', tone: 'violet', points: p.trend.tips },
      ], { label: 'MEDICYCLE დღეების მიხედვით', empty: 'ამ პერიოდში MEDICYCLE-ში არაფერი მომხდარა.' }))}`;
  }

  function loggingCard(d) {
    const t = d.totals;
    const lg = d.logging;
    const p = d.period;
    const title = 'რას იწერენ';
    const sub = 'რამდენმა ქალმა გამოიყენა თითო ველი. რა ჩაწერა — არ ჩანს.';
    if (!t.loggers) return card(title, sub, empty('კალენდარში ჯერ არავის არაფერი ჩაუწერია.'));
    const fields = shares(lg.parts.map((r) => [PARTS[r.key] || 'სხვა', r.people]), t.loggers);
    const sources = p.eventTotals.logSources + p.eventTotals.periodStarts
      ? `${h4(`საიდან ინახავენ · ბოლო ${fmt(p.days)} დღე`)}
        ${p.eventTotals.logSources ? `<p class="p2-note">დღის შენახვა — ${fmt(p.eventTotals.logSources)}</p>${sourceShares(p.events.logSources, LOG_SOURCES, p.eventTotals.logSources)}` : ''}
        ${p.eventTotals.periodStarts ? `<p class="p2-note">„მენსტრუაცია დაიწყო“ — ${fmt(p.eventTotals.periodStarts)}</p>${sourceShares(p.events.periodStarts, START_SOURCES, p.eventTotals.periodStarts)}` : ''}
        ${note('ეს მოვლენები ანონიმურია: მხოლოდ ადგილი და დღე ინახება, მომხმარებლის გარეშე — ამიტომ გუნდსაც მოიცავს და ადამიანებად არ ითვლება.')}`
      : '';
    return card(title, sub, `
      <h4 class="p2-h">რამდენი დღე ჩაწერა ერთმა</h4>
      ${shares([['1 დღე', lg.perPerson.one], ['2–3 დღე', lg.perPerson.few], ['4–9 დღე', lg.perPerson.several], ['10 და მეტი', lg.perPerson.many]], t.loggers)}
      ${note(`მედიანა: ${fmt(t.medianDays)} დღე · სულ ${fmt(t.logs)} ჩაწერილი დღე ${fmt(t.loggers)} ქალისგან.`)}
      ${h4('რომელ ველებს ავსებენ')}
      ${fields || empty('ველები ჯერ არავის შეუვსია.')}
      ${note(`% — ჩამწერი ქალებიდან (${fmt(t.loggers)}). ერთ დღეს შეიძლება რამდენიმე ველი ჰქონდეს.`)}
      ${sources}`);
  }

  function profileCard(d) {
    const t = d.totals;
    const pr = d.profile;
    const f = pr.forecast;
    if (!t.profiles) return card('რეჟიმები და პროფილი', '', empty('ციკლის პროფილი ჯერ არავის აქვს.'));
    const c = pr.contraception;
    const episodes = pr.pregnancy.total + pr.postpartum.total;
    return card('რეჟიმები და პროფილი', `რა რეჟიმშია პროფილი და რამდენად არის მორგებული — ${fmt(t.profiles)} პროფილიდან, მხოლოდ რაოდენობები.`, `
      <h4 class="p2-h">რეჟიმი ახლა</h4>
      ${shares(Object.entries(pr.modes).map(([k, n]) => [MODES[k] || 'სხვა', n]), t.profiles)}
      ${h4('პროფილის მორგება')}
      ${facts([
        ['ბოლო მენსტრუაცია მითითებული', `${fmt(pr.lastPeriod)} <small class="s-muted">· ${pct(share(pr.lastPeriod, t.profiles))}</small>`],
        ['ციკლის ან მენსტრუაციის ხანგრძლივობა შეცვალა', fmt(pr.customLengths)],
        ['არარეგულარული ციკლი მონიშნა', fmt(pr.irregular)],
        ['კონტრაცეფციაზე უპასუხა', `${fmt(c.answered)}${extras([['არ იყენებს', c.none], ['მეთოდი მიუთითა', c.method]])}`],
        ['მდგომარეობა მიუთითა (PCOS და სხვ.)', fmt(pr.conditions)],
        episodes ? ['ორსულობის რეჟიმი ჩართო', `${fmt(pr.pregnancy.people)}${extras([['ახლა', pr.pregnancy.active]])}`] : null,
        episodes ? ['მშობიარობის შემდგომი რეჟიმი', `${fmt(pr.postpartum.people)}${extras([['ახლა', pr.postpartum.active]])}`] : null,
      ])}
      ${h4('პროგნოზის მზადყოფნა')}
      ${shares([
        ['3+ ციკლი — სრული პროგნოზი', f.ready],
        ['1–2 ციკლი — სწავლობს', f.learning],
        ['ერთი მენსტრუაცია ჩაწერა', f.first],
        ['მენსტრუაცია არ ჩაუწერია', f.none],
      ], t.profiles)}
      ${note('ნაყოფიერი დღეები და ოვულაცია ჩანს მხოლოდ 3 დასრულებული, ჩაწერილი ციკლის შემდეგ (დაორსულების მცდელობისას — ფართო ფანჯარა). ითვლება ჩაწერილი მენსტრუაციებით; დამალული ციკლები და მშობიარობის შემდგომი ჩანაწერები არ ითვლება.')}`);
  }

  function mediCard(d) {
    const m = d.medi;
    const p = d.period;
    const title = 'Medi-ს რჩევები და განმარტებები';
    const sub = 'ციკლის გვერდის AI ბარათები: რამდენმა ნახა, რამდენ ხანს ელოდება და რა ჯდება. ტექსტი აქ არ ჩანს.';
    const explain = p.eventTotals.explain
      ? `${h4(`რა განმარტებას ხსნიან · ბოლო ${fmt(p.days)} დღე`)}${sourceShares(p.events.explain, EXPLAIN, p.eventTotals.explain)}${note('ანონიმური მოვლენები: მხოლოდ თემა და დღე, მომხმარებლის გარეშე (გუნდსაც მოიცავს).')}`
      : '';
    const body = !m.tips
      ? empty(d.includeTeam ? 'Medi-ს ციკლის რჩევა ჯერ არავის მიუღია.' : 'Medi-ს ციკლის რჩევა ჯერ არცერთ რეალურ მომხმარებელს არ მიუღია.')
      : `${facts([
        ['ქალი', `${fmt(m.users)} <small class="s-muted">· საშუალოდ ${m.perUser == null ? '—' : num(m.perUser)} რჩევა ერთზე</small>`],
        ['რჩევა', `${fmt(m.ok)}${m.errors ? ` <small class="s-muted">· ვერ მომზადდა ${warn(m.errors)}</small>` : ''}`],
        ['მომზადების დრო', `${sec(m.avgMs)} <small class="s-muted">· p95 ${sec(m.p95Ms)}</small>`],
        ['ხარჯი', `$${num(m.costUsd, 2)}`],
        ['შეფასება', `${fmt(m.feedback.up)} სასარგებლო · ${fmt(m.feedback.down)} არა`],
      ])}
      ${note('რჩევა მზადდება, როცა ციკლის გვერდს ხსნის (AI-ზე თანხმობით), არაუმეტეს 18 საათში ერთხელ — ამიტომ ეს რიცხვი გვერდის გახსნასაც აჩვენებს.')}`;
    return card(title, sub, `${body}${explain}`);
  }

  function settingsCard(d) {
    const s = d.settings;
    const r = s.reminders;
    const privacyAny = s.privacyLock + s.share.owners + s.hiddenCycles + s.noBleeding + s.fertilityOff + s.tags + s.temperatureImport;
    const reminders = r.saved
      ? facts([
        ['შეხსენების პარამეტრი შეცვალა', fmt(r.saved)],
        ['შეხსენებები გამორთო', r.off ? warn(r.off) : '0'],
        ['ოვულაციის შეხსენება ჩართო', fmt(r.ovulation)],
        ['ყოველდღიური ჩანაწერის შეხსენება', fmt(r.dailyLog)],
        ['PMS-ის შეხსენება', fmt(r.pms)],
        ['ტესტის ან ტემპერატურის შეხსენება', fmt(r.opk + r.bbt)],
      ])
      : '<p class="p2-note">შეხსენების პარამეტრი ჯერ არავის შეუცვლია — ყველას ნაგულისხმევი აქვს (მენსტრუაცია მალე / დღეს / აგვიანებს).</p>';
    const privacy = privacyAny
      ? facts([
        ['ციკლის ჩაკეტვა', fmt(s.privacyLock)],
        ['პარტნიორის ბმული', `${fmt(s.share.active)} აქტიური${extras([['შექმნა', s.share.owners], ['პარტნიორმა მიიღო', s.share.accepted]])}`],
        ['ციკლი საშუალოდან დამალა', fmt(s.hiddenCycles)],
        ['მენსტრუაციას არ ელის', fmt(s.noBleeding)],
        ['ნაყოფიერი დღეები დამალა', fmt(s.fertilityOff)],
        ['საკუთარი ნიშანი შექმნა', fmt(s.tags)],
        ['ტემპერატურა Health-იდან', fmt(s.temperatureImport)],
      ])
      : '<p class="p2-note">ჩაკეტვა, პარტნიორის ბმული, დამალული ციკლი, საკუთარი ნიშანი და Health-ის ტემპერატურა ჯერ არავის ჩაურთავს.</p>';
    return card('შეხსენებები და კონფიდენციალობა', 'რა ჩართეს ან შეცვალეს. შეხსენებები ტელეფონზე ლოკალურია და ნაგულისხმევად ჩართულია, ამიტომ სერვერმა მხოლოდ ის იცის, ვინც პარამეტრი შეცვალა.', `
      <h4 class="p2-h">შეხსენებები</h4>${reminders}
      ${h4('კონფიდენციალობა და პარტნიორი')}${privacy}`);
  }

  function paint(d, ctx) {
    const t = d.totals;
    const idleShare = share(t.onlyProfile, t.profiles);
    const L = Object.fromEntries(d.ladder.map((s) => [s.key, s]));
    wall.set(d.items, { total: d.itemsTotal });
    return `${K.flagCallout(d.flags.cycle, '<b>MEDICYCLE შეჩერებულია.</b> ახალი ჩანაწერი ვერ ინახება; ახალ ვერსიაში მოდული იმალება.')}
      ${insights(d)}
      ${metrics([
        metric('იწერს', fmt(t.loggers), `პროფილების ${pct(t.loggerRate)} · ${fmt(t.profiles)}-დან`),
        metric('სხვა დღეს დაბრუნდა', fmt(t.returned), `${pct(L.returned?.rate)} · MEDICYCLE-ში 2+ დღე`),
        metric('მხოლოდ პროფილი', fmt(t.onlyProfile), `${pct(idleShare)} · ჯერ არაფერი ჩაუწერია`, idleShare >= 50 ? 'warn' : ''),
        metric('Medi-ს რჩევა ნახა', fmt(d.medi.users), `${fmt(d.medi.ok)} რჩევა`),
      ])}
      ${card('პროფილიდან რეგულარულ ჩანაწერამდე', 'რამდენმა ქალმა გაიარა თითო ნაბიჯი, მთელი დროის განმავლობაში. „ციკლის პროფილი“ ყველა ქალს ავტომატურად ექმნება; „მიუთითა მენსტრუაცია“ — ბოლო მენსტრუაციის დღე (ონბორდინგში ან პარამეტრებში) ან ჩაწერილი მენსტრუაცია; „დეტალებიც“ — მენსტრუაციის გარდა სხვა ველიც; „2+ დღე“ — კალენდარში ორი სხვადასხვა თარიღი; „დაბრუნდა“ — MEDICYCLE-ში რამე გააკეთა ორ სხვადასხვა დღეს. % — პროფილებიდან.',
        K.ladder(d.ladder, LADDER, { first: 'ყველა ქალი', unit: 'პროფილებიდან', emptyText: 'ციკლის პროფილი ჯერ არავის აქვს.' }))}
      ${wall.html()}
      ${periodBlock(d, ctx)}
      ${K.split(loggingCard(d), profileCard(d))}
      ${K.split(mediCard(d), settingsCard(d))}
      ${K.definitions([
        '<b>MEDICYCLE-ის მომხმარებელი</b> — ქალი, რომელმაც კალენდარში ერთი დღე მაინც ჩაწერა (ციკლის ან ორსულობის დღიური). ციკლის პროფილი ყველა ქალს ავტომატურად ექმნება, როცა აპი შეხსენებების დასაგეგმად ციკლს ჩატვირთავს, ამიტომ პროფილი თავისთავად გამოყენებას არ ნიშნავს. დღე, სადაც მხოლოდ Health-იდან შემოსული ტემპერატურაა, არ ითვლება.',
        '<b>აქტიური დღე</b> — თბილისის დღე, როცა MEDICYCLE-ში რამე გააკეთა: დღე ჩაწერა ან მოგვიანებით შეცვალა, ციკლის გვერდზე Medi-ს რჩევა მიიღო, ორსულობის ან მშობიარობის შემდგომი რეჟიმი დაიწყო ან დაასრულა, პარტნიორის ბმული ან საკუთარი ნიშანი შექმნა. <b>დაბრუნდა სხვა დღეს</b> — ორი ასეთი დღე მაინც. აპის უბრალოდ გახსნა არ ითვლება.',
        '<b>დეტალებიც ჩაწერა</b> — მენსტრუაციის გარდა სხვა ველიც შეავსო (სიმპტომი, განწყობა, სექსი, ძილი, ტემპერატურა, ტესტი, შენიშვნა…). <b>ჩაწერა 2+ დღე</b> — კალენდარში ორი სხვადასხვა თარიღი (წარსული მენსტრუაციების ერთბაშად შეყვანაც ითვლება).',
        '<b>გუნდი</b> — ზუსტად @medicard.ge ელფოსტით შესული ანგარიშები (დემო და თანამშრომლები). ანონიმური მოვლენები („საიდან ინახავენ“, „რა განმარტებას ხსნიან“) მომხმარებლის გარეშე ინახება, ამიტომ გუნდსაც მოიცავს.',
        '<b>კონფიდენციალობა</b> (მფლობელის გადაწყვეტილება: „ვერავინ გაიგოს, ვის როდის დაეწყო“): აქ არ ჩანს სახელი, კონტაქტი, ანგარიშის ბმული, არცერთი თარიღი (მენსტრუაციის, ოვულაციის, ორსულობის) და არცერთი ჩაწერილი მნიშვნელობა — მხოლოდ რაოდენობები. ბარათებზე: რიგითი ნომერი, რეჟიმი, რამდენი ხანია იყენებს და ბოლო აქტივობა კვირის / თვის სიზუსტით. ნომერი რიგს აჩვენებს, ადამიანს არ მიჰყვება.',
      ])}`;
  }

  function after(root) {
    wall.bind(root);
  }

  global.renderCycleUsage = K.page({ tab: 'cycle', path: '/usage/cycle/overview', capability: 'PRODUCT_USAGE_VIEW', paint, after });
})(window);
