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
  QrCode,
  ScanLine,
  MapPin,
  Search,
  ShieldCheck,
  Target,
  UtensilsCrossed,
  Award,
} from 'lucide-react-native';
import { api, ApiError } from '@/lib/api';
import { localAccountId } from '@/lib/localAccount';
import { isHrefAvailable, useFeatureState } from '@/lib/featureFlags';
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
import { confirmAction } from '@/lib/confirmAction';
import { loadWeightLogs, saveWeightGoal } from '@/lib/weightGoal';
import { Avatar, Badge, Button, CTA, Card, Chip, CoachHeader, DayStrip, ErrorBox, IconTile, Loading, Screen, Section, Stat, coachStyles } from '@/components/coach/CoachUI';
import { HUB, hubText } from '@/theme/hub';
import { useThemeColors } from '@/theme/colors';
import { tx } from '@/i18n/locale';

export default function MyTrainerScreen() {
  const router = useRouter();
  const c = useThemeColors();
  const features = useFeatureState();
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
      if (localAccountId() === owner) setError(e instanceof ApiError ? e.message : tx('ჩატვირთვა ვერ მოხერხდა. შეამოწმე ინტერნეტი.', 'Couldn’t load. Check your internet connection.'));
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
      Alert.alert(tx('ვერ მოხერხდა', 'Something went wrong'), e instanceof ApiError ? e.message : tx('სცადე ხელახლა.', 'Please try again.'));
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
    Alert.alert(tx('ვარჯიშის გაუქმება', 'Cancel workout'), late ? tx('ვარჯიშამდე 12 საათზე ნაკლებია — ტრენერი ამას ბოლო წუთის გაუქმებად ნახავს.', 'The workout is less than 12 hours away — your trainer will see this as a last-minute cancellation.') : tx(`${s.label} — ტრენერს შეტყობინება მიუვა.`, `${s.label} — your trainer will be notified.`), [
      { text: tx('არა', 'No'), style: 'cancel' },
      { text: tx('გაუქმება', 'Cancel'), style: 'destructive', onPress: () => void act(`cancel-${s.id}`, () => api.coach.cancel(s.id)) },
    ]);
  };

  const book = (s: CoachSession) => {
    Alert.alert(tx('დაჯავშნა', 'Book'), `${s.label} · ${s.kindLabel}${s.gym ? ` · ${s.gym.brand}` : ''}`, [
      { text: tx('არა', 'No'), style: 'cancel' },
      { text: tx('დაჯავშნა', 'Book'), onPress: () => void act(`book-${s.id}`, () => api.coach.book(s.id)) },
    ]);
  };

  const link = ov?.link;
  const trainer = ov?.trainer;
  const own = me?.trainerProfile;
  const next = ov?.upcoming?.find((s) => s.status === 'SCHEDULED');

  return (
    <View style={{ flex: 1, backgroundColor: c.bg100 }}>
      <CoachHeader brand="coach" title="MEDICOACH" subtitle={tx('ჩემი ტრენერი', 'My trainer')} />
      <Screen refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} tintColor={c.primary200} />}>
        {error ? <ErrorBox message={error} onRetry={load} /> : null}
        {!ov && !error ? <Loading /> : null}

        {ov && !link ? (
          <>
            <View style={{ backgroundColor: HUB.spotlightBg, borderRadius: HUB.cardRadius, padding: 22, marginTop: 8, gap: 14 }}>
              <IconTile icon={Dumbbell} ink="teal" />
              <Text style={{ fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 24, lineHeight: 32, color: '#FFFFFF' }}>{tx('შენი ტრენერი დარბაზის გარეთაც შენთანაა', 'Your trainer, with you outside the gym too')}</Text>
              <Text style={[hubText.body, { color: '#C5DADA', fontSize: 14, lineHeight: 22 }]}>
                {tx('ტრენერი ჯავშნებს პირდაპირ აქ გინიშნავს, შეხსენებები თავად მოგივა, კვების გეგმას გიდგენს და ხედავს, როგორ მიდიხარ — მხოლოდ იმას, რასაც შენ გაუზიარებ.', 'Your trainer books sessions right here, reminders come on their own, they build your meal plan and see how you’re doing — only what you choose to share.')}
              </Text>
              {[
                [tx('ჯავშნები და შეხსენებები — ვარჯიშს აღარ გამოტოვებ', 'Bookings and reminders — never miss a workout'), CalendarCheck2],
                [tx('კვების გეგმა და დღიური კონტროლი', 'Meal plan and daily check-ins'), UtensilsCrossed],
                [tx('ვარჯიშები ტელეფონიდან, წონა და ფოტო-პროგრესი', 'Workouts from your phone, weight and photo progress'), Target],
              ].map(([t, I]) => {
                const Icon = I as typeof Target;
                return (
                  <View key={t as string} style={coachStyles.row}>
                    <Icon size={18} color="#99F6E4" />
                    <Text style={[hubText.body, { color: '#FFFFFF', flex: 1 }]}>{t as string}</Text>
                  </View>
                );
              })}
              <Button label={tx('აჩვენე შენი QR ტრენერს', 'Show your QR to a trainer')} icon={QrCode} onPress={() => router.push('/profile/qr' as never)} />
              <Button label={tx('ტრენერის QR-ის სკანირება', 'Scan trainer QR')} icon={ScanLine} kind="secondary" onPress={() => router.push('/trainer/scan' as never)} />
              <View style={[coachStyles.row, { gap: 8 }]}>
                <Button label={tx('კოდით', 'By code')} icon={KeyRound} kind="ghost" style={{ flex: 1 }} onPress={() => router.push('/trainer/connect' as never)} />
                <Button label={tx('ძებნა', 'Search')} icon={Search} kind="ghost" style={{ flex: 1 }} onPress={() => router.push('/trainer/search' as never)} />
              </View>
            </View>
          </>
        ) : null}

        {link?.status === 'REQUESTED' && link.initiator === 'TRAINER' && trainer ? (
          <Section title={tx('ტრენერი გიწვევს', 'A trainer invited you')}>
            <View style={{ backgroundColor: HUB.spotlightBg, borderRadius: HUB.cardRadius, padding: HUB.cardPad, gap: 14 }}>
              <View style={coachStyles.row}>
                <Avatar avatarId={trainer.avatarId} photoUrl={trainer.avatarUrl} name={trainer.displayName} size={56} verified={trainer.verified} />
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={[hubText.cardTitle, { color: '#FFFFFF', fontSize: 17 }]}>{trainer.displayName}</Text>
                  <Text numberOfLines={2} style={[hubText.caption, { color: '#C5DADA' }]}>{trainer.gyms.map((g) => `${g.brand} ${g.name}`).join(' · ') || tx('დადასტურებული ტრენერი', 'Verified trainer')}</Text>
                </View>
              </View>
              <Text style={[hubText.body, { color: '#FFFFFF' }]}>{tx('შენი QR დაასკანერა და გთავაზობს ერთად ვარჯიშს. სანამ არ მიიღებ, შენს მონაცემებს ვერ ხედავს.', 'They scanned your QR and offer to train together. Until you accept, they can’t see your data.')}</Text>
              <Button label={tx('ნახვა და მიღება', 'Review and accept')} onPress={() => router.push('/trainer/connect?invite=1' as never)} />
              <Button
                label={tx('უარი', 'Decline')}
                kind="secondary"
                busy={busy === 'unlink'}
                onPress={async () => {
                  if (await confirmAction(tx('მოწვევაზე უარი', 'Decline invite'), tx(`${trainer.displayName} ვერ ნახავს შენს მონაცემებს. მოგვიანებით თავად შეგიძლია დაუკავშირდე.`, `${trainer.displayName} won’t see your data. You can connect with them yourself later.`), tx('უარი', 'Decline'), true)) void act('unlink', () => api.coach.unlink());
                }}
              />
            </View>
          </Section>
        ) : null}

        {link?.status === 'REQUESTED' && link.initiator !== 'TRAINER' && trainer ? (
          <Section title={tx('მოთხოვნა გაგზავნილია', 'Request sent')}>
            <Card style={{ gap: 12 }}>
              <View style={coachStyles.row}>
                <Avatar avatarId={trainer.avatarId} photoUrl={trainer.avatarUrl} name={trainer.displayName} verified />
                <View style={{ flex: 1 }}>
                  <Text style={[hubText.cardTitle, { color: c.text100 }]}>{trainer.displayName}</Text>
                  <Text style={[hubText.caption, { color: c.text300 }]}>{tx('ტრენერი ნახავს შენს მოთხოვნას და დაგიდასტურებს.', 'The trainer will see your request and confirm it.')}</Text>
                </View>
              </View>
              <Button label={tx('მოთხოვნის გაუქმება', 'Cancel request')} kind="secondary" busy={busy === 'unlink'} onPress={() => void act('unlink', () => api.coach.unlink())} />
            </Card>
          </Section>
        ) : null}

        {link?.status === 'ACTIVE' && trainer ? (
          <>
            <Card style={{ marginTop: 8, gap: 12 }} onPress={() => router.push('/trainer/sharing' as never)} accessibilityLabel={tx(`${trainer.displayName}, ტრენერი. გაზიარების პარამეტრები`, `${trainer.displayName}, trainer. Sharing settings`)}>
              <View style={coachStyles.row}>
                <Avatar avatarId={trainer.avatarId} photoUrl={trainer.avatarUrl} name={trainer.displayName} size={56} verified={trainer.verified} />
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
                    <Text style={[hubText.small, { color: c.primary100 }]}>{tx('რას ხედავს ტრენერი →', 'What your trainer sees →')}</Text>
                  </View>
                </View>
              </View>
              <View style={[coachStyles.row, { gap: 8 }]}>
                <Stat label={tx('ჩატარდა', 'Done')} value={String(ov?.stats?.done ?? 0)} />
                <Stat label={tx('გამოტოვა', 'Missed')} value={String(ov?.stats?.noShow ?? 0)} />
                <Stat label={tx('კვების დაცვა', 'Plan adherence')} value={ov?.nutrition?.score != null ? `${ov.nutrition.score}%` : '—'} />
              </View>
            </Card>

            {link.proposedGoal ? (
              <Section title={tx('ტრენერი მიზანს გთავაზობს', 'Your trainer proposes a goal')}>
                <Card style={{ gap: 12 }}>
                  <View style={coachStyles.row}>
                    <IconTile icon={Target} ink="amber" />
                    <View style={{ flex: 1 }}>
                      <Text style={[hubText.cardTitle, { color: c.text100 }]}>
                        {GOAL_TYPE_LABEL[link.proposedGoal.type]}: {link.proposedGoal.targetKg} {tx('კგ', 'kg')}
                      </Text>
                      <Text style={[hubText.caption, { color: c.text300 }]}>{tx('ვადა:', 'By:')} {dayLabel(link.proposedGoal.deadlineYmd)} {link.proposedGoal.deadlineYmd.slice(0, 4)}</Text>
                    </View>
                  </View>
                  {link.proposedGoal.note ? <Text style={[hubText.body, { color: c.text200 }]}>„{link.proposedGoal.note}“</Text> : null}
                  <View style={[coachStyles.row, { gap: 10 }]}>
                    <Button label={tx('მიღება', 'Accept')} style={{ flex: 1 }} busy={busy === 'goal'} onPress={() => void acceptGoal()} />
                    <Button label={tx('არა', 'No')} kind="secondary" style={{ flex: 1 }} onPress={() => void act('goal-no', () => api.coach.answerGoal('dismissed'))} />
                  </View>
                </Card>
              </Section>
            ) : null}

            <Section title={tx('შემდეგი ვარჯიში', 'Next workout')} link={ov?.upcoming?.length ? tx('ყველა', 'All') : undefined} onLink={() => router.push('/trainer/sessions' as never)}>
              {next ? (
                <View style={{ backgroundColor: HUB.spotlightBg, borderRadius: HUB.cardRadius, padding: HUB.cardPad, gap: 12 }}>
                  <View style={coachStyles.rowBetween}>
                    <Text style={{ fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 28, lineHeight: 36, color: '#FFFFFF' }}>{clockOf(next.startsAt)}</Text>
                    <View style={{ backgroundColor: 'rgba(153,246,228,0.16)', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4 }}>
                      <Text style={[hubText.link, { color: '#99F6E4' }]}>{relativeStart(next.startsAt)}</Text>
                    </View>
                  </View>
                  <Text style={[hubText.body, { color: '#C5DADA', fontSize: 14 }]}>
                    {dayLabel(tbilisiYmd(next.startsAt))} · {next.kindLabel} · {next.durationMin} {tx('წთ', 'min')}
                    {next.gym ? ` · ${next.gym.brand} ${next.gym.name}` : ''}
                  </Text>
                  {next.note ? <Text style={[hubText.body, { color: '#FFFFFF' }]}>„{next.note}“</Text> : null}
                  <View style={[coachStyles.row, { gap: 10 }]}>
                    {next.clientConfirmedAt ? (
                      <View style={[coachStyles.row, { gap: 6, flex: 1 }]}>
                        <BadgeCheck size={18} color="#99F6E4" />
                        <Text style={[hubText.link, { color: '#99F6E4' }]}>{tx('დადასტურებულია', 'Confirmed')}</Text>
                      </View>
                    ) : (
                      <Button label={tx('მოვალ ✓', 'I’ll be there ✓')} style={{ flex: 1 }} busy={busy === `c-${next.id}`} onPress={() => void act(`c-${next.id}`, () => api.coach.confirm(next.id))} />
                    )}
                    <Button label={tx('გაუქმება', 'Cancel')} kind="secondary" style={{ flex: 1 }} onPress={() => cancelSession(next)} />
                  </View>
                </View>
              ) : (
                <Card>
                  <Text style={[hubText.body, { color: c.text200 }]}>{tx('დაგეგმილი ვარჯიში ჯერ არ გაქვს. ტრენერი ჩაგწერს, ან აირჩიე თავისუფალი დრო ქვემოთ.', 'No workout scheduled yet. Your trainer will book you, or pick an open time below.')}</Text>
                </Card>
              )}
            </Section>

            {ov?.openSlots?.length ? (
              <Section title={tx('თავისუფალი დრო ტრენერთან', 'Open times with your trainer')}>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {ov.openSlots.slice(0, 12).map((s) => (
                    <Chip key={s.id} label={`${dayLabel(tbilisiYmd(s.startsAt))} ${clockOf(s.startsAt)}`} onPress={() => book(s)} />
                  ))}
                </View>
              </Section>
            ) : null}

            <Section title={tx('კვების გეგმა', 'Meal plan')} link={ov?.plan ? tx('გახსნა', 'Open') : undefined} onLink={() => router.push('/trainer/plan' as never)}>
              {ov?.plan ? (
                <Card style={{ gap: 12 }} onPress={() => router.push('/trainer/plan' as never)} accessibilityLabel={tx('კვების გეგმის გახსნა', 'Open meal plan')}>
                  <View style={coachStyles.rowBetween}>
                    <View style={{ flex: 1 }}>
                      <Text style={[hubText.cardTitle, { color: c.text100 }]}>{ov.plan.title}</Text>
                      <Text style={[hubText.caption, { color: c.text300 }]}>
                        {ov.plan.targets.calories} {tx('კკალ', 'kcal')}
                        {ov.plan.targets.protein ? tx(` · ცილა ${ov.plan.targets.protein} გ`, ` · protein ${ov.plan.targets.protein} g`) : ''}
                      </Text>
                    </View>
                    <ChevronRight size={18} color={c.text300} />
                  </View>
                  {ov.nutrition?.days ? <DayStrip days={ov.nutrition.days} labels /> : null}
                  {ov.nutrition?.days?.length ? (
                    <Text style={[hubText.small, { color: c.text300 }]}>
                      {tx('დღეს:', 'Today:')} {DAY_STATUS_LABEL[ov.nutrition.days[ov.nutrition.days.length - 1].status]} · {ov.nutrition.days[ov.nutrition.days.length - 1].calories} / {ov.plan.targets.calories} {tx('კკალ', 'kcal')}
                    </Text>
                  ) : null}
                </Card>
              ) : (
                <Card>
                  <Text style={[hubText.body, { color: c.text200 }]}>
                    {link.scopes.nutrition ? tx('ტრენერს კვების გეგმა ჯერ არ გამოუგზავნია.', 'Your trainer hasn’t sent a meal plan yet.') : tx('კვება ტრენერს არ უზიარებ — გეგმისთვის ჩართე „კვება“ გაზიარებაში.', 'You’re not sharing nutrition with your trainer — turn on “Nutrition” in sharing to get a plan.')}
                  </Text>
                </Card>
              )}
            </Section>
          </>
        ) : null}

        {ov ? (
          <Section title={tx('პროგრესი', 'Progress')}>
            <Card style={{ gap: 0, paddingVertical: 6 }}>
              {[
                { label: tx('ფოტო-პროგრესი: მანამდე / შემდეგ', 'Photo progress: before / after'), icon: Camera, href: '/trainer/progress' },
                { label: tx('წონა და მიზანი', 'Weight and goal'), icon: Target, href: '/health-metrics/weight' },
                ...(link?.status === 'ACTIVE' ? [{ label: tx('ვარჯიშების ისტორია', 'Workout history'), icon: Dumbbell, href: '/trainer/sessions' }] : []),
              ].filter((row) => isHrefAvailable(row.href, features)).map((row, i, arr) => (
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
          <Section title={own?.status === 'PENDING' ? tx('შენი ტრენერის განაცხადი', 'Your trainer application') : own?.status === 'VERIFIED' ? tx('ტრენერის რეჟიმი', 'Trainer mode') : tx('ტრენერი ხარ?', 'Are you a trainer?')}>
            <Card style={{ gap: 12 }} onPress={() => router.push((own?.status === 'VERIFIED' ? '/coach' : '/trainer/apply') as never)}>
              <View style={coachStyles.row}>
                <IconTile icon={Award} ink="violet" />
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={[hubText.cardTitle, { color: c.text100 }]}>
                    {own?.status === 'VERIFIED' ? tx('ტრენერის რეჟიმის გახსნა', 'Open trainer mode') : own?.status === 'PENDING' ? tx('განაცხადი განხილვაშია', 'Application under review') : own?.status === 'REJECTED' ? tx('განაცხადს დაზუსტება სჭირდება', 'Your application needs changes') : own ? tx('ტრენერის განაცხადი', 'Trainer application') : tx('დარეგისტრირდი როგორც ტრენერი', 'Sign up as a trainer')}
                  </Text>
                  <Text style={[hubText.caption, { color: c.text300 }]}>
                    {own?.status === 'VERIFIED'
                      ? tx('კალენდარი, კლიენტები, კვების გეგმები', 'Calendar, clients, meal plans')
                      : own?.status === 'PENDING'
                        ? tx('განაცხადი განიხილება — დადასტურებისას შეტყობინება მოგივა', 'Application under review — we’ll notify you once verified')
                        : own?.status === 'REJECTED'
                          ? tx('განაცხადს დაზუსტება სჭირდება', 'Your application needs changes')
                          : tx('კალენდარი, კლიენტების მართვა და მათი პროგრესი ერთ ადგილას', 'Calendar, client management and their progress in one place')}
                  </Text>
                </View>
                {own ? <Badge label={own.status === 'VERIFIED' ? tx('დადასტურებული', 'Verified') : own.status === 'PENDING' ? tx('განიხილება', 'In review') : own.status === 'REJECTED' ? tx('დასაზუსტებელი', 'Needs changes') : tx('შეჩერებული', 'Suspended')} tone={own.status === 'VERIFIED' ? 'ok' : own.status === 'PENDING' ? 'warn' : 'bad'} /> : <ChevronRight size={18} color={c.text300} />}
              </View>
            </Card>
          </Section>
        ) : null}
        {ov ? <View style={{ height: 8 }} /> : null}
        {ov && link?.status === 'ACTIVE' ? (
          <Text style={[hubText.small, { color: c.text300, textAlign: 'center', marginTop: 18 }]}>
            {ov.link?.trainerViewedAt ? tx(`ტრენერმა ბოლოს ნახა ${dayLabel(tbilisiYmd(ov.link.trainerViewedAt))} ${clockOf(ov.link.trainerViewedAt)}`, `Your trainer last viewed ${dayLabel(tbilisiYmd(ov.link.trainerViewedAt))} ${clockOf(ov.link.trainerViewedAt)}`) : tx('ტრენერს შენი მონაცემები ჯერ არ უნახავს', 'Your trainer hasn’t viewed your data yet')}
          </Text>
        ) : null}
      </Screen>
    </View>
  );
}

