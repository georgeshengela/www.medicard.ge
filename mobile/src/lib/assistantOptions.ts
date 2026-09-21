import type { AssistantChoices, AssistantSchema } from './assistant';

/** Enum schemas define allowed values; account choices supply labels, not a narrower enum. */
export function assistantFieldChoices(key: string, field: AssistantSchema, values: Record<string, unknown>, choices: AssistantChoices) {
  const refKey = key === 'breedId' ? `breedId:${values.speciesId || ''}` : key === 'productId' ? `productId:${values.petId || ''}` : key;
  // Pet-page names share e.g. "profile" with the app directory, but have different meanings.
  const refs = key === 'destination' && field.enum?.includes('care') ? undefined : choices[refKey];
  const options = field.enum || (field.type === 'array' ? field.items?.enum : undefined)
    || refs?.map(r => r.value) || (field.const !== undefined ? [field.const] : field.type === 'boolean' ? [true, false] : null);
  return { refs, options };
}
