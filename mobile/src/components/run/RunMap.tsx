import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import Constants from 'expo-constants';
import { ka } from '@/i18n/ka';
import type { LatLng } from '@/lib/run/geo';
import { buildRunMapHtml, RUN_MAP_HTML_REV } from '@/lib/run/mapHtml';
import { peekMapboxToken, resolveMapboxToken } from '@/lib/run/mapbox';
import { useIsDark, useThemeColors } from '@/theme/colors';

import type {RunMapHandle,RunMapMessage,RunMapProps as Props} from '@/lib/run/mapTypes';
export type {RunMapHandle,RunMapMessage} from '@/lib/run/mapTypes';

function metroBaseUrl(): string {
  const host =
    Constants.expoConfig?.hostUri ??
    Constants.expoGoConfig?.debuggerHost ??
    'localhost:8081';
  const bare = String(host).replace(/^https?:\/\//, '').split('/')[0];
  return `http://${bare}/`;
}

/**
 * Mapbox GL JS map in a WebView. Location uses the original teal puck
 * (3D character overlay is parked for now).
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
  const [token, setToken] = useState(() => peekMapboxToken());
  const [tokenReady, setTokenReady] = useState(() => peekMapboxToken().startsWith('pk.'));
  const initialDark = useRef(dark);
  const initialCenter = useRef(center);
  const baseUrl = useMemo(() => metroBaseUrl(), []);

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
    () =>
      token.startsWith('pk.')
        ? buildRunMapHtml({ token, center: initialCenter.current, dark: initialDark.current })
        : '',
    [token, RUN_MAP_HTML_REV],
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
      let data: { type?: string; value?: boolean; message?: string; msg?: string } = {};
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
      } else if (data.type === 'char_debug') {
        console.log('[RunMap WebView]', data.msg);
      }
    },
    [onError, onFollowChange, onReady],
  );

  const tokenMissing = tokenReady && !token.startsWith('pk.');

  return (
    <View style={[styles.fill, { backgroundColor: dark ? '#030712' : '#e5eef0' }, style]}>
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
          mixedContentMode="never"
          onShouldStartLoadWithRequest={request=>request.url===baseUrl||request.url==='about:blank'||request.url.startsWith('about:srcdoc')}
          androidLayerType="hardware"
          overScrollMode="never"
          bounces={false}
          setSupportMultipleWindows={false}
          scrollEnabled={false}
          allowFileAccess={false}
          allowFileAccessFromFileURLs={false}
          allowUniversalAccessFromFileURLs={false}
        />
      ) : null}
      {(!ready || tokenMissing || failed) ? (
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
            {failed || (tokenMissing ? ka.run.noToken : ka.run.mapLoading)}
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
