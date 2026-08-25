import React, { useEffect, useRef, useState } from 'react';
import { Animated, Text, View, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BrandLogo } from '@/components/ui/BrandLogo';

const MIN_BRAND_MS = 1200;
const MIN_LOADING_MS = 1000;

/** Figma Splash & Loading — teal brand mark, then water-fill progress. */
export default function AuthSplash() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { height: screenH } = useWindowDimensions();
  const scale = useRef(new Animated.Value(0.92)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const fillHeight = useRef(new Animated.Value(0)).current;
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scale, { toValue: 1, friction: 8, tension: 70, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 1, duration: 450, useNativeDriver: true }),
    ]).start();

    let cancelled = false;
    const started = Date.now();

    void (async () => {
      await wait(Math.max(0, MIN_BRAND_MS - (Date.now() - started)));
      if (cancelled) return;
      setLoading(true);

      const loadStart = Date.now();
      const tick = setInterval(() => {
        const elapsed = Date.now() - loadStart;
        const next = Math.min(100, Math.round((elapsed / MIN_LOADING_MS) * 100));
        setProgress(next);
        Animated.timing(fillHeight, {
          toValue: next,
          duration: 120,
          useNativeDriver: false,
        }).start();
      }, 80);

      await wait(MIN_LOADING_MS);
      clearInterval(tick);
      if (cancelled) return;

      router.replace('/(auth)/welcome');
    })();

    return () => {
      cancelled = true;
    };
  }, [router, opacity, scale, fillHeight]);

  if (!loading) {
    return (
      <View className="flex-1 items-center justify-center bg-primary-200">
        <Animated.View style={{ opacity, transform: [{ scale }] }}>
          <BrandLogo size={96} variant="plain" inverse />
        </Animated.View>
      </View>
    );
  }

  const fillPx = fillHeight.interpolate({
    inputRange: [0, 100],
    outputRange: [0, screenH],
  });

  const onWater = progress >= 42;

  return (
    <View className="flex-1 bg-bg-100">
      <Animated.View
        pointerEvents="none"
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: fillPx,
          overflow: 'hidden',
        }}
      >
        <LinearGradient
          colors={['#5eead4', '#14b8a6', '#0f766e']}
          locations={[0, 0.45, 1]}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={{ flex: 1 }}
        />
        <View
          style={{
            position: 'absolute',
            top: -5,
            left: '-15%',
            width: '130%',
            height: 10,
            borderRadius: 999,
            backgroundColor: 'rgba(255,255,255,0.22)',
          }}
        />
      </Animated.View>

      <View className="flex-1 items-center justify-center px-10" style={{ zIndex: 2 }}>
        <Text
          className="font-sans-bold text-[56px] leading-none"
          style={{ color: onWater ? '#FFFFFF' : '#0f1a1c' }}
        >
          {progress}
          <Text className="font-sans text-[40px]" style={{ color: onWater ? 'rgba(255,255,255,0.75)' : '#7b8b8f' }}>
            %
          </Text>
        </Text>
      </View>

      <View
        className="absolute left-0 right-0 items-center"
        style={{ bottom: insets.bottom + 32, zIndex: 2 }}
      >
        <BrandLogo size={52} variant="plain" inverse={progress >= 78} />
      </View>
    </View>
  );
}

function wait(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
