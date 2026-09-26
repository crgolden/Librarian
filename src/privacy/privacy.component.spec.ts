import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { SourceRepositories } from '../shared/source-repositories';
import { PRIVACY_CONTACT_EMAIL } from '../shared/contact';
import { AppUrls } from '../app/app-paths';
import { PrivacyComponent } from './privacy.component';

describe('PrivacyComponent', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [PrivacyComponent],
      providers: [provideRouter([])],
    });
  });

  it('gives every section heading a unique authored id so its anchor survives server rendering and rewording', () => {
    const fixture = TestBed.createComponent(PrivacyComponent);
    fixture.detectChanges();

    const compiled: HTMLElement = fixture.nativeElement;
    const ids = Array.from(compiled.querySelectorAll('h2')).map((heading) => heading.id);
    expect(ids.length).toBeGreaterThan(0);
    expect(ids).not.toContain('');
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('links to both open-source GitHub repos', () => {
    const fixture = TestBed.createComponent(PrivacyComponent);
    fixture.detectChanges();

    const compiled: HTMLElement = fixture.nativeElement;
    const links = Array.from(compiled.querySelectorAll('a')).map((a) => a.getAttribute('href'));
    expect(links).toContain(SourceRepositories.librarian);
    expect(links).toContain(SourceRepositories.curator);
  });

  it('opens every external link in a new tab without leaking the opener', () => {
    const fixture = TestBed.createComponent(PrivacyComponent);
    fixture.detectChanges();

    const compiled: HTMLElement = fixture.nativeElement;
    const external = Array.from(compiled.querySelectorAll('a[href^="http"]'));
    expect(external.length).toBeGreaterThan(0);
    expect(external.map((a) => a.getAttribute('target'))).not.toContain(null);
    expect(external.map((a) => a.getAttribute('rel'))).not.toContain(null);
  });

  it('links to the FAQ', () => {
    const fixture = TestBed.createComponent(PrivacyComponent);
    fixture.detectChanges();

    const compiled: HTMLElement = fixture.nativeElement;
    expect(compiled.querySelector('#privacy-faq-link')?.getAttribute('href')).toBe(AppUrls.faq);
  });

  it('shows the privacy contact address', () => {
    const fixture = TestBed.createComponent(PrivacyComponent);
    fixture.detectChanges();

    const compiled: HTMLElement = fixture.nativeElement;
    const mailLink = compiled.querySelector(`a[href="mailto:${PRIVACY_CONTACT_EMAIL}"]`);
    expect(mailLink).not.toBeNull();
  });
});
