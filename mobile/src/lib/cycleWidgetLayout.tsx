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
 * as a big, soft, tilted ornament cut by the corner — rose on a cycle tile, brand teal on the neutral one —
 * and a small logo beside „MEDICARD“. Both are the real logo as PNGs (`cycleWidgetArt.ts` copies them into
 * the app group, `props.art` is that folder). The ornament PNG is the whole widget, so it is stretched over
 * the full tile by undoing the system content margins (negative padding) — the board's exact placement.
 * Without `art` (older timeline, copy not finished) the widget shows the words only.
 */
import { Capsule, HStack, Image, Link, Spacer, Text, VStack, ZStack } from '@expo/ui/swift-ui';
import {
  accessibilityLabel,
  background,
  containerBackground,
  font,
  foregroundStyle,
  frame,
  lineLimit,
  minimumScaleFactor,
  monospacedDigit,
  padding,
  privacySensitive,
  resizable,
  shapes,
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
  const art = props.art || '';
  const theme = dark ? 'dark' : 'light';
  // iOS 17+ reports the margins; 16 pt is the iPhone default before that.
  const m = environment.widgetContentMargins ?? { top: 16, bottom: 16, leading: 16, trailing: 16 };

  // The ornament covers the whole tile (its PNG is drawn at widget size), so undo the content margins.
  const Ornament = () =>
    art ? (
      <Image
        uiImage={`${art}ornament-${medium ? 'm' : 's'}-${neutral ? 'teal' : 'rose'}-${theme}.png`}
        modifiers={[
          resizable(),
          frame({ maxWidth: Infinity, maxHeight: Infinity }),
          padding({ top: -m.top, bottom: -m.bottom, leading: -m.leading, trailing: -m.trailing }),
        ]}
      />
    ) : null;

  const Header = () => (
    <HStack spacing={6}>
      {art ? <Image uiImage={`${art}logo-rose-${theme}.png`} modifiers={[resizable(), frame({ width: 13, height: 13 })]} /> : null}
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
    // Nothing about the cycle: the teal logo and the brand, centred like an app tile.
    return (
      <ZStack modifiers={[...root, fill]}>
        <Ornament />
        <VStack spacing={8}>
          {art ? <Image uiImage={`${art}logo-teal.png`} modifiers={[resizable(), frame({ width: 34, height: 34 })]} /> : null}
          <Text modifiers={[font({ size: 15, weight: 'heavy' }), foregroundStyle(c.ink), lineLimit(1)]}>{brand}</Text>
        </VStack>
      </ZStack>
    );
  }

  const left = (
    <VStack alignment="leading" spacing={0} modifiers={[frame({ maxWidth: Infinity, maxHeight: Infinity, alignment: 'topLeading' })]}>
      <Header />
      <Spacer />
      <Answer />
    </VStack>
  );

  if (!medium) {
    return (
      <ZStack modifiers={[...root, fill]}>
        <Ornament />
        {left}
      </ZStack>
    );
  }

  // Medium: the date (on a card-coloured label over the ornament) and „დაიწყო“ at the bottom right.
  return (
    <ZStack modifiers={[...root, fill]}>
      <Ornament />
      <HStack alignment="bottom" spacing={12} modifiers={[fill]}>
        {left}
        <VStack alignment="trailing" spacing={10} modifiers={[padding({ leading: 4 })]}>
          {props.detail ? (
            <Text
              modifiers={[
                font({ size: 12, weight: 'semibold' }),
                foregroundStyle(c.ink),
                lineLimit(1),
                padding({ horizontal: 10, vertical: 4 }),
                background(c.bg, shapes.roundedRectangle({ cornerRadius: 10 })),
                privacySensitive(),
              ]}>
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
