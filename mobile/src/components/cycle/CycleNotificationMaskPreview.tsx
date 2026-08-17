import React from 'react';
import { Text, View } from 'react-native';
import { ArrowDown } from 'lucide-react-native';
import { ka } from '@/i18n/ka';
import {
  getMaskPreset,
  type CycleNotificationMaskStyle,
} from '@/lib/cycleNotificationMask';
import { useCycleColors } from '@/theme/cycle';

type Props = {
  maskEnabled: boolean;
  maskStyle: CycleNotificationMaskStyle;
};

function NotifBubble({
  title,
  body,
  tone,
}: {
  title: string;
  body: string;
  tone: 'danger' | 'safe' | 'muted';
}) {
  const c = useCycleColors();
  const border =
    tone === 'danger' ? `${c.danger}44` : tone === 'safe' ? `${c.success}55` : c.border;
  const bg =
    tone === 'danger' ? `${c.danger}0c` : tone === 'safe' ? `${c.success}10` : c.card;

  return (
    <View
      style={{
        backgroundColor: bg,
        borderRadius: 14,
        padding: 12,
        borderWidth: 1,
        borderColor: border,
      }}
    >
      <Text style={{ color: c.ink, fontWeight: '800', fontSize: 13 }}>{title}</Text>
      <Text style={{ color: c.muted, fontSize: 12, marginTop: 3, lineHeight: 17 }}>{body}</Text>
    </View>
  );
}

export function CycleNotificationMaskPreview({ maskEnabled, maskStyle }: Props) {
  const c = useCycleColors();
  const hidden = getMaskPreset(maskStyle);
  const realTitle = ka.cycle.remPeriodSoon;
  const realBody = ka.cycle.remPeriodSoonBody(2);

  return (
    <View style={{ marginTop: 12, gap: 10 }}>
      <Text style={{ color: c.muted, fontSize: 12, lineHeight: 18 }}>{ka.cycle.maskExplain}</Text>

      {!maskEnabled ? (
        <>
          <Text style={{ color: c.danger, fontSize: 11, fontWeight: '700' }}>
            {ka.cycle.maskBeforeLabel}
          </Text>
          <NotifBubble title={realTitle} body={realBody} tone="danger" />
          <View style={{ alignItems: 'center', paddingVertical: 2 }}>
            <ArrowDown size={16} color={c.muted} />
          </View>
          <Text style={{ color: c.success, fontSize: 11, fontWeight: '700' }}>
            {ka.cycle.maskAfterLabel}
          </Text>
          <NotifBubble title={hidden.title} body={hidden.body} tone="safe" />
        </>
      ) : (
        <>
          <Text style={{ color: c.success, fontSize: 11, fontWeight: '700' }}>
            {ka.cycle.maskOthersSee}
          </Text>
          <NotifBubble title={hidden.title} body={hidden.body} tone="safe" />
          <Text style={{ color: c.muted, fontSize: 11, lineHeight: 16 }}>{ka.cycle.maskYouSee}</Text>
        </>
      )}
    </View>
  );
}
