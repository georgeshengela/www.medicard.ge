const words = text => String(text || '').normalize('NFC').toLocaleLowerCase().match(/[\p{L}\p{N}]+/gu) || [];
function mentioned(pet, text) {
  const name = words(pet.name), tokens = words(text);
  if (!name.length) return false;
  const last = name[name.length - 1];
  const forms = new Set([last, ...['ს', 'ის', 'მა', 'თან', 'თვის', 'ზე'].map(s => last + s)]);
  if (last.endsWith('ი')) ['ს', 'ის', 'მა', 'თან', 'ისთვის', 'ზე'].forEach(s => forms.add(last.slice(0, -1) + s));
  // Speech recognition sometimes joins the vocative to a known name: "მედილუნა".
  // Split only an exact owned-name match; never guess an unknown identity.
  if (/^(?:მედი|medi)/u.test(tokens[0] || '')) {
    const remainder = tokens[0].slice(4);
    if (name.length === 1 ? forms.has(remainder) : remainder === name[0]) tokens[0] = remainder;
  }
  return tokens.some((_, i) => name.every((part, j) => j === name.length - 1 ? forms.has(tokens[i + j]) : tokens[i + j] === part));
}

/** Identity directory is owner-filtered by the caller; no health records needed for routing. */
export function resolveAssistantSubject({ text, scope = 'auto', draft, history = [], subjectId }, pets) {
  if (scope !== 'auto') return { scope, petId: null, matches: [], draft };
  if (subjectId) {
    const selected = pets.find(p => p.id === subjectId);
    if (!selected) throw Object.assign(new Error('ცხოველი ვერ მოიძებნა.'), { status: 404 });
    return { scope: 'pet', petId: selected.id, matches: [selected], draft: draft?.tool.startsWith('pet_') ? { ...draft, args: { ...draft.args, petId: selected.id } } : null };
  }
  const matches = pets.filter(p => mentioned(p, text));
  const personal = /(?:^|\s)(?:მე|ჩემთვის|ჩემი)(?:\s|[,!?])|დავლიე|მტკივა|ჩემი წონა|ჩემი ციკლ/u.test(text);
  const petWords = /ცხოველ|ძაღლ|კატა|კატის|ლეკვ|ვეტერინ|ფისო/u.test(text);
  if (/(?:არა[,\s]+(?:მე|ჩემთვის|ჩემი)|ჩემთვის[,\s]+(?:მინდა|ჩაწერე))/u.test(text)) return { scope: 'human', petId: null, matches: [], draft: draft?.tool.startsWith('pet_') ? null : draft };
  if (matches.length > 1) return { scope: 'pet', matches, ambiguous: true, draft: null };
  if (matches.length && personal && /(?:და მეც|და მე |ჩემთვისაც)/u.test(text)) return { scope: 'pet', matches, ambiguous: true, draft: null };
  const selected = matches[0];
  if (selected) return { scope: 'pet', petId: selected.id, matches, draft: draft?.tool.startsWith('pet_') ? { ...draft, args: { ...draft.args, ...(draft.tool !== 'pet_add' ? { petId: selected.id } : {}) } } : null };
  if (personal && !petWords) return { scope: 'human', petId: null, matches: [], draft: draft?.tool.startsWith('pet_') ? null : draft };
  if (petWords || /აცრ|ვაქცინ/u.test(text) && !personal) return { scope: 'pet', matches: [], petId: null, draft: draft?.tool.startsWith('pet_') ? draft : null };
  if (draft) return { scope: draft.tool.startsWith('pet_') ? 'pet' : 'human', petId: pets.find(p => p.id === draft.args?.petId)?.id || null, matches: [], draft };
  if (/(?:^|\s)(?:მისი|მას|იმას)(?:\s|$)/u.test(text)) {
    const previous = [...history].reverse().find(t => t.role === 'user' && pets.some(p => mentioned(p, t.content)));
    const prior = previous ? pets.filter(p => mentioned(p, previous.content)) : [];
    if (prior.length === 1) return { scope: 'pet', petId: prior[0].id, matches: prior, draft: null };
  }
  return { scope: 'human', petId: null, matches: [], draft: null };
}
