import React, { useEffect, useRef, useState } from 'react';
import { useSegments } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { LocationAskModal } from '@/components/location/LocationAskModal';
import {
  isDeviceAccessGateBlocking,
  isDeviceAccessGateFinished,
  subscribeDeviceAccessGate,
} from '@/lib/deviceAccess';
import {
  applyLocationToProfile,
  getLocationPermissionState,
  grantUserLocation,
  hydrateLocationPromptedPref,
  isLocationPrompted,
  markLocationPromptedLocal,
  skipUserLocation,
} from '@/lib/userLocation';
import { useAuth } from '@/store/AuthContext';

/** One-time location ask for users who finished onboarding before this screen existed. */
export function LocationAskHost() {
  const { user, healthProfile, setHealthProfile } = useAuth();
  const segments = useSegments();
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [osUndetermined, setOsUndetermined] = useState(false);
  const [gateReady, setGateReady] = useState(() => isDeviceAccessGateFinished() && !isDeviceAccessGateBlocking());
  const dismissed = useRef(false);

  useEffect(() => subscribeDeviceAccessGate(() => {
    setGateReady(isDeviceAccessGateFinished() && !isDeviceAccessGateBlocking());
  }), []);

  const onTabs = segments[0] === '(tabs)';
  const shouldAsk = Boolean(
    gateReady &&
      user &&
      healthProfile &&
      !dismissed.current &&
      (osUndetermined || (healthProfile.completedAt && !isLocationPrompted(healthProfile))),
  );

  useEffect(() => {
    void hydrateLocationPromptedPref();
    void getLocationPermissionState().then((state) => {
      if (state === 'undetermined') setOsUndetermined(true);
    });
  }, []);

  useEffect(() => {
    if (!shouldAsk || !onTabs || dismissed.current) {
      if (!shouldAsk) setVisible(false);
      return;
    }
    const timer = setTimeout(() => {
      if (dismissed.current) return;
      if (!osUndetermined && isLocationPrompted(healthProfile)) return;
      setVisible(true);
    }, 400);
    return () => clearTimeout(timer);
  }, [shouldAsk, onTabs, healthProfile, osUndetermined]);

  const enable = () => {
    if (!healthProfile) return;
    void (async () => {
      const result = await grantUserLocation();
      dismissed.current = true;
      setBusy(true);
      try {
        setHealthProfile(result.profile ?? applyLocationToProfile(healthProfile, result.snapshot));
        if (result.granted) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
        }
        setVisible(false);
      } finally {
        setBusy(false);
        setVisible(false);
      }
    })();
  };

  const skip = async () => {
    if (!healthProfile) return;
    dismissed.current = true;
    markLocationPromptedLocal();
    setBusy(true);
    try {
      const snapshot = await skipUserLocation();
      setHealthProfile(applyLocationToProfile(healthProfile, snapshot));
      setVisible(false);
    } finally {
      setBusy(false);
      setVisible(false);
    }
  };

  return <LocationAskModal visible={visible} busy={busy} onEnable={() => void enable()} onSkip={() => void skip()} />;
}
