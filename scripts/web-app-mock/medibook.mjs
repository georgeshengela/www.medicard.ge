// MEDIBOOK web QA fixture for scripts/web-app-dev.mjs --mock: the signed-in person is mocked (no real account,
// no DB writes); the public catalogue (/api/book/businesses, /map, /categories, live places) is proxied to the
// main API read-only. One mocked claimed, bookable business exercises the booking flow, the phone gate,
// cancel and review. Nothing here is written anywhere.
const LIVE = 'https://medicard.ge';
const MOCK_ID = 'bk-mock-claimed';
const MOCK_SLUG = 'nino-dental-studio-a1b2c3';

async function passthrough(req, url) {
  const r = await fetch(`${LIVE}${url.pathname}${url.search}`, { headers: { 'X-Medicard-Lang': req.headers['x-medicard-lang'] || 'ka', Accept: 'application/json' } });
  const text = await r.text();
  let body;
  try { body = JSON.parse(text); } catch { body = { error: text.slice(0, 200) }; }
  return { __status: r.status, body };
}

const state = { phoneVerified: false, favorites: new Set([MOCK_ID]), nextId: 10 };

const user = () => ({
  id: 'u-mock', fullName: 'გიორგი ტესტი', email: 'qa@example.com', phone: state.phoneVerified ? '+995555000111' : null, gender: 'MALE', points: 120, role: 'USER',
});
const me = () => ({
  user: user(),
  healthProfile: { completedAt: '2026-10-01T10:00:00Z', heightCm: 180, weightKg: 78, extraAnswers: { location: { enabled: true, cityKa: 'თბილისი', countryCode: 'GE', lat: 41.7245, lng: 44.7389 }, homeLayout: 'standard' } },
  stats: { activeMedications: 0, records: 0 },
  usage: null,
  checkIn: null,
});

const tbilisiIso = (ymd, hhmm) => new Date(`${ymd}T${hhmm}:00+04:00`).toISOString();
const pad = (n) => String(n).padStart(2, '0');
function tbilisiYmd(d = new Date()) { const x = new Date(d.getTime() + 4 * 3600_000); return `${x.getUTCFullYear()}-${pad(x.getUTCMonth() + 1)}-${pad(x.getUTCDate())}`; }
function addDays(ymd, n) { const [y, m, d] = ymd.split('-').map(Number); const x = new Date(Date.UTC(y, m - 1, d + n)); return `${x.getUTCFullYear()}-${pad(x.getUTCMonth() + 1)}-${pad(x.getUTCDate())}`; }
function weekday(ymd) { const [y, m, d] = ymd.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d)).getUTCDay(); }

const services = [
  { id: 'svc-1', group: 'ჰიგიენა', name: 'პროფესიული წმენდა', nameEn: 'Professional cleaning', description: 'ულტრაბგერა და პოლირება', durationMin: 45, bufferMin: 0, price: 120, priceTo: null, currency: 'GEL', online: true, active: true, sortOrder: 1 },
  { id: 'svc-2', group: 'ჰიგიენა', name: 'კონსულტაცია', nameEn: 'Consultation', description: null, durationMin: 30, bufferMin: 0, price: 40, priceTo: null, currency: 'GEL', online: true, active: true, sortOrder: 2 },
  { id: 'svc-3', group: 'მკურნალობა', name: 'პლომბი', nameEn: 'Filling', description: 'ფოტოპოლიმერი', durationMin: 60, bufferMin: 10, price: 150, priceTo: 250, currency: 'GEL', online: true, active: true, sortOrder: 3 },
  { id: 'svc-4', group: 'მკურნალობა', name: 'გათეთრება', nameEn: 'Whitening', description: null, durationMin: 90, bufferMin: 0, price: 450, priceTo: null, currency: 'GEL', online: false, active: true, sortOrder: 4 },
];
const staff = [
  { id: 'st-1', name: 'ნინო ბერიძე', title: 'სტომატოლოგი', imageUrl: null, color: '#0EA5E9', serviceIds: [], bookable: true },
  { id: 'st-2', name: 'გიორგი კაპანაძე', title: 'ჰიგიენისტი', imageUrl: null, color: '#F59E0B', serviceIds: ['svc-1', 'svc-2'], bookable: true },
];
const hours = { 0: [], 1: [{ from: '10:00', to: '19:00' }], 2: [{ from: '10:00', to: '19:00' }], 3: [{ from: '10:00', to: '19:00' }], 4: [{ from: '10:00', to: '19:00' }], 5: [{ from: '10:00', to: '19:00' }], 6: [{ from: '10:00', to: '15:00' }] };
const settings = { slotMinutes: 30, leadMinutes: 60, horizonDays: 30, cancelHours: 12, autoConfirm: true, onlineBooking: true, allowStaffChoice: true, bookingNote: 'პარკინგი ეზოშია — შესასვლელი ჭავჭავაძის მხრიდან.' };

