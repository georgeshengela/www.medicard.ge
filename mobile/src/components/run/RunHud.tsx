import React from 'react';
import { Pressable, Text, View } from 'react-native';
import Animated, { FadeInDown, FadeInUp, FadeOutUp } from 'react-native-reanimated';
import { Flag, Flame, Footprints, Gauge, Locate, MapPin, Maximize2, Pause, Play, Route, Satellite } from 'lucide-react-native';
import { ka } from '@/i18n/ka';
import { formatClock, formatDistanceShort, formatKm, formatPace, formatThousands } from '@/lib/run/geo';
import { useIsDark, useThemeColors } from '@/theme/colors';

export function useHudPalette() {
  const colors = useThemeColors();
  const dark = useIsDark();
  return {
    dark,
    colors,
    glass: dark ? 'rgba(17,24,39,0.88)' : 'rgba(255,255,255,0.94)',
    glassBorder: dark ? 'rgba(255,255,255,0.08)' : 'rgba(15,26,28,0.08)',
    chip: dark ? 'rgba(31,41,55,0.9)' : 'rgba(255,255,255,0.92)',
    accent: dark ? '#5EEAD4' : colors.primary100,
    brand: '#14B8A6',
    ctaBg: dark ? '#0D9488' : colors.primary200,
    amber: dark ? '#FBBF24' : '#D97706',
  };
}

// ---------------------------------------------------------------------------
// Round icon button
// ---------------------------------------------------------------------------

export function HudRoundButton({
  icon: Icon,
  onPress,
  label,
  size = 46,
  tone = 'glass',
}: {
  icon: React.ComponentType<{ size: number; color: string; strokeWidth: number }>;
  onPress: () => void;
  label: string;
  size?: number;
  tone?: 'glass' | 'brand' | 'danger';
}) {
  const p = useHudPalette();
  const bg = tone === 'brand' ? p.ctaBg : tone === 'danger' ? (p.dark ? '#4C0519' : '#FBEAEC') : p.glass;
  const fg = tone === 'brand' ? '#FFFFFF' : tone === 'danger' ? (p.dark ? '#FDA4AF' : '#C62B3F') : p.colors.text100;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={6}
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: bg,
        borderWidth: 1,
        borderColor: p.glassBorder,
      }}
    >
      <Icon size={Math.round(size * 0.42)} color={fg} strokeWidth={2.3} />
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// Top chips
// ---------------------------------------------------------------------------

export function HudChip({
  icon: Icon,
  label,
  tint,
}: {
  icon: React.ComponentType<{ size: number; color: string; strokeWidth: number }>;
  label: string;
  tint?: string;
}) {
  const p = useHudPalette();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 11,
        paddingVertical: 7,
        borderRadius: 999,
        backgroundColor: p.chip,
        borderWidth: 1,
        borderColor: p.glassBorder,
      }}
    >
      <Icon size={13} color={tint ?? p.accent} strokeWidth={2.4} />
      <Text style={{ fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 12, color: p.colors.text100 }}>{label}</Text>
    </View>
  );
}

export function GpsChip({ accuracyM }: { accuracyM: number | null }) {
  const p = useHudPalette();
  const weak = accuracyM != null && accuracyM > 30;
  const bars = accuracyM == null ? 0 : accuracyM <= 8 ? 4 : accuracyM <= 15 ? 3 : accuracyM <= 30 ? 2 : 1;
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 10,
        paddingVertical: 7,
        borderRadius: 999,
        backgroundColor: p.chip,
        borderWidth: 1,
        borderColor: p.glassBorder,
      }}
    >
      <Satellite size={13} color={weak ? p.amber : p.accent} strokeWidth={2.4} />
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 2 }}>
        {[0, 1, 2, 3].map((i) => (
          <View
            key={i}
            style={{
              width: 3,
              height: 5 + i * 3,
              borderRadius: 1,
              backgroundColor: i < bars ? (weak ? p.amber : p.brand) : p.colors.bg300,
            }}
          />
        ))}
      </View>
      {weak ? (
        <Text style={{ fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 11, color: p.amber }}>{ka.run.gpsWeak}</Text>
      ) : null}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Stats panel
