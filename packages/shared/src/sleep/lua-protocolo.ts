/**
 * O motor do teste lunar — as quatro fases, os portões, o poder e o veredito.
 *
 * Os dois pré-registros são a autoridade, e não este arquivo:
 * `docs/specs/revista-retrospectiva/pre-registro-lua.md` (07/09/2026, a cheia
 * sozinha, 5% unilateral na direção do atraso),
 * `pre-registro-lua-outras-fases.md` (28/09/2026, a nova e os dois quartos, 5%/3
 * bilateral cada) e a correção de 08/09, que só mexe em onde a execução é gravada.
 * Aqui não há decisão nova: o protocolo entra como **dado** — {@link PROTOCOLO_LUNAR} —
 * e o corpo do teste nunca pergunta que fase está rodando.
 *
 * ## Uma chamada, quatro fases
 *
 * {@link vereditoLunar} é a **porta única**, e é assim por causa da §9 de 28/09:
 * *"uma execução autorizada calcula as quatro fases, grava as quatro e publica as
 * quatro"*. Rodar uma, ver o resultado e decidir se roda as outras é o jardim dos
 * caminhos que se bifurcam com quatro portas. Por isso não existe aqui nenhuma
 * função que receba uma fase e devolva o resultado dela — `lua-protocolo.test.ts`
 * tem uma guarda que lê a superfície pública deste arquivo e reprova quem abrir uma.
 *
 * As funções de poder ({@link poderLunar}, {@link efeitoMinimoDetectavel},
 * {@link noitesParaPoder}) são a exceção, e são exceção por escrito: elas recebem
 * dispersão e tamanhos de coluna, **nunca uma noite**, e a §5 de 07/09 autoriza
 * expressamente calcular poder antes de olhar o dado — é o que as tabelas dos dois
 * documentos são.
 *
 * ## O desfecho, a meia-noite e a origem do eixo
 *
 * O desfecho é o §3: *"hora de apagar, em minutos desde a meia-noite"*. Em minutos
 * desde a meia-noite, porém, 23h50 fica a **1.420 minutos** de 00h10 — duas noites a
 * vinte minutos uma da outra viram a maior distância do eixo, e é o `apagou` que
 * atravessa a virada do dia quase toda noite. O eixo de `sleep/timing.ts`, com
 * origem às 18h, resolve o caso comum.
 *
 * Só que ele **não resolve o caso**: desloca a borda para as 18:00. Um `onsetAt` de
 * 17h50 cai em 1.430 e um de 18h10 cai em 10, e a mesma mentira de 1.420 minutos
 * volta. Por isso a origem tem guarda: {@link desdobrarEixo} mede os vãos do
 * círculo e, **só quando o maior vão não é o que contém a origem**, gira o eixo para
 * o fim do maior vão. Com dado de sono normal o maior vão é o dia inteiro em que
 * ninguém apaga a luz, a origem já está dentro dele, e a origem fica nas 18h — que é
 * o que `acervo.origemDoEixoH` relata.
 *
 * Girar é legítimo porque **o efeito relatado é uma diferença** — a mediana das
 * diferenças par a par entre as colunas —, e diferença é invariante à origem. É essa
 * invariância que reconcilia o eixo de 18h com a letra do §4 do documento, e é ela
 * que o teste cobra, com observações dos dois lados da origem.
 *
 * ## Qual teste, e por que este
 *
 * A §3 pede *"comparação das medianas com covariável de luz"*. São três peças:
 *
 * 1. **A luz sai por resíduo de MQO** sobre todas as noites, não por estratificação:
 *    estratificar estilhaça as ~49 noites da janela em faixas de luz e reprova o
 *    portão dos 5 por célula antes de medir coisa nenhuma.
 * 2. **O efeito é o deslocamento de Hodges–Lehmann**, a mediana das diferenças par a
 *    par entre as colunas — que é literalmente "comparação das medianas", e não a
 *    diferença de duas medianas, que não é estimador de deslocamento.
 * 3. **O p é de Mann–Whitney**, unilateral na cheia e bilateral nas três.
 *
 * **Isso não invalida a tabela de poder pré-registrada.** A eficiência relativa
 * assintótica do Mann–Whitney contra o t é 0,955 sob normalidade e nunca abaixo de
 * 0,864 em qualquer distribuição contínua: a tabela do §5, calculada pela
 * aproximação normal, segue valendo e fica ligeiramente **conservadora**. Um método
 * que a invalidasse seria desvio de protocolo, não refinamento.
 *
 * ### A correção de continuidade, declarada em voz alta
 *
 * Os dois documentos não a mencionam. Ela entra porque é padrão ao aproximar uma
 * estatística discreta (U) por uma contínua, e porque **é conservadora**: meio ponto
 * de U é tirado do lado do achado, o p sobe, e o erro que ela pode causar é deixar
 * de achar. Está aqui porque foi decidida, não porque passou despercebida, e
 * `lua-protocolo.test.ts` tem uma asserção que a observa — removê-la reprova a suíte.
 *
 * ### A residualização ATENUA o efeito, e isso também é conservador
 *
 * O MQO da luz é ajustado **no conjunto inteiro**, sem indicador de exposição: a
 * inclinação é estimada sobre as noites de dentro e as de fora juntas. Se fase e luz
 * se correlacionarem no acervo — e elas se correlacionam sempre que as janelas de uma
 * fase caírem desequilibradas entre as estações —, parte do efeito lunar é absorvida
 * pela inclinação da luz, e o efeito medido **encolhe para o nulo**.
 *
 * A alternativa seria ajustar a luz só nas noites de fora, ou pôr o indicador de
 * exposição no MQO. Nenhuma das duas está nos documentos, as duas mudam o estimador
 * que a §3 nomeia, e ambas empurram na direção **oposta** à conservadora. Então fica
 * como está — mas fica **dito**, como a correção de continuidade: é viés para o nulo,
 * é o mesmo sentido do viés já declarado na §7 de 28/09 (comparar contra todas as
 * outras noites), e some ao custo de não achar, nunca ao de achar demais.
 *
 * ## O poder usa o SD marginal BRUTO
 *
 * A §5 indexa a tabela por *"SD da hora de apagar"* e diz que **esse** é o único
 * número consultável antes de rodar: o marginal, sem separar por fase. Residualizar
 * a luz encolhe o SD e **inflaria** o poder — e inflar poder é transformar
 * `inconclusivo` em `nenhum_padrao`, que a §5 chama de mentir com o mesmo tom de voz.
 * O bruto subestima o poder e empurra para `inconclusivo`. Conservador e fiel, nessa
 * ordem. O teste tem um acervo em que os dois SDs caem em lados opostos do corte de
 * 80%, para que a troca não possa acontecer em silêncio.
 *
 * ## A ordem do veredito: portões → poder → significância → limiar
 *
 * | Veredito | Condição |
 * |---|---|
 * | **achado** | `abs(Δ) >= 15 min` **e** `p < α` **e** `poder >= 80%` (na cheia, só no atraso) |
 * | **nenhum_padrao** | `poder >= 80%` **e** (não significante **ou** `abs(Δ) < 15 min`) |
 * | **inconclusivo** | `poder < 80%` **ou** qualquer portão reprovado |
 *
 * O poder é **portão, não desempate**. Um resultado significante que não passa por
 * ele não vira `achado` nem `nenhum_padrao`: vira `inconclusivo`. Na geometria das
 * duas tabelas (49 × 241) o poder para 15 minutos é de **39%** nas três fases novas a
 * SD 45, e vai de 79% a 9% nas cinco linhas de SD que o §6 tabela; a **cheia**, que é
 * a que chega a 69%, está na outra tabela e na outra família — os dois números não se
 * somam numa faixa só. O ramo "significante sem poder" é, nessa aritmética, o
 * **provável**, não o exótico, e imprimir `achado` ali seria exatamente a manchete
 * que o par de pré-registros existe para impedir.
 *
 * E todo `inconclusivo` diz **quanto falta** — os dois documentos o pedem sem
 * conjunção, para os portões e para o poder. O número sozinho mentiria, porque ele
 * troca de unidade com o motivo: ver {@link ResultadoDaFase.falta}, que carrega a
 * unidade ao lado do número, e {@link UNIDADE_DO_MOTIVO}, que as congela.
 *
 * ## Puro, e cobrado como tal
 *
 * Sem banco, sem rede, sem relógio do hospedeiro, sem fuso do aparelho e sem
 * coordenada — a luz do dia **chega como dado** em `luzH` e nunca é calculada aqui;
 * importar `astro/sun` ou `astro/casa` é proibido por desenho. A mesma guarda de
 * `sleep/lua.ts` cobre este arquivo (`lua.test.ts`).
 */
