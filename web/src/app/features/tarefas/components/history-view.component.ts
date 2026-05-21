import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { type TodoTemplate, type TodoOccurrence } from '@vitale/shared';
import { IconComponent } from '@core/services/icon.component';
import { HistoryCardComponent } from './history-card.component';

type ViewMode = 'data' | 'serie' | 'modulo' | 'status' | 'semana' | 'frequencia';
type TodoModule = 'financas' | 'compras' | 'casa' | 'saude' | 'geral';
type TodoStatus = 'done' | 'skipped' | 'canceled' | 'expired';

interface Row {
  o: TodoOccurrence;
  t: TodoTemplate;
}

interface SerieGroup {
  template: TodoTemplate;
  rows: Row[];
  doneCount: number;
  skippedCount: number;
  canceledCount: number;
  expiredCount: number;
  expanded: boolean;
}

interface DayGroup {
  date: string;
  label: string;
  rows: Row[];
}

interface ModuloGroup {
  module: TodoModule;
  label: string;
  rows: Row[];
}

interface StatusGroup {
  status: TodoStatus;
  label: string;
  count: number;
  rows: Row[];
}

interface WeekCell {
  week: number;
  startDate: Date;
  endDate: Date;
  label: string;
  doneCount: number;
  totalCount: number;
}

interface FrequencyItem {
  template: TodoTemplate;
  doneCount: number;
  totalCount: number;
}

