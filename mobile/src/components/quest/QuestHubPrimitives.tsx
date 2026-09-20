import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { ArrowUpRight, ChevronRight } from 'lucide-react-native';
import { useIsDark, useThemeColors } from '@/theme/colors';

export const QF = { regular: 'NotoSansGeorgian_400Regular', medium: 'NotoSansGeorgian_500Medium', bold: 'NotoSansGeorgian_700Bold' };
export function QText({ children, size = 14, bold, muted, color, style }: { children: React.ReactNode; size?: number; bold?: boolean; muted?: boolean; color?: string; style?: object }) {
  const c = useThemeColors();
  return <Text style={[{ fontFamily: bold ? QF.bold : QF.regular, fontSize: size, lineHeight: Math.round(size * 1.5), color: color ?? (muted ? c.text200 : c.text100), flexShrink: 1 }, style]}>{children}</Text>;
}
export function QCard({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  const c = useThemeColors();
  return <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.bg300 }, style]}>{children}</View>;
}
export function QButton({ label, onPress, secondary, disabled, busy, icon }: { label: string; onPress: () => void; secondary?: boolean; disabled?: boolean; busy?: boolean; icon?: React.ReactNode }) {
  const c = useThemeColors(), dark = useIsDark();
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled: Boolean(disabled || busy), busy }} disabled={disabled || busy} onPress={onPress} className="active:opacity-75" style={[styles.button, { backgroundColor: secondary ? c.surfaceRaised : '#0D9488', opacity: disabled ? .5 : 1 }]}>
    {busy ? <ActivityIndicator color={secondary ? c.primary200 : '#FFFFFF'} /> : <>{icon}<QText bold color={secondary ? (dark ? '#99F6E4' : '#0F766E') : '#FFFFFF'}>{label}</QText></>}
  </Pressable>;
}
export function QHeading({ title, meta }: { title: string; meta?: string }) {
  return <View style={styles.between}><QText size={18} bold>{title}</QText>{meta ? <QText size={12} muted>{meta}</QText> : null}</View>;
}
export function QLink({ title, body, icon, onPress, external }: { title: string; body: string; icon: React.ReactNode; onPress: () => void; external?: boolean }) {
  const c = useThemeColors();
  return <Pressable accessibilityRole="button" onPress={onPress} className="active:opacity-75" style={[styles.link, { backgroundColor: c.surface, borderColor: c.bg300 }]}>
    <View style={[styles.well, { backgroundColor: c.bg100 }]}>{icon}</View>
    <View style={{ flex: 1, gap: 2 }}><QText bold>{title}</QText><QText size={12} muted>{body}</QText></View>
    {external ? <ArrowUpRight size={18} color={c.text300} /> : <ChevronRight size={18} color={c.text300} />}
  </Pressable>;
}
export function QNotice({ text, action, onPress, danger }: { text: string; action?: string; onPress?: () => void; danger?: boolean }) {
  const c = useThemeColors();
  return <View accessibilityLiveRegion="polite" style={[styles.notice, { backgroundColor: danger ? c.dangerBg : c.surfaceRaised }]}>
    <QText size={13} color={danger ? c.danger : c.text200}>{text}</QText>
    {action && onPress ? <Pressable accessibilityRole="button" onPress={onPress} style={{ minHeight: 44, justifyContent: 'center' }}><QText bold color={c.primary200}>{action}</QText></Pressable> : null}
  </View>;
}
const styles = StyleSheet.create({
  card: { padding: 18, borderRadius: 24, borderWidth: 1, gap: 12 },
  button: { minHeight: 48, paddingVertical: 12, paddingHorizontal: 16, borderRadius: 16, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center' },
  between: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  link: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, minHeight: 84, borderWidth: 1, borderRadius: 22 },
  well: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  notice: { borderRadius: 16, paddingHorizontal: 16, paddingVertical: 12, gap: 2 },
});
