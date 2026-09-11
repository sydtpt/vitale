/**
 * A porta entre o núcleo e qualquer modelo (AD-1, AD-5, AD-11, AD-12).
 *
 * **Uma porta só.** `Motor` é uma função de `Pedido` para `Promise<Resposta |
 * Falha>` que **nunca rejeita**: falha é valor, com classe. Quem implementa a
 * porta é o hospedeiro — a ponte do aparelho, o motor de nuvem do núcleo —; quem
 * a percorre é só o orquestrador (`ia/orquestrar.ts`). A porta escolhe o **tipo**
 * de motor; os pesos são escolhidos dentro da ponte.
 *
 * `Motor` só se importa daqui, e reexportá-lo com outro nome é proibido — o
 * `architecture.test.ts` cobra.
 *
 * Também mora aqui o que decide **para onde o dado pode ir**: a exposição de cada
 * tipo, os tipos que um recurso que grava admite, a `Cadeia` que só
 * {@link resolverCadeia} constrói, e a identidade do pedido (`serializarPedido`,
 * `hashDoPedido`) que a tela e a bancada comparam.
 */
import {
  SEM_MODELO,
  TIPOS_DE_MOTOR,
  ehClasseDeFalha,
  formatarMotorId,
  lerMotorId,
  type ClasseDeFalha,
  type Esquema,
  type MotorId,
  type MotorIdLido,
  type TipoDeMotor,
} from './fio';
import { sha256Hex } from './sha256';

/* ── o pedido ────────────────────────────────────────────────────────────── */

/** `gulosa` é a mesma resposta para o mesmo pedido; `padrao`, a do motor. */
export type Amostragem = 'gulosa' | 'padrao';

/**
 * O que se pede a um motor — **intenção, não formato de fio**: cada borda a
 * traduz para o seu dialeto.
 *
 * O guardrail permissivo só existe para saída de texto. O tipo impede o par
 * inválido: `{ saida: { tipo: 'esquema', … }, guardrails: 'permissivo' }` não
 * compila.
 */
export type Pedido = {
  readonly sistema: string;
  readonly usuario: string;
  readonly amostragem: Amostragem;
} & (
  | { readonly saida: { readonly tipo: 'texto' }; readonly guardrails: 'padrao' | 'permissivo' }
  | { readonly saida: { readonly tipo: 'esquema'; readonly esquema: Esquema }; readonly guardrails: 'padrao' }
);

/* ── a resposta e a falha ────────────────────────────────────────────────── */

/** Quem respondeu, como o motor o observou. Não é o `MotorId` escolhido. */
export interface AssinaturaDoMotor {
  readonly tipo: 'aparelho' | 'nuvem';
  /** Na nuvem, o que o provedor reportou; no aparelho, quem forneceu os pesos. */
  readonly provedor: string;
  readonly modelo: string;
  readonly plataforma?: string;
  /** No aparelho: o build do sistema, porque o modelo muda com ele. */
  readonly buildDoSistema?: string;
}

/**
 * A assinatura completa. A versão do descritor e o instante **não vêm do motor**:
 * quem carimba é o orquestrador, com o `agora` injetado.
 */
export interface Assinatura extends AssinaturaDoMotor {
  readonly versaoDoDescritor: number;
  readonly instante: string;
}

export interface UsoDeTokens {
  readonly entrada: number;
  readonly saida: number;
}

/**
 * Uma geração **concluída**. Não carrega motivo de parada: a borda o traduz —
 * conclusão vira `Resposta`; o resto, `Falha` com `saida-invalida`.
 */
export interface Resposta {
  readonly texto: string;
  readonly assinatura: AssinaturaDoMotor;
  readonly tokens?: UsoDeTokens;
}

/** A resposta depois do carimbo do orquestrador. */
export type RespostaAssinada = Omit<Resposta, 'assinatura'> & { readonly assinatura: Assinatura };

