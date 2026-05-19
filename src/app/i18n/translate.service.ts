import { Injectable, signal } from '@angular/core';
import { en } from './translations/en';
import { fr } from './translations/fr';
import {
  AppLocale,
  DEFAULT_LOCALE,
  isAppLocale,
  LOCALE_STORAGE_KEY
} from './locale';

type TranslationTree = typeof fr;

const TRANSLATIONS: Record<AppLocale, TranslationTree> = { fr, en };

@Injectable({ providedIn: 'root' })
export class TranslateService {
  readonly locale = signal<AppLocale>(this.loadStoredLocale());

  setLocale(locale: AppLocale): void {
    if (this.locale() === locale) return;
    localStorage.setItem(LOCALE_STORAGE_KEY, locale);
    document.documentElement.lang = locale;
    this.locale.set(locale);
  }

  toggleLocale(): void {
    this.setLocale(this.locale() === 'fr' ? 'en' : 'fr');
  }

  t(key: string, params?: Record<string, string | number>): string {
    const parts = key.split('.');
    let node: unknown = TRANSLATIONS[this.locale()];
    for (const part of parts) {
      if (node == null || typeof node !== 'object') {
        return key;
      }
      node = (node as Record<string, unknown>)[part];
    }
    if (typeof node !== 'string') {
      return key;
    }
    if (!params) {
      return node;
    }
    return Object.entries(params).reduce(
      (text, [paramKey, value]) => text.replaceAll(`{{${paramKey}}}`, String(value)),
      node
    );
  }

  private loadStoredLocale(): AppLocale {
    if (typeof localStorage === 'undefined') {
      return DEFAULT_LOCALE;
    }
    const stored = localStorage.getItem(LOCALE_STORAGE_KEY);
    return isAppLocale(stored) ? stored : DEFAULT_LOCALE;
  }
}
