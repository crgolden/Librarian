import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-faq',
  imports: [RouterLink],
  templateUrl: './faq.component.html',
  styleUrl: './faq.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FaqComponent {}
