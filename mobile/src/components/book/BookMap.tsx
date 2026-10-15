import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import Constants from 'expo-constants';
import { tx } from '@/i18n/locale';
import { BOOK_CATEGORIES } from '@/lib/book/categories';
import type { BookPin } from '@/lib/book/bookTypes';
import { BOOK_MAP_HTML_REV, buildBookMapHtml } from '@/lib/book/mapHtml';
import { peekMapboxToken, resolveMapboxToken } from '@/lib/run/mapbox';
import { useIsDark, useThemeColors } from '@/theme/colors';

export type BookMapBounds = { minLat: number; maxLat: number; minLng: number; maxLng: number; zoom: number };
export type BookMapMessage =
  | { type: 'pins'; pins: BookPin[] }
  | { type: 'me'; lat: number; lng: number; fly?: boolean }
  | { type: 'flyTo'; lat: number; lng: number; zoom?: number }
  | { type: 'select'; id: string | null }
  | { type: 'padding'; top?: number; bottom?: number };
export type BookMapHandle = { send: (message: BookMapMessage) => void };

function metroBaseUrl(): string {
  const host = Constants.expoConfig?.hostUri ?? Constants.expoGoConfig?.debuggerHost ?? 'localhost:8081';
  const bare = String(host).replace(/^https?:\/\//, '').split('/')[0];
  return `http://${bare}/`;
}

/**
 * The MEDIBOOK map (Mapbox GL JS in a WebView, like MEDIRUN's RunMap): every business as a dot in its
 * category colour, clusters when dense, the person's blue dot. Data and chrome are native; see mapHtml.ts.
 */
export const BookMap = forwardRef<BookMapHandle, {
  center: { lat: number; lng: number };
  zoom?: number;
  onReady?: () => void;
  onBounds?: (bounds: BookMapBounds) => void;
  onSelect?: (id: string | null) => void;
  onError?: (message: string) => void;
  style?: object;
}>(function BookMap({ center, zoom, onReady, onBounds, onSelect, onError, style }, ref) {
  const c = useThemeColors();
  const dark = useIsDark();
  const web = useRef<WebView>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const [token, setToken] = useState(() => peekMapboxToken());
  const [tokenReady, setTokenReady] = useState(() => peekMapboxToken().startsWith('pk.'));
  const initial = useRef({ center, zoom, dark });
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

  const colors = useMemo(() => Object.fromEntries(BOOK_CATEGORIES.map((cat) => [cat.id, cat.color])), []);
  const html = useMemo(
    () => (token.startsWith('pk.') ? buildBookMapHtml({ token, center: initial.current.center, zoom: initial.current.zoom, dark: initial.current.dark, colors }) : ''),
    [token, colors, BOOK_MAP_HTML_REV],
  );

  const raw = useCallback((payload: unknown) => {
    web.current?.injectJavaScript(`window.__book && window.__book(${JSON.stringify(payload)}); true;`);
  }, []);
  const send = useCallback((msg: BookMapMessage) => {
    if (msg.type === 'pins') {
      raw({
        type: 'pins',
        features: msg.pins.map((p) => ({ type: 'Feature', properties: { id: p.id, name: p.name, category: p.category, bookable: p.claimed ? 1 : 0 }, geometry: { type: 'Point', coordinates: [p.lng, p.lat] } })),
      });
      return;
    }
    raw(msg);
  }, [raw]);
  useImperativeHandle(ref, () => ({ send }), [send]);

  useEffect(() => {
    if (ready) raw({ type: 'theme', dark });
  }, [dark, ready, raw]);

  const onMessage = useCallback((e: WebViewMessageEvent) => {
    let data: { type?: string; id?: string | null; bounds?: BookMapBounds; message?: string } = {};
    try {
      data = JSON.parse(e.nativeEvent.data);
    } catch {
      return;
    }
    if (data.type === 'ready') {
      setReady(true);
      onReady?.();
    } else if (data.type === 'bounds' && data.bounds) onBounds?.(data.bounds);
    else if (data.type === 'select') onSelect?.(data.id ?? null);
    else if (data.type === 'error') {
      setFailed(data.message ?? 'map-error');
      onError?.(data.message ?? 'map-error');
    }
  }, [onBounds, onError, onReady, onSelect]);

  const tokenMissing = tokenReady && !token.startsWith('pk.');
  return (
    <View style={[s.fill, { backgroundColor: dark ? '#0b1220' : '#e9eef0' }, style]}>
      {html ? (
        <WebView
          key={token.slice(0, 16)}
          ref={web}
          originWhitelist={['*']}
          source={{ html, baseUrl }}
          style={[s.fill, { backgroundColor: 'transparent' }]}
          onMessage={onMessage}
          javaScriptEnabled
          domStorageEnabled
          allowsInlineMediaPlayback
          setSupportMultipleWindows={false}
          onShouldStartLoadWithRequest={(request) => request.url === baseUrl || request.url === 'about:blank' || request.url.startsWith('about:srcdoc')}
        />
      ) : null}
      {(!ready && !failed && !tokenMissing) ? (
        <View pointerEvents="none" style={s.overlay}>
          <ActivityIndicator color={c.primary200} />
        </View>
      ) : null}
      {failed || tokenMissing ? (
        <View style={s.overlay}>
          <Text style={{ color: c.text200, textAlign: 'center', paddingHorizontal: 32, fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 14, lineHeight: 21 }}>
            {tokenMissing ? tx('რუკა ამ ვერსიაში ვერ ჩაიტვირთა.', 'The map could not load in this version.') : failed}
          </Text>
        </View>
      ) : null}
    </View>
  );
});

const s = StyleSheet.create({
  fill: { flex: 1 },
  overlay: { position: 'absolute', inset: 0, alignItems: 'center', justifyContent: 'center' },
});
