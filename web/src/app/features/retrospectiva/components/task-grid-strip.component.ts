/**
 * Faixa de adesão das séries diárias — par web do `mobile/src/components/TaskGridStrip.tsx`.
 *
 * Mesma derivação (`buildTaskGrid` no shared), mesma leitura fixa por clique, mesma
 * linguagem visual. **Não é o `rt-heatmap-grid`**: aquele é uma métrica contínua
 * contra uma meta, em calendário de 7 colunas; aqui o dado é binário e são várias
 * séries empilhadas no mesmo eixo de dias, para comparar quem está falhando.
 *
 * O dimensionamento é `flex: 1` em vez de medido: as linhas têm o mesmo número de
 * células e as mesmas quebras de semana, então o flexbox as mantém alinhadas
 * sozinho — o `onLayout` do mobile existe porque o Yoga não resolve isso.
 */
import { ChangeDetectionStrategy, Component, input, signal } from '@angular/core';
import type { TaskGrid, TaskGridRow, TaskDayCell } from '@vitale/shared';

const DOW_FULL = ['segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado', 'domingo'];
const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

interface Sel { row: TaskGridRow; cell: TaskDayCell; }

@Component({
  selector: 'rt-task-grid-strip',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @for (row of data().rows; track row.id) {
      <div class="row">
        <div class="head">
          <span class="name">{{ row.name }}</span>
          <span class="count">{{ row.done }}<small> de {{ row.possible }}</small></span>
        </div>
        <div class="strip">
          @for (c of row.cells; track c.day) {
            <button
              type="button"
              class="cell"
              [attr.data-done]="c.done === true ? '' : null"
              [attr.data-missed]="c.done === false ? '' : null"
              [attr.data-week]="c.weekday === 0 && c.day !== row.cells[0].day ? '' : null"
              [attr.data-sel]="isSel(row, c) ? '' : null"
              [attr.aria-label]="label(row, c)"
              (click)="pick(row, c)"
            ></button>
          }
        </div>
      </div>
    }

    <div class="readout">
      <span class="k">
        @if (sel(); as s) { {{ s.row.name }} · {{ dataCurta(s.cell.day) }}, {{ dowFull[s.cell.weekday] }} }
        @else { clique num dia · {{ data().done }} de {{ data().possible }} no total }
      </span>
      @if (sel(); as s) { <span class="v">{{ estado(s.cell) }}</span> }
    </div>

    <div class="legend">
      <i class="sw done"></i><span>feito</span>
      <i class="sw missed"></i><span>esqueci</span>
      <i class="sw"></i><span>fora da janela</span>
    </div>
  `,
  styleUrl: './task-grid-strip.component.scss',
})
export class TaskGridStripComponent {
  readonly data = input.required<TaskGrid>();

  protected readonly dowFull = DOW_FULL;
  protected readonly sel = signal<Sel | null>(null);

  protected isSel(row: TaskGridRow, c: TaskDayCell): boolean {
    const s = this.sel();
    return s?.row.id === row.id && s.cell.day === c.day;
  }

  protected pick(row: TaskGridRow, c: TaskDayCell): void {
    this.sel.update((cur) => (cur?.row.id === row.id && cur.cell.day === c.day ? null : { row, cell: c }));
  }

  protected estado(c: TaskDayCell): string {
    return c.done === true ? 'feito' : c.done === false ? 'esqueci' : '—';
  }

  protected dataCurta(day: string): string {
    return `${Number(day.slice(8))} ${MESES[Number(day.slice(5, 7)) - 1]}`;
  }

  protected label(row: TaskGridRow, c: TaskDayCell): string {
    return `${row.name}, ${this.dataCurta(c.day)}, ${this.estado(c)}`;
  }
}
