/**
 * O que precedeu a noite — esporte, hábito, registro — e o portão que impede a
 * tela de publicar coincidência como se fosse efeito.
 *
 * ## O falso positivo que este módulo existe para matar
 *
 * Cruzado direto, o arquivo de 06/09/2026 produz manchetes deliciosas e falsas:
 * *"fumar mais te faz dormir 2h39 a mais"*, *"beber mais água, 3h03"*,
 * *"correr, 1h57"*. Nenhuma é real. O confundidor é o **tipo de noite**: a noite
 * antes de folga dorme 6h40 e a antes de trabalho dorme 7h39 — quase uma hora de
 * diferença que não tem nada a ver com o gatilho. E os dias com esporte são 24%
 * de véspera de folga contra 39% nos dias sem. O cruzamento estava medindo o
 * calendário.
 *
 * ## A regra das duas colunas
 *
 * Cada gatilho é medido **separadamente** na noite presa (véspera de dia de
 * trabalho) e na noite livre, e a leitura só sai quando as **duas concordam no
 * sinal**, cada uma com {@link TRIGGER_MIN_PER_CELL} noites de cada lado, e o
 * efeito médio passa de um piso de tamanho. É a irmã da régua de cobertura de
 * `sleep/score.ts`: um piso simples, declarado, que decide antes de olhar.
 *
 * Ela é dura de propósito. Dos 14 gatilhos do arquivo, oito morrem — e quase
 * todos os que morrem **invertem o sinal** entre as colunas (água +227 e −99;
 * cigarro +132 e −77), que é o sintoma clássico de ruído lido como efeito.
 *
 * ## O corte adaptativo, e por que ele não é dose
 *
 * Um hábito com valor (litros, xícaras, cigarros) vira evento por comparação com
 * a **mediana de todos os dias-véspera da janela, zeros inclusos**. Isso resolve
 * dois casos com uma regra só: no hábito frequente a mediana cai no meio da
 * distribuição e o corte pergunta *dose* (café acima de 2); no hábito raro ela
 * cai em zero e o corte degenera para *presença* (cerveja acima de 0), que é o
 * que se quer perguntar de algo que aconteceu em 15 noites. Cortar sempre pela
 * mediana dos dias **com** o hábito — o primeiro desenho — deixava a cerveja com
 * 3 noites por coluna e mudo o que tinha resposta.
 *
 * ## O que isto não é
 *
 * Observacional, amostra pequena, a vida de uma pessoa: **associação, nunca
 * causa**. O texto que consome estas leituras não aconselha — a Retrospectiva é
 * jornal (v2-jornal §9). E o que não passa não some: vira
 * {@link TriggerReach}, que diz *quanto falta*, porque "não tem efeito" e "não
 * tem dado" são coisas opostas e uma tela muda não as distingue.
 */

import type { SleepPeriod } from '../models';
import { axisPosition } from './timing';
import { awakeMinOf } from './derive';
import { isFreeWakeDay } from './facts';

/** Noites COM o gatilho, e noites SEM, em cada coluna. Abaixo disso a coluna cala. */
export const TRIGGER_MIN_PER_CELL = 5;

/** Pisos de tamanho por métrica — abaixo deles o efeito é irrelevante, não achado. */
export const TRIGGER_MIN_EFFECT = {
  /** Minutos no horário de deitar. */
  onset: 10,
  /** Minutos dormidos. */
  asleep: 15,
  /** Pontos na nota de 1 a 5. */
  rating: 0.3,
} as const;

export type TriggerMetric = keyof typeof TRIGGER_MIN_EFFECT;

/** As duas colunas. `livre` = a véspera não tinha compromisso de acordar. */
export type NightColumn = 'presa' | 'livre';

/** Uma noite reduzida ao que o cruzamento precisa. */
export interface TriggerNight {
  wakeDay: string;
  /** O dia anterior — onde mora o gatilho que precedeu a noite. */
  eve: string;
  column: NightColumn;
  /** Horário de dormir em horas de eixo (origem 18h) — cresce com "mais tarde". */
  onset: number;
  /** Minutos dormidos, já descontada a vigília. */
  asleep: number;
  rating: number | null;
}

const dayBefore = (day: string): string => {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
};

