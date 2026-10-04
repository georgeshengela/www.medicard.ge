import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ArrowUpRight, Award, BadgeCheck, CalendarCheck2, Camera, ChevronRight, CircleAlert, Clock3, Dumbbell, Maximize2, QrCode, ScanLine, type LucideIcon } from 'lucide-react-native';
import { api } from '@/lib/api';
import { useAccountQuery } from '@/hooks/useAccountQuery';
import { FRESH, invalidate } from '@/lib/queryClient';
import { clockOf, dayLabel, relativeStart, tbilisiYmd, type ClientOverview, type CoachMe } from '@/lib/coach';
import { HomeSectionHeading } from '@/components/home/HomeSectionHeading';
import { Avatar } from '@/components/coach/CoachUI';
import { StyledQr } from '@/components/coach/StyledQr';
import { HUB, hubInk, hubText, hubTint, type HubInk } from '@/theme/hub';
import { useIsDark, useThemeColors } from '@/theme/colors';
import { tx } from '@/i18n/locale';
import { useHomeAccent } from '@/theme/homeAccent';

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

/**
 * Profile shows the MEDICOACH card only to people it concerns — a trainer link (any state) or their own
 * trainer profile; everyone else gets one plain row (owner 2026-10-04). null until the state is read.
 */
export function useProfileCoachVisible(): boolean | null {
  const state = useCoachState();
  if (!state) return null;
  return Boolean(state.me.trainerProfile || state.me.clientLink || state.overview?.link);
}

/**
 * The Home header's MEDICOACH coin (owner 2026-10-03: no Home section for trainer mode, a switch
 * instead): null for everyone but verified trainers; `today` = sessions still ahead today (null until read).
 */
export function useTrainerSwitch(enabled: boolean): { today: number | null } | null {
  const state = useCoachState();
  const verified = enabled && state?.me.trainerProfile?.status === 'VERIFIED';
  const today = useAccountQuery<number>({
    key: ['coach', 'today', 'count'],
    staleTime: FRESH.SHORT,
    enabled: verified,
    fetch: async () => {
      const day = await api.coach.today();
      const now = Date.now();
      return day.sessions.filter((x) => x.status === 'SCHEDULED' && new Date(x.startsAt).getTime() + x.durationMin * 60000 > now).length;
    },
  });
  if (!verified) return null;
  return { today: today.data ?? null };
}

/**
 * Home: shows only for people with a trainer (next session). Verified trainers switch to their
 * workspace from the avatar's MEDICOACH coin in the header (`HomeHeader`), not from a section.
 * `tone="surface"` on Home layouts that already have their one spotlight (active, nutrition & weight).
 */
export function HomeCoachSection({ tone = 'spotlight' }: { tone?: 'spotlight' | 'surface' } = {}) {
  const router = useRouter();
  const c = useThemeColors();
  const accent = useHomeAccent();
  const state = useCoachState();
  const quiet = tone === 'surface';
  if (!state) return null;
  const next = state.overview?.upcoming?.find((s) => s.status === 'SCHEDULED');
  if (!state.overview?.link) return null;
  return (
    <View style={{ paddingHorizontal: HUB.gutter, marginTop: HUB.sectionGap }}>
      <HomeSectionHeading title={tx('ჩემი ტრენერი', 'My trainer')} linkLabel={tx('გახსნა', 'Open')} onLink={() => router.push('/trainer' as never)} />
      {state.overview?.link ? (
        <Pressable accessibilityRole="button" accessibilityLabel={next ? tx(`შემდეგი ვარჯიში ${next.label}`, `Next workout ${next.label}`) : tx('ჩემი ტრენერი', 'My trainer')} onPress={() => router.push('/trainer' as never)} style={[s.card, { backgroundColor: quiet ? c.surface : HUB.spotlightBg }]}>
          <View style={[s.tile, quiet ? { backgroundColor: accent.tint } : null]}>
            <CalendarCheck2 size={21} color={quiet ? accent.ink : '#99F6E4'} />
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={[hubText.cardTitle, { color: quiet ? c.text100 : '#FFFFFF', fontSize: 16 }]}>{next ? `${dayLabel(tbilisiYmd(next.startsAt))}, ${clockOf(next.startsAt)}` : tx('ვარჯიში დაგეგმილი არ არის', 'No workout scheduled')}</Text>
            <Text style={[hubText.body, { color: quiet ? c.text200 : '#C5DADA' }]} numberOfLines={1}>
              {next ? `${new Date(next.startsAt).getTime() - Date.now() < 6 * 3600000 ? `${relativeStart(next.startsAt)} · ` : ''}${next.kindLabel}${next.gym ? ` · ${next.gym.brand}` : ''} · ${state.overview.trainer?.displayName ?? ''}${next.clientConfirmedAt ? ' ✓' : ''}` : state.overview.trainer?.displayName ?? ''}
            </Text>
          </View>
          <ChevronRight size={18} color={quiet ? c.text300 : '#99F6E4'} />
        </Pressable>
      ) : null}
    </View>
  );
}