@Component({
  selector: 'rt-history-view',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, IconComponent, HistoryCardComponent],
  template: `
    <div class="history">
      <div class="controls">
        <div class="seg">
          @for (mode of modes; track mode.id) {
            <button [class.active]="currentMode() === mode.id" (click)="currentMode.set(mode.id)" class="opt">
              {{ mode.label }}
            </button>
          }
        </div>

        <div class="period-selector">
          @for (period of periods; track period.days) {
            <button
              [class.active]="periodDays() === period.days"
              (click)="periodDays.set(period.days)"
              class="period-opt">
              {{ period.label }}
            </button>
          }
        </div>
      </div>

      @if (rows().length === 0) {
        <div class="empty">Nenhum histórico{{ periodLabel() ? ' ' + periodLabel() : '' }}</div>
      } @else {
        @switch (currentMode()) {
          @case ('data') {
            <div class="view">
              @for (dayGroup of byDate(); track dayGroup.date) {
                <div class="group">
                  <h4 class="group-title">{{ dayGroup.label }}</h4>
                  <div class="list">
                    @for (r of dayGroup.rows; track r.o.id) {
                      <rt-history-card [template]="r.t" [occurrence]="r.o" />
                    }
                  </div>
                </div>
              }
            </div>
          }
          @case ('serie') {
            <div class="view">
              @for (serieGroup of bySerie(); track serieGroup.template.id) {
                <div class="group">
                  <button class="group-title" (click)="toggleSerie(serieGroup)">
                    <rt-icon name="chevron-down" [size]="16" [class.rotated]="!serieGroup.expanded" />
                    <span>{{ serieGroup.template.name }}</span>
                    <span class="counts">
                      {{ serieGroup.doneCount }}× ·
                      @if (serieGroup.skippedCount > 0) { {{ serieGroup.skippedCount }}⊘ }
                      @if (serieGroup.canceledCount > 0) { {{ serieGroup.canceledCount }}✕ }
                      @if (serieGroup.expiredCount > 0) { {{ serieGroup.expiredCount }}⌛ }
                    </span>
                  </button>
                  @if (serieGroup.expanded) {
                    <div class="list">
                      @for (r of serieGroup.rows; track r.o.id) {
                        <rt-history-card [template]="r.t" [occurrence]="r.o" />
                      }
                    </div>
                  }
                </div>
              }
            </div>
          }
          @case ('modulo') {
            <div class="view">
              @for (moduloGroup of byModulo(); track moduloGroup.module) {
                <div class="group">
                  <h4 class="group-title">{{ moduloGroup.label }}</h4>
                  <div class="list">
                    @for (r of moduloGroup.rows; track r.o.id) {
                      <rt-history-card [template]="r.t" [occurrence]="r.o" />
                    }
                  </div>
                </div>
              }
            </div>
          }
          @case ('status') {
            <div class="view">
              <div class="status-tabs">
                @for (statusGroup of byStatus(); track statusGroup.status) {
                  <button [class.active]="currentStatus() === statusGroup.status" (click)="currentStatus.set(statusGroup.status)" class="status-tab">
                    {{ statusGroup.label }} ({{ statusGroup.count }})
                  </button>
                }
              </div>
              <div class="group">
                <div class="list">
                  @for (r of statusRows(); track r.o.id) {
                    <rt-history-card [template]="r.t" [occurrence]="r.o" />
                  }
                </div>
              </div>
            </div>
          }
          @case ('semana') {
            <div class="view">
              <div class="weeks-grid">
                @for (week of weeks(); track week.week) {
                  <div class="week-cell">
                    <div class="week-label">{{ week.label }}</div>
                    <div class="week-count">{{ week.doneCount }} / {{ week.totalCount }}</div>
                    <div class="week-bar">
                      <div class="week-fill" [style.width.%]="(week.doneCount / (week.totalCount || 1)) * 100"></div>
                    </div>
                  </div>
                }
              </div>
            </div>
          }
          @case ('frequencia') {
            <div class="view">
              @for (freq of frequency(); track freq.template.id) {
                <div class="freq-item">
                  <div class="freq-header">
                    <span class="freq-name">{{ freq.template.name }}</span>
                    <span class="freq-count">{{ freq.doneCount }} / {{ freq.totalCount }}</span>
                  </div>
                  <div class="freq-bar">
                    <div class="freq-fill" [style.width.%]="(freq.doneCount / (maxFreq() || 1)) * 100"></div>
                  </div>
                </div>
              }
            </div>
          }
        }
      }
    </div>
  `,
  styles: [`
    .history { padding: 16px; }
    .controls { margin-bottom: 16px; display: flex; gap: 12px; flex-wrap: wrap; align-items: center; }

    .seg {
      display: inline-flex; gap: 2px; padding: 3px; background: var(--surface-mute);
      border-radius: 11px; border: 1px solid var(--line);
    }
    .opt {
      background: transparent; border: none; font-size: 12.5px; font-weight: 600;
      padding: 5px 14px; border-radius: 8px; cursor: pointer; color: var(--ink-2);
      transition: all 0.15s;
    }
    .opt.active { background: var(--surface); color: var(--ink); box-shadow: var(--shadow-sm); }

    .period-selector {
      display: inline-flex; gap: 6px; flex-wrap: wrap;
    }
    .period-opt {
      background: var(--surface-mute); border: 1px solid var(--line); font-size: 12px; font-weight: 600;
      padding: 6px 12px; border-radius: 8px; cursor: pointer; color: var(--ink-2);
      transition: all 0.15s;
    }
    .period-opt:hover { background: var(--surface); }
    .period-opt.active { background: var(--primary); border-color: var(--primary); color: #fff; }

    .empty { text-align: center; padding: 48px 16px; color: var(--ink-2); font-size: 14px; }

    .view { }

    .group { margin-bottom: 20px; }
    .group-title {
      font-size: 12.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;
      color: var(--ink-2); margin-bottom: 10px; border: none; background: transparent;
      padding: 0; cursor: pointer; display: flex; align-items: center; gap: 8px;
    }
    .group-title rt-icon {
      transition: transform 0.2s;
    }
    .group-title rt-icon.rotated {
      transform: rotate(-90deg);
    }
    .group-title .counts { font-size: 11px; font-weight: 500; color: var(--ink-3); margin-left: auto; }

    .list { display: flex; flex-direction: column; gap: 8px; }

    .status-tabs { display: flex; gap: 8px; margin-bottom: 16px; border-bottom: 1px solid var(--line); }
    .status-tab {
      background: transparent; border: none; font-size: 13px; font-weight: 600; padding: 10px 0;
      cursor: pointer; color: var(--ink-3); border-bottom: 2px solid transparent; margin-bottom: -1px;
      transition: all 0.15s;
    }
    .status-tab.active { color: var(--primary); border-bottom-color: var(--primary); }

    .weeks-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(100px, 1fr)); gap: 12px; }
    .week-cell {
      background: var(--surface); border: 1px solid var(--line); border-radius: 10px; padding: 12px;
      text-align: center;
    }
    .week-label { font-size: 12px; font-weight: 600; color: var(--ink); margin-bottom: 6px; }
    .week-count { font-size: 14px; font-weight: 700; color: var(--primary); margin-bottom: 8px; }
    .week-bar { height: 4px; background: var(--surface-mute); border-radius: 2px; overflow: hidden; }
    .week-fill { height: 100%; background: var(--primary); transition: width 0.3s; }

    .freq-item { margin-bottom: 14px; }
    .freq-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; }
    .freq-name { font-size: 14px; font-weight: 600; color: var(--ink); }
    .freq-count { font-size: 12px; color: var(--ink-3); }
    .freq-bar { height: 6px; background: var(--surface-mute); border-radius: 3px; overflow: hidden; }
    .freq-fill { height: 100%; background: var(--primary); transition: width 0.3s; }
  `],
})
export class HistoryViewComponent {
  readonly occurrences = input.required<TodoOccurrence[]>();
  readonly templates = input.required<TodoTemplate[]>();

