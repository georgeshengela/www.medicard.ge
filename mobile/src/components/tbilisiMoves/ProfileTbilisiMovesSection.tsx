import React, { useCallback, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import Svg, { Circle, G } from 'react-native-svg';
import { ChevronRight, Footprints, MapPin, Trophy } from 'lucide-react-native';
import { HomeSectionTitle } from '@/components/home/HomeSectionTitle';
import { CompetitionAvatar } from '@/components/tbilisiMoves/CompetitionAvatar';
import { GEO } from '@/components/tbilisiMoves/copyStyles';
import { TbilisiMovesRankBadge } from '@/components/tbilisiMoves/TbilisiMovesRankBadge';
import { TbilisiProgressBar } from '@/components/tbilisiMoves/TbilisiProgressBar';
import { ka } from '@/i18n/ka';
import { ApiError, api } from '@/lib/api';
import { formatGoalPct, formatKaInt } from '@/lib/tbilisiMoves/format';
import type { TbilisiMovesStatus } from '@/lib/tbilisiMoves/types';
import { useIsDark, useThemeColors } from '@/theme/colors';

const FLAT = {
  shadowColor: 'transparent',
  shadowOpacity: 0,
  shadowRadius: 0,
  shadowOffset: { width: 0, height: 0 },
  elevation: 0,
} as const;

type Snapshot = {
  status: TbilisiMovesStatus | null;
  enrolled: boolean;
  districtName: string | null;
  handle: string | null;
  avatarId: string | null;
  rank: number | null;
  unranked: boolean;
  ratio: number;
  districtSteps: number;
  target: number;
  personalSteps: number;
  participants: number;
  pendingName: string | null;
  pilot: boolean;
};

const EMPTY: Snapshot = {
  status: null,
  enrolled: false,
  districtName: null,
  handle: null,
  avatarId: null,
  rank: null,
  unranked: true,
  ratio: 0,
  districtSteps: 0,
  target: 0,
  personalSteps: 0,
  participants: 0,
  pendingName: null,
  pilot: false,
};

function MiniGoalRing({ percent }: { percent: number }) {
  const colors = useThemeColors();
  const dark = useIsDark();
  const size = 76;
  const sw = 8;
  const r = (size - sw) / 2;
  const c = 2 * Math.PI * r;
  const t = Math.max(0, Math.min(1, percent / 100));
  const p = Math.round(percent);

  return (
    <View
      accessibilityRole="image"
      accessibilityLabel={`${p} ${ka.tbilisiMoves.outOf100}`}
      style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}
    >
      <Svg width={size} height={size} style={{ position: 'absolute' }}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={dark ? colors.bg300 : colors.bg200} strokeWidth={sw} fill="none" />
        <G transform={`rotate(-90 ${size / 2} ${size / 2})`}>
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            stroke={colors.primary200}
            strokeWidth={sw}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={`${c * t} ${c}`}
          />
        </G>
      </Svg>
      <Text style={{ fontFamily: GEO.title, fontSize: 18, lineHeight: 22, color: colors.text100 }}>{p}</Text>
      <Text style={{ fontFamily: GEO.semibold, fontSize: 10, lineHeight: 12, color: colors.text300 }}>%</Text>
    </View>
  );
}

