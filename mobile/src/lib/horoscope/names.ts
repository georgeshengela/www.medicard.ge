/** MEDIHOROSCOPE names (server copy: server/src/lib/horoscope/signs.js — keep in sync). */
import { tx } from '@/i18n/locale';

export const SIGN_KEYS = [
  'aries', 'taurus', 'gemini', 'cancer', 'leo', 'virgo', 'libra', 'scorpio', 'sagittarius', 'capricorn', 'aquarius', 'pisces',
] as const;
export type SignKey = (typeof SIGN_KEYS)[number];
export type PlanetKey = 'sun' | 'moon' | 'mercury' | 'venus' | 'mars' | 'jupiter' | 'saturn' | 'uranus' | 'neptune' | 'pluto';
export type PointKey = PlanetKey | 'asc' | 'mc';
export type AspectKey = 'conjunction' | 'sextile' | 'square' | 'trine' | 'opposition';

const SIGN: Record<SignKey, [string, string, string, string]> = {
  // name, in-sign (locative), dates
  aries: ['ვერძი', 'ვერძში', 'Aries', '21.03–19.04'],
  taurus: ['კურო', 'კუროში', 'Taurus', '20.04–20.05'],
  gemini: ['ტყუპები', 'ტყუპებში', 'Gemini', '21.05–20.06'],
  cancer: ['კირჩხიბი', 'კირჩხიბში', 'Cancer', '21.06–22.07'],
  leo: ['ლომი', 'ლომში', 'Leo', '23.07–22.08'],
  virgo: ['ქალწული', 'ქალწულში', 'Virgo', '23.08–22.09'],
  libra: ['სასწორი', 'სასწორში', 'Libra', '23.09–22.10'],
  scorpio: ['მორიელი', 'მორიელში', 'Scorpio', '23.10–21.11'],
  sagittarius: ['მშვილდოსანი', 'მშვილდოსანში', 'Sagittarius', '22.11–21.12'],
  capricorn: ['თხის რქა', 'თხის რქაში', 'Capricorn', '22.12–19.01'],
  aquarius: ['მერწყული', 'მერწყულში', 'Aquarius', '20.01–18.02'],
  pisces: ['თევზები', 'თევზებში', 'Pisces', '19.02–20.03'],
};

export const signName = (s: SignKey) => tx(SIGN[s][0], SIGN[s][2]);
/** „მორიელში“ / "in Scorpio". */
export const signIn = (s: SignKey) => tx(SIGN[s][1], `in ${SIGN[s][2]}`);
export const signDates = (s: SignKey) => SIGN[s][3];

const PLANET: Record<PointKey, [string, string]> = {
  sun: ['მზე', 'Sun'], moon: ['მთვარე', 'Moon'], mercury: ['მერკური', 'Mercury'], venus: ['ვენერა', 'Venus'],
  mars: ['მარსი', 'Mars'], jupiter: ['იუპიტერი', 'Jupiter'], saturn: ['სატურნი', 'Saturn'], uranus: ['ურანი', 'Uranus'],
  neptune: ['ნეპტუნი', 'Neptune'], pluto: ['პლუტონი', 'Pluto'], asc: ['ასცენდენტი', 'Ascendant'], mc: ['ზენიტი', 'Midheaven'],
};
export const planetName = (p: PointKey) => tx(PLANET[p][0], PLANET[p][1]);

const ASPECT: Record<AspectKey, [string, string]> = {
  conjunction: ['შეერთება', 'conjunction'], sextile: ['სექსტილი', 'sextile'], square: ['კვადრატი', 'square'],
  trine: ['ტრიგონი', 'trine'], opposition: ['ოპოზიცია', 'opposition'],
};
export const aspectName = (a: AspectKey) => tx(ASPECT[a][0], ASPECT[a][1]);
export const aspectHarmonious = (a: AspectKey) => a === 'trine' || a === 'sextile';

