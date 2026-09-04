/**
 * Curva de forma: o que foi construído contra o que está pesando hoje.
 *
 * ## A pergunta que faltava
 *
 * O Orbe já sabia dizer *quanto* se treinou na semana (`weekly-load.ts`) e *como
 * o corpo amanheceu* (`readiness.ts`). Nenhum dos dois responde "estou fresco ou
 * estou enterrado?" — porque essa resposta não está num dia nem numa semana, e
 * sim na **diferença entre duas velocidades**: o que o treino construiu ao longo
 * de semanas (lento) contra o que ele cobrou nos últimos dias (rápido).
 *
 * É a análise que a Strava vende e que intervals.icu e Runalyze dão de graça,
 * com receita pública. Aqui ela é um módulo puro: entra `Activity[]` e um `now`,
 * sai objeto. Sem rede, sem tabela, sem UI.
 *
 * ## Como funciona
 *
 * 1. Cada atividade vira uma **carga** (`activityLoad`), em segundos ponderados
 *    pela intensidade — ver `FORM_ZONE_WEIGHTS`.
 * 2. As cargas são somadas **por dia local**, e os dias sem treino entram como
 *    zero. Descanso é informação: pular o dia parado seria o mesmo que fingir
 *    que a semana teve três dias.
 * 3. Duas médias exponenciais correm sobre essa série diária — 42 dias (a
 *    **base**) e 7 dias (o **cansaço**) — e o **saldo** é `base - cansaço`.
 *    Negativo = enterrado; positivo = fresco, o estado do polimento.
 *
 * ## O alpha
 *
 * `alpha = 1 - e^(-1/n)`, a convenção da literatura de carga de treino — a mesma
 * família de convenção que intervals.icu e TrainingPeaks usam. O que isso alinha
 * é a **velocidade** da curva, não os valores: os números daqui não são
 * comparáveis com TSS nem com os minutos de esforço da OMS, porque a unidade de
 * carga é outra. Eles só se comparam com eles mesmos ao longo do tempo, que é
 * para o que `typical` existe. Não é a convenção comum de EWMA financeira:
 *
 * ```
 * 1 - e^(-1/42) ≈ 0,0235        2/(42+1) ≈ 0,0465
 * ```
 *
 * A segunda é o **dobro** da velocidade. Trocar uma pela outra não quebra nada
 * visivelmente — só faz a curva inteira reagir em metade do tempo, calada.
 *
 * ## Escala equivalente-semanal, em minutos
 *
 * A carga nasce em segundos ponderados e as médias correm sobre segundos por
 * dia, mas a saída sai em **minutos equivalentes por semana**
 * (`FORM_WEEKLY_MINUTES` = 7/60). O hábito do app é a meta *semanal em minutos*
 * (`DEFAULT_WEEKLY_TARGET_MIN`), e "500 s por dia" não diz nada a quem pensa em
 * "95 min por semana". A conversão não muda o saldo (é a mesma constante nos
 * dois lados), só o vocabulário. Na série, `dailyLoadMin` fica em minutos **do
 * dia**, sem o ×7 — é o que um gráfico de barras diárias desenha.
 *
 * ## A partida do zero
 *
 * As duas médias começam em 0, não no primeiro valor da série. Quem acabou de
 * conectar o relógio tem a base ainda subindo do chão e o cansaço já saturado,
 * o que **infla o saldo negativo** nas primeiras semanas. Isso não é consertado
 * — é declarado, em `shortWindow`. Semear a média no primeiro dia esconderia o
 * problema em vez de resolvê-lo, e faria o número parecer maduro no dia 3.
 *
 * ## Limites
 *
 * O modelo é só de frequência cardíaca. Treino de força entra como duração ×
 * tipo, independentemente da intensidade, e **subconta** o custo de recuperação:
 * uma hora de agachamento pesado e uma hora de mobilidade valem o mesmo aqui.
 */
