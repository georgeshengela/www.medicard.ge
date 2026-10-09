import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import {
  Apple,
  Bookmark,
  Camera,
  Ellipsis,
  Flame,
  Keyboard as KeyboardIcon,
  MessageSquareText,
  Mic,
  Moon,
  ScanBarcode,
  Search,
  SunMedium,
  Utensils,
  type LucideIcon,
} from "lucide-react-native";
import { HomeSectionHeading } from "@/components/home/HomeSectionHeading";
import { healthScoreLabel, mealLabels } from "@/lib/nutrition";
import type { LogMethod } from "./LogMethodSheet";
import { useIsDark, useModuleTone, useThemeColors } from "@/theme/colors";
import { isFeatureOn, useFeatureState } from "@/lib/featureFlags";
import { HUB, hubInk, hubText, hubTint, type HubInk } from "@/theme/hub";
import { tx } from '@/i18n/locale';

export type MealType = keyof typeof mealLabels;
/** The day's four slots, in eating order. */
export const MEAL_TYPES: MealType[] = ["breakfast", "lunch", "dinner", "snack"];
/** One glyph per slot, everywhere a meal type is shown (hub, diary, plan, Home). */
export const MEAL_ICONS: Record<MealType, LucideIcon> = { breakfast: SunMedium, lunch: Utensils, dinner: Moon, snack: Apple };

/** Where every logging door leads: the diary with that method running (and the slot preset). */
export function diaryHref(method?: LogMethod, type?: MealType) {
  const params: Record<string, string> = {};
  if (method) params.method = method;
  if (type) params.type = type;
  return { pathname: "/nutrition/diary", params } as never;
}

/**
 * The logging bar (MyFitnessPal / Lose It pattern): one search field — the way most food gets in —
 * with the photo and barcode buttons inside it, then a single row of the other ways. Replaces the old
 * grid of eight equal tiles; every method stays one tap away and the full menu sits behind „სხვა“.
 * Without AI (admin `nutritionAi` off) the photo button and „თქვი“ step aside.
 */
