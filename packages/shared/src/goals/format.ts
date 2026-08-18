/**
 * Formatação de exibição das metas no mobile. Espelha web/…/data/goal-format.ts
 * (lógica pura sobre @vitale/shared) — mantido duplicado por plataforma, como
 * habit-logic. Progresso é sempre DERIVADO por evaluateGoal.
 */
import type { Goal } from '../models';
import type { GoalPeriodStatus, GoalProgress } from './evaluate';

const PERIOD_LABEL: Record<'week' | 'month', [string, string]> = {
  week: ['semana', 'semanas'],
  month: ['mês', 'meses'],
};

const MONTHS_SHORT = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

const FAMILY_LABEL: Record<Goal['family'], string> = {
  cadence: 'Cadência',
  milestone: 'Marco',
  cumulative: 'Acumulada',
};

export function familyLabel(f: Goal['family']): string {
  return FAMILY_LABEL[f];
}

/** Meta cujo valor é uma distância em metros (exibida em km). */
function isDistance(goal: Goal): boolean {
  return goal.source.kind === 'activity' && goal.source.activityMetric === 'distance';
}

/** Meta binária (marco por best-effort) — ex.: meia-maratona. */
function isBinaryMilestone(goal: Goal): boolean {
  return (
    goal.family === 'milestone' &&
    goal.source.kind === 'activity' &&
    goal.source.activityMetric === 'bestEffort'
  );
}

function fmt(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

/** Texto "atual / alvo" adequado à família da meta. */
export function goalValueText(goal: Goal, p: GoalProgress): string {
  if (goal.family === 'cadence') {
    const [sing, plu] = PERIOD_LABEL[goal.period ?? 'month'];
    return `${p.periodsMet ?? p.current}/${p.target} ${p.target === 1 ? sing : plu}`;
  }
  if (isBinaryMilestone(goal)) {
    return p.achieved ? 'Concluída' : 'Pendente';
  }
  if (isDistance(goal)) {
    return `${fmt(p.current / 1000)} / ${fmt(p.target / 1000)} km`;
  }
  const unit = goal.unit ? ` ${goal.unit}` : '';
  return `${fmt(p.current)} / ${fmt(p.target)}${unit}`;
}

export function goalPct(p: GoalProgress): number {
  return Math.round(p.pct);
}

/** Estado visual de um sub-período de cadência. */
export type GoalPeriodState = 'met' | 'missed' | 'current' | 'future';

/** Célula pronta para render: rótulo curto (mês) e estado (cor). */
/** Célula pronta para render: rótulo curto, estado (cor) e detalhe (tooltip). */
export interface GoalPeriodCell {
  label: string;
  state: GoalPeriodState;
  /** Descrição longa do período — o web usa como `title`; o mobile ignora. */
  title: string;
}

const MONTHS_FULL = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

const STATE_TEXT: Record<GoalPeriodState, string> = {
  met: 'cumprido',
  missed: 'não cumprido',
  current: 'em andamento',
  future: 'a fazer',
};

function periodState(s: GoalPeriodStatus): GoalPeriodState {
  if (s.met) return 'met';
  if (s.current) return 'current';
  if (s.started) return 'missed';
  return 'future';
}

/** É uma cadência mensal (12 células rotuladas por mês)? */
export function isMonthlyCadence(goal: Goal): boolean {
  return goal.family === 'cadence' && (goal.period ?? 'month') === 'month';
}

/**
 * Detalhamento por sub-período de uma meta de cadência — meses/semanas cumpridos
 * ou não. Vazio para metas que não são de cadência. Espelha a web.
 */
export function goalPeriodCells(goal: Goal, p: GoalProgress): GoalPeriodCell[] {
  if (goal.family !== 'cadence' || !p.periods) return [];
  const monthly = isMonthlyCadence(goal);
  const per = goal.perPeriodTarget ?? 1;
  return p.periods.map((s) => {
    const d = new Date(s.start);
    const state = periodState(s);
    const name = monthly
      ? MONTHS_FULL[d.getMonth()]
      : `Semana de ${d.toLocaleDateString('pt-BR')}`;
    return {
      label: monthly ? MONTHS_SHORT[d.getMonth()] : '',
      state,
      title: `${name} · ${s.count}/${per} · ${STATE_TEXT[state]}`,
    };
  });
}
