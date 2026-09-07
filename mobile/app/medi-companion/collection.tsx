import React, { useCallback, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft } from 'lucide-react-native';
import { MediCollectionSheet } from '@/components/companion/MediCollectionSheet';
import { Bone } from '@/components/ui/Skeleton';
import {
  companionApi,
  type CompanionCosmetic,
  type CompanionEquipment,
} from '@/lib/companion/api';
import { readCompanionCache, writeCompanionCache } from '@/lib/companion/cache';
import { companionCopy } from '@/lib/companion/copy';
import {
  applyCompanionDevView,
  getCompanionDevScenario,
  isCompanionDevEnabled,
} from '@/lib/companion/devFixtures';
import { useOffline } from '@/hooks/useOffline';
import { QUEST } from '@/theme/questTokens';
import { useIsDark, useThemeColors } from '@/theme/colors';

const LOCALE = 'ka';

const EMPTY_EQUIP: CompanionEquipment = {
  accent: 'COSMETIC_DEFAULT_ACCENT',
  accessory: null,
  background: 'COSMETIC_DEFAULT_BACKGROUND',
  decoration: null,
};

export default function MediCompanionCollectionScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const dark = useIsDark();
  const offline = useOffline();
  const copy = companionCopy(LOCALE);

  const [equipment, setEquipment] = useState<CompanionEquipment>(EMPTY_EQUIP);
  const [collection, setCollection] = useState<CompanionCosmetic[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [stale, setStale] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const refresh = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      if (isCompanionDevEnabled() && getCompanionDevScenario() !== 'LIVE') {
        const presented = applyCompanionDevView({
          overview: null,
          loading: false,
          error: false,
          stale: false,
          scenario: getCompanionDevScenario(),
        });
        if (presented.error) {
          setError(true);
          setCollection([]);
        } else if (presented.overview) {
          setEquipment(presented.overview.equipment);
          setCollection(presented.overview.collection);
          setError(false);
          setStale(presented.stale);
        }
        return;
      }
      const res = await companionApi.collection();
      setEquipment(res.equipment);
      setCollection(res.collection);
      setError(false);
      setStale(false);
      const cached = await readCompanionCache();
      if (cached?.overview) {
        await writeCompanionCache({
          ...cached.overview,
          equipment: res.equipment,
          collection: res.collection,
        });
      }
    } catch {
      const cached = await readCompanionCache();
      if (cached?.overview) {
        setEquipment(cached.overview.equipment);
        setCollection(cached.overview.collection);
        setStale(true);
        setError(false);
      } else {
        setError(true);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void refresh(true);
    }, [refresh]),
  );

  return (
    <View style={{ flex: 1, backgroundColor: dark ? colors.bg100 : colors.bg100 }}>
      <View
        style={{
          paddingTop: insets.top + 8,
          paddingHorizontal: 16,
          paddingBottom: 8,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <Pressable
          accessibilityRole="button"
          onPress={() => router.back()}
          className="active:opacity-90"
          style={{
            width: 40,
            height: 40,
            borderRadius: 20,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: dark ? colors.surface : '#FFFFFF',
            borderWidth: 1,
            borderColor: colors.bg300,
          }}
        >
          <ArrowLeft size={20} color={colors.text100} strokeWidth={2.2} />
        </Pressable>
        <Text style={{ flex: 1, fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 18, color: colors.text100 }}>
          {copy.collection}
        </Text>
      </View>

      {(offline || stale) && !loading ? (
        <Text
          style={{
            paddingHorizontal: 16,
            marginBottom: 4,
            fontFamily: 'NotoSansGeorgian_400Regular',
            fontSize: 12,
            color: colors.text300,
          }}
        >
          {copy.offline}
        </Text>
      ) : null}

      {loading && collection.length === 0 ? (
        <ScrollView contentContainerStyle={{ padding: 16, gap: 10 }}>
          <Bone height={36} radius={999} />
          <Bone height={64} radius={QUEST.rowRadius} />
          <Bone height={64} radius={QUEST.rowRadius} />
        </ScrollView>
      ) : error ? (
        <Pressable onPress={() => void refresh()} style={{ padding: 16, minHeight: 44 }}>
          <Text style={{ fontFamily: 'NotoSansGeorgian_500Medium', fontSize: 14, color: colors.text200 }}>
            {copy.loadError}
          </Text>
          <Text style={{ marginTop: 6, fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 14, color: colors.primary200 }}>
            {copy.retry}
          </Text>
        </Pressable>
      ) : (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ flexGrow: 1, paddingBottom: insets.bottom + 16 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={async () => {
                setRefreshing(true);
                await refresh(true);
                setRefreshing(false);
              }}
              tintColor={QUEST.accent.medi}
            />
          }
        >
          <MediCollectionSheet
            visible
            inline
            onClose={() => router.back()}
            equipment={equipment}
            collection={collection}
            locale={LOCALE}
            onEquipmentChange={setEquipment}
          />
        </ScrollView>
      )}
    </View>
  );
}
