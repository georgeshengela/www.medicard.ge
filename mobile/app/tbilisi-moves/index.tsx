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
import { Footprints } from 'lucide-react-native';
import { EmptyState } from '@/components/EmptyState';
import { CompetitionAvatar } from '@/components/tbilisiMoves/CompetitionAvatar';
import { GEO } from '@/components/tbilisiMoves/copyStyles';
import { TbilisiProgressBar } from '@/components/tbilisiMoves/TbilisiProgressBar';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ka } from '@/i18n/ka';
import { ApiError, api } from '@/lib/api';
import { formatDateTime } from '@/lib/format';
import { formatGoalPct, formatKaInt } from '@/lib/tbilisiMoves/format';
import { loadCache, loadLastSyncOk, saveCache } from '@/lib/tbilisiMoves/storage';
import {
  getCompetitionSyncState,
  runCompetitionSync,
  subscribeCompetitionSync,
} from '@/lib/tbilisiMoves/sync';
import type {
  TbilisiMovesDistrict,
  TbilisiMovesDistrictBoard,
  TbilisiMovesMe,
  TbilisiMovesPeopleBoard,
  TbilisiMovesPerson,
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

function SyncBanner({ colors }: { colors: ReturnType<typeof useThemeColors> }) {
  const sync = getCompetitionSyncState();
  const copy =
    sync.phase === 'conflict'
      ? ka.tbilisiMoves.conflict
      : sync.phase === 'unsupported'
        ? ka.tbilisiMoves.unsupported
        : sync.phase === 'permission'
          ? ka.tbilisiMoves.permission
          : sync.phase === 'empty'
            ? ka.tbilisiMoves.noSensor
            : sync.phase === 'manual_only'
              ? ka.tbilisiMoves.manualOnly
              : sync.phase === 'paused'
                ? ka.tbilisiMoves.paused
                : sync.phase === 'pending'
                  ? ka.tbilisiMoves.syncPending
                  : sync.phase === 'offline'
                    ? ka.tbilisiMoves.offline
                    : sync.phase === 'unavailable'
                      ? ka.tbilisiMoves.unavailableTitle
                      : null;
  if (!copy) return null;
  return (
    <View style={{ padding: 12, borderRadius: 16, backgroundColor: colors.surfaceRaised, borderWidth: 1, borderColor: colors.bg300 }}>
      <Text style={{ fontSize: 13, color: colors.text300, fontFamily: 'NotoSansGeorgian_400Regular' }}>{copy}</Text>
    </View>
  );
}

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
        const nextStatus = await api.tbilisiMoves.status();
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
          await runCompetitionSync({ userId: user.id, reason: 'refresh', force: true });
          const after = await api.tbilisiMoves.me();
          setMe(after);
          const afterBoard = await api.tbilisiMoves.districts(after.date);
          setDistrictBoard(afterBoard);
          if (after.membership.districtId) {
            setPeople(await api.tbilisiMoves.people(after.date, after.membership.districtId, { limit: 50, offset: 0 }));
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
        if (caught instanceof ApiError && (caught.status === 404 || caught.status === 503)) {
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

  useFocusEffect(
    useCallback(() => {
      void load();
      if (user?.id) void runCompetitionSync({ userId: user.id, reason: 'focus' });
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
    await load({ refresh: true });
    setRefreshing(false);
  }, [load]);

  const available = Boolean(status?.schemaReady && status.featureEnabled);
  const enrolled = Boolean(me?.membership.enrolled);
  const district = me?.overview.yourDistrict;
  const you = me?.overview.you;
  const target = district?.target || me?.config.defaultDailyTarget || 0;
  const credited = district?.eligibleSteps || 0;
  const ratio = target > 0 ? credited / target : 0;
  const cap = you?.capSnapshot || me?.config.competitiveCap || 0;
  const personal = you?.eligibleSteps || 0;
  const sync = getCompetitionSyncState();

  const tiedLeaders = useMemo(() => {
    const rows = people?.people || [];
    const firstRank = rows[0]?.rank;
    if (firstRank !== 1) return [];
    return rows.filter((row) => row.rank === 1);
  }, [people]);

  if (!ready) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg100, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={colors.primary200} />
      </View>
    );
  }

  if (!available) {
    return (
      <ScrollView style={{ flex: 1, backgroundColor: colors.bg100 }} contentContainerStyle={{ padding: 16 }}>
        <EmptyState
          icon={Footprints}
          title={ka.tbilisiMoves.unavailableTitle}
          body={error || ka.tbilisiMoves.unavailableBody}
        />
      </ScrollView>
    );
  }

  if (!enrolled) {
    return (
      <ScrollView style={{ flex: 1, backgroundColor: colors.bg100 }} contentContainerStyle={{ padding: 16, gap: 12 }}>
        <EmptyState icon={Footprints} title={ka.tbilisiMoves.notEnrolledTitle} body={ka.tbilisiMoves.notEnrolledBody}>
          <Button label={ka.tbilisiMoves.enroll} onPress={() => router.push('/tbilisi-moves/enroll')} />
        </EmptyState>
      </ScrollView>
    );
  }

  const overview = (
    <View style={{ gap: 12, paddingBottom: 12 }}>
      <Text style={{ fontSize: 13, lineHeight: 20, color: colors.text300, fontFamily: 'NotoSansGeorgian_400Regular' }}>{ka.tbilisiMoves.pilot}</Text>
      {(offline || cached) && (
        <Text style={{ fontSize: 13, color: colors.warning, fontFamily: 'NotoSansGeorgian_400Regular' }}>{ka.tbilisiMoves.offline}</Text>
      )}
      <SyncBanner colors={colors} />
      {status?.visualQaFixture ? (
        <View style={{ padding: 12, borderRadius: 16, backgroundColor: colors.warningBg, borderWidth: 1, borderColor: colors.warning }}>
          <Text style={{ fontSize: 13, lineHeight: 20, color: colors.text100, fontFamily: GEO.semibold }}>
            {ka.tbilisiMoves.visualQaBanner}
          </Text>
        </View>
      ) : null}

      <Card>
        <Pressable onPress={() => router.push('/tbilisi-moves/membership')}>
          <Text style={{ fontSize: 13, color: colors.text300, fontFamily: 'NotoSansGeorgian_400Regular' }}>{ka.tbilisiMoves.currentDistrict}</Text>
          <Text style={{ marginTop: 4, fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 22, color: colors.text100 }}>
            {me?.membership.district?.nameKa || district?.nameKa}
          </Text>
          {me?.membership.pendingDistrict ? (
            <Text style={{ marginTop: 6, color: colors.primary200, fontFamily: 'NotoSansGeorgian_400Regular' }}>{ka.tbilisiMoves.pendingChange}</Text>
          ) : null}
        </Pressable>
      </Card>

      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Pressable
          onPress={() => router.push('/tbilisi-moves/history')}
          style={{
            flex: 1,
            padding: 14,
            borderRadius: 16,
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.bg300,
          }}
        >
          <Text style={{ fontFamily: 'NotoSansGeorgian_700Bold', color: colors.text100 }}>{ka.tbilisiMoves.history}</Text>
        </Pressable>
        <Pressable
          onPress={() => router.push('/tbilisi-moves/awards')}
          style={{
            flex: 1,
            padding: 14,
            borderRadius: 16,
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.bg300,
          }}
        >
          <Text style={{ fontFamily: 'NotoSansGeorgian_700Bold', color: colors.text100 }}>{ka.tbilisiMoves.myAwards}</Text>
        </Pressable>
      </View>

      <Card>
        <Text style={{ fontSize: 13, color: colors.text300, fontFamily: 'NotoSansGeorgian_400Regular' }}>{ka.tbilisiMoves.credited}</Text>
        <Text style={{ marginTop: 4, fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 36, color: colors.text100 }}>
          {formatKaInt(credited)}
        </Text>
        <Text style={{ marginTop: 2, fontSize: 14, color: colors.text200, fontFamily: 'NotoSansGeorgian_400Regular' }}>
          {ka.tbilisiMoves.ofTarget} {formatKaInt(target)}
        </Text>
        <View style={{ marginTop: 12 }}>
          <TbilisiProgressBar ratio={ratio} label={ka.tbilisiMoves.percent(formatGoalPct(ratio))} />
        </View>
        <View style={{ marginTop: 14, flexDirection: 'row', justifyContent: 'space-between' }}>
          <Text style={{ color: colors.text200, fontFamily: 'NotoSansGeorgian_400Regular' }}>
            {ka.tbilisiMoves.participants}: {formatKaInt(district?.participantCount || 0)}
          </Text>
          <Text style={{ color: colors.text200, fontFamily: 'NotoSansGeorgian_400Regular' }}>
            {ka.tbilisiMoves.districtRank}:{' '}
            {district?.unranked || !district?.rank ? ka.tbilisiMoves.unranked : district.rank}
          </Text>
        </View>
        {district?.unranked ? (
          <Text style={{ marginTop: 8, fontSize: 13, color: colors.text300, fontFamily: 'NotoSansGeorgian_400Regular' }}>
            {ka.tbilisiMoves.unrankedWhy(me?.overview.round.rules.minParticipantsForRank || 5)}
          </Text>
        ) : null}
        <Text style={{ marginTop: 12, fontSize: 14, color: colors.text200, fontFamily: 'NotoSansGeorgian_400Regular' }}>
          {ka.tbilisiMoves.yourContribution}: {formatKaInt(personal)} / {formatKaInt(cap)}
        </Text>
        {cap > 0 && personal >= cap ? (
          <Text style={{ marginTop: 6, fontSize: 13, color: colors.warning, fontFamily: 'NotoSansGeorgian_400Regular' }}>{ka.tbilisiMoves.capReached}</Text>
        ) : null}
        <Text style={{ marginTop: 10, fontSize: 12, color: colors.text300, fontFamily: 'NotoSansGeorgian_400Regular' }}>
          {ka.tbilisiMoves.lastSync}: {lastSync || sync.lastOkAt ? formatDateTime(lastSync || sync.lastOkAt || '') : ka.tbilisiMoves.neverSynced}
        </Text>
        <Text style={{ marginTop: 6, fontFamily: 'NotoSansGeorgian_600SemiBold', color: colors.primary200 }}>
          {ka.tbilisiMoves.provisional}
        </Text>
      </Card>

      <View style={{ flexDirection: 'row', backgroundColor: colors.surface, borderRadius: 16, padding: 4, borderWidth: 1, borderColor: colors.bg300 }}>
        {(['districts', 'people'] as const).map((id) => (
          <Pressable
            key={id}
            onPress={() => setTab(id)}
            style={{
              flex: 1,
              paddingVertical: 10,
              borderRadius: 12,
              backgroundColor: tab === id ? colors.accent100 : 'transparent',
              alignItems: 'center',
            }}
          >
            <Text style={{ fontFamily: 'NotoSansGeorgian_700Bold', color: tab === id ? colors.primary200 : colors.text300 }}>
              {id === 'districts' ? ka.tbilisiMoves.tabDistricts : ka.tbilisiMoves.tabPeople}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );

  const yourPlaceOffPage = people?.you && !people.you.onPage && people.you.rank != null;

  if (tab === 'people') {
    const headerLeaders = tiedLeaders.length > 3;
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg100 }}>
        <FlatList
          data={people?.people || []}
          keyExtractor={(item, index) => `${item.publicHandle}-${item.eligibleSteps}-${index}`}
          contentContainerStyle={{ padding: 16, paddingBottom: yourPlaceOffPage ? 120 + insets.bottom : 40 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} />}
          onEndReached={() => void loadMorePeople()}
          onEndReachedThreshold={0.4}
          ListHeaderComponent={
            <View>
              {overview}
              {headerLeaders ? (
                <Card>
                  <Text style={{ fontFamily: 'NotoSansGeorgian_700Bold', color: colors.text100 }}>
                    {ka.tbilisiMoves.tiedLeaders}
                  </Text>
                  {tiedLeaders.slice(0, 8).map((row, index) => (
                    <PersonLine key={`${row.publicHandle}-lead-${index}`} row={row} colors={colors} />
                  ))}
                </Card>
              ) : null}
              {!people?.people.length ? (
                <Text style={{ marginTop: 12, color: colors.text300, fontFamily: 'NotoSansGeorgian_400Regular' }}>{ka.tbilisiMoves.emptyBoard}</Text>
              ) : null}
            </View>
          }
          renderItem={({ item }) => <PersonLine row={item} colors={colors} highlight={item.publicHandle === me?.membership.publicHandle} />}
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
            <Card>
              <Text style={{ fontSize: 12, color: colors.text300, fontFamily: 'NotoSansGeorgian_400Regular' }}>{ka.tbilisiMoves.yourPlace}</Text>
              <PersonLine row={people.you} colors={colors} highlight />
            </Card>
          </View>
        ) : people?.you && people.you.unranked ? (
          <View style={{ position: 'absolute', left: 16, right: 16, bottom: Math.max(insets.bottom, 16) + 8 }}>
            <Card>
              <Text style={{ color: colors.text200, fontFamily: 'NotoSansGeorgian_400Regular' }}>{ka.tbilisiMoves.noRank}</Text>
            </Card>
          </View>
        ) : null}
      </View>
    );
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg100 }}
      contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} />}
    >
      {overview}
      {(districtBoard?.districts || []).map((row) => (
        <DistrictRow
          key={row.id}
          row={row}
          mine={row.id === me?.membership.districtId}
          colors={colors}
        />
      ))}
    </ScrollView>
  );
}

