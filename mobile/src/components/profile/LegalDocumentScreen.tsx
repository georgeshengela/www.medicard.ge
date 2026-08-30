import React from 'react';
import { Linking, Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft } from 'lucide-react-native';
import type { LegalSection } from '@/constants/privacyPolicyKa';
import { SUPPORT_EMAIL, SUPPORT_MAILTO } from '@/constants/legal';
import { ka } from '@/i18n/ka';
import { useThemeColors } from '@/theme/colors';

type Props = {
  title: string;
  effectiveDate: string;
  intro: string;
  highlight?: string;
  sections: LegalSection[];
};

export function LegalDocumentScreen({ title, effectiveDate, intro, highlight, sections }: Props) {
  const colors = useThemeColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg100 }}>
      <View
        style={{
          paddingTop: insets.top + 4,
          paddingHorizontal: 8,
          minHeight: 56,
          flexDirection: 'row',
          alignItems: 'center',
        }}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={ka.common.back}
          onPress={() => router.back()}
          hitSlop={10}
          style={({ pressed }) => ({
            width: 44,
            height: 44,
            alignItems: 'center',
            justifyContent: 'center',
            opacity: pressed ? 0.55 : 1,
          })}
        >
          <ChevronLeft size={24} color={colors.text100} strokeWidth={2.2} />
        </Pressable>
        <Text
          numberOfLines={1}
          style={{
            flex: 1,
            marginRight: 44,
            fontFamily: 'NotoSansGeorgian_700Bold',
            fontSize: 16,
            color: colors.text100,
          }}
        >
          {title}
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingBottom: Math.max(insets.bottom, 24) + 24,
        }}
        showsVerticalScrollIndicator={false}
      >
        <Text
          style={{
            fontFamily: 'NotoSansGeorgian_400Regular',
            fontSize: 13,
            lineHeight: 18,
            color: colors.text300,
          }}
        >
          {ka.profileSetup.privacyEffective(effectiveDate)}
        </Text>

        <Text
          style={{
            marginTop: 12,
            fontFamily: 'NotoSansGeorgian_400Regular',
            fontSize: 15,
            lineHeight: 24,
            color: colors.text200,
          }}
        >
          {intro}
        </Text>

        {highlight ? (
          <View
            style={{
              marginTop: 16,
              borderRadius: 16,
              borderWidth: 1,
              borderColor: colors.bg300,
              backgroundColor: colors.surface,
              padding: 14,
            }}
          >
            <Text
              style={{
                fontFamily: 'NotoSansGeorgian_600SemiBold',
                fontSize: 14,
                lineHeight: 22,
                color: colors.primary100,
              }}
            >
              {highlight}
            </Text>
          </View>
        ) : null}

        {sections.map((section) => (
          <View key={section.title} style={{ marginTop: 22 }}>
            <Text
              style={{
                fontFamily: 'NotoSansGeorgian_700Bold',
                fontSize: 16,
                lineHeight: 22,
                color: colors.text100,
              }}
            >
              {section.title}
            </Text>
            {section.intro ? (
              <Text
                style={{
                  marginTop: 8,
                  fontFamily: 'NotoSansGeorgian_400Regular',
                  fontSize: 15,
                  lineHeight: 24,
                  color: colors.text200,
                }}
              >
                {section.intro}
              </Text>
            ) : null}
            {section.paragraphs?.map((p) => (
              <Text
                key={p}
                style={{
                  marginTop: 8,
                  fontFamily: 'NotoSansGeorgian_400Regular',
                  fontSize: 15,
                  lineHeight: 24,
                  color: colors.text200,
                }}
              >
                {p}
              </Text>
            ))}
            {section.bullets?.map((item) => (
              <View key={item} style={{ flexDirection: 'row', marginTop: 8 }}>
                <Text style={{ color: colors.primary200, marginRight: 8, lineHeight: 24 }}>•</Text>
                <Text
                  style={{
                    flex: 1,
                    fontFamily: 'NotoSansGeorgian_400Regular',
                    fontSize: 15,
                    lineHeight: 24,
                    color: colors.text200,
                  }}
                >
                  {item}
                </Text>
              </View>
            ))}
          </View>
        ))}

        <Pressable
          accessibilityRole="link"
          onPress={() => void Linking.openURL(SUPPORT_MAILTO)}
          style={{ marginTop: 28, alignItems: 'center' }}
        >
          <Text
            style={{
              fontFamily: 'NotoSansGeorgian_600SemiBold',
              fontSize: 14,
              color: colors.primary200,
            }}
          >
            {SUPPORT_EMAIL}
          </Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}
