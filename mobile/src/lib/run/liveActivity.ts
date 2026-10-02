/**
 * MEDIRUN on the iPhone lock screen and Dynamic Island (Live Activity) while a session runs.
 *
 * Starts with the session (ActivityKit only starts from the foreground), follows every pause, vehicle hold and
 * resume, and ends with the session. The clock ticks natively, so updates are only sent when something the
 * person can see changes (at most every 5 s for distance), plus a heartbeat that keeps the activity fresh;
 * if the app dies, the activity turns stale (“open the app”) instead of showing a running clock forever.
 * iOS 16.2+ only; anywhere else (and in binaries without the widget extension) every call is a no-op.
 */
import { AppState, Platform } from 'react-native';
import { tx } from '@/i18n/locale';
import { formatClock } from '@/lib/run/geo';
import { getRunState, pauseRun, subscribeRunState, type RunState } from '@/lib/run/store';
import { getPulseClient } from '@/lib/medipulsi/client';
import type { GiftSignal } from '@/lib/medipulsi/types';
import type { RunActivityProps } from '@/lib/run/runActivityLayout';

type Instance = {
  update(props: RunActivityProps, staleDate?: Date): Promise<void>;
  end(policy?: 'default' | 'immediate', props?: RunActivityProps): Promise<void>;
};
type Factory = { start(props: RunActivityProps, url?: string, staleDate?: Date): Instance; getInstances(): Instance[] };
type WidgetsModule = { addUserInteractionListener(listener: (event: { source?: string; target?: string }) => void): { remove(): void } };

const OPEN_URL = 'medicard://run/active';
const RESUME_URL = 'medicard://run/active?resume=1';
/** Minimum gap between updates that only move the distance or lit counter. */
const MIN_UPDATE_MS = 5000;
/** Re-sent while recording so a dead app turns stale after STALE_AFTER_MS instead of ticking on. */
const HEARTBEAT_MS = 60_000;
const STALE_AFTER_MS = 3 * 60_000;

let factory: Factory | null = null;
let widgets: WidgetsModule | null = null;
let instance: Instance | null = null;
let started = false;
/** Dismissed by the person or refused (Live Activities off): no new one until the next session. */
let suppressed = false;
let lastKey = '';
let lastMajor = '';
let lastSentAt = 0;
let trailing: ReturnType<typeof setTimeout> | null = null;
let heartbeat: ReturnType<typeof setInterval> | null = null;

function load(): boolean {
  if (factory) return true;
  if (Platform.OS !== 'ios') return false;
  try {
    // Missing native module (older binary) or Live Activities unsupported: stay silent.
    factory = require('./runActivityLayout').default as Factory;
    widgets = require('expo-widgets') as WidgetsModule;
    return true;
  } catch {
    factory = null;
    widgets = null;
    return false;
  }
}

function currentSignal(): GiftSignal | null {
  try {
    return getPulseClient().getSnapshot().signal;
  } catch {
    return null;
  }
}

function distanceParts(meters: number): { distance: string; unit: string } {
  if (meters < 1000) return { distance: String(Math.round(meters)), unit: tx('მ', 'm') };
  return { distance: (meters / 1000).toFixed(meters < 100_000 ? 2 : 1), unit: tx('კმ', 'km') };
}

function statusOf(s: RunState): { tone: RunActivityProps['tone']; status: string } {
  if (s.phase === 'paused') {
    return { tone: 'pause', status: s.autoPaused ? tx('ავტო-პაუზა', 'Auto-paused') : tx('პაუზა', 'Paused') };
  }
  if (s.transportWarning) {
    if (s.transportResuming) return { tone: 'hold', status: tx('ფეხით გააგრძელე · ათვლა ბრუნდება', 'Keep walking · counting resumes') };
    return { tone: 'hold', status: s.driving ? tx('მანქანაში · ავტო-პაუზა', 'In a vehicle · auto-paused') : tx('ტრანსპორტი · თვლა შეჩერებულია', 'Vehicle · counting on hold') };
  }
  if (s.accuracyM == null || s.accuracyM > 25) return { tone: 'live', status: tx('GPS-ს ველოდებით', 'Waiting for GPS') };
  return { tone: 'live', status: tx('შენი გზა იწერება', 'Your path is recording') };
}

/** The gift pulse while recording: near (signal) or here (in reach). */
function findOf(s: RunState, signal: GiftSignal | null): RunActivityProps['find'] {
  if (s.phase !== 'running' || s.transportWarning || !signal?.signal || !signal.quality) return 'none';
  return signal.revealed ? 'here' : 'near';
}

