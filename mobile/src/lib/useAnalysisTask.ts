import { useLayoutEffect, useMemo, useRef } from 'react';
import { createRequestGate } from '@/lib/analysisFlow';
import { localAccountId } from '@/lib/localAccount';

/** Ignore responses from a previous account, route, or unmounted screen. */
export function useAnalysisTask(scope: string) {
  const latest = useRef(scope);
  latest.current = scope;
  const task = useMemo(() => {
    const gate = createRequestGate();
    let mounted = true;
    return {
      begin() {
        const ticket = gate.begin();
        if (!ticket) return null;
        const owner = localAccountId();
        return {
          current: () => mounted && latest.current === scope && localAccountId() === owner && gate.isCurrent(ticket),
          finish: () => gate.finish(ticket),
        };
      },
      activate() { mounted = true; },
      invalidate() { mounted = false; gate.reset(); },
    };
  }, [scope]);
  useLayoutEffect(() => { task.activate(); return () => task.invalidate(); }, [task]);
  return task;
}
