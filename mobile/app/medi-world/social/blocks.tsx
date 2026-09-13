import React, { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { SocialButton, SocialShell, useSocialCopy } from '@/components/world/SocialChrome';
import { useSocial } from '@/hooks/useSocial';
import { mediWorldApi } from '@/lib/mediWorld/api';
import { useThemeColors } from '@/theme/colors';

export default function SocialBlocksScreen() {
  const colors = useThemeColors();
  const { copy } = useSocialCopy();
  const { canMutate } = useSocial();
  const [items, setItems] = useState<Array<{ blockId: string; publicId: string | null; displayName: string }>>([]);
  const [loadError, setLoadError] = useState(false);
  const fontBody = { fontFamily: 'NotoSansGeorgian_400Regular' as const };

  async function load() {
    try {
      const next = await mediWorldApi.socialBlocks();
      setItems(next.items);
      setLoadError(false);
    } catch {
      setLoadError(true);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  return (
    <SocialShell titleKey="blocksTitle">
      {loadError ? <SocialButton label={copy.retry} onPress={() => void load()} /> : null}
      {items.map((row) => (
        <View key={row.blockId} style={{ marginTop: 10 }}>
          <Text style={{ ...fontBody, color: colors.text100 }}>{row.displayName}</Text>
          <SocialButton disabled={!canMutate} label={copy.unblock} onPress={() => void mediWorldApi.socialUnblock(row.blockId).then(load)} />
        </View>
      ))}
    </SocialShell>
  );
}
