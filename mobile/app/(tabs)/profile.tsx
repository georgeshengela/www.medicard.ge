import React, { useCallback, useState } from 'react';
import { Alert, Image, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import Constants from 'expo-constants';
import { BellRing, ChevronRight, FileText, LogOut, MessageSquareText, Pill, Save, ShieldCheck } from 'lucide-react-native';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { DateField } from '@/components/ui/DateField';
import { GenderSelect } from '@/components/ui/GenderSelect';
import { ThemeSelect } from '@/components/ui/ThemeSelect';
import { DefaultHomePrompt } from '@/components/home/DefaultHomePrompt';
import { HomeLandingSelect } from '@/components/home/HomeLandingSelect';
import { PlanDetailCard } from '@/components/PlanUsageCard';
import { ProfilePointsCard } from '@/components/check-in/ProfilePointsCard';
import { useTabBarInset } from '@/components/navigation/FloatingTabBar';
import { AVATAR_SOURCES, isAvatarId, normalizeAvatarForGender } from '@/constants/avatarAssets';
import { ka } from '@/i18n/ka';
import { ApiError, type Gender } from '@/lib/api';
import { isoToDisplay, parseBirthDate } from '@/lib/birthdate';
import { formatDate } from '@/lib/format';
import { requestNotificationPermission, registerPushTokenWithServer } from '@/lib/notifications';
import { getCyclePromptSeen } from '@/lib/homeScreenPrefs';
import { useThemeColors } from '@/theme/colors';
import { useAuth } from '@/store/AuthContext';

const GENDER_LABELS: Record<Gender, string> = {
  MALE: ka.auth.genderMale,
  FEMALE: ka.auth.genderFemale,
  OTHER: ka.auth.genderOther,
};

const APP_VERSION = Constants.expoConfig?.version ?? '3.4.0';

export default function Profile() {
  const { user, stats, refresh, signOut, healthProfile, setUser } = useAuth();
  const colors = useThemeColors();
  const tabInset = useTabBarInset();
  const router = useRouter();

  const [refreshing, setRefreshing] = useState(false);
  const [notificationsOn, setNotificationsOn] = useState<boolean | null>(null);
  const [showCyclePrompt, setShowCyclePrompt] = useState(false);

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
          <View className="h-14 w-14 items-center justify-center overflow-hidden rounded-2xl bg-accent-100">
            {avatarSource ? (
              <Image source={avatarSource} style={{ width: 56, height: 56 }} />
            ) : (
              <Text className="text-lg font-bold text-primary-100">{initials || '—'}</Text>
            )}
          </View>
          <View className="ml-3.5 flex-1">
            <Text className="text-lg font-bold text-text-100">{user?.fullName}</Text>
            <Text numberOfLines={1} className="mt-0.5 text-sm text-text-300">
              {user?.phone ?? user?.email}
            </Text>
            {user?.createdAt ? (
              <Text className="mt-1 text-xs text-text-300">
                {ka.profile.memberSince}: {formatDate(user.createdAt)}
              </Text>
            ) : null}
          </View>
        </View>
      </Card>

      <ProfilePointsCard
        points={user?.points ?? 0}
        currentStreak={user?.currentStreak ?? 0}
        onPress={() => router.push('/profile/streak')}
      />

      <Text className="mb-2.5 mt-5 text-sm font-bold uppercase text-text-300">{ka.profile.appearance}</Text>
      <Card className="gap-4">
        <ThemeSelect />
        <View className="h-px bg-bg-300" />
        <HomeLandingSelect />
      </Card>

      <Text className="mb-2.5 mt-5 text-sm font-bold uppercase text-text-300">
        {ka.profile.medicalProfile}
      </Text>
      <MedicalProfileCard onFemaleSaved={() => setShowCyclePrompt(true)} />

      <Text className="mb-2.5 mt-5 text-sm font-bold uppercase text-text-300">{ka.profile.stats}</Text>
      <View className="flex-row">
        <StatTile icon={FileText} value={stats?.records ?? 0} label={ka.profile.statRecords} />
        <View className="w-2.5" />
        <StatTile icon={MessageSquareText} value={stats?.chats ?? 0} label={ka.profile.statChats} />
        <View className="w-2.5" />
        <StatTile icon={Pill} value={stats?.activeMedications ?? 0} label={ka.profile.statMeds} />
      </View>

      <Text className="mb-2.5 mt-5 text-sm font-bold uppercase text-text-300">{ka.profile.subscription}</Text>
      <PlanDetailCard />

      <Text className="mb-2.5 mt-5 text-sm font-bold uppercase text-text-300">{ka.profile.settings}</Text>
      <Card padded={false}>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push('/profile/permissions')}
          className="flex-row items-center p-4 active:opacity-70"
        >
          <ShieldCheck size={18} color={colors.primary200} strokeWidth={2.1} />
          <Text className="ml-3 flex-1 text-base text-text-100">{ka.profile.permissions}</Text>
          <ChevronRight size={18} color={colors.text300} strokeWidth={2.1} />
        </Pressable>

        <View className="h-px bg-bg-300" />

        <Pressable
          accessibilityRole="button"
          onPress={enableNotifications}
          className="flex-row items-center p-4 active:opacity-70"
        >
          <BellRing size={18} color={colors.primary200} strokeWidth={2.1} />
          <Text className="ml-3 flex-1 text-base text-text-100">{ka.profile.notifications}</Text>
          {notificationsOn !== null ? (
            <Badge
              label={notificationsOn ? ka.meds.notificationsEnabled : ka.meds.notificationsDenied}
              tone={notificationsOn ? 'success' : 'warning'}
            />
          ) : null}
        </Pressable>

        <View className="h-px bg-bg-300" />

        <View className="flex-row items-center p-4">
          <Text className="flex-1 text-base text-text-100">{ka.profile.version}</Text>
          <Text className="text-base text-text-300">{APP_VERSION}</Text>
        </View>
      </Card>

      <View className="mt-5">
        <Button label={ka.auth.signOut} icon={LogOut} variant="danger" onPress={confirmSignOut} />
      </View>

      <Text className="mt-6 text-center text-xs leading-5 text-text-300">{ka.app.disclaimer}</Text>

      <DefaultHomePrompt visible={showCyclePrompt} onClose={() => setShowCyclePrompt(false)} />
    </ScrollView>
  );
}

