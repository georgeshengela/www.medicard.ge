/**
 * MediCard Admin V4 — #/director დირექტორი (/api/admin/director).
 * The owner hands the shift to the Director („ცვლის ჩაბარება“) and takes it back. While on shift
 * the Director (Claude Code routine) reads aggregate metrics, writes to the owner on Telegram and
 * queues proposals; nothing is executed until the owner approves (here or with the Telegram buttons).
 * Layout lives in v4/director.css; surfaces come from the s-* components.
 */
(function adminV4Director(global) {
  const doc = document;
  const $ = (id) => doc.getElementById(id);
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const ico = (n) => (typeof global.icon === 'function' ? global.icon(n) : '');
  const TBILISI = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Tbilisi', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false });
  const when = (iso) => {
    if (!iso) return '—';
    const p = Object.fromEntries(TBILISI.formatToParts(new Date(iso)).map((x) => [x.type, x.value]));
    return `${p.day}.${p.month} · ${p.hour}:${p.minute}`;
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
  const skel = () => `<div class="s-stack"><div class="v3-skel" aria-hidden="true">${'<i></i>'.repeat(6)}</div></div>`;

  const KIND = { decision: 'გადაწყვეტილება', post: 'პოსტი', email: 'მეილი', task: 'დავალება', team: 'გუნდი', change: 'ცვლილება' };
  const KIND_ICON = { decision: 'zap', post: 'image', email: 'mail', task: 'check', team: 'users', change: 'settings' };
  const STATUS = {
    pending: ['ელოდება', 'is-warn'], approved: ['დადასტურდა', 'is-info'], rejected: ['უარყოფილია', 'is-bad'],
    done: ['შესრულდა', 'is-ok'], expired: ['გაუქმდა', ''],
  };
  const FROM = { owner: 'შენ', director: 'დირექტორი', system: 'სისტემა' };

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
        <div class="s-metric"><span>სტატუსი</span><strong>${s.active ? 'მუშაობს' : 'პაუზა'}</strong><small>${s.active ? esc(s.activatedBy || '') : 'ცვლა შენთანაა'}</small></div>
        <div class="s-metric ${pending ? 'is-warn' : ''}"><span>თანხმობას ელოდება</span><strong>${pending}</strong><small>შეთავაზება</small></div>
        <div class="s-metric"><span>ბოლო მუშაობა</span><strong>${s.lastBrainAt ? esc(ago(s.lastBrainAt)) : '—'}</strong><small>${s.lastBrainAt ? esc(when(s.lastBrainAt)) : 'ჯერ არ უმუშავია'}</small></div>
        <div class="s-metric"><span>ტელეგრამი</span><strong>${s.paired ? 'ჩართული' : '—'}</strong><small>${d.config.bot?.username ? `@${esc(d.config.bot.username)}` : 'ბოტი არ არის'}</small></div>
      </div>
    </section>`;
  }

  function steps(d) {
    const c = d.config;
    const s = d.state;
    const botOk = c.telegram && !c.bot?.error;
    return [
      {
        done: botOk,
        title: 'ტელეგრამის ბოტი',
        hint: !c.telegram ? '@BotFather-ში შექმენი ბოტი და Render-ში ჩასვი <code>TELEGRAM_BOT_TOKEN</code>.'
          : c.bot?.error ? 'ტოკენი არ მუშაობს — შეამოწმე <code>TELEGRAM_BOT_TOKEN</code>.' : `@${esc(c.bot?.username || '')}`,
      },
      {
        done: c.brainToken,
        title: 'დირექტორის გასაღები',
        hint: c.brainToken ? 'Render-ში დაყენებულია.' : 'Render-ში <code>DIRECTOR_API_TOKEN</code> — შემთხვევითი, მინიმუმ 32 სიმბოლო.',
      },
      {
        done: Boolean(c.webhook?.set),
        title: 'ბოტის მიერთება სერვერზე',
        hint: c.webhook?.lastError ? `ბოლო შეცდომა: ${esc(c.webhook.lastError)}` : 'ერთი დაჭერა — ტელეგრამი შენს მესიჯებს medicard.ge-ზე გამოგზავნის.',
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
        hint: c.live ? `${esc(c.live.model)} · დღეს ${c.live.calls ?? 0}/${c.live.cap ?? '—'} AI მოთხოვნა. ცვლაზე წამებში პასუხობს და support-ს მართავს.` : 'Render-ში <code>OPENROUTER_API_KEY</code> არ არის.',
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
      return `<section class="s-card"><details class="s-details" style="border-top:0"><summary>გამართვა · ყველაფერი მზადაა</summary>
        <div style="padding:0">${stepRows(list)}</div></details></section>`;
    }
    const pair = pairing && !d.state.paired
      ? `<div class="s-callout is-ok dr-pair">${ico('send')}<p>გახსენი <a href="${esc(pairing.link)}" target="_blank" rel="noopener">${esc(pairing.link)}</a> და დააჭირე Start. კოდი <b>${esc(pairing.code)}</b> მოქმედებს 10 წუთი.</p></div>`
      : '';
    return `<section class="s-card">
      <header class="s-card-head"><div><h3>გამართვა · დარჩა ${left}</h3><p>ერთხელ გასაკეთებელი. ტოკენები Render-ის env-შია და აქ არასოდეს ჩანს.</p></div></header>
      <div class="s-card-body is-flush">${stepRows(list)}</div>${pair}
    </section>`;
  }

  function proposalItem(p) {
    const [label, cls] = STATUS[p.status] || [p.status, ''];
    return `<article class="s-feed-item dr-proposal">
      <span class="s-avatar">${ico(KIND_ICON[p.kind] || 'spark')}</span>
      <div>
        <header><b>${esc(p.title)}</b><span class="s-badge is-plain">${esc(KIND[p.kind] || p.kind)}</span><span class="s-badge ${cls}">${esc(label)}</span><span>${esc(when(p.createdAt))}</span></header>
        <p class="s-feed-body">${esc(p.body)}</p>
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
    return `<section class="s-card">
      <header class="s-card-head"><div><h3>შენს თანხმობას ელოდება${pending.length ? ` · ${pending.length}` : ''}</h3>
        <p>დირექტორი არაფერს აკეთებს დაუდასტურებლად. იგივე ღილაკები ტელეგრამშიც მოდის.</p></div></header>
      <div class="s-card-body is-flush">
        ${pending.length ? pending.map(proposalItem).join('') : `<div class="s-empty">${ico('check')}<strong>რიგი ცარიელია</strong><span>ახალი შეთავაზება აქაც და ტელეგრამშიც გამოჩნდება.</span></div>`}
      </div>
      ${rest.length ? `<details class="s-details"><summary>ისტორია · ${rest.length}</summary><div style="padding:0">${rest.map(proposalItem).join('')}</div></details>` : ''}
    </section>`;
  }

  function chatCard(d) {
    const msgs = d.messages.slice(-40);
    const bubble = (m) => `<div class="dr-msg${m.direction === 'owner' ? ' is-owner' : ''}${m.direction === 'system' ? ' is-system' : ''}">
        <span class="dr-msg-meta">${esc(FROM[m.direction] || m.direction)} · ${esc(when(m.createdAt))}${m.direction === 'owner' && !m.handledAt ? ' · ელოდება პასუხს' : ''}</span>
        <div class="dr-bubble">${esc(m.text)}</div></div>`;
    return `<section class="s-card">
      <header class="s-card-head"><div><h3>საუბარი</h3><p>იგივე, რაც ტელეგრამში. აქ დაწერილზეც ტელეგრამში გიპასუხებს.</p></div></header>
      ${msgs.length ? `<div class="dr-chat" data-chat>${msgs.map(bubble).join('')}</div>` : `<div class="s-empty">${ico('message')}<strong>ჯერ არაფერი</strong><span>ჩააბარე ცვლა ან მიწერე.</span></div>`}
      <div class="dr-compose">
        <textarea data-say rows="1" maxlength="4000" placeholder="მიწერე დირექტორს…" aria-label="მესიჯი დირექტორს"></textarea>
        <button type="button" class="btn primary" data-send>${ico('send')} გაგზავნა</button>
      </div>
    </section>`;
  }

  const AREA = { growth: 'ზრდა', marketing: 'მარკეტინგი', content: 'კონტენტი', product: 'პროდუქტი', retention: 'შენარჩუნება', partnerships: 'პარტნიორობა', analytics: 'ანალიტიკა', ops: 'ოპერაციები' };
  const COLUMNS = [
    ['იდეები', ['idea']],
    ['შენს თანხმობას ელოდება', ['proposed']],
    ['მიმდინარე', ['approved', 'active']],
    ['შედეგი', ['done', 'dropped']],
  ];
  const REPORT_KIND = { plan: 'დღის გეგმა', daily: 'ბრიფი', evening: 'საღამოს ანგარიში', weekly: 'კვირის ანგარიში', analysis: 'ანალიზი', research: 'კვლევა', content: 'კონტენტი' };

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
    return `<details class="dr-init"><summary><b>${esc(i.title)}</b>
        <div class="dr-init-meta"><span class="s-badge is-plain">${esc(AREA[i.area] || i.area)}</span><span class="s-badge is-plain" title="ეფექტი / ძალისხმევა">${i.impact}/${i.effort}</span>${statusBadge}</div></summary>
        ${lines ? `<div class="dr-init-body">${lines}</div>` : ''}</details>`;
  }

  function planCard(d) {
    const list = d.initiatives || [];
    const goals = (d.memory || []).find((m) => m.key === 'goals' || m.key === 'strategy');
    const cols = COLUMNS.map(([label, statuses]) => {
      const items = list.filter((i) => statuses.includes(i.status));
      return `<div class="dr-col"><header><span>${esc(label)}</span><i>${items.length}</i></header>
        ${items.length ? items.map(initiativeCard).join('') : '<div class="dr-col-empty">—</div>'}</div>`;
    }).join('');
    return `<section class="s-card">
      <header class="s-card-head"><div><h3>გეგმა</h3><p>დირექტორის ინიციატივები: იდეა → შენი ✅ → მუშაობა → შედეგი. ბარათს დააჭირე დეტალებისთვის.</p></div></header>
      ${goals ? `<div class="s-callout dr-goals">${ico('zap')}<p><b>მიზნები:</b>\n${esc(goals.value)}</p></div>` : ''}
      ${list.length ? `<div class="dr-board">${cols}</div>` : `<div class="s-empty">${ico('spark')}<strong>გეგმა ჯერ ცარიელია</strong><span>დირექტორი პირველ იდეებს დილის სესიაზე ჩაწერს.</span></div>`}
    </section>`;
  }

  function reportsCard(d) {
    const list = d.reports || [];
    return `<section class="s-card">
      <header class="s-card-head"><div><h3>ანგარიშები</h3><p>დღის გეგმები, საღამოს ანგარიშები, ანალიზი და კვლევა — რას აკეთებს და რას ფიქრობს დირექტორი.</p></div></header>
      <div class="s-card-body is-flush">
        ${list.length ? list.map((r, n) => `<details class="dr-report"${n === 0 ? ' open' : ''}><summary><span class="s-badge is-plain">${esc(REPORT_KIND[r.kind] || r.kind)}</span><b>${esc(r.title)}</b><time>${esc(when(r.createdAt))}</time></summary>
          <div class="dr-report-body">${esc(r.body)}</div></details>`).join('')
          : `<div class="s-empty">${ico('file')}<strong>ანგარიშები ჯერ არ არის</strong><span>პირველი დილის სესიის შემდეგ გამოჩნდება.</span></div>`}
      </div>
    </section>`;
  }

  function journalCard(d) {
    const mem = d.memory || [];
    return `<section class="s-card">
      <header class="s-card-head"><div><h3>ჟურნალი</h3><p>რას აკეთებდა დირექტორი და რა გადაწყდა.</p></div></header>
      <div class="s-card-body is-flush">
        ${d.journal.length ? d.journal.map((j) => `<div class="dr-log"><time>${esc(when(j.createdAt))}</time><span>${esc(j.summary)}</span></div>`).join('') : `<div class="s-empty">${ico('file')}<strong>ჟურნალი ცარიელია</strong></div>`}
      </div>
      ${mem.length ? `<details class="s-details"><summary>მეხსიერება · ${mem.length}</summary><div>${mem.map((m) => `<div class="dr-mem"><b>${esc(m.key)}</b><div>${esc(m.value)}</div></div>`).join('')}</div></details>` : ''}
    </section>`;
  }

  function paint(root) {
    const scroll = root.querySelector('[data-chat]')?.scrollTop;
    const draft = root.querySelector('[data-say]')?.value || '';
    const left = steps(data).filter((x) => !x.done && !x.optional).length;
    root.innerHTML = `<div class="s-stack">
      ${heroCard(data)}
      ${left ? setupCard(data, left) : ''}
      <div class="dr-grid">${proposalsCard(data)}${chatCard(data)}</div>
      ${planCard(data)}
      ${reportsCard(data)}
      ${journalCard(data)}
      ${left ? '' : setupCard(data, 0)}
    </div>`;
    const chat = root.querySelector('[data-chat]');
    if (chat) chat.scrollTop = scroll ?? chat.scrollHeight;
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

  function bind(root) {
    root.querySelector('[data-shift]')?.addEventListener('click', () => {
      const on = !data.state.active;
      void act(() => api('/shift', { method: 'PUT', body: { active: on } }), on ? 'ცვლა ჩაბარდა' : 'ცვლა დაგიბრუნდა');
    });
    root.querySelector('[data-webhook]')?.addEventListener('click', () => void act(async () => {
      const r = await api('/telegram/webhook', { method: 'POST' });
      toast(r.lastError ? `ტელეგრამი: ${r.lastError}` : 'ბოტი მიერთდა', r.lastError ? 'warn' : 'ok');
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

  async function renderDirector() {
    const root = $('tab-director');
    if (!root) return;
    if (!data) root.innerHTML = skel();
    try {
      data = await api('');
    } catch (err) {
      root.innerHTML = `<div class="s-card"><div class="s-empty">${ico('alert')}<strong>ვერ ჩაიტვირთა</strong><span>${esc(err?.message || '')}</span><button type="button" class="btn" data-retry>ხელახლა ცდა</button></div></div>`;
      root.querySelector('[data-retry]').onclick = renderDirector;
      return;
    }
    paint(root);
    clearInterval(pollTimer);
    pollTimer = setInterval(() => {
      const r = $('tab-director');
      const typing = doc.activeElement?.matches?.('[data-say]');
      if (!r || r.classList.contains('hidden') || doc.hidden || typing) {
        if (!r || r.classList.contains('hidden')) clearInterval(pollTimer);
        return;
      }
      api('').then((d) => { data = d; paint(r); }).catch(() => {});
    }, 20000);
  }

  global.renderDirector = renderDirector;
  global.AdminV4Director = { renderDirector };
})(window);
