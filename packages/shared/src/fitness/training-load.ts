/**
 * ACWR, monotonia e strain: a carga está subindo rápido demais?
 *
 * ## A pergunta que a curva de forma não responde
 *
 * `form-curve.ts` diz se o atleta está **fresco ou enterrado** — a diferença
 * entre o que foi construído e o que está pesando. Ela não diz duas outras
 * coisas, e as duas são de literatura aberta:
 *
 * 1. **O salto.** Uma semana muito acima da base é o preditor clássico de lesão,
 *    e o saldo da curva não a distingue de uma semana pesada dentro do costume.
 * 2. **A textura.** Sete dias iguais e sete dias com um pico e dois de descanso
 *    podem somar a mesma carga semanal e cobrar coisas diferentes. É a
 *    **monotonia** de Foster, e o **strain** que ela multiplica.
 *
 * Este módulo é puro e trabalha em cima do que a curva já produziu: entra a
 * `series` de `buildFormCurve` (um ponto por dia local, do mais antigo a hoje,
 * dia parado como zero), sai objeto. Sem rede, sem tabela, sem UI, e **sem
 * recalcular carga** — a carga do dia é o `dailyLoadMin` que já veio pronto.
 *
 * ## A unidade
 *
 * Tudo aqui está em **minutos ponderados do dia**, a escala de `dailyLoadMin`.
 * Não é o minuto de esforço da OMS de `who-activity.ts`/`weekly-load.ts`: aquele
 * responde "bati o mínimo de saúde?", com os pesos da
 * [ADR 0002](../../../../docs/decisions/0002-minutos-de-esforco-ancorados-no-vigoroso.md),
 * e este responde "quanto isso me cobra de recuperação?", com os pesos próprios
 * da [ADR 0025](../../../../docs/decisions/0025-carga-de-treino-tem-pesos-proprios.md).
 * Somar um com o outro, ou comparar um número daqui com a meta semanal, é erro
 * de unidade. O ACWR é uma **razão** e por isso sobrevive à troca de unidade; a
 * monotonia também. O `strain` e o `weeklyLoad`, não — só se comparam com eles
 * mesmos ao longo do tempo.
 *
 * ## Por que o desacoplado é o padrão
 *
 * Na forma clássica ("acoplada") os 7 dias da aguda estão **dentro** dos 28 da
 * crônica: o numerador entra no denominador. Isso cria correlação espúria — o
 * índice é puxado para 1 por construção e amortece justamente o pico que ele
 * deveria denunciar. É a crítica central de Impellizzeri e colegas. A forma
 * **desacoplada** usa os dias 8 a 28 como base, e é a que este módulo devolve em
 * `acwr`. A acoplada fica ao lado, em `acwrCoupled`, para comparar com
 * ferramentas que só publicam aquela. Ver
 * [ADR 0027](../../../../docs/decisions/0027-acwr-desacoplado-e-faixas-contestadas.md).
 *
 * ## As faixas são orientação, não diagnóstico
 *
 * "Zona ideal" de 0,8 a 1,3, risco acima de 1,5, monotonia de alerta acima de 2:
 * são números de estudos cujo desenho é contestado (amostras pequenas, esporte
 * único, sem controle de carga acumulada). Estão aqui como constantes exportadas
 * e nomeadas para não virarem número solto no meio de um `if` — mas quem exibe
 * precisa dizer que são orientação. O corpo não muda de regime em 1,4999.
 *
 * **E há um descompasso que a revisão levantou e que não se resolve com escolha
 * de número:** essas fronteiras foram calibradas sobre o ACWR **acoplado**, que é
 * a forma que os estudos usavam, enquanto o número classificado aqui é o
 * desacoplado. O desacoplado é mais sensível — na mesma semana ele pode marcar
 * 6,0 onde o acoplado marca 2,7 —, então a faixa `risk` acende com mais
 * frequência do que a taxa de base da literatura sugere. Manter as fronteiras
 * originais e avisar é mais honesto que inventar fronteiras novas sem estudo que
 * as sustente. Quem exibir deve tratar a faixa como direção, não como veredito.
 *
 * ## Limites
 *
 * A confiança é declarada, não consertada: `shortWindow` quando o histórico é
 * menor que a janela crônica, e `acuteDays`/`chronicDays` dizem quantos dias
 * cada janela realmente teve.
 *
 * **Idade do dado não se avalia aqui**, e o modo de falha é traiçoeiro: silêncio
 * de sincronização chega nesta série como zeros indistinguíveis de descanso, e
 * zeros na janela aguda empurram o ACWR para **baixo**, ou seja, para
 * `undertraining` — a faixa mais tranquilizadora da escala. Sync parado se
 * disfarça de semana leve. Quem responde por isso é o `trusted` de
 * `buildFormCurve`; **quem exibe precisa olhar os dois**, e não mostrar faixa
 * nenhuma com dado velho.
 *
 * **O último ponto da série é intradiário.** `buildFormCurve` termina em hoje, e
 * hoje ainda não fechou. Esse dia parcial entra só na janela aguda, nunca na
 * crônica desacoplada, então de manhã o ACWR lê mais baixo e sobe ao longo do dia
 * sem que nada tenha mudado no treino. É viés sistemático, pequeno numa semana de
 * sete dias, mas real.
 *
 * **Quem volta de um período parado fica sem número.** Quatro semanas de zero e
 * uma semana de treino dão `acwr: null`, porque a base é zero — justamente o
 * salto que a métrica existe para enxergar. É a resposta matematicamente correta,
 * e é também o caso em que a UI mais precisa dizer algo em vez de nada.
 */
