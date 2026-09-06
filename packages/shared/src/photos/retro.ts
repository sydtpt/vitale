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
  const activities = new Set(sorted.map((p) => p.activityId)).size;

  /**
   * A amostra é **espalhada**, não os primeiros da lista: cinco fotos seguidas
   * costumam ser a mesma parada, e a tira mostraria o mesmo café cinco vezes.
   * Pegar em passo constante dá o período inteiro em cinco quadros.
   */
  const sample: ActivityPhoto[] = [];
  if (sorted.length <= sampleSize) {
    sample.push(...sorted);
  } else {
    const step = (sorted.length - 1) / (sampleSize - 1);
    for (let i = 0; i < sampleSize; i += 1) sample.push(sorted[Math.round(i * step)]);
  }

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