import { PHASE_ORDER, type LunarPhaseKind } from '../astro/moon';
import { stdDev } from '../health/trends';
import { instanteDaNoite, janelaLunarDoInstante, type JanelaLunar } from './lua';
import { SLEEP_AXIS_ORIGIN_H, axisPosition } from './timing';

/* ─────────────────────────── O protocolo, como dado ─────────────────────────── */

/** α da cheia: 5%, unilateral, na direção do atraso (§3 de 07/09). */
export const ALFA_DA_CHEIA = 0.05;

/**
 * α de **cada uma** das três fases novas: 5% dividido por três (§3 de 28/09).
 *
 * A divisão escrita, e não o `0,0167` que o documento imprime arredondado: 5/3 %
 * é 0,016666…, e o arredondado é **mais frouxo** que o protocolo.
 */
export const ALFA_DAS_TRES = 0.05 / 3;

/** O limiar prático, em minutos. Significante e abaixo dele é nulo prático (§5). */
export const LIMIAR_PRATICO_MIN = 15;

/** O corte do portão de poder. Abaixo dele o veredito é `inconclusivo` (§5, §6). */
export const PODER_MINIMO = 0.8;

/**
 * Noites mínimas em **cada** coluna (§4.1 e §6.1).
 *
 * É o mesmo 5 de `TRIGGER_MIN_PER_CELL` em `sleep/triggers.ts`, e é constante
 * **própria** de propósito: aquela é a regra das duas colunas de uma outra feature,
 * e calibrá-la lá — coisa legítima de se fazer — moveria em silêncio um portão
 * pré-registrado aqui. Os documentos citam o nome dela; o valor é que não se empresta.
 */
export const NOITES_MINIMAS_POR_COLUNA = 5;

/** Ciclos sinódicos distintos que têm de contribuir com ao menos uma noite (§4.2, §6.2). */
export const CICLOS_MINIMOS = 10;

/** Unilateral só na cheia, que tem mecanismo e direção na literatura (§5 de 28/09). */
export type Lateralidade = 'unilateral' | 'bilateral';

/**
 * As duas famílias, que **nunca** se somam num resultado só.
 *
 * A §2 de 28/09: *"a partir daqui não existe 'eu testei as quatro fases'"*. Uma é
 * confirmatória a 5%, pré-registrada sozinha com direção tirada do Casiraghi 2021; a
 * outra nasceu depois, em trio, sem direção própria. O campo existe para que a página
 * possa nomeá-las separadamente, que é o que a §11 de lá exige.
 */
export type FamiliaLunar = 'cheia' | 'as-tres';

/** Uma linha do protocolo: tudo o que muda de uma fase para a outra. */
export interface LinhaDoProtocolo {
  fase: LunarPhaseKind;
  familia: FamiliaLunar;
  alfa: number;
  lateralidade: Lateralidade;
  /** A direção que conta como achado, ou `null` quando as duas contam. */
  direcao: 'atraso' | null;
  /** O documento que pré-registrou esta linha. */
  documento: string;
}

/**
 * Exatamente quatro linhas — a tupla é o que impede a quinta.
 *
 * Tipar {@link PROTOCOLO_LUNAR} com isto **no literal** (e não com um `as` depois)
 * faz uma fase a mais virar erro de compilação em vez de um quinto teste silencioso.
 */
export type QuatroLinhas = readonly [
  LinhaDoProtocolo,
  LinhaDoProtocolo,
  LinhaDoProtocolo,
  LinhaDoProtocolo,
];

const DOC_DA_CHEIA = 'docs/specs/revista-retrospectiva/pre-registro-lua.md';
const DOC_DAS_TRES = 'docs/specs/revista-retrospectiva/pre-registro-lua-outras-fases.md';

/**
 * O protocolo inteiro, na ordem de `PHASE_ORDER` — a lunação, não a importância.
 *
 * α e lateralidade são **dado**, nunca `if` no corpo do teste: é o que garante que
 * a cheia não empreste a hipótese dela às outras três, que é a forma elegante de
 * p-hacking que a §5 de 28/09 existe para impedir.
 */
export const PROTOCOLO_LUNAR: QuatroLinhas = [
  {
    fase: 'new',
    familia: 'as-tres',
    alfa: ALFA_DAS_TRES,
    lateralidade: 'bilateral',
    direcao: null,
    documento: DOC_DAS_TRES,
  },
  {
    fase: 'firstQuarter',
    familia: 'as-tres',
    alfa: ALFA_DAS_TRES,
    lateralidade: 'bilateral',
    direcao: null,
    documento: DOC_DAS_TRES,
  },
  {
    fase: 'full',
    familia: 'cheia',
    alfa: ALFA_DA_CHEIA,
    lateralidade: 'unilateral',
    direcao: 'atraso',
    documento: DOC_DA_CHEIA,
  },
  {
    fase: 'lastQuarter',
    familia: 'as-tres',
    alfa: ALFA_DAS_TRES,
    lateralidade: 'bilateral',
    direcao: null,
    documento: DOC_DAS_TRES,
  },
];

/* ─────────────────────────── A entrada e a saída ─────────────────────────── */