import { FORM_FATIGUE_DAYS, type FormCurveDay } from './form-curve';

/**
 * Janela aguda (dias): o que se fez na última semana.
 *
 * É `FORM_FATIGUE_DAYS`, a mesma janela do cansaço da curva de forma, e de
 * propósito: as duas medem "o que está pesando agora", e duas janelas diferentes
 * para a mesma coisa fariam o cartão contar duas histórias.
 */
export const ACWR_ACUTE_DAYS = FORM_FATIGUE_DAYS;

/** Janela crônica (dias): quatro semanas, o padrão da literatura de ACWR. */
export const ACWR_CHRONIC_DAYS = 28;

/**
 * As fronteiras das faixas de ACWR — **orientação, não diagnóstico**.
 *
 * Vêm da literatura de carga (Gabbett e derivados) e são contestadas: o desenho
 * dos estudos originais é discutido, e nenhuma delas é lei da natureza. Estão
 * exportadas para que a UI classifique com o mesmo número que o teste, e para
 * que mudá-las seja uma edição visível num lugar só.
 *
 * A faixa de baixo é sempre **inclusiva** no limite: 0,8 é `optimal`, 1,3 é
 * `optimal`, 1,5 é `caution`. `risk` começa estritamente acima de 1,5.
 */
export const ACWR_BANDS = Object.freeze({
  /** Abaixo disto a semana ficou muito abaixo da base — subcarga/destreino. */
  undertrainingBelow: 0.8,
  /** Teto da faixa dita "ideal". */
  optimalMax: 1.3,
  /** Teto da atenção; acima disto a literatura fala em risco elevado. */
  cautionMax: 1.5,
} as const);

/** Faixa interpretativa do ACWR. */
export type AcwrBand = 'undertraining' | 'optimal' | 'caution' | 'risk';

/**
 * Monotonia a partir da qual a semana é considerada monótona demais — o valor
 * que a literatura de Foster associa a mais queixas. Mesma ressalva: orientação.
 */
export const MONOTONY_ALERT = 2;

/** Faixa interpretativa da monotonia. */
export type MonotonyBand = 'varied' | 'monotonous';

export interface TrainingLoadOptions {
  /**
   * Janela aguda, em dias. Padrão `ACWR_ACUTE_DAYS` (7). Valor não inteiro é
   * truncado; menor que 1, não finito ou ausente cai no padrão.
   */
  acuteDays?: number;
  /**
   * Janela crônica, em dias. Padrão `ACWR_CHRONIC_DAYS` (28). Precisa ser
   * **maior** que a aguda: se não for, não sobra dia para a base desacoplada e
   * tanto `acwr` quanto `acwrCoupled` saem `null`.
   */
  chronicDays?: number;
}

