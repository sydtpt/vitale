import { create } from 'zustand';
import {
  CADERNO_IDS,
  FotoRecusadaNaTroca,
  TIPO_DO_POSTAL,
  cadernosVisiveis,
  chamadaDoTexto,
  legendaQueAcrescenta,
  precisaErrata,
  resolveRetroPrefs,
  temEdicao,
  type ActivityPhoto,
  type CadernoId,
  type Capa,
  type DesfechoDoCaderno,
  type Edicao,
  type EntradaPacote,
  type NaturezaDaCapa,
  type TipoComEdicao,
} from '@vitale/shared';
import { useAuthStore } from './auth.store';
import { useSettingsStore } from './settings.store';
import {
  TrocaRecusada,
  assinaturaDoCaderno,
  buscarEdicao,
  carimbarCapa,
  classeDoDesfecho,
  comDadoDaEntrada,
  fraseDoNaoImpresso,
  imprimirEdicao,
  problemasDoDesfecho,
  rotuloCurtoDaEdicao,
  rotuloDaEdicao,
  trocarCapa as trocarCapaDaEdicao,
} from '../lib/edicao-ia';

/**
 * As edições impressas da Retrospectiva (ADRs 0038 e 0040 · Stories 1.9, 1.10 e 1.11).
 *
 * Uma edição é o **conjunto dos cadernos** de um período fechado, guardado aqui
 * por `dono|tipo|inicio|fim`. Desde a 1.11 o estado de cada caderno vem de **duas
 * fontes**, e a tela nunca as confunde:
 *
 * - **o banco** diz o que está impresso — o texto, a assinatura e a posição;
 * - **a sessão** diz o que acabou de acontecer — na fila, escrevendo, reprovado
 *   com os problemas, erro. Ela é memória e **nunca é persistida**: a reprovação
 *   não sobrevive ao relançamento do app, e isso é decisão declarada da 1.11, não
 *   esquecimento. Um texto reprovado nunca chega ao banco (o `CHECK` proíbe texto
 *   vazio), e `edicoes_ia` é tabela de edição publicada, não de tentativa.
 *   Persistir a reprovação é "Ask First" — muda uma decisão de produto.
 *
 * Três regras de comportamento que as telas herdam sem ter que saber:
 *
 * - **Nunca gera sozinha.** Abrir a Retrospectiva ou a rota da revista lê o que já
 *   existe, e ler é de graça. Escrever é o toque do dono — a edição inteira
 *   (`imprimir`) ou um caderno só (`imprimirCaderno`).
 * - **Nunca reordena.** A ordem dos impressos vem da coluna `posicao`, congelada
 *   na última impressão e recalculada só pela função do banco numa reimpressão. A
 *   store não ordena os impressos; os sem linha vão na ordem do catálogo.
 * - **Uma impressão por período de cada vez.** Enquanto uma corre, nenhuma outra
 *   começa nesse período, e nenhum botão de escrever aparece.
 *
 * ## O caderno silenciado (Story 2.5)
 *
 * A revista pode ser contrariada: o dono silencia um caderno no painel Diagramação
 * e ele **some da leitura e deixa de ser pedido à nuvem**. Quem filtra é este
 * hospedeiro, não o núcleo — as derivações puras recebem a lista de visíveis
 * (ausente ⇒ os quatro, o mesmo idioma de `OpcoesDaImpressao.cadernos`), e as
 * ações a leem da `settings.store`, porque ação que depende de quem a chama passar
 * a lista é ação que um dia alguém chama sem ela.
 *
 * **Silenciar nunca escreve no banco.** O texto impresso continua lá, e a
 * sequência não apaga caderno que não foi pedido — dessilenciar devolve tudo.
 */

/* ── a sessão ────────────────────────────────────────────────────────────── */

/**
 * O que a sessão sabe de um caderno. **Memória, nunca persistida.**
 *
 * `escrito` é o texto que passou na conferência e espera a gravação: mostrar é
 * progressivo, gravar é atômico — a sequência grava o conjunto no fim, e só a
 * releitura do banco traz a assinatura.
 */
export type SessaoDoCaderno =
  | { readonly fase: 'na-fila' }
  | { readonly fase: 'escrevendo' }
  | { readonly fase: 'escrito'; readonly texto: string }
  /** Uma das seis causas permanentes. `motivo` já é a frase da tela. */
  | { readonly fase: 'reprovada'; readonly motivo: string; readonly problemas: readonly string[] }
  /** Uma causa passageira, ou que não é culpa do texto. `motivo` já é a frase da tela. */
  | { readonly fase: 'erro'; readonly motivo: string }
  /** Não havia o que um modelo acrescentasse: o caderno some. */
  | { readonly fase: 'mudo' };

export type SessaoDaEdicao = Readonly<Partial<Record<CadernoId, SessaoDoCaderno>>>;

/** A impressão em curso num período: a edição inteira, ou um caderno. */
export type ImpressaoEmCurso = 'edicao' | CadernoId;

/** O aviso do período fechado em que nenhum caderno tem o que dizer. Sem botão: tocar não mudaria nada. */
export const AVISO_SEM_CADERNO = 'Nenhum caderno deste período tem o que dizer.';

/**
 * O aviso da edição que ficou **muda por escolha do dono** (Story 2.5).
 *
 * Sem ele a rota é um beco: capa com o período, nada abaixo, nenhum botão e
 * nenhuma explicação — e o silêncio foi decidido noutra tela, talvez semanas
 * antes. O aviso diz de quem é a decisão e **onde se desfaz**; ele não é botão
 * porque a Diagramação não mora aqui, e uma rota que abrisse o painel da outra
 * tela seria um segundo caminho até a mesma preferência.
 */
export const AVISO_TUDO_SILENCIADO =
  'Os quatro cadernos estão silenciados. Abra a Diagramação na Retrospectiva para voltar a escrevê-los.';

/** O mesmo beco com só parte dos cadernos calados — os que sobraram não têm o que dizer. */
export const AVISO_SILENCIO_PARCIAL =
  'Os cadernos que falariam deste período estão silenciados. Abra a Diagramação na Retrospectiva para voltar a escrevê-los.';

/* ── o estado ────────────────────────────────────────────────────────────── */

export type EstadoEdicao =
  /** Primeira leitura, em voo. Não desenha nada: uma porta que pisca a cada foco. */
  | { fase: 'carregando' }
  /** Releitura **pedida pelo leitor**. Desenha, porque toque sem resposta é toque perdido. */
  | { fase: 'relendo' }
  /** Período em curso, ou período que nunca terá edição. A tela não mostra nada. */
  | { fase: 'ausente' }
  /**
   * Não há sessão — e por isso não há a quem perguntar.
   *
   * **Não é a mesma coisa que a sessão ainda estar hidratando.** No arranque a
   * frio, `useAuthStore` nasce sem usuário e só ganha um quando `initialize()`
   * volta do `getSession()`; quem separa os dois é `estadoDe`, pelo `isLoading`.
   */
  | { fase: 'sem-sessao' }
  /**
   * Uma porta falhou. `aposImpressao` marca o erro que veio de uma impressão já
   * começada: o `gravar` pode ter feito commit antes de a conexão cair, então a
   * tela não promete escrita — oferece ver o que ficou gravado (a releitura).
   * `sessao` guarda o que a impressão já tinha dito dos cadernos, para a releitura
   * devolver.
   */
  | { fase: 'erro'; mensagem: string; aposImpressao?: true; sessao?: SessaoDaEdicao }
  /**
   * O período fechou e o banco respondeu: `edicao` são os cadernos impressos, na
   * ordem gravada (vazia é "ainda não escrita"), e `sessao` o que acabou de
   * acontecer com os outros. `imprimindo` não é nulo enquanto uma impressão corre.
   *
   * `capa` é o que a impressão inteira carimbou (Story 1.13) — natureza,
   * identidade e a legenda já formatada —, ou `null`: edição impressa antes da
   * 1.13, carimbo que falhou, período ainda não escrito. **Nunca é recalculada
   * aqui**: o que se desenha é o que está gravado, senão a capa de agosto viraria
   * outra em outubro.
   */
  | {
      fase: 'lida';
      tipo: TipoComEdicao;
      inicio: string;
      edicao: Edicao;
      capa: Capa | null;
      sessao: SessaoDaEdicao;
      imprimindo: ImpressaoEmCurso | null;
    };

