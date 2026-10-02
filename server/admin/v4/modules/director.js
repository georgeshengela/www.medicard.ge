/**
 * MediCard Admin V4 — #/director დირექტორი (/api/admin/director).
 * The owner hands the shift to the Director („ცვლის ჩაბარება“) and takes it back. While on shift
 * the Director (Claude Code routine) reads aggregate metrics, writes to the owner on Telegram and
 * queues proposals; nothing is executed until the owner approves (here or with the Telegram buttons).
 * The page refreshes every 20 s; open sections, the chat position and the page scroll survive it.
 * Layout lives in v4/director.css; surfaces come from the s-* components.
 */
(function adminV4Director(global) {
  const doc = document;
  const $ = (id) => doc.getElementById(id);
  const V = () => global.AdminV3 || {};
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const ico = (n) => (typeof global.icon === 'function' ? global.icon(n) : '');
  const when = (iso) => {
    if (!iso) return '—';
    return typeof V().formatDate === 'function' ? V().formatDate(iso, 'datetime') : String(iso);
  };
  const ago = (iso) => {
    const min = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
    if (min < 1) return 'ახლახან';
    if (min < 60) return `${min} წთ წინ`;
    if (min < 1440) return `${Math.round(min / 60)} სთ წინ`;
    return `${Math.round(min / 1440)} დღის წინ`;
  };
  const api = (path, opts) => global.api(`/director${path}`, opts);
  const toast = (m, t) => global.toast?.(m, t);
  const skel = () => '<div class="p4-skel" aria-busy="true" aria-label="იტვირთება"><i class="is-tiles"></i><i class="is-block"></i><i class="is-block is-short"></i></div>';

  const KIND = { decision: 'გადაწყვეტილება', post: 'პოსტი', email: 'ელფოსტა', task: 'დავალება', team: 'გუნდი', change: 'ცვლილება' };
  const KIND_ICON = { decision: 'zap', post: 'image', email: 'mail', task: 'check', team: 'users', change: 'settings' };
  const STATUS = {
    pending: ['ელოდება', 'is-warn'], approved: ['დადასტურდა', 'is-info'], rejected: ['უარყოფილია', 'is-bad'],
    done: ['შესრულდა', 'is-ok'], expired: ['გაუქმდა', ''],
  };
  const FROM = { owner: 'შენ', director: 'დირექტორი', system: 'სისტემა' };
  const AREA = { growth: 'ზრდა', marketing: 'მარკეტინგი', content: 'კონტენტი', product: 'პროდუქტი', retention: 'შენარჩუნება', partnerships: 'პარტნიორობა', analytics: 'ანალიტიკა', ops: 'ოპერაციები' };
  const COLUMNS = [
    ['იდეები', ['idea']],
    ['შენს თანხმობას ელოდება', ['proposed']],
    ['მიმდინარე', ['approved', 'active']],
    ['შედეგი', ['done', 'dropped']],
  ];
  const REPORT_KIND = { plan: 'დღის გეგმა', daily: 'ბრიფი', evening: 'საღამოს ანგარიში', weekly: 'კვირის ანგარიში', analysis: 'ანალიზი', research: 'კვლევა', content: 'კონტენტი' };
  /** Memory keys the Director writes (docs/director/ROUTINE.md); unknown keys are humanised. */
  const MEMORY_KEYS = {
    goals: 'მიზნები', strategy: 'სტრატეგია', baseline: 'საწყისი მაჩვენებლები', learnings: 'დასკვნები', content_calendar: 'კონტენტის კალენდარი',
    owner_prefs: 'შენი წესები', support_tone: 'მხარდაჭერის ტონი', launch_status: 'გაშვების მდგომარეობა', weekly_numbers: 'კვირის რიცხვები',
  };
  const FIELD_KEYS = {
    ios: 'iOS', android: 'Android', web: 'ვები', ota: 'OTA განახლებები', week: 'კვირა', signups: 'რეგისტრაციები', activeAvg: 'საშუალო აქტიური',
    d1: 'D1', d7: 'D7', d30: 'D30', supportFirstReplyH: 'მხარდაჭერის პირველი პასუხი (სთ)',
  };
  const JOURNAL_VISIBLE = 12;
  const ID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
  const NOTE_OR_ID = new RegExp(`\\[შენიშვნა შეთავაზებაზე („[^\\]]*?“) \\((${ID})\\)\\]\\s*|\\b(${ID})\\b`, 'gi');

  if (typeof ICONS === 'object') {
    ICONS.director = '<path d="M12 3l2.5 5 5.5.8-4 3.9.9 5.5L12 15.6 7.1 18.2l.9-5.5-4-3.9 5.5-.8z"/>';
    doc.querySelectorAll('[data-icon="director"]').forEach((el) => {
      el.querySelector('svg.icon')?.remove();
      el.insertAdjacentHTML('afterbegin', ico('director'));
    });
  }

  let data = null;
  let pollTimer = null;
  let pairing = null;
  /** Where the setup card sits during this visit: it never jumps from the top to the bottom. */
  let setupPlace = null;
  /** details[data-keep] open/closed and expanded proposal bodies, kept across refreshes. */
  const openState = new Map();
  const expanded = new Set();

  const humanize = (k) => {
    const s = String(k || '').replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/[_.-]+/g, ' ').trim().toLowerCase();
    return s ? s[0].toUpperCase() + s.slice(1) : '—';
  };
  const isScalar = (v) => v == null || ['string', 'number', 'boolean'].includes(typeof v);
  function scalar(v, key = '') {
    if (v == null || v === '') return '—';
    if (typeof v === 'boolean') return v ? 'კი' : 'არა';
    if (typeof v === 'number') {
      if (/^d\d+$/i.test(key) && v >= 0 && v <= 1) return `${(v * 100).toLocaleString('ka-GE', { maximumFractionDigits: 1 })}%`;
      return v.toLocaleString('ka-GE');
    }
    return String(v);
  }
  function structHtml(v) {
    if (Array.isArray(v)) return v.every(isScalar) ? esc(v.map((x) => scalar(x)).join(', ')) : `<ul>${v.map((x) => `<li>${structHtml(x)}</li>`).join('')}</ul>`;
    if (v && typeof v === 'object') {
      return `<dl class="dr-kv">${Object.entries(v).map(([k, x]) => `<div><dt>${esc(FIELD_KEYS[k] || humanize(k))}</dt><dd>${isScalar(x) ? esc(scalar(x, k)) : structHtml(x)}</dd></div>`).join('')}</dl>`;
    }
    return esc(scalar(v));
  }
  /** Memory values are text; objects are stored as JSON — shown as a definition list, raw JSON folded. */
  function memValueHtml(raw, key) {
    const text = String(raw ?? '');
    let parsed = null;
    if (/^\s*[[{]/.test(text)) { try { parsed = JSON.parse(text); } catch { parsed = null; } }
    if (parsed && typeof parsed === 'object') {
      return `${structHtml(parsed)}<details class="dr-raw" data-keep="mem-raw:${esc(key)}"><summary>ტექნიკური დეტალები</summary><pre>${esc(JSON.stringify(parsed, null, 2))}</pre></details>`;
    }
    return `<div class="dr-mem-text">${esc(text)}</div>`;
  }
  /** Support drafts carry the model's category key before the reason („რატომ შენ: data_request — …“). */
  const cleanBody = (s) => String(s || '').replace(/^(რატომ შენ:\s*)[a-z][a-z0-9_]*\s+—\s+/gim, '$1');
  /**
   * Telegram notes on a proposal arrive as „[შენიშვნა შეთავაზებაზე „…“ (uuid)] …“: the id becomes a link
   * to the proposal on this page; any other id is shortened.
   */
  function chatText(text, proposals) {
    const raw = String(text ?? '');
    const byId = new Map(proposals.map((p) => [String(p.id).toLowerCase(), p]));
    const ref = (id, label) => (byId.has(id.toLowerCase())
      ? `<button type="button" class="dr-ref" data-goto="${esc(id)}">${ico('file')}${esc(label)}</button>`
      : `<span class="dr-ref is-static">${ico('file')}${esc(label)}</span>`);
    let out = '';
    let last = 0;
    for (const m of raw.matchAll(NOTE_OR_ID)) {
      out += esc(raw.slice(last, m.index));
      if (m[2]) out += `${ref(m[2], `შენიშვნა შეთავაზებაზე ${m[1]}`)} `;
      else out += byId.has(m[3].toLowerCase()) ? ref(m[3], `შეთავაზება „${byId.get(m[3].toLowerCase()).title}“`) : `#${m[3].slice(0, 8)}`;
      last = m.index + m[0].length;
    }
    return out + esc(raw.slice(last));
  }

  function heroCard(d) {
    const s = d.state;
    const pending = d.proposals.filter((p) => p.status === 'pending').length;
    return `<section class="s-card dr-hero">
      <header class="s-card-head">
        <div>
          <div class="dr-hero-title"><span class="dr-dot ${s.active ? 'is-on' : ''}"></span><h3>${s.active ? 'დირექტორი ცვლაზეა' : 'დირექტორი ცვლაზე არ არის'}</h3></div>
          <p>${s.active
            ? `ცვლა ჩაიბარა ${esc(when(s.activatedAt))}. აკვირდება მეტრიკებს, გწერს ტელეგრამში და ყველაფერს შენი თანხმობით აკეთებს.`
            : 'როცა წახვალ, ჩააბარე ცვლა: დირექტორი მიხედავს MEDICARD-ს, დილით მოგწერს ბრიფს და ყოველ ქმედებაზე ტელეგრამში გკითხავს.'}</p>
        </div>
        <button type="button" class="btn ${s.active ? '' : 'primary'} dr-shift" data-shift>${s.active ? 'ცვლის დაბრუნება' : 'ცვლის ჩაბარება'}</button>
      </header>
      <div class="s-metrics">
        <div class="s-metric"><span>სტატუსი</span><strong>${s.active ? 'მუშაობს' : 'პაუზა'}</strong><small>${s.active ? esc(s.activatedBy || 'ცვლაზეა') : 'ცვლა შენთანაა'}</small></div>
        <div class="s-metric ${pending ? 'is-warn' : ''}"><span>თანხმობას ელოდება</span><strong>${pending}</strong><small>შეთავაზება</small></div>
        <div class="s-metric"><span>ბოლო მუშაობა</span><strong>${s.lastBrainAt ? esc(ago(s.lastBrainAt)) : '—'}</strong><small>${s.lastBrainAt ? esc(when(s.lastBrainAt)) : 'ჯერ არ უმუშავია'}</small></div>
        <div class="s-metric"><span>ტელეგრამი</span><strong>${s.paired ? 'ჩართული' : 'არ არის'}</strong><small>${d.config.bot?.username ? `@${esc(d.config.bot.username)}` : 'ბოტი არ არის'}</small></div>
      </div>
    </section>`;
  }

  const envHint = (name, rest = '') => `დაამატე Render-ში ცვლადი <code>${name}</code>${rest}.`;
  function steps(d) {
    const c = d.config;
    const s = d.state;
    const botOk = c.telegram && !c.bot?.error;
    const hookError = c.webhook?.lastError ? String(c.webhook.lastError) : '';
    const hookCode = hookError.match(/\b[45]\d\d\b/)?.[0];
    return [
      {
        done: botOk,
        title: 'ტელეგრამის ბოტი',
        hint: !c.telegram ? `@BotFather-ში შექმენი ბოტი და ${envHint('TELEGRAM_BOT_TOKEN')}`
          : c.bot?.error ? 'ბოტის ტოკენი არ მუშაობს — შეამოწმე Render-ში ცვლადი <code>TELEGRAM_BOT_TOKEN</code>.' : `@${esc(c.bot?.username || '')}`,
      },
      {
        done: c.brainToken,
        title: 'დირექტორის გასაღები',
        hint: c.brainToken ? 'Render-ში დაყენებულია.' : envHint('DIRECTOR_API_TOKEN', ' — შემთხვევითი, მინიმუმ 32 სიმბოლო'),
      },
      {
        done: Boolean(c.webhook?.set),
        title: 'ბოტის მიერთება სერვერზე',
        hint: hookError
          ? `<span title="${esc(hookError)}">ტელეგრამმა ბოლოს შეტყობინება ვერ მოგვაწოდა${hookCode ? ` (შეცდომა ${hookCode})` : ''}. თუ მეორდება, დააჭირე „თავიდან“.</span>`
          : c.webhook?.set ? 'მიერთებულია — შენი მესიჯები medicard.ge-ზე მოდის.' : 'ერთი დაჭერა — ტელეგრამი შენს მესიჯებს medicard.ge-ზე გამოგზავნის.',
        action: botOk ? `<button type="button" class="btn ${c.webhook?.set ? 'ghost' : ''}" data-webhook>${c.webhook?.set ? 'თავიდან' : 'მიერთება'}</button>` : '',
      },
      {
        done: s.paired,
        title: 'შენი ტელეგრამი',
        hint: s.paired ? 'დირექტორი მხოლოდ ამ ჩატს პასუხობს.' : 'გაიხსნება ბოტი — დააჭირე Start.',
        action: s.paired ? '<button type="button" class="btn ghost" data-unpair>გათიშვა</button>'
          : (botOk && c.webhook?.set ? '<button type="button" class="btn" data-pair>დაკავშირება</button>' : ''),
      },
      {
        done: Boolean(c.live),
        title: '24/7 დირექტორი',
        hint: c.live
          ? `ცვლაზე ტელეგრამსა და მხარდაჭერის წერილებს წამებში პასუხობს. დღეს ${c.live.calls ?? 0} / ${c.live.cap ?? '—'} AI მოთხოვნა.${c.live.model ? ` <span class="dr-model" title="AI მოდელი">${esc(c.live.model)}</span>` : ''}`
          : envHint('OPENROUTER_API_KEY'),
      },
    ];
  }

  function stepRows(list) {
    return list.map((x, i) => `<div class="dr-step ${x.done ? 'is-done' : ''}">
        <span class="dr-step-n">${x.done ? ico('check') : i + 1}</span>
        <div><b>${esc(x.title)}</b><small>${x.hint}</small></div>
        <div class="dr-step-aside">${x.action || ''}${x.done ? '<span class="s-badge is-ok">მზადაა</span>'
          : x.optional ? '<span class="s-badge is-plain">არჩევითი</span>' : '<span class="s-badge is-warn">საჭიროა</span>'}</div>
      </div>`).join('');
  }

  function setupCard(d, left) {
    const list = steps(d);
    if (!left) {
      return `<section class="s-card dr-setup is-done"><details class="s-details" data-keep="setup"><summary>${ico('check')} დაყენება · ყველაფერი მზადაა</summary>
        <div class="dr-flush">${stepRows(list)}</div></details></section>`;
    }
    const pair = pairing && !d.state.paired
      ? `<div class="s-callout is-ok dr-pair">${ico('send')}<p>გახსენი <a href="${esc(pairing.link)}" target="_blank" rel="noopener">${esc(pairing.link)}</a> და დააჭირე Start. კოდი <b>${esc(pairing.code)}</b> მოქმედებს 10 წუთი.</p></div>`
      : '';
    return `<section class="s-card dr-setup">
      <header class="s-card-head"><div><h3>დაყენება · დარჩა ${left}</h3><p>ერთხელ გასაკეთებელი. გასაღებები Render-შია და აქ არასდროს ჩანს.</p></div></header>
      <div class="s-card-body is-flush">${stepRows(list)}</div>${pair}
    </section>`;
  }

  function proposalItem(p) {
    const [label, cls] = STATUS[p.status] || [p.status, ''];
    const body = cleanBody(p.body);
    // Pending proposals are read in full before a decision; only decided ones are folded.
    const long = p.status !== 'pending' && (body.length > 520 || body.split('\n').length > 9);
    const open = expanded.has(p.id);
    return `<article class="s-feed-item dr-proposal" id="dr-p-${esc(p.id)}" data-proposal="${esc(p.id)}">
      <span class="s-avatar">${ico(KIND_ICON[p.kind] || 'spark')}</span>
      <div>
        <header><b>${esc(p.title)}</b><span class="s-badge is-plain">${esc(KIND[p.kind] || 'შეთავაზება')}</span><span class="s-badge ${cls}">${esc(label)}</span><time>${esc(when(p.createdAt))}</time></header>
        <p class="s-feed-body dr-body${long && !open ? ' is-clamped' : ''}">${esc(body)}</p>
        ${long ? `<button type="button" class="dr-more" data-more="${esc(p.id)}" aria-expanded="${open}">${open ? 'შეკეცვა' : 'სრულად ნახვა'}</button>` : ''}
        ${p.ownerNote ? `<p class="dr-note"><b>შენი შენიშვნა:</b> ${esc(p.ownerNote)}</p>` : ''}
        ${p.result ? `<p class="dr-note"><b>შედეგი:</b> ${esc(p.result)}</p>` : ''}
        ${p.status === 'pending' ? `<div class="s-feed-actions">
          <button type="button" class="btn primary" data-decide="${esc(p.id)}" data-approve="1">${ico('check')} თანხმობა</button>
          <button type="button" class="btn" data-decide="${esc(p.id)}" data-approve="0">${ico('x')} უარი</button></div>` : ''}
      </div>
    </article>`;
  }

  function proposalsCard(d) {
    const pending = d.proposals.filter((p) => p.status === 'pending');
    const rest = d.proposals.filter((p) => p.status !== 'pending').slice(0, 15);
    return `<section class="s-card dr-queue">
      <header class="s-card-head"><div><h3>შენს თანხმობას ელოდება${pending.length ? ` · ${pending.length}` : ''}</h3>
        <p>დირექტორი დაუდასტურებლად არაფერს აკეთებს. იგივე ღილაკები ტელეგრამშიც მოდის.</p></div></header>
      <div class="s-card-body is-flush">
        ${pending.length ? pending.map(proposalItem).join('') : `<div class="s-empty">${ico('check')}<strong>რიგი ცარიელია</strong><span>ახალი შეთავაზება აქაც და ტელეგრამშიც გამოჩნდება.</span></div>`}
      </div>
      ${rest.length ? `<details class="s-details" data-keep="history"><summary>ისტორია · ${rest.length}</summary><div class="dr-flush">${rest.map(proposalItem).join('')}</div></details>` : ''}
    </section>`;
  }

  function chatCard(d) {
    const msgs = d.messages.slice(-40);
    const bubble = (m) => `<div class="dr-msg${m.direction === 'owner' ? ' is-owner' : ''}${m.direction === 'system' ? ' is-system' : ''}">
        <span class="dr-msg-meta">${esc(FROM[m.direction] || 'სისტემა')} · ${esc(when(m.createdAt))}${m.direction === 'owner' && !m.handledAt ? ' · <b class="dr-wait">ელოდება პასუხს</b>' : ''}</span>
        <div class="dr-bubble">${chatText(m.text, d.proposals)}</div></div>`;
    return `<section class="s-card dr-chat-card">
      <header class="s-card-head"><div><h3>საუბარი</h3><p>იგივე, რაც ტელეგრამში. აქ დაწერილზეც ტელეგრამში გიპასუხებს.</p></div></header>
      ${msgs.length ? `<div class="dr-chat" data-chat>${msgs.map(bubble).join('')}</div>` : `<div class="s-empty">${ico('message')}<strong>ჯერ არაფერი</strong><span>ჩააბარე ცვლა ან მიწერე.</span></div>`}
      <div class="dr-compose">
        <textarea data-say rows="1" maxlength="4000" placeholder="მიწერე დირექტორს…" title="Ctrl+Enter — გაგზავნა" aria-label="მესიჯი დირექტორს"></textarea>
        <button type="button" class="btn primary" data-send>${ico('send')} გაგზავნა</button>
      </div>
    </section>`;
  }

  function initiativeCard(i) {
    const lines = [
      i.hypothesis && `<strong>ჰიპოთეზა:</strong> ${esc(i.hypothesis)}`,
      i.plan && `<strong>გეგმა:</strong> ${esc(i.plan)}`,
      (i.metric || i.target) && `<strong>საზომი:</strong> ${esc(i.metric)}${i.target ? ` → ${esc(i.target)}` : ''}`,
      i.progress && `<strong>პროგრესი:</strong> ${esc(i.progress)}`,
      i.result && `<strong>შედეგი:</strong> ${esc(i.result)}`,
    ].filter(Boolean).join('\n');
    const statusBadge = i.status === 'dropped' ? '<span class="s-badge is-bad is-plain">შეწყდა</span>'
      : i.status === 'done' ? '<span class="s-badge is-ok is-plain">დასრულდა</span>'
        : i.status === 'approved' ? '<span class="s-badge is-info is-plain">დამტკიცდა</span>' : '';
    return `<details class="dr-init" data-keep="init:${esc(i.id)}"><summary><b>${esc(i.title)}</b>
        <span class="dr-init-meta"><span class="s-badge is-plain">${esc(AREA[i.area] || humanize(i.area))}</span>${statusBadge}</span>
        <span class="dr-score">გავლენა ${esc(i.impact ?? '—')} · ძალისხმევა ${esc(i.effort ?? '—')}</span></summary>
        ${lines ? `<div class="dr-init-body">${lines}</div>` : ''}</details>`;
  }

  function planCard(d) {
    const list = d.initiatives || [];
    const goals = (d.memory || []).find((m) => m.key === 'goals' || m.key === 'strategy');
    const cols = COLUMNS.map(([label, statuses]) => {
      const items = list.filter((i) => statuses.includes(i.status));
      return `<div class="dr-col"><header><span>${esc(label)}</span><i>${items.length}</i></header>
        ${items.length ? items.map(initiativeCard).join('') : '<div class="dr-col-empty">ჯერ არაფერი</div>'}</div>`;
    }).join('');
    return `<section class="s-card">
      <header class="s-card-head"><div><h3>გეგმა</h3><p>დირექტორის ინიციატივები: იდეა → შენი თანხმობა → მუშაობა → შედეგი. ბარათს დააჭირე დეტალებისთვის.</p></div></header>
      ${goals ? `<div class="s-callout dr-goals">${ico('zap')}<div><b>${esc(MEMORY_KEYS[goals.key] || 'მიზნები')}</b>${memValueHtml(goals.value, goals.key)}</div></div>` : ''}
      ${list.length ? `<div class="dr-board">${cols}</div>` : `<div class="s-empty">${ico('spark')}<strong>გეგმა ჯერ ცარიელია</strong><span>დირექტორი პირველ იდეებს დილის სესიაზე ჩაწერს.</span></div>`}
    </section>`;
  }

  function reportsCard(d) {
    const list = d.reports || [];
    return `<section class="s-card">
      <header class="s-card-head"><div><h3>ანგარიშები</h3><p>დღის გეგმები, საღამოს ანგარიშები, ანალიზი და კვლევა — რას აკეთებს და რას ფიქრობს დირექტორი.</p></div></header>
      <div class="s-card-body is-flush">
        ${list.length ? list.map((r, n) => `<details class="dr-report" data-keep="report:${esc(r.id)}"${n === 0 && !openState.has(`report:${r.id}`) ? ' open' : ''}><summary><span class="s-badge is-plain">${esc(REPORT_KIND[r.kind] || 'ანგარიში')}</span><b>${esc(r.title)}</b><time>${esc(when(r.createdAt))}</time></summary>
          <div class="dr-report-body">${esc(r.body)}</div></details>`).join('')
          : `<div class="s-empty">${ico('file')}<strong>ანგარიშები ჯერ არ არის</strong><span>პირველი დილის სესიის შემდეგ გამოჩნდება.</span></div>`}
      </div>
    </section>`;
  }

  function journalCard(d) {
    const mem = d.memory || [];
    const rows = (list) => list.map((j) => `<div class="dr-log"><time>${esc(when(j.createdAt))}</time><span>${esc(j.summary)}</span></div>`).join('');
    const recent = d.journal.slice(0, JOURNAL_VISIBLE);
    const older = d.journal.slice(JOURNAL_VISIBLE);
    return `<section class="s-card">
      <header class="s-card-head"><div><h3>ჟურნალი</h3><p>რას აკეთებდა დირექტორი და რა გადაწყდა.</p></div></header>
      <div class="s-card-body is-flush">
        ${d.journal.length ? rows(recent) : `<div class="s-empty">${ico('file')}<strong>ჟურნალი ცარიელია</strong></div>`}
      </div>
      ${older.length ? `<details class="s-details" data-keep="journal-more"><summary>ძველი ჩანაწერები · ${older.length}</summary><div class="dr-flush">${rows(older)}</div></details>` : ''}
      ${mem.length ? `<details class="s-details" data-keep="memory"><summary>მეხსიერება · ${mem.length}</summary><div class="dr-mem-list">${mem.map((m) => `<div class="dr-mem">
          <div class="dr-mem-head"><b title="${esc(m.key)}">${esc(MEMORY_KEYS[m.key] || humanize(m.key))}</b>${m.updatedAt ? `<time>${esc(when(m.updatedAt))}</time>` : ''}</div>
          ${memValueHtml(m.value, m.key)}</div>`).join('')}</div></details>` : ''}
    </section>`;
  }

  const workspace = () => doc.querySelector('.workspace');

  function paint(root) {
    root.querySelectorAll('details[data-keep]').forEach((el) => openState.set(el.dataset.keep, el.open));
    const chat = root.querySelector('[data-chat]');
    const chatTop = chat ? chat.scrollTop : null;
    const chatAtEnd = !chat || chat.scrollHeight - chat.scrollTop - chat.clientHeight < 40;
    const ws = workspace();
    const pageTop = ws && root.querySelector('.dr-page') ? ws.scrollTop : null;
    const draft = root.querySelector('[data-say]')?.value || '';
    const left = steps(data).filter((x) => !x.done && !x.optional).length;
    if (left) setupPlace = 'top';
    else if (!setupPlace) setupPlace = 'bottom';
    const setup = setupCard(data, left);
    root.innerHTML = `<div class="s-stack dr-page">
      ${heroCard(data)}
      ${setupPlace === 'top' ? setup : ''}
      <div class="dr-grid">${proposalsCard(data)}${chatCard(data)}</div>
      ${planCard(data)}
      ${reportsCard(data)}
      ${journalCard(data)}
      ${setupPlace === 'bottom' ? setup : ''}
    </div>`;
    root.querySelectorAll('details[data-keep]').forEach((el) => {
      if (openState.has(el.dataset.keep)) el.open = openState.get(el.dataset.keep);
    });
    const nextChat = root.querySelector('[data-chat]');
    if (nextChat) nextChat.scrollTop = chatAtEnd || chatTop == null ? nextChat.scrollHeight : chatTop;
    if (ws && pageTop != null) ws.scrollTop = pageTop;
    const say = root.querySelector('[data-say]');
    if (say) say.value = draft;
    bind(root);
  }

  async function act(fn, okMsg) {
    try {
      const next = await fn();
      if (next && next.state) data = next;
      if (okMsg) toast(okMsg, 'ok');
      const root = $('tab-director');
      if (root) paint(root);
    } catch (e) {
      toast(e.message || 'ვერ შესრულდა', 'bad');
    }
  }

  function gotoProposal(root, id) {
    const item = root.querySelector(`[data-proposal="${CSS.escape(id)}"]`);
    if (!item) return;
    const holder = item.closest('details[data-keep]');
    if (holder && !holder.open) { holder.open = true; openState.set(holder.dataset.keep, true); }
    item.scrollIntoView({ behavior: 'smooth', block: 'center' });
    item.classList.remove('is-flash');
    void item.offsetWidth;
    item.classList.add('is-flash');
  }

  function bind(root) {
    root.querySelector('[data-shift]')?.addEventListener('click', () => {
      const on = !data.state.active;
      void act(() => api('/shift', { method: 'PUT', body: { active: on } }), on ? 'ცვლა ჩაბარდა' : 'ცვლა დაგიბრუნდა');
    });
    root.querySelector('[data-webhook]')?.addEventListener('click', () => void act(async () => {
      const r = await api('/telegram/webhook', { method: 'POST' });
      toast(r.lastError ? 'ტელეგრამმა შეცდომა დააბრუნა — სცადე ცოტა ხანში თავიდან' : 'ბოტი მიერთდა', r.lastError ? 'warn' : 'ok');
      return api('');
    }));
    root.querySelector('[data-pair]')?.addEventListener('click', () => void act(async () => {
      pairing = await api('/telegram/pair', { method: 'POST' });
      global.open?.(pairing.link, '_blank', 'noopener');
      return api('');
    }));
    root.querySelector('[data-unpair]')?.addEventListener('click', () => void act(() => { pairing = null; return api('/telegram/unpair', { method: 'POST' }); }, 'ტელეგრამი გაითიშა'));
    root.querySelectorAll('[data-decide]').forEach((b) => b.addEventListener('click', () => {
      const approve = b.dataset.approve === '1';
      void act(() => api(`/proposals/${encodeURIComponent(b.dataset.decide)}/decide`, { method: 'POST', body: { approve } }), approve ? 'დადასტურდა' : 'უარყოფილია');
    }));
    root.querySelectorAll('[data-more]').forEach((b) => b.addEventListener('click', () => {
      const id = b.dataset.more;
      const open = !expanded.has(id);
      if (open) expanded.add(id); else expanded.delete(id);
      b.setAttribute('aria-expanded', String(open));
      b.textContent = open ? 'შეკეცვა' : 'სრულად ნახვა';
      b.previousElementSibling?.classList.toggle('is-clamped', !open);
    }));
    root.querySelectorAll('[data-goto]').forEach((b) => b.addEventListener('click', () => gotoProposal(root, b.dataset.goto)));
    const send = () => {
      const box = root.querySelector('[data-say]');
      const text = box.value.trim();
      if (!text) return;
      box.value = '';
      void act(() => api('/message', { method: 'POST', body: { text } }));
    };
    root.querySelector('[data-send]')?.addEventListener('click', send);
    root.querySelector('[data-say]')?.addEventListener('keydown', (e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) send(); });
  }

  /** The owner is selecting text to copy — a refresh now would drop the selection. */
  function selecting(root) {
    const sel = global.getSelection?.();
    return Boolean(sel && !sel.isCollapsed && sel.anchorNode && root.contains(sel.anchorNode));
  }

  async function renderDirector() {
    const root = $('tab-director');
    if (!root) return;
    if (!data) root.innerHTML = skel();
    if (!root.dataset.drBound) {
      root.dataset.drBound = '1';
      root.addEventListener('toggle', (e) => {
        const el = e.target;
        if (el?.matches?.('details[data-keep]')) openState.set(el.dataset.keep, el.open);
      }, true);
    }
    try {
      data = await api('');
    } catch (err) {
      root.innerHTML = `<section class="s-card"><div class="s-empty">${ico('alert')}<strong>ვერ ჩაიტვირთა</strong><span>${esc(err?.message || 'სცადე ხელახლა.')}</span><button type="button" class="btn" data-retry>${ico('refresh')} ხელახლა ცდა</button></div></section>`;
      root.querySelector('[data-retry]').onclick = renderDirector;
      return;
    }
    setupPlace = null;
    paint(root);
    clearInterval(pollTimer);
    // The tab stays painted when the owner leaves and comes back, so the timer keeps running and only
    // skips its turn while the page is hidden, while the owner types to the Director or selects text.
    pollTimer = setInterval(() => {
      const r = $('tab-director');
      if (!r) { clearInterval(pollTimer); return; }
      if (r.classList.contains('hidden') || doc.hidden) return;
      if (doc.activeElement?.matches?.('[data-say]') || selecting(r)) return;
      api('').then((d) => { data = d; paint(r); }).catch(() => {});
    }, 20000);
  }

  global.renderDirector = renderDirector;
  global.AdminV4Director = { renderDirector };
})(window);
