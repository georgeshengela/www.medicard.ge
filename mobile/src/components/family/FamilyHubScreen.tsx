/**
 * MEDIFAMILY hub: the standard module header, the children as avatar chips (when there is more than one),
 * then the chosen child's page. With no child yet it is a welcome that invites the first one.
 */
import React, { useEffect, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Plus, Ruler, ShieldCheck, Sparkles, Syringe } from 'lucide-react-native';
import { ModuleHeader, ModuleHeaderButton } from '@/components/brand/ModuleHeader';
import { MediOrb } from '@/components/medi/MediOrb';
import { Bone } from '@/components/ui/Skeleton';
import { useAccountQuery } from '@/hooks/useAccountQuery';
import { familyApi } from '@/lib/family/familyApi';
import { FRESH, invalidate } from '@/lib/queryClient';
import { HUB } from '@/theme/hub';
import { MODULE_BRANDS } from '@/theme/moduleBrand';
import { tx } from '@/i18n/locale';
import { FamilyChildPage } from './FamilyChildPage';
import { ChildAvatar, FamilyButton, FamilyCard, FONT, FText, toneColors, useFamilyInk } from './FamilyUI';

let lastChosen: string | null = null;

/** The hub opens on this child next time (after adding one, or from a notification). */
export function chooseChild(id: string) {
  lastChosen = id;
}

export function FamilyHubScreen({ initialId }: { initialId?: string }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { c, ink, fill, dark } = useFamilyInk();
  const list = useAccountQuery({ key: ['family', 'list'], fetch: familyApi.list, staleTime: FRESH.SHORT });
  const members = list.data?.members ?? [];
  const [chosen, setChosen] = useState<string | null>(initialId ?? lastChosen);
  const current = members.find((m) => m.id === chosen) ?? members[0] ?? null;
  useEffect(() => { if (current) lastChosen = current.id; }, [current?.id]);
  const [refreshing, setRefreshing] = useState(false);
  const refresh = async () => { setRefreshing(true); try { await invalidate('family'); await list.refetch(); } finally { setRefreshing(false); } };
  const full = members.length >= (list.data?.maxChildren ?? 12);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: c.bg100 }}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingTop: insets.top + 12, paddingHorizontal: HUB.gutter, paddingBottom: insets.bottom + 40, gap: 20 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} tintColor={ink} />}
    >
      <ModuleHeader
        module="family"
        subtitle={tx('ოჯახის ჯანმრთელობა', 'Family health')}
        fallbackHref="/(tabs)/home"
        right={full ? undefined : <ModuleHeaderButton label={tx('შვილის დამატება', 'Add a child')} icon={Plus} onPress={() => router.push('/family/new')} />}
      />
      {!list.data ? (
        list.isError ? (
          <FamilyCard style={{ gap: 12 }}>
            <FText weight="semi">{tx('ვერ ჩაიტვირთა. შეამოწმე ინტერნეტი.', 'Could not load. Check your connection.')}</FText>
            <FamilyButton label={tx('თავიდან ცდა', 'Try again')} variant="secondary" onPress={() => void list.refetch()} />
          </FamilyCard>
        ) : (
          <View style={{ gap: 16 }}><Bone height={260} radius={HUB.cardRadius + 4} /><Bone height={84} radius={HUB.cardRadius} /></View>
        )
      ) : !members.length ? (
        <FamilyWelcome onAdd={() => router.push('/family/new')} />
      ) : (
        <>
          {members.length > 1 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }} style={{ marginHorizontal: -HUB.gutter }} contentInset={{ left: HUB.gutter, right: HUB.gutter }}>
              <View style={{ width: HUB.gutter - 8 }} />
              {members.map((m) => {
                const on = m.id === current?.id;
                return (
                  <Pressable key={m.id} accessibilityRole="tab" accessibilityState={{ selected: on }} accessibilityLabel={`${m.name}, ${m.age.label}`} onPress={() => setChosen(m.id)}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingLeft: 6, paddingRight: 14, height: 48, borderRadius: 24, backgroundColor: on ? c.surface : 'transparent', borderWidth: 1.5, borderColor: on ? fill : c.bg200 }}>
                    <ChildAvatar name={m.name} color={m.color} size={34} />
                    <View>
                      <Text numberOfLines={1} style={{ fontFamily: on ? FONT.semi : FONT.medium, fontSize: 14, lineHeight: 18, color: c.text100 }}>{m.name}</Text>
                      {m.vaccines.overdueCount ? <Text style={{ fontFamily: FONT.medium, fontSize: 11, lineHeight: 14, color: toneColors('watch', dark).ink }}>{tx('აცრა გადაცილებულია', 'Vaccine overdue')}</Text> : null}
                    </View>
                  </Pressable>
                );
              })}
              <View style={{ width: HUB.gutter - 8 }} />
            </ScrollView>
          ) : null}
          {current ? <FamilyChildPage key={current.id} memberId={current.id} /> : null}
        </>
      )}
    </ScrollView>
  );
}

