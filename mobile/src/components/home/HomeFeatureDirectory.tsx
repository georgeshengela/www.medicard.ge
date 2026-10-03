import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import {
  Utensils,
  Activity,
  AudioLines,
  CalendarCheck,
  CalendarHeart,
  ChevronRight,
  CloudSun,
  Droplets,
  FileHeart,
  FlaskConical,
  Footprints,
  HeartHandshake,
  LayoutGrid,
  PawPrint,
  Pill,
  ScanLine,
  Scale,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Stethoscope,
  Trophy,
  Users,
  type LucideIcon,
} from 'lucide-react-native';
import { useThemeColors } from '@/theme/colors';
import { isHrefAvailable, useFeatureState } from '@/lib/featureFlags';
import { tx } from '@/i18n/locale';

type Feature = {
  title: string;
  detail: string;
  href: string;
  icon: LucideIcon;
  female?: boolean;
};
export const HOME_FEATURE_GROUPS: { title: string; items: Feature[] }[] = [
  {
    title: tx('ყოველდღიური ზრუნვა', 'Everyday care'),
    items: [
      {title:tx('კვების დღიური', 'Food diary'),detail:tx('ფოტო, შტრიხკოდი, ეტიკეტი, ძებნა და აღწერა', 'Photo, barcode, label, search and description'),href:'/nutrition',icon:Utensils},
      {
        title: tx('წამლები და განრიგი', 'Medications and schedule'),
        detail: tx('მიღება, შეხსენებები და კალენდარი', 'Doses, reminders and calendar'),
        href: '/(tabs)/medications',
        icon: Pill,
      },
      {
        title: tx('ვიზიტები', 'Visits'),
        detail: tx('შენი დაგეგმილი შეხვედრები', 'Your planned appointments'),
        href: '/visits',
        icon: CalendarCheck,
      },
      {
        title: tx('წყალი', 'Water'),
        detail: tx('აღრიცხვა და დღის პროგრესი', 'Logging and daily progress'),
        href: '/health-metrics/hydration',
        icon: Droplets,
      },
      {
        title: tx('ნაბიჯები', 'Steps'),
        detail: tx('აქტიურობა და შენი მიზანი', 'Activity and your goal'),
        href: '/health-metrics/steps',
        icon: Footprints,
      },
      {
        title: tx('წონა და მიზანი', 'Weight and goal'),
        detail: tx('ჩანაწერები და ცვლილებები', 'Entries and changes'),
        href: '/health-metrics/weight',
        icon: Scale,
      },
    ],
  },
  {
    title: tx('ქალების სივრცე', "Women's space"),
    items: [
      {
        title: tx('ციკლი და ორსულობა', 'Cycle and pregnancy'),
        detail: tx('შენი არჩეული რეჟიმი და დღიური', 'Your chosen mode and journal'),
        href: '/cycle',
        icon: CalendarHeart,
        female: true,
      },
      {
        title: tx('საზოგადოება', 'Community'),
        detail: tx('საუბარი, გამოცდილება და მხარდაჭერა', 'Conversation, experience and support'),
        href: '/community',
        icon: HeartHandshake,
        female: true,
      },
    ],
  },
  {
    title: tx('დახმარება და ანალიზი', 'Help and analysis'),
    items: [
      {
        title: tx('Medi', 'Medi'),
        detail: tx('მომიყევი ან მომწერე, რა გჭირდება', 'Tell me or write what you need'),
        href: '/assistant',
        icon: AudioLines,
      },
      {
        title: tx('რა გაწუხებს დღეს?', "What's bothering you today?"),
        detail: tx('სიმპტომების აღრიცხვა და AI დახმარება', 'Symptom log and AI help'),
        href: '/symptoms',
        icon: Stethoscope,
      },
      {
        title: tx('ლაბორატორია', 'Lab results'),
        detail: tx('შედეგები, ნორმები და Medi-ს განმარტება', 'Results, ranges and Medi explanations'),
        href: '/lab',
        icon: FlaskConical,
      },
      {
        title: tx('სამედიცინო გამოსახულება', 'Medical imaging'),
        detail: tx('გამოსახულების AI განხილვა', 'AI review of images'),
        href: '/scan?type=imaging',
        icon: ScanLine,
      },
      {
        title: tx('კანის შეფასება', 'Skin check'),
        detail: tx('ფოტოს მიხედვით AI ინფორმაცია', 'AI information from a photo'),
        href: '/scan?type=skin',
        icon: ShieldCheck,
      },
      {
        title: tx('კანის მოვლა', 'Skin care'),
        detail: tx('მოვლის შესახებ AI დახმარება', 'AI help with care routines'),
        href: '/module/skincare',
        icon: Sparkles,
      },
      {
        title: tx('ღრმა ანალიზი', 'Deep analysis'),
        detail: tx('საკითხის განხილვა რამდენიმე AI პერსპექტივით', 'A question reviewed from several AI perspectives'),
        href: '/assistant?mode=deep',
        icon: Users,
      },
    ],
  },
  {
    title: tx('ჩემი ბარათი და სერვისები', 'My card and services'),
    items: [
      {
        title: tx('ჩემი ბარათი', 'My card'),
        detail: tx('ანალიზები, დოკუმენტები და საუბრები', 'Tests, documents and conversations'),
        href: '/(tabs)/records',
        icon: FileHeart,
      },
      {
        title: tx('ჯანმრთელობის მაჩვენებლები', 'Health metrics'),
        detail: tx('გაზომვები და ცვლილებები', 'Measurements and changes'),
        href: '/health-metrics',
        icon: Activity,
      },
      {
        title: tx('აფთიაქი', 'Pharmacy'),
        detail: tx('პროდუქტების მოძებნა', 'Find products'),
        href: '/pharmacy',
        icon: ShoppingBag,
      },
      {
        title: tx('ამინდი', 'Weather'),
        detail: tx('შენი ქალაქის პროგნოზი', 'Forecast for your city'),
        href: '/weather',
        icon: CloudSun,
      },
    ],
  },
  {
    title: tx('მოძრაობა და მოტივაცია', 'Movement and motivation'),
    items: [
      {
        title: 'MEDIRUN',
        detail: tx('გაისეირნე და აღმოაჩინე ქალაქი', 'Walk and discover the city'),
        href: '/run',
        icon: Footprints,
      },
      {
        title: 'MEDIQUEST',
        detail: tx('მისიები, მიღწევები და ჯილდოები', 'Missions, achievements and rewards'),
        href: '/medi-quest',
        icon: Trophy,
      },
    ],
  },
  {
    title: tx('ცხოველებზე ზრუნვა', 'Pet care'),
    items: [
      {
        title: tx('ჩემი ცხოველები', 'My pets'),
        detail: tx('მოვლა, ჩანაწერები და MEDIVET', 'Care, records and MEDIVET'),
        href: '/pets',
        icon: PawPrint,
      },
    ],
  },
];