/** Por que `monotony` veio `null`. As três razões pedem textos diferentes. */
export type MonotonyReason =
  /** Semana perfeitamente constante: desvio zero com carga. A razão é indefinida
   *  (divisão por zero), mas o significado não — é o extremo da monotonia, e
   *  `monotonyBand` diz `monotonous`. */
  | 'constant'
  /** Semana inteira parada: média e desvio zero. Não há textura a medir. */
  | 'idle'
  /** A janela aguda não encheu — menos dias que `acuteDays`. */
  | 'shortWeek';

export interface TrainingLoad {
  /**
   * ACWR **desacoplado** — o número padrão. Média diária da janela aguda dividida
   * pela média diária dos dias 8 a `chronicDays`.
   *
   * `null` quando a base é zero (28 dias parados) ou quando não há dia nenhum
   * fora da janela aguda (histórico com menos de 8 dias). Nunca `Infinity`,
   * nunca `NaN`.
   */
  acwr: number | null;
  /**
   * ACWR **acoplado** — a forma clássica, com a aguda dentro da crônica. Exposto
   * para comparar com ferramentas que publicam só esta.
   *
   * Com histórico menor que a janela aguda as duas fatias são a mesma, e este
   * número vale 1 por construção. É o acoplamento na sua forma extrema, e a razão
   * de o padrão ser o outro.
   */
  acwrCoupled: number | null;
  /**
   * Faixa do `acwr` desacoplado; `null` quando ele é `null`.
   *
   * Também `null` quando as janelas não são as padrão: as fronteiras foram
   * calibradas para 7 contra 28, e classificar uma janela de 14 dias com elas
   * seria emprestar autoridade que o número não tem.
   */
  band: AcwrBand | null;
  /** Soma da carga dos dias da janela aguda, em minutos. `null` com janela vazia. */
  weeklyLoad: number | null;
  /** Média diária da janela aguda, em minutos. `null` com janela vazia. */
  acuteLoad: number | null;
  /** Média diária da crônica desacoplada (dias 8 a N). `null` com janela vazia. */
  chronicLoad: number | null;
  /** Média diária da crônica acoplada (dias 1 a N). `null` com janela vazia. */
  chronicLoadCoupled: number | null;
  /**
   * Monotonia de Foster: média dividida pelo desvio-padrão da carga diária da
   * janela aguda. Quanto maior, mais iguais foram os dias.
   *
   * `null` quando o desvio é zero (semana constante — inclusive a semana toda
   * parada, em que a razão seria 0/0) ou quando a janela aguda não está cheia.
   * Exigir a semana inteira é o que impede uma "monotonia" de três dias.
   *
   * O desvio é **populacional** (divide por n): os sete dias *são* a semana, não
   * uma amostra dela. Trocar por amostral (n−1) infla o desvio e derruba a
   * monotonia em ~8% — mudaria toda classificação de faixa, calada.
   */
  monotony: number | null;
  /**
   * Por que `monotony` é `null`; `null` quando ela tem valor.
   *
   * Sem isto, "semana perfeitamente uniforme" (o extremo que o índice de Foster
   * existe para denunciar) e "semana inteira de descanso" chegariam ao cartão
   * como o mesmo `null`.
   */
  monotonyReason: MonotonyReason | null;
  /**
   * Faixa da monotonia. `monotonous` também quando a semana foi constante e a
   * razão é indefinida — ali o `null` do número não é ausência de informação.
   * `null` fora das janelas padrão, pelo mesmo motivo de `band`.
   */
  monotonyBand: MonotonyBand | null;
  /**
   * Strain de Foster: `weeklyLoad × monotony`. A mesma carga semanal cobra mais
   * quando é distribuída de forma monótona.
   *
   * `null` sempre que a monotonia for `null`. A unidade é arbitrária (minutos
   * ponderados × uma razão) — só se compara consigo mesmo ao longo do tempo.
   */
  strain: number | null;
  /**
   * Dias na série **recebida** — e não a idade do histórico do atleta.
   *
   * Nome diferente do `historyDays` de `FormCurve` de propósito: lá é a distância
   * da primeira atividade até hoje; aqui é o tamanho da fatia que chegou, e
   * `buildFormCurve` corta a série em `FORM_SERIES_DAYS` (90). Um atleta de cinco
   * anos entrega `curve.historyDays` na casa dos milhares e `seriesDays` 90. Os
   * dois num cartão só, com o mesmo nome, contariam histórias diferentes.
   */
  seriesDays: number;
  /** Dias efetivamente disponíveis na janela aguda (≤ `acuteDays`). */
  acuteDays: number;
  /** Dias efetivamente disponíveis na crônica desacoplada. */
  chronicDays: number;
  /**
   * A série recebida é menor que a janela crônica — o denominador ainda não é uma
   * base, e o ACWR está imaturo. Quem exibe deve dizer isso, não escondê-lo.
   *
   * Mede a **fatia**, não a maturidade do atleta: quem chamar `buildFormCurve`
   * com `seriesDays` curto levanta esta flag mesmo com anos de histórico.
   */
  shortWindow: boolean;
}