/**
 * Uma noite já medida, reduzida ao que o teste precisa.
 *
 * `luzH` chega de fora porque o motor **não calcula luz do dia**: a covariável é
 * pré-requisito do §3, e o lugar dela é o chamador, que sabe a latitude. Ausente,
 * fora de `[0, 24]` ou não finita, ela derruba o portão da luz — para as quatro.
 */
export interface NoiteLunarMedida {
  /** `'YYYY-MM-DD'` do dia em que acordou. A chave da noite. */
  wakeDay: string;
  /** ISO do instante em que **apagou** — o desfecho primário, e só ele. */
  onsetAt: string;
  /** Minutos vs UTC no `onsetAt`. Sem ele, viagem lê como mudança de horário. */
  tzOffset: number;
  /** Horas de luz do dia na latitude do sujeito, em `[0, 24]`. */
  luzH: number | null | undefined;
}

export type VereditoLunar = 'achado' | 'nenhum_padrao' | 'inconclusivo';

/** Os três portões da §4, na ordem em que são cobrados. */
export type PortaoLunar = 'luz' | 'amostra' | 'ciclos';

/** Por que um `inconclusivo` é inconclusivo. `'poder'` é com os três portões abertos. */
export type MotivoDoInconclusivo = PortaoLunar | 'poder';

/**
 * A unidade do que falta. **Quatro motivos, quatro unidades diferentes.**
 *
 * - `'noites-sem-luz'` — noites que **já estão no acervo** e vieram sem a covariável.
 *   Não se coletam: conserta-se o dado de quem as produziu.
 * - `'noites-de-coluna'` — vagas para as cinco de cada coluna, as duas somadas.
 * - `'ciclos'` — ciclos sinódicos distintos, cada um exigindo ao menos uma noite nova
 *   **nele**; colher cem noites do mesmo ciclo não move este número.
 * - `'noites-coletaveis'` — noites novas no acervo, na razão de colunas observada.
 *   É a única das quatro em que "faltam N noites" é frase verdadeira.
 *
 * O campo existe porque o número sozinho mente, e o precedente é a story 2.8 — o
 * "1 dias": lá o defeito era a unidade não concordar com o número, aqui seria a
 * unidade não existir. Quem imprimir "faltam N noites" para os outros três motivos
 * está imprimindo outra coisa com o nome de noite.
 */
export type UnidadeDoQueFalta =
  | 'noites-sem-luz'
  | 'noites-de-coluna'
  | 'ciclos'
  | 'noites-coletaveis';

/** Quanto falta para o `inconclusivo` deixar de ser inconclusivo — e **em quê**. */
export interface OQueFalta {
  quanto: number;
  unidade: UnidadeDoQueFalta;
}

/**
 * A unidade de cada motivo, congelada aqui e em lugar nenhum mais.
 *
 * Quem imprime o `inconclusivo` lê daqui em vez de decidir por conta; o teste cobra
 * que as quatro entradas existam e que cada resultado saia com a unidade do motivo
 * que ele declarou.
 */
export const UNIDADE_DO_MOTIVO: Readonly<Record<MotivoDoInconclusivo, UnidadeDoQueFalta>> = {
  luz: 'noites-sem-luz',
  amostra: 'noites-de-coluna',
  ciclos: 'ciclos',
  poder: 'noites-coletaveis',
};

/** O resultado de uma fase. Nulo é "não foi medido" — nunca zero. */
export interface ResultadoDaFase {
  fase: LunarPhaseKind;
  familia: FamiliaLunar;
  alfa: number;
  lateralidade: Lateralidade;
  direcao: 'atraso' | null;
  veredito: VereditoLunar;
  /** `null` quando o veredito não é `inconclusivo`. */
  motivo: MotivoDoInconclusivo | null;
  /** Qual portão reprovou. `null` também no `inconclusivo` por poder. */
  portaoReprovado: PortaoLunar | null;
  /**
   * Deslocamento de Hodges–Lehmann, em minutos, **com sinal**: positivo é atraso.
   * `null` quando um portão reprovou — não foi medido, e zero seria mentira.
   */
  efeitoMin: number | null;
  /** p de Mann–Whitney, na lateralidade da linha. `null` quando não foi medido. */
  p: number | null;
  /**
   * O `z` que produziu o {@link ResultadoDaFase.p} — U padronizado, já com a correção
   * de continuidade e a de empates.
   *
   * Publicado para que o p seja **auditável contra a tabela normal** sem refazer o
   * teste: `p = 1 − Φ(z)` na cheia e `p = 2·(1 − Φ(z))` nas três. Sem ele, um p
   * impresso na página só pode ser conferido rodando o motor de novo — que é a mesma
   * autoridade dizendo a mesma coisa.
   *
   * `null` quando não foi medido (portão fechado) **e também** quando não houve teste
   * com que medir: coluna vazia ou tudo empatado, em que o p é 1 por decisão declarada
   * e não por conta. Ver {@link ProvaDeMannWhitney.z}.
   */
  zDeMannWhitney: number | null;
  /** Poder para detectar {@link LIMIAR_PRATICO_MIN}, no SD marginal bruto. */
  poder: number | null;
  /** Efeito mínimo detectável a 80%, em minutos — o que a tabela dos documentos imprime. */
  efeitoMinimoDetectavelMin: number | null;
  noitesDentro: number;
  noitesFora: number;
  /** Ciclos sinódicos distintos que contribuíram com ao menos uma noite nesta janela. */
  ciclos: number;
  /**
   * Quanto falta, **com a unidade junto** — ver {@link UnidadeDoQueFalta}.
   *
   * A unidade sai de {@link UNIDADE_DO_MOTIVO}, indexada pelo
   * {@link ResultadoDaFase.motivo}, e nunca de quem lê. No motivo `'poder'` o número
   * é no mínimo **1**: zero ali seria "já temos o bastante", e o bastante é
   * exatamente o que o portão acabou de negar.
   *
   * `null` quando o veredito não é `inconclusivo`, ou quando a dispersão é
   * degenerada e a conta não existe.
   */
  falta: OQueFalta | null;
  /** Noites totais para 80% de poder em 15 min — o número que os documentos tabelam. */
  noitesPara80: number | null;
}

/** Quatro resultados, na mesma ordem de {@link PROTOCOLO_LUNAR}. */
export type QuatroResultados = readonly [
  ResultadoDaFase,
  ResultadoDaFase,
  ResultadoDaFase,
  ResultadoDaFase,
];

