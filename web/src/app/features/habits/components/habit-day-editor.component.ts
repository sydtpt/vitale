import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import type { CounterHabit } from '@vitale/shared';
import { HabitsStore } from '../data/habits.store';
import { HabitStepperComponent } from './habit-stepper.component';
import { MonthCalendarComponent } from './month-calendar.component';

const DATE_FMT = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });

/**
 * Edição de dados passados: calendário no topo, steppers de todos os hábitos
 * ativos para o dia escolhido (rascunho local) e Cancelar/Salvar no rodapé.
 */
@Component({
  selector: 'rt-habit-day-editor',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [HabitStepperComponent, MonthCalendarComponent],
  template: `
    <div class="wrap">
      <rt-month-calendar
        [selected]="selected()"
        [marked]="markedDates()"
        (daySelected)="pickDay($event)"
        (monthChanged)="onMonth($event)"
      />

      @if (selected(); as date) {
        <div class="panel">
          <h3 class="day-title">{{ dateLabel() }}</h3>

          @if (activeHabits().length === 0) {
            <p class="hint">Nenhum hábito ativo para editar.</p>
          } @else {
            <div class="steppers">
              @for (h of activeHabits(); track h.id) {
                <rt-habit-stepper
                  [habit]="h"
                  [value]="valueOf(h.id)"
                  (increment)="bump(h, +1)"
                  (decrement)="bump(h, -1)"
                />
              }
            </div>
          }

          <div class="footer">
            <button class="btn ghost" type="button" (click)="cancel()" [disabled]="saving()">Cancelar</button>
            <button class="btn primary" type="button" (click)="save()" [disabled]="!dirty() || saving()">
              {{ saving() ? 'Salvando…' : 'Salvar' }}
            </button>
          </div>
        </div>
      } @else {
        <p class="hint pick">Selecione um dia no calendário para editar os valores.</p>
      }
    </div>
  `,
  styles: [`
    :host { display: block; }
    .wrap { max-width: 460px; margin: 0 auto; display: flex; flex-direction: column; gap: 16px; }
    .panel { display: flex; flex-direction: column; gap: 12px; }
    .day-title { font-size: 14px; font-weight: 650; color: var(--ink); text-transform: capitalize; margin: 0; }
    .steppers { display: flex; flex-direction: column; gap: 8px; }
    .footer { display: flex; gap: 10px; margin-top: 4px; }
    .btn {
      flex: 1; padding: 11px 16px; border-radius: 12px; font-size: 14px; font-weight: 600; cursor: pointer;
      border: 1px solid var(--line); transition: opacity 0.15s;
    }
    .btn:disabled { opacity: 0.5; cursor: default; }
    .btn.ghost { background: var(--surface); color: var(--ink-2); }
    .btn.ghost:hover:not(:disabled) { background: var(--surface-mute); }
    .btn.primary { background: var(--primary); color: #fff; border-color: var(--primary); }
    .btn.primary:hover:not(:disabled) { opacity: 0.9; }
    .hint { font-size: 13px; color: var(--ink-3); }
    .hint.pick { text-align: center; padding: 8px 0; }
  `],
})
export class HabitDayEditorComponent {
  protected readonly store = inject(HabitsStore);

  protected readonly selected = signal<string | null>(null);
  private readonly draft = signal<Map<string, number>>(new Map());
  protected readonly saving = signal(false);

  /** Hábitos ativos, na ordem da store (ativos primeiro, depois `sort`). */
  protected readonly activeHabits = computed(() => this.store.habits().filter(h => h.active));

  /** Dias com algum registro carregado — pontinho no calendário. */
  protected readonly markedDates = computed(() => {
    const set = new Set<string>();
    for (const h of this.store.habits()) {
      for (const l of this.store.logsFor(h.id)) if (l.value > 0) set.add(l.logDate);
    }
    return set;
  });

  protected readonly dirty = computed(() => {
    const date = this.selected();
    if (!date) return false;
    const d = this.draft();
    return this.activeHabits().some(h => (d.get(h.id) ?? 0) !== this.store.valueOn(h.id, date));
  });

  protected readonly dateLabel = computed(() => {
    const date = this.selected();
    return date ? DATE_FMT.format(new Date(`${date}T00:00:00`)) : '';
  });

  protected valueOf(habitId: string): number {
    return this.draft().get(habitId) ?? 0;
  }

  protected pickDay(date: string): void {
    this.selected.set(date);
    this.rebuildDraft(date);
  }

  protected async onMonth(ev: { year: number; monthIdx: number }): Promise<void> {
    try {
      await this.store.loadMonth(ev.year, ev.monthIdx);
      const date = this.selected();
      if (date) this.rebuildDraft(date);
    } catch (e) {
      console.error('Erro ao carregar mês:', e);
    }
  }

  protected bump(habit: CounterHabit, dir: 1 | -1): void {
    const cur = this.valueOf(habit.id);
    const next = Math.max(0, Math.round((cur + dir * habit.step) * 1000) / 1000);
    const map = new Map(this.draft());
    map.set(habit.id, next);
    this.draft.set(map);
  }

  protected cancel(): void {
    this.selected.set(null);
    this.draft.set(new Map());
  }

  protected async save(): Promise<void> {
    const date = this.selected();
    if (!date || this.saving()) return;
    this.saving.set(true);
    try {
      const d = this.draft();
      for (const h of this.activeHabits()) {
        const next = d.get(h.id) ?? 0;
        if (next !== this.store.valueOn(h.id, date)) {
          await this.store.setLog(h.id, date, next);
        }
      }
      this.selected.set(null);
      this.draft.set(new Map());
    } catch (e) {
      console.error('Erro ao salvar dia:', e);
    } finally {
      this.saving.set(false);
    }
  }

  private rebuildDraft(date: string): void {
    const map = new Map<string, number>();
    for (const h of this.activeHabits()) map.set(h.id, this.store.valueOn(h.id, date));
    this.draft.set(map);
  }
}