interface EdicaoState {
  porPeriodo: Record<string, EstadoEdicao>;
  /** Lê a edição já impressa. Não chama o modelo, não gasta. */
  carregar: (entrada: EntradaPacote) => Promise<void>;
  /** Relê a pedido do leitor. Continua sem escrever nada. */
  recarregar: (entrada: EntradaPacote) => Promise<void>;
  /** "Escrever a edição": período fechado, nada impresso, dados prontos, algum caderno com dado. */
  imprimir: (entrada: EntradaPacote, dadosProntos: boolean) => Promise<void>;
  /** "Escrever este caderno", "…de novo" ou "Tentar de novo": só aquele caderno, sem linha e com dado. */
  imprimirCaderno: (entrada: EntradaPacote, dadosProntos: boolean, caderno: CadernoId) => Promise<void>;
  /**
   * "Trocar a capa" (Story 1.16): recarimba a capa com a foto que o dono escolheu,
   * e só a capa. **Nunca rejeita** — a falha volta como mensagem, para o seletor a
   * mostrar com a seleção intacta.
   */
  trocarCapa: (entrada: EntradaPacote, foto: ActivityPhoto) => Promise<ResultadoDaTroca>;
  estado: (entrada: EntradaPacote) => EstadoEdicao;
}

/**
 * O que a troca da capa respondeu. `ok: false` traz **a frase da tela**: a troca é
 * ato do dono e falha em voz alta, ao contrário do carimbo da impressão, que só
 * loga.
 */
export type ResultadoDaTroca =
  | { readonly ok: true; readonly capa: Capa }
  | { readonly ok: false; readonly mensagem: string };

/**
 * `<uid>|month|2026-08-01|2026-08-31` — o dono e o período.
 *
 * **O uid entra na chave, e não é decoração.** Sem ele o mapa é do app, não do
 * usuário: quem sai e entra com outra conta encontraria o texto da anterior já
 * desenhado. Com o uid na chave o estado do outro dono é **inalcançável**.
 */
export function chaveDe(uid: string, e: EntradaPacote): string {
  const r = e.resumo;
  return `${uid}|${r.kind}|${r.startISO}|${r.endISO}`;
}

/**
 * O estado de uma chave — a **mesma** função dos dois lados.
 *
 * A tela não pode chamar função dentro do seletor (o seletor devolveria objeto
 * novo a cada quadro), então ela assina `porPeriodo` e deriva aqui fora. O
 * `estado()` da store faz o mesmo com o mapa que já tem.
 *
 * `chave` nula é a ausência de um dono — e `sessaoHidratando` decide **qual**
 * das duas ausências é. O parâmetro não tem padrão de propósito.
 */
export function estadoDe(
  porPeriodo: Record<string, EstadoEdicao>,
  chave: string | null,
  sessaoHidratando: boolean,
): EstadoEdicao {
  if (chave === null) {
    return sessaoHidratando ? { fase: 'carregando' } : { fase: 'sem-sessao' };
  }
  return porPeriodo[chave] ?? { fase: 'carregando' };
}

/**
 * Os dados que a edição narra já chegaram? — a prontidão que a tela calcula.
 *
 * O `summary` da Retrospectiva é recalculado da memória, e a memória pode estar
 * pela metade: a busca da retro em voo, a janela carregada cobrindo outro
 * intervalo, ou as atividades ainda chegando. Uma impressão nesse intervalo
 * congelaria para sempre uma edição com fatos incompletos.
 */
export function dadosProntosParaImprimir(
  retro: { readonly loaded: boolean; readonly loading: boolean; readonly loadedSince: string | null },
  atividades: { readonly loaded: boolean; readonly loading: boolean },
  since: string,
): boolean {
  return retro.loaded && !retro.loading && retro.loadedSince !== null && retro.loadedSince <= since
    && atividades.loaded && !atividades.loading;
}

/**
 * A janela da Retrospectiva precisa ser (re)buscada para cobrir `since`?
 *
 * `ensure` sai cedo quando uma busca está em voo — e a busca em voo pode ser de
 * uma janela **mais estreita** (a Retrospectiva na Semana, a rota pedindo o Ano).
 * Quem chamou nesse instante perde a vez, e nada o chamaria de novo quando a busca
 * terminasse: os dados nunca ficariam prontos até o próximo foco. O efeito que
 * garante a janela reage a esta resposta, e ela muda quando `loading` volta a falso.
 *
 * **Falha não se repete sozinha.** `loading` voltando a falso é o que dispara o
 * efeito de novo; se a busca falhou, pedi-la no mesmo quadro daria um laço quente
 * enquanto a rede estivesse fora. Por isso a janela que falhou (`falhouEm`) responde
 * não — quem tenta de novo é o foco da tela, que chama `ensure` direto.
 */
export function precisaGarantirJanela(
  retro: {
    readonly loaded: boolean;
    readonly loading: boolean;
    readonly loadedSince: string | null;
    readonly falhouEm?: string | null;
  },
  since: string,
): boolean {
  if (retro.loading) return false;
  if (retro.falhouEm === since) return false;
  return !(retro.loaded && retro.loadedSince !== null && retro.loadedSince <= since);
}

/**
 * Uma impressão pode começar? — **a** regra, que as ações conferem e que decide os
 * botões de `vistaDaEdicao`.
 *
 * `comDado` é a resposta do núcleo (`comDadoDaEntrada`), e `null` quando não há
 * resposta — os dados da Retrospectiva ainda não chegaram, ou a entrada foi
 * recusada. Sem resposta, nada imprime.
 *
 * O período foi lido e fechou, **não é semana**, **nenhuma impressão corre
 * nele**, e:
 *
 * - **a edição inteira**: nada impresso, e algum caderno com o que dizer;
 * - **um caderno**: ele tem o que dizer, não tem linha e não calou nesta sessão.
 *
 * ## A semana nunca imprime (Story 3.1)
 *
 * A semana é **postal**: calculada na hora, nunca gravada (contrato do Épico 2).
 * Até esta story nada aqui olhava o tipo — a rota `/revista/semana/…` desenhava a
 * mesma edição do mês, com o botão de escrever, e cinco semanas foram gravadas
 * por esse caminho.
 *
 * **Esta linha não é a porta; é a cara dela.** A porta é do núcleo
 * (`ia/imprimir-sequencia.ts`, que devolve `semana` sem buscar, chamar nem
 * gravar): se esta guarda sumisse, a impressão continuaria recusada. Ela existe
 * para nenhum botão de escrever aparecer numa semana — o que é decidido por
 * `vistaDaEdicao`, que lê exatamente esta função —, e não para ser a defesa.
 */
export function podeImprimir(
  estado: EstadoEdicao | undefined,
  comDado: readonly CadernoId[] | null,
  alvo: ImpressaoEmCurso,
): boolean {
  if (comDado === null || estado?.fase !== 'lida' || estado.imprimindo !== null) return false;
  if (estado.tipo === TIPO_DO_POSTAL) return false;
  if (alvo === 'edicao') return estado.edicao.length === 0 && comDado.length > 0;
  return comDado.includes(alvo)
    && !estado.edicao.some((c) => c.caderno === alvo)
    && estado.sessao[alvo]?.fase !== 'mudo';
}

/**
 * A capa pode ser trocada agora? — a regra que a ação `trocarCapa` confere (Story 1.16).
 *
 * As mesmas duas condições de `comFoto` — **edição impressa** e **capa de foto**
 * —, porque a troca mora só na ficha, e a ficha só abre na capa de foto. E mais
 * uma: **nenhuma impressão correndo** no período. Uma reimpressão que termina
 * relê a capa do banco; trocar no meio dela é disputar a mesma linha com quem a
 * vai reler.
 */
export function podeTrocarCapa(estado: EstadoEdicao | undefined): boolean {
  return estado?.fase === 'lida'
    && estado.imprimindo === null
    && estado.edicao.length > 0
    && estado.capa?.natureza === 'foto';
}

/* ── o que as telas desenham ─────────────────────────────────────────────── */

/** A porta no bloco `lede` da Retrospectiva — um alvo de toque só, que leva à rota. */
export type PortaDaEdicao =
  /** Carregando, período em curso, Total: ausência. */
  | { tipo: 'nada' }
  | { tipo: 'sem-sessao' }
  | { tipo: 'erro'; mensagem: string }
  /** Nada impresso ainda, e uma impressão correndo. */
  | { tipo: 'escrevendo' }
  /** Fechado e não escrito: a frase e a seta, **sem botão**. */
  | { tipo: 'nao-escrita' }
  /**
   * A miniatura em papel com o período curto, e a chamada inteira do **primeiro
   * caderno visível** — a mesma manchete da capa da rota (ver `chamadaDaCapa`).
   */
  | { tipo: 'impressa'; periodo: string; chamada: string | null };

