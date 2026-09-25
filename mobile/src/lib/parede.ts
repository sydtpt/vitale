/**
 * A parede de capas, **fora do React** — o estado, as transições e a tradução do
 * lote para a célula (Story 2.4b).
 *
 * `useAcervoDaParede` faz as cinco leituras em lote e desenha; tudo o que ele
 * *decide* mora aqui, e por um motivo medido: a primeira entrega punha as
 * transições dentro do hook, e nada as executava. Trocar a semeadura dos lotes
 * por `PROCURANDO` fixo deixava as capas anteriores à Story 1.16 em cinza **para
 * sempre** — e a suíte inteira continuava verde, porque a única guarda era uma
 * barreira de código-fonte, que prova que as leituras *aparecem*, nunca que elas
 * *levam a algum lugar*.
 *
 * É o mesmo movimento que a story já tinha feito para `fotoDoLadrilho`: quando a
 * regra não é observável sem tela, ela sai da tela.
 */
import type {
  AcervoDaParede,
  ActivityPhoto,
  ItemDaParede,
  LadrilhoDaParede,
  LeituraDaRota,
  ParDaRota,
  PonteirosDaParede,
} from '@vitale/shared';

/* ── o lote ──────────────────────────────────────────────────────────────── */

/**
 * Uma leitura em lote, com os quatro estados que a tela distingue.
 *
 * `relendo` é o que impede a parede de piscar. A leitura é refeita a cada foco —
 * voltar da rota da edição pode trazer um mês que acabou de ser impresso —, e sem
 * ele toda capa de foto e de traçado voltaria a cinza no retorno, que é o oposto
 * do que a releitura promete. Com ele, o mapa anterior continua desenhando
 * enquanto o novo vem: o id que já estava lá aparece na hora, e só o **que não
 * estava** fica em `procurando`, porque desse a resposta ainda não se sabe.
 */
export type LoteLido<T> =
  /** Primeira leitura, sem nada anterior a mostrar. */
  | { readonly estado: 'procurando' }
  /** Releitura em voo, com a resposta anterior ainda válida. */
  | { readonly estado: 'relendo'; readonly porId: ReadonlyMap<string, T> }
  | { readonly estado: 'pronto'; readonly porId: ReadonlyMap<string, T> }
  | { readonly estado: 'falhou' };

const PROCURANDO_LOTE = { estado: 'procurando' } as const;
const FALHOU_LOTE = { estado: 'falhou' } as const;
/** Nada a buscar: o lote já nasce pronto e vazio, e não `procurando`. */
const VAZIO = { estado: 'pronto', porId: new Map<string, never>() } as const;

/** O mapa que um lote carrega, ou `null` — `procurando` e `falhou` não têm. */
function mapaDo<T>(lote: LoteLido<T> | null): ReadonlyMap<string, T> | null {
  return lote && 'porId' in lote ? lote.porId : null;
}

/**
 * O lote no começo de uma releitura: **a resposta anterior continua valendo** até
 * a nova chegar. Sem ponteiro nenhum a buscar, ele já nasce pronto e vazio.
 */
function semear<T>(anterior: LoteLido<T> | null, quantosPonteiros: number): LoteLido<T> {
  if (quantosPonteiros === 0) return VAZIO;
  const porId = mapaDo(anterior);
  return porId ? { estado: 'relendo', porId } : PROCURANDO_LOTE;
}

/**
 * O lote depois de uma leitura que falhou.
 *
 * Tendo resposta anterior, ela **fica**: uma rede que caiu não apaga o que já
 * estava desenhado, e o motivo já foi para o log. Sem resposta anterior, é
 * `falhou`, e cada ladrilho cai para o seu caminho de degradação.
 */
function comFalha<T>(atual: LoteLido<T>): LoteLido<T> {
  const porId = mapaDo(atual);
  return porId ? { estado: 'pronto', porId } : FALHOU_LOTE;
}

/* ── o estado da tela ────────────────────────────────────────────────────── */

