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
  template: `
    <div class="card" [class.archived]="!habit().active">
      <div class="head">
        <span class="ico" [style.background]="tint()">
          <rt-icon [name]="icon()" [size]="18" [color]="accent()" [strokeWidth]="1.9" />
        </span>
        <div class="title">
          <div class="name">
            {{ habit().name }}
            @if (!habit().active) { <span class="badge">arquivado</span> }
          </div>
          <div class="sub">{{ subtitle() }}</div>
        </div>
        <div class="streak" [class.on]="streakDays() > 0" [title]="streakTitle()">{{ streakLabel() }}</div>
      </div>

      <div class="now">
        <span class="val">{{ fmt(today()) }}</span>
        @if (habit().target != null) {
          <span class="unit">/ {{ fmt(habit().target!) }} {{ habit().unit }}</span>
        } @else {
          <span class="unit">{{ habit().unit }} hoje</span>
        }
      </div>

      @if (habit().target != null) {
        <div class="bar">
          <div class="fill" [class.over]="over()" [style.width.%]="pct() * 100" [style.background]="accent()"></div>
        </div>
      }

      <div class="meta">média 30d: <strong>{{ fmt(avg30()) }} {{ habit().unit }}</strong></div>

      <rt-habit-heatmap [cells]="cells()" />
    </div>
  `,
  styles: [`
    .card {
      background: var(--surface);
      border: 1px solid var(--line);
      border-radius: 18px;
      padding: 16px;
      box-shadow: var(--shadow-card);
    }
    .card.archived { opacity: 0.7; }
    .head { display: flex; align-items: center; gap: 10px; }
    .ico {
      width: 38px; height: 38px; border-radius: 11px;
      display: flex; align-items: center; justify-content: center; flex: 0 0 auto;
    }
    .title { flex: 1; min-width: 0; }
    .name { font-size: 14.5px; font-weight: 650; color: var(--ink); display: flex; align-items: center; gap: 6px; }
    .badge {
      font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.3px;
      color: var(--ink-3); background: var(--surface-mute); padding: 1px 6px; border-radius: 6px;
    }
    .sub { font-size: 12px; color: var(--ink-3); margin-top: 1px; }
    .streak { font-size: 12px; font-weight: 600; color: var(--ink-4); white-space: nowrap; }
    .streak.on { color: var(--primary); }

    .now { margin-top: 14px; display: flex; align-items: baseline; gap: 6px; }
    .val { font-size: 26px; font-weight: 700; color: var(--ink); font-variant-numeric: tabular-nums; }
    .unit { font-size: 13px; color: var(--ink-3); }

    .bar { margin-top: 8px; height: 6px; border-radius: 3px; background: var(--surface-mute); overflow: hidden; }
    .fill { height: 6px; border-radius: 3px; transition: width 0.25s; }
    .fill.over { background: var(--primary-deep) !important; }

    .meta { margin-top: 10px; font-size: 12px; color: var(--ink-2); }
    .meta strong { color: var(--ink); font-weight: 600; }

    rt-habit-heatmap { margin-top: 12px; }
  `],
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
