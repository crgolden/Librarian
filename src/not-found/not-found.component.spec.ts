import { RESPONSE_INIT } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Meta } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { NotFoundComponent } from './not-found.component';

describe('NotFoundComponent', () => {
  it('sets the response status to 404 when RESPONSE_INIT is provided', () => {
    const responseInit: { status?: number } = {};
    TestBed.configureTestingModule({
      imports: [NotFoundComponent],
      providers: [provideRouter([]), { provide: RESPONSE_INIT, useValue: responseInit }],
    });

    const fixture = TestBed.createComponent(NotFoundComponent);
    fixture.detectChanges();

    expect(responseInit.status).toBe(404);
  });

  it('does not throw when RESPONSE_INIT is null', () => {
    TestBed.configureTestingModule({
      imports: [NotFoundComponent],
      providers: [provideRouter([]), { provide: RESPONSE_INIT, useValue: null }],
    });

    expect(() => {
      const fixture = TestBed.createComponent(NotFoundComponent);
      fixture.detectChanges();
    }).not.toThrow();
  });

  it('sets a noindex robots meta tag', () => {
    TestBed.configureTestingModule({
      imports: [NotFoundComponent],
      providers: [provideRouter([]), { provide: RESPONSE_INIT, useValue: null }],
    });

    const fixture = TestBed.createComponent(NotFoundComponent);
    fixture.detectChanges();

    const meta = TestBed.inject(Meta);
    const tag = meta.getTag('name="robots"');
    expect(tag?.content).toBe('noindex');
  });

  it('renders a friendly message with a link back home', () => {
    TestBed.configureTestingModule({
      imports: [NotFoundComponent],
      providers: [provideRouter([]), { provide: RESPONSE_INIT, useValue: null }],
    });

    const fixture = TestBed.createComponent(NotFoundComponent);
    fixture.detectChanges();

    const compiled: HTMLElement = fixture.nativeElement;
    expect(compiled.textContent).toContain('Page not found');
    const link = compiled.querySelector('a[routerLink="/"]');
    expect(link).not.toBeNull();
  });
});
