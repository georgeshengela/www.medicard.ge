import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type TextProps,
  type ViewProps,
  type ViewStyle,
} from "react-native";
import { Stack, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { useAnimatedStyle, withTiming } from "react-native-reanimated";
import { AlertCircle, Check, ChevronLeft, ChevronRight, Minus, Plus, type LucideIcon } from "lucide-react-native";
import { ModuleHeader, ModuleStackHeader } from "@/components/brand/ModuleHeader";
import { KeyboardFormShell } from "@/components/ui/KeyboardFormShell";
import { APP_MODAL_OVERLAY, APP_MODAL_PROPS, Modal } from "@/components/ui/appModal";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";
import { ModuleToneProvider, useIsDark, useThemeColors } from "@/theme/colors";
import { HUB, hubText, hubTint } from "@/theme/hub";
import { moduleInk } from "@/theme/moduleBrand";
import { useAccountQuery } from "@/hooks/useAccountQuery";
import { FRESH } from "@/lib/queryClient";
import { nutritionDateLabel, nutritionProgramApi, type NutritionDashboard } from "@/lib/nutritionProgram";
import { localDay, shiftDay } from "@/lib/nutrition";
import { tx } from "@/i18n/locale";

/**
 * MEDIFOOD's page kit (owner 2026-10-04, the MEDILAB polish): the standard module header, the hub
 * language — flat `surface` cards, titles outside, 20 px gutter — and the module's emerald on actions
 * and selection. Every MEDIFOOD route is wrapped in `withMedifood`, so the brand tokens
 * (`primary*`, `accent*`) speak emerald inside it, also under the women's rose.
 */
export function useMedifood() {
  const c = useThemeColors();
  const dark = useIsDark();
  const ink = moduleInk("food", dark);
  return {
    c,
    dark,
    ink,
    inkSoft: hubTint(ink, dark),
    /** Text and icons on a filled emerald button. */
    onInk: dark ? "#022C22" : "#FFFFFF",
  };
}

/** Wraps a MEDIFOOD route so every colour inside it follows the module tone. */
export function withMedifood<P extends object>(Screen: React.ComponentType<P>) {
  function MedifoodScreen(props: P) {
    return (
      <ModuleToneProvider tone="food">
        <Screen {...props} />
      </ModuleToneProvider>
    );
  }
  MedifoodScreen.displayName = `Medifood(${Screen.displayName || Screen.name || "Screen"})`;
  return MedifoodScreen;
}

export function NText({ style, ...props }: TextProps) {
  const c = useThemeColors();
  return (
    <Text
      {...props}
      style={[{ fontFamily: "NotoSansGeorgian_400Regular", fontSize: 14, lineHeight: 22, color: c.text100 }, style]}
    />
  );
}

/** Flat hub card: surface, radius 22, no border, no shadow. */
export function NCard({ style, ...props }: ViewProps) {
  const c = useThemeColors();
  return <View {...props} style={[{ backgroundColor: c.surface, borderRadius: HUB.cardRadius, padding: HUB.cardPad, gap: 12 }, style]} />;
}

/** Card title row: tinted icon tile · title (and one muted line) · optional right element. */
export function NCardTitle({ icon: Icon, title, detail, right, ink }: { icon?: LucideIcon; title: string; detail?: string; right?: React.ReactNode; ink?: string }) {
  const M = useMedifood();
  const color = ink ?? M.ink;
  return (
    <View style={s.row}>
      {Icon ? (
        <View style={[s.tile, { backgroundColor: hubTint(color, M.dark) }]}>
          <Icon size={20} color={color} strokeWidth={1.9} />
        </View>
      ) : null}
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={[hubText.cardTitle, { color: M.c.text100 }]}>{title}</Text>
        {detail ? <Text style={[hubText.caption, { color: M.c.text200 }]}>{detail}</Text> : null}
      </View>
      {right}
    </View>
  );
}

/**
 * The page's buttons. Primary = filled emerald; `secondary` = quiet `bg200`; `danger` = red text for
 * deleting (red stays for deleting only).
 */
export function NButton({
  label,
  onPress,
  secondary = false,
  danger = false,
  disabled = false,
  icon: Icon,
  style,
}: {
  label: string;
  onPress: () => void;
  secondary?: boolean;
  danger?: boolean;
  disabled?: boolean;
  icon?: LucideIcon;
  style?: StyleProp<ViewStyle>;
}) {
  const M = useMedifood();
  const filled = !secondary && !danger;
  const fg = filled ? M.onInk : danger ? M.c.danger : M.c.text100;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[
        {
          minHeight: 50,
          paddingVertical: 12,
          paddingHorizontal: 18,
          borderRadius: 16,
          backgroundColor: filled ? M.ink : danger ? M.c.dangerBg : M.c.bg200,
          opacity: disabled ? 0.45 : 1,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
        },
        style,
      ]}
    >
      {Icon ? <Icon size={18} color={fg} strokeWidth={2.2} /> : null}
      <Text numberOfLines={2} style={{ fontFamily: filled ? "NotoSansGeorgian_700Bold" : "NotoSansGeorgian_600SemiBold", fontSize: 15, lineHeight: 21, color: fg, textAlign: "center", flexShrink: 1 }}>
        {label}
      </Text>
    </Pressable>
  );
}

