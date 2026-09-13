import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'app-page-size',
  templateUrl: './page-size.component.html',
  styleUrl: './page-size.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex items-center shrink-0' },
})
export class PageSizeComponent {
  @Input({ required: true }) controlId: string | null = null;
  @Input({ required: true }) choices: readonly number[] = [];
  @Input({ required: true }) value = 0;
  @Output() readonly valueChange = new EventEmitter<number>();

  protected choose(event: Event): void {
    const target = event.target as HTMLSelectElement;
    this.valueChange.emit(Number(target.value));
  }
}
