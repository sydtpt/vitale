/**
 * As fotos de um período, para a Retrospectiva (ADR 0037).
 *
 * O dono escolheu a **versão 2** do bloco em 06/09/2026: uma tira discreta no
 * fim, subordinada ao texto — não a capa grande que abre o período. As duas
 * razões, dele e do sistema:
 *
 * - ele disse que foto **não é destaque**, e o jornal continua sendo texto e
 *   número;
 * - a capa grande é justamente o que a **web não consegue mostrar** com o
 *   `localIdentifier` (ADR 0037), então o mesmo bloco ficaria imponente no
 *   iPhone e vazio no navegador. A tira degrada para uma linha honesta.
 *
 * Por isso este módulo devolve **as duas formas**: a contagem, que a web
 * escreve, e a amostra, que só o iPhone consegue desenhar.
 */

import type { ActivityPhoto } from '../models';
import { SILENT_CLUSTER_S } from './group';

/**
 * A capa de uma pedalada — a foto que a representa quando ela é citada.
 *
 * ## Por que existe uma capa automática
 *
 * A marcação sozinha não sustentava uso nenhum: em 07/09/2026 havia **uma capa
 * marcada em 94 pedaladas com foto**. É um ciclo fechado — o dono não marca
 * porque não serve, e não serve porque ele não marca.
 *
 * Invertendo quem escolhe, o ciclo abre: o app escolhe sempre, e a estrela vira
 * uma **correção** ("não, essa não; essa aqui"), que é uma decisão muito mais
 * fácil de tomar do que uma marcação no vazio.
 *
 * ## A regra
 *
 * A foto do meio da maior rajada. Rajada é o que a `groupByStop` chama de
 * cluster silencioso — fotos a menos de dez minutos uma da outra —, e aqui ela
 * é medida só por instante, porque o período não carrega traçado.
 *
 * O sinal é o comportamento dele: fotografa-se mais onde valeu a pena parar. A
 * do meio, e não a primeira, porque a primeira de uma parada costuma ser a de
 * enquadrar — a boa vem depois.
 */
export function coverOf(photos: readonly ActivityPhoto[]): ActivityPhoto | null {
  const linked = photos.filter((p) => p.state === 'linked');
  if (linked.length === 0) return null;

  const marked = linked.find((p) => p.isCover);
  if (marked) return marked;

  const sorted = [...linked].sort((a, b) => a.takenAt - b.takenAt);
  let best: ActivityPhoto[] = [];
  let run: ActivityPhoto[] = [sorted[0]];
  for (let i = 1; i < sorted.length; i += 1) {
    const gapS = (sorted[i].takenAt - sorted[i - 1].takenAt) / 1000;
    if (gapS <= SILENT_CLUSTER_S) {
      run.push(sorted[i]);
    } else {
      if (run.length > best.length) best = run;
      run = [sorted[i]];
    }
  }
  if (run.length > best.length) best = run;
  return best[Math.floor(best.length / 2)] ?? sorted[0];
}

export interface PhotoRetro {
  /** Quantas fotos ligadas no período. */
  total: number;
  /** Em quantas atividades distintas elas estão. */
  activities: number;
  /**
   * A amostra que a tira desenha, em ordem cronológica, já cortada.
   * A web ignora — ela não tem como resolver `assetId`.
   */
  sample: ActivityPhoto[];
  /** Quantas ficaram de fora da amostra (o "+7" da tira). */
  rest: number;
}

/**
 * Resume as fotos de um período.
 *
 * Devolve `null` quando não há nenhuma: o bloco some por completo, sem tira
 * vazia e sem frase dizendo que não houve foto — o jornal informa o que
 * aconteceu, não o que faltou.
 */
export function photoRetro(
  photos: readonly ActivityPhoto[],
  sampleSize = 5,
): PhotoRetro | null {
  const linked = photos.filter((p) => p.state === 'linked');
  if (linked.length === 0) return null;

  const sorted = [...linked].sort((a, b) => a.takenAt - b.takenAt);
  const byActivity = new Map<string, ActivityPhoto[]>();
  for (const p of sorted) {
    const list = byActivity.get(p.activityId);
    if (list) list.push(p);
    else byActivity.set(p.activityId, [p]);
  }
  const activities = byActivity.size;

  /**
   * A amostra é **uma foto por pedalada**, não uma a cada N fotos.
   *
   * A regra anterior pegava em passo constante sobre a lista ordenada por
   * instante, para não repetir o mesmo café cinco vezes. Ela resolvia isso e
   * criava outro problema, medido em julho de 2026 sobre 372 fotos em 12
   * atividades: um dia com 73 fotos ocupa 73 posições da fila e um dia com 2
   * ocupa duas, então a escolha seguia o **relógio**, não a importância. Duas
   * das cinco vagas iam para dias de 8 e 9 fotos, uma ia para um treino de
   * academia — e a travessia até Tournai, com 59, não aparecia.
   *
   * Agora as pedaladas são ordenadas por quantidade de fotos (o sinal do
   * próprio dono: fotografa-se mais no dia que valeu), as `sampleSize`
   * primeiras entram, e cada uma manda a sua **capa**. A tira volta em ordem
   * cronológica, que é como um período se lê.
   */
  const ranked = [...byActivity.values()].sort((a, b) => {
    if (b.length !== a.length) return b.length - a.length;
    return b[0].takenAt - a[0].takenAt;
  });

  const chosen: ActivityPhoto[] = [];
  const taken = new Set<string>();
  for (const list of ranked.slice(0, sampleSize)) {
    const cover = coverOf(list);
    if (cover && !taken.has(cover.id)) {
      chosen.push(cover);
      taken.add(cover.id);
    }
  }

  /**
   * **A tira não pode encolher.** Uma pedalada por vaga é a regra de escolha,
   * não um teto: num período com duas pedaladas fotografadas, a tira mostrava
   * dois quadros onde cabiam cinco — conferido no aparelho em 07/09/2026, logo
   * depois de a regra entrar.
   *
   * Então as vagas que sobram são preenchidas com mais fotos das mesmas
   * pedaladas, das maiores para as menores e espalhadas dentro de cada uma —
   * que era a virtude da regra antiga, e continua valendo para o resto.
   */
  for (const list of ranked) {
    if (chosen.length >= sampleSize) break;
    const step = Math.max(1, Math.floor(list.length / (sampleSize + 1)));
    for (let i = 0; i < list.length && chosen.length < sampleSize; i += step) {
      const p = list[i];
      if (!taken.has(p.id)) {
        chosen.push(p);
        taken.add(p.id);
      }
    }
  }

  const sample = chosen.sort((a, b) => a.takenAt - b.takenAt);

  return {
    total: sorted.length,
    activities,
    sample,
    rest: Math.max(0, sorted.length - sample.length),
  };
}

/**
 * A leitura em texto — o que a **web** mostra no lugar das imagens, e o que a
 * tira do iPhone usa como legenda.
 */
export function photoRetroLabel(r: PhotoRetro): string {
  const fotos = r.total === 1 ? '1 foto' : `${r.total} fotos`;
  const onde = r.activities === 1 ? '1 atividade' : `${r.activities} atividades`;
  return `${fotos} em ${onde}`;
}
