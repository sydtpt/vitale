import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import {
  SLEEP_AXIS_ORIGIN_H,
  axisRange,
  buildAwakeClock,
  peakAwakeWindow,
  toTimingBar,
  type SleepPeriod,
} from '@vitale/shared';

interface BinVM { x: number; w: number; opacity: number; }
interface TickVM { x: number; label: string; }

const W = 640;
const H = 64;
const PAD_BOTTOM = 16;

/**
 * O relógio de vigília: os despertares de todas as noites da janela sobrepostos
 * num eixo de hora do dia, por densidade. Responde "eu acordo sempre às 3h?".
 *
 * Três estados, e a tela diz qual é: a fonte não reporta, reporta e não houve,
 * reporta e houve. Sem score, sem índice — o dado do usuário mostra vigília × nota
 * correndo ao contrário do que um score assumiria (spec §6).
 */
@Component({
  selector: 'rt-awakenings-clock',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @switch (clock().coverage) {
      @case ('unreported') {
        <p class="note">Seu relógio não reporta despertares — não dá para saber.</p>
      }
      @case ('none') {
        <p class="note">Nenhum despertar registrado nas últimas {{ clock().nightsReporting }} noites.</p>
      }
      @default {
        <svg [attr.viewBox]="'0 0 ' + w + ' ' + h" class="chart" role="img"
          aria-label="Densidade de despertares por hora da noite">
          @for (b of bins(); track b.x) {
            <rect class="bin" [attr.x]="b.x" y="0" [attr.width]="b.w" [attr.height]="innerH" [attr.opacity]="b.opacity" />
          }
          <line class="base" x1="0" [attr.x2]="w" [attr.y1]="innerH" [attr.y2]="innerH" />
          @for (t of ticks(); track t.label) {
            <text class="axis mono" [attr.x]="t.x" [attr.y]="h - 3" text-anchor="middle">{{ t.label }}</text>
          }
        </svg>
        <p class="note">{{ peakText() }}</p>
      }
    }
  `,
  styles: [`
    :host { display: block; }
    .chart { width: 100%; height: auto; display: block; }
    .bin { fill: var(--role-blue); }
    .base { stroke: var(--line); stroke-width: 1; }
    .axis { font-size: 9.5px; fill: var(--ink-4); }
    .note { margin: 6px 0 0; font-size: 12.5px; line-height: 1.5; color: var(--ink-3); }
  `],
})
export class AwakeningsClockComponent {
  readonly periods = input.required<SleepPeriod[]>();

  protected readonly w = W;
  protected readonly h = H;
  protected readonly innerH = H - PAD_BOTTOM;

  protected readonly clock = computed(() => buildAwakeClock(this.periods()));
  private readonly range = computed(() => axisRange(this.periods().map(toTimingBar)));
  private x(pos: number): number {
    const r = this.range();
    return ((pos - r.from) / Math.max(r.to - r.from, 1)) * W;
  }

  protected readonly bins = computed<BinVM[]>(() => {
    const r = this.range();
    return this.clock().bins
      .filter((b) => b.to > r.from && b.from < r.to && b.nights > 0)
      .map((b) => {
        const x0 = this.x(Math.max(b.from, r.from));
        const x1 = this.x(Math.min(b.to, r.to));
        return { x: x0, w: Math.max(1, x1 - x0), opacity: 0.15 + 0.85 * b.density };
      });
  });

  protected readonly ticks = computed<TickVM[]>(() => {
    const r = this.range();
    const out: TickVM[] = [];
    for (let hh = Math.ceil(r.from / 2) * 2; hh <= r.to; hh += 2) {
      out.push({ x: this.x(hh), label: `${String((SLEEP_AXIS_ORIGIN_H + hh) % 24).padStart(2, '0')}h` });
    }
    return out;
  });

  protected readonly peakText = computed(() => {
    const c = this.clock();
    const peak = peakAwakeWindow(c);
    if (!peak) return `Sem horário que se repita nas ${c.nightsReporting} noites.`;
    const hour = Math.floor((SLEEP_AXIS_ORIGIN_H + peak.from) % 24);
    const min = Math.round((peak.from % 1) * 60);
    const hhmm = `${String(hour).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
    return `Mais frequente por volta de ${hhmm} — em ${peak.nights} de ${c.nightsReporting} noites.`;
  });
}
