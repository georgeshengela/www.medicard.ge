/**
 * MediCard Admin V4 — #/pills MEDIPILL (/api/admin/usage/pills/overview), on the usage kit (usageKit.js).
 * Who keeps medicines in the app and how: what the numbers say, the ladder from adding a medicine to taking it
 * regularly, one card per person with a usage track, the period trend, what is on the lists, marks and
 * adherence, reminders and pharmacy prices. Never shows a medicine name, dosage or dose time on a person;
 * names appear only in the aggregate, when three or more different people keep the same medicine.
 */
(function adminV4PillsUsage(global) {
  const K = global.AdminUsage;
  if (!K) return;
  const { esc, fmt, pct, share, when, metric, metrics, card, facts, shares, extras, empty, note, h4, warn } = K;

  const LADDER = {
    added: 'დაამატა წამალი', active: 'აქტიური წამალი', marked: 'მონიშნა დოზა',
    regular: '3+ დღე მონიშნა', adherent: 'მიღება 80%+', returned: 'დაბრუნდა სხვა დღეს',
  };
  const TRACK = ['წამალი', 'მონიშვნა', 'მიღება', 'შეხსენება', 'ფასები'];
  const FORMS = { pills: 'ტაბლეტი', capsules: 'კაფსულა', liquid: 'სითხე', injection: 'ინექცია', unknown: 'არ არის მითითებული' };
  const TIMES = { one: 'დღეში ერთხელ', two: 'დღეში ორჯერ', three: 'დღეში სამჯერ', more: 'დღეში ოთხჯერ და მეტი' };
  const COURSE = { week: '7 დღემდე', month: '1 თვემდე', quarter: '3 თვემდე', long: '3 თვეზე მეტი', open: 'ვადის გარეშე' };
  const FREQUENCY = { daily: 'ყოველდღიური განრიგი', weekly: 'კვირაში რამდენჯერმე', one_time: 'ერთჯერადი', as_needed: 'საჭიროებისამებრ' };
  const MEAL = { before: 'ჭამამდე', after: 'ჭამის შემდეგ', with: 'ჭამასთან ერთად', any: 'ჭამა არ აქვს მნიშვნელობა' };
  const TIMING = { onTime: 'დროზე (±1 სთ)', late: 'იმავე დღეს, გვიან', backfill: 'დღეების შემდეგ — უკან ავსება', before: 'დრომდე, 1 სთ-ზე მეტით ადრე' };
  const BUCKETS = { high: '80% და მეტი', mid: '50–79%', low: '1–49%', none: '0% — არაფერი მონიშნა' };
  const PLATFORMS = { ios: 'iPhone', android: 'Android', web: 'ვები', other: 'სხვა' };
  const PERMISSION = {
    enabled: 'შეტყობინებები ტელეფონზე ჩართულია — შეხსენება მოდის',
    disabled: 'შეტყობინებები ტელეფონზე გამორთულია — შეხსენება არ მოვა',
    unknown: 'შეტყობინებების მდგომარეობა უცნობია',
  };

  const adherent = (it) => it.adherence?.bucket === 'high';
  const glyph = () => (typeof ICONS === 'object' && ICONS.capsule ? 'capsule' : 'pill');

  function badgeFor(it) {
    const a = it.adherence || {};
    if (!a.due || a.rate == null) return '';
    const tone = a.rate >= 80 ? 'ok' : a.rate >= 50 ? 'plain' : 'warn';
    return `<span class="s-badge is-${tone}" title="მიღება ბოლო 14 დღეში: ${fmt(a.taken)} / ${fmt(a.due)} გასული დოზა">${pct(a.rate)}</span>`;
  }

  function personCard(it) {
    const m = it.meds;
    const a = it.adherence || {};
    const r = it.recent;
    const title = m.active ? `${fmt(m.active)} აქტიური წამალი`
      : m.paused || m.ended ? 'წამალი გაჩერებულია'
        : 'წამალი აღარ აქვს';
    const meta = [
      m.paused && `გაჩერებული ${fmt(m.paused)}`,
      m.ended && `კურსი დასრულდა ${fmt(m.ended)}`,
      m.deleted && `წაშლილი ${fmt(m.deleted)}`,
      `MEDIPILL-ში ${fmt(it.activeDays)} დღე`,
    ].filter(Boolean).join(' · ');
    const medFill = m.active ? 100 : m.paused || m.ended ? 40 : 15;
    const priceUsed = it.price.linked + it.price.alerts + it.price.opened > 0;
    let line;
    let idle = false;
    if (!it.marks.total) {
      line = `დოზა ჯერ არ მოუნიშნავს${a.due ? ` · ${fmt(a.due)} დოზის დრო გავიდა` : ''}`;
      idle = true;
    } else if (!r.marked) {
      line = `ბოლო 14 დღეში არაფერი მოუნიშნავს · სულ ${fmt(it.marks.total)} მონიშვნა`;
      idle = true;
    } else {
      line = [`14 დღე: მივიღე ${fmt(r.taken)}`, r.skipped && `გამოვტოვე ${fmt(r.skipped)}`, a.missed && `მოუნიშნავი ${fmt(a.missed)}`].filter(Boolean).join(' · ');
    }
    return K.itemCard({
      glyph: glyph(),
      title,
      meta,
      badges: `${badgeFor(it)}${it.person.team ? '<span class="s-badge is-info">გუნდი</span>' : ''}`,
      track: K.track([
        { fill: medFill, title: `აქტიური წამალი: ${fmt(m.active)}${m.paused ? ` · გაჩერებული: ${fmt(m.paused)}` : ''}${m.ended ? ` · დასრულებული: ${fmt(m.ended)}` : ''}${m.deleted ? ` · წაშლილი: ${fmt(m.deleted)}` : ''}` },
        { fill: Math.round(Math.min(1, it.marks.days / 3) * 100), title: `დოზა მონიშნა ${fmt(it.marks.days)} დღეზე, სულ ${fmt(it.marks.total)}-ჯერ (3+ დღე = სავსე)` },
        { fill: a.rate || 0, title: a.due ? `ბოლო 14 დღე: მივიღე ${fmt(a.taken)} / ${fmt(a.due)} გასული დოზიდან (${pct(a.rate)})` : 'ბოლო 14 დღეში აქტიური წამლის დოზის დრო არ გასულა' },
        { fill: it.permission === 'enabled' ? 100 : 0, title: PERMISSION[it.permission] || PERMISSION.unknown },
        { fill: priceUsed ? 100 : 0, title: `აფთიაქის კატალოგიდან: ${fmt(it.price.linked)} · ფასის შეტყობინება: ${fmt(it.price.alerts)}${it.price.opened ? ` · გახსნა ${fmt(it.price.opened)}` : ''}${it.price.off ? ' · გამორთული აქვს' : ''}` },
      ]),
      line,
      idle,
      person: it.person,
      foot: [`დაიწყო ${when(it.firstAt, 'date')}`, it.person.lastSeenAt ? `აპში ${when(it.person.lastSeenAt)}` : 'აპში ჯერ არ ჩანს'],
      dim: !m.active,
    });
  }

  const wall = K.createWall({
    title: 'ვინ იყენებს MEDIPILL-ს',
    sub: 'თითო ბარათი ერთი ადამიანია — მხოლოდ რაოდენობები: წამლის სახელი, დოზა და დრო აქ არ ჩანს. ზოლი: ანთებული — გამოიყენა, ცარიელი — ჯერ არა. % — მიღება ბოლო 14 დღეში. ახალი აქტივობა პირველია.',
    legendLabels: TRACK,
    filters: [
      ['all', 'ყველა', () => true],
      ['idle', 'არ მოუნიშნავს', (it) => !it.marks.total],
      ['marking', 'ნიშნავს', (it) => it.recent.marked > 0],
      ['adherent', 'მიღება 80%+', adherent],
      ['stopped', 'აღარ აქვს წამალი', (it) => !it.meds.active],
    ],
    search: (it) => `${it.person.name} ${it.person.contact}`,
    placeholder: 'სახელი, ტელეფონი ან ელფოსტა',
    render: personCard,
    emptyText: {
      all: 'წამალი ჯერ არავის დაუმატებია.', idle: 'ყველამ მონიშნა ერთი დოზა მაინც.', marking: 'ბოლო 14 დღეში დოზა არავის მოუნიშნავს.',
      adherent: 'ბოლო 14 დღეში 80%-ს ჯერ არავინ ნიშნავს.', stopped: 'ყველას აქვს აქტიური წამალი.',
    },
  });

  function insights(d) {
    const t = d.totals;
    const a = d.adherence;
    const mk = d.marks;
    const rows = [];
    if (!t.people) {
      rows.push(['info', `წამალი ჯერ არცერთ ${d.includeTeam ? '' : 'რეალურ '}მომხმარებელს არ დაუმატებია.`]);
    } else {
      rows.push(['info', `<b>${fmt(t.people)} ადამიანს</b> დამატებული აქვს წამალი — ${fmt(t.accounts)} ანგარიშის ${pct(t.peopleRate)}. ახლა აქტიური წამალი აქვს ${fmt(t.peopleActive)} ადამიანს (სულ ${fmt(t.medicationsActive)} წამალი).`]);
      if (t.neverMarked) {
        const p = share(t.neverMarked, t.people);
        rows.push([p >= 40 ? 'warn' : 'info', `<b>${fmt(t.neverMarked)} ადამიანს (${pct(p)})</b> წამალი დამატებული აქვს, მაგრამ დოზა ჯერ არცერთხელ არ მოუნიშნავს.`]);
      }
      if (a.due) {
        rows.push([a.rate >= 70 ? 'ok' : 'warn', `ბოლო 14 დღეში აქტიური წამლების ${fmt(a.due)} დოზის დრო გავიდა: „მივიღე“ მონიშნულია <b>${fmt(a.taken)} (${pct(a.rate)})</b>, მოუნიშნავია ${fmt(a.missed)}. 80%-ს და მეტს ${fmt(a.buckets.high)} ადამიანი ნიშნავს.`]);
      }
      if (mk.total && !mk.sources.notification) {
        rows.push(['warn', `<b>შეხსენების ღილაკით „მივიღე ✓“ ჯერ არცერთი დოზა არ მონიშნულა</b> — ${fmt(mk.total)}-ვე მონიშვნა აპის შიგნიდანაა. ღირს შემოწმება, აღწევს თუ არა ღილაკის მონიშვნა სერვერამდე.`]);
      } else if (mk.sources.notification) {
        rows.push(['ok', `${fmt(mk.sources.notification)} მონიშვნა (${pct(share(mk.sources.notification, mk.total))}) შეხსენების ღილაკიდან მოვიდა.`]);
      }
      if (d.reminders.active.disabled) {
        rows.push(['warn', `<b>${fmt(d.reminders.active.disabled)} ადამიანს</b> აქტიური წამალი აქვს, მაგრამ შეტყობინებები ტელეფონზე გამორთული აქვს — შეხსენება მას არ მივა.`]);
      }
      if (mk.deleted.marks) {
        rows.push(['info', `${fmt(mk.deleted.marks)} მონიშვნა (${pct(share(mk.deleted.marks, mk.total))}) წაშლილ წამალს ეკუთვნის (${fmt(mk.deleted.people)} ადამიანი). აპში წამლის შეცვლა არ შეიძლება — შესაცვლელად შლიან და თავიდან ამატებენ.`]);
      }
      const backfill = share(mk.timing.backfill, mk.total);
      if (backfill >= 30) {
        rows.push(['info', `მონიშვნების ${pct(backfill)} დოზის დროიდან 24 საათზე მეტის შემდეგ გაკეთდა — წინა დღეებს უკან ავსებენ და არა დოზის დროს.`]);
      }
    }
    // At most six sentences, most important first; the team line always ends the list.
    return K.insights([...rows.slice(0, 6), K.teamInsight(d, d.team.people ? `${fmt(d.team.people)} წამლით, ${fmt(d.team.marks)} მონიშვნით` : '')]);
  }

  function periodBlock(d, ctx) {
    const p = d.period;
    return `${K.periodTitle(p, ctx.days)}
      ${metrics([
        metric('ახალი წამალი', fmt(p.newMedications), `${fmt(p.newPeople)} ახალი ადამიანი`),
        metric('აქტიური ადამიანი', fmt(p.activePeople), 'ვინც MEDIPILL-ში რამე გააკეთა'),
        metric('მონიშნული დოზა', fmt(p.marks), `${fmt(p.markPeople)} ადამიანი${p.skipped ? ` · გამოვტოვე ${fmt(p.skipped)}` : ''}`),
        metric('ახალმა ანგარიშმა დაამატა', pct(p.signupMedRate), `${fmt(p.signupsWithMed)} / ${fmt(p.signups)} ახალი ანგარიში`),
      ])}
      ${card('დღიური ტრენდი', 'ახალი წამლები, ადამიანები, ვინც იმ დღეს MEDIPILL-ში რამე გააკეთა, და მონიშნული დოზები (დოზის დღით) — თბილისის დღეების მიხედვით.', K.chart([
        { label: 'ახალი წამალი', tone: 'blue', points: p.trend.medications },
        { label: 'აქტიური ადამიანი', tone: 'teal', points: p.trend.active },
        { label: 'მონიშნული დოზა', tone: 'violet', points: p.trend.marks },
      ], { label: 'MEDIPILL დღეების მიხედვით', empty: 'ამ პერიოდში MEDIPILL-ში არაფერი მომხდარა.' }))}`;
  }

  function listCard(d) {
    const s = d.schedules;
    const title = 'რა წამლებია სიაში';
    if (!s.active) return card(title, '', empty('აქტიური წამალი ჯერ არავის აქვს.'));
    const freq = Object.entries(s.frequency).filter(([k, n]) => n > 0 && k !== 'daily');
    const meal = Object.entries(MEAL).map(([k, label]) => [label, s.meal[k]]);
    const names = s.names.length
      ? `${K.chips(s.names.map((n) => [n.label, n.people]))}${s.namesOther.people ? note(`დანარჩენი ${fmt(s.namesOther.medications)} წამალი (${fmt(s.namesOther.people)} ადამიანი) „სხვაშია“ — მათ 3-ზე ნაკლები ადამიანი იღებს.`) : ''}`
      : note(`არცერთ წამალს 3 ან მეტი ადამიანი არ იღებს, ამიტომ სახელები არ ჩანს — ${fmt(s.namesOther.medications)} წამალი (${fmt(s.namesOther.people)} ადამიანი) „სხვაშია“.`);
    return card(title, `აქტიური წამლები (${fmt(s.active)}) — ფორმა, რამდენჯერ დღეში, რა ვადით. სახელი ჩანს მხოლოდ მაშინ, როცა ერთსა და იმავე წამალს 3+ სხვადასხვა ადამიანი იღებს.`, `
      <h4 class="p2-h">ფორმა</h4>${shares(Object.entries(FORMS).map(([k, label]) => [label, s.forms[k]]), s.active)}
      ${h4('რამდენჯერ დღეში')}${shares(Object.entries(TIMES).map(([k, label]) => [label, s.timesPerDay[k]]), s.active)}
      ${h4('კურსის ხანგრძლივობა')}${shares(Object.entries(COURSE).map(([k, label]) => [label, s.course[k]]), s.active)}
      ${facts([
        ['ყოველ დღე / კვირის ზოგ დღეს', `${fmt(s.weekdays.everyDay)} / ${fmt(s.weekdays.someDays)}`],
        freq.length ? ['სხვა განრიგი', esc(freq.map(([k, n]) => `${FREQUENCY[k] || 'სხვა'} ${fmt(n)}`).join(' · '))] : null,
        ['ჭამასთან მიბმული', `${fmt(s.meal.before + s.meal.after + s.meal.with)}${extras(meal.filter(([label]) => label !== MEAL.any))}`],
        ['აფთიაქის კატალოგიდან არჩეული', `${fmt(s.linked)} <small class="s-muted">· ${pct(share(s.linked, s.active))}</small>`],
        ['ადამიანზე: 1 / 2–3 / 4+ წამალი', `${fmt(s.perPerson.one)} / ${fmt(s.perPerson.few)} / ${fmt(s.perPerson.many)}`],
      ])}
      ${h4('ყველაზე ხშირი წამლები')}${names}`);
  }

  function marksCard(d) {
    const mk = d.marks;
    const a = d.adherence;
    const title = 'მონიშვნები და მიღება';
    const sub = 'როგორ ნიშნავენ დოზებს და რა წილს ნიშნავენ „მივიღე“-თი.';
    const orphan = mk.orphaned?.marks ? note(`წაშლილი ${fmt(mk.orphaned.accounts)} ანგარიშის ${fmt(mk.orphaned.marks)} მონიშვნა ბაზაში დარჩა — აქ არ ითვლება.`) : '';
    if (!mk.total && !a.due) return card(title, sub, `${empty('დოზა ჯერ არავის მოუნიშნავს.')}${orphan}`);
    const timingTotal = Object.values(mk.timing).reduce((sum, n) => sum + n, 0);
    const bucketTotal = Object.values(a.buckets).reduce((sum, n) => sum + n, 0);
    return card(title, sub, `
      ${facts([
        ['მონიშვნა', `${fmt(mk.total)}${extras([['მივიღე', mk.taken], ['გამოვტოვე', mk.skipped]])}`],
        ['საიდან', `აპიდან ${fmt(mk.sources.app)} · შეხსენების ღილაკით ${fmt(mk.sources.notification)}`],
        mk.deleted.marks ? ['წაშლილ წამალზე', `${fmt(mk.deleted.marks)} <small class="s-muted">· ${fmt(mk.deleted.people)} ადამიანი</small>`] : null,
      ])}
      ${timingTotal ? `${h4('როდის ნიშნავენ — დოზის დროსთან შედარებით')}${shares(Object.entries(TIMING).map(([k, label]) => [label, mk.timing[k]]), timingTotal)}` : ''}
      ${h4(`მიღება ბოლო ${fmt(a.days)} დღეში`)}
      ${a.due ? `${facts([
        ['დოზის დრო გავიდა', `${fmt(a.due)} <small class="s-muted">· ${fmt(a.people)} ადამიანი</small>`],
        ['მივიღე', `${fmt(a.taken)} <small class="s-muted">· ${pct(a.rate)}</small>`],
        ['გამოვტოვე', fmt(a.skipped)],
        ['მოუნიშნავი', warn(a.missed)],
      ])}
      ${bucketTotal ? `${h4('ადამიანები მიღების წილით (3+ დოზით)')}${shares(Object.entries(BUCKETS).map(([k, label]) => [label, a.buckets[k]]), bucketTotal)}` : ''}`
        : '<p class="p2-note">ბოლო 14 დღეში აქტიური წამლის დოზის დრო არ გასულა.</p>'}
      ${note('დოზის დრო გავიდა — ახლა აქტიური წამლის დოზა, წამლის დამატების მომენტიდან; დღევანდელი ითვლება დროიდან 2 საათის შემდეგ. გაჩერებული და წაშლილი წამლები არ ითვლება. „მოუნიშნავი“ არ ნიშნავს, რომ არ დალია — მხოლოდ რომ არ მონიშნა.')}
      ${orphan}`);
  }

  function peopleCard(d) {
    const t = d.totals;
    const fm = d.firstMed || {};
    const rem = d.reminders.active;
    const title = 'ადამიანები და შეხსენებები';
    if (!t.people) return card(title, '', empty('წამალი ჯერ არავის დაუმატებია.'));
    const platforms = K.chips(Object.entries(d.reminders.platforms || {}).map(([k, n]) => [PLATFORMS[k] || 'სხვა', n]));
    return card(title, 'როდის ამატებენ პირველ წამალს, ბრუნდებიან თუ არა და მივა თუ არა შეხსენება.', `
      ${facts([
        ['წამლის მომხმარებელი', `${fmt(t.people)} <small class="s-muted">· ანგარიშების ${pct(t.peopleRate)}</small>`],
        ['ახლა აქტიური წამლით', fmt(t.peopleActive)],
        ['წამალი აღარ აქვს', `${fmt(t.people - t.peopleActive)}${extras([['მხოლოდ წაშლილი', t.withoutMedicine]])}`],
        ['აპში დაბრუნდა დამატების შემდეგ', `${fmt(t.appReturned)} <small class="s-muted">· ${pct(share(t.appReturned, t.people))}</small>`],
      ])}
      ${h4('პირველი წამალი რეგისტრაციიდან')}
      ${shares([['რეგისტრაციის დღესვე', fm.sameDay], ['პირველ კვირაში', fm.week], ['მოგვიანებით', fm.later]], t.people)}
      ${note(`მედიანა: ${esc(K.hoursText(fm.medianHours))} რეგისტრაციიდან. „აპში დაბრუნდა“ — პირველი წამლის შემდეგ სხვა დღეს გახსნა აპი (ნებისმიერი გვერდი).`)}
      ${h4('შეხსენება — ვისაც აქტიური წამალი აქვს')}
      ${t.peopleActive ? facts([
        ['შეტყობინებები ჩართულია', `${fmt(rem.enabled)} <small class="s-muted">· ${pct(share(rem.enabled, t.peopleActive))}</small>`],
        ['გამორთულია', warn(rem.disabled)],
        ['უცნობია', fmt(rem.unknown)],
      ]) + platforms : '<p class="p2-note">აქტიური წამალი ახლა არავის აქვს.</p>'}
      ${note('წამლის შეხსენება ლოკალურია — ტელეფონი თვითონ აგზავნის. სერვერმა იცის მხოლოდ, ჩართული აქვს თუ არა ადამიანს შეტყობინებები ტელეფონზე; პროფილის „წამლის მიღება“ გადამრთველი ტელეფონზე რჩება. წამლის შეხსენება არასოდეს ჩერდება.')}`);
  }

  function priceCard(d) {
    const p = d.price;
    const m = d.medi;
    const title = 'აფთიაქის ფასები და Medi';
    const sub = 'ვინ ირჩევს წამალს აფთიაქის კატალოგიდან, მოდის თუ არა ფასის დაკლების შეტყობინება და ამოწმებინებენ თუ არა წამლებს Medi-ს.';
    const used = p.linkedMedications + p.alerts.SENT + p.alerts.SKIPPED + p.alerts.PENDING + p.alerts.FAILED + p.opened;
    const prices = used
      ? `${facts([
        ['კატალოგიდან არჩეული წამალი', `${fmt(p.linkedMedications)} <small class="s-muted">· ${fmt(p.linkedPeople)} ადამიანი</small>`],
        ['ფასის დაკლების შეტყობინება', `${fmt(p.alerts.SENT)} გაიგზავნა <small class="s-muted">· ${fmt(p.alertPeople)} ადამიანს</small>${extras([['არ გაიგზავნა', p.alerts.SKIPPED], ['რიგშია', p.alerts.PENDING], ['ვერ გაიგზავნა', p.alerts.FAILED]])}`],
        ['შეტყობინება გახსნა', `${fmt(p.opened)} <small class="s-muted">· ${fmt(p.openedPeople)} ადამიანი</small>`],
        ['ფასის შეტყობინება გამორთო', fmt(p.off)],
      ])}
      ${note(`„არ გაიგზავნა“ — ფასი ისევ გაძვირდა, წამალი გაჩერდა, ტელეფონი არ არის დარეგისტრირებული ან 3 დღეში ვერ მოხვდა დღის საათებში. აფთიაქის ძებნა ყველასთვის ღიაა და ადამიანზე არ იწერება — აქ ჩანს მხოლოდ კატალოგიდან არჩეული წამლები და შეტყობინებები. კატალოგში ფასით: ${fmt(p.catalogProducts)} პროდუქტი.`)}`
      : `${empty('აფთიაქის კატალოგიდან წამალი ჯერ არავის აურჩევია.')}${note(`კატალოგში ფასით: ${fmt(p.catalogProducts)} პროდუქტი. აფთიაქის ძებნა ადამიანზე არ იწერება.`)}`;
    const medi = m.reviews
      ? facts([
        ['შემოწმება', `${fmt(m.reviews)} <small class="s-muted">· ${fmt(m.people)} ადამიანი</small>`],
        ['შეცდომა', warn(m.errors)],
        ['ბოლოს', esc(when(m.lastAt))],
      ])
      : '<p class="p2-note">Medi-ს წამლების შემოწმება ჯერ არავის გამოუყენებია.</p>';
    return card(title, sub, `${K.flagCallout(d.flags.pharmacy, '<b>აფთიაქი შეჩერებულია.</b> ფასის შეტყობინება ახლა არ ეწყობა.')}${prices}${h4('Medi-ს წამლების შემოწმება')}${medi}`);
  }

  function paint(d, ctx) {
    const t = d.totals;
    const a = d.adherence;
    wall.set(d.items, { total: d.itemsTotal });
    return `${K.flagCallout(d.flags.medications, '<b>მედიკამენტები შეჩერებულია.</b> ახალი წამალი ვერ ემატება; დაყენებული შეხსენებები ტელეფონზე გრძელდება.')}
      ${insights(d)}
      ${metrics([
        metric('წამლის მომხმარებელი', fmt(t.people), `ანგარიშების ${pct(t.peopleRate)} · ${fmt(t.accounts)}-დან`),
        metric('აქტიური წამალი', fmt(t.medicationsActive), `${fmt(t.peopleActive)} ადამიანთან${t.medicationsPaused ? ` · ${fmt(t.medicationsPaused)} გაჩერებული` : ''}`),
        metric('მონიშნული დოზა', fmt(t.marks), `მივიღე ${fmt(t.taken)} · გამოვტოვე ${fmt(t.skipped)} · ${fmt(t.markPeople)} ადამიანი`),
        metric('მიღება · 14 დღე', pct(a.rate), a.due ? `${fmt(a.taken)} / ${fmt(a.due)} დოზა · ${fmt(a.people)} ადამიანი` : 'დოზის დრო ჯერ არ გასულა', a.rate != null && a.rate < 50 ? 'warn' : ''),
      ])}
      ${card('წამლის დამატებიდან რეგულარულ მიღებამდე', 'რამდენმა ადამიანმა გაიარა თითო ნაბიჯი, მთელი დროის განმავლობაში. „აქტიური წამალი“ — ახლა აქვს ჩართული წამალი დაუსრულებელი კურსით; „3+ დღე მონიშნა“ — დოზა მონიშნა სამ სხვადასხვა დღეზე; „მიღება 80%+“ — ბოლო 14 დღის 3+ დოზიდან 80% მაინც „მივიღე“; „დაბრუნდა სხვა დღეს“ — MEDIPILL-ში რამე გააკეთა ორ სხვადასხვა დღეს. % ითვლება ყველა მომხმარებლიდან.',
        K.ladder(d.ladder, LADDER, { first: 'ყველა მომხმარებელი', unit: 'მომხმარებლებიდან', emptyText: 'წამალი ჯერ არავის დაუმატებია.' }))}
      ${wall.html()}
      ${periodBlock(d, ctx)}
      ${K.split(listCard(d), marksCard(d))}
      ${K.split(peopleCard(d), priceCard(d))}
      ${K.definitions([
        '<b>მომხმარებელი</b> — ანგარიში, რომლის სიაშიც წამალია (აქტიური ან გაჩერებული), ან ვისაც დოზა მონიშნული აქვს უკვე წაშლილ წამალზე. <b>აქტიური წამალი</b> — ჩართული, კურსი არ დასრულებულა. აპში წამლის შეცვლა არ შეიძლება: შლიან და თავიდან ამატებენ, წაშლა კი სამუდამოა — ამიტომ „ახალი წამალი“ ითვლის მხოლოდ სიაში დარჩენილებს.',
        '<b>მიღება (14 დღე)</b> = „მივიღე“ ÷ დოზები, რომელთა დრო გავიდა. ითვლება ახლა აქტიური წამლის დოზა იმ დღეს, რომელსაც კურსი მოიცავს (დაწყება–დასრულება, კვირის დღეები), წამლის დამატების მომენტიდან; დღევანდელი — დროიდან 2 საათის შემდეგ. მონიშვნა ითვლება დოზის დღით, ამიტომ უკან ავსებულიც ითვლება. გაჩერებული, წაშლილი და „საჭიროებისამებრ“ წამლები არ ითვლება (მათი ისტორია არ ვიცით).',
        '<b>3+ დღე მონიშნა</b> — დოზა მონიშნა სამ სხვადასხვა დღეზე მაინც (დოზის თარიღით). <b>მიღება 80%+</b> — ბოლო 14 დღეში 3+ დოზიდან 80% მაინც „მივიღე“. <b>დაბრუნდა სხვა დღეს</b> და პერიოდის <b>აქტიური ადამიანი</b> — წამალი დაამატა, დოზა მონიშნა, ფასის შეტყობინება გახსნა ან Medi-ს წამლები შეამოწმებინა (თბილისის დღეებით). აპის უბრალოდ გახსნა ცალკეა: „აპში დაბრუნდა“.',
        '<b>შეხსენება</b> — ტელეფონის შეტყობინებების ნებართვა, რომელსაც აპი სერვერს უგზავნის; პროფილის „წამლის მიღება“ გადამრთველი ტელეფონზე რჩება. <b>ფასები</b> — წამალი არჩეულია აფთიაქის კატალოგიდან (ადარებს ფასებს და იღებს ფასის დაკლების შეტყობინებას) ან მიიღო ფასის შეტყობინება.',
        '<b>გუნდი</b> — ზუსტად @medicard.ge ელფოსტით შესული ანგარიშები (დემო და თანამშრომლები). კონფიდენციალობა: ადამიანის ბარათზე არ ჩანს წამლის სახელი, დოზა, დრო ან შენიშვნა — მხოლოდ რაოდენობები. სახელი ჩანს მხოლოდ საერთო სიაში, როცა ერთსა და იმავე წამალს 3+ სხვადასხვა ადამიანი იღებს.',
      ])}`;
  }

  function after(root) {
    wall.bind(root);
  }

  global.renderPillsUsage = K.page({ tab: 'pills', path: '/usage/pills/overview', capability: 'PRODUCT_USAGE_VIEW', paint, after });
})(window);
