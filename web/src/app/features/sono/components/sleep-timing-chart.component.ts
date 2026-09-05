import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import {
  SLEEP_AXIS_ORIGIN_H,
  axisRange,
  toTimingBar,
  type SleepPeriod,
  type TimingBar,
} from '@vitale/shared';

interface SegVM { y: number; h: number; cls: string; }
interface HoleVM { y: number; h: number; }
interface ColVM {
  day: string;
  label: string;
  x: number;
  bar: TimingBar | null;
  yOnset: number;
  yWake: number;
  bed: { y: number; h: number } | null;
  holes: HoleVM[];
  /** Os estágios na posição real; `null` = sem hipnograma (hachura). Só em `stages`. */
  segments: SegVM[] | null;
}
interface GridVM { y: number; label: string; }

const W = 640;
const H = 240;
const PAD_TOP = 8;
const PAD_BOTTOM = 18;
const PAD_LEFT = 34;
/** A marca amarela ao lado da barra: largura, e o vão até a barra. */
const TICK_W = 3;
const TICK_GAP = 2;

let hatchSeq = 0;

/**
 * O sleep timing chart, na web: a mesma peça do mobile, desenhada pelo mesmo
 * núcleo (`toTimingBar`/`axisRange`). Cada noite é uma barra na HORA DO DIA —
 * apagar em cima, acordar embaixo —, os despertares furam a barra, e noite sem
 * dado é célula vazia, não zero.
 *
 * Três ênfases, como no mobile: `sleep` (visão geral — sono, vão, cama em
 * contorno tracejado), `awake` (Tempos — cama em lavagem, vão + marca amarela
 * ao lado) e `stages` (cada estágio na posição real; sem hipnograma, hachura).
 * Nenhum número, nenhum seletor: a regularidade aparece porque barras alinhadas
 * parecem alinhadas (spec §2). Cor só por variável `--sleep-*`.
 */
