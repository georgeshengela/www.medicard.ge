import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { Check, Pause, Play, Plus, Timer, Volume1, X } from 'lucide-react-native';
import { tx } from '@/i18n/locale';
import { APP_MODAL_OVERLAY, APP_MODAL_PROPS, Modal } from '@/components/ui/appModal';
import {
  clearMixerError, mixerMaxLayers, pauseSleepSounds, resumeSleepSounds, setLayerVolume, setMasterVolume, setMixerTimer,
  stopSleepSounds, toggleSleepSound, useSleepMixer, type MixerState,
} from '@/lib/sleep/sleepAudio';
import { onDownloadProgress, remoteUrl } from '@/lib/sleep/sleepSoundCache';
import { clockOf, formatDuration } from '@/lib/sleep/sleepTime';
import type { SleepSound } from '@/lib/sleep/sleepTypes';
import { useThemeColors } from '@/theme/colors';
import { MOON, MOON_INK, ORCHID } from './SleepKit';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/** Art card for one sound (the reference's „Discover“ tiles): cover art, title on a soft scrim, play state. */
export function SoundCard({ sound, width = 148, height = 196, style }: { sound: SleepSound; width?: number; height?: number; style?: StyleProp<ViewStyle> }) {
  const mixer = useSleepMixer();
  const layer = mixer.layers.find((l) => l.soundId === sound.id);
  const on = Boolean(layer);
  const [progress, setProgress] = useState(0);
  useEffect(() => (sound.audio ? onDownloadProgress(sound.audio.id, setProgress) : undefined), [sound.audio]);
  const loading = layer?.loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: on, busy: !!loading }}
      accessibilityLabel={`${sound.title}. ${sound.subtitle}`}
      accessibilityHint={on ? tx('შეეხე, რომ გამორთო', 'Tap to turn it off') : tx('შეეხე, რომ ჩართო', 'Tap to play')}
      onPress={() => void toggleSleepSound(sound)}
      style={[{ width, height, borderRadius: 20, overflow: 'hidden', backgroundColor: sound.tint }, style]}
    >
      {sound.art ? <Image source={{ uri: remoteUrl(sound.art) }} style={{ position: 'absolute', width: '100%', height: '100%' }} resizeMode="cover" /> : null}
      <LinearGradient colors={['rgba(11,10,31,0)', 'rgba(11,10,31,0.25)', 'rgba(11,10,31,0.92)']} locations={[0, 0.45, 1]} style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: '70%' }} />
      {on ? <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: 20, borderWidth: 2, borderColor: MOON }} /> : null}
      <View style={{ position: 'absolute', top: 10, right: 10, width: 32, height: 32, borderRadius: 16, backgroundColor: on ? MOON : 'rgba(11,10,31,0.55)', alignItems: 'center', justifyContent: 'center' }}>
        {loading ? <ActivityIndicator size="small" color={on ? MOON_INK : '#FFFFFF'} /> : on ? <Check size={16} color={MOON_INK} /> : <Play size={14} color="#FFFFFF" fill="#FFFFFF" />}
      </View>
      {loading && progress > 0 && progress < 1 ? (
        <View style={{ position: 'absolute', top: 0, left: 0, height: 3, width: `${progress * 100}%`, backgroundColor: MOON }} />
      ) : null}
      <View style={{ position: 'absolute', left: 12, right: 12, bottom: 12, gap: 2 }}>
        <Text numberOfLines={2} style={{ fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 14, lineHeight: 19, color: '#FFFFFF' }}>{sound.title}</Text>
        <Text numberOfLines={1} style={{ fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 11, lineHeight: 15, color: 'rgba(255,255,255,0.72)' }}>{sound.subtitle}</Text>
      </View>
    </Pressable>
  );
}

function timerLine(m: MixerState): string {
  if (m.phase === 'paused') return tx('პაუზაზეა', 'Paused');
  if (m.phase === 'loading') return tx('იტვირთება…', 'Loading…');
  if (m.endsAt) return tx(`ჩაქრება ${clockOf(new Date(m.endsAt))}-ზე`, `Fades out at ${clockOf(new Date(m.endsAt))}`);
  return tx('უკრავს, სანამ არ გამორთავ', 'Plays until you stop it');
}

