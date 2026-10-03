import { CyclePressable as Pressable } from '@/components/cycle/CyclePressable';
import React from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { LucideIcon } from 'lucide-react-native';
import { MedicalSourcesLink } from '@/components/health/MedicalSourcesLink';
import { APP_MODAL_PROPS, Modal } from '@/components/ui/appModal';
import type { MedicalSourceId } from '@/constants/medicalSources';
import { ka } from '@/i18n/ka';
import { trackCycleExplainOpened } from '@/lib/funnel';
import type { CycleExplainTopic } from '@/lib/funnelQueue';
import { useCycleColors } from '@/theme/cycle';

/**
 * The cycle module's one bottom sheet for explanations and confirmations (brief §6 weakness 6,
 * §8.2 item 8): it replaces every native `Alert.alert`. Title, body paragraphs, optional medical
 * sources, optional custom content, an optional action row (primary / destructive / secondary) and
 * one close button. A confirmation is the same sheet with `actions` — the close button then reads
 * „გაუქმება“ unless `closeLabel` says otherwise. Flat hub card, radius 28, no border.
 */

export type CycleExplainAction = {
  label: string;
  onPress: () => void;
  tone?: 'primary' | 'destructive' | 'secondary';
  disabled?: boolean;
  loading?: boolean;
  icon?: LucideIcon;
};

type Props = {
  visible: boolean;
  title: string;
  /** One paragraph or several; estimates keep their „სავარაუდოდ“ wording in the copy itself. */
  body?: string | readonly string[];
  /** Small dot beside the title (phase colour, danger, …). */
  accent?: string;
  sourceIds?: readonly MedicalSourceId[];
  /** Muted footnote under the body. */
  caption?: string;
  /** Custom content between the body and the actions (pickers, rows). */
  children?: React.ReactNode;
  /** Confirmation / choice buttons, rendered top to bottom. */
  actions?: readonly CycleExplainAction[];
  /** Label of the last button; defaults to „დახურვა“, or „გაუქმება“ when there are actions. */
  closeLabel?: string;
  /** Hide the close button (the actions already cover every exit); the scrim still closes. */
  hideClose?: boolean;
  /**
   * Draw inside the parent's own Modal (an absolute-fill layer) instead of presenting a second
   * native Modal — for sheets opened from another sheet (the day sheet's „გაიგე მეტი“). The parent
   * must render it as the last child of a full-screen container.
   */
  embedded?: boolean;
  /** Funnel topic reported once per opening (an enum only — never which entry or value). */
  funnelTopic?: CycleExplainTopic;
  onClose: () => void;
};

export function CycleExplainSheet({
  visible,
  title,
  body,
  accent,
  sourceIds,
  caption,
  children,
  actions,
  closeLabel,
  hideClose,
  embedded = false,
  funnelTopic,
  onClose,
}: Props) {
  const c = useCycleColors();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const paragraphs = body == null ? [] : typeof body === 'string' ? [body] : [...body];
  const hasActions = Boolean(actions && actions.length > 0);
  const lastLabel = closeLabel ?? (hasActions ? ka.common.cancel : ka.common.close);

  // One event per opening (false → true), never on re-renders while open.
  React.useEffect(() => {
    if (visible && funnelTopic) trackCycleExplainOpened(funnelTopic);
  }, [visible, funnelTopic]);

  const sheet = (
    <View style={s.root}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={ka.common.close}
        onPress={onClose}
        style={[StyleSheet.absoluteFill, { backgroundColor: c.overlay }]}
      />
      <View
        accessibilityViewIsModal
        accessibilityLabel={title}
        style={[s.sheet, { backgroundColor: c.card, paddingBottom: insets.bottom + 18, maxHeight: height * 0.88 }]}
      >
        <View style={[s.handle, { backgroundColor: c.border }]} />
        <View style={s.titleRow}>
          {accent ? <View style={[s.dot, { backgroundColor: accent }]} /> : null}
          <Text accessibilityRole="header" style={[s.title, { color: c.ink }]}>
            {title}
          </Text>
        </View>
        <ScrollView
          bounces={false}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          style={{ flexGrow: 0 }}
          contentContainerStyle={{ paddingBottom: 4 }}
        >
          {paragraphs.map((text, i) => (
            <Text key={i} style={[s.body, { color: c.muted, marginTop: i === 0 ? 0 : 10 }]}>
              {text}
            </Text>
          ))}
          {children ? <View style={{ marginTop: paragraphs.length ? 16 : 0 }}>{children}</View> : null}
          {sourceIds && sourceIds.length ? <MedicalSourcesLink sourceIds={sourceIds} /> : null}
          {caption ? <Text style={[s.caption, { color: c.mutedSoft }]}>{caption}</Text> : null}
        </ScrollView>
        <View style={{ gap: 10, marginTop: 18 }}>
          {actions?.map((action) => <ActionButton key={action.label} action={action} />)}
          {hideClose ? null : (
            <Pressable
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel={lastLabel}
              style={[s.button, { backgroundColor: hasActions ? 'transparent' : c.cardSoft }]}
            >
              <Text style={[s.buttonLabel, { color: hasActions ? c.muted : c.ink }]}>{lastLabel}</Text>
            </Pressable>
          )}
        </View>
      </View>
    </View>
  );

  if (embedded) return visible ? <View style={StyleSheet.absoluteFill}>{sheet}</View> : null;
  return (
    <Modal visible={visible} {...APP_MODAL_PROPS} onRequestClose={onClose}>
      {sheet}
    </Modal>
  );
}

function ActionButton({ action }: { action: CycleExplainAction }) {
  const c = useCycleColors();
  const tone = action.tone ?? 'primary';
  const blocked = Boolean(action.disabled || action.loading);
  const bg = tone === 'primary' ? c.cta : tone === 'destructive' ? c.dangerSoft : c.cardSoft;
  const fg = tone === 'primary' ? c.onPrimary : tone === 'destructive' ? c.danger : c.ink;
  const Icon = action.icon;
  return (
    <Pressable
      onPress={action.onPress}
      disabled={blocked}
      accessibilityRole="button"
      accessibilityLabel={action.label}
      accessibilityState={{ disabled: blocked, busy: Boolean(action.loading) }}
      style={[s.button, { backgroundColor: bg, opacity: action.disabled ? 0.5 : 1 }]}
    >
      {action.loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          {Icon ? <Icon size={17} color={fg} strokeWidth={2.4} /> : null}
          <Text style={[s.buttonLabel, { color: fg }]}>{action.label}</Text>
        </View>
      )}
    </Pressable>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 20, paddingTop: 12 },
  handle: { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  dot: { width: 12, height: 12, borderRadius: 6 },
  title: { fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 18, lineHeight: 25, flex: 1 },
  body: { fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 14, lineHeight: 21 },
  caption: { fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 12, lineHeight: 18, marginTop: 14 },
  button: { minHeight: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
  buttonLabel: { fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 15 },
});
