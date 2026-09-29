/**
 * English strings. Same shape as the Georgian dictionary in `./ka.ts` — the `Strings` type makes a
 * missing or renamed key a type error. Split by section so the file stays reviewable.
 */
import type { Strings } from './ka';
import { enCore } from './en/core.ts';
import { enHealth } from './en/health.ts';
import { enCycle } from './en/cycle.ts';
import { enCare } from './en/care.ts';
import { enAccount } from './en/account.ts';

export const en: Strings = {
  ...enCore,
  ...enHealth,
  ...enCycle,
  ...enCare,
  ...enAccount,
};
