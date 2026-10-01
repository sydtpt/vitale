/**
 * A página da lua e a linha de entrada dela, **fora do React** — o estado da
 * leitura, a composição da entrada, os campos da moldura e a geometria da figura
 * (Story 4.4).
 *
 * `useVereditoLunar` lê o banco e desenha; tudo o que ele *decide* mora aqui, e pelo
 * mesmo motivo medido do anuário (`lib/anuario.ts`) e da parede (`lib/parede.ts`):
 * enquanto as transições moravam dentro do hook, **nada as executava**. Medido neste
 * repositório: apagar a guarda de carga **e** trocar `vereditoValePara` por
 * `return true` deixou o `tsc` em 0 e **85 suítes verdes** — e com as duas fora, a
 * resposta da leitura do dono anterior sobrescreve a em voo, e o primeiro quadro
 * depois de trocar de conta desenha o veredito de outra pessoa.
 *
 * A mesma coisa vale para a composição da entrada. Trocar
 *
 *     frase: fraseColetivaDe(execucao.veredito)
 *
 * por `fraseColetivaDe(null)` passava em **85 suítes**, e a linha do pé do caderno
 * Sono imprimia *"não foi lida"* para sempre, inclusive depois da primeira execução:
 * a barreira de texto cobra a **presença da chamada**, nunca o **valor**. Com a
 * composição aqui, o teste compara palavra por palavra com `fraseColetivaDe` — e aí
 * o valor errado reprova.
 *
 * ## Os cinco estados, e por que não são três
 *
 * `carregando` · `pronto` · `sem-sessao` · falha de `rede` · falha de `integridade`.
 *
 * - **`carregando` não é "ainda não rodou".** Desenhar os dois iguais faria a página
 *   afirmar silêncio antes de saber, em toda abertura.
 * - **`pronto` com `execucao: null` É o quarto estado** — tabela **vazia**, nenhuma
 *   execução gravada. Ele produz entrada: é a afirmação mais importante da feature
 *   antes da primeira janela.
 * - **Tabela ausente não é tabela vazia.** Hoje a migração não foi aplicada, então as
 *   duas leituras **lançam** e o estado real é a falha — não o quarto. Enquanto a
 *   linha desenhava só no `pronto`, o pé do caderno ficava vazio e `/sono/lua` ficava
 *   **inalcançável**, porque a única porta da página mora nessa linha. Por isso a
 *   falha **também** produz entrada.
 * - **Sem sessão não é falha de leitura.** Para um visitante deslogado, *"não
 *   conseguiu ler a tabela"* é afirmação falsa sobre a tabela — e este é o arquivo
 *   cuja tese é que *não deu para ler* e *nunca rodou* são coisas diferentes.
 * - **Integridade não é rede.** A primeira pede tentar de novo; a segunda pede
 *   consertar dado, e nunca melhora tentando. A mensagem de `toLuaExecucao` diz
 *   exatamente o que consertar, e ela morria num `console.warn`.
 */
import {
  CADENCIA_DE_REEXECUCAO_NOITES,
  CICLOS_MINIMOS,
  INICIO_DO_ACERVO_LUNAR,
  JANELA_LUNAR_NOITES,
  MESES_ABREV,
  NOITES_MINIMAS_POR_COLUNA,
  PHASE_ORDER,
  ROTULO_CURTO_DA_FASE,
  APOIO_SEM_LEITURA,
  fraseColetivaDe,
  fraseDaFalha,
  operacionalizacaoLunar,
  ordinalDaExecucao,
  type CausaDaFalhaLunar,
  type ExecucaoLunar,
  type FraseColetiva,
  type LunarPhaseKind,
  type ResultadoDaFase,
} from '@vitale/shared';

/* ──────────────── A vista: o que a tela recebe ──────────────── */

