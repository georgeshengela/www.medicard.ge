import React, { useCallback, useState } from 'react';
import { Alert, Image, Linking, RefreshControl, ScrollView, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import Constants from 'expo-constants';
import {
  BellRing,
  FileText,
  HeartPulse,
  LogOut,
  Mail,
  MessageSquareText,
  Pill,
  Save,
  Scale,
  ShieldCheck,
  Trash2,
} from 'lucide-react-native';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { DateField } from '@/components/ui/DateField';
import { GenderSelect } from '@/components/ui/GenderSelect';
import { ThemeSelect } from '@/components/ui/ThemeSelect';
import { DefaultHomePrompt } from '@/components/home/DefaultHomePrompt';
import { HomeLandingSelect } from '@/components/home/HomeLandingSelect';
import { HomeSectionTitle } from '@/components/home/HomeSectionTitle';
import { PlanDetailCard } from '@/components/PlanUsageCard';
import { ProfilePointsCard } from '@/components/check-in/ProfilePointsCard';
import { DeleteAccountModal } from '@/components/profile/DeleteAccountModal';
import { ProfileMenuRow } from '@/components/profile/ProfileMenuRow';
import { useTabBarInset } from '@/components/navigation/FloatingTabBar';
import { AVATAR_SOURCES, isAvatarId, normalizeAvatarForGender } from '@/constants/avatarAssets';
import { SUPPORT_MAILTO } from '@/constants/legal';
import { ka } from '@/i18n/ka';
import { ApiError, type Gender } from '@/lib/api';
import { isoToDisplay, parseBirthDate } from '@/lib/birthdate';
import { bmiCategory, bmiFromWeight } from '@/lib/bmi';
import { formatDate } from '@/lib/format';
import { requestNotificationPermission, registerPushTokenWithServer } from '@/lib/notifications';
import { getCyclePromptSeen } from '@/lib/homeScreenPrefs';
import { usePlanUsage } from '@/lib/planUsage';
import { useThemeColors } from '@/theme/colors';
import { useAuth } from '@/store/AuthContext';

const GENDER_LABELS: Record<Gender, string> = {
  MALE: ka.auth.genderMale,
  FEMALE: ka.auth.genderFemale,
  OTHER: ka.auth.genderOther,
};

const APP_VERSION = Constants.expoConfig?.version ?? '3.4.0';

function optionLabel(group: 'smokingStatus' | 'chronicConditions', key: string): string {
  const map = ka.assessment.options[group] as Record<string, string>;
  return map[key] ?? key;
}

export default function Profile() {
  const { user, stats, refresh, signOut, deleteAccount, healthProfile, setUser } = useAuth();
  const colors = useThemeColors();
  const tabInset = useTabBarInset();
  const router = useRouter();
  const plan = usePlanUsage();

  const [refreshing, setRefreshing] = useState(false);
  const [notificationsOn, setNotificationsOn] = useState<boolean | null>(null);
  const [showCyclePrompt, setShowCyclePrompt] = useState(false);
  const [editingMedical, setEditingMedical] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);

  useFocusEffect(
    useCallback(() => {
      void (async () => {
        const { flushStepsGoalAwards } = await import('@/lib/stepsGoal');
        await flushStepsGoalAwards(setUser);
        await refresh();
      })();
    }, [refresh, setUser]),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    const { flushStepsGoalAwards } = await import('@/lib/stepsGoal');
    await flushStepsGoalAwards(setUser);
    await refresh();
    setRefreshing(false);
  }, [refresh, setUser]);

  const enableNotifications = async () => {
    const granted = await requestNotificationPermission();
    if (granted) await registerPushTokenWithServer();
    setNotificationsOn(granted);
    if (!granted) Alert.alert(ka.profile.notifications, ka.meds.notificationsDenied);
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
      Alert.alert(
        ka.profile.deleteAccount,
        error instanceof ApiError ? error.message : ka.profile.deleteAccountFailed,
      );
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
  const avatarId = storedAvatar
    ? normalizeAvatarForGender(storedAvatar, user?.gender ?? null)
    : null;
  const avatarSource = avatarId && isAvatarId(avatarId) ? AVATAR_SOURCES[avatarId] : null;

  const bmi = healthProfile?.bmi ?? bmiFromWeight(healthProfile?.weightKg, healthProfile?.heightCm);
  const smoking =
    healthProfile?.smokingStatus != null
      ? optionLabel('smokingStatus', healthProfile.smokingStatus)
      : null;
  const allergyLabels = (healthProfile?.allergies ?? [])
    .filter((item) => item && item !== 'none')
    .map((item) => optionLabel('chronicConditions', item));
  const conditionLabels = (healthProfile?.chronicConditions ?? [])
    .filter((item) => item && item !== 'none')
    .map((item) => optionLabel('chronicConditions', item));

  return (
    <ScrollView
      className="flex-1 bg-bg-100"
      style={{ backgroundColor: colors.bg100 }}
      contentContainerStyle={{ paddingBottom: tabInset }}
      contentContainerClassName="px-4 pt-3"
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary200} />}
      showsVerticalScrollIndicator={false}
    >
      <Card>
        <View className="flex-row items-center">
          <View
            style={{
              width: 76,
              height: 76,
              borderRadius: 22,
              padding: 3,
              backgroundColor: `${colors.primary200}33`,
            }}
          >
            <View className="h-full w-full items-center justify-center overflow-hidden rounded-[18px] bg-accent-100">
              {avatarSource ? (
                <Image source={avatarSource} style={{ width: 70, height: 70 }} />
              ) : (
                <Text className="text-xl font-bold text-primary-100">{initials || '—'}</Text>
              )}
            </View>
          </View>
          <View className="ml-3.5 flex-1">
            <Text
              style={{
                fontFamily: 'NotoSansGeorgian_700Bold',
                fontSize: 20,
                lineHeight: 26,
                color: colors.text100,
              }}
            >
              {user?.fullName}
            </Text>
            <View className="mt-2 flex-row flex-wrap items-center" style={{ gap: 8 }}>
              <View
                style={{
                  borderRadius: 999,
                  paddingHorizontal: 10,
                  paddingVertical: 4,
                  backgroundColor: plan.code === 'ULTIMATE' ? colors.successBg : `${colors.primary200}18`,
                }}
              >
                <Text
                  style={{
                    fontFamily: 'NotoSansGeorgian_700Bold',
                    fontSize: 11,
                    color: plan.code === 'ULTIMATE' ? colors.success : colors.primary100,
                  }}
                >
                  {plan.meta.title}
                </Text>
              </View>
              {user?.createdAt ? (
                <Text className="text-xs text-text-300">
                  {ka.profile.memberSince} {formatDate(user.createdAt)}
                </Text>
              ) : null}
            </View>
          </View>
        </View>

        <View className="mt-4" style={{ gap: 10 }}>
          {user?.phone ? <HeroFact label={ka.profile.phone} value={user.phone} /> : null}
          {user?.email ? <HeroFact label={ka.profile.email} value={user.email} /> : null}
        </View>
      </Card>

      <ProfilePointsCard
        points={user?.points ?? 0}
        currentStreak={user?.currentStreak ?? 0}
        onPress={() => router.push('/profile/streak')}
      />

      <View className="mt-5">
        <HomeSectionTitle title={ka.profile.appearance} />
        <Card className="gap-4">
          <ThemeSelect />
          <View className="h-px bg-bg-300" />
          <HomeLandingSelect />
        </Card>
      </View>

      <View className="mt-5">
        <HomeSectionTitle title={ka.profile.medicalProfile} />
        {user?.gender && user?.birthDate && !editingMedical ? (
          <Card>
            <FactRow label={ka.auth.gender} value={GENDER_LABELS[user.gender]} />
            <FactRow label={ka.profile.age} value={`${user.age ?? '—'} ${ka.profile.years}`} />
            <FactRow label={ka.auth.birthDate} value={isoToDisplay(user.birthDate)} />
            {healthProfile?.heightCm != null ? (
              <FactRow label={ka.profile.height} value={`${Math.round(healthProfile.heightCm)} ${ka.profile.cm}`} />
            ) : null}
            {healthProfile?.weightKg != null ? (
              <FactRow label={ka.profile.weight} value={`${healthProfile.weightKg} ${ka.profile.kg}`} />
            ) : null}
            {bmi != null ? (
              <FactRow
                label={ka.profile.bmi}
                value={`${bmi.toFixed(1)} · ${ka.home.bmi.categories[bmiCategory(bmi)]}`}
              />
            ) : null}
            {healthProfile?.bloodType ? (
              <FactRow label={ka.profile.bloodType} value={healthProfile.bloodType} last={!smoking && !allergyLabels.length && !conditionLabels.length} />
            ) : null}
            {smoking ? <FactRow label={ka.profile.smoking} value={smoking} last={!allergyLabels.length && !conditionLabels.length} /> : null}
            {allergyLabels.length ? (
              <FactRow label={ka.profile.allergies} value={allergyLabels.join(', ')} last={!conditionLabels.length} />
            ) : null}
            {conditionLabels.length ? (
              <FactRow label={ka.profile.conditions} value={conditionLabels.join(', ')} last />
            ) : null}
            <View className="mt-3">
              <Button
                label={ka.profile.editMedical}
                variant="ghost"
                size="sm"
                icon={Scale}
                onPress={() => setEditingMedical(true)}
              />
            </View>
          </Card>
        ) : (
          <MedicalProfileCard
            onFemaleSaved={() => setShowCyclePrompt(true)}
            onSaved={() => setEditingMedical(false)}
            allowCancel={Boolean(user?.gender && user?.birthDate)}
            onCancel={() => setEditingMedical(false)}
          />
        )}
      </View>

      <View className="mt-5">
        <HomeSectionTitle title={ka.profile.stats} />
        <View className="flex-row">
          <StatTile icon={FileText} value={stats?.records ?? 0} label={ka.profile.statRecords} />
          <View className="w-2.5" />
          <StatTile icon={MessageSquareText} value={stats?.chats ?? 0} label={ka.profile.statChats} />
          <View className="w-2.5" />
          <StatTile icon={Pill} value={stats?.activeMedications ?? 0} label={ka.profile.statMeds} />
        </View>
      </View>

      <View className="mt-5">
        <HomeSectionTitle title={ka.profile.subscription} />
        <PlanDetailCard />
      </View>

      <View className="mt-5">
        <HomeSectionTitle title={ka.profile.settings} />
        <Card padded={false}>
          <ProfileMenuRow
            icon={ShieldCheck}
            label={ka.profile.permissions}
            onPress={() => router.push('/profile/permissions')}
          />
          <ProfileMenuRow
            icon={BellRing}
            label={ka.profile.notifications}
            value={
              notificationsOn == null
                ? undefined
                : notificationsOn
                  ? ka.meds.notificationsEnabled
                  : ka.meds.notificationsDenied
            }
            onPress={enableNotifications}
            isLast
          />
        </Card>
      </View>

      <View className="mt-5">
        <HomeSectionTitle title={ka.profile.legal} />
        <Card padded={false}>
          <ProfileMenuRow
            icon={ShieldCheck}
            label={ka.profile.privacyPolicy}
            onPress={() => router.push('/profile/privacy')}
          />
          <ProfileMenuRow
            icon={FileText}
            label={ka.profile.terms}
            onPress={() => router.push('/profile/terms')}
          />
          <ProfileMenuRow
            icon={Mail}
            label={ka.profile.support}
            value={ka.profile.supportEmail}
            onPress={() => void Linking.openURL(SUPPORT_MAILTO)}
            isLast
          />
        </Card>
      </View>

      <View className="mt-5">
        <HomeSectionTitle title={ka.profile.about} />
        <Card padded={false}>
          <ProfileMenuRow icon={HeartPulse} label={ka.profile.version} value={APP_VERSION} isLast />
        </Card>
      </View>

      <View className="mt-5">
        <Button label={ka.auth.signOut} icon={LogOut} variant="danger" onPress={confirmSignOut} />
        <View className="mt-3">
          <Button
            label={ka.profile.deleteAccount}
            icon={Trash2}
            variant="ghost"
            onPress={() => setDeleteOpen(true)}
          />
        </View>
      </View>

      <Text className="mt-6 text-center text-xs leading-5 text-text-300">{ka.app.disclaimer}</Text>

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

