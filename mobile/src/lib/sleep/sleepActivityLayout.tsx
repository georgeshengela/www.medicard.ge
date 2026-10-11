/**
 * MEDISLEEP Live Activity (iOS lock screen + Dynamic Island) while sleep mode runs, rendered by expo-widgets.
 *
 * Same rules as the MEDIRUN one (src/lib/run/runActivityLayout.tsx): the layout is serialised at build time
 * (`'widget'` directive) and runs in the widget extension's own JS runtime — only its arguments and
 * `@expo/ui/swift-ui` components, every text in props in the app's language. Required lazily, iOS only
 * (sleepActivity.ts). The lock screen shows how long she has been in bed (a ticking clock), the alarm, the sound
 * and its fade-out time, a pause/play for the sound and „ვიღვიძებ“, which opens the app to end the night.
 */
import { Button, Circle, HStack, Image, Link, Spacer, Text, VStack, ZStack } from '@expo/ui/swift-ui';
import {
  accessibilityLabel,
  activityBackgroundTint,
  buttonStyle,
  font,
  foregroundStyle,
  frame,
  lineLimit,
  monospacedDigit,
  multilineTextAlignment,
  padding,
} from '@expo/ui/swift-ui/modifiers';
import { createLiveActivity, type LiveActivityEnvironment } from 'expo-widgets';

export type SleepActivityProps = {
  /** Sleep mode start (epoch ms): the clock counts up from here on its own. */
  startedAt: number;
  title: string;
  elapsedLabel: string;
  /** „07:15“ or empty when no alarm is set. */
  alarm: string;
  alarmLabel: string;
  /** Sound names („წვიმა · ზღვა“) or empty. */
  sound: string;
  /** „ჩაქრება 23:45-ზე“ / „უკრავს“ / „პაუზაზე“. */
  soundNote: string;
  soundPlaying: boolean;
  pauseLabel: string;
  playLabel: string;
  wakeLabel: string;
  wakeUrl: string;
  staleText: string;
};

