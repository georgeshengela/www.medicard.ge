import React, { useCallback, useState } from 'react';
import { Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { AlertTriangle, CalendarClock } from 'lucide-react-native';
import { Card } from '@/components/ui/Card';
import { HomeSectionTitle } from '@/components/home/HomeSectionTitle';
import { ka } from '@/i18n/ka';
import { ApiError, api, type Pet, type PetCareOccurrence } from '@/lib/api';
import { formatCycleDateKa } from '@/lib/cycleCivilDateKa';
import { completeLabel, kindLabel, petsCareErrorKind } from '@/lib/petsCare';
import { useThemeColors } from '@/theme/colors';

export function PetCareSummary({ pet }: { pet: Pet }) {
  const colors = useThemeColors();
  const router = useRouter();
  const [overdue, setOverdue] = useState<PetCareOccurrence[]>([]);
  const [due, setDue] = useState<PetCareOccurrence[]>([]);
  const [upcoming, setUpcoming] = useState<PetCareOccurrence[]>([]);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await api.pets.care.upcoming(pet.id);
      setOverdue(res.overdue);
      setDue(res.due);
      setUpcoming(res.upcoming);
    } catch (caught) {
      setOverdue([]);
      setDue([]);
      setUpcoming([]);
      setError(caught);
    } finally {
      setReady(true);
    }
  }, [pet.id]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  if (!ready) return null;

  if (error) {
    const kind = petsCareErrorKind(error);
    const message =
      kind === 'unavailable'
        ? ka.pets.careUnavailable
        : error instanceof ApiError
          ? error.message
          : ka.pets.healthLoadError;
    return (
      <View>
        <HomeSectionTitle title={ka.pets.careTitle} />
        <Card>
          <Text style={{ fontSize: 15, color: colors.text200 }}>{message}</Text>
          <Text
            onPress={() => void load()}
            accessibilityRole="button"
            className="mt-2 min-h-11 text-base font-semibold text-primary-200"
          >
            {ka.pets.retry}
          </Text>
        </Card>
      </View>
    );
  }

  const next = overdue[0] || due[0] || upcoming[0];
  const headline = overdue.length
    ? `${ka.pets.overdue} · ${kindLabel(overdue[0].kind, ka.pets)}`
    : due.length
      ? `${ka.pets.dueToday} · ${kindLabel(due[0].kind, ka.pets)}`
      : next
        ? `${formatCycleDateKa(next.plannedOn)} · ${kindLabel(next.kind, ka.pets)}`
        : ka.pets.noUpcoming;

  return (
    <View>
      <HomeSectionTitle title={ka.pets.careTitle} />
      <Card onPress={() => router.push(`/pets/${pet.id}/care`)}>
        <View className="flex-row items-center gap-3">
          {overdue.length ? (
            <AlertTriangle size={20} color={colors.danger} strokeWidth={2} />
          ) : (
            <CalendarClock size={20} color={colors.primary200} strokeWidth={2} />
          )}
          <View className="flex-1">
            <Text className="text-base font-semibold text-text-100">{headline}</Text>
            {next?.title ? <Text className="mt-1 text-sm text-text-300">{next.title}</Text> : null}
          </View>
        </View>
        {overdue.length || due.length ? (
          <Text className="mt-2 text-sm text-text-200">{completeLabel(next?.kind, ka.pets)}</Text>
        ) : null}
      </Card>
    </View>
  );
}
