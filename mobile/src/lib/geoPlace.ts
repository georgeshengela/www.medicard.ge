export type GeoComponents = {
  countryCode?: string | null;
  countryName?: string | null;
  city?: string | null;
  district?: string | null;
  region?: string | null;
};

export type ResolvedPlace = {
  countryCode: string | null;
  countryKa: string | null;
  cityKa: string | null;
};

const COUNTRY_KA: Record<string, string> = {
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

const CITY_KA: Record<string, string> = {
  tbilisi: 'თბილისი',
  თბილისი: 'თბილისი',
  batumi: 'ბათუმი',
  ბათუმი: 'ბათუმი',
  kutaisi: 'ქუთაისი',
  ქუთაისი: 'ქუთაისი',
  rustavi: 'რუსთავი',
  რუსთავი: 'რუსთავი',
  gori: 'გორი',
  გორი: 'გორი',
  zugdidi: 'ზუგდიდი',
  ზუგდიდი: 'ზუგდიდი',
  poti: 'ფოთი',
  ფოთი: 'ფოთი',
  telavi: 'თელავი',
  თელავი: 'თელავი',
  akhaltsikhe: 'ახალციხე',
  ახალციხე: 'ახალციხე',
  ozurgeti: 'ოზურგეთი',
  ოზურგეთი: 'ოზურგეთი',
  marneuli: 'მარნეული',
  მარნეული: 'მარნეული',
  khasuri: 'ხაშური',
  ხაშური: 'ხაშური',
  samtredia: 'სამტრედია',
  სამტრედია: 'სამტრედია',
  senaki: 'სენაკი',
  სენაკი: 'სენაკი',
  kobuleti: 'ქობულეთი',
  ქობულეთი: 'ქობულეთი',
  borjomi: 'ბორჯომი',
  ბორჯომი: 'ბორჯომი',
  mtskheta: 'მცხეთა',
  მცხეთა: 'მცხეთა',
  kazbegi: 'სტეფანწმინდა',
  stepantsminda: 'სტეფანწმინდა',
  სტეფანწმინდა: 'სტეფანწმინდა',
  mestia: 'მესტია',
  მესტია: 'მესტია',
  sighnaghi: 'სიღნაღი',
  სიღნაღი: 'სიღნაღი',
  gardabani: 'გარდაბანი',
  გარდაბანი: 'გარდაბანი',
  tskaltubo: 'წყალტუბო',
  წყალტუბო: 'წყალტუბო',
  akhalkalaki: 'ახალქალაქი',
  ახალქალაქი: 'ახალქალაქი',
  kaspi: 'კასპი',
  კასპი: 'კასპი',
  bolnisi: 'ბოლნისი',
  ბოლნისი: 'ბოლნისი',
  lagodekhi: 'ლაგოდეხი',
  ლაგოდეხი: 'ლაგოდეხი',
  gurjaani: 'გურჯაანი',
  გურჯაანი: 'გურჯაანი',
  kvareli: 'ყვარელი',
  ყვარელი: 'ყვარელი',
  ambrolauri: 'ამბროლაური',
  ამბროლაური: 'ამბროლაური',
  oni: 'ონი',
  ონი: 'ონი',
  tianeti: 'თიანეთი',
  თიანეთი: 'თიანეთი',
  liege: 'ლიეჟი',
  luik: 'ლიეჟი',
  brussels: 'ბრიუსელი',
  bruxelles: 'ბრიუსელი',
  brussel: 'ბრიუსელი',
  antwerp: 'ანტვერპენი',
  antwerpen: 'ანტვერპენი',
  anvers: 'ანტვერპენი',
  ghent: 'გენტი',
  gent: 'გენტი',
  gand: 'გენტი',
  bruges: 'ბრიუგე',
  brugge: 'ბრიუგე',
  charleroi: 'შარლრუა',
  namur: 'ნამიური',
  namen: 'ნამიური',
  leuven: 'ლევენი',
  louvain: 'ლევენი',
  mons: 'მონსი',
  oostende: 'ოსტენდე',
  ostend: 'ოსტენდე',
  ostende: 'ოსტენდე',
  mechelen: 'მეხელენი',
  malines: 'მეხელენი',
  kortrijk: 'კორტრეიკი',
  courtrai: 'კორტრეიკი',
  hasselt: 'ჰასელტი',
  waterloo: 'ვატერლოო',
  seraing: 'სერენი',
  verviers: 'ვერვიე',
  herstal: 'ჰერსტალი',
  spa: 'სპა',
  paris: 'პარიზი',
  lyon: 'ლიონი',
  marseille: 'მარსელი',
  nice: 'ნიცა',
  toulouse: 'ტულუზა',
  bordeaux: 'ბორდო',
  strasbourg: 'სტრასბურგი',
  lille: 'ლილი',
  nantes: 'ნანტი',
  montpellier: 'მონპელიე',
  rennes: 'რენი',
  reims: 'რეიმსი',
  grenoble: 'გრენობლი',
  amsterdam: 'ამსტერდამი',
  rotterdam: 'როტერდამი',
  'den haag': 'ჰააგა',
  'the hague': 'ჰააგა',
  hague: 'ჰააგა',
  utrecht: 'უტრეხტი',
  berlin: 'ბერლინი',
  munich: 'მიუნხენი',
  munchen: 'მიუნხენი',
  muenchen: 'მიუნხენი',
  hamburg: 'ჰამბურგი',
  frankfurt: 'ფრანკფურტი',
  cologne: 'კელნი',
  koln: 'კელნი',
  koeln: 'კელნი',
  stuttgart: 'შტუტგარტი',
  dusseldorf: 'დიუსელდორფი',
  duesseldorf: 'დიუსელდორფი',
  london: 'ლონდონი',
  manchester: 'მანჩესტერი',
  birmingham: 'ბირმინგემი',
  edinburgh: 'ედინბურგი',
  glasgow: 'გლაზგო',
  liverpool: 'ლივერპული',
  rome: 'რომი',
  roma: 'რომი',
  milan: 'მილანი',
  milano: 'მილანი',
  naples: 'ნეაპოლი',
  napoli: 'ნეაპოლი',
  florence: 'ფლორენცია',
  firenze: 'ფლორენცია',
  venice: 'ვენეცია',
  venezia: 'ვენეცია',
  madrid: 'მადრიდი',
  barcelona: 'ბარსელონა',
  valencia: 'ვალენსია',
  lisbon: 'ლისაბონი',
  lisboa: 'ლისაბონი',
  vienna: 'ვენა',
  wien: 'ვენა',
  zurich: 'ციურიხი',
  geneva: 'ჟენევა',
  geneve: 'ჟენევა',
  basel: 'ბაზელი',
  prague: 'პრაღა',
  praha: 'პრაღა',
  warsaw: 'ვარშავა',
  warszawa: 'ვარშავა',
  budapest: 'ბუდაპეშტი',
  athens: 'ათენი',
  athina: 'ათენი',
  stockholm: 'სტოკჰოლმი',
  oslo: 'ოსლო',
  copenhagen: 'კოპენჰაგენი',
  kobenhavn: 'კოპენჰაგენი',
  helsinki: 'ჰელსინკი',
  dublin: 'დუბლინი',
  moscow: 'მოსკოვი',
  moskva: 'მოსკოვი',
  kyiv: 'კიევი',
  kiev: 'კიევი',
  minsk: 'მინსკი',
  istanbul: 'სტამბოლი',
  ankara: 'ანკარა',
  yerevan: 'ერევანი',
  baku: 'ბაქო',
  'new york': 'ნიუ-იორკი',
  'los angeles': 'ლოს-ანჯელესი',
  chicago: 'ჩიკაგო',
  washington: 'ვაშინგტონი',
  toronto: 'ტორონტო',
  montreal: 'მონრეალი',
  vancouver: 'ვანკუვერი',
  sydney: 'სიდნეი',
  melbourne: 'მელბურნი',
  tokyo: 'ტოკიო',
  beijing: 'პეკინი',
  peking: 'პეკინი',
  dubai: 'დუბაი',
  'tel aviv': 'თელ-ავივი',
  jerusalem: 'იერუსალიმი',
};

function normKey(value: string | null | undefined): string {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[-_]/g, ' ')
    .replace(/\s+/g, ' ');
}

