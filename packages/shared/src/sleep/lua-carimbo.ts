/**
 * O carimbo de uma execução lunar: **quais documentos a autorizaram** e **com que
 * operacionalização ela rodou**.
 *
 * As duas coisas moram juntas porque são a mesma coisa vista de dois lados — a §7
 * de 07/09 inteira, que é *mecânica anti-gaveta* e não armazenamento. O que ela
 * pede não é impedir o dono de rodar o teste de novo: é tornar cada tentativa
 * permanente e contável, e **dizer em voz alta** quando a regra muda.
 *
 * ## Por que vizinho de `lua-protocolo.ts`, e não dentro dele
 *
 * `lua-protocolo.test.ts` tem uma guarda que pina a **superfície pública** daquele
 * arquivo, nome por nome, para que ninguém abra uma porta que calcule uma fase
 * sozinha (§9 de 28/09). Essa lista é invariante, e alargá-la para caber um par de
 * constantes de proveniência a enfraquece: cada nome novo ali é um nome que a
 * próxima pessoa tem de julgar. A cadeia e a operacionalização não calculam nada do
 * teste — elas dizem **sob que autoridade** ele rodou —, então moram ao lado.
 *
 * ## Quem quebra o build, e por que não é este arquivo nem o teste dele
 *
 * A barreira canônica mora em `architecture.test.ts` (story 4.3), e as sha256
 * esperadas são **literais dela** — nunca lidas de {@link CADEIA_DO_PRE_REGISTRO}.
 * A razão é o furo que a 4.3 fechou: enquanto a cobrança vivia em
 * `lua-carimbo.test.ts`, ela iterava esta constante e comparava com o disco, então
 * **editar o documento e a constante no mesmo commit passava** — uma barreira que
 * confere a constante que guarda contra si mesma não guarda nada.
 *
 * Continua incondicional (Correção 2 de 08/09): um byte a mais em qualquer um dos
 * quatro documentos reprova a suíte, tenha havido execução ou não. O que mudou é
 * **onde** a asserção vive e **de onde** sai o valor esperado.
 *
 * A barreira de lá pina também os **seis** fontes deste canto — `lua.ts`,
 * `astro/moon.ts`, `lua-protocolo.ts`, `sleep/timing.ts`, `health/trends.ts` e
 * **este arquivo**, porque ele contém a lista que ela guarda — com
 * {@link JANELA_LUNAR_VERSAO} e {@link MOTOR_LUNAR_VERSAO} ao lado. Com isso a
 * dívida que o §10 de 28/09 nomeia deixa de ser só *carimbada*: a régua passa a ser
 * impedida também. Ver {@link OperacionalizacaoLunar}.
 *
 * **Os três importados entraram depois, e a falta deles não era teórica.** Até 30/09
 * a lista tinha só os três arquivos daqui: mutar `axisPosition` (`sleep/timing.ts`)
 * em meia hora — o que muda o desfecho de toda noite — deixava a suíte em exit 0
 * imprimindo *"régua v1 · motor v1"*. Duas execuções carimbadas `v1` podiam ter saído
 * de réguas diferentes, que é o oposto do que estas duas constantes existem para
 * garantir. A barreira passou a exigir que o **fecho transitivo de imports** destes
 * três arquivos seja exatamente o conjunto pinado: import novo reprova até ter golden.
 *
 * E este arquivo não é o executor: quem compara antes de rodar é quem grava
 * (`data/lua-execucoes.ts`).
 *
 * ## Puro, e cobrado como tal
 *
 * Sem relógio do hospedeiro, sem fuso, sem ambiente e sem coordenada — a mesma
 * guarda de `lua.ts` e `lua-protocolo.ts` cobre este arquivo (`lua.test.ts`). A
 * razão é a sonda de {@link operacionalizacaoLunar}: ela **mede** a borda contra o
 * classificador, e uma sonda que lesse `new Date()` ou a hora local do aparelho
 * carimbaria em `borda_direita` um valor que depende de onde a execução rodou.
 */
import { PHASE_ORDER, nextLunarPhase } from '../astro/moon';
import {
  HORA_UTC_DO_FIM_DA_NOITE,
  JANELA_LUNAR_NOITES,
  janelaLunarDoInstante,
} from './lua';

/* ─────────────────────────── A cadeia ─────────────────────────── */

/** Um elo da cadeia: o caminho do documento, relativo à raiz, e a sha256 dele. */
export interface EloDaCadeia {
  arquivo: string;
  sha256: string;
}

