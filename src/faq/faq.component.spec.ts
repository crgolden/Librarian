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
    expect(compiled.textContent).toContain('copied back to the internal SSD or an M.2 drive');
    expect(compiled.textContent).toContain('those play straight off USB');
    expect(compiled.textContent).toContain('PS5 games play directly from those');
  });

  it('explains how games get into the public catalog', () => {
    const fixture = TestBed.createComponent(FaqComponent);
    fixture.detectChanges();

    const compiled: HTMLElement = fixture.nativeElement;
    expect(compiled.textContent).toContain('How do games get into the public catalog?');
    expect(compiled.textContent).toContain('no PSN account is needed to browse it');
    expect(compiled.textContent).toContain("PlayStation's own full-game classification");
  });

  it('explains where a catalog game\'s franchise, genre, and tier come from', () => {
    const fixture = TestBed.createComponent(FaqComponent);
    fixture.detectChanges();

    const compiled: HTMLElement = fixture.nativeElement;
    expect(compiled.textContent).toContain("Where do a catalog game's franchise, genre, and tier come from?");
    expect(compiled.textContent).toContain('PlayStation Store is the source of truth');
    expect(compiled.textContent).toContain('fall back to RAWG');
  });

  it('explains why a catalog listing shows three separate scores', () => {
    const fixture = TestBed.createComponent(FaqComponent);
    fixture.detectChanges();

    const compiled: HTMLElement = fixture.nativeElement;
    expect(compiled.textContent).toContain('Why does a catalog listing show three separate scores?');
    expect(compiled.textContent).toContain('never adjusted or replaced by anything from RAWG or OpenCritic');
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
