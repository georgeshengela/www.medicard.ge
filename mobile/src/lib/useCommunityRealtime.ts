import { useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { io, type Socket } from 'socket.io-client';
import { API_BASE_URL } from './api';
import { getToken } from './storage';

/** Invalidation events carry no content; HTTP always rechecks visibility and membership. */
export function useCommunityRealtime(enabled: boolean, onChange: () => Promise<void>) {
  const callback = useRef(onChange);
  callback.current = onChange;
  const [connected, setConnected] = useState(false);
  useEffect(() => {
    if (!enabled) return;
    let disposed = false, running = false, pending = false;
    let socket: Socket | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const refresh = async () => {
      if (disposed || AppState.currentState === 'background') return;
      if (running) { pending = true; return; }
      running = true;
      try { await callback.current(); } catch { /* Screen retains its last data; reconciliation retries. */ }
      finally { running = false; if (pending && !disposed) { pending = false; schedule(); } }
    };
    const schedule = () => { if (!timer) timer = setTimeout(() => { timer = undefined; void refresh(); }, 200); };
    void getToken().then(token => {
      if (disposed || !token) return;
      socket = io(API_BASE_URL + '/community', { auth: { token }, transports: ['websocket', 'polling'], reconnectionDelay: 1000, reconnectionDelayMax: 10000 });
      socket.on('connect', () => { if (!disposed) setConnected(true); schedule(); });
      socket.on('disconnect', () => { if (!disposed) setConnected(false); });
      socket.on('connect_error', () => { if (!disposed) setConnected(false); });
      socket.on('community:changed', schedule);
    }).catch(() => { if (!disposed) setConnected(false); });
    const state = AppState.addEventListener('change', value => {
      if (value === 'active') { socket?.connect(); schedule(); }
      else if (value === 'background') socket?.disconnect();
    });
    // Reconcile missed packets/restarts, including deployments across instances.
    const reconcile = setInterval(schedule, 30000);
    return () => { disposed = true; clearInterval(reconcile); if (timer) clearTimeout(timer); state.remove(); socket?.disconnect(); };
  }, [enabled]);
  return connected;
}
