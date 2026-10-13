/**
 * MediCard Admin V4 — #/horoscope MEDIHOROSCOPE (/api/admin/horoscope), on the usage kit (usageKit.js).
 * Page tabs: „ჰოროსკოპები“ (today's sky, which readings are ready per period and sign, read / edit / hide /
 * write again), „ბიბლიოთეკა“ (sign profiles, natal placements, transits, compatibility, tarot, numbers, Chinese
 * zodiac, dreams — progress, fill, edit), „გამოყენება“ (counts, signs, sections — never chat text or birth
 * details), „ჟურნალი“ (generator runs and costs) and „პარამეტრები“ (models, house style, Oracle, switches).
 */
(function adminV4Horoscope(global) {
  const K = global.AdminUsage;
  if (!K) return;
  const doc = document;
  const { esc, fmt, num, pct, when, metric, metrics, card, empty, note, shares } = K;
  const V = () => global.AdminV3 || {};
  const toast = (m, k) => global.toast?.(m, k);
  const api = (path, opts) => global.api(`/horoscope${path}`, opts);
  const say = (err, fallback) => (/[ა-ჿ]/.test(err?.message || '') ? err.message : fallback);
  const skel = () => `<div class="s-stack"><div class="v3-skel" aria-hidden="true">${'<i></i>'.repeat(6)}</div></div>`;
  const pane = (key) => doc.querySelector(`#tab-horoscope [data-uw-pane="${key}"]`);

  K.glyphs({
    // A crescent beside a four-point star — the module's mark in the sidebar.
    horoscope: '<path d="M14.5 4.2a7.6 7.6 0 1 0 5.3 12.9A7 7 0 0 1 14.5 4.2z"/><path d="M18 3.2l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z"/>',
  });

  /* ───────────── words ───────────── */
  const SIGNS = {
    aries: 'ვერძი', taurus: 'კურო', gemini: 'ტყუპები', cancer: 'კირჩხიბი', leo: 'ლომი', virgo: 'ქალწული',
    libra: 'სასწორი', scorpio: 'მორიელი', sagittarius: 'მშვილდოსანი', capricorn: 'თხის რქა', aquarius: 'მერწყული', pisces: 'თევზები',
  };
  const SIGN_IN = {
    aries: 'ვერძში', taurus: 'კუროში', gemini: 'ტყუპებში', cancer: 'კირჩხიბში', leo: 'ლომში', virgo: 'ქალწულში',
    libra: 'სასწორში', scorpio: 'მორიელში', sagittarius: 'მშვილდოსანში', capricorn: 'თხის რქაში', aquarius: 'მერწყულში', pisces: 'თევზებში',
  };
  const PLANETS = { sun: 'მზე', moon: 'მთვარე', mercury: 'მერკური', venus: 'ვენერა', mars: 'მარსი', jupiter: 'იუპიტერი', saturn: 'სატურნი', uranus: 'ურანი', neptune: 'ნეპტუნი', pluto: 'პლუტონი' };
  const PHASES = { new: 'ახალი მთვარე', waxing_crescent: 'მზარდი ნამგალი', first_quarter: 'პირველი მეოთხედი', waxing_gibbous: 'მზარდი მთვარე', full: 'სავსე მთვარე', waning_gibbous: 'კლებადი მთვარე', last_quarter: 'ბოლო მეოთხედი', waning_crescent: 'კლებადი ნამგალი' };
  const KIND = { day: 'დღე', week: 'კვირა', month: 'თვე', year: 'წელი' };
  const PARTS = { general: 'ზოგადი', love: 'სიყვარული', money: 'საქმე და ფული', mood: 'განწყობა', tip: 'დღის რჩევა' };
  const NS = {
    sign: 'ნიშნების პროფილები', compat: 'თავსებადობა', tarot: 'ტარო', number: 'ცხოვრების გზის რიცხვები', pday: 'დღის რიცხვები',
    pyear: 'წლის რიცხვები', moon_phase: 'მთვარის ფაზები', retro: 'რეტროგრადები', aspect_kind: 'ასპექტების ტიპები', planet: 'პლანეტები რუკაში',
    house: 'სახლები', element: 'სტიქიები', chinese: 'ჩინური ნიშნები', chinese_year: 'ჩინური წლის პროგნოზი', asc: 'ასცენდენტები',
    planet_sign: 'პლანეტა ნიშანში', planet_house: 'პლანეტა სახლში', transit: 'ტრანზიტები (შენი დღე)', aspect: 'ნატალური ასპექტები', dream: 'სიზმრების სიმბოლოები',
  };
  const SECTIONS = { hub: 'მოდულის მთავარი', chart: 'ასტრორუკა', sign: 'ნიშნის გვერდი', compat: 'თავსებადობა', tarot: 'ტარო', numerology: 'ნუმეროლოგია', chinese: 'ჩინური', dreams: 'სიზმრები', sky: 'ცის კალენდარი', oracle: 'ორაკული' };
  const RUN_JOB = { readings: 'ჰოროსკოპები', library: 'ბიბლიოთეკა' };
  const RUN_STATUS = { DONE: ['is-ok', 'დასრულდა'], FAILED: ['is-bad', 'ვერ შესრულდა'], RUNNING: ['', 'მიმდინარეობს'] };
  const usd = (n) => `$${num(Number(n) || 0, 2)}`;
  const periodLabel = (kind, key) => {
    if (kind === 'day') return when(`${key}T12:00:00+04:00`, 'date');
    if (kind === 'week') return `კვირა · ${when(`${key}T12:00:00+04:00`, 'date')}-დან`;
    if (kind === 'month') return `${['იანვარი', 'თებერვალი', 'მარტი', 'აპრილი', 'მაისი', 'ივნისი', 'ივლისი', 'აგვისტო', 'სექტემბერი', 'ოქტომბერი', 'ნოემბერი', 'დეკემბერი'][Number(key.slice(5)) - 1]} ${key.slice(0, 4)}`;
    return `${key} წელი`;
  };

  const state = { status: null, kind: 'day', key: null, sign: 'aries', readings: [] };

  /* ═════════════ ჰოროსკოპები ═════════════ */
  function skyStrip(sky) {
    if (!sky) return '';
    const bodies = sky.bodies.map((b) => `<span class="s-badge is-plain${b.retro ? ' is-warn' : ''}" title="${esc(`${PLANETS[b.key]} ${SIGN_IN[b.sign]} ${b.degree}°${b.retro ? ' · რეტროგრადული' : ''}`)}">${esc(PLANETS[b.key])} · ${esc(SIGN_IN[b.sign])} ${b.degree}°${b.retro ? ' ℞' : ''}</span>`).join('');
    const events = sky.events.slice(0, 5).map((e) => `<li><b>${esc(when(e.at, 'datetime'))}</b> — ${esc(eventText(e))}</li>`).join('');
    return card('ცა ახლა', `${esc(PHASES[sky.moon.key])} · განათება ${pct(sky.moon.illumination * 100)} · მთვარე ${esc(SIGN_IN[sky.moon.sign])} · მთვარის მე-${fmt(sky.moon.lunarDay)} დღე. პლანეტები ასტრონომიულად ზუსტია (თბილისი, შუადღე).`,
      `<div class="s-uw-chips">${bodies}</div>${events ? `<ul class="hz-events">${events}</ul>` : ''}`);
  }

  function eventText(e) {
    switch (e.type) {
      case 'new_moon': return `ახალი მთვარე ${SIGN_IN[e.sign]}`;
      case 'full_moon': return `სავსე მთვარე ${SIGN_IN[e.sign]}`;
      case 'ingress': return `${PLANETS[e.body]} გადადის ${SIGN_IN[e.sign]}`;
      case 'station_retrograde': return `${PLANETS[e.body]} იწყებს უკუსვლას (${SIGN_IN[e.sign]})`;
      case 'station_direct': return `${PLANETS[e.body]} პირდაპირ სვლაზე გადადის (${SIGN_IN[e.sign]})`;
      case 'lunar_eclipse': return `მთვარის დაბნელება ${SIGN_IN[e.sign]}`;
      case 'solar_eclipse': return `მზის დაბნელება ${SIGN_IN[e.sign]}`;
      default: return e.type;
    }
  }

  function readinessGrid(st) {
    if (!st.grid) return '';
    const rows = st.grid.map((g) => {
      const ready = Object.values(g.signs).filter(Boolean).length;
      const cells = Object.keys(SIGNS).map((s) => {
        const r = g.signs[s];
        const cls = !r ? 'is-missing' : r.status !== 'LIVE' ? 'is-hidden' : r.edited ? 'is-edited' : 'is-ready';
        const on = state.kind === g.kind && state.key === g.key && state.sign === s;
        return `<button type="button" class="hz-cell ${cls}${on ? ' is-on' : ''}" data-hz-pick="${g.kind}|${g.key}|${s}" title="${esc(`${SIGNS[s]} — ${!r ? 'ჯერ არ დაწერილა' : r.status !== 'LIVE' ? 'დამალულია' : r.edited ? 'რედაქტირებულია' : 'მზადაა'}`)}">${esc(SIGNS[s].slice(0, 3))}</button>`;
      }).join('');
      return `<div class="hz-row"><div class="hz-row-head"><b>${esc(KIND[g.kind])}</b><small>${esc(periodLabel(g.kind, g.key))} · ${fmt(ready)}/12</small></div>
        <div class="hz-cells">${cells}</div>
        ${ready < 12 ? `<button type="button" class="btn small" data-hz-generate="${g.kind}|${g.key}">დაწერე დარჩენილი (${fmt(12 - ready)})</button>` : '<span class="s-badge is-ok">ყველა მზადაა</span>'}</div>`;
    }).join('');
    return card('რომელი ჰოროსკოპია მზად', 'ხვალინდელს სისტემა დღით ადრე წერს, ამიტომ 00:00-ზე ახალი დღე უკვე მზადაა. დააჭირე ნიშანს — ქვემოთ გაიხსნება მისი ტექსტი. მწვანე — მზადაა, ოქროსფერი — რედაქტირებული, ნაცრისფერი — დამალული, ცარიელი — ჯერ არ დაწერილა.', `<div class="hz-grid">${rows}</div>`);
  }

  function readingCard() {
    const r = state.readings.find((x) => x.sign === state.sign);
    const title = `${SIGNS[state.sign]} · ${KIND[state.kind]} · ${periodLabel(state.kind, state.key)}`;
    if (!r) {
      return card(title, 'ეს ჰოროსკოპი ჯერ არ დაწერილა.', `<button type="button" class="btn primary" data-hz-regen>დაწერე ახლა</button>`);
    }
    const b = r.body || {};
    const block = (lang) => {
      const t = b[lang] || {};
      return `<article class="hz-reading" lang="${lang}"><h4>${esc(t.headline || '')}</h4>
        ${Object.entries(PARTS).map(([k, label]) => `<p><b>${esc(label)}${lang === 'en' ? ` · ${k}` : ''}</b>${esc(t[k] || '')}</p>`).join('')}</article>`;
    };
    const scores = b.scores ? `სიყვარული ${b.scores.love}/5 · საქმე ${b.scores.money}/5 · განწყობა ${b.scores.mood}/5` : '';
    const lucky = b.lucky ? ` · რიცხვი ${b.lucky.number}, ფერი ${b.lucky.color}, დრო ${b.lucky.time}` : '';
    const extra = b.keyDates?.length ? `<p class="s-muted">მთავარი თარიღები: ${b.keyDates.map((d) => `${esc(d.date)} — ${esc(d.ka)}`).join('; ')}</p>` : b.highlights?.length ? `<p class="s-muted">თვეები: ${b.highlights.map((d) => `${esc(d.month)} — ${esc(d.ka)}`).join('; ')}</p>` : '';
    const status = r.status === 'LIVE' ? (r.edited ? '<span class="s-badge is-warn">რედაქტირებულია</span>' : '<span class="s-badge is-ok">აპში ჩანს</span>') : '<span class="s-badge is-plain">დამალულია</span>';
    const action = `<div class="hz-actions">${status}
      <button type="button" class="btn small" data-hz-edit>რედაქტირება</button>
      <button type="button" class="btn small" data-hz-regen>ხელახლა დაწერა</button>
      <button type="button" class="btn small" data-hz-toggle>${r.status === 'LIVE' ? 'დამალვა' : 'გამოჩენა'}</button></div>`;
    return card(title, `${esc(scores)}${esc(lucky)} · ${esc(r.model || '')} · ${usd(r.costUsd)} · ${esc(when(r.updatedAt))}`,
      `<div class="hz-two">${block('ka')}${block('en')}</div>${extra}`, { action });
  }

  async function loadReadings() {
    if (!state.key) return;
    const data = await api(`/readings?kind=${state.kind}&key=${encodeURIComponent(state.key)}`);
    state.readings = data.readings || [];
  }

  async function renderReadings({ quiet = false } = {}) {
    const host = pane('readings');
    if (!host) return;
    if (!quiet) host.innerHTML = skel();
    try {
      state.status = await api('/status');
      if (!state.key) state.key = state.status.keys?.day;
      if (state.status.schemaReady) await loadReadings();
    } catch (err) {
      host.innerHTML = empty(say(err, 'მონაცემები ვერ ჩაიტვირთა.'));
      return;
    }
    paintReadings(host);
  }

  function paintReadings(host) {
    const st = state.status;
    if (!st.schemaReady) {
      host.innerHTML = `<div class="s-stack">${skyStrip(st.sky)}${card('ცხრილები ჯერ არ არის', '', note('MEDIHOROSCOPE-ის ცხრილები ბაზაში ჯერ არ დაყენებულა — ისინი შემდეგ დეპლოიზე იქმნება (npm run db:install).'))}</div>`;
      return;
    }
    const running = st.running ? `<div class="s-callout">${K.ico('info')}<p>ახლა მიმდინარეობს: <b>${esc(st.running)}</b>. განახლდება რამდენიმე წუთში.</p></div>` : '';
    const off = !st.config?.aiEnabled ? `<div class="s-callout is-warn">${K.ico('alert')}<p>ავტომატური წერა გამორთულია — ჩართე „პარამეტრებში“.</p></div>` : '';
    host.innerHTML = `<div class="s-stack">${running}${off}
      ${metrics([
        metric('დღეს', `${fmt(Object.values(st.grid[0].signs).filter(Boolean).length)}/12`, 'დღევანდელი ჰოროსკოპი'),
        metric('ხვალ', `${fmt(Object.values(st.grid[1].signs).filter(Boolean).length)}/12`, 'წინასწარ დაწერილი'),
        metric('ხარჯი დღეს', usd(st.cost?.today), `30 დღეში ${usd(st.cost?.month)}`),
        metric('ბიბლიოთეკა', pct(libraryPct(st.library)), `${fmt(st.library.reduce((s, l) => s + l.done, 0))} / ${fmt(st.library.reduce((s, l) => s + l.total, 0))} ტექსტი`),
      ])}
      ${skyStrip(st.sky)}
      ${readinessGrid(st)}
      <div data-hz-reading>${readingCard()}</div>
    </div>`;
    bindReadings(host);
  }

  const libraryPct = (lib) => {
    const total = lib.reduce((s, l) => s + l.total, 0);
    return total ? (lib.reduce((s, l) => s + l.done, 0) / total) * 100 : 0;
  };

  function bindReadings(host) {
    host.querySelectorAll('[data-hz-pick]').forEach((b) => b.addEventListener('click', async () => {
      const [kind, key, sign] = b.dataset.hzPick.split('|');
      const changed = kind !== state.kind || key !== state.key;
      Object.assign(state, { kind, key, sign });
      if (changed) await loadReadings().catch(() => undefined);
      paintReadings(host);
    }));
    host.querySelectorAll('[data-hz-generate]').forEach((b) => b.addEventListener('click', async () => {
      const [kind, key] = b.dataset.hzGenerate.split('|');
      b.disabled = true;
      try {
        await api('/readings/generate', { method: 'POST', body: { kind, key } });
        toast('წერა დაიწყო — 12 ნიშანს რამდენიმე წუთი სჭირდება', 'ok');
        setTimeout(() => void renderReadings({ quiet: true }), 4000);
      } catch (err) {
        toast(say(err, 'ვერ დაიწყო. სცადე ხელახლა.'), 'bad');
        b.disabled = false;
      }
    }));
    const box = host.querySelector('[data-hz-reading]');
    box?.querySelector('[data-hz-regen]')?.addEventListener('click', async (ev) => {
      const btn = ev.currentTarget;
      btn.disabled = true;
      btn.classList.add('is-loading');
      try {
        const r = await api('/readings/regenerate', { method: 'POST', body: { kind: state.kind, key: state.key, sign: state.sign } });
        toast(`${SIGNS[state.sign]} ხელახლა დაიწერა (${usd(r.costUsd)})`, 'ok');
        await renderReadings({ quiet: true });
      } catch (err) {
        toast(say(err, 'ვერ დაიწერა. სცადე ხელახლა.'), 'bad');
        btn.disabled = false;
        btn.classList.remove('is-loading');
      }
    });
    box?.querySelector('[data-hz-toggle]')?.addEventListener('click', async () => {
      const r = state.readings.find((x) => x.sign === state.sign);
      if (!r) return;
      try {
        await api(`/readings/${encodeURIComponent(r.id)}/status`, { method: 'POST', body: { status: r.status === 'LIVE' ? 'HIDDEN' : 'LIVE' } });
        toast(r.status === 'LIVE' ? 'დაიმალა — აპში ამ ნიშანს ამ პერიოდზე ტექსტი არ ექნება' : 'აპში ისევ ჩანს', r.status === 'LIVE' ? 'warn' : 'ok');
        await renderReadings({ quiet: true });
      } catch (err) {
        toast(say(err, 'სტატუსი ვერ შეიცვალა.'), 'bad');
      }
    });
    box?.querySelector('[data-hz-edit]')?.addEventListener('click', () => editDialog(state.readings.find((x) => x.sign === state.sign)));
  }

  function editDialog(r) {
    if (!r) return;
    const b = r.body || {};
    const field = (lang, k, label, rows = 2) => `<label class="s-field"><span>${esc(label)}</span><textarea name="${lang}.${k}" rows="${rows}" maxlength="${k === 'general' ? 4000 : 2000}">${esc(b[lang]?.[k] || '')}</textarea></label>`;
    const langBlock = (lang, title) => `<fieldset class="s-stack"><legend><b>${title}</b></legend>
      <label class="s-field"><span>სათაური</span><input name="${lang}.headline" maxlength="200" value="${esc(b[lang]?.headline || '')}"></label>
      ${field(lang, 'general', 'ზოგადი', 6)}${field(lang, 'love', 'სიყვარული')}${field(lang, 'money', 'საქმე და ფული')}${field(lang, 'mood', 'განწყობა')}${field(lang, 'tip', 'დღის რჩევა', 1)}</fieldset>`;
    const score = (k, label) => `<label class="s-field"><span>${esc(label)} (1–5)</span><input type="number" min="1" max="5" name="score.${k}" value="${esc(b.scores?.[k] ?? 3)}"></label>`;
    const dialog = V().openDialog?.({
      title: `რედაქტირება · ${SIGNS[r.sign]} · ${KIND[r.kind]}`,
      description: 'შენახვის შემდეგ ავტომატური წერა ამ ტექსტს აღარ შეცვლის („ხელახლა დაწერა“ კი — შეცვლის).',
      wide: true,
      body: `<form id="hz-edit-form" class="s-stack" novalidate>
        <div class="s-form-grid">${score('love', 'სიყვარული')}${score('money', 'საქმე და ფული')}${score('mood', 'განწყობა')}</div>
        <div class="hz-two">${langBlock('ka', 'ქართული')}${langBlock('en', 'English')}</div></form>`,
      footer: '<p class="s-form-msg" role="alert"></p><button type="button" class="btn" data-cancel>გაუქმება</button><button type="submit" class="btn primary" form="hz-edit-form">შენახვა</button>',
    });
    const form = doc.getElementById('hz-edit-form');
    const panel = form?.closest('.v3-dialog-panel');
    if (!form || !panel || !dialog) return;
    const alertEl = panel.querySelector('[role=alert]');
    panel.querySelector('[data-cancel]').onclick = () => void dialog.close();
    form.onsubmit = async (ev) => {
      ev.preventDefault();
      const read = (lang) => Object.fromEntries(['headline', ...Object.keys(PARTS)].map((k) => [k, form.elements.namedItem(`${lang}.${k}`).value.trim()]));
      const body = {
        ka: read('ka'), en: read('en'),
        scores: Object.fromEntries(['love', 'money', 'mood'].map((k) => [k, Math.max(1, Math.min(5, Math.round(Number(form.elements.namedItem(`score.${k}`).value) || 3)))])),
      };
      if ([...Object.values(body.ka), ...Object.values(body.en)].some((v) => !v)) { alertEl.textContent = 'ყველა ველი ორივე ენაზე უნდა იყოს შევსებული.'; return; }
      const submit = panel.querySelector('[type=submit]');
      submit.disabled = true;
      try {
        await api(`/readings/${encodeURIComponent(r.id)}`, { method: 'PUT', body });
        V().setDirty?.(false);
        await dialog.close();
        toast('შენახულია — აპში ჩანს მომდევნო გახსნისას', 'ok');
        await renderReadings({ quiet: true });
      } catch (err) {
        alertEl.textContent = say(err, 'ვერ შეინახა. სცადე ხელახლა.');
        submit.disabled = false;
      }
    };
  }

  /* ═════════════ ბიბლიოთეკა ═════════════ */
  const libState = { ns: 'sign', q: '', rows: [] };

  async function renderLibrary({ quiet = false } = {}) {
    const host = pane('library');
    if (!host) return;
    if (!quiet) host.innerHTML = skel();
    try {
      if (!state.status) state.status = await api('/status');
      const data = await api(`/library?ns=${encodeURIComponent(libState.ns)}&q=${encodeURIComponent(libState.q)}`);
      libState.rows = data.rows || [];
    } catch (err) {
      host.innerHTML = empty(say(err, 'ბიბლიოთეკა ვერ ჩაიტვირთა.'));
      return;
    }
    const lib = state.status.library || [];
    const progress = `<ul class="s-share-list">${lib.map((l) => {
      const p = l.total ? Math.round((l.done / l.total) * 1000) / 10 : 0;
      return `<li><span>${esc(NS[l.ns] || l.ns)}</span><div class="s-meter${p < 100 ? ' is-warn' : ''}"><i style="width:${Math.max(2, p)}%"></i></div><b>${fmt(l.done)}/${fmt(l.total)}</b><em>${l.edited ? `${fmt(l.edited)} რედ.` : pct(p)}</em></li>`;
    }).join('')}</ul>`;
    const grouped = new Map();
    for (const r of libState.rows) {
      if (!grouped.has(r.key)) grouped.set(r.key, {});
      grouped.get(r.key)[r.lang] = r;
    }
    const list = [...grouped.entries()].map(([key, langs]) => {
      const ka = langs.ka?.data || {};
      const head = ka.title || ka.word || ka.headline || key.split(':').slice(1).join(' · ');
      const edited = langs.ka?.source === 'admin' || langs.en?.source === 'admin';
      return `<li class="hz-lib-row"><div><b>${esc(head)}</b> <small class="s-muted">${esc(key)}</small>${edited ? ' <span class="s-badge is-warn">რედ.</span>' : ''}<p>${esc(String(ka.text || '').slice(0, 220))}${String(ka.text || '').length > 220 ? '…' : ''}</p></div>
        <button type="button" class="btn small" data-hz-lib-edit="${esc(key)}">რედაქტირება</button></li>`;
    }).join('');
    host.innerHTML = `<div class="s-stack">
      ${card('რამდენია დაწერილი', 'ავტომატური შევსება ყოველ 10 წუთში რამდენიმე პაკეტს წერს, სანამ ყველაფერი არ შეივსება. ტექსტები ერთნაირია ყველასთვის — პირადი მონაცემი არ იგზავნება.', progress,
        { action: '<button type="button" class="btn small primary" data-hz-fill>შეავსე ახლა (10 პაკეტი)</button>' })}
      ${card('ტექსტები', '', `<div class="hz-lib-tools"><label class="s-field"><span>განყოფილება</span><select data-hz-ns>${Object.entries(NS).map(([k, l]) => `<option value="${k}" ${libState.ns === k ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select></label>
        <label class="s-field"><span>ძებნა</span><input type="search" data-hz-q value="${esc(libState.q)}" placeholder="მაგ. მთვარე"></label></div>
        ${list ? `<ul class="hz-lib">${list}</ul>` : empty('ამ განყოფილებაში ჯერ ტექსტი არ არის.')}`)}
    </div>`;
    host.querySelector('[data-hz-ns]')?.addEventListener('change', (e) => { libState.ns = e.target.value; void renderLibrary({ quiet: true }); });
    let t = null;
    host.querySelector('[data-hz-q]')?.addEventListener('input', (e) => {
      clearTimeout(t);
      t = setTimeout(() => { libState.q = e.target.value.trim(); void renderLibrary({ quiet: true }); }, 350);
    });
    host.querySelector('[data-hz-fill]')?.addEventListener('click', async (e) => {
      e.currentTarget.disabled = true;
      try {
        await api('/library/fill', { method: 'POST', body: { batches: 10 } });
        toast('შევსება დაიწყო — რამდენიმე წუთში განახლდება', 'ok');
      } catch (err) {
        toast(say(err, 'ვერ დაიწყო.'), 'bad');
      }
    });
    host.querySelectorAll('[data-hz-lib-edit]').forEach((b) => b.addEventListener('click', () => libraryDialog(b.dataset.hzLibEdit, grouped.get(b.dataset.hzLibEdit))));
  }

  function libraryDialog(key, langs) {
    const fieldsOf = (data) => Object.entries(data || {});
    const block = (lang, title) => {
      const data = langs?.[lang]?.data || {};
      return `<fieldset class="s-stack"><legend><b>${title}</b></legend>${fieldsOf(data).map(([k, v]) => {
        if (typeof v === 'number') return `<label class="s-field"><span>${esc(k)}</span><input type="number" min="1" max="5" name="${lang}.${k}" value="${esc(v)}"></label>`;
        if (Array.isArray(v)) return `<label class="s-field"><span>${esc(k)} (თითო ხაზზე ერთი)</span><textarea name="${lang}.${k}" data-list rows="3">${esc(v.join('\n'))}</textarea></label>`;
        return `<label class="s-field"><span>${esc(k)}</span><textarea name="${lang}.${k}" rows="${String(v).length > 160 ? 5 : 2}">${esc(v)}</textarea></label>`;
      }).join('')}</fieldset>`;
    };
    const dialog = V().openDialog?.({
      title: `ტექსტი · ${key}`,
      description: 'რედაქტირებულ ტექსტს ავტომატური შევსება აღარ შეცვლის.',
      wide: true,
      body: `<form id="hz-lib-form" class="hz-two" novalidate>${block('ka', 'ქართული')}${block('en', 'English')}</form>`,
      footer: '<p class="s-form-msg" role="alert"></p><button type="button" class="btn" data-cancel>გაუქმება</button><button type="submit" class="btn primary" form="hz-lib-form">შენახვა</button>',
    });
    const form = doc.getElementById('hz-lib-form');
    const panel = form?.closest('.v3-dialog-panel');
    if (!form || !panel || !dialog) return;
    panel.querySelector('[data-cancel]').onclick = () => void dialog.close();
    form.onsubmit = async (ev) => {
      ev.preventDefault();
      const submit = panel.querySelector('[type=submit]');
      submit.disabled = true;
      try {
        for (const lang of ['ka', 'en']) {
          const data = {};
          for (const el of form.querySelectorAll(`[name^="${lang}."]`)) {
            const k = el.name.slice(3);
            data[k] = el.type === 'number' ? Number(el.value) : el.hasAttribute('data-list') ? el.value.split('\n').map((s) => s.trim()).filter(Boolean) : el.value.trim();
          }
          if (Object.keys(data).length) await api('/library', { method: 'PUT', body: { key, lang, data } });
        }
        await dialog.close();
        toast('ტექსტი შენახულია', 'ok');
        await renderLibrary({ quiet: true });
      } catch (err) {
        panel.querySelector('[role=alert]').textContent = say(err, 'ვერ შეინახა.');
        submit.disabled = false;
      }
    };
  }

  /* ═════════════ გამოყენება ═════════════ */
  const useState = { days: 30, team: false };

  async function renderUsage() {
    const host = pane('usage');
    if (!host) return;
    host.innerHTML = skel();
    let d;
    try {
      d = await api(`/overview?days=${useState.days}${useState.team ? '&team=1' : ''}`);
    } catch (err) {
      host.innerHTML = empty(say(err, 'მონაცემები ვერ ჩაიტვირთა.'));
      return;
    }
    if (!d.schemaReady) {
      host.innerHTML = empty('ცხრილები ჯერ არ არის — გამოჩნდება დეპლოის შემდეგ.');
      return;
    }
    const k = d.kpis;
    const signRows = Object.entries(d.signs).sort((a, b) => b[1] - a[1]).map(([s, n]) => [SIGNS[s], n]);
    const sectionRows = Object.entries(d.sections).sort((a, b) => b[1] - a[1]).map(([s, n]) => [SECTIONS[s] || s, n]);
    host.innerHTML = `<div class="s-stack">
      <div class="s-segment" role="group" aria-label="პერიოდი">${[7, 30, 90].map((n) => `<button type="button" class="${useState.days === n ? 'is-active' : ''}" data-hz-days="${n}">${n} დღე</button>`).join('')}
        <label class="s-switch-row hz-team"><span>გუნდის ჩათვლით</span><input class="s-switch" type="checkbox" role="switch" data-hz-team ${useState.team ? 'checked' : ''}></label></div>
      ${metrics([
        metric('ადამიანი', fmt(k.people), `ბოლო ${fmt(d.days)} დღეში გახსნა მოდული`),
        metric('დღეს', fmt(k.today), 'გახსნა დღეს'),
        metric('დაბრუნდა', fmt(k.returning), '2+ სხვადასხვა დღეს'),
        metric('ორაკულს მისწერეს', fmt(k.oracleMessages), `დაბადების დრო მითითებული აქვს ${fmt(k.withBirthTime)} ადამიანს`),
      ])}
      ${card('დღიური ტრენდი', 'მოდულის გამხსნელი ადამიანები და ორაკულისთვის გაგზავნილი შეტყობინებები — თბილისის დღეებით.', K.chart([
        { label: 'გახსნა', tone: 'amber', points: d.series.map((x) => ({ day: x.day, count: x.people })) },
        { label: 'ორაკული', tone: 'violet', points: d.series.map((x) => ({ day: x.day, count: x.oracle })) },
      ]))}
      ${K.split(card('რას ხსნიან', 'ადამიანების რაოდენობა, ვინც პერიოდში ეს ნაწილი გახსნა.', shares(sectionRows, k.people) || empty('ჯერ არაფერი.')),
        card('ნიშნები', 'მომხმარებლების მზის ნიშანი (პროფილის დაბადების თარიღით).', shares(signRows, k.people) || empty('ჯერ არაფერი.')))}
      ${K.definitions([
        '<b>გახსნა</b> — ერთი ადამიანი ერთ დღეს (თბილისით), რამდენჯერაც არ უნდა გახსნას. ნაწილები: მთავარი, ასტრორუკა, ნიშნის გვერდი, თავსებადობა, ტარო, ნუმეროლოგია, ჩინური, სიზმრები, ცის კალენდარი, ორაკული.',
        '<b>კონფიდენციალობა</b> — აქ მხოლოდ რაოდენობებია. ორაკულთან საუბრის ტექსტი, დაბადების დრო და ადგილი ადმინში არ ჩანს.',
        '<b>გუნდი</b> — @medicard.ge ანგარიშები; ნაგულისხმევად არ ითვლება.',
      ])}
    </div>`;
    host.querySelectorAll('[data-hz-days]').forEach((b) => b.addEventListener('click', () => { useState.days = Number(b.dataset.hzDays); void renderUsage(); }));
    host.querySelector('[data-hz-team]')?.addEventListener('change', (e) => { useState.team = e.target.checked; void renderUsage(); });
  }

  /* ═════════════ ჟურნალი ═════════════ */
  async function renderLog() {
    const host = pane('log');
    if (!host) return;
    host.innerHTML = skel();
    try {
      state.status = await api('/status');
    } catch (err) {
      host.innerHTML = empty(say(err, 'ჟურნალი ვერ ჩაიტვირთა.'));
      return;
    }
    const runs = state.status.runs || [];
    const rows = runs.map((r) => {
      const [cls, label] = RUN_STATUS[r.status] || ['', r.status];
      const errors = r.detail?.errors?.length ? `<details><summary>შეცდომები (${fmt(r.detail.errors.length)})</summary><pre>${esc(r.detail.errors.join('\n'))}</pre></details>` : '';
      const what = r.job === 'readings' ? esc((r.detail?.periods || []).join(', ')) : r.detail?.remaining != null ? `დარჩა ${fmt(r.detail.remaining)}` : '';
      return `<tr><td>${esc(when(r.startedAt))}</td><td>${esc(RUN_JOB[r.job] || r.job)}</td><td>${what}${errors}</td><td><span class="s-badge ${cls}">${esc(label)}</span></td><td>${fmt(r.ok)}${r.failed ? ` / <span class="s-uw-warn">${fmt(r.failed)}</span>` : ''}</td><td>${usd(r.costUsd)}</td></tr>`;
    }).join('');
    host.innerHTML = `<div class="s-stack">${card('ბოლო გაშვებები', `ხარჯი დღეს ${usd(state.status.cost?.today)} · 30 დღეში ${usd(state.status.cost?.month)}.`,
      rows ? `<div class="s-table-wrap"><table class="s-table"><thead><tr><th>დრო</th><th>რა</th><th>დეტალი</th><th>სტატუსი</th><th>დაიწერა</th><th>ხარჯი</th></tr></thead><tbody>${rows}</tbody></table></div>` : empty('ჯერ არცერთი გაშვება.'), { flush: Boolean(rows) })}</div>`;
  }

  /* ═════════════ პარამეტრები ═════════════ */
  async function renderSettings() {
    const host = pane('settings');
    if (!host) return;
    host.innerHTML = skel();
    try {
      state.status = await api('/status');
    } catch (err) {
      host.innerHTML = empty(say(err, 'პარამეტრები ვერ ჩაიტვირთა.'));
      return;
    }
    const c = state.status.config || {};
    const models = state.status.models || {};
    const select = (name, value, allowNone) => `<select name="${name}">${allowNone ? `<option value="none" ${value === 'none' ? 'selected' : ''}>არ გამოიყენო</option>` : ''}${Object.entries(models).map(([id, label]) => `<option value="${esc(id)}" ${value === id ? 'selected' : ''}>${esc(label)}</option>`).join('')}</select>`;
    const sw = (name, title, sub) => `<label class="s-switch-row"><span><b>${esc(title)}</b><small>${esc(sub)}</small></span><input class="s-switch" type="checkbox" role="switch" name="${name}" ${c[name] !== false ? 'checked' : ''}></label>`;
    host.innerHTML = `<form id="hz-settings" class="s-stack" novalidate>
      ${card('ტექსტების ავტორი', 'ჰოროსკოპი იწერება სამ ნაბიჯად: ავტორი წერს ქართულად → რედაქტორი ასწორებს ენას → ინგლისური ცალკე იწერება (არა თარგმანი). ეს ტექსტები ყველასთვის ერთნაირია — პირადი მონაცემი არ იგზავნება.', `
        <div class="s-form-grid">
          <label class="s-field"><span>ქართული ავტორი</span>${select('writerModel', c.writerModel)}</label>
          <label class="s-field"><span>ქართული რედაქტორი</span>${select('editorModel', c.editorModel, true)}</label>
          <label class="s-field"><span>ინგლისური ავტორი</span>${select('englishModel', c.englishModel)}</label>
        </div>
        <label class="s-field"><span>რედაქციის სტილი (არასავალდებულო)</span><textarea name="extraStyle" rows="3" maxlength="2000" placeholder="მაგ. ნაკლები ტერმინი, მეტი იუმორი">${esc(c.extraStyle || '')}</textarea><small>ემატება ავტორის ინსტრუქციას ორივე ენაზე.</small></label>
        ${sw('aiEnabled', 'ავტომატური წერა', 'ყოველ 10 წუთში ამოწმებს და წერს დაკლებულ ჰოროსკოპებს (ხვალინდელს — დღით ადრე).')}
        ${sw('libraryAutoFill', 'ბიბლიოთეკის ავტომატური შევსება', 'ნიშნების, ასტრორუკის, ტაროს, სიზმრების და სხვა ტექსტების ნელ-ნელა შევსება.')}`)}
      ${card('ორაკული', 'მოდულის საკუთარი ასისტენტი (Medi ჯადოქრის ქუდით). ადამიანის მონაცემებს AI-ს თანხმობის გზით აგზავნის, დამტკიცებული მოდელით (Gemini, Google Vertex).', `
        <div class="s-form-grid">
          <label class="s-field"><span>სახელი ქართულად</span><input name="oracleNameKa" maxlength="40" value="${esc(c.oracleNameKa || '')}"></label>
          <label class="s-field"><span>სახელი ინგლისურად</span><input name="oracleNameEn" maxlength="40" value="${esc(c.oracleNameEn || '')}"></label>
          <label class="s-field"><span>შეტყობინება დღეში (ერთ ადამიანზე)</span><input type="number" min="1" max="200" name="oracleDailyLimit" value="${esc(c.oracleDailyLimit ?? 30)}"></label>
        </div>
        ${sw('oracleEnabled', 'ორაკული ჩართულია', 'გამორთვისას ჩატი იმალება; ჰოროსკოპი მუშაობს.')}`)}
      ${card('აპში', '', sw('homeCard', 'დღის ჰოროსკოპი მთავარ გვერდზე', 'პატარა ბარათი Home-ზე. ადამიანს თავადაც შეუძლია მოდულიდან გამორთოს.'))}
      <div class="hz-save"><p class="s-form-msg" role="alert"></p><button type="submit" class="btn primary">შენახვა</button></div>
    </form>`;
    const form = doc.getElementById('hz-settings');
    form.onsubmit = async (ev) => {
      ev.preventDefault();
      const body = {
        writerModel: form.writerModel.value, editorModel: form.editorModel.value, englishModel: form.englishModel.value,
        extraStyle: form.extraStyle.value.trim(), aiEnabled: form.aiEnabled.checked, libraryAutoFill: form.libraryAutoFill.checked,
        oracleEnabled: form.oracleEnabled.checked, oracleNameKa: form.oracleNameKa.value.trim() || 'ორაკული', oracleNameEn: form.oracleNameEn.value.trim() || 'Oracle',
        oracleDailyLimit: Math.max(1, Math.min(200, Number(form.oracleDailyLimit.value) || 30)), homeCard: form.homeCard.checked,
      };
      const submit = form.querySelector('[type=submit]');
      submit.disabled = true;
      try {
        await api('/config', { method: 'PUT', body });
        toast('პარამეტრები შენახულია', 'ok');
      } catch (err) {
        form.querySelector('[role=alert]').textContent = say(err, 'ვერ შეინახა.');
      }
      submit.disabled = false;
    };
  }

  /* ═════════════ page tabs ═════════════ */
  global.renderHoroscopeHost = K.hostTabs({
    tab: 'horoscope',
    label: 'MEDIHOROSCOPE-ის განყოფილებები',
    panes: [
      ['readings', 'ჰოროსკოპები', () => renderReadings(), 'legacy'],
      ['library', 'ბიბლიოთეკა', () => renderLibrary(), 'legacy'],
      ['usage', 'გამოყენება', () => renderUsage(), 'legacy'],
      ['log', 'ჟურნალი', () => renderLog(), 'legacy'],
      ['settings', 'პარამეტრები', () => renderSettings(), 'legacy'],
    ],
  });
  global.AdminV4Horoscope = { renderReadings, renderLibrary, renderUsage, renderLog, renderSettings };
})(window);
