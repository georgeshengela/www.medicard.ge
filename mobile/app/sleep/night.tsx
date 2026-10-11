import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Image, Pressable, ScrollView, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Defs, Mask, RadialGradient, Stop } from 'react-native-svg';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { AlarmClock, AudioLines, ChevronDown, MoonStar, Pause, Play, SlidersHorizontal, Sun } from 'lucide-react-native';
import { tx } from '@/i18n/locale';
import { APP_MODAL_OVERLAY, APP_MODAL_PROPS, Modal } from '@/components/ui/appModal';
import { TimePickerSheet } from '@/components/ui/TimePickerSheet';
import { NightSky } from '@/components/sleep/NightSky';
import { GhostButton, MOON, MOON_INK, MoonButton, NightSwitch, ORCHID, SleepBody } from '@/components/sleep/SleepKit';
import { MixerSheet } from '@/components/sleep/SleepSounds';
import { primerCopy } from '@/lib/permissionPrimer';
import { pauseSleepSounds, resumeSleepSounds, useSleepMixer } from '@/lib/sleep/sleepAudio';
import { remoteUrl } from '@/lib/sleep/sleepSoundCache';
import { requestSleepAlarmAccess, sleepAlarmAccess, sleepAlarmIsSystemAlarm } from '@/lib/sleep/sleepAlarm';
import { endSleepMode, setSleepModeAlarm, startSleepMode, useSleepSession } from '@/lib/sleep/sleepSession';
import { clockOf, formatDuration, nextWake, parseHHMM } from '@/lib/sleep/sleepTime';
import { useSleepCatalog, useSleepHub } from '@/lib/sleep/useSleepData';
import type { SleepSound } from '@/lib/sleep/sleepTypes';

const NUM: { fontWeight: '200'; fontVariant: ['tabular-nums']; color: string } = { fontWeight: '200', fontVariant: ['tabular-nums'], color: '#FFFFFF' };

function useClock(stepMs = 15_000): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), stepMs);
    return () => clearInterval(t);
  }, [stepMs]);
  return now;
}

/** The crescent from the reference, lit from the right, with a soft halo. */
function Crescent({ size = 132 }: { size?: number }) {
  const r = size * 0.32;
  const c = size / 2;
  return (
    <Svg width={size} height={size}>
      <Defs>
        <RadialGradient id="halo" cx="50%" cy="50%" r="50%">
          <Stop offset="0.45" stopColor={MOON} stopOpacity={0.28} />
          <Stop offset="1" stopColor={MOON} stopOpacity={0} />
        </RadialGradient>
        <Mask id="crescent">
          <Circle cx={c} cy={c} r={r} fill="#FFFFFF" />
          <Circle cx={c - r * 0.55} cy={c - r * 0.22} r={r * 0.92} fill="#000000" />
        </Mask>
      </Defs>
      <Circle cx={c} cy={c} r={size / 2} fill="url(#halo)" />
      <Circle cx={c} cy={c} r={r} fill={MOON} mask="url(#crescent)" />
    </Svg>
  );
}

function hhmmOf(date: Date) {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

/** The next moment a „HH:MM“ happens. */
function nextAt(hhmm: string, now: Date): Date {
  const m = parseHHMM(hhmm) ?? 7 * 60;
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate(), Math.floor(m / 60), m % 60, 0, 0);
  return d.getTime() > now.getTime() + 60_000 ? d : new Date(d.getTime() + 86_400_000);
}

function AlarmPrimer({ visible, onContinue }: { visible: boolean; onContinue: () => void }) {
  const copy = primerCopy('alarm');
  return (
    <Modal visible={visible} {...APP_MODAL_PROPS} onRequestClose={() => undefined}>
      <View style={{ flex: 1, backgroundColor: APP_MODAL_OVERLAY, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <View style={{ width: '100%', maxWidth: 380, borderRadius: 26, backgroundColor: '#15132E', padding: 22, gap: 14 }}>
          <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: 'rgba(244,227,181,0.16)', alignItems: 'center', justifyContent: 'center' }}>
            <AlarmClock size={26} color={MOON} />
          </View>
          <Text accessibilityRole="header" style={{ fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 19, lineHeight: 27, color: '#FFFFFF' }}>{copy.title}</Text>
          <Text style={{ fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 14, lineHeight: 22, color: '#CFCBE6' }}>{copy.body}</Text>
          <MoonButton label={copy.cta} onPress={onContinue} />
        </View>
      </View>
    </Modal>
  );
}

