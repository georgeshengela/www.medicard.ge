import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, BackHandler, Linking, Modal, Pressable, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { ArrowLeft, CarFront, ChevronDown, Dices, MapPin, Moon, Play, Sun, Target } from 'lucide-react-native';
import Animated, { Easing, FadeIn, FadeInDown, useAnimatedStyle, useSharedValue, withDelay, withRepeat, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BetaPill } from '@/components/run/HomeRunSection';
import { GpsChip, HudChip, HudRoundButton, RunBanner, RunControls, RunStatsPanel, useHudPalette } from '@/components/run/RunHud';
import { RunMap, type RunMapHandle } from '@/components/run/RunMap';
import { APP_MODAL_OVERLAY, APP_MODAL_PROPS } from '@/components/ui/appModal';
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';
import { ka } from '@/i18n/ka';
import { formatDistanceShort } from '@/lib/run/geo';
import { targetLabel } from '@/lib/run/labels';
import {
  cancelRun,
  finishRun,
  onRunEvent,
  pauseRun,
  prepareRun,
  regeneratePin,
  resumeRun,
  runDerived,
  startRun,
  useRunSession,
} from '@/lib/run/store';
import { useAuth } from '@/store/AuthContext';
import { useIsDark, useThemeColors } from '@/theme/colors';

const PIN_RADIUS_M = 28;

/** Night window for the automatic map theme: 19:00 → 07:00 local time. */
function isNightNow(): boolean {
  const h = new Date().getHours();
  return h >= 19 || h < 7;
}

