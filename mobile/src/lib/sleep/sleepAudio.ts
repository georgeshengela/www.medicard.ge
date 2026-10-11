import { useSyncExternalStore } from 'react';
import { AppState, Platform } from 'react-native';
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer, type AudioStatus } from 'expo-audio';
import { api } from '@/lib/api';
import { randomUuid, setSleepAudioOwner } from '@/lib/audioSession';
import { localAccountId } from '@/lib/localAccount';
import { tx } from '@/i18n/locale';
import { ensureSoundFile, remoteUrl } from './sleepSoundCache';
import type { SleepConfig, SleepSound } from './sleepTypes';

/**
 * The MEDISLEEP mixer: up to `maxLayers` sounds looping together, a timer that fades them out, the lock
 * screen's play/pause, and play history for the admin page.
 *
 * Why the timer runs on the player's own status events: Android pauses JS timers in the background (see
 * docs/agents/medirun.md), but expo-audio keeps sending `playbackStatusUpdate` from its media service, and
 * iOS keeps the periodic time observer running while audio plays. A setInterval also runs in the foreground
 * (smooth countdown on screen); whichever comes first does the work, idempotently.
 */

export type MixerLayer = {
  soundId: string;
  title: string;
  tint: string;
  art: string | null;
  volume: number;
  loading: boolean;
  progress: number;
};

export type MixerPhase = 'idle' | 'loading' | 'playing' | 'paused';

export type MixerState = {
  phase: MixerPhase;
  layers: MixerLayer[];
  master: number;
  /** 0 = until stopped. */
  timerMinutes: number;
  endsAt: number | null;
  fading: boolean;
  startedAt: number | null;
  sleepMode: boolean;
  error: string | null;
};

type LiveLayer = { sound: SleepSound; player: AudioPlayer | null };

const DEFAULTS = { fadeSeconds: 60, maxLayers: 3, defaultVolume: 0.7, defaultTimerMinutes: 45 };
let settings = { ...DEFAULTS };

let state: MixerState = {
  phase: 'idle', layers: [], master: 1, timerMinutes: DEFAULTS.defaultTimerMinutes, endsAt: null, fading: false,
  startedAt: null, sleepMode: false, error: null,
};
const live = new Map<string, LiveLayer>();
const listeners = new Set<() => void>();
let holder: { player: AudioPlayer; sub: { remove(): void } } | null = null;
let ticker: ReturnType<typeof setInterval> | null = null;
let sessionId: string | null = null;
/** We changed play/pause ourselves; the next status flip is ours, not the lock screen's. */
let expectPlaying: boolean | null = null;
let generation = 0;

function set(patch: Partial<MixerState>) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}

export function mixerState(): MixerState {
  return state;
}

