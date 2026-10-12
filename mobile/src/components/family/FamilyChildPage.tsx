/**
 * One child's page (the MEDIFAMILY hub shows it for the chosen child): the hero with the life ribbon, four
 * one-tap logs, Medi with age-fitting questions, then vaccines → growth → feeding → this age → health.
 * Sections follow the hub rule (title outside a flat card); only the hero is coloured.
 */
import React, { useCallback, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ChevronRight, Lock, Milk, NotebookPen, Ruler, Sparkles, Stethoscope, Syringe, Thermometer } from 'lucide-react-native';
import { MediOrb } from '@/components/medi/MediOrb';
import { Bone } from '@/components/ui/Skeleton';
import { isFeatureOn } from '@/lib/featureFlags';
import { FRESH, invalidate } from '@/lib/queryClient';
import { useAccountQuery } from '@/hooks/useAccountQuery';
import { familyApi, type Indicator, type Overview, type VaccineItem } from '@/lib/family/familyApi';
import { askChips } from '@/lib/family/familyCopy';
import { HUB } from '@/theme/hub';
import { tx } from '@/i18n/locale';
import { FamilyHero } from './FamilyHero';
import { FeedSheet, MeasureSheet, SymptomSheet, TempSheet } from './FamilySheets';
import { FamilyButton, FamilyCard, FamilySection, FText, TonePill, clockOf, formatYmd, relativeDays, timeAgo, toneColors, useFamilyInk } from './FamilyUI';

type SheetKind = null | 'measure' | 'temp' | 'symptom' | 'feed';

export function FamilyChildPage({ memberId }: { memberId: string }) {
  const router = useRouter();
  const [sheet, setSheet] = useState<SheetKind>(null);
  const [feedType, setFeedType] = useState<'BREAST' | 'BOTTLE' | 'SOLID'>('BREAST');
  const { c } = useFamilyInk();
  const query = useAccountQuery({ key: ['family', 'overview', memberId], fetch: () => familyApi.overview(memberId), staleTime: FRESH.SHORT });
  const data = query.data;
  const refresh = useCallback(() => { invalidate('family'); void query.refetch(); }, [query]);
  const go = (path: string) => router.push(`/family/${memberId}/${path}` as never);

  if (!data) {
    return query.isError ? (
      <FamilyCard style={{ gap: 12 }}>
        <FText weight="semi">{tx('ვერ ჩაიტვირთა.', 'Could not load.')}</FText>
        <FamilyButton label={tx('თავიდან ცდა', 'Try again')} variant="secondary" onPress={() => void query.refetch()} />
      </FamilyCard>
    ) : (
      <View style={{ gap: HUB.sectionGap }} accessibilityLabel={tx('იტვირთება', 'Loading')}>
        <Bone height={260} radius={HUB.cardRadius + 4} />
        <Bone height={84} radius={HUB.cardRadius} />
        <Bone height={150} radius={HUB.cardRadius} />
      </View>
    );
  }
  const { member, age } = data;
  const baby = age.days < 730;
  const onHero = (action: string) => {
    if (action === 'growth') setSheet('measure');
    else if (action === 'health') setSheet('temp');
    else go(action);
  };

  return (
    <View style={{ gap: HUB.sectionGap }}>
      <FamilyHero member={member} age={age} hero={data.hero} ribbon={data.ribbon} done={data.vaccines.summary.doneForAge} total={data.vaccines.summary.totalForAge}
        onAction={onHero} onEdit={() => go('edit')} />

      <QuickActions baby={baby} onVaccine={() => go('vaccines')} onMeasure={() => setSheet('measure')} onTemp={() => setSheet('temp')}
        onFeed={() => { setFeedType('BREAST'); setSheet('feed'); }} onSymptom={() => setSheet('symptom')} />

      {isFeatureOn('familyMedi') ? <AskMedi name={member.name} stage={age.stage} onAsk={(key) => router.push(`/family/${memberId}/chat${key ? `?ask=${key}` : ''}` as never)} /> : null}

      <VaccinesBlock data={data} onOpen={() => go('vaccines')} />
      <GrowthBlock data={data} onOpen={() => go('growth')} onMeasure={() => setSheet('measure')} />
      <FeedingBlock data={data} onOpen={() => go('feeding')} onFeed={(t) => { setFeedType(t); setSheet('feed'); }} />
      <AgeBlock data={data} onOpen={() => go('guide')} />
      <HealthBlock data={data} onOpen={() => go('health')} onTemp={() => setSheet('temp')} />

      <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center', paddingHorizontal: 4 }}>
        <Lock size={14} color={c.text300} />
        <FText size={12} muted style={{ flex: 1 }}>{tx(`ამ მონაცემებს მხოლოდ შენ ხედავ. Medi მათ მხოლოდ შენი კითხვისას იყენებს.`, `Only you can see ${member.name}’s records. Medi uses them only when you ask.`)}</FText>
      </View>

      <MeasureSheet visible={sheet === 'measure'} memberId={memberId} birthDate={member.birthDate} ageDays={age.days} onClose={() => setSheet(null)} onSaved={refresh} />
      <TempSheet visible={sheet === 'temp'} memberId={memberId} ageDays={age.days} onClose={() => setSheet(null)} onSaved={refresh} />
      <SymptomSheet visible={sheet === 'symptom'} memberId={memberId} onClose={() => setSheet(null)} onSaved={refresh} />
      <FeedSheet visible={sheet === 'feed'} memberId={memberId} initialType={feedType} onClose={() => setSheet(null)} onSaved={refresh} />
    </View>
  );
}

