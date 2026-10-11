import { useSyncExternalStore } from 'react';
import { AppState } from 'react-native';
import { api } from '@/lib/api';
import { randomUuid } from '@/lib/audioSession';
import { getScopedPreference, localAccountId, onLocalAccountChange, setScopedPreference } from '@/lib/localAccount';
import { cancelSleepAlarm, scheduleSleepAlarm, type AlarmKind } from './sleepAlarm';
import { mixerState, playSleepSounds, stopSleepSounds } from './sleepAudio';
import { endSleepActivity, restoreSleepActivity, startSleepActivity } from './sleepActivity';
import { signalSleepWidget } from './sleepWidget';
import { nightOf } from './sleepTime';
import type { SleepNightWrite, SleepSound } from './sleepTypes';

/**
 * „ძილის რეჟიმი“ (sleep mode): from „ღამე მშვიდობისა“ to „დილა მშვიდობისა“. Holds the start, the alarm and the
 * sounds; survives the app being killed at night (stored per account); on the morning tap it saves the night as
 * time in bed (`kind: 'mode'` — Apple Health / Health Connect may refine it later, a hand edit wins over both).
 * Under 20 minutes nothing is saved (a tap by mistake), over 16 hours it is not a night.
 */
export type SleepSessionState = {
  id: string;
  owner: string;
  startedAt: number;
  alarmAt: number | null;
  alarm: { kind: AlarmKind; id: string } | null;
  soundIds: string[];
};

const KEY = 'medicard.sleep.session.v1';
const PENDING_KEY = 'medicard.sleep.pendingNights.v1';
export const SLEEP_MIN_MINUTES = 20;
const MAX_MINUTES = 16 * 60;
/** A session left running this long is abandoned (the phone died, she forgot): ended without a night. */
const ABANDON_MS = 20 * 3600_000;

let state: SleepSessionState | null = null;
let restored = false;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

export function sleepSession(): SleepSessionState | null {
  return state;
}

