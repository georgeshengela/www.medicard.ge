import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Dimensions, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Bell } from 'lucide-react-native';
import { APP_MODAL_OVERLAY, APP_MODAL_PROPS } from '@/components/ui/appModal';
import {
  NOTIFICATION_GROUP_LABELS,
  NOTIFICATION_GROUPS,
  fireAllCatalogItems,
  fireCatalogItem,
  notificationCatalog,
  type NotificationCatalogItem,
} from '@/lib/notificationCatalog';
import {
  getNotificationDebugStatus,
  listScheduledReminders,
  requestNotificationPermission,
  type ScheduledReminderCounts,
  type ScheduledReminderRow,
} from '@/lib/notifications';
import { loadEngageTrace } from '@/lib/mediEngagePrefs';
import { formatEngageTrace, type EngageTrace } from '@/lib/mediNotificationBrain.shared';
import { useThemeColors } from '@/theme/colors';
import { showDevUi } from '@/lib/devUi';

type Status = Awaited<ReturnType<typeof getNotificationDebugStatus>>;

function countLine(counts: ScheduledReminderCounts): string {
  return `med ${counts.med} · cycle ${counts.cycle} · visit ${counts.visit} · steps ${counts.steps} · weight ${counts.weight} · medi ${counts.engage} · სულ ${counts.total}`;
}

export function NotificationsDevLauncher() {
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<Status | null>(null);
  const [scheduled, setScheduled] = useState<ScheduledReminderRow[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [trace, setTrace] = useState<EngageTrace | null>(null);
  const catalog = notificationCatalog();

  const refresh = useCallback(async () => {
    const [nextStatus, rows, nextTrace] = await Promise.all([
      getNotificationDebugStatus(),
      listScheduledReminders(),
      loadEngageTrace(),
    ]);
    setStatus(nextStatus);
    setScheduled(rows.filter((row) => row.group !== 'qa'));
    setTrace(nextTrace);
  }, []);

  if (!showDevUi()) return null;

  const openSheet = async () => {
    setOpen(true);
    setToast(null);
    await requestNotificationPermission();
    await import('@/lib/pushCopy').then(({ loadPushTemplates }) => loadPushTemplates());
    await refresh();
  };

  const fire = async (item: NotificationCatalogItem) => {
    setBusyId(item.id);
    const ok = await fireCatalogItem(item, 2);
    setToast(ok ? `2 წამში: ${item.title}` : 'ნებართვა უარყოფილია ან scheduler მიუწვდომელია');
    setBusyId(null);
    await refresh();
  };

  const fireAll = async () => {
    setBusyId('all');
    const n = await fireAllCatalogItems();
    setToast(`${n} შეტყობინება დაყენდა · 2 წამიდან, 3 წამის ინტერვალით`);
    setBusyId(null);
    await refresh();
  };

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="DEV notifications"
        onPress={() => void openSheet()}
        style={{
          position: 'absolute',
          right: 16,
          bottom: 156,
          width: 48,
          height: 48,
          borderRadius: 24,
          backgroundColor: '#0D9488',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 999,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.15,
          shadowRadius: 4,
          elevation: 4,
        }}
      >
        <Bell size={22} color="#FFFFFF" />
      </Pressable>

      <Modal visible={open} {...APP_MODAL_PROPS} onRequestClose={() => setOpen(false)}>
        <View style={sheetStyles.root}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close"
            onPress={() => setOpen(false)}
            style={[sheetStyles.backdrop, { backgroundColor: APP_MODAL_OVERLAY }]}
          />
          <View
            style={[
              sheetStyles.sheet,
              {
                backgroundColor: colors.surface,
                maxHeight: Math.round(Dimensions.get('window').height * 0.88),
              },
            ]}
          >
            <ScrollView
              style={{ maxHeight: Math.round(Dimensions.get('window').height * 0.88) - 20 }}
              contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 16) + 24 }}
              showsVerticalScrollIndicator
              keyboardShouldPersistTaps="handled"
              nestedScrollEnabled
              bounces
            >
              <Text style={{ fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 18, color: colors.text100 }}>
                Notifications QA
              </Text>
              <Text
                style={{
                  fontFamily: 'NotoSansGeorgian_400Regular',
                  fontSize: 13,
                  color: colors.text300,
                  marginTop: 4,
                  marginBottom: 12,
                }}
              >
                რა გვაქვს, როგორ იგზავნება, რას წერს. Fire = ნამდვილი banner 2 წამში.
              </Text>

              {status ? (
                <View
                  style={{
                    backgroundColor: colors.bg200,
                    borderRadius: 12,
                    padding: 12,
                    marginBottom: 12,
                    gap: 4,
                  }}
                >
                  <Text style={{ fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 13, color: colors.text100 }}>
                    OS {status.permission} · opt-in {status.optedIn ? 'on' : 'off'} · toggle{' '}
                    {status.enabled ? 'on' : 'off'}
                  </Text>
                  <Text style={{ fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 12, color: colors.text200 }}>
                    {countLine(status.counts)}
                  </Text>
                  <Text style={{ fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 11, color: colors.text300 }}>
                    token {status.tokenPreview ?? 'არაა'}
                  </Text>
                </View>
              ) : (
                <ActivityIndicator color={colors.primary200} style={{ marginBottom: 12 }} />
              )}

              <Pressable
                onPress={() => void fireAll()}
                disabled={busyId != null}
                style={{
                  backgroundColor: '#0D9488',
                  borderRadius: 12,
                  paddingVertical: 12,
                  alignItems: 'center',
                  marginBottom: 12,
                  opacity: busyId != null ? 0.6 : 1,
                }}
              >
                <Text style={{ fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 14, color: '#FFFFFF' }}>
                  {busyId === 'all' ? 'იგზავნება…' : 'ყველას გაშვება'}
                </Text>
              </Pressable>

              {trace ? (
                <View
                  style={{
                    backgroundColor: colors.bg200,
                    borderRadius: 12,
                    padding: 12,
                    marginBottom: 12,
                  }}
                >
                  <Text style={{ fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 13, color: colors.text100, marginBottom: 6 }}>
                    Notification Decision
                  </Text>
                  <Text style={{ fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 11, lineHeight: 16, color: colors.text200 }}>
                    {formatEngageTrace(trace)}
                  </Text>
                </View>
              ) : null}

              {toast ? (
                <Text
                  style={{
                    fontFamily: 'NotoSansGeorgian_400Regular',
                    fontSize: 12,
                    color: '#14B8A6',
                    marginBottom: 12,
                  }}
                >
                  {toast}
                </Text>
              ) : null}
              {NOTIFICATION_GROUPS.map((group) => {
                const items = catalog.filter((item) => item.group === group);
                if (!items.length) return null;
                return (
                  <View key={group} style={{ marginBottom: 16 }}>
                    <Text
                      style={{
                        fontFamily: 'NotoSansGeorgian_700Bold',
                        fontSize: 13,
                        color: colors.text300,
                        marginBottom: 6,
                        letterSpacing: 0.4,
                      }}
                    >
                      {NOTIFICATION_GROUP_LABELS[group]}
                    </Text>
                    {items.map((item) => (
                      <CatalogRow
                        key={item.id}
                        item={item}
                        busy={busyId === item.id}
                        disabled={busyId != null}
                        onFire={() => void fire(item)}
                      />
                    ))}
                  </View>
                );
              })}

              {scheduled.length ? (
                <View style={{ marginBottom: 24 }}>
                  <Text
                    style={{
                      fontFamily: 'NotoSansGeorgian_700Bold',
                      fontSize: 13,
                      color: colors.text300,
                      marginBottom: 6,
                    }}
                  >
                    დაგეგმილი ახლა ({scheduled.length})
                  </Text>
                  {scheduled.map((row) => (
                    <View key={row.id} style={{ paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.bg200 }}>
                      <Text style={{ fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 13, color: colors.text100 }}>
                        {row.title || row.id}
                      </Text>
                      <Text style={{ fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 12, color: colors.text300 }}>
                        {row.group} · {row.trigger}
                      </Text>
                    </View>
                  ))}
                </View>
              ) : null}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
}

