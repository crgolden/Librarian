import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';
import { AuthService } from '../auth/auth.service';
import { AvatarComponent } from '../shared/avatar/avatar.component';
import { SiteNavComponent } from './nav/site-nav.component';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, SiteNavComponent, AvatarComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppComponent {
  protected readonly auth = inject(AuthService);
}