/** Proveniência e diagnóstico do acervo — para que o portão da luz não pareça um bug. */
export interface AcervoLunar {
  /** Noites recebidas. */
  noites: number;
  /**
   * `wakeDay` distintos — **sempre igual a {@link AcervoLunar.noites}**.
   *
   * Não é redundância: é a contagem que a guarda de duplicata usa, publicada para
   * quem auditar. Ver {@link vereditoLunar}, que **recusa** o acervo em que as duas
   * diferem. Se este campo um dia sair diferente de `noites`, a guarda caiu.
   */
  noitesDistintas: number;
  /**
   * O primeiro e o último `wakeDay` do acervo, em ordem **cronológica** — e não o
   * primeiro e o último da lista recebida, que não é ordenada por contrato.
   * `null` no acervo vazio.
   */
  de: string | null;
  ate: string | null;
  /**
   * SD **marginal bruto** da hora de apagar, em minutos — o único número que a §5
   * autoriza consultar antes de rodar. `null` com menos de duas noites.
   */
  sdMin: number | null;
  /** A origem do eixo efetivamente usada, em horas locais. 18 salvo travessia. */
  origemDoEixoH: number;
  /** Noites sem luz do dia utilizável. Acima de zero, as quatro fases param. */
  noitesSemLuz: number;
  /** O `wakeDay` da primeira delas, em ordem de entrada — por onde começar a olhar. */
  primeiraNoiteSemLuz: string | null;
}

/** O que uma execução autorizada produz: as quatro, de uma vez, com a proveniência. */
export interface VereditoLunarCompleto {
  fases: QuatroResultados;
  acervo: AcervoLunar;
}

/* ─────────────────────────── Aritmética ─────────────────────────── */

const MIN_POR_DIA = 1440;

/** Meio ponto de U, tirado sempre do lado do achado. Ver o docblock do arquivo. */
const CORRECAO_DE_CONTINUIDADE = 0.5;

/**
 * Φ(z) — normal padrão acumulada, pelo algoritmo de Hart (1968).
 *
 * Precisão de dupla; a série racional abaixo de 7,07 e a fração continuada acima.
 * A aproximação de Abramowitz–Stegun (1,5 × 10⁻⁷) chegaria para a tabela de poder,
 * mas não para um p que se compara com 0,0167.
 */
function normalCdf(z: number): number {
  const a = Math.abs(z);
  let cauda: number;
  if (a > 37) {
    cauda = 0;
  } else {
    const e = Math.exp((-a * a) / 2);
    if (a < 7.071067811865475) {
      let num = 3.52624965998911e-2 * a + 0.700383064443688;
      num = num * a + 6.37396220353165;
      num = num * a + 33.912866078383;
      num = num * a + 112.079291497871;
      num = num * a + 221.213596169931;
      num = num * a + 220.206867912376;
      let den = 8.83883476483184e-2 * a + 1.75566716318264;
      den = den * a + 16.064177579207;
      den = den * a + 86.7807322029461;
      den = den * a + 296.564248779674;
      den = den * a + 637.333633378831;
      den = den * a + 793.826512519948;
      den = den * a + 440.413735824752;
      cauda = (e * num) / den;
    } else {
      let f = a + 0.65;
      f = a + 4 / f;
      f = a + 3 / f;
      f = a + 2 / f;
      f = a + 1 / f;
      cauda = e / f / 2.506628274631;
    }
  }
  return z > 0 ? 1 - cauda : cauda;
}

const ACKLAM_A = [
  -3.969683028665376e1, 2.209460984245205e2, -2.759285104469687e2, 1.38357751867269e2,
  -3.066479806614716e1, 2.506628277459239,
];
const ACKLAM_B = [
  -5.447609879822406e1, 1.615858368580409e2, -1.556989798598866e2, 6.680131188771972e1,
  -1.328068155288572e1,
];
const ACKLAM_C = [
  -7.784894002430293e-3, -3.223964580411365e-1, -2.400758277161838, -2.549732539343734,
  4.374664141464968, 2.938163982698783,
];
const ACKLAM_D = [7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996, 3.754408661907416];

/**
 * Φ⁻¹(p) — o z de uma cauda, por Acklam com um refino de Halley.
 *
 * É o que transforma α em `z_α` e 80% em `z_β`, e é por ele que as vinte células das
 * tabelas de poder dos dois documentos saem no dígito que eles imprimem.
 */
function normalQuantile(p: number): number {
  if (!(p > 0 && p < 1)) return p <= 0 ? -Infinity : Infinity;
  const baixo = 0.02425;
  let x: number;
  if (p < baixo) {
    const q = Math.sqrt(-2 * Math.log(p));
    x =
      (((((ACKLAM_C[0] * q + ACKLAM_C[1]) * q + ACKLAM_C[2]) * q + ACKLAM_C[3]) * q + ACKLAM_C[4]) * q +
        ACKLAM_C[5]) /
      ((((ACKLAM_D[0] * q + ACKLAM_D[1]) * q + ACKLAM_D[2]) * q + ACKLAM_D[3]) * q + 1);
  } else if (p <= 1 - baixo) {
    const q = p - 0.5;
    const r = q * q;
    x =
      ((((((ACKLAM_A[0] * r + ACKLAM_A[1]) * r + ACKLAM_A[2]) * r + ACKLAM_A[3]) * r + ACKLAM_A[4]) * r +
        ACKLAM_A[5]) *
        q) /
      (((((ACKLAM_B[0] * r + ACKLAM_B[1]) * r + ACKLAM_B[2]) * r + ACKLAM_B[3]) * r + ACKLAM_B[4]) * r + 1);
  } else {
    const q = Math.sqrt(-2 * Math.log(1 - p));
    x =
      -(((((ACKLAM_C[0] * q + ACKLAM_C[1]) * q + ACKLAM_C[2]) * q + ACKLAM_C[3]) * q + ACKLAM_C[4]) * q +
        ACKLAM_C[5]) /
      ((((ACKLAM_D[0] * q + ACKLAM_D[1]) * q + ACKLAM_D[2]) * q + ACKLAM_D[3]) * q + 1);
  }
  // Halley: leva o erro relativo de ~1e-9 (Acklam) para a precisão da dupla.
  const e = normalCdf(x) - p;
  const u = e * Math.sqrt(2 * Math.PI) * Math.exp((x * x) / 2);
  return x - u / (1 + (x * u) / 2);
}

/**
 * Mediana por interpolação linear — a mesma regra do `percentile_cont` do Postgres.
 *
 * Escrita aqui, e não importada de `sleep/buckets.ts`, porque aquele módulo lê o
 * fuso do hospedeiro em `weekKey` (`new Date` local, `getDay`) e reprovaria a guarda
 * de pureza. A guarda só olha um nível de import, então importá-lo passaria calado —
 * que é exatamente o motivo de não importar.
 */
function mediana(xs: readonly number[]): number {
  if (xs.length === 0) return Number.NaN;
  const s = [...xs].sort((a, b) => a - b);
  const i = (s.length - 1) / 2;
  const lo = Math.floor(i);
  const hi = Math.ceil(i);
  return s[lo] + (s[hi] - s[lo]) * (i - lo);
}

function media(xs: readonly number[]): number {
  if (xs.length === 0) return Number.NaN;
  let soma = 0;
  for (const x of xs) soma += x;
  return soma / xs.length;
}

/**
 * O deslocamento de Hodges–Lehmann: a mediana das `n₁ × n₂` diferenças par a par.
 *
 * Positivo = a coluna de dentro apagou **mais tarde**. Não é a diferença das duas
 * medianas: aquela não é estimador de deslocamento, e é a mediana das diferenças que
 * corresponde ao teste de Mann–Whitney que dá o p.
 */
