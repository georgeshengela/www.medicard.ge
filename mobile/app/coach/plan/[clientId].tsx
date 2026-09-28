import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Plus, Trash2, X } from 'lucide-react-native';
import { api, ApiError } from '@/lib/api';
import type { ClientDashboard, MealPlan } from '@/lib/coach';
import { Button, Card, Chip, CoachForm, Field, Input, Loading, Section, coachStyles } from '@/components/coach/CoachUI';
import { hubText } from '@/theme/hub';
import { useThemeColors } from '@/theme/colors';

const SLOTS: { key: string; label: string; time: string }[] = [
  { key: 'breakfast', label: 'საუზმე', time: '08:30' },
  { key: 'snack1', label: 'წახემსება', time: '11:30' },
  { key: 'lunch', label: 'სადილი', time: '14:00' },
  { key: 'preworkout', label: 'ვარჯიშამდე', time: '17:30' },
  { key: 'postworkout', label: 'ვარჯიშის შემდეგ', time: '20:00' },
  { key: 'snack2', label: 'მეორე წახემსება', time: '17:00' },
  { key: 'dinner', label: 'ვახშამი', time: '20:30' },
];
type Item = { name: string; grams: string; calories: string };
type Meal = { slot: string; time: string; items: Item[] };
const n = (v: string) => (v.trim() === '' ? null : Number(v.replace(',', '.')));

