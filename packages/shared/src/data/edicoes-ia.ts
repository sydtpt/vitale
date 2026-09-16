/**
 * Acesso à tabela `edicoes_ia` — dono único (AD-4).
 * Spec: docs/specs/ia-analitica/spec.md · ADRs 0038 e 0040 · Story 1.9.
 *
 * **A edição é uma linha por CADERNO**, não por período. A chave é
 * `(user_id, tipo_periodo, inicio, fim, caderno)` e a ordem do miolo é a coluna
 * `posicao` — coluna, e não array, porque um array com a ordem do conjunto
 * guardado em cada parte é uma chance de divergir por linha.
 *
 * Este módulo só lê e grava linhas: quem decide *se* um período merece edição é
 * o `periodoFechado` (`period/fechado.ts`), quem decide se um texto pode virar
 * edição é a conferência do descritor, percorrida pelo orquestrador, e quem
 * decide a ORDEM é o `ordenarCadernos` (`ia/ranqueamento.ts`) — na impressão
 * (`ia/imprimir.ts`), uma vez, e nunca no caminho de leitura. A leitura tira a ordem de `posicao` e pronto; se ela
 * recalculasse, ajustar um peso do ranqueamento em novembro reordenaria agosto
 * sozinho, que é reescrita silenciosa de período fechado.
 *
 * Sem paginação de propósito: são ~68 períodos por ano (52 semanas + 12 meses +
 * 4 estações) e até quatro cadernos em cada, muito abaixo do teto de 1000 do
 * PostgREST — e a leitura aqui é de UM período.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { AGG_VERSION } from '../constants/agg-version';
import type { LinhaDaImpressao, PortasDaImpressao } from '../ia/imprimir';
import { CADERNO_IDS, isCadernoId, type CadernoId } from '../period/cadernos';
import type { PeriodKind } from '../period/bounds';

/**
 * Os tipos de período que **podem** ter edição — a mesma lista do CHECK de
 * `tipo_periodo`, nas duas tabelas, cobrada pelo `architecture.test.ts`.
 *
 * `all` fica de fora porque período que nunca fecha não tem edição, por
 * definição. A consequência é de tela e não é detalhe: o Total não é um período
 * "ainda não escrito", é um período que **nunca** terá linha — e anunciar
 * pendência nele seria prometer uma edição que não pode existir.
 */
export type TipoComEdicao = Exclude<PeriodKind, 'all'>;

export const TIPOS_COM_EDICAO: readonly TipoComEdicao[] =
  Object.freeze(['week', 'month', 'season', 'year']);

export function temEdicao(kind: PeriodKind): kind is TipoComEdicao {
  return (TIPOS_COM_EDICAO as readonly string[]).includes(kind);
}

export function isTipoComEdicao(v: unknown): v is TipoComEdicao {
  return typeof v === 'string' && (TIPOS_COM_EDICAO as readonly string[]).includes(v);
}

/**
 * Linha como o PostgREST a devolve (snake_case).
 *
 * **`tipo_periodo` e `caderno` são `string` aqui de propósito, e só aqui.** Esta
 * interface descreve o que chega do fio, não o que o domínio aceita: apertá-la
 * para a união seria afirmar, no sistema de tipos, uma garantia que o transporte
 * não dá — e, pior, tornaria desnecessária a conferência que `toCadernoImpresso`
 * faz. É a mesma escolha de `CapaRow.natureza`, pelo mesmo motivo. O aperto vive
 * do outro lado da fronteira: em {@link CadernoImpresso}, na linha da impressão
 * e nos parâmetros, onde `'mounth'` deixa de compilar.
 */
export interface EdicaoRow {
  user_id: string;
  tipo_periodo: string;
  inicio: string;
  fim: string;
  caderno: string;
  posicao: number;
  texto: string;
  provedor: string;
  modelo: string;
  prompt_versao: number;
  pacote_versao: number;
  motivo_de_parada: string;
  tokens_entrada: number;
  tokens_saida: number;
  agg_version_no_momento: number;
  metrica_lider: string | null;
  gerado_em: string;
}

