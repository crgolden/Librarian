import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PageTocComponent } from '../app/shared/toc/page-toc.component';

@Component({
  selector: 'app-faq',
  imports: [RouterLink, PageTocComponent],
  templateUrl: './faq.component.html',
  styleUrl: './faq.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FaqComponent {}
