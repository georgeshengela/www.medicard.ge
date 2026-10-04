// Shot list for snap.mjs. `at` = Tbilisi wall time (mock + browser clock). Persona man = გიორგი, women = ნინო.
// MEDIRUN shots run on Thursday 22 Oct 2026 10:15 (campaign day 18, morning wave live) so the season numbers
// (23 boxes, +860) are possible; everything else on Monday 5 Oct 2026 10:15.
const RUN_AT = '2026-10-22T10:15';
const RUN_GAP = '2026-10-22T12:41'; // between the 08:00 wave (ends 12:30) and the 13:00 wave: countdown hero
// MEDIRUN prize goal = Zoommer gift card 50 ₾ (store id is uuidFrom('reward:SHOP_GIFTCARD_50') in store.mjs).
const GOAL = { 'medirun.prizeGoal.mock-user-man-0001': 'e63079e2-2a60-4a0a-a1dc-1e5fa954de43', 'medirun.prizeGoal.mock-user-women-0001': 'e63079e2-2a60-4a0a-a1dc-1e5fa954de43' };
const run = (o) => ({ at: RUN_AT, storage: GOAL, ...o });

/** MEDISCAN: attach a PDF through the composer's „PDF ფაილი“ button and press „წაკითხვა“. */
async function scanUpload(page, h) {
  const chooser = page.waitForEvent('filechooser', { timeout: 15000 }).catch(() => null);
  await h.clickLabel('PDF ფაილი', { wait: 300 });
  const fc = await chooser;
  if (!fc) throw new Error('no file chooser');
  await fc.setFiles({ name: 'analizi.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4 mock') });
  await page.waitForTimeout(1500);
  await h.click('წაკითხვა', { exact: true, wait: 3500 });
}

