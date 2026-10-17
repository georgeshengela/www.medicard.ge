import React, { useEffect, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ProfileSetupShell } from '@/components/profile/ProfileSetupShell';
import { Input } from '@/components/ui/Input';
import { REFERRAL_ART } from '@/constants/appArt';
import { useAccountQuery } from '@/hooks/useAccountQuery';
import { ka } from '@/i18n/ka';
import { ApiError, api } from '@/lib/api';
import { authErrorMessage } from '@/lib/authErrorMessage';
import { localAccountId } from '@/lib/localAccount';
import { petCareInstallId } from '@/lib/petCareReminderPrefs';
import { isPhoneRequiredError, offerPhoneVerification } from '@/lib/phoneGate';
import { FRESH } from '@/lib/queryClient';
import { publishMediCoinBalance } from '@/lib/quest/cache';
import { clearPendingReferralCode, normalizeReferralCode, readPendingReferralCode, type ReferralClaimResult } from '@/lib/referral';
import { useThemeColors } from '@/theme/colors';
import { hubText } from '@/theme/hub';

/**
 * „ვინ მოგიწვია?“ — enter an influencer's code (medicard.ge/promo) or a friend's code, once. Influencer codes need a
 * verified phone (offered here instead of an error); a friend's code pays both sides at once. Someone who already
 * entered a code sees who invited them. Prefilled from an invite link when there is one.
 */
export default function InviteCodeScreen() {
  const router = useRouter();
  const c = useThemeColors();
  const params = useLocalSearchParams<{ code?: string }>();
  const [code, setCode] = useState(normalizeReferralCode(params.code) ?? '');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<ReferralClaimResult | null>(null);
  const lock = useRef(false);
  const summary = useAccountQuery({ key: ['referrals', 'me'], fetch: () => api.referrals.me(), staleTime: FRESH.SHORT });
  const invitedBy = done ? null : summary.data?.invitedBy ?? null;
  const tooLate = !done && !invitedBy && summary.data ? !summary.data.canClaim : false;

  useEffect(() => {
    if (code) return;
    void readPendingReferralCode().then((pending) => {
      if (pending) setCode((current) => current || pending);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const leave = () => (router.canGoBack() ? router.back() : router.dismissTo('/profile' as never));

  const submit = async () => {
    if (done || invitedBy || tooLate) return leave();
    const normalized = normalizeReferralCode(code);
    if (!normalized) return setError(ka.referral.enterInvalid);
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError(null);
    const owner = localAccountId();
    try {
      const result = await api.referrals.claim(normalized, await petCareInstallId().catch(() => undefined));
      if (owner !== localAccountId()) return;
      if (typeof result.balance === 'number') publishMediCoinBalance(result.balance);
      await clearPendingReferralCode();
      setDone(result);
    } catch (e) {
      if (isPhoneRequiredError(e)) offerPhoneVerification(router, ka.referral.enterPhone);
      else if (e instanceof ApiError && e.status === 409) {
        setError(e.message);
        if (e.code === 'REFERRAL_ALREADY_CLAIMED' || e.code === 'REFERRAL_TOO_LATE') void clearPendingReferralCode();
      } else setError(authErrorMessage(e));
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };

  const title = done ? ka.referral.enterDoneTitle : invitedBy ? ka.referral.invitedAlreadyTitle : tooLate ? ka.referral.tooLateTitle : ka.referral.enterTitle;
  const body = done
    ? done.kind === 'influencer'
      ? ka.referral.enterDoneInfluencer(done.inviter ?? '', done.coins ?? 0)
      : done.coins
        ? ka.referral.enterDoneBody(done.coins, done.inviter ?? '')
        : ka.referral.enterDonePending(done.inviter ?? '')
    : invitedBy
      ? ka.referral.invitedAlreadyBody(invitedBy.name ?? '')
      : tooLate
        ? ka.referral.tooLateBody(summary.data?.claimWindowDays ?? 14)
        : ka.referral.enterBody;
  const closed = Boolean(done || invitedBy || tooLate);

  return (
    <ProfileSetupShell
      title={title}
      body={body}
      primaryLabel={closed ? ka.common.continue : ka.referral.enterCta}
      onPrimary={() => void submit()}
      onBack={leave}
      loading={busy}
      showStepper={false}
      heroArt={REFERRAL_ART.hero}
      canBack
      primaryDisabled={!closed && code.replace(/[^A-Za-z0-9]/g, '').length < 6}
    >
      {closed ? null : (
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
