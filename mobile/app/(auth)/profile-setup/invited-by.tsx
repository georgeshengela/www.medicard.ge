import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import { CalendarClock, CircleCheck, Gift } from 'lucide-react-native';
import { AuthShell } from '@/components/AuthShell';
import { VelvetAuthHeader } from '@/components/auth/VelvetAuthHeader';
import { VelvetButton } from '@/components/velvet/VelvetButton';
import { VelvetInput } from '@/components/velvet/VelvetInput';
import { ka } from '@/i18n/ka';
import { tx } from '@/i18n/locale';
import { ApiError, api } from '@/lib/api';
import { authErrorMessage } from '@/lib/authErrorMessage';
import { isFeatureOn, useFeatureState } from '@/lib/featureFlags';
import { localAccountId } from '@/lib/localAccount';
import { onboardingScreenBlocked, onboardingStepHref, useOnboardingDevPreview } from '@/lib/onboardingDevPreview';
import { petCareInstallId } from '@/lib/petCareReminderPrefs';
import { isPhoneRequiredError } from '@/lib/phoneGate';
import { publishMediCoinBalance } from '@/lib/quest/cache';
import { clearPendingReferralCode, normalizeReferralCode, readPendingReferralCode, savePendingReferralCode, type ReferralClaimResult } from '@/lib/referral';
import { useAuth } from '@/store/AuthContext';
import { useVelvet, velvetField } from '@/theme/velvet';

type Phase = 'checking' | 'ask' | 'skip';

/**
 * Onboarding, after the Home layout (owner 2026-10-16): „ვინ მოგიწვია?“ — the one moment a new person still
 * remembers who sent them, so the influencer (medicard.ge/promo) or the friend is credited. Optional: „გამოტოვება“
 * always continues. Same claim as Profile → „ვინ მოგიწვია?“ (/profile/invite-code). An influencer code without a
 * verified phone is kept and offered again on Home after sign-up (the pending-code offer), never blocking onboarding.
 * Skipped by itself when invites are paused or the account already has a code.
 */
