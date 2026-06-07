import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { PanelComponent } from '@shared/components/panel/panel.component';
import type { LoadRecoveryWeek } from '@vitale/shared';

interface BarVM { x: number; y: number; w: number; h: number; label: string; hardMin: number; dip: boolean; }
interface DotVM { x: number; y: number; recovery: number; }

/** Card 1 — barras de carga forte (Z4+Z5/sem) + linha de prontidão média da semana. */
@Component({
  selector: 'rt-load-recovery-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PanelComponent],
  template: `
    <rt-panel title="Carga vs recuperação · 8 semanas">
      @if (isEmpty()) {
        <div class="empty">Sem carga de FC ou prontidão suficiente nas últimas semanas.</div>
      } @else {
        <div class="legend">
          <span class="k"><i class="sw load"></i> carga forte (min)</span>
          <span class="k"><i class="sw rec"></i> prontidão (0–100)</span>
        </div>
        <svg [attr.viewBox]="'0 0 ' + W + ' ' + H" class="chart">
          <line [attr.x1]="padL" [attr.x2]="W - padR" [attr.y1]="baseY" [attr.y2]="baseY" stroke="#EFE6D8"/>
          @for (b of bars(); track b.label) {
            <rect [attr.x]="b.x" [attr.y]="b.y" [attr.width]="b.w" [attr.height]="b.h" rx="3" fill="#F25C2B" [attr.fill-opacity]="b.dip ? 0.85 : 0.5"/>
            <text [attr.x]="b.x + b.w / 2" [attr.y]="H - 8" text-anchor="middle" font-size="9" fill="#9C928A">{{ b.label }}</text>
            @if (b.dip) {
              <text [attr.x]="b.x + b.w / 2" [attr.y]="padT - 2" text-anchor="middle" font-size="10" fill="#E26A8A">▾</text>
            }
          }
          @if (linePath()) {
            <path [attr.d]="linePath()" fill="none" stroke="#6FA86A" stroke-width="2" stroke-linejoin="round"/>
          }
          @for (d of dots(); track d.x) {
            <circle [attr.cx]="d.x" [attr.cy]="d.y" r="2.6" fill="#6FA86A"/>
          }
        </svg>
        <div class="hint">▾ recuperação caiu após semana de carga alta</div>
      }
    </rt-panel>
  `,
  styles: [`
    .chart { width: 100%; height: 190px; }
    .legend { display: flex; gap: 16px; margin-bottom: 6px; }
    .k { font-size: 11px; color: var(--ink-2); display: flex; align-items: center; gap: 5px; }
    .sw { width: 10px; height: 10px; border-radius: 3px; display: inline-block; }
    .sw.load { background: #F25C2B; opacity: 0.6; }
    .sw.rec { background: #6FA86A; }
    .hint { font-size: 11px; color: var(--ink-3); margin-top: 4px; }
    .empty { font-size: 13px; color: var(--ink-3); padding: 16px 0; }
  `],
})
export class LoadRecoveryCardComponent {
  readonly weeks = input<LoadRecoveryWeek[]>([]);

  protected readonly W = 360;
  protected readonly H = 190;
  protected readonly padL = 30;
  protected readonly padR = 12;
  protected readonly padT = 16;
  protected readonly padB = 24;
  protected readonly baseY = this.H - this.padB;

  protected readonly isEmpty = computed(() =>
    this.weeks().every((w) => w.hardMin === 0 && w.recovery == null),
  );

  private readonly maxHard = computed(() => Math.max(1, ...this.weeks().map((w) => w.hardMin)));

  private slotW(): number {
    return (this.W - this.padL - this.padR) / Math.max(1, this.weeks().length);
  }

  protected readonly bars = computed<BarVM[]>(() => {
    const max = this.maxHard();
    const slot = this.slotW();
    const plotH = this.baseY - this.padT;
    return this.weeks().map((w, i) => {
      const bw = slot * 0.5;
      const x = this.padL + i * slot + (slot - bw) / 2;
      const h = (w.hardMin / max) * plotH;
      return { x, y: this.baseY - h, w: bw, h, label: w.label, hardMin: w.hardMin, dip: w.dip };
    });
  });

  /** Recuperação (0–100) mapeada na mesma área de plot. */
  protected readonly dots = computed<DotVM[]>(() => {
    const slot = this.slotW();
    const plotH = this.baseY - this.padT;
    const out: DotVM[] = [];
    this.weeks().forEach((w, i) => {
      if (w.recovery == null) return;
      const x = this.padL + i * slot + slot / 2;
      const y = this.baseY - (w.recovery / 100) * plotH;
      out.push({ x, y, recovery: w.recovery });
    });
    return out;
  });

  protected readonly linePath = computed(() => {
    const d = this.dots();
    if (d.length < 2) return '';
    return d.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  });
}
