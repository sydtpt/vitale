/**
 * As janelas do acervo, e a amostra das colunas de modelo — puro, sem rede, sem disco
 * e sem relógio.
 *
 * **Um dono só para a régua da bancada** (story 5.13). Isto morava em
 * `scripts/bancada/janelas.ts`; subiu para o núcleo quando o iPhone passou a medir o
 * modelo dele com a mesma amostra do Mac. O valor daquela medição é ser **comparável**
 * com a do Mac, e duas implementações da amostra divergiriam na primeira correção de uma
 * delas — o "mesmo número" viraria coincidência. A bancada do Mac
 * (`scripts/bancada/`) e a tela de desenvolvimento do app
 * (`mobile/src/app/configuracoes/motores/bancada.tsx`) leem daqui.
 *
 * **Só a tela de desenvolvimento, nos apps.** A amostra carrega o caso de cada janela, e
 * a guarda (7) mantém caso fora das telas de produto — um caso lido na tela poderia
 * discordar da frase que o orquestrador devolve. Uma barreira do `architecture.test.ts`
 * restringe este diretório, em `mobile/src` e `web/src`, àquela tela. Por isso o módulo
 * mora fora de `ia/` e de `sleep/`: lá, a guarda (7) o acharia como peça e o barraria
 * inteiro, inclusive na tela que existe para medir.
 *
 * **Quais janelas.** As quatro que a tela navega: `7d`, `4s`, `12m` e as noites
 * (`ultima`), com todos os passos para trás que o acervo alcança — a mesma enumeração da
 * medição da 5.3 (73 + 19 + 2 + 293 = 387 no acervo de 12/09). `ano` fica fora: o acervo
 * cobre dois anos parciais, ambos `sem-contagem`, e a tela já aparece nas outras quatro.
 *
 * **Como a parada é decidida.** Pelo que `entradaDaSaude` devolve, nunca por aritmética
 * de calendário escrita aqui: um período para quando a janela dele acaba antes da
 * primeira noite gravada; as noites param quando não há mais noite naquele passo. A
 * fórmula do período tem um dono (`entradaDaSaude`, AD-11), e a amostra não é o segundo —
 * ela só pergunta.
 *
 * **A amostra.** A coluna sem modelo mede todas as janelas: é determinística e de graça.
 * Uma coluna de modelo mede, por padrão, até **duas janelas por caso × alcance, as mais
 * recentes** — com os sete casos cobertos na noite e no período. Mais que isso é decisão
 * do dono (`--limite` no Mac, a escolha na tela do iPhone).
 *
 * Agrupar por caso × alcance, e não por hash de pedido, é deliberado: o pedido separa
 * também *quais* dimensões são nomeadas (`duas` tem dez combinações), e a amostra viraria
 * centenas de chamadas para medir a mesma pergunta.
 */
import type { SleepPeriod } from '../models';
import { isValidDate } from '../date/local';
import type { SonoRange } from '../sleep/ranges';
import { casoDaSaude, type CasoDaSaude, type MotivoSemContagem } from '../sleep/caso';
import { entradaDaSaude, type AlcanceDaSaude } from '../sleep/leitura';

/** Um passo do seletor: o alcance e quantos períodos para trás. */
export interface Janela {
  readonly range: SonoRange;
  readonly offset: number;
}

/** A janela com o que o código já decidiu sobre ela — o caso é do núcleo, nunca de quem mede. */
export interface JanelaClassificada extends Janela {
  readonly alcance: AlcanceDaSaude;
  readonly caso: CasoDaSaude['caso'];
  /** Só em `sem-contagem`: por que não houve contagem. */
  readonly motivo?: MotivoSemContagem;
}

/**
 * Os alcances medidos, **na ordem do relatório**. A ordem também desempata a amostra:
 * entre duas janelas igualmente recentes, vem a do alcance mais curto.
 */
export const ALCANCES_MEDIDOS: readonly SonoRange[] = Object.freeze(['7d', '4s', '12m', 'ultima']);

/** O padrão da amostra das colunas de modelo: duas janelas por caso × alcance. */
export const LIMITE_DA_AMOSTRA = 2;

/**
 * A regra da amostra, com a identidade que o manifesto do Mac registra.
 *
 * O `id` e a `versao` entram no hash do manifesto; a `descricao`, não — reescrever a
 * frase não pode invalidar manifesto nenhum. A **versão sobe quando o critério de
 * {@link amostraDaNuvem} muda**, e mora aqui, ao lado dele, para quem mudar um não
 * esquecer o outro.
 */
export const REGRA_DA_AMOSTRA = Object.freeze({
  id: 'recentes-por-caso-e-alcance',
  versao: 1,
  descricao: 'as mais recentes, por caso × alcance',
} as const);

