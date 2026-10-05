// MEDICARD web — MEDIRUN (/run): read-only on the web. Walking, the map and opening boxes need the phone's
// GPS, so they stay in the app; here: the Medi Coins wallet (GET /api/medipulsi/wallet — never a coordinate,
// only park / district names) and the leaderboard with the weekly prizes (GET /api/medipulsi/leaderboard).
// Mirrors mobile src/components/run/RunWallet.tsx and the leaderboard in PulsePanels.tsx.
import { h, mount, icon, card, button, skeleton, errorBox, fmtDate, fmtTime, fmtNum, segmented } from '../ui.js';
import { get } from '../api.js';
import { t, isEn } from '../i18n.js';
import { wordmark } from '../brand.js';

const CSS = '/app/css/run.css';
const APP_STORE = 'https://apps.apple.com/app/id6812517519';
function ensureCss() {
  if (!document.querySelector(`link[href="${CSS}"]`)) document.head.append(h('link', { rel: 'stylesheet', href: CSS }));
}

const ordinal = (n) => (isEn ? `#${n}` : n === 1 ? 'პირველი' : `მე-${n}`);
const km = (m) => (m >= 1000 ? `${(m / 1000).toFixed(m >= 10000 ? 0 : 1)} ${t('კმ', 'km')}` : `${Math.round(m)} ${t('მ', 'm')}`);

function walletRow(row) {
  const where = [row.place, row.district || row.city].filter(Boolean).join(' · ');
  const title = row.kind === 'prize'
    ? t(`კვირის პრიზი · ${row.board === 'meters' ? 'მანძილი' : 'ყუთები'}`, `Weekly prize · ${row.board === 'meters' ? 'distance' : 'boxes'}`)
    : row.kind === 'grand' ? t('დიდი საჩუქარი', 'Grand prize')
      : where ? t(`ყუთი · ${where}`, `Box · ${where}`) : t('ყუთი', 'Box');
  const sub = [
    row.kind === 'box' && row.rank ? (row.rank === 1 ? t('პირველი აღმომჩენი', 'first finder') : t(`${ordinal(row.rank)} გამხსნელი`, `opener ${ordinal(row.rank)}`)) : null,
    row.createdAt ? `${fmtDate(row.createdAt)}, ${fmtTime(row.createdAt)}` : null,
  ].filter(Boolean).join(' · ');
  return h('div', { class: 'run-row' },
    h('span', { class: `run-row-ic ${row.kind}` }, icon(row.kind === 'prize' ? 'trophy' : row.kind === 'grand' ? 'star' : 'gift', { size: 16 })),
    h('div', { class: 'run-row-main' }, h('b', null, title), sub ? h('span', null, sub) : null),
    h('span', { class: 'run-row-coins' }, `+${fmtNum(row.amount)}`));
}

