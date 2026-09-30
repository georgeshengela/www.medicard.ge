import React, { useCallback, useState } from 'react';
import { Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Clock3, Plus, UtensilsCrossed } from 'lucide-react-native';
import { api, ApiError } from '@/lib/api';
import { localAccountId } from '@/lib/localAccount';
import { DAY_STATUS_LABEL, dayLabel, dayStatusColor, type ClientOverview } from '@/lib/coach';
import { Button, Card, CoachHeader, DayStrip, EmptyNote, ErrorBox, Loading, Screen, Section, Stat, coachStyles } from '@/components/coach/CoachUI';
import { hubText } from '@/theme/hub';
import { useIsDark, useThemeColors } from '@/theme/colors';
import { EMPTY_ART } from '@/constants/appArt';
import { tx } from '@/i18n/locale';

const SLOT_KA: Record<string, string> = { breakfast: tx('საუზმე', 'Breakfast'), snack1: tx('წახემსება', 'Snack'), lunch: tx('სადილი', 'Lunch'), snack2: tx('მეორე წახემსება', 'Second snack'), dinner: tx('ვახშამი', 'Dinner'), preworkout: tx('ვარჯიშამდე', 'Pre-workout'), postworkout: tx('ვარჯიშის შემდეგ', 'Post-workout') };

