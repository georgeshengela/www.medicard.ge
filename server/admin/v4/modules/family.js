/**
 * MediCard Admin V4 — #/family MEDIFAMILY (/api/admin/family/overview), on the usage kit (usageKit.js).
 * How parents use the children's module: the ladder from adding a child to asking Medi, vaccine timeliness on
 * Georgia's calendar (which vaccines are most often late), who the children are (age bands only), day-log and
 * growth use, Medi for children with its urgency levels, and the calendar the app follows with its source.
 * Children's data is the most sensitive in the app: no names, birth dates, contacts, diagnoses or chat text.
 */
(function adminV4Family(global) {
  const K = global.AdminUsage;
  if (!K) return;
  const { esc, fmt, pct, share, metric, metrics, card, facts, shares, empty, note, h4, warn } = K;

  K.glyphs({
    family: '<circle cx="8" cy="6.5" r="2.4"/><circle cx="16.5" cy="8.5" r="1.9"/><path d="M3.8 20v-3.2c0-2.6 1.9-4.6 4.2-4.6s4.2 2 4.2 4.6V20"/><path d="M13.2 20v-2.4c0-2 1.5-3.6 3.3-3.6s3.3 1.6 3.3 3.6V20"/>',
  });

  const LADDER = {
    added: 'დაამატა შვილი', vaccines: 'მონიშნა აცრა', growth: 'ჩაწერა გაზომვა', log: 'დღიური (კვება, სიცხე…)', medi: 'ჰკითხა Medi-ს',
  };
  const AGE = {
    newborn: 'ახალშობილი (< 4 კვ.)', infant_0_6: '1–6 თვე', infant_6_12: '6–12 თვე', toddler: '1–3 წელი', preschool: '3–6 წელი', school: '6–12 წელი', teen: '12–18 წელი',
  };
  const LOG = { FEED: 'კვება', TEMP: 'ტემპერატურა', SYMPTOM: 'სიმპტომი', MED: 'მიცემული წამალი', DIAPER: 'საფენი', NOTE: 'შენიშვნა' };
  const LEVEL = {
    EMERGENCY_NOW: '112 / სასწრაფო ახლავე', SEE_DOCTOR_TODAY: 'ექიმთან დღესვე', SEE_DOCTOR_24H: 'პედიატრთან 24 სთ-ში',
    ROUTINE: 'შემდეგ ვიზიტზე', HOME_CARE: 'სახლში მოვლა', INFO: 'ინფორმაცია (სიმპტომის გარეშე)',
  };

  function insights(d) {
    const t = d.totals;
    const v = d.vaccines;
    const rows = [];
    if (!t.children) {
      rows.push(['info', `შვილი ჯერ არცერთ ${d.includeTeam ? '' : 'რეალურ '}მომხმარებელს არ დაუმატებია.`]);
    } else {
      rows.push(['info', `<b>${fmt(t.parents)} მშობელს</b> დამატებული აქვს <b>${fmt(t.children)} შვილი</b> (საშუალოდ ${esc(String(t.childrenPerParent))}).`]);
      if (v.tracked) {
        const late = v.tracked - v.upToDate;
        rows.push([late ? 'warn' : 'ok', `აცრების ბარათი შევსებულია <b>${fmt(v.tracked)} ბავშვზე</b>; მათგან <b>${pct(v.upToDateRate)}</b> დროულადაა აცრილი${late ? `, ${fmt(late)} ბავშვს გადაცილებული დოზა აქვს` : ''}.`]);
        if (v.overdueBy.length) rows.push(['info', `ყველაზე ხშირად გვიანდება: ${v.overdueBy.slice(0, 3).map((r) => `<b>${esc(r.abbr)}</b> (${fmt(r.count)})`).join(', ')}.`]);
      } else {
        rows.push(['warn', 'აცრა ჯერ არცერთ ბავშვზე არ მონიშნულა — ბარათის შევსება მოდულის მთავარი ღირებულებაა.']);
      }
      if (d.medi.levels.EMERGENCY_NOW) rows.push(['warn', `Medi-მ <b>${fmt(d.medi.levels.EMERGENCY_NOW)}-ჯერ</b> ურჩია 112 / სასწრაფო ამ პერიოდში.`]);
    }
    return K.insights(rows);
  }

  function periodBlock(d, ctx) {
    const t = d.totals;
    return `${K.periodTitle(d.period, ctx.days)}
      ${metrics([
        metric('ახალი შვილი', fmt(t.newChildren), 'დამატდა ამ პერიოდში'),
        metric('აცრის ჩანაწერი', fmt(t.dosesInPeriod), 'მონიშნული დოზა'),
        metric('გაზომვა', fmt(t.measurementsInPeriod), 'წონა / სიმაღლე / თავი'),
        metric('Medi-ს კითხვა', fmt(t.questionsInPeriod), `${fmt(t.askedParents)} მშობლისგან`),
      ])}
      ${card('დღიური ტრენდი', 'ახალი შვილები, მონიშნული აცრები, გაზომვები და Medi-ს კითხვები — თბილისის დღეების მიხედვით.', K.chart([
        { label: 'ახალი შვილი', tone: 'amber', points: d.trend.children },
        { label: 'აცრის ჩანაწერი', tone: 'teal', points: d.trend.doses },
        { label: 'გაზომვა', tone: 'blue', points: d.trend.measurements },
        { label: 'Medi-ს კითხვა', tone: 'violet', points: d.trend.questions },
      ], { label: 'MEDIFAMILY დღეების მიხედვით', empty: 'ამ პერიოდში არაფერი მომხდარა.' }))}`;
  }

  function childrenCard(d) {
    const total = d.totals.children;
    if (!total) return card('ვინ არიან ბავშვები', '', empty('შვილი ჯერ არ არის.'));
    return card('ვინ არიან ბავშვები', 'მხოლოდ ასაკობრივი ჯგუფები — სახელი და დაბადების თარიღი აქ არ ჩანს.', `
      ${shares(Object.entries(AGE).map(([k, label]) => [label, d.ageBands[k] || 0]), total)}
      ${h4('სქესი და დაბადება')}
      ${facts([
        ['გოგო / ბიჭი', `${fmt(d.sex.FEMALE)} / ${fmt(d.sex.MALE)}`],
        ['ნაადრევად დაბადებული', `${fmt(d.preterm)} <small class="s-muted">· ${pct(share(d.preterm, total))}</small>`],
      ])}`);
  }

  function vaccinesCard(d) {
    const v = d.vaccines;
    const body = !v.tracked ? empty('აცრების ბარათი ჯერ არავის შეუვსია.') : `
      ${facts([
        ['ბარათი შევსებულია', `${fmt(v.tracked)} ბავშვზე <small class="s-muted">· ${pct(share(v.tracked, d.totals.children))}</small>`],
        ['დროულად აცრილი', `${fmt(v.upToDate)} <small class="s-muted">· ${pct(v.upToDateRate)}</small>`],
        ['მონიშნული დოზა სულ', fmt(d.totals.dosesMarked)],
        ['კალენდრის გარეშე ვაქცინა', fmt(v.extras)],
      ])}
      ${h4('რომელი აცრა გვიანდება')}
      ${v.overdueBy.length ? shares(v.overdueBy.map((r) => [r.abbr, r.count]), Math.max(1, v.tracked)) : note('გადაცილებული დოზა არ არის.')}
      ${note('„დროულად“ = ბავშვს, ვისაც ბარათზე ერთი დოზა მაინც აქვს მონიშნული, გადაცილებული (ვადიდან 30+ დღე) დოზა არ აქვს. ვინც ბარათი არ შეავსო, აქ არ ითვლება.')}`;
    return card('აცრები', 'საქართველოს ეროვნული კალენდრით, აპის ძრავით დათვლილი.', body);
  }

  function useCard(d) {
    const anyLog = Object.values(d.logKinds).some(Boolean);
    return card('რას იწერენ', 'დღიური, საკვები და განვითარება — რაოდენობები, მნიშვნელობების გარეშე.', `
      ${anyLog ? shares(Object.entries(LOG).map(([k, label]) => [label, d.logKinds[k] || 0]), Math.max(1, Object.values(d.logKinds).reduce((a, b) => a + b, 0))) : empty('ამ პერიოდში დღიურში არაფერი ჩაწერილა.')}
      ${h4('საკვები და განვითარება')}
      ${facts([
        ['საკვების მონიშვნა', `${fmt(d.foods.marks)} <small class="s-muted">· ალერგენი ${fmt(d.foods.allergenMarks)}</small>`],
        ['საკვებზე რეაქცია', warn(d.foods.reactions)],
        ['ეტაპის მონიშვნა', `${fmt(d.milestones.marks)} <small class="s-muted">· „ჯერ არა“ ${fmt(d.milestones.notYet)}</small>`],
        ['ალერგია / მდგომარეობა / წამალი', fmt(d.health.items)],
        ['გაზომვა სულ', fmt(d.totals.measurements)],
      ])}`);
  }

  function mediCard(d) {
    const m = d.medi;
    const sec = (ms) => (ms == null ? '—' : `${(ms / 1000).toLocaleString('ka-GE', { maximumFractionDigits: 1 })} წმ`);
    const total = Object.values(m.levels).reduce((a, b) => a + b, 0);
    const body = !m.questions ? empty('ამ პერიოდში Medi-სთვის ბავშვზე არავის უკითხავს.') : `
      ${facts([
        ['კითხვა', `${fmt(m.questions)} <small class="s-muted">· ${fmt(m.sessions)} ახალი საუბარი</small>`],
        ['პასუხი', `${fmt(m.answered)}${m.errors ? ` <small class="s-muted">· შეცდომა ${warn(m.errors)}</small>` : ''}`],
        ['პასუხის დრო (მედიანა)', sec(m.latencyP50)],
      ])}
      ${h4('რა ურჩია (სასწრაფოობის დონე)')}
      ${total ? shares(Object.entries(LEVEL).map(([k, label]) => [label, m.levels[k] || 0]), total) : ''}
      ${note('დონეს ჯერ აპის წესები ადგენს (საშიში ნიშნები, ასაკი, ტემპერატურა), AI-ს შეუძლია მხოლოდ აწიოს. ტექსტი აქ არ ჩანს.')}`;
    const action = '<button type="button" class="btn ghost compact" data-family-medi-log>საუბრები Medi-ში</button>';
    return card('Medi ბავშვისთვის', 'პედიატრიული კითხვები: რამდენი, რა დონის და როგორ პასუხობს.', `${K.flagCallout(d.flags.familyMedi, '<b>Medi ბავშვისთვის შეჩერებულია.</b>')}${body}`, { action });
  }

  function calendarCard(d) {
    const cal = d.calendar;
    const rows = cal.stages.map((s) => [s.label, esc(s.doses.join(' · '))]);
    return card('კალენდარი, რომელსაც აპი მიჰყვება', esc(cal.source.ka), `${facts(rows)}
      ${note(`<a href="${esc(cal.source.url)}" target="_blank" rel="noopener">matsne.gov.ge</a> · შემოწმდა ${esc(cal.source.checkedOn)}. ცვლილებისას (მაგ. აპვ-ის დაწევის ასაკი წლიური დადგენილებით) კალენდარი სერვერზე განახლდება — აპის ბილდი არ სჭირდება.`)}`);
  }

  function paint(d, ctx) {
    const t = d.totals;
    return `${K.flagCallout(d.flags.family, '<b>MEDIFAMILY შეჩერებულია.</b> ახალი ჩანაწერი ვერ ინახება.')}
      ${insights(d)}
      ${metrics([
        metric('მშობელი', fmt(t.parents), `${fmt(t.children)} შვილი`),
        metric('აცრით შევსებული', fmt(d.vaccines.tracked), `${pct(share(d.vaccines.tracked, t.children))} ბავშვებიდან`),
        metric('დროულად აცრილი', pct(d.vaccines.upToDateRate), `${fmt(d.vaccines.upToDate)} / ${fmt(d.vaccines.tracked)}`, d.vaccines.tracked && d.vaccines.upToDateRate < 60 ? 'warn' : ''),
        metric('Medi-ს კითხვა', fmt(d.medi.questions), `ბოლო ${fmt(ctx.days)} დღე`),
      ])}
      ${card('შვილის დამატებიდან Medi-მდე', 'რამდენმა ბავშვმა მიიღო თითო შესაძლებლობა მთელი დროის განმავლობაში. % ითვლება ყველა ბავშვიდან.',
        K.ladder(d.ladder, LADDER, { first: 'ყველა ბავშვი', unit: 'ბავშვებიდან', emptyText: 'შვილი ჯერ არავის დაუმატებია.' }))}
      ${periodBlock(d, ctx)}
      ${K.split(vaccinesCard(d), childrenCard(d))}
      ${K.split(useCard(d), mediCard(d))}
      ${calendarCard(d)}
      ${K.definitions([
        '<b>კონფიდენციალურობა</b> — ბავშვის მონაცემი აპში ყველაზე მგრძნობიარეა: აქ არ ჩანს სახელი, დაბადების თარიღი, მშობლის კონტაქტი, დიაგნოზი, ალერგიის სახელი, გაზომვის მნიშვნელობა ან Medi-ს საუბრის ტექსტი. მხოლოდ რაოდენობები.',
        '<b>გუნდი</b> — ზუსტად @medicard.ge ელფოსტით შესული ანგარიშები აქ არ ითვლება, თუ „გუნდის ჩათვლით“ არ ჩართე.',
        '<b>დროულად აცრილი</b> — ბავშვს, ვისაც ბარათი შევსებული აქვს (ერთი დოზა მაინც), არცერთი დოზა არ აქვს ვადიდან 30 დღეზე მეტით გადაცილებული. დაწევის წესები: სერია თავიდან არ იწყება; როტა 24 კვირამდე, ბცჟ 12 თვემდე, ჰექსა 24 თვემდე.',
      ])}`;
  }

  function after(root) {
    root.querySelector('[data-family-medi-log]')?.addEventListener('click', () => {
      if (typeof aiLog === 'object' && aiLog) Object.assign(aiLog, { mode: 'PEDIATRIC', status: '', offset: 0 });
      if (global.renderAiHost) void global.renderAiHost.select('quality', { fresh: true });
      location.hash = '#/ai';
    });
  }

  const renderFamilyAdmin = K.page({ tab: 'family', path: '/family/overview', capability: 'FAMILY_VIEW', paint, after });
  global.renderFamilyAdmin = renderFamilyAdmin;
  global.AdminV4Family = { renderFamilyAdmin };
})(window);
