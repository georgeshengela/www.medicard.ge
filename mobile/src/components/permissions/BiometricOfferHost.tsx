/**
 * Not mounted since 2026-09-27 (App Review 5.1.1(iv): no message with "Not now" before a
 * permission sheet). Face ID is turned on from Profile → permissions instead.
 */
import { brandHex } from '@/theme/brandTone';
import React, { useEffect, useRef, useState } from 'react';
import { Platform, Pressable, Text, View } from 'react-native';
import { useSegments } from 'expo-router';
import * as LocalAuthentication from 'expo-local-authentication';
import { Fingerprint, ScanFace } from 'lucide-react-native';
import { APP_MODAL_OVERLAY, APP_MODAL_PROPS, Modal } from '@/components/ui/appModal';
import { ka } from '@/i18n/ka';
import { getBiometricCapability, type BiometricCapability } from '@/lib/biometricCapability';
import { shouldOfferBiometric } from '@/lib/biometricOffer';
import { isDeviceAccessGateBlocking, isDeviceAccessGateFinished, subscribeDeviceAccessGate } from '@/lib/deviceAccess';
import { getScopedPreference, localAccountId, setScopedPreference } from '@/lib/localAccount';
import { patchProfileExtra, setBiometricEnabled } from '@/lib/profileSetupFlow';
import { useAuth } from '@/store/AuthContext';
import { useThemeColors } from '@/theme/colors';
import { tx } from '@/i18n/locale';

const LAUNCHES_KEY = 'medicard.launches.v1';
let countedThisProcess = false;

/** One-time Face ID / Touch ID offer on Home from the second launch (moved out of onboarding). */
export function BiometricOfferHost() {
  const { user } = useAuth();
  return user && Platform.OS !== 'web' ? <BiometricOffer key={user.id} owner={user.id} /> : null;
}

function BiometricOffer({ owner }: { owner: string }) {
  const { user, healthProfile, setHealthProfile } = useAuth();
  const segments = useSegments();
  const c = useThemeColors();
  const [launches, setLaunches] = useState(0);
  const [cap, setCap] = useState<BiometricCapability | null>(null);
  const [gateDone, setGateDone] = useState(() => isDeviceAccessGateFinished() && !isDeviceAccessGateBlocking());
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const decided = useRef(false);

  useEffect(() => {
    let alive = true;
    void (async () => {
      const stored = Number(await getScopedPreference(LAUNCHES_KEY)) || 0;
      const next = countedThisProcess ? stored : stored + 1;
      if (!countedThisProcess) {
        countedThisProcess = true;
        await setScopedPreference(LAUNCHES_KEY, String(next));
      }
      const capability = await getBiometricCapability();
      if (alive && owner === localAccountId()) {
        setLaunches(next);
        setCap(capability);
      }
    })().catch(() => undefined);
    return () => { alive = false; };
  }, [owner]);

  useEffect(() => subscribeDeviceAccessGate(() => setGateDone(isDeviceAccessGateFinished() && !isDeviceAccessGateBlocking())), []);

  const extra = (healthProfile?.extraAnswers ?? {}) as Record<string, unknown>;
  useEffect(() => {
    if (decided.current || !cap) return;
    const show = shouldOfferBiometric({
      completed: !!healthProfile?.completedAt,
      alreadyPrompted: extra.faceIdPrompted === true || typeof extra.biometricEnabled === 'boolean',
      launches,
      available: cap.available,
      enrolled: cap.enrolled,
      onHome: (segments as string[]).join('/') === '(tabs)/home',
      otherPromptOpen: !gateDone,
    });
    if (show) { decided.current = true; setOpen(true); }
  }, [cap, launches, gateDone, segments, healthProfile?.completedAt, extra.faceIdPrompted, extra.biometricEnabled]);

  const finish = async (enabled: boolean) => {
    if (!healthProfile || !user) return;
    const updated = await patchProfileExtra(healthProfile, user, { faceIdPrompted: true, biometricEnabled: enabled });
    if (owner === localAccountId()) setHealthProfile(updated);
  };

  const enable = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const result = await LocalAuthentication.authenticateAsync({ promptMessage: ka.profileSetup.faceIdEnable, cancelLabel: ka.common.cancel });
      if (result.success) await setBiometricEnabled(true);
      await finish(result.success);
    } finally {
      setBusy(false);
      setOpen(false);
    }
  };

  const decline = async () => {
    setOpen(false);
    await finish(false).catch(() => undefined);
  };

  if (!open || !cap) return null;
  const face = cap.kind === 'face';
  const Icon = face ? ScanFace : Fingerprint;
  const title = face ? ka.profileSetup.faceIdTitle : Platform.OS === 'ios' ? ka.profileSetup.touchIdTitle : ka.profileSetup.fingerprintTitle;
  const body = face ? ka.profileSetup.faceIdBody : Platform.OS === 'ios' ? ka.profileSetup.touchIdBody : ka.profileSetup.fingerprintBody;
  return (
    <Modal visible {...APP_MODAL_PROPS} onRequestClose={() => void decline()}>
      <View style={{ flex: 1, justifyContent: 'center', paddingHorizontal: 20 }}>
        <Pressable accessibilityLabel={ka.common.close} onPress={() => void decline()} style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: APP_MODAL_OVERLAY }} />
        <View style={{ width: '100%', maxWidth: 420, alignSelf: 'center', padding: 22, gap: 14, borderRadius: 22, backgroundColor: c.surface, alignItems: 'center' }}>
          <Icon size={40} color={c.primary200} strokeWidth={1.6} />
          <Text style={{ fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 20, lineHeight: 28, color: c.text100, textAlign: 'center' }}>{title}</Text>
          <Text style={{ fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 14, lineHeight: 22, color: c.text200, textAlign: 'center' }}>{body}</Text>
          <Pressable accessibilityRole="button" disabled={busy} onPress={() => void enable()} style={{ alignSelf: 'stretch', minHeight: 50, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: brandHex('#0D9488'), opacity: busy ? 0.6 : 1 }}>
            <Text style={{ fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 16, color: '#FFFFFF' }}>{ka.profileSetup.faceIdEnable}</Text>
          </Pressable>
          <Pressable accessibilityRole="button" disabled={busy} onPress={() => void decline()} style={{ minHeight: 44, justifyContent: 'center' }}>
            <Text style={{ fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 15, color: c.text200 }}>{tx('ახლა არა', 'Not now')}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}