function QuickActions({ baby, onVaccine, onMeasure, onTemp, onFeed, onSymptom }: { baby: boolean; onVaccine: () => void; onMeasure: () => void; onTemp: () => void; onFeed: () => void; onSymptom: () => void }) {
  const items = [
    { key: 'vac', label: tx('აცრა', 'Vaccine'), icon: Syringe, onPress: onVaccine },
    { key: 'measure', label: tx('გაზომვა', 'Measure'), icon: Ruler, onPress: onMeasure },
    { key: 'temp', label: tx('სიცხე', 'Temp'), icon: Thermometer, onPress: onTemp },
    baby ? { key: 'feed', label: tx('კვება', 'Feed'), icon: Milk, onPress: onFeed } : { key: 'sym', label: tx('სიმპტომი', 'Symptom'), icon: Stethoscope, onPress: onSymptom },
  ];
  const { c, ink, dark } = useFamilyInk();
  return (
    <View style={{ flexDirection: 'row', gap: 10 }}>
      {items.map(({ key, label, icon: Icon, onPress }) => (
        <Pressable key={key} accessibilityRole="button" accessibilityLabel={label} onPress={onPress}
          style={{ flex: 1, backgroundColor: c.surface, borderRadius: 20, paddingVertical: 14, alignItems: 'center', gap: 8 }}>
          <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: `${ink}${dark ? '26' : '14'}`, alignItems: 'center', justifyContent: 'center' }}>
            <Icon size={21} color={ink} />
          </View>
          <FText size={12} weight="semi" lines={1}>{label}</FText>
        </Pressable>
      ))}
    </View>
  );
}

