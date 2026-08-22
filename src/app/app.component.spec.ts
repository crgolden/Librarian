import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AppComponent } from './app.component';
import { AuthService } from '../auth/auth.service';

const SIGNED_IN_SUB = 'e2e-user-id';

function configure(auth: Partial<AuthService>): void {
  TestBed.configureTestingModule({
    imports: [AppComponent],
    providers: [
      provideRouter([]),
      { provide: AuthService, useValue: { sub: signal(SIGNED_IN_SUB), session: signal([]), ...auth } },
    ],
  });
}

describe('AppComponent', () => {
  it('shows a Sign in button and no user chip when anonymous', () => {
    configure({ isAuthenticated: signal(false), loginUrl: '/bff/login' });

    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();

    const compiled: HTMLElement = fixture.nativeElement;
    const signIn = compiled.querySelector('a.btn-primary');
    expect(signIn?.textContent).toContain('Sign in');
    expect(signIn?.getAttribute('href')).toBe('/bff/login');
    expect(compiled.querySelector('.user-chip')).toBeNull();
    expect(compiled.textContent).not.toContain('PSN Settings');
  });

  it('shows the user chip, PSN Settings, and Sign out when authenticated', () => {
    configure({
      isAuthenticated: signal(true),
      email: signal('chris@example.com'),
      username: signal(null),
      picture: signal('https://example.com/avatar.png'),
      logoutUrl: signal('/bff/logout?sid=abc'),
    });

    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();

    const compiled: HTMLElement = fixture.nativeElement;
    expect(compiled.querySelector('.user-email')?.textContent?.trim()).toBe('chris@example.com');
    expect(compiled.querySelector('.user-email')?.getAttribute('title')).toBe('chris@example.com');
    const img = compiled.querySelector<HTMLImageElement>('img.avatar');
    expect(img?.getAttribute('src')).toBe('https://example.com/avatar.png');
    expect(img?.getAttribute('loading')).toBeNull();
    expect(compiled.textContent).toContain('PSN Settings');
    const signOut = compiled.querySelector('a.btn-ghost');
    expect(signOut?.textContent).toContain('Sign out');
    expect(signOut?.getAttribute('href')).toBe('/bff/logout?sid=abc');
  });

  it('serves the avatar from Identity when no picture claim is present, rather than an initial letter', () => {
    configure({
      isAuthenticated: signal(true),
      email: signal('chris@example.com'),
      username: signal(null),
      picture: signal(null),
      logoutUrl: signal(null),
    });

    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();

    const compiled: HTMLElement = fixture.nativeElement;
    const img = compiled.querySelector<HTMLImageElement>('img.avatar');
    expect(img?.getAttribute('src')).toBe(`/bff/avatar/${SIGNED_IN_SUB}`);
    expect(compiled.querySelector('.avatar-fallback')).toBeNull();
    expect(compiled.querySelector('a.btn-ghost')?.getAttribute('href')).toBe('#');
  });

  it('falls back to username, then "?", when no email claim is present', () => {
    configure({
      isAuthenticated: signal(true),
      email: signal(null),
      username: signal('chris'),
      picture: signal(null),
      logoutUrl: signal(null),
    });

    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();

    const compiled: HTMLElement = fixture.nativeElement;
    expect(compiled.querySelector('.user-email')?.textContent?.trim()).toBe('chris');
    expect(compiled.querySelector<HTMLImageElement>('img.avatar')?.getAttribute('alt')).toBe('chris');
  });

  it('falls back to "you" / "?" when neither email nor username claims are present', () => {
    configure({
      isAuthenticated: signal(true),
      email: signal(null),
      username: signal(null),
      picture: signal(null),
      logoutUrl: signal(null),
    });

    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();

    const compiled: HTMLElement = fixture.nativeElement;
    expect(compiled.querySelector('.user-email')?.textContent?.trim()).toBe('you');
    expect(compiled.querySelector<HTMLImageElement>('img.avatar')?.getAttribute('alt')).toBe('Signed-in account');
  });
});
