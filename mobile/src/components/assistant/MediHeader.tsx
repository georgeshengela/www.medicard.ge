import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft } from 'lucide-react-native';
import { MediModeSwitch } from '@/components/assistant/MediModeSwitch';
import type { MediMode } from '@/lib/mediModes';
import { useThemeColors } from '@/theme/colors';
import { tx } from '@/i18n/locale';

/** One header for every Medi mode, so switching modes does not change the chrome. */
export function MediHeader({
  subtitle, mode, modes, onMode, onBack, right,
}: {
  subtitle: string;
  mode: MediMode;
  /** Modes to offer (admin can pause doctor / deep); all three by default. */
  modes?: readonly MediMode[];
  onMode: (mode: MediMode) => void;
  onBack: () => void;
  right?: React.ReactNode;
}) {
  const c = useThemeColors();
  const insets = useSafeAreaInsets();
  return (
    <View style={{ paddingTop: insets.top, backgroundColor: c.bg100 }}>
      <View style={{ height: 62, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <Pressable accessibilityRole="button" accessibilityLabel={tx('უკან დაბრუნება', 'Go back')} onPress={onBack} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 22 }}>
          <ChevronLeft size={24} color={c.text100} />
        </Pressable>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={{ color: c.text100, fontSize: 20, fontFamily: 'NotoSansGeorgian_700Bold' }}>
            Medi<Text style={{ color: c.primary200 }}>.</Text>
          </Text>
          <Text numberOfLines={1} style={{ color: c.text200, fontSize: 11, lineHeight: 20, fontFamily: 'NotoSansGeorgian_400Regular' }}>{subtitle}</Text>
        </View>
        {right}
      </View>
      <MediModeSwitch value={mode} modes={modes} onChange={onMode} />
    </View>
  );
}
