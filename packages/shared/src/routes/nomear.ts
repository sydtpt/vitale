/**
 * O que a pedalada grava depois de a porta responder (ADR 0042 · story 5.7).
 *
 * Este arquivo era a sequência inteira: montava o prompt, chamava o modelo por um
 * chamador injetado pelo hospedeiro, lia a resposta, conferia e montava a frase.
 * Desde a 5.7 quem percorre isso é o orquestrador, sobre `descritorDoNomeDeRota`
 * — e o que sobra aqui é a **tradução**: a `Leitura` do orquestrador vira a linha
 * de `activities` (`route_name` e `route_name_meta`), ou nada.
 *
 * ## Duas naturezas de "não deu", e a diferença importa
 *
 * **Recusa** é permanente: a rota é degenerada, o modelo devolveu coisa ilegível,
 * a conferência reprovou. Fica registrada em `route_name_meta` e não adianta
 * tentar de novo com o mesmo prompt — é a marca que impede a pedalada de voltar
 * ao gatilho a cada abertura.
 *
 * **Erro** é transitório: rede caiu, prazo estourou, a function está fora.
 * `metaDaLeitura` devolve `null`, **nada é gravado**, e a pedalada é tentada de
 * novo na próxima abertura. Gravar recusa num caso desses queimaria a rota para
 * sempre por causa de um timeout.
 *
 * A diferença chega pronta do orquestrador, na `causa` do piso: só `mudo`,
 * `saida-invalida` e `reprovada` escrevem. Qualquer outra — inclusive as que
 * recuam — não escreve nada.
 */
import type { Leitura } from '../ia/orquestrar';
import { REGRA_SEM_MOLDE, leituraDoNome, type FatosDoNome } from './descritor';
import { PROMPT_NOME_VERSAO } from './prompt';
import type { Lingua, NomePreenchido, RouteShape } from './types';

/**
 * Por que a rota não ganhou nome, quando a recusa é permanente.
 *
 * `truncado` **não é mais escrito**: pela porta, o motivo de parada que não é
 * conclusão para na borda da nuvem (`ia/nuvem.ts`) e chega como `saida-invalida`
 * sem resposta assinada — e recusa sem assinatura não grava (ver o ramo de
 * `saida-invalida` em {@link metaDaLeitura}). Na prática o truncado passou a ser
 * **tentado de novo**, o que é defensável: um estouro de tokens pode não se
 * repetir no pedido seguinte. O valor continua no tipo porque linhas antigas o
 * têm.
 */
export type MotivoDaRecusa =
  | 'degenerada'
  | 'truncado'
  | 'ilegivel'
  | 'reprovado'
  | 'sem-molde';

/** O que vai para `activities.route_name_meta`. */
export interface RouteNameMeta {
  forma: RouteShape;
  lingua: Lingua;
  regiao: string | null;
  artigo: string | null;
  via: string | null;
  justificativa: string[];
  versaoPrompt: number;
  provedor?: string;
  modelo?: string;
  tokens?: { entrada: number; saida: number };
  /** Ausente quando houve nome. Presente = recusa registrada, e o porquê. */
  recusa?: MotivoDaRecusa;
  detalhe?: string;
  em: string;
}

export interface ResultadoDoNome {
  nome: string | null;
  meta: RouteNameMeta;
}

/** A fonte da resposta, como a assinatura do orquestrador a carimbou. */
interface Fonte {
  provedor?: string;
  modelo?: string;
  tokens?: { entrada: number; saida: number };
}

/** As peças que o modelo escreveu, como colunas da meta. */
function daPecas(pecas: NomePreenchido): Pick<RouteNameMeta, 'regiao' | 'artigo' | 'via' | 'justificativa'> {
  return {
    regiao: pecas.regiao ?? null,
    artigo: pecas.artigo ?? null,
    via: pecas.via ?? null,
    justificativa: [...pecas.justificativa],
  };
}

