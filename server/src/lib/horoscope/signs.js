// MEDIHOROSCOPE vocabulary: signs, planets, aspects, houses, moon phases, Chinese zodiac — ka/en.
// The app keeps its own copy of the names (mobile/src/lib/horoscope/names.ts); keep them in sync.

export const SIGN_INFO = {
  aries: { ka: 'ვერძი', en: 'Aries', from: '03-21', to: '04-19', element: 'fire', modality: 'cardinal', ruler: 'mars' },
  taurus: { ka: 'კურო', en: 'Taurus', from: '04-20', to: '05-20', element: 'earth', modality: 'fixed', ruler: 'venus' },
  gemini: { ka: 'ტყუპები', en: 'Gemini', from: '05-21', to: '06-20', element: 'air', modality: 'mutable', ruler: 'mercury' },
  cancer: { ka: 'კირჩხიბი', en: 'Cancer', from: '06-21', to: '07-22', element: 'water', modality: 'cardinal', ruler: 'moon' },
  leo: { ka: 'ლომი', en: 'Leo', from: '07-23', to: '08-22', element: 'fire', modality: 'fixed', ruler: 'sun' },
  virgo: { ka: 'ქალწული', en: 'Virgo', from: '08-23', to: '09-22', element: 'earth', modality: 'mutable', ruler: 'mercury' },
  libra: { ka: 'სასწორი', en: 'Libra', from: '09-23', to: '10-22', element: 'air', modality: 'cardinal', ruler: 'venus' },
  scorpio: { ka: 'მორიელი', en: 'Scorpio', from: '10-23', to: '11-21', element: 'water', modality: 'fixed', ruler: 'pluto' },
  sagittarius: { ka: 'მშვილდოსანი', en: 'Sagittarius', from: '11-22', to: '12-21', element: 'fire', modality: 'mutable', ruler: 'jupiter' },
  capricorn: { ka: 'თხის რქა', en: 'Capricorn', from: '12-22', to: '01-19', element: 'earth', modality: 'cardinal', ruler: 'saturn' },
  aquarius: { ka: 'მერწყული', en: 'Aquarius', from: '01-20', to: '02-18', element: 'air', modality: 'fixed', ruler: 'uranus' },
  pisces: { ka: 'თევზები', en: 'Pisces', from: '02-19', to: '03-20', element: 'water', modality: 'mutable', ruler: 'neptune' },
};

export const PLANET_NAMES = {
  sun: { ka: 'მზე', en: 'Sun' },
  moon: { ka: 'მთვარე', en: 'Moon' },
  mercury: { ka: 'მერკური', en: 'Mercury' },
  venus: { ka: 'ვენერა', en: 'Venus' },
  mars: { ka: 'მარსი', en: 'Mars' },
  jupiter: { ka: 'იუპიტერი', en: 'Jupiter' },
  saturn: { ka: 'სატურნი', en: 'Saturn' },
  uranus: { ka: 'ურანი', en: 'Uranus' },
  neptune: { ka: 'ნეპტუნი', en: 'Neptune' },
  pluto: { ka: 'პლუტონი', en: 'Pluto' },
  asc: { ka: 'ასცენდენტი', en: 'Ascendant' },
  mc: { ka: 'ზენიტი (MC)', en: 'Midheaven' },
};

export const ASPECT_NAMES = {
  conjunction: { ka: 'შეერთება', en: 'conjunction' },
  sextile: { ka: 'სექსტილი', en: 'sextile' },
  square: { ka: 'კვადრატი', en: 'square' },
  trine: { ka: 'ტრიგონი', en: 'trine' },
  opposition: { ka: 'ოპოზიცია', en: 'opposition' },
};

export const ELEMENT_NAMES = {
  fire: { ka: 'ცეცხლი', en: 'Fire' },
  earth: { ka: 'მიწა', en: 'Earth' },
  air: { ka: 'ჰაერი', en: 'Air' },
  water: { ka: 'წყალი', en: 'Water' },
};

export const MODALITY_NAMES = {
  cardinal: { ka: 'კარდინალური', en: 'Cardinal' },
  fixed: { ka: 'ფიქსირებული', en: 'Fixed' },
  mutable: { ka: 'ცვალებადი', en: 'Mutable' },
};

