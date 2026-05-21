import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { MOD, type CounterHabit, type HabitLog } from '@vitale/shared';
import { IconComponent } from '@core/services/icon.component';
import { HabitHeatmapComponent, type HeatCell } from './habit-heatmap.component';
import { RANGE_DAYS } from '../data/habits.store';
import {
  average,
  cleanStreak,
  daysInclusive,
  isOver,
  lastNDates,
  localDateStr,
  logsByDate,
  progress,
  streak,
} from '../data/habit-logic';

/** Mapeia o ícone do mobile (Ionicons) para o set do `rt-icon` do web. */
const ICON_MAP: Record<string, string> = {
  water: 'droplet', cafe: 'droplet', wine: 'droplet', beer: 'droplet',
  flame: 'flame', fitness: 'dumbbell', walk: 'walk', bed: 'moon',
  book: 'book', leaf: 'leaf', nutrition: 'fork', heart: 'flame',
};

const EMPTY = 'var(--surface-mute)';

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
    return (MOD as Record<string, { accent: string }>)[this.habit().color]?.accent ?? MOD.habito.accent;
  }
  protected tint(): string {
    return `color-mix(in srgb, ${this.accent()} 14%, white)`;
  }
  protected icon(): string {
    return ICON_MAP[this.habit().icon] ?? 'droplet';
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
        color: this.cellColor(value),
        title: `${date}: ${this.fmt(value)} ${h.unit}`,
      };
    });
  });

  private cellColor(value: number): string {
    const h = this.habit();
    // Hábito ruim: qualquer dia com registro é uma recaída (vermelho); dia limpo fica vazio.
    if (h.bad) return value > 0 ? 'var(--primary-deep)' : EMPTY;
    const acc = this.accent();
    const mix = (pct: number) => `color-mix(in srgb, ${acc} ${Math.round(pct)}%, white)`;
    if (value <= 0) return EMPTY;
    if (h.target == null || h.target <= 0) return mix(45);
    if (h.direction === 'at_least') {
      const p = Math.min(1, value / h.target);
      return mix(25 + p * 60);
    }
    // at_most: dentro do limite preenche suave; acima vira vermelho
    if (value > h.target) return 'var(--primary-deep)';
    const p = value / h.target;
    return mix(25 + p * 55);
  }

  protected fmt(n: number): string {
    const r = Math.round(n * 100) / 100;
    const s = Number.isInteger(r) ? String(r) : r.toFixed(2).replace(/\.?0+$/, '');
    return s.replace('.', ',');
  }
}