export default async function runPage(root) {
  ensureCss();
  let alive = true;
  const st = { board: 'boxes', period: 'week' };
  const walletSlot = h('div', null, skeleton(4));
  const boardSlot = h('div', null, skeleton(6));

  mount(root,
    h('header', { class: 'page-head' },
      h('div', { class: 'page-head-text' }, h('h1', null, wordmark('run')), h('p', null, t('შენი Medi Coins, ცხრილი და კვირის პრიზები', 'Your Medi Coins, the leaderboard and weekly prizes'))),
      h('div', { class: 'page-head-actions' }, button(t('სირბილი აპში', 'Walk in the app'), { icon: 'smartphone', variant: 'secondary', href: APP_STORE, external: true }))),
    h('div', { class: 'run-hint card' }, icon('mapPin', { size: 18 }),
      h('span', null, t('ყუთების პოვნა და გახსნა ტელეფონის GPS-ით ხდება — გაიარე, გაანათე ქალაქი და გახსენი ყუთები MEDICARD აპში. აქ ხედავ შედეგს.', 'Finding and opening boxes uses your phone’s GPS — walk, light up the city and open boxes in the MEDICARD app. Here you see the results.'))),
    h('div', { class: 'run-grid' },
      h('section', { class: 'hub-section' }, h('div', { class: 'hub-section-head' }, h('h2', null, 'Medi Coins')), walletSlot),
      h('section', { class: 'hub-section' }, h('div', { class: 'hub-section-head' }, h('h2', null, t('ერთად უფრო შორს', 'Further together'))), boardSlot)));

  async function loadWallet() {
    try {
      const w = await get('/api/medipulsi/wallet');
      if (!alive) return;
      const season = w.season || {};
      mount(walletSlot, card({ class: 'run-wallet' },
        h('div', { class: 'run-balance' },
          h('div', null, h('span', { class: 'faint' }, t('ბალანსი', 'Balance')), h('b', null, fmtNum(w.balance || 0))),
          button(t('მაღაზია', 'Store'), { icon: 'gift', size: 'sm', variant: 'ghost', href: '/quest?tab=rewards' })),
        season.start ? h('div', { class: 'faint run-season' }, t(`სეზონი · ${fmtDate(season.start)} – ${fmtDate(season.end)}`, `Season · ${fmtDate(season.start)} – ${fmtDate(season.end)}`)) : null,
        h('div', { class: 'run-stats' },
          h('div', null, h('b', { class: 'teal' }, `+${fmtNum(season.earned || 0)}`), h('span', null, t('ქოინი', 'Coins'))),
          h('div', null, h('b', null, fmtNum(season.boxes || 0)), h('span', null, t('ყუთი', 'Boxes'))),
          h('div', null, h('b', { class: 'amber' }, fmtNum(season.firsts || 0)), h('span', null, t('პირველი', 'First finds')))),
        (w.rows || []).length
          ? h('div', { class: 'run-rows' }, w.rows.slice(0, 8).map(walletRow))
          : h('p', { class: 'muted', style: { fontSize: '13.5px' } }, t('ყუთი ჯერ არ გაგიხსნია. პირველივე გახსნის ქოინები აქ გამოჩნდება — როდის, სად და რამდენი.', 'No box opened yet. The coins from your first opening show up here — when, where and how much.'))));
    } catch (e) {
      if (alive) mount(walletSlot, card(errorBox(e, loadWallet)));
    }
  }

  async function loadBoard() {
    mount(boardSlot, skeleton(6));
    try {
      const lb = await get('/api/medipulsi/leaderboard', { period: st.period, board: st.board });
      if (!alive) return;
      const boxes = st.board === 'boxes';
      const value = (r) => (boxes ? `${fmtNum(r.coins || 0)}` : km(r.meters || 0));
      const detail = (r) => (boxes ? t(`${r.boxes || 0} ყუთი · ${r.firsts || 0}-ჯერ პირველი`, `${r.boxes || 0} boxes · first ${r.firsts || 0}×`) : t(`${r.walks || 0} გასეირნება`, `${r.walks || 0} walks`));
      const left = lb.prizes?.endsAt ? Math.max(0, Date.parse(lb.prizes.endsAt) - Date.now()) : 0;
      const d = Math.floor(left / 86400000);
      const hh = Math.floor((left % 86400000) / 3600000);
      const mm = Math.floor((left % 3600000) / 60000);
      mount(boardSlot, card({ class: 'run-board' },
        h('div', { class: 'run-tabs' },
          segmented([{ value: 'boxes', label: t('ყუთები', 'Boxes') }, { value: 'meters', label: t('მანძილი', 'Distance') }], st.board, (v) => { st.board = v; loadBoard(); }),
          segmented([{ value: 'week', label: t('ეს კვირა', 'This week') }, { value: 'season', label: t('სეზონი', 'Season') }], st.period, (v) => { st.period = v; loadBoard(); })),
        lb.prizes && st.period === 'week' ? h('div', { class: 'run-prizes' },
          icon('trophy', { size: 18 }),
          h('div', null,
            h('b', null, t('კვირის პრიზები', 'Weekly prizes'), ' · ', lb.prizes.coins.map((c) => fmtNum(c)).join(' / '), ' Medi Coins'),
            h('span', null, `${d ? t(`${d} დღე ${hh} სთ`, `${d}d ${hh}h`) : t(`${hh} სთ ${mm} წთ`, `${hh}h ${mm}m`)} · ${t('ორშაბათს ჩაირიცხება სიაში მყოფ პირველ სამეულს', 'credited on Monday to the top three on the list')}`))) : null,
        lb.me ? h('div', { class: 'run-me' }, h('b', null, t(`შენ ხარ #${lb.me.rank}`, `You’re #${lb.me.rank}`), lb.me.listed ? '' : t(' · სიაში არ ხარ', ' · not on the list')),
          h('span', null, value(lb.me)),
          !lb.me.listed ? h('p', { class: 'faint' }, t('სიაში ჩართვა MEDICARD აპის MEDIRUN-ში ხდება — სხვებიც დაგინახავენ და პრიზსაც მიიღებ.', 'Join the list in MEDIRUN in the MEDICARD app — others will see you and you can win a prize.')) : null) : null,
        (lb.rows || []).length
          ? h('ol', { class: 'run-list' }, lb.rows.slice(0, 50).map((r, i) => h('li', { class: i < 3 ? `top top${i + 1}` : '' },
            h('span', { class: 'run-rank' }, String(i + 1)),
            h('span', { class: 'run-name' }, h('b', null, r.handle || '—'), h('span', null, detail(r))),
            h('span', { class: 'run-val' }, value(r)))))
          : h('p', { class: 'muted', style: { fontSize: '13.5px' } }, boxes
            ? t('ამ პერიოდის სიაში ჯერ არავინაა. აქ ჩანან ის, ვინც სიაში ჩაერთო და ამ პერიოდში ყუთი გახსნა.', 'Nobody is on this period’s list yet. It shows players who joined the list and opened a box in this period.')
            : t('ამ პერიოდის სიაში ჯერ არავინაა. აქ ჩანან ის, ვინც სიაში ჩაერთო და ამ პერიოდში გასეირნება დაასრულა.', 'Nobody is on this period’s list yet. It shows players who joined the list and finished a walk in this period.')),
        (lb.lastWeek || []).length ? h('div', { class: 'run-last' }, h('div', { class: 'faint' }, t('გასული კვირის გამარჯვებულები', 'Last week’s winners')),
          lb.lastWeek.map((w) => h('div', null, `${w.rank}. ${w.handle || '—'} · +${fmtNum(w.coins)}`))) : null,
        h('p', { class: 'disclaimer' }, icon('info', { size: 14 }), boxes
          ? t('ყუთების გახსნით მიღებული ქოინები ამ პერიოდში. ყუთს რამდენიმე ადამიანი ხსნის — პირველი იღებს სრულ თანხას, შემდეგები ნაკლებს. სიაში მონაწილეობას შენ ირჩევ; მდებარეობა არ ჩანს.', 'Coins earned by opening boxes in this period. Several people open each box — the first gets the full amount, the next ones less. You choose whether to be on the list; your location isn’t shown.')
          : t('დასრულებული სესიების დადასტურებული მანძილი, ნებისმიერი ქალაქიდან. სიაში მონაწილეობას შენ ირჩევ; მარშრუტი და მდებარეობა არ ჩანს.', 'Verified distance from finished sessions, in any city. You choose whether to be on the list; your route and location aren’t shown.'))));
    } catch (e) {
      if (alive) mount(boardSlot, card(errorBox(e, loadBoard)));
    }
  }

  loadWallet();
  loadBoard();
  return () => { alive = false; };
}
