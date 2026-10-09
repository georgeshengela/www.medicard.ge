/**
 * `/cycle/settings/privacy` — კონფიდენციალურობა (W2-9): Face ID / PIN lock (device), the discreet
 * privacy mode (server profile, general text on the lock screen) and partner sharing. Every switch
 * saves at once; nothing waits for a „შენახვა“.
 */
import { CyclePressable as Pressable } from '@/components/cycle/CyclePressable';
import React, { useEffect, useLayoutEffect, useState } from 'react';
import { ScrollView, Share, Text, View } from 'react-native';
import { useNavigation } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Baby, EyeOff, Heart, Link2, Lock, Share2, ShieldCheck, Sparkles } from 'lucide-react-native';
import {
  CycleAtmosphere,
  CycleCard,
  CycleLoading,
  CycleSection,
  cycleNavHeader,
  formatCycleDateKa,
} from '@/components/cycle/CycleUI';
import { ka } from '@/i18n/ka';
import { tx } from '@/i18n/locale';
import { api, ApiError, type CycleBundle } from '@/lib/api';
import { isCyclePrivacyLockEnabled, setCyclePrivacyLockEnabled, getCycleReminderPrefs } from '@/lib/cycleReminderPrefs';
import { syncCycleReminders } from '@/lib/cycleReminders';
import { putCycleBundle } from '@/lib/cycleViewCache';
import { isPostpartumReturnLearning } from '@/lib/cycleForecastEligibility';
import { cycleModeCapabilities } from '@/lib/cycleModes';
import { isCompleteCycleBundle } from '@/lib/cycleOfflineCore';
import { useCycleColors } from '@/theme/cycle';
import { SettingsDivider, SettingsNotice, SettingsRowSwitch, useCycleSettingsView, type CycleColors } from './CycleSettingsKit';

type SharePermissionKey = keyof NonNullable<CycleBundle['partnerShare']>['permissions'];

export const PARTNER_SHARE_BASE = 'https://medicard.ge/share/cycle/';

