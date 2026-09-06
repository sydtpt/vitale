import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import {
  activityMarkLabel,
  activitySpansOnDay,
  activityTypeLabel,
  heartLineRuns,
  sleepSpansOnDay,
  type HealthSeriesDay,
} from '@vitale/shared';
import { PanelComponent } from '@shared/components/panel/panel.component';
import { ActivitiesStore } from '../../workout-history/data/activities.store';
import { HeartSeriesStore } from '../data/heart-series.store';
import { DOW, dayLabel, dayScale, dowOf, fmt, hm, type Frame } from './heart-chart-scale';

const FRAME: Frame = { w: 720, h: 250, l: 38, r: 10, t: 22, b: 22 };
/** Dias na tira, dos 60 carregados. */
const STRIP_DAYS = 14;
/** Distância máxima (min) entre o mouse e a leitura mais próxima para mostrar o tooltip. */
const HOVER_REACH_MIN = 20;

interface StripVM { day: string; label: string; mean: number; on: boolean; }
interface RectVM { x: number; w: number; }
interface MarkVM extends RectVM { cx: number; label: string | null; }
interface GridVM { y: number; label: string; }
interface TickVM { x: number; label: string; anchor: string; }
interface DayVM {
  band: string;
  sleep: RectVM[];
  grid: GridVM[];
  ticks: TickVM[];
  marks: MarkVM[];
  runs: string[];
}
interface HoverVM { x: number; y: number; px: number; py: number; text: string; }

/**
 * O primeiro painel da proposta: a curva de um dia, medida a cada 2 minutos,
 * sobre a faixa típica de cada hora, com a noite sombreada e o treino marcado no
 * topo. Tira de 14 dias para trocar o dia. Decisões (spec fc-serie, aprovadas em
 * 05/09/2026): papel `red` no `graphic`, faixa no `wash`, escala fixa 40–170, sem
 * suavização (buraco > 10 min quebra a linha), noite = `--sleep-bed`, treino =
 * marca no papel do módulo Treino.
 */
