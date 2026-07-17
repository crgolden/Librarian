import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

/**
 * Full-viewport blocking overlay shown while a request that must not be interrupted (e.g. a PSN
 * preference toggle round-trip) is in flight. Transparent by design — it exists only to swallow
 * clicks via `pointer-events: all` and announce busy state to assistive tech, not to dim the page.
 *
 * Uses a classic `@Input()` decorator rather than the `input()` signal function: this repo's
 * Vitest harness JIT-compiles components without running the Angular AOT compiler (ngtsc), and
 * signal-based inputs have no metadata for `TestBed`'s `componentRef.setInput()` to find outside
 * of an ngtsc build, so they silently fail to bind (`NG0303`) under this test setup.
 */
@Component({
  selector: 'app-loading-overlay',
  templateUrl: './loading-overlay.component.html',
  styleUrl: './loading-overlay.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoadingOverlayComponent {
  @Input() visible = false;
}