/**
 * Os **quatro** documentos que autorizam o teste lunar, em ordem **append-only**.
 *
 * A ordem é a cronológica, e ela é parte do conteúdo: a leitura da cadeia é a
 * história de quantas vezes a regra mudou. Documento novo entra **no fim**; nenhum
 * sai, nenhum se edita — os três primeiros se declaram imutáveis, e o quarto
 * também.
 *
 * | # | Arquivo | Data | O que ele faz |
 * |---|---|---|---|
 * | 1 | `pre-registro-lua.md` | 07/09/2026 | a cheia sozinha: 5%, unilateral, no atraso |
 * | 2 | `correcao-pre-registro-lua.md` | 08/09/2026 | §7.2 vira `lua_execucoes`; §7.3 vira incondicional |
 * | 3 | `pre-registro-lua-outras-fases.md` | 28/09/2026 | as outras três: 5%/3, bilateral |
 * | 4 | `correcao-2-…-outras-fases.md` | 28/09/2026 | o §10 citava a §7 antes das correções |
 *
 * **Por que a lista, e não só o digest.** A pergunta que um leitor futuro faz é
 * *quais documentos autorizaram isto*, não *qual era o digest* — um digest que não
 * bate diz que algo mudou, e não o quê. Por isso a linha da execução carrega a lista
 * inteira, e {@link DIGEST_DA_CADEIA} é a forma curta ao lado dela.
 *
 * **Como se confere à mão:** `shasum -a 256 <arquivo>`, da raiz do repositório.
 */
export const CADEIA_DO_PRE_REGISTRO: readonly EloDaCadeia[] = Object.freeze([
  Object.freeze({
    arquivo: 'docs/specs/revista-retrospectiva/pre-registro-lua.md',
    sha256: 'd09365de54bb6bbd6fa8d99af9d1f26cddaebc3492029a63d6b1b6e4f6759664',
  }),
  Object.freeze({
    arquivo: 'docs/specs/revista-retrospectiva/correcao-pre-registro-lua.md',
    sha256: 'aad967aae5f9fddd563dfd5f97fd274d236f511fb20f5cdad2dfd45a7e46c308',
  }),
  Object.freeze({
    arquivo: 'docs/specs/revista-retrospectiva/pre-registro-lua-outras-fases.md',
    sha256: '1227264d01b5f0f35bf7bfcf90fb4241ac89fefef4b28dadfe399918a51251bc',
  }),
  Object.freeze({
    arquivo: 'docs/specs/revista-retrospectiva/correcao-2-pre-registro-lua-outras-fases.md',
    sha256: '95cf3e729e9c832a4865ffa10c8e526fd494a1cba67bc61d9d83b4d7524c5b52',
  }),
]);

/**
 * O **piso** da cadeia: quantos elos uma execução gravada tem de carregar.
 *
 * É o número que o CHECK de `lua_execucoes.cadeia` repete, e `architecture.test.ts`
 * confere que os dois são o mesmo. O tradutor de leitura usa este piso, e não a
 * lista vazia: o CHECK exige quatro, e uma leitura que aceitasse uma lista de um
 * elo aceitaria uma linha que o banco afirma não existir.
 *
 * **Ele não acompanha o crescimento da cadeia, de propósito.** Um quinto documento
 * faz `CADEIA_DO_PRE_REGISTRO` ter cinco elos, e as execuções já gravadas continuam
 * com quatro — usar `CADEIA_DO_PRE_REGISTRO.length` como piso as tornaria ilegíveis
 * no dia em que a regra mudasse, que é o dia em que mais se quer lê-las. O piso é a
 * forma mínima de uma cadeia válida; o comprimento de hoje é outra coisa.
 */
export const CADEIA_MINIMA = 4;

/**
 * O digest da cadeia: **sha256 das sha256**, na ordem, unidas por `\n`.
 *
 * O molde é o `hashDoGolden` de `ia/recursos.test.ts`, e a escolha de hashear os
 * hashes (e não os arquivos concatenados) tem a mesma razão de lá: o digest muda
 * quando **qualquer** elo muda, e a ordem faz parte do que ele afirma — trocar dois
 * documentos de lugar dá outro digest, porque a ordem da cadeia é a cronologia da
 * regra.
 *
 * **Literal, e não derivado no import.** A versão derivada rodava um SHA-256 em
 * JavaScript puro na **abertura de todo hospedeiro** que toca o barril — iPhone
 * incluído — para produzir um valor lido uma vez a cada cem noites, e arrastava
 * `ia/sha256.ts`, que se declara interno ao núcleo de IA, para o grafo de execução
 * de todo consumidor. O literal não é um segundo número a manter: a barreira de
 * `architecture.test.ts` refaz a conta **a partir das sha256 literais dela**, não
 * desta lista, e reprova se divergir — é o papel que o golden de
 * `ia/verificar.test.ts` faz para o texto do SISTEMA, com a diferença que a 4.3
 * pagou: um recálculo a partir da própria cadeia passaria com a cadeia editada.
 *
 * Fixado em 29/09/2026, com a cadeia em quatro elos (story 4.2b). Elo novo muda
 * este valor: é o ponto dele.
 */
