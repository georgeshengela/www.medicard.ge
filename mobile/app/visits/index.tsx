import React, { useCallback, useMemo, useState } from 'react';
import { Alert, RefreshControl, ScrollView, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { BellRing, CalendarCheck, Plus } from 'lucide-react-native';
import { Button } from '@/components/ui/Button';
import { Disclaimer } from '@/components/Disclaimer';
import { EmptyState } from '@/components/EmptyState';
import { ListRowsSkeleton } from '@/components/ui/Skeleton';
import { VisitCard } from '@/components/visits/VisitCard';
import { ka } from '@/i18n/ka';
import { api, type DoctorVisit } from '@/lib/api';
import { isVisitPast, visitDateTimeMs } from '@/lib/visitReminders';
import { syncVisitReminders } from '@/lib/visitNotifications';
import { useTabBarInset } from '@/components/navigation/FloatingTabBar';
import { useThemeColors } from '@/theme/colors';

export default function VisitsScreen() {
  const colors = useThemeColors();
  const tabInset = useTabBarInset();
  const router = useRouter();
  const [visits, setVisits] = useState<DoctorVisit[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [reminderCount, setReminderCount] = useState<number | null>(null);
  const [ready, setReady] = useState(false);
  const load = useCallback(async () => {
    try {
      const { visits: rows } = await api.visits.list();
      setVisits(rows);
      const scheduled = await syncVisitReminders(rows);
      setReminderCount(scheduled);
    } catch {
      /* refresh is retry */
    } finally {
      setReady(true);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const { upcoming, past } = useMemo(() => {
    const sorted = [...visits].sort((a, b) => visitDateTimeMs(a) - visitDateTimeMs(b));
    return {
      upcoming: sorted.filter((v) => !isVisitPast(v)),
      past: sorted.filter((v) => isVisitPast(v)).reverse(),
    };
  }, [visits]);

  const openCreate = () => {
    router.push('/visits/editor');
  };

  const openEdit = (visit: DoctorVisit) => {
    router.push({ pathname: '/visits/editor', params: { id: visit.id } });
  };
  const remove = (visit: DoctorVisit) => {
    Alert.alert(ka.visits.deleteConfirm, visit.visitDate, [
      { text: ka.common.cancel, style: 'cancel' },
      {
        text: ka.common.delete,
        style: 'destructive',
        onPress: async () => {
          await api.visits.remove(visit.id).catch(() => undefined);
          load();
        },
      },
    ]);
  };

  return (
    <ScrollView        className="flex-1 bg-bg-100"
        contentContainerStyle={{ paddingBottom: tabInset + 16 }}
        contentContainerClassName="px-4 pt-3"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary200} />}
        showsVerticalScrollIndicator={false}
      >
        {reminderCount !== null && reminderCount > 0 ? (
          <View className="mb-3 flex-row items-center rounded-2xl border border-primary-300/30 bg-accent-100/30 px-3.5 py-2.5">
            <BellRing size={15} color={colors.primary200} strokeWidth={2.2} />
            <Text className="ml-2 text-sm font-semibold text-primary-100">
              {ka.visits.remindersScheduled(reminderCount)}
            </Text>
          </View>
        ) : null}

        {!ready ? (
          <ListRowsSkeleton rows={4} padded={false} />
        ) : visits.length === 0 ? (
          <EmptyState icon={CalendarCheck} title={ka.visits.empty} body={ka.visits.emptyHint}>
            <Button label={ka.visits.addTitle} icon={Plus} size="lg" onPress={openCreate} />
          </EmptyState>
        ) : (
          <>
            {upcoming.length > 0 ? (
              <View className="mb-4">
                <Text className="mb-2.5 text-sm font-bold uppercase tracking-wide text-text-300">
                  {ka.visits.upcoming}
                </Text>
                {upcoming.map((visit) => (
                  <VisitCard key={visit.id} visit={visit} onPress={() => openEdit(visit)} onDelete={() => remove(visit)} />
                ))}
              </View>
            ) : null}

            {past.length > 0 ? (
              <View className="mb-2">
                <Text className="mb-2.5 text-sm font-bold uppercase tracking-wide text-text-300">{ka.visits.past}</Text>
                {past.map((visit) => (
                  <VisitCard key={visit.id} visit={visit} onPress={() => openEdit(visit)} onDelete={() => remove(visit)} />
                ))}
              </View>
            ) : null}

            <Button label={ka.visits.addTitle} icon={Plus} variant="secondary" onPress={openCreate} />
          </>
        )}

        <Disclaimer className="mt-4" />
      </ScrollView>
  );
}