const PHASE: Record<string, [string, string]> = {
  new: ['ახალი მთვარე', 'New Moon'], waxing_crescent: ['მზარდი ნამგალი', 'Waxing Crescent'],
  first_quarter: ['პირველი მეოთხედი', 'First Quarter'], waxing_gibbous: ['მზარდი მთვარე', 'Waxing Gibbous'],
  full: ['სავსე მთვარე', 'Full Moon'], waning_gibbous: ['კლებადი მთვარე', 'Waning Gibbous'],
  last_quarter: ['ბოლო მეოთხედი', 'Last Quarter'], waning_crescent: ['კლებადი ნამგალი', 'Waning Crescent'],
};
export const phaseName = (k: string) => (PHASE[k] ? tx(PHASE[k][0], PHASE[k][1]) : k);

const ELEMENT: Record<string, [string, string]> = { fire: ['ცეცხლი', 'Fire'], earth: ['მიწა', 'Earth'], air: ['ჰაერი', 'Air'], water: ['წყალი', 'Water'] };
export const elementName = (k: string) => (ELEMENT[k] ? tx(ELEMENT[k][0], ELEMENT[k][1]) : k);
const MODALITY: Record<string, [string, string]> = { cardinal: ['კარდინალური', 'Cardinal'], fixed: ['ფიქსირებული', 'Fixed'], mutable: ['ცვალებადი', 'Mutable'] };
export const modalityName = (k: string) => (MODALITY[k] ? tx(MODALITY[k][0], MODALITY[k][1]) : k);

const CHINESE: Record<string, [string, string]> = {
  rat: ['ვირთხა', 'Rat'], ox: ['ხარი', 'Ox'], tiger: ['ვეფხვი', 'Tiger'], rabbit: ['კურდღელი', 'Rabbit'], dragon: ['დრაკონი', 'Dragon'],
  snake: ['გველი', 'Snake'], horse: ['ცხენი', 'Horse'], goat: ['თხა', 'Goat'], monkey: ['მაიმუნი', 'Monkey'], rooster: ['მამალი', 'Rooster'],
  dog: ['ძაღლი', 'Dog'], pig: ['ღორი', 'Pig'],
};
export const chineseName = (k: string) => (CHINESE[k] ? tx(CHINESE[k][0], CHINESE[k][1]) : k);
/** „ცეცხლის ცხენი“ / "Fire Horse". */
const CHINESE_ELEMENT_OF: Record<string, [string, string]> = { wood: ['ხის', 'Wood'], fire: ['ცეცხლის', 'Fire'], earth: ['მიწის', 'Earth'], metal: ['მეტალის', 'Metal'], water: ['წყლის', 'Water'] };
export const chineseFull = (element: string, animal: string) =>
  tx(`${CHINESE_ELEMENT_OF[element]?.[0] ?? ''} ${CHINESE[animal]?.[0] ?? animal}`.trim(), `${CHINESE_ELEMENT_OF[element]?.[1] ?? ''} ${CHINESE[animal]?.[1] ?? animal}`.trim());

const LUCKY: Record<string, [string, string, string]> = {
  gold: ['ოქროსფერი', 'gold', '#C99A45'], silver: ['ვერცხლისფერი', 'silver', '#B8BEC9'], white: ['თეთრი', 'white', '#F4F4F2'],
  red: ['წითელი', 'red', '#C2362F'], coral: ['მარჯნისფერი', 'coral', '#EE7A5F'], orange: ['ნარინჯისფერი', 'orange', '#E58A2B'],
  yellow: ['ყვითელი', 'yellow', '#E8C547'], green: ['მწვანე', 'green', '#3E8E5E'], emerald: ['ზურმუხტი', 'emerald', '#0F7B63'],
  turquoise: ['ფირუზი', 'turquoise', '#2BB3B1'], blue: ['ლურჯი', 'blue', '#2F5FB3'], navy: ['მუქი ლურჯი', 'navy', '#1C2A5E'],
  violet: ['იისფერი', 'violet', '#7A4FB8'], pink: ['ვარდისფერი', 'pink', '#E58BA8'], burgundy: ['ალუბლისფერი', 'burgundy', '#7D2338'],
  brown: ['ყავისფერი', 'brown', '#7A5536'], beige: ['კრემისფერი', 'cream', '#E9DCC3'], black: ['შავი', 'black', '#1A1A1A'],
};
export const luckyColor = (k: string) => {
  const c = LUCKY[k] || LUCKY.gold;
  return { name: tx(c[0], c[1]), hex: c[2] };
};

