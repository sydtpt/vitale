/**
 * Os períodos **fechados** de um arquivo — a lista que a impressão em massa
 * percorre (Story 2.3).
 *
 * ## O que ela é, e o que ela não é
 *
 * Uma enumeração pura: mês, trimestre e ano que **começam** em `desdeISO` ou
 * depois e que já fecharam em `agora`. Não consulta banco, não sabe o que já foi
 * impresso e não decide o que imprimir — quem cruza esta lista com o arquivo é o
 * hospedeiro.
 *
 * ## Semana fica de fora, e não por economia
 *
 * Semana **não grava edição**: o postal da Retrospectiva a calcula na hora
 * (contrato do Épico 2). Imprimir 170 semanas em massa gravaria linhas que
 * nenhum caminho de leitura toca — e o tipo desta função as recusa antes de
 * qualquer laço, em vez de deixar a recusa para uma bandeira do script.
 *
 * ## `all` também fica, pelo motivo de sempre
 *
 * O Total nunca fecha: sempre cabe mais um dia. `periodoFechado` já responde
 * isso, e `TIPOS_EM_MASSA` não o nomeia.
 *
 * ## A ordem é pelo FIM, e o mais curto primeiro
 *
 * "Cronológica" tem duas leituras quando três tipos convivem, e a que serve a uma
 * corrida longa é a do **fechamento**: tudo que fechou antes imprime antes. Assim
 * uma corrida interrompida parou num ponto do calendário, e não no meio de três
 * listas paralelas. Dezembro de 2024, o Q4 de 2024 e o ano de 2024 fecham no
 * mesmo dia — e aí o mais curto vem primeiro, que é a ordem em que um leitor os
 * escreveria: o mês, o trimestre, o ano.
 */
import { localDateStr } from '../date/local';
import { periodBounds } from './bounds';
import { periodoFechado } from './fechado';

/**
 * Os três tipos que a impressão em massa enumera, **do mais curto ao mais
 * longo** — e a ordem desta lista é a do desempate (ver o cabeçalho).
 *
 * Não é `TIPOS_COM_EDICAO` menos a semana: é uma lista própria, porque a
 * exclusão da semana é uma regra desta enumeração e não da tabela. A tabela
 * aceita semana; a impressão em massa é que não a escreve.
 */
export const TIPOS_EM_MASSA = Object.freeze(['month', 'season', 'year'] as const);

/** Mês, trimestre ou ano — os tipos de {@link TIPOS_EM_MASSA}. */
export type TipoEmMassa = (typeof TIPOS_EM_MASSA)[number];

export function isTipoEmMassa(v: unknown): v is TipoEmMassa {
  return typeof v === 'string' && (TIPOS_EM_MASSA as readonly string[]).includes(v);
}

/** Um período fechado do arquivo, com tudo que a impressão precisa dele. */
export interface PeriodoFechado {
  readonly tipo: TipoEmMassa;
  /** O primeiro dia, `YYYY-MM-DD` local. É a chave da edição. */
  readonly inicio: string;
  /** O último dia, inclusivo — o `fim` da chave da edição. */
  readonly fim: string;
  /** O `offset` visto de `agora`, para `periodBounds` e `retroSince`. */
  readonly offset: number;
  /** `"Maio 2026"`, `"Q3 2023"`, `"2024"` — o rótulo de `periodBounds`. */
  readonly rotulo: string;
}

/** O último dia (inclusivo) de um intervalo `[start, end)` de `periodBounds`. */
function ultimoDia(end: Date): string {
  return localDateStr(new Date(end.getFullYear(), end.getMonth(), end.getDate() - 1));
}

/**
 * Os períodos fechados que começam em `desdeISO` ou depois, em ordem
 * cronológica — mês, trimestre e ano, **nunca semana**.
 *
 * `desdeISO` é um dia `YYYY-MM-DD` e a comparação é sobre o **começo** do
 * período: um mês que começou antes dele fica de fora inteiro, mesmo que a maior
 * parte dele venha depois. É a régua mais simples de explicar e a única que não
 * imprime período com metade da matéria fora do arquivo — maio de 2023, que
 * começou 21 dias antes do primeiro registro, seria narrado como se os 21 dias
 * vazios fossem dias sem nada.
 *
 * O período **em curso** e o **futuro** ficam de fora por `periodoFechado`: a
 * mesma regra da rota da revista e do script de um período só.
 *
 * Lança se `desdeISO` não é uma data `YYYY-MM-DD` — um `desde` ilegível
 * enumeraria desde o ano 2000, e o erro apareceria como uma conta de chamadas
 * absurda em vez de como o que é.
 */
export function periodosFechadosDesde(desdeISO: string, agora: Date): PeriodoFechado[] {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(desdeISO)) {
    throw new RangeError(`o começo do arquivo não é uma data AAAA-MM-DD: ${JSON.stringify(desdeISO)}`);
  }
  const out: PeriodoFechado[] = [];
  for (const tipo of TIPOS_EM_MASSA) {
    // Do período corrente para trás. O corrente e o que ainda não fechou são
    // pulados (`continue`), e não param o laço: o ano corrente é aberto e os
    // anteriores não são.
    for (let offset = 0; ; offset -= 1) {
      const b = periodBounds(agora, tipo, offset);
      const inicio = localDateStr(b.start);
      if (inicio < desdeISO) break;
      const fim = ultimoDia(b.end);
      if (!periodoFechado(tipo, fim, agora)) continue;
      out.push({ tipo, inicio, fim, offset, rotulo: b.label });
    }
  }
  const duracao = (t: TipoEmMassa): number => TIPOS_EM_MASSA.indexOf(t);
  return out.sort((a, b) => (a.fim !== b.fim ? (a.fim < b.fim ? -1 : 1) : duracao(a.tipo) - duracao(b.tipo)));
}
