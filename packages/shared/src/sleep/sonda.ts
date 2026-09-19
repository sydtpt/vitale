/**
 * A sonda de fidelidade da Saúde do sono — só para medir (AD-7, story 5.10).
 *
 * O código sabe qual dimensão destoa: é o `nomear` do caso (`sleep/caso.ts`). A frase
 * da Saúde recebe esse caso pronto e só o redige — o motor **nunca** decide (ADR 0049).
 * A sonda faz a pergunta que a leitura não faz: dá ao modelo os pontos de cada
 * dimensão medida e pede que ele escolha, entre opções fechadas, a que a leitura
 * nomearia. Se ele acerta, um dia poderia escolher; se erra, a regra da AD-7 ganha
 * evidência. É isso, e só isso.
 *
 * **Um descritor, e não uma sequência da bancada.** A AD-2 proíbe hospedeiro montando
 * pedido ou conferindo fora do orquestrador; como descritor, a sonda passa pelo `ler`
 * em modo `medicao`, pela porta que já existe — e a guarda (7) já libera todo nome com
 * prefixo `descritor`.
 *
 * **Nunca vira produto.** Não entra em `CATALOGO_DE_RECURSOS` (o seletor não a
 * lista), não grava, e a cadeia padrão dela é só `sem-modelo`: em modo produto ela
 * nunca chama modelo nenhum. O `recurso` é o da Saúde do sono porque é dela que a sonda
 * mede o motor — o mesmo `regimeMaximo`, então o dado dela vai só aonde o da leitura já
 * pode ir.
 *
 * **Só pergunta onde há resposta.** Os casos que nomeiam — `uma`, `duas` e
 * `fora-do-empate` — viram pedido; os outros quatro não têm dimensão a escolher, e o
 * pedido nulo é `mudo`: nenhuma chamada, e a linha não conta.
 *
 * A pergunta é a mesma regra que decide o `nomear`, dita ao contrário: em `uma` e
 * `duas`, "uma que esteja no ponto mais baixo" (a única, ou qualquer das duas); em
 * `fora-do-empate`, "uma que não esteja" (as de fora do empate). O modelo recebe todas
 * as medidas como opção e nenhuma indicação de qual é a certa.
 *
 * **A posição não decide.** Na ordem da contagem, a duração vem sempre primeiro — e um
 * modelo que escolhe a primeira opção acertaria toda janela em que ela é a certa. As
 * opções saem numa **permutação por janela**, determinística (a semente é o hash da
 * janela: alcance, `range` e limites), a mesma na lista do pedido e no `enum` do esquema:
 * o mesmo acervo dá o mesmo pedido, e a ordem muda de uma janela para outra.
 */
import { SEM_MODELO, conformeAoEsquema, type Esquema } from '../ia/fio';
import type { Pedido } from '../ia/motor';
import { sha256Hex } from '../ia/sha256';
import type { Conferencia, Descritor } from '../ia/orquestrar';
import { casoDaSaude, type CasoDaSaude } from './caso';
import type { EntradaDaSaude } from './leitura';
import { DIMENSION_LABEL, type SleepDimensionKey } from './score';

/** Sobe a cada mudança no pedido ou na conferência. Vai na assinatura e no hash. */
const VERSAO = 1;

/** As cinco dimensões — as opções que uma resposta pode trazer, medidas ou não. */
const DIMENSOES = Object.keys(DIMENSION_LABEL) as SleepDimensionKey[];

/**
 * A semente da janela: o hash do que a identifica — alcance, `range` e limites. O `hoje`
 * fica de fora: a janela de trás é a mesma janela em qualquer dia em que ela for lida.
 */
function sementeDa(e: EntradaDaSaude): number {
  const h = sha256Hex(`${e.alcance}|${e.range}|${e.janela.since ?? ''}|${e.janela.until ?? ''}`);
  return Number.parseInt(h.slice(0, 8), 16) >>> 0;
}

