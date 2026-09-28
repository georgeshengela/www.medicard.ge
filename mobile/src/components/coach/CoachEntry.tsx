import React, { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Award, CalendarCheck2, Camera, ChevronRight, Dumbbell } from 'lucide-react-native';
import { api } from '@/lib/api';
import { localAccountId } from '@/lib/localAccount';
import { clockOf, dayLabel, relativeStart, tbilisiYmd, type ClientOverview, type CoachMe } from '@/lib/coach';
import { HomeSectionHeading } from '@/components/home/HomeSectionHeading';
import { ProfileMenuRow } from '@/components/profile/ProfileMenuRow';
import { HUB, hubText } from '@/theme/hub';
import { useThemeColors } from '@/theme/colors';

type State = { me: CoachMe; overview: ClientOverview | null; at: number; owner: string };
let cache: State | null = null;

/** Light, account-scoped read of the coach state for Home and Profile (cached 60 s). */
function useCoachState() {
  const [state, setState] = useState<State | null>(() => (cache && cache.owner === localAccountId() ? cache : null));
  useFocusEffect(
    useCallback(() => {
      const owner = localAccountId();
      if (!owner) return;
      if (cache && cache.owner === owner && Date.now() - cache.at < 60_000) {
        setState(cache);
        return;
      }
      let alive = true;
      void (async () => {
        try {
          const me = await api.coach.me();
          const overview = me.clientLink?.status === 'ACTIVE' ? await api.coach.overview() : null;
          if (!alive || localAccountId() !== owner) return;
          cache = { me, overview, at: Date.now(), owner };
          setState(cache);
        } catch {
          /* the section simply stays hidden (e.g. feature paused or offline) */
        }
      })();
      return () => {
        alive = false;
      };
    }, []),
  );
  return state && state.owner === localAccountId() ? state : null;
}

/** Home: shows only for people with a trainer (next session) or verified trainers (workspace shortcut). */
export function HomeCoachSection() {
  const router = useRouter();
  const c = useThemeColors();
  const state = useCoachState();
  if (!state) return null;
  const trainer = state.me.trainerProfile?.status === 'VERIFIED';
  const next = state.overview?.upcoming?.find((s) => s.status === 'SCHEDULED');
  if (!trainer && !state.overview?.link) return null;
  return (
    <View style={{ paddingHorizontal: HUB.gutter, marginTop: HUB.sectionGap }}>
      <HomeSectionHeading title={trainer && !state.overview?.link ? 'ტრენერის რეჟიმი' : 'ჩემი ტრენერი'} linkLabel="გახსნა" onLink={() => router.push((trainer && !state.overview?.link ? '/coach' : '/trainer') as never)} />
      {state.overview?.link ? (
        <Pressable accessibilityRole="button" accessibilityLabel={next ? `შემდეგი ვარჯიში ${next.label}` : 'ჩემი ტრენერი'} onPress={() => router.push('/trainer' as never)} style={[s.card, { backgroundColor: HUB.spotlightBg }]}>
          <View style={s.tile}>
            <CalendarCheck2 size={21} color="#99F6E4" />
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={[hubText.cardTitle, { color: '#FFFFFF', fontSize: 16 }]}>{next ? `${dayLabel(tbilisiYmd(next.startsAt))}, ${clockOf(next.startsAt)}` : 'ვარჯიში დაგეგმილი არ არის'}</Text>
            <Text style={[hubText.body, { color: '#C5DADA' }]} numberOfLines={1}>
              {next ? `${new Date(next.startsAt).getTime() - Date.now() < 6 * 3600000 ? `${relativeStart(next.startsAt)} · ` : ''}${next.kindLabel}${next.gym ? ` · ${next.gym.brand}` : ''} · ${state.overview.trainer?.displayName ?? ''}${next.clientConfirmedAt ? ' ✓' : ''}` : state.overview.trainer?.displayName ?? ''}
            </Text>
          </View>
          <ChevronRight size={18} color="#99F6E4" />
        </Pressable>
      ) : null}
      {trainer ? (
        <Pressable accessibilityRole="button" onPress={() => router.push('/coach' as never)} style={[s.card, { backgroundColor: c.surface, marginTop: state.overview?.link ? 10 : 0 }]}>
          <View style={[s.tile, { backgroundColor: c.accent100 }]}>
            <Dumbbell size={21} color={c.primary100} />
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={[hubText.cardTitle, { color: c.text100 }]}>ტრენერის სამუშაო სივრცე</Text>
            <Text style={[hubText.caption, { color: c.text300 }]}>დღის განრიგი, კლიენტები, გეგმები</Text>
          </View>
          <ChevronRight size={18} color={c.text300} />
        </Pressable>
      ) : null}
    </View>
  );
}

/** Profile: "fitness & trainer" block — always visible (entry to link a trainer or become one). */
export function ProfileCoachSection() {
  const router = useRouter();
  const c = useThemeColors();
  const state = useCoachState();
  const own = state?.me.trainerProfile;
  const link = state?.overview?.link ?? (state?.me.clientLink ? { status: state.me.clientLink.status } : null);
  return (
    <View style={{ marginTop: HUB.sectionGap }}>
      <HomeSectionHeading title="ფიტნესი · MEDI COACH" />
      <View style={[s.list, { backgroundColor: c.surface }]}>
        <ProfileMenuRow
          icon={Dumbbell}
          ink="teal"
          label="ჩემი ტრენერი"
          value={link?.status === 'ACTIVE' ? state?.overview?.trainer?.displayName ?? 'დაკავშირებული' : link?.status === 'REQUESTED' ? 'მოთხოვნა გაგზავნილია' : 'დაკავშირება კოდით'}
          onPress={() => router.push('/trainer' as never)}
        />
        <ProfileMenuRow icon={Camera} ink="violet" label="ფოტო-პროგრესი" value="მანამდე / შემდეგ" onPress={() => router.push('/trainer/progress' as never)} />
        <ProfileMenuRow
          icon={Award}
          ink="amber"
          label={own?.status === 'VERIFIED' ? 'ტრენერის რეჟიმი' : 'ტრენერი ხარ?'}
          value={own?.status === 'VERIFIED' ? 'კალენდარი და კლიენტები' : own?.status === 'PENDING' ? 'განაცხადი განიხილება' : own?.status === 'REJECTED' ? 'დაზუსტება სჭირდება' : 'დარეგისტრირდი უფასოდ'}
          onPress={() => router.push((own?.status === 'VERIFIED' ? '/coach' : '/trainer/apply') as never)}
          isLast
        />
      </View>
    </View>
  );
}

/** Forget the cached state (e.g. after linking, so Home refreshes at once). */
export function invalidateCoachEntry() {
  cache = null;
}

const s = StyleSheet.create({
  card: { borderRadius: HUB.cardRadius, padding: HUB.cardPad, flexDirection: 'row', alignItems: 'center', gap: 14 },
  tile: { width: HUB.tile, height: HUB.tile, borderRadius: HUB.tileRadius, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' },
  list: { borderRadius: HUB.cardRadius, paddingHorizontal: HUB.cardPad, paddingVertical: 4 },
});
