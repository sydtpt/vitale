import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import {
  SLEEP_AXIS_ORIGIN_H,
  axisRange,
  toTimingBar,
  type SleepPeriod,
  type TimingBar,
} from '@vitale/shared';

interface ColVM {
  day: string;
  label: string;
  x: number;
  bar: TimingBar | null;
  yOnset: number;
  yWake: number;
  bed: { y: number; h: number } | null;
  holes: { y: number; h: number }[];
}
interface GridVM { y: number; label: string; }

const W = 640;
const H = 240;
const PAD_TOP = 8;
const PAD_BOTTOM = 18;
const PAD_LEFT = 34;

/**
 * O sleep timing chart, na web: a mesma peça do mobile, desenhada pelo mesmo
 * núcleo (`toTimingBar`/`axisRange`). Cada noite é uma barra na HORA DO DIA —
 * apagar em cima, acordar embaixo —, os despertares furam a barra, a janela na
 * cama é o contorno tracejado, e noite sem dado é célula vazia, não zero.
 *
 * Nenhum número, nenhum seletor: a regularidade aparece porque barras alinhadas
 * parecem alinhadas (spec §2). Nenhuma cor cravada — tudo em variáveis do tema.
 */
@Component({
  selector: 'rt-sleep-timing-chart',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg [attr.viewBox]="'0 0 ' + w + ' ' + h" class="chart" role="img"
      aria-label="Noites na hora do dia: apagar em cima, acordar embaixo; buracos são despertares">
      @for (g of grid(); track g.label) {
        <line class="grid-line" [attr.x1]="padL" [attr.x2]="w" [attr.y1]="g.y" [attr.y2]="g.y" />
        <text class="axis mono" [attr.x]="0" [attr.y]="g.y + 3">{{ g.label }}</text>
      }
      @for (c of cols(); track c.day) {
        @if (c.bar) {
          @if (c.bed) {
            <rect class="bed" [attr.x]="c.x - 2" [attr.y]="c.bed.y" [attr.width]="barW + 4" [attr.height]="c.bed.h" rx="4" />
          }
          <rect class="sleep" [attr.x]="c.x" [attr.y]="c.yOnset" [attr.width]="barW" [attr.height]="c.yWake - c.yOnset" rx="3">
            <title>{{ c.day }}</title>
          </rect>
          @for (hole of c.holes; track $index) {
            <rect class="hole" [attr.x]="c.x" [attr.y]="hole.y" [attr.width]="barW" [attr.height]="hole.h" />
          }
          <text class="xlab mono" [attr.x]="c.x + barW / 2" [attr.y]="h - 4" text-anchor="middle">{{ c.label }}</text>
        } @else {
          <rect class="empty" [attr.x]="c.x" [attr.y]="emptyY" [attr.width]="barW" [attr.height]="emptyH" rx="3" />
          <text class="xlab mono faint" [attr.x]="c.x + barW / 2" [attr.y]="h - 4" text-anchor="middle">{{ c.label }}</text>
        }
      }
    </svg>
  `,
  styles: [`
    :host { display: block; }
    .chart { width: 100%; height: auto; display: block; }
    .grid-line { stroke: var(--line); stroke-width: 1; }
    .axis { font-size: 9.5px; fill: var(--ink-4); }
    .xlab { font-size: 9.5px; fill: var(--ink-3); }
    .xlab.faint { fill: var(--ink-4); }
    /* A gramática de cor do sono (shared sleep/colors.ts): azul é sono, o vão é o despertar. */
    .sleep { fill: var(--sleep-sleep); }
    .hole { fill: var(--surface); }
    .bed { fill: none; stroke: var(--sleep-sleep); stroke-width: 1; stroke-dasharray: 3 2; opacity: .55; }
    .empty { fill: none; stroke: var(--line); stroke-width: 1; stroke-dasharray: 3 3; }
  `],
})
export class SleepTimingChartComponent {
  /** Dias de acordar a desenhar, em ordem, incluindo os sem noite. */
  readonly days = input.required<string[]>();
  readonly periods = input.required<SleepPeriod[]>();

  protected readonly w = W;
  protected readonly h = H;
  protected readonly padL = PAD_LEFT;

  private readonly bars = computed(() => {
    const m = new Map<string, TimingBar>();
    for (const p of this.periods()) m.set(p.wakeDay, toTimingBar(p));
    return m;
  });
  private readonly range = computed(() => axisRange([...this.bars().values()]));
  private readonly innerH = H - PAD_TOP - PAD_BOTTOM;
  private y(pos: number): number {
    const r = this.range();
    return PAD_TOP + ((pos - r.from) / Math.max(r.to - r.from, 1)) * this.innerH;
  }

  protected readonly slot = computed(() => (W - PAD_LEFT) / Math.max(this.days().length, 1));
  protected readonly barW = 18;
  protected readonly emptyY = PAD_TOP + this.innerH * 0.25;
  protected readonly emptyH = this.innerH * 0.5;

  protected readonly grid = computed<GridVM[]>(() => {
    const r = this.range();
    const out: GridVM[] = [];
    for (let hh = Math.ceil(r.from / 2) * 2; hh <= r.to; hh += 2) {
      out.push({ y: this.y(hh), label: `${String((SLEEP_AXIS_ORIGIN_H + hh) % 24).padStart(2, '0')}h` });
    }
    return out;
  });

  protected readonly cols = computed<ColVM[]>(() => {
    const slot = this.slot();
    return this.days().map((day, i) => {
      const x = PAD_LEFT + i * slot + (slot - this.barW) / 2;
      const bar = this.bars().get(day) ?? null;
      const label = day.slice(8);
      if (!bar || !bar.fitsAxis) {
        return { day, label, x, bar: null, yOnset: 0, yWake: 0, bed: null, holes: [] };
      }
      return {
        day, label, x, bar,
        yOnset: this.y(bar.onset),
        yWake: Math.max(this.y(bar.wake), this.y(bar.onset) + 2),
        bed: bar.bed ? { y: this.y(bar.bed.from), h: Math.max(1, this.y(bar.bed.to) - this.y(bar.bed.from)) } : null,
        holes: (bar.holes ?? []).map((hl) => ({ y: this.y(hl.from), h: Math.max(1.5, this.y(hl.to) - this.y(hl.from)) })),
      };
    });
  });
}
