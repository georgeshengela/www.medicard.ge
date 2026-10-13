import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/error.js';
import { t } from '../lib/i18n.js';
import { bindAiLanguage, currentAiLanguage, requireAiConsent } from '../lib/aiConsent.js';
import { runTrackedAi } from '../lib/aiTelemetry.js';
import { enforceAiQuota } from '../middleware/aiLimiter.js';
import { chineseZodiac, lifePath, personalDay, civilDate } from '../lib/horoscope/astro.js';
import { TZ } from '../lib/horoscope/generate.js';
import { DREAMS, tarotSpread } from '../lib/horoscope/catalog.js';
import {
  birthOf, chartFor, signFor, signReadings, skyView, moonCalendar, personalDayView, chartView, tarotView, tarotCards,
  numbersView, chineseView, compatView, signProfileView, isSign,
} from '../lib/horoscope/view.js';
import {
  readConfig, readProfile, saveProfile, recordVisit, searchDreams, dreamLetters, libraryEntries,
} from '../lib/horoscope/store.js';
import { searchPlaces } from '../lib/horoscope/places.js';
import {
  askOracle, buildOracleMessages, cardsWanted, drawCards, personChartText, todaySkyText,
} from '../lib/horoscope/oracle.js';

/**
 * MEDIHOROSCOPE API (/api/horoscope, requireFeature('horoscope') in server.js). Readings and the library are
 * the same for everyone; the chart, tarot of the day and numbers come from the signed-in person's birth date
 * (profile) and the optional birth time/place kept here. The Oracle chat goes through the AI-consent path.
 */
export const horoscopeRouter = Router();
const r = horoscopeRouter;

r.use(requireAuth, (_req, res, next) => {
  res.set('Cache-Control', 'private, no-store');
  next();
});

const lang = (req) => (req.lang === 'en' ? 'en' : 'ka');
const today = () => civilDate(new Date(), TZ);

async function person(req) {
  const [user, profile, config] = await Promise.all([
    prisma.user.findUnique({ where: { id: req.user.id }, select: { birthDate: true, fullName: true } }),
    readProfile(req.user.id),
    readConfig(),
  ]);
  const birth = birthOf(user, profile);
  return { user, profile, config, birth, chart: chartFor(birth), sign: signFor(birth) };
}

const oracleName = (config) => ({ ka: config.oracleNameKa || 'ორაკული', en: config.oracleNameEn || 'Oracle' });

const profileView = (profile) => ({
  birthTime: profile?.birthTime || null,
  placeName: profile?.placeName || null,
  placeDetail: profile?.placeDetail || null,
  hasPlace: Number.isFinite(profile?.lat),
  showOnHome: profile ? profile.showOnHome !== false : true,
});

// ── Hub ────────────────────────────────────────────────────────────────

r.get('/', asyncHandler(async (req, res) => {
  const p = await person(req);
  const l = lang(req);
  const viewSign = isSign(String(req.query.sign || '')) ? String(req.query.sign) : p.sign?.key || null;
  const birthDate = p.birth?.date || null;
  const [readings, personal, tarot, numbers, chinese] = await Promise.all([
    viewSign ? signReadings(viewSign, l) : null,
    personalDayView(p.chart, l),
    tarotView(req.user.id, l),
    numbersView(birthDate, l),
    chineseView(birthDate, l),
  ]);
  const sky = skyView();
  const moonText = (await libraryEntries([`moon_phase:${sky.moon.key}`], l))[`moon_phase:${sky.moon.key}`]?.text || null;
  recordVisit(req.user.id, today(), 'hub');
  res.json({
    today: sky.today,
    sign: p.sign ? { ...p.sign, viewing: viewSign } : null,
    viewing: viewSign,
    needBirthDate: !birthDate,
    readings,
    sky: { ...sky, moon: { ...sky.moon, text: moonText } },
    personal: p.chart ? { timeKnown: p.chart.timeKnown, hasPlace: Number.isFinite(p.birth?.lat), transits: personal } : null,
    profile: profileView(p.profile),
    tarot,
    numbers,
    chinese: chinese ? { animal: chinese.animal, element: chinese.element, year: chinese.year, headline: chinese.yearForecast?.headline || null } : null,
    oracle: { enabled: p.config.oracleEnabled !== false, name: oracleName(p.config)[l] },
    homeCard: p.config.homeCard !== false,
    ready: Boolean(readings?.today),
  });
}));

