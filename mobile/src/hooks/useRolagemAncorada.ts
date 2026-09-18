/**
 * Rolar até uma âncora na mesma página, e **mover o foco do leitor de tela
 * junto** (Story 1.14).
 *
 * O hook é **genérico de propósito**: a revista é a primeira cliente, não a dona.
 * Um sumário, um índice lateral, um "voltar ao topo" — todos querem a mesma
 * coisa, e a parte difícil não é o `scrollTo`: é o foco. Sem ele, quem usa
 * VoiceOver toca a linha, a página rola por baixo e o leitor continua exatamente
 * onde estava — a navegação fica **inerte** para quem mais precisa dela.
 *
 * Três decisões que quem usar herda sem ter que saber:
 *
 * - **Rolar não navega.** Nenhum `router`, nenhuma entrada na pilha, nenhuma
 *   barra fixa. O destino é conteúdo da mesma página.
 * - **Sem layout, nada acontece.** Enquanto o `onLayout` da âncora não chegou,
 *   `irPara` não rola *e* não move o foco — e não lança nem registra erro. Rolar
 *   para o zero "porque não sabemos" mandaria o leitor para a capa; mover o foco
 *   sem rolar deixaria os dois em lugares diferentes.
 * - **Dois ajustes tiram a animação, por razões diferentes.** *Reduzir Movimento*
 *   porque foi pedido; e o *leitor de tela ligado* porque animação e foco
 *   **brigam**: com a rolagem em curso o iOS reposiciona por conta própria o
 *   elemento focado, e o AC da story — "o elemento lido em seguida é o nome do
 *   caderno de destino" — passa a depender de quem chega primeiro. Sem animação
 *   não há corrida, e quem não está olhando a tela não perde nada com isso. O
 *   ciclo de leitura dos dois (leitura inicial + assinatura da mudança) é o do
 *   `StackedBarChart`, que é o único outro lugar do app que pergunta isso ao
 *   sistema.
 *
 * **O foco vai por `sendAccessibilityEvent(nó, 'focus')`**, que recebe o **ref do
 * host** — e é exatamente por isso que `findNodeHandle` não entra aqui, nem
 * `setAccessibilityFocus`, que a doc atual marca como depreciado. `architecture.test.ts`
 * tranca os dois em zero.
 */
import { useCallback, useEffect, useRef } from 'react';
import {
  AccessibilityInfo,
  type LayoutChangeEvent,
  type ScrollView,
  type View,
} from 'react-native';

/** O nó de host que recebe o foco — o ref de uma `View`, nunca um handle numérico. */
export type NoDaAncora = React.ComponentRef<typeof View>;

/** O que uma âncora pendura no componente de destino. */
export interface Ancora {
  /** Vai no nó que o leitor de tela deve passar a ler — na revista, a faixa do caderno. */
  readonly ref: (no: NoDaAncora | null) => void;
  /**
   * Vai no container do destino — e ele tem que ser **filho direto do rolável**.
   *
   * **Esta é a invariante frágil do hook.** `onLayout` entrega `layout.y`, que é a
   * posição dentro do **pai imediato**, e `scrollTo` quer o deslocamento dentro do
   * conteúdo: os dois só coincidem enquanto quem recebe este `onLayout` for filho
   * direto do `contentContainer`. Embrulhar os destinos numa `View` intermediária,
   * ou descer o `onLayout` para dentro do card, faz **todo** destino virar a mesma
   * posição — e o sintoma é mudo: nada lança, nada avisa, a suíte fica verde e
   * cada linha do sumário passa a rolar para o mesmo lugar.
   */
  readonly onLayout: (e: LayoutChangeEvent) => void;
}

/**
 * O registro das âncoras — **sem React**, e por isso testável inteiro.
 *
 * Mora fora do hook porque as duas promessas que importam são dele: o par
 * `{ ref, onLayout }` é **o mesmo objeto** a cada chamada com o mesmo id (senão o
 * ref-callback seria desmontado e remontado a cada quadro, e o nó do foco sumiria
 * no meio de um render), e `destinoDe` responde `null` enquanto a medida não
 * chegou.
 */
export interface RegistroDeAncoras<Id extends string> {
  /** A âncora daquele id — estável por id, criada na primeira chamada. */
  para(id: Id): Ancora;
  /** Onde a rolagem para, ou `null` quando ainda não há medida. */
  destinoDe(id: Id): number | null;
  /** O nó que recebe o foco, ou `null` quando ele não está montado. */
  noDe(id: Id): NoDaAncora | null;
}

/**
 * Onde a rolagem para — **a decisão pura**.
 *
 * `undefined` é "o `onLayout` ainda não chegou", e a resposta é `null`: quem
 * chama não faz nada. Um `y` negativo (que o RN não produz, mas o tipo permite) é
 * grampeado em zero, porque rolar para trás do início não é destino nenhum.
 *
 * **Não há margem de topo**, e isso é do desenho, não esquecimento: o mockup
 * aprovado fixa `scroll-margin-top: 0` no caderno — a faixa sangrada encosta no
 * topo da janela, e é ela que diz em qual caderno o leitor caiu.
 *
 * **"Encosta no topo" é a intenção, não uma garantia.** O rolável grampeia no fim
 * do conteúdo: quando o que vem depois do destino é menor que a janela — o último
 * caderno, tipicamente —, a rolagem para antes e a faixa fica abaixo do topo. O
 * número daqui continua certo; quem decide o resto é o `ScrollView`, e é por isso
 * que o foco importa: ele diz onde o leitor caiu mesmo quando o olho não vê a
 * faixa no alto.
 */
