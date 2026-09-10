/**
 * O orquestrador único (AD-2, AD-4, AD-12).
 *
 * **Só ele percorre a cadeia.** Cada recurso declara o seu caminho num
 * `Descritor` puro — como se monta o pedido, como se lê a resposta, como se
 * confere, como se escreve a frase e qual é o piso sem modelo —, e o hospedeiro
 * entrega os motores por id e o registro local. Nenhum hospedeiro repete, recua
 * ou decide permanência: a sequência pedido → motor → interpretação →
 * conferência → frase existe aqui e em mais lugar nenhum.
 *
 * **A classe decide o destino** de cada tentativa:
 *
 *   indisponivel, capacidade         → recua para o próximo elo
 *   janela                           → repete uma vez, no mesmo motor, com o pedido curto;
 *                                      a que esgota (sem curto, ou de novo) é permanente
 *   guarda, recusa-do-modelo,
 *   saida-invalida, reprovada        → permanente: cai no piso
 *   transitoria                      → cai no piso, sem repetir nesta execução
 *   exceção do motor, ou valor
 *   fora da porta                    → defeito: cai no piso, e o anel recebe a pilha
 *
 * **Exceção do descritor não é engolida.** Motor é impuro, e o que ele lança é
 * defeito com causa; descritor é código puro, e o que ele lança é bug — tem de
 * aparecer no teste, não virar piso. O anel recebe o evento antes, porque em
 * produção ele é o único diagnóstico.
 */
import {
  APARELHO_SISTEMA,
  ehClasseDeFalha,
  lerMotorId,
  NUVEM_PADRAO,
  SEM_MODELO,
  type ClasseDeFalha,
  type MotorId,
  type TipoDeMotor,
} from './fio';
import {
  exposicao,
  hashDoPedido,
  type Cadeia,
  type Falha,
  type Motor,
  type Pedido,
  type Resposta,
  type RespostaAssinada,
} from './motor';
import type { RecursoId } from './recursos';

/* ── o descritor ─────────────────────────────────────────────────────────── */

/**
 * Como os números entram no texto (AD-6). Não tem padrão: um recurso que não
 * declara o seu não compila.
 *
 * - `interpolado` — o motor não escreve algarismo; valor entra por marcador.
 * - `copiado-e-conferido` — o motor escreve números, e cada um tem de existir nos fatos.
 * - `molde` — o motor devolve campos por esquema, e a frase sai de um molde.
 */
export const REGIMES_DE_NUMEROS = ['interpolado', 'copiado-e-conferido', 'molde'] as const;

export type RegimeDeNumeros = (typeof REGIMES_DE_NUMEROS)[number];

/**
 * Os únicos ids que uma cadeia padrão pode nomear (AD-8): `sem-modelo` e as duas
 * variantes simbólicas. Um padrão que nomeia provedor escolhe destinatário por
 * quem não escolheu — e provedor é o dono quem escolhe, motor a motor (AD-5).
 */
export const ELOS_DE_PADRAO = [SEM_MODELO, APARELHO_SISTEMA, NUVEM_PADRAO] as const;

export type EloDePadrao = (typeof ELOS_DE_PADRAO)[number];

/** Um problema que a conferência achou. O `Problema` de `ia/verificar.ts` cabe aqui. */
export interface ProblemaDaConferencia {
  readonly regra: string;
  readonly detalhe: string;
}

/**
 * O veredito do recurso sobre o que o motor escreveu. `recusa` marca o texto que
 * é recusa do modelo disfarçada de resposta — no texto livre, ela chega sem erro
 * nenhum, e só a conferência a vê.
 */
export type Conferencia =
  | { readonly ok: true }
  | {
      readonly ok: false;
      readonly problemas: readonly ProblemaDaConferencia[];
      readonly recusa?: true;
    };

/** O que o recurso mostra sem modelo. Ausência com motivo é piso válido. */
export type Piso = { readonly frase: string } | { readonly ausencia: string };

/**
 * Se o recurso grava o que o motor escreve, e se recusa é resultado (AD-12).
 * Recurso que não grava não tem o que declarar sobre recusa.
 */
