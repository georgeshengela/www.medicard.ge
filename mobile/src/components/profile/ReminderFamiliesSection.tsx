import React, { useCallback, useState } from 'react';
import { Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Baby, CalendarHeart, Footprints, PawPrint, Pill, Scale, Stethoscope, UtensilsCrossed, type LucideIcon } from 'lucide-react-native';
import { PermissionGroup, PermissionSectionLabel, PermissionToggleRow } from '@/components/profile/PermissionToggleRow';
import { tx } from '@/i18n/locale';
import { isFeatureOn, useFeatureState } from '@/lib/featureFlags';
import { loadReminderFamilies, setReminderFamily, type ReminderFamily } from '@/lib/reminderPrefs';
import { useAuth } from '@/store/AuthContext';
import { useThemeColors } from '@/theme/colors';

type RowKey = ReminderFamily | 'cycle' | 'steps' | 'weight';
type State = Record<RowKey, boolean> & { hasStepsGoal: boolean; hasWeightGoal: boolean };

type Row = { key: RowKey; icon: LucideIcon; label: string; hint: string; show: boolean; disabled?: boolean };

async function readState(): Promise<State> {
  const [families, cycle, steps, weight] = await Promise.all([
    loadReminderFamilies(),
    import('@/lib/cycleReminderPrefs').then((m) => m.getCycleReminderPrefs()).catch(() => null),
    import('@/lib/stepsGoal').then((m) => m.loadStepsGoal()).catch(() => null),
    import('@/lib/weightGoal').then((m) => m.loadWeightGoal()).catch(() => null),
  ]);
  return {
    ...families,
    cycle: cycle?.enabled !== false,
    steps: Boolean(steps?.reminderEnabled),
    weight: Boolean(weight?.reminderEnabled),
    hasStepsGoal: Boolean(steps),
    hasWeightGoal: Boolean(weight),
  };
}

/** Re-plans one family right after its switch moves, so the change is real at once (not on the next app open). */
async function applyFamily(key: RowKey, on: boolean, userId: string | undefined): Promise<void> {
  const { api } = await import('@/lib/api');
  const notifications = await import('@/lib/notifications');
  switch (key) {
    case 'meds': {
      await setReminderFamily('meds', on);
      const res = await api.medications.list();
      await notifications.syncMedicationReminders(res.schedule, res.medications);
      return;
    }
    case 'visits': {
      await setReminderFamily('visits', on);
      const { syncVisitReminders } = await import('@/lib/visitNotifications');
      await syncVisitReminders((await api.visits.list()).visits);
      return;
    }
    case 'pets': {
      await setReminderFamily('pets', on);
      const { reconcilePetCareReminders } = await import('@/lib/petCareReminders');
      await reconcilePetCareReminders({ reason: 'settings' });
      return;
    }
    case 'nutrition': {
      await setReminderFamily('nutrition', on);
      const { preferences } = await api.nutrition.preferences.get();
      await notifications.syncNutritionReminders(preferences.reminders);
      return;
    }
    case 'pregnancy':
    case 'cycle': {
      if (key === 'pregnancy') await setReminderFamily('pregnancy', on);
      else await (await import('@/lib/cycleReminderPrefs')).setCycleReminderPrefs({ enabled: on });
      if (userId) await (await import('@/lib/cycleReminders')).reconcileCycleReminders(userId, { force: true });
      return;
    }
    case 'steps': {
      const { loadStepsGoal, saveStepsGoal } = await import('@/lib/stepsGoal');
      const goal = await loadStepsGoal();
      if (goal) await saveStepsGoal({ ...goal, reminderEnabled: on, reminderDays: goal.reminderDays?.length ? goal.reminderDays : [1, 3, 5] });
      return;
    }
    case 'weight': {
      const { loadWeightGoal, saveWeightGoal } = await import('@/lib/weightGoal');
      const goal = await loadWeightGoal();
      if (goal) await saveWeightGoal({ ...goal, reminderEnabled: on, reminderDays: goal.reminderDays?.length ? goal.reminderDays : [1, 3, 4] });
      return;
    }
  }
}