import type { Activity } from '../models';
import { activityWeight } from '../health/who-activity';
import { localDateStr } from '../date/local';

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Peso de cada zona de FC na **carga de treino**: quantos segundos de carga vale
 * cada segundo passado na zona.
 *
 * **Não são os `HR_ZONE_WEIGHTS` de `who-activity.ts`, e é de propósito** (ver
 * `docs/decisions/0025-carga-de-treino-tem-pesos-proprios.md`). Lá a pergunta é
 * "bati o mínimo de saúde da OMS?", z4 e z5 valem igual porque as duas são
 * "vigoroso", e nenhum peso pode passar de 1 — é o teto que mantém a linha de
 * esforço dentro da barra de duração no gráfico.
 *
 * Aqui a pergunta é **custo de recuperação**, e ela tem outro formato: tiro em z5
 * cobra mais que rodízio em z4, e uma hora de intervalado cobra mais que uma hora
 * de relógio. Por isso os pesos crescem no topo e **passam de 1**.
 *
 * A âncora é z3 = 1: um segundo de aeróbico é um segundo de carga. Daí o limiar
 * dobra e o máximo quase dobra de novo. Z1 não é zero — recuperação ativa mexe
 * pouco na fadiga, mas mexe.
 */
export const FORM_ZONE_WEIGHTS: Record<string, number> = {
  z1: 0.2,
  z2: 0.5,
  z3: 1,
  z4: 2,
  z5: 3.5,
};

/** Janela lenta padrão (dias): o que foi construído. */
export const FORM_BASE_DAYS = 42;
/** Janela rápida padrão (dias): o que está pesando. */
export const FORM_FATIGUE_DAYS = 7;
/** Janela do típico pessoal (dias). */
export const FORM_TYPICAL_DAYS = 90;
/** Quantos dias da série voltam para quem desenha (a EWMA aquece com tudo). */
export const FORM_SERIES_DAYS = 90;
/**
 * Dias sem nenhuma atividade a partir dos quais o resultado deixa de ser confiável.
 *
 * Atraso de até 3 dias não invalida a média — a curva foi feita para atravessar
 * descanso. A partir do quarto dia sem uma linha sequer, silêncio é
 * indistinguível de sincronização parada, e o número não pode mais ser exibido
 * como confiável: a curva leria o sync parado como descanso e o saldo subiria
 * sozinho. A regra dos 4 dias foi fechada na revisão de UX e é a mesma do
 * cartão, que degrada o número a partir daí; a constante do núcleo precisa bater
 * com ela.
 */
export const FORM_STALE_AFTER_DAYS = 4;
/** Segundos ponderados por dia → minutos equivalentes por semana. */
export const FORM_WEEKLY_MINUTES = 7 / 60;

/**
 * O alpha da média exponencial para uma janela de `days` dias.
 *
 * `1 - e^(-1/n)` — a convenção da literatura de carga, metade da velocidade do
 * `2/(n+1)` das médias exponenciais financeiras. Ver o cabeçalho do módulo.
 *
 * A guarda é só defensiva: `buildFormCurve` já normaliza as janelas antes de
 * chegar aqui.
 */
export function ewmaAlpha(days: number): number {
  if (!Number.isFinite(days) || days <= 0) return 1;
  return 1 - Math.exp(-1 / days);
}

/** Só as chaves próprias de `FORM_ZONE_WEIGHTS` são zona. */
function isZoneKey(key: string): boolean {
  return Object.hasOwn(FORM_ZONE_WEIGHTS, key);
}

function sumZones(zones: Record<string, number> | undefined): number {
  if (!zones) return 0;
  let total = 0;
  for (const [key, v] of Object.entries(zones)) {
    if (!isZoneKey(key) || !Number.isFinite(v) || v <= 0) continue;
    total += v;
  }
  return total;
}