export type Grava = false | { readonly recusaEResultado: boolean };

/**
 * O caminho de um recurso, declarado como dado e funções puras.
 *
 * `F` são os fatos que a tela e a bancada montam pela mesma função; `V` é o que
 * a interpretação tira da resposta. `V` não pode ter a forma de uma `Falha`
 * (objeto com `classe` válida): é por ela que o orquestrador separa as duas.
 */
export interface Descritor<F, V> {
  readonly recurso: RecursoId;
  /** Sobe a cada mudança que altere o pedido ou a leitura. Vai na assinatura e no hash. */
  readonly versao: number;
  readonly regimeDeNumeros: RegimeDeNumeros;
  /** A maior exposição que o recurso admite. A resolução recusa preferência acima dela. */
  readonly regimeMaximo: TipoDeMotor;
  /**
   * Terminada em `sem-modelo`, sem subir a exposição. O tipo só admite os três
   * elos de padrão; a ordem e o fecho, quem cobra é `validarDescritor`.
   */
  readonly cadeiaPadrao: readonly EloDePadrao[];
  readonly grava: Grava;
  /** `null` quer dizer "não gaste chamada": não há o que um modelo acrescente. */
  montarPedido(fatos: F): Pedido | null;
  /** O pedido que cabe numa janela menor. Sem ele, `janela` é permanente. */
  pedidoCurto?(fatos: F): Pedido | null;
  interpretar(resposta: Resposta): V | Falha;
  conferir(valor: V, fatos: F): Conferencia;
  montarFrase(valor: V, fatos: F): string;
  /** Obrigatório: o recurso que não tem piso some quando o motor falta. */
  semModelo(fatos: F): Piso;
}

/* ── a trilha e os resultados ────────────────────────────────────────────── */

/** Por que o resultado veio do piso. */
export type Causa = ClasseDeFalha | 'reprovada' | 'defeito' | 'mudo' | 'preferencia';

/** Como terminou uma tentativa. */
export type Desfecho = 'ok' | ClasseDeFalha | 'reprovada' | 'defeito';

/** Uma chamada a um motor — ou a ausência dele, que também é tentativa. */
export interface Tentativa {
  readonly motor: MotorId;
  readonly desfecho: Desfecho;
  /** Do pedido à resposta, pelo `agora` injetado. Zero na tentativa sintética. */
  readonly ms: number;
  /** O hospedeiro não entregou o motor: nenhuma chamada saiu. */
  readonly sintetica?: true;
  /** A repetição com o pedido curto, depois de uma `janela`. */
  readonly curto?: true;
  /** Diagnóstico. Nenhuma decisão o lê. */
  readonly detalhe?: string;
  readonly naoMapeado?: true;
  /** O que a conferência reprovou. */
  readonly problemas?: readonly ProblemaDaConferencia[];
}

/** Um motor escreveu, e a conferência aprovou. */
export interface LeituraDoMotor<V> {
  readonly origem: 'motor';
  readonly frase: string;
  readonly valor: V;
  /** Quem foi escolhido e escreveu. A assinatura diz o modelo que de fato atendeu. */
  readonly motor: MotorId;
  readonly resposta: RespostaAssinada;
  readonly trilha: readonly Tentativa[];
}

/** Ninguém escreveu: é o piso do recurso, com a causa e a trilha. */
export type LeituraDoPiso = {
  readonly origem: 'piso';
  readonly causa: Causa;
  readonly trilha: readonly Tentativa[];
} & Piso;

export type Leitura<V> = LeituraDoMotor<V> | LeituraDoPiso;

/**
 * O resultado do modo `medicao` — outro tipo, de propósito: nada que grava
 * aceita uma medição.
 *
 * - `template`: pediu-se `sem-modelo`, e ele devolve o piso.
 * - `mudo`: o pedido é nulo, e nenhuma chamada saiu.
 * - `tentativa`: o motor foi chamado; `frase` existe só se passou.
 */
