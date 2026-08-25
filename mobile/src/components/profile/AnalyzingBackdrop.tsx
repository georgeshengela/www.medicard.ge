import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

/** Figma 8845:313481 + gradient blobs 9001:283396 */
export function AnalyzingBackdrop() {
  const pulse1 = useRef(new Animated.Value(0)).current;
  const pulse2 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = (val: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(val, { toValue: 1, duration: 3200, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
          Animated.timing(val, { toValue: 0, duration: 3200, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        ]),
      ).start();

    loop(pulse1, 0);
    loop(pulse2, 800);
  }, [pulse1, pulse2]);

  const scale1 = pulse1.interpolate({ inputRange: [0, 1], outputRange: [1, 1.12] });
  const scale2 = pulse2.interpolate({ inputRange: [0, 1], outputRange: [1.05, 0.95] });

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Animated.View style={[styles.blob, { top: -80, left: -60, transform: [{ scale: scale1 }] }]}>
        <LinearGradient colors={['#FDA4AF', '#FECDD3', 'transparent']} style={styles.blobInner} />
      </Animated.View>
      <Animated.View style={[styles.blob, { top: -40, right: -80, transform: [{ scale: scale2 }] }]}>
        <LinearGradient colors={['#5EEAD4', '#99F6E4', 'transparent']} style={styles.blobInner} />
      </Animated.View>
      <Animated.View style={[styles.blob, { bottom: 120, left: -120, transform: [{ scale: scale2 }] }]}>
        <LinearGradient colors={['#FDBA74', '#FED7AA', 'transparent']} style={styles.blobInner} />
      </Animated.View>
      <Animated.View style={[styles.blob, { bottom: -60, right: -40, transform: [{ scale: scale1 }] }]}>
        <LinearGradient colors={['#F9A8D4', '#FBCFE8', 'transparent']} style={styles.blobInner} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  blob: {
    position: 'absolute',
    width: 280,
    height: 280,
    borderRadius: 140,
    overflow: 'hidden',
    opacity: 0.55,
  },
  blobInner: {
    flex: 1,
    borderRadius: 140,
  },
});
