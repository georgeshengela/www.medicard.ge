import React, { memo, useEffect, useId, useMemo, useRef, useState } from 'react';
import { AppState, Platform, Pressable, View, type StyleProp, type ViewStyle } from 'react-native';
import { useIsFocused } from 'expo-router';
import Animated, { useAnimatedProps, useFrameCallback, useSharedValue } from 'react-native-reanimated';
import Svg, { Circle, ClipPath, Defs, Ellipse, G, Path, RadialGradient, Stop } from 'react-native-svg';
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';
import { MEDI_ART, type MascotShape } from './mediMascotArt';
import {
  MASCOT_CROPS, ONE_SHOT, createAnimState, poseToFrame, stepAnim, stillPose,
  type AnimState, type M6, type MascotFrame, type MascotMood, type MascotRequest,
} from './mediMotion';

export type { MascotMood } from './mediMotion';

const AG = Animated.createAnimatedComponent(G);
const APath = Animated.createAnimatedComponent(Path);

const IS_WEB = Platform.OS === 'web';
const INK = '#123134', MOUTH_IN = '#081819', TONGUE = '#1f7574';

const CROPS = MASCOT_CROPS;

/** A group's transform (+ opacity): native svg takes `matrix`, react-native-svg web takes `transform`. */
function groupProps(m: M6, opacity?: number) {
  'worklet';
  const out: { matrix?: M6; transform?: M6; opacity?: number } = IS_WEB ? { transform: m } : { matrix: m };
  if (opacity !== undefined) out.opacity = opacity;
  return out;
}

const Shapes = memo(function Shapes({ list, clipId }: { list: MascotShape[]; clipId: string }) {
  return (
    <>
      {list.map((el, i) => {
        const clip = el.clip ? `url(#${clipId}${el.clip})` : undefined;
        if (el.t === 'circle') return <Circle key={i} cx={el.cx} cy={el.cy} r={el.r} fill={el.fill} clipPath={clip} />;
        if (el.t === 'ellipse') return <Ellipse key={i} cx={el.cx} cy={el.cy} rx={el.rx} ry={el.ry} fill={el.fill} clipPath={clip} />;
        return <Path key={i} d={el.d} fill={el.fill} clipPath={clip} />;
      })}
    </>
  );
});

/** Pauses the frame loop while the screen is covered or the app is in the background. */
function useAppActive() {
  const [active, setActive] = useState(AppState.currentState !== 'background');
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => setActive(next === 'active'));
    return () => sub.remove();
  }, []);
  return active;
}

export type MediMascotProps = {
  /** What Medi is doing. Looping moods repeat; one-shot moods (hello, wink, yes, laugh, jump…) play once, then `then`. */
  mood?: MascotMood;
  /** Where a one-shot mood lands (default idle). */
  then?: MascotMood;
  /** Change it to replay the same one-shot mood (e.g. a second dose taken). */
  playKey?: number | string;
  /** Height in dp; the width follows the crop. */
  size?: number;
  crop?: keyof typeof CROPS;
  /** Tap → a giggle, then back to what Medi was doing. */
  giggle?: boolean;
  onPress?: () => void;
  /** Only when Medi is the control itself; otherwise the mascot is decoration and hidden from screen readers. */
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
};

/**
 * Medi, the flat Duolingo-style mascot (approved 2026-10-09, brand/medi-character/flat). The traced head
 * and face plus the drawn body, moved by the clips in mediMotion.ts: one frame callback on the UI thread
 * computes the pose and every SVG group reads its own matrix. Reduced motion = a still of the mood, no blinks.
 * Never in MEDICYCLE, MEDISCAN / labs / symptoms, permission primers or MEDIRUN; never `sad` for a missed dose.
 */
