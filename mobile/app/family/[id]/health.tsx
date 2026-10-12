import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { HeartPulse, Pill, ShieldAlert, Stethoscope, Thermometer } from 'lucide-react-native';
import { ModuleHeader } from '@/components/brand/ModuleHeader';
import { HealthItemSheet, MedSheet, SymptomSheet, TempSheet } from '@/components/family/FamilySheets';
import { FamilyButton, FamilyCard, FamilySection, FText, clockOf, formatYmd, toneColors, useFamilyInk } from '@/components/family/FamilyUI';
import { SwipeDeleteRow, SwipeGroup } from '@/components/records/SwipeDeleteRow';
import { UndoToast } from '@/components/records/UndoToast';
import { useUndoDelete } from '@/components/records/useUndoDelete';
import { Bone } from '@/components/ui/Skeleton';
import { useAccountQuery } from '@/hooks/useAccountQuery';
import { isFeatureOn } from '@/lib/featureFlags';
import { familyApi, type FamilyLog, type HealthItem } from '@/lib/family/familyApi';
import { FRESH } from '@/lib/queryClient';
import { HUB } from '@/theme/hub';
import { tx } from '@/i18n/locale';

type Sheet = null | 'temp' | 'symptom' | 'med' | HealthItem['kind'];

/** Sick-day diary (temperature, symptoms, medicine given) and the standing health facts Medi always reads. */
export default function HealthScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const memberId = String(id);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { c, ink, dark } = useFamilyInk();
  const member = useAccountQuery({ key: ['family', 'member', memberId], fetch: () => familyApi.get(memberId), staleTime: FRESH.SHORT });
  const logs = useAccountQuery({ key: ['family', 'logs', memberId, 'sick'], fetch: () => familyApi.logs(memberId, 14, ['TEMP', 'SYMPTOM', 'MED', 'NOTE']), staleTime: FRESH.SHORT });
  const items = useAccountQuery({ key: ['family', 'health', memberId], fetch: () => familyApi.health(memberId), staleTime: FRESH.SHORT });
  const [sheet, setSheet] = useState<Sheet>(null);
  const reload = () => { void logs.refetch(); void items.refetch(); };
  const logUndo = useUndoDelete<FamilyLog>((l) => { void familyApi.removeLog(memberId, l.id).then(() => logs.refetch()); });
  const itemUndo = useUndoDelete<HealthItem>((h) => { void familyApi.removeHealth(memberId, h.id).then(() => items.refetch()); });
  const name = member.data?.member.name ?? '';
  const ageDays = member.data?.age.days ?? 365;
  const sick = logs.data?.sick;
  const byDay = useMemo(() => {
    const out = new Map<string, FamilyLog[]>();
    for (const l of (logs.data?.logs ?? []).filter((x) => x.id !== logUndo.held?.id)) {
      const d = new Date(l.at);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      out.set(key, [...(out.get(key) ?? []), l]);
    }
    return [...out.entries()];
  }, [logs.data, logUndo.held]);
  const healthItems = (items.data?.items ?? []).filter((h) => h.id !== itemUndo.held?.id);
  const fever = sick?.lastTemp && sick.lastTemp.c >= 38;
  const alert = toneColors(ageDays < 90 ? 'alert' : 'watch', dark);

  return (
    <View style={{ flex: 1, backgroundColor: c.bg100 }}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingTop: insets.top + 12, paddingHorizontal: HUB.gutter, paddingBottom: insets.bottom + 80, gap: HUB.sectionGap }}>
        <ModuleHeader module="family" subtitle={name ? tx(`${name} · ჯანმრთელობა`, `${name} · Health`) : tx('ჯანმრთელობა', 'Health')} fallbackHref={`/family/${memberId}`} />

        <FamilySection title={tx('ავადობის დღიური', 'Sick-day diary')}>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <FamilyButton label={tx('სიცხე', 'Temp')} variant="secondary" size="sm" style={{ flex: 1, paddingHorizontal: 8 }} onPress={() => setSheet('temp')} />
            <FamilyButton label={tx('სიმპტომი', 'Symptom')} variant="secondary" size="sm" style={{ flex: 1, paddingHorizontal: 8 }} onPress={() => setSheet('symptom')} />
            <FamilyButton label={tx('წამალი', 'Medicine')} variant="secondary" size="sm" style={{ flex: 1, paddingHorizontal: 8 }} onPress={() => setSheet('med')} />
          </View>
          {fever ? (
            <View style={{ backgroundColor: alert.bg, borderRadius: HUB.cardRadius, padding: HUB.cardPad, gap: 8 }}>
              <FText weight="bold" color={alert.ink}>{tx(`სიცხე ${sick!.lastTemp!.c.toFixed(1)}°${sick!.feverDays ? ` · ${sick!.feverDays} დღე` : ''}`, `Fever ${sick!.lastTemp!.c.toFixed(1)}°${sick!.feverDays ? ` · ${sick!.feverDays} day(s)` : ''}`)}</FText>
              <FText size={13} color={alert.ink}>{ageDays < 90
                ? tx('3 თვემდე ბავშვთან სიცხე ყოველთვის სასწრაფოა — დარეკე 112-ზე ან წადი სასწრაფოში.', 'Fever under 3 months is always urgent — call 112 or go to the emergency department.')
                : tx('სითხე ხშირად და ცოტ-ცოტა; სიცხის დამწევი — თუ ბავშვს ცუდად აქვს, შეფუთვის ცხრილით. ექიმთან: სიცხე 5 დღე ან მეტი, სუნთქვის გაძნელება, ცოტა შარდვა, გამონაყარი, რომელიც ჭიქით არ ქრება.', 'Small, frequent drinks; a fever medicine only if they feel unwell, by the box chart. See a doctor if: fever 5 days or more, hard breathing, little pee, a rash that does not fade under a glass.')}</FText>
              {isFeatureOn('familyMedi') ? <FamilyButton label={tx('ჰკითხე Medi-ს', 'Ask Medi')} size="sm" variant="secondary" style={{ alignSelf: 'flex-start' }} onPress={() => router.push(`/family/${memberId}/chat?ask=fever` as never)} /> : null}
            </View>
          ) : null}
          {!logs.data ? <Bone height={120} radius={HUB.cardRadius} /> : byDay.length ? (
            <SwipeGroup>
              <View style={{ gap: 14 }}>
                {byDay.map(([day, rows]) => (
                  <View key={day} style={{ gap: 6 }}>
                    <FText size={12} weight="semi" muted>{formatYmd(day)}</FText>
                    <FamilyCard style={{ paddingVertical: 2, overflow: 'hidden' }}>
                      {rows.map((l, i) => (
                        <SwipeDeleteRow key={l.id} onDelete={() => logUndo.remove(l)}>
                          {(open, a11y) => (
                            <Pressable {...a11y} onLongPress={open} accessibilityLabel={describeLog(l)}
                              style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11, backgroundColor: c.surface, borderBottomWidth: i === rows.length - 1 ? 0 : 1, borderBottomColor: c.bg200 }}>
                              <FText size={13} weight="semi" style={{ width: 44 }}>{clockOf(l.at)}</FText>
                              <LogIcon log={l} />
                              <FText size={14} style={{ flex: 1 }}>{describeLog(l)}</FText>
                            </Pressable>
                          )}
                        </SwipeDeleteRow>
                      ))}
                    </FamilyCard>
                  </View>
                ))}
              </View>
            </SwipeGroup>
          ) : <FText size={13} muted>{tx('როცა ავად არის, აქ ჩაწერე ტემპერატურა, სიმპტომები და მიცემული წამალი — დროით. ექიმთან და Medi-სთან ყველაფერი ერთად გექნება.', 'When they are unwell, log temperature, symptoms and medicine here — with times. You’ll have it all together for the doctor and for Medi.')}</FText>}
        </FamilySection>

        {(['ALLERGY', 'CONDITION', 'MEDICATION'] as const).map((kind) => {
          const list = healthItems.filter((h) => h.kind === kind);
          const title = kind === 'ALLERGY' ? tx('ალერგიები', 'Allergies') : kind === 'CONDITION' ? tx('მდგომარეობები', 'Conditions') : tx('მუდმივი წამლები', 'Regular medicines');
          const Icon = kind === 'ALLERGY' ? ShieldAlert : kind === 'CONDITION' ? HeartPulse : Pill;
          return (
            <FamilySection key={kind} title={title} link={tx('დამატება', 'Add')} onLink={() => setSheet(kind)}>
              <FamilyCard style={{ paddingVertical: list.length ? 2 : HUB.cardPad, overflow: 'hidden' }}>
                {list.length ? (
                  <SwipeGroup>
                    {list.map((h, i) => (
                      <SwipeDeleteRow key={h.id} onDelete={() => itemUndo.remove(h)}>
                        {(open, a11y) => (
                          <Pressable {...a11y} onLongPress={open} accessibilityLabel={h.name}
                            style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, backgroundColor: c.surface, borderBottomWidth: i === list.length - 1 ? 0 : 1, borderBottomColor: c.bg200 }}>
                            <Icon size={18} color={kind === 'ALLERGY' ? toneColors('watch', dark).ink : ink} />
                            <View style={{ flex: 1 }}>
                              <FText weight="semi">{h.name}</FText>
                              {h.detail || h.severity ? <FText size={12} muted>{[h.severity ? ({ MILD: tx('მსუბუქი', 'mild'), MODERATE: tx('საშუალო', 'moderate'), SEVERE: tx('მძიმე', 'severe') } as const)[h.severity] : null, h.detail].filter(Boolean).join(' · ')}</FText> : null}
                            </View>
                          </Pressable>
                        )}
                      </SwipeDeleteRow>
                    ))}
                  </SwipeGroup>
                ) : (
                  <FText size={13} muted>{kind === 'ALLERGY' ? tx('არ ჩაწერილა. Medi ალერგიებს ყოველ პასუხში ამოწმებს.', 'None recorded. Medi checks allergies in every answer.') : kind === 'CONDITION' ? tx('მაგ.: ასთმა, ატოპიური დერმატიტი.', 'E.g. asthma, eczema.') : tx('რასაც ექიმის დანიშნულებით რეგულარულად იღებს.', 'Whatever they take regularly as prescribed.')}</FText>
                )}
              </FamilyCard>
            </FamilySection>
          );
        })}
      </ScrollView>
      {logUndo.held ? <UndoToast title={tx('ჩანაწერი წაიშალა', 'Entry deleted')} bottom={insets.bottom + 16} onUndo={logUndo.undo} /> : null}
      {itemUndo.held ? <UndoToast title={tx('ჩანაწერი წაიშალა', 'Entry deleted')} bottom={insets.bottom + 16} onUndo={itemUndo.undo} /> : null}
      <TempSheet visible={sheet === 'temp'} memberId={memberId} ageDays={ageDays} onClose={() => setSheet(null)} onSaved={reload} />
      <SymptomSheet visible={sheet === 'symptom'} memberId={memberId} onClose={() => setSheet(null)} onSaved={reload} />
      <MedSheet visible={sheet === 'med'} memberId={memberId} onClose={() => setSheet(null)} onSaved={reload} />
      <HealthItemSheet visible={sheet === 'ALLERGY' || sheet === 'CONDITION' || sheet === 'MEDICATION'} kind={(sheet === 'ALLERGY' || sheet === 'CONDITION' || sheet === 'MEDICATION' ? sheet : 'ALLERGY')} memberId={memberId} onClose={() => setSheet(null)} onSaved={reload} />
    </View>
  );
}

function describeLog(l: FamilyLog): string {
  if (l.kind === 'TEMP') return `${Number(l.data.c).toFixed(1)} °C`;
  if (l.kind === 'MED') return `${l.data.name}${l.data.amount ? ` · ${l.data.amount}` : ''}`;
  if (l.kind === 'SYMPTOM') return [(l.data.labels || []).join(', '), l.data.note].filter(Boolean).join(' — ');
  return String(l.data.text || '');
}

function LogIcon({ log }: { log: FamilyLog }) {
  const { ink, dark } = useFamilyInk();
  if (log.kind === 'TEMP') return <Thermometer size={18} color={Number(log.data.c) >= 38 ? toneColors('watch', dark).ink : ink} />;
  if (log.kind === 'MED') return <Pill size={18} color={ink} />;
  return <Stethoscope size={18} color={ink} />;
}
