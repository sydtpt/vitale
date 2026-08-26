import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { computeReadiness, rollingBaseline, readinessAdvice, type ReadinessInput } from '@vitale/shared';
import { HealthStore } from '@features/saude/data/health.store';
import { PlannedWorkoutsStore } from '@features/treinos/data/planned-workouts.store';
import { ChartPaletteService } from '@core/services/chart-palette.service';

/**
 * Cor por componente do score (concêntrico no donut), no vocabulário-base do
 * Orbe. Não é a cor final: `ChartPaletteService.remap()` a traduz para a paleta
 * e o esquema ativos antes de chegar ao SVG.
 */
const COMP_COLOR: Record<string, string> = {
  sono: '#6E8CC9',
  fcRepouso: '#E26A8A',
  vfc: '#6FA86A',
  aneis: '#F25C2B',
};

/** `track` = o mesmo tom da série a 13% de opacidade (sulco do anel). */
interface RingVM { color: string; track: string; r: number; score: number; }
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
  private readonly planner = inject(PlannedWorkoutsStore);
  private readonly palette = inject(ChartPaletteService);

  constructor() {
    void this.store.load(); // idempotente; carrega se a Semana abrir antes da Saúde
    void this.planner.load(); // treino planejado de hoje p/ a recomendação
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

  /** Recomendação acionável: prontidão × intensidade do treino planejado de hoje. */
  protected readonly advice = computed(() => {
    const today = this.planner.today();
    return readinessAdvice(this.total(), this.hasData(), today?.kind ?? 'none', today?.type ?? '');
  });

  /** Cor da série já traduzida para a paleta e o esquema ativos. */
  private colorOf(key: string): string {
    return this.palette.remap(COMP_COLOR[key] ?? '#F25C2B');
  }

  protected readonly rings = computed<RingVM[]>(() =>
    this.score().components.map((c, i) => {
      const color = this.colorOf(c.key);
      // O sulco vem do hex de 8 dígitos sobre a cor **remapeada**: concatenar
      // alfa só é seguro depois do remap, que sempre devolve hex.
      return { color, track: `${color}22`, r: 68 - i * 14, score: c.score };
    }),
  );

  protected readonly rows = computed<RowVM[]>(() =>
    this.score().components.map((c) => ({
      color: this.colorOf(c.key),
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
