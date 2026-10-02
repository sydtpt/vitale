/**
 * A lápide: **o dia lembra quanto, nunca o quê.**
 *
 * O dono pediu para gravar tudo e limpar depois, e escolheu esta forma entre três em
 * 06/09/2026. A visita esquecida some inteira — linha, coordenada e `raw`. O que fica
 * é um número por dia, numa tabela **separada de propósito**: dentro de `place_days` a
 * própria chave (`place_id`) denunciaria o lugar que ele mandou apagar.
 *
 * ## A invariante é o produto
 *
 * ```
 * medido  +  esquecido  +  não coberto  =  o dia
 * ```
 *
 * Sem a lápide, esquecer uma visita faria o tempo dela **virar "não coberto"** — e a
 * tela passaria a dizer *"não medi"* sobre um período que foi medido e apagado por
 * escolha. São coisas diferentes, e confundi-las faz todo agregado mentir por omissão
 * sem que nada apareça quebrado.
 *
 * É por isso que {@link fechamentoDoDia} subtrai as duas parcelas e não só uma: a
 * leitura honesta de um dia com lápide é *"3 h 40 em casa · 1 h 10 esquecida"*, nunca
 * *"3 h 40 em casa"* sozinho.
 *
 * ## O que esta peça não faz
 *
 * Não apaga lugar. Quando um lugar fica sem nenhuma visita depois do esquecimento,
 * {@link lugaresOrfaos} o aponta — e **quem pergunta é a tela**, porque apagar o nome
 * é outra decisão: um lugar órfão que sobrevive entrega exatamente o que ele mandou
 * apagar, e um lugar apagado sem perguntar leva junto o histórico de outros dias.
 */

import type { Visita } from './eventos';
import { fatiarPorDia, segundosDoDiaLocal } from './rollup';

/** Uma lápide: um dia, e só o quanto. Nunca o quê, nunca onde. */
export interface DiaEsquecido {
  day: string;
  seconds: number;
  /** Quantas visitas foram apagadas naquele dia. Também não diz quais. */
  visits: number;
}

export interface Esquecimento {
  /** As visitas que restam. A lista de entrada não é modificada. */
  visitas: Visita[];
  /** As lápides, por dia local, somadas às que já existiam. */
  lapides: DiaEsquecido[];
}

/**
 * Apaga as visitas apontadas e devolve as lápides do que se perdeu.
 *
 * O tempo esquecido é fatiado na meia-noite local pela **mesma máquina do rollup** —
 * uma visita noturna esquecida tem de creditar os dois dias, senão a invariante quebra
 * exatamente nos dias em que ela mais importa.
 *
 * `jaEsquecido` entra para que esquecer duas vezes some, em vez de substituir: a
 * lápide é acumulativa por dia.
 */
export function esquecer(
  visitas: readonly Visita[],
  apagar: (v: Visita) => boolean,
  opts: { tz: string; fim?: string; jaEsquecido?: readonly DiaEsquecido[] },
): Esquecimento {
  const porDia = new Map<string, DiaEsquecido>();
  for (const l of opts.jaEsquecido ?? []) {
    porDia.set(l.day, { ...l });
  }

  const restam: Visita[] = [];
  for (const v of visitas) {
    if (!apagar(v)) {
      restam.push(v);
      continue;
    }
    const de = Date.parse(v.arrivedAt);
    const ate = v.departedAt ? Date.parse(v.departedAt) : opts.fim ? Date.parse(opts.fim) : null;
    // Visita em curso sem fim conhecido não tem duração, e lápide de duração
    // desconhecida seria um número inventado. Ela some sem creditar segundos.
    const diaDaChegada = diaDe(v.arrivedAt, opts.tz);
    if (ate === null || !(ate > de)) {
      creditar(porDia, diaDaChegada, 0, 1);
      continue;
    }
    let primeiro = true;
    for (const [dia, segundos] of fatiarPorDia(de, ate, opts.tz)) {
      creditar(porDia, dia, segundos, primeiro ? 1 : 0);
      primeiro = false;
    }
  }

  return {
    visitas: restam,
    // Filtrar por `visits > 0` descartaria a **segunda metade de uma visita noturna**,
    // que credita segundos ao dia seguinte e zero visitas — a visita começou no dia
    // anterior e conta uma vez só. Foi assim que a invariante quebrou no teste.
    lapides: [...porDia.values()]
      .filter((l) => l.visits > 0 || l.seconds > 0)
      .sort((a, b) => a.day.localeCompare(b.day)),
  };
}