export default function ProfileSetupInvitedByScreen() {
  const router = useRouter();
  const preview = useOnboardingDevPreview();
  const { palette: p, dark } = useVelvet();
  const { ready, user, healthProfile } = useAuth();
  const features = useFeatureState();
  const invitesOn = isFeatureOn('invites', features);
  const [phase, setPhase] = useState<Phase>('checking');
  const [coins, setCoins] = useState(25);
  const [windowDays, setWindowDays] = useState(7);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [savedForLater, setSavedForLater] = useState(false);
  const [done, setDone] = useState<ReferralClaimResult | null>(null);
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);

  useEffect(() => {
    if (!ready || !user) return;
    if (!invitesOn) {
      setPhase('skip');
      return;
    }
    let live = true;
    const owner = localAccountId();
    void readPendingReferralCode().then((pending) => {
      if (live && pending) setCode((current) => current || pending);
    });
    api.referrals
      .me()
      .then((summary) => {
        if (!live || owner !== localAccountId()) return;
        if (typeof summary.coinsPerSide === 'number' && summary.coinsPerSide > 0) setCoins(summary.coinsPerSide);
        if (typeof summary.influencerWindowDays === 'number' && summary.influencerWindowDays > 0) setWindowDays(summary.influencerWindowDays);
        setPhase(summary.invitedBy || !summary.canClaim ? 'skip' : 'ask');
      })
      // The summary is only a shortcut; without it the person can still try a code (the claim checks everything).
      .catch(() => live && setPhase('ask'));
    return () => {
      live = false;
    };
  }, [ready, user, invitesOn]);

  const next = onboardingStepHref('/(auth)/profile-setup/analyzing', preview);
  const goNext = () => router.replace(next as never);

  if (!ready) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: p.surface }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }
  if (!user || !healthProfile) return <Redirect href="/(auth)/sign-in" />;
  const blocked = onboardingScreenBlocked(preview, user, healthProfile);
  if (blocked === 'assessment') return <Redirect href="/(auth)/assessment" />;
  if (blocked === 'home') return <Redirect href="/(tabs)/home" />;
  if (phase === 'skip') return <Redirect href={next as never} />;
  if (phase === 'checking') {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: p.surface }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  const ready6 = code.replace(/[^A-Za-z0-9]/g, '').length === 6;
  const closed = Boolean(done || savedForLater);

  const submit = async () => {
    if (closed) return goNext();
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
      if (isPhoneRequiredError(e)) {
        // Kept for Home: right after sign-up the pending-code offer opens „ვინ მოგიწვია?“ with it, and the phone step there.
        await savePendingReferralCode(normalized);
        setSavedForLater(true);
      } else if (e instanceof ApiError && e.status === 409) {
        setError(e.message);
        if (e.code === 'REFERRAL_ALREADY_CLAIMED' || e.code === 'REFERRAL_TOO_LATE') void clearPendingReferralCode();
      } else setError(authErrorMessage(e));
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };

  const doneText = done
    ? done.kind === 'influencer'
      ? ka.referral.enterDoneInfluencer(done.inviter ?? '', done.coins ?? 0)
      : done.coins
        ? ka.referral.enterDoneBody(done.coins, done.inviter ?? '')
        : ka.referral.enterDonePending(done.inviter ?? '')
    : tx(
      'ინფლუენსერის კოდისთვის ტელეფონის დადასტურებაა საჭირო. კოდი შევინახეთ — რეგისტრაციის დასრულებისთანავე შემოგთავაზებთ.',
      'An influencer’s code needs a verified phone. We saved the code and will offer it right after sign-up.',
    );

  return (
    <AuthShell
      backgroundColor={p.surface}
      renderHeader={(compact, durationMs) => (
        <VelvetAuthHeader
          palette={p}
          dark={dark}
          title={done ? ka.referral.enterDoneTitle : ka.referral.enterTitle}
          titleKind="heading"
          subtitle={
            closed
              ? undefined
              : tx(
                `MEDICARD-ის შესახებ ინფლუენსერისგან ან მეგობრისგან გაიგე? შეიყვანე მისი კოდი და ${coins} Medi მონეტას საჩუქრად მიიღებ.`,
                `Heard about MEDICARD from an influencer or a friend? Enter their code and get ${coins} Medi Coins as a gift.`,
              )
          }
          compact={compact}
          durationMs={durationMs}
        />
      )}
      footer={
        <View style={{ gap: 10 }}>
          <VelvetButton
            palette={p}
            label={closed ? tx('გაგრძელება', 'Continue') : ka.referral.enterCta}
            busy={busy}
            disabled={!closed && !ready6}
            onPress={() => void submit()}
          />
          {closed ? null : <VelvetButton palette={p} tone="quiet" label={tx('გამოტოვება', 'Skip')} disabled={busy} onPress={goNext} />}
        </View>
      }
    >
      {closed ? (
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingHorizontal: 4 }}>
          <CircleCheck size={22} color={p.pulse} strokeWidth={2.2} style={{ marginTop: 2 }} />
          <Text style={{ flex: 1, fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 16, lineHeight: 24, color: p.text }}>{doneText}</Text>
        </View>
      ) : (
        <View style={{ gap: 14 }}>
          <VelvetInput
            palette={p}
            label={tx('კოდი', 'Code')}
            placeholder={ka.referral.enterPlaceholder}
            icon={Gift}
            value={code}
            onChangeText={(value) => {
              setCode(value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6));
              setError(null);
            }}
            error={error}
            autoCapitalize="characters"
            autoCorrect={false}
            autoComplete="off"
            maxLength={6}
            returnKeyType="done"
            onSubmitEditing={() => {
              if (ready6) void submit();
            }}
            accessibilityLabel={ka.referral.enterTitle}
            style={code ? { letterSpacing: 4, fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 18 } : undefined}
          />
          {/* Owner 2026-10-17: say plainly that the code can still be entered later. */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'flex-start',
              gap: 12,
              marginTop: 4,
              paddingHorizontal: 16,
              paddingVertical: 14,
              borderRadius: 18,
              backgroundColor: p.surface,
              boxShadow: velvetField(p),
            }}
          >
            <CalendarClock size={20} color={p.pulse} strokeWidth={2.1} style={{ marginTop: 1 }} />
            <Text style={{ flex: 1, fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 14, lineHeight: 21, color: p.text }}>
              {tx(
                `ახლა არ გაქვს კოდი? მოგვიანებითაც შეგიძლია შეიყვანო — პროფილში, „ვინ მოგიწვია?“-ში, რეგისტრაციიდან ${windowDays} დღის განმავლობაში.`,
                `No code right now? You can still enter it later — in Profile → “Who invited you?”, within ${windowDays} ${windowDays === 1 ? 'day' : 'days'} of signing up.`,
              )}
            </Text>
          </View>
          <Text style={{ marginHorizontal: 4, fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 13, lineHeight: 19, color: p.inkOff }}>
            {tx('კოდი ერთხელ შეიყვანება. Medi მონეტებს ფულადი ღირებულება არ აქვს.', 'A code can be entered once. Medi Coins have no cash value.')}
          </Text>
        </View>
      )}
    </AuthShell>
  );
}
