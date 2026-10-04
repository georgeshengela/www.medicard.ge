import React from 'react';
import { ActivityIndicator, Image, Pressable, Text, View, type ImageSourcePropType, type ViewProps } from 'react-native';
import { ChevronRight, PawPrint, type LucideIcon } from 'lucide-react-native';
import { Input } from '@/components/ui/Input';
import { useThemeColors } from '@/theme/colors';
import { Bone } from '@/components/ui/Skeleton';
import { useStackMotion } from '@/hooks/useStackMotion';
import { tx } from '@/i18n/locale';
import { ModuleStackHeader, ModuleHeaderButton } from '@/components/brand/ModuleHeader';
import { HUB } from '@/theme/hub';
import { MODULE_BRANDS } from '@/theme/moduleBrand';

/** MEDIVET's filled-button colour (white text passes AA in both themes). */
const VET_FILL = MODULE_BRANDS.vet.ink.light;

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
  const panel = [{ borderRadius: HUB.cardRadius, backgroundColor: c.surface, padding: padded ? 16 : 0, overflow: 'hidden' as const }, style];
  return onPress ? <Pressable accessibilityRole="button" onPress={onPress} className={className} style={panel} {...rest}>{children}</Pressable> : <View className={className} style={panel} {...rest}>{children}</View>;
}
export function PetButton({ label, onPress, variant = 'primary', icon: Icon, loading, disabled, size = 'md', fullWidth = true, ...rest }: { label: string; onPress?: () => void; variant?: 'primary' | 'secondary' | 'ghost' | 'danger'; icon?: LucideIcon; loading?: boolean; disabled?: boolean; size?: 'sm' | 'md' | 'lg'; fullWidth?: boolean; accessibilityLabel?: string; testID?: string }) {
  const c = useThemeColors(), inactive = disabled || loading;
  const ink = variant === 'primary' ? '#FFFFFF' : variant === 'danger' ? c.danger : c.primary100;
  return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled: Boolean(inactive), busy: Boolean(loading) }} disabled={inactive} onPress={onPress} {...rest} style={{ minHeight: size === 'sm' ? 44 : 52, paddingHorizontal: 16, paddingVertical: 12, borderRadius: 17, alignSelf: fullWidth ? 'stretch' : 'flex-start', backgroundColor: variant === 'primary' ? VET_FILL : variant === 'danger' ? c.dangerBg : variant === 'ghost' ? 'transparent' : c.surface, opacity: inactive ? .5 : 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
    {loading ? <ActivityIndicator color={ink} /> : <>{Icon ? <Icon size={19} color={ink} /> : null}<PetText bold color={ink}>{label}</PetText></>}
  </Pressable>;
}
/** A page's opening lines: one short title and one line of help (no eyebrow — the header names the module). */
export function PetIntro({ title, body }: { title: string; body: string; eyebrow?: string; icon?: LucideIcon }) {
  return <View style={{ gap: 4 }}><PetText size={20} bold>{title}</PetText><PetText size={13} muted>{body}</PetText></View>;
}
export function PetAction({ title, body, icon: Icon, art, onPress, compact = false }: { title: string; body: string; icon: LucideIcon; art?: ImageSourcePropType; onPress: () => void; compact?: boolean }) {
  const c = useThemeColors();
  return <PetPanel onPress={onPress} style={{ flex: compact ? 1 : undefined }}><View style={{ gap: 12, flexDirection: compact ? 'column' : 'row', alignItems: compact ? 'flex-start' : 'center' }}>{art ? <Image source={art} resizeMode="contain" accessibilityIgnoresInvertColors style={{ width: 46, height: 46 }} /> : <View style={{ width: HUB.tile, height: HUB.tile, borderRadius: HUB.tileRadius, backgroundColor: c.accent100, alignItems: 'center', justifyContent: 'center' }}><Icon size={20} color={c.primary100} /></View>}<View style={{ flex: compact ? undefined : 1, gap: 4 }}><PetText bold>{title}</PetText><PetText size={12} muted>{body}</PetText></View>{compact ? null : <ChevronRight size={17} color={c.text300} />}</View></PetPanel>;
}
export function PetLoading() { const c = useThemeColors(); return <View style={{ flex: 1, padding: HUB.gutter, gap: 16, backgroundColor: c.bg100 }} accessibilityLabel={tx('იტვირთება', 'Loading')}><Bone height={150} radius={HUB.cardRadius} /><Bone height={92} radius={HUB.cardRadius} /><Bone height={92} radius={HUB.cardRadius} /></View>; }
/**
 * Every MEDIVET stack screen gets the standard module header (owner 2026-10-04): back · MEDIVET +
 * the screen title as its one line · the screen's `headerRight` (a `ModuleHeaderButton`).
 */
export function usePetStackOptions() {
  const motion = useStackMotion();
  const c = useThemeColors();
  return {
    ...motion,
    contentStyle: { backgroundColor: c.bg100 },
    header: ({ navigation, options }: { navigation: { canGoBack: () => boolean; goBack: () => void }; options: { title?: string; headerRight?: (props: { canGoBack: boolean; tintColor?: string }) => React.ReactNode } }) => (
      <ModuleStackHeader
        module="vet"
        subtitle={options.title}
        onBack={navigation.canGoBack() ? () => navigation.goBack() : undefined}
        fallbackHref="/pets"
        right={options.headerRight ? options.headerRight({ canGoBack: true, tintColor: c.text100 }) : undefined}
      />
    ),
  };
}

/** The header's right button on MEDIVET screens. */
export const PetHeaderButton = ModuleHeaderButton;
