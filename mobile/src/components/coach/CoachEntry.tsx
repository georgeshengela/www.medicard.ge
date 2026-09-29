import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ArrowUpRight, Award, BadgeCheck, CalendarCheck2, Camera, ChevronRight, CircleAlert, Clock3, Dumbbell, QrCode, ScanLine } from 'lucide-react-native';
import { api } from '@/lib/api';
import { useAccountQuery } from '@/hooks/useAccountQuery';
import { FRESH, invalidate } from '@/lib/queryClient';
import { clockOf, dayLabel, relativeStart, tbilisiYmd, type ClientOverview, type CoachMe } from '@/lib/coach';
import { HomeSectionHeading } from '@/components/home/HomeSectionHeading';
import { HubTileGrid, type HubTile } from '@/components/home/HubTiles';
import { Avatar } from '@/components/coach/CoachUI';
import { StyledQr } from '@/components/coach/StyledQr';
import { HUB, hubText } from '@/theme/hub';
import { useThemeColors } from '@/theme/colors';

type State = { me: CoachMe; overview: ClientOverview | null };

/** Light, account-scoped read of the coach state for Home and Profile (cached app-wide, fresh 5 min). */
function useCoachState(): State | null {
  const query = useAccountQuery<State>({
    key: ['coach', 'state'],
    staleTime: FRESH.LONG,
    fetch: async () => {
      const me = await api.coach.me();
      const overview = me.clientLink?.status === 'ACTIVE' ? await api.coach.overview() : null;
      return { me, overview };
    },
  });
  // A failed read keeps the section hidden (e.g. feature paused or offline).
  return query.data ?? null;
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

/** Profile: "fitness & trainer" — the page's one spotlight card, then two tiles. Always visible. */
export function ProfileCoachSection() {
  const router = useRouter();
  const state = useCoachState();
  const extras = useCoachExtras(Boolean(state && !state.overview?.link && !state.me.clientLink));
  const own = state?.me.trainerProfile;
  const link = state?.overview?.link ?? null;
  const trainer = state?.overview?.trainer ?? null;
  const invited = link?.status === 'REQUESTED' && link.initiator === 'TRAINER';
  const next = state?.overview?.upcoming?.find((s) => s.status === 'SCHEDULED');
  const photos = extras.photos;
  const tiles: HubTile[] = [
    {
      key: 'photos',
      title: 'ფოტო-პროგრესი',
      detail: photos == null ? 'მანამდე / შემდეგ' : photos ? `${photos} ფოტო · შედარება` : 'პირველი ფოტო — შენი „მანამდე“',
      href: '/trainer/progress',
      icon: Camera,
      ink: 'violet',
    },
    own?.status === 'PENDING'
      ? { key: 'trainer', title: 'განაცხადი განხილვაშია', detail: '1–2 სამუშაო დღე · შეტყობინება მოგივა', href: '/trainer/apply', icon: Clock3, ink: 'amber' }
      : own?.status === 'REJECTED'
        ? { key: 'trainer', title: 'განაცხადს დაზუსტება სჭირდება', detail: 'ნახე კომენტარი და გაასწორე', href: '/trainer/apply', icon: CircleAlert, ink: 'rose' }
        : own?.status === 'VERIFIED'
          ? { key: 'trainer', title: 'ტრენერის რეჟიმი', detail: 'დადასტურებული · კალენდარი და კლიენტები', href: '/coach', icon: BadgeCheck, ink: 'green' }
          : own?.status === 'SUSPENDED'
            ? { key: 'trainer', title: 'ტრენერის პროფილი შეჩერებულია', detail: 'დაგვიკავშირდი მხარდაჭერაში', href: '/trainer/apply', icon: CircleAlert, ink: 'rose' }
            : { key: 'trainer', title: 'ტრენერი ხარ?', detail: 'დარეგისტრირდი — სამუშაო სივრცე უფასოდ', href: '/trainer/apply', icon: Award, ink: 'amber' },
  ];

  return (
    <View style={{ marginTop: HUB.sectionGap }}>
      <HomeSectionHeading title="ფიტნესი · MEDI COACH" linkLabel="გახსნა" onLink={() => router.push('/trainer' as never)} />
      <View style={[s.spot, { backgroundColor: HUB.spotlightBg }]}>
        <Dumbbell size={132} color="rgba(153,246,228,0.06)" strokeWidth={1.4} style={s.watermark} />
        {!state ? (
          <View style={{ height: 150 }} />
        ) : link?.status === 'ACTIVE' && trainer ? (
          <Pressable accessibilityRole="button" accessibilityLabel={`ჩემი ტრენერი ${trainer.displayName}`} onPress={() => router.push('/trainer' as never)} style={{ gap: 16 }}>
            <View style={s.row}>
              <View style={s.ring}>
                <Avatar avatarId={trainer.avatarId} photoUrl={trainer.avatarUrl} name={trainer.displayName} size={52} verified={trainer.verified} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={s.kicker}>ჩემი ტრენერი</Text>
                <Text numberOfLines={1} style={s.name}>{trainer.displayName}</Text>
                {trainer.gyms[0] ? <Text numberOfLines={1} style={s.muted}>{trainer.gyms[0].brand} · {trainer.gyms[0].name}</Text> : null}
              </View>
              <ChevronRight size={20} color="#99F6E4" />
            </View>
            <View style={s.nextBox}>
              <CalendarCheck2 size={20} color="#99F6E4" />
              <View style={{ flex: 1 }}>
                <Text style={s.muted}>{next ? `შემდეგი ვარჯიში · ${next.kindLabel}` : 'შემდეგი ვარჯიში'}</Text>
                <Text style={next ? s.big : [s.big, { fontSize: 16, lineHeight: 22 }]}>{next ? `${dayLabel(tbilisiYmd(next.startsAt))}, ${clockOf(next.startsAt)}` : 'ჯერ არ არის დაგეგმილი'}</Text>
              </View>
              {next ? (
                <View style={s.pill}>
                  <Text style={s.pillText}>{new Date(next.startsAt).getTime() - Date.now() < 6 * 3600000 ? relativeStart(next.startsAt) : next.clientConfirmedAt ? 'დადასტურდა' : 'დაადასტურე'}</Text>
                </View>
              ) : null}
            </View>
            <View style={s.stats}>
              <Stat value={String(state.overview?.stats?.done ?? 0)} label="ჩატარდა" />
              <View style={s.divider} />
              <Stat value={state.overview?.nutrition?.score != null ? `${state.overview.nutrition.score}%` : '—'} label="კვების გეგმა" />
              <View style={s.divider} />
              <Stat value={String(state.overview?.openSlots?.length ?? 0)} label="თავისუფ. დრო" />
            </View>
          </Pressable>
        ) : invited && trainer ? (
          <View style={{ gap: 14 }}>
            <View style={s.row}>
              <View style={s.ring}>
                <Avatar avatarId={trainer.avatarId} photoUrl={trainer.avatarUrl} name={trainer.displayName} size={52} verified={trainer.verified} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.kicker}>ტრენერი გიწვევს</Text>
                <Text numberOfLines={1} style={s.name}>{trainer.displayName}</Text>
                <Text style={s.muted}>სანამ არ მიიღებ, შენს მონაცემებს ვერ ხედავს</Text>
              </View>
            </View>
            <SpotButton label="ნახვა და მიღება" icon={ArrowUpRight} onPress={() => router.push('/trainer/connect?invite=1' as never)} primary />
          </View>
        ) : link?.status === 'REQUESTED' && trainer ? (
          <Pressable accessibilityRole="button" onPress={() => router.push('/trainer' as never)} style={s.row}>
            <View style={s.ring}>
              <Avatar avatarId={trainer.avatarId} photoUrl={trainer.avatarUrl} name={trainer.displayName} size={52} verified={trainer.verified} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.kicker}>მოთხოვნა გაგზავნილია</Text>
              <Text numberOfLines={1} style={s.name}>{trainer.displayName}</Text>
              <Text style={s.muted}>დადასტურებისას შეტყობინება მოგივა</Text>
            </View>
          </Pressable>
        ) : (
          <View style={{ gap: 16 }}>
            <View style={[s.row, { alignItems: 'flex-start' }]}>
              <View style={{ flex: 1, gap: 6 }}>
                <Text style={s.kicker}>ტრენერი შენს ტელეფონში</Text>
                <Text style={s.title}>აჩვენე QR დარბაზში</Text>
                <Text style={s.muted}>ტრენერი დაასკანერებს — ჯავშნები, კვების გეგმა და პროგრესი აქ დაგხვდება. ხედავს მხოლოდ იმას, რასაც გაუზიარებ.</Text>
              </View>
              <Pressable accessibilityRole="button" accessibilityLabel="ჩემი QR" onPress={() => router.push('/profile/qr' as never)} style={s.qrBox}>
                {extras.qrLink ? <StyledQr value={extras.qrLink} size={84} /> : <QrCode size={48} color="#0F766E" />}
              </Pressable>
            </View>
            <View style={[s.row, { gap: 10 }]}>
              <SpotButton label="ჩემი QR" icon={QrCode} onPress={() => router.push('/profile/qr' as never)} primary />
              <SpotButton label="სკანირება" icon={ScanLine} onPress={() => router.push('/trainer/scan' as never)} />
            </View>
          </View>
        )}
      </View>
      <View style={{ marginTop: 12 }}>
        <HubTileGrid tiles={tiles} />
      </View>
    </View>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <View style={{ flex: 1, alignItems: 'center', gap: 2 }}>
      <Text style={s.statValue}>{value}</Text>
      <Text numberOfLines={1} style={s.statLabel}>{label}</Text>
    </View>
  );
}

