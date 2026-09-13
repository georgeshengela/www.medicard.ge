import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, Linking, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Clock, Compass, ExternalLink, Heart, Leaf, LocateFixed, MapPinned, Moon, Settings2, Sparkles, Sprout, Sun, Users } from 'lucide-react-native';
import { ExploreMap, type ExploreMapHandle } from '@/components/world/ExploreMap';
import { WorldButton, WorldHeader, WORLD_FONT_BODY, WORLD_FONT_MED, WORLD_FONT_TITLE, useWorldLocale } from '@/components/world/WorldChrome';
import { WorldMediPortrait } from '@/components/world/WorldMediPortrait';
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';
import { exploreCopy, exploreOutcomeText } from '@/i18n/world/explore.js';
import { worldCopy } from '@/i18n/world/catalog.js';
import { ApiError } from '@/lib/api';
import { mediWorldApi } from '@/lib/mediWorld/api';
import {
  applyExpiredSparks,
  applyKnownSparkExpiry,
  delayUntilSparkExpiry,
  emptyExploreArea,
  isSparkExpired,
  nextKnownSparkExpiryMs,
  resolveExploreAreaCacheUse,
  selectPlaceAfterRefresh,
  shouldCommitExploreArea,
} from '@/lib/mediWorld/exploreAreaCache.js';
import {
  getExploreViewPref,
  readExploreAreaCacheRecord,
  setExploreIntroSeen,
  setExplorePermExplained,
  setExploreViewPref,
  writeExploreAreaCache,
} from '@/lib/mediWorld/exploreCache';
import { coarseAreaKey, formatExploreDistanceM, geodesicMeters } from '@/lib/mediWorld/exploreGeo';
import {
  applyAuthoritativeCollectOutcome,
  applyExploreCollectResult,
  isExploreCollectLocked,
  shouldOfferExploreCollect,
} from '@/lib/mediWorld/exploreCollectUi';
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
import { useMediWorldExploreAvailable, useMediWorldGardenAvailable, useMediWorldSocialAvailable } from '@/lib/mediWorld/enabled';
import type { ExploreAreaResponse, ExploreConfigResponse, ExplorePlace } from '@/lib/mediWorld/types';
import { useThemeColors } from '@/theme/colors';
import { useWorldStitch } from '@/theme/worldStitch';
import { useAuth } from '@/store/AuthContext';

const FONT = 1.3;

function isNightNow() {
  const hour = new Date().getHours();
  return hour >= 19 || hour < 7;
}

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

