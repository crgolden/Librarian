import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { HomeComponent } from './home.component';
import { AuthService } from '../auth/auth.service';

function configure(auth: Partial<AuthService>): void {
  TestBed.configureTestingModule({
    imports: [HomeComponent],
    providers: [provideRouter([]), { provide: AuthService, useValue: auth }],
  });
}

describe('HomeComponent', () => {
  it('shows a sign-in prompt when anonymous', () => {
    configure({ isAuthenticated: () => false, loginUrl: '/bff/login' });

    const fixture = TestBed.createComponent(HomeComponent);
    fixture.detectChanges();

    const compiled: HTMLElement = fixture.nativeElement;
    expect(compiled.textContent).toContain('Sign in to link your PlayStation Network account');
    const link = compiled.querySelector('a.btn-primary');
    expect(link?.textContent).toContain('Sign in');
    expect(link?.getAttribute('href')).toBe('/bff/login');
  });

  it('shows the signed-in status and a Manage PSN Link action when authenticated', () => {
    configure({ isAuthenticated: () => true, username: () => 'chris' });

    const fixture = TestBed.createComponent(HomeComponent);
    fixture.detectChanges();

    const compiled: HTMLElement = fixture.nativeElement;
    expect(compiled.textContent).toContain('Signed in as');
    expect(compiled.textContent).toContain('chris');
    const link = compiled.querySelector('a.btn-primary');
    expect(link?.textContent).toContain('Manage PSN Link');
  });

  it('falls back to "you" when no username/name claim is present', () => {
    configure({ isAuthenticated: () => true, username: () => null });

    const fixture = TestBed.createComponent(HomeComponent);
    fixture.detectChanges();

    const compiled: HTMLElement = fixture.nativeElement;
    expect(compiled.textContent).toContain('Signed in as');
    expect(compiled.textContent).toContain('you');
  });
});
