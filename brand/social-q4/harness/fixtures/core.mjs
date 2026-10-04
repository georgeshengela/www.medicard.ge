// Core session: user, health profile, app status, AI consent, small boot-time endpoints.
// Shapes copied from server/src/lib/patient.js (publicUser / publicHealthProfile),
// server/src/routes/auth.routes.js (GET /api/auth/me), health-profile.routes.js,
// app.routes.js (GET /api/app/status) and server/src/lib/aiConsent.js.
import { readFileSync } from 'node:fs';
import { addDays, isoAt, tbilisiToday } from '../lib.mjs';

const REPO = 'C:/Users/User/Desktop/www.medicard';

let AI_DISCLOSURE = null;
try {
  AI_DISCLOSURE = JSON.parse(readFileSync(`${REPO}/mobile/src/config/aiDisclosure.json`, 'utf8'));
} catch {
  AI_DISCLOSURE = {
    title: 'AI დამუშავება',
    purpose: 'Medi-ს პასუხები',
    categories: ['კითხვა'],
    recipients: [{ name: 'OpenRouter', role: 'AI', url: 'https://openrouter.ai' }],
    privacyUrl: 'https://medicard.ge/privacy',
    retention: '-',
    choice: '-',
  };
}
const AI_CONSENT_VERSION = '2026-09-25.1';

/** Every key of server/src/lib/featureFlags.js FEATURES — all on. */
const FEATURE_KEYS = [
  'medications', 'visits', 'records', 'labs', 'hydration', 'steps', 'weight', 'cycle', 'nutrition', 'nutritionAi',
  'medi', 'mediDoctor', 'mediDeep', 'symptoms', 'imaging', 'skin', 'voice', 'pets', 'mediVet', 'medirun',
  'medirunAutopilot', 'quest', 'rewardsStore', 'coach', 'community', 'pharmacy', 'news', 'homeLayouts', 'weather',
  'weeklyReport', 'healthPassport', 'invites', 'referralRewards', 'email',
];

const FREE_PACKAGE = {
  id: 'medicard-free-access', code: 'FREE', nameKa: 'უფასო წვდომა', nameEn: 'Free access',
  descriptionKa: 'ყველა ფუნქცია უფასოდ, კომერციული გამოყენების ლიმიტის გარეშე.',
  monthlyAiLimit: -1, dailyAiLimit: -1, unlimited: true, priceGel: 0, billingPeriod: 'monthly',
  active: true, sortOrder: 0,
  features: { doctorChat: true, consilium: true, labAnalysis: true, imaging: true, skin: true, skincare: true, medicationReview: true },
};

function ageFrom(birthDate, today) {
  const [y, m, d] = birthDate.split('-').map(Number);
  const [ty, tm, td] = today.split('-').map(Number);
  let age = ty - y;
  if (tm < m || (tm === m && td < d)) age -= 1;
  return age;
}

function personaUser(persona, today) {
  const women = persona !== 'man';
  const birthDate = women ? '1994-05-14' : '1989-11-02';
  return {
    id: women ? 'mock-user-women-0001' : 'mock-user-man-0001',
    email: women ? 'nino.qa@example.test' : 'giorgi.qa@example.test',
    fullName: women ? 'ნინო ბერიძე' : 'გიორგი მაისურაძე',
    phone: women ? '+995555123456' : '+995599654321',
    gender: women ? 'FEMALE' : 'MALE',
    birthDate,
    age: ageFrom(birthDate, today),
    status: 'ACTIVE',
    package: FREE_PACKAGE,
    packageStartedAt: null,
    packageExpiresAt: null,
    createdAt: isoAt(addDays(today, -96), '10:12'),
    points: 1240,
    currentStreak: 3,
    longestStreak: 19,
    lastCheckInDate: today,
    aiEngine: 'evidencemd',
  };
}

