import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/** Um ponto da série; `value: null` é buraco — não se liga por cima dele. */
export interface TrendPoint {
  key: string;
  label: string;
  value: number | null;
  /** Posição numérica no eixo x (só com `logX`). Precisa ser > 0. */
  x?: number;
  /** Tooltip nativo do ponto. */
  title?: string;
}

interface DotVM { key: string; x: number; y: number; last: boolean; title: string; }
interface GridVM { v: number; y: number; label: string; }

/**
 * Linha com pontos, para séries em que **o buraco é buraco**.
 *
 * O eixo não começa em zero, de propósito: numa série de "melhor tempo do mês",
 * a diferença entre 4:20 e 4:30 por quilômetro é a informação, e a partir de
 * zero ela teria quatro pixels. Barra pede zero; ponto não. Uma referência
 * (o recorde) entra na escala e vira o chão pontilhado.
 *
 * Nenhuma cor cravada — grade, eixo e rótulo em variáveis do sistema, como o
 * `rt-volume-chart`.
 */
@Component({
  selector: 'rt-trend-chart',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg [attr.viewBox]="'0 0 ' + w + ' ' + h" class="chart" role="img" [attr.aria-label]="ariaLabel()">
      @for (g of grid(); track g.v) {
        <line class="grid-line" [attr.x1]="padL" [attr.x2]="w - padR" [attr.y1]="g.y" [attr.y2]="g.y" />
        <text class="axis mono" [attr.x]="padL - 6" [attr.y]="g.y + 3" text-anchor="end">{{ g.label }}</text>
      }

      @if (referenceY(); as ry) {
        <line class="ref-line" [attr.x1]="padL" [attr.x2]="w - padR" [attr.y1]="ry" [attr.y2]="ry" />
        <text class="ref-label mono" [attr.x]="w - padR" [attr.y]="ry - 4" text-anchor="end">{{ referenceLabel() }}</text>
      }

      <path [attr.d]="path()" [attr.stroke]="color()" stroke-width="2" fill="none"
        stroke-linejoin="round" stroke-linecap="round" />

      @for (d of dots(); track d.key) {
        <circle [attr.cx]="d.x" [attr.cy]="d.y" [attr.r]="d.last ? 4 : 2.6" [attr.fill]="color()"
          [attr.stroke]="d.last ? 'var(--surface)' : 'none'" stroke-width="2">
          @if (d.title) { <title>{{ d.title }}</title> }
        </circle>
      }

      @for (t of xTicks(); track t.key) {
        <text class="axis" [attr.x]="t.x" [attr.y]="h - 8" text-anchor="middle">{{ t.label }}</text>
      }

      @if (isEmpty()) {
        <text class="axis" [attr.x]="w / 2" [attr.y]="h / 2" text-anchor="middle">{{ emptyLabel() }}</text>
      }
    </svg>
  `,
  styles: [`
    .chart { width: 100%; height: 180px; display: block; }
    .grid-line { stroke: var(--line); stroke-dasharray: 3 3; }
    .axis { font-size: 10px; fill: var(--ink-4); }
    .ref-line { stroke: var(--ink-3); stroke-dasharray: 1 3; }
    .ref-label { font-size: 9px; fill: var(--ink-3); }
  `],
})
export class TrendChartComponent {
  readonly points = input.required<TrendPoint[]>();
  /**
   * Eixo x logarítmico pelo `x` de cada ponto, em vez de uma coluna por índice.
   * É o que faz 1 km e 42 km caberem no mesmo eixo sem esmagar o 5 e o 10.
   */
  readonly logX = input(false);
  readonly color = input('var(--primary)');
  /** Entra na escala; `null` esconde a linha. */
  readonly reference = input<number | null>(null);
  readonly referenceLabel = input('');
  /** Como escrever um valor do eixo ("4:30", "72 bpm"). */
  readonly formatValue = input<(v: number) => string>((v) => String(Math.round(v)));
  readonly emptyLabel = input('Sem dados');
  readonly ariaLabel = input('Tendência');

  protected readonly w = 360;
  protected readonly h = 180;
  protected readonly padL = 44;
  protected readonly padR = 12;
  protected readonly padT = 14;
  protected readonly padB = 24;

  private readonly filled = computed(() =>
    this.points().map((p, i) => ({ ...p, i })).filter((p): p is TrendPoint & { i: number; value: number } => p.value !== null),
  );

  protected readonly isEmpty = computed(() => this.filled().length === 0);

  /** Domínio = pontos ∪ referência, com 6% de folga para o ponto não encostar na borda. */
  private readonly domain = computed(() => {
    const vals = this.filled().map((p) => p.value);
    const ref = this.reference();
    if (ref !== null) vals.push(ref);
    if (vals.length === 0) return { lo: 0, hi: 1 };
    const lo = Math.min(...vals);
    const hi = Math.max(...vals);
    const pad = (hi - lo || 1) * 0.06;
    return { lo: lo - pad, hi: hi + pad };
  });

  private xAt(i: number): number {
    const ps = this.points();
    const plotW = this.w - this.padL - this.padR;
    if (this.logX()) {
      const xs = ps.map((p) => Math.log(p.x ?? 1));
      const lo = Math.min(...xs);
      const hi = Math.max(...xs);
      return hi > lo ? this.padL + ((xs[i] - lo) / (hi - lo)) * plotW : this.padL + plotW / 2;
    }
    return ps.length > 1 ? this.padL + (i / (ps.length - 1)) * plotW : this.padL + plotW / 2;
  }

  private yAt(v: number): number {
    const { lo, hi } = this.domain();
    return this.padT + (1 - (v - lo) / (hi - lo)) * (this.h - this.padT - this.padB);
  }

  protected readonly dots = computed<DotVM[]>(() => {
    const f = this.filled();
    return f.map((p, k) => ({ key: p.key, x: this.xAt(p.i), y: this.yAt(p.value), last: k === f.length - 1, title: p.title ?? '' }));
  });

  /** Um salto de índice > 1 recomeça o traço: o buraco não vira ponte. */
  protected readonly path = computed(() => {
    const f = this.filled();
    return f
      .map((p, k) => `${k === 0 || p.i - f[k - 1].i > 1 ? 'M' : 'L'}${this.xAt(p.i).toFixed(1)},${this.yAt(p.value).toFixed(1)}`)
      .join(' ');
  });

  protected readonly referenceY = computed(() => {
    const r = this.reference();
    return r === null || this.isEmpty() ? null : this.yAt(r);
  });

  protected readonly grid = computed<GridVM[]>(() => {
    const { lo, hi } = this.domain();
    const fmt = this.formatValue();
    return [0, 0.5, 1].map((f) => {
      const v = lo + (hi - lo) * f;
      return { v, y: this.yAt(v), label: fmt(v) };
    });
  });

  protected readonly xTicks = computed(() => {
    const ps = this.points();
    const step = ps.length > 6 ? Math.ceil(ps.length / 6) : 1;
    return ps
      .map((p, i) => ({ key: p.key, label: p.label, x: this.xAt(i), show: i % step === 0 || i === ps.length - 1 }))
      .filter((t) => t.show);
  });
}
