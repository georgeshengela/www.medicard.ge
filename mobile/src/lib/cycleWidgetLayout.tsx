/**
 * „MEDICARD ციკლი“ — iOS Home-screen widget (small + medium), rendered by expo-widgets in the
 * `ge.medicard.app.widgets` extension (train 1.0.0.20, store build).
 *
 * Like the MEDIRUN Live Activity (`run/runActivityLayout.tsx`), the layout below is serialised at build
 * time (`'widget'` directive) and evaluated in the extension's own JS runtime: it may use only its
 * arguments and `@expo/ui/swift-ui` components and modifiers — never module-scope values, hooks or other
 * imports. Every word and colour arrives in props (`cycleWidgetSnapshot.ts`), already in the app's
 * language. Empty props (nothing written yet, the gallery preview, a signed-out phone) draw the
 * neutral tile: the logo and „MEDICARD“. Required lazily, iOS only (`cycleWidget.ts`).
 *
 * Look (owner pick 2026-10-04, variant A of `brand/cycle/widget/widget-variants.html`): the MEDICARD logo
 * as a big, soft, tilted ornament cut by the corner — rose on a cycle tile, brand teal on the neutral one.
 * There is no Path in `@expo/ui`, so the logo is built from two capsules (the cross), two capsules in the
 * card colour (its hollow) and two ellipses (the leaf); the ornament's softness comes from colours
 * pre-blended into the card (`markFrom`/`markTo`), because opacity would show the hollow pieces.
 */
import { Capsule, Ellipse, HStack, Link, Spacer, Text, VStack, ZStack } from '@expo/ui/swift-ui';
import {
  accessibilityLabel,
  containerBackground,
  font,
  foregroundStyle,
  frame,
  lineLimit,
  minimumScaleFactor,
  monospacedDigit,
  offset,
  padding,
  privacySensitive,
  rotationEffect,
  scaleEffect,
  widgetURL,
} from '@expo/ui/swift-ui/modifiers';
import { createWidget, type WidgetEnvironment } from 'expo-widgets';
import type { CycleWidgetProps } from './cycleWidgetSnapshot';

