import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import type { CounterHabit, HabitDirection } from '@vitale/shared';
import { MOD, HABIT_ICONS, DEFAULT_HABIT_ICON } from '@vitale/shared';
import { HabitsStore } from '../data/habits.store';
import { IconComponent } from '@core/services/icon.component';

const COLORS: { key: string; label: string }[] = [
  { key: 'agua', label: 'Água' },
  { key: 'treino', label: 'Treino' },
  { key: 'food', label: 'Comida' },
  { key: 'habito', label: 'Hábito' },
  { key: 'casa', label: 'Casa' },
  { key: 'compras', label: 'Compras' },
  { key: 'financas', label: 'Finanças' },
];

const UNITS = ['L', 'ml', 'un', 'cig', 'min', 'km', 'g', 'mg', 'h'];

interface EditorState {
  name: string;
  bad: boolean;
  showOnHome: boolean;
  direction: HabitDirection;
  target: string;
  unit: string;
  step: string;
  icon: string;
  color: string;
}

function parseNum(s: string): number | null {
  const t = s.trim().replace(',', '.');
  if (t === '') return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

function fmt(n: number): string {
  return String(n).replace('.', ',');
}

@Component({
  selector: 'rt-habit-editor',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, IconComponent],
  template: `
    <div class="backdrop" (click)="close()" *ngIf="isOpen()"></div>
    <div class="modal" [class.open]="isOpen()">
      <div class="header">
        <h2>{{ isOpen() && existing() ? 'Editar hábito' : 'Novo hábito' }}</h2>
        <button class="close-btn" (click)="close()">
          <rt-icon name="x" [size]="20" />
        </button>
      </div>

      <div class="content">
        <!-- Nome -->
        <div class="form-group">
          <label>Nome</label>
          <input
            type="text"
            [(ngModel)]="form().name"
            placeholder="Ex.: Água, Cigarro, Café"
            class="input"
          />
        </div>

        <!-- Bad habit -->
        <div class="check-row">
          <input
            type="checkbox"
            [(ngModel)]="form().bad"
            class="checkbox"
            [id]="'bad-check'"
          />
          <label [for]="'bad-check'" class="check-label">
            <span class="label-title">Hábito ruim</span>
            <span class="label-hint">
              {{ form().bad
                ? 'Mostra há quantos dias você está sem fazer.'
                : 'Mostra a sequência de dias mantendo o hábito.' }}
            </span>
          </label>
        </div>

        <!-- Show on home -->
        <div class="check-row">
          <input
            type="checkbox"
            [(ngModel)]="form().showOnHome"
            class="checkbox"
            [id]="'show-home-check'"
          />
          <label [for]="'show-home-check'" class="check-label">
            <span class="label-title">Mostrar na home</span>
            <span class="label-hint">
              {{ form().showOnHome
                ? 'Aparece na home (tela Hoje) para captura rápida.'
                : 'Fica só na tela de hábitos.' }}
            </span>
          </label>
        </div>

        <!-- Direction -->
        <div class="form-group">
          <label>Tipo de meta</label>
          <div class="segment">
            <button
              type="button"
              class="segment-btn"
              [class.active]="form().direction === 'at_least'"
              (click)="setDirection('at_least')"
            >
              Atingir
            </button>
            <button
              type="button"
              class="segment-btn"
              [class.active]="form().direction === 'at_most'"
              (click)="setDirection('at_most')"
            >
              Não passar
            </button>
          </div>
          <p class="hint">
            {{ form().direction === 'at_least'
              ? 'Bater a meta é bom (ex.: beber 4 L).'
              : 'Ficar abaixo do limite é bom (ex.: ≤ 5 cigarros).' }}
          </p>
        </div>

        <!-- Target + Unit -->
        <div class="row">
          <div class="form-group flex">
            <label>{{ form().direction === 'at_least' ? 'Meta' : 'Limite' }} (opcional)</label>
            <input
              type="text"
              [(ngModel)]="form().target"
              placeholder="vazio = só contar"
              class="input"
            />
          </div>
          <div class="form-group unit-col">
            <label>Unidade</label>
            <input
              type="text"
              [(ngModel)]="form().unit"
              placeholder="un"
              class="input"
            />
          </div>
        </div>

        <!-- Unit chips -->
        <div class="chips">
          <button
            type="button"
            *ngFor="let u of UNITS"
            (click)="form().unit = u"
            class="chip"
            [class.active]="form().unit === u"
          >
            {{ u }}
          </button>
        </div>

        <!-- Step -->
        <div class="form-group">
          <label>Incremento por toque</label>
          <input
            type="text"
            [(ngModel)]="form().step"
            placeholder="Ex.: 0,25"
            class="input"
            [class.error]="stepNum() !== null && stepNum()! <= 0"
          />
          <p class="error" *ngIf="stepNum() !== null && stepNum()! <= 0">
            O incremento deve ser maior que 0.
          </p>
        </div>

        <!-- Icon -->
        <div class="form-group">
          <label>Ícone</label>
          <div class="chips">
            <button
              type="button"
              *ngFor="let ic of ICONS"
              (click)="form().icon = ic"
              class="icon-chip"
              [class.active]="form().icon === ic"
            >
              <rt-icon [name]="ic" [size]="18" />
            </button>
          </div>
        </div>

        <!-- Color -->
        <div class="form-group">
          <label>Cor</label>
          <div class="chips">
            <button
              type="button"
              *ngFor="let c of COLORS"
              (click)="form().color = c.key"
              class="swatch"
              [class.active]="form().color === c.key"
              [style.background-color]="colorValue(c.key)"
              [title]="c.label"
            >
              <rt-icon name="check" [size]="14" *ngIf="form().color === c.key" />
            </button>
          </div>
        </div>
      </div>

      <div class="footer">
        <button type="button" class="btn btn-secondary" (click)="close()">
          Cancelar
        </button>
        <button
          type="button"
          class="btn btn-primary"
          (click)="save()"
          [disabled]="!isValid()"
        >
          {{ existing() ? 'Salvar' : 'Criar hábito' }}
        </button>
      </div>
    </div>
  `,
  styles: [`
    .backdrop {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.5);
      z-index: 999;
      transition: opacity 0.2s;
    }

    .modal {
      position: fixed;
      inset: 0;
      margin: auto;
      width: 90%;
      max-width: 500px;
      max-height: 90vh;
      background: var(--surface);
      border-radius: var(--radii-2xl);
      display: flex;
      flex-direction: column;
      z-index: 1000;
      transform: scale(0.95) translateY(20px);
      opacity: 0;
      transition: all 0.2s;
      pointer-events: none;

      &.open {
        transform: scale(1) translateY(0);
        opacity: 1;
        pointer-events: auto;
      }
    }

    .header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: var(--spacing-lg);
      border-bottom: 1px solid var(--line);

      h2 {
        margin: 0;
        font-size: 20px;
        font-weight: 600;
        color: var(--ink);
      }
    }

    .close-btn {
      background: none;
      border: none;
      cursor: pointer;
      padding: 4px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--ink-2);
      transition: color 0.2s;

      &:hover {
        color: var(--ink);
      }
    }

    .content {
      flex: 1;
      overflow-y: auto;
      padding: var(--spacing-lg);
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .form-group {
      display: flex;
      flex-direction: column;
      gap: 6px;
      margin-top: var(--spacing-lg);

      label {
        font-size: 13px;
        font-weight: 600;
        color: var(--ink-2);
      }
    }

    .input {
      background: var(--surface);
      border: 1px solid var(--line);
      border-radius: var(--radii-lg);
      padding: 12px 14px;
      font-size: 15px;
      color: var(--ink);

      &:focus {
        outline: none;
        border-color: var(--primary);
      }

      &.error {
        border-color: var(--primary-deep);
      }
    }

    .check-row {
      display: flex;
      align-items: flex-start;
      gap: var(--spacing-sm);
      margin-top: var(--spacing-lg);
      background: var(--surface);
      border: 1px solid var(--line);
      border-radius: var(--radii-lg);
      padding: 14px;

      .checkbox {
        width: 20px;
        height: 20px;
        margin-top: 2px;
        cursor: pointer;
      }

      .check-label {
        flex: 1;
        cursor: pointer;
        display: flex;
        flex-direction: column;
        gap: 4px;

        .label-title {
          font-size: 15px;
          font-weight: 600;
          color: var(--ink);
        }

        .label-hint {
          font-size: 12px;
          color: var(--ink-3);
        }
      }
    }

    .segment {
      display: flex;
      gap: 4px;
      background: var(--surface-mute);
      border-radius: var(--radii-pill);
      padding: 3px;
    }

    .segment-btn {
      flex: 1;
      padding: 9px;
      border: none;
      background: transparent;
      border-radius: var(--radii-pill);
      font-size: 13.5px;
      color: var(--ink-3);
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s;

      &.active {
        background: var(--surface);
        color: var(--ink);
        font-weight: 700;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
      }
    }

    .hint {
      margin: 6px 0 0 0;
      font-size: 12px;
      color: var(--ink-3);
    }

    .error {
      margin: 4px 0 0 0;
      font-size: 12px;
      color: var(--primary-deep);
    }

    .row {
      display: flex;
      gap: var(--spacing-md);
      margin-top: var(--spacing-lg);

      .flex {
        flex: 1;
      }
    }

    .unit-col {
      width: 120px;
    }

    .chips {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-top: 4px;
    }

    .chip {
      padding: 8px 14px;
      border: none;
      background: var(--surface-mute);
      border-radius: var(--radii-pill);
      font-size: 13px;
      color: var(--ink-2);
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s;

      &.active {
        background: var(--primary);
        color: white;
      }

      &:hover {
        opacity: 0.8;
      }
    }

    .icon-chip {
      width: 44px;
      height: 44px;
      border: 1px solid var(--line);
      background: var(--surface);
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      transition: all 0.2s;
      color: var(--ink-2);

      &.active {
        background: var(--primary);
        border-color: var(--primary);
        color: white;
      }

      &:hover {
        border-color: var(--primary);
      }
    }

    .swatch {
      width: 38px;
      height: 38px;
      border: 2px solid transparent;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      transition: all 0.2s;
      color: white;

      &.active {
        border-color: var(--ink);
      }

      &:hover {
        transform: scale(1.05);
      }
    }

    .footer {
      display: flex;
      gap: var(--spacing-sm);
      padding: var(--spacing-lg);
      border-top: 1px solid var(--line);
      background: var(--bg);
    }

    .btn {
      flex: 1;
      padding: 12px;
      border: none;
      border-radius: var(--radii-lg);
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s;

      &:disabled {
        opacity: 0.4;
        cursor: not-allowed;
      }

      &:hover:not(:disabled) {
        transform: translateY(-1px);
      }
    }

    .btn-primary {
      background: var(--primary);
      color: white;
    }

    .btn-secondary {
      background: var(--surface);
      color: var(--ink);
      border: 1px solid var(--line);
    }

    @media (max-width: 600px) {
      .modal {
        width: 95%;
        max-height: 95vh;
      }

      .row {
        flex-direction: column;
      }

      .unit-col {
        width: 100%;
      }
    }
  `],
})
export class HabitEditorComponent {
  protected readonly store = inject(HabitsStore);
  protected readonly ICONS = HABIT_ICONS;
  protected readonly COLORS = COLORS;
  protected readonly UNITS = UNITS;