/** Pick up to N sounds for the night (a compact list with art). */
function SoundPickerSheet({ visible, sounds, selected, max, onToggle, onClose }: {
  visible: boolean; sounds: SleepSound[]; selected: string[]; max: number; onToggle: (id: string) => void; onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} {...APP_MODAL_PROPS} onRequestClose={onClose}>
      <Pressable accessibilityRole="button" accessibilityLabel={tx('დახურვა', 'Close')} onPress={onClose} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: APP_MODAL_OVERLAY }} />
      <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, maxHeight: '80%', backgroundColor: '#15132E', borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingTop: 12, paddingBottom: insets.bottom + 16 }}>
        <View style={{ alignSelf: 'center', width: 40, height: 5, borderRadius: 3, backgroundColor: '#2C2852', marginBottom: 10 }} />
        <Text style={{ paddingHorizontal: 20, fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 18, color: '#FFFFFF' }}>{tx('ხმები ამ ღამისთვის', 'Sounds for tonight')}</Text>
        <Text style={{ paddingHorizontal: 20, marginTop: 2, marginBottom: 10, fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 12, color: '#8B86AE' }}>
          {tx(`ერთად მაქსიმუმ ${max}`, `Up to ${max} together`)}
        </Text>
        <ScrollView contentContainerStyle={{ paddingHorizontal: 16, gap: 6 }}>
          {sounds.map((s) => {
            const on = selected.includes(s.id);
            const full = !on && selected.length >= max;
            return (
              <Pressable
                key={s.id}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: on, disabled: full }}
                disabled={full}
                onPress={() => onToggle(s.id)}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 8, borderRadius: 16, backgroundColor: on ? 'rgba(244,227,181,0.12)' : 'transparent', opacity: full ? 0.4 : 1 }}
              >
                <View style={{ width: 46, height: 46, borderRadius: 12, overflow: 'hidden', backgroundColor: s.tint }}>
                  {s.art ? <Image source={{ uri: remoteUrl(s.art) }} style={{ width: '100%', height: '100%' }} /> : null}
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text numberOfLines={1} style={{ fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 14, color: '#FFFFFF' }}>{s.title}</Text>
                  <Text numberOfLines={1} style={{ fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 12, color: '#8B86AE' }}>{s.subtitle}</Text>
                </View>
                <View style={{ width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: on ? MOON : '#2C2852', backgroundColor: on ? MOON : 'transparent' }} />
              </Pressable>
            );
          })}
        </ScrollView>
        <View style={{ paddingHorizontal: 20, paddingTop: 12 }}>
          <MoonButton label={tx('მზადაა', 'Done')} onPress={onClose} />
        </View>
      </View>
    </Modal>
  );
}

