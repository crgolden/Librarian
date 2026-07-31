import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { FaqComponent } from './faq.component';

describe('FaqComponent', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [FaqComponent],
      providers: [provideRouter([])],
    });
  });

  it('explains what an NPSSO token is', () => {
    const fixture = TestBed.createComponent(FaqComponent);
    fixture.detectChanges();

    const compiled: HTMLElement = fixture.nativeElement;
    expect(compiled.textContent).toContain('What is an NPSSO token?');
    expect(compiled.textContent).toContain('works like a password');
  });

  it('links to both open-source GitHub repos', () => {
    const fixture = TestBed.createComponent(FaqComponent);
    fixture.detectChanges();

    const compiled: HTMLElement = fixture.nativeElement;
    const links = Array.from(compiled.querySelectorAll('a')).map((a) => a.getAttribute('href'));
    expect(links).toContain('https://github.com/crgolden/Librarian');
    expect(links).toContain('https://github.com/crgolden/Curator');
  });

  it('explains the RAWG/OpenCritic keys and the shared-cache behavior', () => {
    const fixture = TestBed.createComponent(FaqComponent);
    fixture.detectChanges();

    const compiled: HTMLElement = fixture.nativeElement;
    expect(compiled.textContent).toContain('What are the RAWG/OpenCritic keys');
    expect(compiled.textContent).toContain('never your key');
    expect(compiled.textContent).toContain('How do I remove a RAWG/OpenCritic key?');
  });

  it('explains that PS5 games can be stored on external storage but not played from it', () => {
    const fixture = TestBed.createComponent(FaqComponent);
    fixture.detectChanges();

    const compiled: HTMLElement = fixture.nativeElement;
    expect(compiled.textContent).toContain('Can I keep PS5 games on an external drive?');
    // Storing is supported by Sony and tracked by Librarian; only playing from USB is restricted, and
    // M.2 is not restricted at all. Conflating those was a real bug in an earlier draft of this answer.
    expect(compiled.textContent).toContain('copied back to the internal SSD or an M.2 drive');
    expect(compiled.textContent).toContain('those play straight off USB');
    expect(compiled.textContent).toContain('PS5 games play directly from those');
  });

  it('states there are no ads or ad tracking, and never will be', () => {
    const fixture = TestBed.createComponent(FaqComponent);
    fixture.detectChanges();

    const compiled: HTMLElement = fixture.nativeElement;
    expect(compiled.textContent).toContain('Do you show ads, or track me for advertisers?');
    expect(compiled.textContent).toContain('No, and we never will');
  });

  it('links to the privacy policy', () => {
    const fixture = TestBed.createComponent(FaqComponent);
    fixture.detectChanges();

    const compiled: HTMLElement = fixture.nativeElement;
    const link = compiled.querySelector('a[routerLink="/privacy"]');
    expect(link).not.toBeNull();
  });
});