export type Medicao<V> =
  | ({ readonly tipo: 'template'; readonly motor: typeof SEM_MODELO } & Piso)
  | { readonly tipo: 'mudo'; readonly motor: MotorId }
  | {
      readonly tipo: 'tentativa';
      readonly motor: MotorId;
      /** O hash do pedido — é por ele que a bancada e a tela comparam. */
      readonly hash: string;
      readonly desfecho: Desfecho;
      /** Uma tentativa, ou duas quando a `janela` repetiu com o pedido curto. */
      readonly trilha: readonly Tentativa[];
      /** O texto cru do motor. Só a tela de desenvolvimento o mostra. */
      readonly resposta?: RespostaAssinada;
      readonly valor?: V;
      readonly frase?: string;
    };

/* ── o anel ──────────────────────────────────────────────────────────────── */

/**
 * O que o registro local recebe — uma vez por execução. O pedido vai junto só
 * quando há o que investigar nele: falha permanente (inclusive a `janela` que
 * esgotou), reprovação, defeito ou erro não mapeado. O conteúdo nunca sai do
 * aparelho: quem decide onde isto mora é o hospedeiro.
 */
export interface EventoDoAnel {
  readonly recurso: RecursoId;
  readonly versaoDoDescritor: number;
  readonly modo: 'produto' | 'medicao';
  /** O início da execução. */
  readonly instante: string;
  readonly trilha: readonly Tentativa[];
  /** Ausente quando um motor escreveu (ou na medição). */
  readonly causa?: Causa;
  /** O hash do pedido da execução — o pleno, que é o que a tela e a bancada comparam. */
  readonly hash?: string;
  /** O pedido que falhou. Pode ser o curto, depois de uma `janela`. */
  readonly pedido?: Pedido;
  /**
   * O hash **do pedido anexado** — sempre junto dele. É igual a `hash` quando o
   * anexado é o pleno, e diferente quando é o curto: quem lê o anel tem de poder
   * recalcular o hash a partir do corpo que tem na mão.
   */
  readonly hashDoAnexado?: string;
  /** A pilha da exceção que escapou de um motor, ou de uma função do descritor. */
  readonly pilha?: string;
}

/* ── as opções ───────────────────────────────────────────────────────────── */

interface OpcoesComuns {
  /** O ponto de injeção: um motor por id, ou `undefined` se ele não está aqui. */
  readonly motorPara: (id: MotorId) => Motor | undefined;
  /** O anel. Exceção aqui dentro é engolida: o anel não derruba uma leitura. */
  readonly registrar: (evento: EventoDoAnel) => void | Promise<void>;
  /** O relógio — injetado, para o núcleo não ler ambiente. */
  readonly agora: () => Date;
}

/** O modo do produto: a cadeia resolvida, com recuo e piso. */
export interface OpcoesDeProduto extends OpcoesComuns {
  readonly modo: 'produto';
  readonly cadeia: Cadeia;
}

/** O modo da bancada e da tela de desenvolvimento: exatamente um motor, sem recuo nem piso. */
export interface OpcoesDeMedicao extends OpcoesComuns {
  readonly modo: 'medicao';
  readonly motor: MotorId;
}

/* ── o percurso ──────────────────────────────────────────────────────────── */

/** Uma tentativa já classificada, com o que o anel e o resultado precisam dela. */
type Passo<V> =
  | {
      readonly ok: true;
      readonly tentativa: Tentativa;
      readonly pedido: Pedido;
      readonly resposta: RespostaAssinada;
      readonly valor: V;
    }
  | {
      readonly ok: false;
      readonly tentativa: Tentativa & { readonly desfecho: Exclude<Desfecho, 'ok'> };
      readonly pedido: Pedido;
      readonly resposta?: RespostaAssinada;
      /** Presente se a interpretação devolveu valor — `V` pode ser qualquer coisa, inclusive `undefined`. */
      readonly lido?: { readonly valor: V };
      readonly pilha?: string;
    };

const RECUA: ReadonlySet<Desfecho> = new Set<Desfecho>(['indisponivel', 'capacidade']);

/** O que é permanente por si só e faz o anel receber o pedido. A `janela` é caso à parte. */
const INVESTIGAR: ReadonlySet<Desfecho> = new Set<Desfecho>([
  'guarda', 'recusa-do-modelo', 'saida-invalida', 'reprovada', 'defeito',
]);

