import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';

/**
 * Auth-protected images on native.
 *
 * `<Image source={{ uri, headers }}>` is not reliable: on Android (new architecture) the Authorization
 * header is dropped and the server answers 401 — seen 2026-09-28 on a trainer's phone, the client's
 * photo stayed empty. So the bytes are downloaded once with the header into the app cache and the
 * image is shown from the local file. Keys include the account and the URL (avatar URLs carry `?v=`),
 * so a changed photo or another account never reuses a stale file.
 */

const inflight = new Map<string, Promise<string>>();

function hashKey(input: string): string {
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  for (let i = 0; i < input.length; i += 1) {
    const c = input.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 0x01000193) >>> 0;
    h2 = Math.imul(h2 + c, 0x5bd1e995) >>> 0;
  }
  return `${h1.toString(36)}${h2.toString(36)}`;
}

export class AuthImageError extends Error {
  constructor(readonly status: number) {
    super(`AUTH_IMAGE_${status}`);
  }
}

/** Local `file://` URI of the image at `url`, downloaded with the bearer token when not cached yet. */
export function cachedAuthImage(url: string, token: string, owner: string): Promise<string> {
  const dir = `${FileSystem.cacheDirectory}private-img/`;
  const file = `${dir}${hashKey(`${owner}|${url}`)}.img`;
  const running = inflight.get(file);
  if (running) return running;
  const task = (async () => {
    const info = await FileSystem.getInfoAsync(file);
    if (info.exists && (info.size ?? 0) > 0) return file;
    await FileSystem.makeDirectoryAsync(dir, { intermediates: true }).catch(() => undefined);
    const res = await FileSystem.downloadAsync(url, file, { headers: { Authorization: `Bearer ${token}` } });
    if (res.status !== 200) {
      await FileSystem.deleteAsync(file, { idempotent: true }).catch(() => undefined);
      throw new AuthImageError(res.status);
    }
    return file;
  })().finally(() => inflight.delete(file));
  inflight.set(file, task);
  return task;
}

/** `{ uri, headers }` → the same image from an authorised cached download on native (web keeps the source). */
export function useAuthImageSource<T extends { uri: string; headers: { Authorization: string } }>(source: T | null, owner: string | null): { uri: string } | null {
  const [local, setLocal] = useState<{ key: string; uri: string } | null>(null);
  const key = source ? `${owner}|${source.uri}` : '';
  useEffect(() => {
    if (!source || Platform.OS === 'web') return;
    let alive = true;
    const token = source.headers.Authorization.replace(/^Bearer\s+/i, '');
    cachedAuthImage(source.uri, token, owner ?? '')
      .then((uri) => alive && setLocal({ key, uri }))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  if (!source) return null;
  if (Platform.OS === 'web') return source;
  return local?.key === key ? { uri: local.uri } : null;
}