// ---------------------------------------------------------------------------

function Stat({
  icon: Icon,
  value,
  unit,
  label,
}: {
  icon: React.ComponentType<{ size: number; color: string; strokeWidth: number }>;
  value: string;
  unit?: string;
  label: string;
}) {
  const p = useHudPalette();
  return (
    <View style={{ flex: 1, alignItems: 'center', gap: 2 }}>
      <Icon size={14} color={p.accent} strokeWidth={2.3} />
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 2 }}>
        <Text
          numberOfLines={1}
          adjustsFontSizeToFit
          style={{ fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 19, lineHeight: 24, color: p.colors.text100, letterSpacing: -0.4 }}
        >
          {value}
        </Text>
        {unit ? (
          <Text style={{ fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 10.5, color: p.colors.text300 }}>{unit}</Text>
        ) : null}
      </View>
      <Text numberOfLines={1} style={{ fontFamily: 'NotoSansGeorgian_500Medium', fontSize: 10.5, color: p.colors.text300 }}>
        {label}
      </Text>
    </View>
  );
}

export function RunStatsPanel({
  elapsedMs,
  distanceM,
  paceSecPerKm,
  calories,
  steps,
  progress,
  toPinM,
  reachedPin,
  paused,
  targetLabel,
  speedKmh,
  speedWarning,
}: {
  elapsedMs: number;
  distanceM: number;
  paceSecPerKm: number | null;
  calories: number;
  steps: number;
  progress: number;
  toPinM: number | null;
  reachedPin: boolean;
  paused: boolean;
  targetLabel: string;
  speedKmh: number;
  speedWarning: boolean;
}) {
  const p = useHudPalette();
  return (
    <Animated.View
      entering={FadeInDown.duration(420)}
      style={{
        backgroundColor: p.glass,
        borderRadius: 28,
        borderWidth: 1,
        borderColor: p.glassBorder,
        paddingHorizontal: 18,
        paddingTop: 14,
        paddingBottom: 16,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: paused ? p.amber : p.brand }} />
          <Text style={{ fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 11.5, letterSpacing: 0.6, color: p.colors.text300 }}>
            {(paused ? ka.run.pause : ka.run.time).toUpperCase()}
          </Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
          <MapPin size={12} color={reachedPin ? (p.dark ? '#34D399' : '#059669') : p.amber} strokeWidth={2.5} />
          <Text style={{ fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 12, color: p.colors.text100 }}>
            {reachedPin ? ka.run.pinReached.replace(' 🎯', '') : toPinM != null ? `${ka.run.toPin} ${formatDistanceShort(toPinM)}` : '—'}
          </Text>
        </View>
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12 }}>
        <Text
          numberOfLines={1}
          style={{
            marginTop: 2,
            fontFamily: 'NotoSansGeorgian_700Bold',
            fontSize: 46,
            lineHeight: 52,
            letterSpacing: -1.5,
            color: p.colors.text100,
            fontVariant: ['tabular-nums'],
          }}
        >
          {formatClock(elapsedMs)}
        </Text>
        <View style={{ alignItems: 'flex-end', paddingBottom: 6 }}>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4 }}>
            <Text
              style={{
                fontFamily: 'NotoSansGeorgian_700Bold',
                fontSize: 24,
                lineHeight: 28,
                letterSpacing: -0.6,
                color: speedWarning ? p.amber : p.colors.text100,
                fontVariant: ['tabular-nums'],
              }}
            >
              {speedKmh.toFixed(1)}
            </Text>
            <Text style={{ fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 11, color: speedWarning ? p.amber : p.colors.text300 }}>
              {ka.run.kmh}
            </Text>
          </View>
          <Text style={{ fontFamily: 'NotoSansGeorgian_500Medium', fontSize: 10.5, color: speedWarning ? p.amber : p.colors.text300 }}>
            {ka.run.speed}
          </Text>
        </View>
      </View>

      {/* progress to target */}
      <View style={{ marginTop: 6 }}>
        <View style={{ height: 6, borderRadius: 3, backgroundColor: p.dark ? '#1F2937' : p.colors.bg300, overflow: 'hidden' }}>
          <View
            style={{
              width: `${Math.max(2, Math.round(progress * 100))}%`,
              height: '100%',
              borderRadius: 3,
              backgroundColor: progress >= 1 ? (p.dark ? '#34D399' : '#059669') : p.brand,
            }}
          />
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 5 }}>
          <Text style={{ fontFamily: 'NotoSansGeorgian_500Medium', fontSize: 10.5, color: p.colors.text300 }}>
            {Math.round(progress * 100)}%
          </Text>
          <Text style={{ fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 10.5, color: p.colors.text300 }}>{targetLabel}</Text>
        </View>
      </View>

      <View style={{ height: 1, backgroundColor: p.glassBorder, marginVertical: 12 }} />

      <View style={{ flexDirection: 'row', gap: 4 }}>
        <Stat icon={Route} value={formatKm(distanceM)} unit={ka.run.km} label={ka.run.distance} />
        <Stat icon={Gauge} value={formatPace(paceSecPerKm)} label={ka.run.pace} />
        <Stat icon={Flame} value={String(Math.round(calories))} unit={ka.run.kcal} label={ka.run.calories} />
        <Stat icon={Footprints} value={formatThousands(steps)} label={ka.run.stepsLabel} />
      </View>
    </Animated.View>
  );
}

