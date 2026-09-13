import React, { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { SocialShell, useSocialCopy } from '@/components/world/SocialChrome';
import { useSocial } from '@/hooks/useSocial';
import { mediWorldApi } from '@/lib/mediWorld/api';
import type { SocialFriendProjection } from '@/lib/mediWorld/types';
import { useThemeColors } from '@/theme/colors';

export default function SocialPreviewScreen() {
  const colors = useThemeColors();
  const { copy } = useSocialCopy();
  const { offline } = useSocial();
  const [preview, setPreview] = useState<SocialFriendProjection | null>(null);
  const fontBody = { fontFamily: 'NotoSansGeorgian_400Regular' as const };

  useEffect(() => {
    if (offline) return;
    void mediWorldApi.socialPreview().then(setPreview).catch(() => setPreview(null));
  }, [offline]);

  return (
    <SocialShell titleKey="previewTitle">
      <Text maxFontSizeMultiplier={1.6} style={{ ...fontBody, fontSize: 16, lineHeight: 24, color: colors.text200, marginTop: 12 }}>{copy.previewBody}</Text>
      {preview ? (
        <View style={{ marginTop: 16, borderRadius: 16, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.bg300, padding: 16 }}>
          <Text style={{ fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 20, color: colors.text100 }}>{preview.displayName}</Text>
          <Text style={{ ...fontBody, color: colors.text200, marginTop: 6 }}>{preview.bio || ' '}</Text>
          <Text style={{ ...fontBody, color: colors.text300, marginTop: 8 }}>{preview.companionStage}</Text>
          {preview.worldLevel != null ? <Text style={{ ...fontBody, color: colors.text200, marginTop: 8 }}>{copy.showWorld}: {preview.worldLevel}</Text> : null}
          {preview.bondLevel != null ? <Text style={{ ...fontBody, color: colors.text200, marginTop: 4 }}>{copy.showBond}: {preview.bondLevel}</Text> : null}
          {preview.garden ? (
            <Text style={{ ...fontBody, color: colors.text200, marginTop: 8 }}>{copy.gardenPreview}: {preview.garden.plots.length}</Text>
          ) : (
            <Text style={{ ...fontBody, color: colors.text300, marginTop: 8 }}>{copy.gardenOff}</Text>
          )}
        </View>
      ) : null}
    </SocialShell>
  );
}