function CatalogRow({
  item,
  busy,
  disabled,
  onFire,
}: {
  item: NotificationCatalogItem;
  busy: boolean;
  disabled: boolean;
  onFire: () => void;
}) {
  const colors = useThemeColors();
  return (
    <View style={{ paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.bg200 }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 15, color: colors.text100 }}>
            {item.label}
          </Text>
          <Text style={{ fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 11, color: '#14B8A6', marginTop: 2 }}>
            {item.send === 'remote' ? 'REMOTE' : 'LOCAL'} · {item.channelId}
          </Text>
          <Text style={{ fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 12, color: colors.text200, marginTop: 6 }}>
            {item.title}
          </Text>
          <Text style={{ fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 12, color: colors.text300, marginTop: 2 }}>
            {item.body}
          </Text>
          <Text style={{ fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 11, color: colors.text300, marginTop: 6 }}>
            {item.how}
          </Text>
          {item.note ? (
            <Text style={{ fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 11, color: '#F59E0B', marginTop: 4 }}>
              {item.note}
            </Text>
          ) : null}
        </View>
        <Pressable
          onPress={onFire}
          disabled={disabled || !item.fireable}
          style={{
            paddingHorizontal: 12,
            paddingVertical: 8,
            borderRadius: 10,
            backgroundColor: colors.bg200,
            opacity: disabled || !item.fireable ? 0.45 : 1,
          }}
        >
          <Text style={{ fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 12, color: '#14B8A6' }}>
            {busy ? '…' : 'Fire'}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const sheetStyles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
});
