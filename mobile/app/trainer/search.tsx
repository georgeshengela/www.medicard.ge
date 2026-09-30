import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronRight, MapPin, Search, X } from 'lucide-react-native';
import { api, ApiError } from '@/lib/api';
import { localAccountId } from '@/lib/localAccount';
import type { GymBrand, TrainerCard } from '@/lib/coach';
import { Avatar, Badge, Card, Chip, CoachHeader, EmptyNote, ErrorBox, Input, Loading, coachStyles } from '@/components/coach/CoachUI';
import { HUB, hubText } from '@/theme/hub';
import { useThemeColors } from '@/theme/colors';
import { EMPTY_ART } from '@/constants/appArt';
import { tx } from '@/i18n/locale';

/** Find a verified trainer by name or by the gym you go to. */
export default function TrainerSearchScreen() {
  const router = useRouter();
  const c = useThemeColors();
  const insets = useSafeAreaInsets();
  const [q, setQ] = useState('');
  const [gymQ, setGymQ] = useState('');
  const [brands, setBrands] = useState<GymBrand[]>([]);
  const [gym, setGym] = useState<{ id: string; label: string } | null>(null);
  const [trainers, setTrainers] = useState<TrainerCard[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pickGym, setPickGym] = useState(false);

  const run = useCallback(async (term: string, gymId: string) => {
    const owner = localAccountId();
    try {
      const res = await api.coach.search(term, gymId);
      if (localAccountId() === owner) {
        setTrainers(res.trainers);
        setError(null);
      }
    } catch (e) {
      setError(e instanceof ApiError ? e.message : tx('ძებნა ვერ მოხერხდა.', 'Search failed.'));
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => void run(q.trim(), gym?.id ?? ''), 250);
    return () => clearTimeout(t);
  }, [q, gym, run]);

  useEffect(() => {
    if (!pickGym) return;
    const t = setTimeout(() => {
      void api.coach.gyms(gymQ.trim()).then((r) => setBrands(r.brands)).catch(() => setBrands([]));
    }, 200);
    return () => clearTimeout(t);
  }, [gymQ, pickGym]);

  const gymRows = useMemo(() => brands.flatMap((b) => b.branches.map((g) => ({ ...g, brandLabel: b.brandKa || b.brand }))).slice(0, 80), [brands]);

  return (
    <View style={{ flex: 1, backgroundColor: c.bg100 }}>
      <CoachHeader title={tx('ტრენერის მოძებნა', 'Find a trainer')} fallback="/trainer" />
      <View style={{ paddingHorizontal: HUB.gutter, gap: 10 }}>
        <View>
          <Input value={q} onChangeText={setQ} placeholder={tx('ტრენერის სახელი ან სპეციალიზაცია', 'Trainer name or specialty')} returnKeyType="search" style={{ paddingLeft: 42 }} />
          <Search size={18} color={c.text300} style={{ position: 'absolute', left: 14, top: 16 }} />
        </View>
        <View style={[coachStyles.row, { gap: 8 }]}>
          <Chip label={gym ? gym.label : tx('დარბაზი: ყველა', 'Gym: all')} selected={Boolean(gym)} onPress={() => setPickGym((v) => !v)} />
          {gym ? (
            <Pressable accessibilityRole="button" accessibilityLabel={tx('დარბაზის ფილტრის მოხსნა', 'Clear gym filter')} onPress={() => setGym(null)} hitSlop={10}>
              <X size={18} color={c.text300} />
            </Pressable>
          ) : null}
        </View>
      </View>

      {pickGym ? (
        <View style={{ flex: 1, paddingHorizontal: HUB.gutter, paddingTop: 10 }}>
          <Input value={gymQ} onChangeText={setGymQ} placeholder={tx('მოძებნე დარბაზი: Oktopus, Aspria, ვაკე…', 'Find a gym: Oktopus, Aspria, Vake…')} autoFocus />
          <FlatList
            data={gymRows}
            keyExtractor={(g) => g.id}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingVertical: 10, paddingBottom: insets.bottom + 24 }}
            renderItem={({ item }) => (
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  setGym({ id: item.id, label: `${item.brand} · ${item.name}` });
                  setPickGym(false);
                }}
                style={[coachStyles.row, { paddingVertical: 12, borderBottomWidth: 0.5, borderColor: c.bg300 }]}
              >
                <MapPin size={16} color={c.primary100} />
                <View style={{ flex: 1 }}>
                  <Text style={[hubText.cardTitle, { color: c.text100 }]}>
                    {item.brand} · {item.name}
                  </Text>
                  <Text style={[hubText.caption, { color: c.text300 }]}>{[item.city, item.district, item.address].filter(Boolean).join(' · ')}</Text>
                </View>
              </Pressable>
            )}
          />
        </View>
      ) : (
        <FlatList
          data={trainers ?? []}
          keyExtractor={(t) => t.id}
          contentContainerStyle={{ paddingHorizontal: HUB.gutter, paddingTop: 14, paddingBottom: insets.bottom + 24, gap: 12 }}
          ListHeaderComponent={error ? <ErrorBox message={error} /> : trainers === null ? <Loading /> : null}
          ListEmptyComponent={
            trainers ? <EmptyNote icon={Search} art={EMPTY_ART.search} title={tx('ტრენერი ვერ მოიძებნა', 'No trainers found')} body={tx('სცადე სხვა დარბაზი ან სახელი. შენს ტრენერს სთხოვე, დარეგისტრირდეს MEDICARD-ში — კოდით პირდაპირ დაუკავშირდები.', 'Try another gym or name. Ask your trainer to sign up on MEDICARD — then you can connect directly with their code.')} /> : null
          }
          renderItem={({ item: t }) => (
            <Card onPress={() => router.push(`/trainer/connect?trainerId=${encodeURIComponent(t.id)}` as never)} accessibilityLabel={tx(`${t.displayName}, ტრენერი`, `${t.displayName}, trainer`)} style={{ gap: 10 }}>
              <View style={coachStyles.row}>
                <Avatar avatarId={t.avatarId} photoUrl={t.avatarUrl} name={t.displayName} size={52} verified={t.verified} />
                <View style={{ flex: 1, gap: 3 }}>
                  <Text style={[hubText.cardTitle, { color: c.text100, fontSize: 16 }]}>{t.displayName}</Text>
                  <Text numberOfLines={1} style={[hubText.caption, { color: c.text300 }]}>{t.gyms.map((g) => `${g.brand} ${g.name}`).join(' · ')}</Text>
                  <View style={[coachStyles.row, { gap: 6, flexWrap: 'wrap' }]}>
                    {t.experienceYears ? <Badge label={tx(`${t.experienceYears} წელი`, `${t.experienceYears} ${t.experienceYears === 1 ? 'yr' : 'yrs'}`)} /> : null}
                    {t.clients ? <Badge label={tx(`${t.clients} კლიენტი MEDICARD-ში`, `${t.clients} ${t.clients === 1 ? 'client' : 'clients'} on MEDICARD`)} tone="brand" /> : null}
                  </View>
                </View>
                <ChevronRight size={18} color={c.text300} />
              </View>
              {t.specialties.length ? <Text style={[hubText.small, { color: c.text200 }]}>{t.specialties.map((s) => s.label).join(' · ')}</Text> : null}
            </Card>
          )}
        />
      )}
    </View>
  );
}