export const SHOTS = [
  // ───────── MEDIRUN ─────────
  run({ name: 'run-hub', route: '/run', at: RUN_GAP, notes: 'MEDIRUN hub top at 12:41: hero counts down to the 13:00 wave (CTA „დავიწყოთ“ fits)', visible: 'MEDIRUN hub — lit Tbilisi hero „გაანათე თბილისი.“, next 6 boxes today 13:00 countdown, start button, next-boxes card' }),
  run({ name: 'run-hub-live', route: '/run', notes: 'MEDIRUN hub at 10:15 with boxes live. App truncates the CTA „წავედით საძებნე…“ at 390 px (app layout, not the harness)', visible: 'MEDIRUN hub — „ყუთები გელოდება.“ live chip, 5 boxes now · 14 openings left · 20–80 coins, district chips' }),
  run({ name: 'run-hub-dark', route: '/run', at: RUN_GAP, theme: 'dark', notes: 'same as run-hub, dark theme', visible: 'MEDIRUN hub in dark theme' }),
  run({
    name: 'run-wallet', route: '/run', at: RUN_AT, full: false,
    steps: async (page, h) => { await h.scrollToText('Medi Coins', { exact: true, offset: 16 }); },
    notes: 'hub scrolled to the Medi Coins wallet', visible: 'Medi Coins wallet — balance 1 240, season +860 / 23 boxes / 7 first finds, last movements in Tbilisi parks',
 }),
  run({
    name: 'run-drops', route: '/run', at: RUN_AT, full: false,
    steps: async (page, h) => { await h.scrollToText('სად არის ყუთები', { offset: 16 }); },
    notes: 'hub scrolled to „სად არის ყუთები“ (districts) + wallet below', visible: 'Where the boxes are — district chips with counts, 20–80 Medi Coins for the first, opened today',
 }),
  run({
    name: 'run-schedule', route: '/run', at: RUN_AT, full: false,
    steps: async (page, h) => { await h.click('განრიგი', { exact: true, wait: 2000 }); },
    notes: 'schedule sheet (განრიგი)', visible: 'Box schedule — weekday 08:00/13:00/18:00, weekend 09:30/13:30/17:30, Saturday 16:00 coin rain, how a box opens, ladder 100/60/40/25',
 }),
  run({
    name: 'run-leaders', route: '/run', at: RUN_AT, full: false,
    steps: async (page, h) => { await h.scrollToText('ლიდერბორდი', { exact: true, offset: 300 }); await h.click('ლიდერბორდი', { exact: true, wait: 3500 }); },
    notes: 'leaderboard sheet: boxes board, this week, weekly prizes 300/200/100, me #4', visible: 'Leaderboard — this week, boxes board, weekly prizes, your place #4',
 }),
  run({
    name: 'run-goal', route: '/run', at: RUN_AT, full: false,
    steps: async (page, h) => { await h.scrollToText('შენი მიზანი', { offset: 16 }); },
    notes: 'hub: prize goal + grand prize card', visible: 'Your goal — store prizes for Medi Coins; Light up Tbilisi grand prize card',
 }),
  run({
    name: 'run-city', route: '/run', at: RUN_AT, full: false,
    steps: async (page, h) => { await h.scrollToText('გაანათე თბილისი', { exact: true, offset: 16 }); },
    notes: 'hub: grand prize card + my city territory', visible: 'Light up Tbilisi card (0,42 % → 1 %) and „ჩემი ქალაქი“ map',
 }),
  run({ name: 'run-grand', route: '/run/grand', notes: 'grand prize eligibility screen', visible: 'Grand prize — red iPhone 18 Pro Max, 31 Dec 12:00, you lit 0,42 % of 1 %' }),
  run({
    name: 'run-gift', route: '/run', full: false, reduced: false, permissions: ['geolocation'],
    steps: async (page, h) => {
      const dbg = async (n) => page.screenshot({ path: `logs/run-gift-${n}.png` });
      await h.clickLabel('წავედით ყუთების საძებნელად', { wait: 6000 });
      await dbg(1);
      await h.click('დავიწყოთ აღმოჩენა', { wait: 9000 });
      await dbg(2);
      await h.clickLabel('საჩუქრის აღმოჩენა', { wait: 2500 });
      await dbg(3);
      await page.screenshot({ path: '../out/run-gift-find.png' });
      await h.click('ყუთის გახსნა', { exact: true, wait: 10 });
      await page.waitForTimeout(230); await page.screenshot({ path: '../out/run-gift-burst.png' });
      await page.waitForTimeout(1500);
    },
    notes: 'the opening reveal (PulseGift) after a real session start + /nearby + claim', visible: 'Box opened — +50 Medi Coins, first finder badge, new balance',
  }),
  // ───────── MEDIQUEST ─────────
  { name: 'quest-hub', route: '/medi-quest', notes: 'MEDIQUEST hub', visible: 'MEDIQUEST — level, Medi Coins, daily and weekly missions' },
  { name: 'quest-store', route: '/medi-quest/rewards', notes: 'store with prize renders and coin prices', visible: 'Medi Coins store — Zoommer gift cards, Redmi Buds, Smart Band, AirPods 4, Apple Watch SE 3' },
  { name: 'quest-store-gadgets', route: '/medi-quest/rewards', full: false, steps: async (page, h) => { await h.click('გაჯეტები', { wait: 1500 }); }, notes: 'store filtered to gadgets', visible: 'Store — gadgets: Redmi Buds, Xiaomi scale, power bank, Redmi Watch, Smart Band, AirPods 4/Pro 3, Apple Watch SE 3' },
  { name: 'quest-store-prizes', route: '/medi-quest/rewards', full: false, steps: async (page, h) => { await h.scrollToText('Xiaomi Smart Band 10', { exact: true, offset: 96 }); }, notes: 'store grid scrolled to the big prizes', visible: 'Store grid — Smart Band 10 (12 500), Zoommer gift card 200 ₾ (18 500), AirPods 4 (36 000), AirPods Pro 3 (62 000), Apple Watch SE 3 (70 000)' },
  { name: 'quest-prize', route: '/medi-quest/rewards/9101266b-c837-4280-a5cb-1628e2901c1b', notes: 'prize detail: AirPods 4', visible: 'Prize detail — Apple AirPods 4, 36 000 Medi Coins, progress from your balance' },
  { name: 'quest-wallet', route: '/medi-quest/wallet', notes: 'Medi Coins wallet', visible: 'Medi Coins wallet — balance and history' },
  // ───────── MEDICYCLE (ნინო) ─────────
  { name: 'cycle', route: '/cycle', persona: 'women', layout: 'women', notes: 'cycle dial hero', visible: 'MEDICYCLE — dial, days to period, phase' },
  { name: 'cycle-log', route: '/cycle', persona: 'women', layout: 'women', full: false, steps: async (page, h) => { await h.click('დღის აღრიცხვა', { exact: true, wait: 2500 }); await h.click('ხელახლა შეხება ინტენსივობას', { wait: 900 }).catch(() => {}); }, notes: 'quick log sheet with icon tiles', visible: 'Quick log — flow drops, pain, mood, symptoms icon tiles' },
  { name: 'home-women', route: '/home', persona: 'women', layout: 'women', notes: 'Home, women layout', visible: 'Home (women) — week tray, days to period, Medi chips, doses' },
  { name: 'cycle-dark', route: '/cycle', persona: 'women', layout: 'women', theme: 'dark', notes: 'cycle dial, dark', visible: 'MEDICYCLE dial in dark theme' },
  // ───────── MEDIPILL ─────────
  { name: 'pill-hub', route: '/medications', notes: 'medications tab', visible: 'MEDIPILL — pill organiser hero, today’s doses' },
  { name: 'pill-pharmacy', route: '/pharmacy/product/6cdd048d-b6ad-4ca9-ac82-254809f7d564', notes: 'product page: price across three pharmacies', visible: 'MEDIPILL — ვიტამინი D3 2000 IU: best price 21,45 ₾, prices in three pharmacies' },
  { name: 'pill-pharmacy-list', route: '/pharmacy', full: false, steps: async (page, h) => { await h.click('ვიტამინები და მინერალები', { wait: 2500 }); }, notes: 'catalogue: vitamins & minerals chip, cheapest first', visible: 'MEDIPILL catalogue — vitamins with best prices and savings' },
  // ───────── MEDIFOOD ─────────
  { name: 'food-hub', route: '/nutrition', notes: 'nutrition hub', visible: 'MEDIFOOD — calorie budget, macros, meals' },
  { name: 'food-diary', route: '/nutrition/diary', notes: 'food diary', visible: 'MEDIFOOD diary — meals of the day' },
  { name: 'food-fasting', route: '/nutrition/fasting', prepare: async ({ api, fetch }) => { await fetch(`${api}/__seed/fasting`, { method: 'POST' }); }, notes: 'fasting timer (16:8, 13 h 45 min in)', visible: 'Fasting timer running' },
  // ───────── MEDILAB / MEDISCAN / Medi ─────────
  { name: 'lab-records', route: '/records', notes: 'ანალიზები tab', visible: 'MEDILAB — latest lab values as range bars' },
  { name: 'lab-param', route: '/lab/param/vitamin_d', notes: 'one lab parameter', visible: 'MEDILAB parameter — range bar + trend' },
  { name: 'scan', route: '/scan', notes: 'MEDISCAN empty state', visible: 'MEDISCAN — labs / imaging / skin choice cards' },
  {
    name: 'scan-result', route: '/scan?type=lab', full: true,
    steps: async (page, h) => { await scanUpload(page, h); await h.scrollToText('მაჩვენებელი წავიკითხე', { offset: 90 }); },
    notes: 'a lab PDF read in the MEDISCAN chat', visible: 'MEDISCAN — „17 მაჩვენებელი წავიკითხე · 2 ნორმის გარეთაა“, values with ranges (amber = outside), saved to MEDILAB',
  },
  {
    name: 'scan-explain', route: '/scan?type=lab', full: true,
    steps: async (page, h) => { await scanUpload(page, h); await h.click('ამიხსენი შედეგები', { wait: 4500 }); await h.scrollToText('რა არის კარგად', { offset: 380 }).catch(() => {}); },
    notes: 'the plain-language explanation after „ამიხსენი შედეგები“', visible: 'MEDISCAN — calm explanation: what to watch, what is good, questions for your doctor',
  },
  { name: 'medi-welcome', route: '/assistant', notes: 'Medi empty state', visible: 'Medi — „გამარჯობა, გიორგი“, starter questions, composer with the კონსილიუმი switch' },
  {
    name: 'medi-chat', route: '/assistant', full: false,
    steps: async (page, h) => {
      await page.getByPlaceholder('ჰკითხე ან სთხოვე Medi-ს…').fill('ხვალ 9-ზე ვიტამინი D ჩამიწერე');
      await h.clickLabel('გაგზავნა', { wait: 4500 });
    },
    notes: 'Medi: a request becomes an in-thread save card', visible: 'Medi — „ხვალ 9-ზე ვიტამინი D ჩამიწერე“ → card „მედიკამენტის შეხსენება“ with შენახვა / შესწორება / გაუქმება',
  },
  { name: 'medi-answer', route: '/assistant?sessionId=3108c618-5cf8-4428-add5-b520dd94c92b', full: true, notes: 'saved Medi thread with a calm health answer', visible: 'Medi — a health question and a calm plain-language answer' },
  {
    name: 'medi-consilium', route: '/assistant?mode=deep', full: false,
    steps: async (page, h) => { await h.click('ხშირად მაქვს დაღლილობა და თავბრუსხვევა', { wait: 5000 }); await h.scrollToText('ხშირად მაქვს დაღლილობა და თავბრუსხვევა', { offset: 70 }); },
    notes: 'consilium switch on (indigo composer) and a consilium answer', visible: 'Medi — კონსილიუმი on: indigo composer, a detailed multi-view answer',
  },
  {
    name: 'medi-consilium-empty', route: '/assistant?mode=deep', full: false,
    notes: 'consilium switch on, before asking', visible: 'Medi — კონსილიუმი switch on, indigo orb and composer',
  },
  // ───────── MEDIVET / MEDICOACH ─────────
  { name: 'vet-hub', route: '/pets', persona: 'women', layout: 'women', notes: 'pets hub', visible: 'MEDIVET — ბონი (golden retriever) featured, მია (cat), care / weight tiles' },
  { name: 'vet-pet', route: '/pets/b0a1e7d2-5c4f-4e8a-9b13-2f6d8c0a4b71', persona: 'women', layout: 'women', notes: 'ბონი detail', visible: 'MEDIVET — ბონი: weight trend, care plan (flea/tick, deworming, vaccines), Medi Vet' },
  { name: 'coach-client', route: '/trainer', persona: 'women', layout: 'women', notes: 'client view of a linked trainer', visible: 'MEDICOACH (client ნინო) — trainer ლევან ჩხეიძე, next session, meal plan adherence' },
  { name: 'coach-trainer', route: '/coach', persona: 'man', notes: 'trainer workspace', visible: 'MEDICOACH trainer workspace (გიორგი) — today’s sessions, clients needing attention' },
  // ───────── Home + utility ─────────
  { name: 'home-standard', route: '/home', persona: 'man', layout: 'standard', notes: 'Home standard (man)', visible: 'Home (standard) — today hero, ask Medi, doses' },
  { name: 'home-active', route: '/home', persona: 'man', layout: 'active', notes: 'Home active layout', visible: 'Home (active) — steps, water, MEDIRUN, MEDIQUEST' },
  { name: 'home-weight', route: '/home', persona: 'man', layout: 'weight', notes: 'Home weight layout', visible: 'Home (food & weight) — budget, quick log, weight' },
  { name: 'water', route: '/health-metrics/hydration', notes: 'hydration', visible: 'Water — today’s glasses toward the goal' },
  { name: 'steps', route: '/health-metrics/steps', notes: 'steps', visible: 'Steps — today and the week' },
  { name: 'profile', route: '/profile', notes: 'profile tab', visible: 'Profile — header, Quest card, settings' },
  { name: 'welcome', route: '/welcome', signedOut: true, warm: false, full: false, notes: 'signed out welcome', visible: 'Welcome — ქართული | English pill, დავიწყოთ' },
];
