/**
 * MEDISCAN (owner 2026-10-03): lab results, imaging (X-ray, ultrasound, MRI, CT) and skin photos are
 * read in ONE chat with a choice of what is being read. The endpoints stay the same
 * (/api/ai/extract-lab + explain-lab, /api/ai/analyze-image); a question about the latest result goes
 * to the clinical model (/api/ai/query DOCTOR) with that result as context.
 * Pure: no I/O, no React.
 */
import { tx } from '../i18n/locale.js';
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

/** The parts of one /api/ai/extract-lab answer the page loop needs. */
export type LabPageAnswer = { record: { id: string }; unreadable?: boolean; unavailable?: boolean };
export type LabPagesRead<T extends LabPageAnswer> = {
  /** Every page that came back, in order (the last one holds the whole record). */
  answers: T[];
  /** 1-based pages that could not be read: a retake helps. */
  unreadPages: number[];
  /** 1-based pages the reader could not look at right now (it was down): the same photo, later. */
  laterPages: number[];
};

/** The server's „no values on this sheet“ (422) — never the reader being down (503 AI_ENGINE_ERROR). */
export function isLabUnreadable(error: unknown): boolean {
  return !!error && typeof error === 'object' && (error as { code?: unknown }).code === 'LAB_UNREADABLE';
}

/**
 * Reads lab pages one by one (MEDISCAN F8, 2026-10-09). The first page that reads starts the record and
 * every later page is appended to it. A page found unreadable before anything was read (a cover page, a
 * blurry first photo) is skipped and reported instead of failing the whole result; the read fails only
 * when every page is unreadable, with that first page's own error. Any other failure (the reader down,
 * consent, the limit, the network) stops the read as before. Null once `live()` turns false.
 */
export async function readLabPages<T extends LabPageAnswer>(
  count: number,
  readPage: (index: number, recordId: string | undefined) => Promise<T>,
  live: () => boolean = () => true,
): Promise<LabPagesRead<T> | null> {
  const answers: T[] = [];
  const unreadPages: number[] = [];
  const laterPages: number[] = [];
  let recordId: string | undefined;
  let firstUnreadable: unknown = null;
  for (let index = 0; index < count; index += 1) {
    if (!live()) return null;
    let answer: T;
    try {
      answer = await readPage(index, recordId);
    } catch (error) {
      if (recordId || !isLabUnreadable(error)) throw error;
      if (!live()) return null;
      unreadPages.push(index + 1);
      firstUnreadable = firstUnreadable ?? error;
      continue;
    }
    if (!live()) return null;
    if (answer.unreadable) (answer.unavailable ? laterPages : unreadPages).push(index + 1);
    recordId = answer.record.id;
    answers.push(answer);
  }
  if (!answers.length) throw firstUnreadable ?? new Error('No lab page was read.');
  return { answers, unreadPages, laterPages };
}

/** What she reads under the result when some pages were not read; null when every page was. */
export function labPagesNotice(unreadPages: readonly number[], laterPages: readonly number[], t: (ka: string, en: string) => string = tx): string | null {
  const lines: string[] = [];
  if (unreadPages.length) {
    const list = unreadPages.join(', ');
    lines.push(t(
      `${list} გვერდი ვერ წავიკითხეთ. გადაუღე ხელახლა პირდაპირ და კარგ შუქზე, რომ ციფრები მკაფიოდ ჩანდეს.`,
      `We could not read page ${list}. Take it again straight on and in good light so the numbers are sharp.`,
    ));
  }
  if (laterPages.length) {
    const list = laterPages.join(', ');
    lines.push(t(
      `${list} გვერდი ახლა ვერ წავიკითხეთ — სერვისი დროებით მიუწვდომელია. ხელახლა გადაღება არ გჭირდება: იგივე ფოტო ისევ აქ არის, სცადე ცოტა ხანში.`,
      `We couldn’t read page ${list} right now — the service is temporarily unavailable. No need to retake it: the same photo is still here, try again in a little while.`,
    ));
  }
  return lines.length ? lines.join(' ') : null;
}
