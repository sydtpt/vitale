import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import {
  DIAS_ABREV_SEG,
  MESES_ABREV,
  localDateStr,
  yearHeatmapMonthStarts,
  type RegistroHeatCell,
} from '@vitale/shared';

/** Passo de uma coluna: célula + vão. Compartilhado entre grade e rótulos de mês. */
const CELL = 12;
const GAP = 2;
const PITCH = CELL + GAP;

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
 * Os rótulos de mês (na coluna onde o dia 1º cai), os de dia da semana
 * (seg/qua/sex, linhas alternadas) e a legenda existem para achar "aquele dia
 * de março" sem varrer tooltips célula a célula.
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
      <div class="wrap">
        <div class="months" aria-hidden="true">
          @for (m of monthStarts(); track m.month) {
            <span class="month" [style.left.px]="m.week * PITCH">{{ MESES[m.month] }}</span>
          }
        </div>
        <div class="body">
          <div class="dows" aria-hidden="true">
            @for (d of DOWS; track $index) {
              <span class="dow">{{ $index % 2 === 0 ? d : '' }}</span>
            }
          </div>
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
        <div class="legend">
          <span class="swatch" [style.background-color]="accent()"></span> marcado
          <span class="swatch empty"></span> vazio
        </div>
      </div>
    </div>
  `,
  styles: [
    `
    :host { display: block; }
    .scroll { overflow-x: auto; padding-bottom: 4px; }
    .wrap { width: max-content; }
    .body { display: flex; gap: 6px; }
    .grid { display: flex; gap: 2px; }
    .col { display: flex; flex-direction: column; gap: 2px; }
    .cell { width: 12px; height: 12px; border-radius: 2.5px; border: none; padding: 0; display: block; }
    .cell.day { cursor: pointer; }
    .cell.day:hover { box-shadow: inset 0 0 0 1px var(--ink-4); }
    .cell.day:focus-visible { outline: 2px solid var(--primary); outline-offset: 1px; }
    .cell.out { background: transparent; }
    .cell.future { background: var(--line); opacity: 0.35; }

    /* Rótulos alinham pelo mesmo passo (célula + vão) da grade. */
    .months { position: relative; height: 16px; margin-left: 32px; }
    .month { position: absolute; top: 0; font-size: 10.5px; color: var(--ink-3); }
    .dows { display: flex; flex-direction: column; gap: 2px; width: 26px; }
    .dow { height: 12px; line-height: 12px; font-size: 9.5px; color: var(--ink-3); text-align: right; }

    .legend { display: flex; align-items: center; gap: 6px; margin-top: 8px; margin-left: 32px; font-size: 11px; color: var(--ink-3); }
    .legend .swatch { width: 10px; height: 10px; border-radius: 2.5px; display: inline-block; }
    .legend .swatch.empty { background: var(--line); margin-left: 10px; }
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

  protected readonly monthStarts = computed(() => yearHeatmapMonthStarts(this.weeks()));
  protected readonly MESES = MESES_ABREV;
  protected readonly DOWS = DIAS_ABREV_SEG;
  protected readonly PITCH = PITCH;
}
