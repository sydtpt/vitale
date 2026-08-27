import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { localDateStr, weekBounds, type CounterHabit } from '@vitale/shared';
import { HabitsStore } from '@features/habits/data/habits.store';
import { HABIT_CELL_EMPTY, habitAccent, habitCellColor } from '@features/habits/components/habit-cell-color';

interface CellVM {
  date: string;
  color: string;
  title: string;
  today: boolean;
  future: boolean;
}
interface RowVM {
  id: string;
  name: string;
  accent: string;
  cells: CellVM[];
}

const DAY_MS = 24 * 60 * 60 * 1000;
const DOW = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];

/**
 * Os hábitos da semana corrente — um hábito por linha, um dia por coluna.
 *
 * Substitui o `rt-heatmap`, que desenhava a constante `HEATMAP` do
 * `mock-data.ts`: uma grade inventada, ao lado de painéis com número
 * sincronizado, na mesma tela. Quem olha não tem como saber qual é qual, e o
 * custo disso não é estético — é o painel inteiro perder credibilidade.
 *
 * **A comparação usa o mesmo número de dias.** Numa terça-feira, os check-ins de
 * segunda e terça são comparados com os de segunda e terça da semana passada, e
 * não com a semana passada inteira: comparar dois dias com sete diria que se
 * desabou toda segunda-feira.
 */
@Component({
  selector: 'rt-habits-week-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  templateUrl: './habits-week-card.component.html',
  styleUrl: './habits-week-card.component.scss',
})
export class HabitsWeekCardComponent {
  private readonly store = inject(HabitsStore);

  protected readonly dow = DOW;
  protected readonly empty = HABIT_CELL_EMPTY;
  protected readonly loading = this.store.loading;

  private readonly today = computed(() => localDateStr());

  /** Segunda a domingo da semana corrente, em 'YYYY-MM-DD' local. */
  private readonly days = computed(() => {
    const { start } = weekBounds(new Date(), 0);
    return Array.from({ length: 7 }, (_, i) => localDateStr(new Date(start.getTime() + i * DAY_MS)));
  });

  private readonly activeHabits = computed(() => this.store.habits().filter((h) => h.active));

  protected readonly rows = computed<RowVM[]>(() => {
    const today = this.today();
    return this.activeHabits().map((h) => ({
      id: h.id,
      name: h.name,
      accent: habitAccent(h),
      cells: this.days().map((date) => {
        const value = this.store.valueOn(h.id, date);
        return {
          date,
          color: date > today ? 'transparent' : habitCellColor(h, value),
          title: this.cellTitle(h, date, value, today),
          today: date === today,
          future: date > today,
        };
      }),
    }));
  });

  /** Check-ins da semana até hoje, e os mesmos dias da semana passada. */
  private readonly counts = computed(() => {
    const today = this.today();
    const elapsed = this.days().filter((d) => d <= today);
    const habits = this.activeHabits();

    const count = (dates: string[]) =>
      dates.reduce(
        (sum, d) => sum + habits.filter((h) => this.store.valueOn(h.id, d) > 0).length,
        0,
      );

    const prior = elapsed.map((d) =>
      localDateStr(new Date(new Date(`${d}T12:00:00`).getTime() - 7 * DAY_MS)),
    );
    return { current: count(elapsed), prior: count(prior), days: elapsed.length };
  });

  protected readonly checkins = computed(() => this.counts().current);
  protected readonly delta = computed(() => this.counts().current - this.counts().prior);
  protected readonly comparisonWord = computed(() => {
    const n = this.counts().days;
    return n === 7 ? 'a semana passada inteira' : `os mesmos ${n} dias da semana passada`;
  });

  protected abs(n: number): number {
    return Math.abs(n);
  }

  private cellTitle(h: CounterHabit, date: string, value: number, today: string): string {
    if (date > today) return `${date}: ainda não chegou`;
    const v = Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/\.?0+$/, '');
    return `${date} · ${h.name}: ${v.replace('.', ',')} ${h.unit}`;
  }
}
