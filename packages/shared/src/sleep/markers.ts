import type { SleepMarker } from './facts';

/**
 * Trocas de fonte no histórico de sono — DADO do usuário, não lógica.
 *
 * Em 18/07/2026 o Apple Watch deu lugar ao Garmin. Os dois medem duração e
 * horário de forma comparável; **contagem de despertares não**: o Watch
 * reportava 11,8 por noite (micro-despertares), o Garmin reporta 2,6–3,4. Um
 * gráfico que cruze essa data marca a troca, e os fatos de vigília saem por era.
 *
 * O provider do HealthKit não expõe a fonte da amostra de sono, então o
 * marcador não pode ser derivado — fica aqui, explícito, até que possa. Mora no
 * núcleo (e não em cada app) para os dois apps contarem a mesma data: a barreira
 * de nomes duplicados em `architecture.test.ts` é o que impede duas cópias.
 */
export const SONO_MARKERS: readonly SleepMarker[] = [{ day: '2026-07-18', label: 'Garmin' }];
