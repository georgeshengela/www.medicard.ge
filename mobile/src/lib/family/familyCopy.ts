/**
 * MEDIFAMILY fixed copy that travels by key (never health text in a route): Medi's suggested questions per
 * age stage. `/family/:id/chat?ask=<key>` prefills the composer with the question in the app's language.
 */
import { tx } from '../../i18n/locale.js';
import type { Stage } from './familyApi';

type Chip = { key: string; text: string };

const CHIPS: Record<string, { stages: Stage[]; ka: string; en: string }> = {
  feeds: { stages: ['newborn', 'infant_0_6'], ka: 'რამდენჯერ და რამდენი უნდა ჭამოს?', en: 'How often and how much should they feed?' },
  sleep0: { stages: ['newborn', 'infant_0_6'], ka: 'ნორმალურია მისი ძილი?', en: 'Is their sleep normal?' },
  jaundice: { stages: ['newborn'], ka: 'კანი გაუყვითლდა — რას ნიშნავს?', en: 'Their skin looks yellow — what does it mean?' },
  colic: { stages: ['newborn', 'infant_0_6'], ka: 'ბევრს ტირის საღამოობით — რა ვქნა?', en: 'They cry a lot in the evenings — what can I do?' },
  solids: { stages: ['infant_0_6', 'infant_6_12'], ka: 'როგორ დავიწყო დამატებითი კვება?', en: 'How do I start solid food?' },
  allergens: { stages: ['infant_6_12', 'toddler'], ka: 'როდის და როგორ შევიყვანო კვერცხი და არაქისი?', en: 'When and how do I bring in egg and peanut?' },
  teeth: { stages: ['infant_6_12', 'toddler'], ka: 'კბილები ამოსდის — როგორ დავეხმარო?', en: 'They are teething — how can I help?' },
  vaccineFever: { stages: ['infant_0_6', 'infant_6_12', 'toddler'], ka: 'აცრის შემდეგ სიცხე — ნორმალურია?', en: 'Fever after a vaccine — is it normal?' },
  picky: { stages: ['toddler', 'preschool'], ka: 'ბოსტნეულს არ ჭამს — რა ვქნა?', en: 'They won’t eat vegetables — what can I do?' },
  talk: { stages: ['toddler'], ka: 'როდის უნდა დაიწყოს ლაპარაკი?', en: 'When should they start talking?' },
  fever: { stages: ['infant_6_12', 'toddler', 'preschool', 'school'], ka: 'სიცხე აქვს — როდის მივიდე ექიმთან?', en: 'They have a fever — when should we see a doctor?' },
  screens: { stages: ['preschool', 'school'], ka: 'რამდენი ეკრანი შეიძლება ამ ასაკში?', en: 'How much screen time is OK at this age?' },
  sleep: { stages: ['preschool', 'school', 'teen'], ka: 'რამდენი უნდა ეძინოს?', en: 'How much should they sleep?' },
  school: { stages: ['school'], ka: 'ხშირად ავადდება სკოლაში — რა გავაძლიერო?', en: 'They get sick a lot at school — what helps?' },
  hpv: { stages: ['school', 'teen'], ka: 'რატომ არის საჭირო აპვ ვაქცინა?', en: 'Why is the HPV vaccine needed?' },
  mood: { stages: ['teen'], ka: 'როგორ გავიგო, ცუდად თუ არის ემოციურად?', en: 'How can I tell if they are struggling emotionally?' },
  growthTeen: { stages: ['teen'], ka: 'ნორმალურად იზრდება?', en: 'Are they growing normally?' },
};

export function askChips(stage: Stage, max = 3): Chip[] {
  return Object.entries(CHIPS)
    .filter(([, c]) => c.stages.includes(stage))
    .slice(0, max)
    .map(([key, c]) => ({ key, text: tx(c.ka, c.en) }));
}

export function askText(key: string | null | undefined): string | null {
  const c = key ? CHIPS[key] : null;
  return c ? tx(c.ka, c.en) : null;
}
