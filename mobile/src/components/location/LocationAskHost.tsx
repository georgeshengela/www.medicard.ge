import React, { useEffect, useRef, useState } from 'react';
import { useSegments } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { LocationAskModal } from './LocationAskModal';
import { isDeviceAccessGateBlocking, isDeviceAccessGateFinished, subscribeDeviceAccessGate } from '@/lib/deviceAccess';
import { applyLocationToProfile, getLocationPermissionState, grantUserLocation, locationFromProfile, locationPostponedAt, postponeLocation } from '@/lib/userLocation';
import { markPrimerAsked } from '@/lib/permissionPrimer';
import { shouldCompleteLocation } from '@/lib/locationCompletion';
import { localAccountId } from '@/lib/localAccount';
import { useAuth } from '@/store/AuthContext';

const LOCATION_SCREENS = new Set(['weather', 'pharmacy']);

export function LocationAskHost() {
  const { user } = useAuth();
  return user ? <LocationAskForAccount key={user.id} owner={user.id} /> : null;
}
function LocationAskForAccount({ owner }: { owner: string }) {
  const { healthProfile, setHealthProfile } = useAuth(), segments = useSegments();
  const [busy, setBusy] = useState(false), [error, setError] = useState<string | null>(null);
  const [denied, setDenied] = useState(false), [dismissed, setDismissed] = useState(false);
  const [prefReady, setPrefReady] = useState(false), [postponed, setPostponed] = useState<number | null>(null);
  const [osDenied, setOsDenied] = useState(false);
  const [gateReady, setGateReady] = useState(() => isDeviceAccessGateFinished() && !isDeviceAccessGateBlocking());
  const lock = useRef(false), alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    // Already refused in the OS: "Continue" could not show a sheet, so do not prime at all.
    void Promise.all([locationPostponedAt(owner), getLocationPermissionState().catch(() => null)])
      .then(([value, state]) => { if (alive.current) { setPostponed(value); setOsDenied(state === 'denied'); setPrefReady(true); } })
      .catch(() => { if (alive.current) setPrefReady(true); });
    return () => { alive.current = false; };
  }, [owner]);
  useEffect(() => { const unsubscribe = subscribeDeviceAccessGate(() => setGateReady(isDeviceAccessGateFinished() && !isDeviceAccessGateBlocking())); return () => { unsubscribe(); }; }, []);
  // Ask only where location is actually used (7-step onboarding no longer asks up front).
  // MEDIRUN asks from its own start button.
  const visible = prefReady && gateReady && LOCATION_SCREENS.has(String(segments[0])) && !!healthProfile?.completedAt && !dismissed && !osDenied
    && shouldCompleteLocation(locationFromProfile(healthProfile), postponed);
  const current = () => alive.current && owner === localAccountId();
  const enable = async () => {
    if (lock.current || !healthProfile) return;
    lock.current = true; setBusy(true); setError(null); setDenied(false);
    try {
      const result = await grantUserLocation();
      void markPrimerAsked('location');
      if (!current()) return;
      if (!result.granted) { setDenied(true); setError('ლოკაციის ნებართვა გამორთულია. შეგიძლია პარამეტრებიდან ჩართო ან მოგვიანებით დაუბრუნდე.'); return; }
      setHealthProfile(result.profile ?? applyLocationToProfile(healthProfile, result.snapshot));
      setDismissed(true);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
    } catch (caught) { if (current()) setError(caught instanceof Error ? caught.message : 'ქალაქი ვერ შეინახა. ხელახლა სცადე.'); }
    finally { lock.current = false; if (current()) setBusy(false); }
  };
  const skip = () => { if (lock.current) return; setDismissed(true); void postponeLocation(owner); };
  return <LocationAskModal visible={visible} busy={busy} error={error} denied={denied} onEnable={() => void enable()} onSkip={skip} />;
}
