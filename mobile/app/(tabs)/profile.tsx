import { brandHex } from '@/theme/brandTone';
import React, { useCallback, useState } from 'react';
import { Alert, Image, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Stack, useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  QrCode,
  Camera,
  BellRing,
  ClipboardCheck,
  Dumbbell,
  FileText,
  Gift,
  LayoutGrid,
  Link2,
  Lock,
  LogOut,
  Mail,
  ShieldCheck,
  Smartphone,
  Trash2,
} from 'lucide-react-native';
import { HomeSectionHeading } from '@/components/home/HomeSectionHeading';
import { ModuleWordmark } from '@/components/brand/ModuleWordmark';
import { ModulesSheet } from '@/components/home/ModulesSheet';
import { HomeMediQuestSection } from '@/components/quest/HomeMediQuestSection';
import { ProfilePetsSection } from '@/components/pets/ProfilePetsSection';
import { ProfileCoachSection, useProfileCoachVisible } from '@/components/coach/CoachEntry';
import { PrivateImage } from '@/components/coach/CoachUI';
import { useMyAvatarUrl } from '@/lib/myAvatar';
import { useKeyboardScroll } from '@/components/ui/KeyboardFormShell';
import { DeleteAccountModal } from '@/components/profile/DeleteAccountModal';
import { ProfileMenuRow } from '@/components/profile/ProfileMenuRow';
import { ProfilePreferencesCard } from '@/components/profile/ProfilePreferencesCard';
import { MedicalProfileSection } from '@/components/profile/MedicalProfileSection';
import { ProfileVersionCard } from '@/components/profile/ProfileVersionCard';
import { useTabBarInset } from '@/components/navigation/FloatingTabBar';
import { AVATAR_SOURCES, isAvatarId, normalizeAvatarForGender } from '@/constants/avatarAssets';
import { SUPPORT_EMAIL } from '@/constants/legal';
import { ka } from '@/i18n/ka';
import { ApiError } from '@/lib/api';
import { formatDate } from '@/lib/format';
import { displayEmail } from '@/lib/accountEmail';
import { profileCompletion } from '@/lib/profileCompletion';
import { openAppSystemSettings } from '@/lib/appPermissions';
import {
  isNotificationsEnabled,
  requestNotificationPermission,
  registerPushTokenWithServer,
  setPushOptedIn,
} from '@/lib/notifications';
import { ModuleToneProvider, useThemeColors } from '@/theme/colors';
import { HUB, hubText } from '@/theme/hub';
import { livingPlaceLine } from '@/lib/userLocation';
import { useAuth } from '@/store/AuthContext';
import { requestQuestRefresh } from '@/lib/quest/cache';
import { isFeatureOn, useFeatureState } from '@/lib/featureFlags';
import { rewardsApi } from '@/lib/quest/rewardsApi';
import { rewardsCopy } from '@/i18n/quest/rewards.js';
import { openEmail } from '@/lib/openEmail';
import { appLang, tx } from '@/i18n/locale';

