import React, { useEffect, useState } from 'react';
import { Alert, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Camera, ImagePlus, Trash2 } from 'lucide-react-native';
import { ka } from '@/i18n/ka';
import { api, ApiError } from '@/lib/api';
import { IMAGE_PICKER_OPTIONS, toUploadableImage } from '@/lib/imageUpload';
import { setMyAvatarUrl, useMyAvatarUrl } from '@/lib/myAvatar';
import { avatarsForGender, isAvatarId, normalizeAvatarForGender, type AvatarId } from '@/constants/avatarAssets';
import { AvatarCarousel } from '@/components/profile/AvatarCarousel';
import { useAuth } from '@/store/AuthContext';
import { Avatar, Button, Card, CoachHeader, Screen, Section, coachStyles } from '@/components/coach/CoachUI';
import { hubText } from '@/theme/hub';
import { useThemeColors } from '@/theme/colors';
import { tx } from '@/i18n/locale';

/**
 * Profile picture: your own photo (private; seen by you, your trainer/clients, and — for verified
 * trainers — on the public trainer card) or one of the illustrated avatars. The women's space always
 * keeps its anonymous avatar.
 */
export default function AvatarScreen() {
  const c = useThemeColors();
  const { user, healthProfile, refreshHealthProfile } = useAuth();
  const photo = useMyAvatarUrl();
  const extra = (healthProfile?.extraAnswers ?? {}) as { avatarId?: string };
  const [preset, setPreset] = useState<AvatarId>(normalizeAvatarForGender(extra.avatarId ?? null, user?.gender ?? null));
  const [busy, setBusy] = useState<string | null>(null);
  useEffect(() => {
    setPreset(normalizeAvatarForGender(extra.avatarId ?? null, user?.gender ?? null));
  }, [extra.avatarId, user?.gender]);

  const pick = async (camera: boolean) => {
    setBusy(camera ? 'camera' : 'gallery');
    try {
      const permission = camera ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) return Alert.alert(ka.upload.permissionDenied);
      const opts = { ...IMAGE_PICKER_OPTIONS, allowsEditing: true, aspect: [1, 1] as [number, number] };
      const result = camera ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
      if (result.canceled || !result.assets[0]) return;
      const file = await toUploadableImage(result.assets[0], { maxEdge: 1024 });
      const res = await api.identity.uploadAvatar(file);
      setMyAvatarUrl(res.avatarUrl);
    } catch (e) {
      Alert.alert(tx('ფოტო ვერ აიტვირთა', "Couldn't upload the photo"), e instanceof ApiError ? e.message : tx('სცადე ხელახლა.', 'Please try again.'));
    } finally {
      setBusy(null);
    }
  };

  const removePhoto = () =>
    Alert.alert(tx('ფოტოს წაშლა', 'Remove photo'), tx('დაბრუნდება არჩეული ილუსტრირებული ავატარი.', 'Your chosen illustrated avatar will be shown again.'), [
      { text: ka.common.cancel, style: 'cancel' },
      {
        text: tx('წაშლა', 'Remove'),
        style: 'destructive',
        onPress: async () => {
          try {
            await api.identity.removeAvatar();
            setMyAvatarUrl(null);
          } catch (e) {
            Alert.alert(tx('ვერ წაიშალა', "Couldn't remove it"), e instanceof ApiError ? e.message : tx('სცადე ხელახლა.', 'Please try again.'));
          }
        },
      },
    ]);

  const savePreset = async () => {
    setBusy('preset');
    try {
      await api.healthProfile.update({ extraAnswers: { avatarId: preset } });
      await refreshHealthProfile();
      Alert.alert(tx('შენახულია', 'Saved'), photo ? tx('ავატარი შეინახა. სანამ ფოტო გაქვს, ის ჩანს პირველ რიგში.', 'Avatar saved. While you have a photo, the photo is shown first.') : tx('ავატარი განახლდა.', 'Avatar updated.'));
    } catch (e) {
      Alert.alert(tx('ვერ შეინახა', "Couldn't save"), e instanceof ApiError ? e.message : tx('სცადე ხელახლა.', 'Please try again.'));
    } finally {
      setBusy(null);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.bg100 }}>
      <CoachHeader title={tx('პროფილის სურათი', 'Profile picture')} />
      <Screen>
        <View style={{ alignItems: 'center', marginTop: 12, gap: 10 }}>
          <View style={{ borderRadius: 70, borderWidth: 4, borderColor: c.accent100 }}>
            <Avatar avatarId={isAvatarId(preset) ? preset : null} photoUrl={photo} name={user?.fullName ?? '?'} size={132} />
          </View>
          <Text style={[hubText.caption, { color: c.text300 }]}>{photo ? tx('შენი ფოტო', 'Your photo') : tx('ილუსტრირებული ავატარი', 'Illustrated avatar')}</Text>
        </View>
        <View style={[coachStyles.row, { gap: 10, marginTop: 18 }]}>
          <Button label={tx('კამერა', 'Camera')} icon={Camera} style={{ flex: 1 }} busy={busy === 'camera'} onPress={() => void pick(true)} />
          <Button label={tx('გალერეა', 'Gallery')} icon={ImagePlus} kind="secondary" style={{ flex: 1 }} busy={busy === 'gallery'} onPress={() => void pick(false)} />
        </View>
        {photo ? <Button label={tx('ფოტოს წაშლა', 'Remove photo')} icon={Trash2} kind="ghost" onPress={removePhoto} style={{ marginTop: 6 }} /> : null}
        <Card style={{ marginTop: 14 }}>
          <Text style={[hubText.caption, { color: c.text200 }]}>
            {tx('ფოტოს ხედავ შენ და შენი ტრენერი (ან კლიენტები, თუ ტრენერი ხარ). დადასტურებული ტრენერის ფოტო ჩანს ტრენერების ძებნაში. ქალების სივრცეში ფოტო არასდროს ჩანს. სერვერზე ფოტოდან იშლება მდებარეობა და სხვა მეტამონაცემები.', "Your photo is visible to you and your trainer (or your clients, if you're a trainer). A verified trainer's photo appears in trainer search. Your photo is never shown in the women's space. The server removes location and other metadata from the photo.")}
          </Text>
        </Card>
        <Section title={tx('ან აირჩიე ავატარი', 'Or choose an avatar')}>
          <AvatarCarousel value={preset} onChange={setPreset} avatarIds={avatarsForGender(user?.gender ?? null)} />
          <Button label={tx('ავატარის შენახვა', 'Save avatar')} kind="secondary" busy={busy === 'preset'} onPress={() => void savePreset()} style={{ marginTop: 12 }} />
        </Section>
      </Screen>
    </View>
  );
}