/** Profile: "fitness & trainer" — one card: a compact spotlight on top, two quiet rows under it. Always visible. */
export function ProfileCoachSection() {
  const router = useRouter();
  const c = useThemeColors();
  const dark = useIsDark();
  const state = useCoachState();
  const extras = useCoachExtras(Boolean(state && !state.overview?.link && !state.me.clientLink));
  const own = state?.me.trainerProfile;
  const link = state?.overview?.link ?? null;
  const trainer = state?.overview?.trainer ?? null;
  const invited = link?.status === 'REQUESTED' && link.initiator === 'TRAINER';
  const next = state?.overview?.upcoming?.find((s) => s.status === 'SCHEDULED');
  const photos = extras.photos;
  const soon = next ? new Date(next.startsAt).getTime() - Date.now() < 6 * 3600000 : false;

  const rows: CoachRowProps[] = [
    {
      title: tx('ფოტო-პროგრესი', 'Photo progress'),
      detail: photos == null ? tx('მანამდე / შემდეგ', 'Before / after') : photos ? tx(`${photos} ფოტო · შედარება`, `${photos} ${photos === 1 ? 'photo' : 'photos'} · compare`) : tx('პირველი ფოტო — შენი „მანამდე“', 'First photo — your “before”'),
      href: '/trainer/progress',
      icon: Camera,
      ink: 'violet',
    },
    own?.status === 'PENDING'
      ? { title: tx('განაცხადი განხილვაშია', 'Application under review'), detail: tx('1–2 სამუშაო დღე · შეტყობინება მოგივა', '1–2 business days · we’ll notify you'), href: '/trainer/apply', icon: Clock3, ink: 'amber' }
      : own?.status === 'REJECTED'
        ? { title: tx('განაცხადს დაზუსტება სჭირდება', 'Your application needs changes'), detail: tx('ნახე კომენტარი და გაასწორე', 'See the comment and fix it'), href: '/trainer/apply', icon: CircleAlert, ink: 'rose' }
        : own?.status === 'VERIFIED'
          ? { title: tx('ტრენერის რეჟიმი', 'Trainer mode'), detail: tx('დადასტურებული · კალენდარი და კლიენტები', 'Verified · calendar and clients'), href: '/coach', icon: BadgeCheck, ink: 'green' }
          : own?.status === 'SUSPENDED'
            ? { title: tx('ტრენერის პროფილი შეჩერებულია', 'Trainer profile suspended'), detail: tx('დაგვიკავშირდი მხარდაჭერაში', 'Contact support'), href: '/trainer/apply', icon: CircleAlert, ink: 'rose' }
            : { title: tx('ტრენერი ხარ?', 'Are you a trainer?'), detail: tx('დარეგისტრირდი — სამუშაო სივრცე უფასოდ', 'Sign up — the workspace is free'), href: '/trainer/apply', icon: Award, ink: 'amber' },
  ];

  const avatar = trainer ? (
    <View style={s.ring}>
      <Avatar avatarId={trainer.avatarId} photoUrl={trainer.avatarUrl} name={trainer.displayName} size={44} verified={trainer.verified} />
    </View>
  ) : null;

  return (
    <View style={{ marginTop: HUB.sectionGap }}>
      <HomeSectionHeading title="MEDICOACH" brand="coach" linkLabel={tx('გახსნა', 'Open')} onLink={() => router.push('/trainer' as never)} />
      <View style={[s.shell, { backgroundColor: c.surface }]}>
        <View style={[s.spot, { backgroundColor: HUB.spotlightBg }]}>
          <Dumbbell size={96} color="rgba(153,246,228,0.06)" strokeWidth={1.4} style={s.watermark} />
          {!state ? (
            <View style={{ height: 96 }} />
          ) : link?.status === 'ACTIVE' && trainer ? (
            <Pressable accessibilityRole="button" accessibilityLabel={tx(`ჩემი ტრენერი ${trainer.displayName}`, `My trainer ${trainer.displayName}`)} onPress={() => router.push('/trainer' as never)} style={{ gap: 12 }}>
              <View style={s.row}>
                {avatar}
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={s.kicker}>{tx('ჩემი ტრენერი', 'My trainer')}</Text>
                  <Text numberOfLines={1} style={s.name}>{trainer.displayName}</Text>
                </View>
                <ChevronRight size={18} color="#99F6E4" />
              </View>
              <View style={s.nextBox}>
                <CalendarCheck2 size={17} color="#99F6E4" />
                <Text numberOfLines={1} style={[s.nextText, { flex: 1 }]}>
                  {next ? `${dayLabel(tbilisiYmd(next.startsAt))}, ${clockOf(next.startsAt)} · ${next.kindLabel}` : tx('ვარჯიში ჯერ არ არის დაგეგმილი', 'No workout scheduled yet')}
                </Text>
                {next ? (
                  <View style={s.pill}>
                    <Text style={s.pillText}>{soon ? relativeStart(next.startsAt) : next.clientConfirmedAt ? tx('დადასტურდა', 'Confirmed') : tx('დაადასტურე', 'Confirm')}</Text>
                  </View>
                ) : null}
              </View>
              <View style={s.stats}>
                <Stat value={String(state.overview?.stats?.done ?? 0)} label={tx('ჩატარდა', 'Done')} />
                <View style={s.divider} />
                <Stat value={state.overview?.nutrition?.score != null ? `${state.overview.nutrition.score}%` : '—'} label={tx('კვების გეგმა', 'Meal plan')} />
                <View style={s.divider} />
                <Stat value={String(state.overview?.openSlots?.length ?? 0)} label={tx('თავისუფ. დრო', 'Open slots')} />
              </View>
            </Pressable>
          ) : invited && trainer ? (
            <View style={s.row}>
              {avatar}
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={s.kicker}>{tx('ტრენერი გიწვევს', 'A trainer invited you')}</Text>
                <Text numberOfLines={1} style={s.name}>{trainer.displayName}</Text>
                <Text numberOfLines={2} style={s.muted}>{tx('სანამ არ მიიღებ, შენს მონაცემებს ვერ ხედავს', 'Until you accept, they can’t see your data')}</Text>
              </View>
              <View style={{ width: 96 }}>
                <SpotButton label={tx('ნახვა', 'Review')} icon={ArrowUpRight} onPress={() => router.push('/trainer/connect?invite=1' as never)} primary />
              </View>
            </View>
          ) : link?.status === 'REQUESTED' && trainer ? (
            <Pressable accessibilityRole="button" onPress={() => router.push('/trainer' as never)} style={s.row}>
              {avatar}
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={s.kicker}>{tx('მოთხოვნა გაგზავნილია', 'Request sent')}</Text>
                <Text numberOfLines={1} style={s.name}>{trainer.displayName}</Text>
                <Text numberOfLines={1} style={s.muted}>{tx('დადასტურებისას შეტყობინება მოგივა', 'We’ll notify you when it’s confirmed')}</Text>
              </View>
              <Clock3 size={18} color="#99F6E4" />
            </Pressable>
          ) : (
            <View style={s.row}>
              <Pressable accessibilityRole="button" accessibilityLabel={tx('ჩემი QR', 'My QR')} onPress={() => router.push('/profile/qr' as never)} style={s.qrBox}>
                {extras.qrLink ? <StyledQr value={extras.qrLink} size={62} /> : <QrCode size={36} color="#0F766E" />}
                <View style={s.qrBadge}>
                  <Maximize2 size={11} color="#FFFFFF" strokeWidth={2.6} />
                </View>
              </Pressable>
              <View style={{ flex: 1, minWidth: 0, gap: 8 }}>
                <View style={{ gap: 2 }}>
                  <Text style={s.title}>{tx('აჩვენე QR დარბაზში', 'Show your QR at the gym')}</Text>
                  <Text numberOfLines={2} style={s.muted}>{tx('ტრენერი ხედავს მხოლოდ იმას, რასაც გაუზიარებ.', 'Your trainer sees only what you share.')}</Text>
                </View>
                <View style={{ flexDirection: 'row' }}>
                  <SpotButton label={tx('სკანირება', 'Scan')} icon={ScanLine} onPress={() => router.push('/trainer/scan' as never)} primary />
                </View>
              </View>
            </View>
          )}
        </View>
        {rows.map((row, index) => (
          <CoachRow key={`${row.href}-${index}`} {...row} divider={index > 0} dark={dark} />
        ))}
      </View>
    </View>
  );
}

