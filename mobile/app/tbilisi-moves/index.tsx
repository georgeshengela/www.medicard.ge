import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Award,
  ChevronRight,
  Footprints,
  History,
  MapPin,
  RefreshCw,
  Trophy,
  Users,
} from 'lucide-react-native';
import { EmptyState } from '@/components/EmptyState';
import {
  TbilisiMovesActionChip,
  TbilisiMovesDistrictRow,
  TbilisiMovesPersonRow,
  TbilisiMovesStatTile,
} from '@/components/tbilisiMoves/TbilisiMovesBoard';
import { TbilisiMovesChrome, TbilisiMovesIconWell } from '@/components/tbilisiMoves/TbilisiMovesChrome';
import {
  TbilisiMovesBoardEmpty,
  TbilisiMovesBoardHeading,
  TbilisiMovesDistrictPodium,
  TbilisiMovesPeoplePodium,
  TbilisiMovesYourPlaceDock,
} from '@/components/tbilisiMoves/TbilisiMovesLeaderboard';
import { GEO } from '@/components/tbilisiMoves/copyStyles';
import { TbilisiMovesScoreRing } from '@/components/tbilisiMoves/TbilisiMovesScoreRing';
import { takeRankPodium } from '@/components/tbilisiMoves/tbilisiMovesRank';
import { Button } from '@/components/ui/Button';
import { ka } from '@/i18n/ka';
import { ApiError, api } from '@/lib/api';
import { formatRelative } from '@/lib/format';
import { formatKaInt } from '@/lib/tbilisiMoves/format';
import { subscribeTbilisiMovesLive } from '@/lib/tbilisiMoves/live';
import { loadCache, loadLastSyncOk, saveCache } from '@/lib/tbilisiMoves/storage';
import {
  getCompetitionSyncState,
  runCompetitionSync,
  subscribeCompetitionSync,
} from '@/lib/tbilisiMoves/sync';
import type {
  TbilisiMovesDistrictBoard,
  TbilisiMovesMe,
  TbilisiMovesPeopleBoard,
  TbilisiMovesStatus,
} from '@/lib/tbilisiMoves/types';
import { useOffline } from '@/hooks/useOffline';
import { useAuth } from '@/store/AuthContext';
import { useThemeColors } from '@/theme/colors';

type BoardTab = 'districts' | 'people';
type HubCache = {
  me: TbilisiMovesMe;
  districts: TbilisiMovesDistrictBoard;
  people: TbilisiMovesPeopleBoard | null;
};

