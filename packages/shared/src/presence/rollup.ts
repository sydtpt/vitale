/**
 * Visitas → `place_days`: o rollup diário que todas as telas leem.
 *
 * ## Por que o rollup existe
 *
 * Não é otimização: é o antídoto de um defeito já pago neste projeto. **O PostgREST
 * corta em 1000 linhas sem erro.** Uma Retrospectiva anual lendo `visits` devolveria
 * um ano curto, calado, e ninguém descobriria por meses. O rollup é a tabela que a
 * leitura longa consulta.
 *
 * ## A meia-noite, que é sempre o que se esquece
 *
 * Uma visita que atravessa o dia **é dividida**, senão "tempo em casa hoje" está
 * errado toda manhã — e errado para mais, porque a noite inteira cai no dia errado.
 * A divisão é feita no **dia local do `tz` da visita**, não no fuso de quem lê: uma
 * semana em outro fuso desloca todos os dias e ninguém percebe.
 *
 * ## E o dia não tem 24 horas
 *
 * Duas vezes por ano o dia local tem **23 ou 25**. Em Bruxelas, 29/03/2026 tem 23 h e
 * 25/10/2026 tem 25 h. Um rollup que assuma 86 400 segundos erra o dia inteiro nessas
 * duas datas — e erra em silêncio, porque 23 h de presença num dia de 23 h parece
 * cobertura parcial. Por isso {@link segundosDoDiaLocal} mede o dia em vez de supor.
 *
 * ## O lugar nulo não é ausência de dado
 *
 * `placeId: null` significa **"fora de qualquer lugar conhecido"** — é o tempo entre
 * visitas, dentro da janela observada. É dele que sai "horas fora de casa", e é ele
 * que faz a soma do dia fechar. Dia sem linha nenhuma é outra coisa: é dia sem
 * medição, e isso aparece como a diferença entre a soma e {@link segundosDoDiaLocal}.
 */

import type { FonteDaBorda, Visita } from './eventos';

/** Uma linha do rollup. Sem `user_id`: o núcleo não conhece banco. */
export interface DiaDeLugar {
  /** 'YYYY-MM-DD' local. */
  day: string;
  /** `null` = fora de qualquer lugar conhecido. */
  placeId: string | null;
  seconds: number;
  /** Chegadas **que começaram neste dia**. Uma visita que atravessa conta uma vez só. */
  arrivals: number;
  /** Quantas bordas deste dia foram estimadas. É o que impede a tela de mentir. */
  inferredEdges: number;
}

export interface OpcoesDoRollup {
  tz: string;
  /**
   * A janela realmente observada. Fora dela não se afirma nada — nem presença nem
   * ausência. Sem janela, a janela é a primeira chegada até a última saída conhecida.
   */
  janela?: { inicio: string; fim: string };
}

/** Segundos de um dia local — 23 h, 24 h ou 25 h, medidos e não supostos. */
export function segundosDoDiaLocal(dia: string, tz: string): number {
  return (inicioDoDiaLocal(proximoDia(dia), tz) - inicioDoDiaLocal(dia, tz)) / 1000;
}

/**
 * O instante UTC da meia-noite local de um dia.
 *
 * Duas passadas de propósito: o palpite inicial pode cair do outro lado de uma virada
 * de horário de verão, e aí o deslocamento usado para corrigi-lo é o deslocamento
 * errado. A segunda passada conserta exatamente os dois dias do ano em que isso
 * acontece.
 */
export function inicioDoDiaLocal(dia: string, tz: string): number {
  const palpite = Date.parse(`${dia}T00:00:00Z`);
  const off1 = deslocamentoMs(palpite, tz);
  const t = palpite - off1;
  const off2 = deslocamentoMs(t, tz);
  return off2 === off1 ? t : palpite - off2;
}

function deslocamentoMs(instante: number, tz: string): number {
  const p = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(new Date(instante));
  const get = (t: string): string => p.find((x) => x.type === t)?.value ?? '00';
  const hora = get('hour') === '24' ? '00' : get('hour');
  const comoUtc = Date.parse(
    `${get('year')}-${get('month')}-${get('day')}T${hora}:${get('minute')}:${get('second')}Z`,
  );
  return comoUtc - instante;
}

