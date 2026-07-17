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

  it('links to the privacy policy', () => {
    const fixture = TestBed.createComponent(FaqComponent);
    fixture.detectChanges();

    const compiled: HTMLElement = fixture.nativeElement;
    const link = compiled.querySelector('a[routerLink="/privacy"]');
    expect(link).not.toBeNull();
  });
});