/** Life areas of the twelve houses, used for solar-house readings and the chart. */
export const HOUSE_THEMES = {
  1: { ka: 'პიროვნება, იერი, საკუთარი თავი', en: 'self, appearance, new starts' },
  2: { ka: 'ფული, ღირებულებები, საკუთრება', en: 'money, values, possessions' },
  3: { ka: 'კომუნიკაცია, და-ძმა, მოკლე გზები', en: 'communication, siblings, short trips' },
  4: { ka: 'სახლი, ოჯახი, ფესვები', en: 'home, family, roots' },
  5: { ka: 'სიყვარული, შემოქმედება, ბავშვები', en: 'romance, creativity, children' },
  6: { ka: 'ყოველდღიური საქმე, რუტინა, სამსახური', en: 'daily work, routine, service' },
  7: { ka: 'პარტნიორობა, ქორწინება, ხელშეკრულებები', en: 'partnership, marriage, contracts' },
  8: { ka: 'საერთო რესურსები, ინტიმურობა, გარდაქმნა', en: 'shared resources, intimacy, transformation' },
  9: { ka: 'მოგზაურობა, სწავლა, რწმენა', en: 'travel, learning, beliefs' },
  10: { ka: 'კარიერა, სტატუსი, მიზნები', en: 'career, status, goals' },
  11: { ka: 'მეგობრები, ჯგუფები, იმედები', en: 'friends, groups, hopes' },
  12: { ka: 'დასვენება, ფარული საქმეები, შინაგანი სამყარო', en: 'rest, hidden matters, inner life' },
};

export const MOON_PHASE_NAMES = {
  new: { ka: 'ახალი მთვარე', en: 'New Moon' },
  waxing_crescent: { ka: 'მზარდი ნამგალი', en: 'Waxing Crescent' },
  first_quarter: { ka: 'პირველი მეოთხედი', en: 'First Quarter' },
  waxing_gibbous: { ka: 'მზარდი მთვარე', en: 'Waxing Gibbous' },
  full: { ka: 'სავსე მთვარე', en: 'Full Moon' },
  waning_gibbous: { ka: 'კლებადი მთვარე', en: 'Waning Gibbous' },
  last_quarter: { ka: 'ბოლო მეოთხედი', en: 'Last Quarter' },
  waning_crescent: { ka: 'კლებადი ნამგალი', en: 'Waning Crescent' },
};

export const CHINESE_NAMES = {
  rat: { ka: 'ვირთხა', en: 'Rat' },
  ox: { ka: 'ხარი', en: 'Ox' },
  tiger: { ka: 'ვეფხვი', en: 'Tiger' },
  rabbit: { ka: 'კურდღელი', en: 'Rabbit' },
  dragon: { ka: 'დრაკონი', en: 'Dragon' },
  snake: { ka: 'გველი', en: 'Snake' },
  horse: { ka: 'ცხენი', en: 'Horse' },
  goat: { ka: 'თხა', en: 'Goat' },
  monkey: { ka: 'მაიმუნი', en: 'Monkey' },
  rooster: { ka: 'მამალი', en: 'Rooster' },
  dog: { ka: 'ძაღლი', en: 'Dog' },
  pig: { ka: 'ღორი', en: 'Pig' },
};

export const CHINESE_ELEMENT_NAMES = {
  wood: { ka: 'ხე', en: 'Wood' },
  fire: { ka: 'ცეცხლი', en: 'Fire' },
  earth: { ka: 'მიწა', en: 'Earth' },
  metal: { ka: 'მეტალი', en: 'Metal' },
  water: { ka: 'წყალი', en: 'Water' },
};

/** Lucky colours the generator may pick from; the app maps keys to swatches. */
export const LUCKY_COLORS = {
  gold: { ka: 'ოქროსფერი', en: 'gold', hex: '#C99A45' },
  silver: { ka: 'ვერცხლისფერი', en: 'silver', hex: '#B8BEC9' },
  white: { ka: 'თეთრი', en: 'white', hex: '#F4F4F2' },
  red: { ka: 'წითელი', en: 'red', hex: '#C2362F' },
  coral: { ka: 'მარჯნისფერი', en: 'coral', hex: '#EE7A5F' },
  orange: { ka: 'ნარინჯისფერი', en: 'orange', hex: '#E58A2B' },
  yellow: { ka: 'ყვითელი', en: 'yellow', hex: '#E8C547' },
  green: { ka: 'მწვანე', en: 'green', hex: '#3E8E5E' },
  emerald: { ka: 'ზურმუხტისფერი', en: 'emerald', hex: '#0F7B63' },
  turquoise: { ka: 'ფირუზისფერი', en: 'turquoise', hex: '#2BB3B1' },
  blue: { ka: 'ლურჯი', en: 'blue', hex: '#2F5FB3' },
  navy: { ka: 'მუქი ლურჯი', en: 'navy', hex: '#1C2A5E' },
  violet: { ka: 'იისფერი', en: 'violet', hex: '#7A4FB8' },
  pink: { ka: 'ვარდისფერი', en: 'pink', hex: '#E58BA8' },
  burgundy: { ka: 'ალუბლისფერი', en: 'burgundy', hex: '#7D2338' },
  brown: { ka: 'ყავისფერი', en: 'brown', hex: '#7A5536' },
  beige: { ka: 'კრემისფერი', en: 'cream', hex: '#E9DCC3' },
  black: { ka: 'შავი', en: 'black', hex: '#1A1A1A' },
};

export const signName = (sign, lang = 'ka') => SIGN_INFO[sign]?.[lang === 'en' ? 'en' : 'ka'] || sign;
export const planetName = (key, lang = 'ka') => PLANET_NAMES[key]?.[lang === 'en' ? 'en' : 'ka'] || key;
