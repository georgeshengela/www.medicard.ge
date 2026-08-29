import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { ChevronRight } from 'lucide-react-native';
import { MedicationPillIcon } from '@/components/medications/MedicationPillIcon';
import { useFigmaMeds } from '@/constants/figmaMedicationsLayout';
import { ka } from '@/i18n/ka';
import { formatTime12h, parseMedicationConfig } from '@/lib/medications.shared';

type Props = {
  dose: { medName: string; dosage: string; time: string; notes: string | null };
  cfg: ReturnType<typeof parseMedicationConfig>;
  logStatus?: string;
  compact?: boolean;
  onTaken: () => void;
  onSkipped: () => void;
  onOpen: () => void;
};

export function UpcomingDoseCard({ dose, cfg, logStatus, compact, onTaken, onSkipped, onOpen }: Props) {
  const FIGMA_MEDS = useFigmaMeds();
  const meal = cfg.mealTiming && cfg.mealTiming !== 'any' ? ka.meds.mealTiming[cfg.mealTiming] : null;
  const subtitle = cfg.genericName ? `${cfg.genericName} - ${ka.meds.formLabels[cfg.form ?? 'pills']}` : dose.dosage;
  const compactMeta = [cfg.genericName ? subtitle : null, dose.dosage, meal].filter(Boolean).join(' · ');

  return (
    <View style={{ gap: compact ? 8 : 16 }}>
      <Pressable onPress={onOpen} style={{ flexDirection: 'row', gap: compact ? 10 : 12, alignItems: compact ? 'center' : 'flex-start' }}>
        <MedicationPillIcon shape={cfg.pillShape ?? 'rectangle'} size={compact ? 36 : 48} border imageUrl={cfg.imageUrl} />
        <View style={{ flex: 1, gap: compact ? 2 : 8 }}>
          <View style={{ gap: compact ? 0 : 4 }}>
            <Text
              style={{ fontSize: 14, fontWeight: '700', lineHeight: compact ? 18 : 20, color: FIGMA_MEDS.textPrimary }}
              numberOfLines={1}
            >
              {dose.medName}
            </Text>
            {compact ? null : (
              <Text style={{ fontSize: 14, lineHeight: 20, color: FIGMA_MEDS.textSecondary }} numberOfLines={2}>
                {subtitle}
              </Text>
            )}
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Text
              style={{
                fontSize: compact ? 12 : 14,
                fontWeight: '600',
                lineHeight: compact ? 16 : 20,
                color: FIGMA_MEDS.brand,
                flexShrink: 1,
              }}
              numberOfLines={1}
            >
              {ka.meds.doseAt(formatTime12h(dose.time))}
            </Text>
            <ChevronRight size={compact ? 16 : 20} color={FIGMA_MEDS.brand} strokeWidth={2.5} />
          </View>

          {compact ? (
            compactMeta ? (
              <Text style={{ fontSize: 12, lineHeight: 16, color: FIGMA_MEDS.textSecondary }} numberOfLines={1}>
                {compactMeta}
              </Text>
            ) : null
          ) : (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={{ fontSize: 12, lineHeight: 16, color: FIGMA_MEDS.textSecondary }}>{dose.dosage}</Text>
              {meal ? (
                <>
                  <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: FIGMA_MEDS.border }} />
                  <Text style={{ fontSize: 12, lineHeight: 16, color: FIGMA_MEDS.textSecondary }}>{meal}</Text>
                </>
              ) : null}
            </View>
          )}
        </View>
      </Pressable>

      {logStatus ? (
        <Text style={{ fontWeight: '700', fontSize: compact ? 13 : 14, color: logStatus === 'taken' ? FIGMA_MEDS.success : FIGMA_MEDS.destructive }}>
          {logStatus === 'taken' ? ka.meds.statusTaken : ka.meds.statusSkipped}
        </Text>
      ) : (
        <View style={{ flexDirection: 'row', gap: compact ? 8 : 12 }}>
          <Pressable
            onPress={onSkipped}
            style={{
              flex: 1,
              paddingVertical: compact ? 4 : 6,
              paddingHorizontal: 10,
              borderRadius: compact ? 10 : 12,
              backgroundColor: FIGMA_MEDS.cardBg,
              borderWidth: 1,
              borderColor: FIGMA_MEDS.borderTertiary,
              alignItems: 'center',
              ...FIGMA_MEDS.shadowInput,
            }}
          >
            <Text style={{ fontWeight: '600', fontSize: compact ? 13 : 14, lineHeight: compact ? 18 : 20, color: FIGMA_MEDS.textPrimary }}>
              {ka.meds.actionSkip}
            </Text>
          </Pressable>
          <Pressable
            onPress={onTaken}
            style={{
              flex: 1,
              paddingVertical: compact ? 4 : 6,
              paddingHorizontal: 10,
              borderRadius: compact ? 10 : 12,
              backgroundColor: FIGMA_MEDS.ctaBg,
              borderWidth: 1,
              borderColor: FIGMA_MEDS.ctaBg,
              alignItems: 'center',
              ...FIGMA_MEDS.shadowInput,
            }}
          >
            <Text style={{ fontWeight: '600', fontSize: compact ? 13 : 14, lineHeight: compact ? 18 : 20, color: FIGMA_MEDS.textOnBrand }}>
              {ka.meds.actionTake}
            </Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}
