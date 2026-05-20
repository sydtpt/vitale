import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import type { Metric, OverviewBucket } from '../data/overview';

interface Seg { x: number; y: number; w: number; h: number; color: string; label: string; }
interface Bar { key: string; label: string; cx: number; segs: Seg[]; topY: number; total: number; }
interface GridLine { y: number; label: string; }

@Component({
  selector: 'rt-stacked-bar-chart',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './stacked-bar-chart.component.html',
  styleUrl: './stacked-bar-chart.component.scss',
})
export class StackedBarChartComponent {
  readonly buckets = input.required<OverviewBucket[]>();
  readonly metric = input.required<Metric>();

  protected readonly w = 600;
  protected readonly h = 240;
  protected readonly padL = 40;
  protected readonly padR = 14;
  protected readonly padT = 18;
  protected readonly padB = 28;

  private readonly max = computed(() => Math.max(1, ...this.buckets().map((b) => b.total)));

  protected readonly bars = computed<Bar[]>(() => {
    const bs = this.buckets();
    const max = this.max();
    const plotH = this.h - this.padT - this.padB;
    const plotW = this.w - this.padL - this.padR;
    const bw = bs.length ? plotW / bs.length : plotW;
    const barW = Math.min(bw * 0.6, 42);

    return bs.map((b, i) => {
      const x = this.padL + i * bw + (bw - barW) / 2;
      let acc = 0;
      const segs: Seg[] = b.segments.map((s) => {
        const segH = (s.value / max) * plotH;
        acc += segH;
        const y = this.h - this.padB - acc;
        return { x, y, w: barW, h: segH, color: s.color, label: s.label };
      });
      const topY = this.h - this.padB - acc;
      return { key: b.key, label: b.label, cx: x + barW / 2, segs, topY, total: b.total };
    });
  });

  protected readonly grid = computed<GridLine[]>(() => {
    const max = this.max();
    const plotH = this.h - this.padT - this.padB;
    return [0, 0.5, 1].map((f) => ({
      y: this.h - this.padB - f * plotH,
      label: this.fmt(max * f),
    }));
  });

  protected fmt(v: number): string {
    switch (this.metric()) {
      case 'distance': return `${this.num(v / 1000, v >= 10000 ? 0 : 1)}km`;
      case 'duration': return `${this.num(v / 3600, v >= 36000 ? 0 : 1)}h`;
      case 'calories': return this.num(Math.round(v), 0);
      case 'count': return this.num(Math.round(v), 0);
    }
  }

  /** Formata com máscara de milhar (pt-BR) e nº fixo de casas decimais. */
  private num(v: number, digits: number): string {
    return v.toLocaleString('pt-BR', {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    });
  }
}