function Radar({ reduce }: { reduce: boolean }) {
  const rings = [0, 900, 1800];
  return (
    <View style={{ width: 240, height: 240, alignItems: 'center', justifyContent: 'center' }}>
      {rings.map((delay) => (
        <RadarRing key={delay} delay={delay} reduce={reduce} />
      ))}
      <View style={{ width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(20,184,166,0.18)', borderWidth: 1, borderColor: 'rgba(94,234,212,0.6)' }}>
        <MapPin size={30} color="#FBBF24" strokeWidth={2.4} />
      </View>
    </View>
  );
}

function RadarRing({ delay, reduce }: { delay: number; reduce: boolean }) {
  const t = useSharedValue(0);
  useEffect(() => {
    if (reduce) {
      t.value = 0.5;
      return;
    }
    t.value = withDelay(delay, withRepeat(withTiming(1, { duration: 2700, easing: Easing.out(Easing.cubic) }), -1, false));
  }, [delay, reduce, t]);
  const style = useAnimatedStyle(() => ({ opacity: (1 - t.value) * 0.7, transform: [{ scale: 0.3 + t.value * 1 }] }));
  return <Animated.View style={[{ position: 'absolute', width: 240, height: 240, borderRadius: 120, borderWidth: 1.5, borderColor: '#5EEAD4' }, style]} />;
}

export default function RunActiveScreen() {
  const router = useRouter();
  const colors = useThemeColors();
  const dark = useIsDark();
  const insets = useSafeAreaInsets();
  const reduce = usePrefersReducedMotion();
  const p = useHudPalette();
  const { healthProfile } = useAuth();
  const s = useRunSession();
  const d = runDerived(s);
  const map = useRef<RunMapHandle>(null);
  const [mapReady, setMapReady] = useState(false);
  const [following, setFollowing] = useState(true);
  const [banner, setBanner] = useState<'pin' | 'target' | null>(null);
  const [confirm, setConfirm] = useState<'finish' | 'cancel' | null>(null);
  const [rerolling, setRerolling] = useState(false);
  const bannerTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const trailLen = useRef(0);

  // Map theme: follows the clock (dark at night, light at day) until the user
  // taps the sun/moon toggle — then their choice wins for this session.
  const [mapDark, setMapDark] = useState(isNightNow);
  const themeManual = useRef(false);
  useEffect(() => {
    const id = setInterval(() => {
      if (!themeManual.current) setMapDark(isNightNow());
    }, 60_000);
    return () => clearInterval(id);
  }, []);
  const onToggleMapTheme = () => {
    void Haptics.selectionAsync();
    themeManual.current = true;
    setMapDark((v) => !v);
  };

  const running = s.phase === 'running';
  const active = running || s.phase === 'paused';

  // Direct navigation without a prepared run → back to the hub.
  useEffect(() => {
    if (s.phase === 'idle' && !s.target && !s.error) router.replace('/run' as never);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (s.phase === 'finished') router.replace('/run/summary' as never);
  }, [s.phase, router]);

  // Map init / pin updates
  const initKey = `${s.origin?.lat ?? ''},${s.origin?.lng ?? ''}|${s.pin?.lat ?? ''},${s.pin?.lng ?? ''}|${s.route?.coords.length ?? 0}`;
  useEffect(() => {
    if (!mapReady || !s.origin) return;
    map.current?.send({
      type: 'init',
      origin: s.origin,
      pin: s.pin,
      route: s.route?.coords ?? null,
      radiusM: PIN_RADIUS_M,
      fit: !active,
    });
    trailLen.current = 0;
    if (s.pin) setRerolling(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapReady, initKey]);

  // Live position
  useEffect(() => {
    if (!mapReady || !s.current || !active) return;
    map.current?.send({ type: 'fix', lat: s.current.lat, lng: s.current.lng, heading: s.headingDeg });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapReady, s.current?.lat, s.current?.lng, s.headingDeg, active]);

  // Trail (every couple of points)
  useEffect(() => {
    if (!mapReady) return;
    if (s.path.length >= 2 && s.path.length - trailLen.current >= 2) {
      trailLen.current = s.path.length;
      map.current?.send({ type: 'trail', coords: s.path.map((pt) => [pt.lng, pt.lat] as [number, number]) });
    }
  }, [mapReady, s.path.length, s.path]);

  const showBanner = useCallback((tone: 'pin' | 'target') => {
    setBanner(tone);
    if (bannerTimer.current) clearTimeout(bannerTimer.current);
    bannerTimer.current = setTimeout(() => setBanner(null), 4500);
  }, []);

  useEffect(
    () =>
      onRunEvent((e) => {
        if (e === 'transport_warning') {
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          return;
        }
        if (e === 'transport_cancelled') {
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          return;
        }
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        if (e === 'pin_reached') {
          // Checkpoint captured — store schedules finish; celebrate on map if open.
          map.current?.send({ type: 'reached' });
          showBanner('pin');
        } else {
          showBanner('target');
        }
      }),
    [showBanner],
  );

  useEffect(
    () => () => {
      if (bannerTimer.current) clearTimeout(bannerTimer.current);
    },
    [],
  );

  const minimizeRun = useCallback(() => {
    void Haptics.selectionAsync();
    // Never router.back() into /run — the hub auto-replaces to /run/active while a
    // session is live, so the first tap looked like a no-op and only the 2nd worked.
    router.replace('/(tabs)/home' as never);
  }, [router]);

  // Android back — minimize live run (session stays active); cancel only while preparing.
  const onBack = useCallback(() => {
    if (active) {
      minimizeRun();
      return true;
    }
    if (s.phase === 'ready' || s.phase === 'preparing' || s.error) {
      cancelRun();
      router.replace('/run' as never);
      return true;
    }
    return false;
  }, [active, s.phase, s.error, router, minimizeRun]);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', onBack);
    return () => sub.remove();
  }, [onBack]);

  const onToggle = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (running) pauseRun();
    else void resumeRun();
  };

  const onStart = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setFollowing(true);
    map.current?.send({ type: 'follow' });
    void startRun();
  };

  const onFinish = async () => {
    setConfirm(null);
    await finishRun();
  };

  const onReroll = async () => {
    void Haptics.selectionAsync();
    setRerolling(true);
    await regeneratePin();
    setRerolling(false);
  };

  const onRetry = () => {
    if (s.target) void prepareRun(s.target, { weightKg: healthProfile?.weightKg, heightCm: healthProfile?.heightCm });
  };

  const topPad = insets.top + 10;
  const bottomPad = Math.max(insets.bottom, 12) + 12;

  return (
    <View style={{ flex: 1, backgroundColor: dark ? '#030712' : '#e5eef0' }}>
      {s.origin ? (
        <RunMap ref={map} center={s.origin} mapDark={mapDark} onReady={() => setMapReady(true)} onFollowChange={setFollowing} />
      ) : null}

      {/* preparing / error overlay */}
      {s.phase === 'preparing' || s.error ? (
        <LinearGradient
          colors={dark ? ['#030712', '#042F2E', '#030712'] : ['#0F766E', '#115E59', '#0B3B3A']}
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28 }}
        >
          {s.error ? (
            <Animated.View entering={FadeIn.duration(300)} style={{ alignItems: 'center', gap: 10 }}>
              <View style={{ width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(245,158,11,0.18)', borderWidth: 1, borderColor: 'rgba(251,191,36,0.6)' }}>
                <MapPin size={30} color="#FBBF24" strokeWidth={2.4} />
              </View>
              <Text style={{ marginTop: 8, fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 20, color: '#FFFFFF', textAlign: 'center' }}>
                {s.error === 'permission' ? ka.run.permissionTitle : ka.run.title}
              </Text>
              <Text style={{ fontFamily: 'NotoSansGeorgian_500Medium', fontSize: 13.5, lineHeight: 20, color: 'rgba(255,255,255,0.8)', textAlign: 'center' }}>
                {s.error === 'permission' ? ka.run.permissionBody : ka.run.locationFailed}
              </Text>
              <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => {
                    cancelRun();
                    router.replace('/run' as never);
                  }}
                  style={{ paddingHorizontal: 18, height: 46, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.12)' }}
                >
                  <Text style={{ fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 14, color: '#FFFFFF' }}>{ka.common.back}</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  onPress={s.error === 'permission' ? () => void Linking.openSettings() : onRetry}
                  style={{ paddingHorizontal: 18, height: 46, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF' }}
                >
                  <Text style={{ fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 14, color: '#0F766E' }}>
                    {s.error === 'permission' ? ka.run.openSettings : ka.common.retry}
                  </Text>
                </Pressable>
              </View>
            </Animated.View>
          ) : (
            <Animated.View entering={FadeIn.duration(300)} style={{ alignItems: 'center' }}>
              <Radar reduce={reduce} />
              <Text style={{ marginTop: 6, fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 22, color: '#FFFFFF' }}>{ka.run.preparing}</Text>
              <Text style={{ marginTop: 6, fontFamily: 'NotoSansGeorgian_500Medium', fontSize: 13, color: 'rgba(255,255,255,0.75)' }}>{ka.run.preparingHint}</Text>
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  cancelRun();
                  router.replace('/run' as never);
                }}
                style={{ marginTop: 26, paddingHorizontal: 18, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.12)' }}
              >
                <Text style={{ fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 13.5, color: '#FFFFFF' }}>{ka.run.cancelRun}</Text>
              </Pressable>
            </Animated.View>
          )}
        </LinearGradient>
      ) : null}

      {/* top bar */}
      {s.origin && !s.error ? (
        <View pointerEvents="box-none" style={{ position: 'absolute', top: topPad, left: 14, right: 14, gap: 10 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <HudRoundButton
              icon={active ? ChevronDown : ArrowLeft}
              label={active ? ka.run.minimize : ka.common.back}
              onPress={() => (active ? minimizeRun() : onBack())}
              size={44}
            />
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <HudChip icon={Target} label={targetLabel(s.target)} />
              <GpsChip accuracyM={s.accuracyM} />
              <HudRoundButton icon={mapDark ? Sun : Moon} label={ka.run.mapTheme} onPress={onToggleMapTheme} size={36} />
            </View>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <BetaPill />
          </View>
          {s.transportWarning ? (
            <RunBanner tone="warn" title={ka.run.transportWarnTitle} body={ka.run.transportWarnBody} />
          ) : banner ? (
            <RunBanner
              tone={banner}
              title={banner === 'pin' ? ka.run.pinReached : ka.run.targetDone}
              body={banner === 'pin' ? ka.run.pinReachedBody : ka.run.targetDoneBody}
            />
          ) : null}
        </View>
      ) : null}

      {/* bottom */}
      {s.origin && !s.error ? (
        <View pointerEvents="box-none" style={{ position: 'absolute', left: 14, right: 14, bottom: bottomPad, gap: 12 }}>
          {s.phase === 'ready' ? (
            <Animated.View
              entering={FadeInDown.duration(420)}
              style={{ backgroundColor: p.glass, borderRadius: 28, borderWidth: 1, borderColor: p.glassBorder, padding: 18, paddingTop: 16 }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <View style={{ width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center', backgroundColor: dark ? '#422006' : '#FEF3C7' }}>
                  {rerolling || !s.pin ? <ActivityIndicator color={p.amber} /> : <MapPin size={21} color={p.amber} strokeWidth={2.4} />}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 17, color: colors.text100 }}>
                    {rerolling || !s.pin ? ka.run.preparing : ka.run.ready}
                  </Text>
                  <Text style={{ marginTop: 2, fontFamily: 'NotoSansGeorgian_500Medium', fontSize: 12.5, lineHeight: 18, color: colors.text300 }}>
                    {s.pin
                      ? s.routed
                        ? ka.run.readyBody(formatDistanceShort(s.expectedDistanceM))
                        : ka.run.readyNoRoute
                      : ka.run.preparingHint}
                  </Text>
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={ka.run.reroll}
                  disabled={rerolling || !s.pin}
                  onPress={onReroll}
                  hitSlop={8}
                  style={{
                    width: 46,
                    height: 46,
                    borderRadius: 23,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: colors.bg200,
                    borderWidth: 1,
                    borderColor: colors.bg300,
                    opacity: rerolling ? 0.6 : 1,
                  }}
                >
                  <Dices size={20} color={colors.text200} strokeWidth={2.3} />
                </Pressable>
              </View>
              <Pressable
                accessibilityRole="button"
                disabled={rerolling || !s.pin}
                onPress={onStart}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 10,
                  height: 58,
                  borderRadius: 18,
                  marginTop: 16,
                  backgroundColor: p.ctaBg,
                  opacity: rerolling || !s.pin ? 0.55 : 1,
                }}
              >
                <View style={{ width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.22)' }}>
                  <Play size={15} color="#FFFFFF" strokeWidth={2.8} style={{ marginLeft: 2 }} />
                </View>
                <Text style={{ fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 17, letterSpacing: 0.2, color: '#FFFFFF' }}>{ka.run.go}</Text>
              </Pressable>
            </Animated.View>
          ) : null}

          {active ? (
            <>
              <RunStatsPanel
                elapsedMs={s.movingMs}
                distanceM={s.distanceM}
                paceSecPerKm={d.pace}
                calories={d.calories}
                steps={d.steps}
                progress={d.progress}
                toPinM={d.toPinM}
                reachedPin={s.reachedPin}
                paused={s.phase === 'paused'}
                targetLabel={targetLabel(s.target)}
                speedKmh={s.speedKmh}
                speedWarning={s.transportWarning}
              />
              <RunControls
                running={running}
                following={following}
                onToggle={onToggle}
                onFinish={() => setConfirm('finish')}
                onRecenter={() => {
                  setFollowing(true);
                  map.current?.send({ type: 'follow' });
                }}
                onOverview={() => map.current?.send({ type: 'fit', bottom: 340 })}
              />
            </>
          ) : null}
        </View>
      ) : null}

      {/* auto-cancelled: vehicle detected */}
      <Modal visible={s.transportCancelled} {...APP_MODAL_PROPS} onRequestClose={() => {}}>
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: APP_MODAL_OVERLAY }} />
        <View pointerEvents="box-none" style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28 }}>
          <View style={{ width: '100%', backgroundColor: colors.surfaceRaised, borderRadius: 24, padding: 22, borderWidth: 1, borderColor: colors.bg300, alignItems: 'center' }}>
            <View style={{ width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', backgroundColor: dark ? '#451A03' : '#FEF3C7' }}>
              <CarFront size={30} color={dark ? '#FCD34D' : '#B45309'} strokeWidth={2.2} />
            </View>
            <Text style={{ marginTop: 14, fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 19, color: colors.text100, textAlign: 'center' }}>
              {ka.run.transportCancelTitle}
            </Text>
            <Text style={{ marginTop: 8, fontFamily: 'NotoSansGeorgian_500Medium', fontSize: 13.5, lineHeight: 20, color: colors.text300, textAlign: 'center' }}>
              {ka.run.transportCancelBody}
            </Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                cancelRun();
                router.replace('/run' as never);
              }}
              style={{ marginTop: 18, alignSelf: 'stretch', height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: p.ctaBg }}
            >
              <Text style={{ fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 15, color: '#FFFFFF' }}>{ka.run.transportCancelOk}</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* confirm */}
      <Modal visible={confirm != null} {...APP_MODAL_PROPS} onRequestClose={() => setConfirm(null)}>
        <Pressable style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: APP_MODAL_OVERLAY }} onPress={() => setConfirm(null)} />
        <View pointerEvents="box-none" style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28 }}>
          <View style={{ width: '100%', backgroundColor: colors.surfaceRaised, borderRadius: 24, padding: 20, borderWidth: 1, borderColor: colors.bg300 }}>
            <Text style={{ fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 18, color: colors.text100 }}>
              {confirm === 'cancel' ? ka.run.cancelConfirmTitle : ka.run.finishConfirmTitle}
            </Text>
            <Text style={{ marginTop: 6, fontFamily: 'NotoSansGeorgian_500Medium', fontSize: 13.5, lineHeight: 20, color: colors.text300 }}>
              {confirm === 'cancel' ? ka.run.cancelConfirmBody : ka.run.finishConfirmBody}
            </Text>
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 18 }}>
              <Pressable
                accessibilityRole="button"
                onPress={() => setConfirm(null)}
                style={{ flex: 1, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg200 }}
              >
                <Text style={{ fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 14, color: colors.text200 }}>{ka.common.cancel}</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                onPress={() => void onFinish()}
                style={{ flex: 1, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: p.ctaBg }}
              >
                <Text style={{ fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 14, color: '#FFFFFF' }}>{ka.run.finishConfirmYes}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
