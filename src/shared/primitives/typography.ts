import { Directive } from '@angular/core';

@Directive({
  selector: '[appCatalogMeta]',
  host: { class: 'font-mono text-meta text-text-muted' },
})
export class CatalogMetaDirective {}

@Directive({
  selector: '[appCatalogTitle]',
  host: { class: 'font-heading font-semibold italic' },
})
export class CatalogTitleDirective {}

@Directive({
  selector: '[appSpineLabel]',
  host: { class: 'inline-block border-b-2 border-line pb-[0.15rem] font-body text-label font-semibold tracking-label text-text-muted uppercase' },
})
export class SpineLabelDirective {}

@Directive({
  selector: '[appStampLabel]',
  host: { class: 'font-mono text-small font-normal tracking-label text-text-muted uppercase' },
})
export class StampLabelDirective {}
