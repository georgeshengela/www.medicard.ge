import React, { useMemo, useState } from 'react';
import { Linking, Pressable, ScrollView, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AlertCircle, Check, Clock3, Minus, Plus, Syringe } from 'lucide-react-native';
import { ModuleHeader, ModuleHeaderButton } from '@/components/brand/ModuleHeader';
import { DoseSheet, ExtraVaccineSheet } from '@/components/family/FamilySheets';
import { FamilyButton, FamilyCard, FamilySection, FText, TonePill, errorText, formatYmd, relativeDays, toneColors, useFamilyInk } from '@/components/family/FamilyUI';
import { Bone } from '@/components/ui/Skeleton';
import { useAccountQuery } from '@/hooks/useAccountQuery';
import { familyApi, type VaccineItem } from '@/lib/family/familyApi';
import { FRESH } from '@/lib/queryClient';
import { reconcileFamilyReminders } from '@/lib/family/familyReminders';
import { HUB } from '@/theme/hub';
import { tx } from '@/i18n/locale';

/** The vaccine card: Georgia's calendar as a timeline by age, every dose one tap to mark. */
export default function VaccinesScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const memberId = String(id);
  const insets = useSafeAreaInsets();
  const { c, ink, fill, dark } = useFamilyInk();
  const member = useAccountQuery({ key: ['family', 'member', memberId], fetch: () => familyApi.get(memberId), staleTime: FRESH.SHORT });
  const query = useAccountQuery({ key: ['family', 'vaccines', memberId], fetch: () => familyApi.vaccines(memberId), staleTime: FRESH.SHORT });
  const [open, setOpen] = useState<VaccineItem | null>(null);
  const [extra, setExtra] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const data = query.data;
  const name = member.data?.member.name ?? '';
  const birth = member.data?.member.birthDate ?? '2000-01-01';
  const unmarkedPast = useMemo(() => (data?.items ?? []).filter((i) => i.calendarOn <= new Date().toISOString().slice(0, 10) && !i.record && i.status !== 'not_needed').length, [data]);
  const refresh = () => { void query.refetch(); void reconcileFamilyReminders({ force: true }); };
  const markPast = async () => {
    setBusy(true); setError(null);
    try { await familyApi.markPast(memberId); refresh(); } catch (e) { setError(errorText(e)); } finally { setBusy(false); }
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.bg100 }}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingTop: insets.top + 12, paddingHorizontal: HUB.gutter, paddingBottom: insets.bottom + 40, gap: HUB.sectionGap }}>
        <ModuleHeader module="family" subtitle={name ? tx(`${name} · აცრების ბარათი`, `${name} · Vaccine card`) : tx('აცრების ბარათი', 'Vaccine card')} fallbackHref={`/family/${memberId}`}
          right={<ModuleHeaderButton label={tx('სხვა ვაქცინის დამატება', 'Add another vaccine')} icon={Plus} onPress={() => setExtra(true)} />} />
        {!data ? (
          query.isError ? (
            <FamilyCard style={{ gap: 12 }}><FText>{tx('ვერ ჩაიტვირთა.', 'Could not load.')}</FText><FamilyButton label={tx('თავიდან ცდა', 'Try again')} variant="secondary" onPress={refresh} /></FamilyCard>
          ) : <View style={{ gap: 14 }}><Bone height={120} radius={HUB.cardRadius} /><Bone height={300} radius={HUB.cardRadius} /></View>
        ) : (
          <>
            <FamilyCard style={{ gap: 10 }}>
              <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 10 }}>
                <FText size={40} weight="semi" color={ink} style={{ lineHeight: 46 }}>{`${data.summary.doneForAge}`}</FText>
                <FText size={18} muted style={{ lineHeight: 34 }}>{`/ ${data.summary.totalForAge}`}</FText>
                <View style={{ flex: 1 }} />
                {data.summary.overdueCount ? <TonePill tone="watch" label={tx(`${data.summary.overdueCount} გადაცილებული`, `${data.summary.overdueCount} overdue`)} /> : <TonePill tone="ok" label={tx('დროულად', 'On time')} />}
              </View>
              <FText size={13} muted>{tx('დოზა ამ ასაკისთვის ჩაწერილია. ', 'doses for this age are recorded. ')}{data.freeNote}</FText>
              {data.summary.overdueCount ? <FText size={13}>{tx('გადაცილებული დოზა პედიატრთან დაგეგმე — სერია თავიდან არ იწყება, გაგრძელდება იქიდან, სადაც შეჩერდა.', 'Plan an overdue dose with your pediatrician — the series never restarts, it continues where it stopped.')}</FText> : null}
            </FamilyCard>

            {unmarkedPast >= 3 ? (
              <FamilyCard style={{ gap: 10 }}>
                <FText weight="semi">{tx('აქამდე ყველა აცრა გაკეთდა?', 'Were all vaccines so far given?')}</FText>
                <FText size={13} muted>{tx('ერთი შეხებით მოვნიშნავთ ყველა წარსულ დოზას „გაკეთდა, თარიღი უცნობია“-თ. შემდეგ თითოეულს შეცვლი, თუ საჭიროა.', 'One tap marks every past dose as „given, date unknown“. You can change any one later.')}</FText>
                <FamilyButton label={tx('ყველა წარსული მოვნიშნო', 'Mark all past doses')} variant="secondary" busy={busy} onPress={() => void markPast()} />
                {error ? <FText size={13} color={toneColors('alert', dark).ink}>{error}</FText> : null}
              </FamilyCard>
            ) : null}

            <View>
              {data.stages.map((stage, si) => {
                const items = data.items.filter((i) => i.stage === stage.key && i.status !== 'not_needed');
                if (!items.length) return null;
                const stageDate = items.reduce((min, i) => (i.calendarOn < min ? i.calendarOn : min), items[0].calendarOn);
                const allDone = items.every((i) => i.status === 'done' || i.status === 'skipped');
                const late = items.some((i) => i.status === 'overdue');
                const lastStage = si === data.stages.length - 1;
                return (
                  <View key={stage.key} style={{ flexDirection: 'row', gap: 12 }}>
                    <View style={{ width: 22, alignItems: 'center' }}>
                      <View style={{ width: 14, height: 14, borderRadius: 7, marginTop: 6, backgroundColor: allDone ? fill : late ? toneColors('watch', dark).ink : c.surface, borderWidth: 2, borderColor: allDone ? fill : late ? toneColors('watch', dark).ink : c.bg300 }} />
                      {!lastStage ? <View style={{ flex: 1, width: 2, backgroundColor: c.bg200, marginTop: 4 }} /> : null}
                    </View>
                    <View style={{ flex: 1, paddingBottom: 22, gap: 8 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
                        <FText weight="bold" size={16}>{stage.label}</FText>
                        <FText size={12} muted>{formatYmd(stageDate)}</FText>
                      </View>
                      <FamilyCard style={{ paddingVertical: 4 }}>
                        {items.map((item, i) => <DoseRow key={item.id} item={item} last={i === items.length - 1} onPress={() => setOpen(item)} />)}
                      </FamilyCard>
                    </View>
                  </View>
                );
              })}
            </View>

            <FamilySection title={tx('სხვა ვაქცინები', 'Other vaccines')} link={tx('დამატება', 'Add')} onLink={() => setExtra(true)}>
              <FamilyCard style={{ paddingVertical: data.extras.length ? 4 : HUB.cardPad }}>
                {data.extras.length ? data.extras.map((x, i) => (
                  <View key={x.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: i === data.extras.length - 1 ? 0 : 1, borderBottomColor: c.bg200 }}>
                    <Syringe size={18} color={ink} />
                    <View style={{ flex: 1 }}>
                      <FText weight="semi">{x.extraCode === 'other' && x.note ? x.note : x.name}</FText>
                      <FText size={12} muted>{`${formatYmd(x.givenOn)}${x.nextOn ? tx(` · შემდეგი ${formatYmd(x.nextOn)}`, ` · next ${formatYmd(x.nextOn)}`) : ''}`}</FText>
                    </View>
                    <Pressable accessibilityRole="button" accessibilityLabel={tx('წაშლა', 'Delete')} hitSlop={8} onPress={() => void familyApi.removeExtra(memberId, x.id).then(refresh)}>
                      <Minus size={18} color={c.text300} />
                    </Pressable>
                  </View>
                )) : <FText size={13} muted>{tx('ჩუტყვავილა, A ჰეპატიტი, გრიპი და სხვა — რაც პედიატრთან ერთად გადაწყვიტეთ.', 'Chickenpox, hepatitis A, flu and others — whatever you chose with your pediatrician.')}</FText>}
              </FamilyCard>
            </FamilySection>

            <Pressable accessibilityRole="link" onPress={() => void Linking.openURL(data.source.url)} style={{ paddingHorizontal: 4, gap: 4 }}>
              <FText size={12} muted>{data.source.text}</FText>
              <FText size={12} weight="semi" color={ink}>{tx(`წყარო: matsne.gov.ge · შემოწმდა ${formatYmd(data.source.checkedOn)}`, `Source: matsne.gov.ge · checked ${formatYmd(data.source.checkedOn)}`)}</FText>
            </Pressable>
          </>
        )}
      </ScrollView>
      <DoseSheet visible={Boolean(open)} memberId={memberId} birthDate={birth} item={open} onClose={() => setOpen(null)} onSaved={refresh} />
      {data ? <ExtraVaccineSheet visible={extra} memberId={memberId} birthDate={birth} catalog={data.extraCatalog} onClose={() => setExtra(false)} onSaved={refresh} /> : null}
    </View>
  );
}

