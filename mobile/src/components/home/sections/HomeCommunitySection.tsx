import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Baby, Feather, HeartHandshake, Leaf, MessageCircle, MessagesSquare, Orbit, PenLine, type LucideIcon } from 'lucide-react-native';
import { HomeSectionHeading } from '@/components/home/HomeSectionHeading';
import { useAccountQuery } from '@/hooks/useAccountQuery';
import { communityRequest } from '@/lib/api';
import { FRESH } from '@/lib/queryClient';
import { tx } from '@/i18n/locale';
import { useThemeColors } from '@/theme/colors';
import { useHomeAccent } from '@/theme/homeAccent';
import { HUB } from '@/theme/hub';

/** The few fields of a feed post the Home preview reads (`/api/community/posts`). */
type PreviewPost = {
  id: string;
  body: string;
  author: string;
  anonymous: boolean;
  topic?: string;
  comments: number;
  likes: number;
  reactions?: Record<string, number>;
};

const CARD_W = 248;
const CARD_GAP = 10;

const TOPIC: Record<string, { label: string; icon: LucideIcon }> = {
  everyday: { label: tx('ყოველდღიურობა', 'Everyday'), icon: Feather },
  cycle: { label: tx('ციკლი', 'Cycle'), icon: Orbit },
  pregnancy: { label: tx('ორსულობა', 'Pregnancy'), icon: Baby },
  wellbeing: { label: tx('თავის მოვლა', 'Self-care'), icon: Leaf },
};

/**
 * „ქალების სივრცე“ on the women's Home (owner 2026-10-03: the space felt lost behind one link row).
 * A compact row of the latest posts — topic, the first lines, replies and reactions — and a last
 * „დაწერე შენი“ card; a tap opens the post or the composer in the space. Pregnant women see the
 * pregnancy topic first (chosen on the device from her mode, nothing about her is sent). Only shown
 * where the launch gate allows the entry (`useCommunityEntry`); a non-member gets one „შემოუერთდი“
 * card instead of posts (the feed answers 403 until she has read the rules).
 */