const MedicardCycleWidget = (props: Partial<CycleWidgetProps>, environment: WidgetEnvironment) => {
  'widget';
  const dark = environment.colorScheme === 'dark';
  // Fallback = the cycle palette's card / ink / mutedSoft and the brand teal (tests compare them).
  const fallback = dark
    ? {
        bg: '#17131C',
        ink: '#F7F0F4',
        muted: '#CDBFC8',
        dot: '#B4A5AF',
        button: '#C92A55',
        onButton: '#FFFFFF',
        logoFrom: '#0D9488',
        logoTo: '#5EEAD4',
        markFrom: '#152D32',
        markTo: '#253E41',
      }
    : {
        bg: '#FFFFFF',
        ink: '#2A1F2D',
        muted: '#6B5E6E',
        dot: '#76687A',
        button: '#C92A55',
        onButton: '#FFFFFF',
        logoFrom: '#0D9488',
        logoTo: '#5EEAD4',
        markFrom: '#E2F2F1',
        markTo: '#ECFCFA',
      };
  const c = (dark ? props.dark : props.light) ?? fallback;
  const brand = props.brand || 'MEDICARD';
  const neutral = !props.state || props.state === 'neutral';
  const medium = environment.widgetFamily === 'systemMedium';
  const openUrl = props.openUrl || 'medicard://';
  const tone = neutral ? 'neutral' : props.tone ?? 'calm';
  // A timeline written by an older app build has no logo colours: fall back to the dot / no ornament.
  const logoFrom = c.logoFrom || (neutral ? fallback.logoFrom : c.dot);
  const logoTo = c.logoTo || (neutral ? fallback.logoTo : c.dot);

  // The MEDICARD mark (assets/logo.svg, 36-unit grid): cross, its hollow, the leaf and the leaf's hollow.
  const Logo = ({ size, from, to }: { size: number; from: string; to: string }) => {
    const u = size / 36;
    const fill =
      from === to ? from : { type: 'linearGradient' as const, colors: [from, to], startPoint: { x: 0, y: 0 }, endPoint: { x: 1, y: 1 } };
    return (
      <ZStack modifiers={[frame({ width: size, height: size })]}>
        <Capsule modifiers={[foregroundStyle(fill), frame({ width: 16.36 * u, height: 36 * u })]} />
        <Capsule modifiers={[foregroundStyle(fill), frame({ width: 36 * u, height: 16.36 * u })]} />
        <Capsule modifiers={[foregroundStyle(c.bg), frame({ width: 9.82 * u, height: 29.45 * u })]} />
        <Capsule modifiers={[foregroundStyle(c.bg), frame({ width: 29.45 * u, height: 9.82 * u })]} />
        <Ellipse modifiers={[foregroundStyle(fill), frame({ width: 23 * u, height: 10.9 * u }), rotationEffect(-45)]} />
        <Ellipse modifiers={[foregroundStyle(c.bg), frame({ width: 14 * u, height: 4.6 * u }), rotationEffect(-45)]} />
      </ZStack>
    );
  };

  // The ornament: a tilted logo cut by the corner (small: bottom right, medium: top right, behind the
  // date). Drawn at 100 pt and scaled, so it never changes the layout; offsets assume the 16 pt margins.
  const Ornament = () =>
    c.markFrom && c.markTo ? (
      <ZStack modifiers={[frame({ maxWidth: Infinity, maxHeight: Infinity, alignment: medium ? 'topTrailing' : 'bottomTrailing' })]}>
        <ZStack
          modifiers={[
            frame({ width: 100, height: 100 }),
            scaleEffect(medium ? 1.84 : 1.18),
            rotationEffect(-14),
            offset(medium ? { x: 4, y: 4 } : { x: 33, y: 35 }),
          ]}>
          <Logo size={100} from={c.markFrom} to={c.markTo} />
        </ZStack>
      </ZStack>
    ) : null;

  const Header = () => (
    <HStack spacing={6}>
      <Logo size={13} from={logoFrom} to={logoTo} />
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
  const fill = frame({ maxWidth: Infinity, maxHeight: Infinity });

  if (neutral) {
    // Nothing about the cycle: the logo and the brand, centred like an app tile.
    return (
      <ZStack modifiers={[...root, fill]}>
        <Ornament />
        <VStack spacing={8}>
          <Logo size={34} from={logoFrom} to={logoTo} />
          <Text modifiers={[font({ size: 15, weight: 'heavy' }), foregroundStyle(c.ink), lineLimit(1)]}>{brand}</Text>
        </VStack>
      </ZStack>
    );
  }

  if (!medium) {
    return (
      <ZStack modifiers={[...root, fill]}>
        <Ornament />
        <VStack alignment="leading" spacing={0} modifiers={[frame({ maxWidth: Infinity, maxHeight: Infinity, alignment: 'topLeading' })]}>
          <Header />
          <Spacer />
          <Answer />
        </VStack>
      </ZStack>
    );
  }

  return (
    <ZStack modifiers={[...root, fill]}>
      <Ornament />
      <HStack alignment="center" spacing={12} modifiers={[fill]}>
        <VStack alignment="leading" spacing={0} modifiers={[frame({ maxWidth: Infinity, maxHeight: Infinity, alignment: 'topLeading' })]}>
          <Header />
          <Spacer />
          <Answer />
        </VStack>
        <VStack alignment="trailing" spacing={10} modifiers={[padding({ leading: 4 })]}>
          {props.detail ? (
            <Text modifiers={[font({ size: 12, weight: 'semibold' }), foregroundStyle(c.ink), lineLimit(1), privacySensitive()]}>
              {props.detail}
            </Text>
          ) : null}
          <Start />
        </VStack>
      </HStack>
    </ZStack>
  );
};

export default createWidget<Partial<CycleWidgetProps>>('MedicardCycle', MedicardCycleWidget);
