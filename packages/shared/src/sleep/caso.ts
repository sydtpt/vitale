/**
 * O caso da Saúde do sono — o que a contagem diz, classificado pelo código (AD-7,
 * ADR 0049, CAP-13).
 *
 * A frase pedida nomearia "a dimensão que puxa o conjunto para baixo". Medido nas
 * 293 noites reais em 10/09/2026, ela só existe em 15% das semanas: o resto é
 * empate ou nem tem contagem. Escolher "a pior" é comparar números — e, com
 * empate, escolher no chute. Por isso quem escolhe é esta função, e o motor
 * recebe o caso pronto: **nunca os pontos para decidir**.
 *
 * ## A precedência
 *
 * Cada `SleepScore` cai em exatamente um caso, avaliado nesta ordem:
 *
 *   sem-contagem           `scored` falso, ou nenhuma dimensão medida — noite ou período
 *   medidas-insuficientes  uma dimensão medida só: não há o que comparar
 *   tudo-no-maximo         todas as medidas em 2
 *   todas-iguais           todas as medidas no mesmo ponto, abaixo de 2
 *   uma                    exatamente uma no ponto mais baixo
 *   duas                   exatamente duas no ponto mais baixo, e alguma acima
 *   fora-do-empate         três ou mais no ponto mais baixo, e alguma acima
 *
 * Dimensão não medida sai do caso (regra 4 da ADR 0036): não é zero, e não
 * empata com ninguém. O caso carrega **quantas** foram medidas, e a frase usa
 * essa contagem — nunca o "cinco" fixo.
 *
 * `nomear` é tupla no tamanho do caso — uma chave em `uma`, duas em `duas`,
 * vazia onde não se nomeia —, e o `switch` sobre `caso` estreita o resto: quem
 * consome não precisa conferir o comprimento, e um caso novo não compila até
 * cada `switch` decidir o que fazer com ele.
 *
 * Puro e sem relógio: a mesma contagem dá sempre o mesmo caso.
 */
import { SCORE_COVERAGE_FLOOR, type SleepCoverage, type SleepDimension, type SleepDimensionKey, type SleepScore } from './score';

/** Os sete casos, na ordem da precedência. */
export const CASOS_DA_SAUDE = [
  'sem-contagem',
  'medidas-insuficientes',
  'tudo-no-maximo',
  'todas-iguais',
  'uma',
  'duas',
  'fora-do-empate',
] as const;

export type NomeDoCaso = (typeof CASOS_DA_SAUDE)[number];

/**
 * Por que não há contagem — é o que decide o que a frase pode dizer.
 *
 * - `sem-noite`: o período não tem noite nenhuma.
 * - `cobertura`: o período tem noites e medidas, mas abaixo do piso. A frase diz
 *   a cobertura — e só aqui, então ela nunca diz "poucas para contar" de um
 *   período no piso.
 * - `sem-medida`: nenhuma dimensão foi medida — a noite que não existe, ou a que
 *   não tem nada medido.
 */
export type MotivoSemContagem = 'cobertura' | 'sem-noite' | 'sem-medida';

interface Comum {
  /** Quantas dimensões foram medidas — a contagem que a frase usa. */
  readonly medidas: number;
  /** As medidas, na ordem da contagem. As não medidas não entram. */
  readonly dimensoes: readonly SleepDimensionKey[];
}

export type CasoDaSaude =
  | (Comum & { readonly caso: 'sem-contagem'; readonly motivo: MotivoSemContagem; readonly nomear: readonly [] })
  | (Comum & { readonly caso: 'medidas-insuficientes' | 'tudo-no-maximo' | 'todas-iguais'; readonly nomear: readonly [] })
  | (Comum & { readonly caso: 'uma'; readonly nomear: readonly [SleepDimensionKey] })
  | (Comum & { readonly caso: 'duas'; readonly nomear: readonly [SleepDimensionKey, SleepDimensionKey] })
  | (Comum & {
      readonly caso: 'fora-do-empate';
      /** As de fora do empate — ao menos uma, na ordem da contagem. */
      readonly nomear: readonly [SleepDimensionKey, ...SleepDimensionKey[]];
      /** As de fora estão todas em 2 ("no máximo"), ou não ("acima das outras"). */
      readonly noMaximo: boolean;
    });

/**
 * O motivo, na ordem em que um exclui o outro. `cobertura` só com medida e
 * abaixo do piso; o resto sem noite é `sem-noite`, e sem medida, `sem-medida`.
 *
 * O `scored` falso com medida e cobertura no piso — que `nightScore` e
 * `periodScore` não produzem, mas o tipo admite — também é `sem-medida`: a frase
 * não inventa cobertura baixa para explicar uma contagem que não veio.
 */
function motivoSemContagem(coverage: SleepCoverage | null, medidas: number): MotivoSemContagem {
  if (coverage !== null && coverage.nights === 0) return 'sem-noite';
  if (medidas > 0 && coverage !== null && coverage.ratio < SCORE_COVERAGE_FLOOR) return 'cobertura';
  return 'sem-medida';
}

/** O caso de uma contagem, pela precedência da CAP-13. */
export function casoDaSaude(score: SleepScore): CasoDaSaude {
  const medidasDim = score.dimensions.filter((d): d is SleepDimension & { points: number } => d.points !== null);
  const dimensoes = medidasDim.map((d) => d.key);
  const medidas = dimensoes.length;

  // Ponto fora de 0–2 é contagem que não existe (`tally` dá 0, 1 ou 2): um 3
  // passaria por "no máximo" sem estar no máximo, e um 1,5 empataria com ninguém.
  for (const d of medidasDim) {
    if (!Number.isInteger(d.points) || d.points < 0 || d.points > 2) {
      throw new RangeError(`a dimensão ${d.key} tem ${String(d.points)} ponto(s), fora de 0–2`);
    }
  }

  // Sem medida não há o que contar, diga o `scored` o que disser: a frase de
  // medidas-insuficientes contaria "zero dimensões".
  if (!score.scored || medidas === 0) {
    return { caso: 'sem-contagem', medidas, dimensoes, nomear: [], motivo: motivoSemContagem(score.coverage, medidas) };
  }
  if (medidas === 1) return { caso: 'medidas-insuficientes', medidas, dimensoes, nomear: [] };

  const minimo = Math.min(...medidasDim.map((d) => d.points));
  if (minimo === 2) return { caso: 'tudo-no-maximo', medidas, dimensoes, nomear: [] };

  const noMinimo = medidasDim.filter((d) => d.points === minimo).map((d) => d.key);
  const deFora = medidasDim.filter((d) => d.points !== minimo);
  const [primeiraDeFora, ...outrasDeFora] = deFora.map((d) => d.key);
  if (primeiraDeFora === undefined) return { caso: 'todas-iguais', medidas, dimensoes, nomear: [] };

  const [a, b, ...resto] = noMinimo;
  if (b === undefined) return { caso: 'uma', medidas, dimensoes, nomear: [a] };
  if (resto.length === 0) return { caso: 'duas', medidas, dimensoes, nomear: [a, b] };
  return {
    caso: 'fora-do-empate',
    medidas,
    dimensoes,
    nomear: [primeiraDeFora, ...outrasDeFora],
    noMaximo: deFora.every((d) => d.points === 2),
  };
}
