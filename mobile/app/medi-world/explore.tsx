import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Linking, Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft, List, MapPinned, Settings2 } from 'lucide-react-native';
import { APP_MODAL_OVERLAY, APP_MODAL_PROPS } from '@/components/ui/appModal';
import { ExploreMap, type ExploreMapHandle } from '@/components/world/ExploreMap';
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';
import { exploreCopy, exploreOutcomeText } from '@/i18n/world/explore.js';
import { ApiError } from '@/lib/api';
import { mediWorldApi } from '@/lib/mediWorld/api';
import {
  getExploreIntroSeen,
  getExplorePermExplained,
  getExploreViewPref,
  readExploreAreaCache,
  setExploreIntroSeen,
  setExplorePermExplained,
  setExploreViewPref,
  writeExploreAreaCache,
} from '@/lib/mediWorld/exploreCache';
import { coarseAreaKey } from '@/lib/mediWorld/exploreGeo';
import { applyExploreCollectResult, isExploreCollectLocked } from '@/lib/mediWorld/exploreCollectUi';
import {
  collectSampleRejectReason,
  getExploreLocationProbe,
  getExplorePermission,
  isMotorized,
  readCollectSample,
  readExploreFix,
  requestExploreForegroundPermission,
  startExploreWatch,
  stopExploreWatch,
  type ExploreFix,
  type ExploreLocationProbe,
  type ExploreLocationState,
  type ExplorePermission,
} from '@/lib/mediWorld/exploreLocation';
import { useMediWorldExploreAvailable } from '@/lib/mediWorld/enabled';
import type { ExploreAreaResponse, ExploreConfigResponse, ExplorePlace } from '@/lib/mediWorld/types';
import { QUEST } from '@/theme/questTokens';
import { useIsDark, useThemeColors } from '@/theme/colors';

const FONT = 1.3;

function placeTypeKey(type: string) {
  if (type === 'park') return 'placeTypePark' as const;
  if (type === 'public_square') return 'placeTypeSquare' as const;
  if (type === 'public_garden') return 'placeTypeGarden' as const;
  if (type === 'promenade') return 'placeTypePromenade' as const;
  if (type === 'trail_entrance') return 'placeTypeTrail' as const;
  return 'placeTypeCommunity' as const;
}

function sparkKey(category: string) {
  if (category === 'movement') return 'sparkMovement' as const;
  if (category === 'hydration') return 'sparkHydration' as const;
  if (category === 'calm') return 'sparkCalm' as const;
  if (category === 'care') return 'sparkCare' as const;
  return 'sparkConnection' as const;
}