/**
 * A porta, do estado — pura.
 *
 * Com qualquer caderno impresso ela é `impressa`, mesmo com a reimpressão de outro
 * correndo: o texto no banco continua valendo, e é dele que a chamada sai.
 *
 * `visiveis` é a lista do dono (Story 2.5): a chamada do cartão é a **mesma**
 * manchete da capa da rota, então ela obedece ao silêncio pela mesma regra. Sem
 * isso, o caderno que ele calou continuaria falando na Retrospectiva — que é
 * exatamente onde ele o calou.
 *
 * ## A semana: ausência, nunca pendência (Story 3.1)
 *
 * Uma semana **sem texto** dá `nada`, e não `nao-escrita`. A frase daquele
 * estado — *"Este período fechou e ainda não foi escrito"* — promete uma edição
 * que **nunca vai existir** desde que o núcleo passou a recusar a impressão de
 * semana; e a Retrospectiva abre justamente em semana, então seria a primeira
 * frase da primeira tela.
 *
 * A regra não é nova: `LeituraDaEdicao.ausente` (`lib/edicao-ia.ts`) já a declara
 * para o Total — *"dizer 'fechou e não foi escrito' nele seria prometer uma
 * edição que o banco não aceita"*. A semana entra na mesma porta, com uma
 * diferença que a story existe para preservar: **`impressa` continua valendo**.
 * As cinco semanas escritas antes de a porta fechar têm texto gravado, e o
 * cartão continua sendo o caminho até ele.
 *
 * `escrevendo` também não alcança a semana — `podeImprimir` recusa antes de
 * qualquer impressão começar —, e por isso não há um terceiro ramo aqui.
 */
export function portaDe(
  estado: EstadoEdicao,
  visiveis: readonly CadernoId[] = CADERNO_IDS,
): PortaDaEdicao {
  switch (estado.fase) {
    case 'carregando':
    case 'relendo':
    case 'ausente':
      return { tipo: 'nada' };
    case 'sem-sessao':
      return { tipo: 'sem-sessao' };
    case 'erro':
      return { tipo: 'erro', mensagem: estado.mensagem };
    case 'lida':
      if (estado.edicao.length > 0) {
        return {
          tipo: 'impressa',
          periodo: rotuloCurtoDaEdicao(estado.tipo, estado.inicio),
          chamada: chamadaDaCapa(estado.edicao, visiveis),
        };
      }
      // Ver "A semana: ausência, nunca pendência", acima. Fica **depois** do
      // ramo `impressa`, e a ordem é a regra: invertida, as cinco semanas já
      // escritas perderiam o caminho até o texto delas.
      if (estado.tipo === TIPO_DO_POSTAL) return { tipo: 'nada' };
      return estado.imprimindo !== null ? { tipo: 'escrevendo' } : { tipo: 'nao-escrita' };
    default:
      return faseSemPorta(estado);
  }
}

function faseSemPorta(nunca: never): PortaDaEdicao {
  console.warn('[edicao] fase sem porta:', nunca);
  return { tipo: 'nada' };
}

/* ── o postal da semana (Story 3.1) ──────────────────────────────────────── */

/** Um caderno que esta semana chegou a ter escrito, antes de a porta fechar. */
export interface CadernoGuardado {
  readonly caderno: CadernoId;
  readonly texto: string;
}

/**
 * O texto guardado de uma semana — a **linha** do postal, e nada mais.
 *
 * Cinco semanas foram impressas por `/revista/semana/…` antes de a Story 3.1
 * fechar a porta no núcleo. Esse texto **não se apaga**: o postal leva até ele
 * por uma linha discreta. Esta função é quem decide se a linha existe.
 *
 * **Só a fase `lida` responde, e só com o que está gravado.** Carregando, sem
 * sessão e erro de leitura dão lista vazia — a linha some, e o postal fica igual
 * ao das outras semanas. É decisão, e não descuido: o postal não é sobre a
 * edição, e desenhar "não foi possível ler a edição" num cartão que não tem
 * edição nenhuma explicaria um problema que o leitor não tem.
 *
 * **Texto em branco não conta.** O `CHECK` de `edicoes_ia` recusa texto vazio,
 * mas não recusa um espaço: uma linha assim abriria a folha num caderno sem nada
 * dentro, e a linha teria prometido texto. A régua é a mesma frase da matriz —
 * *"texto ilegível ⇒ a linha some"* —, e um caderno em branco é ilegível.
 *
 * A ordem é a gravada (`posicao`, que `fetchEdicao` já pede) — nunca
 * recalculada, como em todo o resto da revista.
 *
 * **O silêncio da 2.5 não entra aqui, e a ausência é a decisão.** `visiveis`
 * cala cadernos de uma **edição**, que é o que o dono diagrama; a semana não tem
 * edição, e estas linhas são arquivo — texto que já foi publicado e que a story
 * existe para preservar. Filtrá-las pela preferência de leitura de hoje
 * esconderia, sem aviso, o único caminho que sobrou até elas.
 *
 * Mora aqui, e não no render, pelo motivo de sempre: **regra tem teste enquanto
 * render não tem.**
 */
export function guardadosDoPostal(estado: EstadoEdicao): readonly CadernoGuardado[] {
  if (estado.fase !== 'lida') return [];
  return estado.edicao
    .filter((c) => c.texto.trim() !== '')
    .map((c) => ({ caderno: c.caderno, texto: c.texto }));
}

/** A ação de um caderno. Ausente quando não pode agir — nunca um botão desabilitado. */
export type AcaoDoCaderno = 'escrever' | 'escrever-de-novo' | 'tentar-de-novo';

export type CadernoNaVista =
  /**
   * Impresso — ou escrito e à espera da gravação, e aí sem `assinatura`.
   *
   * `chamada` é a primeira frase do texto — a linha do sumário (Story 1.14). Ela
   * é decidida **aqui, e não no render**: é a mesma `chamadaDoTexto` que dá a
   * manchete da capa logo acima, e regra tem teste enquanto render não tem. Se um
   * dia o corte da frase mudar, muda num lugar só.
   *
   * `null` é caderno cujo texto não fecha frase nenhuma — **nunca** string vazia.
   * A linha do sumário fica assim mesmo, com o nome e sem chamada.
   */
  | {
      caderno: CadernoId; estado: 'pronta'; texto: string;
      chamada: string | null; assinatura: string | null; errata: boolean;
    }
  | { caderno: CadernoId; estado: 'na-fila' }
  | { caderno: CadernoId; estado: 'escrevendo' }
  | { caderno: CadernoId; estado: 'reprovada'; motivo: string; problemas: readonly string[]; acao?: 'escrever-de-novo' }
  | { caderno: CadernoId; estado: 'erro'; motivo: string; acao?: 'tentar-de-novo' }
  | { caderno: CadernoId; estado: 'nao-escrito'; acao?: 'escrever' };

