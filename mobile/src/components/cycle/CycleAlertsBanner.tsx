import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { AlertTriangle } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { ka } from '@/i18n/ka';
import type { CycleBundle } from '@/lib/api';
import { alertPresentation } from '@/lib/cyclePresentation.js';
import { useCycleColors } from '@/theme/cycle';

type Props = {
  bundle: CycleBundle;
  /** Skip alerts already shown as the Overview contextual late note. */
  excludeLate?: boolean;
};

export function CycleAlertsBanner({ bundle, excludeLate }: Props) {
  const c = useCycleColors();
  const router = useRouter();
  const alerts = (bundle.alerts ?? []).filter((a) => !(excludeLate && alertPresentation(a).late));
  if (!alerts.length) return null;

  const top = alerts.find((a) => a.level === 'urgent') ?? alerts[0];
  const chrome = alertPresentation(top);
  const bg =
    chrome.tone === 'urgent' ? c.danger : chrome.tone === 'calm' ? c.brand : c.ink;

  return (
    <Pressable
      onPress={() => {
        if (top.action === 'chat') {
          router.push(`/chat/doctor?prefill=${encodeURIComponent(top.messageKa)}` as never);
        }
      }}
      style={{
        marginHorizontal: 20,
        marginBottom: 12,
        backgroundColor: `${bg}18`,
        borderRadius: 16,
        padding: 14,
        borderWidth: 1,
        borderColor: `${bg}44`,
        flexDirection: 'row',
        alignItems: 'flex-start',
      }}
    >
      <AlertTriangle size={18} color={bg} strokeWidth={2.2} />
      <View style={{ flex: 1, marginLeft: 10 }}>
        <Text style={{ color: c.ink, fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 13 }}>{ka.cycle.alertsTitle}</Text>
        <Text style={{ color: c.muted, fontSize: 12, marginTop: 4, lineHeight: 17 }}>{top.messageKa}</Text>
        {top.action === 'chat' ? (
          <Text style={{ color: bg, fontWeight: '700', fontSize: 12, marginTop: 8 }}>
            {ka.cycle.alertChat} →
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}