export const DIGEST_DA_CADEIA = '644afc095eea98608d93287682ac5e6735e2a608edb2dd48a7de97533fe347e5';

/* ─────────────────── O motor, e o alcance que se pede a ele ─────────────────── */

/**
 * A versão da **aritmética** que produz o veredito.
 *
 * A operacionalização abaixo carimba *qual noite entra em qual coluna*. Nada
 * carimbava *com que conta o veredito saiu* — e trocar o Hodges–Lehmann pela
 * diferença de duas medianas, o Mann–Whitney por outro teste, ou a aproximação
 * normal do poder por uma exata muda efeito, p e poder sobre o **mesmo** acervo.
 * Fazer isso *depois de ver o resultado* é a gaveta pela porta dos fundos, e até
 * aqui não deixava rastro nenhum.
 *
 * **Como ela é presa.** `architecture.test.ts` guarda o sha256 do fonte de
 * `sleep/lua-protocolo.ts` — o motor inteiro: Hodges–Lehmann, Mann–Whitney, a
 * conta de poder e os portões — com esta versão ao lado. Mexer no arquivo sem subir
 * o número reprova a suíte. É o molde de `PROMPT_VERSAO` com o golden de
 * `ia/verificar.test.ts`, e vale a mesma regra: os dois sobem no mesmo commit.
 *
 * **E a aritmética não está toda naquele arquivo.** O desfecho medido sai de
 * `axisPosition` (`sleep/timing.ts`) e o `sd` de `stdDev` (`health/trends.ts`): os
 * dois têm golden próprio sob **esta** versão desde a story 4.3, porque mexer neles
 * move efeito e p sem tocar numa linha de `lua-protocolo.ts`.
 *
 * **`sleep/lua.ts` fica de fora deste golden, de propósito** — ele tem o seu, ao
 * lado de {@link JANELA_LUNAR_VERSAO}. Ver o docblock de lá: são duas versões, e não
 * uma, porque o motor e a régua não mudam pelo mesmo motivo.
 *
 * 1 — 29/09/2026, story 4.2b: o motor como a 4.2a o entregou.
 */
export const MOTOR_LUNAR_VERSAO = 1;

/**
 * A versão da **régua** — qual noite entra em qual coluna.
 *
 * Ela cobre `sleep/lua.ts`: `JANELA_LUNAR_NOITES`, `HORA_UTC_DO_FIM_DA_NOITE`, a
 * borda aberta à direita e a **lógica** que os usa. Os três valores já tinham coluna
 * própria em cada execução, mas a lógica podia mudar sem que nenhum deles mudasse —
 * e mudou duas vezes em setembro de 2026: o instante da noite foi do entardecer para
 * o fim dela, e a hora foi de 11:00 para 08:00 UTC. Sem esta versão, duas execuções
 * com a mesma janela, a mesma hora e a mesma borda seriam **indistinguíveis** mesmo
 * com a régua reescrita no meio.
 *
 * ## Por que duas versões, e não uma
 *
 * {@link MOTOR_LUNAR_VERSAO} cobre `lua-protocolo.ts` — a aritmética que produz
 * efeito, p e poder. Esta cobre `lua.ts` — a classificação. Juntá-las faria uma
 * mudança de janela subir a versão do motor, **dizendo a coisa errada**: o motor não
 * mudou, a régua mudou. É o que o golden da 4.2b já declarava quando deixou `lua.ts`
 * de fora; esta constante é o outro lado que faltava.
 *
 * ## Como ela é presa, e o limite honesto disso
 *
 * `architecture.test.ts` guarda o sha256 do fonte de `sleep/lua.ts` **e de
 * `astro/moon.ts`** com este número ao lado: mexer em qualquer um dos dois sem subir
 * a versão reprova a suíte. A efeméride entra aqui, e não no motor, porque o que ela
 * decide é *qual noite é qual* — `nextLunarPhase` dá o instante da fase, e é o
 * instante que põe a noite dentro ou fora da janela. O que o motor lhe pede é só
 * `PHASE_ORDER`, que é ordem de nomes e não aritmética. **Um hash não
 * distingue comentário de fórmula** — então quem mexeu só num comentário sobe o
 * golden e deixa a versão onde está, e **diz isso na mensagem do commit**, porque
 * ninguém consegue distinguir as duas coisas por um hash. É a mesma regra do golden
 * do motor, e é ela que torna o mecanismo honesto em vez de mágico.
 *
 * 1 — 30/09/2026, story 4.3: a régua como o 08:00 UTC do fim da noite a deixou.
 */
export const JANELA_LUNAR_VERSAO = 1;

