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

type Feature = {
  title: string;
  detail: string;
  href: string;
  icon: LucideIcon;
  female?: boolean;
};
export const HOME_FEATURE_GROUPS: { title: string; items: Feature[] }[] = [
  {
    title: 'ყოველდღიური ზრუნვა',
    items: [
      {title:'კვების დღიური',detail:'ფოტო, კალორიები და საკვები ნივთიერებები',href:'/nutrition',icon:Utensils},
      {
        title: 'წამლები და განრიგი',
        detail: 'მიღება, შეხსენებები და კალენდარი',
        href: '/(tabs)/medications',
        icon: Pill,
      },
      {
        title: 'ვიზიტები',
        detail: 'შენი დაგეგმილი შეხვედრები',
        href: '/visits',
        icon: CalendarCheck,
      },
      {
        title: 'წყალი',
        detail: 'აღრიცხვა და დღის პროგრესი',
        href: '/health-metrics/hydration',
        icon: Droplets,
      },
      {
        title: 'ნაბიჯები',
        detail: 'აქტიურობა და შენი მიზანი',
        href: '/health-metrics/steps',
        icon: Footprints,
      },
      {
        title: 'წონა და მიზანი',
        detail: 'ჩანაწერები და ცვლილებები',
        href: '/health-metrics/weight',
        icon: Scale,
      },
    ],
  },
  {
    title: 'ქალების სივრცე',
    items: [
      {
        title: 'ციკლი და ორსულობა',
        detail: 'შენი არჩეული რეჟიმი და დღიური',
        href: '/cycle',
        icon: CalendarHeart,
        female: true,
      },
      {
        title: 'საზოგადოება',
        detail: 'საუბარი, გამოცდილება და მხარდაჭერა',
        href: '/community',
        icon: HeartHandshake,
        female: true,
      },
    ],
  },
  {
    title: 'დახმარება და ანალიზი',
    items: [
      {
        title: 'მედი',
        detail: 'მომიყევი ან მომწერე, რა გჭირდება',
        href: '/assistant',
        icon: AudioLines,
      },
      {
        title: 'რა გაწუხებს დღეს?',
        detail: 'სიმპტომების აღრიცხვა და AI დახმარება',
        href: '/symptoms',
        icon: Stethoscope,
      },
      {
        title: 'ლაბორატორიული ანალიზი',
        detail: 'შედეგების AI განმარტება',
        href: '/module/lab',
        icon: FlaskConical,
      },
      {
        title: 'სამედიცინო გამოსახულება',
        detail: 'გამოსახულების AI განხილვა',
        href: '/module/imaging',
        icon: ScanLine,
      },
      {
        title: 'კანის შეფასება',
        detail: 'ფოტოს მიხედვით AI ინფორმაცია',
        href: '/module/skin',
        icon: ShieldCheck,
      },
      {
        title: 'კანის მოვლა',
        detail: 'მოვლის შესახებ AI დახმარება',
        href: '/module/skincare',
        icon: Sparkles,
      },
      {
        title: 'AI კონსილიუმი',
        detail: 'საკითხის განხილვა რამდენიმე AI პერსპექტივით',
        href: '/chat/consilium',
        icon: Users,
      },
    ],
  },
  {
    title: 'ისტორია და სერვისები',
    items: [
      {
        title: 'ჩემი ჩანაწერები',
        detail: 'დოკუმენტები და საუბრის ისტორია',
        href: '/(tabs)/records',
        icon: FileHeart,
      },
      {
        title: 'ჯანმრთელობის მაჩვენებლები',
        detail: 'გაზომვები და ცვლილებები',
        href: '/health-metrics',
        icon: Activity,
      },
      {
        title: 'ლაბორატორიული ისტორია',
        detail: 'შენახული შედეგები დროთა განმავლობაში',
        href: '/lab',
        icon: FlaskConical,
      },
      {
        title: 'აფთიაქი',
        detail: 'პროდუქტების მოძებნა',
        href: '/pharmacy',
        icon: ShoppingBag,
      },
      {
        title: 'ამინდი',
        detail: 'შენი ქალაქის პროგნოზი',
        href: '/weather',
        icon: CloudSun,
      },
    ],
  },
  {
    title: 'მოძრაობა და მოტივაცია',
    items: [
      {
        title: 'MEDIRUN',
        detail: 'გაისეირნე და აღმოაჩინე ქალაქი',
        href: '/run',
        icon: Footprints,
      },
      {
        title: 'MEDI QUEST',
        detail: 'მისიები, მიღწევები და ჯილდოები',
        href: '/medi-quest',
        icon: Trophy,
      },
    ],
  },
  {
    title: 'ცხოველებზე ზრუნვა',
    items: [
      {
        title: 'ჩემი ცხოველები',
        detail: 'მოვლა, ჩანაწერები და Medi Vet',
        href: '/pets',
        icon: PawPrint,
      },
    ],
  },
];

export function HomeFeatureDirectory({
  female,
  category,
}: {
  female: boolean;
  category?: string;
}) {
  const c = useThemeColors();
  const router = useRouter();
  return (
    <View style={{ gap: 28 }}>
      {HOME_FEATURE_GROUPS.map((group) => {
        if (category && group.title !== category) return null;
        const items = group.items.filter((item) => !item.female || female);
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