/**
 * Every MEDIFOOD page: the standard module header (back · MEDIFOOD + the page's name · one button),
 * then the content in the 20 px gutter. Without a footer the header scrolls away with the content
 * (MEDILAB); with a pinned action at the bottom the header stays pinned too and the page is the
 * keyboard-safe form (KeyboardFormShell — the sign-in behaviour).
 */
export function NScreen({
  title,
  children,
  footer,
  onBack,
  right,
  scrollRef,
  fallbackHref = "/nutrition",
}: {
  /** The page's name: the header's one line under the wordmark. */
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  onBack?: () => void;
  /** One `ModuleHeaderButton`. */
  right?: React.ReactNode;
  scrollRef?: React.MutableRefObject<ScrollView | null>;
  /** Where back leads without history (a cold start from a link or a notification). */
  fallbackHref?: string;
}) {
  const c = useThemeColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const back = onBack ?? (() => (router.canGoBack() ? router.back() : router.replace(fallbackHref as never)));
  const header = { module: "food" as const, subtitle: title, onBack: back, right };
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <KeyboardFormShell
        background={c.bg100}
        scrollRef={scrollRef}
        header={footer ? <ModuleStackHeader {...header} /> : undefined}
        contentStyle={{
          paddingTop: footer ? 4 : insets.top + 12,
          paddingHorizontal: HUB.gutter,
          gap: 20,
          width: "100%",
          maxWidth: 680,
          alignSelf: "center",
        }}
        footer={footer ? <View style={{ width: "100%", maxWidth: 640, alignSelf: "center", gap: 8 }}>{footer}</View> : undefined}
      >
        {footer ? null : <ModuleHeader {...header} />}
        {children}
      </KeyboardFormShell>
    </>
  );
}

/** A step or page heading inside the content: tinted icon tile, title, one quiet line. */
export function NHeading({ icon: Icon, title, body }: { icon: LucideIcon; title: string; body?: string }) {
  const M = useMedifood();
  return (
    <View style={{ gap: 10 }}>
      <View style={[s.tile, { backgroundColor: M.inkSoft }]}>
        <Icon size={21} color={M.ink} strokeWidth={1.9} />
      </View>
      <Text style={{ fontFamily: "NotoSansGeorgian_700Bold", fontSize: 22, lineHeight: 30, color: M.c.text100 }}>{title}</Text>
      {body ? <Text style={[hubText.body, { color: M.c.text200 }]}>{body}</Text> : null}
    </View>
  );
}

/** Small muted label above a group of fields or choices. */
export function NLabel({ children, right }: { children: string; right?: string }) {
  const c = useThemeColors();
  return (
    <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: 8, marginBottom: -4, marginHorizontal: 2 }}>
      <Text style={{ fontFamily: "NotoSansGeorgian_600SemiBold", fontSize: 13, lineHeight: 18, color: c.text200, flexShrink: 1 }}>{children}</Text>
      {right ? <Text style={{ fontFamily: "NotoSansGeorgian_400Regular", fontSize: 12, lineHeight: 18, color: c.text300 }}>{right}</Text> : null}
    </View>
  );
}

