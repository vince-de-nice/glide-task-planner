export type AppLocale = 'fr' | 'en';

export const DEFAULT_LOCALE: AppLocale = 'fr';
export const LOCALE_STORAGE_KEY = 'gc-locale';

export function isAppLocale(value: string | null | undefined): value is AppLocale {
  return value === 'fr' || value === 'en';
}
