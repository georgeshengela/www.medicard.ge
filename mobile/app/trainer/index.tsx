import React, { useCallback, useState } from 'react';
import { Alert, RefreshControl, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import {
  BadgeCheck,
  CalendarCheck2,
  Camera,
  ChevronRight,
  Dumbbell,
  KeyRound,
  MapPin,
  Search,
  ShieldCheck,
  Target,
  UtensilsCrossed,
  Award,
} from 'lucide-react-native';
import { api, ApiError } from '@/lib/api';
import { localAccountId } from '@/lib/localAccount';
import { useAuth } from '@/store/AuthContext';
import {
  DAY_STATUS_LABEL,
  GOAL_TYPE_LABEL,
  clockOf,
  dayLabel,
  relativeStart,
  tbilisiYmd,
  type ClientOverview,
  type CoachMe,
  type CoachSession,
} from '@/lib/coach';
import { syncCoachWorkouts } from '@/lib/coachWorkouts';
import { loadWeightLogs, saveWeightGoal } from '@/lib/weightGoal';
import { Avatar, Badge, Button, CTA, Card, Chip, CoachHeader, DayStrip, ErrorBox, IconTile, Loading, Screen, Section, Stat, coachStyles } from '@/components/coach/CoachUI';
import { HUB, hubText } from '@/theme/hub';
import { useThemeColors } from '@/theme/colors';

export default function MyTrainerScreen() {
  const router = useRouter();
  const c = useThemeColors();
  const { healthProfile } = useAuth();
  const [me, setMe] = useState<CoachMe | null>(null);
  const [ov, setOv] = useState<ClientOverview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    const owner = localAccountId();
    try {
      const [m, o] = await Promise.all([api.coach.me(), api.coach.overview()]);
      if (localAccountId() !== owner) return;
      setMe(m);
      setOv(o);
      setError(null);
      if (o.link?.status === 'ACTIVE' && o.link.scopes.workouts) void syncCoachWorkouts();
    } catch (e) {
      if (localAccountId() === owner) setError(e instanceof ApiError ? e.message : 'ჩატვირთვა ვერ მოხერხდა. შეამოწმე ინტერნეტი.');
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const act = async (id: string, fn: () => Promise<unknown>) => {
    setBusy(id);
    try {
      await fn();
      await load();
    } catch (e) {
      Alert.alert('ვერ მოხერხდა', e instanceof ApiError ? e.message : 'სცადე ხელახლა.');
    } finally {
      setBusy(null);
    }
  };

  const acceptGoal = async () => {
    const g = ov?.link?.proposedGoal;
    if (!g) return;
    await act('goal', async () => {
      const logs = await loadWeightLogs();
      const current = logs[0]?.kg ?? healthProfile?.weightKg ?? g.targetKg;
      const weeks = Math.max(1, (Date.parse(g.deadlineYmd) - Date.now()) / (7 * 86400000));
      const pace = Math.round((Math.abs(current - g.targetKg) / weeks) * 100) / 100;
      await saveWeightGoal({
        id: `coach-${Date.now()}`,
        targetKg: g.targetKg,
        startKg: current,
        startedYmd: tbilisiYmd(),
        deadlineYmd: g.deadlineYmd,
        paceKgPerWeek: pace,
        pace: pace <= 0.35 ? 'slow' : pace <= 0.75 ? 'moderate' : 'fast',
        reminderEnabled: false,
        reminderDays: [],
        reminderHour: 8,
        reminderMinute: 0,
      });
      await api.coach.answerGoal('accepted');
    });
  };

  const cancelSession = (s: CoachSession) => {
    const late = new Date(s.startsAt).getTime() - Date.now() < 12 * 3600000;
    Alert.alert('ვარჯიშის გაუქმება', late ? 'ვარჯიშამდე 12 საათზე ნაკლებია — ტრენერი ამას ბოლო წუთის გაუქმებად ნახავს.' : `${s.label} — ტრენერს შეტყობინება მიუვა.`, [
      { text: 'არა', style: 'cancel' },
      { text: 'გაუქმება', style: 'destructive', onPress: () => void act(`cancel-${s.id}`, () => api.coach.cancel(s.id)) },
    ]);
  };

  const book = (s: CoachSession) => {
    Alert.alert('დაჯავშნა', `${s.label} · ${s.kindLabel}${s.gym ? ` · ${s.gym.brand}` : ''}`, [
      { text: 'არა', style: 'cancel' },
      { text: 'დაჯავშნა', onPress: () => void act(`book-${s.id}`, () => api.coach.book(s.id)) },
    ]);
  };

  const link = ov?.link;
  const trainer = ov?.trainer;
  const own = me?.trainerProfile;
  const next = ov?.upcoming?.find((s) => s.status === 'SCHEDULED');

  return (
    <View style={{ flex: 1, backgroundColor: c.bg100 }}>
      <CoachHeader title="ჩემი ტრენერი" subtitle="MEDI COACH" />
      <Screen refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} tintColor={c.primary200} />}>
        {error ? <ErrorBox message={error} onRetry={load} /> : null}
        {!ov && !error ? <Loading /> : null}

        {ov && !link ? (
          <>
            <View style={{ backgroundColor: HUB.spotlightBg, borderRadius: HUB.cardRadius, padding: 22, marginTop: 8, gap: 14 }}>
              <IconTile icon={Dumbbell} ink="teal" />
              <Text style={{ fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 24, lineHeight: 32, color: '#FFFFFF' }}>შენი ტრენერი დარბაზს გარეთაც შენთანაა</Text>
              <Text style={[hubText.body, { color: '#C5DADA', fontSize: 14, lineHeight: 22 }]}>
                ტრენერი ჯავშნებს პირდაპირ აქ გინიშნავს, შეხსენებები თავად მოგივა, კვების გეგმას გიდგენს და ხედავს, როგორ მიდიხარ — მხოლოდ იმას, რასაც შენ გაუზიარებ.
              </Text>
              {[
                ['ჯავშნები და შეხსენებები — ვარჯიშს აღარ გამოტოვებ', CalendarCheck2],
                ['კვების გეგმა და დღიური კონტროლი', UtensilsCrossed],
                ['ვარჯიშები ტელეფონიდან, წონა და ფოტო-პროგრესი', Target],
              ].map(([t, I]) => {
                const Icon = I as typeof Target;
                return (
                  <View key={t as string} style={coachStyles.row}>
                    <Icon size={18} color="#99F6E4" />
                    <Text style={[hubText.body, { color: '#FFFFFF', flex: 1 }]}>{t as string}</Text>
                  </View>
                );
              })}
              <Button label="ტრენერის კოდის შეყვანა" icon={KeyRound} onPress={() => router.push('/trainer/connect' as never)} />
              <Button label="ტრენერის მოძებნა დარბაზით" icon={Search} kind="secondary" onPress={() => router.push('/trainer/search' as never)} />
            </View>
          </>
        ) : null}

        {link?.status === 'REQUESTED' && trainer ? (
          <Section title="მოთხოვნა გაგზავნილია">
            <Card style={{ gap: 12 }}>
              <View style={coachStyles.row}>
                <Avatar avatarId={trainer.avatarId} name={trainer.displayName} verified />
                <View style={{ flex: 1 }}>
                  <Text style={[hubText.cardTitle, { color: c.text100 }]}>{trainer.displayName}</Text>
                  <Text style={[hubText.caption, { color: c.text300 }]}>ტრენერი ნახავს შენს მოთხოვნას და დაგიდასტურებს.</Text>
                </View>
              </View>
              <Button label="მოთხოვნის გაუქმება" kind="secondary" busy={busy === 'unlink'} onPress={() => void act('unlink', () => api.coach.unlink())} />
            </Card>
          </Section>
        ) : null}

        {link?.status === 'ACTIVE' && trainer ? (
          <>
            <Card style={{ marginTop: 8, gap: 12 }} onPress={() => router.push('/trainer/sharing' as never)} accessibilityLabel={`${trainer.displayName}, ტრენერი. გაზიარების პარამეტრები`}>
              <View style={coachStyles.row}>
                <Avatar avatarId={trainer.avatarId} name={trainer.displayName} size={56} verified={trainer.verified} />
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={[hubText.cardTitle, { color: c.text100, fontSize: 17 }]}>{trainer.displayName}</Text>
                  {trainer.gyms[0] ? (
                    <View style={[coachStyles.row, { gap: 4 }]}>
                      <MapPin size={13} color={c.text300} />
                      <Text numberOfLines={1} style={[hubText.caption, { color: c.text300, flex: 1 }]}>{trainer.gyms.map((g) => `${g.brand} ${g.name}`).join(' · ')}</Text>
                    </View>
                  ) : null}
                  <View style={[coachStyles.row, { gap: 6, marginTop: 4 }]}>
                    <ShieldCheck size={13} color={c.primary100} />
                    <Text style={[hubText.small, { color: c.primary100 }]}>რას ხედავს ტრენერი →</Text>
                  </View>
                </View>
              </View>
              <View style={[coachStyles.row, { gap: 8 }]}>
                <Stat label="ჩატარდა" value={String(ov?.stats?.done ?? 0)} />
                <Stat label="გამოტოვა" value={String(ov?.stats?.noShow ?? 0)} />
                <Stat label="კვების დაცვა" value={ov?.nutrition?.score != null ? `${ov.nutrition.score}%` : '—'} />
              </View>
            </Card>

            {link.proposedGoal ? (
              <Section title="ტრენერი მიზანს გთავაზობს">
                <Card style={{ gap: 12 }}>
                  <View style={coachStyles.row}>
                    <IconTile icon={Target} ink="amber" />
                    <View style={{ flex: 1 }}>
                      <Text style={[hubText.cardTitle, { color: c.text100 }]}>
                        {GOAL_TYPE_LABEL[link.proposedGoal.type]}: {link.proposedGoal.targetKg} კგ
                      </Text>
                      <Text style={[hubText.caption, { color: c.text300 }]}>ვადა: {dayLabel(link.proposedGoal.deadlineYmd)} {link.proposedGoal.deadlineYmd.slice(0, 4)}</Text>
                    </View>
                  </View>
                  {link.proposedGoal.note ? <Text style={[hubText.body, { color: c.text200 }]}>„{link.proposedGoal.note}“</Text> : null}
                  <View style={[coachStyles.row, { gap: 10 }]}>
                    <Button label="მიღება" style={{ flex: 1 }} busy={busy === 'goal'} onPress={() => void acceptGoal()} />
                    <Button label="არა" kind="secondary" style={{ flex: 1 }} onPress={() => void act('goal-no', () => api.coach.answerGoal('dismissed'))} />
                  </View>
                </Card>
              </Section>
            ) : null}

            <Section title="შემდეგი ვარჯიში" link={ov?.upcoming?.length ? 'ყველა' : undefined} onLink={() => router.push('/trainer/sessions' as never)}>
              {next ? (
                <View style={{ backgroundColor: HUB.spotlightBg, borderRadius: HUB.cardRadius, padding: HUB.cardPad, gap: 12 }}>
                  <View style={coachStyles.rowBetween}>
                    <Text style={{ fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 28, lineHeight: 36, color: '#FFFFFF' }}>{clockOf(next.startsAt)}</Text>
                    <View style={{ backgroundColor: 'rgba(153,246,228,0.16)', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4 }}>
                      <Text style={[hubText.link, { color: '#99F6E4' }]}>{relativeStart(next.startsAt)}</Text>
                    </View>
                  </View>
                  <Text style={[hubText.body, { color: '#C5DADA', fontSize: 14 }]}>
                    {dayLabel(tbilisiYmd(next.startsAt))} · {next.kindLabel} · {next.durationMin} წთ{next.gym ? ` · ${next.gym.brand} ${next.gym.name}` : ''}
                  </Text>
                  {next.note ? <Text style={[hubText.body, { color: '#FFFFFF' }]}>„{next.note}“</Text> : null}
                  <View style={[coachStyles.row, { gap: 10 }]}>
                    {next.clientConfirmedAt ? (
                      <View style={[coachStyles.row, { gap: 6, flex: 1 }]}>
                        <BadgeCheck size={18} color="#99F6E4" />
                        <Text style={[hubText.link, { color: '#99F6E4' }]}>დადასტურებულია</Text>
                      </View>
                    ) : (
                      <Button label="მოვალ ✓" style={{ flex: 1 }} busy={busy === `c-${next.id}`} onPress={() => void act(`c-${next.id}`, () => api.coach.confirm(next.id))} />
                    )}
                    <Button label="გაუქმება" kind="secondary" style={{ flex: 1 }} onPress={() => cancelSession(next)} />
                  </View>
                </View>
              ) : (
                <Card>
                  <Text style={[hubText.body, { color: c.text200 }]}>დაგეგმილი ვარჯიში ჯერ არ გაქვს. ტრენერი ჩაგწერს, ან აირჩიე თავისუფალი დრო ქვემოთ.</Text>
                </Card>
              )}
            </Section>

            {ov?.openSlots?.length ? (
              <Section title="თავისუფალი დრო ტრენერთან">
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {ov.openSlots.slice(0, 12).map((s) => (
                    <Chip key={s.id} label={`${dayLabel(tbilisiYmd(s.startsAt))} ${clockOf(s.startsAt)}`} onPress={() => book(s)} />
                  ))}
                </View>
              </Section>
            ) : null}

            <Section title="კვების გეგმა" link={ov?.plan ? 'გახსნა' : undefined} onLink={() => router.push('/trainer/plan' as never)}>
              {ov?.plan ? (
                <Card style={{ gap: 12 }} onPress={() => router.push('/trainer/plan' as never)} accessibilityLabel="კვების გეგმის გახსნა">
                  <View style={coachStyles.rowBetween}>
                    <View style={{ flex: 1 }}>
                      <Text style={[hubText.cardTitle, { color: c.text100 }]}>{ov.plan.title}</Text>
                      <Text style={[hubText.caption, { color: c.text300 }]}>
                        {ov.plan.targets.calories} კკალ{ov.plan.targets.protein ? ` · ცილა ${ov.plan.targets.protein} გ` : ''}
                      </Text>
                    </View>
                    <ChevronRight size={18} color={c.text300} />
                  </View>
                  {ov.nutrition?.days ? <DayStrip days={ov.nutrition.days} labels /> : null}
                  {ov.nutrition?.days?.length ? (
                    <Text style={[hubText.small, { color: c.text300 }]}>
                      დღეს: {DAY_STATUS_LABEL[ov.nutrition.days[ov.nutrition.days.length - 1].status]} · {ov.nutrition.days[ov.nutrition.days.length - 1].calories} / {ov.plan.targets.calories} კკალ
                    </Text>
                  ) : null}
                </Card>
              ) : (
                <Card>
                  <Text style={[hubText.body, { color: c.text200 }]}>
                    {link.scopes.nutrition ? 'ტრენერს კვების გეგმა ჯერ არ გამოუგზავნია.' : 'კვება ტრენერს არ უზიარებ — გეგმისთვის ჩართე „კვება“ გაზიარებაში.'}
                  </Text>
                </Card>
              )}
            </Section>
          </>
        ) : null}

        {ov ? (
          <Section title="პროგრესი">
            <Card style={{ gap: 0, paddingVertical: 6 }}>
              {[
                { label: 'ფოტო-პროგრესი: მანამდე / შემდეგ', icon: Camera, href: '/trainer/progress' },
                { label: 'წონა და მიზანი', icon: Target, href: '/health-metrics/weight' },
                ...(link?.status === 'ACTIVE' ? [{ label: 'ვარჯიშების ისტორია', icon: Dumbbell, href: '/trainer/sessions' }] : []),
              ].map((row, i, arr) => (
                <Card key={row.href} onPress={() => router.push(row.href as never)} style={{ paddingHorizontal: 0, paddingVertical: 12, borderBottomWidth: i < arr.length - 1 ? 0.5 : 0, borderColor: c.bg300, borderRadius: 0 }}>
                  <View style={coachStyles.row}>
                    <IconTile icon={row.icon} ink="teal" size={36} />
                    <Text style={[hubText.cardTitle, { color: c.text100, flex: 1 }]}>{row.label}</Text>
                    <ChevronRight size={18} color={c.text300} />
                  </View>
                </Card>
              ))}
            </Card>
          </Section>
        ) : null}

        {ov ? (
          <Section title="ტრენერი ხარ?">
            <Card style={{ gap: 12 }} onPress={() => router.push((own?.status === 'VERIFIED' ? '/coach' : '/trainer/apply') as never)}>
              <View style={coachStyles.row}>
                <IconTile icon={Award} ink="violet" />
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={[hubText.cardTitle, { color: c.text100 }]}>
                    {own?.status === 'VERIFIED' ? 'ტრენერის რეჟიმის გახსნა' : own ? 'ტრენერის განაცხადი' : 'დარეგისტრირდი როგორც ტრენერი'}
                  </Text>
                  <Text style={[hubText.caption, { color: c.text300 }]}>
                    {own?.status === 'VERIFIED'
                      ? 'კალენდარი, კლიენტები, კვების გეგმები'
                      : own?.status === 'PENDING'
                        ? 'განაცხადი განიხილება — დადასტურებისას შეტყობინება მოგივა'
                        : own?.status === 'REJECTED'
                          ? 'განაცხადს დაზუსტება სჭირდება'
                          : 'კალენდარი, კლიენტების მართვა და მათი პროგრესი ერთ ადგილას'}
                  </Text>
                </View>
                {own ? <Badge label={own.status === 'VERIFIED' ? 'დადასტურებული' : own.status === 'PENDING' ? 'განიხილება' : own.status === 'REJECTED' ? 'დასაზუსტებელი' : 'შეჩერებული'} tone={own.status === 'VERIFIED' ? 'ok' : own.status === 'PENDING' ? 'warn' : 'bad'} /> : <ChevronRight size={18} color={c.text300} />}
              </View>
            </Card>
          </Section>
        ) : null}
        {ov ? <View style={{ height: 8 }} /> : null}
        {ov && link?.status === 'ACTIVE' ? (
          <Text style={[hubText.small, { color: c.text300, textAlign: 'center', marginTop: 18 }]}>
            {ov.link?.trainerViewedAt ? `ტრენერმა ბოლოს ნახა ${dayLabel(tbilisiYmd(ov.link.trainerViewedAt))} ${clockOf(ov.link.trainerViewedAt)}` : 'ტრენერს შენი მონაცემები ჯერ არ უნახავს'}
          </Text>
        ) : null}
      </Screen>
    </View>
  );
}