/** The trainer's meal plan and how the last 7 days went against it (from the person's own diary). */
export default function ClientPlanScreen() {
  const router = useRouter();
  const c = useThemeColors();
  const dark = useIsDark();
  const [ov, setOv] = useState<ClientOverview | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const owner = localAccountId();
    try {
      const o = await api.coach.overview();
      if (localAccountId() === owner) setOv(o);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : tx('ჩატვირთვა ვერ მოხერხდა.', 'Couldn’t load.'));
    }
  }, []);
  useFocusEffect(useCallback(() => void load(), [load]));

  const plan = ov?.plan;
  const days = ov?.nutrition?.days ?? [];
  const today = days[days.length - 1];
  const left = plan && today ? plan.targets.calories - today.calories : null;
  return (
    <View style={{ flex: 1, backgroundColor: c.bg100 }}>
      <CoachHeader title={tx('კვების გეგმა', 'Meal plan')} subtitle={ov?.trainer?.displayName ? tx(`ტრენერი: ${ov.trainer.displayName}`, `Trainer: ${ov.trainer.displayName}`) : undefined} fallback="/trainer" />
      <Screen>
        {error ? <ErrorBox message={error} onRetry={load} /> : null}
        {!ov && !error ? <Loading /> : null}
        {ov && !plan ? (
          <Card style={{ marginTop: 8 }}>
            <EmptyNote icon={UtensilsCrossed} art={EMPTY_ART.diary} title={tx('გეგმა ჯერ არ არის', 'No plan yet')} body={tx('როცა ტრენერი კვების გეგმას გამოგიგზავნის, აქ გამოჩნდება და შეტყობინება მოგივა.', 'When your trainer sends a meal plan, it will show up here and you’ll get a notification.')} />
          </Card>
        ) : null}
        {plan ? (
          <>
            <Card style={{ marginTop: 8, gap: 14 }}>
              <Text style={[hubText.cardTitle, { color: c.text100, fontSize: 18 }]}>{plan.title}</Text>
              <View style={[coachStyles.row, { gap: 8 }]}>
                <Stat label={tx('კალორია', 'Calories')} value={`${plan.targets.calories}`} hint={tx('კკალ / დღე', 'kcal / day')} />
                {plan.targets.protein ? <Stat label={tx('ცილა', 'Protein')} value={`${plan.targets.protein} ${tx('გ', 'g')}`} /> : null}
                {plan.targets.carbs ? <Stat label={tx('ნახშირწყ.', 'Carbs')} value={`${plan.targets.carbs} ${tx('გ', 'g')}`} /> : null}
                {plan.targets.fat ? <Stat label={tx('ცხიმი', 'Fat')} value={`${plan.targets.fat} ${tx('გ', 'g')}`} /> : null}
              </View>
              {today ? (
                <View style={{ gap: 6 }}>
                  <View style={coachStyles.rowBetween}>
                    <Text style={[hubText.caption, { color: c.text200 }]}>{tx('დღეს:', 'Today:')} {today.calories} / {plan.targets.calories} {tx('კკალ', 'kcal')}</Text>
                    <Text style={[hubText.caption, { color: dayStatusColor(today.status, dark), fontFamily: 'NotoSansGeorgian_600SemiBold' }]}>
                      {left != null && left >= 0 ? tx(`დარჩა ${left}`, `${left} left`) : tx(`გადაჭარბება ${Math.abs(left ?? 0)}`, `${Math.abs(left ?? 0)} over`)}
                    </Text>
                  </View>
                  <View style={{ height: 10, borderRadius: 5, backgroundColor: c.bg200, overflow: 'hidden' }}>
                    <View style={{ width: `${Math.min(100, Math.round((today.calories / plan.targets.calories) * 100))}%`, height: 10, borderRadius: 5, backgroundColor: dayStatusColor(today.status === 'PENDING' ? 'PENDING' : today.status, dark) }} />
                  </View>
                </View>
              ) : null}
              <Button label={tx('კვების ჩაწერა', 'Log food')} icon={Plus} onPress={() => router.push('/nutrition/diary' as never)} />
            </Card>

            <Section title={tx('ბოლო 7 დღე', 'Last 7 days')}>
              <Card style={{ gap: 12 }}>
                <DayStrip days={days} labels />
                {[...days].reverse().map((d) => (
                  <View key={d.date} style={[coachStyles.row, { gap: 8 }]}>
                    <Text numberOfLines={1} style={[hubText.body, { color: c.text100, width: 84 }]}>{dayLabel(d.date)}</Text>
                    <Text numberOfLines={1} style={[hubText.caption, { color: c.text200, flex: 1 }]}>
                      {d.meals ? tx(`${d.calories} კკალ · ც ${d.protein} გ`, `${d.calories} kcal · P ${d.protein} g`) : '—'}
                    </Text>
                    <Text numberOfLines={1} style={[hubText.caption, { color: dayStatusColor(d.status, dark), fontFamily: 'NotoSansGeorgian_600SemiBold', textAlign: 'right' }]}>{DAY_STATUS_LABEL[d.status]}</Text>
                  </View>
                ))}
                {ov?.nutrition?.score != null ? <Text style={[hubText.small, { color: c.text300 }]}>{tx(`გეგმის დაცვა: ${ov.nutrition.score}% (დასრულებული, ჩაწერილი დღეები)`, `Plan adherence: ${ov.nutrition.score}% (completed, logged days)`)}</Text> : null}
              </Card>
            </Section>

            {plan.meals.length ? (
              <Section title={tx('დღის მენიუ', 'Daily menu')}>
                {plan.meals.map((m, i) => {
                  const kcal = m.items.reduce((s, it) => s + (it.calories ?? 0), 0);
                  return (
                    <Card key={`${m.slot}${i}`} style={{ gap: 8, marginBottom: 10 }}>
                      <View style={coachStyles.rowBetween}>
                        <Text style={[hubText.cardTitle, { color: c.text100 }]}>{SLOT_KA[m.slot] ?? m.slot}</Text>
                        <View style={[coachStyles.row, { gap: 6 }]}>
                          {m.time ? (
                            <>
                              <Clock3 size={14} color={c.text300} />
                              <Text style={[hubText.caption, { color: c.text300 }]}>{m.time}</Text>
                            </>
                          ) : null}
                          {kcal ? <Text style={[hubText.caption, { color: c.text200 }]}>· {Math.round(kcal)} {tx('კკალ', 'kcal')}</Text> : null}
                        </View>
                      </View>
                      {m.items.map((it, j) => (
                        <View key={`${it.name}${j}`} style={coachStyles.rowBetween}>
                          <Text style={[hubText.body, { color: c.text200, flex: 1 }]}>• {it.name}</Text>
                          <Text style={[hubText.caption, { color: c.text300 }]}>{[it.grams ? `${it.grams} ${tx('გ', 'g')}` : null, it.calories ? `${it.calories} ${tx('კკალ', 'kcal')}` : null].filter(Boolean).join(' · ')}</Text>
                        </View>
                      ))}
                    </Card>
                  );
                })}
              </Section>
            ) : null}
            {plan.note ? (
              <Section title={tx('ტრენერის რჩევა', 'Trainer’s advice')}>
                <Card>
                  <Text style={[hubText.body, { color: c.text100, fontSize: 14, lineHeight: 22 }]}>{plan.note}</Text>
                </Card>
              </Section>
            ) : null}
            <Text style={[hubText.small, { color: c.text300, marginTop: 18 }]}>
              {tx('გეგმა ტრენერისგანაა და შენს კვების პროგრამას არ ცვლის. თუ გაქვს დიაბეტი, თირკმლის დაავადება, ორსულობა ან კვების დარღვევის ისტორია, გეგმა ექიმთანაც შეათანხმე.', 'This plan comes from your trainer and doesn’t replace your own nutrition program. If you have diabetes, kidney disease, are pregnant or have a history of an eating disorder, check the plan with your doctor too.')}
            </Text>
          </>
        ) : null}
      </Screen>
    </View>
  );
}
