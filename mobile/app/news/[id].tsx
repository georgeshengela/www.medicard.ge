import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft, Megaphone } from 'lucide-react-native';
import { Button } from '@/components/ui/Button';
import { api, ApiError, type Announcement } from '@/lib/api';
import { announcementImageUri, detailParagraphs, openAnnouncementCta, usableCta } from '@/lib/announcements';
import { formatDayMonthYearKa } from '@/lib/format';
import { peekAnnouncement } from '@/hooks/useAnnouncements';
import { HUB, hubInk, hubText, hubTint } from '@/theme/hub';
import { useIsDark, useThemeColors } from '@/theme/colors';

/** Full news card: picture, title, details and the one button. Opens from Home or a push `route`. */
export default function NewsDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const c = useThemeColors();
  const dark = useIsDark();
  const [card, setCard] = useState<Announcement | null>(() => (id ? peekAnnouncement(String(id)) : null));
  const [state, setState] = useState<'loading' | 'ready' | 'gone' | 'error'>(card ? 'ready' : 'loading');
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => {
    if (!id) return;
    let live = true;
    api.announcements
      .get(String(id))
      .then(({ announcement }) => {
        if (!live) return;
        setCard(announcement);
        setState('ready');
      })
      .catch((error) => {
        if (!live) return;
        if (error instanceof ApiError && error.status === 404) {
          setCard(null);
          setState('gone');
        } else setState((prev) => (prev === 'ready' ? prev : 'error'));
      });
    return () => {
      live = false;
    };
  }, [id]);

  const back = () => (router.canGoBack() ? router.back() : router.replace('/(tabs)/home'));
  const ink = hubInk(card?.tone ?? 'teal', dark);
  const image = announcementImageUri(card?.image);
  const cta = card ? usableCta(card) : null;
  const paragraphs = card ? detailParagraphs(card) : [];

  return (
    <View style={{ flex: 1, backgroundColor: c.bg100 }}>
      <View style={[s.header, { paddingTop: insets.top + 8 }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="უკან"
          onPress={back}
          style={[s.back, { backgroundColor: c.surface }]}
        >
          <ArrowLeft size={22} color={c.text100} />
        </Pressable>
        <Text accessibilityRole="header" style={[hubText.sectionTitle, { color: c.text100, flex: 1 }]} numberOfLines={1}>
          სიახლე
        </Text>
      </View>

      {state === 'loading' ? (
        <View style={s.center}>
          <ActivityIndicator color={c.primary200} />
        </View>
      ) : !card ? (
        <View style={[s.center, { paddingHorizontal: 28, gap: 14 }]}>
          <View style={[s.tile, { backgroundColor: hubTint(ink, dark) }]}>
            <Megaphone size={22} color={ink} strokeWidth={1.8} />
          </View>
          <Text style={[hubText.cardTitle, { color: c.text100, textAlign: 'center', fontSize: 17 }]}>
            {state === 'gone' ? 'ეს სიახლე აღარ არის აქტიური' : 'სიახლე ვერ ჩაიტვირთა'}
          </Text>
          <Text style={[hubText.body, { color: c.text200, textAlign: 'center' }]}>
            {state === 'gone' ? 'ღონისძიება დასრულდა ან სიახლე მოიხსნა.' : 'შეამოწმე ინტერნეტი და სცადე ხელახლა.'}
          </Text>
          <Button label="მთავარზე დაბრუნება" onPress={() => router.replace('/(tabs)/home')} />
        </View>
      ) : (
        <>
          <ScrollView
            contentContainerStyle={{
              width: '100%',
              maxWidth: 760,
              alignSelf: 'center',
              paddingHorizontal: HUB.gutter,
              paddingBottom: cta ? 24 : insets.bottom + 32,
              gap: 16,
            }}
            showsVerticalScrollIndicator={false}
          >
            {image && !imageFailed ? (
              <Image
                source={{ uri: image }}
                onError={() => setImageFailed(true)}
                accessibilityIgnoresInvertColors
                style={s.image}
                resizeMode="cover"
              />
            ) : null}
            <View style={{ gap: 10 }}>
              <View style={[s.badge, { backgroundColor: hubTint(ink, dark) }]}>
                <Text style={[hubText.caption, { color: ink, fontFamily: 'NotoSansGeorgian_600SemiBold' }]}>
                  {card.badge || 'სიახლე'}
                </Text>
              </View>
              <Text accessibilityRole="header" style={[s.title, { color: c.text100 }]}>
                {card.title}
              </Text>
              {card.publishedAt || card.endsAt ? (
                <Text style={[hubText.caption, { color: c.text300 }]}>
                  {[
                    card.publishedAt ? formatDayMonthYearKa(new Date(card.publishedAt)) : '',
                    card.endsAt ? `აქტიურია ${formatDayMonthYearKa(new Date(card.endsAt))}-მდე` : '',
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </Text>
              ) : null}
            </View>
            {card.details && card.body ? (
              <Text style={[hubText.body, { color: c.text100, fontSize: 15, lineHeight: 24 }]}>{card.body}</Text>
            ) : null}
            {paragraphs.map((p, i) => (
              <Text key={i} style={[hubText.body, { color: c.text200, fontSize: 15, lineHeight: 24 }]}>
                {p}
              </Text>
            ))}
          </ScrollView>
          {cta ? (
            <View style={[s.footer, { paddingBottom: insets.bottom + 12, backgroundColor: c.bg100, borderColor: c.bg300 }]}>
              <View style={{ width: '100%', maxWidth: 760, alignSelf: 'center' }}>
                <Button label={cta.label} size="lg" onPress={() => openAnnouncementCta(router, card)} />
              </View>
            </View>
          ) : null}
        </>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingBottom: 12 },
  back: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  tile: { width: 48, height: 48, borderRadius: HUB.tileRadius, alignItems: 'center', justifyContent: 'center' },
  image: { width: '100%', aspectRatio: 16 / 9, borderRadius: HUB.cardRadius },
  badge: { alignSelf: 'flex-start', borderRadius: 99, paddingHorizontal: 10, paddingVertical: 3 },
  title: { fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 22, lineHeight: 31 },
  footer: { paddingHorizontal: HUB.gutter, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth },
});
