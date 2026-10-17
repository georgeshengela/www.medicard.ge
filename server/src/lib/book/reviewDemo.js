/**
 * MEDIBOOK App Review demo place (docs/APP-REVIEW-2026-10-17.md). The review notes send the reviewer to a
 * place that takes online bookings, and every claimed business in the catalogue is a real one, so a clearly
 * marked demo place exists for review: „MEDICARD Demo Studio“ (fixed id, CLAIMED, online booking on, two
 * people, three services without a price, open every day 09:00–21:00 Tbilisi). Its free times come from its
 * hours, so they always lie ahead of „now“ — nothing is seeded once to go stale (the MEDICOACH lesson).
 * An hourly pass (job lease `book-review-demo`) creates the place when it is missing, puts back only what
 * keeps it bookable (status, hours, settings, people, services) when someone changed it, and reports how many
 * of the next 7 days have free time. It writes only rows with the demo ids.
 *
 * Real people never see it: catalogue reads show it only to the App Review phone account and team
 * @medicard.ge accounts (`canSeeBookReviewDemo`), and only they may book it. Admin #/book → hide (HIDDEN)
 * pauses the pass; `APP_REVIEW_BOOK_DEMO=off` on Render stops it.
 */
import { prisma } from '../prisma.js';
import { withJobLease } from '../jobLease.js';
import { isAppReviewPhone } from '../appReviewPhone.js';
import { BOOK_REVIEW_DEMO_ID, BOOK_REVIEW_DEMO_SLUG, TBILISI_CENTER } from './catalog.js';
import { dateStrip } from './bookings.js';

export { BOOK_REVIEW_DEMO_ID, BOOK_REVIEW_DEMO_SLUG };

const HOUR = 3600000;
const TEAM_EMAIL = /@medicard\.ge$/i;
const OPEN = { from: '09:00', to: '21:00' };
export const BOOK_REVIEW_DEMO_MIN_FREE_DAYS = 3;

export function bookReviewDemoOn(env = process.env) {
  return String(env.APP_REVIEW_BOOK_DEMO ?? '').trim().toLowerCase() !== 'off';
}

/** The App Review phone account or a team @medicard.ge account. */
export function canSeeBookReviewDemo(user, config = {}) {
  if (!user) return false;
  return isAppReviewPhone(user.phone, config) || TEAM_EMAIL.test(String(user.email ?? '').trim());
}

/** Is this id / slug the demo place? */
export const isBookReviewDemo = (idOrSlug) => idOrSlug === BOOK_REVIEW_DEMO_ID || idOrSlug === BOOK_REVIEW_DEMO_SLUG;

/** Every row of the demo place. Pure, so the tests can read exactly what the pass writes. */
export function bookReviewDemoRows() {
  const hours = Object.fromEntries([0, 1, 2, 3, 4, 5, 6].map((d) => [String(d), [OPEN]]));
  const settings = {
    slotMinutes: 30,
    leadMinutes: 60,
    horizonDays: 30,
    cancelHours: 1,
    autoConfirm: true,
    onlineBooking: true,
    allowStaffChoice: true,
    bookingNote: 'Demo place for App Review: a test booking — nobody is expected and nothing is paid. · სადემონსტრაციო ადგილი: ჯავშანი სატესტოა.',
    notify: { sms: { enabled: false }, email: { newBooking: false, cancelled: false } },
  };
  const business = {
    id: BOOK_REVIEW_DEMO_ID,
    slug: BOOK_REVIEW_DEMO_SLUG,
    name: 'MEDICARD Demo Studio',
    nameKa: 'MEDICARD დემო სტუდია',
    category: 'SPA',
    tags: ['demo'],
    description: 'A demo place for trying MEDIBOOK — not a real business. Bookings made here are test bookings: nobody is expected and nothing is paid.',
    descriptionKa: 'სადემონსტრაციო ადგილი MEDIBOOK-ის გასაცნობად — ნამდვილი ბიზნესი არ არის. აქ გაკეთებული ჯავშნები სატესტოა: არავინ გელოდება და არაფერს იხდი.',
    address: 'Demo address, Tbilisi',
    addressKa: 'სადემონსტრაციო მისამართი, თბილისი',
    city: 'Tbilisi',
    lat: TBILISI_CENTER.lat,
    lng: TBILISI_CENTER.lng,
    hours,
    settings,
  };
  const staff = [
    { id: 'bks-app-review-demo-1', name: 'Ana', title: 'Demo', sortOrder: 0 },
    { id: 'bks-app-review-demo-2', name: 'Giorgi', title: 'Demo', sortOrder: 1 },
  ];
  // English names only (no nameKa): the app shows a service's Georgian name whenever one exists.
  const services = [
    { id: 'bksv-app-review-demo-1', name: 'Relaxing massage', durationMin: 30, sortOrder: 0 },
    { id: 'bksv-app-review-demo-2', name: 'Back massage', durationMin: 45, sortOrder: 1 },
    { id: 'bksv-app-review-demo-3', name: 'Face care', durationMin: 60, sortOrder: 2 },
  ];
  return { business, staff, services };
}

