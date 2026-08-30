import {
  FLOW_OPTIONS,
  MOOD_OPTIONS,
  CYCLE_TEST_OPTIONS,
  MUCUS_OPTIONS,
  PHYSICAL_SYMPTOMS,
  SEXUAL_OPTIONS,
} from '@/constants/cycle';

const CATALOG = [
  ...PHYSICAL_SYMPTOMS,
  ...MOOD_OPTIONS,
  ...FLOW_OPTIONS,
  ...MUCUS_OPTIONS,
  ...SEXUAL_OPTIONS,
  ...CYCLE_TEST_OPTIONS,
];

export function cycleChipLabel(id: string): string {
  return CATALOG.find((item) => item.id === id)?.label ?? id;
}
