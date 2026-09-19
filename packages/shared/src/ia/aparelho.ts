/**
 * O motor do aparelho — a tradução da linha da ponte, no núcleo (AD-3, AD-4).
 *
 * No molde de `ia/nuvem.ts`: o hospedeiro só injeta **a chamada** — levar uma string
 * até a ponte e trazer a linha de volta —, e ler essa linha é trabalho deste arquivo,
 * com teste. A bancada (a CLI Swift, story 5.10) e o app (o módulo Expo, story 5.9)
 * entregam o mesmo contrato, então a mesma tabela lê os dois.
 *
 * O que vai: a string de {@link serializarPedido} — o pedido canônico, que a ponte
 * decodifica num `Codable` único. O que volta: **uma** linha JSON —
 *
 *     sucesso  { texto, provedor, modelo, plataforma, buildDoSistema, tokens? }
 *     falha    { classe, detalhe?, naoMapeado? }
 *
 * A tabela erro → classe mora na ponte, perto do SDK que muda; aqui só se confere que
 * a linha cumpre o contrato. O que não cumpre — linha ilegível, classe desconhecida,
 * resposta sem assinatura — é `transitoria` com `naoMapeado`: cai no piso sem repetir
 * e sem gravar, e o anel fica sabendo que a ponte e o núcleo divergiram.
 *
 * Nenhum nome de fornecedor aqui: quem sabe quem forneceu os pesos é a ponte, e ela o
 * diz na assinatura.
 */
import { ehClasseDeFalha, type ClasseDeFalha } from './fio';
import { serializarPedido, type Falha, type Motor, type Pedido, type Resposta, type UsoDeTokens } from './motor';

/**
 * A única coisa que o hospedeiro escreve: leva a string do pedido até a ponte e
 * devolve a linha que ela respondeu. Pode lançar — o motor transforma a exceção em
 * falha —, mas o esperado é que prazo estourado e processo ausente já voltem como
 * linha de falha, com a classe que o hospedeiro conhece.
 */
export type TransporteDoAparelho = (pedido: string) => Promise<string>;

/**
 * A versão que vai na string do pedido.
 *
 * A porta é `(pedido) => …`: o motor recebe o pedido, não o descritor, então a versão
 * dele não chega até aqui. A ponte não a lê (o `Codable` ignora a chave), e a identidade
 * do pedido que a tela e a bancada comparam continua sendo a do orquestrador
 * (`hashDoPedido`, com a versão de verdade). Zero não é versão de descritor nenhum —
 * `validarDescritor` exige ≥ 1 —, então quem ler a linha num diagnóstico não a confunde
 * com uma identidade.
 */
const SEM_DESCRITOR = 0;

/** A string que a ponte decodifica, para um pedido. */
export function pedidoParaAPonte(pedido: Pedido): string {
  return serializarPedido(pedido, SEM_DESCRITOR);
}

/* ── o contrato, em listas — o `architecture.test.ts` as compara com o Swift ── */

/**
 * As chaves de topo do pedido — as do `Pedido`. A tupla é conferida pelo compilador nos
 * dois sentidos: uma chave que não é do `Pedido` não entra, e uma chave nova do `Pedido`
 * não compila até entrar aqui (e, pela guarda do contrato, na `PedidoDoFio` da ponte).
 */
export const CHAVES_DO_PEDIDO = ['amostragem', 'guardrails', 'saida', 'sistema', 'usuario'] as const satisfies readonly (keyof Pedido)[];
type SobraDoPedido = Exclude<keyof Pedido, (typeof CHAVES_DO_PEDIDO)[number]>;
const _pedidoInteiro: [SobraDoPedido] extends [never] ? true : SobraDoPedido = true;
void _pedidoInteiro;

/** A chave que `serializarPedido` acrescenta ao pedido — a ponte a lê e não a usa. */
export const CHAVE_DA_VERSAO = 'versaoDoDescritor';

/** As chaves que {@link traduzirDoAparelho} lê numa resposta. */
export const CHAVES_DA_RESPOSTA = ['texto', 'provedor', 'modelo', 'plataforma', 'buildDoSistema', 'tokens'] as const;
/** As chaves que ela lê numa falha. */
export const CHAVES_DA_FALHA = ['classe', 'detalhe', 'naoMapeado'] as const;
/** As chaves que ela lê dentro de `tokens`. */
export const CHAVES_DOS_TOKENS = ['entrada', 'saida'] as const;

type ChaveDaResposta = (typeof CHAVES_DA_RESPOSTA)[number];
type ChaveDaFalha = (typeof CHAVES_DA_FALHA)[number];
type ChaveDosTokens = (typeof CHAVES_DOS_TOKENS)[number];

/**
 * A leitura por chave **declarada**: o compilador não deixa ler uma chave que não está na
 * lista — então a lista que a guarda compara com o Swift é a que o código lê de verdade.
 */