function SpotButton({ label, icon: Icon, onPress, primary }: { label: string; icon: typeof QrCode; onPress: () => void; primary?: boolean }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={[s.btn, { backgroundColor: primary ? '#0D9488' : 'rgba(255,255,255,0.1)' }]}>
      <Icon size={18} color="#FFFFFF" />
      <Text style={[s.btnText, { color: '#FFFFFF' }]}>{label}</Text>
    </Pressable>
  );
}

/** Photo count and (when not linked) the person's own QR for the card preview. */
function useCoachExtras(wantQr: boolean) {
  const photos = useAccountQuery<number>({
    key: ['coach', 'photos'],
    staleTime: FRESH.LONG,
    fetch: async () => (await api.coach.photos()).photos.length,
  });
  const qr = useAccountQuery<string>({
    key: ['identity', 'qr'],
    staleTime: FRESH.LONG,
    enabled: wantQr,
    fetch: async () => (await api.identity.qr()).link,
  });
  return { photos: photos.data ?? null, qrLink: wantQr ? (qr.data ?? null) : null };
}

/** Forget the cached state (e.g. after linking, so Home refreshes at once). */
export function invalidateCoachEntry() {
  void invalidate('coach');
}

const s = StyleSheet.create({
  card: { borderRadius: HUB.cardRadius, padding: HUB.cardPad, flexDirection: 'row', alignItems: 'center', gap: 14 },
  tile: { width: HUB.tile, height: HUB.tile, borderRadius: HUB.tileRadius, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' },
  spot: { borderRadius: HUB.cardRadius, padding: 20, overflow: 'hidden' },
  watermark: { position: 'absolute', right: -26, top: -22, transform: [{ rotate: '-28deg' }] },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  ring: { borderRadius: 32, borderWidth: 2, borderColor: 'rgba(153,246,228,0.55)', padding: 2 },
  kicker: { fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 12, lineHeight: 17, color: '#99F6E4', letterSpacing: 0.2 },
  name: { fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 18, lineHeight: 25, color: '#FFFFFF' },
  title: { fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 19, lineHeight: 26, color: '#FFFFFF' },
  muted: { fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 12.5, lineHeight: 19, color: '#C5DADA' },
  big: { fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 20, lineHeight: 27, color: '#FFFFFF' },
  nextBox: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: 16, padding: 14 },
  pill: { backgroundColor: 'rgba(153,246,228,0.16)', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4 },
  pillText: { fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 12, color: '#99F6E4' },
  stats: { flexDirection: 'row', alignItems: 'center' },
  divider: { width: StyleSheet.hairlineWidth, height: 28, backgroundColor: 'rgba(255,255,255,0.18)' },
  statValue: { fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 18, lineHeight: 24, color: '#FFFFFF' },
  statLabel: { fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 11, lineHeight: 15, color: '#9FB7B7' },
  qrBox: { width: 100, height: 100, borderRadius: 18, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  btn: { flex: 1, minHeight: 48, borderRadius: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 10 },
  btnText: { fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 14 },
});
