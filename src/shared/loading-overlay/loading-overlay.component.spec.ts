import { ComponentFixture, TestBed } from '@angular/core/testing';
import { LoadingOverlayComponent } from './loading-overlay.component';

describe('LoadingOverlayComponent', () => {
  let fixture: ComponentFixture<LoadingOverlayComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [LoadingOverlayComponent],
    });
    fixture = TestBed.createComponent(LoadingOverlayComponent);
  });

  it('renders nothing when visible is false (the default)', () => {
    fixture.detectChanges();

    const compiled: HTMLElement = fixture.nativeElement;
    expect(compiled.querySelector('.loading-overlay')).toBeNull();
  });

  it('renders the overlay with a status role and busy/live ARIA attributes when visible is true', () => {
    fixture.componentRef.setInput('visible', true);
    fixture.detectChanges();

    const compiled: HTMLElement = fixture.nativeElement;
    const overlay = compiled.querySelector('.loading-overlay');
    expect(overlay).not.toBeNull();
    expect(overlay?.getAttribute('role')).toBe('status');
    expect(overlay?.getAttribute('aria-busy')).toBe('true');
    expect(overlay?.getAttribute('aria-live')).toBe('polite');
  });

  it('removes the overlay again when visible flips back to false', () => {
    fixture.componentRef.setInput('visible', true);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.loading-overlay')).not.toBeNull();

    fixture.componentRef.setInput('visible', false);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.loading-overlay')).toBeNull();
  });
});
