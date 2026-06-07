import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import type { PlannedWorkout } from '@vitale/shared';
import { PlannedWorkoutsStore } from '../data/planned-workouts.store';
import { IconComponent } from '@core/services/icon.component';

type Kind = PlannedWorkout['kind'];

const KINDS: { key: Kind; label: string }[] = [
  { key: 'strength', label: 'Força' },
  { key: 'endurance', label: 'Endurance' },
  { key: 'easy', label: 'Leve' },
  { key: 'rest', label: 'Descanso' },
];

interface EditorState {
  type: string;
  kind: Kind;
  durMin: number;
  distKm: number;
}

@Component({
  selector: 'rt-planned-workout-editor',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, IconComponent],
  template: `
    <div class="backdrop" (click)="!saving() && close()" *ngIf="isOpen()"></div>
    <div class="modal" [class.open]="isOpen()">
      <div class="header">
        <h2>{{ existing() ? 'Editar treino' : 'Novo treino' }}</h2>
        <button class="close-btn" (click)="close()"><rt-icon name="x" [size]="20" /></button>
      </div>

      <div class="content">
        <div class="form-group">
          <label>Treino</label>
          <input type="text" [(ngModel)]="form().type" placeholder="Ex.: Pernas — Volume" class="input" />
        </div>

        <div class="form-group">
          <label>Intensidade</label>
          <div class="chips">
            <button type="button" *ngFor="let k of KINDS" (click)="form().kind = k.key"
              class="chip" [class.active]="form().kind === k.key">{{ k.label }}</button>
          </div>
        </div>

        <div class="form-group" *ngIf="form().kind !== 'rest'">
          <label>Duração (min)</label>
          <input type="number" min="0" [(ngModel)]="form().durMin" class="input" />
        </div>

        <div class="form-group" *ngIf="form().kind === 'endurance'">
          <label>Distância (km)</label>
          <input type="number" min="0" step="0.1" [(ngModel)]="form().distKm" class="input" />
        </div>
      </div>

      <div class="footer">
        <button type="button" class="btn btn-danger" *ngIf="existing()" (click)="remove()" [disabled]="saving()">Excluir</button>
        <button type="button" class="btn btn-secondary" (click)="close()" [disabled]="saving()">Cancelar</button>
        <button type="button" class="btn btn-primary" (click)="save()" [disabled]="!isValid() || saving()">
          <span class="spinner" *ngIf="saving()"></span>
          {{ saving() ? 'Salvando…' : (existing() ? 'Salvar' : 'Criar treino') }}
        </button>
      </div>
    </div>
  `,
  styles: [`
    .backdrop { position: fixed; inset: 0; background: rgba(0,0,0,0.5); z-index: 999; transition: opacity 0.2s; }
    .modal {
      position: fixed; inset: 0; margin: auto; width: 90%; max-width: 460px; max-height: 90vh;
      background: var(--surface); border-radius: var(--radii-2xl); display: flex; flex-direction: column;
      box-shadow: var(--shadow-card);
      z-index: 1000; transform: scale(0.95) translateY(20px); opacity: 0; transition: all 0.2s; pointer-events: none;
      &.open { transform: scale(1) translateY(0); opacity: 1; pointer-events: auto; }
    }
    .header {
      display: flex; align-items: center; justify-content: space-between;
      padding: var(--spacing-lg); border-bottom: 1px solid var(--line);
      h2 { margin: 0; font-size: 20px; font-weight: 600; color: var(--ink); }
    }
    .close-btn { background: none; border: none; cursor: pointer; padding: 4px; display: flex; color: var(--ink-2); transition: color 0.2s; &:hover { color: var(--ink); } }
    .content { flex: 1; overflow-y: auto; padding: var(--spacing-lg); display: flex; flex-direction: column; gap: 4px; }
    .form-group {
      display: flex; flex-direction: column; gap: 6px; margin-top: var(--spacing-lg);
      label { font-size: 13px; font-weight: 600; color: var(--ink-2); }
    }
    .input {
      background: var(--surface); border: 1px solid var(--line); border-radius: var(--radii-lg);
      padding: 12px 14px; font-size: 15px; color: var(--ink);
      &:focus { outline: none; border-color: var(--primary); }
    }
    .chips { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 4px; }
    .chip {
      padding: 8px 14px; border: none; background: var(--surface-mute); border-radius: var(--radii-pill);
      font-size: 13px; color: var(--ink-2); font-weight: 600; cursor: pointer; transition: all 0.2s;
      &.active { background: var(--primary); color: white; }
      &:hover { opacity: 0.8; }
    }
    .footer { display: flex; gap: var(--spacing-sm); padding: var(--spacing-lg); border-top: 1px solid var(--line); background: var(--bg); }
    .btn {
      flex: 1; padding: 12px; border: none; border-radius: var(--radii-lg); font-size: 14px; font-weight: 600; cursor: pointer; transition: all 0.2s;
      &:disabled { opacity: 0.4; cursor: not-allowed; }
      &:hover:not(:disabled) { transform: translateY(-1px); }
    }
    .btn-primary { background: var(--primary); color: white; }
    .btn-secondary { background: var(--surface); color: var(--ink); border: 1px solid var(--line); }
    .btn-danger { background: var(--surface); color: var(--rose, #E26A8A); border: 1px solid var(--line); flex: 0 0 auto; }
    .spinner {
      display: inline-block; width: 14px; height: 14px; margin-right: 6px; vertical-align: -2px;
      border: 2px solid rgba(255,255,255,0.45); border-top-color: #fff; border-radius: 50%;
      animation: rt-spin 0.6s linear infinite;
    }
    @keyframes rt-spin { to { transform: rotate(360deg); } }
    @media (max-width: 600px) { .modal { width: 95%; max-height: 95vh; } }
  `],
})
export class PlannedWorkoutEditorComponent {
  protected readonly store = inject(PlannedWorkoutsStore);
  protected readonly KINDS = KINDS;

