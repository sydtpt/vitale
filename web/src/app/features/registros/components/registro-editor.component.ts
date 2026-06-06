import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import type { TodoModule } from '@vitale/shared';
import { MOD, HABIT_ICONS, DEFAULT_HABIT_ICON } from '@vitale/shared';
import { RegistrosStore } from '../data/registros.store';
import { IconComponent } from '@core/services/icon.component';

const MODULES: { key: TodoModule; label: string }[] = [
  { key: 'geral', label: 'Geral' },
  { key: 'casa', label: 'Casa' },
  { key: 'financas', label: 'Finanças' },
  { key: 'compras', label: 'Compras' },
  { key: 'saude', label: 'Saúde' },
];

const COLORS: { key: string; label: string }[] = [
  { key: 'habito', label: 'Verde' },
  { key: 'tarefa', label: 'Teal' },
  { key: 'agua', label: 'Azul' },
  { key: 'food', label: 'Amarelo' },
  { key: 'treino', label: 'Laranja' },
  { key: 'casa', label: 'Marrom' },
  { key: 'compras', label: 'Rosa' },
  { key: 'financas', label: 'Tinta' },
];

interface EditorState {
  name: string;
  module: TodoModule;
  icon: string;
  color: string;
}

@Component({
  selector: 'rt-registro-editor',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, IconComponent],
  template: `
    <div class="backdrop" (click)="!saving() && close()" *ngIf="isOpen()"></div>
    <div class="modal" [class.open]="isOpen()">
      <div class="header">
        <h2>{{ existing() ? 'Editar registro' : 'Novo registro' }}</h2>
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
            placeholder="Ex.: Pizza, Comida japonesa, Dentista"
            class="input"
          />
        </div>

        <!-- Módulo -->
        <div class="form-group">
          <label>Módulo</label>
          <div class="chips">
            <button
              type="button"
              *ngFor="let m of MODULES"
              (click)="form().module = m.key"
              class="chip"
              [class.active]="form().module === m.key"
            >
              {{ m.label }}
            </button>
          </div>
        </div>

        <!-- Ícone -->
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

        <!-- Cor -->
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
        <button type="button" class="btn btn-secondary" (click)="close()" [disabled]="saving()">Cancelar</button>
        <button type="button" class="btn btn-primary" (click)="save()" [disabled]="!isValid() || saving()">
          <span class="spinner" *ngIf="saving()"></span>
          {{ saving() ? 'Salvando…' : (existing() ? 'Salvar' : 'Criar registro') }}
        </button>
      </div>
    </div>
  `,
  styles: [`
    .backdrop { position: fixed; inset: 0; background: rgba(0,0,0,0.5); z-index: 999; transition: opacity 0.2s; }
    .modal {
      position: fixed; inset: 0; margin: auto; width: 90%; max-width: 500px; max-height: 90vh;
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
    .icon-chip {
      width: 44px; height: 44px; border: 1px solid var(--line); background: var(--surface); border-radius: 12px;
      display: flex; align-items: center; justify-content: center; cursor: pointer; transition: all 0.2s; color: var(--ink-2);
      &.active { background: var(--primary); border-color: var(--primary); color: white; }
      &:hover { border-color: var(--primary); }
    }
    .swatch {
      width: 38px; height: 38px; border: 2px solid transparent; border-radius: 50%;
      display: flex; align-items: center; justify-content: center; cursor: pointer; transition: all 0.2s; color: white;
      &.active { border-color: var(--ink); }
      &:hover { transform: scale(1.05); }
    }
    .footer { display: flex; gap: var(--spacing-sm); padding: var(--spacing-lg); border-top: 1px solid var(--line); background: var(--bg); }
    .btn {
      flex: 1; padding: 12px; border: none; border-radius: var(--radii-lg); font-size: 14px; font-weight: 600; cursor: pointer; transition: all 0.2s;
      &:disabled { opacity: 0.4; cursor: not-allowed; }
      &:hover:not(:disabled) { transform: translateY(-1px); }
    }
    .btn-primary { background: var(--primary); color: white; }
    .btn-secondary { background: var(--surface); color: var(--ink); border: 1px solid var(--line); }
    .spinner {
      display: inline-block; width: 14px; height: 14px; margin-right: 6px; vertical-align: -2px;
      border: 2px solid rgba(255,255,255,0.45); border-top-color: #fff; border-radius: 50%;
      animation: rt-spin 0.6s linear infinite;
    }
    @keyframes rt-spin { to { transform: rotate(360deg); } }
    @media (max-width: 600px) { .modal { width: 95%; max-height: 95vh; } }
  `],
})
export class RegistroEditorComponent {
  protected readonly store = inject(RegistrosStore);
  protected readonly ICONS = HABIT_ICONS;
  protected readonly MODULES = MODULES;
  protected readonly COLORS = COLORS;

  readonly registroId = input<string | null>(null);
  readonly onClose = output<void>();

  readonly isOpen = signal(false);
  readonly saving = signal(false);
  readonly form = signal<EditorState>({
    name: '',
    module: 'geral',
    icon: DEFAULT_HABIT_ICON,
    color: 'habito',
  });

  readonly existing = computed(() =>
    this.registroId() ? this.store.registros().find((r) => r.id === this.registroId()) : undefined,
  );

  readonly isValid = computed(() => this.form().name.trim() !== '');

  constructor() {
    effect(() => {
      const reg = this.existing();
      if (reg && this.isOpen()) {
        this.form.set({
          name: reg.name,
          module: reg.module,
          icon: reg.icon || DEFAULT_HABIT_ICON,
          color: reg.color || 'habito',
        });
      }
    });
  }

  colorValue(key: string): string {
    return (MOD as Record<string, { accent: string }>)[key]?.accent ?? '#ccc';
  }

  async save() {
    if (!this.isValid() || this.saving()) return;
    const f = this.form();
    const data = { name: f.name.trim(), icon: f.icon, color: f.color, module: f.module };
    this.saving.set(true);
    try {
      if (this.existing()) {
        await this.store.updateRegistro(this.registroId()!, data);
      } else {
        await this.store.createRegistro(data);
      }
      this.close();
    } catch (e) {
      console.error('Erro ao salvar registro:', e);
    } finally {
      this.saving.set(false);
    }
  }

  open() {
    this.isOpen.set(true);
  }

  close() {
    this.isOpen.set(false);
    this.form.set({ name: '', module: 'geral', icon: DEFAULT_HABIT_ICON, color: 'habito' });
    this.onClose.emit();
  }
}
