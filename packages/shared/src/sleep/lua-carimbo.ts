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
 * ## O que este arquivo NÃO é
 *
 * Não é a barreira do build. A story 4.3 decide se e como `architecture.test.ts`
 * passa a cobrar a cadeia contra os arquivos em disco; aqui só nasce a constante
 * que ela vai comparar. E não é o executor: quem compara antes de rodar é quem
 * grava (`data/lua-execucoes.ts`).
 */
import { PHASE_ORDER, nextLunarPhase } from '../astro/moon';
import { sha256Hex } from '../ia/sha256';
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
    sha256: 'c5a9901c35d93041360e2bed922e34870db2233659075c87405ef1879b5ebe44',
  }),
]);

/**
 * O digest da cadeia: **sha256 das sha256**, na ordem, unidas por `\n`.
 *
 * O molde é o `hashDoGolden` de `ia/recursos.test.ts`, e a escolha de hashear os
 * hashes (e não os arquivos concatenados) tem a mesma razão de lá: o digest muda
 * quando **qualquer** elo muda, e a ordem faz parte do que ele afirma — trocar dois
 * documentos de lugar dá outro digest, porque a ordem da cadeia é a cronologia da
 * regra.
 *
 * Derivado, e não literal: dois números para manter em sincronia é um número a mais
 * do que existe. Quem prende o valor é `lua-carimbo.test.ts`, com a sha pinada e a
 * data ao lado — o molde de `ia/verificar.test.ts`.
 */
export const DIGEST_DA_CADEIA: string = sha256Hex(
  CADEIA_DO_PRE_REGISTRO.map((e) => e.sha256).join('\n'),
);

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
 * a coluna testada **sem quebrar o build**. A barreira que os cobraria é decisão da
 * story 4.3; até ela existir, o que há é este carimbo — e ele não impede nada, só
 * torna a mudança visível depois do fato, porque duas execuções com janelas
 * diferentes ficam lado a lado na mesma tabela.
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