/** The mini player: what plays, when it fades out, play/pause, open the mixer. Hidden while nothing plays. */
export function NowPlayingBar({ onOpenMixer, style }: { onOpenMixer: () => void; style?: StyleProp<ViewStyle> }) {
  const c = useThemeColors();
  const m = useSleepMixer();
  if (m.phase === 'idle') return null;
  const playing = m.phase === 'playing' || m.phase === 'loading';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={tx('ხმის მიქსერი', 'Sound mixer')}
      onPress={onOpenMixer}
      style={[{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10, paddingRight: 12, borderRadius: 22, backgroundColor: c.surfaceRaised }, style]}
    >
      <View style={{ flexDirection: 'row' }}>
        {m.layers.slice(0, 3).map((l, i) => (
          <View key={l.soundId} style={{ width: 40, height: 40, borderRadius: 12, overflow: 'hidden', marginLeft: i ? -14 : 0, borderWidth: 2, borderColor: c.surfaceRaised, backgroundColor: l.tint }}>
            {l.art ? <Image source={{ uri: l.art }} style={{ width: '100%', height: '100%' }} /> : null}
          </View>
        ))}
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text numberOfLines={1} style={{ fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 14, lineHeight: 20, color: c.text100 }}>{m.layers.map((l) => l.title).join(' · ')}</Text>
        <Text numberOfLines={1} style={{ fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 12, lineHeight: 17, color: c.text300 }}>{timerLine(m)}</Text>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={playing ? tx('პაუზა', 'Pause') : tx('გაგრძელება', 'Play')}
        hitSlop={8}
        onPress={() => (playing ? pauseSleepSounds() : resumeSleepSounds())}
        style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: MOON, alignItems: 'center', justifyContent: 'center' }}
      >
        {playing ? <Pause size={18} color={MOON_INK} fill={MOON_INK} /> : <Play size={18} color={MOON_INK} fill={MOON_INK} />}
      </Pressable>
    </Pressable>
  );
}