export interface CapaNaVista {
  /** O período por extenso — "Agosto de 2026". */
  periodo: string;
  /** Algum caderno está impresso. */
  impressa: boolean;
  /**
   * A chamada do **primeiro caderno visível**, **inteira** e sem corte — ou
   * `null`. Desde a 2.5 não é o caderno em `posicao` 1: ver `chamadaDaCapa`.
   */
  manchete: string | null;
  /**
   * O que a impressão carimbou — natureza, identidade da foto e a legenda já
   * formatada —, ou `null`, e aí a capa é a em papel da 1.11.
   *
   * **Passa inteira, sem ser reinterpretada.** A manchete acima continua derivada
   * do miolo — o primeiro caderno visível — e não congela junto: uma reimpressão
   * parcial que troque o líder, ou um silêncio que o remova, troca a manchete sob
   * a mesma imagem, e isso é desenho, não descuido.
   */
  carimbada: Capa | null;
  /**
   * A capa é a **de foto**? — a decisão, aqui e não na tela.
   *
   * Ela nasceu no componente e voltou para cá porque é regra, não desenho: são as
   * mesmas duas condições da matriz, e fora da vista elas ficavam sem teste. O que
   * continua na tela é só o que a vista não sabe — se o arquivo da biblioteca
   * resolveu.
   *
   * **Exige edição impressa**, e isso não é zelo: `edicoes_capa` não tem chave
   * estrangeira para `edicoes_ia` (o carimbo guarda valor, não ponteiro), então
   * uma capa sobrevive aos cadernos que cobria. Desenhar a foto sobre uma edição
   * sem caderno esconderia o convite e o botão — o dono ficaria sem caminho para
   * escrever, olhando uma capa bonita.
   */
  comFoto: boolean;
  /**
   * A natureza carimbada, **quando ela tem desenho a pedir** — ou `null` (Story
   * 2.4a).
   *
   * Mesma guarda de {@link CapaNaVista.comFoto}, e pelo mesmo motivo: `edicoes_capa`
   * não tem chave estrangeira para `edicoes_ia`, então uma capa sobrevive aos
   * cadernos que cobria. Desenhar o traçado de um período que perdeu o texto
   * esconderia o convite e o botão atrás de uma capa bonita.
   *
   * É daqui que a rota escolhe o desenhista (`desenhoDaCapa`, no núcleo): `foto`
   * tem caminho próprio, `tracado` e `grade` entram em `CapaEmPapel` no lugar do
   * fundo liso, e `null` é o papel de sempre.
   */
  natureza: NaturezaDaCapa | null;
  /**
   * A legenda carimbada — a frase já formatada, **passada como veio** — ou `null`
   * quando não há capa na tela, ou quando ela não teria o que acrescentar.
   *
   * Vale para as **três** naturezas desde a 2.4a. Na `foto` ela é a descrição da
   * imagem (EXPERIENCE §Accessibility Floor) e o que resta quando o arquivo não
   * resolve; na `tracado` ela é a cidade e o quilômetro do desenho que a story
   * acabou de criar.
   *
   * **A exceção é a `grade`**, e é por isso que esta regra não é "a legenda
   * carimbada, sempre": `escolherCapa` carimba ali o **rótulo do período**
   * (`comRede(null, …)`), porque o `CHECK` do banco recusa legenda vazia. A capa
   * já imprime esse rótulo em serifada, grande, duas linhas acima — repeti-lo em
   * mono no pé escreveria "Agosto de 2026" duas vezes na mesma tela, e o VoiceOver
   * o leria duas vezes. **Suprimir é da tela, e o carimbo fica intacto**: mexer em
   * `escolherCapa` é *Ask First*, e a ficha da capa continua lendo a linha crua em
   * {@link CapaNaVista.carimbada}.
   */
  legenda: string | null;
  /**
   * Nada impresso e uma impressão correndo: a capa diz "Escrevendo a edição…" no
   * lugar do convite — a mesma frase da porta.
   */
  escrevendo: boolean;
  /** "Escrever a edição" aparece. */
  escrever: boolean;
  /** Fechado, nada impresso, e nenhum caderno com o que dizer: o aviso no lugar do botão. */
  semCaderno: boolean;
}

export type VistaDaEdicao =
  /** Carregando, período em curso, Total: nada. */
  | { tipo: 'nada' }
  /** A releitura que o leitor pediu. */
  | { tipo: 'lendo' }
  | { tipo: 'sem-sessao' }
  | { tipo: 'erro'; mensagem: string; aposImpressao: boolean }
  | {
      tipo: 'edicao';
      capa: CapaNaVista;
      cadernos: readonly CadernoNaVista[];
      /**
       * A frase para o miolo que ficou vazio **por silêncio** — ou `null` (Story
       * 2.5). É o beco: nada a ler, nada a tocar, e a causa está noutra tela.
       *
       * Só aparece quando não há nada a mostrar **nem** nada a fazer: com o convite
       * e o botão na capa, ou com uma impressão correndo, ela seria ruído sobre uma
       * tela que já responde.
       */
      avisoDoSilencio: string | null;
    };

/**
 * A chamada do **primeiro caderno visível** — que é a manchete.
 *
 * `edicao` chega ordenada por `posicao` (`fetchEdicao` pede `order('posicao')`), e
 * a manchete é a chamada da primeira linha que o dono não silenciou. Posição lida,
 * nunca recalculada.
 *
 * **Não é `find(c => c.posicao === 1)`, e a diferença é a story inteira** (2.5):
 * procurar pelo VALOR 1 devolve `undefined` quando o líder está silenciado, e a
 * capa ficaria sem manchete enquanto três cadernos visíveis falam logo abaixo. O
 * buraco na numeração é esperado: silenciar nunca escreve, então a `posicao`
 * gravada não muda — quem pula o buraco é a leitura.
 *
 * `null` quando nenhum caderno visível está impresso — ou quando o texto do
 * primeiro não fecha frase nenhuma.
 */
function chamadaDaCapa(edicao: Edicao, visiveis: readonly CadernoId[]): string | null {
  return chamadaDoTexto(edicao.find((c) => visiveis.includes(c.caderno))?.texto);
}

/**
 * A rota da revista, do estado — pura (Story 1.11, quadros 2 a 5 da proposta).
 *
 * `comDado` é a resposta do núcleo (`cadernosComDado`), em ordem de catálogo, ou
 * **`null` quando os dados da Retrospectiva ainda não chegaram** — e aí nada que
 * escreve aparece: nem "Escrever a edição" nem o botão de caderno. Um toque com a
 * memória pela metade congelaria fatos incompletos, e o "tem dado" de uma memória
 * pela metade também não é resposta.
 *
 * **A capa** é em papel: o período, e a manchete quando há edição impressa. Sem
 * nada impresso, o convite — ou, com uma impressão correndo, "Escrevendo a
 * edição…", a frase da porta.
 *
 * **Os botões saem de `podeImprimir`**, a mesma regra que a ação confere: o que
 * aparece é exatamente o que imprime.
 *
 * **O miolo**, na ordem da regra: os impressos na ordem de `posicao` (a do banco),
 * e depois os cadernos com dado e sem linha, na ordem do catálogo. Caderno sem
 * dado não aparece, e o mudo some. Numa edição que nunca foi escrita e onde nada
 * aconteceu nesta sessão, o miolo é vazio: o convite está na capa. Durante uma
 * impressão, nenhum caderno tem ação.
 *
 * **A errata** é por caderno: `precisaErrata(c, aggVersion)` marca só aquele, e o
 * texto fica como está.
 *
 * **A chamada de cada caderno pronto sai daqui** (Story 1.14), pela mesma
 * `chamadaDoTexto` que dá a manchete da capa duas linhas acima. O sumário da rota
 * é uma linha por caderno **do miolo** — na ordem que este vetor já tem —, então
 * o caderno que não está pronto entra na lista do mesmo jeito, só sem chamada.
 *
 * **O silêncio** (Story 2.5) é `visiveis`: ausente ⇒ os quatro, o mesmo idioma de
 * `OpcoesDaImpressao.cadernos`. O caderno silenciado não entra no miolo (nem
 * impresso, nem com dado, nem com o que a sessão diga dele), não dá manchete e não
 * oferece botão. Ele continua gravado, e o `semCaderno` da capa **não** o conta:
 * "nenhum caderno tem o que dizer" é resposta do núcleo sobre o período, e
 * silenciar não muda o que aconteceu em agosto.
 */
