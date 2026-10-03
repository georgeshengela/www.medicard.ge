/**
 * „MEDICARD ციკლი“ — iOS Home-screen widget (small + medium), rendered by expo-widgets in the
 * `ge.medicard.app.widgets` extension (train 1.0.0.20, store build).
 *
 * Like the MEDIRUN Live Activity (`run/runActivityLayout.tsx`), the layout below is serialised at build
 * time (`'widget'` directive) and evaluated in the extension's own JS runtime: it may use only its
 * arguments and `@expo/ui/swift-ui` components and modifiers — never module-scope values, hooks or other
 * imports. Every word and colour arrives in props (`cycleWidgetSnapshot.ts`), already in the app's
 * language. Empty props (nothing written yet, the gallery preview, a signed-out phone) draw the
 * neutral tile: „MEDICARD“ and a dot. Required lazily, iOS only (`cycleWidget.ts`).
 */
import { Capsule, Circle, HStack, Link, Spacer, Text, VStack, ZStack } from '@expo/ui/swift-ui';
import {
  accessibilityLabel,
  containerBackground,
  font,
  foregroundStyle,
  frame,
  lineLimit,
  minimumScaleFactor,
  monospacedDigit,
  padding,
  privacySensitive,
  strokeBorder,
  widgetURL,
} from '@expo/ui/swift-ui/modifiers';
import { createWidget, type WidgetEnvironment } from 'expo-widgets';
import type { CycleWidgetProps } from './cycleWidgetSnapshot';

const MedicardCycleWidget = (props: Partial<CycleWidgetProps>, environment: WidgetEnvironment) => {
  'widget';
  const dark = environment.colorScheme === 'dark';
  // Fallback = the cycle palette's card / ink / mutedSoft (tests compare them with cyclePalette.ts).
  const fallback = dark
    ? { bg: '#17131C', ink: '#F7F0F4', muted: '#CDBFC8', dot: '#B4A5AF', button: '#C92A55', onButton: '#FFFFFF' }
    : { bg: '#FFFFFF', ink: '#2A1F2D', muted: '#6B5E6E', dot: '#76687A', button: '#C92A55', onButton: '#FFFFFF' };
  const c = (dark ? props.dark : props.light) ?? fallback;
  const brand = props.brand || 'MEDICARD';
  const neutral = !props.state || props.state === 'neutral';
  const medium = environment.widgetFamily === 'systemMedium';
  const openUrl = props.openUrl || 'medicard://';
  const tone = neutral ? 'neutral' : props.tone ?? 'calm';

  // Solid rose = a period day, dashed rose ring = an expected day, grey = everything else.
  const Dot = ({ size }: { size: number }) =>
    tone === 'expected' ? (
      <Circle
        modifiers={[
          foregroundStyle('#00000000'),
          strokeBorder({ content: c.dot, style: { lineWidth: 2, dash: [3, 2.5] }, shape: 'circle' }),
          frame({ width: size, height: size }),
        ]}
      />
    ) : (
      <Circle modifiers={[foregroundStyle(c.dot), frame({ width: size, height: size })]} />
    );

  const Header = () => (
    <HStack spacing={6}>
      <Dot size={10} />
      <Text modifiers={[font({ size: 11, weight: 'heavy' }), foregroundStyle(neutral ? c.ink : c.muted), lineLimit(1)]}>{brand}</Text>
      <Spacer />
    </HStack>
  );

  const Answer = () => (
    <VStack alignment="leading" spacing={2} modifiers={[privacySensitive()]}>
      {props.caption ? (
        <Text
          modifiers={[
            font({ size: props.value ? 13 : 16, weight: props.value ? 'semibold' : 'bold' }),
            foregroundStyle(props.value ? c.muted : c.ink),
            lineLimit(2),
            minimumScaleFactor(0.8),
          ]}>
          {props.caption}
        </Text>
      ) : null}
      {props.value ? (
        <HStack alignment="firstTextBaseline" spacing={4}>
          <Text
            modifiers={[
              font({ size: props.value.length > 4 ? 28 : 36, weight: 'bold', design: 'rounded' }),
              monospacedDigit(),
              foregroundStyle(tone === 'period' || tone === 'expected' ? c.dot : c.ink),
              lineLimit(1),
              minimumScaleFactor(0.6),
            ]}>
            {props.value}
          </Text>
          {props.unit ? (
            <Text modifiers={[font({ size: 15, weight: 'semibold' }), foregroundStyle(c.ink), lineLimit(1)]}>{props.unit}</Text>
          ) : null}
        </HStack>
      ) : null}
      {props.note ? (
        <Text modifiers={[font({ size: 12, weight: 'medium' }), foregroundStyle(c.muted), lineLimit(2), minimumScaleFactor(0.85)]}>
          {props.note}
        </Text>
      ) : null}
    </VStack>
  );

  const Start = () =>
    props.startLabel && props.startUrl ? (
      <Link destination={props.startUrl} modifiers={[accessibilityLabel(props.startA11y || props.startLabel)]}>
        <ZStack>
          <Capsule modifiers={[foregroundStyle(c.button), frame({ width: 112, height: 40 })]} />
          <Text modifiers={[font({ size: 14, weight: 'bold' }), foregroundStyle(c.onButton), lineLimit(1), minimumScaleFactor(0.8)]}>
            {props.startLabel}
          </Text>
        </ZStack>
      </Link>
    ) : null;

  const root = [
    containerBackground(c.bg, 'widget'),
    widgetURL(openUrl),
    accessibilityLabel(props.a11y || brand),
  ];

  if (neutral) {
    // Nothing about the cycle: the brand and a dot, centred like an app tile.
    return (
      <VStack spacing={8} modifiers={[...root, frame({ maxWidth: Infinity, maxHeight: Infinity })]}>
        <Dot size={14} />
        <Text modifiers={[font({ size: 15, weight: 'heavy' }), foregroundStyle(c.ink), lineLimit(1)]}>{brand}</Text>
      </VStack>
    );
  }

  if (!medium) {
    return (
      <VStack alignment="leading" spacing={0} modifiers={[...root, frame({ maxWidth: Infinity, maxHeight: Infinity, alignment: 'topLeading' })]}>
        <Header />
        <Spacer />
        <Answer />
      </VStack>
    );
  }

  return (
    <HStack alignment="center" spacing={12} modifiers={[...root, frame({ maxWidth: Infinity, maxHeight: Infinity })]}>
      <VStack alignment="leading" spacing={0} modifiers={[frame({ maxWidth: Infinity, maxHeight: Infinity, alignment: 'topLeading' })]}>
        <Header />
        <Spacer />
        <Answer />
      </VStack>
      <VStack alignment="trailing" spacing={10} modifiers={[padding({ leading: 4 })]}>
        {props.detail ? (
          <Text modifiers={[font({ size: 12, weight: 'semibold' }), foregroundStyle(c.muted), lineLimit(1), privacySensitive()]}>
            {props.detail}
          </Text>
        ) : null}
        <Start />
      </VStack>
    </HStack>
  );
};

export default createWidget<Partial<CycleWidgetProps>>('MedicardCycle', MedicardCycleWidget);
