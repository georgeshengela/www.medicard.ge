import { Bone, FlaskConical, ScanFace, type LucideIcon } from 'lucide-react-native';
import { ka } from '@/i18n/ka';
import { tx } from '@/i18n/locale';
import type { ScanKind } from '@/lib/scanThread';

export type ScanKindInfo = {
  kind: ScanKind;
  icon: LucideIcon;
  /** The choice on the composer: one short word. */
  label: string;
  /** One line on the welcome screen: what to bring. */
  hint: string;
  /** Placeholder for the note that goes with the file. */
  note: string;
  /** Header of the result in the thread. */
  resultTitle: string;
};

export function scanKindInfo(kind: ScanKind): ScanKindInfo {
  if (kind === 'LAB') {
    return {
      kind, icon: FlaskConical, label: tx('ანალიზი', 'Lab test'),
      hint: tx('ანალიზის ფურცელი ან PDF — რამდენიმე გვერდიც', 'A lab sheet or PDF — several pages too'),
      note: ka.modules.lab.contextPlaceholder, resultTitle: tx('ანალიზის მაჩვენებლები', 'Lab values'),
    };
  }
  if (kind === 'IMAGING') {
    return {
      kind, icon: Bone, label: tx('გამოსახულება', 'Imaging'),
      hint: tx('რენტგენი, ექო, MRI ან CT — სურათი ან ეკრანი', 'X-ray, ultrasound, MRI or CT — a photo or the screen'),
      note: ka.modules.imaging.contextPlaceholder, resultTitle: tx('გამოსახულების შეფასება', 'Imaging review'),
    };
  }
  return {
    kind, icon: ScanFace, label: tx('კანი', 'Skin'),
    hint: tx('ხალი, ლაქა ან გამონაყარი — დღის სინათლეზე', 'A mole, spot or rash — in daylight'),
    note: ka.modules.skin.contextPlaceholder, resultTitle: tx('კანის შეფასება', 'Skin review'),
  };
}