export default function ExploreScreen({ hub = false }: { hub?: boolean } = {}) {
  const router = useRouter();
  const params = useLocalSearchParams<{ safety?: string | string[] }>();
  const replaySafety = (Array.isArray(params.safety) ? params.safety[0] : params.safety) === '1';
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const t = useWorldStitch();
  const reduce = usePrefersReducedMotion();
  const enabled = useMediWorldExploreAvailable();
  const gardenEnabled = useMediWorldGardenAvailable();
  const socialEnabled = useMediWorldSocialAvailable();
  const { user } = useAuth();
  const ownerId = user?.id || '';
  const { locale } = useWorldLocale();
  const copy = useMemo(() => exploreCopy(locale), [locale]);
  const hubCopy = useMemo(() => worldCopy(locale), [locale]);
  const mapRef = useRef<ExploreMapHandle>(null);
  const areaRef = useRef<ExploreAreaResponse | null>(null);
  const selectedRef = useRef<ExplorePlace | null>(null);
  const [step, setStep] = useState<'boot' | 'intro' | 'permission' | 'explore'>('boot');
  const [view, setView] = useState<'map' | 'list'>('map');
  const [mapFailed, setMapFailed] = useState(false);
  const [mapDark, setMapDark] = useState(isNightNow);
  const themeManual = useRef(false);
  const [permission, setPermission] = useState<ExplorePermission>('undetermined');
  const [locState, setLocState] = useState<ExploreLocationState>('idle');
  const [fix, setFix] = useState<ExploreFix | null>(null);
  const [area, setArea] = useState<ExploreAreaResponse | null>(null);
  const [config, setConfig] = useState<ExploreConfigResponse | null>(null);
  const [selected, setSelected] = useState<ExplorePlace | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [outcome, setOutcome] = useState<string | null>(null);
  const [offline, setOffline] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [probe, setProbe] = useState<ExploreLocationProbe | null>(null);
  const collectInFlight = useRef(false);
  const requestGen = useRef(0);
  const lastCellRef = useRef<string | null>(null);
  const ownerRef = useRef(ownerId);
  areaRef.current = area;
  selectedRef.current = selected;
  const fontTitle = { fontFamily: 'NotoSansGeorgian_700Bold' as const };
  const fontBody = { fontFamily: 'NotoSansGeorgian_400Regular' as const };
  const fontMed = { fontFamily: 'NotoSansGeorgian_500Medium' as const };

  useEffect(() => {
    void (async () => {
      const pref = await getExploreViewPref();
      if (!hub) setView(pref);
      const perm = await getExplorePermission();
      setPermission(perm);
      if (replaySafety) setStep('intro');
      else setStep('explore');
    })();
  }, [hub, replaySafety]);

  useEffect(() => {
    const id = setInterval(() => {
      if (!themeManual.current) setMapDark(isNightNow());
    }, 60_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (ownerRef.current && ownerId && ownerRef.current !== ownerId) {
      requestGen.current += 1;
      lastCellRef.current = null;
      setArea(null);
      setSelected(null);
      setOutcome(null);
      setFix(null);
    }
    ownerRef.current = ownerId;
  }, [ownerId]);

  const loadArea = useCallback(
    async (
      nextFix: ExploreFix | null,
      mode: 'live' | 'denied' | 'no-fix' = nextFix ? 'live' : 'denied',
      options: { clearOutcome?: boolean } = {},
    ) => {
      if (!enabled) return null;
      const owner = ownerId;
      if (!owner) return null;
      const clearOutcome = options.clearOutcome !== false;
      const noLive = mode === 'denied' || mode === 'no-fix' || !nextFix;

      if (noLive) {
        lastCellRef.current = null;
        setFix(null);
        if (clearOutcome) setOutcome(null);
        const gen = ++requestGen.current;
        try {
          const cfg = await mediWorldApi.exploreConfig();
          if (gen !== requestGen.current || owner !== ownerId) return null;
          setConfig(cfg);
        } catch {
          /* config is optional while location is unavailable */
        }
        const record = await readExploreAreaCacheRecord();
        if (gen !== requestGen.current || owner !== ownerId) return null;
        const resolved = resolveExploreAreaCacheUse(record, {
          ownerId: owner,
          liveCell: null,
          nowMs: Date.now(),
          denied: true,
        });
        if (resolved.use && resolved.area) {
          setArea(resolved.area);
          setSelected((prev) => selectPlaceAfterRefresh(prev, resolved.area.places));
          return resolved.area;
        }
        const empty = emptyExploreArea('', { snapshotOnly: false, stale: false });
        setArea(empty);
        setSelected(null);
        return empty;
      }

      const key = coarseAreaKey(nextFix.latitude, nextFix.longitude);
      const prevCell = lastCellRef.current;
      if (prevCell && prevCell !== key) {
        setSelected(null);
        if (clearOutcome) setOutcome(null);
        setArea(emptyExploreArea(key));
      }
      lastCellRef.current = key;
      const gen = ++requestGen.current;
      const startedOwner = owner;
      const startedCell = key;
      const stillCurrent = () =>
        shouldCommitExploreArea({
          startedGeneration: gen,
          currentGeneration: requestGen.current,
          startedOwner,
          currentOwner: ownerId,
          startedCell,
          currentCell: lastCellRef.current,
        });
      try {
        const cfg = await mediWorldApi.exploreConfig();
        if (!stillCurrent()) return null;
        setConfig(cfg);
        if (cfg.mapUnavailable) {
          setMapFailed(true);
          setView('list');
        }
        const live = await mediWorldApi.exploreArea(key, locale, {
          latitude: nextFix.latitude,
          longitude: nextFix.longitude,
        });
        if (!stillCurrent()) return null;
        const now = Date.now();
        const places = applyExpiredSparks(live.places || [], now);
        const next = {
          enabled: live.enabled,
          rulesetId: live.rulesetId,
          coarseAreaKey: live.coarseAreaKey || key,
          stale: false,
          snapshotOnly: false,
          places,
        };
        setArea(next);
        setOffline(false);
        setSelected((prev) => selectPlaceAfterRefresh(prev, places));
        if (clearOutcome) setOutcome(null);
        await writeExploreAreaCache(next, { ownerId: startedOwner, fetchedAt: now });
        return next;
      } catch (error) {
        if (!stillCurrent()) return null;
        const record = await readExploreAreaCacheRecord();
        if (!stillCurrent()) return null;
        const resolved = resolveExploreAreaCacheUse(record, {
          ownerId: startedOwner,
          liveCell: startedCell,
          nowMs: Date.now(),
          denied: false,
        });
        setOffline(true);
        if (resolved.use && resolved.area) {
          setArea(resolved.area);
          setSelected((prev) => selectPlaceAfterRefresh(prev, resolved.area.places));
          return resolved.area;
        }
        const empty = emptyExploreArea(startedCell);
        setArea(empty);
        setSelected(null);
        if (error instanceof ApiError && (error.code === 'EXPLORE_DISABLED' || error.code === 'MEDI_WORLD_DISABLED')) {
          setConfig(null);
        }
        return empty;
      }
    },
    [enabled, locale, ownerId],
  );

  const locateAndLoad = useCallback(
    async (startWatch: boolean) => {
      const perm = await getExplorePermission();
      setPermission(perm);
      if (perm !== 'granted' && perm !== 'granted_approximate') {
        setLocState(perm === 'denied_permanent' ? 'denied_permanent' : 'denied');
        await loadArea(null, 'denied');
        return undefined;
      }
      setLocState('locating');
      const first = await readExploreFix();
      if (first) {
        setFix(first);
        setLocState(first.approximate || perm === 'granted_approximate' ? 'inaccurate' : 'ready');
        await loadArea(first, 'live');
      } else {
        setLocState('timeout');
        await loadArea(null, 'no-fix');
      }
      if (__DEV__) {
        setProbe(await getExploreLocationProbe(first));
      }
      if (!startWatch) return undefined;
      return startExploreWatch(
        (next) => {
          setFix(next);
          const nextKey = coarseAreaKey(next.latitude, next.longitude);
          const cellChanged = Boolean(lastCellRef.current && lastCellRef.current !== nextKey);
          mapRef.current?.sendState({
            places: cellChanged ? [] : areaRef.current?.places || [],
            user: { lat: next.latitude, lng: next.longitude },
            selectedId: cellChanged ? undefined : selectedRef.current?.id,
          });
          if (cellChanged || lastCellRef.current == null) {
            void loadArea(next, 'live');
          }
        },
        setLocState,
      );
    },
    [loadArea],
  );

  const refreshNearby = useCallback(async () => {
    if (refreshing) return;
    setRefreshing(true);
    try {
      await locateAndLoad(false);
    } finally {
      setRefreshing(false);
    }
  }, [locateAndLoad, refreshing]);

  const applyKnownExpiry = useCallback((nowMs = Date.now()) => {
    const next = applyKnownSparkExpiry(areaRef.current, selectedRef.current, nowMs);
    if (!next.changed) return;
    if (next.area) setArea(next.area);
    if (next.selectedExpired) {
      setSelected(next.selected);
      setOutcome((prev) => {
        if (prev === 'SPARK_COLLECTED' || prev === 'SPARK_ALREADY_COLLECTED') return prev;
        return 'SPARK_EXPIRED';
      });
    }
  }, []);

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
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') applyKnownExpiry(Date.now());
    });
    return () => sub.remove();
  }, [applyKnownExpiry]);

  useEffect(() => {
    const now = Date.now();
    applyKnownExpiry(now);
    const next = nextKnownSparkExpiryMs([...(area?.places || []), selected].filter(Boolean), now);
    if (next == null) return undefined;
    const delay = delayUntilSparkExpiry(next, now);
    if (delay == null) return undefined;
    const timer = setTimeout(() => applyKnownExpiry(Date.now()), Math.max(1, delay));
    return () => clearTimeout(timer);
  }, [area, selected, applyKnownExpiry]);

  useEffect(() => {
    if (!area) return;
    mapRef.current?.sendState({
      places: area.places,
      user: fix ? { lat: fix.latitude, lng: fix.longitude } : null,
      selectedId: selected?.id,
    });
  }, [area, fix, selected?.id]);

  const collectLocked = (placeSpark: ExplorePlace['spark'] | null | undefined) =>
    isExploreCollectLocked({
      spark: placeSpark,
      outcome,
      verifying,
      offline,
      denied: locState === 'denied' || locState === 'denied_permanent',
      approximate: Boolean(fix?.approximate) || permission === 'granted_approximate',
      motorized: isMotorized(fix),
      snapshotOnly: Boolean(area?.snapshotOnly),
      noLivePosition: !fix,
    });

  const collect = async (place: ExplorePlace) => {
    if (collectInFlight.current) return;
    if (collectLocked(place.spark)) {
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
      if (result.outcome === 'SPARK_EXPIRED' || result.outcome === 'SPARK_PLACE_UNAVAILABLE') {
        const stripped = applyAuthoritativeCollectOutcome(place, result);
        setSelected(stripped);
        setArea((prev) =>
          prev
            ? {
                ...prev,
                places: prev.places.map((row) => (row.id === stripped.id ? stripped : row)),
              }
            : prev,
        );
        const refreshed = await loadArea(fix, fix ? 'live' : 'no-fix', { clearOutcome: false });
        if (result.outcome === 'SPARK_EXPIRED') {
          const live = refreshed?.places?.find((row) => row.id === place.id);
          if (live?.spark && !isSparkExpired(live.spark)) setOutcome(null);
        }
        return;
      }
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
      if (error instanceof ApiError && (error.code === 'SPARK_EXPIRED' || error.code === 'SPARK_PLACE_UNAVAILABLE')) {
        const stripped = applyAuthoritativeCollectOutcome(place, { outcome: error.code });
        setSelected(stripped);
        setArea((prev) =>
          prev
            ? {
                ...prev,
                places: prev.places.map((row) => (row.id === stripped.id ? stripped : row)),
              }
            : prev,
        );
        setOutcome(error.code);
        const refreshed = await loadArea(fix, fix ? 'live' : 'no-fix', { clearOutcome: false });
        if (error.code === 'SPARK_EXPIRED') {
          const live = refreshed?.places?.find((row) => row.id === place.id);
          if (live?.spark && !isSparkExpired(live.spark)) setOutcome(null);
        }
      } else if (error instanceof ApiError && error.code) setOutcome(error.code);
      else {
        setOffline(true);
        setOutcome('offline');
      }
    } finally {
      collectInFlight.current = false;
      setVerifying(false);
    }
  };

  const openExternalMaps = (place: ExplorePlace) => {
    const url = `https://www.openstreetmap.org/?mlat=${place.publicLat}&mlon=${place.publicLng}#map=17/${place.publicLat}/${place.publicLng}`;
    void Linking.openURL(url);
  };

  const denied = locState === 'denied' || locState === 'denied_permanent';
  const locationGranted = permission === 'granted' || permission === 'granted_approximate';
  const canRefreshNearby = locationGranted && !denied;
  const banner = !enabled
    ? copy.featureOff
    : locState === 'services_off'
      ? copy.servicesOff
      : denied
        ? copy.denied
        : locState === 'timeout' || locState === 'unavailable'
          ? copy.timeout
          : locState === 'inaccurate' || fix?.approximate
            ? copy.approxBrowse
            : isMotorized(fix)
              ? copy.motorized
              : offline
                ? copy.offlineBrowse
                : area?.snapshotOnly
                  ? copy.snapshotOnly
                  : area?.stale
                    ? copy.staleData
                    : locState === 'locating'
                      ? copy.locating
                      : null;
  const snapshotNote =
    area?.snapshotOnly && (area.places?.length || 0) > 0 && (denied || locState === 'timeout')
      ? copy.snapshotOnly
      : null;

  if (step === 'boot') {
    return <View style={{ flex: 1, backgroundColor: t.surface }} />;
  }

  if (step === 'intro') {
    return (
      <Shell copy={copy} title={copy.introTitle} onSettings={() => router.push('/medi-world/explore-settings' as never)}>
        <Text style={{ ...fontBody, fontSize: 15 * FONT, lineHeight: 22, color: colors.text200, marginTop: 10 }}>{copy.introLead}</Text>
        {[copy.safetyTraffic, copy.safetyPaths, copy.safetyPrivate, copy.safetyDriving, copy.safetyStop, copy.safetyAccess].map((line) => (
          <Text key={line} style={{ ...fontBody, fontSize: 15 * FONT, lineHeight: 22, color: colors.text200, marginTop: 10 }}>
            {line}
          </Text>
        ))}
        <WorldButton label={copy.continue} onPress={() => { void setExploreIntroSeen(); setStep('explore'); }} />
      </Shell>
    );
  }

  if (step === 'permission') {
    return (
      <Shell copy={copy} title={copy.permTitle} onSettings={() => router.push('/medi-world/explore-settings' as never)}>
        <Text style={{ ...fontBody, fontSize: 15 * FONT, lineHeight: 22, color: colors.text200, marginTop: 10 }}>{copy.permBody}</Text>
        <WorldButton
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

  const showMap = view === 'map' && (!mapFailed || hub);
  const selectedMeters =
    fix && selected
      ? geodesicMeters(
          { latitude: fix.latitude, longitude: fix.longitude },
          { latitude: selected.publicLat, longitude: selected.publicLng },
        )
      : null;
  const selectedDistanceLabel =
    selectedMeters == null ? null : formatExploreDistanceM(selectedMeters);
  const nearEnough = selectedMeters != null && selectedMeters <= (config?.collectionRadiusM || 75);
  const foundLabel = String(copy.foundCountPill).replace('{n}', String(config?.discoveryCount ?? 0));
  const mapCenter = fix
    ? { lat: fix.latitude, lng: fix.longitude }
    : denied || locState === 'timeout' || locState === 'unavailable' || locState === 'services_off'
      ? { lat: 20, lng: 0 }
      : null;

  const historyBtn = (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={copy.history}
      onPress={() => router.push('/medi-world/explore-history' as never)}
      className="active:opacity-80"
      style={{
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(255,255,255,0.95)',
        borderWidth: 1,
        borderColor: 'rgba(241,245,249,0.95)',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Clock size={18} color="#334155" strokeWidth={1.8} />
      {(config?.discoveryCount || 0) > 0 ? (
        <View style={{ position: 'absolute', top: 8, right: 8, width: 8, height: 8, borderRadius: 4, backgroundColor: '#00B7A6', borderWidth: 2, borderColor: '#FFFFFF' }} />
      ) : null}
    </Pressable>
  );

  return (
    <View style={{ flex: 1, backgroundColor: '#F2F8F6' }}>
      {showMap ? (
        <View style={{ flex: 1 }}>
          <ExploreMap
            ref={mapRef}
            reduceMotion={reduce}
            mapDark={mapDark}
            initialCenter={mapCenter}
            hereLabel={copy.hereYouAre}
            onSelect={(id) => {
              setOutcome(null);
              setSelected(area?.places.find((row) => row.id === id) || null);
            }}
            onReady={() => {
              mapRef.current?.sendState({
                places: areaRef.current?.places || [],
                user: fix ? { lat: fix.latitude, lng: fix.longitude } : null,
                selectedId: selectedRef.current?.id,
              });
            }}
            onProviderError={() => {
              setMapFailed(true);
              if (!hub) setView('list');
            }}
          />
          <WorldHeader
            title={copy.title}
            navTitle={copy.title}
            backLabel={hub ? hubCopy.back : copy.back}
            kaLabel={copy.langKa}
            enLabel={copy.langEn}
            fallbackHome={hub}
            overlay
            trailing={historyBtn}
          />
          <View pointerEvents="box-none" style={{ position: 'absolute', left: 20, right: 20, top: insets.top + 56, zIndex: 30, gap: 8 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <View
                style={{
                  backgroundColor: 'rgba(255,255,255,0.95)',
                  borderRadius: 999,
                  paddingHorizontal: 14,
                  paddingVertical: 7,
                  borderWidth: 1,
                  borderColor: '#E2F0ED',
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <View style={{ width: 16, height: 16, borderRadius: 8, backgroundColor: '#D1FAE5', alignItems: 'center', justifyContent: 'center' }}>
                  <Sparkles size={10} color="#00B7A6" fill="#00B7A6" />
                </View>
                <Text style={{ ...WORLD_FONT_TITLE, fontSize: 12, color: '#1E293B' }}>{foundLabel}</Text>
              </View>
              <View style={{ backgroundColor: 'rgba(255,255,255,0.95)', borderRadius: 999, padding: 2, borderWidth: 1, borderColor: '#F1F5F9', flexDirection: 'row' }}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={copy.mapView}
                  onPress={() => { setView('map'); void setExploreViewPref('map'); }}
                  className="active:opacity-80"
                  style={{ paddingHorizontal: 14, paddingVertical: 6, borderRadius: 999, backgroundColor: '#00B7A6' }}
                >
                  <Text style={{ ...WORLD_FONT_TITLE, fontSize: 12, color: '#FFFFFF' }}>{copy.mapView}</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={copy.listView}
                  onPress={() => { setView('list'); void setExploreViewPref('list'); }}
                  className="active:opacity-80"
                  style={{ paddingHorizontal: 14, paddingVertical: 6, borderRadius: 999 }}
                >
                  <Text style={{ ...WORLD_FONT_MED, fontSize: 12, color: '#475569' }}>{copy.listView}</Text>
                </Pressable>
              </View>
            </View>
            {hub ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                {gardenEnabled ? (
                  <HubChip label={hubCopy.openGarden} icon={<Leaf size={14} color="#0F766E" />} onPress={() => router.push('/medi-world/garden' as never)} />
                ) : null}
                <HubChip label={hubCopy.openCareSpace} icon={<Heart size={14} color="#0F766E" />} onPress={() => router.push('/medi-world/care-space' as never)} />
                <HubChip label={hubCopy.openAdventure} icon={<Compass size={14} color="#0F766E" />} onPress={() => router.push('/medi-world/adventure' as never)} />
                {socialEnabled ? (
                  <HubChip label={hubCopy.openSocial} icon={<Users size={14} color="#0F766E" />} onPress={() => router.push('/medi-world/social' as never)} />
                ) : null}
                <HubChip label={hubCopy.destinationsAll} icon={<Sprout size={14} color="#0F766E" />} onPress={() => router.push('/medi-world/collection' as never)} />
              </ScrollView>
            ) : null}
            {banner ? (
              <View style={{ backgroundColor: 'rgba(255,255,255,0.94)', borderRadius: 16, padding: 12, borderWidth: 1, borderColor: '#E2F0ED' }}>
                <Text style={{ ...WORLD_FONT_BODY, fontSize: 12, lineHeight: 18, color: '#475569' }}>{banner}</Text>
                {denied ? (
                  <View style={{ flexDirection: 'row', gap: 12, marginTop: 8 }}>
                    <Pressable accessibilityRole="button" onPress={() => void Linking.openSettings()}>
                      <Text style={{ ...WORLD_FONT_MED, fontSize: 13, color: '#00B7A6' }}>{copy.openSettings}</Text>
                    </Pressable>
                    <Pressable
                      accessibilityRole="button"
                      onPress={async () => {
                        await setExplorePermExplained();
                        const next = await requestExploreForegroundPermission();
                        setPermission(next);
                        void locateAndLoad(true);
                      }}
                    >
                      <Text style={{ ...WORLD_FONT_MED, fontSize: 13, color: '#00B7A6' }}>{copy.grantLocation}</Text>
                    </Pressable>
                  </View>
                ) : null}
              </View>
            ) : null}
          </View>
          <View
            pointerEvents="box-none"
            style={{
              position: 'absolute',
              right: 20,
              bottom: (selected ? 210 : 28) + Math.max(insets.bottom, 8),
              zIndex: 25,
              gap: 8,
              alignItems: 'flex-end',
            }}
          >
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={mapDark ? copy.mapDay : copy.mapNight}
              onPress={() => {
                themeManual.current = true;
                setMapDark((value) => !value);
              }}
              className="active:opacity-80"
              style={{
                width: 44,
                height: 44,
                borderRadius: 22,
                backgroundColor: 'rgba(255,255,255,0.95)',
                borderWidth: 1,
                borderColor: '#F1F5F9',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {mapDark ? <Sun size={18} color="#00B7A6" strokeWidth={2.2} /> : <Moon size={18} color="#00B7A6" strokeWidth={2.2} />}
            </Pressable>
            {fix ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={copy.centerMe}
                onPress={() => mapRef.current?.centerOn(fix.latitude, fix.longitude)}
                className="active:opacity-80"
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 22,
                  backgroundColor: '#FFFFFF',
                  borderWidth: 1,
                  borderColor: '#F1F5F9',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <LocateFixed size={20} color="#00B7A6" strokeWidth={2.2} />
              </Pressable>
            ) : null}
          </View>
          {selected ? (
            <SparkSheet
              copy={copy}
              locale={locale}
              place={selected}
              nearEnough={nearEnough}
              distanceLabel={selectedDistanceLabel}
              outcome={outcome}
              verifying={verifying}
              collectLocked={collectLocked(selected.spark)}
              onCollect={() => void collect(selected)}
              onMaps={() => openExternalMaps(selected)}
              onClose={() => { setSelected(null); setOutcome(null); }}
              bottomInset={insets.bottom}
            />
          ) : null}
        </View>
      ) : (
        <View style={{ flex: 1 }}>
          <WorldHeader
            title={copy.title}
            backLabel={copy.back}
            kaLabel={copy.langKa}
            enLabel={copy.langEn}
            fallbackHome={hub}
            trailing={historyBtn}
          />
          <ScrollView
            contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 32, gap: 10 }}
            refreshControl={
              canRefreshNearby ? (
                <RefreshControl refreshing={refreshing} onRefresh={() => void refreshNearby()} tintColor="#00B7A6" />
              ) : undefined
            }
          >
            <Pressable
              accessibilityRole="button"
              onPress={() => { setView('map'); void setExploreViewPref('map'); }}
              style={{ alignSelf: 'flex-start', minHeight: 36, justifyContent: 'center' }}
            >
              <Text style={{ ...WORLD_FONT_MED, fontSize: 14, color: '#00B7A6' }}>{copy.mapView}</Text>
            </Pressable>
            {!area?.places.length ? (
              <Text style={{ ...WORLD_FONT_BODY, fontSize: 15, lineHeight: 22, color: colors.text200 }}>{copy.noPlaces}</Text>
            ) : (
              area.places.map((place) => (
                <Pressable
                  key={place.id}
                  accessibilityRole="button"
                  onPress={() => { setOutcome(null); setSelected(place); }}
                  className="active:opacity-75"
                  style={{
                    borderRadius: 20,
                    borderWidth: 1,
                    borderColor: '#E2F0ED',
                    backgroundColor: '#FFFFFF',
                    padding: 14,
                    flexDirection: 'row',
                    gap: 12,
                    alignItems: 'flex-start',
                  }}
                >
                  <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: '#E8F7F5', alignItems: 'center', justifyContent: 'center' }}>
                    <MapPinned size={20} color="#00B7A6" strokeWidth={2.2} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ ...WORLD_FONT_TITLE, fontSize: 16, color: '#0F172A' }}>{locale === 'en' ? place.nameEn : place.nameKa}</Text>
                    <Text style={{ ...WORLD_FONT_BODY, fontSize: 13, color: '#64748B', marginTop: 4 }}>{copy[placeTypeKey(place.placeType)]}</Text>
                    {place.presenceSpark ? <Text style={{ ...WORLD_FONT_BODY, fontSize: 12, color: '#64748B', marginTop: 6 }}>{copy.presenceBadge}</Text> : null}
                    {place.developmentFixture ? <Text style={{ ...WORLD_FONT_BODY, fontSize: 12, color: '#64748B', marginTop: 6 }}>{copy.fixtureBadge}</Text> : null}
                    {place.spark ? (
                      <Text style={{ ...WORLD_FONT_MED, fontSize: 13, color: place.spark.collected ? '#94A3B8' : '#00B7A6', marginTop: 8 }}>
                        {place.spark.collected ? copy.collected : copy[sparkKey(String(place.spark.category))]}
                      </Text>
                    ) : null}
                  </View>
                </Pressable>
              ))
            )}
          </ScrollView>
          {selected ? (
            <SparkSheet
              copy={copy}
              locale={locale}
              place={selected}
              nearEnough={nearEnough}
              distanceLabel={selectedDistanceLabel}
              outcome={outcome}
              verifying={verifying}
              collectLocked={collectLocked(selected.spark)}
              onCollect={() => void collect(selected)}
              onMaps={() => openExternalMaps(selected)}
              onClose={() => { setSelected(null); setOutcome(null); }}
              bottomInset={insets.bottom}
            />
          ) : null}
        </View>
      )}
    </View>
  );
}

function SparkSheet({
  copy,
  locale,
  place,
  nearEnough,
  distanceLabel,
  outcome,
  verifying,
  collectLocked,
  onCollect,
  onMaps,
  onClose,
  bottomInset,
}: {
  copy: ReturnType<typeof exploreCopy>;
  locale: 'ka' | 'en';
  place: ExplorePlace;
  nearEnough: boolean;
  distanceLabel: number | string | null;
  outcome: string | null;
  verifying: boolean;
  collectLocked: boolean;
  onCollect: () => void;
  onMaps: () => void;
  onClose: () => void;
  bottomInset: number;
}) {
  const sparkLabel = place.spark ? copy[sparkKey(String(place.spark.category))] : copy[placeTypeKey(place.placeType)];
  const offer = shouldOfferExploreCollect({ spark: place.spark, outcome, verifying });
  return (
    <View
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 40,
        backgroundColor: '#FFFFFF',
        borderTopLeftRadius: 32,
        borderTopRightRadius: 32,
        paddingHorizontal: 20,
        paddingTop: 12,
        paddingBottom: Math.max(bottomInset, 16) + 8,
        borderTopWidth: 1,
        borderColor: 'rgba(241,245,249,0.95)',
      }}
    >
      <Pressable accessibilityRole="button" accessibilityLabel={copy.close} onPress={onClose} style={{ alignItems: 'center', paddingBottom: 12 }}>
        <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: '#E2E8F0' }} />
      </Pressable>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 16 }}>
        <View
          style={{
            width: 56,
            height: 56,
            borderRadius: 16,
            backgroundColor: '#E8F7F5',
            borderWidth: 1,
            borderColor: '#CCFBF1',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
          }}
        >
          <WorldMediPortrait size={48} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <Text numberOfLines={1} style={{ ...WORLD_FONT_TITLE, fontSize: 18, lineHeight: 24, color: '#0F172A', flex: 1 }}>
              {locale === 'en' ? place.nameEn : place.nameKa}
            </Text>
            {nearEnough ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#ECFDF5', borderWidth: 1, borderColor: 'rgba(167,243,208,0.7)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 }}>
                <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#10B981', marginRight: 4 }} />
                <Text style={{ ...WORLD_FONT_MED, fontSize: 10, color: '#047857' }}>{copy.nearYou}</Text>
              </View>
            ) : null}
          </View>
          <Text style={{ ...WORLD_FONT_BODY, fontSize: 12, color: '#64748B', marginTop: 4 }}>
            {distanceLabel == null ? copy.distanceUnknown : String(copy.distanceM).replace('{n}', String(distanceLabel))}
            <Text style={{ color: '#CBD5E1' }}>  •  </Text>
            <Text style={{ ...WORLD_FONT_MED, color: '#00B7A6' }}>{sparkLabel}</Text>
          </Text>
          {place.presenceSpark ? (
            <Text style={{ ...WORLD_FONT_BODY, fontSize: 11, color: '#94A3B8', marginTop: 4 }}>{copy.presenceBadge}</Text>
          ) : null}
          {place.developmentFixture ? (
            <Text style={{ ...WORLD_FONT_BODY, fontSize: 11, color: '#94A3B8', marginTop: 4 }}>{copy.fixtureBadge}</Text>
          ) : null}
        </View>
      </View>
      {outcome ? (
        <Text style={{ ...WORLD_FONT_BODY, fontSize: 14, lineHeight: 20, color: '#0F172A', marginBottom: 10 }}>
          {outcome === 'offline' ? copy.offlineCollect : outcome === 'SPARK_COLLECTED' ? copy.successTitle : exploreOutcomeText(locale, outcome)}
        </Text>
      ) : null}
      <View style={{ flexDirection: 'row', gap: 10, marginBottom: 12 }}>
        {offer ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={copy.collect}
            onPress={onCollect}
            disabled={collectLocked}
            className="active:opacity-90"
            style={{
              flex: 2,
              height: 48,
              borderRadius: 16,
              backgroundColor: collectLocked ? '#99F6E4' : '#00B7A6',
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
            }}
          >
            <Sparkles size={16} color="#FFFFFF" fill="#FFFFFF" />
            <Text style={{ ...WORLD_FONT_TITLE, fontSize: 14, color: '#FFFFFF' }}>{verifying ? copy.collecting : copy.collect}</Text>
          </Pressable>
        ) : (
          <View style={{ flex: 2, height: 48 }} />
        )}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={copy.openInMaps}
          onPress={onMaps}
          className="active:opacity-90"
          style={{
            flex: 1,
            height: 48,
            borderRadius: 16,
            backgroundColor: '#F8FAFC',
            borderWidth: 1,
            borderColor: 'rgba(226,232,240,0.9)',
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 4,
          }}
        >
          <Text style={{ ...WORLD_FONT_MED, fontSize: 12, color: '#334155' }}>{copy.openInMapsShort}</Text>
          <ExternalLink size={14} color="#64748B" strokeWidth={2} />
        </Pressable>
      </View>
      <Text style={{ ...WORLD_FONT_BODY, fontSize: 11, lineHeight: 16, color: '#94A3B8', textAlign: 'center' }}>{copy.safetyNote}</Text>
    </View>
  );
}

