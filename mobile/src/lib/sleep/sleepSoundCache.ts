import { Platform } from 'react-native';
import { API_BASE_URL } from '@/lib/api';
import type { SleepFileRef } from './sleepTypes';

/**
 * MEDISLEEP sounds are downloaded once into the app's documents folder and played from there: no stream
 * while she falls asleep, works offline afterwards, and the lock screen never waits for the network. Files are
 * keyed by their server id (immutable — a replaced sound gets a new id). The web preview streams the URL.
 */
const DIR_NAME = 'medisleep-sounds-v1';
const inflight = new Map<string, Promise<string>>();
const progressListeners = new Map<string, Set<(fraction: number) => void>>();

function fs() {
  return require('expo-file-system/legacy') as typeof import('expo-file-system/legacy');
}

function dir(): string | null {
  const base = fs().documentDirectory;
  return base ? `${base}${DIR_NAME}/` : null;
}

export function remoteUrl(file: SleepFileRef | { url: string }): string {
  return file.url.startsWith('http') ? file.url : `${API_BASE_URL}${file.url}`;
}

function localPath(id: string): string | null {
  const d = dir();
  return d ? `${d}${id}.m4a` : null;
}

export async function cachedUri(file: SleepFileRef): Promise<string | null> {
  if (Platform.OS === 'web') return remoteUrl(file);
  const path = localPath(file.id);
  if (!path) return null;
  try {
    const info = await fs().getInfoAsync(path);
    return info.exists && (info.size ?? 0) > 1024 ? path : null;
  } catch {
    return null;
  }
}

export function onDownloadProgress(id: string, listener: (fraction: number) => void): () => void {
  if (!progressListeners.has(id)) progressListeners.set(id, new Set());
  progressListeners.get(id)!.add(listener);
  return () => progressListeners.get(id)?.delete(listener);
}

function report(id: string, fraction: number) {
  progressListeners.get(id)?.forEach((l) => {
    try {
      l(fraction);
    } catch {
      /* a listener's problem is not the download's */
    }
  });
}

/** Local file URI for a sound file, downloading it first when needed. Throws when offline and not cached. */
export function ensureSoundFile(file: SleepFileRef): Promise<string> {
  if (Platform.OS === 'web') return Promise.resolve(remoteUrl(file));
  const running = inflight.get(file.id);
  if (running) return running;
  const job = (async () => {
    const hit = await cachedUri(file);
    if (hit) return hit;
    const d = dir();
    const path = localPath(file.id);
    if (!d || !path) return remoteUrl(file);
    const FileSystem = fs();
    await FileSystem.makeDirectoryAsync(d, { intermediates: true }).catch(() => undefined);
    const tmp = `${path}.part`;
    const download = FileSystem.createDownloadResumable(remoteUrl(file), tmp, {}, (p) => {
      const total = p.totalBytesExpectedToWrite || file.size || 0;
      if (total > 0) report(file.id, Math.min(1, p.totalBytesWritten / total));
    });
    const result = await download.downloadAsync();
    if (!result || result.status < 200 || result.status >= 300) {
      await FileSystem.deleteAsync(tmp, { idempotent: true }).catch(() => undefined);
      throw new Error(`download ${result?.status ?? 'failed'}`);
    }
    await FileSystem.moveAsync({ from: tmp, to: path });
    report(file.id, 1);
    return path;
  })().finally(() => inflight.delete(file.id));
  inflight.set(file.id, job);
  return job;
}

/** Removes cached files that no longer belong to any sound (a replaced or deleted sound). */
export async function pruneSoundCache(keepIds: string[]): Promise<void> {
  if (Platform.OS === 'web') return;
  const d = dir();
  if (!d) return;
  try {
    const FileSystem = fs();
    const keep = new Set(keepIds.map((id) => `${id}.m4a`));
    const names = await FileSystem.readDirectoryAsync(d);
    for (const name of names) {
      if (!keep.has(name)) await FileSystem.deleteAsync(`${d}${name}`, { idempotent: true }).catch(() => undefined);
    }
  } catch {
    /* nothing cached yet */
  }
}