/** O que a tela recebe — cinco estados, e só um deles desenha veredito. */
export type VereditoLunarNaTela =
  /** A leitura está em voo. A página desenha a moldura e cala sobre o veredito. */
  | { readonly estado: 'carregando' }
  /**
   * O banco respondeu. `execucao` nulo é o **quarto estado** — tabela vazia,
   * nenhuma execução gravada —, e não é falha de leitura.
   */
  | {
      readonly estado: 'pronto';
      readonly execucao: ExecucaoLunar | null;
      /** O contador da §7.4. Zero é resposta: "nenhuma execução". */
      readonly execucoes: number;
    }
  /** Não há a quem perguntar. A pilha de execuções não é de ninguém. */
  | { readonly estado: 'sem-sessao' }
  /**
   * A leitura não respondeu, ou respondeu e foi recusada. A página **desenha** e
   * diz qual das duas, e `recado` carrega a mensagem acionável quando há uma.
   */
  | {
      readonly estado: 'falhou';
      readonly causa: CausaDaFalhaLunar;
      readonly recado: string | null;
    };

const CARREGANDO: VereditoLunarNaTela = { estado: 'carregando' };
const SEM_SESSAO: VereditoLunarNaTela = { estado: 'sem-sessao' };

/* ──────────────── O estado, fora do React ──────────────── */

/**
 * De quem é a leitura. A conta é a única chave: a execução mais recente não
 * depende de período, de rota nem de janela.
 *
 * `\u0000` como separador, pela mesma razão de `chaveDoAnuario`: um id de usuário
 * não o contém.
 */
export function chaveDoVeredito(uid: string | null | undefined): string {
  return `${uid ?? ''}\u0000lua`;
}

export type FaseDoVeredito =
  | { readonly fase: 'carregando' }
  | {
      readonly fase: 'pronto';
      readonly execucao: ExecucaoLunar | null;
      readonly execucoes: number;
    }
  | { readonly fase: 'sem-sessao' }
  | {
      readonly fase: 'falhou';
      readonly causa: CausaDaFalhaLunar;
      readonly recado: string | null;
    };

export type EstadoDoVeredito = FaseDoVeredito & {
  /** A carga que produziu este estado — a resposta de uma leitura superada é ignorada. */
  readonly carga: number;
  /** De quem é este estado. Ver {@link chaveDoVeredito}. */
  readonly chave: string;
};

export type AcaoDoVeredito =
  | { readonly tipo: 'ler'; readonly carga: number; readonly chave: string }
  | {
      readonly tipo: 'execucao';
      readonly carga: number;
      readonly execucao: ExecucaoLunar | null;
      readonly execucoes: number;
    }
  | { readonly tipo: 'sem-sessao'; readonly carga: number }
  | {
      readonly tipo: 'falhou';
      readonly carga: number;
      readonly causa: CausaDaFalhaLunar;
      readonly recado: string | null;
    };

export function vereditoInicial(): EstadoDoVeredito {
  return { fase: 'carregando', carga: 0, chave: chaveDoVeredito(null) };
}

/**
 * A transição — pura, e por isso executável sem renderizador.
 *
 * `ler` volta sempre para `carregando`: uma leitura nova só acontece quando a
 * conta troca, e a execução do dono anterior não descreve esta tela.
 *
 * **Toda ação que não seja `ler` é ignorada quando vem de uma carga superada.** Sem
 * esta guarda a resposta da conta anterior chega depois e sobrescreve a em voo.
 */
export function proximoVeredito(
  atual: EstadoDoVeredito,
  acao: AcaoDoVeredito,
): EstadoDoVeredito {
  if (acao.tipo === 'ler') return { fase: 'carregando', carga: acao.carga, chave: acao.chave };
  if (acao.carga !== atual.carga) return atual;
  const { carga, chave } = atual;
  switch (acao.tipo) {
    case 'execucao':
      return { fase: 'pronto', execucao: acao.execucao, execucoes: acao.execucoes, carga, chave };
    case 'sem-sessao':
      return { fase: 'sem-sessao', carga, chave };
    default:
      return { fase: 'falhou', causa: acao.causa, recado: acao.recado, carga, chave };
  }
}

/**
 * O estado **vale para esta chave**? — a guarda que mata o quadro de atraso.
 *
 * O efeito que dispara a releitura roda **depois** do render: na troca de conta, o
 * primeiro quadro ainda tem o estado da leitura anterior, e desenhá-lo é mostrar o
 * veredito de outra pessoa. Mora aqui, e não no hook, porque é a única regra do
 * conjunto que nenhuma transição produz — e por isso seria a única sem teste.
 */