export type FaseDaParede =
  /** Primeira leitura, sem nada a mostrar. */
  | { readonly fase: 'carregando' }
  /** Não há sessão — e por isso não há arquivo de ninguém. */
  | { readonly fase: 'sem-sessao' }
  | { readonly fase: 'erro'; readonly mensagem: string }
  | {
      readonly fase: 'pronta';
      readonly acervo: AcervoDaParede;
      /** `activity_photos.id` → a foto. A capa casa por `fotoId`. */
      readonly fotos: LoteLido<ActivityPhoto>;
      /** `activities.id` → o traçado reduzido, como a coluna o guarda. */
      readonly rotas: LoteLido<readonly ParDaRota[]>;
    };

export type EstadoDaParede = FaseDaParede & {
  /**
   * Qual leitura produziu este estado. Uma resposta de carga superada — a conta
   * trocou, o foco voltou antes de a anterior terminar — é **ignorada**: sem
   * isso, a resposta velha chega depois e desenha o arquivo do dono anterior.
   */
  readonly carga: number;
  /**
   * O relógio da parede: é dele que saem os `offset` dos ladrilhos e o recorte da
   * grade de cada capa. Renovado a cada leitura, mas **só quando o dia vira** —
   * ver {@link relogioDaParede}.
   */
  readonly now: Date;
};

export type AcaoDaParede =
  /** Uma leitura começou. Tendo o que mostrar, a parede **fica** na tela. */
  | { readonly tipo: 'ler'; readonly carga: number; readonly now: Date }
  | { readonly tipo: 'sem-sessao'; readonly carga: number }
  | { readonly tipo: 'erro'; readonly carga: number; readonly mensagem: string }
  /** As três primeiras leituras voltaram. */
  | {
      readonly tipo: 'acervo';
      readonly carga: number;
      readonly acervo: AcervoDaParede;
      readonly ponteiros: PonteirosDaParede;
    }
  | { readonly tipo: 'fotos'; readonly carga: number; readonly porId: ReadonlyMap<string, ActivityPhoto> }
  | { readonly tipo: 'fotos-falharam'; readonly carga: number }
  | { readonly tipo: 'rotas'; readonly carga: number; readonly porId: ReadonlyMap<string, readonly ParDaRota[]> }
  | { readonly tipo: 'rotas-falharam'; readonly carga: number };

/** O estado de uma parede que ainda não leu nada. */
export function paredeInicial(now: Date): EstadoDaParede {
  return { fase: 'carregando', carga: 0, now };
}

/**
 * O relógio da parede: o anterior, **a não ser que o dia tenha virado**.
 *
 * A parede fica aberta e relê a cada foco. Um `new Date()` por leitura invalidaria
 * a grade de todo ladrilho montado a cada volta, sem nada mudar na tela — as
 * contas que dependem do relógio são o `offset` do período (grão de mês) e o
 * "para em hoje" da grade (grão de dia). Um `new Date()` no mount, por outro
 * lado, congela: uma parede aberta atravessando a virada do mês manteria o
 * `offset` velho, e as capas `grade` desenhariam o mês errado logo abaixo de uma
 * edição que o foco acabou de trazer.
 *
 * O dia é o grão certo para as duas: ele cobre a virada do mês e não dispara nada
 * dentro do mesmo dia.
 */
export function relogioDaParede(anterior: Date, agora: Date): Date {
  const mesmoDia = anterior.getFullYear() === agora.getFullYear()
    && anterior.getMonth() === agora.getMonth()
    && anterior.getDate() === agora.getDate();
  return mesmoDia ? anterior : agora;
}

/**
 * A transição — **a regra inteira do hospedeiro, pura**.
 *
 * Toda ação que não seja `ler` é ignorada quando vem de uma carga superada: é a
 * guarda da troca de conta, e ela mora aqui para ter teste.
 */