function Shell({
  children,
  copy,
  title,
  onSettings,
}: {
  children: React.ReactNode;
  copy: ReturnType<typeof exploreCopy>;
  title: string;
  onSettings: () => void;
}) {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const t = useWorldStitch();
  return (
    <View style={{ flex: 1, backgroundColor: t.surface }}>
      <WorldHeader
        title={title}
        backLabel={copy.back}
        kaLabel={copy.langKa}
        enLabel={copy.langEn}
        trailing={
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={copy.settings}
            onPress={onSettings}
            hitSlop={8}
            className="active:opacity-75"
            style={{ width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' }}
          >
            <Settings2 size={20} color={colors.primary200} strokeWidth={2.2} />
          </Pressable>
        }
      />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 32 }}>
        {children}
      </ScrollView>
    </View>
  );
}

function HubChip({ label, icon, onPress }: { label: string; icon: React.ReactNode; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      className="active:opacity-80"
      style={{
        minHeight: 36,
        paddingHorizontal: 12,
        borderRadius: 999,
        backgroundColor: 'rgba(255,255,255,0.94)',
        borderWidth: 1,
        borderColor: '#E2F0ED',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
      }}
    >
      {icon}
      <Text style={{ fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 12, color: '#115E59' }}>{label}</Text>
    </Pressable>
  );
}
