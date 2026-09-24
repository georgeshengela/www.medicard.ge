import * as ImageManipulator from 'expo-image-manipulator';
import type { ImagePickerAsset } from 'expo-image-picker';
import { toUploadableImage } from './imageUpload';

/** Resize locally before consent/upload: 48 MP camera originals need not leave the phone. */
export async function prepareNutritionImage(asset: ImagePickerAsset) {
  const maxDimension = 1600;
  const actions: ImageManipulator.Action[] = Math.max(asset.width, asset.height) > maxDimension
    ? [{ resize: asset.width >= asset.height ? { width: maxDimension } : { height: maxDimension } }]
    : [];
  try {
    const image = await ImageManipulator.manipulateAsync(asset.uri, actions, {
      compress: 0.82,
      format: ImageManipulator.SaveFormat.JPEG,
    });
    return await toUploadableImage({ uri: image.uri, fileName: 'meal.jpg', mimeType: 'image/jpeg' });
  } catch {
    throw new Error('ფოტოს მომზადება ვერ მოხერხდა. სცადე სხვა ფოტო ან გადაიღე თავიდან.');
  }
}
