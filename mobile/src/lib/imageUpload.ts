import * as FileSystem from 'expo-file-system/legacy';
import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { ka } from '@/i18n/ka';

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

export async function toUploadableImage(asset: {
  uri: string;
  name?: string | null;
  fileName?: string | null;
  mimeType?: string | null;
  size?: number | null;
  fileSize?: number | null;
}): Promise<{ uri: string; name: string; mimeType: string; size?: number }> {
  const name = asset.fileName ?? asset.name ?? `medicard-${Date.now()}.jpg`;
  const mime = normalizeUploadMime(asset.mimeType, name);
  const size = asset.size ?? asset.fileSize ?? undefined;
  if (mime === 'application/pdf') {
    const uri = await mustCache(asset.uri, name);
    return { uri, name, mimeType: mime, size: await preparedSize(uri, size) };
  }

  if (needsJpegTranscode(mime, name)) {
    try {
      const out = await ImageManipulator.manipulateAsync(asset.uri, [], {
        compress: 0.85,
        format: ImageManipulator.SaveFormat.JPEG,
      });
      return { uri: out.uri, name: jpegName(name), mimeType: 'image/jpeg', size: await preparedSize(out.uri) };
    } catch {
      // Relabelling HEIC bytes as JPEG doesn't convert the image.
      throw new Error(ka.upload.prepareFailed);
    }
  }

  const uri = await mustCache(asset.uri, name);
  return { uri, name, mimeType: mime, size: await preparedSize(uri, size) };
}

/** Shrink lab sheets so OpenRouter can read the printed range without a huge upload. */
export async function prepareLabImage(asset: {
  uri: string;
  name?: string | null;
  fileName?: string | null;
  mimeType?: string | null;
  size?: number | null;
  fileSize?: number | null;
}): Promise<{ uri: string; name: string; mimeType: string; size?: number }> {
  const file = await toUploadableImage(asset);
  if (file.mimeType === 'application/pdf') return file;
  try {
    const out = await ImageManipulator.manipulateAsync(file.uri, [{ resize: { width: 1600 } }], {
      compress: 0.72,
      format: ImageManipulator.SaveFormat.JPEG,
    });
    return { uri: out.uri, name: jpegName(file.name), mimeType: 'image/jpeg', size: await preparedSize(out.uri) };
  } catch {
    try {
      const copied = await asCachedFile(file.uri, jpegName(file.name));
      const out = await ImageManipulator.manipulateAsync(copied, [{ resize: { width: 1600 } }], {
        compress: 0.72,
        format: ImageManipulator.SaveFormat.JPEG,
      });
      return { uri: out.uri, name: jpegName(file.name), mimeType: 'image/jpeg', size: await preparedSize(out.uri) };
    } catch {
      return file;
    }
  }
}