/**
 * O primeiro `wakeDay` que o §3 admite no acervo: **23/04/2025**.
 *
 * Constante porque três testes já a redigitavam e porque ela é uma **decisão de
 * protocolo**, não um padrão de conveniência: `fetchNoitesLunares` continua exigindo
 * o `desde` explícito, e quem autoriza uma execução é quem escolhe o alcance dela.
 * O que a constante dá é um nome para o alcance do protocolo, e um lugar único para
 * ele — um literal redigitado em quatro arquivos é quatro chances de digitar 2026.
 *
 * Cada execução grava o `desde` que de fato foi pedido, em `pedido_desde`: sem ele,
 * um acervo que começa tarde é ambíguo entre *pedi assim* e *não há dado antes*.
 */
export const INICIO_DO_ACERVO_LUNAR = '2025-04-23';

/* ─────────────────────── A operacionalização ─────────────────────── */

/**
 * A borda direita da janela `[fase − 5 d, fase)`.
 *
 * `aberta` é o protocolo: a noite cujo instante **é** o da fase fica de fora, que é
 * o sentido literal de "as cinco noites que antecedem". Fechá-la incluiria a noite
 * de maior valor esperado sob a hipótese e excluiria a −5 — a coluna testada
 * andaria uma noite inteira, e nenhum teste de formato notaria.
 */
export type BordaDaJanela = 'aberta' | 'fechada';

/** As duas, como valor — é esta lista que o CHECK de `lua_execucoes.borda_direita` repete. */
export const BORDAS_DA_JANELA: readonly BordaDaJanela[] =
  Object.freeze<BordaDaJanela[]>(['aberta', 'fechada']);

/**
 * Os três valores que decidem **qual noite entra em qual coluna** e que vivem em
 * código, fora de qualquer documento hasheado.
 *
 * O §10 de 28/09 nomeia a dívida: mudar um deles depois de ver o resultado desloca
 * a coluna testada **sem quebrar o build**. Desde a story 4.3 a metade que se podia
 * fechar está fechada: o golden de `lua.ts` em `architecture.test.ts`, com
 * {@link JANELA_LUNAR_VERSAO} ao lado, **impede** a mudança silenciosa.
 *
 * O carimbo continua, e continua sendo outra coisa — ele não impede, torna a mudança
 * visível depois do fato, porque duas execuções com janelas diferentes ficam lado a
 * lado na mesma tabela, e a versão da régua vai gravada ao lado delas.
 */
export interface OperacionalizacaoLunar {
  /** `JANELA_LUNAR_NOITES`: quantas noites antes da fase formam a exposição. */
  janelaNoites: number;
  /** `HORA_UTC_DO_FIM_DA_NOITE`: a hora UTC que representa a noite. */
  horaUtcDoFimDaNoite: number;
  /** A borda direita, **medida** contra a classificação — ver {@link operacionalizacaoLunar}. */
  bordaDireita: BordaDaJanela;
}

/**
 * A borda direita, **medida** em vez de declarada.
 *
 * Um literal `'aberta'` aqui seria um comentário com cara de valor: ele afirmaria a
 * propriedade sem tocar no código que a implementa, e continuaria dizendo `aberta`
 * no dia em que a classificação passasse a incluir a noite da própria fase. A sonda
 * pergunta ao classificador: no instante **exato** da fase, a noite cai na janela?
 * Se cai, a borda está fechada.
 *
 * As quatro fases são sondadas porque a borda é propriedade da regra, não de uma
 * fase: se uma delas divergir, `fechada` é a resposta honesta para a execução
 * inteira. O instante de referência é arbitrário de propósito — o que se mede é a
 * regra, e nenhuma data a muda.
 */
function medirBordaDireita(): BordaDaJanela {
  const referencia = new Date(Date.UTC(2026, 0, 1));
  for (const fase of PHASE_ORDER) {
    const { instant } = nextLunarPhase(fase, referencia);
    if (janelaLunarDoInstante(instant, fase) !== null) return 'fechada';
  }
  return 'aberta';
}

let memo: Readonly<OperacionalizacaoLunar> | null = null;

/**
 * A operacionalização vigente, congelada e memoizada.
 *
 * **Função, e não constante de módulo**, porque a sonda da borda avalia a efeméride
 * oito vezes: pouco, mas pouco pago na abertura do app é pouco pago por nada — o
 * carimbo só é lido quando uma execução é gravada, uma vez a cada cem noites. O
 * memo é cache puro: esvaziá-lo mudaria a velocidade, nunca a resposta.
 */
export function operacionalizacaoLunar(): Readonly<OperacionalizacaoLunar> {
  memo ??= Object.freeze({
    janelaNoites: JANELA_LUNAR_NOITES,
    horaUtcDoFimDaNoite: HORA_UTC_DO_FIM_DA_NOITE,
    bordaDireita: medirBordaDireita(),
  });
  return memo;
}
