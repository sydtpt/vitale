/**
 * Os motores que **este app conhece** — disponíveis ou não (AD-8, ADR 0048).
 *
 * Conhecer não é ter. A distinção não é burocracia: `resolverCadeia` recebe os
 * ids *conhecidos* justamente para que um motor indisponível continue na cadeia e
 * entre na trilha como tentativa sintética — é assim que a tela consegue dizer
 * **por que** o escolhido não escreveu, em vez de cair no template em silêncio.
 *
 * Por isso o catálogo lista o `aparelho:sistema` sempre, disponível ou não, e com o
 * motivo escrito quando não. Desde a 5.9 a disponibilidade dele é **a do
 * diagnóstico da ponte** — se o modelo do sistema atende, qual variante e que
 * janela, ou por quê não —, que `./index.ts` lê uma vez por sessão e passa para cá
 * como {@link EstadoDaPonte}. Sem o módulo nativo (um build anterior à 5.9, o jest), o
 * aparelho continua listado, apagado, dizendo que a ponte não está neste build; fora
 * do iOS, dizendo que ele só existe no iPhone. Um catálogo que o omitisse faria o
 * seletor mentir por omissão. (O simulador **tem** o módulo quando é build desta
 * branch — o autolinking é o mesmo —, e o diagnóstico diz o que o simulador disser.)
 *
 * Puro, sem rede e sem armazenamento: quem injeta motor e lê a ponte é `./index.ts`,
 * e quem guarda a escolha é `./preferencia.ts`.
 */
import {
  APARELHO_SISTEMA,
  NUVEM_PADRAO,
  SEM_MODELO,
  admiteTipo,
  ehMotivoDoAparelho,
  exposicao,
  formatarMotorId,
  lerMotorId,
  type Descritor,
  type DiagnosticoDoAparelho,
  type MotivoDoAparelho,
  type MotorDeNuvemAprovado,
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
  /**
   * Uma linha simples que diz **qual** motor é, quando há o que dizer. Hoje só o
   * aparelho a tem, vinda do diagnóstico: `AFM 3 Core Advanced · janela de 8.192
   * tokens` — é a resposta a "que modelo eu tenho".
   */
  readonly detalhe?: string;
  /**
   * O estado ainda está sendo perguntado (o diagnóstico da ponte a caminho). Não é
   * "indisponível": a tela o anuncia como ocupado, não como um motor que não existe.
   */
  readonly consultando?: true;
}

/**
 * O motivo do aparelho num build sem a ponte — o módulo nativo `OnDeviceEngine` não
 * está no binário (um build anterior à 5.9, o jest).
 */
export const MOTIVO_SEM_PONTE = 'a ponte para o modelo do sistema não está neste build';

/**
 * A lista, na ordem em que o seletor a mostra: do que não sai do código ao que
 * sai do aparelho.
 *
 * O aparelho aqui é o de **um build sem a ponte**. O estado de verdade dele entra
 * por {@link motoresDoRecurso}, com o diagnóstico: esta lista é a identidade (ids,
 * nomes, rótulos) e o ponto de partida, não a disponibilidade do aparelho.
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
    motivo: MOTIVO_SEM_PONTE,
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
 * Os ids que o app conhece **sem a lista do servidor** — é esta lista que vai ao
 * `catalogo` de `resolverCadeia` quando a lista nunca foi lida. Conhecidos, não
 * disponíveis (ver o cabeçalho). Para o catálogo já fundido por recurso, use
 * {@link idsConhecidosDe}.
 */
export const idsConhecidos: readonly MotorId[] = MOTORES_CONHECIDOS.map((m) => m.id);

/* ── a ponte do aparelho (story 5.9) ─────────────────────────────────────── */

/**
 * O que o app sabe da ponte do aparelho. Quem o lê é `./index.ts` — o único lugar
 * que carrega o módulo nativo —, **uma vez por sessão**; aqui ele só entra por
 * parâmetro.
 */
