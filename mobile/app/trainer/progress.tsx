import React, { useCallback, useMemo, useState } from 'react';
import { Alert, Pressable, Text, View, useWindowDimensions } from 'react-native';
import { useFocusEffect } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { Camera, ImagePlus, Lock } from 'lucide-react-native';
import { ka } from '@/i18n/ka';
import { api, ApiError } from '@/lib/api';
import { localAccountId } from '@/lib/localAccount';
import { IMAGE_PICKER_OPTIONS, toUploadableImage } from '@/lib/imageUpload';
import { loadWeightLogs } from '@/lib/weightGoal';
import { useAuth } from '@/store/AuthContext';
import { POSE_LABEL, beforeAfter, dayLabel, tbilisiYmd, type ClientOverview, type ProgressPhoto } from '@/lib/coach';
import { BeforeAfter } from '@/components/coach/CoachVisuals';
import { Button, Card, Chip, CoachHeader, EmptyNote, ErrorBox, IconTile, Loading, PrivateImage, Screen, Section, coachStyles } from '@/components/coach/CoachUI';
import { HUB, hubText } from '@/theme/hub';
import { useThemeColors } from '@/theme/colors';
import { tx } from '@/i18n/locale';

const POSES: ProgressPhoto['pose'][] = ['FRONT', 'SIDE', 'BACK'];

/**
 * Progress photos: private to the person; the trainer sees them only with the photos scope.
 * Same pose, same light, same place — the compare slider does the rest.
 */
