import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  phosphorBookmarkSimple,
  phosphorCalendarDots,
  phosphorDownloadSimple,
  phosphorStack,
} from '@ng-icons/phosphor-icons/regular';
import { AuthService } from '../auth/auth.service';
import { HomeSummary } from './home.resolver';

@Component({
  selector: 'app-home',
  imports: [RouterLink, NgIcon],
  templateUrl: './home.component.html',
  styleUrl: './home.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  viewProviders: [
    provideIcons({
      phosphorBookmarkSimple,
      phosphorCalendarDots,
      phosphorDownloadSimple,
      phosphorStack,
    }),
  ],
})
export class HomeComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  protected readonly auth = inject(AuthService);
  protected readonly summary = signal<HomeSummary | null>(null);

  ngOnInit(): void {
    this.summary.set(this.route.snapshot.data['summary'] as HomeSummary | null);
  }
}
