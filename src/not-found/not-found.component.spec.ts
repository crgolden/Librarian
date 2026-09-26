import { HttpStatusCode } from '@angular/common/http';
import { RESPONSE_INIT } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Meta } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { NotFoundComponent } from './not-found.component';
import { MetaNames, RobotsDirectives } from '../shared/seo-contract';

describe('NotFoundComponent', () => {
  it('sets the response status to 404 when RESPONSE_INIT is provided', () => {
    const responseInit: { status?: number } = {};
    TestBed.configureTestingModule({
      imports: [NotFoundComponent],
      providers: [provideRouter([]), { provide: RESPONSE_INIT, useValue: responseInit }],
    });

    const fixture = TestBed.createComponent(NotFoundComponent);
    fixture.detectChanges();

    expect(responseInit.status).toBe(HttpStatusCode.NotFound);
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
    const tag = meta.getTag(`name="${MetaNames.robots}"`);
    expect(tag?.content).toBe(RobotsDirectives.noIndex);
  });

  it('renders a friendly message with a link back home', () => {
    TestBed.configureTestingModule({
      imports: [NotFoundComponent],
      providers: [provideRouter([]), { provide: RESPONSE_INIT, useValue: null }],
    });

    const fixture = TestBed.createComponent(NotFoundComponent);
    fixture.detectChanges();

    const compiled: HTMLElement = fixture.nativeElement;
    expect(compiled.querySelector('#page-title')).not.toBeNull();
    const link = compiled.querySelector('#not-found-home-link');
    expect(link).not.toBeNull();
  });
});
