import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RawgAttributionComponent } from './rawg-attribution.component';

const RAWG_HOME = 'https://rawg.io';

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
    expect(link?.getAttribute('href')).toBe(RAWG_HOME);
    expect(link?.textContent).toContain('RAWG');
  });

  it('opens the link in a new tab without handing RAWG the opener', () => {
    const compiled: HTMLElement = configure().nativeElement;

    const link = compiled.querySelector('#rawg-attribution a');
    expect(link?.getAttribute('target')).toBe('_blank');
    expect(link?.getAttribute('rel')).toContain('noopener');
  });
});