/**
 * Uma falha, com a classe que decide o destino. `detalhe` leva texto do
 * fornecedor para diagnóstico, e só a tela de desenvolvimento o mostra —
 * **nenhuma decisão o lê**.
 */
export interface Falha {
  readonly classe: ClasseDeFalha;
  readonly detalhe?: string;
  /** A borda não reconheceu o erro: a classe é `transitoria` por falta de outra, e o anel quer saber. */
  readonly naoMapeado?: true;
}

/** A porta. Nunca rejeita: o que dá errado volta como `Falha`. */
export type Motor = (pedido: Pedido) => Promise<Resposta | Falha>;

/**
 * É falha com classe do Orbe? O mesmo critério do orquestrador: `classe` tem de
 * ser uma das {@link CLASSES_DE_FALHA} — um objeto com `classe: 'inventada'` não é
 * falha, é valor fora da porta, e o hospedeiro e o orquestrador têm de classificá-lo
 * do mesmo jeito.
 */
export function ehFalha(x: Resposta | Falha): x is Falha {
  return typeof x === 'object' && x !== null && ehClasseDeFalha((x as { classe?: unknown }).classe);
}

/**
 * A grafia da conclusão, com um dono só. É o valor que o `CHECK` de
 * `edicoes_ia.motivo_de_parada` aceita — e a igualdade é cobrada no
 * `architecture.test.ts`. Nenhum consumidor compara motivo de parada: quem compara
 * é a borda, com esta constante.
 */
export const CONCLUSAO = 'STOP';

/* ── exposição ───────────────────────────────────────────────────────────── */

/** O grau de exposição de um tipo: sem modelo 0, aparelho 1, nuvem 2. */
export function exposicao(tipo: TipoDeMotor): number {
  return TIPOS_DE_MOTOR.indexOf(tipo);
}

/**
 * Quem recebe o dado. Só a nuvem tem destinatário — o provedor —, e `padrao` é
 * um destinatário próprio: é o servidor escolhendo, e não se confunde com
 * provedor nenhum.
 */
export function destinatario(id: MotorIdLido): string | null {
  if (id.tipo !== 'nuvem') return null;
  return id.variante === 'padrao' ? 'padrao' : id.provedor;
}

/* ── a cadeia ────────────────────────────────────────────────────────────── */

declare const marcaDaCadeia: unique symbol;

/**
 * A ordem em que o orquestrador tenta os motores, terminada em `sem-modelo`.
 *
 * Tipo marcado: **só {@link resolverCadeia} constrói uma**. Uma lista escrita à
 * mão não passa por aqui — e é justamente a lista escrita à mão que mandaria dado
 * de saúde para a nuvem quando o aparelho falhasse.
 */
export type Cadeia = readonly MotorId[] & { readonly [marcaDaCadeia]: true };

/**
 * Os tipos de motor cuja resposta um recurso pode gravar (AD-12). `sem-modelo`
 * não está aqui: é o piso, e o piso nunca grava.
 *
 * Nasce aqui, e não em `ia/orquestrar.ts`, porque a resolução da cadeia o lê e
 * este arquivo não importa o orquestrador (o contrário, sim).
 */
export const TIPOS_QUE_GRAVAM = ['aparelho', 'nuvem'] as const satisfies readonly TipoDeMotor[];

export type TipoQueGrava = (typeof TIPOS_QUE_GRAVAM)[number];

/** O que a resolução precisa saber do recurso. Um `Descritor` cabe aqui. */
export interface RegimeDoRecurso {
  readonly cadeiaPadrao: readonly MotorId[];
  readonly regimeMaximo: TipoDeMotor;
  /**
   * Se o recurso grava, os tipos de motor que ele admite que gravem. Ausente ou
   * `false`: não grava, e a cadeia é resolvida como sempre foi.
   */
  readonly grava?: false | { readonly admite: readonly TipoQueGrava[] };
}

