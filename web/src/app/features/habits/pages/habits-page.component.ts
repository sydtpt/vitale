import { ChangeDetectionStrategy, Component, computed, inject, signal, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PageHeaderComponent } from '@shared/components/page-header/page-header.component';
import { IconComponent } from '@core/services/icon.component';
import { HabitsStore } from '../data/habits.store';
import { HabitAnalyticsCardComponent } from '../components/habit-analytics-card.component';
import { HabitEditorComponent } from '../components/habit-editor.component';
import { HabitListComponent } from '../components/habit-list.component';
import { HabitDayEditorComponent } from '../components/habit-day-editor.component';

type ViewMode = 'list' | 'analytics' | 'calendar';

@Component({
  selector: 'rt-habits-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, PageHeaderComponent, IconComponent, HabitAnalyticsCardComponent, HabitEditorComponent, HabitListComponent, HabitDayEditorComponent],
  templateUrl: './habits-page.component.html',
  styleUrl: './habits-page.component.scss',
})
export class HabitsPageComponent {
  protected readonly store = inject(HabitsStore);
  protected readonly count = computed(() => this.store.habits().length);

  @ViewChild(HabitEditorComponent) editor!: HabitEditorComponent;

  readonly editingId = signal<string | null>(null);
  readonly mode = signal<ViewMode>('list');
  readonly showList = computed(() => this.mode() === 'list');

  constructor() {
    void this.store.load();
  }

  openNewHabit() {
    this.editingId.set(null);
    this.editor?.open();
  }

  openEditHabit(id: string) {
    this.editingId.set(id);
    this.editor?.open();
  }

  async archiveHabit(evt: { id: string; active: boolean }) {
    try {
      await this.store.archiveHabit(evt.id, evt.active);
    } catch (e) {
      console.error('Erro ao arquivar hábito:', e);
    }
  }

  toggleView() {
    this.mode.set(this.mode() === 'analytics' ? 'list' : 'analytics');
  }

  toggleCalendar() {
    this.mode.set(this.mode() === 'calendar' ? 'list' : 'calendar');
  }
}
