import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { Crown, MapPin, Trophy, Users } from 'lucide-react-native';
import { CompetitionAvatar } from '@/components/tbilisiMoves/CompetitionAvatar';
import { GEO } from '@/components/tbilisiMoves/copyStyles';
import { TbilisiMovesPersonRow } from '@/components/tbilisiMoves/TbilisiMovesBoard';
import { TbilisiMovesRankBadge } from '@/components/tbilisiMoves/TbilisiMovesRankBadge';
import { type RankPlace, rankTone } from '@/components/tbilisiMoves/tbilisiMovesRank';
import { ka } from '@/i18n/ka';
import { formatGoalPct, formatKaInt } from '@/lib/tbilisiMoves/format';
import type { TbilisiMovesDistrict, TbilisiMovesPerson } from '@/lib/tbilisiMoves/types';
import { useIsDark, useThemeColors } from '@/theme/colors';

export function TbilisiMovesBoardHeading({
  tab,
  onTab,
}: {
  tab: 'districts' | 'people';
  onTab: (tab: 'districts' | 'people') => void;
}) {
  const colors = useThemeColors();
  return (
    <View style={{ gap: 12, marginTop: 8 }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
        <View
          style={{
            width: 48,
            height: 48,
            borderRadius: 16,
            backgroundColor: colors.accent100,
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <Trophy size={22} color={colors.primary200} strokeWidth={2.2} />
        </View>
        <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
          <Text style={{ fontFamily: GEO.title, fontSize: 22, lineHeight: 28, color: colors.text100 }}>
            {ka.tbilisiMoves.boardTitle}
          </Text>
          <Text style={{ fontFamily: GEO.regular, fontSize: 13, lineHeight: 18, color: colors.text300 }}>
            {tab === 'districts' ? ka.tbilisiMoves.boardDistrictsHint : ka.tbilisiMoves.boardPeopleHint}
          </Text>
        </View>
      </View>
      <View
        style={{
          flexDirection: 'row',
          backgroundColor: colors.bg200,
          borderRadius: 18,
          padding: 4,
          borderWidth: 1,
          borderColor: colors.bg300,
        }}
      >
        {(['districts', 'people'] as const).map((id) => {
          const active = tab === id;
          const Icon = id === 'districts' ? MapPin : Users;
          return (
            <Pressable
              key={id}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              onPress={() => onTab(id)}
              style={{
                flex: 1,
                minHeight: 44,
                paddingVertical: 10,
                paddingHorizontal: 10,
                borderRadius: 14,
                backgroundColor: active ? colors.surface : 'transparent',
                borderWidth: active ? 1 : 0,
                borderColor: active ? colors.primary200 : 'transparent',
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
              }}
            >
              <Icon size={16} color={active ? colors.primary200 : colors.text300} strokeWidth={2.2} />
              <Text
                style={{
                  fontFamily: GEO.title,
                  fontSize: 14,
                  color: active ? colors.primary200 : colors.text300,
                }}
              >
                {id === 'districts' ? ka.tbilisiMoves.tabDistricts : ka.tbilisiMoves.tabPeople}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function YouChip() {
  const colors = useThemeColors();
  return (
    <View
      style={{
        marginTop: 4,
        alignSelf: 'center',
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 999,
        backgroundColor: colors.accent100,
      }}
    >
      <Text style={{ fontFamily: GEO.semibold, fontSize: 11, color: colors.primary200 }}>{ka.tbilisiMoves.you}</Text>
    </View>
  );
}

function PodiumSlot({
  rank,
  label,
  metric,
  caption,
  avatarId,
  handle,
  mine,
  solo,
}: {
  rank: RankPlace;
  label: string;
  metric: string;
  caption?: string;
  avatarId?: string | null;
  handle?: string | null;
  mine?: boolean;
  solo?: boolean;
}) {
  const colors = useThemeColors();
  const dark = useIsDark();
  const tone = rankTone(rank, dark)!;
  const champion = rank === 1;
  const avatarSize = champion ? 72 : 56;

  return (
    <View style={{ flex: solo ? undefined : 1, width: solo ? '46%' : undefined, minWidth: 0, alignItems: 'center' }}>
      {champion ? (
        <View style={{ marginBottom: 8 }}>
          <Crown size={22} color={tone.ring} fill={tone.ring} strokeWidth={2} />
        </View>
      ) : (
        <View style={{ height: 30 }} />
      )}
      {handle != null ? (
        <View
          style={{
            padding: 3,
            borderRadius: 999,
            borderWidth: 3,
            borderColor: tone.ring,
            marginBottom: 8,
          }}
        >
          <CompetitionAvatar avatarId={avatarId} handle={handle} size={avatarSize} />
        </View>
      ) : (
        <View
          style={{
            width: avatarSize,
            height: avatarSize,
            borderRadius: avatarSize / 2,
            backgroundColor: tone.fill,
            borderWidth: 3,
            borderColor: tone.ring,
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 8,
          }}
        >
          <Text style={{ fontFamily: GEO.title, fontSize: champion ? 24 : 18, color: tone.ink }}>{rank}</Text>
        </View>
      )}
      <Text
        numberOfLines={2}
        style={{
          minHeight: champion ? 40 : 36,
          fontFamily: GEO.title,
          fontSize: champion ? 15 : 13,
          lineHeight: champion ? 20 : 18,
          color: colors.text100,
          textAlign: 'center',
        }}
      >
        {label}
      </Text>
      {mine ? <YouChip /> : null}
      <Text
        style={{
          marginTop: 4,
          fontFamily: GEO.title,
          fontSize: champion ? 18 : 15,
          lineHeight: champion ? 24 : 20,
          color: tone.ink,
          textAlign: 'center',
        }}
      >
        {metric}
      </Text>
      {caption ? (
        <Text style={{ marginTop: 2, fontFamily: GEO.regular, fontSize: 11, color: colors.text300, textAlign: 'center' }}>
          {caption}
        </Text>
      ) : null}
      <View
        style={{
          marginTop: 10,
          alignSelf: 'stretch',
          height: tone.pedestal,
          borderRadius: 16,
          backgroundColor: tone.fill,
          borderWidth: 1,
          borderColor: tone.ring,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text style={{ fontFamily: GEO.title, fontSize: champion ? 22 : 16, color: tone.ink }}>{rank}</Text>
      </View>
    </View>
  );
}

function PodiumShell({ children }: { children: React.ReactNode }) {
  const colors = useThemeColors();
  return (
    <View
      style={{
        marginTop: 4,
        paddingTop: 16,
        paddingHorizontal: 10,
        paddingBottom: 12,
        borderRadius: 24,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.bg300,
      }}
    >
      {children}
    </View>
  );
}

function PodiumRow({ children, count }: { children: React.ReactNode; count: number }) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'flex-end',
        justifyContent: count === 1 ? 'center' : undefined,
        gap: 8,
      }}
    >
      {children}
    </View>
  );
}

export function TbilisiMovesDistrictPodium({
  first,
  second,
  third,
  mineId,
}: {
  first: TbilisiMovesDistrict | null;
  second: TbilisiMovesDistrict | null;
  third: TbilisiMovesDistrict | null;
  mineId?: string | null;
}) {
  const slots = [
    second ? { rank: 2 as const, row: second } : null,
    first ? { rank: 1 as const, row: first } : null,
    third ? { rank: 3 as const, row: third } : null,
  ].filter((slot): slot is { rank: RankPlace; row: TbilisiMovesDistrict } => Boolean(slot));

  if (!slots.length) return null;

  return (
    <PodiumShell>
      <PodiumRow count={slots.length}>
        {slots.map((slot) => (
          <PodiumSlot
            key={slot.row.id}
            rank={slot.rank}
            label={slot.row.nameKa}
            metric={`${formatGoalPct(Number(slot.row.goalRatio) || 0)}%`}
            caption={ka.tbilisiMoves.dayGoal}
            mine={Boolean(mineId && slot.row.id === mineId)}
            solo={slots.length === 1}
          />
        ))}
      </PodiumRow>
    </PodiumShell>
  );
}

export function TbilisiMovesPeoplePodium({
  first,
  second,
  third,
  myHandle,
}: {
  first: TbilisiMovesPerson | null;
  second: TbilisiMovesPerson | null;
  third: TbilisiMovesPerson | null;
  myHandle?: string | null;
}) {
  const slots = [
    second ? { rank: 2 as const, row: second } : null,
    first ? { rank: 1 as const, row: first } : null,
    third ? { rank: 3 as const, row: third } : null,
  ].filter((slot): slot is { rank: RankPlace; row: TbilisiMovesPerson } => Boolean(slot));

  if (!slots.length) return null;

  return (
    <PodiumShell>
      <PodiumRow count={slots.length}>
        {slots.map((slot) => (
          <PodiumSlot
            key={`${slot.row.publicHandle}-${slot.rank}`}
            rank={slot.rank}
            label={slot.row.publicHandle}
            metric={formatKaInt(slot.row.eligibleSteps)}
            caption={ka.tbilisiMoves.steps}
            avatarId={slot.row.publicAvatarId}
            handle={slot.row.publicHandle}
            mine={Boolean(myHandle && slot.row.publicHandle === myHandle)}
            solo={slots.length === 1}
          />
        ))}
      </PodiumRow>
    </PodiumShell>
  );
}

export function TbilisiMovesBoardEmpty() {
  const colors = useThemeColors();
  return (
    <View
      style={{
        marginTop: 8,
        padding: 28,
        borderRadius: 20,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.bg300,
        alignItems: 'center',
        gap: 12,
      }}
    >
      <View
        style={{
          width: 56,
          height: 56,
          borderRadius: 28,
          backgroundColor: colors.accent100,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Trophy size={26} color={colors.primary200} strokeWidth={2.2} />
      </View>
      <Text style={{ fontFamily: GEO.regular, fontSize: 14, lineHeight: 20, color: colors.text300, textAlign: 'center' }}>
        {ka.tbilisiMoves.emptyBoard}
      </Text>
    </View>
  );
}

export function TbilisiMovesYourPlaceDock({
  row,
  unranked,
}: {
  row?: TbilisiMovesPerson | null;
  unranked?: boolean;
}) {
  const colors = useThemeColors();
  if (unranked) {
    return (
      <View
        style={{
          borderRadius: 20,
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: colors.bg300,
          padding: 14,
        }}
      >
        <Text style={{ color: colors.text200, fontFamily: GEO.regular, fontSize: 14, lineHeight: 20 }}>
          {ka.tbilisiMoves.noRank}
        </Text>
      </View>
    );
  }
  if (!row) return null;
  return (
    <View
      style={{
        borderRadius: 20,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.primary200,
        padding: 12,
        gap: 8,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <TbilisiMovesRankBadge rank={row.rank} size={28} />
        <Text style={{ fontFamily: GEO.semibold, fontSize: 12, color: colors.text300 }}>{ka.tbilisiMoves.yourPlace}</Text>
      </View>
      <TbilisiMovesPersonRow row={row} highlight flush />
    </View>
  );
}