/**
 * O passo `i` tem o que investigar? Além dos permanentes e do não mapeado, a
 * `janela` que **esgotou**: a que não foi seguida da repetição curta — porque o
 * descritor não tem pedido curto, ou porque ela mesma já era a repetição. É a
 * falha em que o pedido é a prova (AD-4).
 */
function investigar<V>(passos: readonly Passo<V>[], i: number): boolean {
  const t = passos[i].tentativa;
  if (INVESTIGAR.has(t.desfecho) || t.naoMapeado) return true;
  return t.desfecho === 'janela' && !passos[i + 1]?.tentativa.curto;
}

function ehFalhaValida(x: unknown): x is Falha {
  return typeof x === 'object' && x !== null && ehClasseDeFalha((x as { classe?: unknown }).classe);
}

function textoCheio(x: unknown): x is string {
  return typeof x === 'string' && x.trim() !== '';
}

/**
 * O que um motor devolveu respeita a porta? Devolve o motivo quando não respeita.
 *
 * A assinatura tem de dizer o **mesmo tipo** do `MotorId` pedido: é assim que a
 * AD-5 deixa de depender da honestidade do hospedeiro — um ponto de injeção que
 * entregasse a nuvem no lugar do aparelho teria a resposta recusada aqui.
 */
function foraDaPorta(x: unknown, pedido: MotorId): string | null {
  if (typeof x !== 'object' || x === null || 'classe' in x) return 'o motor devolveu um valor fora da porta';
  const r = x as { texto?: unknown; assinatura?: unknown };
  if (!textoCheio(r.texto)) return 'o motor devolveu uma resposta sem texto';
  if (typeof r.assinatura !== 'object' || r.assinatura === null) return 'o motor devolveu uma resposta sem assinatura';
  const a = r.assinatura as { tipo?: unknown; provedor?: unknown; modelo?: unknown };
  if (a.tipo !== 'aparelho' && a.tipo !== 'nuvem') return 'a assinatura não diz o tipo do motor';
  if (!textoCheio(a.provedor) || !textoCheio(a.modelo)) return 'a assinatura não diz provedor e modelo';
  const tipoPedido = lerMotorId(pedido)?.tipo;
  if (a.tipo !== tipoPedido) return `a assinatura diz ${a.tipo}, e o motor pedido é ${String(tipoPedido)}`;
  return null;
}

/** A resposta com o carimbo — só os campos da porta; o que o motor mandar a mais fica de fora. */
function carimbar(r: Resposta, versaoDoDescritor: number, fim: Date): RespostaAssinada {
  const a = r.assinatura;
  return {
    texto: r.texto,
    assinatura: {
      tipo: a.tipo,
      provedor: a.provedor,
      modelo: a.modelo,
      ...(a.plataforma !== undefined ? { plataforma: a.plataforma } : {}),
      ...(a.buildDoSistema !== undefined ? { buildDoSistema: a.buildDoSistema } : {}),
      versaoDoDescritor,
      instante: fim.toISOString(),
    },
    ...(r.tokens ? { tokens: { entrada: r.tokens.entrada, saida: r.tokens.saida } } : {}),
  };
}

/**
 * O piso como o descritor o devolveu, só com a chave que o define. Chave a mais
 * não vaza nem sobrescreve o discriminante do resultado; piso sem frase nem
 * ausência é bug do descritor, e sobe como tal.
 */
function pisoDe(p: Piso): Piso {
  const x = p as { frase?: unknown; ausencia?: unknown };
  if (typeof x.frase === 'string') return { frase: x.frase };
  if (typeof x.ausencia === 'string') return { ausencia: x.ausencia };
  throw new TypeError('semModelo devolveu um piso sem frase nem ausência');
}

function mensagem(e: unknown): string {
  return e instanceof Error ? `${e.name}: ${e.message}` : String(e);
}

function pilha(e: unknown): string {
  return e instanceof Error ? (e.stack ?? mensagem(e)) : String(e);
}

