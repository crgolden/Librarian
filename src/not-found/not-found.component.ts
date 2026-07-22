import { ChangeDetectionStrategy, Component, inject, RESPONSE_INIT } from '@angular/core';
import { Meta } from '@angular/platform-browser';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-not-found',
  imports: [RouterLink],
  templateUrl: './not-found.component.html',
  styleUrl: './not-found.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NotFoundComponent {
  private readonly responseInit = inject(RESPONSE_INIT);
  private readonly meta = inject(Meta);

  constructor() {
    // RESPONSE_INIT is null during CSR, SSG, build, and dev route extraction — only
    // set the status when actually rendering a response on the server.
    if (this.responseInit !== null) {
      this.responseInit.status = 404;
    }

    this.meta.updateTag({ name: 'robots', content: 'noindex' });
  }
}