/**
 * Teto de segurança do laço. Não é regra de produto: é a rede contra um acervo com data
 * absurda (uma noite gravada em 1970 faria `12m` andar 56 vezes, e uma em 1900, 126) e
 * contra um `entradaDaSaude` que algum dia deixasse de fechar a janela. 2000 passos cobrem
 * 38 anos de `7d`.
 *
 * Alcançá-lo **lança**. Truncar em silêncio seria pior que não ter teto: o manifesto
 * registraria 2000 passos como se fosse o alcance real do acervo, e dois relatórios de
 * acervos diferentes ficariam com a mesma cara.
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
 * Todas as janelas do acervo, já classificadas, na ordem de {@link ALCANCES_MEDIDOS} e,
 * dentro de cada alcance, do mais recente para o mais antigo.
 *
 * `hoje` é um dia local `AAAA-MM-DD`, como a tela e a bancada o passam — nada depois dele
 * entra, e a enumeração não lê o relógio.
 *
 * `notas` tem de cobrir o acervo inteiro, da noite mais antiga até hoje: a percepção muda
 * o caso, e um mapa parcial daria outra amostra que a do Mac. No app, quem garante é a
 * tela, antes de chamar isto.
 */
export function enumerarJanelas(
  noites: readonly SleepPeriod[],
  notas: Readonly<Record<string, number>>,
  hoje: string,
): JanelaClassificada[] {
  // Antes de qualquer coisa, e não só quando há noite: um `hoje` malformado compara
  // como string contra `wakeDay` e daria "nenhuma janela" em silêncio, que é o que um
  // acervo vazio também dá. `entradaDaSaude` lança pelo mesmo motivo, e aqui o acervo
  // pode nem chegar até ela.
  if (!isValidDate(hoje)) throw new RangeError(`hoje tem de ser um dia AAAA-MM-DD real, e veio ${JSON.stringify(hoje)}`);
  const primeiro = noiteMaisAntiga(noites, hoje);
  const out: JanelaClassificada[] = [];
  if (primeiro === null) return out;

  for (const range of ALCANCES_MEDIDOS) {
    let acabou = false;
    for (let offset = 0; offset < TETO_DE_PASSOS; offset += 1) {
      const { classificada, until, since } = classificar(noites, notas, range, offset, hoje);
      if (range === 'ultima') {
        // Sem noite neste passo: o acervo acabou. `ultima` sem noite tem os dois limites
        // nulos — é o único caso em que `since` nulo quer dizer "não há".
        if (since === null) {
          acabou = true;
          break;
        }
      } else if (until !== null && until < primeiro) {
        // A janela inteira é anterior à primeira noite gravada. A corrente (`offset` 0)
        // tem `until` nulo e nunca cai aqui.
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

/**
 * O dia de acordar da noite mais antiga até `hoje`, ou `null` sem noite nenhuma.
 *
 * É o começo do acervo que {@link enumerarJanelas} enumera — e, por isso, o dia desde o
 * qual as notas têm de estar carregadas: a percepção só lê a nota do dia de acordar de
 * uma noite (`periodScore`, `nightScore`), então nenhuma nota anterior a este dia muda
 * caso nenhum.
 */
export function noiteMaisAntiga(noites: readonly SleepPeriod[], hoje: string): string | null {
  let menor: string | null = null;
  for (const p of noites) {
    if (p.wakeDay <= hoje && (menor === null || p.wakeDay < menor)) menor = p.wakeDay;
  }
  return menor;
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
 * A amostra das colunas de modelo: até `limite` janelas por caso × alcance, as mais
 * recentes ({@link REGRA_DA_AMOSTRA}).
 *
 * `limite` 0 é amostra vazia — é como se pede uma execução sem gastar chamada nenhuma.
 * Limite que não seja inteiro ≥ 0 é defeito de quem chamou, e lança.
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

/** Quantos passos cada alcance tem — o que o manifesto descreve, e o topo da tela repete. */
export function passosPorAlcance(classificadas: readonly JanelaClassificada[]): { range: SonoRange; passos: number }[] {
  return ALCANCES_MEDIDOS.map((range) => ({
    range,
    passos: classificadas.filter((j) => j.range === range).length,
  })).filter((x) => x.passos > 0);
}

/**
 * O passo de uma janela como texto — `7d@3` —, para casar colunas e linhas entre
 * execuções e entre o Mac e o iPhone.
 *
 * Não é a `chaveDaJanela` do app (`mobile/src/lib/leitura-da-saude.ts`), que é outra
 * coisa: a pré-imagem inteira do pedido, com a contagem. Esta é só o endereço do passo.
 */
export function chaveDoPasso(j: Janela): string {
  return `${j.range}@${j.offset}`;
}