/**
 * A `Leitura` do orquestrador → o que gravar, ou `null` quando não se grava.
 *
 * Pura: recebe o relógio, não o lê. `null` **não é falha** — é "esta execução não
 * concluiu nada permanente", e a pedalada volta ao gatilho.
 *
 * | causa do piso | grava |
 * |---|---|
 * | `mudo` | `degenerada` — `montarPedido` recusou a rota, sem gastar chamada |
 * | `saida-invalida` **com** tentativa recusada | `ilegivel`, com o `detalhe` |
 * | `saida-invalida` **sem** ela | nada — ninguém escreveu (ver o ramo) |
 * | `reprovada` | `reprovado`, ou `sem-molde` quando foi essa a regra |
 * | qualquer outra | nada |
 */
export function metaDaLeitura(
  leitura: Leitura<NomePreenchido>,
  fatos: FatosDoNome,
  agora: Date,
): ResultadoDoNome | null {
  const derivada = leituraDoNome(fatos);
  const base: RouteNameMeta = {
    forma: derivada.forma,
    lingua: derivada.lingua,
    regiao: null,
    artigo: null,
    via: null,
    justificativa: [],
    versaoPrompt: PROMPT_NOME_VERSAO,
    em: agora.toISOString(),
  };

  if (leitura.origem === 'motor') {
    return {
      nome: leitura.frase,
      meta: { ...base, ...daPecas(leitura.valor), ...fonteDa(leitura.resposta) },
    };
  }

  // O piso. A causa decide se há o que gravar; a recusa com resultado, o que
  // acompanha — provedor, modelo, tokens e o que o modelo tentou escrever.
  const recusado = leitura.recusado;
  const fonte = recusado ? fonteDa(recusado.resposta) : {};
  const ultima = leitura.trilha[leitura.trilha.length - 1];

  if (leitura.causa === 'mudo') return { nome: null, meta: { ...base, recusa: 'degenerada' } };

  if (leitura.causa === 'saida-invalida') {
    /*
     * **Só a saída que um motor de fato escreveu é recusa permanente.**
     *
     * `saida-invalida` tem duas origens, e só uma é o modelo: a interpretação do
     * descritor (o JSON que não se lê, o motivo de parada que não é conclusão) e
     * a borda da nuvem em casos que não são resposta nenhuma — "corpo ilegível"
     * (um 2xx com HTML de gateway), "resposta sem texto", "resposta sem
     * assinatura" (`ia/nuvem.ts`). Nos três últimos ninguém escreveu, e gravar
     * seria queimar a pedalada por causa de um soluço de proxy: `route_name_meta`
     * é a própria marca do gatilho, e a spec proíbe reprocessar.
     *
     * A tentativa recusada é a prova de que houve modelo: ela só existe com
     * resposta assinada. Sem ela, nada é gravado e a pedalada volta ao gatilho.
     */
    if (!recusado) return null;
    return {
      nome: null,
      meta: {
        ...base,
        ...fonte,
        recusa: 'ilegivel',
        ...(ultima?.detalhe !== undefined ? { detalhe: ultima.detalhe } : {}),
      },
    };
  }

  if (leitura.causa === 'reprovada') {
    const problemas = recusado?.problemas ?? ultima?.problemas ?? [];
    const semMolde = problemas.some((p) => p.regra === REGRA_SEM_MOLDE);
    return {
      nome: null,
      meta: {
        ...base,
        ...(recusado?.valor ? daPecas(recusado.valor) : {}),
        ...fonte,
        recusa: semMolde ? 'sem-molde' : 'reprovado',
        ...(problemas.length > 0
          ? { detalhe: problemas.map((p) => `${p.regra}: ${p.detalhe}`).join(' · ') }
          : {}),
      },
    };
  }

  return null;
}

/** A assinatura carimbada → as colunas de auditoria da meta. */
function fonteDa(resposta: { assinatura: { provedor: string; modelo: string }; tokens?: { entrada: number; saida: number } }): Fonte {
  return {
    provedor: resposta.assinatura.provedor,
    modelo: resposta.assinatura.modelo,
    ...(resposta.tokens ? { tokens: { entrada: resposta.tokens.entrada, saida: resposta.tokens.saida } } : {}),
  };
}
