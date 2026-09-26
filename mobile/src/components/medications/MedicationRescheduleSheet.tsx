import React from 'react';
import { View } from 'react-native';
import { MedsChip } from '@/components/medications/MedsHubUI';
import { MedicationSheetModal } from '@/components/medications/MedicationSheetUI';
import { ka } from '@/i18n/ka';

const RESCHEDULE_OPTIONS = ['06:00', '07:00', '08:00', '09:00', '10:00', '12:00', '14:00', '16:00', '18:00', '20:00', '21:00', '22:00'];

type Props = {
  visible: boolean;
  /** The slot being moved — shown as the current choice. */
  currentTime?: string;
  onClose: () => void;
  onPick: (time24: string) => void;
};

/** Move one dose to another time today: a grid of common times, one tap. */
export function MedicationRescheduleSheet({ visible, currentTime, onClose, onPick }: Props) {
  return (
    <MedicationSheetModal visible={visible} title={ka.meds.actionReschedule} subtitle={ka.meds.rescheduleHint} onClose={onClose}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, paddingVertical: 10, paddingBottom: 14 }}>
        {RESCHEDULE_OPTIONS.map((time) => (
          <MedsChip
            key={time}
            label={time}
            active={time === currentTime}
            onPress={() => onPick(time)}
            style={{ flexBasis: '22%', flexGrow: 1, minHeight: 44 }}
          />
        ))}
      </View>
    </MedicationSheetModal>
  );
}
