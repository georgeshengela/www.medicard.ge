/**
 * MEDISCAN (owner 2026-10-03): lab results, imaging (X-ray, ultrasound, MRI, CT) and skin photos are
 * read in ONE chat with a choice of what is being read. The endpoints stay the same
 * (/api/ai/extract-lab + explain-lab, /api/ai/analyze-image); a question about the latest result goes
 * to the clinical model (/api/ai/query DOCTOR) with that result as context.
 * Pure: no I/O, no React.
 */
import type { LabExtract, LabParameter } from '../types/lab';

export type ScanKind = 'LAB' | 'IMAGING' | 'SKIN';
export const SCAN_KINDS: readonly ScanKind[] = ['LAB', 'IMAGING', 'SKIN'];

/** The admin switch („მოდულები“) behind each choice. */
export const SCAN_FEATURE: Record<ScanKind, 'labs' | 'imaging' | 'skin'> = { LAB: 'labs', IMAGING: 'imaging', SKIN: 'skin' };

/** ?type=lab|imaging|skin (any case) → the choice; anything else → none. */
export function scanKindFromParam(raw: string | string[] | undefined | null): ScanKind | null {
  const value = String(Array.isArray(raw) ? raw[0] : raw ?? '').trim().toLowerCase();
  if (value === 'lab' || value === 'labs') return 'LAB';
  if (value === 'imaging') return 'IMAGING';
  if (value === 'skin') return 'SKIN';
  return null;
}

export function scanHref(kind?: ScanKind | null): string {
  return kind ? `/scan?type=${kind.toLowerCase()}` : '/scan';
}

export type ScanFile = { uri: string; name: string; mimeType: string; isPdf: boolean };

export type ScanTurn =
  | { id: string; kind: 'upload'; scan: ScanKind; files: ScanFile[]; note: string; region?: string }
  | { id: string; kind: 'result'; scan: 'IMAGING' | 'SKIN'; text: string; recordId: string; region?: string }
  | { id: string; kind: 'lab'; extract: LabExtract; recordId: string; visionNotes?: string; savedDate?: string; analysis?: string; note: string }
  | { id: string; kind: 'question'; text: string }
  | { id: string; kind: 'answer'; text: string; streaming?: boolean; interactionId?: string; feedbackRating?: 1 | -1 };

let counter = 0;
export function scanTurnId(): string {
  counter = (counter + 1) % 1_000_000;
  return `s${Date.now().toString(36)}${counter.toString(36)}`;
}

const CONTEXT_LIMIT = 3800;

function labLine(p: LabParameter): string {
  const range = p.refLow != null || p.refHigh != null ? ` (norm ${p.refLow ?? ''}–${p.refHigh ?? ''})` : '';
  const flag = p.flag === 'H' ? ' [high]' : p.flag === 'L' ? ' [low]' : '';
  return `${p.nameEn || p.nameKa}: ${p.display} ${p.unit}${range}${flag}`.trim();
}

/**
 * The latest result as context for a follow-up question. Only what this chat produced — values and
 * the written review — never the photos. Bounded to the server's 4000-character context field.
 */
export function latestResultContext(turns: readonly ScanTurn[]): string | null {
  for (let i = turns.length - 1; i >= 0; i -= 1) {
    const turn = turns[i];
    if (turn.kind === 'result') {
      const head = turn.scan === 'IMAGING' ? `Imaging review${turn.region ? ` (${turn.region})` : ''}` : 'Skin photo review';
      return `${head} from MEDISCAN, the question below is about it:\n${turn.text}`.slice(0, CONTEXT_LIMIT);
    }
    if (turn.kind === 'lab' && turn.extract.parameters.length) {
      const lines = turn.extract.parameters.map(labLine).join('\n');
      const date = turn.savedDate || turn.extract.date;
      const body = `Lab results${date ? ` from ${date}` : ''} read by MEDISCAN, the question below is about them:\n${lines}${turn.analysis ? `\n\nReview:\n${turn.analysis}` : ''}`;
      return body.slice(0, CONTEXT_LIMIT);
    }
  }
  return null;
}

/** A question can be asked once something has been read; until then the composer asks for a file. */
export function canAskAboutResult(turns: readonly ScanTurn[]): boolean {
  return latestResultContext(turns) !== null;
}
