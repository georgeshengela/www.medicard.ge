import React, { useCallback } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from 'expo-router';
import { useVideoPlayer, VideoView } from 'expo-video';
import { SYMPTOM_INTRO_POSTER, SYMPTOM_INTRO_VIDEO } from '@/constants/symptomAssets';

function safePlay(player: { play: () => void; pause: () => void }, action: 'play' | 'pause') {
  try {
    if (action === 'play') player.play();
    else player.pause();
  } catch {
    /* native player already released */
  }
}

/** Night-ad reel — real athletes, photoreal bones/veins only on the pain site. */
export function SymptomIntroHero() {
  const player = useVideoPlayer(SYMPTOM_INTRO_VIDEO, (next) => {
    next.loop = true;
    next.muted = true;
    safePlay(next, 'play');
  });

  useFocusEffect(
    useCallback(() => {
      safePlay(player, 'play');
      return () => safePlay(player, 'pause');
    }, [player]),
  );

  return (
    <View style={{ flex: 1, minHeight: 320, overflow: 'hidden', backgroundColor: '#030712' }}>
      <Image source={SYMPTOM_INTRO_POSTER} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
      <VideoView
        player={player}
        style={StyleSheet.absoluteFillObject}
        contentFit="cover"
        nativeControls={false}
        fullscreenOptions={{ enable: false }}
        surfaceType="textureView"
        pointerEvents="none"
      />
      <LinearGradient
        colors={['#030712', 'transparent', 'transparent', '#030712']}
        locations={[0, 0.14, 0.76, 1]}
        style={StyleSheet.absoluteFillObject}
        pointerEvents="none"
      />
    </View>
  );
}
