/**
 * A Casa, derivada dos extremos das próprias rotas (ADR 0041, invariante 6).
 *
 * Ninguém cadastra endereço. O passe agrupa de onde as pedaladas saem **e aonde
 * chegam** e, quando o agrupamento muda, fecha uma vigência e abre outra — foi
 * assim que a mudança de casa de junho/2026 apareceu sozinha no dado, sem que ela
 * estivesse escrita em lugar nenhum.
 *
 * A vigência copia o vocabulário do `gear` ([ADR 0034](../gear/assign.ts)):
 * `activeFrom` / `activeTo`, dias locais, inclusiva nas duas pontas.
 */
import { haversineM } from '../geo/distance';
import { activityLocalDate, dayBefore } from '../gear/assign';
import type { HomeAnchor } from './types';

/**
 * Raio de pertencimento. 400 m é folgado de propósito: o GPS do relógio espalha
 * a mesma porta por várias células de 110 m, e apertar isso quebraria um cluster
 * em três.
 */
export const RAIO_CASA_M = 400;

/**
 * Quantos DIAS distintos com extremo ali fazem de um lugar uma casa. Abaixo disso é hotel, casa de
 * amigo, ponto de partida de viagem — coisas que não devem virar âncora.
 * Nas 138 rotas reais o corte separa limpo: as casas têm 97 e 12 dias, e o
 * terceiro lugar mais visitado tem 3.
 */
export const MIN_PARTIDAS = 5;

/**
 * Um extremo de rota — partida **ou** chegada.
 *
 * Alimentar só as partidas parece natural e está errado: na mudança de junho/2026
 * a primeira *chegada* na casa nova foi em 21/06 e a primeira *saída* dela só em
 * 02/07. Casa derivada de partida colocaria as pedaladas desse intervalo contra a
 * casa velha, e uma volta para casa viraria "A → A". Casa é de onde se sai e
 * aonde se chega.
 */
export interface PontoDeExtremo {
  startAt: string;
  lat: number;
  lng: number;
}

interface Cluster {
  lat: number;
  lng: number;
  dias: string[];
}

/**
 * Agrupa por densidade, não por ordem de chegada.
 *
 * Um agrupamento guloso na ordem do array daria resultado diferente conforme a
 * ordenação da consulta — o que é uma forma silenciosa de teste instável. Aqui
 * escolhe-se sempre o ponto com mais vizinhos dentro do raio, forma-se o
 * cluster, remove-se, repete. Determinístico, e O(n²) é irrelevante em 138.
 */
function agrupar(pontos: readonly PontoDeExtremo[], raioM: number): Cluster[] {
  const restantes = pontos.map((p, i) => ({ ...p, i }));
  const out: Cluster[] = [];

  while (restantes.length > 0) {
    let melhor = -1;
    let melhorN: number[] = [];
    for (let i = 0; i < restantes.length; i++) {
      const vizinhos: number[] = [];
      for (let j = 0; j < restantes.length; j++) {
        const d = haversineM(restantes[i].lat, restantes[i].lng, restantes[j].lat, restantes[j].lng);
        if (d <= raioM) vizinhos.push(j);
      }
      // Empate resolvido pela partida mais antiga, para o resultado não depender da ordem.
      if (
        vizinhos.length > melhorN.length ||
        (vizinhos.length === melhorN.length && melhor >= 0 && restantes[i].startAt < restantes[melhor].startAt)
      ) {
        melhor = i;
        melhorN = vizinhos;
      }
    }
    if (melhor < 0) break;

    const membros = melhorN.map((j) => restantes[j]);
    out.push({
      lat: membros.reduce((s, m) => s + m.lat, 0) / membros.length,
      lng: membros.reduce((s, m) => s + m.lng, 0) / membros.length,
      dias: [...new Set(membros.map((m) => activityLocalDate(m.startAt)))].sort(),
    });

    const remover = new Set(melhorN);
    for (let j = restantes.length - 1; j >= 0; j--) if (remover.has(j)) restantes.splice(j, 1);
  }

  return out;
}

export interface DerivarAncorasOpts {
  raioM?: number;
  minPartidas?: number;
}

/**
 * Pontos de partida → casas com vigência, em ordem cronológica.
 *
 * A janela de cada casa vai do primeiro dia em que ela aparece até a véspera do
 * primeiro dia da seguinte — sem vão e sem sobreposição, exatamente como
 * `planDefaultGear` fecha a bicicleta que sai. A última fica aberta
 * (`activeTo: null`).
 *
 * **A primeira casa é esticada para trás**, até o primeiro dia do conjunto. Uma
 * pedalada anterior à primeira partida de casa não fica órfã: ela é medida
 * contra a casa mais antiga conhecida e, se saiu de longe, vira `A` — falso
 * negativo, que é o erro barato aqui.
 */
export function derivarAncoras(
  pontos: readonly PontoDeExtremo[],
  opts: DerivarAncorasOpts = {},
): HomeAnchor[] {
  const raioM = opts.raioM ?? RAIO_CASA_M;
  const minPartidas = opts.minPartidas ?? MIN_PARTIDAS;
  if (pontos.length === 0) return [];

  const casas = agrupar(pontos, raioM)
    .filter((c) => c.dias.length >= minPartidas)
    .sort((a, b) => (a.dias[0] < b.dias[0] ? -1 : a.dias[0] > b.dias[0] ? 1 : 0));

  if (casas.length === 0) return [];

  const primeiroDia = pontos
    .map((p) => activityLocalDate(p.startAt))
    .reduce((a, b) => (a < b ? a : b));

  return casas.map((c, i) => ({
    lat: c.lat,
    lng: c.lng,
    radiusM: raioM,
    activeFrom: i === 0 ? primeiroDia : c.dias[0],
    activeTo: i === casas.length - 1 ? null : dayBefore(casas[i + 1].dias[0]),
  }));
}

/** A casa vigente neste dia local. Mesma regra do `gearWindowContains`. */
export function ancoraEm(ancoras: readonly HomeAnchor[], ymd: string): HomeAnchor | undefined {
  let melhor: HomeAnchor | undefined;
  for (const a of ancoras) {
    if (a.activeFrom > ymd) continue;
    if (a.activeTo != null && ymd > a.activeTo) continue;
    if (!melhor || a.activeFrom > melhor.activeFrom) melhor = a;
  }
  return melhor;
}
