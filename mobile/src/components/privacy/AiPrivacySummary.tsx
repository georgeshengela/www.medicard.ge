import React, { useState } from 'react';
import { Linking, Pressable, Text, View } from 'react-native';
import { ExternalLink, ShieldCheck } from 'lucide-react-native';
import { disclosureCopy } from '@/lib/aiDisclosureCopy';
import { useThemeColors } from '@/theme/colors';

type Manifest = Parameters<typeof disclosureCopy>[0];

type Props = {
  manifest: Manifest;
  tone?: 'onboarding' | 'app';
  hideTitle?: boolean;
};

/** Short permission explanation: what leaves the device, and which companies receive it. */
export function AiPrivacySummary({ manifest, tone = 'app', hideTitle = false }: Props) {
  const colors = useThemeColors();
  const copy = disclosureCopy(manifest);
  const [policyOpen, setPolicyOpen] = useState(false);
  const ink = tone === 'onboarding' ? '#111827' : colors.text100;
  const body = tone === 'onboarding' ? '#4B5563' : colors.text200;
  const card = tone === 'onboarding' ? '#FFFFFF' : colors.surface;
  const border = tone === 'onboarding' ? '#E5E7EB' : colors.bg300;
  const accent = '#0F766E';
  const text = { color: body, fontFamily: 'NotoSansGeorgian_400Regular' as const, fontSize: 15, lineHeight: 22 };

  return (
    <View style={{ gap: 16, width: '100%', maxWidth: 640, alignSelf: 'center' }}>
      {hideTitle ? null : (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <ShieldCheck size={28} color={accent} />
          <Text accessibilityRole="header" style={{ flex: 1, color: ink, fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 22, lineHeight: 30 }}>
            {copy.screenTitle}
          </Text>
        </View>
      )}
      <Text style={text}>{copy.intro}</Text>
      <Text style={text}>{copy.purpose}</Text>
      <View style={{ gap: 8, padding: 16, borderRadius: 20, backgroundColor: card, borderWidth: 1, borderColor: border }}>
        <Text style={[text, { color: ink, fontFamily: 'NotoSansGeorgian_700Bold' }]}>{copy.headings.sent}</Text>
        {(copy.summaryCategories || copy.categories).map((item: string) => (
          <Text key={item} style={text}>• {item}</Text>
        ))}
      </View>
      <View style={{ gap: 10 }}>
        <Text style={[text, { color: ink, fontFamily: 'NotoSansGeorgian_700Bold' }]}>{copy.headings.recipients}</Text>
        {copy.recipients.map((provider: { name: string; role: string; url: string }) => (
          <View key={provider.name} style={{ gap: 2, paddingVertical: 4 }}>
            <Pressable
              accessibilityRole="link"
              accessibilityLabel={provider.name}
              onPress={() => { void Linking.openURL(provider.url).catch(() => undefined); }}
              style={{ minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 8 }}
            >
              <Text style={{ flex: 1, color: accent, fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 15, lineHeight: 22 }}>{provider.name}</Text>
              <ExternalLink size={16} color={accent} />
            </Pressable>
            <Text style={text}>{provider.role}</Text>
          </View>
        ))}
      </View>
      <Text style={text}>{copy.choice}</Text>
      <Pressable accessibilityRole="link" onPress={() => setPolicyOpen((value) => !value)} style={{ minHeight: 44, justifyContent: 'center' }}>
        <Text style={{ color: accent, fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 15, textDecorationLine: 'underline' }}>
          {policyOpen ? copy.policyHide : copy.policy}
        </Text>
      </Pressable>
      {policyOpen ? (
        <Pressable accessibilityRole="link" accessibilityLabel={copy.policy} onPress={() => { void Linking.openURL(manifest.privacyUrl).catch(() => undefined); }} style={{ minHeight: 44, justifyContent: 'center' }}>
          <Text style={{ color: accent, fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 14 }}>{manifest.privacyUrl}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}
