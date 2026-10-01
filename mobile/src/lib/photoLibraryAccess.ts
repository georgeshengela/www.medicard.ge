import { Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';

type Access = { granted: boolean; status: ImagePicker.PermissionStatus };

/**
 * Android picks photos through the system Photo Picker (`launchImageLibraryAsync`), which needs no
 * permission. Google Play forbids READ_MEDIA_IMAGES for occasional picks, so it is blocked in
 * app.json (`android.blockedPermissions`) and must never be requested on Android. iOS is unchanged.
 */
export async function requestPhotoLibraryAccess(): Promise<Access> {
  if (Platform.OS === 'android') return { granted: true, status: ImagePicker.PermissionStatus.GRANTED };
  const result = await ImagePicker.requestMediaLibraryPermissionsAsync();
  return { granted: result.granted, status: result.status };
}

export async function getPhotoLibraryAccess(): Promise<Access> {
  if (Platform.OS === 'android') return { granted: true, status: ImagePicker.PermissionStatus.GRANTED };
  const result = await ImagePicker.getMediaLibraryPermissionsAsync();
  return { granted: result.granted, status: result.status };
}