export default function ProgressPhotosScreen() {
  const c = useThemeColors();
  const { width } = useWindowDimensions();
  const { healthProfile } = useAuth();
  const [photos, setPhotos] = useState<ProgressPhoto[] | null>(null);
  const [ov, setOv] = useState<ClientOverview | null>(null);
  const [pose, setPose] = useState<ProgressPhoto['pose']>('FRONT');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const owner = localAccountId();
    try {
      const [p, o] = await Promise.all([api.coach.photos(), api.coach.overview().catch(() => null)]);
      if (localAccountId() !== owner) return;
      setPhotos(p.photos);
      setOv(o);
      setError(null);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : tx('ჩატვირთვა ვერ მოხერხდა.', 'Couldn’t load.'));
    }
  }, []);
  useFocusEffect(useCallback(() => void load(), [load]));

  const add = async (camera: boolean, chosenPose: ProgressPhoto['pose']) => {
    setBusy(true);
    try {
      const permission = camera ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(ka.upload.permissionDenied);
        return;
      }
      const result = camera ? await ImagePicker.launchCameraAsync(IMAGE_PICKER_OPTIONS) : await ImagePicker.launchImageLibraryAsync(IMAGE_PICKER_OPTIONS);
      if (result.canceled || !result.assets[0]) return;
      const file = await toUploadableImage(result.assets[0]);
      const logs = await loadWeightLogs();
      const today = tbilisiYmd();
      const kg = logs.find((l) => l.date === today)?.kg ?? logs[0]?.kg ?? healthProfile?.weightKg ?? null;
      await api.coach.addPhoto(file, { pose: chosenPose, takenOn: today, weightKg: kg != null ? String(kg) : undefined });
      setPose(chosenPose);
      await load();
    } catch (e) {
      Alert.alert(tx('ფოტო ვერ აიტვირთა', 'Photo didn’t upload'), e instanceof ApiError ? e.message : tx('სცადე ხელახლა.', 'Please try again.'));
    } finally {
      setBusy(false);
    }
  };

  const ask = () =>
    Alert.alert(tx(`ფოტო ${POSE_LABEL[pose].toLowerCase()}`, `${POSE_LABEL[pose]} photo`), tx('ყოველთვის ერთნაირად გადაიღე: იგივე ადგილი, იგივე განათება, დილით. რაკურსს ზემოთ ირჩევ.', 'Always take it the same way: same place, same lighting, in the morning. You choose the angle above.'), [
      { text: ka.common.cancel, style: 'cancel' },
      { text: ka.upload.fromCamera, onPress: () => void add(true, pose) },
      { text: ka.upload.fromGallery, onPress: () => void add(false, pose) },
    ]);

  const remove = (p: ProgressPhoto) =>
    Alert.alert(tx('ფოტოს წაშლა', 'Delete photo'), `${POSE_LABEL[p.pose]} · ${p.takenOn}`, [
      { text: ka.common.cancel, style: 'cancel' },
      {
        text: tx('წაშლა', 'Delete'),
        style: 'destructive',
        onPress: async () => {
          try {
            await api.coach.deletePhoto(p.id);
            await load();
          } catch (e) {
            Alert.alert(tx('ვერ წაიშალა', 'Couldn’t delete'), e instanceof ApiError ? e.message : tx('სცადე ხელახლა.', 'Please try again.'));
          }
        },
      },
    ]);

  const pair = useMemo(() => (photos ? beforeAfter(photos, pose) : null), [photos, pose]);
  const byDate = useMemo(() => {
    const m = new Map<string, ProgressPhoto[]>();
    for (const p of photos ?? []) m.set(p.takenOn, [...(m.get(p.takenOn) ?? []), p]);
    return [...m.entries()];
  }, [photos]);
  const thumb = Math.floor((width - HUB.gutter * 2 - 16) / 3);
  const shared = ov?.link?.status === 'ACTIVE' && ov.link.scopes.photos;

  return (
    <View style={{ flex: 1, backgroundColor: c.bg100 }}>
      <CoachHeader title={tx('ფოტო-პროგრესი', 'Photo progress')} subtitle={tx('მანამდე / შემდეგ', 'Before / after')} fallback="/trainer" />
      <Screen>
        {error ? <ErrorBox message={error} onRetry={load} /> : null}
        {!photos && !error ? <Loading /> : null}
        {photos ? (
          <>
            <View style={[coachStyles.row, { gap: 8, marginTop: 8 }]}>
              {POSES.map((p) => (
                <Chip key={p} label={POSE_LABEL[p]} selected={pose === p} onPress={() => setPose(p)} />
              ))}
            </View>
            <View style={{ marginTop: 14 }}>
              {pair ? (
                <BeforeAfter before={pair.before} after={pair.after} height={Math.round((width - HUB.gutter * 2) * 1.25)} />
              ) : (
                <Card>
                  <EmptyNote
                    icon={Camera}
                    title={photos.filter((p) => p.pose === pose).length ? tx('კიდევ ერთი ფოტო და შედარება გამოჩნდება', 'One more photo and the comparison appears') : tx('პირველი ფოტო — შენი „მანამდე“', 'First photo — your “before”')}
                    body={tx('გადაიღე კვირაში ერთხელ, ერთსა და იმავე პოზაში. რამდენიმე კვირაში აქ დაინახავ განსხვავებას, რომელსაც სარკე ვერ გაჩვენებს.', 'Take one a week, in the same pose. In a few weeks you’ll see a difference here that the mirror can’t show you.')}
                  />
                </Card>
              )}
            </View>
            <Button label={tx(`ფოტოს დამატება · ${POSE_LABEL[pose]}`, `Add photo · ${POSE_LABEL[pose]}`)} icon={ImagePlus} busy={busy} onPress={ask} style={{ marginTop: 14 }} />
            <Card style={{ marginTop: 14, gap: 8 }}>
              <View style={coachStyles.row}>
                <IconTile icon={Lock} ink="teal" size={36} />
                <Text style={[hubText.caption, { color: c.text200, flex: 1 }]}>
                  {tx('ფოტოები დაცულად ინახება და მხოლოდ შენ ხედავ.', 'Photos are stored securely and only you can see them.')}{' '}
                  {ov?.link?.status === 'ACTIVE'
                    ? shared
                      ? tx('შენი ტრენერიც ხედავს (გაზიარებაში ჩართულია).', 'Your trainer sees them too (on in sharing).')
                      : tx('ტრენერს არ უჩანს — ჩართე „პროგრეს-ფოტოები“ გაზიარებაში, თუ გინდა.', 'Your trainer can’t see them — turn on “Progress photos” in sharing if you want.')
                    : ''}
                </Text>
              </View>
            </Card>
            {byDate.length ? (
              <Section title={tx('ისტორია', 'History')}>
                {byDate.map(([date, list]) => (
                  <View key={date} style={{ marginBottom: 14 }}>
                    <Text style={[hubText.caption, { color: c.text300, marginBottom: 6 }]}>
                      {dayLabel(date)} · {date}
                      {list.find((p) => p.weightKg)?.weightKg ? ` · ${list.find((p) => p.weightKg)?.weightKg} ${tx('კგ', 'kg')}` : ''}
                    </Text>
                    <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                      {list.map((p) => (
                        <Pressable key={p.id} accessibilityRole="button" accessibilityLabel={tx(`${POSE_LABEL[p.pose]}, ${p.takenOn}. დიდხანს დააჭირე წასაშლელად`, `${POSE_LABEL[p.pose]}, ${p.takenOn}. Long-press to delete`)} onLongPress={() => remove(p)} onPress={() => setPose(p.pose)}>
                          <PrivateImage path={p.url} style={{ width: thumb, height: Math.round(thumb * 1.3), borderRadius: 14 }} label={POSE_LABEL[p.pose]} />
                          <Text style={[hubText.small, { color: c.text300, marginTop: 3 }]}>{POSE_LABEL[p.pose]}</Text>
                        </Pressable>
                      ))}
                    </View>
                  </View>
                ))}
              </Section>
            ) : null}
          </>
        ) : null}
      </Screen>
    </View>
  );
}
