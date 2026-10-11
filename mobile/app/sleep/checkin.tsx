import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { X } from 'lucide-react-native';
import { tx } from '@/i18n/locale';
import { api } from '@/lib/api';
import { useAuth } from '@/store/AuthContext';
import { NightSky } from '@/components/sleep/NightSky';
import { MOON, MoonButton, PinnedFooter, QualityMoon, SleepBody, SleepChip, SleepDuration } from '@/components/sleep/SleepKit';
import { FACTOR_COPY, QUALITY_COPY } from '@/lib/sleep/sleepCopy';
import { markNightCheckedIn, reconcileSleepReminders } from '@/lib/sleep/sleepReminders';
import { isFeatureOn } from '@/lib/featureFlags';
import { clockOf, ymd } from '@/lib/sleep/sleepTime';
import { useSleepHub } from '@/lib/sleep/useSleepData';
import type { SleepFactor } from '@/lib/sleep/sleepTypes';
import { useThemeColors } from '@/theme/colors';

const WAKEUPS: { value: number; label: string }[] = [
  { value: 0, label: tx('არც ერთხელ', 'Not once') },
  { value: 1, label: tx('ერთხელ', 'Once') },
  { value: 2, label: tx('ორჯერ', 'Twice') },
  { value: 3, label: tx('3+', '3+') },
];
const LATENCY: { value: number; label: string }[] = [
  { value: 10, label: tx('მალე', 'Quickly') },
  { value: 25, label: tx('15–30 წთ', '15–30 min') },
  { value: 45, label: tx('30–60 წთ', '30–60 min') },
  { value: 75, label: tx('1 სთ+', '1 h+') },
];

/**
 * „დილა მშვიდობისა“: how the night felt (five moons), how often she woke, how long it took to fall asleep and
 * what may have played a part. Nothing is required except the moon. Saved as the night's check-in; Health and
 * sleep mode never overwrite it.
 */
