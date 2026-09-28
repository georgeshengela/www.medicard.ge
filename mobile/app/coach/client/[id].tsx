import React, { useCallback, useMemo, useState } from 'react';
import { Alert, Pressable, RefreshControl, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { CalendarPlus, EyeOff, Flame, Footprints, HeartPulse, Target, Timer, UserMinus, UtensilsCrossed } from 'lucide-react-native';
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
import { Avatar, Badge, Button, Card, Chip, CoachHeader, DayStrip, ErrorBox, Loading, PrivateImage, Section, Stat, coachStyles } from '@/components/coach/CoachUI';
import { HUB, hubText } from '@/theme/hub';
import { useIsDark, useThemeColors } from '@/theme/colors';

type Tab = 'overview' | 'food' | 'weight' | 'training' | 'photos';
const TABS: { key: Tab; label: string }[] = [
  { key: 'overview', label: 'მიმოხილვა' },
  { key: 'food', label: 'კვება' },
  { key: 'weight', label: 'წონა' },
  { key: 'training', label: 'ვარჯიში' },
  { key: 'photos', label: 'ფოტოები' },
];
const TAB_SCOPE: Partial<Record<Tab, CoachScope>> = { food: 'nutrition', weight: 'weight', training: 'workouts', photos: 'photos' };

function NotShared({ scope }: { scope: CoachScope }) {
  const c = useThemeColors();
  return (
    <Card style={{ marginTop: 16, gap: 8, alignItems: 'center' }}>
      <EyeOff size={24} color={c.text300} />
      <Text style={[hubText.cardTitle, { color: c.text100, textAlign: 'center' }]}>„{SCOPE_COPY[scope].title}“ არ არის გაზიარებული</Text>
      <Text style={[hubText.body, { color: c.text200, textAlign: 'center' }]}>ამას მხოლოდ კლიენტი ჩართავს თავის „ჩემი ტრენერი“-ში. შეგიძლია სთხოვო — გადაწყვეტილება მისია.</Text>
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
      setError(e instanceof ApiError ? e.message : 'ჩატვირთვა ვერ მოხერხდა.');
    }
  }, [id]);
  useFocusEffect(useCallback(() => void load(), [load]));

  const end = () =>
    Alert.alert('კლიენტთან კავშირის დასრულება', 'მომავალი ვარჯიშები გაუქმდება და მის მონაცემებს ვეღარ ნახავ.', [
      { text: 'არა', style: 'cancel' },
      {
        text: 'დასრულება',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.coach.endClient(String(id));
            router.replace('/coach/clients' as never);
          } catch (e) {
            Alert.alert('ვერ მოხერხდა', e instanceof ApiError ? e.message : 'სცადე ხელახლა.');
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
      <CoachHeader title={d?.client.name ?? 'კლიენტი'} subtitle={d ? [d.client.age ? `${d.client.age} წ.` : null, d.client.heightCm ? `${d.client.heightCm} სმ` : null, d.link.since ? `კლიენტი ${Number(tbilisiYmd(d.link.since).slice(8))} ${MONTH_SHORT[Number(tbilisiYmd(d.link.since).slice(5, 7)) - 1]}-დან` : null].filter(Boolean).join(' · ') : undefined} fallback="/coach/clients" />
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: HUB.gutter, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} tintColor={c.primary200} />}
        stickyHeaderIndices={d ? [1] : undefined}
      >
        <View>
          {error ? <ErrorBox message={error} onRetry={load} /> : null}
          {!d && !error ? <Loading /> : null}
          {d ? (
            <Card style={{ marginTop: 4, gap: 12 }}>
              <View style={coachStyles.row}>
                <Avatar avatarId={d.client.avatarId} photoUrl={d.client.avatarUrl} name={d.client.name} size={56} />
                <View style={{ flex: 1, gap: 6 }}>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                    {(Object.keys(d.link.scopes) as CoachScope[]).map((k) => (
                      <Badge key={k} label={`${d.link.scopes[k] ? '✓' : '✕'} ${SCOPE_COPY[k].title.split(' ')[0]}`} tone={d.link.scopes[k] ? 'brand' : 'neutral'} />
                    ))}
                  </View>
                  {d.link.note ? <Text style={[hubText.caption, { color: c.text200 }]}>„{d.link.note}“</Text> : null}
                </View>
              </View>
              <View style={[coachStyles.row, { gap: 8 }]}>
                <Button label="დანიშვნა" icon={CalendarPlus} style={{ flex: 1, minHeight: 44, paddingHorizontal: 8 }} onPress={() => router.push(`/coach/session-new?clientId=${d.client.id}` as never)} />
                <Button label="გეგმა" icon={UtensilsCrossed} kind="secondary" style={{ flex: 1, minHeight: 44, paddingHorizontal: 8 }} disabled={!d.link.scopes.nutrition} onPress={() => router.push(`/coach/plan/${d.client.id}` as never)} />
                <Button label="მიზანი" icon={Target} kind="secondary" style={{ flex: 1, minHeight: 44, paddingHorizontal: 8 }} disabled={!d.link.scopes.weight} onPress={() => router.push(`/coach/goal/${d.client.id}` as never)} />
              </View>
            </Card>
          ) : null}
        </View>

        {d ? (
          <View style={{ backgroundColor: c.bg100, paddingTop: 14, paddingBottom: 4 }}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {TABS.map((t) => (
                <Chip key={t.key} label={t.label} selected={tab === t.key} onPress={() => setTab(t.key)} />
              ))}
            </ScrollView>
          </View>
        ) : null}

        {d ? (
          <View>
            {!shared && scope ? <NotShared scope={scope} /> : null}

            {tab === 'overview' ? (
              <>
                <Section title="მოკლედ" style={{ marginTop: 14 }}>
                  <Card style={{ flexDirection: 'row', gap: 6 }}>
                    <Stat label="კვების დაცვა" value={n?.score != null ? `${n.score}%` : '—'} hint="14 დღე" />
                    <Stat label="წონა" value={w?.currentKg ? `${w.currentKg}` : '—'} hint={w?.goal ? `მიზანი ${w.goal.targetKg}` : 'კგ'} />
                    <Stat label="ჩატარდა" value={String(history.filter((s) => s.status === 'DONE').length)} hint={`გამოტოვა ${history.filter((s) => s.status === 'NO_SHOW').length}`} />
                  </Card>
                </Section>
                {n ? (
                  <Section title="კვება · 14 დღე" link="დეტალები" onLink={() => setTab('food')}>
                    <Card style={{ gap: 8 }}>
                      <DayStrip days={n.days} size={14} />
                      <Text style={[hubText.caption, { color: c.text300 }]}>
                        დღეს: {n.days[n.days.length - 1]?.calories ?? 0}
                        {n.targets ? ` / ${n.targets.calories}` : ''} კკალ · {n.today.length} კვება
                      </Text>
                    </Card>
                  </Section>
                ) : null}
                {d.link.proposedGoal ? (
                  <Section title="შეთავაზებული მიზანი">
                    <Card>
                      <Text style={[hubText.body, { color: c.text200 }]}>
                        {GOAL_TYPE_LABEL[d.link.proposedGoal.type]} → {d.link.proposedGoal.targetKg} კგ, {d.link.proposedGoal.deadlineYmd}. ელოდება კლიენტის დასტურს.
                      </Text>
                    </Card>
                  </Section>
                ) : null}
                <Section title="მომავალი ვარჯიშები">
                  {upcoming.length ? (
                    upcoming.slice(0, 5).map((s) => (
                      <Card key={s.id} onPress={() => router.push(`/coach/session/${s.id}` as never)} style={{ marginBottom: 8, paddingVertical: 12 }}>
                        <View style={coachStyles.rowBetween}>
                          <Text style={[hubText.cardTitle, { color: c.text100 }]}>
                            {dayLabel(tbilisiYmd(s.startsAt))} · {clockOf(s.startsAt)}
                          </Text>
                          <Badge label={s.clientConfirmedAt ? 'დადასტურდა' : 'ელოდება'} tone={s.clientConfirmedAt ? 'ok' : 'neutral'} />
                        </View>
                        <Text style={[hubText.caption, { color: c.text300 }]}>
                          {s.kindLabel}
                          {s.gym ? ` · ${s.gym.brand}` : ''}
                        </Text>
                      </Card>
                    ))
                  ) : (
                    <Button label="ვარჯიშის დანიშვნა" icon={CalendarPlus} kind="secondary" onPress={() => router.push(`/coach/session-new?clientId=${d.client.id}` as never)} />
                  )}
                </Section>
                {d.plan ? (
                  <Section title="კვების გეგმა" link="შეცვლა" onLink={() => router.push(`/coach/plan/${d.client.id}` as never)}>
                    <Card>
                      <Text style={[hubText.cardTitle, { color: c.text100 }]}>{d.plan.title}</Text>
                      <Text style={[hubText.caption, { color: c.text300 }]}>
                        {d.plan.targets.calories} კკალ{d.plan.targets.protein ? ` · ცილა ${d.plan.targets.protein} გ` : ''} · {d.plan.meals.length} კვება
                      </Text>
                    </Card>
                  </Section>
                ) : null}
                <Section title="კავშირი">
                  <Button label="კლიენტთან კავშირის დასრულება" icon={UserMinus} kind="danger" onPress={end} />
                </Section>
              </>
            ) : null}

            {tab === 'food' && n ? (
              <>
                <Card style={{ marginTop: 14, flexDirection: 'row', gap: 6 }}>
                  <Stat label="გეგმის დაცვა" value={n.score != null ? `${n.score}%` : '—'} />
                  <Stat label="გეგმა" value={n.targets ? `${n.targets.calories}` : '—'} hint="კკალ / დღე" />
                  <Stat label="ბოლო ჩანაწერი" value={n.lastMealYmd ? dayLabel(n.lastMealYmd) : '—'} />
                </Card>
                {!n.targets ? (
                  <Button label="კვების გეგმის შედგენა" icon={UtensilsCrossed} style={{ marginTop: 12 }} onPress={() => router.push(`/coach/plan/${d.client.id}` as never)} />
                ) : null}
                <Section title="დღეს">
                  <Card style={{ paddingVertical: 6 }}>
                    {n.today.length ? (
                      n.today.map((m, i) => (
                        <View key={m.id} style={[coachStyles.row, { paddingVertical: 10, borderBottomWidth: i < n.today.length - 1 ? 0.5 : 0, borderColor: c.bg300 }]}>
                          <Text style={[hubText.caption, { color: c.text300, width: 42 }]}>{m.time}</Text>
                          <Text numberOfLines={2} style={[hubText.body, { color: c.text100, flex: 1 }]}>{m.title || 'კვება'}</Text>
                          <Text style={[hubText.value, { color: c.text100 }]}>{m.calories}</Text>
                        </View>
                      ))
                    ) : (
                      <Text style={[hubText.body, { color: c.text200, paddingVertical: 10 }]}>დღეს ჯერ არაფერი ჩაუწერია.</Text>
                    )}
                  </Card>
                </Section>
                <Section title="14 დღე">
                  <Card style={{ paddingVertical: 6 }}>
                    {[...n.days].reverse().map((day, i) => (
                      <View key={day.date} style={[coachStyles.row, { paddingVertical: 9, borderBottomWidth: i < n.days.length - 1 ? 0.5 : 0, borderColor: c.bg300 }]}>
                        <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: dayStatusColor(day.status, dark) }} />
                        <Text style={[hubText.body, { color: c.text100, width: 92 }]}>{dayLabel(day.date)}</Text>
                        <Text style={[hubText.body, { color: c.text200, flex: 1 }]}>{day.meals ? `${day.calories} კკალ · ც ${day.protein} · ნ ${day.carbs} · ცხ ${day.fat}` : '—'}</Text>
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
                    <Stat label="ახლა" value={w.currentKg ? `${w.currentKg} კგ` : '—'} hint={w.lastWeighYmd ? dayLabel(w.lastWeighYmd) : undefined} />
                    <Stat label="მიზანი" value={w.goal ? `${w.goal.targetKg} კგ` : '—'} hint={w.goal ? `ვადა ${w.goal.deadlineYmd}` : undefined} />
                    <Stat label="პროგრესი" value={w.progress ? `${w.progress.percent}%` : '—'} hint={w.progress ? `დარჩა ${Math.abs(w.progress.remainingKg)} კგ` : undefined} />
                  </View>
                  <WeightChart series={w.series} goal={w.goal} />
                  <Text style={[hubText.small, { color: c.text300 }]}>ყვითელი ხაზი — მიზანი და იდეალური გზა ვადამდე.</Text>
                </Card>
                <Button label={w.goal ? 'ახალი მიზნის შეთავაზება' : 'მიზნის შეთავაზება'} icon={Target} kind="secondary" style={{ marginTop: 12 }} onPress={() => router.push(`/coach/goal/${d.client.id}` as never)} />
              </>
            ) : null}

            {tab === 'training' ? (
              <>
                {a ? (
                  <Section title="ნაბიჯები · 7 დღე" style={{ marginTop: 14 }}>
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
                      {!steps7.length ? <Text style={[hubText.body, { color: c.text200 }]}>ნაბიჯების მონაცემი არ არის.</Text> : null}
                    </Card>
                  </Section>
                ) : null}
                <Section title="ვარჯიშები შენთან" style={!a ? { marginTop: 14 } : undefined}>
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
                            <View style={[coachStyles.row, { gap: 4 }]}><Timer size={14} color={c.text300} /><Text style={[hubText.small, { color: c.text200 }]}>{s.workout.durationMin} წთ</Text></View>
                            {s.workout.kcal ? <View style={[coachStyles.row, { gap: 4 }]}><Flame size={14} color="#F97316" /><Text style={[hubText.small, { color: c.text200 }]}>{s.workout.kcal} კკალ</Text></View> : null}
                            {s.workout.avgHeartRate ? <View style={[coachStyles.row, { gap: 4 }]}><HeartPulse size={14} color="#E11D48" /><Text style={[hubText.small, { color: c.text200 }]}>{s.workout.avgHeartRate} bpm</Text></View> : null}
                          </View>
                        ) : null}
                      </Card>
                    ))
                  ) : (
                    <Card>
                      <Text style={[hubText.body, { color: c.text200 }]}>ჩატარებული ვარჯიში ჯერ არ არის.</Text>
                    </Card>
                  )}
                </Section>
                {a?.workouts.length ? (
                  <Section title="დამოუკიდებელი ვარჯიშები (საათი / ტელეფონი)">
                    <Card style={{ paddingVertical: 6 }}>
                      {a.workouts.slice(0, 12).map((x, i) => (
                        <View key={x.id} style={[coachStyles.row, { paddingVertical: 10, borderBottomWidth: i < Math.min(12, a.workouts.length) - 1 ? 0.5 : 0, borderColor: c.bg300 }]}>
                          <Footprints size={16} color={c.primary100} />
                          <Text style={[hubText.body, { color: c.text100, flex: 1 }]}>
                            {workoutKindLabel(x.kind)} · {dayLabel(x.date)}
                          </Text>
                          <Text style={[hubText.caption, { color: c.text200 }]}>
                            {x.durationMin} წთ{x.kcal ? ` · ${x.kcal} კკალ` : ''}
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
                      <Text style={[hubText.body, { color: c.text200 }]}>ამ რაკურსით შესადარებლად მინიმუმ ორი ფოტოა საჭირო.</Text>
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
