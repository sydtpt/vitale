import { ChangeDetectionStrategy, Component } from '@angular/core';
import { LIFTS } from '@core/models/mock-data';
import { T } from '@vitale/shared';

@Component({
  selector: 'rt-lifts-chart',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './lifts-chart.component.html',
  styleUrl: './lifts-chart.component.scss',
})
export class LiftsChartComponent {
  protected readonly w = 540;
  protected readonly h = 200;
  protected readonly padL = 70;
  protected readonly padR = 12;
  protected readonly padT = 14;
  protected readonly padB = 26;
  protected readonly colors = [T.primary, T.yellow, T.green, T.blue];
  protected readonly xLabels = [
    { text: '-5sm' }, { text: '-4' }, { text: '-3' }, { text: '-2' }, { text: '-1' }, { text: 'agora' },
  ];

  private readonly allVals = LIFTS.flatMap(l => l.history);
  private readonly min = Math.min(...this.allVals);
  private readonly max = Math.max(...this.allVals);

  protected readonly gridLines = [
    { v: this.min, y: this.yFor(this.min) },
    { v: Math.round((this.min + this.max) / 2), y: this.yFor((this.min + this.max) / 2) },
    { v: this.max, y: this.yFor(this.max) },
  ];

  protected readonly lifts = LIFTS.map(l => {
    const points = l.history.map((v, i) => ({
      cx: this.x(i), cy: this.yFor(v),
      r: i === l.history.length - 1 ? 4 : 2.5,
    }));
    const path = l.history.map((v, i) => `${i === 0 ? 'M' : 'L'}${this.x(i)},${this.yFor(v)}`).join(' ');
    return { ...l, points, path, delta: l.history[l.history.length - 1] - l.history[0] };
  });

  protected x(i: number): number {
    return this.padL + (i / 5) * (this.w - this.padL - this.padR);
  }
  private yFor(v: number): number {
    return this.padT + (1 - (v - this.min) / (this.max - this.min)) * (this.h - this.padT - this.padB);
  }
}