export function vistaDaEdicao(
  estado: EstadoEdicao,
  comDado: readonly CadernoId[] | null,
  aggVersion: number,
  visiveis: readonly CadernoId[] = CADERNO_IDS,
): VistaDaEdicao {
  switch (estado.fase) {
    case 'carregando':
    case 'ausente':
      return { tipo: 'nada' };
    case 'relendo':
      return { tipo: 'lendo' };
    case 'sem-sessao':
      return { tipo: 'sem-sessao' };
    case 'erro':
      return { tipo: 'erro', mensagem: estado.mensagem, aposImpressao: estado.aposImpressao === true };
    case 'lida':
      break;
    default:
      return faseSemVista(estado);
  }

  const { edicao, sessao, imprimindo } = estado;
  const correndo = imprimindo !== null;
  /**
   * **Sobre a edição inteira, não sobre a parte visível.** É resposta do banco:
   * "este período já foi escrito". Silenciar o único caderno impresso não devolve
   * o período ao convite — ele foi escrito, e o texto continua gravado.
   */
  const nadaImpresso = edicao.length === 0;
  const visivel = (caderno: CadernoId): boolean => visiveis.includes(caderno);
  /**
   * Quem tem o que dizer **e** não foi silenciado — a lista que decide os botões.
   * `null` continua sendo "ainda não há resposta", e não "ninguém".
   */
  const comDadoVisivel = comDado === null ? null : comDado.filter(visivel);
  /** A ação de um caderno, pela mesma regra que a ação confere. */
  const acaoPara = <A extends AcaoDoCaderno>(caderno: CadernoId, acao: A): { acao?: A } =>
    (podeImprimir(estado, comDadoVisivel, caderno) ? { acao } : {});

  const carimbada = estado.capa;
  /**
   * A capa **na tela** — a carimbada, quando há edição impressa sob ela. O campo
   * `carimbada` abaixo continua passando a linha crua, sem esta guarda: é ela que
   * a ficha da capa aberta (1.16) lê, e a ficha fala da escolha, não do desenho.
   */
  const naTela = nadaImpresso ? null : carimbada;
  const natureza = naTela?.natureza ?? null;
  const periodo = rotuloDaEdicao(estado.tipo, estado.inicio);
  const capa: CapaNaVista = {
    periodo,
    impressa: !nadaImpresso,
    manchete: chamadaDaCapa(edicao, visiveis),
    carimbada,
    comFoto: natureza === 'foto',
    natureza,
    // Igual ao período é a legenda da `grade`, que a capa já imprime em cima.
    // Comparada pelo texto, e não pela natureza: se um dia a legenda de outra
    // natureza cair no rótulo (a rede `comRede` faz isso), a repetição some junto.
    legenda: legendaQueAcrescenta(naTela?.legenda ?? null, periodo),
    escrevendo: nadaImpresso && correndo,
    escrever: podeImprimir(estado, comDadoVisivel, 'edicao'),
    // `comDado` cru, e não o filtrado: o aviso fala do PERÍODO ("nenhum caderno
    // deste período tem o que dizer"), e com os quatro silenciados isso seria
    // mentira — eles têm, e o dono é que não quer ouvir. Ali a capa fica só com o
    // "fechou e ainda não foi escrito", sem botão e sem aviso falso.
    semCaderno: nadaImpresso && !correndo && comDado !== null && comDado.length === 0,
  };

  const cadernos: CadernoNaVista[] = [];
  for (const c of edicao) {
    if (!visivel(c.caderno)) continue;
    const s = sessao[c.caderno];
    if (s?.fase === 'na-fila' || s?.fase === 'escrevendo') {
      cadernos.push({ caderno: c.caderno, estado: s.fase });
      continue;
    }
    cadernos.push({
      caderno: c.caderno,
      estado: 'pronta',
      texto: c.texto,
      chamada: chamadaDoTexto(c.texto),
      assinatura: assinaturaDoCaderno(c.modelo, c.geradoEm),
      errata: precisaErrata(c, aggVersion),
    });
  }

  const aconteceu = correndo || Object.keys(sessao).length > 0;
  if (!nadaImpresso || aconteceu) {
    const impresso = new Set(edicao.map((c) => c.caderno));
    for (const caderno of CADERNO_IDS) {
      if (impresso.has(caderno) || !visivel(caderno)) continue;
      const temDado = comDado === null || comDado.includes(caderno);
      const s = sessao[caderno];
      if (s === undefined) {
        if (comDado === null || !temDado) continue;
        if (imprimindo === 'edicao') cadernos.push({ caderno, estado: 'na-fila' });
        else cadernos.push({ caderno, estado: 'nao-escrito', ...acaoPara(caderno, 'escrever' as const) });
        continue;
      }
      switch (s.fase) {
        case 'mudo':
          break;
        case 'na-fila':
        case 'escrevendo':
          cadernos.push({ caderno, estado: s.fase });
          break;
        case 'escrito':
          cadernos.push({
            caderno, estado: 'pronta', texto: s.texto, chamada: chamadaDoTexto(s.texto),
            assinatura: null, errata: false,
          });
          break;
        case 'reprovada':
          if (!temDado) break;
          cadernos.push({
            caderno, estado: 'reprovada', motivo: s.motivo, problemas: s.problemas,
            ...acaoPara(caderno, 'escrever-de-novo' as const),
          });
          break;
        case 'erro':
          if (!temDado) break;
          cadernos.push({
            caderno, estado: 'erro', motivo: s.motivo,
            ...acaoPara(caderno, 'tentar-de-novo' as const),
          });
          break;
        default:
          faseDaSessaoSemDesenho(s);
      }
    }
  }

  /**
   * O beco do silêncio: miolo vazio, capa sem convite e sem impressão correndo, e
   * pelo menos um caderno calado. Sem silêncio nenhum, o miolo vazio é a edição
   * nunca escrita — e ali o convite está na capa, que é onde ele deve estar.
   */
  const silenciados = CADERNO_IDS.filter((c) => !visivel(c)).length;
  const mudoPorSilencio = silenciados > 0 && cadernos.length === 0 && !capa.escrever && !capa.escrevendo;
  const avisoDoSilencio = !mudoPorSilencio
    ? null
    : silenciados === CADERNO_IDS.length ? AVISO_TUDO_SILENCIADO : AVISO_SILENCIO_PARCIAL;

  return { tipo: 'edicao', capa, cadernos, avisoDoSilencio };
}

function faseSemVista(nunca: never): VistaDaEdicao {
  console.warn('[edicao] fase sem vista:', nunca);
  return { tipo: 'nada' };
}

function faseDaSessaoSemDesenho(nunca: never): void {
  console.warn('[edicao] caderno da sessão sem desenho:', nunca);
}

/* ── as ações ────────────────────────────────────────────────────────────── */

/** O ramo que não existe: o compilador reprova um estado novo da sequência sem tratamento. */
function estadoNaoTratado(nunca: never): string {
  console.warn('[edicao] a impressão devolveu um estado sem tratamento:', nunca);
  return 'A impressão devolveu uma resposta que o app não sabe ler.';
}

function userId(): string | undefined {
  return useAuthStore.getState().user?.id;
}

/** A sessão ainda está sendo lida do disco (`initialize()` não voltou). */
function sessaoHidratando(): boolean {
  return useAuthStore.getState().isLoading;
}

/**
 * Os cadernos que o dono não silenciou, **agora** (Story 2.5).
 *
 * A ação lê a preferência ela mesma, como já lê o `userId`: quem imprime não pode
 * depender de quem a chamou ter passado a lista, senão a primeira tela nova paga
 * pelo caderno que ele calou. As derivações puras acima continuam recebendo a
 * lista por parâmetro — elas são puras, e é a tela que já tem a preferência à mão.
 *
 * **`resolveRetroPrefs` aqui não é zelo, é a mesma porta das telas.** O que a
 * `settings.store` guarda em `preferences` nem sempre passou pelo resolvedor: o
 * boot hidrata do cache local (`getJSON`, `settings.store.ts:52-56`) sem resolver
 * nada, e esse cache pode ter sido gravado por uma versão anterior do app. Um
 * `cadernosOcultos: { sono: 42 }` vindo dali lê como silêncio para um `!ocultos[id]`
 * cru e como ruído para as telas, que resolvem — e aí o botão "Escrever" aparece
 * para um caderno que a ação recusa calada. **O caminho que gasta dinheiro é
 * justamente o que não pode dispensar a resolução.**
 *
 * Sem preferência carregada, os quatro: a ausência de escolha não é silêncio.
 */
function visiveisAgora(): readonly CadernoId[] {
  return cadernosVisiveis(resolveRetroPrefs(useSettingsStore.getState().preferences?.retroPrefs ?? null));
}

/**
 * O leitor não lê `PGRST116`, e mostrá-lo é confessar um detalhe de transporte
 * onde cabia uma frase. O motivo real vai para o log, que é onde ele serve.
 */
function mensagemDeLeitura(e: unknown): string {
  console.warn('[edicao] falha ao ler a edição:', e);
  return 'Não foi possível ler a edição agora.';
}

/**
 * A impressão que falhou numa porta depois de começar. **Não promete escrita**: o
 * `gravar` pode ter feito commit antes de a conexão cair, e o que ficou no banco só
 * a releitura diz.
 */
function mensagemDeImpressao(e: unknown): string {
  console.warn('[edicao] falha ao imprimir a edição:', e);
  return 'A impressão não terminou. Parte dela pode ter ficado gravada.';
}

/** O que a sessão guarda de um desfecho. */
function sessaoDoDesfecho(desfecho: DesfechoDoCaderno): SessaoDoCaderno {
  if (desfecho.tipo === 'escrito') return { fase: 'escrito', texto: desfecho.leitura.frase };
  const classe = classeDoDesfecho(desfecho);
  const motivo = fraseDoNaoImpresso(desfecho);
  if (classe === null || motivo === null) return { fase: 'mudo' };
  return classe === 'reprovada'
    ? { fase: 'reprovada', motivo, problemas: problemasDoDesfecho(desfecho) }
    : { fase: 'erro', motivo };
}

