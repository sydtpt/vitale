/**
 * O fio da nuvem, e o vocabulário que atravessa toda borda de motor (AD-4, AD-8, AD-14).
 *
 * **Sem imports, de propósito, e para sempre.** Este arquivo vai ser lido pela
 * edge function por caminho relativo (story 5.6), e o Deno não resolve specifier
 * sem extensão: um `import` aqui não quebra o `tsc` nem os apps — quebra o deploy
 * da function, longe de onde a mudança foi feita. O `architecture.test.ts` cobra.
 *
 * O que mora aqui é o que tem de ser igual nas três pontas — o núcleo, a ponte do
 * aparelho e a function —, escrito uma vez:
 *
 *  - as **classes de falha**, com o critério de cada uma;
 *  - a **gramática de `MotorId`**;
 *  - o **`Esquema`**, o subconjunto fechado de JSON Schema que os dois tradutores
 *    (o adaptador da nuvem e a ponte) já falam;
 *  - os **corpos** que a function recebe e devolve, e o status fixado por classe.
 *
 * Nome de fornecedor não entra — nem em comentário que vire literal, nem em
 * literal. Quem sabe que um erro do provedor é uma `guarda` é a borda dele.
 */

/* ── as classes de falha ─────────────────────────────────────────────────── */

/**
 * As sete classes de falha do Orbe. **A classe decide**: o orquestrador lê só
 * ela, nunca o `detalhe` nem o status HTTP.
 *
 * - `indisponivel` — o motor não atende pedido nenhum agora, e outro pode (não
 *   elegível, desligado, pesos ausentes, fora da lista, sem rede, sem crédito).
 *   **Recua.**
 * - `capacidade` — atende, mas não este pedido (idioma, esquema, guia). **Recua.**
 * - `janela` — o pedido não cabe no contexto. Repete uma vez com o pedido curto
 *   do recurso; sem ele, é permanente.
 * - `guarda` — o guardrail bloqueou. Permanente.
 * - `recusa-do-modelo` — o modelo recusou (pelo erro, na geração guiada; pela
 *   conferência, no texto). Permanente.
 * - `saida-invalida` — a resposta não se lê: ilegível, truncada, fora do esquema,
 *   motivo de parada que não é conclusão. Permanente.
 * - `transitoria` — o mesmo pedido no mesmo motor pode dar certo depois (timeout,
 *   limite de taxa, 5xx). Cai no piso e **não se repete** na mesma execução.
 *
 * Erro que a borda não reconhece vira `transitoria` com `naoMapeado`.
 */
export const CLASSES_DE_FALHA = [
  'indisponivel',
  'capacidade',
  'janela',
  'guarda',
  'recusa-do-modelo',
  'saida-invalida',
  'transitoria',
] as const;

export type ClasseDeFalha = (typeof CLASSES_DE_FALHA)[number];

export function ehClasseDeFalha(x: unknown): x is ClasseDeFalha {
  return typeof x === 'string' && (CLASSES_DE_FALHA as readonly string[]).includes(x);
}

/* ── a gramática de MotorId ──────────────────────────────────────────────── */

/**
 * Os tipos de motor, **em ordem de exposição**: o índice é o grau. Sem modelo
 * não sai do código; aparelho não sai do telefone; nuvem sai.
 */
export const TIPOS_DE_MOTOR = ['sem-modelo', 'aparelho', 'nuvem'] as const;

export type TipoDeMotor = (typeof TIPOS_DE_MOTOR)[number];

/** O passo terminal de toda cadeia de produto. Não é um motor: é o template. */
export const SEM_MODELO = 'sem-modelo';

/** O modelo que o sistema do aparelho fornece, em qualquer versão. */
export const APARELHO_SISTEMA = 'aparelho:sistema';

/** Corpo sem motor: quem escolhe o modelo é o servidor. */
export const NUVEM_PADRAO = 'nuvem:padrao';

/**
 * A identidade **de escolha** de um motor — o que o aparelho guarda como
 * preferência. Não é a assinatura (quem de fato respondeu), e nada compara uma
 * com a outra.
 *
 *     sem-modelo
 *     aparelho:sistema          aparelho:<provedor>/<pesos>
 *     nuvem:padrao              nuvem:<provedor>/<modelo>
 *
 * O tipo vai até o primeiro `:`, o provedor até o primeiro `/`, e o resto é
 * literal. O tipo de string só garante o prefixo; quem diz se um id se lê é
 * {@link lerMotorId}.
 */
