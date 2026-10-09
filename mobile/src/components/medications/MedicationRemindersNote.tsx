import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Linking, Platform, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Bell, BellOff } from 'lucide-react-native';
import { MedsButton, MedsCard, MedsIconTile } from '@/components/medications/MedsHubUI';
import { tx } from '@/i18n/locale';
import { onReturnToForeground } from '@/lib/appForeground';
import { medicationReminderNotice, type NotificationPermissionState } from '@/lib/medicationReminderNotice';
import { getNotificationPermissionStatus, requestNotificationPermission } from '@/lib/notifications';
import { markPrimerAsked, primerCopy, primerSettingsLabel } from '@/lib/permissionPrimer';
import { isReminderFamilyOn } from '@/lib/reminderPrefs';
import { useThemeColors } from '@/theme/colors';
import { hubText } from '@/theme/hub';

/**
 * A calm note on MEDIPILL when her medication reminders cannot arrive because the phone's
 * notifications are off (`medicationReminderNotice`). Never asks from an effect: the status is only
 * read here (on focus and on return from Settings); the system sheet opens from the primer's one
 * „გაგრძელება“ button. Once allowed, the grant itself refetches the medications and schedules every
 * reminder (`requestNotificationPermission` → reconcile); allowed later in Settings, the focus refetch
 * of the medication list schedules them.
 */
export function MedicationRemindersNote({ activeCount, style }: { activeCount: number; style?: StyleProp<ViewStyle> }) {
  const c = useThemeColors();
  const [permission, setPermission] = useState<NotificationPermissionState | null>(null);
  const [remindersOn, setRemindersOn] = useState(true);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const read = useCallback(async () => {
    const [status, on] = await Promise.all([
      getNotificationPermissionStatus().catch(() => null),
      isReminderFamilyOn('meds').catch(() => true),
    ]);
    if (!alive.current) return;
    setPermission(status);
    setRemindersOn(on);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void read();
    }, [read]),
  );
  // Back from the phone's Settings (a focus event does not fire for that).
  useEffect(() => onReturnToForeground(() => void read()), [read]);

  const kind = medicationReminderNotice({ permission, activeMedications: activeCount, remindersOn, native: Platform.OS !== 'web' });
  if (kind === 'none') return null;

  // App Review 5.1.1(iv): the primer has one button, „გაგრძელება“, and it always opens the system sheet.
  // The request is the first thing the tap does (iOS 26 shows no sheet after other awaits).
  const continueToSystemSheet = () => {
    if (busyRef.current) return;
    busyRef.current = true;
    const asked = requestNotificationPermission();
    setBusy(true);
    void asked
      .catch(() => false)
      .then(() => markPrimerAsked('notifications'))
      .finally(() => {
        busyRef.current = false;
        if (alive.current) setBusy(false);
        // Denied in the sheet: the note turns into „პარამეტრების გახსნა“.
        void read();
      });
  };

  const openSettings = () => {
    void Linking.openSettings().catch(() => undefined);
  };

  const primer = primerCopy('notifications');
  const settings = kind === 'settings';
  const title = settings ? tx('შეტყობინებები გამორთულია', 'Notifications are off') : tx('წამლის შეხსენებები', 'Medication reminders');
  const body = settings
    ? tx(
        'ამიტომ წამლის მიღების შეხსენებებს ვერ მიიღებ. ჩართე შეტყობინებები ტელეფონის პარამეტრებში.',
        'So your medication reminders can’t reach you. Turn notifications on in your phone’s Settings.',
      )
    : primer.body;

  return (
    <View style={style}>
      <MedsCard style={{ gap: 14 }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 14 }}>
          <MedsIconTile icon={settings ? BellOff : Bell} />
          <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
            <Text accessibilityRole="header" style={[hubText.cardTitle, { color: c.text100 }]}>
              {title}
            </Text>
            <Text style={[hubText.body, { color: c.text200 }]}>{body}</Text>
          </View>
        </View>
        {settings ? (
          <MedsButton tone="tonal" compact label={primerSettingsLabel()} onPress={openSettings} />
        ) : (
          <MedsButton tone="tonal" compact label={primer.cta} loading={busy} onPress={continueToSystemSheet} />
        )}
      </MedsCard>
    </View>
  );
}
