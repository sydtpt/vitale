import { ChangeDetectionStrategy, Component, computed, inject, signal, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import type { TodoModule } from '@vitale/shared';
import { DEFAULT_HABIT_ICON, MOD } from '@vitale/shared';
import { PageHeaderComponent } from '@shared/components/page-header/page-header.component';
import { IconComponent } from '@core/services/icon.component';
import { RegistrosStore } from '../data/registros.store';
import { MODULE_LABEL } from '../data/registro-logic';
import { RegistroEditorComponent } from '../components/registro-editor.component';
import { RegistroAnalyticsCardComponent } from '../components/registro-analytics-card.component';

@Component({
  selector: 'rt-registros-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, RouterLink, PageHeaderComponent, IconComponent, RegistroEditorComponent, RegistroAnalyticsCardComponent],
  templateUrl: './registros-page.component.html',
  styleUrl: './registros-page.component.scss',
})
export class RegistrosPageComponent {
  protected readonly store = inject(RegistrosStore);
  private readonly router = inject(Router);
  protected readonly DEFAULT_ICON = DEFAULT_HABIT_ICON;
  protected readonly count = computed(() => this.store.registros().filter((r) => r.active).length);

  protected readonly activeRegistros = computed(() => this.store.registros().filter((r) => r.active));
  protected readonly archivedRegistros = computed(() => this.store.registros().filter((r) => !r.active));

  @ViewChild(RegistroEditorComponent) editor!: RegistroEditorComponent;

  readonly editingId = signal<string | null>(null);
  readonly showList = signal(true);

  constructor() {
    void this.store.load();
  }

  openNew() {
    this.editingId.set(null);
    this.editor?.open();
  }

  openEdit(id: string) {
    this.editingId.set(id);
    this.editor?.open();
  }

  /** Linha e card de análise abrem o detalhe (CAP-5) — ativo ou arquivado. */
  goDetail(id: string) {
    void this.router.navigate(['/registros', id]);
  }

  async toggleToday(id: string) {
    try {
      await this.store.toggleToday(id);
    } catch (e) {
      console.error('Erro ao marcar registro:', e);
    }
  }

  async archive(id: string, active: boolean) {
    try {
      await this.store.archiveRegistro(id, active);
    } catch (e) {
      console.error('Erro ao arquivar registro:', e);
    }
  }

  toggleView() {
    this.showList.set(!this.showList());
  }

  isDoneToday(id: string): boolean {
    return this.store.isDoneToday(id);
  }

  moduleLabel(m: TodoModule): string {
    return MODULE_LABEL[m] ?? 'Geral';
  }

  modColor(key: string): { tint: string; accent: string } {
    return (MOD as Record<string, { tint: string; accent: string }>)[key] ?? MOD.habito;
  }
}
