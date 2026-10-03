import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View, type ImageSourcePropType, type ViewStyle } from 'react-native';
import { KeyboardFormShell } from '@/components/ui/KeyboardFormShell';
import { SkeletonPage, haptic } from '@/components/coach/CoachKit';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft, BadgeCheck, type LucideIcon } from 'lucide-react-native';
import { AVATAR_SOURCES, isAvatarId } from '@/constants/avatarAssets';
import { AuthImageError, cachedAuthImage } from '@/lib/authImageCache';
import { API_BASE_URL } from '@/lib/api';
import { getToken } from '@/lib/storage';
import { localAccountId } from '@/lib/localAccount';
import { dayStatusColor, type DayStatus } from '@/lib/coach';
import { HUB, hubInk, hubText, hubTint, type HubInk } from '@/theme/hub';
import { useIsDark, useThemeColors } from '@/theme/colors';
import { tx } from '@/i18n/locale';
import { ModuleWordmark } from '@/components/brand/ModuleWordmark';
import type { ModuleBrandId } from '@/theme/moduleBrand';

/** Filled CTA colour on dark (AGENTS.md: FIGMA_AUTH_DARK.primaryBg). */
export const CTA = '#0D9488';

export function CoachHeader({ title, brand, subtitle, right, onBack, fallback = '/(tabs)/profile' }: { title: string; brand?: ModuleBrandId; subtitle?: string; right?: React.ReactNode; onBack?: () => void; fallback?: string }) {
  const c = useThemeColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const back = () => {
    if (onBack) return onBack();
    if (router.canGoBack()) router.back();
    else router.replace(fallback as never);
  };
  return (
    <View style={{ paddingTop: insets.top, backgroundColor: c.bg100 }}>
      <View style={s.headerRow}>
        <Pressable accessibilityRole="button" accessibilityLabel={tx('უკან', 'Back')} hitSlop={12} onPress={back} style={[s.backBtn, { backgroundColor: c.surface }]}>
          <ArrowLeft size={20} color={c.text100} strokeWidth={2.2} />
        </Pressable>
        <View style={{ flex: 1, minWidth: 0 }}>
          {brand ? <ModuleWordmark module={brand} /> : <Text numberOfLines={1} accessibilityRole="header" style={[s.headerTitle, { color: c.text100 }]}>{title}</Text>}
          {subtitle ? <Text numberOfLines={1} style={[hubText.caption, { color: c.text300 }]}>{subtitle}</Text> : null}
        </View>
        {right ?? <View style={{ width: 40 }} />}
      </View>
    </View>
  );
}

export function Section({ title, link, onLink, children, style }: { title?: string; link?: string; onLink?: () => void; children: React.ReactNode; style?: ViewStyle }) {
  const c = useThemeColors();
  return (
    <View style={[{ marginTop: HUB.sectionGap }, style]}>
      {title ? (
        <View style={s.sectionHead}>
          <Text accessibilityRole="header" style={[hubText.sectionTitle, { color: c.text100, flex: 1 }]}>{title}</Text>
          {link && onLink ? (
            <Pressable accessibilityRole="button" onPress={onLink} hitSlop={10} style={{ minHeight: 44, justifyContent: 'center' }}>
              <Text style={[hubText.link, { color: c.primary100 }]}>{link}</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
      {children}
    </View>
  );
}

export function Card({ children, style, onPress, accessibilityLabel }: { children: React.ReactNode; style?: ViewStyle | ViewStyle[]; onPress?: () => void; accessibilityLabel?: string }) {
  const c = useThemeColors();
  const base = [s.card, { backgroundColor: c.surface }, style as ViewStyle];
  if (!onPress) return <View style={base}>{children}</View>;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel} onPress={onPress} className="active:opacity-80" android_ripple={{ color: 'rgba(20,184,166,0.12)', borderless: false }} style={base}>
      {children}
    </Pressable>
  );
}

export function IconTile({ icon: Icon, ink = 'teal', size = HUB.tile }: { icon: LucideIcon; ink?: HubInk; size?: number }) {
  const dark = useIsDark();
  const color = hubInk(ink, dark);
  return (
    <View style={{ width: size, height: size, borderRadius: HUB.tileRadius, backgroundColor: hubTint(color, dark), alignItems: 'center', justifyContent: 'center' }}>
      <Icon size={Math.round(size * 0.5)} color={color} strokeWidth={1.9} />
    </View>
  );
}

export function Button({ label, onPress, disabled, busy, kind = 'primary', icon: Icon, style }: { label: string; onPress: () => void; disabled?: boolean; busy?: boolean; kind?: 'primary' | 'secondary' | 'danger' | 'ghost'; icon?: LucideIcon; style?: ViewStyle }) {
  const c = useThemeColors();
  const bg = kind === 'primary' ? CTA : kind === 'danger' ? c.dangerBg : kind === 'ghost' ? 'transparent' : c.bg200;
  const fg = kind === 'primary' ? '#FFFFFF' : kind === 'danger' ? c.danger : c.text100;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: Boolean(disabled || busy), busy: Boolean(busy) }}
      disabled={disabled || busy}
      onPress={() => {
        if (kind === 'primary') haptic.press();
        onPress();
      }}
      className="active:opacity-80"
      style={[s.button, { backgroundColor: bg, opacity: disabled ? 0.5 : 1 }, style]}
    >
      {busy ? <ActivityIndicator color={fg} /> : Icon ? <Icon size={18} color={fg} strokeWidth={2.1} /> : null}
      <Text style={[s.buttonText, { color: fg }]}>{label}</Text>
    </Pressable>
  );
}

