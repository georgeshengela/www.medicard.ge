import React, { createContext, useContext, useMemo } from 'react';
import { View } from 'react-native';
import {
  NotoSansGeorgian_400Regular,
  NotoSansGeorgian_500Medium,
  NotoSansGeorgian_600SemiBold,
  NotoSansGeorgian_700Bold,
  useFonts,
} from '@expo-google-fonts/noto-sans-georgian';
import { BrandLogo } from '@/components/ui/BrandLogo';

type FontsState = {
  ready: boolean;
  regular: string;
  medium: string;
  semibold: string;
  bold: string;
  /** MediFont regular — available for lighter brand uses. */
  brand: string;
  /** MediFont bold — default wordmark weight. */
  brandBold: string;
};

const FontsContext = createContext<FontsState | null>(null);

export function FontsProvider({ children }: { children: React.ReactNode }) {
  const [loaded] = useFonts({
    NotoSansGeorgian_400Regular,
    NotoSansGeorgian_500Medium,
    NotoSansGeorgian_600SemiBold,
    NotoSansGeorgian_700Bold,
    MediFont: require('../../assets/fonts/medifont.ttf'),
    MediFontBold: require('../../assets/fonts/medifontbold.otf'),
  });

  const value = useMemo<FontsState>(
    () => ({
      ready: loaded,
      regular: 'NotoSansGeorgian_400Regular',
      medium: 'NotoSansGeorgian_500Medium',
      semibold: 'NotoSansGeorgian_600SemiBold',
      bold: 'NotoSansGeorgian_700Bold',
      brand: 'MediFont',
      brandBold: 'MediFontBold',
    }),
    [loaded],
  );

  if (!loaded) {
    return (
      <View className="flex-1 items-center justify-center bg-primary-200">
        <BrandLogo size={96} variant="brand" />
      </View>
    );
  }

  return <FontsContext.Provider value={value}>{children}</FontsContext.Provider>;
}

export function useFontsFamily(): FontsState {
  const ctx = useContext(FontsContext);
  if (!ctx) throw new Error('useFontsFamily must be used inside <FontsProvider>');
  return ctx;
}
