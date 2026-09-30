import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Camera, Check, ImagePlus, Lock, Trash2, type LucideIcon } from 'lucide-react-native';
import { ka } from '@/i18n/ka';
import { api, ApiError } from '@/lib/api';
import { IMAGE_PICKER_OPTIONS, toUploadableImage } from '@/lib/imageUpload';
import { setMyAvatarUrl, useMyAvatarUrl } from '@/lib/myAvatar';
import { AVATAR_SOURCES, avatarsForGender, isAvatarId, normalizeAvatarForGender, type AvatarId } from '@/constants/avatarAssets';
import { HomeSectionHeading } from '@/components/home/HomeSectionHeading';
import { useAuth } from '@/store/AuthContext';
import { Avatar, CoachHeader, Screen } from '@/components/coach/CoachUI';
import { HUB, hubInk, hubText, hubTint } from '@/theme/hub';
import { useIsDark, useThemeColors } from '@/theme/colors';
import { tx } from '@/i18n/locale';

const COLUMNS = 3;
const GRID_GAP = 14;

/** Soft tinted action tile (camera / gallery). */
function ActionTile({ icon: Icon, label, busy, onPress }: { icon: LucideIcon; label: string; busy?: boolean; onPress: () => void }) {
  const c = useThemeColors();
  const dark = useIsDark();
  const teal = hubInk('teal', dark);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ busy: !!busy }}
      disabled={busy}
      onPress={onPress}
      style={[styles.action, { backgroundColor: hubTint(teal, dark) }]}
    >
      {busy ? <ActivityIndicator color={teal} /> : <Icon size={20} color={teal} strokeWidth={2.2} />}
      <Text style={[styles.actionText, { color: c.text100 }]}>{label}</Text>
    </Pressable>
  );
}

/**
 * Profile picture: your own photo (private; seen by you, your trainer/clients, and — for verified
 * trainers — on the public trainer card) or one of the illustrated avatars. The women's space always
 * keeps its anonymous avatar.
 */
