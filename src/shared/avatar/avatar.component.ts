import { ChangeDetectionStrategy, Component, HostBinding, Input } from '@angular/core';

@Component({
  selector: 'app-avatar',
  templateUrl: './avatar.component.html',
  styleUrl: './avatar.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AvatarComponent {
  @Input({ required: true }) sub: string | null = null;
  @Input() alt: string | null = null;
  @Input() size = 28;

  @HostBinding('style.width.px') get hostWidth(): number {
    return this.size;
  }

  @HostBinding('style.height.px') get hostHeight(): number {
    return this.size;
  }

  @Input() set pictureUrl(value: string | null) {
    this.resolvedSrc = value;
  }

  protected resolvedSrc: string | null = null;

  protected get src(): string | null {
    if (this.resolvedSrc !== null) {
      return this.resolvedSrc;
    }
    if (this.sub === null) {
      return null;
    }
    return `/bff/avatar/${encodeURIComponent(this.sub)}`;
  }
}
