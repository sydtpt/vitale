/**
 * As janelas do acervo, e a amostra da nuvem — puro, sem rede e sem disco.
 *
 * **Quais janelas.** As quatro que a tela navega: `7d`, `4s`, `12m` e as noites
 * (`ultima`), com todos os passos para trás que o acervo alcança — a mesma
 * enumeração da medição da 5.3 (73 + 19 + 2 + 293 = 387 no acervo de 12/09).
 * `ano` fica fora: o acervo cobre dois anos parciais, ambos `sem-contagem`, e a
 * tela já aparece nas outras quatro.
 *
 * **Como a parada é decidida.** Pelo que `entradaDaSaude` devolve, nunca por
 * aritmética de calendário escrita aqui: um período para quando a janela dele
 * acaba antes da primeira noite gravada; as noites param quando não há mais noite
 * naquele passo. A fórmula do período tem um dono (`entradaDaSaude`, AD-11), e a
 * bancada não é o segundo — ela só pergunta.
 *
 * **A amostra da nuvem.** A coluna sem modelo mede todas as janelas: é
 * determinística e de graça. A da nuvem custa chamada, então mede, por padrão, até
 * **duas janelas por caso × alcance, as mais recentes** — no máximo 28 chamadas,
 * com os sete casos cobertos na noite e no período. Pedir a nuvem sobre as 387 é
 * decisão do dono, pelo `--limite`.
 *
 * Agrupar por caso × alcance, e não por hash de pedido, é deliberado: o pedido
 * separa também *quais* dimensões são nomeadas (`duas` tem dez combinações), e a
 * amostra viraria centenas de chamadas para medir a mesma pergunta.
 */
import { casoDaSaude, entradaDaSaude, isValidDate, type AlcanceDaSaude, type SleepPeriod, type SonoRange } from '@vitale/shared';
import type { CasoDaSaude, MotivoSemContagem } from '@vitale/shared';

/** Um passo do seletor: o alcance e quantos períodos para trás. */
export interface Janela {
  readonly range: SonoRange;
  readonly offset: number;
}

/** A janela com o que o código já decidiu sobre ela — o caso é do núcleo, nunca daqui. */
export interface JanelaClassificada extends Janela {
  readonly alcance: AlcanceDaSaude;
  readonly caso: CasoDaSaude['caso'];
  /** Só em `sem-contagem`: por que não houve contagem. */
  readonly motivo?: MotivoSemContagem;
}

/**
 * Os alcances medidos, **na ordem do relatório**. A ordem também desempata a
 * amostra: entre duas janelas igualmente recentes, vem a do alcance mais curto.
 */
export const ALCANCES_MEDIDOS: readonly SonoRange[] = Object.freeze(['7d', '4s', '12m', 'ultima']);

/** O padrão da amostra da nuvem: duas janelas por caso × alcance. */
export const LIMITE_DA_AMOSTRA = 2;

/** A regra da amostra, como o manifesto a registra. */
export const REGRA_DA_AMOSTRA = 'as mais recentes, por caso x alcance';

/**
 * Teto de segurança do laço. Não é regra de produto: é a rede contra um acervo com
 * data absurda (uma noite gravada em 1970 faria `12m` andar 56 vezes, e uma em
 * 1900, 126) e contra um `entradaDaSaude` que algum dia deixasse de fechar a
 * janela. 2000 passos cobrem 38 anos de `7d`.
 *
 * Alcançá-lo **lança**. Truncar em silêncio seria pior que não ter teto: o manifesto
 * registraria 2000 passos como se fosse o alcance real do acervo, e dois relatórios
 * de acervos diferentes ficariam com a mesma cara.
 */
export const TETO_DE_PASSOS = 2000;

function classificar(
  noites: readonly SleepPeriod[],
  notas: Readonly<Record<string, number>>,
  range: SonoRange,
  offset: number,
  hoje: string,
): { readonly classificada: JanelaClassificada; readonly until: string | null; readonly since: string | null } {
  const e = entradaDaSaude(noites, notas, { range, offset, hoje });
  const caso = casoDaSaude(e.score);
  return {
    classificada: {
      range,
      offset,
      alcance: e.alcance,
      caso: caso.caso,
      ...(caso.caso === 'sem-contagem' ? { motivo: caso.motivo } : {}),
    },
    until: e.janela.until,
    since: e.janela.since,
  };
}

/**
 * Todas as janelas do acervo, já classificadas, na ordem de {@link ALCANCES_MEDIDOS}
 * e, dentro de cada alcance, do mais recente para o mais antigo.
 *
 * `hoje` é um dia local `AAAA-MM-DD`, como a tela e a bancada o passam — nada
 * depois dele entra, e a enumeração não lê o relógio.
 */
