import React, { useMemo, useRef, useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { OtpCodeInput } from '@/components/auth/OtpCodeInput';
import { ProfilePhoneField } from '@/components/profile/ProfilePhoneField';
import { ProfileSetupShell } from '@/components/profile/ProfileSetupShell';
import { ka } from '@/i18n/ka';
import { ApiError, api } from '@/lib/api';
import { authErrorMessage } from '@/lib/authErrorMessage';
import { localAccountId } from '@/lib/localAccount';
import { useAuth } from '@/store/AuthContext';

/**
 * Confirm a phone number when a feature needs it (women's space, rewards). Two steps on one
 * screen — number, then the SMS code — in the keyboard-safe setup shell, then back.
 */
export default function VerifyPhoneScreen() {
  const router = useRouter();
  const { user, setUser } = useAuth();
  const [local, setLocal] = useState('');
  const [code, setCode] = useState('');
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lock = useRef(false);
  const owner = useRef(localAccountId());

  const phone = useMemo(() => {
    const digits = local.replace(/\D/g, '').replace(/^995/, '').slice(0, 9);
    return /^5\d{8}$/.test(digits) ? `+995${digits}` : null;
  }, [local]);

  const leave = () => (router.canGoBack() ? router.back() : router.replace('/(tabs)/profile' as never));

  const run = async (work: () => Promise<void>) => {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError(null);
    try {
      await work();
    } catch (e) {
      const taken = e instanceof ApiError && (e.code === 'PHONE_TAKEN' || e.status === 409);
      setError(taken ? ka.auth.phoneTakenBody : authErrorMessage(e));
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };

  const send = () => run(async () => {
    if (!phone) {
      setError(ka.auth.invalidPhone);
      return;
    }
    await api.auth.phoneLinkStart(phone);
    setSentTo(phone);
    setCode('');
  });

  const confirm = () => run(async () => {
    if (!sentTo || code.trim().length < 4) return;
    const linked = await api.auth.phoneLinkVerify(sentTo, code.trim());
    if (owner.current !== localAccountId()) return; // account switched while waiting
    setUser(linked.user);
    leave();
  });

  if (!user) return null;

  return sentTo ? (
    <ProfileSetupShell
      title={ka.profileSetup.verifyTitle}
      body={ka.profileSetup.verifyBody(sentTo.replace(/(\+995)(\d{3})\d{3}(\d{3})/, '$1 $2 *** $3'))}
      primaryLabel={ka.phoneVerify.confirmCta}
      onPrimary={() => void confirm()}
      onBack={() => { setSentTo(null); setError(null); }}
      loading={busy}
      showStepper={false}
      canBack
      primaryDisabled={code.trim().length < 4}
    >
      <View style={{ alignItems: 'center', paddingTop: 24 }}>
        <OtpCodeInput value={code} onChange={setCode} error={error} length={4} variant="hero" />
      </View>
    </ProfileSetupShell>
  ) : (
    <ProfileSetupShell
      title={ka.phoneVerify.title}
      body={ka.phoneVerify.body}
      primaryLabel={ka.phoneVerify.sendCta}
      onPrimary={() => void send()}
      onBack={leave}
      loading={busy}
      showStepper={false}
      canBack
      primaryDisabled={!phone}
    >
      <View style={{ paddingHorizontal: 16, paddingTop: 16 }}>
        <ProfilePhoneField value={local} onChange={setLocal} error={error} />
      </View>
    </ProfileSetupShell>
  );
}
