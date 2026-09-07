import React from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { FullWindowOverlay } from 'react-native-screens';

/**
 * Chrome that must sit above native screens (tab pill, quest toasts).
 * iOS UIViewControllers cover React siblings — FullWindowOverlay is required there.
 * Android siblings with elevation stay on top.
 */
export function AppChromeOverlay({
  children,
  interactive = true,
}: {
  children: React.ReactNode;
  interactive?: boolean;
}) {
  const layer = (
    <View pointerEvents={interactive ? 'box-none' : 'none'} style={StyleSheet.absoluteFill}>
      {children}
    </View>
  );

  if (Platform.OS === 'ios') {
    if (!interactive) return null;
    return <FullWindowOverlay>{layer}</FullWindowOverlay>;
  }

  return (
    <View
      pointerEvents={interactive ? 'box-none' : 'none'}
      style={[StyleSheet.absoluteFill, { zIndex: 100, elevation: interactive ? 24 : 0 }]}
    >
      {children}
    </View>
  );
}