export type MotorId = typeof SEM_MODELO | `aparelho:${string}` | `nuvem:${string}`;

/** Um `MotorId` lido. As variantes simbólicas não têm provedor. */
export type MotorIdLido =
  | { readonly tipo: 'sem-modelo' }
  | { readonly tipo: 'aparelho'; readonly variante: 'sistema' }
  | { readonly tipo: 'aparelho'; readonly variante: 'pesos'; readonly provedor: string; readonly pesos: string }
  | { readonly tipo: 'nuvem'; readonly variante: 'padrao' }
  | { readonly tipo: 'nuvem'; readonly variante: 'modelo'; readonly provedor: string; readonly modelo: string };

/**
 * As palavras das variantes simbólicas não podem ser nome de provedor. Um
 * `nuvem:padrao/x` teria provedor `padrao` — o mesmo destinatário do
 * `nuvem:padrao`, que é o servidor escolhendo. Ambíguo é ilegível.
 */
const RESERVADOS: ReadonlySet<string> = new Set(['sistema', 'padrao']);

/** Segmento não vazio e sem espaço — é uma identidade guardada, não prosa. */
function segmento(s: string): boolean {
  return s.length > 0 && !/\s/.test(s);
}

/**
 * Lê um id cru — de onde quer que ele venha, inclusive de um armazenamento que
 * pode ter sido corrompido ou gravado por uma versão velha do app. Devolve `null`
 * quando não se deixa ler, e **não adivinha**: a resolução decide o que fazer com
 * o ilegível (AD-5), não este leitor.
 */
export function lerMotorId(bruto: unknown): MotorIdLido | null {
  if (typeof bruto !== 'string') return null;
  if (bruto === SEM_MODELO) return { tipo: 'sem-modelo' };

  const i = bruto.indexOf(':');
  if (i < 0) return null;
  const tipo = bruto.slice(0, i);
  const resto = bruto.slice(i + 1);

  if (tipo === 'aparelho' && resto === 'sistema') return { tipo, variante: 'sistema' };
  if (tipo === 'nuvem' && resto === 'padrao') return { tipo, variante: 'padrao' };
  if (tipo !== 'aparelho' && tipo !== 'nuvem') return null;

  const j = resto.indexOf('/');
  if (j < 0) return null;
  const provedor = resto.slice(0, j);
  const nome = resto.slice(j + 1);
  // A palavra reservada vale em qualquer caixa: `nuvem:Padrao/x` seria outro
  // destinatário chamado "Padrao" — o mesmo nome do servidor escolhendo.
  if (!segmento(provedor) || !segmento(nome) || RESERVADOS.has(provedor.toLowerCase())) return null;

  return tipo === 'aparelho'
    ? { tipo, variante: 'pesos', provedor, pesos: nome }
    : { tipo, variante: 'modelo', provedor, modelo: nome };
}

/** O inverso de {@link lerMotorId}: `formatarMotorId(lerMotorId(s)!) === s`. */
export function formatarMotorId(id: MotorIdLido): MotorId {
  switch (id.tipo) {
    case 'sem-modelo':
      return SEM_MODELO;
    case 'aparelho':
      return id.variante === 'sistema' ? APARELHO_SISTEMA : `aparelho:${id.provedor}/${id.pesos}`;
    case 'nuvem':
      return id.variante === 'padrao' ? NUVEM_PADRAO : `nuvem:${id.provedor}/${id.modelo}`;
  }
}

/* ── o esquema ───────────────────────────────────────────────────────────── */

/**
 * O subconjunto fechado de JSON Schema que um pedido pode exigir como saída.
 *
 * São só estas palavras: `object` (`properties`, `required`), `string` (`enum`),
 * `integer` (`minimum`, `maximum`), `boolean` e `array` (`items`, `minItems`,
 * `maxItems`). Sem `null`, `$ref`, `oneOf` nem `format` — e **chave desconhecida
 * reprova**, porque um tradutor que ignora a palavra que não conhece entrega ao
 * modelo um esquema diferente do que o recurso declarou, calado. Ausência é
 * propriedade opcional: é para isso que `required` existe.
 */