const WEEKDAY: Record<string, [string, string]> = {
  mon: ['ორშაბათი', 'Monday'], tue: ['სამშაბათი', 'Tuesday'], wed: ['ოთხშაბათი', 'Wednesday'], thu: ['ხუთშაბათი', 'Thursday'],
  fri: ['პარასკევი', 'Friday'], sat: ['შაბათი', 'Saturday'], sun: ['კვირა', 'Sunday'],
};
export const weekdayName = (k: string) => (WEEKDAY[k] ? tx(WEEKDAY[k][0], WEEKDAY[k][1]) : k);

const MONTHS_KA = ['იანვარი', 'თებერვალი', 'მარტი', 'აპრილი', 'მაისი', 'ივნისი', 'ივლისი', 'აგვისტო', 'სექტემბერი', 'ოქტომბერი', 'ნოემბერი', 'დეკემბერი'];
const MONTHS_EN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export const monthName = (m: number) => tx(MONTHS_KA[m - 1], MONTHS_EN[m - 1]);
/** „13 ოქტომბერი“ / "13 October". */
export const dayMonth = (ymd: string) => {
  const [, m, d] = ymd.split('-').map(Number);
  return tx(`${d} ${MONTHS_KA[m - 1]}`, `${d} ${MONTHS_EN[m - 1]}`);
};

export const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];

/** Sky event as one short line: [title, sub]. */
export function eventText(e: { type: string; body?: string | null; sign?: string | null; kind?: string | null }): [string, string] {
  const s = (e.sign || 'aries') as SignKey;
  const p = (e.body || 'sun') as PointKey;
  switch (e.type) {
    case 'new_moon': return [tx(`ახალი მთვარე ${signIn(s)}`, `New Moon ${signIn(s)}`), tx('ახალი დასაწყისის დრო', 'A time for new starts')];
    case 'full_moon': return [tx(`სავსე მთვარე ${signIn(s)}`, `Full Moon ${signIn(s)}`), tx('კულმინაცია და დასრულება', 'Culmination and release')];
    case 'ingress': return [tx(`${planetName(p)} გადადის ${signIn(s)}`, `${planetName(p)} enters ${SIGN[s][2]}`), p === 'sun' ? tx(`იწყება ${s === 'capricorn' ? 'თხის რქის' : `${SIGN[s][0]}ს`} სეზონი`, `${SIGN[s][2]} season begins`) : tx('პლანეტა ნიშანს იცვლის', 'A planet changes sign')];
    case 'station_retrograde': return [tx(`${planetName(p)} უკუსვლას იწყებს`, `${planetName(p)} turns retrograde`), tx(`${signIn(s)} · რეტროგრადი`, `${signIn(s)} · retrograde`)];
    case 'station_direct': return [tx(`${planetName(p)} პირდაპირ სვლაზე გადადის`, `${planetName(p)} turns direct`), tx(`${signIn(s)} · რეტროგრადი სრულდება`, `${signIn(s)} · retrograde ends`)];
    case 'lunar_eclipse': return [tx(`მთვარის დაბნელება ${signIn(s)}`, `Lunar eclipse ${signIn(s)}`), tx('ემოციური გარდატეხა', 'An emotional turning point')];
    case 'solar_eclipse': return [tx(`მზის დაბნელება ${signIn(s)}`, `Solar eclipse ${signIn(s)}`), tx('ახალი თავის დასაწყისი', 'A new chapter opens')];
    default: return [e.type, ''];
  }
}
