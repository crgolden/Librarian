import { ChangeDetectionStrategy, Component, HostBinding, Input } from '@angular/core';

@Component({
  selector: 'app-avatar',
  templateUrl: './avatar.component.html',
  styleUrl: './avatar.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AvatarComponent {
  @Input({ required: true }) sub!: string;
  @Input() alt = '';
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

  protected get src(): string {
    return this.resolvedSrc ?? `/bff/avatar/${encodeURIComponent(this.sub)}`;
  }
}
