import React, { useState } from 'react';
import { Linking, Pressable, Text, View } from 'react-native';
import { ExternalLink } from 'lucide-react-native';
import { sourcesFor, type MedicalSourceId } from '@/constants/medicalSources';
import { deviceLanguageTag, isGeorgianLocale } from '@/lib/aiDisclosureCopy';
import { useThemeColors } from '@/theme/colors';

type Props = {
  sourceIds: readonly MedicalSourceId[];
  align?: 'left' | 'center';
};

/**
 * Inline disclosure so the source list still opens inside an existing sheet.
 * A second native Modal is unreliable on iPad when one sheet is already presented.
 */
export function MedicalSourcesLink({ sourceIds, align = 'left' }: Props) {
  const [open, setOpen] = useState(false);
  const georgian = isGeorgianLocale(deviceLanguageTag());
  const colors = useThemeColors();
  const sources = sourcesFor(sourceIds);
  if (!sources.length) return null;
  const label = georgian ? 'წყაროები' : 'Sources';
  const openLabel = georgian ? 'წყაროს გახსნა' : 'Open source';
  const note = georgian
    ? 'საგანმანათლებლო ინფორმაციაა. ექიმის კონსულტაციას ან გადაუდებელ დახმარებას არ ცვლის.'
    : 'Educational information. It does not replace a clinician or emergency care.';

  return (
    <View style={{ alignSelf: 'stretch', alignItems: align === 'center' ? 'center' : 'flex-start' }}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={label}
        onPress={() => setOpen((value) => !value)}
        hitSlop={8}
        style={{ minHeight: 44, justifyContent: 'center' }}
      >
        <Text
          style={{
            fontFamily: 'NotoSansGeorgian_600SemiBold',
            fontSize: 13,
            lineHeight: 18,
            color: colors.primary100,
            textDecorationLine: 'underline',
          }}
        >
          {label}
        </Text>
      </Pressable>
      {open ? (
        <View style={{ gap: 10, paddingBottom: 8, width: '100%' }}>
          <Text style={{ color: colors.text200, fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 13, lineHeight: 20 }}>{note}</Text>
          {sources.map((source) => (
            <View key={source.id} style={{ gap: 4, padding: 12, borderRadius: 14, borderWidth: 1, borderColor: colors.bg300, backgroundColor: colors.surface }}>
              <Text style={{ color: colors.text300, fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 12, lineHeight: 16 }}>{source.organization}</Text>
              <Text style={{ color: colors.text100, fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 15, lineHeight: 21 }}>{georgian ? source.titleKa : source.title}</Text>
              <Text style={{ color: colors.text200, fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 13, lineHeight: 20 }}>{georgian ? source.descriptionKa : source.description}</Text>
              {source.url ? (
                <Pressable
                  accessibilityRole="link"
                  accessibilityLabel={`${openLabel}: ${source.organization}`}
                  onPress={() => { void Linking.openURL(source.url as string).catch(() => undefined); }}
                  style={{ minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 8 }}
                >
                  <Text style={{ flex: 1, color: colors.primary100, fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 14 }}>{openLabel}</Text>
                  <ExternalLink size={16} color={colors.primary100} />
                </Pressable>
              ) : null}
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}
