import React, { useCallback, useEffect, useMemo } from 'react';
import { Pressable, Text, View, type LayoutChangeEvent } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
import { Minus, Plus, RotateCcw, RotateCw } from 'lucide-react-native';
import { useFigmaSymptoms } from '@/constants/figmaSymptomsLayout';
import { SYMPTOM_BODY_VIEWS } from '@/constants/symptomBodyPaths';
import { bodyPartById, type OrganDef } from '@/constants/symptomCatalog';
import { ka } from '@/i18n/ka';
import type { BodyPartId, BodySide, OrganId, SymptomGender } from '@/types/symptoms';

const MIN_ZOOM = 1;
const MAX_ZOOM = 3.2;
const SPRING = { damping: 18, stiffness: 170 };

type Props = {
  gender: SymptomGender;
  side: BodySide;
  mode: 'muscle' | 'organ';
  selectedPartId: BodyPartId | null;
  selectedOrganId: OrganId | null;
  organs: OrganDef[];
  onToggleSide: () => void;
  onSelectPart: (id: BodyPartId) => void;
  onSelectOrgan: (id: OrganId) => void;
  renderOrganPin: (organ: OrganDef, selected: boolean) => React.ReactNode;
};

export function SymptomAnatomyCanvas({
  gender,
  side,
  mode,
  selectedPartId,
  selectedOrganId,
  organs,
  onToggleSide,
  onSelectPart,
  onSelectOrgan,
  renderOrganPin,
}: Props) {
  const T = useFigmaSymptoms();
  const view = SYMPTOM_BODY_VIEWS[gender][side];
  const canvasW = useSharedValue(1);
  const canvasH = useSharedValue(1);
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const savedTx = useSharedValue(0);
  const savedTy = useSharedValue(0);
  const [box, setBox] = React.useState({ w: 0, h: 0 });

  const fit = useMemo(() => {
    if (!box.w || !box.h) return { w: 0, h: 0 };
    const pad = 20;
    const maxW = box.w - pad * 2;
    const maxH = box.h - pad * 2;
    const aspect = view.h / view.w;
    let w = maxW;
    let h = w * aspect;
    if (h > maxH) {
      h = maxH;
      w = h / aspect;
    }
    return { w, h };
  }, [box, view.h, view.w]);

  const resetZoom = useCallback(() => {
    scale.value = withSpring(1, SPRING);
    savedScale.value = 1;
    tx.value = withSpring(0, SPRING);
    ty.value = withSpring(0, SPRING);
    savedTx.value = 0;
    savedTy.value = 0;
  }, [savedScale, savedTx, savedTy, scale, tx, ty]);

  const bumpZoom = useCallback(
    (delta: number) => {
      const next = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, savedScale.value + delta));
      scale.value = withSpring(next, SPRING);
      savedScale.value = next;
      if (next <= MIN_ZOOM) {
        tx.value = withSpring(0, SPRING);
        ty.value = withSpring(0, SPRING);
        savedTx.value = 0;
        savedTy.value = 0;
      }
    },
    [savedScale, savedTx, savedTy, scale, tx, ty],
  );

  useEffect(() => {
    resetZoom();
  }, [gender, side, resetZoom]);

  const handleTap = useCallback(
    (x: number, y: number) => {
      if (!fit.w || mode !== 'muscle') return;
      const ox = (box.w - fit.w) / 2;
      const oy = (box.h - fit.h) / 2;
      const lx = x - ox;
      const ly = y - oy;
      if (lx < 0 || ly < 0 || lx > fit.w || ly > fit.h) return;
      const sx = (lx / fit.w) * view.w;
      const sy = (ly / fit.h) * view.h;
      let best: { id: BodyPartId; area: number } | null = null;
      for (const p of view.paths) {
        if (p.fill === 'none') continue;
        const area = (p.maxX - p.minX) * (p.maxY - p.minY);
        if (area < 40) continue;
        if (sx >= p.minX && sx <= p.maxX && sy >= p.minY && sy <= p.maxY) {
          if (!best || area < best.area) best = { id: p.partId, area };
        }
      }
      if (!best) return;
      void Haptics.selectionAsync();
      onSelectPart(best.id);
    },
    [box, fit, mode, onSelectPart, view],
  );

  const pinch = Gesture.Pinch()
    .onUpdate((e) => {
      const next = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, savedScale.value * e.scale));
      scale.value = next;
    })
    .onEnd(() => {
      const next = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, scale.value));
      scale.value = withSpring(next, { damping: 18, stiffness: 170 });
      savedScale.value = next;
      if (next <= MIN_ZOOM) {
        tx.value = withSpring(0, { damping: 18, stiffness: 170 });
        ty.value = withSpring(0, { damping: 18, stiffness: 170 });
        savedTx.value = 0;
        savedTy.value = 0;
      }
    });

  const pan = Gesture.Pan()
    .minDistance(12)
    .onUpdate((e) => {
      if (scale.value <= 1.02) return;
      const maxX = ((scale.value - 1) * canvasW.value) / 2 + 24;
      const maxY = ((scale.value - 1) * canvasH.value) / 2 + 24;
      const nx = savedTx.value + e.translationX;
      const ny = savedTy.value + e.translationY;
      tx.value = Math.min(maxX, Math.max(-maxX, nx));
      ty.value = Math.min(maxY, Math.max(-maxY, ny));
    })
    .onEnd(() => {
      savedTx.value = tx.value;
      savedTy.value = ty.value;
    });

  const tap = Gesture.Tap()
    .maxDistance(10)
    .onEnd((e) => {
      runOnJS(handleTap)(e.x, e.y);
    });

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      runOnJS(resetZoom)();
    });

  const composed = Gesture.Simultaneous(pinch, pan, Gesture.Exclusive(doubleTap, tap));

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.value }, { translateY: ty.value }, { scale: scale.value }],
  }));

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setBox({ w: width, h: height });
    canvasW.value = width;
    canvasH.value = height;
  };

  const selectedCentroid = useMemo(() => {
    const paths = view.paths.filter((p) => p.partId === selectedPartId && p.fill !== 'none');
    if (!paths.length) return null;
    return {
      x: paths.reduce((s, p) => s + p.cx, 0) / paths.length,
      y: paths.reduce((s, p) => s + p.cy, 0) / paths.length,
    };
  }, [selectedPartId, view.paths]);

  const selectedOrgan = organs.find((o) => o.id === selectedOrganId) ?? null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <View style={{ flex: 1, backgroundColor: T.canvas, overflow: 'hidden' }} onLayout={onLayout}>
        <PerspectiveGrid />
        <GestureDetector gesture={composed}>
          <Animated.View style={[{ width: box.w || '100%', height: box.h || '100%' }, animatedStyle]}>
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
              {fit.w ? (
                <View style={{ width: fit.w, height: fit.h }}>
                  <Svg width={fit.w} height={fit.h} viewBox={`0 0 ${view.w} ${view.h}`}>
                    {view.paths.map((p, i) => {
                      const on = mode === 'muscle' && p.partId === selectedPartId;
                      return (
                        <Path
                          key={`${p.partId}-${i}`}
                          d={p.d}
                          fill={on ? T.composerPrimary : p.fill === 'none' ? 'transparent' : p.fill}
                          stroke={on ? T.brand : '#9CA3AF'}
                          strokeWidth={on ? 1.6 : 1}
                          strokeLinejoin="round"
                          strokeMiterlimit={10}
                          onPress={
                            mode === 'muscle'
                              ? () => {
                                  void Haptics.selectionAsync();
                                  onSelectPart(p.partId);
                                }
                              : undefined
                          }
                        />
                      );
                    })}
                  </Svg>

                  {mode === 'muscle' && selectedPartId && selectedCentroid ? (
                    <View
                      pointerEvents="none"
                      style={{
                        position: 'absolute',
                        left: (selectedCentroid.x / view.w) * fit.w,
                        top: (selectedCentroid.y / view.h) * fit.h,
                        width: 96,
                        marginLeft: -48,
                        marginTop: -52,
                        alignItems: 'center',
                      }}
                    >
                      <Tooltip label={bodyPartById(selectedPartId)?.labelKa ?? selectedPartId} />
                    </View>
                  ) : null}

                  {mode === 'organ'
                    ? organs.map((organ) => (
                        <View
                          key={organ.id}
                          style={{
                            position: 'absolute',
                            left: organ.overlay.x * fit.w,
                            top: organ.overlay.y * fit.h,
                            marginLeft: -20,
                            marginTop: -20,
                          }}
                        >
                          <Pressable
                            onPress={() => {
                              void Haptics.selectionAsync();
                              onSelectOrgan(organ.id);
                            }}
                          >
                            {renderOrganPin(organ, selectedOrganId === organ.id)}
                          </Pressable>
                        </View>
                      ))
                    : null}

                  {mode === 'organ' && selectedOrgan ? (
                    <View
                      pointerEvents="none"
                      style={{
                        position: 'absolute',
                        left: selectedOrgan.overlay.x * fit.w,
                        top: selectedOrgan.overlay.y * fit.h,
                        width: 110,
                        marginLeft: -55,
                        marginTop: -58,
                        alignItems: 'center',
                      }}
                    >
                      <Tooltip label={selectedOrgan.labelKa} />
                    </View>
                  ) : null}
                </View>
              ) : null}
            </View>
          </Animated.View>
        </GestureDetector>

        <View style={{ position: 'absolute', left: 16, top: 16, flexDirection: 'row', gap: 8 }}>
          <Pressable onPress={onToggleSide} hitSlop={8} accessibilityLabel={ka.symptoms.rotateBody}>
            <RotateCcw size={32} color={T.textMuted} strokeWidth={1.8} />
          </Pressable>
          <Pressable onPress={onToggleSide} hitSlop={8} accessibilityLabel={ka.symptoms.rotateBody}>
            <RotateCw size={32} color={T.textMuted} strokeWidth={1.8} />
          </Pressable>
        </View>

        <Pressable
          onPress={resetZoom}
          accessibilityLabel={ka.symptoms.resetZoom}
          style={{
            position: 'absolute',
            right: 16,
            top: 16,
            width: 48,
            height: 72,
            borderRadius: 12,
            overflow: 'hidden',
            backgroundColor: T.white,
            borderWidth: 1,
            borderColor: T.border,
            alignItems: 'center',
            justifyContent: 'center',
            ...T.shadowXs,
          }}
        >
          <Svg width={36} height={64} viewBox={`0 0 ${view.w} ${view.h}`}>
            {view.paths.map((p, i) => {
              const on = mode === 'muscle' && p.partId === selectedPartId;
              return (
                <Path
                  key={`mini-${i}`}
                  d={p.d}
                  fill={on ? T.brand : p.fill === 'none' ? 'transparent' : p.fill}
                  stroke={on ? T.brandDark : '#D1D5DB'}
                  strokeWidth={1.2}
                />
              );
            })}
          </Svg>
        </Pressable>

        <View style={{ position: 'absolute', right: 16, top: '44%', gap: 12 }}>
          <ZoomBtn icon={Plus} label={ka.symptoms.zoomIn} onPress={() => bumpZoom(0.45)} />
          <ZoomBtn icon={Minus} label={ka.symptoms.zoomOut} onPress={() => bumpZoom(-0.45)} />
        </View>

        {mode === 'muscle' && !selectedPartId ? (
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              left: 24,
              right: 24,
              bottom: 16,
              alignItems: 'center',
            }}
          >
            <View
              style={{
                backgroundColor: 'rgba(31,41,55,0.86)',
                borderRadius: 14,
                paddingHorizontal: 14,
                paddingVertical: 8,
              }}
            >
              <Text style={{ fontSize: 13, fontWeight: '600', color: T.white, textAlign: 'center' }}>
                {ka.symptoms.tapBody}
              </Text>
            </View>
          </View>
        ) : null}
      </View>
    </GestureHandlerRootView>
  );
}

