/**
 * O bloco "Onde você esteve" — as cinco métricas de um período.
 *
 * O período entra pronto (`de`/`ate` em dia local), porque quem sabe recortar semana,
 * mês, trimestre, ano e total é o `period/bounds.ts`, e duplicar essa régua aqui seria
 * criar uma segunda verdade sobre o que é "o mês".
 *
 * ## O que este módulo se recusa a fazer
 *
 * **Não inventa número para dado que não tem.** Três leituras dependem do sono —
 * noites fora, tempo em casa acordado — e sem `sleep_periods` elas saem `null`, nunca
 * zero. É a ADR 0054: ausência não vira zero. O mesmo vale para o piso: período com
 * menos de {@link MIN_DIAS_COBERTOS} dias medidos devolve `null` no lugar das médias,
 * porque abaixo disso é uma semana atípica, não um padrão.
 *
 * **Não compara com o período anterior.** Quem quer a comparação chama duas vezes e
 * subtrai — a comparação é da tela, e cada tela tem uma régua diferente para "o
 * anterior". Devolver a diferença daqui obrigaria este módulo a conhecer calendário.
 *
 * ## Mediana, e por dia da coisa certa
 *
 * Duração sai em **mediana**, nunca média: um dia anômalo não pode mover o período.
 * E o tempo de escritório é dividido por **dia de escritório**, não por dia do
 * período — dividir 18 h por 30 dias daria "0,6 h/dia", que não é nada.
 */

import type { DiaDePresenca } from './dias';
import type { DiaDeLugar } from './rollup';

/**
 * Os dois pisos, na escada que esta casa já usa.
 *
 * O Sono fixou a régua e ela serve inteira aqui: `BASELINE_MIN_NIGHTS = 10` com a
 * justificativa *"menos que isto e a linha de base não é distribuição, é anedota"*, e
 * `REGULARITY_MIN_NIGHTS = 5` para um índice sobre dias seguidos. Nada foi inventado
 * para a Presença.
 *
 * **Contagem não tem piso.** "3 dias sem sair" numa semana de 7 dias medidos é um
 * fato, não uma estimativa — e gatear isso mataria o bloco justamente na recorrência
 * que ele mais lê. O piso existe para o que **pretende descrever uma distribuição**:
 * mediana e taxa por semana.
 */
export const MIN_DIAS_PARA_MEDIANA = 5;

/** Uma taxa semanal precisa de mais de uma semana para não ser a própria semana. */
export const MIN_DIAS_PARA_TAXA = 10;

export interface Noite {
  /** Instantes ISO de dormir e acordar — `sleep_periods`. */
  inicio: string;
  fim: string;
}

export interface OpcoesDoBloco {
  casa: string;
  /** O lugar de trabalho, quando existir. Sem ele as leituras de escritório saem `null`. */
  trabalho?: string;
  tz: string;
  /** Recorte do período, em dia local, inclusive nas duas pontas. */
  de: string;
  ate: string;
  /** Noites medidas. Sem elas, as leituras que dependem de sono saem `null`. */
  noites?: readonly Noite[];
}

export interface BlocoDePresenca {
  de: string;
  ate: string;
  /** Dias do período e quantos deles foram medidos. Aparece escrito: "sobre 23 dos 30". */
  cobertura: { dias: number; medidos: number };
  /** A manchete. Contagem sobre os dias medidos — sem piso, porque contar não estima. */
  semSair: number;
  saiu: number;
  maiorSequenciaSemSair: number;
  /** Noites em que não dormiu em casa. `null` sem `sleep_periods`. */
  noitesFora: number | null;
  /** Horas fora de casa: mediana por dia medido, e o total do período. */
  foraDeCasa: { medianaH: number | null; totalH: number };
  /** Em casa e acordado — o outro lado da linha. `null` sem sono. */
  emCasaAcordadoH: number | null;
  escritorio: {
    dias: number | null;
    /** Mediana **por dia de escritório**, não por dia do período. */
    medianaH: number | null;
    totalH: number;
    /** Dias de escritório por semana. A leitura que o híbrido pede. */
    porSemana: number | null;
    /** 0 = domingo. Quais dias da semana ele de fato vai. */
    diasDaSemana: number[];
  };
}

