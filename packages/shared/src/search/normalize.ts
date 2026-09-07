/**
 * Normalização e casamento de texto para a busca (spec busca-textual §4).
 *
 * Duas decisões que valem repetir aqui, porque um refactor ingênuo desfaz as
 * duas sem quebrar teste de tipo:
 *
 * 1. **Prefixo de palavra, não trecho solto.** `pierre` acha
 *    *Woluwe-Saint-Pierre* porque o hífen é separador; `elles` NÃO acha
 *    *Ixelles*, porque casar no meio da palavra transforma qualquer consulta
 *    curta numa rede de arrasto. Trocar `startsWith` por `includes` é a
 *    regressão mais fácil de cometer nesse arquivo.
 *
 * 2. **A tokenização derruba tudo que não é `[a-z0-9]`.** Isso é intencional e
 *    tem consequência: uma variante em cirílico ou grego vira string vazia. Não
 *    é perda — a lista fechada de apelidos (`geocode.ts`) é toda em escrita
 *    latina.
 */

/** Minúscula e sem acento. `Brüssel` → `brussel`, `Bruxelles` → `bruxelles`. */
export function normalizar(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

/**
 * Palavras de um texto, normalizadas. Separa em tudo que não é letra ou
 * dígito — `Woluwe-Saint-Pierre` vira `['woluwe','saint','pierre']`, e é por
 * isso que digitar `pierre` acha a cidade.
 */
export function tokenizar(s: string): string[] {
  return normalizar(s).split(/[^a-z0-9]+/).filter(Boolean);
}

/** Consulta curta demais não busca — devolve a lista normal, não o vazio. */
export const MIN_CONSULTA = 2;

/**
 * Há busca ativa? Distinguir isto de "busquei e não achei" é o que impede a
 * tela de mostrar o estado vazio para quem só tocou no campo (CAP-7).
 */
export function consultaAtiva(consulta: string): boolean {
  return tokenizar(consulta).join('').length >= MIN_CONSULTA;
}

/** Algum token do texto começa com este pedaço? */
export function casaToken(pedaco: string, tokens: readonly string[]): boolean {
  return tokens.some((t) => t.startsWith(pedaco));
}

/**
 * Todos os pedaços da consulta casam neste conjunto de tokens?
 *
 * O **E** entre os tokens da consulta é o que faz `tour meuse` achar
 * *Tour de la Meuse-Rhin* e não *Tour de la Wallonie Picarde*.
 */
export function casaTudo(pedacos: readonly string[], tokens: readonly string[]): boolean {
  return pedacos.every((p) => casaToken(p, tokens));
}