function personaProfile(persona, today, { layout, onboarding }) {
  const women = persona !== 'man';
  const heightCm = women ? 168 : 182;
  const weightKg = 92.4;
  const extraAnswers = {
    onboardingVersion: 2,
    confirmedSteps: ['sex', 'primary-goal', 'birth-date', 'body', 'goal'],
    primaryGoal: women ? 'cycle' : 'nutrition',
    weightUnit: 'kg',
    heightUnit: 'cm',
    avatarId: women ? 'avatar-4' : 'avatar-5',
    assessmentPhaseComplete: true,
    privacyAccepted: true,
    aiPrivacyPrompted: true,
    notificationsEnabled: true,
    phoneVerified: true,
    onboardingComplete: true,
  };
  if (layout) {
    extraAnswers.homeLayout = layout;
    extraAnswers.homeLayoutOfferDone = true;
  }
  if (onboarding === 'tail') {
    delete extraAnswers.onboardingComplete;
    delete extraAnswers.homeLayout;
    delete extraAnswers.homeLayoutOfferDone;
  }
  return {
    heightCm,
    weightKg,
    bloodType: women ? 'A+' : 'O+',
    activityLevel: 'MODERATE',
    exerciseFrequency: 'WEEKLY',
    sleepQuality: 'GOOD',
    sleepHours: 7,
    stressLevel: 'MODERATE',
    smokingStatus: 'NEVER',
    alcoholUse: 'OCCASIONAL',
    dietType: 'OMNIVORE',
    waterIntakeL: 2.5,
    restingHeartRate: 68,
    bloodPressureSystolic: 122,
    bloodPressureDiastolic: 78,
    chronicConditions: [],
    allergies: women ? ['მტვრის ტკიპა'] : [],
    medications: ['ვიტამინი D3', 'მაგნიუმი B6'],
    familyHistory: [],
    healthGoals: ['წონის კლება', 'მეტი მოძრაობა'],
    extraAnswers,
    currentStepIndex: 5,
    completedAt: onboarding === 'tail' ? null : isoAt(addDays(today, -96), '10:30'),
    bmi: Math.round((weightKg / (heightCm / 100) ** 2) * 10) / 10,
  };
}

export function init(state, ctx) {
  state.user = personaUser(ctx.persona, ctx.today);
  state.healthProfile = personaProfile(ctx.persona, ctx.today, ctx);
  state.aiConsent = { decision: 'accepted', updatedAt: isoAt(addDays(ctx.today, -90), '10:31') };
  state.funnelEvents = [];
  state.clientErrors = [];
}

function bmiOf(p) {
  return p.heightCm && p.weightKg ? Math.round((p.weightKg / (p.heightCm / 100) ** 2) * 10) / 10 : null;
}

function usage(today) {
  // freeConsumerUsage({...}) from mobile/src/lib/consumerAccess.js over getUsage's calendar shape.
  return {
    date: today,
    periodKey: today.slice(0, 7),
    periodType: 'calendar',
    periodLabel: 'ეს თვე',
    periodStart: null,
    periodEnd: null,
    billingPeriod: 'monthly',
    used: 0,
    limit: -1,
    remaining: -1,
    exceeded: false,
    unlimited: true,
    resetsInMs: 0,
    resetAt: null,
    resetKind: null,
    refilled: false,
    refilledKey: null,
  };
}

function checkInState(state, today) {
  const week = [];
  for (let i = 6; i >= 0; i -= 1) {
    const date = addDays(today, -i);
    week.push({ date, status: i <= 2 ? 'completed' : i === 4 ? 'skipped' : 'completed' });
  }
  return {
    points: state.user.points,
    currentStreak: state.user.currentStreak,
    longestStreak: state.user.longestStreak,
    lastCheckInDate: today,
    weekStreak: 3,
    claimedToday: true,
    today,
    pointsPerDay: 10,
    week,
  };
}

function aiConsent(state) {
  const accepted = state.aiConsent.decision === 'accepted';
  return {
    version: AI_CONSENT_VERSION,
    manifest: AI_DISCLOSURE,
    accepted,
    decision: state.aiConsent.decision,
    updatedAt: state.aiConsent.updatedAt,
  };
}

const ok = () => ({ ok: true });