export default function AvatarScreen() {
  const c = useThemeColors();
  const dark = useIsDark();
  const teal = hubInk('teal', dark);
  const { width } = useWindowDimensions();
  const { user, healthProfile, refreshHealthProfile } = useAuth();
  const photo = useMyAvatarUrl();
  const extra = (healthProfile?.extraAnswers ?? {}) as { avatarId?: string };
  const [preset, setPreset] = useState<AvatarId>(normalizeAvatarForGender(extra.avatarId ?? null, user?.gender ?? null));
  const [busy, setBusy] = useState<string | null>(null);
  useEffect(() => {
    setPreset(normalizeAvatarForGender(extra.avatarId ?? null, user?.gender ?? null));
  }, [extra.avatarId, user?.gender]);

  const avatarIds = avatarsForGender(user?.gender ?? null);
  // Card inner width = screen − page gutters − card padding.
  const tile = Math.floor((width - HUB.gutter * 2 - HUB.cardPad * 2 - GRID_GAP * (COLUMNS - 1)) / COLUMNS);

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

  /** Tapping an avatar saves it at once (no separate save button). */
  const savePreset = async (id: AvatarId, dropPhoto = false) => {
    const previous = preset;
    setPreset(id);
    setBusy(`preset:${id}`);
    try {
      if (dropPhoto) {
        await api.identity.removeAvatar();
        setMyAvatarUrl(null);
      }
      await api.healthProfile.update({ extraAnswers: { avatarId: id } });
      await refreshHealthProfile();
    } catch (e) {
      setPreset(previous);
      Alert.alert(tx('ვერ შეინახა', "Couldn't save"), e instanceof ApiError ? e.message : tx('სცადე ხელახლა.', 'Please try again.'));
    } finally {
      setBusy(null);
    }
  };

  const choose = (id: AvatarId) => {
    if (busy) return;
    if (!photo) {
      if (id !== preset) void savePreset(id);
      return;
    }
    // A photo always shows first — offer to switch to the avatar instead.
    Alert.alert(tx('ავატარზე გადასვლა', 'Use this avatar'), tx('შენი ფოტო წაიშლება და მის ნაცვლად ეს ავატარი გამოჩნდება.', 'Your photo will be removed and this avatar shown instead.'), [
      { text: ka.common.cancel, style: 'cancel' },
      { text: tx('გამოყენება', 'Use avatar'), onPress: () => void savePreset(id, true) },
    ]);
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.bg100 }}>
      <CoachHeader title={tx('პროფილის სურათი', 'Profile picture')} />
      <Screen>
        {/* Current picture + photo actions */}
        <View style={[styles.card, { backgroundColor: c.surface, alignItems: 'center', marginTop: 8 }]}>
          <View style={[styles.ring, { borderColor: teal }]}>
            <Avatar avatarId={isAvatarId(preset) ? preset : null} photoUrl={photo} name={user?.fullName ?? '?'} size={112} />
          </View>
          {user?.fullName ? <Text style={[styles.name, { color: c.text100 }]}>{user.fullName}</Text> : null}
          <View style={[styles.sourcePill, { backgroundColor: c.bg100 }]}>
            <Text style={[hubText.small, { color: c.text200 }]}>{photo ? tx('შენი ფოტო', 'Your photo') : tx('ილუსტრირებული ავატარი', 'Illustrated avatar')}</Text>
          </View>

          <View style={styles.actions}>
            <ActionTile icon={Camera} label={tx('გადაღება', 'Take photo')} busy={busy === 'camera'} onPress={() => void pick(true)} />
            <ActionTile icon={ImagePlus} label={tx('გალერეა', 'Gallery')} busy={busy === 'gallery'} onPress={() => void pick(false)} />
          </View>
          {photo ? (
            <Pressable accessibilityRole="button" onPress={removePhoto} hitSlop={8} style={styles.removeRow}>
              <Trash2 size={15} color="#E11D48" strokeWidth={2.2} />
              <Text style={[hubText.link, { color: '#E11D48' }]}>{tx('ფოტოს წაშლა', 'Remove photo')}</Text>
            </Pressable>
          ) : null}
        </View>

        {/* Illustrated avatars */}
        <View style={{ marginTop: HUB.sectionGap }}>
          <HomeSectionHeading title={tx('ან აირჩიე ავატარი', 'Or choose an avatar')} />
          <View style={[styles.card, { backgroundColor: c.surface }]}>
            <View style={styles.grid}>
              {avatarIds.map((id) => {
                const selected = !photo && id === preset;
                const saving = busy === `preset:${id}`;
                return (
                  <Pressable
                    key={id}
                    accessibilityRole="radio"
                    accessibilityState={{ selected }}
                    accessibilityLabel={tx('ავატარი', 'Avatar')}
                    onPress={() => choose(id)}
                    style={{ width: tile, height: tile }}
                  >
                    <View
                      style={[
                        styles.tile,
                        { width: tile, height: tile, borderRadius: tile / 2, borderColor: selected ? teal : 'transparent' },
                      ]}
                    >
                      <Image
                        source={AVATAR_SOURCES[id]}
                        style={{ width: tile - 10, height: tile - 10, borderRadius: (tile - 10) / 2, opacity: photo ? 0.55 : 1 }}
                        accessibilityIgnoresInvertColors
                      />
                    </View>
                    {selected || saving ? (
                      <View style={[styles.check, { backgroundColor: teal, borderColor: c.surface }]}>
                        {saving ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Check size={14} color="#FFFFFF" strokeWidth={3} />}
                      </View>
                    ) : null}
                  </Pressable>
                );
              })}
            </View>
            {photo ? (
              <Text style={[hubText.caption, { color: c.text300, textAlign: 'center', marginTop: 14 }]}>
                {tx('ახლა ფოტო ჩანს. ავატარზე დაჭერით მასზე გადახვალ.', 'Your photo is shown now. Tap an avatar to switch to it.')}
              </Text>
            ) : null}
          </View>
        </View>

        {/* Who sees the photo */}
        <View style={styles.note}>
          <Lock size={14} color={c.text300} strokeWidth={2.2} style={{ marginTop: 2 }} />
          <Text style={[hubText.caption, { color: c.text300, flex: 1 }]}>
            {tx('ფოტოს ხედავ შენ და შენი ტრენერი (ან კლიენტები, თუ ტრენერი ხარ). დადასტურებული ტრენერის ფოტო ჩანს ტრენერების ძებნაში. ქალების სივრცეში ფოტო არასდროს ჩანს. სერვერზე ფოტოდან იშლება მდებარეობა და სხვა მეტამონაცემები.', "Your photo is visible to you and your trainer (or your clients, if you're a trainer). A verified trainer's photo appears in trainer search. Your photo is never shown in the women's space. The server removes location and other metadata from the photo.")}
          </Text>
        </View>
      </Screen>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: HUB.cardRadius,
    padding: HUB.cardPad,
  },
  ring: {
    padding: 4,
    borderRadius: 999,
    borderWidth: 3,
  },
  name: {
    marginTop: 14,
    fontFamily: 'NotoSansGeorgian_700Bold',
    fontSize: 18,
    lineHeight: 25,
    textAlign: 'center',
  },
  sourcePill: {
    marginTop: 6,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 999,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    alignSelf: 'stretch',
    marginTop: 18,
  },
  action: {
    flex: 1,
    minHeight: 76,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
  },
  actionText: {
    fontFamily: 'NotoSansGeorgian_600SemiBold',
    fontSize: 13,
    lineHeight: 18,
  },
  removeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 14,
    paddingVertical: 4,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: GRID_GAP,
  },
  tile: {
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  check: {
    position: 'absolute',
    right: 2,
    bottom: 2,
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  note: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 20,
    paddingHorizontal: 4,
  },
});