const card = () => ({
  id: MOCK_ID, slug: MOCK_SLUG, name: 'ნინო დენტალ სტუდიო', category: 'DENTAL', categoryLabel: 'სტომატოლოგია', tags: ['სტომატოლოგი', 'ჰიგიენა'],
  address: 'ვაჟა-ფშაველას 29, თბილისი', city: 'თბილისი', district: 'საბურთალო', lat: 41.7245, lng: 44.7389, phone: '+995555123456',
  rating: 4.8, ratingCount: 23, claimed: true, bookable: true, coverUrl: null, logoUrl: null, openNow: true, closesAt: '19:00', opensAt: null, distanceKm: 0.4, fromPrice: 40, favorite: state.favorites.has(MOCK_ID),
});
const detail = () => ({
  ...card(),
  description: 'პატარა სტუდიო საბურთალოზე: პროფილაქტიკა, თერაპია და ესთეტიკური სტომატოლოგია. ვმუშაობთ თანამედროვე ანესთეზიით — ვიზიტი უმტკივნეულოა. პირველი კონსულტაცია 20 წუთია და ყველა კითხვას ვპასუხობთ. ბავშვებისთვის ცალკე კაბინეტი გვაქვს, მულტფილმებით და მშვიდი განათებით, რომ პირველი ვიზიტი სასიამოვნო დარჩეს.',
  email: null, website: 'https://example.com', instagram: 'ninodental', facebook: null,
  hours, gallery: [], settings, services, staff,
  discounts: [{ id: 'd1', title: 'დილის ფასდაკლება', kind: 'PERCENT', value: 15, serviceIds: [], startsOn: null, endsOn: '2026-11-30', weekdays: [1, 2, 3, 4, 5], hoursFrom: '10:00', hoursTo: '12:00', code: null }],
  reviews: [
    { id: 'r1', rating: 5, text: 'ძალიან ყურადღებიანი და უმტკივნეულო. ზუსტად დროზე მიმიღეს.', reply: 'მადლობა, მოგელით ისევ!', createdAt: '2026-10-01T10:00:00Z', author: 'მარიამ' },
    { id: 'r2', rating: 4, text: null, reply: null, createdAt: '2026-09-20T10:00:00Z', author: 'ლუკა' },
  ],
  status: 'CLAIMED',
});
const bizRef = () => { const c = card(); return { id: c.id, slug: c.slug, name: c.name, category: c.category, address: c.address, phone: c.phone, lat: c.lat, lng: c.lng, logoUrl: null, coverUrl: null }; };

const today = tbilisiYmd();
function appt(id, { serviceId, staffId, date, time, status, reviewed = false, cancelledBy = null, note = null, source = 'APP' }) {
  const svc = services.find((s) => s.id === serviceId);
  const st = staff.find((s) => s.id === staffId) || null;
  const startsAt = tbilisiIso(date, time);
  const endsAt = new Date(new Date(startsAt).getTime() + svc.durationMin * 60_000).toISOString();
  return {
    id, businessId: MOCK_ID, business: bizRef(), serviceId, serviceName: svc.name, staffId: st?.id ?? null, staffName: st?.name ?? null, staffColor: st?.color ?? null,
    clientName: 'გიორგი ტესტი', clientPhone: null, startsAt, endsAt, durationMin: svc.durationMin, status, source, price: svc.price, discountAmount: null, note,
    cancelledBy, cancelReason: null, reviewed, canCancelFree: new Date(startsAt).getTime() - Date.now() >= settings.cancelHours * 3600_000, cancelHours: settings.cancelHours, createdAt: new Date().toISOString(),
  };
}
const appointments = [
  appt('ap-1', { serviceId: 'svc-1', staffId: 'st-2', date: addDays(today, 1), time: '15:00', status: 'CONFIRMED' }),
  appt('ap-2', { serviceId: 'svc-3', staffId: 'st-1', date: addDays(today, 5), time: '11:30', status: 'PENDING', note: 'პირველი ვიზიტი' }),
  appt('ap-3', { serviceId: 'svc-2', staffId: 'st-1', date: addDays(today, -10), time: '12:00', status: 'COMPLETED' }),
  appt('ap-4', { serviceId: 'svc-1', staffId: 'st-2', date: addDays(today, -30), time: '10:30', status: 'CANCELLED', cancelledBy: 'CLIENT' }),
];
const OPEN = ['PENDING', 'CONFIRMED'];
function mine() {
  const now = Date.now();
  const refresh = (a) => ({ ...a, canCancelFree: OPEN.includes(a.status) && new Date(a.startsAt).getTime() - now >= settings.cancelHours * 3600_000 });
  const upcoming = appointments.filter((a) => OPEN.includes(a.status) && new Date(a.endsAt).getTime() >= now).sort((x, y) => x.startsAt.localeCompare(y.startsAt)).map(refresh);
  const past = appointments.filter((a) => !upcoming.some((u) => u.id === a.id)).sort((x, y) => y.startsAt.localeCompare(x.startsAt)).map(refresh);
  return { upcoming, past };
}

