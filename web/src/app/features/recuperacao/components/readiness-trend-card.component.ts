import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { PanelComponent } from '@shared/components/panel/panel.component';
import type { ReadinessPoint } from '@vitale/shared';

interface PtVM { x: number; y: number; }

/** Card 3 — prontidão diária (30/90 dias) com marcadores de treino. */
@Component({
  selector: 'rt-readiness-trend-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PanelComponent],
  template: `
    <rt-panel title="Tendência de prontidão">
      <div class="toolbar">
        <div class="seg">
          <button [class.on]="range() === 30" (click)="range.set(30)">30d</button>
          <button [class.on]="range() === 90" (click)="range.set(90)">90d</button>
        </div>
        <span class="leg"><i class="dot"></i> dia com treino</span>
      </div>
      @if (linePts().length < 2) {
        <div class="empty">Sem prontidão suficiente no período.</div>
      } @else {
        <svg [attr.viewBox]="'0 0 ' + W + ' ' + H" class="chart">
          @for (g of [0, 50, 100]; track g) {
            <line [attr.x1]="padL" [attr.x2]="W - padR" [attr.y1]="yFor(g)" [attr.y2]="yFor(g)" stroke="#EFE6D8" stroke-dasharray="3 3"/>
            <text [attr.x]="padL - 4" [attr.y]="yFor(g) + 3" text-anchor="end" font-size="9" fill="#9C928A">{{ g }}</text>
          }
          @if (areaPath()) { <path [attr.d]="areaPath()" fill="#6E8CC9" fill-opacity="0.12"/> }
          <path [attr.d]="linePath()" fill="none" stroke="#6E8CC9" stroke-width="2" stroke-linejoin="round"/>
          @for (m of markers(); track m.x) {
            <circle [attr.cx]="m.x" [attr.cy]="H - padB + 6" r="1.7" fill="#F25C2B"/>
          }
        </svg>
        <div class="foot">{{ first() }} → {{ last() }} · prontidão média {{ avg() }}</div>
      }
    </rt-panel>
  `,
  styles: [`
    .chart { width: 100%; height: 190px; }
    .toolbar { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; }
    .seg { display: inline-flex; border: 1px solid var(--line); border-radius: 8px; overflow: hidden; }
    .seg button { border: none; background: var(--surface); color: var(--ink-2); font-size: 12px; font-weight: 600; padding: 4px 12px; cursor: pointer; }
    .seg button.on { background: var(--primary); color: #fff; }
    .leg { font-size: 11px; color: var(--ink-3); display: flex; align-items: center; gap: 5px; }
    .dot { width: 7px; height: 7px; border-radius: 50%; background: #F25C2B; display: inline-block; }
    .foot { font-size: 11px; color: var(--ink-3); margin-top: 4px; }
    .empty { font-size: 13px; color: var(--ink-3); padding: 16px 0; }
  `],
})
export class ReadinessTrendCardComponent {
  readonly points30 = input<ReadinessPoint[]>([]);
  readonly points90 = input<ReadinessPoint[]>([]);
  protected readonly range = signal<30 | 90>(30);

  protected readonly W = 360;
  protected readonly H = 190;
  protected readonly padL = 26;
  protected readonly padR = 12;
  protected readonly padT = 12;
  protected readonly padB = 22;

  private readonly points = computed(() => (this.range() === 30 ? this.points30() : this.points90()));

  private xFor(i: number, n: number): number {
    return this.padL + (i / Math.max(1, n - 1)) * (this.W - this.padL - this.padR);
  }
  protected yFor(score: number): number {
    return this.padT + (1 - score / 100) * (this.H - this.padT - this.padB);
  }

  /** Pontos com score (gaps de dias sem dado são pulados). */
  protected readonly linePts = computed<PtVM[]>(() => {
    const pts = this.points();
    const n = pts.length;
    const out: PtVM[] = [];
    pts.forEach((p, i) => {
      if (p.score == null) return;
      out.push({ x: this.xFor(i, n), y: this.yFor(p.score) });
    });
    return out;
  });

  protected readonly markers = computed<PtVM[]>(() => {
    const pts = this.points();
    const n = pts.length;
    const out: PtVM[] = [];
    pts.forEach((p, i) => { if (p.hasActivity) out.push({ x: this.xFor(i, n), y: 0 }); });
    return out;
  });

  protected readonly linePath = computed(() =>
    this.linePts().map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' '),
  );

  protected readonly areaPath = computed(() => {
    const p = this.linePts();
    if (p.length < 2) return '';
    const base = this.H - this.padB;
    return `${this.linePath()} L${p[p.length - 1].x.toFixed(1)},${base} L${p[0].x.toFixed(1)},${base} Z`;
  });

  protected readonly avg = computed(() => {
    const vals = this.points().map((p) => p.score).filter((s): s is number => s != null);
    return vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : 0;
  });
  protected first(): string { return this.points()[0]?.label ?? ''; }
  protected last(): string { const p = this.points(); return p[p.length - 1]?.label ?? ''; }
}
