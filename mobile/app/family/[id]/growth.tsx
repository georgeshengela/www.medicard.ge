import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Plus, TrendingDown, TrendingUp } from 'lucide-react-native';
import { ModuleHeader, ModuleHeaderButton } from '@/components/brand/ModuleHeader';
import { ChartLegend, GrowthChart } from '@/components/family/GrowthChart';
import { MeasureSheet } from '@/components/family/FamilySheets';
import { FamilyButton, FamilyCard, FamilySection, FText, Segmented, TonePill, formatYmd, toneColors, useFamilyInk } from '@/components/family/FamilyUI';
import { SwipeDeleteRow, SwipeGroup } from '@/components/records/SwipeDeleteRow';
import { UndoToast } from '@/components/records/UndoToast';
import { useUndoDelete } from '@/components/records/useUndoDelete';
import { Bone } from '@/components/ui/Skeleton';
import { useAccountQuery } from '@/hooks/useAccountQuery';
import { familyApi, type Indicator, type Measurement } from '@/lib/family/familyApi';
import { FRESH } from '@/lib/queryClient';
import { HUB } from '@/theme/hub';
import { tx } from '@/i18n/locale';

const LABEL: Record<Indicator, string> = { wfa: tx('წონა', 'Weight'), lhfa: tx('სიმაღლე', 'Height'), hcfa: tx('თავი', 'Head'), bfa: 'BMI' };
const UNIT: Record<Indicator, string> = { wfa: tx('კგ', 'kg'), lhfa: tx('სმ', 'cm'), hcfa: tx('სმ', 'cm'), bfa: tx('კგ/მ²', 'kg/m²') };

