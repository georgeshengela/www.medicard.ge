// MEDIRUN „გაანათე თბილისი“ — gift drops from the command line (main database, the same plan as the autopilot).
//
//   node server/scripts/medirun-drops.mjs plan   [YYYY-MM-DD]            preview one day (no database)
//   node server/scripts/medirun-drops.mjs apply  [YYYY-MM-DD] [--days N]  place the planned boxes (idempotent)
//   node server/scripts/medirun-drops.mjs status [YYYY-MM-DD]            boxes, openings, coins paid
//   node server/scripts/medirun-drops.mjs spots                          walkable spots per district
//   node server/scripts/medirun-drops.mjs drop --spot <id|rike|vake|lisi|april9|finale> --coins 50 --stock 10 --at 2026-10-05T18:00 [--hours 3]
//   node server/scripts/medirun-drops.mjs grand --spot <id|rike|…>       hide the 31 Dec grand prize at this spot (secret!)
//   node server/scripts/medirun-drops.mjs clear  YYYY-MM-DD              archive that day's campaign boxes
//
// Dates are Tbilisi dates; without a date → today. Everything except `plan` and `spots` writes to the main
// database, like the admin MEDIRUN page does. Boxes that already exist are never changed by `apply`.
import { fileURLToPath } from 'node:url';

const args = process.argv.slice(2);
const flag = (name, fallback = null) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : fallback; };
const positional = args.filter((a, i) => !a.startsWith('--') && !(i > 0 && args[i - 1].startsWith('--')));
const [command, dateArg] = positional;
const maps = (s) => `https://www.google.com/maps?q=${s.lat},${s.lng}`;