function hodgesLehmann(dentro: readonly number[], fora: readonly number[]): number {
  const pares: number[] = [];
  for (const a of dentro) for (const b of fora) pares.push(a - b);
  return mediana(pares);
}

interface ProvaDeMannWhitney {
  p: number;
  /**
   * `null` quando **não houve teste**: coluna vazia ou tudo empatado.
   *
   * Zero seria pior que nulo aqui, porque zero é um `z` legítimo — o do empate
   * perfeito entre duas colunas com dispersão —, e quem auditasse o p pela tabela
   * normal leria `1 − Φ(0) = 0,5` e acharia o motor errado. O p desses dois casos é 1
   * por decisão declarada (nenhuma informação), não por conta.
   */
  z: number | null;
}

/**
 * Mann–Whitney pela aproximação normal, com correção de empates e de continuidade.
 *
 * `dentro` é a coluna testada, e o unilateral procura **atraso**: U grande é dentro
 * com postos altos, isto é, apagando mais tarde.
 */
function mannWhitney(
  dentro: readonly number[],
  fora: readonly number[],
  lateralidade: Lateralidade,
): ProvaDeMannWhitney {
  const n1 = dentro.length;
  const n2 = fora.length;
  const n = n1 + n2;
  if (n1 < 1 || n2 < 1 || n < 2) return { p: 1, z: null };

  const todos = [
    ...dentro.map((v) => ({ v, testada: true })),
    ...fora.map((v) => ({ v, testada: false })),
  ].sort((x, y) => x.v - y.v);

  let somaDosPostos = 0;
  let empates = 0;
  let i = 0;
  while (i < n) {
    let j = i;
    while (j + 1 < n && todos[j + 1].v === todos[i].v) j += 1;
    const posto = (i + j) / 2 + 1; // posto médio, 1-based
    const t = j - i + 1;
    if (t > 1) empates += t ** 3 - t;
    for (let k = i; k <= j; k += 1) if (todos[k].testada) somaDosPostos += posto;
    i = j + 1;
  }

  const u = somaDosPostos - (n1 * (n1 + 1)) / 2;
  const mu = (n1 * n2) / 2;
  const variancia = ((n1 * n2) / 12) * (n + 1 - empates / (n * (n - 1)));
  const sigma = Math.sqrt(Math.max(0, variancia));
  // Tudo empatado: não há informação nenhuma, e o p é 1 — não 0. E o `z` é nulo, não
  // zero: zero é um z de verdade, e publicá-lo aqui faria o p parecer contraditório.
  if (!(sigma > 0)) return { p: 1, z: null };

  const dif = u - mu;
  if (lateralidade === 'bilateral') {
    const z = Math.max(0, Math.abs(dif) - CORRECAO_DE_CONTINUIDADE) / sigma;
    return { p: Math.min(1, 2 * (1 - normalCdf(z))), z };
  }
  const z = (dif - CORRECAO_DE_CONTINUIDADE) / sigma;
  return { p: 1 - normalCdf(z), z };
}

/**
 * Resíduos de MQO da hora de apagar sobre as horas de luz, centrados.
 *
 * Sem variância na luz (uma estação só, uma noite só) a inclinação é zero e o
 * resíduo vira o desvio da média — que é o que sobra de honesto quando a covariável
 * não distingue nada. A centragem não muda diferença nenhuma; existe para que o
 * resíduo seja lido como desvio, e não como hora do dia.
 */
function residuosDaLuz(valores: readonly number[], luz: readonly number[]): number[] {
  const mx = media(luz);
  const my = media(valores);
  let sxy = 0;
  let sxx = 0;
  for (let i = 0; i < valores.length; i += 1) {
    sxy += (luz[i] - mx) * (valores[i] - my);
    sxx += (luz[i] - mx) ** 2;
  }
  const b = sxx > 0 ? sxy / sxx : 0;
  return valores.map((v, i) => v - my - b * (luz[i] - mx));
}

interface EixoDesdobrado {
  /** A origem efetivamente usada, em horas locais de `[0, 24)`. */
  origemH: number;
  /** Os desfechos em minutos desde ela, sem nenhuma volta no círculo. */
  valores: number[];
}

/**
 * Desdobra o relógio num eixo em que ninguém dá a volta.
 *
 * As posições chegam em `[0, 1440)` a partir da origem das 18h. Se **o maior vão do
 * círculo é o que contém a origem**, ninguém a atravessa e nada se move — é o caso
 * de todo dado de sono real, em que o vão é o dia inteiro. Se não é, as observações
 * estão dos dois lados da origem, e o eixo gira para o fim do maior vão: aí as duas
 * noites a vinte minutos uma da outra voltam a distar vinte minutos.
 *
 * O empate resolve a favor de não girar.
 *
 * ## O que a rotação move, e o que ela não move
 *
 * Girar **não move** o efeito nem o p: o efeito é uma diferença par a par, e o p é de
 * posto — as duas são invariantes a somar a mesma constante a todo mundo, e o giro é
 * isso enquanto ninguém dá a volta.
 *
 * Girar **move o SD marginal**, porque `acervo.sdMin` é calculado sobre
 * {@link EixoDesdobrado.valores}: uma nuvem que atravessa a origem tem, sem o giro,
 * observações em 1.430 e em 10, e o SD explode. E o SD move o poder, que é portão —
 * então a rotação **pode**, sim, mover o veredito entre `inconclusivo` e
 * `nenhum_padrao`. É por isso que o corte tem de ser **canônico**: ele é função só
 * das posições reunidas, nunca das colunas nem de qual fase está rodando, e cai
 * sempre no **maior vão**. Assim duas execuções sobre o mesmo acervo cortam no mesmo
 * lugar, e deslocar o acervo inteiro no relógio não muda número nenhum — o que o
 * teste cobra, sobre um acervo que atravessa a origem.
 */
function desdobrarEixo(posicoes: readonly number[]): EixoDesdobrado {
  if (posicoes.length < 2) {
    return { origemH: SLEEP_AXIS_ORIGIN_H, valores: [...posicoes] };
  }
  const ordenadas = [...posicoes].sort((a, b) => a - b);
  // O vão que contém a origem é o que fecha o círculo: do último ao primeiro.
  let maior = ordenadas[0] + MIN_POR_DIA - ordenadas[ordenadas.length - 1];
  let deslocamento = 0;
  for (let i = 0; i + 1 < ordenadas.length; i += 1) {
    const vao = ordenadas[i + 1] - ordenadas[i];
    if (vao > maior) {
      maior = vao;
      deslocamento = ordenadas[i + 1];
    }
  }
  if (deslocamento === 0) return { origemH: SLEEP_AXIS_ORIGIN_H, valores: [...posicoes] };
  return {
    origemH: (SLEEP_AXIS_ORIGIN_H + deslocamento / 60) % 24,
    valores: posicoes.map((p) => ((p - deslocamento) % MIN_POR_DIA + MIN_POR_DIA) % MIN_POR_DIA),
  };
}

