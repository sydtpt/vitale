import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  HEALTH_CATEGORIES,
  HEALTH_METRICS,
  correlate,
  detectAnomaly,
  detectTrend,
  healthMetricById,
  mean,
  stdDev,
  type HealthMetricMeta,
  type TrendDirection,
} from '@vitale/shared';
import { PageHeaderComponent } from '@shared/components/page-header/page-header.component';
import { PanelComponent } from '@shared/components/panel/panel.component';
import { HealthStore } from '../data/health.store';
import { formatHealthValue, localDateStr, sparkPoints } from '../data/health-format';

interface MetricVM {
  id: string;
  label: string;
  caption: string;
  latest: string;
  sub: string;
  spark: string;
  hasData: boolean;
}

interface CategoryVM {
  id: string;
  label: string;
  metrics: MetricVM[];
}

interface TrendVM {
  label: string;
  direction: TrendDirection;
  arrow: string;
  rate: string;
  latest: string;
  anomaly: boolean;
}

interface CorrelationVM {
  label: string;
  coefficient: number;
  text: string;
  n: number;
}

/** Métricas com visualização própria (não cabem no card simples de F1). */
const SKIP = new Set(['aneis', 'macros']);

/** Métricas com tendência relevante de acompanhar ao longo do tempo. */
const TREND_METRICS = ['peso', 'fcRepouso', 'vfc', 'vo2max', 'imc'];

/** Pares de correlação (ambos em health_daily). */
const CORRELATION_PAIRS: { a: string; b: string; label: string }[] = [
  { a: 'sono', b: 'fcRepouso', label: 'Sono × FC em repouso' },
  { a: 'exercicio', b: 'passos', label: 'Exercício × Passos' },
];

const ARROW: Record<TrendDirection, string> = { up: '↑', down: '↓', flat: '→' };

@Component({
  selector: 'rt-saude-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, PageHeaderComponent, PanelComponent],
  templateUrl: './saude-page.component.html',
  styleUrl: './saude-page.component.scss',
})
export class SaudePageComponent {
  protected readonly store = inject(HealthStore);

  /** Categorias com seus cards de métrica (só categorias com métricas a exibir). */
  protected readonly view = computed<CategoryVM[]>(() => {
    // Recalcula quando os dados mudam.
    this.store.state();
    return HEALTH_CATEGORIES.map((cat) => ({
      id: cat.id,
      label: cat.label,
      metrics: HEALTH_METRICS
        .filter((m) => m.category === cat.id && !SKIP.has(m.id))
        .map((m) => this.toVM(m)),
    })).filter((c) => c.metrics.length > 0);
  });

  /** Quantas métricas distintas têm dados na janela. */
  protected readonly trackedCount = computed(() => this.store.metricsPresent().size);

  /** Tendências (regressão linear) + anomalia do último valor para métricas-chave. */
  protected readonly trends = computed<TrendVM[]>(() => {
    this.store.state();
    const out: TrendVM[] = [];
    for (const id of TREND_METRICS) {
      const meta = healthMetricById(id);
      if (!meta) continue;
      const values = this.store
        .seriesFor(id)
        .map((d) => d.value)
        .filter((v): v is number => v != null);
      if (values.length < 3) continue;

      const t = detectTrend(values);
      const latest = values[values.length - 1];
      const prior = values.slice(0, -1);
      const anomaly = detectAnomaly(latest, mean(prior), stdDev(prior)).anomaly;

      out.push({
        label: meta.label,
        direction: t.direction,
        arrow: ARROW[t.direction],
        rate: `${t.relSlope >= 0 ? '+' : ''}${(t.relSlope * 7 * 100).toFixed(1)}%/sem`,
        latest: formatHealthValue(meta, latest),
        anomaly,
      });
    }
    return out;
  });

  /** Correlações entre pares de métricas (Pearson sobre dias pareados). */
  protected readonly correlations = computed<CorrelationVM[]>(() => {
    this.store.state();
    const out: CorrelationVM[] = [];
    for (const pair of CORRELATION_PAIRS) {
      const c = correlate(this.store.valuesByDay(pair.a), this.store.valuesByDay(pair.b));
      if (c.n < 3) continue;
      out.push({ label: pair.label, coefficient: c.coefficient, text: this.describeCorr(c.coefficient, c.n), n: c.n });
    }
    return out;
  });

  constructor() {
    void this.store.load();
  }

  private describeCorr(coef: number, n: number): string {
    const abs = Math.abs(coef);
    const strength = abs < 0.2 ? 'fraca' : abs < 0.5 ? 'moderada' : 'forte';
    const sign = coef >= 0 ? 'positiva' : 'negativa';
    return `Correlação ${strength} ${sign} (r=${coef.toFixed(2)}, ${n} dias)`;
  }

  private toVM(meta: HealthMetricMeta): MetricVM {
    const series = this.store.seriesFor(meta.id);
    const latest = this.store.latestFor(meta.id);
    const values = series.slice(-30).map((d) => d.value ?? 0);

    let latestStr = formatHealthValue(meta, latest?.value ?? null);
    let sub = '';

    if (meta.id === 'pressao' && latest?.extra) {
      const e = latest.extra as { sys?: number; dia?: number };
      if (Number.isFinite(e.sys) && Number.isFinite(e.dia)) {
        latestStr = `${Math.round(e.sys as number)}/${Math.round(e.dia as number)} mmHg`;
      }
    } else if (
      meta.kind === 'discrete' &&
      latest?.minValue != null &&
      latest?.maxValue != null &&
      latest.minValue !== latest.maxValue
    ) {
      sub = `${formatHealthValue(meta, latest.minValue)}–${formatHealthValue(meta, latest.maxValue)}`;
    }

    if (latest && !sub) sub = this.relDay(latest.day);

    return {
      id: meta.id,
      label: meta.label,
      caption: meta.caption ?? '',
      latest: latestStr,
      sub,
      spark: sparkPoints(values),
      hasData: latest != null,
    };
  }

  private relDay(day: string): string {
    if (day === localDateStr()) return 'Hoje';
    if (day === localDateStr(new Date(Date.now() - 86400000))) return 'Ontem';
    return new Date(`${day}T00:00:00`).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
  }
}