export function CyclePrivacySettings() {
  const c = useCycleColors();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { userId, bundle, loading } = useCycleSettingsView();
  const [privacyLock, setPrivacyLock] = useState<boolean | null>(null);
  /** Optimistic copy of the server's privacy mode while a write is on its way. */
  const [privacyOverride, setPrivacyOverride] = useState<boolean | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [msgTone, setMsgTone] = useState<'success' | 'error'>('success');

  useLayoutEffect(() => {
    navigation.setOptions(cycleNavHeader(c, ka.cycle.settingsPrivacy));
  }, [navigation, c]);

  useEffect(() => {
    let alive = true;
    void isCyclePrivacyLockEnabled().then((on) => {
      if (alive) setPrivacyLock(on);
    });
    return () => {
      alive = false;
    };
  }, []);

  const fail = (err: unknown) => {
    setMsgTone('error');
    setMsg(err instanceof ApiError ? err.message : ka.common.error);
  };

  const togglePrivacyLock = async (on: boolean) => {
    setPrivacyLock(on);
    await setCyclePrivacyLockEnabled(on);
  };

  const togglePrivacyMode = async (on: boolean) => {
    setMsg(null);
    setPrivacyOverride(on);
    try {
      const data = await api.cycle.updateProfile({ privacyEnabled: on });
      if (userId) putCycleBundle(userId, data);
      // Privacy mode masks the lock-screen text: re-plan the scheduled reminders with it at once. No fresh
      // bundle (CYC-06: saved, but the reload failed) → the one on screen with the new switch, so turning
      // it on never leaves unmasked reminders waiting for the next foreground.
      try {
        const planned = isCompleteCycleBundle(data)
          ? data
          : bundle
            ? { ...bundle, profile: { ...bundle.profile, privacyEnabled: on } }
            : null;
        if (planned) {
          const prefs = await getCycleReminderPrefs({ mode: planned.profile.mode });
          await syncCycleReminders(planned, prefs);
        }
      } catch {
        /* Reminders are re-planned on the next foreground. */
      }
      setMsgTone('success');
      setMsg(tx('შენახულია', 'Saved'));
    } catch (err) {
      fail(err);
    } finally {
      setPrivacyOverride(null);
    }
  };

  const toggleShare = async (on: boolean) => {
    setMsg(null);
    try {
      const data = await api.cycle.updateProfile({ enablePartnerShare: on });
      if (userId) putCycleBundle(userId, data);
      const code = data?.partnerShare?.code ?? data?.profile?.partnerShareCode;
      if (on && code) {
        await Share.share({ message: `${PARTNER_SHARE_BASE}${code}` });
        setMsgTone('success');
        setMsg(ka.common.share);
      } else if (on) {
        // Created, but no fresh bundle came back (CYC-06): the card shows the link with „გაზიარება“ once
        // the cycle view is fetched again.
        setMsgTone('success');
        setMsg(tx('შენახულია', 'Saved'));
      } else {
        setMsgTone('success');
        setMsg(ka.cycle.partnerOff);
      }
    } catch (err) {
      fail(err);
    }
  };

  const shareLink = async (code: string) => {
    setMsg(null);
    try {
      await Share.share({ message: `${PARTNER_SHARE_BASE}${code}` });
    } catch (err) {
      fail(err);
    }
  };

  const patchSharePerm = async (key: SharePermissionKey, value: boolean) => {
    setMsg(null);
    try {
      const data = await api.cycle.updateProfile({ sharePermissions: { [key]: value } });
      if (userId) putCycleBundle(userId, data);
    } catch (err) {
      fail(err);
    }
  };

  if (!bundle && loading) return <CycleLoading />;
  const privacy = privacyOverride ?? Boolean(bundle?.profile.privacyEnabled);

  return (
    <CycleAtmosphere>
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: insets.bottom + 32 }}
        showsVerticalScrollIndicator={false}
      >
        <SettingsNotice c={c} tone={msgTone} text={msg} />

        <CycleSection title={tx('ამ ტელეფონზე', 'On this phone')}>
          <CycleCard>
            <SettingsRowSwitch
              icon={Lock}
              label={ka.cycle.privacyLock}
              hint={tx('ციკლის გვერდები Face ID-ით ან PIN-ით იხსნება.', 'Cycle screens open with Face ID or your PIN.')}
              value={Boolean(privacyLock)}
              onChange={(v) => void togglePrivacyLock(v)}
              disabled={privacyLock === null}
              c={c}
            />
            <SettingsDivider c={c} />
            <SettingsRowSwitch
              icon={EyeOff}
              label={tx('დისკრეტული რეჟიმი', 'Discreet mode')}
              hint={ka.cycle.privacyHint}
              value={privacy}
              onChange={(v) => void togglePrivacyMode(v)}
              disabled={privacyOverride !== null}
              c={c}
            />
          </CycleCard>
        </CycleSection>

        <CycleSection title={tx('პარტნიორთან გაზიარება', 'Share with a partner')}>
          <PartnerShareCard
            c={c}
            share={bundle?.partnerShare ?? null}
            fallbackCode={bundle?.profile.partnerShareCode ?? null}
            paused={
              Boolean(bundle) &&
              (!cycleModeCapabilities(bundle?.profile.mode).showNextPeriodForecast || isPostpartumReturnLearning(bundle))
            }
            onCreate={() => void toggleShare(true)}
            onStop={() => void toggleShare(false)}
            onShare={(code) => void shareLink(code)}
            onPermission={(key, value) => void patchSharePerm(key, value)}
          />
        </CycleSection>

        <View style={{ flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: 4, gap: 10 }}>
          <ShieldCheck size={16} color={c.muted} style={{ marginTop: 2 }} />
          <Text style={{ color: c.muted, fontSize: 12, lineHeight: 17, flex: 1 }}>
            {tx(
              'შენი ნებართვის გარეშე გარე AI-ს მონაცემებს არ ვუგზავნით.',
              'Without your permission we do not send data to third-party AI.',
            )}
          </Text>
        </View>
      </ScrollView>
    </CycleAtmosphere>
  );
}

/**
 * Partner sharing: what the partner sees (four switches), the link, when it ends — a date in words,
 * never an ISO string — and one clear „გაზიარება“ button once a link exists.
 */
