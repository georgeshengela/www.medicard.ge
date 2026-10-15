import React, { useEffect, useMemo } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CalendarCheck, ChevronRight, Heart, LocateFixed, Map as MapIcon, Plus, Search, Store } from 'lucide-react-native';
import { ModuleHeader, ModuleHeaderButton } from '@/components/brand/ModuleHeader';
import { HomeSectionHeading } from '@/components/home/HomeSectionHeading';
import { AppointmentRow, BookHero, BusinessRow, CategoryChips, FlatCard, useBookOrigin } from '@/components/book/BookUI';
import { ListRowsSkeleton } from '@/components/ui/Skeleton';
import { VisitCard } from '@/components/visits/VisitCard';
import { useAccountQuery } from '@/hooks/useAccountQuery';
import { tx } from '@/i18n/locale';
import { api, type DoctorVisit } from '@/lib/api';
import { syncBookReminders } from '@/lib/book/bookNotifications';
import type { BookAppointment, BookBusinessCard, BookCategoryId } from '@/lib/book/bookTypes';
import { isHrefAvailable, useFeatureState } from '@/lib/featureFlags';
import { FRESH } from '@/lib/queryClient';
import { isVisitPast, visitDateTimeMs } from '@/lib/visitReminders';
import { HUB, hubText } from '@/theme/hub';
import { useThemeColors } from '@/theme/colors';

/**
 * MEDIBOOK hub: the next booking (or the search prompt), categories, the places around the person, saved
 * places, every upcoming booking and the visits typed in by hand (the old „ექიმთან ვიზიტები“ lives on here).
 */