async function main() {
  const dotenv = await import('dotenv');
  dotenv.config({ path: fileURLToPath(new URL('../.env', import.meta.url)), quiet: true });
  const ap = await import('../src/lib/medipulsi/autopilot.js');
  const date = dateArg && /^\d{4}-\d{2}-\d{2}$/.test(dateArg) ? dateArg : ap.tbilisiDate();
  const { spots, golden } = ap.loadSpots();
  const spotById = (id) => golden?.[id] ? { id, ...golden[id] } : spots.find((s) => s.id === id);

  if (command === 'plan') {
    const plan = ap.planDay(date);
    if (!plan.length) { console.log(`${date}: no boxes (outside ${ap.CAMPAIGN.start}…${ap.CAMPAIGN.end} or no spots).`); return 0; }
    const coins = plan.reduce((s, p) => s + p.rule.coins * p.gift.stock, 0);
    console.log(`${date} — ${plan.length} boxes, up to ${plan.reduce((s, p) => s + p.gift.stock, 0)} openings, up to ${coins} coins\n`);
    for (const { gift, rule } of plan) {
      const t = gift.startsAt.toISOString().slice(11, 16);
      console.log(`${gift.id.padEnd(30)} ${t}Z  ${String(rule.coins || gift.title).padStart(4)} × ${String(gift.stock).padStart(2)}  ${rule.minPercent ? `[≥${rule.minPercent}%] ` : ''}${rule.meta.district || ''} · ${rule.meta.place || ''}  ${maps({ lat: gift.latitude, lng: gift.longitude })}`);
    }
    return 0;
  }
  if (command === 'spots') {
    const by = new Map();
    for (const s of spots) by.set(s.district, (by.get(s.district) || 0) + 1);
    console.log(`${spots.length} spots`); for (const [d, n] of [...by].sort((a, b) => b[1] - a[1])) console.log(`  ${d.padEnd(14)} ${n}`);
    console.log('golden:', Object.keys(golden || {}).join(', ') || '—');
    return 0;
  }

  const { prisma } = await import('../src/lib/prisma.js');
  try {
    if (command === 'apply') {
      const days = Math.max(1, Math.min(31, Number(flag('days', 1)) || 1));
      for (let i = 0; i < days; i++) {
        const d = ap.dateAdd(date, i), r = await ap.applyDay(d, { db: prisma });
        console.log(`${d}: ${r.created} new, ${r.existing} already there (${r.total} planned)`);
      }
      return 0;
    }
    if (command === 'status') {
      const s = await ap.dayStatus(date, { db: prisma });
      console.log(`${date}: ${s.boxes} boxes · opened ${s.openings}/${s.capacity} · coins paid ${s.coinsPaid}`);
      for (const g of s.gifts.sort((a, b) => a.id.localeCompare(b.id))) console.log(`  ${g.id.padEnd(30)} ${String(g.allocated).padStart(2)}/${g.stock}${g.archived ? ' (archived)' : ''}  ${g.rule?.meta?.place || ''}`);
      return 0;
    }
    if (command === 'drop' || command === 'grand') {
      const spot = flag('spot') ? spotById(flag('spot')) : (flag('lat') && flag('lng') ? { id: 'manual', lat: Number(flag('lat')), lng: Number(flag('lng')) } : null);
      if (!spot) { console.error('spot not found: give --spot <id|rike|vake|lisi|april9|finale> or --lat/--lng'); return 2; }
      let gift, rule;
      if (command === 'grand') {
        const plan = ap.planDay(ap.CAMPAIGN.grand.dropAt.slice(0, 10), { spots: [{ ...spot, areaM2: 1e9 }], golden: {} }).find((p) => p.gift.id === ap.CAMPAIGN.grand.id);
        ({ gift, rule } = plan);
        const existing = await prisma.medipulsiGift.findUnique({ where: { id: gift.id } });
        if (existing?.allocated) { console.error('the grand prize was already opened — not moving it'); return 1; }
        if (existing) await prisma.medipulsiGift.update({ where: { id: gift.id }, data: { longitude: spot.lng, latitude: spot.lat, revision: { increment: 1 } } });
        else await ap.applyDay(gift.startsAt.toISOString().slice(0, 10), { db: prisma, plan: [{ gift, rule }] });
        console.log(`grand prize hidden at ${spot.place || spot.id} (${maps(spot)}), visible from ${gift.startsAt.toISOString()} for players with ≥${rule.minPercent}% of Tbilisi.`);
        return 0;
      }
      const at = flag('at'); const coins = Number(flag('coins', 50)); const stock = Number(flag('stock', 10)); const hours = Number(flag('hours', 3));
      if (!at || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(at) || !(coins > 0) || !(stock > 0)) { console.error('usage: drop --spot <id> --coins 50 --stock 10 --at 2026-10-05T18:00 [--hours 3]'); return 2; }
      const start = new Date(`${at}:00${ap.CAMPAIGN.utcOffset}`), end = new Date(start.getTime() + hours * 3600_000);
      const id = `glow-${at.slice(0, 10)}-x-${at.slice(11, 13)}${at.slice(14, 16)}-${(spot.id || 'm').replace(/[^a-z0-9]/gi, '').slice(0, 20)}`;
      gift = { id, title: `${coins} Medi Coins`, description: `გახსენი ყუთი და ${coins} Medi Coins თავისით ჩაირიცხება შენს ანგარიშზე.`, longitude: spot.lng, latitude: spot.lat, pulseRadius: 400, revealRadius: 30, rewardKind: 'DIGITAL', stock, published: true, archived: false, startsAt: start, endsAt: end };
      rule = { giftId: id, campaign: ap.CAMPAIGN.id, coins, minPercent: null, areaId: null, meta: { kind: 'manual', spot: spot.id, place: spot.place || null, district: spot.district || null, titleEn: `${coins} Medi Coins`, descriptionEn: `Open the box and ${coins} Medi Coins land in your account automatically.` } };
      const r = await ap.applyDay(at.slice(0, 10), { db: prisma, plan: [{ gift, rule }] });
      console.log(r.created ? `placed ${id} at ${spot.place || spot.id} (${maps(spot)})` : `${id} already exists`);
      return 0;
    }
    if (command === 'clear') {
      if (!dateArg) { console.error('usage: clear YYYY-MM-DD'); return 2; }
      const r = await prisma.medipulsiGift.updateMany({ where: { id: { startsWith: `glow-${date}-` }, archived: false }, data: { archived: true, revision: { increment: 1 } } });
      console.log(`${date}: archived ${r.count} boxes`);
      return 0;
    }
  } finally {
    await prisma.$disconnect();
  }
  console.log(fileURLToPath(import.meta.url).split(/[\\/]/).pop(), '— commands: plan | apply | status | spots | drop | grand | clear (see the header of this file)');
  return 2;
}

main().then((code) => process.exit(code), (error) => { console.error(error); process.exit(1); });