/**
 * A sessão que sobrevive a uma leitura do banco: o que **não** está impresso e
 * aconteceu de fato — reprovada, erro, mudo. Fila, escrita em curso e texto à
 * espera da gravação são da impressão que acabou; o banco é quem responde por eles.
 */
function sessaoQueFica(sessao: SessaoDaEdicao, edicao: Edicao): SessaoDaEdicao {
  const impresso = new Set(edicao.map((c) => c.caderno));
  const fica: Partial<Record<CadernoId, SessaoDoCaderno>> = {};
  for (const caderno of CADERNO_IDS) {
    const s = sessao[caderno];
    if (!s || impresso.has(caderno)) continue;
    if (s.fase === 'reprovada' || s.fase === 'erro' || s.fase === 'mudo') fica[caderno] = s;
  }
  return fica;
}

function sessaoDe(estado: EstadoEdicao | undefined): SessaoDaEdicao | undefined {
  if (estado?.fase === 'lida' || estado?.fase === 'erro') return estado.sessao;
  return undefined;
}

/** O estado de um período lido — `ausente` se o tipo não tem edição (o que `buscarEdicao` já garante). */
function lidaDe(
  entrada: EntradaPacote,
  edicao: Edicao,
  capa: Capa | null | undefined,
  sessao: SessaoDaEdicao | undefined,
): EstadoEdicao {
  const { kind, startISO } = entrada.resumo;
  if (!temEdicao(kind)) return { fase: 'ausente' };
  return {
    fase: 'lida', tipo: kind, inicio: startISO, edicao, capa: capa ?? null,
    sessao: sessaoQueFica(sessao ?? {}, edicao), imprimindo: null,
  };
}

type Definir = (fn: (s: EdicaoState) => Partial<EdicaoState>) => void;

/** As chaves com uma leitura em voo — para o foco da tela não empilhar consultas. */
const lendo = new Set<string>();

/**
 * A geração de cada chave: sobe quando uma impressão começa e quando termina.
 *
 * É o que diz a uma leitura que a resposta dela ficou velha. Olhar só se há
 * impressão **agora** não basta: uma leitura silenciosa lenta pode voltar depois de
 * a impressão ter terminado e gravado a edição, e aí ela sobrescreveria a edição
 * recém-impressa com a lista vazia de antes — a rota voltaria a dizer "ainda não
 * foi escrito", com o botão.
 */
const geracoes = new Map<string, number>();

function geracaoDe(chave: string): number {
  return geracoes.get(chave) ?? 0;
}

function novaGeracao(chave: string): void {
  geracoes.set(chave, geracaoDe(chave) + 1);
}

/**
 * Uma leitura, e o estado que ela produz.
 *
 * **Silenciosa sobre o que já está desenhado.** A primeira leitura põe
 * `carregando` (que não desenha nada) e a do leitor põe `relendo` (que desenha);
 * mas a releitura do foco sobre um período já lido **não apaga a tela**: a capa
 * continua lá, troca só quando a resposta chega — e, se a leitura falha, **fica**,
 * com o motivo no log. Uma capa boa não vira erro por uma releitura que ninguém
 * pediu.
 *
 * **A sessão sobrevive à releitura** — os motivos da última tentativa continuam
 * dizendo por quê. E uma impressão que começou (ou terminou) enquanto a leitura
 * corria vence: a geração da chave mudou, e esta resposta já é velha.
 */
async function ler(
  set: Definir,
  get: () => EdicaoState,
  entrada: EntradaPacote,
  uid: string,
  modo: 'carregando' | 'relendo',
): Promise<void> {
  const chave = chaveDe(uid, entrada);
  if (lendo.has(chave)) return;
  const antes = get().porPeriodo[chave];
  const sessao = sessaoDe(antes);
  const geracao = geracaoDe(chave);
  const por = (estado: EstadoEdicao): void => set((s) => ({ porPeriodo: { ...s.porPeriodo, [chave]: estado } }));

  lendo.add(chave);
  if (!(modo === 'carregando' && antes?.fase === 'lida')) por({ fase: modo });
  try {
    const r = await buscarEdicao(uid, entrada);
    if (geracaoDe(chave) !== geracao) return;
    por(r.estado === 'ausente'
      ? { fase: 'ausente' }
      : lidaDe(entrada, r.edicao, r.capa, sessaoDe(get().porPeriodo[chave]) ?? sessao));
  } catch (e) {
    if (geracaoDe(chave) !== geracao) return;
    const mensagem = mensagemDeLeitura(e);
    // A releitura silenciosa sobre uma edição lida que falha deixa a edição como
    // está. Se o leitor pediu a releitura enquanto ela corria (`relendo`), aí sim
    // o toque recebe a resposta: o erro.
    const agora = get().porPeriodo[chave];
    if (agora?.fase === 'lida') return;
    por({ fase: 'erro', mensagem, ...(sessao ? { sessao } : {}) });
  } finally {
    lendo.delete(chave);
  }
}

/** O motivo do erro passageiro de um caderno cuja releitura antes de pagar falhou. */
const MOTIVO_SEM_LEITURA = 'O caderno não foi escrito: não foi possível ler a edição agora.';
/** A impressão do caderno falhou depois de começar: o `gravar` pode ter feito commit. */
const MOTIVO_IMPRESSAO_INCERTA = 'A impressão deste caderno não terminou. Ele pode ter ficado gravado.';
/** Tudo correu, mas a releitura do fim falhou: o banco é quem sabe se ele ficou. */
const MOTIVO_SEM_RELEITURA = 'Não foi possível ler a edição depois da impressão. O caderno pode ter ficado gravado.';

/**
 * A impressão — da edição inteira ou de um caderno —, numa sequência só:
 *
 * 1. **confere** `podeImprimir` (com a resposta do núcleo sobre quem tem dado) e
 *    marca a impressão antes de qualquer `await`: o segundo toque encontra
 *    `imprimindo` e sai;
 * 2. **relê antes de pagar**: o que a memória diz pode ser velho — a edição (ou o
 *    caderno) pode ter sido impressa depois da última leitura, e imprimir por
 *    cima seria pagar de novo por texto publicado;
 * 3. **preenche a sessão caderno a caderno**, pelos avisos da sequência do núcleo;
 * 4. **relê o banco no fim**: a ordem que a edição passou a ter é a da função do
 *    banco, e só a releitura a traz — junto com a assinatura dos que saíram.
 *
 * Reimprimir um caderno chama a sequência com `cadernos: [c]`. Os outros cadernos
 * impressos ficam intactos e não são reassinados; a ordem do conjunto é
 * recalculada pela função do banco, nunca aqui.
 *
 * **Falha na reimpressão de um caderno é do caderno.** A releitura antes de pagar,
 * a sequência lançando e a releitura do fim, quando falham, deixam a edição lida
 * como estava — Movimento e Rotina continuam na tela — e só o caderno-alvo vai
 * para a sessão como erro passageiro, com "Tentar de novo". Tentar de novo relê
 * antes de pagar, então o caderno que tiver ficado gravado aparece sem custo. A
 * edição inteira, que não tem nada impresso a proteger, continua indo para o erro
 * da edição.
 */
