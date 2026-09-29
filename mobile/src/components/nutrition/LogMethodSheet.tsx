import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  Bookmark,
  Camera,
  ImagePlus,
  Keyboard as KeyboardIcon,
  ScanBarcode,
  ScanText,
  Search,
  Sparkles,
  X,
  type LucideIcon,
} from "lucide-react-native";
import { APP_MODAL_OVERLAY, APP_MODAL_PROPS, Modal } from "@/components/ui/appModal";
import { useIsDark, useThemeColors } from "@/theme/colors";
import { HUB, hubInk, hubText, hubTint, type HubInk } from "@/theme/hub";
import { tx } from '@/i18n/locale';

export type LogMethod = "camera" | "gallery" | "barcode" | "label" | "describe" | "search" | "saved" | "manual";
type Entry = { key: LogMethod; title: string; detail: string; icon: LucideIcon; ink: HubInk; ai?: boolean };
const ENTRIES: Entry[] = [
  { key: "camera", title: tx("გადაიღე კერძი", "Snap a meal"), detail: tx("Medi ამოიცნობს და დაითვლის", "Medi recognizes and counts it"), icon: Camera, ink: "teal", ai: true },
  { key: "gallery", title: tx("ფოტო გალერეიდან", "Photo from gallery"), detail: tx("უკვე გადაღებული კერძი", "A meal you already photographed"), icon: ImagePlus, ink: "teal", ai: true },
  { key: "barcode", title: tx("შტრიხკოდი", "Barcode"), detail: tx("შეფუთული პროდუქტი ერთ წამში", "Packaged food in a second"), icon: ScanBarcode, ink: "blue" },
  { key: "label", title: tx("ეტიკეტის სკანი", "Scan a label"), detail: tx("Nutrition Facts ცხრილი ფოტოდან", "Nutrition Facts panel from a photo"), icon: ScanText, ink: "violet", ai: true },
  { key: "describe", title: tx("აღწერე ან თქვი", "Describe or say it"), detail: tx("„ორი ხინკალი და სალათი“", "“Two khinkali and a salad”"), icon: Sparkles, ink: "amber", ai: true },
  { key: "search", title: tx("საკვების ძებნა", "Search foods"), detail: tx("ქართული კერძები და პროდუქტები", "Georgian dishes and products"), icon: Search, ink: "green" },
  { key: "saved", title: tx("შენახული და ბოლო", "Saved and recent"), detail: tx("ხშირი კერძები ერთი შეხებით", "Frequent meals in one tap"), icon: Bookmark, ink: "rose" },
  { key: "manual", title: tx("ხელით შეყვანა", "Enter manually"), detail: tx("სახელი, გრამი და მნიშვნელობები", "Name, grams and values"), icon: KeyboardIcon, ink: "neutral" },
];

/** The "+" menu: every way to get food into the diary, AI ways marked as such. */
export function LogMethodSheet({
  visible,
  aiEnabled,
  onPick,
  onClose,
}: {
  visible: boolean;
  aiEnabled: boolean;
  onPick: (method: LogMethod) => void;
  onClose: () => void;
}) {
  const c = useThemeColors();
  const dark = useIsDark();
  const safe = useSafeAreaInsets();
  return (
    <Modal visible={visible} {...APP_MODAL_PROPS} onRequestClose={onClose}>
      <Pressable accessibilityRole="button" accessibilityLabel={tx("დახურვა", "Close")} onPress={onClose} style={[StyleSheet.absoluteFill, { backgroundColor: APP_MODAL_OVERLAY }]} />
      <View style={{ flex: 1, justifyContent: "flex-end" }} pointerEvents="box-none">
        <View accessibilityViewIsModal style={[s.sheet, { backgroundColor: c.surface, paddingBottom: Math.max(safe.bottom, 16) }]}>
          <View style={[s.grip, { backgroundColor: c.bg300 }]} />
          <View style={s.head}>
            <Text style={[hubText.cardTitle, { color: c.text100, fontSize: 17 }]}>{tx("როგორ ჩავწეროთ?", "How do you want to log it?")}</Text>
            <Pressable accessibilityRole="button" accessibilityLabel={tx("დახურვა", "Close")} onPress={onClose} style={s.close}>
              <X size={20} color={c.text200} />
            </Pressable>
          </View>
          <View style={s.grid}>
            {ENTRIES.map((entry) => {
              const disabled = !!entry.ai && !aiEnabled;
              const ink = hubInk(entry.ink, dark);
              return (
                <Pressable
                  key={entry.key}
                  accessibilityRole="button"
                  accessibilityLabel={entry.title}
                  accessibilityState={{ disabled }}
                  disabled={disabled}
                  onPress={() => onPick(entry.key)}
                  style={[s.tile, { backgroundColor: c.bg100, opacity: disabled ? 0.45 : 1 }]}
                >
                  <View style={[s.icon, { backgroundColor: hubTint(ink, dark) }]}>
                    <entry.icon size={21} color={ink} strokeWidth={2} />
                  </View>
                  <Text numberOfLines={1} style={[hubText.link, { color: c.text100 }]}>{entry.title}</Text>
                  <Text numberOfLines={2} style={[hubText.small, { color: c.text200 }]}>{entry.detail}</Text>
                </Pressable>
              );
            })}
          </View>
          <Text style={[hubText.small, { color: c.text300, textAlign: "center" }]}>
            {aiEnabled ? tx("AI შეფასება მიახლოებითია — შენახვამდე გადაამოწმებ.", "AI estimates are approximate — you check them before saving.") : tx("AI შეფასება დროებით გამორთულია. შტრიხკოდი, ძებნა და ხელით შეყვანა მუშაობს.", "AI estimates are paused for now. Barcode, search and manual entry still work.")}
          </Text>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  sheet: { borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: HUB.gutter, paddingTop: 10, gap: 14 },
  grip: { width: 40, height: 4, borderRadius: 2, alignSelf: "center" },
  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  close: { width: 40, height: 40, alignItems: "center", justifyContent: "center", marginRight: -8 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  tile: { width: "48%", flexGrow: 1, borderRadius: 18, padding: 14, gap: 6, minHeight: 104 },
  icon: { width: HUB.tile, height: HUB.tile, borderRadius: HUB.tileRadius, alignItems: "center", justifyContent: "center" },
});