/** Growth on the WHO curves: pick a measure, see the child's own line, read one calm sentence about it. */
export default function GrowthScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const memberId = String(id);
  const insets = useSafeAreaInsets();
  const { c, dark } = useFamilyInk();
  const member = useAccountQuery({ key: ['family', 'member', memberId], fetch: () => familyApi.get(memberId), staleTime: FRESH.SHORT });
  const query = useAccountQuery({ key: ['family', 'growth', memberId], fetch: () => familyApi.growth(memberId), staleTime: FRESH.SHORT });
  const data = query.data;
  const available = useMemo(() => (['wfa', 'lhfa', 'hcfa', 'bfa'] as Indicator[]).filter((k) => data?.indicators[k]?.window || data?.indicators[k]?.points.length), [data]);
  const [chosen, setChosen] = useState<Indicator>('wfa');
  const indicator: Indicator = available.includes(chosen) ? chosen : available[0] ?? 'wfa';
  const view = data?.indicators[indicator];
  const [sheet, setSheet] = useState(false);
  const { held, remove, undo } = useUndoDelete<Measurement>((m) => { void familyApi.removeMeasurement(memberId, m.id).then(() => query.refetch()); });
  const name = member.data?.member.name ?? '';
  const measurements = (data?.measurements ?? []).filter((m) => m.id !== held?.id);
  const latest = view?.latest;
  const trend = view?.trend;

  return (
    <View style={{ flex: 1, backgroundColor: c.bg100 }}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingTop: insets.top + 12, paddingHorizontal: HUB.gutter, paddingBottom: insets.bottom + 80, gap: HUB.sectionGap }}>
        <ModuleHeader module="family" subtitle={name ? tx(`${name} · ზრდა`, `${name} · Growth`) : tx('ზრდა', 'Growth')} fallbackHref={`/family/${memberId}`}
          right={<ModuleHeaderButton label={tx('ახალი გაზომვა', 'New measurement')} icon={Plus} onPress={() => setSheet(true)} />} />
        {!data ? <View style={{ gap: 14 }}><Bone height={44} radius={16} /><Bone height={300} radius={HUB.cardRadius} /></View> : !data.measurements.length ? (
          <FamilyCard style={{ gap: 12 }}>
            <FText weight="semi" size={16}>{tx('ჯერ გაზომვა არ არის', 'No measurements yet')}</FText>
            <FText muted>{tx('ჩაწერე წონა, სიმაღლე და (2 წლამდე) თავის გარშემოწერილობა — ნახავ ჯანმოს მრუდებზე. პედიატრთან ვიზიტის შემდეგ ბარათიდანაც შეგიძლია გადმოიტანო.', 'Log weight, height and (under 2) head size — see it on the WHO curves. You can also copy them from the pediatrician’s card after a visit.')}</FText>
            <FamilyButton label={tx('პირველი გაზომვა', 'First measurement')} onPress={() => setSheet(true)} />
          </FamilyCard>
        ) : (
          <>
            {available.length > 1 ? <Segmented value={indicator} onChange={setChosen} options={available.map((k) => ({ value: k, label: LABEL[k] }))} /> : null}
            <FamilyCard style={{ gap: 14 }}>
              {latest ? (
                <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 10 }}>
                  <FText size={34} weight="semi" style={{ lineHeight: 40 }}>{indicator === 'bfa' ? latest.value.toFixed(1) : String(latest.value)}</FText>
                  <FText size={14} muted style={{ lineHeight: 30 }}>{UNIT[indicator]}</FText>
                  <View style={{ flex: 1 }} />
                  <TonePill tone={latest.tone} label={tx(`${Math.round(latest.percentile)}-ე პერცენტილი`, `${Math.round(latest.percentile)}th percentile`)} />
                </View>
              ) : null}
              {view ? <GrowthChart data={view} unit={UNIT[indicator]} /> : null}
              <ChartLegend />
              {latest ? <FText size={14}>{latest.note}</FText> : null}
              {trend && trend.direction !== 'steady' ? (
                <View style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start', backgroundColor: toneColors('watch', dark).bg, borderRadius: 16, padding: 12 }}>
                  {trend.direction === 'falling' ? <TrendingDown size={18} color={toneColors('watch', dark).ink} /> : <TrendingUp size={18} color={toneColors('watch', dark).ink} />}
                  <FText size={13} color={toneColors('watch', dark).ink} style={{ flex: 1 }}>
                    {trend.direction === 'falling'
                      ? tx('ბოლო თვეებში ხაზიდან ქვემოთ წავიდა (ორი პერცენტილის ზოლი). ეს დიაგნოზი არ არის — აჩვენე პედიატრს.', 'It moved down across two percentile bands in recent months. Not a diagnosis — show your pediatrician.')
                      : tx('ბოლო თვეებში ხაზიდან ზემოთ ავიდა (ორი პერცენტილის ზოლი). აჩვენე პედიატრს.', 'It moved up across two percentile bands in recent months. Show your pediatrician.')}
                  </FText>
                </View>
              ) : (
                <FText size={12} muted>{tx('პერცენტილი რანჟირება არ არის: მთავარია, რომ ბავშვი თავის ხაზს მიჰყვებოდეს.', 'A percentile is not a ranking: what matters is that the child follows their own line.')}</FText>
              )}
            </FamilyCard>

            <FamilySection title={tx('გაზომვები', 'Measurements')}>
              <SwipeGroup>
                <FamilyCard style={{ paddingVertical: 4, overflow: 'hidden' }}>
                  {measurements.map((m, i) => (
                    <SwipeDeleteRow key={m.id} onDelete={() => remove(m)}>
                      {(open, a11y) => (
                        <Pressable {...a11y} accessibilityLabel={formatYmd(m.measuredOn)} onLongPress={open}
                          style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, backgroundColor: c.surface, borderBottomWidth: i === measurements.length - 1 ? 0 : 1, borderBottomColor: c.bg200 }}>
                          <FText weight="semi" style={{ width: 96 }}>{formatYmd(m.measuredOn)}</FText>
                          <FText size={13} muted style={{ flex: 1 }} lines={1}>
                            {[m.weightKg ? `${m.weightKg} ${UNIT.wfa}` : null, m.heightCm ? `${m.heightCm} ${UNIT.lhfa}` : null, m.headCm ? tx(`თავი ${m.headCm}`, `head ${m.headCm}`) : null].filter(Boolean).join(' · ')}
                          </FText>
                        </Pressable>
                      )}
                    </SwipeDeleteRow>
                  ))}
                </FamilyCard>
              </SwipeGroup>
              <FText size={12} muted>{tx('წასაშლელად ჩანაწერი მარცხნივ გადასწიე. ჯანმოს ბავშვის ზრდის სტანდარტები (0–5 წ) და 2007 წლის რეფერენსი (5–19 წ).', 'Swipe a row left to delete. WHO Child Growth Standards (0–5 y) and the 2007 reference (5–19 y).')}</FText>
            </FamilySection>
          </>
        )}
      </ScrollView>
      {held ? <UndoToast title={tx('გაზომვა წაიშალა', 'Measurement deleted')} bottom={insets.bottom + 16} onUndo={undo} /> : null}
      {member.data ? <MeasureSheet visible={sheet} memberId={memberId} birthDate={member.data.member.birthDate} ageDays={member.data.age.days} onClose={() => setSheet(false)} onSaved={() => void query.refetch()} /> : null}
    </View>
  );
}
