/**
 * O esquema claro/escuro decidido pelo sol.
 *
 * Terceira opção do eixo **Esquema**, ao lado de `light`, `dark` e `system`: o
 * app clareia quando amanhece e escurece quando anoitece no lugar onde o
 * aparelho está. Onde é esse lugar, `timezone-coords` responde pelo fuso; a que
 * horas amanhece lá, `sun` responde pela efeméride.
 *
 * ## O contrato com quem chama
 *
 * `solarScheme()` devolve **o esquema e quando ele muda**, nessa ordem de
 * importância. O `until` existe porque um app que só pergunta "está claro
 * agora?" precisa perguntar de novo — e a alternativa a saber a hora da virada
 * é acordar de minuto em minuto para descobrir que nada mudou. Com o `until`,
 * são dois despertares por dia.
 *
 * Três coisas que o `until` **não** dispensa, e que a web e o mobile tratam
 * cada um do seu jeito:
 *
 * - timer não roda com o app suspenso (iOS) nem em aba de fundo congelada —
 *   por isso os dois apps recalculam ao voltar ao primeiro plano;
 * - o fuso muda no meio da sessão quando o usuário desembarca em outro país;
 * - o relógio do aparelho pode ser acertado para trás.
 *
 * Todas as três se resolvem chamando esta função de novo. Ela é pura e barata
 * (uns poucos senos), então "chamar de novo em caso de dúvida" é a política
 * certa em vez de uma otimização a evitar.
 */
import {
  CIVIL_TWILIGHT_DEG,
  nextSolarCrossing,
  solarAltitude,
  type Coords,
} from './sun';
import { deviceCoords } from './timezone-coords';

/** O que o esquema solar decidiu, e até quando vale. */
export interface SolarScheme {
  scheme: 'light' | 'dark';
  /**
   * Instante da próxima virada, ou `null` em dia/noite polar — lá não há
   * virada, e quem agenda deve reconsultar por tempo em vez de esperar por ela.
   */
  until: Date | null;
  /** Coordenada usada na conta. Serve para explicar a decisão na tela. */
  coords: Coords;
}

/**
 * Esquema do momento, para uma coordenada.
 *
 * O estado sai da **altitude do sol**, não da comparação do relógio com um par
 * nascer/pôr guardado. A diferença aparece justamente onde importa: no verão
 * polar não existe pôr do sol, e a versão que compara contra um par teria de
 * inventar uma resposta. Por altitude, Longyearbyen em junho é simplesmente
 * `light` o tempo todo, sem caso especial nenhum.
 */
export function solarSchemeAt(now: Date, coords: Coords): SolarScheme {
  const day = solarAltitude(now, coords) > CIVIL_TWILIGHT_DEG;
  return {
    scheme: day ? 'light' : 'dark',
    until: nextSolarCrossing(now, coords, CIVIL_TWILIGHT_DEG),
    coords,
  };
}

/**
 * Esquema do momento no lugar onde o aparelho está.
 *
 * `null` quando o fuso do aparelho não tem coordenada (`UTC`, `Etc/GMT+3`) —
 * aí não há sol a consultar, e quem chama cai no esquema do sistema
 * operacional. É o mesmo `null` de `coordsForTimeZone`, propagado de propósito
 * em vez de virar um palpite silencioso.
 */
export function solarScheme(now: Date = new Date()): SolarScheme | null {
  const coords = deviceCoords();
  return coords ? solarSchemeAt(now, coords) : null;
}

/**
 * Quanto esperar até reconsultar, em milissegundos.
 *
 * Não é só `until − agora`. Três aparas, cada uma por um motivo:
 *
 * - **teto de 6 h** — cobre o dia polar (`until` nulo) e mantém o app
 *   reagindo a fuso trocado ou relógio acertado mesmo num dia sem virada;
 * - **piso de 1 min** — sem ele, uma virada a dois segundos vira uma rajada de
 *   timers, porque o recálculo pode cair de novo antes do instante exato;
 * - **1 s de folga** depois da virada — acordar no milissegundo exato às vezes
 *   lê a altitude ainda do lado de cá e reagenda para daqui a nada.
 */
export function msUntilSolarChange(state: SolarScheme | null, now: Date = new Date()): number {
  const SEIS_HORAS = 6 * 3_600_000;
  if (!state?.until) return SEIS_HORAS;
  const delta = state.until.getTime() - now.getTime() + 1_000;
  return Math.max(60_000, Math.min(SEIS_HORAS, delta));
}