export default function ExploreScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const dark = useIsDark();
  const reduce = usePrefersReducedMotion();
  const enabled = useMediWorldExploreAvailable();
  const [locale, setLocale] = useState<'ka' | 'en'>('ka');
  const copy = useMemo(() => exploreCopy(locale), [locale]);
  const mapRef = useRef<ExploreMapHandle>(null);
  const areaRef = useRef<ExploreAreaResponse | null>(null);
  const selectedRef = useRef<ExplorePlace | null>(null);
  const [step, setStep] = useState<'boot' | 'intro' | 'permission' | 'explore'>('boot');
  const [view, setView] = useState<'map' | 'list'>('map');
  const [mapFailed, setMapFailed] = useState(false);
  const [permission, setPermission] = useState<ExplorePermission>('undetermined');
  const [locState, setLocState] = useState<ExploreLocationState>('idle');
  const [fix, setFix] = useState<ExploreFix | null>(null);
  const [area, setArea] = useState<ExploreAreaResponse | null>(null);
  const [config, setConfig] = useState<ExploreConfigResponse | null>(null);
  const [selected, setSelected] = useState<ExplorePlace | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [outcome, setOutcome] = useState<string | null>(null);
  const [offline, setOffline] = useState(false);
  const [probe, setProbe] = useState<ExploreLocationProbe | null>(null);
  const collectInFlight = useRef(false);
  areaRef.current = area;
  selectedRef.current = selected;
  const fontTitle = { fontFamily: 'NotoSansGeorgian_700Bold' as const };
  const fontBody = { fontFamily: 'NotoSansGeorgian_400Regular' as const };
  const fontMed = { fontFamily: 'NotoSansGeorgian_500Medium' as const };

  useEffect(() => {
    void (async () => {
      const intro = await getExploreIntroSeen();
      const explained = await getExplorePermExplained();
      const pref = await getExploreViewPref();
      setView(pref);
      const perm = await getExplorePermission();
      setPermission(perm);
      if (!intro) setStep('intro');
      else if (!explained && perm !== 'granted') setStep('permission');
      else setStep('explore');
    })();
  }, []);

  const loadArea = useCallback(
    async (nextFix: ExploreFix | null, allowCache = true) => {
      if (!enabled) return;
      try {
        const cfg = await mediWorldApi.exploreConfig();
        setConfig(cfg);
        if (cfg.mapUnavailable) {
          setMapFailed(true);
          setView('list');
        }
        const key = nextFix ? coarseAreaKey(nextFix.latitude, nextFix.longitude) : area?.coarseAreaKey;
        if (!key) {
          if (allowCache) {
            const cached = await readExploreAreaCache();
            if (cached) {
              setArea(cached);
              setOffline(true);
            }
          }
          return;
        }
        const live = await mediWorldApi.exploreArea(key, locale);
        setArea(live);
        setOffline(false);
        setSelected((prev) => {
          if (!prev) return prev;
          const fresh = live.places.find((row) => row.id === prev.id);
          return fresh || prev;
        });
        await writeExploreAreaCache(live);
      } catch (error) {
        if (allowCache) {
          const cached = await readExploreAreaCache();
          if (cached) {
            setArea(cached);
            setOffline(true);
          }
        }
        if (error instanceof ApiError && (error.code === 'EXPLORE_DISABLED' || error.code === 'MEDI_WORLD_DISABLED')) {
          setConfig(null);
        }
      }
    },
    [area?.coarseAreaKey, enabled, locale],
  );

  const locateAndLoad = useCallback(
    async (startWatch: boolean) => {
      const perm = await getExplorePermission();
      setPermission(perm);
      if (perm !== 'granted' && perm !== 'granted_approximate') {
        setLocState(perm === 'denied_permanent' ? 'denied_permanent' : 'denied');
        await loadArea(null);
        return undefined;
      }
      setLocState('locating');
      const first = await readExploreFix();
      if (first) {
        setFix(first);
        setLocState(first.approximate || perm === 'granted_approximate' ? 'inaccurate' : 'ready');
        await loadArea(first);
      } else {
        setLocState('timeout');
        await loadArea(null);
      }
      if (__DEV__) {
        setProbe(await getExploreLocationProbe(first));
      }
      if (!startWatch) return undefined;
      return startExploreWatch(
        (next) => {
          setFix(next);
          mapRef.current?.sendState({
            places: areaRef.current?.places || [],
            user: { lat: next.latitude, lng: next.longitude },
            selectedId: selectedRef.current?.id,
          });
        },
        setLocState,
      );
    },
    [loadArea],
  );

  useFocusEffect(
    useCallback(() => {
      if (step !== 'explore') return undefined;
      let stop: (() => void) | undefined;
      void (async () => {
        stop = await locateAndLoad(true);
      })();
      return () => {
        stop?.();
        stopExploreWatch();
      };
    }, [locateAndLoad, step]),
  );

  useEffect(() => {
    if (!area) return;
    mapRef.current?.sendState({
      places: area.places,
      user: fix ? { lat: fix.latitude, lng: fix.longitude } : null,
      selectedId: selected?.id,
      center: area.places[0]
        ? { lat: area.places[0].publicLat, lng: area.places[0].publicLng }
        : undefined,
    });
  }, [area, fix, selected?.id]);

  const collect = async (place: ExplorePlace) => {
    if (collectInFlight.current) return;
    if (
      isExploreCollectLocked({
        spark: place.spark,
        outcome,
        verifying,
        offline,
        denied: locState === 'denied' || locState === 'denied_permanent',
        approximate: Boolean(fix?.approximate) || permission === 'granted_approximate',
        motorized: isMotorized(fix),
      })
    ) {
      return;
    }
    if (!place.spark) return;
    if (offline) {
      setOutcome('offline');
      return;
    }
    collectInFlight.current = true;
    setVerifying(true);
    setOutcome(null);
    try {
      const sample = await readCollectSample();
      const reject = collectSampleRejectReason(sample);
      if (reject) {
        setOutcome(reject);
        return;
      }
      if (!sample) {
        setOutcome('SPARK_LOCATION_UNAVAILABLE');
        return;
      }
      if (isMotorized(sample)) {
        setOutcome('SPARK_VERIFICATION_REQUIRED');
        return;
      }
      const result = await mediWorldApi.collectSpark(place.spark.spawnId, {
        idempotencyKey: `collect:${place.spark.spawnId}`,
        latitude: sample.latitude,
        longitude: sample.longitude,
        horizontalAccuracy: sample.accuracy ?? 999,
        locationTimestamp: sample.timestamp,
        mockLocation: sample.mocked,
        speedMps: sample.speedMps ?? undefined,
      });
      setOutcome(result.outcome);
      setConfig((prev) =>
        prev && result.discoveryCount != null ? { ...prev, discoveryCount: result.discoveryCount } : prev,
      );
      const marked = applyExploreCollectResult(place, result);
      if (marked !== place) {
        setSelected(marked);
        setArea((prev) =>
          prev
            ? {
                ...prev,
                places: prev.places.map((row) => (row.id === marked.id ? marked : row)),
              }
            : prev,
        );
      }
    } catch (error) {
      if (error instanceof ApiError && error.code) setOutcome(error.code);
      else setOutcome('SPARK_LOCATION_UNAVAILABLE');
    } finally {
      collectInFlight.current = false;
      setVerifying(false);
    }
  };

  const openExternalMaps = (place: ExplorePlace) => {
    const url = `https://www.openstreetmap.org/?mlat=${place.publicLat}&mlon=${place.publicLng}#map=17/${place.publicLat}/${place.publicLng}`;
    void Linking.openURL(url);
  };

  const banner = !enabled
    ? copy.featureOff
    : locState === 'services_off'
      ? copy.servicesOff
      : locState === 'denied_permanent'
        ? copy.deniedPermanent
        : locState === 'denied'
          ? copy.denied
          : locState === 'timeout'
            ? copy.timeout
            : locState === 'inaccurate' || fix?.approximate
              ? copy.approxBrowse
              : isMotorized(fix)
                ? copy.motorized
                : offline
                  ? copy.offlineBrowse
                  : area?.stale
                    ? copy.staleData
                    : locState === 'locating'
                      ? copy.locating
                      : null;

  if (step === 'boot') {
    return <View style={{ flex: 1, backgroundColor: colors.bg100 }} />;
  }

  if (step === 'intro') {
    return (
      <Shell copy={copy} onBack={() => router.back()} onSettings={() => router.push('/medi-world/explore-settings' as never)} locale={locale} setLocale={setLocale}>
        <Text style={{ ...fontTitle, fontSize: 24 * FONT, lineHeight: 32, color: colors.text100 }}>{copy.introTitle}</Text>
        <Text style={{ ...fontBody, fontSize: 15 * FONT, lineHeight: 22, color: colors.text200, marginTop: 10 }}>{copy.introLead}</Text>
        {[copy.safetyTraffic, copy.safetyPaths, copy.safetyPrivate, copy.safetyDriving, copy.safetyStop, copy.safetyAccess].map((line) => (
          <Text key={line} style={{ ...fontBody, fontSize: 15 * FONT, lineHeight: 22, color: colors.text200, marginTop: 10 }}>
            {line}
          </Text>
        ))}
        <Primary label={copy.continue} onPress={() => { void setExploreIntroSeen(); setStep('permission'); }} />
      </Shell>
    );
  }

  if (step === 'permission') {
    return (
      <Shell copy={copy} onBack={() => router.back()} onSettings={() => router.push('/medi-world/explore-settings' as never)} locale={locale} setLocale={setLocale}>
        <Text style={{ ...fontTitle, fontSize: 24 * FONT, lineHeight: 32, color: colors.text100 }}>{copy.permTitle}</Text>
        <Text style={{ ...fontBody, fontSize: 15 * FONT, lineHeight: 22, color: colors.text200, marginTop: 10 }}>{copy.permBody}</Text>
        <Primary
          label={copy.grantLocation}
          onPress={async () => {
            await setExplorePermExplained();
            const next = await requestExploreForegroundPermission();
            setPermission(next);
            setStep('explore');
          }}
        />
        <Pressable accessibilityRole="button" onPress={() => { void setExplorePermExplained(); setStep('explore'); }} className="active:opacity-75" style={{ marginTop: 12, minHeight: 44, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ ...fontMed, fontSize: 15 * FONT, color: colors.primary200 }}>{copy.later}</Text>
        </Pressable>
      </Shell>
    );
  }

  const showMap = view === 'map' && !mapFailed && (permission === 'granted' || permission === 'granted_approximate');

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg100 }}>
      <View style={{ paddingTop: insets.top + 8, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Pressable accessibilityRole="button" accessibilityLabel={copy.back} onPress={() => router.back()} className="active:opacity-75" style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
          <ArrowLeft size={22} color={colors.text100} strokeWidth={2.2} />
        </Pressable>
        <Text style={{ ...fontTitle, flex: 1, fontSize: 18, color: colors.text100 }}>{copy.title}</Text>
        <LangChip label={copy.langKa} active={locale === 'ka'} onPress={() => setLocale('ka')} />
        <LangChip label={copy.langEn} active={locale === 'en'} onPress={() => setLocale('en')} />
        <Pressable accessibilityRole="button" accessibilityLabel={copy.settings} onPress={() => router.push('/medi-world/explore-settings' as never)} className="active:opacity-75" style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
          <Settings2 size={20} color={colors.text100} strokeWidth={2.2} />
        </Pressable>
      </View>

      {banner ? (
        <Text style={{ ...fontBody, fontSize: 13 * FONT, lineHeight: 20, color: colors.text200, paddingHorizontal: 16, marginTop: 8 }}>{banner}</Text>
      ) : null}

      <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 16, marginTop: 10 }}>
        <Toggle active={showMap} label={copy.mapView} icon={<MapPinned size={16} color={showMap ? colors.primary200 : colors.text300} />} onPress={() => { setView('map'); void setExploreViewPref('map'); }} />
        <Toggle active={!showMap} label={copy.listView} icon={<List size={16} color={!showMap ? colors.primary200 : colors.text300} />} onPress={() => { setView('list'); void setExploreViewPref('list'); }} />
        <Pressable accessibilityRole="button" accessibilityLabel={copy.history} onPress={() => router.push('/medi-world/explore-history' as never)} className="active:opacity-75" style={{ minHeight: 40, paddingHorizontal: 12, justifyContent: 'center' }}>
          <Text style={{ ...fontMed, fontSize: 13, color: colors.primary200 }}>{copy.history}</Text>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel={copy.openMovement} onPress={() => router.push('/medi-world/movement' as never)} className="active:opacity-75" style={{ minHeight: 40, paddingHorizontal: 12, justifyContent: 'center' }}>
          <Text style={{ ...fontMed, fontSize: 13, color: colors.primary200 }}>{copy.openMovement}</Text>
        </Pressable>
      </View>

      <Text style={{ ...fontMed, fontSize: 13 * FONT, color: colors.text300, paddingHorizontal: 16, marginTop: 8 }}>
        {copy.foundCount}: {config?.discoveryCount ?? 0}
      </Text>

      {permission === 'denied_permanent' ? (
        <Pressable accessibilityRole="button" onPress={() => void Linking.openSettings()} className="active:opacity-75" style={{ marginHorizontal: 16, marginTop: 8, minHeight: 44, justifyContent: 'center' }}>
          <Text style={{ ...fontMed, fontSize: 15, color: colors.primary200 }}>{copy.openSettings}</Text>
        </Pressable>
      ) : null}

      {locState === 'timeout' || locState === 'unavailable' ? (
        <Pressable accessibilityRole="button" onPress={() => void locateAndLoad(false)} className="active:opacity-75" style={{ marginHorizontal: 16, marginTop: 8, minHeight: 44, justifyContent: 'center' }}>
          <Text style={{ ...fontMed, fontSize: 15, color: colors.primary200 }}>{copy.retry}</Text>
        </Pressable>
      ) : null}

      {__DEV__ && probe ? (
        <Text style={{ ...fontBody, fontSize: 11, color: colors.text300, paddingHorizontal: 16, marginTop: 6 }}>
          QA {probe.permission} · {probe.services ? 'svc on' : 'svc off'} · sample {probe.hasSample ? 'yes' : 'no'}
          {probe.accuracyM != null ? ` · ${Math.round(probe.accuracyM)}m` : ''}
          {probe.ageSec != null ? ` · ${probe.ageSec}s` : ''}
          {probe.mocked ? ' · mocked' : ''}
          {probe.lastError ? ` · ${probe.lastError}` : ''}
        </Text>
      ) : null}

      {showMap ? (
        <View style={{ flex: 1, marginTop: 8 }}>
          <ExploreMap ref={mapRef} reduceMotion={reduce} onSelect={(id) => setSelected(area?.places.find((row) => row.id === id) || null)} onProviderError={() => { setMapFailed(true); setView('list'); }} />
          {fix ? (
            <Pressable accessibilityRole="button" accessibilityLabel={copy.centerMe} onPress={() => mapRef.current?.centerOn(fix.latitude, fix.longitude)} className="active:opacity-75" style={{ position: 'absolute', right: 16, bottom: 24, minHeight: 44, borderRadius: 16, backgroundColor: dark ? '#0D9488' : colors.primary200, paddingHorizontal: 14, justifyContent: 'center' }}>
              <Text style={{ ...fontTitle, color: '#FFFFFF', fontSize: 14 }}>{copy.centerMe}</Text>
            </Pressable>
          ) : null}
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 32, gap: 10 }}>
          {!area?.places.length ? (
            <Text style={{ ...fontBody, fontSize: 15 * FONT, lineHeight: 22, color: colors.text200 }}>{copy.noPlaces}</Text>
          ) : (
            area.places.map((place) => (
              <Pressable
                key={place.id}
                accessibilityRole="button"
                onPress={() => setSelected(place)}
                className="active:opacity-75"
                style={{ borderRadius: QUEST.radius, borderWidth: 1, borderColor: colors.bg300, backgroundColor: colors.surface, padding: QUEST.pad }}
              >
                <Text style={{ ...fontTitle, fontSize: 16 * FONT, color: colors.text100 }}>{locale === 'en' ? place.nameEn : place.nameKa}</Text>
                <Text style={{ ...fontBody, fontSize: 13 * FONT, color: colors.text300, marginTop: 4 }}>{copy[placeTypeKey(place.placeType)]}</Text>
                {place.developmentFixture ? <Text style={{ ...fontBody, fontSize: 12, color: colors.text300, marginTop: 6 }}>{copy.fixtureBadge}</Text> : null}
                {place.spark ? (
                  <Text style={{ ...fontMed, fontSize: 13, color: place.spark.collected ? colors.text300 : colors.primary200, marginTop: 8 }}>
                    {place.spark.collected ? copy.collected : copy[sparkKey(String(place.spark.category))]}
                  </Text>
                ) : null}
              </Pressable>
            ))
          )}
        </ScrollView>
      )}

      <Modal visible={selected != null} {...APP_MODAL_PROPS} onRequestClose={() => { setSelected(null); setOutcome(null); }}>
        <View style={{ flex: 1, justifyContent: 'flex-end' }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={copy.close}
            onPress={() => { setSelected(null); setOutcome(null); }}
            style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: APP_MODAL_OVERLAY }}
          />
          <View
            pointerEvents="box-none"
            style={{ backgroundColor: colors.surface, padding: 20, paddingBottom: Math.max(insets.bottom, 20) + 12, borderTopLeftRadius: 24, borderTopRightRadius: 24 }}
          >
            {selected ? (
              <>
                <Text style={{ ...fontTitle, fontSize: 20 * FONT, color: colors.text100 }}>{locale === 'en' ? selected.nameEn : selected.nameKa}</Text>
                <Text style={{ ...fontBody, fontSize: 14 * FONT, color: colors.text300, marginTop: 6 }}>{copy[placeTypeKey(selected.placeType)]}</Text>
                {selected.developmentFixture ? <Text style={{ ...fontBody, fontSize: 13, color: colors.text300, marginTop: 8 }}>{copy.fixtureBadge}</Text> : null}
                <Text style={{ ...fontBody, fontSize: 14 * FONT, color: colors.text200, marginTop: 8 }}>
                  {selected.accessibility === 'accessible' ? copy.accessibilityAccessible : selected.accessibility === 'partial' ? copy.accessibilityPartial : copy.accessibilityUnknown}
                </Text>
                {selected.spark ? (
                  <Text style={{ ...fontMed, fontSize: 15 * FONT, color: colors.text100, marginTop: 12 }}>{copy[sparkKey(String(selected.spark.category))]}</Text>
                ) : null}
                <Text style={{ ...fontBody, fontSize: 13 * FONT, color: colors.text300, marginTop: 8 }}>{copy.lookUp}</Text>
                {outcome ? (
                  <Text style={{ ...fontBody, fontSize: 15 * FONT, lineHeight: 22, color: colors.text100, marginTop: 12 }}>
                    {outcome === 'offline' ? copy.offlineCollect : outcome === 'SPARK_COLLECTED' ? copy.successTitle : exploreOutcomeText(locale, outcome)}
                  </Text>
                ) : null}
                {outcome === 'SPARK_COLLECTED' ? (
                  <Text style={{ ...fontBody, fontSize: 15 * FONT, lineHeight: 22, color: colors.text200, marginTop: 8 }}>{copy.mediReaction}</Text>
                ) : null}
                <Primary
                  label={verifying ? copy.collecting : copy.collect}
                  onPress={() => void collect(selected)}
                  disabled={isExploreCollectLocked({
                    spark: selected.spark,
                    outcome,
                    verifying,
                    offline,
                    denied: locState === 'denied' || locState === 'denied_permanent',
                    approximate: Boolean(fix?.approximate) || permission === 'granted_approximate',
                    motorized: isMotorized(fix),
                  })}
                />
                <Pressable accessibilityRole="button" onPress={() => openExternalMaps(selected)} className="active:opacity-75" style={{ marginTop: 10, minHeight: 44, justifyContent: 'center' }}>
                  <Text style={{ ...fontMed, fontSize: 15, color: colors.primary200 }}>{copy.openInMaps}</Text>
                </Pressable>
                <Text style={{ ...fontBody, fontSize: 12, color: colors.text300, marginTop: 4 }}>{copy.noRoute}</Text>
              </>
            ) : null}
          </View>
        </View>
      </Modal>
    </View>
  );
}

