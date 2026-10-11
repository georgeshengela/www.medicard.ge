/**
 * „MEDISLEEP“ widget — lock screen (circular, rectangular, inline) and a small Home-screen tile, rendered by
 * expo-widgets in the `ge.medicard.app.widgets` extension (store train 1.0.0.23: the `MedicardSleep` entry in
 * app.json). Same rules as every expo-widgets layout: serialised at build time (`'widget'` directive), only its
 * arguments and `@expo/ui/swift-ui`, every word in props (sleepWidget.ts builds them per timeline entry).
 *
 * What it shows by the clock: evening → the bedtime and a live countdown to it; sleep mode → the alarm;
 * morning and day → last night's sleep against her goal. No props (gallery, signed out) → the moon and
 * „MEDISLEEP“. Lock-screen widgets are drawn by iOS in one tint, so the meaning never rests on colour.
 */
import { AccessoryWidgetBackground, Gauge, HStack, Image, Spacer, Text, VStack, ZStack } from '@expo/ui/swift-ui';
import {
  containerBackground,
  font,
  foregroundStyle,
  frame,
  gaugeStyle,
  lineLimit,
  minimumScaleFactor,
  monospacedDigit,
  padding,
  widgetURL,
} from '@expo/ui/swift-ui/modifiers';
import { createWidget, type WidgetEnvironment } from 'expo-widgets';

export type SleepWidgetProps = {
  state: 'empty' | 'evening' | 'night' | 'rest';
  /** Small title line: „დაწოლა“ / „ძილის რეჟიმი“ / „ბოლო ღამე“. */
  label: string;
  /** The big value: „23:00“ / „07:15“ / „7:40“. */
  value: string;
  /** One more line: „ბოლო ღამე 7 სთ 40 წთ“ / „მაღვიძარა“ / „დაწოლა 23:00“. */
  detail: string;
  /** Inline lock-screen text: „დაწოლა 23:00“. */
  inline: string;
  /** Evening: the bedtime (epoch ms) for the live countdown; 0 = none. */
  countdownTo: number;
  countdownLabel: string;
  /** Last night slept / goal, 0…1 (the circular gauge). */
  fraction: number;
  openUrl: string;
};

