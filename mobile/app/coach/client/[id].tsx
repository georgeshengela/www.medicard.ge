import React, { useCallback, useMemo, useState } from 'react';
import { Alert, Pressable, RefreshControl, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { CalendarPlus, Camera, Check, Dumbbell, EyeOff, Flame, Footprints, HeartPulse, Scale, Target, Timer, UserMinus, UtensilsCrossed } from 'lucide-react-native';
import { api, ApiError } from '@/lib/api';
import { localAccountId } from '@/lib/localAccount';
import {
  DAY_STATUS_LABEL,
  GOAL_TYPE_LABEL,
  MONTH_SHORT,
  POSE_LABEL,
  SCOPE_COPY,
  SESSION_STATUS_LABEL,
  beforeAfter,
  clockOf,
  dayLabel,
  dayStatusColor,
  tbilisiYmd,
  workoutKindLabel,
  type ClientDashboard,
  type CoachScope,
  type ProgressPhoto,
} from '@/lib/coach';
import { BeforeAfter, WeightChart } from '@/components/coach/CoachVisuals';
import { FadeIn, KpiTile, QuickAction, Ring, scoreColor } from '@/components/coach/CoachKit';
import { Avatar, Badge, Button, Card, Chip, CoachHeader, DayStrip, ErrorBox, Loading, PrivateImage, Section, Stat, coachStyles } from '@/components/coach/CoachUI';
import { HUB, hubText } from '@/theme/hub';
import { useIsDark, useThemeColors } from '@/theme/colors';
import { tx } from '@/i18n/locale';

type Tab = 'overview' | 'food' | 'weight' | 'training' | 'photos';
const TABS: { key: Tab; label: string }[] = [
  { key: 'overview', label: tx('მიმოხილვა', 'Overview') },
  { key: 'food', label: tx('კვება', 'Nutrition') },
  { key: 'weight', label: tx('წონა', 'Weight') },
  { key: 'training', label: tx('ვარჯიში', 'Training') },
  { key: 'photos', label: tx('ფოტოები', 'Photos') },
];
const TAB_SCOPE: Partial<Record<Tab, CoachScope>> = { food: 'nutrition', weight: 'weight', training: 'workouts', photos: 'photos' };

function NotShared({ scope }: { scope: CoachScope }) {
  const c = useThemeColors();
  return (
    <Card style={{ marginTop: 16, gap: 8, alignItems: 'center' }}>
      <EyeOff size={24} color={c.text300} />
      <Text style={[hubText.cardTitle, { color: c.text100, textAlign: 'center' }]}>{tx(`„${SCOPE_COPY[scope].title}“ არ არის გაზიარებული`, `“${SCOPE_COPY[scope].title}” isn’t shared`)}</Text>
      <Text style={[hubText.body, { color: c.text200, textAlign: 'center' }]}>{tx('ამას მხოლოდ კლიენტი ჩართავს თავის „ჩემი ტრენერი“-ში. შეგიძლია სთხოვო — გადაწყვეტილება მისია.', 'Only the client can turn this on in their “My trainer”. You can ask — it’s their decision.')}</Text>
    </Card>
  );
}

export default function CoachClientScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const c = useThemeColors();
  const dark = useIsDark();
  const { width } = useWindowDimensions();
  const [d, setD] = useState<ClientDashboard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('overview');
  const [pose, setPose] = useState<ProgressPhoto['pose']>('FRONT');
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const owner = localAccountId();
    try {
      const res = await api.coach.client(String(id));
      if (localAccountId() === owner) {
        setD(res);
        setError(null);
      }
    } catch (e) {
      setError(e instanceof ApiError ? e.message : tx('ჩატვირთვა ვერ მოხერხდა.', 'Couldn’t load.'));
    }
  }, [id]);
  useFocusEffect(useCallback(() => void load(), [load]));

  const end = () =>
    Alert.alert(tx('კლიენტთან კავშირის დასრულება', 'End connection with client'), tx('მომავალი ვარჯიშები გაუქმდება და მის მონაცემებს ვეღარ ნახავ.', 'Upcoming workouts will be cancelled and you won’t see their data anymore.'), [
      { text: tx('არა', 'No'), style: 'cancel' },
      {
        text: tx('დასრულება', 'End'),
        style: 'destructive',
        onPress: async () => {
          try {
            await api.coach.endClient(String(id));
            router.replace('/coach/clients' as never);
          } catch (e) {
            Alert.alert(tx('ვერ მოხერხდა', 'Something went wrong'), e instanceof ApiError ? e.message : tx('სცადე ხელახლა.', 'Please try again.'));
          }
        },
      },
    ]);

  const upcoming = useMemo(() => (d?.sessions ?? []).filter((s) => s.status === 'SCHEDULED' && new Date(s.startsAt).getTime() > Date.now()).sort((a, b) => a.startsAt.localeCompare(b.startsAt)), [d]);
  const history = useMemo(() => (d?.sessions ?? []).filter((s) => ['DONE', 'NO_SHOW'].includes(s.status)), [d]);
  const scope = TAB_SCOPE[tab];
  const shared = !scope || Boolean(d?.link.scopes[scope]);
  const n = d?.nutrition;
  const w = d?.weight;
  const a = d?.activity;
  const pair = d?.photos ? beforeAfter(d.photos, pose) : null;
  const steps7 = (a?.days ?? []).slice(-7);
  const maxSteps = Math.max(1, ...steps7.map((x) => x.steps ?? 0));

  return (
    <View style={{ flex: 1, backgroundColor: c.bg100 }}>
      <CoachHeader title={tx('კლიენტის ბარათი', 'Client card')} subtitle={d ? [d.client.age ? tx(`${d.client.age} წ.`, `${d.client.age} y`) : null, d.client.heightCm ? `${d.client.heightCm} ${tx('სმ', 'cm')}` : null, d.link.since ? tx(`კლიენტი ${Number(tbilisiYmd(d.link.since).slice(8))} ${MONTH_SHORT[Number(tbilisiYmd(d.link.since).slice(5, 7)) - 1]}-დან`, `Client since ${Number(tbilisiYmd(d.link.since).slice(8))} ${MONTH_SHORT[Number(tbilisiYmd(d.link.since).slice(5, 7)) - 1]}`) : null].filter(Boolean).join(' · ') : undefined} fallback="/coach/clients" />
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: HUB.gutter, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} tintColor={c.primary200} />}
        stickyHeaderIndices={d ? [1] : undefined}
      >
        <View>
          {error ? <ErrorBox message={error} onRetry={load} /> : null}
          {!d && !error ? <Loading /> : null}
          {d ? (
            <FadeIn>
              <Card style={{ marginTop: 4, gap: 16 }}>
                <View style={[coachStyles.row, { gap: 14 }]}>
                  <Ring value={n?.score != null ? n.score / 100 : null} size={84} stroke={5} color={scoreColor(n?.score, dark)}>
                    <Avatar avatarId={d.client.avatarId} photoUrl={d.client.avatarUrl} name={d.client.name} size={70} />
                  </Ring>
                  <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
                    <Text numberOfLines={1} style={[hubText.sectionTitle, { color: c.text100, fontSize: 19 }]}>{d.client.name}</Text>
                    {n?.score != null ? (
                      <Text style={[hubText.caption, { color: scoreColor(n.score, dark), fontFamily: 'NotoSansGeorgian_600SemiBold' }]}>{tx(`კვების დაცვა ${n.score}% · 14 დღე`, `Plan adherence ${n.score}% · 14 days`)}</Text>
                    ) : (
                      <Text style={[hubText.caption, { color: c.text300 }]}>{d.link.scopes.nutrition ? tx('კვების ჩანაწერები ჯერ არ არის', 'No food entries yet') : tx('კვება არ არის გაზიარებული', 'Nutrition isn’t shared')}</Text>
                    )}
                    {d.link.note ? <Text numberOfLines={2} style={[hubText.caption, { color: c.text200 }]}>„{d.link.note}“</Text> : null}
                  </View>
                </View>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                  {(Object.keys(d.link.scopes) as CoachScope[]).map((k) => (
                    <View key={k} style={[coachStyles.row, { gap: 5, borderRadius: 10, paddingHorizontal: 9, paddingVertical: 5, backgroundColor: d.link.scopes[k] ? c.accent100 : c.bg200 }]}>
                      {d.link.scopes[k] ? <Check size={12} color={c.primary100} strokeWidth={3} /> : <EyeOff size={12} color={c.text300} />}
                      <Text style={[hubText.small, { color: d.link.scopes[k] ? c.primary100 : c.text300, fontFamily: 'NotoSansGeorgian_600SemiBold' }]}>{SCOPE_COPY[k].title.split(' ')[0]}</Text>
                    </View>
                  ))}
                </View>
                <View style={{ flexDirection: 'row' }}>
                  <QuickAction icon={CalendarPlus} label={tx('დანიშვნა', 'Schedule')} primary onPress={() => router.push(`/coach/session-new?clientId=${d.client.id}` as never)} />
                  <QuickAction icon={UtensilsCrossed} label={tx('კვების გეგმა', 'Meal plan')} onPress={() => (d.link.scopes.nutrition ? router.push(`/coach/plan/${d.client.id}` as never) : setTab('food'))} />
                  <QuickAction icon={Target} label={tx('მიზანი', 'Goal')} onPress={() => (d.link.scopes.weight ? router.push(`/coach/goal/${d.client.id}` as never) : setTab('weight'))} />
                  <QuickAction icon={Camera} label={tx('ფოტოები', 'Photos')} onPress={() => setTab('photos')} />
                </View>
              </Card>
            </FadeIn>
          ) : null}
        </View>

        {d ? (
          <View style={{ backgroundColor: c.bg100, paddingTop: 14, paddingBottom: 4 }}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }} accessibilityRole="tablist">
              {TABS.map((t) => {
                const sc = TAB_SCOPE[t.key];
                const locked = sc ? !d.link.scopes[sc] : false;
                return <Chip key={t.key} label={locked ? tx(`${t.label} · დახურულია`, `${t.label} · locked`) : t.label} selected={tab === t.key} onPress={() => setTab(t.key)} />;
              })}
            </ScrollView>
          </View>
        ) : null}

        {d ? (
          <View>
            {!shared && scope ? <NotShared scope={scope} /> : null}

            {tab === 'overview' ? (
              <>
                <Section title={tx('მოკლედ', 'At a glance')} style={{ marginTop: 14 }}>
                  <View style={{ flexDirection: 'row', gap: 10 }}>
                    <KpiTile icon={Scale} ink="violet" value={w?.currentKg ? `${w.currentKg}` : '—'} label={tx('წონა, კგ', 'Weight, kg')} hint={w?.goal ? tx(`მიზანი ${w.goal.targetKg}${w.progress ? ` · ${w.progress.percent}%` : ''}`, `Goal ${w.goal.targetKg}${w.progress ? ` · ${w.progress.percent}%` : ''}`) : tx('მიზანი არ არის', 'No goal')} onPress={() => setTab('weight')} />
                    <KpiTile icon={Dumbbell} ink="teal" value={String(history.filter((s) => s.status === 'DONE').length)} label={tx('ვარჯიში ჩატარდა', 'Workouts done')} hint={tx(`გამოტოვა ${history.filter((s) => s.status === 'NO_SHOW').length}`, `Missed ${history.filter((s) => s.status === 'NO_SHOW').length}`)} onPress={() => setTab('training')} />
                  </View>
                </Section>
                {n ? (
                  <Section title={tx('კვება · 14 დღე', 'Nutrition · 14 days')} link={tx('დეტალები', 'Details')} onLink={() => setTab('food')}>
                    <Card style={{ gap: 8 }}>
                      <DayStrip days={n.days} size={14} />
                      <Text style={[hubText.caption, { color: c.text300 }]}>
                        {tx('დღეს:', 'Today:')} {n.days[n.days.length - 1]?.calories ?? 0}
                        {n.targets ? ` / ${n.targets.calories}` : ''} {tx('კკალ', 'kcal')} · {n.today.length} {tx('კვება', n.today.length === 1 ? 'meal' : 'meals')}
                      </Text>
                    </Card>
                  </Section>
                ) : null}
                {d.link.proposedGoal ? (
                  <Section title={tx('შეთავაზებული მიზანი', 'Proposed goal')}>
                    <Card>
                      <Text style={[hubText.body, { color: c.text200 }]}>
                        {GOAL_TYPE_LABEL[d.link.proposedGoal.type]} → {d.link.proposedGoal.targetKg} {tx('კგ', 'kg')}, {d.link.proposedGoal.deadlineYmd}. {tx('ელოდება კლიენტის დასტურს.', 'Waiting for the client to confirm.')}
                      </Text>
                    </Card>
                  </Section>
                ) : null}
                <Section title={tx('მომავალი ვარჯიშები', 'Upcoming workouts')}>
                  {upcoming.length ? (
                    upcoming.slice(0, 5).map((s) => (
                      <Card key={s.id} onPress={() => router.push(`/coach/session/${s.id}` as never)} style={{ marginBottom: 8, paddingVertical: 12 }}>
                        <View style={coachStyles.rowBetween}>
                          <Text style={[hubText.cardTitle, { color: c.text100 }]}>
                            {dayLabel(tbilisiYmd(s.startsAt))} · {clockOf(s.startsAt)}
                          </Text>
                          <Badge label={s.clientConfirmedAt ? tx('დადასტურდა', 'Confirmed') : tx('ელოდება', 'Waiting')} tone={s.clientConfirmedAt ? 'ok' : 'neutral'} />
                        </View>
                        <Text style={[hubText.caption, { color: c.text300 }]}>
                          {s.kindLabel}
                          {s.gym ? ` · ${s.gym.brand}` : ''}
                        </Text>
                      </Card>
                    ))
                  ) : (
                    <Button label={tx('ვარჯიშის დანიშვნა', 'Schedule a workout')} icon={CalendarPlus} kind="secondary" onPress={() => router.push(`/coach/session-new?clientId=${d.client.id}` as never)} />
                  )}
                </Section>
                {d.plan ? (
                  <Section title={tx('კვების გეგმა', 'Meal plan')} link={tx('შეცვლა', 'Edit')} onLink={() => router.push(`/coach/plan/${d.client.id}` as never)}>
                    <Card>
                      <Text style={[hubText.cardTitle, { color: c.text100 }]}>{d.plan.title}</Text>
                      <Text style={[hubText.caption, { color: c.text300 }]}>
                        {d.plan.targets.calories} {tx('კკალ', 'kcal')}
                        {d.plan.targets.protein ? tx(` · ცილა ${d.plan.targets.protein} გ`, ` · protein ${d.plan.targets.protein} g`) : ''} · {d.plan.meals.length} {tx('კვება', d.plan.meals.length === 1 ? 'meal' : 'meals')}
                      </Text>
                    </Card>
                  </Section>
                ) : null}
                <Section title={tx('კავშირი', 'Connection')}>
                  <Button label={tx('კლიენტთან კავშირის დასრულება', 'End connection with client')} icon={UserMinus} kind="danger" onPress={end} />
                  <Button
                    label={tx('შეტყობინება დარღვევაზე', 'Report a problem')}
                    kind="ghost"
                    style={{ marginTop: 8 }}
                    onPress={() => router.push({ pathname: '/trainer/report', params: { id: d.client.id, name: d.client.name, role: 'client' } } as never)}
                  />
                </Section>
              </>
            ) : null}

            {tab === 'food' && n ? (
              <>
                <Card style={{ marginTop: 14, flexDirection: 'row', gap: 6 }}>
                  <Stat label={tx('გეგმის დაცვა', 'Plan adherence')} value={n.score != null ? `${n.score}%` : '—'} />
                  <Stat label={tx('გეგმა', 'Plan')} value={n.targets ? `${n.targets.calories}` : '—'} hint={tx('კკალ / დღე', 'kcal / day')} />
                  <Stat label={tx('ბოლო ჩანაწერი', 'Last entry')} value={n.lastMealYmd ? dayLabel(n.lastMealYmd) : '—'} />
                </Card>
                {!n.targets ? (
                  <Button label={tx('კვების გეგმის შედგენა', 'Create a meal plan')} icon={UtensilsCrossed} style={{ marginTop: 12 }} onPress={() => router.push(`/coach/plan/${d.client.id}` as never)} />
                ) : null}
                <Section title={tx('დღეს', 'Today')}>
                  <Card style={{ paddingVertical: 6 }}>
                    {n.today.length ? (
                      n.today.map((m, i) => (
                        <View key={m.id} style={[coachStyles.row, { paddingVertical: 10, borderBottomWidth: i < n.today.length - 1 ? 0.5 : 0, borderColor: c.bg300 }]}>
                          <Text style={[hubText.caption, { color: c.text300, width: 42 }]}>{m.time}</Text>
                          <Text numberOfLines={2} style={[hubText.body, { color: c.text100, flex: 1 }]}>{m.title || tx('კვება', 'Meal')}</Text>
                          <Text style={[hubText.value, { color: c.text100 }]}>{m.calories}</Text>
                        </View>
                      ))
                    ) : (
                      <Text style={[hubText.body, { color: c.text200, paddingVertical: 10 }]}>{tx('დღეს ჯერ არაფერი ჩაუწერია.', 'Nothing logged today yet.')}</Text>
                    )}
                  </Card>
                </Section>
                <Section title={tx('14 დღე', '14 days')}>
                  <Card style={{ paddingVertical: 6 }}>
                    {[...n.days].reverse().map((day, i) => (
                      <View key={day.date} style={[coachStyles.row, { paddingVertical: 9, borderBottomWidth: i < n.days.length - 1 ? 0.5 : 0, borderColor: c.bg300 }]}>
                        <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: dayStatusColor(day.status, dark) }} />
                        <Text style={[hubText.body, { color: c.text100, width: 92 }]}>{dayLabel(day.date)}</Text>
                        <Text style={[hubText.body, { color: c.text200, flex: 1 }]}>{day.meals ? tx(`${day.calories} კკალ · ც ${day.protein} · ნ ${day.carbs} · ცხ ${day.fat}`, `${day.calories} kcal · P ${day.protein} · C ${day.carbs} · F ${day.fat}`) : '—'}</Text>
                        <Text style={[hubText.small, { color: dayStatusColor(day.status, dark), fontFamily: 'NotoSansGeorgian_600SemiBold' }]}>{DAY_STATUS_LABEL[day.status]}</Text>
                      </View>
                    ))}
                  </Card>
                </Section>
              </>
            ) : null}

            {tab === 'weight' && w ? (
              <>
                <Card style={{ marginTop: 14, gap: 12 }}>
                  <View style={[coachStyles.row, { gap: 6 }]}>
                    <Stat label={tx('ახლა', 'Now')} value={w.currentKg ? `${w.currentKg} ${tx('კგ', 'kg')}` : '—'} hint={w.lastWeighYmd ? dayLabel(w.lastWeighYmd) : undefined} />
                    <Stat label={tx('მიზანი', 'Goal')} value={w.goal ? `${w.goal.targetKg} ${tx('კგ', 'kg')}` : '—'} hint={w.goal ? tx(`ვადა ${w.goal.deadlineYmd}`, `By ${w.goal.deadlineYmd}`) : undefined} />
                    <Stat label={tx('პროგრესი', 'Progress')} value={w.progress ? `${w.progress.percent}%` : '—'} hint={w.progress ? tx(`დარჩა ${Math.abs(w.progress.remainingKg)} კგ`, `${Math.abs(w.progress.remainingKg)} kg to go`) : undefined} />
                  </View>
                  <WeightChart series={w.series} goal={w.goal} />
                  <Text style={[hubText.small, { color: c.text300 }]}>{tx('ყვითელი ხაზი — მიზანი და იდეალური გზა ვადამდე.', 'Yellow line — the goal and the ideal path to the deadline.')}</Text>
                </Card>
                <Button label={w.goal ? tx('ახალი მიზნის შეთავაზება', 'Propose a new goal') : tx('მიზნის შეთავაზება', 'Propose a goal')} icon={Target} kind="secondary" style={{ marginTop: 12 }} onPress={() => router.push(`/coach/goal/${d.client.id}` as never)} />
              </>
            ) : null}

            {tab === 'training' ? (
              <>
                {a ? (
                  <Section title={tx('ნაბიჯები · 7 დღე', 'Steps · 7 days')} style={{ marginTop: 14 }}>
                    <Card>
                      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8, height: 110 }}>
                        {steps7.map((x) => (
                          <View key={x.date} style={{ flex: 1, alignItems: 'center', gap: 4 }}>
                            <Text style={[hubText.small, { color: c.text300, fontSize: 9 }]}>{x.steps ? `${Math.round(x.steps / 100) / 10}k` : ''}</Text>
                            <View style={{ width: '100%', height: Math.max(4, ((x.steps ?? 0) / maxSteps) * 70), borderRadius: 6, backgroundColor: (x.steps ?? 0) >= 8000 ? '#14B8A6' : c.bg300 }} />
                            <Text style={[hubText.small, { color: c.text300, fontSize: 10 }]}>{Number(x.date.slice(8))}</Text>
                          </View>
                        ))}
                      </View>
                      {!steps7.length ? <Text style={[hubText.body, { color: c.text200 }]}>{tx('ნაბიჯების მონაცემი არ არის.', 'No step data.')}</Text> : null}
                    </Card>
                  </Section>
                ) : null}
                <Section title={tx('ვარჯიშები შენთან', 'Workouts with you')} style={!a ? { marginTop: 14 } : undefined}>
                  {history.length ? (
                    history.slice(0, 15).map((s) => (
                      <Card key={s.id} onPress={() => router.push(`/coach/session/${s.id}` as never)} style={{ marginBottom: 8, gap: 6 }}>
                        <View style={coachStyles.rowBetween}>
                          <Text style={[hubText.cardTitle, { color: c.text100 }]}>
                            {dayLabel(tbilisiYmd(s.startsAt))} · {s.kindLabel}
                          </Text>
                          <Badge label={SESSION_STATUS_LABEL[s.status]} tone={s.status === 'DONE' ? 'ok' : 'bad'} />
                        </View>
                        {s.exercises.length ? <Text numberOfLines={1} style={[hubText.caption, { color: c.text300 }]}>{s.exercises.map((e) => e.name).join(' · ')}</Text> : null}
                        {s.workout ? (
                          <View style={[coachStyles.row, { gap: 14 }]}>
                            <View style={[coachStyles.row, { gap: 4 }]}><Timer size={14} color={c.text300} /><Text style={[hubText.small, { color: c.text200 }]}>{s.workout.durationMin} {tx('წთ', 'min')}</Text></View>
                            {s.workout.kcal ? <View style={[coachStyles.row, { gap: 4 }]}><Flame size={14} color="#F97316" /><Text style={[hubText.small, { color: c.text200 }]}>{s.workout.kcal} {tx('კკალ', 'kcal')}</Text></View> : null}
                            {s.workout.avgHeartRate ? <View style={[coachStyles.row, { gap: 4 }]}><HeartPulse size={14} color="#E11D48" /><Text style={[hubText.small, { color: c.text200 }]}>{s.workout.avgHeartRate} bpm</Text></View> : null}
                          </View>
                        ) : null}
                      </Card>
                    ))
                  ) : (
                    <Card>
                      <Text style={[hubText.body, { color: c.text200 }]}>{tx('ჩატარებული ვარჯიში ჯერ არ არის.', 'No completed workouts yet.')}</Text>
                    </Card>
                  )}
                </Section>
                {a?.workouts.length ? (
                  <Section title={tx('დამოუკიდებელი ვარჯიშები (საათი / ტელეფონი)', 'Own workouts (watch / phone)')}>
                    <Card style={{ paddingVertical: 6 }}>
                      {a.workouts.slice(0, 12).map((x, i) => (
                        <View key={x.id} style={[coachStyles.row, { paddingVertical: 10, borderBottomWidth: i < Math.min(12, a.workouts.length) - 1 ? 0.5 : 0, borderColor: c.bg300 }]}>
                          <Footprints size={16} color={c.primary100} />
                          <Text style={[hubText.body, { color: c.text100, flex: 1 }]}>
                            {workoutKindLabel(x.kind)} · {dayLabel(x.date)}
                          </Text>
                          <Text style={[hubText.caption, { color: c.text200 }]}>
                            {x.durationMin} {tx('წთ', 'min')}
                            {x.kcal ? ` · ${x.kcal} ${tx('კკალ', 'kcal')}` : ''}
                          </Text>
                        </View>
                      ))}
                    </Card>
                  </Section>
                ) : null}
              </>
            ) : null}

            {tab === 'photos' && d.photos ? (
              <>
                <View style={[coachStyles.row, { gap: 8, marginTop: 14 }]}>
                  {(['FRONT', 'SIDE', 'BACK'] as const).map((p) => (
                    <Chip key={p} label={POSE_LABEL[p]} selected={pose === p} onPress={() => setPose(p)} />
                  ))}
                </View>
                <View style={{ marginTop: 12 }}>
                  {pair ? (
                    <BeforeAfter before={pair.before} after={pair.after} height={Math.round((width - HUB.gutter * 2) * 1.25)} />
                  ) : (
                    <Card>
                      <Text style={[hubText.body, { color: c.text200 }]}>{tx('ამ რაკურსით შესადარებლად მინიმუმ ორი ფოტოა საჭირო.', 'At least two photos from this angle are needed to compare.')}</Text>
                    </Card>
                  )}
                </View>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 }}>
                  {d.photos.map((p) => (
                    <Pressable key={p.id} accessibilityRole="button" accessibilityLabel={`${POSE_LABEL[p.pose]} ${p.takenOn}`} onPress={() => setPose(p.pose)}>
                      <PrivateImage path={p.url} style={{ width: (width - HUB.gutter * 2 - 16) / 3, height: ((width - HUB.gutter * 2 - 16) / 3) * 1.3, borderRadius: 12 }} />
                      <Text style={[hubText.small, { color: c.text300 }]}>{p.takenOn.slice(5)}{p.weightKg ? ` · ${p.weightKg}` : ''}</Text>
                    </Pressable>
                  ))}
                </View>
              </>
            ) : null}
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}
