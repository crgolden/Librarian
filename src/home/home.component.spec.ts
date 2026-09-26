import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { HomeComponent } from './home.component';
import { HomeSummary } from './home.resolver';
import { AuthService } from '../auth/auth.service';
import { BffPaths } from '../shared/bff-contract';
import { RouteDataKeys } from '../app/app-paths';
import {
  COLLECTION_ENTRIES_TERM,
  LIBRARY_SUMMARY_HEADING,
  LIBRARY_TOTAL_TERM,
  MANAGE_PSN_LINK_LABEL,
  MY_LIBRARY_LABEL,
  PITCH_HEADING,
  SIGN_IN_PROMPT,
  TOTALS_UNAVAILABLE_MESSAGE,
  UNLINKED_NOTICE,
} from './home.messages';
import { NavLabels, PageTitles } from '../shared/page-title';
import { newCount } from '@crgolden/modules/testing';

function configure(auth: Partial<AuthService>, summary: HomeSummary | null = null): void {
  TestBed.configureTestingModule({
    imports: [HomeComponent],
    providers: [
      provideRouter([]),
      { provide: AuthService, useValue: auth },
      { provide: ActivatedRoute, useValue: { snapshot: { data: { [RouteDataKeys.summary]: summary } } } },
    ],
  });
}

function renderedTotals(summary: HomeSummary): string[] {
  return [String(summary.libraryTotal), String(summary.collectionCount), String(summary.collectionEntries)];
}

function render(): HTMLElement {
  const fixture = TestBed.createComponent(HomeComponent);
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

const linkedSummary: HomeSummary = {
  libraryTotal: newCount(),
  collectionCount: newCount(),
  collectionEntries: newCount(),
  linked: true,
};

describe('HomeComponent', () => {
  it('shows a sign-in prompt when anonymous', () => {
    configure({ isAuthenticated: signal(false), loginUrl: BffPaths.login });

    const compiled = render();

    expect(compiled.querySelector('#home-sign-in-prompt')?.textContent?.trim()).toBe(SIGN_IN_PROMPT);
    const link = compiled.querySelector('#home-sign-in');
    expect(link?.textContent?.trim()).toBe(NavLabels.signIn);
    expect(link?.getAttribute('href')).toBe(BffPaths.login);
  });

  it('pitches how titles enter your library only to anonymous visitors', () => {
    configure({ isAuthenticated: signal(false), loginUrl: BffPaths.login });

    expect(render().querySelector('#home-pitch-heading')?.textContent?.trim()).toBe(PITCH_HEADING);
  });

  it('withholds the pitch from a signed-in visitor', () => {
    configure({ isAuthenticated: signal(true) }, linkedSummary);

    expect(render().querySelector('#home-pitch-heading')).toBeNull();
  });

  it('heads the signed-in summary as the library, since its leading figure is the library count', () => {
    configure({ isAuthenticated: signal(true) }, linkedSummary);

    expect(render().querySelector('#home-summary-heading')?.textContent?.trim()).toBe(LIBRARY_SUMMARY_HEADING);
  });

  it('reports the resolved collection totals when authenticated', () => {
    configure({ isAuthenticated: signal(true) }, linkedSummary);

    const compiled = render();

    const terms = [...compiled.querySelectorAll('#home-totals dt')].map((dt) => dt.textContent?.trim());
    const totals = [...compiled.querySelectorAll('#home-totals dd')].map((dd) => dd.textContent?.trim());

    expect(terms).toEqual([LIBRARY_TOTAL_TERM, PageTitles.collections, COLLECTION_ENTRIES_TERM]);
    expect(totals).toEqual(renderedTotals(linkedSummary));
  });

  it('withholds the unlinked notice when the profile call degraded rather than reporting no link', () => {
    configure({ isAuthenticated: signal(true) }, { ...linkedSummary, linked: null });

    const compiled = render();

    expect(compiled.querySelector('#home-unlinked-notice')).toBeNull();
    expect([...compiled.querySelectorAll('#home-totals dd')].map((dd) => dd.textContent?.trim())).toEqual(
      renderedTotals(linkedSummary),
    );
  });

  it('notes an unlinked account rather than reporting an empty collection as a total', () => {
    configure({ isAuthenticated: signal(true) }, { ...linkedSummary, libraryTotal: 0, linked: false });

    expect(render().querySelector('#home-unlinked-notice')?.textContent?.trim()).toBe(UNLINKED_NOTICE);
  });

  it('renders an error state when the resolver degraded to null', () => {
    configure({ isAuthenticated: signal(true) }, null);

    const compiled = render();

    expect(compiled.querySelector('#home-totals-unavailable')?.textContent?.trim()).toBe(TOTALS_UNAVAILABLE_MESSAGE);
    expect(compiled.querySelector('#home-totals')).toBeNull();
  });

  const primaryActionOf = (compiled: HTMLElement) => ({
    label: compiled.querySelector('#home-action-0')?.textContent?.trim(),
    primary: compiled.querySelector('#home-action-0')?.getAttribute('data-primary'),
  });

  it('leads with the PSN link step while no account is linked, since My Library would land empty', () => {
    configure({ isAuthenticated: signal(true) }, { ...linkedSummary, libraryTotal: 0, linked: false });

    expect(primaryActionOf(render())).toEqual({ label: MANAGE_PSN_LINK_LABEL, primary: String(true) });
  });

  it('leads with My Library once an account is linked', () => {
    configure({ isAuthenticated: signal(true) }, linkedSummary);

    expect(primaryActionOf(render())).toEqual({ label: MY_LIBRARY_LABEL, primary: String(true) });
  });

  it('leaves My Library leading when the profile call degraded, rather than guessing at a link step', () => {
    configure({ isAuthenticated: signal(true) }, { ...linkedSummary, linked: null });

    expect(primaryActionOf(render())).toEqual({ label: MY_LIBRARY_LABEL, primary: String(true) });
  });

  it('offers exactly one primary action, whichever leads', () => {
    configure({ isAuthenticated: signal(true) }, { ...linkedSummary, linked: false });

    const primaries = render().querySelectorAll('#home-actions [crgButtonPrimary]');

    expect(primaries).toHaveLength(1);
  });
});
