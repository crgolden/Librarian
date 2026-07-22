import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';
import { SiteNavComponent } from './nav/site-nav.component';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, SiteNavComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppComponent {}