/** Home card: the sign, today's headline + scores, the moon. Small and cached by the app. */
r.get('/home', asyncHandler(async (req, res) => {
  const p = await person(req);
  if (!p.sign || p.config.homeCard === false || p.profile?.showOnHome === false) return res.json({ show: false });
  const readings = await signReadings(p.sign.key, lang(req));
  const sky = skyView(new Date(), 1);
  res.json({
    show: Boolean(readings.today),
    sign: p.sign.key,
    headline: readings.today?.headline || null,
    scores: readings.today?.scores || null,
    moon: { key: sky.moon.key, angle: sky.moon.angle, sign: sky.moon.sign },
  });
}));

r.get('/sign/:sign', asyncHandler(async (req, res) => {
  const sign = String(req.params.sign);
  if (!isSign(sign)) return res.status(404).json({ error: t(req, 'ნიშანი ვერ მოიძებნა.', 'Sign not found.') });
  const l = lang(req);
  const [profile, readings] = await Promise.all([signProfileView(sign, l), signReadings(sign, l)]);
  recordVisit(req.user.id, today(), 'sign');
  res.json({ profile, readings });
}));

// ── Chart + birth details ───────────────────────────────────────────────

r.get('/chart', asyncHandler(async (req, res) => {
  const p = await person(req);
  if (!p.birth) return res.json({ needBirthDate: true, profile: profileView(p.profile) });
  recordVisit(req.user.id, today(), 'chart');
  res.json({ chart: await chartView(p.chart, p.birth, lang(req)), sign: p.sign, profile: profileView(p.profile) });
}));

const profileInput = z.object({
  birthTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).nullable().optional(),
  place: z.object({
    name: z.string().trim().min(1).max(120),
    detail: z.string().trim().max(160).optional().nullable(),
    lat: z.number().min(-90).max(90),
    lon: z.number().min(-180).max(180),
    tz: z.string().min(3).max(64),
  }).nullable().optional(),
  showOnHome: z.boolean().optional(),
});

r.put('/profile', asyncHandler(async (req, res) => {
  const input = profileInput.parse(req.body || {});
  if (input.place) {
    try { new Intl.DateTimeFormat('en', { timeZone: input.place.tz }); } catch {
      return res.status(400).json({ error: t(req, 'ადგილის დროის სარტყელი ვერ ამოვიცანი.', 'The place time zone is not valid.'), code: 'HOROSCOPE_BAD_TZ' });
    }
  }
  const current = await readProfile(req.user.id);
  const keepPlace = input.place === undefined;
  const saved = await saveProfile(req.user.id, {
    birthTime: input.birthTime === undefined ? current?.birthTime ?? null : input.birthTime,
    placeName: keepPlace ? current?.placeName ?? null : input.place?.name ?? null,
    placeDetail: keepPlace ? current?.placeDetail ?? null : input.place?.detail ?? null,
    lat: keepPlace ? current?.lat ?? null : input.place?.lat ?? null,
    lon: keepPlace ? current?.lon ?? null : input.place?.lon ?? null,
    tz: keepPlace ? current?.tz ?? null : input.place?.tz ?? null,
    showOnHome: input.showOnHome ?? (current ? current.showOnHome : true),
  });
  res.json({ profile: profileView(saved) });
}));

r.get('/places', asyncHandler(async (req, res) => {
  const q = String(req.query.q || '').trim().slice(0, 80);
  if (q.length < 2) return res.json({ places: [] });
  res.json({ places: await searchPlaces(q, lang(req)) });
}));

// ── Sky, compatibility, numbers, Chinese, tarot, dreams ─────────────────

