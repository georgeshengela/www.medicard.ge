import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Bookmark, Camera, Keyboard as KeyboardIcon, MessageSquareText, Mic, ScanBarcode, Search, Sparkles, type LucideIcon } from 'lucide-react-native';
import { HomeSectionHeading } from '@/components/home/HomeSectionHeading';
import type { LogMethod } from '@/components/nutrition/LogMethodSheet';
import { isFeatureOn, useFeatureState } from '@/lib/featureFlags';
import { useIsDark, useThemeColors } from '@/theme/colors';
import { useHomeAccent } from '@/theme/homeAccent';
import { HUB, hubInk, hubText, hubTint, type HubInk } from '@/theme/hub';
import { tx } from '@/i18n/locale';

type Tile = { method: LogMethod; label: string; hint: string; icon: LucideIcon; ink: HubInk | 'accent' };

/**
 * „ჩაწერე კვება“ — one tap into the existing diary with the method already running
 * (`/nutrition/diary?method=…`, handled by the diary's `startWith`; every `LogMethod` is supported).
 * AI ways (photo, describe) only while `nutritionAi` is on; otherwise saved and manual take their place.
 */
export function HomeQuickLog({ first = false }: { first?: boolean }) {
  const c = useThemeColors();
  const dark = useIsDark();
  const accent = useHomeAccent();
  const router = useRouter();
  const features = useFeatureState();
  const ai = isFeatureOn('nutritionAi', features);
  // DescribeMealModal hides its microphone while `voice` is paused; the tile then says "describe".
  const voice = isFeatureOn('voice', features);

  const describe: Tile = voice
    ? { method: 'describe', label: tx('თქვი', 'Say it'), hint: tx('ან ჩაწერე სიტყვებით', 'or type it'), icon: Mic, ink: 'violet' }
    : { method: 'describe', label: tx('აღწერე', 'Describe'), hint: tx('სიტყვებით', 'in words'), icon: MessageSquareText, ink: 'violet' };
  const tiles: Tile[] = ai
    ? [
        { method: 'camera', label: tx('გადაიღე', 'Snap'), hint: tx('კერძის ფოტო', 'photo of a meal'), icon: Camera, ink: 'accent' },
        { method: 'barcode', label: tx('შტრიხკოდი', 'Barcode'), hint: tx('შეფუთული პროდუქტი', 'packaged food'), icon: ScanBarcode, ink: 'sky' },
        describe,
        { method: 'search', label: tx('მოძებნე', 'Search'), hint: tx('კერძები და პროდუქტები', 'dishes and products'), icon: Search, ink: 'amber' },
      ]
    : [
        { method: 'barcode', label: tx('შტრიხკოდი', 'Barcode'), hint: tx('შეფუთული პროდუქტი', 'packaged food'), icon: ScanBarcode, ink: 'sky' },
        { method: 'search', label: tx('მოძებნე', 'Search'), hint: tx('კერძები და პროდუქტები', 'dishes and products'), icon: Search, ink: 'amber' },
        { method: 'saved', label: tx('შენახული', 'Saved'), hint: tx('ბოლო და რჩეული კერძები', 'recent and favorite meals'), icon: Bookmark, ink: 'rose' },
        { method: 'manual', label: tx('ხელით', 'Manual'), hint: tx('სახელი, გრამი, კკალ', 'name, grams, kcal'), icon: KeyboardIcon, ink: 'neutral' },
      ];

  return (
    <View style={{ paddingHorizontal: HUB.gutter, marginTop: first ? 22 : HUB.sectionGap }}>
      <HomeSectionHeading title={tx('ჩაწერე კვება', 'Log food')} linkLabel={tx('დღიური', 'Diary')} onLink={() => router.push('/nutrition/diary' as never)} />
      <View style={[s.card, { backgroundColor: c.surface }]}>
        <View style={s.row}>
          {tiles.map((tile) => {
            const ink = tile.ink === 'accent' ? accent.ink : hubInk(tile.ink, dark);
            const tint = tile.ink === 'accent' ? accent.tint : hubTint(ink, dark);
            return (
              <Pressable
                key={tile.method}
                accessibilityRole="button"
                accessibilityLabel={`${tile.label} · ${tile.hint}`}
                onPress={() => router.push({ pathname: '/nutrition/diary', params: { method: tile.method } } as never)}
                style={s.tile}
              >
                <View style={[s.icon, { backgroundColor: tint }]}>
                  <tile.icon size={22} color={ink} strokeWidth={1.9} />
                </View>
                <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75} style={[hubText.link, s.label, { color: c.text100 }]}>
                  {tile.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
        {ai ? (
          <View style={[s.note, { borderTopColor: c.bg300 }]}>
            <Sparkles size={14} color={accent.ink} strokeWidth={2} />
            <Text style={[hubText.small, { color: c.text200, flex: 1 }]}>
              {tx('AI-ს შეფასებას შენახვამდე ყოველთვის თავად ამოწმებ.', 'You always check the AI estimate before saving.')}
            </Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  card: { borderRadius: HUB.cardRadius, padding: 14, gap: 10 },
  row: { flexDirection: 'row', gap: 6 },
  tile: { flex: 1, minWidth: 0, minHeight: 44, alignItems: 'center', gap: 8, paddingVertical: 6 },
  icon: { width: 52, height: 52, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  label: { fontSize: 12, lineHeight: 16, textAlign: 'center' },
  note: { flexDirection: 'row', alignItems: 'center', gap: 6, borderTopWidth: 1, paddingTop: 10 },
});
