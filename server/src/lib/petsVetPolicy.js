import { VET_DISCLAIMER_KA } from './prompts.js';
import { VALIDATED_VET_SPECIES } from './petsAiContext.js';
import { filterCitationsToRetrieved } from './petsVetReferences.js';
import { parseCareDraftFence } from './petsVetDraft.js';

const EMERGENCY_RE =
  /არ სუნთქავს|სუნთქვა არ|კრუნჩხვ|შხამ|ტოქსინ|ძლიერი სისხლდენ|გაბერვა|ბლოტ|collapse|not breathing|unconscious|seizure|bloated|gdv|შეშუპებ.*მუც|ლურჯი ენა/i;

const DOSE_REQUEST_RE = /რამდენი მგ|მგ\/კგ|mg\/kg|დოზა მიანიჭ|დაწერე დოზ|prescribe|individual dose|რა დოზით მივცე/i;

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

export function ensureVetDisclaimer(text) {
  const body = String(text || '').trim();
  if (body.includes(VET_DISCLAIMER_KA)) return body;
  return `${body}\n\n${VET_DISCLAIMER_KA}`.trim();
}

export function applyVetSafetyLayers({
  text,
  classification,
  retrieved = [],
  speciesId,
} = {}) {
  let content = String(text || '').trim();
  const flags = classification || classifyVetTurn({ text, speciesId });

  if (HUMAN_112_RE.test(content) && flags.emergency) {
    content = content.replace(/\b112\b/g, 'სასწრაფო ვეტერინარი/კლინიკა');
  }

  if (flags.emergency && !content.startsWith(EMERGENCY_PREFIX_KA)) {
    content = `${EMERGENCY_PREFIX_KA}\n\n${content}`;
  }

  if (flags.unsupportedSpecies && !content.includes('დადასტურებული დაფარვა')) {
    content = `${UNSUPPORTED_SPECIES_KA}\n\n${content}`;
  }

  if (flags.mutationRequest) {
    content += '\n\nმე ვერ შევინახავ, ვერ გავაუქმებ და ვერ ჩავრთავ შეხსენებას. ეს მხოლოდ განსახილველი ტექსტია, სანამ შენ დაადასტურებ აპში.';
  }

  const { draft, content: withoutDraft } = parseCareDraftFence(content);
  content = withoutDraft;

  const cited = filterCitationsToRetrieved(content, retrieved);
  content = cited.content;

  if (!retrieved.length && /(მგ\/კგ|mg\/kg|ყოველ \d+ დღ|every \d+ day)/i.test(content)) {
    content += `\n\n${PRODUCT_CLAIM_GUARD_KA}`;
  }

  content = ensureVetDisclaimer(content);

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
};
