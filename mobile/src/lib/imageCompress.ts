/**
 * One place that shrinks photos before they leave the phone (2026-09-28).
 * Camera originals (12–48 MP, multi-MB PNG screenshots) are re-encoded as JPEG with the
 * long side capped: 1600 px for ordinary photos (pets, skin, meals, posts) and 2400 px for
 * documents the AI must read (lab sheets, imaging reports). PDFs are never touched.
 *
 * The sizing math is pure and unit-tested; the native module is loaded lazily so a build
 * without it (or any encoder failure) falls back to the original file instead of crashing.
 */
import type * as ImageManipulatorTypes from 'expo-image-manipulator';

export const PHOTO_MAX_EDGE = 1600;
export const DOCUMENT_MAX_EDGE = 2400;
export const UPLOAD_JPEG_QUALITY = 0.8;

export type Size = { width: number; height: number };

function positive(n: unknown): n is number {
  return typeof n === 'number' && Number.isFinite(n) && n > 0;
}

/** Target size with the long side at most `maxEdge`, aspect kept; null when no resize is needed or the size is unknown. */
export function fitWithin(width: number | null | undefined, height: number | null | undefined, maxEdge: number): Size | null {
  if (!positive(width) || !positive(height) || !positive(maxEdge)) return null;
  const long = Math.max(width, height);
  if (long <= maxEdge) return null;
  const scale = maxEdge / long;
  return width >= height
    ? { width: Math.round(maxEdge), height: Math.max(1, Math.round(height * scale)) }
    : { width: Math.max(1, Math.round(width * scale)), height: Math.round(maxEdge) };
}

/** Single-dimension resize action (the other side follows the aspect ratio); null when none is needed. */
export function resizeActionFor(width: number | null | undefined, height: number | null | undefined, maxEdge: number): { width: number } | { height: number } | null {
  const target = fitWithin(width, height, maxEdge);
  if (!target) return null;
  return (width as number) >= (height as number) ? { width: target.width } : { height: target.height };
}

/** PDFs (and anything that is not an image) go up untouched. */
export function isCompressibleImage(mimeType: string | null | undefined): boolean {
  const mime = String(mimeType ?? '').toLowerCase();
  return mime.startsWith('image/');
}

type Manipulator = typeof ImageManipulatorTypes;
let cached: Manipulator | null | undefined;

function manipulator(): Manipulator | null {
  if (cached !== undefined) return cached;
  try {
    const mod = require('expo-image-manipulator') as Manipulator;
    cached = mod && typeof mod.manipulateAsync === 'function' ? mod : null;
  } catch {
    cached = null;
  }
  return cached;
}

export type CompressedImage = { uri: string; width?: number; height?: number };

/**
 * Re-encode as JPEG with the long side capped at `maxEdge`. Returns null when the native
 * module is missing or encoding fails — the caller decides whether the original may go up.
 */
export async function compressImage(
  uri: string,
  { width, height, maxEdge = PHOTO_MAX_EDGE, quality = UPLOAD_JPEG_QUALITY }: { width?: number | null; height?: number | null; maxEdge?: number; quality?: number } = {},
): Promise<CompressedImage | null> {
  const mod = manipulator();
  if (!mod) return null;
  const save = { compress: quality, format: mod.SaveFormat.JPEG };
  try {
    const known = positive(width) && positive(height);
    const resize = known ? resizeActionFor(width, height, maxEdge) : null;
    const out = await mod.manipulateAsync(uri, resize ? [{ resize }] : [], save);
    if (!out?.uri) return null;
    // Size unknown up front (e.g. a document picker image): check what came out and shrink once more.
    const second = known ? null : resizeActionFor(out.width, out.height, maxEdge);
    if (second) {
      const smaller = await mod.manipulateAsync(out.uri, [{ resize: second }], save);
      if (smaller?.uri) return { uri: smaller.uri, width: smaller.width, height: smaller.height };
    }
    return { uri: out.uri, width: out.width, height: out.height };
  } catch {
    return null;
  }
}