/**
 * O recurso admite este tipo de motor? Recurso que não grava admite todos, e
 * `sem-modelo` é sempre admitido — é o piso.
 *
 * Um `admite` que não é lista não admite nada: um descritor montado fora do tipo
 * cai no piso, nunca na nuvem. Quem aponta o defeito é `validarDescritor`.
 */
export function admiteTipo(recurso: Pick<RegimeDoRecurso, 'grava'>, tipo: TipoDeMotor): boolean {
  const grava: unknown = recurso.grava;
  if (grava === undefined || grava === false || tipo === 'sem-modelo') return true;
  const admite = typeof grava === 'object' && grava !== null ? (grava as { admite?: unknown }).admite : undefined;
  return Array.isArray(admite) && admite.includes(tipo);
}

/**
 * Os elos do padrão que sobrevivem a um teto de exposição, a um destinatário e
 * ao que o recurso admite gravar.
 *
 * Lê a lista **na ordem declarada** e descarta — nunca reordena — o que a
 * violaria: ilegível, de tipo que o recurso não admite, acima do teto, acima do
 * elo anterior (a exposição não cresce ao longo da cadeia) ou com um segundo
 * destinatário de nuvem. Reordenar por exposição poria a nuvem na frente de um
 * padrão que declarou o aparelho primeiro. O elo não admitido sai antes de
 * contar como anterior: o padrão é filtrado por `admite`, e só então resolvido.
 */
function elosDoPadrao(
  padrao: readonly MotorId[],
  teto: number,
  destinatarioFixo: string | null,
  inicio: readonly MotorId[],
  admitido: (tipo: TipoDeMotor) => boolean,
): MotorId[] {
  const out = [...inicio];
  let anterior = teto;
  let destino = destinatarioFixo;
  for (const bruto of padrao) {
    const lido = lerMotorId(bruto);
    if (!lido || lido.tipo === 'sem-modelo') continue;
    if (!admitido(lido.tipo)) continue;
    const grau = exposicao(lido.tipo);
    if (grau > anterior) continue;
    const d = destinatario(lido);
    if (d !== null) {
      if (destino === null) destino = d;
      else if (d !== destino) continue;
    }
    const id = formatarMotorId(lido);
    if (out.includes(id)) continue;
    out.push(id);
    anterior = grau;
  }
  return out;
}

function marcar(elos: readonly MotorId[]): Cadeia {
  return Object.freeze([...elos, SEM_MODELO]) as unknown as Cadeia;
}

/**
 * A cadeia de um recurso neste aparelho (AD-5).
 *
 * - **Ausente** (`null`/`undefined`): o padrão do recurso, até o `regimeMaximo`.
 * - **Ilegível**, ou `sem-modelo`: só `sem-modelo`. Nunca um padrão de exposição
 *   maior que a da preferência gravada — e um id que não se lê não tem exposição
 *   a oferecer.
 * - **Legível, conhecida e dentro do regime:** ela é o primeiro elo; o recuo é o
 *   padrão filtrado à exposição dela e, na nuvem, ao destinatário dela.
 * - **Legível, mas desconhecida do catálogo, acima do `regimeMaximo` ou de um
 *   tipo que o recurso não admite gravar:** o padrão filtrado à exposição dela
 *   (e ao regime e ao `admite`), sem ela. Quem pede o aparelho para um recurso
 *   que só admite nuvem fica em `sem-modelo` — nunca sobe para a nuvem.
 *
 * `catalogo` são os ids que o hospedeiro **conhece** — disponíveis ou não.
 * Disponibilidade não é daqui: motor conhecido e indisponível continua na cadeia
 * e entra na trilha como tentativa sintética (AD-8), para a tela poder dizer por
 * que ele não escreveu.
 *
 * Recurso que não grava (`grava` ausente ou `false`) resolve exatamente como
 * antes do `admite` existir.
 *
 * Em toda saída: termina em `sem-modelo` uma vez; a exposição não cresce ao longo
 * dela; a nuvem tem um destinatário só; nenhum elo além de `sem-modelo` é de tipo
 * que o recurso não admite (AD-12).
 */