@Component({
  selector: 'rt-heart-day-card',
  standalone: true,
  imports: [PanelComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <rt-panel title="FC ao longo do dia">
      <span panel-right class="cap">medida a cada 2 min</span>
      @if (store.state() === 'error') {
        <div class="state">Não deu para carregar a série: {{ store.error() }}</div>
      } @else if (store.loaded() && !vm()) {
        <div class="state">Sem série ainda. O app grava a FC do dia no próximo sync.</div>
      } @else if (vm(); as v) {
        <div class="strip" role="tablist" aria-label="Dia">
          @for (s of strip(); track s.day) {
            <button type="button" role="tab" [attr.aria-selected]="s.on" [class.on]="s.on" (click)="select(s.day)">
              <span>{{ s.label }}</span><b class="mono">{{ s.mean }}</b>
            </button>
          }
        </div>
        <div class="box">
          <svg [attr.viewBox]="'0 0 ' + f.w + ' ' + f.h" class="chart" role="img"
            aria-label="Frequência cardíaca ao longo do dia: linha medida a cada 2 minutos sobre a faixa típica por hora">
            <path class="band" [attr.d]="v.band" />
            @for (s of v.sleep; track $index) {
              <rect class="bed" [attr.x]="s.x" [attr.y]="f.t" [attr.width]="s.w" [attr.height]="plotH" />
            }
            @for (g of v.grid; track g.label) {
              <line class="grid-line" [attr.x1]="f.l" [attr.x2]="f.w - f.r" [attr.y1]="g.y" [attr.y2]="g.y" />
              <text class="axis mono" [attr.x]="f.l - 6" [attr.y]="g.y + 4" text-anchor="end">{{ g.label }}</text>
            }
            @for (t of v.ticks; track t.label) {
              <text class="axis mono" [attr.x]="t.x" [attr.y]="f.h - 6" [attr.text-anchor]="t.anchor">{{ t.label }}</text>
            }
            @for (m of v.marks; track $index) {
              <rect class="treino" [attr.x]="m.x" [attr.y]="f.t - 12" [attr.width]="m.w" height="4" rx="2" />
              @if (m.label) {
                <text class="lab" [attr.x]="m.cx" [attr.y]="f.t - 15" text-anchor="middle">{{ m.label }}</text>
              }
            }
            @for (d of v.runs; track $index) {
              <path class="line" [attr.d]="d" />
            }
            @if (hover(); as hv) {
              <line class="cross" [attr.x1]="hv.x" [attr.x2]="hv.x" [attr.y1]="f.t" [attr.y2]="f.h - f.b" />
              <circle class="dot" [attr.cx]="hv.x" [attr.cy]="hv.y" r="4" />
            }
            <rect class="hit" [attr.x]="f.l" [attr.y]="f.t" [attr.width]="plotW" [attr.height]="plotH"
              (mousemove)="onMove($event)" (mouseleave)="onLeave()" />
          </svg>
          @if (hover(); as hv) {
            <div class="tip" [style.left.%]="hv.px" [style.top.%]="hv.py">{{ hv.text }}</div>
          }
        </div>
        <div class="legend">
          <span><i class="sw line"></i>medida</span>
          <span><i class="sw band"></i>faixa típica · p25–p75 de cada hora nos últimos {{ store.days().length }} dias</span>
          <span><i class="sw bed"></i>dormindo</span>
          <span><i class="sw treino"></i>treino</span>
        </div>
      } @else {
        <div class="state">Carregando a série…</div>
      }
    </rt-panel>
  `,
  styles: [`
    :host { display: block; }
    .cap { font-size: 12px; color: var(--ink-3); }
    .state { padding: 18px 0; color: var(--ink-3); font-size: 13px; }
    .strip { display: flex; gap: 4px; margin-bottom: 12px; }
    .strip button {
      flex: 1; min-width: 0; padding: 6px 2px 5px; border: 1px solid var(--line); border-radius: 8px;
      background: var(--surface); color: var(--ink-2); font: 500 11px var(--font-sans); line-height: 1.15;
      display: flex; flex-direction: column; align-items: center; gap: 1px; white-space: nowrap; overflow: hidden;
    }
    .strip button b { font-size: 13px; font-weight: 500; color: var(--ink); }
    .strip button.on { border-color: var(--role-red-graphic); box-shadow: inset 0 0 0 1px var(--role-red-graphic); color: var(--role-red-text); }
    .strip button.on b { color: var(--role-red-text); }
    .strip button:focus-visible { outline: 2px solid var(--primary-graphic); outline-offset: 1px; }
    .box { position: relative; }
    .chart { width: 100%; height: auto; display: block; }
    .band { fill: var(--role-red-wash); opacity: .55; }
    .bed { fill: var(--sleep-bed); opacity: .7; }
    .grid-line { stroke: var(--line); stroke-width: 1; }
    .axis { font-size: 11px; fill: var(--ink-3); }
    .lab { font-family: var(--font-sans); font-size: 11px; font-weight: 600; fill: var(--ink-2); }
    .treino { fill: var(--role-orange-graphic); }
    .line { fill: none; stroke: var(--role-red-graphic); stroke-width: 2; stroke-linejoin: round; stroke-linecap: round; }
    .cross { stroke: var(--ink-3); stroke-dasharray: 2 3; }
    .dot { fill: var(--role-red-graphic); stroke: var(--surface); stroke-width: 2; }
    .hit { fill: transparent; cursor: crosshair; }
    .tip {
      position: absolute; pointer-events: none; transform: translate(-50%, calc(-100% - 10px));
      background: var(--ink); color: var(--bg); font: 500 12px var(--font-sans); padding: 5px 8px; border-radius: 6px; white-space: nowrap;
    }
    .legend { display: flex; flex-wrap: wrap; gap: 6px 16px; margin-top: 8px; font-size: 12px; color: var(--ink-2); }
    .sw { display: inline-block; width: 14px; height: 10px; vertical-align: middle; margin-right: 6px; border-radius: 2px; }
    .sw.line { height: 0; border-top: 2px solid var(--role-red-graphic); }
    .sw.band { background: var(--role-red-wash); }
    .sw.bed { background: var(--sleep-bed); }
    .sw.treino { height: 4px; background: var(--role-orange-graphic); }
    @media (max-width: 640px) { .strip button { font-size: 10px; } .strip button b { font-size: 12px; } }
  `],
})
export class HeartDayCardComponent {
  protected readonly store = inject(HeartSeriesStore);
  private readonly activities = inject(ActivitiesStore);

  protected readonly f = FRAME;
  protected readonly plotW = dayScale(FRAME).plotW;
  protected readonly plotH = dayScale(FRAME).plotH;

  private readonly selectedDay = signal<string | null>(null);
  protected readonly hover = signal<HoverVM | null>(null);

  constructor() {
    void this.store.load();
    void this.activities.load();
  }

  private readonly stripDays = computed(() => this.store.days().slice(-STRIP_DAYS));

  /** O dia escolhido; sem escolha, o último com série. */
  protected readonly current = computed<HealthSeriesDay | null>(() => {
    const days = this.stripDays();
    const sel = this.selectedDay();
    return days.find((d) => d.day === sel) ?? days[days.length - 1] ?? null;
  });

  protected readonly strip = computed<StripVM[]>(() => {
    const cur = this.current()?.day;
    return this.stripDays().map((d) => ({
      day: d.day,
      label: `${DOW[dowOf(d.day)]} ${Number(d.day.slice(8))}`,
      mean: Math.round(d.readings.reduce((a, b) => a + b, 0) / d.readings.length),
      on: d.day === cur,
    }));
  });

  protected readonly vm = computed<DayVM | null>(() => {
    const d = this.current();
    if (!d) return null;
    const { x, y } = dayScale(FRAME);
    const prof = this.store.profile();
    const top = prof.map((p, i) => `${i ? 'L' : 'M'}${fmt(x(p.hour * 60 + 30))},${fmt(y(p.p75))}`).join(' ');
    const bottom = [...prof].reverse().map((p) => `L${fmt(x(p.hour * 60 + 30))},${fmt(y(p.p25))}`).join(' ');
    const band = prof.length > 1 ? `${top} ${bottom} Z` : '';
    const sleep = sleepSpansOnDay(d.day, d.tzOffset, this.store.periods()).map((s) => ({ x: x(s.from), w: x(s.to) - x(s.from) }));
    const marks = activitySpansOnDay(
      d.day,
      d.tzOffset,
      this.activities.activities().map((a) => ({
        startAt: a.startAt,
        endAt: a.endAt,
        name: activityMarkLabel(a.activityName, activityTypeLabel(a.activityId)),
      })),
    ).map((a) => {
      const ax = x(a.from);
      const w = Math.max(3, x(a.to) - ax);
      return { x: ax, w, cx: ax + w / 2, label: a.name };
    });
    const grid = [40, 80, 120, 160].map((v) => ({ y: y(v), label: String(v) }));
    const ticks = [0, 6, 12, 18, 24].map((h) => ({ x: x(h * 60), label: `${h}h`, anchor: h === 0 ? 'start' : h === 24 ? 'end' : 'middle' }));
    const runs = heartLineRuns(d.minutes, d.readings).map((run) =>
      run.map((p, i) => `${i ? 'L' : 'M'}${fmt(x(p.minute))},${fmt(y(p.value))}`).join(' '),
    );
    return { band, sleep, grid, ticks, marks, runs };
  });

  protected select(day: string): void {
    this.selectedDay.set(day);
    this.hover.set(null);
  }

  protected onMove(ev: MouseEvent): void {
    const d = this.current();
    const svg = (ev.currentTarget as SVGRectElement).ownerSVGElement;
    if (!d || !svg) return;
    const pt = svg.createSVGPoint();
    pt.x = ev.clientX;
    pt.y = ev.clientY;
    const ctm = svg.getScreenCTM();
    if (!ctm) return;
    const p = pt.matrixTransform(ctm.inverse());
    const { x, y, plotW } = dayScale(FRAME);
    const minute = ((p.x - FRAME.l) / plotW) * 1440;
    let best = 0;
    for (let i = 1; i < d.minutes.length; i++) {
      if (Math.abs(d.minutes[i] - minute) < Math.abs(d.minutes[best] - minute)) best = i;
    }
    if (d.minutes.length === 0 || Math.abs(d.minutes[best] - minute) > HOVER_REACH_MIN) {
      this.hover.set(null);
      return;
    }
    const m = d.minutes[best];
    const v = d.readings[best];
    const asleep = sleepSpansOnDay(d.day, d.tzOffset, this.store.periods()).some((s) => m >= s.from && m <= s.to);
    const ctx = asleep ? ' · dormindo' : '';
    const px = (x(m) / FRAME.w) * 100;
    const py = (y(v) / FRAME.h) * 100;
    this.hover.set({ x: x(m), y: y(v), px, py, text: `${hm(m)} · ${v} bpm${ctx}` });
  }

  protected onLeave(): void {
    this.hover.set(null);
  }

  /** Para o template: o rótulo do dia corrente (usado no aria e no teste). */
  protected readonly currentLabel = computed(() => {
    const d = this.current();
    return d ? dayLabel(d.day) : '';
  });
}
