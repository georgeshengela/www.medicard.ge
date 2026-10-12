import React, { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Info } from 'lucide-react-native';
import { ModuleHeader } from '@/components/brand/ModuleHeader';
import { FamilyCard, FamilySection, FText, toneColors, useFamilyInk } from '@/components/family/FamilyUI';
import { Bone } from '@/components/ui/Skeleton';
import { useAccountQuery } from '@/hooks/useAccountQuery';
import { familyApi, type Checkpoint, type MilestoneItem } from '@/lib/family/familyApi';
import { FRESH } from '@/lib/queryClient';
import { HUB } from '@/theme/hub';
import { tx } from '@/i18n/locale';

const DOMAIN_ORDER: MilestoneItem['domain'][] = ['social', 'language', 'cognitive', 'movement'];

function checkpointLabel(months: number) {
  return months < 36 ? tx(`${months} თვე`, `${months} mo`) : tx(`${months / 12} წელი`, `${months / 12} y`);
}

function checkpointFor(months: number) {
  return months < 36 ? tx(`${months} თვისთვის`, `By ${months} months`) : tx(`${months / 12} წლისთვის`, `By ${months / 12} years`);
}

/** „ამ ასაკში“: the CDC/AAP 2022 milestones for the child's checkpoint (any other on a tap) and the stage tips. */
export default function GuideScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const memberId = String(id);
  const insets = useSafeAreaInsets();
  const { c, ink, fill, dark } = useFamilyInk();
  const [checkpoint, setCheckpoint] = useState<string | null>(null);
  const query = useAccountQuery({ key: ['family', 'guide', memberId, checkpoint ?? 'now'], fetch: () => familyApi.guide(memberId, checkpoint ?? undefined), staleTime: FRESH.SHORT });
  const data = query.data;
  const shown: Checkpoint | null = data ? (checkpoint ? data.checkpoint : data.milestones.current ?? data.milestones.next) : null;
  const [marks, setMarks] = useState<Record<string, 'YES' | 'NOT_YET' | null>>({});
  const statusOf = (item: MilestoneItem) => (item.key in marks ? marks[item.key] : item.status);
  const mark = async (item: MilestoneItem, status: 'YES' | 'NOT_YET') => {
    const next = statusOf(item) === status ? null : status;
    setMarks((m) => ({ ...m, [item.key]: next }));
    try {
      if (next) await familyApi.setMilestone(memberId, item.key, next);
      else await familyApi.clearMilestone(memberId, item.key);
    } catch {
      setMarks((m) => ({ ...m, [item.key]: item.status }));
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.bg100 }}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingTop: insets.top + 12, paddingHorizontal: HUB.gutter, paddingBottom: insets.bottom + 60, gap: HUB.sectionGap }}>
        <ModuleHeader module="family" subtitle={tx('ამ ასაკში', 'At this age')} fallbackHref={`/family/${memberId}`} />
        {!data ? <View style={{ gap: 14 }}><Bone height={44} radius={16} /><Bone height={360} radius={HUB.cardRadius} /></View> : (
          <>
            {data.age.days >= 45 && data.age.days < 6 * 365 ? (
              <FamilySection title={tx('განვითარების ეტაპები', 'Milestones')}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                  {data.milestones.all.map((cp) => {
                    const on = (shown?.key ?? '') === cp.key;
                    return (
                      <Pressable key={cp.key} accessibilityRole="tab" accessibilityState={{ selected: on }} onPress={() => { setCheckpoint(cp.key === data.milestones.current?.key ? null : cp.key); setMarks({}); }}
                        style={{ height: 38, paddingHorizontal: 14, borderRadius: 12, justifyContent: 'center', backgroundColor: on ? fill : c.surface }}>
                        <FText size={13} weight="semi" color={on ? '#FFFFFF' : c.text100}>{checkpointLabel(cp.months)}</FText>
                      </Pressable>
                    );
                  })}
                </ScrollView>
                {shown ? (
                  <FamilyCard style={{ gap: 4 }}>
                    <FText weight="bold" size={16}>{tx(`${checkpointFor(shown.months)} ბავშვების უმეტესობა:`, `${checkpointFor(shown.months)}, most children:`)}</FText>
                    {shown.screen ? <FText size={12} color={ink}>{tx('ამ ასაკში პედიატრი განვითარების სკრინინგს აკეთებს — ჰკითხე ვიზიტზე.', 'Pediatricians run a developmental screen at this age — ask at the visit.')}</FText> : null}
                    {DOMAIN_ORDER.map((domain) => {
                      const items = shown.items.filter((i) => i.domain === domain);
                      if (!items.length) return null;
                      return (
                        <View key={domain} style={{ gap: 2, paddingTop: 10 }}>
                          <FText size={12} weight="semi" muted>{data.milestones.domains[domain]}</FText>
                          {items.map((item) => {
                            const s = statusOf(item);
                            return (
                              <View key={item.key} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: c.bg200 }}>
                                <FText size={14} style={{ flex: 1 }}>{item.text}</FText>
                                <Pressable accessibilityRole="button" accessibilityState={{ selected: s === 'YES' }} accessibilityLabel={tx(`კი: ${item.text}`, `Yes: ${item.text}`)} onPress={() => void mark(item, 'YES')}
                                  style={{ height: 34, paddingHorizontal: 12, borderRadius: 11, justifyContent: 'center', backgroundColor: s === 'YES' ? fill : c.bg200 }}>
                                  <FText size={12} weight="semi" color={s === 'YES' ? '#FFFFFF' : c.text200}>{tx('კი', 'Yes')}</FText>
                                </Pressable>
                                <Pressable accessibilityRole="button" accessibilityState={{ selected: s === 'NOT_YET' }} accessibilityLabel={tx(`ჯერ არა: ${item.text}`, `Not yet: ${item.text}`)} onPress={() => void mark(item, 'NOT_YET')}
                                  style={{ height: 34, paddingHorizontal: 10, borderRadius: 11, justifyContent: 'center', backgroundColor: s === 'NOT_YET' ? toneColors('watch', dark).bg : 'transparent' }}>
                                  <FText size={12} weight="semi" color={s === 'NOT_YET' ? toneColors('watch', dark).ink : c.text300}>{tx('ჯერ არა', 'Not yet')}</FText>
                                </Pressable>
                              </View>
                            );
                          })}
                        </View>
                      );
                    })}
                    <View style={{ flexDirection: 'row', gap: 8, paddingTop: 12 }}>
                      <Info size={16} color={c.text300} style={{ marginTop: 2 }} />
                      <FText size={12} muted style={{ flex: 1 }}>{data.milestones.note}</FText>
                    </View>
                  </FamilyCard>
                ) : null}
              </FamilySection>
            ) : null}

            <FamilySection title={tx('რჩევები ამ ასაკისთვის', 'Tips for this age')}>
              <FamilyCard style={{ gap: 14 }}>
                {data.tips.map((tip) => (
                  <View key={tip.text} style={{ gap: 2 }}>
                    <FText size={12} weight="semi" color={ink}>{tip.label}</FText>
                    <FText size={14}>{tip.text}</FText>
                  </View>
                ))}
              </FamilyCard>
            </FamilySection>

            <FamilySection title={data.feeding.title}>
              <FamilyCard style={{ gap: 8 }}>
                {data.feeding.points.map((p) => <FText key={p} size={14}>{`• ${p}`}</FText>)}
              </FamilyCard>
            </FamilySection>
            <FText size={12} muted style={{ paddingHorizontal: 4 }}>{tx('წყაროები: ჯანმო, AAP, CDC „Learn the Signs. Act Early.“ (2022), ESPGHAN, EAACI, საქართველოს ჯანდაცვის სამინისტრო.', 'Sources: WHO, AAP, CDC „Learn the Signs. Act Early.“ (2022), ESPGHAN, EAACI, Georgia’s Ministry of Health.')}</FText>
          </>
        )}
      </ScrollView>
    </View>
  );
}
