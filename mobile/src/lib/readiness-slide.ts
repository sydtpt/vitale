/**
 * Prontidão no carrossel da Hoje — lógica de apresentação do terceiro slide.
 *
 * Tudo aqui é puro: recebe o `ReadinessScore` do núcleo e devolve texto. O slide
 * só desenha o que sai daqui, como `form-curve-view.ts` faz com a curva — e é
 * isto que se testa, sem renderizar nada.
 *
 * O arquivo existe por causa de uma linha de layout. O slide tem altura fixa, e
 * um rótulo que quebra em duas linhas empurra o conteúdo para fora do trilho:
 * `Variabilidade (VFC)` e `Anéis de atividade` não cabem na largura da coluna de
 * rótulo, quebram, e é por isso que o cartão solto media ~257 pt contra os 214
 * do trilho. Aqui cada componente tem versão curta, e quem desenha corta em uma
 * linha — assim um rótulo novo no núcleo não pode mais esticar o cartão calado.
 */
import type { ReadinessComponent, ReadinessScore } from '@vitale/shared';

/** Rótulo curto por componente — cabe em uma linha na coluna de 92 pt. */
export const READINESS_SHORT_LABEL: Record<ReadinessComponent['key'], string> = {
  sono: 'Sono',
  fcRepouso: 'FC repouso',
  vfc: 'VFC',
  aneis: 'Anéis',
};

/** Versão curta do rótulo; cai no rótulo do núcleo se surgir uma chave nova. */
export function shortLabel(c: ReadinessComponent): string {
  return READINESS_SHORT_LABEL[c.key] ?? c.label;
}

/** O slide só existe com pelo menos um sinal medido. */
export function canShowReadiness(score: ReadinessScore): boolean {
  return score.components.length > 0;
}

/** Legenda do cabeçalho quando todos os sinais chegaram. */
export const READINESS_CAPTION = 'sono · coração · atividade';

/**
 * A legenda do cabeçalho. Com cobertura parcial ela deixa de **listar** os sinais
 * e passa a **contá-los**.
 *
 * O núcleo obriga quem exibe o score a mostrar `coverage < 1`, e o cartão solto
 * nunca mostrou: a prontidão rodou de 17/07 até setembro com 75% da informação
 * exibindo a mesma legenda de sempre, porque a média renormaliza sobre o que
 * existe e um score sem VFC parece tão completo quanto um cheio. Ver ADR 0026.
 */
export function coverageNote(score: ReadinessScore): string {
  const total = score.components.length + score.missing.length;
  if (total === 0 || score.missing.length === 0) return READINESS_CAPTION;
  return `${score.components.length} de ${total} sinais`;
}