/**
 * Um caderno impresso — uma linha de `edicoes_ia`, com assinatura própria.
 *
 * A assinatura é por linha porque a errata é por linha: o caderno de Sono fica
 * velho sem tocar no de Movimento.
 */
export interface CadernoImpresso {
  tipoPeriodo: TipoComEdicao;
  inicio: string;
  fim: string;
  caderno: CadernoId;
  /** 1 a N sobre os cadernos que a edição TEM. Congelada na última impressão. */
  posicao: number;
  texto: string;
  /** A linha de crédito (ADR 0040) — quem escreveu, com o quê, quando. */
  provedor: string;
  modelo: string;
  promptVersao: number;
  pacoteVersao: number;
  aggVersionNoMomento: number;
  /**
   * A chave da métrica que liderou o ranqueamento (AD-17), ou `null`.
   *
   * **Nulo é declaração, não omissão**: "nenhuma métrica liderou" — o caderno
   * entrou pela lápide, ou nada dele passou no portão de amostra. O anuário do
   * Épico 3 lê isso como lacuna declarada; uma sentinela inventaria uma chave
   * que não existe.
   */
  metricaLider: string | null;
  geradoEm: string;
}

/**
 * A edição de um período: os cadernos que ela tem, **na ordem gravada**.
 *
 * Vazia quer dizer "ainda não impressa". Nunca são necessariamente quatro — 22
 * dos 39 meses do backfill têm um caderno só.
 */
export type Edicao = readonly CadernoImpresso[];

/**
 * As colunas pedidas ao PostgREST.
 *
 * Uma coluna esquecida aqui não é erro: é `undefined` chegando ao mapeamento e
 * seguindo para a tela. `edicoes-ia.test.ts` compara esta lista com as chaves de
 * {@link EdicaoRow} e projeta as linhas do fake por ela, para que esquecer
 * `caderno`, `posicao` ou `metrica_lider` reprove em vez de passar verde.
 */
export const EDICAO_COLUMNS = 'user_id,tipo_periodo,inicio,fim,caderno,posicao,texto,provedor,modelo,'
  + 'prompt_versao,pacote_versao,motivo_de_parada,tokens_entrada,tokens_saida,'
  + 'agg_version_no_momento,metrica_lider,gerado_em';

const COLUMNS = EDICAO_COLUMNS;

/**
 * Linha do Postgres → caderno. **Conferido, não convertido por `as`.**
 *
 * Simétrico ao `toCapa` do módulo irmão, e pelo mesmo argumento escrito lá: os
 * CHECKs tornam o valor desconhecido impossível, o que faz do cast a escrita mais
 * tentadora e a pior. No dia em que um CHECK for afrouxado — ou em que a linha
 * vier de outro lugar, um backfill, um `psql` à mão —, o valor estranho atravessa
 * até a tela e o sintoma aparece longe daqui: um caderno sem nome, uma edição que
 * não desenha. Explodir alto na fronteira é o comportamento certo para um estado
 * que o banco afirma não existir.
 *
 * A entrega anterior escrevia `r.caderno as CadernoId` — exatamente o cast que o
 * módulo irmão recusa por escrito, na mesma entrega.
 */
export function toCadernoImpresso(r: EdicaoRow): CadernoImpresso {
  if (!isCadernoId(r.caderno)) {
    throw new Error(
      `caderno desconhecido: ${JSON.stringify(r.caderno)} — os quatro são `
      + `${CADERNO_IDS.join(', ')}, e o CHECK de edicoes_ia.caderno deveria ter recusado este.`,
    );
  }
  if (!isTipoComEdicao(r.tipo_periodo)) {
    throw new Error(
      `tipo de período sem edição possível: ${JSON.stringify(r.tipo_periodo)} — os quatro são `
      + `${TIPOS_COM_EDICAO.join(', ')}, e o CHECK de edicoes_ia.tipo_periodo deveria ter recusado este.`,
    );
  }
  return {
    tipoPeriodo: r.tipo_periodo,
    inicio: r.inicio,
    fim: r.fim,
    caderno: r.caderno,
    posicao: r.posicao,
    texto: r.texto,
    provedor: r.provedor,
    modelo: r.modelo,
    promptVersao: r.prompt_versao,
    pacoteVersao: r.pacote_versao,
    aggVersionNoMomento: r.agg_version_no_momento,
    metricaLider: r.metrica_lider,
    geradoEm: r.gerado_em,
  };
}

