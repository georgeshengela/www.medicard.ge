/**
 * MediCard Admin V4 — #/director დირექტორი (/api/admin/director).
 * The owner hands the shift to the Director („ცვლის ჩაბარება“) and takes it back. While on shift
 * the Director (Claude Code routine) reads aggregate metrics, writes to the owner on Telegram and
 * queues proposals; nothing is executed until the owner approves (here or with the Telegram buttons).
 */
(function adminV4Director(global) {
  const doc = document;
  const $ = (id) => doc.getElementById(id);
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const ico = (n) => (typeof global.icon === 'function' ? global.icon(n) : '');
  const when = (iso) => (iso ? new Date(iso).toLocaleString('ka-GE', { timeZone: 'Asia/Tbilisi', dateStyle: 'short', timeStyle: 'short' }) : '—');
  const api = (path, opts) => global.api(`/director${path}`, opts);
  const toast = (m, t) => global.toast?.(m, t);
  const skel = () => `<div class="s-stack"><div class="v3-skel" aria-hidden="true">${'<i></i>'.repeat(6)}</div></div>`;

  const KIND = { decision: 'გადაწყვეტილება', post: 'პოსტი', email: 'მეილი', task: 'დავალება', team: 'გუნდი', change: 'ცვლილება' };
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

  const check = (ok, label, hint) => `<div class="s-switch-row"><div><b>${ok ? '✅' : '⬜'} ${esc(label)}</b>${hint ? `<small>${hint}</small>` : ''}</div></div>`;

  function heroCard(d) {
    const s = d.state;
    const ready = d.config.telegram && s.paired && d.config.brainToken;
    return `<section class="s-card">
      <header class="s-card-head"><div>
        <h3>${s.active ? '🟢 დირექტორი ცვლაზეა' : '⚪ დირექტორი ცვლაზე არ არის'}</h3>
        <p>${s.active
          ? `ცვლა ჩაიბარა ${when(s.activatedAt)}-ზე (${esc(s.activatedBy || '')}). აკვირდება მეტრიკებს, გწერს ტელეგრამში და ყველაფერს შენი თანხმობით აკეთებს.`
          : 'როცა წახვალ, ჩააბარე ცვლა. დირექტორი მიხედავს MEDICARD-ს, დილით მოგწერს ბრიფს და ყველა ქმედებაზე ტელეგრამში გკითხავს.'}</p>
      </div></header>
      <div class="s-card-body" style="display:flex;flex-wrap:wrap;gap:14px;align-items:center">
        <button type="button" class="btn ${s.active ? '' : 'primary'}" data-shift style="min-width:220px;font-size:15px;padding:12px 22px">
          ${s.active ? 'ცვლის დაბრუნება' : 'ცვლის ჩაბარება'}
        </button>
        <span class="s-muted" style="font-size:12.5px">ბოლო მუშაობა: <b>${when(s.lastBrainAt)}</b> · ბოლო გაღვიძება: <b>${when(s.lastTriggerAt)}</b></span>
        ${ready ? '' : '<span class="s-badge is-warn">გამართვა დასასრულებელია ↓</span>'}
      </div>
    </section>`;
  }

  function setupCard(d) {
    const c = d.config;
    const s = d.state;
    const bot = c.bot?.username ? `@${esc(c.bot.username)}` : 'ბოტი';
    return `<section class="s-card">
      <header class="s-card-head"><div><h3>გამართვა</h3><p>ერთხელ გასაკეთებელი. ტოკენები Render-ის env-შია და აქ არასოდეს ჩანს.</p></div></header>
      <div class="s-card-body is-flush">
        ${check(c.telegram, 'ტელეგრამის ბოტი', c.telegram ? `${bot}${c.bot?.error ? ' — ტოკენი არ მუშაობს' : ''}` : '@BotFather-ში შექმენი ბოტი და Render-ში ჩასვი <code>TELEGRAM_BOT_TOKEN</code>.')}
        ${check(c.telegram && s.paired, 'შენი ტელეგრამი დაკავშირებულია', s.paired ? 'დირექტორი მხოლოდ ამ ჩატს პასუხობს.' : 'ჯერ „webhook-ის დაყენება“, მერე „დაკავშირება“ და ბმულით ბოტს Start.')}
        ${check(c.brainToken, 'დირექტორის გასაღები', c.brainToken ? '' : 'Render-ში <code>DIRECTOR_API_TOKEN</code> (მინ. 32 სიმბოლო, შემთხვევითი).')}
        ${check(c.routine, 'მყისიერი გაღვიძება', c.routine ? 'შენს მესიჯზე დირექტორი 1–2 წუთში პასუხობს.' : 'არჩევითი: <code>DIRECTOR_ROUTINE_URL</code> + <code>DIRECTOR_ROUTINE_TOKEN</code>. მის გარეშე დირექტორი საათში ერთხელ მუშაობს.')}
        ${pairing ? `<div class="s-callout is-ok" style="margin:12px 18px">${ico('check')}<p>გახსენი <a href="${esc(pairing.link)}" target="_blank" rel="noopener">${esc(pairing.link)}</a> და დააჭირე Start. კოდი: <b>${esc(pairing.code)}</b> (10 წუთი).</p></div>` : ''}
      </div>
      <footer class="s-card-foot">
        <span class="s-foot-note">${c.telegram ? '' : 'ბოტის ტოკენის გარეშე ღილაკები არ იმუშავებს.'}</span>
        <button type="button" class="btn ghost" data-webhook ${c.telegram ? '' : 'disabled'}>webhook-ის დაყენება</button>
        ${s.paired
          ? '<button type="button" class="btn ghost" data-unpair>გათიშვა</button>'
          : `<button type="button" class="btn" data-pair ${c.telegram ? '' : 'disabled'}>ტელეგრამის დაკავშირება</button>`}
      </footer>
    </section>`;
  }

  function proposalItem(p) {
    const [label, cls] = STATUS[p.status] || [p.status, ''];
    return `<article class="s-feed-item" style="padding:14px 18px;border-top:1px solid var(--s-line-soft)">
      <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
        <span class="s-badge is-plain">${esc(KIND[p.kind] || p.kind)}</span>
        <span class="s-badge ${cls}">${esc(label)}</span>
        <b style="font-size:13.5px">${esc(p.title)}</b>
        <small class="s-muted" style="margin-left:auto">${when(p.createdAt)}</small>
      </div>
      <p style="white-space:pre-wrap;margin:8px 0 0;font-size:13px;line-height:1.55">${esc(p.body)}</p>
      ${p.ownerNote ? `<p style="margin:6px 0 0;font-size:12.5px"><b>შენი შენიშვნა:</b> ${esc(p.ownerNote)}</p>` : ''}
      ${p.result ? `<p style="margin:6px 0 0;font-size:12.5px"><b>შედეგი:</b> ${esc(p.result)}</p>` : ''}
      ${p.status === 'pending' ? `<div style="display:flex;gap:8px;margin-top:10px">
        <button type="button" class="btn primary" data-decide="${esc(p.id)}" data-approve="1">✅ თანხმობა</button>
        <button type="button" class="btn ghost" data-decide="${esc(p.id)}" data-approve="0">❌ უარი</button></div>` : ''}
    </article>`;
  }

  function proposalsCard(d) {
    const pending = d.proposals.filter((p) => p.status === 'pending');
    const rest = d.proposals.filter((p) => p.status !== 'pending').slice(0, 15);
    return `<section class="s-card">
      <header class="s-card-head"><div><h3>შენს თანხმობას ელოდება${pending.length ? ` · ${pending.length}` : ''}</h3>
        <p>დირექტორი არაფერს აკეთებს დაუდასტურებლად. იგივე ღილაკები ტელეგრამშიც მოდის.</p></div></header>
      <div class="s-card-body is-flush">
        ${pending.length ? pending.map(proposalItem).join('') : `<div class="s-empty">${ico('check')}<strong>რიგი ცარიელია</strong></div>`}
        ${rest.length ? `<details style="border-top:1px solid var(--s-line-soft)"><summary style="padding:12px 18px;cursor:pointer;font-size:13px">ისტორია (${rest.length})</summary>${rest.map(proposalItem).join('')}</details>` : ''}
      </div>
    </section>`;
  }

  function chatCard(d) {
    const msgs = d.messages.slice(-40);
    return `<section class="s-card">
      <header class="s-card-head"><div><h3>საუბარი</h3><p>იგივე, რაც ტელეგრამში. აქედან დაწერილსაც დირექტორი ტელეგრამში გიპასუხებს.</p></div></header>
      <div class="s-card-body" style="display:grid;gap:8px;max-height:460px;overflow:auto" data-chat>
        ${msgs.length ? msgs.map((m) => `<div style="justify-self:${m.direction === 'owner' ? 'end' : 'start'};max-width:80%;background:${m.direction === 'owner' ? 'var(--s-accent-soft, var(--s-sunken))' : 'var(--s-sunken)'};border-radius:12px;padding:8px 12px">
          <small class="s-muted">${esc(FROM[m.direction] || m.direction)} · ${when(m.createdAt)}${m.direction === 'owner' && !m.handledAt ? ' · ⏳' : ''}</small>
          <div style="white-space:pre-wrap;font-size:13px;line-height:1.5">${esc(m.text)}</div></div>`).join('')
          : '<div class="s-empty"><strong>ჯერ არაფერი</strong><span>ჩააბარე ცვლა ან მიწერე.</span></div>'}
      </div>
      <footer class="s-card-foot" style="gap:8px">
        <textarea data-say rows="2" maxlength="4000" placeholder="მიწერე დირექტორს…" style="flex:1;min-width:0;resize:vertical"></textarea>
        <button type="button" class="btn primary" data-send>გაგზავნა</button>
      </footer>
    </section>`;
  }

  function journalCard(d) {
    const mem = d.memory || [];
    return `<section class="s-card">
      <header class="s-card-head"><div><h3>ჟურნალი და მეხსიერება</h3><p>რას აკეთებდა და რა ახსოვს: სტრატეგია, მიზნები, გადაწყვეტილებები.</p></div></header>
      <div class="s-card-body is-flush">
        ${d.journal.length ? d.journal.map((j) => `<div class="s-switch-row" style="padding:10px 18px"><div><b style="font-weight:500">${esc(j.summary)}</b><small>${esc(j.kind)} · ${when(j.createdAt)}</small></div></div>`).join('') : '<div class="s-empty"><strong>ჟურნალი ცარიელია</strong></div>'}
        ${mem.length ? `<details style="border-top:1px solid var(--s-line-soft)"><summary style="padding:12px 18px;cursor:pointer;font-size:13px">მეხსიერება (${mem.length})</summary>
          ${mem.map((m) => `<div style="padding:10px 18px;border-top:1px solid var(--s-line-soft)"><b style="font-size:12.5px">${esc(m.key)}</b><div style="white-space:pre-wrap;font-size:12.5px;color:var(--s-muted)">${esc(m.value)}</div></div>`).join('')}</details>` : ''}
      </div>
    </section>`;
  }

  function paint(root) {
    const scroll = root.querySelector('[data-chat]')?.scrollTop;
    const draft = root.querySelector('[data-say]')?.value || '';
    root.innerHTML = `<div class="s-stack">${heroCard(data)}${proposalsCard(data)}${chatCard(data)}${setupCard(data)}${journalCard(data)}</div>`;
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
      toast(r.lastError ? `webhook: ${r.lastError}` : 'webhook დაყენდა', r.lastError ? 'warn' : 'ok');
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