function MedicalProfileCard({ onFemaleSaved }: { onFemaleSaved?: () => void }) {
  const { user, updateProfile } = useAuth();

  const [gender, setGender] = useState<Gender | null>(null);
  const [birthDate, setBirthDate] = useState('');
  const [errors, setErrors] = useState<{ gender?: string; birthDate?: string; form?: string }>({});
  const [busy, setBusy] = useState(false);

  if (user?.gender && user?.birthDate) {
    return (
      <Card>
        <View className="flex-row items-center">
          <Text className="flex-1 text-base text-text-200">{ka.auth.gender}</Text>
          <Text className="text-base font-bold text-text-100">{GENDER_LABELS[user.gender]}</Text>
        </View>

        <View className="my-3 h-px bg-bg-300" />

        <View className="flex-row items-center">
          <Text className="flex-1 text-base text-text-200">{ka.profile.age}</Text>
          <Text className="text-base font-bold text-text-100">
            {user.age} {ka.profile.years}
          </Text>
        </View>

        <View className="my-3 h-px bg-bg-300" />

        <View className="flex-row items-center">
          <Text className="flex-1 text-base text-text-200">{ka.auth.birthDate}</Text>
          <Text className="text-base font-bold text-text-100">{isoToDisplay(user.birthDate)}</Text>
        </View>
      </Card>
    );
  }

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

      {errors.form ? (
        <Text className="mt-3 text-sm text-state-danger">{errors.form}</Text>
      ) : null}

      <View className="mt-4">
        <Button label={ka.profile.save} icon={Save} loading={busy} onPress={save} />
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
