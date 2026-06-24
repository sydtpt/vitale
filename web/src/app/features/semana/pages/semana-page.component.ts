import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { ProfileService } from '@core/auth/profile.service';
import { PageHeaderComponent } from '@shared/components/page-header/page-header.component';
import { PanelComponent } from '@shared/components/panel/panel.component';
import { HeatmapComponent } from '@shared/components/heatmap/heatmap.component';
import { BigStatComponent } from '../components/big-stat.component';
import { DayScoreCardComponent } from '../components/day-score-card.component';
import { WeeklyRecapCardComponent } from '../components/weekly-recap-card.component';
import { WeekHighlightsCardComponent } from '../components/week-highlights-card.component';
import { LiftsChartComponent } from '../components/lifts-chart.component';
import { RatingsTrendCardComponent } from '../components/ratings-trend-card.component';
import { MacrosCardComponent } from '../components/macros-card.component';
import { SpendByCategoryComponent, RecurringListComponent, CasaListComponent, MetasListComponent } from '../components/lists.component';
import { ActivitiesStore } from '@features/workout-history/data/activities.store';
import { HabitsStore } from '@features/habits/data/habits.store';
import { PlannedWorkoutsStore } from '@features/treinos/data/planned-workouts.store';
import { T, activityRecap, weekBounds } from '@vitale/shared';

@Component({
  selector: 'rt-semana-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    PageHeaderComponent, PanelComponent, HeatmapComponent,
    BigStatComponent, DayScoreCardComponent, WeeklyRecapCardComponent, WeekHighlightsCardComponent,
    LiftsChartComponent, RatingsTrendCardComponent, MacrosCardComponent,
    SpendByCategoryComponent, RecurringListComponent, CasaListComponent, MetasListComponent,
  ],
  templateUrl: './semana-page.component.html',
  styleUrl: './semana-page.component.scss',
})
export class SemanaPageComponent {
  protected readonly T = T;

  private readonly profile = inject(ProfileService);
  private readonly activities = inject(ActivitiesStore);
  private readonly habits = inject(HabitsStore);
  private readonly planned = inject(PlannedWorkoutsStore);

  private readonly now = new Date();

  constructor() {
    void this.activities.load();
    void this.habits.load();
    void this.planned.load();
  }

  protected readonly greeting = computed(() => {
    const h = new Date().getHours();
    const period = h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite';
    const firstName = this.profile.displayName().split(' ')[0];
    return `${period}, ${firstName}.`;
  });

  /** Eyebrow do header: intervalo da semana corrente (seg–dom). */
  protected readonly weekRange = computed(() => {
    const { start } = weekBounds(this.now, 0);
    const sun = new Date(start.getTime() + 6 * 24 * 60 * 60 * 1000);
    const fmt = (d: Date) => d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
    return `${fmt(start)} — ${fmt(sun)}`;
  });

  /** Treinos da semana: concluídos / planejados (cai p/ atividades se não há plano). */
  protected readonly treinos = computed(() => {
    const planned = this.planned.planned().filter((p) => p.kind !== 'rest');
    const total = planned.length;
    if (total === 0) {
      const done = activityRecap(this.activities.activities(), this.now).count.current;
      return { value: done, suffix: undefined as string | undefined, pct: undefined as string | undefined };
    }
    const done = planned.filter((p) => p.done).length;
    return { value: done, suffix: `/ ${total}`, pct: `${Math.round((done / total) * 100)}%` };
  });

  /** Hábitos: check-ins da semana / possíveis (hábitos bons × 7 dias). */
  protected readonly habitos = computed(() => {
    const { start, end } = weekBounds(this.now, 0);
    const lo = start.getTime();
    const hi = end.getTime();
    const good = this.habits.habits().filter((h) => !h.bad);
    let checkins = 0;
    for (const h of good) {
      for (const l of this.habits.logsFor(h.id)) {
        if (l.value <= 0) continue;
        const ts = new Date(`${l.logDate}T00:00:00`).getTime();
        if (ts >= lo && ts < hi) checkins += 1;
      }
    }
    const total = good.length * 7;
    return {
      value: checkins,
      suffix: total > 0 ? `/ ${total}` : undefined,
      pct: total > 0 ? `${Math.round((checkins / total) * 100)}%` : undefined,
    };
  });
}
