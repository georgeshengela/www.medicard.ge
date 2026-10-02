/**
 * MediCard Admin V3 — Rewards (overrides renderRewards from rewards-admin.js).
 * URL: #/rewards?tab=overview|campaigns|partners|redemptions|codes|referrals&edit=new
 * Loaded after rewards-admin.js + admin-v3.js + AdminV3Shell. Markup: v4 s-* components.
 */
(function adminV3Rewards(global) {
  const Shell = () => global.AdminV3Shell || {};
  const V = () => global.AdminV3 || {};
  const $ = (id) => document.getElementById(id);

  const TABS = [
    ['overview', 'მიმოხილვა'],
    ['store', 'მაღაზია'],
    ['campaigns', 'კამპანიები'],
    ['partners', 'პარტნიორები'],
    ['redemptions', 'გაცვლები'],
    ['codes', 'კოდების მარაგი'],
    ['referrals', 'მოწვევები'],
  ];
  const TAB_KEYS = new Set(TABS.map(([k]) => k));

  /** Every rewards status (partner, campaign, reward, redemption, code, stock): [Georgian word, badge tone]. */
  const STATUS = {
    DRAFT: ['მონახაზი', ''],
    SCHEDULED: ['დაგეგმილი', 'info'],
    ACTIVE: ['აქტიური', 'ok'],
    PAUSED: ['შეჩერებული', 'warn'],
    ENDED: ['დასრულებული', ''],
    ARCHIVED: ['დაარქივებული', ''],
    INACTIVE: ['არააქტიური', ''],
    PENDING: ['მოლოდინში', 'warn'],
    ISSUED: ['გაცემული', 'info'],
    USED: ['გამოყენებული', 'ok'],
    EXPIRED: ['ვადაგასული', ''],
    CANCELLED: ['გაუქმებული', 'bad'],
    AVAILABLE: ['ხელმისაწვდომი', 'ok'],
    RESERVED: ['დაჯავშნილი', 'info'],
    DISABLED: ['გამორთული', 'bad'],
    OK: ['საკმარისი', 'ok'],
    LOW: ['დაბალი', 'warn'],
    OUT: ['ამოწურული', 'bad'],
    UNLIMITED: ['ულიმიტო', ''],
  };
  /** A used code is simply spent — not a success state like a used voucher. */
  const CODE_TONES = { USED: '', EXPIRED: '' };
  const CATEGORY_KA = {
    PHARMACY: 'აფთიაქი',
    LAB: 'ლაბორატორია',
    FITNESS: 'ფიტნესი',
    WELLNESS: 'ველნესი',
    FOOD: 'კვება',
    RETAIL: 'საცალო ვაჭრობა',
    INSURANCE: 'დაზღვევა',
    CLINIC: 'კლინიკა',
    OTHER: 'სხვა',
  };
  const FUNDING_KA = {
    PER_REDEMPTION: 'თითო გაცვლაზე',
    PER_USED: 'თითო გამოყენებაზე',
    SPONSORED_FIXED: 'სპონსორი · ფიქსირებული თანხა',
    AFFILIATE: 'აფილიატი',
    INTERNAL: 'შიდა (Medicard)',
  };
  const REWARD_TYPE_KA = {
    DIGITAL_PERK: 'ციფრული ბონუსი',
    PREMIUM_ACCESS: 'Premium წვდომა',
    PARTNER_VOUCHER: 'პარტნიორის ვაუჩერი',
    COUPON_CODE: 'კუპონის კოდი',
    PHYSICAL_PRIZE: 'ფიზიკური საჩუქარი',
  };
  const COUNTRY_KA = { GE: 'საქართველო' };
  /** Built-in rewards keep an app translation key instead of a title (mobile/src/i18n/quest/rewards.js). */
  const BUILTIN_TITLE_KA = {
    MEDI_THEME_7D: 'Medi Quest სტილი — 7 დღე',
    MEDI_PROFILE_STYLE_30D: 'პროფილის აქცენტი — 30 დღე',
    MEDI_PREMIUM_DAY: '1 დღე Premium',
    MEDI_PREMIUM_3D: '3 დღე Premium',
    PARTNER_TEST_10: 'სატესტო პარტნიორის ვაუჩერი',
    'reward.mediTheme7d.title': 'Medi Quest სტილი — 7 დღე',
    'reward.mediProfileStyle30d.title': 'პროფილის აქცენტი — 30 დღე',
    'reward.mediPremiumDay.title': '1 დღე Premium',
    'reward.mediPremium3d.title': '3 დღე Premium',
    'reward.partnerTest10.title': 'სატესტო პარტნიორის ვაუჩერი',
  };
  const NOTE_KA = {
    redeem: 'გაცვალა აპში',
    admin_mark_used: 'ადმინმა მონიშნა გამოყენებულად',
    handed_over: 'გადაეცა მომხმარებელს',
    admin_cancel: 'ადმინმა გააუქმა, მონეტები დაბრუნდა',
    partner_unavailable: 'პარტნიორი მიუწვდომელია',
  };
  const REFERRAL_STATUS = {
    PENDING: ['ელოდება', 'warn'],
    REWARDED: ['დარიცხულია', 'ok'],
    EXPIRED: ['ვადაგასული', ''],
    REJECTED: ['უარყოფილი', 'bad'],
  };
  const REFERRAL_REASON_KA = {
    NO_ACTION: 'მოწვეულმა 30 დღეში ჩანაწერი არ გააკეთა',
    INVITER_NOT_ELIGIBLE: 'მომწვევს ლიმიტი ამოეწურა ან ტელეფონი არ აქვს დადასტურებული',
  };
  /** The rewards API answers in English for business-rule errors — say what happened and what to do. */
  const ERROR_KA = [
    [/partner must be ACTIVE/i, 'პარტნიორი აქტიური არ არის — ჯერ გაააქტიურე „პარტნიორებში“.'],
    [/titleKey required|title required/i, 'ჯილდოს სახელი აკლია.'],
    [/descriptionKey required/i, 'ჯილდოს აღწერა აკლია.'],
    [/coinCost invalid/i, 'ფასი (Medi Coins) უნდა იყოს მინიმუმ 1.'],
    [/entitlementKey required/i, 'ციფრულ ჯილდოს აპში გასაცემი ბონუსი არ აქვს მიბმული.'],
    [/PREMIUM_ACCESS fulfillment unavailable/i, 'Premium წვდომის გაცემა ჯერ არ მუშაობს.'],
    [/campaign name required/i, 'კამპანიას სახელი აკლია.'],
    [/invalid date range/i, 'დასრულება დაწყებაზე გვიან უნდა იყოს.'],
    [/geo-restricted/i, 'ქვეყნით შეზღუდული კამპანია ჯერ ვერ გააქტიურდება.'],
    [/marketCountryCode/i, 'ქვეყნის კოდი არასწორია (ორი ასო, მაგ. GE).'],
    [/commercialCurrency must be ISO-4217/i, 'ვალუტა სამი ასოთი ჩაწერე, მაგ. GEL.'],
    [/invalid fundingModel/i, 'დაფინანსების ტიპი არასწორია.'],
    [/code pool invalid/i, 'კოდების მარაგი არასწორია.'],
    [/CODE_POOL only/i, 'კოდების ატვირთვა მხოლოდ კოდებიან ჯილდოზეა შესაძლებელი.'],
    [/partner not found/i, 'პარტნიორი ვერ მოიძებნა — განაახლე გვერდი.'],
    [/reward not found/i, 'ჯილდო ვერ მოიძებნა — განაახლე გვერდი.'],
    [/campaign not found/i, 'კამპანია ვერ მოიძებნა — განაახლე გვერდი.'],
    [/redemption not found/i, 'გაცვლა ვერ მოიძებნა — განაახლე სია.'],
    [/code not found/i, 'კოდი ვერ მოიძებნა — განაახლე სია.'],
    [/^not found$/i, 'ჩანაწერი ვერ მოიძებნა — განაახლე გვერდი.'],
    [/key invalid/i, 'გასაღები მინიმუმ 3 სიმბოლოა (A–Z, 0–9, _).'],
    [/invalid category/i, 'კატეგორია არასწორია.'],
    [/invalid (partner|campaign) status/i, 'სტატუსი არასწორია.'],
    [/invalid inventory mode/i, 'მარაგის ტიპი არასწორია.'],
  ];

  let renderSeq = 0;
  // Glyphs the store tab uses (same 24px stroke family as admin.js ICONS).
  if (typeof ICONS === 'object') {
    if (!ICONS.edit) ICONS.edit = '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>';
    if (!ICONS.pause) ICONS.pause = '<rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/>';
    if (!ICONS.play) ICONS.play = '<polygon points="7 4 20 12 7 20 7 4"/>';
    if (!ICONS.plus) ICONS.plus = '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>';
  }

  function esc(v) {
    return typeof escapeHtml === 'function' ? escapeHtml(v) : String(v ?? '');
  }
  function fmt(n) {
    const v = Number(n);
    if (!Number.isFinite(v)) return '—';
    return v.toLocaleString('ka-GE');
  }
  function ico(name) {
    return typeof icon === 'function' ? icon(name) : '';
  }
  function toastMsg(msg, tone) {
    if (typeof toast === 'function') toast(msg, tone);
  }
  function when(iso) {
    if (!iso) return '—';
    return V().formatDate ? V().formatDate(iso, 'datetime') : (typeof fmtDate === 'function' ? fmtDate(iso) : String(iso));
  }
  function dayOf(iso) {
    if (!iso) return '—';
    return V().formatDate ? V().formatDate(iso, 'date') : (typeof fmtDateShort === 'function' ? fmtDateShort(iso) : String(iso));
  }
  /** "დღეს" / "ხვალ" / "3 დღეში" for a future moment, by Tbilisi calendar days. */
  function inDays(iso) {
    const t = Date.parse(iso);
    if (!Number.isFinite(t)) return '';
    const tb = (ms) => Math.floor((ms + 4 * 3600000) / 86400000);
    const n = tb(t) - tb(Date.now());
    if (n <= 0) return 'დღეს';
    if (n === 1) return 'ხვალ';
    return `${n} დღეში`;
  }
  function badge(status, tones = {}) {
    const [label, tone] = STATUS[status] || [status ? String(status) : '—', ''];
    const t = Object.prototype.hasOwnProperty.call(tones, status) ? tones[status] : tone;
    return `<span class="s-badge${t ? ` is-${t}` : ''}">${esc(label)}</span>`;
  }
  function statusWord(status) {
    return STATUS[status]?.[0] || status || '—';
  }
  function rewardTitle(r) {
    if (!r) return '—';
    const title = String(r.titleKey || '');
    if (BUILTIN_TITLE_KA[title]) return BUILTIN_TITLE_KA[title];
    if (title && !/^reward\.[\w.]+$/.test(title)) return title;
    return BUILTIN_TITLE_KA[r.key] || r.key || '—';
  }
  function maskedCode(s) {
    return s ? String(s).replace(/^\*+/, '•••• ') : '—';
  }
  function two(main, sub) {
    return `<div class="p2-two"><b>${main}</b>${sub ? `<small>${sub}</small>` : ''}</div>`;
  }
  function metric(label, value, hint, tone, title) {
    return `<div class="s-metric${tone ? ` is-${tone}` : ''}"${title ? ` title="${esc(title)}"` : ''}><span>${esc(label)}</span><strong>${value}</strong>${hint ? `<small>${esc(hint)}</small>` : ''}</div>`;
  }
  function card({ title, desc, action = '', body, flush = false, attrs = '' }) {
    return `<section class="s-card"${attrs ? ` ${attrs}` : ''}>
      <header class="s-card-head"><div><h3>${esc(title)}</h3>${desc ? `<p>${desc}</p>` : ''}</div>${action}</header>
      <div class="s-card-body${flush ? ' is-flush' : ''}">${body}</div>
    </section>`;
  }
  function emptyHtml(title, body, ctaHtml = '') {
    return `<div class="s-empty">${ico('gift')}<strong>${esc(title)}</strong>${body ? `<span>${esc(body)}</span>` : ''}${ctaHtml}</div>`;
  }
  function table(headHtml, rowsHtml, extraClass = '') {
    return `<div class="s-table-wrap"><table class="s-table${extraClass ? ` ${extraClass}` : ''}"><thead><tr>${headHtml}</tr></thead><tbody>${rowsHtml}</tbody></table></div>`;
  }
  function helpBtn(key) {
    return V().infoButton ? V().infoButton(key) : '';
  }
  /** Rows that open something: click, Enter or Space. */
  function bindRows(root, selector, onOpen) {
    root.querySelectorAll(selector).forEach((row) => {
      row.addEventListener('click', (e) => {
        if (e.target.closest('a, button, input, select, textarea')) return;
        onOpen(row);
      });
      row.addEventListener('keydown', (e) => {
        if (e.target !== row || (e.key !== 'Enter' && e.key !== ' ')) return;
        e.preventDefault();
        onOpen(row);
      });
    });
  }

  /** English business-rule errors from the API → one Georgian sentence (the raw text stays as a detail). */
  function errorText(err, fallback = 'ოპერაცია ვერ შესრულდა') {
    const raw = String(err?.message || '').trim();
    if (!raw) return `${fallback} — სცადე თავიდან.`;
    if (/\p{Script=Georgian}/u.test(raw)) return raw;
    const parts = raw.split(/;\s*/).filter(Boolean);
    const known = [...new Set(parts.map((p) => ERROR_KA.find(([re]) => re.test(p))?.[1]).filter(Boolean))];
    if (known.length && known.length >= parts.length) return known.join(' ');
    return `${known.length ? `${known.join(' ')} ` : ''}${fallback} (სერვერი: ${raw}).`;
  }
  function localized(err) {
    const out = new Error(errorText(err));
    out.status = err?.status;
    out.code = err?.code;
    out.cause = err;
    return out;
  }

  async function apiRewards(path, options = {}) {
    if (typeof global.apiRewards === 'function') return global.apiRewards(path, options);
    return api(`/rewards${path}`, options);
  }

  function readState() {
    const hs = Shell().hashParams?.() || new URLSearchParams();
    let tab = hs.get('tab') || 'overview';
    if (!TAB_KEYS.has(tab)) tab = 'overview';
    const edit = hs.get('edit') || '';
    return { tab, edit };
  }

  function writeState(updates) {
    Shell().writeModuleHash?.('rewards', updates);
  }

  function headerFor(tab, edit) {
    const refresh = `<button type="button" class="btn ghost compact icon-only" id="rw-refresh" title="განახლება" aria-label="განახლება">${ico('refresh')}</button>`;
    if (edit === 'new') {
      return {
        tab: 'rewards',
        kicker: 'Commerce',
        title: 'ახალი კამპანია',
        purpose: 'პარტნიორი, ჯილდო, ფასი, ლიმიტები და ვადები.',
        helpKey: 'campaigns.form',
        actionsHtml: '',
      };
    }
    const map = {
      overview: {
        title: 'ჯილდოები',
        purpose: 'Medi Coins-ის ჯილდოები, მარაგი და გაცვლები.',
        helpKey: 'rewards.page',
        actionsHtml: refresh,
      },
      campaigns: {
        title: 'კამპანიები',
        purpose: 'რა ჩანს აპში, რა ფასად და ვადით.',
        helpKey: 'campaigns.page',
        actionsHtml: `${refresh}<button type="button" class="btn primary compact" id="rw-campaign-create">+ ახალი კამპანია</button>`,
      },
      partners: {
        title: 'პარტნიორები',
        purpose: 'ვისი ვაუჩერები იცვლება Medi Coins-ზე.',
        helpKey: 'partners.page',
        actionsHtml: `${refresh}<button type="button" class="btn primary compact" id="rw-partner-create">+ ახალი პარტნიორი</button>`,
      },
      redemptions: {
        title: 'გაცვლები',
        purpose: 'ვინ რა ჯილდო აიღო და რა ბედი ეწია.',
        helpKey: 'redemptions.page',
        actionsHtml: refresh,
      },
      codes: {
        title: 'კოდების მარაგი',
        purpose: 'ვაუჩერის კოდების ატვირთვა და შემოწმება.',
        helpKey: 'codes.page',
        actionsHtml: refresh,
      },
      referrals: {
        title: 'მოწვევები',
        purpose: 'მეგობრის კოდით მოწვევები და ბონუსები.',
        helpKey: 'rewards.referrals',
        actionsHtml: refresh,
      },
    };
    return { tab: 'rewards', kicker: 'Commerce', ...(map[tab] || map.overview) };
  }

  function shellHtml(active, body) {
    const S = Shell();
    const nav = S.subnav ? S.subnav(TABS, active, 'data-rewards-sub') : '';
    return `<div class="s-stack v3-tab-shell p2-rw">${nav}${body}</div>`;
  }

  function bindSubnav(root) {
    const go = async (key) => {
      if (V().dirty) {
        const ok = await V().confirmLeave?.();
        if (!ok) return;
      }
      V().setDirty?.(false);
      writeState({ tab: key, edit: null });
      void renderRewards();
    };
    const S = Shell();
    if (S.bindSubnav) {
      S.bindSubnav(root, 'data-rewards-sub', (key) => void go(key));
      return;
    }
    root.querySelectorAll('[data-rewards-sub]').forEach((btn) => {
      btn.addEventListener('click', () => void go(btn.getAttribute('data-rewards-sub')));
    });
  }

  function bindGoLinks(root) {
    root.querySelectorAll('[data-rewards-go]').forEach((el) => {
      el.addEventListener('click', (e) => {
        e.preventDefault();
        const tab = el.getAttribute('data-rewards-go');
        if (!TAB_KEYS.has(tab)) return;
        writeState({ tab, edit: '' });
        void renderRewards();
      });
    });
  }

  function categoryOptions(selected) {
    return Object.entries(CATEGORY_KA)
      .map(([k, label]) => `<option value="${k}"${k === selected ? ' selected' : ''}>${esc(label)}</option>`)
      .join('');
  }

  async function mutate(action, { successMessage, pendingElement, refresh } = {}) {
    const run = V().runMutation;
    const guarded = async () => {
      try {
        return await action();
      } catch (err) {
        throw localized(err);
      }
    };
    if (run) {
      return run({
        action: guarded,
        pendingElement,
        successMessage,
        refresh: refresh || (() => renderRewards()),
      });
    }
    try {
      const result = await guarded();
      if (successMessage) toastMsg(successMessage, 'ok');
      if (refresh) await refresh(result);
      else await renderRewards();
      return { ok: true, result };
    } catch (err) {
      toastMsg(err.message || 'შეცდომა', 'bad');
      return { ok: false, error: err };
    }
  }

  function confirmThen(opts) {
    const open = V().openConfirm;
    if (!open) {
      toastMsg('დადასტურების ფანჯარა ვერ გაიხსნა — განაახლე გვერდი.', 'bad');
      return;
    }
    open(opts);
  }

  /* ── მაღაზია: store prizes (gift cards, gadgets) — hand-overs, stock, items, history ── */

  const STORE_KIND_KA = { GADGET: 'გაჯეტი', GIFT_CARD: 'სასაჩუქრე ბარათი' };
  const STORE_FILTERS = [['PENDING', 'გადასაცემი'], ['USED', 'გადაცემული'], ['CANCELLED', 'გაუქმებული'], ['', 'ყველა']];
  let storeFilter = 'PENDING';
  const gel = (n) => (n == null ? '—' : `${fmt(n)} ₾`);
  const coinsGel = (c) => `≈ ${fmt(Math.round(Number(c) / 100))} ₾`;

  async function renderStore(root, seq) {
    const [data, reds] = await Promise.all([
      apiRewards('/store'),
      apiRewards(`/store/redemptions${storeFilter ? `?status=${storeFilter}` : ''}`),
    ]);
    if (seq !== renderSeq) return;
    const items = data.items || [];
    const t = data.totals || {};
    const list = reds.items || [];
    const userCell = (u) => (u
      ? two(`<a href="#/users/${encodeURIComponent(u.id)}">${esc(u.name || 'მომხმარებელი')}</a>`, u.phone ? `<span class="mono">${esc(u.phone)}</span>` : 'ტელეფონი არ არის')
      : '—');
    const redRows = list.map((r) => `<tr>
        <td><div class="p2-store-cell">${r.reward?.imageUrl ? `<img src="${esc(r.reward.imageUrl)}" alt="" loading="lazy">` : ''}${two(esc(r.reward?.title || '—'), `${fmt(r.coinCost)} Medi Coins`)}</div></td>
        <td>${userCell(r.user)}</td>
        <td>${badge(r.status)}</td>
        <td class="s-muted">${esc(when(r.redeemedAt))}${r.status === 'PENDING' ? `<small class="p2-sub">გადაეცი ${esc(inDays(new Date(Date.parse(r.redeemedAt) + 14 * 86400000).toISOString()))}</small>` : ''}</td>
        <td class="p2-actions">${r.status === 'PENDING'
          ? `<button type="button" class="btn compact" data-st-hand="${esc(r.id)}">${ico('check')} გაცემულია</button><button type="button" class="btn ghost compact" data-st-cancel="${esc(r.id)}" data-cost="${esc(r.coinCost)}">გაუქმება</button>`
          : `<button type="button" class="btn ghost compact" data-st-open="${esc(r.id)}">დეტალები</button>`}</td>
      </tr>`).join('');
    const itemCards = items.map((i) => {
      const out = i.status === 'ACTIVE' && i.stock <= 0;
      const taken = (i.pending || 0) + (i.handedOver || 0);
      const total = i.stock + taken;
      const leftPct = total > 0 ? Math.round((i.stock / total) * 100) : 0;
      const state = i.status !== 'ACTIVE' ? ['შეჩერებული', 'is-warn'] : out ? ['ამოიწურა', 'is-bad'] : ['აპში ჩანს', 'is-ok'];
      return `<article class="p2-prize${i.status !== 'ACTIVE' ? ' is-paused' : ''}${out ? ' is-out' : ''}">
        <div class="p2-prize-media">
          ${i.imageUrl ? `<img src="${esc(i.imageUrl)}" alt="" loading="lazy">` : `<span class="p2-prize-ph">${ico('gift')}</span>`}
          <span class="s-badge ${state[1]} p2-prize-state">${state[0]}</span>
          <span class="p2-prize-kind">${esc(STORE_KIND_KA[i.kind] || 'საჩუქარი')}</span>
        </div>
        <div class="p2-prize-body">
          <h4 title="${esc(i.title)}">${esc(i.title)}</h4>
          <div class="p2-prize-price"><b>${fmt(i.coinCost)}</b><span>Medi Coins</span></div>
          <p class="p2-prize-gel">${esc(coinsGel(i.coinCost))}${i.retailGel != null ? ` · მაღაზიაში ${esc(gel(i.retailGel))}` : ''}</p>
          <div class="p2-prize-stock">
            <div class="p2-prize-stock-row"><span>მარაგში <b class="${i.stock <= 0 ? 'is-bad' : ''}">${fmt(i.stock)}</b>${total ? ` / ${fmt(total)}` : ''}</span>${i.pending ? `<span class="p2-prize-wait">${fmt(i.pending)} გადასაცემი</span>` : i.handedOver ? `<span class="s-muted">${fmt(i.handedOver)} გადაცემული</span>` : ''}</div>
            <div class="p2-prize-bar" role="img" aria-label="მარაგის ${leftPct}% დარჩა"><i style="width:${leftPct}%"></i></div>
          </div>
        </div>
        <div class="p2-prize-foot">
          <button type="button" class="btn compact" data-st-stock="${esc(i.id)}">${ico('plus')} მარაგი</button>
          <button type="button" class="btn ghost compact p2-icon-btn" data-st-edit="${esc(i.id)}" title="შეცვლა" aria-label="შეცვლა: ${esc(i.title)}">${ico('edit')}</button>
          <button type="button" class="btn ghost compact p2-icon-btn" data-st-status="${esc(i.id)}" data-status="${esc(i.status)}" title="${i.status === 'ACTIVE' ? 'შეჩერება' : 'გააქტიურება'}" aria-label="${i.status === 'ACTIVE' ? 'შეჩერება' : 'გააქტიურება'}: ${esc(i.title)}">${ico(i.status === 'ACTIVE' ? 'pause' : 'play')}</button>
        </div>
      </article>`;
    }).join('');

    root.innerHTML = shellHtml('store', `
      <div class="s-metrics">
        ${metric('გადასაცემი', fmt(t.pending), 'გაცვალეს, ჯერ არ მიუღიათ', t.pending ? 'warn' : '')}
        ${metric('გადაცემული', fmt(t.handedOver), 'სულ ხელში მიღებული')}
        ${metric('მარაგის ღირებულება', gel(t.stockValueGel), 'მაღაზიის ფასით, რაც ჯერ დარჩა')}
        ${metric('დახარჯული', gel(t.spentGel), 'გაცემული + გადასაცემი')}
      </div>
      ${card({
        title: 'ვინ რა გაცვალა',
        desc: 'დაურეკე, შეუთანხმდი და თბილისში 14 დღეში გადაეცი. თუ ვერ ხერხდება, გააუქმე — მონეტები სრულად დაუბრუნდება და მარაგი აღდგება.',
        action: `<div class="s-segment" role="tablist" aria-label="სტატუსი">${STORE_FILTERS.map(([k, l]) => `<button type="button" role="tab" aria-selected="${k === storeFilter}" data-st-filter="${k}">${l}</button>`).join('')}</div>`,
        flush: true,
        body: list.length
          ? table('<th>საჩუქარი</th><th>ვინ</th><th>სტატუსი</th><th>როდის</th><th><span class="sr-only">მოქმედება</span></th>', redRows)
          : `<div class="s-empty">${ico('gift')}<strong>${storeFilter === 'PENDING' ? 'გადასაცემი არაფერია' : 'ჩანაწერი არ არის'}</strong><span>${storeFilter === 'PENDING' ? 'ახალი გაცვლისას Telegram-ში შეტყობინება მოგივა.' : 'სხვა ფილტრი სცადე.'}</span></div>`,
      })}
      ${card({
        title: `საჩუქრები · ${fmt(items.length)}`,
        desc: 'ის, რაც აპის მაღაზიაში ჩანს (Medi Quest → ჯილდოების მაღაზია). 100 მონეტა ≈ 1 ₾.',
        action: `<button type="button" class="btn" data-st-new>${ico('plus')} ახალი საჩუქარი</button>`,
        body: items.length ? `<div class="p2-prizes">${itemCards}</div>` : `<div class="s-empty">${ico('gift')}<strong>საჩუქრები ჯერ არ არის</strong></div>`,
      })}
    `);
    bindSubnav(root);

    root.querySelectorAll('[data-st-filter]').forEach((b) => b.addEventListener('click', () => { storeFilter = b.dataset.stFilter; void renderRewards(); }));
    root.querySelectorAll('[data-st-open]').forEach((b) => b.addEventListener('click', () => openRedemption(b.dataset.stOpen)));
    root.querySelectorAll('[data-st-hand]').forEach((b) => b.addEventListener('click', () => confirmThen({
      title: 'საჩუქარი გადაეცა?',
      message: 'გაცვლა მოინიშნება „გადაცემულად“: ადამიანმა საჩუქარი ხელში მიიღო.',
      confirmLabel: 'გაცემულია',
      onConfirm: async () => { await mutate(() => apiRewards(`/redemptions/${encodeURIComponent(b.dataset.stHand)}/mark-used`, { method: 'POST', body: { reason: 'handed_over' } }), { pendingElement: b, successMessage: 'მოინიშნა: გადაეცა' }); },
    })));
    root.querySelectorAll('[data-st-cancel]').forEach((b) => b.addEventListener('click', () => confirmThen({
      title: 'გავაუქმო გაცვლა?',
      message: `მომხმარებელს ${fmt(b.dataset.cost)} Medi Coins დაუბრუნდება და მარაგი ერთით გაიზრდება. ამას ვერ დააბრუნებ.`,
      confirmLabel: 'გაუქმება',
      variant: 'warning',
      onConfirm: async () => { await mutate(() => apiRewards(`/redemptions/${encodeURIComponent(b.dataset.stCancel)}/cancel`, { method: 'POST', body: { reason: 'admin_cancel' } }), { pendingElement: b, successMessage: 'გაუქმდა, მონეტები დაბრუნდა' }); },
    })));
    root.querySelectorAll('[data-st-status]').forEach((b) => b.addEventListener('click', () => {
      const pause = b.dataset.status === 'ACTIVE';
      confirmThen({
        title: pause ? 'შევაჩერო საჩუქარი?' : 'გავააქტიურო საჩუქარი?',
        message: pause ? 'აპის მაღაზიაში აღარ გამოჩნდება. უკვე გაცვლილი გადაცემას ისევ ელოდება.' : 'აპის მაღაზიაში ისევ გამოჩნდება.',
        confirmLabel: pause ? 'შეჩერება' : 'გააქტიურება',
        variant: pause ? 'warning' : undefined,
        onConfirm: async () => { await mutate(() => apiRewards(`/store/${encodeURIComponent(b.dataset.stStatus)}/status`, { method: 'POST', body: { status: pause ? 'PAUSED' : 'ACTIVE' } }), { pendingElement: b, successMessage: pause ? 'შეჩერდა' : 'გააქტიურდა' }); },
      });
    }));
    root.querySelectorAll('[data-st-stock]').forEach((b) => b.addEventListener('click', () => openStockDialog(items.find((i) => i.id === b.dataset.stStock))));
    root.querySelectorAll('[data-st-edit]').forEach((b) => b.addEventListener('click', () => openStoreItemDialog(items.find((i) => i.id === b.dataset.stEdit))));
    root.querySelector('[data-st-new]')?.addEventListener('click', () => openStoreItemDialog(null));
  }

  function openStockDialog(item) {
    const open = V().openDialog;
    if (!open || !item) return;
    const dlg = open({
      title: `მარაგი · ${item.title}`,
      body: `<div class="s-stack p2-dialog">
        <p class="s-muted">ახლა მარაგშია <b>${fmt(item.stock)}</b>. ჩაწერე, რამდენით გაიზარდოს (ან მინუსით შემცირდეს).</p>
        <div class="p2-store-step">
          <button type="button" class="btn ghost" data-step="-1" aria-label="ერთით ნაკლები">−</button>
          <input id="st-delta" class="s-input" type="number" step="1" value="1" aria-label="რაოდენობა">
          <button type="button" class="btn ghost" data-step="1" aria-label="ერთით მეტი">+</button>
        </div>
        <label class="s-field"><span>მიზეზი</span><input id="st-reason" class="s-input" type="text" maxlength="200" value="შევიძინე ახალი"></label>
        <p class="s-callout is-bad" id="st-err" hidden></p>
      </div>`,
      footer: '<button type="button" class="btn ghost" id="st-close">გაუქმება</button><button type="button" class="btn" id="st-save">შენახვა</button>',
    });
    const input = $('st-delta');
    document.querySelectorAll('.p2-store-step [data-step]').forEach((b) => b.addEventListener('click', () => { input.value = String((Number(input.value) || 0) + Number(b.dataset.step)); }));
    $('st-close')?.addEventListener('click', () => void dlg?.close?.());
    $('st-save')?.addEventListener('click', async () => {
      const delta = Math.round(Number(input.value) || 0);
      const reason = ($('st-reason')?.value || '').trim();
      const err = $('st-err');
      if (!delta || reason.length < 3 || item.stock + delta < 0) {
        err.hidden = false;
        err.textContent = !delta ? 'ჩაწერე რაოდენობა.' : reason.length < 3 ? 'მიზეზი მინიმუმ 3 ასოა.' : 'მარაგი უარყოფითი ვერ იქნება.';
        return;
      }
      const res = await mutate(() => apiRewards(`/rewards/${encodeURIComponent(item.id)}/inventory/adjust`, { method: 'POST', body: { delta, reason } }), { pendingElement: $('st-save'), successMessage: `მარაგი: ${fmt(item.stock + delta)}` });
      if (res?.ok !== false) void dlg?.close?.();
    });
  }

  /** New prize or edit; the picture is resized in the browser (≤640 px WebP) and stored like the home news pictures. */
  function openStoreItemDialog(item) {
    const open = V().openDialog;
    if (!open) return;
    const isNew = !item;
    const v = item || { kind: 'GADGET', perUserLimit: 1 };
    let imageKey = null;
    const dlg = open({
      title: isNew ? 'ახალი საჩუქარი' : `შეცვლა · ${item.title}`,
      wide: true,
      body: `<form class="s-stack p2-dialog p2-store-form" id="st-form" novalidate>
        <div class="p2-store-form-grid">
          <div class="p2-store-pic">
            <div class="p2-store-img" id="st-pic">${v.imageUrl ? `<img src="${esc(v.imageUrl)}" alt="">` : ico('image')}</div>
            <label class="btn ghost compact">${ico('image')} სურათის ატვირთვა<input id="st-file" type="file" accept="image/png,image/jpeg,image/webp" hidden></label>
            <small class="s-muted" id="st-pic-note">PNG გამჭვირვალე ფონით საუკეთესოა. მაქს. 640 px.</small>
          </div>
          <div class="s-stack">
            <label class="s-field"><span>სახელი (ქართულად)</span><input id="st-title" class="s-input" maxlength="200" value="${esc(v.title || '')}" placeholder="მაგ. JBL Go 4 დინამიკი"></label>
            <label class="s-field"><span>სახელი (ინგლისურად, არასავალდებულო)</span><input id="st-title-en" class="s-input" maxlength="200" value="${esc(v.titleEn || '')}" placeholder="JBL Go 4 speaker"></label>
            <label class="s-field"><span>მოკლე აღწერა</span><textarea id="st-desc" class="s-input" rows="2" maxlength="400">${esc(v.description && v.description !== v.title ? v.description : '')}</textarea></label>
            <label class="s-field"><span>აღწერა (ინგლისურად)</span><textarea id="st-desc-en" class="s-input" rows="2" maxlength="400">${esc(v.descriptionEn || '')}</textarea></label>
          </div>
        </div>
        <div class="p2-store-form-row">
          <label class="s-field"><span>ტიპი</span><select id="st-kind" class="s-input"><option value="GADGET"${v.kind !== 'GIFT_CARD' ? ' selected' : ''}>გაჯეტი</option><option value="GIFT_CARD"${v.kind === 'GIFT_CARD' ? ' selected' : ''}>სასაჩუქრე ბარათი</option></select></label>
          <label class="s-field"><span>მაღაზიის ფასი, ₾</span><input id="st-gel" class="s-input" type="number" min="0" value="${esc(v.retailGel ?? '')}"></label>
          <label class="s-field"><span>ფასი, Medi Coins</span><input id="st-cost" class="s-input" type="number" min="100" max="100000" step="100" value="${esc(v.coinCost ?? '')}"><small class="s-muted p2-store-hint" id="st-cost-hint" title="დააჭირე და ჩაიწერება">100 მონეტა ≈ 1 ₾</small></label>
          ${isNew ? '<label class="s-field"><span>მარაგი, ცალი</span><input id="st-stock" class="s-input" type="number" min="0" value="1"></label>' : ''}
          <label class="s-field"><span>ერთ ადამიანს მაქს.</span><input id="st-limit" class="s-input" type="number" min="1" max="20" value="${esc(v.perUserLimit ?? 1)}"></label>
        </div>
        <p class="s-callout is-bad" id="st-form-err" hidden></p>
      </form>`,
      footer: `<button type="button" class="btn ghost" id="st-f-close">გაუქმება</button><button type="button" class="btn" id="st-f-save">${isNew ? 'დამატება მაღაზიაში' : 'შენახვა'}</button>`,
    });
    const gelEl = $('st-gel');
    const costEl = $('st-cost');
    const hint = () => {
      const g = Number(gelEl.value);
      const c = Number(costEl.value);
      $('st-cost-hint').textContent = g > 0 && !c ? `შემოთავაზება: ${fmt(Math.round(g * 100 / 500) * 500 + 500)} — დააჭირე` : c ? coinsGel(c) : '100 მონეტა ≈ 1 ₾';
    };
    $('st-cost-hint')?.addEventListener('click', () => {
      const g = Number(gelEl.value);
      if (g > 0 && !Number(costEl.value)) { costEl.value = String(Math.round(g * 100 / 500) * 500 + 500); hint(); }
    });
    gelEl?.addEventListener('input', hint);
    costEl?.addEventListener('input', hint);
    hint();
    $('st-file')?.addEventListener('change', async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const note = $('st-pic-note');
      note.textContent = 'იტვირთება…';
      try {
        const resized = await resizeStoreImage(file);
        const res = await apiRewards('/store/images', { method: 'POST', body: resized });
        imageKey = res.imageKey;
        $('st-pic').innerHTML = `<img src="${esc(resized.dataUrl)}" alt="">`;
        note.textContent = `ატვირთულია · ${resized.width}×${resized.height}`;
      } catch (err) {
        note.textContent = errorText(err);
      }
    });
    $('st-f-close')?.addEventListener('click', () => void dlg?.close?.());
    $('st-f-save')?.addEventListener('click', async () => {
      const err = $('st-form-err');
      const title = ($('st-title')?.value || '').trim();
      const coinCost = Math.round(Number(costEl.value) || 0);
      if (!title || coinCost < 100 || coinCost > 100000) {
        err.hidden = false;
        err.textContent = !title ? 'სახელი სავალდებულოა.' : 'ფასი 100-დან 100 000 მონეტამდე.';
        return;
      }
      const num = (id) => { const x = $(id)?.value; return x === '' || x == null ? null : Math.round(Number(x)); };
      const body = {
        title,
        titleEn: ($('st-title-en')?.value || '').trim() || null,
        description: ($('st-desc')?.value || '').trim() || title,
        descriptionEn: ($('st-desc-en')?.value || '').trim() || null,
        kind: $('st-kind')?.value || 'GADGET',
        coinCost,
        retailGel: num('st-gel'),
        perUserLimit: num('st-limit') || 1,
        ...(imageKey ? { imageKey } : {}),
        ...(isNew ? { stock: num('st-stock') || 0 } : {}),
      };
      const res = await mutate(
        () => (isNew ? apiRewards('/store', { method: 'POST', body }) : apiRewards(`/store/${encodeURIComponent(item.id)}`, { method: 'PATCH', body })),
        { pendingElement: $('st-f-save'), successMessage: isNew ? 'დაემატა მაღაზიაში' : 'შენახულია' },
      );
      if (res?.ok !== false) void dlg?.close?.();
    });
  }

  function resizeStoreImage(file) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(url);
        const scale = Math.min(1, 640 / Math.max(img.width, img.height));
        const width = Math.max(1, Math.round(img.width * scale));
        const height = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        canvas.getContext('2d').drawImage(img, 0, 0, width, height);
        let dataUrl = canvas.toDataURL('image/webp', 0.86);
        if (!dataUrl.startsWith('data:image/webp')) dataUrl = canvas.toDataURL('image/png');
        resolve({ dataUrl, width, height });
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('სურათი ვერ წავიკითხე — სცადე PNG ან JPEG.')); };
      img.src = url;
    });
  }

  /* ── Redemption detail (dialog) ───────────────────────── */

  function openRedemption(id) {
    const open = V().openDialog;
    if (!open || !id) return;
    const dlg = open({
      title: 'გაცვლის დეტალები',
      wide: true,
      watchDirty: false,
      body: `<div id="rw-redemption-detail" class="p2-dialog">${V().skeleton ? V().skeleton(5) : 'იტვირთება…'}</div>`,
      footer: `<button type="button" class="btn ghost" id="rw-detail-close">დახურვა</button>`,
    });
    $('rw-detail-close')?.addEventListener('click', () => void dlg?.close?.());
    apiRewards(`/redemptions/${encodeURIComponent(id)}`)
      .then((d) => {
        const host = $('rw-redemption-detail');
        if (!host) return;
        const value = d.commercialValueMinorSnapshot != null
          ? `${(Number(d.commercialValueMinorSnapshot) / 100).toLocaleString('ka-GE', { maximumFractionDigits: 2 })} ${esc(d.commercialCurrencySnapshot || '')}`
          : '';
        const facts = [
          ['სტატუსი', badge(d.status)],
          ['ჯილდო', two(esc(rewardTitle(d.reward)), esc(REWARD_TYPE_KA[d.reward?.type] || ''))],
          ['პარტნიორი', d.partner ? two(esc(d.partner.displayName || d.partner.key), esc(CATEGORY_KA[d.partner.category] || '')) : 'Medicard'],
          ['კამპანია', d.campaign ? two(esc(d.campaign.name || d.campaign.key), esc(statusWord(d.campaign.status))) : '—'],
          ['ფასი', `${fmt(d.coinCost)} Medi Coins`],
          ['კოდი', d.code ? two(`<span class="mono">${esc(maskedCode(d.code.codeMasked))}</span>`, esc(statusWord(d.code.status))) : '—'],
          ['მომხმარებელი', d.fulfilmentUserId
            ? two(`<a class="mono" href="#/users/${encodeURIComponent(d.fulfilmentUserId)}">${esc(d.maskedUserRef || 'გახსნა')}</a>`, 'ტელეფონი მომხმარებლის გვერდზეა — დაურეკე და შეუთანხმდი გადაცემას')
            : `<span class="mono">${esc(d.maskedUserRef || '—')}</span>`],
          ['გაცვალა', esc(when(d.redeemedAt))],
          ['ვადა', d.expiresAt ? esc(when(d.expiresAt)) : 'ვადის გარეშე'],
          d.usedAt ? ['გამოიყენა', esc(when(d.usedAt))] : null,
          d.cancelledAt ? ['გაუქმდა', two(esc(when(d.cancelledAt)), esc(NOTE_KA[d.cancellationReason] || d.cancellationReason || ''))] : null,
          value ? ['კომერციული ღირებულება', value] : null,
          ['ჩანაწერი', V().copyIdButton ? V().copyIdButton(d.id, 'გაცვლის ID') : `<span class="mono">${esc(d.id)}</span>`],
        ].filter(Boolean);
        const steps = (d.audit || []).map((a) => `<li>
            <div><b>${esc(a.fromStatus ? `${statusWord(a.fromStatus)} → ${statusWord(a.toStatus)}` : statusWord(a.toStatus))}</b>
            ${a.note ? `<span>${esc(NOTE_KA[a.note] || a.note)}</span>` : ''}</div>
            <time>${esc(when(a.createdAt))}</time>
          </li>`).join('');
        const handover = d.status === 'PENDING'
          ? `<div class="s-callout">${ico('gift')}<div><b>საჩუქარი გადაცემას ელოდება</b><p>გადაეცი თბილისში 14 დღეში. თუ ვერ ხერხდება, გააუქმე — მონეტები მომხმარებელს სრულად დაუბრუნდება და მარაგი აღდგება.</p>
              <div class="s-row" style="gap:8px;margin-top:10px"><button type="button" class="btn" id="rw-handover">${ico('check')} გაცემულია</button><button type="button" class="btn ghost" id="rw-cancel">გაუქმება და მონეტების დაბრუნება</button></div></div></div>`
          : '';
        host.innerHTML = `<div class="s-stack p2-detail">${handover}
          <dl class="p2-facts">${facts.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${v}</dd></div>`).join('')}</dl>
          <section>
            <h4 class="p2-h">ისტორია</h4>
            ${steps ? `<ol class="p2-steps">${steps}</ol>` : '<p class="s-muted">ცვლილებები ჯერ არ ჩაწერილა.</p>'}
          </section>
        </div>`;
        const act = (btn, path, reason, done) => btn?.addEventListener('click', () => confirmThen({
          title: done.title,
          message: done.message,
          confirmLabel: done.label,
          variant: done.variant,
          onConfirm: async () => {
            await mutate(() => apiRewards(`/redemptions/${encodeURIComponent(id)}/${path}`, { method: 'POST', body: { reason } }), { pendingElement: btn, successMessage: done.ok });
            void dlg?.close?.();
          },
        }));
        act($('rw-handover'), 'mark-used', 'handed_over', { title: 'საჩუქარი გადაეცა?', message: 'გაცვლა მოინიშნება „გამოყენებულად“. ეს ნიშნავს, რომ ადამიანმა საჩუქარი ხელში მიიღო.', label: 'გაცემულია', ok: 'მოინიშნა: გადაეცა' });
        act($('rw-cancel'), 'cancel', 'admin_cancel', { title: 'გავაუქმო გაცვლა?', message: `მომხმარებელს ${fmt(d.coinCost)} Medi Coins დაუბრუნდება და მარაგი ერთით გაიზრდება. ამას ვერ დააბრუნებ.`, label: 'გაუქმება', variant: 'warning', ok: 'გაუქმდა, მონეტები დაბრუნდა' });
      })
      .catch((err) => {
        const host = $('rw-redemption-detail');
        if (host) host.innerHTML = `<div class="s-callout is-bad">${ico('alert')}<p>${esc(errorText(err))}</p></div>`;
      });
  }

  /* ── Referrals ────────────────────────────────────────── */

  function referralBadge(row) {
    const [label, tone] = REFERRAL_STATUS[row.status] || [row.status || '—', ''];
    return `<span class="s-badge${tone ? ` is-${tone}` : ''}">${esc(label)}</span>`;
  }

  async function renderReferrals(root, seq) {
    const data = await api('/referrals');
    if (seq !== renderSeq) return;
    const t = data.totals || {};
    const r = data.rules || {};
    const recent = data.recent || [];
    const top = data.top || [];
    const userLink = (id, label) => (id
      ? `<a href="#/users/${encodeURIComponent(id)}" class="mono">${esc(label)}</a>`
      : `<span class="mono">${esc(label || '—')}</span>`);
    const recentRows = recent.map((row) => {
      const reason = REFERRAL_REASON_KA[row.reason] || '';
      return `<tr>
        <td>${userLink(row.inviterId, row.inviter)}</td>
        <td>${userLink(row.inviteeId, row.invitee)}</td>
        <td>${referralBadge(row)}${reason ? `<small class="p2-sub">${esc(reason)}</small>` : ''}</td>
        <td>${row.status === 'REWARDED' ? (row.inviterRewarded ? 'კი' : 'არა') : '—'}</td>
        <td class="s-muted">${esc(when(row.createdAt))}</td>
        <td class="s-muted">${row.rewardedAt ? esc(when(row.rewardedAt)) : '—'}</td>
      </tr>`;
    }).join('');
    const topMax = Math.max(1, ...top.map((row) => Number(row.invited) || 0));
    const topRows = top.map((row) => `<li>
        ${userLink(row.inviterId, row.inviter)}
        <div class="s-meter"><i style="width:${Math.max(3, Math.round(((Number(row.invited) || 0) / topMax) * 100))}%"></i></div>
        <span>${fmt(row.invited)} მოწვევა · ${fmt(row.rewarded)} დარიცხვა</span>
      </li>`).join('');
    root.innerHTML = shellHtml('referrals', `
      <div class="s-stack" data-v3-rewards="referrals">
        <div class="s-metrics">
          ${metric('სულ მოწვევა', fmt(t.total), `${fmt(t.thisMonth)} ამ თვეში`)}
          ${metric('ელოდება', fmt(t.pending), 'პირველ ჩანაწერს ან ტელეფონის დადასტურებას')}
          ${metric('დარიცხული', fmt(t.rewarded), 'ორივე მხარეს, თვიური ლიმიტით')}
          ${metric('ვადაგასული', fmt(t.expired), `${fmt(r.rewardWindowDays)} დღე ჩანაწერის გარეშე`)}
        </div>
        ${card({
          title: 'ბოლო მოწვევები',
          desc: 'ვინ ვის მოიწვია და დაერიცხა თუ არა ბონუსი.',
          flush: true,
          body: recent.length
            ? table('<th>მომწვევი</th><th>მოწვეული</th><th>სტატუსი</th><th>მომწვევს დაერიცხა</th><th>კოდი შეიყვანა</th><th>დარიცხვა</th>', recentRows)
            : emptyHtml('ჯერ მოწვევა არ არის', 'პირველი მოწვევა აქ გამოჩნდება, როცა ახალი ანგარიში მეგობრის კოდს შეიყვანს.'),
        })}
        <div class="p2-split">
          ${card({
            title: 'ყველაზე აქტიური მომწვევები',
            desc: 'უჩვეულოდ ბევრი მოწვევა შეიძლება ბოროტად გამოყენების ნიშანი იყოს.',
            body: top.length
              ? `<ol class="p2-rank">${topRows}</ol>`
              : emptyHtml('ჯერ არავის მოუწვევია', ''),
          })}
          ${card({
            title: 'წესები',
            desc: 'ფულადი ღირებულება არ აქვს — მხოლოდ Medi Coins.',
            body: `<dl class="p2-facts">
              <div><dt>ბონუსი</dt><dd>${fmt(r.coinsPerSide)} Medi Coins ორივე მხარეს</dd></div>
              <div><dt>როდის ერიცხება</dt><dd>მოწვეულის პირველი ჯანმრთელობის ჩანაწერის შემდეგ</dd></div>
              <div><dt>პირობა</dt><dd>ორივეს დადასტურებული ტელეფონი, ერთი მოწყობილობა ერთ მოწვევაზე</dd></div>
              <div><dt>მომწვევის ლიმიტი</dt><dd>თვეში ${fmt(r.monthlyCap)} ბონუსი</dd></div>
              <div><dt>კოდის შეყვანა</dt><dd>რეგისტრაციიდან ${fmt(r.claimWindowDays)} დღეში</dd></div>
              <div><dt>ვადა</dt><dd>${fmt(r.rewardWindowDays)} დღე ჩანაწერის გარეშე</dd></div>
            </dl>`,
          })}
        </div>
      </div>`);
    bindSubnav(root);
  }

  /* ── Overview ─────────────────────────────────────────── */

  async function renderOverview(root, seq) {
    // Campaign and reward lists (same REWARDS_VIEW access as the overview) only supply readable names.
    const [data, campaigns, defs] = await Promise.all([
      apiRewards('/overview'),
      apiRewards('/campaigns').catch(() => null),
      apiRewards('/definitions').catch(() => null),
    ]);
    if (seq !== renderSeq) return;
    const k = data.kpis || {};
    const low = data.needsAttention?.lowStock || [];
    const ending = data.needsAttention?.endingSoon || [];
    const recent = data.recentActivity || [];
    const defByKey = new Map((defs?.items || []).map((d) => [d.key, d]));
    const campList = campaigns?.items || [];
    const campByKey = new Map(campList.map((c) => [c.key, c]));
    const campById = new Map(campList.map((c) => [c.id, c]));
    const partnerOfReward = new Map();
    campList.forEach((c) => {
      if (c.reward?.key && c.partner?.displayName && !partnerOfReward.has(c.reward.key)) partnerOfReward.set(c.reward.key, c.partner.displayName);
    });
    const rewardName = (key) => rewardTitle(defByKey.get(key) || { key });
    const attentionCount = low.length + ending.length;

    const lowRows = low.map((x) => `<div class="s-switch-row">
        <div><b>${esc(rewardName(x.rewardKey))}</b><small>${esc(partnerOfReward.get(x.rewardKey) || 'კოდების მარაგი')} · დარჩა ${fmt(x.available)} კოდი</small></div>
        <div class="p2-row-end">${badge(x.stockState)}<button type="button" class="btn compact" data-rewards-go="codes">კოდების მარაგი</button></div>
      </div>`).join('');
    const endingRows = ending.map((x) => {
      const partner = campById.get(x.id)?.partner?.displayName;
      return `<div class="s-switch-row">
        <div><b>${esc(x.name || x.key)}</b><small>${partner ? `${esc(partner)} · ` : ''}მთავრდება ${esc(when(x.endsAt))}</small></div>
        <div class="p2-row-end"><span class="s-badge is-warn">${esc(inDays(x.endsAt))}</span><button type="button" class="btn compact" data-rewards-go="campaigns">კამპანიები</button></div>
      </div>`;
    }).join('');
    const attention = attentionCount
      ? card({
        title: 'საჭიროებს ყურადღებას',
        desc: 'მარაგი, რომელიც იწურება, და კამპანიები, რომლებიც 7 დღეში მთავრდება.',
        action: `<span class="s-badge is-warn">${fmt(attentionCount)}</span>`,
        attrs: 'data-v3-rewards="attention"',
        body: `<div class="p2-rows">${lowRows}${endingRows}</div>`,
      })
      : `<div class="s-callout is-ok" data-v3-rewards="attention">${ico('check')}<p>ყურადღება არაფერს სჭირდება: მარაგი საკმარისია და არცერთი აქტიური კამპანია 7 დღეში არ მთავრდება.</p></div>`;

    const points = (data.trend7d || []).map((d) => ({ day: d.day, count: Number(d.redemptions) || 0 }));
    const chart = global.AdminCharts?.bars
      ? global.AdminCharts.bars(points, { label: 'გაცვლები', height: 200, empty: 'ბოლო 7 დღეში გაცვლა არ ყოფილა' })
      : '';

    const recentRows = recent.map((r) => {
      const camp = r.campaignKey ? campByKey.get(r.campaignKey) : null;
      const sub = camp?.name || (r.campaignKey ? r.campaignKey : 'კამპანიის გარეშე');
      return `<tr class="is-click" tabindex="0" data-red="${esc(r.id)}">
        <td>${two(esc(rewardName(r.rewardKey)), esc(sub))}</td>
        <td>${badge(r.status)}</td>
        <td class="num">${fmt(r.coinCost)}</td>
        <td class="mono s-muted">${esc(r.maskedUserRef || '—')}</td>
        <td class="s-muted">${esc(when(r.redeemedAt))}</td>
      </tr>`;
    }).join('');

    root.innerHTML = shellHtml('overview', `
      <div class="s-stack" data-v3-rewards="overview">
        ${attention}
        <div class="s-metrics">
          ${metric('აქტიური კამპანია', fmt(k.activeCampaigns), `${fmt(k.partnersActive)} აქტიური პარტნიორი`)}
          ${metric('გაცვლები დღეს', fmt(k.redemptionsToday), 'დღე ითვლება 04:00-დან', '', 'სერვერი დღეს UTC-ით ითვლის — თბილისის დროით 04:00-დან.')}
          ${metric('გაცვლები · 7 დღე', fmt(k.redemptions7d), 'ბოლო 7 დღე')}
          ${metric('დახარჯული Medi Coins', fmt(k.coinsSpentOnRewards7d), 'ბოლო 7 დღე')}
          ${metric('ხელმისაწვდომი კოდი', fmt(k.codesAvailable), 'აქტიური ჯილდოების მარაგში')}
          ${metric('დაბალი მარაგი', fmt(k.codesLowStock), Number(k.codesLowStock) > 0 ? 'ჯილდოს კოდები იწურება' : 'ყველა მარაგი საკმარისია', Number(k.codesLowStock) > 0 ? 'warn' : '')}
        </div>
        ${card({
          title: 'გაცვლები დღეების მიხედვით',
          desc: 'ბოლო 7 დღე. დღე ითვლება 04:00-დან.',
          attrs: 'data-v3-rewards="trend"',
          body: chart,
        })}
        ${card({
          title: 'ბოლო გაცვლები',
          desc: 'სტრიქონზე დაჭერით გაიხსნება დეტალები. მომხმარებელი შენიღბულია.',
          action: `<button type="button" class="btn ghost compact" data-rewards-go="redemptions">ყველა გაცვლა ${ico('arrow')}</button>`,
          attrs: 'data-v3-rewards="recent"',
          flush: true,
          body: recent.length
            ? table('<th>ჯილდო</th><th>სტატუსი</th><th class="num">ფასი (Coins)</th><th>მომხმარებელი</th><th>დრო</th>', recentRows)
            : emptyHtml('ჯერ გაცვლა არ არის', 'პირველი გაცვლა აქ გამოჩნდება.'),
        })}
      </div>`);
    bindSubnav(root);
    bindGoLinks(root);
    bindRows(root, 'tr[data-red]', (row) => openRedemption(row.getAttribute('data-red')));
  }

  /* ── Campaign create (full page, not drawer) ──────────── */

  function field({ id, label, required, hint, control }) {
    return `<label class="s-field" for="${esc(id)}">
      <span>${esc(label)}${required ? '<em class="p2-req" aria-hidden="true">*</em>' : ''}</span>
      ${control}
      ${hint ? `<small>${esc(hint)}</small>` : ''}
    </label>`;
  }
  function inputHtml({ id, type = 'text', value = '', placeholder = '', required = false, attrs = '' }) {
    return `<input id="${esc(id)}" type="${esc(type)}" value="${esc(value)}" placeholder="${esc(placeholder)}"${required ? ' required' : ''}${attrs ? ` ${attrs}` : ''} />`;
  }
  function selectHtml({ id, options, value, required = false }) {
    return `<select id="${esc(id)}"${required ? ' required' : ''}>${options
      .map(([val, lab]) => `<option value="${esc(val)}"${String(val) === String(value ?? '') ? ' selected' : ''}>${esc(lab)}</option>`)
      .join('')}</select>`;
  }

  async function renderCampaignForm(root, seq) {
    let partners = [];
    let defs = [];
    try {
      const [p, d] = await Promise.all([apiRewards('/partners'), apiRewards('/definitions')]);
      partners = p.items || [];
      defs = (d.items || []).filter((x) => x.type === 'PARTNER_VOUCHER' || x.type === 'COUPON_CODE' || x.partnerKey);
    } catch (e) {
      if (seq !== renderSeq) return;
      toastMsg(errorText(e), 'bad');
      writeState({ tab: 'campaigns', edit: null });
      void renderRewards();
      return;
    }
    if (seq !== renderSeq) return;
    if (!partners.length) {
      toastMsg('ჯერ დაამატე პარტნიორი — კამპანია პარტნიორს ეკუთვნის.', 'bad');
      writeState({ tab: 'partners', edit: null });
      void renderRewards();
      return;
    }

    const partnerOpts = partners.map((p) => [p.id, `${p.displayName}${p.status !== 'ACTIVE' ? ' (არააქტიური)' : ''}`]);
    const defOpts = [['', '+ ახალი ვაუჩერი ამ კამპანიისთვის']].concat(
      defs.map((x) => [x.id, `${rewardTitle(x)} · ${fmt(x.coinCost)} Medi Coins`]),
    );
    const fundingOpts = Object.entries(FUNDING_KA);

    const sticky = V().stickyActions
      ? V().stickyActions({
          dirty: false,
          cancel: `<button type="button" class="btn ghost" id="rw-c-cancel">გაუქმება</button>`,
          save: `<button type="button" class="btn primary" id="rw-c-save">მონახაზის შექმნა</button>`,
        })
      : `<footer class="v3-sticky-actions" id="v3-sticky-actions">
          <div class="v3-sticky-actions-main">
            <button type="button" class="btn ghost" id="rw-c-cancel">გაუქმება</button>
            <button type="button" class="btn primary" id="rw-c-save">მონახაზის შექმნა</button>
          </div>
        </footer>`;

    root.innerHTML = shellHtml('campaigns', `
      <form id="rw-campaign-form" class="s-stack p2-form v3-form-rail v3-campaign-form" novalidate>
        <div class="s-callout">${ico('info')}<p>კამპანია ინახება მონახაზად. აპში გამოჩნდება მხოლოდ მაშინ, როცა გაააქტიურებ — პარტნიორი აქტიური უნდა იყოს და კოდები ატვირთული.</p></div>
        ${card({
          title: 'პარტნიორი და ჯილდო',
          desc: 'აირჩიე არსებული ვაუჩერი ან შექმენი ახალი.',
          body: `<div class="s-form-grid">
            ${field({ id: 'rw-c-partner', label: 'პარტნიორი', required: true, control: selectHtml({ id: 'rw-c-partner', options: partnerOpts, required: true }) })}
            ${field({ id: 'rw-c-reward', label: 'ჯილდო', control: selectHtml({ id: 'rw-c-reward', options: defOpts, value: '' }) })}
          </div>`,
        })}
        <div id="rw-c-new-reward">
          ${card({
            title: 'ახალი ვაუჩერი',
            desc: 'რას მიიღებს ადამიანი Medi Coins-ის სანაცვლოდ.',
            body: `<div class="s-form-grid">
              ${field({ id: 'rw-c-rtitle', label: 'სახელი აპში', hint: 'ცარიელი = კამპანიის სახელი', control: inputHtml({ id: 'rw-c-rtitle', placeholder: 'მაგ. −10% ფასდაკლება' }) })}
              ${field({ id: 'rw-c-cost', label: 'ფასი (Medi Coins)', required: true, control: inputHtml({ id: 'rw-c-cost', type: 'number', value: '100', attrs: 'min="1" step="1"' }) })}
              ${field({ id: 'rw-c-inv', label: 'მარაგი', control: selectHtml({ id: 'rw-c-inv', value: 'CODE_POOL', options: [['CODE_POOL', 'ატვირთული კოდები'], ['FINITE', 'ფიქსირებული რაოდენობა'], ['UNLIMITED', 'ულიმიტო']] }) })}
              ${field({ id: 'rw-c-rkey', label: 'ვაუჩერის გასაღები', required: true, hint: 'ლათინური დიდი ასოები, ციფრები და _', control: inputHtml({ id: 'rw-c-rkey', placeholder: 'PARTNER_10_VOUCHER', attrs: 'autocomplete="off"' }) })}
            </div>`,
          })}
        </div>
        ${card({
          title: 'კამპანია',
          desc: 'სახელი, ლიმიტები და ვადები.',
          action: helpBtn('campaigns.form'),
          body: `<div class="s-form-grid">
            ${field({ id: 'rw-c-name', label: 'სახელი', required: true, control: inputHtml({ id: 'rw-c-name', placeholder: 'მაგ. პარტნიორი −10% — ოქტომბერი', required: true }) })}
            ${field({ id: 'rw-c-key', label: 'გასაღები', required: true, hint: 'ლათინური დიდი ასოები, ციფრები და _', control: inputHtml({ id: 'rw-c-key', placeholder: 'PARTNER_10_OCT', required: true, attrs: 'autocomplete="off"' }) })}
            ${field({ id: 'rw-c-fund', label: 'დაფინანსება', control: selectHtml({ id: 'rw-c-fund', value: 'PER_REDEMPTION', options: fundingOpts }) })}
            ${field({ id: 'rw-c-max', label: 'გაცვლების ლიმიტი', hint: 'ცარიელი = ულიმიტო', control: inputHtml({ id: 'rw-c-max', type: 'number', placeholder: 'ულიმიტო', attrs: 'min="1" step="1"' }) })}
            ${field({ id: 'rw-c-user', label: 'ლიმიტი ერთ ადამიანზე', hint: 'ცარიელი = ულიმიტო', control: inputHtml({ id: 'rw-c-user', type: 'number', placeholder: 'მაგ. 1', attrs: 'min="1" step="1"' }) })}
            ${field({ id: 'rw-c-low', label: 'გაფრთხილება მარაგზე', hint: 'რამდენ კოდზე გაფრთხილდე · ცარიელი = 10', control: inputHtml({ id: 'rw-c-low', type: 'number', placeholder: '10', attrs: 'min="0" step="1"' }) })}
            ${field({ id: 'rw-c-value', label: 'ღირებულება (თეთრი)', hint: 'კომერციული · 1500 = 15 ₾ · აპში არ ჩანს', control: inputHtml({ id: 'rw-c-value', type: 'number', placeholder: 'მაგ. 1500', attrs: 'min="0" step="1"' }) })}
            ${field({ id: 'rw-c-ccy', label: 'ვალუტა', hint: 'სამი ასო, მაგ. GEL', control: inputHtml({ id: 'rw-c-ccy', value: 'GEL', attrs: 'maxlength="3"' }) })}
            ${field({ id: 'rw-c-start', label: 'დაწყება', control: inputHtml({ id: 'rw-c-start', type: 'datetime-local' }) })}
            ${field({ id: 'rw-c-end', label: 'დასრულება', control: inputHtml({ id: 'rw-c-end', type: 'datetime-local' }) })}
          </div>`,
        })}
        <p id="rw-c-err" class="s-form-msg" role="alert"></p>
      </form>
      ${sticky}`);
    bindSubnav(root);

    const keyEl = $('rw-c-key');
    const rkeyEl = $('rw-c-rkey');
    const errEl = $('rw-c-err');
    const newBox = $('rw-c-new-reward');
    const rewardSel = $('rw-c-reward');
    const form = $('rw-campaign-form');

    const syncNew = () => {
      if (newBox) newBox.hidden = Boolean(rewardSel?.value);
    };
    rewardSel?.addEventListener('change', syncNew);
    syncNew();
    keyEl?.addEventListener('input', () => {
      keyEl.value = sanitizeKey(keyEl.value);
    });
    rkeyEl?.addEventListener('input', () => {
      rkeyEl.value = sanitizeKey(rkeyEl.value);
    });
    V().setDirty?.(false);
    V().watchDirty?.(form);

    const showErr = (msg, el) => {
      if (errEl) errEl.textContent = msg || '';
      root.querySelectorAll('#rw-campaign-form [aria-invalid]').forEach((n) => n.removeAttribute('aria-invalid'));
      if (el) {
        el.setAttribute('aria-invalid', 'true');
        el.focus();
      }
    };

    const leaveForm = async () => {
      if (V().dirty) {
        const ok = await V().confirmLeave?.();
        if (!ok) return;
      }
      V().setDirty?.(false);
      writeState({ tab: 'campaigns', edit: null });
      void renderRewards();
    };
    $('rw-c-cancel')?.addEventListener('click', () => void leaveForm());

    const save = async () => {
      const key = sanitizeKey(keyEl?.value);
      const name = ($('rw-c-name')?.value || '').trim();
      const partnerId = $('rw-c-partner')?.value || '';
      showErr('');
      if (!name || !partnerId) {
        const msg = 'სახელი და პარტნიორი სავალდებულოა.';
        showErr(msg, name ? $('rw-c-partner') : $('rw-c-name'));
        toastMsg(msg, 'bad');
        return;
      }
      if (key.length < 3) {
        const msg = 'კამპანიის გასაღები მინიმუმ 3 სიმბოლოა.';
        showErr(msg, keyEl);
        toastMsg(msg, 'bad');
        return;
      }

      const btn = $('rw-c-save');
      const result = await mutate(
        async () => {
          let rewardDefinitionId = rewardSel?.value || '';
          if (!rewardDefinitionId) {
            const rkey = sanitizeKey(rkeyEl?.value);
            const coinCost = intOrNull($('rw-c-cost')?.value);
            const title = ($('rw-c-rtitle')?.value || '').trim() || name;
            if (rkey.length < 3 || !coinCost) {
              throw new Error('ვაუჩერის გასაღები (მინ. 3 სიმბოლო) და ფასი სავალდებულოა.');
            }
            const created = await apiRewards('/definitions', {
              method: 'POST',
              body: {
                key: rkey,
                partnerId,
                title,
                coinCost,
                inventoryMode: $('rw-c-inv')?.value || 'CODE_POOL',
              },
            });
            rewardDefinitionId = created.definition?.id;
            if (!rewardDefinitionId) throw new Error('ვაუჩერი ვერ შეიქმნა — სცადე თავიდან.');
          }
          const commercialCurrency = ($('rw-c-ccy')?.value || '').trim().toUpperCase() || null;
          return apiRewards('/campaigns', {
            method: 'POST',
            body: {
              key,
              name,
              partnerId,
              rewardDefinitionId,
              status: 'DRAFT',
              fundingModel: $('rw-c-fund')?.value || 'PER_REDEMPTION',
              maxRedemptions: intOrNull($('rw-c-max')?.value),
              perUserLimit: intOrNull($('rw-c-user')?.value),
              commercialValueMinor: intOrNull($('rw-c-value')?.value),
              commercialCurrency,
              lowStockThreshold: intOrNull($('rw-c-low')?.value),
              startsAt: toIsoOrNull($('rw-c-start')?.value),
              endsAt: toIsoOrNull($('rw-c-end')?.value),
            },
          });
        },
        {
          pendingElement: btn,
          successMessage: 'კამპანია შეიქმნა მონახაზად',
          refresh: async () => {
            V().setDirty?.(false);
            writeState({ tab: 'campaigns', edit: null });
            await renderRewards();
          },
        },
      );
      if (!result.ok) showErr(result.error?.message || 'შეცდომა');
    };

    $('rw-c-save')?.addEventListener('click', () => void save());
    form?.addEventListener('submit', (e) => {
      e.preventDefault();
      void save();
    });
    $('rw-c-name')?.focus();
  }

  function sanitizeKey(v) {
    return String(v || '')
      .toUpperCase()
      .replace(/[^A-Z0-9_]/g, '_');
  }
  function intOrNull(v) {
    const s = String(v ?? '').trim();
    if (!s) return null;
    const n = Number(s);
    return Number.isFinite(n) ? Math.trunc(n) : null;
  }
  function toIsoOrNull(v) {
    const s = String(v || '').trim();
    if (!s) return null;
    const d = new Date(s);
    return Number.isFinite(d.getTime()) ? d.toISOString() : null;
  }

  function openCampaignCreate() {
    writeState({ tab: 'campaigns', edit: 'new' });
    void renderRewards();
  }

  /* ── Campaigns list ───────────────────────────────────── */

  function stockCell(inv) {
    const state = inv?.stockState || 'OK';
    if (state === 'UNLIMITED') return badge('UNLIMITED');
    return `${badge(state)}${inv?.available != null ? ` <span class="p2-count">${fmt(inv.available)}</span>` : ''}`;
  }

  async function renderCampaigns(root, seq) {
    const data = await apiRewards('/campaigns');
    if (seq !== renderSeq) return;
    const items = data.items || [];
    const period = (c) => {
      if (!c.startsAt && !c.endsAt) return '<span class="s-muted">ვადის გარეშე</span>';
      return `${c.startsAt ? esc(dayOf(c.startsAt)) : '…'} – ${c.endsAt ? esc(dayOf(c.endsAt)) : '…'}`;
    };
    const rows = items.map((c) => `<tr title="${esc(c.key)}">
        <td>${two(esc(c.name), esc(REWARD_TYPE_KA[c.reward?.type] || ''))}</td>
        <td>${esc(c.partner?.displayName || '—')}</td>
        <td>${badge(c.status)}</td>
        <td class="p2-nowrap">${period(c)}</td>
        <td class="num">${c.reward?.coinCost != null ? fmt(c.reward.coinCost) : '—'}</td>
        <td class="p2-nowrap">${stockCell(c.inventory)}</td>
        <td class="num">${fmt(c.redemptions ?? 0)}</td>
        <td class="p2-actions">
          ${c.status !== 'ACTIVE' ? `<button type="button" class="btn compact" data-act="${esc(c.id)}">გააქტიურება</button>` : ''}
          ${c.status === 'ACTIVE' ? `<button type="button" class="btn ghost compact" data-pause="${esc(c.id)}">შეჩერება</button>` : ''}
        </td>
      </tr>`).join('');
    root.innerHTML = shellHtml('campaigns', `
      ${card({
        title: 'ყველა კამპანია',
        desc: 'კამპანია წყვეტს, რომელი ჯილდო ჩანს აპში, რა ფასად და რა ლიმიტებით.',
        action: helpBtn('campaigns.status'),
        flush: true,
        body: items.length
          ? table('<th>კამპანია</th><th>პარტნიორი</th><th>სტატუსი</th><th>პერიოდი</th><th class="num">ფასი (Coins)</th><th>მარაგი</th><th class="num">გაცვლები</th><th><span class="sr-only">მოქმედება</span></th>', rows)
          : emptyHtml(
            'კამპანია ჯერ არ არის',
            'თანმიმდევრობა: პარტნიორი → ვაუჩერი → კამპანია → კოდების ატვირთვა → გააქტიურება.',
            `<button type="button" class="btn compact" id="rw-campaign-create-empty">+ ახალი კამპანია</button>`,
          ),
      })}`);
    bindSubnav(root);
    $('rw-campaign-create-empty')?.addEventListener('click', openCampaignCreate);

    root.querySelectorAll('[data-act]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-act');
        confirmThen({
          title: 'კამპანიის გააქტიურება',
          message: 'კამპანია გამოჩნდება აპში, თუ პარტნიორი აქტიურია და მარაგი მზადაა.',
          confirmLabel: 'გააქტიურება',
          onConfirm: async () => {
            await mutate(
              () => apiRewards(`/campaigns/${id}/activate`, { method: 'POST' }),
              { pendingElement: btn, successMessage: 'კამპანია გააქტიურდა' },
            );
          },
        });
      });
    });
    root.querySelectorAll('[data-pause]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-pause');
        confirmThen({
          title: 'კამპანიის შეჩერება',
          message: 'აქტიური კამპანია შეჩერდება და აპის მაღაზიაში აღარ გამოჩნდება.',
          confirmLabel: 'შეჩერება',
          variant: 'warning',
          onConfirm: async () => {
            await mutate(
              () => apiRewards(`/campaigns/${id}/pause`, { method: 'POST' }),
              { pendingElement: btn, successMessage: 'კამპანია შეჩერდა' },
            );
          },
        });
      });
    });
  }

  /* ── Partners ─────────────────────────────────────────── */

  function openPartnerCreate() {
    const open = V().openDialog;
    if (!open) {
      toastMsg('ფორმა ვერ გაიხსნა — განაახლე გვერდი.', 'bad');
      return;
    }
    const dlg = open({
      title: 'ახალი პარტნიორი',
      description: 'ინახება მონახაზად — აპში არ ჩანს, სანამ არ გაააქტიურებ.',
      wide: true,
      body: `<form id="rw-partner-form" class="s-stack p2-form" novalidate>
          <div class="s-form-grid">
            ${field({ id: 'rw-p-name', label: 'სახელი აპში', required: true, control: inputHtml({ id: 'rw-p-name', placeholder: 'მაგ. აფთიაქების ქსელის სახელი', required: true, attrs: 'maxlength="160"' }) })}
            ${field({ id: 'rw-p-key', label: 'გასაღები', required: true, hint: 'ლათინური დიდი ასოები, ციფრები და _ · მინ. 3', control: inputHtml({ id: 'rw-p-key', placeholder: 'PHARMACY_PARTNER', required: true, attrs: 'minlength="3" maxlength="64" autocomplete="off"' }) })}
            ${field({ id: 'rw-p-cat', label: 'კატეგორია', control: `<select id="rw-p-cat">${categoryOptions('OTHER')}</select>` })}
            ${field({ id: 'rw-p-country', label: 'ქვეყანა', hint: 'ორი ასო, მაგ. GE', control: inputHtml({ id: 'rw-p-country', value: 'GE', placeholder: 'GE', attrs: 'maxlength="2"' }) })}
          </div>
          <div class="s-form-grid">
            ${field({ id: 'rw-p-web', label: 'ვებსაიტი', control: inputHtml({ id: 'rw-p-web', placeholder: 'https://', attrs: 'maxlength="300"' }) })}
            ${field({ id: 'rw-p-contact', label: 'საკონტაქტო პირი', control: inputHtml({ id: 'rw-p-contact', attrs: 'maxlength="120"' }) })}
            ${field({ id: 'rw-p-email', label: 'ელფოსტა', control: inputHtml({ id: 'rw-p-email', type: 'email', attrs: 'maxlength="160"' }) })}
          </div>
          ${field({ id: 'rw-p-notes', label: 'შიდა შენიშვნა', hint: 'ჩანს მხოლოდ ადმინში', control: '<textarea id="rw-p-notes" rows="3" maxlength="2000"></textarea>' })}
          <p id="rw-p-err" class="s-form-msg" role="alert"></p>
        </form>`,
      footer: `<button class="btn ghost" id="rw-p-cancel" type="button">გაუქმება</button>
        <button class="btn primary" id="rw-p-save" type="button">პარტნიორის შექმნა</button>`,
    });
    const keyEl = $('rw-p-key');
    const nameEl = $('rw-p-name');
    const errEl = $('rw-p-err');
    const showErr = (msg, el) => {
      if (errEl) errEl.textContent = msg || '';
      [keyEl, nameEl].forEach((n) => n?.removeAttribute('aria-invalid'));
      if (el) {
        el.setAttribute('aria-invalid', 'true');
        el.focus();
      }
    };
    keyEl?.addEventListener('input', () => {
      keyEl.value = keyEl.value.toUpperCase().replace(/[^A-Z0-9_]/g, '_');
    });
    $('rw-p-cancel')?.addEventListener('click', () => void dlg?.close?.());
    const save = async () => {
      const key = (keyEl?.value || '').trim();
      const displayName = (nameEl?.value || '').trim();
      showErr('');
      if (!displayName) {
        showErr('სახელი სავალდებულოა.', nameEl);
        return;
      }
      if (key.length < 3) {
        showErr('გასაღები მინიმუმ 3 სიმბოლოა.', keyEl);
        return;
      }
      const r = await mutate(
        () =>
          apiRewards('/partners', {
            method: 'POST',
            body: {
              key,
              displayName,
              status: 'DRAFT',
              category: $('rw-p-cat')?.value || 'OTHER',
              countryCode: ($('rw-p-country')?.value || '').trim().toUpperCase() || null,
              website: ($('rw-p-web')?.value || '').trim() || null,
              contactName: ($('rw-p-contact')?.value || '').trim() || null,
              contactEmail: ($('rw-p-email')?.value || '').trim() || null,
              notes: ($('rw-p-notes')?.value || '').trim() || null,
            },
          }),
        {
          pendingElement: $('rw-p-save'),
          successMessage: 'პარტნიორი შეიქმნა მონახაზად',
          refresh: async () => {
            V().setDirty?.(false);
            await dlg?.close?.();
            await renderRewards();
          },
        },
      );
      if (!r.ok) showErr(r.error?.message || 'შეცდომა');
    };
    $('rw-p-save')?.addEventListener('click', () => void save());
    $('rw-partner-form')?.addEventListener('submit', (e) => {
      e.preventDefault();
      void save();
    });
    nameEl?.focus();
  }

  async function renderPartners(root, seq) {
    const data = await apiRewards('/partners');
    if (seq !== renderSeq) return;
    const items = data.items || [];
    const rows = items.map((p) => `<tr title="${esc(p.key)}">
        <td>${two(esc(p.displayName), p.legalName && p.legalName !== p.displayName ? esc(p.legalName) : '')}</td>
        <td>${esc(CATEGORY_KA[p.category] || p.category || '—')}</td>
        <td>${badge(p.status)}</td>
        <td>${esc(COUNTRY_KA[p.countryCode] || p.countryCode || '—')}</td>
        <td class="s-muted">${p.updatedAt ? esc(when(p.updatedAt)) : '—'}</td>
        <td class="p2-actions">
          <button type="button" class="btn ${p.status === 'ACTIVE' ? 'ghost ' : ''}compact" data-pause-partner="${esc(p.id)}" data-status="${esc(p.status)}">${p.status === 'ACTIVE' ? 'შეჩერება' : 'გააქტიურება'}</button>
        </td>
      </tr>`).join('');
    root.innerHTML = shellHtml('partners', `
      ${card({
        title: 'ყველა პარტნიორი',
        desc: 'კონტაქტები და შენიშვნები მხოლოდ ადმინში ჩანს.',
        flush: true,
        body: items.length
          ? table('<th>პარტნიორი</th><th>კატეგორია</th><th>სტატუსი</th><th>ქვეყანა</th><th>განახლდა</th><th><span class="sr-only">მოქმედება</span></th>', rows)
          : emptyHtml(
            'პარტნიორი ჯერ არ არის',
            'დაამატე პარტნიორი, შემდეგ შექმენი კამპანია. სატესტო ბიზნესს წარმოებაში ნუ გაააქტიურებ.',
            `<button type="button" class="btn compact" id="rw-partner-create-empty">+ ახალი პარტნიორი</button>`,
          ),
      })}`);
    bindSubnav(root);
    $('rw-partner-create-empty')?.addEventListener('click', openPartnerCreate);
    root.querySelectorAll('[data-pause-partner]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-pause-partner');
        const cur = btn.getAttribute('data-status');
        const status = cur === 'ACTIVE' ? 'PAUSED' : 'ACTIVE';
        const activating = status === 'ACTIVE';
        confirmThen({
          title: activating ? 'პარტნიორის გააქტიურება' : 'პარტნიორის შეჩერება',
          message: activating
            ? 'პარტნიორი გახდება აქტიური. მისი კამპანიები ცალკე უნდა გააქტიურდეს.'
            : 'პარტნიორი შეჩერდება და მისი შეთავაზებები აპში აღარ გამოჩნდება.',
          confirmLabel: activating ? 'გააქტიურება' : 'შეჩერება',
          variant: activating ? 'neutral' : 'warning',
          onConfirm: async () => {
            await mutate(
              () => apiRewards(`/partners/${id}`, { method: 'PATCH', body: { status } }),
              {
                pendingElement: btn,
                successMessage: activating ? 'პარტნიორი აქტიურია' : 'პარტნიორი შეჩერებულია',
              },
            );
          },
        });
      });
    });
  }

  /* ── Redemptions ──────────────────────────────────────── */

  async function renderRedemptions(root, seq) {
    const data = await apiRewards('/redemptions?limit=50');
    if (seq !== renderSeq) return;
    const items = data.items || [];
    const total = Number(data.total);
    const rows = items.map((r) => {
      const perk = r.reward?.type === 'DIGITAL_PERK' || r.reward?.type === 'PREMIUM_ACCESS';
      const who = r.partner?.displayName || r.partner?.key || (perk ? 'Medicard ბონუსი' : '');
      const code = r.codeMasked
        ? `<span class="mono">${esc(maskedCode(r.codeMasked))}</span>`
        : r.codeState ? badge(r.codeState, CODE_TONES) : '<span class="s-muted">—</span>';
      return `<tr class="is-click" tabindex="0" data-red="${esc(r.id)}">
        <td>${two(esc(rewardTitle(r.reward)), esc(who))}</td>
        <td>${badge(r.status)}</td>
        <td class="num">${fmt(r.coinCost)}</td>
        <td>${code}</td>
        <td class="mono s-muted">${esc(r.maskedUserRef || '—')}</td>
        <td class="s-muted">${esc(when(r.redeemedAt))}</td>
      </tr>`;
    }).join('');
    root.innerHTML = shellHtml('redemptions', `
      ${card({
        title: 'ბოლო გაცვლები',
        desc: 'სტრიქონზე დაჭერით გაიხსნება დეტალები. ჯანმრთელობის მონაცემი აქ არ ჩანს.',
        action: Number.isFinite(total) && total > items.length
          ? `<span class="p2-meta">ნაჩვენებია ბოლო ${fmt(items.length)} · სულ ${fmt(total)}</span>`
          : '',
        flush: true,
        body: items.length
          ? table('<th>ჯილდო</th><th>სტატუსი</th><th class="num">ფასი (Coins)</th><th>კოდი</th><th>მომხმარებელი</th><th>დრო</th>', rows)
          : emptyHtml('გაცვლა ჯერ არ არის', 'როცა ვინმე ჯილდოს აიღებს, ჩანაწერი აქ გამოჩნდება.'),
      })}`);
    bindSubnav(root);
    bindRows(root, 'tr[data-red]', (row) => openRedemption(row.getAttribute('data-red')));
  }

  /* ── Codes + import dialog ────────────────────────────── */

  function openCodeImport(definitionId, title) {
    const open = V().openDialog;
    if (!open) {
      toastMsg('დიალოგი ვერ გაიხსნა — განაახლე გვერდი.', 'bad');
      return;
    }
    const dlg = open({
      title: 'კოდების ატვირთვა',
      description: `${title ? `${title}. ` : ''}თითო ხაზზე ერთი კოდი. დუბლიკატები გამოტოვდება; სრული სია ბრაუზერში არ რჩება.`,
      watchDirty: false,
      body: `<div class="s-stack p2-form">
          <label class="s-field" for="rw-code-import-ta">
            <span>კოდები</span>
            <textarea id="rw-code-import-ta" class="is-code" rows="10" placeholder="CODE001&#10;CODE002&#10;…"></textarea>
            <small id="rw-code-import-count">0 კოდი</small>
          </label>
          <p id="rw-code-import-err" class="s-form-msg" role="alert"></p>
        </div>`,
      footer: `
        <button type="button" class="btn ghost" id="rw-import-cancel">გაუქმება</button>
        <button type="button" class="btn primary" id="rw-import-go">ატვირთვა</button>`,
    });
    const ta = $('rw-code-import-ta');
    const parse = () => (ta?.value || '').split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    ta?.addEventListener('input', () => {
      const n = parse().length;
      const counter = $('rw-code-import-count');
      if (counter) counter.textContent = `${fmt(n)} კოდი`;
    });
    $('rw-import-cancel')?.addEventListener('click', () => void dlg?.close?.());
    $('rw-import-go')?.addEventListener('click', async () => {
      const codes = parse();
      const errEl = $('rw-code-import-err');
      if (!codes.length) {
        if (errEl) errEl.textContent = 'ჩასვი მინიმუმ ერთი კოდი.';
        ta?.focus();
        return;
      }
      if (errEl) errEl.textContent = '';
      const btn = $('rw-import-go');
      const r = await mutate(
        () =>
          apiRewards(`/rewards/${definitionId}/codes/import`, {
            method: 'POST',
            body: { codes },
          }),
        {
          pendingElement: btn,
          successMessage: null,
          refresh: async (res) => {
            const report = res?.report || {};
            const expired = Number(report.expiredRejected) || 0;
            const msg = `ატვირთულია ${fmt(report.accepted ?? 0)} · დუბლიკატი ${fmt(report.duplicates ?? 0)} · არასწორი ${fmt(report.invalid ?? report.rejected ?? 0)}${expired ? ` · ვადაგასული ${fmt(expired)}` : ''}`;
            toastMsg(msg, 'ok');
            await dlg?.close?.();
            if (readState().tab === 'codes') void renderRewards();
          },
        },
      );
      if (!r.ok && errEl) errEl.textContent = r.error?.message || 'ატვირთვა ვერ მოხერხდა';
    });
    ta?.focus();
  }

  function openMaskedCodes(definitionId, title) {
    const open = V().openDialog;
    if (!open) return;
    const dlg = open({
      title: 'შენიღბული კოდები',
      description: `${title ? `${title} · ` : ''}ბოლოს ატვირთული 25. სრული კოდი არასდროს ჩანს.`,
      wide: true,
      watchDirty: false,
      body: `<div id="rw-codes-panel" class="p2-dialog">${V().skeleton ? V().skeleton(5) : 'იტვირთება…'}</div>`,
      footer: `<button type="button" class="btn ghost" id="rw-codes-close">დახურვა</button>`,
    });
    $('rw-codes-close')?.addEventListener('click', () => void dlg?.close?.());
    apiRewards(`/rewards/${definitionId}/codes?limit=25`)
      .then((res) => {
        const host = $('rw-codes-panel');
        if (!host) return;
        const items = res.items || [];
        const total = Number(res.total);
        const rows = items.map((c) => `<tr>
            <td class="mono">${esc(maskedCode(c.codeMasked))}</td>
            <td>${badge(c.status, CODE_TONES)}</td>
            <td class="s-muted">${c.expiresAt ? esc(dayOf(c.expiresAt)) : 'ვადის გარეშე'}</td>
            <td class="s-muted">${c.createdAt ? esc(when(c.createdAt)) : '—'}</td>
          </tr>`).join('');
        host.innerHTML = items.length
          ? `${Number.isFinite(total) ? `<p class="p2-note">სულ ${fmt(total)} კოდი${total > items.length ? ` · ნაჩვენებია ${fmt(items.length)}` : ''}</p>` : ''}
             ${table('<th>კოდი</th><th>სტატუსი</th><th>ვადა</th><th>ატვირთვა</th>', rows)}`
          : emptyHtml('კოდი ჯერ არ არის ატვირთული', '„კოდების ატვირთვა“ დაამატებს პარტნიორის კოდებს.');
      })
      .catch((err) => {
        const host = $('rw-codes-panel');
        if (host) host.innerHTML = `<div class="s-callout is-bad">${ico('alert')}<p>${esc(errorText(err))}</p></div>`;
      });
  }

  async function renderCodes(root, seq) {
    // Campaign rows carry partner names and live code counts per reward (same REWARDS_VIEW access).
    const [defs, campaigns] = await Promise.all([
      apiRewards('/definitions'),
      apiRewards('/campaigns').catch(() => null),
    ]);
    if (seq !== renderSeq) return;
    const pools = (defs.items || []).filter((d) => d.inventoryMode === 'CODE_POOL');
    const byReward = new Map();
    (campaigns?.items || []).forEach((c) => {
      if (c.reward?.key && !byReward.has(c.reward.key)) byReward.set(c.reward.key, c);
    });
    const rows = pools.map((d) => {
      const camp = byReward.get(d.key);
      const inv = camp?.inventory;
      return `<tr>
        <td>${two(esc(rewardTitle(d)), `<span class="mono">${esc(d.key)}</span>`)}</td>
        <td>${esc(camp?.partner?.displayName || d.partnerKey || '—')}</td>
        <td>${badge(d.status)}</td>
        <td class="p2-nowrap">${inv ? stockCell(inv) : '<span class="s-muted">კამპანიის გარეშე</span>'}</td>
        <td class="p2-actions">
          <button type="button" class="btn compact" data-import="${esc(d.id)}" data-title="${esc(rewardTitle(d))}">კოდების ატვირთვა</button>
          <button type="button" class="btn ghost compact" data-list="${esc(d.id)}" data-title="${esc(rewardTitle(d))}">შენიღბული სია</button>
        </td>
      </tr>`;
    }).join('');
    root.innerHTML = shellHtml('codes', `
      ${card({
        title: 'კოდებიანი ჯილდოები',
        desc: 'ატვირთვა აბრუნებს მხოლოდ რაოდენობებს — სრული კოდი ბრაუზერში არასდროს ჩანს.',
        action: helpBtn('codes.import'),
        flush: true,
        body: pools.length
          ? table('<th>ჯილდო</th><th>პარტნიორი</th><th>სტატუსი</th><th>ხელმისაწვდომი</th><th><span class="sr-only">მოქმედება</span></th>', rows)
          : emptyHtml('კოდებიანი ჯილდო ჯერ არ არის', 'ახალი ვაუჩერის კამპანიისას აირჩიე „ატვირთული კოდები“ — მარაგი აქ გამოჩნდება.'),
      })}`);
    bindSubnav(root);
    root.querySelectorAll('[data-import]').forEach((btn) => {
      btn.addEventListener('click', () => openCodeImport(btn.getAttribute('data-import'), btn.getAttribute('data-title')));
    });
    root.querySelectorAll('[data-list]').forEach((btn) => {
      btn.addEventListener('click', () => openMaskedCodes(btn.getAttribute('data-list'), btn.getAttribute('data-title')));
    });
  }

  /* ── Entry ────────────────────────────────────────────── */

  async function renderRewards() {
    const root = $('tab-rewards');
    if (!root) return;
    renderSeq += 1;
    const seq = renderSeq;

    const { tab, edit } = readState();

    Shell().mountHeader?.(headerFor(tab, edit));
    $('rw-refresh')?.addEventListener('click', () => void renderRewards());
    $('rw-campaign-create')?.addEventListener('click', openCampaignCreate);
    $('rw-partner-create')?.addEventListener('click', openPartnerCreate);

    root.innerHTML = shellHtml(edit === 'new' ? 'campaigns' : tab, V().skeleton ? V().skeleton(6) : '<div class="s-empty">იტვირთება…</div>');
    bindSubnav(root);
    // Persist tab without re-entry churn: only if URL lacks a valid tab
    try {
      const hs = Shell().hashParams?.() || new URLSearchParams();
      if (!TAB_KEYS.has(hs.get('tab') || '')) {
        const params = new URLSearchParams(hs);
        params.set('tab', tab);
        if (edit === 'new') params.set('edit', 'new');
        else params.delete('edit');
        const qs = params.toString();
        const next = qs ? `#/rewards?${qs}` : '#/rewards?tab=overview';
        if (location.hash !== next) history.replaceState({ tab: 'rewards' }, '', next);
      }
    } catch { /* ignore */ }
    try {
      if (edit === 'new') await renderCampaignForm(root, seq);
      else if (tab === 'store') await renderStore(root, seq);
      else if (tab === 'partners') await renderPartners(root, seq);
      else if (tab === 'campaigns') await renderCampaigns(root, seq);
      else if (tab === 'redemptions') await renderRedemptions(root, seq);
      else if (tab === 'codes') await renderCodes(root, seq);
      else if (tab === 'referrals') await renderReferrals(root, seq);
      else await renderOverview(root, seq);
    } catch (e) {
      if (seq !== renderSeq) return;
      root.innerHTML = shellHtml(
        tab,
        `<div class="s-card"><div class="s-empty">${ico('alert')}<strong>ჩატვირთვა ვერ მოხერხდა</strong><span>${esc(errorText(e, 'სცადე ხელახლა'))}</span>
        <button type="button" class="btn compact" id="rw-retry">${ico('refresh')} ხელახლა ცდა</button></div></div>`,
      );
      bindSubnav(root);
      $('rw-retry')?.addEventListener('click', () => void renderRewards());
    }
  }

  global.renderRewards = renderRewards;
  global.AdminRewardsV3 = {
    render: renderRewards,
    openCampaignCreate,
    openCodeImport,
    apiRewards,
  };
})(window);
