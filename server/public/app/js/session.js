// MEDICARD web — signed-in session state (user, health profile, feature flags, theme).
import { get, getToken, setToken, clearSessionCaches } from './api.js';

const listeners = new Set();
export const session = {
  user: null,
  profile: null,
  stats: null,
  usage: null,
  checkIn: null,
  features: {},
  featureMessages: {},
};

export function onSession(fn) { listeners.add(fn); return () => listeners.delete(fn); }
function emit() { listeners.forEach((fn) => fn(session)); }

/**
 * Sliding session: /api/auth/me adds a fresh `token` (same account) once the presented one is past
 * half its lifetime. Kept only while the token that asked is still the saved one.
 */
function keepRenewedToken(sent, me) {
  if (typeof me?.token === 'string' && me.token && sent && getToken() === sent) setToken(me.token);
}

export async function loadSession() {
  const sent = getToken();
  if (!sent) return null;
  const [me, status] = await Promise.all([
    get('/api/auth/me'),
    get('/api/app/status').catch(() => null),
  ]);
  keepRenewedToken(sent, me);
  session.user = me.user;
  session.profile = me.healthProfile || null;
  session.stats = me.stats || null;
  session.usage = me.usage || null;
  session.checkIn = me.checkIn || null;
  if (status) {
    session.features = status.features || {};
    session.featureMessages = status.featureMessages || {};
  }
  // Trainer workspace entry: only for trainers (any application status); never blocks boot.
  if (featureOn('coach')) {
    try { session.trainer = await get('/api/trainer/me'); } catch { session.trainer = null; }
  }
  emit();
  return session;
}

export async function refreshMe() {
  const sent = getToken();
  const me = await get('/api/auth/me');
  keepRenewedToken(sent, me);
  session.user = me.user;
  session.profile = me.healthProfile || session.profile;
  session.stats = me.stats || session.stats;
  session.checkIn = me.checkIn || session.checkIn;
  emit();
  return me;
}

export function setUser(user) { session.user = { ...session.user, ...user }; emit(); }
export function setProfile(profile) { session.profile = profile; emit(); }

export function signIn(token, user) {
  clearSessionCaches();
  setToken(token);
  session.user = user || null;
}

export function signOut() {
  setToken(null);
  clearSessionCaches();
  Object.assign(session, { user: null, profile: null, stats: null, usage: null, checkIn: null });
  emit();
}

/** Missing flag = on (server treats a missing row as enabled). */
export function featureOn(key) { return session.features?.[key] !== false; }

/** A trainer profile exists (applied / verified) — shows the /coach workspace in the menu. */
export function isTrainer() { return Boolean(session.trainer?.trainerProfile); }

export function isFemale() { return String(session.user?.gender || '').toUpperCase() === 'FEMALE'; }

export function firstName() {
  const n = String(session.user?.fullName || '').trim();
  if (!n || n === 'Medicard მომხმარებელი') return '';
  return n.split(/\s+/)[0];
}

export function initials() {
  const n = String(session.user?.fullName || '').trim();
  if (!n || n === 'Medicard მომხმარებელი') return 'M';
  return n.split(/\s+/).slice(0, 2).map((p) => p[0]).join('').toUpperCase();
}

export function profileExtra() { return session.profile?.extraAnswers || {}; }

/** Onboarding is needed until the profile is completed (same rule as the app). */
export function needsOnboarding() {
  const p = session.profile;
  if (p?.completedAt) return false;
  return true;
}

/* ── Theme ─────────────────────────────────────────── */
const THEME_KEY = 'medicard.web.theme';
export function getThemePref() { try { return localStorage.getItem(THEME_KEY) || 'system'; } catch { return 'system'; } }
export function applyTheme(pref = getThemePref()) {
  try { localStorage.setItem(THEME_KEY, pref); } catch { /* ignore */ }
  const dark = pref === 'dark' || (pref === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  document.querySelector('meta[name=theme-color]')?.setAttribute('content', dark ? '#030712' : '#f5f7f7');
}
matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', () => { if (getThemePref() === 'system') applyTheme('system'); });