export type EstadoDaPonte =
  /** O módulo nativo não está neste build. */
  | { readonly tipo: 'ausente' }
  /**
   * Não é iOS: o modelo do sistema só existe no iPhone, e o módulo é só `apple`
   * (`expo-module.config.json`). Motivo próprio, porque "a ponte não está neste
   * build" seria falso — lá ela nunca vai estar.
   */
  | { readonly tipo: 'fora-do-ios' }
  /** O módulo está, e o diagnóstico ainda não voltou. */
  | { readonly tipo: 'consultando' }
  /**
   * O diagnóstico voltou — legível ou não —, com a linha **crua** que a ponte
   * escreveu, quando houve uma (a tela de desenvolvimento a mostra).
   */
  | { readonly tipo: 'lido'; readonly diagnostico: DiagnosticoDoAparelho; readonly cru?: string };

export const PONTE_AUSENTE: EstadoDaPonte = { tipo: 'ausente' };
export const PONTE_FORA_DO_IOS: EstadoDaPonte = { tipo: 'fora-do-ios' };
export const PONTE_CONSULTANDO: EstadoDaPonte = { tipo: 'consultando' };

/**
 * Os motivos que a ponte conhece, em palavras. **Exaustivo sobre
 * `MOTIVOS_DO_APARELHO`** (o núcleo), que a guarda do contrato amarra aos literais
 * que o `Engine.swift` devolve: um motivo novo na lista não compila aqui até ganhar
 * palavras. É aqui, e não no núcleo, que o nome da Apple Intelligence aparece: é
 * texto de tela.
 */
export const MOTIVO_EM_PALAVRAS: Readonly<Record<MotivoDoAparelho, string>> = {
  deviceNotEligible: 'este aparelho não é elegível ao modelo do sistema',
  appleIntelligenceNotEnabled: 'a Apple Intelligence está desligada nos Ajustes',
  modelNotReady: 'o modelo do sistema ainda não está pronto — ele pode estar sendo baixado',
  sistemaAntigo: 'o modelo do sistema pede iOS 26 ou mais novo',
};

/** O aparelho fora do iOS: não é falta de build, é plataforma. */
export const MOTIVO_FORA_DO_IOS = 'o modelo do aparelho só existe no iPhone';

/** Um motivo que a ponte disse e esta versão do app não conhece. */
export const MOTIVO_DESCONHECIDO = 'o modelo do sistema está indisponível por um motivo que esta versão não conhece';
/** O diagnóstico voltou fora do contrato, ou não voltou (matriz da 5.9). */
export const MOTIVO_ILEGIVEL = 'o aparelho não respondeu como esperado';
/** O diagnóstico ainda está a caminho: apagado por um instante, sem inventar motivo. */
export const MOTIVO_CONSULTANDO = 'consultando o modelo do aparelho…';

/** Por que o aparelho não atende, em palavras — ou `null`, se atende. */
export function motivoDoAparelho(ponte: EstadoDaPonte): string | null {
  switch (ponte.tipo) {
    case 'ausente':
      return MOTIVO_SEM_PONTE;
    case 'fora-do-ios':
      return MOTIVO_FORA_DO_IOS;
    case 'consultando':
      return MOTIVO_CONSULTANDO;
    case 'lido': {
      const d = ponte.diagnostico;
      if (d.estado === 'disponivel') return null;
      if (d.estado === 'ilegivel') return MOTIVO_ILEGIVEL;
      return ehMotivoDoAparelho(d.motivo) ? MOTIVO_EM_PALAVRAS[d.motivo] : MOTIVO_DESCONHECIDO;
    }
  }
}