export function proximaParede(atual: EstadoDaParede, acao: AcaoDaParede): EstadoDaParede {
  if (acao.tipo === 'ler') {
    const now = relogioDaParede(atual.now, acao.now);
    // **Tendo o que mostrar, a parede não volta para "carregando".** Só a primeira
    // leitura — e a que vem depois de um erro ou de um logout — mostra o aviso.
    return atual.fase === 'pronta'
      ? { ...atual, carga: acao.carga, now }
      : { fase: 'carregando', carga: acao.carga, now };
  }
  if (acao.carga !== atual.carga) return atual;

  switch (acao.tipo) {
    case 'sem-sessao':
      return { fase: 'sem-sessao', carga: atual.carga, now: atual.now };
    case 'erro':
      return { fase: 'erro', mensagem: acao.mensagem, carga: atual.carga, now: atual.now };
    case 'acervo': {
      const antes = atual.fase === 'pronta' ? atual : null;
      return {
        fase: 'pronta',
        acervo: acao.acervo,
        fotos: semear(antes?.fotos ?? null, acao.ponteiros.fotos.length),
        rotas: semear(antes?.rotas ?? null, acao.ponteiros.rotas.length),
        carga: atual.carga,
        now: atual.now,
      };
    }
    // As quatro abaixo só falam de uma parede desenhada. Fora dela — um erro
    // chegou primeiro, a sessão caiu — a resposta da mídia não tem onde pousar.
    case 'fotos':
      return atual.fase === 'pronta' ? { ...atual, fotos: { estado: 'pronto', porId: acao.porId } } : atual;
    case 'fotos-falharam':
      return atual.fase === 'pronta' ? { ...atual, fotos: comFalha(atual.fotos) } : atual;
    case 'rotas':
      return atual.fase === 'pronta' ? { ...atual, rotas: { estado: 'pronto', porId: acao.porId } } : atual;
    case 'rotas-falharam':
      return atual.fase === 'pronta' ? { ...atual, rotas: comFalha(atual.rotas) } : atual;
    default:
      return acaoSemTransicao(acao);
  }
}

function acaoSemTransicao(nunca: never): never {
  throw new Error(`[revista] ação da parede sem transição: ${JSON.stringify(nunca)}`);
}

/* ── do lote para a célula ───────────────────────────────────────────────── */

/**
 * O que o lote de fotos tem para um ladrilho.
 *
 * `procurando` e `sem-foto` são estados distintos pelo mesmo motivo do
 * `useFotoDaCapa`: com um só, "ainda não chegou" e "não existe mais" fariam a
 * mesma coisa — e a segunda tem de mostrar a legenda carimbada, enquanto a
 * primeira tem de segurar o quadro sem piscar papel.
 */
export type FotoNoLadrilho =
  /** A capa não é de foto — não há o que buscar. */
  | { readonly estado: 'nao-pedida' }
  /** O lote está em voo, e não há resposta anterior para este id. */
  | { readonly estado: 'procurando' }
  | { readonly estado: 'pronta'; readonly foto: ActivityPhoto }
  /**
   * A capa é de foto e a foto não veio. Três caminhos até aqui, e a tela faz a
   * mesma coisa com os três — cai para a legenda carimbada:
   *
   * - a linha de `activity_photos` sumiu;
   * - a leitura falhou e não havia resposta anterior;
   * - a capa não tem `foto_id`, que o `CHECK` da tabela torna impossível.
   *
   * **A foto que o dono desligou depois do carimbo não entra nesta lista**: a
   * parede lê por id (`fetchPhotosByIds`), sem filtro de estado, e ela volta.
   */
  | { readonly estado: 'sem-foto' };

const NAO_PEDIDA_FOTO: FotoNoLadrilho = { estado: 'nao-pedida' };
const PROCURANDO_FOTO: FotoNoLadrilho = { estado: 'procurando' };
const SEM_FOTO: FotoNoLadrilho = { estado: 'sem-foto' };

const NAO_PEDIDA_ROTA: LeituraDaRota = { estado: 'nao-pedida' };
const PROCURANDO_ROTA: LeituraDaRota = { estado: 'procurando' };
const SEM_LINHA: LeituraDaRota = { estado: 'sem-linha' };
const FALHOU_ROTA: LeituraDaRota = { estado: 'falhou' };

/**
 * A foto de um ladrilho, do lote — **casada por `foto_id`**, que é o que a capa
 * carimbou.
 *
 * O lote é lido por id (`fetchPhotosByIds`), então o casamento é direto. Durante
 * uma releitura (`relendo`), o id que **já estava** no mapa anterior responde na
 * hora — é o que impede a parede de piscar no retorno —, e o que não estava fica
 * em `procurando`, porque dele ainda não se sabe.
 */
