import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
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
  // The latest choice, readable from native event callbacks before React re-renders.
  const preferenceRef = useRef<ThemePreference | null>(null);

  useEffect(() => {
    let cancelled = false;

    getPreference(STORAGE_KEY)
      .then((stored) => {
        if (cancelled) return;
        const next = isPreference(stored) ? stored : 'system';
        preferenceRef.current = next;
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

  // Follow the system only once the stored choice is known, and only while it is „system“. On iOS
  // setColorScheme('light') answers with an async appearance event; a listener left over from the
  // initial 'system' state caught it and reset the app to the system theme — a phone in dark mode
  // opened dark while Profile still showed „light“ (owner 2026-10-11, after an update reload).
  useEffect(() => {
    if (!ready || preference !== 'system') return;
    const subscription = Appearance.addChangeListener(() => {
      if (preferenceRef.current === 'system') setColorScheme('system');
    });
    return () => subscription.remove();
  }, [ready, preference, setColorScheme]);

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
      preferenceRef.current = next;
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
