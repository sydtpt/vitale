/**
 * O caminho inteiro do nome, num lugar só (ADR 0042).
 *
 * Roda no aparelho, e recebe **quem chama o modelo como argumento**. É essa
 * inversão que mantém o núcleo puro: aqui não há `fetch`, não há chave e não há
 * nome de fornecedor — só a sequência prompt → leitura → conferência → frase,
 * que os testes percorrem inteira com um chamador falso.
 *
 * ## Duas naturezas de "não deu", e a diferença importa
 *
 * **Recusa** é permanente: a rota é degenerada, o modelo devolveu coisa
 * ilegível, a conferência reprovou. Fica registrada em `route_name_meta` e não
 * adianta tentar de novo com o mesmo prompt.
 *
 * **Erro** é transitório: rede caiu, provedor sem cota. Este módulo **deixa a
 * exceção subir**, porque quem chama é que sabe se vale repetir — e porque
 * gravar recusa num caso desses queimaria a rota para sempre por causa de um
 * timeout.
 */
import { montarNome } from './molde';
import { lerRespostaDoModelo, montarPromptDeNome, PROMPT_NOME_VERSAO, type PromptDeNome } from './prompt';
import { lerRota } from './shape';
import { verificarNome } from './verificar';
import type { HomeAnchor, Lingua, RouteFacts, RouteShape } from './types';

/** O que o chamador devolve. Espelha a `Narracao` da edge function, sem conhecê-la. */
export interface RespostaDoModelo {
  texto: string;
  provedor?: string;
  modelo?: string;
  /** `STOP` é conclusão. Qualquer outra coisa significa truncado — e JSON truncado não é JSON. */
  motivoDeParada?: string;
  tokens?: { entrada: number; saida: number };
}

export type ChamadorDeModelo = (prompt: PromptDeNome) => Promise<RespostaDoModelo>;

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

export interface NomearOpts {
  /** Injetável para o teste não depender do relógio. */
  agora?: () => Date;
}

export async function nomearRota(
  rota: RouteFacts,
  ancoras: readonly HomeAnchor[],
  chamar: ChamadorDeModelo,
  opts: NomearOpts = {},
): Promise<ResultadoDoNome> {
  const agora = (opts.agora ?? (() => new Date()))().toISOString();
  const leitura = lerRota(rota, ancoras);

  const base = {
    forma: leitura.forma,
    lingua: leitura.lingua,
    regiao: null,
    artigo: null,
    via: null,
    justificativa: [] as string[],
    versaoPrompt: PROMPT_NOME_VERSAO,
    em: agora,
  };

  // O portão sai ANTES da chamada. Uma rota de 0 km não custa um token.
  if (leitura.forma === 'degenerada') {
    return { nome: null, meta: { ...base, recusa: 'degenerada' } };
  }

  const resposta = await chamar(montarPromptDeNome(leitura, rota));
  const fonte = {
    provedor: resposta.provedor,
    modelo: resposta.modelo,
    tokens: resposta.tokens,
  };

  // JSON truncado é sintaticamente inválido e cairia em `ilegivel` de qualquer
  // jeito; nomear a causa de verdade poupa a investigação seguinte.
  if (resposta.motivoDeParada && resposta.motivoDeParada !== 'STOP') {
    return {
      nome: null,
      meta: { ...base, ...fonte, recusa: 'truncado', detalhe: resposta.motivoDeParada },
    };
  }

  const pecas = lerRespostaDoModelo(resposta.texto);
  if (!pecas) {
    return { nome: null, meta: { ...base, ...fonte, recusa: 'ilegivel' } };
  }

  const comPecas = {
    ...base,
    ...fonte,
    regiao: pecas.regiao ?? null,
    artigo: pecas.artigo ?? null,
    via: pecas.via ?? null,
    justificativa: [...pecas.justificativa],
  };

  const veredito = verificarNome(rota, leitura, pecas);
  if (!veredito.ok) {
    return {
      nome: null,
      meta: {
        ...comPecas,
        recusa: 'reprovado',
        detalhe: veredito.problemas.map((p) => `${p.regra}: ${p.detalhe}`).join(' · '),
      },
    };
  }

  const nome = montarNome(leitura, pecas, rota.distanceM);
  if (!nome) {
    return { nome: null, meta: { ...comPecas, recusa: 'sem-molde' } };
  }

  return { nome, meta: comPecas };
}