  readonly habitId = input<string | null>(null);
  readonly onClose = output<void>();

  readonly isOpen = signal(false);
  readonly form = signal<EditorState>({
    name: '',
    bad: false,
    showOnHome: true,
    direction: 'at_least',
    target: '',
    unit: 'un',
    step: '1',
    icon: DEFAULT_HABIT_ICON,
    color: 'agua',
  });

  readonly existing = computed(() => this.habitId() ? this.store.habits().find(h => h.id === this.habitId()) : undefined);

  readonly stepNum = computed(() => parseNum(this.form().step));
  readonly targetNum = computed(() => parseNum(this.form().target));
  readonly isValid = computed(() => {
    const f = this.form();
    const step = this.stepNum();
    return f.name.trim() !== '' && f.unit.trim() !== '' && step !== null && step > 0;
  });

  constructor() {
    effect(() => {
      const habit = this.existing();
      if (habit && this.isOpen()) {
        this.form.set({
          name: habit.name,
          bad: habit.bad ?? false,
          showOnHome: habit.showOnHome ?? true,
          direction: habit.direction,
          target: habit.target == null ? '' : fmt(habit.target),
          unit: habit.unit,
          step: fmt(habit.step),
          icon: habit.icon,
          color: habit.color,
        });
      }
    });
  }

  setDirection(dir: HabitDirection) {
    this.form.update(f => ({ ...f, direction: dir }));
  }

  colorValue(key: string): string {
    const mod = (MOD as Record<string, any>)[key];
    return mod?.accent ?? '#ccc';
  }

  async save() {
    if (!this.isValid()) return;

    const f = this.form();
    const step = this.stepNum();
    const target = this.targetNum();

    if (step === null) return;

    try {
      const data = {
        name: f.name.trim(),
        icon: f.icon,
        color: f.color,
        unit: f.unit.trim(),
        step,
        direction: f.direction,
        bad: f.bad,
        showOnHome: f.showOnHome,
        target: target ?? undefined,
      };

      if (this.existing()) {
        await this.store.updateHabit(this.habitId()!, data);
      } else {
        await this.store.createHabit(data);
      }

      this.close();
    } catch (e) {
      console.error('Erro ao salvar hábito:', e);
    }
  }

  close() {
    this.isOpen.set(false);
    this.onClose.emit();
  }

  open() {
    this.isOpen.set(true);
  }
}
