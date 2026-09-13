import React, { useEffect, useState } from 'react';
import { Pressable, Text } from 'react-native';
import { SocialButton, SocialShell, useSocialCopy } from '@/components/world/SocialChrome';
import { useSocial } from '@/hooks/useSocial';
import { mediWorldApi } from '@/lib/mediWorld/api';
import { inboxItemPresentation, socialUiFailure } from '@/lib/mediWorld/socialGate.js';
import type { SocialInboxItem } from '@/lib/mediWorld/types';
import { useThemeColors } from '@/theme/colors';

export default function SocialInboxScreen() {
  const colors = useThemeColors();
  const { copy } = useSocialCopy();
  const { canMutate, stale, offline } = useSocial();
  const [items, setItems] = useState<SocialInboxItem[]>([]);
  const [loadError, setLoadError] = useState<'rate_limited' | 'error' | null>(null);
  const fontBody = { fontFamily: 'NotoSansGeorgian_400Regular' as const };

  async function load() {
    try {
      const next = await mediWorldApi.socialInbox({ take: 20 });
      setItems(next.items);
      setLoadError(null);
    } catch (error) {
      const kind = socialUiFailure(error);
      setLoadError(kind === 'rate_limited' ? 'rate_limited' : 'error');
    }
  }

  useEffect(() => {
    void load();
  }, []);

  return (
    <SocialShell titleKey="inboxTitle">
      {stale || offline ? <Text style={{ ...fontBody, color: colors.text300, marginTop: 8 }}>{copy.stale}</Text> : null}
      {loadError ? (
        <>
          <Text style={{ ...fontBody, color: colors.text200, marginTop: 12 }}>
            {loadError === 'rate_limited' ? copy.rateLimited : copy.retry}
          </Text>
          <SocialButton label={copy.retry} onPress={() => void load()} />
        </>
      ) : null}
      {!loadError && items.length === 0 ? <Text style={{ ...fontBody, color: colors.text300, marginTop: 16 }}>{copy.emptyInbox}</Text> : null}
      {items.map((item) => {
        const shown = inboxItemPresentation(item, copy);
        return (
          <Pressable
            key={item.itemId}
            accessibilityRole="button"
            disabled={!canMutate}
            onPress={() => {
              void mediWorldApi.socialInboxRead(item.itemId).then(load);
            }}
            className="active:opacity-75"
            style={{ marginTop: 10, borderRadius: 16, borderWidth: 1, borderColor: colors.bg300, padding: 16, backgroundColor: colors.surface }}
          >
            <Text style={{ fontFamily: 'NotoSansGeorgian_500Medium', color: colors.text100 }}>{shown.kindLabel}</Text>
            {shown.sender ? <Text style={{ ...fontBody, color: colors.text200, marginTop: 4 }}>{shown.sender}</Text> : null}
            {shown.waveLabel ? <Text style={{ ...fontBody, color: colors.text100, marginTop: 4 }}>{shown.waveLabel}</Text> : null}
            <Text style={{ ...fontBody, color: colors.text300, marginTop: 4 }}>{item.when}{item.read ? '' : ' · '}</Text>
          </Pressable>
        );
      })}
    </SocialShell>
  );
}