/** As noites em forma de cruzamento. Ignora noites sem instantes utilizáveis. */
export function triggerNights(
  periods: readonly SleepPeriod[],
  ratings?: ReadonlyMap<string, number>,
): TriggerNight[] {
  const out: TriggerNight[] = [];
  for (const p of periods) {
    const gross = (new Date(p.wakeAt).getTime() - new Date(p.onsetAt).getTime()) / 60_000;
    if (!(gross > 0)) continue;
    out.push({
      wakeDay: p.wakeDay,
      eve: dayBefore(p.wakeDay),
      column: isFreeWakeDay(p.wakeDay) ? 'livre' : 'presa',
      onset: axisPosition(p.onsetAt, p.tzOffset),
      asleep: gross - (awakeMinOf(p) ?? 0),
      rating: ratings?.get(p.wakeDay) ?? null,
    });
  }
  return out;
}

const mean = (xs: readonly number[]): number => xs.reduce((a, b) => a + b, 0) / xs.length;

const valueOf = (n: TriggerNight, m: TriggerMetric): number | null =>
  m === 'onset' ? n.onset * 60 : m === 'asleep' ? n.asleep : n.rating;

/** Uma coluna medida: quantas noites de cada lado e a diferença entre as médias. */
export interface TriggerCell {
  column: NightColumn;
  nWith: number;
  nWithout: number;
  /** média(com) − média(sem). `null` sem noites suficientes de algum lado. */
  delta: number | null;
}

export interface TriggerReading {
  id: string;
  label: string;
  metric: TriggerMetric;
  cells: TriggerCell[];
  /** A média das duas colunas. `null` quando a leitura não passa. */
  delta: number | null;
  /** As duas colunas concordam no sinal, com n de sobra. */
  agrees: boolean;
  /** `agrees` **e** o efeito passa do piso de {@link TRIGGER_MIN_EFFECT}. */
  passes: boolean;
}

/**
 * A regra das duas colunas para um gatilho e uma métrica.
 *
 * `eventDays` são **dias-véspera**, não dias de acordar: quem consome converte.
 */
export function twoColumnReading(
  id: string,
  label: string,
  metric: TriggerMetric,
  eventDays: ReadonlySet<string>,
  nights: readonly TriggerNight[],
): TriggerReading {
  const cells: TriggerCell[] = (['presa', 'livre'] as const).map((column) => {
    const group = nights.filter((n) => n.column === column);
    const withV: number[] = [];
    const without: number[] = [];
    for (const n of group) {
      const v = valueOf(n, metric);
      if (v === null) continue;
      (eventDays.has(n.eve) ? withV : without).push(v);
    }
    const enough = withV.length >= TRIGGER_MIN_PER_CELL && without.length >= TRIGGER_MIN_PER_CELL;
    return {
      column,
      nWith: withV.length,
      nWithout: without.length,
      delta: enough ? mean(withV) - mean(without) : null,
    };
  });

  const deltas = cells.map((c) => c.delta);
  const agrees =
    deltas.every((d): d is number => d !== null) &&
    deltas[0] !== 0 &&
    Math.sign(deltas[0]) === Math.sign(deltas[1]);
  const delta = agrees ? mean(deltas as number[]) : null;
  const passes = delta !== null && Math.abs(delta) >= TRIGGER_MIN_EFFECT[metric];

  return { id, label, metric, cells, delta: passes ? delta : null, agrees, passes };
}

/**
 * O corte de um hábito com valor: acima da mediana de **todos** os dias-véspera
 * da janela, com zeros. Ver a nota do cabeçalho sobre por que os zeros entram.
 */
export function habitCut(
  logsByDay: ReadonlyMap<string, number>,
  eveDays: readonly string[],
): { cut: number; days: Set<string> } {
  const values = eveDays.map((d) => logsByDay.get(d) ?? 0).sort((a, b) => a - b);
  const cut = values.length > 0 ? values[Math.floor(values.length / 2)] : 0;
  return { cut, days: new Set(eveDays.filter((d) => (logsByDay.get(d) ?? 0) > cut)) };
}

/* ────────────────────────── a régua de alcance ────────────────────────── */

export interface TriggerReach {
  id: string;
  label: string;
  /** Noites que o gatilho toca, no total. */
  nights: number;
  /** Noites tocadas em cada coluna. */
  presa: number;
  livre: number;
  /** Noites que ainda faltam na coluna mais curta. 0 quando já dá para ler. */
  missing: number;
  /** As duas colunas já têm {@link TRIGGER_MIN_PER_CELL} noites tocadas. */
  ready: boolean;
}

