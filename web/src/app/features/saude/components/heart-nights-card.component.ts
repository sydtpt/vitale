import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { PanelComponent } from '@shared/components/panel/panel.component';
import { HealthStore } from '../data/health.store';
import { HeartSeriesStore } from '../data/heart-series.store';
import { MESES, dayLabel, fmt } from './heart-chart-scale';

const W = 720;
const H = 200;
const L = 38;
const R = 14;
const T = 18;
const B = 24;
/** Eixo das noites: a faixa fisiológica de FC dormindo; fora dela a escala estica. */
const Y_MIN = 40;
const Y_MAX = 62;

interface GridVM { y: number; label: string; }
interface TickVM { x: number; label: string; }
interface DotVM { x: number; y: number; }
interface NightsVM {
  band: string;
  line: string;
  rest: DotVM[];
  grid: GridVM[];
  ticks: TickVM[];
  last: { x: number; y: number; label: string };
}
interface HoverVM { px: number; py: number; text: string; }

/**
 * O segundo painel: uma medida por noite — a média da série dentro da janela
 * dormindo — com a mínima fechando uma faixa, e o repouso segundo o Garmin
 * (`health_daily.fcRepouso`) como ponto vazado. Sem score, como no Sono.
 */
@Component({
  selector: 'rt-heart-nights-card',
  standalone: true,
  imports: [PanelComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <rt-panel title="Noites">
      <span panel-right class="cap">média e mínima dormindo, por noite</span>
      @if (vm(); as v) {
        <div class="box">
          <svg [attr.viewBox]="'0 0 ' + w + ' ' + h" class="chart" role="img"
            aria-label="Frequência cardíaca dormindo, por noite: média em linha, faixa até a mínima, repouso do Garmin em ponto vazado">
            @for (g of v.grid; track g.label) {
              <line class="grid-line" [attr.x1]="l" [attr.x2]="w - r" [attr.y1]="g.y" [attr.y2]="g.y" />
              <text class="axis mono" [attr.x]="l - 6" [attr.y]="g.y + 4" text-anchor="end">{{ g.label }}</text>
            }
            @for (t of v.ticks; track t.label) {
              <text class="axis mono" [attr.x]="t.x" [attr.y]="h - 6" text-anchor="middle">{{ t.label }}</text>
            }
            <path class="band" [attr.d]="v.band" />
            <path class="line" [attr.d]="v.line" />
            @for (d of v.rest; track $index) {
              <circle class="rest" [attr.cx]="d.x" [attr.cy]="d.y" r="3" />
            }
            <circle class="last" [attr.cx]="v.last.x" [attr.cy]="v.last.y" r="4.5" />
            <text class="big" [attr.x]="v.last.x - 8" [attr.y]="v.last.y - 9" text-anchor="end">{{ v.last.label }}</text>
            <rect class="hit" [attr.x]="l" [attr.y]="t" [attr.width]="w - l - r" [attr.height]="h - t - b"
              (mousemove)="onMove($event)" (mouseleave)="hover.set(null)" />
          </svg>
          @if (hover(); as hv) {
            <div class="tip" [style.left.%]="hv.px" [style.top.%]="hv.py">{{ hv.text }}</div>
          }
        </div>
        <div class="legend">
          <span><i class="sw line"></i>média dormindo</span>
          <span><i class="sw band"></i>da mínima à média</span>
          <span><i class="sw dot"></i>repouso segundo o Garmin</span>
        </div>
      } @else if (store.loaded()) {
        <div class="state">Sem noite medida ainda: precisa da série e da janela de sono da mesma noite.</div>
      } @else {
        <div class="state">Carregando as noites…</div>
      }
    </rt-panel>
  `,
  styles: [`
    :host { display: block; }
    .cap { font-size: 12px; color: var(--ink-3); }
    .state { padding: 18px 0; color: var(--ink-3); font-size: 13px; }
    .box { position: relative; }
    .chart { width: 100%; height: auto; display: block; }
    .grid-line { stroke: var(--line); stroke-width: 1; }
    .axis { font-size: 11px; fill: var(--ink-3); }
    .big { font-family: var(--font-mono); font-size: 12px; font-weight: 600; fill: var(--ink); }
    .band { fill: var(--role-red-wash); opacity: .7; }
    .line { fill: none; stroke: var(--role-red-graphic); stroke-width: 2; stroke-linejoin: round; }
    .rest { fill: var(--surface); stroke: var(--ink-3); stroke-width: 1.5; }
    .last { fill: var(--role-red-graphic); stroke: var(--surface); stroke-width: 2; }
    .hit { fill: transparent; cursor: crosshair; }
    .tip {
      position: absolute; pointer-events: none; transform: translate(-50%, calc(-100% - 12px));
      background: var(--ink); color: var(--bg); font: 500 12px var(--font-sans); padding: 5px 8px; border-radius: 6px; white-space: nowrap;
    }
    .legend { display: flex; flex-wrap: wrap; gap: 6px 16px; margin-top: 8px; font-size: 12px; color: var(--ink-2); }
    .sw { display: inline-block; width: 14px; height: 10px; vertical-align: middle; margin-right: 6px; border-radius: 2px; }
    .sw.line { height: 0; border-top: 2px solid var(--role-red-graphic); }
    .sw.band { background: var(--role-red-wash); }
    .sw.dot { width: 8px; height: 8px; border: 2px solid var(--ink-3); border-radius: 50%; background: var(--surface); }
  `],
})
export class HeartNightsCardComponent {
  protected readonly store = inject(HeartSeriesStore);
  private readonly health = inject(HealthStore);

  protected readonly w = W;
  protected readonly h = H;
  protected readonly l = L;
  protected readonly r = R;
  protected readonly t = T;
  protected readonly b = B;
  protected readonly hover = signal<HoverVM | null>(null);

  private x(i: number, n: number): number {
    return n > 1 ? L + (i / (n - 1)) * (W - L - R) : L + (W - L - R) / 2;
  }
  private y(v: number, lo: number, hi: number): number {
    return T + (1 - (v - lo) / (hi - lo)) * (H - T - B);
  }

  /** Limites do eixo: a faixa fisiológica, esticada quando uma noite sai dela. */
  private readonly bounds = computed(() => {
    const nights = this.store.nights();
    let lo = Y_MIN;
    let hi = Y_MAX;
    for (const n of nights) {
      lo = Math.min(lo, n.min - 2);
      hi = Math.max(hi, n.mean + 2);
    }
    return { lo: Math.floor(lo / 5) * 5, hi: Math.ceil(hi / 5) * 5 };
  });

  protected readonly vm = computed<NightsVM | null>(() => {
    const nights = this.store.nights();
    if (nights.length === 0) return null;
    const n = nights.length;
    const { lo, hi } = this.bounds();
    const x = (i: number) => this.x(i, n);
    const y = (v: number) => this.y(v, lo, hi);
    const line = nights.map((r, i) => `${i ? 'L' : 'M'}${fmt(x(i))},${fmt(y(r.mean))}`).join(' ');
    const back = [...nights].reverse().map((r, k) => `L${fmt(x(n - 1 - k))},${fmt(y(r.min))}`).join(' ');
    const band = n > 1 ? `${line} ${back} Z` : '';
    const rest = this.health.valuesByDay('fcRepouso');
    const dots: DotVM[] = [];
    nights.forEach((r, i) => {
      const v = rest.get(r.wakeDay);
      if (v != null) dots.push({ x: x(i), y: y(v) });
    });
    const grid: GridVM[] = [];
    for (let v = lo; v <= hi; v += 5) grid.push({ y: y(v), label: String(v) });
    const ticks: TickVM[] = [];
    let lastMonth = '';
    nights.forEach((r, i) => {
      const m = r.wakeDay.slice(5, 7);
      const d = r.wakeDay.slice(8);
      if (m !== lastMonth || d === '15') {
        ticks.push({ x: x(i), label: `${Number(d)} ${MESES[Number(m) - 1]}` });
        lastMonth = m;
      }
    });
    const last = nights[n - 1];
    return { band, line, rest: dots, grid, ticks, last: { x: x(n - 1), y: y(last.mean), label: `${last.mean} bpm dormindo` } };
  });

  protected onMove(ev: MouseEvent): void {
    const nights = this.store.nights();
    const svg = (ev.currentTarget as SVGRectElement).ownerSVGElement;
    if (nights.length === 0 || !svg) return;
    const pt = svg.createSVGPoint();
    pt.x = ev.clientX;
    pt.y = ev.clientY;
    const ctm = svg.getScreenCTM();
    if (!ctm) return;
    const p = pt.matrixTransform(ctm.inverse());
    const n = nights.length;
    const i = Math.max(0, Math.min(n - 1, Math.round(((p.x - L) / (W - L - R)) * (n - 1))));
    const r = nights[i];
    const rest = this.health.valuesByDay('fcRepouso').get(r.wakeDay);
    const { lo, hi } = this.bounds();
    const text = `${dayLabel(r.wakeDay)} · ${r.mean} média · ${r.min} mínima${rest != null ? ` · repouso ${Math.round(rest)}` : ''}`;
    this.hover.set({ px: (this.x(i, n) / W) * 100, py: (this.y(r.mean, lo, hi) / H) * 100, text });
  }
}
