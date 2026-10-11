import React from 'react';
import { Text, View } from 'react-native';
import { CircleAlert } from 'lucide-react-native';
import { velvetField, type VelvetPalette } from '@/theme/velvet';

/** A form message pressed into velvet: red ink and icon, no red box. */
export function VelvetNotice({ text, palette: p }: { text: string; palette: VelvetPalette }) {
  return (
    <View
      accessibilityLiveRegion="polite"
      style={{
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 10,
        paddingHorizontal: 16,
        paddingVertical: 13,
        borderRadius: 18,
        backgroundColor: p.surface,
        boxShadow: velvetField(p),
      }}
    >
      <CircleAlert size={18} color={p.danger} strokeWidth={2.2} style={{ marginTop: 1 }} />
      <Text style={{ flex: 1, fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 14, lineHeight: 20, color: p.danger }}>{text}</Text>
    </View>
  );
}
