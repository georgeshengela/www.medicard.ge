/**
 * Profile → MEDIFAMILY: the children as one compact card (avatar · name · age · next vaccine), or one line
 * inviting the first child. Lives inside ModuleToneProvider tone="family" (coral) like its pages.
 */
import React from 'react';
import { Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ChevronRight, Plus } from 'lucide-react-native';
import { useAccountQuery } from '@/hooks/useAccountQuery';
import { familyApi } from '@/lib/family/familyApi';
import { FRESH } from '@/lib/queryClient';
import { HUB } from '@/theme/hub';
import { tx } from '@/i18n/locale';
import { ChildAvatar, FamilyCard, FText, TonePill, formatYmd, useFamilyInk } from './FamilyUI';

export function ProfileFamilySection() {
  const router = useRouter();
  const { c, ink } = useFamilyInk();
  const list = useAccountQuery({ key: ['family', 'list'], fetch: familyApi.list, staleTime: FRESH.SHORT });
  const members = list.data?.members ?? [];
  if (!list.data) return null;
  if (!members.length) {
    return (
      <FamilyCard onPress={() => router.push('/family/new')} label={tx('შვილის დამატება', 'Add a child')} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View style={{ width: HUB.tile, height: HUB.tile, borderRadius: HUB.tileRadius, backgroundColor: c.accent100, alignItems: 'center', justifyContent: 'center' }}>
          <Plus size={20} color={ink} />
        </View>
        <View style={{ flex: 1 }}>
          <FText weight="semi">{tx('შვილის დამატება', 'Add a child')}</FText>
          <FText size={12} muted>{tx('აცრები, ზრდა, კვება და Medi ბავშვისთვის', 'Vaccines, growth, food and Medi for your child')}</FText>
        </View>
        <ChevronRight size={17} color={c.text300} />
      </FamilyCard>
    );
  }
  return (
    <FamilyCard style={{ paddingVertical: 4 }}>
      {members.map((m, i) => {
        const next = m.vaccines.next;
        return (
          <Pressable key={m.id} accessibilityRole="button" accessibilityLabel={`${m.name}, ${m.age.label}`} onPress={() => router.push(`/family/${m.id}` as never)}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: i === members.length - 1 ? 0 : 1, borderBottomColor: c.bg200 }}>
            <ChildAvatar name={m.name} color={m.color} size={42} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <FText weight="semi" lines={1}>{m.name}</FText>
              <FText size={12} muted lines={1}>{m.age.label}{next && next.status !== 'overdue' ? tx(` · აცრა ${formatYmd(next.dueOn, false)}`, ` · vaccine ${formatYmd(next.dueOn, false)}`) : ''}</FText>
            </View>
            {next?.status === 'overdue' ? <TonePill tone="watch" label={tx('აცრა გვიანდება', 'Vaccine late')} /> : <ChevronRight size={17} color={c.text300} />}
          </Pressable>
        );
      })}
    </FamilyCard>
  );
}
