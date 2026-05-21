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
  templateUrl: './history-view.component.html',
  styleUrl: './history-view.component.scss',
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
