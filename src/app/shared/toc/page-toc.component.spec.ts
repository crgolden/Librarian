import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { PageTocComponent } from './page-toc.component';

@Component({
  selector: 'app-toc-host',
  imports: [PageTocComponent],
  template: `
    <h1 id="top">Page title</h1>
    <div class="items">
      <h3 class="item-heading">First question?</h3>
      <h3 class="item-heading">Second question?</h3>
      <h3 class="item-heading">First question?</h3>
    </div>
    <app-page-toc headingSelector=".item-heading" />
  `,
})
class HostComponent {}

describe('PageTocComponent', () => {
  it('builds a TOC entry per matched heading, de-duplicating ids for repeated text, and renders a back-to-top link', async () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const compiled: HTMLElement = fixture.nativeElement;
    const tocLinks = compiled.querySelectorAll('.page-toc a');
    expect(tocLinks).toHaveLength(3);

    const headings = compiled.querySelectorAll('.item-heading');
    const ids = Array.from(headings).map((h) => h.id);
    expect(new Set(ids).size).toBe(3); // all unique despite duplicate text
    expect(ids[0]).not.toBe(ids[2]);

    expect(compiled.querySelector('.back-to-top')?.getAttribute('href')).toBe('#top');
  });

  it('renders no TOC nav when the selector matches nothing, but still renders back-to-top', async () => {
    TestBed.overrideComponent(HostComponent, {
      set: {
        template: `<app-page-toc headingSelector=".nonexistent" />`,
      },
    });
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const compiled: HTMLElement = fixture.nativeElement;
    expect(compiled.querySelector('.page-toc')).toBeNull();
    expect(compiled.querySelector('.back-to-top')).not.toBeNull();
  });
});
