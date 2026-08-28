import { useSyncExternalStore } from 'react';
import type { AnatomyMode, BodyPartId, BodySide, OrganId, SymptomCheckResult, SymptomGender, SymptomMethod } from '@/types/symptoms';

export type SymptomCheckerState = {
  method: SymptomMethod | null;
  mode: AnatomyMode;
  side: BodySide;
  gender: SymptomGender;
  selectedPartId: BodyPartId | null;
  selectedOrganId: OrganId | null;
  symptoms: string[];
  primarySymptom: string | null;
  durationId: string | null;
  painLevel: number | null;
  pastConditions: string;
  shareToNightingale: boolean;
  notes: string;
  result: SymptomCheckResult | null;
  recordId: string | null;
  interactionId: string | null;
  lastError: string | null;
};

const INITIAL: SymptomCheckerState = {
  method: null,
  mode: 'muscle',
  side: 'front',
  gender: 'MALE',
  selectedPartId: null,
  selectedOrganId: null,
  symptoms: [],
  primarySymptom: null,
  durationId: null,
  painLevel: null,
  pastConditions: '',
  shareToNightingale: false,
  notes: '',
  result: null,
  recordId: null,
  interactionId: null,
  lastError: null,
};

let state: SymptomCheckerState = { ...INITIAL };
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

function setState(patch: Partial<SymptomCheckerState>) {
  state = { ...state, ...patch };
  emit();
}

export function resetSymptomChecker(gender?: string | null) {
  state = {
    ...INITIAL,
    gender: gender === 'FEMALE' ? 'FEMALE' : 'MALE',
  };
  emit();
}

export function updateSymptomChecker(patch: Partial<SymptomCheckerState>) {
  setState(patch);
}

export function toggleSymptom(label: string) {
  const next = state.symptoms.includes(label)
    ? state.symptoms.filter((s) => s !== label)
    : [...state.symptoms, label].slice(0, 16);
  setState({ symptoms: next });
}

export function removeSymptom(label: string) {
  setState({ symptoms: state.symptoms.filter((s) => s !== label) });
}

export function getSymptomCheckerState() {
  return state;
}

export function useSymptomChecker() {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => state,
    () => state,
  );
}
