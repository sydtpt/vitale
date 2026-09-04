/**
 * Score de prontidão/bem-estar (0–100) — derivação pura, sem I/O.
 *
 * Combina cinco sinais: sono, FC em repouso, VFC (as duas contra baseline),
 * anéis de atividade e a carga recente. Usado por web (a partir do histórico em
 * `health_daily`) e mobile (em memória).
 *
 * ## A regra que muda tudo: dado velho não pontua
 *
 * A versão anterior renormalizava sobre os componentes **presentes** e não
 * perguntava de quando eles eram. Na prática isso produziu, em 04/09/2026, uma
 * prontidão de 80 sustentada por sono e FC de repouso de quatro dias antes e por
 * anéis de dezoito — enquanto o único sinal do dia, a VFC, marcava 52. O número
 * não estava errado por engano de conta: ele respondia uma pergunta sobre
 * domingo e era exibido como se fosse sobre hoje.
 *
 * Desde então cada leitura carrega a idade (`ReadinessInput.ageDays`), e acima de
 * `READINESS_STALE_DAYS` o componente **sai do peso**: continua na lista, com
 * `stale: true`, para a tela poder desenhá-lo apagado e dizer de quando é, mas
 * não entra na média nem na cobertura. Quem não informa idade nenhuma é tratado
 * como fresco — é o que mantém compatível quem ainda não passa datas, e está
 * documentado em `ageDays` para não virar armadilha silenciosa.
 *
 * ## E abaixo de metade da informação, não há nota
 *
 * Renormalizar sobre um só sinal produz um número com a mesma aparência de um
 * completo. Por isso `total` é `number | null`: abaixo de
 * `READINESS_MIN_COVERAGE` do peso o módulo **não dá nota**. É o mesmo portão que
 * `training-load.ts` aplica ao ACWR sem base — devolver `null` e deixar a tela
 * explicar é mais honesto que publicar um número que não se sustenta.
 *
 * ## Limites conhecidos
 *
 * Os pesos (0,24/0,20/0,20/0,16/0,20) não vêm de estudo: os quatro primeiros
 * preservam exatamente a proporção histórica 30/25/25/20, reduzida para abrir
 * espaço à carga. Mexer neles sem evidência trocaria um palpite por outro.
 *
 * A **regularidade** do sono — dormir e acordar sempre na mesma hora — é o sinal
 * que falta, e não é calculável hoje: a agregação recebe os intervalos e descarta
 * os horários. Recuperá-la é história própria, com `AGG_VERSION` e backfill.
 */
import { ACWR_BANDS } from '../fitness/training-load';

/** Os cinco sinais que compõem a prontidão. */
export type ReadinessKey = 'sono' | 'fcRepouso' | 'vfc' | 'aneis' | 'carga';

/**
 * Idade de cada leitura, em dias inteiros: 0 é hoje, 1 é ontem.
 *
 * Chave ausente, `null` ou não finita é tratada como **fresca**. É deliberado —
 * quem ainda não sabe datar suas leituras continua funcionando como antes —, mas
 * significa que um consumidor que esqueça de passar as idades reabre exatamente
 * o problema que o portão existe para fechar. Idade negativa (relógio adiantado)
 * conta como 0.
 */
export type ReadinessAges = Partial<Record<ReadinessKey, number | null>>;

export interface ReadinessInput {
  /**
   * Horas dormidas na noite. Zero e negativo contam como **ausência**, não como
   * noite em branco: o agregador preenche dia sem dado com zero, e pontuar isso
   * como "dormiu nada" derrubaria a prontidão toda manhã antes do sync.
   */
  sleepHours?: number | null;
  /** FC em repouso do dia (bpm) e baseline longa (ver `READINESS_BASELINE_DAYS`). */
  restingHr?: number | null;
  restingHrBaseline?: number | null;
  /**
   * Baseline curta (ver `READINESS_BASELINE_SHORT_DAYS`). **Não pontua** — viaja
   * junto no componente para a tela poder mostrar a deriva entre o habitual longo
   * e o recente. Quando as duas discordam, a mudança já virou o novo normal.
   */
  restingHrBaselineShort?: number | null;
  /** VFC do dia (ms), baseline longa e a curta, com a mesma regra da FC. */
  hrv?: number | null;
  hrvBaseline?: number | null;
  hrvBaselineShort?: number | null;
  /** Frações 0..1 de meta cumprida nos anéis (mover/exercício/em pé). */
  ringsPct?: number[] | null;
  /**
   * ACWR **desacoplado** de `buildTrainingLoad` — a razão entre a carga da semana
   * e a base de quatro semanas. É a entrada do quinto componente.
   *
   * Recebe a razão pronta, e não a série de carga, por dois motivos: o cálculo já
   * existe num módulo só (nada pode divergir) e a prontidão não precisa conhecer
   * a unidade da carga, só o quanto ela subiu. `null` quando não há base — quem
   * volta de um período parado fica sem este componente, e a cobertura cai, que é
   * a resposta correta.
   */
  acwr?: number | null;
  /** Idade de cada leitura. Ver `ReadinessAges`. */
  ageDays?: ReadinessAges;
}