export default function TbilisiMovesHubScreen() {
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const offline = useOffline();
  const [ready, setReady] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [status, setStatus] = useState<TbilisiMovesStatus | null>(null);
  const [me, setMe] = useState<TbilisiMovesMe | null>(null);
  const [districtBoard, setDistrictBoard] = useState<TbilisiMovesDistrictBoard | null>(null);
  const [people, setPeople] = useState<TbilisiMovesPeopleBoard | null>(null);
  const [peopleOffset, setPeopleOffset] = useState(0);
  const [tab, setTab] = useState<BoardTab>('districts');
  const [error, setError] = useState<string | null>(null);
  const [cached, setCached] = useState(false);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [, setSyncTick] = useState(0);

  React.useEffect(() => subscribeCompetitionSync(() => setSyncTick((n) => n + 1)), []);

  const load = useCallback(
    async (opts?: { refresh?: boolean }) => {
      setError(null);
      try {
        let nextStatus = await api.tbilisiMoves.status();
        if (!nextStatus.schemaReady || !nextStatus.featureEnabled) {
          await new Promise((resolve) => setTimeout(resolve, 700));
          nextStatus = await api.tbilisiMoves.status();
        }
        setStatus(nextStatus);
        if (!nextStatus.schemaReady || !nextStatus.featureEnabled) {
          setMe(null);
          setReady(true);
          return;
        }
        const nextMe = await api.tbilisiMoves.me();
        setMe(nextMe);
        const date = nextMe.date;
        const districtId = nextMe.membership.districtId || nextMe.overview.you?.districtId;
        const [board, peopleBoard] = await Promise.all([
          api.tbilisiMoves.districts(date),
          districtId ? api.tbilisiMoves.people(date, districtId, { limit: 50, offset: 0 }) : Promise.resolve(null),
        ]);
        setDistrictBoard(board);
        setPeople(peopleBoard);
        setPeopleOffset(0);
        await saveCache({ me: nextMe, districts: board, people: peopleBoard } satisfies HubCache);
        setCached(false);
        if (user?.id && nextMe.membership.enrolled && opts?.refresh) {
          try {
            await runCompetitionSync({ userId: user.id, reason: 'refresh', force: true });
            const after = await api.tbilisiMoves.me();
            setMe(after);
            const afterBoard = await api.tbilisiMoves.districts(after.date);
            setDistrictBoard(afterBoard);
            if (after.membership.districtId) {
              setPeople(await api.tbilisiMoves.people(after.date, after.membership.districtId, { limit: 50, offset: 0 }));
            }
          } catch {
            // Health Connect / a cancelled follow-up GET is not offline. Keep the live board.
          }
        }
      } catch (caught) {
        const stored = await loadCache<HubCache>();
        if (stored) {
          setMe(stored.me);
          setDistrictBoard(stored.districts);
          setPeople(stored.people);
          setCached(true);
        }
        if (caught instanceof ApiError && (caught.status === 404 || caught.status === 503) && !stored) {
          setError(caught.status === 503 ? ka.tbilisiMoves.schemaUnavailable : ka.tbilisiMoves.featureOff);
        } else {
          setError(stored ? ka.common.offlineCached : ka.tbilisiMoves.loadError);
        }
      } finally {
        setLastSync(await loadLastSyncOk());
        setReady(true);
      }
    },
    [user?.id],
  );

  React.useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const off = subscribeTbilisiMovesLive(() => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        void load();
      }, 250);
    });
    return () => {
      if (timer) clearTimeout(timer);
      off();
    };
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      void (async () => {
        if (user?.id) {
          await runCompetitionSync({ userId: user.id, reason: 'focus', force: true });
        }
        if (!cancelled) await load();
      })();
      return () => {
        cancelled = true;
      };
    }, [load, user?.id]),
  );

  const loadMorePeople = useCallback(async () => {
    if (!me?.membership.districtId || !people) return;
    if (people.people.length >= people.total) return;
    const nextOffset = peopleOffset + 50;
    const page = await api.tbilisiMoves.people(me.date, me.membership.districtId, { limit: 50, offset: nextOffset });
    setPeople({
      ...page,
      people: [...people.people, ...page.people],
    });
    setPeopleOffset(nextOffset);
  }, [me, people, peopleOffset]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      if (user?.id) {
        await runCompetitionSync({ userId: user.id, reason: 'refresh', force: true });
      }
      await load();
    } finally {
      setRefreshing(false);
    }
  }, [load, user?.id]);

  const available = Boolean(status?.schemaReady && status.featureEnabled);
  const enrolled = Boolean(me?.membership.enrolled);
  const district = me?.overview.yourDistrict;
  const you = me?.overview.you;
  const target = district?.target || me?.config.defaultDailyTarget || 0;
  const sync = getCompetitionSyncState();
  const localSteps = Math.max(sync.credited || 0, sync.lastReading?.steps || 0);
  const serverPersonal = you?.eligibleSteps || 0;
  const cap = you?.capSnapshot || me?.config.competitiveCap || 0;
  const personal = Math.max(serverPersonal, localSteps);
  const credited = Math.max(0, (district?.eligibleSteps || 0) - serverPersonal + personal);
  const updatedAt = lastSync || sync.lastOkAt || null;

  const tiedLeaders = useMemo(() => {
    const rows = people?.people || [];
    const firstRank = rows[0]?.rank;
    if (firstRank !== 1) return [];
    return rows.filter((row) => row.rank === 1);
  }, [people]);
  const districtPodium = useMemo(
    () => takeRankPodium(districtBoard?.districts || []),
    [districtBoard],
  );
  const peoplePodium = useMemo(() => takeRankPodium(people?.people || []), [people]);

  const chrome = (
    <TbilisiMovesChrome
      title={ka.tbilisiMoves.title}
      right={
        enrolled ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={ka.tbilisiMoves.refresh}
            hitSlop={12}
            onPress={() => void onRefresh()}
            style={{
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
            <RefreshCw size={18} color={colors.primary200} strokeWidth={2.2} />
          </Pressable>
        ) : undefined
      }
    />
  );

  if (!ready) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg100 }}>
        {chrome}
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={colors.primary200} />
        </View>
      </View>
    );
  }

  if (!available) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg100 }}>
        {chrome}
        <ScrollView contentContainerStyle={{ padding: 16 }}>
          <EmptyState icon={Footprints} title={ka.tbilisiMoves.unavailableTitle} body={error || ka.tbilisiMoves.unavailableBody} />
          <Button label={ka.tbilisiMoves.refresh} onPress={() => void load({ refresh: true })} />
        </ScrollView>
      </View>
    );
  }

  if (!enrolled) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg100 }}>
        {chrome}
        <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
          <EmptyState icon={Footprints} title={ka.tbilisiMoves.notEnrolledTitle} body={ka.tbilisiMoves.notEnrolledBody}>
            <Button label={ka.tbilisiMoves.enroll} onPress={() => router.push('/tbilisi-moves/enroll')} />
          </EmptyState>
        </ScrollView>
      </View>
    );
  }

  const overview = (
    <View style={{ gap: 14, paddingBottom: 8 }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        <View
          style={{
            paddingHorizontal: 10,
            paddingVertical: 5,
            borderRadius: 999,
            backgroundColor: colors.accent100,
            borderWidth: 1,
            borderColor: colors.bg300,
          }}
        >
          <Text style={{ fontFamily: GEO.semibold, fontSize: 12, color: colors.primary200 }}>{ka.tbilisiMoves.pilotShort}</Text>
        </View>
        {(offline || cached) && (
          <View
            style={{
              paddingHorizontal: 10,
              paddingVertical: 5,
              borderRadius: 999,
              backgroundColor: colors.warningBg,
            }}
          >
            <Text style={{ fontFamily: GEO.semibold, fontSize: 12, color: colors.warning }}>{ka.tbilisiMoves.offline}</Text>
          </View>
        )}
      </View>

      <Text style={{ fontSize: 13, lineHeight: 20, color: colors.text300, fontFamily: GEO.regular }}>{ka.tbilisiMoves.pilot}</Text>
      {status?.visualQaFixture ? (
        <View style={{ padding: 12, borderRadius: 16, backgroundColor: colors.warningBg, borderWidth: 1, borderColor: colors.warning }}>
          <Text style={{ fontSize: 13, lineHeight: 20, color: colors.text100, fontFamily: GEO.semibold }}>
            {ka.tbilisiMoves.visualQaBanner}
          </Text>
        </View>
      ) : null}

      <Pressable
        accessibilityRole="button"
        onPress={() => router.push('/tbilisi-moves/membership')}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          padding: 14,
          borderRadius: 18,
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: colors.bg300,
        }}
      >
        <TbilisiMovesIconWell>
          <MapPin size={18} color={colors.primary200} strokeWidth={2.2} />
        </TbilisiMovesIconWell>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={{ fontSize: 12, color: colors.text300, fontFamily: GEO.regular }}>{ka.tbilisiMoves.currentDistrict}</Text>
          <Text style={{ marginTop: 2, fontFamily: GEO.title, fontSize: 18, color: colors.text100 }} numberOfLines={1}>
            {me?.membership.district?.nameKa || district?.nameKa}
          </Text>
          {me?.membership.pendingDistrict ? (
            <Text style={{ marginTop: 4, color: colors.primary200, fontFamily: GEO.regular, fontSize: 13 }}>
              {ka.tbilisiMoves.pendingChange}
            </Text>
          ) : null}
        </View>
        <ChevronRight size={18} color={colors.text300} strokeWidth={2.2} />
      </Pressable>

      <TbilisiMovesScoreRing value={personal} max={cap || 10000} caption={ka.tbilisiMoves.cap} />
      <Text style={{ textAlign: 'center', fontSize: 15, color: colors.text200, fontFamily: GEO.semibold }}>
        {formatKaInt(Math.min(personal, cap || personal))} / {formatKaInt(cap || 0)}
      </Text>
      <Text style={{ textAlign: 'center', fontSize: 13, color: colors.text300, fontFamily: GEO.regular }}>
        {ka.tbilisiMoves.target} · {formatKaInt(credited)} {ka.tbilisiMoves.ofTarget} {formatKaInt(target)}
      </Text>
      <Text style={{ textAlign: 'center', fontSize: 12, color: colors.text300, fontFamily: GEO.regular }}>
        {ka.tbilisiMoves.updatedLine(updatedAt ? formatRelative(updatedAt) : ka.tbilisiMoves.neverSynced)}
      </Text>

      <View style={{ flexDirection: 'row', gap: 10 }}>
        <TbilisiMovesStatTile
          icon={Users}
          label={ka.tbilisiMoves.participants}
          value={formatKaInt(district?.participantCount || 0)}
        />
        <TbilisiMovesStatTile
          icon={Trophy}
          label={ka.tbilisiMoves.districtRank}
          value={district?.unranked || !district?.rank ? ka.tbilisiMoves.unranked : String(district.rank)}
        />
      </View>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <TbilisiMovesStatTile
          icon={Footprints}
          label={ka.tbilisiMoves.yourContribution}
          value={
            personal > 0
              ? `${formatKaInt(Math.min(personal, cap || personal))} / ${formatKaInt(cap)}`
              : ka.tbilisiMoves.neverSynced
          }
        />
        <TbilisiMovesStatTile icon={Award} label={ka.tbilisiMoves.cap} value={formatKaInt(cap)} />
      </View>
      {district?.unranked ? (
        <Text style={{ fontSize: 13, color: colors.text300, fontFamily: GEO.regular }}>
          {ka.tbilisiMoves.unrankedWhy(me?.overview.round.rules.minParticipantsForRank || 5)}
        </Text>
      ) : null}
      {cap > 0 && personal >= cap ? (
        <Text style={{ fontSize: 13, color: colors.warning, fontFamily: GEO.regular }}>{ka.tbilisiMoves.capReached}</Text>
      ) : null}
      <Text style={{ fontFamily: GEO.semibold, fontSize: 13, color: colors.primary200 }}>{ka.tbilisiMoves.provisional}</Text>

      <View style={{ flexDirection: 'row', gap: 10 }}>
        <TbilisiMovesActionChip
          icon={History}
          label={ka.tbilisiMoves.history}
          onPress={() => router.push('/tbilisi-moves/history')}
        />
        <TbilisiMovesActionChip
          icon={Award}
          label={ka.tbilisiMoves.myAwards}
          onPress={() => router.push('/tbilisi-moves/awards')}
        />
      </View>

      <TbilisiMovesBoardHeading tab={tab} onTab={setTab} />
    </View>
  );

  const yourPlaceOffPage = people?.you && !people.you.onPage && people.you.rank != null;

  if (tab === 'people') {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg100 }}>
        {chrome}
        <FlatList
          data={peoplePodium.rest}
          keyExtractor={(item, index) => `${item.publicHandle}-${item.eligibleSteps}-${index}`}
          contentContainerStyle={{ padding: 16, paddingBottom: yourPlaceOffPage ? 128 + insets.bottom : 40 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} tintColor={colors.primary200} />}
          onEndReached={() => void loadMorePeople()}
          onEndReachedThreshold={0.4}
          ListHeaderComponent={
            <View style={{ gap: 10, marginBottom: 8 }}>
              {overview}
              {peoplePodium.hasPodium ? (
                <TbilisiMovesPeoplePodium
                  first={peoplePodium.first}
                  second={peoplePodium.second}
                  third={peoplePodium.third}
                  myHandle={me?.membership.publicHandle}
                />
              ) : null}
              {tiedLeaders.length > 1 ? (
                <Text style={{ fontFamily: GEO.regular, fontSize: 13, color: colors.text300, textAlign: 'center' }}>
                  {ka.tbilisiMoves.tiedLeaders}
                </Text>
              ) : null}
              {!people?.people.length ? <TbilisiMovesBoardEmpty /> : null}
            </View>
          }
          renderItem={({ item }) => (
            <TbilisiMovesPersonRow row={item} highlight={item.publicHandle === me?.membership.publicHandle} />
          )}
        />
        {yourPlaceOffPage && people.you ? (
          <View
            style={{
              position: 'absolute',
              left: 16,
              right: 16,
              bottom: Math.max(insets.bottom, 16) + 8,
            }}
          >
            <TbilisiMovesYourPlaceDock row={people.you} />
          </View>
        ) : people?.you && people.you.unranked ? (
          <View style={{ position: 'absolute', left: 16, right: 16, bottom: Math.max(insets.bottom, 16) + 8 }}>
            <TbilisiMovesYourPlaceDock unranked />
          </View>
        ) : null}
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg100 }}>
      {chrome}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 16, paddingBottom: 40, gap: 10 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} tintColor={colors.primary200} />}
      >
        {overview}
        {districtPodium.hasPodium ? (
          <TbilisiMovesDistrictPodium
            first={districtPodium.first}
            second={districtPodium.second}
            third={districtPodium.third}
            mineId={me?.membership.districtId}
          />
        ) : null}
        {districtPodium.rest.map((row) => (
          <TbilisiMovesDistrictRow key={row.id} row={row} mine={row.id === me?.membership.districtId} />
        ))}
        {!districtBoard?.districts.length ? <TbilisiMovesBoardEmpty /> : null}
      </ScrollView>
    </View>
  );
}
