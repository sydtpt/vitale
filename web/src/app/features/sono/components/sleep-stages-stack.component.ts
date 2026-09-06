import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import type { SleepBucket, StageKey } from '@vitale/shared';

interface SegVM { y: number; h: number; cls: string; hatch: boolean; }
interface ColVM { key: string; x: number; label: string | null; segments: SegVM[]; unknown: { y: number; h: number } | null; }
interface GridVM { y: number; label: string; }

const W = 640;
const H = 250;
const PAD_TOP = 8;
const PAD_BOTTOM = 18;
const PAD_LEFT = 30;
/** Respiro de superfície entre segmentos — o mesmo 2 px que a barra empilhada pede. */
const GAP = 2;
/**
 * De baixo para cima: profundo na base, leve, REM, o que não tem estágio, e a
 * vigília no topo — a ordem do hipnograma virada de pé.
 */
const ORDER: (StageKey | 'awake')[] = ['deep', 'core', 'rem', 'unspecified', 'awake'];

let hatchSeq = 0;

function hoursOf(b: SleepBucket, k: StageKey | 'awake'): number {
  if (k === 'awake') return (b.awakeMin ?? 0) / 60;
  // `stagesH` é um Record esparso: a chave pode faltar, e o tipo não diz.
  const v = (b.stagesH as Record<string, number | undefined>)[k];
  return v === undefined ? 0 : v;
}

/**
 * Os estágios em **total**: uma coluna por noite (ou por semana), em horas por
 * estágio, com a vigília no topo — a altura da coluna é a noite inteira. É
 * composição, não posição. Coluna sem hipnograma é hachura na altura das horas
 * dormidas: "dormiu, sem o detalhe". Estimativa do aparelho, comparável com você
 * mesmo — nunca contra norma clínica.
 */
@Component({
  selector: 'rt-sleep-stages-stack',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg [attr.viewBox]="'0 0 ' + w + ' ' + h" class="chart" role="img" aria-label="Horas por estágio, uma coluna por noite ou semana">
      <defs>
        <pattern [attr.id]="hatchId" patternUnits="userSpaceOnUse" width="5" height="5" patternTransform="rotate(45)">
          <line class="hatch" x1="0" y1="0" x2="0" y2="5" />
        </pattern>
      </defs>
      @for (g of grid(); track g.label) {
        <line class="grid-line" [attr.x1]="padL" [attr.x2]="w" [attr.y1]="g.y" [attr.y2]="g.y" />
        <text class="axis mono" [attr.x]="0" [attr.y]="g.y + 3">{{ g.label }}</text>
      }
      <line class="grid-line" [attr.x1]="padL" [attr.x2]="w" [attr.y1]="baseY" [attr.y2]="baseY" />
      @for (c of cols(); track c.key) {
        @if (c.unknown) {
          <rect [attr.fill]="'url(#' + hatchId + ')'" [attr.x]="c.x" [attr.y]="c.unknown.y" [attr.width]="bw()" [attr.height]="c.unknown.h" />
        }
        @for (s of c.segments; track $index) {
          <rect [attr.class]="s.cls" [attr.fill]="s.hatch ? 'url(#' + hatchId + ')' : null" [attr.x]="c.x" [attr.y]="s.y" [attr.width]="bw()" [attr.height]="s.h" />
        }
        @if (c.label) {
          <text class="xlab mono" [class.night]="nightly()" [attr.x]="c.x + bw() / 2" [attr.y]="h - 4" text-anchor="middle">{{ c.label }}</text>
        }
      }
    </svg>
  `,
  styles: [`
    :host { display: block; }
    .chart { width: 100%; height: auto; display: block; }
    .grid-line { stroke: var(--line); stroke-width: 1; }
    .axis, .xlab { font-size: 9.5px; fill: var(--ink-4); }
    .xlab.night { fill: var(--ink-3); }
    .hatch { stroke: var(--sleep-unknown); stroke-width: 1.3; }
    .st-deep { fill: var(--sleep-deep); }
    .st-core { fill: var(--sleep-light); }
    .st-rem { fill: var(--sleep-rem); }
    .st-awake { fill: var(--sleep-awake); }
  `],
})
export class SleepStagesStackComponent {
  readonly buckets = input.required<SleepBucket[]>();

  protected readonly w = W;
  protected readonly h = H;
  protected readonly padL = PAD_LEFT;
  protected readonly hatchId = `stack-hatch-${(hatchSeq += 1)}`;
  private readonly innerH = H - PAD_TOP - PAD_BOTTOM;
  protected readonly baseY = PAD_TOP + this.innerH;

  protected readonly nightly = computed(() => this.buckets()[0]?.kind === 'night');
  private readonly maxH = computed(() =>
    Math.max(1, ...this.buckets().map((b) => (b.stagedNights === 0 ? b.asleepH : ORDER.reduce((s, k) => s + hoursOf(b, k), 0)))),
  );
  private y(hours: number): number {
    return PAD_TOP + this.innerH - (hours / this.maxH()) * this.innerH;
  }
  protected readonly slot = computed(() => (W - PAD_LEFT) / Math.max(this.buckets().length, 1));
  protected readonly bw = computed(() => (this.nightly() ? Math.max(4, Math.min(this.slot() * 0.58, 18)) : Math.max(3, Math.min(this.slot() * 0.7, 26))));

  protected readonly grid = computed<GridVM[]>(() => {
    const out: GridVM[] = [];
    for (let hh = 2; hh <= this.maxH(); hh += 2) out.push({ y: this.y(hh), label: `${hh}h` });
    return out;
  });

  protected readonly cols = computed<ColVM[]>(() => {
    const bs = this.buckets();
    const slot = this.slot();
    const bw = this.bw();
    const labelStep = bs.length <= 14 ? 1 : Math.ceil(bs.length / 6);
    return bs.map((b, i) => {
      const x = PAD_LEFT + i * slot + (slot - bw) / 2;
      let acc = 0;
      const segments: SegVM[] = [];
      if (b.stagedNights > 0) {
        for (const k of ORDER) {
          const hrs = hoursOf(b, k);
          if (hrs <= 0) continue;
          const top = this.y(acc + hrs);
          const bottom = this.y(acc);
          acc += hrs;
          segments.push({ y: top, h: Math.max(1, bottom - top - GAP), cls: `st-${k}`, hatch: k === 'unspecified' });
        }
      }
      return {
        key: b.key,
        x,
        label: i % labelStep === 0 ? (this.nightly() ? b.key.slice(8) : `${b.key.slice(8)}/${b.key.slice(5, 7)}`) : null,
        segments,
        unknown: b.stagedNights === 0 ? { y: this.y(b.asleepH), h: Math.max(1, this.y(0) - this.y(b.asleepH)) } : null,
      };
    });
  });
}
