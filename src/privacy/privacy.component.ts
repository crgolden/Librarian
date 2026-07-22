import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PageTocComponent } from '../app/shared/toc/page-toc.component';

@Component({
  selector: 'app-privacy',
  imports: [RouterLink, PageTocComponent],
  templateUrl: './privacy.component.html',
  styleUrl: './privacy.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PrivacyComponent {}