/* ─────────────────────────── Poder, antes de olhar ─────────────────────────── */

/**
 * O que uma conta de poder precisa — e nada além disso.
 *
 * Note o que **não** está aqui: nenhuma noite, nenhuma fase, nenhuma mediana. É por
 * isso que estas três funções podem ser públicas sem furar a §9: elas são a tabela
 * do §5, que o próprio pré-registro manda calcular antes de olhar o dado.
 */
export interface ParametrosDePoder {
  /** SD **marginal bruto** da hora de apagar, em minutos. Nunca o residual. */
  sdMin: number;
  noitesDentro: number;
  noitesFora: number;
  alfa: number;
  lateralidade: Lateralidade;
  /** O deslocamento a detectar, em minutos. Padrão: {@link LIMIAR_PRATICO_MIN}. */
  efeitoMin?: number;
}

function zDoAlfa(alfa: number, lateralidade: Lateralidade): number {
  return normalQuantile(1 - (lateralidade === 'bilateral' ? alfa / 2 : alfa));
}

/**
 * Os parâmetros que não são dispersão nem tamanho de coluna, conferidos antes da conta.
 *
 * `alfa` fora de `(0, 1)` faz `normalQuantile` devolver `±Infinity`, e daí sai um
 * poder de 0 ou de 1 **sem que nada avise** — um α de 0 daria "poder zero, faltam
 * infinitas noites" e um α de 1, "poder total". `efeitoMin` zero daria MDE infinito e
 * poder igual a α; `NaN` atravessaria tudo e sairia como `NaN`, que não é `null` e
 * passaria pelo `poder < PODER_MINIMO` como `false`. Nos dois casos a resposta certa é
 * `null` — "não foi medido" —, que é o que o portão de poder trata como reprovado.
 */
function parametrosUtilizaveis(par: ParametrosDePoder): boolean {
  if (!(par.alfa > 0 && par.alfa < 1)) return false;
  if (par.efeitoMin !== undefined && !(Number.isFinite(par.efeitoMin) && par.efeitoMin !== 0)) {
    return false;
  }
  return true;
}

function erroPadrao(sdMin: number, n1: number, n2: number): number | null {
  if (!(sdMin > 0) || !Number.isFinite(sdMin)) return null;
  if (!(n1 >= 1) || !(n2 >= 1)) return null;
  return sdMin * Math.sqrt(1 / n1 + 1 / n2);
}

/**
 * O efeito mínimo detectável a 80%, em minutos — a segunda coluna das duas tabelas.
 *
 * `null`, nunca zero, quando o SD não é positivo finito ou uma coluna está vazia:
 * um zero aqui viraria "detecta qualquer coisa", que é o oposto da verdade.
 */
export function efeitoMinimoDetectavel(par: ParametrosDePoder): number | null {
  if (!parametrosUtilizaveis(par)) return null;
  const se = erroPadrao(par.sdMin, par.noitesDentro, par.noitesFora);
  if (se === null) return null;
  return (zDoAlfa(par.alfa, par.lateralidade) + normalQuantile(PODER_MINIMO)) * se;
}

/**
 * O poder para detectar `efeitoMin` — a terceira e a quarta colunas das tabelas.
 *
 * Aproximação normal para duas amostras, com a cauda oposta desprezada no bilateral
 * (ela vale menos de 10⁻⁷ em toda a faixa das tabelas). `null` nas mesmas condições
 * de {@link efeitoMinimoDetectavel} — e `null` é o que reprova o portão de poder,
 * porque poder não medido não é poder suficiente.
 */
export function poderLunar(par: ParametrosDePoder): number | null {
  if (!parametrosUtilizaveis(par)) return null;
  const se = erroPadrao(par.sdMin, par.noitesDentro, par.noitesFora);
  if (se === null) return null;
  const efeito = Math.abs(par.efeitoMin ?? LIMIAR_PRATICO_MIN);
  return normalCdf(efeito / se - zDoAlfa(par.alfa, par.lateralidade));
}

/**
 * Noites **totais** para 80% de poder, mantida a razão de colunas observada.
 *
 * É {@link efeitoMinimoDetectavel} invertido: `N = ((z_α + z_β)·SD/Δ)² · (1/r + 1/(1−r))`,
 * com `r = dentro / (dentro + fora)`.
 *
 * **A regra de arredondamento é `ceil`**, e ela é declarada porque muda o número: N é
 * um piso — arredondar para baixo prometeria um poder que ainda não existe. Com ela o
 * modelo reproduz as três linhas do §6 de 28/09 (672, 1.193 e 1.864 noites) e fica a
 * **uma noite** das do §5 de 07/09, onde o documento imprime 396 e 706 e o contínuo dá
 * 396,3 e 704,5. A divergência é do arredondamento manual dos documentos, é de ±1 a
 * ±2 noites, e está escrita aqui em vez de aparecer na página como contradição calada;
 * `lua-protocolo.test.ts` imprime as seis linhas lado a lado.
 */
export function noitesParaPoder(par: ParametrosDePoder): number | null {
  if (!parametrosUtilizaveis(par)) return null;
  const total = par.noitesDentro + par.noitesFora;
  const r = par.noitesDentro / total;
  if (!(r > 0 && r < 1)) return null;
  if (!(par.sdMin > 0) || !Number.isFinite(par.sdMin)) return null;
  const efeito = Math.abs(par.efeitoMin ?? LIMIAR_PRATICO_MIN);
  if (!(efeito > 0)) return null;
  const z = zDoAlfa(par.alfa, par.lateralidade) + normalQuantile(PODER_MINIMO);
  const n = ((z * par.sdMin) / efeito) ** 2 * (1 / r + 1 / (1 - r));
  return Number.isFinite(n) ? Math.ceil(n) : null;
}

/* ─────────────────────────── A execução ─────────────────────────── */

/** Uma noite já classificada e já posta no eixo. */
interface NoiteResolvida {
  wakeDay: string;
  janela: JanelaLunar | null;
  posicao: number;
  luzH: number | null;
}

function luzUtilizavel(luzH: number | null | undefined): number | null {
  if (typeof luzH !== 'number' || !Number.isFinite(luzH)) return null;
  return luzH >= 0 && luzH <= 24 ? luzH : null;
}

/**
 * Em qual das quatro janelas a noite caiu, ou `null` se em nenhuma.
 *
 * Privado **de propósito**: expor isto seria expor uma porta por fase, e a §9 de
 * 28/09 manda que as quatro rodem juntas ou nenhuma rode.
 *
 * As quatro janelas ocupam 20 dos 29,5 dias do sinódico sem se encostarem — as fases
 * distam 7,4 dias e a janela tem 5 —, então duas nunca casam. O `throw` é a prova
 * viva disso: se um dia casarem, o teste para em vez de escolher em silêncio.
 */