export function runActivityProps(s: RunState, now = Date.now(), signal: GiftSignal | null = null): RunActivityProps {
  const { tone, status } = statusOf(s);
  const find = findOf(s, signal);
  // Active time stops while paused or in a vehicle; otherwise the lock screen clock ticks on its own.
  const ticking = s.phase === 'running' && !s.transportWarning;
  return {
    tone,
    status,
    ...distanceParts(s.distanceM),
    distanceLabel: tx('მანძილი', 'Distance'),
    timeLabel: tx('აქტიური დრო', 'Active time'),
    ticking,
    clockStart: now - s.movingMs,
    clock: formatClock(s.movingMs),
    lit: s.litBuildings,
    litLabel: tx('ანთია', 'lit'),
    pauseLabel: tx('პაუზა', 'Pause'),
    resumeLabel: tx('გაგრძელება', 'Continue'),
    resumeUrl: RESUME_URL,
    staleText: tx('განახლება შეჩერდა · გახსენი აპი', 'Updates stopped · open the app'),
    find,
    findText: find === 'here' ? tx('საჩუქარი გვერდითაა', 'The gift is right here') : tx('აღმოჩენა ახლოსაა', 'A find is near'),
  };
}

/** What the person can see change; the clock start moves every second and is deliberately left out. */
function visibleKey(p: RunActivityProps): string {
  return [p.tone, p.status, p.find, p.distance, p.unit, p.ticking, p.ticking ? '' : p.clock, p.lit].join('|');
}
function majorKey(p: RunActivityProps): string {
  return [p.tone, p.status, p.find, p.ticking].join('|');
}

function staleDateFor(p: RunActivityProps): Date | undefined {
  return p.ticking || p.tone !== 'pause' ? new Date(Date.now() + STALE_AFTER_MS) : undefined;
}

function send(props: RunActivityProps): void {
  const current = instance;
  if (!current) return;
  lastKey = visibleKey(props);
  lastMajor = majorKey(props);
  lastSentAt = Date.now();
  void current.update(props, staleDateFor(props)).catch(() => {
    // The person dismissed it, or the system ended it: no new one until the next session starts.
    if (instance === current) instance = null;
    suppressed = true;
  });
}

function clearTimers(): void {
  if (trailing) clearTimeout(trailing);
  trailing = null;
  if (heartbeat) clearInterval(heartbeat);
  heartbeat = null;
}

function endActivity(): void {
  clearTimers();
  const current = instance;
  instance = null;
  suppressed = false;
  lastKey = '';
  lastMajor = '';
  if (current) void current.end('immediate').catch(() => {});
}

function sync(): void {
  const s = getRunState();
  if (s.phase !== 'running' && s.phase !== 'paused') {
    endActivity();
    return;
  }
  const props = runActivityProps(s, Date.now(), currentSignal());
  if (!instance) {
    // ActivityKit starts an activity only from the foreground: the session start/resume on screen.
    if (suppressed || s.phase !== 'running' || AppState.currentState !== 'active' || !factory) return;
    try {
      instance = factory.start(props, OPEN_URL, staleDateFor(props));
      lastKey = visibleKey(props);
      lastMajor = majorKey(props);
      lastSentAt = Date.now();
    } catch {
      instance = null; // Live Activities switched off in Settings, or unsupported
      suppressed = true;
      return;
    }
  } else {
    const key = visibleKey(props);
    if (key !== lastKey) {
      // A new state (pause, vehicle, resume) shows at once; distance and lit counts at most every 5 s.
      const wait = majorKey(props) !== lastMajor ? 0 : MIN_UPDATE_MS - (Date.now() - lastSentAt);
      if (wait <= 0) send(props);
      else if (!trailing) {
        trailing = setTimeout(() => {
          trailing = null;
          sync();
        }, wait);
      }
    }
  }
  if (s.phase === 'running' && !heartbeat) {
    heartbeat = setInterval(() => {
      const now = getRunState();
      if (now.phase === 'running' && instance) send(runActivityProps(now, Date.now(), currentSignal()));
    }, HEARTBEAT_MS);
  } else if (s.phase !== 'running' && heartbeat) {
    clearInterval(heartbeat);
    heartbeat = null;
  }
}

/** Once at startup (iOS): end activities a previous process left behind, then follow the run store. */
export function startRunLiveActivity(): void {
  if (started || !load()) return;
  started = true;
  try {
    for (const old of factory!.getInstances()) void old.end('immediate').catch(() => {});
  } catch {
    /* iOS < 16.2 */
  }
  try {
    widgets?.addUserInteractionListener((event) => {
      if (event.target === 'pause' && getRunState().phase === 'running') pauseRun();
    });
  } catch {
    /* buttons need iOS 17 */
  }
  subscribeRunState(sync);
  sync();
}