function leitor<K extends string>(o: Record<string, unknown>): (k: K) => unknown {
  return (k) => o[k];
}

function objeto(x: unknown): Record<string, unknown> | null {
  return typeof x === 'object' && x !== null && !Array.isArray(x) ? (x as Record<string, unknown>) : null;
}

function textoCheio(x: unknown): x is string {
  return typeof x === 'string' && x.trim().length > 0;
}

function tokensDe(x: unknown): UsoDeTokens | undefined {
  const o = objeto(x);
  if (!o) return undefined;
  const ler = leitor<ChaveDosTokens>(o);
  const entrada = ler('entrada');
  const saida = ler('saida');
  const conta = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n) && n >= 0;
  return conta(entrada) && conta(saida) ? { entrada, saida } : undefined;
}

function falha(classe: ClasseDeFalha, detalhe: string | undefined, naoMapeado = false): Falha {
  return {
    classe,
    ...(detalhe !== undefined ? { detalhe } : {}),
    ...(naoMapeado ? { naoMapeado: true as const } : {}),
  };
}

/** A linha fora do contrato: a ponte e o núcleo divergiram, e o anel precisa saber. */
function foraDoContrato(motivo: string): Falha {
  return falha('transitoria', `a linha da ponte ${motivo}`, true);
}

/**
 * A tabela inteira: a linha que a ponte devolveu → `Resposta` ou `Falha`. Pura, e é ela
 * que o teste percorre.
 *
 *   não é string, não é JSON, não é objeto → transitoria, naoMapeado
 *   com `classe` das sete                  → essa classe (e o `naoMapeado` da ponte, se veio)
 *   com `classe` que o núcleo não conhece  → transitoria, naoMapeado
 *   sem `classe`, com texto e assinatura   → Resposta, `tipo: 'aparelho'`
 *   sem `classe`, sem texto ou assinatura  → transitoria, naoMapeado
 *
 * Os opcionais da resposta (`plataforma`, `buildDoSistema`, `tokens`) que vierem
 * malformados ficam de fora em vez de reprovar a linha: são diagnóstico, e a frase
 * boa não se perde por causa deles.
 */
export function traduzirDoAparelho(linha: unknown): Resposta | Falha {
  if (typeof linha !== 'string') return foraDoContrato('não é texto');
  let lido: unknown;
  try {
    lido = JSON.parse(linha);
  } catch {
    return foraDoContrato(`não é JSON: ${linha.slice(0, 200)}`);
  }
  const o = objeto(lido);
  if (!o) return foraDoContrato('não é um objeto');

  const daFalha = leitor<ChaveDaFalha>(o);
  if (Object.prototype.hasOwnProperty.call(o, 'classe' satisfies ChaveDaFalha)) {
    const classe = daFalha('classe');
    const d = daFalha('detalhe');
    const detalhe = typeof d === 'string' && d.length > 0 ? d : undefined;
    if (!ehClasseDeFalha(classe)) {
      return foraDoContrato(`traz uma classe que o núcleo não conhece: ${String(classe)}${detalhe ? ` · ${detalhe}` : ''}`);
    }
    return falha(classe, detalhe, daFalha('naoMapeado') === true);
  }

  const daResposta = leitor<ChaveDaResposta>(o);
  const texto = daResposta('texto');
  if (!textoCheio(texto)) return foraDoContrato('não traz texto nem classe');
  const provedor = daResposta('provedor');
  const modelo = daResposta('modelo');
  if (!textoCheio(provedor) || !textoCheio(modelo)) return foraDoContrato('traz texto sem assinatura');
  const plataforma = daResposta('plataforma');
  const buildDoSistema = daResposta('buildDoSistema');
  const tokens = tokensDe(daResposta('tokens'));
  return {
    texto,
    assinatura: {
      tipo: 'aparelho',
      provedor,
      modelo,
      ...(textoCheio(plataforma) ? { plataforma } : {}),
      ...(textoCheio(buildDoSistema) ? { buildDoSistema } : {}),
    },
    ...(tokens ? { tokens } : {}),
  };
}

/**
 * O motor do aparelho. Recebe o transporte do hospedeiro e devolve a porta — que, como
 * toda porta, nunca rejeita: um transporte que lança vira `transitoria` não mapeada, com
 * o nome cru do erro.
 */
export function criarMotorDoAparelho(transporte: TransporteDoAparelho): Motor {
  return async (pedido) => {
    try {
      return traduzirDoAparelho(await transporte(pedidoParaAPonte(pedido)));
    } catch (e) {
      const cru = e instanceof Error ? `${e.name}: ${e.message}` : String(e);
      return falha('transitoria', `o transporte lançou — ${cru}`, true);
    }
  };
}
