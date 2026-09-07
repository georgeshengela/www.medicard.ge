import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft } from 'lucide-react-native';
import { MediJourneyPath } from '@/components/companion/MediJourneyPath';
import { Bone } from '@/components/ui/Skeleton';
import { companionApi, type CompanionJourney } from '@/lib/companion/api';
import { readCompanionCache, writeCompanionCache } from '@/lib/companion/cache';
import { companionCopy } from '@/lib/companion/copy';
import {
  applyCompanionDevView,
  getCompanionDevScenario,
  isCompanionDevEnabled,
} from '@/lib/companion/devFixtures';
import { useOffline } from '@/hooks/useOffline';
import { trackQuestEvent } from '@/lib/productObservability';
import { QUEST } from '@/theme/questTokens';
import { useIsDark, useThemeColors } from '@/theme/colors';

const LOCALE = 'ka';

export default function MediCompanionJourneyScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const dark = useIsDark();
  const offline = useOffline();
  const copy = companionCopy(LOCALE);

  const [journey, setJourney] = useState<CompanionJourney | null>(null);
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
          setJourney(null);
        } else if (presented.overview) {
          setJourney(presented.overview.journey);
          setError(false);
          setStale(presented.stale);
        }
        return;
      }
      const res = await companionApi.journey();
      setJourney(res.journey);
      setError(false);
      setStale(false);
      const cached = await readCompanionCache();
      if (cached?.overview) {
        await writeCompanionCache({
          ...cached.overview,
          journey: res.journey,
          companion: {
            ...cached.overview.companion,
            level: res.companion.level,
            stage: res.companion.stage,
            moodKey: res.companion.moodKey,
          },
        });
      }
    } catch {
      const cached = await readCompanionCache();
      if (cached?.overview?.journey) {
        setJourney(cached.overview.journey);
        setStale(true);
        setError(false);
      } else {
        setError(true);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void trackQuestEvent('medi_journey_opened');
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
          {copy.journey}
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 32 }}
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
        {(offline || stale) && journey ? (
          <Text
            style={{
              marginBottom: 10,
              fontFamily: 'NotoSansGeorgian_400Regular',
              fontSize: 12,
              color: colors.text300,
            }}
          >
            {copy.offline}
          </Text>
        ) : null}

        {loading && !journey ? (
          <View style={{ gap: 10 }}>
            <Bone height={88} radius={QUEST.radius} />
            <Bone height={64} radius={QUEST.rowRadius} />
            <Bone height={64} radius={QUEST.rowRadius} />
            <Bone height={64} radius={QUEST.rowRadius} />
          </View>
        ) : error || !journey ? (
          <Pressable onPress={() => void refresh()} style={{ minHeight: 44, justifyContent: 'center' }}>
            <Text style={{ fontFamily: 'NotoSansGeorgian_500Medium', fontSize: 14, color: colors.text200 }}>
              {copy.loadError}
            </Text>
            <Text style={{ marginTop: 6, fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 14, color: colors.primary200 }}>
              {copy.retry}
            </Text>
          </Pressable>
        ) : (
          <MediJourneyPath journey={journey} locale={LOCALE} />
        )}
      </ScrollView>
    </View>
  );
}
