import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { localDateStr, type RegistroHeatCell } from '@vitale/shared';

/**
 * Heatmap anual de um registro (SPEC-registros CAP-7, o pedaço só-web): grade
 * semanas×7 estilo GitHub, segunda-first — a forma que `yearHeatmap()` do
 * núcleo devolve.
 *
 * Diferente do `rt-habit-heatmap` (SVG só-leitura), cada dia ≤ hoje é um
 * `<button>` de verdade: o clique alterna a marca daquele dia, que é a
 * correção do passado com a precisão do mouse. Dias futuros são inertes
 * (nenhum request, nenhum cursor) e as pontas fora do ano não pintam.
 *
 * Componente burro: quem persiste e faz o otimista/revert é a página — aqui
 * só se emite a célula clicada.
 */
@Component({
  selector: 'rt-registro-year-heatmap',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="scroll">
      <div class="grid">
        @for (week of weeks(); track week[0].date) {
          <div class="col">
            @for (c of week; track c.date) {
              @if (!c.inYear) {
                <span class="cell out"></span>
              } @else if (c.date <= today()) {
                <button
                  type="button"
                  class="cell day"
                  [style.background-color]="c.marked ? accent() : 'var(--line)'"
                  [attr.aria-pressed]="c.marked"
                  [attr.aria-label]="'dia ' + c.date + ', ' + (c.marked ? 'marcado' : 'não marcado')"
                  [title]="c.date + (c.marked ? ' · feito' : '')"
                  (click)="toggle.emit(c)"
                ></button>
              } @else {
                <span class="cell future" [title]="c.date"></span>
              }
            }
          </div>
        }
      </div>
    </div>
  `,
  styles: [
    `
    :host { display: block; }
    .scroll { overflow-x: auto; padding-bottom: 4px; }
    .grid { display: flex; gap: 2px; width: max-content; }
    .col { display: flex; flex-direction: column; gap: 2px; }
    .cell { width: 12px; height: 12px; border-radius: 2.5px; border: none; padding: 0; display: block; }
    .cell.day { cursor: pointer; }
    .cell.day:hover { box-shadow: inset 0 0 0 1px var(--ink-4); }
    .cell.day:focus-visible { outline: 2px solid var(--primary); outline-offset: 1px; }
    .cell.out { background: transparent; }
    .cell.future { background: var(--line); opacity: 0.35; }
  `,
  ],
})
export class RegistroYearHeatmapComponent {
  readonly weeks = input.required<RegistroHeatCell[][]>();
  /** Acento do módulo do registro — a célula marcada é objeto gráfico (piso 3,0). */
  readonly accent = input.required<string>();
  /** 'YYYY-MM-DD' local — células acima disso são inertes. */
  readonly today = input<string>(localDateStr());
  readonly toggle = output<RegistroHeatCell>();
}
