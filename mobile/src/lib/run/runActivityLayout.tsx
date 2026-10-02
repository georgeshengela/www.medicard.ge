/**
 * MEDIRUN Live Activity (iOS lock screen + Dynamic Island), rendered by expo-widgets.
 *
 * The layout function below is serialised at build time (`'widget'` directive) and evaluated in the widget
 * extension's own JS runtime: it may use only its arguments and `@expo/ui/swift-ui` components and modifiers,
 * never module-scope values, hooks or other imports. Every text arrives in props, already in the app's
 * language. Required lazily, iOS only (src/lib/run/liveActivity.ts).
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

export type RunActivityProps = {
  /** live: recording · hold: vehicle or weak GPS (time stopped) · pause: paused by the person or the system. */
  tone: 'live' | 'hold' | 'pause';
  status: string;
  distance: string;
  unit: string;
  distanceLabel: string;
  timeLabel: string;
  /** The clock ticks on its own from `clockStart` (epoch ms) while recording; otherwise `clock` is shown. */
  ticking: boolean;
  clockStart: number;
  clock: string;
  lit: number;
  litLabel: string;
  pauseLabel: string;
  resumeLabel: string;
  resumeUrl: string;
  staleText: string;
  /** The gift pulse while recording: none, near (signal) or here (in reach). */
  find: 'none' | 'near' | 'here';
  findText: string;
};

