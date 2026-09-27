import type { ImagePickerAsset } from 'expo-image-picker';
import { PHOTO_MAX_EDGE } from './imageCompress';
import { toUploadableImage } from './imageUpload';

/** Resize locally before consent/upload: 48 MP camera originals need not leave the phone. */
export async function prepareNutritionImage(asset: ImagePickerAsset) {
  try {
    return await toUploadableImage({ uri: asset.uri, fileName: 'meal.jpg', mimeType: asset.mimeType, width: asset.width, height: asset.height }, { maxEdge: PHOTO_MAX_EDGE });
  } catch {
    throw new Error('ფოტოს მომზადება ვერ მოხერხდა. სცადე სხვა ფოტო ან გადაიღე თავიდან.');
  }
}