function creditar(m: Map<string, DiaEsquecido>, day: string, seconds: number, visits: number): void {
  const atual = m.get(day);
  if (atual) {
    atual.seconds += seconds;
    atual.visits += visits;
  } else {
    m.set(day, { day, seconds, visits });
  }
}

export interface FechamentoDoDia {
  day: string;
  /** O que a observação ainda explica, **depois** de tirar o que foi apagado. */
  medido: number;
  esquecido: number;
  /** O que a observação nunca viu. */
  naoCoberto: number;
  /** 23 h, 24 h ou 25 h — medido, não suposto. */
  total: number;
}

/**
 * As quatro fatias de um dia, que têm de fechar.
 *
 * ## A sutileza que um teste encontrou, e que o papel não tinha
 *
 * O rollup calcula o tempo "fora de qualquer lugar conhecido" como **complemento** das
 * visitas dentro da janela. Apagar uma visita não deixa um buraco: deixa um vão — e o
 * rollup **recoloca aquele tempo como "fora"**, porque do ponto de vista dele é isso
 * que sobrou. Somar a lápide por cima contaria o mesmo período duas vezes, e um dia de
 * 24 h fechava em 25 h 10.
 *
 * Então a lápide **não se soma ao dia: ela se desconta do que o rollup recolocou**.
 *
 * ```
 * medido      = rollup − esquecido
 * naoCoberto  = total  − rollup
 * ```
 *
 * Isso fecha sempre, por construção, e — o que importa mais — **não precisa saber onde
 * nem quando** a visita apagada aconteceu. Só do número de segundos daquele dia, que é
 * exatamente tudo o que a lápide tem direito de guardar.
 *
 * O preço, declarado: quem lê "horas fora de casa" precisa descontar a lápide do mesmo
 * jeito, senão o tempo apagado reaparece como tempo na rua. Ver {@link foraDescontado}.
 */
export function fechamentoDoDia(
  linhasDoRollup: readonly { day: string; seconds: number }[],
  lapides: readonly DiaEsquecido[],
  day: string,
  tz: string,
): FechamentoDoDia {
  const rollup = linhasDoRollup.filter((l) => l.day === day).reduce((s, l) => s + l.seconds, 0);
  const esquecido = lapides.find((l) => l.day === day)?.seconds ?? 0;
  const total = segundosDoDiaLocal(day, tz);
  return {
    day,
    medido: Math.max(0, rollup - esquecido),
    esquecido,
    naoCoberto: Math.max(0, total - rollup),
    total,
  };
}

/**
 * "Fora de qualquer lugar conhecido" com a lápide já descontada.
 *
 * Sem isto, esquecer uma visita **aumenta** as horas fora de casa do dia — e o
 * esquecimento vira visível justamente na métrica que o dono mais olha, que é o avesso
 * do que ele pediu ao escolher a lápide.
 */
export function foraDescontado(
  linhasDoRollup: readonly { day: string; placeId: string | null; seconds: number }[],
  lapides: readonly DiaEsquecido[],
  day: string,
): number {
  const fora = linhasDoRollup
    .filter((l) => l.day === day && l.placeId === null)
    .reduce((s, l) => s + l.seconds, 0);
  return Math.max(0, fora - (lapides.find((l) => l.day === day)?.seconds ?? 0));
}

/**
 * Lugares que ficaram sem nenhuma visita.
 *
 * Não apaga nada: aponta. A pergunta — *"este lugar some também?"* — é da tela, e a
 * resposta tem consequência nos dois sentidos (§ cabeçalho).
 */
export function lugaresOrfaos(
  visitas: readonly Visita[],
  lugaresConhecidos: readonly string[],
): string[] {
  const vivos = new Set(visitas.map((v) => v.placeId));
  return lugaresConhecidos.filter((id) => !vivos.has(id)).sort();
}

function diaDe(iso: string, tz: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(iso));
}
