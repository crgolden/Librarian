import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { HomeComponent } from './home.component';
import { HomeSummary } from './home.resolver';
import { AuthService } from '../auth/auth.service';

function configure(auth: Partial<AuthService>, summary: HomeSummary | null = null): void {
  TestBed.configureTestingModule({
    imports: [HomeComponent],
    providers: [
      provideRouter([]),
      { provide: AuthService, useValue: auth },
      { provide: ActivatedRoute, useValue: { snapshot: { data: { summary } } } },
    ],
  });
}

function render(): HTMLElement {
  const fixture = TestBed.createComponent(HomeComponent);
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

const linkedSummary: HomeSummary = {
  libraryTotal: 412,
  collectionCount: 7,
  collectionEntries: 63,
  linked: true,
};

describe('HomeComponent', () => {
  it('shows a sign-in prompt when anonymous', () => {
    configure({ isAuthenticated: signal(false), loginUrl: '/bff/login' });

    const compiled = render();

    expect(compiled.textContent).toContain('Sign in to link your PlayStation Network account');
    const link = compiled.querySelector('a.btn-primary');
    expect(link?.textContent).toContain('Sign in');
    expect(link?.getAttribute('href')).toBe('/bff/login');
  });

  it('pitches how titles enter a collection only to anonymous visitors', () => {
    configure({ isAuthenticated: signal(false), loginUrl: '/bff/login' });

    expect(render().textContent).toContain('Four ways titles enter a collection');
  });

  it('withholds the pitch from a signed-in visitor', () => {
    configure({ isAuthenticated: signal(true) }, linkedSummary);

    expect(render().textContent).not.toContain('Four ways titles enter a collection');
  });

  it('reports the resolved collection totals when authenticated', () => {
    configure({ isAuthenticated: signal(true) }, linkedSummary);

    const compiled = render();

    const terms = [...compiled.querySelectorAll('.totals dt')].map((dt) => dt.textContent?.trim());
    const totals = [...compiled.querySelectorAll('.totals dd')].map((dd) => dd.textContent?.trim());

    expect(terms).toEqual(['Titles catalogued', 'Collections', 'Collection entries']);
    expect(totals).toEqual(['412', '7', '63']);
  });

  it('withholds the unlinked notice when the profile call degraded rather than reporting no link', () => {
    configure({ isAuthenticated: signal(true) }, { ...linkedSummary, linked: null });

    const compiled = render();

    expect(compiled.textContent).not.toContain('No PlayStation Network account is linked');
    expect([...compiled.querySelectorAll('.totals dd')].map((dd) => dd.textContent?.trim())).toEqual([
      '412',
      '7',
      '63',
    ]);
  });

  it('notes an unlinked account rather than reporting an empty collection as a total', () => {
    configure({ isAuthenticated: signal(true) }, { ...linkedSummary, libraryTotal: 0, linked: false });

    expect(render().textContent).toContain('No PlayStation Network account is linked');
  });

  it('renders an error state when the resolver degraded to null', () => {
    configure({ isAuthenticated: signal(true) }, null);

    const compiled = render();

    expect(compiled.textContent).toContain('Collection totals are unavailable right now');
    expect(compiled.textContent).not.toContain('Titles catalogued');
  });
});