export const routes = [
  {
    method: 'GET',
    path: '/api/auth/me',
    handler: (rq) => {
      if (!/^Bearer\s+\S{8,}/.test(rq.auth)) return rq.reply(401, { error: 'გთხოვ, შეხვიდე ანგარიშში.' });
      return {
        user: rq.state.user,
        usage: usage(rq.today),
        stats: { records: 0, chats: 5, activeMedications: 2 },
        healthProfile: rq.state.healthProfile,
        checkIn: checkInState(rq.state, rq.today),
        checkInAwarded: false,
        pointsAwarded: 0,
      };
    },
  },
  {
    method: 'PATCH',
    path: '/api/auth/me',
    handler: (rq) => {
      const b = rq.body || {};
      for (const k of ['fullName', 'gender', 'birthDate', 'aiEngine']) if (b[k] !== undefined) rq.state.user[k] = b[k];
      return { user: rq.state.user };
    },
  },
  { method: 'GET', path: '/api/usage', handler: (rq) => ({ ...usage(rq.today), label: 'ულიმიტო' }) },
  { method: 'GET', path: '/api/check-in', handler: (rq) => ({ checkIn: checkInState(rq.state, rq.today) }) },
  {
    method: 'POST',
    path: '/api/check-in/claim',
    handler: (rq) => ({ awarded: false, pointsAwarded: 0, user: rq.state.user, checkIn: checkInState(rq.state, rq.today) }),
  },
  { method: 'GET', path: '/api/health-profile', handler: (rq) => ({ profile: rq.state.healthProfile }) },
  {
    method: 'PUT',
    path: '/api/health-profile',
    handler: (rq) => {
      const data = { ...(rq.body || {}) };
      const { gender, birthDate, ...fields } = data;
      if (gender !== undefined) rq.state.user.gender = gender;
      if (birthDate !== undefined) rq.state.user.birthDate = birthDate;
      const profile = rq.state.healthProfile;
      if (fields.extraAnswers && typeof fields.extraAnswers === 'object') {
        // Real server: shallow merge, `appState` is dropped (it has its own endpoint).
        const { appState: _ignored, labPanels: _lp, ...extra } = fields.extraAnswers;
        fields.extraAnswers = { ...(profile.extraAnswers || {}), ...extra };
        // JSON storage drops undefined keys.
        fields.extraAnswers = JSON.parse(JSON.stringify(fields.extraAnswers));
      }
      for (const [k, v] of Object.entries(fields)) if (k in profile && v !== undefined) profile[k] = v;
      profile.bmi = bmiOf(profile);
      console.log(`PROFILE PUT extraAnswers.homeLayout=${profile.extraAnswers?.homeLayout ?? '-'} offerDone=${profile.extraAnswers?.homeLayoutOfferDone ?? '-'}`);
      return { profile, user: rq.state.user };
    },
  },
  {
    method: 'POST',
    path: '/api/health-profile/complete',
    handler: (rq) => {
      const b = rq.body || {};
      if (b.gender) rq.state.user.gender = b.gender;
      if (b.birthDate) rq.state.user.birthDate = b.birthDate;
      const profile = rq.state.healthProfile;
      if (b.heightCm) profile.heightCm = b.heightCm;
      if (b.weightKg) profile.weightKg = b.weightKg;
      profile.completedAt = profile.completedAt || new Date().toISOString();
      profile.bmi = bmiOf(profile);
      return { profile, user: rq.state.user };
    },
  },
  {
    method: 'GET',
    path: '/api/app/status',
    handler: (rq) => ({
      settings: {
        maintenanceMode: false,
        maintenanceMessage: '',
        minAppVersion: '0.0.0',
        forceUpdate: false,
        allowRegistrations: true,
        supportEmail: 'support@medicard.ge',
        consumerPurchasesEnabled: false,
        updatedAt: new Date(Date.now() - 86400000).toISOString(),
      },
      features: Object.fromEntries(FEATURE_KEYS.map((k) => [k, true])),
      featureMessages: {},
      packages: [FREE_PACKAGE],
      accessMode: 'free',
      mapboxToken: '',
      client: { version: String(rq.query.version || '0.0.0'), needsUpdate: false, blockedByForceUpdate: false },
    }),
  },
  { method: 'GET', path: '/api/ai-consent', handler: (rq) => aiConsent(rq.state) },
  {
    method: 'PUT',
    path: '/api/ai-consent',
    handler: (rq) => {
      const { decision, version } = rq.body || {};
      if (version !== AI_CONSENT_VERSION) return rq.reply(409, { error: 'The data sharing terms have been updated.', code: 'AI_CONSENT_VERSION_CHANGED' });
      rq.state.aiConsent = { decision, updatedAt: new Date().toISOString() };
      return aiConsent(rq.state);
    },
  },
  // Telemetry / guards: accept and drop (logged in state for inspection).
  {
    method: 'POST',
    path: '/api/funnel/events',
    handler: (rq) => {
      const events = Array.isArray(rq.body?.events) ? rq.body.events : rq.body ? [rq.body] : [];
      rq.state.funnelEvents.push(...events.slice(0, 50));
      return rq.reply(202, { ok: true, accepted: events.length });
    },
  },
  {
    method: 'POST',
    path: '/api/app/client-error',
    handler: (rq) => {
      const events = Array.isArray(rq.body?.events) ? rq.body.events : [];
      rq.state.clientErrors.push(...events.slice(0, 10));
      for (const e of events.slice(0, 10)) console.log(`CLIENT-ERROR ${e.kind} ${e.name}: ${e.message} @ ${e.route ?? ''}`);
      return rq.reply(202, { ok: true });
    },
  },
  {
    method: 'POST',
    path: '/api/app/client-guard',
    handler: (rq) => {
      console.log(`CLIENT-GUARD ${JSON.stringify(rq.body)}`);
      return rq.reply(202, { ok: true });
    },
  },
  { method: 'POST', path: '/api/push/register', handler: ok },
  { method: 'DELETE', path: '/api/push/register', handler: ok },
];

export { tbilisiToday };
