import { DOCUMENT, Injectable, inject, signal } from '@angular/core';
import { en, type MessageKey } from './messages.en';
import { fr } from './messages.fr';

export type Lang = 'en' | 'fr';
export const LANGS: readonly Lang[] = ['en', 'fr'];
const DICTIONARIES: Record<Lang, Record<MessageKey, string>> = { en, fr };
const STORAGE_KEY = 'tm.lang';

/** Runtime i18n: one build serves every language, switching is instant. */
@Injectable({ providedIn: 'root' })
export class I18nService {
  private readonly document = inject(DOCUMENT);
  readonly lang = signal<Lang>(this.initialLang());

  constructor() {
    this.document.documentElement.lang = this.lang();
  }

  setLang(lang: Lang): void {
    this.lang.set(lang);
    this.document.documentElement.lang = lang;
    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch {
      // Storage may be unavailable (private mode); the choice then lasts for the session.
    }
  }

  /** Translates a key, replacing `{param}` placeholders. Unknown keys fall back to English, then to the key. */
  t(key: MessageKey | string, params: Record<string, string | number> = {}): string {
    const template = DICTIONARIES[this.lang()][key as MessageKey] ?? en[key as MessageKey] ?? key;
    return template.replace(/\{(\w+)\}/g, (match, name: string) => (name in params ? String(params[name]) : match));
  }

  /** Whether a key exists (used to pick a specific API error message, else a generic one). */
  has(key: string): key is MessageKey {
    return key in en;
  }

  private initialLang(): Lang {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === 'en' || saved === 'fr') return saved;
    } catch {
      // Ignore unavailable storage.
    }
    return typeof navigator !== 'undefined' && navigator.language?.toLowerCase().startsWith('fr') ? 'fr' : 'en';
  }
}
