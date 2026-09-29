import { VET_DISCLAIMER_KA, VET_DISCLAIMER_EN } from './prompts.js';
import { VALIDATED_VET_SPECIES } from './petsAiContext.js';
import { filterCitationsToRetrieved } from './petsVetReferences.js';
import { parseCareDraftFence } from './petsVetDraft.js';

const EMERGENCY_RE =
  /არ სუნთქავს|სუნთქვა არ|კრუნჩხვ|შხამ|ტოქსინ|ძლიერი სისხლდენ|გაბერვა|ბლოტ|collapse|not breathing|unconscious|seizure|bloated|gdv|შეშუპებ.*მუც|ლურჯი ენა|poison|toxic|heavy bleeding|bleeding heavily|blue tongue|can'?t breathe|cannot breathe/i;

const DOSE_REQUEST_RE = /რამდენი მგ|მგ\/კგ|mg\/kg|დოზა მიანიჭ|დაწერე დოზ|prescribe|individual dose|რა დოზით მივცე|how many mg|what dose|which dose/i;

const MUTATION_RE =
  /შეინახე გეგმა|შეინახე ჩანაწერი|მონიშნე მიღებ|გააუქმე გეგმა|ჩართე შეხსენებ|save the plan|mark as given|cancel the schedule|enable reminders/i;

const INJECTION_RE =
  /ignore previous|იგნორირება გაუკეთე წინა|system prompt|you are now|დაივიწყე ინსტრუქცია|act as a licensed veterinarian/i;

const HUMAN_112_RE = /\b112\b/;

const EMERGENCY_PREFIX_KA =
  'ეს შეიძლება სასწრაფო იყოს. დაუყოვნებლივ დაუკავშირდი სასწრაფო ვეტერინარს ან უახლოეს კლინიკას. ადამიანის სასწრაფო სამსახური ცხოველის პროტოკოლი არ არის და აქ ნომერს არ გამოგიგონებ.';

const UNSUPPORTED_SPECIES_KA =
  'ამ სახეობაზე აპის დადასტურებული დაფარვა შეზღუდულია. ზოგადი ორიენტაცია შეიძლება, მაგრამ ინდივიდუალური რჩევისთვის მიმართე შესაბამის ვეტერინარს.';

const PRODUCT_CLAIM_GUARD_KA =
  'კონკრეტული პროდუქტის დოზა ან ინტერვალი ამ პასუხში წყაროთი არ არის დაფუძნებული. მიჰყევი ვეტერინარს და ოფიციალურ ინსტრუქციას.';

const MUTATION_NOTE_KA = 'მე ვერ შევინახავ, ვერ გავაუქმებ და ვერ ჩავრთავ შეხსენებას. ეს მხოლოდ განსახილველი ტექსტია, სანამ შენ დაადასტურებ აპში.';

// English copies (the app in English) — same strength as the Georgian safety copy.
const EMERGENCY_PREFIX_EN =
  'This could be an emergency. Contact an emergency vet or the nearest clinic right away. Human emergency services are not an animal protocol, and I won’t make up a number here.';
const UNSUPPORTED_SPECIES_EN =
  'The app’s confirmed coverage for this species is limited. General orientation is possible, but for individual advice please see a suitable vet.';
const PRODUCT_CLAIM_GUARD_EN =
  'A specific product dose or interval in this answer is not backed by a source. Follow your vet and the official instructions.';
const MUTATION_NOTE_EN = 'I can’t save, cancel or turn on reminders. This is only text for you to review until you confirm it in the app.';

const copyFor = (lang) => (lang === 'en'
  ? { emergency: EMERGENCY_PREFIX_EN, unsupported: UNSUPPORTED_SPECIES_EN, unsupportedMark: 'confirmed coverage', guard: PRODUCT_CLAIM_GUARD_EN, mutation: MUTATION_NOTE_EN, disclaimer: VET_DISCLAIMER_EN, vetClinic: 'emergency vet/clinic' }
  : { emergency: EMERGENCY_PREFIX_KA, unsupported: UNSUPPORTED_SPECIES_KA, unsupportedMark: 'დადასტურებული დაფარვა', guard: PRODUCT_CLAIM_GUARD_KA, mutation: MUTATION_NOTE_KA, disclaimer: VET_DISCLAIMER_KA, vetClinic: 'სასწრაფო ვეტერინარი/კლინიკა' });

export function classifyVetTurn({ text, speciesId } = {}) {
  const body = String(text || '');
  return {
    emergency: EMERGENCY_RE.test(body),
    doseRequest: DOSE_REQUEST_RE.test(body),
    mutationRequest: MUTATION_RE.test(body),
    promptInjection: INJECTION_RE.test(body),
    unsupportedSpecies: Boolean(speciesId) && !VALIDATED_VET_SPECIES.includes(speciesId),
  };
}

export function ensureVetDisclaimer(text, lang = 'ka') {
  const body = String(text || '').trim();
  const disclaimer = lang === 'en' ? VET_DISCLAIMER_EN : VET_DISCLAIMER_KA;
  if (body.includes(disclaimer) || body.includes(VET_DISCLAIMER_KA)) return body;
  return `${body}\n\n${disclaimer}`.trim();
}

export function applyVetSafetyLayers({
  text,
  classification,
  retrieved = [],
  speciesId,
  lang = 'ka',
} = {}) {
  let content = String(text || '').trim();
  const flags = classification || classifyVetTurn({ text, speciesId });
  const copy = copyFor(lang);

  if (HUMAN_112_RE.test(content) && flags.emergency) {
    content = content.replace(/\b112\b/g, copy.vetClinic);
  }

  if (flags.emergency && !content.startsWith(copy.emergency)) {
    content = `${copy.emergency}\n\n${content}`;
  }

  if (flags.unsupportedSpecies && !content.includes(copy.unsupportedMark)) {
    content = `${copy.unsupported}\n\n${content}`;
  }

  if (flags.mutationRequest) {
    content += `\n\n${copy.mutation}`;
  }

  const { draft, content: withoutDraft } = parseCareDraftFence(content);
  content = withoutDraft;

  const cited = filterCitationsToRetrieved(content, retrieved);
  content = cited.content;

  if (!retrieved.length && /(მგ\/კგ|mg\/kg|ყოველ \d+ დღ|every \d+ day)/i.test(content)) {
    content += `\n\n${copy.guard}`;
  }

  content = ensureVetDisclaimer(content, lang);

  const groundingStatus = cited.citations.length
    ? 'retrieved'
    : retrieved.length
      ? 'retrieved_not_cited'
      : 'none_retrieved';

  return {
    content,
    citations: cited.citations,
    draft,
    flags,
    grounding: {
      version: 'pets-vet-refs-v1',
      status: groundingStatus,
      sourceIds: retrieved.map((row) => row.id),
    },
  };
}

export const VET_POLICY_COPY = {
  EMERGENCY_PREFIX_KA,
  UNSUPPORTED_SPECIES_KA,
  PRODUCT_CLAIM_GUARD_KA,
  EMERGENCY_PREFIX_EN,
  UNSUPPORTED_SPECIES_EN,
  PRODUCT_CLAIM_GUARD_EN,
};