export type Esquema =
  | {
      readonly type: 'object';
      readonly properties: { readonly [nome: string]: Esquema };
      readonly required?: readonly string[];
    }
  | { readonly type: 'string'; readonly enum?: readonly string[] }
  | { readonly type: 'integer'; readonly minimum?: number; readonly maximum?: number }
  | { readonly type: 'boolean' }
  | {
      readonly type: 'array';
      readonly items: Esquema;
      readonly minItems?: number;
      readonly maxItems?: number;
    };

const PALAVRAS: Readonly<Record<Esquema['type'], readonly string[]>> = {
  object: ['type', 'properties', 'required'],
  string: ['type', 'enum'],
  integer: ['type', 'minimum', 'maximum'],
  boolean: ['type'],
  array: ['type', 'items', 'minItems', 'maxItems'],
};

function objetoSimples(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null && !Array.isArray(x);
}

/** Chave própria — `in` acharia `toString` no protótipo e aprovaria `type: 'toString'`. */
function proprio(o: object, chave: string): boolean {
  return Object.prototype.hasOwnProperty.call(o, chave);
}

function naoNegativo(x: unknown): boolean {
  return typeof x === 'number' && Number.isSafeInteger(x) && x >= 0;
}

/**
 * Os problemas de um esquema, com o caminho de cada um; lista vazia é esquema
 * válido. Recebe `unknown` porque o esquema também chega pelo fio.
 */
export function validarEsquema(esquema: unknown, caminho = '$'): string[] {
  if (!objetoSimples(esquema)) return [`${caminho}: não é um objeto`];
  const tipo = esquema['type'];
  if (typeof tipo !== 'string' || !proprio(PALAVRAS, tipo)) {
    return [`${caminho}: tipo fora do subconjunto (${JSON.stringify(tipo) ?? 'ausente'})`];
  }
  const problemas: string[] = [];
  const permitidas = PALAVRAS[tipo as Esquema['type']];
  for (const chave of Object.keys(esquema)) {
    if (!permitidas.includes(chave)) problemas.push(`${caminho}: palavra desconhecida "${chave}"`);
  }

  if (tipo === 'object') {
    const props = esquema['properties'];
    if (!objetoSimples(props) || Object.keys(props).length === 0) {
      // Objeto sem propriedade não guia geração nenhuma — e um dos tradutores o recusa.
      problemas.push(`${caminho}.properties: ausente ou vazio`);
    } else {
      for (const [nome, sub] of Object.entries(props)) {
        if (nome.length === 0) problemas.push(`${caminho}.properties: nome de propriedade vazio`);
        problemas.push(...validarEsquema(sub, `${caminho}.properties.${nome}`));
      }
    }
    const req = esquema['required'];
    if (req !== undefined) {
      if (!Array.isArray(req) || req.some((r) => typeof r !== 'string')) {
        problemas.push(`${caminho}.required: não é lista de nomes`);
      } else {
        if (new Set(req).size !== req.length) problemas.push(`${caminho}.required: nome repetido`);
        for (const r of req as string[]) {
          if (!objetoSimples(props) || !proprio(props, r)) {
            problemas.push(`${caminho}.required: "${r}" não é propriedade`);
          }
        }
      }
    }
  }

  if (tipo === 'string' && esquema['enum'] !== undefined) {
    const opcoes = esquema['enum'];
    if (!Array.isArray(opcoes) || opcoes.length === 0 || opcoes.some((o) => typeof o !== 'string')) {
      problemas.push(`${caminho}.enum: não é lista não vazia de strings`);
    } else if (new Set(opcoes).size !== opcoes.length) {
      problemas.push(`${caminho}.enum: opção repetida`);
    }
  }

  // Acesso por colchete: a web compila o núcleo com `noPropertyAccessFromIndexSignature`.
  if (tipo === 'integer') {
    const min = esquema['minimum'];
    const max = esquema['maximum'];
    for (const [nome, v] of [['minimum', min], ['maximum', max]] as const) {
      if (v !== undefined && !(typeof v === 'number' && Number.isSafeInteger(v))) {
        problemas.push(`${caminho}.${nome}: não é inteiro`);
      }
    }
    if (typeof min === 'number' && typeof max === 'number' && min > max) {
      problemas.push(`${caminho}: minimum maior que maximum`);
    }
  }

  if (tipo === 'array') {
    if (esquema['items'] === undefined) problemas.push(`${caminho}.items: ausente`);
    else problemas.push(...validarEsquema(esquema['items'], `${caminho}.items`));
    const min = esquema['minItems'];
    const max = esquema['maxItems'];
    for (const [nome, v] of [['minItems', min], ['maxItems', max]] as const) {
      if (v !== undefined && !naoNegativo(v)) problemas.push(`${caminho}.${nome}: não é inteiro ≥ 0`);
    }
    if (typeof min === 'number' && typeof max === 'number' && min > max) {
      problemas.push(`${caminho}: minItems maior que maxItems`);
    }
  }

  return problemas;
}

