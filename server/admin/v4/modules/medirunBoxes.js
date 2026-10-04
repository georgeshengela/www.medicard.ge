/**
 * MediCard Admin V4 — #/medirun-boxes „MEDIRUN ყუთები“ (/api/admin/medipulsi/drops*).
 * Owner 2026-10-04: one place to run the „გაანათე თბილისი“ boxes — when they drop, how many, where, with what.
 *   დღეს       live numbers, today's / tomorrow's / any date's boxes, manual drop, per-box actions, rebuild / cancel a day
 *   ქალაქები   every other city with a player: spots from OpenStreetMap, players, local time, on/off, boxes
 *   წესები     the weekly rules: weekday / weekend waves, coins table, stock, radii, Saturday rain + lanterns,
 *              the grand prize, weekly themes and levels — a draft with preview before saving
 *   კალენდარი  every campaign date: what the rules place, a day switched off / run as a weekend / own rules
 *   ადგილები   the 255 park spots: take a bad one out, see how often each was used
 *   ციფრები    boxes, openings, players and coins per day, by district
 *   ჟურნალი    every admin change (lib/medipulsi/dropsAdmin.js audits each write)
 * The autopilot only adds boxes that do not exist yet: a rule change reaches boxes not created so far.
 */
(function adminV4MedirunBoxes(global) {
  const doc = document;
  const $ = (id) => doc.getElementById(id);
  const V = () => global.AdminV3 || {};
  const api = (path, opts) => global.api(`/medipulsi/drops${path}`, opts);
  const toast = (m, k) => global.toast?.(m, k);
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const ico = (n) => (typeof global.icon === 'function' ? global.icon(n) : '');
  const num = (n) => (Number.isFinite(Number(n)) ? Number(n).toLocaleString('ka-GE') : '—');
  const say = (err, fallback) => (/[ა-ჿ]/.test(err?.message || '') ? err.message : fallback);
  const when = (iso, mode = 'datetime') => (V().formatDate ? V().formatDate(iso, mode) : String(iso || ''));
  const skel = () => '<div class="p4-skel" aria-busy="true" aria-label="იტვირთება"><i class="is-bar"></i><i class="is-tiles"></i><i class="is-block"></i></div>';
  const failHtml = (err) => `<section class="s-card"><div class="s-empty">${ico('alert')}<strong>ვერ ჩაიტვირთა</strong><span>${esc(say(err, 'სცადე ხელახლა.'))}</span><button type="button" class="btn" data-retry>${ico('refresh')} ხელახლა ცდა</button></div></section>`;

  if (typeof ICONS === 'object') {
    ICONS.box = ICONS.box || '<path d="M21 8 12 3 3 8v8l9 5 9-5V8Z"/><path d="m3 8 9 5 9-5"/><path d="M12 13v8"/>';
    ICONS.plus = ICONS.plus || '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>';
    ICONS.trash = ICONS.trash || '<polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>';
    ICONS.pin = ICONS.pin || '<path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11Z"/><circle cx="12" cy="10" r="2.5"/>';
  }

  const SUBS = [['today', 'დღეს'], ['cities', 'ქალაქები'], ['rules', 'წესები'], ['calendar', 'კალენდარი'], ['spots', 'ადგილები'], ['stats', 'ციფრები'], ['log', 'ჟურნალი']];
  const WEEKDAYS = ['კვ', 'ორშ', 'სამ', 'ოთხ', 'ხუთ', 'პარ', 'შაბ'];
  const MONTHS = ['იან', 'თებ', 'მარ', 'აპრ', 'მაი', 'ივნ', 'ივლ', 'აგვ', 'სექ', 'ოქტ', 'ნოე', 'დეკ'];
  const STATUS = { planned: ['დაგეგმილი', 'is-info'], live: ['ქალაქშია', 'is-ok'], empty: ['ამოიწურა', 'is-warn'], ended: ['დასრულდა', 'is-plain'], canceled: ['გაუქმდა', 'is-bad'], hidden: ['დამალული', 'is-plain'] };
  const KIND = { am: 'დილის ტალღა', md: 'შუადღის ტალღა', ev: 'საღამოს ტალღა', saturday: 'შაბათის წვიმა', lantern: 'ფარანი', manual: 'ხელით', grand: 'დიდი საჩუქარი', admin: 'ადმინის', prize: 'პრიზი' };
  const kindLabel = (k) => KIND[k] || `ტალღა „${k}“`;
  const THEMES = { oldtown: 'ძველი ქალაქი', green: 'მწვანე', horizon: 'ხედები', culture: 'კულტურა', districts: 'უბნები' };
  const ACTIONS = {
    DROP_RULES_SAVE: 'წესები შეინახა', DROP_RULES_RESET: 'წესები ფაილის მნიშვნელობებზე დაბრუნდა', DROP_DAY_RULE: 'დღის წესი შეიცვალა', DROP_SPOT_EXCLUDE: 'ადგილი გამოირიცხა', DROP_SPOT_RESTORE: 'ადგილი დაბრუნდა',
    DROP_DAY_APPLY: 'დღის ყუთები შეიქმნა', DROP_DAY_REBUILD: 'დღე ხელახლა აეწყო', DROP_DAY_CANCEL: 'დღის ყუთები გაუქმდა', DROP_MANUAL: 'ყუთი ხელით დაიგდო',
    DROP_BOX_END: 'ყუთი დასრულდა', DROP_BOX_CANCEL: 'ყუთი გაუქმდა', DROP_BOX_RESTORE: 'ყუთი აღდგა', DROP_BOX_STOCK: 'მარაგი შეიცვალა', DROP_BOX_COINS: 'ქოინები შეიცვალა', DROP_BOX_TIME: 'დრო შეიცვალა',
    DROP_CITY_ADD: 'ქალაქი დაემატა', DROP_CITY_RULE: 'ქალაქის წესი შეიცვალა', DROP_CITY_HARVEST: 'ქალაქის ადგილები განახლდა', DROP_CITY_APPLY: 'ქალაქის ყუთები შეიქმნა',
    DROP_AUTOPILOT_ON: 'ავტოპილოტი ჩაირთო', DROP_AUTOPILOT_OFF: 'ავტოპილოტი გამოირთო', GIFT_SAVE: 'საჩუქარი შეიცვალა (MEDIRUN გვერდიდან)',
    DROP_RULES_UPGRADE: 'წესები ახალ ეკონომიკაზე გადავიდა', DROP_BUDGET_WARN: 'ბიუჯეტის გაფრთხილება', DROP_BUDGET_STOP: 'ბიუჯეტი ამოიწურა — ყუთები შეჩერდა', DROP_WEEK_PRIZES: 'კვირის პრიზები ჩაირიცხა',
  };
  /* Economy 2: the first-finder ladder, mirrored from giftRules.js (rounded to 5, never below 5). */
  const ladderOf = (coins, stock, decay) => { const d = Array.isArray(decay) && decay.length ? decay : [100]; return Array.from({ length: Math.max(0, Math.round(stock)) }, (_, i) => { const pct = d[Math.min(i, d.length - 1)]; return pct >= 100 ? coins : Math.max(5, Math.round((coins * pct) / 100 / 5) * 5); }); };
  const ladderSum = (coins, stock, decay) => ladderOf(coins, stock, decay).reduce((s, n) => s + n, 0);
  const ladderText = (ladder) => (ladder.length > 1 ? ladder.map((n, i) => `${i === 0 ? '1-ლი' : i === ladder.length - 1 && ladder.length > 2 ? 'ბოლო' : `მე-${i + 1}`} ${num(n)}`).join(' · ') : ladder.length ? `${num(ladder[0])}` : '—');

  const st = { sub: 'today', o: null, day: null, dayBoxes: null, draft: null, dirty: false, cal: null, calFilter: 'future', spots: null, spotQ: '', spotDistrict: 'all', spotOnlyOut: false, statsDays: 30, stats: null, log: null, logOffset: 0, timer: null };

  /* ─────────────── time (Asia/Tbilisi) ─────────────── */
  const TB = 4 * 3600_000;
  const tb = (iso) => new Date(Date.parse(iso) + TB).toISOString();
  const clock = (iso) => tb(iso).slice(11, 16);
  const ymdOf = (iso) => tb(iso).slice(0, 10);
  const dayLabel = (ymd) => { const [y, m, d] = ymd.split('-').map(Number); return `${d} ${MONTHS[m - 1]}, ${WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]}`; };
  const addDays = (ymd, n) => new Date(Date.parse(`${ymd}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
  const daysBetween = (a, b) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);
  const tbIso = (ymd, hhmm) => `${ymd}T${hhmm}:00+04:00`;
  function leftText(iso) {
    const ms = Date.parse(iso) - Date.now();
    if (ms <= 0) return 'ახლა';
    const h = Math.floor(ms / 3600_000), m = Math.floor((ms % 3600_000) / 60_000);
    return h >= 24 ? `${Math.floor(h / 24)} დღე ${h % 24} სთ` : h ? `${h} სთ ${m} წთ` : `${m} წთ`;
  }

  /* ─────────────── „ლოკაცია“: Google Maps link or coordinates → the exact point ─────────────── */
  // Same rules as server lib/medipulsi/mapLink.js: the place pin (!3d…!4d…) beats the map centre (@lat,lng).
  function parseMapLocation(input) {
    let text = String(input || '').trim();
    if (!text) return null;
    try { text = decodeURIComponent(text); } catch { /* keep */ }
    const ok = (a, b) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a) <= 90 && Math.abs(b) <= 180 && !(a === 0 && b === 0);
    for (const [re, source] of [[/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/, 'pin'], [/[?&](?:q|query|ll|destination|center)=(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/, 'query'], [/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/, 'center'], [/^\s*(-?\d{1,2}(?:\.\d+)?)\s*[,; ]\s*(-?\d{1,3}(?:\.\d+)?)\s*$/, 'coordinates']]) {
      const m = re.exec(text);
      if (m && ok(Number(m[1]), Number(m[2]))) return { latitude: Number(m[1]), longitude: Number(m[2]), source };
    }
    return null;
  }
  const LOC_SOURCE = { pin: 'ზუსტი ადგილი (პინი)', query: 'ბმულის წერტილი', center: 'რუკის ცენტრი — თუ შეიძლება, ჩასვი ადგილის ბმული', coordinates: 'კოორდინატები' };
  function locationField() {
    return `<label class="s-field mb-wide"><span>ლოკაცია</span><input type="text" data-loc-link autocomplete="off" placeholder="ჩასვი Google Maps-ის ბმული ან კოორდინატები (41.7098, 44.7509)"><small data-loc-status>Google Maps-ში გახსენი ადგილი → „გაზიარება“ ან მისამართის ზოლი → ბმული ჩასვი აქ. კოორდინატები თავად ამოვა.</small></label>`;
  }
  /** Fills latitude / longitude from the „ლოკაცია“ field; short share links go through the server. */
  function bindLocationField(scope) {
    const link = scope.querySelector('[data-loc-link]'), status = scope.querySelector('[data-loc-status]');
    const lat = scope.querySelector('[name=latitude]'), lng = scope.querySelector('[name=longitude]');
    if (!link || !lat || !lng) return;
    let seq = 0, timer = null;
    const show = (found) => {
      lat.value = found.latitude; lng.value = found.longitude;
      status.innerHTML = `<b class="mb-loc-ok">✓ ${esc(found.latitude.toFixed(6))}, ${esc(found.longitude.toFixed(6))}</b> · ${esc(LOC_SOURCE[found.source] || '')} · <a href="https://www.google.com/maps?q=${found.latitude},${found.longitude}" target="_blank" rel="noopener">რუკაზე შემოწმება ↗</a>`;
      lat.dispatchEvent(new Event('input', { bubbles: true }));
    };
    const run = async () => {
      const value = link.value.trim(), mine = ++seq;
      if (!value) return;
      const local = parseMapLocation(value);
      if (local) { show(local); return; }
      if (!/^https:\/\//.test(value)) { status.innerHTML = '<span class="mb-loc-bad">ადგილი ვერ ამოვიღე — ჩასვი Google Maps-ის ბმული ან კოორდინატები.</span>'; return; }
      status.textContent = 'ბმულს ვხსნი…';
      try { const found = await api('/resolve-location', { method: 'POST', body: { link: value } }); if (mine === seq) show(found); }
      catch (err) { if (mine === seq) status.innerHTML = `<span class="mb-loc-bad">${esc(say(err, 'ადგილი ვერ ამოვიღე.'))}</span>`; }
    };
    link.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(run, 350); });
    link.addEventListener('paste', () => { clearTimeout(timer); timer = setTimeout(run, 50); });
  }

  /* ─────────────── hash state ─────────────── */
  const hashParams = () => (typeof global.hashSearch === 'function' ? global.hashSearch() : new URLSearchParams(location.hash.split('?')[1] || ''));
  function writeSub(sub) {
    const params = hashParams();
    params.set('tab', sub);
    const next = `#/medirun-boxes?${params.toString()}`;
    if (location.hash !== next) history.replaceState({ tab: 'medirun-boxes' }, '', next);
  }

  /* ═════════ Shell ═════════ */
  async function renderMedirunBoxes() {
    const root = $('tab-medirun-boxes');
    if (!root) return;
    const want = hashParams().get('tab');
    if (SUBS.some(([k]) => k === want)) st.sub = want;
    root.innerHTML = `<div class="s-stack v3-tab-shell mb-page">${skel()}</div>`;
    try {
      st.o = await api('');
    } catch (err) {
      root.innerHTML = `<div class="s-stack v3-tab-shell mb-page">${failHtml(err)}</div>`;
      root.querySelector('[data-retry]')?.addEventListener('click', () => void renderMedirunBoxes());
      return;
    }
    if (!st.day) st.day = st.o.today;
    if (!st.draft || !st.dirty) st.draft = structuredClone(st.o.campaign);
    root.innerHTML = `<div class="s-stack v3-tab-shell mb-page">
      <div class="mb-head" data-mb-head>${headHtml()}</div>
      <div class="s-tabbar">
        <nav class="v3-subnav" role="tablist" aria-label="ყუთების განყოფილებები">${SUBS.map(([k, l]) => `<button type="button" role="tab" class="v3-subnav-btn${k === st.sub ? ' is-active' : ''}" data-mb-sub="${k}" aria-selected="${k === st.sub}">${l}</button>`).join('')}</nav>
      </div>
      <div data-mb-body></div>
    </div>`;
    bindHead(root);
    root.querySelectorAll('[data-mb-sub]').forEach((b) => b.addEventListener('click', () => {
      if (st.sub === 'rules' && st.dirty && b.dataset.mbSub !== 'rules' && !global.confirm?.('წესებში შეუნახავი ცვლილებებია. მაინც გადახვალ?')) return;
      st.sub = b.dataset.mbSub;
      writeSub(st.sub);
      root.querySelectorAll('[data-mb-sub]').forEach((x) => { const on = x === b; x.classList.toggle('is-active', on); x.setAttribute('aria-selected', String(on)); });
      void paintSub();
    }));
    await paintSub();
    clearInterval(st.timer);
    st.timer = setInterval(() => {
      if (!doc.getElementById('tab-medirun-boxes')?.offsetParent) { clearInterval(st.timer); return; }
      const el = doc.querySelector('[data-mb-next-left]');
      if (el && st.o?.next) el.textContent = leftText(st.o.next.startsAt);
    }, 30_000);
  }

  async function refreshHead() {
    try { st.o = await api(''); } catch { return; }
    const head = doc.querySelector('[data-mb-head]');
    if (head) { head.innerHTML = headHtml(); bindHead(head); }
  }

  /* ─────────────── head: status, rules source, autopilot, live numbers ─────────────── */
  function headHtml() {
    const o = st.o, c = o.campaign, a = o.autopilot;
    const length = daysBetween(c.start, c.end) + 1;
    const phase = o.status === 'upcoming' ? ['is-info', daysBetween(o.today, c.start) === 1 ? 'იწყება ხვალ' : `იწყება ${num(daysBetween(o.today, c.start))} დღეში`]
      : o.status === 'ended' ? ['is-plain', 'დასრულდა'] : ['is-ok', `მიმდინარე · დღე ${num(daysBetween(c.start, o.today) + 1)} / ${num(length)}`];
    const rules = o.rules.source === 'admin'
      ? `<span class="s-badge is-accent" title="${esc(o.rules.updatedAt ? when(o.rules.updatedAt) : '')}">წესები: ადმინიდან · ვერსია ${num(o.rules.revision)}</span>`
      : '<span class="s-badge is-plain">წესები: ნაგულისხმევი (ფაილი)</span>';
    const pilotNote = a.envOff ? 'გამორთულია სერვერის პარამეტრით (MEDIRUN_AUTOPILOT=off)' : !a.medirun ? 'MEDIRUN მოდული შეჩერებულია „მოდულებში“' : a.enabled ? 'ყოველ 10 წუთში ქმნის დღევანდელ და ხვალინდელ ყუთებს' : 'ახალი ყუთები თავისით აღარ ჩნდება';
    const n = o.next, b = o.budget;
    return `<section class="s-card mb-hero">
        <div class="mb-hero-main">
          <div class="mb-hero-title"><span class="mb-hero-mark">${ico('box')}</span><div><h2>${esc(c.name.ka)}</h2><p>${esc(dayLabel(c.start))} – ${esc(dayLabel(c.end))} · თბილისი</p></div></div>
          <div class="mb-hero-badges"><span class="s-badge ${phase[0]}">${esc(phase[1])}</span>${rules}${o.rules.invalid ? '<span class="s-badge is-bad">შენახული წესები დაზიანებულია — მუშაობს ფაილი</span>' : ''}${o.budget?.stopped ? '<span class="s-badge is-bad">ბიუჯეტი ამოიწურა — ავტოპილოტი ახალ ყუთს აღარ დებს</span>' : ''}</div>
        </div>
        <label class="mb-pilot${a.enabled ? ' is-on' : ''}">
          <input class="s-switch" type="checkbox" role="switch" data-mb-pilot ${a.flag ? 'checked' : ''} ${a.envOff ? 'disabled' : ''} aria-label="ავტოპილოტი">
          <span><b>ავტოპილოტი ${a.enabled ? 'ჩართულია' : 'გამორთულია'}</b><small>${esc(pilotNote)}</small></span>
        </label>
      </section>
      <div class="s-metrics">
        <div class="s-metric${o.live.boxes ? ' is-ok' : ''}"><span>ყუთი ახლა ქალაქში</span><strong>${num(o.live.boxes)}</strong><small>${o.live.boxes ? `კიდევ ${num(o.live.openingsLeft)} გახსნა დარჩა` : 'ამ წუთას არცერთი'}</small></div>
        <div class="s-metric"><span>დღეს გაიხსნა</span><strong>${num(o.live.openedToday)}</strong><small>${num(o.live.playersToday)} მოთამაშე</small></div>
        <div class="s-metric"><span>ქოინი დღეს</span><strong>${num(o.live.coinsToday)}</strong><small>ბალანსებზე ჩაირიცხა</small></div>
        <div class="s-metric"><span>შემდეგი ყუთები</span><strong>${n ? esc(clock(n.startsAt)) : '—'}</strong><small>${n ? `${ymdOf(n.startsAt) === o.today ? 'დღეს' : 'ხვალ'} · ${num(n.boxes)} ყუთი · პირველს ${num(n.coins.min)}–${num(n.coins.max)} ქოინი · <span data-mb-next-left>${esc(leftText(n.startsAt))}</span>` : 'დაგეგმილი ყუთი არ არის'}</small></div>
        ${b ? `<div class="s-metric${b.stopped ? ' is-bad' : b.percent >= 80 ? ' is-warn' : ''}"><span>სეზონის ბიუჯეტი</span><strong>${num(b.paid)} <small>/ ${num(b.seasonCoins)}</small></strong><small>${b.seasonCoins ? `${b.percent}% გაცემულია · დარჩა ${num(b.left)} ქოინი, ${num(b.daysLeft)} დღე (≈ ${num(b.perDayLeft)}/დღე) · ამ ტემპით ≈ ${num(b.projected)}` : 'ბიუჯეტი არ არის დაწესებული — „წესები → ეკონომიკა“'}</small></div>` : ''}
      </div>`;
  }
  function bindHead(scope) {
    scope.querySelector('[data-mb-pilot]')?.addEventListener('change', async (e) => {
      const input = e.currentTarget, enabled = input.checked;
      input.disabled = true;
      try {
        st.o.autopilot = await api('/autopilot', { method: 'PUT', body: { enabled } });
        toast(enabled ? 'ავტოპილოტი ჩაირთო' : 'ავტოპილოტი გამოირთო — ახალი ყუთები თავისით აღარ შეიქმნება', enabled ? 'ok' : 'warn');
        await refreshHead();
      } catch (err) { input.checked = !enabled; input.disabled = false; toast(say(err, 'ვერ შეიცვალა. სცადე ხელახლა.'), 'bad'); }
    });
  }

  async function paintSub() {
    const body = doc.querySelector('[data-mb-body]');
    if (!body) return;
    body.innerHTML = skel();
    try {
      if (st.sub === 'today') await paintToday(body);
      else if (st.sub === 'cities') await paintCities(body);
      else if (st.sub === 'rules') paintRules(body);
      else if (st.sub === 'calendar') await paintCalendar(body);
      else if (st.sub === 'spots') await paintSpots(body);
      else if (st.sub === 'stats') await paintStats(body);
      else await paintLog(body);
    } catch (err) {
      body.innerHTML = failHtml(err);
      body.querySelector('[data-retry]')?.addEventListener('click', () => void paintSub());
    }
  }

  /* ═════════ დღეს — boxes of a date ═════════ */
  async function paintToday(body) {
    const o = st.o;
    const res = st.day === o.today || st.day === o.tomorrow ? { boxes: o.boxes[st.day] } : await api(`/day/${st.day}`);
    st.dayBoxes = res.boxes || [];
    const boxes = st.dayBoxes;
    const rule = st.day === o.today ? o.dayToday : st.day === o.tomorrow ? o.dayTomorrow : null;
    const totals = boxes.filter((b) => b.status !== 'canceled').reduce((s, b) => ({ n: s.n + 1, cap: s.cap + b.stock, opened: s.opened + b.allocated, coins: s.coins + (Number.isFinite(b.maxCoins) ? b.maxCoins : b.coins * b.stock) }), { n: 0, cap: 0, opened: 0, coins: 0 });
    const inCampaign = st.day >= o.campaign.start && st.day <= o.campaign.end;
    body.innerHTML = `<div class="s-stack">
      ${rule?.off ? `<div class="s-callout is-warn">${ico('alert')}<p><b>ეს დღე გამორთულია კალენდარში.</b> ავტოპილოტი ამ დღეს ყუთებს არ ქმნის${rule.override?.note ? ` · ${esc(rule.override.note)}` : ''}.</p></div>` : ''}
      <div class="s-toolbar">
        <div class="s-segment" role="tablist" aria-label="დღე">
          <button type="button" role="tab" data-mb-day="${o.today}" aria-selected="${st.day === o.today}">დღეს</button>
          <button type="button" role="tab" data-mb-day="${o.tomorrow}" aria-selected="${st.day === o.tomorrow}">ხვალ</button>
        </div>
        <label class="s-field mb-inline"><span class="sr-only">თარიღი</span><input type="date" value="${esc(st.day)}" data-mb-date></label>
        <span class="s-muted">${esc(dayLabel(st.day))}${rule ? ` · ${rule.kind === 'weekend' ? 'შაბათ-კვირის წესით' : 'სამუშაო დღის წესით'}${rule.override && !rule.off ? ' (შეცვლილი)' : ''}` : ''}</span>
        <span class="mb-grow"></span>
        <button type="button" class="btn primary" data-mb-drop>${ico('plus')} ყუთის დაგდება</button>
      </div>
      <section class="s-card">
        <header class="s-card-head"><div><h3>ყუთები · ${esc(dayLabel(st.day))}</h3>
          <p>${num(totals.n)} ყუთი · ${num(totals.cap)} გახსნა · ${num(totals.opened)} გაიხსნა · მაქს. ${num(totals.coins)} ქოინი</p></div>
          ${inCampaign ? `<div class="p4-actions">
            <button type="button" class="btn compact" data-mb-apply title="შექმნის წესებით დაგეგმილ ყუთებს, რომლებიც ჯერ არ არსებობს">ნაკლულის შექმნა</button>
            <button type="button" class="btn compact" data-mb-rebuild title="წაშლის ჯერ დაუწყებელ და გაუხსნელ ყუთებს და თავიდან ააწყობს მიმდინარე წესებით">ხელახლა აწყობა</button>
            <button type="button" class="btn compact danger" data-mb-cancel-day>დღის გაუქმება</button>
          </div>` : ''}
        </header>
        <div class="s-card-body is-flush">${boxes.length ? `<div class="s-table-wrap"><table class="s-table mb-table">
          <thead><tr><th>დრო</th><th>ადგილი</th><th>ტიპი</th><th class="num">შიგთავსი</th><th>გახსნა</th><th>სტატუსი</th><th aria-label="მოქმედებები"></th></tr></thead>
          <tbody>${boxes.map(boxRowHtml).join('')}</tbody></table></div>`
          : `<div class="s-empty">${ico('box')}<strong>ამ დღეს ყუთი ჯერ არ არის</strong><span>${inCampaign ? (rule?.off ? 'დღე გამორთულია კალენდარში.' : 'ავტოპილოტი ყუთებს წინა დღეს ქმნის. „ნაკლულის შექმნა“ ახლავე შექმნის.') : 'თარიღი კამპანიის გარეთაა — ყუთი შეგიძლია ხელით დააგდო.'}</span></div>`}</div>
      </section>
      <p class="s-muted mb-note">${ico('pin')} ადგილს რუკაზე ხედავ სტრიქონის 📍 ღილაკით. მოთამაშეები ზუსტ ადგილს ვერ ხედავენ — აპში ჩანს მხოლოდ უბანი და რაოდენობა.</p>
    </div>`;
    body.querySelectorAll('[data-mb-day]').forEach((b) => b.addEventListener('click', () => { st.day = b.dataset.mbDay; void paintSub(); }));
    body.querySelector('[data-mb-date]').addEventListener('change', (e) => { if (e.target.value) { st.day = e.target.value; void paintSub(); } });
    body.querySelector('[data-mb-drop]').onclick = () => openDropDialog();
    body.querySelector('[data-mb-apply]')?.addEventListener('click', (e) => dayOp('apply', e.currentTarget));
    body.querySelector('[data-mb-rebuild]')?.addEventListener('click', (e) => dayOp('regenerate', e.currentTarget));
    body.querySelector('[data-mb-cancel-day]')?.addEventListener('click', (e) => dayOp('cancel', e.currentTarget));
    body.querySelectorAll('[data-mb-box]').forEach((tr) => {
      const box = boxes.find((b) => b.id === tr.dataset.mbBox);
      tr.addEventListener('click', (e) => { if (!e.target.closest('a')) openBoxCard(box); });
      tr.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target === tr) { e.preventDefault(); openBoxCard(box); } });
    });
  }

  const KIND_TONE = { manual: 'is-accent', prize: 'is-warn', grand: 'is-ok', saturday: 'is-info', lantern: 'is-accent' };
  function boxRowHtml(b) {
    const [label, tone] = STATUS[b.status] || [b.status, 'is-plain'];
    const pct = b.stock ? Math.round((b.allocated / b.stock) * 100) : 0;
    const map = `https://www.google.com/maps?q=${b.latitude},${b.longitude}`;
    const prize = b.kind === 'grand' || b.rewardKind === 'PHYSICAL';
    return `<tr class="is-click" tabindex="0" data-mb-box="${esc(b.id)}">
      <td data-label="დრო"><span class="mb-time">${esc(clock(b.startsAt))}<i>–</i>${esc(clock(b.endsAt))}</span>${ymdOf(b.endsAt) !== ymdOf(b.startsAt) ? `<small class="s-muted mb-sub">${esc(dayLabel(ymdOf(b.endsAt)))}-მდე</small>` : ''}</td>
      <td data-label="ადგილი"><div class="mb-place"><b>${esc(b.place || 'კოორდინატი')}</b><span>${esc(b.city ? `${b.city}${b.district && b.district !== b.place ? ` · ${b.district}` : ''}` : (b.district || '—'))}</span></div></td>
      <td data-label="ტიპი"><span class="s-badge ${KIND_TONE[b.kind] || 'is-plain'}">${esc(kindLabel(b.kind))}</span>${b.minPercent ? `<small class="s-muted mb-sub">${esc(String(b.minPercent))}%-დან</small>` : ''}</td>
      <td data-label="შიგთავსი" class="num"><b>${prize ? esc(b.title || 'პრიზი') : `${num(b.coins)}`}</b>${prize ? '' : `<small class="s-muted mb-sub">${b.ladder && b.ladder.length > 1 && b.ladder[0] !== b.ladder[b.ladder.length - 1] ? `პირველს · შემდეგ ${esc(b.ladder.slice(1, 4).map(num).join(' · '))}` : 'ქოინი'}</small>`}</td>
      <td data-label="გახსნა"><div class="mb-open"><div class="s-meter${pct >= 100 ? ' is-warn' : ''}" role="img" aria-label="${pct}%"><i style="width:${pct}%"></i></div><small>${num(b.allocated)} / ${num(b.stock)}</small></div></td>
      <td data-label="სტატუსი"><span class="s-badge ${tone}">${esc(label)}</span></td>
      <td><div class="p4-actions is-end mb-row-actions">
        <a class="btn compact mb-icon-btn" href="${esc(map)}" target="_blank" rel="noopener" title="რუკაზე ნახვა" aria-label="რუკაზე ნახვა">${ico('pin')}</a>
        <button type="button" class="btn compact" data-act="open">მართვა</button>
      </div></td>
    </tr>`;
  }

  /** The box card: every fact and every action of one box in one place. */
  function openBoxCard(box) {
    const [label, tone] = STATUS[box.status] || [box.status, 'is-plain'];
    const prize = box.kind === 'grand' || box.rewardKind === 'PHYSICAL';
    const fact = (k, v) => `<div><dt>${esc(k)}</dt><dd>${v}</dd></div>`;
    const can = { end: box.status === 'live' || box.status === 'empty', cancel: ['planned', 'live', 'empty', 'hidden'].includes(box.status), restore: box.status === 'canceled', edit: !['canceled', 'ended'].includes(box.status) };
    const actions = [
      can.edit && !prize ? ['coins', 'ქოინის შეცვლა', ''] : null,
      can.edit && prize ? ['text', 'ტექსტის შეცვლა', ''] : null,
      can.edit ? ['stock', 'მარაგის შეცვლა', ''] : null,
      can.edit ? ['time', 'დროის შეცვლა', ''] : null,
      can.edit && !box.allocated ? ['place', 'ადგილის შეცვლა', ''] : null,
      can.end ? ['end', 'ახლავე დასრულება', ''] : null,
      can.cancel ? ['cancel', 'გაუქმება', 'danger'] : null,
      can.restore ? ['restore', 'აღდგენა', 'primary'] : null,
    ].filter(Boolean);
    const d = V().openDialog?.({
      title: box.place || 'ყუთი', description: [box.city, box.district && box.district !== box.place ? box.district : null].filter(Boolean).join(' · ') || 'თბილისი', wide: true, watchDirty: false,
      body: `<div class="mb-card">
        <div class="mb-card-badges"><span class="s-badge ${tone}">${esc(label)}</span><span class="s-badge ${KIND_TONE[box.kind] || 'is-plain'}">${esc(kindLabel(box.kind))}</span>${box.minPercent ? `<span class="s-badge is-plain">ჩანს ${esc(String(box.minPercent))}%-დან</span>` : ''}</div>
        <dl class="mb-facts">
          ${fact('დრო', `${esc(dayLabel(ymdOf(box.startsAt)))}, ${esc(clock(box.startsAt))}–${esc(clock(box.endsAt))}`)}
          ${fact(prize ? 'პრიზი' : 'პირველ გამხსნელს', prize ? esc(box.title || 'პრიზი') : `<b>${num(box.coins)}</b> Medi Coins`)}
          ${!prize && box.ladder?.length ? fact('გახსნების კიბე', `${esc(ladderText(box.ladder))}<br><small class="s-muted">სულ მაქს. ${num(box.maxCoins)} ქოინი</small>`) : ''}
          ${fact('გაიხსნა', `<b>${num(box.allocated)}</b> / ${num(box.stock)}`)}
          ${fact('რადიუსი', `პულსი ${num(box.pulseRadius)} მ · გახსნა ${num(box.revealRadius)} მ`)}
          ${fact('კოორდინატი', `<a href="https://www.google.com/maps?q=${box.latitude},${box.longitude}" target="_blank" rel="noopener">${esc(Number(box.latitude).toFixed(5))}, ${esc(Number(box.longitude).toFixed(5))} ↗</a>`)}
          ${fact('ID', `<code class="mb-code">${esc(box.id)}</code>`)}
        </dl>
        ${actions.length ? `<div class="mb-card-actions">${actions.map(([k, l, t]) => `<button type="button" class="btn${t ? ` ${t}` : ''}" data-card-act="${k}">${esc(l)}</button>`).join('')}</div>` : '<p class="s-muted">დასრულებულ ყუთს ცვლილება აღარ სჭირდება.</p>'}
      </div>`,
      footer: '<button type="button" class="btn" data-no>დახურვა</button>',
    });
    const panel = doc.querySelector('#v3-dialog .v3-dialog-panel');
    panel.querySelector('[data-no]').onclick = () => void d.close();
    panel.querySelectorAll('[data-card-act]').forEach((btn) => btn.addEventListener('click', async () => { await d.close(); void boxAct(box, btn.dataset.cardAct, null); }));
  }

  async function reloadDay() {
    st.o = await api('');
    await refreshHead();
    await paintSub();
  }

  async function dayOp(op, btn) {
    const copy = {
      apply: ['ნაკლული ყუთების შექმნა', `შეიქმნება ${dayLabel(st.day)}-ის ყუთები, რომლებიც წესებით დაგეგმილია და ჯერ არ არსებობს (უკვე დასრულებული ტალღები გამოტოვდება).`, 'შექმნა', false],
      regenerate: ['დღის ხელახლა აწყობა', 'ჯერ დაუწყებელი და გაუხსნელი ყუთები წაიშლება და მიმდინარე წესებით თავიდან აეწყობა. დაწყებული, გახსნილი და ხელით დაგდებული ყუთები რჩება.', 'ხელახლა აწყობა', false],
      cancel: ['დღის გაუქმება', 'ამ დღის ყველა ყუთი, რომელიც ჯერ არ დასრულებულა, რუკიდან მოიხსნება. უკვე გაცემული ქოინები რჩება. თუ გინდა, რომ ავტოპილოტმა ამ დღეს ახლიდან აღარ შექმნას, დღე კალენდარშიც გამორთე.', 'გაუქმება', true],
    }[op];
    const ok = await confirmDialog(copy[0], copy[1], copy[2], copy[3]);
    if (!ok) return;
    btn.disabled = true;
    try {
      const r = await api(`/days/${st.day}/${op}`, { method: 'POST' });
      toast(op === 'apply' ? `შეიქმნა ${num(r.created)} ყუთი` : op === 'regenerate' ? `წაიშალა ${num(r.removed)}, შეიქმნა ${num(r.created)}` : `გაუქმდა ${num(r.archived)} ყუთი`, op === 'cancel' ? 'warn' : 'ok');
      await reloadDay();
    } catch (err) { btn.disabled = false; toast(say(err, 'ვერ შესრულდა. სცადე ხელახლა.'), 'bad'); }
  }

  function confirmDialog(title, text, okLabel, danger) {
    return new Promise((resolve) => {
      let done = false;
      const d = V().openDialog?.({ title, description: '', body: `<p class="mb-confirm">${esc(text)}</p>`, footer: `<button type="button" class="btn" data-no>გაუქმება</button><button type="button" class="btn ${danger ? 'danger' : 'primary'}" data-yes>${esc(okLabel)}</button>`, onClose: () => { if (!done) resolve(false); } });
      if (!d) { resolve(global.confirm?.(text) ?? false); return; }
      const panel = doc.querySelector('#v3-dialog .v3-dialog-panel');
      panel.querySelector('[data-no]').onclick = () => void d.close();
      panel.querySelector('[data-yes]').onclick = () => { done = true; resolve(true); void d.close(); };
    });
  }

  async function boxAct(box, act, btn) {
    if (act === 'end' || act === 'cancel' || act === 'restore') {
      const copy = { end: ['ყუთის დასრულება', 'ყუთი ახლავე ჩაიხურება — მოთამაშეები ვეღარ გახსნიან.', 'დასრულება', true], cancel: ['ყუთის გაუქმება', 'ყუთი რუკიდან მოიხსნება. უკვე გაცემული ქოინები რჩება.', 'გაუქმება', true], restore: ['ყუთის აღდგენა', 'ყუთი ისევ გამოჩნდება თავის დროს.', 'აღდგენა', false] }[act];
      if (!(await confirmDialog(...copy))) return;
      return sendBox(box, { action: act }, btn);
    }
    const fields = {
      coins: `<label class="s-field"><span>ქოინი ყუთში</span><input type="number" name="coins" min="1" max="10000" step="1" value="${box.coins}" required><small>ერთი გახსნა = ამდენი Medi Coins</small></label>`,
      stock: `<label class="s-field"><span>რამდენჯერ იხსნება</span><input type="number" name="stock" min="${box.allocated}" max="100000" step="1" value="${box.stock}" required><small>უკვე გაიხსნა ${num(box.allocated)}-ჯერ — ნაკლები ვერ იქნება</small></label>`,
      text: `<label class="s-field"><span>სახელი (ქართ.)</span><input type="text" name="title" minlength="2" maxlength="100" value="${esc(box.title || '')}" required></label>
        <label class="s-field"><span>აღწერა</span><textarea name="description" rows="3" maxlength="1000"></textarea></label>
        <label class="s-field"><span>სახელი (ინგლ.)</span><input type="text" name="titleEn" maxlength="100"></label>`,
      place: `<div class="s-form-grid">
        ${locationField()}
        <label class="s-field"><span>Latitude</span><input type="number" name="latitude" step="0.000001" min="-90" max="90" value="${box.latitude}" required></label>
        <label class="s-field"><span>Longitude</span><input type="number" name="longitude" step="0.000001" min="-180" max="180" value="${box.longitude}" required></label></div>
        <small class="s-muted">მხოლოდ საჯარო, უსაფრთხო საფეხმავლო ადგილი. გახსნილ ყუთს ადგილი აღარ ეცვლება.</small>`,
      time: `<div class="s-form-grid">
        <label class="s-field"><span>დაწყება (თბილისი)</span><input type="datetime-local" name="startsAt" value="${tb(box.startsAt).slice(0, 16)}" ${box.allocated ? 'disabled' : ''} required></label>
        <label class="s-field"><span>დასრულება (თბილისი)</span><input type="datetime-local" name="endsAt" value="${tb(box.endsAt).slice(0, 16)}" required></label></div>`,
    }[act];
    const d = V().openDialog?.({
      title: { coins: 'ქოინების შეცვლა', stock: 'მარაგის შეცვლა', time: 'დროის შეცვლა', text: 'პრიზის ტექსტი', place: 'ადგილის შეცვლა' }[act],
      description: `${box.place || 'ყუთი'} · ${clock(box.startsAt)}–${clock(box.endsAt)}`,
      body: `<form id="mb-box-form" class="s-stack" novalidate>${fields}</form>`,
      footer: '<p class="s-form-msg" role="alert"></p><button type="button" class="btn" data-no>გაუქმება</button><button type="submit" class="btn primary" form="mb-box-form">შენახვა</button>',
    });
    const form = doc.getElementById('mb-box-form'), panel = form.closest('.v3-dialog-panel');
    bindLocationField(form);
    panel.querySelector('[data-no]').onclick = () => void d.close();
    form.onsubmit = async (e) => {
      e.preventDefault();
      const f = new FormData(form);
      const body = act === 'coins' ? { action: 'coins', coins: Number(f.get('coins')) } : act === 'stock' ? { action: 'stock', stock: Number(f.get('stock')) }
        : act === 'text' ? { action: 'text', title: String(f.get('title')), ...(f.get('description') ? { description: String(f.get('description')) } : {}), ...(f.get('titleEn') ? { titleEn: String(f.get('titleEn')) } : {}) }
        : act === 'place' ? { action: 'place', latitude: Number(f.get('latitude')), longitude: Number(f.get('longitude')) }
        : { action: 'time', startsAt: box.allocated ? new Date(box.startsAt).toISOString() : `${f.get('startsAt')}:00+04:00`, endsAt: `${f.get('endsAt')}:00+04:00` };
      const submit = panel.querySelector('[type=submit]');
      submit.disabled = true;
      try { await api(`/boxes/${encodeURIComponent(box.id)}`, { method: 'PATCH', body }); V().setDirty?.(false); await d.close(); toast('შენახულია', 'ok'); await reloadDay(); }
      catch (err) { submit.disabled = false; panel.querySelector('[role=alert]').textContent = say(err, 'ვერ შეინახა.'); }
    };
  }
  async function sendBox(box, body, btn) {
    if (btn) btn.disabled = true;
    try { await api(`/boxes/${encodeURIComponent(box.id)}`, { method: 'PATCH', body }); toast({ end: 'ყუთი დასრულდა', cancel: 'ყუთი გაუქმდა', restore: 'ყუთი აღდგა' }[body.action] || 'შენახულია', 'ok'); await reloadDay(); }
    catch (err) { if (btn) btn.disabled = false; toast(say(err, 'ვერ შესრულდა.'), 'bad'); }
  }

  /* ─────────────── manual drop ─────────────── */
  async function openDropDialog() {
    let cityList = [];
    try {
      if (!st.spots) st.spots = await api('/spots');
      cityList = (await api('/cities')).cities.filter((c) => c.status === 'ready' && c.enabled);
    } catch (err) { toast(say(err, 'ადგილები ვერ ჩაიტვირთა.'), 'bad'); return; }
    const districts = [...new Set(st.spots.spots.map((s) => s.district).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'ka'));
    const wd = st.o.campaign.days.weekday;
    const startDefault = st.day === st.o.today ? '' : `${st.day}T12:00`;
    const d = V().openDialog?.({
      title: 'ყუთის დაგდება', wide: true,
      description: 'ხელით დაგდებული ყუთი წესებისგან დამოუკიდებელია: ავტოპილოტი მას არ შეცვლის და „ხელახლა აწყობა“ არ წაშლის.',
      body: `<form id="mb-drop-form" class="s-stack mb-drop" novalidate>
        <div class="mb-drop-row">
          <div class="s-segment" role="tablist" aria-label="რა">
            <button type="button" role="tab" data-what="coins" aria-selected="true">Medi Coins</button>
            <button type="button" role="tab" data-what="prize" aria-selected="false">ფიზიკური პრიზი</button>
          </div>
          <label class="s-field mb-inline"><span class="sr-only">ქალაქი</span><select name="cityId" data-drop-city><option value="">თბილისი</option>${cityList.map((c) => `<option value="${esc(c.cityId)}">${esc(c.nameKa || c.nameEn)}${c.countryCode ? ` · ${esc(c.countryCode)}` : ''}</option>`).join('')}</select></label>
        </div>
        <div data-what-pane="prize" hidden class="s-form-grid">
          <label class="s-field"><span>პრიზის სახელი</span><input type="text" name="prizeTitle" minlength="2" maxlength="100" placeholder="მაგ. Xiaomi Smart Band 10"></label>
          <label class="s-field"><span>სახელი ინგლისურად</span><input type="text" name="prizeTitleEn" maxlength="100" placeholder="Xiaomi Smart Band 10"></label>
          <label class="s-field mb-wide"><span>აღწერა</span><input type="text" name="prizeDescription" maxlength="1000" placeholder="ვინც პირველი გახსნის, ის იღებს. გადაცემა — შემოწმების შემდეგ."></label>
        </div>
        <div class="s-segment" role="tablist" aria-label="სად">
          <button type="button" role="tab" data-where="district" aria-selected="true">სადმე უბანში</button>
          <button type="button" role="tab" data-where="spot" aria-selected="false">კონკრეტული ადგილი</button>
          <button type="button" role="tab" data-where="point" aria-selected="false">ლოკაცია / ბმული</button>
        </div>
        <div data-where-pane="district"><label class="s-field"><span>უბანი</span><select name="district">${districts.map((x) => `<option>${esc(x)}</option>`).join('')}</select><small>ამ უბნის პარკებიდან შემთხვევითი ბილიკი (გამორიცხული ადგილების გარდა)</small></label></div>
        <div data-where-pane="spot" hidden><label class="s-field"><span>ადგილი</span><select name="spotId">
          <optgroup label="შაბათის პარკები">${st.spots.golden.map((g) => `<option value="${esc(g.key)}">${esc(g.place)}</option>`).join('')}</optgroup>
          ${districts.map((dist) => `<optgroup label="${esc(dist)}">${st.spots.spots.filter((s) => s.district === dist && !s.excluded).map((s) => `<option value="${esc(s.id)}">${esc(s.place)} · ${esc(s.id.split('-').pop())}</option>`).join('')}</optgroup>`).join('')}
        </select></label></div>
        <div data-where-pane="point" hidden class="s-form-grid">
          ${locationField()}
          <label class="s-field"><span>Latitude</span><input type="number" name="latitude" step="0.000001" min="-90" max="90" placeholder="41.7098"></label>
          <label class="s-field"><span>Longitude</span><input type="number" name="longitude" step="0.000001" min="-180" max="180" placeholder="44.7509"></label>
          <label class="s-field"><span>ადგილის სახელი</span><input type="text" name="place" maxlength="80" placeholder="მაგ. ვაკის პარკი, შადრევანთან"></label>
        </div>
        <div class="s-form-grid">
          <label class="s-field" data-coins-field><span>ქოინი პირველ გამხსნელს</span><input type="number" name="coins" min="1" max="10000" value="50"><small>შემდეგები კიბით: ${esc((st.o.economy?.decay || [100]).join(' / '))}%</small></label>
          <label class="s-field"><span>რამდენჯერ იხსნება</span><input type="number" name="stock" min="1" max="1000" value="5" required></label>
          <label class="s-field" data-coins-field><span>ყველა გახსნა ერთნაირი</span><label class="mb-check"><input type="checkbox" class="s-switch" name="flat"> კიბის გარეშე — ყველას სრული</label></label>
          <label class="s-field"><span>დაწყება (თბილისი)</span><input type="datetime-local" name="startsAt" value="${esc(startDefault)}"><small>ცარიელი = ახლავე</small></label>
          <label class="s-field"><span>ხანგრძლივობა, საათი</span><input type="number" name="hours" min="0.25" max="24" step="0.25" value="3" required></label>
          <label class="s-field"><span>პულსის რადიუსი, მ</span><input type="number" name="pulseRadius" min="40" max="500" value="${wd.pulseRadius}" required><small>აქედან იწყება გულისცემა</small></label>
          <label class="s-field"><span>გახსნის რადიუსი, მ</span><input type="number" name="revealRadius" min="10" max="50" value="${wd.revealRadius}" required><small>ამ მანძილზე ჩანს ყუთი</small></label>
          <label class="s-field"><span>მხოლოდ ვისაც განათებული აქვს, %</span><input type="number" name="minPercent" min="0" max="100" step="0.01" placeholder="ცარიელი = ყველასთვის"><small>მაგ. 0.25 — როგორც ფარნის ყუთი</small></label>
        </div>
        <label class="s-field"><span>შენიშვნა (ჟურნალისთვის)</span><input type="text" name="note" maxlength="300" placeholder="მაგ. ბლოგერის ღონისძიება ვაკეში"></label>
      </form>`,
      footer: '<p class="s-form-msg" role="alert"></p><button type="button" class="btn" data-no>გაუქმება</button><button type="submit" class="btn primary" form="mb-drop-form">დაგდება</button>',
    });
    const form = doc.getElementById('mb-drop-form'), panel = form.closest('.v3-dialog-panel');
    let where = 'district', what = 'coins';
    bindLocationField(form);
    form.querySelectorAll('[data-what]').forEach((b) => b.addEventListener('click', () => {
      what = b.dataset.what;
      form.querySelectorAll('[data-what]').forEach((x) => x.setAttribute('aria-selected', String(x === b)));
      form.querySelector('[data-what-pane="prize"]').hidden = what !== 'prize';
      form.querySelector('[data-coins-field]').hidden = what === 'prize';
      if (what === 'prize') form.querySelector('[name=stock]').value = '1';
    }));
    // Another city: its parks become the „უბნები“ and its spots the list.
    form.querySelector('[data-drop-city]').addEventListener('change', async (e) => {
      const id = e.target.value, dSel = form.querySelector('[name=district]'), sSel = form.querySelector('[name=spotId]');
      if (!id) {
        dSel.innerHTML = districts.map((x) => `<option>${esc(x)}</option>`).join('');
        sSel.innerHTML = `<optgroup label="შაბათის პარკები">${st.spots.golden.map((g) => `<option value="${esc(g.key)}">${esc(g.place)}</option>`).join('')}</optgroup>${districts.map((dist) => `<optgroup label="${esc(dist)}">${st.spots.spots.filter((x) => x.district === dist && !x.excluded).map((x) => `<option value="${esc(x.id)}">${esc(x.place)} · ${esc(x.id.split('-').pop())}</option>`).join('')}</optgroup>`).join('')}`;
        return;
      }
      try {
        const { spots } = await api(`/cities/${id}/spots`);
        const parks = [...new Set(spots.map((x) => x.district).filter(Boolean))].sort((a, b) => a.localeCompare(b));
        dSel.innerHTML = parks.map((x) => `<option>${esc(x)}</option>`).join('');
        sSel.innerHTML = spots.map((x) => `<option value="${esc(x.id)}">${esc(x.place || x.id)} · ${esc(x.id.split('-').pop())}</option>`).join('');
      } catch (err) { toast(say(err, 'ქალაქის ადგილები ვერ ჩაიტვირთა.'), 'bad'); }
    });
    form.querySelectorAll('[data-where]').forEach((b) => b.addEventListener('click', () => {
      where = b.dataset.where;
      form.querySelectorAll('[data-where]').forEach((x) => x.setAttribute('aria-selected', String(x === b)));
      form.querySelectorAll('[data-where-pane]').forEach((p) => { p.hidden = p.dataset.wherePane !== where; });
    }));
    panel.querySelector('[data-no]').onclick = () => void d.close();
    form.onsubmit = async (e) => {
      e.preventDefault();
      const f = new FormData(form), n = (k) => (f.get(k) === '' || f.get(k) == null ? null : Number(f.get(k)));
      const body = { stock: n('stock'), hours: n('hours'), pulseRadius: n('pulseRadius'), revealRadius: n('revealRadius'), startsAt: f.get('startsAt') ? `${f.get('startsAt')}:00+04:00` : null, minPercent: n('minPercent') || null };
      if (what === 'prize') {
        if (String(f.get('prizeTitle') || '').trim().length < 2) { panel.querySelector('[role=alert]').textContent = 'ჩაწერე პრიზის სახელი.'; return; }
        body.prize = { title: String(f.get('prizeTitle')).trim(), ...(f.get('prizeDescription') ? { description: String(f.get('prizeDescription')) } : {}), ...(f.get('prizeTitleEn') ? { titleEn: String(f.get('prizeTitleEn')) } : {}) };
      } else { body.coins = n('coins'); if (f.get('flat')) body.flat = true; }
      if (f.get('cityId')) body.cityId = String(f.get('cityId'));
      if (f.get('note')) body.note = String(f.get('note'));
      if (where === 'district') body.district = String(f.get('district'));
      else if (where === 'spot') body.spotId = String(f.get('spotId'));
      else {
        body.latitude = n('latitude'); body.longitude = n('longitude');
        if (!Number.isFinite(body.latitude) || !Number.isFinite(body.longitude)) { panel.querySelector('[role=alert]').textContent = 'ჩასვი ლოკაციის ბმული ან კოორდინატები.'; return; }
        if (f.get('place')) body.place = String(f.get('place'));
      }
      const submit = panel.querySelector('[type=submit]');
      submit.disabled = true;
      try {
        const box = await api('/boxes', { method: 'POST', body });
        V().setDirty?.(false);
        await d.close();
        toast(`ყუთი დაიგდო: ${box.place || 'კოორდინატი'}${box.district ? ` (${box.district})` : ''}, ${clock(box.startsAt)}–${clock(box.endsAt)}`, 'ok');
        st.day = ymdOf(box.startsAt);
        await reloadDay();
      } catch (err) { submit.disabled = false; panel.querySelector('[role=alert]').textContent = say(err, 'ვერ დაიგდო. შეამოწმე ველები.'); }
    };
  }

  /* ═════════ წესები — the draft editor ═════════ */
  const avgCoins = (coins) => { const w = coins.reduce((s, o) => s + Number(o.weight || 0), 0); return w ? coins.reduce((s, o) => s + Number(o.amount || 0) * Number(o.weight || 0), 0) / w : 0; };
  function daySummary(day) {
    const boxes = day.waves.reduce((s, w) => s + Number(w.rotation || 0) + Number(w.focus || 0), 0);
    const stock = (Number(day.stock[0]) + Number(day.stock[1])) / 2, decay = st.draft?.economy?.decay || [100];
    const avg = avgCoins(day.coins), perBox = ladderSum(avg, Math.round(stock), decay);
    return `დღეში ≈ ${num(boxes)} ყუთი · ${num(day.waves.length)} ტალღა · ≈ ${num(Math.round(boxes * stock))} გახსნა · თუ ყველა გაიხსნა ≈ ${num(Math.round(boxes * perBox))} ქოინი · პირველს საშუალოდ ${num(Math.round(avg))} ქოინი`;
  }
  function economyCard() {
    const e = st.draft.economy, d = e.decay, w = e.weeklyPrizes, b = e.budget;
    const sample = ladderOf(50, 6, d), weekCost = [...(w.boxes || []), ...(w.meters || [])].reduce((s, n) => s + Number(n || 0), 0);
    const bs = st.o.budget;
    return `<section class="s-card"><header class="s-card-head"><div><h3>ეკონომიკა</h3><p>ბიზნესის მხარე: ვინ რამდენს იღებს და რამდენი შეიძლება სულ გაიცეს.</p></div></header>
      <div class="s-card-body s-stack">
        <div class="mb-sum">50-ქოინიანი ყუთი 6 გახსნაზე: ${esc(ladderText(sample))} · სულ ${num(sample.reduce((s, n) => s + n, 0))} · კვირის პრიზები ${num(weekCost)} ქოინი/კვირა</div>
        <div class="mb-split">
          <div class="mb-block"><h4 class="mb-h4">გახსნების კიბე — პირველი იღებს სრულს, შემდეგი ნაკლებს (%)</h4>
            <div class="s-form-grid">${d.map((v, i) => `<label class="s-field"><span>${i === 0 ? '1-ლი გამხსნელი' : i === d.length - 1 ? `მე-${i + 1} და შემდეგი` : `მე-${i + 1}`}</span><input type="number" min="1" max="100" value="${v}" data-p="economy.decay.${i}"><small>${i === 0 ? '100 = სრული ქოინი' : 'წინაზე მეტი ვერ იქნება'}</small></label>`).join('')}</div>
            <div class="p4-actions"><button type="button" class="btn compact" data-decay-add ${d.length >= 8 ? 'disabled' : ''}>${ico('plus')} საფეხური</button><button type="button" class="btn compact" data-decay-del ${d.length <= 1 ? 'disabled' : ''}>${ico('trash')} ბოლო საფეხური</button></div>
            <p class="s-muted">კიბე ყუთში „იყინება“ შექმნისას — ცვლილება ეხება მხოლოდ ახალ ყუთებს. გახსნა 5-ზე მრგვალდება და 5-ზე ნაკლები არასდროსაა.</p></div>
          <div class="mb-block"><h4 class="mb-h4">სეზონის ბიუჯეტი და კვირის პრიზები</h4>
            <div class="s-form-grid">
              <label class="s-field"><span>სეზონის ბიუჯეტი, ქოინი</span><input type="number" min="0" max="10000000" step="100" value="${b.seasonCoins}" data-p="economy.budget.seasonCoins"><small>${bs ? `გაცემულია ${num(bs.paid)} (${bs.percent}%) · ≈ ${num(Math.round(b.seasonCoins / 100))} ₾ მაღაზიის ფასით · 0 = შეზღუდვის გარეშე` : '0 = შეზღუდვის გარეშე'}</small></label>
              <label class="s-field"><span>გაფრთხილება, %</span><input type="text" value="${esc((b.warnAt || []).join(', '))}" data-warn-at><small>Telegram-ში ერთხელ თითო ზღვარზე; 100%-ზე ავტოპილოტი ჩერდება</small></label>
              ${['boxes', 'meters'].map((k) => [0, 1, 2].map((i) => `<label class="s-field"><span>${k === 'boxes' ? 'ყუთების' : 'მანძილის'} ლიდერბორდი · ${['🥇 1-ლი', '🥈 მე-2', '🥉 მე-3'][i]}</span><input type="number" min="0" max="10000" step="10" value="${Number((w[k] || [])[i] || 0)}" data-p="economy.weeklyPrizes.${k}.${i}"><small>${i === 0 ? 'ორშაბათს 00:10 ჩაირიცხება · 0 = არ არის' : ''}</small></label>`).join('')).join('')}
            </div>
            <p class="s-muted">კვირა = თბილისის ორშაბათი–კვირა. პრიზს იღებს მხოლოდ ლიდერბორდში ჩართული მოთამაშე; ბიუჯეტში ითვლება.</p></div>
        </div>
      </div></section>`;
  }
  function coinsTable(path, coins) {
    const total = coins.reduce((s, o) => s + Number(o.weight || 0), 0) || 1;
    return `<div class="mb-coins">
      <div class="mb-tablebox"><table class="s-table mb-mini"><thead><tr><th>ქოინი ყუთში</th><th>წილი (წონა)</th><th class="num">ალბათობა</th><th></th></tr></thead><tbody>
      ${coins.map((o, i) => `<tr><td><input type="number" min="1" max="10000" value="${o.amount}" data-p="${path}.${i}.amount" aria-label="ქოინი"></td><td><input type="number" min="0" max="1000" step="1" value="${o.weight}" data-p="${path}.${i}.weight" aria-label="წონა"></td><td class="num">${Math.round((Number(o.weight || 0) / total) * 100)}%</td><td>${coins.length > 1 ? `<button type="button" class="btn compact" data-del="${path}.${i}" aria-label="წაშლა">${ico('trash')}</button>` : ''}</td></tr>`).join('')}
      </tbody></table></div>
      <button type="button" class="btn compact" data-add-coin="${path}">${ico('plus')} ვარიანტი</button></div>`;
  }
  function wavesTable(path, waves) {
    return `<div class="mb-tablebox"><table class="s-table mb-mini"><thead><tr><th>დაწყება</th><th>საათი</th><th title="ყუთები მთელ ქალაქში, უბნების რიგით">ქალაქში</th><th title="დამატებითი ყუთები კვირის თემის ზონაში">თემაში</th><th title="მხოლოდ განათებულ ბილიკზე (საღამოს)">განათებული</th><th></th></tr></thead><tbody>
      ${waves.map((w, i) => `<tr>
        <td><input type="time" value="${esc(w.time)}" data-p="${path}.${i}.time" aria-label="დაწყება"> <small class="s-muted">${esc(kindLabel(w.id))}</small></td>
        <td><input type="number" min="0.5" max="16" step="0.5" value="${w.hours}" data-p="${path}.${i}.hours" aria-label="საათი"></td>
        <td><input type="number" min="0" max="30" value="${w.rotation}" data-p="${path}.${i}.rotation" aria-label="ქალაქში"></td>
        <td><input type="number" min="0" max="30" value="${w.focus}" data-p="${path}.${i}.focus" aria-label="თემაში"></td>
        <td><input type="checkbox" class="s-switch" ${w.litOnly ? 'checked' : ''} data-p="${path}.${i}.litOnly" aria-label="მხოლოდ განათებული"></td>
        <td><button type="button" class="btn compact" data-del="${path}.${i}" aria-label="ტალღის წაშლა">${ico('trash')}</button></td></tr>`).join('')}
      </tbody></table></div>
      <button type="button" class="btn compact" data-add-wave="${path}">${ico('plus')} ტალღა</button>`;
  }
  function dayCard(key, title, hint) {
    const day = st.draft.days[key], p = `days.${key}`;
    return `<section class="s-card"><header class="s-card-head"><div><h3>${title}</h3><p>${hint}</p></div></header>
      <div class="s-card-body s-stack">
        <div class="mb-sum">${esc(daySummary(day))}</div>
        <div class="mb-split">
          <div class="mb-block"><h4 class="mb-h4">ტალღები — როდის ჩნდება ყუთები</h4>${wavesTable(`${p}.waves`, day.waves)}</div>
          <div class="mb-block"><h4 class="mb-h4">შიგთავსი — რამდენი ქოინია ყუთში</h4>${coinsTable(`${p}.coins`, day.coins)}</div>
        </div>
        <div class="s-form-grid">
          <label class="s-field"><span>ერთი ყუთი იხსნება — მინ.</span><input type="number" min="1" max="1000" value="${day.stock[0]}" data-p="${p}.stock.0"><small>რამდენ ადამიანს შეუძლია გახსნა</small></label>
          <label class="s-field"><span>მაქს.</span><input type="number" min="1" max="1000" value="${day.stock[1]}" data-p="${p}.stock.1"></label>
          <label class="s-field"><span>პულსის რადიუსი, მ</span><input type="number" min="40" max="500" value="${day.pulseRadius}" data-p="${p}.pulseRadius"><small>აქედან იწყება გულისცემა</small></label>
          <label class="s-field"><span>გახსნის რადიუსი, მ</span><input type="number" min="10" max="50" value="${day.revealRadius}" data-p="${p}.revealRadius"><small>ამ მანძილზე ჩანს ყუთი</small></label>
          <label class="s-field"><span>პარკის სიღრმე, მინ. მ</span><input type="number" min="0" max="500" value="${day.minDepthM}" data-p="${p}.minDepthM"><small>რამდენად ღრმად პარკში (გზიდან)</small></label>
        </div>
      </div></section>`;
  }
  const CITY_DEFAULTS = { enabled: true, minPlayers: 1, waves: [{ id: 'am', time: '09:00', hours: 4.5 }, { id: 'md', time: '13:00', hours: 4 }, { id: 'ev', time: '18:00', hours: 3.5 }], boxesPerWave: { base: 2, perPlayers: 5, max: 6 }, weekendExtra: 1, coins: [{ amount: 20, weight: 50 }, { amount: 30, weight: 30 }, { amount: 50, weight: 15 }, { amount: 80, weight: 5 }], weekendCoins: [{ amount: 30, weight: 50 }, { amount: 50, weight: 30 }, { amount: 80, weight: 15 }, { amount: 120, weight: 5 }], stock: [3, 5], pulseRadius: 250, revealRadius: 20, overrides: {} };
  function citiesCard() {
    const r = st.draft.cities;
    const b = r.boxesPerWave;
    return `<section class="s-card"><header class="s-card-head"><div><h3>სხვა ქალაქები</h3><p>ყველა ქალაქი თბილისის გარდა, სადაც ერთი მოთამაშე მაინც ცხოვრობს (ლოკაცია) ან ხელით დაამატე „ქალაქები“ ტაბში. დრო — ქალაქის ადგილობრივი. ადგილებს სისტემა თავად პოულობს OpenStreetMap-ზე, იგივე წესებით, რაც თბილისში.</p></div></header>
      <div class="s-card-body s-stack">
        <label class="mb-check"><input type="checkbox" class="s-switch" data-p="cities.enabled" ${r.enabled ? 'checked' : ''}> ყუთები სხვა ქალაქებშიც</label>
        <div class="mb-sum">ერთ ტალღაში: ${num(b.base)} ყუთი + 1 ყოველ ${num(b.perPlayers)} მოთამაშეზე (მაქს. ${num(b.max)})${r.weekendExtra ? `, შაბათ-კვირას +${num(r.weekendExtra)}` : ''} · ${num(r.waves.length)} ტალღა დღეში</div>
        <h4 class="mb-h4">ტალღები (ადგილობრივი დრო)</h4>
        <div class="mb-tablebox"><table class="s-table mb-mini"><thead><tr><th>დაწყება</th><th>საათი</th><th></th></tr></thead><tbody>
          ${r.waves.map((w, i) => `<tr><td><input type="time" value="${esc(w.time)}" data-p="cities.waves.${i}.time" aria-label="დაწყება"></td><td><input type="number" min="0.5" max="16" step="0.5" value="${w.hours}" data-p="cities.waves.${i}.hours" aria-label="საათი"></td><td>${r.waves.length > 1 ? `<button type="button" class="btn compact" data-del="cities.waves.${i}" aria-label="წაშლა">${ico('trash')}</button>` : ''}</td></tr>`).join('')}
        </tbody></table></div>
        <button type="button" class="btn compact" data-add-cwave>${ico('plus')} ტალღა</button>
        <div class="s-form-grid">
          <label class="s-field"><span>ყუთი ტალღაში — საბაზო</span><input type="number" min="0" max="30" value="${b.base}" data-p="cities.boxesPerWave.base"></label>
          <label class="s-field"><span>+1 ყუთი ყოველ … მოთამაშეზე</span><input type="number" min="1" max="100000" value="${b.perPlayers}" data-p="cities.boxesPerWave.perPlayers"></label>
          <label class="s-field"><span>მაქს. ყუთი ტალღაში</span><input type="number" min="0" max="30" value="${b.max}" data-p="cities.boxesPerWave.max"></label>
          <label class="s-field"><span>შაბათ-კვირას დამატებით</span><input type="number" min="0" max="10" value="${r.weekendExtra}" data-p="cities.weekendExtra"></label>
          <label class="s-field"><span>მინ. მოთამაშე ქალაქში</span><input type="number" min="1" max="10000" value="${r.minPlayers}" data-p="cities.minPlayers"><small>ხელით დამატებულ ქალაქზე არ მოქმედებს</small></label>
          <label class="s-field"><span>ერთი ყუთი იხსნება — მინ.</span><input type="number" min="1" max="1000" value="${r.stock[0]}" data-p="cities.stock.0"></label>
          <label class="s-field"><span>მაქს.</span><input type="number" min="1" max="1000" value="${r.stock[1]}" data-p="cities.stock.1"></label>
          <label class="s-field"><span>პულსის რადიუსი, მ</span><input type="number" min="40" max="500" value="${r.pulseRadius}" data-p="cities.pulseRadius"></label>
          <label class="s-field"><span>გახსნის რადიუსი, მ</span><input type="number" min="10" max="50" value="${r.revealRadius}" data-p="cities.revealRadius"></label>
        </div>
        <div class="mb-split">
          <div class="mb-block"><h4 class="mb-h4">შიგთავსი — სამუშაო დღე</h4>${coinsTable('cities.coins', r.coins)}</div>
          <div class="mb-block"><h4 class="mb-h4">შიგთავსი — შაბათ-კვირა</h4>${coinsTable('cities.weekendCoins', r.weekendCoins || r.coins)}</div>
        </div>
      </div></section>`;
  }
  const ECONOMY_DEFAULTS = { version: 2, decay: [100, 60, 40, 25], budget: { seasonCoins: 60000, warnAt: [50, 80] }, weeklyPrizes: { boxes: [300, 200, 100], meters: [300, 200, 100] } };
  function paintRules(body) {
    if (!st.draft.economy) st.draft.economy = structuredClone(st.o.economy || ECONOMY_DEFAULTS);
    if (!st.draft.economy.weeklyPrizes) st.draft.economy.weeklyPrizes = { boxes: [], meters: [] };
    if (!st.draft.cities) st.draft.cities = structuredClone(CITY_DEFAULTS);
    if (!st.draft.cities.weekendCoins) st.draft.cities.weekendCoins = structuredClone(st.draft.cities.coins);
    const c = st.draft, sat = c.saturday, g = c.grand;
    const parks = ['rike', 'vake', 'lisi', 'april9', 'finale'];
    const parkName = { rike: 'რიყის პარკი', vake: 'ვაკის პარკი', lisi: 'ლისის ტბა', april9: '9 აპრილის ბაღი', finale: 'ფინალის ადგილი' };
    const satDates = Object.entries(sat.dates || {}).sort(([a], [b]) => a.localeCompare(b));
    const dropDate = g.dropAt.slice(0, 10), dropTime = g.dropAt.slice(11, 16);
    body.innerHTML = `<form class="s-stack mb-rules" data-mb-rules novalidate>
      <div class="s-callout">${ico('info')}<p><b>ცვლილება ეხება მხოლოდ ჯერ შეუქმნელ ყუთებს.</b> ავტოპილოტი ყუთებს დღით ადრე ქმნის — დღევანდელისა და ხვალინდელისთვის „დღეს“ ტაბში დააჭირე „ხელახლა აწყობა“. შენახვამდე „გადახედვა“ გაჩვენებს, რა შეიცვლება.</p></div>
      ${economyCard()}
      ${dayCard('weekday', 'სამუშაო დღე (ორშაბათი–პარასკევი)', 'სამი ტალღა, ყველა უბანში, მცირე ქოინი.')}
      ${dayCard('weekend', 'შაბათ-კვირა', 'სამი ტალღა, მეტი ყუთი, ოდნავ მეტი ქოინი.')}
      ${citiesCard()}
      <section class="s-card"><header class="s-card-head"><div><h3>შაბათის ქოინების წვიმა</h3><p>ერთ პარკში ბევრი ყუთი ერთად. პარკს სთორიში გამოცანით ამხელთ, ამიტომ აპში პარკი წინასწარ არ ჩანს.</p></div></header>
        <div class="s-card-body s-stack">
          <div class="s-form-grid">
            <label class="s-field"><span>დაწყება</span><input type="time" value="${esc(sat.time)}" data-p="saturday.time"></label>
            <label class="s-field"><span>ხანგრძლივობა, საათი</span><input type="number" min="0.5" max="12" step="0.5" value="${sat.hours}" data-p="saturday.hours"></label>
            <label class="s-field"><span>ყუთების წერტილი</span><input type="number" min="1" max="30" value="${sat.points}" data-p="saturday.points"></label>
            <label class="s-field"><span>გახსნა თითო წერტილზე</span><input type="number" min="1" max="1000" value="${sat.stock}" data-p="saturday.stock"></label>
            <label class="s-field"><span>რადიუსი პარკის გარშემო, მ</span><input type="number" min="100" max="3000" value="${sat.radiusM}" data-p="saturday.radiusM"></label>
            <label class="s-field"><span>პულსის რადიუსი, მ</span><input type="number" min="40" max="500" value="${sat.pulseRadius}" data-p="saturday.pulseRadius"></label>
            <label class="s-field"><span>გახსნის რადიუსი, მ</span><input type="number" min="10" max="50" value="${sat.revealRadius}" data-p="saturday.revealRadius"></label>
          </div>
          <h4 class="mb-h4">შიგთავსი</h4>${coinsTable('saturday.coins', sat.coins)}
          <h4 class="mb-h4">შაბათები და პარკები</h4>
          <div class="mb-tablebox"><table class="s-table mb-mini"><thead><tr><th>თარიღი</th><th>პარკი</th><th></th></tr></thead><tbody>
            ${satDates.map(([date, park]) => `<tr><td>${esc(dayLabel(date))}</td><td><select data-sat-park="${date}" aria-label="პარკი">${parks.map((k) => `<option value="${k}" ${k === park ? 'selected' : ''}>${esc(parkName[k])}</option>`).join('')}</select></td><td><button type="button" class="btn compact" data-sat-del="${date}" aria-label="წაშლა">${ico('trash')}</button></td></tr>`).join('')}
          </tbody></table></div>
          <div class="mb-row"><input type="date" data-sat-new aria-label="ახალი შაბათი"><button type="button" class="btn compact" data-sat-add>${ico('plus')} თარიღის დამატება</button></div>
          <h4 class="mb-h4">ფარნის ყუთები (შაბათს, განათების ზღვრიდან)</h4>
          <label class="mb-check"><input type="checkbox" class="s-switch" data-lantern-on ${sat.lantern ? 'checked' : ''}> ჩართულია</label>
          ${sat.lantern ? `<div class="s-form-grid">
            <label class="s-field"><span>რომელი თარიღიდან</span><input type="date" value="${esc(sat.lantern.from)}" data-p="saturday.lantern.from"></label>
            <label class="s-field"><span>ყუთების წერტილი</span><input type="number" min="0" max="10" value="${sat.lantern.points}" data-p="saturday.lantern.points"></label>
            <label class="s-field"><span>გახსნა თითოზე</span><input type="number" min="1" max="1000" value="${sat.lantern.stock}" data-p="saturday.lantern.stock"></label>
            <label class="s-field"><span>ქოინი ყუთში</span><input type="number" min="1" max="10000" value="${sat.lantern.coins}" data-p="saturday.lantern.coins"></label>
            <label class="s-field"><span>თბილისის განათება, % (მინ.)</span><input type="number" min="0.01" max="100" step="0.01" value="${sat.lantern.minPercent}" data-p="saturday.lantern.minPercent"></label>
          </div>` : ''}
        </div></section>
      <section class="s-card"><header class="s-card-head"><div><h3>დიდი საჩუქარი</h3><p>ერთი ყუთი, ჩანს მხოლოდ მათთვის, ვისაც თბილისის საკმარისი ნაწილი აქვს განათებული. ვინც პირველი გახსნის, ის იგებს.</p></div></header>
        <div class="s-card-body"><div class="s-form-grid">
          <label class="s-field"><span>თარიღი</span><input type="date" value="${esc(dropDate)}" data-grand-date></label>
          <label class="s-field"><span>დრო (თბილისი)</span><input type="time" value="${esc(dropTime)}" data-grand-time></label>
          <label class="s-field"><span>ხანგრძლივობა, საათი</span><input type="number" min="0.5" max="24" step="0.5" value="${g.hours}" data-p="grand.hours"></label>
          <label class="s-field"><span>საჭირო განათება, %</span><input type="number" min="0" max="100" step="0.01" value="${g.minPercent}" data-p="grand.minPercent"></label>
          <label class="s-field"><span>პრიზი (ქართ.)</span><input type="text" maxlength="80" value="${esc(g.prize.ka)}" data-p="grand.prize.ka"></label>
          <label class="s-field"><span>პრიზი (ინგლ.)</span><input type="text" maxlength="80" value="${esc(g.prize.en)}" data-p="grand.prize.en"></label>
          <label class="s-field"><span>დეტალი (ქართ.)</span><input type="text" maxlength="80" value="${esc(g.detail.ka)}" data-p="grand.detail.ka"></label>
          <label class="s-field"><span>დეტალი (ინგლ.)</span><input type="text" maxlength="80" value="${esc(g.detail.en)}" data-p="grand.detail.en"></label>
          <label class="s-field"><span>პულსის რადიუსი, მ</span><input type="number" min="40" max="500" value="${g.pulseRadius}" data-p="grand.pulseRadius"></label>
          <label class="s-field"><span>გახსნის რადიუსი, მ</span><input type="number" min="10" max="50" value="${g.revealRadius}" data-p="grand.revealRadius"></label>
          <label class="s-field"><span>ადგილი</span><select data-grand-spot><option value="">ავტომატურად (დიდი ცნობილი პარკი)</option>${parks.map((k) => `<option value="${k}" ${g.spot === k ? 'selected' : ''}>${esc(parkName[k])}</option>`).join('')}</select><small>საბოლოო საიდუმლო ადგილი დღესთან ახლოს დააყენე</small></label>
        </div></div></section>
      <section class="s-card"><header class="s-card-head"><div><h3>კვირის თემები</h3><p>„თემაში“ ყუთები ამ კვირაში ამ ზონაში დგება: უბნები, პარკის ტიპები ან წერტილები (lng, lat, რადიუსი).</p></div></header>
        <div class="s-card-body s-stack"><div class="mb-tablebox"><table class="s-table mb-mini is-fluid"><thead><tr><th>დან</th><th>მდე</th><th>თემა</th><th>უბნები (მძიმით)</th><th>ტიპები (park, garden…)</th><th>წერტილები: lng,lat,მ; …</th><th></th></tr></thead><tbody>
          ${c.weeks.map((w, i) => `<tr>
            <td><input type="date" value="${esc(w.from)}" data-p="weeks.${i}.from" aria-label="დან"></td>
            <td><input type="date" value="${esc(w.to)}" data-p="weeks.${i}.to" aria-label="მდე"></td>
            <td><select data-p="weeks.${i}.theme" aria-label="თემა">${Object.entries(THEMES).map(([k, l]) => `<option value="${k}" ${w.theme === k ? 'selected' : ''}>${l}</option>`).join('')}</select></td>
            <td><input type="text" value="${esc((w.districts || []).join(', '))}" data-week-list="${i}.districts" aria-label="უბნები"></td>
            <td><input type="text" value="${esc((w.kinds || []).join(', '))}" data-week-list="${i}.kinds" aria-label="ტიპები"></td>
            <td><input type="text" value="${esc((w.anchors || []).map((a) => a.join(',')).join('; '))}" data-week-anchors="${i}" aria-label="წერტილები"></td>
            <td><button type="button" class="btn compact" data-del="weeks.${i}" aria-label="წაშლა">${ico('trash')}</button></td></tr>`).join('')}
        </tbody></table></div><button type="button" class="btn compact" data-add-week>${ico('plus')} კვირა</button></div></section>
      <section class="s-card"><header class="s-card-head"><div><h3>დონეები</h3><p>რამდენი % უნდა გაანათოს თბილისიდან და რას ხსნის — ჩანს აპის დიდი საჩუქრის გვერდზე.</p></div></header>
        <div class="s-card-body"><div class="mb-tablebox"><table class="s-table mb-mini is-fluid"><thead><tr><th>%</th><th>სახელი (ქართ.)</th><th>სახელი (ინგლ.)</th><th>რას ხსნის (ქართ.)</th><th>რას ხსნის (ინგლ.)</th></tr></thead><tbody>
          ${c.levels.map((l, i) => `<tr>
            <td><input type="number" min="0.001" max="100" step="0.01" value="${l.percent}" data-p="levels.${i}.percent" aria-label="პროცენტი"></td>
            <td><input type="text" maxlength="60" value="${esc(l.name.ka)}" data-p="levels.${i}.name.ka" aria-label="სახელი"></td>
            <td><input type="text" maxlength="60" value="${esc(l.name.en)}" data-p="levels.${i}.name.en" aria-label="სახელი ინგლისურად"></td>
            <td><input type="text" maxlength="300" value="${esc(l.unlocks.ka)}" data-p="levels.${i}.unlocks.ka" aria-label="რას ხსნის"></td>
            <td><input type="text" maxlength="300" value="${esc(l.unlocks.en)}" data-p="levels.${i}.unlocks.en" aria-label="რას ხსნის ინგლისურად"></td></tr>`).join('')}
        </tbody></table></div></div></section>
      <section class="s-card"><header class="s-card-head"><div><h3>კამპანია</h3><p>სახელი და თარიღები. აპის განრიგსა და ტაიმერში ჩანს.</p></div></header>
        <div class="s-card-body"><div class="s-form-grid">
          <label class="s-field"><span>სახელი (ქართ.)</span><input type="text" maxlength="80" value="${esc(c.name.ka)}" data-p="name.ka"></label>
          <label class="s-field"><span>სახელი (ინგლ.)</span><input type="text" maxlength="80" value="${esc(c.name.en)}" data-p="name.en"></label>
          <label class="s-field"><span>დაწყება</span><input type="date" value="${esc(c.start)}" data-p="start"></label>
          <label class="s-field"><span>დასრულება</span><input type="date" value="${esc(c.end)}" data-p="end"></label>
          <label class="s-field"><span>წესების ბმული</span><input type="url" value="${esc(c.rulesUrl)}" data-p="rulesUrl"></label>
        </div></div></section>
      <div class="mb-savebar">
        <span class="mb-savebar-note">${st.dirty ? '<b>შეუნახავი ცვლილებებია</b>' : 'ცვლილებები არ არის'}</span>
        ${st.o.rules.source === 'admin' ? '<button type="button" class="btn" data-mb-reset>ფაილის მნიშვნელობებზე დაბრუნება</button>' : ''}
        <button type="button" class="btn" data-mb-discard ${st.dirty ? '' : 'disabled'}>გაუქმება</button>
        <button type="button" class="btn" data-mb-preview>${ico('eye')} გადახედვა</button>
        <button type="button" class="btn primary" data-mb-save ${st.dirty ? '' : 'disabled'}>შენახვა</button>
      </div>
    </form>`;
    bindRules(body);
  }

  /* draft helpers: data-p="a.b.0.c" paths into st.draft */
  const NUMERIC = /(\.amount|\.weight|\.hours|\.rotation|\.focus|\.stock(\.\d)?|Radius|minDepthM|\.points|radiusM|\.coins|minPercent|\.percent|\.base|\.perPlayers|\.max|weekendExtra|minPlayers|\.decay\.\d+|seasonCoins|weeklyPrizes\.(boxes|meters)\.\d+)$/;
  function setPath(obj, path, value) {
    const keys = path.split('.');
    let o = obj;
    for (let i = 0; i < keys.length - 1; i += 1) o = o[/^\d+$/.test(keys[i]) ? Number(keys[i]) : keys[i]];
    const last = keys[keys.length - 1];
    o[/^\d+$/.test(last) ? Number(last) : last] = value;
  }
  function getPath(obj, path) { return path.split('.').reduce((o, k) => (o == null ? o : o[/^\d+$/.test(k) ? Number(k) : k]), obj); }
  function markDirty(body) {
    st.dirty = true;
    body.querySelector('[data-mb-save]')?.removeAttribute('disabled');
    body.querySelector('[data-mb-discard]')?.removeAttribute('disabled');
    const note = body.querySelector('.mb-savebar-note');
    if (note) note.innerHTML = '<b>შეუნახავი ცვლილებებია</b>';
  }
  function bindRules(body) {
    const form = body.querySelector('[data-mb-rules]');
    const rerender = () => { const y = global.scrollY; paintRules(body); global.scrollTo(0, y); };
    form.addEventListener('input', (e) => {
      const el = e.target;
      if (el.dataset.p) {
        const v = el.type === 'checkbox' ? el.checked : NUMERIC.test(el.dataset.p) && el.type !== 'date' && el.type !== 'time' ? (el.value === '' ? null : Number(el.value)) : el.value;
        setPath(st.draft, el.dataset.p, el.type === 'checkbox' && !v ? undefined : v);
        markDirty(body);
        const sum = el.closest('.s-card')?.querySelector('.mb-sum');
        if (/^cities\./.test(el.dataset.p) && sum) { const b = st.draft.cities.boxesPerWave; sum.textContent = `ერთ ტალღაში: ${num(b.base)} ყუთი + 1 ყოველ ${num(b.perPlayers)} მოთამაშეზე (მაქს. ${num(b.max)})${st.draft.cities.weekendExtra ? `, შაბათ-კვირას +${num(st.draft.cities.weekendExtra)}` : ''} · ${num(st.draft.cities.waves.length)} ტალღა დღეში`; }
        const key = el.dataset.p.match(/^days\.(weekday|weekend)/)?.[1];
        if (sum && key) sum.textContent = daySummary(st.draft.days[key]);
        if (/^economy\./.test(el.dataset.p)) { const e = st.draft.economy, sample = ladderOf(50, 6, e.decay), weekCost = [...(e.weeklyPrizes.boxes || []), ...(e.weeklyPrizes.meters || [])].reduce((s, n) => s + Number(n || 0), 0); if (sum) sum.textContent = `50-ქოინიანი ყუთი 6 გახსნაზე: ${ladderText(sample)} · სულ ${num(sample.reduce((s, n) => s + n, 0))} · კვირის პრიზები ${num(weekCost)} ქოინი/კვირა`; body.querySelectorAll('.s-card .mb-sum').forEach((el2) => { const k = el2.closest('.s-card')?.querySelector('[data-p^="days.weekday"]') ? 'weekday' : el2.closest('.s-card')?.querySelector('[data-p^="days.weekend"]') ? 'weekend' : null; if (k) el2.textContent = daySummary(st.draft.days[k]); }); }
      } else if (el.matches('[data-warn-at]')) {
        st.draft.economy.budget.warnAt = el.value.split(',').map((x) => Number(x.trim())).filter((n) => Number.isFinite(n) && n >= 1 && n <= 100).slice(0, 5);
        markDirty(body);
      } else if (el.dataset.weekList) {
        const [i, field] = el.dataset.weekList.split('.');
        const list = el.value.split(',').map((x) => x.trim()).filter(Boolean);
        if (list.length) st.draft.weeks[Number(i)][field] = list; else delete st.draft.weeks[Number(i)][field];
        markDirty(body);
      } else if (el.dataset.weekAnchors != null) {
        const i = Number(el.dataset.weekAnchors);
        const list = el.value.split(';').map((x) => x.split(',').map((n) => Number(n.trim()))).filter((a) => a.length === 3 && a.every(Number.isFinite));
        if (list.length) st.draft.weeks[i].anchors = list; else delete st.draft.weeks[i].anchors;
        markDirty(body);
      } else if (el.matches('[data-grand-date], [data-grand-time]')) {
        st.draft.grand.dropAt = `${form.querySelector('[data-grand-date]').value}T${form.querySelector('[data-grand-time]').value}:00+04:00`;
        markDirty(body);
      }
    });
    form.addEventListener('change', (e) => {
      const el = e.target;
      if (el.dataset.satPark) { st.draft.saturday.dates[el.dataset.satPark] = el.value; markDirty(body); }
      else if (el.matches('[data-grand-spot]')) { st.draft.grand.spot = el.value || null; markDirty(body); }
      else if (el.matches('[data-lantern-on]')) {
        st.draft.saturday.lantern = el.checked ? (st.o.campaign.saturday.lantern || { from: st.draft.start, points: 2, stock: 3, coins: 500, minPercent: 0.25 }) : null;
        markDirty(body); rerender();
      } else if (el.dataset.p && /\.coins\.\d+\.weight$/.test(el.dataset.p)) rerender();
    });
    form.addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      if (b.dataset.del) {
        const keys = b.dataset.del.split('.'), idx = Number(keys.pop()), list = getPath(st.draft, keys.join('.'));
        list.splice(idx, 1); markDirty(body); rerender();
      } else if (b.dataset.addCoin) { getPath(st.draft, b.dataset.addCoin).push({ amount: 50, weight: 10 }); markDirty(body); rerender(); }
      else if (b.matches('[data-decay-add]')) { const d = st.draft.economy.decay; d.push(Math.max(1, Math.round(d[d.length - 1] * 0.6))); markDirty(body); rerender(); }
      else if (b.matches('[data-decay-del]')) { if (st.draft.economy.decay.length > 1) st.draft.economy.decay.pop(); markDirty(body); rerender(); }
      else if (b.matches('[data-add-cwave]')) { const w = st.draft.cities.waves; let n = 1; while (w.some((x) => x.id === `w${n}`)) n += 1; w.push({ id: `w${n}`, time: '13:00', hours: 3 }); markDirty(body); rerender(); }
      else if (b.dataset.addWave) {
        const waves = getPath(st.draft, b.dataset.addWave);
        let n = 1; while (waves.some((w) => w.id === `w${n}`)) n += 1;
        waves.push({ id: `w${n}`, time: '12:00', hours: 3, rotation: 2, focus: 0 }); markDirty(body); rerender();
      } else if (b.matches('[data-sat-add]')) {
        const v = form.querySelector('[data-sat-new]').value;
        if (!v) { toast('აირჩიე თარიღი', 'warn'); return; }
        if (new Date(`${v}T00:00:00Z`).getUTCDay() !== 6) toast('ყურადღება: ეს თარიღი შაბათი არ არის — წვიმა მაინც იმ დღეს მოვა', 'warn');
        st.draft.saturday.dates[v] = 'vake'; markDirty(body); rerender();
      } else if (b.dataset.satDel) { delete st.draft.saturday.dates[b.dataset.satDel]; markDirty(body); rerender(); }
      else if (b.matches('[data-add-week]')) { const last = st.draft.weeks.at(-1); const from = last ? addDays(last.to, 1) : st.draft.start; st.draft.weeks.push({ from, to: addDays(from, 6), theme: 'districts', districts: [] }); markDirty(body); rerender(); }
      else if (b.matches('[data-mb-discard]')) { st.draft = structuredClone(st.o.campaign); st.dirty = false; rerender(); }
      else if (b.matches('[data-mb-preview]')) void previewDraft();
      else if (b.matches('[data-mb-save]')) void saveDraft(b, body);
      else if (b.matches('[data-mb-reset]')) void resetRules(b);
    });
  }

  async function previewDraft() {
    const from = st.o.today < st.draft.start ? st.draft.start : st.o.today;
    let draft, saved;
    try {
      [draft, saved] = await Promise.all([api('/preview', { method: 'POST', body: { draft: st.draft, from, days: 7 } }), api('/preview', { method: 'POST', body: { from, days: 7 } })]);
    } catch (err) { toast(say(err, 'გადახედვა ვერ მოხერხდა.'), 'bad'); return; }
    const rows = draft.days.map((d, i) => {
      const s = saved.days[i], diff = (a, b) => (a === b ? `<span class="s-muted">${num(a)}</span>` : `<b>${num(b)}</b> <span class="s-muted">(იყო ${num(a)})</span>`);
      return `<tr><td>${esc(dayLabel(d.date))}${d.off ? ' <span class="s-badge is-warn">გამორთული</span>' : ''}</td><td>${diff(s.boxes.length, d.boxes.length)}</td><td>${diff(s.boxes.reduce((x, b) => x + b.stock, 0), d.boxes.reduce((x, b) => x + b.stock, 0))}</td><td>${diff(s.coins, d.coins)}</td><td class="s-muted">${esc([...new Set(d.boxes.map((b) => clock(b.startsAt)))].join(', ') || '—')}</td></tr>`;
    }).join('');
    const d = V().openDialog?.({ title: 'გადახედვა: მომდევნო 7 დღე', description: 'ახალი წესებით vs შენახულით. უკვე შექმნილი ყუთები არ შეიცვლება.', wide: true,
      body: `<div class="s-table-wrap"><table class="s-table"><thead><tr><th>დღე</th><th>ყუთი</th><th>გახსნა</th><th>მაქს. ქოინი</th><th>ტალღები</th></tr></thead><tbody>${rows}</tbody></table></div>`,
      footer: '<button type="button" class="btn" data-no>დახურვა</button>', watchDirty: false });
    doc.querySelector('#v3-dialog [data-no]').onclick = () => void d.close();
  }
  async function saveDraft(btn, body) {
    btn.disabled = true;
    try {
      const rec = await api('/rules', { method: 'PUT', body: { revision: st.o.rules.revision, data: st.draft } });
      st.dirty = false;
      toast(`წესები შეინახა (ვერსია ${rec.revision}). ჯერ შეუქმნელ ყუთებს შეეხება.`, 'ok');
      st.o = await api('');
      st.draft = structuredClone(st.o.campaign);
      await refreshHead();
      paintRules(body);
    } catch (err) { btn.disabled = false; toast(say(err, 'ვერ შეინახა. შეამოწმე ველები.'), 'bad'); }
  }
  async function resetRules(btn) {
    if (!(await confirmDialog('ფაილის მნიშვნელობებზე დაბრუნება', 'ადმინიდან შენახული წესები წაიშლება და ისევ კოდის ფაილის წესები იმუშავებს (medirun-campaign.json). უკვე შექმნილი ყუთები არ შეიცვლება.', 'დაბრუნება', true))) return;
    btn.disabled = true;
    try { st.o = await api('/rules', { method: 'DELETE' }); st.draft = structuredClone(st.o.campaign); st.dirty = false; toast('წესები ფაილის მნიშვნელობებზე დაბრუნდა', 'ok'); await refreshHead(); await paintSub(); }
    catch (err) { btn.disabled = false; toast(say(err, 'ვერ დაბრუნდა.'), 'bad'); }
  }

  /* ═════════ კალენდარი ═════════ */
  async function paintCalendar(body) {
    st.cal = (await api('/calendar')).days;
    const filters = [['future', 'მომავალი'], ['all', 'ყველა'], ['changed', 'შეცვლილი']];
    const rows = st.cal.filter((d) => (st.calFilter === 'future' ? !d.past : st.calFilter === 'changed' ? d.off || d.as || d.custom || d.note : true));
    const sum = st.cal.filter((d) => !d.past).reduce((s, d) => ({ boxes: s.boxes + d.boxes, coins: s.coins + d.coins }), { boxes: 0, coins: 0 });
    body.innerHTML = `<div class="s-stack">
      <div class="s-toolbar">
        <div class="s-segment" role="tablist" aria-label="ფილტრი">${filters.map(([k, l]) => `<button type="button" role="tab" data-cal-f="${k}" aria-selected="${k === st.calFilter}">${l}</button>`).join('')}</div>
        <span class="s-muted">დარჩენილ დღეებში: ≈ ${num(sum.boxes)} ყუთი · მაქს. ${num(sum.coins)} ქოინი (თუ ყველა გაიხსნა)</span>
      </div>
      <section class="s-card"><header class="s-card-head"><div><h3>კამპანიის დღეები</h3><p>დააჭირე დღეს: გამორთე, შაბათ-კვირის წესით გაუშვი ან საკუთარი წესები მიეცი. ჩანს, რა ყუთები დადგება და სად.</p></div></header>
        <div class="s-card-body is-flush"><div class="s-table-wrap"><table class="s-table mb-table">
          <thead><tr><th>დღე</th><th>წესი</th><th>დრო</th><th class="num">ყუთი</th><th class="num">გახსნა</th><th class="num">მაქს. ქოინი</th><th>განსაკუთრებული</th><th class="num">შექმნილია</th></tr></thead>
          <tbody>${rows.map((d) => `<tr class="is-click${d.past ? ' is-past' : ''}" tabindex="0" data-cal="${d.date}">
            <td><b>${esc(dayLabel(d.date))}</b></td>
            <td>${d.off ? '<span class="s-badge is-warn">გამორთული</span>' : d.custom ? '<span class="s-badge is-accent">საკუთარი წესი</span>' : `<span class="s-badge ${d.kind === 'weekend' ? 'is-info' : 'is-plain'}">${d.kind === 'weekend' ? 'შაბათ-კვირა' : 'სამუშაო'}${d.as ? ' (შეცვლილი)' : ''}</span>`}${d.note ? `<small class="s-muted"> ${esc(d.note)}</small>` : ''}</td>
            <td class="s-muted">${esc(d.times.join(', ') || '—')}</td>
            <td class="num">${num(d.boxes)}</td><td class="num">${num(d.openings)}</td><td class="num">${num(d.coins)}</td>
            <td>${[d.saturday ? '<span class="s-badge is-info">შაბათის წვიმა</span>' : '', d.lantern ? '<span class="s-badge is-accent">ფარანი</span>' : '', d.grand ? '<span class="s-badge is-ok">დიდი საჩუქარი</span>' : ''].join(' ')}</td>
            <td class="num">${d.created ? num(d.created) : '<span class="s-muted">—</span>'}</td></tr>`).join('')}</tbody></table></div></div></section>
    </div>`;
    body.querySelectorAll('[data-cal-f]').forEach((b) => b.addEventListener('click', () => { st.calFilter = b.dataset.calF; void paintSub(); }));
    body.querySelectorAll('[data-cal]').forEach((tr) => {
      const open = () => openDayDialog(tr.dataset.cal);
      tr.addEventListener('click', open);
      tr.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); open(); } });
    });
  }

  async function openDayDialog(date) {
    const base = st.o.campaign, ov = base.dayOverrides?.[date] || null;
    const mode = ov?.off ? 'off' : ov?.day ? 'custom' : ov?.as ? `as-${ov.as}` : 'normal';
    const kind = ov?.as || (new Date(`${date}T00:00:00Z`).getUTCDay() % 6 === 0 ? 'weekend' : 'weekday');
    const local = { mode, note: ov?.note || '', day: structuredClone({ ...base.days[kind], ...(ov?.day || {}) }) };
    const d = V().openDialog?.({ title: dayLabel(date), description: 'ამ ერთი დღის წესი. შენახვის შემდეგ ავტოპილოტი მას გამოიყენებს; უკვე შექმნილ ყუთებს „დღეს“ ტაბში „ხელახლა აწყობა“ ცვლის.', wide: true,
      body: '<div class="s-stack" data-day-body></div>',
      footer: '<p class="s-form-msg" role="alert"></p><button type="button" class="btn" data-no>დახურვა</button><button type="button" class="btn primary" data-day-save>შენახვა</button>' });
    const panel = doc.querySelector('#v3-dialog .v3-dialog-panel'), host = panel.querySelector('[data-day-body]');
    const draftCampaign = () => {
      const c = structuredClone(st.o.campaign);
      c.dayOverrides = { ...(c.dayOverrides || {}) };
      const o = overrideOf();
      if (o) c.dayOverrides[date] = o; else delete c.dayOverrides[date];
      return c;
    };
    const overrideOf = () => {
      const note = local.note.trim() || undefined;
      if (local.mode === 'off') return { off: true, note };
      if (local.mode === 'as-weekday' || local.mode === 'as-weekend') return { as: local.mode.slice(3), note };
      if (local.mode === 'custom') return { as: kind, day: { waves: local.day.waves, coins: local.day.coins, stock: local.day.stock }, note };
      return note ? { note } : null;
    };
    const paint = async () => {
      host.innerHTML = `<div class="s-segment s-segment-wrap" role="tablist" aria-label="დღის წესი">
          ${[['normal', 'ჩვეულებრივი'], ['off', 'გამორთული — ყუთების გარეშე'], ['as-weekend', 'შაბათ-კვირის წესით'], ['as-weekday', 'სამუშაო დღის წესით'], ['custom', 'საკუთარი წესი']].map(([k, l]) => `<button type="button" role="tab" data-mode="${k}" aria-selected="${k === local.mode}">${l}</button>`).join('')}
        </div>
        ${local.mode === 'custom' ? `<div class="s-stack mb-custom"><h4 class="mb-h4">ტალღები</h4>${wavesTable('day.waves', local.day.waves)}<h4 class="mb-h4">შიგთავსი</h4>${coinsTable('day.coins', local.day.coins)}
          <div class="s-form-grid"><label class="s-field"><span>ერთი ყუთი იხსნება — მინ.</span><input type="number" min="1" max="1000" value="${local.day.stock[0]}" data-p="day.stock.0"></label><label class="s-field"><span>მაქს.</span><input type="number" min="1" max="1000" value="${local.day.stock[1]}" data-p="day.stock.1"></label></div></div>` : ''}
        <label class="s-field"><span>შენიშვნა</span><input type="text" maxlength="300" value="${esc(local.note)}" data-note placeholder="მაგ. წვიმა / ღონისძიება / დღესასწაული"></label>
        <h4 class="mb-h4">რა დადგება ამ დღეს</h4><div data-day-preview>${skel()}</div>`;
      await paintPreview();
    };
    // Bound once on the dialog body (paint() only replaces its content).
    host.addEventListener('input', (e) => {
      const el = e.target;
      if (el.matches('[data-note]')) local.note = el.value;
      else if (el.dataset.p) setPath(local, el.dataset.p, el.type === 'checkbox' ? (el.checked || undefined) : el.type === 'time' ? el.value : Number(el.value));
    });
    host.addEventListener('change', (e) => { if (e.target.dataset.p) void paintPreview(); });
    host.addEventListener('click', (e) => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.mode) { local.mode = b.dataset.mode; void paint(); }
      else if (b.dataset.del) { const keys = b.dataset.del.split('.'), i = Number(keys.pop()); getPath(local, keys.join('.')).splice(i, 1); void paint(); }
      else if (b.dataset.addCoin) { getPath(local, b.dataset.addCoin).push({ amount: 100, weight: 10 }); void paint(); }
      else if (b.dataset.addWave) { const w = getPath(local, b.dataset.addWave); let n = 1; while (w.some((x) => x.id === `w${n}`)) n += 1; w.push({ id: `w${n}`, time: '12:00', hours: 3, rotation: 2, focus: 0 }); void paint(); }
    });
    const paintPreview = async () => {
      const box = host.querySelector('[data-day-preview]');
      if (!box) return;
      try {
        const { days } = await api('/preview', { method: 'POST', body: { draft: draftCampaign(), from: date, days: 1 } });
        const list = days[0].boxes;
        box.innerHTML = list.length ? `<div class="s-table-wrap"><table class="s-table mb-mini"><thead><tr><th>დრო</th><th>ადგილი</th><th>ტიპი</th><th class="num">ქოინი</th><th class="num">გახსნა</th><th></th></tr></thead><tbody>${list.map((b) => `<tr><td>${esc(clock(b.startsAt))}–${esc(clock(b.endsAt))}</td><td>${esc(b.place || '—')} <small class="s-muted">${esc(b.district || '')}</small></td><td>${esc(kindLabel(b.kind))}</td><td class="num">${num(b.coins)}</td><td class="num">${num(b.stock)}</td><td>${b.exists ? '<span class="s-badge is-ok">შექმნილია</span>' : ''}</td></tr>`).join('')}</tbody></table></div><p class="s-muted">სულ ${num(list.length)} ყუთი · მაქს. ${num(days[0].coins)} ქოინი</p>`
          : `<div class="s-empty">${ico('box')}<strong>ამ დღეს ყუთი არ დადგება</strong></div>`;
      } catch (err) { box.innerHTML = `<p class="s-form-msg">${esc(say(err, 'გადახედვა ვერ მოხერხდა — შეამოწმე ველები.'))}</p>`; }
    };
    panel.querySelector('[data-no]').onclick = () => void d.close();
    panel.querySelector('[data-day-save]').onclick = async (e) => {
      const btn = e.currentTarget;
      btn.disabled = true;
      try {
        await api(`/days/${date}`, { method: 'PUT', body: { override: overrideOf() } });
        V().setDirty?.(false);
        await d.close();
        toast(`${dayLabel(date)}: წესი შეინახა`, 'ok');
        st.o = await api('');
        st.draft = st.dirty ? st.draft : structuredClone(st.o.campaign);
        await refreshHead();
        await paintSub();
      } catch (err) { btn.disabled = false; panel.querySelector('[role=alert]').textContent = say(err, 'ვერ შეინახა.'); }
    };
    await paint();
  }

  /* ═════════ ქალაქები ═════════ */
  const CITY_STATUS = { ready: ['მზადაა', 'is-ok'], pending: ['ადგილებს ვეძებთ…', 'is-info'], failed: ['ვერ მოიძებნა — ხელახლა ვცდით', 'is-bad'], empty: ['პარკის ბილიკი ვერ მოიძებნა', 'is-warn'] };
  async function paintCities(body) {
    const data = await api('/cities');
    const r = data.rules;
    const totalPlayers = data.cities.reduce((n, c) => n + c.players, 0);
    body.innerHTML = `<div class="s-stack">
      <div class="s-callout">${ico('info')}<p><b>ყუთები ყველა ქალაქში, სადაც ერთი მოთამაშე მაინც ცხოვრობს.</b> ქალაქს სისტემა თავად პოულობს მოთამაშის ლოკაციით (იგივე ქალაქი, რაც აპში ჩანს), შემდეგ OpenStreetMap-ზე ეძებს საჯარო პარკების ბილიკებს — გზიდან, წყლიდან, სკოლიდან, საავადმყოფოდან, ტაძრიდან და სასაფლაოდან მოშორებით, პარკის სიღრმეში — და ყუთებს ქალაქის ადგილობრივი დროით აგდებს. თბილისს თავისი კამპანია აქვს (შაბათის წვიმა, ფარანი, დიდი საჩუქარი).${r.enabled ? '' : ' <b>ახლა გამორთულია „წესები → სხვა ქალაქები“-ში.</b>'}</p></div>
      <div class="s-metrics">
        <div class="s-metric"><span>ქალაქი</span><strong>${num(data.cities.length)}</strong><small>${num(data.cities.filter((c) => c.status === 'ready' && c.enabled).length)} მზადაა და ჩართულია</small></div>
        <div class="s-metric"><span>მოთამაშე ამ ქალაქებში</span><strong>${num(totalPlayers)}</strong><small>ლოკაციით</small></div>
        <div class="s-metric"><span>ყუთი ახლა</span><strong>${num(data.cities.reduce((n, c) => n + c.live, 0))}</strong><small>${num(data.cities.reduce((n, c) => n + c.planned, 0))} დაგეგმილი</small></div>
        <div class="s-metric"><span>გაიხსნა (ბოლო დღე)</span><strong>${num(data.cities.reduce((n, c) => n + c.opened, 0))}</strong><small>ამ ქალაქების ყუთებში</small></div>
      </div>
      <section class="s-card"><header class="s-card-head"><div><h3>ქალაქები</h3><p>„ყუთი ტალღაში“ — ცარიელი = მოთამაშეების მიხედვით (${num(r.boxesPerWave.base)} + 1 ყოველ ${num(r.boxesPerWave.perPlayers)}-ზე, მაქს. ${num(r.boxesPerWave.max)}); რიცხვი = ზუსტად ამდენი.</p></div>
        ${data.known.length ? `<div class="p4-actions"><select data-city-add aria-label="ქალაქის დამატება"><option value="">ქალაქის დამატება…</option>${data.known.map((k) => `<option value="${esc(k.id)}">${esc(k.nameKa || k.nameEn)}${k.nameEn && k.nameEn !== k.nameKa ? ` (${esc(k.nameEn)})` : ''} · ${esc(k.countryCode || '')}</option>`).join('')}</select><button type="button" class="btn compact" data-city-add-go>${ico('plus')} დამატება</button></div>` : ''}
        </header>
        <div class="s-card-body is-flush">${data.cities.length ? `<div class="s-table-wrap"><table class="s-table mb-table">
          <thead><tr><th>ქალაქი</th><th class="num">მოთამაშე</th><th>ადგილობრივი დრო</th><th>ადგილები</th><th>ყუთი ტალღაში</th><th class="num">ახლა / დაგეგმ.</th><th>ჩართული</th><th aria-label="მოქმედებები"></th></tr></thead>
          <tbody>${data.cities.map((c) => { const [label, tone] = CITY_STATUS[c.status] || [c.status, 'is-plain']; return `<tr data-city="${esc(c.cityId)}"${c.enabled ? '' : ' class="is-past"'}>
            <td><b>${esc(c.nameKa || c.nameEn)}</b><br><small class="s-muted">${esc(c.nameEn && c.nameEn !== c.nameKa ? `${c.nameEn} · ` : '')}${esc(c.countryCode || '')}${c.source === 'manual' ? ' · ხელით' : ''}</small></td>
            <td class="num">${num(c.players)}</td>
            <td>${esc(c.localTime)} <small class="s-muted">${esc(c.timezone)}</small></td>
            <td><span class="s-badge ${tone}" title="${esc(c.error || '')}">${esc(label)}</span>${c.status === 'ready' ? ` <small class="s-muted">${num(c.spotCount)}</small>` : ''}</td>
            <td><input type="number" class="mb-num" min="0" max="30" placeholder="${num(c.boxesPerWave)}" value="${c.override ?? ''}" data-city-per aria-label="ყუთი ტალღაში"></td>
            <td class="num">${num(c.live)} / ${num(c.planned)}</td>
            <td><input type="checkbox" class="s-switch" data-city-on ${c.enabled ? 'checked' : ''} aria-label="ქალაქი ჩართულია"></td>
            <td><div class="p4-actions is-end">
              ${c.status === 'ready' ? '<button type="button" class="btn compact" data-city-spots>ადგილები</button><button type="button" class="btn compact" data-city-apply title="ადგილობრივი დღევანდელი და ხვალინდელი ყუთები ახლავე">ყუთების შექმნა</button>' : ''}
              <button type="button" class="btn compact" data-city-harvest title="ადგილების ხელახლა ძებნა OpenStreetMap-ზე">განახლება</button>
            </div></td></tr>`; }).join('')}</tbody></table></div>`
          : `<div class="s-empty">${ico('globe')}<strong>სხვა ქალაქში მოთამაშე ჯერ არ არის</strong><span>როცა ვინმე, ვისაც ლოკაცია ჩართული აქვს, სხვა ქალაქში იქნება, ის აქ თავისით გამოჩნდება (ავტოპილოტი ყოველ 10 წუთში ამოწმებს).</span></div>`}</div></section>
    </div>`;
    const rowOf = (el) => el.closest('[data-city]')?.dataset.city;
    const send = async (path, opts, ok) => { try { const res = await api(path, opts); toast(ok, 'ok'); return res; } catch (err) { toast(say(err, 'ვერ შესრულდა.'), 'bad'); return null; } };
    body.querySelector('[data-city-add-go]')?.addEventListener('click', async () => {
      const id = body.querySelector('[data-city-add]').value;
      if (!id) { toast('აირჩიე ქალაქი', 'warn'); return; }
      if (await send('/cities', { method: 'POST', body: { cityId: id } }, 'ქალაქი დაემატა — ადგილებს რამდენიმე წუთში იპოვის')) await paintCities(body);
    });
    body.querySelectorAll('[data-city-on]').forEach((sw) => sw.addEventListener('change', async () => {
      sw.disabled = true;
      if (!(await send(`/cities/${rowOf(sw)}`, { method: 'PUT', body: { enabled: sw.checked } }, sw.checked ? 'ქალაქი ჩაირთო' : 'ქალაქი გამოირთო — ახალი ყუთები აქ აღარ ჩნდება'))) sw.checked = !sw.checked;
      await paintCities(body);
    }));
    body.querySelectorAll('[data-city-per]').forEach((inp) => inp.addEventListener('change', async () => {
      const v = inp.value === '' ? null : Number(inp.value);
      if (await send(`/cities/${rowOf(inp)}`, { method: 'PUT', body: { boxesPerWave: v } }, v == null ? 'ყუთები ისევ მოთამაშეების მიხედვით' : `ტალღაში ${v} ყუთი`)) { st.o = await api(''); if (!st.dirty) st.draft = structuredClone(st.o.campaign); await paintCities(body); }
    }));
    body.querySelectorAll('[data-city-harvest]').forEach((b) => b.addEventListener('click', async () => { b.disabled = true; if (await send(`/cities/${rowOf(b)}/harvest`, { method: 'POST' }, 'ადგილების ძებნა დაიწყო — 1–3 წუთი')) setTimeout(() => { if (st.sub === 'cities') void paintCities(body); }, 60_000); await paintCities(body); }));
    body.querySelectorAll('[data-city-apply]').forEach((b) => b.addEventListener('click', async () => { b.disabled = true; const r2 = await send(`/cities/${rowOf(b)}/apply`, { method: 'POST' }, 'ყუთები შეიქმნა'); if (r2) toast(`შეიქმნა ${num(r2.created)} ყუთი`, 'ok'); await paintCities(body); }));
    body.querySelectorAll('[data-city-spots]').forEach((b) => b.addEventListener('click', async () => {
      const city = data.cities.find((c) => c.cityId === rowOf(b));
      const { spots } = await api(`/cities/${city.cityId}/spots`);
      const d = V().openDialog?.({ title: `ადგილები · ${city.nameKa || city.nameEn}`, description: `${num(spots.length)} ადგილი საჯარო პარკების ბილიკებზე (OpenStreetMap).`, wide: true, watchDirty: false,
        body: `<div class="s-table-wrap"><table class="s-table mb-mini"><thead><tr><th>პარკი</th><th class="num">სიღრმე</th><th class="num">პარკის ფართობი</th><th></th></tr></thead><tbody>${spots.map((sp) => `<tr><td>${esc(sp.place || '—')}</td><td class="num">${num(Math.round(sp.depthM))} მ</td><td class="num">${num(Math.round((sp.areaM2 || 0) / 10000))} ჰა</td><td><a class="btn compact" href="https://www.google.com/maps?q=${sp.lat},${sp.lng}" target="_blank" rel="noopener" aria-label="რუკაზე ნახვა">${ico('pin')}</a></td></tr>`).join('')}</tbody></table></div>`,
        footer: '<button type="button" class="btn" data-no>დახურვა</button>' });
      doc.querySelector('#v3-dialog [data-no]').onclick = () => void d.close();
    }));
  }

  /* ═════════ ადგილები ═════════ */
  async function paintSpots(body) {
    st.spots = await api('/spots');
    const all = st.spots.spots;
    const districts = [...new Set(all.map((s) => s.district).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'ka'));
    const q = st.spotQ.trim().toLowerCase();
    const rows = all.filter((s) => (st.spotDistrict === 'all' || s.district === st.spotDistrict) && (!st.spotOnlyOut || s.excluded) && (!q || `${s.place} ${s.id}`.toLowerCase().includes(q)));
    const out = all.filter((s) => s.excluded).length;
    body.innerHTML = `<div class="s-stack">
      <div class="s-toolbar">
        <label class="s-field mb-inline"><span class="sr-only">ძებნა</span><input type="search" placeholder="პარკის ძებნა" value="${esc(st.spotQ)}" data-spot-q></label>
        <label class="s-field mb-inline"><span class="sr-only">უბანი</span><select data-spot-d><option value="all">ყველა უბანი (${num(all.length)})</option>${districts.map((x) => `<option value="${esc(x)}" ${x === st.spotDistrict ? 'selected' : ''}>${esc(x)} (${num(all.filter((s) => s.district === x).length)})</option>`).join('')}</select></label>
        <label class="mb-check"><input type="checkbox" class="s-switch" data-spot-out ${st.spotOnlyOut ? 'checked' : ''}> მხოლოდ გამორიცხული (${num(out)})</label>
      </div>
      <section class="s-card"><header class="s-card-head"><div><h3>ადგილები · ${num(rows.length)}</h3><p>საჯარო პარკების ფეხით სავალი ბილიკები (OpenStreetMap). გამორიცხულ ადგილას ავტოპილოტი ყუთს აღარ დადებს — მაგ. დაკეტილი პარკი ან ცუდი ბილიკი.</p></div></header>
        <div class="s-card-body is-flush"><div class="s-table-wrap"><table class="s-table mb-table">
          <thead><tr><th>ადგილი</th><th>უბანი</th><th>ტიპი</th><th>განათება</th><th class="num">სიღრმე</th><th class="num">ყუთი იყო</th><th>აქტიური</th><th></th></tr></thead>
          <tbody>${rows.map((s) => `<tr${s.excluded ? ' class="is-past"' : ''}>
            <td><b>${esc(s.place)}</b><br><small class="s-muted">${esc(s.id)}</small></td><td>${esc(s.district || '—')}</td><td>${esc(s.kind || '—')}</td><td>${s.lit ? 'განათებული' : '<span class="s-muted">—</span>'}</td>
            <td class="num">${s.depthM != null ? `${num(Math.round(s.depthM))} მ` : '—'}</td><td class="num">${num(s.used)}</td>
            <td><input type="checkbox" class="s-switch" data-spot="${esc(s.id)}" ${s.excluded ? '' : 'checked'} aria-label="ადგილი აქტიურია"></td>
            <td><a class="btn compact" href="https://www.google.com/maps?q=${s.latitude},${s.longitude}" target="_blank" rel="noopener" aria-label="რუკაზე ნახვა">${ico('pin')}</a></td></tr>`).join('')}</tbody></table></div></div></section>
    </div>`;
    const q$ = body.querySelector('[data-spot-q]');
    q$.addEventListener('input', () => { st.spotQ = q$.value; clearTimeout(st.spotT); st.spotT = setTimeout(() => { void paintSpots(body).then(() => { const el = body.querySelector('[data-spot-q]'); el.focus(); el.setSelectionRange(el.value.length, el.value.length); }); }, 250); });
    body.querySelector('[data-spot-d]').addEventListener('change', (e) => { st.spotDistrict = e.target.value; void paintSpots(body); });
    body.querySelector('[data-spot-out]').addEventListener('change', (e) => { st.spotOnlyOut = e.target.checked; void paintSpots(body); });
    body.querySelectorAll('[data-spot]').forEach((sw) => sw.addEventListener('change', async () => {
      sw.disabled = true;
      try {
        await api(`/spots/${encodeURIComponent(sw.dataset.spot)}`, { method: 'PUT', body: { excluded: !sw.checked } });
        toast(sw.checked ? 'ადგილი დაბრუნდა' : 'ადგილი გამოირიცხა — ახალ ყუთს აქ აღარ დადებს', 'ok');
        st.o = await api(''); if (!st.dirty) st.draft = structuredClone(st.o.campaign);
        await refreshHead();
        sw.disabled = false;
      } catch (err) { sw.checked = !sw.checked; sw.disabled = false; toast(say(err, 'ვერ შეიცვალა.'), 'bad'); }
    }));
  }

  /* ═════════ ციფრები ═════════ */
  async function paintStats(body) {
    st.stats = await api(`/stats?days=${st.statsDays}`);
    const days = st.stats.days, t = days.reduce((s, d) => ({ boxes: s.boxes + d.boxes, capacity: s.capacity + d.capacity, opened: s.opened + d.opened, players: s.players + d.players, coins: s.coins + d.coins }), { boxes: 0, capacity: 0, opened: 0, players: 0, coins: 0 });
    const C = global.AdminCharts;
    const short = (ymd) => { const [, m, d] = ymd.split('-').map(Number); return `${d} ${MONTHS[m - 1]}`; };
    const districts = st.o.districts || [], top = Math.max(1, ...districts.map((x) => x.opened));
    body.innerHTML = `<div class="s-stack">
      <div class="s-toolbar"><div class="s-segment" role="tablist" aria-label="პერიოდი">${[[14, '14 დღე'], [30, '30 დღე'], [60, '60 დღე'], [90, '90 დღე']].map(([k, l]) => `<button type="button" role="tab" data-days="${k}" aria-selected="${k === st.statsDays}">${l}</button>`).join('')}</div></div>
      <div class="s-metrics">
        <div class="s-metric"><span>ყუთი</span><strong>${num(t.boxes)}</strong><small>${num(t.capacity)} შესაძლო გახსნა</small></div>
        <div class="s-metric"><span>გაიხსნა</span><strong>${num(t.opened)}</strong><small>${t.capacity ? `${Math.round((t.opened / t.capacity) * 100)}% მარაგიდან` : '—'}</small></div>
        <div class="s-metric"><span>მოთამაშე-დღე</span><strong>${num(t.players)}</strong><small>ვინც დღეში ერთი მაინც გახსნა</small></div>
        <div class="s-metric"><span>ქოინი გაიცა</span><strong>${num(t.coins)}</strong><small>≈ ${num(Math.round(t.coins / 100))} ₾ მაღაზიის ფასით</small></div>
      </div>
      <section class="s-card"><header class="s-card-head"><div><h3>გახსნა დღეში</h3></div></header><div class="s-card-body">${C ? C.bars(days.map((d) => ({ day: short(d.date), count: d.opened })), { label: 'გახსნა დღეში', height: 200, empty: 'ამ პერიოდში ყუთი ჯერ არავის გაუხსნია' }) : ''}</div></section>
      <section class="s-card"><header class="s-card-head"><div><h3>ქოინი დღეში</h3></div></header><div class="s-card-body">${C ? C.bars(days.map((d) => ({ day: short(d.date), count: d.coins })), { label: 'ქოინი დღეში', height: 200, tone: 'amber', empty: 'ამ პერიოდში ქოინი ჯერ არ გაცემულა' }) : ''}</div></section>
      ${st.o.prizes ? `<section class="s-card"><header class="s-card-head"><div><h3>კვირის პრიზები · ${esc(dayLabel(st.o.prizes.week))}-ის კვირა</h3><p>ლიდერბორდის პირველი სამეული ორშაბათს იღებს ქოინებს (ყუთები — ქოინებით, მანძილი — კილომეტრებით).</p></div></header><div class="s-card-body">${st.o.prizes.winners.length ? `<div class="mb-meters">${st.o.prizes.winners.map((x) => `<div class="mb-meter-row"><span>${x.board === 'boxes' ? 'ყუთები' : 'მანძილი'} · ${['🥇', '🥈', '🥉'][x.rank - 1] || `#${x.rank}`} ${esc(x.handle || '—')}</span><div class="s-meter"><i style="width:${Math.min(100, Math.round((x.coins / Math.max(1, ...st.o.prizes.winners.map((y) => y.coins))) * 100))}%"></i></div><b>+${num(x.coins)}</b></div>`).join('')}</div>` : '<p class="s-muted">გასულ კვირას პრიზი არავის ჩარიცხვია — ლიდერბორდში ჩართული მოთამაშე არ ყოფილა, ან კვირა კამპანიამდე იყო.</p>'}</div></section>` : ''}
      <section class="s-card"><header class="s-card-head"><div><h3>სად ხსნიან · ბოლო 30 დღე</h3><p>უბნები გახსნების მიხედვით.</p></div></header><div class="s-card-body">${districts.length ? `<div class="mb-meters">${districts.map((x) => `<div class="mb-meter-row"><span>${esc(x.district)}</span><div class="s-meter"><i style="width:${Math.round((x.opened / top) * 100)}%"></i></div><b>${num(x.opened)}</b></div>`).join('')}</div>` : '<p class="s-muted">ჯერ არცერთი გახსნა.</p>'}</div></section>
      <section class="s-card"><header class="s-card-head"><div><h3>დღეების მიხედვით</h3></div></header><div class="s-card-body is-flush"><div class="s-table-wrap"><table class="s-table"><thead><tr><th>დღე</th><th class="num">ყუთი</th><th class="num">მარაგი</th><th class="num">გაიხსნა</th><th class="num">მოთამაშე</th><th class="num">ქოინი</th></tr></thead><tbody>
        ${days.slice().reverse().map((d) => `<tr><td>${esc(dayLabel(d.date))}</td><td class="num">${num(d.boxes)}</td><td class="num">${num(d.capacity)}</td><td class="num">${num(d.opened)}</td><td class="num">${num(d.players)}</td><td class="num">${num(d.coins)}</td></tr>`).join('')}
      </tbody></table></div></div></section>
    </div>`;
    body.querySelectorAll('[data-days]').forEach((b) => b.addEventListener('click', () => { st.statsDays = Number(b.dataset.days); void paintSub(); }));
    C?.hydrate?.();
  }

  /* ═════════ ჟურნალი ═════════ */
  async function paintLog(body) {
    st.log = await api(`/audit?offset=${st.logOffset}`);
    const me = typeof state !== 'undefined' ? state.admin : null;
    const who = (id) => (id === 'medirun-autopilot' ? 'ავტოპილოტი' : me && id === me.id ? 'შენ' : 'ადმინი');
    const detail = (r) => {
      const d = r.details || {};
      if (r.action === 'DROP_RULES_SAVE') return d.changed?.length ? `შეიცვალა: ${d.changed.join(', ')}` : '';
      if (r.action === 'DROP_DAY_RULE') return d.override ? (d.override.off ? 'გამორთული' : d.override.day ? 'საკუთარი წესი' : d.override.as ? (d.override.as === 'weekend' ? 'შაბათ-კვირის წესით' : 'სამუშაო დღის წესით') : '') + (d.override.note ? ` · ${d.override.note}` : '') : 'ჩვეულებრივზე დაბრუნდა';
      if (r.action === 'DROP_MANUAL') return `${d.place || d.district || 'კოორდინატი'} · ${num(d.coins)} ქოინი × ${num(d.stock)}${d.note ? ` · ${d.note}` : ''}`;
      if (r.action === 'DROP_DAY_REBUILD') return `წაიშალა ${num(d.removed)}, შეიქმნა ${num(d.created)}`;
      if (r.action === 'DROP_DAY_APPLY') return `შეიქმნა ${num(d.created)}`;
      if (r.action === 'DROP_DAY_CANCEL') return `გაუქმდა ${num(d.archived)}`;
      if (r.action === 'DROP_BOX_COINS') return `${num(d.before?.coins)} → ${num(d.coins)} ქოინი`;
      if (r.action === 'DROP_BOX_STOCK') return `${num(d.before?.stock)} → ${num(d.stock)}`;
      if (r.action === 'DROP_WEEK_PRIZES') return d.winners?.length ? `${d.winners.map((w) => `${w.board === 'boxes' ? 'ყუთები' : 'მანძილი'} #${w.rank} ${w.handle} +${num(w.coins)}`).join(', ')} · სულ ${num(d.total)}` : 'გამარჯვებული არ იყო';
      if (r.action === 'DROP_BUDGET_WARN') return `${num(d.paid)} / ${num(d.seasonCoins)} ქოინი (${d.percent}%) · დარჩა ${num(d.daysLeft)} დღე`;
      if (r.action === 'DROP_BUDGET_STOP') return `${num(d.paid)} / ${num(d.seasonCoins)} ქოინი — გაზარდე ბიუჯეტი „წესები → ეკონომიკა“`;
      if (r.action === 'DROP_RULES_UPGRADE') return `ეკონომიკა ${num(d.from)} → ${num(d.to)}: ახალი ტალღები, ქოინები და კიბე; შენი თარიღები, თემები და გამორთული დღეები შენარჩუნდა`;
      return '';
    };
    // Never a raw id as the label: a date, „წესები“, the box's place/time, or the gift title.
    const entityText = (r) => {
      const d = r.details || {}, id = String(r.entityId || '');
      if (/^\d{4}-\d{2}-\d{2}$/.test(id)) return dayLabel(id);
      if (id === st.o?.campaign?.id || id === 'campaign') return 'წესები';
      if (r.action === 'DROP_WEEK_PRIZES') return `${dayLabel(id)}-ის კვირა`;
      if (r.action.startsWith('DROP_BUDGET')) return 'სეზონის ბიუჯეტი';
      if (id === 'medirunAutopilot') return 'ავტოპილოტი';
      if (r.action === 'GIFT_SAVE') return d.after?.title || d.before?.title || 'საჩუქარი';
      const m = id.match(/^glow-(\d{4}-\d{2}-\d{2})-(?:x-(\d{2})(\d{2})|([a-z0-9]+)-(\d+))/);
      if (m) return `${dayLabel(m[1])} · ${m[2] ? `ხელით ${m[2]}:${m[3]}` : `${kindLabel(m[4] === 'sat' ? 'saturday' : m[4] === 'lan' ? 'lantern' : m[4])} №${Number(m[5])}`}`;
      if (r.action.startsWith('DROP_SPOT')) return id.replace(/-\d+$/, '').replace(/-/g, ' ');
      return 'ყუთი';
    };
    body.innerHTML = `<section class="s-card"><header class="s-card-head"><div><h3>ცვლილებების ჟურნალი</h3><p>${num(st.log.total)} ჩანაწერი · ყველა ცვლილება ყუთებსა და წესებში.</p></div></header>
      <div class="s-card-body is-flush">${st.log.rows.length ? `<div class="s-table-wrap"><table class="s-table"><thead><tr><th>როდის</th><th>ვინ</th><th>რა</th><th>რას</th><th>დეტალი</th></tr></thead><tbody>
        ${st.log.rows.map((r) => `<tr><td>${esc(when(r.createdAt))}</td><td>${esc(who(r.actorId))}</td><td><b>${esc(ACTIONS[r.action] || 'ცვლილება')}</b></td><td class="s-muted">${esc(entityText(r))}</td><td>${esc(detail(r))}</td></tr>`).join('')}
      </tbody></table></div>` : `<div class="s-empty">${ico('history')}<strong>ჯერ ცვლილება არ ყოფილა</strong></div>`}</div>
      ${st.log.total > 50 ? `<footer class="s-card-foot"><button type="button" class="btn compact" data-log-prev ${st.logOffset ? '' : 'disabled'}>წინა</button><span class="s-muted">${num(st.logOffset + 1)}–${num(Math.min(st.log.total, st.logOffset + 50))}</span><button type="button" class="btn compact" data-log-next ${st.logOffset + 50 < st.log.total ? '' : 'disabled'}>შემდეგი</button></footer>` : ''}</section>`;
    body.querySelector('[data-log-prev]')?.addEventListener('click', () => { st.logOffset = Math.max(0, st.logOffset - 50); void paintSub(); });
    body.querySelector('[data-log-next]')?.addEventListener('click', () => { st.logOffset += 50; void paintSub(); });
  }

  global.renderMedirunBoxes = renderMedirunBoxes;
})(window);
