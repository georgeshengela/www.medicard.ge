/**
 * MediCard Admin V4 — #/director დირექტორი (/api/admin/director).
 * The owner hands the shift to the Director („ცვლის ჩაბარება“) and takes it back. While on shift
 * the Director reads aggregate metrics, writes to the owner on Telegram, answers plain support mail
 * and queues proposals; nothing is executed until the owner approves (here or with the Telegram
 * buttons). Page order: the shift (one switch, how long, last work, Telegram, today's AI use) →
 * what waits for the owner's decision beside the conversation → tabs: plan, reports, journal,
 * decisions, memory, setup. The page refreshes every 20 s; the tab, filters, open cards, the chat
 * position, an unsent message and the page scroll survive it.
 * Layout lives in v4/director.css; surfaces come from the s-* components. The Director's colour is
 * the same violet as on #/support (--sx-dir).
 */
(function adminV4Director(global) {
  const doc = document;
  const $ = (id) => doc.getElementById(id);
  const V = () => global.AdminV3 || {};
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const ico = (n) => (typeof global.icon === 'function' ? global.icon(n) : '');
  const fmt = (n) => (Number.isFinite(Number(n)) ? Number(n).toLocaleString('ka-GE') : '—');
  const when = (iso) => {
    if (!iso) return '—';
    return typeof V().formatDate === 'function' ? V().formatDate(iso, 'datetime') : String(iso);
  };
  const dayOf = (iso) => (typeof V().formatDate === 'function' ? V().formatDate(iso, 'date') : String(iso).slice(0, 10));
  const clock = (iso) => { const p = typeof global.adminDateParts === 'function' ? global.adminDateParts(iso) : null; return p ? `${p.hour}:${p.minute}` : ''; };
  const ago = (iso) => {
    const min = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
    if (!Number.isFinite(min)) return '—';
    if (min < 1) return 'ახლახან';
    if (min < 60) return `${min} წთ წინ`;
    if (min < 1440) return `${Math.round(min / 60)} სთ წინ`;
    return `${Math.round(min / 1440)} დღის წინ`;
  };
  /** „2 დღე 3 სთ“ / „4 სთ 10 წთ“ / „12 წთ“ since a moment. */
  const span = (iso) => {
    const min = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
    if (!Number.isFinite(min)) return '';
    const d = Math.floor(min / 1440);
    const h = Math.floor((min % 1440) / 60);
    const m = min % 60;
    if (d) return `${d} დღე${h ? ` ${h} სთ` : ''}`;
    if (h) return `${h} სთ${m ? ` ${m} წთ` : ''}`;
    return `${Math.max(1, m)} წთ`;
  };
  const api = (path, opts) => global.api(`/director${path}`, opts);
  const toast = (m, t) => global.toast?.(m, t);
  const md = (text) => (typeof global.aiMarkdown === 'function' ? global.aiMarkdown(text) : `<p>${esc(text)}</p>`);
  const skel = () => '<div class="p4-skel" aria-busy="true" aria-label="იტვირთება"><i class="is-tiles"></i><i class="is-block"></i><i class="is-block is-short"></i></div>';

  const KIND = { decision: 'გადაწყვეტილება', post: 'პოსტი', email: 'წერილი', task: 'დავალება', team: 'გუნდი', change: 'ცვლილება' };
  const KIND_ICON = { decision: 'zap', post: 'image', email: 'mail', task: 'check', team: 'users', change: 'settings' };
  const STATUS = {
    pending: ['ელოდება', 'is-warn'], approved: ['დადასტურდა', 'is-info'], rejected: ['უარყოფილია', 'is-bad'],
    done: ['შესრულდა', 'is-ok'], expired: ['გაუქმდა', 'is-plain'],
  };
  const AREA = { growth: 'ზრდა', marketing: 'მარკეტინგი', content: 'კონტენტი', product: 'პროდუქტი', retention: 'შენარჩუნება', partnerships: 'პარტნიორობა', analytics: 'ანალიტიკა', ops: 'ოპერაციები' };
  const COLUMNS = [
    ['იდეები', ['idea'], 'is-idea'],
    ['შენს თანხმობას ელოდება', ['proposed'], 'is-proposed'],
    ['მიმდინარე', ['approved', 'active'], 'is-active'],
    ['შედეგი', ['done', 'dropped'], 'is-done'],
  ];
  const REPORT_KIND = { plan: 'დღის გეგმა', daily: 'ბრიფი', evening: 'საღამოს ანგარიში', weekly: 'კვირის ანგარიში', analysis: 'ანალიზი', research: 'კვლევა', content: 'კონტენტი' };
  const JOURNAL_KIND = { run: ['სესია', 'zap'], brief: ['ბრიფი', 'file'], check: ['შემოწმება', 'check'], note: ['ჩანაწერი', 'edit'], shift: ['ცვლა', 'clock'] };
  /** Memory keys the Director writes (docs/director/ROUTINE.md); unknown keys are humanised. */
  const MEMORY_KEYS = {
    goals: 'მიზნები', strategy: 'სტრატეგია', baseline: 'საწყისი მაჩვენებლები', learnings: 'დასკვნები', content_calendar: 'კონტენტის კალენდარი',
    owner_prefs: 'შენი წესები', support_tone: 'მხარდაჭერის ტონი', launch_status: 'გაშვების მდგომარეობა', weekly_numbers: 'კვირის რიცხვები',
  };
  const FIELD_KEYS = {
    ios: 'iOS', android: 'Android', web: 'ვები', ota: 'OTA განახლებები', week: 'კვირა', signups: 'რეგისტრაციები', activeAvg: 'საშუალო აქტიური',
    d1: 'D1', d7: 'D7', d30: 'D30', supportFirstReplyH: 'მხარდაჭერის პირველი პასუხი (სთ)', q4: 'Q4', medirun: 'MEDIRUN',
  };
  const TABS = [['plan', 'გეგმა'], ['reports', 'ანგარიშები'], ['journal', 'ჟურნალი'], ['history', 'გადაწყვეტილებები'], ['memory', 'მეხსიერება'], ['setup', 'დაყენება']];
  /** Lines the Director starts with a label; shown in bold. */
  const LABELS = /^(ჰიპოთეზა|გეგმა|საზომი|პროგრესი|შედეგი|პოსტის ტექსტი|სურათი|დრო|რატომ შენ|პასუხის პროექტი|ვადა|ბიუჯეტი|რისკი|ეფექტი)\s*:/gm;
  const ID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
  const NOTE_OR_ID = new RegExp(`\\[შენიშვნა შეთავაზებაზე („[^\\]]*?“) \\((${ID})\\)\\]\\s*|\\b(${ID})\\b`, 'gi');
  const BARE_ID = new RegExp(`\\b(${ID})\\b`, 'gi');

  if (typeof ICONS === 'object') {
    ICONS.director = '<path d="M12 3l2.5 5 5.5.8-4 3.9.9 5.5L12 15.6 7.1 18.2l.9-5.5-4-3.9 5.5-.8z"/>';
    if (!ICONS.clock) ICONS.clock = '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>';
    if (!ICONS.edit) ICONS.edit = '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>';
    if (!ICONS.mail) ICONS.mail = '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>';
    doc.querySelectorAll('[data-icon="director"]').forEach((el) => {
      el.querySelector('svg.icon')?.remove();
      el.insertAdjacentHTML('afterbegin', ico('director'));
    });
  }

  let data = null;
  let pollTimer = null;
  let pairing = null;
  /** View state that survives the 20 s refresh. */
  const ui = { tab: 'plan', queueKind: 'all', historyStatus: 'all', journalKind: 'all', reportId: null };
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
  const parseJson = (raw) => {
    const text = String(raw ?? '');
    if (!/^\s*[[{]/.test(text)) return null;
    try { const v = JSON.parse(text); return v && typeof v === 'object' ? v : null; } catch { return null; }
  };
  /** Memory values are text; objects are stored as JSON — shown as a definition list, raw JSON folded. */
  function memValueHtml(raw, key) {
    const parsed = parseJson(raw);
    if (parsed) {
      return `${structHtml(parsed)}<details class="dr-raw" data-keep="mem-raw:${esc(key)}"><summary>ტექნიკური დეტალები</summary><pre>${esc(JSON.stringify(parsed, null, 2))}</pre></details>`;
    }
    return `<div class="dr-mem-text">${esc(String(raw ?? ''))}</div>`;
  }
  /** Support drafts carry the model's category key before the reason („რატომ შენ: data_request — …“). */
  const cleanBody = (s) => String(s || '').replace(/^(რატომ შენ:\s*)[a-z][a-z0-9_]*\s+—\s+/gim, '$1');
  /** A proposal body as readable text: known labels in bold, markdown rendered. */
  const bodyHtml = (s) => md(cleanBody(s).replace(LABELS, '**$1:**'));

  /** A support draft: „summary\nრატომ შენ: …\n\nპასუხის პროექტი:\n…“ (supportAgent.js). */
  function emailParts(p) {
    const body = cleanBody(p.body);
    const at = body.indexOf('პასუხის პროექტი:');
    const head = (at >= 0 ? body.slice(0, at) : body).trim().split('\n').filter(Boolean);
    const why = head.find((l) => /^რატომ შენ:/.test(l));
    return {
      summary: head.filter((l) => l !== why).join('\n'),
      reason: why ? why.replace(/^რატომ შენ:\s*/, '') : '',
      draft: String(p.payload?.body || (at >= 0 ? body.slice(at + 'პასუხის პროექტი:'.length) : '')).trim(),
      threadId: p.payload?.action === 'support_reply' ? p.payload.threadId : null,
    };
  }

  const refButton = (id, label, proposals) => {
    const known = proposals.some((p) => String(p.id).toLowerCase() === id.toLowerCase());
    return known
      ? `<button type="button" class="dr-ref" data-goto="${esc(id)}">${ico('file')}${esc(label)}</button>`
      : `<span class="dr-ref is-static">${ico('file')}${esc(label)}</span>`;
  };
  /**
   * Telegram notes on a proposal arrive as „[შენიშვნა შეთავაზებაზე „…“ (uuid)] …“: the id becomes a link
   * to the proposal on this page; any other id is shortened.
   */
  function ownerText(text, proposals) {
    const raw = String(text ?? '');
    const byId = new Map(proposals.map((p) => [String(p.id).toLowerCase(), p]));
    let out = '';
    let last = 0;
    for (const m of raw.matchAll(NOTE_OR_ID)) {
      out += esc(raw.slice(last, m.index));
      if (m[2]) out += `${refButton(m[2], `შენიშვნა შეთავაზებაზე ${m[1]}`, proposals)} `;
      else out += byId.has(m[3].toLowerCase()) ? refButton(m[3], `„${byId.get(m[3].toLowerCase()).title}“`, proposals) : `#${m[3].slice(0, 8)}`;
      last = m.index + m[0].length;
    }
    return out + esc(raw.slice(last));
  }
  /** The Director's messages are markdown; proposal ids inside become links. */
  function directorText(text, proposals) {
    const byId = new Map(proposals.map((p) => [String(p.id).toLowerCase(), p]));
    return md(text).replace(BARE_ID, (id) => (byId.has(id.toLowerCase()) ? refButton(id, `„${byId.get(id.toLowerCase()).title}“`, proposals) : `#${id.slice(0, 8)}`));
  }

  /* ═════════ Shift (hero) ═════════ */
  function heroHtml(d) {
    const s = d.state;
    const c = d.config;
    const pending = d.proposals.filter((p) => p.status === 'pending').length;
    const live = c.live;
    const share = live?.cap ? Math.min(100, Math.round(((live.calls || 0) / live.cap) * 100)) : 0;
    const telegram = s.paired ? `<b>${c.bot?.username ? `@${esc(c.bot.username)}` : 'დაკავშირებულია'}</b>` : '<b class="is-warn">არ არის დაკავშირებული</b>';
    return `<section class="dr-hero${s.active ? ' is-on' : ''}" aria-label="ცვლა">
      <div class="dr-hero-main">
        <span class="dr-orb" aria-hidden="true">${ico('director')}</span>
        <div class="dr-hero-copy">
          <h2>${s.active ? 'დირექტორი ცვლაზეა' : 'ცვლა შენთანაა'}</h2>
          <p>${s.active
            ? `${esc(span(s.activatedAt))}-ია მუშაობს · ჩაიბარა ${esc(when(s.activatedAt))}. ყველაფერს შენი თანხმობით აკეთებს.`
            : 'წასვლისას ჩააბარე ცვლა: დირექტორი მიხედავს MEDICARD-ს, უპასუხებს მარტივ წერილებს და ყოველ ქმედებაზე გკითხავს.'}</p>
        </div>
        <button type="button" class="dr-switch" role="switch" aria-checked="${s.active}" data-shift>
          <span class="dr-switch-track"><i></i></span>
          <span class="dr-switch-label">${s.active ? 'ცვლის დაბრუნება' : 'ცვლის ჩაბარება'}</span>
        </button>
      </div>
      <dl class="dr-facts">
        <div><dt>ბოლოს იმუშავა</dt><dd title="${esc(s.lastBrainAt ? when(s.lastBrainAt) : '')}"><b>${s.lastBrainAt ? esc(ago(s.lastBrainAt)) : 'ჯერ არა'}</b></dd></div>
        <div><dt>ტელეგრამი</dt><dd>${telegram}</dd></div>
        <div class="dr-fact-ai"><dt>AI დღეს</dt><dd>${live ? `<b>${fmt(live.calls ?? 0)}</b><span>/ ${fmt(live.cap)}</span><span class="s-meter${share > 80 ? ' is-warn' : ''}" title="${share}% დღის ლიმიტიდან"><i style="width:${share}%"></i></span>` : '<b class="is-warn">გამორთულია</b>'}</dd></div>
        <div><dt>თანხმობას ელოდება</dt><dd>${pending ? `<button type="button" class="dr-fact-link" data-jump="queue"><b class="is-accent">${fmt(pending)}</b> შეთავაზება</button>` : '<b>არაფერი</b>'}</dd></div>
      </dl>
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
        action: botOk ? `<button type="button" class="btn compact ${c.webhook?.set ? 'ghost' : ''}" data-webhook>${c.webhook?.set ? 'თავიდან' : 'მიერთება'}</button>` : '',
      },
      {
        done: s.paired,
        title: 'შენი ტელეგრამი',
        hint: s.paired ? 'დირექტორი მხოლოდ ამ ჩატს პასუხობს.' : 'გაიხსნება ბოტი — დააჭირე Start.',
        action: s.paired ? '<button type="button" class="btn compact ghost" data-unpair>გათიშვა</button>'
          : (botOk && c.webhook?.set ? '<button type="button" class="btn compact" data-pair>დაკავშირება</button>' : ''),
      },
      {
        done: Boolean(c.live),
        title: '24/7 დირექტორი',
        hint: c.live
          ? `ცვლაზე ტელეგრამსა და მხარდაჭერის წერილებს წამებში პასუხობს. დღეს ${fmt(c.live.calls ?? 0)} / ${fmt(c.live.cap)} AI მოთხოვნა.${c.live.model ? ` <span class="dr-model" title="AI მოდელი">${esc(c.live.model)}</span>` : ''}`
          : envHint('OPENROUTER_API_KEY'),
      },
    ];
  }

  function setupBanner(left) {
    if (!left) return '';
    return `<div class="s-callout is-warn dr-setup-banner">${ico('alert')}<p><b>დაყენება დაუსრულებელია — დარჩა ${left} ნაბიჯი.</b> მანამდე დირექტორი სრულად ვერ იმუშავებს.</p><button type="button" class="btn compact" data-open-tab="setup">დაყენების გახსნა</button></div>`;
  }

  /* ═════════ Decisions queue ═════════ */
  function proposalCard(p, d) {
    const [label, cls] = STATUS[p.status] || ['უცნობი', 'is-plain'];
    const pending = p.status === 'pending';
    const isMail = p.kind === 'email';
    const e = isMail ? emailParts(p) : null;
    const open = expanded.has(p.id);
    const raw = isMail ? e.draft : cleanBody(p.body);
    const long = raw.length > 640 || raw.split('\n').length > 12;
    const clamp = long && !open ? ' is-clamped' : '';
    const content = isMail
      ? `${e.summary ? `<p class="dr-p-summary">${esc(e.summary)}</p>` : ''}
         ${e.reason ? `<p class="dr-p-why"><b>რატომ შენთან:</b> ${esc(e.reason)}</p>` : ''}
         ${e.draft ? `<div class="dr-p-draft${clamp}"><span>პასუხის პროექტი</span><pre>${esc(e.draft)}</pre></div>` : ''}`
      : `<div class="dr-p-body s-chat-md${clamp}">${bodyHtml(p.body)}</div>`;
    return `<article class="dr-proposal${pending ? ' is-pending' : ''}" id="dr-p-${esc(p.id)}" data-proposal="${esc(p.id)}">
      <header>
        <span class="dr-p-icon is-${esc(p.kind)}">${ico(KIND_ICON[p.kind] || 'spark')}</span>
        <div class="dr-p-title"><b>${esc(p.title)}</b><small>${esc(KIND[p.kind] || 'შეთავაზება')} · <time title="${esc(when(p.createdAt))}">${esc(ago(p.createdAt))}</time></small></div>
        ${pending ? '' : `<span class="s-badge ${cls}">${esc(label)}</span>`}
      </header>
      ${content}
      ${long ? `<button type="button" class="dr-more" data-more="${esc(p.id)}" aria-expanded="${open}">${open ? 'შეკეცვა' : 'სრულად ნახვა'}</button>` : ''}
      ${p.ownerNote ? `<p class="dr-note"><b>შენი შენიშვნა:</b> ${esc(p.ownerNote)}</p>` : ''}
      ${p.result ? `<p class="dr-note"><b>შედეგი:</b> ${esc(p.result)}</p>` : ''}
      ${pending ? `<footer class="dr-p-actions">
          <button type="button" class="btn primary compact" data-decide="${esc(p.id)}" data-approve="1">${ico('check')}<span>${isMail ? 'თანხმობა — გაგზავნა' : 'თანხმობა'}</span></button>
          <button type="button" class="btn compact" data-reject="${esc(p.id)}">${ico('x')}<span>უარი</span></button>
          ${e?.threadId ? `<a class="dr-p-link" href="#/support?tab=inbox&thread=${encodeURIComponent(e.threadId)}">${ico('mail')}საუბრის გახსნა</a>` : ''}
        </footer>` : (e?.threadId ? `<footer class="dr-p-actions"><a class="dr-p-link" href="#/support?tab=inbox&thread=${encodeURIComponent(e.threadId)}">${ico('mail')}საუბრის გახსნა</a></footer>` : '')}
    </article>`;
  }

  function queueHtml(d) {
    const pending = d.proposals.filter((p) => p.status === 'pending');
    const kinds = [...new Set(pending.map((p) => p.kind))];
    if (ui.queueKind !== 'all' && !kinds.includes(ui.queueKind)) ui.queueKind = 'all';
    const shown = ui.queueKind === 'all' ? pending : pending.filter((p) => p.kind === ui.queueKind);
    return `<section class="dr-queue" id="dr-queue" aria-label="შენი გადასაწყვეტი">
      <header class="dr-sec-head">
        <div><h3>შენი გადასაწყვეტი${pending.length ? ` <i>${fmt(pending.length)}</i>` : ''}</h3><p>დირექტორი დაუდასტურებლად არაფერს აკეთებს. იგივე ღილაკები ტელეგრამშიც მოდის.</p></div>
        ${kinds.length > 1 ? `<div class="s-segment dr-kinds" role="tablist" aria-label="ტიპი">${[['all', 'ყველა', pending.length], ...kinds.map((k) => [k, KIND[k] || 'სხვა', pending.filter((p) => p.kind === k).length])].map(([k, l, n]) => `<button type="button" role="tab" data-queue-kind="${esc(k)}" aria-selected="${ui.queueKind === k}">${esc(l)}<i>${fmt(n)}</i></button>`).join('')}</div>` : ''}
      </header>
      ${shown.length ? `<div class="dr-queue-list">${shown.map((p) => proposalCard(p, d)).join('')}</div>`
        : `<div class="dr-queue-empty">${ico('check')}<div><b>რიგი ცარიელია</b><span>ახალი შეთავაზება აქაც და ტელეგრამშიც გამოჩნდება.</span></div></div>`}
    </section>`;
  }

  /* ═════════ Conversation ═════════ */
  function chatHtml(d) {
    const msgs = d.messages.slice(-60);
    let lastDay = '';
    const rows = msgs.map((m) => {
      const day = dayOf(m.createdAt);
      const sep = day !== lastDay ? `<div class="dr-day"><span>${esc(day)}</span></div>` : '';
      lastDay = day;
      if (m.direction === 'system') {
        return `${sep}<div class="dr-msg is-system"><span>${esc(m.text)}</span><time title="${esc(when(m.createdAt))}">${esc(clock(m.createdAt))}</time></div>`;
      }
      if (m.direction === 'owner') {
        return `${sep}<div class="dr-msg is-owner"><div class="dr-bubble">${ownerText(m.text, d.proposals)}</div><span class="dr-msg-meta"><time title="${esc(when(m.createdAt))}">${esc(clock(m.createdAt))}</time>${m.handledAt ? '' : ' · <b class="dr-wait">ჯერ არ უპასუხია</b>'}</span></div>`;
      }
      return `${sep}<div class="dr-msg is-director"><span class="dr-avatar" aria-hidden="true">${ico('director')}</span><div><div class="dr-say s-chat-md">${directorText(m.text, d.proposals)}</div><span class="dr-msg-meta"><time title="${esc(when(m.createdAt))}">${esc(clock(m.createdAt))}</time></span></div></div>`;
    }).join('');
    return `<section class="dr-chat-card" aria-label="საუბარი დირექტორთან">
      <header class="dr-sec-head"><div><h3>საუბარი</h3><p>იგივე, რაც ტელეგრამში — აქ დაწერილზეც იქ გიპასუხებს.</p></div></header>
      ${msgs.length ? `<div class="dr-chat" data-chat>${rows}</div>` : `<div class="dr-chat is-empty" data-chat><div class="s-empty">${ico('message')}<strong>ჯერ არაფერი</strong><span>ჩააბარე ცვლა ან მიწერე.</span></div></div>`}
      <div class="dr-compose">
        <textarea data-say rows="1" maxlength="4000" placeholder="მიწერე დირექტორს…" aria-label="მესიჯი დირექტორს"></textarea>
        <button type="button" class="dr-send" data-send title="გაგზავნა (Enter)" aria-label="გაგზავნა">${ico('send')}</button>
      </div>
    </section>`;
  }

  /* ═════════ Tabs ═════════ */
  function tabCount(key, d) {
    if (key === 'plan') return (d.initiatives || []).filter((i) => !['done', 'dropped'].includes(i.status)).length;
    if (key === 'reports') return (d.reports || []).length;
    if (key === 'history') return d.proposals.filter((p) => p.status !== 'pending').length;
    if (key === 'memory') return (d.memory || []).length;
    return 0;
  }

  const dots = (n, label) => {
    const v = Math.max(0, Math.min(5, Number(n) || 0));
    return `<span class="dr-dots" title="${esc(label)}: ${v} / 5" aria-label="${esc(label)}: ${v} / 5"><em>${esc(label)}</em>${[1, 2, 3, 4, 5].map((i) => `<i class="${i <= v ? 'is-on' : ''}"></i>`).join('')}</span>`;
  };

  function initiativeCard(i) {
    const lines = [
      i.hypothesis && ['ჰიპოთეზა', i.hypothesis],
      i.plan && ['გეგმა', i.plan],
      (i.metric || i.target) && ['საზომი', `${i.metric || ''}${i.target ? ` → ${i.target}` : ''}`],
      i.progress && ['პროგრესი', i.progress],
      i.result && ['შედეგი', i.result],
    ].filter(Boolean);
    const statusBadge = i.status === 'dropped' ? '<span class="s-badge is-bad">შეწყდა</span>'
      : i.status === 'done' ? '<span class="s-badge is-ok">დასრულდა</span>'
        : i.status === 'approved' ? '<span class="s-badge is-info">დამტკიცდა</span>'
          : i.status === 'active' ? '<span class="s-badge is-accent">მუშაობს</span>' : '';
    const hint = i.result || i.progress || '';
    return `<details class="dr-init" data-keep="init:${esc(i.id)}"><summary>
        <b>${esc(i.title)}</b>
        <span class="dr-init-meta"><span class="dr-area">${esc(AREA[i.area] || humanize(i.area))}</span>${statusBadge}</span>
        <span class="dr-init-score">${dots(i.impact, 'გავლენა')}${dots(i.effort, 'ძალისხმევა')}</span>
        ${hint ? `<span class="dr-init-hint">${esc(hint)}</span>` : ''}
      </summary>
      ${lines.length ? `<dl class="dr-init-body">${lines.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>` : '<p class="dr-init-body is-empty">დეტალები ჯერ არ ჩაუწერია.</p>'}
    </details>`;
  }

  function goalsHtml(d) {
    const goals = (d.memory || []).find((m) => m.key === 'goals') || (d.memory || []).find((m) => m.key === 'strategy');
    if (!goals) return '';
    const parsed = parseJson(goals.value);
    const items = parsed && !Array.isArray(parsed)
      ? Object.entries(parsed).map(([k, v]) => `<li><span>${esc(FIELD_KEYS[k] || humanize(k))}</span><b>${isScalar(v) ? esc(scalar(v, k)) : esc(JSON.stringify(v))}</b></li>`).join('')
      : '';
    return `<div class="dr-goals">${ico('zap')}<div><b>${esc(MEMORY_KEYS[goals.key] || 'მიზნები')}</b>${items ? `<ul>${items}</ul>` : `<p>${esc(goals.value)}</p>`}</div></div>`;
  }

  function planHtml(d) {
    const list = d.initiatives || [];
    if (!list.length) return `${goalsHtml(d)}<div class="s-empty">${ico('spark')}<strong>გეგმა ჯერ ცარიელია</strong><span>დირექტორი პირველ იდეებს დილის სესიაზე ჩაწერს.</span></div>`;
    const cols = COLUMNS.map(([label, statuses, cls]) => {
      const items = list.filter((i) => statuses.includes(i.status));
      return `<div class="dr-col ${cls}"><header><span>${esc(label)}</span><i>${fmt(items.length)}</i></header>
        ${items.length ? items.map(initiativeCard).join('') : '<div class="dr-col-empty">ჯერ არაფერი</div>'}</div>`;
    }).join('');
    return `${goalsHtml(d)}<p class="dr-tab-lead">იდეა → შენი თანხმობა → მუშაობა → შედეგი. ბარათზე დააჭირე — ჩანს ჰიპოთეზა, გეგმა, საზომი და პროგრესი.</p><div class="dr-board">${cols}</div>`;
  }

  function reportsHtml(d) {
    const list = d.reports || [];
    if (!list.length) return `<div class="s-empty">${ico('file')}<strong>ანგარიშები ჯერ არ არის</strong><span>პირველი დილის სესიის შემდეგ გამოჩნდება.</span></div>`;
    if (!list.some((r) => r.id === ui.reportId)) ui.reportId = list[0].id;
    const r = list.find((x) => x.id === ui.reportId);
    return `<div class="dr-reader">
      <nav class="dr-reader-list" aria-label="ანგარიშები">${list.map((x) => `<button type="button" class="dr-report-item${x.id === r.id ? ' is-active' : ''}" data-report="${esc(x.id)}" aria-current="${x.id === r.id}">
          <span class="dr-kind">${esc(REPORT_KIND[x.kind] || 'ანგარიში')}</span><b>${esc(x.title)}</b><time>${esc(when(x.createdAt))}</time></button>`).join('')}</nav>
      <article class="dr-reader-body" data-reader>
        <header><span class="dr-kind">${esc(REPORT_KIND[r.kind] || 'ანგარიში')}</span><h3>${esc(r.title)}</h3><time>${esc(when(r.createdAt))}</time></header>
        <div class="s-chat-md">${md(r.body)}</div>
      </article>
    </div>`;
  }

  function journalHtml(d) {
    const all = d.journal || [];
    const kinds = Object.keys(JOURNAL_KIND).filter((k) => all.some((j) => j.kind === k));
    if (ui.journalKind !== 'all' && !kinds.includes(ui.journalKind)) ui.journalKind = 'all';
    const list = ui.journalKind === 'all' ? all : all.filter((j) => j.kind === ui.journalKind);
    let lastDay = '';
    const rows = list.map((j) => {
      const day = dayOf(j.createdAt);
      const head = day !== lastDay ? `<li class="dr-log-day">${esc(day)}</li>` : '';
      lastDay = day;
      const [label, icon] = JOURNAL_KIND[j.kind] || ['ჩანაწერი', 'edit'];
      return `${head}<li class="dr-log is-${esc(j.kind)}"><time title="${esc(when(j.createdAt))}">${esc(clock(j.createdAt))}</time><span class="dr-log-icon" title="${esc(label)}">${ico(icon)}</span><span>${esc(j.summary)}</span></li>`;
    }).join('');
    return `${kinds.length > 1 ? `<div class="s-segment dr-filter" role="tablist" aria-label="ჩანაწერის ტიპი">${[['all', 'ყველა'], ...kinds.map((k) => [k, JOURNAL_KIND[k][0]])].map(([k, l]) => `<button type="button" role="tab" data-journal-kind="${esc(k)}" aria-selected="${ui.journalKind === k}">${esc(l)}</button>`).join('')}</div>` : ''}
      ${list.length ? `<ol class="dr-journal">${rows}</ol>` : `<div class="s-empty">${ico('file')}<strong>ჟურნალი ცარიელია</strong></div>`}`;
  }

  function historyHtml(d) {
    const decided = d.proposals.filter((p) => p.status !== 'pending');
    const statuses = Object.keys(STATUS).filter((k) => k !== 'pending' && decided.some((p) => p.status === k));
    if (ui.historyStatus !== 'all' && !statuses.includes(ui.historyStatus)) ui.historyStatus = 'all';
    const list = ui.historyStatus === 'all' ? decided : decided.filter((p) => p.status === ui.historyStatus);
    return `${statuses.length > 1 ? `<div class="s-segment dr-filter" role="tablist" aria-label="შედეგი">${[['all', 'ყველა'], ...statuses.map((k) => [k, STATUS[k][0]])].map(([k, l]) => `<button type="button" role="tab" data-history-status="${esc(k)}" aria-selected="${ui.historyStatus === k}">${esc(l)}<i>${fmt(k === 'all' ? decided.length : decided.filter((p) => p.status === k).length)}</i></button>`).join('')}</div>` : ''}
      ${list.length ? `<div class="dr-history">${list.map((p) => {
        const [label, cls] = STATUS[p.status] || ['უცნობი', 'is-plain'];
        return `<details class="dr-hist" data-keep="hist:${esc(p.id)}" data-proposal="${esc(p.id)}"><summary>
            <span class="dr-p-icon is-${esc(p.kind)}">${ico(KIND_ICON[p.kind] || 'spark')}</span>
            <b>${esc(p.title)}</b>
            <span class="s-badge ${cls}">${esc(label)}</span>
            <time title="${esc(when(p.decidedAt || p.updatedAt || p.createdAt))}">${esc(dayOf(p.decidedAt || p.updatedAt || p.createdAt))}</time>
          </summary>
          <div class="dr-hist-body">
            ${p.ownerNote ? `<p class="dr-note"><b>შენი შენიშვნა:</b> ${esc(p.ownerNote)}</p>` : ''}
            ${p.result ? `<p class="dr-note"><b>შედეგი:</b> ${esc(p.result)}</p>` : ''}
            <div class="s-chat-md">${bodyHtml(p.body)}</div>
          </div></details>`;
      }).join('')}</div>` : `<div class="s-empty">${ico('check')}<strong>გადაწყვეტილი შეთავაზება ჯერ არ არის</strong></div>`}`;
  }

  function memoryHtml(d) {
    const mem = d.memory || [];
    if (!mem.length) return `<div class="s-empty">${ico('file')}<strong>მეხსიერება ცარიელია</strong><span>დირექტორი აქ იწერს მიზნებს, შენს წესებს და კვირის რიცხვებს.</span></div>`;
    return `<p class="dr-tab-lead">რაც დირექტორს ახსოვს შენზე და MEDICARD-ზე. მას თვითონ წერს და ანახლებს.</p>
      <div class="dr-mem-grid">${mem.map((m) => `<article class="dr-mem">
        <header><b title="${esc(m.key)}">${esc(MEMORY_KEYS[m.key] || humanize(m.key))}</b>${m.updatedAt ? `<time title="${esc(when(m.updatedAt))}">${esc(dayOf(m.updatedAt))}</time>` : ''}</header>
        ${memValueHtml(m.value, m.key)}</article>`).join('')}</div>`;
  }

  function setupHtml(d) {
    const list = steps(d);
    const pair = pairing && !d.state.paired
      ? `<div class="s-callout is-ok dr-pair">${ico('send')}<p>გახსენი <a href="${esc(pairing.link)}" target="_blank" rel="noopener">${esc(pairing.link)}</a> და დააჭირე Start. კოდი <b>${esc(pairing.code)}</b> მოქმედებს 10 წუთი.</p></div>`
      : '';
    return `<p class="dr-tab-lead">ერთხელ გასაკეთებელი. გასაღებები Render-შია და აქ არასდროს ჩანს.</p>
      <div class="dr-steps">${list.map((x, i) => `<div class="dr-step ${x.done ? 'is-done' : ''}">
        <span class="dr-step-n">${x.done ? ico('check') : i + 1}</span>
        <div><b>${esc(x.title)}</b><small>${x.hint}</small></div>
        <div class="dr-step-aside">${x.action || ''}${x.done ? '<span class="s-badge is-ok">მზადაა</span>' : '<span class="s-badge is-warn">საჭიროა</span>'}</div>
      </div>`).join('')}</div>${pair}`;
  }

  function tabsHtml(d, left) {
    const pane = { plan: planHtml, reports: reportsHtml, journal: journalHtml, history: historyHtml, memory: memoryHtml, setup: setupHtml }[ui.tab] || planHtml;
    return `<section class="dr-tabs" aria-label="დირექტორის სამუშაო">
      <div class="s-tabbar"><nav class="v3-subnav" role="tablist" aria-label="განყოფილებები">${TABS.map(([k, l]) => {
        const n = tabCount(k, d);
        const badge = k === 'setup' ? (left ? `<i class="is-warn">${left}</i>` : '') : n ? `<i>${fmt(n)}</i>` : '';
        return `<button type="button" role="tab" class="v3-subnav-btn${ui.tab === k ? ' is-active' : ''}" aria-selected="${ui.tab === k}" data-tab-key="${k}">${l}${badge}</button>`;
      }).join('')}</nav></div>
      <div class="dr-pane is-${esc(ui.tab)}" role="tabpanel">${pane(d)}</div>
    </section>`;
  }

  const workspace = () => doc.querySelector('.workspace');

  function writeHash() {
    const p = typeof global.hashSearch === 'function' ? global.hashSearch() : new URLSearchParams(location.hash.split('?')[1] || '');
    p.set('tab', ui.tab);
    const next = `#/director?${p.toString()}`;
    if (location.hash !== next) history.replaceState({ tab: 'director' }, '', next);
  }

  function paint(root) {
    root.querySelectorAll('details[data-keep]').forEach((el) => openState.set(el.dataset.keep, el.open));
    const chat = root.querySelector('[data-chat]');
    const chatTop = chat ? chat.scrollTop : null;
    const chatAtEnd = !chat || chat.scrollHeight - chat.scrollTop - chat.clientHeight < 40;
    const reader = root.querySelector('[data-reader]');
    const readerTop = reader ? reader.scrollTop : 0;
    const ws = workspace();
    const pageTop = ws && root.querySelector('.dr-page') ? ws.scrollTop : null;
    const draft = root.querySelector('[data-say]')?.value || '';
    const left = steps(data).filter((x) => !x.done).length;
    root.innerHTML = `<div class="dr-page">
      ${heroHtml(data)}
      ${setupBanner(left)}
      <div class="dr-grid">${queueHtml(data)}${chatHtml(data)}</div>
      ${tabsHtml(data, left)}
    </div>`;
    root.querySelectorAll('details[data-keep]').forEach((el) => {
      if (openState.has(el.dataset.keep)) el.open = openState.get(el.dataset.keep);
    });
    const nextChat = root.querySelector('[data-chat]');
    if (nextChat) nextChat.scrollTop = chatAtEnd || chatTop == null ? nextChat.scrollHeight : chatTop;
    const nextReader = root.querySelector('[data-reader]');
    if (nextReader) nextReader.scrollTop = readerTop;
    if (ws && pageTop != null) ws.scrollTop = pageTop;
    const say = root.querySelector('[data-say]');
    if (say) { say.value = draft; growSay(say); }
    bind(root);
  }

  const repaint = () => { const root = $('tab-director'); if (root && data) paint(root); };

  /** Runs an action, repaints and reports; resolves true when it went through. */
  async function act(fn, okMsg) {
    try {
      const next = await fn();
      if (next && next.state) data = next;
      if (okMsg) toast(okMsg, 'ok');
      repaint();
      return true;
    } catch (e) {
      toast(e.message || 'ვერ შესრულდა', 'bad');
      return false;
    }
  }

  function gotoProposal(root, id) {
    let item = root.querySelector(`.dr-queue [data-proposal="${CSS.escape(id)}"]`);
    if (!item) {
      const p = data.proposals.find((x) => x.id === id);
      if (p && p.status !== 'pending') {
        ui.tab = 'history';
        ui.historyStatus = 'all';
        openState.set(`hist:${id}`, true);
        writeHash();
        repaint();
        item = $('tab-director')?.querySelector(`.dr-history [data-proposal="${CSS.escape(id)}"]`);
      } else if (p) {
        ui.queueKind = 'all';
        repaint();
        item = $('tab-director')?.querySelector(`.dr-queue [data-proposal="${CSS.escape(id)}"]`);
      }
    }
    if (!item) return;
    item.scrollIntoView({ behavior: 'smooth', block: 'center' });
    item.classList.remove('is-flash');
    void item.offsetWidth;
    item.classList.add('is-flash');
  }

  function growSay(ta) {
    ta.style.height = 'auto';
    ta.style.height = `${Math.min(160, Math.max(40, ta.scrollHeight + 2))}px`;
  }

  function openReject(id) {
    const p = data.proposals.find((x) => x.id === id);
    if (!p) return;
    const dlg = V().openDialog?.({
      title: 'უარი შეთავაზებაზე',
      description: `„${p.title}“`,
      body: `<div class="s-stack">
        <label class="s-field"><span>რატომ? (არასავალდებულო)</span><textarea id="dr-reject-note" rows="4" maxlength="2000" placeholder="მაგ.: ახლა არა, ბიუჯეტი MEDIRUN-ის ყუთებზე მიდის"></textarea><small>დირექტორი ამას დაიმახსოვრებს და შემდეგ ჯერზე გაითვალისწინებს.</small></label>
      </div>`,
      footer: '<button type="button" class="btn secondary" id="dr-reject-cancel">გაუქმება</button><button type="button" class="btn danger" id="dr-reject-ok">უარი</button>',
      watchDirty: false,
    });
    $('dr-reject-note')?.focus();
    $('dr-reject-cancel').onclick = () => dlg?.close();
    $('dr-reject-ok').onclick = async (e) => {
      const btn = e.currentTarget;
      btn.disabled = true;
      const note = $('dr-reject-note').value.trim();
      const ok = await act(() => api(`/proposals/${encodeURIComponent(id)}/decide`, { method: 'POST', body: { approve: false, ...(note ? { note } : {}) } }), 'უარყოფილია');
      if (ok) dlg?.close();
      else btn.disabled = false; // the rejection did not go through: the dialog stays so the admin can retry
    };
  }

  function bind(root) {
    root.querySelector('[data-shift]')?.addEventListener('click', (e) => {
      const on = !data.state.active;
      e.currentTarget.disabled = true;
      void act(() => api('/shift', { method: 'PUT', body: { active: on } }), on ? 'ცვლა ჩაბარდა' : 'ცვლა დაგიბრუნდა');
    });
    root.querySelector('[data-jump="queue"]')?.addEventListener('click', () => $('dr-queue')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
    root.querySelectorAll('[data-open-tab]').forEach((b) => b.addEventListener('click', () => {
      ui.tab = b.dataset.openTab;
      writeHash();
      repaint();
      $('tab-director')?.querySelector('.dr-tabs')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }));
    root.querySelectorAll('[data-tab-key]').forEach((b) => b.addEventListener('click', () => { ui.tab = b.dataset.tabKey; writeHash(); repaint(); }));
    root.querySelectorAll('[data-queue-kind]').forEach((b) => b.addEventListener('click', () => { ui.queueKind = b.dataset.queueKind; repaint(); }));
    root.querySelectorAll('[data-history-status]').forEach((b) => b.addEventListener('click', () => { ui.historyStatus = b.dataset.historyStatus; repaint(); }));
    root.querySelectorAll('[data-journal-kind]').forEach((b) => b.addEventListener('click', () => { ui.journalKind = b.dataset.journalKind; repaint(); }));
    root.querySelectorAll('[data-report]').forEach((b) => b.addEventListener('click', () => {
      ui.reportId = b.dataset.report;
      repaint();
      const body = $('tab-director')?.querySelector('[data-reader]');
      if (body) { body.scrollTop = 0; if (global.matchMedia?.('(max-width: 900px)').matches) body.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
    }));
    root.querySelector('[data-webhook]')?.addEventListener('click', () => void act(async () => {
      const r = await api('/telegram/webhook', { method: 'POST' });
      toast(r.lastError ? 'ტელეგრამმა შეცდომა დააბრუნა — სცადე ცოტა ხანში თავიდან' : 'ბოტი მიერთდა', r.lastError ? 'warn' : 'ok');
      return api('');
    }));
    root.querySelector('[data-pair]')?.addEventListener('click', () => {
      // Open the tab inside the click (popup blockers refuse a window opened after the request) and point it at the link.
      const win = global.open?.('', '_blank');
      void act(async () => {
        try {
          pairing = await api('/telegram/pair', { method: 'POST' });
        } catch (e) {
          win?.close();
          throw e;
        }
        if (win) { win.opener = null; win.location = pairing.link; } else global.open?.(pairing.link, '_blank', 'noopener');
        return api('');
      });
    });
    root.querySelector('[data-unpair]')?.addEventListener('click', () => V().openConfirm?.({
      title: 'ტელეგრამის გათიშვა?',
      message: 'დირექტორი ტელეგრამში აღარ მოგწერს, სანამ ხელახლა არ დააკავშირებ.',
      confirmLabel: 'გათიშვა',
      variant: 'danger',
      onConfirm: () => act(() => { pairing = null; return api('/telegram/unpair', { method: 'POST' }); }, 'ტელეგრამი გაითიშა'),
    }));
    root.querySelectorAll('[data-decide]').forEach((b) => b.addEventListener('click', () => {
      b.disabled = true;
      b.classList.add('is-loading');
      void act(() => api(`/proposals/${encodeURIComponent(b.dataset.decide)}/decide`, { method: 'POST', body: { approve: true } }), 'დადასტურდა');
    }));
    root.querySelectorAll('[data-reject]').forEach((b) => b.addEventListener('click', () => openReject(b.dataset.reject)));
    root.querySelectorAll('[data-more]').forEach((b) => b.addEventListener('click', () => {
      const id = b.dataset.more;
      if (expanded.has(id)) expanded.delete(id); else expanded.add(id);
      repaint();
    }));
    root.querySelectorAll('[data-goto]').forEach((b) => b.addEventListener('click', () => gotoProposal(root, b.dataset.goto)));
    const say = root.querySelector('[data-say]');
    const send = () => {
      const text = say.value.trim();
      if (!text) return;
      say.value = '';
      growSay(say);
      void act(() => api('/message', { method: 'POST', body: { text } }));
    };
    root.querySelector('[data-send]')?.addEventListener('click', send);
    say?.addEventListener('input', () => growSay(say));
    // Like Telegram: Enter sends, Shift+Enter starts a new line.
    say?.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); send(); } });
  }

  /** The owner is selecting text to copy — a refresh now would drop the selection. */
  function selecting(root) {
    const sel = global.getSelection?.();
    return Boolean(sel && !sel.isCollapsed && sel.anchorNode && root.contains(sel.anchorNode));
  }

  async function renderDirector() {
    const root = $('tab-director');
    if (!root) return;
    const p = typeof global.hashSearch === 'function' ? global.hashSearch() : new URLSearchParams(location.hash.split('?')[1] || '');
    if (TABS.some(([k]) => k === p.get('tab'))) ui.tab = p.get('tab');
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
    writeHash();
    paint(root);
    clearInterval(pollTimer);
    // The tab stays painted when the owner leaves and comes back, so the timer keeps running and only
    // skips its turn while the page is hidden, a dialog is open, the owner types or selects text.
    pollTimer = setInterval(() => {
      const r = $('tab-director');
      if (!r) { clearInterval(pollTimer); return; }
      if (r.classList.contains('hidden') || doc.hidden || $('v3-dialog')) return;
      if (doc.activeElement?.matches?.('[data-say]') || selecting(r)) return;
      api('').then((d) => { data = d; paint(r); }).catch(() => {});
    }, 20000);
  }

  global.renderDirector = renderDirector;
  global.AdminV4Director = { renderDirector };
})(window);