export function Chip({ label, selected, onPress, tone }: { label: string; selected?: boolean; onPress?: () => void; tone?: string }) {
  const c = useThemeColors();
  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : 'text'}
      accessibilityState={{ selected: Boolean(selected) }}
      disabled={!onPress}
      onPress={() => {
        haptic.tap();
        onPress?.();
      }}
      style={[s.chip, { backgroundColor: selected ? CTA : c.bg200 }]}
    >
      {tone ? <View style={[s.dot, { backgroundColor: tone }]} /> : null}
      <Text style={[hubText.link, { color: selected ? '#FFFFFF' : c.text100 }]}>{label}</Text>
    </Pressable>
  );
}

export function Badge({ label, tone = 'neutral' }: { label: string; tone?: 'ok' | 'warn' | 'bad' | 'neutral' | 'brand' }) {
  const c = useThemeColors();
  const map = {
    ok: [c.successBg, c.success],
    warn: [c.warningBg, c.warning],
    bad: [c.dangerBg, c.danger],
    neutral: [c.bg200, c.text200],
    brand: [c.accent100, c.primary100],
  } as const;
  const [bg, fg] = map[tone];
  return (
    <View style={[s.badge, { backgroundColor: bg }]}>
      <Text style={[hubText.small, { color: fg, fontFamily: 'NotoSansGeorgian_600SemiBold' }]}>{label}</Text>
    </View>
  );
}

export function Avatar({ avatarId, photoUrl, name, size = 44, verified }: { avatarId?: string | null; photoUrl?: string | null; name: string; size?: number; verified?: boolean }) {
  const c = useThemeColors();
  const letter = (name || '?').trim().slice(0, 1).toUpperCase();
  // A photo that cannot be loaded falls back to the preset avatar / initial, never an empty circle.
  const [broken, setBroken] = useState<string | null>(null);
  return (
    <View style={{ width: size, height: size }}>
      {photoUrl && broken !== photoUrl ? (
        <PrivateImage path={photoUrl} label={name} style={{ width: size, height: size, borderRadius: size / 2 }} onFail={() => setBroken(photoUrl)} />
      ) : avatarId && isAvatarId(avatarId) ? (
        <Image source={AVATAR_SOURCES[avatarId]} style={{ width: size, height: size, borderRadius: size / 2 }} accessibilityIgnoresInvertColors />
      ) : (
        <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: c.accent100, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontFamily: 'NotoSansGeorgian_700Bold', fontSize: size * 0.4, color: c.primary100 }}>{letter}</Text>
        </View>
      )}
      {verified ? (
        <View style={[s.verified, { backgroundColor: c.bg100 }]}>
          <BadgeCheck size={Math.max(14, size * 0.34)} color="#0EA5E9" fill="#E0F2FE" strokeWidth={2.2} />
        </View>
      ) : null}
    </View>
  );
}

