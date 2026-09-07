import React, { useCallback, useEffect, useState } from 'react';
import { Modal, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft, Sparkles } from 'lucide-react-native';
import { MediCompanionHome } from '@/components/companion/MediCompanionHome';
import { Bone } from '@/components/ui/Skeleton';
import { APP_MODAL_PROPS } from '@/components/ui/appModal';
import { companionApi, type CompanionOverview } from '@/lib/companion/api';
import {
  readCompanionCache,
  requestCompanionRefresh,
  subscribeCompanionRefresh,
  writeCompanionCache,
} from '@/lib/companion/cache';
import { companionCopy } from '@/lib/companion/copy';
import {
  COMPANION_DEV_LABELS,
  COMPANION_DEV_SCENARIOS,
  applyCompanionDevView,
  getCompanionDevScenario,
  isCompanionDevEnabled,
  setCompanionDevScenario,
  subscribeCompanionDevScenario,
  type CompanionDevScenario,
} from '@/lib/companion/devFixtures';
import { useOffline } from '@/hooks/useOffline';
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';
import { trackQuestEvent } from '@/lib/productObservability';
import { QUEST } from '@/theme/questTokens';
import { useIsDark, useThemeColors } from '@/theme/colors';

const LOCALE = 'ka';

export default function MediCompanionScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ fixture?: string }>();
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const dark = useIsDark();
  const offline = useOffline();
  const reduce = usePrefersReducedMotion();
  const copy = companionCopy(LOCALE);

  const [overview, setOverview] = useState<CompanionOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [stale, setStale] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [devScenario, setDevScenario] = useState<CompanionDevScenario>(() =>
    isCompanionDevEnabled() ? getCompanionDevScenario() : 'LIVE',
  );
  const [devOpen, setDevOpen] = useState(false);

  useEffect(() => {
    if (!isCompanionDevEnabled()) return;
    const raw = typeof params.fixture === 'string' ? params.fixture : '';
    if (!raw) return;
    setCompanionDevScenario(raw.toUpperCase());
  }, [params.fixture]);

  const refresh = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const next = await companionApi.overview({ reducedMotion: reduce });
      setOverview(next);
      setStale(false);
      setError(false);
      await writeCompanionCache(next);
      if (next.journey?.newlyUnlockedKeys?.length) {
        const { presentJourneyUnlocks } = await import('@/lib/companion/journeyCelebration');
        presentJourneyUnlocks(next.journey.newlyUnlockedKeys);
      }
    } catch {
      const cached = await readCompanionCache();
      if (cached) {
        setOverview(cached.overview);
        setStale(true);
        setError(false);
      } else {
        setError(true);
      }
    } finally {
      setLoading(false);
    }
  }, [reduce]);

  useEffect(() => {
    void trackQuestEvent('medi_companion_opened');
  }, []);

  useEffect(() => {
    if (!isCompanionDevEnabled()) return;
    const off = subscribeCompanionDevScenario(setDevScenario);
    return () => {
      off();
    };
  }, []);

  useFocusEffect(
    useCallback(() => {
      void refresh(true);
      return subscribeCompanionRefresh(() => {
        void refresh(true);
      });
    }, [refresh]),
  );

  const presented = applyCompanionDevView({
    overview,
    loading,
    error,
    stale,
    scenario: isCompanionDevEnabled() ? devScenario : 'LIVE',
  });

  useEffect(() => {
    if (!isCompanionDevEnabled() || devScenario === 'LIVE') return;
    const keys = presented.overview?.journey?.newlyUnlockedKeys;
    if (!keys?.length) return;
    void import('@/lib/companion/journeyCelebration').then(({ presentJourneyUnlocks }) => {
      presentJourneyUnlocks(keys, `dev:${devScenario}:${Date.now()}`);
    });
    // Intentionally only when scenario changes — fixture object identity churns every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [devScenario]);

  const onRefresh = async () => {
    setRefreshing(true);
    await refresh(true);
    setRefreshing(false);
  };

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
          accessibilityLabel="Back"
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
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 18, color: colors.text100 }}>
            {copy.title}
          </Text>
          <Text style={{ fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 12, color: colors.text300 }}>
            {copy.subtitle}
          </Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 32, gap: 12 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} tintColor={QUEST.accent.medi} />}
      >
        {presented.loading && !presented.overview ? (
          <View style={{ gap: 12 }}>
            <Bone height={220} radius={QUEST.radius} />
            <Bone height={52} radius={QUEST.rowRadius} />
            <Bone height={52} radius={QUEST.rowRadius} />
          </View>
        ) : presented.error || !presented.overview ? (
          <View
            style={{
              padding: QUEST.pad,
              borderRadius: QUEST.radius,
              backgroundColor: dark ? colors.surface : '#FFFFFF',
              borderWidth: 1,
              borderColor: colors.bg300,
              gap: 10,
            }}
          >
            <Text style={{ fontFamily: 'NotoSansGeorgian_500Medium', fontSize: 15, color: colors.text200 }}>
              {copy.loadError}
            </Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => void refresh()}
              style={{ minHeight: 44, justifyContent: 'center' }}
            >
              <Text style={{ fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 14, color: colors.primary200 }}>
                {copy.retry}
              </Text>
            </Pressable>
          </View>
        ) : (
          <MediCompanionHome
            overview={presented.overview}
            locale={LOCALE}
            offline={offline || presented.fixtureOffline || presented.stale}
            reducedMotion={reduce}
          />
        )}
      </ScrollView>

      {isCompanionDevEnabled() ? (
        <>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="DEV Companion"
            onPress={() => setDevOpen(true)}
            style={{
              position: 'absolute',
              right: 16,
              bottom: insets.bottom + 24,
              width: 48,
              height: 48,
              borderRadius: 24,
              backgroundColor: '#0D9488',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 20,
            }}
          >
            <Sparkles size={20} color="#FFFFFF" strokeWidth={2.2} />
          </Pressable>
          <Modal visible={devOpen} {...APP_MODAL_PROPS} onRequestClose={() => setDevOpen(false)}>
            <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' }} onPress={() => setDevOpen(false)}>
              <View
                style={{
                  marginTop: 'auto',
                  maxHeight: '80%',
                  backgroundColor: colors.surface,
                  borderTopLeftRadius: 20,
                  borderTopRightRadius: 20,
                  padding: 20,
                }}
              >
                <Text style={{ fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 18, color: colors.text100 }}>
                  Companion QA
                </Text>
                <ScrollView style={{ marginTop: 12 }}>
                  {COMPANION_DEV_SCENARIOS.map((key) => (
                    <Pressable
                      key={key}
                      onPress={() => {
                        setCompanionDevScenario(key);
                        setDevOpen(false);
                      }}
                      style={{
                        minHeight: 44,
                        justifyContent: 'center',
                        borderBottomWidth: 1,
                        borderBottomColor: colors.bg200,
                      }}
                    >
                      <Text
                        style={{
                          fontFamily: 'NotoSansGeorgian_500Medium',
                          fontSize: 14,
                          color: key === devScenario ? colors.primary200 : colors.text100,
                        }}
                      >
                        {COMPANION_DEV_LABELS[key]}
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>
            </Pressable>
          </Modal>
        </>
      ) : null}
    </View>
  );
}
