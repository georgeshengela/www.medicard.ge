/**
 * MEDISLEEP on the iPhone lock screen and Dynamic Island while sleep mode runs (Live Activity, expo-widgets,
 * layout in sleepActivityLayout.tsx). Started from the foreground with sleep mode (ActivityKit rule); follows the
 * sounds (playing / paused / faded out) and ends with the night. The clock ticks natively, so updates go out only
 * when something visible changes. iOS ends an activity after ~8 hours by itself; the stale date is the alarm
 * (or 9 h), after which the lock screen asks to open the app instead of showing a running clock forever.
 */
import { AppState, Platform } from 'react-native';
import { expoWidgetsAvailable } from '@/lib/nativeWidgets';
import { tx } from '@/i18n/locale';
import { mixerState, pauseSleepSounds, resumeSleepSounds, subscribeMixer, type MixerState } from './sleepAudio';
import { clockOf } from './sleepTime';
import type { SleepActivityProps } from './sleepActivityLayout';

type Instance = {
  update(props: SleepActivityProps, staleDate?: Date): Promise<void>;
  end(policy?: 'default' | 'immediate', props?: SleepActivityProps): Promise<void>;
};
type Factory = { start(props: SleepActivityProps, url?: string, staleDate?: Date): Instance; getInstances(): Instance[] };
type WidgetsModule = { addUserInteractionListener(listener: (event: { source?: string; target?: string }) => void): { remove(): void } };

export type SleepActivitySession = { startedAt: number; alarmAt: number | null };

const OPEN_URL = 'medicard://sleep/night';
const WAKE_URL = 'medicard://sleep/night?wake=1';

let factory: Factory | null = null;
let widgets: WidgetsModule | null = null;
let instance: Instance | null = null;
let session: SleepActivitySession | null = null;
let lastKey = '';
let wired = false;

function load(): boolean {
  if (factory) return true;
  if (Platform.OS !== 'ios' || !expoWidgetsAvailable()) return false;
  try {
    factory = require('./sleepActivityLayout').default as Factory;
    widgets = require('expo-widgets') as WidgetsModule;
    return true;
  } catch {
    factory = null;
    widgets = null;
    return false;
  }
}

function soundNote(m: MixerState): string {
  if (m.phase === 'paused') return tx('პაუზაზეა', 'Paused');
  if (m.endsAt) {
    const at = clockOf(new Date(m.endsAt));
    return tx(`ჩაქრება ${at}-ზე`, `Fades out at ${at}`);
  }
  return tx('უკრავს', 'Playing');
}

export function sleepActivityProps(s: SleepActivitySession, m: MixerState): SleepActivityProps {
  const playing = m.phase === 'playing' || m.phase === 'loading';
  const hasSound = m.phase !== 'idle' && m.layers.length > 0;
  return {
    startedAt: s.startedAt,
    title: tx('ძილის რეჟიმი', 'Sleep mode'),
    elapsedLabel: tx('ძილის რეჟიმში', 'In sleep mode'),
    alarm: s.alarmAt ? clockOf(new Date(s.alarmAt)) : '',
    alarmLabel: tx('მაღვიძარა', 'Alarm'),
    sound: hasSound ? m.layers.map((l) => l.title).join(' · ') : '',
    soundNote: hasSound ? soundNote(m) : '',
    soundPlaying: playing,
    pauseLabel: tx('ხმის პაუზა', 'Pause the sound'),
    playLabel: tx('ხმის ჩართვა', 'Play the sound'),
    wakeLabel: tx('ვიღვიძებ', "I'm up"),
    wakeUrl: WAKE_URL,
    staleText: tx('გახსენი აპი', 'Open the app'),
  };
}

function staleDate(s: SleepActivitySession): Date {
  return new Date(s.alarmAt ? s.alarmAt + 60 * 60_000 : s.startedAt + 9 * 3600_000);
}

function sync() {
  if (!session || !factory) return;
  const props = sleepActivityProps(session, mixerState());
  const key = JSON.stringify(props);
  if (key === lastKey) return;
  if (!instance) {
    if (AppState.currentState !== 'active') return;
    try {
      instance = factory.start(props, OPEN_URL, staleDate(session));
      lastKey = key;
    } catch {
      instance = null; // Live Activities off in Settings
    }
    return;
  }
  lastKey = key;
  const current = instance;
  void current.update(props, staleDate(session)).catch(() => {
    if (instance === current) instance = null;
  });
}

function wire() {
  if (wired || !load()) return;
  wired = true;
  subscribeMixer(sync);
  try {
    widgets?.addUserInteractionListener((event) => {
      if (event.target !== 'sound') return;
      const m = mixerState();
      if (m.phase === 'playing') pauseSleepSounds();
      else if (m.phase === 'paused') resumeSleepSounds();
    });
  } catch {
    /* buttons need iOS 17 */
  }
}

/** Sleep mode started (from the screen — ActivityKit needs the foreground). */
export function startSleepActivity(s: SleepActivitySession) {
  if (!load()) return;
  wire();
  session = s;
  lastKey = '';
  sync();
}

/**
 * App start with a sleep mode still running (the process died at night): keep following the activity the
 * system kept, or end strays when there is no session.
 */
export function restoreSleepActivity(s: SleepActivitySession | null) {
  if (!load()) return;
  wire();
  try {
    const existing = factory!.getInstances();
    if (!s) {
      for (const old of existing) void old.end('immediate').catch(() => {});
      instance = null;
      return;
    }
    session = s;
    instance = existing[0] ?? null;
    for (const extra of existing.slice(1)) void extra.end('immediate').catch(() => {});
    lastKey = '';
    sync();
  } catch {
    /* iOS < 16.2 */
  }
}

export function endSleepActivity() {
  session = null;
  lastKey = '';
  const current = instance;
  instance = null;
  if (current) void current.end('immediate').catch(() => {});
  try {
    if (factory) for (const old of factory.getInstances()) void old.end('immediate').catch(() => {});
  } catch {
    /* nothing left */
  }
}
