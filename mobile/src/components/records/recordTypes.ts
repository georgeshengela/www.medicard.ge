import { FileText, FlaskConical, Pill, ScanFace, ScanLine, Sparkles, Stethoscope, type LucideIcon } from 'lucide-react-native';
import { tx } from '@/i18n/locale';
import type { MedicalRecord } from '@/lib/api';
import type { HubInk } from '@/theme/hub';

export type RecordLook = { icon: LucideIcon; ink: HubInk; title: () => string };

/** One saved report, named as a single thing (the filter chips keep the plural type names). */
const LOOK: Record<MedicalRecord['type'], RecordLook> = {
  LAB: { icon: FlaskConical, ink: 'blue', title: () => tx('ანალიზი', 'Lab test') },
  XRAY: { icon: ScanLine, ink: 'sky', title: () => tx('რენტგენი', 'X-ray') },
  CT_MRI: { icon: ScanLine, ink: 'sky', title: () => 'CT / MRI' },
  SKIN: { icon: ScanFace, ink: 'rose', title: () => tx('კანის შემოწმება', 'Skin check') },
  SKINCARE: { icon: Sparkles, ink: 'violet', title: () => tx('კანის მოვლა', 'Skincare') },
  PRESCRIPTION: { icon: Pill, ink: 'green', title: () => tx('რეცეპტი', 'Prescription') },
  SYMPTOM: { icon: Stethoscope, ink: 'teal', title: () => tx('სიმპტომების შეფასება', 'Symptom check') },
};
const FALLBACK: RecordLook = { icon: FileText, ink: 'neutral', title: () => tx('ჩანაწერი', 'Entry') };

export function recordLook(type: string): RecordLook {
  return LOOK[type as MedicalRecord['type']] ?? FALLBACK;
}
