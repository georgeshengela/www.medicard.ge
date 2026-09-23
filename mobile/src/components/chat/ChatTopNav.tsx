import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft, SlidersHorizontal, type LucideIcon } from 'lucide-react-native';
import { useFigmaChat } from '@/constants/figmaChatLayout';

type Props = {
  title: string; subtitle?: string; icon: LucideIcon; remainingLabel?: string;
  modelBadge?: string; onBack?: () => void; onSettings?: () => void;
};

export function ChatTopNav({ title, subtitle, icon: Icon, remainingLabel, modelBadge, onBack, onSettings }: Props) {
  const C = useFigmaChat();
  const insets = useSafeAreaInsets();
  return <View style={{ paddingTop: insets.top, backgroundColor: C.white, borderBottomWidth: 1, borderBottomColor: C.border }}>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 10 }}>
      {onBack ? <Pressable accessibilityRole="button" accessibilityLabel="უკან დაბრუნება" onPress={onBack}
        style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 16 }}>
        <ChevronLeft size={24} color={C.textPrimary} />
      </Pressable> : null}
      <View style={{ width: 40, height: 40, borderRadius: 14, backgroundColor: C.brandQuaternary, alignItems: 'center', justifyContent: 'center' }}>
        <Icon size={22} color={C.brand} strokeWidth={1.8} />
      </View>
      <View style={{ flex: 1, minWidth: 0, gap: 3, paddingLeft: 2 }}>
        <Text style={{ fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 15, lineHeight: 21, color: C.textPrimary }} numberOfLines={2}>{title}</Text>
        {subtitle || remainingLabel || modelBadge ? <Text style={{ fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 11, lineHeight: 16, color: C.textSecondary }} numberOfLines={1}>{subtitle || remainingLabel || modelBadge}</Text> : null}
      </View>
      {onSettings ? <Pressable accessibilityRole="button" accessibilityLabel="AI data sharing" onPress={onSettings}
        style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 16, borderWidth: 1, borderColor: C.border, backgroundColor: C.cardBg }}>
        <SlidersHorizontal size={19} color={C.textSecondary} />
      </Pressable> : null}
    </View>
  </View>;
}
