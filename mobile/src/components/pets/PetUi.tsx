import React from 'react';
import { ActivityIndicator, Pressable, Text, View, type ViewProps } from 'react-native';
import { ChevronRight, PawPrint, type LucideIcon } from 'lucide-react-native';
import { Input } from '@/components/ui/Input';
import { useIsDark, useThemeColors } from '@/theme/colors';
import { Bone } from '@/components/ui/Skeleton';
import { STACK_PUSH } from '@/theme/stackMotion';

export const PET_FONT = { regular: 'NotoSansGeorgian_400Regular', medium: 'NotoSansGeorgian_500Medium', bold: 'NotoSansGeorgian_700Bold' };
export function PetInput(props: React.ComponentProps<typeof Input>) {
  return <Input {...props} accessibilityLabel={props.accessibilityLabel ?? props.label} />;
}
export function PetText({ children, size = 14, bold, muted, color }: { children: React.ReactNode; size?: number; bold?: boolean; muted?: boolean; color?: string }) {
  const c = useThemeColors();
  return <Text style={{ fontFamily: bold ? PET_FONT.bold : PET_FONT.regular, fontSize: size, lineHeight: Math.round(size * 1.5), color: color ?? (muted ? c.text200 : c.text100), flexShrink: 1 }}>{children}</Text>;
}
export function PetPanel({ children, onPress, padded = true, elevated: _elevated, className, style, ...rest }: ViewProps & { children: React.ReactNode; onPress?: () => void; padded?: boolean; elevated?: boolean; className?: string }) {
  const c = useThemeColors();
  const panel = [{ borderRadius: 24, borderWidth: 1, borderColor: c.bg300, backgroundColor: c.surface, padding: padded ? 18 : 0 }, style];
  return onPress ? <Pressable accessibilityRole="button" onPress={onPress} className={className} style={panel} {...rest}>{children}</Pressable> : <View className={className} style={panel} {...rest}>{children}</View>;
}
export function PetButton({ label, onPress, variant = 'primary', icon: Icon, loading, disabled, size = 'md', fullWidth = true, ...rest }: { label: string; onPress?: () => void; variant?: 'primary' | 'secondary' | 'ghost' | 'danger'; icon?: LucideIcon; loading?: boolean; disabled?: boolean; size?: 'sm' | 'md' | 'lg'; fullWidth?: boolean; accessibilityLabel?: string; testID?: string }) {
  const c = useThemeColors(), dark = useIsDark(), inactive = disabled || loading;
  const ink = variant === 'primary' ? '#FFFFFF' : variant === 'danger' ? c.danger : dark ? '#99F6E4' : '#0F766E';
  return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled: Boolean(inactive), busy: Boolean(loading) }} disabled={inactive} onPress={onPress} {...rest} style={{ minHeight: size === 'sm' ? 44 : 52, paddingHorizontal: 16, paddingVertical: 12, borderRadius: 17, alignSelf: fullWidth ? 'stretch' : 'flex-start', backgroundColor: variant === 'primary' ? '#0D9488' : variant === 'danger' ? c.dangerBg : variant === 'ghost' ? 'transparent' : c.surfaceRaised, opacity: inactive ? .5 : 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
    {loading ? <ActivityIndicator color={ink} /> : <>{Icon ? <Icon size={19} color={ink} /> : null}<PetText bold color={ink}>{label}</PetText></>}
  </Pressable>;
}
export function PetIntro({ title, body, eyebrow, icon: Icon = PawPrint }: { title: string; body: string; eyebrow?: string; icon?: LucideIcon }) {
  const c = useThemeColors();
  return <View style={{ gap: 8, paddingVertical: 4 }}><View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><Icon size={16} color={c.primary200} /><PetText size={11} bold color={c.primary100}>{eyebrow ?? 'MEDICARD · PETS'}</PetText></View><PetText size={26} bold>{title}</PetText><PetText size={14} muted>{body}</PetText></View>;
}
export function PetAction({ title, body, icon: Icon, onPress, compact = false }: { title: string; body: string; icon: LucideIcon; onPress: () => void; compact?: boolean }) {
  const c = useThemeColors();
  return <PetPanel onPress={onPress} style={{ flex: compact ? 1 : undefined }}><View style={{ gap: 12, flexDirection: compact ? 'column' : 'row', alignItems: compact ? 'flex-start' : 'center' }}><View style={{ width: 42, height: 42, borderRadius: 15, backgroundColor: c.accent100, alignItems: 'center', justifyContent: 'center' }}><Icon size={22} color={c.primary100} /></View><View style={{ flex: compact ? undefined : 1, gap: 4 }}><PetText bold>{title}</PetText><PetText size={12} muted>{body}</PetText></View>{compact ? null : <ChevronRight size={17} color={c.text300} />}</View></PetPanel>;
}
export function PetLoading() { const c = useThemeColors(); return <View style={{ flex: 1, padding: 16, gap: 18, backgroundColor: c.bg100 }} accessibilityLabel="იტვირთება"><Bone height={150} radius={24} /><Bone height={92} radius={24} /><Bone height={92} radius={24} /></View>; }
export function usePetStackOptions() {
  const c = useThemeColors();
  return { ...STACK_PUSH, headerBackTitle: 'უკან', headerTitleStyle: { fontFamily: PET_FONT.bold, fontSize: 16 }, headerStyle: { backgroundColor: c.bg100 }, headerTintColor: c.text100, headerShadowVisible: false, contentStyle: { backgroundColor: c.bg100 } };
}
