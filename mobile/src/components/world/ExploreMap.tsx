import React, { forwardRef, useCallback, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import { buildExploreMapHtml, EXPLORE_MAP_HTML_REV } from '@/lib/mediWorld/exploreMapHtml';
import type { ExplorePlace } from '@/lib/mediWorld/types';
import { useIsDark, useThemeColors } from '@/theme/colors';

export type ExploreMapHandle = {
  sendState: (payload: {
    places: ExplorePlace[];
    user?: { lat: number; lng: number } | null;
    selectedId?: string | null;
    center?: { lat: number; lng: number };
  }) => void;
  centerOn: (lat: number, lng: number) => void;
};

type Props = {
  reduceMotion: boolean;
  onSelect: (id: string) => void;
  onProviderError: () => void;
  style?: object;
};

export const ExploreMap = forwardRef<ExploreMapHandle, Props>(function ExploreMap(
  { reduceMotion, onSelect, onProviderError, style },
  ref,
) {
  const colors = useThemeColors();
  const dark = useIsDark();
  const web = useRef<WebView>(null);
  const [ready, setReady] = useState(false);
  const html = useMemo(
    () => buildExploreMapHtml({ dark, reduceMotion }),
    [dark, reduceMotion, EXPLORE_MAP_HTML_REV],
  );

  const send = useCallback((msg: object) => {
    web.current?.postMessage(JSON.stringify(msg));
  }, []);

  useImperativeHandle(ref, () => ({
    sendState: (payload) => send({ type: 'state', ...payload }),
    centerOn: (lat, lng) => send({ type: 'center', lat, lng }),
  }));

  const onMessage = (event: WebViewMessageEvent) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'ready') setReady(true);
      if (data.type === 'select' && data.id) onSelect(data.id);
      if (data.type === 'provider-error') onProviderError();
    } catch {
      onProviderError();
    }
  };

  return (
    <View style={[{ flex: 1, backgroundColor: colors.bg200 }, style]}>
      <WebView
        ref={web}
        originWhitelist={['*']}
        source={{ html }}
        onMessage={onMessage}
        onError={() => onProviderError()}
        onHttpError={() => onProviderError()}
        javaScriptEnabled
        setSupportMultipleWindows={false}
        style={{ flex: 1, backgroundColor: 'transparent' }}
      />
      {!ready ? (
        <View style={{ position: 'absolute', left: 16, bottom: 16 }}>
          <Text style={{ color: colors.text300, fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 13 }}>…</Text>
        </View>
      ) : null}
    </View>
  );
});