/** Adherence dots for a run of days (oldest → newest). */
export function DayStrip({ days, size = 10, labels = false }: { days: { date: string; status: DayStatus }[]; size?: number; labels?: boolean }) {
  const dark = useIsDark();
  const c = useThemeColors();
  return (
    <View style={{ flexDirection: 'row', gap: labels ? 6 : 4, alignItems: 'flex-end' }} accessibilityRole="image" accessibilityLabel={tx(`კვების დაცვა: ${days.filter((d) => d.status === 'ON').length} დღე გეგმაში ${days.length}-დან`, `Nutrition plan: ${days.filter((d) => d.status === 'ON').length} of ${days.length} days on plan`)}>
      {days.map((d) => (
        <View key={d.date} style={{ alignItems: 'center', gap: 4, flex: labels ? 1 : undefined }}>
          <View style={{ width: labels ? '100%' : size, height: labels ? 26 : size, borderRadius: labels ? 8 : size / 2, backgroundColor: dayStatusColor(d.status, dark), opacity: d.status === 'NONE' ? 0.7 : 1 }} />
          {labels ? <Text style={[hubText.small, { color: c.text300, fontSize: 10 }]}>{Number(d.date.slice(8))}</Text> : null}
        </View>
      ))}
    </View>
  );
}

export function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  const c = useThemeColors();
  return (
    <View style={{ flex: 1, gap: 2 }}>
      <Text style={[hubText.caption, { color: c.text300 }]}>{label}</Text>
      <Text style={[s.statValue, { color: c.text100 }]}>{value}</Text>
      {hint ? <Text style={[hubText.small, { color: c.text300 }]}>{hint}</Text> : null}
    </View>
  );
}

/** Loading state: a skeleton shaped like a page, so content doesn't jump when it arrives. */
export function Loading({ rows = 3 }: { rows?: number }) {
  return <SkeletonPage rows={rows} />;
}

export function ErrorBox({ message, onRetry }: { message: string; onRetry?: () => void }) {
  const c = useThemeColors();
  return (
    <View accessibilityRole="alert" style={[s.card, { backgroundColor: c.dangerBg, gap: 10, marginTop: 16 }]}>
      <Text style={[hubText.body, { color: c.danger }]}>{message}</Text>
      {onRetry ? <Button label={tx('ხელახლა ცდა', 'Try again')} kind="secondary" onPress={onRetry} /> : null}
    </View>
  );
}

export function EmptyNote({
  title,
  body,
  icon: Icon,
  art,
}: {
  title: string;
  body?: string;
  icon?: LucideIcon;
  /** 3D artwork shown at 110px instead of the icon tile. */
  art?: ImageSourcePropType;
}) {
  const c = useThemeColors();
  return (
    <View style={{ alignItems: 'center', gap: 8, paddingVertical: 18, paddingHorizontal: 10 }}>
      {art ? (
        <Image
          source={art}
          resizeMode="contain"
          accessible={false}
          accessibilityIgnoresInvertColors
          style={{ width: 110, height: 110 }}
        />
      ) : Icon ? (
        <IconTile icon={Icon} ink="neutral" />
      ) : null}
      <Text style={[hubText.cardTitle, { color: c.text100, textAlign: 'center' }]}>{title}</Text>
      {body ? <Text style={[hubText.body, { color: c.text200, textAlign: 'center' }]}>{body}</Text> : null}
    </View>
  );
}

export function Screen({ children, bottom = 32, refreshControl }: { children: React.ReactNode; bottom?: number; refreshControl?: React.ReactElement<any> }) {
  const insets = useSafeAreaInsets();
  return (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      refreshControl={refreshControl}
      contentContainerStyle={{ paddingHorizontal: HUB.gutter, paddingBottom: insets.bottom + bottom }}
    >
      {children}
    </ScrollView>
  );
}

/** Private image served by /api/trainer (owner, or trainer with the photos scope). */
/**
 * Auth-protected image. Native sends the bearer header with the request; web fetches a blob.
 * A failed load is retried once (flaky mobile network), then `onFail` lets the caller show a fallback.
 */
