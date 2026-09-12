import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { ArrowLeft } from 'lucide-react-native';
import { APP_MODAL_OVERLAY, APP_MODAL_PROPS } from '@/components/ui/appModal';
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';
import { movementCopy, movementMediLine } from '@/i18n/world/movement.js';
import { ApiError } from '@/lib/api';
import { mediWorldApi } from '@/lib/mediWorld/api';
import { useMediWorldMovementAvailable } from '@/lib/mediWorld/enabled';
import { applyAuthoritativeWorldFromFinish } from '@/lib/mediWorld/worldEconomyCache.js';
import { armMovementInaccurateOnce, isMovementQaAllowed } from '@/lib/mediWorld/movementQa.js';
import type { MovementMode, MovementSession } from '@/lib/mediWorld/types';
import {
  getMovementPermission,
  locationServicesOn,
  movementSampleRejectReason,
  readMovementSample,
  requestMovementPermission,
  shouldSendMovementSample,
  startMovementWatch,
  stopMovementWatch,
  type MovementFix,
} from '@/lib/mediWorld/movementLocation';
import { QUEST } from '@/theme/questTokens';
import { useThemeColors } from '@/theme/colors';

/** Duration chips shown before start. Frozen after the server session exists. */
const TARGETS: Record<MovementMode, number[]> = {
  gentle_move: [5, 10, 15],
  walk: [5, 10, 15, 20, 30],
  run: [5, 10, 15, 20, 30],
};

type Step = 'intro' | 'setup' | 'safety' | 'locating' | 'ready' | 'session' | 'summary';

