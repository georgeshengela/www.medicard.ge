import React, { useEffect } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Pause, Play, Square } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { HuntMap } from '@/components/hunt/HuntMap';
import { h, missionLabel } from '@/lib/hunt/copy';
import { beginEncounter, collectCapsule, endHunt, pauseHunt, resumeHunt, useHuntSession } from '@/lib/hunt/store';
import { gpsHintCopy } from '@/lib/hunt/types';
import { useThemeColors } from '@/theme/colors';

function clock(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, '0')}`;
}

export default function HuntActiveScreen() {
  const router = useRouter();
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const copy = h('ka');
  const { snap, error } = useHuntSession();

  useEffect(() => {
    if (snap?.status === 'encounter') router.push('/run/hunt-encounter' as never);
    if (snap && ['ended', 'completed', 'expired'].includes(snap.status)) {
      router.replace('/run/hunt-summary' as never);
    }
  }, [snap?.status, router]);

  if (!snap?.player) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg100, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ fontFamily: 'NotoSansGeorgian_500Medium', color: colors.text200 }}>{copy.preparing}</Text>
      </View>
    );
  }

  const hint = gpsHintCopy(snap.gpsHint, copy);
  const paused = snap.status === 'paused';
  const capsules = snap.capsules.filter((c) => c.state !== 'taken');
  const enemies = snap.enemies.filter((e) => e.state !== 'captured');
  const noShields = snap.shields <= 0;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg100 }}>
      <HuntMap center={snap.player} snap={snap} />
      <View style={{ position: 'absolute', top: insets.top + 8, left: 12, right: 12, gap: 8 }}>
        {snap.simulation || snap.previewLocal ? (
          <View style={{ alignSelf: 'center', backgroundColor: '#042F2E', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999 }}>
            <Text style={{ fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 12, color: '#99F6E4' }}>{copy.simBadge}</Text>
          </View>
        ) : null}
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {[
            { k: snap.hunting ? copy.hunting : copy.chasing, v: snap.hunting ? clock(snap.huntingMs) : '—' },
            { k: copy.timeLeft, v: clock(snap.remainingMs) },
            { k: copy.shields, v: String(snap.shields) },
          ].map((x) => (
            <View key={x.k} style={{ flex: 1, backgroundColor: 'rgba(3,7,18,0.72)', borderRadius: 14, padding: 10 }}>
              <Text style={{ fontFamily: 'NotoSansGeorgian_500Medium', fontSize: 10, color: '#D1D5DB' }}>{x.k}</Text>
              <Text style={{ fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 16, color: '#fff' }}>{x.v}</Text>
            </View>
          ))}
        </View>
        <View style={{ backgroundColor: 'rgba(3,7,18,0.72)', borderRadius: 14, padding: 10 }}>
          <Text style={{ fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 12, color: '#fff' }}>
            {snap.mission ? missionLabel(snap.mission.key) : copy.dailyMission} · {snap.mission?.progress || 0}/{snap.mission?.target || 0}
          </Text>
          <Text style={{ marginTop: 4, fontFamily: 'NotoSansGeorgian_500Medium', fontSize: 11, color: '#99F6E4' }}>
            {copy.confirmed} {snap.coins.confirmed} · {copy.coinsCap} {snap.coins.dailyLeft}
          </Text>
        </View>
        {hint ? (
          <View style={{ backgroundColor: '#0F766E', borderRadius: 12, padding: 10 }}>
            <Text style={{ fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 12.5, color: '#fff' }}>{hint}</Text>
          </View>
        ) : null}
        {error === 'ping' || error === 'reconnecting' ? (
          <View style={{ backgroundColor: '#1F2937', borderRadius: 12, padding: 10 }}>
            <Text style={{ fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 12.5, color: '#fff' }}>{copy.reconnecting}</Text>
          </View>
        ) : null}
        {noShields ? (
          <View style={{ backgroundColor: '#7F1D1D', borderRadius: 12, padding: 10 }}>
            <Text style={{ fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 12.5, color: '#fff' }}>{copy.noShields}</Text>
          </View>
        ) : null}
      </View>

      {paused ? (
        <View style={{ position: 'absolute', left: 12, right: 12, bottom: insets.bottom + 16, gap: 8 }}>
          <View style={{ backgroundColor: 'rgba(3,7,18,0.86)', borderRadius: 16, padding: 16 }}>
            <Text style={{ fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 16, color: '#fff', textAlign: 'center' }}>{copy.paused}</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            onPress={() => void resumeHunt()}
            style={{ height: 52, borderRadius: 14, backgroundColor: '#0D9488', alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 }}
          >
            <Play size={16} color="#fff" />
            <Text style={{ fontFamily: 'NotoSansGeorgian_700Bold', color: '#fff' }}>{copy.resume}</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              void endHunt().then(() => router.replace('/run/hunt-summary' as never));
            }}
            style={{ height: 48, borderRadius: 14, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.bg300, alignItems: 'center', justifyContent: 'center' }}
          >
            <Text style={{ fontFamily: 'NotoSansGeorgian_700Bold', color: colors.text100 }}>{copy.end}</Text>
          </Pressable>
        </View>
      ) : (
        <View style={{ position: 'absolute', left: 12, right: 12, bottom: insets.bottom + 16, gap: 8 }}>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {capsules.slice(0, 1).map((c) => (
              <Pressable
                key={c.id}
                accessibilityRole="button"
                onPress={() => void collectCapsule(c.id)}
                style={{ flex: 1, height: 48, borderRadius: 14, backgroundColor: '#0EA5E9', alignItems: 'center', justifyContent: 'center' }}
              >
                <Text style={{ fontFamily: 'NotoSansGeorgian_700Bold', color: '#fff' }}>{copy.takeCapsule}</Text>
              </Pressable>
            ))}
            {snap.hunting
              ? enemies.slice(0, 1).map((e) => (
                  <Pressable
                    key={e.id}
                    accessibilityRole="button"
                    onPress={() => void beginEncounter(e.id)}
                    style={{ flex: 1, height: 48, borderRadius: 14, backgroundColor: '#E11D48', alignItems: 'center', justifyContent: 'center' }}
                  >
                    <Text style={{ fontFamily: 'NotoSansGeorgian_700Bold', color: '#fff' }}>{copy.encounterTitle}</Text>
                  </Pressable>
                ))
              : null}
          </View>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Pressable
              accessibilityRole="button"
              onPress={() => void pauseHunt()}
              style={{ flex: 1, height: 48, borderRadius: 14, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.bg300, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 }}
            >
              <Pause size={16} color={colors.text100} />
              <Text style={{ fontFamily: 'NotoSansGeorgian_700Bold', color: colors.text100 }}>{copy.pauseAction}</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                void endHunt().then(() => router.replace('/run/hunt-summary' as never));
              }}
              style={{ width: 48, height: 48, borderRadius: 14, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.bg300, alignItems: 'center', justifyContent: 'center' }}
            >
              <Square size={16} color={colors.text100} />
            </Pressable>
          </View>
        </View>
      )}
    </View>
  );
}
