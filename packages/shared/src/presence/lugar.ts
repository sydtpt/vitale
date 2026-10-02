/**
 * O casamento ponto ↔ lugar, e o centro que se corrige sozinho.
 *
 * ## Nunca por distância pura
 *
 * Um ponto casa com um lugar quando `dist(ponto, centro) < raio + precisão`. A
 * precisão entra na conta porque **uma coordenada com 300 m de erro não pode valer o
 * mesmo que uma com 40** — e no aparelho dele as duas existem: a mediana medida é de
 * ±19,8 m, com um outlier de ±176.
 *
 * Sem o termo da precisão, um fix ruim ao sair do metrô cai fora do círculo com ele
 * dentro dele, e a visita nasce no lugar errado — ou em lugar nenhum.
 *
 * ## O centro se corrige sozinho, pela mediana
 *
 * O centro de um lugar não é o primeiro ponto, que foi marcado uma vez, de pé na
 * cozinha. É a **mediana** dos pontos das visitas confirmadas, ponderada por duração —
 * e mediana, não média, porque um único fix de 800 m arrastaria a média e o lugar
 * passaria a casar com a rua de trás.
 *
 * O lugar fica mais preciso com o uso, sem ninguém fazer nada.
 *
 * ## O empate é desempatado por hábito, não por distância
 *
 * Quando dois lugares casam com o mesmo ponto, ganha o de maior frequência histórica
 * **naquela hora do dia**. Na rua dele isso quase nunca acontece; em viagem, acontece
 * o tempo todo — e é lá que escolher "o mais perto" erra, porque o mais perto pode ser
 * o hotel vizinho.
 */

import { haversineM } from '../geo/distance';

export interface Ponto {
  lat: number;
  /** Grafia `lng` como no resto da casa: `places.lng`, `activities.points`, `haversineM`. */
  lng: number;
  /** Erro relatado pelo iOS, em metros. Ausente = trata-se como 0 e confia-se no raio. */
  accuracyM?: number;
}

export interface LugarAncora {
  id: string;
  lat: number;
  lng: number;
  radiusM: number;
}

/** Distância entre um ponto e o centro de um lugar, em metros. */
export function distanciaAoLugar(p: Ponto, l: LugarAncora): number {
  return haversineM(p.lat, p.lng, l.lat, l.lng);
}

/** O ponto cabe no lugar, **com a folga da própria imprecisão**? */
export function cabeNoLugar(p: Ponto, l: LugarAncora): boolean {
  return distanciaAoLugar(p, l) < l.radiusM + (p.accuracyM ?? 0);
}

/**
 * Quantas vezes cada lugar foi visitado naquela hora do dia. É o desempate.
 *
 * A chave é `${placeId}|${hora}`; a hora sai do fuso do lugar, não do de quem lê.
 */
export type HabitoPorHora = ReadonlyMap<string, number>;

export function chaveDoHabito(placeId: string, hora: number): string {
  return `${placeId}|${hora}`;
}

export interface OpcoesDoCasamento {
  /** Hora local (0–23) do ponto, para o desempate por hábito. */
  hora?: number;
  habito?: HabitoPorHora;
}

/**
 * O lugar de um ponto, ou `null` quando ele não cabe em nenhum.
 *
 * `null` **não é erro**: é "fora de qualquer lugar conhecido", que é um valor legítimo
 * em todo o resto deste núcleo.
 */
export function lugarDoPonto(
  p: Ponto,
  lugares: readonly LugarAncora[],
  opts: OpcoesDoCasamento = {},
): string | null {
  const cabem = lugares.filter((l) => cabeNoLugar(p, l));
  if (cabem.length === 0) return null;
  if (cabem.length === 1) return cabem[0]!.id;

  // Empate: hábito primeiro. A distância só entra quando não há história — e aí ela é
  // o melhor palpite disponível, não a regra.
  if (opts.habito && opts.hora !== undefined) {
    const hora = opts.hora;
    const habito = opts.habito;
    const porHabito = [...cabem].sort(
      (a, b) =>
        (habito.get(chaveDoHabito(b.id, hora)) ?? 0) - (habito.get(chaveDoHabito(a.id, hora)) ?? 0),
    );
    const melhor = habito.get(chaveDoHabito(porHabito[0]!.id, hora)) ?? 0;
    const segundo = habito.get(chaveDoHabito(porHabito[1]!.id, hora)) ?? 0;
    if (melhor > segundo) return porHabito[0]!.id;
  }

  return [...cabem].sort((a, b) => distanciaAoLugar(p, a) - distanciaAoLugar(p, b))[0]!.id;
}

export interface PontoPesado extends Ponto {
  /** Duração da visita que produziu este ponto, em segundos. */
  pesoS: number;
}

/**
 * O centro de um lugar: mediana ponderada por duração, eixo a eixo.
 *
 * Ponderar por duração é o que faz uma estadia de oito horas valer mais que uma
 * passagem de dois minutos — e a passagem é justamente a que tende a estar na borda,
 * porque ela acontece **passando**.
 *
 * Mediana por eixo é aproximação: a mediana geométrica verdadeira não tem forma
 * fechada e exigiria iteração. Para corrigir o centro de um lugar da rotina, a
 * diferença entre as duas é de metros — e metros, aqui, estão dentro do erro do
 * próprio sensor.
 */
export function centroPorMediana(pontos: readonly PontoPesado[]): Ponto | null {
  if (pontos.length === 0) return null;
  return {
    lat: medianaPonderada(pontos.map((p) => [p.lat, p.pesoS])),
    lng: medianaPonderada(pontos.map((p) => [p.lng, p.pesoS])),
  };
}

function medianaPonderada(pares: Array<[number, number]>): number {
  const ord = [...pares].sort((a, b) => a[0] - b[0]);
  const total = ord.reduce((s, [, w]) => s + Math.max(0, w), 0);
  if (total <= 0) return ord[Math.floor(ord.length / 2)]![0];
  let acumulado = 0;
  for (const [valor, peso] of ord) {
    acumulado += Math.max(0, peso);
    if (acumulado >= total / 2) return valor;
  }
  return ord[ord.length - 1]![0];
}