export function resolverCadeia(
  recurso: RegimeDoRecurso,
  preferencia: string | null | undefined,
  catalogo: readonly string[],
): Cadeia {
  const teto = exposicao(recurso.regimeMaximo);
  const admitido = (tipo: TipoDeMotor): boolean => admiteTipo(recurso, tipo);
  if (preferencia == null) return marcar(elosDoPadrao(recurso.cadeiaPadrao, teto, null, [], admitido));

  const lida = lerMotorId(preferencia);
  if (!lida || lida.tipo === 'sem-modelo') return marcar([]);

  const grau = exposicao(lida.tipo);
  const limite = Math.min(grau, teto);
  const destino = destinatario(lida);
  const id = formatarMotorId(lida);
  // Fora do `admite` é recusada como a que passa do regime: não é o primeiro elo,
  // e o recuo continua limitado à exposição dela.
  const primeiro = catalogo.includes(id) && grau <= teto && admitido(lida.tipo) ? [id] : [];
  return marcar(elosDoPadrao(recurso.cadeiaPadrao, limite, destino, primeiro, admitido));
}

/* ── a identidade do pedido ──────────────────────────────────────────────── */

/** JSON canônico: chaves ordenadas, campo `undefined` omitido. */
function canonico(v: unknown): string {
  if (v === null || typeof v !== 'object') return JSON.stringify(v) ?? 'null';
  if (Array.isArray(v)) return `[${v.map((x) => canonico(x)).join(',')}]`;
  const o = v as Record<string, unknown>;
  const chaves = Object.keys(o).filter((k) => o[k] !== undefined).sort();
  return `{${chaves.map((k) => `${JSON.stringify(k)}:${canonico(o[k])}`).join(',')}}`;
}

/**
 * O pedido como string canônica, com a versão do descritor junto — o mesmo
 * pedido de um descritor que mudou de versão é outro pedido. É esta string que a
 * ponte decodifica, e é dela que sai o hash.
 */
export function serializarPedido(pedido: Pedido, versaoDoDescritor: number): string {
  return canonico({ ...pedido, versaoDoDescritor });
}

/** Pedido idêntico é pedido com o mesmo hash (AD-11). */
export function hashDoPedido(pedido: Pedido, versaoDoDescritor: number): string {
  return sha256Hex(serializarPedido(pedido, versaoDoDescritor));
}

/* ── a costura antiga, até a 5.7 ─────────────────────────────────────────── */

/**
 * O par que o nome de rota manda hoje. Estrutural de propósito: o
 * `PromptDeNome` de `routes/prompt.ts` cabe aqui sem este arquivo conhecê-lo.
 *
 * @deprecated Morre na 5.7, quando o nome de rota passar pela porta.
 */
export interface PromptLegado {
  sistema: string;
  usuario: string;
  json?: boolean;
}

/**
 * O que o chamador antigo devolve — o corpo da function, sem conhecê-la.
 *
 * @deprecated Morre na 5.7, com {@link ChamadorDeModelo}.
 */
export interface RespostaDoModelo {
  texto: string;
  provedor?: string;
  modelo?: string;
  /** A conclusão é {@link CONCLUSAO}. Qualquer outra coisa significa truncado. */
  motivoDeParada?: string;
  tokens?: { entrada: number; saida: number };
}

/**
 * A costura da ADR 0042, que a porta `Motor` substitui. Mora aqui, e não em
 * `routes/`, para existir um lugar só a apagar.
 *
 * @deprecated Morre na 5.7, quando o nome de rota passar pela porta.
 */
export type ChamadorDeModelo = (prompt: PromptLegado) => Promise<RespostaDoModelo>;
