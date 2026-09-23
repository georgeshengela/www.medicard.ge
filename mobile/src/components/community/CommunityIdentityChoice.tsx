import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { Check, LockKeyhole, UserRound } from 'lucide-react-native';
import { useThemeColors } from '@/theme/colors';

export function CommunityIdentityChoice({ anonymous, alias, locked, onChange }: {
  anonymous: boolean;
  alias: string;
  locked: boolean;
  onChange: (value: boolean) => void;
}) {
  const c = useThemeColors();
  return <View style={{ gap: 10 }}>
    <Text style={{ fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 13, color: c.text100 }}>როგორ გამოჩნდები?</Text>
    <View accessibilityRole="radiogroup" style={{ flexDirection: 'row', gap: 10 }}>
      {[false, true].map(value => {
        const active = anonymous === value;
        const Icon = value ? LockKeyhole : UserRound;
        return <Pressable key={String(value)} accessibilityRole="radio" accessibilityLabel={value ? 'ანონიმურად' : 'მეტსახელით'} accessibilityState={{ checked: active, disabled: locked }} disabled={locked} onPress={() => onChange(value)} style={{ flex: 1, padding: 12, minHeight: 72, borderRadius: 10, borderWidth: 1, borderColor: active ? c.primary100 : c.bg300, backgroundColor: 'transparent', gap: 7 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}><Icon size={20} color={active ? c.primary100 : c.text200} />{active && <Check size={17} color={c.primary100} />}</View>
          <Text style={{ fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 13, color: c.text100 }}>{value ? 'ანონიმურად' : 'მეტსახელით'}</Text>
          <Text numberOfLines={1} style={{ fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 11, color: c.text200 }}>{value ? 'ვინაობა დაფარულია' : alias}</Text>
        </Pressable>;
      })}
    </View>
    {locked && <Text style={{ fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 11, lineHeight: 18, color: c.text200 }}>ანონიმურობის დასაცავად გამოქვეყნებული ჩანაწერის ვინაობა არ იცვლება.</Text>}
  </View>;
}