export function vereditoValePara(estado: EstadoDoVeredito, chave: string): boolean {
  return estado.chave === chave;
}

/** O estado traduzido para o que a tela lê — a leitura superada sai como `carregando`. */
export function vistaDoVeredito(estado: EstadoDoVeredito, chave: string): VereditoLunarNaTela {
  if (!vereditoValePara(estado, chave) || estado.fase === 'carregando') return CARREGANDO;
  switch (estado.fase) {
    case 'sem-sessao':
      return SEM_SESSAO;
    case 'falhou':
      return { estado: 'falhou', causa: estado.causa, recado: estado.recado };
    default:
      return { estado: 'pronto', execucao: estado.execucao, execucoes: estado.execucoes };
  }
}

/* ──────────────── A causa da falha, e o recado dela ──────────────── */

/**
 * O prefixo com que o núcleo marca **as recusas dele** sobre esta tabela.
 *
 * `toLuaExecucao` e `contarExecucoesLunares` lançam `Error` com mensagem começando
 * por `lua_execucoes:` — execução truncada, assinatura discordante entre as quatro
 * linhas, digest de cadeia que não bate, contagem nula. O PostgREST, por outro lado,
 * devolve um objeto `{ message, details, hint, code }` que o `fetch` relança: ele não
 * carrega este prefixo, e em geral nem é um `Error`.
 */
const PREFIXO_DA_RECUSA = 'lua_execucoes:';

/**
 * Classifica o que a leitura lançou: **rede ou integridade**, com o recado.
 *
 * Integridade é a resposta que **chegou** e foi recusada na tradução; o recado é a
 * mensagem do núcleo, que diz o que consertar, e ele vai para a tela em vez de morrer
 * num `console.warn`. Rede é tudo o mais — incluindo o caso de hoje, em que a tabela
 * não existe porque a migração não foi aplicada —, e aí não há recado acionável: a
 * mensagem do PostgREST não descreve nada que o leitor possa fazer.
 */
export function falhaDaLeitura(e: unknown): {
  causa: CausaDaFalhaLunar;
  recado: string | null;
} {
  if (e instanceof Error && e.message.startsWith(PREFIXO_DA_RECUSA)) {
    return { causa: 'integridade', recado: e.message };
  }
  return { causa: 'rede', recado: null };
}

/* ──────────────── A entrada no pé do caderno Sono ──────────────── */

/**
 * A linha de entrada da lua, **já composta pela rota**.
 *
 * `frase` é o que a regra do núcleo produziu, e `periodo` é o que o cabeçalho da
 * sub-página imprime à direita — o período de onde o leitor saiu.
 */
export interface EntradaDaLua {
  readonly frase: FraseColetiva;
  readonly periodo: string;
}

/**
 * A entrada da lua a partir do estado da leitura — **a função que a barreira de
 * texto não conseguia cobrar**.
 *
 * Quem produz entrada:
 *
 * - **`pronto`**, inclusive com `execucao: null` — o quarto estado é o que a página
 *   tem hoje, e ele é a afirmação da ADR 0045 antes da primeira janela;
 * - **`falhou`**, nas duas causas — sem isso a feature é invisível em produção até a
 *   migração, porque a única porta de `/sono/lua` é esta linha.
 *
 * Quem **não** produz:
 *
 * - **`carregando`** — desenhar aqui faria o pé do caderno afirmar *"A cheia não foi
 *   lida"* antes de saber, em toda abertura da edição;
 * - **`sem-sessao`** — não há pilha de execuções de ninguém, e a edição deslogada não
 *   tem caderno onde pôr a linha.
 */
export function entradaDaLua(
  veredito: VereditoLunarNaTela,
  periodo: string,
): EntradaDaLua | undefined {
  switch (veredito.estado) {
    case 'pronto':
      return {
        frase: fraseColetivaDe(veredito.execucao === null ? null : veredito.execucao.veredito),
        periodo,
      };
    case 'falhou':
      return { frase: fraseDaFalha(veredito.causa), periodo };
    default:
      return undefined;
  }
}

