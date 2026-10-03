import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LayoutGrid, ShieldCheck, SquarePen, Volume2, VolumeX, type LucideIcon } from 'lucide-react-native';
import { APP_MODAL_OVERLAY, APP_MODAL_PROPS, Modal } from '@/components/ui/appModal';
import { useThemeColors } from '@/theme/colors';
import { tx } from '@/i18n/locale';

export function MediMenuSheet({ visible, onClose, onNew, onDirectory, onPrivacy, speech }: {
  visible: boolean; onClose: () => void; onNew: (() => void) | null; onDirectory: () => void; onPrivacy: () => void;
  /** null when spoken replies are unavailable or paused. */
  speech: { muted: boolean; toggle: () => void } | null;
}) {
  const c = useThemeColors();
  const insets = useSafeAreaInsets();
  const row = (Icon: LucideIcon, label: string, hint: string | null, onPress: () => void) => (
    <Pressable key={label} accessibilityRole="button" onPress={() => { onClose(); onPress(); }}
      style={{ minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 6 }}>
      <View style={{ width: 38, height: 38, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: c.bg200 }}>
        <Icon size={19} color={c.text100} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ color: c.text100, fontSize: 15, lineHeight: 22, fontFamily: 'NotoSansGeorgian_600SemiBold' }}>{label}</Text>
        {hint ? <Text style={{ color: c.text300, fontSize: 12, lineHeight: 17, fontFamily: 'NotoSansGeorgian_400Regular' }}>{hint}</Text> : null}
      </View>
    </Pressable>
  );
  return (
    <Modal visible={visible} {...APP_MODAL_PROPS} onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: 'flex-end' }}>
        <Pressable accessibilityRole="button" accessibilityLabel={tx('დახურვა', 'Close')} onPress={onClose} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: APP_MODAL_OVERLAY }} />
        <View style={{ backgroundColor: c.surface, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 16, paddingTop: 10, paddingBottom: Math.max(insets.bottom, 16) }}>
          <View style={{ alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: c.bg300, marginBottom: 10 }} />
          {onNew ? row(SquarePen, tx('ახალი საუბარი', 'New conversation'), null, onNew) : null}
          {row(LayoutGrid, tx('რას აკეთებს Medi', 'What Medi can do'), tx('ყველა მოქმედება და გვერდი ერთ სიაში', 'Every action and page in one list'), onDirectory)}
          {speech ? row(speech.muted ? VolumeX : Volume2, speech.muted ? tx('ხმოვანი პასუხების ჩართვა', 'Turn on spoken replies') : tx('ხმოვანი პასუხების გამორთვა', 'Turn off spoken replies'),
            tx('Medi ხმით პასუხობს, როცა ხმით ელაპარაკები', 'Medi answers out loud when you speak to it'), speech.toggle) : null}
          {row(ShieldCheck, tx('AI და კონფიდენციალურობა', 'AI and privacy'), tx('რა იგზავნება AI-სთან და ვის', 'What is sent to AI and to whom'), onPrivacy)}
        </View>
      </View>
    </Modal>
  );
}
