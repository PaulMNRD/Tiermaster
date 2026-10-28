import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { I18nService } from '../../core/i18n/i18n.service';
import { settle, summary } from '../../../testing/helpers';
import HomePage from './home.page';

describe('HomePage', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HomePage],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    TestBed.inject(I18nService).setLang('en');
    http = TestBed.inject(HttpTestingController);
  });

  async function render(respond: (url: string) => void) {
    const fixture = TestBed.createComponent(HomePage);
    await settle();
    respond('/api/tierlists?sort=updated');
    await settle();
    return fixture.nativeElement as HTMLElement;
  }

  it('shows owned and shared tierlists with their role', async () => {
    const el = await render((url) =>
      http.expectOne(url).flush({ items: [summary({ title: 'Mine' }), summary({ title: 'Shared', role: 'VIEWER' })] }),
    );
    expect(el.textContent).toContain('Mine');
    expect(el.textContent).toContain('Owner');
    expect(el.textContent).toContain('Shared');
    expect(el.textContent).toContain('Viewer');
  });

  it('shows an empty state', async () => {
    const el = await render((url) => http.expectOne(url).flush({ items: [] }));
    expect(el.textContent).toContain('No tierlist yet');
  });

  it('shows an error state with retry', async () => {
    const el = await render((url) => http.expectOne(url).flush({ code: 'boom' }, { status: 500, statusText: 'Error' }));
    expect(el.querySelector('[role="alert"]')).toBeTruthy();
    expect(el.textContent).toContain('Retry');
  });

  it('creates a tierlist and opens it', async () => {
    const fixture = TestBed.createComponent(HomePage);
    await settle();
    http.expectOne('/api/tierlists?sort=updated').flush({ items: [] });
    await settle();
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    const el = fixture.nativeElement as HTMLElement;
    const input = el.querySelector<HTMLInputElement>('input[name="title"]')!;
    input.value = 'Desserts';
    input.dispatchEvent(new Event('input'));
    await settle();
    el.querySelector('form')!.dispatchEvent(new Event('submit'));
    const created = summary({ title: 'Desserts' });
    const req = http.expectOne('/api/tierlists');
    expect(req.request.body).toEqual({ title: 'Desserts', defaultRole: null });
    req.flush(created);
    await settle();
    expect(navigate).toHaveBeenCalledWith(['/t', created.id]);
  });
});
