/**
 * Prontidão no carrossel da Hoje — lógica de apresentação do terceiro slide.
 *
 * Tudo aqui é puro: recebe o `ReadinessScore` do núcleo e devolve texto. O slide
 * só desenha o que sai daqui, como `form-curve-view.ts` faz com a curva — e é
 * isto que se testa, sem renderizar nada.
 *
 * O arquivo nasceu por causa de uma linha de layout. O slide tem altura fixa, e
 * um rótulo que quebra em duas linhas empurra o conteúdo para fora do trilho:
 * `Variabilidade (VFC)` e `Anéis de atividade` não cabem na largura da coluna de
 * rótulo, quebram, e é por isso que o cartão solto media ~257 pt contra os 214
 * do trilho. Aqui cada componente tem versão curta, e quem desenha corta em uma
 * linha — assim um rótulo novo no núcleo não pode mais esticar o cartão calado.
 *
 * Desde o portão de frescor ele carrega uma segunda responsabilidade: **dizer de
 * quando é cada sinal**. Um componente velho continua desenhado, apagado, com a
 * idade ao lado — mostrar a barra e esconder a data seria repetir, em miniatura,
 * o defeito que o portão fecha.
 */
import {
  READINESS_BAND_LABEL,
  READINESS_STALE_DAYS,
  type ReadinessComponent,
  type ReadinessKey,
  type ReadinessScore,
} from '@vitale/shared';

/** Rótulo curto por componente — cabe em uma linha na coluna de 92 pt. */
export const READINESS_SHORT_LABEL: Record<ReadinessKey, string> = {
  sono: 'Sono',
  fcRepouso: 'FC repouso',
  vfc: 'VFC',
  aneis: 'Anéis',
  carga: 'Carga',
};

/** Versão curta do rótulo; cai no rótulo do núcleo se surgir uma chave nova. */
export function shortLabel(c: ReadinessComponent): string {
  return READINESS_SHORT_LABEL[c.key] ?? c.label;
}

/** O slide só existe com pelo menos um sinal medido. */
export function canShowReadiness(score: ReadinessScore): boolean {
  return score.components.length > 0;
}

/** Legenda do cabeçalho quando todos os sinais chegaram frescos. */
export const READINESS_CAPTION = 'sono · coração · atividade · carga';

/**
 * A legenda do cabeçalho. Com cobertura parcial ela deixa de **listar** os
 * sinais e passa a **contá-los** — e o que ela conta são os que pontuam, não os
 * que existem.
 *
 * O núcleo obriga quem exibe o score a mostrar `coverage < 1`, e o cartão nunca
 * mostrou: a prontidão rodou de 17/07 até setembro com 75% da informação
 * exibindo a mesma legenda de sempre, porque a média renormaliza sobre o que
 * existe e um score sem VFC parece tão completo quanto um cheio. Ver ADR 0026.
 */
export function coverageNote(score: ReadinessScore): string {
  const total = score.components.length + score.missing.length;
  const fresh = score.components.length - score.stale.length;
  if (total === 0) return READINESS_CAPTION;
  if (fresh === total) return READINESS_CAPTION;
  return `${fresh} de ${total} sinais`;
}

/** A nota, ou o travessão quando o núcleo se recusou a dar uma. */
export function scoreText(score: ReadinessScore): string {
  return score.total === null ? '—' : String(score.total);
}

/** A palavra da faixa ao lado da nota; vazia quando não há nota. */
export function bandText(score: ReadinessScore): string {
  return score.band === null ? '' : READINESS_BAND_LABEL[score.band];
}

/** Leitura acessível do cabeçalho — o travessão não se lê sozinho. */
export function scoreLabel(score: ReadinessScore): string {
  if (score.total === null) return `Prontidão de hoje indisponível: ${coverageNote(score)}`;
  return `Prontidão de hoje: ${score.total} de 100, ${bandText(score)}`;
}

/**
 * De quando é a leitura, em três palavras. Vazio quando a idade é desconhecida
 * ou é de hoje — o normal não precisa de legenda, só o desvio.
 */
export function ageNote(c: ReadinessComponent): string {
  if (c.ageDays === null || c.ageDays <= 0) return '';
  if (c.ageDays === 1) return 'ontem';
  return `${c.ageDays} d`;
}

/**
 * Por que não há nota, em uma frase, para o rodapé do slide.
 *
 * Vazia quando há nota — aí quem fala é o `readinessAdvice`. As duas razões
 * pedem textos diferentes: o sinal que **não chegou** se resolve sincronizando;
 * o que chegou **velho** se resolve usando o relógio.
 */
export function noScoreNote(score: ReadinessScore): string {
  if (score.total !== null) return '';
  if (score.components.length === 0) return 'Nenhum sinal medido ainda.';

  const velhos = score.stale.length;
  if (velhos > 0) {
    const sinal = velhos === 1 ? 'sinal está' : 'sinais estão';
    return `${velhos} ${sinal} com mais de ${READINESS_STALE_DAYS} dias. Sem dado de hoje, não dá nota.`;
  }
  return 'Poucos sinais para uma nota — falta mais da metade.';
}

/** Título curto do rodapé sem nota, no lugar do título do conselho. */
export const NO_SCORE_TITLE = 'Sem nota hoje';