type CoachRowProps = { title: string; detail: string; href: string; icon: LucideIcon; ink: HubInk };

function CoachRow({ title, detail, href, icon: Icon, ink, divider, dark }: CoachRowProps & { divider?: boolean; dark: boolean }) {
  const router = useRouter();
  const c = useThemeColors();
  const inkHex = hubInk(ink, dark);
  return (
    <>
      {divider ? <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: c.bg300, marginLeft: 62 }} /> : null}
      <Pressable accessibilityRole="button" accessibilityLabel={`${title}. ${detail}`} onPress={() => router.push(href as never)} style={s.listRow}>
        <View style={[s.listIcon, { backgroundColor: hubTint(inkHex, dark) }]}>
          <Icon size={17} color={inkHex} strokeWidth={2} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text numberOfLines={1} style={[hubText.cardTitle, { fontSize: 14, lineHeight: 20, color: c.text100 }]}>{title}</Text>
          <Text numberOfLines={1} style={[hubText.small, { color: c.text300 }]}>{detail}</Text>
        </View>
        <ChevronRight size={16} color={c.text300} strokeWidth={2} />
      </Pressable>
    </>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <View style={{ flex: 1, alignItems: 'center' }}>
      <Text style={s.statValue}>{value}</Text>
      <Text numberOfLines={1} style={s.statLabel}>{label}</Text>
    </View>
  );
}