function Tooltip({ label }: { label: string }) {
  const T = useFigmaSymptoms();
  return (
    <View style={{ alignItems: 'center' }}>
      <View
        style={{
          backgroundColor: T.white,
          borderRadius: 12,
          paddingHorizontal: 10,
          paddingVertical: 6,
          ...T.shadowCard,
        }}
      >
        <Text style={{ fontSize: 13, lineHeight: 18, fontWeight: '700', color: T.textPrimary, textAlign: 'center' }}>
          {label}
        </Text>
      </View>
      <View
        style={{
          width: 0,
          height: 0,
          borderLeftWidth: 7,
          borderRightWidth: 7,
          borderTopWidth: 7,
          borderLeftColor: 'transparent',
          borderRightColor: 'transparent',
          borderTopColor: T.white,
        }}
      />
    </View>
  );
}

function PerspectiveGrid() {
  const T = useFigmaSymptoms();
  return (
    <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: '62%', opacity: 0.28 }}>
      {Array.from({ length: 9 }).map((_, i) => (
        <View
          key={`h-${i}`}
          style={{
            position: 'absolute',
            left: `${-16 + i * 3}%`,
            right: `${-16 + i * 3}%`,
            bottom: `${i * 10}%`,
            height: 1,
            backgroundColor: T.borderTertiary,
          }}
        />
      ))}
      {Array.from({ length: 11 }).map((_, i) => (
        <View
          key={`v-${i}`}
          style={{
            position: 'absolute',
            bottom: 0,
            left: `${(i / 10) * 100}%`,
            width: 1,
            height: '100%',
            backgroundColor: T.border,
            opacity: 0.55,
            transform: [{ translateX: (i - 5) * 5 }, { skewX: `${(i - 5) * 3.4}deg` }],
          }}
        />
      ))}
    </View>
  );
}

function ZoomBtn({
  icon: Icon,
  onPress,
  label,
}: {
  icon: typeof Plus;
  onPress: () => void;
  label: string;
}) {
  const T = useFigmaSymptoms();
  return (
    <Pressable
      onPress={() => {
        void Haptics.selectionAsync();
        onPress();
      }}
      accessibilityLabel={label}
      style={{
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: T.inverse,
        alignItems: 'center',
        justifyContent: 'center',
        ...T.shadowXs,
      }}
    >
      <Icon size={24} color={T.white} strokeWidth={2.2} />
    </Pressable>
  );
}