function AskMedi({ name, stage, onAsk }: { name: string; stage: Overview['age']['stage']; onAsk: (key: string | null) => void }) {
  const { c } = useFamilyInk();
  const chips = askChips(stage);
  return (
    <View style={{ gap: 10 }}>
      <Pressable accessibilityRole="button" accessibilityLabel={tx(`ჰკითხე Medi-ს ${name}ზე`, `Ask Medi about ${name}`)} onPress={() => onAsk(null)}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: c.surface, borderRadius: 22, paddingHorizontal: 16, minHeight: 60 }}>
        <MediOrb size={30} />
        <View style={{ flex: 1 }}>
          <FText weight="semi">{tx(`ჰკითხე Medi-ს ${name}ზე`, `Ask Medi about ${name}`)}</FText>
          <FText size={12} muted>{tx('იცნობს მის ასაკს, აცრებს, ზრდას და ალერგიებს', 'Knows their age, vaccines, growth and allergies')}</FText>
        </View>
        <ChevronRight size={18} color={c.text300} />
      </Pressable>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {chips.map((chip) => (
          <Pressable key={chip.key} accessibilityRole="button" accessibilityLabel={chip.text} onPress={() => onAsk(chip.key)}
            style={{ borderRadius: 14, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: c.surface, borderWidth: 1, borderColor: c.bg200, maxWidth: '100%' }}>
            <FText size={13} lines={2}>{chip.text}</FText>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function DateDisc({ ymd, tone }: { ymd: string; tone: 'overdue' | 'due' | 'normal' }) {
  const { c, ink, dark, tint } = useFamilyInk();
  const watch = toneColors('watch', dark);
  const [d, mon] = formatYmd(ymd, false).split(' ');
  const bg = tone === 'overdue' ? watch.bg : tone === 'due' ? tint : c.bg200;
  const fg = tone === 'overdue' ? watch.ink : tone === 'due' ? ink : c.text100;
  return (
    <View style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}>
      <FText weight="bold" size={15} color={fg} style={{ lineHeight: 18 }}>{d}</FText>
      <FText size={10} color={fg} style={{ lineHeight: 13 }}>{mon}</FText>
    </View>
  );
}

export function VaccineLine({ item, last, onPress }: { item: VaccineItem; last?: boolean; onPress?: () => void }) {
  const { c } = useFamilyInk();
  const tone = item.status === 'overdue' ? 'overdue' : item.status === 'due' ? 'due' : 'normal';
  const pill = item.status === 'overdue'
    ? <TonePill tone="watch" label={tx(`${-item.daysFromToday} დღით გვიან`, `${-item.daysFromToday} d late`)} />
    : item.status === 'due' ? <TonePill tone="ok" label={tx('ახლა', 'Now')} /> : <TonePill tone="neutral" label={relativeDays(item.daysFromToday)} />;
  const row = (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderBottomWidth: last ? 0 : 1, borderBottomColor: c.bg200 }}>
      <DateDisc ymd={item.dueOn} tone={tone} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <FText weight="semi" lines={1}>{`${item.abbr} · ${tx(`${item.dose} დოზა`, `dose ${item.dose}`)}`}</FText>
        <FText size={12} muted lines={1}>{item.name}</FText>
      </View>
      {pill}
    </View>
  );
  return onPress ? <Pressable accessibilityRole="button" accessibilityLabel={`${item.abbr}, ${item.name}`} onPress={onPress}>{row}</Pressable> : row;
}