function PartnerShareCard({
  c,
  share,
  fallbackCode,
  paused,
  onCreate,
  onStop,
  onShare,
  onPermission,
}: {
  c: CycleColors;
  share: CycleBundle['partnerShare'] | null;
  fallbackCode: string | null;
  /** Pregnancy, postpartum, or back to tracking before forecasts return: the partner's page shows nothing. */
  paused: boolean;
  onCreate: () => void;
  onStop: () => void;
  onShare: (code: string) => void;
  onPermission: (key: SharePermissionKey, value: boolean) => void;
}) {
  const active = Boolean(share?.active);
  const code = share?.code ?? (active ? fallbackCode : null);
  const expires = share?.expiresAt ? formatCycleDateKa(share.expiresAt.slice(0, 10)) : null;
  return (
    <CycleCard>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
        <Link2 size={18} color={c.lavender} style={{ marginTop: 1 }} />
        <Text style={{ color: c.muted, marginLeft: 10, fontSize: 13, lineHeight: 19, flex: 1 }}>{ka.cycle.partnerShareHint}</Text>
      </View>

      {active ? (
        <>
          <View style={{ marginTop: 14, borderRadius: 14, backgroundColor: c.cardSoft, paddingHorizontal: 12, paddingVertical: 10 }}>
            <Text style={{ color: share?.partnerBound ? c.success : c.ink, fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 13 }}>
              {share?.partnerBound
                ? ka.cycle.partnerShareAccepted
                : tx('ბმული აქტიურია — პარტნიორი ჯერ არ შესულა', 'Link is active — your partner has not opened it yet')}
            </Text>
            {expires ? (
              <Text style={{ color: c.muted, fontSize: 12, lineHeight: 17, marginTop: 3 }}>
                {tx(`ბმულის ვადა: ${expires}`, `Link expires ${expires}`)}
              </Text>
            ) : null}
            {code ? (
              <Text style={{ color: c.mutedSoft, fontSize: 11.5, marginTop: 6 }} selectable numberOfLines={1}>
                medicard.ge/share/cycle/{code}
              </Text>
            ) : null}
            {paused ? (
              <Text style={{ color: c.muted, fontSize: 12, lineHeight: 17, marginTop: 6 }}>{ka.cycle.partnerSharePausedOwner}</Text>
            ) : null}
          </View>

          <Text style={{ color: c.ink, fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 13, marginTop: 16, marginBottom: 2 }}>
            {tx('რას ხედავს პარტნიორი', 'What your partner sees')}
          </Text>
          <SettingsRowSwitch
            icon={Heart}
            label={ka.cycle.partnerPermPeriod}
            value={Boolean(share?.permissions.period)}
            onChange={(v) => onPermission('period', v)}
            c={c}
          />
          <SettingsRowSwitch
            icon={Sparkles}
            label={ka.cycle.partnerPermPhase}
            value={Boolean(share?.permissions.cyclePhase)}
            onChange={(v) => onPermission('cyclePhase', v)}
            c={c}
          />
          <SettingsRowSwitch
            icon={Baby}
            label={ka.cycle.partnerPermFertile}
            value={Boolean(share?.permissions.fertileWindow)}
            onChange={(v) => onPermission('fertileWindow', v)}
            c={c}
          />
          <SettingsRowSwitch
            icon={EyeOff}
            label={ka.cycle.partnerPermSymptoms}
            value={Boolean(share?.permissions.symptoms)}
            onChange={(v) => onPermission('symptoms', v)}
            c={c}
          />
        </>
      ) : null}

      <View style={{ gap: 8, marginTop: 14 }}>
        {active && code ? (
          <ShareButton c={c} primary icon label={tx('გაზიარება', 'Share link')} onPress={() => onShare(code)} />
        ) : (
          <ShareButton c={c} primary icon label={ka.cycle.partnerOn} onPress={onCreate} />
        )}
        {active ? <ShareButton c={c} label={ka.cycle.partnerOff} onPress={onStop} /> : null}
      </View>
    </CycleCard>
  );
}

function ShareButton({
  c,
  label,
  onPress,
  primary = false,
  icon = false,
}: {
  c: CycleColors;
  label: string;
  onPress: () => void;
  primary?: boolean;
  icon?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={{
        flexDirection: 'row',
        gap: 8,
        backgroundColor: primary ? c.cta : c.creamDeep,
        borderRadius: 16,
        paddingVertical: 13,
        paddingHorizontal: 14,
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 48,
      }}
    >
      {icon ? <Share2 size={17} color={primary ? c.onPrimary : c.ink} strokeWidth={2.2} /> : null}
      <Text
        numberOfLines={2}
        style={{
          color: primary ? c.onPrimary : c.ink,
          fontFamily: 'NotoSansGeorgian_700Bold',
          fontSize: 14,
          textAlign: 'center',
          flexShrink: 1,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}
