import React, { useCallback, useRef, useState } from 'react';
import { Modal, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import type { Swipeable } from 'react-native-gesture-handler';
import {
  HeartPulse,
  MessageCircle,
  Package,
  PawPrint,
  Plus,
  Scale,
  type LucideIcon,
} from 'lucide-react-native';
import { TbilisiMovesChrome } from '@/components/tbilisiMoves/TbilisiMovesChrome';
import { PetsManageRow } from '@/components/pets/PetsManageRow';
import { EmptyState } from '@/components/EmptyState';
import { ListRowsSkeleton } from '@/components/ui/Skeleton';
import { APP_MODAL_OVERLAY, APP_MODAL_PROPS } from '@/components/ui/appModal';
import { FIGMA_AUTH_DARK } from '@/constants/figmaAuthLayout';
import { ka } from '@/i18n/ka';
import { ApiError, api, type Pet } from '@/lib/api';
import { cachePetsList, loadCachedPetsList } from '@/lib/petsDraft';
import { useIsDark, useThemeColors } from '@/theme/colors';

const FLAT = {
  shadowColor: 'transparent',
  shadowOpacity: 0,
  shadowRadius: 0,
  shadowOffset: { width: 0, height: 0 },
  elevation: 0,
} as const;

const GEO = {
  title: 'NotoSansGeorgian_700Bold',
  semibold: 'NotoSansGeorgian_600SemiBold',
  regular: 'NotoSansGeorgian_400Regular',
} as const;

function HubTile({
  icon: Icon,
  label,
  hint,
  onPress,
}: {
  icon: LucideIcon;
  label: string;
  hint?: string;
  onPress: () => void;
}) {
  const colors = useThemeColors();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      className="active:opacity-80"
      style={{
        ...FLAT,
        flex: 1,
        minHeight: 88,
        padding: 14,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: colors.bg300,
        backgroundColor: colors.surface,
        gap: 10,
      }}
    >
      <View
        style={{
          width: 36,
          height: 36,
          borderRadius: 12,
          backgroundColor: colors.accent100,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icon size={18} color={colors.primary200} strokeWidth={2.2} />
      </View>
      <Text numberOfLines={1} style={{ fontFamily: GEO.semibold, fontSize: 14, color: colors.text100 }}>
        {label}
      </Text>
      {hint ? (
        <Text numberOfLines={2} style={{ fontFamily: GEO.regular, fontSize: 12, lineHeight: 16, color: colors.text300 }}>
          {hint}
        </Text>
      ) : null}
    </Pressable>
  );
}

export default function PetsHubScreen() {
  const colors = useThemeColors();
  const dark = useIsDark();
  const router = useRouter();
  const [pets, setPets] = useState<Pet[]>([]);
  const [ready, setReady] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [offline, setOffline] = useState(false);
  const [pendingArchive, setPendingArchive] = useState<Pet | null>(null);
  const [archiving, setArchiving] = useState(false);
  const openSwipe = useRef<Swipeable | null>(null);
  const ctaBg = dark ? FIGMA_AUTH_DARK.primaryBg : colors.primary200;
  const featured = pets[0] ?? null;

  const load = useCallback(async () => {
    setError(null);
    try {
      const { pets: rows } = await api.pets.list();
      setPets(rows);
      await cachePetsList(rows);
      setOffline(false);
    } catch (caught) {
      const cached = await loadCachedPetsList();
      setPets(cached as Pet[]);
      setOffline(cached.length > 0);
      if (caught instanceof ApiError && caught.status === 503) {
        setError(ka.pets.schemaUnavailable);
      } else {
        setError(cached.length ? ka.common.offlineCached : ka.pets.loadError);
      }
    } finally {
      setReady(true);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const confirmArchive = async () => {
    if (!pendingArchive || archiving) return;
    setArchiving(true);
    try {
      await api.pets.archive(pendingArchive.id);
      void import('@/lib/petCareReminders').then(({ reconcilePetCareReminders }) =>
        reconcilePetCareReminders({ reason: 'archive' }),
      );
      setPendingArchive(null);
      await load();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : ka.common.networkError);
    } finally {
      setArchiving(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg100 }}>
      <TbilisiMovesChrome
        title={ka.pets.hubTitle}
        right={
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={ka.pets.add}
            onPress={() => router.push('/pets/new')}
            hitSlop={8}
            className="active:opacity-80"
            style={{
              ...FLAT,
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: colors.surface,
              borderWidth: 1,
              borderColor: colors.bg300,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Plus size={20} color={colors.primary200} strokeWidth={2.2} />
          </Pressable>
        }
      />

      {!ready ? (
        <View style={{ padding: 16 }}>
          <ListRowsSkeleton padded={false} />
        </View>
      ) : (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: 16, paddingBottom: 40, gap: 16 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          {error ? (
            <Text style={{ fontFamily: GEO.regular, fontSize: 13, lineHeight: 18, color: colors.text300 }}>
              {offline ? ka.common.offlineCached : error}
            </Text>
          ) : (
            <Text style={{ fontFamily: GEO.regular, fontSize: 14, lineHeight: 20, color: colors.text300 }}>
              {ka.pets.swipeHint}
            </Text>
          )}

          {pets.length === 0 ? (
            <EmptyState icon={PawPrint} title={ka.pets.emptyTitle} body={error || ka.pets.emptyBody}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={ka.pets.add}
                onPress={() => router.push('/pets/new')}
                className="active:opacity-90"
                style={{
                  ...FLAT,
                  minHeight: 48,
                  borderRadius: 16,
                  backgroundColor: ctaBg,
                  paddingHorizontal: 18,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text style={{ fontFamily: GEO.title, fontSize: 15, color: '#FFFFFF' }}>{ka.pets.add}</Text>
              </Pressable>
            </EmptyState>
          ) : (
            <View style={{ gap: 10 }}>
              {pets.map((pet) => (
                <PetsManageRow
                  key={pet.id}
                  pet={pet}
                  onOpen={() => router.push(`/pets/${pet.id}`)}
                  onEdit={() => router.push(`/pets/${pet.id}/edit`)}
                  onArchive={() => setPendingArchive(pet)}
                  onWillOpen={(ref) => {
                    if (openSwipe.current && openSwipe.current !== ref) openSwipe.current.close();
                    openSwipe.current = ref;
                  }}
                />
              ))}
            </View>
          )}

          {pets.length > 0 ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={ka.pets.addAnother}
              onPress={() => router.push('/pets/new')}
              className="active:opacity-90"
              style={{
                ...FLAT,
                minHeight: 52,
                borderRadius: 16,
                backgroundColor: ctaBg,
                paddingHorizontal: 16,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
              }}
            >
              <Plus size={18} color="#FFFFFF" strokeWidth={2.4} />
              <Text style={{ fontFamily: GEO.title, fontSize: 15, color: '#FFFFFF' }}>{ka.pets.addAnother}</Text>
            </Pressable>
          ) : null}

          {featured ? (
            <View style={{ gap: 10 }}>
              <Text style={{ fontFamily: GEO.title, fontSize: 14, lineHeight: 20, color: colors.text100 }}>
                {ka.pets.manageSection}
              </Text>
              <Text style={{ fontFamily: GEO.regular, fontSize: 13, lineHeight: 18, color: colors.text300 }}>
                {ka.pets.manageSectionHint(featured.name)}
              </Text>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <HubTile
                  icon={Package}
                  label={ka.pets.productsTitle}
                  hint={ka.pets.productAddHint}
                  onPress={() => router.push(`/pets/${featured.id}/care/products`)}
                />
                <HubTile
                  icon={HeartPulse}
                  label={ka.pets.careTitle}
                  hint={ka.pets.careAdd}
                  onPress={() => router.push(`/pets/${featured.id}/care`)}
                />
              </View>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <HubTile
                  icon={MessageCircle}
                  label={ka.pets.vetName}
                  hint={ka.pets.vetDescription}
                  onPress={() => router.push(`/pets/${featured.id}/chat`)}
                />
                <HubTile
                  icon={Scale}
                  label={ka.pets.weightTitle}
                  hint={ka.pets.weightAdd}
                  onPress={() => router.push(`/pets/${featured.id}/weight`)}
                />
              </View>
            </View>
          ) : null}
        </ScrollView>
      )}

      <Modal visible={Boolean(pendingArchive)} {...APP_MODAL_PROPS} onRequestClose={() => setPendingArchive(null)}>
        <View style={{ flex: 1 }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={ka.common.cancel}
            onPress={() => setPendingArchive(null)}
            style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: APP_MODAL_OVERLAY }}
          />
          <View pointerEvents="box-none" style={{ flex: 1, justifyContent: 'center', paddingHorizontal: 20 }}>
            <View
              style={{
                backgroundColor: colors.surface,
                borderRadius: 28,
                borderWidth: 1,
                borderColor: colors.bg300,
                padding: 22,
                gap: 16,
                zIndex: 2,
              }}
            >
              <Text style={{ fontFamily: GEO.title, fontSize: 18, color: colors.text100 }}>
                {ka.pets.archiveConfirmTitle}
              </Text>
              <Text style={{ fontFamily: GEO.regular, fontSize: 14, lineHeight: 20, color: colors.text200 }}>
                {pendingArchive
                  ? `${pendingArchive.name}. ${ka.pets.archiveConfirmBody}`
                  : ka.pets.archiveConfirmBody}
              </Text>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setPendingArchive(null)}
                  className="active:opacity-80"
                  style={{
                    ...FLAT,
                    flex: 1,
                    minHeight: 48,
                    borderRadius: 16,
                    borderWidth: 1,
                    borderColor: colors.bg300,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Text style={{ fontFamily: GEO.semibold, fontSize: 15, color: colors.text100 }}>{ka.common.cancel}</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => void confirmArchive()}
                  className="active:opacity-80"
                  style={{
                    ...FLAT,
                    flex: 1,
                    minHeight: 48,
                    borderRadius: 16,
                    backgroundColor: colors.danger,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Text style={{ fontFamily: GEO.title, fontSize: 15, color: '#FFFFFF' }}>
                    {archiving ? ka.pets.saving : ka.pets.archiveAction}
                  </Text>
                </Pressable>
              </View>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
