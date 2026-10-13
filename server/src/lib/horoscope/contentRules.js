// What a MEDIHOROSCOPE text must never contain (health, money advice, fear). Georgian by stem, English by whole
// word — „accidentally“ or „undoubtedly“ are fine, „accident“ is not. Returns the word that broke the rule.
const KA = /(ავადმყოფ|დაავადებ|წამალ|მედიკამენტ|ექიმ|ორსულ|კრიპტო|ლატარე|სესხ|სიკვდილ|უბედური შემთხვევ)/i;
const EN = /\b(illness(?:es)?|diseases?|medicines?|medications?|doctors?|pregnan(?:t|cy)|crypto(?:currency)?|lottery|gambl(?:e|ing)|death|accidents?)\b/i;

export function brokenRule(text) {
  const s = String(text || '');
  return s.match(KA)?.[0] || s.match(EN)?.[0] || null;
}
