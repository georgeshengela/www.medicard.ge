import React, { useCallback, useState } from 'react';
import { Alert, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { BellRing, Crown, FileText, LogOut, MessageSquareText, Pill, Save, ShieldCheck } from 'lucide-react-native';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { DateField } from '@/components/ui/DateField';
import { GenderSelect } from '@/components/ui/GenderSelect';
import { ThemeSelect } from '@/components/ui/ThemeSelect';
import { UsageBanner } from '@/components/UsageBanner';
import { useTabBarInset } from '@/components/navigation/FloatingTabBar';
import { ka } from '@/i18n/ka';
import { ApiError, type Gender } from '@/lib/api';
import { isoToDisplay, parseBirthDate } from '@/lib/birthdate';
import { formatDate } from '@/lib/format';
import { requestNotificationPermission, registerPushTokenWithServer } from '@/lib/notifications';
import { useThemeColors } from '@/theme/colors';
import { useAuth } from '@/store/AuthContext';

const GENDER_LABELS: Record<Gender, string> = {
  MALE: ka.auth.genderMale,
  FEMALE: ka.auth.genderFemale,
  OTHER: ka.auth.genderOther,
};

const APP_VERSION = '3.2.10';

export default function Profile() {
  const { user, stats, refresh, signOut } = useAuth();
  const colors = useThemeColors();
  const tabInset = useTabBarInset();

  const [refreshing, setRefreshing] = useState(false);
  const [notificationsOn, setNotificationsOn] = useState<boolean | null>(null);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  }, [refresh]);

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

  return (
    <ScrollView
      className="flex-1 bg-bg-100"
      contentContainerStyle={{ paddingBottom: tabInset }}
      contentContainerClassName="px-4 pt-3"
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary200} />}
      showsVerticalScrollIndicator={false}
    >
      <Card>
        <View className="flex-row items-center">
          <View className="h-14 w-14 items-center justify-center rounded-2xl bg-primary-200">
            <Text className="text-lg font-bold text-white">{initials || '—'}</Text>
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

      <View className="mt-3">
        <UsageBanner />
      </View>

      <Text className="mb-2.5 mt-5 text-sm font-bold uppercase text-text-300">{ka.profile.appearance}</Text>
      <Card>
        <ThemeSelect />
      </Card>

      <Text className="mb-2.5 mt-5 text-sm font-bold uppercase text-text-300">
        {ka.profile.medicalProfile}
      </Text>
      <MedicalProfileCard />

      <Text className="mb-2.5 mt-5 text-sm font-bold uppercase text-text-300">{ka.profile.stats}</Text>
      <View className="flex-row">
        <StatTile icon={FileText} value={stats?.records ?? 0} label={ka.profile.statRecords} />
        <View className="w-2.5" />
        <StatTile icon={MessageSquareText} value={stats?.chats ?? 0} label={ka.profile.statChats} />
        <View className="w-2.5" />
        <StatTile icon={Pill} value={stats?.activeMedications ?? 0} label={ka.profile.statMeds} />
      </View>

      <Text className="mb-2.5 mt-5 text-sm font-bold uppercase text-text-300">{ka.profile.subscription}</Text>
      <PackageCard />

      <Text className="mb-2.5 mt-5 text-sm font-bold uppercase text-text-300">{ka.profile.settings}</Text>
      <Card padded={false}>
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
    </ScrollView>
  );
}

/**
 * Sex and age drive every AI interpretation, so accounts created over SMS — which
 * cannot collect them — get an inline editor here instead of a dead-end label.
 */
function PackageCard() {
  const { user, usage } = useAuth();
  const colors = useThemeColors();
  const code = (user?.package?.code ?? 'FREE') as 'FREE' | 'STANDARD' | 'ULTIMATE';
  const meta =
    code === 'ULTIMATE'
      ? { title: ka.profile.ultimatePlan, detail: ka.profile.ultimatePlanDetail, tone: 'success' as const }
      : code === 'STANDARD'
        ? { title: ka.profile.standardPlan, detail: ka.profile.standardPlanDetail, tone: 'brand' as const }
        : { title: ka.profile.freePlan, detail: ka.profile.freePlanDetail, tone: 'neutral' as const };

  const monthlyLimit =
    user?.package?.monthlyAiLimit ??
    user?.package?.dailyAiLimit ??
    usage?.limit ??
    90;
  const limitLabel =
    usage?.unlimited || user?.package?.unlimited || monthlyLimit < 0
      ? `∞ / ${ka.usage.perMonth}`
      : `${usage?.remaining ?? monthlyLimit} / ${monthlyLimit} ${ka.usage.perMonth}`;

  const started = user?.packageStartedAt ? formatDate(user.packageStartedAt) : null;
  const expires = user?.packageExpiresAt ? formatDate(user.packageExpiresAt) : null;
  const expired =
    user?.packageExpiresAt && new Date(user.packageExpiresAt).getTime() < Date.now();

  return (
    <Card>
      <View className="flex-row items-center">
        <View className="h-10 w-10 items-center justify-center rounded-xl bg-bg-200">
          <ShieldCheck size={18} color={colors.primary200} strokeWidth={2.1} />
        </View>
        <View className="ml-3 flex-1">
          <Text className="text-base font-bold text-text-100">{meta.title}</Text>
          <Text className="mt-0.5 text-sm text-text-300">{meta.detail}</Text>
          <Text className="mt-1 text-xs font-semibold text-primary-100">
            {ka.profile.billingMonthly}
          </Text>
          <Text className="mt-0.5 text-xs text-text-300">
            AI: {limitLabel}
            {started && code !== 'FREE' ? ` · ${ka.profile.planStarted}: ${started}` : ''}
            {expires ? ` · ${ka.profile.planExpires}: ${expires}` : ''}
            {expired ? ` · ${ka.profile.planExpired}` : ''}
          </Text>
        </View>
        <Badge label={code} tone={meta.tone} />
      </View>

      {code === 'FREE' ? (
        <View className="mt-3.5">
          <Button
            label={ka.usage.upsellCta}
            icon={Crown}
            onPress={() => Alert.alert(ka.usage.upsellTitle, ka.usage.premiumSoon)}
          />
        </View>
      ) : null}
    </Card>
  );
}

function MedicalProfileCard() {
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
      <Icon size={18} color={colors.primary300} strokeWidth={2.1} />
      <Text className="mt-1.5 text-xl font-bold text-text-100">{value}</Text>
      <Text className="text-xs text-text-300">{label}</Text>
    </View>
  );
}