/**
 * A edição de um período — os cadernos impressos, ordenados por `posicao`.
 *
 * **Sem `maybeSingle`, e isso é o ponto da Story 1.9.** Enquanto a chave era o
 * período, uma linha era o máximo possível; com o caderno na chave, o mesmo
 * período casa até quatro e `.maybeSingle()` passa a lançar PGRST116 — quebrando
 * a tela **ao abrir**, não só ao gravar.
 *
 * A ordem vem do banco, não de `ordenarCadernos`: ela congelou na impressão.
 */
export async function fetchEdicao(
  db: SupabaseClient,
  userId: string,
  tipoPeriodo: TipoComEdicao,
  inicio: string,
  fim: string,
): Promise<CadernoImpresso[]> {
  const { data, error } = await db
    .from('edicoes_ia')
    .select(COLUMNS)
    .eq('user_id', userId)
    .eq('tipo_periodo', tipoPeriodo)
    .eq('inicio', inicio)
    .eq('fim', fim)
    .order('posicao', { ascending: true });
  if (error) throw error;
  return ((data ?? []) as unknown as EdicaoRow[]).map(toCadernoImpresso);
}

/**
 * Uma linha da carga de `edicao_imprimir` — as colunas do `jsonb_to_recordset`
 * da função, na grafia do banco.
 *
 * `edicoes-ia.test.ts` compara estas chaves com o recordset **lido da
 * migração**: uma coluna que a função passe a exigir e que falte aqui reprova lá,
 * e não em produção com "linha recusada".
 */
export interface LinhaDaCarga {
  caderno: CadernoId;
  texto: string;
  provedor: string;
  modelo: string;
  prompt_versao: number;
  pacote_versao: number;
  motivo_de_parada: string;
  tokens_entrada: number;
  tokens_saida: number;
  agg_version_no_momento: number;
  metrica_lider: string | null;
}

/** A linha que a sequência entregou, virada carga — com a versão da agregação carimbada aqui. */
function paraCarga(l: LinhaDaImpressao): LinhaDaCarga {
  return {
    caderno: l.caderno,
    texto: l.texto,
    provedor: l.provedor,
    modelo: l.modelo,
    prompt_versao: l.promptVersao,
    pacote_versao: l.pacoteVersao,
    motivo_de_parada: l.motivoDeParada,
    tokens_entrada: l.tokensEntrada,
    tokens_saida: l.tokensSaida,
    agg_version_no_momento: AGG_VERSION,
    // Escrito mesmo quando nulo: a função recusa a linha sem a chave.
    metrica_lider: l.metricaLider,
  };
}

