import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { Tabs, Link, usePathname } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CalendarClock, FolderHeart, House, User, type LucideIcon } from 'lucide-react-native';
import { ka } from '@/i18n/ka';
import { useThemeColors } from '@/theme/colors';

const TAB_HEIGHT = 58;

type TabDef = {
  name: 'home' | 'records' | 'medications' | 'profile';
  href: '/home' | '/records' | '/medications' | '/profile';
  title: string;
  Icon: LucideIcon;
};

const TABS: TabDef[] = [
  { name: 'home', href: '/home', title: ka.tabs.home, Icon: House },
  { name: 'records', href: '/records', title: ka.tabs.records, Icon: FolderHeart },
  { name: 'medications', href: '/medications', title: ka.tabs.medications, Icon: CalendarClock },
  { name: 'profile', href: '/profile', title: ka.tabs.profile, Icon: User },
];

/**
 * Expo Router `Link`-based tab chrome.
 * Avoids React Navigation custom tab button / screens hit-testing bugs that
 * were swallowing presses on the bottom bar in Expo Go (SDK 54).
 */
function MedicardTabBar() {
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const pathname = usePathname();

  return (
    <View
      style={{
        backgroundColor: colors.surfaceRaised,
        borderTopWidth: 1,
        borderTopColor: colors.bg300,
        paddingBottom: Math.max(insets.bottom, 8),
        paddingTop: 6,
        flexDirection: 'row',
      }}
    >
      {TABS.map(({ href, title, Icon }) => {
        const focused =
          pathname === href ||
          pathname.startsWith(`${href}/`) ||
          (href === '/home' && (pathname === '/' || pathname === '/home'));
        const color = focused ? colors.primary200 : colors.text300;

        return (
          <Link key={href} href={href} asChild>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected: focused }}
              accessibilityLabel={title}
              style={{
                flex: 1,
                height: TAB_HEIGHT,
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: 16,
                marginHorizontal: 4,
                backgroundColor: focused ? colors.accent100 : 'transparent',
              }}
            >
              <Icon size={22} color={color} strokeWidth={focused ? 2.45 : 1.85} />
              <Text
                numberOfLines={1}
                style={{
                  marginTop: 3,
                  fontSize: 10,
                  lineHeight: 14,
                  fontWeight: focused ? '700' : '600',
                  color,
                }}
              >
                {title}
              </Text>
            </Pressable>
          </Link>
        );
      })}
    </View>
  );
}

export default function TabsLayout() {
  const colors = useThemeColors();

  return (
    <Tabs
      tabBar={() => <MedicardTabBar />}
      detachInactiveScreens={false}
      screenOptions={{
        headerStyle: { backgroundColor: colors.bg100 },
        headerTitleStyle: { color: colors.text100, fontSize: 17, fontWeight: '700' },
        headerShadowVisible: false,
        headerTintColor: colors.primary200,
        sceneStyle: { backgroundColor: colors.bg100 },
      }}
    >
      <Tabs.Screen name="home" options={{ title: ka.tabs.home, headerShown: false }} />
      <Tabs.Screen name="records" options={{ title: ka.tabs.records, headerTitle: ka.records.title }} />
      <Tabs.Screen
        name="medications"
        options={{ title: ka.tabs.medications, headerTitle: ka.meds.title }}
      />
      <Tabs.Screen name="profile" options={{ title: ka.tabs.profile, headerTitle: ka.profile.title }} />
    </Tabs>
  );
}
