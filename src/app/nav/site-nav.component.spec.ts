import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { of } from 'rxjs';
import { SiteNavComponent } from './site-nav.component';
import { AuthService } from '../../auth/auth.service';
import { AdminService } from '../../admin/admin.service';

function configure(
  auth: Partial<AuthService>,
  admin: Partial<AdminService> = { isAdmin: signal(false), ensureLoaded: () => of(false) },
): ComponentFixture<SiteNavComponent> {
  TestBed.configureTestingModule({
    imports: [SiteNavComponent],
    providers: [
      provideRouter([
        { path: '', children: [] },
        { path: 'catalog', children: [] },
        { path: 'collections', children: [] },
        { path: 'library', children: [] },
        { path: 'profile', children: [] },
        { path: 'admin/enrichment', children: [] },
      ]),
      { provide: AuthService, useValue: auth },
      { provide: AdminService, useValue: admin },
    ],
  });
  const fixture = TestBed.createComponent(SiteNavComponent);
  fixture.detectChanges();
  return fixture;
}

describe('SiteNavComponent', () => {
  it('shows only Sign in when anonymous, no primary links', () => {
    const fixture = configure({ isAuthenticated: signal(false), loginUrl: '/bff/login' });
    const compiled: HTMLElement = fixture.nativeElement;

    expect(compiled.querySelector('a.btn-primary')?.textContent).toContain('Sign in');
    expect(compiled.textContent).not.toContain('Catalog');
    expect(compiled.querySelector('.site-nav-tabbar')).toBeNull();
  });

  it('renders all 5 primary destinations plus PSN Settings and Sign out when authenticated, in both desktop and mobile markup', () => {
    const fixture = configure({
      isAuthenticated: signal(true),
      email: signal('chris@example.com'),
      username: signal(null),
      picture: signal(null),
      logoutUrl: signal('/bff/logout?sid=abc'),
    });
    const compiled: HTMLElement = fixture.nativeElement;

    for (const label of ['Home', 'Catalog', 'Collections', 'Library', 'Profile']) {
      expect(compiled.textContent).toContain(label);
    }
    // Desktop nav has PSN Settings + Sign out; mobile tab bar renders the same 5 primary links
    // plus its own PSN tab, so PSN linking is reachable from mobile nav too.
    expect(compiled.querySelector('.site-nav-desktop')?.textContent).toContain('PSN Settings');
    expect(compiled.querySelector('.site-nav-desktop a.btn-ghost')?.textContent).toContain('Sign out');
    expect(compiled.querySelectorAll('.site-nav-tabbar a.tab-link')).toHaveLength(6);
    expect(compiled.querySelector('.site-nav-tabbar')?.textContent).toContain('PSN');
  });

  it('does not show the Enrichment Runs link for a non-admin authenticated user', () => {
    const fixture = configure(
      {
        isAuthenticated: signal(true),
        email: signal('chris@example.com'),
        username: signal(null),
        picture: signal(null),
        logoutUrl: signal(null),
      },
      { isAdmin: signal(false), ensureLoaded: () => of(false) },
    );

    expect(fixture.nativeElement.textContent).not.toContain('Enrichment Runs');
  });

  it('shows the Enrichment Runs link, desktop-only, for an admin authenticated user', () => {
    const fixture = configure(
      {
        isAuthenticated: signal(true),
        email: signal('chris@example.com'),
        username: signal(null),
        picture: signal(null),
        logoutUrl: signal(null),
      },
      { isAdmin: signal(true), ensureLoaded: () => of(true) },
    );
    const compiled: HTMLElement = fixture.nativeElement;

    expect(compiled.querySelector('.site-nav-desktop')?.textContent).toContain('Enrichment Runs');
    expect(compiled.querySelector('.site-nav-tabbar')?.textContent).not.toContain('Enrichment Runs');
  });

  it('calls ensureLoaded() when authenticated, not when anonymous', () => {
    let calls = 0;
    const admin: Partial<AdminService> = {
      isAdmin: signal(false),
      ensureLoaded: () => {
        calls++;
        return of(false);
      },
    };
    configure({ isAuthenticated: signal(false), loginUrl: '/bff/login' }, admin);
    expect(calls).toBe(0);

    TestBed.resetTestingModule();
    configure(
      {
        isAuthenticated: signal(true),
        email: signal('chris@example.com'),
        username: signal(null),
        picture: signal(null),
        logoutUrl: signal(null),
      },
      admin,
    );
    expect(calls).toBe(1);
  });

  it('marks the active route with routerLinkActive', async () => {
    const fixture = configure({
      isAuthenticated: signal(true),
      email: signal('chris@example.com'),
      username: signal(null),
      picture: signal(null),
      logoutUrl: signal(null),
    });
    const router = TestBed.inject(Router);
    await router.navigateByUrl('/catalog');
    fixture.detectChanges();

    const compiled: HTMLElement = fixture.nativeElement;
    const catalogLink = Array.from(compiled.querySelectorAll('.site-nav-desktop a')).find((a) => a.textContent === 'Catalog');
    expect(catalogLink?.classList.contains('nav-active')).toBe(true);
  });
});