r.get('/sky', asyncHandler(async (req, res) => {
  const month = /^\d{4}-(0[1-9]|1[0-2])$/.test(String(req.query.month || '')) ? String(req.query.month) : today().slice(0, 7);
  const l = lang(req);
  const sky = skyView(new Date(), 120);
  const retroKeys = sky.retrograde.map((k) => `retro:${k}`);
  const lib = await libraryEntries([...retroKeys, `moon_phase:${sky.moon.key}`], l);
  recordVisit(req.user.id, today(), 'sky');
  res.json({
    ...sky,
    moon: { ...sky.moon, text: lib[`moon_phase:${sky.moon.key}`]?.text || null },
    retroTexts: Object.fromEntries(sky.retrograde.map((k) => [k, lib[`retro:${k}`]?.text || null])),
    calendar: { month, days: moonCalendar(month) },
  });
}));

r.get('/compat', asyncHandler(async (req, res) => {
  const a = String(req.query.a || '');
  const b = String(req.query.b || '');
  if (!isSign(a) || !isSign(b)) return res.status(400).json({ error: t(req, 'აირჩიე ორი ნიშანი.', 'Choose two signs.') });
  recordVisit(req.user.id, today(), 'compat');
  res.json(await compatView(a, b, lang(req)));
}));

r.get('/numerology', asyncHandler(async (req, res) => {
  const p = await person(req);
  if (!p.birth) return res.json({ needBirthDate: true });
  recordVisit(req.user.id, today(), 'numerology');
  res.json(await numbersView(p.birth.date, lang(req)));
}));

r.get('/chinese', asyncHandler(async (req, res) => {
  const p = await person(req);
  if (!p.birth) return res.json({ needBirthDate: true });
  recordVisit(req.user.id, today(), 'chinese');
  res.json(await chineseView(p.birth.date, lang(req)));
}));

r.get('/tarot', asyncHandler(async (req, res) => {
  const l = lang(req);
  const day = today();
  const spread = tarotSpread(req.user.id, day).map((c) => c.id);
  const [card, cards] = await Promise.all([tarotView(req.user.id, l), tarotCards(spread, l)]);
  recordVisit(req.user.id, day, 'tarot');
  res.json({ date: day, card, spread: cards });
}));

r.get('/dreams', asyncHandler(async (req, res) => {
  const l = lang(req);
  const q = String(req.query.q || '').trim().slice(0, 60);
  recordVisit(req.user.id, today(), 'dreams');
  if (!q) {
    const rows = await dreamLetters(l);
    const ready = new Map(rows.map((row) => [row.key.slice(6), row.word]));
    return res.json({ symbols: DREAMS.map((d) => ({ id: d.id, word: ready.get(d.id) || d[l], ready: ready.has(d.id) })) });
  }
  const rows = await searchDreams(q, l);
  res.json({ results: rows.map((row) => ({ id: row.key.slice(6), ...row.data })) });
}));

r.get('/dreams/:id', asyncHandler(async (req, res) => {
  const d = DREAMS.find((x) => x.id === String(req.params.id));
  if (!d) return res.status(404).json({ error: t(req, 'სიმბოლო ვერ მოიძებნა.', 'Symbol not found.') });
  const l = lang(req);
  const lib = await libraryEntries([`dream:${d.id}`], l);
  res.json({ id: d.id, word: d[l], ...(lib[`dream:${d.id}`] || {}) });
}));

// ── Oracle chat ────────────────────────────────────────────────────────

const ID_RE = /^[0-9a-f-]{36}$/i;
const oracleQuery = z.object({
  message: z.string().trim().min(1).max(2000),
  sessionId: z.string().regex(ID_RE).optional(),
  clientRequestId: z.string().regex(/^[\w-]{6,64}$/),
  stream: z.boolean().optional(),
});

const publicMessage = (row) => ({ id: row.id, role: row.role, content: row.content, status: row.status, cards: row.cards || null, createdAt: row.createdAt });

r.get('/oracle', asyncHandler(async (req, res) => {
  const config = await readConfig();
  const sessions = await prisma.$queryRaw`SELECT "id", "title", "updatedAt" FROM "HoroscopeChatSession"
    WHERE "userId" = ${req.user.id} ORDER BY "updatedAt" DESC LIMIT 30`.catch(() => []);
  const id = ID_RE.test(String(req.query.session || '')) ? String(req.query.session) : sessions[0]?.id || null;
  const messages = id
    ? await prisma.$queryRaw`SELECT * FROM "HoroscopeChatMessage" WHERE "sessionId" = ${id} AND "userId" = ${req.user.id} ORDER BY "createdAt" ASC`.catch(() => [])
    : [];
  recordVisit(req.user.id, today(), 'oracle');
  res.json({ enabled: config.oracleEnabled !== false, name: oracleName(config)[lang(req)], sessionId: id, sessions, messages: messages.map(publicMessage) });
}));