function VaccinesBlock({ data, onOpen }: { data: Overview; onOpen: () => void }) {
  const { c, fill } = useFamilyInk();
  const { summary, upcoming } = data.vaccines;
  const share = summary.totalForAge ? summary.doneForAge / summary.totalForAge : 0;
  return (
    <FamilySection title={tx('აცრები', 'Vaccines')} link={tx('ბარათი', 'Card')} onLink={onOpen}>
      <FamilyCard onPress={onOpen} label={tx('აცრების ბარათი', 'Vaccine card')} style={{ gap: 10 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <FText weight="semi" style={{ flex: 1 }}>{summary.totalForAge ? tx(`${summary.doneForAge} / ${summary.totalForAge} ამ ასაკისთვის`, `${summary.doneForAge} / ${summary.totalForAge} for this age`) : tx('პირველი აცრები დაბადებისას', 'First vaccines at birth')}</FText>
          {summary.overdueCount ? <TonePill tone="watch" label={tx(`${summary.overdueCount} გადაცილებული`, `${summary.overdueCount} overdue`)} /> : summary.totalForAge && summary.doneForAge === summary.totalForAge ? <TonePill tone="ok" label={tx('დროულად', 'On time')} /> : null}
        </View>
        <View style={{ height: 6, borderRadius: 3, backgroundColor: c.bg200, overflow: 'hidden' }}>
          <View style={{ width: `${Math.round(share * 100)}%`, height: 6, borderRadius: 3, backgroundColor: fill }} />
        </View>
        {upcoming.length ? <View>{upcoming.map((item, i) => <VaccineLine key={item.id} item={item} last={i === upcoming.length - 1} />)}</View> : (
          <FText size={13} muted>{tx('კალენდრის ყველა აცრა ჩაწერილია.', 'Every calendar vaccine is recorded.')}</FText>
        )}
      </FamilyCard>
    </FamilySection>
  );
}

const INDICATOR_LABEL: Record<Indicator, [string, string]> = { wfa: ['წონა', 'Weight'], lhfa: ['სიმაღლე', 'Height'], hcfa: ['თავი', 'Head'], bfa: ['BMI', 'BMI'] };
const UNIT: Record<Indicator, string> = { wfa: tx('კგ', 'kg'), lhfa: tx('სმ', 'cm'), hcfa: tx('სმ', 'cm'), bfa: '' };

function GrowthBlock({ data, onOpen, onMeasure }: { data: Overview; onOpen: () => void; onMeasure: () => void }) {
  const { growth, age } = data;
  const keys: Indicator[] = age.days < 731 ? ['wfa', 'lhfa', 'hcfa'] : age.days < 1826 ? ['wfa', 'lhfa', 'bfa'] : ['lhfa', 'bfa', 'wfa'];
  const shown = keys.filter((k) => growth.latest[k]);
  const falling = Object.entries(growth.trends).find(([, d]) => d === 'falling' || d === 'rising');
  return (
    <FamilySection title={tx('ზრდა', 'Growth')} link={growth.last ? tx('გრაფიკი', 'Chart') : undefined} onLink={onOpen}>
      <FamilyCard onPress={growth.last ? onOpen : undefined} label={tx('ზრდის გრაფიკი', 'Growth chart')} style={{ gap: 12 }}>
        {shown.length ? (
          <>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {shown.slice(0, 3).map((k) => {
                const p = growth.latest[k]!;
                return (
                  <View key={k} style={{ flex: 1, gap: 4 }}>
                    <FText size={12} muted>{tx(...INDICATOR_LABEL[k])}</FText>
                    <FText weight="bold" size={20} style={{ lineHeight: 26 }}>{`${k === 'bfa' ? p.value.toFixed(1) : p.value}`}<FText size={12} muted>{UNIT[k] ? ` ${UNIT[k]}` : ''}</FText></FText>
                    <TonePill tone={p.tone} label={tx(`${Math.round(p.percentile)}-ე პერც.`, `${Math.round(p.percentile)}th pct`)} />
                  </View>
                );
              })}
            </View>
            <FText size={13} muted>
              {falling ? tx('ზრდის ხაზი შეიცვალა — შეხედე გრაფიკს და აჩვენე პედიატრს.', 'The growth line changed — look at the chart and show your pediatrician.')
                : tx(`ბოლო გაზომვა: ${formatYmd(growth.last?.measuredOn)}. ჯანმოს სტანდარტებით.`, `Last measured ${formatYmd(growth.last?.measuredOn)}. WHO standards.`)}
            </FText>
            {growth.dueForCheck ? <FamilyButton label={tx('ახალი გაზომვა', 'New measurement')} icon={Ruler} variant="secondary" size="sm" onPress={onMeasure} /> : null}
          </>
        ) : (
          <>
            <FText>{tx('ჩაწერე წონა და სიმაღლე — ნახავ, როგორ იზრდება ჯანმოს მრუდებზე.', 'Log weight and height — see how they grow on the WHO curves.')}</FText>
            <FamilyButton label={tx('პირველი გაზომვა', 'First measurement')} icon={Ruler} onPress={onMeasure} />
          </>
        )}
      </FamilyCard>
    </FamilySection>
  );
}

function FeedingBlock({ data, onOpen, onFeed }: { data: Overview; onOpen: () => void; onFeed: (t: 'BREAST' | 'BOTTLE' | 'SOLID') => void }) {
  const { feeding, foods, feedingGuide, age } = data;
  const { c } = useFamilyInk();
  return (
    <FamilySection title={tx('კვება', 'Feeding')} link={tx('ყველაფერი', 'All')} onLink={onOpen}>
      <FamilyCard style={{ gap: 12 }}>
        {feeding ? (
          <>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={{ flex: 1 }}>
                <FText weight="semi">{feeding.count ? tx(`დღეს ${feeding.count} კვება${feeding.ml ? ` · ${feeding.ml} მლ` : ''}`, `${feeding.count} feeds today${feeding.ml ? ` · ${feeding.ml} ml` : ''}`) : tx('დღეს ჯერ არაფერი ჩაწერილა', 'Nothing logged today yet')}</FText>
                {feeding.last ? <FText size={12} muted>{tx(`ბოლო: ${timeAgo(feeding.last.at)} (${clockOf(feeding.last.at)})${feeding.lastSide ? ` · ${feeding.lastSide === 'L' ? 'მარცხ.' : feeding.lastSide === 'R' ? 'მარჯვ.' : 'ორივე'}` : ''}`, `Last: ${timeAgo(feeding.last.at)} (${clockOf(feeding.last.at)})${feeding.lastSide ? ` · ${feeding.lastSide === 'L' ? 'left' : feeding.lastSide === 'R' ? 'right' : 'both'}` : ''}`)}</FText> : null}
              </View>
            </View>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <FamilyButton label={tx('მკერდი', 'Breast')} variant="secondary" size="sm" style={{ flex: 1, paddingHorizontal: 8 }} onPress={() => onFeed('BREAST')} />
              <FamilyButton label={tx('ბოთლი', 'Bottle')} variant="secondary" size="sm" style={{ flex: 1, paddingHorizontal: 8 }} onPress={() => onFeed('BOTTLE')} />
              {age.correctedDays >= 120 ? <FamilyButton label={tx('საკვები', 'Solids')} variant="secondary" size="sm" style={{ flex: 1, paddingHorizontal: 8 }} onPress={() => onFeed('SOLID')} /> : null}
            </View>
          </>
        ) : null}
        {foods ? (
          <Pressable accessibilityRole="button" onPress={onOpen} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <View style={{ flex: 1 }}>
              <FText weight="semi">{tx(`ალერგენები: ${foods.allergensTried} / ${foods.allergensTotal}`, `Allergens: ${foods.allergensTried} / ${foods.allergensTotal}`)}</FText>
              <FText size={12} muted>{foods.reactions.length ? tx(`რეაქცია: ${foods.reactions.join(', ')}`, `Reaction: ${foods.reactions.join(', ')}`) : tx('ადრე და რეგულარულად — ალერგიის რისკს ამცირებს', 'Early and regularly — lowers allergy risk')}</FText>
            </View>
            <ChevronRight size={17} color={c.text300} />
          </Pressable>
        ) : null}
        {!feeding && !foods ? (
          <Pressable accessibilityRole="button" onPress={onOpen} style={{ gap: 4 }}>
            <FText weight="semi">{feedingGuide.title}</FText>
            {feedingGuide.points.slice(0, 2).map((p) => <FText key={p} size={13} muted>{`• ${p}`}</FText>)}
          </Pressable>
        ) : null}
      </FamilyCard>
    </FamilySection>
  );
}

function AgeBlock({ data, onOpen }: { data: Overview; onOpen: () => void }) {
  const { milestones, tips } = data;
  const cur = milestones?.current;
  const { ink } = useFamilyInk();
  return (
    <FamilySection title={tx('ამ ასაკში', 'At this age')} link={tx('გზამკვლევი', 'Guide')} onLink={onOpen}>
      <FamilyCard onPress={onOpen} label={tx('ასაკის გზამკვლევი', 'Age guide')} style={{ gap: 12 }}>
        {cur ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Sparkles size={20} color={ink} />
            <View style={{ flex: 1 }}>
              <FText weight="semi">{tx(`${cur.months < 36 ? `${cur.months} თვის` : `${cur.months / 12} წლის`} ეტაპები · ${cur.done}/${cur.total}`, `${cur.months < 36 ? `${cur.months}-month` : `${cur.months / 12}-year`} milestones · ${cur.done}/${cur.total}`)}</FText>
              <FText size={12} muted>{cur.screen ? tx('ამ ასაკში პედიატრი განვითარების სკრინინგს აკეთებს', 'Pediatricians screen development at this age') : tx('მონიშნე, რაც უკვე გამოსდის', 'Tick what they already do')}</FText>
            </View>
          </View>
        ) : null}
        {tips.slice(0, 2).map((tip) => (
          <View key={tip.text} style={{ gap: 2 }}>
            <FText size={12} weight="semi" color={ink}>{tip.label}</FText>
            <FText size={13}>{tip.text}</FText>
          </View>
        ))}
      </FamilyCard>
    </FamilySection>
  );
}

function HealthBlock({ data, onOpen, onTemp }: { data: Overview; onOpen: () => void; onTemp: () => void }) {
  const { health, sick, age } = data;
  const { dark, ink, c } = useFamilyInk();
  const allergyTone = toneColors('watch', dark);
  return (
    <FamilySection title={tx('ჯანმრთელობა', 'Health')} link={tx('დღიური', 'Diary')} onLink={onOpen}>
      <FamilyCard style={{ gap: 12 }}>
        {health.allergies.length ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {health.allergies.map((a) => (
              <View key={a.id} style={{ borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, backgroundColor: allergyTone.bg }}>
                <FText size={12} weight="semi" color={allergyTone.ink}>{tx(`ალერგია: ${a.name}`, `Allergy: ${a.name}`)}</FText>
              </View>
            ))}
          </View>
        ) : null}
        <Pressable accessibilityRole="button" onPress={sick.lastTemp ? onOpen : onTemp} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Thermometer size={20} color={sick.lastTemp && sick.lastTemp.c >= 38 ? toneColors(age.days < 90 ? 'alert' : 'watch', dark).ink : ink} />
          <View style={{ flex: 1 }}>
            <FText weight="semi">{sick.lastTemp ? tx(`ბოლო ტემპერატურა: ${sick.lastTemp.c.toFixed(1)}°`, `Last temperature: ${sick.lastTemp.c.toFixed(1)}°`) : tx('ავად არის? ჩაწერე ტემპერატურა', 'Unwell? Log the temperature')}</FText>
            <FText size={12} muted>{sick.lastTemp ? `${timeAgo(sick.lastTemp.at)}${sick.feverDays ? tx(` · სიცხე ${sick.feverDays} დღე`, ` · fever ${sick.feverDays} d`) : ''}` : tx('ტემპერატურა, სიმპტომები, მიცემული წამალი — ერთ ადგილას', 'Temperature, symptoms, medicine given — in one place')}</FText>
          </View>
          <ChevronRight size={17} color={c.text300} />
        </Pressable>
        <Pressable accessibilityRole="button" onPress={onOpen} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <NotebookPen size={20} color={ink} />
          <View style={{ flex: 1 }}>
            <FText weight="semi">{tx('ალერგიები, მდგომარეობები, წამლები', 'Allergies, conditions, medicines')}</FText>
            <FText size={12} muted>{health.allergies.length + health.conditions.length + health.medicines.length ? tx(`${health.allergies.length + health.conditions.length + health.medicines.length} ჩანაწერი`, `${health.allergies.length + health.conditions.length + health.medicines.length} entries`) : tx('Medi ამას ყოველ პასუხში ითვალისწინებს', 'Medi takes these into account every time')}</FText>
          </View>
          <ChevronRight size={17} color={c.text300} />
        </Pressable>
      </FamilyCard>
    </FamilySection>
  );
}
