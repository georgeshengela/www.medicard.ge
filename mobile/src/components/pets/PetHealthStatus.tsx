import React from 'react';
import { Text, View } from 'react-native';
import { AlertCircle, RefreshCcw } from 'lucide-react-native';
import { PetButton as Button } from '@/components/pets/PetUi';
import { EmptyState } from '@/components/EmptyState';
import { ka } from '@/i18n/ka';
import { petsHealthErrorKind } from '@/lib/petsHealth';
import { useThemeColors } from '@/theme/colors';

export function PetHealthStatus({
  error,
  onRetry,
}: {
  error: unknown;
  onRetry: () => void;
}) {
  const colors = useThemeColors();
  const kind = petsHealthErrorKind(error);
  const title = kind === 'unavailable' ? ka.pets.healthUnavailable : kind === 'offline' ? ka.common.networkError : ka.pets.healthLoadError;
  const body = kind === 'unavailable' ? undefined : kind === 'offline' ? ka.common.offlineCached : undefined;
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg100 }}>
      <EmptyState icon={kind === 'unavailable' ? AlertCircle : RefreshCcw} title={title} body={body}>
        <Button label={ka.pets.retry} onPress={onRetry} />
      </EmptyState>
    </View>
  );
}

export function PetSectionHint({ text }: { text: string }) {
  const colors = useThemeColors();
  return <Text style={{ fontSize: 13, color: colors.text300 }}>{text}</Text>;
}
