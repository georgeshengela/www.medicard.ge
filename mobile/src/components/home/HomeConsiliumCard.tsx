import React from 'react';
import { Pressable, Text, View } from 'react-native';
import {
  ArrowUpRight,
  Brain,
  MessagesSquare,
  ScanSearch,
} from 'lucide-react-native';
import { useIsDark } from '@/theme/colors';

/** AI perspectives, never a claim that human doctors have been convened. */
export function HomeConsiliumCard({ onPress }: { onPress: () => void }) {
  const dark = useIsDark();
  const ink = dark ? '#EEEAFE' : '#373259';
  const secondary = dark ? '#CBC6E5' : '#615D7D';
  const accent = dark ? '#C4B5FD' : '#6B50A0';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="AI კონსილიუმი — განხილვის დაწყება"
      onPress={onPress}
      style={{
        padding: 22,
        borderRadius: 24,
        backgroundColor: dark ? '#202039' : '#F0EDF9',
        borderWidth: 1,
        borderColor: dark ? '#3C3757' : '#DFD8EF',
        gap: 16,
      }}
    >
      <View
        accessible={false}
        importantForAccessibility="no-hide-descendants"
        style={{ flexDirection: 'row', gap: 8 }}
      >
        {[Brain, ScanSearch, MessagesSquare].map((Icon, index) => (
          <View
            key={index}
            style={{
              width: 40,
              height: 40,
              borderRadius: 14,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: dark ? '#302B49' : '#E5DEF3',
            }}
          >
            <Icon size={21} color={accent} strokeWidth={1.6} />
          </View>
        ))}
      </View>
      <View style={{ gap: 8 }}>
        <Text
          style={{
            fontFamily: 'NotoSansGeorgian_700Bold',
            fontSize: 21,
            lineHeight: 30,
            color: ink,
          }}
        >
          ერთი კითხვა.{'\n'}რამდენიმე AI პერსპექტივა.
        </Text>
        <Text
          style={{
            fontFamily: 'NotoSansGeorgian_400Regular',
            fontSize: 13,
            lineHeight: 22,
            color: secondary,
          }}
        >
          მოუყევი, რა გაწუხებს — მიიღე საკითხის განხილვა სხვადასხვა სამედიცინო
          მიმართულებით და საერთო შეჯამება.
        </Text>
      </View>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          justifyContent: 'space-between',
          borderTopWidth: 1,
          borderColor: dark ? '#3C3757' : '#DFD8EF',
          paddingTop: 14,
        }}
      >
        <Text
          style={{
            flex: 1,
            fontFamily: 'NotoSansGeorgian_600SemiBold',
            fontSize: 14,
            lineHeight: 22,
            color: accent,
          }}
        >
          დაიწყე განხილვა
        </Text>
        <ArrowUpRight size={21} color={accent} />
      </View>
      <Text
        style={{
          fontFamily: 'NotoSansGeorgian_400Regular',
          fontSize: 11,
          lineHeight: 18,
          color: secondary,
        }}
      >
        AI განხილვაა — არა ექიმების კონსულტაცია.
      </Text>
    </Pressable>
  );
}
