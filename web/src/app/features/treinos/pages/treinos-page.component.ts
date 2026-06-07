import { ChangeDetectionStrategy, Component, ViewChild, inject, signal } from '@angular/core';
import { PageHeaderComponent } from '@shared/components/page-header/page-header.component';
import { PanelComponent } from '@shared/components/panel/panel.component';
import { IconComponent } from '@core/services/icon.component';
import { ActivityVolumeChartComponent } from '../components/activity-volume-chart.component';
import { ACTIVITY_RUNNING, ACTIVITY_CYCLING, ACTIVITY_YOGA } from '../data/weekly-volume';
import { PlannedWorkoutsStore } from '../data/planned-workouts.store';
import { PlannedWorkoutEditorComponent } from '../components/planned-workout-editor.component';
import { T, type PlannedWorkout } from '@vitale/shared';

const KIND_LABEL: Record<PlannedWorkout['kind'], string> = {
  strength: 'Força',
  endurance: 'Endurance',
  easy: 'Leve',
  rest: 'Descanso',
};

@Component({
  selector: 'rt-treinos-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    PageHeaderComponent,
    PanelComponent,
    ActivityVolumeChartComponent,
    IconComponent,
    PlannedWorkoutEditorComponent,
  ],
  templateUrl: './treinos-page.component.html',
  styleUrl: './treinos-page.component.scss',
})
export class TreinosPageComponent {
  protected readonly store = inject(PlannedWorkoutsStore);

  /** Tipos e cores dos painéis de volume real (cargas/força ficam para depois). */
  protected readonly RUNNING = ACTIVITY_RUNNING;
  protected readonly CYCLING = ACTIVITY_CYCLING;
  protected readonly YOGA = ACTIVITY_YOGA;
  protected readonly colors = { running: T.primary, cycling: T.blue, yoga: T.green };

  @ViewChild(PlannedWorkoutEditorComponent) private editor?: PlannedWorkoutEditorComponent;

  protected readonly editDate = signal('');
  protected readonly editId = signal<string | null>(null);

  constructor() {
    void this.store.load();
  }

  protected kindLabel(kind: PlannedWorkout['kind']): string {
    return KIND_LABEL[kind];
  }

  protected openCreate(date: string): void {
    this.editId.set(null);
    this.editDate.set(date);
    this.editor?.open();
  }

  protected openEdit(w: PlannedWorkout): void {
    this.editDate.set(w.date);
    this.editId.set(w.id);
    this.editor?.open();
  }
}