export interface ReadinessComponent {
  key: ReadinessKey;
  label: string;
  /** Sub-score 0–100. Calculado mesmo quando `stale` — a tela mostra apagado. */
  score: number;
  /** Peso nominal. Um componente `stale` mantém o peso aqui e não entra na média. */
  weight: number;
  /** Idade da leitura em dias; `null` quando o chamador não informou. */
  ageDays: number | null;
  /** A leitura passou de `READINESS_STALE_DAYS`: fora do peso e da cobertura. */
  stale: boolean;
  /** Baseline longa usada na conta; `null` nos componentes que não usam baseline. */
  baseline: number | null;
  /** Baseline curta, só para exibição. Ver `ReadinessInput.restingHrBaselineShort`. */
  baselineShort: number | null;
}

export interface ReadinessScore {
  /**
   * 0–100, média ponderada dos componentes **frescos**.
   *
   * `null` quando a cobertura fica abaixo de `READINESS_MIN_COVERAGE` — inclusive
   * quando não há componente nenhum. Quem exibe precisa tratar o `null`: é o caso
   * em que a tela mostra as barras e diz por que não há nota, em vez de inventar
   * uma. Ver o docblock do módulo.
   */
  total: number | null;
  /** Faixa de `total` (`READINESS_BANDS`); `null` quando `total` é `null`. */
  band: ReadinessBand | null;
  /** Todos os componentes com leitura, frescos e velhos, na ordem dos pesos. */
  components: ReadinessComponent[];
  /**
   * Fração 0–1 do peso total que estava disponível **e fresco**.
   *
   * A média renormaliza sobre o que sobrou, então um score com dois sinais
   * **parece** tão confiável quanto um completo. Foi o que aconteceu duas vezes: a
   * VFC parou de chegar em 17/07/2026 (o Garmin não escreve HRV no Apple Health)
   * e a prontidão rodou meses com 75% da informação sem avisar; depois os anéis
   * pararam e o score seguiu sendo publicado com dado de dezoito dias. Desde a
   * ADR 0026 a VFC volta pelo intervals.icu, na mesma métrica `'vfc'` — mas a
   * medida de lá é RMSSD, não SDNN, e este número continua sendo o aviso.
   *
   * Quem exibe deve mostrar isto sempre que for < 1.
   */
  coverage: number;
  /** Componentes sem leitura nenhuma. */
  missing: ReadinessKey[];
  /** Componentes com leitura velha demais para pontuar. */
  stale: ReadinessKey[];
}

/**
 * Meta de sono (h) — o ponto em que o sub-score chega a `SLEEP_TARGET_SCORE`.
 *
 * Sete horas, não oito. Oito é a orientação de saúde, e com ela a rampa linear
 * antiga saturava: quatro das últimas sete noites do dono marcavam 100 e o
 * componente parava de distinguir uma noite boa de uma ótima.
 */
export const SLEEP_TARGET_H = 7;

/** Sub-score na meta. O resto da escala fica reservado para o que passa dela. */
const SLEEP_TARGET_SCORE = 85;

/** Horas a partir das quais o sono marca 100. */
const SLEEP_FULL_H = 9;

/**
 * Penalidade por bpm de FC repouso acima da baseline. Cinco bpm acima já custam
 * 20 pontos — a FC de repouso é o sinal que mais rápido acusa carga e infecção.
 */
const HR_PENALTY_PER_BPM = 4;

/** Janela da baseline que **pontua**: o habitual longo. */
export const READINESS_BASELINE_DAYS = 90;

/**
 * Janela da baseline secundária, só para exibição. Sete dias eram curtos demais:
 * uma semana ruim virava a nova referência e apagava o progresso do trimestre.
 */
export const READINESS_BASELINE_SHORT_DAYS = 14;

/**
 * Idade máxima (dias) de uma leitura para ela ainda pontuar. Acima disto o
 * componente entra apagado. Três dias é o intervalo em que sono, FC e VFC ainda
 * dizem algo sobre hoje; acima disso a leitura descreve outra semana.
 */
export const READINESS_STALE_DAYS = 3;