export function subscribeSleepSession(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useSleepSession(): SleepSessionState | null {
  return useSyncExternalStore(subscribeSleepSession, sleepSession, sleepSession);
}

async function persist(next: SleepSessionState | null) {
  state = next;
  emit();
  await setScopedPreference(KEY, next ? JSON.stringify(next) : '').catch(() => undefined);
  signalSleepWidget();
}

/** Once at app start (and on sign-in): bring back a sleep mode that was running when the app was killed. */
export async function restoreSleepSession(): Promise<SleepSessionState | null> {
  const owner = localAccountId();
  let saved: SleepSessionState | null = null;
  try {
    const raw = owner ? await getScopedPreference(KEY) : null;
    saved = raw ? (JSON.parse(raw) as SleepSessionState) : null;
  } catch {
    saved = null;
  }
  if (saved && (saved.owner !== owner || Date.now() - saved.startedAt > ABANDON_MS)) {
    await cancelSleepAlarm(saved.alarm);
    saved = null;
    await setScopedPreference(KEY, '').catch(() => undefined);
  }
  state = saved;
  restored = true;
  restoreSleepActivity(saved ? { startedAt: saved.startedAt, alarmAt: saved.alarmAt } : null);
  emit();
  void flushPendingNights();
  return saved;
}

export function sleepSessionRestored(): boolean {
  return restored;
}

export async function startSleepMode({ alarmAt, sounds = [], timerMinutes }: { alarmAt: Date | null; sounds?: SleepSound[]; timerMinutes?: number }) {
  const owner = localAccountId();
  if (!owner) return null;
  if (state) return state;
  const alarm = alarmAt ? await scheduleSleepAlarm(alarmAt) : null;
  const next: SleepSessionState = {
    id: randomUuid(), owner, startedAt: Date.now(), alarmAt: alarm && alarmAt ? alarmAt.getTime() : null, alarm,
    soundIds: sounds.map((s) => s.id),
  };
  await persist(next);
  if (sounds.length) await playSleepSounds(sounds, { timerMinutes, sleepMode: true });
  startSleepActivity({ startedAt: next.startedAt, alarmAt: next.alarmAt });
  return next;
}

/** Sounds chosen during the night join the night's record. */
export function noteSleepModeSounds() {
  if (!state) return;
  const ids = mixerState().layers.map((l) => l.soundId);
  const merged = [...new Set([...state.soundIds, ...ids])].slice(0, 6);
  if (merged.length !== state.soundIds.length) void persist({ ...state, soundIds: merged });
}

export type SleepModeResult = { night: string; minutes: number; saved: boolean; tooShort: boolean };

/** „დილა მშვიდობისა“: ends sleep mode and saves the night (or keeps it to send later when offline). */
export async function endSleepMode({ save = true, wakeAt = new Date() }: { save?: boolean; wakeAt?: Date } = {}): Promise<SleepModeResult | null> {
  const current = state;
  if (!current) return null;
  noteSleepModeSounds();
  const soundIds = state?.soundIds ?? current.soundIds;
  await stopSleepSounds({ reason: 'user' });
  if (!current.alarmAt || wakeAt.getTime() < current.alarmAt) await cancelSleepAlarm(current.alarm);
  endSleepActivity();
  await persist(null);
  const minutes = Math.round((wakeAt.getTime() - current.startedAt) / 60_000);
  const night = nightOf(wakeAt);
  const tooShort = minutes < SLEEP_MIN_MINUTES;
  if (!save || tooShort || minutes > MAX_MINUTES) return { night, minutes, saved: false, tooShort };
  const body: SleepNightWrite = {
    id: current.id, kind: 'mode', bedAt: new Date(current.startedAt).toISOString(), wakeAt: wakeAt.toISOString(),
    sounds: soundIds,
  };
  const saved = await saveOrQueue(night, body, current.owner);
  return { night, minutes, saved, tooShort };
}

/** Changing the alarm while sleep mode runs. */
export async function setSleepModeAlarm(alarmAt: Date | null) {
  if (!state) return;
  await cancelSleepAlarm(state.alarm);
  const alarm = alarmAt ? await scheduleSleepAlarm(alarmAt) : null;
  await persist({ ...state, alarm, alarmAt: alarm && alarmAt ? alarmAt.getTime() : null });
  startSleepActivity({ startedAt: state!.startedAt, alarmAt: state!.alarmAt });
}

// ------------------------------------------------------------------ offline queue

type Pending = { owner: string; night: string; body: SleepNightWrite };

async function readPending(): Promise<Pending[]> {
  try {
    const raw = await getScopedPreference(PENDING_KEY);
    return raw ? (JSON.parse(raw) as Pending[]) : [];
  } catch {
    return [];
  }
}

async function saveOrQueue(night: string, body: SleepNightWrite, owner: string): Promise<boolean> {
  try {
    await api.sleep.saveNight(night, body);
    return true;
  } catch (error) {
    const status = (error as { status?: number })?.status ?? 0;
    // Only a network problem or a busy server is worth retrying; a refused night (400) is not.
    if (status === 0 || status === 408 || status === 429 || status >= 500) {
      const list = (await readPending()).filter((p) => !(p.owner === owner && p.night === night));
      list.push({ owner, night, body });
      await setScopedPreference(PENDING_KEY, JSON.stringify(list.slice(-10))).catch(() => undefined);
    }
    return false;
  }
}

let flushing = false;
export async function flushPendingNights(): Promise<void> {
  const owner = localAccountId();
  if (!owner || flushing) return;
  flushing = true;
  try {
    const list = await readPending();
    const keep: Pending[] = [];
    for (const p of list) {
      if (p.owner !== owner) continue;
      try {
        await api.sleep.saveNight(p.night, p.body);
      } catch (error) {
        const status = (error as { status?: number })?.status ?? 0;
        if (status === 0 || status === 408 || status === 429 || status >= 500) keep.push(p);
      }
    }
    await setScopedPreference(PENDING_KEY, JSON.stringify(keep)).catch(() => undefined);
  } finally {
    flushing = false;
  }
}

// Another account signed in: her sleep mode, sounds and alarm never carry over.
onLocalAccountChange((next) => {
  if (state && state.owner !== next) {
    const old = state;
    state = null;
    emit();
    void stopSleepSounds({ reason: 'signout' });
    void cancelSleepAlarm(old.alarm);
    endSleepActivity();
  }
});

AppState.addEventListener('change', (next) => {
  if (next === 'active') void flushPendingNights();
});
