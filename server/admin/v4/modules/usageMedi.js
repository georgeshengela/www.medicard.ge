/**
 * MediCard Admin V4 — #/ai „ვინ იყენებს და როგორ“ (Medi, /api/admin/usage/medi/overview), on the usage kit (usageKit.js).
 * Who talks to Medi and how: what the numbers say, the ladder from AI consent to coming back, every person as a card
 * with a usage track, the period trend, how the chat is used, AI consent, topics + safety counts, feedback and AI in
 * other modules. Quality, errors, cost and the request log stay in the „ხარისხი და ჟურნალი“ pane (admin.js renderAi).
 * Never shows message text, answers, symptoms or what was saved — only counts.
 */
(function adminV4MediUsage(global) {
  const K = global.AdminUsage;
  if (!K) return;
  const { esc, fmt, num, pct, share, when, metric, metrics, card, facts, shares, extras, empty, note, h4, warn } = K;

  const LADDER = {
    consent: 'მისცა AI-ს თანხმობა', used: 'გამოიყენა Medi', answered: 'მიიღო კლინიკური პასუხი',
    deep: 'კონსილიუმი ან სიმპტომები', saved: 'შეინახა Medi-ით', returned: 'დაბრუნდა სხვა დღეს',
  };
  const TRACK = ['შეტყობინება', 'პასუხი', 'კონსილიუმი', 'სიმპტომები', 'შენახვა', 'დღეები'];
  const CONSENT_BADGE = {
    declined: ['is-warn', 'უარი AI-ზე'], revoked: ['is-warn', 'თანხმობა გაიწვია'],
    old: ['is-plain', 'ძველი თანხმობა'], none: ['is-plain', 'თანხმობის გარეშე'],
  };
  const TOPICS = {
    pain: 'ტკივილი', heart: 'წნევა და გული', digestion: 'კუჭ-ნაწლავი', respiratory: 'სიცხე, გაციება, სუნთქვა',
    skin: 'კანი და თმა', mind: 'ძილი, სტრესი, განწყობა', medication: 'წამლები და ვიტამინები', labs: 'ანალიზები',
    women: 'ქალის ჯანმრთელობა და ციკლი', child: 'ბავშვი', weight: 'კვება და წონა', app: 'აპის თხოვნა (ჩაწერა, შეხსენება)',
    other: 'სხვა თემა',
  };
  const ACTIONS = {
    hydration: 'წყალი', medication: 'წამლები და მიღება', cycle: 'ციკლი და ორსულობა', nutrition: 'კვება და წონის მიზანი',
    metrics: 'მაჩვენებლები და ნაბიჯები', visits: 'ვიზიტები', profile: 'ჯანმრთელობის პროფილი', pets: 'ცხოველები', other: 'სხვა',
  };
  const MODE = { DOCTOR: 'კონსულტაცია', CONSILIUM: 'კონსილიუმი', SYMPTOM_CHECKER: 'სიმპტომები', MEDICATION: 'წამლების შემოწმება' };
  const OTHER = [
    ['cycle', 'MEDICYCLE', '#/cycle', 'ციკლის რჩევები'],
    ['lab', 'MEDILAB', '#/lab', 'ანალიზი, გამოსახულება, კანი'],
    ['food', 'MEDIFOOD', '#/nutrition', 'წონის რჩევა'],
    ['vet', 'MEDIVET', '#/pets', 'ცხოველების AI'],
  ];
  const small = (text) => ` <small class="s-muted">· ${text}</small>`;
  /** Graded fill: n of `full` = a full segment; anything used shows at least a quarter. */
  const grade = (n, full) => (n ? Math.max(25, Math.min(100, Math.round((n / full) * 100))) : 0);

  function personCard(p) {
    const u = p.usage;
    const glyph = u.consilium ? 'layers' : u.symptoms ? 'activity' : u.clinical ? 'message' : u.actions ? 'zap' : 'spark';
    const title = u.messages
      ? `${fmt(u.messages)} შეტყობინება · ${fmt(u.conversations)} საუბარი`
      : u.symptoms ? `სიმპტომები შეამოწმა · ${fmt(u.symptoms)}`
        : u.medication ? 'წამლები გადაამოწმა' : u.actions ? 'Medi-ით შეინახა' : 'Medi-მ ვერ უპასუხა';
    const meta = p.days > 1
      ? `${fmt(p.days)} დღე · ${when(p.firstAt, 'date')} – ${when(p.lastAt, 'date')}`
      : `ერთ დღეს · ${when(p.firstAt, 'date')}`;
    const consent = CONSENT_BADGE[p.consent];
    const parts = [
      u.clinical && `კლინიკური პასუხი ${fmt(u.clinical)}`,
      u.consilium && `კონსილიუმი ${fmt(u.consilium)}`,
      u.symptoms && `სიმპტომები ${fmt(u.symptoms)}`,
      u.medication && `წამლების შემოწმება ${fmt(u.medication)}`,
      u.actions && `შენახული ${fmt(u.actions)}`,
      u.requests && `აპის თხოვნა ${fmt(u.requests)}`,
      u.feedback && `შეფასება ${fmt(u.feedback)}`,
      u.failed && `ვერ უპასუხა ${fmt(u.failed)}`,
    ].filter(Boolean);
    const deep = u.clinical + u.consilium + u.symptoms + u.medication + u.actions;
    return K.itemCard({
      glyph,
      title,
      meta,
      badges: `${consent ? `<span class="s-badge ${consent[0]}">${esc(consent[1])}</span>` : ''}${p.person.team ? '<span class="s-badge is-info">გუნდი</span>' : ''}`,
      track: K.track([
        { fill: grade(u.messages, 10), title: `შეტყობინება: ${fmt(u.messages)} (10 = სავსე)${u.requests ? ` · აპის თხოვნა ${fmt(u.requests)}` : ''}` },
        { fill: grade(u.clinical, 5), title: `კლინიკური პასუხი: ${fmt(u.clinical)} (5 = სავსე)` },
        { fill: u.consilium ? 100 : 0, title: `კონსილიუმი: ${fmt(u.consilium)}` },
        { fill: u.symptoms ? 100 : 0, title: `სიმპტომების შემოწმება: ${fmt(u.symptoms)}` },
        { fill: u.actions ? 100 : 0, title: `Medi-ით შენახული ჩანაწერი: ${fmt(u.actions)}` },
        { fill: p.days >= 2 ? Math.min(100, Math.round((p.days / 5) * 100)) : 0, title: `Medi-სთან ${fmt(p.days)} დღე (5 = სავსე)` },
      ]),
      line: deep ? parts.join(' · ') : (parts.length ? `${parts.join(' · ')} · კლინიკური პასუხი არ მიუღია` : 'კლინიკური პასუხი არ მიუღია'),
      idle: !deep,
      person: p.person,
      foot: [
        p.lastMessageAt ? `ბოლო შეტყობინება ${when(p.lastMessageAt)}` : `ბოლოს ${when(p.lastAt)}`,
        p.person.lastSeenAt ? `აპში ${when(p.person.lastSeenAt)}` : 'აპში ჯერ არ ჩანს',
      ],
    });
  }

  const wall = K.createWall({
    title: 'ვინ ესაუბრება Medi-ს',
    sub: 'თითო ბარათი ერთი ადამიანია. ზოლი აჩვენებს, რა გამოიყენა: შეტყობინებები, კლინიკური პასუხი, კონსილიუმი, სიმპტომები, Medi-ით შენახული ჩანაწერი და რამდენ დღეს მოვიდა. ახალი აქტივობა პირველია.',
    legendLabels: TRACK,
    filters: [
      ['all', 'ყველა', () => true],
      ['once', 'ერთ დღეს', (p) => p.days <= 1],
      ['back', 'ბრუნდება', (p) => p.days >= 2],
      ['deep', 'კონსილიუმი ან სიმპტომები', (p) => p.usage.consilium + p.usage.symptoms > 0],
      ['saved', 'შეინახა Medi-ით', (p) => p.usage.actions > 0],
    ],
    search: (p) => `${p.person.name} ${p.person.contact}`,
    placeholder: 'სახელი, ტელეფონი ან ელფოსტა',
    render: personCard,
    emptyText: {
      all: 'Medi ჯერ არავის გამოუყენებია.', once: 'ყველა, ვინც Medi სცადა, სხვა დღესაც დაბრუნდა.', back: 'სხვა დღეს ჯერ არავინ დაბრუნებულა.',
      deep: 'კონსილიუმი ან სიმპტომების შემოწმება ჯერ არავის გამოუყენებია.', saved: 'Medi-ით ჯერ არავის შეუნახავს ჩანაწერი.',
    },
  });

  function insights(d) {
    const t = d.totals;
    const c = d.consent;
    const rows = [];
    if (!t.users) {
      rows.push(['info', `Medi ჯერ არცერთ ${d.includeTeam ? '' : 'რეალურ '}მომხმარებელს არ გამოუყენებია.${c.accepted ? ` AI-ს თანხმობა ${fmt(c.accepted)} ადამიანს აქვს მიცემული.` : ''}`]);
    } else {
      const fu = d.usage.firstUse || {};
      rows.push(['info', `<b>${fmt(t.users)} ადამიანმა</b> გამოიყენა Medi — ${fmt(t.accounts)} ანგარიშის ${pct(t.userRate)}.${fu.sameDay ? ` ${fmt(fu.sameDay)} მათგანმა რეგისტრაციის დღესვე სცადა.` : ''}`]);
      if (c.acceptedNotUsed) {
        const p = share(c.acceptedNotUsed, c.accepted);
        rows.push([p >= 50 ? 'warn' : 'info', `<b>${fmt(c.acceptedNotUsed)} ადამიანმა (${pct(p)})</b> AI-ს თანხმობა მისცა, მაგრამ Medi-სთვის ჯერ არაფერი უკითხავს.`]);
      }
      const once = share(t.oneDay, t.users);
      rows.push([once >= 50 ? 'warn' : 'info', `<b>${fmt(t.oneDay)} ადამიანმა (${pct(once)})</b> Medi მხოლოდ ერთ დღეს გამოიყენა; სხვა დღეს დაბრუნდა ${fmt(t.returned)}.`]);
      if (t.clinical + t.consilium) {
        rows.push(['ok', `შეტყობინებების ${pct(share(t.healthQuestions, t.messages))} ჯანმრთელობის კითხვაა: <b>${fmt(t.clinical + t.consilium)} კლინიკური პასუხი</b> ${fmt(t.clinicalUsers)} ადამიანს.${t.actionUsers ? ` ${fmt(t.actionUsers)}-მა Medi-ით ჩანაწერიც შეინახა (${fmt(t.actions)}).` : ''}`]);
      }
      const fb = d.feedback;
      if (!fb.up && !fb.down) rows.push(['warn', `Medi-ს პასუხი ჯერ არავის შეუფასებია — ხარისხზე მომხმარებლის პირდაპირი სიგნალი არ გვაქვს.${t.failed ? ` ${fmt(t.failed)} მოთხოვნაზე Medi-მ ვერ უპასუხა.` : ''}`]);
      else rows.push([fb.down > fb.up ? 'warn' : 'ok', `შეფასება: ${fmt(fb.up)} მოეწონა, ${fmt(fb.down)} არ მოეწონა (${fmt(fb.users)} ადამიანი).${t.failed ? ` ${fmt(t.failed)} მოთხოვნაზე Medi-მ ვერ უპასუხა.` : ''}`]);
      if (c.declined + c.revoked) rows.push(['muted', `${fmt(c.declined + c.revoked)} ადამიანს AI-ს თანხმობაზე უარი აქვს${c.declinedThenAccepted ? `; კიდევ ${fmt(c.declinedThenAccepted)} ჯერ უარს ამბობდა, მერე დათანხმდა` : ''}.`]);
    }
    rows.push(K.teamInsight(d, d.team.users ? `${fmt(d.team.conversations)} საუბარი, ${fmt(d.team.answers)} AI პასუხი` : ''));
    return K.insights(rows);
  }

  function periodBlock(d, ctx) {
    const p = d.period;
    return `${K.periodTitle(p, ctx.days)}
      ${metrics([
        metric('აქტიური ადამიანი', fmt(p.activeUsers), `${fmt(p.newUsers)} პირველად`),
        metric('შეტყობინება', fmt(p.messages), `${fmt(p.messageUsers)} ადამიანისგან · ჯანმრთელობაზე ${fmt(p.healthQuestions)}`),
        metric('კლინიკური პასუხი', fmt(p.clinical), `${fmt(p.clinicalUsers)} ადამიანს${p.consilium ? ` · კონსილიუმი ${fmt(p.consilium)}` : ''}${p.symptomChecks ? ` · სიმპტომები ${fmt(p.symptomChecks)}` : ''}`),
        metric('ახალმა ანგარიშმა სცადა', pct(p.signupRate), `${fmt(p.signupsUsed)} / ${fmt(p.signups)} ახალი ანგარიში`),
      ])}
      ${card('დღიური ტრენდი', 'ვინ გამოიყენა Medi იმ დღეს, რამდენი შეტყობინება დაწერეს და რამდენი კლინიკური პასუხი მიიღეს — თბილისის დღეების მიხედვით.', K.chart([
        { label: 'აქტიური ადამიანი', tone: 'teal', points: p.trend.active },
        { label: 'შეტყობინება', tone: 'blue', points: p.trend.messages },
        { label: 'კლინიკური პასუხი', tone: 'violet', points: p.trend.answers },
      ], { label: 'Medi დღეების მიხედვით', empty: 'ამ პერიოდში Medi არ გამოუყენებიათ.' }))}`;
  }

  function howCard(d) {
    const t = d.totals;
    const u = d.usage;
    const cv = u.conversations;
    const title = 'როგორ იყენებენ';
    const sub = 'საუბრები, რას სთხოვენ Medi-ს და რამდენს წერს ერთი ადამიანი.';
    const callouts = d.flags.medi?.effective === false ? '' : `${K.flagCallout(d.flags.voice, '<b>ხმოვანი Medi გამორთულია</b> — ახლა მხოლოდ ტექსტით წერენ.')}${K.flagCallout(d.flags.mediDoctor, '<b>კონსულტაცია გამორთულია</b> — ჯანმრთელობის კითხვაზე Medi ადმინის შეტყობინებით პასუხობს.')}${K.flagCallout(d.flags.mediDeep, '<b>კონსილიუმი გამორთულია.</b>')}`;
    if (!t.users) return card(title, sub, `${callouts}${empty('Medi ჯერ არავის გამოუყენებია.')}`);
    const a = u.actions;
    const actionRows = Object.entries(a.groups).map(([k, n]) => [ACTIONS[k] || 'სხვა', n]);
    const pp = u.perPerson;
    const fu = u.firstUse;
    return card(title, sub, `${callouts}
      ${facts([
        ['Medi-ს საუბარი', `${fmt(cv.threads)}${extras([['კლინიკური პასუხით', cv.threadsAnswered], ['კონსილიუმით', cv.threadsDeep]])}`],
        cv.consultations + cv.consilium ? ['ცალკე კონსულტაცია', `${fmt(cv.consultations + cv.consilium)}${small('ძველი აპიდან, MEDISCAN-იდან ან ვებიდან')}`] : null,
        ['ჯანმრთელობის კითხვა', `${fmt(t.healthQuestions)}${small(`${pct(share(t.healthQuestions, t.messages))} შეტყობინებების`)}`],
        ['აპის თხოვნა', `${fmt(t.requests)}${small('ჩაწერე, გახსენი, როგორ…')}`],
        ['კლინიკური პასუხი', `${fmt(u.answers.DOCTOR)}${extras([['ადამიანი', u.answerUsers.DOCTOR]])}`],
        ['კონსილიუმი', `${fmt(u.answers.CONSILIUM)}${extras([['ადამიანი', u.answerUsers.CONSILIUM]])}`],
        ['სიმპტომების შემოწმება', `${fmt(u.answers.SYMPTOM_CHECKER)}${extras([['ადამიანი', u.answerUsers.SYMPTOM_CHECKER]])}`],
        u.answers.MEDICATION ? ['წამლების ურთიერთქმედება', `${fmt(u.answers.MEDICATION)}${extras([['ადამიანი', u.answerUsers.MEDICATION]])}`] : null,
      ])}
      ${h4('რამდენს წერს ერთი ადამიანი')}
      ${shares([['1 შეტყობინება', pp.one], ['2–3', pp.few], ['4–9', pp.some], ['10 და მეტი', pp.many], ['არ მიუწერია — მხოლოდ სიმპტომები ან წამლები', pp.none]], t.users)}
      ${note(`მედიანა: ${u.medianMessages == null ? '—' : num(u.medianMessages)} შეტყობინება და ${u.medianDays == null ? '—' : num(u.medianDays)} დღე ერთ ადამიანზე; ყველაზე ხშირად მოსული — ${fmt(u.maxDays)} დღე.`)}
      ${a.status.DONE ? `${h4('Medi-ით შენახული')}${shares(actionRows, a.status.DONE)}${note(`${fmt(a.status.DONE)} ჩანაწერი ${fmt(a.users)} ადამიანისგან: Medi ამზადებს, ადამიანი ადასტურებს.${a.status.REJECTED + a.status.UNCERTAIN ? ` უარყო მოდულმა ${fmt(a.status.REJECTED)}, შედეგი გაურკვეველია ${fmt(a.status.UNCERTAIN)}.` : ''}`)}` : ''}
      ${fu.sameDay + fu.week + fu.later ? `${h4('პირველად რეგისტრაციიდან')}${shares([['რეგისტრაციის დღესვე', fu.sameDay], ['პირველ კვირაში', fu.week], ['მოგვიანებით', fu.later]], t.users)}${note(`მედიანა: ${esc(K.hoursText(fu.medianHours))} რეგისტრაციიდან.`)}` : ''}`);
  }

  function consentCard(d) {
    const c = d.consent;
    const accounts = d.totals.accounts;
    const title = 'AI-ს თანხმობა';
    const sub = `ყველა ანგარიში (${fmt(accounts)}). Medi და აპის სხვა AI ფუნქციები მხოლოდ თანხმობით მუშაობს.`;
    if (!accounts) return card(title, sub, empty('ანგარიში ჯერ არ არის.'));
    return card(title, sub, `
      ${shares([['მისცა', c.accepted], ['უარი თქვა', c.declined], ['გაიწვია', c.revoked], ['ძველ ვერსიაზეა — ხელახლა ეკითხება', c.old], ['ჯერ არ უკითხავს', c.none]], accounts)}
      ${facts([
        ['მისცა, Medi არ გამოუყენებია', `${fmt(c.acceptedNotUsed)}${c.accepted ? small(`${pct(share(c.acceptedNotUsed, c.accepted))} თანხმობის მიმცემებიდან`) : ''}`],
        ['უარის შემდეგ დათანხმდა', fmt(c.declinedThenAccepted)],
        ['ორჯერ ან მეტჯერ თქვა უარი', fmt(c.declinedTwice)],
        ['Medi გამოიყენა, ახლა თანხმობა არ აქვს', c.usersWithoutConsent ? `${warn(c.usersWithoutConsent)}${small('გაიწვია ან ძველ ვერსიაზეა')}` : '0'],
      ])}
      ${note('„ჯერ არ უკითხავს“ — თანხმობის ეკრანამდე არ მისულა. უარი Medi-ს შეცდომა არ არის: აპი მშვიდად ეუბნება, რომ AI ფუნქციები თანხმობის გარეშე არ მუშაობს.')}`);
  }

  function topicsCard(d) {
    const s = d.safety;
    const title = 'რაზე ეკითხებიან';
    const sub = 'ჯანმრთელობის კითხვების თემები და უსაფრთხოების ნიშნები — მხოლოდ რაოდენობები.';
    const callout = d.flags.medi?.effective === false ? '' : K.flagCallout(d.flags.symptoms, '<b>სიმპტომების შემოწმება გამორთულია.</b>');
    const topics = d.topics.length
      ? `${shares(d.topics.map((t) => [TOPICS[t.key] || 'სხვა თემა', t.count]), d.topicSample || 1)}
        ${note(`თემები ითვლება საკვანძო სიტყვებით (მიახლოებით, ბოლო ${fmt(d.topicSample)} ჯანმრთელობის კითხვიდან); ერთი კითხვა შეიძლება რამდენიმე თემას ეხებოდეს. თავად ტექსტი აქ არ ჩანს.`)}`
      : empty('ჯანმრთელობის კითხვა ჯერ არავის დაუსვამს.');
    const u = s.urgency || {};
    const safety = s.sample + s.symptomChecks
      ? `${h4('უსაფრთხოება')}${facts([
        s.sample ? ['პასუხი დაიწყო 112-ით', `${warn(s.emergency)}${small(`ბოლო ${fmt(s.sample)} კლინიკური პასუხიდან`)}`] : null,
        s.sample ? ['112 ახსენა', `${fmt(s.mentions112)}${small('ჩვეულებრივ: „თუ გაუარესდა“')}`] : null,
        s.symptomChecks ? ['სიმპტომები: სასწრაფო', warn(u.emergency)] : null,
        s.symptomChecks ? ['სიმპტომები: მალე ექიმთან', fmt(u.urgent)] : null,
        s.symptomChecks ? ['სიმპტომები: ჩვეულებრივი', fmt(u.routine)] : null,
      ])}${note('Medi-ს წესით, სიცოცხლისთვის საშიში ნიშნისას (გულმკერდის ძლიერი ტკივილი, სუნთქვის უკმარისობა, ინსულტის ნიშნები, სუიციდური აზრები…) პასუხი იწყება „სასწრაფოდ დაუკავშირდით 112-ს“. სიმპტომების შემოწმება თვითონ აფასებს სიჩქარეს.')}`
      : '';
    return card(title, sub, `${callout}${topics}${safety}`);
  }

  function qualityCard(d) {
    const fb = d.feedback;
    const f = d.usage.failed;
    const t = d.totals;
    const action = '<button type="button" class="btn ghost compact" data-medi-quality>ხარისხი და ჟურნალი</button>';
    const modeFeedback = Object.entries(fb.byMode || {}).filter(([, v]) => v.up + v.down).map(([m, v]) => [MODE[m] || 'სხვა', `${fmt(v.up)} / ${fmt(v.down)}`]);
    const others = OTHER.map(([key, name, href, what]) => {
      const o = d.otherModules?.[key];
      return o?.count ? [name, `${fmt(o.count)} AI პასუხი${small(`${fmt(o.users)} ადამიანი · ${what} · <a href="${href}">გვერდი</a>`)}`] : null;
    }).filter(Boolean);
    return card('შეფასება და სხვა მოდულები', 'რას ამბობენ პასუხებზე, რა ვერ გაიცა და სად იყენებენ AI-ს Medi-ს გარეთ.', `
      ${facts([
        ['შეფასება', `${fmt(fb.up)} მოეწონა · ${fmt(fb.down)} არ მოეწონა`],
        fb.users ? ['შეაფასა', `${fmt(fb.users)} ადამიანმა${fb.withComment ? small(`კომენტარით ${fmt(fb.withComment)}`) : ''}`] : null,
        ...modeFeedback.map(([label, v]) => [`${label}: მოეწონა / არა`, v]),
        ['Medi-მ ვერ უპასუხა', `${warn(t.failed)}${extras([['კონსულტაცია', f.DOCTOR], ['კონსილიუმი', f.CONSILIUM], ['სიმპტომები', f.SYMPTOM_CHECKER], ['წამლები', f.MEDICATION]])}`],
        ['ხმით საუბარი', 'სერვერზე არ ჩანს'],
      ])}
      ${!fb.up && !fb.down ? note('პასუხის შეფასება ჯერ არავის დაუტოვებია.') : ''}
      ${others.length ? `${h4('AI სხვა მოდულებში')}${facts(others)}${note('ეს პასუხები Medi-ს ციფრებში არ ითვლება — თითოეული თავის მოდულის გვერდზეა.')}` : ''}
      ${note('ხარისხი, შეცდომები, პასუხის დრო და მოთხოვნების ჟურნალი — „ხარისხი და ჟურნალი“-ში.')}`, { action });
  }

  function paint(d, ctx) {
    const t = d.totals;
    const once = share(t.oneDay, t.users);
    wall.set(d.items, { total: d.itemsTotal });
    return `${K.flagCallout(d.flags.medi, '<b>Medi შეჩერებულია.</b> საუბარი, კონსულტაცია და სიმპტომები ახლა არ მუშაობს.')}
      ${insights(d)}
      ${metrics([
        metric('Medi-ს მომხმარებელი', fmt(t.users), `ანგარიშების ${pct(t.userRate)} · ${fmt(t.accounts)}-დან`),
        metric('შეტყობინება', fmt(t.messages), `${fmt(t.conversations)} საუბარში · მედიანა ${d.usage.medianMessages == null ? '—' : num(d.usage.medianMessages)} ადამიანზე`),
        metric('კლინიკური პასუხი', fmt(t.clinical + t.consilium), `${fmt(t.clinicalUsers)} ადამიანს${t.consilium ? ` · კონსილიუმი ${fmt(t.consilium)}` : ''}`),
        metric('მხოლოდ ერთ დღეს', fmt(t.oneDay), `${pct(once)} მომხმარებლებიდან · აღარ დაბრუნებულა`, once >= 50 ? 'warn' : ''),
      ])}
      ${card('თანხმობიდან დაბრუნებამდე', 'რამდენმა გაიარა თითო ნაბიჯი, მთელი დროის განმავლობაში. „გამოიყენა Medi“ — მიწერა, სიმპტომები ან წამლები შეამოწმა; „კლინიკური პასუხი“ — ჯანმრთელობის კითხვაზე კონსულტაცია ან კონსილიუმი; „შეინახა Medi-ით“ — Medi-მ მოამზადა ჩანაწერი (წყალი, წამალი, ციკლი…) და ადამიანმა დაადასტურა; „დაბრუნდა სხვა დღეს“ — Medi გამოიყენა ორ სხვადასხვა დღეს. % ითვლება AI-ს თანხმობის მიმცემებიდან.',
        K.ladder(d.ladder, LADDER, { first: 'ყველა, ვინც თანხმობა მისცა', unit: 'თანხმობის მიმცემებიდან', emptyText: 'AI-ს თანხმობა ჯერ არავის მიუცია.' }))}
      ${wall.html()}
      ${periodBlock(d, ctx)}
      ${K.split(howCard(d), consentCard(d))}
      ${K.split(topicsCard(d), qualityCard(d))}
      ${K.definitions([
        '<b>Medi-ს მომხმარებელი</b> — ვინც Medi-ს ერთხელ მაინც მიწერა (Medi-ს საუბარში ან ცალკე კონსულტაციაში), შეამოწმა სიმპტომები ან წამლები, ან Medi-ით შეინახა ჩანაწერი. <b>აქტიური</b> — ვინც ეს პერიოდში გააკეთა. MEDIVET, ციკლის რჩევები, MEDILAB და MEDIFOOD-ის AI აქ არ ითვლება — ისინი თავიანთ გვერდებზეა.',
        '<b>შეტყობინება</b> — ადამიანის დაწერილი ან ხმით ნათქვამი ტექსტი. <b>ჯანმრთელობის კითხვა</b> — რომელსაც კლინიკური პასუხი მოჰყვა; <b>აპის თხოვნა</b> — დანარჩენი (ჩაწერე, გახსენი, როგორ…). Medi-ს საუბარში მიღებული კლინიკური პასუხი ცალკე კონსულტაციადაც ინახება — ის ორჯერ არ ითვლება. წაშლილი საუბრის შეტყობინებები აქ აღარ ჩანს; კლინიკური პასუხები, სიმპტომები და შეცდომები AI ჟურნალიდან ითვლება და რჩება.',
        '<b>დაბრუნდა სხვა დღეს</b> — Medi გამოიყენა ორ სხვადასხვა დღეს მაინც (თბილისის დროით). <b>AI-ს თანხმობა</b> — მიმდინარე ვერსიაზე „მისცა“; ძველ ვერსიაზე მიცემულს აპი ხელახლა ეკითხება.',
        '<b>ხმა</b> — ხმით ნათქვამი ტექსტად ინახება, ამიტომ სერვერზე ხმოვანი და დაწერილი შეტყობინება ერთნაირად ჩანს და ხმის წილი ვერ ითვლება.',
        '<b>გუნდი</b> — ზუსტად @medicard.ge ელფოსტით შესული ანგარიშები (დემო და თანამშრომლები). ტელეფონით და Apple-ით შესულები ჩვეულებრივი მომხმარებლები არიან.',
        'კონფიდენციალობა: აქ არ ჩანს შეტყობინებების და პასუხების ტექსტი, სიმპტომები და რა შეინახა ადამიანმა — მხოლოდ რაოდენობები. თემები და 112 სერვერზე ითვლება და ბრაუზერამდე მხოლოდ ციფრი მოდის.',
      ])}`;
  }

  function after(root) {
    wall.bind(root);
    root.querySelector('[data-medi-quality]')?.addEventListener('click', () => {
      if (typeof global.renderAiHost?.select === 'function') void global.renderAiHost.select('quality');
      else location.hash = '#/ai';
    });
  }

  global.renderMediUsage = K.page({ tab: 'ai', path: '/usage/medi/overview', capability: 'PRODUCT_USAGE_VIEW', paint, after });
})(window);
