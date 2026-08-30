import { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { api } from '@/lib/api';

/** True when the API health check cannot be reached (airplane / no network). */
export function useOffline(): boolean {
  const [offline, setOffline] = useState(false);

  const check = useCallback(async () => {
    try {
      await api.health();
      setOffline(false);
    } catch {
      setOffline(true);
    }
  }, []);

  useEffect(() => {
    void check();
    const app = AppState.addEventListener('change', (next) => {
      if (next === 'active') void check();
    });
    const timer = setInterval(() => void check(), offline ? 8_000 : 20_000);
    return () => {
      app.remove();
      clearInterval(timer);
    };
  }, [check, offline]);

  return offline;
}
