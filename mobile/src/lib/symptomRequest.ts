import { bodyPartById, DURATION_OPTIONS, organById } from '@/constants/symptomCatalog';
import type { SymptomCheckerState } from './symptomCheckerStore';
import type { SymptomCheckPayload } from '@/types/symptoms';

/** Capture one immutable request so later edits cannot change an in-flight analysis. */
export function buildSymptomRequest(input: SymptomCheckerState): SymptomCheckPayload {
  const anatomy = input.method === 'anatomy';
  const part = anatomy && input.mode === 'muscle' ? bodyPartById(input.selectedPartId) : null;
  const organ = anatomy && input.mode === 'organ' ? organById(input.selectedOrganId) : null;
  const primary = input.symptoms.find(s => s === input.primarySymptom);
  return {
    symptoms: [...input.symptoms], primarySymptom: primary,
    includeHealthProfile: input.shareToNightingale,
    method: anatomy ? 'anatomy' : 'manual', mode: anatomy ? input.mode : 'search',
    bodyPartId: part?.id, bodyPartKa: part?.labelKa, organId: organ?.id, organKa: organ?.labelKa,
    durationKa: DURATION_OPTIONS.find(d => d.id === input.durationId)?.labelKa,
    painLevel: input.painLevel ?? undefined,
    notes: [input.pastConditions.trim() && `წარსული დაავადებები: ${input.pastConditions.trim().slice(0, 800)}`, input.notes.trim().slice(0, 300)].filter(Boolean).join('\n') || undefined,
  };
}
