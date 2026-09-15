import React from 'react';
import { Pressable, Text, View } from 'react-native';
import type { LucideIcon } from 'lucide-react-native';
import { Check } from 'lucide-react-native';
import { CompetitionAvatar } from '@/components/tbilisiMoves/CompetitionAvatar';
import { GEO } from '@/components/tbilisiMoves/copyStyles';
import { TbilisiMovesIconWell } from '@/components/tbilisiMoves/TbilisiMovesChrome';
import { TbilisiMovesRankBadge } from '@/components/tbilisiMoves/TbilisiMovesRankBadge';
import { TbilisiProgressBar } from '@/components/tbilisiMoves/TbilisiProgressBar';
import { ka } from '@/i18n/ka';
import { formatGoalPct, formatKaInt } from '@/lib/tbilisiMoves/format';
import type { TbilisiMovesDistrict, TbilisiMovesPerson } from '@/lib/tbilisiMoves/types';
import { useThemeColors } from '@/theme/colors';

export function TbilisiMovesStatTile({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
}) {
  const colors = useThemeColors();
  return (
    <View
      style={{
        flex: 1,
        minWidth: 0,
        padding: 14,
        borderRadius: 18,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.bg300,
        gap: 10,
      }}
    >
      <TbilisiMovesIconWell size={36}>
        <Icon size={18} color={colors.primary200} strokeWidth={2.2} />
      </TbilisiMovesIconWell>
      <Text style={{ fontFamily: GEO.regular, fontSize: 12, lineHeight: 16, color: colors.text300 }}>{label}</Text>
      <Text style={{ fontFamily: GEO.title, fontSize: 20, lineHeight: 26, color: colors.text100 }} numberOfLines={2}>
        {value}
      </Text>
    </View>
  );
}

export function TbilisiMovesActionChip({
  icon: Icon,
  label,
  onPress,
}: {
  icon: LucideIcon;
  label: string;
  onPress: () => void;
}) {
  const colors = useThemeColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={{
        flex: 1,
        minHeight: 52,
        paddingHorizontal: 14,
        borderRadius: 16,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.bg300,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
      }}
    >
      <TbilisiMovesIconWell size={32}>
        <Icon size={16} color={colors.primary200} strokeWidth={2.2} />
      </TbilisiMovesIconWell>
      <Text style={{ flex: 1, fontFamily: GEO.title, fontSize: 14, color: colors.text100 }} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

export function TbilisiMovesPersonRow({
  row,
  highlight,
  flush,
}: {
  row: TbilisiMovesPerson;
  highlight?: boolean;
  flush?: boolean;
}) {
  const colors = useThemeColors();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        minHeight: 64,
        paddingVertical: flush ? 4 : 12,
        paddingHorizontal: flush ? 0 : 14,
        borderRadius: 18,
        backgroundColor: flush ? 'transparent' : highlight ? colors.accent100 : colors.surface,
        borderWidth: flush ? 0 : 1,
        borderColor: highlight ? colors.primary200 : colors.bg300,
        marginBottom: flush ? 0 : 8,
      }}
    >
      <TbilisiMovesRankBadge rank={row.rank} size={36} />
      <CompetitionAvatar avatarId={row.publicAvatarId} handle={row.publicHandle} size={44} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ fontFamily: GEO.title, fontSize: 15, lineHeight: 20, color: colors.text100 }} numberOfLines={2}>
          {row.publicHandle}
        </Text>
        {highlight ? (
          <Text style={{ marginTop: 2, fontFamily: GEO.semibold, fontSize: 12, color: colors.primary200 }}>
            {ka.tbilisiMoves.you}
          </Text>
        ) : null}
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        <Text style={{ fontFamily: GEO.title, fontSize: 16, lineHeight: 22, color: colors.text100 }}>
          {formatKaInt(row.eligibleSteps)}
        </Text>
        <Text style={{ fontFamily: GEO.regular, fontSize: 11, lineHeight: 14, color: colors.text300 }}>
          {ka.tbilisiMoves.steps}
        </Text>
      </View>
    </View>
  );
}

export function TbilisiMovesDistrictRow({
  row,
  mine,
}: {
  row: TbilisiMovesDistrict;
  mine?: boolean;
}) {
  const colors = useThemeColors();
  const ratio = Number(row.goalRatio) || 0;
  const placed = !row.unranked && row.rank != null && row.rank >= 1;
  const pct = formatGoalPct(ratio);
  return (
    <View
      style={{
        marginBottom: 10,
        borderRadius: 20,
        borderWidth: mine ? 1.5 : 1,
        borderColor: mine ? colors.primary200 : colors.bg300,
        backgroundColor: mine ? colors.accent100 : colors.surface,
        padding: 14,
        gap: 12,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <TbilisiMovesRankBadge rank={placed ? row.rank : null} size={44} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={{ fontFamily: GEO.title, fontSize: 16, lineHeight: 22, color: colors.text100 }} numberOfLines={2}>
            {row.nameKa}
          </Text>
          <Text style={{ marginTop: 2, fontFamily: GEO.regular, fontSize: 12, lineHeight: 16, color: colors.text300 }}>
            {placed ? `${ka.tbilisiMoves.districtRank} ${row.rank}` : ka.tbilisiMoves.unranked}
            {mine ? ` · ${ka.tbilisiMoves.you}` : ''}
          </Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text
            style={{
              fontFamily: GEO.title,
              fontSize: 22,
              lineHeight: 28,
              color: ratio >= 1 ? colors.success : colors.primary200,
            }}
          >
            {pct}%
          </Text>
          {row.goalReached ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
              <Check size={12} color={colors.success} strokeWidth={2.6} />
              <Text style={{ fontFamily: GEO.semibold, fontSize: 11, color: colors.success }}>
                {ka.tbilisiMoves.dayGoal}
              </Text>
            </View>
          ) : null}
        </View>
      </View>
      <TbilisiProgressBar ratio={ratio} label={null} />
      <Text style={{ fontFamily: GEO.regular, fontSize: 13, lineHeight: 18, color: colors.text200 }}>
        {formatKaInt(row.eligibleSteps || 0)} / {formatKaInt(row.target)} · {formatKaInt(row.participantCount || 0)}{' '}
        {ka.tbilisiMoves.participants}
      </Text>
    </View>
  );
}