/** Trainer's meal plan for one client. Adherence is judged against these targets from the client's own diary. */
export default function CoachPlanEditor() {
  const { clientId } = useLocalSearchParams<{ clientId: string }>();
  const router = useRouter();
  const c = useThemeColors();
  const [d, setD] = useState<ClientDashboard | null>(null);
  const [title, setTitle] = useState('');
  const [kcal, setKcal] = useState('');
  const [protein, setProtein] = useState('');
  const [carbs, setCarbs] = useState('');
  const [fat, setFat] = useState('');
  const [meals, setMeals] = useState<Meal[]>([]);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void api.coach
      .client(String(clientId))
      .then((res) => {
        setD(res);
        const p = res.plan;
        if (p) {
          setTitle(p.title);
          setKcal(String(p.targets.calories));
          setProtein(p.targets.protein ? String(p.targets.protein) : '');
          setCarbs(p.targets.carbs ? String(p.targets.carbs) : '');
          setFat(p.targets.fat ? String(p.targets.fat) : '');
          setMeals(p.meals.map((m) => ({ slot: m.slot, time: m.time ?? '', items: m.items.map((i) => ({ name: i.name, grams: i.grams ? String(i.grams) : '', calories: i.calories ? String(i.calories) : '' })) })));
          setNote(p.note);
        } else {
          setTitle('ჩემი გეგმა');
          setMeals([
            { slot: 'breakfast', time: '08:30', items: [] },
            { slot: 'lunch', time: '14:00', items: [] },
            { slot: 'dinner', time: '20:00', items: [] },
          ]);
        }
      })
      .catch((e) => Alert.alert('ვერ ჩაიტვირთა', e instanceof ApiError ? e.message : 'სცადე ხელახლა.'));
  }, [clientId]);

  const kg = d?.weight?.currentKg ?? null;
  // Rough presets from body weight (kcal/kg): a starting point the trainer adjusts, not a prescription.
  const presets = kg
    ? [
        { label: 'კლება', kcal: Math.round((kg * 26) / 50) * 50, protein: Math.round(kg * 2) },
        { label: 'შენარჩუნება', kcal: Math.round((kg * 31) / 50) * 50, protein: Math.round(kg * 1.8) },
        { label: 'მატება', kcal: Math.round((kg * 36) / 50) * 50, protein: Math.round(kg * 1.8) },
      ]
    : [];
  const planned = useMemo(() => meals.reduce((s, m) => s + m.items.reduce((t, i) => t + (n(i.calories) ?? 0), 0), 0), [meals]);
  const macroKcal = (n(protein) ?? 0) * 4 + (n(carbs) ?? 0) * 4 + (n(fat) ?? 0) * 9;

  const applyPreset = (p: { label: string; kcal: number; protein: number }) => {
    setKcal(String(p.kcal));
    setProtein(String(p.protein));
    const f = Math.round((p.kcal * 0.27) / 9);
    setFat(String(f));
    setCarbs(String(Math.max(0, Math.round((p.kcal - p.protein * 4 - f * 9) / 4))));
    if (!title || title === 'ჩემი გეგმა') setTitle(`${p.label} · ${p.kcal} კკალ`);
  };

  const save = async () => {
    const cal = n(kcal);
    if (!cal || cal < 800 || cal > 6000) return Alert.alert('კალორია', 'დღიური კალორია 800–6000 უნდა იყოს.');
    if (title.trim().length < 2) return Alert.alert('სათაური', 'დაარქვი გეგმას სახელი.');
    setBusy(true);
    try {
      const body: { title: string; targets: MealPlan['targets']; meals: MealPlan['meals']; note: string } = {
        title: title.trim(),
        targets: { calories: Math.round(cal), protein: n(protein), carbs: n(carbs), fat: n(fat) },
        meals: meals.map((m) => ({ slot: m.slot, time: /^\d{2}:\d{2}$/.test(m.time) ? m.time : null, items: m.items.filter((i) => i.name.trim()).map((i) => ({ name: i.name.trim(), grams: n(i.grams), calories: n(i.calories) })) })),
        note: note.trim(),
      };
      await api.coach.savePlan(String(clientId), body);
      Alert.alert('გეგმა გაიგზავნა ✅', `${d?.client.firstName ?? 'კლიენტს'} შეტყობინება მიუვა. დაცვას „კვება“ ტაბზე ნახავ.`, [{ text: 'კარგი', onPress: () => router.back() }]);
    } catch (e) {
      Alert.alert('ვერ შეინახა', e instanceof ApiError ? e.message : 'სცადე ხელახლა.');
    } finally {
      setBusy(false);
    }
  };

  const setItem = (mi: number, ii: number, patch: Partial<Item>) => setMeals((list) => list.map((m, i) => (i === mi ? { ...m, items: m.items.map((it, j) => (j === ii ? { ...it, ...patch } : it)) } : m)));

  return (
    <CoachForm title="კვების გეგმა" subtitle={d?.client.name} fallback="/coach/clients" footer={<Button label={d?.plan ? 'ახალი ვერსიის გაგზავნა' : 'გეგმის გაგზავნა'} busy={busy} onPress={() => void save()} />}>
      {!d ? <Loading /> : null}
      {d ? (
        <>
          <Field label="სათაური">
            <Input value={title} onChangeText={setTitle} maxLength={80} placeholder="მაგ. ჭრის ფაზა · 1900 კკალ" />
          </Field>
          {presets.length ? (
            <Field label={`სწრაფი დაწყება (${kg} კგ-ზე)`} hint="საწყისი მიახლოება წონიდან — მორგება შენზეა.">
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {presets.map((p) => (
                  <Chip key={p.label} label={`${p.label} · ${p.kcal}`} onPress={() => applyPreset(p)} />
                ))}
              </View>
            </Field>
          ) : null}
          <View style={[coachStyles.row, { gap: 8 }]}>
            {[
              ['კკალ', kcal, setKcal],
              ['ცილა, გ', protein, setProtein],
              ['ნახშ., გ', carbs, setCarbs],
              ['ცხიმი, გ', fat, setFat],
            ].map(([label, value, set]) => (
              <View key={label as string} style={{ flex: 1 }}>
                <Field label={label as string}>
                  <Input inset style={{ textAlign: 'center', paddingHorizontal: 6 }} keyboardType="number-pad" value={value as string} onChangeText={(t) => (set as (v: string) => void)(t.replace(/\D/g, '').slice(0, 4))} placeholder="—" />
                </Field>
              </View>
            ))}
          </View>
          {macroKcal && n(kcal) ? (
            <Text style={[hubText.small, { color: Math.abs(macroKcal - (n(kcal) ?? 0)) > 150 ? c.warning : c.text300, marginTop: 6 }]}>
              მაკროებიდან: {Math.round(macroKcal)} კკალ{Math.abs(macroKcal - (n(kcal) ?? 0)) > 150 ? ' — კალორიას არ ემთხვევა' : ' ✓'}
            </Text>
          ) : null}

          <Section title={planned ? `მენიუ · ${Math.round(planned)} კკალ` : 'მენიუ'} style={{ marginTop: 22 }}>
            {meals.map((m, mi) => (
              <Card key={`${m.slot}${mi}`} style={{ marginBottom: 10, gap: 8 }}>
                <View style={coachStyles.row}>
                  <Text style={[hubText.cardTitle, { color: c.text100, flex: 1 }]}>{SLOTS.find((s) => s.key === m.slot)?.label ?? m.slot}</Text>
                  <Input inset style={{ width: 80, minHeight: 40, textAlign: 'center' }} value={m.time} onChangeText={(t) => setMeals((list) => list.map((x, i) => (i === mi ? { ...x, time: t.replace(/[^\d:]/g, '').slice(0, 5) } : x)))} placeholder="08:30" keyboardType="numbers-and-punctuation" />
                  <Pressable accessibilityRole="button" accessibilityLabel="კვების წაშლა" hitSlop={10} onPress={() => setMeals((list) => list.filter((_, i) => i !== mi))}>
                    <X size={18} color={c.text300} />
                  </Pressable>
                </View>
                {m.items.map((it, ii) => (
                  <View key={ii} style={[coachStyles.row, { gap: 6 }]}>
                    <Input inset style={{ flex: 2.2, minHeight: 42 }} value={it.name} onChangeText={(t) => setItem(mi, ii, { name: t })} placeholder="პროდუქტი" />
                    <Input inset style={{ flex: 1, minHeight: 42, textAlign: 'center', paddingHorizontal: 4 }} keyboardType="number-pad" value={it.grams} onChangeText={(t) => setItem(mi, ii, { grams: t.replace(/\D/g, '').slice(0, 4) })} placeholder="გ" />
                    <Input inset style={{ flex: 1, minHeight: 42, textAlign: 'center', paddingHorizontal: 4 }} keyboardType="number-pad" value={it.calories} onChangeText={(t) => setItem(mi, ii, { calories: t.replace(/\D/g, '').slice(0, 4) })} placeholder="კკალ" />
                    <Pressable accessibilityRole="button" accessibilityLabel="წაშლა" hitSlop={8} onPress={() => setMeals((list) => list.map((x, i) => (i === mi ? { ...x, items: x.items.filter((_, j) => j !== ii) } : x)))}>
                      <Trash2 size={16} color={c.text300} />
                    </Pressable>
                  </View>
                ))}
                <Button label="პროდუქტის დამატება" icon={Plus} kind="ghost" style={{ minHeight: 40 }} onPress={() => setMeals((list) => list.map((x, i) => (i === mi ? { ...x, items: [...x.items, { name: '', grams: '', calories: '' }] } : x)))} />
              </Card>
            ))}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {SLOTS.filter((s) => !meals.some((m) => m.slot === s.key)).map((s) => (
                <Chip key={s.key} label={`+ ${s.label}`} onPress={() => setMeals((list) => [...list, { slot: s.key, time: s.time, items: [] }])} />
              ))}
            </View>
          </Section>

          <Field label="რჩევა კლიენტს">
            <Input value={note} onChangeText={setNote} multiline maxLength={1000} placeholder="მაგ. ყოველ კვებაში ცილა, 2.5 ლ წყალი, შაქრიანი სასმელი — არა" />
          </Field>
          <Text style={[hubText.small, { color: c.text300, marginTop: 10 }]}>
            გეგმა კლიენტის პირად კვების პროგრამას არ ცვლის. სამედიცინო მდგომარეობისას (დიაბეტი, თირკმელი, ორსულობა, კვების დარღვევა) კლიენტმა ექიმთანაც უნდა შეათანხმოს.
          </Text>
          <View style={{ height: 12 }} />
        </>
      ) : null}
    </CoachForm>
  );
}
