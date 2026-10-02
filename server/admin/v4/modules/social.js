/**
 * MediCard Admin V4 — #/social სოციალური ქსელები (/api/admin/social).
 * The social-media campaign log (server/src/lib/socialPosts.js): every post / story the operator
 * scheduled in Metricool — when (Asia/Tbilisi), where, the caption, the media — and the exact history
 * ("SocialPostEvent"). Read-only; rows are recorded with `node server/scripts/social-log.mjs`.
 * Tabs: კალენდარი (month grid) · ჩამონათვალი (table) · ისტორია (event feed); a drawer shows one post.
 * Brands: CAMPAIGNS maps each campaign to MEDICARD or MEDIRUN — MEDIRUN posts get night cards / badges, a
 * brand filter (all views) and the „გაანათე თბილისი“ band; „კამპანიის დღე“ always counts the MEDICARD campaign.
 */
(function adminV4Social(global) {
  const doc = document;
  const $ = (id) => doc.getElementById(id);
  const V = () => global.AdminV3 || {};
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const ico = (n) => (typeof global.icon === 'function' ? global.icon(n) : '');
  const num = (n) => (Number.isFinite(Number(n)) ? Number(n).toLocaleString('ka-GE') : '—');
  /** The server's message when it is Georgian; otherwise our sentence (the raw English stays out of the owner's way). */
  const say = (err, fallback) => (/[ა-ჿ]/.test(err?.message || '') ? err.message : fallback);
  /** Placeholder in the page's own shape (KPI strip + month), so nothing jumps when the data lands. */
  const skel = () => `<div class="s-stack v3-tab-shell" aria-busy="true" aria-label="იტვირთება…">
    <div class="s-metrics">${'<div class="s-metric p1-skel-kpi"><i></i><i></i><i></i></div>'.repeat(4)}</div>
    <section class="s-card"><div class="p1-skel-rows">${'<i></i>'.repeat(6)}</div></section>
  </div>`;

  if (typeof ICONS === 'object') {
    ICONS.share = '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4"/>';
    ICONS.play = ICONS.play || '<polygon points="7 4 20 12 7 20 7 4"/>';
    ICONS.external = ICONS.external || '<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>';
    ICONS.edit = ICONS.edit || '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>';
    doc.querySelectorAll('[data-icon="share"]').forEach((el) => {
      el.querySelector('svg.icon')?.remove();
      el.insertAdjacentHTML('afterbegin', ico('share'));
    });
  }

  const VIEWS = [['calendar', 'კალენდარი'], ['list', 'ჩამონათვალი'], ['history', 'ისტორია']];
  const NETWORKS = { facebook: ['FB', 'Facebook'], instagram: ['IG', 'Instagram'], linkedin: ['in', 'LinkedIn'] };
  const NET_FILTERS = [['all', 'ყველა ქსელი'], ['facebook', 'Facebook'], ['instagram', 'Instagram'], ['linkedin', 'LinkedIn']];
  const STATUS = {
    PLANNED: ['გეგმაში', ''],
    SCHEDULED: ['დაგეგმილი', 'is-info'],
    PUBLISHED: ['გამოქვეყნდა', 'is-ok'],
    FAILED: ['ვერ გამოქვეყნდა', 'is-bad'],
    CANCELED: ['გაუქმდა', 'is-warn'],
  };
  const STATUS_FILTERS = [['all', 'ყველა სტატუსი'], ['upcoming', 'დაგეგმილი'], ['PUBLISHED', 'გამოქვეყნებული'], ['FAILED', 'შეცდომა'], ['CANCELED', 'გაუქმებული']];
  const KIND = { POST: 'პოსტი', STORY: 'სთორი', REEL: 'რილსი', CAROUSEL: 'კარუსელი' };
  /** Rubrics recorded with English slugs → the Georgian names the operator uses for the rest. */
  const PILLAR = { launch: 'გაშვება', feature: 'ფუნქცია', tip: 'რჩევა', trust: 'ნდობა', move: 'მოძრაობა', engage: 'ჩართულობა', story: 'ამბავი' };
  const EVENT = {
    CREATED: ['შეიქმნა', 'is-accent', 'plus'],
    SCHEDULED: ['დაიგეგმა Metricool-ში', 'is-info', 'clock'],
    UPDATED: ['შეიცვალა', '', 'edit'],
    PUBLISHED: ['გამოქვეყნდა', 'is-ok', 'check'],
    FAILED: ['ვერ გამოქვეყნდა', 'is-bad', 'alert'],
    CANCELED: ['გაუქმდა', 'is-warn', 'x'],
    SYNCED: ['სინქრონიზაცია', '', 'refresh'],
  };
  /** Field names in the history details written by lib/socialPosts.js (describeChanges). */
  const FIELD = {
    campaign: 'კამპანია', networks: 'ქსელები', kind: 'ტიპი', pillar: 'რუბრიკა', title: 'სათაური', text: 'ტექსტი', textEn: 'ინგლისური ტექსტი',
    mediaUrls: 'მედია', scheduledAt: 'დრო', notes: 'შენიშვნა', metricoolId: 'Metricool-ის ნომერი', externalUrl: 'ბმული', publishedAt: 'გამოქვეყნების დრო',
  };
  const MONTHS = ['იან', 'თებ', 'მარ', 'აპრ', 'მაი', 'ივნ', 'ივლ', 'აგვ', 'სექ', 'ოქტ', 'ნოე', 'დეკ'];
  const MONTHS_LONG = ['იანვარი', 'თებერვალი', 'მარტი', 'აპრილი', 'მაისი', 'ივნისი', 'ივლისი', 'აგვისტო', 'სექტემბერი', 'ოქტომბერი', 'ნოემბერი', 'დეკემბერი'];
  const WEEKDAYS = ['ორშ', 'სამ', 'ოთხ', 'ხუთ', 'პარ', 'შაბ', 'კვი'];
  const VIEW_KEY = 'medicard.admin.social.view';
  const BRAND_KEY = 'medicard.admin.social.brand';

  /* Campaign registry: which brand a campaign belongs to and how the page names it. Unknown ids that start
     with "medirun" are MEDIRUN, everything else is MEDICARD. start/end (Tbilisi days) drive the MEDIRUN band. */
  const CAMPAIGNS = {
    'medirun-glow-2026': {
      brand: 'medirun', label: 'MEDIRUN · გაანათე თბილისი', short: 'MEDIRUN', start: '2026-10-05', end: '2026-12-31',
      posters: '#/campaigns',
    },
    'medirun-passport-2026-10': { brand: 'medirun', label: 'MEDIRUN · თბილისის პასპორტი', short: 'MEDIRUN' },
    'launch-2026-10': { brand: 'medicard', label: 'MEDICARD · გაშვება', short: 'MEDICARD' },
  };
  const GLOW = 'medirun-glow-2026';
  const BRANDS = { medicard: 'MEDICARD', medirun: 'MEDIRUN' };
  const BRAND_FILTERS = [['all', 'ყველა'], ['medicard', 'MEDICARD'], ['medirun', 'MEDIRUN']];

  const st = {
    view: (() => { try { return sessionStorage.getItem(VIEW_KEY) || 'calendar'; } catch { return 'calendar'; } })(),
    brand: (() => { try { const v = sessionStorage.getItem(BRAND_KEY); return BRANDS[v] ? v : 'all'; } catch { return 'all'; } })(),
    month: null,
    network: 'all',
    status: 'all',
    data: null,
  };
  /** First / last post day of every campaign (from the summary) — names the campaigns CAMPAIGNS does not know. */
  const spans = new Map();

  function campaignOf(id) {
    const key = String(id || '');
    if (Object.prototype.hasOwnProperty.call(CAMPAIGNS, key)) {
      const c = CAMPAIGNS[key];
      return { ...c, name: c.label.replace(/^(MEDIRUN|MEDICARD)\s*·\s*/, '') };
    }
    const brand = key.toLowerCase().startsWith('medirun') ? 'medirun' : 'medicard';
    const span = spans.get(key);
    const name = span ? `კამპანია · ${span.from === span.to ? span.from : `${span.from} – ${span.to}`}` : 'სხვა კამპანია';
    return { brand, label: `${BRANDS[brand]} · ${name}`, short: BRANDS[brand], name, unknown: true };
  }
  const brandOf = (post) => campaignOf(post?.campaign).brand;
  const kindLabel = (k) => KIND[k] || k || '—';
  const pillarLabel = (p) => PILLAR[p] || p || '';
  const netNames = (list) => (list || []).map((n) => NETWORKS[n]?.[1] || n).join(', ');

  /* ─────────────── Time (always Asia/Tbilisi, 24 h; built by hand — browsers often lack ka-GE data) ─────────────── */
  const partsFmt = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Tbilisi', hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
  });
  function tp(iso) {
    const d = iso instanceof Date ? iso : new Date(iso);
    if (Number.isNaN(d.getTime())) return null;
    const p = Object.fromEntries(partsFmt.formatToParts(d).map((x) => [x.type, x.value]));
    return { y: Number(p.year), m: Number(p.month), d: Number(p.day), time: `${p.hour}:${p.minute}`, key: `${p.year}-${p.month}-${p.day}`, month: `${p.year}-${p.month}` };
  }
  /** "დღეს, 14:05" · "28 სექ, 18:30" · "28 სექ 2025, 18:30" — the admin-wide timestamp style. */
  const when = (iso) => (iso ? V().formatDate?.(iso, 'datetime') || '—' : '—');
  const weekdayOf = (key) => (new Date(`${key}T00:00:00Z`).getUTCDay() + 6) % 7; // Monday = 0
  const dayDiff = (fromKey, toKey) => Math.round((Date.parse(`${toKey}T00:00:00Z`) - Date.parse(`${fromKey}T00:00:00Z`)) / 86_400_000);
  const shortDay = (key) => { const [, m, d] = key.split('-').map(Number); return `${d} ${MONTHS[m - 1]}`; };

  /**
   * History details come from the server as compact technical text ("PLANNED → SCHEDULED; Metricool 3858…",
   * "scheduledAt: 2026-10-04 10:00 → 2026-10-04 11:00", "facebook+instagram · POST · … · PLANNED").
   * Translate the enums, field names and Tbilisi stamps for reading; free text from the operator stays as written.
   */
  function humanDetail(detail) {
    let s = String(detail || '');
    s = s.replace(/\b(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2})\b/g, (m, y, mo, d, h, mi) => when(`${y}-${mo}-${d}T${h}:${mi}:00+04:00`));
    s = s.replace(/\b(title|textEn|text|notes) შეიცვალა/g, (m, f) => `${FIELD[f]} შეიცვალა`);
    s = s.replace(/(^|; )(campaign|networks|kind|pillar|mediaUrls|scheduledAt|publishedAt|metricoolId|externalUrl):/g, (m, pre, f) => `${pre}${FIELD[f]}:`);
    s = s.replace(/\b(?:facebook|instagram|linkedin)(?:\+(?:facebook|instagram|linkedin))*\b/g, (m) => m.split('+').map((n) => NETWORKS[n][1]).join(' + '));
    s = s.replace(/\b(PLANNED|SCHEDULED|PUBLISHED|FAILED|CANCELED)\b/g, (m) => STATUS[m][0]);
    s = s.replace(/\b(POST|STORY|REEL|CAROUSEL)\b/g, (m) => KIND[m]);
    s = s.replace(/\bMetricool (\d+)/g, 'Metricool № $1');
    Object.keys(CAMPAIGNS).forEach((id) => { s = s.split(id).join(CAMPAIGNS[id].label); });
    return s.replace(/; /g, ' · ');
  }

  /* ─────────────── Small pieces ─────────────── */
  const nets = (list) => `<span class="s-nets">${(list || []).map((n) => `<span class="s-net is-${esc(n)}" title="${esc(NETWORKS[n]?.[1] || n)}">${esc(NETWORKS[n]?.[0] || n)}</span>`).join('')}</span>`;
  const statusBadge = (s) => `<span class="s-badge ${STATUS[s]?.[1] || ''}">${esc(STATUS[s]?.[0] || s)}</span>`;
  const kindBadge = (k) => `<span class="s-badge is-plain">${esc(kindLabel(k))}</span>`;
  /** MEDIRUN (mint on night) / MEDICARD (neutral) badge; `full` shows the campaign label instead of the brand. */
  function brandBadge(campaign, { full = false } = {}) {
    const c = campaignOf(campaign);
    return `<span class="s-badge s-brand is-${esc(c.brand)}" title="${esc(c.label)}">${esc(full ? c.label : c.short)}</span>`;
  }
  const brandDot = (brand) => `<span class="s-brand-dot is-${esc(brand)}" aria-hidden="true"></span>`;
  const copyChip = (value) => `<button type="button" class="inv-copy p1-copy" data-copy="${esc(value)}" title="დააკოპირე">${esc(value)}${ico('copy')}</button>`;
  const isVideo = (url) => /\.(mp4|mov|webm|m4v)(\?|$)/i.test(url || '');
  /** Campaign posters are admin-only files on this origin (lib/campaignMedia.js): load them without the site prefix. */
  const mediaUrl = (url) => (global.AdminCampaignMedia?.local ? global.AdminCampaignMedia.local(url) : url);
  function thumb(post) {
    const url = mediaUrl(post.mediaUrls?.[0]);
    if (!url) return '<span class="s-muted">—</span>';
    const more = post.mediaUrls.length > 1 ? `<i class="s-social-more">+${post.mediaUrls.length - 1}</i>` : '';
    if (isVideo(url)) return `<span class="s-social-thumb is-video">${ico('play')}${more}</span>`;
    return `<span class="s-social-thumb"><img src="${esc(url)}" alt="" loading="lazy" decoding="async">${more}</span>`;
  }
  function metric(label, valueHtml, smallHtml, tone = '') {
    return `<div class="s-metric ${tone}"><span>${esc(label)}</span><strong>${valueHtml}</strong><small>${smallHtml || ''}</small></div>`;
  }

  function filtered(posts) {
    return posts.filter((p) => {
      if (st.brand !== 'all' && brandOf(p) !== st.brand) return false;
      if (st.network !== 'all' && !(p.networks || []).includes(st.network)) return false;
      if (st.status === 'upcoming') return p.status === 'PLANNED' || p.status === 'SCHEDULED';
      if (st.status !== 'all') return p.status === st.status;
      return true;
    });
  }

  function defaultMonth(d) {
    const pick = d.summary?.next?.scheduledAt || d.summary?.campaign?.firstAt || d.posts?.[0]?.scheduledAt || new Date().toISOString();
    return tp(pick).month;
  }
  function shiftMonth(month, delta) {
    const [y, m] = month.split('-').map(Number);
    const date = new Date(Date.UTC(y, m - 1 + delta, 1));
    return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
  }

  /** „კამპანიის დღე“ counts the MEDICARD campaign (most recently started non-MEDIRUN one), in Tbilisi days. */
  function medicardCampaign(s) {
    const c = (s.campaigns || [])
      .filter((x) => x.firstAt && campaignOf(x.campaign).brand !== 'medirun')
      .sort((a, b) => Date.parse(b.firstAt) - Date.parse(a.firstAt))[0];
    const first = c && tp(c.firstAt);
    if (!first) return null;
    const length = Number(s.campaign?.length) || 28;
    const day = dayDiff(first.key, tp(new Date()).key) + 1;
    return { ...c, label: campaignOf(c.campaign).label, length, day: day < 1 ? 0 : Math.min(day, length) };
  }

  /* ─────────────── MEDIRUN band (always the night city, in both admin themes) ─────────────── */
  const SKYLINE = (() => {
    const H = 96;
    const back = [[0, 30, 44], [40, 22, 62], [86, 38, 36], [140, 26, 72], [184, 42, 50], [244, 30, 82], [292, 34, 46], [334, 26, 58]];
    const front = [[18, 30, 34], [62, 34, 54], [112, 24, 28], [160, 36, 60], [216, 26, 38], [262, 40, 66], [318, 30, 30]];
    const blocks = (list, cls) => list.map(([x, w, h]) => `<rect class="${cls}" x="${x}" y="${H - h}" width="${w}" height="${h}"/>`).join('');
    let lit = '';
    front.forEach(([x, w, h], b) => {
      for (let y = H - h + 6; y < H - 6; y += 8) {
        for (let wx = x + 5; wx < x + w - 5; wx += 7) if ((wx * 3 + y * 5 + b * 7) % 11 < 3) lit += `<rect x="${wx}" y="${y}" width="3" height="4"/>`;
      }
    });
    // One gold window in the tallest tower: the finale gift hidden in the city.
    return `<svg class="s-mr-sky" viewBox="0 0 360 ${H}" preserveAspectRatio="xMaxYMax meet" aria-hidden="true" focusable="false">${blocks(back, 'b')}${blocks(front, 'f')}<g class="w">${lit}</g><circle class="gh" cx="284.5" cy="76.5" r="7"/><rect class="g" x="282.5" y="74" width="4" height="5"/></svg>`;
  })();
  const GLOW_MARK = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M3 21h18M5 21V10l5-3v14M10 21V4l9 4v13" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M13 10h2M13 13.5h2M16.5 13.5h.01M13 17h2" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';

  function glowWindow(c) {
    const length = dayDiff(c.start, c.end) + 1;
    const day = dayDiff(c.start, tp(new Date()).key) + 1;
    if (day < 1) return { phase: 'before', day: 0, length, pct: 0 };
    if (day > length) return { phase: 'after', day: length, length, pct: 100 };
    return { phase: 'live', day, length, pct: Math.round((day / length) * 1000) / 10 };
  }

  function mediRunBand(allPosts) {
    const mine = allPosts.filter((p) => brandOf(p) === 'medirun');
    if (!mine.length) return '';
    const c = CAMPAIGNS[GLOW];
    const w = glowWindow(c);
    const count = (status) => allPosts.filter((p) => p.campaign === GLOW && p.status === status).length;
    const failed = count('FAILED');
    const now = Date.now();
    const next = mine
      .filter((p) => (p.status === 'PLANNED' || p.status === 'SCHEDULED') && Date.parse(p.scheduledAt) >= now)
      .sort((a, b) => Date.parse(a.scheduledAt) - Date.parse(b.scheduledAt))[0];
    const dayHtml = w.phase === 'live'
      ? `<strong>დღე ${num(w.day)}</strong><span>/ ${num(w.length)}</span>`
      : `<strong>${w.phase === 'before' ? `იწყება ${esc(shortDay(c.start))}` : 'დასრულდა'}</strong><span>${num(w.length)} დღე</span>`;
    const stat = (label, n, tone = '') => `<div class="${tone}"><dt>${esc(label)}</dt><dd>${num(n)}</dd></div>`;
    const pressed = st.brand === 'medirun';
    return `<section class="s-mr-band" aria-label="${esc(c.label)}">
      ${SKYLINE}
      <div class="s-mr-head">
        <div class="s-mr-id">
          <span class="s-mr-mark">${GLOW_MARK}</span>
          <div>
            <p class="s-mr-kicker">MEDIRUN კამპანია · ${esc(shortDay(c.start))} – ${esc(shortDay(c.end))}</p>
            <h3>${esc(c.label)}</h3>
            <p class="s-mr-note">ქალაქში დამალული საჩუქრების ძებნა. <b>ფინალი ${esc(shortDay(c.end))}:</b> წითელი iPhone 18 Pro Max — ჩანს მხოლოდ მათ, ვინც თბილისის 1% გაანათა.</p>
          </div>
        </div>
        <div class="s-mr-actions">
          <button type="button" class="s-mr-btn" data-brand-toggle aria-pressed="${pressed}">${pressed ? ico('check') : brandDot('medirun')} მხოლოდ MEDIRUN</button>
          <a class="s-mr-btn is-ghost" href="${esc(c.posters)}">გეგმა და პოსტერები</a>
        </div>
      </div>
      <div class="s-mr-grid">
        <div class="s-mr-cell">
          <span class="s-mr-label">კამპანიის დღე</span>
          <div class="s-mr-day">${dayHtml}</div>
          <div class="s-mr-track" role="progressbar" aria-label="კამპანიის დღე" aria-valuemin="0" aria-valuemax="${w.length}" aria-valuenow="${w.day}"><i style="width:${w.pct}%"></i><b title="ფინალი ${esc(shortDay(c.end))}"></b></div>
          <div class="s-mr-scale"><span>${esc(shortDay(c.start))}</span><span class="is-gold">${esc(shortDay(c.end))} · ფინალი</span></div>
        </div>
        <dl class="s-mr-cell s-mr-counts">
          ${stat('Metricool-ში დაგეგმილი', count('SCHEDULED'))}
          ${stat('გამოქვეყნდა', count('PUBLISHED'), 'is-mint')}
          ${stat('ცოცხლად / ხელით', count('PLANNED'))}
          ${failed ? stat('ვერ გამოქვეყნდა', failed, 'is-bad') : ''}
        </dl>
        <div class="s-mr-cell s-mr-next">
          <span class="s-mr-label">შემდეგი MEDIRUN</span>
          ${next ? `<button type="button" class="s-mr-next-btn" data-post="${esc(next.id)}">
            <b>${esc(when(next.scheduledAt))} · ${esc(kindLabel(next.kind))}</b>
            <span>${esc(next.title)}</span>
          </button>` : '<p class="s-mr-none">დაგეგმილი MEDIRUN პოსტი აღარ არის.</p>'}
        </div>
      </div>
    </section>`;
  }

  /* ─────────────── Views ─────────────── */
  function calendarView(posts) {
    const [y, m] = st.month.split('-').map(Number);
    const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
    const lead = weekdayOf(`${st.month}-01`);
    const todayKey = tp(new Date()).key;
    const byDay = new Map();
    posts.forEach((p) => {
      const t = tp(p.scheduledAt);
      if (!t || t.month !== st.month) return;
      if (!byDay.has(t.key)) byDay.set(t.key, []);
      byDay.get(t.key).push({ p, t });
    });
    const inMonth = [...byDay.values()].flat();
    const stories = inMonth.filter(({ p }) => p.kind === 'STORY').length;
    const counted = [inMonth.length - stories ? `${num(inMonth.length - stories)} პოსტი` : '', stories ? `${num(stories)} სთორი` : ''].filter(Boolean).join(' და ');
    const cells = [];
    for (let i = 0; i < lead; i += 1) cells.push('<div class="s-cal-day is-out" aria-hidden="true"></div>');
    for (let day = 1; day <= days; day += 1) {
      const key = `${st.month}-${String(day).padStart(2, '0')}`;
      const items = (byDay.get(key) || []).sort((a, b) => a.t.time.localeCompare(b.t.time));
      cells.push(`<div class="s-cal-day${key === todayKey ? ' is-today' : ''}${items.length ? '' : ' is-empty'}">
        <span class="s-cal-num">${day}<em>${WEEKDAYS[weekdayOf(key)]}</em></span>
        ${items.map(({ p, t }) => {
          const mr = brandOf(p) === 'medirun';
          return `<button type="button" class="s-cal-item is-${esc(p.status.toLowerCase())}${mr ? ' is-medirun' : ''}" data-post="${esc(p.id)}" title="${esc(`${t.time} · ${mr ? 'MEDIRUN · ' : ''}${kindLabel(p.kind)} · ${STATUS[p.status]?.[0] || p.status} · ${p.title}`)}">
          <span class="s-cal-row"><b>${esc(t.time)}</b>${nets(p.networks)}<span class="s-cal-kind">${esc(kindLabel(p.kind))}</span>${mr ? '<span class="s-cal-tag">MEDIRUN</span>' : ''}</span>
          <span class="s-cal-title">${esc(p.title)}</span>
        </button>`;
        }).join('')}
      </div>`);
    }
    while (cells.length % 7) cells.push('<div class="s-cal-day is-out" aria-hidden="true"></div>');
    return `<section class="s-card">
      <header class="s-card-head s-cal-head">
        <div><h3>${esc(MONTHS_LONG[m - 1])} ${y}</h3><p>${counted || 'ამ თვეში ჩანაწერი არ არის'} · თბილისის დროით</p></div>
        <div class="s-cal-tools">
          <div class="s-cal-legend">
            <span>${brandDot('medicard')}MEDICARD</span>
            <span>${brandDot('medirun')}MEDIRUN</span>
          </div>
          <div class="s-cal-nav">
            <button type="button" class="btn ghost compact" data-month="-1" aria-label="წინა თვე">‹</button>
            <button type="button" class="btn ghost compact" data-month="0">დღეს</button>
            <button type="button" class="btn ghost compact" data-month="1" aria-label="შემდეგი თვე">›</button>
          </div>
        </div>
      </header>
      <div class="s-card-body"><div class="s-cal" role="grid">
        ${WEEKDAYS.map((w) => `<div class="s-cal-wd" role="columnheader">${w}</div>`).join('')}
        ${cells.join('')}
      </div></div>
    </section>`;
  }

  function listView(posts) {
    return `<section class="s-card">
      <header class="s-card-head"><div><h3>ყველა პოსტი და სთორი</h3><p>ჯერ მომავალი (უახლოესი პირველი), მერე გასული · თბილისის დროით</p></div></header>
      <div class="s-card-body is-flush"><div class="s-table-wrap"><table class="s-table p1-social-table">
        <thead><tr><th>დრო</th><th>კამპანია</th><th>ქსელები</th><th>ტიპი</th><th>რუბრიკა</th><th>სათაური</th><th>სტატუსი</th><th>მედია</th></tr></thead>
        <tbody>${posts.length ? posts.map((p) => {
          const c = campaignOf(p.campaign);
          return `<tr data-post="${esc(p.id)}" tabindex="0" class="is-click${c.brand === 'medirun' ? ' is-medirun' : ''}">
          <td class="p1-nowrap" data-label="დრო">${esc(when(p.scheduledAt))}</td>
          <td class="s-social-camp" data-label="კამპანია">${brandBadge(p.campaign)}<div class="s-muted">${esc(c.name)}</div></td>
          <td data-label="ქსელები">${nets(p.networks)}</td>
          <td data-label="ტიპი">${kindBadge(p.kind)}</td>
          <td data-label="რუბრიკა">${esc(pillarLabel(p.pillar) || '—')}</td>
          <td class="p1-social-title" data-label="სათაური"><b>${esc(p.title)}</b></td>
          <td data-label="სტატუსი">${statusBadge(p.status)}</td>
          <td data-label="მედია">${thumb(p)}</td>
        </tr>`;
        }).join('') : `<tr><td colspan="8"><div class="s-empty">${ico('share')}<strong>ამ ფილტრში პოსტი არ არის</strong><span>შეცვალე ბრენდის, ქსელის ან სტატუსის ფილტრი.</span></div></td></tr>`}</tbody>
      </table></div></div>
    </section>`;
  }

  function historyView(events, postById) {
    return `<section class="s-card">
      <header class="s-card-head"><div><h3>ისტორია</h3><p>ყოველი ჩაწერა და ცვლილება, ბოლო პირველი (მაქს. 300)</p></div></header>
      <div class="s-card-body is-flush">${events.length ? events.map((e) => {
        const [label, tone, iconName] = EVENT[e.type] || [e.type, '', 'info'];
        const post = postById.get(e.postId);
        return `<article class="s-feed-item">
          <span class="s-avatar">${ico(iconName)}</span>
          <div>
            <header><button type="button" class="s-link" data-post="${esc(e.postId)}"><b>${esc(e.title || post?.title || 'პოსტი')}</b></button>${post ? brandBadge(post.campaign) : ''}${nets(e.networks)}<span class="s-badge ${tone}">${esc(label)}</span><time>${esc(when(e.at))}</time></header>
            ${e.detail ? `<p class="s-feed-body">${esc(humanDetail(e.detail))}</p>` : ''}
          </div>
        </article>`;
      }).join('') : `<div class="s-empty">${ico('clock')}<strong>ისტორია ჯერ ცარიელია</strong><span>აქ გამოჩნდება ყოველი ჩაწერა და სტატუსის ცვლილება.</span></div>`}</div>
    </section>`;
  }

  /* ─────────────── Page ─────────────── */
  function paint(root) {
    const d = st.data;
    const s = d.summary || {};
    const posts = filtered(d.posts || []);
    const next = s.next;
    const camp = medicardCampaign(s);
    const failed = s.status?.FAILED || 0;
    const empty = !(d.posts || []).length;
    const postById = new Map((d.posts || []).map((p) => [p.id, p]));
    const events = (d.events || []).filter((e) => st.brand === 'all' || (postById.has(e.postId) && brandOf(postById.get(e.postId)) === st.brand));
    const brandSeg = `<div class="s-segment" role="tablist" aria-label="ბრენდი">${BRAND_FILTERS.map(([k, label]) => `<button type="button" role="tab" aria-selected="${k === st.brand}" data-brand="${k}">${BRANDS[k] ? brandDot(k) : ''}${label}</button>`).join('')}</div>`;
    const publishedHint = failed
      ? `<button type="button" class="p1-metric-link is-bad" data-show-failed>${ico('alert')} ვერ გამოქვეყნდა: ${num(failed)}</button>`
      : (s.lastPublished ? `ბოლო: ${esc(when(s.lastPublished.publishedAt || s.lastPublished.scheduledAt))}` : 'ჯერ არაფერი');

    const body = st.view === 'list' ? listView(posts) : st.view === 'history' ? historyView(events, postById) : calendarView(posts);
    root.innerHTML = `<div class="s-stack v3-tab-shell s-social">
      ${d.installed === false ? `<div class="s-callout is-warn">${ico('alert')}<p><b>პოსტების ჩანაწერები ბაზაში ჯერ არ არის მომზადებული.</b> ის თავისით მომზადდება სერვერის შემდეგი განახლებისას — პოსტები ამის შემდეგ გამოჩნდება.</p></div>` : ''}

      <div class="s-metrics">
        ${metric('დაგეგმილი', num(s.planned || 0), `გეგმაში ${num(s.status?.PLANNED || 0)} · Metricool-ში ${num(s.status?.SCHEDULED || 0)}`)}
        ${metric('გამოქვეყნებული', num(s.published || 0), publishedHint)}
        ${metric('შემდეგი პოსტი', next ? esc(when(next.scheduledAt)) : '—', next ? `${nets(next.networks)}${brandOf(next) === 'medirun' ? ` ${brandBadge(next.campaign)}` : ''} ${esc(kindLabel(next.kind))} · ${esc(next.title)}` : 'დაგეგმილი პოსტი არ არის')}
        ${metric('კამპანიის დღე', camp ? `${num(camp.day)} <small>/ ${num(camp.length)}</small>` : '—', camp ? `${esc(camp.label)} · ${camp.day ? 'დაიწყო' : 'იწყება'} ${esc(when(camp.firstAt))}` : 'კამპანია არ არის')}
      </div>

      ${mediRunBand(d.posts || [])}

      <div class="s-toolbar">
        <div class="s-social-facets">
          <div class="s-segment" role="tablist" aria-label="ხედი">${VIEWS.map(([k, label]) => `<button type="button" role="tab" aria-selected="${k === st.view}" data-view="${k}">${label}${k === 'history' ? ` <i>${num(events.length)}</i>` : ''}</button>`).join('')}</div>
          ${brandSeg}
        </div>
        <button type="button" class="btn ghost compact" data-refresh>${ico('refresh')} განახლება</button>
      </div>
      ${st.view === 'history' ? '' : `<div class="s-social-facets">
        <div class="s-segment" role="tablist" aria-label="ქსელი">${NET_FILTERS.map(([k, label]) => `<button type="button" role="tab" aria-selected="${k === st.network}" data-network="${k}">${label}</button>`).join('')}</div>
        <div class="s-segment" role="tablist" aria-label="სტატუსი">${STATUS_FILTERS.map(([k, label]) => `<button type="button" role="tab" aria-selected="${k === st.status}" data-status="${k}">${label}</button>`).join('')}</div>
      </div>`}

      ${empty && d.installed !== false ? `<div class="s-callout">${ico('info')}<p>ჯერ პოსტი არ ჩაწერილა. პოსტები აქ ჩნდება, როცა ოპერატორი მათ Metricool-ში დაგეგმავს და ჩაწერს.</p></div>` : ''}
      ${body}
    </div>`;

    root.querySelectorAll('[data-view]').forEach((btn) => btn.addEventListener('click', () => {
      st.view = btn.dataset.view;
      try { sessionStorage.setItem(VIEW_KEY, st.view); } catch { /* private mode */ }
      paint(root);
    }));
    const setBrand = (brand) => {
      st.brand = BRANDS[brand] ? brand : 'all';
      try { sessionStorage.setItem(BRAND_KEY, st.brand); } catch { /* private mode */ }
      paint(root);
    };
    root.querySelectorAll('[data-brand]').forEach((btn) => btn.addEventListener('click', () => setBrand(btn.dataset.brand)));
    root.querySelector('[data-brand-toggle]')?.addEventListener('click', () => setBrand(st.brand === 'medirun' ? 'all' : 'medirun'));
    root.querySelectorAll('[data-network]').forEach((btn) => btn.addEventListener('click', () => { st.network = btn.dataset.network; paint(root); }));
    root.querySelectorAll('[data-status]').forEach((btn) => btn.addEventListener('click', () => { st.status = btn.dataset.status; paint(root); }));
    root.querySelector('[data-show-failed]')?.addEventListener('click', () => {
      st.status = 'FAILED';
      st.network = 'all';
      st.brand = 'all';
      st.view = 'list';
      try { sessionStorage.setItem(VIEW_KEY, st.view); sessionStorage.setItem(BRAND_KEY, st.brand); } catch { /* private mode */ }
      paint(root);
    });
    root.querySelectorAll('[data-month]').forEach((btn) => btn.addEventListener('click', () => {
      const delta = Number(btn.dataset.month);
      st.month = delta ? shiftMonth(st.month, delta) : tp(new Date()).month;
      paint(root);
    }));
    root.querySelector('[data-refresh]')?.addEventListener('click', () => void renderSocialAdmin());
    root.querySelectorAll('[data-post]').forEach((el) => {
      const open = () => void openPost(el.dataset.post);
      el.addEventListener('click', open);
      if (el.tagName === 'TR') el.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } });
    });
  }

  /* ─────────────── Drawer: one post ─────────────── */
  function media(urls) {
    if (!urls?.length) return '<p class="p1-drawer-none">მედია არ არის მიბმული.</p>';
    return `<div class="s-social-media">${urls.map(mediaUrl).map((url) => (isVideo(url)
      ? `<video src="${esc(url)}" controls preload="metadata" playsinline></video>`
      : `<a href="${esc(url)}" target="_blank" rel="noopener noreferrer" title="სრული ზომით გახსნა"><img src="${esc(url)}" alt="" loading="lazy" decoding="async"></a>`)).join('')}</div>`;
  }
  const fact = (label, value) => `<div><dt>${esc(label)}</dt><dd>${value}</dd></div>`;
  const hasGeorgian = (text) => /[Ⴀ-ჿᲐ-Ჿ]/.test(text || '');

  async function openPost(id) {
    if (!id || typeof global.openDrawer !== 'function') return;
    let d;
    try {
      d = await global.api(`/social/${encodeURIComponent(id)}`);
    } catch (err) {
      global.toast?.(say(err, 'პოსტი ვერ ჩაიტვირთა. სცადე ხელახლა.'), 'bad');
      return;
    }
    const p = d.post;
    const c = campaignOf(p.campaign);
    const events = d.events || [];
    const safeHref = /^https:\/\//i.test(p.externalUrl || '') ? p.externalUrl : null;
    global.openDrawer(`<div class="s-stack s-social-drawer">
      <header class="p1-drawer-head">
        <div>
          <p class="p1-drawer-kicker">${esc(c.label)}</p>
          <h3>${esc(p.title)}</h3>
          <div class="s-chips">${statusBadge(p.status)} ${kindBadge(p.kind)} ${p.pillar ? `<span class="s-badge is-accent">${esc(pillarLabel(p.pillar))}</span>` : ''} ${nets(p.networks)}</div>
        </div>
        <button type="button" class="btn ghost icon-only" id="drawer-cancel" aria-label="დახურვა" title="დახურვა">${ico('x')}</button>
      </header>
      <dl class="s-social-facts">
        ${fact('დაგეგმილი დრო', esc(when(p.scheduledAt)))}
        ${fact('გამოქვეყნდა', esc(when(p.publishedAt)))}
        ${fact('ბოლო სინქრონიზაცია', esc(when(p.lastSyncedAt)))}
        ${fact('ქსელები', esc(netNames(p.networks) || '—'))}
        ${fact('Metricool-ის ნომერი', p.metricoolId ? copyChip(p.metricoolId) : '—')}
        ${fact('გეგმის კოდი', copyChip(p.slot))}
        ${c.unknown ? fact('კამპანიის კოდი', copyChip(p.campaign)) : ''}
      </dl>
      ${safeHref ? `<a class="btn ghost compact p1-drawer-link" href="${esc(safeHref)}" target="_blank" rel="noopener noreferrer">${ico('external')} ქსელში გახსნა</a>` : ''}
      <section><h4 class="s-social-h">მედია (${num((p.mediaUrls || []).length)})</h4>${media(p.mediaUrls)}</section>
      <section><h4 class="s-social-h">ტექსტი · ${esc(netNames(p.networks) || '—')}</h4><div class="s-social-caption" lang="${hasGeorgian(p.text) ? 'ka' : 'en'}">${esc(p.text)}</div></section>
      ${p.textEn ? `<section><h4 class="s-social-h">ინგლისური ვერსია</h4><div class="s-social-caption" lang="en">${esc(p.textEn)}</div></section>` : ''}
      ${p.notes ? `<section><h4 class="s-social-h">შენიშვნა</h4><div class="s-social-caption">${esc(p.notes)}</div></section>` : ''}
      <section><h4 class="s-social-h">ისტორია (${num(events.length)})</h4>
        <ol class="s-social-timeline">${events.map((e) => {
          const [label, tone] = EVENT[e.type] || [e.type, ''];
          return `<li><span class="s-badge ${tone}">${esc(label)}</span><time>${esc(when(e.at))}</time>${e.detail ? `<p>${esc(humanDetail(e.detail))}</p>` : ''}</li>`;
        }).join('') || '<li class="s-muted">ჩანაწერი არ არის.</li>'}</ol>
      </section>
      <p class="p1-drawer-foot">ჩაიწერა ${esc(when(p.createdAt))} · განახლდა ${esc(when(p.updatedAt))}</p>
    </div>`, { wide: true });
    $('drawer-cancel')?.addEventListener('click', () => global.closeDrawer?.());
  }

  /* ─────────────── Load ─────────────── */
  async function renderSocialAdmin() {
    const root = $('tab-social');
    if (!root) return;
    if (!st.data) root.innerHTML = skel();
    let summary; let list; let events;
    try {
      [, summary, list, events] = await Promise.all([
        global.AdminCampaignMedia?.ensure?.().catch(() => null),
        global.api('/social/summary'),
        global.api('/social'),
        global.api('/social/events?limit=300'),
      ]);
    } catch (err) {
      root.innerHTML = `<div class="s-card"><div class="s-empty">${ico('alert')}<strong>პოსტები ვერ ჩაიტვირთა</strong><span>${esc(say(err, 'სერვერმა პასუხი ვერ დააბრუნა. სცადე ხელახლა.'))}</span><button type="button" class="btn" data-retry>ხელახლა ცდა</button></div></div>`;
      root.querySelector('[data-retry]').onclick = () => renderSocialAdmin();
      return;
    }
    st.data = {
      installed: summary.installed !== false && list.installed !== false,
      summary,
      posts: list.posts || [],
      events: events.events || [],
    };
    spans.clear();
    (summary.campaigns || []).forEach((x) => {
      const from = x.firstAt && tp(x.firstAt);
      const to = x.lastAt && tp(x.lastAt);
      if (from && to) spans.set(x.campaign, { from: shortDay(from.key), to: shortDay(to.key) });
    });
    if (!st.month) st.month = defaultMonth(st.data);
    paint(root);
  }

  global.renderSocialAdmin = renderSocialAdmin;
  global.AdminV4Social = { renderSocialAdmin, openPost };
})(window);
