import React, { useState } from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ProfileScreenHeader } from '@/components/ui/ProfileScreenHeader';
import { PetsHubView } from '@/components/pets/PetsHubView';
import { PetsClinicsSection } from '@/components/pets/PetsClinicsSection';
import { PetLoading } from '@/components/pets/PetUi';
import { usePetList } from '@/components/pets/usePetList';
import { useThemeColors } from '@/theme/colors';

export default function PetsHubScreen() {
  const c = useThemeColors(), insets = useSafeAreaInsets(), router = useRouter();
  const { pets, ready, error, offline, reload, owner } = usePetList();
  const [refreshing, setRefreshing] = useState(false);
  const refresh = async () => { setRefreshing(true); try { await reload(); } finally { setRefreshing(false); } };
  return <View style={{ flex: 1, backgroundColor: c.bg100 }}><ProfileScreenHeader title="ჩემი ცხოველები" />{!ready ? <PetLoading /> : <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 32, gap: 28 }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} tintColor={c.primary100} />}><PetsHubView key={owner} pets={pets} error={error} offline={offline} onNavigate={path => router.push(path as never)} onRetry={() => void refresh()} /><PetsClinicsSection /></ScrollView>}</View>;
}