/**
 * Quanto falta para um gatilho virar leitura.
 *
 * Conta só o lado **com** o gatilho: o lado sem é quase sempre farto, e quando
 * não é a leitura já cai em {@link twoColumnReading} por conta própria.
 */
export function triggerReach(
  id: string,
  label: string,
  eventDays: ReadonlySet<string>,
  nights: readonly TriggerNight[],
): TriggerReach {
  const touched = nights.filter((n) => eventDays.has(n.eve));
  const presa = touched.filter((n) => n.column === 'presa').length;
  const livre = touched.filter((n) => n.column === 'livre').length;
  const missing = Math.max(0, TRIGGER_MIN_PER_CELL - Math.min(presa, livre));
  return { id, label, nights: touched.length, presa, livre, missing, ready: missing === 0 };
}

/* ──────────────────────────── o quadro inteiro ──────────────────────────── */

/** Um gatilho já resolvido em dias-véspera. Quem monta conhece os tipos; aqui não. */
export interface TriggerSource {
  id: string;
  label: string;
  /** Dias-véspera em que o gatilho aconteceu. */
  days: ReadonlySet<string>;
  /**
   * Primeiro dia em que o gatilho podia existir ('YYYY-MM-DD'). Sem ele um
   * hábito criado em maio seria comparado contra noites de abril, em que não
   * havia o que registrar — e a ausência viraria "sem o gatilho".
   */
  since?: string;
}

export interface SleepTriggerBoard {
  /** O que passou a regra, mais forte primeiro. */
  readings: TriggerReading[];
  /** O que ainda não tem noites — a régua de alcance, mais perto primeiro. */
  pending: TriggerReach[];
  /** Gatilhos com noites de sobra cuja leitura mesmo assim não saiu. */
  silent: TriggerReach[];
  /** Noites que entraram no cruzamento. */
  nights: number;
}

/** Quão acima do piso o efeito ficou — serve só para ordenar. */
const strength = (r: TriggerReading): number =>
  r.delta === null ? 0 : Math.abs(r.delta) / TRIGGER_MIN_EFFECT[r.metric];

/**
 * Mede todos os gatilhos e separa em três: o que fala, o que ainda não tem
 * noites, e o que tem noites e mesmo assim não diz nada.
 *
 * A distinção entre os dois últimos é o ponto: *"não tem efeito"* e *"não tem
 * dado"* são coisas opostas, e uma tela que esconde as duas não as separa.
 *
 * A janela é **todo o histórico**, não o período exibido. Um mês rende células
 * de três a oito noites e a regra nunca passaria; e a pergunta ("o que a cerveja
 * faz comigo") é sobre a pessoa, não sobre agosto.
 */
export function sleepTriggerBoard(
  sources: readonly TriggerSource[],
  nights: readonly TriggerNight[],
): SleepTriggerBoard {
  const readings: TriggerReading[] = [];
  const pending: TriggerReach[] = [];
  const silent: TriggerReach[] = [];

  for (const s of sources) {
    const scoped = s.since ? nights.filter((n) => n.eve >= s.since!) : nights;
    const reach = triggerReach(s.id, s.label, s.days, scoped);
    // Gatilho que nunca foi marcado não entra nem na régua: ele não está "perto
    // de virar leitura", está vazio, e a lista de Registros já o mostra. Deixá-lo
    // aqui encheria a régua de linhas que não medem nada.
    if (reach.nights === 0) continue;
    if (!reach.ready) {
      pending.push(reach);
      continue;
    }
    const passed = (Object.keys(TRIGGER_MIN_EFFECT) as TriggerMetric[])
      .map((m) => twoColumnReading(s.id, s.label, m, s.days, scoped))
      .filter((r) => r.passes);
    if (passed.length === 0) silent.push(reach);
    else readings.push(...passed);
  }

  return {
    readings: readings.sort((a, b) => strength(b) - strength(a)),
    pending: pending.sort((a, b) => a.missing - b.missing || b.nights - a.nights),
    silent: silent.sort((a, b) => b.nights - a.nights),
    nights: nights.length,
  };
}
