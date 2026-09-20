import React from 'react';
import { Linking, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MapPin, Settings2 } from 'lucide-react-native';
import { ProfileSetupPrimaryButton } from '@/components/profile/ProfileSetupButtons';
import { APP_MODAL_OVERLAY } from '@/components/ui/appModal';
import { useThemeColors } from '@/theme/colors';

type Props = { visible: boolean; busy?: boolean; error?: string | null; denied?: boolean; onEnable: () => void; onSkip: () => void };
export function LocationAskModal({ visible, busy, error, denied, onEnable, onSkip }: Props) {
  const colors = useThemeColors(), insets = useSafeAreaInsets();
  if (!visible) return null;
  // Main-window overlay: the OS location prompt must originate from a direct tap.
  return <View accessibilityViewIsModal style={{ position: 'absolute', inset: 0, zIndex: 9000, elevation: 9000 }}>
    <Pressable accessibilityRole="button" accessibilityLabel="მოგვიანებით" disabled={busy} onPress={onSkip} style={{ position: 'absolute', inset: 0, backgroundColor: APP_MODAL_OVERLAY }} />
    <ScrollView pointerEvents="box-none" contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', paddingHorizontal: 22, paddingTop: insets.top + 16, paddingBottom: Math.max(insets.bottom, 20) }}>
      <View style={{ backgroundColor: colors.surface, borderRadius: 26, borderWidth: 1, borderColor: colors.bg300, padding: 22, gap: 16 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}><View style={{ width: 46, height: 46, borderRadius: 16, backgroundColor: colors.accent100, alignItems: 'center', justifyContent: 'center' }}><MapPin size={24} color={colors.primary100} /></View><Text style={{ flex: 1, fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 20, lineHeight: 28, color: colors.text100 }}>რომელ ქალაქში ხარ?</Text></View>
        <Text style={{ fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 14, lineHeight: 23, color: colors.text200 }}>დააფიქსირე ქვეყანა და ქალაქი, რომ შენს მდებარეობაზე მორგებული ამინდი ნახო. GPS-ს მხოლოდ შენი მოქმედებისას გამოვიყენებთ.</Text>
        {error ? <Text accessibilityLiveRegion="polite" style={{ fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 13, lineHeight: 21, color: colors.danger }}>{error}</Text> : null}
        <ProfileSetupPrimaryButton label={busy ? 'ვადგენთ მდებარეობას…' : 'ქალაქის ავტომატურად დაფიქსირება'} onPress={onEnable} loading={busy} icon="none" />
        {denied ? <Pressable accessibilityRole="button" disabled={busy} onPress={() => void Linking.openSettings().catch(() => undefined)} style={{ minHeight: 44, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center' }}><Settings2 size={18} color={colors.primary100} /><Text style={{ fontFamily: 'NotoSansGeorgian_600SemiBold', color: colors.primary100 }}>პარამეტრების გახსნა</Text></Pressable> : null}
        <Pressable accessibilityRole="button" disabled={busy} onPress={onSkip} style={{ minHeight: 44, alignItems: 'center', justifyContent: 'center', opacity: busy ? .5 : 1 }}><Text style={{ fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 14, color: colors.text200 }}>მოგვიანებით</Text></Pressable>
      </View>
    </ScrollView>
  </View>;
}
