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

  it('discloses that a shared collection link works without signing in and reveals no account identity', () => {
    const fixture = TestBed.createComponent(PrivacyComponent);
    fixture.detectChanges();

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Sharing and visibility');
    expect(text).toContain("doesn't require signing in at all");
    expect(text).toContain('not your account identity, your PlayStation ID');
  });

  it('separates live-read trophy data from the stored completion percentage', () => {
    const fixture = TestBed.createComponent(PrivacyComponent);
    fixture.detectChanges();

    const compiled: HTMLElement = fixture.nativeElement;
    const text = (compiled.textContent ?? '').replace(/\s+/g, ' ');
    expect(text).toContain('Individual trophies');
    expect(text).toContain('cached for 15 minutes, never stored permanently');
    expect(text).toContain('how far through its trophy list you are');
  });

  it('promises that opting out or unlinking erases stored completion percentages, not just stops refreshing them', () => {
    const fixture = TestBed.createComponent(PrivacyComponent);
    fixture.detectChanges();

    const compiled: HTMLElement = fixture.nativeElement;
    const text = (compiled.textContent ?? '').replace(/\s+/g, ' ');
    expect(text).toContain("erases those numbers, it doesn't just stop refreshing them");
    expect(text).toContain('erased the moment you turn trophy harvesting off, unlink, or delete your account');
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

  it('states there is no advertising or tracking, and never will be', () => {
    const fixture = TestBed.createComponent(PrivacyComponent);
    fixture.detectChanges();

    const compiled: HTMLElement = fixture.nativeElement;
    expect(compiled.textContent).toContain('Advertising and tracking');
    expect(compiled.textContent).toContain("We don't run ads, and we never will");
  });

  it('shows the privacy contact address', () => {
    const fixture = TestBed.createComponent(PrivacyComponent);
    fixture.detectChanges();

    const compiled: HTMLElement = fixture.nativeElement;
    const mailLink = compiled.querySelector('a[href="mailto:privacy@crgolden.com"]');
    expect(mailLink).not.toBeNull();
  });
});
