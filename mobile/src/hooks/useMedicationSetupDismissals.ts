import { useCallback, useEffect, useRef, useState } from 'react';
import { getPreference, setPreference } from '@/lib/storage';
import { parseDismissedSetups, withDismissedSetup } from '@/lib/home/medicationSetup';

/**
 * „არა ახლა“ on Home's „დააყენე შეხსენება: <medicine>“ card, kept per account on this device. The key
 * is the account-scoped preference scheme (`<base>.<userId>`, as `scopedPrefKey` builds it), written
 * with the owner captured at the tap, so a sign-out or account switch in between never moves one
 * account's answer to another.
 */
const BASE = 'medicard.home.medSetupDismissed.v1';
const EMPTY: string[] = [];

const keyFor = (owner: string) => `${BASE}.${owner}`;

type Dismissed = { owner: string; names: string[] };

export function useMedicationSetupDismissals(userId: string | null | undefined) {
  const [state, setState] = useState<Dismissed | null>(null);
  const latest = useRef<Dismissed | null>(null);

  useEffect(() => {
    if (!userId) return undefined;
    let alive = true;
    void getPreference(keyFor(userId))
      .catch(() => null)
      .then((raw) => {
        // A „არა ახლა“ tapped meanwhile wins over the older stored list.
        if (!alive || latest.current?.owner === userId) return;
        // Unreadable storage counts as „none dismissed“: the card shows rather than silently vanishing.
        latest.current = { owner: userId, names: parseDismissedSetups(raw) };
        setState(latest.current);
      });
    return () => {
      alive = false;
    };
  }, [userId]);

  const dismiss = useCallback(
    (name: string) => {
      if (!userId) return;
      const current = latest.current?.owner === userId ? latest.current.names : EMPTY;
      latest.current = { owner: userId, names: withDismissedSetup(current, name) };
      setState(latest.current);
      void setPreference(keyFor(userId), JSON.stringify(latest.current.names)).catch(() => undefined);
    },
    [userId],
  );

  const loaded = Boolean(userId) && state?.owner === userId;
  return { loaded, names: loaded && state ? state.names : EMPTY, dismiss };
}
