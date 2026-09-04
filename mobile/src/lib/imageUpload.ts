import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';

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
  return HEIC.test(mime) || HEIC.test(name ?? '');
}

function jpegName(name: string): string {
  const stem = name.replace(/\.[^/.]+$/, '') || `medicard-${Date.now()}`;
  return `${stem}.jpg`;
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
    return { uri: asset.uri, name, mimeType: mime, size };
  }

  if (needsJpegTranscode(mime, name)) {
    try {
      const out = await ImageManipulator.manipulateAsync(asset.uri, [], {
        compress: 0.85,
        format: ImageManipulator.SaveFormat.JPEG,
      });
      return { uri: out.uri, name: jpegName(name), mimeType: 'image/jpeg' };
    } catch {
      return { uri: asset.uri, name: jpegName(name), mimeType: 'image/jpeg', size };
    }
  }

  return { uri: asset.uri, name, mimeType: mime, size };
}
