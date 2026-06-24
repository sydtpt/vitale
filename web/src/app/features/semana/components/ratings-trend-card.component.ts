import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { T } from '@vitale/shared';
import { localDateStr } from '@features/saude/data/health-format';
import { DailyRatingsStore, type RatingKind } from '../data/daily-ratings.store';

interface Pt { cx: number; cy: number; }
interface SeriesVM { kind: RatingKind; label: string; color: string; path: string; points: Pt[]; avg: string | null; }

/** Tendência de 30 dias dos ratings subjetivos (sono + dia), escala fixa 1–5. */
@Component({
  selector: 'rt-ratings-trend-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './ratings-trend-card.component.html',
  styleUrl: './ratings-trend-card.component.scss',
})
export class RatingsTrendCardComponent {
  private readonly ratings = inject(DailyRatingsStore);

  protected readonly w = 540;
  protected readonly h = 200;
  protected readonly padL = 34;
  protected readonly padR = 12;
  protected readonly padT = 14;
  protected readonly padB = 26;

  private readonly DAYS = 30;

  constructor() {
    void this.ratings.load();
  }

  /** Datas (YYYY-MM-DD) do eixo X: últimos 30 dias terminando hoje. */
  private readonly days = ((): string[] => {
    const out: string[] = [];
    for (let i = this.DAYS - 1; i >= 0; i--) {
      out.push(localDateStr(new Date(Date.now() - i * 86400000)));
    }
    return out;
  })();

  protected readonly xLabels = [
    { text: '-30d', i: 0 },
    { text: '-15d', i: Math.floor((this.DAYS - 1) / 2) },
    { text: 'hoje', i: this.DAYS - 1 },
  ];

  protected readonly gridLines = [1, 3, 5].map((v) => ({ v, y: this.yFor(v) }));

  protected readonly series = computed<SeriesVM[]>(() => {
    const defs: { kind: RatingKind; label: string; color: string }[] = [
      { kind: 'sleep', label: 'Sono', color: T.blue },
      { kind: 'day', label: 'Dia', color: T.primary },
    ];
    return defs.map(({ kind, label, color }) => {
      const byDay = this.ratings.valuesByDay(kind);
      const points: Pt[] = [];
      let sum = 0;
      let n = 0;
      this.days.forEach((day, i) => {
        const v = byDay.get(day);
        if (v == null) return;
        points.push({ cx: this.x(i), cy: this.yFor(v) });
        sum += v;
        n += 1;
      });
      const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.cx},${p.cy}`).join(' ');
      return { kind, label, color, path, points, avg: n > 0 ? (sum / n).toFixed(1) : null };
    });
  });

  protected readonly hasData = computed(() => this.series().some((s) => s.points.length > 0));

  protected x(i: number): number {
    return this.padL + (i / (this.DAYS - 1)) * (this.w - this.padL - this.padR);
  }
  private yFor(v: number): number {
    return this.padT + (1 - (v - 1) / 4) * (this.h - this.padT - this.padB);
  }
}
