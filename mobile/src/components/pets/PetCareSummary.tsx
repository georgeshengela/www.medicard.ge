import React, { useCallback, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { AlertTriangle, ChevronRight, Syringe } from 'lucide-react-native';
import { localAccountId } from '@/lib/localAccount';
import { Bone } from '@/components/ui/Skeleton';
import { PetPanel as Card } from '@/components/pets/PetUi';
import { HomeSectionTitle } from '@/components/home/HomeSectionTitle';
import { careKindIcon } from '@/components/pets/PetCareChips';
import { PetIconWell } from '@/components/pets/PetScreen';
import { ka } from '@/i18n/ka';
import { ApiError, api, type Pet, type PetCareOccurrence } from '@/lib/api';
import { formatCycleDateKa } from '@/lib/cycleCivilDateKa';
import { completeLabel, kindLabel, petsCareErrorKind } from '@/lib/petsCare';
import { useThemeColors } from '@/theme/colors';

export function PetCareSummary({ pet }: { pet: Pet }) {
  const generation = useRef(0);
  const colors = useThemeColors();
  const router = useRouter();
  const [overdue, setOverdue] = useState<PetCareOccurrence[]>([]);
  const [due, setDue] = useState<PetCareOccurrence[]>([]);
  const [upcoming, setUpcoming] = useState<PetCareOccurrence[]>([]);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const load = useCallback(async () => {
    const request = ++generation.current, owner = localAccountId();
    setError(null);
    try {
      const res = await api.pets.care.upcoming(pet.id);
      if (request !== generation.current || owner !== localAccountId()) return;
      setOverdue(res.overdue);
      setDue(res.due);
      setUpcoming(res.upcoming);
    } catch (caught) {
      if (request !== generation.current || owner !== localAccountId()) return;
      setOverdue([]);
      setDue([]);
      setUpcoming([]);
      setError(caught);
    } finally {
      if (request === generation.current && owner === localAccountId()) setReady(true);
    }
  }, [pet.id]);

  useFocusEffect(
    useCallback(() => {
      void load();
      return () => { generation.current++; };
    }, [load]),
  );

  if (!ready) return <Bone height={110} radius={24} />;

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
        <Card onPress={() => void load()}>
          <View className="flex-row items-center">
            <PetIconWell icon={AlertTriangle} />
            <View className="flex-1 px-3">
              <Text className="text-base text-text-200">{message}</Text>
              <Text className="mt-1 text-sm font-semibold text-primary-200">{ka.pets.retry}</Text>
            </View>
          </View>
        </Card>
      </View>
    );
  }

  const next = overdue[0] || due[0] || upcoming[0];
  const empty = !next;
  const Icon = next ? careKindIcon(next.kind) : Syringe;
  const headline = overdue.length
    ? `${ka.pets.overdue} · ${kindLabel(overdue[0].kind, ka.pets)}`
    : due.length
      ? `${ka.pets.dueToday} · ${kindLabel(due[0].kind, ka.pets)}`
      : next
        ? `${formatCycleDateKa(next.plannedOn)} · ${kindLabel(next.kind, ka.pets)}`
        : ka.pets.careEmpty;

  return (
    <View>
      <HomeSectionTitle title={ka.pets.careTitle} />
      <Card onPress={() => router.push(empty ? `/pets/${pet.id}/care/add` : `/pets/${pet.id}/care`)}>
        <View className="flex-row items-center">
          <PetIconWell icon={empty ? Syringe : Icon} />
          <View className="flex-1 px-3">
            <Text
              className="text-base font-semibold"
              style={{
                color: overdue.length ? colors.danger : empty ? colors.text300 : colors.text100,
                fontFamily: 'NotoSansGeorgian_600SemiBold',
              }}
            >
              {headline}
            </Text>
            {next?.title ? <Text className="mt-1 text-sm text-text-300">{next.title}</Text> : null}
            {empty ? (
              <Text className="mt-1 text-sm font-semibold text-primary-200">{ka.pets.careAdd}</Text>
            ) : overdue.length || due.length ? (
              <Text className="mt-1 text-sm text-text-200">{completeLabel(next?.kind, ka.pets)}</Text>
            ) : null}
          </View>
          <ChevronRight size={18} color={colors.text300} strokeWidth={2} />
        </View>
      </Card>
    </View>
  );
}