/**
 * Fração mínima do peso total, presente e fresca, para haver nota.
 *
 * Metade é o mesmo corte que `training-load.ts` usa no ACWR sem base: abaixo
 * dela o número existiria, mas afirmaria sobre o corpo inteiro a partir de um
 * pedaço. O limite é **inclusivo** — exatamente 0,5 dá nota.
 */
export const READINESS_MIN_COVERAGE = 0.5;

/**
 * As fronteiras da nota — orientação, não diagnóstico.
 *
 * Estavam escondidas dentro de `readiness-advice.ts` como `LOW` e `HIGH`, o que
 * significava que a recomendação classificava com números que a tela não tinha.
 * Exportadas para que conselho, cartão e teste usem o mesmo corte, e para que
 * mudá-lo seja uma edição visível num lugar só.
 *
 * A faixa de baixo é inclusiva no limite: 50 é `moderate`, 70 é `high`.
 */
export const READINESS_BANDS = Object.freeze({
  /** Abaixo disto a prontidão é baixa. */
  lowBelow: 50,
  /** Abaixo disto é moderada; daqui para cima, alta. */
  highFrom: 70,
} as const);

/** Faixa interpretativa da nota. */
export type ReadinessBand = 'low' | 'moderate' | 'high';

/** Rótulo de cada faixa, para a tela não reinventar a palavra. */
export const READINESS_BAND_LABEL: Readonly<Record<ReadinessBand, string>> = Object.freeze({
  low: 'baixa',
  moderate: 'moderada',
  high: 'alta',
} as const);

/**
 * Pesos. Os quatro primeiros são a proporção histórica 30/25/25/20 multiplicada
 * por 0,8, para abrir os 0,20 da carga sem recalibrar nada. A carga fica com o
 * menor peso junto dos anéis de propósito: é o único componente que não mede o
 * corpo — é inferência do que foi feito, e não deve pesar mais que uma medida.
 */
const WEIGHTS: Readonly<Record<ReadinessKey, number>> = Object.freeze({
  sono: 0.24,
  fcRepouso: 0.2,
  vfc: 0.2,
  aneis: 0.16,
  carga: 0.2,
} as const);

/** ACWR a partir do qual a carga recente começa a descontar da prontidão. */
const LOAD_NEUTRAL_ACWR = 1;

/**
 * Inclinação do desconto de carga, por unidade de ACWR acima do neutro.
 *
 * Não é número escolhido a esmo nem emprestado de estudo: é a inclinação que faz
 * o teto da atenção do ACWR (`ACWR_BANDS.cautionMax`, 1,5) cair exatamente na
 * fronteira de prontidão baixa (`READINESS_BANDS.lowBelow`, 50). São duas
 * convenções deste código alinhadas de propósito — mexer numa move a outra, que é
 * o comportamento desejado. Nenhuma literatura afirma essa correspondência.
 */
const LOAD_PENALTY_PER_ACWR =
  (100 - READINESS_BANDS.lowBelow) / (ACWR_BANDS.cautionMax - LOAD_NEUTRAL_ACWR);

function clamp(n: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, n));
}

function isNum(n: number | null | undefined): n is number {
  return n != null && Number.isFinite(n);
}

/**
 * Média móvel das últimas `window` leituras válidas (ignora null/undefined).
 * Use a série histórica EXCLUINDO o dia corrente para obter a baseline.
 *
 * O padrão de 7 é herança; quem monta prontidão deve passar
 * `READINESS_BASELINE_DAYS` e `READINESS_BASELINE_SHORT_DAYS` explicitamente.
 */
export function rollingBaseline(values: (number | null | undefined)[], window = 7): number | null {
  const valid = values.filter(isNum);
  if (valid.length === 0) return null;
  const slice = valid.slice(-window);
  return slice.reduce((a, b) => a + b, 0) / slice.length;
}

/**
 * Sub-score do sono: duas retas, não uma.
 *
 * Sobe até `SLEEP_TARGET_SCORE` na meta de `SLEEP_TARGET_H` e depois desacelera
 * até 100 em `SLEEP_FULL_H`. A rampa única até a meta era o problema: ela gasta a
 * escala inteira antes das 7 h e depois trava, então toda noite decente vira o
 * mesmo 100. Com o joelho na meta, a faixa de 5 a 8 h — onde as noites do dono de
 * fato caem — ganha 60 pontos de separação, e dormir além da meta ainda conta,
 * sem valer o mesmo que dormir dentro dela.
 */
export function sleepScore(hours: number): number {
  if (!Number.isFinite(hours) || hours <= 0) return 0;
  if (hours >= SLEEP_FULL_H) return 100;
  if (hours <= SLEEP_TARGET_H) return (hours / SLEEP_TARGET_H) * SLEEP_TARGET_SCORE;
  const extra = (hours - SLEEP_TARGET_H) / (SLEEP_FULL_H - SLEEP_TARGET_H);
  return SLEEP_TARGET_SCORE + extra * (100 - SLEEP_TARGET_SCORE);
}

