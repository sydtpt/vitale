/**
 * O nome de rota como **descritor** (story 5.7, AD-2, ADR 0047).
 *
 * Era o último caminho do app que falava com modelo por fora da porta: uma
 * sequência própria em `routes/nomear.ts`, um chamador injetado pelo hospedeiro,
 * e o nome da edge function escrito à mão numa tela. Por isso o recurso não
 * aparecia no seletor, não respeitava preferência de motor, não tinha cadeia,
 * recuo nem classes de falha.
 *
 * Aqui ele é o que todo recurso é: dado e funções puras. O juízo não mudou de
 * lugar — `lerRota`, `montarPromptDeNome`, `lerRespostaDoModelo`, `verificarNome`
 * e `montarNome` são os mesmos de antes, chamados nos mesmos pontos. O que mudou
 * é **quem percorre**: o orquestrador, e mais ninguém.
 *
 * ## O corpo que chega à `ia-narrar` não muda
 *
 * O texto de `montarPromptDeNome` entra byte a byte, e `PROMPT_NOME_VERSAO`
 * continua em 2 — os 133 nomes aprovados seguem comparáveis. A saída é declarada
 * como **esquema** porque é isso que `corpoDoPedido` (`ia/nuvem.ts`) traduz em
 * `json: true`, que é o que o corpo de hoje leva. Na 5.6 o corpo passou a levar
 * junto o `esquema` como **diagnóstico** — nenhum adaptador o lê —, e é a única
 * diferença entre o corpo de antes e o de agora.
 *
 * ## Por que `interpretar` não usa `interpretarPorEsquema`
 *
 * `Esquema` não tem `null`: ausência ali é propriedade opcional. E o prompt deste
 * recurso **manda o modelo responder `null`** ("Se as cidades não formarem uma
 * região que você reconheça de verdade, devolva `regiao`: null"), que é o caso
 * mais comum de todos. Passar a resposta de hoje por `conformeAoEsquema`
 * reprovaria a maioria das pedaladas — cada `null` viraria `saida-invalida` — e
 * quebraria o recurso inteiro para ganhar rigor nenhum.
 *
 * Então a interpretação continua sendo `lerRespostaDoModelo`, que trata `null`,
 * ausência e cerca de código como a mesma coisa (nenhum valor) e recusa o que não
 * traz `justificativa`. O esquema declara a **forma pedida** — tudo opcional
 * menos a justificativa —, que é o contrato correto para uma geração guiada:
 * quem não tem região omite a chave. Há teste prendendo os dois lados disto.
 */
import { NUVEM_PADRAO, SEM_MODELO, type Esquema } from '../ia/fio';
import type { Pedido } from '../ia/motor';
import type { Conferencia, Descritor } from '../ia/orquestrar';
import { montarNome } from './molde';
import { PROMPT_NOME_VERSAO, lerRespostaDoModelo, montarPromptDeNome } from './prompt';
import { lerRota } from './shape';
import type { HomeAnchor, NomePreenchido, RouteFacts, RouteReading } from './types';
import { verificarNome } from './verificar';

/**
 * Os fatos do recurso: a rota como o banco a tem, e as casas do dono.
 *
 * **A leitura não entra aqui, é refeita.** `lerRota` é pura e barata, e cada
 * função do descritor a chama por conta própria — como o descritor da Saúde
 * refaz o caso. Guardá-la nos fatos criaria um estado combinado entre as funções
 * que o orquestrador não tem como manter coerente, e que uma delas poderia ler
 * desatualizado.
 */
export interface FatosDoNome {
  readonly rota: RouteFacts;
  readonly ancoras: readonly HomeAnchor[];
}

/** A leitura derivada destes fatos. Pura, e a mesma em todas as funções. */
export function leituraDoNome(f: FatosDoNome): RouteReading {
  return lerRota(f.rota, f.ancoras);
}

/**
 * A regra com que a conferência reprova o que o molde não monta.
 *
 * Vive aqui porque quem a escreve é o `conferir`, e quem a lê é
 * `metaDaLeitura` — é ela que separa `sem-molde` de `reprovado` na gravação.
 * Duas grafias soltas dariam duas recusas com o mesmo sintoma.
 */
export const REGRA_SEM_MOLDE = 'sem-molde';

/**
 * A forma pedida ao modelo — o mesmo objeto que o prompt descreve.
 *
 * Só `justificativa` é obrigatória: é a única chave que a conferência confere
 * contra o dado, e é a ausência dela que já hoje faz a resposta ser recusada.
 * Todo o resto é opcional, porque "não há região" é uma resposta legítima (ver o
 * cabeçalho sobre `null`).
 */