export function PrivateImage({ path, style, label, onFail }: { path: string; style: any; label?: string; onFail?: () => void }) {
  const c = useThemeColors();
  const [source, setSource] = useState<{ uri: string; headers: { Authorization: string } } | null>(null);
  const [attempt, setAttempt] = useState(0);
  const owner = localAccountId();
  useEffect(() => setAttempt(0), [path]);
  useEffect(() => {
    let alive = true;
    let objectUrl: string | null = null;
    setSource(null);
    const url = `${API_BASE_URL}${path}${attempt ? `${path.includes('?') ? '&' : '?'}r=${attempt}` : ''}`;
    void getToken().then(async (token) => {
      if (!alive || !token || localAccountId() !== owner) return;
      if (Platform.OS !== 'web') {
        // Downloaded with the header into the cache: Android's <Image> drops request headers (401).
        try {
          const file = await cachedAuthImage(url, token, owner ?? '');
          if (alive) setSource({ uri: file, headers: { Authorization: '' } });
        } catch (error) {
          if (!alive) return;
          if (__DEV__) console.warn('[PrivateImage]', error instanceof AuthImageError ? error.status : String(error), path);
          if (error instanceof AuthImageError && (error.status === 404 || error.status === 403)) onFail?.();
          else failed();
        }
        return;
      }
      // react-native-web's <Image> cannot send headers: fetch with auth and show a blob URL.
      try {
        const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
        if (!alive) return;
        if (!res.ok) {
          if (__DEV__) console.warn('[PrivateImage]', res.status, path);
          return void (res.status === 404 ? onFail?.() : failed());
        }
        objectUrl = URL.createObjectURL(await res.blob());
        if (alive) setSource({ uri: objectUrl, headers: { Authorization: '' } });
      } catch {
        if (alive) failed();
      }
    });
    return () => {
      alive = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, owner, attempt]);
  function failed(event?: { nativeEvent?: { error?: unknown } }) {
    if (__DEV__) console.warn('[PrivateImage] load failed', path, String(event?.nativeEvent?.error ?? ''));
    if (attempt < 1) setTimeout(() => setAttempt((n) => n + 1), 1200);
    else onFail?.();
  }
  if (!source) return <View style={[style, { backgroundColor: c.bg200 }]} />;
  return <Image accessibilityLabel={label} source={source} onError={failed} style={[style, { backgroundColor: c.bg200 }]} resizeMode="cover" />;
}

export const coachStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  divider: { height: StyleSheet.hairlineWidth, marginVertical: 12 },
  input: { minHeight: 50, borderRadius: 14, paddingHorizontal: 14, fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 15 },
  label: { fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 13, lineHeight: 18, marginBottom: 6 },
  title: { fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 26, lineHeight: 34 },
});

const s = StyleSheet.create({
  headerRow: { flexDirection: 'row', alignItems: 'center', minHeight: 56, paddingHorizontal: 16, gap: 12 },
  backBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 18, lineHeight: 24 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: HUB.headingGap },
  card: { borderRadius: HUB.cardRadius, padding: HUB.cardPad },
  button: { minHeight: 52, borderRadius: 16, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
  buttonText: { fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 15 },
  chip: { minHeight: 38, borderRadius: 19, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  badge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2, alignSelf: 'flex-start' },
  verified: { position: 'absolute', right: -3, bottom: -3, borderRadius: 12, padding: 1 },
  statValue: { fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 20, lineHeight: 27 },
});

/** Keyboard-safe form page: the shared sign-in behaviour (see KeyboardFormShell). */
export function CoachForm({ title, subtitle, children, footer, fallback }: { title: string; subtitle?: string; children: React.ReactNode; footer: React.ReactNode; fallback?: string }) {
  const c = useThemeColors();
  return (
    <KeyboardFormShell background={c.bg100} header={<CoachHeader title={title} subtitle={subtitle} fallback={fallback} />} contentStyle={{ paddingHorizontal: HUB.gutter }} footer={footer}>
      {children}
    </KeyboardFormShell>
  );
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  const c = useThemeColors();
  return (
    <View style={{ marginTop: 16 }}>
      <Text style={[coachStyles.label, { color: c.text100 }]}>{label}</Text>
      {children}
      {hint ? <Text style={[hubText.small, { color: c.text300, marginTop: 4 }]}>{hint}</Text> : null}
    </View>
  );
}

/** Text field. `inset` = placed on a card (bg200 fill so the field stays visible). */
export function Input({ inset, ...props }: React.ComponentProps<typeof TextInput> & { inset?: boolean }) {
  const c = useThemeColors();
  return <TextInput placeholderTextColor={c.text300} {...props} style={[coachStyles.input, { backgroundColor: inset ? c.bg200 : c.surface, color: c.text100 }, props.multiline ? { minHeight: 96, paddingTop: 12, textAlignVertical: 'top' } : null, props.style]} />;
}

export function Toggle({ title, body, value, onChange, disabled }: { title: string; body?: string; value: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  const c = useThemeColors();
  return (
    <View style={[coachStyles.row, { paddingVertical: 10 }]}>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={[hubText.cardTitle, { color: c.text100 }]}>{title}</Text>
        {body ? <Text style={[hubText.caption, { color: c.text300 }]}>{body}</Text> : null}
      </View>
      <Switch accessibilityLabel={title} value={value} disabled={disabled} onValueChange={onChange} trackColor={{ true: CTA, false: c.bg300 }} thumbColor="#FFFFFF" />
    </View>
  );
}
