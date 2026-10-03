/**
 * Shared pieces of the four cycle settings screens (W2-9): the cycle view through the shared cache,
 * the profile → form mapping, and the rows every screen uses (switch, stepper, check row, the
 * lock-screen example, the status line). Moved here from the former one-page `/cycle/settings`.
 */
import { CyclePressable as Pressable } from '@/components/cycle/CyclePressable';
import React from 'react';
import { Switch, Text, View } from 'react-native';
import { Check, type LucideIcon } from 'lucide-react-native';
import { ka } from '@/i18n/ka';
import { tx } from '@/i18n/locale';
import type { CycleBundle, CycleCondition, CycleContraceptionMethod } from '@/lib/api';
import { normalizeIsoDate } from '@/lib/birthdate';
import { useCycleView } from '@/lib/cycleViewCache';
import type { CycleReminderPrefs } from '@/lib/cycleReminderPrefs';
import { cycleReminderPreview, type CycleReminderPreviewType } from '@/lib/cycleReminders';
import { useAuth } from '@/store/AuthContext';
import { useCycleColors } from '@/theme/cycle';

export type CycleColors = ReturnType<typeof useCycleColors>;

/** The cycle view from the shared cache (`['cycle','view']`) — the same data Home and /cycle read. */
export function useCycleSettingsView() {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const query = useCycleView(userId);
  const view = query.data;
  return {
    userId,
    view,
    /** What the screens show (offline queue applied). */
    bundle: view?.display ?? null,
    /** The server's copy (exports use it). */
    canonical: view?.canonical ?? null,
    pendingCount: view?.pendingCount ?? 0,
    /** True while nothing is cached yet and the first read is running. */
    loading: !view && Boolean(userId) && query.fetchStatus !== 'idle',
    /** True once the cached answer is not being refreshed (safe to fill a form from it). */
    settled: Boolean(view) && query.fetchStatus === 'idle',
    error: query.error,
    refetch: query.refetch,
  };
}

/** Profile fields of a bundle in form shape. Missing fields on older servers = the defaults. */
export function applyCycleProfile(data: CycleBundle | null | undefined) {
  const profile = data?.profile ?? ({} as CycleBundle['profile']);
  return {
    mode: profile.mode ?? 'TRACK_PERIOD',
    avgCycle: String(profile.avgCycleLength ?? 28),
    avgPeriod: String(profile.avgPeriodLength ?? 5),
    lastPeriod: normalizeIsoDate(profile.lastPeriodStart),
    dueDate: normalizeIsoDate(data?.pregnancy?.dueDate ?? profile.dueDate),
    referenceDate: normalizeIsoDate(data?.pregnancy?.referenceDate),
    irregular: Boolean(profile.isIrregular),
    privacy: Boolean(profile.privacyEnabled),
    conditions: (profile.conditions ?? []) as CycleCondition[],
    contraceptionMethod: (profile.contraceptionMethod ?? null) as CycleContraceptionMethod | null,
    contraceptionStartedAt: normalizeIsoDate(profile.contraceptionStartedAt),
    postpartumReference: normalizeIsoDate(data?.postpartum?.referenceDate),
    // Brief §9 wave 2 item 17 — missing on older servers = the defaults.
    expectsBleeding: profile.expectsBleeding !== false,
    fertilityDisplay: (profile.fertilityDisplay === 'off' ? 'off' : 'auto') as 'auto' | 'off',
  };
}

/** The reminder fields the server keeps (mask and late-period stay on the device). */
export function serverReminderPrefs(prefs: CycleReminderPrefs) {
  return {
    enabled: prefs.enabled,
    periodDaysBefore: prefs.periodDaysBefore,
    ovulation: prefs.ovulation,
    dailyLog: prefs.dailyLog,
    pms: prefs.pms,
    opk: prefs.opk,
    bbt: prefs.bbt,
  };
}