export function destinoDaRolagem(topo: number | undefined): number | null {
  if (topo === undefined || !Number.isFinite(topo)) return null;
  return Math.max(0, topo);
}

export function criarAncoras<Id extends string>(): RegistroDeAncoras<Id> {
  const ancoras = new Map<Id, Ancora>();
  const topos = new Map<Id, number>();
  const nos = new Map<Id, NoDaAncora>();

  return {
    para(id) {
      const ja = ancoras.get(id);
      if (ja) return ja;
      const nova: Ancora = {
        ref: (no) => {
          if (no) nos.set(id, no);
          else nos.delete(id);
        },
        onLayout: (e) => {
          topos.set(id, e.nativeEvent.layout.y);
        },
      };
      ancoras.set(id, nova);
      return nova;
    },
    destinoDe: (id) => destinoDaRolagem(topos.get(id)),
    noDe: (id) => nos.get(id) ?? null,
  };
}

/**
 * Os ajustes do sistema que mudam o ato. Lidos do `AccessibilityInfo`, nunca
 * adivinhados.
 */
export interface AjustesDoSistema {
  /** "Reduzir Movimento" ligado. */
  readonly reduzirMovimento: boolean;
  /** Um leitor de tela ligado (VoiceOver, TalkBack). */
  readonly leitorDeTela: boolean;
}

/** Por que a rolagem não anima. `null` é "anima". */
export type SemAnimacaoPor = 'reduzir-movimento' | 'leitor-de-tela';

/** O que um toque na âncora manda fazer — ou `null`, e não se faz nada. */
export interface AtoDaRolagem {
  /** O deslocamento do rolável. */
  readonly y: number;
  /** Anima, ou salta? */
  readonly animada: boolean;
  /**
   * **Qual dos dois motivos** tirou a animação, ou `null` quando ela fica.
   *
   * Os dois produzem o mesmo ato, então isto não muda comportamento nenhum — ele
   * existe para que o motivo seja **dizível**: sem ele, o teste que prova "o
   * leitor de tela também salta" é indistinguível do que prova "Reduzir Movimento
   * salta", e apagar um dos dois no código deixaria o outro verde.
   */
  readonly semAnimacaoPor: SemAnimacaoPor | null;
  /** O nó que passa a ser lido, ou `null` quando ele não está montado. */
  readonly foco: NoDaAncora | null;
}

/**
 * **O ato inteiro, decidido de uma vez** — a composição das três respostas que um
 * toque na âncora produz: para onde, como, e quem passa a ser lido.
 *
 * Ela mora aqui e não dentro de `irPara` porque é onde a regra está, e regra
 * dentro de um `useCallback` não tem teste: ninguém provaria que `animada` segue
 * Reduzir Movimento, nem que o foco sai junto da rolagem. O que fica no hook é só
 * a cola — `scrollTo` e `sendAccessibilityEvent`, as duas APIs de plataforma.
 *
 * Quatro decisões que a forma do retorno carrega:
 *
 * - **`null` é "nada acontece"**, e é um `null` só para os dois: sem medida, nem
 *   a rolagem nem o foco saem. Devolver um ato com `y` zero mandaria o leitor para
 *   a capa; devolver só o foco deixaria os dois em lugares diferentes.
 * - **`animada` é derivada dos ajustes**, não uma leitura deles: quem chama não
 *   precisa lembrar de negar nem de juntar os dois motivos.
 * - **Reduzir Movimento tem precedência sobre o leitor de tela** quando os dois
 *   estão ligados. O ato é o mesmo — só o motivo dito muda —, e a ordem é essa
 *   porque um é um pedido explícito sobre movimento e o outro é uma consequência
 *   nossa.
 * - **`foco` nulo não cancela o ato.** A rolagem não depende do nó — a âncora
 *   medida cujo cabeçalho ainda não montou (ou desmontou) continua rolando, e o
 *   leitor de tela simplesmente não é movido. O contrário — segurar a rolagem
 *   esperando o nó — travaria a única navegação da revista por causa de um
 *   detalhe que só existe com leitor de tela ligado.
 */
export function atoDaRolagem(
  destino: number | null,
  ajustes: AjustesDoSistema,
  no: NoDaAncora | null,
): AtoDaRolagem | null {
  if (destino === null) return null;
  const semAnimacaoPor: SemAnimacaoPor | null = ajustes.reduzirMovimento
    ? 'reduzir-movimento'
    : ajustes.leitorDeTela ? 'leitor-de-tela' : null;
  return { y: destino, animada: semAnimacaoPor === null, semAnimacaoPor, foco: no };
}

