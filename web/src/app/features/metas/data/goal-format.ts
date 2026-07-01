/** Formatação de exibição das metas — compartilhada pela página e pelo preview da Semana. */
import type { Goal, GoalProgress } from '@vitale/shared';

const PERIOD_LABEL: Record<'week' | 'month', [string, string]> = {
  week: ['semana', 'semanas'],
  month: ['mês', 'meses'],
};

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