/**
 * Janela válida ou o padrão. `NaN`, `Infinity`, zero e negativo cairiam em
 * `slice(-0)` — que devolve a **série inteira**, não uma fatia vazia — ou em
 * fatia pelo começo.
 *
 * **Trunca antes de validar**, e a ordem é o ponto: validar primeiro deixaria
 * passar `0,5`, que vira 0 no truncamento e reabre exatamente o `slice(-0)` que
 * esta guarda existe para fechar. Difere da guarda homônima de `form-curve.ts`,
 * que não trunca porque lá a janela só alimenta um alpha.
 */
function windowOr(value: number | undefined, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  const days = Math.floor(value);
  return days >= 1 ? days : fallback;
}

/**
 * Carga do dia, saneada. Não finito e negativo viram zero: um `NaN` que entrasse
 * contaminaria média, desvio e razão de uma vez, e sairia como `NaN` no cartão.
 *
 * O `d?.` não é redundância: o tipo proíbe entrada nula, mas o núcleo é
 * consumido por JavaScript sem tipos (a edge function, um `JSON.parse`), e um
 * furo no array chega aqui como `undefined`. Vira dia de descanso, que é a
 * leitura menos surpreendente — mas é uma escolha, não um acidente.
 */
function loadOf(d: FormCurveDay | undefined): number {
  const v = d?.dailyLoadMin;
  return typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : 0;
}

function sum(values: readonly number[]): number {
  let total = 0;
  for (const v of values) total += v;
  return total;
}

/**
 * Média, ou `null` quando não há dia nenhum na janela — ou quando a soma estoura
 * para `Infinity`. O módulo promete nunca devolver não finito, e a promessa vale
 * até para entrada absurda.
 */
function mean(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  const m = sum(values) / values.length;
  return Number.isFinite(m) ? m : null;
}

/**
 * Razão segura: `null` em vez de `Infinity`/`NaN` quando falta o numerador, falta
 * o denominador, ou o denominador é zero. É a regra que impede um "∞" de chegar
 * à tela quando alguém volta de quatro semanas parado.
 */
function ratio(numerator: number | null, denominator: number | null): number | null {
  if (numerator === null || denominator === null || denominator <= 0) return null;
  const r = numerator / denominator;
  return Number.isFinite(r) ? r : null;
}

/**
 * Desvio-padrão populacional (divide por n). Ver o docblock de `monotony`.
 * `null` quando a conta estoura — devolver 0 ali faria uma semana absurda passar
 * por perfeitamente constante.
 */
function stdDev(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  const avg = sum(values) / values.length;
  let acc = 0;
  for (const v of values) acc += (v - avg) ** 2;
  const sd = Math.sqrt(acc / values.length);
  return Number.isFinite(sd) ? sd : null;
}

/** A faixa de um ACWR, pelas fronteiras de `ACWR_BANDS`. `null` entra `null`. */
export function acwrBandOf(acwr: number | null): AcwrBand | null {
  if (acwr === null || !Number.isFinite(acwr)) return null;
  if (acwr < ACWR_BANDS.undertrainingBelow) return 'undertraining';
  if (acwr <= ACWR_BANDS.optimalMax) return 'optimal';
  if (acwr <= ACWR_BANDS.cautionMax) return 'caution';
  return 'risk';
}

/** A faixa de uma monotonia, por `MONOTONY_ALERT`. `null` entra `null`. */
export function monotonyBandOf(monotony: number | null): MonotonyBand | null {
  if (monotony === null || !Number.isFinite(monotony)) return null;
  return monotony > MONOTONY_ALERT ? 'monotonous' : 'varied';
}