/** One-of list in a flat card: label (and a muted line) · radio. Rows are separated by hairlines. */
export function NChoiceList<T extends string>({
  value,
  onChange,
  options,
  disabled,
}: {
  value: T | "" | null | undefined;
  onChange: (next: T) => void;
  options: { value: T; label: string; detail?: string }[];
  disabled?: boolean;
}) {
  const M = useMedifood();
  return (
    <View accessibilityRole="radiogroup" style={{ backgroundColor: M.c.surface, borderRadius: HUB.cardRadius, paddingHorizontal: 16 }}>
      {options.map((option, index) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="radio"
            accessibilityState={{ checked: selected, disabled }}
            accessibilityLabel={option.detail ? `${option.label}. ${option.detail}` : option.label}
            disabled={disabled}
            onPress={() => onChange(option.value)}
            style={[s.choice, index > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: M.c.bg300 }]}
          >
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={[hubText.cardTitle, { color: M.c.text100, fontFamily: selected ? "NotoSansGeorgian_600SemiBold" : "NotoSansGeorgian_400Regular" }]}>{option.label}</Text>
              {option.detail ? <Text style={[hubText.caption, { color: M.c.text200 }]}>{option.detail}</Text> : null}
            </View>
            <View style={[s.radio, { borderColor: selected ? M.ink : M.c.bg300, backgroundColor: selected ? M.ink : "transparent" }]}>
              {selected ? <Check size={13} color={M.onInk} strokeWidth={3} /> : null}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

/** iOS segmented control in the module's emerald (MEDILAB's): the thumb slides to the choice. */
export function NSegment<T extends string>({
  value,
  onChange,
  options,
  disabled,
  style,
  on = "surface",
}: {
  value: T | "" | null | undefined;
  onChange: (next: T) => void;
  options: { value: T; label: string }[];
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  /** What the control sits on: the canvas (`surface` track) or a card (`bg200` track). */
  on?: "surface" | "card";
}) {
  const M = useMedifood();
  const reduceMotion = usePrefersReducedMotion();
  const [width, setWidth] = useState(0);
  const index = options.findIndex((option) => option.value === value);
  const segmentWidth = width ? (width - 6) / options.length : 0;
  const thumb = useAnimatedStyle(
    () => ({ transform: [{ translateX: reduceMotion ? index * segmentWidth : withTiming(index * segmentWidth, { duration: 220 }) }] }),
    [index, segmentWidth, reduceMotion],
  );
  return (
    <View
      accessibilityRole="radiogroup"
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
      style={[{ flexDirection: "row", borderRadius: 14, padding: 3, minHeight: 46, backgroundColor: on === "card" ? M.c.bg200 : M.c.surface }, style]}
    >
      {segmentWidth && index >= 0 ? (
        <Animated.View style={[{ position: "absolute", top: 3, bottom: 3, left: 3, borderRadius: 11, width: segmentWidth, backgroundColor: on === "card" ? M.c.surface : M.inkSoft }, thumb]} />
      ) : null}
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="radio"
            accessibilityState={{ checked: selected, disabled }}
            accessibilityLabel={option.label}
            disabled={disabled}
            onPress={() => onChange(option.value)}
            style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 4 }}
          >
            <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} style={{ fontFamily: "NotoSansGeorgian_600SemiBold", fontSize: 14, lineHeight: 20, color: selected ? M.ink : M.c.text200 }}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Wrapping chips; selected = filled emerald (MEDILAB's chips). `on="card"` for chips inside a card. */
export function NChip({ label, detail, selected, onPress, disabled, on = "surface", accessibilityLabel, style, lines = 1 }: {
  label: string;
  detail?: string;
  /** Lines for the label and the detail (wide chips may wrap to 2). */
  lines?: 1 | 2;
  selected: boolean;
  onPress: () => void;
  disabled?: boolean;
  on?: "surface" | "card";
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const M = useMedifood();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected, disabled }}
      accessibilityLabel={accessibilityLabel ?? (detail ? `${label}. ${detail}` : label)}
      disabled={disabled}
      onPress={onPress}
      style={[
        {
          minHeight: detail ? 54 : 38,
          paddingHorizontal: 14,
          paddingVertical: detail ? 8 : 0,
          borderRadius: detail ? 16 : 19,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: selected ? M.ink : on === "card" ? M.c.bg200 : M.c.surface,
          opacity: disabled && !selected ? 0.5 : 1,
        },
        style,
      ]}
    >
      <Text numberOfLines={lines} style={[hubText.link, { fontSize: 14, color: selected ? M.onInk : M.c.text100 }]}>{label}</Text>
      {detail ? <Text numberOfLines={lines} style={[hubText.small, { color: selected ? M.onInk : M.c.text300, opacity: selected ? 0.85 : 1 }]}>{detail}</Text> : null}
    </Pressable>
  );
}

/** Labelled text field. `on="card"` when it sits inside a surface card (then it fills with bg200). */
export function NField({ label, hint, on = "surface", style, ...input }: TextInputProps & { label?: string; hint?: string; on?: "surface" | "card" }) {
  const c = useThemeColors();
  return (
    <View style={{ gap: 6 }}>
      {label ? <Text style={{ fontFamily: "NotoSansGeorgian_600SemiBold", fontSize: 13, lineHeight: 18, color: c.text200, marginHorizontal: 2 }}>{label}</Text> : null}
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={c.text300}
        {...input}
        style={[
          {
            fontFamily: "NotoSansGeorgian_400Regular",
            color: c.text100,
            fontSize: 16,
            minHeight: 50,
            paddingHorizontal: 14,
            paddingVertical: 12,
            backgroundColor: on === "card" ? c.bg200 : c.surface,
            borderRadius: 14,
          },
          style,
        ]}
      />
      {hint ? <Text style={[hubText.caption, { color: c.text300, marginHorizontal: 2 }]}>{hint}</Text> : null}
    </View>
  );
}

/** − value + with round 44 pt buttons. */
export function NStepper({ value, onMinus, onPlus, minusDisabled, plusDisabled, minusLabel, plusLabel, width = 44 }: {
  value: string;
  onMinus: () => void;
  onPlus: () => void;
  minusDisabled?: boolean;
  plusDisabled?: boolean;
  minusLabel: string;
  plusLabel: string;
  width?: number;
}) {
  const c = useThemeColors();
  const button = (label: string, Icon: LucideIcon, onPress: () => void, off?: boolean) => (
    <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled: !!off }} disabled={off} onPress={onPress} style={[s.round, { backgroundColor: c.bg200, opacity: off ? 0.4 : 1 }]}>
      <Icon size={17} color={c.text100} strokeWidth={2.2} />
    </Pressable>
  );
  return (
    <View style={[s.row, { gap: 8 }]}>
      {button(minusLabel, Minus, onMinus, minusDisabled)}
      <Text accessibilityLiveRegion="polite" numberOfLines={1} style={[hubText.value, { color: c.text100, minWidth: width, textAlign: "center", fontSize: 17, fontVariant: ["tabular-nums"] }]}>{value}</Text>
      {button(plusLabel, Plus, onPlus, plusDisabled)}
    </View>
  );
}