async function imprimirAlvo(
  set: Definir,
  get: () => EdicaoState,
  entrada: EntradaPacote,
  dadosProntos: boolean,
  alvo: ImpressaoEmCurso,
): Promise<void> {
  const uid = userId();
  if (!uid) return;
  const chave = chaveDe(uid, entrada);
  const atual = get().porPeriodo[chave];
  if (atual?.fase !== 'lida') return;

  /**
   * **O silêncio entra ANTES da primeira chamada paga** (Story 2.5), nos dois
   * pontos em que ele importa:
   *
   * 1. aqui, na regra que decide se há o que imprimir — com os quatro
   *    silenciados, `comDado` filtrado fica vazio, `podeImprimir` recusa, e a
   *    sequência nunca é chamada com a lista vazia (que ela recusa com
   *    `TypeError`);
   * 2. logo abaixo, em `cadernos`, que é a lista de candidatos da sequência.
   *
   * **É um retrato, tirado uma vez, e isso é declarado.** Silenciar um caderno
   * DEPOIS deste ponto — enquanto a releitura ou a sequência correm — não cancela
   * a impressão dele: ele continua sendo pago e gravado, e some da tela no mesmo
   * quadro, porque a tela lê a preferência viva. O painel **não trava** durante uma
   * impressão.
   *
   * A escolha é essa, e não o travamento, por três razões: o custo é **uma**
   * chamada, não a edição; nada se perde (silenciar nunca apaga — dessilenciar
   * devolve o texto que ficou gravado); e a alternativa seria travar um painel
   * global — a diagramação é do usuário — por causa de uma impressão que corre num
   * período só. Reler a preferência aqui embaixo seria pior ainda: `podeImprimir`
   * e `candidatos` passariam a responder a leituras diferentes, e o retrato único é
   * exatamente o que garante que os dois concordem.
   */
  const visiveis = visiveisAgora();
  const comDado = comDadoDaEntrada(entrada, dadosProntos);
  if (!podeImprimir(atual, comDado === null ? null : comDado.filter((c) => visiveis.includes(c)), alvo)) return;

  const por = (estado: EstadoEdicao): void => set((s) => ({ porPeriodo: { ...s.porPeriodo, [chave]: estado } }));
  /** A impressão desta chamada, se ela ainda é a que corre nesta chave. */
  const emCurso = (): Extract<EstadoEdicao, { fase: 'lida' }> | null => {
    const e = get().porPeriodo[chave];
    return e?.fase === 'lida' && e.imprimindo === alvo ? e : null;
  };
  const naSessao = (mudar: (s: SessaoDaEdicao) => SessaoDaEdicao): void => {
    const e = emCurso();
    if (e) por({ ...e, sessao: mudar(e.sessao) });
  };
  /**
   * O caderno-alvo falhou: a edição lida fica como está, sem impressão em curso, e
   * só ele vai para a sessão como erro passageiro.
   */
  const cadernoFalhou = (caderno: CadernoId, motivo: string, edicao: Edicao, sessao: SessaoDaEdicao): void => {
    por({
      ...atual,
      edicao,
      sessao: { ...sessaoQueFica(sessao, edicao), [caderno]: { fase: 'erro', motivo } },
      imprimindo: null,
    });
  };

  /**
   * A capa que esta impressão acabou de carimbar, se carimbou.
   *
   * Fica guardada porque a releitura do fim pode falhar **só na capa** — a leitura
   * dela degrada para `null` de propósito (`buscarEdicao`) — e aí a edição recém
   * impressa apareceria em papel apesar de a capa estar gravada, até o próximo
   * foco. O que acabou de ser escrito é melhor resposta que o nulo de uma consulta
   * que não deu certo.
   */
  let nova: Capa | null = null;

  novaGeracao(chave);
  try {
    // A edição inteira recomeça a sessão: tudo que não está impresso vai para a fila.
    // Um caderno só entra na fila sozinho; os outros guardam o que já diziam.
    por({
      ...atual,
      sessao: alvo === 'edicao' ? {} : { ...atual.sessao, [alvo]: { fase: 'na-fila' } },
      imprimindo: alvo,
    });

    try {
      const lida = await buscarEdicao(uid, entrada);
      if (lida.estado === 'ausente') {
        por({ fase: 'ausente' });
        return;
      }
      const jaImpresso = alvo === 'edicao'
        ? lida.edicao.length > 0
        : lida.edicao.some((c) => c.caderno === alvo);
      if (jaImpresso) {
        por(lidaDe(entrada, lida.edicao, lida.capa, atual.sessao));
        return;
      }
      const e = emCurso();
      if (e) por({ ...e, edicao: lida.edicao, capa: lida.capa });
    } catch (e) {
      const mensagem = mensagemDeLeitura(e);
      if (alvo === 'edicao') {
        por({ fase: 'erro', mensagem, sessao: sessaoQueFica(atual.sessao, atual.edicao) });
      } else {
        cadernoFalhou(alvo, MOTIVO_SEM_LEITURA, atual.edicao, atual.sessao);
      }
      return;
    }

    /** A impressão não terminou de um jeito que se leia: o `gravar` pode ter feito commit. */
    const naoTerminou = (mensagem: string): void => {
      const e = emCurso();
      if (alvo === 'edicao') {
        por({ fase: 'erro', mensagem, aposImpressao: true, sessao: sessaoQueFica(e?.sessao ?? {}, []) });
      } else {
        cadernoFalhou(alvo, MOTIVO_IMPRESSAO_INCERTA, e?.edicao ?? atual.edicao, e?.sessao ?? atual.sessao);
      }
    };

    /**
     * Os candidatos que vão à sequência.
     *
     * Um caderno só: ele mesmo — o botão dele só existe se ele é visível. A
     * edição inteira: **ausente enquanto nada está silenciado**, porque ausente é
     * "os quatro" e é o que a 1.10 sempre mandou; a lista só aparece quando há
     * silêncio, e aí ela é exatamente a dos visíveis. Vazia é impossível aqui —
     * `podeImprimir` já recusou lá em cima.
     *
     * A condição é **igualdade de conjuntos**, escrita como tal. `visiveis` sai de
     * `cadernosVisiveis`, que filtra `CADERNO_IDS`, então hoje comparar tamanhos
     * daria o mesmo — mas é invariante de outro arquivo, e este declara as suas.
     */
    const candidatos: readonly CadernoId[] | undefined = alvo !== 'edicao'
      ? [alvo]
      : CADERNO_IDS.every((c) => visiveis.includes(c)) ? undefined : visiveis;

    try {
      const r = await imprimirEdicao(uid, entrada, {
        ...(candidatos ? { cadernos: candidatos } : {}),
        aoComecar: (caderno, fila) => naSessao((s) => {
          const proxima: Partial<Record<CadernoId, SessaoDoCaderno>> = { ...s };
          for (const c of fila) if (c !== caderno && proxima[c] === undefined) proxima[c] = { fase: 'na-fila' };
          proxima[caderno] = { fase: 'escrevendo' };
          return proxima;
        }),
        aoLer: (caderno, desfecho) => naSessao((s) => ({ ...s, [caderno]: sessaoDoDesfecho(desfecho) })),
      });
      switch (r.estado) {
        /**
         * A semana não grava (Story 3.1). **Inalcançável por esta ação** —
         * `podeImprimir` já a recusou lá em cima —, e escrito assim de propósito:
         * é o núcleo que fecha a porta, e o ramo existe para o compilador cobrar
         * um tratamento em vez de deixar a chave presa em `imprimindo` se algum
         * caminho novo chegar aqui com uma semana.
         *
         * `ausente` é o desfecho certo: a rota da semana não desenha edição
         * nenhuma — ela desenha o postal, que se calcula sozinho.
         */
        case 'semana':
        case 'aberto':
          por({ fase: 'ausente' });
          return;
        case 'sem-caderno':
        case 'nada-gravado':
          break;
        case 'gravada':
          /**
           * **A capa é carimbada aqui, e só aqui** (Story 1.13), quando a impressão
           * gravou — impressão que não gravou nada não teria edição a que a capa
           * pertencesse.
           *
           * A impressão **inteira** sempre recarimba. A **parcial** carimba só
           * quando não há capa nenhuma (regra renegociada com o dono em 17/09): a
           * edição montada caderno a caderno nunca volta a ver o alvo `edicao` — a
           * 1.11 só o oferece com zero cadernos impressos —, e sem isto ela ficaria
           * em papel para sempre. **Capa existente uma parcial nunca troca**: a foto
           * e a legenda são do período, não do caderno.
           *
           * **Antes da releitura**, para a capa nova chegar à tela na mesma
           * resposta do banco que traz a ordem e as assinaturas — senão a rota
           * mostraria a edição impressa com a capa da impressão anterior até o
           * próximo foco. `edicao-store.test.ts` prende essa ordem.
           *
           * O `try/catch` é rede sobre rede: `carimbarCapa` já promete não
           * rejeitar. Se um dia deixar de prometer, o preço é a edição ficar sem
           * capa — nunca o dono ver "a impressão não terminou" sobre um texto que
           * ficou gravado.
           */
          if (alvo === 'edicao' || (emCurso()?.capa ?? atual.capa) === null) {
            try {
              nova = await carimbarCapa(uid, entrada);
            } catch (e) {
              console.warn('[edicao] a capa não foi carimbada:', e);
            }
          }
          break;
        default:
          // Sem este ramo, um estado inesperado deixaria a chave presa em `imprimindo`.
          naoTerminou(estadoNaoTratado(r));
          return;
      }
    } catch (e) {
      naoTerminou(mensagemDeImpressao(e));
      return;
    }

    // Relê o banco no fim. Enquanto a releitura corre, a impressão continua marcada:
    // nenhum botão volta antes de a ordem nova chegar.
    const naSessaoAgora = emCurso();
    const sessao = naSessaoAgora?.sessao ?? {};
    try {
      const relida = await buscarEdicao(uid, entrada);
      por(relida.estado === 'ausente'
        ? { fase: 'ausente' }
        : lidaDe(entrada, relida.edicao, relida.capa ?? nova, sessao));
    } catch (e) {
      const mensagem = mensagemDeLeitura(e);
      if (alvo === 'edicao') {
        por({ fase: 'erro', mensagem, sessao: sessaoQueFica(sessao, []) });
        return;
      }
      // O que a sequência disse do caderno, se foi falha, é mais verdadeiro que um
      // "talvez gravado": fica. Se ele escreveu, só o banco sabe se ficou.
      const dele = sessao[alvo];
      const edicao = naSessaoAgora?.edicao ?? atual.edicao;
      if (dele?.fase === 'reprovada' || dele?.fase === 'erro' || dele?.fase === 'mudo') {
        por({ ...atual, edicao, sessao: sessaoQueFica(sessao, edicao), imprimindo: null });
      } else {
        cadernoFalhou(alvo, MOTIVO_SEM_RELEITURA, edicao, sessao);
      }
    }
  } finally {
    novaGeracao(chave);
  }
}