function SpotButton({ label, icon: Icon, onPress, primary }: { label: string; icon: typeof QrCode; onPress: () => void; primary?: boolean }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={[s.btn, { backgroundColor: primary ? '#0D9488' : 'rgba(255,255,255,0.1)' }]}>
      <Icon size={15} color="#FFFFFF" />
      <Text numberOfLines={1} style={s.btnText}>{label}</Text>
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
  shell: { borderRadius: HUB.cardRadius, overflow: 'hidden' },
  spot: { padding: 16, overflow: 'hidden' },
  watermark: { position: 'absolute', right: -18, top: -16, transform: [{ rotate: '-28deg' }] },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  ring: { borderRadius: 28, borderWidth: 2, borderColor: 'rgba(153,246,228,0.55)', padding: 2 },
  kicker: { fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 11.5, lineHeight: 16, color: '#99F6E4', letterSpacing: 0.2 },
  name: { fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 16, lineHeight: 22, color: '#FFFFFF' },
  title: { fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 15, lineHeight: 21, color: '#FFFFFF' },
  muted: { fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 12, lineHeight: 17, color: '#C5DADA' },
  nextBox: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: 14, paddingHorizontal: 12, paddingVertical: 10 },
  nextText: { fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 13.5, lineHeight: 19, color: '#FFFFFF' },
  pill: { backgroundColor: 'rgba(153,246,228,0.16)', borderRadius: 10, paddingHorizontal: 9, paddingVertical: 3 },
  pillText: { fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 11.5, color: '#99F6E4' },
  stats: { flexDirection: 'row', alignItems: 'center' },
  divider: { width: StyleSheet.hairlineWidth, height: 24, backgroundColor: 'rgba(255,255,255,0.18)' },
  statValue: { fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 16, lineHeight: 21, color: '#FFFFFF' },
  statLabel: { fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 10.5, lineHeight: 14, color: '#9FB7B7' },
  qrBox: { width: 78, height: 78, borderRadius: 16, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  qrBadge: { position: 'absolute', right: -5, bottom: -5, width: 22, height: 22, borderRadius: 11, backgroundColor: '#0D9488', borderWidth: 2, borderColor: HUB.spotlightBg, alignItems: 'center', justifyContent: 'center' },
  btn: { flex: 1, height: 36, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: 8 },
  btnText: { fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 13, color: '#FFFFFF' },
  listRow: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56, paddingHorizontal: 14, paddingVertical: 9 },
  listIcon: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
});
