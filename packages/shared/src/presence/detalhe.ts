/**
 * O que a tela de Presença mostra — derivado aqui, para a tela só renderizar.
 *
 * Mesmo desenho do detalhe de Hábitos e do de Registros: a tela não calcula nada. Ela
 * recebe barras, medianas e células prontas, e por isso o que ela mostra pode ser
 * cobrado por teste **contra o acervo real** sem abrir um aparelho.
 *
 * ## A honestidade que o tipo carrega
 *
 * - `medianaH` é `null` abaixo do piso de dias — e `null` não é zero, é "não dá para
 *   dizer". Quem renderiza mostra um traço, nunca um `0,0 h`.
 * - `cobertura` sai sempre junto, e a tela a escreve: *"sobre 23 dos 25 dias"*. O dia
 *   que ninguém mediu não vira dia em casa.
 * - `bordasEstimadas` conta as saídas que foram deduzidas. É o que permite a linha
 *   *"(1 borda estimada)"* em vez de um número que finge ser medido.
 *
 * ## As três células do ano
 *
 * `saiu` · `nao-saiu` · `sem-cobertura`, nunca uma quarta. Saída curta — acima da
 * colagem e abaixo do limiar — vive no detalhe do dia, porque um quarto estado obriga
 * legenda e legenda é a morte do heatmap.
 */

import type { DiaDePresenca, EstadoDoDia } from './dias';
import { contagemDosDias, type ContagemDosDias } from './dias';
import type { DiaDeLugar } from './rollup';
import { MIN_DIAS_PARA_MEDIANA } from './retro';

/** Uma barra do gráfico de horas fora: um dia. */
export interface BarraDoDia {
  dia: string;
  horas: number;
  estado: EstadoDoDia;
}

/** Uma linha do perfil por dia da semana. 0 = domingo. */
export interface DiaDaSemana {
  indice: number;
  /** Mediana de horas fora naquele dia da semana; `null` com amostra pequena demais. */
  medianaH: number | null;
  dias: number;
}

export interface CelulaDoAno {
  dia: string;
  estado: EstadoDoDia;
}

export interface DetalheDaPresenca {
  contagem: ContagemDosDias;
  cobertura: { dias: number; medidos: number };
  bordasEstimadas: number;
  foraDeCasa: { medianaH: number | null; totalH: number; barras: BarraDoDia[] };
  emCasaH: number;
  porDiaDaSemana: DiaDaSemana[];
  /** `null` quando não há lugar de trabalho declarado. Nunca zero. */
  escritorio: { identidade: string; dias: number; totalH: number; medianaH: number | null } | null;
  ano: CelulaDoAno[];
}

export interface OpcoesDoDetalhe {
  casa: string;
  /** Identidade do lugar de trabalho, quando existir. */
  trabalho?: string;
  /** Mínimo de dias de uma faixa para a mediana dela existir. */
  minParaMediana?: number;
}

/**
 * Monta tudo de uma vez.
 *
 * Recebe os dias **já classificados** (`diasDePresenca`, de preferência com o rollup —
 * sem ele a noite virada classifica errado) e as linhas do rollup, que são a fonte das
 * horas. Dois insumos e nenhuma consulta: a tela decide o período, esta função só lê o
 * que lhe deram.
 */
export function buildPresenceDetail(
  dias: readonly DiaDePresenca[],
  linhas: readonly DiaDeLugar[],
  opts: OpcoesDoDetalhe,
): DetalheDaPresenca {
  const minMediana = opts.minParaMediana ?? MIN_DIAS_PARA_MEDIANA;
  const medidos = dias.filter((d) => d.estado !== 'sem-cobertura');
  const diasMedidos = new Set(medidos.map((d) => d.dia));

  const fora = new Map<string, number>();
  const casa = new Map<string, number>();
  const trabalho = new Map<string, number>();
  let bordasEstimadas = 0;

  for (const l of linhas) {
    if (l.day >= dias[0]!.dia && l.day <= dias[dias.length - 1]!.dia) {
      bordasEstimadas += l.inferredEdges;
    }
    if (!diasMedidos.has(l.day)) continue;
    const horas = l.seconds / 3600;
    if (l.placeId === null) somar(fora, l.day, horas);
    else if (l.placeId === opts.casa) somar(casa, l.day, horas);
    else if (opts.trabalho && l.placeId === opts.trabalho) somar(trabalho, l.day, horas);
  }

  const barras: BarraDoDia[] = dias.map((d) => ({
    dia: d.dia,
    horas: arredondar(fora.get(d.dia) ?? 0),
    estado: d.estado,
  }));

  // Por dia da semana, só sobre dias medidos: um dia sem cobertura puxaria a mediana
  // da terça para baixo fingindo que ele ficou em casa.
  const porSemana = new Map<number, number[]>();
  for (const d of medidos) {
    const i = diaDaSemana(d.dia);
    const lista = porSemana.get(i);
    const h = fora.get(d.dia) ?? 0;
    if (lista) lista.push(h);
    else porSemana.set(i, [h]);
  }

  const porDiaDaSemana: DiaDaSemana[] = Array.from({ length: 7 }, (_, i) => {
    const xs = porSemana.get(i) ?? [];
    return {
      indice: i,
      dias: xs.length,
      medianaH: xs.length >= 2 ? mediana(xs) : null,
    };
  });

  const diasDeTrabalho = [...trabalho.keys()];
  const horasTrabalho = diasDeTrabalho.map((d) => trabalho.get(d) ?? 0);

  return {
    contagem: contagemDosDias(dias),
    cobertura: { dias: dias.length, medidos: medidos.length },
    bordasEstimadas,
    foraDeCasa: {
      medianaH: medidos.length >= minMediana ? mediana(medidos.map((d) => fora.get(d.dia) ?? 0)) : null,
      totalH: arredondar(soma([...fora.values()])),
      barras,
    },
    emCasaH: arredondar(soma([...casa.values()])),
    porDiaDaSemana,
    escritorio: opts.trabalho
      ? {
          identidade: opts.trabalho,
          dias: diasDeTrabalho.length,
          totalH: arredondar(soma(horasTrabalho)),
          medianaH: diasDeTrabalho.length >= minMediana ? mediana(horasTrabalho) : null,
        }
      : null,
    ano: dias.map((d) => ({ dia: d.dia, estado: d.estado })),
  };
}

function somar(m: Map<string, number>, k: string, v: number): void {
  m.set(k, (m.get(k) ?? 0) + v);
}

function soma(xs: readonly number[]): number {
  return xs.reduce((s, x) => s + x, 0);
}

function arredondar(n: number): number {
  return Math.round(n * 10) / 10;
}

function mediana(xs: readonly number[]): number | null {
  if (xs.length === 0) return null;
  const o = [...xs].sort((a, b) => a - b);
  const meio = Math.floor(o.length / 2);
  return arredondar(o.length % 2 === 1 ? o[meio]! : (o[meio - 1]! + o[meio]!) / 2);
}

/** 0 = domingo. Sai do dia local, não do instante UTC. */
function diaDaSemana(dia: string): number {
  return new Date(`${dia}T12:00:00Z`).getUTCDay();
}
