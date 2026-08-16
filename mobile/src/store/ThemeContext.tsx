import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Appearance } from 'react-native';
import { useColorScheme } from 'nativewind';
import { getPreference, setPreference } from '@/lib/storage';

/**
 * Theme preference.
 *
 * NativeWind tracks the *resolved* scheme (light or dark). It does not remember whether
 * the user asked for a fixed theme or for "follow the system", so the preference is
 * stored here and pushed into NativeWind on boot and on every change.
 */

const STORAGE_KEY = 'medicard.theme.preference';

export type ThemePreference = 'light' | 'dark' | 'system';

const isPreference = (value: string | null): value is ThemePreference =>
  value === 'light' || value === 'dark' || value === 'system';

type ThemeState = {
  /** What the user chose. */
  preference: ThemePreference;
  /** What is actually on screen once `system` is resolved. */
  scheme: 'light' | 'dark';
  ready: boolean;
  setPreference: (preference: ThemePreference) => void;
};

const ThemeContext = createContext<ThemeState | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { colorScheme, setColorScheme } = useColorScheme();
  const [preference, setPreferenceState] = useState<ThemePreference>('system');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    getPreference(STORAGE_KEY)
      .then((stored) => {
        if (cancelled) return;
        const next = isPreference(stored) ? stored : 'system';
        setPreferenceState(next);
        setColorScheme(next);
      })
      .finally(() => {
        if (!cancelled) setReady(true);
      });

    return () => {
      cancelled = true;
    };
  }, [setColorScheme]);

  useEffect(() => {
    if (preference !== 'system') return;
    const subscription = Appearance.addChangeListener(() => {
      setColorScheme('system');
    });
    return () => subscription.remove();
  }, [preference, setColorScheme]);

  const choose = useCallback(
    (next: ThemePreference) => {
      setPreferenceState(next);
      setColorScheme(next);
      void setPreference(STORAGE_KEY, next);
    },
    [setColorScheme],
  );

  const value = useMemo<ThemeState>(
    () => ({
      preference,
      scheme: colorScheme === 'dark' ? 'dark' : 'light',
      ready,
      setPreference: choose,
    }),
    [preference, colorScheme, ready, choose],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeState {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used inside <ThemeProvider>');
  return context;
}
