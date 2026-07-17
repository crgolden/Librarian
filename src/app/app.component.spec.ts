import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AppComponent } from './app.component';
import { AuthService } from '../auth/auth.service';

function configure(auth: Partial<AuthService>): void {
  TestBed.configureTestingModule({
    imports: [AppComponent],
    providers: [provideRouter([]), { provide: AuthService, useValue: auth }],
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
    const img = compiled.querySelector<HTMLImageElement>('img.avatar');
    expect(img?.getAttribute('src')).toBe('https://example.com/avatar.png');
    expect(compiled.querySelector('.avatar-fallback')).toBeNull();
    expect(compiled.textContent).toContain('PSN Settings');
    const signOut = compiled.querySelector('a.btn-ghost');
    expect(signOut?.textContent).toContain('Sign out');
    expect(signOut?.getAttribute('href')).toBe('/bff/logout?sid=abc');
  });

  it('falls back to an initial-letter avatar when no picture claim is present', () => {
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
    expect(compiled.querySelector('.avatar-fallback')?.textContent?.trim()).toBe('C');
    expect(compiled.querySelector('img.avatar')).toBeNull();
    // Falls back to '#' rather than a broken link when there is no logout URL claim yet.
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
    expect(compiled.querySelector('.avatar-fallback')?.textContent?.trim()).toBe('C');
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
    expect(compiled.querySelector('.avatar-fallback')?.textContent?.trim()).toBe('?');
  });
});
