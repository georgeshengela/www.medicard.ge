import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft, ChevronRight, Trash2 } from 'lucide-react-native';
import { ModuleHeader } from '@/components/brand/ModuleHeader';
import { TimePickerSheet } from '@/components/ui/TimePickerSheet';
import { ClockText, MOON, MoonButton, PinnedFooter, NightCard, SleepBody, SleepDuration, SleepSection } from '@/components/sleep/SleepKit';
import { tx, dateLocale } from '@/i18n/locale';
import { api } from '@/lib/api';
import { clockOf, parseHHMM, ymd } from '@/lib/sleep/sleepTime';
import { useSleepHub } from '@/lib/sleep/useSleepData';
import { useThemeColors } from '@/theme/colors';

const DAY = 86_400_000;

/** Bed and wake instants for a night (the morning `night`), from two clock times. */
function instants(night: string, bed: string, wake: string): { bedAt: Date; wakeAt: Date } | null {
  const b = parseHHMM(bed);
  const w = parseHHMM(wake);
  if (b == null || w == null) return null;
  const morning = new Date(`${night}T00:00:00`);
  const wakeAt = new Date(morning.getTime() + w * 60_000);
  // A bedtime after noon is the evening before; before noon it is that same morning (after midnight).
  let bedAt = new Date(morning.getTime() + b * 60_000 - (b >= 12 * 60 ? DAY : 0));
  if (bedAt.getTime() >= wakeAt.getTime()) bedAt = new Date(bedAt.getTime() - DAY);
  return { bedAt, wakeAt };
}

