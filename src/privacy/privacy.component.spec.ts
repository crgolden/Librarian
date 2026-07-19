import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { PrivacyComponent } from './privacy.component';

describe('PrivacyComponent', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [PrivacyComponent],
      providers: [provideRouter([])],
    });
  });

  it('lists what is never collected', () => {
    const fixture = TestBed.createComponent(PrivacyComponent);
    fixture.detectChanges();

    const compiled: HTMLElement = fixture.nativeElement;
    expect(compiled.textContent).toContain('What we never collect');
    expect(compiled.textContent).toContain('NPSSO token');
  });

  it('describes the action-history log and its one-year retention past deletion', () => {
    const fixture = TestBed.createComponent(PrivacyComponent);
    fixture.detectChanges();

    const compiled: HTMLElement = fixture.nativeElement;
    expect(compiled.textContent).toContain('Your action history');
    expect(compiled.textContent).toContain('one year');
  });

  it('links to both open-source GitHub repos', () => {
    const fixture = TestBed.createComponent(PrivacyComponent);
    fixture.detectChanges();

    const compiled: HTMLElement = fixture.nativeElement;
    const links = Array.from(compiled.querySelectorAll('a')).map((a) => a.getAttribute('href'));
    expect(links).toContain('https://github.com/crgolden/Librarian');
    expect(links).toContain('https://github.com/crgolden/Curator');
  });

  it('discloses that a provided RAWG/OpenCritic key is encrypted and that retrieved metadata is shared, never the key', () => {
    const fixture = TestBed.createComponent(PrivacyComponent);
    fixture.detectChanges();

    const compiled: HTMLElement = fixture.nativeElement;
    expect(compiled.textContent).toContain('About RAWG/OpenCritic keys');
    expect(compiled.textContent).toContain("never shown back to you or anyone else");
    expect(compiled.textContent).toContain('never your key');
  });

  it('shows the privacy contact address', () => {
    const fixture = TestBed.createComponent(PrivacyComponent);
    fixture.detectChanges();

    const compiled: HTMLElement = fixture.nativeElement;
    const mailLink = compiled.querySelector('a[href="mailto:privacy@crgolden.com"]');
    expect(mailLink).not.toBeNull();
  });
});
