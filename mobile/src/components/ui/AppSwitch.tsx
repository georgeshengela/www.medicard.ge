import React from 'react';
import { Platform, Switch as RNSwitch, type SwitchProps } from 'react-native';

/**
 * The app's switch: React Native's, plus a white thumb when on in the web preview. react-native-web
 * paints the „on“ thumb with its own `activeThumbColor` (teal #009688) and ignores `thumbColor`,
 * which left a teal knob on a rose track with the women's brand tone (owner 2026-10-04).
 */
export function Switch(props: SwitchProps) {
  if (Platform.OS !== 'web') return <RNSwitch {...props} />;
  const thumb = props.thumbColor ?? '#FFFFFF';
  return <RNSwitch {...props} {...({ activeThumbColor: thumb } as object)} />;
}
