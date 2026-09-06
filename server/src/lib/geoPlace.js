const COUNTRY_KA = {
  GE: 'საქართველო',
  AM: 'სომხეთი',
  AZ: 'აზერბაიჯანი',
  TR: 'თურქეთი',
  RU: 'რუსეთი',
  UA: 'უკრაინა',
  BY: 'ბელარუსი',
  MD: 'მოლდოვა',
  US: 'აშშ',
  GB: 'გაერთიანებული სამეფო',
  DE: 'გერმანია',
  FR: 'საფრანგეთი',
  IT: 'იტალია',
  ES: 'ესპანეთი',
  PT: 'პორტუგალია',
  NL: 'ნიდერლანდები',
  BE: 'ბელგია',
  CH: 'შვეიცარია',
  AT: 'ავსტრია',
  PL: 'პოლონეთი',
  CZ: 'ჩეხეთი',
  HU: 'უნგრეთი',
  RO: 'რუმინეთი',
  BG: 'ბულგარეთი',
  GR: 'საბერძნეთი',
  CY: 'კვიპროსი',
  IL: 'ისრაელი',
  AE: 'არაბთა გაერთიანებული საამიროები',
  SA: 'საუდის არაბეთი',
  QA: 'კატარი',
  CN: 'ჩინეთი',
  JP: 'იაპონია',
  KR: 'სამხრეთ კორეა',
  IN: 'ინდოეთი',
  CA: 'კანადა',
  AU: 'ავსტრალია',
  BR: 'ბრაზილია',
  MX: 'მექსიკა',
  SE: 'შვედეთი',
  NO: 'ნორვეგია',
  FI: 'ფინეთი',
  DK: 'დანია',
  IE: 'ირლანდია',
  LT: 'ლიტვა',
  LV: 'ლატვია',
  EE: 'ესტონეთი',
  KZ: 'ყაზახეთი',
  UZ: 'უზბეკეთი',
  EG: 'ეგვიპტე',
  ZA: 'სამხრეთ აფრიკა',
};

const CITY_KA = {
  tbilisi: 'თბილისი',
  batumi: 'ბათუმი',
  kutaisi: 'ქუთაისი',
  rustavi: 'რუსთავი',
  gori: 'გორი',
  zugdidi: 'ზუგდიდი',
  poti: 'ფოთი',
  telavi: 'თელავი',
  akhaltsikhe: 'ახალციხე',
  ozurgeti: 'ოზურგეთი',
  marneuli: 'მარნეული',
  khasuri: 'ხაშური',
  samtredia: 'სამტრედია',
  senaki: 'სენაკი',
  kobuleti: 'ქობულეთი',
  borjomi: 'ბორჯომი',
  mtskheta: 'მცხეთა',
  kazbegi: 'სტეფანწმინდა',
  stepantsminda: 'სტეფანწმინდა',
  mestia: 'მესტია',
  sighnaghi: 'სიღნაღი',
  gardabani: 'გარდაბანი',
  tskaltubo: 'წყალტუბო',
  akhalkalaki: 'ახალქალაქი',
  kaspi: 'კასპი',
  bolnisi: 'ბოლნისი',
  lagodekhi: 'ლაგოდეხი',
  gurjaani: 'გურჯაანი',
  kvareli: 'ყვარელი',
  ambrolauri: 'ამბროლაური',
  oni: 'ონი',
  tianeti: 'თიანეთი',
};

function normKey(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[-_]/g, ' ')
    .replace(/\s+/g, ' ');
}

function looksGeorgian(value) {
  return /[\u10A0-\u10FF]/.test(String(value || ''));
}

export function countryCodeOf(raw) {
  const text = String(raw || '').trim();
  if (!text) return null;
  if (/^[a-z]{2}$/i.test(text)) return text.toUpperCase();
  const named = Object.entries(COUNTRY_KA).find(([, ka]) => ka === text);
  return named?.[0] ?? null;
}

export function countryNameKa(code, fallback) {
  const iso = countryCodeOf(code);
  if (iso && COUNTRY_KA[iso]) return COUNTRY_KA[iso];
  if (fallback && looksGeorgian(fallback)) return String(fallback).trim();
  return iso || (fallback ? String(fallback).trim() : null);
}

export function cityNameKa(raw) {
  const text = String(raw || '').trim();
  if (!text) return null;
  return CITY_KA[normKey(text)] || (looksGeorgian(text) ? text : text);
}

export function resolveNominatimAddress(address = {}) {
  const countryCode = countryCodeOf(address.country_code) || countryCodeOf(address.country);
  const countryKa = countryNameKa(countryCode, address.country);
  const cityKa =
    cityNameKa(address.city) ||
    cityNameKa(address.town) ||
    cityNameKa(address.village) ||
    cityNameKa(address.municipality) ||
    cityNameKa(address.suburb) ||
    cityNameKa(address.county);
  return { countryCode, countryKa, cityKa };
}

export function metersBetween(a, b) {
  if (!a || !b || !Number.isFinite(a.lat) || !Number.isFinite(b.lat)) return Infinity;
  const toRad = (n) => (n * Math.PI) / 180;
  const R = 6371000;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}
