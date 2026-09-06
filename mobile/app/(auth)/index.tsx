import React, { useEffect, useRef, useState } from 'react';
import { Animated, Text, View, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MedicardLogoMark } from '@/components/ui/MedicardLogoMark';

const FILL_MS = 1600;

/** Water-fill progress, then welcome. */
export default function AuthSplash() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { height: screenH } = useWindowDimensions();
  const fillHeight = useRef(new Animated.Value(0)).current;
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const started = Date.now();

    const tick = setInterval(() => {
      const next = Math.min(100, Math.round(((Date.now() - started) / FILL_MS) * 100));
      setProgress(next);
      Animated.timing(fillHeight, {
        toValue: next,
        duration: 120,
        useNativeDriver: false,
      }).start();
    }, 80);

    const done = setTimeout(() => {
      clearInterval(tick);
      if (!cancelled) router.replace('/(auth)/welcome');
    }, FILL_MS);

    return () => {
      cancelled = true;
      clearInterval(tick);
      clearTimeout(done);
    };
  }, [router, fillHeight]);

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
        <MedicardLogoMark size={52} tone={progress >= 78 ? 'inverse' : 'brand'} />
      </View>
    </View>
  );
}
