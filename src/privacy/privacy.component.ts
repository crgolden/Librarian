import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CardDirective, PageSectionDirective } from '@crgolden/modules/primitives';
import { PageTocComponent } from '../app/shared/toc/page-toc.component';
import { AppUrls } from '../app/app-paths';
import { SourceRepositories } from '../shared/source-repositories';
import { PRIVACY_CONTACT_EMAIL } from '../shared/contact';

@Component({
  selector: 'app-privacy',
  imports: [RouterLink, PageTocComponent, CardDirective, PageSectionDirective],
  templateUrl: './privacy.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PrivacyComponent {
  protected readonly appUrls = AppUrls;
  protected readonly sourceRepositories = SourceRepositories;
  protected readonly privacyContactEmail = PRIVACY_CONTACT_EMAIL;
}
