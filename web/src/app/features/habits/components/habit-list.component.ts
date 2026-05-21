import { ChangeDetectionStrategy, Component, input, output, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import type { CounterHabit } from '@vitale/shared';
import { MOD } from '@vitale/shared';
import { HabitsStore } from '../data/habits.store';
import { IconComponent } from '@core/services/icon.component';

function fmt(n: number): string {
  const r = Math.round(n * 100) / 100;
  const s = Number.isInteger(r) ? String(r) : r.toFixed(2).replace(/\.?0+$/, '');
  return s.replace('.', ',');
}

function modColor(key: string): { tint: string; accent: string } {
  return (MOD as Record<string, { tint: string; accent: string }>)[key] ?? MOD.habito;
}

function summary(h: CounterHabit): string {
  const tag = h.bad ? 'A evitar · ' : '';
  const inc = `+${fmt(h.step)} ${h.unit}`;
  if (h.target == null) return `${tag}Contador · ${inc}`;
  const goal = h.direction === 'at_least' ? `Meta ${fmt(h.target)} ${h.unit}` : `Limite ${fmt(h.target)} ${h.unit}`;
  return `${tag}${goal} · ${inc}`;
}

@Component({
  selector: 'rt-habit-list',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, IconComponent],
  template: `
    <ng-container *ngIf="habits().length > 0">
      @if (activeHabits().length > 0) {
        <h3 class="section-title">Ativos</h3>
        <div class="list">
          @for (h of activeHabits(); track h.id) {
            <div class="card">
              <div class="row">
                <div class="icon-box" [ngStyle]="{ backgroundColor: modColor(h.color).tint }">
                  <rt-icon [name]="h.icon || 'droplet'" [size]="18" [color]="modColor(h.color).accent" />
                </div>
                <div class="flex">
                  <h4 class="name">{{ h.name }}</h4>
                  <p class="summary">{{ summary(h) }}</p>
                </div>
                <div class="actions">
                  <button
                    class="action-btn"
                    (click)="onEdit.emit(h.id)"
                    title="Editar"
                  >
                    <rt-icon name="edit-2" [size]="16" />
                  </button>
                  <button
                    class="action-btn"
                    (click)="onArchive.emit({ id: h.id, active: false })"
                    title="Arquivar"
                  >
                    <rt-icon name="archive" [size]="16" />
                  </button>
                </div>
              </div>
            </div>
          }
        </div>
      }

      @if (archivedHabits().length > 0) {
        <h3 class="section-title">Arquivados</h3>
        <div class="list">
          @for (h of archivedHabits(); track h.id) {
            <div class="card" [class.muted]="true">
              <div class="row">
                <div class="icon-box" [ngStyle]="{ backgroundColor: modColor(h.color).tint, opacity: 0.5 }">
                  <rt-icon [name]="h.icon || 'droplet'" [size]="18" [color]="modColor(h.color).accent" />
                </div>
                <div class="flex">
                  <h4 class="name muted">{{ h.name }}</h4>
                  <p class="summary">{{ summary(h) }}</p>
                </div>
                <div class="actions">
                  <button
                    class="action-btn"
                    (click)="onEdit.emit(h.id)"
                    title="Editar"
                  >
                    <rt-icon name="edit-2" [size]="16" />
                  </button>
                  <button
                    class="action-btn"
                    (click)="onArchive.emit({ id: h.id, active: true })"
                    title="Reativar"
                  >
                    <rt-icon name="undo" [size]="16" />
                  </button>
                </div>
              </div>
            </div>
          }
        </div>
      }
    </ng-container>
  `,
  styles: [`
    .section-title {
      font-size: 12.5px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: var(--ink-2);
      margin: 26px 0 10px;
    }

    .list {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .card {
      display: flex;
      align-items: center;
      background: var(--surface);
      border: 1px solid var(--line);
      border-radius: 14px;
      padding: 10px 14px;
      box-shadow: var(--shadow-card);
      transition: background 0.2s;

      &:hover {
        background: var(--surface-mute);
      }

      &.muted {
        opacity: 0.7;
      }
    }

    .row {
      display: flex;
      align-items: center;
      gap: 12px;
      width: 100%;
    }

    .icon-box {
      width: 42px;
      height: 42px;
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    .flex {
      flex: 1;
      min-width: 0;
    }

    .name {
      margin: 0;
      font-size: 14px;
      font-weight: 600;
      color: var(--ink);

      &.muted {
        color: var(--ink3);
      }
    }

    .summary {
      margin: 2px 0 0 0;
      font-size: 12px;
      color: var(--ink3);
    }

    .actions {
      display: flex;
      gap: 4px;
      flex-shrink: 0;
    }

    .action-btn {
      width: 32px;
      height: 32px;
      border: none;
      background: transparent;
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      color: var(--ink3);
      transition: all 0.2s;

      &:hover {
        background: var(--line);
        color: var(--ink);
      }
    }
  `],
})
export class HabitListComponent {
  readonly habits = input<CounterHabit[]>([]);
  readonly onEdit = output<string>();
  readonly onArchive = output<{ id: string; active: boolean }>();

  protected readonly modColor = modColor;
  protected readonly summary = summary;

  readonly activeHabits = computed(() => this.habits().filter(h => h.active));
  readonly archivedHabits = computed(() => this.habits().filter(h => !h.active));
}
