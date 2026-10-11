/**
 * MediCard Admin V4 — #/pets MEDIVET (/api/admin/pets/overview), on the usage kit (usageKit.js).
 * Who uses „ჩემი ცხოველები“ and how: what the numbers say, the ladder from adding a pet to asking Medi Vet,
 * every pet as a card with its usage track, the period trend, who the pets are, care + reminders and Medi Vet
 * quality. Never shows chat text, allergy / condition names or notes: the conversations stay in Medi (#/ai).
 */
(function adminV4Pets(global) {
  const K = global.AdminUsage;
  if (!K) return;
  const { esc, fmt, pct, share, when, metric, metrics, card, facts, shares, extras, empty, note, h4, warn } = K;

  K.glyphs({
    paw: '<ellipse cx="6.2" cy="10.2" rx="1.7" ry="2.1"/><ellipse cx="9.7" cy="6" rx="1.7" ry="2.2"/><ellipse cx="14.3" cy="6" rx="1.7" ry="2.2"/><ellipse cx="17.8" cy="10.2" rx="1.7" ry="2.1"/><path d="M12 11.5c-2.6 0-5 3.1-5 5.6 0 1.7 1.2 2.6 2.6 2.6 1 0 1.6-.5 2.4-.5s1.4.5 2.4.5c1.4 0 2.6-.9 2.6-2.6 0-2.5-2.4-5.6-5-5.6z"/>',
    petDog: '<path d="M8.2 5.5h7.6l2.4 1.2c1.5.8 2.3 2.4 2.3 4.1v1.4l-2.6-1.4v3.1c0 3.6-2.7 6.6-5.9 6.6s-5.9-3-5.9-6.6v-3.1L3.5 12.2v-1.4c0-1.7.8-3.3 2.3-4.1z"/><path d="M10.6 16.4h2.8L12 17.9z"/><path d="M9.6 11.6h.01M14.4 11.6h.01"/>',
    petCat: '<path d="M4.8 10.3 4.3 3.8l4.4 3.1a8.4 8.4 0 0 1 6.6 0l4.4-3.1-.5 6.5c.6 1 .9 2.2.9 3.4 0 4.3-3.8 7.3-8.1 7.3S3.9 18 3.9 13.7c0-1.2.3-2.4.9-3.4z"/><path d="M10.8 15.4h2.4L12 16.7z"/><path d="M9.2 12.4h.01M14.8 12.4h.01"/><path d="M6.5 15.2 3 14.6M6.7 16.6l-3.2.9M17.5 15.2l3.5-.6M17.3 16.6l3.2.9"/>',
    petBird: '<path d="M15.5 8.2a3.2 3.2 0 0 0-6.1-1.3L4 15.6c2.3 1.5 5.6 1.9 8.2.8"/><path d="M15.5 8.2 20 7.4l-4.1 2.4c.2 3-1.1 5.5-3.7 6.6l1.6 4.1"/><path d="M12.6 7.6h.01"/>',
    petFish: '<path d="M4.5 12c2.4-3.6 5.6-5.2 9-5.2 3 0 5.4 2 6.6 5.2-1.2 3.2-3.6 5.2-6.6 5.2-3.4 0-6.6-1.6-9-5.2z"/><path d="M4.5 12 2 8.8M4.5 12 2 15.2"/><path d="M16.2 11h.01"/><path d="M11 9.4c.8 1.6.8 3.6 0 5.2"/>',
    petRabbit: '<path d="M10 9.8C8.8 7 8.4 3.4 9.7 2.9s2.4 2.9 2.3 6.4"/><path d="M14 9.8c1.2-2.8 1.6-6.4.3-6.9S11.9 5.8 12 9.3"/><circle cx="12" cy="15" r="5.6"/><path d="M10 14.4h.01M14 14.4h.01"/><path d="M11 17.2h2"/>',
  });

  const SPECIES = { dog: 'ძაღლი', cat: 'კატა', bird: 'ფრინველი', rabbit: 'კურდღელი', rodent: 'მღრღნელი', fish: 'თევზი', reptile: 'ქვეწარმავალი', horse: 'ცხენი', other: 'სხვა' };
  const GLYPH = { dog: 'petDog', cat: 'petCat', bird: 'petBird', fish: 'petFish', rabbit: 'petRabbit' };
  const KINDS = { VACCINATION: 'ვაქცინა', FLEA_TICK: 'რწყილი და ტკიპა', DEWORMING: 'ჭიებისგან დამუშავება', MEDICATION: 'წამალი', OTHER: 'სხვა მოვლა' };
  const RECURRENCE = { ONCE: 'ერთჯერადი', EVERY_N_DAYS: 'რამდენიმე დღეში ერთხელ', EVERY_N_WEEKS: 'რამდენიმე კვირაში ერთხელ', EVERY_N_MONTHS: 'რამდენიმე თვეში ერთხელ', DAILY_COURSE: 'ყოველდღიური კურსი' };
  const SOURCES = { VETERINARIAN: 'ვეტერინარის დანიშნულებით', PRODUCT_INSTRUCTIONS: 'ინსტრუქციით', USER_ENTERED: 'პატრონის გადაწყვეტილებით' };
  const ALLERGY = { food: 'საკვები', medication: 'წამალი', environmental: 'გარემო', other: 'სხვა', unknown: 'უცნობი' };
  const TOPICS = {
    food: 'კვება და საკვები', digestion: 'კუჭ-ნაწლავი', skin: 'კანი, ბეწვი, ყურები', parasites: 'ვაქცინა და პარაზიტები',
    behavior: 'ქცევა', weight: 'წონა და აქტივობა', visit: 'ვიზიტი და ისტორია', medication: 'წამლები და მკურნალობა', other: 'სხვა თემა',
  };
  const LADDER = {
    owners: 'დაამატა ცხოველი', recorded: 'ჩაწერა რამე', planned: 'შექმნა მოვლის გეგმა',
    reminders: 'ჩართო შეხსენება', vet: 'ჰკითხა MEDIVET-ს', returned: 'დაბრუნდა სხვა დღეს',
  };
  const TRACK = [['profile', 'პროფილი'], ['weight', 'წონა'], ['health', 'ჯანმრთელობა'], ['care', 'მოვლა'], ['reminders', 'შეხსენება'], ['vet', 'MEDIVET']];
  const PROFILE_PARTS = { photo: 'ფოტო', breed: 'ჯიში', age: 'ასაკი', sex: 'სქესი', neutered: 'სტერილიზაცია', vet: 'ვეტერინარი' };
  const joinCounts = (obj, names) => Object.entries(obj).filter(([, n]) => n > 0).map(([k, n]) => `${names[k] || 'სხვა'} ${fmt(n)}`).join(' · ');

  const used = (p) => p.usage.weight + p.usage.health + p.usage.care + p.usage.vet > 0;
  const profileFilled = (p) => Object.values(p.profile || {}).filter(Boolean).length;

  function ageText(age) {
    if (!age || age.kind === 'UNKNOWN' || age.years == null) return '';
    const approx = age.kind === 'APPROXIMATE' ? '~' : '';
    return age.years >= 1 ? `${approx}${age.years} წლის` : `${approx}${Math.max(0, age.months || 0)} თვის`;
  }
  const breedText = (p) => (p.breedKind === 'mixed' ? 'შერეული' : p.breedKind === 'unknown' ? '' : p.breed || '');

  function petCard(p) {
    const filled = profileFilled(p);
    const missing = Object.entries(p.profile || {}).filter(([, v]) => !v).map(([k]) => PROFILE_PARTS[k]);
    const seg = (n, title) => ({ fill: n ? 100 : 0, title });
    const parts = [
      p.usage.weight && `წონა ${fmt(p.usage.weight)}`,
      p.usage.health && `ჯანმრთელობა ${fmt(p.usage.health)}`,
      p.usage.care && `მოვლა ${fmt(p.usage.care)}`,
      p.usage.reminders && `შეხსენება ${fmt(p.usage.reminders)}`,
      p.usage.vet && `MEDIVET ${fmt(p.usage.vet)} კითხვა`,
    ].filter(Boolean);
    return K.itemCard({
      glyph: GLYPH[p.speciesId] || 'paw',
      title: p.name,
      meta: [SPECIES[p.speciesId] || 'სხვა', breedText(p), ageText(p.age)].filter(Boolean).join(' · '),
      badges: `${p.archived ? '<span class="s-badge is-plain">არქივშია</span>' : ''}${p.owner.team ? '<span class="s-badge is-info">გუნდი</span>' : ''}`,
      track: K.track([
        { fill: Math.round((filled / 6) * 100), title: `პროფილი ${filled}/6${missing.length ? ` · აკლია: ${missing.join(', ')}` : ''}` },
        seg(p.usage.weight, `წონის ჩანაწერი: ${fmt(p.usage.weight)}`),
        seg(p.usage.health, `ალერგია და მდგომარეობა: ${fmt(p.usage.health)}`),
        seg(p.usage.care, `მოვლის ჩანაწერი: ${fmt(p.usage.care)}`),
        seg(p.usage.reminders, `ჩართული შეხსენება: ${fmt(p.usage.reminders)}`),
        seg(p.usage.vet, `MEDIVET-ის კითხვა: ${fmt(p.usage.vet)}`),
      ]),
      line: parts.length ? parts.join(' · ') : `მხოლოდ პროფილი · შევსებულია ${filled}/6`,
      idle: !parts.length,
      person: p.owner,
      foot: [`დაემატა ${when(p.createdAt, 'date')}`, p.owner.lastSeenAt ? `აპში ${when(p.owner.lastSeenAt)}` : 'აპში ჯერ არ ჩანს'],
      dim: p.archived,
    });
  }

  const wall = K.createWall({
    title: 'ცხოველები და რას აკეთებენ',
    sub: 'თითო ბარათი ერთი ცხოველია. ზოლი აჩვენებს, რა გამოიყენა პატრონმა: ანთებული — გამოიყენა, ცარიელი — ჯერ არა. ახალი აქტივობა პირველია.',
    legendLabels: TRACK.map(([, label]) => label),
    filters: [
      ['all', 'ყველა', (p) => !p.archived],
      ['idle', 'მხოლოდ დაამატა', (p) => !p.archived && !used(p)],
      ['using', 'იყენებს', (p) => !p.archived && used(p)],
      ['vet', 'MEDIVET', (p) => p.usage.vet > 0],
      ['archived', 'არქივი', (p) => p.archived],
    ],
    search: (p) => `${p.name} ${p.owner.name} ${p.owner.contact} ${p.breed || ''}`,
    placeholder: 'ცხოველი, პატრონი ან ჯიში',
    render: petCard,
    emptyText: {
      all: 'ცხოველი ჯერ არ არის.', idle: 'ყველა პატრონმა რამე ჩაწერა.', using: 'დამატების შემდეგ ჯერ არავის არაფერი ჩაუწერია.',
      vet: 'MEDIVET-ისთვის ჯერ არავის უკითხავს.', archived: 'არქივში ცხოველი არ არის.',
    },
  });

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
    return K.insights(rows);
  }

  function periodBlock(d, ctx) {
    const p = d.period;
    return `${K.periodTitle(p, ctx.days)}
      ${metrics([
        metric('ახალი ცხოველი', fmt(p.newPets), `${fmt(p.newOwners)} ახალი პატრონი`),
        metric('აქტიური პატრონი', fmt(p.activeOwners), 'ვინც ცხოველებში რამე გააკეთა'),
        metric('MEDIVET-ის კითხვა', fmt(p.questions), `${fmt(p.questionUsers)} ადამიანისგან`),
        metric('ახალმა ანგარიშმა დაამატა', pct(p.signupPetRate), `${fmt(p.signupsWithPet)} / ${fmt(p.signups)} ახალი ანგარიში`),
      ])}
      ${card('დღიური ტრენდი', 'ახალი ცხოველები, პატრონები, ვინც იმ დღეს ცხოველებში რამე გააკეთა, და MEDIVET-ის კითხვები — თბილისის დღეების მიხედვით.', K.chart([
        { label: 'ახალი ცხოველი', tone: 'blue', points: p.trend.pets },
        { label: 'აქტიური პატრონი', tone: 'teal', points: p.trend.active },
        { label: 'MEDIVET კითხვა', tone: 'violet', points: p.trend.questions },
      ], { label: 'ცხოველები დღეების მიხედვით', empty: 'ამ პერიოდში ცხოველებში არაფერი მომხდარა.' }))}`;
  }

  function compositionCard(d) {
    const c = d.composition;
    const total = d.totals.petsActive;
    if (!total) return card('ვინ არიან ცხოველები', '', empty('აქტიური ცხოველი ჯერ არ არის.'));
    const breeds = c.breeds.length ? `<div class="s-uw-chips">${c.breeds.map((b) => `<span class="s-badge is-plain">${esc(b.label)} · ${fmt(b.count)}</span>`).join('')}</div>` : '';
    return card('ვინ არიან ცხოველები', `აქტიური ცხოველები (${fmt(total)}), არქივის გარეშე.`, `
      <h4 class="p2-h">სახეობა</h4>${shares(c.species.map((s) => [SPECIES[s.id] || 'სხვა', s.count]), total)}
      ${h4('ჯიში')}
      ${facts([['ცნობილი ჯიში', fmt(c.breedKind.known)], ['შერეული', fmt(c.breedKind.mixed)], ['საკუთარი ჩაწერილი', fmt(c.breedKind.custom)], ['უცნობი', fmt(c.breedKind.unknown)]])}
      ${breeds}
      ${h4('სქესი, სტერილიზაცია, ასაკი')}
      ${facts([
        ['მდედრი / მამრი', `${fmt(c.sex.FEMALE)} / ${fmt(c.sex.MALE)}${c.sex.UNKNOWN ? ` <small class="s-muted">· უცნობი ${fmt(c.sex.UNKNOWN)}</small>` : ''}`],
        ['სტერილიზებული', `${fmt(c.neutered.yes)} <small class="s-muted">· არა ${fmt(c.neutered.no)} · უცნობი ${fmt(c.neutered.unknown)}</small>`],
        ['1 წლამდე', fmt(c.ages.young)], ['1–7 წლის', fmt(c.ages.adult)], ['8 წლის და მეტი', fmt(c.ages.senior)], ['ასაკი უცნობია', fmt(c.ages.unknown)],
      ])}
      ${h4('რა შეავსეს პროფილში')}${shares(Object.entries(PROFILE_PARTS).map(([k, label]) => [label, c.profile[k]]), total) || empty('პროფილის დამატებითი ველი ჯერ არავის შეუვსია.')}`);
  }

  function ownersCard(d) {
    const t = d.totals;
    const fp = d.firstPet || {};
    const po = d.composition.perOwner;
    if (!t.owners) return card('პატრონები', '', empty('პატრონი ჯერ არ არის.'));
    return card('პატრონები', 'როდის ამატებენ ცხოველს და ბრუნდებიან თუ არა.', `
      ${facts([
        ['ცხოველის პატრონი', `${fmt(t.owners)} <small class="s-muted">· ანგარიშების ${pct(t.ownerRate)}</small>`],
        ['აქტიური ცხოველით', fmt(t.ownersActive)],
        ['ერთი / ორი / სამი და მეტი', `${fmt(po.one)} / ${fmt(po.two)} / ${fmt(po.more)}`],
        ['აპში დაბრუნდა დამატების შემდეგ', `${fmt(t.appReturned)} <small class="s-muted">· ${pct(share(t.appReturned, t.owners))}</small>`],
      ])}
      ${h4('პირველი ცხოველი რეგისტრაციიდან')}
      ${shares([['რეგისტრაციის დღესვე', fp.sameDay], ['პირველ კვირაში', fp.week], ['მოგვიანებით', fp.later]], t.owners)}
      ${note(`მედიანა: ${esc(K.hoursText(fp.medianHours))} რეგისტრაციიდან. „აპში დაბრუნდა“ — ცხოველის დამატების შემდეგ სხვა დღეს გახსნა აპი (ნებისმიერი გვერდი).`)}`);
  }

  function careCard(d) {
    const c = d.care;
    const p = c.plans;
    const title = 'მოვლა და შეხსენებები';
    const sub = 'რას იწერენ ცხოველზე და მუშაობს თუ არა შეხსენება.';
    const any = c.weight.logs + c.allergies.total + c.conditions.total + c.products.total + p.total + c.events.recorded + c.events.skipped + c.delivery.SCHEDULED_LOCAL;
    if (!any) return card(title, sub, empty('ცხოველზე წონა, ჯანმრთელობა ან მოვლა ჯერ არავის ჩაუწერია.'));
    const allergyCats = joinCounts(c.allergies.categories, ALLERGY);
    const kinds = (obj) => K.chips(Object.entries(obj).map(([k, n]) => [KINDS[k] || 'სხვა მოვლა', n]));
    const records = facts([
      ['წონის ჩანაწერი', `${fmt(c.weight.logs)}${extras([['ცხოველი', c.weight.pets], ['ორი და მეტი აწონვით', c.weight.trackedPets]])}`],
      ['ალერგია', `${fmt(c.allergies.total)}${extras([['ცხოველი', c.allergies.pets], ['ვეტერინარის დადასტურებული', c.allergies.confirmed]])}${allergyCats ? ` <small class="s-muted">· ${esc(allergyCats)}</small>` : ''}`],
      ['ჯანმრთელობის მდგომარეობა', `${fmt(c.conditions.total)}${extras([['ახლა აქტიური', c.conditions.active], ['ვეტერინარის დადასტურებული', c.conditions.confirmed]])}`],
      ['მოვლის საშუალება', fmt(c.products.total)],
    ]) + kinds(c.products.kinds);
    const plans = p.total
      ? facts([
        ['აქტიური გეგმა', `${fmt(p.status.ACTIVE)}${extras([['ცხოველი', p.pets], ['დასრულდა', p.status.COMPLETED], ['გაუქმდა', p.status.CANCELLED]])}`],
        ['შეხსენება ჩართულია', `${fmt(p.remindersOn)} <small class="s-muted">· ${pct(share(p.remindersOn, p.status.ACTIVE))} აქტიურიდან</small>`],
        ['ვადა გაუვიდა', p.overdue ? `${warn(p.overdue)} <small class="s-muted">· მონიშვნას ელოდება</small>` : '0'],
        ['მომდევნო 7 დღეში', fmt(p.dueSoon)],
        ['რა სიხშირით', esc(joinCounts(p.recurrence, RECURRENCE) || '—')],
        ['ვინ დანიშნა', esc(joinCounts(p.sources, SOURCES) || '—')],
      ]) + kinds(p.kinds)
      : '<p class="p2-note">მოვლის გეგმა (ვაქცინა, ჭიებისგან დამუშავება, წამალი…) ჯერ არავის შეუქმნია.</p>';
    const done = c.events.recorded + c.events.skipped + c.delivery.SCHEDULED_LOCAL
      ? `${h4('შესრულება და შეხსენებები')}${facts([
        ['მონიშნა „გავაკეთე“', `${fmt(c.events.recorded)}${extras([['შეხსენებიდან', c.events.fromReminder]])}`],
        ['გამოტოვა', fmt(c.events.skipped)],
        ['ტელეფონზე დაგეგმილი შეხსენება', `${fmt(c.delivery.SCHEDULED_LOCAL)}${extras([['ადამიანი', c.delivery.users], ['ვერ დაიგეგმა', c.delivery.SCHEDULE_FAILED]])}`],
        ['შეხსენებაზე უპასუხა', fmt(c.delivery.USER_RESPONSE + c.delivery.COMPLETION_CONFIRMED)],
      ])}${note('შეხსენება ლოკალურია: ტელეფონი თვითონ გეგმავს და სერვერს მხოლოდ ატყობინებს. „დაგეგმილი“ არ ნიშნავს, რომ შეტყობინება ეკრანზე გამოჩნდა.')}`
      : '';
    return card(title, sub, `${records}${h4('მოვლის გეგმები')}${plans}${done}`);
  }

  function vetCard(d) {
    const v = d.vet;
    const a = v.ai;
    const sec = (ms) => (ms == null ? '—' : `${(ms / 1000).toLocaleString('ka-GE', { maximumFractionDigits: 1 })} წმ`);
    const body = !v.questions
      ? `${empty(d.includeTeam ? 'MEDIVET-ისთვის ჯერ არავის უკითხავს.' : 'MEDIVET-ისთვის ჯერ არცერთ რეალურ მომხმარებელს არ უკითხავს.')}
        ${v.openedSessions ? note(`საუბარი გაიხსნა ${fmt(v.openedSessions)}-ჯერ, კითხვის გარეშე.`) : ''}`
      : `${facts([
        ['ადამიანი', `${fmt(v.users)} <small class="s-muted">· ${fmt(v.pets)} ცხოველზე</small>`],
        ['კითხვა', `${fmt(v.questions)} <small class="s-muted">· ${fmt(v.sessions)} საუბარში, საშუალოდ ${v.perSession == null ? '—' : v.perSession.toLocaleString('ka-GE')}</small>`],
        ['პასუხი', `${fmt(v.answers.COMPLETE)}${extras([['ვერ გაეცა', v.answers.FAILED], ['შეწყდა', v.answers.CANCELLED]])}`],
        ['ბოლო კითხვა', esc(when(v.lastAt))],
        ['პასუხის დრო', `${sec(a.avgMs)} <small class="s-muted">· p95 ${sec(a.p95Ms)}</small>`],
        ['AI შეცდომა', warn(a.errors)],
        ['ხარჯი', `$${(a.costUsd || 0).toLocaleString('en-US', { maximumFractionDigits: 3 })}`],
        ['შეფასება', `${fmt(v.feedback.up)} სასარგებლო · ${fmt(v.feedback.down)} არა`],
        ['მოვლის გეგმის შეთავაზება', fmt(v.drafts)],
        ['სასწრაფო ნიშნები კითხვაში', warn(v.safety.emergency)],
        ['დოზას ითხოვდა', fmt(v.safety.dose)],
      ])}
      ${h4('რაზე ეკითხებიან')}
      ${v.topics.length ? shares(v.topics.map((t) => [TOPICS[t.key] || 'სხვა თემა', t.count]), v.topicSample || 1) : ''}
      ${note(`თემები ითვლება საკვანძო სიტყვებით (მიახლოებით, ბოლო ${fmt(v.topicSample)} კითხვიდან); ერთი კითხვა შეიძლება რამდენიმე თემას ეხებოდეს. თავად ტექსტი აქ არ ჩანს.`)}`;
    const action = `<button type="button" class="btn ghost compact" data-vet-log>${K.ico('message')} საუბრები Medi-ში</button>`;
    return card('MEDIVET', 'ცხოველების AI: რამდენი ეკითხება, რაზე და როგორ პასუხობს.', `${K.flagCallout(d.flags.mediVet, '<b>MEDIVET შეჩერებულია.</b>')}${body}`, { action });
  }

  function paint(d, ctx) {
    const t = d.totals;
    const idleShare = share(t.onlyProfile, t.owners);
    wall.set(d.pets, { total: d.petsTotal });
    return `${K.flagCallout(d.flags.pets, '<b>„ჩემი ცხოველები“ შეჩერებულია.</b> ახალი ჩანაწერი ვერ ინახება.')}
      ${insights(d)}
      ${metrics([
        metric('ცხოველის პატრონი', fmt(t.owners), `ანგარიშების ${pct(t.ownerRate)} · ${fmt(t.accounts)}-დან`),
        metric('ცხოველი', fmt(t.petsActive), t.petsArchived ? `აქტიური · ${fmt(t.petsArchived)} არქივში` : 'აქტიური'),
        metric('მხოლოდ დაამატა', fmt(t.onlyProfile), `${pct(idleShare)} პატრონებიდან · მეტი არაფერი`, idleShare >= 50 ? 'warn' : ''),
        metric('MEDIVET-ს ჰკითხა', fmt(d.vet.users), `${fmt(d.vet.questions)} კითხვა`),
      ])}
      ${card('ცხოველის დამატებიდან MEDIVET-მდე', 'რამდენმა პატრონმა გამოიყენა თითო შესაძლებლობა, მთელი დროის განმავლობაში. „ჩაწერა რამე“ — წონა, ალერგია, მდგომარეობა ან მოვლა; „დაბრუნდა სხვა დღეს“ — ცხოველებში რამე გააკეთა ორ სხვადასხვა დღეს. % ითვლება ყველა პატრონიდან.',
        K.ladder(d.ladder, LADDER, { first: 'ყველა პატრონი', unit: 'პატრონებიდან', emptyText: 'ცხოველი ჯერ არავის დაუმატებია.' }))}
      ${wall.html()}
      ${periodBlock(d, ctx)}
      ${K.split(compositionCard(d), ownersCard(d))}
      ${K.split(careCard(d), vetCard(d))}
      ${K.definitions([
        '<b>პატრონი</b> — ანგარიში, რომელსაც ერთი ცხოველი მაინც დაუმატებია (არქივშიც). <b>აქტიური პატრონი</b> — ვინც პერიოდში ცხოველს დაამატა ან შეცვალა, ჩაწერა წონა, ჯანმრთელობა ან მოვლა, გამოტოვა მოვლა ან ჰკითხა MEDIVET-ს.',
        '<b>დაბრუნდა სხვა დღეს</b> — ცხოველებში რამე გააკეთა ორ სხვადასხვა დღეს მაინც (თბილისის დროით). აპის უბრალოდ გახსნა აქ არ ითვლება — ის ცალკეა: „აპში დაბრუნდა“.',
        '<b>გუნდი</b> — ზუსტად @medicard.ge ელფოსტით შესული ანგარიშები (დემო და თანამშრომლები). ტელეფონით და Apple-ით შესულები ჩვეულებრივი მომხმარებლები არიან.',
        'ეკრანების ნახვას აპი ცალკე არ აგზავნის, ამიტომ „გახსნა და დაბრუნდა“ ჩანს მხოლოდ ჩანაწერებით. კონფიდენციალობა: აქ არ ჩანს MEDIVET-ის ტექსტი, ალერგიის და მდგომარეობის სახელები, შენიშვნები და ფოტოები.',
      ])}`;
  }

  function after(root) {
    wall.bind(root);
    root.querySelector('[data-vet-log]')?.addEventListener('click', () => {
      // Medi's log (#/ai) keeps its filter in admin.js `aiLog`; open it on MEDIVET.
      if (typeof aiLog === 'object' && aiLog) Object.assign(aiLog, { mode: 'VET', status: '', offset: 0 });
      if (global.renderAiHost) void global.renderAiHost.select('quality', { fresh: true });
      else {
        const ai = document.getElementById('tab-ai');
        if (ai) ai.innerHTML = '';
      }
      location.hash = '#/ai';
    });
  }

  const renderPetsAdmin = K.page({ tab: 'pets', path: '/pets/overview', capability: 'PETS_VIEW', paint, after });
  global.renderPetsAdmin = renderPetsAdmin;
  global.AdminV4Pets = { renderPetsAdmin };
})(window);