/**
 * @param series A `series` de `buildFormCurve` — um ponto por dia local, do mais
 *   antigo ao mais recente, terminando hoje, com dia parado como zero. A ordem e
 *   a continuidade são contrato: as janelas são fatias do **fim** da série, e
 *   contam posições, não datas. Uma série fora de ordem ou com buracos produz
 *   números sem sentido; `buildFormCurve` garante as duas coisas, e é por isso
 *   que a entrada é a série dela e não uma lista qualquer.
 *
 * Puro e determinístico: a mesma série produz um resultado igual, e a entrada
 * nunca é modificada. Não lança para nenhuma entrada — série vazia, ausente ou
 * com furos devolve o objeto vazio.
 */
export function buildTrainingLoad(
  series: readonly FormCurveDay[],
  options: TrainingLoadOptions = {},
): TrainingLoad {
  // Defesa de runtime: o tipo exige os dois, mas o núcleo é chamado de código
  // sem tipos, e "não lança nunca" precisa valer lá também.
  const days: readonly FormCurveDay[] = Array.isArray(series) ? series : [];
  const opts = options ?? {};

  const acuteWindow = windowOr(opts.acuteDays, ACWR_ACUTE_DAYS);
  const chronicWindow = windowOr(opts.chronicDays, ACWR_CHRONIC_DAYS);
  // Fora das janelas padrão as fronteiras de faixa perdem a base — ver `band`.
  const defaultWindows = acuteWindow === ACWR_ACUTE_DAYS && chronicWindow === ACWR_CHRONIC_DAYS;

  // `Array.from` e não `map`: `map` preserva furos do array, e um furo escaparia
  // do laço como `undefined` para dentro das contas.
  const loads = Array.from(days, loadOf);

  // As três fatias. A desacoplada é o miolo: dias 8 a 28, sem os da aguda.
  // `slice(-28, -7)` com série curta clamps para vazio, que vira `null` adiante.
  const acute = loads.slice(-acuteWindow);
  const chronicCoupled = loads.slice(-chronicWindow);
  const chronicUncoupled = loads.slice(-chronicWindow, -acuteWindow);

  const acuteLoad = mean(acute);
  const chronicLoad = mean(chronicUncoupled);
  const chronicLoadCoupled = mean(chronicCoupled);

  const acwr = ratio(acuteLoad, chronicLoad);
  // Quando a fatia acoplada é a mesma da aguda — histórico curto, ou uma janela
  // crônica que não é maior que a aguda — a razão vale 1 por construção. Devolver
  // esse 1 seria publicar o artefato do acoplamento como se fosse medida.
  const coupledIsAcute = chronicCoupled.length <= acute.length;
  const acwrCoupled = coupledIsAcute ? null : ratio(acuteLoad, chronicLoadCoupled);

  // Monotonia só com a semana cheia: com três dias, "média sobre desvio" é uma
  // razão de três números, não a textura de uma semana.
  const weeklyLoad = acute.length === 0 ? null : sum(acute);
  const sd = acute.length === acuteWindow ? stdDev(acute) : null;
  const monotony = ratio(acuteLoad, sd);

  let monotonyReason: MonotonyReason | null = null;
  if (monotony === null) {
    if (acute.length !== acuteWindow) monotonyReason = 'shortWeek';
    else if (sd === 0) monotonyReason = (acuteLoad ?? 0) > 0 ? 'constant' : 'idle';
    // Resta só o desvio estourar para não finito, o que exige carga impossível
    // (o dia tem 1440 minutos). Sem textura utilizável: lê como semana parada.
    else monotonyReason = 'idle';
  }

  const strain = monotony === null || weeklyLoad === null ? null : weeklyLoad * monotony;

  // Semana constante é o extremo da monotonia, não ausência dela: o número é
  // indefinido, o significado não.
  const monotonyBand: MonotonyBand | null = !defaultWindows
    ? null
    : monotonyReason === 'constant'
      ? 'monotonous'
      : monotonyBandOf(monotony);

  return {
    acwr,
    acwrCoupled,
    band: defaultWindows ? acwrBandOf(acwr) : null,
    weeklyLoad,
    acuteLoad,
    chronicLoad,
    chronicLoadCoupled,
    monotony,
    monotonyReason,
    monotonyBand,
    strain,
    seriesDays: days.length,
    acuteDays: acute.length,
    chronicDays: chronicUncoupled.length,
    shortWindow: days.length < chronicWindow,
  };
}
