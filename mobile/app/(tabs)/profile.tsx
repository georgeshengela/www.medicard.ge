import React, { useCallback, useState } from 'react';
import { Alert, Image, Linking, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import {
  BellRing,
  FileText,
  Link2,
  Lock,
  LogOut,
  Mail,
  MessageSquareText,
  Pill,
  Save,
  ShieldCheck,
  Sparkles,
  Trash2,
  type LucideIcon,
} from 'lucide-react-native';
import { Button } from '@/components/ui/Button';
import { DateField } from '@/components/ui/DateField';
import { GenderSelect } from '@/components/ui/GenderSelect';
import { ThemeSelect } from '@/components/ui/ThemeSelect';
import { DefaultHomePrompt } from '@/components/home/DefaultHomePrompt';
import { HomeLandingSelect } from '@/components/home/HomeLandingSelect';
import { HomeSectionHeading } from '@/components/home/HomeSectionHeading';
import { HomeMediQuestSection } from '@/components/quest/HomeMediQuestSection';
import { ProfilePetsSection } from '@/components/pets/ProfilePetsSection';
import { DeleteAccountModal } from '@/components/profile/DeleteAccountModal';
import { ProfileMenuRow } from '@/components/profile/ProfileMenuRow';
import { ProfileVersionCard } from '@/components/profile/ProfileVersionCard';
import { useTabBarInset } from '@/components/navigation/FloatingTabBar';
import { AVATAR_SOURCES, isAvatarId, normalizeAvatarForGender } from '@/constants/avatarAssets';
import { SUPPORT_MAILTO } from '@/constants/legal';
import { resolveConditionLabel } from '@/constants/conditionCatalog';
import { ka } from '@/i18n/ka';
import { ApiError, type Gender } from '@/lib/api';
import { isoToDisplay, parseBirthDate } from '@/lib/birthdate';
import { displayWeightForUnit } from '@/lib/assessmentForm';
import { cmToInches, formatHeightInches } from '@/components/assessment/HeightWheelPicker';
import { MedicalSourcesLink } from '@/components/health/MedicalSourcesLink';
import { bmiCategory, bmiFromWeight } from '@/lib/bmi';
import { formatDate } from '@/lib/format';
import { openAppSystemSettings } from '@/lib/appPermissions';
import {
  isNotificationsEnabled,
  requestNotificationPermission,
  registerPushTokenWithServer,
  setPushOptedIn,
} from '@/lib/notifications';
import { getCyclePromptSeen } from '@/lib/homeScreenPrefs';
import { useIsDark, useThemeColors } from '@/theme/colors';
import { HUB, hubInk, hubText, hubTint, type HubInk } from '@/theme/hub';
import { livingPlaceLine } from '@/lib/userLocation';
import { useAuth } from '@/store/AuthContext';
import { requestQuestRefresh } from '@/lib/quest/cache';
import { rewardsApi } from '@/lib/quest/rewardsApi';
import { rewardsCopy } from '@/i18n/quest/rewards.js';

const GENDER_LABELS: Record<Gender, string> = {
  MALE: ka.auth.genderMale,
  FEMALE: ka.auth.genderFemale,
  OTHER: ka.auth.genderOther,
};

function optionLabel(group: 'smokingStatus' | 'chronicConditions', key: string): string {
  if (group === 'chronicConditions') return resolveConditionLabel(key);
  const map = ka.assessment.options[group] as Record<string, string>;
  return map[key] ?? key;
}

export default function Profile() {
  const { user, stats, refresh, signOut, deleteAccount, healthProfile } = useAuth();
  const colors = useThemeColors();
  const tabInset = useTabBarInset();
  const router = useRouter();

  const [refreshing, setRefreshing] = useState(false);
  const [notificationsOn, setNotificationsOn] = useState<boolean | null>(null);
  const [showCyclePrompt, setShowCyclePrompt] = useState(false);
  const [editingMedical, setEditingMedical] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [profileAccent, setProfileAccent] = useState(false);
  const rewards = rewardsCopy('ka');

  useFocusEffect(
    useCallback(() => {
      void (async () => {
        await refresh();
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

  const bmi = healthProfile?.bmi ?? bmiFromWeight(healthProfile?.weightKg, healthProfile?.heightCm);
  const smoking = healthProfile?.smokingStatus != null ? optionLabel('smokingStatus', healthProfile.smokingStatus) : null;
  const allergyLabels = (healthProfile?.allergies ?? [])
    .filter((item) => item && item !== 'none')
    .map((item) => optionLabel('chronicConditions', item));
  const conditionLabels = (healthProfile?.chronicConditions ?? [])
    .filter((item) => item && item !== 'none')
    .map((item) => optionLabel('chronicConditions', item));

  const facts: { label: string; value: string }[] = [];
  if (user?.gender) facts.push({ label: ka.auth.gender, value: GENDER_LABELS[user.gender] });
  if (user?.age != null) facts.push({ label: ka.profile.age, value: `${user.age} ${ka.profile.years}` });
  if (user?.birthDate) facts.push({ label: ka.auth.birthDate, value: isoToDisplay(user.birthDate) || '' });
  if (healthProfile?.heightCm != null)
    facts.push({
      label: ka.profile.height,
      value:
        extra.heightUnit === 'ft'
          ? formatHeightInches(cmToInches(healthProfile.heightCm))
          : `${Math.round(healthProfile.heightCm)} ${ka.profile.cm}`,
    });
  if (healthProfile?.weightKg != null) {
    const shown = displayWeightForUnit(healthProfile.weightKg, extra.weightUnit === 'lbs' ? 'lbs' : 'kg');
    facts.push({ label: ka.profile.weight, value: `${shown.value} ${shown.unitLabel === 'lbs' ? ka.assessment.lbs : ka.profile.kg}` });
  }
  if (bmi != null) facts.push({ label: ka.profile.bmi, value: `${bmi.toFixed(1)} · ${ka.home.bmi.categories[bmiCategory(bmi)]}` });
  if (healthProfile?.bloodType) facts.push({ label: ka.profile.bloodType, value: healthProfile.bloodType });
  if (smoking) facts.push({ label: ka.profile.smoking, value: smoking });
  if (allergyLabels.length) facts.push({ label: ka.profile.allergies, value: allergyLabels.join(', ') });
  if (conditionLabels.length) facts.push({ label: ka.profile.conditions, value: conditionLabels.join(', ') });

  const hasMedical = Boolean(user?.gender && user?.birthDate);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg100 }}
      contentContainerStyle={{ paddingBottom: tabInset, paddingTop: 6, width: '100%', maxWidth: 760, alignSelf: 'center' }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary100} />}
      showsVerticalScrollIndicator={false}
    >
      {/* Identity */}
      <View style={[s.section, { marginTop: 8 }]}>
        <View style={[s.card, { backgroundColor: colors.surface, gap: 16 }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
            <View
              accessibilityLabel={profileAccent ? `${rewards.title} accent` : undefined}
              style={{
                width: 72,
                height: 72,
                borderRadius: 36,
                padding: 3,
                backgroundColor: profileAccent ? '#F59E0B' : colors.accent100,
              }}
            >
              <View style={{ flex: 1, borderRadius: 33, overflow: 'hidden', backgroundColor: colors.accent100, alignItems: 'center', justifyContent: 'center' }}>
                {avatarSource ? (
                  <Image source={avatarSource} resizeMode="contain" style={{ width: 66, height: 66, borderRadius: 33 }} />
                ) : (
                  <Text style={[hubText.value, { fontSize: 20, color: colors.primary100 }]}>{initials || '·'}</Text>
                )}
              </View>
            </View>
            <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
              <Text numberOfLines={2} style={[s.name, { color: colors.text100 }]}>
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
          </View>
          {user?.email || user?.phone ? (
            <View style={{ gap: 8, borderTopWidth: StyleSheet.hairlineWidth, borderColor: colors.bg300, paddingTop: 12 }}>
              {user?.email ? <Fact label={ka.profile.email} value={user.email} /> : null}
              {user?.phone ? <Fact label={ka.profile.phone} value={user.phone} /> : null}
            </View>
          ) : null}
        </View>
      </View>

      {/* Stats: three doors, not three numbers */}
      <View style={s.section}>
        <HomeSectionHeading title={ka.profile.stats} />
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <StatTile icon={FileText} ink="teal" value={stats?.records ?? 0} label={ka.profile.statRecords} onPress={() => router.push('/(tabs)/records')} />
          <StatTile icon={MessageSquareText} ink="blue" value={stats?.chats ?? 0} label={ka.profile.statChats} onPress={() => router.push('/(tabs)/records')} />
          <StatTile icon={Pill} ink="violet" value={stats?.activeMedications ?? 0} label={ka.profile.statMeds} onPress={() => router.push('/(tabs)/medications')} />
        </View>
      </View>

      {/* Quest */}
      <View style={s.section}>
        <HomeSectionHeading title="MEDI QUEST" />
        <HomeMediQuestSection edgeInset={0} hideTitle />
      </View>

      {/* Pets */}
      <View style={s.section}>
        <HomeSectionHeading title="ჩემი ცხოველები" linkLabel="ყველას ნახვა" onLink={() => router.push('/pets')} />
        <ProfilePetsSection hideTitle />
      </View>

      {/* Medical profile */}
      <View style={s.section}>
        <HomeSectionHeading
          title={ka.profile.medicalProfile}
          linkLabel={hasMedical && !editingMedical ? ka.profile.editMedical : undefined}
          onLink={hasMedical && !editingMedical ? () => setEditingMedical(true) : undefined}
        />
        {hasMedical && !editingMedical ? (
          <View style={[s.card, { backgroundColor: colors.surface, paddingVertical: 4 }]}>
            {facts.map((fact, index) => (
              <View key={fact.label}>
                <View style={[s.factRow, index ? { borderTopWidth: StyleSheet.hairlineWidth, borderColor: colors.bg300 } : null]}>
                  <Text style={[hubText.body, { color: colors.text200, flex: 1 }]}>{fact.label}</Text>
                  <Text style={[hubText.cardTitle, { color: colors.text100, maxWidth: '60%', textAlign: 'right', fontSize: 14, lineHeight: 20 }]}>
                    {fact.value}
                  </Text>
                </View>
                {fact.label === ka.profile.bmi ? (
                  <View style={{ paddingBottom: 6 }}>
                    <MedicalSourcesLink sourceIds={['bmi']} />
                  </View>
                ) : null}
              </View>
            ))}
          </View>
        ) : (
          <MedicalProfileCard
            onFemaleSaved={() => setShowCyclePrompt(true)}
            onSaved={() => setEditingMedical(false)}
            allowCancel={hasMedical}
            onCancel={() => setEditingMedical(false)}
          />
        )}
      </View>

      {/* Settings */}
      <View style={s.section}>
        <HomeSectionHeading title={ka.profile.settings} />
        <View style={{ gap: 12 }}>
          <View style={[s.card, { backgroundColor: colors.surface, gap: 10 }]}>
            <Text style={[hubText.caption, { color: colors.text200 }]}>{ka.profile.appearance}</Text>
            <ThemeSelect />
          </View>
          {user?.gender === 'FEMALE' ? (
            <View style={[s.card, { backgroundColor: colors.surface, gap: 10 }]}>
              <Text style={[hubText.caption, { color: colors.text200 }]}>{ka.profile.homeLandingTitle}</Text>
              <HomeLandingSelect />
            </View>
          ) : null}
          <View style={[s.list, { backgroundColor: colors.surface }]}>
            <ProfileMenuRow
              icon={BellRing}
              ink="amber"
              label={ka.profile.notifications}
              value={notificationsOn == null ? undefined : notificationsOn ? ka.meds.notificationsEnabled : ka.profile.notificationsOff}
              onPress={() => void openNotificationSettings()}
            />
            <ProfileMenuRow icon={Link2} ink="sky" label={ka.profile.permissions} onPress={() => router.push('/profile/permissions')} />
            <ProfileMenuRow
              icon={Sparkles}
              ink="violet"
              label={ka.profile.aiEngine}
              value={
                user?.aiEngine === 'ling_free'
                  ? ka.profile.aiEngineLing
                  : user?.aiEngine === 'evidencemd'
                    ? ka.profile.aiEngineEvidence
                    : ka.profile.aiEngineGemini
              }
              onPress={() => router.push('/profile/ai')}
            />
            <ProfileMenuRow icon={ShieldCheck} ink="teal" label="AI და კონფიდენციალურობა" onPress={() => router.push('/profile/ai-data')} isLast />
          </View>
        </View>
      </View>

      {/* App */}
      <View style={s.section}>
        <HomeSectionHeading title="აპლიკაცია" />
        <View style={[s.list, { backgroundColor: colors.surface }]}>
          <ProfileMenuRow icon={Lock} ink="neutral" label={ka.profile.privacyPolicy} onPress={() => router.push('/profile/privacy')} />
          <ProfileMenuRow icon={FileText} ink="neutral" label={ka.profile.terms} onPress={() => router.push('/profile/terms')} />
          <ProfileMenuRow icon={Mail} ink="neutral" label={ka.profile.support} value={ka.profile.supportEmail} onPress={() => void Linking.openURL(SUPPORT_MAILTO)} />
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

      <DefaultHomePrompt visible={showCyclePrompt} onClose={() => setShowCyclePrompt(false)} />
      <DeleteAccountModal
        visible={deleteOpen}
        busy={deleteBusy}
        onClose={() => setDeleteOpen(false)}
        onConfirm={() => void confirmDelete()}
      />
    </ScrollView>
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

function StatTile({
  icon: Icon,
  ink,
  value,
  label,
  onPress,
}: {
  icon: LucideIcon;
  ink: HubInk;
  value: number;
  label: string;
  onPress: () => void;
}) {
  const colors = useThemeColors();
  const dark = useIsDark();
  const inkHex = hubInk(ink, dark);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${value} ${label}`}
      onPress={onPress}
      style={[s.stat, { backgroundColor: colors.surface }]}
    >
      <View style={{ width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: hubTint(inkHex, dark) }}>
        <Icon size={18} color={inkHex} strokeWidth={2} />
      </View>
      <Text style={[hubText.value, { fontSize: 22, lineHeight: 28, color: colors.text100 }]}>{value}</Text>
      <Text numberOfLines={1} style={[hubText.small, { color: colors.text200 }]}>{label}</Text>
    </Pressable>
  );
}

function MedicalProfileCard({
  onFemaleSaved,
  onSaved,
  allowCancel,
  onCancel,
}: {
  onFemaleSaved?: () => void;
  onSaved?: () => void;
  allowCancel?: boolean;
  onCancel?: () => void;
}) {
  const { user, updateProfile } = useAuth();
  const colors = useThemeColors();

  const [gender, setGender] = useState<Gender | null>(user?.gender ?? null);
  const [birthDate, setBirthDate] = useState(user?.birthDate ? (isoToDisplay(user.birthDate) || '') : '');
  const [errors, setErrors] = useState<{ gender?: string; birthDate?: string; form?: string }>({});
  const [busy, setBusy] = useState(false);

  const save = async () => {
    const next: typeof errors = {};
    if (!gender) next.gender = ka.auth.selectGender;
    const parsed = parseBirthDate(birthDate);
    if (!parsed.ok) next.birthDate = parsed.error;
    setErrors(next);
    if (!gender || !parsed.ok) return;
    setBusy(true);
    try {
      await updateProfile({ gender, birthDate: parsed.iso });
      if (gender === 'FEMALE') {
        const seen = await getCyclePromptSeen();
        if (!seen) onFemaleSaved?.();
      }
      onSaved?.();
    } catch (error) {
      setErrors({ form: error instanceof ApiError ? error.message : ka.common.error });
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={[s.card, { backgroundColor: colors.surface, gap: 14 }]}>
      <View style={{ gap: 4 }}>
        <Text style={[hubText.cardTitle, { color: colors.text100 }]}>{ka.profile.completeProfile}</Text>
        <Text style={[hubText.caption, { color: colors.text200 }]}>{ka.profile.completeProfileBody}</Text>
      </View>
      <View style={{ gap: 14 }}>
        <GenderSelect
          label={ka.auth.gender}
          value={gender}
          onChange={(value) => {
            setGender(value);
            setErrors((current) => ({ ...current, gender: undefined }));
          }}
          error={errors.gender}
        />
        <DateField label={ka.auth.birthDate} value={birthDate} onChangeText={setBirthDate} error={errors.birthDate} />
      </View>
      {errors.form ? <Text style={[hubText.caption, { color: colors.danger }]}>{errors.form}</Text> : null}
      <View style={{ gap: 8 }}>
        <Button label={ka.profile.save} icon={Save} loading={busy} onPress={save} />
        {allowCancel ? <Button label={ka.common.cancel} variant="ghost" onPress={onCancel} /> : null}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  section: { paddingHorizontal: HUB.gutter, marginTop: HUB.sectionGap },
  card: { borderRadius: HUB.cardRadius, padding: HUB.cardPad },
  list: { borderRadius: HUB.cardRadius, overflow: 'hidden' },
  name: { fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 20, lineHeight: 27 },
  factRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 13 },
  stat: {
    flex: 1,
    minWidth: 0,
    borderRadius: 20,
    paddingVertical: 14,
    paddingHorizontal: 8,
    alignItems: 'center',
    gap: 6,
  },
});
