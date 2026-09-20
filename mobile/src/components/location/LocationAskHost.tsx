import React, { useEffect, useRef, useState } from 'react';
import { useSegments } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { LocationAskModal } from './LocationAskModal';
import { isDeviceAccessGateBlocking, isDeviceAccessGateFinished, subscribeDeviceAccessGate } from '@/lib/deviceAccess';
import { applyLocationToProfile, grantUserLocation, locationFromProfile, locationPostponedAt, postponeLocation } from '@/lib/userLocation';
import { shouldCompleteLocation } from '@/lib/locationCompletion';
import { localAccountId } from '@/lib/localAccount';
import { useAuth } from '@/store/AuthContext';

export function LocationAskHost() {
  const { user } = useAuth();
  return user ? <LocationAskForAccount key={user.id} owner={user.id} /> : null;
}
function LocationAskForAccount({ owner }: { owner: string }) {
  const { healthProfile, setHealthProfile } = useAuth(), segments = useSegments();
  const [busy, setBusy] = useState(false), [error, setError] = useState<string | null>(null);
  const [denied, setDenied] = useState(false), [dismissed, setDismissed] = useState(false);
  const [prefReady, setPrefReady] = useState(false), [postponed, setPostponed] = useState<number | null>(null);
  const [gateReady, setGateReady] = useState(() => isDeviceAccessGateFinished() && !isDeviceAccessGateBlocking());
  const lock = useRef(false), alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    void locationPostponedAt(owner).then(value => { if (alive.current) { setPostponed(value); setPrefReady(true); } }).catch(() => { if (alive.current) setPrefReady(true); });
    return () => { alive.current = false; };
  }, [owner]);
  useEffect(() => { const unsubscribe = subscribeDeviceAccessGate(() => setGateReady(isDeviceAccessGateFinished() && !isDeviceAccessGateBlocking())); return () => { unsubscribe(); }; }, []);
  const visible = prefReady && gateReady && segments[0] === '(tabs)' && !!healthProfile?.completedAt && !dismissed
    && shouldCompleteLocation(locationFromProfile(healthProfile), postponed);
  const current = () => alive.current && owner === localAccountId();
  const enable = async () => {
    if (lock.current || !healthProfile) return;
    lock.current = true; setBusy(true); setError(null); setDenied(false);
    try {
      const result = await grantUserLocation();
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