/** As duas portas de plataforma que um ato aciona. */
export interface PortasDaRolagem {
  readonly rolar: (y: number, animada: boolean) => void;
  readonly focar: (no: NoDaAncora) => void;
}

/**
 * O ato, executado — **a ordem e as condições**, separadas das APIs que as
 * cumprem.
 *
 * Ela existe porque a cola é justamente onde o erro não dói: apagar o `focar` ou
 * cravar `animada` em `true` dentro de um `useCallback` deixa a suíte inteira
 * verde, e a barreira nova não pega — ela mede **ausência de nome**, não presença
 * de comportamento. Com as portas injetadas, as duas coisas são mensuráveis com
 * funções espiãs, sem renderizador e sem dependência nova.
 *
 * **Rola antes de focar**: o foco sobre um nó que ainda não se moveu é o que o
 * iOS depois corrige sozinho, e é essa correção que briga com a animação.
 */
export function executarAto(ato: AtoDaRolagem | null, portas: PortasDaRolagem): void {
  if (ato === null) return;
  portas.rolar(ato.y, ato.animada);
  if (ato.foco) portas.focar(ato.foco);
}

export interface RolagemAncorada<Id extends string> {
  /** Vai no `ScrollView` que contém as âncoras. */
  readonly scrollRef: React.RefObject<React.ComponentRef<typeof ScrollView> | null>;
  /** O par `{ ref, onLayout }` daquele id — estável por id. */
  readonly ancora: (id: Id) => Ancora;
  /** Rola até a âncora e leva o foco do leitor de tela junto. Sem medida, não faz nada. */
  readonly irPara: (id: Id) => void;
}

export function useRolagemAncorada<Id extends string>(): RolagemAncorada<Id> {
  // `ComponentRef<typeof ScrollView>` em vez do genérico direto com o nome do
  // componente: a barreira da barra de rolagem lê esse genérico (e até um
  // comentário com ele) como abertura de tag, e cobraria aqui uma prop que só
  // faz sentido no JSX de quem usa. Mesma convenção do `TodayBodyCard`.
  const scrollRef = useRef<React.ComponentRef<typeof ScrollView> | null>(null);

  const registro = useRef<RegistroDeAncoras<Id> | null>(null);
  registro.current ??= criarAncoras<Id>();
  const ancoras = registro.current;

  /**
   * Os dois ajustes vivem num **ref, e não em estado, porque nada na tela depende
   * deles**: eles entram só no instante do toque. Em estado, cada vez que o dono
   * ligasse ou desligasse o VoiceOver a `Revista` inteira re-renderizaria por um
   * valor que nenhum pixel desenha.
   *
   * **O selo `respondeu` é o que impede a corrida**, e a guarda de montagem
   * sozinha não impedia: ela só vira falsa no desmonte, então um
   * `reduceMotionChanged` que chegasse **antes** de a promessa inicial resolver
   * seria sobrescrito por ela — o app passaria a animar contra um ajuste que o
   * dono acabou de ligar. Com o selo, a leitura inicial só escreve enquanto o
   * sistema não falou por outro caminho; evento sempre escreve, porque ele é
   * sempre a notícia mais nova.
   */
  const ajustes = useRef<AjustesDoSistema>({ reduzirMovimento: false, leitorDeTela: false });
  useEffect(() => {
    let vivo = true;
    const respondeu: Record<keyof AjustesDoSistema, boolean> =
      { reduzirMovimento: false, leitorDeTela: false };
    const anotar = (qual: keyof AjustesDoSistema, valor: boolean, doEvento: boolean): void => {
      if (!vivo) return;
      if (!doEvento && respondeu[qual]) return;
      respondeu[qual] = true;
      ajustes.current = { ...ajustes.current, [qual]: valor };
    };

    void AccessibilityInfo.isReduceMotionEnabled().then((v) => anotar('reduzirMovimento', v, false));
    void AccessibilityInfo.isScreenReaderEnabled().then((v) => anotar('leitorDeTela', v, false));
    const subMovimento = AccessibilityInfo.addEventListener(
      'reduceMotionChanged', (v) => anotar('reduzirMovimento', v, true),
    );
    const subLeitor = AccessibilityInfo.addEventListener(
      'screenReaderChanged', (v) => anotar('leitorDeTela', v, true),
    );
    return () => {
      vivo = false;
      subMovimento.remove();
      subLeitor.remove();
    };
  }, []);

  const ancora = useCallback((id: Id) => ancoras.para(id), [ancoras]);

  // A cola, e só ela: quem decide é `atoDaRolagem` e quem ordena é `executarAto`,
  // as duas testadas. O que sobra aqui são as duas APIs de plataforma.
  const irPara = useCallback((id: Id) => {
    executarAto(
      atoDaRolagem(ancoras.destinoDe(id), ajustes.current, ancoras.noDe(id)),
      {
        rolar: (y, animada) => scrollRef.current?.scrollTo({ y, animated: animada }),
        focar: (no) => AccessibilityInfo.sendAccessibilityEvent(no, 'focus'),
      },
    );
  }, [ancoras]);

  return { scrollRef, ancora, irPara };
}
