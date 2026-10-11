import React from 'react';
import { View } from 'react-native';
import { Settings2 } from 'lucide-react-native';
import { ModuleHeader, ModuleHeaderButton } from '@/components/brand/ModuleHeader';
import { ka } from '@/i18n/ka';

type Props = {
  monthLabel: string;
  /** Kept for callers; the status lives in the hero, not twice. */
  subtitle?: string;
  topInset: number;
  onBack: () => void;
  onSettings: () => void;
};

/**
 * MEDICYCLE's page header = the standard MEDI module header (owner 2026-10-12: the old round-button row fell
 * out of the family): back · wordmark with the month as its line · settings. It scrolls away with the page;
 * only the week strip below stays pinned (owner 2026-09-28).
 */
export function CycleHomeHeader({ monthLabel, topInset, onBack, onSettings }: Props) {
  return (
    <View style={{ paddingTop: topInset + 12, paddingHorizontal: 20, paddingBottom: 14 }}>
      <ModuleHeader
        module="cycle"
        subtitle={monthLabel}
        onBack={onBack}
        backLabel={ka.common.back}
        right={<ModuleHeaderButton label={ka.cycle.settings} icon={Settings2} onPress={onSettings} />}
      />
    </View>
  );
}