function HeroFact({ label, value }: { label: string; value: string }) {
  const colors = useThemeColors();
  return (
    <View className="flex-row items-center justify-between">
      <Text style={{ fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 13, color: colors.text300 }}>
        {label}
      </Text>
      <Text
        numberOfLines={1}
        style={{
          flex: 1,
          marginLeft: 12,
          textAlign: 'right',
          fontFamily: 'NotoSansGeorgian_600SemiBold',
          fontSize: 13,
          color: colors.text100,
        }}
      >
        {value}
      </Text>
    </View>
  );
}

function FactRow({ label, value, last }: { label: string; value: string; last?: boolean }) {
  return (
    <>
      <View className="flex-row items-center">
        <Text className="flex-1 text-base text-text-200">{label}</Text>
        <Text className="max-w-[58%] text-right text-base font-bold text-text-100">{value}</Text>
      </View>
      {last ? null : <View className="my-3 h-px bg-bg-300" />}
    </>
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

  const [gender, setGender] = useState<Gender | null>(user?.gender ?? null);
  const [birthDate, setBirthDate] = useState(user?.birthDate ? isoToDisplay(user.birthDate) : '');
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
    <Card>
      <Text className="text-base font-bold text-text-100">{ka.profile.completeProfile}</Text>
      <Text className="mt-1 text-sm leading-5 text-text-300">{ka.profile.completeProfileBody}</Text>

      <View className="mt-4 gap-4">
        <GenderSelect
          label={ka.auth.gender}
          value={gender}
          onChange={(value) => {
            setGender(value);
            setErrors((current) => ({ ...current, gender: undefined }));
          }}
          error={errors.gender}
        />

        <DateField
          label={ka.auth.birthDate}
          value={birthDate}
          onChangeText={setBirthDate}
          error={errors.birthDate}
        />
      </View>

      {errors.form ? <Text className="mt-3 text-sm text-state-danger">{errors.form}</Text> : null}

      <View className="mt-4">
        <Button label={ka.profile.save} icon={Save} loading={busy} onPress={save} />
        {allowCancel ? (
          <View className="mt-2">
            <Button label={ka.common.cancel} variant="ghost" onPress={onCancel} />
          </View>
        ) : null}
      </View>
    </Card>
  );
}

function StatTile({
  icon: Icon,
  value,
  label,
}: {
  icon: typeof FileText;
  value: number;
  label: string;
}) {
  const colors = useThemeColors();

  return (
    <View className="flex-1 items-center rounded-2xl border border-bg-300 bg-surface py-4">
      <View className="h-9 w-9 items-center justify-center rounded-xl bg-accent-100">
        <Icon size={18} color={colors.primary200} strokeWidth={2.1} />
      </View>
      <Text className="mt-1.5 text-xl font-bold text-text-100">{value}</Text>
      <Text className="text-xs text-text-300">{label}</Text>
    </View>
  );
}
