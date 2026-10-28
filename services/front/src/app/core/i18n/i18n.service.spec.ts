import { TestBed } from '@angular/core/testing';
import { en } from './messages.en';
import { fr } from './messages.fr';
import { I18nService } from './i18n.service';

describe('I18nService', () => {
  it('translates and interpolates in both languages', () => {
    const i18n = TestBed.inject(I18nService);
    i18n.setLang('en');
    expect(i18n.t('login.with', { provider: 'Google' })).toBe('Continue with Google');
    i18n.setLang('fr');
    expect(i18n.t('login.with', { provider: 'Google' })).toBe('Continuer avec Google');
  });

  it('falls back to the key for unknown messages', () => {
    expect(TestBed.inject(I18nService).t('nope.nope')).toBe('nope.nope');
  });

  it('has the same keys in every language', () => {
    expect(Object.keys(fr).sort()).toEqual(Object.keys(en).sort());
  });
});
