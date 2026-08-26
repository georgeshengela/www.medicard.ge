import { Bot, FlaskConical, ScanLine, Stethoscope, Users, type LucideIcon } from 'lucide-react-native';
import { ka } from '@/i18n/ka';

export type ConversationalChatMode = 'doctor' | 'consilium';

export type AnalysisChatKind = 'LAB' | 'IMAGING' | 'SKIN';

export type ChatUiProfile = {
  key: string;
  title: string;
  subtitle?: string;
  icon: LucideIcon;
  inputPlaceholder: string;
  emptyTitle: string;
  emptyBody: string;
  suggestions: string[];
  thinkingLabel: string;
  apiMode?: 'DOCTOR' | 'CONSILIUM';
  allowMarkdownLinks?: boolean;
};

export function getConversationalChatProfile(mode: string | undefined): ChatUiProfile {
  if (mode === 'consilium') {
    return {
      key: 'consilium',
      title: ka.modules.consilium.title,
      subtitle: ka.modules.consilium.subtitle,
      icon: Users,
      inputPlaceholder: ka.modules.consilium.inputPlaceholder,
      emptyTitle: ka.modules.consilium.emptyTitle,
      emptyBody: ka.modules.consilium.emptyBody,
      suggestions: [],
      thinkingLabel: ka.common.analyzing,
      apiMode: 'CONSILIUM',
      allowMarkdownLinks: true,
    };
  }

  return {
    key: 'doctor',
    title: ka.chat.navDoctorTitle,
    subtitle: ka.modules.doctor.subtitle,
    icon: Bot,
    inputPlaceholder: ka.chat.writeMessage,
    emptyTitle: ka.modules.doctor.emptyTitle,
    emptyBody: ka.modules.doctor.emptyBody,
    suggestions: [ka.modules.doctor.suggestion1, ka.modules.doctor.suggestion2, ka.modules.doctor.suggestion3],
    thinkingLabel: ka.modules.doctor.thinking,
    apiMode: 'DOCTOR',
    allowMarkdownLinks: false,
  };
}

export function getAnalysisChatProfile(kind: AnalysisChatKind): ChatUiProfile {
  if (kind === 'IMAGING') {
    return {
      key: 'imaging',
      title: ka.modules.imaging.title,
      subtitle: ka.modules.imaging.subtitle,
      icon: ScanLine,
      inputPlaceholder: ka.modules.imaging.contextPlaceholder,
      emptyTitle: ka.modules.imaging.uploadTitle,
      emptyBody: ka.modules.imaging.uploadHint,
      suggestions: [],
      thinkingLabel: ka.common.analyzing,
    };
  }

  if (kind === 'SKIN') {
    return {
      key: 'skin',
      title: ka.modules.skin.title,
      subtitle: ka.modules.skin.subtitle,
      icon: Stethoscope,
      inputPlaceholder: ka.modules.skin.contextPlaceholder,
      emptyTitle: ka.modules.skin.uploadTitle,
      emptyBody: ka.modules.skin.uploadHint,
      suggestions: [],
      thinkingLabel: ka.common.analyzing,
    };
  }

  return {
    key: 'lab',
    title: ka.modules.lab.title,
    subtitle: ka.modules.lab.subtitle,
    icon: FlaskConical,
    inputPlaceholder: ka.modules.lab.contextPlaceholder,
    emptyTitle: ka.modules.lab.uploadTitle,
    emptyBody: ka.modules.lab.uploadHint,
    suggestions: [],
    thinkingLabel: ka.common.analyzing,
  };
}

export function formatChatTime(timestamp: string): string {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return '';
  const hours = date.getHours();
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const h12 = hours % 12 || 12;
  const ampm = hours >= 12 ? 'pm' : 'am';
  return `${h12}:${minutes} ${ampm}`;
}