const MedicardSleepWidget = (props: Partial<SleepWidgetProps>, environment: WidgetEnvironment) => {
  'widget';
  const ORCHID = '#D9A8FF';
  const MOON = '#F4E3B5';
  const family = environment.widgetFamily;
  const state = props.state || 'empty';
  const empty = state === 'empty';
  const url = props.openUrl || 'medicard://sleep';
  const glyph = state === 'night' ? 'moon.zzz.fill' : state === 'evening' ? 'bed.double.fill' : 'moon.stars.fill';
  const counting = state === 'evening' && (props.countdownTo ?? 0) > Date.now();

  if (family === 'accessoryInline') {
    return (
      <HStack modifiers={[widgetURL(url)]}>
        <Image systemName={glyph} />
        <Text>{empty ? 'MEDISLEEP' : props.inline || props.value || ''}</Text>
      </HStack>
    );
  }

  if (family === 'accessoryCircular') {
    return (
      <ZStack modifiers={[widgetURL(url), containerBackground('#00000000', 'widget')]}>
        <AccessoryWidgetBackground />
        {state === 'rest' ? (
          <Gauge value={Math.max(0, Math.min(1, props.fraction ?? 0))} min={0} max={1} modifiers={[gaugeStyle('circularCapacity')]}>
            <Image systemName="moon.fill" size={10} />
          </Gauge>
        ) : (
          <VStack spacing={1}>
            <Image systemName={glyph} size={14} />
            {empty ? null : (
              <Text modifiers={[font({ size: 13, weight: 'semibold', design: 'rounded' }), monospacedDigit(), minimumScaleFactor(0.6), lineLimit(1)]}>
                {props.value || ''}
              </Text>
            )}
          </VStack>
        )}
        {state === 'rest' ? (
          <Text modifiers={[font({ size: 12, weight: 'bold', design: 'rounded' }), monospacedDigit(), minimumScaleFactor(0.6), lineLimit(1), padding({ top: 2 })]}>
            {props.value || ''}
          </Text>
        ) : null}
      </ZStack>
    );
  }

  if (family === 'accessoryRectangular') {
    return (
      <VStack alignment="leading" spacing={1} modifiers={[widgetURL(url), containerBackground('#00000000', 'widget'), frame({ maxWidth: Infinity, alignment: 'leading' })]}>
        <HStack spacing={4}>
          <Image systemName={glyph} size={11} />
          <Text modifiers={[font({ size: 12, weight: 'semibold' }), lineLimit(1)]}>{empty ? 'MEDISLEEP' : props.label || ''}</Text>
        </HStack>
        {empty ? (
          <Text modifiers={[font({ size: 13, weight: 'medium' }), lineLimit(2)]}>{props.detail || ''}</Text>
        ) : counting ? (
          <Text
            timerInterval={{ lower: new Date(), upper: new Date(props.countdownTo ?? 0) }}
            countsDown
            modifiers={[font({ size: 22, weight: 'semibold', design: 'rounded' }), monospacedDigit(), lineLimit(1)]}
          />
        ) : (
          <Text modifiers={[font({ size: 22, weight: 'semibold', design: 'rounded' }), monospacedDigit(), lineLimit(1), minimumScaleFactor(0.7)]}>
            {props.value || ''}
          </Text>
        )}
        {empty ? null : (
          <Text modifiers={[font({ size: 12, weight: 'medium' }), lineLimit(1), minimumScaleFactor(0.8)]}>
            {counting ? props.countdownLabel || '' : props.detail || ''}
          </Text>
        )}
      </VStack>
    );
  }

  // systemSmall: the night tile.
  return (
    <VStack
      alignment="leading"
      spacing={4}
      modifiers={[widgetURL(url), containerBackground('#120E2E', 'widget'), frame({ maxWidth: Infinity, maxHeight: Infinity, alignment: 'topLeading' })]}>
      <HStack spacing={6}>
        <Image systemName="moon.stars.fill" size={14} color={MOON} />
        <HStack spacing={0}>
          <Text modifiers={[font({ size: 13, weight: 'heavy' }), foregroundStyle('#FFFFFF')]}>MEDI</Text>
          <Text modifiers={[font({ size: 13, weight: 'heavy' }), foregroundStyle(ORCHID)]}>SLEEP</Text>
        </HStack>
      </HStack>
      <Spacer />
      {empty ? (
        <Text modifiers={[font({ size: 14, weight: 'medium' }), foregroundStyle('#FFFFFFCC'), lineLimit(3)]}>{props.detail || ''}</Text>
      ) : (
        <VStack alignment="leading" spacing={2}>
          <Text modifiers={[font({ size: 12, weight: 'semibold' }), foregroundStyle(ORCHID), lineLimit(1)]}>{props.label || ''}</Text>
          {counting ? (
            <Text
              timerInterval={{ lower: new Date(), upper: new Date(props.countdownTo ?? 0) }}
              countsDown
              modifiers={[font({ size: 30, weight: 'light', design: 'rounded' }), monospacedDigit(), foregroundStyle('#FFFFFF'), lineLimit(1), minimumScaleFactor(0.6)]}
            />
          ) : (
            <Text modifiers={[font({ size: 34, weight: 'light', design: 'rounded' }), monospacedDigit(), foregroundStyle('#FFFFFF'), lineLimit(1), minimumScaleFactor(0.6)]}>
              {props.value || ''}
            </Text>
          )}
          <Text modifiers={[font({ size: 12, weight: 'medium' }), foregroundStyle('#FFFFFFAA'), lineLimit(2), minimumScaleFactor(0.8)]}>
            {counting ? props.countdownLabel || '' : props.detail || ''}
          </Text>
        </VStack>
      )}
    </VStack>
  );
};

export default createWidget<Partial<SleepWidgetProps>>('MedicardSleep', MedicardSleepWidget);