/** A thin slider for volumes (drag or tap anywhere on the track). */
export function NightSlider({ value, onChange, label }: { value: number; onChange: (v: number) => void; label: string }) {
  const [width, setWidth] = useState(0);
  const set = (x: number) => width > 0 && onChange(Math.max(0, Math.min(1, x / width)));
  const pan = Gesture.Pan().runOnJS(true).minDistance(0).onBegin((e) => set(e.x)).onUpdate((e) => set(e.x));
  return (
    <GestureDetector gesture={pan}>
      <View
        onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel={label}
        accessibilityValue={{ min: 0, max: 100, now: Math.round(value * 100) }}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        onAccessibilityAction={(e) => onChange(Math.max(0, Math.min(1, value + (e.nativeEvent.actionName === 'increment' ? 0.1 : -0.1))))}
        style={{ height: 32, justifyContent: 'center' }}
      >
        <View style={{ height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.12)' }}>
          <View style={{ width: `${value * 100}%`, height: 6, borderRadius: 3, backgroundColor: ORCHID }} />
        </View>
        <View style={{ position: 'absolute', left: Math.max(0, value * width - 11), width: 22, height: 22, borderRadius: 11, backgroundColor: MOON }} />
      </View>
    </GestureDetector>
  );
}

/** The mixer sheet: each layer's volume, the timer, stop. */
export function MixerSheet({ visible, onClose, timerOptions, onAddSounds }: { visible: boolean; onClose: () => void; timerOptions: number[]; onAddSounds?: () => void }) {
  const c = useThemeColors();
  const insets = useSafeAreaInsets();
  const m = useSleepMixer();
  const remaining = m.endsAt ? Math.max(0, Math.round((m.endsAt - Date.now()) / 60_000)) : null;
  return (
    <Modal visible={visible} {...APP_MODAL_PROPS} onRequestClose={onClose}>
      <Pressable accessibilityRole="button" accessibilityLabel={tx('დახურვა', 'Close')} onPress={onClose} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: APP_MODAL_OVERLAY }} />
      <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: c.surface, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingTop: 10, paddingBottom: insets.bottom + 18, maxHeight: '86%' }}>
        <View style={{ alignSelf: 'center', width: 40, height: 5, borderRadius: 3, backgroundColor: c.bg300, marginBottom: 10 }} />
        <ScrollView contentContainerStyle={{ paddingHorizontal: 20, gap: 18 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text accessibilityRole="header" style={{ fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 18, lineHeight: 26, color: c.text100 }}>{tx('მიქსერი', 'Mixer')}</Text>
            <Pressable accessibilityRole="button" accessibilityLabel={tx('დახურვა', 'Close')} onPress={onClose} hitSlop={10} style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: c.surfaceRaised, alignItems: 'center', justifyContent: 'center' }}>
              <X size={18} color={c.text100} />
            </Pressable>
          </View>
          {m.error ? (
            <Pressable onPress={clearMixerError} style={{ padding: 12, borderRadius: 14, backgroundColor: 'rgba(244,227,181,0.12)' }}>
              <Text style={{ fontFamily: 'NotoSansGeorgian_500Medium', fontSize: 13, lineHeight: 19, color: MOON }}>{m.error}</Text>
            </Pressable>
          ) : null}
          {m.layers.length ? (
            <View style={{ gap: 14 }}>
              {m.layers.map((l) => (
                <View key={l.soundId} style={{ gap: 4 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <View style={{ width: 34, height: 34, borderRadius: 10, overflow: 'hidden', backgroundColor: l.tint }}>
                      {l.art ? <Image source={{ uri: l.art }} style={{ width: '100%', height: '100%' }} /> : null}
                    </View>
                    <Text numberOfLines={1} style={{ flex: 1, fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 14, color: c.text100 }}>{l.title}</Text>
                    {l.loading ? <ActivityIndicator size="small" color={ORCHID} /> : null}
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={tx(`${l.title}: მოხსნა`, `Remove ${l.title}`)}
                      hitSlop={8}
                      onPress={() => void stopOrRemove(l.soundId, m)}
                      style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: c.surfaceRaised, alignItems: 'center', justifyContent: 'center' }}
                    >
                      <X size={15} color={c.text200} />
                    </Pressable>
                  </View>
                  <NightSlider value={l.volume} onChange={(v) => setLayerVolume(l.soundId, v)} label={tx(`${l.title}: ხმის სიძლიერე`, `${l.title} volume`)} />
                </View>
              ))}
              {m.layers.length < mixerMaxLayers() && onAddSounds ? (
                <Pressable accessibilityRole="button" onPress={onAddSounds} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start', paddingVertical: 6 }}>
                  <Plus size={16} color={ORCHID} />
                  <Text style={{ fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 13, color: ORCHID }}>{tx('კიდევ ერთი ხმის დამატება', 'Add another sound')}</Text>
                </Pressable>
              ) : null}
              <View style={{ gap: 4 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Volume1 size={16} color={c.text200} />
                  <Text style={{ fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 13, color: c.text200 }}>{tx('საერთო ხმა', 'Overall volume')}</Text>
                </View>
                <NightSlider value={m.master} onChange={setMasterVolume} label={tx('საერთო ხმა', 'Overall volume')} />
              </View>
            </View>
          ) : (
            <Text style={{ fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 14, lineHeight: 21, color: c.text200 }}>
              {tx('ჯერ არაფერი უკრავს. აირჩიე ხმა და აქ მისი ხმის სიძლიერეს და ტაიმერს დააყენებ.', 'Nothing is playing yet. Pick a sound, then set its volume and timer here.')}
            </Text>
          )}
          <View style={{ gap: 10 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Timer size={16} color={c.text200} />
              <Text style={{ fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 13, color: c.text200 }}>{tx('ტაიმერი', 'Timer')}</Text>
              {remaining != null ? <Text style={{ marginLeft: 'auto', fontFamily: 'NotoSansGeorgian_500Medium', fontSize: 12, color: c.text300 }}>{tx(`დარჩა ${formatDuration(remaining)}`, `${formatDuration(remaining)} left`)}</Text> : null}
            </View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {timerOptions.map((minutes) => {
                const selected = m.timerMinutes === minutes;
                return (
                  <Pressable
                    key={minutes}
                    accessibilityRole="radio"
                    accessibilityState={{ selected }}
                    onPress={() => setMixerTimer(minutes)}
                    style={{ height: 40, minWidth: 64, paddingHorizontal: 14, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: selected ? MOON : c.surfaceRaised }}
                  >
                    <Text style={{ fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 13, color: selected ? MOON_INK : c.text100 }}>
                      {minutes === 0 ? tx('მთელი ღამე', 'All night') : formatDuration(minutes)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <Text style={{ fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 12, lineHeight: 18, color: c.text300 }}>
              {tx('ბოლოს ხმა ნელ-ნელა ჩაქრება. ძილს საკმარისია 30–60 წუთი — მთელი ღამე ჩართული ხმა საჭირო არ არის.', 'At the end the sound fades out slowly. 30–60 minutes is enough to fall asleep — sound all night is not needed.')}
            </Text>
          </View>
          {m.phase !== 'idle' ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                void stopSleepSounds({ reason: 'user' });
                onClose();
              }}
              style={{ height: 50, borderRadius: 25, borderWidth: 1, borderColor: c.bg300, alignItems: 'center', justifyContent: 'center' }}
            >
              <Text style={{ fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 14, color: c.text100 }}>{tx('ხმის გამორთვა', 'Stop the sound')}</Text>
            </Pressable>
          ) : null}
        </ScrollView>
      </View>
    </Modal>
  );
}

async function stopOrRemove(soundId: string, m: MixerState) {
  const layer = m.layers.find((l) => l.soundId === soundId);
  if (!layer) return;
  if (m.layers.length === 1) {
    await stopSleepSounds({ reason: 'user' });
    return;
  }
  // toggleSleepSound needs the sound object only for adding; removing works by id.
  await toggleSleepSound({ id: soundId } as SleepSound);
}

export const SOUND_ACCENT = { MOON, ORCHID, MOON_INK };
