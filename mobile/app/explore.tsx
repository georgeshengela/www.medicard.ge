import React, { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  HOME_FEATURE_GROUPS,
  HomeFeatureDirectory,
} from '@/components/home/HomeFeatureDirectory';
import { useThemeColors } from '@/theme/colors';
import { useAuth } from '@/store/AuthContext';

export default function Explore() {
  const c = useThemeColors(),
    insets = useSafeAreaInsets(),
    router = useRouter();
  const { user } = useAuth();
  const [category, setCategory] = useState<string | undefined>();
  const categories = HOME_FEATURE_GROUPS.filter((group) =>
    group.items.some((item) => !item.female || user?.gender === 'FEMALE'),
  );
  const selected = categories.some((group) => group.title === category)
    ? category
    : undefined;
  return (
    <View style={{ flex: 1, backgroundColor: c.bg100, paddingTop: insets.top }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          paddingHorizontal: 16,
          paddingVertical: 8,
        }}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="უკან"
          onPress={() =>
            router.canGoBack() ? router.back() : router.replace('/(tabs)/home')
          }
          style={{
            minWidth: 44,
            minHeight: 44,
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: 22,
            backgroundColor: c.surface,
          }}
        >
          <ArrowLeft size={22} color={c.text100} />
        </Pressable>
        <Text
          accessibilityRole="header"
          style={{
            flex: 1,
            fontFamily: 'NotoSansGeorgian_700Bold',
            fontSize: 20,
            color: c.text100,
          }}
        >
          ყველა შესაძლებლობა
        </Text>
      </View>
      <ScrollView
        contentContainerStyle={{
          width: '100%',
          maxWidth: 760,
          alignSelf: 'center',
          padding: 20,
          paddingBottom: insets.bottom + 40,
        }}
        showsVerticalScrollIndicator={false}
      >
        <Text
          style={{
            fontFamily: 'NotoSansGeorgian_400Regular',
            fontSize: 14,
            lineHeight: 22,
            color: c.text200,
            marginBottom: 26,
          }}
        >
          აირჩიე, რაში გჭირდება დახმარება. შენი ჩანაწერები და საყვარელი
          ფუნქციები ერთ სივრცეშია.
        </Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8, paddingBottom: 22 }}
        >
          {[undefined, ...categories.map((group) => group.title)].map(
            (label) => (
              <Pressable
                key={label ?? 'all'}
                accessibilityRole="button"
                accessibilityState={{ selected: selected === label }}
                onPress={() => setCategory(label)}
                style={{
                  minHeight: 44,
                  justifyContent: 'center',
                  paddingHorizontal: 15,
                  borderRadius: 22,
                  backgroundColor: selected === label ? c.accent100 : c.surface,
                  borderWidth: 1,
                  borderColor: selected === label ? c.primary100 : c.bg300,
                }}
              >
                <Text
                  style={{
                    fontFamily: 'NotoSansGeorgian_600SemiBold',
                    fontSize: 12,
                    color: selected === label ? c.primary100 : c.text200,
                  }}
                >
                  {label ?? 'ყველა'}
                </Text>
              </Pressable>
            ),
          )}
        </ScrollView>
        <HomeFeatureDirectory
          female={user?.gender === 'FEMALE'}
          category={selected}
        />
      </ScrollView>
    </View>
  );
}
