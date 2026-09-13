import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import Constants from 'expo-constants';
import { ka } from '@/i18n/ka';
import { buildWorldMapHtml, WORLD_MAP_HTML_REV } from '@/lib/mediWorld/worldMapHtml';
import { peekMapboxToken, resolveMapboxToken } from '@/lib/run/mapbox';
import type { ExplorePlace } from '@/lib/mediWorld/types';
import { useThemeColors } from '@/theme/colors';

export type ExploreMapHandle = {
  sendState: (payload: {
    places: ExplorePlace[];
    user?: { lat: number; lng: number } | null;
    selectedId?: string | null;
    center?: { lat: number; lng: number };
    zoom?: number;
  }) => void;
  centerOn: (lat: number, lng: number) => void;
  setDark: (dark: boolean) => void;
};

type Props = {
  reduceMotion: boolean;
  mapDark: boolean;
  initialCenter?: { lat: number; lng: number } | null;
  hereLabel?: string;
  onSelect: (id: string) => void;
  onProviderError: () => void;
  onReady?: () => void;
  style?: object;
};

function metroBaseUrl(): string {
  const host =
    Constants.expoConfig?.hostUri ??
    Constants.expoGoConfig?.debuggerHost ??
    'localhost:8081';
  const bare = String(host).replace(/^https?:\/\//, '').split('/')[0];
  return `http://${bare}/`;
}

/** Same Mapbox GL JS WebView stack as Running. Empty catalog still shows the basemap. */
export const ExploreMap = forwardRef<ExploreMapHandle, Props>(function ExploreMap(
  { reduceMotion, mapDark, initialCenter, hereLabel = 'აქ ხარ', onSelect, onProviderError, onReady, style },
  ref,
) {
  const colors = useThemeColors();
  const web = useRef<WebView>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState('');
  const [token, setToken] = useState(peekMapboxToken);
  const [tokenReady, setTokenReady] = useState(Boolean(peekMapboxToken().startsWith('pk.')));
  const initialDark = useRef(mapDark);
  const bootCenter = useRef<{ lat: number; lng: number } | null>(initialCenter || null);
  const [booted, setBooted] = useState(Boolean(initialCenter));

  useEffect(() => {
    if (!initialCenter || bootCenter.current) return;
    bootCenter.current = initialCenter;
    setBooted(true);
  }, [initialCenter]);

  useEffect(() => {
    let alive = true;
    void resolveMapboxToken().then((next) => {
      if (!alive) return;
      setToken(next);
      setTokenReady(true);
    });
    return () => {
      alive = false;
    };
  }, []);

  const html = useMemo(() => {
    if (!token.startsWith('pk.') || !bootCenter.current) return '';
    return buildWorldMapHtml({
      token,
      dark: initialDark.current,
      reduceMotion,
      center: bootCenter.current,
      hereLabel,
    });
  }, [token, reduceMotion, booted, hereLabel, WORLD_MAP_HTML_REV]);

  const send = useCallback((msg: object) => {
    const js = `window.__world && window.__world(${JSON.stringify(msg)}); true;`;
    web.current?.injectJavaScript(js);
  }, []);

  useImperativeHandle(
    ref,
    () => ({
      sendState: (payload) => send({ type: 'state', ...payload }),
      centerOn: (lat, lng) => send({ type: 'center', lat, lng }),
      setDark: (dark) => send({ type: 'theme', dark }),
    }),
    [send],
  );

  useEffect(() => {
    if (ready) send({ type: 'theme', dark: mapDark });
  }, [mapDark, ready, send]);

  const onMessage = (event: WebViewMessageEvent) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'ready') {
        setReady(true);
        onReady?.();
      }
      if (data.type === 'select' && data.id) onSelect(data.id);
      if (data.type === 'provider-error' || data.type === 'error') {
        const msg = data.message ?? 'map-error';
        setFailed(msg);
        onProviderError();
      }
    } catch {
      onProviderError();
    }
  };

  const tokenMissing = tokenReady && !token.startsWith('pk.');

  return (
    <View style={[styles.fill, { backgroundColor: mapDark ? '#0B1E1C' : '#DDF0EC' }, style]}>
      {html ? (
        <WebView
          key={token.slice(0, 16)}
          ref={web}
          originWhitelist={['*']}
          source={{ html, baseUrl: metroBaseUrl() }}
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
  fill: { flex: 1 },
  center: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, alignItems: 'center', justifyContent: 'center' },
});
