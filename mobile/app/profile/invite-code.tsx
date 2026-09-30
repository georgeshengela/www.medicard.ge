import React, { useEffect, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ProfileSetupShell } from '@/components/profile/ProfileSetupShell';
import { Input } from '@/components/ui/Input';
import { REFERRAL_ART } from '@/constants/appArt';
import { ka } from '@/i18n/ka';
import { ApiError, api } from '@/lib/api';
import { authErrorMessage } from '@/lib/authErrorMessage';
import { localAccountId } from '@/lib/localAccount';
import { petCareInstallId } from '@/lib/petCareReminderPrefs';
import { clearPendingReferralCode, normalizeReferralCode, readPendingReferralCode } from '@/lib/referral';
import { useThemeColors } from '@/theme/colors';
import { hubText } from '@/theme/hub';

/** Enter a friend's invite code once (Phase 3.4). Prefilled from an invite link when there is one. */
export default function InviteCodeScreen() {
  const router = useRouter();
  const c = useThemeColors();
  const params = useLocalSearchParams<{ code?: string }>();
  const [code, setCode] = useState(normalizeReferralCode(params.code) ?? '');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const lock = useRef(false);

  useEffect(() => {
    if (code) return;
    void readPendingReferralCode().then((pending) => {
      if (pending) setCode((current) => current || pending);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const leave = () => (router.canGoBack() ? router.back() : router.replace('/profile/invite' as never));

  const submit = async () => {
    if (done) return leave();
    const normalized = normalizeReferralCode(code);
    if (!normalized) return setError(ka.referral.enterInvalid);
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError(null);
    const owner = localAccountId();
    try {
      await api.referrals.claim(normalized, await petCareInstallId().catch(() => undefined));
      if (owner !== localAccountId()) return;
      await clearPendingReferralCode();
      setDone(true);
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) {
        setError(e.message);
        if (e.code === 'REFERRAL_ALREADY_CLAIMED' || e.code === 'REFERRAL_TOO_LATE') void clearPendingReferralCode();
      } else setError(authErrorMessage(e));
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };

  return (
    <ProfileSetupShell
      title={done ? ka.referral.enterDoneTitle : ka.referral.enterTitle}
      body={done ? ka.referral.enterDoneBody : ka.referral.enterBody}
      primaryLabel={done ? ka.common.continue : ka.referral.enterCta}
      onPrimary={() => void submit()}
      onBack={leave}
      loading={busy}
      showStepper={false}
      heroArt={REFERRAL_ART.hero}
      canBack
      primaryDisabled={!done && code.replace(/[^A-Za-z0-9]/g, '').length < 6}
    >
      {done ? null : (
        <View style={{ paddingHorizontal: 16, paddingTop: 16, gap: 8 }}>
          <Input
            value={code}
            onChangeText={(v) => {
              setCode(v.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6));
              setError(null);
            }}
            placeholder={ka.referral.enterPlaceholder}
            autoCapitalize="characters"
            autoCorrect={false}
            autoComplete="off"
            maxLength={6}
            returnKeyType="done"
            onSubmitEditing={() => void submit()}
            accessibilityLabel={ka.referral.enterTitle}
            error={error}
            style={{ letterSpacing: 4, fontSize: 20 }}
          />
          <Text style={[hubText.caption, { color: c.text300 }]}>{ka.referral.noValue}</Text>
        </View>
      )}
    </ProfileSetupShell>
  );
}