export default function BookHubScreen() {
  const c = useThemeColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const features = useFeatureState();
  const visitsOn = isHrefAvailable('/visits/editor', features);
  const { origin, source, granted, request } = useBookOrigin();

  const mine = useAccountQuery({ key: ['book', 'mine'], fetch: api.book.appointments, staleTime: FRESH.SHORT });
  const favorites = useAccountQuery({ key: ['book', 'favorites'], fetch: () => api.book.favorites(origin), staleTime: FRESH.SHORT });
  const nearby = useAccountQuery({
    key: ['book', 'nearby', origin.lat.toFixed(3), origin.lng.toFixed(3)],
    fetch: () => api.book.nearby({ lat: origin.lat, lng: origin.lng, radiusKm: source === 'gps' ? 4 : 8, limit: 8 }),
    staleTime: FRESH.LONG,
  });
  const visits = useAccountQuery<DoctorVisit[]>({ key: ['visits', 'home'], fetch: async () => (await api.visits.list()).visits, staleTime: FRESH.SHORT, enabled: visitsOn });

  const upcoming = mine.data?.upcoming ?? [];
  const past = mine.data?.past ?? [];
  const next = upcoming[0] ?? null;
  useEffect(() => {
    if (mine.data) void syncBookReminders(mine.data.upcoming);
  }, [mine.data]);

  const manualVisits = useMemo(() => (visits.data ?? []).filter((v) => v.active && !isVisitPast(v)).sort((a, b) => visitDateTimeMs(a) - visitDateTimeMs(b)).slice(0, 3), [visits.data]);
  const refreshing = mine.isRefetching || nearby.isRefetching;
  const refresh = () => {
    void mine.refetch();
    void nearby.refetch();
    void favorites.refetch();
    if (visitsOn) void visits.refetch();
  };

  const openBusiness = (b: BookBusinessCard) => router.push(`/book/b/${b.id}` as never);
  const openAppointment = (a: BookAppointment) => router.push(`/book/appointments/${a.id}` as never);
  const openCategory = (id: BookCategoryId | null) => router.push((id ? `/book/search?category=${id}` : '/book/search') as never);

  return (
    <ScrollView
      contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: insets.bottom + 96, paddingHorizontal: HUB.gutter }}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={c.primary200} />}
    >
      <ModuleHeader
        module="book"
        subtitle={tx('ჯავშნები და სერვისები შენ ირგვლივ', 'Bookings and services around you')}
        right={<ModuleHeaderButton label={tx('რუკა', 'Map')} icon={MapIcon} onPress={() => router.push('/book/map' as never)} />}
      />

      <View style={{ marginTop: 20 }}>
        <BookHero next={next} onOpen={openAppointment} onSearch={() => router.push('/book/search' as never)} onMap={() => router.push('/book/map' as never)} />
      </View>

      <Pressable accessibilityRole="search" onPress={() => router.push('/book/search' as never)} style={[s.search, { backgroundColor: c.surface }]}>
        <Search size={18} color={c.text300} strokeWidth={2} />
        <Text style={[hubText.body, { color: c.text300, flex: 1 }]}>{tx('სტომატოლოგი, მანიკური, მასაჟი, კლინიკა…', 'Dentist, manicure, massage, clinic…')}</Text>
      </Pressable>

      <Pressable accessibilityRole="button" onPress={() => router.push('/book/appointments' as never)} style={[s.manual, { backgroundColor: c.surface, marginTop: 10 }]}>
        <View style={[s.tile, { borderWidth: 1.5, borderColor: c.primary100 }]}>
          <CalendarCheck size={18} color={c.primary100} strokeWidth={2.1} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[hubText.cardTitle, { color: c.text100 }]}>{tx('ჩემი ჯავშნები', 'My bookings')}</Text>
          <Text style={[hubText.caption, { color: c.text200 }]}>
            {mine.data ? (upcoming.length ? tx(`${upcoming.length} მომავალი · ${past.length} წარსული`, `${upcoming.length} ahead · ${past.length} past`) : past.length ? tx(`მომავალი არ არის · ${past.length} წარსული`, `Nothing ahead · ${past.length} past`) : tx('ჯერ არაფერია — ჩაეწერე პირველად', 'Nothing yet — make your first booking')) : tx('იტვირთება…', 'Loading…')}
          </Text>
        </View>
        <ChevronRight size={17} color={c.text300} />
      </Pressable>

      <View style={{ marginTop: 14 }}>
        <CategoryChips value={null} onChange={openCategory} all={false} />
      </View>

      {upcoming.length > 1 ? (
        <View style={{ marginTop: HUB.sectionGap }}>
          <HomeSectionHeading title={tx('მომავალი ჯავშნები', 'Upcoming bookings')} linkLabel={tx('ყველა', 'All')} onLink={() => router.push('/book/appointments' as never)} />
          <FlatCard>
            {upcoming.slice(1, 6).map((a, i) => <AppointmentRow key={a.id} appointment={a} first={i === 0} onPress={() => openAppointment(a)} />)}
          </FlatCard>
        </View>
      ) : null}

      <View style={{ marginTop: HUB.sectionGap }}>
        <HomeSectionHeading title={tx('ახლოს შენთან', 'Near you')} linkLabel={tx('რუკაზე', 'On the map')} onLink={() => router.push('/book/map' as never)} />
        {granted === false || source !== 'gps' ? (
          <Pressable accessibilityRole="button" onPress={() => void request()} style={[s.locate, { backgroundColor: c.accent100 }]}>
            <LocateFixed size={18} color={c.primary100} strokeWidth={2.1} />
            <View style={{ flex: 1 }}>
              <Text style={[hubText.cardTitle, { color: c.text100 }]}>{tx('გამოიყენე ჩემი მდებარეობა', 'Use my location')}</Text>
              <Text style={[hubText.caption, { color: c.text200 }]}>
                {source === 'profile' ? tx('ახლა შენი ქალაქის მიხედვით ვაჩვენებ', 'Showing places by your city for now') : tx('ახლა თბილისის ცენტრიდან ვაჩვენებ', 'Showing places from the centre of Tbilisi for now')}
              </Text>
            </View>
            <ChevronRight size={17} color={c.text300} />
          </Pressable>
        ) : null}
        {nearby.isLoading && !nearby.data ? (
          <ListRowsSkeleton rows={4} padded={false} />
        ) : nearby.data?.businesses.length ? (
          <FlatCard>
            {nearby.data.businesses.map((b, i) => <BusinessRow key={b.id} business={b} first={i === 0} onPress={() => openBusiness(b)} />)}
          </FlatCard>
        ) : (
          <FlatCard style={{ padding: 18 }}>
            <Text style={[hubText.body, { color: c.text200 }]}>{tx('ამ რადიუსში ჯერ არაფერია. მოძებნე სახელით ან გახსენი რუკა.', 'Nothing in this radius yet. Search by name or open the map.')}</Text>
          </FlatCard>
        )}
      </View>

      {favorites.data?.businesses.length ? (
        <View style={{ marginTop: HUB.sectionGap }}>
          <HomeSectionHeading title={tx('რჩეულები', 'Saved places')} />
          <FlatCard>
            {favorites.data.businesses.slice(0, 6).map((b, i) => <BusinessRow key={b.id} business={b} first={i === 0} onPress={() => openBusiness(b)} />)}
          </FlatCard>
        </View>
      ) : null}

      {visitsOn ? (
        <View style={{ marginTop: HUB.sectionGap }}>
          <HomeSectionHeading
            title={tx('ვიზიტები ხელით', 'Visits by hand')}
            linkLabel={tx('დამატება', 'Add')}
            onLink={() => router.push('/visits/editor' as never)}
          />
          {manualVisits.length ? (
            <View>
              {manualVisits.map((v) => (
                <VisitCard
                  key={v.id}
                  visit={v}
                  onPress={() => router.push({ pathname: '/visits/editor', params: { id: v.id } } as never)}
                  onDelete={() => {
                    void api.visits.remove(v.id).catch(() => undefined);
                  }}
                />
              ))}
            </View>
          ) : (
            <Pressable accessibilityRole="button" onPress={() => router.push('/visits/editor' as never)} style={[s.manual, { backgroundColor: c.surface }]}>
              <View style={[s.tile, { backgroundColor: c.bg200 }]}>
                <Plus size={18} color={c.primary100} strokeWidth={2.2} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[hubText.cardTitle, { color: c.text100 }]}>{tx('ჩაწერე ვიზიტი ხელით', 'Add a visit by hand')}</Text>
                <Text style={[hubText.caption, { color: c.text200 }]}>{tx('ექიმი, თარიღი, მისამართი და შეხსენება — თუ ადგილი კატალოგში არ არის', 'A doctor, a date, an address and a reminder — when the place is not in the catalogue')}</Text>
              </View>
              <ChevronRight size={17} color={c.text300} />
            </Pressable>
          )}
        </View>
      ) : null}

      {past.length ? (
        <View style={{ marginTop: HUB.sectionGap }}>
          <HomeSectionHeading title={tx('წარსული', 'Past')} linkLabel={tx('ყველა', 'All')} onLink={() => router.push('/book/appointments' as never)} />
          <FlatCard>
            {past.slice(0, 4).map((a, i) => <AppointmentRow key={a.id} appointment={a} first={i === 0} onPress={() => openAppointment(a)} />)}
          </FlatCard>
        </View>
      ) : null}

      <Pressable accessibilityRole="button" onPress={() => router.push('/book/business' as never)} style={[s.manual, { backgroundColor: c.surface, marginTop: HUB.sectionGap }]}>
        <View style={[s.tile, { backgroundColor: c.accent100 }]}>
          <Store size={18} color={c.primary100} strokeWidth={2} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[hubText.cardTitle, { color: c.text100 }]}>{tx('შენი ბიზნესია?', 'Is this your business?')}</Text>
          <Text style={[hubText.caption, { color: c.text200 }]}>{tx('დაადასტურე ან დაარეგისტრირე — კალენდარი, კლიენტები, ანალიტიკა უფასოდ', 'Claim or register — calendar, clients and analytics, free')}</Text>
        </View>
        <ChevronRight size={17} color={c.text300} />
      </Pressable>
      {favorites.data && !favorites.data.businesses.length ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 14, paddingHorizontal: 4 }}>
          <Heart size={13} color={c.text300} />
          <Text style={[hubText.small, { color: c.text300 }]}>{tx('შეინახე ადგილები გულით — აქ გამოჩნდება.', 'Save places with the heart — they show up here.')}</Text>
        </View>
      ) : null}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  search: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 14, paddingHorizontal: 16, height: 50, borderRadius: 16 },
  locate: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 18, marginBottom: 10 },
  manual: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: HUB.cardRadius },
  tile: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
});
