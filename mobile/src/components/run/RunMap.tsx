import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import { Asset } from 'expo-asset';
import Constants from 'expo-constants';
import { ka } from '@/i18n/ka';
import type { LatLng } from '@/lib/run/geo';
import { buildRunMapHtml } from '@/lib/run/mapHtml';
import { peekMapboxToken, resolveMapboxToken } from '@/lib/run/mapbox';
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
  mapDark?: boolean;
};

const _mariaAsset = Asset.fromModule(require('../../../assets/characters/maria.glb'));

/** Classic UMD builds — three@0.148+ removed examples/js; 0.147 is the last with GLTFLoader UMD. */
const THREE_CDN = {
  three: 'https://cdn.jsdelivr.net/npm/three@0.147.0/build/three.min.js',
  gltf: 'https://cdn.jsdelivr.net/npm/three@0.147.0/examples/js/loaders/GLTFLoader.js',
  meshopt: 'https://cdn.jsdelivr.net/npm/meshoptimizer@0.22.0/meshopt_decoder.js',
};

function metroBaseUrl(): string {
  const host =
    Constants.expoConfig?.hostUri ??
    Constants.expoGoConfig?.debuggerHost ??
    'localhost:8081';
  const bare = String(host).replace(/^https?:\/\//, '').split('/')[0];
  return `http://${bare}/`;
}

async function assetHttpUrl(asset: Asset): Promise<string> {
  await asset.downloadAsync();
  const url = asset.uri;
  if (!url) throw new Error('asset.uri empty');
  return url;
}

/**
 * Mapbox GL JS map in a WebView. Maria GLB is rendered with Three.js (classic UMD
 * scripts served by Metro — RN WebView does not run <script type="module">).
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
    [token],
  );

  const send = useCallback((msg: RunMapMessage) => {
    const js = `window.__run && window.__run(${JSON.stringify(msg)}); true;`;
    web.current?.injectJavaScript(js);
  }, []);

  useImperativeHandle(ref, () => ({ send }), [send]);

  useEffect(() => {
    if (ready) send({ type: 'theme', dark });
  }, [dark, ready, send]);

  useEffect(() => {
    if (!ready) return;
    let cancelled = false;

    async function bootCharacter() {
      try {
        const character = await assetHttpUrl(_mariaAsset);
        if (cancelled) return;

        // Cache-bust so Metro doesn't keep serving a pre-fix GLB after bake.
        const characterUrl = character.includes('?') ? `${character}&v=4` : `${character}?v=4`;

        console.log('[RunMap] boot character', characterUrl.slice(0, 120));

        web.current?.injectJavaScript(
          `window.__bootCharacterLibs && window.__bootCharacterLibs(${JSON.stringify({
            ...THREE_CDN,
            character: characterUrl,
          })}); true;`,
        );
      } catch (e) {
        if (!cancelled) console.warn('[RunMap] character boot failed:', e);
      }
    }

    void bootCharacter();
    return () => {
      cancelled = true;
    };
  }, [ready]);

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
  fill: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  center: { alignItems: 'center', justifyContent: 'center' },
});