function DoseRow({ item, last, onPress }: { item: VaccineItem; last: boolean; onPress: () => void }) {
  const { c, fill, dark } = useFamilyInk();
  const ok = toneColors('ok', dark), watch = toneColors('watch', dark);
  let icon: React.ReactNode;
  let status: string;
  if (item.status === 'done') {
    icon = <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: fill, alignItems: 'center', justifyContent: 'center' }}><Check size={16} color="#FFFFFF" /></View>;
    status = item.record?.givenOn ? formatYmd(item.record.givenOn) : tx('გაკეთდა', 'Given');
  } else if (item.status === 'skipped') {
    icon = <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: c.bg200, alignItems: 'center', justifyContent: 'center' }}><Minus size={16} color={c.text200} /></View>;
    status = tx('არ გაკეთდება', 'Not given');
  } else if (item.status === 'overdue') {
    icon = <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: watch.bg, alignItems: 'center', justifyContent: 'center' }}><AlertCircle size={17} color={watch.ink} /></View>;
    status = tx(`${-item.daysFromToday} დღით გვიან`, `${-item.daysFromToday} d late`);
  } else if (item.status === 'due') {
    icon = <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: ok.bg, alignItems: 'center', justifyContent: 'center' }}><Clock3 size={16} color={ok.ink} /></View>;
    status = tx('ახლა', 'Now');
  } else if (item.status === 'expired') {
    icon = <View style={{ width: 28, height: 28, borderRadius: 14, borderWidth: 1.5, borderColor: c.bg300, alignItems: 'center', justifyContent: 'center' }}><Minus size={14} color={c.text300} /></View>;
    status = tx('ასაკი გავიდა', 'Age passed');
  } else {
    icon = <View style={{ width: 28, height: 28, borderRadius: 14, borderWidth: 1.5, borderColor: c.bg300 }} />;
    status = relativeDays(item.daysFromToday);
  }
  const note = item.warningText || item.noteText;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`${item.abbr} ${item.dose}, ${item.name}, ${status}`} onPress={onPress}
      style={{ paddingVertical: 12, borderBottomWidth: last ? 0 : 1, borderBottomColor: c.bg200, gap: 6 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        {icon}
        <View style={{ flex: 1, minWidth: 0 }}>
          <FText weight="semi" lines={1}>{`${item.abbr} · ${tx(`${item.dose} დოზა`, `dose ${item.dose}`)}`}</FText>
          <FText size={12} muted lines={2}>{item.name}</FText>
        </View>
        <FText size={12} weight="semi" color={item.status === 'overdue' ? watch.ink : item.status === 'due' ? ok.ink : c.text200}>{status}</FText>
      </View>
      {note ? <FText size={12} color={item.warning ? watch.ink : c.text200} style={{ paddingLeft: 40 }}>{note}</FText> : null}
    </Pressable>
  );
}
