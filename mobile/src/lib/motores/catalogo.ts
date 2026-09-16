/**
 * Os motores que **este app conhece** — disponíveis ou não (AD-8, ADR 0048).
 *
 * Conhecer não é ter. A distinção não é burocracia: `resolverCadeia` recebe os
 * ids *conhecidos* justamente para que um motor indisponível continue na cadeia e
 * entre na trilha como tentativa sintética — é assim que a tela consegue dizer
 * **por que** o escolhido não escreveu, em vez de cair no template em silêncio.
 *
 * Por isso o catálogo lista o `aparelho:sistema` hoje, no marco A, com o motivo
 * escrito: a ponte Swift é o marco B. Um catálogo que o omitisse faria o seletor
 * mentir por omissão — o dono veria duas opções e não saberia que existe uma
 * terceira esperando um build.
 *
 * Puro, sem rede e sem armazenamento: quem injeta motor é `./index.ts`, e quem
 * guarda a escolha é `./preferencia.ts`.
 */
import {
  APARELHO_SISTEMA,
  NUVEM_PADRAO,
  SEM_MODELO,
  admiteTipo,
  exposicao,
  lerMotorId,
  type Descritor,
  type MotorId,
  type RecursoId,
  type TipoDeMotor,
} from '@vitale/shared';

export interface MotorConhecido {
  readonly id: MotorId;
  /**
   * O sujeito da assinatura, **com artigo**: "a nuvem está escrevendo…". O
   * artigo vem junto porque é dele que `assinatura.ts` tira as contrações ("pela
   * nuvem", "da nuvem") — um nome sem artigo obrigaria a declarar três formas
   * por motor, e três formas divergem.
   */
  readonly nome: string;
  /** O rótulo da linha do seletor. */
  readonly rotulo: string;
  /** Uma linha dizendo o que esse motor é, no seletor. */
  readonly descricao: string;
  readonly disponivel: boolean;
  /** Por que não dá, **em palavras**. Obrigatório quando `disponivel` é falso. */
  readonly motivo?: string;
}

/**
 * A lista, na ordem em que o seletor a mostra: do que não sai do código ao que
 * sai do aparelho.
 */
export const MOTORES_CONHECIDOS: readonly MotorConhecido[] = [
  {
    id: SEM_MODELO,
    nome: 'o template',
    rotulo: 'Sem modelo',
    descricao: 'A frase que o código escreve. Instantânea, sempre igual, e nada sai do aparelho.',
    disponivel: true,
  },
  {
    id: APARELHO_SISTEMA,
    nome: 'o modelo do aparelho',
    rotulo: 'Modelo do aparelho',
    descricao: 'O modelo que o próprio sistema do iPhone fornece. Nada sai do aparelho.',
    disponivel: false,
    motivo: 'a ponte para o modelo do sistema ainda não existe neste build',
  },
  {
    id: NUVEM_PADRAO,
    nome: 'a nuvem',
    rotulo: 'Nuvem',
    descricao: 'O modelo que o servidor escolhe. O caso da leitura sai do aparelho para ser redigido.',
    disponivel: true,
  },
];

/**
 * Os ids que o app conhece — é esta lista que vai ao `catalogo` de
 * `resolverCadeia`. Conhecidos, não disponíveis (ver o cabeçalho).
 */
export const idsConhecidos: readonly MotorId[] = MOTORES_CONHECIDOS.map((m) => m.id);

/** O motor do catálogo com este id, ou `undefined`. Aceita id cru, de onde ele venha. */
export function motorConhecido(id: string | null | undefined): MotorConhecido | undefined {
  return MOTORES_CONHECIDOS.find((m) => m.id === id);
}

/**
 * Este motor está disponível neste build?
 *
 * Motor que o catálogo não conhece conta como indisponível: o app não tem como
 * entregar o que não declarou.
 */
export function motorDisponivel(id: string | null | undefined): boolean {
  return motorConhecido(id)?.disponivel === true;
}

/**
 * O nome de um motor, com artigo — para a assinatura e para o seletor.
 *
 * Cai no tipo quando o id não está no catálogo: uma preferência gravada por uma
 * versão futura do app (ou um provedor nomeado) ainda tem de render um sujeito
 * legível, senão a assinatura viraria "escrito por undefined".
 */
