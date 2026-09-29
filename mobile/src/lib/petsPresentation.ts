import type { Pet, PetWriteBody } from './api';
import { getSpecies } from './petsCatalog.js';
import { tx } from '../i18n/locale.js';

export function parsePetDate(value: string, options: { allowFuture?: boolean; now?: Date } = {}): { ok: true; iso: string } | { ok: false; error: string } {
  const digits = value.replace(/\D/g, '');
  if (digits.length !== 8) return { ok: false, error: tx('შეიყვანე სრული თარიღი — დღე, თვე, წელი.', 'Enter the full date — day, month, year.') };
  const day = Number(digits.slice(0, 2)), month = Number(digits.slice(2, 4)), year = Number(digits.slice(4));
  const date = new Date(year, month - 1, day);
  if (year < 1900 || year > 2100 || date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return { ok: false, error: tx('ასეთი თარიღი არ არსებობს.', 'That date doesn’t exist.') };
  const now = options.now ?? new Date();
  if (!options.allowFuture && date > new Date(now.getFullYear(), now.getMonth(), now.getDate())) return { ok: false, error: tx('ჩანაწერის თარიღი მომავალში ვერ იქნება.', 'The record date can’t be in the future.') };
  return { ok: true, iso: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}` };
}
export function petBreedLabel(pet: Pick<Pet, 'speciesId' | 'breedId' | 'customBreed'>) {
  return pet.breedId === 'custom' ? pet.customBreed || tx('მითითებული ჯიში', 'Custom breed') : pet.breedId === 'mixed' ? tx('შერეული ჯიში', 'Mixed breed') : getSpecies(pet.speciesId)?.breeds.find((b: { id: string }) => b.id === pet.breedId)?.label || tx('ჯიში უცნობია', 'Breed unknown');
}
export function petSetupItems(pet: Pet) {
  return [
    { key: 'photo', label: tx('დაამატე ფოტო', 'Add a photo'), done: Boolean(pet.photoUrl), path: 'edit' },
    { key: 'age', label: tx('მიუთითე ასაკი, თუ იცი', 'Add their age, if you know it'), done: pet.ageKind !== 'UNKNOWN', path: 'edit' },
    { key: 'vet', label: tx('შეინახე ვეტერინარის კონტაქტი', 'Save your vet’s contact'), done: Boolean(pet.vetPhone || pet.vetName || pet.vetClinicName), path: 'edit' },
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
  if (!Number.isInteger(y) || y < 0 || y > 80) return tx('წლები უნდა იყოს 0–80.', 'Years must be 0–80.');
  if (!Number.isInteger(m) || m < 0 || m > 11) return tx('თვეები უნდა იყოს 0–11.', 'Months must be 0–11.');
  return y + m === 0 ? tx('მიუთითე ასაკი ან აირჩიე „არ ვიცი“.', 'Enter an age or choose “I don’t know”.') : null;
}

export function petCarePlanError(input: { kind: string | null; startDigits: string; endDigits: string; dueTime: string; times: string; recurrence: string; interval: string; limit: string }) {
  if (!input.kind) return tx('აირჩიე მოვლის ტიპი.', 'Choose a care type.');
  const start = parsePetDate(input.startDigits, { allowFuture: true });
  if (!start.ok) return tx(`პირველი თარიღი: ${start.error}`, `First date: ${start.error}`);
  if (input.endDigits) { const end = parsePetDate(input.endDigits, { allowFuture: true }); if (!end.ok) return tx(`დასრულების თარიღი: ${end.error}`, `End date: ${end.error}`); if (end.iso < start.iso) return tx('დასრულება პირველ თარიღზე ადრე ვერ იქნება.', 'The end can’t be before the first date.'); }
  const timeValid = (value: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(value.trim());
  if (input.recurrence !== 'DAILY_COURSE' && input.dueTime && !timeValid(input.dueTime)) return tx('საათი შეიყვანე ფორმატით სს:წწ, მაგალითად 09:00.', 'Enter the time as HH:MM, for example 09:00.');
  if (input.recurrence === 'DAILY_COURSE') {
    const times = input.times.split(',').map(value => value.trim());
    if (!times.length || times.some(value => !timeValid(value)) || new Set(times).size !== times.length) return tx('ჩაწერე განსხვავებული საათები, მაგალითად 08:00,20:00.', 'Enter different times, for example 08:00,20:00.');
    if (!input.endDigits && !input.limit) return tx('ყოველდღიური კურსისთვის მიუთითე დასრულების თარიღი ან გამეორებების რაოდენობა.', 'For a daily course, set an end date or a number of repeats.');
  }
  if (!['ONCE', 'DAILY_COURSE'].includes(input.recurrence) && (!Number.isInteger(Number(input.interval)) || Number(input.interval) < 1)) return tx('ინტერვალი დადებითი მთელი რიცხვი უნდა იყოს.', 'The interval must be a positive whole number.');
  if (input.limit && (!Number.isInteger(Number(input.limit)) || Number(input.limit) < 1)) return tx('გამეორებების რაოდენობა დადებითი მთელი რიცხვი უნდა იყოს.', 'The number of repeats must be a positive whole number.');
  return null;
}