function StatChip({
  icon: Icon,
  value,
  label,
}: {
  icon: typeof Footprints;
  value: string;
  label: string;
}) {
  const colors = useThemeColors();
  const dark = useIsDark();
  return (
    <View
      style={{
        flex: 1,
        minWidth: 0,
        minHeight: 56,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingHorizontal: 10,
        paddingVertical: 8,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: colors.bg300,
        backgroundColor: dark ? colors.surfaceRaised : colors.bg100,
      }}
    >
      <View
        style={{
          width: 32,
          height: 32,
          borderRadius: 10,
          backgroundColor: colors.accent100,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icon size={16} color={colors.primary200} strokeWidth={2.2} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text numberOfLines={1} style={{ fontFamily: GEO.title, fontSize: 15, lineHeight: 20, color: colors.text100 }}>
          {value}
        </Text>
        <Text numberOfLines={1} style={{ fontFamily: GEO.regular, fontSize: 11, lineHeight: 14, color: colors.text300 }}>
          {label}
        </Text>
      </View>
    </View>
  );
}

export function ProfileTbilisiMovesSection() {
  const colors = useThemeColors();
  const dark = useIsDark();
  const router = useRouter();
  const [snap, setSnap] = useState<Snapshot>(EMPTY);

  const load = useCallback(async () => {
    try {
      const next = await api.tbilisiMoves.status();
      if (!next.schemaReady || !next.featureEnabled) {
        setSnap({ ...EMPTY, status: next });
        return;
      }
      try {
        const me = await api.tbilisiMoves.me();
        const district = me.overview.yourDistrict;
        const you = me.overview.you;
        const target = district?.target || me.config.defaultDailyTarget || 0;
        const credited = district?.eligibleSteps || 0;
        setSnap({
          status: next,
          enrolled: Boolean(me.membership.enrolled),
          districtName: me.membership.district?.nameKa || me.overview.membership.districtNameKa || district?.nameKa || null,
          handle: me.membership.publicHandle,
          avatarId: me.membership.publicAvatarId,
          rank: district?.rank ?? null,
          unranked: Boolean(district?.unranked || district?.rank == null),
          ratio: target > 0 ? credited / target : Number(district?.goalRatio) || 0,
          districtSteps: credited,
          target,
          personalSteps: you?.eligibleSteps || 0,
          participants: district?.participantCount || 0,
          pendingName: me.membership.pendingDistrict?.nameKa || me.overview.membership.pendingDistrictNameKa || null,
          pilot: Boolean(me.config.pilotMode || next.pilotMode),
        });
      } catch (error) {
        if (error instanceof ApiError && (error.status === 404 || error.status === 503)) {
          setSnap({ ...EMPTY, status: next });
          return;
        }
        setSnap((prev) => ({ ...prev, status: next }));
      }
    } catch {
      setSnap(EMPTY);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const available = Boolean(snap.status?.schemaReady && snap.status.featureEnabled);
  const enrolled = available && snap.enrolled;
  const href = available && !snap.enrolled ? '/tbilisi-moves/enroll' : '/tbilisi-moves';
  const pct = Math.round(Math.max(0, Math.min(1, snap.ratio)) * 100);
  const rankLabel = snap.unranked || snap.rank == null ? ka.tbilisiMoves.unranked : String(snap.rank);

  const a11y = enrolled
    ? [
        ka.tbilisiMoves.title,
        snap.districtName,
        `${ka.tbilisiMoves.percent(String(pct))}`,
        `${ka.tbilisiMoves.districtRank} ${rankLabel}`,
      ]
        .filter(Boolean)
        .join('. ')
    : `${ka.tbilisiMoves.title}. ${available ? ka.tbilisiMoves.profileJoin : ka.tbilisiMoves.unavailableTitle}`;

  return (
    <View className="mt-5">
      <HomeSectionTitle title={ka.tbilisiMoves.title} />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={a11y}
        onPress={() => router.push(href)}
        className="active:opacity-90"
        style={{
          ...FLAT,
          borderRadius: 24,
          borderWidth: 1,
          borderColor: colors.bg300,
          backgroundColor: colors.surface,
          padding: 16,
          overflow: 'hidden',
        }}
      >
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            right: -40,
            top: -48,
            width: 150,
            height: 150,
            borderRadius: 75,
            backgroundColor: dark ? '#042F2E' : '#CCFBF1',
            opacity: dark ? 0.9 : 0.55,
          }}
        />

        {enrolled ? (
          <View style={{ gap: 14 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
              <MiniGoalRing percent={pct} />
              <View style={{ flex: 1, minWidth: 0, gap: 6 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <TbilisiMovesRankBadge rank={snap.unranked ? null : snap.rank} size={32} />
                  <Text
                    numberOfLines={2}
                    style={{ flex: 1, fontFamily: GEO.title, fontSize: 18, lineHeight: 24, color: colors.text100 }}
                  >
                    {snap.districtName || ka.tbilisiMoves.currentDistrict}
                  </Text>
                </View>
                {snap.handle ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <CompetitionAvatar avatarId={snap.avatarId} handle={snap.handle} size={22} />
                    <Text numberOfLines={1} style={{ flex: 1, fontFamily: GEO.semibold, fontSize: 13, color: colors.text200 }}>
                      {snap.handle}
                    </Text>
                  </View>
                ) : null}
                <Text numberOfLines={1} style={{ fontFamily: GEO.regular, fontSize: 12, lineHeight: 16, color: colors.text300 }}>
                  {formatKaInt(snap.participants)} {ka.tbilisiMoves.participants}
                </Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                  {snap.pilot ? (
                    <View
                      style={{
                        paddingHorizontal: 8,
                        paddingVertical: 3,
                        borderRadius: 999,
                        backgroundColor: colors.accent100,
                        borderWidth: 1,
                        borderColor: colors.bg300,
                      }}
                    >
                      <Text style={{ fontFamily: GEO.semibold, fontSize: 11, color: colors.primary200 }}>
                        {ka.tbilisiMoves.pilotShort}
                      </Text>
                    </View>
                  ) : null}
                  {snap.pendingName ? (
                    <View
                      style={{
                        paddingHorizontal: 8,
                        paddingVertical: 3,
                        borderRadius: 999,
                        backgroundColor: colors.warningBg,
                      }}
                    >
                      <Text style={{ fontFamily: GEO.semibold, fontSize: 11, color: colors.warning }}>
                        {ka.tbilisiMoves.pendingChange}
                      </Text>
                    </View>
                  ) : null}
                </View>
              </View>
            </View>

            <TbilisiProgressBar ratio={snap.ratio} label={`${formatGoalPct(snap.ratio)}%`} />

            <View style={{ flexDirection: 'row', gap: 8 }}>
              <StatChip icon={Footprints} value={formatKaInt(snap.personalSteps)} label={ka.tbilisiMoves.yourContribution} />
              <StatChip icon={Trophy} value={rankLabel} label={ka.tbilisiMoves.districtRank} />
            </View>

            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text style={{ fontFamily: GEO.title, fontSize: 14, color: colors.primary200 }}>{ka.tbilisiMoves.profileCta}</Text>
              <ChevronRight size={18} color={colors.primary200} strokeWidth={2.2} />
            </View>
          </View>
        ) : (
          <View style={{ gap: 14 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
              <View
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: 18,
                  backgroundColor: colors.accent100,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <MapPin size={26} color={colors.primary200} strokeWidth={2.2} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={{ fontFamily: GEO.title, fontSize: 18, lineHeight: 24, color: colors.text100 }}>
                  {available ? ka.tbilisiMoves.profileJoin : ka.tbilisiMoves.unavailableTitle}
                </Text>
                <Text style={{ marginTop: 4, fontFamily: GEO.regular, fontSize: 13, lineHeight: 18, color: colors.text300 }}>
                  {available ? ka.tbilisiMoves.profileHint : ka.tbilisiMoves.unavailableBody}
                </Text>
              </View>
            </View>
            <View
              style={{
                minHeight: 48,
                borderRadius: 16,
                backgroundColor: available ? (dark ? '#0D9488' : colors.primary200) : colors.bg200,
                paddingHorizontal: 14,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <Text
                style={{
                  fontFamily: GEO.title,
                  fontSize: 15,
                  color: available ? '#FFFFFF' : colors.text300,
                }}
              >
                {available ? ka.tbilisiMoves.enroll : ka.tbilisiMoves.profileCta}
              </Text>
              <ChevronRight size={18} color={available ? '#FFFFFF' : colors.text300} strokeWidth={2.2} />
            </View>
          </View>
        )}
      </Pressable>
    </View>
  );
}
