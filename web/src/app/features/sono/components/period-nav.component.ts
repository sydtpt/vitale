import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { SONO_RANGES, hasNights, rangeLabel, type SleepPeriod, type SonoRange } from '@vitale/shared';
import { SonoSegmentedComponent, type SegOption } from './sono-segmented.component';

/**
 * O seletor de período das subviews de sono, como no mobile: o segmentado mais a
 * navegação ◀ ▶ — um período do próprio tamanho para trás ou para a frente, e o
 * ◀ só acende onde há noite. Trocar o período volta ao corrente.
 */
@Component({
  selector: 'rt-sono-period-nav',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SonoSegmentedComponent],
  template: `
    <rt-sono-segmented [options]="options" [value]="range()" [full]="true" (select)="pick($event)" />
    <div class="nav">
      <button type="button" class="chev" [disabled]="!canBack()" (click)="offsetChange.emit(offset() + 1)" aria-label="período anterior">‹</button>
      <span class="label mono">{{ label() }}</span>
      <button type="button" class="chev" [disabled]="!canFwd()" (click)="offsetChange.emit(offset() - 1)" aria-label="período seguinte">›</button>
    </div>
  `,
  styles: [`
    :host { display: block; }
    rt-sono-segmented { display: block; }
    .nav { display: flex; align-items: center; justify-content: space-between; margin-top: 8px; }
    .chev { width: 34px; height: 30px; border: 0; background: transparent; color: var(--ink); font-size: 20px; line-height: 1; cursor: pointer; border-radius: 8px; }
    .chev:hover:not(:disabled) { background: var(--surface-mute); }
    .chev:disabled { color: var(--ink-4); cursor: default; }
    .chev:focus-visible { outline: 2px solid var(--primary); outline-offset: -2px; }
    .label { font-size: 12.5px; color: var(--ink-2); }
  `],
})
export class SonoPeriodNavComponent {
  readonly range = input.required<SonoRange>();
  readonly offset = input.required<number>();
  /** Todas as noites conhecidas — é o que decide se o ◀ acende. */
  readonly periods = input.required<SleepPeriod[]>();
  /** As noites da janela corrente, para o rótulo de "última". */
  readonly nights = input.required<SleepPeriod[]>();
  readonly rangeChange = output<SonoRange>();
  readonly offsetChange = output<number>();

  protected readonly options: SegOption[] = SONO_RANGES.map((r) => ({ value: r.id, label: r.label }));
  protected readonly canBack = computed(() => hasNights(this.periods(), this.range(), new Date(), this.offset() + 1));
  protected readonly canFwd = computed(() => this.offset() > 0);
  protected readonly label = computed(() => rangeLabel(this.range(), this.nights(), new Date(), this.offset()));

  protected pick(v: string): void {
    this.rangeChange.emit(v as SonoRange);
  }
}