/**
 * Um valor já lido (de `JSON.parse`) cabe no esquema? Propriedade que o esquema
 * não declara reprova: a saída guiada devolve só o que foi pedido, e o que vem a
 * mais é sinal de que não foi ela que respondeu.
 */
export function conformeAoEsquema(valor: unknown, esquema: Esquema): boolean {
  switch (esquema.type) {
    case 'object': {
      if (!objetoSimples(valor)) return false;
      for (const nome of esquema.required ?? []) {
        if (!proprio(valor, nome) || valor[nome] === undefined) return false;
      }
      for (const [nome, v] of Object.entries(valor)) {
        const sub = proprio(esquema.properties, nome) ? esquema.properties[nome] : undefined;
        if (!sub || !conformeAoEsquema(v, sub)) return false;
      }
      return true;
    }
    case 'string':
      return typeof valor === 'string' && (esquema.enum === undefined || esquema.enum.includes(valor));
    case 'integer':
      return (
        typeof valor === 'number' &&
        Number.isSafeInteger(valor) &&
        (esquema.minimum === undefined || valor >= esquema.minimum) &&
        (esquema.maximum === undefined || valor <= esquema.maximum)
      );
    case 'boolean':
      return typeof valor === 'boolean';
    case 'array':
      return (
        Array.isArray(valor) &&
        (esquema.minItems === undefined || valor.length >= esquema.minItems) &&
        (esquema.maxItems === undefined || valor.length <= esquema.maxItems) &&
        valor.every((v) => conformeAoEsquema(v, esquema.items))
      );
    default:
      // Um esquema que chegou pelo fio sem passar por `validarEsquema` pode ter um
      // `type` fora do subconjunto. A resposta é "não cabe" — nunca `undefined`.
      return false;
  }
}

/* ── os corpos do fio ────────────────────────────────────────────────────── */

/**
 * O que o hospedeiro manda à function. É o corpo que ela lê hoje: o par e a
 * intenção de JSON, derivada de `saida.tipo === 'esquema'`. O `motor` e o
 * `esquema` entram aqui na story 5.6, junto com a function que os lê.
 */
export interface CorpoDoPedido {
  readonly sistema: string;
  readonly usuario: string;
  readonly json: boolean;
}

/**
 * O corpo de um 2xx. O `motivoDeParada` chega cru e **para na borda**: o motor
 * de nuvem do núcleo o compara com a conclusão e nunca o repassa adiante.
 */
export interface CorpoDaResposta {
  readonly texto: string;
  /** Quem de fato respondeu, como o provedor reportou — não o que se pediu. */
  readonly provedor: string;
  readonly modelo: string;
  readonly motivoDeParada: string;
  readonly tokens?: { readonly entrada: number; readonly saida: number };
  /** Contagem crua do provedor, para custo e diagnóstico. */
  readonly uso?: Readonly<Record<string, unknown>>;
}

/**
 * O envelope de falha. A function nunca devolve falha sem classe (a partir da
 * 5.6); e, quando há classe no corpo, **é ela que decide**, não o status.
 */
export interface CorpoDaFalha {
  readonly classe: ClasseDeFalha;
  /** Diagnóstico, para a tela de desenvolvimento. Nenhuma decisão o lê. */
  readonly detalhe?: string;
}

/**
 * O status que a function emite para cada classe, a partir da 5.6.
 *
 * Coincide com o que ela emite hoje onde os dois se tocam — 503, 413, 502 —, e
 * é por isso que um hospedeiro que lê **só** o status ainda chega a uma classe
 * segura: 422 lido sem corpo vira `capacidade`, que recua sem aumentar a
 * exposição; 502, `transitoria`, que cai no piso sem gravar.
 */
export const STATUS_POR_CLASSE: Readonly<Record<ClasseDeFalha, number>> = {
  indisponivel: 503,
  capacidade: 422,
  janela: 413,
  guarda: 422,
  'recusa-do-modelo': 422,
  'saida-invalida': 502,
  transitoria: 502,
};
