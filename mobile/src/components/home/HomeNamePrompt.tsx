import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useTabChromeHidden } from '@/components/navigation/tabChrome';
import { NameForm } from '@/components/onboarding/NameForm';
import { QuietAction } from '@/components/onboarding/OnboardingKit';
import { APP_MODAL_PROPS, Modal } from '@/components/ui/appModal';
import { tx } from '@/i18n/locale';
import { api } from '@/lib/api';
import { fullNameFromForm, splitFullName } from '@/lib/assessmentForm';
import { authErrorMessage } from '@/lib/authErrorMessage';
import { namePromptDue } from '@/lib/namePrompt';
import { otaCardVisible } from '@/lib/otaUpdates';
import { realFullName } from '@/lib/displayName';
import { getPreference, setPreference } from '@/lib/storage';
import { useAuth } from '@/store/AuthContext';
import { useVelvet } from '@/theme/velvet';

const deviceKey = (userId: string) => `medicard.namePrompt.v1.${userId}`;

/**
 * Accounts made before registration asked the name (phone, Apple without a name, one-word names): Home
 * asks „როგორ მოგმართოთ?“ ONCE (owner 2026-10-11: „კითხე სახელი და გვარი ერთხელ“). The ask is stored on the
 * account (`extraAnswers.namePromptAt`, and on this device in case that write fails) the moment it opens,
 * so „მოგვიანებით“, closing or killing the app never brings it back. Nothing else of an existing account
 * changes. It waits for Home to settle and never opens over another sheet or the update card.
 */
export function HomeNamePrompt({ blocked, onOpenChange }: { blocked: boolean; onOpenChange: (open: boolean) => void }) {
  const { user, healthProfile, setUser, setHealthProfile } = useAuth();
  const { palette: p, dark } = useVelvet();
  const chromeHidden = useTabChromeHidden();
  const [open, setOpen] = useState(false);
  const [names, setNames] = useState({ firstName: '', lastName: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const busyRef = useRef(false);
  busyRef.current = blocked || chromeHidden || otaCardVisible();
  const due = namePromptDue(user, healthProfile);
  const userId = user?.id;

  useEffect(() => onOpenChange(open), [open, onOpenChange]);

  useFocusEffect(
    useCallback(() => {
      if (!due || !userId) return undefined;
      let left = false;
      const timer = setTimeout(() => {
        if (left || busyRef.current || AppState.currentState !== 'active') return;
        void getPreference(deviceKey(userId))
          .catch(() => null)
          .then((asked) => {
            if (left || asked || busyRef.current) return;
            // Asked once: remembered before it shows, on the device and on the account.
            void setPreference(deviceKey(userId), new Date().toISOString()).catch(() => undefined);
            void api.healthProfile
              .update({ extraAnswers: { namePromptAt: new Date().toISOString() } })
              .then((result) => setHealthProfile(result.profile))
              .catch(() => undefined);
            const known = splitFullName(realFullName(user, (healthProfile?.extraAnswers ?? {}) as Record<string, unknown>));
            setNames(known);
            setError(null);
            setOpen(true);
          });
      }, 900);
      return () => {
        left = true;
        clearTimeout(timer);
      };
      // The account and its profile are read when the timer fires; re-arming on every profile read is not needed.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [due, userId]),
  );

  const save = async () => {
    const fullName = fullNameFromForm(names);
    if (!fullName || busy) return;
    setBusy(true);
    setError(null);
    try {
      const result = await api.auth.updateProfile({ fullName });
      setUser(result.user);
      // The profile's own copy of the name (older saves read it first) follows the account name.
      const profile = await api.healthProfile.update({ extraAnswers: { legalName: fullName } }).catch(() => null);
      if (profile) setHealthProfile(profile.profile);
      setOpen(false);
    } catch (e) {
      setError(authErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  if (!open) return null;
  return (
    <Modal visible={open} {...APP_MODAL_PROPS} onRequestClose={() => (busy ? undefined : setOpen(false))}>
      <View style={{ flex: 1, backgroundColor: p.surface }}>
        <NameForm
          palette={p}
          dark={dark}
          firstName={names.firstName}
          lastName={names.lastName}
          onChange={(next) => setNames((current) => ({ ...current, ...next }))}
          onSubmit={() => void save()}
          busy={busy}
          error={error}
          subtitle={tx(
            'შენს ანგარიშს სახელი და გვარი აკლია — Medi სახელით მოგმართავს.',
            'Your account is missing your first and last name — Medi will call you by your first name.',
          )}
          submitLabel={tx('შენახვა', 'Save')}
          below={<QuietAction palette={p} label={tx('მოგვიანებით', 'Later')} disabled={busy} onPress={() => setOpen(false)} />}
        />
      </View>
    </Modal>
  );
}
