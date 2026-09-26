import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { Check, ChevronRight, X } from 'lucide-react-native';
import { MedicationPillIcon } from '@/components/medications/MedicationPillIcon';
import { MedsButton, MedsRoundAction, MedsStatusPill } from '@/components/medications/MedsHubUI';
import { ka } from '@/i18n/ka';
import { formatTime24h, parseMedicationConfig } from '@/lib/medications.shared';
import { useThemeColors } from '@/theme/colors';
import { hubText } from '@/theme/hub';
import type { DoseStatus } from '@/types/medications';

type Props = {
  dose: { medName: string; dosage: string; time: string; notes: string | null };
  cfg: ReturnType<typeof parseMedicationConfig>;
  logStatus?: string;
  compact?: boolean;
  onTaken: () => void;
  onSkipped: () => void;
  onOpen: () => void;
};

/** One scheduled dose inside a hub card: pill, name, time line, then take / skip. */
export function UpcomingDoseCard({ dose, cfg, logStatus, compact, onTaken, onSkipped, onOpen }: Props) {
  const c = useThemeColors();
  const meal = cfg.mealTiming && cfg.mealTiming !== 'any' ? ka.meds.mealTiming[cfg.mealTiming] : null;
  const meta = [formatTime24h(dose.time), dose.dosage, meal].filter(Boolean).join(' · ');
  const status = logStatus === 'taken' || logStatus === 'skipped' ? (logStatus as DoseStatus) : null;

  return (
    <View style={{ gap: 12 }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${dose.medName}, ${meta}`}
        onPress={onOpen}
        style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}
      >
        <MedicationPillIcon shape={cfg.pillShape ?? 'rectangle'} size={compact ? 40 : 46} border imageUrl={cfg.imageUrl} />
        <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
          <Text numberOfLines={1} style={[hubText.cardTitle, { color: c.text100 }]}>
            {dose.medName}
          </Text>
          <Text numberOfLines={1} style={[hubText.caption, { color: c.text200 }]}>
            {meta}
          </Text>
        </View>
        {status ? (
          <MedsStatusPill status={status} small />
        ) : compact ? (
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <MedsRoundAction icon={X} tone="quiet" onPress={onSkipped} accessibilityLabel={ka.meds.actionSkip} size={38} />
            <MedsRoundAction icon={Check} tone="primary" onPress={onTaken} accessibilityLabel={ka.meds.actionTake} size={38} />
          </View>
        ) : (
          <ChevronRight size={18} color={c.text300} strokeWidth={2} />
        )}
      </Pressable>

      {!status && !compact ? (
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <MedsButton compact label={ka.meds.actionTake} icon={Check} onPress={onTaken} style={{ flex: 1.3 }} />
          <MedsButton compact tone="quiet" label={ka.meds.actionSkip} onPress={onSkipped} style={{ flex: 1 }} />
        </View>
      ) : null}
    </View>
  );
}