export function subscribeMixer(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useSleepMixer(): MixerState {
  return useSyncExternalStore(subscribeMixer, mixerState, mixerState);
}

export function isSleepAudioBusy(): boolean {
  return state.phase === 'playing' || state.phase === 'loading' || state.phase === 'paused';
}

export function configureMixer(config: Partial<SleepConfig> | null | undefined) {
  if (!config) return;
  settings = {
    fadeSeconds: config.fadeSeconds ?? settings.fadeSeconds,
    maxLayers: config.maxLayers ?? settings.maxLayers,
    defaultVolume: config.defaultVolume ?? settings.defaultVolume,
    defaultTimerMinutes: config.defaultTimerMinutes ?? settings.defaultTimerMinutes,
  };
  if (state.phase === 'idle') set({ timerMinutes: settings.defaultTimerMinutes });
}

export function mixerMaxLayers(): number {
  return settings.maxLayers;
}

// ------------------------------------------------------------------ volumes and timer

function fadeFactor(now = Date.now()): number {
  if (!state.endsAt || settings.fadeSeconds <= 0) return 1;
  const left = state.endsAt - now;
  const fadeMs = settings.fadeSeconds * 1000;
  if (left >= fadeMs) return 1;
  if (left <= 0) return 0;
  // Equal-power curve: the ear hears a straight fade.
  return Math.sin((left / fadeMs) * (Math.PI / 2));
}

function applyVolumes(now = Date.now()) {
  const f = fadeFactor(now);
  for (const layer of state.layers) {
    const player = live.get(layer.soundId)?.player;
    if (!player) continue;
    try {
      player.volume = Math.max(0, Math.min(1, layer.volume * state.master * f));
    } catch {
      /* a released player */
    }
  }
  if (f < 1 !== state.fading) set({ fading: f < 1 });
}

function tick() {
  if (state.phase !== 'playing') return;
  const now = Date.now();
  if (state.endsAt && now >= state.endsAt) {
    void stopSleepSounds({ reason: 'timer' });
    return;
  }
  applyVolumes(now);
}

function startTicker() {
  if (ticker) return;
  ticker = setInterval(tick, 1000);
}

function stopTicker() {
  if (ticker) clearInterval(ticker);
  ticker = null;
}

export function setMixerTimer(minutes: number) {
  const endsAt = minutes > 0 && state.phase !== 'idle' ? Date.now() + minutes * 60_000 : null;
  set({ timerMinutes: minutes, endsAt, fading: false });
  applyVolumes();
  updateLockScreen();
}

export function setLayerVolume(soundId: string, volume: number) {
  set({ layers: state.layers.map((l) => (l.soundId === soundId ? { ...l, volume: Math.max(0, Math.min(1, volume)) } : l)) });
  applyVolumes();
}

export function setMasterVolume(volume: number) {
  set({ master: Math.max(0, Math.min(1, volume)) });
  applyVolumes();
}

// ------------------------------------------------------------------ session

async function claimSession() {
  setSleepAudioOwner(true);
  await setAudioModeAsync({
    playsInSilentMode: true,
    shouldPlayInBackground: true,
    // Lock-screen controls require exclusive focus (expo-audio docs); other apps' audio pauses, as with any player.
    interruptionMode: 'doNotMix',
    allowsRecording: false,
  }).catch(() => undefined);
}

function releaseSession() {
  setSleepAudioOwner(false);
  void setAudioModeAsync({ playsInSilentMode: true, shouldPlayInBackground: false, interruptionMode: 'mixWithOthers', allowsRecording: false }).catch(() => undefined);
}

function lockScreenTitle(): string {
  const names = state.layers.map((l) => l.title);
  return names.length ? names.join(' · ') : 'MEDISLEEP';
}

function lockScreenArtist(): string {
  if (state.endsAt) {
    const end = new Date(state.endsAt);
    const hh = String(end.getHours()).padStart(2, '0');
    const mm = String(end.getMinutes()).padStart(2, '0');
    return tx(`MEDISLEEP · ჩაქრება ${hh}:${mm}-ზე`, `MEDISLEEP · fades out at ${hh}:${mm}`);
  }
  return 'MEDISLEEP';
}

function updateLockScreen() {
  if (!holder) return;
  try {
    holder.player.updateLockScreenMetadata({ title: lockScreenTitle(), artist: lockScreenArtist(), artworkUrl: state.layers[0]?.art ?? undefined });
  } catch {
    /* lock screen is optional */
  }
}

function onHolderStatus(status: AudioStatus) {
  if (!status.isLoaded) return;
  // The lock screen / headphones / a call paused or resumed the holder: follow with every layer.
  if (expectPlaying !== null && status.playing === expectPlaying) expectPlaying = null;
  else if (expectPlaying === null) {
    if (!status.playing && state.phase === 'playing' && !status.isBuffering) pauseSleepSounds({ fromSystem: true });
    else if (status.playing && state.phase === 'paused') resumeSleepSounds({ fromSystem: true });
  }
  tick();
}

function attachHolder() {
  const first = state.layers[0];
  const player = first ? live.get(first.soundId)?.player : null;
  if (holder && holder.player === player) return;
  detachHolder();
  if (!player) return;
  try {
    player.setActiveForLockScreen(true, { title: lockScreenTitle(), artist: lockScreenArtist(), artworkUrl: first?.art ?? undefined }, { showSeekForward: false, showSeekBackward: false });
  } catch {
    /* older binaries / web without media session */
  }
  const sub = player.addListener('playbackStatusUpdate', onHolderStatus);
  holder = { player, sub };
}

function detachHolder() {
  if (!holder) return;
  try {
    holder.sub.remove();
    holder.player.clearLockScreenControls();
  } catch {
    /* already released */
  }
  holder = null;
}

function release(player: AudioPlayer | null) {
  if (!player) return;
  try {
    player.pause();
  } catch {
    /* released */
  }
  try {
    player.remove();
  } catch {
    /* released */
  }
}

async function loadLayer(sound: SleepSound, gen: number): Promise<AudioPlayer | null> {
  if (!sound.audio) throw new Error('no audio');
  const uri = await ensureSoundFile(sound.audio);
  if (gen !== generation || !state.layers.some((l) => l.soundId === sound.id)) return null;
  const player = createAudioPlayer({ uri }, { updateInterval: 1000, keepAudioSessionActive: true });
  // Songs repeat too: they fade in and out on their own, and the timer decides when the night's sound ends.
  player.loop = true;
  return player;
}

function layerFor(sound: SleepSound, volume = settings.defaultVolume): MixerLayer {
  return {
    soundId: sound.id, title: sound.title, tint: sound.tint, art: sound.art ? remoteUrl(sound.art) : null,
    volume, loading: true, progress: 0,
  };
}

async function startLayers(sounds: SleepSound[], gen: number) {
  await claimSession();
  const results = await Promise.allSettled(sounds.map(async (sound) => {
    const player = await loadLayer(sound, gen);
    if (!player) return;
    live.set(sound.id, { sound, player });
    set({ layers: state.layers.map((l) => (l.soundId === sound.id ? { ...l, loading: false, progress: 1 } : l)) });
  }));
  if (gen !== generation) return;
  const failed = sounds.filter((_, i) => results[i].status === 'rejected').map((s) => s.id);
  if (failed.length) {
    set({ layers: state.layers.filter((l) => !failed.includes(l.soundId)) });
    if (!state.layers.length) {
      set({ phase: 'idle', error: tx('ხმა ვერ ჩაიტვირთა. შეამოწმე ინტერნეტი და სცადე თავიდან.', 'The sound could not load. Check your connection and try again.') });
      releaseSession();
      return;
    }
  }
  applyVolumes();
  expectPlaying = true;
  for (const layer of state.layers) {
    const player = live.get(layer.soundId)?.player;
    try {
      player?.play();
    } catch {
      /* skip one broken layer */
    }
  }
  attachHolder();
  set({ phase: 'playing', error: null });
  startTicker();
}

/**
 * Starts a new mix (replaces whatever plays). `timerMinutes` 0 = until stopped. `sleepMode` marks sessions
 * started from „ძილის რეჟიმი“ in the play history.
 */
export async function playSleepSounds(sounds: SleepSound[], { timerMinutes = state.timerMinutes, sleepMode = false } = {}) {
  const picked = sounds.filter((s) => s.audio).slice(0, settings.maxLayers);
  if (!picked.length) return;
  await stopSleepSounds({ reason: 'replace', record: true });
  const gen = ++generation;
  sessionId = randomUuid();
  set({
    phase: 'loading', layers: picked.map((s) => layerFor(s)), timerMinutes,
    endsAt: timerMinutes > 0 ? Date.now() + timerMinutes * 60_000 : null, fading: false,
    startedAt: Date.now(), sleepMode, error: null,
  });
  await startLayers(picked, gen);
}

/** Adds a sound to the mix, or removes it when it is already there. Starts playback when idle. */
export async function toggleSleepSound(sound: SleepSound) {
  if (state.layers.some((l) => l.soundId === sound.id)) {
    const rest = state.layers.filter((l) => l.soundId !== sound.id);
    if (!rest.length) {
      await stopSleepSounds({ reason: 'user' });
      return;
    }
    release(live.get(sound.id)?.player ?? null);
    live.delete(sound.id);
    set({ layers: rest });
    attachHolder();
    updateLockScreen();
    return;
  }
  if (state.phase === 'idle') {
    await playSleepSounds([sound]);
    return;
  }
  if (state.layers.length >= settings.maxLayers) {
    set({ error: tx(`ერთად მაქსიმუმ ${settings.maxLayers} ხმა შეიძლება.`, `Up to ${settings.maxLayers} sounds can play together.`) });
    return;
  }
  const gen = generation;
  set({ layers: [...state.layers, layerFor(sound)], error: null });
  try {
    const player = await loadLayer(sound, gen);
    if (!player) return;
    live.set(sound.id, { sound, player });
    set({ layers: state.layers.map((l) => (l.soundId === sound.id ? { ...l, loading: false, progress: 1 } : l)) });
    applyVolumes();
    if (state.phase === 'playing') player.play();
    updateLockScreen();
  } catch {
    set({ layers: state.layers.filter((l) => l.soundId !== sound.id), error: tx('ხმა ვერ ჩაიტვირთა.', 'The sound could not load.') });
  }
}

export function pauseSleepSounds({ fromSystem = false } = {}) {
  if (state.phase !== 'playing') return;
  if (!fromSystem) expectPlaying = false;
  for (const { player } of live.values()) {
    try {
      player?.pause();
    } catch {
      /* released */
    }
  }
  set({ phase: 'paused' });
  stopTicker();
}

export function resumeSleepSounds({ fromSystem = false } = {}) {
  if (state.phase !== 'paused') return;
  // A timer that ran out while paused is over; the rest keeps its remaining time.
  if (state.endsAt && Date.now() >= state.endsAt) {
    set({ endsAt: state.timerMinutes > 0 ? Date.now() + state.timerMinutes * 60_000 : null });
  }
  if (!fromSystem) expectPlaying = true;
  applyVolumes();
  for (const { player } of live.values()) {
    try {
      player?.play();
    } catch {
      /* released */
    }
  }
  set({ phase: 'playing' });
  startTicker();
}

export function clearMixerError() {
  if (state.error) set({ error: null });
}

// ------------------------------------------------------------------ stop + history

const pendingPlays: Parameters<typeof api.sleep.recordPlays>[0] = [];

function recordPlay() {
  if (!sessionId || !state.startedAt || !state.layers.length || !localAccountId()) return;
  const minutes = Math.round((Date.now() - state.startedAt) / 60_000);
  if (minutes < 1) return;
  pendingPlays.push({
    id: sessionId, soundIds: state.layers.map((l) => l.soundId), startedAt: new Date(state.startedAt).toISOString(),
    minutes: Math.min(720, minutes), timerMinutes: state.timerMinutes || null, sleepMode: state.sleepMode,
  });
  void flushSleepPlays();
}

export async function flushSleepPlays() {
  if (!pendingPlays.length || !localAccountId()) return;
  const batch = pendingPlays.splice(0, 20);
  try {
    await api.sleep.recordPlays(batch);
  } catch {
    // Usage counts only: keep them for the next try, but never let the queue grow without bound.
    if (pendingPlays.length < 40) pendingPlays.unshift(...batch);
  }
}

/** Stops everything. `reason` only matters for history: a replaced mix is recorded like a finished one. */
export async function stopSleepSounds({ reason = 'user', record = true }: { reason?: 'user' | 'timer' | 'replace' | 'signout'; record?: boolean } = {}) {
  if (state.phase === 'idle' && !live.size) return;
  if (record && reason !== 'signout') recordPlay();
  generation++;
  sessionId = null;
  stopTicker();
  detachHolder();
  for (const { player } of live.values()) release(player);
  live.clear();
  expectPlaying = null;
  set({ phase: 'idle', layers: [], endsAt: null, fading: false, startedAt: null, sleepMode: false });
  if (reason !== 'replace') releaseSession();
}

// Coming back to the app: catch up on a timer that ended while JS slept, and send queued history.
AppState.addEventListener('change', (next) => {
  if (next !== 'active') return;
  tick();
  void flushSleepPlays();
});

// The web preview keeps working without lock-screen support.
export const sleepAudioPlatform = Platform.OS;
