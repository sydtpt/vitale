import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { SLEEP_AXIS_ORIGIN_H, type SleepBucket, type SleepMarker } from '@vitale/shared';

interface ColVM {
  key: string;
  x: number;
  bandY: number;
  bandH: number;
  medY: number;
  medH: number;
  awakeH: number;
  label: string | null;
  marker: { x: number; label: string } | null;
}
interface GridVM { y: number; label: string; }

const W = 640;
const H = 250;
const PAD_TOP = 8;
const PAD_BOTTOM = 18;
const PAD_LEFT = 34;
/** Altura máxima do traço amarelo de tempo acordado, no rodapé. */
const AWAKE_MAX_H = 10;

/**
 * Os períodos longos: uma coluna por semana, e a coluna é uma **noite típica** —
 * mediana de apagar e acordar como barra, o miolo p25–p75 como faixa em volta.
 * A dispersão vira largura da faixa: a regularidade continua sendo forma.
 *
 * A faixa é a lavagem do azul, a barra é o sono, o traço no rodapé é a vigília.
 * Onde o período cruza a troca de relógio, a linha tracejada avisa que o amarelo
 * à esquerda e à direita não se compara.
 */
@Component({
  selector: 'rt-sleep-buckets-chart',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg [attr.viewBox]="'0 0 ' + w + ' ' + h" class="chart" role="img" aria-label="Semanas: mediana de apagar e acordar, com a faixa p25–p75">
      @for (g of grid(); track g.label) {
        <line class="grid-line" [attr.x1]="padL" [attr.x2]="w" [attr.y1]="g.y" [attr.y2]="g.y" />
        <text class="axis mono" [attr.x]="0" [attr.y]="g.y + 3">{{ g.label }}</text>
      }
      @for (c of cols(); track c.key) {
        <rect class="band" [attr.x]="c.x" [attr.y]="c.bandY" [attr.width]="bw()" [attr.height]="c.bandH" rx="3" />
        <rect class="median" [attr.x]="c.x + bw() * 0.25" [attr.y]="c.medY" [attr.width]="bw() * 0.5" [attr.height]="c.medH" rx="2" />
        @if (c.awakeH > 0) {
          <rect class="awake" [attr.x]="c.x" [attr.y]="h - padB - c.awakeH" [attr.width]="bw()" [attr.height]="c.awakeH" />
        }
        @if (c.label) {
          <text class="xlab mono" [attr.x]="c.x + bw() / 2" [attr.y]="h - 4" text-anchor="middle">{{ c.label }}</text>
        }
        @if (c.marker) {
          <line class="marker" [attr.x1]="c.marker.x" [attr.x2]="c.marker.x" [attr.y1]="padT" [attr.y2]="h - padB" />
          <text class="marker-label mono" [attr.x]="c.marker.x + 3" [attr.y]="padT + 9">{{ c.marker.label }}</text>
        }
      }
    </svg>
  `,
  styles: [`
    :host { display: block; }
    .chart { width: 100%; height: auto; display: block; }
    .grid-line { stroke: var(--line); stroke-width: 1; }
    .axis, .xlab { font-size: 9.5px; fill: var(--ink-4); }
    .band { fill: var(--sleep-bed); }
    .median { fill: var(--sleep-sleep); }
    .awake { fill: var(--sleep-awake); }
    .marker { stroke: var(--ink-3); stroke-width: 1; stroke-dasharray: 3 3; }
    .marker-label { font-size: 9.5px; fill: var(--ink-3); }
  `],
})
export class SleepBucketsChartComponent {
  readonly buckets = input.required<SleepBucket[]>();
  readonly markers = input<readonly SleepMarker[]>([]);

  protected readonly w = W;
  protected readonly h = H;
  protected readonly padL = PAD_LEFT;
  protected readonly padT = PAD_TOP;
  protected readonly padB = PAD_BOTTOM;
  private readonly innerH = H - PAD_TOP - PAD_BOTTOM;

  private readonly from = computed(() => Math.max(0, Math.min(...this.buckets().map((b) => b.onset.p25)) - 0.5));
  private readonly to = computed(() => Math.min(24, Math.max(...this.buckets().map((b) => b.wake.p75)) + 0.5));
  private y(pos: number): number {
    return PAD_TOP + ((pos - this.from()) / Math.max(this.to() - this.from(), 1)) * this.innerH;
  }
  protected readonly slot = computed(() => (W - PAD_LEFT) / Math.max(this.buckets().length, 1));
  protected readonly bw = computed(() => Math.max(3, Math.min(this.slot() * 0.7, 26)));

  protected readonly grid = computed<GridVM[]>(() => {
    const out: GridVM[] = [];
    for (let hh = Math.ceil(this.from() / 2) * 2; hh <= this.to(); hh += 2) {
      out.push({ y: this.y(hh), label: `${String((SLEEP_AXIS_ORIGIN_H + hh) % 24).padStart(2, '0')}h` });
    }
    return out;
  });

  protected readonly cols = computed<ColVM[]>(() => {
    const bs = this.buckets();
    const slot = this.slot();
    const bw = this.bw();
    const maxAwake = Math.max(1, ...bs.map((b) => b.awakeMin ?? 0));
    const labelStep = bs.length <= 14 ? 1 : Math.ceil(bs.length / 6);
    return bs.map((b, i) => {
      const x = PAD_LEFT + i * slot + (slot - bw) / 2;
      const next = bs[i + 1];
      const m = this.markers().find((mk) => b.key <= mk.day && (!next || next.key > mk.day) && i < bs.length - 1);
      return {
        key: b.key,
        x,
        bandY: this.y(b.onset.p25),
        bandH: Math.max(2, this.y(b.wake.p75) - this.y(b.onset.p25)),
        medY: this.y(b.onset.median),
        medH: Math.max(2, this.y(b.wake.median) - this.y(b.onset.median)),
        awakeH: b.awakeMin == null ? 0 : Math.max(1.5, (b.awakeMin / maxAwake) * AWAKE_MAX_H),
        label: i % labelStep === 0 ? `${b.key.slice(8)}/${b.key.slice(5, 7)}` : null,
        marker: m ? { x: x + slot, label: m.label } : null,
      };
    });
  });
}
