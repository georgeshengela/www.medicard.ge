import React, { useEffect, useRef, useState } from 'react';
import { useSegments } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { LocationAskModal } from '@/components/location/LocationAskModal';
import {
  applyLocationToProfile,
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
  const dismissed = useRef(false);

  const onTabs = segments[0] === '(tabs)';
  const shouldAsk = Boolean(
    user && healthProfile?.completedAt && !dismissed.current && !isLocationPrompted(healthProfile),
  );

  useEffect(() => {
    void hydrateLocationPromptedPref().then((prompted) => {
      if (prompted) dismissed.current = true;
    });
  }, []);

  useEffect(() => {
    if (!shouldAsk || !onTabs || dismissed.current) {
      if (!shouldAsk) setVisible(false);
      return;
    }
    const timer = setTimeout(() => {
      if (dismissed.current || isLocationPrompted(healthProfile)) return;
      setVisible(true);
    }, 900);
    return () => clearTimeout(timer);
  }, [shouldAsk, onTabs, healthProfile]);

  const enable = async () => {
    if (!healthProfile) return;
    dismissed.current = true;
    markLocationPromptedLocal();
    setBusy(true);
    try {
      const result = await grantUserLocation();
      setHealthProfile(result.profile ?? applyLocationToProfile(healthProfile, result.snapshot));
      if (result.granted) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
      }
      setVisible(false);
    } finally {
      setBusy(false);
      setVisible(false);
    }
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
