import React, { useEffect, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions, type LayoutChangeEvent } from 'react-native';
import { useRouter } from 'expo-router';
import { ArrowUpRight, Megaphone, X } from 'lucide-react-native';
import type { Announcement } from '@/lib/api';
import { announcementImageUri, openAnnouncementCta, trackAnnouncement, usableCta } from '@/lib/announcements';
import { HomeSectionHeading } from '@/components/home/HomeSectionHeading';
import { HUB, hubInk, hubText, hubTint } from '@/theme/hub';
import { useIsDark, useThemeColors } from '@/theme/colors';
import { tx } from '@/i18n/locale';
import { useHomeAccent } from '@/theme/homeAccent';

const PEEK = 28;
const GAP = 12;

/**
 * „სიახლეები“ on Home, directly above nutrition. Title outside the card (hub rule), flat surface
 * card, the admin's tone only tints the badge, icon tile and button. Several live cards scroll
 * sideways with the next one peeking. Renders nothing when there is no card.
 */
export function HomeNewsSection({ items, onDismiss }: { items: Announcement[]; onDismiss: (id: string) => void }) {
  // First paint uses the window (Home caps content at 760); onLayout then gives the exact width.
  const screen = useWindowDimensions();
  const [width, setWidth] = useState(() => Math.min(screen.width, 760) - HUB.gutter * 2);
  const [page, setPage] = useState(0);
  if (!items.length) return null;
  const many = items.length > 1;
  const cardWidth = many && width ? width - PEEK : width;

  return (
    <View style={s.section} onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width - HUB.gutter * 2)}>
      <HomeSectionHeading title={tx('სიახლეები', 'News')} />
      {width ? (
        many ? (
          <>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              decelerationRate="fast"
              snapToInterval={cardWidth + GAP}
              snapToAlignment="start"
              contentContainerStyle={{ gap: GAP, paddingRight: HUB.gutter }}
              style={{ marginRight: -HUB.gutter }}
              onMomentumScrollEnd={(e) => setPage(Math.round(e.nativeEvent.contentOffset.x / (cardWidth + GAP)))}
            >
              {items.map((item) => (
                <NewsCard key={item.id} item={item} width={cardWidth} onDismiss={onDismiss} />
              ))}
            </ScrollView>
            <Dots count={items.length} active={Math.min(page, items.length - 1)} />
          </>
        ) : (
          <NewsCard item={items[0]} width={cardWidth} onDismiss={onDismiss} />
        )
      ) : null}
    </View>
  );
}

function NewsCard({ item, width, onDismiss }: { item: Announcement; width: number; onDismiss: (id: string) => void }) {
  const c = useThemeColors();
  const dark = useIsDark();
  const router = useRouter();
  const ink = hubInk(item.tone, dark);
  const image = announcementImageUri(item.image);
  const [imageFailed, setImageFailed] = useState(false);
  const cta = usableCta(item);
  const showImage = image && !imageFailed;

  useEffect(() => {
    trackAnnouncement(item.id, 'view');
  }, [item.id]);

  const openDetails = () => {
    trackAnnouncement(item.id, 'click');
    router.push(`/news/${item.id}` as never);
  };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${item.badge || tx('სიახლე', 'News')}. ${item.title}. ${item.body}`}
      accessibilityHint={tx('სიახლის დეტალური გვერდი', 'News details page')}
      onPress={openDetails}
      style={[s.card, { width, backgroundColor: c.surface }]}
    >
      {showImage ? (
        <Image
          source={{ uri: image }}
          onError={() => setImageFailed(true)}
          accessibilityIgnoresInvertColors
          style={s.image}
          resizeMode="cover"
        />
      ) : null}
      <View style={s.body}>
        <View style={s.head}>
          {showImage ? null : (
            <View style={[s.tile, { backgroundColor: hubTint(ink, dark) }]}>
              <Megaphone size={21} color={ink} strokeWidth={1.8} />
            </View>
          )}
          <View style={{ flex: 1, minWidth: 0, gap: 6, paddingRight: !showImage && item.dismissible ? 26 : 0 }}>
            <View style={[s.badge, { backgroundColor: hubTint(ink, dark) }]}>
              <Text style={[hubText.small, s.badgeText, { color: ink }]} numberOfLines={1}>
                {item.badge || tx('სიახლე', 'News')}
              </Text>
            </View>
            <Text style={[hubText.cardTitle, { color: c.text100, fontSize: 16, lineHeight: 23 }]}>{item.title}</Text>
            {item.body ? (
              <Text style={[hubText.body, { color: c.text200 }]} numberOfLines={3}>
                {item.body}
              </Text>
            ) : null}
          </View>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={cta ? cta.label : tx('დეტალურად', 'Details')}
          onPress={cta ? () => openAnnouncementCta(router, item) : openDetails}
          style={[s.ctaRow, { borderColor: c.bg300 }]}
        >
          <Text style={[hubText.link, { color: ink, flex: 1 }]} numberOfLines={1}>
            {cta ? cta.label : tx('დეტალურად', 'Details')}
          </Text>
          <ArrowUpRight size={18} color={ink} />
        </Pressable>
      </View>
      {item.dismissible ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={tx('სიახლის დამალვა', 'Hide this news')}
          hitSlop={8}
          onPress={() => onDismiss(item.id)}
          style={[s.close, showImage ? s.closeOnImage : null]}
        >
          <X size={16} color={showImage ? '#FFFFFF' : c.text200} strokeWidth={2.2} />
        </Pressable>
      ) : null}
    </Pressable>
  );
}

function Dots({ count, active }: { count: number; active: number }) {
  const c = useThemeColors();
  const accent = useHomeAccent();
  return (
    <View style={s.dots} accessible={false} importantForAccessibility="no-hide-descendants">
      {Array.from({ length: count }, (_, i) => (
        <View key={i} style={[s.dot, { backgroundColor: i === active ? accent.ring : c.bg300, width: i === active ? 16 : 6 }]} />
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  section: { paddingHorizontal: HUB.gutter, marginTop: HUB.sectionGap },
  card: { borderRadius: HUB.cardRadius, overflow: 'hidden' },
  image: { width: '100%', aspectRatio: 16 / 9 },
  body: { padding: HUB.cardPad, gap: 14 },
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: 14 },
  tile: { width: HUB.tile, height: HUB.tile, borderRadius: HUB.tileRadius, alignItems: 'center', justifyContent: 'center' },
  badge: { alignSelf: 'flex-start', borderRadius: 99, paddingHorizontal: 9, paddingVertical: 2 },
  badgeText: { fontFamily: 'NotoSansGeorgian_600SemiBold' },
  ctaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 12,
    minHeight: 44,
  },
  close: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeOnImage: { backgroundColor: 'rgba(0,0,0,0.45)' },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 5, marginTop: 12 },
  dot: { height: 6, borderRadius: 3 },
});