export function MediMascot({ mood = 'idle', then = 'idle', playKey, size = 120, crop = 'full', giggle = false, onPress, accessibilityLabel, style }: MediMascotProps) {
  const reduced = usePrefersReducedMotion();
  const focused = useIsFocused();
  const appActive = useAppActive();
  const clipId = `mm${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const box = CROPS[crop];
  const width = (size * box.w) / box.h;

  const keyRef = useRef(0);
  const f0 = useMemo(() => poseToFrame(stillPose(mood)), []); // eslint-disable-line react-hooks/exhaustive-deps
  const req = useSharedValue<MascotRequest>({ mood, then: ONE_SHOT[mood] ? then : mood, key: 0 });
  const anim = useSharedValue<AnimState | null>(null);
  const frame = useSharedValue<MascotFrame>(f0);

  const ask = (next: MascotMood, after: MascotMood) => {
    keyRef.current += 1;
    req.value = { mood: next, then: ONE_SHOT[next] ? after : next, key: keyRef.current };
  };
  useEffect(() => {
    ask(mood, then);
    if (reduced) frame.value = poseToFrame(stillPose(mood));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mood, then, playKey, reduced]);

  const loop = useFrameCallback((info) => {
    'worklet';
    const dt = Math.min(0.05, (info.timeSincePreviousFrame ?? 16) / 1000);
    const r = req.value;
    // the animator state is made and mutated in place on the UI thread (modify, no listeners to wake)
    anim.modify((S) => {
      'worklet';
      const st = S ?? createAnimState();
      frame.value = poseToFrame(stepAnim(st, r, dt));
      return st;
    }, false);
  }, false);
  const running = !reduced && focused && appActive;
  useEffect(() => { loop.setActive(running); }, [running, loop]);

  const shadowP = useAnimatedProps(() => groupProps(frame.value.shadowM, frame.value.shadowO));
  const rootP = useAnimatedProps(() => groupProps(frame.value.rootM));
  const bodyP = useAnimatedProps(() => groupProps(frame.value.bodyM));
  const legLP = useAnimatedProps(() => groupProps(frame.value.legLM));
  const legRP = useAnimatedProps(() => groupProps(frame.value.legRM));
  const armL0 = useAnimatedProps(() => groupProps(frame.value.armLM, frame.value.armLLayer === 0 ? 1 : 0));
  const armR0 = useAnimatedProps(() => groupProps(frame.value.armRM, frame.value.armRLayer === 0 ? 1 : 0));
  const armL1 = useAnimatedProps(() => groupProps(frame.value.armLM, frame.value.armLLayer === 1 ? 1 : 0));
  const armR1 = useAnimatedProps(() => groupProps(frame.value.armRM, frame.value.armRLayer === 1 ? 1 : 0));
  const armL2 = useAnimatedProps(() => groupProps(frame.value.armLM, frame.value.armLLayer === 2 ? 1 : 0));
  const armR2 = useAnimatedProps(() => groupProps(frame.value.armRM, frame.value.armRLayer === 2 ? 1 : 0));
  const heartP = useAnimatedProps(() => groupProps(frame.value.heartM));
  const glowP = useAnimatedProps(() => ({ opacity: frame.value.glowO }));
  const headP = useAnimatedProps(() => groupProps(frame.value.headM));
  const blushP = useAnimatedProps(() => ({ opacity: frame.value.blushO }));
  const eyeLP = useAnimatedProps(() => groupProps(frame.value.eyeLM, frame.value.eyeLO));
  const eyeRP = useAnimatedProps(() => groupProps(frame.value.eyeRM, frame.value.eyeRO));
  const shutLP = useAnimatedProps(() => ({ d: frame.value.shutLD, opacity: frame.value.shutLO }));
  const shutRP = useAnimatedProps(() => ({ d: frame.value.shutRD, opacity: frame.value.shutRO }));
  const browLP = useAnimatedProps(() => groupProps(frame.value.browLM));
  const browRP = useAnimatedProps(() => groupProps(frame.value.browRM));
  const mouthP = useAnimatedProps(() => ({ d: frame.value.mouthD }));
  const tongueP = useAnimatedProps(() => ({ d: frame.value.tongueD, opacity: frame.value.tongueO }));
  const lineP = useAnimatedProps(() => ({ d: frame.value.lineD }));

  const arm = (side: 'L' | 'R', layer: 0 | 1 | 2, props: Partial<ReturnType<typeof groupProps>>) => {
    const m = side === 'L' ? f0.armLM : f0.armRM;
    const on = (side === 'L' ? f0.armLLayer : f0.armRLayer) === layer ? 1 : 0;
    return (
      <AG transform={m} opacity={on} animatedProps={props}>
        <Shapes list={side === 'L' ? MEDI_ART.armL : MEDI_ART.armR} clipId={clipId} />
      </AG>
    );
  };

  const art = (
    <Svg width={width} height={size} viewBox={`${box.x} ${box.y} ${box.w} ${box.h}`}>
      <Defs>
        {Object.entries(MEDI_ART.clips).map(([id, d]) => (
          <ClipPath key={id} id={`${clipId}${id}`}><Path d={d} /></ClipPath>
        ))}
        <RadialGradient id={`${clipId}glow`} cx="50%" cy="50%" r="50%">
          <Stop offset="0" stopColor="#7ff7e8" stopOpacity="0.95" />
          <Stop offset="1" stopColor="#7ff7e8" stopOpacity="0" />
        </RadialGradient>
      </Defs>
      <AG transform={f0.shadowM} opacity={f0.shadowO} animatedProps={shadowP}>
        <Ellipse cx={1024} cy={1982} rx={360} ry={46} fill="rgba(16,64,60,0.14)" />
      </AG>
      <AG transform={f0.rootM} animatedProps={rootP}>
        {arm('L', 0, armL0)}
        {arm('R', 0, armR0)}
        <AG transform={f0.legLM} animatedProps={legLP}><Shapes list={MEDI_ART.legL} clipId={clipId} /></AG>
        <AG transform={f0.legRM} animatedProps={legRP}><Shapes list={MEDI_ART.legR} clipId={clipId} /></AG>
        <AG transform={f0.bodyM} animatedProps={bodyP}>
          <Shapes list={MEDI_ART.body} clipId={clipId} />
          <AG opacity={f0.glowO} animatedProps={glowP}>
            <Ellipse cx={1024} cy={1585} rx={230} ry={210} fill={`url(#${clipId}glow)`} />
          </AG>
          <AG transform={f0.heartM} animatedProps={heartP}><Shapes list={MEDI_ART.heart} clipId={clipId} /></AG>
        </AG>
        {arm('L', 1, armL1)}
        {arm('R', 1, armR1)}
        <AG transform={f0.headM} animatedProps={headP}>
          <Shapes list={MEDI_ART.head} clipId={clipId} />
          <AG opacity={f0.blushO} animatedProps={blushP}>
            <Ellipse cx={545} cy={1095} rx={78} ry={40} fill="#ffb3b3" />
            <Ellipse cx={1503} cy={1095} rx={78} ry={40} fill="#ffb3b3" />
          </AG>
          <AG transform={f0.eyeLM} opacity={f0.eyeLO} animatedProps={eyeLP}><Shapes list={MEDI_ART.eyeL} clipId={clipId} /></AG>
          <APath d={f0.shutLD} opacity={f0.shutLO} fill="none" stroke={INK} strokeWidth={34} strokeLinecap="round" animatedProps={shutLP} />
          <AG transform={f0.eyeRM} opacity={f0.eyeRO} animatedProps={eyeRP}><Shapes list={MEDI_ART.eyeR} clipId={clipId} /></AG>
          <APath d={f0.shutRD} opacity={f0.shutRO} fill="none" stroke={INK} strokeWidth={34} strokeLinecap="round" animatedProps={shutRP} />
          <AG transform={f0.browLM} animatedProps={browLP}><Shapes list={MEDI_ART.browL} clipId={clipId} /></AG>
          <AG transform={f0.browRM} animatedProps={browRP}><Shapes list={MEDI_ART.browR} clipId={clipId} /></AG>
          <APath d={f0.mouthD} fill={MOUTH_IN} animatedProps={mouthP} />
          <APath d={f0.tongueD} opacity={f0.tongueO} fill={TONGUE} animatedProps={tongueP} />
          <APath d={f0.lineD} fill="none" stroke={MOUTH_IN} strokeWidth={26} strokeLinecap="round" animatedProps={lineP} />
        </AG>
        {arm('L', 2, armL2)}
        {arm('R', 2, armR2)}
      </AG>
    </Svg>
  );

  if (!giggle && !onPress) {
    return (
      <View pointerEvents="none" accessible={false} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden style={[{ width, height: size }, style]}>
        {art}
      </View>
    );
  }
  const tap = () => {
    if (giggle && !reduced) ask('laugh', ONE_SHOT[mood] ? then : mood);
    onPress?.();
  };
  return (
    <Pressable
      onPress={tap}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={accessibilityLabel}
      accessible={!!onPress}
      importantForAccessibility={onPress ? 'auto' : 'no-hide-descendants'}
      style={[{ width, height: size }, style]}
    >
      <View pointerEvents="none">{art}</View>
    </Pressable>
  );
}