export default function SleepCheckin() {
  const c = useThemeColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const params = useLocalSearchParams<{ night?: string; quality?: string; fromMode?: string; offline?: string }>();
  const hub = useSleepHub().data;
  const night = /^\d{4}-\d{2}-\d{2}$/.test(params.night ?? '') ? params.night! : ymd(new Date());
  const existing = hub?.nights.find((n) => n.night === night) ?? null;
  const [quality, setQuality] = useState<number | null>(() => Number(params.quality) || existing?.quality || null);
  const [wakeups, setWakeups] = useState<number | null>(existing?.wakeups ?? null);
  const [latency, setLatency] = useState<number | null>(existing?.latencyMinutes ?? null);
  const [factors, setFactors] = useState<SleepFactor[]>(existing?.factors ?? []);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const offered = useMemo(() => {
    const list = hub?.config.checkinFactors ?? (Object.keys(FACTOR_COPY) as SleepFactor[]);
    return list.filter((f) => f !== 'period' || user?.gender === 'FEMALE');
  }, [hub?.config.checkinFactors, user?.gender]);

  const toggle = (f: SleepFactor) => setFactors((list) => (list.includes(f) ? list.filter((x) => x !== f) : [...list, f]));

  const save = async () => {
    if (!quality || saving) return;
    setSaving(true);
    setError(null);
    try {
      await api.sleep.saveNight(night, { kind: 'checkin', quality, wakeups, latencyMinutes: latency, factors });
      await markNightCheckedIn(night);
      void reconcileSleepReminders(isFeatureOn('sleep'));
      router.dismissTo('/sleep' as never);
    } catch (e) {
      setError((e as Error)?.message || tx('ვერ შევინახე. სცადე თავიდან.', 'Could not save. Try again.'));
    } finally {
      setSaving(false);
    }
  };

  const label = (text: string) => <Text style={{ fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 14, lineHeight: 20, color: c.text100 }}>{text}</Text>;

  return (
    <View style={{ flex: 1, backgroundColor: c.bg100 }}>
      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 320 }}>
        <NightSky colors={['#2A1A4A', '#3B2366', '#0B0A1F']} glow="rgba(244,227,181,0.35)" glowAt={{ x: 0.7, y: 0.1 }} stars={24} twinkles={0} seed={5} />
      </View>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 10, paddingHorizontal: 20, paddingBottom: insets.bottom + 120, gap: 22 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'flex-end' }}>
          <Pressable accessibilityRole="button" accessibilityLabel={tx('დახურვა', 'Close')} onPress={() => router.dismissTo('/sleep' as never)} hitSlop={10} style={{ width: 44, height: 44, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' }}>
            <X size={20} color="#FFFFFF" />
          </Pressable>
        </View>
        <View style={{ gap: 6 }}>
          <Text accessibilityRole="header" style={{ fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 26, lineHeight: 34, color: '#FFFFFF' }}>{tx('დილა მშვიდობისა', 'Good morning')}</Text>
          {existing?.sleptMinutes ? (
            <View style={{ gap: 2 }}>
              <SleepDuration minutes={existing.sleptMinutes} size={34} color="#FFFFFF" />
              {existing.bedAt && existing.wakeAt ? (
                <SleepBody>{`${clockOf(new Date(existing.bedAt))} → ${clockOf(new Date(existing.wakeAt))}`}</SleepBody>
              ) : null}
            </View>
          ) : null}
          {params.offline === '1' ? <SleepBody>{tx('ღამე ტელეფონზე შევინახე და ინტერნეტის დაბრუნებისას გავგზავნი.', 'The night is kept on the phone and will be sent when you are back online.')}</SleepBody> : null}
        </View>

        <View style={{ gap: 12 }}>
          {label(tx('როგორ გეძინა?', 'How did you sleep?'))}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            {[1, 2, 3, 4, 5].map((q) => {
              const on = quality === q;
              return (
                <Pressable key={q} accessibilityRole="radio" accessibilityState={{ selected: on }} accessibilityLabel={QUALITY_COPY[q]} onPress={() => setQuality(q)} style={{ alignItems: 'center', gap: 6, flex: 1 }}>
                  <View style={{ width: 58, height: 58, borderRadius: 29, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? 'rgba(244,227,181,0.18)' : c.surface, borderWidth: on ? 2 : 0, borderColor: MOON }}>
                    <QualityMoon level={q} size={32} />
                  </View>
                  <Text numberOfLines={2} style={{ textAlign: 'center', fontFamily: on ? 'NotoSansGeorgian_700Bold' : 'NotoSansGeorgian_500Medium', fontSize: 10, lineHeight: 13, color: on ? MOON : c.text300 }}>{QUALITY_COPY[q]}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={{ gap: 10 }}>
          {label(tx('ღამით რამდენჯერ გაიღვიძე?', 'How often did you wake up?'))}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {WAKEUPS.map((w) => <SleepChip key={w.value} label={w.label} selected={wakeups === w.value} onPress={() => setWakeups(wakeups === w.value ? null : w.value)} />)}
          </View>
        </View>

        <View style={{ gap: 10 }}>
          {label(tx('რამდენ ხანში ჩაგეძინა?', 'How long did it take to fall asleep?'))}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {LATENCY.map((l) => <SleepChip key={l.value} label={l.label} selected={latency === l.value} onPress={() => setLatency(latency === l.value ? null : l.value)} />)}
          </View>
        </View>

        <View style={{ gap: 10 }}>
          {label(tx('რამ იმოქმედა?', 'What played a part?'))}
          <SleepBody muted>{tx('რამდენიმე კვირაში აქედან გაჩვენებთ, რა მოქმედებს სწორედ შენს ძილზე.', 'In a few weeks this shows what affects your own sleep.')}</SleepBody>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {offered.map((f) => <SleepChip key={f} label={FACTOR_COPY[f].label} icon={FACTOR_COPY[f].icon} selected={factors.includes(f)} onPress={() => toggle(f)} />)}
          </View>
        </View>
      </ScrollView>
      <PinnedFooter bottom={insets.bottom}>
        {error ? <Text style={{ textAlign: 'center', fontFamily: 'NotoSansGeorgian_500Medium', fontSize: 13, color: MOON }}>{error}</Text> : null}
        <MoonButton label={quality ? tx('შენახვა', 'Save') : tx('აირჩიე მთვარე', 'Pick a moon')} onPress={() => void save()} disabled={!quality} loading={saving} />
      </PinnedFooter>
    </View>
  );
}
