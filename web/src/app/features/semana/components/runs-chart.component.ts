import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RUNS } from '@core/models/mock-data';
import { T } from '@vitale/shared';

@Component({
  selector: 'rt-runs-chart',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './runs-chart.component.html',
  styleUrl: './runs-chart.component.scss',
})
export class RunsChartComponent {
  protected readonly w = 360;
  protected readonly h = 200;
  protected readonly padL = 36;
  protected readonly padR = 12;
  protected readonly padT = 14;
  protected readonly padB = 26;

  private readonly max = Math.max(...RUNS.map(r => r.km));
  private readonly bw = (this.w - this.padL - this.padR) / RUNS.length;

  protected readonly grid = [
    { v: 0, y: this.yFor(0) },
    { v: Math.round(this.max / 2), y: this.yFor(this.max / 2) },
    { v: Math.round(this.max), y: this.yFor(this.max) },
  ];

  protected readonly bars = RUNS.map((r, i) => {
    const x = this.padL + i * this.bw + this.bw * 0.2;
    const width = this.bw * 0.6;
    const height = (r.km / this.max) * (this.h - this.padT - this.padB);
    const y = this.h - this.padB - height;
    return { week: r.week, km: r.km, x, y, w: width, h: height, cx: x + width / 2, color: i === RUNS.length - 1 ? T.primary : T.primarySoft };
  });

  private yFor(v: number): number {
    return this.padT + (1 - v / this.max) * (this.h - this.padT - this.padB);
  }
}
