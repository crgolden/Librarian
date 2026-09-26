import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CardDirective, PageSectionDirective } from '@crgolden/modules/primitives';
import { PageTocComponent } from '../app/shared/toc/page-toc.component';
import { AppUrls } from '../app/app-paths';
import { SourceRepositories } from '../shared/source-repositories';

@Component({
  selector: 'app-faq',
  imports: [RouterLink, PageTocComponent, CardDirective, PageSectionDirective],
  templateUrl: './faq.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FaqComponent {
  protected readonly appUrls = AppUrls;
  protected readonly sourceRepositories = SourceRepositories;
}