/* ── a troca da capa (Story 1.16) ────────────────────────────────────────── */

const TROCA_SEM_SESSAO = 'Entre na sua conta para trocar a capa.';
const TROCA_COM_IMPRESSAO = 'A edição está sendo impressa. Troque a capa quando a impressão terminar.';
const TROCA_SEM_CAPA_DE_FOTO = 'Esta edição não tem capa de foto para trocar.';
const TROCA_PELA_MESMA = 'Esta foto já é a capa.';
const TROCA_EM_CURSO = 'A capa já está sendo trocada. Espere a troca terminar.';
const TROCA_FALHOU = 'Não foi possível trocar a capa agora. A capa continua a mesma.';

/**
 * As chaves com uma troca em voo — a segunda troca no mesmo período, antes de a
 * primeira voltar, é recusada sem chamar a porta.
 *
 * Sem isto, dois toques rápidos gravariam duas capas em sequência, e a que fica
 * seria a da gravação que o banco recebeu por último — não necessariamente a do
 * último toque. O seletor já trava o botão durante a troca; esta é a regra, e o
 * botão é só a cara dela.
 */
const trocando = new Set<string>();

/**
 * A frase da tela para uma troca que falhou.
 *
 * As **recusas** (do núcleo sobre a foto, do app sobre o período e o acervo) já
 * nascem frase, e passam como vieram. O resto — rede, RLS, a conta que trocou no
 * meio — é transporte: o leitor não lê `PGRST`, e o motivo real vai para o log.
 */
function mensagemDaTroca(e: unknown): string {
  if (e instanceof TrocaRecusada || e instanceof FotoRecusadaNaTroca) return e.message;
  console.warn('[edicao] a capa não foi trocada:', e);
  return TROCA_FALHOU;
}

/**
 * Troca a capa de uma edição lida — **só a capa**.
 *
 * 1. **Confere** antes de qualquer `await`, e a resposta diz por quê quando não
 *    começa: sem sessão, sem capa de foto, com uma impressão correndo, com outra
 *    troca em voo nesta chave, ou **pela foto que já é a capa**. Esta última não é
 *    zelo: trocar pela mesma foto recarimbaria o motivo como `trocada` para
 *    sempre — e apagaria o nulo das capas anteriores à 1.16, que é a declaração de
 *    que o porquê não foi guardado. A regra mora aqui, e não só no seletor.
 * 2. **Grava** pela porta do carimbo (`trocarCapa` de `lib/edicao-ia`), que recusa
 *    antes do banco o que não pode ser capa.
 * 3. **Sucesso** põe a capa nova no estado e **sobe a geração da chave**: uma
 *    leitura silenciosa que estivesse em voo voltaria com a capa velha e a
 *    reporia — a mesma defesa que a impressão já usa. A geração sobe **só se a
 *    capa entra**: se a fase saiu de `lida` durante a gravação (uma releitura do
 *    leitor, por exemplo), descartar a leitura em voo deixaria a tela presa nela,
 *    e é essa leitura que vai trazer do banco a capa já trocada.
 * 4. **Falha** devolve a mensagem e **não toca o estado**: a capa, a edição e a
 *    sessão ficam como estavam, e o seletor mantém a seleção.
 *
 * O texto, a ordem, as assinaturas e a errata não passam por aqui: o que muda no
 * estado é o campo `capa`, e nenhum outro.
 */
async function trocar(
  set: Definir,
  get: () => EdicaoState,
  entrada: EntradaPacote,
  foto: ActivityPhoto,
): Promise<ResultadoDaTroca> {
  const uid = userId();
  if (!uid) return { ok: false, mensagem: TROCA_SEM_SESSAO };
  const chave = chaveDe(uid, entrada);
  const atual = get().porPeriodo[chave];
  if (atual?.fase === 'lida' && atual.imprimindo !== null) return { ok: false, mensagem: TROCA_COM_IMPRESSAO };
  if (!podeTrocarCapa(atual) || atual?.fase !== 'lida') return { ok: false, mensagem: TROCA_SEM_CAPA_DE_FOTO };
  if (atual.capa?.fotoId === foto.id) return { ok: false, mensagem: TROCA_PELA_MESMA };
  if (trocando.has(chave)) return { ok: false, mensagem: TROCA_EM_CURSO };

  trocando.add(chave);
  try {
    let nova: Capa;
    try {
      nova = await trocarCapaDaEdicao(uid, entrada, foto);
    } catch (e) {
      return { ok: false, mensagem: mensagemDaTroca(e) };
    }

    // O estado de AGORA, e não o de antes do `await`: a edição pode ter sido relida
    // no meio, e só a capa é desta ação.
    const agora = get().porPeriodo[chave];
    if (agora?.fase === 'lida') {
      novaGeracao(chave);
      set((s) => ({ porPeriodo: { ...s.porPeriodo, [chave]: { ...agora, capa: nova } } }));
    }
    return { ok: true, capa: nova };
  } finally {
    trocando.delete(chave);
  }
}

export const useEdicaoStore = create<EdicaoState>((set, get) => ({
  porPeriodo: {},

  estado: (entrada) => {
    const uid = userId();
    return estadoDe(get().porPeriodo, uid ? chaveDe(uid, entrada) : null, sessaoHidratando());
  },

  carregar: async (entrada) => {
    const uid = userId();
    // Sem sessão não há a quem perguntar — e também não há chave sob a qual
    // guardar a resposta. Quem desenha o `sem-sessao` é `estadoDe`.
    if (!uid) return;
    const atual = get().porPeriodo[chaveDe(uid, entrada)];
    // **`ausente` e a edição lida sem nada impresso releem; o resto não.**
    //
    // `ausente` e "nada impresso" são respostas sobre o RELÓGIO e sobre o
    // arquivo: um período olhado em curso fecha, e um período fechado e vazio é
    // impresso (por outro aparelho, pelo backfill). A edição com cadernos
    // impressos fica: período fechado congela, e reabrir nunca reordena.
    //
    // `erro` não relê sozinho: releitura de erro é ato do leitor (`recarregar`),
    // senão o botão "Tentar de novo" chega sem conteúdo. E uma impressão em curso
    // nunca é relida por cima — ela relê sozinha no fim.
    if (atual) {
      if (atual.fase === 'erro' || atual.fase === 'carregando' || atual.fase === 'relendo') return;
      if (atual.fase === 'lida' && (atual.edicao.length > 0 || atual.imprimindo !== null)) return;
    }
    await ler(set, get, entrada, uid, 'carregando');
  },

  recarregar: async (entrada) => {
    const uid = userId();
    if (!uid) return;
    const chave = chaveDe(uid, entrada);
    const atual = get().porPeriodo[chave];
    if (atual?.fase === 'carregando' || atual?.fase === 'relendo') return;
    if (atual?.fase === 'lida' && atual.imprimindo !== null) return;
    // Uma leitura silenciosa já corre nesta chave: o toque não abre outra, mas tem
    // resposta — a fase passa a `relendo`, e a leitura em voo resolve para ela.
    if (lendo.has(chave)) {
      set((s) => ({ porPeriodo: { ...s.porPeriodo, [chave]: { fase: 'relendo' } } }));
      return;
    }
    await ler(set, get, entrada, uid, 'relendo');
  },

  imprimir: (entrada, dadosProntos) => imprimirAlvo(set, get, entrada, dadosProntos, 'edicao'),

  imprimirCaderno: (entrada, dadosProntos, caderno) => imprimirAlvo(set, get, entrada, dadosProntos, caderno),

  trocarCapa: (entrada, foto) => trocar(set, get, entrada, foto),
}));
