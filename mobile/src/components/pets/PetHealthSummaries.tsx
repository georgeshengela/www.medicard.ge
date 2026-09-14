import React, { useCallback, useState } from 'react';
import { Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { ChevronRight } from 'lucide-react-native';
import { Card } from '@/components/ui/Card';
import { HomeSectionTitle } from '@/components/home/HomeSectionTitle';
import { ka } from '@/i18n/ka';
import { ApiError, api, type PetAllergy, type PetCondition, type PetWeightLog } from '@/lib/api';
import { formatCycleDateKa } from '@/lib/cycleCivilDateKa';
import { formatPetWeight, petsHealthErrorKind } from '@/lib/petsHealth';
import { useThemeColors } from '@/theme/colors';

function SummaryCard({
  title,
  children,
  onPress,
}: {
  title: string;
  children: React.ReactNode;
  onPress: () => void;
}) {
  const colors = useThemeColors();
  return (
    <View>
      <HomeSectionTitle title={title} />
      <Card onPress={onPress}>
        <View className="flex-row items-center">
          <View className="flex-1 pr-3">{children}</View>
          <ChevronRight size={18} color={colors.text300} strokeWidth={2} />
        </View>
      </Card>
    </View>
  );
}

export function PetHealthSummaries({ petId }: { petId: string }) {
  const router = useRouter();
  const [weight, setWeight] = useState<PetWeightLog | null>(null);
  const [allergies, setAllergies] = useState<PetAllergy[] | null>(null);
  const [conditions, setConditions] = useState<PetCondition[] | null>(null);
  const [ready, setReady] = useState(false);
  const [healthError, setHealthError] = useState<unknown>(null);

  const load = useCallback(async () => {
    setHealthError(null);
    try {
      const [weightRes, allergyRes, conditionRes] = await Promise.all([
        api.pets.weight.list(petId, { limit: 30 }),
        api.pets.allergies.list(petId),
        api.pets.conditions.list(petId),
      ]);
      setWeight(weightRes.latest);
      setAllergies(allergyRes.items);
      setConditions(conditionRes.items);
    } catch (error) {
      setWeight(null);
      setAllergies(null);
      setConditions(null);
      setHealthError(error);
    } finally {
      setReady(true);
    }
  }, [petId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  if (!ready) return null;

  if (healthError) {
    const kind = petsHealthErrorKind(healthError);
    const message =
      kind === 'unavailable'
        ? ka.pets.healthUnavailable
        : healthError instanceof ApiError
          ? healthError.message
          : ka.pets.healthLoadError;
    return (
      <View>
        <HomeSectionTitle title={ka.pets.weightTitle} />
        <Card onPress={() => void load()}>
          <Text className="text-base text-text-200">{message}</Text>
          <Text className="mt-2 text-base font-semibold text-primary-200">{ka.pets.retry}</Text>
        </Card>
      </View>
    );
  }

  const active = (conditions || []).filter((row) => row.status === 'active').length;
  const resolved = (conditions || []).filter((row) => row.status === 'resolved').length;

  return (
    <View className="gap-4">
      <SummaryCard title={ka.pets.weightTitle} onPress={() => router.push(`/pets/${petId}/weight`)}>
        {weight ? (
          <>
            <Text className="text-xl font-bold text-text-100" style={{ fontFamily: 'NotoSansGeorgian_700Bold' }}>
              {formatPetWeight(weight, ka.pets)}
            </Text>
            <Text className="mt-1 text-sm text-text-300">{formatCycleDateKa(weight.recordedOn)}</Text>
          </>
        ) : (
          <Text className="text-base text-text-300">{ka.pets.weightEmpty}</Text>
        )}
      </SummaryCard>

      <SummaryCard title={ka.pets.allergiesTitle} onPress={() => router.push(`/pets/${petId}/allergies`)}>
        {allergies && allergies.length ? (
          <Text className="text-base text-text-100">
            {allergies
              .slice(0, 3)
              .map((row) => row.name)
              .join(' · ')}
            {allergies.length > 3 ? ` · ${ka.pets.allergyCount(allergies.length)}` : ''}
          </Text>
        ) : (
          <Text className="text-base text-text-300">{ka.pets.allergiesEmpty}</Text>
        )}
      </SummaryCard>

      <SummaryCard title={ka.pets.conditionsTitle} onPress={() => router.push(`/pets/${petId}/conditions`)}>
        {conditions && conditions.length ? (
          <Text className="text-base text-text-100">
            {ka.pets.conditionActiveCount(active)}
            {resolved ? ` · ${ka.pets.conditionResolvedCount(resolved)}` : ''}
          </Text>
        ) : (
          <Text className="text-base text-text-300">{ka.pets.conditionsEmpty}</Text>
        )}
      </SummaryCard>
    </View>
  );
}
