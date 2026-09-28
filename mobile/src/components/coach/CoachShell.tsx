import React from 'react';
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeftRight } from 'lucide-react-native';
import { CoachTabBar } from '@/components/coach/CoachVisuals';
import { Button, Card, ErrorBox } from '@/components/coach/CoachUI';
import { ApiError } from '@/lib/api';
import { HUB, hubText } from '@/theme/hub';
import { useThemeColors } from '@/theme/colors';

/**
 * The trainer workspace frame: a dark "MEDI COACH" band that makes the mode obvious, the page, and
 * the workspace's own tab bar. The consumer tab bar is hidden on /coach (app/_layout.tsx).
 */
export function CoachShell({ title, subtitle, right, children, refreshing, onRefresh, scroll = true }: { title: string; subtitle?: string; right?: React.ReactNode; children: React.ReactNode; refreshing?: boolean; onRefresh?: () => void; scroll?: boolean }) {
  const c = useThemeColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  return (
    <View style={{ flex: 1, backgroundColor: c.bg100 }}>
      <View style={{ backgroundColor: HUB.spotlightBg, paddingTop: insets.top + 6, paddingHorizontal: HUB.gutter, paddingBottom: 16, borderBottomLeftRadius: 24, borderBottomRightRadius: 24 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 36 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <View style={{ backgroundColor: '#99F6E4', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 1 }}>
              <Text style={{ fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 10, color: '#042F2E', letterSpacing: 1 }}>COACH</Text>
            </View>
            <Text style={[hubText.caption, { color: '#C5DADA' }]}>ტრენერის რეჟიმი</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="პირად რეჟიმზე გადასვლა"
            onPress={() => router.replace('/(tabs)/home' as never)}
            hitSlop={8}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 14, paddingHorizontal: 10, paddingVertical: 6 }}
          >
            <ArrowLeftRight size={14} color="#FFFFFF" />
            <Text style={[hubText.small, { color: '#FFFFFF', fontFamily: 'NotoSansGeorgian_600SemiBold' }]}>პირადი</Text>
          </Pressable>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 10, gap: 12 }}>
          <View style={{ flex: 1 }}>
            <Text accessibilityRole="header" style={{ fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 26, lineHeight: 34, color: '#FFFFFF' }}>{title}</Text>
            {subtitle ? <Text style={[hubText.body, { color: '#C5DADA' }]}>{subtitle}</Text> : null}
          </View>
          {right}
        </View>
      </View>
      {scroll ? (
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: HUB.gutter, paddingBottom: 28 }}
          keyboardShouldPersistTaps="handled"
          refreshControl={onRefresh ? <RefreshControl refreshing={Boolean(refreshing)} onRefresh={onRefresh} tintColor={c.primary200} /> : undefined}
        >
          {children}
        </ScrollView>
      ) : (
        <View style={{ flex: 1 }}>{children}</View>
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