// ---------------------------------------------------------------------------
// Controls row
// ---------------------------------------------------------------------------

export function RunControls({
  running,
  following,
  onToggle,
  onFinish,
  onRecenter,
  onOverview,
}: {
  running: boolean;
  following: boolean;
  onToggle: () => void;
  onFinish: () => void;
  onRecenter: () => void;
  onOverview: () => void;
}) {
  const p = useHudPalette();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 14 }}>
      <HudRoundButton icon={following ? Maximize2 : Locate} label={following ? ka.run.overview : ka.run.recenter} onPress={following ? onOverview : onRecenter} size={50} />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={running ? ka.run.pause : ka.run.resume}
        onPress={onToggle}
        style={{
          width: 76,
          height: 76,
          borderRadius: 38,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: running ? p.ctaBg : '#F59E0B',
          borderWidth: 5,
          borderColor: running ? 'rgba(20,184,166,0.28)' : 'rgba(245,158,11,0.3)',
        }}
      >
        {running ? <Pause size={28} color="#FFFFFF" strokeWidth={2.6} /> : <Play size={28} color="#FFFFFF" strokeWidth={2.6} style={{ marginLeft: 3 }} />}
      </Pressable>
      <HudRoundButton icon={Flag} label={ka.run.finish} onPress={onFinish} size={50} tone="danger" />
    </View>
  );
}

// ---------------------------------------------------------------------------
// Toast banner (pin reached / target done)
// ---------------------------------------------------------------------------

export function RunBanner({ title, body, tone }: { title: string; body: string; tone: 'pin' | 'target' | 'warn' }) {
  const p = useHudPalette();
  const bg = tone === 'warn' ? (p.dark ? '#451A03' : '#FEF3C7') : tone === 'pin' ? (p.dark ? '#064E3B' : '#D1FAE5') : (p.dark ? '#0F766E' : '#CCFBF1');
  const fg = tone === 'warn' ? (p.dark ? '#FCD34D' : '#92400E') : tone === 'pin' ? (p.dark ? '#A7F3D0' : '#065F46') : (p.dark ? '#CCFBF1' : '#0F766E');
  return (
    <Animated.View
      entering={FadeInUp.duration(360)}
      exiting={FadeOutUp.duration(300)}
      style={{
        alignSelf: 'center',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderRadius: 20,
        backgroundColor: bg,
        borderWidth: 1,
        borderColor: p.glassBorder,
        maxWidth: '92%',
      }}
    >
      {tone === 'warn' ? <Gauge size={18} color={fg} strokeWidth={2.4} /> : <MapPin size={18} color={fg} strokeWidth={2.4} />}
      <View style={{ flexShrink: 1 }}>
        <Text style={{ fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 14, color: fg }}>{title}</Text>
        <Text style={{ fontFamily: 'NotoSansGeorgian_500Medium', fontSize: 12, color: fg, opacity: 0.9 }}>{body}</Text>
      </View>
    </Animated.View>
  );
}