export default function SleepNightScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ wake?: string }>();
  const session = useSleepSession();
  const mixer = useSleepMixer();
  const hub = useSleepHub().data;
  const catalog = useSleepCatalog().data;
  const now = useClock();
  const plan = hub?.plan ?? hub?.suggested.plan ?? null;
  const config = hub?.config ?? catalog?.config;
  const sounds = catalog?.sounds ?? [];

  // ---- setup state (before sleep mode starts)
  const [alarmOn, setAlarmOn] = useState<boolean>(plan?.alarm ?? true);
  const [alarmTime, setAlarmTime] = useState<string>(() => (plan ? hhmmOf(nextWake(plan, new Date())) : '07:00'));
  const [picked, setPicked] = useState<string[]>([]);
  const [timer, setTimer] = useState<number>(config?.defaultTimerMinutes ?? 45);
  const [timeSheet, setTimeSheet] = useState(false);
  const [soundSheet, setSoundSheet] = useState(false);
  const [mixerOpen, setMixerOpen] = useState(false);
  const [primer, setPrimer] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [dim, setDim] = useState(false);
  const idle = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoWake = useRef(false);

  useEffect(() => {
    if (plan) setAlarmTime(hhmmOf(nextWake(plan, new Date())));
    if (plan) setAlarmOn(plan.alarm);
  }, [plan?.wakeTime, plan?.weekendWakeTime, plan?.alarm]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (config) setTimer(config.defaultTimerMinutes);
  }, [config?.defaultTimerMinutes]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    // Already playing sounds join the night by default.
    if (!session && mixer.layers.length && !picked.length) setPicked(mixer.layers.map((l) => l.soundId));
  }, [session]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---- running: dim the screen after 20 s without a touch
  const poke = () => {
    setDim(false);
    if (idle.current) clearTimeout(idle.current);
    if (session) idle.current = setTimeout(() => setDim(true), 20_000);
  };
  useEffect(() => {
    poke();
    return () => {
      if (idle.current) clearTimeout(idle.current);
    };
  }, [session?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const finish = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const result = await endSleepMode();
      if (!result) {
        router.dismissTo('/sleep' as never);
        return;
      }
      if (result.tooShort) {
        setNote(tx('ძილის რეჟიმი 20 წუთზე ნაკლები იყო, ამიტომ ღამე არ ჩავწერე.', 'Sleep mode ran for less than 20 minutes, so no night was saved.'));
        setTimeout(() => router.dismissTo('/sleep' as never), 1800);
        return;
      }
      router.replace(`/sleep/checkin?night=${result.night}&fromMode=1${result.saved ? '' : '&offline=1'}` as never);
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (params.wake === '1' && session && !autoWake.current) {
      autoWake.current = true;
      void finish();
    }
  }, [params.wake, session?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const start = async (skipPrimer = false) => {
    if (busy) return;
    if (alarmOn && !skipPrimer) {
      const access = await sleepAlarmAccess();
      if (access === 'ask') {
        setPrimer(true);
        return;
      }
    }
    setBusy(true);
    try {
      const chosen = sounds.filter((s) => picked.includes(s.id));
      const next = await startSleepMode({ alarmAt: alarmOn ? nextAt(alarmTime, new Date()) : null, sounds: chosen, timerMinutes: timer });
      if (alarmOn && next && !next.alarm) {
        setNote(tx('მაღვიძარა ვერ დავაყენე — ჩართე შეტყობინებები პარამეტრებში.', 'The alarm could not be set — turn on notifications in Settings.'));
      }
    } finally {
      setBusy(false);
    }
  };

  const alarmHint = useMemo(() => {
    if (!alarmOn) return tx('მაღვიძარა გამორთულია', 'No alarm');
    return sleepAlarmIsSystemAlarm()
      ? tx('iPhone-ის მაღვიძარა: რეკავს ჩუმ რეჟიმშიც', 'An iPhone alarm: rings even in silent mode')
      : tx('შეტყობინება ხმით — ტელეფონის ხმის პარამეტრებით', 'A notification with sound — follows your phone sound settings');
  }, [alarmOn]);

  const playing = mixer.phase === 'playing' || mixer.phase === 'loading';
  const max = config?.maxLayers ?? 3;
  const timerOptions = config?.timerOptions ?? [15, 30, 45, 60, 90, 0];

  return (
    <View style={{ flex: 1, backgroundColor: '#0B0A1F' }} onTouchStart={poke}>
      <NightSky colors={['#0A0722', '#1A1046', '#2E1760']} glowAt={{ x: 0.5, y: 0.2 }} stars={70} twinkles={9} seed={3} />
      <ScrollView contentContainerStyle={{ flexGrow: 1, paddingTop: insets.top + 8, paddingBottom: insets.bottom + 20, paddingHorizontal: 22 }} scrollEnabled={!session}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={session ? tx('ჰაბში დაბრუნება (რეჟიმი გაგრძელდება)', 'Back to the hub (sleep mode keeps running)') : tx('დახურვა', 'Close')}
            onPress={() => (router.canGoBack() ? router.back() : router.dismissTo('/sleep' as never))}
            hitSlop={10}
            style={{ width: 44, height: 44, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' }}
          >
            <ChevronDown size={22} color="#FFFFFF" />
          </Pressable>
          {session ? (
            <Text style={{ fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 13, color: 'rgba(255,255,255,0.7)' }}>
              {tx(`ძილის რეჟიმში · ${formatDuration(Math.round((now.getTime() - session.startedAt) / 60_000))}`, `In sleep mode · ${formatDuration(Math.round((now.getTime() - session.startedAt) / 60_000))}`)}
            </Text>
          ) : null}
          <View style={{ width: 44 }} />
        </View>

        <View style={{ alignItems: 'center', marginTop: 8 }}>
          <Crescent size={session ? 150 : 118} />
          <Text accessibilityRole="header" style={{ fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 26, lineHeight: 34, color: '#FFFFFF', marginTop: -6 }}>
            {session ? tx('ტკბილი ძილი', 'Sleep well') : tx('მზად ხარ ძილისთვის?', 'Ready for bed?')}
          </Text>
          <Text style={{ ...NUM, fontSize: session ? 76 : 56, lineHeight: session ? 86 : 64, marginTop: 4 }}>{clockOf(now)}</Text>
        </View>

        {session ? (
          <View style={{ flex: 1, justifyContent: 'flex-end', gap: 14, marginTop: 18 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 10, flexWrap: 'wrap' }}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={tx('მაღვიძარის შეცვლა', 'Change the alarm')}
                onPress={() => setTimeSheet(true)}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 8, height: 40, paddingHorizontal: 16, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.1)' }}
              >
                <AlarmClock size={16} color={MOON} />
                <Text style={{ fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 14, color: '#FFFFFF' }}>
                  {session.alarmAt ? clockOf(new Date(session.alarmAt)) : tx('მაღვიძარის გარეშე', 'No alarm')}
                </Text>
              </Pressable>
              {mixer.phase !== 'idle' ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={tx('ხმის მიქსერი', 'Sound mixer')}
                  onPress={() => setMixerOpen(true)}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 8, height: 40, paddingHorizontal: 16, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.1)', maxWidth: 260 }}
                >
                  <AudioLines size={16} color={ORCHID} />
                  <Text numberOfLines={1} style={{ flexShrink: 1, fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 14, color: '#FFFFFF' }}>
                    {mixer.layers.map((l) => l.title).join(' · ')}
                  </Text>
                </Pressable>
              ) : (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setSoundSheet(true)}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 8, height: 40, paddingHorizontal: 16, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.1)' }}
                >
                  <AudioLines size={16} color={ORCHID} />
                  <Text style={{ fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 14, color: '#FFFFFF' }}>{tx('ხმის ჩართვა', 'Play a sound')}</Text>
                </Pressable>
              )}
            </View>
            {mixer.phase !== 'idle' ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
                <Text style={{ fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 13, color: 'rgba(255,255,255,0.65)' }}>
                  {mixer.endsAt ? tx(`ხმა ჩაქრება ${clockOf(new Date(mixer.endsAt))}-ზე`, `Sound fades out at ${clockOf(new Date(mixer.endsAt))}`) : tx('ხმა უკრავს, სანამ არ გამორთავ', 'Sound plays until you stop it')}
                </Text>
                <Pressable accessibilityRole="button" accessibilityLabel={playing ? tx('პაუზა', 'Pause') : tx('გაგრძელება', 'Play')} onPress={() => (playing ? pauseSleepSounds() : resumeSleepSounds())} hitSlop={10}>
                  {playing ? <Pause size={18} color="#FFFFFF" /> : <Play size={18} color="#FFFFFF" />}
                </Pressable>
              </View>
            ) : null}
            <View style={{ height: 12 }} />
            {note ? <Text style={{ textAlign: 'center', fontFamily: 'NotoSansGeorgian_500Medium', fontSize: 13, lineHeight: 19, color: MOON }}>{note}</Text> : null}
            <MoonButton label={tx('დილა მშვიდობისა', 'Good morning')} icon={Sun} onPress={() => void finish()} loading={busy} />
            {confirmCancel ? (
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <GhostButton
                  label={tx('ღამე არ ჩაიწეროს', "Don't save the night")}
                  compact
                  style={{ flex: 1 }}
                  onPress={() => {
                    void endSleepMode({ save: false }).then(() => router.dismissTo('/sleep' as never));
                  }}
                />
                <GhostButton label={tx('უკან', 'Back')} compact onPress={() => setConfirmCancel(false)} />
              </View>
            ) : (
              <Pressable accessibilityRole="button" onPress={() => setConfirmCancel(true)} style={{ alignSelf: 'center', paddingVertical: 8 }}>
                <Text style={{ fontFamily: 'NotoSansGeorgian_500Medium', fontSize: 13, color: 'rgba(255,255,255,0.55)' }}>{tx('რეჟიმის გაუქმება', 'Cancel sleep mode')}</Text>
              </Pressable>
            )}
          </View>
        ) : (
          <View style={{ gap: 14, marginTop: 18 }}>
            <View style={{ borderRadius: 22, backgroundColor: 'rgba(21,19,46,0.78)', padding: 16, gap: 10 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <AlarmClock size={20} color={MOON} />
                <Pressable accessibilityRole="button" accessibilityLabel={tx('მაღვიძარის დრო', 'Alarm time')} onPress={() => setTimeSheet(true)} disabled={!alarmOn} style={{ flex: 1 }}>
                  <Text style={{ ...NUM, fontSize: 30, lineHeight: 36, opacity: alarmOn ? 1 : 0.4 }}>{alarmTime}</Text>
                </Pressable>
                <NightSwitch value={alarmOn} onValueChange={setAlarmOn} accessibilityLabel={tx('მაღვიძარა', 'Alarm')} />
              </View>
              <SleepBody muted>{alarmHint}</SleepBody>
            </View>
            <View style={{ borderRadius: 22, backgroundColor: 'rgba(21,19,46,0.78)', padding: 16, gap: 12 }}>
              <Pressable accessibilityRole="button" onPress={() => setSoundSheet(true)} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <AudioLines size={20} color={ORCHID} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text numberOfLines={1} style={{ fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 15, color: '#FFFFFF' }}>
                    {picked.length ? sounds.filter((s) => picked.includes(s.id)).map((s) => s.title).join(' · ') : tx('ხმის გარეშე', 'No sound')}
                  </Text>
                  <Text style={{ fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 12, color: '#8B86AE' }}>{tx('შეეხე, რომ აირჩიო', 'Tap to choose')}</Text>
                </View>
                <SlidersHorizontal size={18} color="#8B86AE" />
              </Pressable>
              {picked.length ? (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {timerOptions.map((m) => (
                    <Pressable
                      key={m}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: timer === m }}
                      onPress={() => setTimer(m)}
                      style={{ height: 36, paddingHorizontal: 12, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: timer === m ? MOON : 'rgba(255,255,255,0.08)' }}
                    >
                      <Text style={{ fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 12, color: timer === m ? MOON_INK : '#FFFFFF' }}>{m === 0 ? tx('მთელი ღამე', 'All night') : formatDuration(m)}</Text>
                    </Pressable>
                  ))}
                </View>
              ) : null}
            </View>
            {note ? <Text style={{ textAlign: 'center', fontFamily: 'NotoSansGeorgian_500Medium', fontSize: 13, color: MOON }}>{note}</Text> : null}
            <MoonButton label={tx('ღამე მშვიდობისა', 'Good night')} icon={MoonStar} onPress={() => void start()} loading={busy} />
            <SleepBody muted>
              {tx('ტელეფონი დადე ეკრანით ქვემოთ. დილით შეეხე „დილა მშვიდობისა“-ს — ღამე ჩაიწერება და Apple Health / Health Connect-ის მონაცემებით დაზუსტდება.', 'Put the phone face down. In the morning tap “Good morning” — the night is saved and refined with Apple Health / Health Connect data.')}
            </SleepBody>
          </View>
        )}
      </ScrollView>

      {session && dim ? (
        <Animated.View entering={FadeIn.duration(1200)} exiting={FadeOut.duration(200)} pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(3,2,10,0.62)' }} />
      ) : null}

      <TimePickerSheet
        visible={timeSheet}
        title={tx('მაღვიძარა', 'Alarm')}
        subtitle={tx('გაღვიძების დრო', 'Wake-up time')}
        value={session?.alarmAt ? clockOf(new Date(session.alarmAt)) : alarmTime}
        fill="#9A4FD6"
        quickTimes={['06:00', '06:30', '07:00', '07:30', '08:00', '09:00']}
        onClose={() => setTimeSheet(false)}
        onApply={(time) => {
          setTimeSheet(false);
          if (session) void setSleepModeAlarm(nextAt(time, new Date()));
          else {
            setAlarmTime(time);
            setAlarmOn(true);
          }
        }}
      />
      <SoundPickerSheet
        visible={soundSheet}
        sounds={sounds}
        selected={session ? mixer.layers.map((l) => l.soundId) : picked}
        max={max}
        onToggle={(id) => {
          if (session) {
            const sound = sounds.find((s) => s.id === id);
            if (sound) void import('@/lib/sleep/sleepAudio').then((m) => m.toggleSleepSound(sound)).then(() => import('@/lib/sleep/sleepSession')).then((s) => s.noteSleepModeSounds());
            return;
          }
          setPicked((list) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id].slice(0, max)));
        }}
        onClose={() => setSoundSheet(false)}
      />
      <MixerSheet visible={mixerOpen} onClose={() => setMixerOpen(false)} timerOptions={timerOptions} />
      <AlarmPrimer
        visible={primer}
        onContinue={() => {
          setPrimer(false);
          // The system sheet comes from this tap (OS permission rule); start right after her answer.
          void requestSleepAlarmAccess().then(() => start(true));
        }}
      />
    </View>
  );
}