export function HomeCommunitySection({ visible, pregnant }: { visible: boolean; pregnant: boolean }) {
  const router = useRouter();
  const c = useThemeColors();
  const accent = useHomeAccent();
  const topic = pregnant ? 'pregnancy' : 'all';
  const feed = useAccountQuery<PreviewPost[]>({
    key: ['community', 'homePreview', topic],
    staleTime: FRESH.SHORT,
    enabled: visible,
    fetch: async () => {
      const first = await communityRequest<{ posts: PreviewPost[] }>(`/posts?topic=${topic}&mine=false&limit=3`);
      if (first.posts.length || topic === 'all') return first.posts;
      return (await communityRequest<{ posts: PreviewPost[] }>('/posts?topic=all&mine=false&limit=3')).posts;
    },
  });
  if (!visible) return null;

  const open = (path: string) => router.push(path as never);
  const title = tx('ქალების სივრცე', "Women's space");
  const notMember = feed.isError;
  const posts = feed.data ?? [];

  return (
    <View style={s.section}>
      <HomeSectionHeading title={title} linkLabel={tx('ყველა', 'All')} onLink={() => open('/community')} />
      {notMember ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => open('/community')}
          style={[s.join, { backgroundColor: c.surface }]}
        >
          <View style={[s.tile, { backgroundColor: accent.soft }]}>
            <HeartHandshake size={21} color={accent.ink} strokeWidth={1.9} />
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={[s.joinTitle, { color: c.text100 }]}>{tx('შემოუერთდი სხვა ქალებს', 'Join other women')}</Text>
            <Text style={[s.meta, { color: c.text200 }]}>{tx('ჰკითხე, გაუზიარე — შეგიძლია ანონიმურად', 'Ask and share — anonymously if you like')}</Text>
          </View>
        </Pressable>
      ) : (
        <ScrollView
          horizontal
          nestedScrollEnabled
          showsHorizontalScrollIndicator={false}
          decelerationRate="fast"
          snapToInterval={CARD_W + CARD_GAP}
          snapToAlignment="start"
          disableIntervalMomentum
          style={{ marginHorizontal: -HUB.gutter }}
          contentContainerStyle={{ gap: CARD_GAP, paddingHorizontal: HUB.gutter }}
        >
          {feed.isPending && !posts.length
            ? [0, 1].map((i) => <View key={i} style={[s.card, { backgroundColor: c.surface }]} />)
            : posts.map((post) => {
                const t = TOPIC[post.topic ?? ''] ?? { label: title, icon: MessagesSquare };
                const Icon = t.icon;
                const reactions = Object.values(post.reactions ?? {}).reduce((a, b) => a + b, 0) || post.likes;
                const author = post.anonymous ? tx('ანონიმური', 'Anonymous') : post.author;
                return (
                  <Pressable
                    key={post.id}
                    accessibilityRole="button"
                    accessibilityLabel={`${t.label}. ${author}. ${post.body.slice(0, 120)}. ${tx(`${post.comments} პასუხი`, `${post.comments} replies`)}`}
                    onPress={() => open(`/community?post=${encodeURIComponent(post.id)}`)}
                    style={[s.card, { backgroundColor: c.surface }]}
                  >
                    <View style={s.top}>
                      <Icon size={14} color={accent.ink} strokeWidth={2} />
                      <Text numberOfLines={1} style={[s.meta, { color: accent.ink, flexShrink: 1 }]}>
                        {t.label}
                      </Text>
                      <Text numberOfLines={1} style={[s.meta, { color: c.text300, flexShrink: 1 }]}>
                        {`· ${author}`}
                      </Text>
                    </View>
                    <Text numberOfLines={2} style={[s.body, { color: c.text100 }]}>
                      {post.body.replace(/\s+/g, ' ').trim()}
                    </Text>
                    <View style={s.stats}>
                      <MessageCircle size={13} color={c.text300} strokeWidth={2} />
                      <Text style={[s.meta, { color: c.text200 }]}>{post.comments}</Text>
                      {reactions ? <Text style={[s.meta, { color: c.text200 }]}>{`· ♥ ${reactions}`}</Text> : null}
                    </View>
                  </Pressable>
                );
              })}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={tx('ახალი პოსტის დაწერა', 'Write a new post')}
            onPress={() => open('/community?compose=1')}
            style={[s.card, s.write, { backgroundColor: accent.soft }]}
          >
            <PenLine size={20} color={accent.ink} strokeWidth={2} />
            <Text style={[s.writeTitle, { color: accent.ink }]}>{tx('დაწერე შენი', 'Write yours')}</Text>
            <Text numberOfLines={2} style={[s.meta, { color: c.text200, textAlign: 'center' }]}>
              {tx('შენი სახელით ან ანონიმურად', 'With your name or anonymously')}
            </Text>
          </Pressable>
        </ScrollView>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  section: { paddingHorizontal: HUB.gutter, marginTop: HUB.sectionGap },
  card: { width: CARD_W, minHeight: 112, borderRadius: 20, padding: 14, gap: 6 },
  top: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  body: { fontFamily: 'NotoSansGeorgian_500Medium', fontSize: 14, lineHeight: 20, flex: 1 },
  stats: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  meta: { fontFamily: 'NotoSansGeorgian_500Medium', fontSize: 12, lineHeight: 16 },
  write: { width: 150, alignItems: 'center', justifyContent: 'center', gap: 4 },
  writeTitle: { fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 14, lineHeight: 19 },
  join: { borderRadius: HUB.cardRadius, padding: HUB.cardPad, flexDirection: 'row', alignItems: 'center', gap: 14 },
  joinTitle: { fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 15, lineHeight: 21 },
  tile: { width: HUB.tile, height: HUB.tile, borderRadius: HUB.tileRadius, alignItems: 'center', justifyContent: 'center' },
});