/** Milissegundos entre dois instantes do `agora` injetado — nunca negativo, se o relógio andar para trás. */
function duracao(inicio: number, fim: number): number {
  return Math.max(0, fim - inicio);
}

/** Uma chamada a um motor, do `motorPara` à conferência. */
async function tentar<F, V>(
  d: Descritor<F, V>,
  fatos: F,
  id: MotorId,
  pedido: Pedido,
  o: OpcoesComuns,
  curto: boolean,
): Promise<Passo<V>> {
  const marca = curto ? { curto: true as const } : {};
  const base = { motor: id, ...marca };

  let motor: Motor | undefined;
  try {
    motor = o.motorPara(id);
  } catch (e) {
    return { ok: false, tentativa: { ...base, desfecho: 'defeito', ms: 0, detalhe: mensagem(e) }, pedido, pilha: pilha(e) };
  }
  if (!motor) {
    return {
      ok: false,
      tentativa: { ...base, desfecho: 'indisponivel', ms: 0, sintetica: true, detalhe: 'o hospedeiro não entregou este motor' },
      pedido,
    };
  }

  const inicio = o.agora().getTime();
  let saida: unknown;
  try {
    saida = await motor(pedido);
  } catch (e) {
    const ms = duracao(inicio, o.agora().getTime());
    return { ok: false, tentativa: { ...base, desfecho: 'defeito', ms, detalhe: mensagem(e) }, pedido, pilha: pilha(e) };
  }
  const fim = o.agora();
  const ms = duracao(inicio, fim.getTime());

  if (ehFalhaValida(saida)) return { ok: false, tentativa: { ...base, ...daFalha(saida), ms }, pedido };
  const violacao = foraDaPorta(saida, id);
  if (violacao !== null) {
    // A porta foi desrespeitada pelo hospedeiro: é defeito, não classe de motor.
    return { ok: false, tentativa: { ...base, desfecho: 'defeito', ms, detalhe: violacao }, pedido };
  }

  const bruta = saida as Resposta;
  const resposta = carimbar(bruta, d.versao, fim);

  const lido = d.interpretar(bruta);
  if (ehFalhaValida(lido)) return { ok: false, tentativa: { ...base, ...daFalha(lido), ms }, pedido, resposta };

  const valor = lido as V;
  const conferencia = d.conferir(valor, fatos);
  if (!conferencia.ok) {
    return {
      ok: false,
      tentativa: {
        ...base,
        desfecho: conferencia.recusa ? 'recusa-do-modelo' : 'reprovada',
        ms,
        problemas: conferencia.problemas,
      },
      pedido,
      resposta,
      lido: { valor },
    };
  }
  return { ok: true, tentativa: { ...base, desfecho: 'ok', ms }, pedido, resposta, valor };
}

/** A falha como campos da tentativa — a classe vira desfecho; o resto é diagnóstico. */
function daFalha(f: Falha): { desfecho: ClasseDeFalha; detalhe?: string; naoMapeado?: true } {
  return {
    desfecho: f.classe,
    ...(f.detalhe !== undefined ? { detalhe: f.detalhe } : {}),
    ...(f.naoMapeado ? { naoMapeado: true as const } : {}),
  };
}

/** Um motor inteiro: a tentativa e, se foi `janela`, a repetição com o pedido curto. */
async function tentarMotor<F, V>(
  d: Descritor<F, V>,
  fatos: F,
  id: MotorId,
  pedido: Pedido,
  o: OpcoesComuns,
): Promise<Passo<V>[]> {
  const primeiro = await tentar(d, fatos, id, pedido, o, false);
  if (primeiro.tentativa.desfecho !== 'janela' || !d.pedidoCurto) return [primeiro];
  const curto = d.pedidoCurto(fatos);
  if (!curto) return [primeiro];
  return [primeiro, await tentar(d, fatos, id, curto, o, true)];
}

function avisar(registrar: OpcoesComuns['registrar'], evento: EventoDoAnel): void {
  try {
    const r = registrar(evento);
    if (r && typeof (r as Promise<void>).then === 'function') {
      (r as Promise<void>).then(undefined, () => undefined);
    }
  } catch {
    // O anel não derruba uma leitura.
  }
}