/** One pass. `dryRun` reports without writing. */
export async function ensureBookReviewDemo({ db = prisma, now = new Date(), env = process.env, dryRun = false, strip = dateStrip } = {}) {
  if (!bookReviewDemoOn(env)) return { skipped: 'off' };
  const [probe] = await db.$queryRaw`SELECT to_regclass('"BookBusiness"') IS NOT NULL AS ok`;
  if (!probe?.ok) return { skipped: 'table' };
  const [existing] = await db.$queryRaw`SELECT id, status FROM "BookBusiness" WHERE id = ${BOOK_REVIEW_DEMO_ID}`;
  if (existing?.status === 'HIDDEN') return { skipped: 'hidden' };
  const { business: b, staff, services } = bookReviewDemoRows();
  if (dryRun) return { dryRun: true, exists: Boolean(existing), status: existing?.status ?? null };

  const hours = JSON.stringify(b.hours);
  const settings = JSON.stringify(b.settings);
  let written = await db.$executeRaw`INSERT INTO "BookBusiness" (id, slug, name, "nameKa", category, tags, description, "descriptionKa", address, "addressKa", city, lat, lng, hours, source, "sourceRef", status, "claimedAt", settings)
    VALUES (${b.id}, ${b.slug}, ${b.name}, ${b.nameKa}, ${b.category}, ${JSON.stringify(b.tags)}::jsonb, ${b.description}, ${b.descriptionKa}, ${b.address}, ${b.addressKa}, ${b.city}, ${b.lat}, ${b.lng}, ${hours}::jsonb, 'ADMIN', 'app-review-demo', 'CLAIMED', ${now}, ${settings}::jsonb)
    ON CONFLICT (id) DO UPDATE SET status = 'CLAIMED', hours = EXCLUDED.hours, settings = EXCLUDED.settings, "updatedAt" = CURRENT_TIMESTAMP
    WHERE "BookBusiness".status <> 'HIDDEN' AND ("BookBusiness".status <> 'CLAIMED' OR "BookBusiness".hours <> EXCLUDED.hours OR "BookBusiness".settings <> EXCLUDED.settings)`;
  for (const s of services) {
    written += await db.$executeRaw`INSERT INTO "BookService" (id, "businessId", name, "durationMin", "bufferMin", online, active, "sortOrder")
      VALUES (${s.id}, ${b.id}, ${s.name}, ${s.durationMin}, 0, TRUE, TRUE, ${s.sortOrder})
      ON CONFLICT (id) DO UPDATE SET online = TRUE, active = TRUE, seats = 1, "updatedAt" = CURRENT_TIMESTAMP
      WHERE "BookService"."businessId" = ${b.id} AND (NOT "BookService".online OR NOT "BookService".active OR "BookService".seats <> 1)`;
  }
  // No own schedule and no service list = each person works the place's hours and performs every service.
  for (const p of staff) {
    written += await db.$executeRaw`INSERT INTO "BookStaff" (id, "businessId", name, title, "serviceIds", schedule, bookable, active, "sortOrder")
      VALUES (${p.id}, ${b.id}, ${p.name}, ${p.title}, '[]'::jsonb, '{}'::jsonb, TRUE, TRUE, ${p.sortOrder})
      ON CONFLICT (id) DO UPDATE SET bookable = TRUE, active = TRUE, "serviceIds" = '[]'::jsonb, schedule = '{}'::jsonb, "updatedAt" = CURRENT_TIMESTAMP
      WHERE "BookStaff"."businessId" = ${b.id} AND (NOT "BookStaff".bookable OR NOT "BookStaff".active OR "BookStaff"."serviceIds" <> '[]'::jsonb OR "BookStaff".schedule <> '{}'::jsonb)`;
  }
  const { days } = await strip({ businessId: b.id, serviceId: services[0].id, now, days: 7 }, db);
  const freeDays = days.filter((d) => d.count > 0).length;
  if (written) console.log(`[book] review demo place: ${existing ? 'repaired' : 'created'} (${written} row(s))`);
  if (freeDays < BOOK_REVIEW_DEMO_MIN_FREE_DAYS) console.warn(`[book] review demo place: only ${freeDays} of the next 7 days have free time`);
  return { created: !existing, written, freeDays };
}

export function startBookReviewDemo({ intervalMs = HOUR } = {}) {
  if (process.env.NODE_ENV === 'test' || !bookReviewDemoOn()) return null;
  const tick = () => withJobLease('book-review-demo', intervalMs * 1.5, () => ensureBookReviewDemo())
    .catch((e) => console.warn('[book] review demo pass failed', e?.message));
  const timer = setInterval(tick, intervalMs);
  timer.unref?.();
  setTimeout(tick, 2 * 60 * 1000).unref?.();
  return timer;
}