export function fotoDoLadrilho(
  ladrilho: LadrilhoDaParede,
  lote: LoteLido<ActivityPhoto>,
): FotoNoLadrilho {
  const capa = ladrilho.capa;
  if (capa?.natureza !== 'foto') return NAO_PEDIDA_FOTO;
  // Capa de foto sem id de foto é estado que o CHECK do banco proíbe; se
  // acontecer, não há o que procurar — e o ladrilho já sabe cair para a legenda.
  if (!capa.fotoId) return SEM_FOTO;
  if (lote.estado === 'procurando') return PROCURANDO_FOTO;
  if (lote.estado === 'falhou') return SEM_FOTO;
  const foto = lote.porId.get(capa.fotoId);
  if (foto) return { estado: 'pronta', foto };
  return lote.estado === 'relendo' ? PROCURANDO_FOTO : SEM_FOTO;
}

/**
 * A rota de um ladrilho, do lote — nos cinco estados de `LeituraDaRota`, que é o
 * vocabulário que `desenhoDaCapa` lê.
 *
 * A distinção que carrega a matriz: **`sem-linha` não é `pronta` com zero
 * pontos**. A primeira é `activity_routes` sem linha para aquela atividade, e a
 * capa cai para o **papel**; a segunda é a linha existindo com um traçado curto
 * ou vazio, e a capa cai para a **grade**. Foi para isso que `fetchRouteSurface`
 * parou de colapsar as duas na 2.4a, e é por isso que a ausência do id no mapa
 * vale como `sem-linha`: quem não voltou do `.in()` não tem linha.
 */
export function rotaDoLadrilho(
  ladrilho: LadrilhoDaParede,
  lote: LoteLido<readonly ParDaRota[]>,
): LeituraDaRota {
  const capa = ladrilho.capa;
  if (capa?.natureza !== 'tracado' || !capa.rotaActivityId) return NAO_PEDIDA_ROTA;
  if (lote.estado === 'procurando') return PROCURANDO_ROTA;
  if (lote.estado === 'falhou') return FALHOU_ROTA;
  const overview = lote.porId.get(capa.rotaActivityId);
  if (overview) return { estado: 'pronta', overview };
  return lote.estado === 'relendo' ? PROCURANDO_ROTA : SEM_LINHA;
}

/* ── a mídia da parede, resolvida uma vez por onda ───────────────────────── */

/**
 * A foto e a rota de **cada ladrilho**, resolvidas uma vez por onda.
 *
 * Existe por causa do `React.memo` do ladrilho: chamadas por render,
 * {@link fotoDoLadrilho} e {@link rotaDoLadrilho} devolvem um objeto novo a cada
 * quadro no estado `pronta`, e o `memo` — que o componente tem justamente porque
 * a parede monta quarenta deles numa lista rolante — nunca casa. Resolvidas aqui,
 * dentro de um `useMemo` sobre `(itens, lote)`, a identidade é estável enquanto a
 * onda não muda.
 *
 * As funções devolvidas são **totais**: um ladrilho que não veio destes `itens`
 * cai na regra crua, em vez de num `undefined` que o componente teria de tratar.
 */
export interface MidiaDaParede {
  readonly foto: (ladrilho: LadrilhoDaParede) => FotoNoLadrilho;
  readonly rota: (ladrilho: LadrilhoDaParede) => LeituraDaRota;
}

export function midiaDaParede(
  itens: readonly ItemDaParede[],
  fotos: LoteLido<ActivityPhoto>,
  rotas: LoteLido<readonly ParDaRota[]>,
): MidiaDaParede {
  const daFoto = new Map<string, FotoNoLadrilho>();
  const daRota = new Map<string, LeituraDaRota>();
  for (const item of itens) {
    if (item.tipo !== 'linha') continue;
    for (const l of item.ladrilhos) {
      daFoto.set(l.chave, fotoDoLadrilho(l, fotos));
      daRota.set(l.chave, rotaDoLadrilho(l, rotas));
    }
  }
  return {
    foto: (l) => daFoto.get(l.chave) ?? fotoDoLadrilho(l, fotos),
    rota: (l) => daRota.get(l.chave) ?? rotaDoLadrilho(l, rotas),
  };
}