r.delete('/oracle/:sessionId', asyncHandler(async (req, res) => {
  await prisma.$executeRaw`DELETE FROM "HoroscopeChatSession" WHERE "id" = ${String(req.params.sessionId)} AND "userId" = ${req.user.id}`;
  res.json({ ok: true });
}));

function writeSse(res, payload) {
  res.write(`data: ${JSON.stringify(payload)}\n\n`);
  if (typeof res.flush === 'function') res.flush();
}

r.post('/oracle/query', bindAiLanguage, requireAiConsent, enforceAiQuota, asyncHandler(async (req, res) => {
  let input;
  try {
    input = oracleQuery.parse(req.body || {});
  } catch {
    await req.releaseAiCredit?.();
    return res.status(400).json({ error: t(req, 'შეტყობინება ცარიელია ან ძალიან გრძელია.', 'The message is empty or too long.'), code: 'INVALID_INPUT' });
  }
  const p = await person(req);
  if (p.config.oracleEnabled === false) {
    await req.releaseAiCredit?.();
    return res.status(503).json({ error: t(req, 'ორაკული დროებით დუმს.', 'The Oracle is resting for now.'), code: 'ORACLE_OFF' });
  }
  const [{ n: usedToday } = { n: 0 }] = await prisma.$queryRaw`SELECT COUNT(*)::int AS n FROM "HoroscopeChatMessage"
    WHERE "userId" = ${req.user.id} AND "role" = 'user' AND "createdAt" > NOW() - INTERVAL '24 hours'`;
  if (usedToday >= (Number(p.config.oracleDailyLimit) || 30)) {
    await req.releaseAiCredit?.();
    return res.status(429).json({ error: t(req, 'ვარსკვლავები დღეისთვის დაიღალნენ — ხვალ ისევ გელოდები.', 'The stars are tired for today — come back tomorrow.'), code: 'ORACLE_DAILY_LIMIT' });
  }

  let session = null;
  if (input.sessionId) {
    [session] = await prisma.$queryRaw`SELECT * FROM "HoroscopeChatSession" WHERE "id" = ${input.sessionId} AND "userId" = ${req.user.id}`;
    if (!session) { await req.releaseAiCredit?.(); return res.status(404).json({ error: t(req, 'საუბარი ვერ მოიძებნა.', 'Conversation not found.') }); }
    const [replayed] = await prisma.$queryRaw`SELECT * FROM "HoroscopeChatMessage" WHERE "sessionId" = ${session.id} AND "clientRequestId" = ${input.clientRequestId}`;
    if (replayed) {
      const [answer] = await prisma.$queryRaw`SELECT * FROM "HoroscopeChatMessage" WHERE "sessionId" = ${session.id} AND "role" = 'assistant' AND "createdAt" > ${replayed.createdAt} ORDER BY "createdAt" ASC LIMIT 1`;
      await req.releaseAiCredit?.();
      return res.json({ replayed: true, sessionId: session.id, answer: answer ? publicMessage(answer) : null });
    }
  } else {
    const title = input.message.replace(/\s+/g, ' ').trim();
    [session] = await prisma.$queryRaw`INSERT INTO "HoroscopeChatSession" ("id", "userId", "title")
      VALUES (${randomUUID()}, ${req.user.id}, ${title.length > 48 ? `${title.slice(0, 47)}…` : title}) RETURNING *`;
  }

  const history = await prisma.$queryRaw`SELECT "role", "content", "status" FROM "HoroscopeChatMessage" WHERE "sessionId" = ${session.id} ORDER BY "createdAt" ASC`;
  const now = new Date();
  const count = cardsWanted(input.message);
  const cards = count ? drawCards(count) : null;
  await prisma.$executeRaw`INSERT INTO "HoroscopeChatMessage" ("id", "sessionId", "userId", "role", "content", "status", "clientRequestId", "createdAt")
    VALUES (${randomUUID()}, ${session.id}, ${req.user.id}, 'user', ${input.message}, 'COMPLETE', ${input.clientRequestId}, ${now})`;
  const assistantId = randomUUID();
  await prisma.$executeRaw`INSERT INTO "HoroscopeChatMessage" ("id", "sessionId", "userId", "role", "content", "status", "cards", "createdAt")
    VALUES (${assistantId}, ${session.id}, ${req.user.id}, 'assistant', '', 'PENDING', ${cards ? JSON.stringify(cards) : null}::jsonb, ${new Date(now.getTime() + 1)})`;

  const l = currentAiLanguage() === 'en' ? 'en' : 'ka';
  const sky = skyView(now, 40);
  const reading = p.sign ? (await signReadings(p.sign.key, l)).today : null;
  const birthDate = p.birth?.date || null;
  const chartText = personChartText({
    firstName: String(p.user?.fullName || '').trim().split(/\s+/)[0] || null,
    sign: p.sign,
    chart: p.chart,
    chinese: birthDate ? chineseZodiac(birthDate) : null,
    numbers: birthDate ? { lifePath: lifePath(birthDate), personalDay: personalDay(birthDate, sky.today) } : null,
    transits: p.chart ? (await personalDayView(p.chart, l)) : null,
  });
  const messages = buildOracleMessages({
    name: oracleName(p.config), chartText, skyText: todaySkyText({ today: sky.today, sky, reading }), cards, history, userMessage: input.message,
  });

  const stream = input.stream === true || String(req.headers.accept || '').includes('text/event-stream');
  const abort = new AbortController();
  const run = (onDelta) => runTrackedAi({
    userId: req.user.id,
    mode: 'HOROSCOPE',
    chatSessionId: session.id,
    userPrompt: input.message,
    cancelled: () => abort.signal.aborted,
    fn: () => askOracle({ messages, onDelta, signal: abort.signal }),
  });
  const finish = async (answer) => {
    await prisma.$executeRaw`UPDATE "HoroscopeChatMessage" SET "content" = ${answer.content}, "status" = 'COMPLETE' WHERE "id" = ${assistantId}`;
    await prisma.$executeRaw`UPDATE "HoroscopeChatSession" SET "updatedAt" = NOW() WHERE "id" = ${session.id}`;
    await req.consumeAiCredit?.();
  };
  const failed = async () => {
    await prisma.$executeRaw`UPDATE "HoroscopeChatMessage" SET "status" = 'ERROR' WHERE "id" = ${assistantId}`.catch(() => undefined);
    await req.releaseAiCredit?.();
  };

  if (!stream) {
    try {
      const answer = await run(undefined);
      await finish(answer);
      return res.json({ sessionId: session.id, answer: { id: assistantId, role: 'assistant', content: answer.content, status: 'COMPLETE', cards } });
    } catch (error) {
      await failed();
      return res.status(error?.status && error.status < 600 ? error.status : 502).json({ error: t(req, error?.message || 'ორაკულმა ვერ გიპასუხა.', error?.messageEn || 'The Oracle could not answer.'), code: 'AI_FAILED' });
    }
  }

  req.setTimeout(0);
  res.setTimeout(0);
  res.status(200);
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  if (req.socket) req.socket.setNoDelay(true);
  if (typeof res.flushHeaders === 'function') res.flushHeaders();
  res.on('close', () => { if (!res.writableEnded) abort.abort(); });
  writeSse(res, { type: 'start', sessionId: session.id, messageId: assistantId, cards });
  try {
    const answer = await run((delta) => writeSse(res, { type: 'delta', text: delta }));
    await finish(answer);
    writeSse(res, { type: 'done', sessionId: session.id, answer: { id: assistantId, role: 'assistant', content: answer.content, status: 'COMPLETE', cards } });
  } catch (error) {
    await failed();
    writeSse(res, { type: 'error', error: t(req, error?.message || 'ორაკულმა ვერ გიპასუხა.', error?.messageEn || 'The Oracle could not answer.') });
  }
  res.end();
}));
