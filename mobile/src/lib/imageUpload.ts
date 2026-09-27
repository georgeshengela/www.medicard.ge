import * as FileSystem from 'expo-file-system/legacy';
import * as ImagePicker from 'expo-image-picker';
import { ka } from '@/i18n/ka';
import { DOCUMENT_MAX_EDGE, PHOTO_MAX_EDGE, compressImage, isCompressibleImage } from '@/lib/imageCompress';

/** iPhone Camera Roll defaults to HEIC — the API and vision models want JPEG. */
const HEIC = /heic|heif/i;

export const IMAGE_PICKER_OPTIONS: ImagePicker.ImagePickerOptions = {
  mediaTypes: ['images'],
  quality: 0.85,
  exif: false,
  // Expo 54 defaults to `.current`, which keeps iPhone HEIC and the API rejects it.
  preferredAssetRepresentationMode: ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible,
};

export function normalizeUploadMime(mime?: string | null, name?: string | null): string {
  const raw = String(mime ?? '').toLowerCase().trim();
  const ext = String(name ?? '').split('.').pop()?.toLowerCase() ?? '';
  if (HEIC.test(raw)) return 'image/heic';
  if (raw === 'application/pdf' || ext === 'pdf') return 'application/pdf';
  if (raw === 'image/jpg' || raw === 'image/pjpeg' || ext === 'jpg' || ext === 'jpeg') return 'image/jpeg';
  if (raw === 'image/png' || ext === 'png') return 'image/png';
  if (raw === 'image/webp' || ext === 'webp') return 'image/webp';
  if (raw === 'image/gif' || ext === 'gif') return 'image/gif';
  if (HEIC.test(raw) || HEIC.test(ext)) return 'image/heic';
  if (raw.startsWith('image/')) return raw;
  return 'image/jpeg';
}

export function needsJpegTranscode(mime: string, name?: string | null): boolean {
  return HEIC.test(mime) || HEIC.test(name ?? '') || !['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf'].includes(mime);
}

async function preparedSize(uri: string, fallback?: number): Promise<number | undefined> {
  if (!uri.startsWith('file://')) return fallback;
  try {
    const info = await FileSystem.getInfoAsync(uri);
    return info.exists && 'size' in info ? info.size : fallback;
  } catch { return fallback; }
}

function jpegName(name: string): string {
  const stem = name.replace(/\.[^/.]+$/, '') || `medicard-${Date.now()}`;
  return `${stem}.jpg`;
}

function sanitizeFileName(name: string): string {
  return name.replace(/[^\w.-]+/g, '_') || `medicard-${Date.now()}`;
}

/** RN fetch FormData cannot upload content:// or ph:// — copy into the app cache first. */
export async function asCachedFile(uri: string, destName: string): Promise<string> {
  if (uri.startsWith('file://')) return uri;
  const cache = FileSystem.cacheDirectory;
  if (!cache) return uri;
  const dest = `${cache}upload-${Date.now()}-${sanitizeFileName(destName)}`;
  await FileSystem.copyAsync({ from: uri, to: dest });
  return dest;
}

async function mustCache(uri: string, destName: string): Promise<string> {
  try {
    return await asCachedFile(uri, destName);
  } catch {
    throw new Error(ka.upload.prepareFailed);
  }
}

type PickedAsset = {
  uri: string;
  name?: string | null;
  fileName?: string | null;
  mimeType?: string | null;
  size?: number | null;
  fileSize?: number | null;
  width?: number | null;
  height?: number | null;
};

export type UploadableImage = { uri: string; name: string; mimeType: string; size?: number };

/**
 * Picked photo/PDF → a cached file the API accepts. Photos are re-encoded as JPEG with the long
 * side capped (`maxEdge`, default 1600 px); PDFs pass through. When the encoder is unavailable or
 * fails, the original goes up unchanged — except HEIC, which the API cannot read, so it is refused.
 */
export async function toUploadableImage(asset: PickedAsset, { maxEdge = PHOTO_MAX_EDGE }: { maxEdge?: number } = {}): Promise<UploadableImage> {
  const name = asset.fileName ?? asset.name ?? `medicard-${Date.now()}.jpg`;
  const mime = normalizeUploadMime(asset.mimeType, name);
  const size = asset.size ?? asset.fileSize ?? undefined;
  if (!isCompressibleImage(mime)) {
    const uri = await mustCache(asset.uri, name);
    return { uri, name, mimeType: mime, size: await preparedSize(uri, size) };
  }

  const options = { width: asset.width, height: asset.height, maxEdge };
  let out = await compressImage(asset.uri, options);
  if (!out && !asset.uri.startsWith('file://')) {
    // ph:// / content:// sources sometimes only decode from a cached copy.
    try { out = await compressImage(await asCachedFile(asset.uri, name), options); } catch { out = null; }
  }
  if (out) return { uri: out.uri, name: jpegName(name), mimeType: 'image/jpeg', size: await preparedSize(out.uri) };

  // Relabelling HEIC (or other unsupported) bytes as JPEG doesn't convert the image.
  if (needsJpegTranscode(mime, name)) throw new Error(ka.upload.prepareFailed);
  const uri = await mustCache(asset.uri, name);
  return { uri, name, mimeType: mime, size: await preparedSize(uri, size) };
}

/** Lab sheets are read by the AI: keep printed ranges legible (long side up to 2400 px). */
export async function prepareLabImage(asset: PickedAsset): Promise<UploadableImage> {
  return toUploadableImage(asset, { maxEdge: DOCUMENT_MAX_EDGE });
}