export function SettingsDivider({ c, gap = 12 }: { c: CycleColors; gap?: number }) {
  return <View style={{ height: 1, backgroundColor: c.border, marginVertical: gap }} />;
}

/** One status line (saved / error) — calm, inside the page, never a native alert. */
export function SettingsNotice({ c, tone, text }: { c: CycleColors; tone: 'success' | 'error'; text: string | null }) {
  if (!text) return null;
  return (
    <View
      accessibilityLiveRegion="polite"
      style={{
        marginBottom: 12,
        borderRadius: 14,
        paddingHorizontal: 14,
        paddingVertical: 12,
        backgroundColor: tone === 'error' ? `${c.danger}14` : `${c.success}18`,
      }}
    >
      <Text
        style={{
          color: tone === 'error' ? c.danger : c.success,
          fontFamily: 'NotoSansGeorgian_700Bold',
          fontSize: 13,
          lineHeight: 18,
          textAlign: 'center',
        }}
      >
        {text}
      </Text>
    </View>
  );
}

export function SettingsStepper({
  label,
  value,
  min,
  max,
  onChange,
  c,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (n: number) => void;
  c: CycleColors;
}) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
      <Text style={{ color: c.ink, fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 14, flex: 1, paddingRight: 8 }}>{label}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <Pressable
          onPress={() => onChange(Math.max(min, value - 1))}
          accessibilityRole="button"
          accessibilityLabel={tx(`${label} — შემცირება`, `${label} — decrease`)}
          disabled={value <= min}
          style={{
            width: 44,
            height: 44,
            borderRadius: 14,
            backgroundColor: c.cardSoft,
            alignItems: 'center',
            justifyContent: 'center',
            opacity: value <= min ? 0.5 : 1,
          }}
        >
          <Text style={{ color: c.brand, fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 18 }}>−</Text>
        </Pressable>
        <Text
          style={{
            color: c.ink,
            fontFamily: 'NotoSansGeorgian_700Bold',
            fontSize: 20,
            minWidth: 28,
            textAlign: 'center',
          }}
        >
          {value}
        </Text>
        <Pressable
          onPress={() => onChange(Math.min(max, value + 1))}
          accessibilityRole="button"
          accessibilityLabel={tx(`${label} — გაზრდა`, `${label} — increase`)}
          disabled={value >= max}
          style={{
            width: 44,
            height: 44,
            borderRadius: 14,
            backgroundColor: c.cardSoft,
            alignItems: 'center',
            justifyContent: 'center',
            opacity: value >= max ? 0.5 : 1,
          }}
        >
          <Text style={{ color: c.brand, fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 18 }}>+</Text>
        </Pressable>
      </View>
    </View>
  );
}

export function SettingsRowSwitch({
  icon: Icon,
  label,
  hint,
  value,
  onChange,
  disabled = false,
  c,
}: {
  icon: LucideIcon;
  label: string;
  hint?: string;
  value: boolean;
  /** Omitted = an always-on row: the switch is shown on and disabled. */
  onChange?: (v: boolean) => void;
  /** Forced by another setting: the switch shows the value but cannot change it (the hint says why). */
  disabled?: boolean;
  c: CycleColors;
}) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        minHeight: 48,
        paddingVertical: 6,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', flex: 1, minWidth: 0, paddingRight: 12 }}>
        <Icon size={18} color={c.brand} strokeWidth={2.1} style={{ marginTop: 2 }} />
        <View style={{ marginLeft: 10, flex: 1, flexShrink: 1 }}>
          <Text style={{ color: c.ink, fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 14, lineHeight: 20 }}>{label}</Text>
          {hint ? (
            <Text style={{ color: c.muted, fontSize: 12, lineHeight: 16, marginTop: 2 }}>{hint}</Text>
          ) : null}
        </View>
      </View>
      {onChange ? (
        <Switch
          value={value}
          accessibilityLabel={label}
          accessibilityHint={disabled ? hint : undefined}
          accessibilityState={{ disabled }}
          disabled={disabled}
          onValueChange={onChange}
          trackColor={{ true: c.cta, false: c.controlBorder }}
          thumbColor={c.onPrimary}
        />
      ) : (
        <View
          accessibilityLabel={`${label} — ${tx('ყოველთვის ჩართული', 'always on')}`}
          style={{
            width: 28,
            height: 28,
            borderRadius: 14,
            backgroundColor: c.cta,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Check size={16} color={c.onPrimary} strokeWidth={3} />
        </View>
      )}
    </View>
  );
}

