import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { SiteNavComponent } from './site-nav.component';
import { AuthService } from '../../auth/auth.service';
import { AdminService } from '../../admin/admin.service';

function configure(
  auth: Partial<AuthService>,
  admin: Partial<AdminService> = { isAdmin: signal(false) },
): ComponentFixture<SiteNavComponent> {
  TestBed.resetTestingModule();
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
      { provide: AuthService, useValue: { sub: signal('e2e-user-id'), ...auth } },
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

  it('sends the page the visitor is on as returnTo, so signing in does not dump them at home', async () => {
    const fixture = configure({ isAuthenticated: signal(false), loginUrl: '/bff/login' });
    await TestBed.inject(Router).navigateByUrl('/catalog');
    fixture.detectChanges();

    const href = (fixture.nativeElement as HTMLElement).querySelector('a.btn-primary')?.getAttribute('href');
    expect(href).toBe('/bff/login?returnTo=%2Fcatalog');
  });

  it('omits returnTo when the visitor is already on the home page', () => {
    const fixture = configure({ isAuthenticated: signal(false), loginUrl: '/bff/login' });

    const href = (fixture.nativeElement as HTMLElement).querySelector('a.btn-primary')?.getAttribute('href');
    expect(href).toBe('/bff/login');
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
      { isAdmin: signal(false) },
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
      { isAdmin: signal(true) },
    );
    const compiled: HTMLElement = fixture.nativeElement;

    expect(compiled.querySelector('.site-nav-desktop')?.textContent).toContain('Enrichment Runs');
    expect(compiled.querySelector('.site-nav-tabbar')?.textContent).not.toContain('Enrichment Runs');
  });

  it('renders one header shape across an isAdmin false -> true transition', () => {
    const isAdmin = signal(false);
    const fixture = configure(
      {
        isAuthenticated: signal(true),
        email: signal('chris@example.com'),
        username: signal(null),
        picture: signal(null),
        logoutUrl: signal(null),
      },
      { isAdmin },
    );
    const compiled: HTMLElement = fixture.nativeElement;
    const chipBefore = !!compiled.querySelector('.user-chip');
    const labelsBefore = compiled.querySelectorAll('.site-nav-desktop .nav-label').length;

    isAdmin.set(true);
    fixture.detectChanges();

    expect(compiled.querySelector('.nav-crowded')).toBeNull();
    expect(!!compiled.querySelector('.user-chip')).toBe(chipBefore);
    expect(compiled.querySelectorAll('.site-nav-desktop .nav-label').length).toBe(labelsBefore + 1);
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
    const catalogLink = compiled.querySelector('.site-nav-desktop a[aria-label="Catalog"]');
    expect(catalogLink?.classList.contains('nav-active')).toBe(true);
  });

  it('keeps an accessible name on every desktop link, since the labels are hidden below lg', () => {
    const fixture = configure(
      {
        isAuthenticated: signal(true),
        email: signal('chris@example.com'),
        username: signal(null),
        picture: signal(null),
        logoutUrl: signal(null),
      },
      { isAdmin: signal(true) },
    );
    const compiled: HTMLElement = fixture.nativeElement;

    for (const label of ['Home', 'Catalog', 'Collections', 'Library', 'Profile', 'PSN Settings', 'Enrichment Runs', 'Sign out']) {
      expect(compiled.querySelector(`.site-nav-desktop a[aria-label="${label}"]`)).not.toBeNull();
    }
  });

  it('gives an admin and a non-admin the same header shape, so there is no second layout to flash between', () => {
    const session = {
      isAuthenticated: signal(true),
      email: signal('chris@example.com'),
      username: signal(null),
      picture: signal(null),
      logoutUrl: signal(null),
    };
    const linkCount = (fixture: ComponentFixture<SiteNavComponent>): number =>
      (fixture.nativeElement as HTMLElement).querySelectorAll('.site-nav-desktop a').length;

    const asAdmin = configure(session, { isAdmin: signal(true) });
    const adminLinks = linkCount(asAdmin);
    const adminChip = (asAdmin.nativeElement as HTMLElement).querySelector('.user-chip');
    const adminCrowded = (asAdmin.nativeElement as HTMLElement).querySelector('.nav-crowded');

    const asUser = configure(session, { isAdmin: signal(false) });

    expect(adminCrowded).toBeNull();
    expect((asUser.nativeElement as HTMLElement).querySelector('.nav-crowded')).toBeNull();
    expect(adminChip).not.toBeNull();
    expect((asUser.nativeElement as HTMLElement).querySelector('.user-chip')).not.toBeNull();
    expect(adminLinks).toBe(linkCount(asUser) + 1);
  });

  it('keeps every link label in the markup, since the label is the tooltip text', () => {
    const fixture = configure(
      {
        isAuthenticated: signal(true),
        email: signal('chris@example.com'),
        username: signal(null),
        picture: signal(null),
        logoutUrl: signal(null),
      },
      { isAdmin: signal(true) },
    );
    const compiled: HTMLElement = fixture.nativeElement;

    const labels = [...compiled.querySelectorAll('.site-nav-desktop .nav-label')].map((el) => el.textContent?.trim());
    expect(labels).toEqual([
      'Home',
      'Catalog',
      'Collections',
      'Library',
      'Profile',
      'PSN Settings',
      'Enrichment Runs',
      'Sign out',
    ]);
  });

  it('issues no request of its own — admin status comes from the session, not a round trip', () => {
    const fixture = configure(
      {
        isAuthenticated: signal(true),
        email: signal('chris@example.com'),
        username: signal(null),
        picture: signal(null),
        logoutUrl: signal(null),
      },
      { isAdmin: signal(true) },
    );

    expect((fixture.nativeElement as HTMLElement).querySelector('a[aria-label="Enrichment Runs"]')).not.toBeNull();
  });

  it('hides every icon from assistive technology, leaving the name to the link', () => {
    const fixture = configure({
      isAuthenticated: signal(true),
      email: signal('chris@example.com'),
      username: signal(null),
      picture: signal(null),
      logoutUrl: signal(null),
    });
    const icons = (fixture.nativeElement as HTMLElement).querySelectorAll('ng-icon');

    expect(icons.length).toBeGreaterThan(0);
    for (const icon of icons) {
      expect(icon.getAttribute('aria-hidden')).toBe('true');
    }
  });
});