/** Log or fix a night by hand. A hand entry wins over sleep mode and Health (and clears Health's stages). */
export default function SleepLogScreen() {
  const c = useThemeColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ night?: string }>();
  const hub = useSleepHub().data;
  const today = ymd(new Date());
  const [night, setNight] = useState(/^\d{4}-\d{2}-\d{2}$/.test(params.night ?? '') ? params.night! : today);
  const existing = hub?.nights.find((n) => n.night === night) ?? null;
  const [bed, setBed] = useState<string>(existing?.bedAt ? clockOf(new Date(existing.bedAt)) : '23:00');
  const [wake, setWake] = useState<string>(existing?.wakeAt ? clockOf(new Date(existing.wakeAt)) : '07:00');
  const [sheet, setSheet] = useState<'bed' | 'wake' | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const shown = instants(night, bed, wake);
  const minutes = shown ? Math.round((shown.wakeAt.getTime() - shown.bedAt.getTime()) / 60_000) : null;
  const dateLabel = useMemo(() => new Date(`${night}T12:00:00`).toLocaleDateString(dateLocale(), { weekday: 'long', day: 'numeric', month: 'long' }), [night]);
  const shift = (days: number) => {
    const next = ymd(new Date(Date.parse(`${night}T12:00:00`) + days * DAY));
    if (next > today) return;
    setNight(next);
    const n = hub?.nights.find((x) => x.night === next);
    if (n?.bedAt) setBed(clockOf(new Date(n.bedAt)));
    if (n?.wakeAt) setWake(clockOf(new Date(n.wakeAt)));
  };

  const save = async () => {
    if (!shown || saving) return;
    setSaving(true);
    setError(null);
    try {
      await api.sleep.saveNight(night, { kind: 'manual', bedAt: shown.bedAt.toISOString(), wakeAt: shown.wakeAt.toISOString() });
      router.dismissTo('/sleep' as never);
    } catch (e) {
      setError((e as Error)?.message || tx('ვერ შევინახე. სცადე თავიდან.', 'Could not save. Try again.'));
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    setSaving(true);
    try {
      await api.sleep.deleteNight(night);
      router.dismissTo('/sleep' as never);
    } catch (e) {
      setError((e as Error)?.message || tx('ვერ წავშალე. სცადე თავიდან.', 'Could not delete. Try again.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.bg100 }}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 12, paddingHorizontal: 20, paddingBottom: insets.bottom + 140, gap: 24 }}>
        <ModuleHeader module="sleep" subtitle={existing ? tx('ღამის შესწორება', 'Edit the night') : tx('ღამის ჩაწერა', 'Log a night')} fallbackHref="/sleep" />
        <NightCard style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Pressable accessibilityRole="button" accessibilityLabel={tx('წინა ღამე', 'Previous night')} onPress={() => shift(-1)} hitSlop={10} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: c.surfaceRaised, alignItems: 'center', justifyContent: 'center' }}>
            <ChevronLeft size={20} color={c.text100} />
          </Pressable>
          <View style={{ alignItems: 'center', flex: 1 }}>
            <Text style={{ fontFamily: 'NotoSansGeorgian_500Medium', fontSize: 12, color: c.text300 }}>{tx('ღამე, რომელიც დასრულდა', 'The night that ended on')}</Text>
            <Text style={{ fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 15, color: c.text100 }}>{dateLabel}</Text>
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel={tx('შემდეგი ღამე', 'Next night')} disabled={night >= today} onPress={() => shift(1)} hitSlop={10} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: c.surfaceRaised, alignItems: 'center', justifyContent: 'center', opacity: night >= today ? 0.35 : 1 }}>
            <ChevronRight size={20} color={c.text100} />
          </Pressable>
        </NightCard>

        <SleepSection title={tx('დრო', 'Times')}>
          <NightCard style={{ gap: 14 }}>
            <Pressable accessibilityRole="button" onPress={() => setSheet('bed')} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text style={{ fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 14, color: c.text100 }}>{tx('დავწექი', 'Went to bed')}</Text>
              <ClockText value={bed} size={28} />
            </Pressable>
            <View style={{ height: 1, backgroundColor: c.bg200 }} />
            <Pressable accessibilityRole="button" onPress={() => setSheet('wake')} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text style={{ fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 14, color: c.text100 }}>{tx('ავდექი', 'Got up')}</Text>
              <ClockText value={wake} size={28} />
            </Pressable>
          </NightCard>
          {minutes != null ? (
            <View style={{ alignItems: 'center', gap: 4, marginTop: 6 }}>
              <SleepDuration minutes={minutes} size={34} />
              <SleepBody muted>{tx('საწოლში. ჩაძინების დროს დილის შეფასებაში მიუთითებ.', 'In bed. Add how long it took to fall asleep in the morning check-in.')}</SleepBody>
            </View>
          ) : null}
        </SleepSection>

        {existing?.timesSource === 'health' ? (
          <SleepBody muted>{tx('ეს ღამე Apple Health / Health Connect-იდანაა. შენ მიერ შეცვლილ დროს Health აღარ შეცვლის, ძილის ფაზები კი აღარ ჩანს.', "This night came from Apple Health / Health Connect. Health will not change times you edit, and its stages are no longer shown.")}</SleepBody>
        ) : null}

        {existing ? (
          confirmDelete ? (
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Pressable accessibilityRole="button" onPress={() => void remove()} style={{ flex: 1, height: 46, borderRadius: 23, backgroundColor: c.danger, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 14, color: '#FFFFFF' }}>{tx('წაშლა', 'Delete')}</Text>
              </Pressable>
              <Pressable accessibilityRole="button" onPress={() => setConfirmDelete(false)} style={{ flex: 1, height: 46, borderRadius: 23, backgroundColor: c.surfaceRaised, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 14, color: c.text100 }}>{tx('გაუქმება', 'Cancel')}</Text>
              </Pressable>
            </View>
          ) : (
            <Pressable accessibilityRole="button" onPress={() => setConfirmDelete(true)} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'center', paddingVertical: 8 }}>
              <Trash2 size={16} color={c.danger} />
              <Text style={{ fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 13, color: c.danger }}>{tx('ამ ღამის წაშლა', 'Delete this night')}</Text>
            </Pressable>
          )
        ) : null}
      </ScrollView>
      <PinnedFooter bottom={insets.bottom}>
        {error ? <Text style={{ textAlign: 'center', fontFamily: 'NotoSansGeorgian_500Medium', fontSize: 13, color: MOON }}>{error}</Text> : null}
        <MoonButton label={tx('შენახვა', 'Save')} onPress={() => void save()} loading={saving} disabled={!shown} />
      </PinnedFooter>
      <TimePickerSheet
        visible={sheet !== null}
        title={sheet === 'bed' ? tx('დავწექი', 'Went to bed') : tx('ავდექი', 'Got up')}
        value={sheet === 'bed' ? bed : wake}
        fill="#9A4FD6"
        quickTimes={sheet === 'bed' ? ['22:00', '22:30', '23:00', '23:30', '00:00', '01:00'] : ['06:00', '06:30', '07:00', '07:30', '08:00', '09:00']}
        onClose={() => setSheet(null)}
        onApply={(time) => {
          if (sheet === 'bed') setBed(time);
          else setWake(time);
          setSheet(null);
        }}
      />
    </View>
  );
}
