import type { Pet, PetWriteBody } from './api';
import { getSpecies } from './petsCatalog.js';

export function parsePetDate(value: string, options: { allowFuture?: boolean; now?: Date } = {}): { ok: true; iso: string } | { ok: false; error: string } {
  const digits = value.replace(/\D/g, '');
  if (digits.length !== 8) return { ok: false, error: 'შეიყვანე სრული თარიღი — დღე, თვე, წელი.' };
  const day = Number(digits.slice(0, 2)), month = Number(digits.slice(2, 4)), year = Number(digits.slice(4));
  const date = new Date(year, month - 1, day);
  if (year < 1900 || year > 2100 || date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return { ok: false, error: 'ასეთი თარიღი არ არსებობს.' };
  const now = options.now ?? new Date();
  if (!options.allowFuture && date > new Date(now.getFullYear(), now.getMonth(), now.getDate())) return { ok: false, error: 'ჩანაწერის თარიღი მომავალში ვერ იქნება.' };
  return { ok: true, iso: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}` };
}
export function petBreedLabel(pet: Pick<Pet, 'speciesId' | 'breedId' | 'customBreed'>) {
  return pet.breedId === 'custom' ? pet.customBreed || 'მითითებული ჯიში' : pet.breedId === 'mixed' ? 'შერეული ჯიში' : getSpecies(pet.speciesId)?.breeds.find((b: { id: string }) => b.id === pet.breedId)?.label || 'ჯიში უცნობია';
}
export function petSetupItems(pet: Pet) {
  return [
    { key: 'photo', label: 'დაამატე ფოტო', done: Boolean(pet.photoUrl), path: 'edit' },
    { key: 'age', label: 'მიუთითე ასაკი, თუ იცი', done: pet.ageKind !== 'UNKNOWN', path: 'edit' },
    { key: 'vet', label: 'შეინახე ვეტერინარის კონტაქტი', done: Boolean(pet.vetPhone || pet.vetName || pet.vetClinicName), path: 'edit' },
  ];
}
/** Explicitly clear incompatible age fields when switching modes; preserve the estimate's anchor date. */
export function identityAgeBody(kind: Pet['ageKind'], birthDigits: string, years: string, months: string, recordedOn?: string | null): Pick<PetWriteBody, 'ageKind' | 'birthDate' | 'approxAgeYears' | 'approxAgeMonths' | 'approxAgeRecordedOn'> {
  const empty = { ageKind: kind, birthDate: null, approxAgeYears: null, approxAgeMonths: null, approxAgeRecordedOn: null };
  if (kind === 'EXACT') { const parsed = parsePetDate(birthDigits); return { ...empty, birthDate: parsed.ok ? parsed.iso : '' }; }
  if (kind === 'APPROXIMATE') return { ...empty, approxAgeYears: years === '' ? null : Number(years), approxAgeMonths: months === '' ? null : Number(months), approxAgeRecordedOn: recordedOn || null };
  return empty;
}
export function approximateAgeError(years: string, months: string) {
  const y = years === '' ? 0 : Number(years), m = months === '' ? 0 : Number(months);
  if (!Number.isInteger(y) || y < 0 || y > 80) return 'წლები უნდა იყოს 0–80.';
  if (!Number.isInteger(m) || m < 0 || m > 11) return 'თვეები უნდა იყოს 0–11.';
  return y + m === 0 ? 'მიუთითე ასაკი ან აირჩიე „არ ვიცი“.' : null;
}

export function petCarePlanError(input: { kind: string | null; startDigits: string; endDigits: string; dueTime: string; times: string; recurrence: string; interval: string; limit: string }) {
  if (!input.kind) return 'აირჩიე მოვლის ტიპი.';
  const start = parsePetDate(input.startDigits, { allowFuture: true });
  if (!start.ok) return `პირველი თარიღი: ${start.error}`;
  if (input.endDigits) { const end = parsePetDate(input.endDigits, { allowFuture: true }); if (!end.ok) return `დასრულების თარიღი: ${end.error}`; if (end.iso < start.iso) return 'დასრულება პირველ თარიღზე ადრე ვერ იქნება.'; }
  const timeValid = (value: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(value.trim());
  if (input.recurrence !== 'DAILY_COURSE' && input.dueTime && !timeValid(input.dueTime)) return 'საათი შეიყვანე ფორმატით სს:წწ, მაგალითად 09:00.';
  if (input.recurrence === 'DAILY_COURSE') {
    const times = input.times.split(',').map(value => value.trim());
    if (!times.length || times.some(value => !timeValid(value)) || new Set(times).size !== times.length) return 'ჩაწერე განსხვავებული საათები, მაგალითად 08:00,20:00.';
    if (!input.endDigits && !input.limit) return 'ყოველდღიური კურსისთვის მიუთითე დასრულების თარიღი ან გამეორებების რაოდენობა.';
  }
  if (!['ONCE', 'DAILY_COURSE'].includes(input.recurrence) && (!Number.isInteger(Number(input.interval)) || Number(input.interval) < 1)) return 'ინტერვალი დადებითი მთელი რიცხვი უნდა იყოს.';
  if (input.limit && (!Number.isInteger(Number(input.limit)) || Number(input.limit) < 1)) return 'გამეორებების რაოდენობა დადებითი მთელი რიცხვი უნდა იყოს.';
  return null;
}
