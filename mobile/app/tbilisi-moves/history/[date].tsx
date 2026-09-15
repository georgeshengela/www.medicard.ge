import React, { useCallback, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useFocusEffect } from 'expo-router';
import { TbilisiMovesDistrictRow, TbilisiMovesPersonRow } from '@/components/tbilisiMoves/TbilisiMovesBoard';
import { TbilisiMovesChrome } from '@/components/tbilisiMoves/TbilisiMovesChrome';
import { TbilisiMovesDistrictPodium, TbilisiMovesPeoplePodium } from '@/components/tbilisiMoves/TbilisiMovesLeaderboard';
import { takeRankPodium } from '@/components/tbilisiMoves/tbilisiMovesRank';
import { Card } from '@/components/ui/Card';
import { GEO } from '@/components/tbilisiMoves/copyStyles';
import { ka } from '@/i18n/ka';
import { api } from '@/lib/api';
import { formatKaInt, formatYmdKa } from '@/lib/tbilisiMoves/format';
import type { TbilisiMovesDayResults } from '@/lib/tbilisiMoves/types';
import { useThemeColors } from '@/theme/colors';

export default function TbilisiMovesDayScreen() {
  const colors = useThemeColors();
  const { date } = useLocalSearchParams<{ date: string }>();
  const [data, setData] = useState<TbilisiMovesDayResults | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  const load = useCallback(async () => {
    if (!date) return;
    setError(null);
    try {
      const next = await api.tbilisiMoves.results(date);
      setData(next);
    } catch {
      setData(null);
      setError(ka.tbilisiMoves.resultUnavailable);
    } finally {
      setReady(true);
    }
  }, [date]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  if (!ready) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg100 }}>
        <TbilisiMovesChrome title={ka.tbilisiMoves.history} />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={colors.primary200} />
        </View>
      </View>
    );
  }

  const lifecycle = data?.lifecycle;
  const statusCopy =
    lifecycle === 'FINALIZED'
      ? data?.corrected
        ? ka.tbilisiMoves.resultCorrected
        : ka.tbilisiMoves.resultFinal
      : lifecycle === 'GRACE'
        ? ka.tbilisiMoves.resultGrace
        : lifecycle === 'READY'
          ? ka.tbilisiMoves.resultAwaiting
          : lifecycle === 'OPEN'
            ? ka.tbilisiMoves.provisional
            : error || ka.tbilisiMoves.resultUnavailable;

  const districtPodium = takeRankPodium(data?.districts || []);
  const peoplePodium = takeRankPodium(data?.people?.people || []);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg100 }}>
      <TbilisiMovesChrome title={date ? formatYmdKa(date) : ka.tbilisiMoves.history} />
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 40, gap: 12 }}>
      <Text style={{ color: colors.text200, fontFamily: GEO.regular }}>{statusCopy}</Text>
      {data?.source === 'live' ? (
        <Text style={{ color: colors.text300, fontFamily: GEO.regular }}>{ka.tbilisiMoves.todayProvisionalHint}</Text>
      ) : null}

      {!data ? null : !data.districts?.length ? (
        <Text style={{ color: colors.text300 }}>{ka.tbilisiMoves.resultEmpty}</Text>
      ) : (
        <>
          {districtPodium.hasPodium ? (
            <TbilisiMovesDistrictPodium
              first={districtPodium.first}
              second={districtPodium.second}
              third={districtPodium.third}
            />
          ) : null}
          {districtPodium.rest.map((row) => (
            <TbilisiMovesDistrictRow key={row.id} row={row} />
          ))}
        </>
      )}

      {data?.you ? (
        <Card>
          <Text style={{ color: colors.text300, fontFamily: GEO.regular }}>{ka.tbilisiMoves.yourPlace}</Text>
          <Text style={{ marginTop: 4, fontFamily: GEO.title, fontSize: 28, color: colors.text100 }}>
            {data.you.rank == null ? '—' : data.you.rank}
          </Text>
          <Text style={{ marginTop: 4, color: colors.text200, fontFamily: GEO.regular }}>
            {ka.tbilisiMoves.yourContribution}: {formatKaInt(data.you.eligibleSteps)}
          </Text>
        </Card>
      ) : null}

      {peoplePodium.hasPodium ? (
        <TbilisiMovesPeoplePodium
          first={peoplePodium.first}
          second={peoplePodium.second}
          third={peoplePodium.third}
        />
      ) : null}
      {peoplePodium.rest.slice(0, 20).map((row, index) => (
        <TbilisiMovesPersonRow key={`${row.publicHandle}-${index}`} row={row} />
      ))}

      {(data?.awards || []).map((award) => (
        <Card key={award.id}>
            <Text style={{ fontFamily: GEO.title, color: colors.text100 }}>{award.titleKa}</Text>
            <Text style={{ marginTop: 4, color: colors.text200, fontFamily: GEO.regular }}>{award.reasonKa}</Text>
            <Text style={{ marginTop: 6, fontFamily: GEO.semibold, color: award.status === 'REVOKED' ? colors.warning : colors.primary200 }}>
            {award.status === 'REVOKED' ? ka.tbilisiMoves.awardRevoked : ka.tbilisiMoves.awardActive}
          </Text>
        </Card>
      ))}
    </ScrollView>
    </View>
  );
}
