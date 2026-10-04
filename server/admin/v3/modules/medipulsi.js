/**
 * MediCard Admin — MEDIRUN (#/medipulsi; internal API name stays "medipulsi").
 * Tabs: overview · countries & cities · players · claims · missions · sessions · settings · log (owner 2026-10-04:
 * the boxes — rules, days, cities, manual drops — live in #/medirun-boxes; this page is the game itself: who plays,
 * where, how much, prizes to hand over). Editors open in AdminV3.openDialog; the mission editor carries the map.
 */
(function (global) {
  'use strict';
  const TABS = [['overview', 'მიმოხილვა'], ['geo', 'ქვეყნები და ქალაქები'], ['players', 'მოთამაშეები'], ['claims', 'ჯილდოების გაცემა'], ['missions', 'მისიები'], ['sessions', 'გასეირნებები'], ['config', 'პარამეტრები'], ['audit', 'ჟურნალი']];
  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const ico = (name) => (typeof icon === 'function' ? icon(name) : '');
  const V = () => global.AdminV3 || {};
  const can = (cap) => state.admin?.capabilities == null || state.admin.capabilities.includes(cap);
  const fmt = (n) => (Number.isFinite(Number(n)) ? Number(n).toLocaleString('ka-GE') : '—');
  const num = (n, digits = 1) => (Number.isFinite(Number(n)) ? Number(n).toLocaleString('ka-GE', { maximumFractionDigits: digits }) : '—');
  const when = (iso) => (iso ? (V().formatDate ? V().formatDate(iso, 'datetime') : String(iso)) : '—');
  const copyId = (id, label) => (id ? (V().copyIdButton ? V().copyIdButton(id, label) : `<code>${esc(id)}</code>`) : '');
  const request = (path, options) => api('/medipulsi' + path, options);
  const PAGE = 50;
  let selected = 'overview', offset = 0, filter = '', rows = [], ticket = 0;

  // Asia/Tbilisi is UTC+4 all year: editors show local time and save the same UTC instant as before.
  const TBILISI_MS = 4 * 3600000;
  const toTbilisiInput = (value) => new Date(new Date(value).getTime() + TBILISI_MS).toISOString().slice(0, 16);
  const fromTbilisiInput = (value) => new Date(Date.parse(`${value}Z`) - TBILISI_MS).toISOString();

  const PHASE = { ACTIVE: ['მიმდინარე', 'is-info'], PAUSED: ['პაუზაზე', 'is-warn'], FINISHED: ['დასრულებული', 'is-plain'] };
  const CLAIM = { PENDING: ['შესამოწმებელი', 'is-warn'], APPROVED: ['დადასტურებული', 'is-ok'], FULFILLED: ['გაცემული', 'is-ok'], REJECTED: ['უარყოფილი', 'is-bad'] };
  const CHAPTERS = [['green', 'მწვანე თბილისი'], ['oldtown', 'ძველი ქალაქი'], ['horizon', 'ჰორიზონტი'], ['culture', 'კულტურა']];
  const MISSION_ICONS = [['trees', 'პარკი'], ['landmark', 'ღირშესანიშნაობა'], ['waves', 'ტბა'], ['mountain', 'მთა'], ['bridge', 'ხიდი'], ['flower', 'ბაღი']];
  const AUDIT_ACTIONS = { GIFT_SAVE: 'საჩუქარი შეინახა', MISSION_SAVE: 'მისია შეინახა', CLAIM_REVIEW: 'ჯილდოს განაცხადი დამუშავდა', SESSION_REVIEW: 'სესია შემოწმდა', CONFIG_SAVE: 'პარამეტრები შეიცვალა' };
  const BOX_KIND = { am: 'დილის ყუთი', ev: 'საღამოს ყუთი', sat: 'შაბათის წვიმა', saturday: 'შაბათის წვიმა', lan: 'ფარნის ყუთი', lantern: 'ფარნის ყუთი', grand: 'დიდი საჩუქარი' };
  const badge = (pair, fallback = '') => (pair ? `<span class="s-badge ${pair[1]}">${esc(pair[0])}</span>` : esc(fallback));
  const metric = (label, value, hint, tone = '') => `<div class="s-metric${tone ? ` ${tone}` : ''}"><span>${esc(label)}</span><strong>${value}</strong>${hint ? `<small>${esc(hint)}</small>` : ''}</div>`;
  const sub = (html) => `<small class="s-run-sub">${html}</small>`;

  /** Autopilot gift ids look like glow-2026-10-05-am-01. */
  function campaignLabel(id) {
    const m = /^glow-\d{4}-\d{2}-\d{2}-([a-z]+)/.exec(String(id || ''));
    return m ? `„გაანათე თბილისი“ · ${BOX_KIND[m[1]] || 'კამპანიის ყუთი'}` : '';
  }

  const missionStatus = (m) => (m.archived ? ['არქივი', 'is-plain'] : m.published ? ['გამოქვეყნებული', 'is-ok'] : ['მონახაზი', 'is-plain']);

  function place(latitude, longitude) {
    const lat = Number(latitude);
    const lng = Number(longitude);
    const tbilisi = lat > 41.55 && lat < 41.9 && lng > 44.5 && lng < 45.1;
    const href = `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=17/${lat}/${lng}`;
    return `${tbilisi ? 'თბილისი' : 'თბილისის გარეთ'} · <a href="${href}" target="_blank" rel="noopener noreferrer" title="${esc(`${num(lat, 5)}, ${num(lng, 5)}`)}">რუკაზე</a>`;
  }

  function duration(seconds) {
    const s = Math.max(0, Math.round(Number(seconds) || 0));
    if (s < 60) return `${s} წმ`;
    const h = Math.floor(s / 3600);
    const m = Math.round((s % 3600) / 60);
    return h ? `${h} სთ ${m} წთ` : `${m} წთ`;
  }

  /** The log keeps actor ids: name the autopilot and the signed-in admin, show other ids as a copyable detail. */
  function actorName(id) {
    if (id === 'medirun-autopilot') return 'ავტოპილოტი';
    const me = state.admin;
    if (me && id && id === me.id) return esc(me.fullName || me.email || 'შენ');
    return `სხვა ადმინი ${copyId(id, 'ადმინის ID')}`;
  }

  function auditSummary(row) {
    const d = row.details || {};
    if (row.action === 'GIFT_SAVE') {
      if (d.autopilot) return `${BOX_KIND[d.kind] || 'კამპანიის ყუთი'}${d.coins ? ` · ${fmt(d.coins)} Medi Coins` : ''}${d.minPercent ? ` · ჩანს ${num(d.minPercent)}%-იდან` : ''}`;
      const title = d.after?.title || d.before?.title;
      return `${d.before ? 'შეიცვალა' : 'დაემატა'}${title ? `: ${title}` : ''}`;
    }
    if (row.action === 'MISSION_SAVE') {
      const a = d.after || {};
      return `${d.before ? 'შეიცვალა' : 'დაემატა'} · ${a.archived ? 'არქივშია' : a.published ? 'გამოქვეყნებულია' : 'მონახაზია'}`;
    }
    if (row.action === 'CLAIM_REVIEW') return `${CLAIM[d.from]?.[0] || '—'} → ${CLAIM[d.to]?.[0] || '—'}${d.reason ? ` · ${d.reason}` : ''}`;
    if (row.action === 'SESSION_REVIEW') return `${d.excluded ? 'რეიტინგიდან გამოირიცხა' : 'რეიტინგში დაბრუნდა'}${d.reason ? ` · ${d.reason}` : ''}`;
    if (row.action === 'CONFIG_SAVE') {
      const before = d.before || {};
      const after = d.after || {};
      const names = { enabled: 'თამაში', giftsEnabled: 'საჩუქრები', leaderboardEnabled: 'რეიტინგი' };
      const changes = Object.entries(names).filter(([k]) => before[k] !== after[k]).map(([k, n]) => `${n} ${after[k] ? 'ჩაირთო' : 'გამოირთო'}`);
      if ((before.message || '') !== (after.message || '')) changes.push('შეტყობინება შეიცვალა');
      return changes.join(' · ') || 'ცვლილების გარეშე';
    }
    return '';
  }

  function auditEntity(row) {
    if (row.action === 'CONFIG_SAVE') return 'თამაშის პარამეტრები';
    if (row.action === 'MISSION_SAVE') return `მისია <code class="s-run-code">${esc(row.entityId)}</code>`;
    const label = campaignLabel(row.entityId);
    return `${label ? `${esc(label)} ` : ''}${copyId(row.entityId, 'ჩანაწერის ID')}`;
  }

  function pager(total) {
    const last = offset + rows.length;
    return `<footer class="s-pager"><span>${rows.length ? `${fmt(offset + 1)}–${fmt(last)} / ${fmt(total)}` : '0'}</span><div>
      <button type="button" class="btn compact" data-run-page="-1" ${offset ? '' : 'disabled'}>${ico('chevronLeft')} წინა</button>
      <button type="button" class="btn compact" data-run-page="1" ${last < total ? '' : 'disabled'}>შემდეგი ${ico('arrow')}</button></div></footer>`;
  }

  function segment(options, label) {
    return `<div class="s-segment" role="tablist" aria-label="${esc(label)}">${options
      .map(([value, text]) => `<button type="button" role="tab" aria-selected="${filter === value}" data-run-filter="${value}">${esc(text)}</button>`).join('')}</div>`;
  }

  function table(headers, body, empty) {
    if (!body) return `<div class="s-empty">${ico('layers')}<span>${esc(empty)}</span></div>`;
    return `<div class="s-table-wrap"><table class="s-table s-run-table"><thead><tr>${headers
      .map((h) => (Array.isArray(h) ? `<th class="${h[1]}">${esc(h[0])}</th>` : `<th>${esc(h)}</th>`)).join('')}</tr></thead><tbody>${body}</tbody></table></div>`;
  }

  function card(title, note, bodyHtml, { action = '', flush = true, foot = '' } = {}) {
    return `<section class="s-card">
      <header class="s-card-head"><div><h3>${esc(title)}</h3>${note ? `<p>${note}</p>` : ''}</div>${action}</header>
      <div class="s-card-body${flush ? ' is-flush s-run-flush' : ''}">${bodyHtml}</div>${foot}
    </section>`;
  }

  const pct = (a, b) => (b ? `${Math.round((a / b) * 100)}%` : '—');
  const shortDay = (ymd) => { const [, m, d] = ymd.split('-').map(Number); return `${d} ${['იან', 'თებ', 'მარ', 'აპრ', 'მაი', 'ივნ', 'ივლ', 'აგვ', 'სექ', 'ოქტ', 'ნოე', 'დეკ'][m - 1]}`; };
  const BOXES = { campaign: ['კამპანია', 'is-ok'], ready: ['ყუთები ჩნდება', 'is-ok'], pending: ['ადგილებს ვეძებთ', 'is-info'], failed: ['ადგილები ვერ მოიძებნა', 'is-bad'], empty: ['ბილიკი ვერ მოიძებნა', 'is-warn'], off: ['გამორთულია', 'is-plain'], none: ['ჯერ არა', 'is-plain'] };

  function overviewHtml(d) {
    const cfg = d.config?.data || {}, i = d.insights;
    const alerts = [];
    if (cfg.enabled === false) alerts.push(`<div class="s-callout is-warn">${ico('alert')}<p><b>თამაში შეჩერებულია.</b> ახალი გასეირნება ვერ იწყება და მიმდინარე ვერ გრძელდება.</p><button type="button" class="btn compact" data-run-go="config">პარამეტრები</button></div>`);
    else if (cfg.giftsEnabled === false) alerts.push(`<div class="s-callout is-warn">${ico('alert')}<p><b>საჩუქრები გამორთულია.</b> ყუთის სიგნალი არ ჩანს და გახსნა შეჩერებულია.</p><button type="button" class="btn compact" data-run-go="config">პარამეტრები</button></div>`);
    if (i.prizes.pending || i.prizes.toHandOver) alerts.push(`<div class="s-callout is-warn">${ico('gift')}<p><b>${fmt(i.prizes.pending)} პრიზი ელოდება შემოწმებას${i.prizes.toHandOver ? `, ${fmt(i.prizes.toHandOver)} — გადაცემას` : ''}.</b> გაცემამდე გადაამოწმე მოთამაშე და GPS-ის მონაცემები.</p><button type="button" class="btn compact" data-run-pending>გახსნა</button></div>`);
    const flag = (on, label) => `<span class="s-badge ${on ? 'is-ok' : 'is-bad'}">${label}: ${on ? 'ჩართულია' : 'გამორთულია'}</span>`;
    const C = global.AdminCharts;
    const series = (key) => i.trend.map((t) => ({ day: shortDay(t.date), count: t[key] }));
    const topLevel = Math.max(1, ...i.levels.map((l) => l.players));
    return `${alerts.join('')}
      <div class="s-callout s-run-link">${ico('box')}<p><b>ყუთები ცალკე გვერდზეა.</b> წესები, დღეები, ქალაქები, ხელით დაგდება და ყუთების ციფრები — „MEDIRUN ყუთები“.</p><a class="btn compact" href="#/medirun-boxes">გახსნა</a></div>
      <div class="s-metrics">
        ${metric('მოთამაშე', fmt(i.players.total), `+${fmt(i.players.new7)} ბოლო 7 დღეში`)}
        ${metric('აქტიური 7 დღეში', fmt(i.players.active7), `ახლა თამაშობს: ${fmt(i.players.activeNow)}`, i.players.activeNow ? 'is-ok' : '')}
        ${metric('ბრუნდება', pct(i.players.returning, i.players.active30), `${fmt(i.players.returning)} / ${fmt(i.players.active30)} — 2+ დღე 30 დღეში`)}
        ${metric('გასეირნება', fmt(i.walks.total), `${fmt(i.walks.last7)} ბოლო 7 დღეში`)}
        ${metric('კილომეტრი', `${num(i.walks.km)}`, `${num(i.walks.km7)} კმ ბოლო 7 დღეში · ${num(i.walks.hours)} სთ სულ`)}
        ${metric('ახალი ქუჩა', `${num(i.walks.newKm)} კმ`, `${num(i.walks.newKm7)} კმ ბოლო 7 დღეში`)}
        ${metric('ქოინი ყუთებიდან', fmt(i.coins.total), `${fmt(i.coins.openings)} გახსნა · ${fmt(i.coins.last7)} ბოლო 7 დღეში`)}
        ${metric('პრიზი', fmt(i.prizes.pending + i.prizes.toHandOver), i.prizes.pending + i.prizes.toHandOver ? 'შესამოწმებელი ან გადასაცემი' : 'ყველაფერი გაცემულია', i.prizes.pending ? 'is-warn' : '')}
      </div>
      <div class="s-run-grid">
        ${card('გასეირნება და მოთამაშე დღეში', 'ბოლო 30 დღე · თბილისის დროით', C ? C.line([{ label: 'გასეირნება', points: series('walks') }, { label: 'მოთამაშე', points: series('players') }], { label: 'გასეირნება და მოთამაშე', height: 210, legend: true, empty: 'ამ პერიოდში გასეირნება არ ყოფილა' }) : '', { flush: false })}
        ${card('კილომეტრი დღეში', 'ბოლო 30 დღე', C ? C.bars(series('km'), { label: 'კილომეტრი დღეში', height: 210, unit: 'კმ', empty: 'ამ პერიოდში მანძილი არ არის' }) : '', { flush: false })}
      </div>
      <div class="s-run-grid">
        ${card('თბილისის დონეები', 'ვინ რამდენი % გაანათა თბილისიდან — ფარნის ყუთები და დიდი საჩუქარი ამის მიხედვით ჩანს.', `<div class="s-run-levels">${i.levels.map((l) => `<div class="s-run-level"><span><b>${esc(l.name)}</b><small>${num(l.percent, 2)}%-დან</small></span><div class="s-meter"><i style="width:${Math.round((l.players / topLevel) * 100)}%"></i></div><b>${fmt(l.players)}</b></div>`).join('')}</div>
          ${i.tbilisiTop.length ? `<div class="s-run-top"><small>ყველაზე მეტი</small>${i.tbilisiTop.map((t) => `<a href="#/users/${encodeURIComponent(t.userId)}">${esc(t.name || 'მოთამაშე')}</a><b>${num(t.percent, 3)}%</b>`).join('')}</div>` : ''}`, { flush: false })}
        ${card('გახსნილი ყუთები დღეში', 'ყველა ქალაქი · ბოლო 30 დღე', C ? C.bars(series('opened'), { label: 'გახსნა დღეში', height: 210, tone: 'amber', empty: 'ამ პერიოდში ყუთი არავის გაუხსნია' }) : '', { flush: false })}
      </div>
      ${card('თამაშის მდგომარეობა', `${cfg.message ? 'მოთამაშეები ხედავენ შენს შეტყობინებას.' : 'მოთამაშისთვის შეტყობინება არ არის.'}`,
        `<div class="s-run-flags">${flag(cfg.enabled !== false, 'თამაში')}${flag(cfg.giftsEnabled !== false, 'საჩუქრები')}${flag(cfg.leaderboardEnabled !== false, 'რეიტინგი')}</div>
         ${cfg.message ? `<blockquote class="s-run-message">${esc(cfg.message)}</blockquote>` : ''}`,
        { flush: false, action: `<button type="button" class="btn ghost compact" data-run-go="config">შეცვლა</button>` })}
      <p class="s-muted s-run-stamp">ციფრები განახლდა ${esc(when(i.generatedAt))} · ერთხელ 10 წუთში</p>`;
  }

  function geoHtml(i) {
    const countries = i.countries.map((c) => `<tr><td><b>${esc(c.nameKa || c.code)}</b>${sub(esc(c.code))}</td><td class="num">${fmt(c.players)}</td><td class="num">${fmt(c.homes)}</td><td class="num">${num(c.paintedKm2, 2)} კმ²</td></tr>`).join('');
    const cities = i.cities.map((c) => `<tr>
        <td><b>${esc(c.nameKa || c.nameEn)}</b>${sub(`${esc(c.nameEn && c.nameEn !== c.nameKa ? `${c.nameEn} · ` : '')}${esc(c.countryCode || '')}`)}</td>
        <td class="num">${fmt(c.players)}</td><td class="num">${fmt(c.homes)}</td>
        <td class="num">${num(c.paintedKm2, 2)} კმ²${sub(`${num(c.percent, 3)}% ქალაქიდან`)}</td>
        <td class="num">${fmt(c.opened)}${c.openers ? sub(`${fmt(c.openers)} მოთამაშე`) : ''}</td>
        <td>${badge(BOXES[c.boxes] || BOXES.none)}</td></tr>`).join('');
    return `${card('ქალაქები', '„ითამაშა“ — ვინც აქ გაისეირნა MEDIRUN-ით; „ცხოვრობს“ — ლოკაციით (იგივე ქალაქი, რაც აპში ჩანს); „გაანათა“ — ყველა მოთამაშის ახალი ქუჩები ერთად; „გაიხსნა“ — ყუთები ბოლო 30 დღეში.',
        table(['ქალაქი', ['ითამაშა', 'num'], ['ცხოვრობს', 'num'], ['გაანათა', 'num'], ['გაიხსნა', 'num'], 'ყუთები'], cities, 'ჯერ არცერთ ქალაქში არ უთამაშიათ.'),
        { action: '<a class="btn compact" href="#/medirun-boxes?tab=cities">ქალაქების ყუთები</a>' })}
      ${card('ქვეყნები', '', table(['ქვეყანა', ['ითამაშა', 'num'], ['ცხოვრობს', 'num'], ['გაანათა', 'num']], countries, 'ჯერ მონაცემი არ არის.'))}
      ${i.unresolvedKm2 > 0 ? `<p class="s-muted s-run-stamp">${num(i.unresolvedKm2, 2)} კმ² ჯერ ქალაქს არ მიეკუთვნა — ადგილი დაზუსტდება, როცა მოთამაშე აპში თავის ქალაქს გახსნის.</p>` : ''}`;
  }

  function playersHtml(i) {
    const body = i.top.map((p, n) => `<tr>
        <td class="num s-run-rank">${n + 1}</td>
        <td><a href="#/users/${encodeURIComponent(p.userId)}"><b>${esc(p.name || 'მოთამაშე')}</b></a>${sub(`${esc(p.handle || '')}${p.optIn ? ' · რეიტინგშია' : ''}`)}</td>
        <td class="num"><b>${num(p.km)}</b> კმ</td><td class="num">${fmt(p.walks)}</td><td class="num">${num(p.newKm)} კმ</td><td class="num">${num(p.hours)} სთ</td>
        <td class="num">${fmt(p.opened)}${p.coins ? sub(`${fmt(p.coins)} ქოინი`) : ''}</td><td class="num">${p.tbilisiPercent ? `${num(p.tbilisiPercent, 3)}%` : '—'}</td></tr>`).join('');
    return card('ყველაზე აქტიური · 30 დღე', 'კილომეტრის მიხედვით; გამორიცხული გასეირნებები არ ითვლება. სახელზე დაჭერით მომხმარებლის გვერდი იხსნება.',
      table([['#', 'num'], 'მოთამაშე', ['მანძილი', 'num'], ['გასეირნება', 'num'], ['ახალი ქუჩა', 'num'], ['დრო', 'num'], ['ყუთი', 'num'], ['თბილისი', 'num']], body, 'ბოლო 30 დღეში არავის უთამაშია.'))
      + `<div class="s-metrics">${metric('რეიტინგში ჩართული', fmt(i.players.optIn), `${pct(i.players.optIn, i.players.total)} მოთამაშიდან`)}${metric('ბრუნდება', pct(i.players.returning, i.players.active30), '2+ დღე ბოლო 30 დღეში')}${metric('ახალი 7 დღეში', fmt(i.players.new7), 'პირველად გახსნა MEDIRUN')}</div>`;
  }

  function claimsHtml(data) {
    const review = can('MEDIPULSI_REVIEW');
    const body = rows.map((c) => {
      const coins = Number(c.reward?.coins) || 0;
      const digital = c.reward?.kind !== 'PHYSICAL';
      // Digital boxes are approved automatically and their Medi Coins are credited in the same step: nothing to process.
      const actionable = c.status === 'PENDING' || (c.status === 'APPROVED' && !(digital && coins));
      const action = review && actionable
        ? `<button type="button" class="btn compact" data-run-action="claim" data-id="${esc(c.id)}">დამუშავება</button>`
        : c.status === 'APPROVED' && digital && coins ? '<span class="s-muted s-run-auto">ავტომატურად ჩაირიცხა</span>' : '';
      return `<tr>
        <td><b>${esc(c.reward?.title || '—')}</b>${sub(`${digital ? 'ციფრული' : 'ფიზიკური'}${coins ? ` · ${fmt(coins)} Medi Coins` : ''}`)}${sub(`კოდი <code class="s-run-code">${esc(c.code)}</code>`)}</td>
        <td>${c.userId ? `<a href="#/users/${encodeURIComponent(c.userId)}"><b>${esc(c.user?.fullName || 'მოთამაშე')}</b></a>` : '<b>—</b>'}</td>
        <td class="s-run-when">${esc(when(c.createdAt))}</td>
        <td>${badge(CLAIM[c.status], c.status)}${c.note ? sub(esc(c.note)) : ''}</td>
        <td class="num">${action}</td>
      </tr>`;
    }).join('');
    return card('ჯილდოების გაცემა', 'ციფრული ჯილდო ავტომატურად დასტურდება. ფიზიკურ პრიზს ჯერ ადასტურებ, გადაცემის შემდეგ — „გაცემულად“ მონიშნავ.',
      table(['პრიზი', 'მოთამაშე', 'მიღების დრო', 'სტატუსი', ['მოქმედება', 'num']], body, filter ? 'ამ სტატუსით განაცხადი არ არის.' : 'განაცხადი ჯერ არ არის.'),
      { action: segment([['', 'ყველა'], ['PENDING', 'შესამოწმებელი'], ['APPROVED', 'დადასტურებული'], ['FULFILLED', 'გაცემული'], ['REJECTED', 'უარყოფილი']], 'სტატუსის ფილტრი'), foot: pager(data.total) });
  }

  function missionsHtml() {
    const manage = can('MEDIPULSI_MANAGE');
    const chapter = Object.fromEntries(CHAPTERS);
    const body = rows.map((m) => {
      const d = m.data || {};
      const [lng, lat] = d.center || [];
      return `<tr>
        <td><b>${esc(d.name)}</b>${sub(`${esc(d.title || '')}${d.title ? ' · ' : ''}${esc(chapter[d.chapter] || 'კოლექცია')}`)}${sub(`კოდი <code class="s-run-code">${esc(m.id)}</code>`)}</td>
        <td>${lat != null ? place(lat, lng) : '—'}${sub(`ზონის რადიუსი ${fmt(d.radius)} მ`)}</td>
        <td>${fmt(d.meters)} მ${sub(`მოძრაობა მინიმუმ ${duration(d.seconds)}`)}</td>
        <td>${badge(missionStatus(m))}</td>
        <td class="num">${manage ? `<button type="button" class="btn ghost compact" data-run-action="edit" data-id="${esc(m.id)}">რედაქტირება</button>` : ''}</td>
      </tr>`;
    }).join('');
    const live = rows.filter((m) => m.published && !m.archived).length;
    return card('თბილისის მისიები', `${fmt(live)} გამოქვეყნებული, ${fmt(rows.length)} სულ. ზონაში გავლილი მანძილი და მოძრაობის დრო ხსნის შტამპს.`,
      table(['მისია', 'ადგილი', 'მიზანი', 'მდგომარეობა', ''], body, 'მისია ჯერ არ დამატებულა.'),
      { action: manage ? `<button type="button" class="btn primary compact" data-run-action="new">${ico('plus')} ახალი მისია</button>` : '' });
  }

  function sessionsHtml(data) {
    const review = can('MEDIPULSI_REVIEW');
    const body = rows.map((s) => `<tr>
        <td>${s.userId ? `<a href="#/users/${encodeURIComponent(s.userId)}"><b>${esc(s.user?.fullName || 'მოთამაშე')}</b></a>` : '<b>—</b>'}${sub(`სესია ${copyId(s.id, 'სესიის ID')}`)}</td>
        <td class="s-run-when">${esc(when(s.startedAt))}${sub(`${duration(s.seconds)} · მოძრაობა ${duration(s.movingSeconds)}`)}</td>
        <td class="num">${num((Number(s.meters) || 0) / 1000, 2)} კმ${sub(`მაქს. ${num(s.maxSpeed)} კმ/სთ`)}${s.rejected ? sub(`${fmt(s.rejected)} GPS წერტილი გამოტოვდა`) : ''}</td>
        <td class="num">≈ ${fmt(Math.round(Number(s.steps) || 0))}</td>
        <td class="num">${fmt(Math.round(Number(s.newMeters) || 0))} მ</td>
        <td>${badge(PHASE[s.phase], s.phase)}${s.excluded ? ' <span class="s-badge is-bad">გამორიცხული</span>' : ''}</td>
        <td class="num">${review ? `<button type="button" class="btn compact${s.excluded ? '' : ' danger'}" data-run-action="review" data-id="${esc(s.id)}">${s.excluded ? 'აღდგენა' : 'გამორიცხვა'}</button>` : ''}${s.reviewNote ? sub(esc(s.reviewNote)) : ''}</td>
      </tr>`).join('');
    return card('გასეირნებები', 'GPS-ის გაზომვა შეფასებაა. საეჭვო სესია (მანქანა, GPS-ის ნახტომები) გამორიცხე რეიტინგიდან — პირადი ისტორია რჩება.',
      table(['მოთამაშე', 'დაწყება', ['მანძილი', 'num'], ['ნაბიჯი', 'num'], ['ახალი ბილიკი', 'num'], 'სტატუსი', ['შემოწმება', 'num']], body, filter ? 'ამ სტატუსით სესია არ არის.' : 'სესია ჯერ არ არის.'),
      { action: segment([['', 'ყველა'], ['ACTIVE', 'მიმდინარე'], ['PAUSED', 'პაუზაზე'], ['FINISHED', 'დასრულებული']], 'სესიის ფილტრი'), foot: pager(data.total) });
  }

  function configHtml(data) {
    const manage = can('MEDIPULSI_MANAGE');
    const d = data.data || {};
    const toggleRow = (name, label, hint, on) => `<label class="s-switch-row"><div><b>${esc(label)}</b><small>${esc(hint)}</small></div><input class="s-switch" type="checkbox" role="switch" name="${name}" ${on ? 'checked' : ''}></label>`;
    return `<section class="s-card">
      <header class="s-card-head"><div><h3>თამაშის პარამეტრები</h3><p>ცვლილება მოთამაშეებს მაშინვე შეეხება და ჩაიწერება ჟურნალში.</p></div></header>
      <form data-config><fieldset class="s-run-fieldset" ${manage ? '' : 'disabled'}>
        <div class="s-card-body">
          ${toggleRow('enabled', 'თამაში ჩართულია', 'გამორთვისას ახალი სირბილი ვერ დაიწყება და მიმდინარე ვერ გაგრძელდება.', d.enabled)}
          ${toggleRow('giftsEnabled', 'საჩუქრები ჩართულია', 'გამორთვისას ყუთის სიგნალი ქრება და გახსნა ჩერდება.', d.giftsEnabled)}
          ${toggleRow('leaderboardEnabled', 'რეიტინგი ჩართულია', 'გამორთვისას რეიტინგი ცარიელი ჩანს.', d.leaderboardEnabled)}
          <label class="s-field s-run-message-field"><span>შეტყობინება მოთამაშეებისთვის</span>
            <input name="message" type="text" value="${esc(d.message || '')}" maxlength="300" placeholder="მაგ. „გაანათე თბილისი“ იწყება შაბათს!">
            <small><span data-count>${fmt(String(d.message || '').length)}</span> / 300</small></label>
        </div>
        ${manage ? `<footer class="s-card-foot"><span class="s-foot-note" role="status"></span><button class="btn primary" type="submit" disabled>შენახვა</button></footer>` : ''}
      </fieldset></form>
      <details class="s-details"><summary>${ico('shield')} GPS-ის წესები</summary><div>
        <p>სიზუსტე ≤25 მ, სიჩქარე ≤7 მ/წმ, უწყვეტი ნიმუშების შუალედი ≤15 წმ. პაუზები გზას არ აერთებს. ოფლაინ ჩანაწერი მიიღება 24 საათამდე.</p>
      </div></details>
    </section>`;
  }

  function auditHtml(data) {
    const body = rows.map((row) => `<tr>
        <td class="s-run-when">${esc(when(row.createdAt))}</td>
        <td class="s-run-when">${actorName(row.actorId)}</td>
        <td><b>${esc(AUDIT_ACTIONS[row.action] || 'ცვლილება')}</b>${auditSummary(row) ? sub(esc(auditSummary(row))) : ''}</td>
        <td>${auditEntity(row)}</td>
        <td><details class="s-details s-tech-details"><summary>ნახვა</summary><div><pre>${esc(JSON.stringify(row.details, null, 2))}</pre></div></details></td>
      </tr>`).join('');
    return card('ცვლილებების ჟურნალი', 'ვინ რა შეცვალა თამაშში (მისიები, გასეირნებები, პრიზები, პარამეტრები), უახლესი ზემოთ. ყუთების ცვლილებები — „MEDIRUN ყუთები → ჟურნალი“.',
      table(['დრო', 'ვინ', 'ცვლილება', 'ჩანაწერი', 'ტექნიკური დეტალები'], body, 'ჩანაწერი ჯერ არ არის.'), { foot: pager(data.total) });
  }

  async function render() {
    const root = document.getElementById('tab-medipulsi');
    if (!root) return;
    const version = ++ticket;
    root.innerHTML = `<div class="s-stack v3-tab-shell s-run">
      <div class="s-tabbar">
        <nav class="v3-subnav" role="tablist" aria-label="MEDIRUN-ის განყოფილებები">${TABS.map(([id, label]) => `<button type="button" role="tab" class="v3-subnav-btn${selected === id ? ' is-active' : ''}" aria-selected="${selected === id}" data-run-tab="${id}">${label}</button>`).join('')}</nav>
        <button type="button" class="btn ghost compact" data-run-refresh>${ico('refresh')}<span>განახლება</span></button>
      </div>
      <div class="s-stack s-run-body" aria-live="polite"><div class="v3-skel" aria-hidden="true">${'<i></i>'.repeat(5)}</div></div>
    </div>`;
    root.querySelectorAll('[data-run-tab]').forEach((b) => (b.onclick = () => { selected = b.dataset.runTab; offset = 0; filter = ''; void render(); }));
    root.querySelector('[data-run-refresh]').onclick = () => { render.fresh = true; void render(); };
    const body = root.querySelector('.s-run-body');
    try {
      if (!can('MEDIPULSI_VIEW')) throw new Error('MEDIRUN-ის ნახვის უფლება არ გაქვს.');
      const fresh = render.fresh ? '?fresh=1' : '';
      render.fresh = false;
      const data = selected === 'overview' ? await Promise.all([request('/overview'), request('/insights' + fresh)]).then(([o, ins]) => ({ ...o, insights: ins }))
        : selected === 'geo' || selected === 'players' ? await request('/insights' + fresh)
        : await request('/' + selected + (['sessions', 'claims', 'audit'].includes(selected) ? `?offset=${offset}${selected === 'audit' ? '&scope=game' : ''}${filter ? '&' + (selected === 'sessions' ? 'phase' : 'status') + '=' + encodeURIComponent(filter) : ''}` : ''));
      if (version !== ticket) return;
      if (!data) throw new Error('სერვერმა მონაცემი არ დააბრუნა — სცადე განახლება.');
      rows = data.rows || [];
      body.innerHTML = {
        overview: () => overviewHtml(data),
        geo: () => geoHtml(data),
        players: () => playersHtml(data),
        claims: () => claimsHtml(data),
        missions: () => missionsHtml(),
        sessions: () => sessionsHtml(data),
        config: () => configHtml(data),
        audit: () => auditHtml(data),
      }[selected]();
      body.querySelectorAll('[data-run-filter]').forEach((b) => (b.onclick = () => { filter = b.dataset.runFilter; offset = 0; void render(); }));
      body.querySelectorAll('[data-run-page]').forEach((b) => (b.onclick = () => { offset += Number(b.dataset.runPage) * PAGE; void render(); }));
      body.querySelectorAll('[data-run-go]').forEach((b) => (b.onclick = () => { selected = b.dataset.runGo; offset = 0; filter = ''; void render(); }));
      body.querySelector('[data-run-pending]')?.addEventListener('click', () => { selected = 'claims'; offset = 0; filter = 'PENDING'; void render(); });
      global.AdminCharts?.hydrate?.();
      body.querySelectorAll('[data-run-action]').forEach((b) => (b.onclick = () => editor(rows.find((r) => r.id === b.dataset.id), b.dataset.runAction)));
      const cfg = body.querySelector('[data-config]');
      if (cfg) bindConfig(cfg, data);
    } catch (e) {
      if (version !== ticket) return;
      body.innerHTML = `<div class="s-card"><div class="s-empty" role="alert">${ico('alert')}<strong>ვერ ჩაიტვირთა</strong><span>${esc(e.message)}</span><button type="button" class="btn" data-run-retry>ხელახლა ცდა</button></div></div>`;
      body.querySelector('[data-run-retry]').onclick = () => void render();
    }
  }

  function bindConfig(cfg, data) {
    const save = cfg.querySelector('[type=submit]');
    const status = cfg.querySelector('[role=status]');
    const message = cfg.querySelector('[name=message]');
    const count = cfg.querySelector('[data-count]');
    const snapshot = () => JSON.stringify([...new FormData(cfg).entries()]);
    const initial = snapshot();
    const sync = () => {
      count.textContent = fmt(message.value.length);
      if (!save) return;
      const changed = snapshot() !== initial;
      save.disabled = !changed;
      status.textContent = changed ? 'შეუნახავი ცვლილება' : '';
    };
    cfg.addEventListener('input', sync);
    cfg.addEventListener('change', sync);
    cfg.onsubmit = async (event) => {
      event.preventDefault();
      if (!save) return;
      const input = new FormData(cfg);
      save.disabled = true;
      save.classList.add('is-loading');
      try {
        await request('/config', { method: 'PUT', body: { revision: data.revision, data: { enabled: input.has('enabled'), giftsEnabled: input.has('giftsEnabled'), leaderboardEnabled: input.has('leaderboardEnabled'), message: input.get('message') } } });
        toast('პარამეტრები შენახულია', 'ok');
        await render();
      } catch (e) {
        status.textContent = e.message || 'ვერ შეინახა';
        save.disabled = false;
      } finally {
        save.classList.remove('is-loading');
      }
    };
  }

  const field = (name, label, value, type = 'text', extra = '') => `<label class="s-field"><span>${esc(label)}</span><input name="${esc(name)}" type="${type}" value="${esc(value)}" ${extra}></label>`;
  const wideField = (...args) => field(...args).replace('class="s-field"', 'class="s-field s-run-wide"');
  const select = (name, label, value, options) => `<label class="s-field"><span>${esc(label)}</span><select name="${name}">${options.map(([v, t]) => `<option value="${esc(v)}" ${v === value ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select></label>`;
  const toggle = (name, label, value) => `<label class="s-switch-row"><div><b>${esc(label)}</b></div><input class="s-switch" type="checkbox" role="switch" name="${name}" ${value ? 'checked' : ''}></label>`;
  const group = (title, inner) => `<fieldset class="s-run-group"><legend>${esc(title)}</legend><div class="s-form-grid">${inner}</div></fieldset>`;

  function editor(row, action) {
    let title = '';
    let description = '';
    let fields = '';
    let wide = false;
    const located = selected === 'missions' && ['new', 'edit'].includes(action);
    if (selected === 'missions') {
      const m = row?.data || { id: '', name: '', chapter: 'green', center: [44.7509, 41.7098], radius: 200, meters: 300, seconds: 60, title: '', story: '', tip: 'იარე საჯარო საფეხმავლო სივრცეში.', icon: 'trees', source: 'https://www.openstreetmap.org/' };
      title = row ? 'მისიის რედაქტირება' : 'თბილისის ახალი მისია';
      description = 'ზონა საჯარო, უსაფრთხო ადგილზე დასვი. ცვლილება მაშინვე ჩანს აპში.';
      wide = true;
      fields = group('ადგილი', field('longitude', 'გრძედი', m.center[0], 'number', 'step="any" min="44.5" max="45.1" required') + field('latitude', 'განედი', m.center[1], 'number', 'step="any" min="41.55" max="41.9" required') + field('radius', 'რადიუსი · მ', m.radius, 'number', 'min="40" max="2000" required'))
        + group('მისია', field('id', 'მისიის კოდი', m.id, 'text', `required pattern="[a-zA-Z0-9_-]+" ${row ? 'readonly' : ''}`) + field('name', 'სახელი', m.name, 'text', 'required maxlength="100"') + select('chapter', 'კოლექცია', m.chapter, CHAPTERS) + select('icon', 'იკონკა', m.icon, MISSION_ICONS) + field('meters', 'გასავლელი მანძილი · მ', m.meters, 'number', 'min="50" max="10000" required') + field('seconds', 'მოძრაობის დრო · წმ', m.seconds, 'number', 'min="60" max="7200" required'))
        + group('ტექსტი აპში', field('title', 'სათაური', m.title) + field('source', 'წყაროს HTTPS ბმული', m.source, 'url', 'required') + wideField('story', 'ისტორია', m.story) + wideField('tip', 'ადგილზე მისვლის რჩევა', m.tip))
        + `<div class="s-run-toggles">${toggle('published', 'გამოქვეყნებულია', row?.published)}${toggle('archived', 'არქივში გადატანა', row?.archived)}</div>`;
    } else if (action === 'review') {
      title = row.excluded ? 'სესიის დაბრუნება რეიტინგში' : 'სესიის გამორიცხვა რეიტინგიდან';
      description = 'გავლილი გზის პირადი ისტორია რჩება. მიზეზი ჩაიწერება ჟურნალში.';
      fields = field('reason', 'მიზეზი', row.reviewNote, 'text', 'required minlength="5" maxlength="500"');
    } else if (action === 'claim') {
      const e = row.reward?.evidence || {};
      const fact = (label, value) => `<div><dt>${label}</dt><dd>${value}</dd></div>`;
      title = 'ჯილდოს დამუშავება';
      description = `${row.reward?.title || ''} · კოდი ${row.code}`;
      fields = `<dl class="s-run-facts">
          ${fact('მოთამაშე', esc(row.user?.fullName || '—'))}
          ${fact('მიღების დრო', esc(when(row.createdAt)))}
          ${e.accuracy != null ? fact('GPS-ის სიზუსტე', `${num(e.accuracy)} მ`) : ''}
          ${e.distance != null ? fact('მანძილი ყუთამდე', `${num(e.distance)} მ`) : ''}
          ${e.sessionMeters != null ? fact('სესიაში გავლილი', `${fmt(e.sessionMeters)} მ`) : ''}
          ${e.rejectedFixes != null ? fact('გამოტოვებული GPS წერტილი', fmt(e.rejectedFixes)) : ''}
        </dl>`
        + select('status', 'ახალი სტატუსი', '', row.status === 'PENDING' ? [['APPROVED', 'დადასტურება'], ['REJECTED', 'უარყოფა']] : [['FULFILLED', 'გაცემის დადასტურება'], ['REJECTED', 'უარყოფა']])
        + field('reason', 'შემოწმების შედეგი / გაცემის შენიშვნა', '', 'text', 'required minlength="5" maxlength="500"');
    }
    if (located) {
      fields = `<div class="s-run-map-section">
          <div class="s-run-map-picks" hidden><button type="button" class="btn compact" data-run-pick="tbilisi">თბილისი</button></div>
          <div class="s-run-map" role="region" aria-label="ადგილმდებარეობის არჩევა" hidden></div>
          <small class="s-run-map-status">რუკა იტვირთება…</small>
        </div>${fields}`;
    }
    let cleanup = null;
    const dialog = V().openDialog({
      title,
      description,
      wide,
      body: `<form id="run-editor" class="s-run-form">${fields}</form>`,
      footer: '<p class="s-form-msg" role="status"></p><button type="button" class="btn" data-run-cancel>გაუქმება</button><button type="submit" class="btn primary" form="run-editor">შენახვა</button>',
      onClose: () => cleanup?.(),
    });
    const form = document.getElementById('run-editor');
    const panel = form?.closest('.v3-dialog-panel');
    if (!form || !panel) return;
    panel.classList.add('s-run-dialog');
    if (action === 'review' && !row.excluded) panel.classList.add('is-danger');
    panel.querySelector('[data-run-cancel]').onclick = () => void dialog.close();
    if (located) void locationPicker(panel, (fn) => { cleanup = fn; });
    form.onsubmit = (event) => {
      event.preventDefault();
      const f = new FormData(form);
      const str = (n) => String(f.get(n) || '');
      const n = (key) => Number(f.get(key));
      void submit(panel, dialog, () => {
        if (selected === 'missions') {
          const key = str('id');
          return request('/missions/' + key, { method: 'PUT', body: { revision: row?.revision || 0, published: f.has('published'), archived: f.has('archived'), data: { id: key, name: str('name'), chapter: str('chapter'), icon: str('icon'), center: [n('longitude'), n('latitude')], radius: n('radius'), meters: n('meters'), seconds: n('seconds'), title: str('title'), story: str('story'), tip: str('tip'), source: str('source') } } });
        }
        if (action === 'review') return request('/sessions/' + row.id + '/review', { method: 'PATCH', body: { excluded: !row.excluded, reason: str('reason') } });
        return request('/claims/' + row.id, { method: 'PATCH', body: { status: str('status'), reason: str('reason') } });
      });
    };
  }

  async function submit(panel, dialog, task) {
    const btn = panel.querySelector('[type=submit]');
    const message = panel.querySelector('[role=status]');
    btn.disabled = true;
    btn.classList.add('is-loading');
    message.textContent = '';
    try {
      await task();
      V().setDirty?.(false);
      await dialog.close();
      toast('შენახულია', 'ok');
      await render();
    } catch (e) {
      message.textContent = e.message || 'ვერ შეინახა';
      btn.disabled = false;
      btn.classList.remove('is-loading');
    }
  }

  let mapLoader;
  async function locationPicker(panel, onCleanup) {
    const host = panel.querySelector('.s-run-map');
    const picks = panel.querySelector('.s-run-map-picks');
    const status = panel.querySelector('.s-run-map-status');
    try {
      const config = await request('/map');
      if (!config.token) throw new Error('რუკის გასაღები მიუწვდომელია. კოორდინატები ხელით ჩაწერე.');
      if (!global.mapboxgl) {
        mapLoader ??= new Promise((resolve, reject) => {
          const script = document.createElement('script');
          script.src = 'https://api.mapbox.com/mapbox-gl-js/v3.14.0/mapbox-gl.js';
          script.onload = resolve;
          script.onerror = () => { mapLoader = null; reject(new Error('რუკა ვერ ჩაიტვირთა. კოორდინატები ხელით ჩაწერე.')); };
          document.head.appendChild(script);
          const css = document.createElement('link');
          css.rel = 'stylesheet';
          css.href = 'https://api.mapbox.com/mapbox-gl-js/v3.14.0/mapbox-gl.css';
          document.head.appendChild(css);
        });
        await mapLoader;
      }
      if (!panel.isConnected) return;
      const lon = panel.querySelector('[name=longitude]');
      const lat = panel.querySelector('[name=latitude]');
      const radius = panel.querySelector('[name=radius]') || panel.querySelector('[name=pulseRadius]');
      const point = () => [Number(lon.value), Number(lat.value)];
      host.hidden = false;
      picks.hidden = false;
      const map = new global.mapboxgl.Map({ container: host, accessToken: config.token, style: 'mapbox://styles/mapbox/light-v11', center: point(), zoom: 15, attributionControl: true });
      onCleanup(() => map.remove());
      const marker = new global.mapboxgl.Marker({ color: '#0D9488', draggable: true }).setLngLat(point()).addTo(map);
      const draw = () => {
        if (!map.isStyleLoaded()) return;
        const [x, y] = point();
        const r = Number(radius.value) || 100;
        const ring = Array.from({ length: 65 }, (_, i) => {
          const a = (i / 64) * Math.PI * 2;
          return [x + (Math.cos(a) * r) / (111195 * Math.cos((y * Math.PI) / 180)), y + (Math.sin(a) * r) / 111195];
        });
        const data = { type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [ring] } };
        if (map.getSource('range')) map.getSource('range').setData(data);
        else {
          map.addSource('range', { type: 'geojson', data });
          map.addLayer({ id: 'range-fill', type: 'fill', source: 'range', paint: { 'fill-color': '#14B8A6', 'fill-opacity': 0.14 } });
          map.addLayer({ id: 'range-border', type: 'line', source: 'range', paint: { 'line-color': '#0D9488', 'line-width': 2 } });
        }
      };
      const update = (p) => {
        lon.value = p[0].toFixed(6);
        lat.value = p[1].toFixed(6);
        marker.setLngLat(p);
        draw();
      };
      map.on('load', draw);
      map.on('click', (e) => update([e.lngLat.lng, e.lngLat.lat]));
      marker.on('dragend', () => { const p = marker.getLngLat(); update([p.lng, p.lat]); });
      [lon, lat, radius].forEach((input) => input.addEventListener('change', () => { marker.setLngLat(point()); map.easeTo({ center: point(), duration: 300 }); draw(); }));
      panel.querySelector('[data-run-pick=tbilisi]').onclick = () => { update([44.7509, 41.7098]); map.flyTo({ center: point(), zoom: 15 }); };
      const world = panel.querySelector('[data-run-pick=world]');
      if (world) world.onclick = () => { map.flyTo({ center: point(), zoom: 2 }); status.textContent = 'აირჩიე ნებისმიერი ქვეყანა; გაადიდე რუკა და მოათავსე საჩუქარი საჯარო ბილიკზე.'; };
      status.textContent = 'პინი გადაადგილდება შეხებით ან გადათრევით.';
    } catch (e) {
      host.hidden = true;
      picks.hidden = true;
      status.textContent = e.message;
    }
  }

  global.renderMedipulsi = render;
  // The restored tab can be selected before this deferred module is registered.
  if (typeof state !== 'undefined' && state.admin && state.tab === 'medipulsi') void render();
})(window);