/** Profile → შეტყობინებები: every scheduled reminder in one place. All on by default; each can be turned off. */
export function ReminderFamiliesSection() {
  const colors = useThemeColors();
  const { user } = useAuth();
  const features = useFeatureState();
  const [state, setState] = useState<State | null>(null);
  const [busy, setBusy] = useState<RowKey | null>(null);
  const [permissionOff, setPermissionOff] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      void readState().then((next) => alive && setState(next));
      void import('@/lib/notifications')
        .then((m) => m.getNotificationPermissionGranted())
        .then((granted) => alive && setPermissionOff(!granted));
      return () => {
        alive = false;
      };
    }, []),
  );

  const female = user?.gender === 'FEMALE';
  const noGoal = tx('ჯერ მიზანი არ გაქვს', 'No goal yet');
  const allRows: Row[] = [
    { key: 'meds', icon: Pill, label: tx('წამლის მიღება', 'Medications'), hint: tx('ყოველი მიღების დროს', 'At every dose time'), show: isFeatureOn('medications', features) },
    { key: 'visits', icon: Stethoscope, label: tx('ექიმთან ვიზიტი', 'Doctor visits'), hint: tx('დღით და საათით ადრე', 'A day and an hour before'), show: isFeatureOn('visits', features) },
    { key: 'pets', icon: PawPrint, label: tx('ცხოველის მოვლა', 'Pet care'), hint: tx('წინა დღეს, იმ დღეს და ვადაზე', 'Day before, on the day, overdue'), show: isFeatureOn('pets', features) },
    { key: 'cycle', icon: CalendarHeart, label: tx('ციკლი', 'Cycle'), hint: tx('მენსტრუაცია, ოვულაცია, PMS', 'Period, ovulation, PMS'), show: female && isFeatureOn('cycle', features) },
    { key: 'pregnancy', icon: Baby, label: tx('ორსულობის მოვლა', 'Pregnancy care'), hint: tx('ვიზიტები და კვლევები გეგმიდან', 'Visits and tests from your plan'), show: female && isFeatureOn('cycle', features) },
    { key: 'nutrition', icon: UtensilsCrossed, label: tx('კვება', 'Meals'), hint: tx('საუზმე, სადილი, ვახშამი', 'Breakfast, lunch, dinner'), show: isFeatureOn('nutrition', features) },
    {
      key: 'steps',
      icon: Footprints,
      label: tx('ნაბიჯების მიზანი', 'Steps goal'),
      hint: state?.hasStepsGoal === false ? noGoal : tx('არჩეულ დღეებში', 'On the days you chose'),
      show: isFeatureOn('steps', features),
      disabled: state?.hasStepsGoal === false,
    },
    {
      key: 'weight',
      icon: Scale,
      label: tx('წონის მიზანი', 'Weight goal'),
      hint: state?.hasWeightGoal === false ? noGoal : tx('აწონვის დღეებში', 'On your weigh-in days'),
      show: isFeatureOn('weight', features),
      disabled: state?.hasWeightGoal === false,
    },
  ];
  const rows = allRows.filter((row) => row.show);

  const toggle = async (key: RowKey, on: boolean) => {
    if (!state || busy) return;
    setBusy(key);
    setState({ ...state, [key]: on });
    try {
      if (on) {
        const notifications = await import('@/lib/notifications');
        // Asked only from this tap (App Review / iOS 26 rules), never from an effect.
        const granted = (await notifications.getNotificationPermissionGranted()) || (await notifications.requestNotificationPermission());
        setPermissionOff(!granted);
      }
      await applyFamily(key, on, user?.id);
    } catch {
      /* the switch keeps the saved value; scheduling is retried on the next app open */
    } finally {
      setState(await readState());
      setBusy(null);
    }
  };

  if (!rows.length) return null;

  return (
    <View style={{ gap: 8 }}>
      <PermissionSectionLabel title={tx('შეხსენებები', 'Reminders')} />
      <PermissionGroup>
        {rows.map((row, index) => (
          <PermissionToggleRow
            key={row.key}
            icon={row.icon}
            label={row.label}
            hint={row.hint}
            value={state ? state[row.key] && !row.disabled : true}
            disabled={!state || row.disabled}
            loading={busy === row.key}
            isLast={index === rows.length - 1}
            onValueChange={(next) => void toggle(row.key, next)}
          />
        ))}
      </PermissionGroup>
      <Text style={{ fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 12, lineHeight: 18, color: permissionOff ? colors.danger : colors.text300 }}>
        {permissionOff
          ? tx('ტელეფონზე შეტყობინებები გამორთულია — ჩართე, რომ შეხსენებები მოვიდეს.', 'Notifications are off on this phone — turn them on so reminders can arrive.')
          : tx('ყველა ნაგულისხმევად ჩართულია. სიხშირის ლიმიტი მათზე არ მოქმედებს.', 'All are on by default. The frequency limit doesn’t apply to them.')}
      </Text>
    </View>
  );
}
