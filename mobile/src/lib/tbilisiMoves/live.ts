const listeners = new Set<() => void>();

export function subscribeTbilisiMovesLive(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function requestTbilisiMovesLive() {
  listeners.forEach((listener) => {
    try {
      listener();
    } catch {
      // A stale hub unmount must not break the socket.
    }
  });
}
