/**
 * MediCard Admin V4 — #/influencers ინფლუენსერები (/api/admin/influencers).
 * The influencer program behind medicard.ge/promo: who signed up (socials, photo, status, codes, numbers), one
 * influencer in full (registrations with masked accounts — never health data —, quality signals, payouts, the money
 * ledger, notes, balance correction), the payout queue (approve → paid with a reference / reject with a reason, money
 * comes back), registrations held for review (burst from one network), and the program settings (tier ladder, hold,
 * entry window, minimum payout, burst threshold, coins for the new user, sign-up switch).
 * Tabs: ინფლუენსერები · გატანები · შემოწმება · პარამეტრები (tab= in the hash; focus=<influencerId> opens one).
 */
(function adminV4Influencers(global) {
  const doc = document;
  const $ = (id) => doc.getElementById(id);
  const V = () => global.AdminV3 || {};
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const ico = (n) => (typeof global.icon === 'function' ? global.icon(n) : '');
  const fmt = (n) => (Number.isFinite(Number(n)) ? Number(n).toLocaleString('ka-GE') : '—');
  const gel = (tetri) => `${(Math.round(Number(tetri) || 0) / 100).toFixed(2)} ₾`;
  const when = (iso, mode = 'datetime') => (!iso ? '—' : V().formatDate ? V().formatDate(iso, mode) : String(iso));
  const api = (path, opts) => global.api(`/influencers${path}`, opts);
  const toast = (m, t) => global.toast?.(m, t);
  const say = (err, fallback) => (/[ა-ჿ]/.test(err?.message || '') ? err.message : fallback);
  const pct = (a, b) => (b ? `${Math.round((a / b) * 100)}%` : '—');

  const TABS = [['list', 'ინფლუენსერები'], ['payouts', 'გატანები'], ['flagged', 'შემოწმება'], ['settings', 'პარამეტრები']];
  const ACCOUNT = { PENDING: ['განხილვაში', 'is-warn'], ACTIVE: ['აქტიური', 'is-ok'], SUSPENDED: ['შეჩერებული', 'is-bad'], BLOCKED: ['დაბლოკილი', 'is-bad'] };
  const TIER = { SPARK: 'ნაპერწკალი', STAR: 'ვარსკვლავი', SUPERNOVA: 'სუპერნოვა', GALAXY: 'გალაქტიკა', COSMOS: 'კოსმოსი' };
  const REF = { PENDING: ['მოლოდინში', 'is-plain'], FLAGGED: ['შემოწმებაზე', 'is-warn'], CREDITED: ['ჩაითვალა', 'is-ok'], REVERSED: ['გაუქმდა', 'is-bad'], REJECTED: ['არ ჩაითვალა', 'is-bad'] };
  const REASON = {
    ACCOUNT_DELETED: 'ანგარიში წაიშალა მოლოდინის დროს', ACCOUNT_BLOCKED: 'ანგარიში დაიბლოკა', NO_PHONE: 'ტელეფონი დაუდასტურებელია',
    AGE: '18 წლამდეა', AGE_UNKNOWN: 'დაბადების თარიღი უცნობია', INFLUENCER_BLOCKED: 'ინფლუენსერი დაიბლოკა', ADMIN: 'ადმინის გადაწყვეტილება',
  };
  const PAYOUT = { REQUESTED: ['ახალი', 'is-warn'], APPROVED: ['დამტკიცებული', 'is-info'], PAID: ['ჩარიცხული', 'is-ok'], REJECTED: ['უარყოფილი', 'is-bad'] };
  const PAYEE = { PERSON: 'ფიზიკური პირი', ENTREPRENEUR: 'ინდ. მეწარმე', COMPANY: 'კომპანია (შპს)' };
  const LEDGER = { CREDIT: 'რეგისტრაცია ჩაითვალა', REVERSAL: 'რეგისტრაცია გაუქმდა', PAYOUT: 'გატანის მოთხოვნა', RELEASE: 'უარყოფილი გატანა დაბრუნდა', ADJUST: 'კორექტირება' };
  const SOCIAL = { instagram: ['Instagram', (v) => `https://instagram.com/${v}`], tiktok: ['TikTok', (v) => `https://www.tiktok.com/@${v}`], facebook: ['Facebook', (v) => `https://facebook.com/${v}`], youtube: ['YouTube', (v) => `https://youtube.com/${v.startsWith('@') || v.includes('/') ? v : `@${v}`}`], other: ['ბმული', (v) => v] };

  const st = { tab: 'list', status: 'ALL', q: '', payoutStatus: 'OPEN', data: null, payouts: null, flagged: null, config: null };
  const badge = (map, key) => `<span class="s-badge ${(map[key] || ['', ''])[1]}">${esc((map[key] || [key])[0])}</span>`;
  const tierBadge = (tier) => `<span class="s-inf-tier is-${esc(String(tier?.key || 'SPARK').toLowerCase())}">${esc(TIER[tier?.key] || tier?.ka || '—')}</span>`;
  const metric = (label, value, sub, tone = '') => `<div class="s-metric ${tone}"><span>${esc(label)}</span><strong>${value}</strong><small>${sub || ''}</small></div>`;
  const emptyCard = (title, text) => `<div class="s-card"><div class="s-empty">${ico('check')}<strong>${esc(title)}</strong>${text ? `<span>${esc(text)}</span>` : ''}</div></div>`;
  const segment = (label, items, current, attr) => `<div class="s-segment" role="tablist" aria-label="${esc(label)}">${items.map(([key, text, count]) => `<button type="button" role="tab" aria-selected="${key === current}" ${attr}="${esc(key)}">${esc(text)}${count ? ` <i${key === 'PENDING' || key === 'OPEN' ? ' class="is-hot"' : ''}>${fmt(count)}</i>` : ''}</button>`).join('')}</div>`;
  const skel = () => `<div class="s-stack" aria-busy="true"><div class="s-metrics">${'<div class="s-metric p1-skel-kpi"><i></i><i></i><i></i></div>'.repeat(4)}</div><section class="s-card"><div class="p1-skel-rows">${'<i></i>'.repeat(6)}</div></section></div>`;
  const socials = (s) => Object.entries(SOCIAL).filter(([k]) => s?.[k]).map(([k, [label, url]]) => `<a class="s-inf-social" href="${esc(url(s[k]))}" target="_blank" rel="noopener noreferrer">${esc(label)} <span>${esc(k === 'other' ? s[k].replace(/^https?:\/\//, '') : s[k])}</span></a>`).join('');
  const initials = (name) => String(name || '?').trim().split(/\s+/).slice(0, 2).map((w) => [...w][0] || '').join('').toUpperCase() || '?';

  /* Photos are private: fetched with the admin token, kept as blob URLs for this session. */
  const photos = new Map();
  function photoHtml(inf, size = 40) {
    const ready = photos.get(inf.id);
    const img = inf.hasPhoto ? `<img alt="" data-inf-photo="${esc(inf.id)}" ${typeof ready === 'string' ? `src="${ready}"` : 'hidden'}>` : '';
    return `<span class="s-inf-ava" style="width:${size}px;height:${size}px"><b>${esc(initials(inf.displayName || inf.fullName))}</b>${img}</span>`;
  }
  function hydratePhotos(root) {
    const token = typeof state === 'object' && state ? state.token : null;
    root.querySelectorAll('img[data-inf-photo]:not([src])').forEach((img) => {
      const id = img.dataset.infPhoto;
      let pending = photos.get(id);
      if (!pending) {
        pending = fetch(`/api/admin/influencers/${encodeURIComponent(id)}/photo`, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
          .then((r) => (r.ok ? r.blob() : null)).then((b) => (b?.size ? URL.createObjectURL(b) : '')).catch(() => '');
        photos.set(id, pending);
      }
      Promise.resolve(pending).then((url) => {
        if (url) photos.set(id, url); else photos.delete(id);
        if (url && img.isConnected) { img.src = url; img.hidden = false; }
      });
    });
  }

  function writeHash(extra = {}) {
    global.AdminV3Shell?.writeModuleHash?.('influencers', { tab: st.tab === 'list' ? null : st.tab, status: st.tab === 'list' && st.status !== 'ALL' ? st.status : null, ...extra });
  }

  /* ═════════════ ინფლუენსერები ═════════════ */
  async function renderList(host) {
    if (!st.data) host.innerHTML = skel();
    let data;
    try {
      data = await api(`/?status=${encodeURIComponent(st.status)}${st.q ? `&q=${encodeURIComponent(st.q)}` : ''}`);
    } catch (err) {
      host.innerHTML = `<div class="s-card"><div class="s-empty">${ico('alert')}<strong>სია ვერ ჩაიტვირთა</strong><span>${esc(say(err, 'სერვერმა პასუხი ვერ დააბრუნა.'))}</span></div></div>`;
      return;
    }
    st.data = data;
    const t = data.totals;
    const by = t.byStatus || {};
    const rows = data.influencers;
    host.innerHTML = `<div class="s-stack s-inf">
      ${t.byStatus?.PENDING ? `<div class="s-callout is-warn">${ico('info')}<p><b>${fmt(by.PENDING)} ინფლუენსერი ელოდება დადასტურებას.</b> მანამდე მათი კოდი მუშაობს და რეგისტრაციები ითვლება, მაგრამ თანხის გატანა დაკეტილია. დადასტურებამდე გახსენი Instagram და TikTok: რეალური პროფილია, აქვს თუ არა აუდიტორია, ემთხვევა თუ არა ფოტო.</p></div>` : ''}
      <div class="s-metrics">
        ${metric('ინფლუენსერი', fmt(t.influencers), `${fmt(by.ACTIVE || 0)} აქტიური · ${fmt(by.PENDING || 0)} განხილვაში`)}
        ${metric('რეგისტრაცია ამ თვეში', fmt(t.registrations.month), `${fmt(t.registrations.pending)} მოლოდინში · ${fmt(t.registrations.flagged)} შემოწმებაზე`, t.registrations.flagged ? 'warn' : '')}
        ${metric('ჩათვლილი სულ', fmt(t.registrations.credited), `${gel(t.earned)} დარიცხული · ${fmt(t.registrations.notCounted)} არ ჩაითვალა`)}
        ${metric('გადასახდელი', gel(t.owed), `${gel(t.paid)} უკვე ჩარიცხული${t.payoutsOpen.count ? ` · ${fmt(t.payoutsOpen.count)} მოთხოვნა რიგში` : ''}`, t.payoutsOpen.count ? 'warn' : '')}
      </div>
      <div class="s-toolbar">
        ${segment('სტატუსი', [['ALL', 'ყველა'], ['PENDING', 'განხილვაში', by.PENDING], ['ACTIVE', 'აქტიური'], ['SUSPENDED', 'შეჩერებული'], ['BLOCKED', 'დაბლოკილი']], st.status, 'data-inf-status')}
        <span class="spacer"></span>
        <label class="sx-search">${ico('search')}<span class="sr-only">ძებნა</span><input type="search" placeholder="სახელი, კოდი, ელფოსტა, Instagram…" value="${esc(st.q)}" data-inf-q autocomplete="off"></label>
      </div>
      ${rows.length ? `<div class="s-card"><div class="s-card-body is-flush"><table class="s-table s-inf-table"><thead><tr>
          <th>ინფლუენსერი</th><th>სოციალური ქსელები</th><th>კოდი</th><th>ანგარიში</th><th>სტატუსი</th>
          <th class="num">ჩაითვალა</th><th class="num">მოლოდინში</th><th class="num">დაბრუნდა</th><th class="num">ბალანსი</th><th></th></tr></thead><tbody>
        ${rows.map((r) => `<tr data-inf-row="${esc(r.id)}" data-focus="${esc(r.id)}">
          <td><div class="s-inf-who">${photoHtml(r)}<div><b class="s-link" data-inf-open>${esc(r.displayName)}</b><small>${esc(r.fullName)}</small><small>${esc(when(r.createdAt, 'date'))}-დან</small></div></div></td>
          <td><div class="s-inf-socials">${socials(r.socials) || '<span class="s-muted">—</span>'}</div></td>
          <td><code class="s-inf-code">${esc(r.code || '—')}</code></td>
          <td>${badge(ACCOUNT, r.status)}</td>
          <td>${tierBadge(r.tier)}</td>
          <td class="num">${fmt(r.counts.credited)}</td>
          <td class="num">${fmt(r.counts.pending)}${r.counts.flagged ? ` <span class="s-badge is-warn" title="შემოწმებაზე">${fmt(r.counts.flagged)}</span>` : ''}</td>
          <td class="num" title="მოყვანილთაგან რამდენი შემოვიდა აპში რეგისტრაციის შემდეგ სხვა დღეს">${r.counts.total ? pct(r.counts.returned, r.counts.total) : '—'}</td>
          <td class="num"><b>${gel(r.available)}</b>${r.earned ? `<br><small class="s-muted">სულ ${gel(r.earned)}</small>` : ''}</td>
          <td class="num"><button type="button" class="btn ghost compact" data-inf-open title="დეტალები">${ico('info')}</button></td>
        </tr>`).join('')}
      </tbody></table></div></div>` : emptyCard(st.q || st.status !== 'ALL' ? 'ვერაფერი მოიძებნა' : 'ინფლუენსერი ჯერ არ არის', st.q || st.status !== 'ALL' ? 'სცადე სხვა სიტყვა ან სტატუსი.' : 'რეგისტრაცია medicard.ge/promo-ზეა — პირველი განაცხადი აქ გამოჩნდება.')}
    </div>`;
    hydratePhotos(host);
    host.querySelectorAll('[data-inf-status]').forEach((b) => { b.onclick = () => { st.status = b.dataset.infStatus; writeHash(); void renderList(host); }; });
    let timer = null;
    const q = host.querySelector('[data-inf-q]');
    q.oninput = () => { clearTimeout(timer); timer = setTimeout(() => { st.q = q.value.trim(); void renderList(host).then(() => host.querySelector('[data-inf-q]')?.focus()); }, 320); };
    host.querySelectorAll('[data-inf-row]').forEach((row) => row.querySelectorAll('[data-inf-open]').forEach((b) => { b.onclick = () => openInfluencer(row.dataset.infRow); }));
  }

  /* One influencer, in full. */
  async function openInfluencer(id) {
    let d;
    try { d = await api(`/${encodeURIComponent(id)}`); } catch (err) { toast(say(err, 'ვერ ჩაიტვირთა'), 'error'); return; }
    const inf = d.influencer;
    const q = d.quality;
    const statusActions = {
      PENDING: [['ACTIVE', 'დადასტურება', 'primary'], ['BLOCKED', 'დაბლოკვა', 'danger']],
      ACTIVE: [['SUSPENDED', 'შეჩერება', ''], ['BLOCKED', 'დაბლოკვა', 'danger']],
      SUSPENDED: [['ACTIVE', 'აღდგენა', 'primary'], ['BLOCKED', 'დაბლოკვა', 'danger']],
      BLOCKED: [['ACTIVE', 'განბლოკვა და გააქტიურება', '']],
    }[inf.status] || [];
    const refRows = d.referrals.map((r) => `<tr>
        <td>${r.userId ? `<a href="#/users/${esc(r.userId)}">${esc(r.userRef)}</a>` : `<span class="s-muted">${esc(r.userRef)} · წაშლილი</span>`}${r.phone ? `<br><small class="s-muted">${esc(r.phone)}</small>` : ''}</td>
        <td><small>${esc(when(r.userCreatedAt))}</small></td>
        <td><small>${esc(when(r.createdAt))}</small><br><code class="s-inf-code is-small">${esc(r.code)}</code></td>
        <td>${badge(REF, r.status)}${r.reason ? `<br><small class="s-muted">${esc(REASON[r.reason] || r.reason)}</small>` : ''}${(r.flags || []).some((f) => f.kind === 'NETWORK_BURST') ? '<br><small class="s-muted">ერთი ქსელიდან ბევრი</small>' : ''}${r.status === 'PENDING' ? `<br><small class="s-muted">ჩაითვლება ${esc(when(r.holdUntil, 'date'))}</small>` : ''}</td>
        <td>${r.returned ? '<span class="s-badge is-ok">დაბრუნდა</span>' : '<span class="s-muted">არა</span>'}</td>
        <td class="num">${r.amount != null ? `${gel(r.amount)}${r.seq ? `<br><small class="s-muted">#${fmt(r.seq)}</small>` : ''}` : '—'}</td>
        <td class="num">${r.status === 'FLAGGED' ? `<button type="button" class="btn compact" data-ref-act="approve" data-ref="${esc(r.id)}">ჩათვლა</button> <button type="button" class="btn ghost compact" data-ref-act="reject" data-ref="${esc(r.id)}">უარი</button>` : r.status === 'PENDING' ? `<button type="button" class="btn ghost compact" data-ref-act="reject" data-ref="${esc(r.id)}">უარი</button>` : r.status === 'CREDITED' ? `<button type="button" class="btn ghost compact" data-ref-act="reverse" data-ref="${esc(r.id)}">გაუქმება</button>` : ''}</td>
      </tr>`).join('');
    const payRows = d.payouts.map((p) => `<tr><td><small>${esc(when(p.requestedAt))}</small></td><td>${badge(PAYOUT, p.status)}${p.reference ? `<br><small class="s-muted">${esc(p.reference)}</small>` : ''}${p.rejectReason ? `<br><small class="s-muted">${esc(p.rejectReason)}</small>` : ''}</td><td><small>${esc(p.account?.iban || '—')}</small></td><td class="num"><b>${gel(p.amount)}</b></td></tr>`).join('');
    const ledRows = d.ledger.map((l) => `<tr><td><small>${esc(when(l.createdAt))}</small></td><td>${esc(LEDGER[l.kind] || l.kind)}${l.note ? `<br><small class="s-muted">${esc(l.note)}</small>` : ''}${l.adminEmail ? `<br><small class="s-muted">${esc(l.adminEmail)}</small>` : ''}</td><td class="num ${l.amount < 0 ? 's-bad' : ''}">${l.amount > 0 ? '+' : ''}${gel(l.amount)}</td></tr>`).join('');
    const chart = global.AdminCharts?.bars ? global.AdminCharts.bars(d.series.map((x) => ({ day: x.day, count: x.n })), { label: 'რეგისტრაციები დღეში', height: 170, tone: 'amber', empty: 'ბოლო 60 დღეში რეგისტრაცია არ ყოფილა' }) : '';
    const dialog = V().openDialog?.({
      title: inf.displayName,
      wide: true,
      watchDirty: false,
      description: `${inf.fullName} · რეგისტრირდა ${when(inf.createdAt, 'date')}${inf.approvedAt ? ` · დადასტურდა ${when(inf.approvedAt, 'date')}` : ''}`,
      body: `<div id="inf-detail" class="s-stack s-inf-detail">
        <section class="s-inf-hero">
          ${photoHtml(inf, 96)}
          <div class="s-inf-hero-main">
            <div class="s-inf-hero-badges">${badge(ACCOUNT, inf.status)} ${tierBadge(d.tier)} ${d.codes.map((c) => `<code class="s-inf-code${c.primary ? ' is-primary' : ''}" title="${c.primary ? 'მთავარი კოდი' : 'ძველი კოდი — ისიც მუშაობს'}">${esc(c.code)}</code>`).join(' ')}</div>
            <dl class="p3-facts s-inf-facts">
              <div><dt>ელფოსტა</dt><dd><a href="mailto:${esc(inf.email)}">${esc(inf.email)}</a></dd></div>
              <div><dt>ტელეფონი</dt><dd>${esc(inf.phone)}</dd></div>
              <div><dt>ბოლოს შევიდა</dt><dd>${esc(when(inf.lastLoginAt))}</dd></div>
              <div><dt>წესები</dt><dd>${inf.termsAcceptedAt ? `დაეთანხმა ${esc(when(inf.termsAcceptedAt, 'date'))}` : '—'}</dd></div>
            </dl>
            <div class="s-inf-socials">${socials(inf.socials)}</div>
            ${inf.statusReason ? `<p class="s-muted">მიზეზი: ${esc(inf.statusReason)}</p>` : ''}
          </div>
        </section>
        <div class="s-metrics">
          ${metric('ჩაითვალა', fmt(d.counts.credited), `თითო ახლა ${gel(d.tier.rate)}${d.tier.next ? ` · ${esc(TIER[d.tier.next.key] || '')}-მდე ${fmt(d.tier.next.remaining)}` : ''}`)}
          ${metric('მოლოდინში', fmt(d.counts.pending + d.counts.flagged), `≈ ${gel(d.pendingAmount)}${d.counts.flagged ? ` · ${fmt(d.counts.flagged)} შემოწმებაზე` : ''}`, d.counts.flagged ? 'warn' : '')}
          ${metric('ბალანსი', gel(d.balance.available), `დარიცხული ${gel(d.balance.earned)} · ჩარიცხული ${gel(d.balance.paid)}`)}
          ${metric('ხარისხი', q.considered ? pct(q.returned, q.considered) : '—', q.considered ? `დაბრუნდა ${fmt(q.returned)} / ${fmt(q.considered)} · 10 წთ-ში შეიყვანა ${fmt(q.quickEntries)}${q.networks ? ` · ერთ ქსელზე მაქს. ${fmt(q.topNetworkShare)}` : ''}` : 'ჯერ რეგისტრაცია არ არის')}
        </div>
        ${chart}
        <section class="s-card"><header class="s-card-head"><div><h3>რეგისტრაციები</h3><p>ანგარიში ნიღბით და ტელეფონის ბოლო ციფრებით — სახელი და ჯანმრთელობის მონაცემები აქ არ ჩანს. „დაბრუნდა“ — აპში სხვა დღესაც შემოვიდა.</p></div></header>
          <div class="s-card-body is-flush">${refRows ? `<table class="s-table"><thead><tr><th>ანგარიში</th><th>რეგისტრაცია</th><th>კოდი შეიყვანა</th><th>სტატუსი</th><th>დაბრუნდა</th><th class="num">თანხა</th><th></th></tr></thead><tbody>${refRows}</tbody></table>` : '<p class="s-inf-pad s-muted">ჯერ არავის შეუყვანია კოდი.</p>'}</div></section>
        <div class="s-inf-split">
          <section class="s-card"><header class="s-card-head"><div><h3>გატანები</h3></div></header><div class="s-card-body is-flush">${payRows ? `<table class="s-table"><tbody>${payRows}</tbody></table>` : '<p class="s-inf-pad s-muted">გატანა არ მოუთხოვია.</p>'}</div></section>
          <section class="s-card"><header class="s-card-head"><div><h3>თანხის მოძრაობა</h3><p>ბალანსი = ამ ჩანაწერების ჯამი.</p></div><div class="s-card-actions"><button type="button" class="btn compact" data-inf-adjust>${ico('plus')} კორექტირება</button></div></header><div class="s-card-body is-flush">${ledRows ? `<table class="s-table"><tbody>${ledRows}</tbody></table>` : '<p class="s-inf-pad s-muted">მოძრაობა ჯერ არ არის.</p>'}</div></section>
        </div>
        <section class="s-card"><header class="s-card-head"><div><h3>შენიშვნა გუნდისთვის</h3><p>ინფლუენსერი ამას ვერ ხედავს.</p></div></header>
          <div class="s-card-body"><textarea class="s-inf-note" rows="3" maxlength="2000" data-inf-note placeholder="მაგ. შეთანხმება, აუდიტორია, კონტაქტი…">${esc(inf.adminNote || '')}</textarea>
          <div class="s-inf-note-foot"><button type="button" class="btn compact" data-inf-note-save>შენახვა</button></div></div></section>
      </div>`,
      footer: `<button type="button" class="btn" data-cancel>დახურვა</button>${statusActions.map(([status, label, tone]) => `<button type="button" class="btn ${tone}" data-inf-status-set="${status}">${esc(label)}</button>`).join('')}`,
    });
    const panel = $('inf-detail')?.closest('.v3-dialog-panel');
    if (!panel) return;
    panel.classList.add('s-inf-dialog');
    // openDialog focuses the first field (the note at the bottom); start at the top instead.
    setTimeout(() => { panel.querySelector('[data-cancel]')?.focus({ preventScroll: true }); panel.querySelector('.v3-overlay-body')?.scrollTo?.(0, 0); }, 60);
    hydratePhotos(panel);
    panel.querySelector('[data-cancel]').onclick = () => void dialog.close();
    panel.querySelectorAll('[data-inf-status-set]').forEach((b) => { b.onclick = async () => { await dialog.close(); setStatus(inf, b.dataset.infStatusSet); }; });
    panel.querySelector('[data-inf-adjust]').onclick = async () => { await dialog.close(); adjust(inf); };
    panel.querySelector('[data-inf-note-save]').onclick = async (e) => {
      const btn = e.currentTarget;
      btn.disabled = true;
      try {
        await api(`/${encodeURIComponent(inf.id)}/note`, { method: 'PATCH', body: { note: panel.querySelector('[data-inf-note]').value } });
        toast('შენიშვნა შენახულია', 'ok');
      } catch (err) { toast(say(err, 'ვერ შეინახა'), 'error'); }
      btn.disabled = false;
    };
    panel.querySelectorAll('[data-ref-act]').forEach((b) => { b.onclick = async () => { await dialog.close(); decideReferral(b.dataset.ref, b.dataset.refAct, inf.id); }; });
  }

  function formDialog({ title, description, fields, submitLabel, danger = false, onSubmit }) {
    const dialog = V().openDialog?.({
      title,
      description,
      body: `<form id="inf-form" class="s-stack" novalidate>${fields}</form>`,
      footer: `<p class="s-form-msg" role="alert"></p><button type="button" class="btn" data-cancel>გაუქმება</button><button type="submit" class="btn ${danger ? 'danger' : 'primary'}" form="inf-form">${esc(submitLabel)}</button>`,
    });
    const form = $('inf-form');
    const panel = form?.closest('.v3-dialog-panel');
    if (!form || !panel) return;
    if (danger) panel.classList.add('is-danger');
    panel.querySelector('[data-cancel]').onclick = () => void dialog.close();
    form.onsubmit = async (ev) => {
      ev.preventDefault();
      const alertEl = panel.querySelector('[role=alert]');
      const submit = panel.querySelector('[type=submit]');
      submit.disabled = true;
      submit.classList.add('is-loading');
      try {
        const done = await onSubmit(Object.fromEntries(new FormData(form).entries()), alertEl);
        if (done === false) { submit.disabled = false; submit.classList.remove('is-loading'); return; }
        V().setDirty?.(false);
        await dialog.close();
      } catch (err) {
        alertEl.textContent = say(err, 'შეცდომა — სცადე ხელახლა.');
        submit.disabled = false;
        submit.classList.remove('is-loading');
      }
    };
  }

  function setStatus(inf, status) {
    const copy = {
      ACTIVE: ['დადასტურება', 'კოდი გააგრძელებს მუშაობას და გატანა გაიხსნება. ინფლუენსერს ელფოსტით შევატყობინებთ.', false],
      SUSPENDED: ['შეჩერება', 'კოდი ახალ რეგისტრაციებს აღარ მიიღებს, მოლოდინში მყოფი რეგისტრაციები გაჩერდება, გატანა დაიკეტება. უკვე დათვლილი თანხა რჩება.', true],
      BLOCKED: ['დაბლოკვა', 'პორტალზე შესვლა დაიკეტება, კოდი აღარ იმუშავებს, მოლოდინში მყოფი რეგისტრაციები არ ჩაითვლება. გამოიყენე თაღლითობის დროს.', true],
    }[status];
    const needsReason = status !== 'ACTIVE';
    formDialog({
      title: `${copy[0]} · ${inf.displayName}`,
      description: copy[1],
      danger: copy[2],
      submitLabel: copy[0],
      fields: `<label class="s-field"><span>${needsReason ? 'მიზეზი (ინფლუენსერი ნახავს)' : 'შენიშვნა (არასავალდებულო)'}</span><textarea name="reason" rows="3" maxlength="500" ${needsReason ? 'required' : ''}></textarea></label>
        <label class="s-switch-row"><span><b>ელფოსტით შეტყობინება</b><small>ინფლუენსერს მიუვა წერილი სტატუსის შესახებ.</small></span><input type="checkbox" class="s-switch" name="notify" checked></label>`,
      onSubmit: async (data, alertEl) => {
        const reason = String(data.reason || '').trim();
        if (needsReason && reason.length < 3) { alertEl.textContent = 'მიზეზი სავალდებულოა.'; return false; }
        await api(`/${encodeURIComponent(inf.id)}/status`, { method: 'POST', body: { status, reason, notify: data.notify === 'on' } });
        toast(`${inf.displayName}: ${ACCOUNT[status][0]}`, 'ok');
        await refresh();
        return true;
      },
    });
  }

  function adjust(inf) {
    formDialog({
      title: `კორექტირება · ${inf.displayName}`,
      description: 'ბონუსი (+) ან შესწორება (−) ბალანსზე. ჩაიწერება თანხის მოძრაობაში შენი სახელით.',
      submitLabel: 'ჩაწერა',
      fields: `<label class="s-field"><span>თანხა ლარში (მაგ. 10 ან -2.50)</span><input name="amount" inputmode="decimal" required></label>
        <label class="s-field"><span>მიზეზი</span><input name="note" maxlength="300" required placeholder="მაგ. კამპანიის ბონუსი ოქტომბრისთვის"></label>`,
      onSubmit: async (data, alertEl) => {
        const amount = Math.round(Number(String(data.amount).replace(',', '.')) * 100);
        if (!Number.isFinite(amount) || amount === 0) { alertEl.textContent = 'ჩაწერე თანხა, მაგ. 10 ან -2.50.'; return false; }
        if (String(data.note || '').trim().length < 3) { alertEl.textContent = 'მიზეზი სავალდებულოა.'; return false; }
        await api(`/${encodeURIComponent(inf.id)}/adjust`, { method: 'POST', body: { amount, note: String(data.note).trim() } });
        toast(`ჩაიწერა ${gel(amount)}`, 'ok');
        await refresh();
        return true;
      },
    });
  }

  function decideReferral(refId, action, influencerId) {
    const copy = {
      approve: ['ჩათვლა', 'რეგისტრაცია მოლოდინს დაუბრუნდება და მოლოდინის ბოლოს ჩვეულებრივ ჩაითვლება.', false],
      reject: ['უარი', 'რეგისტრაცია არ ჩაითვლება და ინფლუენსერი მასზე თანხას არ მიიღებს.', true],
      reverse: ['გაუქმება', 'უკვე დათვლილი თანხა ბალანსიდან მოიხსნება (შეიძლება ბალანსი უარყოფითი გახდეს, თუ თანხა უკვე გატანილია).', true],
    }[action];
    formDialog({
      title: `${copy[0]} · რეგისტრაცია`,
      description: copy[1],
      danger: copy[2],
      submitLabel: copy[0],
      fields: '<label class="s-field"><span>შენიშვნა (არასავალდებულო)</span><input name="note" maxlength="300"></label>',
      onSubmit: async (data) => {
        await api(`/referrals/${encodeURIComponent(refId)}/decide`, { method: 'POST', body: { action, note: String(data.note || '').trim() } });
        toast('შენახულია', 'ok');
        await refresh();
        if (influencerId && st.tab === 'list') openInfluencer(influencerId);
        return true;
      },
    });
  }

  /* ═════════════ გატანები ═════════════ */
  async function renderPayouts(host) {
    host.innerHTML = skel();
    let data;
    try { data = await api(`/payouts?status=${encodeURIComponent(st.payoutStatus)}`); } catch (err) {
      host.innerHTML = `<div class="s-card"><div class="s-empty">${ico('alert')}<strong>გატანები ვერ ჩაიტვირთა</strong><span>${esc(say(err, 'სცადე ხელახლა.'))}</span></div></div>`;
      return;
    }
    st.payouts = data;
    const c = data.counts;
    const open = c.requested + c.approved;
    host.innerHTML = `<div class="s-stack s-inf">
      <div class="s-toolbar">${segment('სტატუსი', [['OPEN', 'დასამუშავებელი', open], ['PAID', 'ჩარიცხული'], ['REJECTED', 'უარყოფილი'], ['ALL', 'ყველა']], st.payoutStatus, 'data-pay-status')}<span class="spacer"></span><button type="button" class="btn ghost compact" data-refresh>${ico('refresh')} განახლება</button></div>
      ${st.payoutStatus === 'OPEN' && data.payouts.length ? `<div class="s-callout is-info">${ico('info')}<p><b>როგორ დავამუშაოთ:</b> შეამოწმე, რომ ანგარიშის მფლობელი ინფლუენსერის სახელს ემთხვევა (ან მის კომპანიას) და IBAN სწორია. „დამტკიცება“ — გადარიცხვა მზადდება; ბანკში გადარიცხვის შემდეგ „ჩარიცხულად მონიშვნა“ გადარიცხვის ნომრით. „უარყოფა“ თანხას ინფლუენსერის ბალანსზე აბრუნებს.</p></div>` : ''}
      ${data.payouts.length ? data.payouts.map(payoutCard).join('') : emptyCard(st.payoutStatus === 'OPEN' ? 'დასამუშავებელი მოთხოვნა არ არის' : 'ამ სტატუსით არაფერია', st.payoutStatus === 'OPEN' ? 'ახალი მოთხოვნა აქ გამოჩნდება და დირექტორი Telegram-ზე შეგატყობინებს.' : '')}
    </div>`;
    host.querySelectorAll('[data-pay-status]').forEach((b) => { b.onclick = () => { st.payoutStatus = b.dataset.payStatus; void renderPayouts(host); }; });
    host.querySelector('[data-refresh]').onclick = () => renderPayouts(host);
    host.querySelectorAll('[data-pay]').forEach((card) => {
      const p = data.payouts.find((x) => x.id === card.dataset.pay);
      card.querySelectorAll('[data-pay-act]').forEach((b) => { b.onclick = () => decidePayout(p, b.dataset.payAct); });
      card.querySelectorAll('[data-inf-copy]').forEach((b) => {
        b.onclick = () => navigator.clipboard?.writeText(b.dataset.infCopy).then(() => toast('დაკოპირდა', 'ok'), () => {});
      });
      card.querySelector('[data-inf-open]')?.addEventListener('click', () => openInfluencer(p.influencerId));
    });
  }

  function payoutCard(p) {
    const a = p.account || {};
    const copyBtn = (value) => (value && !String(value).includes('•') ? `<button type="button" class="btn ghost compact" data-inf-copy="${esc(value)}" title="კოპირება">${ico('copy')}</button>` : '');
    const actions = p.status === 'REQUESTED'
      ? '<button type="button" class="btn ghost" data-pay-act="reject">უარყოფა</button><button type="button" class="btn" data-pay-act="approve">დამტკიცება</button><button type="button" class="btn primary" data-pay-act="paid">ჩარიცხულად მონიშვნა</button>'
      : p.status === 'APPROVED'
        ? '<button type="button" class="btn ghost" data-pay-act="reject">უარყოფა</button><button type="button" class="btn primary" data-pay-act="paid">ჩარიცხულად მონიშვნა</button>'
        : `<span class="s-muted">${esc(PAYOUT[p.status]?.[0] || p.status)}${p.decidedBy ? ` · ${esc(p.decidedBy)}` : ''}${p.paidAt ? ` · ${esc(when(p.paidAt))}` : p.rejectedAt ? ` · ${esc(when(p.rejectedAt))}` : ''}</span>`;
    const holderMatch = a.holder && p.influencer?.fullName && a.holder.toLowerCase().replace(/\s+/g, ' ').trim() === p.influencer.fullName.toLowerCase().replace(/\s+/g, ' ').trim();
    return `<article class="s-card s-inf-payout" data-pay="${esc(p.id)}">
      <header class="s-card-head"><div><h3><span class="s-link" data-inf-open>${esc(p.influencer?.name || '—')}</span> · ${gel(p.amount)}</h3><p>მოითხოვა ${esc(when(p.requestedAt))}${p.influencer?.status && p.influencer.status !== 'ACTIVE' ? ` · ანგარიში: ${esc(ACCOUNT[p.influencer.status]?.[0] || '')}` : ''}</p></div><div class="s-card-actions">${badge(PAYOUT, p.status)}</div></header>
      <div class="s-card-body">
        <dl class="p3-facts s-inf-bank">
          <div><dt>ვის ერიცხება</dt><dd>${esc(PAYEE[a.payeeType] || '—')}</dd></div>
          <div><dt>მფლობელი</dt><dd>${esc(a.holder || '—')} ${copyBtn(a.holder)}${a.holder && p.influencer?.fullName && !holderMatch ? `<br><small class="s-claim-hint">${ico('info')} პროფილის სახელია „${esc(p.influencer.fullName)}“ — შეამოწმე</small>` : ''}</dd></div>
          <div><dt>IBAN</dt><dd><code>${esc(a.iban || '—')}</code> ${copyBtn(a.iban)}</dd></div>
          <div><dt>ბანკი</dt><dd>${esc(a.bank || '—')}</dd></div>
          <div><dt>${a.payeeType === 'COMPANY' ? 'საიდენტიფიკაციო კოდი' : 'პირადი ნომერი'}</dt><dd>${esc(a.idCode || '—')} ${copyBtn(a.idCode)}</dd></div>
          <div><dt>კონტაქტი</dt><dd>${esc(p.influencer?.email || '')}<br><small class="s-muted">${esc(p.influencer?.phone || '')}</small></dd></div>
        </dl>
        ${p.reference ? `<p class="s-muted">გადარიცხვის ნომერი: ${esc(p.reference)}</p>` : ''}${p.rejectReason ? `<p class="s-muted">უარის მიზეზი: ${esc(p.rejectReason)}</p>` : ''}
      </div>
      <footer class="s-claim-foot"><span class="spacer"></span>${actions}</footer>
    </article>`;
  }

  function decidePayout(p, action) {
    const copy = {
      approve: ['დამტკიცება', `${gel(p.amount)} გადასარიცხადაა მზად. ბანკში გადარიცხვის შემდეგ მონიშნე „ჩარიცხულად“.`, false, ''],
      paid: ['ჩარიცხულად მონიშვნა', `${gel(p.amount)} — ${p.account?.holder || ''}. ინფლუენსერს ელფოსტით შევატყობინებთ.`, false, '<label class="s-field"><span>გადარიცხვის ნომერი ან შენიშვნა</span><input name="reference" maxlength="120" placeholder="მაგ. TBC 0012345"></label>'],
      reject: ['უარყოფა', `${gel(p.amount)} დაბრუნდება ინფლუენსერის ბალანსზე და ახალს მოითხოვს.`, true, '<label class="s-field"><span>მიზეზი (ინფლუენსერი ნახავს)</span><textarea name="reason" rows="3" maxlength="500" required placeholder="მაგ. ანგარიშის მფლობელი არ ემთხვევა"></textarea></label>'],
    }[action];
    formDialog({
      title: `${copy[0]} · ${p.influencer?.name || ''}`,
      description: copy[1],
      danger: copy[2],
      submitLabel: copy[0],
      fields: copy[3] || '<p class="s-muted">დასტური?</p>',
      onSubmit: async (data, alertEl) => {
        if (action === 'reject' && String(data.reason || '').trim().length < 3) { alertEl.textContent = 'მიზეზი სავალდებულოა.'; return false; }
        await api(`/payouts/${encodeURIComponent(p.id)}/${action}`, { method: 'POST', body: { reference: String(data.reference || '').trim(), reason: String(data.reason || '').trim() } });
        toast(action === 'paid' ? 'მონიშნულია ჩარიცხულად' : action === 'approve' ? 'დამტკიცდა' : 'უარყოფილია — თანხა ბალანსზე დაბრუნდა', 'ok');
        await refresh();
        return true;
      },
    });
  }

  /* ═════════════ შემოწმება ═════════════ */
  async function renderFlagged(host) {
    host.innerHTML = skel();
    let data;
    try { data = await api('/flagged'); } catch (err) {
      host.innerHTML = `<div class="s-card"><div class="s-empty">${ico('alert')}<strong>ვერ ჩაიტვირთა</strong><span>${esc(say(err, 'სცადე ხელახლა.'))}</span></div></div>`;
      return;
    }
    st.flagged = data.referrals;
    const rows = data.referrals;
    host.innerHTML = `<div class="s-stack s-inf">
      <div class="s-callout">${ico('info')}<p><b>რატომ არის აქ:</b> ერთი ინფლუენსერის კოდით ერთი ქსელიდან (ერთი Wi-Fi / ერთი IP) 24 საათში ${fmt(st.config?.networkFlag || 3)} ან მეტი რეგისტრაცია შემოვიდა. ასეთი რეგისტრაცია თავისით არ ჩაითვლება. შეამოწმე: „დაბრუნდა“ — ადამიანი აპში სხვა დღესაც შემოვიდა (რეალური მომხმარებლის ნიშანი); ერთნაირი ქსელი შეიძლება იყოს ოჯახი, ოფისი ან ღონისძიება. „ჩათვლა“ მოლოდინს უბრუნებს, „უარი“ — არ ჩაითვლება.</p></div>
      ${rows.length ? `<div class="s-card"><div class="s-card-body is-flush"><table class="s-table"><thead><tr><th>ინფლუენსერი</th><th>ანგარიში</th><th>რეგისტრაცია</th><th>კოდი შეიყვანა</th><th>ქსელი</th><th>დაბრუნდა</th><th></th></tr></thead><tbody>
        ${rows.map((r) => `<tr data-flag="${esc(r.id)}">
          <td><b class="s-link" data-inf-open="${esc(r.influencerId)}">${esc(r.influencer)}</b><br><code class="s-inf-code is-small">${esc(r.code)}</code></td>
          <td>${r.userId ? `<a href="#/users/${esc(r.userId)}">${esc(r.userRef)}</a>` : esc(r.userRef)}${r.phone ? `<br><small class="s-muted">${esc(r.phone)}</small>` : ''}</td>
          <td><small>${esc(when(r.userCreatedAt))}</small></td>
          <td><small>${esc(when(r.createdAt))}</small></td>
          <td><span class="s-badge is-warn" title="ქსელის ნიღბიანი ნიშანი">#${esc(r.network || '—')}</span><br><small class="s-muted">ამ ქსელიდან სულ ${fmt(r.sameNetwork)}</small></td>
          <td>${r.returned ? '<span class="s-badge is-ok">დაბრუნდა</span>' : '<span class="s-muted">ჯერ არა</span>'}</td>
          <td class="num"><button type="button" class="btn compact" data-flag-act="approve">ჩათვლა</button> <button type="button" class="btn ghost compact" data-flag-act="reject">უარი</button></td>
        </tr>`).join('')}
      </tbody></table></div></div>` : emptyCard('შესამოწმებელი რეგისტრაცია არ არის', 'საეჭვო ნიშნით მონიშნული რეგისტრაცია აქ გამოჩნდება.')}
    </div>`;
    host.querySelectorAll('[data-flag]').forEach((row) => {
      row.querySelectorAll('[data-flag-act]').forEach((b) => { b.onclick = () => decideReferral(row.dataset.flag, b.dataset.flagAct); });
    });
    host.querySelectorAll('[data-inf-open]').forEach((b) => { b.onclick = () => openInfluencer(b.dataset.infOpen); });
  }

  /* ═════════════ პარამეტრები ═════════════ */
  async function renderSettings(host) {
    host.innerHTML = skel();
    let config;
    try { config = (await api('/settings')).config; } catch (err) {
      host.innerHTML = `<div class="s-card"><div class="s-empty">${ico('alert')}<strong>ვერ ჩაიტვირთა</strong><span>${esc(say(err, 'სცადე ხელახლა.'))}</span></div></div>`;
      return;
    }
    st.config = config;
    const names = Object.values(TIER);
    const tierRow = (t, i) => `<tr data-tier-row>
        <td><b>${esc(names[i] || `საფეხური ${i + 1}`)}</b></td>
        <td><input class="s-input" type="number" min="0" step="1" name="from" value="${esc(t.from)}" ${i === 0 ? 'readonly' : ''} aria-label="რამდენი რეგისტრაციის შემდეგ"></td>
        <td><input class="s-input" type="number" min="0.01" step="0.01" name="rate" value="${esc((t.rate / 100).toFixed(2))}" aria-label="ტარიფი ლარში"></td>
        <td class="num">${i > 0 ? '<button type="button" class="btn ghost compact" data-tier-del title="წაშლა">✕</button>' : ''}</td>
      </tr>`;
    host.innerHTML = `<form class="s-stack s-inf s-inf-settings" id="inf-settings" novalidate>
      <section class="s-card"><header class="s-card-head"><div><h3>ანაზღაურების საფეხურები</h3><p>თითო ჩათვლილ რეგისტრაციაზე. ტარიფი მოქმედებს ზღვრის შემდეგ მოსულ რეგისტრაციებზე (მაგ. 1–1 000 — 0.25 ₾, 1 001–5 000 — 0.28 ₾, შემდეგ 0.35 ₾). ცვლილება ეხება მომავალ ჩათვლებს; უკვე დათვლილი თანხა არ იცვლება. საფეხურის სახელი (სტატუსი) რიგის მიხედვით ენიჭება.</p></div></header>
        <div class="s-card-body"><table class="s-table s-inf-tiers"><thead><tr><th>სტატუსი</th><th>რამდენი რეგისტრაციის შემდეგ</th><th>ტარიფი, ₾</th><th></th></tr></thead><tbody>${config.tiers.map(tierRow).join('')}</tbody></table>
        ${config.tiers.length < names.length ? '<button type="button" class="btn compact" data-tier-add>+ საფეხურის დამატება</button>' : ''}</div></section>
      <section class="s-card"><header class="s-card-head"><div><h3>წესები</h3><p>თაღლითობისგან დაცვა და გატანა.</p></div></header>
        <div class="s-card-body s-inf-grid">
          <label class="s-field"><span>მოლოდინი ჩათვლამდე, დღე</span><input class="s-input" type="number" min="0" max="90" name="holdDays" value="${esc(config.holdDays)}"><small>ამ დროში წაშლილი ან დაბლოკილი ანგარიში არ ჩაითვლება.</small></label>
          <label class="s-field"><span>კოდის შეყვანა რეგისტრაციიდან, დღე</span><input class="s-input" type="number" min="1" max="30" name="entryWindowDays" value="${esc(config.entryWindowDays)}"><small>ძველი ანგარიში ინფლუენსერის კოდს ვერ შეიყვანს.</small></label>
          <label class="s-field"><span>მინიმალური გატანა, ₾</span><input class="s-input" type="number" min="1" step="0.01" name="minPayout" value="${esc((config.minPayout / 100).toFixed(2))}"></label>
          <label class="s-field"><span>ერთი ქსელიდან 24 სთ-ში, რის შემდეგაც მოწმდება</span><input class="s-input" type="number" min="2" max="100" name="networkFlag" value="${esc(config.networkFlag)}"><small>მაგ. 3 — მესამე და შემდეგი რეგისტრაცია ერთი Wi-Fi-დან „შემოწმებაში“ გადადის.</small></label>
          <label class="s-field"><span>Medi მონეტა ახალ მომხმარებელს</span><input class="s-input" type="number" min="0" max="500" name="inviteeCoins" value="${esc(config.inviteeCoins)}"><small>კოდის შეყვანისთანავე (როგორც მეგობრის კოდზე). 0 — არ ეძლევა. ფულადი ღირებულება არ აქვს.</small></label>
          <label class="s-switch-row"><span><b>ახალი ინფლუენსერების რეგისტრაცია</b><small>გამორთვისას medicard.ge/promo-ზე ახალი ანგარიში ვერ შეიქმნება; არსებულები შედიან და მუშაობენ.</small></span><input type="checkbox" class="s-switch" name="signupOpen" ${config.signupOpen ? 'checked' : ''}></label>
        </div></section>
      <div class="s-callout">${ico('info')}<p>მთელი პროგრამის შეჩერება (კოდები აპში, რეგისტრაცია, გატანა) — <a href="#/features">მოდულების ჩართვა → ინფლუენსერების პროგრამა</a>.</p></div>
      <div class="s-toolbar"><p class="s-form-msg" role="alert"></p><span class="spacer"></span><button type="submit" class="btn primary">შენახვა</button></div>
    </form>`;
    const form = host.querySelector('#inf-settings');
    const tbody = form.querySelector('.s-inf-tiers tbody');
    form.querySelector('[data-tier-add]')?.addEventListener('click', () => {
      const rows = tbody.querySelectorAll('[data-tier-row]');
      const last = rows[rows.length - 1];
      const from = Number(last?.querySelector('[name=from]').value || 0) * 2 || 1000;
      const rate = Number(last?.querySelector('[name=rate]').value || 0.25) + 0.05;
      tbody.insertAdjacentHTML('beforeend', tierRow({ from, rate: Math.round(rate * 100) }, rows.length));
      bindDel();
    });
    const bindDel = () => tbody.querySelectorAll('[data-tier-del]').forEach((b) => { b.onclick = () => b.closest('tr').remove(); });
    bindDel();
    form.onsubmit = async (ev) => {
      ev.preventDefault();
      const msg = form.querySelector('[role=alert]');
      msg.textContent = '';
      const tiers = [...tbody.querySelectorAll('[data-tier-row]')].map((tr) => ({ from: Number(tr.querySelector('[name=from]').value), rate: Math.round(Number(tr.querySelector('[name=rate]').value) * 100) }));
      const body = {
        tiers,
        holdDays: Number(form.holdDays.value),
        entryWindowDays: Number(form.entryWindowDays.value),
        minPayout: Math.round(Number(form.minPayout.value) * 100),
        networkFlag: Number(form.networkFlag.value),
        inviteeCoins: Number(form.inviteeCoins.value),
        signupOpen: form.signupOpen.checked,
      };
      const submit = form.querySelector('[type=submit]');
      submit.disabled = true;
      try {
        await api('/settings', { method: 'PUT', body: { config: body } });
        V().setDirty?.(false);
        toast('პარამეტრები შენახულია', 'ok');
        await renderSettings(host);
      } catch (err) {
        msg.textContent = say(err, 'ვერ შეინახა.');
        submit.disabled = false;
      }
    };
    form.addEventListener('input', () => V().setDirty?.(true));
  }

  /* ═════════════ page ═════════════ */
  async function refresh() {
    const root = $('tab-influencers');
    const host = root?.querySelector('[data-inf-pane]');
    if (!host) return;
    if (st.tab === 'list') await renderList(host);
    else if (st.tab === 'payouts') await renderPayouts(host);
    else if (st.tab === 'flagged') await renderFlagged(host);
    else await renderSettings(host);
  }

  async function renderInfluencersAdmin() {
    const root = $('tab-influencers');
    if (!root) return;
    const taken = global.AdminFocus?.take?.('influencers');
    const focus = taken instanceof URLSearchParams ? Object.fromEntries(taken) : taken;
    const params = global.AdminV3Shell?.hashParams?.() || new URLSearchParams();
    const tab = focus?.tab || params.get('tab');
    if (TABS.some(([k]) => k === tab)) st.tab = tab;
    const status = params.get('status');
    if (status && ACCOUNT[status]) st.status = status;
    let counts = { payouts: 0, flagged: 0 };
    try {
      const [p, f] = await Promise.all([api('/payouts?status=OPEN'), api('/flagged')]);
      counts = { payouts: p.counts.requested + p.counts.approved, flagged: f.referrals.length };
      if (!st.config) st.config = (await api('/settings')).config;
    } catch { /* the pane shows its own error */ }
    const label = (k, l) => (k === 'payouts' && counts.payouts ? `${l} <span class="s-badge is-warn">${fmt(counts.payouts)}</span>` : k === 'flagged' && counts.flagged ? `${l} <span class="s-badge is-warn">${fmt(counts.flagged)}</span>` : l);
    root.innerHTML = `<div class="s-stack v3-tab-shell s-inf-page">
      <div class="s-tabbar"><nav class="v3-subnav" role="tablist" aria-label="ინფლუენსერების განყოფილებები">${TABS.map(([k, l]) => `<button type="button" role="tab" class="v3-subnav-btn${k === st.tab ? ' is-active' : ''}" aria-selected="${k === st.tab}" data-inf-tab="${k}">${label(k, l)}</button>`).join('')}</nav></div>
      <div data-inf-pane></div>
    </div>`;
    root.querySelectorAll('[data-inf-tab]').forEach((b) => {
      b.onclick = () => { st.tab = b.dataset.infTab; writeHash(); void renderInfluencersAdmin(); };
    });
    await refresh();
    const focusId = focus?.focus || params.get('focus');
    if (focusId && st.tab === 'list') openInfluencer(focusId);
  }

  global.renderInfluencersAdmin = renderInfluencersAdmin;
})(window);
