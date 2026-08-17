import { ka } from '@/i18n/ka';
import type { VisitReminderConfig } from '@/lib/api';

export type DoctorTypeCode =
  | 'GP'
  | 'DENTIST'
  | 'CARDIO'
  | 'GYN'
  | 'NEURO'
  | 'ORTHO'
  | 'THERAPIST'
  | 'OPHTHALMO'
  | 'DERM'
  | 'PED'
  | 'OTHER';

export const DOCTOR_TYPES: { code: DoctorTypeCode; label: string }[] = [
  { code: 'GP', label: ka.visits.types.GP },
  { code: 'DENTIST', label: ka.visits.types.DENTIST },
  { code: 'CARDIO', label: ka.visits.types.CARDIO },
  { code: 'GYN', label: ka.visits.types.GYN },
  { code: 'NEURO', label: ka.visits.types.NEURO },
  { code: 'ORTHO', label: ka.visits.types.ORTHO },
  { code: 'THERAPIST', label: ka.visits.types.THERAPIST },
  { code: 'OPHTHALMO', label: ka.visits.types.OPHTHALMO },
  { code: 'DERM', label: ka.visits.types.DERM },
  { code: 'PED', label: ka.visits.types.PED },
  { code: 'OTHER', label: ka.visits.types.OTHER },
];

export function doctorTypeLabel(code: string): string {
  return DOCTOR_TYPES.find((t) => t.code === code)?.label ?? code;
}

export const REMINDER_OFFSET_PRESETS = [
  { minutes: 10080, label: ka.visits.reminderWeek },
  { minutes: 1440, label: ka.visits.reminderDay },
  { minutes: 180, label: ka.visits.reminder3h },
  { minutes: 60, label: ka.visits.reminder1h },
  { minutes: 30, label: ka.visits.reminder30m },
] as const;

export const VISIT_TIME_SLOTS = Array.from({ length: 48 }, (_, i) => {
  const h = Math.floor(i / 2);
  const m = i % 2 === 0 ? '00' : '30';
  return `${String(h).padStart(2, '0')}:${m}`;
});

export const VISIT_TIME_GROUPS = [
  {
    key: 'morning',
    label: 'დილა',
    slots: VISIT_TIME_SLOTS.filter((_, i) => i >= 16 && i <= 23),
  },
  {
    key: 'afternoon',
    label: 'შუადღე',
    slots: VISIT_TIME_SLOTS.filter((_, i) => i >= 24 && i <= 35),
  },
  {
    key: 'evening',
    label: 'საღამო',
    slots: VISIT_TIME_SLOTS.filter((_, i) => i >= 36 && i <= 43),
  },
] as const;

export const POPULAR_VISIT_TIMES = ['09:00', '10:00', '11:00', '14:00', '16:00', '18:00'] as const;

export const DEFAULT_REMINDER_CONFIG = {
  enabled: true,
  offsetsMinutes: [1440, 60] as number[],
  repeatCount: 1,
};

export function normalizeReminderConfig(raw: unknown): VisitReminderConfig {
  const cfg = (raw && typeof raw === 'object' ? raw : {}) as Partial<VisitReminderConfig>;
  return {
    enabled: cfg.enabled ?? DEFAULT_REMINDER_CONFIG.enabled,
    offsetsMinutes:
      Array.isArray(cfg.offsetsMinutes) && cfg.offsetsMinutes.length
        ? cfg.offsetsMinutes
        : DEFAULT_REMINDER_CONFIG.offsetsMinutes,
    repeatCount: cfg.repeatCount ?? DEFAULT_REMINDER_CONFIG.repeatCount,
  };
}