function proximoDia(dia: string): string {
  const d = new Date(`${dia}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

interface Trecho {
  placeId: string | null;
  de: number;
  ate: number;
  /** A borda que fecha o trecho, quando ele é uma visita. */
  fonte: FonteDaBorda | null;
}

/**
 * O rollup.
 *
 * Monta os trechos de presença, **preenche os vãos com o lugar nulo** e corta tudo na
 * meia-noite local antes de somar. Visita em curso é cortada no fim da janela: afirmar
 * presença depois do último instante observado seria inventar futuro.
 */
export function rollup(visitas: readonly Visita[], opts: OpcoesDoRollup): DiaDeLugar[] {
  const ordenadas = [...visitas].sort((a, b) => a.arrivedAt.localeCompare(b.arrivedAt));
  if (ordenadas.length === 0) return [];

  const inicio = opts.janela ? Date.parse(opts.janela.inicio) : Date.parse(ordenadas[0]!.arrivedAt);
  const fim = opts.janela ? Date.parse(opts.janela.fim) : fimConhecido(ordenadas);
  if (!(fim > inicio)) return [];

  const trechos: Trecho[] = [];
  let cursor = inicio;
  for (const v of ordenadas) {
    const de = Math.max(Date.parse(v.arrivedAt), inicio);
    const ate = Math.min(v.departedAt ? Date.parse(v.departedAt) : fim, fim);
    if (ate <= de) continue;
    // O vão antes desta visita é tempo fora de qualquer lugar conhecido.
    if (de > cursor) trechos.push({ placeId: null, de: cursor, ate: de, fonte: null });
    trechos.push({ placeId: v.placeId, de, ate, fonte: v.departedSource });
    cursor = Math.max(cursor, ate);
  }
  if (cursor < fim) trechos.push({ placeId: null, de: cursor, ate: fim, fonte: null });

  const linhas = new Map<string, DiaDeLugar>();
  const pegar = (day: string, placeId: string | null): DiaDeLugar => {
    const chave = `${day}|${placeId ?? ''}`;
    let l = linhas.get(chave);
    if (!l) {
      l = { day, placeId, seconds: 0, arrivals: 0, inferredEdges: 0 };
      linhas.set(chave, l);
    }
    return l;
  };

  for (const t of trechos) {
    for (const [dia, segundos] of fatiarPorDia(t.de, t.ate, opts.tz)) {
      pegar(dia, t.placeId).seconds += segundos;
    }
    if (t.fonte === 'inferred') {
      pegar(diaDoInstante(t.ate, opts.tz), t.placeId).inferredEdges += 1;
    }
  }

  // A chegada pertence ao dia em que aconteceu — uma visita que atravessa a meia-noite
  // conta **uma** chegada, no dia em que entrou, e não uma por dia que ela toca.
  for (const v of ordenadas) {
    const quando = Date.parse(v.arrivedAt);
    if (quando < inicio || quando > fim) continue;
    pegar(diaDoInstante(quando, opts.tz), v.placeId).arrivals += 1;
  }

  return [...linhas.values()].sort(
    (a, b) => a.day.localeCompare(b.day) || (a.placeId ?? '').localeCompare(b.placeId ?? ''),
  );
}

/** Segundos por dia local de um intervalo, cortando em cada meia-noite. */
function fatiarPorDia(de: number, ate: number, tz: string): Array<[string, number]> {
  const out: Array<[string, number]> = [];
  let cursor = de;
  while (cursor < ate) {
    const dia = diaDoInstante(cursor, tz);
    const fimDoDia = inicioDoDiaLocal(proximoDia(dia), tz);
    const corte = Math.min(fimDoDia, ate);
    out.push([dia, (corte - cursor) / 1000]);
    // `fimDoDia` nunca é menor que o cursor — `diaDoInstante` o derivou do próprio
    // cursor —, então o laço sempre anda.
    cursor = corte;
  }
  return out;
}

function diaDoInstante(t: number, tz: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(t));
}

function fimConhecido(visitas: readonly Visita[]): number {
  let fim = 0;
  for (const v of visitas) {
    const t = Date.parse(v.departedAt ?? v.arrivedAt);
    if (t > fim) fim = t;
  }
  return fim;
}

/**
 * O que falta para o dia fechar: os segundos **não cobertos** pela observação.
 *
 * É a quarta fatia da invariante `presença + fora + não coberto = o dia`. Ela nunca é
 * zero por decreto — num dia parcialmente observado ela é grande, e é isso que
 * permite à tela mostrar um buraco em vez de um número menor.
 */
export function segundosNaoCobertos(
  linhas: readonly DiaDeLugar[],
  dia: string,
  tz: string,
): number {
  const soma = linhas.filter((l) => l.day === dia).reduce((s, l) => s + l.seconds, 0);
  return Math.max(0, segundosDoDiaLocal(dia, tz) - soma);
}
