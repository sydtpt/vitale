/**
 * Curva de forma — lógica de apresentação do cartão da Hoje.
 *
 * Tudo aqui é puro: recebe o `FormCurve` do núcleo (`@vitale/shared`) e devolve
 * texto, tom e geometria. O componente só desenha o que sai daqui — e por isso é
 * isto que se testa, sem renderizar nada.
 *
 * Toda janela em rótulo vem das constantes do núcleo (`FORM_*_DAYS`): mudar a
 * janela lá muda o texto aqui, em vez de deixar "42" chumbado numa string.
 *
 * Spec: _bmad-output/implementation-artifacts/spec-curva-de-forma-mobile.md
 */
import {
  FORM_BASE_DAYS,
  FORM_FATIGUE_DAYS,
  FORM_TYPICAL_DAYS,
  mix,
  type FormCurve,
  type FormCurveDay,
} from '@vitale/shared';

/**
 * A barra Base usa o azul da paleta num passo mais fundo que o `text`.
 *
 * Os dois `text` (azul e rose) são puxados ao mesmo piso de 4,5 sobre a
 * superfície e acabam com luminância quase igual — medido: separação de 1,00 a
 * 1,26 nos 36 casos de tema × esquema × paleta. Só o matiz separaria as barras,
 * que é o que a UX rejeitou (visão de cor, telefone no sol). Misturar 40% de
 * tinta escurece no claro e clareia no escuro (a tinta inverte com o esquema),
 * leva a separação a 1,19–2,13 e mantém ≥ 7,6 sobre a superfície. Decisão do
 * humano na revisão da etapa 2.
 */
export const BASE_DEPTH = 0.4;

export function baseBarColor(blueText: string, ink: string): string {
  return mix(blueText, ink, BASE_DEPTH);
}

/** Quantos dias a faísca mostra — a janela da base, o período que ela "lembra". */
export const SPARK_DAYS = FORM_BASE_DAYS;
/** A frase de detalhe compara hoje com este número de dias atrás — a janela do cansaço. */
export const DETAIL_SPAN_DAYS = FORM_FATIGUE_DAYS;

/** Rótulos das barras e da legenda, derivados das janelas do núcleo. */
export const BAR_LABELS = {
  base: `Base ${FORM_BASE_DAYS} d`,
  fatigue: `Cansaço ${FORM_FATIGUE_DAYS} d`,
} as const;
/** O típico é mediana, não média: o texto diz "habitual" de propósito. */
export const LEGEND_TEXT = `o traço é o seu habitual dos últimos ${FORM_TYPICAL_DAYS} dias`;

/** Tom do número: fresco (sobra), enterrado (dívida) ou sem confiança. */
export type FormTone = 'fresh' | 'buried' | 'unsure';

/**
 * A última linha do slide 1. As três variantes ocupam a mesma altura — o
 * cartão tem altura fixa e trocar de estado não pode mover nada.
 */
export type FormFooter =
  | { kind: 'axis'; left: string; right: string }
  | { kind: 'warmup'; text: string }
  | { kind: 'alert'; text: string };

export interface FormState {
  tone: FormTone;
  /** `+36`, `-48`, `0` — inteiro com sinal. */
  valueText: string;
  phrase: string;
  /** Selo do canto; `null` quando o dado é confiável. */
  badge: string | null;
  footer: FormFooter;
}

export const PHRASES: Record<FormTone, string> = {
  fresh: 'Dá para forçar hoje.',
  buried: 'Hoje é dia de perna leve.',
  unsure: 'Não dá para confiar neste número.',
};

export const ALERT_TEXT = 'Abra Conexões para sincronizar';

export function signedInt(v: number): string {
  const n = Math.round(v);
  return n > 0 ? `+${n}` : String(n);
}

export function staleLabel(days: number | null): string {
  if (days === null) return 'SEM SINCRONIZAÇÃO';
  return `${days} ${days === 1 ? 'DIA' : 'DIAS'} SEM SINCRONIZAR`;
}

export function warmupLabel(historyDays: number, baseDays: number = FORM_BASE_DAYS): string {
  return `Base ainda aquecendo · ${historyDays} de ${baseDays} dias`;
}

/** O cartão só existe com dado carregado e pelo menos um dia na série. */
export function canShow(loaded: boolean, curve: Pick<FormCurve, 'series'>): boolean {
  return loaded && curve.series.length > 0;
}

export function formState(curve: FormCurve): FormState {
  // O tom segue o número **impresso**: −0,3 vira "0" e "0" não pode ser vermelho.
  const shown = Math.round(curve.form);
  const tone: FormTone = !curve.trusted ? 'unsure' : shown >= 0 ? 'fresh' : 'buried';
  const footer: FormFooter = !curve.trusted
    ? { kind: 'alert', text: ALERT_TEXT }
    : curve.shortWindow
      ? { kind: 'warmup', text: warmupLabel(curve.historyDays) }
      : { kind: 'axis', left: `${SPARK_DAYS} dias`, right: 'hoje' };
  return {
    tone,
    valueText: signedInt(curve.form),
    phrase: PHRASES[tone],
    badge: curve.trusted ? null : staleLabel(curve.daysSinceLastActivity),
    footer,
  };
}

/* ───────────────────────────── Faísca ───────────────────────────── */

export interface SparkSegment {
  /** Caminho SVG (`M … L …`). */
  d: string;
  /** +1 acima do zero (sobra), −1 abaixo (dívida). */
  sign: 1 | -1;
}