export function enumerarJanelas(
  noites: readonly SleepPeriod[],
  notas: Readonly<Record<string, number>>,
  hoje: string,
): JanelaClassificada[] {
  // Antes de qualquer coisa, e não só quando há noite: um `hoje` malformado
  // compara como string contra `wakeDay` e daria "nenhuma janela" em silêncio,
  // que é o que um acervo vazio também dá. `entradaDaSaude` lança pelo mesmo
  // motivo, e aqui o acervo pode nem chegar até ela.
  if (!isValidDate(hoje)) throw new RangeError(`hoje tem de ser um dia AAAA-MM-DD real, e veio ${JSON.stringify(hoje)}`);
  const gravadas = noites.filter((p) => p.wakeDay <= hoje).map((p) => p.wakeDay).sort();
  const primeiro = gravadas[0];
  const out: JanelaClassificada[] = [];
  if (primeiro === undefined) return out;

  for (const range of ALCANCES_MEDIDOS) {
    let acabou = false;
    for (let offset = 0; offset < TETO_DE_PASSOS; offset += 1) {
      const { classificada, until, since } = classificar(noites, notas, range, offset, hoje);
      if (range === 'ultima') {
        // Sem noite neste passo: o acervo acabou. `ultima` sem noite tem os dois
        // limites nulos — é o único caso em que `since` nulo quer dizer "não há".
        if (since === null) {
          acabou = true;
          break;
        }
      } else if (until !== null && until < primeiro) {
        // A janela inteira é anterior à primeira noite gravada. A corrente
        // (`offset` 0) tem `until` nulo e nunca cai aqui.
        acabou = true;
        break;
      }
      out.push(classificada);
    }
    if (!acabou) {
      throw new Error(
        `a enumeração de ${range} bateu no teto de ${TETO_DE_PASSOS} passos sem alcançar o começo do acervo ` +
          `(primeira noite: ${primeiro}, hoje: ${hoje}).\n` +
          '  O manifesto registraria o teto como se fosse o alcance real. Confira a data da noite mais antiga — ' +
          'uma linha com ano errado faz o acervo parecer décadas mais longo.',
      );
    }
  }
  return out;
}

/** A ordem do relatório: alcance declarado, e o passo mais recente primeiro. */
function ordemDoRelatorio(a: Janela, b: Janela): number {
  const ia = ALCANCES_MEDIDOS.indexOf(a.range);
  const ib = ALCANCES_MEDIDOS.indexOf(b.range);
  return ia !== ib ? ia - ib : a.offset - b.offset;
}

/** "Mais recente" primeiro: passo menor ganha; empate vai para o alcance mais curto. */
function ordemDaAmostra(a: Janela, b: Janela): number {
  return a.offset !== b.offset ? a.offset - b.offset : ALCANCES_MEDIDOS.indexOf(a.range) - ALCANCES_MEDIDOS.indexOf(b.range);
}

/**
 * A amostra da nuvem: até `limite` janelas por caso × alcance, as mais recentes.
 *
 * `limite` 0 é amostra vazia — é como se pede uma execução sem gastar chamada
 * nenhuma. Limite que não seja inteiro ≥ 0 é defeito de quem chamou, e lança.
 */
export function amostraDaNuvem(
  classificadas: readonly JanelaClassificada[],
  limite: number = LIMITE_DA_AMOSTRA,
): JanelaClassificada[] {
  if (!Number.isInteger(limite) || limite < 0) {
    throw new RangeError(`limite tem de ser um inteiro >= 0, e veio ${String(limite)}`);
  }
  const grupos = new Map<string, JanelaClassificada[]>();
  for (const j of classificadas) {
    const chave = `${j.caso}|${j.alcance}`;
    const grupo = grupos.get(chave);
    if (grupo) grupo.push(j);
    else grupos.set(chave, [j]);
  }
  const out: JanelaClassificada[] = [];
  for (const grupo of grupos.values()) {
    out.push(...[...grupo].sort(ordemDaAmostra).slice(0, limite));
  }
  return out.sort(ordemDoRelatorio);
}

/** Quantos passos cada alcance tem — o que o manifesto descreve. */
export function passosPorAlcance(classificadas: readonly JanelaClassificada[]): { range: SonoRange; passos: number }[] {
  return ALCANCES_MEDIDOS.map((range) => ({
    range,
    passos: classificadas.filter((j) => j.range === range).length,
  })).filter((x) => x.passos > 0);
}

/** A chave de uma janela, para casar colunas e linhas entre execuções. */
export function chaveDaJanela(j: Janela): string {
  return `${j.range}@${j.offset}`;
}