/** First visit: what MEDIFAMILY does for a child, in four plain lines, and one button. */
function FamilyWelcome({ onAdd }: { onAdd: () => void }) {
  const { c } = useFamilyInk();
  const brand = MODULE_BRANDS.family;
  const rows = [
    { icon: Syringe, title: tx('აცრები ვადებით', 'Vaccines on time'), body: tx('საქართველოს ეროვნული კალენდარი, შეხსენება 2 კვირით ადრე და იმ დღეს.', 'Georgia’s national calendar, reminders two weeks before and on the day.') },
    { icon: Ruler, title: tx('ზრდა ჯანმოს მრუდებზე', 'Growth on WHO curves'), body: tx('წონა, სიმაღლე, თავი — შენი შვილის საკუთარი ხაზი, მშვიდად ახსნილი.', 'Weight, height, head — your child’s own line, explained calmly.') },
    { icon: Sparkles, title: tx('კვება და ეტაპები ასაკით', 'Food and milestones by age'), body: tx('რა და როდის — პირველი საკვებიდან მოზარდობამდე.', 'What and when — from first foods to the teenage years.') },
  ];
  return (
    <View style={{ gap: 20 }}>
      <View style={{ borderRadius: HUB.cardRadius + 4, overflow: 'hidden' }}>
        <LinearGradient colors={brand.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ padding: 22, gap: 14 }}>
          <Text style={{ fontFamily: FONT.bold, fontSize: 24, lineHeight: 32, color: '#FFFFFF' }}>{tx('შვილის ჯანმრთელობა — ერთ ადგილას', 'Your child’s health — in one place')}</Text>
          <Text style={{ fontFamily: FONT.regular, fontSize: 15, lineHeight: 23, color: brand.onHero }}>{tx('დაბადებიდან 18 წლამდე: აცრები, ზრდა, კვება, ავადობის დღიური და Medi, რომელიც შენს შვილს იცნობს. უფასოდ და რეკლამის გარეშე.', 'From birth to 18: vaccines, growth, food, a sick-day diary and Medi, who knows your child. Free, with no ads.')}</Text>
          <Pressable accessibilityRole="button" accessibilityLabel={tx('შვილის დამატება', 'Add a child')} onPress={onAdd}
            style={{ alignSelf: 'flex-start', height: 50, paddingHorizontal: 22, borderRadius: 16, backgroundColor: '#FFFFFF', flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Plus size={18} color={brand.gradient[0]} />
            <Text style={{ fontFamily: FONT.semi, fontSize: 15, color: brand.gradient[0] }}>{tx('შვილის დამატება', 'Add a child')}</Text>
          </Pressable>
        </LinearGradient>
      </View>
      <FamilyCard style={{ gap: 4 }}>
        {rows.map(({ icon: Icon, title, body }) => (
          <View key={title} style={{ flexDirection: 'row', gap: 12, paddingVertical: 10 }}>
            <Icon size={20} color={c.primary100} style={{ marginTop: 2 }} />
            <View style={{ flex: 1, gap: 2 }}>
              <FText weight="semi">{title}</FText>
              <FText size={13} muted>{body}</FText>
            </View>
          </View>
        ))}
        <View style={{ flexDirection: 'row', gap: 12, paddingVertical: 10 }}>
          <MediOrb size={22} />
          <View style={{ flex: 1, gap: 2 }}>
            <FText weight="semi">{tx('Medi ბავშვისთვის', 'Medi for your child')}</FText>
            <FText size={13} muted>{tx('პასუხობს ბავშვის ასაკის, აცრების, ზრდისა და ალერგიების გათვალისწინებით; საშიშ ნიშანზე მაშინვე გეუბნება, როდის მიმართო ექიმს.', 'Answers with your child’s age, vaccines, growth and allergies in mind; on a danger sign it tells you at once when to see a doctor.')}</FText>
          </View>
        </View>
      </FamilyCard>
      <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 4 }}>
        <ShieldCheck size={16} color={c.text300} />
        <FText size={12} muted style={{ flex: 1 }}>{tx('ბავშვის მონაცემებს მხოლოდ შენ ხედავ. ნებისმიერ დროს შეგიძლია სრულად წაშალო.', 'Only you can see your child’s records. You can delete them completely at any time.')}</FText>
      </View>
    </View>
  );
}
