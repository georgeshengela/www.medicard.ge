import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SlidersHorizontal } from 'lucide-react-native';
import { ModuleHeader, ModuleHeaderButton } from '@/components/brand/ModuleHeader';
import { MOON, MOON_INK, NightCard, ORCHID, SleepBody } from '@/components/sleep/SleepKit';
import { MixerSheet, NowPlayingBar, SoundCard } from '@/components/sleep/SleepSounds';
import { tx } from '@/i18n/locale';
import { CATEGORY_COPY } from '@/lib/sleep/sleepCopy';
import { useSleepCatalog } from '@/lib/sleep/useSleepData';
import type { SleepCategory } from '@/lib/sleep/sleepTypes';
import { useThemeColors } from '@/theme/colors';

/**
 * The sound library (reference: „Sleep Soundscapes“): category pills, then the art tiles two per row. Tap a tile
 * to play it, tap another to mix (up to the admin's limit); the mixer sets volumes and the fade-out timer.
 */
export default function SleepSoundsScreen() {
  const c = useThemeColors();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const q = useSleepCatalog();
  const [category, setCategory] = useState<SleepCategory | 'all'>('all');
  const [mixerOpen, setMixerOpen] = useState(false);
  const sounds = q.data?.sounds ?? [];
  const shown = useMemo(() => (category === 'all' ? sounds : sounds.filter((s) => s.category === category)), [sounds, category]);
  const tileW = (Math.min(width, 520) - 40 - 12) / 2;
  const cats: (SleepCategory | 'all')[] = ['all', ...((q.data?.categories ?? []).map((x) => x.id) as SleepCategory[])];

  return (
    <View style={{ flex: 1, backgroundColor: c.bg100 }}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 12, paddingHorizontal: 20, paddingBottom: insets.bottom + 120, gap: 18 }}>
        <ModuleHeader
          module="sleep"
          subtitle={tx('ხმები და მელოდიები', 'Sounds and melodies')}
          fallbackHref="/sleep"
          right={<ModuleHeaderButton label={tx('მიქსერი', 'Mixer')} icon={SlidersHorizontal} onPress={() => setMixerOpen(true)} />}
        />
        <View style={{ gap: 4 }}>
          <Text accessibilityRole="header" style={{ fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 22, lineHeight: 30, color: c.text100 }}>{tx('ძილის ხმები', 'Sleep soundscapes')}</Text>
          <SleepBody muted>{tx('აირჩიე ერთი ან შეურიე რამდენიმე. ხმა ეკრანის ჩაკეტვის შემდეგაც უკრავს და ტაიმერით ნელა ჩაქრება.', 'Pick one or mix a few. It keeps playing with the screen locked and fades out with the timer.')}</SleepBody>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -20 }} contentContainerStyle={{ gap: 8, paddingHorizontal: 20 }}>
          {cats.map((id) => {
            const on = category === id;
            return (
              <Pressable key={id} accessibilityRole="tab" accessibilityState={{ selected: on }} onPress={() => setCategory(id)} style={{ height: 38, paddingHorizontal: 16, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? MOON : c.surface }}>
                <Text style={{ fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 13, color: on ? MOON_INK : c.text100 }}>{id === 'all' ? tx('ყველა', 'All') : CATEGORY_COPY[id]}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
        {q.isLoading && !q.data ? <ActivityIndicator color={ORCHID} style={{ marginTop: 40 }} /> : null}
        {q.isError && !q.data ? (
          <NightCard style={{ gap: 10 }}>
            <SleepBody>{tx('ხმები ვერ ჩაიტვირთა. შეამოწმე ინტერნეტი.', 'Sounds could not load. Check your connection.')}</SleepBody>
            <Pressable accessibilityRole="button" onPress={() => void q.refetch()}>
              <Text style={{ fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 14, color: ORCHID }}>{tx('ხელახლა ცდა', 'Try again')}</Text>
            </Pressable>
          </NightCard>
        ) : null}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
          {shown.map((s) => (
            <SoundCard key={s.id} sound={s} width={tileW} height={Math.round(tileW * 1.3)} />
          ))}
        </View>
        {q.data && !sounds.length ? <SleepBody muted>{tx('ხმები მალე დაემატება.', 'Sounds are coming soon.')}</SleepBody> : null}
        <SleepBody muted>{tx('ხმები MEDICARD-მა შექმნა: ბუნების ხმები სინთეზირებულია, მელოდიები — ხელოვნური ინტელექტით.', 'Sounds are made by MEDICARD: nature sounds are synthesised, melodies are made with AI.')}</SleepBody>
      </ScrollView>
      <View pointerEvents="box-none" style={{ position: 'absolute', left: 16, right: 16, bottom: insets.bottom + 12 }}>
        <NowPlayingBar onOpenMixer={() => setMixerOpen(true)} />
      </View>
      <MixerSheet visible={mixerOpen} onClose={() => setMixerOpen(false)} timerOptions={q.data?.config.timerOptions ?? [15, 30, 45, 60, 90, 0]} />
    </View>
  );
}
