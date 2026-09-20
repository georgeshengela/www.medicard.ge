import React from 'react';
import { Linking, Pressable, Switch, Text, View } from 'react-native';
import { Clock } from 'lucide-react-native';
import { PetButton as Button } from '@/components/pets/PetUi';
import { PetInput as Input } from '@/components/pets/PetUi';
import { ka } from '@/i18n/ka';
import { api, type PetCareSchedule } from '@/lib/api';
import { getNotificationPermissionGranted, requestNotificationPermission } from '@/lib/notifications';
import { loadPetCareReminderPrefs, savePetCareReminderPrefs } from '@/lib/petCareReminderPrefs';
import { petCareUiStatus, reconcilePetCareReminders } from '@/lib/petCareReminders';
import { petsCareErrorMessage } from '@/lib/petsCare';
import { useThemeColors } from '@/theme/colors';

function SwitchRow({
  title,
  body,
  value,
  onValueChange,
  disabled,
}: {
  title: string;
  body?: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
  disabled?: boolean;
}) {
  const colors = useThemeColors();
  return (
    <View className="flex-row items-center justify-between">
      <View className="flex-1 pr-3">
        <Text className="text-base font-semibold text-text-100">{title}</Text>
        {body ? <Text className="mt-1 text-sm text-text-300">{body}</Text> : null}
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        disabled={disabled}
        trackColor={{ false: colors.bg300, true: colors.primary200 }}
      />
    </View>
  );
}

export function PetCareReminderCard({
  petId,
  schedule,
  onSchedule,
  onError,
}: {
  petId: string;
  schedule: PetCareSchedule;
  onSchedule: (next: PetCareSchedule) => void;
  onError: (message: string) => void;
}) {
  const colors = useThemeColors();
  const [status, setStatus] = React.useState('off');
  const [nextAlertAt, setNextAlertAt] = React.useState<number | null>(null);
  const [permissionGranted, setPermissionGranted] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [hour, setHour] = React.useState('09:00');
  const [followUp, setFollowUp] = React.useState(false);

  const load = React.useCallback(async () => {
    const prefs = await loadPetCareReminderPrefs();
    setHour(`${String(prefs.dateBasedHour).padStart(2, '0')}:${String(prefs.dateBasedMinute).padStart(2, '0')}`);
    setFollowUp(prefs.overdueFollowUp);
    const ui = await petCareUiStatus(schedule);
    setStatus(ui.status);
    setNextAlertAt(ui.nextAlertAt);
    setPermissionGranted(ui.permissionGranted);
  }, [schedule]);

  React.useEffect(() => {
    void load().catch(() => { setStatus('sync_failed'); setNextAlertAt(null); });
  }, [load]);

  const statusCopy =
    status === 'scheduled_on_device'
      ? ka.pets.reminderScheduledDevice
      : status === 'permission_denied'
        ? ka.pets.reminderPermissionDenied
        : status === 'sync_failed'
          ? ka.pets.reminderSyncFailed
          : status === 'preference_saved'
            ? ka.pets.reminderPreferenceSaved
            : ka.pets.remindersNotEnabled;

  const toggle = async (enabled: boolean) => {
    if (saving) return;
    setSaving(true);
    try {
      const prefs = await loadPetCareReminderPrefs();
      if (enabled) {
        const granted = (await getNotificationPermissionGranted()) || (await requestNotificationPermission());
        if (!granted) {
          onError(ka.pets.reminderPermissionDenied);
          await savePetCareReminderPrefs({ ...prefs, globalOptIn: true });
          await api.pets.schedules.reminders(petId, schedule.id, {
            reminderEnabled: true,
            reminderOffsetsDays: schedule.reminderOffsetsDays?.length ? schedule.reminderOffsetsDays : [0],
          });
          await reconcilePetCareReminders({ reason: 'permission_denied' });
          await load();
          return;
        }
        await savePetCareReminderPrefs({ ...prefs, globalOptIn: true, dateBasedTimeAccepted: true });
      }
      const res = await api.pets.schedules.reminders(petId, schedule.id, {
        reminderEnabled: enabled,
        reminderOffsetsDays: schedule.reminderOffsetsDays?.length ? schedule.reminderOffsetsDays : [0],
      });
      onSchedule(res.schedule);
      await reconcilePetCareReminders({ reason: 'preference' });
      await load();
    } catch (caught) {
      onError(petsCareErrorMessage(caught, { ...ka.pets, offline: ka.common.networkError }));
    } finally {
      setSaving(false);
    }
  };

  const saveClock = async () => {
    const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(hour.trim());
    if (!match) {
      onError(ka.pets.reminderTimeInvalid);
      return;
    }
    const prefs = await loadPetCareReminderPrefs();
    await savePetCareReminderPrefs({
      ...prefs,
      dateBasedHour: Number(match[1]),
      dateBasedMinute: Number(match[2]),
      dateBasedTimeAccepted: true,
    });
    await reconcilePetCareReminders({ reason: 'clock' });
    await load();
  };

  const saveFollowUp = async (next: boolean) => {
    const prefs = await loadPetCareReminderPrefs();
    await savePetCareReminderPrefs({ ...prefs, overdueFollowUp: next });
    setFollowUp(next);
    await reconcilePetCareReminders({ reason: 'followup' });
  };

  return (
    <View className="gap-4">
      <SwitchRow
        title={ka.pets.reminderToggle}
        body={statusCopy}
        value={schedule.reminderEnabled}
        onValueChange={(value) => void toggle(value)}
        disabled={saving}
      />
      {schedule.timeMode !== 'EXACT_TIME' ? (
        <View className="gap-3">
          <Input figma icon={Clock} label={ka.pets.reminderClock} value={hour} onChangeText={setHour} placeholder="09:00" hint={ka.pets.reminderClockHint} keyboardType="numbers-and-punctuation" />
          <Button label={ka.pets.reminderClockSave} variant="secondary" onPress={() => void saveClock()} />
        </View>
      ) : (
        <Text className="text-sm text-text-300">{ka.pets.reminderExactTimeHint}</Text>
      )}
      <SwitchRow title={ka.pets.reminderFollowUp} value={followUp} onValueChange={(value) => void saveFollowUp(value)} />
      {nextAlertAt ? (
        <Text className="text-sm text-text-200">
          {ka.pets.reminderNextLocal}: {new Date(nextAlertAt).toLocaleString('ka-GE')}
        </Text>
      ) : null}
      {!permissionGranted ? (
        <Pressable onPress={() => void Linking.openSettings()} className="min-h-11 justify-center active:opacity-80">
          <Text className="font-semibold text-primary-200">{ka.pets.reminderOpenSettings}</Text>
        </Pressable>
      ) : null}
      <Text className="text-xs text-text-300">{ka.pets.reminderDeliveryHonesty}</Text>
    </View>
  );
}