/**
 * Carga de uma atividade, em segundos ponderados.
 *
 * Qual fonte manda é decidido por atividade, não por trecho:
 *
 * - **Com zonas de FC válidas** (`hrZones` com alguma chave conhecida > 0), as
 *   zonas mandam no trecho que cobrem, por `FORM_ZONE_WEIGHTS`. O resto da
 *   duração é cobrado a **z1**: com relógio medindo, tempo fora das zonas é
 *   aquecimento ou caminhada abaixo de 50% da reserva (onde z1 começa) ou lacuna
 *   de amostra — não é trecho "não medido". O jsonb pode somar mais que a
 *   duração (amostras sobrepostas de apps distintos); escalar mantém a proporção
 *   entre as zonas sem inflar o total.
 * - **Sem zona nenhuma**, o treino inteiro vira **estimativa por tipo**:
 *   `durationS × activityWeight(activityId)`, a tabela de MET que
 *   `effectiveSeconds` já usa. Nunca zero.
 *
 * Só chaves próprias de `FORM_ZONE_WEIGHTS` contam: uma chave desconhecida
 * (`total`, `constructor`…) não é cobertura nem recebe peso.
 *
 * **Sem o `Math.max` do `effectiveSeconds`, de propósito.** Lá a estimativa por
 * tipo vale para o treino inteiro porque a pergunta é da OMS, que os
 * questionários GPAQ/IPAQ respondem por tipo × duração, sem olhar FC — e sem ele
 * *gravar* FC valeria menos que não gravar. Aqui a pergunta é custo de
 * recuperação, e a resposta honesta é que três horas em z1 custam pouco: quando
 * há medição, ela manda. A estimativa fica só onde não há medição nenhuma, que é
 * onde ela é de fato um chute.
 *
 * Usa `durationS`, e não o tempo de movimento como `effectiveSeconds`: aqui não
 * há a invariante "esforço ≤ duração" para proteger, e o desconto das pausas já
 * vem de graça no trecho coberto pelas zonas.
 */
export function activityLoad(a: Activity): number {
  const durationS = a.durationS;
  if (!Number.isFinite(durationS) || durationS <= 0) return 0;

  const zones = a.hrZones;
  const rawZoneS = sumZones(zones);
  if (rawZoneS <= 0) return durationS * activityWeight(a.activityId);

  const scale = rawZoneS > durationS ? durationS / rawZoneS : 1;
  let byZones = 0;
  for (const [key, seconds] of Object.entries(zones ?? {})) {
    if (!isZoneKey(key) || !Number.isFinite(seconds) || seconds <= 0) continue;
    byZones += seconds * scale * FORM_ZONE_WEIGHTS[key];
  }

  const uncoveredS = durationS - Math.min(durationS, rawZoneS);
  // Colchete, não ponto: `FORM_ZONE_WEIGHTS` é um `Record<string, number>`, e a
  // web compila com `noPropertyAccessFromIndexSignature`. O núcleo e o mobile
  // não, então o acesso por ponto passava nos dois e só quebrava lá.
  return byZones + uncoveredS * FORM_ZONE_WEIGHTS['z1'];
}

/** Um dia da série. `base`/`fatigue`/`form` em escala equivalente-semanal. */
export interface FormCurveDay {
  /** 'YYYY-MM-DD' local. */
  day: string;
  /**
   * Carga do dia em minutos ponderados (0 = não treinou). Escala **diária**, em
   * minutos — `base`/`fatigue`/`form` neste mesmo objeto estão em escala
   * **semanal**. Não somar um com o outro.
   */
  dailyLoadMin: number;
  /** EWMA lenta até este dia, em minutos equivalentes por semana. */
  base: number;
  /** EWMA rápida até este dia, mesma escala. */
  fatigue: number;
  /** `base - fatigue`. */
  form: number;
}

export interface FormCurveOptions {
  /** Janela da base, em dias. Padrão `FORM_BASE_DAYS` (42). */
  baseDays?: number;
  /** Janela do cansaço, em dias. Padrão `FORM_FATIGUE_DAYS` (7). */
  fatigueDays?: number;
  /** Janela do típico pessoal, em dias. Padrão `FORM_TYPICAL_DAYS` (90). */
  typicalDays?: number;
  /** Quantos dias da série voltam em `series`. Padrão `FORM_SERIES_DAYS` (90). */
  seriesDays?: number;
  /** Silêncio a partir do qual `trusted` cai. Padrão `FORM_STALE_AFTER_DAYS` (4). */
  staleAfterDays?: number;
}

