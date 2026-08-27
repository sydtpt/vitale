import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { totalsDelta } from '@vitale/shared';
import { IconComponent } from '@core/services/icon.component';
import type { TypeSummary } from '../data/type-summary';

/** Caixa da sparkline, em unidades do SVG. */
const SPARK_W = 72;
const SPARK_H = 24;

interface SparkBar { key: string; x: number; y: number; w: number; h: number; }

@Component({
  selector: 'rt-activity-type-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, IconComponent],
  templateUrl: './activity-type-card.component.html',
  styleUrl: './activity-type-card.component.scss',
})
export class ActivityTypeCardComponent {
  readonly s = input.required<TypeSummary>();

  protected readonly w = SPARK_W;
  protected readonly h = SPARK_H;

  /**
   * A sparkline só aparece quando há o que comparar. Um tipo parado há meses
   * renderizaria seis barras de altura zero — uma linha reta que parece um bug e
   * não informa nada que a contagem do card já não diga.
   */
  protected readonly hasSpark = computed(() => {
    const t = this.s().trend;
    return t.total > 0 || t.previousTotal > 0;
  });

  protected readonly bars = computed<SparkBar[]>(() => {
    const bs = this.s().trend.buckets;
    const max = Math.max(1, ...bs.map((b) => b.value));
    const slot = SPARK_W / bs.length;
    const width = Math.max(2, slot * 0.62);
    return bs.map((b, i) => {
      // Mínimo de 1,5: uma semana fraca existe e some se a altura for só proporcional.
      const height = b.value > 0 ? Math.max(1.5, (b.value / max) * SPARK_H) : 0;
      return {
        key: b.key,
        x: i * slot + (slot - width) / 2,
        y: SPARK_H - height,
        w: width,
        h: height,
      };
    });
  });

  /** `null` sem base: crescer a partir do nada não é "↑ 100%". */
  protected readonly delta = computed(() =>
    totalsDelta(this.s().trend.total, this.s().trend.previousTotal),
  );

  protected abs(n: number): number {
    return Math.abs(n);
  }

  protected tint(color: string): string {
    return `color-mix(in srgb, ${color} 14%, white)`;
  }

  protected fmtKm(m: number): string {
    return (m / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 });
  }

  protected fmtDuration(s: number): string {
    const h = Math.floor(s / 3600);
    const min = Math.round((s % 3600) / 60);
    return h > 0 ? `${h}h ${min}m` : `${min}m`;
  }

  protected fmtKcal(c: number): string {
    return `${Math.round(c).toLocaleString('pt-BR')} kcal`;
  }
}
