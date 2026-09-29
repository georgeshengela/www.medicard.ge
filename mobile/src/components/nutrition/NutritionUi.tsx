import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import {
  Bookmark,
  Camera,
  Flame,
  ImagePlus,
  Keyboard as KeyboardIcon,
  Mic,
  ScanBarcode,
  ScanText,
  Search,
  type LucideIcon,
} from "lucide-react-native";
import { HomeSectionHeading } from "@/components/home/HomeSectionHeading";
import { healthScoreLabel } from "@/lib/nutrition";
import type { LogMethod } from "./LogMethodSheet";
import { useIsDark, useThemeColors } from "@/theme/colors";
import { HUB, hubInk, hubText, hubTint, type HubInk } from "@/theme/hub";
import { tx } from '@/i18n/locale';

type Tile = { method: LogMethod; title: string; hint: string; icon: LucideIcon; ink: HubInk };
/** The four ways a first-time user should see first; the rest live behind "more". */
export const PRIMARY_LOG_TILES: Tile[] = [
  { method: "camera", title: tx("გადაიღე", "Snap"), hint: tx("კერძის ფოტო", "Photo of a meal"), icon: Camera, ink: "teal" },
  { method: "barcode", title: tx("შტრიხკოდი", "Barcode"), hint: tx("შეფუთული პროდუქტი", "Packaged food"), icon: ScanBarcode, ink: "blue" },
  { method: "describe", title: tx("თქვი", "Describe"), hint: tx("ან ჩაწერე სიტყვებით", "Say it or type it"), icon: Mic, ink: "amber" },
  { method: "search", title: tx("მოძებნე", "Search"), hint: tx("კერძები და პროდუქტები", "Dishes and products"), icon: Search, ink: "green" },
];
export const SECONDARY_LOG_TILES: Tile[] = [
  { method: "gallery", title: tx("გალერეა", "Gallery"), hint: tx("უკვე გადაღებული ფოტო", "A photo you already took"), icon: ImagePlus, ink: "teal" },
  { method: "label", title: tx("ეტიკეტი", "Label"), hint: tx("Nutrition Facts ცხრილი", "Nutrition Facts panel"), icon: ScanText, ink: "violet" },
  { method: "saved", title: tx("შენახული", "Saved"), hint: tx("ბოლო და რჩეული კერძები", "Recent and favorite meals"), icon: Bookmark, ink: "rose" },
  { method: "manual", title: tx("ხელით", "Manual"), hint: tx("სახელი, გრამი, კკალ", "Name, grams, kcal"), icon: KeyboardIcon, ink: "neutral" },
];

/**
 * Quick-log tiles: one tap opens the diary with that method already running.
 * Same tile everywhere (Home, hub, empty diary) so the person learns it once.
 */
export function QuickLogTiles({ tiles = PRIMARY_LOG_TILES, columns = 4, onPick }: { tiles?: Tile[]; columns?: 2 | 4; onPick?: (method: LogMethod) => void }) {
  const c = useThemeColors();
  const dark = useIsDark();
  const router = useRouter();
  const wide = columns === 2;
  return (
    <View style={s.grid}>
      {tiles.map((tile) => {
        const ink = hubInk(tile.ink, dark);
        return (
          <Pressable
            key={tile.method}
            accessibilityRole="button"
            accessibilityLabel={`${tile.title} · ${tile.hint}`}
            onPress={() => (onPick ? onPick(tile.method) : router.push({ pathname: "/nutrition/diary", params: { method: tile.method } } as never))}
            style={[s.tile, wide ? s.tileWide : s.tileNarrow, { backgroundColor: c.bg100 }]}
          >
            <View style={[s.icon, { backgroundColor: hubTint(ink, dark) }]}>
              <tile.icon size={wide ? 21 : 20} color={ink} strokeWidth={2} />
            </View>
            <View style={{ minWidth: 0, flex: wide ? 1 : undefined, alignItems: wide ? "flex-start" : "center" }}>
              <Text numberOfLines={1} style={[hubText.link, { color: c.text100, fontSize: wide ? 14 : 12, textAlign: wide ? "left" : "center" }]}>{tile.title}</Text>
              {wide ? <Text numberOfLines={1} style={[hubText.small, { color: c.text200 }]}>{tile.hint}</Text> : null}
            </View>
          </Pressable>
        );
      })}
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
    <View style={{ marginTop: first ? 0 : HUB.sectionGap - 20, gap: HUB.headingGap }}>
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
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  tile: { borderRadius: 16, alignItems: "center", justifyContent: "center", gap: 8 },
  tileNarrow: { flex: 1, minWidth: 0, paddingVertical: 12, paddingHorizontal: 6, minHeight: 84 },
  tileWide: { width: "48%", flexGrow: 1, flexDirection: "row", padding: 12, minHeight: 66 },
  icon: { width: HUB.tile, height: HUB.tile, borderRadius: HUB.tileRadius, alignItems: "center", justifyContent: "center" },
  badge: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 9, borderRadius: 10, alignSelf: "flex-start" },
  card: { borderRadius: HUB.cardRadius, padding: HUB.cardPad, gap: 12 },
});
