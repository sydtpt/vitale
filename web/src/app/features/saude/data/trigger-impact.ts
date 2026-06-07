/**
 * Re-export do motor de impacto de gatilho, agora compartilhado em
 * `@vitale/shared` (`packages/shared/src/health/trigger-impact.ts`) para que o
 * mobile e a seção Recuperação reusem a mesma lógica. Mantido aqui para não
 * quebrar os imports existentes (card e spec da Saúde).
 */
export { triggerImpact, MIN_DAYS_PER_SIDE, type MetricImpact } from '@vitale/shared';
