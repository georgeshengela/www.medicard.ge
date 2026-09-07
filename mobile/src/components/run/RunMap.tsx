import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import { ka } from '@/i18n/ka';
import type { LatLng } from '@/lib/run/geo';
import { buildRunMapHtml } from '@/lib/run/mapHtml';
import { MAPBOX_TOKEN, hasMapboxToken } from '@/lib/run/mapbox';
import { useIsDark, useThemeColors } from '@/theme/colors';

export type RunMapMessage =
  | { type: 'init'; origin: LatLng; pin: LatLng | null; route: [number, number][] | null; radiusM?: number; fit?: boolean }
  | { type: 'fix'; lat: number; lng: number; heading: number | null }
  | { type: 'trail'; coords: [number, number][] }
  | { type: 'fit'; bottom?: number }
  | { type: 'follow' }
  | { type: 'reached' }
  | { type: 'theme'; dark: boolean };

export type RunMapHandle = { send: (msg: RunMapMessage) => void };

type Props = {
  center: LatLng;
  onReady?: () => void;
  onFollowChange?: (following: boolean) => void;
  onError?: (message: string) => void;
  style?: object;
  /** Override the map light/dark preset (e.g. time-of-day auto theme). Defaults to the app theme. */
  mapDark?: boolean;
};

/**
 * Mapbox GL JS 3D map inside a WebView — Expo Go friendly (no native Mapbox SDK).
 * The HTML is built once from the initial center + theme; everything after goes through `send`.
 */
export const RunMap = forwardRef<RunMapHandle, Props>(function RunMap(
  { center, onReady, onFollowChange, onError, style, mapDark },
  ref,
) {
  const colors = useThemeColors();
  const appDark = useIsDark();
  const dark = mapDark ?? appDark;
  const web = useRef<WebView>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const initialDark = useRef(dark);
  const initialCenter = useRef(center);

  const html = useMemo(
    () => buildRunMapHtml({ token: MAPBOX_TOKEN, center: initialCenter.current, dark: initialDark.current }),
    [],
  );

  const send = useCallback((msg: RunMapMessage) => {
    const js = `window.__run && window.__run(${JSON.stringify(msg)}); true;`;
    web.current?.injectJavaScript(js);
  }, []);

  useImperativeHandle(ref, () => ({ send }), [send]);

  useEffect(() => {
    if (ready) send({ type: 'theme', dark });
  }, [dark, ready, send]);

  const onMessage = useCallback(
    (e: WebViewMessageEvent) => {
      let data: { type?: string; value?: boolean; message?: string } = {};
      try {
        data = JSON.parse(e.nativeEvent.data);
      } catch {
        return;
      }
      if (data.type === 'ready') {
        setReady(true);
        onReady?.();
      } else if (data.type === 'follow') {
        onFollowChange?.(Boolean(data.value));
      } else if (data.type === 'error') {
        const msg = data.message ?? 'map-error';
        setFailed(msg);
        onError?.(msg);
      }
    },
    [onError, onFollowChange, onReady],
  );

  const tokenMissing = !hasMapboxToken();

  return (
    <View style={[styles.fill, { backgroundColor: dark ? '#030712' : '#e5eef0' }, style]}>
      {!tokenMissing ? (
        <WebView
          ref={web}
          originWhitelist={['*']}
          source={{ html, baseUrl: 'https://medicard.ge' }}
          style={[styles.fill, { backgroundColor: 'transparent' }]}
          onMessage={onMessage}
          javaScriptEnabled
          domStorageEnabled
          allowsInlineMediaPlayback
          mixedContentMode="always"
          androidLayerType="hardware"
          overScrollMode="never"
          bounces={false}
          setSupportMultipleWindows={false}
          scrollEnabled={false}
        />
      ) : null}
      {(!ready || tokenMissing) && !failed ? (
        <View pointerEvents="none" style={[styles.fill, styles.center]}>
          {!tokenMissing ? <ActivityIndicator color={colors.primary200} /> : null}
          <Text
            style={{
              marginTop: 10,
              fontFamily: 'NotoSansGeorgian_500Medium',
              fontSize: 12.5,
              color: colors.text300,
            }}
          >
            {tokenMissing ? ka.run.noToken : ka.run.mapLoading}
          </Text>
        </View>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  fill: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  center: { alignItems: 'center', justifyContent: 'center' },
});