  readonly currentMode = signal<ViewMode>('data');
  readonly currentStatus = signal<TodoStatus>('done');
  readonly periodDays = signal<number | null>(30);

  protected readonly modes = [
    { id: 'data' as const, label: 'Por data' },
    { id: 'serie' as const, label: 'Por série' },
    { id: 'modulo' as const, label: 'Por módulo' },
    { id: 'status' as const, label: 'Por status' },
    { id: 'semana' as const, label: 'Semana' },
    { id: 'frequencia' as const, label: 'Frequência' },
  ];

  protected readonly periods = [
    { days: 30, label: '30 dias' },
    { days: 60, label: '60 dias' },
    { days: 90, label: '90 dias' },
    { days: 180, label: '180 dias' },
    { days: 365, label: '1 ano' },
    { days: null, label: 'Tudo' },
  ];

  private serieExpandedMap = new Map<string, boolean>();

  protected readonly periodLabel = computed(() => {
    const days = this.periodDays();
    if (days === null) return 'em todo o histórico';
    if (days === 30) return 'nos últimos 30 dias';
    if (days === 60) return 'nos últimos 60 dias';
    if (days === 90) return 'nos últimos 90 dias';
    if (days === 180) return 'nos últimos 180 dias';
    if (days === 365) return 'no último ano';
    return '';
  });

  protected readonly rows = computed(() => {
    const templateMap = new Map(this.templates().map((t) => [t.id, t]));
    const now = new Date();
    const cutoffDate = this.periodDays() !== null
      ? new Date(now.getTime() - this.periodDays()! * 86400000)
      : new Date(0);

    return this.occurrences()
      .map((o) => ({ o, t: templateMap.get(o.templateId) }))
      .filter((r): r is Row => !!r.t)
      .filter((r) => {
        const date = r.o.doneAt ?? r.o.createdAt;
        return new Date(date) >= cutoffDate;
      });
  });