function resolverFase(t: Date): JanelaLunar | null {
  let achada: JanelaLunar | null = null;
  for (const fase of PHASE_ORDER) {
    const j = janelaLunarDoInstante(t, fase);
    if (j === null) continue;
    if (achada !== null) {
      throw new RangeError(
        `a noite de ${t.toISOString()} caiu em duas janelas: ${achada.fase} e ${j.fase}`,
      );
    }
    achada = j;
  }
  return achada;
}

/**
 * O maior fuso que existe: UTC+14 (Kiritimati), em minutos. UTC−12 é o outro extremo.
 *
 * Fora daqui não é fuso, é unidade trocada — segundos no lugar de minutos, ou o sinal
 * invertido duas vezes. Um `tzOffset` de 3.600 desloca a hora local em 60 horas e
 * manda a noite para o outro lado do eixo em silêncio.
 */
const TZ_OFFSET_MAX_MIN = 840;

/**
 * Quanto o `onsetAt` pode distar do fim da noite que ele diz ser, antes de virar erro.
 *
 * O `apagou` de uma noite que termina às 08:00 UTC de `wakeDay` cai, no pior caso
 * plausível, entre ~34 h antes dele (meio-dia local da véspera em UTC+14) e ~18 h
 * depois (meio-dia local do próprio dia em UTC−12). **Dois dias** cobre essa faixa
 * inteira com folga e ainda pega o defeito que importa: um `wakeDay` de março com um
 * `onsetAt` de julho, que hoje entrava calado — a noite ia para a coluna de uma fase
 * e a hora de apagar para o eixo de outra estação, e nada no resultado dizia isso.
 */
const DESVIO_MAXIMO_DO_ONSET_MS = 2 * 86_400_000;

function posicaoNoEixo(n: NoiteLunarMedida, fimDaNoite: Date): number {
  const ms = new Date(n.onsetAt).getTime();
  if (!Number.isFinite(ms)) {
    throw new RangeError(`onsetAt não é um instante: '${String(n.onsetAt)}' (noite de ${String(n.wakeDay)})`);
  }
  if (typeof n.tzOffset !== 'number' || !Number.isFinite(n.tzOffset)) {
    throw new RangeError(`tzOffset não é um número: '${String(n.tzOffset)}' (noite de ${String(n.wakeDay)})`);
  }
  if (Math.abs(n.tzOffset) > TZ_OFFSET_MAX_MIN) {
    throw new RangeError(
      `tzOffset fora de ±${TZ_OFFSET_MAX_MIN} min: '${String(n.tzOffset)}' (noite de ${String(n.wakeDay)})`,
    );
  }
  if (Math.abs(ms - fimDaNoite.getTime()) > DESVIO_MAXIMO_DO_ONSET_MS) {
    throw new RangeError(
      `onsetAt '${String(n.onsetAt)}' não é da noite de '${String(n.wakeDay)}': ` +
        `${Math.round(Math.abs(ms - fimDaNoite.getTime()) / 86_400_000)} dias de distância`,
    );
  }
  return axisPosition(n.onsetAt, n.tzOffset, SLEEP_AXIS_ORIGIN_H) * 60;
}

/** O número com a unidade do motivo colada nele — nunca um sem o outro. */
function oQueFalta(motivo: MotivoDoInconclusivo, quanto: number | null): OQueFalta | null {
  return quanto === null ? null : { quanto, unidade: UNIDADE_DO_MOTIVO[motivo] };
}

function inconclusivo(
  linha: LinhaDoProtocolo,
  motivo: MotivoDoInconclusivo,
  contagem: { noitesDentro: number; noitesFora: number; ciclos: number },
  quantoFalta: number | null,
): ResultadoDaFase {
  return {
    fase: linha.fase,
    familia: linha.familia,
    alfa: linha.alfa,
    lateralidade: linha.lateralidade,
    direcao: linha.direcao,
    veredito: 'inconclusivo',
    motivo,
    portaoReprovado: motivo === 'poder' ? null : motivo,
    efeitoMin: null,
    p: null,
    zDeMannWhitney: null,
    poder: null,
    efeitoMinimoDetectavelMin: null,
    ...contagem,
    falta: oQueFalta(motivo, quantoFalta),
    noitesPara80: null,
  };
}

/**
 * O efeito está na direção que a linha pré-registrou?
 *
 * `direcao: null` é "as duas contam" — o bilateral das três. `'atraso'` é a cheia, e
 * lá só o **positivo** conta: a §3 de 07/09 pré-registrou o atraso, com mecanismo e
 * direção tirados da literatura, e um adiantamento de quarenta minutos não é o achado
 * dela. O Mann–Whitney unilateral já empurra o p para perto de 1 no sentido oposto,
 * mas isso é **consequência da lateralidade** — ler a direção é o que impede que uma
 * linha unilateral com a direção errada passasse despercebida, e é o que faz o campo
 * ser invariante cobrada em vez de comentário.
 */
function naDirecaoDeclarada(direcao: LinhaDoProtocolo['direcao'], efeitoMin: number): boolean {
  return direcao === null || efeitoMin > 0;
}