/** Um gerador pequeno e determinístico (mulberry32): a mesma semente, a mesma sequência. */
function gerador(semente: number): () => number {
  let a = semente >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** As opções da janela, embaralhadas por ela (Fisher–Yates com a semente da janela). */
function opcoesDa(e: EntradaDaSaude, medidas: readonly SleepDimensionKey[]): SleepDimensionKey[] {
  const out = [...medidas];
  const proximo = gerador(sementeDa(e));
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(proximo() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

/** O nome da dimensão na prosa: "duração", "horário". */
function nome(k: SleepDimensionKey): string {
  return DIMENSION_LABEL[k].toLowerCase();
}

/** O esquema da escolha: um objeto com uma dimensão, entre as opções dadas. */
function esquemaDe(opcoes: readonly SleepDimensionKey[]): Esquema {
  return {
    type: 'object',
    properties: { dimensao: { type: 'string', enum: [...opcoes] } },
    required: ['dimensao'],
  };
}

/**
 * O que a leitura da resposta aceita: qualquer das cinco. Se a escolha foi entre as
 * medidas é a conferência que diz — a interpretação não conhece os fatos.
 */
const ESQUEMA_DA_LEITURA = esquemaDe(DIMENSOES);

const SISTEMA = [
  'Você lê a contagem da Saúde do sono de uma noite ou de um período e escolhe uma dimensão.',
  '',
  'Cada dimensão medida tem um ponto de 0 a 2. A pergunta diz qual escolher; decida só pelos pontos dados.',
  'Responda só com a escolha, no formato pedido.',
].join('\n');

/** A pergunta de cada caso que nomeia — a regra do `nomear`, sem dizer a resposta. */
function perguntaDe(caso: CasoDaSaude): string | null {
  switch (caso.caso) {
    case 'uma':
    case 'duas':
      return 'Escolha uma dimensão que esteja no ponto mais baixo entre as medidas.';
    case 'fora-do-empate':
      return 'Escolha uma dimensão que não esteja no ponto mais baixo entre as medidas.';
    case 'sem-contagem':
    case 'medidas-insuficientes':
    case 'tudo-no-maximo':
    case 'todas-iguais':
      return null;
  }
}

function pedidoDe(e: EntradaDaSaude): Pedido | null {
  const caso = casoDaSaude(e.score);
  const pergunta = perguntaDe(caso);
  if (pergunta === null) return null;
  const pontos = new Map(e.score.dimensions.map((d) => [d.key, d.points] as const));
  const opcoes = opcoesDa(e, caso.dimensoes);
  const linhas = [
    `Alcance: ${e.alcance === 'noite' ? 'uma noite' : 'um período'}.`,
    'As dimensões medidas, com os pontos:',
    ...opcoes.map((k) => {
      const p = pontos.get(k);
      return `- ${k} (${nome(k)}): ${String(p)} ${p === 1 ? 'ponto' : 'pontos'}`;
    }),
    `Pergunta: ${pergunta}`,
    'Responda com a chave da dimensão escolhida.',
  ];
  return {
    sistema: SISTEMA,
    usuario: linhas.join('\n'),
    amostragem: 'gulosa',
    saida: { tipo: 'esquema', esquema: esquemaDe(opcoes) },
    guardrails: 'padrao',
  };
}

function reprova(regra: string, detalhe: string): Conferencia {
  return { ok: false, problemas: [{ regra, detalhe }] };
}

/**
 * A sonda como descritor. `V` é a dimensão escolhida.
 *
 * - **Molde**: o motor devolve um campo por esquema, e o que sai é a chave dele.
 * - **Gulosa**: o mesmo pedido, a mesma escolha — é uma medida, não uma amostra.
 * - A conferência aprova se a escolha está no `nomear` do caso; senão, reprova com a
 *   escolha e o esperado no detalhe, para o relatório dizer os dois.
 * - O piso é a resposta do código: as dimensões que ele nomeia.
 */
export const descritorDaSondaDaSaude: Descritor<EntradaDaSaude, SleepDimensionKey> = {
  recurso: 'saude-do-sono',
  versao: VERSAO,
  regimeDeNumeros: 'molde',
  regimeMaximo: 'nuvem',
  cadeiaPadrao: [SEM_MODELO],
  grava: false,

  montarPedido: pedidoDe,

  interpretar: (resposta) => {
    let lido: unknown;
    try {
      lido = JSON.parse(resposta.texto);
    } catch {
      return { classe: 'saida-invalida', detalhe: `a resposta não é JSON: ${resposta.texto.slice(0, 200)}` };
    }
    if (!conformeAoEsquema(lido, ESQUEMA_DA_LEITURA)) {
      return { classe: 'saida-invalida', detalhe: `a resposta não cabe no esquema: ${resposta.texto.slice(0, 200)}` };
    }
    return (lido as { readonly dimensao: SleepDimensionKey }).dimensao;
  },

  conferir: (escolha, e) => {
    const caso = casoDaSaude(e.score);
    if (caso.nomear.length === 0) {
      return reprova('sem-pergunta', `o caso ${caso.caso} não nomeia dimensão — não havia o que escolher`);
    }
    if (!caso.dimensoes.includes(escolha)) {
      return reprova('fora-das-opcoes', `escolheu ${escolha}, que não foi medida; as opções eram ${caso.dimensoes.join(', ')}`);
    }
    if (!(caso.nomear as readonly SleepDimensionKey[]).includes(escolha)) {
      return reprova('escolha', `escolheu ${escolha}; o código nomeia ${caso.nomear.join(', ')} (${caso.caso})`);
    }
    return { ok: true };
  },

  montarFrase: (escolha) => nome(escolha),

  semModelo: (e) => {
    const caso = casoDaSaude(e.score);
    return caso.nomear.length > 0
      ? { frase: caso.nomear.map(nome).join(', ') }
      : { ausencia: `o caso ${caso.caso} não nomeia dimensão` };
  },
};
