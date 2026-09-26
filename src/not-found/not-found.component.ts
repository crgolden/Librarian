import { HttpStatusCode } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, inject, RESPONSE_INIT } from '@angular/core';
import { Meta } from '@angular/platform-browser';
import { RouterLink } from '@angular/router';
import { PageSectionDirective } from '@crgolden/modules/primitives';
import { AppUrls } from '../app/app-paths';
import { MetaNames, RobotsDirectives } from '../shared/seo-contract';

@Component({
  selector: 'app-not-found',
  imports: [RouterLink, PageSectionDirective],
  templateUrl: './not-found.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NotFoundComponent {
  protected readonly appUrls = AppUrls;

  private readonly responseInit = inject(RESPONSE_INIT);
  private readonly meta = inject(Meta);

  constructor() {
    if (this.responseInit !== null) {
      this.responseInit.status = HttpStatusCode.NotFound;
    }

    this.meta.updateTag({ name: MetaNames.robots, content: RobotsDirectives.noIndex });
  }
}
