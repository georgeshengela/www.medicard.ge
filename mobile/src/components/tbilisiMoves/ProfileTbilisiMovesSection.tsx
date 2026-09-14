import React, { useCallback, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Footprints } from 'lucide-react-native';
import { HomeSectionTitle } from '@/components/home/HomeSectionTitle';
import { Card } from '@/components/ui/Card';
import { ka } from '@/i18n/ka';
import { ApiError, api } from '@/lib/api';
import type { TbilisiMovesStatus } from '@/lib/tbilisiMoves/types';
import { useThemeColors } from '@/theme/colors';

export function ProfileTbilisiMovesSection() {
  const colors = useThemeColors();
  const router = useRouter();
  const [status, setStatus] = useState<TbilisiMovesStatus | null>(null);
  const [districtName, setDistrictName] = useState<string | null>(null);
  const [enrolled, setEnrolled] = useState(false);

  const load = useCallback(async () => {
    try {
      const next = await api.tbilisiMoves.status();
      setStatus(next);
      if (!next.schemaReady || !next.featureEnabled) {
        setEnrolled(false);
        setDistrictName(null);
        return;
      }
      try {
        const me = await api.tbilisiMoves.me();
        setEnrolled(Boolean(me.membership.enrolled));
        setDistrictName(me.membership.district?.nameKa || me.overview.membership.districtNameKa || null);
      } catch (error) {
        if (error instanceof ApiError && (error.status === 404 || error.status === 503)) {
          setEnrolled(false);
        }
      }
    } catch {
      setStatus(null);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const available = Boolean(status?.schemaReady && status.featureEnabled);
  const subtitle = !status
    ? ka.tbilisiMoves.profileHint
    : !available
      ? ka.tbilisiMoves.unavailableTitle
      : enrolled && districtName
        ? districtName
        : ka.tbilisiMoves.notEnrolledTitle;

  return (
    <View className="mt-5">
      <HomeSectionTitle title={ka.tbilisiMoves.title} />
      <Card onPress={() => router.push('/tbilisi-moves')}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View
            style={{
              width: 44,
              height: 44,
              borderRadius: 14,
              backgroundColor: colors.accent100,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Footprints size={20} color={colors.primary200} strokeWidth={2} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 15, color: colors.text100 }}>
              {available && enrolled ? ka.tbilisiMoves.profileCta : ka.tbilisiMoves.profileJoin}
            </Text>
            <Text style={{ marginTop: 2, fontSize: 13, color: colors.text300, fontFamily: 'NotoSansGeorgian_400Regular' }}>{subtitle}</Text>
          </View>
        </View>
      </Card>
    </View>
  );
}
