import { ChangeDetectionStrategy, Component, OnInit, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { BEST_EFFORT_DISTANCES, MOD, type Goal, type GoalFamily, type GoalPeriodKind, type GoalSource, type GoalActivityMetric } from '@vitale/shared';
import { ALL_ACTIVITY_TYPES } from '@core/models/activity-types';
import { TodosStore } from '../../tasks/data/todos.store';
import { HabitsStore } from '../../habits/data/habits.store';
import { GoalsStore, type NewGoal } from '../data/goals.store';

type SourceKind = GoalSource['kind'];

const FAMILIES: { key: GoalFamily; label: string; hint: string }[] = [
  { key: 'cadence', label: 'Cadência', hint: '≥N por período ao longo do ano (ex.: correr 1x/mês)' },
  { key: 'milestone', label: 'Marco', hint: 'atingir um marco único no ano (ex.: meia-maratona)' },
  { key: 'cumulative', label: 'Acumulada', hint: 'somar até um alvo no ano (ex.: ler 12 livros)' },
];

const SOURCES: { key: SourceKind; label: string }[] = [
  { key: 'activity', label: 'Atividade' },
  { key: 'task', label: 'Tarefa' },
  { key: 'habit', label: 'Hábito' },
  { key: 'manual', label: 'Manual' },
];

const METRICS: { key: GoalActivityMetric; label: string }[] = [
  { key: 'count', label: 'Contagem' },
  { key: 'distance', label: 'Distância (km)' },
  { key: 'bestEffort', label: 'Distância padrão' },
];

/**
 * As distâncias que fazem sentido como meta — um subconjunto da tabela do
 * núcleo, não uma cópia dela. Chave e rótulo vêm de lá: era a quarta lista
 * paralela no repo, e escrevia "Meia-maratona" enquanto o resto do app escreve
 * sem hífen.
 */
const GOAL_EFFORT_KEYS = new Set(['5000', '10000', 'half', 'marathon']);
const BEST_EFFORTS = BEST_EFFORT_DISTANCES.filter((d) => GOAL_EFFORT_KEYS.has(d.key));

@Component({
  selector: 'rt-goal-editor',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule],
  templateUrl: './goal-editor.component.html',
  styleUrl: './goal-editor.component.scss',
})
export class GoalEditorComponent implements OnInit {
  private readonly store = inject(GoalsStore);
  protected readonly todosStore = inject(TodosStore);
  protected readonly habitsStore = inject(HabitsStore);

  readonly goal = input<Goal | null>(null);
  readonly close = output<void>();
  readonly saved = output<void>();

  protected readonly families = FAMILIES;
  protected readonly sources = SOURCES;
  protected readonly metrics = METRICS;
  protected readonly bestEfforts = BEST_EFFORTS;
  protected readonly activityTypes = ALL_ACTIVITY_TYPES;
  protected readonly colors = [
    { key: 'treino', accent: MOD.treino.accent },
    { key: 'habito', accent: MOD.habito.accent },
    { key: 'financas', accent: MOD.financas.accent },
    { key: 'casa', accent: MOD.casa.accent },
    { key: 'compras', accent: MOD.compras.accent },
    { key: 'tarefa', accent: MOD.tarefa.accent },
  ];

  protected readonly saving = signal(false);

  protected title = '';
  protected year = new Date().getFullYear();
  protected cat = 'treino';
  protected family: GoalFamily = 'cadence';
  protected sourceKind: SourceKind = 'activity';
  // activity
  protected activityAny = false;
  protected activityId = 37;
  protected metric: GoalActivityMetric = 'count';
  protected bestEffortKey = 'half';
  // task / habit
  protected templateId = '';
  protected habitId = '';
  // manual
  protected manualCurrent = 0;
  // cadence
  protected period: GoalPeriodKind = 'month';
  protected perPeriodTarget = 1;
  protected cadenceTarget = 12;
  // milestone/cumulative
  protected target = 1; // interpretado pela família (km quando métrica distância)
  protected unit = '';

  constructor() {
    void this.todosStore.load();
    void this.habitsStore.load();
  }

