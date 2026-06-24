import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import {
  healthMetricById,
  activityRecap, metricRecap, countRecap, buildWeekHighlights,
  type HighlightIcon, type WeekHighlight, type HealthHighlightInput,
} from '@vitale/shared';
import { IconComponent } from '@core/services/icon.component';
import { ActivitiesStore } from '@features/workout-history/data/activities.store';
import { HealthStore } from '@features/saude/data/health.store';
import { HabitsStore } from '@features/habits/data/habits.store';
import { RegistrosStore } from '@features/registros/data/registros.store';

/** Métricas de saúde no recap + polaridade (subir é pior?) e formatação. */
const HEALTH_METRICS: { metric: string; higherIsWorse: boolean; icon: HighlightIcon; decimals: number; unit: string }[] = [
  { metric: 'sono', higherIsWorse: false, icon: 'sleep', decimals: 1, unit: 'h' },
  { metric: 'fcRepouso', higherIsWorse: true, icon: 'heart', decimals: 0, unit: ' bpm' },
  { metric: 'vfc', higherIsWorse: false, icon: 'hrv', decimals: 0, unit: ' ms' },
];

/** Ícone neutro do shared → nome do set de ícones do web (`rt-icon`). */
const ICON_MAP: Record<HighlightIcon, string> = {
  workout: 'dumbbell', distance: 'run', sleep: 'moon', heart: 'heart',
  hrv: 'trend', habit: 'target', warning: 'flag', money: 'wallet',
};

@Component({
  selector: 'rt-week-highlights-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  templateUrl: './week-highlights-card.component.html',
  styleUrl: './week-highlights-card.component.scss',
})
export class WeekHighlightsCardComponent {
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

  protected readonly highlights = computed<WeekHighlight[]>(() => {
    this.health.state();

    const health: HealthHighlightInput[] = [];
    for (const m of HEALTH_METRICS) {
      const meta = healthMetricById(m.metric);
      if (!meta) continue;
      health.push({
        metric: m.metric,
        label: meta.label,
        recap: metricRecap(this.health.valuesByDay(m.metric), this.now),
        higherIsWorse: m.higherIsWorse,
        icon: m.icon,
        decimals: m.decimals,
        unit: m.unit,
      });
    }

    const goodHabits = this.habits.habits().filter((h) => !h.bad).map((h) => ({
      name: h.name,
      recap: countRecap(this.habits.logsFor(h.id).filter((l) => l.value > 0).map((l) => l.logDate), this.now),
    }));

    const badHabits = [
      ...this.habits.habits().filter((h) => h.bad).map((h) => ({
        name: h.name,
        recap: countRecap(this.habits.logsFor(h.id).filter((l) => l.value > 0).map((l) => l.logDate), this.now),
      })),
      ...this.registros.registros().map((r) => ({
        name: r.name,
        recap: countRecap(this.registros.logsFor(r.id).map((l) => l.logDate), this.now),
      })),
    ];

    return buildWeekHighlights({
      activities: activityRecap(this.activities.activities(), this.now),
      health,
      goodHabits,
      badHabits,
    }).slice(0, 5);
  });

  protected iconFor(icon: HighlightIcon): string {
    return ICON_MAP[icon];
  }
}