function rodarLinha(
  linha: LinhaDoProtocolo,
  resolvidas: readonly NoiteResolvida[],
  residuos: readonly number[] | null,
  sdMarginal: number | null,
  noitesSemLuz: number,
): ResultadoDaFase {
  const dentro: number[] = [];
  const fora: number[] = [];
  const ciclosDistintos = new Set<number>();
  for (let i = 0; i < resolvidas.length; i += 1) {
    const r = resolvidas[i];
    // O resíduo só existe quando a luz passou; as contagens valem sempre.
    const v = residuos === null ? Number.NaN : residuos[i];
    if (r.janela !== null && r.janela.fase === linha.fase) {
      // `getTime()`, e não o próprio `Date`: cada chamada da efeméride devolve um
      // objeto novo, e um `Set<Date>` contaria cada noite como um ciclo.
      ciclosDistintos.add(r.janela.instante.getTime());
      dentro.push(v);
    } else {
      fora.push(v);
    }
  }
  const contagem = {
    noitesDentro: dentro.length,
    noitesFora: fora.length,
    ciclos: ciclosDistintos.size,
  };

  // Portão 1 — a luz. Global às quatro: é pré-requisito do §3, não ressalva, e
  // vem antes da amostra para que um buraco de covariável nunca saia disfarçado
  // de coluna curta.
  if (noitesSemLuz > 0) return inconclusivo(linha, 'luz', contagem, noitesSemLuz);

  // Portão 2 — cinco noites em cada coluna.
  const faltaDentro = Math.max(0, NOITES_MINIMAS_POR_COLUNA - contagem.noitesDentro);
  const faltaFora = Math.max(0, NOITES_MINIMAS_POR_COLUNA - contagem.noitesFora);
  if (faltaDentro + faltaFora > 0) {
    return inconclusivo(linha, 'amostra', contagem, faltaDentro + faltaFora);
  }

  // Portão 3 — dez ciclos sinódicos contribuindo com ao menos uma noite.
  if (contagem.ciclos < CICLOS_MINIMOS) {
    return inconclusivo(linha, 'ciclos', contagem, CICLOS_MINIMOS - contagem.ciclos);
  }

  const par: ParametrosDePoder = {
    sdMin: sdMarginal ?? Number.NaN,
    noitesDentro: contagem.noitesDentro,
    noitesFora: contagem.noitesFora,
    alfa: linha.alfa,
    lateralidade: linha.lateralidade,
  };
  const poder = poderLunar(par);
  const efeitoMin = hodgesLehmann(dentro, fora);
  const { p, z } = mannWhitney(dentro, fora, linha.lateralidade);
  const comum = {
    fase: linha.fase,
    familia: linha.familia,
    alfa: linha.alfa,
    lateralidade: linha.lateralidade,
    direcao: linha.direcao,
    portaoReprovado: null,
    efeitoMin,
    p,
    zDeMannWhitney: z,
    poder,
    efeitoMinimoDetectavelMin: efeitoMinimoDetectavel(par),
    ...contagem,
    noitesPara80: noitesParaPoder(par),
  };

  // Portão 4 — o poder, que é portão e não desempate. Vem ANTES de significância e
  // de limiar: um significante sem poder não vira nada, vira inconclusivo.
  //
  // Efeito, p e poder continuam aqui, e não viram `null`: a regra do nulo é a dos
  // três portões da §4, onde nada chegou a ser medido. Aqui foi, e o poder medido é
  // justamente a razão do veredito — apagá-lo apagaria a explicação. Quem imprime
  // um `inconclusivo` imprime quantas noites faltam (§5), não o efeito.
  if (poder === null || poder < PODER_MINIMO) {
    const total = contagem.noitesDentro + contagem.noitesFora;
    const alvo = noitesParaPoder(par);
    // Nunca zero: o portão acabou de dizer que o acervo não basta, e "faltam 0
    // noites" contradiria a frase seguinte da mesma página. Com a conta contínua
    // isto só empataria por arredondamento, e é aí que o piso de 1 vale.
    return {
      ...comum,
      veredito: 'inconclusivo',
      motivo: 'poder',
      falta: oQueFalta('poder', alvo === null ? null : Math.max(1, alvo - total)),
    };
  }

  const significante = p < linha.alfa;
  const passaLimiar = Math.abs(efeitoMin) >= LIMIAR_PRATICO_MIN;
  const naDirecao = naDirecaoDeclarada(linha.direcao, efeitoMin);
  return {
    ...comum,
    veredito: significante && passaLimiar && naDirecao ? 'achado' : 'nenhum_padrao',
    motivo: null,
    falta: null,
  };
}

/**
 * O veredito das quatro fases, numa chamada — a **porta única** da §9.
 *
 * Lança `RangeError` no que **não é dado**, e só nisso: `wakeDay` torto (via
 * `instanteDaNoite`), `wakeDay` repetido no acervo, `onsetAt` que não é instante,
 * `onsetAt` a mais de dois dias da noite que ele diz ser, `tzOffset` que não é número
 * e `tzOffset` fora de ±840 min. Não lança em acervo vazio, em luz ausente nem em
 * coluna curta: essas são respostas, e a resposta é `inconclusivo` com o motivo dito.
 *
 * A divisa entre as duas listas é o que a §4 chama de portão. Um portão é uma
 * condição do **acervo**, que mais noites resolvem; um `RangeError` é entrada que não
 * descreve noite nenhuma, e que nenhuma coleta conserta.
 *
 * O que o resultado **não** traz, de propósito: nada por noite, nenhuma mediana por
 * coluna e nenhum secundário. Duração, latência e despertares são exploratórios para
 * a cheia (§6 de 07/09) e não existem para as três (§8 de 28/09).
 */
export function vereditoLunar(noites: readonly NoiteLunarMedida[]): VereditoLunarCompleto {
  const resolvidas: NoiteResolvida[] = noites.map((n) => {
    const fimDaNoite = instanteDaNoite(n.wakeDay);
    return {
      wakeDay: n.wakeDay,
      janela: resolverFase(fimDaNoite),
      posicao: posicaoNoEixo(n, fimDaNoite),
      luzH: luzUtilizavel(n.luzH),
    };
  });

  const semLuz = resolvidas.filter((r) => r.luzH === null);
  // Ordenado: `de`/`ate` são o intervalo do acervo, não as pontas da lista recebida —
  // ninguém prometeu que ela chega em ordem, e uma lista embaralhada daria um
  // "intervalo" que não contém metade das noites.
  const dias = resolvidas.map((r) => r.wakeDay).sort();
  const noitesDistintas = new Set(dias).size;
  if (noitesDistintas !== resolvidas.length) {
    // **Recusar, e não deduplicar.** Duas linhas com o mesmo `wakeDay` são duas
    // medições da mesma noite: escolher uma em silêncio é escolher um desfecho, e a
    // duplicata que passasse entraria nas duas colunas contando como informação nova
    // — ela **infla o poder**, que é o erro que os dois pré-registros tratam como o
    // grave (a §5 de 07/09 chama transformar silêncio em informação de "mentir com o
    // mesmo tom de voz"). Quem chama sabe qual das duas medições vale; aqui não dá
    // para saber, e não dá para adivinhar sem mexer no resultado do teste.
    const repetido = dias.find((d, i) => i > 0 && d === dias[i - 1]) ?? '';
    throw new RangeError(
      `o acervo tem o wakeDay '${repetido}' mais de uma vez: ${resolvidas.length} noites, ` +
        `${noitesDistintas} distintas — duplicata infla poder e não se deduplica aqui`,
    );
  }
  const eixo = desdobrarEixo(resolvidas.map((r) => r.posicao));
  const sdMarginal = resolvidas.length >= 2 ? stdDev(eixo.valores) : null;
  const residuos =
    semLuz.length === 0 && resolvidas.length > 0
      ? residuosDaLuz(eixo.valores, resolvidas.map((r) => r.luzH as number))
      : null;

  const acervo: AcervoLunar = {
    noites: resolvidas.length,
    noitesDistintas,
    de: dias[0] ?? null,
    ate: dias[dias.length - 1] ?? null,
    sdMin: sdMarginal,
    origemDoEixoH: eixo.origemH,
    noitesSemLuz: semLuz.length,
    primeiraNoiteSemLuz: semLuz[0]?.wakeDay ?? null,
  };

  // As quatro escritas uma a uma, e não por `map`: é o que faz a tupla ser tupla sem
  // `as`, e é a forma da §9 — quatro chamadas numa execução, nunca uma.
  const rodar = (linha: LinhaDoProtocolo): ResultadoDaFase =>
    rodarLinha(linha, resolvidas, residuos, sdMarginal, semLuz.length);
  const fases: QuatroResultados = [
    rodar(PROTOCOLO_LUNAR[0]),
    rodar(PROTOCOLO_LUNAR[1]),
    rodar(PROTOCOLO_LUNAR[2]),
    rodar(PROTOCOLO_LUNAR[3]),
  ];

  return { fases, acervo };
}
