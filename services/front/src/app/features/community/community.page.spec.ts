import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { I18nService } from '../../core/i18n/i18n.service';
import { settle, summary } from '../../../testing/helpers';
import CommunityPage from './community.page';

describe('CommunityPage', () => {
  it('paginates public tierlists', async () => {
    TestBed.configureTestingModule({
      imports: [CommunityPage],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    TestBed.inject(I18nService).setLang('en');
    const http = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(CommunityPage);
    await settle();
    http.expectOne('/api/community?sort=updated&page=1&pageSize=12')
      .flush({ items: [summary({ title: 'Public one', role: 'VIEWER', defaultRole: 'VIEWER' })], total: 13, page: 1, pageSize: 12 });
    await settle();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Public one');
    expect(el.textContent).toContain('Page 1 of 2');

    const next = [...el.querySelectorAll('button')].find((b) => b.textContent?.includes('Next'))!;
    next.click();
    await settle();
    http.expectOne('/api/community?sort=updated&page=2&pageSize=12')
      .flush({ items: [summary({ title: 'Last one' })], total: 13, page: 2, pageSize: 12 });
    await settle();
    expect(el.textContent).toContain('Last one');
    expect(el.textContent).toContain('Page 2 of 2');
  });
});
