import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

export interface SegOption {
  value: string;
  label: string;
}

/**
 * Seletor segmentado das subviews de sono — o mesmo visual do seletor de
 * período do Histórico, com as opções vindas de fora. `small` é a versão
 * compacta do sub-seletor "na hora · total".
 */
@Component({
  selector: 'rt-sono-segmented',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="seg" [class.small]="small()" [class.full]="full()">
      @for (o of options(); track o.value) {
        <button type="button" class="opt" [class.active]="o.value === value()" (click)="select.emit(o.value)">{{ o.label }}</button>
      }
    </div>
  `,
  styles: [`
    :host { display: inline-block; }
    :host(.block) { display: block; }
    .seg { display: inline-flex; gap: 2px; padding: 3px; background: var(--surface-mute); border-radius: 11px; border: 1px solid var(--line); }
    .seg.full { display: flex; }
    .seg.full .opt { flex: 1; }
    .opt { border: none; background: transparent; color: var(--ink-2); font-size: 12.5px; font-weight: 600; padding: 5px 14px; border-radius: 8px; cursor: pointer; transition: background .12s, color .12s; }
    .opt:hover { color: var(--ink); }
    .opt:focus-visible { outline: 2px solid var(--primary); outline-offset: -2px; }
    .opt.active { background: var(--surface); color: var(--ink); box-shadow: var(--shadow-sm); }
    .seg.small .opt { font-size: 11.5px; padding: 4px 11px; }
  `],
})
export class SonoSegmentedComponent {
  readonly options = input.required<SegOption[]>();
  readonly value = input.required<string>();
  readonly small = input(false);
  readonly full = input(false);
  readonly select = output<string>();
}
