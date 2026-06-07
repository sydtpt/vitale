import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { healthMetricById } from '@vitale/shared';
import { ActivitiesStore } from '@features/workout-history/data/activities.store';
import { HealthStore } from '@features/saude/data/health.store';
import { HabitsStore } from '@features/habits/data/habits.store';
import { RegistrosStore } from '@features/registros/data/registros.store';
import { formatHealthValue } from '@features/saude/data/health-format';
import { activityRecap, countRecap, metricRecap, weekLabel, type RecapValue } from '../data/weekly-recap';

/** Métricas de saúde no recap + polaridade (subir é pior?). */
const HEALTH_METRICS: { metric: string; higherIsWorse: boolean }[] = [
  { metric: 'fcRepouso', higherIsWorse: true },
  { metric: 'vfc', higherIsWorse: false },
  { metric: 'sono', higherIsWorse: false },
];

type Tone = 'good' | 'bad' | 'neutral';

interface StatVM { label: string; value: string; deltaStr: string; tone: Tone; }
interface TriggerVM { name: string; current: number; deltaStr: string; tone: Tone; }

/** Delta abaixo deste % (abs) é tratado como estável (neutro). */
const FLAT_PCT = 2;

@Component({
  selector: 'rt-weekly-recap-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './weekly-recap-card.component.html',
  styleUrl: './weekly-recap-card.component.scss',
})
export class WeeklyRecapCardComponent {
  private readonly activities = inject(ActivitiesStore);
  private readonly health = inject(HealthStore);
  private readonly habits = inject(HabitsStore);
  private readonly registros = inject(RegistrosStore);

  private readonly now = new Date();

  constructor() {
    void this.activities.load();
    void this.health.load();
    void this.habits.load();
    void this.registros.load();
  }

  protected readonly label = weekLabel(this.now);

  /** Treinos da semana — "mais" é bom (verde ao subir). */
  protected readonly workouts = computed<StatVM[]>(() => {
    const r = activityRecap(this.activities.activities(), this.now);
    return [
      this.stat('Treinos', r.count, (v) => `${Math.round(v)}`, false),
      this.stat('Distância', r.distanceM, (v) => `${(v / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} km`, false),
      this.stat('Tempo', r.durationS, (v) => this.fmtDur(v), false),
      this.stat('Calorias', r.calories, (v) => `${Math.round(v).toLocaleString('pt-BR')} kcal`, false),
    ];
  });

  protected readonly hasWorkouts = computed(() =>
    this.workouts().some((w) => w.value !== '0' && w.value !== '0 km' && w.value !== '0min' && w.value !== '0 kcal'),
  );

  /** Médias de saúde da semana vs anterior. */
  protected readonly healthRows = computed<StatVM[]>(() => {
    this.health.state();
    const out: StatVM[] = [];
    for (const { metric, higherIsWorse } of HEALTH_METRICS) {
      const meta = healthMetricById(metric);
      if (!meta) continue;
      const r = metricRecap(this.health.valuesByDay(metric), this.now);
      if (r.current == null) continue;
      out.push({
        label: meta.label,
        value: formatHealthValue(meta, r.current),
        deltaStr: r.delta == null ? '—' : `${this.sign(r.delta)}${formatHealthValue(meta, Math.abs(r.delta))}`,
        tone: this.toneFor(r.delta, r.deltaPct, higherIsWorse),
      });
    }
    return out;
  });

  /** Gatilhos (hábito-ruim/registro) com evento em alguma das duas semanas. */
  protected readonly triggers = computed<TriggerVM[]>(() => {
    const out: TriggerVM[] = [];

    for (const h of this.habits.habits().filter((x) => x.bad)) {
      const days = this.habits.logsFor(h.id).filter((l) => l.value > 0).map((l) => l.logDate);
      const r = countRecap(days, this.now);
      if (r.current === 0 && r.prior === 0) continue;
      out.push({ name: h.name, current: r.current, deltaStr: this.countDelta(r), tone: this.toneFor(r.delta, r.deltaPct, true) });
    }

    for (const reg of this.registros.registros()) {
      const days = this.registros.logsFor(reg.id).map((l) => l.logDate);
      const r = countRecap(days, this.now);
      if (r.current === 0 && r.prior === 0) continue;
      out.push({ name: reg.name, current: r.current, deltaStr: this.countDelta(r), tone: 'neutral' });
    }

    return out;
  });

  // ── helpers ────────────────────────────────────────────────

  private stat(label: string, r: RecapValue, fmt: (v: number) => string, higherIsWorse: boolean): StatVM {
    return {
      label,
      value: fmt(r.current),
      deltaStr: r.prior === 0 && r.current === 0 ? '—' : `${this.sign(r.delta)}${fmt(Math.abs(r.delta))}`,
      tone: this.toneFor(r.delta, r.deltaPct, higherIsWorse),
    };
  }

  private countDelta(r: RecapValue): string {
    if (r.delta === 0) return '=';
    return `${this.sign(r.delta)}${Math.abs(r.delta)}`;
  }

  private sign(n: number): string {
    return n >= 0 ? '+' : '−';
  }

  private toneFor(delta: number | null, deltaPct: number | null, higherIsWorse: boolean): Tone {
    if (delta == null || delta === 0) return 'neutral';
    if (deltaPct != null && Math.abs(deltaPct) < FLAT_PCT) return 'neutral';
    const worse = higherIsWorse ? delta > 0 : delta < 0;
    return worse ? 'bad' : 'good';
  }

  private fmtDur(s: number): string {
    const h = Math.floor(s / 3600);
    const m = Math.round((s % 3600) / 60);
    if (h > 0) return m > 0 ? `${h}h ${m}m` : `${h}h`;
    return `${m}min`;
  }
}