const MedirunActivity = (props: RunActivityProps, environment: LiveActivityEnvironment) => {
  'widget';
  const TEAL = '#2DD4BF';
  const AMBER = '#FBBF24';
  const MUTED = '#FFFFFF99';
  const stale = environment.isStale === true;
  const tone = stale ? 'pause' : props.tone;
  const ticking = props.ticking && !stale;
  const ROSE = '#FB7185';
  // A find nearby outranks the live state: rose heart instead of the runner, in every region.
  const finding = !stale && tone === 'live' && props.find !== 'none';
  const accent = finding ? ROSE : tone === 'live' ? TEAL : tone === 'hold' ? AMBER : '#CBD5E1';
  const glyph = finding ? (props.find === 'here' ? 'gift.fill' : 'heart.fill') : tone === 'hold' ? 'car.fill' : tone === 'pause' ? 'pause.fill' : 'figure.run';
  const status = stale ? props.staleText : finding ? props.findText : props.status;
  const start = new Date(props.clockStart);
  const end = new Date(props.clockStart + 24 * 3600 * 1000);

  // A live timer text is greedy: it takes every point it is offered, which stretched the compact Dynamic Island
  // across the whole top of the screen. A fixed width sized to the digits keeps every region tight.
  // From ~50 min on the clock may show hours (1:02:03), so it gets room for them in advance.
  const hours = props.clock.length > 5 || (ticking && Date.now() - props.clockStart > 50 * 60 * 1000);
  const Clock = ({ size, color, align }: { size: number; color: string; align: 'leading' | 'trailing' }) =>
    ticking ? (
      <Text
        timerInterval={{ lower: start, upper: end }}
        countsDown={false}
        modifiers={[
          font({ size, weight: 'semibold', design: 'rounded' }),
          monospacedDigit(),
          foregroundStyle(color),
          multilineTextAlignment(align),
          frame({ width: Math.ceil(size * (hours ? 4.6 : 3.55)), alignment: align }),
        ]}
      />
    ) : (
      <Text modifiers={[font({ size, weight: 'semibold', design: 'rounded' }), monospacedDigit(), foregroundStyle(color), lineLimit(1)]}>
        {props.clock}
      </Text>
    );

  const Distance = ({ size }: { size: number }) => (
    <HStack alignment="firstTextBaseline" spacing={3}>
      <Text modifiers={[font({ size, weight: 'bold', design: 'rounded' }), monospacedDigit(), foregroundStyle('#FFFFFF')]}>
        {props.distance}
      </Text>
      <Text modifiers={[font({ size: Math.round(size * 0.5), weight: 'semibold' }), foregroundStyle(MUTED)]}>{props.unit}</Text>
    </HStack>
  );

  const Caption = ({ text }: { text: string }) => (
    <Text modifiers={[font({ size: 11, weight: 'medium' }), foregroundStyle(MUTED), lineLimit(1)]}>{text}</Text>
  );

  // Pause works from the lock screen while recording; continuing opens the app (location starts on screen).
  const Action = ({ size }: { size: number }) =>
    tone === 'pause' ? (
      <Link destination={props.resumeUrl} modifiers={[accessibilityLabel(props.resumeLabel)]}>
        <ZStack>
          <Circle modifiers={[foregroundStyle(TEAL), frame({ width: size, height: size })]} />
          <Image systemName="play.fill" size={Math.round(size * 0.4)} color="#042F2E" />
        </ZStack>
      </Link>
    ) : (
      <Button target="pause" modifiers={[buttonStyle('plain'), accessibilityLabel(props.pauseLabel)]}>
        <ZStack>
          <Circle modifiers={[foregroundStyle('#FFFFFF26'), frame({ width: size, height: size })]} />
          <Image systemName="pause.fill" size={Math.round(size * 0.4)} color="#FFFFFF" />
        </ZStack>
      </Button>
    );

  return {
    banner: (
      <VStack
        alignment="leading"
        spacing={10}
        modifiers={[activityBackgroundTint('#0B1120'), frame({ maxWidth: Infinity, alignment: 'leading' }), padding({ all: 16 })]}>
        <HStack spacing={8}>
          <ZStack>
            <Circle modifiers={[foregroundStyle(accent + '33'), frame({ width: 26, height: 26 })]} />
            <Image systemName={glyph} size={13} color={accent} />
          </ZStack>
          <HStack spacing={0}>
            <Text modifiers={[font({ size: 15, weight: 'heavy' }), foregroundStyle('#FFFFFF')]}>MEDI</Text>
            <Text modifiers={[font({ size: 15, weight: 'heavy' }), foregroundStyle(TEAL)]}>RUN</Text>
          </HStack>
          <Spacer />
          <Text modifiers={[font({ size: 12, weight: 'semibold' }), foregroundStyle(accent), lineLimit(1)]}>{status}</Text>
        </HStack>
        <HStack alignment="center" spacing={18}>
          <VStack alignment="leading" spacing={1}>
            <Distance size={30} />
            <Caption text={props.distanceLabel} />
          </VStack>
          <VStack alignment="leading" spacing={1}>
            <Clock size={22} color="#FFFFFF" align="leading" />
            <Caption text={props.timeLabel} />
          </VStack>
          {props.lit > 0 ? (
            <VStack alignment="leading" spacing={1}>
              <HStack spacing={4}>
                <Image systemName="building.2.fill" size={13} color={AMBER} />
                <Text modifiers={[font({ size: 20, weight: 'bold', design: 'rounded' }), monospacedDigit(), foregroundStyle(AMBER)]}>
                  {String(props.lit)}
                </Text>
              </HStack>
              <Caption text={props.litLabel} />
            </VStack>
          ) : null}
          <Spacer />
          <Action size={40} />
        </HStack>
      </VStack>
    ),
    compactLeading: <Image systemName={glyph} size={15} color={accent} modifiers={[padding({ leading: 4 })]} />,
    compactTrailing: <Clock size={14} color={accent} align="trailing" />,
    minimal: <Image systemName={glyph} size={14} color={accent} />,
    expandedLeading: (
      <VStack alignment="leading" spacing={1} modifiers={[padding({ leading: 6 })]}>
        <Distance size={26} />
        <Caption text={props.distanceLabel} />
      </VStack>
    ),
    expandedTrailing: (
      <VStack alignment="trailing" spacing={1} modifiers={[padding({ trailing: 6 })]}>
        <Clock size={22} color="#FFFFFF" align="trailing" />
        <Caption text={props.timeLabel} />
      </VStack>
    ),
    expandedBottom: (
      <HStack spacing={10} modifiers={[padding({ horizontal: 6, top: 2 })]}>
        <Image systemName={glyph} size={13} color={accent} />
        <Text modifiers={[font({ size: 13, weight: 'semibold' }), foregroundStyle(accent), lineLimit(1)]}>{status}</Text>
        <Spacer />
        <Action size={34} />
      </HStack>
    ),
  };
};

export default createLiveActivity<RunActivityProps>('MedirunActivity', MedirunActivity);