function foldKey(value: string | null | undefined): string {
  return normKey(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[’']/g, '');
}

function cleanCityLabel(value: string): string {
  return value
    .replace(
      /^(arrondissement|province|region|région|city|commune|municipality|district|gemeente|stad|ville)\s+(de\s+|d['’]|of\s+|di\s+|van\s+)?/i,
      '',
    )
    .trim();
}

function looksGeorgian(value: string): boolean {
  return /[\u10A0-\u10FF]/.test(value);
}

export function countryCodeOf(raw: string | null | undefined): string | null {
  const text = String(raw || '').trim();
  if (!text) return null;
  if (/^[a-z]{2}$/i.test(text)) return text.toUpperCase();
  const named = Object.entries(COUNTRY_KA).find(([, ka]) => ka === text);
  return named?.[0] ?? null;
}

export function countryNameKa(code: string | null | undefined, fallback?: string | null): string | null {
  const iso = countryCodeOf(code);
  if (iso && COUNTRY_KA[iso]) return COUNTRY_KA[iso];
  if (fallback && looksGeorgian(fallback)) return fallback.trim();
  return iso || fallback?.trim() || null;
}

export function cityNameKa(raw: string | null | undefined): string | null {
  const text = cleanCityLabel(String(raw || '').trim());
  if (!text) return null;
  return CITY_KA[normKey(text)] || CITY_KA[foldKey(text)] || text;
}

export function flagEmoji(countryCode: string | null | undefined): string {
  const iso = countryCodeOf(countryCode);
  if (!iso) return '';
  return iso.replace(/./g, (char) => String.fromCodePoint(127397 + char.charCodeAt(0)));
}

export function resolvePlace(input: GeoComponents): ResolvedPlace {
  const countryCode = countryCodeOf(input.countryCode) || countryCodeOf(input.countryName);
  const countryKa = countryNameKa(countryCode, input.countryName);
  const cityKa = cityNameKa(input.city) || cityNameKa(input.district) || cityNameKa(input.region);
  return { countryCode, countryKa, cityKa };
}

export function formatPlaceLine(place: ResolvedPlace | null | undefined): string {
  if (!place) return '';
  const flag = flagEmoji(place.countryCode);
  const cityKa = cityNameKa(place.cityKa);
  const countryKa = countryNameKa(place.countryCode, place.countryKa);
  const name = [cityKa, countryKa].filter(Boolean).join(', ');
  return [flag, name].filter(Boolean).join(' ').trim();
}

export function metersBetween(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const toRad = (n: number) => (n * Math.PI) / 180;
  const R = 6371000;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}