export function LogBar({ type, onPick, ink: inkProp, fill: fillProp, onFill }: {
  type?: MealType;
  onPick?: (method: LogMethod) => void;
  /** Icon colour (Home passes its layout accent); the camera button is `fill` with `onFill` on it. */
  ink?: string;
  fill?: string;
  onFill?: string;
}) {
  const c = useThemeColors();
  const dark = useIsDark();
  const router = useRouter();
  const moduleTone = useModuleTone();
  const features = useFeatureState();
  const ai = isFeatureOn("nutritionAi", features);
  const voice = isFeatureOn("voice", features);
  const ink = inkProp ?? (moduleTone ? c.primary100 : hubInk("teal", dark));
  const fill = fillProp ?? ink;
  const onInk = onFill ?? (dark ? "#022C22" : "#FFFFFF");
  const go = (method: LogMethod) => (onPick ? onPick(method) : router.push(diaryHref(method, type)));
  // Three ways beside the bar; gallery, label and manual live behind „სხვა გზები“ (the full menu).
  const chips: { method: LogMethod; label: string; icon: LucideIcon }[] = [
    ai ? { method: "describe", label: voice ? tx("თქვი", "Say it") : tx("აღწერე", "Describe"), icon: voice ? Mic : MessageSquareText } : { method: "manual", label: tx("ხელით", "Manual"), icon: KeyboardIcon },
    { method: "saved", label: tx("შენახული", "Saved"), icon: Bookmark },
    { method: "more", label: tx("სხვა გზები", "More ways"), icon: Ellipsis },
  ];
  return (
    <View style={{ gap: 8 }}>
      <View style={[s.bar, { backgroundColor: c.surface }]}>
        <Pressable accessibilityRole="search" accessibilityLabel={tx("საკვების ძებნა", "Search foods")} onPress={() => go("search")} style={s.barSearch}>
          <Search size={19} color={c.text200} strokeWidth={2.2} />
          <Text numberOfLines={1} style={[hubText.body, { color: c.text300, fontSize: 15, flex: 1 }]}>{tx("მოძებნე საკვები", "Search foods")}</Text>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel={tx("შტრიხკოდის სკანი", "Scan a barcode")} onPress={() => go("barcode")} style={[s.barButton, { backgroundColor: hubTint(ink, dark) }]}>
          <ScanBarcode size={20} color={ink} strokeWidth={2.1} />
        </Pressable>
        {ai ? (
          <Pressable accessibilityRole="button" accessibilityLabel={tx("კერძის გადაღება", "Snap a meal")} onPress={() => go("camera")} style={[s.barButton, { backgroundColor: fill }]}>
            <Camera size={20} color={onInk} strokeWidth={2.1} />
          </Pressable>
        ) : null}
      </View>
      <View style={s.chips}>
        {chips.map((chip) => (
          <Pressable key={chip.method} accessibilityRole="button" accessibilityLabel={chip.method === "more" ? tx("ჩაწერის ყველა გზა", "Every way to log") : chip.label} onPress={() => go(chip.method)} style={[s.chip, { backgroundColor: c.surface }]}>
            <chip.icon size={16} color={ink} strokeWidth={2.1} />
            <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85} style={[hubText.link, { color: c.text100, flexShrink: 1 }]}>{chip.label}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

/** 1–10 meal quality pill. Colour says "balanced / middling / heavy", never "good person / bad person". */
export function ScoreBadge({ score, size = "md" }: { score: number | null | undefined; size?: "sm" | "md" }) {
  const c = useThemeColors();
  const dark = useIsDark();
  if (score == null) return null;
  const ink = score >= 8 ? hubInk("green", dark) : score >= 5 ? hubInk("amber", dark) : hubInk("rose", dark);
  return (
    <View accessibilityLabel={tx(`კერძის ბალანსი ${score} ათიდან, ${healthScoreLabel(score)}`, `Meal balance ${score} out of 10, ${healthScoreLabel(score)}`)} style={[s.badge, { backgroundColor: hubTint(ink, dark), paddingVertical: size === "sm" ? 3 : 5 }]}>
      <Flame size={size === "sm" ? 11 : 13} color={ink} strokeWidth={2.4} />
      <Text style={[hubText.small, { color: ink, fontFamily: "NotoSansGeorgian_600SemiBold", fontSize: size === "sm" ? 11 : 12 }]}>
        {score}/10{size === "sm" ? "" : ` · ${healthScoreLabel(score)}`}
      </Text>
    </View>
  );
}

/** Three little macro figures under a meal line: ც 24 · ნ 40 · ცხ 12 გ. */
export function MacroLine({ protein, carbs, fat, color }: { protein: number; carbs: number; fat: number; color?: string }) {
  const c = useThemeColors();
  return (
    <Text numberOfLines={1} style={[hubText.small, { color: color || c.text200 }]}>
      {tx(`ცილა ${Math.round(protein)} · ნახშ. ${Math.round(carbs)} · ცხიმი ${Math.round(fat)} გ`, `Protein ${Math.round(protein)} · Carbs ${Math.round(carbs)} · Fat ${Math.round(fat)} g`)}
    </Text>
  );
}

/** A hub section: title outside the card, optional right link, then the content. */
export function HubSection({ title, linkLabel, onLink, children, first = false }: { title: string; linkLabel?: string; onLink?: () => void; children: React.ReactNode; first?: boolean }) {
  return (
    // The heading carries its own bottom margin (HUB.headingGap); no second gap here.
    <View style={{ marginTop: first ? 0 : HUB.sectionGap - 20 }}>
      <HomeSectionHeading title={title} linkLabel={linkLabel} onLink={onLink} />
      {children}
    </View>
  );
}

/** Flat hub card: surface, radius 22, no border, no shadow. */
export function HubCard({ children, style, tone = "surface" }: { children: React.ReactNode; style?: object; tone?: "surface" | "spotlight" }) {
  const c = useThemeColors();
  return <View style={[s.card, { backgroundColor: tone === "spotlight" ? HUB.spotlightBg : c.surface }, style]}>{children}</View>;
}

const s = StyleSheet.create({
  bar: { flexDirection: "row", alignItems: "center", gap: 6, borderRadius: 20, padding: 6, paddingLeft: 0, minHeight: 58 },
  barSearch: { flex: 1, minWidth: 0, minHeight: 46, flexDirection: "row", alignItems: "center", gap: 10, paddingLeft: 16 },
  barButton: { width: 46, height: 46, borderRadius: 15, alignItems: "center", justifyContent: "center" },
  chips: { flexDirection: "row", gap: 6 },
  chip: { flex: 1, minWidth: 0, minHeight: 44, borderRadius: 15, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingHorizontal: 6 },
  badge: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 9, borderRadius: 10, alignSelf: "flex-start" },
  card: { borderRadius: HUB.cardRadius, padding: HUB.cardPad, gap: 12 },
});
