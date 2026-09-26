import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AppComponent } from './app.component';
import { AuthService } from '../auth/auth.service';
import { BffPaths, SID_QUERY_PARAMETER } from '../shared/bff-contract';
import { PageTitles } from '../shared/page-title';
import { ANONYMOUS_USER_LABEL, SIGNED_IN_ACCOUNT_LABEL } from './app.messages';
import { SIGN_OUT_FALLBACK_HREF } from './nav/site-nav.component';
import { newEmailAddress, newHttpsAddress, newId, newText } from '@crgolden/modules/testing';

const EMAIL = newEmailAddress();
const USERNAME = newText();
const PICTURE_URL = newHttpsAddress();
const PROVIDER_SID = newId();

const SIGNED_IN_SUB = newId();

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
    configure({ isAuthenticated: signal(false), loginUrl: BffPaths.login });

    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();

    const compiled: HTMLElement = fixture.nativeElement;
    const signIn = compiled.querySelector('#nav-link-signin');
    expect(signIn?.getAttribute('href')).toBe(BffPaths.login);
    expect(compiled.querySelector('#user-chip')).toBeNull();
    expect(compiled.textContent).not.toContain(PageTitles.account);
  });

  it('shows the user chip, Account, and Sign out when authenticated', () => {
    configure({
      isAuthenticated: signal(true),
      email: signal(EMAIL),
      username: signal(null),
      picture: signal(PICTURE_URL),
      logoutUrl: signal(`${BffPaths.logout}?${SID_QUERY_PARAMETER}=${PROVIDER_SID}`),
    });

    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();

    const compiled: HTMLElement = fixture.nativeElement;
    expect(compiled.querySelector('#user-email')?.textContent?.trim()).toBe(EMAIL);
    expect(compiled.querySelector('#user-email')?.getAttribute('title')).toBe(EMAIL);
    const img = compiled.querySelector<HTMLImageElement>('#nav-avatar img');
    expect(img?.getAttribute('src')).toBe(PICTURE_URL);
    expect(img?.getAttribute('loading')).toBeNull();
    expect(compiled.textContent).toContain(PageTitles.account);
    const signOut = compiled.querySelector('#nav-rail-signout');
    expect(signOut?.getAttribute('href')).toBe(`${BffPaths.logout}?${SID_QUERY_PARAMETER}=${PROVIDER_SID}`);
  });

  it('serves the avatar from Identity when no picture claim is present, rather than an initial letter', () => {
    configure({
      isAuthenticated: signal(true),
      email: signal(EMAIL),
      username: signal(null),
      picture: signal(null),
      logoutUrl: signal(null),
    });

    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();

    const compiled: HTMLElement = fixture.nativeElement;
    const img = compiled.querySelector<HTMLImageElement>('#nav-avatar img');
    expect(img?.getAttribute('src')).toBe(BffPaths.avatar(SIGNED_IN_SUB));
    expect(compiled.querySelector('.avatar-fallback')).toBeNull();
    expect(compiled.querySelector('#nav-rail-signout')?.getAttribute('href')).toBe(SIGN_OUT_FALLBACK_HREF);
  });

  it('falls back to username, then "?", when no email claim is present', () => {
    configure({
      isAuthenticated: signal(true),
      email: signal(null),
      username: signal(USERNAME),
      picture: signal(null),
      logoutUrl: signal(null),
    });

    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();

    const compiled: HTMLElement = fixture.nativeElement;
    expect(compiled.querySelector('#user-email')?.textContent?.trim()).toBe(USERNAME);
    expect(compiled.querySelector<HTMLImageElement>('#nav-avatar img')?.getAttribute('alt')).toBe(USERNAME);
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
    expect(compiled.querySelector('#user-email')?.textContent?.trim()).toBe(ANONYMOUS_USER_LABEL);
    expect(compiled.querySelector<HTMLImageElement>('#nav-avatar img')?.getAttribute('alt')).toBe(SIGNED_IN_ACCOUNT_LABEL);
  });
});