function PersonLine({
  row,
  colors,
  highlight,
}: {
  row: TbilisiMovesPerson;
  colors: ReturnType<typeof useThemeColors>;
  highlight?: boolean;
}) {
  const medal = row.rank === 1 || row.rank === 2 || row.rank === 3;
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        minHeight: 48,
        paddingVertical: 10,
        backgroundColor: highlight ? colors.accent100 : 'transparent',
        borderRadius: 12,
        paddingHorizontal: highlight || medal ? 8 : 0,
        borderLeftWidth: medal && !highlight ? 3 : 0,
        borderLeftColor: medal ? colors.primary200 : 'transparent',
      }}
    >
      <Text style={{ width: 28, fontFamily: GEO.title, color: medal ? colors.primary200 : colors.text100 }}>
        {row.rank == null || row.rank < 1 ? '—' : row.rank}
      </Text>
      <CompetitionAvatar avatarId={row.publicAvatarId} handle={row.publicHandle} size={40} />
      <Text style={{ flex: 1, fontFamily: GEO.semibold, color: colors.text100 }} numberOfLines={2}>
        {row.publicHandle}
      </Text>
      <Text style={{ fontFamily: GEO.regular, color: colors.text200 }}>{formatKaInt(row.eligibleSteps)}</Text>
    </View>
  );
}