/**
 * A linha de apoio de um bloco **sem resultado**, por estado.
 *
 * Ela não é uma só: *"a primeira execução autorizada ainda não rodou"* é verdade no
 * quarto estado e **falsa** enquanto a leitura está em voo ou depois de ela falhar —
 * e a moldura desenha nos cinco estados, então a frase do bloco tem de acompanhar.
 */
export function apoioSemResultado(veredito: VereditoLunarNaTela): string {
  switch (veredito.estado) {
    case 'carregando':
      return 'A leitura das execuções está em curso.';
    case 'sem-sessao':
      return 'Sem sessão não há pilha de execuções para ler.';
    case 'falhou':
      return 'Não foi possível ler as execuções agora. Isto não diz que nenhuma rodou.';
    default:
      return APOIO_SEM_LEITURA;
  }
}

/* ──────────────── A moldura: os cinco campos ──────────────── */

/** Um campo da moldura: rótulo, valor e o sub-valor que o explica. */
export interface CampoDaMoldura {
  readonly rotulo: string;
  readonly valor: string;
  readonly sub?: string;
}

/**
 * Os cinco campos, **sempre os cinco e sempre nesta ordem**.
 *
 * Eles valem para as quatro fases — nenhum muda de fase para fase —, e é por isso
 * que a moldura é uma só, acima dos blocos, em vez de se repetir quatro vezes.
 *
 * **Sem execução nenhum número é fabricado.** *Noites e ciclos* não pode imprimir uma
 * contagem que ninguém mediu, então imprime o que o protocolo fixa: o começo do
 * acervo e os dois portões que contam. E *Próxima leitura* vira *Primeira leitura* e
 * imprime a **condição**, não uma data: a cadência de +100 noites governa a
 * **re**execução, documento nenhum fixa a primeira.
 *
 * A guarda é `execucao === null`, e só ela: `veredito` e `acervo` **não são
 * nuláveis** em `ExecucaoLunar`, e as guardas que os testavam eram teatro — ou os
 * tipos estariam errados, e aí o conserto seria nos tipos.
 */
export function camposDaMoldura(
  execucao: ExecucaoLunar | null,
  execucoes: number,
): readonly CampoDaMoldura[] {
  // A operacionalização da execução quando há uma; a vigente quando não há. Nos
  // dois casos ela é **medida**, nunca declarada — a borda sai da sonda.
  const op = execucao?.operacionalizacao ?? operacionalizacaoLunar();
  const fecha = op.bordaDireita === 'aberta' ? ')' : ']';
  const noites = String(op.janelaNoites);
  return [
    {
      rotulo: 'Janela testada',
      valor: `${noites} noites antes de cada fase`,
      sub: `[fase − ${noites} d, fase${fecha} · contra as demais noites`,
    },
    { rotulo: 'Desfecho', valor: 'hora de apagar', sub: 'minutos desde a meia-noite' },
    execucao === null
      ? {
        rotulo: 'Noites e ciclos',
        valor: `o acervo desde ${dataCurta(INICIO_DO_ACERVO_LUNAR)}`,
        sub:
            `a execução conta as noites e os ciclos · os portões pedem ${String(NOITES_MINIMAS_POR_COLUNA)} `
            + `noites em cada coluna e ${String(CICLOS_MINIMOS)} ciclos sinódicos`,
      }
      : {
        rotulo: 'Noites e ciclos',
        valor: `${String(execucao.veredito.acervo.noites)} noites no acervo`,
        sub:
            `${ciclosPorFase(execucao.veredito.fases)} · ${dataCurta(execucao.veredito.acervo.de)} `
            + `→ ${dataCurta(execucao.veredito.acervo.ate)}`,
      },
    execucao === null
      ? {
        rotulo: 'Primeira leitura',
        valor: 'quando a primeira execução autorizada rodar',
        sub: 'as quatro rodam juntas, ou nenhuma roda',
      }
      : {
        rotulo: 'Próxima leitura',
        valor: `a cada +${String(CADENCIA_DE_REEXECUCAO_NOITES)} noites`,
        sub: 'por cadência pré-fixada, não por vontade',
      },
    { rotulo: 'Execuções', valor: ordinalDaExecucao(execucoes) },
  ];
}