function evento<F, V>(
  d: Descritor<F, V>,
  modo: 'produto' | 'medicao',
  instante: string,
  passos: readonly Passo<V>[],
  extra: { causa?: Causa; pedido?: Pedido | null },
): EventoDoAnel {
  const i = passos.findIndex((_, k) => investigar(passos, k));
  const problema = i >= 0 ? passos[i] : undefined;
  let pilhaDoDefeito: string | undefined;
  for (const p of passos) {
    if (!p.ok && p.pilha !== undefined) {
      pilhaDoDefeito = p.pilha;
      break;
    }
  }
  return {
    recurso: d.recurso,
    versaoDoDescritor: d.versao,
    modo,
    instante,
    trilha: passos.map((p) => p.tentativa),
    ...(extra.causa !== undefined ? { causa: extra.causa } : {}),
    ...(extra.pedido ? { hash: hashDoPedido(extra.pedido, d.versao) } : {}),
    ...(problema ? { pedido: problema.pedido, hashDoAnexado: hashDoPedido(problema.pedido, d.versao) } : {}),
    ...(pilhaDoDefeito !== undefined ? { pilha: pilhaDoDefeito } : {}),
  };
}

/**
 * O evento de quando uma função do descritor lançou: a execução não termina, mas
 * o anel sabe — com a pilha e, se já havia pedido, com ele.
 */
function eventoDeDefeitoDoDescritor<F, V>(
  d: Descritor<F, V>,
  modo: 'produto' | 'medicao',
  instante: string,
  passos: readonly Passo<V>[],
  pedido: Pedido | null,
  e: unknown,
): EventoDoAnel {
  const base = evento(d, modo, instante, passos, { causa: 'defeito', pedido });
  return {
    ...base,
    ...(base.pedido === undefined && pedido
      ? { pedido, hashDoAnexado: hashDoPedido(pedido, d.versao) }
      : {}),
    pilha: pilha(e),
  };
}

async function produto<F, V>(d: Descritor<F, V>, fatos: F, o: OpcoesDeProduto): Promise<Leitura<V>> {
  const instante = o.agora().toISOString();
  const passos: Passo<V>[] = [];
  let pedido: Pedido | null = null;
  let avisou = false;
  const aviso = (ev: EventoDoAnel): void => {
    avisou = true;
    avisar(o.registrar, ev);
  };

  try {
    const piso = (causa: Causa, doPedido: Pedido | null): LeituraDoPiso => {
      const r: LeituraDoPiso = {
        ...pisoDe(d.semModelo(fatos)),
        origem: 'piso',
        causa,
        trilha: passos.map((p) => p.tentativa),
      };
      aviso(evento(d, 'produto', instante, passos, { causa, pedido: doPedido }));
      return r;
    };

    const elos = o.cadeia.filter((id) => id !== SEM_MODELO);
    if (elos.length === 0) return piso('preferencia', null);

    pedido = d.montarPedido(fatos);
    if (!pedido) return piso('mudo', null);

    // `elos` não é vazio, então o laço roda ao menos uma vez e sobrescreve isto.
    let recuou: Causa = 'indisponivel';
    for (const id of elos) {
      const doMotor = await tentarMotor(d, fatos, id, pedido, o);
      passos.push(...doMotor);
      const ultimo = doMotor[doMotor.length - 1];

      if (ultimo.ok) {
        const r: LeituraDoMotor<V> = {
          origem: 'motor',
          frase: d.montarFrase(ultimo.valor, fatos),
          valor: ultimo.valor,
          motor: id,
          resposta: ultimo.resposta,
          trilha: passos.map((p) => p.tentativa),
        };
        aviso(evento(d, 'produto', instante, passos, { pedido }));
        return r;
      }
      const { desfecho } = ultimo.tentativa;
      if (!RECUA.has(desfecho)) return piso(desfecho, pedido);
      recuou = desfecho;
    }

    // A cadeia se esgotou: todos recuaram. A causa é a classe de quem recuou por último.
    return piso(recuou, pedido);
  } catch (e) {
    if (!avisou) aviso(eventoDeDefeitoDoDescritor(d, 'produto', instante, passos, pedido, e));
    throw e;
  }
}