export function blocoDePresenca(
  dias: readonly DiaDePresenca[],
  linhas: readonly DiaDeLugar[],
  opts: OpcoesDoBloco,
): BlocoDePresenca {
  const noPeriodo = dias.filter((d) => d.dia >= opts.de && d.dia <= opts.ate);
  const medidos = noPeriodo.filter((d) => d.estado !== 'sem-cobertura');
  const paraMediana = medidos.length >= MIN_DIAS_PARA_MEDIANA;
  const paraTaxa = medidos.length >= MIN_DIAS_PARA_TAXA;

  const doPeriodo = linhas.filter((l) => l.day >= opts.de && l.day <= opts.ate);
  const diasMedidos = new Set(medidos.map((d) => d.dia));

  const foraPorDia = new Map<string, number>();
  const casaPorDia = new Map<string, number>();
  const trabalhoPorDia = new Map<string, number>();
  for (const l of doPeriodo) {
    if (!diasMedidos.has(l.day)) continue;
    if (l.placeId === null) somar(foraPorDia, l.day, l.seconds);
    else if (l.placeId === opts.casa) somar(casaPorDia, l.day, l.seconds);
    else if (opts.trabalho && l.placeId === opts.trabalho) somar(trabalhoPorDia, l.day, l.seconds);
  }

  // Dia de escritório é dia com presença medida lá — e não qualquer toque: a passagem
  // já foi descartada antes, na colagem e no filtro de passagem.
  const diasDeEscritorio = [...trabalhoPorDia.keys()].sort();
  const semanas = medidos.length / 7;

  const horasFora = [...foraPorDia.values()].map((s) => s / 3600);
  const horasEscritorio = diasDeEscritorio.map((d) => (trabalhoPorDia.get(d) ?? 0) / 3600);

  return {
    de: opts.de,
    ate: opts.ate,
    cobertura: { dias: noPeriodo.length, medidos: medidos.length },
    semSair: medidos.filter((d) => d.estado === 'nao-saiu').length,
    saiu: medidos.filter((d) => d.estado === 'saiu').length,
    maiorSequenciaSemSair: maiorSequencia(noPeriodo),
    noitesFora: opts.noites ? contarNoitesFora(opts.noites, doPeriodo, opts) : null,
    foraDeCasa: {
      medianaH: paraMediana ? mediana(horasFora) : null,
      totalH: soma(horasFora),
    },
    emCasaAcordadoH: opts.noites
      ? Math.max(0, soma([...casaPorDia.values()].map((s) => s / 3600)) - horasDeSonoEmCasa(opts.noites, doPeriodo, opts))
      : null,
    escritorio: {
      dias: opts.trabalho ? diasDeEscritorio.length : null,
      // A mediana do escritório conta **dias de escritório**, não dias do período: duas
      // idas não descrevem uma jornada típica, por mais completo que o mês esteja.
      medianaH:
        opts.trabalho && diasDeEscritorio.length >= MIN_DIAS_PARA_MEDIANA
          ? mediana(horasEscritorio)
          : null,
      totalH: soma(horasEscritorio),
      porSemana:
        opts.trabalho && paraTaxa && semanas > 0
          ? Math.round((diasDeEscritorio.length / semanas) * 10) / 10
          : null,
      diasDaSemana: [...new Set(diasDeEscritorio.map(diaDaSemana))].sort(),
    },
  };
}

/**
 * Noites fora: a noite aconteceu e **nenhuma presença em casa a cobre**.
 *
 * Não é "ausência longa": é a interseção com o sono valendo zero. A diferença importa
 * porque uma chegada perdida fabrica ausência de trinta horas sem que ele tenha
 * dormido fora — foi o que 17/09 fez no log real.
 */
function contarNoitesFora(
  noites: readonly Noite[],
  linhas: readonly DiaDeLugar[],
  opts: OpcoesDoBloco,
): number {
  let fora = 0;
  for (const n of noites) {
    const dia = diaDe(n.inicio, opts.tz);
    if (dia < opts.de || dia > opts.ate) continue;
    const emCasa = linhas.some((l) => l.day === dia && l.placeId === opts.casa && l.seconds > 0);
    if (!emCasa) fora += 1;
  }
  return fora;
}

/** Aproximação por dia: as horas de sono que caem em dias com presença em casa. */
function horasDeSonoEmCasa(
  noites: readonly Noite[],
  linhas: readonly DiaDeLugar[],
  opts: OpcoesDoBloco,
): number {
  let h = 0;
  for (const n of noites) {
    const dia = diaDe(n.inicio, opts.tz);
    if (dia < opts.de || dia > opts.ate) continue;
    const emCasa = linhas.some((l) => l.day === dia && l.placeId === opts.casa && l.seconds > 0);
    if (emCasa) h += (Date.parse(n.fim) - Date.parse(n.inicio)) / 3_600_000;
  }
  return h;
}

function maiorSequencia(dias: readonly DiaDePresenca[]): number {
  let corrente = 0;
  let maior = 0;
  for (const d of dias) {
    if (d.estado === 'nao-saiu') {
      corrente += 1;
      if (corrente > maior) maior = corrente;
    } else {
      // Buraco interrompe: emendar os dois lados afirmaria reclusão que ninguém mediu.
      corrente = 0;
    }
  }
  return maior;
}

function somar(m: Map<string, number>, k: string, v: number): void {
  m.set(k, (m.get(k) ?? 0) + v);
}

function soma(xs: readonly number[]): number {
  return Math.round(xs.reduce((s, x) => s + x, 0) * 100) / 100;
}

function mediana(xs: readonly number[]): number | null {
  if (xs.length === 0) return null;
  const o = [...xs].sort((a, b) => a - b);
  const meio = Math.floor(o.length / 2);
  const v = o.length % 2 === 1 ? o[meio]! : (o[meio - 1]! + o[meio]!) / 2;
  return Math.round(v * 100) / 100;
}

function diaDe(iso: string, tz: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(iso));
}

/** 0 = domingo. O dia da semana sai do dia local, não do instante UTC. */
function diaDaSemana(dia: string): number {
  return new Date(`${dia}T12:00:00Z`).getUTCDay();
}
