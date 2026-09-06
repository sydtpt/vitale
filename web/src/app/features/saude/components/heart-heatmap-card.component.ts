import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { PanelComponent } from '@shared/components/panel/panel.component';
import { HeartSeriesStore } from '../data/heart-series.store';
import { DOW, dayLabel, dowOf } from './heart-chart-scale';

const W = 720;
const L = 58;
const T = 18;
const CELL_W = 26;
const CELL_H = 10;
const GAP = 1;

/**
 * Degraus sequenciais de um matiz só, do `wash` ao `strong` do vermelho: claro é
 * calmo, escuro é esforço. Cinco degraus discretos em vez de interpolação — os
 * tokens já foram medidos contra a superfície nas 36 combinações.
 */
const BINS: ReadonlyArray<{ upTo: number; cls: string; label: string }> = [
  { upTo: 50, cls: 'b1', label: '≤ 50 · dormindo' },
  { upTo: 65, cls: 'b2', label: '≤ 65 · em pé' },
  { upTo: 85, cls: 'b3', label: '≤ 85 · andando' },
  { upTo: 110, cls: 'b4', label: '≤ 110' },
  { upTo: Infinity, cls: 'b5', label: '> 110 · treino' },
];

interface CellVM { x: number; y: number; cls: string; day: string; hour: number; value: number; }
interface RowLabelVM { y: number; label: string; weekend: boolean; }
interface HeatVM { cells: CellVM[]; rows: RowLabelVM[]; height: number; }
interface HoverVM { px: number; py: number; text: string; }

/** O terceiro painel: dia por linha, hora por coluna, média por hora na cor. */
@Component({
  selector: 'rt-heart-heatmap-card',
  standalone: true,
  imports: [PanelComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <rt-panel title="Dia a dia, hora a hora">
      <span panel-right class="cap">média por hora · {{ store.days().length }} dias</span>
      @if (vm(); as v) {
        <div class="box">
          <svg [attr.viewBox]="'0 0 ' + w + ' ' + v.height" class="chart" role="img"
            aria-label="Mapa de calor da frequência cardíaca: um dia por linha, uma hora por coluna"
            (mousemove)="onMove($event)" (mouseleave)="hover.set(null)">
            @for (h of hours; track h) {
              <text class="axis mono" [attr.x]="l + h * cellW + cellW / 2" [attr.y]="t - 6" text-anchor="middle">{{ h }}h</text>
            }
            @for (r of v.rows; track r.label) {
              <text class="axis mono" [attr.x]="l - 8" [attr.y]="r.y + cellH - 1" text-anchor="end">{{ r.label }}</text>
            }
            @for (c of v.cells; track c.day + ':' + c.hour) {
              <rect [attr.class]="'cell ' + c.cls" [attr.x]="c.x" [attr.y]="c.y" [attr.width]="cellW - 1" [attr.height]="cellH" rx="1.5"
                [attr.data-day]="c.day" [attr.data-hour]="c.hour" [attr.data-value]="c.value" />
            }
          </svg>
          @if (hover(); as hv) {
            <div class="tip" [style.left.%]="hv.px" [style.top.%]="hv.py">{{ hv.text }}</div>
          }
        </div>
        <div class="legend">
          @for (b of bins; track b.cls) {
            <span><i [class]="'sw ' + b.cls"></i>{{ b.label }}</span>
          }
          <span><i class="sw we"></i>fim de semana</span>
        </div>
      } @else if (store.loaded()) {
        <div class="state">Sem série ainda.</div>
      } @else {
        <div class="state">Carregando…</div>
      }
    </rt-panel>
  `,
  styles: [`
    :host { display: block; }
    .cap { font-size: 12px; color: var(--ink-3); }
    .state { padding: 18px 0; color: var(--ink-3); font-size: 13px; }
    .box { position: relative; }
    .chart { width: 100%; height: auto; display: block; }
    .axis { font-size: 11px; fill: var(--ink-3); }
    .cell { fill: var(--hairline); }
    .b1 { fill: var(--role-red-wash); }
    .b2 { fill: var(--role-red-pale); }
    .b3 { fill: var(--role-red-graphic); opacity: .75; }
    .b4 { fill: var(--role-red-graphic); }
    .b5 { fill: var(--role-red-strong); }
    .tip {
      position: absolute; pointer-events: none; transform: translate(-50%, calc(-100% - 6px));
      background: var(--ink); color: var(--bg); font: 500 12px var(--font-sans); padding: 5px 8px; border-radius: 6px; white-space: nowrap;
    }
    .legend { display: flex; flex-wrap: wrap; gap: 6px 14px; margin-top: 8px; font-size: 12px; color: var(--ink-2); }
    .sw { display: inline-block; width: 14px; height: 10px; vertical-align: middle; margin-right: 6px; border-radius: 2px; background: var(--hairline); }
    .sw.b1 { background: var(--role-red-wash); } .sw.b2 { background: var(--role-red-pale); }
    .sw.b3 { background: var(--role-red-graphic); opacity: .75; } .sw.b4 { background: var(--role-red-graphic); }
    .sw.b5 { background: var(--role-red-strong); }
    .sw.we { width: 10px; height: 10px; border-radius: 50%; background: var(--ink-3); }
  `],
})
export class HeartHeatmapCardComponent {
  protected readonly store = inject(HeartSeriesStore);
  protected readonly w = W;
  protected readonly l = L;
  protected readonly t = T;
  protected readonly cellW = CELL_W;
  protected readonly cellH = CELL_H;
  protected readonly hours = [0, 6, 12, 18, 23];
  protected readonly bins = BINS;
  protected readonly hover = signal<HoverVM | null>(null);

  protected readonly vm = computed<HeatVM | null>(() => {
    const cells = this.store.cells();
    if (cells.length === 0) return null;
    const days = [...new Set(cells.map((c) => c.day))].sort();
    const rowOf = new Map(days.map((d, i) => [d, i]));
    const out: CellVM[] = cells.map((c) => {
      const row = rowOf.get(c.day) ?? 0;
      return { x: L + c.hour * CELL_W, y: T + row * (CELL_H + GAP), cls: binOf(c.value), day: c.day, hour: c.hour, value: c.value };
    });
    const rows: RowLabelVM[] = [];
    days.forEach((d, i) => {
      const w = dowOf(d);
      const weekend = w === 0 || w === 6;
      if (w === 1 || i === 0) rows.push({ y: T + i * (CELL_H + GAP), label: `${weekend ? '· ' : ''}${dayLabel(d)}`, weekend });
    });
    return { cells: out, rows, height: T + days.length * (CELL_H + GAP) + 6 };
  });

  protected onMove(ev: MouseEvent): void {
    const el = ev.target as SVGElement;
    const day = el.getAttribute?.('data-day');
    if (!day) {
      this.hover.set(null);
      return;
    }
    const hour = Number(el.getAttribute('data-hour'));
    const value = Number(el.getAttribute('data-value'));
    const x = Number(el.getAttribute('x')) + CELL_W / 2;
    const y = Number(el.getAttribute('y'));
    const height = this.vm()?.height ?? 1;
    this.hover.set({ px: (x / W) * 100, py: (y / height) * 100, text: `${DOW[dowOf(day)]} ${dayLabel(day)} · ${hour}h · ${value} bpm` });
  }
}

function binOf(v: number): string {
  for (const b of BINS) if (v <= b.upTo) return b.cls;
  return 'b5';
}
