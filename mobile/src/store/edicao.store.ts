import { create } from 'zustand';
import {
  CADERNO_IDS,
  chamadaDoTexto,
  precisaErrata,
  temEdicao,
  type CadernoId,
  type Capa,
  type DesfechoDoCaderno,
  type Edicao,
  type EntradaPacote,
  type TipoComEdicao,
} from '@vitale/shared';
import { useAuthStore } from './auth.store';
import {
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
  estado: (entrada: EntradaPacote) => EstadoEdicao;
}

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
 * O período foi lido e fechou, **nenhuma impressão corre nele**, e:
 *
 * - **a edição inteira**: nada impresso, e algum caderno com o que dizer;
 * - **um caderno**: ele tem o que dizer, não tem linha e não calou nesta sessão.
 */
export function podeImprimir(
  estado: EstadoEdicao | undefined,
  comDado: readonly CadernoId[] | null,
  alvo: ImpressaoEmCurso,
): boolean {
  if (comDado === null || estado?.fase !== 'lida' || estado.imprimindo !== null) return false;
  if (alvo === 'edicao') return estado.edicao.length === 0 && comDado.length > 0;
  return comDado.includes(alvo)
    && !estado.edicao.some((c) => c.caderno === alvo)
    && estado.sessao[alvo]?.fase !== 'mudo';
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
  /** A miniatura em papel com o período curto, e a chamada inteira do caderno em `posicao` 1. */
  | { tipo: 'impressa'; periodo: string; chamada: string | null };

/**
 * A porta, do estado — pura.
 *
 * Com qualquer caderno impresso ela é `impressa`, mesmo com a reimpressão de outro
 * correndo: o texto no banco continua valendo, e é dele que a chamada sai.
 */
export function portaDe(estado: EstadoEdicao): PortaDaEdicao {
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
          chamada: chamadaDaCapa(estado.edicao),
        };
      }
      return estado.imprimindo !== null ? { tipo: 'escrevendo' } : { tipo: 'nao-escrita' };
    default:
      return faseSemPorta(estado);
  }
}

function faseSemPorta(nunca: never): PortaDaEdicao {
  console.warn('[edicao] fase sem porta:', nunca);
  return { tipo: 'nada' };
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
  /** A chamada do caderno em `posicao` 1, **inteira** e sem corte — ou `null`. */
  manchete: string | null;
  /**
   * O que a impressão carimbou — natureza, identidade da foto e a legenda já
   * formatada —, ou `null`, e aí a capa é a em papel da 1.11.
   *
   * **Passa inteira, sem ser reinterpretada.** A manchete acima continua derivada
   * do caderno em `posicao` 1 e não congela junto: uma reimpressão parcial que
   * troque o líder troca a manchete sob a mesma imagem, e isso é desenho, não
   * descuido.
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
   * A legenda carimbada, quando ela tem o que dizer na tela — ou `null`.
   *
   * Só na natureza `foto`: é ali que ela é a **descrição da imagem** (EXPERIENCE
   * §Accessibility Floor), e é ali que continua servindo quando a imagem não
   * resolve mais. Na `grade` ela É o período, que a capa já imprime logo acima; na
   * `tracado`, o desenho que ela legenda ainda não existe.
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
  | { tipo: 'edicao'; capa: CapaNaVista; cadernos: readonly CadernoNaVista[] };

/** A chamada do caderno em `posicao` 1 — que é a manchete. Posição lida, nunca recalculada. */
function chamadaDaCapa(edicao: Edicao): string | null {
  return chamadaDoTexto(edicao.find((c) => c.posicao === 1)?.texto);
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
 */
export function vistaDaEdicao(
  estado: EstadoEdicao,
  comDado: readonly CadernoId[] | null,
  aggVersion: number,
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
  const nadaImpresso = edicao.length === 0;
  /** A ação de um caderno, pela mesma regra que a ação confere. */
  const acaoPara = <A extends AcaoDoCaderno>(caderno: CadernoId, acao: A): { acao?: A } =>
    (podeImprimir(estado, comDado, caderno) ? { acao } : {});

  const carimbada = estado.capa;
  const deFoto = !nadaImpresso && carimbada?.natureza === 'foto';
  const capa: CapaNaVista = {
    periodo: rotuloDaEdicao(estado.tipo, estado.inicio),
    impressa: !nadaImpresso,
    manchete: chamadaDaCapa(edicao),
    carimbada,
    comFoto: deFoto,
    legenda: deFoto ? carimbada.legenda : null,
    escrevendo: nadaImpresso && correndo,
    escrever: podeImprimir(estado, comDado, 'edicao'),
    semCaderno: nadaImpresso && !correndo && comDado !== null && comDado.length === 0,
  };

  const cadernos: CadernoNaVista[] = [];
  for (const c of edicao) {
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
      if (impresso.has(caderno)) continue;
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

  return { tipo: 'edicao', capa, cadernos };
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
  if (!podeImprimir(atual, comDadoDaEntrada(entrada, dadosProntos), alvo)) return;

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

    try {
      const r = await imprimirEdicao(uid, entrada, {
        ...(alvo === 'edicao' ? {} : { cadernos: [alvo] }),
        aoComecar: (caderno, fila) => naSessao((s) => {
          const proxima: Partial<Record<CadernoId, SessaoDoCaderno>> = { ...s };
          for (const c of fila) if (c !== caderno && proxima[c] === undefined) proxima[c] = { fase: 'na-fila' };
          proxima[caderno] = { fase: 'escrevendo' };
          return proxima;
        }),
        aoLer: (caderno, desfecho) => naSessao((s) => ({ ...s, [caderno]: sessaoDoDesfecho(desfecho) })),
      });
      switch (r.estado) {
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
}));
