import { Pipe, type PipeTransform, inject } from '@angular/core';
import { I18nService } from './i18n.service';

/** `{{ 'nav.home' | t }}` or `{{ 'login.with' | t: { provider: 'Google' } }}`. Re-evaluates when the language changes. */
@Pipe({ name: 't', pure: false })
export class TranslatePipe implements PipeTransform {
  private readonly i18n = inject(I18nService);

  transform(key: string, params?: Record<string, string | number>): string {
    return this.i18n.t(key, params);
  }
}
