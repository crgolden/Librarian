import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';
import { PageContainerDirective } from '@crgolden/modules/primitives';
import { AuthService } from '../auth/auth.service';
import { AvatarComponent } from '../shared/avatar/avatar.component';
import { SiteNavComponent } from './nav/site-nav.component';
import { AppUrls } from './app-paths';
import { ANONYMOUS_USER_LABEL, SIGNED_IN_ACCOUNT_LABEL } from './app.messages';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, SiteNavComponent, AvatarComponent, PageContainerDirective],
  templateUrl: './app.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppComponent {
  protected readonly appUrls = AppUrls;
  protected readonly signedInAccountLabel = SIGNED_IN_ACCOUNT_LABEL;
  protected readonly anonymousUserLabel = ANONYMOUS_USER_LABEL;

  protected readonly auth = inject(AuthService);
}
