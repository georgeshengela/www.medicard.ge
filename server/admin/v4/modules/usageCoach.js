/**
 * MediCard Admin V4 — #/trainers „ანალიზი“ MEDICOACH (/api/admin/usage/coach/overview), on the usage kit (usageKit.js).
 * Who applies as a trainer, who gets verified, finds clients, holds sessions and sends meal plans; how many people
 * are linked to a trainer and what they share — counts only. The moderation views of the same tab (applications,
 * gyms, reports in trainers.js) stay as they are. Never client names on a trainer card, never what a client shares
 * (weight, food, workouts, photos), meal-plan contents, session notes, report text or certificate files.
 */
(function adminV4CoachUsage(global) {
  const K = global.AdminUsage;
  if (!K) return;
  const { esc, fmt, pct, share, when, metric, metrics, card, facts, shares, extras, empty, note, h4, warn, chips } = K;

  K.glyphs({
    coachDumbbell: '<path d="M6.5 6.5v11M17.5 6.5v11M3.5 9.5v5M20.5 9.5v5M6.5 12h11"/>',
  });

  const STATUS = { PENDING: ['განიხილება', 'is-warn'], VERIFIED: ['დადასტურებული', 'is-ok'], REJECTED: ['უარყოფილი', 'is-bad'], SUSPENDED: ['შეჩერებული', 'is-bad'] };
  const SPECIALTIES = {
    weight_loss: 'წონის კლება', muscle: 'კუნთის მატება', strength: 'ძალა', functional: 'ფუნქციური ვარჯიში', crossfit: 'კროსფიტი',
    cardio: 'კარდიო / გამძლეობა', mobility: 'მოქნილობა და მობილობა', rehab: 'რეაბილიტაცია', boxing: 'ბოქსი / საბრძოლო',
    yoga: 'იოგა / პილატესი', women: 'ქალის ფიტნესი', seniors: 'ხანდაზმულები', nutrition: 'კვების დაგეგმვა', sport: 'სპორტული მომზადება',
  };
  const KINDS = { STRENGTH: 'ძალოვანი', CARDIO: 'კარდიო', HIIT: 'HIIT', FUNCTIONAL: 'ფუნქციური', MOBILITY: 'მობილობა', ASSESSMENT: 'შეფასება / გაზომვა', ONLINE: 'ონლაინ' };
  const SCOPES = { workouts: 'ვარჯიშები და აქტივობა', nutrition: 'კვება', weight: 'წონა და მიზანი', photos: 'პროგრეს-ფოტოები' };
  const REASONS = {
    harassment: 'შეურაცხყოფა ან შევიწროება', inappropriate: 'შეუფერებელი შინაარსი', unsafe: 'სახიფათო რჩევა',
    spam: 'სპამი ან რეკლამა', impersonation: 'ყალბი პროფილი ან სერტიფიკატი', other: 'სხვა',
  };
  const BY = { CLIENT: 'კლიენტმა', TRAINER: 'ტრენერმა', ADMIN: 'ადმინმა' };
  const PROFILE_PARTS = { photo: 'ფოტო', bio: 'აღწერა', specialties: 'სპეციალობა', experience: 'გამოცდილება', certificate: 'სერტიფიკატი', gym: 'დარბაზი' };
  const EXPERIENCE = { upTo2: '0–2 წელი', upTo5: '3–5 წელი', upTo10: '6–10 წელი', more: '10 წელზე მეტი', unknown: 'არ მიუთითა' };
  const LADDER = {
    applied: 'გაგზავნა განაცხადი', verified: 'დადასტურდა', client: 'პირველი კლიენტი',
    session: 'ჩაატარა ვარჯიში', deep: '3+ ვარჯიში ან გეგმა', returned: 'დაბრუნდა სხვა დღეს',
  };
  const TRACK = ['პროფილი', 'დადასტურება', 'კლიენტი', 'ვარჯიში', 'კვების გეგმა', 'შეტყობინების გარეშე'];
  const joinCounts = (obj, names) => Object.entries(obj || {}).filter(([, n]) => n > 0).map(([k, n]) => `${names[k] || 'სხვა'} ${fmt(n)}`).join(' · ');
  const badge = (key) => `<span class="s-badge ${(STATUS[key] || ['', 'is-plain'])[1]}">${esc((STATUS[key] || ['სხვა'])[0])}</span>`;

  const working = (t) => t.usage.clientsEver > 0 || t.usage.sessions > 0;

  function summary(t) {
    const u = t.usage;
    if (t.status === 'PENDING') return { text: `განაცხადი განიხილება · ელოდება ${K.hoursText(t.waitHours)}`, idle: true };
    if (t.status === 'REJECTED') return { text: 'განაცხადი უარყოფილია — ტრენერმა უნდა გაასწოროს და ხელახლა გაგზავნოს', idle: true };
    const parts = [
      u.clientsEver && `კლიენტი ${fmt(u.clients)}${u.clientsEver !== u.clients ? ` (სულ ${fmt(u.clientsEver)})` : ''}`,
      u.sessions && `ჩატარდა ${fmt(u.sessions)} ვარჯიში`,
      u.upcoming && `დაგეგმილი ${fmt(u.upcoming)}`,
      u.plans && `კვების გეგმა ${fmt(u.plans)}`,
      u.requests && `მოთხოვნა ${fmt(u.requests)}`,
      u.invites && `მოწვევა ${fmt(u.invites)}`,
      u.openSlots && `თავისუფალი დრო ${fmt(u.openSlots)}`,
    ].filter(Boolean);
    if (t.status === 'SUSPENDED') return { text: `შეჩერებულია${parts.length ? ` · ${parts.join(' · ')}` : ''}`, idle: true };
    if (!parts.length) {
      return { text: `დადასტურებულია · კლიენტი ჯერ არ ჰყავს${u.expiredSlots ? ` · ${fmt(u.expiredSlots)} თავისუფალი დრო უკვე გავიდა` : ''}`, idle: true };
    }
    return { text: parts.join(' · '), idle: false };
  }

  function trainerCard(t) {
    const u = t.usage;
    const filled = Object.values(t.profile || {}).filter(Boolean).length;
    const missing = Object.entries(t.profile || {}).filter(([, v]) => !v).map(([k]) => PROFILE_PARTS[k]);
    const gym = t.gyms[0] ? `${t.gyms[0].label}${t.gyms.length > 1 ? ` +${t.gyms.length - 1}` : ''}` : '';
    const line = summary(t);
    const verified = t.status === 'VERIFIED';
    return K.itemCard({
      glyph: 'coachDumbbell',
      title: t.name,
      meta: [gym, t.experienceYears != null ? `${fmt(t.experienceYears)} წლის გამოცდილება` : '', SPECIALTIES[t.specialties[0]] || ''].filter(Boolean).join(' · '),
      badges: `${badge(t.status)}${t.team ? '<span class="s-badge is-info">გუნდი</span>' : ''}${u.reportsOpen ? `<span class="s-badge is-bad">შეტყობინება ${fmt(u.reportsOpen)}</span>` : ''}`,
      track: K.track([
        { fill: Math.round((filled / 6) * 100), title: `პროფილი ${filled}/6${missing.length ? ` · აკლია: ${missing.join(', ')}` : ''}` },
        { fill: verified ? 100 : 0, title: verified ? `დადასტურდა ${when(t.verifiedAt, 'date')}` : `სტატუსი: ${(STATUS[t.status] || ['სხვა'])[0]}` },
        { fill: u.clientsEver ? 100 : 0, title: `კლიენტი: ახლა ${fmt(u.clients)}, სულ ${fmt(u.clientsEver)}` },
        { fill: Math.min(100, Math.round((u.sessions / 3) * 100)), title: `ჩატარებული ვარჯიში: ${fmt(u.sessions)} (სამი — სავსე)` },
        { fill: u.plans ? 100 : 0, title: `კვების გეგმა: ${fmt(u.plans)}` },
        { fill: u.reports ? 0 : 100, title: u.reports ? `შეტყობინება: ${fmt(u.reports)}${u.blocks ? ` · დაბლოკა ${fmt(u.blocks)}` : ''}` : 'შეტყობინება არ ყოფილა' },
      ]),
      line: line.text,
      idle: line.idle,
      person: t.person,
      foot: [`განაცხადი ${when(t.submittedAt, 'date')}`, t.person?.lastSeenAt ? `აპში ${when(t.person.lastSeenAt)}` : 'აპში ჯერ არ ჩანს'],
      dim: t.status === 'REJECTED' || t.status === 'SUSPENDED',
    });
  }

  const wall = K.createWall({
    title: 'ტრენერები და რას აკეთებენ',
    sub: 'თითო ბარათი ერთი ტრენერია. ზოლი: პროფილის სისრულე, დადასტურება, კლიენტი, ჩატარებული ვარჯიში (სამი — სავსე), კვების გეგმა და შეტყობინების გარეშე ისტორია. კლიენტების სახელები აქ არ ჩანს — მხოლოდ რაოდენობა. ახალი აქტივობა პირველია.',
    legendLabels: TRACK,
    filters: [
      ['all', 'ყველა', () => true],
      ['pending', 'განიხილება', (t) => t.status === 'PENDING'],
      ['waiting', 'კლიენტის გარეშე', (t) => t.status === 'VERIFIED' && !t.usage.clientsEver],
      ['working', 'მუშაობს', working],
      ['reports', 'შეტყობინებით', (t) => t.usage.reports > 0],
      ['stopped', 'უარყოფილი / შეჩერებული', (t) => t.status === 'REJECTED' || t.status === 'SUSPENDED'],
    ],
    search: (t) => `${t.name} ${t.person?.name || ''} ${t.person?.contact || ''} ${t.gyms.map((g) => g.label).join(' ')}`,
    placeholder: 'ტრენერი, სახელი, ტელეფონი ან დარბაზი',
    render: trainerCard,
    emptyText: {
      all: 'ტრენერის განაცხადი ჯერ არავის გაუგზავნია. აქ გამოჩნდება თითო ტრენერი: სტატუსი, პროფილის სისრულე, რამდენი კლიენტი ჰყავს, რამდენი ვარჯიში ჩაატარა და კვების გეგმა გაუგზავნა თუ არა.',
      pending: 'განხილვას არცერთი განაცხადი არ ელოდება.',
      waiting: 'კლიენტის გარეშე დადასტურებული ტრენერი არ არის.',
      working: 'კლიენტთან ჯერ არცერთი ტრენერი არ მუშაობს.',
      reports: 'ტრენერზე შეტყობინება არ შემოსულა.',
      stopped: 'უარყოფილი ან შეჩერებული ტრენერი არ არის.',
    },
  });

  function insights(d) {
    const t = d.totals;
    const L = Object.fromEntries(d.ladder.map((s) => [s.key, s.count]));
    const c = d.clients;
    const s = d.sessions;
    const real = d.includeTeam ? '' : 'რეალურ ';
    const rows = []; // a paused module is the callout above the insights, not repeated here
    if (!t.trainers) {
      rows.push(['warn', `<b>ტრენერის განაცხადი ჯერ არცერთ ${real}მომხმარებელს არ გაუგზავნია.</b> MEDICOACH ტრენერით იწყება: სანამ დადასტურებული ტრენერი არ არის, კლიენტს დასაკავშირებელი არავინ ჰყავს.`]);
      rows.push(['info', 'შემდეგი ნაბიჯი — მოიწვიე ტრენერები. განაცხადი აპშია: პროფილი → „ფიტნესი · MEDICOACH“ → „ტრენერი ხარ?“ (საჭიროა დადასტურებული ტელეფონი და 18+). განაცხადი აქვე, „ტრენერები“ ხედში გამოჩნდება დასადასტურებლად.']);
    } else {
      rows.push(['info', `<b>${fmt(t.trainers)} ტრენერმა</b> გაგზავნა განაცხადი — დადასტურებულია ${fmt(t.verified)}${t.pending ? `, განიხილება ${fmt(t.pending)}` : ''}${t.rejected ? `, უარყოფილია ${fmt(t.rejected)}` : ''}.`]);
      if (t.pending) {
        const r = d.review;
        rows.push([r.pendingOverdue ? 'warn' : 'info', `<b>${fmt(t.pending)} განაცხადი ელოდება პასუხს</b>${r.oldestPendingHours != null ? ` — ყველაზე ძველი ${esc(K.hoursText(r.oldestPendingHours))}` : ''}. ტრენერს 1–2 სამუშაო დღეს ვპირდებით${r.pendingOverdue ? `; ${fmt(r.pendingOverdue)} უკვე 2 დღეზე მეტია ელოდება` : ''}.`]);
      }
      if (t.verified && !L.client) rows.push(['warn', `დადასტურებულ ტრენერებს (${fmt(t.verified)}) კლიენტი ჯერ არცერთს არ ჰყავს.`]);
      else if (t.verifiedNoClients) rows.push(['info', `${fmt(t.verifiedNoClients)} დადასტურებულ ტრენერს კლიენტი ჯერ არ ჰყავს.`]);
      if (c.ever) {
        const shared = joinCounts(c.scopes, SCOPES);
        rows.push(['ok', `<b>${fmt(c.ever)} ადამიანი</b> დაუკავშირდა ტრენერს, ახლა აქტიურია ${fmt(c.active)}.${shared ? ` აქტიურები უზიარებენ: ${esc(shared)}.` : c.active ? ' აქტიური კლიენტები ჯერ არაფერს უზიარებენ — მხოლოდ ვარჯიშის განრიგი ჩანს.' : ''}`]);
      }
      if (s.status.DONE) rows.push(['ok', `ჩატარდა <b>${fmt(s.status.DONE)} ვარჯიში</b>${s.status.NO_SHOW ? ` — ${fmt(s.status.NO_SHOW)}-ზე კლიენტი არ მოვიდა (${pct(s.noShowRate)})` : ''}${d.plans.total ? `; კვების გეგმა გაეგზავნა ${fmt(d.plans.clients)} კლიენტს` : ''}.`]);
      if (s.status.unmarked) rows.push(['warn', `${fmt(s.status.unmarked)} ვარჯიშის დრო გავიდა, მაგრამ ტრენერს არ მოუნიშნავს, ჩატარდა თუ არა.`]);
      if (s.slots.expired && !s.slots.future && t.verified) rows.push(['warn', `${fmt(s.slots.expired)} თავისუფალი დრო უკვე წარსულშია და ახალი არ არის — კლიენტს დასაჯავშნი არაფერი აქვს.`]);
    }
    if (d.safety.reports.open) rows.push(['warn', `<b>${fmt(d.safety.reports.open)} შეტყობინება ელოდება განხილვას</b> — „ტრენერები“ → „შეტყობინებები“.`]);
    if (!c.ever && c.qr.people) rows.push(['muted', `${fmt(c.qr.people)} ადამიანმა გახსნა „ჩემი QR“ — კოდი, რომელსაც ტრენერი ასკანერებს კლიენტის მოსაწვევად. ტრენერთან ჯერ არცერთი არ დაკავშირებულა.`]);
    const team = d.team.trainers ? `${fmt(d.team.trainers)} ტრენერი${d.team.sessions ? `, ${fmt(d.team.sessions)} ვარჯიში / თავისუფალი დრო` : ''}` : '';
    rows.push(K.teamInsight(d, team));
    return K.insights(rows);
  }

  function periodBlock(d, ctx) {
    const p = d.period;
    const lost = [p.noShow && `${fmt(p.noShow)} არ მოვიდა`, p.cancelled && `${fmt(p.cancelled)} გაუქმდა`].filter(Boolean).join(' · ');
    return `${K.periodTitle(p, ctx.days)}
      ${metrics([
        metric('ახალი განაცხადი', fmt(p.applications), `${fmt(p.verified)} დადასტურდა`),
        metric('ახალი კავშირი', fmt(p.newLinks), `${fmt(p.requests)} მოთხოვნა და მოწვევა`),
        metric('ჩატარებული ვარჯიში', fmt(p.held), lost || `${fmt(p.scheduled)} დაინიშნა`),
        metric('აქტიური ადამიანი', fmt(p.activePeople), `${fmt(p.activeTrainers)} ტრენერი · ${fmt(p.activeClients)} კლიენტი`),
      ])}
      ${card('დღიური ტრენდი', 'დანიშნული ვარჯიშები და თავისუფალი დრო (როდის შეიქმნა), ჩატარებული ვარჯიშები (ვარჯიშის დღით) და ვინც იმ დღეს MEDICOACH-ში რამე გააკეთა — თბილისის დღეების მიხედვით.', `${K.chart([
        { label: 'დაინიშნა', tone: 'blue', points: p.trend.scheduled },
        { label: 'აქტიური ადამიანი', tone: 'teal', points: p.trend.active },
        { label: 'ჩატარდა', tone: 'violet', points: p.trend.held },
      ], { label: 'MEDICOACH დღეების მიხედვით', empty: 'ამ პერიოდში MEDICOACH-ში არაფერი მომხდარა.' })}
        ${note(`ამ პერიოდში ${fmt(p.signups)} ახალი ანგარიში შეიქმნა; მათგან ${fmt(p.signupsJoined)} გახდა ტრენერი ან ტრენერის კლიენტი${p.signupRate != null ? ` (${pct(p.signupRate)})` : ''}. ${p.plans ? `კვების გეგმა: ${fmt(p.plans)}.` : ''}`)}`)}`;
  }

  function reviewCard(d) {
    const r = d.review;
    const n = d.totals.trainers;
    const title = 'განაცხადები და პროფილები';
    const sub = 'რამდენ ხანს ელოდებიან პასუხს, რას ავსებენ პროფილში და რა სპეციალობით მოდიან.';
    if (!n) return card(title, sub, empty('განაცხადი ჯერ არ არის. აქ გამოჩნდება: რამდენი ელოდება პასუხს და რამდენ ხანს, რა სწრაფად პასუხობ, რას ავსებენ პროფილში (ფოტო, სერტიფიკატი, დარბაზი…) და რა სპეციალობები აქვთ.'));
    return card(title, sub, `
      ${facts([
        ['ელოდება პასუხს', r.pending ? `${r.pendingOverdue ? warn(r.pending) : fmt(r.pending)}${r.oldestPendingHours != null ? ` <small class="s-muted">· ყველაზე ძველი ${esc(K.hoursText(r.oldestPendingHours))}</small>` : ''}` : '0'],
        ['პასუხი გაეცა', `${fmt(r.answered)}${r.medianAnswerHours != null ? ` <small class="s-muted">· მედიანა ${esc(K.hoursText(r.medianAnswerHours))} განაცხადიდან</small>` : ''}`],
        ['სტატუსი ახლა', esc(joinCounts(r.status, Object.fromEntries(Object.entries(STATUS).map(([k, v]) => [k, v[0]]))) || '—')],
        ['ოდესმე დადასტურებული', `${fmt(r.everVerified)}${extras([['ოდესმე უარყოფილი', r.rejectedEver]])}`],
        ['სერტიფიკატი', `${fmt(r.certificates.trainers)} ტრენერს <small class="s-muted">· სულ ${fmt(r.certificates.total)} ფაილი</small>`],
      ])}
      ${h4('რა შეავსეს პროფილში')}
      ${shares(Object.entries(PROFILE_PARTS).map(([k, label]) => [label, r.profile[k]]).concat([['Instagram', r.profile.instagram]]), n) || note('პროფილის დამატებითი ველი ჯერ არავის შეუვსია.')}
      ${r.specialties.length ? `${h4('სპეციალობა')}${shares(r.specialties.map((s) => [SPECIALTIES[s.key] || 'სხვა', s.count]), n)}` : ''}
      ${h4('გამოცდილება')}
      ${chips(Object.entries(EXPERIENCE).map(([k, label]) => [label, r.experience[k]])) || note('—')}
      ${note('სერტიფიკატების ფაილები, ბიო და Instagram აქ არ ჩანს — მხოლოდ არის თუ არა. სანახავად: „ტრენერები“ ხედი.')}`);
  }

  function clientsCard(d) {
    const c = d.clients;
    const title = 'კლიენტები';
    const sub = 'ვინ დაუკავშირდა ტრენერს, როგორ და რას უზიარებს — მხოლოდ რაოდენობები.';
    const any = c.ever + c.requested + c.invited + c.photos.people + c.workouts.people + c.qr.people;
    if (!any) return card(title, sub, empty('ტრენერთან ჯერ არავინ დაკავშირებულა. აქ გამოჩნდება: რამდენი ადამიანია დაკავშირებული, როგორ (კოდით, ძებნით თუ ტრენერის QR მოწვევით), რას უზიარებენ ტრენერს, რამდენმა დაასრულა კავშირი და ვინ ინახავს პროგრეს-ფოტოებს.'));
    const linkFacts = c.ever + c.requested + c.invited
      ? facts([
        ['დაკავშირდა ოდესმე', `${fmt(c.ever)} <small class="s-muted">· ანგარიშების ${pct(d.totals.clientRate)}</small>`],
        ['აქტიური კავშირი', fmt(c.active)],
        ['ელოდება ტრენერის პასუხს', fmt(c.requested)],
        ['ელოდება კლიენტის თანხმობას', fmt(c.invited)],
        ['დასრულდა', `${fmt(c.ended)}${extras(Object.entries(c.endedBy).map(([k, n]) => [BY[k] || 'სხვამ', n]))}`],
        ['უარი', fmt(c.declined)],
        ['როგორ დაუკავშირდნენ', esc([c.via.client && `კოდით ან ძებნით ${fmt(c.via.client)}`, c.via.trainer && `ტრენერის QR მოწვევით ${fmt(c.via.trainer)}`].filter(Boolean).join(' · ') || '—')],
        ['დაბრუნდა სხვა დღეს', `${fmt(c.returned)} <small class="s-muted">· ${pct(share(c.returned, c.ever))} დაკავშირებულებიდან</small>`],
        c.perTrainer != null ? ['კლიენტი ერთ ტრენერზე (მედიანა)', fmt(c.perTrainer)] : null,
      ])
      : note('ტრენერთან კავშირი ჯერ არავის აქვს.');
    const shared = c.active
      ? `${h4('რას უზიარებენ (აქტიური კავშირები)')}${shares(Object.entries(SCOPES).map(([k, label]) => [label, c.scopes[k]]), c.active) || ''}
        ${note(`ვარჯიშის განრიგი ტრენერს ყოველთვის ჩანს; დანარჩენს თავად კლიენტი რთავს.${c.sharesNothing ? ` არაფერს უზიარებს ${fmt(c.sharesNothing)}.` : ''}${c.goalsPending ? ` ტრენერის შემოთავაზებული მიზანი ელოდება ${fmt(c.goalsPending)}-ს.` : ''}`)}`
      : '';
    const progress = c.photos.people + c.workouts.people + c.qr.people
      ? `${h4('პროგრესი და QR')}${facts([
        ['პროგრეს-ფოტო', `${fmt(c.photos.people)} ადამიანი <small class="s-muted">· ${fmt(c.photos.total)} ფოტო${c.photos.linked ? `, ტრენერთან დაკავშირებული ${fmt(c.photos.linked)}` : ''}</small>`],
        ['ვარჯიში ტელეფონიდან', `${fmt(c.workouts.people)} ადამიანი <small class="s-muted">· ${fmt(c.workouts.total)} ჩანაწერი</small>`],
        ['გახსნა „ჩემი QR“', fmt(c.qr.people)],
      ])}${note('ფოტოები, ვარჯიშის მონაცემები, წონა და კვება აქ არ ჩანს — მხოლოდ რამდენ ადამიანს აქვს. ვარჯიში ტელეფონიდან (Apple Health / Health Connect) იტვირთება მხოლოდ მაშინ, როცა კლიენტი ტრენერს ვარჯიშებს უზიარებს.')}`
      : '';
    return card(title, sub, `${linkFacts}${shared}${progress}`);
  }

  function sessionsCard(d) {
    const s = d.sessions;
    const p = d.plans;
    const title = 'ვარჯიშები და კვების გეგმები';
    const sub = 'რამდენი დაინიშნა, ჩატარდა, გაცდა ან გაუქმდა; თავისუფალი დრო და კვების გეგმები.';
    if (!s.booked && !s.slots.future && !s.slots.expired && !p.total) {
      return card(title, sub, empty('ვარჯიში ჯერ არავის დაუნიშნავს. აქ გამოჩნდება: ჩატარებული, გაცდენილი და გაუქმებული ვარჯიშები, თავისუფალი დროის ჯავშნები, ვარჯიშის ტიპები, კლიენტის შეფასება და კვების გეგმები.'));
    }
    const booked = s.booked
      ? `${facts([
        ['დაინიშნა', `${fmt(s.booked)} <small class="s-muted">· ${fmt(s.trainers)} ტრენერი, ${fmt(s.clients)} კლიენტი</small>`],
        ['ჩატარდა', `${fmt(s.status.DONE)}${extras([['სავარჯიშოები ჩაწერა', s.withExercises]])}`],
        ['კლიენტი არ მოვიდა', `${fmt(s.status.NO_SHOW)}${s.noShowRate != null ? ` <small class="s-muted">· ${pct(s.noShowRate)} ჩატარებულიდან და გაცდენილიდან</small>` : ''}`],
        ['გაუქმდა', `${fmt(s.status.CANCELLED)}${extras([...Object.entries(s.cancelledBy).map(([k, n]) => [BY[k] || 'სხვამ', n]), ['ბოლო 12 საათში', s.lateCancel]])}`],
        ['მომავალში', fmt(s.status.upcoming)],
        ['დრო გავიდა, არ მოინიშნა', warn(s.status.unmarked)],
        ['კლიენტმა დაადასტურა', `${fmt(s.confirmed)} <small class="s-muted">· ${pct(s.confirmRate)}</small>`],
        ['კვირეული გამეორებით', fmt(s.repeated)],
        ['კლიენტის შეფასება', s.ratings.count ? `${K.num(s.ratings.avg)} / 5 <small class="s-muted">· ${fmt(s.ratings.count)} შეფასება</small>` : '—'],
        ['ხანგრძლივობა (მედიანა)', s.medianMinutes != null ? `${fmt(s.medianMinutes)} წთ` : '—'],
      ])}${h4('ვარჯიშის ტიპი')}${shares(Object.entries(KINDS).map(([k, label]) => [label, s.kinds[k]]), s.booked)}`
      : note('კლიენტისთვის ვარჯიში ჯერ არავის დაუნიშნავს.');
    const slots = s.slots.future + s.slots.expired + s.slots.booked
      ? `${h4('თავისუფალი დრო')}${facts([
        ['ახლა თავისუფალი', fmt(s.slots.future)],
        ['გავიდა ისე, რომ არავინ დაჯავშნა', s.slots.expired ? warn(s.slots.expired) : '0'],
        ['კლიენტმა დაჯავშნა', fmt(s.slots.booked)],
      ])}`
      : '';
    const plans = `${h4('კვების გეგმები')}${p.total
      ? facts([
        ['გეგმა', `${fmt(p.total)}${extras([['აქტიური', p.active]])}`],
        ['ტრენერი / კლიენტი', `${fmt(p.trainers)} / ${fmt(p.clients)}`],
      ])
      : note('კვების გეგმა ჯერ არცერთ ტრენერს არ გაუგზავნია (საჭიროა, კლიენტი კვებას უზიარებდეს).')}${note('გეგმის შინაარსი (კალორიები, კერძები) და ტრენერის შენიშვნები აქ არ ჩანს.')}`;
    return card(title, sub, `${booked}${slots}${plans}`);
  }

  function gymsSafetyCard(d) {
    const g = d.gyms;
    const sf = d.safety;
    const r = sf.reports;
    const directory = facts([
      ['ცნობარში', `${fmt(g.directory.ACTIVE)} აქტიური${extras([['დამალული', g.directory.HIDDEN]])} <small class="s-muted">· ${fmt(g.cities)} ქალაქი</small>`],
      ['ტრენერმა შემოგვთავაზა', `${fmt(g.proposedByTrainers)}${g.waiting ? ` <small class="s-muted">· </small>${warn(g.waiting)} <small class="s-muted">ელოდება დადასტურებას</small>` : ''}`],
      ['დარბაზი, სადაც ტრენერია', fmt(g.withTrainers)],
    ]);
    const top = g.top.length
      ? `${h4('სად ვარჯიშობენ ტრენერები')}${shares(g.top.map((x) => [`${x.label}${x.city ? ` (${x.city})` : ''}`, x.trainers]), Math.max(1, d.totals.trainers - (d.totals.rejected || 0)))}`
      : '';
    const safety = !sf.installed
      ? note('შეტყობინება ან დაბლოკვა ჯერ არავის გაუკეთებია (ცხრილი პირველივე შეტყობინებისას იქმნება).')
      : r.total || sf.blocks
        ? `${facts([
          ['შეტყობინება', `${fmt(r.total)}${extras([['ღიაა', r.open], ['განხილულია', r.resolved]])}`],
          ['ვინ გამოგზავნა', esc([r.roles.CLIENT && `კლიენტმა ტრენერზე ${fmt(r.roles.CLIENT)}`, r.roles.TRAINER && `ტრენერმა კლიენტზე ${fmt(r.roles.TRAINER)}`].filter(Boolean).join(' · ') || '—')],
          ['დაბლოკა', `${fmt(sf.blocks)}${extras([['შეტყობინებასთან ერთად', r.withBlock]])}`],
        ])}${chips(Object.entries(REASONS).map(([k, label]) => [label, r.reasons[k]]))}${note('შეტყობინების ტექსტი აქ არ ჩანს — „ტრენერები“ → „შეტყობინებები“.')}`
        : note('შეტყობინება ან დაბლოკვა არ ყოფილა.');
    return card('დარბაზები და უსაფრთხოება', 'დარბაზების ცნობარი და შეტყობინებები, რომლებსაც კლიენტები და ტრენერები ერთმანეთზე აგზავნიან.', `${directory}${top}${h4('შეტყობინებები და დაბლოკვა')}${safety}`);
  }

  function paint(d, ctx) {
    const t = d.totals;
    wall.set(d.items, { total: d.itemsTotal });
    const since = d.flags.coach?.since;
    return `${K.flagCallout(d.flags.coach, `<b>MEDICOACH შეჩერებულია${since ? ` ${esc(when(since, 'date'))}-დან` : ''}.</b> ტრენერი ვერ გაგზავნის განაცხადს, კლიენტი ვერ დაუკავშირდება და ვარჯიში ვერ დაინიშნება — ამიტომ ახალი ციფრები ვერ გაჩნდება. ნახვა მუშაობს. ჩართვა:`)}
      ${insights(d)}
      ${metrics([
        metric('დადასტურებული ტრენერი', fmt(t.verified), `${fmt(t.trainers)} განაცხადი სულ${t.pending ? ` · ${fmt(t.pending)} განიხილება` : ''}`, d.review.pendingOverdue ? 'warn' : ''),
        metric('აქტიური კლიენტი', fmt(t.clientsActive), `${fmt(t.clientsEver)} დაკავშირდა ოდესმე · ანგარიშების ${pct(t.clientRate)}`),
        metric('ჩატარებული ვარჯიში', fmt(t.sessionsHeld), `${fmt(t.sessionsUpcoming)} დაგეგმილი${t.noShow ? ` · ${fmt(t.noShow)} არ მოვიდა` : ''}`),
        metric('კვების გეგმა', fmt(t.plans), `${fmt(t.plansActive)} აქტიური · ${fmt(t.planClients)} კლიენტს`),
      ])}
      ${card('განაცხადიდან მუშაობამდე', 'რამდენმა ტრენერმა გაიარა თითო ნაბიჯი, მთელი დროის განმავლობაში. „დადასტურდა“ — ადმინმა ერთხელ მაინც დაადასტურა; „პირველი კლიენტი“ — კლიენტმა კავშირი მიიღო; „3+ ვარჯიში ან გეგმა“ — სამი ჩატარებული ვარჯიში ან ერთი კვების გეგმა მაინც; „დაბრუნდა სხვა დღეს“ — ტრენერის როლში რამე გააკეთა ორ სხვადასხვა დღეს. % ითვლება ყველა განაცხადიდან.',
        K.ladder(d.ladder, LADDER, { first: 'ყველა განაცხადი', unit: 'განაცხადებიდან', emptyText: 'ტრენერის განაცხადი ჯერ არავის გაუგზავნია. ნაბიჯები აქ გამოჩნდება პირველი განაცხადის შემდეგ.' }))}
      ${wall.html()}
      ${periodBlock(d, ctx)}
      ${K.split(reviewCard(d), clientsCard(d))}
      ${K.split(sessionsCard(d), gymsSafetyCard(d))}
      ${K.definitions([
        '<b>ტრენერი</b> — ანგარიში, რომელმაც ტრენერის განაცხადი გაგზავნა (ნებისმიერი სტატუსით). <b>დადასტურდა</b> — ადმინმა ერთხელ მაინც დაადასტურა (ადმინის ჟურნალით) ან ახლა დადასტურებულია. <b>ელოდება პასუხს</b> — სტატუსი „განიხილება“; ტრენერს 1–2 სამუშაო დღეს ვპირდებით, 2 დღეზე მეტი გამოიყოფა.',
        '<b>კლიენტი</b> — ვინც ტრენერთან კავშირი მიიღო: ტრენერის კოდით, ძებნით (ტრენერის დადასტურების შემდეგ) ან ტრენერის QR მოწვევაზე თანხმობით. ჯერ მიუღებელი მოთხოვნა და მოწვევა ცალკე ითვლება. <b>აქტიური ადამიანი</b> — ტრენერი ან კლიენტი, ვინც დღეს / პერიოდში MEDICOACH-ში რამე ჩაწერა (განაცხადი, კავშირი, ვარჯიშის დანიშვნა, დადასტურება, მონიშვნა, კვების გეგმა, პროგრეს-ფოტო, შეტყობინება).',
        '<b>ჩატარდა ვარჯიში</b> — ტრენერმა მონიშნა „ჩატარდა“; „არ მოვიდა“ — მონიშნა, რომ კლიენტი არ მოვიდა. <b>დრო გავიდა, არ მოინიშნა</b> — დაგეგმილი ვარჯიშის დრო გავიდა, მონიშვნა არ არის. <b>თავისუფალი დრო</b> — ტრენერის გამოქვეყნებული დრო, რომელსაც მისი კლიენტი ჯავშნის.',
        '<b>დაბრუნდა სხვა დღეს</b> — ტრენერის როლში (განაცხადი, სერტიფიკატი, მოწვევა, ვარჯიში, მონიშვნა, კვების გეგმა, მიზანი) რამე გააკეთა ორ სხვადასხვა დღეს მაინც, თბილისის დროით. ეკრანების ნახვას აპი ცალკე არ აგზავნის, ამიტომ ითვლება მხოლოდ შენახული ჩანაწერები. <b>„ჩემი QR“</b> — პირადი კოდი იქმნება, როცა ადამიანი მას პირველად გახსნის.',
        '<b>გუნდი</b> — ზუსტად @medicard.ge ელფოსტით შესული ანგარიშები (App Review-ს დემო ტრენერი და თანამშრომლები); კავშირი, ვარჯიში და შეტყობინება გამოირიცხება, თუ ერთი მხარე მაინც გუნდიდანაა. <b>კონფიდენციალობა:</b> ტრენერის ბარათზე კლიენტების სახელები არ ჩანს; არ ჩანს წონა, კვება, ვარჯიშის მონაცემები, ფოტოები, კვების გეგმის შინაარსი, შენიშვნები, მიზნის მნიშვნელობები, შეტყობინების ტექსტი და სერტიფიკატის ფაილები — მხოლოდ რაოდენობები.',
      ])}`;
  }

  function after(root) {
    wall.bind(root);
  }

  global.renderCoachUsage = K.page({ tab: 'trainers', path: '/usage/coach/overview', capability: 'PRODUCT_USAGE_VIEW', paint, after });
})(window);