@Component({
  selector: 'rt-sleep-timing-chart',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg [attr.viewBox]="'0 0 ' + w + ' ' + h" class="chart" role="img"
      aria-label="Noites na hora do dia: apagar em cima, acordar embaixo; buracos são despertares">
      <defs>
        <pattern [attr.id]="hatchId" patternUnits="userSpaceOnUse" width="5" height="5" patternTransform="rotate(45)">
          <line class="hatch" x1="0" y1="0" x2="0" y2="5" />
        </pattern>
      </defs>
      @for (g of grid(); track g.label) {
        <line class="grid-line" [attr.x1]="padL" [attr.x2]="w" [attr.y1]="g.y" [attr.y2]="g.y" />
        <text class="axis mono" [attr.x]="0" [attr.y]="g.y + 3">{{ g.label }}</text>
      }
      @for (c of cols(); track c.day) {
        @if (c.bar) {
          @if (c.bed) {
            @if (overview()) {
              <rect class="bed-outline" [attr.x]="c.x - 2" [attr.y]="c.bed.y" [attr.width]="barW() + 4" [attr.height]="c.bed.h" rx="4" />
            } @else {
              <rect class="bed-wash" [attr.x]="c.x" [attr.y]="c.bed.y" [attr.width]="barW()" [attr.height]="c.bed.h" rx="3" />
            }
          }
          @if (c.segments) {
            @for (s of c.segments; track $index) {
              <rect [attr.class]="s.cls" [attr.fill]="s.cls === 'st-unspecified' ? 'url(#' + hatchId + ')' : null"
                [attr.x]="c.x" [attr.y]="s.y" [attr.width]="barW()" [attr.height]="s.h" />
            }
          } @else {
            <rect [attr.class]="stagesMode() ? 'unknown' : 'sleep'" [attr.fill]="stagesMode() ? 'url(#' + hatchId + ')' : null"
              [attr.x]="c.x" [attr.y]="c.yOnset" [attr.width]="barW()" [attr.height]="c.yWake - c.yOnset" rx="3">
              <title>{{ c.day }}</title>
            </rect>
          }
          @for (hole of c.holes; track $index) {
            <rect class="hole" [attr.x]="c.x" [attr.y]="hole.y" [attr.width]="barW()" [attr.height]="hole.h" />
            @if (!overview()) {
              <rect class="tick" [attr.x]="c.x + barW() + tickGap" [attr.y]="hole.y" [attr.width]="tickW" [attr.height]="max(hole.h, 2.5)" rx="1" />
            }
          }
          <text class="xlab mono" [attr.x]="c.x + barW() / 2" [attr.y]="h - 4" text-anchor="middle">{{ c.label }}</text>
        } @else {
          <rect class="empty" [attr.x]="c.x" [attr.y]="emptyY" [attr.width]="barW()" [attr.height]="emptyH" rx="3" />
          <text class="xlab mono faint" [attr.x]="c.x + barW() / 2" [attr.y]="h - 4" text-anchor="middle">{{ c.label }}</text>
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
    /* A gramática de cor do sono (shared sleep/colors.ts): azul é sono, o vão é o despertar,
       a marca ao lado é a vigília, a hachura é "sem estágio". */
    .sleep { fill: var(--sleep-sleep); }
    .hole { fill: var(--surface); }
    .tick { fill: var(--sleep-awake); }
    .bed-outline { fill: none; stroke: var(--sleep-sleep); stroke-width: 1; stroke-dasharray: 3 2; opacity: .55; }
    .bed-wash { fill: var(--sleep-bed); }
    .hatch { stroke: var(--sleep-unknown); stroke-width: 1.3; }
    .st-rem { fill: var(--sleep-rem); }
    .st-core { fill: var(--sleep-light); }
    .st-deep { fill: var(--sleep-deep); }
    .empty { fill: none; stroke: var(--line); stroke-width: 1; stroke-dasharray: 3 3; }
  `],
})
export class SleepTimingChartComponent {
  /** Dias de acordar a desenhar, em ordem, incluindo os sem noite. */
  readonly days = input.required<string[]>();
  readonly periods = input.required<SleepPeriod[]>();
  readonly emphasis = input<'sleep' | 'awake' | 'stages'>('sleep');

  protected readonly w = W;
  protected readonly h = H;
  protected readonly padL = PAD_LEFT;
  protected readonly tickW = TICK_W;
  protected readonly tickGap = TICK_GAP;
  protected readonly hatchId = `sleep-hatch-${(hatchSeq += 1)}`;
  protected readonly max = Math.max;

  protected readonly overview = computed(() => this.emphasis() === 'sleep');
  protected readonly stagesMode = computed(() => this.emphasis() === 'stages');

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
  /** Nas subviews a marca ao lado precisa caber no slot junto com a barra. */
  protected readonly barW = computed(() => {
    const room = this.overview() ? 0 : TICK_W + TICK_GAP;
    return Math.max(4, Math.min(this.slot() * 0.58, 18, this.overview() ? Infinity : this.slot() - room - 1));
  });
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
    const groupW = this.barW() + (this.overview() ? 0 : TICK_W + TICK_GAP);
    const stages = this.stagesMode();
    return this.days().map((day, i) => {
      const x = PAD_LEFT + i * slot + (slot - groupW) / 2;
      const bar = this.bars().get(day) ?? null;
      const label = day.slice(8);
      if (!bar || !bar.fitsAxis) {
        return { day, label, x, bar: null, yOnset: 0, yWake: 0, bed: null, holes: [], segments: null };
      }
      const segments =
        stages && bar.segments && bar.segments.length > 0
          ? bar.segments.map((s) => ({ y: this.y(s.from), h: Math.max(1.5, this.y(s.to) - this.y(s.from)), cls: `st-${s.stage}` }))
          : null;
      return {
        day, label, x, bar,
        yOnset: this.y(bar.onset),
        yWake: Math.max(this.y(bar.wake), this.y(bar.onset) + 2),
        bed: bar.bed ? { y: this.y(bar.bed.from), h: Math.max(1, this.y(bar.bed.to) - this.y(bar.bed.from)) } : null,
        holes: (bar.holes ?? []).map((hl) => ({ y: this.y(hl.from), h: Math.max(1.5, this.y(hl.to) - this.y(hl.from)) })),
        segments,
      };
    });
  });
}