/** Centered confirmation card (AGENTS „Mobile modals“). `danger` paints the confirm as a delete. */
export function NConfirm({
  visible,
  title,
  message,
  confirmLabel,
  cancelLabel = tx("გაუქმება", "Cancel"),
  danger,
  onConfirm,
  onClose,
}: {
  visible: boolean;
  title: string;
  message?: string;
  confirmLabel: string;
  cancelLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const c = useThemeColors();
  return (
    <Modal visible={visible} {...APP_MODAL_PROPS} onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: "center", padding: 24 }}>
        <Pressable accessibilityRole="button" accessibilityLabel={cancelLabel} onPress={onClose} style={[StyleSheet.absoluteFill, { backgroundColor: APP_MODAL_OVERLAY }]} />
        <View accessibilityViewIsModal style={{ backgroundColor: c.surface, borderRadius: 24, padding: 22, gap: 10, width: "100%", maxWidth: 420, alignSelf: "center" }}>
          <Text style={{ fontFamily: "NotoSansGeorgian_700Bold", fontSize: 18, lineHeight: 26, color: c.text100 }}>{title}</Text>
          {message ? <Text style={[hubText.body, { color: c.text200, fontSize: 14, lineHeight: 21 }]}>{message}</Text> : null}
          <View style={{ flexDirection: "row", gap: 10, marginTop: 8 }}>
            <NButton secondary label={cancelLabel} onPress={onClose} style={{ flex: 1 }} />
            <NButton danger={danger} label={confirmLabel} onPress={onConfirm} style={{ flex: 1 }} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

/**
 * The week strip (Cal AI / Yazio): the range with ‹ › for whole weeks, then seven day cells — the chosen
 * day filled emerald, today dotted, days with an entry marked by a small bar, days out of reach dimmed.
 * Shared by the diary and the meal plan so both read the same.
 */
export function NWeekStrip({
  from,
  selected,
  onSelect,
  onWeek,
  prevDisabled,
  nextDisabled,
  marked,
  isDisabled,
  disabled,
}: {
  /** First day of the seven shown (YYYY-MM-DD). */
  from: string;
  selected: string;
  onSelect: (day: string) => void;
  onWeek: (step: -7 | 7) => void;
  prevDisabled?: boolean;
  nextDisabled?: boolean;
  /** Days that have something recorded (a short bar under the number). */
  marked?: ReadonlySet<string>;
  /** A day that cannot be chosen (the diary's future). */
  isDisabled?: (day: string) => boolean;
  disabled?: boolean;
}) {
  const M = useMedifood();
  const today = localDay();
  const days = Array.from({ length: 7 }, (_, i) => shiftDay(from, i));
  const arrow = (step: -7 | 7, off?: boolean) => {
    const Icon = step < 0 ? ChevronLeft : ChevronRight;
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={step < 0 ? tx("წინა კვირა", "Previous week") : tx("შემდეგი კვირა", "Next week")}
        accessibilityState={{ disabled: !!(off || disabled) }}
        disabled={off || disabled}
        onPress={() => onWeek(step)}
        hitSlop={4}
        style={[s.weekArrow, { backgroundColor: M.c.bg200, opacity: off || disabled ? 0.35 : 1 }]}
      >
        <Icon size={18} color={M.c.text100} />
      </Pressable>
    );
  };
  return (
    <View style={{ backgroundColor: M.c.surface, borderRadius: HUB.cardRadius, padding: 6, gap: 2 }}>
      <View style={[s.row, { gap: 8 }]}>
        {arrow(-7, prevDisabled)}
        <Text numberOfLines={1} style={[hubText.link, { flex: 1, textAlign: "center", color: M.c.text100 }]}>
          {nutritionDateLabel(days[0])} — {nutritionDateLabel(days[6])}
        </Text>
        {arrow(7, nextDisabled)}
      </View>
      <View style={{ flexDirection: "row", gap: 2 }}>
        {days.map((day) => {
          const chosen = day === selected;
          const off = !!isDisabled?.(day);
          const mark = marked?.has(day);
          return (
            <Pressable
              key={day}
              accessibilityRole="button"
              accessibilityState={{ selected: chosen, disabled: off || !!disabled }}
              accessibilityLabel={`${day === today ? tx("დღეს, ", "Today, ") : ""}${nutritionDateLabel(day)}${mark ? tx(", ჩანაწერი აქვს", ", has entries") : ""}`}
              disabled={off || disabled}
              onPress={() => onSelect(day)}
              style={[s.weekDay, { backgroundColor: chosen ? M.ink : "transparent", opacity: off ? 0.35 : 1 }]}
            >
              <Text numberOfLines={1} style={[hubText.small, { color: chosen ? M.onInk : M.c.text300 }]}>{nutritionDateLabel(day, true)}</Text>
              <Text style={[hubText.value, { fontSize: 17, lineHeight: 23, color: chosen ? M.onInk : M.c.text100, fontVariant: ["tabular-nums"] }]}>{Number(day.slice(8))}</Text>
              <View style={{ flexDirection: "row", gap: 3, height: 4, alignItems: "center" }}>
                {day === today ? <View style={[s.dot, { backgroundColor: chosen ? M.onInk : M.ink }]} /> : null}
                {mark ? <View style={[s.bar, { backgroundColor: chosen ? M.onInk : M.ink, opacity: chosen ? 0.7 : 0.45 }]} /> : null}
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

/** A calm one-line result under an action (saved, logged…). */
export function NNotice({ children, tone = "success" }: { children: string; tone?: "success" | "muted" }) {
  const c = useThemeColors();
  return (
    <View accessibilityLiveRegion="polite" style={[s.row, { gap: 8, paddingHorizontal: 4 }]}>
      {tone === "success" ? <Check size={16} color={c.success} strokeWidth={2.6} /> : null}
      <Text style={[hubText.body, { color: tone === "success" ? c.success : c.text200, flex: 1 }]}>{children}</Text>
    </View>
  );
}

/** Cached app-wide (Home card, hub, plan, goal, progress, weight share one answer); meal writes invalidate it. */
export function useNutritionDashboard(opts: { enabled?: boolean } = {}) {
  const query = useAccountQuery<NutritionDashboard>({
    key: ["nutrition", "dashboard"],
    fetch: () => nutritionProgramApi.dashboard(),
    staleTime: FRESH.SHORT,
    // Home layouts that do not show nutrition keep the observer quiet (no fetch, no focus refetch).
    enabled: opts.enabled ?? true,
  });
  const { refetch } = query;
  const load = useCallback(async () => {
    await refetch();
  }, [refetch]);
  return {
    data: query.data ?? null,
    // A failed background refresh keeps the last numbers on screen; the error shows only with nothing to show.
    error: !query.data && query.error ? (query.error as Error).message : "",
    loading: query.isPending && query.fetchStatus !== "idle",
    load,
  };
}

/** What went wrong and, when it helps, one way to try again. */
export function NError({ message, retry }: { message: string; retry?: () => void }) {
  const c = useThemeColors();
  return (
    <View accessibilityRole="alert" style={{ backgroundColor: c.dangerBg, borderRadius: 18, padding: 14, gap: 10 }}>
      <View style={[s.row, { alignItems: "flex-start" }]}>
        <AlertCircle size={18} color={c.danger} style={{ marginTop: 1 }} />
        <Text style={[hubText.body, { color: c.danger, flex: 1, fontSize: 14, lineHeight: 21 }]}>{message}</Text>
      </View>
      {retry ? (
        <Pressable accessibilityRole="button" onPress={retry} style={{ alignSelf: "flex-start", minHeight: 36, paddingHorizontal: 14, borderRadius: 12, justifyContent: "center", backgroundColor: c.surface }}>
          <Text style={[hubText.link, { color: c.text100 }]}>{tx("ხელახლა ცდა", "Try again")}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function NLoading() {
  const c = useThemeColors();
  return <ActivityIndicator accessibilityLabel={tx("იტვირთება", "Loading")} color={c.primary100} style={{ padding: 30 }} />;
}

const s = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  tile: { width: HUB.tile, height: HUB.tile, borderRadius: HUB.tileRadius, alignItems: "center", justifyContent: "center" },
  choice: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 54, paddingVertical: 10 },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, alignItems: "center", justifyContent: "center" },
  round: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  weekArrow: { width: 40, height: 40, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  weekDay: { flex: 1, minWidth: 0, minHeight: 60, borderRadius: 14, alignItems: "center", justifyContent: "center", gap: 1 },
  dot: { width: 4, height: 4, borderRadius: 2 },
  bar: { width: 10, height: 3, borderRadius: 2 },
});

export { MacroRails, WeightChart, IntakeWeekChart } from "./NutritionCharts";