function DistrictRow({
  row,
  mine,
  colors,
}: {
  row: TbilisiMovesDistrict;
  mine: boolean;
  colors: ReturnType<typeof useThemeColors>;
}) {
  const ratio = Number(row.goalRatio) || 0;
  return (
    <View
      style={{
        marginBottom: 10,
        borderRadius: 18,
        borderWidth: mine ? 2 : 1,
        borderColor: mine ? colors.primary200 : colors.bg300,
        backgroundColor: colors.surface,
        padding: 14,
      }}
    >
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text style={{ fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 16, color: colors.text100, flex: 1 }} numberOfLines={2}>
          {row.unranked || !row.rank ? '—' : row.rank}. {row.nameKa}
        </Text>
        {mine ? (
          <Text style={{ color: colors.primary200, fontFamily: 'NotoSansGeorgian_700Bold' }}>{ka.tbilisiMoves.you}</Text>
        ) : null}
      </View>
      <View style={{ marginTop: 10 }}>
        <TbilisiProgressBar ratio={ratio} label={ka.tbilisiMoves.percent(formatGoalPct(ratio))} />
      </View>
      <Text style={{ marginTop: 8, fontFamily: GEO.regular, fontSize: 13, color: colors.text200 }}>
        {formatKaInt(row.eligibleSteps || 0)} / {formatKaInt(row.target)} · {formatKaInt(row.participantCount || 0)}{' '}
        {ka.tbilisiMoves.participants}
      </Text>
    </View>
  );
}
