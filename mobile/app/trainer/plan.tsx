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

const SLOT_KA: Record<string, string> = { breakfast: 'საუზმე', snack1: 'წახემსება', lunch: 'სადილი', snack2: 'მეორე წახემსება', dinner: 'ვახშამი', preworkout: 'ვარჯიშამდე', postworkout: 'ვარჯიშის შემდეგ' };

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
      setError(e instanceof ApiError ? e.message : 'ჩატვირთვა ვერ მოხერხდა.');
    }
  }, []);
  useFocusEffect(useCallback(() => void load(), [load]));

  const plan = ov?.plan;
  const days = ov?.nutrition?.days ?? [];
  const today = days[days.length - 1];
  const left = plan && today ? plan.targets.calories - today.calories : null;
  return (
    <View style={{ flex: 1, backgroundColor: c.bg100 }}>
      <CoachHeader title="კვების გეგმა" subtitle={ov?.trainer?.displayName ? `ტრენერი: ${ov.trainer.displayName}` : undefined} fallback="/trainer" />
      <Screen>
        {error ? <ErrorBox message={error} onRetry={load} /> : null}
        {!ov && !error ? <Loading /> : null}
        {ov && !plan ? (
          <Card style={{ marginTop: 8 }}>
            <EmptyNote icon={UtensilsCrossed} title="გეგმა ჯერ არ არის" body="როცა ტრენერი კვების გეგმას გამოგიგზავნის, აქ გამოჩნდება და შეტყობინება მოგივა." />
          </Card>
        ) : null}
        {plan ? (
          <>
            <Card style={{ marginTop: 8, gap: 14 }}>
              <Text style={[hubText.cardTitle, { color: c.text100, fontSize: 18 }]}>{plan.title}</Text>
              <View style={[coachStyles.row, { gap: 8 }]}>
                <Stat label="კალორია" value={`${plan.targets.calories}`} hint="კკალ / დღე" />
                {plan.targets.protein ? <Stat label="ცილა" value={`${plan.targets.protein} გ`} /> : null}
                {plan.targets.carbs ? <Stat label="ნახშირწყ." value={`${plan.targets.carbs} გ`} /> : null}
                {plan.targets.fat ? <Stat label="ცხიმი" value={`${plan.targets.fat} გ`} /> : null}
              </View>
              {today ? (
                <View style={{ gap: 6 }}>
                  <View style={coachStyles.rowBetween}>
                    <Text style={[hubText.caption, { color: c.text200 }]}>დღეს: {today.calories} / {plan.targets.calories} კკალ</Text>
                    <Text style={[hubText.caption, { color: dayStatusColor(today.status, dark), fontFamily: 'NotoSansGeorgian_600SemiBold' }]}>
                      {left != null && left >= 0 ? `დარჩა ${left}` : `გადაჭარბება ${Math.abs(left ?? 0)}`}
                    </Text>
                  </View>
                  <View style={{ height: 10, borderRadius: 5, backgroundColor: c.bg200, overflow: 'hidden' }}>
                    <View style={{ width: `${Math.min(100, Math.round((today.calories / plan.targets.calories) * 100))}%`, height: 10, borderRadius: 5, backgroundColor: dayStatusColor(today.status === 'PENDING' ? 'PENDING' : today.status, dark) }} />
                  </View>
                </View>
              ) : null}
              <Button label="კვების ჩაწერა" icon={Plus} onPress={() => router.push('/nutrition/diary' as never)} />
            </Card>

            <Section title="ბოლო 7 დღე">
              <Card style={{ gap: 12 }}>
                <DayStrip days={days} labels />
                {[...days].reverse().map((d) => (
                  <View key={d.date} style={[coachStyles.row, { gap: 8 }]}>
                    <Text numberOfLines={1} style={[hubText.body, { color: c.text100, width: 84 }]}>{dayLabel(d.date)}</Text>
                    <Text numberOfLines={1} style={[hubText.caption, { color: c.text200, flex: 1 }]}>
                      {d.meals ? `${d.calories} კკალ · ც ${d.protein} გ` : '—'}
                    </Text>
                    <Text numberOfLines={1} style={[hubText.caption, { color: dayStatusColor(d.status, dark), fontFamily: 'NotoSansGeorgian_600SemiBold', textAlign: 'right' }]}>{DAY_STATUS_LABEL[d.status]}</Text>
                  </View>
                ))}
                {ov?.nutrition?.score != null ? <Text style={[hubText.small, { color: c.text300 }]}>გეგმის დაცვა: {ov.nutrition.score}% (დასრულებული, ჩაწერილი დღეები)</Text> : null}
              </Card>
            </Section>

            {plan.meals.length ? (
              <Section title="დღის მენიუ">
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
                          {kcal ? <Text style={[hubText.caption, { color: c.text200 }]}>· {Math.round(kcal)} კკალ</Text> : null}
                        </View>
                      </View>
                      {m.items.map((it, j) => (
                        <View key={`${it.name}${j}`} style={coachStyles.rowBetween}>
                          <Text style={[hubText.body, { color: c.text200, flex: 1 }]}>• {it.name}</Text>
                          <Text style={[hubText.caption, { color: c.text300 }]}>{[it.grams ? `${it.grams} გ` : null, it.calories ? `${it.calories} კკალ` : null].filter(Boolean).join(' · ')}</Text>
                        </View>
                      ))}
                    </Card>
                  );
                })}
              </Section>
            ) : null}
            {plan.note ? (
              <Section title="ტრენერის რჩევა">
                <Card>
                  <Text style={[hubText.body, { color: c.text100, fontSize: 14, lineHeight: 22 }]}>{plan.note}</Text>
                </Card>
              </Section>
            ) : null}
            <Text style={[hubText.small, { color: c.text300, marginTop: 18 }]}>
              გეგმა ტრენერისგანაა და შენს კვების პროგრამას არ ცვლის. თუ გაქვს დიაბეტი, თირკმლის დაავადება, ორსულობა ან კვების დარღვევის ისტორია, გეგმა ექიმთანაც შეათანხმე.
            </Text>
          </>
        ) : null}
      </Screen>
    </View>
  );
}