/**
 * `'2025-04-23'` → `23 abr 2025`. Sem `Date`: o fuso do aparelho não entra num rótulo.
 *
 * O `- 1` do índice do mês é a única aritmética daqui, e perdê-lo imprime *"23 mai
 * 2025"* para abril **sem mudar nada de cor** — é por isso que ela é exportada e
 * testada por valor, em vez de ficar escondida num `toContain` sobre texto-fonte.
 */
export function dataCurta(iso: string | null): string {
  if (iso === null) return '—';
  const [a, m, d] = iso.split('-');
  const mes = MESES_ABREV[Number(m) - 1];
  return mes === undefined ? iso : `${d} ${mes} ${a}`;
}

/**
 * Os ciclos que contribuíram, **por fase** — e o intervalo quando elas discordam.
 *
 * As quatro janelas não pegam o mesmo número de ciclos, então um número só seria
 * uma média disfarçada de contagem. Quando as quatro concordam, o número é um.
 */
export function ciclosPorFase(fases: readonly ResultadoDaFase[]): string {
  const todos = fases.map((f) => f.ciclos);
  const min = Math.min(...todos);
  const max = Math.max(...todos);
  const n = min === max ? String(min) : `${String(min)} a ${String(max)}`;
  return `${n} ciclos sinódicos por fase`;
}

/* ──────────────── A figura das quatro janelas ──────────────── */

/** Uma noite desenhada: onde ela cai, quanto dela está iluminado, e de que lado. */
export interface DiscoDaFigura {
  readonly x: number;
  readonly illuminated: number;
  readonly waxing: boolean;
  readonly naJanela: boolean;
}

/** Uma das quatro janelas: a banda de cinco noites, e o instante que fica fora dela. */
export interface JanelaDaFigura {
  readonly fase: LunarPhaseKind;
  /** O instante da fase, que cai **fora** da janela: a exposição é *antes* dela. */
  readonly x: number;
  readonly de: number;
  readonly largura: number;
  readonly rotulo: string;
}

/** Trinta células desenhadas para um ciclo de 29,53 dias. */
const CELULAS = 30;
const CICLO_DESENHADO_DIAS = 29.53;
/** A lua nova no índice 5,5 — é a âncora em que as quatro janelas caem inteiras no quadro. */
const NOVA_EM = 5.5;
/** A geometria do quadro, em unidades do `viewBox`. */
const LARGURA = 342;
const ALTURA = 86;
const PASSO = LARGURA / CELULAS;
const RAIO = 4.6;
const Y_DISCO = 30;

/** O centro, em `x`, da posição `p` medida em células. */
function xDe(p: number): number {
  return PASSO * (p + 0.5);
}

/**
 * A posição, em células, do instante de cada fase — **a lunação, não a importância**.
 *
 * Congelada, e percorrida por `PHASE_ORDER` em vez de `Object.keys`: a ordem das
 * chaves de um literal é a ordem em que alguém as digitou, e é `PHASE_ORDER` que
 * define a ordem do protocolo em todo o resto do app.
 */
const POSICAO_DA_FASE: Readonly<Record<LunarPhaseKind, number>> = Object.freeze({
  new: NOVA_EM,
  firstQuarter: NOVA_EM + CICLO_DESENHADO_DIAS / 4,
  full: NOVA_EM + CICLO_DESENHADO_DIAS / 2,
  lastQuarter: NOVA_EM + (3 * CICLO_DESENHADO_DIAS) / 4,
});

const JANELAS: readonly JanelaDaFigura[] = Object.freeze(
  PHASE_ORDER.map((fase) => {
    const p = POSICAO_DA_FASE[fase];
    return Object.freeze({
      fase,
      x: xDe(p),
      de: xDe(p - JANELA_LUNAR_NOITES),
      largura: JANELA_LUNAR_NOITES * PASSO,
      rotulo: ROTULO_CURTO_DA_FASE[fase],
    });
  }),
);

