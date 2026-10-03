/**
 * „სავარაუდო დღე ჩაკეტილ ეკრანზე“ — an optional, static Live Activity on the expected day (train
 * 1.0.0.20, off by default, cycle settings → შეხსენებები). Same extension and the same `'widget'`
 * rules as `run/runActivityLayout.tsx`: only arguments and `@expo/ui/swift-ui`, every word in props
 * (`cycleWidgetSnapshot.ts` → `activityProps`). Discreet = „MEDICARD“ and a dot, nothing else.
 * Required lazily, iOS only (`cycleDayActivity.ts`).
 */
import { Capsule, Circle, HStack, Link, Spacer, Text, VStack, ZStack } from '@expo/ui/swift-ui';
import {
  accessibilityLabel,
  activityBackgroundTint,
  font,
  foregroundStyle,
  frame,
  lineLimit,
  minimumScaleFactor,
  padding,
  strokeBorder,
} from '@expo/ui/swift-ui/modifiers';
import { createLiveActivity, type LiveActivityEnvironment } from 'expo-widgets';
import type { CycleWidgetProps } from './cycleWidgetSnapshot';

const CycleDayActivity = (props: Partial<CycleWidgetProps>, environment: LiveActivityEnvironment) => {
  'widget';
  // The lock screen banner is always the dark card (like MEDIRUN); colours from the cycle palette's dark set.
  const c = props.dark ?? { bg: '#17131C', ink: '#F7F0F4', muted: '#CDBFC8', dot: '#B4A5AF', button: '#C92A55', onButton: '#FFFFFF' };
  const brand = props.brand || 'MEDICARD';
  const neutral = !props.state || props.state === 'neutral';
  const stale = environment.isStale === true;
  const tone = neutral ? 'neutral' : props.tone ?? 'calm';
  const line = neutral ? '' : [props.caption, [props.value, props.unit].filter(Boolean).join(' ')].filter(Boolean).join(' · ');

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

  const Start = ({ height }: { height: number }) =>
    !neutral && !stale && props.startLabel && props.startUrl ? (
      <Link destination={props.startUrl} modifiers={[accessibilityLabel(props.startA11y || props.startLabel)]}>
        <ZStack>
          <Capsule modifiers={[foregroundStyle(c.button), frame({ width: Math.round(height * 2.6), height })]} />
          <Text modifiers={[font({ size: 14, weight: 'bold' }), foregroundStyle(c.onButton), lineLimit(1), minimumScaleFactor(0.8)]}>
            {props.startLabel}
          </Text>
        </ZStack>
      </Link>
    ) : null;

  return {
    banner: (
      <HStack
        spacing={12}
        modifiers={[activityBackgroundTint(c.bg), frame({ maxWidth: Infinity, alignment: 'leading' }), padding({ all: 16 }), accessibilityLabel(props.a11y || brand)]}>
        <Dot size={14} />
        <VStack alignment="leading" spacing={2}>
          <Text modifiers={[font({ size: 13, weight: 'heavy' }), foregroundStyle(neutral ? c.ink : c.muted), lineLimit(1)]}>{brand}</Text>
          {line ? (
            <Text modifiers={[font({ size: 17, weight: 'bold' }), foregroundStyle(c.ink), lineLimit(1), minimumScaleFactor(0.75)]}>{line}</Text>
          ) : null}
          {!neutral && props.note ? (
            <Text modifiers={[font({ size: 12, weight: 'medium' }), foregroundStyle(c.muted), lineLimit(1), minimumScaleFactor(0.8)]}>{props.note}</Text>
          ) : null}
        </VStack>
        <Spacer />
        <Start height={36} />
      </HStack>
    ),
    compactLeading: <Dot size={12} />,
    compactTrailing: neutral ? (
      <Text modifiers={[font({ size: 12, weight: 'heavy' }), foregroundStyle(c.ink), lineLimit(1)]}>M</Text>
    ) : (
      <Text modifiers={[font({ size: 13, weight: 'bold' }), foregroundStyle(c.dot), lineLimit(1), frame({ maxWidth: 64 })]}>{props.value || ''}</Text>
    ),
    minimal: <Dot size={12} />,
    expandedLeading: (
      <HStack spacing={8} modifiers={[padding({ leading: 6 })]}>
        <Dot size={12} />
        <Text modifiers={[font({ size: 13, weight: 'heavy' }), foregroundStyle(c.ink), lineLimit(1)]}>{brand}</Text>
      </HStack>
    ),
    expandedBottom: neutral ? undefined : (
      <HStack spacing={10} modifiers={[padding({ horizontal: 6, top: 2 })]}>
        <Text modifiers={[font({ size: 14, weight: 'semibold' }), foregroundStyle(c.ink), lineLimit(1), minimumScaleFactor(0.75)]}>{line}</Text>
        <Spacer />
        <Start height={32} />
      </HStack>
    ),
  };
};

export default createLiveActivity<Partial<CycleWidgetProps>>('CycleDayActivity', CycleDayActivity);
