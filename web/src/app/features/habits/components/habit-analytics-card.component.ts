import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { average, cleanStreak, daysInclusive, DEFAULT_HABIT_ICON, isOver, lastNDates, localDateStr, logsByDate, progress, streak, type CounterHabit, type HabitLog } from '@vitale/shared';
import { IconComponent } from '@core/services/icon.component';
import { HabitHeatmapComponent, type HeatCell } from './habit-heatmap.component';
import { habitAccent, habitCellColor } from './habit-cell-color';
import { RANGE_DAYS } from '../data/habits.store';

/**
 * Compat: hábitos antigos do mobile guardavam nomes Ionicons. Mapeia só os que
 * não existem no set canônico (`HABIT_ICONS`); os demais passam direto.
 */
const LEGACY_ICON_MAP: Record<string, string> = {
  water: 'droplet', cafe: 'coffee', fitness: 'dumbbell', bed: 'moon', nutrition: 'apple',
};

@Component({
  selector: 'rt-habit-analytics-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent, HabitHeatmapComponent],
  templateUrl: './habit-analytics-card.component.html',
  styleUrl: './habit-analytics-card.component.scss',
})
export class HabitAnalyticsCardComponent {
  readonly habit = input.required<CounterHabit>();
  readonly logs = input.required<HabitLog[]>();

  private readonly byDate = computed(() => logsByDate(this.logs()));

  protected accent(): string {
    return habitAccent(this.habit());
  }
  protected tint(): string {
    return `color-mix(in srgb, ${this.accent()} 14%, white)`;
  }
  protected icon(): string {
    const raw = this.habit().icon;
    return LEGACY_ICON_MAP[raw] ?? raw ?? DEFAULT_HABIT_ICON;
  }

  protected subtitle(): string {
    const h = this.habit();
    const tag = h.bad ? 'A evitar · ' : '';
    if (h.target == null) return `${tag}Contador · +${this.fmt(h.step)} ${h.unit}`;
    const goal = h.direction === 'at_least' ? 'Meta' : 'Limite';
    return `${tag}${goal} ${this.fmt(h.target)} ${h.unit}/dia`;
  }

  protected readonly today = computed(() => this.byDate().get(localDateStr()) ?? 0);

  /** Bom: dias consecutivos cumprindo a meta. Ruim: dias sem fazer (limitado à idade do hábito). */
  protected readonly streakDays = computed(() => {
    const h = this.habit();
    const today = localDateStr();
    if (h.bad) {
      const age = h.createdAt
        ? daysInclusive(localDateStr(new Date(h.createdAt)), today)
        : RANGE_DAYS;
      return cleanStreak(this.byDate(), today, Math.min(RANGE_DAYS, age));
    }
    return streak(h, this.byDate(), today, RANGE_DAYS);
  });

  protected streakLabel(): string {
    const n = this.streakDays();
    return this.habit().bad ? `🚫 ${n}d sem` : `🔥 ${n}d`;
  }
  protected streakTitle(): string {
    const n = this.streakDays();
    return this.habit().bad
      ? `${n} dia(s) sem fazer`
      : `${n} dia(s) seguidos cumprindo a meta`;
  }
  protected readonly pct = computed(() => progress(this.habit(), this.today()));
  protected readonly over = computed(() => isOver(this.habit(), this.today()));
  protected readonly avg30 = computed(() =>
    average(lastNDates(30).map((d) => this.byDate().get(d) ?? 0)),
  );

  protected readonly cells = computed<HeatCell[]>(() => {
    const h = this.habit();
    const by = this.byDate();
    return lastNDates(84).map((date) => {
      const value = by.get(date) ?? 0;
      return {
        date,
        color: habitCellColor(h, value),
        title: `${date}: ${this.fmt(value)} ${h.unit}`,
      };
    });
  });

  protected fmt(n: number): string {
    const r = Math.round(n * 100) / 100;
    const s = Number.isInteger(r) ? String(r) : r.toFixed(2).replace(/\.?0+$/, '');
    return s.replace('.', ',');
  }
}