function Shell({
  children,
  copy,
  onBack,
  onSettings,
  locale,
  setLocale,
}: {
  children: React.ReactNode;
  copy: ReturnType<typeof exploreCopy>;
  onBack: () => void;
  onSettings: () => void;
  locale: 'ka' | 'en';
  setLocale: (next: 'ka' | 'en') => void;
}) {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg100 }}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 8, paddingHorizontal: 16, paddingBottom: insets.bottom + 32 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Pressable accessibilityRole="button" accessibilityLabel={copy.back} onPress={onBack} className="active:opacity-75" style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
            <ArrowLeft size={22} color={colors.text100} strokeWidth={2.2} />
          </Pressable>
          <View style={{ flex: 1 }} />
          <LangChip label={copy.langKa} active={locale === 'ka'} onPress={() => setLocale('ka')} />
          <LangChip label={copy.langEn} active={locale === 'en'} onPress={() => setLocale('en')} />
          <Pressable accessibilityRole="button" accessibilityLabel={copy.settings} onPress={onSettings} className="active:opacity-75" style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
            <Settings2 size={20} color={colors.text100} strokeWidth={2.2} />
          </Pressable>
        </View>
        {children}
      </ScrollView>
    </View>
  );
}

function Primary({ label, onPress, disabled }: { label: string; onPress: () => void; disabled?: boolean }) {
  const colors = useThemeColors();
  const dark = useIsDark();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: Boolean(disabled) }}
      onPress={disabled ? undefined : onPress}
      className="active:opacity-75"
      style={{
        marginTop: 18,
        minHeight: 52,
        borderRadius: 16,
        backgroundColor: disabled ? colors.bg300 : dark ? '#0D9488' : colors.primary200,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text style={{ fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 16, color: '#FFFFFF' }}>{label}</Text>
    </Pressable>
  );
}

function LangChip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  const colors = useThemeColors();
  const dark = useIsDark();
  return (
    <Pressable accessibilityRole="button" onPress={onPress} className="active:opacity-75" style={{ minHeight: 32, paddingHorizontal: 10, borderRadius: 999, borderWidth: 1, borderColor: active ? colors.primary200 : colors.bg300, backgroundColor: active ? (dark ? QUEST.wash.dark : QUEST.wash.light) : 'transparent', alignItems: 'center', justifyContent: 'center', marginLeft: 6 }}>
      <Text style={{ fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 12, color: active ? colors.primary100 : colors.text200 }}>{label}</Text>
    </Pressable>
  );
}

function Toggle({ active, label, icon, onPress }: { active: boolean; label: string; icon: React.ReactNode; onPress: () => void }) {
  const colors = useThemeColors();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} className="active:opacity-75" style={{ minHeight: 40, paddingHorizontal: 12, borderRadius: 999, borderWidth: 1, borderColor: active ? colors.primary200 : colors.bg300, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      {icon}
      <Text style={{ fontFamily: 'NotoSansGeorgian_500Medium', fontSize: 13, color: active ? colors.primary200 : colors.text200 }}>{label}</Text>
    </Pressable>
  );
}