/**
 * A full-width choice row with a check box (multi-select lists such as conditions). Long names wrap
 * inside the card instead of running past its edge as a pill did (PCOS).
 */
export function SettingsCheckRow({
  label,
  selected,
  onPress,
  c,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  c: CycleColors;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={label}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        minHeight: 48,
        paddingVertical: 10,
        paddingHorizontal: 12,
        borderRadius: 16,
        backgroundColor: selected ? c.accentSoft : c.cardSoft,
      }}
    >
      <View
        style={{
          width: 24,
          height: 24,
          borderRadius: 8,
          borderWidth: selected ? 0 : 1.5,
          borderColor: c.controlBorder,
          backgroundColor: selected ? c.cta : 'transparent',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {selected ? <Check size={15} color={c.onPrimary} strokeWidth={3} /> : null}
      </View>
      <Text
        style={{
          color: c.ink,
          fontFamily: selected ? 'NotoSansGeorgian_700Bold' : 'NotoSansGeorgian_500Medium',
          fontSize: 14,
          lineHeight: 20,
          marginLeft: 12,
          flex: 1,
          flexShrink: 1,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

/**
 * The exact lock-screen text of one reminder (unmasked), shown under its switch so the person sees what
 * would appear before turning it on (brief §9 item 5). Same copy path as the scheduler.
 */
export function ReminderExample({
  type,
  periodDaysBefore,
  c,
}: {
  type: CycleReminderPreviewType;
  periodDaysBefore?: number;
  c: CycleColors;
}) {
  const copy = cycleReminderPreview(type, { periodDaysBefore });
  return (
    <View
      style={{
        marginTop: 4,
        marginLeft: 28,
        borderRadius: 14,
        backgroundColor: c.cardSoft,
        paddingHorizontal: 12,
        paddingVertical: 9,
      }}
      accessibilityLabel={`${ka.cycle.remindersLockText} ${copy.title}. ${copy.body}`}
    >
      <Text style={{ color: c.mutedSoft, fontSize: 10.5, fontFamily: 'NotoSansGeorgian_700Bold', letterSpacing: 0.3 }}>
        {ka.cycle.remindersLockText}
      </Text>
      <Text style={{ color: c.ink, fontSize: 12.5, fontFamily: 'NotoSansGeorgian_700Bold', marginTop: 3, lineHeight: 17 }}>
        {copy.title}
      </Text>
      <Text style={{ color: c.muted, fontSize: 12, lineHeight: 16, marginTop: 2 }} numberOfLines={4}>
        {copy.body}
      </Text>
    </View>
  );
}

/** A pill choice (single-select lists with short names: contraception, mask style). Wraps its text. */
export function SettingsPill({
  label,
  selected,
  onPress,
  c,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  c: CycleColors;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
      style={{
        maxWidth: '100%',
        paddingHorizontal: 14,
        paddingVertical: 10,
        minHeight: 40,
        justifyContent: 'center',
        borderRadius: 999,
        backgroundColor: selected ? c.cta : c.creamDeep,
      }}
    >
      <Text
        style={{
          color: selected ? c.onPrimary : c.ink,
          fontFamily: 'NotoSansGeorgian_700Bold',
          fontSize: 13,
          lineHeight: 18,
          flexShrink: 1,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}
