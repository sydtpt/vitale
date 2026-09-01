import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MOD, DEFAULT_HABIT_ICON, type Registro, type RegistroLog, type TodoModule } from '@vitale/shared';
import { IconComponent } from '@core/services/icon.component';
import { HabitHeatmapComponent, type HeatCell } from '../../habits/components/habit-heatmap.component';
import { RANGE_DAYS } from '../data/registros.store';
import {
  countInWindow,
  daysBetween,
  lastDone,
  lastNDates,
  localDateStr,
  markedDates,
} from '../data/registro-logic';

const MODULE_LABEL: Record<TodoModule, string> = {
  geral: 'Geral',
  casa: 'Casa',
  financas: 'Finanças',
  compras: 'Compras',
  saude: 'Saúde',
};

const EMPTY = 'var(--surface-mute)';

/** Card de análise de um registro: contagem no período, última vez e heatmap dos dias marcados. */
@Component({
  selector: 'rt-registro-analytics-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, IconComponent, HabitHeatmapComponent],
  template: `
    <div class="card">
      <div class="head">
        <div class="icon-box" [style.background-color]="tint()">
          <rt-icon [name]="icon()" [size]="18" [color]="accent()" />
        </div>
        <div class="flex">
          <h3 class="name" [class.muted]="!registro().active">{{ registro().name }}</h3>
          <p class="subtitle">{{ moduleLabel() }}{{ registro().active ? '' : ' · Arquivado' }}</p>
        </div>
      </div>

      <div class="stats">
        <div class="stat">
          <span class="value">{{ total() }}</span>
          <span class="label">no período</span>
        </div>
        <div class="stat">
          <span class="value">{{ lastLabel() }}</span>
          <span class="label">última vez</span>
        </div>
      </div>

      <rt-habit-heatmap [cells]="cells()" />
    </div>
  `,
  styles: [`
    .card {
      background: var(--surface); border: 1px solid var(--line); border-radius: 16px;
      padding: 16px; box-shadow: var(--shadow-card); display: flex; flex-direction: column; gap: 14px;
    }
    .head { display: flex; align-items: center; gap: 12px; }
    .icon-box { width: 42px; height: 42px; border-radius: 12px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
    .flex { flex: 1; min-width: 0; }
    .name { margin: 0; font-size: 15px; font-weight: 650; color: var(--ink); &.muted { color: var(--ink-3); } }
    .subtitle { margin: 2px 0 0 0; font-size: 12px; color: var(--ink-3); }
    .stats { display: flex; gap: 24px; }
    .stat { display: flex; flex-direction: column; gap: 2px; }
    .stat .value { font-size: 20px; font-weight: 700; color: var(--ink); }
    .stat .label { font-size: 11.5px; color: var(--ink-3); text-transform: uppercase; letter-spacing: 0.4px; }
  `],
})
export class RegistroAnalyticsCardComponent {
  readonly registro = input.required<Registro>();
  readonly logs = input.required<RegistroLog[]>();

  private readonly marked = computed(() => markedDates(this.logs()));

  protected accent(): string {
    return (MOD as Record<string, { accent: string }>)[this.registro().color]?.accent ?? MOD.habito.accent;
  }
  protected tint(): string {
    return `color-mix(in srgb, ${this.accent()} 14%, var(--surface))`;
  }
  protected icon(): string {
    return this.registro().icon || DEFAULT_HABIT_ICON;
  }
  protected moduleLabel(): string {
    return MODULE_LABEL[this.registro().module] ?? 'Geral';
  }

  protected readonly total = computed(() => countInWindow(this.marked(), RANGE_DAYS));

  protected readonly lastLabel = computed(() => {
    const last = lastDone(this.marked());
    if (!last) return '—';
    const diff = daysBetween(last, localDateStr());
    if (diff <= 0) return 'hoje';
    if (diff === 1) return 'ontem';
    return `${diff}d atrás`;
  });

  protected readonly cells = computed<HeatCell[]>(() => {
    const marked = this.marked();
    return lastNDates(RANGE_DAYS).map((date) => ({
      date,
      color: marked.has(date) ? this.accent() : EMPTY,
      title: `${date}: ${marked.has(date) ? 'feito' : '—'}`,
    }));
  });
}
