import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RAWG_HOME_URL, RawgAttributionComponent } from './rawg-attribution.component';
import { ProviderNames } from '../../../shared/provider-names';
import { HtmlLinkTargets, LinkRelTokens } from '../../../testing/html-constants';

function configure(): ComponentFixture<RawgAttributionComponent> {
  TestBed.configureTestingModule({ imports: [RawgAttributionComponent] });
  const fixture = TestBed.createComponent(RawgAttributionComponent);
  fixture.detectChanges();
  return fixture;
}

describe('RawgAttributionComponent', () => {
  it('links to RAWG, which its terms require of every page rendering their data', () => {
    const compiled: HTMLElement = configure().nativeElement;

    const link = compiled.querySelector('#rawg-attribution a');
    expect(link?.getAttribute('href')).toBe(RAWG_HOME_URL);
    expect(link?.textContent).toContain(ProviderNames.rawg);
  });

  it('opens the link in a new tab without handing RAWG the opener', () => {
    const compiled: HTMLElement = configure().nativeElement;

    const link = compiled.querySelector('#rawg-attribution a');
    expect(link?.getAttribute('target')).toBe(HtmlLinkTargets.blank);
    expect(link?.getAttribute('rel')).toContain(LinkRelTokens.noopener);
  });
});