export function HomeFeatureDirectory({
  female,
  community = female,
  category,
}: {
  female: boolean;
  /** Women's space entry; hidden while the launch gate is closed for non-members. */
  community?: boolean;
  category?: string;
}) {
  const c = useThemeColors();
  const router = useRouter();
  const features = useFeatureState();
  return (
    <View style={{ gap: 28 }}>
      {HOME_FEATURE_GROUPS.map((group) => {
        if (category && group.title !== category) return null;
        const items = group.items.filter((item) => (!item.female || female) && (item.href !== '/community' || community) && isHrefAvailable(item.href, features));
        if (!items.length) return null;
        return (
          <View key={group.title}>
            <Text
              accessibilityRole="header"
              style={[styles.heading, { color: c.text100 }]}
            >
              {group.title}
            </Text>
            <View
              style={{
                backgroundColor: c.surface,
                borderRadius: 20,
                paddingHorizontal: 16,
              }}
            >
              {items.map((item, index) => (
                <Pressable
                  key={item.href}
                  accessibilityRole="button"
                  accessibilityLabel={`${item.title}. ${item.detail}`}
                  onPress={() => router.push(item.href as never)}
                  style={[
                    styles.row,
                    {
                      borderTopWidth: index ? StyleSheet.hairlineWidth : 0,
                      borderColor: c.bg300,
                    },
                  ]}
                >
                  <item.icon size={21} color={c.primary100} strokeWidth={1.7} />
                  <View style={{ flex: 1, gap: 4 }}>
                    <Text style={[styles.title, { color: c.text100 }]}>
                      {item.title}
                    </Text>
                    <Text style={[styles.detail, { color: c.text200 }]}>
                      {item.detail}
                    </Text>
                  </View>
                  <ChevronRight size={16} color={c.text200} />
                </Pressable>
              ))}
            </View>
          </View>
        );
      })}
    </View>
  );
}

export function HomeShortcut({
  title,
  subtitle,
  href,
  icon: Icon = LayoutGrid,
}: {
  title: string;
  subtitle?: string;
  href: string;
  icon?: LucideIcon;
}) {
  const c = useThemeColors();
  const router = useRouter();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => router.push(href as never)}
      style={[
        styles.shortcut,
        { backgroundColor: c.surface, borderColor: c.bg300 },
      ]}
    >
      <Icon size={23} strokeWidth={1.7} color={c.primary100} />
      <Text style={[styles.title, { color: c.text100 }]}>{title}</Text>
      {subtitle ? (
        <Text style={[styles.detail, { color: c.text200 }]}>{subtitle}</Text>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  heading: {
    fontFamily: 'NotoSansGeorgian_700Bold',
    fontSize: 16,
    marginBottom: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 17,
    minHeight: 76,
  },
  title: {
    fontFamily: 'NotoSansGeorgian_600SemiBold',
    fontSize: 14,
    lineHeight: 21,
  },
  detail: {
    fontFamily: 'NotoSansGeorgian_400Regular',
    fontSize: 12,
    lineHeight: 19,
  },
  shortcut: {
    flex: 1,
    minWidth: 0,
    padding: 15,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 9,
  },
});
