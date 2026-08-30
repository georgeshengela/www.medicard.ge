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

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const dark = colorScheme === 'dark';
    document.documentElement.classList.toggle('dark', dark);
    document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
    if (document.body) {
      document.body.classList.toggle('dark', dark);
      document.body.style.backgroundColor = dark ? '#030712' : '#f5f7f7';
    }

    const autofillId = 'medicard-web-autofill';
    if (!document.getElementById(autofillId)) {
      const style = document.createElement('style');
      style.id = autofillId;
      style.textContent = `
        .dark input:-webkit-autofill,
        .dark input:-webkit-autofill:hover,
        .dark input:-webkit-autofill:focus {
          -webkit-text-fill-color: #ffffff;
          caret-color: #ffffff;
          box-shadow: 0 0 0 1000px #1f2937 inset;
          transition: background-color 9999s ease-out 0s;
        }
      `;
      document.head.appendChild(style);
    }
  }, [colorScheme]);

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
