import React, { useState } from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Plus } from 'lucide-react-native';
import { ModuleHeader, ModuleHeaderButton } from '@/components/brand/ModuleHeader';
import { PetsHubView } from '@/components/pets/PetsHubView';
import { PetsClinicsSection } from '@/components/pets/PetsClinicsSection';
import { PetLoading } from '@/components/pets/PetUi';
import { usePetList } from '@/components/pets/usePetList';
import { useThemeColors } from '@/theme/colors';
import { HUB } from '@/theme/hub';
import { tx } from '@/i18n/locale';

/** MEDIVET hub — the standard module header scrolls with the page. */
export default function PetsHubScreen() {
  const c = useThemeColors(), insets = useSafeAreaInsets(), router = useRouter();
  const { pets, ready, error, offline, reload, owner } = usePetList();
  const [refreshing, setRefreshing] = useState(false);
  const refresh = async () => { setRefreshing(true); try { await reload(); } finally { setRefreshing(false); } };
  const header = (
    <ModuleHeader
      module="vet"
      subtitle={tx('ჩემი ცხოველები', 'My pets')}
      right={<ModuleHeaderButton label={tx('ცხოველის დამატება', 'Add a pet')} icon={Plus} onPress={() => router.push('/pets/new')} />}
    />
  );
  return (
    <View style={{ flex: 1, backgroundColor: c.bg100 }}>
      {!ready ? (
        <View style={{ flex: 1, paddingTop: insets.top + 12 }}>
          <View style={{ paddingHorizontal: HUB.gutter }}>{header}</View>
          <PetLoading />
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingTop: insets.top + 12, paddingHorizontal: HUB.gutter, paddingBottom: insets.bottom + 32, gap: 20 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} tintColor={c.primary100} />}
        >
          {header}
          <PetsHubView key={owner} pets={pets} error={error} offline={offline} onNavigate={(path) => router.push(path as never)} onRetry={() => void refresh()} />
          <View style={{ marginTop: HUB.sectionGap - 20 }}>
            <PetsClinicsSection />
          </View>
        </ScrollView>
      )}
    </View>
  );
}