  /** Dia (YYYY-MM-DD) a planejar — usado ao criar. */
  readonly date = input<string>('');
  /** Id do treino em edição; null = criação. */
  readonly workoutId = input<string | null>(null);
  readonly onClose = output<void>();

  readonly isOpen = signal(false);
  readonly saving = signal(false);
  readonly form = signal<EditorState>({ type: '', kind: 'strength', durMin: 45, distKm: 0 });

  readonly existing = computed(() =>
    this.workoutId() ? this.store.planned().find(p => p.id === this.workoutId()) : undefined,
  );

  readonly isValid = computed(() => this.form().type.trim() !== '');

  constructor() {
    effect(() => {
      const w = this.existing();
      if (w && this.isOpen()) {
        this.form.set({ type: w.type, kind: w.kind, durMin: w.durMin, distKm: w.distKm ?? 0 });
      }
    });
  }

  async save() {
    if (!this.isValid() || this.saving()) return;
    const f = this.form();
    const data = {
      type: f.type.trim(),
      kind: f.kind,
      durMin: f.kind === 'rest' ? 0 : Number(f.durMin) || 0,
      distKm: f.kind === 'endurance' ? Number(f.distKm) || 0 : undefined,
    };
    this.saving.set(true);
    try {
      if (this.existing()) await this.store.update(this.workoutId()!, data);
      else await this.store.create({ date: this.date(), ...data });
      this.close();
    } catch (e) {
      console.error('Erro ao salvar treino planejado:', e);
    } finally {
      this.saving.set(false);
    }
  }

  async remove() {
    if (!this.existing() || this.saving()) return;
    this.saving.set(true);
    try {
      await this.store.remove(this.workoutId()!);
      this.close();
    } catch (e) {
      console.error('Erro ao excluir treino planejado:', e);
    } finally {
      this.saving.set(false);
    }
  }

  open() { this.isOpen.set(true); }

  close() {
    this.isOpen.set(false);
    this.form.set({ type: '', kind: 'strength', durMin: 45, distKm: 0 });
    this.onClose.emit();
  }
}