function formatClock(sec: number) {
  const s = Math.max(0, Math.floor(sec));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, '0')}`;
}

export default function MovementSessionScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const reduce = usePrefersReducedMotion();
  const enabled = useMediWorldMovementAvailable();
  const [locale, setLocale] = useState<'ka' | 'en'>('ka');
  const copy = useMemo(() => movementCopy(locale), [locale]);
  const [step, setStep] = useState<Step>('intro');
  const [mode, setMode] = useState<MovementMode>('walk');
  const [minutes, setMinutes] = useState(10);
  const [session, setSession] = useState<MovementSession | null>(null);
  const [banner, setBanner] = useState<string | null>(null);
  const [mediKey, setMediKey] = useState('start');
  const [offline, setOffline] = useState(false);
  const [abandonOpen, setAbandonOpen] = useState(false);
  const tokenRef = useRef<string | null>(null);
  const lastFix = useRef<MovementFix | null>(null);
  const inFlight = useRef(false);
  const fontTitle = { fontFamily: 'NotoSansGeorgian_700Bold' as const };
  const fontBody = { fontFamily: 'NotoSansGeorgian_400Regular' as const };
  const fontMed = { fontFamily: 'NotoSansGeorgian_500Medium' as const };

  const applySession = (next: MovementSession | null) => {
    setSession(next);
    if (next?.continuationToken) tokenRef.current = next.continuationToken;
    if (next?.mediKey) setMediKey(next.mediKey);
  };

  useFocusEffect(
    useCallback(() => {
      if (!enabled) return undefined;
      let live = true;
      void (async () => {
        try {
          const current = await mediWorldApi.movementCurrent();
          if (!live) return;
          if (current.session && ['active', 'paused'].includes(current.session.status)) {
            applySession(current.session);
            setStep('session');
            if (current.session.status === 'paused') setBanner('background');
          }
        } catch (error) {
          if (error instanceof ApiError && error.code === 'MOVEMENT_DISABLED') setBanner('off');
        }
      })();
      return () => {
        live = false;
        stopMovementWatch();
      };
    }, [enabled]),
  );

  const samplePayload = (fix: MovementFix, idempotencyKey: string, appState = 'active') => ({
    latitude: fix.latitude,
    longitude: fix.longitude,
    horizontalAccuracy: fix.accuracy ?? 999,
    locationTimestamp: fix.timestamp,
    mockLocation: fix.mocked,
    speedMps: fix.speedMps ?? undefined,
    appState,
    idempotencyKey,
  });

  const acquireFix = async () => {
    const services = await locationServicesOn();
    if (!services) {
      setBanner('services');
      return null;
    }
    const perm = await getMovementPermission();
    if (perm !== 'granted') {
      setBanner('denied');
      return null;
    }
    const fix = await readMovementSample();
    if (movementSampleRejectReason(fix)) {
      setBanner('lowgps');
      return null;
    }
    setBanner(null);
    return fix;
  };

  const prepareStart = async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setBanner(null);
    setStep('locating');
    try {
      const perm = await requestMovementPermission();
      if (perm !== 'granted' && perm !== 'granted_approximate') {
        setBanner('denied');
        return;
      }
      const fix = await acquireFix();
      if (!fix) return;
      lastFix.current = fix;
      setStep('ready');
    } finally {
      inFlight.current = false;
    }
  };

  const begin = async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setBanner(null);
    try {
      await mediWorldApi.updateMovementPreferences({ movementMode: mode, targetMinutes: minutes });
      const fix = await acquireFix();
      if (!fix) {
        setStep('locating');
        return;
      }
      const result = await mediWorldApi.startMovementSession({
        ...samplePayload(fix, `start:${Date.now()}`),
        movementMode: mode,
        targetMinutes: minutes,
      });
      if (!result.session) {
        setBanner('lowgps');
        setStep('locating');
        return;
      }
      applySession(result.session);
      lastFix.current = fix;
      setStep('session');
      setMediKey('start');
      if (!reduce) void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {
      setOffline(true);
      setBanner('offline');
      setStep('locating');
    } finally {
      inFlight.current = false;
    }
  };

  const sendSegment = async (fix: MovementFix, appState = 'active') => {
    if (!session?.id || !tokenRef.current || inFlight.current) return;
    if (!shouldSendMovementSample(lastFix.current, fix)) return;
    inFlight.current = true;
    try {
      const result = await mediWorldApi.submitMovementSegment(session.id, {
        ...samplePayload(fix, `seg:${fix.timestamp}`, appState),
        continuationToken: tokenRef.current,
      });
      setOffline(false);
      applySession(result.session);
      lastFix.current = fix;
      if (result.outcome === 'SEGMENT_INACCURATE' || result.outcome === 'SEGMENT_STALE') {
        setBanner('lowgps');
        setMediKey('low_gps');
      } else if (result.outcome === 'SEGMENT_MOTORIZED' || result.outcome === 'SEGMENT_TOO_FAST') setBanner('motorized');
      else if (result.outcome === 'SEGMENT_REANCHORED') setBanner('reanchor');
      else if (result.outcome === 'SEGMENT_GAP') setBanner('reanchor');
      else if (result.session?.status === 'paused') setBanner('motorized');
      else if (result.outcome === 'SEGMENT_ACCEPTED') setBanner(null);
      if (result.session?.completionRatioBps === 10_000 && !reduce) {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch {
      setOffline(true);
      setBanner('offline');
      stopMovementWatch();
      if (session.id) {
        try {
          await mediWorldApi.pauseMovementSession(session.id, `pause-offline:${Date.now()}`);
        } catch {
          /* still offline */
        }
      }
    } finally {
      inFlight.current = false;
    }
  };

  useEffect(() => {
    if (step !== 'session' || session?.status !== 'active' || offline) {
      stopMovementWatch();
      return undefined;
    }
    return startMovementWatch(
      (fix) => {
        void sendSegment(fix);
      },
      (state) => {
        if (state === 'inaccurate') {
          setBanner('lowgps');
          setMediKey('low_gps');
        }
      },
      () => {
        setBanner('background');
        if (session?.id) {
          void mediWorldApi.pauseMovementSession(session.id, `pause-bg:${Date.now()}`).then((result) => {
            applySession(result.session);
            setMediKey('background_return');
          }).catch(() => {});
        }
      },
    );
  }, [step, session?.id, session?.status, offline]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (status) => {
      if (status === 'active' && session?.status === 'paused') setBanner((prev) => prev || 'background');
    });
    return () => sub.remove();
  }, [session?.status]);

  const pause = async () => {
    if (!session?.id) return;
    stopMovementWatch();
    const result = await mediWorldApi.pauseMovementSession(session.id, `pause:${Date.now()}`);
    applySession(result.session);
    setMediKey('pause');
  };

  const resume = async () => {
    if (!session?.id) return;
    const fix = await acquireFix();
    if (!fix) return;
    try {
      const result = await mediWorldApi.resumeMovementSession(session.id, samplePayload(fix, `resume:${Date.now()}`));
      applySession(result.session);
      lastFix.current = fix;
      setBanner(null);
      setOffline(false);
    } catch {
      setOffline(true);
      setBanner('offline');
    }
  };

  const finish = async () => {
    if (!session?.id) return;
    stopMovementWatch();
    try {
      const result = await mediWorldApi.finishMovementSession(session.id, `finish:${session.id}`);
      applySession(result.session);
      applyAuthoritativeWorldFromFinish(result.world, {
        bondChanged: result.reward?.applied === true && result.reward?.reasonCode === 'PERSONAL_GOAL_COMPLETE',
      });
      setStep('summary');
      tokenRef.current = null;
    } catch {
      setOffline(true);
      setBanner('offline');
    }
  };

  const abandon = async () => {
    if (!session?.id) return;
    stopMovementWatch();
    const result = await mediWorldApi.abandonMovementSession(session.id, `abandon:${session.id}`);
    applySession(result.session);
    setAbandonOpen(false);
    setStep('summary');
    tokenRef.current = null;
  };

  const retryGps = async () => {
    if (session?.status === 'paused' || offline || banner === 'background' || banner === 'motorized') {
      await resume();
      return;
    }
    const fix = await acquireFix();
    if (fix) await sendSegment(fix);
  };

  const bannerText =
    banner === 'lowgps' ? copy.lowGps
      : banner === 'services' ? copy.servicesOff
        : banner === 'denied' ? copy.denied
          : banner === 'background' ? copy.backgroundReturn
            : banner === 'reanchor' ? copy.reanchor
              : banner === 'motorized' ? copy.motorized
                : banner === 'offline' ? copy.offline
                  : banner === 'off' ? copy.featureOff
                    : null;

  const quality = session?.accuracyQuality === 'good' ? copy.gpsGood : session?.accuracyQuality === 'poor' ? copy.gpsPoor : copy.gpsMixed;
  const progress = Math.min(100, Math.round((session?.completionRatioBps || 0) / 100));

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg100 }}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 8, paddingHorizontal: 16, paddingBottom: insets.bottom + 36 }}>
        <Pressable accessibilityRole="button" accessibilityLabel={copy.back} onPress={() => router.back()} className="active:opacity-75" style={{ width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' }}>
          <ArrowLeft size={22} color={colors.text100} strokeWidth={2.2} />
        </Pressable>
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
          <Chip label="ქარ" active={locale === 'ka'} onPress={() => setLocale('ka')} />
          <Chip label="EN" active={locale === 'en'} onPress={() => setLocale('en')} />
        </View>
        <Text accessibilityRole="header" maxFontSizeMultiplier={1.3} style={{ ...fontTitle, fontSize: 28, lineHeight: 34, color: colors.text100, marginTop: 16 }}>{copy.title}</Text>
        {!enabled ? <Text style={{ ...fontBody, fontSize: 15, color: colors.text200, marginTop: 12 }}>{copy.featureOff}</Text> : null}

        {step === 'intro' ? (
          <>
            <Text style={{ ...fontTitle, fontSize: 22, color: colors.text100, marginTop: 20 }}>{copy.introTitle}</Text>
            <Text style={{ ...fontBody, fontSize: 16, lineHeight: 24, color: colors.text200, marginTop: 10 }}>{copy.introLead}</Text>
            <Text style={{ ...fontBody, fontSize: 15, lineHeight: 22, color: colors.text200, marginTop: 10 }}>{copy.introPrivacy}</Text>
            <Primary label={copy.continue} onPress={() => setStep('setup')} />
          </>
        ) : null}

        {step === 'setup' ? (
          <>
            <Text style={{ ...fontTitle, fontSize: 20, color: colors.text100, marginTop: 18 }}>{copy.modeTitle}</Text>
            {(['gentle_move', 'walk', 'run'] as MovementMode[]).map((item) => (
              <Chip key={item} label={item === 'walk' ? copy.walk : item === 'run' ? copy.run : copy.gentle} active={mode === item} onPress={() => { setMode(item); setMinutes(item === 'gentle_move' ? 5 : 10); }} />
            ))}
            {mode === 'gentle_move' ? <Text style={{ ...fontBody, fontSize: 14, color: colors.text300, marginTop: 8 }}>{copy.gentleHint}</Text> : null}
            <Text style={{ ...fontTitle, fontSize: 20, color: colors.text100, marginTop: 22 }}>{copy.durationTitle}</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
              {TARGETS[mode].map((value) => (
                <Chip key={value} label={`${value} ${copy.minutes}`} active={minutes === value} onPress={() => setMinutes(value)} />
              ))}
            </View>
            <Text style={{ ...fontBody, fontSize: 14, lineHeight: 20, color: colors.text300, marginTop: 14 }}>{copy.clinicianHint}</Text>
            <Primary label={copy.continue} onPress={() => setStep('safety')} />
          </>
        ) : null}

        {step === 'safety' ? (
          <>
            <Text style={{ ...fontTitle, fontSize: 22, color: colors.text100, marginTop: 18 }}>{copy.safetyTitle}</Text>
            {[copy.safetyAware, copy.safetyPaths, copy.safetyDriving, copy.safetyStop, copy.safetyNotPrescription, copy.safetyForeground].map((line) => (
              <Text key={line} style={{ ...fontBody, fontSize: 15, lineHeight: 22, color: colors.text200, marginTop: 8 }}>{line}</Text>
            ))}
            <Primary label={copy.confirmSafety} onPress={() => { void prepareStart(); }} />
          </>
        ) : null}

        {step === 'locating' ? (
          <>
            <Text style={{ ...fontTitle, fontSize: 22, color: colors.text100, marginTop: 18 }}>{copy.locating}</Text>
            {bannerText ? <Text style={{ ...fontBody, fontSize: 15, lineHeight: 22, color: colors.text100, marginTop: 12 }}>{bannerText}</Text> : null}
            <Text style={{ ...fontBody, fontSize: 15, lineHeight: 22, color: colors.text200, marginTop: 10 }}>{copy.foregroundOnly}</Text>
            {banner === 'denied' ? <Primary label={copy.grantLocation} onPress={() => { void prepareStart(); }} /> : <Primary label={copy.continue} onPress={() => { void prepareStart(); }} />}
          </>
        ) : null}

        {step === 'ready' ? (
          <>
            <Text style={{ ...fontTitle, fontSize: 22, color: colors.text100, marginTop: 18 }}>{copy.gpsReady}</Text>
            <Text style={{ ...fontMed, fontSize: 16, color: colors.text200, marginTop: 12 }}>{movementMediLine(locale, 'start')}</Text>
            <Text style={{ ...fontBody, fontSize: 15, lineHeight: 22, color: colors.text200, marginTop: 10 }}>{copy.safetyForeground}</Text>
            <Primary label={copy.start} onPress={() => { void begin(); }} />
          </>
        ) : null}

        {step === 'session' ? (
          <>
            <Text style={{ ...fontMed, fontSize: 16, color: colors.text200, marginTop: 16 }}>{movementMediLine(locale, mediKey)}</Text>
            {bannerText ? <Text style={{ ...fontBody, fontSize: 15, lineHeight: 22, color: colors.text100, marginTop: 12 }}>{bannerText}</Text> : null}
            <Text style={{ ...fontTitle, fontSize: 42, color: colors.text100, marginTop: 18 }}>{formatClock(session?.acceptedDurationSec || 0)}</Text>
            <Text style={{ ...fontBody, fontSize: 14, color: colors.text300 }}>{copy.verifiedTime} · {copy.targetTime} {formatClock(session?.targetDurationSec || minutes * 60)}</Text>
            <View style={{ height: 8, borderRadius: 999, backgroundColor: colors.bg300, marginTop: 14, overflow: 'hidden' }}>
              <View style={{ width: `${progress}%`, height: '100%', backgroundColor: colors.primary200, borderRadius: 999 }} />
            </View>
            <Pressable
              onLongPress={() => {
                if (isMovementQaAllowed()) armMovementInaccurateOnce();
              }}
              delayLongPress={900}
              accessibilityRole="text"
              style={{ marginTop: 10 }}
            >
              <Text style={{ ...fontBody, fontSize: 13, color: colors.text300 }}>{copy.gpsQuality}: {quality}</Text>
            </Pressable>
            <Text style={{ ...fontBody, fontSize: 13, color: colors.text300, marginTop: 6 }}>{copy.noShame} {copy.noPace}</Text>
            {banner === 'lowgps' || banner === 'reanchor' ? (
              <Primary label={copy.retryLocation} onPress={() => void retryGps()} />
            ) : null}
            {session?.status === 'paused' || offline || banner === 'background' || banner === 'motorized' ? (
              <Primary label={copy.resume} onPress={() => void resume()} />
            ) : (
              <Primary label={copy.pause} onPress={() => void pause()} />
            )}
            <Primary label={copy.finish} onPress={() => void finish()} />
            <Pressable accessibilityRole="button" onPress={() => setAbandonOpen(true)} className="active:opacity-75" style={{ minHeight: 48, justifyContent: 'center', marginTop: 8 }}>
              <Text style={{ ...fontMed, fontSize: 16, color: colors.text300 }}>{copy.abandon}</Text>
            </Pressable>
          </>
        ) : null}

        {step === 'summary' ? (
          <>
            <Text style={{ ...fontTitle, fontSize: 24, color: colors.text100, marginTop: 20 }}>
              {session?.status === 'abandoned' || session?.status === 'expired' || session?.status === 'verification_failed'
                ? copy.noneTitle
                : (session?.completionRatioBps || 0) >= 10_000 ? copy.completeTitle : copy.partialTitle}
            </Text>
            <Text style={{ ...fontMed, fontSize: 16, color: colors.text200, marginTop: 12 }}>{movementMediLine(locale, session?.status === 'completed' && (session.completionRatioBps || 0) >= 10_000 ? 'complete' : session?.acceptedDurationSec ? 'partial' : 'none')}</Text>
            <Text style={{ ...fontBody, fontSize: 15, color: colors.text200, marginTop: 12 }}>{copy.verifiedTime}: {formatClock(session?.acceptedDurationSec || 0)}</Text>
            {session?.reward ? (
              <Text style={{ ...fontBody, fontSize: 15, color: colors.text200, marginTop: 8 }}>{copy.rewardNote}</Text>
            ) : null}
            <Primary label={copy.history} onPress={() => router.push('/medi-world/movement-history' as never)} />
          </>
        ) : null}
      </ScrollView>

      <Modal visible={abandonOpen} {...APP_MODAL_PROPS} onRequestClose={() => setAbandonOpen(false)}>
        <View style={{ flex: 1, justifyContent: 'flex-end' }}>
          <Pressable accessibilityRole="button" onPress={() => setAbandonOpen(false)} style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: APP_MODAL_OVERLAY }} />
          <View style={{ backgroundColor: colors.surface, padding: 20, paddingBottom: Math.max(insets.bottom, 20) + 12, borderTopLeftRadius: 24, borderTopRightRadius: 24 }}>
            <Text style={{ ...fontTitle, fontSize: 20, color: colors.text100 }}>{copy.abandonConfirm}</Text>
            <Primary label={copy.abandon} onPress={() => void abandon()} />
            <Pressable accessibilityRole="button" onPress={() => setAbandonOpen(false)} style={{ minHeight: 48, justifyContent: 'center' }}>
              <Text style={{ ...fontMed, fontSize: 16, color: colors.primary200 }}>{copy.keepGoing}</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  const colors = useThemeColors();
  return (
    <Pressable accessibilityRole="button" onPress={onPress} className="active:opacity-75" style={{ minHeight: 40, paddingHorizontal: 14, borderRadius: 999, borderWidth: 1, borderColor: active ? colors.primary200 : colors.bg300, justifyContent: 'center', marginTop: 8 }}>
      <Text style={{ fontFamily: 'NotoSansGeorgian_500Medium', fontSize: 14, color: active ? colors.primary200 : colors.text300 }}>{label}</Text>
    </Pressable>
  );
}

function Primary({ label, onPress }: { label: string; onPress: () => void }) {
  const colors = useThemeColors();
  return (
    <Pressable accessibilityRole="button" onPress={onPress} className="active:opacity-75" style={{ marginTop: 18, minHeight: 52, borderRadius: QUEST.radius, backgroundColor: colors.primary200, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 16, color: '#042F2E' }}>{label}</Text>
    </Pressable>
  );
}
