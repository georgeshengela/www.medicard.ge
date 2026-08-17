import { ka } from '@/i18n/ka';

export type CycleNotificationMaskStyle = 'neutral' | 'wellness' | 'calendar' | 'notes';

export type MaskedNotificationCopy = {
  title: string;
  body: string;
  channelName: string;
};

export const CYCLE_MASK_STYLES: CycleNotificationMaskStyle[] = [
  'neutral',
  'wellness',
  'calendar',
  'notes',
];

export function getMaskPreset(style: CycleNotificationMaskStyle): MaskedNotificationCopy {
  switch (style) {
    case 'wellness':
      return {
        title: ka.cycle.maskWellnessTitle,
        body: ka.cycle.maskWellnessBody,
        channelName: ka.cycle.maskWellnessChannel,
      };
    case 'calendar':
      return {
        title: ka.cycle.maskCalendarTitle,
        body: ka.cycle.maskCalendarBody,
        channelName: ka.cycle.maskCalendarChannel,
      };
    case 'notes':
      return {
        title: ka.cycle.maskNotesTitle,
        body: ka.cycle.maskNotesBody,
        channelName: ka.cycle.maskNotesChannel,
      };
    case 'neutral':
    default:
      return {
        title: ka.cycle.maskNeutralTitle,
        body: ka.cycle.maskNeutralBody,
        channelName: ka.cycle.maskNeutralChannel,
      };
  }
}

export function maskCycleNotificationContent(
  real: { title: string; body: string },
  maskEnabled: boolean,
  style: CycleNotificationMaskStyle,
): { title: string; body: string; masked: boolean } {
  if (!maskEnabled) {
    return { ...real, masked: false };
  }
  const preset = getMaskPreset(style);
  return {
    title: preset.title,
    body: preset.body,
    masked: true,
  };
}

export function maskStyleLabel(style: CycleNotificationMaskStyle): string {
  switch (style) {
    case 'wellness':
      return ka.cycle.maskStyleWellness;
    case 'calendar':
      return ka.cycle.maskStyleCalendar;
    case 'notes':
      return ka.cycle.maskStyleNotes;
    default:
      return ka.cycle.maskStyleNeutral;
  }
}

export function lockScreenPreview(
  maskEnabled: boolean,
  style: CycleNotificationMaskStyle,
  realTitle: string,
  realBody: string,
) {
  if (!maskEnabled) {
    return { title: realTitle, body: realBody, label: ka.cycle.maskBeforeLabel };
  }
  const preset = getMaskPreset(style);
  return { title: preset.title, body: preset.body, label: ka.cycle.maskOthersSee };
}
