import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  Bookmark,
  Camera,
  ChevronRight,
  ImagePlus,
  Keyboard as KeyboardIcon,
  MessageSquareText,
  Mic,
  ScanBarcode,
  ScanText,
  Search,
  X,
  type LucideIcon,
} from "lucide-react-native";
import { APP_MODAL_OVERLAY, APP_MODAL_PROPS, Modal } from "@/components/ui/appModal";
import { useFeature } from "@/lib/featureFlags";
import { mealLabels } from "@/lib/nutrition";
import { useIsDark, useThemeColors } from "@/theme/colors";
import { HUB, hubText, hubTint } from "@/theme/hub";
import { tx } from "@/i18n/locale";

/** `more` is the logging bar's „სხვა“: it opens this menu. */
export type LogMethod = "camera" | "gallery" | "barcode" | "label" | "describe" | "search" | "saved" | "manual" | "more";
type Entry = { key: LogMethod; title: string; detail: string; icon: LucideIcon; ai?: boolean };

/**
 * The „+“ menu — every way to get food into the diary, in the order people reach for them: search on
 * top (most food is found by name), the three quick ways as big tiles, the rest as one quiet list.
 * The title names the meal slot it adds to.
 */
export function LogMethodSheet({
  visible,
  aiEnabled,
  mealType,
  onPick,
  onClose,
}: {
  visible: boolean;
  aiEnabled: boolean;
  mealType?: keyof typeof mealLabels;
  onPick: (method: LogMethod) => void;
  onClose: () => void;
}) {
  const c = useThemeColors();
  const dark = useIsDark();
  const safe = useSafeAreaInsets();
  const voice = useFeature("voice");
  const ink = c.primary100;
  const onInk = dark ? "#022C22" : "#FFFFFF";
  const quick: Entry[] = [
    { key: "camera", title: tx("გადაიღე", "Snap"), detail: tx("Medi დაითვლის", "Medi counts it"), icon: Camera, ai: true },
    { key: "barcode", title: tx("შტრიხკოდი", "Barcode"), detail: tx("შეფუთული", "Packaged"), icon: ScanBarcode },
    voice
      ? { key: "describe", title: tx("თქვი", "Say it"), detail: tx("ან დაწერე", "or type it"), icon: Mic, ai: true }
      : { key: "describe", title: tx("აღწერე", "Describe"), detail: tx("სიტყვებით", "in words"), icon: MessageSquareText, ai: true },
  ];
  const rest: Entry[] = [
    { key: "saved", title: tx("შენახული და ბოლო", "Saved and recent"), detail: tx("ხშირი კერძი ერთი შეხებით", "Frequent meals in one tap"), icon: Bookmark },
    { key: "gallery", title: tx("ფოტო გალერეიდან", "Photo from gallery"), detail: tx("უკვე გადაღებული კერძი", "A meal you already photographed"), icon: ImagePlus, ai: true },
    { key: "label", title: tx("ეტიკეტის სკანი", "Scan a label"), detail: tx("კვებითი ღირებულების ცხრილი", "The Nutrition Facts panel"), icon: ScanText, ai: true },
    { key: "manual", title: tx("ხელით შეყვანა", "Enter manually"), detail: tx("სახელი, გრამი, კკალ", "Name, grams, kcal"), icon: KeyboardIcon },
  ];
  const off = (entry: Entry) => !!entry.ai && !aiEnabled;
  return (
    <Modal visible={visible} {...APP_MODAL_PROPS} onRequestClose={onClose}>
      <Pressable accessibilityRole="button" accessibilityLabel={tx("დახურვა", "Close")} onPress={onClose} style={[StyleSheet.absoluteFill, { backgroundColor: APP_MODAL_OVERLAY }]} />
      <View style={{ flex: 1, justifyContent: "flex-end" }} pointerEvents="box-none">
        <View accessibilityViewIsModal style={[s.sheet, { backgroundColor: c.surface, paddingBottom: Math.max(safe.bottom, 16) }]}>
          <View style={[s.grip, { backgroundColor: c.bg300 }]} />
          <View style={s.head}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text numberOfLines={1} style={[hubText.cardTitle, { color: c.text100, fontSize: 18, lineHeight: 25 }]}>
                {mealType ? tx(`დამატება: ${mealLabels[mealType]}`, `Add to ${mealLabels[mealType].toLowerCase()}`) : tx("საკვების დამატება", "Add food")}
              </Text>
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel={tx("დახურვა", "Close")} onPress={onClose} style={s.close}>
              <X size={20} color={c.text200} />
            </Pressable>
          </View>

          <Pressable accessibilityRole="search" accessibilityLabel={tx("საკვების ძებნა", "Search foods")} onPress={() => onPick("search")} style={[s.search, { backgroundColor: c.bg100 }]}>
            <Search size={19} color={c.text200} strokeWidth={2.2} />
            <Text numberOfLines={1} style={[hubText.body, { color: c.text300, fontSize: 15, flex: 1 }]}>{tx("მოძებნე: ხაჭაპური, მაწონი, ბანანი…", "Search: khachapuri, yogurt, banana…")}</Text>
          </Pressable>

          <View style={s.quick}>
            {quick.map((entry, index) => {
              const disabled = off(entry);
              const lead = index === 0;
              return (
                <Pressable
                  key={entry.key}
                  accessibilityRole="button"
                  accessibilityLabel={`${entry.title}. ${entry.detail}`}
                  accessibilityState={{ disabled }}
                  disabled={disabled}
                  onPress={() => onPick(entry.key)}
                  style={[s.tile, { backgroundColor: lead ? ink : c.bg100, opacity: disabled ? 0.4 : 1 }]}
                >
                  <View style={[s.tileIcon, { backgroundColor: lead ? "rgba(255,255,255,0.18)" : hubTint(ink, dark) }]}>
                    <entry.icon size={21} color={lead ? onInk : ink} strokeWidth={2} />
                  </View>
                  <Text numberOfLines={1} style={[hubText.link, { color: lead ? onInk : c.text100, fontSize: 14 }]}>{entry.title}</Text>
                  <Text numberOfLines={1} style={[hubText.small, { color: lead ? onInk : c.text200, opacity: lead ? 0.85 : 1 }]}>{entry.detail}</Text>
                </Pressable>
              );
            })}
          </View>

          <View style={[s.list, { backgroundColor: c.bg100 }]}>
            {rest.map((entry, index) => {
              const disabled = off(entry);
              return (
                <Pressable
                  key={entry.key}
                  accessibilityRole="button"
                  accessibilityLabel={`${entry.title}. ${entry.detail}`}
                  accessibilityState={{ disabled }}
                  disabled={disabled}
                  onPress={() => onPick(entry.key)}
                  style={[s.row, index > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.bg300 }, { opacity: disabled ? 0.4 : 1 }]}
                >
                  <entry.icon size={19} color={ink} strokeWidth={2} />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text numberOfLines={1} style={[hubText.cardTitle, { color: c.text100, fontSize: 14.5 }]}>{entry.title}</Text>
                    <Text numberOfLines={1} style={[hubText.small, { color: c.text200 }]}>{entry.detail}</Text>
                  </View>
                  <ChevronRight size={17} color={c.text300} />
                </Pressable>
              );
            })}
          </View>
          <Text style={[hubText.small, { color: c.text300, textAlign: "center" }]}>
            {aiEnabled ? tx("AI-ს შეფასებას შენახვამდე თავად გადაამოწმებ.", "You check every AI estimate before it is saved.") : tx("AI შეფასება დროებით გამორთულია. ძებნა, შტრიხკოდი და ხელით შეყვანა მუშაობს.", "AI estimates are paused for now. Search, barcode and manual entry still work.")}
          </Text>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  sheet: { borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: HUB.gutter, paddingTop: 10, gap: 12 },
  grip: { width: 40, height: 4, borderRadius: 2, alignSelf: "center" },
  head: { flexDirection: "row", alignItems: "center", gap: 8 },
  close: { width: 44, height: 44, alignItems: "center", justifyContent: "center", marginRight: -10 },
  search: { flexDirection: "row", alignItems: "center", gap: 10, minHeight: 52, borderRadius: 16, paddingHorizontal: 16 },
  quick: { flexDirection: "row", gap: 8 },
  tile: { flex: 1, minWidth: 0, borderRadius: 18, paddingVertical: 12, paddingHorizontal: 8, alignItems: "center", gap: 4, minHeight: 104 },
  tileIcon: { width: 42, height: 42, borderRadius: 14, alignItems: "center", justifyContent: "center", marginBottom: 2 },
  list: { borderRadius: 18, paddingHorizontal: 14 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 56, paddingVertical: 8 },
});
