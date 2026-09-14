import React, { useCallback, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useFocusEffect } from 'expo-router';
import { CompetitionAvatar } from '@/components/tbilisiMoves/CompetitionAvatar';
import { TbilisiProgressBar } from '@/components/tbilisiMoves/TbilisiProgressBar';
import { Card } from '@/components/ui/Card';
import { GEO } from '@/components/tbilisiMoves/copyStyles';
import { ka } from '@/i18n/ka';
import { api } from '@/lib/api';
import { formatGoalPct, formatKaInt, formatYmdKa } from '@/lib/tbilisiMoves/format';
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
      <View style={{ flex: 1, backgroundColor: colors.bg100, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={colors.primary200} />
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

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg100 }} contentContainerStyle={{ padding: 16, paddingBottom: 40, gap: 12 }}>
      <Text style={{ fontFamily: GEO.title, fontSize: 22, color: colors.text100 }}>{date ? formatYmdKa(date) : date}</Text>
      <Text style={{ color: colors.text200, fontFamily: GEO.regular }}>{statusCopy}</Text>
      {data?.source === 'live' ? (
        <Text style={{ color: colors.text300, fontFamily: GEO.regular }}>{ka.tbilisiMoves.todayProvisionalHint}</Text>
      ) : null}

      {!data ? null : !data.districts?.length ? (
        <Text style={{ color: colors.text300 }}>{ka.tbilisiMoves.resultEmpty}</Text>
      ) : (
        data.districts.map((row) => {
          const ratio = Number(row.goalRatio) || 0;
          return (
            <View
              key={row.id}
              style={{
                borderRadius: 18,
                borderWidth: 1,
                borderColor: colors.bg300,
                backgroundColor: colors.surface,
                padding: 14,
              }}
            >
              <Text style={{ fontFamily: GEO.title, fontSize: 16, color: colors.text100 }}>
                {row.unranked || !row.rank ? '—' : row.rank}. {row.nameKa}
              </Text>
              <View style={{ marginTop: 10 }}>
                <TbilisiProgressBar ratio={ratio} label={ka.tbilisiMoves.percent(formatGoalPct(ratio))} />
              </View>
              <Text style={{ marginTop: 8, color: colors.text200, fontFamily: GEO.regular }}>
                {formatKaInt(row.eligibleSteps || 0)} / {formatKaInt(row.target)} · {formatKaInt(row.participantCount || 0)} {ka.tbilisiMoves.participants}
              </Text>
            </View>
          );
        })
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

      {(data?.people?.people || []).slice(0, 20).map((row, index) => (
        <View key={`${row.publicHandle}-${index}`} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Text style={{ width: 28, fontFamily: 'NotoSansGeorgian_700Bold', color: colors.text100 }}>
            {row.rank == null ? '—' : row.rank}
          </Text>
          <CompetitionAvatar avatarId={row.publicAvatarId} handle={row.publicHandle} size={36} />
            <Text style={{ flex: 1, fontFamily: GEO.semibold, color: colors.text100 }} numberOfLines={2}>
              {row.publicHandle}
            </Text>
            <Text style={{ color: colors.text200, fontFamily: GEO.regular }}>{formatKaInt(row.eligibleSteps)}</Text>
        </View>
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
  );
}
