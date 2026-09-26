import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { SourceRepositories } from '../shared/source-repositories';
import { AppUrls } from '../app/app-paths';
import { FaqComponent } from './faq.component';

describe('FaqComponent', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [FaqComponent],
      providers: [provideRouter([])],
    });
  });

  it('gives every question heading a unique authored id so its anchor survives server rendering and rewording', () => {
    const fixture = TestBed.createComponent(FaqComponent);
    fixture.detectChanges();

    const compiled: HTMLElement = fixture.nativeElement;
    const ids = Array.from(compiled.querySelectorAll('h2')).map((heading) => heading.id);
    expect(ids.length).toBeGreaterThan(0);
    expect(ids).not.toContain('');
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('links to both open-source GitHub repos', () => {
    const fixture = TestBed.createComponent(FaqComponent);
    fixture.detectChanges();

    const compiled: HTMLElement = fixture.nativeElement;
    const links = Array.from(compiled.querySelectorAll('a')).map((a) => a.getAttribute('href'));
    expect(links).toContain(SourceRepositories.librarian);
    expect(links).toContain(SourceRepositories.curator);
  });

  it('opens every external link in a new tab without leaking the opener', () => {
    const fixture = TestBed.createComponent(FaqComponent);
    fixture.detectChanges();

    const compiled: HTMLElement = fixture.nativeElement;
    const external = Array.from(compiled.querySelectorAll('a[href^="http"]'));
    expect(external.length).toBeGreaterThan(0);
    expect(external.map((a) => a.getAttribute('target'))).not.toContain(null);
    expect(external.map((a) => a.getAttribute('rel'))).not.toContain(null);
  });

  it('links to the privacy policy', () => {
    const fixture = TestBed.createComponent(FaqComponent);
    fixture.detectChanges();

    const compiled: HTMLElement = fixture.nativeElement;
    expect(compiled.querySelector('#faq-privacy-link')?.getAttribute('href')).toBe(AppUrls.privacy);
  });
});
