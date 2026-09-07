import React, { useCallback } from 'react';
import { StyleSheet } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useVideoPlayer, VideoView } from 'expo-video';

const RUNNER_VIDEO = require('../../../assets/run/runner-sprint.mp4');

function safePlay(player: { play: () => void; pause: () => void }, action: 'play' | 'pause') {
  try {
    if (action === 'play') player.play();
    else player.pause();
  } catch {
    /* native player already released */
  }
}

export function RunnerHeroVideo() {
  const player = useVideoPlayer(RUNNER_VIDEO, (next) => {
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
    <VideoView
      player={player}
      style={StyleSheet.absoluteFill}
      contentFit="cover"
      nativeControls={false}
      fullscreenOptions={{ enable: false }}
      surfaceType="textureView"
      pointerEvents="none"
    />
  );
}