/** 8192 → "8.192": o separador de milhar da tela, sem depender do `Intl` do motor JS. */
function milhar(n: number): string {
  return String(Math.trunc(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

/**
 * A linha de detalhe do aparelho: `AFM 3 Core Advanced · janela de 8.192 tokens`.
 * Só quando ele atende, e só com o que o diagnóstico trouxe — antes do 27 não há
 * variante, e a linha fica só com a janela.
 */
export function detalheDoAparelho(ponte: EstadoDaPonte): string | undefined {
  if (ponte.tipo !== 'lido' || ponte.diagnostico.estado !== 'disponivel') return undefined;
  const { variante, janela } = ponte.diagnostico;
  const partes = [variante, janela !== undefined ? `janela de ${milhar(janela)} tokens` : undefined].filter(
    (p): p is string => p !== undefined,
  );
  return partes.length > 0 ? partes.join(' · ') : undefined;
}

/** O aparelho no estado da ponte: disponível com o detalhe, ou apagado com o motivo. */
function aparelhoNaPonte(base: MotorConhecido, ponte: EstadoDaPonte): MotorConhecido {
  const motivo = motivoDoAparelho(ponte);
  if (motivo !== null) {
    return { ...base, disponivel: false, motivo, ...(ponte.tipo === 'consultando' ? { consultando: true as const } : {}) };
  }
  const detalhe = detalheDoAparelho(ponte);
  const { motivo: _semMotivo, ...semMotivo } = base;
  return { ...semMotivo, disponivel: true, ...(detalhe !== undefined ? { detalhe } : {}) };
}

/* ── a lista do servidor (story 5.6, ADR 0048) ───────────────────────────── */

/**
 * A lista aprovada como este app a guarda: o que veio, e **quando**.
 *
 * O instante não é enfeite. Sem ele não há como distinguir "nunca perguntei" de
 * "perguntei e o servidor disse que não há nenhum" — e as duas levariam a buscas
 * repetidas a cada toque, ou a nenhuma. `null` é a primeira; uma lista vazia com
 * instante é a segunda, e ela vale tanto quanto uma cheia.
 */
export interface ListaAprovada {
  readonly motores: readonly MotorDeNuvemAprovado[];
  /** O instante (ms) em que a leitura que produziu esta lista voltou. */
  readonly lidaEm: number;
}

/**
 * Quanto tempo uma lista lida continua valendo.
 *
 * Curto o bastante para o dono ver um motor novo no mesmo dia em que o servidor
 * o aprova, e longo o bastante para a leitura da Saúde (que espera a lista antes
 * de resolver a cadeia) não pagar uma ida à rede por toque. A lista só muda por
 * `supabase secrets set`, que é ação humana rara.
 */
export const VALIDADE_DA_LISTA_MS = 10 * 60_000;

/** O que o app leu por último, ou `null` — nunca lida, ou esquecida. */
let guardada: ListaAprovada | null = null;

/** A lista em cache, sem buscar nada. `null` quando nunca foi lida com sucesso. */
export function listaAprovada(): ListaAprovada | null {
  return guardada;
}

/** Guarda o que o servidor devolveu, carimbando o instante. */
export function guardarListaAprovada(
  motores: readonly MotorDeNuvemAprovado[],
  lidaEm: number,
): ListaAprovada {
  guardada = { motores, lidaEm };
  return guardada;
}

/**
 * Esquece o cache.
 *
 * Quem chama hoje é o arranque de um teste, e `esquecerLista` (em `./index.ts`),
 * que esquece o cache **e** a busca em voo. Nada mais: a troca de sessão não
 * passa por aqui — se um dia a lista tiver de virar por usuário, é ali que a
 * ligação entra, e não neste comentário.
 */
export function esquecerListaAprovada(): void {
  guardada = null;
}

/** Vale a pena buscar de novo? Lista ausente sempre vale; vencida, também. */
export function listaVencida(agora: number, lista: ListaAprovada | null = guardada): boolean {
  return lista === null || agora - lista.lidaEm >= VALIDADE_DA_LISTA_MS || agora < lista.lidaEm;
}

/**
 * As variantes de nuvem **nomeadas** que o servidor aprovou para este recurso.
 *
 * Pura, e é ela que a fusão usa. A lista do servidor fala em `MotorId` e em
 * recursos; o rótulo e a descrição são derivados do id, porque o app não pode ter
 * texto autorado para um provedor que ele não conhecia quando foi compilado —
 * e mostrar id cru na tela seria o que o catálogo existe para evitar.
 *
 * Um id que não se lê, ou que não é `nuvem:<provedor>/<modelo>`, não entra:
 * `lerMotoresDeNuvemAprovados` já o descartou no núcleo, e aqui a checagem é a
 * rede contra uma lista montada à mão num teste.
 */
export function variantesDaNuvem(
  recurso: RecursoId,
  lista: ListaAprovada | null,
): readonly MotorConhecido[] {
  if (lista === null) return [];
  const out: MotorConhecido[] = [];
  const vistos = new Set<string>(MOTORES_CONHECIDOS.map((m) => m.id));
  for (const aprovado of lista.motores) {
    if (!aprovado.recursos.includes(recurso)) continue;
    const lido = lerMotorId(aprovado.motor);
    if (!lido || lido.tipo !== 'nuvem' || lido.variante !== 'modelo') continue;
    const id = formatarMotorId(lido);
    if (vistos.has(id)) continue;
    vistos.add(id);
    out.push({
      id,
      // A mesma regra que a assinatura usa (`nomeDoMotor`): um nome só por motor.
      nome: nomeDaVariante(lido.provedor, lido.modelo),
      rotulo: `${lido.provedor} · ${lido.modelo}`,
      descricao:
        'Um modelo de nuvem que o servidor aprovou para esta leitura. O caso sai do aparelho para ser redigido.',
      disponivel: true,
    });
  }
  return out;
}

/**
 * O catálogo deste recurso: o que o app já conhecia, mais o que o servidor
 * aprovou para ele.
 *
 * **A lista do servidor só acrescenta.** Ela nunca tira `nuvem:padrao`, nunca
 * tira `sem-modelo` e nunca tira o aparelho da lista — é por isso que a leitura
 * falhar (`null`) custa exatamente as variantes nomeadas, e nada mais. Um app que
 * perdesse `nuvem:padrao` por não conseguir falar com o servidor ficaria sem
 * nuvem justamente quando a rede está ruim, que é quando o dono menos entende o
 * porquê.
 *
 * A ordem põe as nomeadas **depois** de `nuvem:padrao`: o padrão é o que o
 * servidor escolhe, e continua sendo a primeira opção de nuvem que o dono lê.
 *
 * **`ponte` é obrigatória** (5.9), pela mesma razão que `conhecidos` virou
 * obrigatório na 5.6: com um padrão, quem esquecesse de passá-la mostraria "a ponte
 * não está neste build" num iPhone com o modelo de pé — a mentira, sem nada quebrar.
 * `lista` fica com o padrão de sempre (o cache), e o mesmo de {@link idsConhecidosDe}:
 * o cache é o que o app sabe de verdade, não uma suposição.
 */
export function motoresDoRecurso(
  recurso: RecursoId,
  ponte: EstadoDaPonte,
  lista: ListaAprovada | null = guardada,
): readonly MotorConhecido[] {
  const locais = MOTORES_CONHECIDOS.map((m) => (m.id === APARELHO_SISTEMA ? aparelhoNaPonte(m, ponte) : m));
  return [...locais, ...variantesDaNuvem(recurso, lista)];
}

/**
 * Os ids que o app conhece para este recurso — o que vai ao `resolverCadeia`.
 *
 * **Derivados de {@link motoresDoRecurso}**, com o mesmo padrão de `lista`, para as
 * duas listas nunca divergirem. A ponte não muda id nenhum — conhecer não é ter, e o
 * aparelho entra na cadeia mesmo indisponível (é assim que a trilha diz por que ele
 * não escreveu) —, então qualquer estado serve; vai o do build sem ponte.
 */
export function idsConhecidosDe(
  recurso: RecursoId,
  lista: ListaAprovada | null = guardada,
): readonly MotorId[] {
  return motoresDoRecurso(recurso, PONTE_AUSENTE, lista).map((m) => m.id);
}

/**
 * O motor com este id dentro de um catálogo, ou `undefined`. Aceita id cru, de
 * onde ele venha.
 *
 * **`conhecidos` é obrigatório desde a 5.6.** Era `MOTORES_CONHECIDOS` por
 * omissão, e o padrão fazia o caminho errado compilar calado: quem esquecesse de
 * passar a lista fundida receberia "não existe neste build" para um motor que o
 * servidor aprovou — a mentira exata que este módulo existe para não contar.
 */
export function motorConhecido(
  id: string | null | undefined,
  conhecidos: readonly MotorConhecido[],
): MotorConhecido | undefined {
  return conhecidos.find((m) => m.id === id);
}

/**
 * Este motor está disponível, neste catálogo?
 *
 * Motor que o catálogo não conhece conta como indisponível: o app não tem como
 * entregar o que não declarou. É o catálogo **passado** que responde — com a
 * lista fundida, uma variante aprovada está disponível; sem ela, o app nem sabe
 * que ela existe.
 */
export function motorDisponivel(
  id: string | null | undefined,
  conhecidos: readonly MotorConhecido[],
): boolean {
  return motorConhecido(id, conhecidos)?.disponivel === true;
}

/**
 * O nome de uma variante de nuvem nomeada, com artigo.
 *
 * **Sai do próprio id**, e não de uma lista: `nuvem:acme/modelo-9` já carrega
 * provedor e modelo, então não há motivo para depender de uma lista ter sido
 * lida antes de saber como chamá-lo. Uma regra só, usada pelo catálogo e pela
 * assinatura — duas divergiriam, e o dono leria um nome no seletor e outro sob a
 * frase.
 *
 * O artigo é "o", porque o sujeito é o modelo: `por` e `de` o contraem em "pelo"
 * e "do" (ver `assinatura.ts`), e a frase sai "escrito pelo modelo-9 da acme".
 */
export function nomeDaVariante(provedor: string, modelo: string): string {
  return `o ${modelo} da ${provedor}`;
}

/**
 * O nome de um motor, com artigo — para a assinatura e para o seletor.
 *
 * **A variante nomeada tem nome próprio** (5.6). Antes toda ela caía em "a
 * nuvem", e aí a assinatura da `/sono/saude` não dizia qual modelo escreveu e a
 * bancada — a tela que existe para comparar motores — anunciava "medindo a
 * nuvem…" para N motores diferentes. O nome vem do id, então funciona sem
 * catálogo nenhum: uma preferência gravada por uma versão futura do app ainda
 * rende um sujeito legível, em vez de "escrito por undefined".
 */
export function nomeDoMotor(id: string | null | undefined): string {
  const conhecido = motorConhecido(id, MOTORES_CONHECIDOS);
  if (conhecido) return conhecido.nome;
  const lido = lerMotorId(id);
  if (lido?.tipo === 'nuvem') {
    return lido.variante === 'modelo' ? nomeDaVariante(lido.provedor, lido.modelo) : 'a nuvem';
  }
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
 * escolha para quem lê a preferência. Leem hoje a Saúde do sono (5.5), a
 * Retrospectiva — desde a 1.10, a impressão da revista resolve a cadeia pela
 * preferência e passa pelo orquestrador (`lib/edicao-ia.ts`) — e o nome de rota,
 * desde a 5.7 (`services/route-name.ts`). Oferecer escolha para quem não a lê
 * gravaria uma preferência que ninguém consulta — o dono trocaria o motor e nada
 * mudaria, sem nenhuma explicação.
 *
 * **Os três recursos do núcleo estão ligados.** O campo `motivo` fica, e o tipo
 * `Hospedagem` também: é ele que faz um recurso novo nascer com a resposta escrita
 * em vez de nascer mudo.
 *
 * Fechado sobre `RecursoId`: recurso novo no núcleo **não compila** até alguém dizer
 * se esta camada o hospeda. É o que impede a lista de envelhecer calada.
 */
export const HOSPEDAGEM: Readonly<Record<RecursoId, Hospedagem>> = {
  'saude-do-sono': { hospedado: true },
  retrospectiva: { hospedado: true },
  'nome-de-rota': { hospedado: true },
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
 * a 5.6 grava (`nuvem:acme/modelo-9`) tem de ser lido pelo mesmo leitor que o núcleo
 * usa, senão a tela e a resolução da cadeia discordam.
 *
 * `conhecidos` é o catálogo **já fundido** com a lista do servidor
 * ({@link motoresDoRecurso}), e é **obrigatório**: com um padrão, quem esquecesse
 * de passá-lo receberia "não existe neste build" para uma variante que o servidor
 * aprovou — a razão certa para o aparelho, e uma mentira para ela, escrita na tela
 * do dono sem nada quebrar. Um parâmetro obrigatório transforma esse esquecimento
 * num erro de compilação.
 */
export function motivoDeBloqueio(
  recurso: RecursoDoSeletor,
  id: MotorId,
  conhecidos: readonly MotorConhecido[],
): string | null {
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
  if (motorDisponivel(id, conhecidos)) return null;
  return motorConhecido(id, conhecidos)?.motivo ?? 'indisponível neste build';
}