/** A faixa de uma nota, por `READINESS_BANDS`. `null` entra `null`. */
export function readinessBandOf(total: number | null): ReadinessBand | null {
  if (total === null || !Number.isFinite(total)) return null;
  if (total < READINESS_BANDS.lowBelow) return 'low';
  if (total < READINESS_BANDS.highFrom) return 'moderate';
  return 'high';
}

/**
 * Idade normalizada: inteiro ≥ 0, ou `null` quando o chamador não informou.
 * Fração arredondada para baixo — meio dia de idade ainda é o dia de hoje.
 */
function ageOf(ages: ReadinessAges | undefined, key: ReadinessKey): number | null {
  const raw = ages?.[key];
  if (!isNum(raw)) return null;
  return Math.max(0, Math.floor(raw));
}

/** Velho demais para pontuar. Idade desconhecida conta como fresca — ver `ReadinessAges`. */
function isStale(ageDays: number | null): boolean {
  return ageDays !== null && ageDays > READINESS_STALE_DAYS;
}

export function computeReadiness(input: ReadinessInput): ReadinessScore {
  // Defesa de runtime: o núcleo é consumido por JavaScript sem tipos (a edge
  // function, um `JSON.parse`), e entrada ausente não pode lançar.
  const src = input ?? {};
  const components: ReadinessComponent[] = [];

  const push = (
    key: ReadinessKey,
    label: string,
    score: number,
    baseline: number | null = null,
    baselineShort: number | null = null,
  ): void => {
    const ageDays = ageOf(src.ageDays, key);
    components.push({
      key,
      label,
      score: clamp(score),
      weight: WEIGHTS[key],
      ageDays,
      stale: isStale(ageDays),
      baseline,
      baselineShort,
    });
  };

  // Zero horas é buraco de agregação, não noite em branco — ver `sleepHours`.
  if (isNum(src.sleepHours) && src.sleepHours > 0) {
    push('sono', 'Sono', sleepScore(src.sleepHours));
  }

  if (isNum(src.restingHr) && isNum(src.restingHrBaseline) && src.restingHrBaseline > 0) {
    const delta = src.restingHr - src.restingHrBaseline; // acima da baseline = pior
    push(
      'fcRepouso',
      'FC em repouso',
      100 - delta * HR_PENALTY_PER_BPM,
      src.restingHrBaseline,
      isNum(src.restingHrBaselineShort) ? src.restingHrBaselineShort : null,
    );
  }

  if (isNum(src.hrv) && isNum(src.hrvBaseline) && src.hrvBaseline > 0) {
    const rel = (src.hrv - src.hrvBaseline) / src.hrvBaseline; // acima da baseline = melhor
    push(
      'vfc',
      'Variabilidade (VFC)',
      50 + rel * 100,
      src.hrvBaseline,
      isNum(src.hrvBaselineShort) ? src.hrvBaselineShort : null,
    );
  }

  if (src.ringsPct && src.ringsPct.length > 0) {
    const pcts = src.ringsPct.filter(isNum).map((p) => clamp(p * 100));
    if (pcts.length > 0) {
      push('aneis', 'Anéis de atividade', pcts.reduce((a, b) => a + b, 0) / pcts.length);
    }
  }

  // Carga abaixo do costume não é mérito nem demérito de recuperação: o teto fica
  // em 100 e só o excesso desconta. Sem base (`acwr` nulo) o componente não existe.
  if (isNum(src.acwr)) {
    const excess = Math.max(0, src.acwr - LOAD_NEUTRAL_ACWR);
    push('carga', 'Carga recente', 100 - excess * LOAD_PENALTY_PER_ACWR);
  }

  const fresh = components.filter((c) => !c.stale);
  const freshWeight = fresh.reduce((a, c) => a + c.weight, 0);
  const fullWeight = Object.values(WEIGHTS).reduce((a, w) => a + w, 0);
  const coverage = fullWeight > 0 ? freshWeight / fullWeight : 0;

  const total =
    coverage >= READINESS_MIN_COVERAGE && freshWeight > 0
      ? Math.round(fresh.reduce((a, c) => a + c.score * c.weight, 0) / freshWeight)
      : null;

  const present = new Set(components.map((c) => c.key));
  const keys = Object.keys(WEIGHTS) as ReadinessKey[];

  return {
    total,
    band: readinessBandOf(total),
    components,
    coverage,
    missing: keys.filter((k) => !present.has(k)),
    stale: components.filter((c) => c.stale).map((c) => c.key),
  };
}
