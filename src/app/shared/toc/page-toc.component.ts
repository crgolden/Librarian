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

/** Client-side-only in-page table of contents + back-to-top link, generated from the headings
 * matched by `headingSelector` — no manual duplication of heading text needed. Used on the long,
 * static /faq and /privacy pages where there's otherwise no way to jump around or get back up. */
@Component({
  selector: 'app-page-toc',
  templateUrl: './page-toc.component.html',
  styleUrl: './page-toc.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PageTocComponent {
  @Input({ required: true }) headingSelector = '';

  protected readonly items = signal<TocItem[]>([]);

  constructor() {
    if (isPlatformBrowser(inject(PLATFORM_ID))) {
      afterNextRender(() => this.buildToc());
    }
  }

  /** Angular apps always render `<base href="/">`, and per the URL spec a `<base>` tag changes
   * the resolution baseline for EVERY relative URL on the page — including fragment-only ones. A
   * plain `href="#id"` anchor therefore silently navigates to `/#id` instead of staying on the
   * current page (e.g. `/faq#id`). Scrolling manually on click sidesteps that entirely. */
  protected scrollToId(id: string, event: MouseEvent): void {
    event.preventDefault();
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  private buildToc(): void {
    const headings = Array.from(document.querySelectorAll<HTMLElement>(this.headingSelector));
    const seen = new Set<string>();
    const items: TocItem[] = headings.map((heading) => {
      const label = heading.textContent?.trim() ?? '';
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