const SleepActivity = (props: SleepActivityProps, environment: LiveActivityEnvironment) => {
  'widget';
  const ORCHID = '#D9A8FF';
  const MOON = '#F4E3B5';
  const MUTED = '#FFFFFF99';
  const stale = environment.isStale === true;
  const start = new Date(props.startedAt);
  const end = new Date(props.startedAt + 24 * 3600 * 1000);
  const hasSound = props.sound.length > 0;
  const hasAlarm = props.alarm.length > 0;

  const Clock = ({ size, color, align }: { size: number; color: string; align: 'leading' | 'trailing' }) =>
    stale ? (
      <Text modifiers={[font({ size, weight: 'semibold', design: 'rounded' }), foregroundStyle(color), lineLimit(1)]}>{props.staleText}</Text>
    ) : (
      <Text
        timerInterval={{ lower: start, upper: end }}
        countsDown={false}
        modifiers={[
          font({ size, weight: 'semibold', design: 'rounded' }),
          monospacedDigit(),
          foregroundStyle(color),
          multilineTextAlignment(align),
          // A live timer takes all the width it is offered; hours are always shown, so size for h:mm:ss.
          frame({ width: Math.ceil(size * 4.6), alignment: align }),
        ]}
      />
    );

  const Caption = ({ text, color }: { text: string; color?: string }) => (
    <Text modifiers={[font({ size: 11, weight: 'medium' }), foregroundStyle(color ?? MUTED), lineLimit(1)]}>{text}</Text>
  );

  const SoundButton = ({ size }: { size: number }) => (
    <Button target="sound" modifiers={[buttonStyle('plain'), accessibilityLabel(props.soundPlaying ? props.pauseLabel : props.playLabel)]}>
      <ZStack>
        <Circle modifiers={[foregroundStyle('#FFFFFF26'), frame({ width: size, height: size })]} />
        <Image systemName={props.soundPlaying ? 'pause.fill' : 'play.fill'} size={Math.round(size * 0.38)} color="#FFFFFF" />
      </ZStack>
    </Button>
  );

  const WakeButton = ({ size }: { size: number }) => (
    <Link destination={props.wakeUrl} modifiers={[accessibilityLabel(props.wakeLabel)]}>
      <ZStack>
        <Circle modifiers={[foregroundStyle(MOON), frame({ width: size, height: size })]} />
        <Image systemName="sun.max.fill" size={Math.round(size * 0.42)} color="#1B1145" />
      </ZStack>
    </Link>
  );

  return {
    banner: (
      <VStack
        alignment="leading"
        spacing={10}
        modifiers={[activityBackgroundTint('#0E0B24'), frame({ maxWidth: Infinity, alignment: 'leading' }), padding({ all: 16 })]}>
        <HStack spacing={8}>
          <ZStack>
            <Circle modifiers={[foregroundStyle(ORCHID + '33'), frame({ width: 26, height: 26 })]} />
            <Image systemName="moon.stars.fill" size={13} color={MOON} />
          </ZStack>
          <HStack spacing={0}>
            <Text modifiers={[font({ size: 15, weight: 'heavy' }), foregroundStyle('#FFFFFF')]}>MEDI</Text>
            <Text modifiers={[font({ size: 15, weight: 'heavy' }), foregroundStyle(ORCHID)]}>SLEEP</Text>
          </HStack>
          <Spacer />
          <Text modifiers={[font({ size: 12, weight: 'semibold' }), foregroundStyle(ORCHID), lineLimit(1)]}>{props.title}</Text>
        </HStack>
        <HStack alignment="center" spacing={16}>
          <VStack alignment="leading" spacing={1}>
            <Clock size={24} color="#FFFFFF" align="leading" />
            <Caption text={props.elapsedLabel} />
          </VStack>
          {hasAlarm ? (
            <VStack alignment="leading" spacing={1}>
              <HStack spacing={4}>
                <Image systemName="alarm.fill" size={12} color={MOON} />
                <Text modifiers={[font({ size: 20, weight: 'semibold', design: 'rounded' }), monospacedDigit(), foregroundStyle(MOON)]}>{props.alarm}</Text>
              </HStack>
              <Caption text={props.alarmLabel} />
            </VStack>
          ) : null}
          <Spacer />
          {hasSound ? <SoundButton size={38} /> : null}
          <WakeButton size={38} />
        </HStack>
        {hasSound ? (
          <HStack spacing={6}>
            <Image systemName="waveform" size={11} color={ORCHID} />
            <Text modifiers={[font({ size: 12, weight: 'semibold' }), foregroundStyle('#FFFFFF'), lineLimit(1)]}>{props.sound}</Text>
            <Caption text={props.soundNote} />
          </HStack>
        ) : null}
      </VStack>
    ),
    compactLeading: <Image systemName="moon.stars.fill" size={15} color={MOON} modifiers={[padding({ leading: 4 })]} />,
    compactTrailing: hasAlarm ? (
      <Text modifiers={[font({ size: 14, weight: 'semibold', design: 'rounded' }), monospacedDigit(), foregroundStyle(ORCHID)]}>{props.alarm}</Text>
    ) : (
      <Clock size={14} color={ORCHID} align="trailing" />
    ),
    minimal: <Image systemName="moon.stars.fill" size={14} color={MOON} />,
    expandedLeading: (
      <VStack alignment="leading" spacing={1} modifiers={[padding({ leading: 6 })]}>
        <Clock size={22} color="#FFFFFF" align="leading" />
        <Caption text={props.elapsedLabel} />
      </VStack>
    ),
    expandedTrailing: hasAlarm ? (
      <VStack alignment="trailing" spacing={1} modifiers={[padding({ trailing: 6 })]}>
        <Text modifiers={[font({ size: 22, weight: 'semibold', design: 'rounded' }), monospacedDigit(), foregroundStyle(MOON)]}>{props.alarm}</Text>
        <Caption text={props.alarmLabel} />
      </VStack>
    ) : (
      <Image systemName="moon.zzz.fill" size={20} color={ORCHID} modifiers={[padding({ trailing: 8 })]} />
    ),
    expandedBottom: (
      <HStack spacing={10} modifiers={[padding({ horizontal: 6, top: 2 })]}>
        <Image systemName={hasSound ? 'waveform' : 'moon.fill'} size={13} color={ORCHID} />
        <Text modifiers={[font({ size: 13, weight: 'semibold' }), foregroundStyle('#FFFFFF'), lineLimit(1)]}>{hasSound ? props.sound : props.title}</Text>
        <Spacer />
        {hasSound ? <SoundButton size={32} /> : null}
        <WakeButton size={32} />
      </HStack>
    ),
  };
};

export default createLiveActivity<SleepActivityProps>('SleepActivity', SleepActivity);
