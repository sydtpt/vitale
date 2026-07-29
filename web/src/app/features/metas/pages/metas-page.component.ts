import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { PageHeaderComponent } from '@shared/components/page-header/page-header.component';
import type { Goal, GoalProgress } from '@vitale/shared';
import { GoalsStore } from '../data/goals.store';
import { GoalEditorComponent } from '../components/goal-editor.component';
import {
  familyLabel,
  goalValueText,
  goalPct,
  goalPeriodCells,
  isMonthlyCadence,
  type GoalPeriodCell,
} from '../data/goal-format';

interface GoalVM {
  goal: Goal;
  family: string;
  value: string;
  pct: number;
  achieved: boolean;
  /** Sub-períodos cumpridos/não cumpridos (só cadência). */
  periods: GoalPeriodCell[];
  /** Grade rotulada de 12 meses (cadência mensal) vs. faixa de semanas. */
  monthly: boolean;
}

@Component({
  selector: 'rt-metas-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PageHeaderComponent, GoalEditorComponent],
  templateUrl: './metas-page.component.html',
  styleUrl: './metas-page.component.scss',
})
export class MetasPageComponent {
  protected readonly store = inject(GoalsStore);
  protected readonly editorOpen = signal(false);
  protected readonly editing = signal<Goal | null>(null);
  protected readonly selectedCat = signal<string>('todas');

  constructor() {
    void this.store.load();
  }

  private vm(goal: Goal, p: GoalProgress | undefined): GoalVM {
    return {
      goal,
      family: familyLabel(goal.family),
      value: p ? goalValueText(goal, p) : '—',
      pct: p ? goalPct(p) : 0,
      achieved: p?.achieved ?? false,
      periods: p ? goalPeriodCells(goal, p) : [],
      monthly: isMonthlyCadence(goal),
    };
  }

  /** Metas ativas visíveis, aplicando o filtro de categoria. */
  protected readonly filtered = computed<GoalVM[]>(() => {
    const progress = this.store.progressById();
    const cat = this.selectedCat();
    return this.store
      .goals()
      .filter((g) => cat === 'todas' || g.cat === cat)
      .map((g) => this.vm(g, progress.get(g.id)));
  });

  protected readonly subtitle = computed(() => {
    const goals = this.store.goals();
    if (goals.length === 0) return 'Nenhuma meta ainda';
    const progress = this.store.progressById();
    const avg = Math.round(
      goals.reduce((s, g) => s + (progress.get(g.id)?.pct ?? 0), 0) / goals.length,
    );
    return `${goals.length} ${goals.length === 1 ? 'meta ativa' : 'metas ativas'} · progresso médio ${avg}%`;
  });

  protected setCat(cat: string): void {
    this.selectedCat.set(cat);
  }

  protected openNew(): void {
    this.editing.set(null);
    this.editorOpen.set(true);
  }
  protected openEdit(g: Goal): void {
    this.editing.set(g);
    this.editorOpen.set(true);
  }
  protected onSaved(): void {
    this.editorOpen.set(false);
  }

  protected remove(g: Goal): void {
    if (window.confirm(`Remover a meta "${g.title}"?`)) void this.store.deleteGoal(g.id);
  }
}
