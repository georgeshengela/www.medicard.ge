import React from 'react';
import { MedicationSheetModal } from '@/components/medications/MedicationSheetUI';

type Props = {
  visible: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: React.ReactNode;
  scrollable?: boolean;
  footer?: React.ReactNode;
};

/** Compatibility alias — every medication sheet now shares `MedicationSheetModal`. */
export function MedicationBottomSheet({ visible, title, subtitle, onClose, children, scrollable, footer }: Props) {
  return (
    <MedicationSheetModal
      visible={visible}
      title={title}
      subtitle={subtitle}
      onClose={onClose}
      scrollable={scrollable}
      footer={footer}
      contentStyle={{ paddingBottom: 8 }}
    >
      {children}
    </MedicationSheetModal>
  );
}
