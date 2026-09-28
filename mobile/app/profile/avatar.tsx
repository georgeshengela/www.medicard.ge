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
      Alert.alert('ფოტო ვერ აიტვირთა', e instanceof ApiError ? e.message : 'სცადე ხელახლა.');
    } finally {
      setBusy(null);
    }
  };

  const removePhoto = () =>
    Alert.alert('ფოტოს წაშლა', 'დაბრუნდება არჩეული ილუსტრირებული ავატარი.', [
      { text: ka.common.cancel, style: 'cancel' },
      {
        text: 'წაშლა',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.identity.removeAvatar();
            setMyAvatarUrl(null);
          } catch (e) {
            Alert.alert('ვერ წაიშალა', e instanceof ApiError ? e.message : 'სცადე ხელახლა.');
          }
        },
      },
    ]);

  const savePreset = async () => {
    setBusy('preset');
    try {
      await api.healthProfile.update({ extraAnswers: { avatarId: preset } });
      await refreshHealthProfile();
      Alert.alert('შენახულია', photo ? 'ავატარი შეინახა. სანამ ფოტო გაქვს, ის ჩანს პირველ რიგში.' : 'ავატარი განახლდა.');
    } catch (e) {
      Alert.alert('ვერ შეინახა', e instanceof ApiError ? e.message : 'სცადე ხელახლა.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.bg100 }}>
      <CoachHeader title="პროფილის სურათი" />
      <Screen>
        <View style={{ alignItems: 'center', marginTop: 12, gap: 10 }}>
          <View style={{ borderRadius: 70, borderWidth: 4, borderColor: c.accent100 }}>
            <Avatar avatarId={isAvatarId(preset) ? preset : null} photoUrl={photo} name={user?.fullName ?? '?'} size={132} />
          </View>
          <Text style={[hubText.caption, { color: c.text300 }]}>{photo ? 'შენი ფოტო' : 'ილუსტრირებული ავატარი'}</Text>
        </View>
        <View style={[coachStyles.row, { gap: 10, marginTop: 18 }]}>
          <Button label="კამერა" icon={Camera} style={{ flex: 1 }} busy={busy === 'camera'} onPress={() => void pick(true)} />
          <Button label="გალერეა" icon={ImagePlus} kind="secondary" style={{ flex: 1 }} busy={busy === 'gallery'} onPress={() => void pick(false)} />
        </View>
        {photo ? <Button label="ფოტოს წაშლა" icon={Trash2} kind="ghost" onPress={removePhoto} style={{ marginTop: 6 }} /> : null}
        <Card style={{ marginTop: 14 }}>
          <Text style={[hubText.caption, { color: c.text200 }]}>
            ფოტოს ხედავ შენ და შენი ტრენერი (ან კლიენტები, თუ ტრენერი ხარ). დადასტურებული ტრენერის ფოტო ჩანს ტრენერების ძებნაში. ქალების სივრცეში ფოტო არასდროს ჩანს. სერვერზე ფოტოდან იშლება მდებარეობა და სხვა მეტამონაცემები.
          </Text>
        </Card>
        <Section title="ან აირჩიე ავატარი">
          <AvatarCarousel value={preset} onChange={setPreset} avatarIds={avatarsForGender(user?.gender ?? null)} />
          <Button label="ავატარის შენახვა" kind="secondary" busy={busy === 'preset'} onPress={() => void savePreset()} style={{ marginTop: 12 }} />
        </Section>
      </Screen>
    </View>
  );
}
