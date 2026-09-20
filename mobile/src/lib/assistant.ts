import { localAccountId } from './localAccount';

export type AssistantScope = 'human' | 'pet';
export type AssistantAction = { tool: string; args: Record<string, unknown> };
export type AssistantReview = AssistantAction & { id: string; label: string; token: string };
export type AssistantPlan = { reply: string; review: AssistantReview | null; draft: AssistantAction | null; contextDomains: string[] };
export type AssistantSchema = { type?: string; properties?: Record<string, AssistantSchema>; required?: string[]; enum?: (string | number | boolean)[]; const?: string | number | boolean; items?: AssistantSchema; minimum?: number; maximum?: number; maxLength?: number };
export type AssistantChoices = Record<string, { value: string; label: string }[]>;
export type AssistantTool = { name: string; label: string; description: string; parameters: AssistantSchema };
export type AssistantNative = { route: string; message?: string; mode?: string; petId?: string };
type Launch = AssistantNative & { owner: string; operationId: string; expires: number };
let launch: Launch | null = null;
const consumed = new Set<string>();
/** A URL cannot start a health AI request: only an in-memory, confirmed, account-bound handoff can. */
export function stageAssistantLaunch(owner: string, operationId: string, native: AssistantNative) {
  if (owner !== localAccountId() || consumed.has(operationId)) return false;
  launch = { ...native, owner, operationId, expires: Date.now() + 60000 };
  return true;
}
export function consumeAssistantLaunch(owner: string, route: string): string | null {
  const current = launch;
  if (!current || current.owner !== owner || localAccountId() !== owner || current.route !== route || current.expires < Date.now()) return null;
  launch = null;
  if (consumed.has(current.operationId)) return null;
  consumed.add(current.operationId);
  if (consumed.size > 100) consumed.delete(consumed.values().next().value!);
  return current.message || null;
}
export const assistantFieldLabels: Record<string, string> = {
  date: 'თარიღი', amountMl: 'წყალი · მლ', goalMl: 'დღიური მიზანი · მლ', targetKg: 'სასურველი წონა · კგ', startKg: 'მიმდინარე წონა · კგ',
  deadlineYmd: 'მიზნის ვადა', targetSteps: 'ნაბიჯების მიზანი', weightKg: 'წონა · კგ', heartRate: 'პულსი · წუთში',
  bloodPressureSystolic: 'ზედა წნევა', bloodPressureDiastolic: 'ქვედა წნევა', sleepHours: 'ძილი · საათი', nutritionKcal: 'დამატებული კალორიები · კკალ',
  medName: 'მედიკამენტი', dosage: 'დოზა', frequency: 'დროები · HH:mm', notes: 'შენიშვნა', note: 'შენიშვნა', name: 'სახელი',
  speciesId: 'ცხოველის სახეობა', breedId: 'ჯიში', customBreed: 'ჯიშის დასახელება', sex: 'სქესი', neutered: 'სტერილიზაცია',
  ageKind: 'ასაკის სიზუსტე', birthDate: 'დაბადების თარიღი', approxAgeYears: 'სავარაუდო ასაკი · წელი', approxAgeMonths: 'დამატებით · თვე',
  id: 'ჩანაწერის ID', petId: 'ცხოველის ID', medicationId: 'მედიკამენტის ID', status: 'მდგომარეობა', time: 'დრო · HH:mm',
  doctorType: 'ექიმის სპეციალობა', doctorFirstName: 'ექიმის სახელი', doctorLastName: 'ექიმის გვარი', visitDate: 'ვიზიტის თარიღი', visitTime: 'ვიზიტის დრო', address: 'მისამართი',
  action: 'მოქმედება', flow: 'ინტენსივობა', symptoms: 'სიმპტომები', moods: 'განწყობა', bbt: 'ბაზალური ტემპერატურა · °C',
  ovulationTest: 'ოვულაციის ტესტი', pregnancyTest: 'ორსულობის ტესტი', sleepQuality: 'ძილის ხარისხი', stressLevel: 'სტრესი', energy: 'ენერგია', kickCount: 'დღის მოძრაობების რაოდენობა',
  inputValue: 'წონა', inputUnit: 'ერთეული', recordedOn: 'აღრიცხვის თარიღი', category: 'კატეგორია', reportedStatus: 'დადასტურება', reaction: 'რეაქცია', notedOn: 'შემჩნევის თარიღი', reportedBasis: 'ინფორმაციის წყარო', onsetOn: 'დაწყების თარიღი',
  heightCm: 'სიმაღლე · სმ', bloodType: 'სისხლის ჯგუფი', chronicConditions: 'ქრონიკული მდგომარეობები', allergies: 'ალერგიები', medications: 'მედიკამენტები',
  familyHistory: 'ოჯახური ისტორია', healthGoals: 'ჯანმრთელობის მიზნები', activityLevel: 'აქტივობა', dietType: 'კვება', smokingStatus: 'თამბაქო', alcoholUse: 'ალკოჰოლი',
  destination: 'გასახსნელი ფუნქცია', mode: 'კონსულტაციის ტიპი', message: 'შეტყობინება',
};
export const assistantValueLabels: Record<string, string> = {
  true: 'კი', false: 'არა', MALE: 'მამრობითი', FEMALE: 'მდედრობითი', UNKNOWN: 'უცნობია', EXACT: 'ზუსტი თარიღი', APPROXIMATE: 'სავარაუდო ასაკი',
  DOCTOR: 'Medi ექიმი', CONSILIUM: 'კონსილიუმი', dog: 'ძაღლი', cat: 'კატა', unknown: 'უცნობია', custom: 'სხვა ჯიში',
  start: 'დაწყება', end: 'დასრულება', none: 'არ არის', spotting: 'ლაქები', light: 'მსუბუქი', medium: 'საშუალო', heavy: 'უხვი',
  positive: 'დადებითი', negative: 'უარყოფითი', unclear: 'გაურკვეველი', taken: 'მივიღე', skipped: 'გამოვტოვე',
  suspected: 'სავარაუდო', veterinarian_confirmed: 'ვეტერინარის მიერ დადასტურებული', owner_reported: 'ჩემი დაკვირვება', active: 'აქტიური', resolved: 'დასრულებული',
  kg: 'კგ', g: 'გრამი', medication: 'მედიკამენტი', food: 'საკვები', environmental: 'გარემო', other: 'სხვა',
};
export function assistantDisplay(value: unknown): string {
  if (Array.isArray(value)) return value.map(assistantDisplay).join(', ');
  if (value && typeof value === 'object') return Object.entries(value).map(([k, v]) => `${assistantFieldLabels[k] || k}: ${assistantDisplay(v)}`).join('\n');
  return assistantValueLabels[String(value)] || String(value ?? '');
}
