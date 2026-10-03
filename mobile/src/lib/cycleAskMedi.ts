import { tx } from '../i18n/locale.js';
import { mediRoute } from './mediModes.ts';

/**
 * „ჰკითხე Medi-ს ციკლზე“ (brief §6 weakness 11, §8.2): the cycle screen opens the consultation with
 * one neutral question already in the input. It is a fixed sentence for everyone — the cycle day,
 * phase, symptoms or anything else she logged never travel in the route (no health values in URLs);
 * the consultation's own consent flow stays the only way anything reaches the model, and nothing is
 * sent until she presses send.
 */
export function cycleAskMediQuestion(): string {
  return tx('რა ხდება ჩემს ციკლში ახლა?', 'What is happening in my cycle right now?');
}

/** `/assistant?mode=doctor&prefill=<the neutral question>` — prefill only. */
export function cycleAskMediRoute(): string {
  return mediRoute({ mode: 'doctor', prefill: cycleAskMediQuestion() });
}
