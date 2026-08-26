import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { Calendar, Pencil } from 'lucide-react-native';
import { FIGMA_SYMPTOMS as T } from '@/constants/figmaSymptomsLayout';
import { ka } from '@/i18n/ka';

type Props = {
  symptoms: string[];
  durationLabel?: string;
  painLabel?: string;
  onEdit?: () => void;
};

export function SymptomResultSummaryCard({ symptoms, durationLabel, painLabel, onEdit }: Props) {
  return (
    <View
      style={{
        borderRadius: T.cardRadius,
        borderWidth: 1,
        borderColor: T.border,
        backgroundColor: T.white,
        overflow: 'hidden',
        ...T.shadowCard,
      }}
    >
      <View style={{ padding: 12, gap: 16 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text style={{ flex: 1, fontSize: 16, fontWeight: '600', color: T.textPrimary }}>
            {ka.symptoms.activeSymptoms(symptoms.length)}
          </Text>
          {onEdit ? (
            <Pressable onPress={onEdit} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={{ fontSize: 14, fontWeight: '600', color: T.brand }}>{ka.common.edit}</Text>
              <Pencil size={18} color={T.brand} strokeWidth={2} />
            </Pressable>
          ) : null}
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {symptoms.map((s) => (
            <View
              key={s}
              style={{
                borderRadius: 8,
                borderWidth: 1,
                borderColor: T.borderTertiary,
                backgroundColor: T.white,
                paddingHorizontal: 8,
                paddingVertical: 4,
                ...T.shadowXs,
              }}
            >
              <Text style={{ fontSize: 14, fontWeight: '500', color: T.textPrimary }}>{s}</Text>
            </View>
          ))}
        </View>
      </View>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          padding: 12,
          borderTopWidth: 1,
          borderTopColor: '#FECDD3',
          backgroundColor: '#FFF1F2',
        }}
      >
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Calendar size={18} color={T.textSecondary} strokeWidth={2} />
          <Text style={{ fontSize: 14, fontWeight: '500', color: T.textSecondary }}>{durationLabel ?? '—'}</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: T.danger }} />
          <Text style={{ fontSize: 14, fontWeight: '700', color: '#9F1239' }}>{painLabel ?? '—'}</Text>
        </View>
      </View>
    </View>
  );
}
