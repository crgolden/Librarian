import {
  ChangeDetectionStrategy,
  Component,
  Input,
  PLATFORM_ID,
  afterNextRender,
  inject,
  signal,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

export interface TocItem {
  id: string;
  label: string;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

@Component({
  selector: 'app-page-toc',
  templateUrl: './page-toc.component.html',
  styleUrl: './page-toc.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PageTocComponent {
  @Input({ required: true }) headingSelector: string | null = null;

  protected readonly items = signal<TocItem[]>([]);

  constructor() {
    if (isPlatformBrowser(inject(PLATFORM_ID))) {
      afterNextRender(() => this.buildToc());
    }
  }

  protected scrollToId(id: string, event: MouseEvent): void {
    event.preventDefault();
    document.getElementById(id)?.scrollIntoView({ block: 'start' });
  }

  private buildToc(): void {
    if (this.headingSelector === null) {
      return;
    }
    const headings = Array.from(document.querySelectorAll<HTMLElement>(this.headingSelector));
    const seen = new Set<string>();
    const items: TocItem[] = headings.map((heading) => {
      const label = heading.textContent?.trim() ?? 'Section';
      const base = heading.id || slugify(label) || 'section';
      let id = base;
      let suffix = 1;
      while (seen.has(id)) {
        id = `${base}-${suffix++}`;
      }
      seen.add(id);
      heading.id = id;
      return { id, label };
    });
    this.items.set(items);
  }
}
