import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { SiteNavComponent } from './site-nav.component';
import { AuthService } from '../../auth/auth.service';

function configure(auth: Partial<AuthService>): ComponentFixture<SiteNavComponent> {
  TestBed.configureTestingModule({
    imports: [SiteNavComponent],
    providers: [
      provideRouter([
        { path: '', children: [] },
        { path: 'catalog', children: [] },
        { path: 'collections', children: [] },
        { path: 'library', children: [] },
        { path: 'profile', children: [] },
      ]),
      { provide: AuthService, useValue: auth },
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
    // Desktop nav has PSN Settings + Sign out; mobile tab bar renders the same 5 primary links.
    expect(compiled.querySelector('.site-nav-desktop')?.textContent).toContain('PSN Settings');
    expect(compiled.querySelector('.site-nav-desktop a.btn-ghost')?.textContent).toContain('Sign out');
    expect(compiled.querySelectorAll('.site-nav-tabbar a.tab-link')).toHaveLength(5);
    expect(compiled.querySelector('.site-nav-tabbar')?.textContent).not.toContain('PSN Settings');
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