export interface Spark {
  segments: SparkSegment[];
  /** y da linha de zero, sempre dentro da caixa. */
  zeroY: number;
  /** Último ponto, para o marcador; `null` sem dado. */
  end: { x: number; y: number } | null;
}

export interface SparkBox {
  width: number;
  height: number;
  /** Margem vertical, para o traço e o marcador não encostarem na borda. */
  pad?: number;
  /** Deslocamento horizontal (folga para o rótulo "0" à esquerda). */
  offsetX?: number;
}

/** Os valores que a faísca desenha: o saldo dos últimos `SPARK_DAYS` dias. */
export function sparkValues(series: readonly FormCurveDay[]): number[] {
  return series.slice(-SPARK_DAYS).map((d) => d.form);
}

const r2 = (n: number): number => Math.round(n * 100) / 100;

/**
 * Segmenta a polilinha **por sinal**, cortando no cruzamento de zero por
 * interpolação linear — colorir ponto a ponto deixaria um trecho verde
 * mergulhando abaixo da linha. O domínio inclui o zero, então a linha de zero
 * fica sempre dentro da caixa.
 *
 * Valor não finito é descartado (o núcleo nunca emite um, mas o SVG não pode
 * receber `NaN`); os pontos restantes se redistribuem na largura.
 */
export function sparkSegments(values: readonly number[], box: SparkBox): Spark {
  const { width, height, pad = 2, offsetX = 0 } = box;
  const vals = values.filter((v) => Number.isFinite(v));
  if (vals.length === 0) return { segments: [], zeroY: r2(height / 2), end: null };

  const min = Math.min(0, ...vals);
  const max = Math.max(0, ...vals);
  const span = max - min || 1;
  const innerH = height - 2 * pad;
  const n = vals.length;
  const y = (v: number): number => pad + ((max - v) / span) * innerH;
  const x = (i: number): number => offsetX + (n > 1 ? (i * width) / (n - 1) : width / 2);
  const signOf = (v: number): 1 | -1 => (v < 0 ? -1 : 1);
  const zeroY = y(0);

  const segments: SparkSegment[] = [];
  let sign = signOf(vals[0]);
  let d = `M${r2(x(0))},${r2(y(vals[0]))}`;
  for (let i = 1; i < n; i++) {
    const s = signOf(vals[i]);
    if (s !== sign) {
      // Sinais diferentes garantem v0 ≠ v1, então a divisão é segura. Com v1 = 0
      // o corte cai exatamente no ponto (t = 1), e o segmento novo começa nele.
      const v0 = vals[i - 1];
      const v1 = vals[i];
      const t = v0 / (v0 - v1);
      const xc = x(i - 1) + t * (x(i) - x(i - 1));
      d += ` L${r2(xc)},${r2(zeroY)}`;
      segments.push({ d, sign });
      sign = s;
      d = `M${r2(xc)},${r2(zeroY)}`;
    }
    d += ` L${r2(x(i))},${r2(y(vals[i]))}`;
  }
  segments.push({ d, sign });

  return {
    segments,
    zeroY: r2(zeroY),
    end: { x: r2(x(n - 1)), y: r2(y(vals[n - 1])) },
  };
}

/* ───────────────────────────── Barras ───────────────────────────── */

/** Frações 0..1 da largura do trilho. As duas barras dividem a mesma escala. */
export interface BarScale {
  /** O que vale 100%: o maior dos quatro valores com 10% de folga. */
  max: number;
  base: number;
  fatigue: number;
  typicalBase: number;
  typicalFatigue: number;
}

export function barScale(curve: Pick<FormCurve, 'base' | 'fatigue' | 'typical'>): BarScale {
  const max = Math.max(curve.base, curve.fatigue, curve.typical.base, curve.typical.fatigue, 0) * 1.1;
  const frac = (v: number): number => (max > 0 ? Math.min(1, Math.max(0, v / max)) : 0);
  return {
    max,
    base: frac(curve.base),
    fatigue: frac(curve.fatigue),
    typicalBase: frac(curve.typical.base),
    typicalFatigue: frac(curve.typical.fatigue),
  };
}

/**
 * A frase do slide 2: hoje contra `DETAIL_SPAN_DAYS` dias atrás.
 *
 * Compara os valores **já arredondados**, os mesmos que as barras mostram: assim
 * "subiu 14 para 94" fecha a conta com o que o leitor vê. Variação de até 1
 * ponto é ruído e vira "ficou"/"segurou" nas duas séries.
 *
 * `null` quando a série é curta demais para a comparação — quem desenha mantém a altura.
 */
export function detailSentence(series: readonly FormCurveDay[]): string | null {
  if (series.length < DETAIL_SPAN_DAYS + 1) return null;
  const today = series[series.length - 1];
  const before = series[series.length - 1 - DETAIL_SPAN_DAYS];
  const fatigueNow = Math.round(today.fatigue);
  const baseNow = Math.round(today.base);
  const dF = fatigueNow - Math.round(before.fatigue);
  const dB = baseNow - Math.round(before.base);

  const fatigue =
    Math.abs(dF) <= 1
      ? `O cansaço ficou em ${fatigueNow} na semana`
      : dF > 0
        ? `O cansaço subiu ${dF} em uma semana`
        : `O cansaço caiu ${-dF} em uma semana`;
  const base =
    Math.abs(dB) <= 1
      ? `a base segurou em ${baseNow}`
      : dB > 0
        ? `a base subiu ${dB} para ${baseNow}`
        : `a base caiu ${-dB} para ${baseNow}`;
  return `${fatigue} e ${base}.`;
}