function slotsFor(date, serviceId, staffId) {
  const svc = services.find((s) => s.id === serviceId);
  if (!svc) return { __status: 404, body: { error: 'სერვისი ვერ მოიძებნა.', code: 'SERVICE_NOT_FOUND' } };
  const wd = weekday(date);
  const ahead = Math.round((Date.parse(`${date}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86400000);
  if (ahead < 0) return { date, serviceId, durationMin: svc.durationMin, slots: [], closed: true, reason: 'past' };
  if (ahead > settings.horizonDays) return { date, serviceId, durationMin: svc.durationMin, slots: [], closed: true, reason: 'horizon' };
  const ranges = hours[wd] || [];
  if (!ranges.length) return { date, serviceId, durationMin: svc.durationMin, slots: [], closed: true, reason: 'closed' };
  const people = staff.filter((p) => (!p.serviceIds.length || p.serviceIds.includes(serviceId)) && (!staffId || p.id === staffId));
  if (!people.length) return { date, serviceId, durationMin: svc.durationMin, slots: [], closed: true, reason: 'staff' };
  const slots = [];
  const earliest = Date.now() + settings.leadMinutes * 60_000;
  for (const r of ranges) {
    const [h0, m0] = r.from.split(':').map(Number);
    const [h1, m1] = r.to.split(':').map(Number);
    for (let min = h0 * 60 + m0; min + svc.durationMin <= h1 * 60 + m1; min += settings.slotMinutes) {
      const time = `${pad(Math.floor(min / 60))}:${pad(min % 60)}`;
      const startsAt = tbilisiIso(date, time);
      if (new Date(startsAt).getTime() < earliest) continue;
      // A few taken minutes so the grid looks real; already-booked mock appointments block their own time.
      if ((min / 30) % 5 === 2) continue;
      if (appointments.some((a) => OPEN.includes(a.status) && a.startsAt === startsAt)) continue;
      slots.push({ time, startsAt, staffIds: people.map((p) => p.id) });
    }
  }
  return { date, serviceId, durationMin: svc.durationMin, slots, closed: false };
}

export default {
  // ── session ──
  'GET /api/auth/me': () => me(),
  'GET /api/app/status': (req, _body, url) => passthrough(req, url),
  'GET /api/trainer/me': () => ({ trainerProfile: null }),
  'GET /api/visits': () => ({ visits: [{ id: 'v1', active: true, doctorType: 'DERM', doctorFirstName: 'ანა', doctorLastName: 'გელაშვილი', visitDate: addDays(today, 3), visitTime: '09:30', addressLabel: 'კოსტავას 12', reminderConfig: { enabled: true } }] }),
  'GET /api/account/app-state': () => ({ state: {} }),
  'POST /api/auth/phone/link/start': () => ({ ok: true, devCode: '1234' }),
  'POST /api/auth/phone/link/verify': (_req, body) => {
    if (String(body.code) !== '1234') return { __status: 400, body: { error: 'კოდი არასწორია.' } };
    state.phoneVerified = true;
    return { ok: true, user: user() };
  },

  // ── catalogue: live, except the mocked bookable business ──
  'GET /api/book/categories': (req, _b, url) => passthrough(req, url),
  'GET /api/book/map': (req, _b, url) => passthrough(req, url),
  'GET /api/book/image/:id': async (req, _b, url) => {
    const r = await fetch(`${LIVE}${url.pathname}`);
    return { __raw: { body: Buffer.from(await r.arrayBuffer()), contentType: r.headers.get('content-type') || 'image/jpeg' } };
  },
  'GET /api/book/businesses': async (req, _b, url) => {
    const live = await passthrough(req, url);
    const rows = Array.isArray(live.body?.businesses) ? live.body.businesses : [];
    const q = String(url.searchParams.get('q') || '').toLowerCase();
    const cat = url.searchParams.get('category');
    const include = (!cat || cat === 'DENTAL') && (!q || 'ნინო დენტალ სტუდიო dental'.includes(q));
    return { ...live.body, businesses: include ? [card(), ...rows] : rows };
  },
  'GET /api/book/businesses/:id': (req, _b, url) => (req.params.id === MOCK_ID || req.params.id === MOCK_SLUG ? { business: detail() } : passthrough(req, url)),
  'POST /api/book/businesses/:id/events': () => ({ ok: true }),
  'GET /api/book/businesses/:id/days': (req, _b, url) => {
    if (req.params.id !== MOCK_ID) return passthrough(req, url);
    const from = req.query.from || today;
    const n = Number(req.query.days) || 14;
    return { from, days: Array.from({ length: n }, (_, i) => { const date = addDays(from, i); const r = slotsFor(date, req.query.serviceId, req.query.staffId || null); return { date, count: r.slots?.length ?? 0, closed: Boolean(r.closed) }; }) };
  },
  'GET /api/book/businesses/:id/availability': (req, _b, url) => (req.params.id === MOCK_ID ? slotsFor(req.query.date, req.query.serviceId, req.query.staffId || null) : passthrough(req, url)),

  // ── the person's side ──
  'GET /api/book/appointments': () => mine(),
  'GET /api/book/appointments/:id': (req) => {
    const a = mine().upcoming.concat(mine().past).find((x) => x.id === req.params.id);
    return a ? { appointment: a } : { __status: 404, body: { error: 'ჯავშანი ვერ მოიძებნა.', code: 'APPOINTMENT_NOT_FOUND' } };
  },
  'POST /api/book/appointments': (req, body) => {
    if (!state.phoneVerified) return { __status: 403, body: { error: 'ჯავშნისთვის ტელეფონის ნომერი საჭიროა — ბიზნესი ასე დაგიკავშირდება.', code: 'PHONE_VERIFICATION_REQUIRED' } };
    const svc = services.find((s) => s.id === body.serviceId);
    if (!svc) return { __status: 404, body: { error: 'სერვისი ვერ მოიძებნა.', code: 'SERVICE_NOT_FOUND' } };
    if (appointments.some((a) => OPEN.includes(a.status) && a.startsAt === body.startsAt)) return { __status: 409, body: { error: 'ეს დრო უკვე დაკავებულია ან აღარ არის თავისუფალი. აირჩიე სხვა დრო.', code: 'SLOT_TAKEN' } };
    const id = `ap-${state.nextId++}`;
    const d = new Date(body.startsAt);
    const x = new Date(d.getTime() + 4 * 3600_000);
    const row = appt(id, { serviceId: body.serviceId, staffId: body.staffId || null, date: `${x.getUTCFullYear()}-${pad(x.getUTCMonth() + 1)}-${pad(x.getUTCDate())}`, time: `${pad(x.getUTCHours())}:${pad(x.getUTCMinutes())}`, status: settings.autoConfirm ? 'CONFIRMED' : 'PENDING', note: body.note || null, source: req.headers['x-medicard-platform'] === 'web' ? 'WEB' : 'APP' });
    appointments.push(row);
    return { __status: 201, body: { appointment: row } };
  },
  'POST /api/book/appointments/:id/cancel': (req) => {
    const a = appointments.find((x) => x.id === req.params.id);
    if (!a) return { __status: 404, body: { error: 'ჯავშანი ვერ მოიძებნა.', code: 'APPOINTMENT_NOT_FOUND' } };
    if (!OPEN.includes(a.status)) return { __status: 409, body: { error: 'ეს ჯავშანი უკვე დასრულებული ან გაუქმებულია.', code: 'NOT_OPEN' } };
    const late = !a.canCancelFree;
    Object.assign(a, { status: 'CANCELLED', cancelledBy: 'CLIENT', canCancelFree: false });
    return { appointment: a, late };
  },
  'POST /api/book/appointments/:id/review': (req, body) => {
    const a = appointments.find((x) => x.id === req.params.id);
    if (!a) return { __status: 404, body: { error: 'ჯავშანი ვერ მოიძებნა.', code: 'APPOINTMENT_NOT_FOUND' } };
    if (!(body.rating >= 1 && body.rating <= 5)) return { __status: 400, body: { error: 'შეფასება 1-დან 5-მდეა.', code: 'BAD_RATING' } };
    a.reviewed = true;
    return { appointment: a };
  },
  'GET /api/book/favorites': async (req, _b, url) => {
    const live = await passthrough(req, new URL(`/api/book/businesses?lat=${url.searchParams.get('lat') || 41.7151}&lng=${url.searchParams.get('lng') || 44.8271}&radiusKm=3&limit=2`, LIVE));
    const rows = Array.isArray(live.body?.businesses) ? live.body.businesses : [];
    return { businesses: [...(state.favorites.has(MOCK_ID) ? [card()] : []), ...rows.filter((b) => state.favorites.has(b.id))] };
  },
  'PUT /api/book/favorites/:businessId': (req) => { state.favorites.add(req.params.businessId); return { favorite: true }; },
  'DELETE /api/book/favorites/:businessId': (req) => { state.favorites.delete(req.params.businessId); return { favorite: false }; },
};