export function nomeDoMotor(id: string | null | undefined): string {
  const conhecido = motorConhecido(id);
  if (conhecido) return conhecido.nome;
  const lido = lerMotorId(id);
  if (lido?.tipo === 'nuvem') return 'a nuvem';
  if (lido?.tipo === 'aparelho') return 'o modelo do aparelho';
  return 'o template';
}

/* ── quais recursos esta camada hospeda ─────────────────────────────────── */

export interface Hospedagem {
  /** A leitura deste recurso passa pelo orquestrador **e consulta a preferência**. */
  readonly hospedado: boolean;
  /** Por que ainda não, em palavras — o mesmo idioma do motor indisponível. */
  readonly motivo?: string;
}

/**
 * O que a camada de motores do app de fato consome, recurso por recurso.
 *
 * Existe porque um controle inerte mente tanto quanto uma omissão. O seletor lista
 * os recursos do catálogo do núcleo (e tem de continuar listando), mas só oferece
 * escolha para quem lê a preferência. Leem hoje a Saúde do sono (5.5) e a
 * Retrospectiva — desde a 1.10, a impressão da revista resolve a cadeia pela
 * preferência e passa pelo orquestrador (`lib/edicao-ia.ts`). O nome de rota entra
 * na 5.7. Oferecer escolha para quem não a lê gravaria uma preferência que ninguém
 * consulta — o dono trocaria o motor e nada mudaria, sem nenhuma explicação.
 *
 * Fechado sobre `RecursoId`: recurso novo no núcleo **não compila** até alguém dizer
 * se esta camada o hospeda. É o que impede a lista de envelhecer calada.
 */
export const HOSPEDAGEM: Readonly<Record<RecursoId, Hospedagem>> = {
  'saude-do-sono': { hospedado: true },
  retrospectiva: { hospedado: true },
  'nome-de-rota': {
    hospedado: false,
    motivo: 'ainda não usado nesta versão: o nome de rota não passa pelo orquestrador',
  },
};

/** O que o bloqueio precisa saber do recurso. Um `Descritor` cabe aqui. */
export type RecursoDoSeletor = Pick<Descritor<never, never>, 'recurso' | 'regimeMaximo' | 'grava'>;

/** O nome de um tipo de motor, com artigo — para o motivo falar do tipo, não do id. */
function nomeDoTipo(tipo: TipoDeMotor): string {
  if (tipo === 'nuvem') return 'a nuvem';
  if (tipo === 'aparelho') return 'o modelo do aparelho';
  return 'o template';
}

/**
 * Por que este motor não pode ser escolhido para este recurso — ou `null`, se pode.
 *
 * Quatro razões, nesta ordem, e **nenhuma delas é "indisponível" sem dono**:
 *
 *  1. a camada não hospeda o recurso (a escolha não seria consultada);
 *  2. o motor expõe mais do que o `regimeMaximo` do recurso admite;
 *  3. o recurso grava e não admite que um motor desse tipo grave (`grava.admite`) —
 *     a preferência seria aceita, o marcador não andaria e nada explicaria;
 *  4. o motor não existe neste build (o catálogo o conhece e não o tem).
 *
 * A gramática do id vem de `lerMotorId`, não de `startsWith`: o provedor nomeado que
 * a 5.6 vai gravar (`nuvem:acme/modelo-9`) tem de ser lido pelo mesmo leitor que o
 * núcleo usa, senão a tela e a resolução da cadeia discordam.
 */
export function motivoDeBloqueio(recurso: RecursoDoSeletor, id: MotorId): string | null {
  const hospedagem = HOSPEDAGEM[recurso.recurso];
  if (!hospedagem.hospedado) return hospedagem.motivo ?? 'ainda não usado nesta versão';

  const lido = lerMotorId(id);
  if (!lido) return 'este motor não se lê';

  if (exposicao(lido.tipo) > exposicao(recurso.regimeMaximo)) {
    return `este recurso não manda dado além d${recurso.regimeMaximo === 'sem-modelo' ? 'o código' : 'o aparelho'}`;
  }
  if (!admiteTipo(recurso, lido.tipo)) {
    return `este recurso não guarda o que ${nomeDoTipo(lido.tipo)} escreve`;
  }
  return motorDisponivel(id) ? null : (motorConhecido(id)?.motivo ?? 'indisponível neste build');
}
