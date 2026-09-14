import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import Constants from 'expo-constants';
import { h } from '@/lib/hunt/copy';
import { buildHuntMapHtml, HUNT_MAP_HTML_REV } from '@/lib/hunt/mapHtml';
import type { HuntSnapshot } from '@/lib/hunt/types';
import { peekMapboxToken, resolveMapboxToken } from '@/lib/run/mapbox';
import { useIsDark, useThemeColors } from '@/theme/colors';

export type HuntMapHandle = { sendState: (snap: HuntSnapshot) => void };

function metroBaseUrl() {
  const host = Constants.expoConfig?.hostUri ?? Constants.expoGoConfig?.debuggerHost ?? 'localhost:8081';
  const bare = String(host).replace(/^https?:\/\//, '').split('/')[0];
  return `http://${bare}/`;
}

function statePayload(snap: HuntSnapshot) {
  return {
    type: 'state',
    streets: snap.streets,
    bounds: snap.bounds,
    player: snap.player,
    enemies: snap.enemies,
    capsules: snap.capsules,
    hunting: snap.hunting,
  };
}

export const HuntMap = forwardRef<
  HuntMapHandle,
  { center: { lat: number; lng: number }; snap?: HuntSnapshot | null; locale?: string }
>(function HuntMap({ center, snap, locale = 'ka' }, ref) {
  const colors = useThemeColors();
  const dark = useIsDark();
  const web = useRef<WebView>(null);
  const [ready, setReady] = useState(false);
  const [token, setToken] = useState(() => peekMapboxToken());
  const [tokenReady, setTokenReady] = useState(() => peekMapboxToken().startsWith('pk.'));
  const copy = h(locale);
  const baseUrl = useMemo(() => metroBaseUrl(), []);
  const initialCenter = useRef(center);
  const initialDark = useRef(dark);
  const lastSnap = useRef<HuntSnapshot | null>(snap || null);

  useEffect(() => {
    let cancelled = false;
    void resolveMapboxToken().then((next) => {
      if (cancelled) return;
      setToken(next);
      setTokenReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const html = useMemo(
    () => (token.startsWith('pk.') ? buildHuntMapHtml({ token, center: initialCenter.current, dark: initialDark.current }) : ''),
    [token, HUNT_MAP_HTML_REV],
  );

  const sendState = useCallback((next: HuntSnapshot) => {
    lastSnap.current = next;
    web.current?.injectJavaScript(`window.__hunt && window.__hunt(${JSON.stringify(statePayload(next))}); true;`);
  }, []);

  useImperativeHandle(ref, () => ({ sendState }), [sendState]);

  useEffect(() => {
    if (snap) lastSnap.current = snap;
    if (ready && snap) sendState(snap);
  }, [snap, ready, sendState]);

  const onMessage = useCallback((e: WebViewMessageEvent) => {
    try {
      const data = JSON.parse(e.nativeEvent.data);
      if (data.type === 'ready') {
        setReady(true);
        if (lastSnap.current) {
          web.current?.injectJavaScript(
            `window.__hunt && window.__hunt(${JSON.stringify(statePayload(lastSnap.current))}); true;`,
          );
        }
      }
    } catch {
      /* ignore */
    }
  }, []);

  const tokenMissing = tokenReady && !token.startsWith('pk.');

  return (
    <View style={[styles.fill, { backgroundColor: dark ? '#030712' : '#e5eef0' }]}>
      {html ? (
        <WebView
          key={token.slice(0, 16)}
          ref={web}
          originWhitelist={['*']}
          source={{ html, baseUrl }}
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
          allowFileAccess
          allowFileAccessFromFileURLs
          allowUniversalAccessFromFileURLs
        />
      ) : null}
      {(!ready || tokenMissing) ? (
        <View pointerEvents="none" style={[styles.fill, styles.center]}>
          {!tokenMissing ? <ActivityIndicator color={colors.primary200} /> : null}
          <Text style={{ marginTop: 10, fontFamily: 'NotoSansGeorgian_500Medium', fontSize: 12.5, color: colors.text300 }}>
            {tokenMissing ? copy.unavailable : copy.preparing}
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