export interface FormCurve {
  /** O que foi construído: EWMA de `baseDays`, em minutos equivalentes por semana. */
  base: number;
  /** O que está pesando: EWMA de `fatigueDays`, mesma escala. */
  fatigue: number;
  /** `base - fatigue`. Negativo = enterrado, positivo = fresco. */
  form: number;
  /**
   * O típico pessoal — **mediana** dos últimos `typicalDays` dias, para dar
   * régua ao número de hoje ("+8 é muito para mim?"). É o traço em cada barra do
   * cartão: um em Base, um em Cansaço.
   *
   * Mediana e não média porque uma lesão de três semanas ou uma viagem derrubam
   * a média e passariam a chamar de "normal" um período em que nada aconteceu.
   *
   * A mediana inclui o período de aquecimento da média: só fica limpa por volta
   * de `typicalDays + baseDays` dias de histórico. Antes disso ela ainda está
   * medindo uma base que subia do zero.
   */
  typical: {
    base: number;
    fatigue: number;
    form: number;
  };
  /**
   * Um ponto por dia, do mais antigo ao mais recente, terminando **hoje**.
   *
   * Contém no máximo `seriesDays` dias — a EWMA aquece sobre o histórico inteiro,
   * só a fatia devolvida é cortada. Vazia quando não há nenhuma atividade.
   *
   * Hoje entra, ao contrário da grade de Consistência (que só mostra dias
   * fechados): a pergunta aqui é "estou fresco **agora**", e o treino da manhã
   * pesa na resposta da tarde. Por isso o último ponto é **intradiário**: antes
   * do treino do dia o cansaço já decaiu e o saldo lê mais fresco do que vai
   * fechar. Quem exibe não deve tratá-lo como valor fechado.
   */
  series: FormCurveDay[];
  /** Dias cobertos pela série completa, da primeira atividade até hoje. */
  historyDays: number;
  /** Dias desde a última atividade; `null` quando não há nenhuma. */
  daysSinceLastActivity: number | null;
  /**
   * Histórico menor que a janela da base — a base ainda está subindo do zero e
   * o saldo aparece inflado. Quem exibe deve dizer isso, não escondê-lo.
   *
   * A fronteira é grosseira de propósito: com `historyDays === baseDays` a média
   * está a ~63% do regime (86% em 2n, 95% em 3n). A flag marca "grosseiramente
   * imatura", não "aquecida".
   */
  shortWindow: boolean;
  /**
   * Há dado recente o bastante para o número valer.
   *
   * `false` quando não há atividade nenhuma ou quando a última é mais velha que
   * `staleAfterDays`. É independente de `shortWindow`: um é sobre a idade do
   * dado, o outro sobre o aquecimento da média. Confiança cheia é
   * `trusted && !shortWindow`.
   */
  trusted: boolean;
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * Janela válida ou o padrão. `Infinity`, `NaN`, zero e negativo caem no padrão
 * em vez de virar alpha 1, `slice(-0)` (a série inteira) ou fatia pelo começo.
 */
function windowOr(value: number | undefined, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : fallback;
}

function emptyCurve(): FormCurve {
  return {
    base: 0,
    fatigue: 0,
    form: 0,
    typical: { base: 0, fatigue: 0, form: 0 },
    series: [],
    historyDays: 0,
    daysSinceLastActivity: null,
    shortWindow: true,
    trusted: false,
  };
}

/**
 * @param now Instante de referência. O último dia da série é o dia local de
 *   `now`. Um `now` inválido devolve o mesmo objeto vazio da lista vazia.
 *
 * Puro e determinístico para um fuso fixo — o dia local é o do ambiente que
 * roda: mesmos `activities`, mesmo `now`, mesmo fuso, mesmo objeto.
 */
export function buildFormCurve(
  activities: readonly Activity[],
  options: FormCurveOptions = {},
  now: Date = new Date(),
): FormCurve {
  if (Number.isNaN(now.getTime())) return emptyCurve();

  const baseDays = windowOr(options.baseDays, FORM_BASE_DAYS);
  const fatigueDays = windowOr(options.fatigueDays, FORM_FATIGUE_DAYS);
  const typicalDays = windowOr(options.typicalDays, FORM_TYPICAL_DAYS);
  const seriesDays = windowOr(options.seriesDays, FORM_SERIES_DAYS);
  const staleAfterDays = windowOr(options.staleAfterDays, FORM_STALE_AFTER_DAYS);

  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayTime = today.getTime();

  // dia local → carga somada no dia
  const perDay = new Map<string, number>();
  let firstTime: number | null = null;
  let lastTime: number | null = null;
  for (const a of activities) {
    // Editado e apagado no HealthKit: fora de métricas, como em `consistency.ts`.
    if (a.hidden) continue;
    // `new Date(null)` é 1970, não NaN — o nulo precisa sair antes de virar data.
    if (a.startAt == null) continue;
    const at = new Date(a.startAt);
    if (Number.isNaN(at.getTime())) continue;
    const dayStart = new Date(at.getFullYear(), at.getMonth(), at.getDate());
    const t = dayStart.getTime();
    // Dia local depois de hoje é fuso torto na origem. Se contasse, `lastTime`
    // iria para o futuro e `trusted` mentiria; a série ganharia um dia que ainda
    // não existe.
    if (t > todayTime) continue;
    const key = localDateStr(dayStart);
    perDay.set(key, (perDay.get(key) ?? 0) + activityLoad(a));
    if (firstTime === null || t < firstTime) firstTime = t;
    if (lastTime === null || t > lastTime) lastTime = t;
  }

  // A série vai da primeira atividade até hoje. Sem atividade nenhuma ela é
  // vazia — 90 dias de zeros seriam um gráfico afirmando "parado" sobre um
  // período do qual não se sabe nada.
  const historyDays = firstTime === null ? 0 : Math.round((todayTime - firstTime) / DAY_MS) + 1;

  const alphaBase = ewmaAlpha(baseDays);
  const alphaFatigue = ewmaAlpha(fatigueDays);

  const full: FormCurveDay[] = [];
  let base = 0;
  let fatigue = 0;
  for (let i = historyDays - 1; i >= 0; i--) {
    // Aritmética de calendário, não de milissegundos: `d - i` atravessa horário
    // de verão sem escorregar um dia.
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i);
    const day = localDateStr(d);
    const loadS = perDay.get(day) ?? 0;
    base += alphaBase * (loadS - base);
    fatigue += alphaFatigue * (loadS - fatigue);
    full.push({
      day,
      dailyLoadMin: loadS / 60,
      base: base * FORM_WEEKLY_MINUTES,
      fatigue: fatigue * FORM_WEEKLY_MINUTES,
      form: (base - fatigue) * FORM_WEEKLY_MINUTES,
    });
  }

  const last = full[full.length - 1];
  const typicalSlice = full.slice(-typicalDays);
  const daysSinceLastActivity =
    lastTime === null ? null : Math.round((todayTime - lastTime) / DAY_MS);

  return {
    base: last?.base ?? 0,
    fatigue: last?.fatigue ?? 0,
    form: last?.form ?? 0,
    typical: {
      base: median(typicalSlice.map((d) => d.base)),
      fatigue: median(typicalSlice.map((d) => d.fatigue)),
      form: median(typicalSlice.map((d) => d.form)),
    },
    series: full.slice(-seriesDays),
    historyDays,
    daysSinceLastActivity,
    shortWindow: historyDays < baseDays,
    trusted: daysSinceLastActivity !== null && daysSinceLastActivity <= staleAfterDays,
  };
}
