/**
 * MediCard Admin V4 — #/nutrition „ანალიზი“ MEDIFOOD (/api/admin/usage/food/overview), on the usage kit (usageKit.js).
 * Who uses the food diary and how: what the numbers say, the ladder from the first record to a seven-day diary,
 * every person as a card with a usage track (diary days, AI, database, plan, fasting, exercise), the period
 * trend, how and when they log, AI estimate quality, the meal plan and the other tools. Counts only — never
 * meal names, calories, macros, photos, notes, weights, body measurements or program targets.
 */
(function adminV4FoodUsage(global) {
  const K = global.AdminUsage;
  if (!K) return;
  const { esc, fmt, num, pct, share, when, metric, metrics, card, facts, shares, extras, empty, note, h4, warn } = K;

  K.glyphs({
    foodCamera: '<path d="M4 8h3l1.6-2.4h6.8L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"/><circle cx="12" cy="13" r="3.5"/>',
    foodSpeak: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/><path d="M7 8h10M7 12h6"/>',
    foodLabel: '<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M8 7h8M8 11h8M8 15h5"/>',
    foodBarcode: '<path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2"/><path d="M7 8v8M10 8v8M13 8v8M17 8v8"/>',
    foodPen: '<path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16v4z"/><path d="m13.5 6.5 4 4"/>',
    foodPlate: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/>',
  });

  /** How a meal was logged (NutritionMeal.source). */
  const SOURCE = {
    photo: 'ფოტო', label: 'ეტიკეტის ფოტო', text: 'აღწერა', voice: 'ხმა', search: 'ძებნა', saved: 'შენახულიდან',
    barcode: 'შტრიხკოდი', manual: 'ხელით', plan: 'რაციონიდან „ვჭამე“',
  };
  const SOURCE_SHORT = { ...SOURCE, label: 'ეტიკეტი', plan: 'რაციონიდან' };
  const BY = {
    photo: 'ფოტოთი', label: 'ეტიკეტით', text: 'აღწერით', voice: 'ხმით', search: 'ძებნით', saved: 'შენახულიდან',
    barcode: 'შტრიხკოდით', manual: 'ხელით', plan: 'რაციონიდან',
  };
  const GLYPH = { photo: 'foodCamera', label: 'foodLabel', text: 'foodSpeak', voice: 'foodSpeak', search: 'search', saved: 'search', barcode: 'foodBarcode', manual: 'foodPen', plan: 'foodPlate' };
  const METHOD_ORDER = ['photo', 'label', 'text', 'voice', 'search', 'saved', 'barcode', 'manual', 'plan'];
  const MEAL_TYPES = { breakfast: 'საუზმე', lunch: 'სადილი', dinner: 'ვახშამი', snack: 'წახემსება' };
  const DAY_BUCKETS = { d1: '1 დღე', d2_3: '2–3 დღე', d4_6: '4–6 დღე', d7_13: '7–13 დღე', d14: '14 დღე და მეტი' };
  const GOALS = { lose: 'კლება', maintain: 'შენარჩუნება', gain: 'მატება' };
  const PACES = { gentle: 'რბილი', steady: 'სტაბილური' };
  const DIETS = { balanced: 'მრავალფეროვანი', vegetarian: 'ვეგეტარიანული', vegan: 'ვეგანური' };
  const LEVELS = { sedentary: 'უმოძრაო', light: 'მსუბუქი', moderate: 'საშუალო', active: 'აქტიური' };
  const ACTIVITY = {
    walk: 'სიარული', run: 'სირბილი', cycle: 'ველოსიპედი', strength: 'ძალოვანი', swim: 'ცურვა', yoga: 'იოგა / სტრეჩინგი',
    hiit: 'HIIT', sport: 'სპორტული თამაში', dance: 'ცეკვა', other: 'სხვა',
  };
  const PROTOCOLS = { '12:12': '12:12', '14:10': '14:10', '16:8': '16:8', '18:6': '18:6', '20:4': '20:4', custom: 'საკუთარი' };
  const LADDER = {
    users: 'გამოიყენა MEDIFOOD', logged: 'ჩაწერა კვება', ai: 'ჩაწერა AI-ით',
    returned: 'დაბრუნდა სხვა დღეს', plan: 'შეადგინა რაციონი', habit: '7+ დღე დღიურში',
  };
  const TRACK = ['დღიური', 'AI', 'ბაზა', 'რაციონი', 'მარხვა', 'ვარჯიში'];
  const HABIT_DAYS = 7;

  const joinCounts = (obj, names) => Object.entries(obj || {}).filter(([, n]) => n > 0).map(([k, n]) => `${names[k] || 'სხვა'} ${fmt(n)}`).join(' · ');
  const sec = (msValue) => (msValue == null ? '—' : `${num(msValue / 1000)} წმ`);
  const small = (html) => ` <small class="s-muted">· ${html}</small>`;
  const callout = (html) => `<div class="s-callout is-warn">${K.ico('alert')}<p>${html}</p></div>`;
  const dbCount = (p) => p.methods.search + p.methods.saved + p.methods.barcode;
  const hasPlan = (p) => Boolean(p.program) || p.planned > 0;
  const topMethod = (p) => METHOD_ORDER.reduce((best, k) => (p.methods[k] > p.methods[best] ? k : best), METHOD_ORDER[0]);
  const quietFor = (p, generatedAt) => (p.lastAt && generatedAt ? (Date.parse(generatedAt) - Date.parse(p.lastAt)) / 86_400_000 : 0);

  function personCard(p, generatedAt) {
    const top = p.meals ? topMethod(p) : null;
    const seg = (on, title) => ({ fill: on ? 100 : 0, title });
    const planFill = p.program === 'active' ? 100 : hasPlan(p) ? 50 : 0;
    const planTitle = p.program === 'active' ? 'რაციონი მოქმედია' : p.program === 'paused' ? 'რაციონი შეჩერებულია' : p.planned ? 'დაგეგმილი კერძები აქვს' : 'რაციონი არ აქვს';
    const methods = METHOD_ORDER.filter((k) => p.methods[k] > 0).map((k) => `${SOURCE_SHORT[k]} ${fmt(p.methods[k])}`);
    const extra = [
      p.program === 'active' ? 'რაციონი' : p.program === 'paused' ? 'რაციონი შეჩერებულია' : '',
      p.fasting.fasts ? `მარხვა ${fmt(p.fasting.fasts)}` : p.fasting.screened ? 'მარხვის კითხვარი' : '',
      p.activities ? `ვარჯიში ${fmt(p.activities)}` : '',
      p.foods ? `შენახული საკვები ${fmt(p.foods)}` : '',
    ].filter(Boolean);
    const habit = p.days >= HABIT_DAYS;
    return K.itemCard({
      glyph: top ? GLYPH[top] || 'foodPlate' : 'foodPlate',
      title: p.meals ? `${fmt(p.meals)} ჩანაწერი · ${fmt(p.days)} დღე` : 'კვება ჯერ არ ჩაუწერია',
      meta: p.meals ? [`ძირითადად ${BY[top] || 'ხელით'}`, p.weekLogged ? 'ამ კვირაშიც წერს' : ''].filter(Boolean).join(' · ') : 'MEDIFOOD-ის სხვა ხელსაწყო გამოიყენა',
      badges: `${habit ? '<span class="s-badge is-ok">7+ დღე</span>' : ''}${p.person.team ? '<span class="s-badge is-info">გუნდი</span>' : ''}`,
      track: K.track([
        { fill: Math.round((Math.min(p.days, HABIT_DAYS) / HABIT_DAYS) * 100), title: `დღიური: ${fmt(p.days)} დღე (${HABIT_DAYS} დღე = სავსე)` },
        seg(p.ai, `AI-ით ჩაწერა (ფოტო, ეტიკეტი, აღწერა, ხმა): ${fmt(p.ai)}`),
        seg(dbCount(p) || p.foods, `ძებნა, შენახული საკვები, შტრიხკოდი: ${fmt(dbCount(p))}${p.foods ? ` · შენახული საკვები ${fmt(p.foods)}` : ''}`),
        { fill: planFill, title: `${planTitle}${p.planEaten ? ` · „ვჭამე“ ${fmt(p.planEaten)}` : ''}` },
        { fill: p.fasting.fasts ? 100 : p.fasting.screened ? 35 : 0, title: p.fasting.fasts ? `მარხვა: ${fmt(p.fasting.fasts)}` : p.fasting.screened ? 'მარხვის კითხვარი გაიარა, მარხვა არ დაუწყია' : 'მარხვა არ გამოუყენებია' },
        seg(p.activities, `ვარჯიშის ჩანაწერი: ${fmt(p.activities)}`),
      ]),
      line: [...(p.meals ? methods : ['კვება ჯერ არ ჩაუწერია']), ...extra].join(' · '),
      idle: !p.meals,
      person: p.person,
      foot: [
        p.lastMealAt ? `ბოლოს ჩაწერა ${when(p.lastMealAt)}` : `ბოლოს MEDIFOOD-ში ${when(p.lastAt)}`,
        p.person.lastSeenAt ? `აპში ${when(p.person.lastSeenAt)}` : 'აპში ჯერ არ ჩანს',
      ],
      dim: quietFor(p, generatedAt) > 14,
    });
  }

  let generatedAt = '';
  const wall = K.createWall({
    title: 'ადამიანები და როგორ წერენ',
    sub: 'თითო ბარათი ერთი ადამიანია. ზოლი აჩვენებს, რა გამოიყენა: „დღიური“ ივსება 7 დღემდე, დანარჩენი ანთებულია, თუ გამოიყენა. ახალი აქტივობა პირველია; 14 დღეზე მეტი ხნის უმოქმედო — ფერმკრთალი. კერძები, კალორიები და წონა აქ არ ჩანს.',
    legendLabels: TRACK,
    filters: [
      ['all', 'ყველა', () => true],
      ['once', 'ერთი დღე', (p) => p.meals > 0 && p.days === 1],
      ['back', '2+ დღე', (p) => p.days >= 2],
      ['week', 'ამ კვირაში', (p) => p.weekLogged],
      ['plan', 'რაციონი', hasPlan],
      ['none', 'კვების გარეშე', (p) => !p.meals],
    ],
    search: (p) => `${p.person.name} ${p.person.contact}`,
    placeholder: 'სახელი, ტელეფონი ან ელფოსტა',
    render: (p) => personCard(p, generatedAt),
    emptyText: {
      all: 'MEDIFOOD ჯერ არავის გამოუყენებია.', once: 'ერთ დღეს გაჩერებული არავინაა.', back: 'კვება ორ სხვადასხვა დღეს ჯერ არავის ჩაუწერია.',
      week: 'ბოლო 7 დღეში კვება არავის ჩაუწერია.', plan: 'რაციონი ჯერ არავის შეუდგენია.', none: 'ყველამ ჩაწერა კვება.',
    },
  });

  function insights(d) {
    const t = d.totals;
    const L = Object.fromEntries(d.ladder.map((s) => [s.key, s.count]));
    const src = d.logging.sources;
    const s = d.ai.scans;
    const prog = d.program;
    const fast = d.tools.fasting;
    const rows = [];
    if (!t.users) {
      rows.push(['info', `MEDIFOOD-ში ჯერ არცერთ ${d.includeTeam ? '' : 'რეალურ '}მომხმარებელს არაფერი ჩაუწერია.`]);
    } else {
      const fm = d.firstMeal || {};
      rows.push(['info', `<b>${fmt(t.loggers)} ადამიანს</b> ჩაწერილი აქვს კვება — ${fmt(t.accounts)} ანგარიშის ${pct(t.loggerRate)}.${fm.sameDay ? ` ${fmt(fm.sameDay)} მათგანმა რეგისტრაციის დღესვე დაიწყო.` : ''}`]);
      if (t.onlyOnce) {
        const p = share(t.onlyOnce, t.loggers);
        const again = t.loggers - t.onlyOnce;
        rows.push([p >= 50 ? 'warn' : 'info', `<b>${fmt(t.onlyOnce)} ადამიანმა (${pct(p)})</b> კვება მხოლოდ ერთ დღეს ჩაწერა.${t.appReturned > again ? ` პირველი ჩანაწერის შემდეგ აპი სხვა დღეს ${fmt(t.appReturned)}-მა გახსნა, კვება კი ხელახლა ${fmt(again)}-მა ჩაწერა.` : ''}`]);
      }
      if (t.loggers) {
        rows.push([L.habit ? 'ok' : 'info', L.habit
          ? `<b>${fmt(L.habit)} ადამიანმა</b> 7 დღე ან მეტი ჩაწერა კვება. ბოლო 7 დღეში წერს ${fmt(t.weekLoggers)}.`
          : `7 დღე კვება ჯერ არავის ჩაუწერია — ყველაზე მეტი ${fmt(t.maxDays)} დღეა. ბოლო 7 დღეში წერს ${fmt(t.weekLoggers)}.`]);
      }
      if (t.meals) {
        // One sentence for AI: how much of the diary it makes, and whether it is slow or failing.
        const slow = s.total && (s.failRate >= 10 || s.p95Ms > 30000);
        const quality = s.total ? ` შეფასება ${pct(s.failRate)} შემთხვევაში ვერ სრულდება, საშუალოდ ${esc(sec(s.avgMs))} სჭირდება${slow ? `, ყველაზე ნელ 5%-ს — ${esc(sec(s.p95Ms))}-ზე მეტი` : ''}.` : '';
        rows.push([slow ? 'warn' : t.aiShare >= 50 ? 'ok' : 'info', `<b>ჩანაწერების ${pct(t.aiShare)}</b> AI-ით კეთდება — ფოტოთი ${fmt(src.photo)}, აღწერით ან ხმით ${fmt(src.text + src.voice)}${src.label ? `, ეტიკეტით ${fmt(src.label)}` : ''}; ძებნით, შენახულიდან და შტრიხკოდით — ${fmt(d.logging.dbMeals)}.${quality}`]);
      }
      if (prog.users) {
        const eatenShare = share(prog.eaten, prog.plannedMeals);
        rows.push([prog.plannedMeals && eatenShare < 10 ? 'warn' : 'info', `<b>${fmt(prog.users)} ადამიანმა</b> შეადგინა რაციონი (${esc(joinCounts(prog.goals, GOALS) || 'მიზანი შეჩერებულია')}); ${fmt(prog.plannedMeals)} დაგეგმილი კერძიდან „ვჭამე“ მონიშნულია ${fmt(prog.eaten)}${prog.eatenUsers ? ` (${fmt(prog.eatenUsers)} ადამიანი)` : ''}.`]);
      }
      if (fast.fasts) rows.push(['ok', `მარხვის ტაიმერი ${fmt(fast.users)} ადამიანმა გამოიყენა — ${fmt(fast.fasts)} მარხვა, მიზნამდე ${fmt(fast.reachedGoal)}.`]);
      else if (fast.screened) rows.push(['warn', `მარხვის კითხვარი ${fmt(fast.screened)} ადამიანმა გაიარა, მაგრამ ტაიმერი ჯერ არავის ჩაურთავს.`]);
    }
    return K.insights([...rows.slice(0, 6), K.teamInsight(d, `${fmt(d.team.meals)} კვების ჩანაწერი`)]);
  }

  function periodBlock(d, ctx) {
    const p = d.period;
    return `${K.periodTitle(p, ctx.days)}
      ${metrics([
        metric('კვების ჩანაწერი', fmt(p.meals), `${fmt(p.loggers)} ადამიანისგან · AI-ით ${fmt(p.aiMeals)}`),
        metric('აქტიური ადამიანი', fmt(p.activeUsers), 'ვინც MEDIFOOD-ში რამე ჩაწერა'),
        metric('პირველად ჩაწერა', fmt(p.newLoggers), 'პირველი კვება ამ პერიოდში'),
        metric('ახალმა ანგარიშმა ჩაწერა', pct(p.signupRate), `${fmt(p.signupsLogged)} / ${fmt(p.signups)} ახალი ანგარიში`),
      ])}
      ${card('დღიური ტრენდი', 'კვების ჩანაწერები, ვინც იმ დღეს MEDIFOOD-ში რამე ჩაწერა, და AI-ით ჩაწერილი კვება — თბილისის დღეების მიხედვით, ჩაწერის მომენტით.', K.chart([
        { label: 'კვების ჩანაწერი', tone: 'blue', points: p.trend.meals },
        { label: 'აქტიური ადამიანი', tone: 'teal', points: p.trend.active },
        { label: 'AI-ით ჩაწერილი', tone: 'violet', points: p.trend.ai },
      ], { label: 'MEDIFOOD დღეების მიხედვით', empty: 'ამ პერიოდში MEDIFOOD-ში არაფერი ჩაწერილა.' }))}`;
  }

  function peopleCard(d) {
    const t = d.totals;
    const fm = d.firstMeal || {};
    const title = 'ადამიანები';
    const sub = 'როდის იწყებენ, რამდენ დღეს წერენ და ბრუნდებიან თუ არა.';
    if (!t.users) return card(title, sub, empty('MEDIFOOD ჯერ არავის გამოუყენებია.'));
    const body = t.loggers
      ? `${facts([
        ['კვებას წერს', `${fmt(t.loggers)}${small(`ანგარიშების ${pct(t.loggerRate)}`)}`],
        ['საშუალოდ დღიურის დღე', `${num(t.daysPerLogger)}${small(`ყველაზე მეტი ${fmt(t.maxDays)}`)}`],
        ['ბოლო 7 დღეში წერს', fmt(t.weekLoggers)],
        ['14 დღეზე მეტია არ ჩაუწერია', t.lapsed ? warn(t.lapsed) : '0'],
        ['აპში დაბრუნდა პირველი ჩანაწერის შემდეგ', `${fmt(t.appReturned)}${small(pct(share(t.appReturned, t.loggers)))}`],
        t.noMeals ? ['შევიდა, კვება არ ჩაუწერია', fmt(t.noMeals)] : null,
      ])}
      ${h4('რამდენ დღეს წერენ')}
      ${shares(Object.entries(DAY_BUCKETS).map(([k, label]) => [label, d.logging.daysDist[k]]), t.loggers)}
      ${h4('პირველი ჩანაწერი რეგისტრაციიდან')}
      ${shares([['რეგისტრაციის დღესვე', fm.sameDay], ['პირველ კვირაში', fm.week], ['მოგვიანებით', fm.later]], t.loggers)}
      ${note(`მედიანა: ${esc(K.hoursText(fm.medianHours))} რეგისტრაციიდან. „დღიურის დღე“ — დღე, რომელზეც კვება ჩაწერილია. „აპში დაბრუნდა“ — პირველი ჩანაწერის შემდეგ სხვა დღეს გახსნა აპი (ნებისმიერი გვერდი).`)}`
      : `${empty('კვება ჯერ არავის ჩაუწერია.')}${note(`MEDIFOOD-ის სხვა ხელსაწყო გამოიყენა ${fmt(t.noMeals)} ადამიანმა.`)}`;
    return card(title, sub, body);
  }

  function loggingCard(d) {
    const l = d.logging;
    const t = d.totals;
    const title = 'როგორ წერენ';
    const sub = 'მთელი დროის კვების ჩანაწერები: რა გზით და რომელ კვებას.';
    if (!t.meals) return card(title, sub, empty('კვების ჩანაწერი ჯერ არ არის.'));
    const mc = l.methodCounts;
    return card(title, sub, `
      <h4 class="p2-h">გზა</h4>
      ${shares(METHOD_ORDER.map((k) => [SOURCE[k], l.sources[k]]).sort((a, b) => b[1] - a[1]), t.meals)}
      ${h4('რომელი კვება')}
      ${shares(Object.entries(MEAL_TYPES).map(([k, label]) => [label, l.types[k]]), t.meals)}
      ${h4('დეტალები')}
      ${facts([
        ['ჩანაწერი ერთ დღეში', num(t.mealsPerDay)],
        ['კერძი ერთ ჩანაწერში', num(l.itemsPerMeal)],
        ['შენახვის შემდეგ შეცვალა', fmt(l.edited)],
        ['სხვა დღისთვის ჩაწერა', fmt(l.backdated)],
        ['ერთი / ორი / სამი და მეტი გზა', `${fmt(mc.one)} / ${fmt(mc.two)} / ${fmt(mc.more)}`],
        ['ძირითადი გზა', esc(joinCounts(l.mainMethod, SOURCE_SHORT) || '—')],
      ])}
      ${note('„გზა“ — როგორ დაემატა საკვები. „ერთი / ორი / სამი გზა“ — რამდენი სხვადასხვა გზა გამოიყენა ერთმა ადამიანმა; „ძირითადი გზა“ — რომლითაც ყველაზე ხშირად წერს.')}`);
  }

  function aiCard(d) {
    const a = d.ai;
    const s = a.scans;
    const ps = d.period.scans;
    const w = a.weightAdvice;
    const off = `${K.flagCallout(d.flags.nutritionAi, '<b>კვების AI შეფასება შეჩერებულია.</b> კვება მხოლოდ ხელით და ძებნით ემატება.')}${d.settings.photoEnabled ? '' : callout('<b>AI შეფასება გამორთულია კვების სერვისის პარამეტრებში.</b> კვება მხოლოდ ხელით და ძებნით ემატება.')}`;
    const title = 'AI შეფასება';
    const sub = 'ფოტოს, ეტიკეტის და აღწერის შეფასება: რამდენი, რამდენად სწრაფად და რამდენი ვერ შეფასდა.';
    if (!s.total && !a.meals && !w.total) return card(title, sub, `${off}${empty('AI შეფასება ჯერ არავის გამოუყენებია.')}`);
    const saved = a.savedRate != null && a.savedRate <= 100 ? `${pct(a.savedRate)}${small('მიახლოებით')}` : '—';
    const advice = w.total
      ? `${h4('Medi-ს წონის რჩევა')}${facts([
        ['რჩევა', `${fmt(w.total)}${small(`${fmt(w.users)} ადამიანი`)}`],
        ['შეცდომა', warn(w.errors)],
        ['პასუხის დრო', sec(w.avgMs)],
        ['ხარჯი', `$${num(w.costUsd, 3)}`],
      ])}`
      : '';
    return card(title, sub, `${off}
      ${facts([
        ['AI-ით ჩაწერილი კვება', `${fmt(a.meals)}${small(`${fmt(a.users)} ადამიანი`)}`],
        ['შეფასება სულ', fmt(s.total)],
        ['ვერ შეფასდა', `${warn(s.failed)}${s.total ? small(pct(s.failRate)) : ''}`],
        ['შეფასების დრო', `${sec(s.avgMs)}${small(`ყველაზე ნელი 5% — ${esc(sec(s.p95Ms))}-ზე მეტი`)}`],
        [`ბოლო ${fmt(d.period.days)} დღე`, `${fmt(ps.total)} შეფასება${extras([['ვერ შეფასდა', ps.failed]])}${ps.total ? small(sec(ps.avgMs)) : ''}`],
        ['შეფასებიდან შენახული', saved],
      ])}
      ${a.meals ? `${h4('რით აფასებინებენ')}${shares([['ფოტო', a.bySource.photo], ['ეტიკეტის ფოტო', a.bySource.label], ['აღწერა', a.bySource.text], ['ხმა', a.bySource.voice]], a.meals)}` : ''}
      ${advice}
      ${note('შეფასება ანგარიშს არ ინახავს — მხოლოდ შედეგს (გამოვიდა / ვერ) და ხანგრძლივობას, ამიტომ შეფასების რიცხვები ყველა ანგარიშს ითვლის, გუნდსაც. „შეფასებიდან შენახული“ — AI-ით ჩაწერილი კვება წარმატებულ შეფასებასთან (შესწორებაც ცალკე შეფასებაა). ფოტო არ ინახება.')}`);
  }

  function toolsCard(d) {
    const prog = d.program;
    const tl = d.tools;
    const f = tl.fasting;
    const title = 'რაციონი და ხელსაწყოები';
    const sub = 'კვების გეგმა, მარხვა, ვარჯიში, შენახული საკვები, ზომები და პარამეტრები — რამდენი იყენებს.';
    const planOff = d.settings.programEnabled ? '' : callout('<b>რაციონის შედგენა გამორთულია კვების სერვისის პარამეტრებში.</b>');
    const plan = prog.users
      ? facts([
        ['რაციონი შეადგინა', `${fmt(prog.active)} მოქმედი${extras([['შეჩერებული', prog.paused]])}`],
        ['მიზანი', esc(joinCounts(prog.goals, GOALS) || '—')],
        ['ტემპი', esc(joinCounts(prog.paces, PACES) || '—')],
        ['კვების არჩევანი', esc(joinCounts(prog.diets, DIETS) || '—')],
        ['აქტივობის დონე', esc(joinCounts(prog.levels, LEVELS) || '—')],
        ['დაგეგმილი კერძი', `${fmt(prog.plannedMeals)}${small(`${fmt(prog.planUsers)} ადამიანი`)}`],
        ['მონიშნა „ვჭამე“', `${fmt(prog.eaten)}${small(`${fmt(prog.eatenUsers)} ადამიანი · ${pct(share(prog.eaten, prog.plannedMeals))} დაგეგმილიდან`)}`],
      ])
      : '<p class="p2-note">რაციონი ჯერ არავის შეუდგენია.</p>';
    const fasting = f.fasts
      ? `${facts([
        ['მარხვა დაიწყო', `${fmt(f.users)} ადამიანი${small(`${fmt(f.fasts)} მარხვა`)}`],
        ['დაასრულა', `${fmt(f.completed)}${extras([['მიზნამდე', f.reachedGoal], ['ახლა მიმდინარე', f.running]])}`],
        ['ხანგრძლივობა (მედიანა)', f.medianHours == null ? '—' : `${num(f.medianHours)} სთ`],
        ['კითხვარი გაიარა', fmt(f.screened)],
      ])}${K.chips(Object.entries(f.protocols).map(([k, n]) => [PROTOCOLS[k] || 'საკუთარი', n]))}`
      : `<p class="p2-note">${f.screened ? `მარხვის კითხვარი ${fmt(f.screened)} ადამიანმა გაიარა; მარხვა ჯერ არავის დაუწყია.` : 'მარხვის ტაიმერი ჯერ არავის გაუხსნია.'}</p>`;
    const activity = tl.activity.entries
      ? `${facts([['ჩანაწერი', `${fmt(tl.activity.entries)}${small(`${fmt(tl.activity.users)} ადამიანი`)}`]])}${K.chips(Object.entries(tl.activity.kinds).map(([k, n]) => [ACTIVITY[k] || 'სხვა', n]))}`
      : '<p class="p2-note">ვარჯიში ჯერ არავის ჩაუწერია.</p>';
    const foods = facts([
      ['შენახული საკვები', `${fmt(tl.foods.total)}${extras([['ადამიანი', tl.foods.users], ['რჩეული', tl.foods.favorites], ['რეცეპტი', tl.foods.recipes], ['შტრიხკოდით', tl.foods.withBarcode]])}`],
      ['შტრიხკოდით ნაპოვნი პროდუქტი', `${fmt(tl.products.total)}${tl.products.hits ? small(`${fmt(tl.products.hits)}-ჯერ მოიძებნა`) : ''}`],
    ]);
    const body = facts([
      ['სხეულის ზომები', tl.measurements.entries ? `${fmt(tl.measurements.entries)} ჩანაწერი${small(`${fmt(tl.measurements.users)} ადამიანი`)}` : '0'],
      ['წონის დღე აქვს', `${fmt(tl.weight.users)} ადამიანს${tl.weight.tracked ? small(`ორი და მეტი დღე — ${fmt(tl.weight.tracked)}`) : ''}`],
    ]);
    const pr = tl.prefs;
    const prefs = pr.users
      ? `${h4('პარამეტრები')}${K.chips([
        ['კვების შეხსენება', pr.reminders], ['ნაბიჯები ბიუჯეტში', pr.countSteps], ['დახარჯული ემატება', pr.addBurned],
        ['გადატანა მეორე დღეზე', pr.rollover], ['საკუთარი მაკროები', pr.customMacros],
      ]) || ''}${note(`კვების პარამეტრები შეინახა ${fmt(pr.users)} ადამიანმა; რიცხვი — რამდენს აქვს ჩართული.`)}`
      : '';
    return card(title, sub, `${planOff}<h4 class="p2-h">რაციონი</h4>${plan}
      ${h4('მარხვის ტაიმერი')}${fasting}
      ${h4('ვარჯიში')}${activity}
      ${h4('შენახული საკვები და შტრიხკოდი')}${foods}
      ${h4('ზომები და წონა')}${body}
      ${note('წონის დღე ითვლება მხოლოდ MEDIFOOD-ის მომხმარებლებში და შეიძლება Apple Health / Health Connect-იდანაც მოდიოდეს. შტრიხკოდის პროდუქტები საერთო ცნობარია (ყველა ანგარიში). მნიშვნელობები — წონა, ზომები, სამიზნეები — აქ არ ჩანს.')}
      ${prefs}`);
  }

  function paint(d, ctx) {
    const t = d.totals;
    const onceShare = share(t.onlyOnce, t.loggers);
    generatedAt = d.generatedAt;
    wall.set(d.items, { total: d.itemsTotal });
    return `${K.flagCallout(d.flags.nutrition, '<b>MEDIFOOD (კვების დღიური) შეჩერებულია.</b> ახალი ჩანაწერი ვერ ინახება.')}
      ${insights(d)}
      ${metrics([
        metric('კვებას წერს', fmt(t.loggers), `ანგარიშების ${pct(t.loggerRate)} · ${fmt(t.accounts)}-დან`),
        metric('კვების ჩანაწერი', fmt(t.meals), `${fmt(t.personDays)} დღიურის დღე · დღეში ${num(t.mealsPerDay)}`),
        metric('მხოლოდ ერთი დღე', fmt(t.onlyOnce), `${pct(onceShare)} მწერლებიდან · მეტი არ ჩაუწერია`, onceShare >= 50 ? 'warn' : ''),
        metric('AI-ით ჩაწერა', fmt(t.aiUsers), `ადამიანი · ჩანაწერების ${pct(t.aiShare)}`),
      ])}
      ${card('პირველი ჩანაწერიდან ჩვევამდე', 'რამდენმა ადამიანმა გამოიყენა თითო ნაბიჯი, მთელი დროის განმავლობაში. „გამოიყენა MEDIFOOD“ — ჩაწერა კვება, ვარჯიში ან ზომები, შეადგინა რაციონი, შეინახა საკვები ან გახსნა მარხვა; „AI-ით“ — ფოტოთი, ეტიკეტით, აღწერით ან ხმით; „დაბრუნდა სხვა დღეს“ — MEDIFOOD-ში რამე ჩაწერა ორ სხვადასხვა დღეს; „7+ დღე დღიურში“ — კვება ჩაწერილია 7 სხვადასხვა დღეზე. % ითვლება ყველა მომხმარებლიდან.',
        K.ladder(d.ladder, LADDER, { first: 'ყველა მომხმარებელი', unit: 'მომხმარებლებიდან', emptyText: 'MEDIFOOD ჯერ არავის გამოუყენებია.' }))}
      ${wall.html()}
      ${periodBlock(d, ctx)}
      ${K.split(peopleCard(d), loggingCard(d))}
      ${K.split(aiCard(d), toolsCard(d))}
      ${K.definitions([
        '<b>მომხმარებელი</b> — ანგარიში, რომელსაც MEDIFOOD-ში ერთი ჩანაწერი მაინც აქვს: კვება, რაციონი, ვარჯიში, მარხვა, ზომები, შენახული საკვები ან შენახული კვების პარამეტრები. <b>კვებას წერს</b> — ერთი კვება მაინც ჩაწერა. <b>აქტიური</b> — ვინც პერიოდში ამათგან რამე ჩაწერა ან შეცვალა.',
        '<b>დღიურის დღე</b> — დღე, რომელზეც კვება ჩაწერილია (სხვა დღისთვის ჩაწერილი იმ დღეს ეკუთვნის). <b>დაბრუნდა სხვა დღეს</b> — MEDIFOOD-ში რამე ჩაწერა ორ სხვადასხვა დღეს (თბილისის დროით, ჩაწერის მომენტით). <b>7+ დღე დღიურში</b> — კვება ჩაწერილია 7 სხვადასხვა დღეზე. <b>AI-ით</b> — ჩანაწერი ფოტოს, ეტიკეტის, აღწერის ან ხმის შეფასებიდან (Medi-ს „ჩამიწერე“ ჩათვლით); შეფასება, რომელიც ადამიანმა არ შეინახა, ჩანაწერად არ ითვლება.',
        '<b>AI შეფასების ხარისხი</b> (რამდენი, ვერ შეფასდა, დრო) ითვლება ყველა ანგარიშზე, გუნდის ჩათვლით: შეფასება ანგარიშს არ ინახავს. Medi-ს წონის რჩევა ითვლება ანგარიშის მიხედვით.',
        '<b>გუნდი</b> — ზუსტად @medicard.ge ელფოსტით შესული ანგარიშები (დემო და თანამშრომლები). ტელეფონით და Apple-ით შესულები ჩვეულებრივი მომხმარებლები არიან.',
        'ეკრანების ნახვას აპი ცალკე არ აგზავნის, ამიტომ „გახსნა და არაფერი ჩაწერა“ აქ არ ჩანს. კონფიდენციალობა: აქ არ ჩანს კერძების სახელები, კალორიები, მაკროები, ფოტოები, შენიშვნები, წონა, ზომები, რაციონის სამიზნეები და მარხვის კითხვარის პასუხები — მხოლოდ რაოდენობები.',
      ])}`;
  }

  function after(root) {
    wall.bind(root);
  }

  global.renderFoodUsage = K.page({ tab: 'nutrition', path: '/usage/food/overview', capability: 'PRODUCT_USAGE_VIEW', paint, after });
})(window);