/**
 * Uma célula está dentro de alguma janela? **Dez das trinta não estão**, o que bate
 * com as ~9,5 noites por ciclo que ficam fora de todas.
 *
 * A janela é `[fase − 5 d, fase)`, e a conta é sobre o **centro** da célula. Nenhuma
 * posição de fase é inteira, então os extremos não empatam — e cada janela marca
 * exatamente cinco discos, que é a propriedade que o desenho tem de preservar: *os
 * discos marcados **são** as noites testadas*.
 */
function dentroDeJanela(i: number): boolean {
  return PHASE_ORDER.some((fase) => {
    const p = POSICAO_DA_FASE[fase];
    return i > p - JANELA_LUNAR_NOITES && i < p;
  });
}

const DISCOS: readonly DiscoDaFigura[] = Object.freeze(
  Array.from({ length: CELULAS }, (_, i): DiscoDaFigura => {
    const d = i - NOVA_EM;
    const ciclo = ((d % CICLO_DESENHADO_DIAS) + CICLO_DESENHADO_DIAS) % CICLO_DESENHADO_DIAS;
    return Object.freeze({
      x: xDe(i),
      illuminated: (1 - Math.cos((2 * Math.PI * d) / CICLO_DESENHADO_DIAS)) / 2,
      waxing: ciclo < CICLO_DESENHADO_DIAS / 2,
      naJanela: dentroDeJanela(i),
    });
  }),
);

/**
 * A figura inteira como **dado puro** — e é por isso que ela mora aqui.
 *
 * Dentro da tela ela só era alcançável por `toContain` sobre texto-fonte: dava para
 * perder o `− JANELA_LUNAR_NOITES` da banda, ou trocar o `<` por `<=` no corte, e
 * nenhuma asserção reparava. Aqui o teste cobra o **valor**: cada janela marca cinco
 * discos, vinte dos trinta caem dentro, e `janelaNoites` é o do protocolo e não um
 * cinco digitado ao lado dele.
 */
export const FIGURA_DA_LUA = Object.freeze({
  celulas: CELULAS,
  cicloDias: CICLO_DESENHADO_DIAS,
  largura: LARGURA,
  altura: ALTURA,
  raio: RAIO,
  yDisco: Y_DISCO,
  /** As cinco noites da janela saem do **protocolo**, não de um literal da tela. */
  janelaNoites: JANELA_LUNAR_NOITES,
  janelas: JANELAS,
  discos: DISCOS,
  /** Quantos discos caem dentro de alguma janela — a base dos 68%. */
  naJanela: DISCOS.filter((d) => d.naJanela).length,
});

/**
 * A medida dos 68%, **com a oração que reconcilia os três números**.
 *
 * Contar discos dá 20/30 = 67%; a medida em prosa diz 68% porque o ciclo é 29,53.
 * Sem a oração, a legenda entregava 30, 20 e 68% ao leitor e deixava com ele a
 * conta que explica por que dois deles não fecham.
 */
export const MEDIDA_DO_CICLO =
  `${String(FIGURA_DA_LUA.celulas)} noites desenhadas para um ciclo de `
  + `${String(FIGURA_DA_LUA.cicloDias).replace('.', ',')}: ${String(FIGURA_DA_LUA.naJanela)} delas `
  + 'caem dentro de uma janela. Contar discos dá '
  + `${String(FIGURA_DA_LUA.naJanela)}/${String(FIGURA_DA_LUA.celulas)} = `
  + `${porcentoDoCiclo(FIGURA_DA_LUA.naJanela / FIGURA_DA_LUA.celulas)}%; sobre o ciclo real são `
  + `${porcentoDoCiclo(FIGURA_DA_LUA.naJanela / FIGURA_DA_LUA.cicloDias)}% — `
  + `${String(FIGURA_DA_LUA.naJanela)} / ${String(FIGURA_DA_LUA.cicloDias).replace('.', ',')}.`;

function porcentoDoCiclo(fracao: number): string {
  return String(Math.round(fracao * 100));
}
