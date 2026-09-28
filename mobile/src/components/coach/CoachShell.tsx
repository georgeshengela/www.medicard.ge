import React from 'react';
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Dumbbell } from 'lucide-react-native';
import { CoachTabBar } from '@/components/coach/CoachVisuals';
import { useTabBarInset } from '@/components/navigation/FloatingTabBar';
import { Button, Card, ErrorBox, PrivateImage } from '@/components/coach/CoachUI';
import { useMyAvatarUrl } from '@/lib/myAvatar';
import { ApiError } from '@/lib/api';
import { HUB, hubInk, hubText, hubTint } from '@/theme/hub';
import { useIsDark, useThemeColors } from '@/theme/colors';

/**
 * The trainer workspace frame, in the Home hub language: a quiet header on the page canvas (mode switch,
 * title, one useful line), the page, and the workspace's floating tab bar (same pill as the consumer one).
 * The consumer tab bar is hidden on /coach (app/_layout.tsx).
 */
export function CoachShell({ title, subtitle, right, children, refreshing, onRefresh, scroll = true }: { title: string; subtitle?: string; right?: React.ReactNode; children: React.ReactNode; refreshing?: boolean; onRefresh?: () => void; scroll?: boolean }) {
  const c = useThemeColors();
  const dark = useIsDark();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const myPhoto = useMyAvatarUrl();
  const tabInset = useTabBarInset(28);
  const ink = hubInk('teal', dark);
  return (
    <View style={{ flex: 1, backgroundColor: c.bg100 }}>
      <View style={{ paddingTop: insets.top + 10, paddingHorizontal: HUB.gutter, paddingBottom: 4 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 36 }}>
          <View accessibilityRole="tablist" style={{ flexDirection: 'row', padding: 3, borderRadius: 18, backgroundColor: c.surface }}>
            <Pressable
              accessibilityRole="tab"
              accessibilityState={{ selected: false }}
              accessibilityLabel="პირად რეჟიმზე გადასვლა"
              onPress={() => router.replace('/(tabs)/home' as never)}
              hitSlop={6}
              style={{ paddingHorizontal: 12, minHeight: 30, borderRadius: 15, justifyContent: 'center' }}
            >
              <Text style={[hubText.caption, { color: c.text200, fontFamily: 'NotoSansGeorgian_500Medium' }]}>პირადი</Text>
            </Pressable>
            <View accessibilityRole="tab" accessibilityState={{ selected: true }} style={{ flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, minHeight: 30, borderRadius: 15, backgroundColor: hubTint(ink, dark) }}>
              <Dumbbell size={13} color={ink} strokeWidth={2.2} />
              <Text style={[hubText.caption, { color: ink, fontFamily: 'NotoSansGeorgian_600SemiBold' }]}>ტრენერი</Text>
            </View>
          </View>
          {right ?? (myPhoto ? (
            <Pressable accessibilityRole="button" accessibilityLabel="ჩემი ტრენერის პროფილი" onPress={() => router.replace('/coach/profile' as never)}>
              <PrivateImage path={myPhoto} label="ჩემი ფოტო" style={{ width: 44, height: 44, borderRadius: 22 }} />
            </Pressable>
          ) : null)}
        </View>
        <Text accessibilityRole="header" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={{ fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 24, lineHeight: 32, letterSpacing: -0.3, color: c.text100, marginTop: 14 }}>{title}</Text>
        {subtitle ? <Text numberOfLines={2} style={[hubText.body, { color: c.text200, marginTop: 2 }]}>{subtitle}</Text> : null}
      </View>
      {scroll ? (
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: HUB.gutter, paddingBottom: tabInset }}
          keyboardShouldPersistTaps="handled"
          refreshControl={onRefresh ? <RefreshControl refreshing={Boolean(refreshing)} onRefresh={onRefresh} tintColor={c.primary200} /> : undefined}
        >
          {children}
        </ScrollView>
      ) : (
        <View style={{ flex: 1, paddingBottom: tabInset }}>{children}</View>
      )}
      <CoachTabBar />
    </View>
  );
}

/** Shown when the API says the person is not (yet) a verified trainer. */
export function CoachGate({ error }: { error: ApiError | Error | null }) {
  const router = useRouter();
  const c = useThemeColors();
  const code = error instanceof ApiError ? error.code : undefined;
  if (code === 'TRAINER_REQUIRED' || code === 'TRAINER_NOT_VERIFIED') {
    return (
      <Card style={{ marginTop: 16, gap: 10 }}>
        <Text style={[hubText.cardTitle, { color: c.text100 }]}>{code === 'TRAINER_REQUIRED' ? 'ტრენერის პროფილი არ გაქვს' : 'პროფილი ჯერ დადასტურებული არ არის'}</Text>
        <Text style={[hubText.body, { color: c.text200 }]}>{error?.message}</Text>
        <Button label="ტრენერის განაცხადი" onPress={() => router.replace('/trainer/apply' as never)} />
      </Card>
    );
  }
  return error ? <ErrorBox message={error.message || 'ჩატვირთვა ვერ მოხერხდა.'} /> : null;
}

