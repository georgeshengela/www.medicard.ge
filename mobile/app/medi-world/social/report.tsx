import React, { useState } from 'react';
import { Text, TextInput } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { SocialButton, SocialShell, useSocialCopy } from '@/components/world/SocialChrome';
import { useSocial } from '@/hooks/useSocial';
import { mediWorldApi } from '@/lib/mediWorld/api';
import { useThemeColors } from '@/theme/colors';

const CATEGORIES = ['harassment', 'impersonation', 'inappropriate_profile', 'spam', 'privacy_concern', 'other'] as const;

export default function SocialReportScreen() {
  const { publicId } = useLocalSearchParams<{ publicId?: string }>();
  const colors = useThemeColors();
  const { copy } = useSocialCopy();
  const { canMutate } = useSocial();
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]>('other');
  const [description, setDescription] = useState('');
  const [done, setDone] = useState(false);
  const fontBody = { fontFamily: 'NotoSansGeorgian_400Regular' as const };

  return (
    <SocialShell titleKey="reportTitle">
      <Text maxFontSizeMultiplier={1.6} style={{ ...fontBody, fontSize: 15, lineHeight: 22, color: colors.text200, marginTop: 12 }}>{copy.reportHint}</Text>
      <Text maxFontSizeMultiplier={1.6} style={{ ...fontBody, fontSize: 14, lineHeight: 22, color: colors.text300, marginTop: 8 }}>{copy.emergency}</Text>
      {CATEGORIES.map((item) => (
        <SocialButton key={item} label={copy[item]} onPress={() => setCategory(item)} />
      ))}
      <TextInput
        value={description}
        onChangeText={setDescription}
        maxLength={280}
        multiline
        maxFontSizeMultiplier={1.6}
        style={{ marginTop: 12, minHeight: 72, borderRadius: 14, backgroundColor: colors.bg200, paddingHorizontal: 14, paddingTop: 12, color: colors.text100 }}
      />
      <SocialButton
        disabled={!canMutate || !publicId}
        label={copy.submitReport}
        onPress={() => {
          if (!publicId) return;
          void mediWorldApi.socialReport({ targetPublicId: publicId, category, description }).then(() => setDone(true));
        }}
      />
      {done ? <Text style={{ ...fontBody, color: colors.text200, marginTop: 12 }}>{copy.offerBlock}</Text> : null}
    </SocialShell>
  );
}
