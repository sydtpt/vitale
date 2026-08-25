/**
 * Grade divergente de N células — uma por dia do período exibido.
 *
 * Par web do `mobile/src/components/HeatmapGrid.tsx`: mesma derivação (`buildHeatmap`
 * no shared), mesma escala, mesmo comportamento de seleção. **Genérico em N** — o
 * número de células vem do período, não de um "mês" codificado (v2-jornal.md §4).
 *
 * A seleção é por clique e a leitura é **fixa** abaixo da grade, igual ao mobile:
 * o valor não pode depender de o ponteiro estar em cima.
 */
import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import type { Heatmap, HeatCell, HeatStep } from '@vitale/shared';

const DOW = ['SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB', 'DOM'];
const DOW_FULL = ['segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado', 'domingo'];
const STEPS: HeatStep[] = [-3, -2, -1, 0, 1, 2];

@Component({
  selector: 'rt-heatmap-grid',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="hm-head" aria-hidden="true">
      @for (d of dow; track d) { <span>{{ d }}</span> }
    </div>

    <div class="hm">
      @for (p of pads(); track $index) { <span class="cell pad" aria-hidden="true"></span> }
      @for (c of data().cells; track c.day) {
        <button
          type="button"
          class="cell"
          [attr.data-step]="c.step"
          [attr.data-empty]="c.value === null ? '' : null"
          [attr.data-sel]="sel()?.day === c.day ? '' : null"
          [disabled]="c.value === null"
          [attr.aria-label]="label(c)"
          (click)="pick(c)"
        >{{ dayNum(c) }}</button>
      }
    </div>

    <div class="readout">
      <span class="k">
        @if (sel(); as s) { {{ dayNum(s) }} · {{ dowFull[s.weekday] }} }
        @else { toque num dia · {{ data().measured }} de {{ data().cells.length }} medidos }
      </span>
      @if (selValue(); as v) {
        <span class="v">{{ v }}<small>{{ selDelta() }}</small></span>
      }
    </div>

    <div class="scale">
      <span>pior</span>
      <span class="sw">@for (s of steps; track s) { <i [attr.data-step]="s"></i> }</span>
      <span>melhor</span>
      <span class="target">meta {{ fmt(data().target) }}</span>
    </div>
  `,
  styleUrl: './heatmap-grid.component.scss',
})
export class HeatmapGridComponent {
  readonly data = input.required<Heatmap>();

  protected readonly dow = DOW;
  protected readonly dowFull = DOW_FULL;
  protected readonly steps = STEPS;

  protected readonly sel = signal<HeatCell | null>(null);
  protected readonly pads = computed(() => Array.from({ length: this.data().pad }));

  protected readonly selValue = computed(() => {
    const s = this.sel();
    return s?.value == null ? null : this.fmt(s.value);
  });

  protected readonly selDelta = computed(() => {
    const s = this.sel();
    if (s?.value == null) return '';
    const d = s.value - this.data().target;
    return `  ${d >= 0 ? '+' : '−'}${this.fmt(Math.abs(d))} vs. meta`;
  });

  protected pick(c: HeatCell): void {
    this.sel.update((cur) => (cur?.day === c.day ? null : c));
  }

  protected dayNum(c: HeatCell): number {
    return Number(c.day.slice(8));
  }

  protected label(c: HeatCell): string {
    const dia = `${this.dayNum(c)}, ${DOW_FULL[c.weekday]}`;
    return c.value == null ? `${dia}, sem dado` : `${dia}, ${this.fmt(c.value)}`;
  }

  protected fmt(v: number): string {
    const d = this.data();
    return `${v.toFixed(d.decimals).replace('.', ',')}${d.unit}`;
  }
}