export const ESQUEMA_DO_NOME: Esquema = {
  type: 'object',
  properties: {
    regiao: { type: 'string' },
    artigo: { type: 'string' },
    via: { type: 'string' },
    viaArtigo: { type: 'string' },
    origem: { type: 'string' },
    destino: { type: 'string' },
    justificativa: { type: 'array', items: { type: 'string' }, minItems: 1 },
  },
  required: ['justificativa'],
};

function reprova(regra: string, detalhe: string): Conferencia {
  return { ok: false, problemas: [{ regra, detalhe }] };
}

/**
 * O nome de rota, pela porta. `V` são as peças que o modelo devolve.
 *
 * - **Molde**: o modelo devolve campos, e a frase sai de `montarNome` — contração
 *   é gramática, e gramática mora em código (ADR 0041).
 * - **`montarPedido` nulo na degenerada**: uma rota de 0 km não custa um token, e
 *   o portão continua saindo antes da chamada, como saía.
 * - **Cadeia padrão na nuvem**, por herança: é o que já roda em produção desde
 *   antes de a porta existir, e tirá-lo pararia de nomear pedaladas. A ADR 0050
 *   não é afrouxada — nenhuma aprovação é registrada, e o par recurso × motor
 *   segue **não medido**. A medição na bancada está na dívida.
 * - **`recusaEResultado: true`**: recusa permanente é resultado — vai gravada em
 *   `route_name_meta`, com provedor, modelo, tokens e o que o modelo tentou.
 *   É o que faz a pedalada não voltar ao gatilho para sempre.
 */
export const descritorDoNomeDeRota: Descritor<FatosDoNome, NomePreenchido> = {
  recurso: 'nome-de-rota',
  versao: PROMPT_NOME_VERSAO,
  regimeDeNumeros: 'molde',
  regimeMaximo: 'nuvem',
  cadeiaPadrao: [NUVEM_PADRAO, SEM_MODELO],
  grava: { admite: ['nuvem', 'aparelho'], recusaEResultado: true },

  montarPedido: (f): Pedido | null => {
    const leitura = leituraDoNome(f);
    // O portão sai ANTES da chamada. Uma rota de 0 km não custa um token.
    if (leitura.forma === 'degenerada') return null;
    const prompt = montarPromptDeNome(leitura, f.rota);
    return {
      sistema: prompt.sistema,
      usuario: prompt.usuario,
      // `padrao`, e não `gulosa`: é o que a function faz hoje (ela não fixa
      // temperatura), e a amostragem não viaja no corpo da nuvem — declarar
      // `gulosa` prometeria ao aparelho um determinismo que a nuvem não dá.
      amostragem: 'padrao',
      saida: { tipo: 'esquema', esquema: ESQUEMA_DO_NOME },
      guardrails: 'padrao',
    };
  },

  interpretar: (resposta) => {
    const pecas = lerRespostaDoModelo(resposta.texto);
    if (!pecas) {
      return {
        classe: 'saida-invalida',
        detalhe: `a resposta não traz as peças do nome: ${resposta.texto.slice(0, 200)}`,
      };
    }
    return pecas;
  },

  conferir: (pecas, f) => {
    const leitura = leituraDoNome(f);
    const veredito = verificarNome(f.rota, leitura, pecas);
    if (!veredito.ok) return { ok: false, problemas: veredito.problemas };
    /*
     * O molde é parte da conferência, e não do `montarFrase`, porque
     * `montarFrase` não pode desistir: ele devolve `string`. Peças válidas que
     * não montam nome nenhum — um `a-b` sem as duas pontas, um loop sem alvo —
     * são recusa, e recusa é da conferência. `montarFrase` refaz a mesma conta,
     * que é pura: nada de estado guardado entre as duas funções.
     */
    if (montarNome(leitura, pecas, f.rota.distanceM) === null) {
      return reprova(REGRA_SEM_MOLDE, 'as peças são válidas, e o molde não monta nome com elas');
    }
    return { ok: true };
  },

  montarFrase: (pecas, f) => {
    const leitura = leituraDoNome(f);
    const nome = montarNome(leitura, pecas, f.rota.distanceM);
    if (nome === null) {
      // Inalcançável: `conferir` roda antes, com as mesmas entradas puras, e já
      // reprovou este caso. Lançar é o certo — o orquestrador registra a pilha no
      // anel e deixa a exceção subir, e nada é gravado. Devolver `''` gravaria um
      // nome vazio na pedalada, que é a única saída pior que nenhuma.
      throw new TypeError('montarNome devolveu null depois de a conferência aprovar as peças');
    }
    return nome;
  },

  // Sem modelo não há nome: a região histórica não se deriva das cidades — é
  // justamente a lacuna que o recurso existe para atravessar (ADR 0041). Ausência
  // com motivo é piso válido, e é o que a pedalada sem nome mostra hoje.
  semModelo: () => ({ ausencia: 'sem modelo não há região a nomear: o percurso fica com o nome da fonte' }),
};
