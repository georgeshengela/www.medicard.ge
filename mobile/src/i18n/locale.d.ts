export type AppLang = 'ka' | 'en';

export const LANGUAGES: readonly AppLang[];
export function appLang(): AppLang;
export function isEn(): boolean;
export function hasChosenLanguage(): boolean;
/** Pick the value for the active language. */
export function tx<T>(kaValue: T, enValue: T): T;
export function dateLocale(): 'ka-GE' | 'en-GB';
export function deviceLanguage(): AppLang;
export function saveLanguage(lang: AppLang): void;
export function setLanguageAndReload(lang: AppLang): Promise<boolean>;
/** Route to open once after a language reload. */
export function setPendingRoute(route: string): void;
/** Read and clear the pending route. */
export function takePendingRoute(): string | null;
