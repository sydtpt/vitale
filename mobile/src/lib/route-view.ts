/**
 * Rotas recorrentes e subidas — lógica de apresentação dos cartões.
 *
 * Puro: recebe o que `recurring-routes.ts` e `climbs.ts` devolvem e produz
 * texto. O componente só desenha o que sai daqui, como `form-curve-view.ts` e
 * `training-load-view.ts` fazem. É isto que se testa, sem renderizar nada.
 */
import type { Climb, RecurringRoute, RouteEffort } from '@vitale/shared';

/** Pódio: só os três primeiros ganham medalha. */
export const MEDAL_RANKS = 3;

/**
 * Ritmo em `m:ss`.
 *
 * Arredonda para o segundo **antes** de dividir, senão 359,7 s/km viraria
 * "5:60": o minuto sairia do piso de 359,7/60 = 5 e o segundo do resto
 * arredondado, 60.
 */
export function formatPace(sPerKm: number | null | undefined): string {
  if (typeof sPerKm !== 'number' || !Number.isFinite(sPerKm) || sPerKm <= 0) return '—';
  const total = Math.round(sPerKm);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

/** Posição ordinal em pt-BR: `1º`, `13º`. */
export function ordinal(n: number): string {
  return `${n}º`;
}

/** `13 vezes` / `1 vez` — o texto que acompanha a contagem. */
export function timesText(count: number): string {
  return `${count} ${count === 1 ? 'vez' : 'vezes'}`;
}

export interface RouteBadge {
  /** `3º melhor tempo nesta rota` — ou o texto de quando não há posto. */
  title: string;
  /** `sua 13ª vez aqui · 17 s/km acima do seu recorde` */
  subtitle: string;
  /** 1, 2 ou 3 no pódio; `null` fora dele. */
  medal: number | null;
}

/**
 * O selo do detalhe da atividade.
 *
 * Sem ritmo (relógio parado, importação sem tempo em movimento) o selo continua
 * existindo e diz só a repetição: a atividade **contou** como uma passagem pela
 * rota, e omitir isso seria perder a informação que se tem por falta da que não
 * se tem.
 */
export function routeBadge(route: RecurringRoute, effort: RouteEffort): RouteBadge {
  const nth = route.efforts.findIndex((e) => e.id === effort.id) + 1;
  const vez = nth > 0 ? `sua ${ordinal(nth)} vez aqui` : `${timesText(route.count)} nesta rota`;

  if (effort.rank === null || effort.paceSPerKm === null) {
    return { title: 'Você já correu esta rota', subtitle: `${vez} · sem ritmo registrado`, medal: null };
  }

  const best = route.best?.paceSPerKm ?? effort.paceSPerKm;
  const delta = Math.round(effort.paceSPerKm - best);
  const cmp =
    delta <= 0 ? 'é o seu recorde aqui' : `${delta} s/km acima do seu recorde`;

  return {
    title: `${ordinal(effort.rank)} melhor tempo nesta rota`,
    subtitle: `${vez} · ${cmp}`,
    medal: effort.rank <= MEDAL_RANKS ? effort.rank : null,
  };
}

/** Distância curta em km com uma casa: `10,1 km`. */
export function km(meters: number): string {
  return `${(meters / 1000).toFixed(1).replace('.', ',')} km`;
}

/** `4,2 km a 4,6%` — a linha de uma subida. */
export function climbText(c: Climb): string {
  return `${km(c.lengthM)} a ${c.gradePct.toFixed(1).replace('.', ',')}%`;
}

/**
 * Faixa de inclinação, para a cor da barra.
 *
 * É a **inclinação** que decide, não o score: o score ordena a lista, mas quem
 * está pedalando sente a rampa. As fronteiras seguem o uso comum do ciclismo
 * (até 4% rola, 4 a 6% pesa, acima de 6% dói) e não pretendem ser mais que isso.
 */
export type ClimbTone = 'easy' | 'medium' | 'hard';

export function climbTone(c: Climb): ClimbTone {
  if (c.gradePct >= 6) return 'hard';
  if (c.gradePct >= 4) return 'medium';
  return 'easy';
}

/**
 * A linha de resumo das subidas.
 *
 * **Sem fração**, e por um motivo medido: o ganho do perfil desenhado e o
 * `elevationM` publicado pelo sync usam janelas de suavização diferentes e
 * divergem muito — numa pedalada real, 1.378 m contra 860. Pôr "531 de 832" no
 * cartão comporia dois números que não se somam. A afirmação qualitativa
 * sobrevive à divergência; a quantitativa, não.
 */
export function climbsSummary(count: number, climbGainM: number): string {
  if (count === 0) return 'Nenhuma subida contínua nesta atividade';
  const s = `${count} ${count === 1 ? 'subida' : 'subidas'} · +${Math.round(climbGainM)} m`;
  return s;
}

/** O rodapé que explica o que ficou de fora da lista. */
export const CLIMBS_FOOTNOTE =
  'Trechos contínuos de 25 m ou mais a partir de 2,5%. O resto da elevação está em terreno ondulado.';
