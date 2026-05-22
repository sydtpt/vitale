import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { computeReadiness, rollingBaseline, type ReadinessInput } from '@vitale/shared';
import { HealthStore } from '@features/saude/data/health.store';

/** Cor por componente do score (concêntrico no donut). */
const COMP_COLOR: Record<string, string> = {
  sono: '#6E8CC9',
  fcRepouso: '#E26A8A',
  vfc: '#6FA86A',
  aneis: '#F25C2B',
};

interface RingVM { color: string; r: number; score: number; }
interface RowVM { color: string; label: string; sub: string; cur: string; }

@Component({
  selector: 'rt-day-score-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './day-score-card.component.html',
  styleUrl: './day-score-card.component.scss',
})
export class DayScoreCardComponent {
  private readonly store = inject(HealthStore);

  constructor() {
    void this.store.load(); // idempotente; carrega se a Semana abrir antes da Saúde
  }

  private latest(metric: string): number | null {
    return this.store.latestFor(metric)?.value ?? null;
  }

  /** Baseline = média móvel recente excluindo o dia corrente (fallback: único valor). */
  private baseline(metric: string): number | null {
    const vals = this.store.seriesFor(metric).map((d) => d.value);
    if (vals.length === 0) return null;
    if (vals.length === 1) return vals[0];
    return rollingBaseline(vals.slice(0, -1), 7);
  }

  private ringsPct(): number[] {
    const e = this.store.latestFor('aneis')?.extra as
      | Record<string, { value?: number; goal?: number }>
      | undefined;
    if (!e) return [];
    return ['move', 'exercise', 'stand'].map((k) => {
      const ring = e[k];
      return ring?.goal ? (ring.value ?? 0) / ring.goal : 0;
    });
  }

  protected readonly inputs = computed<ReadinessInput>(() => {
    this.store.state(); // recalcula quando os dados carregam
    return {
      sleepHours: this.latest('sono'),
      restingHr: this.latest('fcRepouso'),
      restingHrBaseline: this.baseline('fcRepouso'),
      hrv: this.latest('vfc'),
      hrvBaseline: this.baseline('vfc'),
      ringsPct: this.ringsPct(),
    };
  });

  protected readonly score = computed(() => computeReadiness(this.inputs()));
  protected readonly total = computed(() => this.score().total);
  protected readonly hasData = computed(() => this.score().components.length > 0);

  protected readonly rings = computed<RingVM[]>(() =>
    this.score().components.map((c, i) => ({
      color: COMP_COLOR[c.key] ?? '#F25C2B',
      r: 68 - i * 14,
      score: c.score,
    })),
  );

  protected readonly rows = computed<RowVM[]>(() =>
    this.score().components.map((c) => ({
      color: COMP_COLOR[c.key] ?? '#F25C2B',
      label: c.label,
      sub: this.sub(c.key),
      cur: `${Math.round(c.score)}%`,
    })),
  );

  private sub(key: string): string {
    switch (key) {
      case 'sono': {
        const h = this.latest('sono');
        return h == null ? '' : this.fmtHours(h);
      }
      case 'fcRepouso': {
        const v = this.latest('fcRepouso');
        return v == null ? '' : `${Math.round(v)} bpm`;
      }
      case 'vfc': {
        const v = this.latest('vfc');
        return v == null ? '' : `${Math.round(v)} ms`;
      }
      case 'aneis':
        return 'anéis de atividade';
      default:
        return '';
    }
  }

  private fmtHours(hours: number): string {
    const h = Math.floor(hours);
    const m = Math.round((hours - h) * 60);
    if (h > 0) return m > 0 ? `${h}h ${m}min` : `${h}h`;
    return `${m}min`;
  }

  dash(val: number, r: number): string {
    const C = 2 * Math.PI * r;
    return `${(val / 100) * C} ${C}`;
  }
}