/**
 * As duas portas da impressão, ligadas a um cliente — é o que o hospedeiro passa
 * a `imprimir` (`ia/imprimir.ts`).
 *
 * - **`buscar`** é `fetchEdicao`: os cadernos já impressos do período, na ordem
 *   gravada. É por ele que a sequência não apaga o texto de um caderno cuja
 *   regeneração caiu no piso.
 * - **`gravar`** é a função `edicao_imprimir`, numa chamada, com o conjunto
 *   inteiro. Ela grava o texto dos regenerados, ajusta a posição de todos e apaga
 *   o caderno que saiu (AD-4) — a única escrita em `edicoes_ia` que existe. A
 *   linha devolvida é a edição relida, mapeada por `toCadernoImpresso`.
 *
 * **Não há mais porta de escrita direta.** O `upsertEdicao` da 1.9 gravava um
 * caderno por vez, contornando a função e a contiguidade das posições, e saiu na
 * 1.10. Uma barreira do `architecture.test.ts` cobra que `edicao_imprimir` só
 * seja nomeada aqui, que nenhum `.upsert/.insert/.update/.delete` alcance
 * `edicoes_ia`, e que `.gravar` só seja lido pela sequência.
 *
 * **A versão da agregação é lida aqui, nunca recebida.** Ela chegava por quatro
 * passagens opcionais em fila (tela → store → adaptador → campo) e o que chegava
 * era `undefined`: as 7 edições antigas tinham nulo na coluna, e nenhuma era
 * elegível a errata. Tornar a passagem obrigatória fecharia a *omissão* e deixaria
 * aberto o *valor errado* — `PACOTE_VERSAO` é `number`, sai do mesmo barril e
 * compilaria no lugar dela. A linha da sequência não tem o campo, e a carga o
 * carimba de `AGG_VERSION` no ponto de gravação; uma barreira cobra que o literal
 * da coluna não apareça em código fora de `data/`.
 *
 * **O dono é conferido antes de gravar.** `buscar` lê com o `userId` passado, e a
 * função grava para `auth.uid()` — a sessão do cliente no instante do `rpc`. Uma
 * impressão leva um minuto ou mais, e se a conta trocar nesse meio o texto
 * escrito sobre os dados de um dono cairia na edição do outro. `gravar` relê a
 * sessão e, se ela não é mais de `userId`, lança {@link ContaTrocadaNaImpressao}
 * sem chamar a função.
 */
export class ContaTrocadaNaImpressao extends Error {
  constructor(esperado: string, naSessao: string | null) {
    super(
      `a impressão começou para ${esperado} e a sessão agora é de ${naSessao ?? 'ninguém'} — `
      + 'nada foi gravado, para o texto de um dono não cair na edição de outro',
    );
    this.name = 'ContaTrocadaNaImpressao';
  }
}

export function portasDaEdicao(db: SupabaseClient, userId: string): PortasDaImpressao<CadernoImpresso[]> {
  return {
    buscar: (p) => fetchEdicao(db, userId, p.tipoPeriodo, p.inicio, p.fim),
    gravar: async (i) => {
      const sessao = await db.auth.getSession();
      if (sessao.error) throw sessao.error;
      const naSessao = sessao.data.session?.user?.id ?? null;
      if (naSessao !== userId) throw new ContaTrocadaNaImpressao(userId, naSessao);

      const { data, error } = await db.rpc('edicao_imprimir', {
        p_tipo_periodo: i.tipoPeriodo,
        p_inicio: i.inicio,
        p_fim: i.fim,
        p_ordem: [...i.ordem],
        p_linhas: i.linhas.map(paraCarga),
      });
      if (error) throw error;
      return ((data ?? []) as unknown as EdicaoRow[]).map(toCadernoImpresso);
    },
  };
}

/**
 * O caderno está **desatualizado** quando a agregação que o sustentava mudou.
 *
 * Não dispara regravação: dispara a errata. O jornal não reescreve terça — marca
 * que o número mudou e deixa o leitor decidir se quer a edição nova.
 *
 * Por caderno, e não por edição, porque a assinatura é por linha. `metrica_lider`
 * não entra na conta: ele é o que liderou, não o que sustentava o número.
 *
 * **Sem guarda de nulo, e isso é consequência da migração.** Ela apagou as 7
 * linhas legadas e tornou a coluna `not null`: "não foi medido" deixou de ser um
 * estado possível desta coluna, que é a exceção nomeada da gramática de ausência
 * (AD-16). Um `!= null` aqui seria uma condição sempre verdadeira fingindo ser
 * uma regra — e o teste dela só existiria com um cast para fabricar o estado que
 * o banco proíbe.
 *
 * O que continua sendo regra é a comparação ser `!==` e não verdade: **zero é uma
 * medida**, e `if (c.aggVersionNoMomento && …)` a engoliria junto com o nulo.
 */
export function precisaErrata(c: CadernoImpresso, aggVersionAtual: number): boolean {
  return c.aggVersionNoMomento !== aggVersionAtual;
}