export default function Profile() {
  const { user, refresh, signOut, deleteAccount, healthProfile } = useAuth();
  const colors = useThemeColors();
  const tabInset = useTabBarInset();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [refreshing, setRefreshing] = useState(false);
  const [notificationsOn, setNotificationsOn] = useState<boolean | null>(null);
  const features = useFeatureState();
  const coachOn = isFeatureOn('coach', features);
  const coachCard = useProfileCoachVisible();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [modulesOpen, setModulesOpen] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [profileAccent, setProfileAccent] = useState(false);
  const rewards = rewardsCopy(appLang());

  useFocusEffect(
    useCallback(() => {
      void (async () => {
        await refresh({ maxAgeMs: 60_000 });
        setNotificationsOn(await isNotificationsEnabled());
        try {
          const ents = await rewardsApi.entitlements();
          setProfileAccent(ents.items.some((item) => item.entitlementKey === 'quest.style.profile'));
        } catch {
          setProfileAccent(false);
        }
      })();
    }, [refresh]),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([refresh(), Promise.resolve(requestQuestRefresh())]);
    setRefreshing(false);
  }, [refresh]);

  const openNotificationSettings = async () => {
    const alreadyOn = await isNotificationsEnabled();
    if (alreadyOn) {
      router.push('/profile/notifications');
      return;
    }
    // Permission is requested here, from the tap, never from an effect.
    const asked = await requestNotificationPermission();
    if (asked) {
      await setPushOptedIn(true);
      await registerPushTokenWithServer({ skipPermissionProbe: true }).catch(() => undefined);
      setNotificationsOn(await isNotificationsEnabled());
      router.push('/profile/notifications');
      return;
    }
    setNotificationsOn(await isNotificationsEnabled());
    Alert.alert(ka.profile.notifications, ka.meds.notificationsDenied, [
      { text: ka.common.cancel, style: 'cancel' },
      { text: ka.permissions.openSettingsAction, onPress: () => void openAppSystemSettings() },
    ]);
  };

  const confirmSignOut = () => {
    Alert.alert(ka.auth.signOut, ka.auth.signOutConfirm, [
      { text: ka.common.cancel, style: 'cancel' },
      { text: ka.auth.signOut, style: 'destructive', onPress: () => signOut() },
    ]);
  };

  const confirmDelete = async () => {
    setDeleteBusy(true);
    try {
      await deleteAccount();
      setDeleteOpen(false);
    } catch (error) {
      Alert.alert(ka.profile.deleteAccount, error instanceof ApiError ? error.message : ka.profile.deleteAccountFailed);
    } finally {
      setDeleteBusy(false);
    }
  };

  const initials = user?.fullName
    ?.split(' ')
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();

  const extra = (healthProfile?.extraAnswers ?? {}) as Record<string, unknown>;
  const storedAvatar = typeof extra.avatarId === 'string' ? extra.avatarId : null;
  const avatarId = storedAvatar ? normalizeAvatarForGender(storedAvatar, user?.gender ?? null) : null;
  const avatarSource = avatarId && isAvatarId(avatarId) ? AVATAR_SOURCES[avatarId] : null;
  const myPhoto = useMyAvatarUrl();
  const [brokenPhoto, setBrokenPhoto] = useState<string | null>(null);
  // Keyboard: the inline medical-profile editor keeps its fields and Save above the keyboard.
  const kb = useKeyboardScroll();
  // Synthetic logins (phone / Apple without an address) are not mailboxes — never shown as the email.
  const email = displayEmail(user?.email);
  const completion = profileCompletion(healthProfile, user);
  const passportOn = isFeatureOn('healthPassport', features);

  return (
    <View {...kb.frameProps}>
    <ScrollView
      {...kb.scrollProps}
      style={{ flex: 1, backgroundColor: colors.bg100 }}
      contentContainerStyle={{ paddingBottom: tabInset, paddingTop: insets.top + 12, width: '100%', maxWidth: 760, alignSelf: 'center' }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary100} />}
      showsVerticalScrollIndicator={false}
    >
      <Stack.Screen options={{ headerShown: false }} />
      {/* Owner 2026-10-04: the page is titled MEDIPROFILE — the module header's wordmark + one muted line, no buttons (a tab has no back). */}
      <View style={{ paddingHorizontal: HUB.gutter, minHeight: 44, justifyContent: 'center' }}>
        <ModuleWordmark module="profile" />
        <Text numberOfLines={1} style={[s.subtitle, { color: colors.text200 }]}>
          {tx('ანგარიში, ჯანმრთელობა და პარამეტრები', 'Account, health and settings')}
        </Text>
      </View>

      {/* Identity */}
      <View style={[s.section, { marginTop: 16 }]}>
        <View style={[s.card, { backgroundColor: colors.surface, gap: 16 }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={tx('პროფილის სურათის შეცვლა', 'Change profile picture')}
              onPress={() => router.push('/profile/avatar' as never)}
              style={{
                width: 72,
                height: 72,
                borderRadius: 36,
                padding: 3,
                backgroundColor: profileAccent ? '#F59E0B' : colors.accent100,
              }}
            >
              <View style={{ flex: 1, borderRadius: 33, overflow: 'hidden', backgroundColor: colors.accent100, alignItems: 'center', justifyContent: 'center' }}>
                {myPhoto && brokenPhoto !== myPhoto ? (
                  <PrivateImage path={myPhoto} label={tx('პროფილის ფოტო', 'Profile photo')} style={{ width: 66, height: 66, borderRadius: 33 }} onFail={() => setBrokenPhoto(myPhoto)} />
                ) : avatarSource ? (
                  <Image source={avatarSource} resizeMode="contain" style={{ width: 66, height: 66, borderRadius: 33 }} />
                ) : (
                  <Text style={[hubText.value, { fontSize: 20, color: colors.primary100 }]}>{initials || '·'}</Text>
                )}
              </View>
              <View style={{ position: 'absolute', right: -2, bottom: -2, width: 24, height: 24, borderRadius: 12, backgroundColor: brandHex('#0D9488'), borderWidth: 2, borderColor: colors.surface, alignItems: 'center', justifyContent: 'center' }}>
                <Camera size={12} color="#FFFFFF" />
              </View>
            </Pressable>
            <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
              {/* One line (owner 2026-10-04): a long name shrinks a little instead of wrapping. */}
              <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75} style={[s.name, { color: colors.text100 }]}>
                {user?.fullName}
              </Text>
              {livingPlaceLine(healthProfile) ? (
                <Text numberOfLines={1} style={[hubText.caption, { color: colors.text200 }]}>
                  {livingPlaceLine(healthProfile)}
                </Text>
              ) : null}
              {user?.createdAt ? (
                <Text numberOfLines={1} style={[hubText.small, { color: colors.text300 }]}>
                  {ka.profile.memberSince} {formatDate(user.createdAt)}
                </Text>
              ) : null}
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={tx('ჩემი QR კოდი', 'My QR code')}
              onPress={() => router.push('/profile/qr' as never)}
              style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: colors.accent100, alignItems: 'center', justifyContent: 'center' }}
            >
              <QrCode size={22} color={colors.primary100} />
            </Pressable>
          </View>
          <View style={{ gap: 8, borderTopWidth: StyleSheet.hairlineWidth, borderColor: colors.bg300, paddingTop: 12 }}>
            {email ? <Fact label={ka.profile.email} value={email} /> : null}
            {user?.phone ? (
              <Fact label={ka.profile.phone} value={user.phone} />
            ) : (
              /* Store prizes, invites and the women's space need a verified phone — offer it here, not after a refusal. */
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={tx('ტელეფონის დადასტურება', 'Verify phone number')}
                onPress={() => router.push('/profile/verify-phone' as never)}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 32 }}
              >
                <Text style={[hubText.caption, { color: colors.text300 }]}>{ka.profile.phone}</Text>
                <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 6 }}>
                  <Smartphone size={15} color={colors.primary200} />
                  <Text numberOfLines={1} style={[hubText.link, { color: colors.primary200 }]}>{tx('დადასტურება', 'Verify')}</Text>
                </View>
              </Pressable>
            )}
          </View>
        </View>
      </View>

      {/* Owner 2026-10-03: Home has no „სერვისები“ block any more — every feature opens from here, so it sits right under the identity card. */}
      <View style={[s.section, { marginTop: 12 }]}>
        <View style={[s.list, { backgroundColor: colors.surface }]}>
          <ProfileMenuRow icon={LayoutGrid} ink="teal" label={tx('ყველა ფუნქცია', 'All features')} onPress={() => setModulesOpen(true)} isLast />
        </View>
      </View>

      {/* Quest — each module block disappears while an admin has it paused (admin „მოდულები“) */}
      {isFeatureOn('quest', features) ? (
        <View style={s.section}>
          <HomeSectionHeading title="MEDIQUEST" brand="quest" />
          {/* Inside the module tone: the card's ring and bar speak MEDIQUEST violet, like its pages. */}
          <ModuleToneProvider tone="quest">
            <HomeMediQuestSection edgeInset={0} hideTitle />
          </ModuleToneProvider>
        </View>
      ) : null}

      {/* Pets */}
      {isFeatureOn('pets', features) ? (
        <View style={s.section}>
          <HomeSectionHeading title="MEDIVET" brand="vet" linkLabel={tx('ყველას ნახვა', 'See all')} onLink={() => router.push('/pets')} />
          <ProfilePetsSection hideTitle />
        </View>
      ) : null}

      {/* MEDICOACH: the card only for people with a trainer link or a trainer profile; everyone else gets a row under „აპლიკაცია“ */}
      {coachOn && coachCard === true ? (
        <View style={{ paddingHorizontal: HUB.gutter }}>
          <ProfileCoachSection />
        </View>
      ) : null}

      {/* Medical profile */}
      <View style={s.section}>
        <HomeSectionHeading title={ka.profile.medicalProfile} />
        <MedicalProfileSection />
        {completion.percent < 100 || passportOn ? (
          <View style={[s.card, { backgroundColor: colors.surface, marginTop: 12 }]}>
            {completion.percent < 100 ? (
              <ProfileMenuRow
                icon={ClipboardCheck}
                ink="amber"
                label={ka.home.completeProfileTitle(completion.percent)}
                value={tx('დარჩენილი კითხვები', 'Remaining questions')}
                onPress={() => router.push('/profile/complete' as never)}
                isLast={!passportOn}
              />
            ) : null}
            {passportOn ? <ProfileMenuRow icon={FileText} ink="teal" label={ka.passport.profileRow} value={ka.passport.profileRowHint} onPress={() => router.push('/profile/health-passport' as never)} isLast /> : null}
          </View>
        ) : null}
      </View>

      {/* Settings */}
      <View style={s.section}>
        <HomeSectionHeading title={ka.profile.settings} />
        <View style={{ gap: 12 }}>
          <ProfilePreferencesCard />
          <View style={[s.list, { backgroundColor: colors.surface }]}>
            <ProfileMenuRow
              icon={BellRing}
              ink="amber"
              label={ka.profile.notifications}
              value={notificationsOn == null ? undefined : notificationsOn ? ka.meds.notificationsEnabled : ka.profile.notificationsOff}
              onPress={() => void openNotificationSettings()}
            />
            <ProfileMenuRow icon={Link2} ink="sky" label={ka.profile.permissions} onPress={() => router.push('/profile/permissions')} />
            <ProfileMenuRow icon={ShieldCheck} ink="teal" label={tx('AI და კონფიდენციალურობა', 'AI and privacy')} onPress={() => router.push('/profile/ai-data')} isLast />
          </View>
        </View>
      </View>

      {/* App */}
      <View style={s.section}>
        <HomeSectionHeading title={tx('აპლიკაცია', 'App')} />
        <View style={[s.list, { backgroundColor: colors.surface }]}>
          {coachOn && coachCard === false ? (
            <ProfileMenuRow icon={Dumbbell} ink="neutral" label={tx('ტრენერი და ფიტნესი', 'Trainer and fitness')} value="MEDICOACH" onPress={() => router.push('/trainer' as never)} />
          ) : null}
          {isFeatureOn('invites', features) ? <ProfileMenuRow icon={Gift} ink="amber" label={ka.referral.profileRow} onPress={() => router.push('/profile/invite' as never)} /> : null}
          <ProfileMenuRow icon={Lock} ink="neutral" label={ka.profile.privacyPolicy} onPress={() => router.push('/profile/privacy')} />
          <ProfileMenuRow icon={FileText} ink="neutral" label={ka.profile.terms} onPress={() => router.push('/profile/terms')} />
          <ProfileMenuRow icon={Mail} ink="neutral" label={ka.profile.support} value={ka.profile.supportEmail} onPress={() => void openEmail(SUPPORT_EMAIL)} />
          <ProfileVersionCard />
        </View>
      </View>

      {/* Account */}
      <View style={s.section}>
        <HomeSectionHeading title={ka.profile.account} />
        <View style={[s.list, { backgroundColor: colors.surface }]}>
          <ProfileMenuRow icon={LogOut} danger label={ka.auth.signOut} onPress={confirmSignOut} />
          <ProfileMenuRow icon={Trash2} danger label={ka.profile.deleteAccount} onPress={() => setDeleteOpen(true)} isLast />
        </View>
      </View>

      <Text style={[hubText.small, { color: colors.text300, textAlign: 'center', marginTop: 24, paddingHorizontal: HUB.gutter }]}>
        {ka.app.disclaimer}
      </Text>

      <ModulesSheet visible={modulesOpen} onClose={() => setModulesOpen(false)} />
      <DeleteAccountModal
        visible={deleteOpen}
        busy={deleteBusy}
        onClose={() => setDeleteOpen(false)}
        onConfirm={() => void confirmDelete()}
      />
      {kb.spacer}
    </ScrollView>
    </View>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  const colors = useThemeColors();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      <Text style={[hubText.caption, { color: colors.text300 }]}>{label}</Text>
      <Text numberOfLines={1} style={[hubText.link, { flex: 1, textAlign: 'right', color: colors.text100 }]}>
        {value}
      </Text>
    </View>
  );
}

const s = StyleSheet.create({
  section: { paddingHorizontal: HUB.gutter, marginTop: HUB.sectionGap },
  card: { borderRadius: HUB.cardRadius, padding: HUB.cardPad },
  list: { borderRadius: HUB.cardRadius, overflow: 'hidden' },
  name: { fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 17, lineHeight: 24 },
  subtitle: { fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 11, lineHeight: 17 },
});