  protected readonly byDate = computed(() => {
    const groups = new Map<string, Row[]>();
    for (const r of this.rows()) {
      const date = r.o.doneAt ?? r.o.dueDate ?? r.o.createdAt;
      const key = date ? date.split('T')[0] : '';
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(r);
    }
    return Array.from(groups.entries())
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([date, rows]) => ({
        date,
        label: this.formatDate(date),
        rows,
      } as DayGroup));
  });

  protected readonly bySerie = computed(() => {
    const groups = new Map<string, Row[]>();
    for (const r of this.rows()) {
      const key = r.t.id;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(r);
    }
    return Array.from(groups.entries())
      .map(([templateId, rows]) => {
        const template = this.templates().find((t) => t.id === templateId)!;
        const doneCount = rows.filter((r) => r.o.status === 'done').length;
        const skippedCount = rows.filter((r) => r.o.status === 'skipped').length;
        const canceledCount = rows.filter((r) => r.o.status === 'canceled').length;
        const expiredCount = rows.filter((r) => r.o.status === 'expired').length;
        return {
          template,
          rows: rows.sort((a, b) => (b.o.doneAt ?? b.o.createdAt).localeCompare(a.o.doneAt ?? a.o.createdAt)),
          doneCount,
          skippedCount,
          canceledCount,
          expiredCount,
          expanded: this.serieExpandedMap.get(templateId) ?? false,
        } as SerieGroup;
      })
      .sort((a, b) => b.doneCount - a.doneCount);
  });

  protected readonly byModulo = computed(() => {
    const groups = new Map<TodoModule, Row[]>();
    const modules: TodoModule[] = ['financas', 'compras', 'casa', 'saude', 'geral'];
    for (const m of modules) groups.set(m, []);
    for (const r of this.rows()) {
      const m = r.t.module;
      groups.set(m, [...(groups.get(m) ?? []), r]);
    }
    return Array.from(groups.entries())
      .filter(([, rows]) => rows.length > 0)
      .map(([module, rows]) => ({
        module,
        label: this.moduloLabel(module),
        rows: rows.sort((a, b) => (b.o.doneAt ?? b.o.createdAt).localeCompare(a.o.doneAt ?? a.o.createdAt)),
      } as ModuloGroup));
  });

  protected readonly byStatus = computed(() => {
    const statuses: TodoStatus[] = ['done', 'skipped', 'canceled', 'expired'];
    const labels = { done: 'Feitas', skipped: 'Puladas', canceled: 'Canceladas', expired: 'Expiradas' };
    return statuses.map((status) => {
      const rows = this.rows().filter((r) => r.o.status === status);
      return {
        status,
        label: labels[status],
        count: rows.length,
        rows: rows.sort((a, b) => (b.o.doneAt ?? b.o.createdAt).localeCompare(a.o.doneAt ?? a.o.createdAt)),
      } as StatusGroup;
    });
  });

  protected readonly statusRows = computed(() => {
    return this.byStatus().find((s) => s.status === this.currentStatus())?.rows ?? [];
  });

  protected readonly weeks = computed(() => {
    const now = new Date();
    const weekCells: WeekCell[] = [];
    for (let i = 0; i < 4; i++) {
      const endDate = new Date(now);
      endDate.setDate(now.getDate() - i * 7);
      const startDate = new Date(endDate);
      startDate.setDate(endDate.getDate() - 6);
      const weekNo = this.getWeekNumber(startDate);
      const doneCount = this.rows().filter((r) => {
        const d = new Date(r.o.doneAt ?? r.o.dueDate ?? r.o.createdAt);
        return d >= startDate && d <= endDate && r.o.status === 'done';
      }).length;
      const totalCount = this.rows().filter((r) => {
        const d = new Date(r.o.doneAt ?? r.o.dueDate ?? r.o.createdAt);
        return d >= startDate && d <= endDate;
      }).length;
      weekCells.push({
        week: weekNo,
        startDate,
        endDate,
        label: `${startDate.getDate()}-${endDate.getDate()}`,
        doneCount,
        totalCount,
      });
    }
    return weekCells.reverse();
  });

  protected readonly frequency = computed(() => {
    const freq: FrequencyItem[] = [];
    const templateMap = new Map(this.templates().map((t) => [t.id, t]));
    for (const [templateId, rows] of new Map([...this.rows().reduce((m, r) => {
      const key = r.t.id;
      if (!m.has(key)) m.set(key, []);
      m.get(key)!.push(r);
      return m;
    }, new Map<string, Row[]>())]).entries()) {
      const template = templateMap.get(templateId);
      if (template) {
        const doneCount = rows.filter((r) => r.o.status === 'done').length;
        freq.push({ template, doneCount, totalCount: rows.length });
      }
    }
    return freq.sort((a, b) => b.doneCount - a.doneCount);
  });

  protected readonly maxFreq = computed(() => Math.max(...this.frequency().map((f) => f.totalCount), 1));

  protected toggleSerie(group: SerieGroup): void {
    const expanded = this.serieExpandedMap.get(group.template.id) ?? false;
    this.serieExpandedMap.set(group.template.id, !expanded);
  }

  private formatDate(dateStr: string): string {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('pt-BR', { weekday: 'short', month: 'short', day: '2-digit' });
  }

  private moduloLabel(module: TodoModule): string {
    const labels: Record<TodoModule, string> = {
      financas: 'Finanças',
      compras: 'Compras',
      casa: 'Casa',
      saude: 'Saúde',
      geral: 'Geral',
    };
    return labels[module];
  }

  private getWeekNumber(d: Date): number {
    const first = new Date(d.getFullYear(), 0, 1);
    const onejan = first;
    return Math.ceil(((d.getTime() - onejan.getTime()) / 86400000 + onejan.getDay() + 1) / 7);
  }
}
