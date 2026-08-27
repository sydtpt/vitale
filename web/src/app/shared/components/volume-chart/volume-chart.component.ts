import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import type { VolumeWeekBucket } from '@vitale/shared';

interface BarVM {
  key: string;
  label: string;
  value: number;
  x: number;
  y: number;
  w: number;
  h: number;
  cx: number;
  last: boolean;
  showLabel: boolean;
  showValue: boolean;
}
interface GridVM { v: number; y: number; }

/**
 * Barras de volume semanal — o desenho, e só ele.
 *
 * Recebe os buckets prontos em vez de ler uma store: são duas telas com donos de
 * dado diferentes (a de Treinos agrupa por `activityId`, a do tipo no Histórico
 * por rótulo) mostrando o mesmo desenho. Com a store dentro, cada uma precisaria
 * do seu gráfico, que é como as duas cópias do `StackedBarChart` nasceram.
 *
 * **Nenhuma cor cravada.** A versão anterior desenhava grade, eixo e valor em
 * hex do tema Orbe claro: no escuro, o gráfico virava texto escuro sobre fundo
 * escuro. Aqui tudo vem de variável do sistema, então ele acompanha os quatro
 * eixos de tema.
 */
@Component({
  selector: 'rt-volume-chart',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg [attr.viewBox]="'0 0 ' + w + ' ' + h" class="chart" role="img"
      [attr.aria-label]="ariaLabel()">
      @for (g of grid(); track g.v) {
        <g>
          <line class="grid-line" [attr.x1]="padL" [attr.x2]="w - padR"
            [attr.y1]="g.y" [attr.y2]="g.y" />
          <text class="axis mono" [attr.x]="padL - 6" [attr.y]="g.y + 3" text-anchor="end">
            {{ g.v }}{{ unit() }}
          </text>
        </g>
      }

      @for (b of bars(); track b.key) {
        <g>
          <rect [attr.x]="b.x" [attr.y]="b.y" [attr.width]="b.w" [attr.height]="b.h" rx="4"
            [attr.fill]="color()" [attr.fill-opacity]="b.last ? 1 : 0.4" />
          @if (b.showLabel) {
            <text class="axis" [attr.x]="b.cx" [attr.y]="h - 10" text-anchor="middle">{{ b.label }}</text>
          }
          @if (b.showValue) {
            <text class="value mono" [attr.x]="b.cx" [attr.y]="b.y - 4" text-anchor="middle">{{ b.value }}</text>
          }
        </g>
      }

      @if (referenceY(); as ry) {
        <g>
          <line class="ref-line" [attr.x1]="padL" [attr.x2]="w - padR" [attr.y1]="ry" [attr.y2]="ry" />
          <text class="ref-label" [attr.x]="w - padR" [attr.y]="ry - 4" text-anchor="end">
            {{ referenceLabel() }}
          </text>
        </g>
      }

      @if (isEmpty()) {
        <text class="axis" [attr.x]="w / 2" [attr.y]="h / 2" text-anchor="middle">{{ emptyLabel() }}</text>
      }
    </svg>
  `,
  styles: [`
    .chart { width: 100%; height: 200px; display: block; }
    .grid-line { stroke: var(--line); stroke-dasharray: 3 3; }
    .axis { font-size: 10px; fill: var(--ink-4); }
    .value { font-size: 10px; font-weight: 600; fill: var(--ink); }
    /* Pontilhada, e não tracejada: no app a tracejada já é a meta da OMS e a
       pontilhada é "você, na média". Trocar aqui confundiria as duas. */
    .ref-line { stroke: var(--ink-3); stroke-dasharray: 1 3; }
    .ref-label { font-size: 9px; fill: var(--ink-3); }
  `],
})
export class VolumeChartComponent {
  readonly buckets = input.required<VolumeWeekBucket[]>();
  readonly unit = input('');
  readonly color = input('var(--primary)');
  /** Linha de referência (média da janela); `null` esconde a linha. */
  readonly reference = input<number | null>(null);
  readonly referenceLabel = input('média');
  readonly emptyLabel = input('Sem dados sincronizados');
  readonly ariaLabel = input('Volume por semana');

  protected readonly w = 360;
  protected readonly h = 200;
  protected readonly padL = 36;
  protected readonly padR = 12;
  protected readonly padT = 14;
  protected readonly padB = 26;

  /** Pelo menos 1 para não dividir por zero na janela vazia. */
  private readonly max = computed(() =>
    Math.max(1, ...this.buckets().map((b) => b.value), this.reference() ?? 0),
  );

  protected readonly isEmpty = computed(() => this.buckets().every((b) => b.value === 0));

  protected readonly grid = computed<GridVM[]>(() => {
    const m = this.max();
    return [
      { v: 0, y: this.yFor(0) },
      { v: Math.round(m / 2), y: this.yFor(m / 2) },
      { v: Math.round(m), y: this.yFor(m) },
    ];
  });

  protected readonly referenceY = computed(() => {
    const r = this.reference();
    return r != null && r > 0 ? this.yFor(r) : null;
  });

  /**
   * Rótulo em toda barra até seis; acima disso, um a cada N — doze "dd/mm" lado
   * a lado viram um borrão. O valor segue a mesma régua e, na janela longa, fica
   * só na maior semana e na atual: número em cima de cada barra é ruído, e as
   * duas que se quer ler são o pico e onde estou agora.
   */
  protected readonly bars = computed<BarVM[]>(() => {
    const bs = this.buckets();
    const dense = bs.length > 6;
    const step = dense ? Math.ceil(bs.length / 6) : 1;
    const maxIdx = bs.reduce((mi, b, i) => (b.value > bs[mi].value ? i : mi), 0);
    const slot = (this.w - this.padL - this.padR) / bs.length;

    return bs.map((b, i) => {
      const width = slot * 0.6;
      const x = this.padL + i * slot + slot * 0.2;
      const height = (b.value / this.max()) * (this.h - this.padT - this.padB);
      const last = i === bs.length - 1;
      return {
        key: b.key,
        label: b.label,
        value: b.value,
        x,
        y: this.h - this.padB - height,
        w: width,
        h: height,
        cx: x + width / 2,
        last,
        showLabel: i % step === 0 || last,
        showValue: b.value > 0 && (!dense || last || i === maxIdx),
      };
    });
  });

  private yFor(v: number): number {
    return this.padT + (1 - v / this.max()) * (this.h - this.padT - this.padB);
  }
}
