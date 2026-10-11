/**
 * MediCard Admin V4 — #/quests „ვინ იყენებს და როგორ“ MEDIQUEST (/api/admin/usage/quest/overview), on the usage kit
 * (usageKit.js). Who plays the missions and how far they get: what the numbers say, the ladder from getting a mission
 * to the rewards store, every player as a card with a usage track, the period trend, each mission's success rate,
 * the Medi Coins economy, levels / streaks / achievements, the store and Medi's journey. Never shows step counts,
 * water entries, personal targets, Medi conversations or the name a person gave Medi.
 */
(function adminV4QuestUsage(global) {
  const K = global.AdminUsage;
  if (!K) return;
  const { esc, fmt, pct, share, when, metric, metrics, card, facts, shares, extras, empty, note, h4 } = K;

  const MISSIONS = {
    daily_steps: 'დღიური ნაბიჯები',
    daily_hydration: 'დღიური წყალი',
    weekly_steps: 'კვირის ნაბიჯები',
    weekly_medi: 'Medi-სთან საუბარი (კვირაში ერთხელ)',
    daily_medi: 'Medi-სთან საუბარი (ძველი, დღიური)',
  };
  const CADENCE = { DAILY: 'დღიური', WEEKLY: 'კვირის', EVENT: 'ღონისძიება' };
  const CATEGORY = { MOVEMENT: 'მოძრაობა', HYDRATION: 'წყალი', MEDI: 'Medi', WEATHER: 'ამინდი', WELLNESS: 'კეთილდღეობა' };
  const missionName = (m) => MISSIONS[m.key] || `${CADENCE[m.cadence] || 'სხვა'} მისია · ${CATEGORY[m.category] || 'სხვა'}`;
  const LADDER = {
    assigned: 'მიიღო მისია', completed: 'შეასრულა მისია', claimed: 'აიღო ჯილდო',
    returned: 'დაბრუნდა სხვა დღეს', streak3: '3 დღე ზედიზედ', redeemed: 'გაცვალა მაღაზიაში',
  };
  const SOURCES = {
    quest: 'მისიები', achievement: 'მიღწევები', medirun: 'MEDIRUN', referral: 'მეგობრის მოწვევა',
    admin: 'ადმინის დარიცხვა', refund: 'გაცვლის დაბრუნება', other: 'სხვა',
  };
  const FAMILIES = {
    FIRST: 'პირველი ნაბიჯები', QUESTS: 'მისიების რაოდენობა', STREAK: 'სერია', MOVE: 'მოძრაობა', HYDRATE: 'წყალი', MEDI: 'Medi',
    WEEKLY: 'კვირის მისიები', LEVEL: 'დონე', COINS_EARNED: 'დაგროვილი Coins', COMEBACK: 'დაბრუნება', TIME_OF_DAY: 'დღის დრო', OTHER: 'სხვა',
  };
  const BANDS = { b0: '0', b1: '1–99', b100: '100–499', b500: '500–999', b1000: '1 000–4 999', b5000: '5 000 და მეტი' };
  const REDEMPTION = { PENDING: 'გადაცემას ელოდება', ISSUED: 'გაცემულია', USED: 'გამოყენებულია', EXPIRED: 'ვადა გაუვიდა', CANCELLED: 'გაუქმდა' };
  const LEVEL_BANDS = ['1', '2', '3', '4', '5+'];
  const TRACK = ['მისიები', 'ჯილდო', 'დღეები', 'სერია', 'Coins', 'მაღაზია'];
  /** Below this many finished days / weeks a mission's success rate is shown as a small sample. */
  const SMALL = 10;

  // The wall's cards are drawn outside paint(): keep what they need from the last payload.
  const view = { days: 30, target: null };

  function playerCard(i) {
    const m = i.missions;
    const c = i.coins;
    const t = view.target;
    const parts = [
      m.completed && `შეასრულა ${fmt(m.completed)} მისია${m.period && m.period !== m.completed ? ` (${fmt(m.period)} ბოლო ${fmt(view.days)} დღეში)` : ''}`,
      m.claimed && `აიღო ${fmt(m.claimed)} ჯილდო`,
      i.achievements.unlocked && `მიღწევა ${fmt(i.achievements.unlocked)}`,
      i.store.redemptions && `მაღაზია ${fmt(i.store.redemptions)}`,
    ].filter(Boolean);
    let line = parts.join(' · ');
    if (!parts.length) {
      line = m.assigned
        ? `მიიღო ${fmt(m.assigned)} მისია — არცერთი არ შეუსრულებია`
        : c.medirun ? 'მისია ჯერ არ მიუღია · Coins MEDIRUN-იდან' : 'მისია ჯერ არ მიუღია';
    }
    const badges = [
      i.person.team && '<span class="s-badge is-info">გუნდი</span>',
      m.unclaimed && `<span class="s-badge is-warn" title="${esc(`შესრულებული, აუღებელი ჯილდო: ${fmt(m.unclaimed)}${m.unclaimedCoins ? ` · ${fmt(m.unclaimedCoins)} Coins` : ''}`)}">ჯილდო ელოდება · ${fmt(m.unclaimed)}</span>`,
      i.store.pending && '<span class="s-badge is-accent">საჩუქარი გადასაცემია</span>',
    ].filter(Boolean).join('');
    return K.itemCard({
      mark: String(i.level),
      title: `დონე ${fmt(i.level)} · ${fmt(i.xp)} XP`,
      meta: [`${fmt(c.balance)} Medi Coins`, c.medirun && `MEDIRUN ${fmt(c.medirun)}`, i.streak.current && `სერია ${fmt(i.streak.current)} დღე`].filter(Boolean).join(' · '),
      badges,
      track: K.track([
        { fill: m.assigned ? (m.completed / m.assigned) * 100 : 0, title: `შეასრულა ${fmt(m.completed)} / ${fmt(m.assigned)} მისია` },
        { fill: m.completed ? (m.claimed / m.completed) * 100 : 0, title: m.completed ? `აიღო ${fmt(m.claimed)} / ${fmt(m.completed)} ჯილდო${m.unclaimed ? ` · ელოდება ${fmt(m.unclaimed)}` : ''}` : 'შესრულებული მისია ჯერ არ არის' },
        { fill: (m.days / 7) * 100, title: `მისია შეასრულა ${fmt(m.days)} სხვადასხვა დღეს` },
        { fill: (i.streak.longest / 7) * 100, title: `ყველაზე გრძელი სერია ${fmt(i.streak.longest)} დღე · ახლა ${fmt(i.streak.current)}` },
        { fill: t ? (Math.max(0, c.balance) / t.cost) * 100 : c.balance > 0 ? 100 : 0, title: `ბალანსი ${fmt(c.balance)} Coins${t ? ` · ${t.title} — ${fmt(t.cost)}` : ''}` },
        { fill: i.store.redemptions ? 100 : 0, title: i.store.redemptions ? `მაღაზიაში გაცვალა ${fmt(i.store.redemptions)}-ჯერ` : 'მაღაზიაში ჯერ არ გაუცვლია' },
      ]),
      line,
      idle: !parts.length,
      person: i.person,
      foot: [
        i.lastCompletedAt ? `ბოლო მისია ${when(i.lastCompletedAt, 'date')}` : i.firstAt ? `პირველი მისია ${when(i.firstAt, 'date')}` : `რეგისტრაცია ${when(i.person.signupAt, 'date')}`,
        i.person.lastSeenAt ? `აპში ${when(i.person.lastSeenAt)}` : 'აპში ჯერ არ ჩანს',
      ],
    });
  }

  const wall = K.createWall({
    title: 'მოთამაშეები და რას აკეთებენ',
    sub: 'თითო ბარათი ერთი ადამიანია. ზოლი: შესრულებული მისიების წილი, აღებული ჯილდო, დღეები (7-მდე), სერია (7 დღემდე), Coins ყველაზე იაფ საჩუქრამდე, მაღაზია. ახალი აქტივობა პირველია.',
    legendLabels: TRACK,
    filters: [
      ['all', 'ყველა', () => true],
      ['idle', 'მხოლოდ მიიღო', (i) => i.missions.assigned > 0 && !i.missions.completed],
      ['doing', 'ასრულებს', (i) => i.missions.completed > 0],
      ['waiting', 'ჯილდო ელოდება', (i) => i.missions.unclaimed > 0],
      ['coins', 'Coins აქვს', (i) => i.coins.balance > 0],
      ['store', 'მაღაზია', (i) => i.store.redemptions > 0],
    ],
    search: (i) => `${i.person.name} ${i.person.contact}`,
    placeholder: 'სახელი, ტელეფონი ან ელფოსტა',
    render: playerCard,
    emptyText: {
      all: 'მისია ჯერ არავის მიუღია.', idle: 'ყველამ შეასრულა ერთი მისია მაინც.', doing: 'მისია ჯერ არავის შეუსრულებია.',
      waiting: 'აუღებელი ჯილდო არავის აქვს.', coins: 'Medi Coins ჯერ არავის აქვს.', store: 'მაღაზიაში ჯერ არავის გაუცვლია.',
    },
  });

  const activeMissions = (d) => d.missions.filter((m) => m.active && !m.retired);

  function insights(d) {
    const t = d.totals;
    const ach = d.progress.achievements;
    const s = d.store;
    const c = d.coins;
    const rows = [];
    if (!t.players) {
      rows.push(['info', `მისია ჯერ არცერთ ${d.includeTeam ? '' : 'რეალურ '}მომხმარებელს არ მიუღია.`]);
    } else {
      rows.push([t.completerRate < 50 ? 'warn' : 'info', `<b>${fmt(t.completers)} ადამიანმა</b> შეასრულა ერთი მისია მაინც — ${fmt(t.players)}-დან, ვისაც აპმა მისია მისცა (${pct(t.completerRate)}).${t.onlyAssigned ? ` ${fmt(t.onlyAssigned)} ადამიანს არცერთი არ შეუსრულებია.` : ''}`]);
      if (t.unclaimed) {
        rows.push(['warn', `<b>${fmt(t.unclaimed)} შესრულებული მისიის ჯილდო აუღებელია</b> (${fmt(t.unclaimedCoins)} Coins, ${fmt(t.unclaimedPeople)} ადამიანი) — მისია შესრულდა, მაგრამ „აღებას“ არ დააჭირეს.${ach.waiting ? ` ასევე ელოდება ${fmt(ach.waiting)} მიღწევის ჯილდო (${fmt(ach.waitingCoins)} Coins).` : ''}`]);
      }
      const measured = activeMissions(d).filter((m) => m.ended >= SMALL);
      const never = measured.filter((m) => !m.completed);
      if (never.length) {
        rows.push(['warn', `${never.map((m) => `„${esc(missionName(m))}“`).join(', ')} ჯერ არავის შეუსრულებია.`]);
      } else if (measured.length >= 2) {
        const sorted = [...measured].sort((a, b) => (a.rate ?? 0) - (b.rate ?? 0));
        const worst = sorted[0];
        const best = sorted[sorted.length - 1];
        rows.push([(worst.rate ?? 0) < 15 ? 'warn' : 'info', `„${esc(missionName(worst))}“ ყველაზე იშვიათად სრულდება — ${pct(worst.rate)} (${fmt(worst.endedDone)} / ${fmt(worst.ended)}); „${esc(missionName(best))}“ — ${pct(best.rate)}.`]);
      }
      if (!s.redeemers) {
        const far = s.cheapestPrize && c.maxBalance < s.cheapestPrize.cost;
        rows.push(['warn', `<b>მაღაზიაში ჯერ არავის გაუცვლია.</b>${far ? ` ყველაზე იაფი საჩუქარი (${esc(s.cheapestPrize.title)}) ${fmt(s.cheapestPrize.cost)} Coins ღირს, ყველაზე დიდი ბალანსი კი ${fmt(c.maxBalance)}-ია.` : ''}${s.canAffordCheapest && s.cheapest ? ` ${fmt(s.canAffordCheapest)} ადამიანს „${esc(s.cheapest.title)}“-ისთვის (${fmt(s.cheapest.cost)}) უკვე ჰყოფნის.` : ''}`]);
      } else {
        rows.push(['ok', `<b>${fmt(s.redeemers)} ადამიანმა</b> გაცვალა Coins მაღაზიაში — ${fmt(t.redemptions)} გაცვლა, ${fmt(s.coinsSpent)} Coins.${s.redemptions.PENDING ? ` ${fmt(s.redemptions.PENDING)} საჩუქარი გადაცემას ელოდება.` : ''}`]);
      }
      if (c.earnedTotal) {
        const main = Object.entries(c.earned).filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1]).slice(0, 3);
        rows.push(['info', `დაგროვდა ${fmt(c.earnedTotal)} Medi Coins: ${main.map(([k, n]) => `${SOURCES[k] || 'სხვა'} ${pct(share(n, c.earnedTotal))}`).join(', ')}.`]);
      }
    }
    rows.push(K.teamInsight(d, d.team.missions ? `${fmt(d.team.missions)} მისია` : ''));
    return K.insights(rows);
  }

  function periodBlock(d, ctx) {
    const p = d.period;
    const src = p.coinsBySource || {};
    return `${K.periodTitle(p, ctx.days)}
      ${metrics([
        metric('აქტიური მოთამაშე', fmt(p.activePlayers), `${fmt(p.newCompleters)} პირველად შეასრულა მისია`),
        metric('შესრულებული მისია', fmt(p.completed), `წარმატება ${pct(p.completionRate)} · მიეცა ${fmt(p.assigned)}`),
        metric('აღებული ჯილდო', fmt(p.claimed), `${fmt(src.quest || 0)} Coins მისიებით`),
        metric('Medi Coins დაგროვდა', fmt(p.coinsEarned), [`მისიები ${fmt(src.quest || 0)}`, `MEDIRUN ${fmt(src.medirun || 0)}`, p.coinsSpent ? `დაიხარჯა ${fmt(p.coinsSpent)}` : ''].filter(Boolean).join(' · ')),
      ])}
      ${card('დღიური ტრენდი', 'შესრულებული მისიები, ადამიანები, ვინც იმ დღეს MEDIQUEST-ში რამე გააკეთა, და აღებული ჯილდოები — თბილისის დღეების მიხედვით.', `${K.chart([
        { label: 'შესრულებული მისია', tone: 'blue', points: p.trend.completed },
        { label: 'აქტიური მოთამაშე', tone: 'teal', points: p.trend.active },
        { label: 'აღებული ჯილდო', tone: 'violet', points: p.trend.claimed },
      ], { label: 'MEDIQUEST დღეების მიხედვით', empty: 'ამ პერიოდში მისია არავის შეუსრულებია.' })}
      ${p.signups ? note(`ამ პერიოდის ${fmt(p.signups)} ახალი ანგარიშიდან მისია შეასრულა ${fmt(p.signupsCompleted)}-მა (${pct(p.signupRate)}).`) : ''}`)}`;
  }

  /** Success over finished days / weeks; with few of them, also how the running day / week goes so far. */
  function rateCell(rate, done, ended, running, runningDone) {
    const now = running ? `მიმდინარე: ${fmt(runningDone)} / ${fmt(running)} შესრულდა` : '';
    if (!ended) return `—<br><small class="s-muted">${now || 'მონაცემი არ არის'}</small>`;
    const small = ended < SMALL;
    const value = rate === 0 && !small ? '<span class="s-uw-warn">0%</span>' : `<b>${pct(rate)}</b>`;
    return `${value}<br><small class="s-muted">${fmt(done)} / ${fmt(ended)}${small ? ` · მცირე მონაცემი${now ? `<br>${now}` : ''}` : ''}</small>`;
  }

  function missionsCard(d, ctx) {
    const list = d.missions.filter((m) => m.assigned || (m.active && !m.retired));
    const title = 'მისიები';
    const sub = 'რამდენჯერ სრულდება თითო მისია. წარმატება ითვლება მხოლოდ დასრულებულ დღეებსა და კვირებში.';
    if (!list.length) return card(title, sub, empty('მისია ჯერ არავის მიუღია.'));
    const running = d.missions.reduce((s, m) => s + m.running, 0);
    const rows = list.map((m) => `<tr>
        <td><b>${esc(missionName(m))}</b><br><small class="s-muted">${m.retired || !m.active ? 'გამორთულია' : `${esc(CADENCE[m.cadence] || 'სხვა')} · ${m.rewardCoins ? `${fmt(m.rewardCoins)} Coins · ` : ''}${fmt(m.rewardXp)} XP`}</small></td>
        <td class="num">${rateCell(m.rate, m.endedDone, m.ended, m.running, m.runningDone)}</td>
        <td class="num">${rateCell(m.period.rate, m.period.endedDone, m.period.ended, m.running, m.runningDone)}</td>
        <td class="num">${fmt(m.completers)} / ${fmt(m.people)}<br><small class="s-muted">შეასრულა / მიიღო</small></td>
      </tr>`).join('');
    return card(title, sub, `<div class="s-table-wrap"><table class="s-table">
        <thead><tr><th>მისია</th><th class="num">წარმატება</th><th class="num">ბოლო ${fmt(ctx.days)} დღე</th><th class="num">ადამიანი</th></tr></thead>
        <tbody>${rows}</tbody></table></div>
      ${note(`„წარმატება“ — შესრულებული / ყველა მისია იმ დღეებსა და კვირებში, რომლებიც უკვე დასრულდა; გაუქმებული არ ითვლება. ${running ? `ახლა მიმდინარეობს ${fmt(running)} მისია (დღევანდელი და ამ კვირის). ` : ''}კვირის Medi-ს მისია მხოლოდ XP-ს იძლევა.`)}`);
  }

  function coinsCard(d) {
    const c = d.coins;
    const title = 'Medi Coins';
    const sub = 'საიდან მოდის, სად იხარჯება და რამდენი აქვთ.';
    if (!c.walletPeople && !c.waiting.missions && !c.waiting.achievements) return card(title, sub, empty('Medi Coins ჯერ არავის დარიცხვია.'));
    const sources = Object.keys(SOURCES).map((k) => [`${SOURCES[k]} (${fmt(c.earnedPeople[k] || 0)} ადამიანი)`, c.earned[k] || 0]);
    const bands = Object.keys(BANDS).map((k) => [BANDS[k], c.bands[k] || 0]);
    return card(title, sub, `
      ${facts([
        ['დაგროვდა სულ', `${fmt(c.earnedTotal)} <small class="s-muted">· XP ${fmt(c.xp.total)}</small>`],
        ['დაიხარჯა', `${fmt(c.spentTotal)}${extras([['მაღაზიაში', c.spent.store], ['ადმინმა ჩამოჭრა', c.spent.admin], ['სხვა', c.spent.other]])}`],
        ['ბალანსში', `${fmt(c.balance)} <small class="s-muted">· ${fmt(c.holders)} ადამიანი</small>`],
        ['ბალანსის მედიანა / მაქსიმუმი', `${c.medianBalance == null ? '—' : fmt(c.medianBalance)} / ${fmt(c.maxBalance)}`],
        ['აუღებელი ჯილდო', c.waiting.missions || c.waiting.achievements ? `<span class="s-uw-warn">${fmt(c.waiting.missions + c.waiting.achievements)}</span> <small class="s-muted">· მისიებში ${fmt(c.waiting.missions)} · მიღწევებში ${fmt(c.waiting.achievements)}</small>` : '0'],
      ])}
      ${c.earnedTotal ? `${h4('საიდან მოდის')}${shares(sources, c.earnedTotal)}` : ''}
      ${c.walletPeople ? `${h4('ბალანსი ადამიანების მიხედვით')}${shares(bands, c.walletPeople)}` : ''}
      ${note('ბალანსი ითვლება Coins-ის ჟურნალიდან (ყველა დარიცხვა და ჩამოჭრა). MEDIRUN-ის ყუთები და პრიზები, მიღწევები და მოწვევა იმავე საფულეში იწერება. Coins-ს ფულადი ღირებულება არ აქვს.')}`);
  }

  function progressCard(d) {
    const p = d.progress;
    const xpPeople = d.coins.xp.people;
    const st = p.streaks;
    const a = p.achievements;
    const title = 'დონე, სერია, მიღწევები';
    const sub = 'რამდენად შორს მიდიან: XP-ის დონე, ზედიზედ დღეები და გახსნილი მიღწევები.';
    if (!xpPeople && !st.longest3 && !st.live && !a.unlocked) return card(title, sub, empty('XP, სერია და მიღწევა ჯერ არავის აქვს.'));
    return card(title, sub, `
      ${xpPeople ? `<h4 class="p2-h">დონე <small class="s-muted">· ${fmt(xpPeople)} ადამიანს აქვს XP</small></h4>${shares(LEVEL_BANDS.map((k) => [`დონე ${k}`, p.levels[k] || 0]), xpPeople)}` : ''}
      ${h4('სერია')}
      ${facts([
        ['ახლა სერიაშია', `${fmt(st.live)}${extras([['3 დღე და მეტი', st.live3]])}`],
        ['ოდესმე 3+ დღე ზედიზედ', fmt(st.longest3)],
        ['ოდესმე 7+ დღე ზედიზედ', fmt(st.longest7)],
        ['ყველაზე გრძელი სერია', `${fmt(st.maxLongest)} დღე`],
      ])}
      ${a.unlocked ? `${h4('მიღწევები')}${facts([
        ['გახსნილი მიღწევა', `${fmt(a.unlocked)} <small class="s-muted">· ${fmt(a.people)} ადამიანი</small>`],
        ['ჯილდო აიღეს', `${fmt(a.claimed)}${a.waiting ? ` <small class="s-muted">· ელოდება ${fmt(a.waiting)} (${fmt(a.waitingCoins)} Coins)</small>` : ''}`],
      ])}${K.chips(a.families.map((f) => [FAMILIES[f.family] || 'სხვა', f.unlocked]))}` : ''}
      ${note('სერია — დღიური მისია ზედიზედ დღეებში; „ახლა სერიაშია“ — ბოლო შესრულება დღეს ან გუშინ იყო. მიღწევის ჯილდოც ხელით აიღება.')}`);
  }

  function storeCard(d) {
    const s = d.store;
    const j = d.journey;
    const total = Object.values(s.redemptions).reduce((a, b) => a + b, 0);
    const items = s.items.length
      ? facts(s.items.map((r) => [r.title, `${fmt(r.cost)} Coins${r.stock != null ? ` <small class="s-muted">· მარაგი ${fmt(r.stock)}</small>` : ''}${r.redemptions ? ` <small class="s-muted">· გაცვლა ${fmt(r.redemptions)}</small>` : ''}`]))
      : empty('მაღაზიაში აქტიური ნივთი არ არის.');
    const journey = j.people
      ? `${h4('Medi-ს მოგზაურობა')}
        ${facts([
          ['მოგზაურობა დაიწყო', `${fmt(j.people)} ადამიანი <small class="s-muted">· ${fmt(j.unlocks)} გახსნილი ეტაპი</small>`],
          j.customized || j.named ? ['Medi-ს იერი და სახელი', `შეცვალა იერი ${fmt(j.customized)} · დაარქვა სახელი ${fmt(j.named)}`] : null,
        ])}
        ${shares(j.chapters.map((ch) => [`თავი ${ch.chapter}`, ch.people]), j.people)}
        ${note('ეტაპები იხსნება შესრულებული მისიებით (დღიური — 1, კვირის — 3 ქულა): 25 ეტაპი, 5 თავი. „თავი N“ — ვინც ამ თავამდე მივიდა.')}`
      : '';
    return card('მაღაზია და Medi-ს მოგზაურობა', 'რაზე ცვლიან Coins-ს და რამდენად ხელმისაწვდომია საჩუქარი.', `
      ${K.flagCallout(d.flags.rewardsStore, '<b>ჯილდოების გაცვლა შეჩერებულია.</b> Coins გროვდება, გაცვლა არ ხდება.')}
      ${facts([
        ['გაცვლა', `${fmt(total)}${extras(Object.entries(s.redemptions).map(([k, n]) => [REDEMPTION[k] || 'სხვა', n]))}`],
        ['გაცვალა', `${fmt(s.redeemers)} ადამიანმა${s.coinsSpent ? ` <small class="s-muted">· ${fmt(s.coinsSpent)} Coins</small>` : ''}`],
        s.cheapestPrize ? ['ყველაზე იაფი საჩუქარი', `${esc(s.cheapestPrize.title)} <small class="s-muted">· ${fmt(s.cheapestPrize.cost)} Coins</small>`] : null,
        s.cheapestPrize ? ['საჩუქრისთვის ჰყოფნის', `${fmt(s.canAffordPrize)} ადამიანს`] : null,
        s.cheapest && (!s.cheapestPrize || s.cheapest.cost < s.cheapestPrize.cost) ? [`„${s.cheapest.title}“-ისთვის ჰყოფნის`, `${fmt(s.canAffordCheapest)} ადამიანს <small class="s-muted">· ${fmt(s.cheapest.cost)} Coins</small>`] : null,
      ])}
      ${h4('მაღაზიის ნივთები')}${items}
      ${journey}`);
  }

  function paint(d, ctx) {
    const t = d.totals;
    view.days = ctx.days;
    view.target = d.store.target;
    wall.set(d.items, { total: d.itemsTotal });
    return `${K.flagCallout(d.flags.quest, '<b>MEDIQUEST შეჩერებულია.</b> მისიების შესრულება და Coins-ის აღება აპში ჩერდება.')}
      ${insights(d)}
      ${metrics([
        metric('შეასრულა მისია', fmt(t.completers), `${fmt(t.players)} მიიღო მისია · ანგარიშების ${pct(t.playerRate)}`),
        metric('მისიების წარმატება', pct(t.completionRate), `${fmt(t.endedDone)} / ${fmt(t.ended)} დასრულებული დღის და კვირის მისია`),
        metric('ჯილდო ელოდება', fmt(t.unclaimed), `${fmt(t.unclaimedPeople)} ადამიანი · ${fmt(t.unclaimedCoins)} Coins`, t.unclaimed > t.claimed ? 'warn' : ''),
        metric('Medi Coins ბალანსში', fmt(t.balance), `${fmt(t.coinHolders)} ადამიანი · მაქს. ${fmt(t.maxBalance)}`),
      ])}
      ${card('მისიიდან მაღაზიამდე', 'რამდენმა ადამიანმა გაიარა თითო ნაბიჯი, მთელი დროის განმავლობაში. „მიიღო მისია“ — აპმა მისია თავად მისცა; „აიღო ჯილდო“ — შესრულებულ მისიაზე „აღებას“ დააჭირა; „დაბრუნდა სხვა დღეს“ — MEDIQUEST-ში რამე გააკეთა ორ სხვადასხვა დღეს; „3 დღე ზედიზედ“ — დღიური მისია სამ დღეს ზედიზედ შეასრულა. % ითვლება ყველასგან, ვისაც მისია მიეცა.',
        K.ladder(d.ladder, LADDER, { first: 'ყველა, ვისაც მისია მიეცა', unit: 'მიღებულიდან', emptyText: 'მისია ჯერ არავის მიუღია.' }))}
      ${wall.html()}
      ${periodBlock(d, ctx)}
      ${K.split(missionsCard(d, ctx), coinsCard(d))}
      ${K.split(progressCard(d), storeCard(d))}
      ${K.definitions([
        '<b>მიიღო მისია</b> — აპი მისიებს თავად აძლევს, როცა მთავარი გვერდი ან MEDIQUEST იხსნება (დღიურს — ყოველდღე, კვირისას — ყოველ კვირა). ამიტომ „მიიღო მისია“ თითქმის „გახსნა აპი“-ს ნიშნავს და არა არჩევანს.',
        '<b>შეასრულა</b> — მიაღწია მისიის სამიზნეს: ნაბიჯები ტელეფონის ჯანმრთელობის მონაცემებიდან, წყალი — ჩანაწერებიდან, Medi-სთან საუბარი. შესრულება ავტომატურად ჩანს. <b>აიღო ჯილდო</b> — შესრულებულ მისიაზე „აღებას“ დააჭირა: XP და Medi Coins მხოლოდ მაშინ ერიცხება; აუღებელი ჯილდო არ იკარგება.',
        '<b>წარმატება</b> — შესრულებული / ყველა მისია იმ დღეებსა და კვირებში, რომლებიც უკვე დასრულდა (მიმდინარე დღე და კვირა არ ითვლება, გაუქმებული — არც). ცხრილის „ბოლო N დღე“ — ამ პერიოდში მიცემული მისიები.',
        '<b>აქტიური / დაბრუნდა სხვა დღეს</b> — MEDIQUEST-ში რამე გააკეთა: შეასრულა მისია, აიღო მისიის ან მიღწევის ჯილდო, გაცვალა Coins მაღაზიაში — ორ სხვადასხვა დღეს მაინც (თბილისის დროით). <b>3 დღე ზედიზედ</b> — დღიური მისიების ყველაზე გრძელი სერია 3 დღე ან მეტია.',
        '<b>Medi Coins</b> — ბალანსი ითვლება Coins-ის ჟურნალიდან: მისიები, მიღწევები, MEDIRUN-ის ყუთები და პრიზები, მეგობრის მოწვევა, ადმინის დარიცხვა, მაღაზიაში დახარჯული. XP-დან ითვლება დონე. Coins-ს ფულადი ღირებულება არ აქვს.',
        '<b>გუნდი</b> — ზუსტად @medicard.ge ელფოსტით შესული ანგარიშები (დემო და თანამშრომლები). ტელეფონით და Apple-ით შესულები ჩვეულებრივი მომხმარებლები არიან.',
        'კონფიდენციალობა: აქ არ ჩანს ნაბიჯების რაოდენობა, წყლის ჩანაწერები, პირადი სამიზნეები, Medi-სთან საუბარი და Medi-სთვის დარქმეული სახელი — მხოლოდ რაოდენობები, დონე, Coins და თარიღები.',
      ])}`;
  }

  function after(root) {
    wall.bind(root);
  }

  global.renderQuestUsage = K.page({ tab: 'quests', path: '/usage/quest/overview', capability: 'PRODUCT_USAGE_VIEW', paint, after });
})(window);
