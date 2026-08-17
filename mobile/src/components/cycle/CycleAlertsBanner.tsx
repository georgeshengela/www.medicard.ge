import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { AlertTriangle } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { ka } from '@/i18n/ka';
import type { CycleBundle } from '@/lib/api';
import { useCycleColors } from '@/theme/cycle';

type Props = {
  bundle: CycleBundle;
};

export function CycleAlertsBanner({ bundle }: Props) {
  const c = useCycleColors();
  const router = useRouter();
  const alerts = bundle.alerts ?? [];
  if (!alerts.length) return null;

  const top = alerts.find((a) => a.level === 'urgent') ?? alerts[0];
  const bg =
    top.level === 'urgent' ? c.danger : top.level === 'warn' ? '#F57C00' : c.lavender;

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
        <Text style={{ color: c.ink, fontWeight: '800', fontSize: 13 }}>{ka.cycle.alertsTitle}</Text>
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