  ngOnInit(): void {
    const g = this.goal();
    if (!g) return;
    this.title = g.title;
    this.year = g.year;
    this.cat = g.cat || 'treino';
    this.family = g.family;
    this.sourceKind = g.source.kind;
    if (g.source.kind === 'activity') {
      this.activityAny = g.source.activityId == null;
      this.activityId = g.source.activityId ?? 37;
      this.metric = g.source.activityMetric ?? 'count';
      this.bestEffortKey = g.source.bestEffortKey ?? 'half';
    }
    if (g.source.kind === 'task') this.templateId = g.source.templateId ?? '';
    if (g.source.kind === 'habit') this.habitId = g.source.habitId ?? '';
    this.manualCurrent = g.manualCurrent ?? 0;
    this.period = g.period ?? 'month';
    const ppt = g.perPeriodTarget ?? 1;
    const isDistCadence =
      g.family === 'cadence' && g.source.kind === 'activity' && g.source.activityMetric === 'distance';
    this.perPeriodTarget = isDistCadence ? ppt / 1000 : ppt;
    this.unit = g.unit ?? '';
    if (g.family === 'cadence') {
      this.cadenceTarget = g.target;
    } else {
      this.target = this.isDistance() ? g.target / 1000 : g.target;
    }
  }

  protected setPeriod(p: GoalPeriodKind): void {
    this.period = p;
    // default de períodos do ano ao trocar (o usuário ainda pode ajustar).
    this.cadenceTarget = p === 'week' ? 52 : 12;
  }

  /** Só séries com recorrência ativa podem ser fonte de uma meta (avulsas não). */
  protected recurringTemplates() {
    return this.todosStore.templates().filter((t) => t.recurrence.kind !== 'none');
  }

  /** Meta cujo valor é distância (em km na UI, metros no armazenamento). */
  protected isDistance(): boolean {
    return this.sourceKind === 'activity' && this.metric === 'distance';
  }

  protected isBestEffort(): boolean {
    return this.sourceKind === 'activity' && this.metric === 'bestEffort';
  }

  /** Explica a semântica de "Distância" (varia entre marco e acumulada). */
  protected distanceHint(): string {
    return this.family === 'milestone'
      ? 'Atingida quando UMA atividade sozinha alcança o alvo (ex.: um pedal > 100 km).'
      : 'Soma da distância de todas as atividades do ano.';
  }

  private buildSource(): GoalSource {
    switch (this.sourceKind) {
      case 'activity':
        return {
          kind: 'activity',
          activityId: this.activityAny ? undefined : Number(this.activityId),
          activityMetric: this.metric,
          bestEffortKey: this.metric === 'bestEffort' ? this.bestEffortKey : undefined,
        };
      case 'task':
        return { kind: 'task', templateId: this.templateId };
      case 'habit':
        return { kind: 'habit', habitId: this.habitId };
      case 'manual':
        return { kind: 'manual' };
    }
  }

  private buildTarget(): number {
    if (this.family === 'cadence') return Math.max(1, Math.round(Number(this.cadenceTarget)));
    if (this.isBestEffort()) return 1;
    const t = Number(this.target);
    return this.isDistance() ? t * 1000 : t;
  }

  protected valid(): boolean {
    if (this.title.trim() === '') return false;
    if (this.sourceKind === 'task' && !this.templateId) return false;
    if (this.sourceKind === 'habit' && !this.habitId) return false;
    if (this.family !== 'cadence' && !this.isBestEffort() && !(Number(this.target) > 0)) return false;
    return true;
  }

  private buildPayload(): NewGoal {
    return {
      year: Number(this.year),
      title: this.title.trim(),
      cat: this.cat,
      family: this.family,
      source: this.buildSource(),
      period: this.family === 'cadence' ? this.period : null,
      perPeriodTarget:
        this.family === 'cadence'
          ? this.isDistance()
            ? Math.max(1, Math.round(Number(this.perPeriodTarget) * 1000)) // km → metros
            : Math.max(1, Math.round(Number(this.perPeriodTarget)))
          : null,
      target: this.buildTarget(),
      unit: this.unit.trim() || null,
      manualCurrent: this.sourceKind === 'manual' ? Number(this.manualCurrent) : null,
    };
  }

  protected async onSave(): Promise<void> {
    if (!this.valid() || this.saving()) return;
    this.saving.set(true);
    try {
      const payload = this.buildPayload();
      const g = this.goal();
      if (g) await this.store.updateGoal(g.id, payload);
      else await this.store.createGoal(payload);
      this.saved.emit();
    } catch (e) {
      console.error('Erro ao salvar meta:', e);
    } finally {
      this.saving.set(false);
    }
  }
}
