import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { AriaRoles } from '../aria-roles';

@Component({
  selector: 'app-loading-overlay',
  templateUrl: './loading-overlay.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoadingOverlayComponent {
  protected readonly ariaRoles = AriaRoles;

  @Input() visible = false;
}