async function medicao<F, V>(d: Descritor<F, V>, fatos: F, o: OpcoesDeMedicao): Promise<Medicao<V>> {
  const instante = o.agora().toISOString();
  let passos: Passo<V>[] = [];
  let pedido: Pedido | null = null;
  let avisou = false;
  const aviso = (ev: EventoDoAnel): void => {
    avisou = true;
    avisar(o.registrar, ev);
  };

  try {
    if (o.motor === SEM_MODELO) {
      const r: Medicao<V> = { ...pisoDe(d.semModelo(fatos)), tipo: 'template', motor: SEM_MODELO };
      aviso(evento(d, 'medicao', instante, [], {}));
      return r;
    }

    pedido = d.montarPedido(fatos);
    if (!pedido) {
      aviso(evento(d, 'medicao', instante, [], {}));
      return { tipo: 'mudo', motor: o.motor };
    }
    const hash = hashDoPedido(pedido, d.versao);

    // O teto do recurso vale também para medir: o dado de um recurso só-aparelho
    // não vai à nuvem nem na bancada nem na tela de desenvolvimento (AD-5).
    const lido = lerMotorId(o.motor);
    if (lido && exposicao(lido.tipo) > exposicao(d.regimeMaximo)) {
      const tentativa: Tentativa = {
        motor: o.motor,
        desfecho: 'indisponivel',
        ms: 0,
        sintetica: true,
        detalhe: `acima do regimeMaximo do recurso (${d.regimeMaximo})`,
      };
      passos = [{ ok: false, tentativa: { ...tentativa, desfecho: 'indisponivel' }, pedido }];
      aviso(evento(d, 'medicao', instante, passos, { pedido }));
      return { tipo: 'tentativa', motor: o.motor, hash, desfecho: 'indisponivel', trilha: [tentativa] };
    }

    passos = await tentarMotor(d, fatos, o.motor, pedido, o);
    const ultimo = passos[passos.length - 1];
    const comum = {
      tipo: 'tentativa' as const,
      motor: o.motor,
      hash,
      desfecho: ultimo.tentativa.desfecho,
      trilha: passos.map((p) => p.tentativa),
    };
    const r: Medicao<V> = ultimo.ok
      ? {
          ...comum,
          resposta: ultimo.resposta,
          valor: ultimo.valor,
          frase: d.montarFrase(ultimo.valor, fatos),
        }
      : {
          ...comum,
          ...(ultimo.resposta ? { resposta: ultimo.resposta } : {}),
          ...(ultimo.lido ? { valor: ultimo.lido.valor } : {}),
        };
    aviso(evento(d, 'medicao', instante, passos, { pedido }));
    return r;
  } catch (e) {
    if (!avisou) aviso(eventoDeDefeitoDoDescritor(d, 'medicao', instante, passos, pedido, e));
    throw e;
  }
}

/**
 * Lê um recurso.
 *
 * Em `produto`, percorre a cadeia com recuo e piso, e devolve de onde o texto
 * veio. Em `medicao`, roda exatamente o motor pedido, sem recuo e sem piso, e
 * devolve a tentativa — é o modo da bancada e da tela de desenvolvimento.
 *
 * Nunca rejeita por causa de um motor. Rejeita, sim, se uma função do descritor
 * lançar: isso é bug de código puro.
 */
export function ler<F, V>(d: Descritor<F, V>, fatos: F, o: OpcoesDeProduto): Promise<Leitura<V>>;
export function ler<F, V>(d: Descritor<F, V>, fatos: F, o: OpcoesDeMedicao): Promise<Medicao<V>>;
export function ler<F, V>(
  d: Descritor<F, V>,
  fatos: F,
  o: OpcoesDeProduto | OpcoesDeMedicao,
): Promise<Leitura<V> | Medicao<V>> {
  return o.modo === 'produto' ? produto(d, fatos, o) : medicao(d, fatos, o);
}
