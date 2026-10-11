/**
 * MediCard Admin V4 — #/lab MEDILAB + MEDISCAN (/api/admin/usage/lab/overview), on the usage kit (usageKit.js).
 * Who reads lab sheets, imaging („გამოსახულება“) and skin photos, who asks „ამიხსენი“, who keeps tests in MEDILAB
 * and comes back. Counts only: never values, test dates, findings, AI text or images; a test name or a body region
 * shows only when 3+ people share it (the server folds the rest into „სხვა“).
 */
(function adminV4UsageLab(global) {
  const K = global.AdminUsage;
  if (!K) return;
  const { esc, fmt, num, pct, share, when, metric, metrics, card, facts, shares, extras, empty, note, h4, warn } = K;

  K.glyphs({
    labFlask: '<path d="M9 3h6"/><path d="M10 3v6.2L4.6 18.4A1.8 1.8 0 0 0 6.2 21h11.6a1.8 1.8 0 0 0 1.6-2.6L14 9.2V3"/><path d="M7.4 15h9.2"/>',
    scanImage: '<rect x="3.5" y="3.5" width="17" height="17" rx="3"/><path d="M12 6.8v10.4"/><path d="M8.6 9.4c1.1.7 2.2 1 3.4 1s2.3-.3 3.4-1"/><path d="M8.2 13c1.2.8 2.5 1.2 3.8 1.2s2.6-.4 3.8-1.2"/>',
    skinDrop: '<path d="M12 3.5c3.1 3.7 5.6 7 5.6 10.1a5.6 5.6 0 0 1-11.2 0c0-3.1 2.5-6.4 5.6-10.1z"/><path d="M9.6 14.4A2.5 2.5 0 0 0 12 17"/>',
  });

  const LADDER = {
    used: 'გამოიყენა', read: 'შედეგი მიიღო', explained: '„ამიხსენი“',
    saved: 'MEDILAB-შია', twoTests: 'ორი თარიღი', returned: 'დაბრუნდა სხვა დღეს',
  };
  const TRACK = ['ანალიზი', '„ამიხსენი“', 'MEDILAB', 'გამოსახულება', 'კანი', 'მოვლა'];
  const MODES = {
    LAB: '„ამიხსენი“ — ანალიზის ახსნა', LAB_ALIGN: 'სახელების გასწორება', IMAGING: 'გამოსახულება',
    SKIN: 'კანის ფოტო', SKINCARE: 'კანის მოვლის რუტინა',
  };
  const GROUPS = {
    cbc: 'სისხლის საერთო ანალიზი', biochem: 'ბიოქიმია', sugar: 'შაქარი და ინსულინი', lipids: 'ქოლესტერინი და ლიპიდები',
    thyroid: 'ფარისებრი ჯირკვალი', vitamins: 'ვიტამინები და რკინა', hormones: 'ჰორმონები', coagulation: 'სისხლის შედედება', other: 'სხვა',
  };
  const REGIONS = {
    'hip-femur': 'ბარძაყი / თეძო', knee: 'მუხლი', 'tibia-fibula': 'წვივი / ფეხი', 'ankle-foot': 'ტერფი / კოჭი', pelvis: 'მენჯი',
    spine: 'ხერხემალი', chest: 'გულმკერდი', abdomen: 'მუცელი', shoulder: 'მხარი', arm: 'მკლავი / იდაყვი', hand: 'მაჯა / ხელი',
    'head-neck': 'თავი / კისერი', other: 'სხვა',
  };
  const sec = (ms) => (ms == null ? '—' : `${num(ms / 1000)} წმ`);
  const usd = (n) => `$${num(n || 0, 3)}`;

  const reads = (p) => p.usage.lab + p.usage.imaging + p.usage.skin;
  const hasLab = (p) => p.usage.lab > 0 || p.usage.panels > 0;

  function personCard(p) {
    const u = p.usage;
    const seg = (n, title) => ({ fill: n ? 100 : 0, title });
    const glyph = hasLab(p) || u.explain ? 'labFlask' : u.imaging ? 'scanImage' : 'skinDrop';
    const r = reads(p);
    const title = r
      ? `${fmt(r)} წაკითხვა · ${fmt(p.days)} დღე`
      : u.skincare ? `${fmt(u.skincare)} კანის მოვლის რუტინა` : u.explain ? `„ამიხსენი“ ${fmt(u.explain)}` : 'მხოლოდ მცდელობა';
    const meta = u.panels
      ? `MEDILAB-ში ${fmt(u.testDates)} თარიღის ანალიზი${u.panelsExplained ? ' · ახსნით' : ''}`
      : hasLab(p) || u.explain ? 'MEDILAB-ში ახლა არაფერია' : 'ანალიზი არ აუტვირთავს';
    const parts = [
      u.lab && `ანალიზი ${fmt(u.lab)}`,
      u.explain && `„ამიხსენი“ ${fmt(u.explain)}`,
      u.imaging && `გამოსახულება ${fmt(u.imaging)}`,
      u.skin && `კანის ფოტო ${fmt(u.skin)}`,
      u.skincare && `მოვლის რუტინა ${fmt(u.skincare)}`,
      u.align && `სახელების გასწორება ${fmt(u.align)}`,
      u.failed && `შეცდომა ${fmt(u.failed)}`,
    ].filter(Boolean);
    return K.itemCard({
      glyph,
      title,
      meta,
      badges: `${u.testDates >= 2 ? '<span class="s-badge is-ok">დინამიკა</span>' : ''}${u.failed ? `<span class="s-badge is-warn">შეცდომა ${fmt(u.failed)}</span>` : ''}${p.person.team ? '<span class="s-badge is-info">გუნდი</span>' : ''}`,
      track: K.track([
        seg(u.lab, `ანალიზის ფურცელი: ${fmt(u.lab)}`),
        seg(u.explain, `„ამიხსენი“: ${fmt(u.explain)}`),
        { fill: u.testDates >= 2 ? 100 : u.panels ? 50 : 0, title: u.panels ? `MEDILAB: ${fmt(u.testDates)} თარიღის ანალიზი (ორი თარიღი = სავსე)` : 'MEDILAB-ში ანალიზი არ აქვს' },
        seg(u.imaging, `გამოსახულება: ${fmt(u.imaging)}`),
        seg(u.skin, `კანის ფოტო: ${fmt(u.skin)}`),
        seg(u.skincare, `კანის მოვლის რუტინა: ${fmt(u.skincare)}`),
      ]),
      line: parts.length ? parts.join(' · ') : 'შედეგი არ მიუღია',
      idle: !parts.length,
      person: p.person,
      foot: [
        p.lastAt ? `ბოლოს ${when(p.lastAt)}` : '',
        p.person.lastSeenAt ? `აპში ${when(p.person.lastSeenAt)}` : 'აპში ჯერ არ ჩანს',
      ],
    });
  }

  const wall = K.createWall({
    title: 'ადამიანები და რას კითხულობენ',
    sub: 'თითო ბარათი ერთი ადამიანია. ზოლი აჩვენებს, რა გამოიყენა: ანთებული — გამოიყენა, ცარიელი — ჯერ არა; MEDILAB ნახევრადაა ერთი ანალიზით და სავსეა ორი თარიღით. ახალი აქტივობა პირველია.',
    legendLabels: TRACK,
    filters: [
      ['all', 'ყველა', () => true],
      ['lab', 'ანალიზი', hasLab],
      ['explained', '„ამიხსენი“', (p) => p.usage.explain > 0],
      ['image', 'გამოსახულება და კანი', (p) => p.usage.imaging + p.usage.skin > 0],
      ['skincare', 'კანის მოვლა', (p) => p.usage.skincare > 0],
      ['failed', 'შეცდომით', (p) => p.usage.failed > 0],
    ],
    search: (p) => `${p.person.name} ${p.person.contact}`,
    placeholder: 'სახელი, ტელეფონი ან ელფოსტა',
    render: personCard,
    emptyText: {
      all: 'MEDILAB და MEDISCAN ჯერ არავის გამოუყენებია.', lab: 'ანალიზი ჯერ არავის წაუკითხავს.',
      explained: '„ამიხსენი“ ჯერ არავის დაუჭერია.', image: 'გამოსახულება ან კანის ფოტო ჯერ არავის აუტვირთავს.',
      skincare: 'კანის მოვლის რუტინა ჯერ არავის შეუდგენია.', failed: 'AI-ის შეცდომა არავის შეხვედრია.',
    },
  });

  function insights(d) {
    const t = d.totals;
    const lab = d.lab;
    const rows = [];
    if (!t.users) {
      rows.push(['info', `MEDILAB და MEDISCAN ჯერ არცერთ ${d.includeTeam ? '' : 'რეალურ '}მომხმარებელს არ გამოუყენებია.`]);
    } else {
      const kinds = [
        t.labUsers && `ანალიზის ფურცელი — ${fmt(t.labUsers)}`,
        t.imagingUsers && `გამოსახულება — ${fmt(t.imagingUsers)}`,
        t.skinUsers && `კანის ფოტო — ${fmt(t.skinUsers)}`,
        t.skincareUsers && `კანის მოვლის რუტინა — ${fmt(t.skincareUsers)}`,
      ].filter(Boolean);
      rows.push(['info', `<b>${fmt(t.users)} ადამიანმა</b> გამოიყენა MEDILAB / MEDISCAN — ${fmt(t.accounts)} ანგარიშის ${pct(t.userRate)}.${kinds.length ? ` ${esc(kinds.join(', '))} ადამიანი.` : ''}${!t.imagingUsers && !t.skinUsers ? ' <b>გამოსახულება და კანის ფოტო ჯერ არავის აუტვირთავს.</b>' : ''}`]);
      if (lab.people) {
        const tone = lab.explainRate >= 50 ? 'ok' : 'warn';
        rows.push([tone, `ანალიზის მქონეთა <b>${pct(lab.explainRate)}</b> დააჭირა „ამიხსენი“-ს — სულ ${fmt(t.explanations)} ახსნა${lab.panelsExplained ? `, ${fmt(lab.panelsExplained)} MEDILAB-ში ახსნით ინახება` : ''}.`]);
      }
      if (t.panelUsers && !t.twoTests) rows.push(['warn', `<b>ორი თარიღის ანალიზი MEDILAB-ში ჯერ არავის აქვს</b> — დინამიკა და „რა შეიცვალა“ ჯერ არავის უნახავს. ${fmt(t.panelUsers)} ადამიანს ერთი ანალიზი აქვს.`]);
      else if (t.twoTests) rows.push(['ok', `<b>${fmt(t.twoTests)} ადამიანს</b> MEDILAB-ში ორი ან მეტი თარიღის ანალიზი აქვს — მათ დინამიკა უკვე ჩანს.`]);
      if (!t.returned) rows.push(['warn', `<b>სხვა დღეს ჯერ არავინ დაბრუნებულა</b> — ყველამ ერთ დღეს სცადა.${t.appReturned ? ` აპში კი ${fmt(t.appReturned)} დაბრუნდა, MEDISCAN-ის გარეშე.` : ''}`]);
      else rows.push(['ok', `${fmt(t.returned)} ადამიანი დაბრუნდა და სხვა დღესაც გამოიყენა (${pct(share(t.returned, t.users))}).`]);
      const age = lab.testAge;
      if (lab.panels && age.year + age.older > age.fresh) rows.push(['info', `ატვირთული ანალიზების უმეტესობა ძველია: ${fmt(age.older)} წელზე ძველი, ${fmt(age.year)} — ერთ წლამდე. ადამიანები ძველ შედეგებს აგროვებენ.`]);
    }
    const missing = 'ვერ წაკითხული ანალიზის ფურცელი კი არსად იწერება — ასეთი მცდელობები აქ არ ჩანს.';
    if (d.totals.failedOpen) rows.push(['warn', `<b>${fmt(d.totals.failedOpen)} AI შეცდომა</b> ჯერ განუხილველია (${fmt(t.failedUsers)} ადამიანი). ${missing}`]);
    else if (d.ai.calls) rows.push(['ok', `AI-ს ${d.totals.failed ? 'ახალი ' : ''}შეცდომა არ აქვს; პასუხი საშუალოდ ${esc(sec(d.ai.avgMs))}-ში მოდის. ${missing}`]);
    const team = K.teamInsight(d, d.team.labSheets ? `${fmt(d.team.labSheets)} ანალიზის ფურცელი` : '');
    return K.insights([...rows.slice(0, 6), team]);
  }

  function periodBlock(d, ctx) {
    const p = d.period;
    return `${K.periodTitle(p, ctx.days)}
      ${metrics([
        metric('აქტიური ადამიანი', fmt(p.activeUsers), `${fmt(p.newUsers)} პირველად`),
        metric('ანალიზის ფურცელი', fmt(p.labSheets), `${fmt(p.labUsers)} ადამიანი · „ამიხსენი“ ${fmt(p.explanations)}`),
        metric('გამოსახულება და კანი', fmt(p.imaging + p.skin), `გამოსახულება ${fmt(p.imaging)} · კანი ${fmt(p.skin)} · მოვლა ${fmt(p.skincare)}`),
        metric('ახალმა ანგარიშმა გამოიყენა', pct(p.signupUseRate), `${fmt(p.signupsUsed)} / ${fmt(p.signups)} ახალი ანგარიში`),
      ])}
      ${card('დღიური ტრენდი', 'წაკითხვები (ანალიზი, გამოსახულება, კანის ფოტო), ვინც იმ დღეს რამე გააკეთა, და „ამიხსენი“ — თბილისის დღეების მიხედვით.', K.chart([
        { label: 'წაკითხვა', tone: 'blue', points: p.trend.reads },
        { label: 'აქტიური ადამიანი', tone: 'teal', points: p.trend.active },
        { label: '„ამიხსენი“', tone: 'violet', points: p.trend.explanations },
      ], { label: 'MEDILAB და MEDISCAN დღეების მიხედვით', empty: 'ამ პერიოდში არავის არაფერი წაუკითხავს.' }))}`;
  }

  function labCard(d) {
    const l = d.lab;
    const t = d.totals;
    const title = 'ანალიზები და MEDILAB';
    const sub = 'რამდენ ფურცელს კითხულობენ, რამდენ მაჩვენებელს ვიღებთ და რა ანალიზებია.';
    if (!l.sheets && !l.panels && !t.explanations) return card(title, sub, empty('ანალიზი ჯერ არავის წაუკითხავს.'));
    const age = l.testAge;
    const named = l.groups.filter((g) => g.key !== 'other');
    const groupsHtml = l.groups.length
      ? `${shares(l.groups.map((g) => [GROUPS[g.key] || 'სხვა', g.people]), l.people || 1)}${l.tests.length ? `<div class="s-uw-chips">${l.tests.map((x) => `<span class="s-badge is-plain">${esc(x.label)} · ${fmt(x.people)}</span>`).join('')}</div>` : ''}
        ${note(named.length
          ? `ადამიანების რაოდენობა თითო ჯგუფში. სახელი ჩანს მხოლოდ მაშინ, როცა ერთსა და იმავე ანალიზს ${fmt(l.kAnon)} ან მეტი ადამიანი ტვირთავს; დანარჩენი „სხვაშია“.`
          : `ჯერ ${fmt(l.people)} ადამიანი — ანალიზის სახელები გამოჩნდება, როცა ერთსა და იმავე ანალიზს ${fmt(l.kAnon)} ან მეტი ადამიანი ატვირთავს.`)}`
      : '';
    return card(title, sub, `
      ${facts([
        ['წაკითხული ფურცელი', `${fmt(l.sheets)} <small class="s-muted">· ${fmt(t.labUsers)} ადამიანი</small>`],
        ['MEDILAB-ში ანალიზი', `${fmt(l.panels)}${extras([['ახსნით', l.panelsExplained], ['ორი თარიღით', t.twoTests]])}`],
        ['„ამიხსენი“ სთხოვა', `${pct(l.explainRate)} <small class="s-muted">· ანალიზის მქონეთაგან · ${fmt(t.explanations)} ახსნა</small>`],
        ['მაჩვენებელი ერთ ანალიზში', l.valuesMedian == null ? '—' : `${num(l.valuesMedian)} <small class="s-muted">· მედიანა · მაქს. ${fmt(l.valuesMax)}</small>`],
        t.aligns ? ['სახელების გასწორება', fmt(t.aligns)] : null,
      ])}
      ${l.panels ? `${h4('ანალიზის თარიღი ატვირთვისას')}${shares([['ბოლო თვის', age.fresh], ['ერთ წლამდე', age.year], ['წელზე ძველი', age.older], ['თარიღი უცნობია', age.unknown]], l.panels)}` : ''}
      ${groupsHtml ? `${h4('რა ანალიზებს ტვირთავენ')}${groupsHtml}` : ''}`);
  }

  function peopleCard(d) {
    const t = d.totals;
    const f = d.firstUse || {};
    if (!t.users) return card('ვინ იყენებს', '', empty('მომხმარებელი ჯერ არ არის.'));
    return card('ვინ იყენებს', 'რას იყენებენ, რამდენად მალე რეგისტრაციიდან და ბრუნდებიან თუ არა.', `
      ${shares([
        ['ანალიზის ფურცელი', t.labUsers], ['„ამიხსენი“', t.explainUsers], ['MEDILAB-ში ანალიზი', t.panelUsers],
        ['გამოსახულება', t.imagingUsers], ['კანის ფოტო', t.skinUsers], ['კანის მოვლის რუტინა', t.skincareUsers],
      ], t.users)}
      ${h4('პირველად რეგისტრაციიდან')}
      ${shares([['რეგისტრაციის დღესვე', f.sameDay], ['პირველ კვირაში', f.week], ['მოგვიანებით', f.later]], t.users)}
      ${facts([
        ['დაბრუნდა სხვა დღეს', `${fmt(t.returned)} <small class="s-muted">· ${pct(share(t.returned, t.users))}</small>`],
        ['აპში დაბრუნდა', `${fmt(t.appReturned)} <small class="s-muted">· ${pct(share(t.appReturned, t.users))}</small>`],
        ['AI შეცდომა შეხვდა', warn(t.failedUsers)],
      ])}
      ${note(`მედიანა: ${esc(K.hoursText(f.medianHours))} რეგისტრაციიდან პირველ გამოყენებამდე. „აპში დაბრუნდა“ — პირველი გამოყენების შემდეგ სხვა დღეს გახსნა აპი (ნებისმიერი გვერდი).`)}`);
  }

  function imageCard(d) {
    const i = d.imaging;
    const t = d.totals;
    const callouts = `${K.flagCallout(d.flags.imaging, '<b>გამოსახულების წაკითხვა შეჩერებულია.</b>')}${K.flagCallout(d.flags.skin, '<b>კანის ფოტო და მოვლა შეჩერებულია.</b>')}`;
    const title = 'გამოსახულება და კანი';
    const sub = 'რენტგენი, ექო, MRI, CT; კანის და ხალების ფოტო; კანის მოვლის რუტინა.';
    if (!i.reads && !i.skinReads && !i.skincare) {
      return card(title, sub, `${callouts}${empty(d.includeTeam ? 'გამოსახულება, კანის ფოტო და კანის მოვლა ჯერ არავის გამოუყენებია.' : 'გამოსახულება, კანის ფოტო და კანის მოვლა ჯერ არცერთ რეალურ მომხმარებელს არ გამოუყენებია.')}`);
    }
    const regions = i.regions.length
      ? `${h4('სხეულის არე')}${shares(i.regions.map((r) => [REGIONS[r.key] || 'სხვა', r.reads]), i.reads || 1)}
        ${note(`არე ჩანს მხოლოდ მაშინ, როცა ${fmt(d.lab.kAnon)} ან მეტ ადამიანს აქვს; დანარჩენი „სხვაშია“.${i.regionUnknown ? ` ${fmt(i.regionUnknown)} წაკითხვაზე არე ჟურნალში არ ჩანს.` : ''}`)}`
      : i.reads && i.regionUnknown ? note(`სხეულის არე ${fmt(i.regionUnknown)} წაკითხვაზე ჟურნალში არ ჩანს.`) : '';
    return card(title, sub, `${callouts}
      ${facts([
        ['გამოსახულება', `${fmt(i.reads)} <small class="s-muted">· ${fmt(i.people)} ადამიანი</small>`],
        ['კანის ფოტო', `${fmt(i.skinReads)} <small class="s-muted">· ${fmt(i.skinPeople)} ადამიანი</small>`],
        ['კანის მოვლის რუტინა', `${fmt(i.skincare)} <small class="s-muted">· ${fmt(i.skincarePeople)} ადამიანი</small>`],
        t.legacy.xray ? ['ძველი რენტგენის ჩანაწერი', fmt(t.legacy.xray)] : null,
      ])}
      ${regions}`);
  }

  function aiCard(d) {
    const a = d.ai;
    const rows = a.byMode.filter((m) => m.calls > 0);
    const action = `<button type="button" class="btn ghost compact" data-lab-log>${K.ico('message')} ჟურნალი Medi-ში</button>`;
    const lostReads = note('ანალიზის ფურცლიდან მაჩვენებლების ამოკითხვა AI-ის ჟურნალში არ იწერება: წარმატებული ფურცელი ჩანს როგორც შენახული ანალიზი, ვერ წაკითხული — არსად. შედეგზე დასმული კითხვა Medi-ს საუბრებში ითვლება.');
    if (!rows.length) return card('AI-ის ხარისხი', '', `${empty('ამ მოდულში AI-ის მოთხოვნა ჯერ არ ყოფილა.')}${lostReads}`, { action });
    const table = `<div class="s-table-wrap"><table class="s-table">
      <thead><tr><th>რა</th><th class="num">მოთხოვნა</th><th class="num">შეცდომა</th><th class="num">საშ. დრო</th><th class="num">p95</th><th class="num">ხარჯი</th></tr></thead>
      <tbody>${rows.map((m) => `<tr>
        <td>${esc(MODES[m.mode] || 'სხვა')}<br><small class="s-muted">${fmt(m.users)} ადამიანი</small></td>
        <td class="num">${fmt(m.calls)}</td>
        <td class="num">${warn(m.errors)}${m.reviewed ? ` <small class="s-muted">+${fmt(m.reviewed)} განხილული</small>` : ''}</td>
        <td class="num">${esc(sec(m.avgMs))}</td>
        <td class="num">${esc(sec(m.p95Ms))}</td>
        <td class="num">${esc(usd(m.costUsd))}</td>
      </tr>`).join('')}</tbody>
    </table></div>`;
    return card('AI-ის ხარისხი', 'თითო სახის მოთხოვნა: რამდენი გავიდა, რამდენი ჩავარდა, რა დრო და ხარჯი. დრო — მხოლოდ წარმატებული პასუხების.', `
      ${table}
      ${facts([
        ['სულ', `${fmt(a.calls)} <small class="s-muted">· ${fmt(a.users)} ადამიანი · ${esc(usd(a.costUsd))}</small>`],
        ['შეფასება', `${fmt(a.up)} სასარგებლო · ${fmt(a.down)} არა`],
        a.lastErrorAt ? ['ბოლო შეცდომა', esc(when(a.lastErrorAt))] : null,
      ])}
      ${lostReads}`, { action });
  }

  function paint(d, ctx) {
    const t = d.totals;
    wall.set(d.items, { total: d.itemsTotal });
    return `${K.flagCallout(d.flags.labs, '<b>ანალიზები შეჩერებულია.</b> ახალი ფურცელი არ იკითხება; შენახული ანალიზები MEDILAB-ში რჩება.')}
      ${insights(d)}
      ${metrics([
        metric('გამოიყენა', fmt(t.users), `ანგარიშების ${pct(t.userRate)} · ${fmt(t.accounts)}-დან`),
        metric('ანალიზის ფურცელი', fmt(t.labSheets), `${fmt(t.labUsers)} ადამიანი · „ამიხსენი“ ${fmt(t.explanations)}`),
        metric('MEDILAB-ში ანალიზი', fmt(t.panels), `${fmt(t.panelUsers)} ადამიანი · ორი თარიღით ${fmt(t.twoTests)}`),
        metric('გამოსახულება და კანი', fmt(t.imaging + t.skin), `გამოსახულება ${fmt(t.imaging)} · კანი ${fmt(t.skin)} · მოვლა ${fmt(t.skincare)}`),
      ])}
      ${card('MEDISCAN-იდან MEDILAB-მდე', 'რამდენმა ადამიანმა გაიარა თითო ნაბიჯი, მთელი დროის განმავლობაში. „შედეგი მიიღო“ — წაკითხული ანალიზი, გამოსახულება ან კანის ფოტო; „ამიხსენი“ — ანალიზის ახსნა სთხოვა Medi-ს; „MEDILAB-შია“ — ერთი ანალიზი მაინც ინახება; „ორი თარიღი“ — ორი სხვადასხვა თარიღის ანალიზი, ანუ დინამიკა ჩანს; „დაბრუნდა სხვა დღეს“ — ორ სხვადასხვა დღეს გამოიყენა. % ითვლება ყველა მომხმარებლიდან.',
        K.ladder(d.ladder, LADDER, { first: 'ყველა მომხმარებელი', unit: 'მომხმარებლიდან', emptyText: 'MEDILAB და MEDISCAN ჯერ არავის გამოუყენებია.' }))}
      ${wall.html()}
      ${periodBlock(d, ctx)}
      ${K.split(labCard(d), peopleCard(d))}
      ${K.split(imageCard(d), aiCard(d))}
      ${K.definitions([
        '<b>მომხმარებელი</b> — ვისაც ერთი მაინც აქვს: წაკითხული ანალიზის ფურცელი, MEDILAB-ში შენახული ანალიზი, „ამიხსენი“, წაკითხული გამოსახულება ან კანის ფოტო, კანის მოვლის რუტინა ან ჩავარდნილი AI-ის მოთხოვნა ამ მოდულში. MEDISCAN-ის უბრალოდ გახსნა არ ჩანს — ეკრანებს აპი ცალკე არ აგზავნის.',
        '<b>ანალიზის ფურცელი</b> — შენახული შედეგი (ერთში შეიძლება რამდენიმე გვერდი იყოს); ადამიანმა რომ წაშალოს, აქედანაც ქრება. <b>გამოსახულება, კანის ფოტო, მოვლის რუტინა</b> ითვლება AI-ის ჟურნალიდან, რომელიც წაშლის შემდეგაც რჩება; ძველი ჩანაწერი ჟურნალის გარეშე — ჩანაწერით.',
        '<b>MEDILAB-ში ანალიზი</b> — რასაც MEDILAB ინახავს (ერთი თარიღი = ერთი ანალიზი; წაშლილი ფურცლის ანალიზი არ ითვლება). <b>ორი თარიღი</b> — ორი სხვადასხვა თარიღის ანალიზი: მხოლოდ მაშინ ჩანს დინამიკა და „რა შეიცვალა“. <b>დაბრუნდა სხვა დღეს</b> — ამ მოდულში რამე გააკეთა ორ სხვადასხვა დღეს (თბილისის დროით).',
        '<b>AI შეცდომა</b> — ჩავარდნილი მოთხოვნა; „განხილული“ — ადმინმა უკვე ნახა (Medi-ს ჟურნალში). სიმპტომების შემოწმება და Medi-ს საუბრები, მათ შორის MEDISCAN-ის შედეგზე დასმული კითხვა, Medi-ს გვერდზეა.',
        '<b>გუნდი</b> — ზუსტად @medicard.ge ელფოსტით შესული ანგარიშები (დემო და თანამშრომლები). ტელეფონით და Apple-ით შესულები ჩვეულებრივი მომხმარებლები არიან.',
        'კონფიდენციალობა: აქ არ ჩანს მაჩვენებლების მნიშვნელობები, ანალიზის თარიღები, დასკვნები, AI-ის ტექსტი და სურათები. ანალიზის სახელი და სხეულის არე ჩანს მხოლოდ მაშინ, როცა 3 ან მეტ ადამიანს აქვს — დანარჩენი „სხვაშია“.',
      ])}`;
  }

  function after(root) {
    wall.bind(root);
    root.querySelector('[data-lab-log]')?.addEventListener('click', () => {
      // Medi's log (#/ai) keeps its filter in admin.js `aiLog`; open it on lab explanations.
      if (typeof aiLog === 'object' && aiLog) Object.assign(aiLog, { mode: 'LAB', status: '', offset: 0 });
      const ai = document.getElementById('tab-ai');
      if (ai) ai.innerHTML = '';
      location.hash = '#/ai';
    });
  }

  global.renderLabUsage = K.page({ tab: 'lab', path: '/usage/lab/overview', capability: 'PRODUCT_USAGE_VIEW', paint, after });
})(window);
