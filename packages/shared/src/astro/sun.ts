/**
 * Posição do Sol — pura, offline, sem dependência.
 *
 * ## Para que serve
 *
 * O esquema `solar` do sistema de temas: o app clareia quando amanhece e
 * escurece quando anoitece **no lugar onde o aparelho está**. É o único
 * consumidor hoje, e ele precisa de duas coisas diferentes:
 *
 * - **em que estado estou agora** — respondido por `solarAltitude()`, que é
 *   exata em qualquer latitude e não tem caso especial nenhum: o sol está acima
 *   ou abaixo do limiar, ponto;
 * - **quando é a próxima virada** — respondido por `solarEvents()`, para o app
 *   agendar um timer em vez de ficar acordando de minuto em minuto.
 *
 * A separação é de propósito. A equação do nascer/pôr **não tem solução** no
 * verão e no inverno polares, e é aí que quase toda implementação erra: quem
 * decide o estado a partir dela precisa inventar uma resposta para o dia que
 * não tem nascer do sol. Decidindo por altitude, o sol de meia-noite em
 * Longyearbyen cai sozinho no lado certo, e a ausência de evento vira só uma
 * ausência de agendamento — o app reconsulta mais tarde.
 *
 * ## A precisão que isto tem
 *
 * Séries de Meeus (capítulo 25) com os termos seculares, mais aberração e o
 * termo principal de nutação. Contra a elevação do **JPL Horizons**, a altitude
 * tem 0,005° de erro; contra a efeméride do **USNO**, os horários de nascer,
 * pôr e crepúsculo ficam a **36 s** no pior caso, e o USNO publica ao minuto —
 * boa parte desses 36 s é o arredondamento dele (`sun.test.ts`, 45 eventos em
 * sete latitudes e nas duas estações).
 *
 * Não foi assim que começou. A primeira versão usava as equações curtas que
 * circulam junto com a "equação do nascer do sol", e errava **1min45s** — ver
 * `GMST_J2000` e `eclipticLongitude()`, onde os dois motivos estão anotados no
 * lugar em que alguém iria mexer. Ambos são do tipo que não quebra teste de
 * formato nenhum: o dia continua com a duração certa, só acontece na hora
 * errada.
 *
 * Para decidir a cor de um app isso é folga de sobra — a escolha entre usar o
 * pôr do sol ou o crepúsculo civil vale mais de meia hora. A precisão está aqui
 * porque custou pouco depois de a referência certa estar em mãos, e porque o
 * módulo é reusável para mostrar horários na tela, onde um minuto aparece.
 */

const RAD = Math.PI / 180;
const DAY_MS = 86_400_000;

/** Dias julianos desde J2000.0 (2000-01-01 12:00 UTC). */
const J2000_MS = Date.UTC(2000, 0, 1, 12);

/** Obliquidade média da eclíptica em J2000.0, em graus. Ver `obliquity()`. */
const OBLIQUITY_J2000 = 23 + 26 / 60 + 21.448 / 3600;

/**
 * Tempo sideral médio de Greenwich em J2000.0, em graus.
 *
 * **Não é 280,16.** Esse número circula muito — é o que o SunCalc usa, e daí
 * ele foi parar em meia internet de implementações copiadas — e está 0,30°
 * errado. Um viés constante de 0,30° em ângulo horário não aparece em teste
 * nenhum que confira o formato da resposta: o dia continua tendo a duração
 * certa, o meio-dia solar continua no lugar, o gráfico do ano continua com a
 * forma da analema. Só o horário dos eventos anda ~1min45s.
 *
 * Foi assim que apareceu aqui: contra a efeméride do USNO o pôr do sol vinha
 * 1min43s atrasado em Bruxelas. O JPL Horizons, consultado com a elevação
 * minuto a minuto, mostrou que a altitude calculada tinha **+0,195° de viés
 * constante** — constante ao longo do dia, que é a assinatura de erro em
 * constante, não em termo periódico. Com 280,46061837 o viés cai para 0,014°.
 */
const GMST_J2000 = 280.46061837;

/** Coordenada geográfica em graus decimais; longitude positiva a leste. */
export interface Coords {
  lat: number;
  lon: number;
}

/**
 * Altitude do sol que separa dia de noite, em graus.
 *
 * `-6` é o **crepúsculo civil**: o instante em que a luz do céu deixa de
 * bastar para ler lá fora. É o limiar certo para tema porque o app não compete
 * com o horizonte — no pôr do sol exato ainda há bastante claridade, e
 * escurecer a tela ali chega cedo demais. Em Bruxelas a diferença é de 35 min
 * no fim de agosto e 46 min no solstício de junho.
 *
 * `0` (nascer/pôr geométrico) fica exportado ao lado porque é o número que as
 * pessoas reconhecem, e porque quem quiser mostrar "pôr do sol às 20h47" na
 * tela precisa dele, não do crepúsculo.
 */
export const CIVIL_TWILIGHT_DEG = -6;

/**
 * Nascer/pôr do sol *aparente*: o disco tangencia o horizonte.
 *
 * Não é zero — é −0,833°, que soma o raio aparente do disco (~0,27°) à
 * refração atmosférica no horizonte (~0,57°). É a convenção que qualquer
 * almanaque usa; usar zero adiantaria o pôr do sol em 5 a 7 min em Bruxelas, e
 * mais ainda quanto maior a latitude, porque o sol desce mais de lado.
 */
export const SUNRISE_DEG = -0.833;

/** Dias desde J2000 no instante dado (fracionário). */
function daysSinceJ2000(date: Date): number {
  return (date.getTime() - J2000_MS) / DAY_MS;
}

/** Anomalia média do Sol, em radianos. */
function meanAnomaly(d: number): number {
  const t = d / 36_525;
  return RAD * (357.52911 + 35_999.05029 * t - 0.0001537 * t * t);
}

/**
 * Longitude eclíptica **aparente** do Sol, em radianos.
 *
 * A versão curta desta função — `M + C + 102,9372 + 180` — é a que circula
 * junto com a equação do nascer do sol, e o problema dela não é a truncagem da
 * equação do centro: é que ela faz a longitude média avançar na mesma taxa da
 * anomalia média. As duas diferem por **precessão dos equinócios**, 0,0000471°
 * por dia. Isso é invisível perto de J2000 e vale 0,46° em 2026 — que chegam na
 * tela como mais de um minuto de erro no horário, com sinal que muda ao longo
 * do ano, o que é bem pior de diagnosticar que um viés fixo.
 *
 * Aqui vão as séries de Meeus (capítulo 25) com os termos seculares, mais a
 * correção de aberração e o termo principal de nutação em longitude.
 */
function eclipticLongitude(d: number): number {
  const t = d / 36_525;
  const m = meanAnomaly(d);
  const meanLon = 280.46646 + 36_000.76983 * t + 0.0003032 * t * t;
  const center =
    (1.914602 - 0.004817 * t - 0.000014 * t * t) * Math.sin(m) +
    (0.019993 - 0.000101 * t) * Math.sin(2 * m) +
    0.000289 * Math.sin(3 * m);
  // Aberração da luz (−20,5″) e nutação; `omega` é a longitude do nodo lunar.
  const omega = RAD * (125.04 - 1934.136 * t);
  return RAD * (meanLon + center - 0.00569 - 0.00478 * Math.sin(omega));
}

/** Obliquidade aparente da eclíptica, em radianos. */
function obliquity(d: number): number {
  const t = d / 36_525;
  const mean =
    OBLIQUITY_J2000 - (46.815 * t + 0.00059 * t * t - 0.001813 * t * t * t) / 3600;
  const omega = RAD * (125.04 - 1934.136 * t);
  return RAD * (mean + 0.00256 * Math.cos(omega));
}

/** Declinação do Sol, em radianos. */
function declination(lambda: number, eps: number): number {
  return Math.asin(Math.sin(eps) * Math.sin(lambda));
}

/** Ascensão reta do Sol, em radianos. */
function rightAscension(lambda: number, eps: number): number {
  return Math.atan2(Math.cos(eps) * Math.sin(lambda), Math.cos(lambda));
}

/** Posição do sol vista do lugar, em graus. */
interface SunPosition {
  /** Altura acima do horizonte; negativa quando o sol está abaixo dele. */
  altitude: number;
  /** Ângulo horário, normalizado para (−180, 180]. Zero é o meio-dia solar. */
  hourAngle: number;
}

function sunPosition(date: Date, coords: Coords): SunPosition {
  const d = daysSinceJ2000(date);
  const eps = obliquity(d);
  const lambda = eclipticLongitude(d);
  const dec = declination(lambda, eps);
  const ra = rightAscension(lambda, eps);

  // Tempo sideral em Greenwich, deslocado pela longitude do lugar.
  const t = d / 36_525;
  const gmst =
    GMST_J2000 + 360.98564736629 * d + 0.000387933 * t * t - (t * t * t) / 38_710_000;
  const sidereal = RAD * gmst + RAD * coords.lon;
  const hourAngle = sidereal - ra;

  const phi = RAD * coords.lat;
  const altitude = Math.asin(
    Math.sin(phi) * Math.sin(dec) + Math.cos(phi) * Math.cos(dec) * Math.cos(hourAngle),
  );
  return { altitude: altitude / RAD, hourAngle: normalizeDeg(hourAngle / RAD) };
}

/** Traz um ângulo em graus para (−180, 180]. */
function normalizeDeg(deg: number): number {
  const wrapped = ((deg + 180) % 360 + 360) % 360;
  return wrapped - 180;
}

/**
 * Altitude do sol acima do horizonte, em graus, no instante e no lugar dados.
 *
 * Negativo quando o sol está abaixo do horizonte. É geométrico: não desconta
 * refração, o que é coerente com comparar contra `CIVIL_TWILIGHT_DEG`
 * (o crepúsculo civil é definido em altitude geométrica) e é o motivo de
 * `SUNRISE_DEG` não ser zero.
 *
 * Conferido contra o JPL Horizons (elevação airless minuto a minuto), o viés é
 * de 0,014° — uns cinco segundos de horário no pôr do sol em latitude média.
 */
export function solarAltitude(date: Date, coords: Coords): number {
  return sunPosition(date, coords).altitude;
}

/** Um par nascer/pôr, ou a explicação de por que ele não existe. */
export interface SolarEvents {
  /** Instante em que o sol sobe pelo limiar. `null` em dia ou noite polar. */
  rise: Date | null;
  /** Instante em que o sol desce pelo limiar. `null` em dia ou noite polar. */
  set: Date | null;
  /** Meio-dia solar do ciclo consultado — sempre existe. */
  transit: Date;
  /** `true` quando o sol não cruza o limiar naquele dia (polar, os dois lados). */
  polar: boolean;
}

/**
 * Nascer e pôr do sol do **dia solar mais próximo** do instante dado.
 *
 * "Dia solar mais próximo" e não "dia do calendário": o ciclo é indexado pelo
 * meio-dia solar local mais próximo de `date`, o que dispensa saber em que fuso
 * o lugar está. Às 23h de uma terça o ciclo ainda é o de terça; à 1h da manhã
 * de quarta já é o de quarta, e o `rise` devolvido é o da manhã que vem.
 *
 * `altitudeDeg` escolhe o evento: `SUNRISE_DEG` dá nascer/pôr do sol,
 * `CIVIL_TWILIGHT_DEG` dá alvorada/crepúsculo.
 */
export function solarEvents(
  date: Date,
  coords: Coords,
  altitudeDeg: number = SUNRISE_DEG,
): SolarEvents {
  return eventsForCycle(cycleNear(date, coords), coords, altitudeDeg);
}

/**
 * Índice do meio-dia solar local mais próximo de `date`.
 *
 * A longitude entra como fração de dia — 360° valem 24 h de deslocamento do
 * meio-dia — e entra **com o sinal trocado**, porque `lon` aqui é leste-positiva
 * e a equação clássica é escrita em longitude oeste. Errar esse sinal não
 * quebra nada de forma visível: o dia continua tendo a duração certa, só nasce
 * e se põe deslocado do dobro da distância ao meridiano de Greenwich.
 */
function cycleNear(date: Date, coords: Coords): number {
  return Math.round(daysSinceJ2000(date) + coords.lon / 360);
}

/**
 * Velocidade com que o ângulo horário avança, em graus por hora.
 *
 * 15,041 e não 15: o sol volta ao meridiano a cada dia **solar**, mas o ângulo
 * horário é medido contra as estrelas, que giram um pouco mais rápido.
 */
const HOUR_ANGLE_DEG_PER_HOUR = 360.9856235 / 24;

/**
 * Resolve nascer, pôr e meio-dia de um ciclo.
 *
 * **A fórmula analítica só serve de chute.** Ela é a "equação do nascer do sol"
 * clássica, e carrega os erros das aproximações que a compõem — em Bruxelas,
 * no fim de agosto, ela erra o pôr do sol em 1min45s. O que o módulo devolve é
 * o resultado de refinar esse chute contra `sunPosition()`, por Newton, até o
 * instante em que a altitude realmente cruza o limiar.
 *
 * O ganho não é só de precisão, é de **consistência**: o app decide o esquema
 * por altitude e agenda o timer por evento. Se as duas contas fossem
 * independentes, o timer acordaria o app num instante em que a altitude ainda
 * não virou, e o tema ficaria trocando de ideia na borda. Com o refinamento,
 * as duas respostas vêm do mesmo modelo por construção.
 */
function eventsForCycle(cycle: number, coords: Coords, altitudeDeg: number): SolarEvents {
  const approx = cycle - coords.lon / 360;
  const m = meanAnomaly(approx);
  const lambda = eclipticLongitude(approx);

  // Equação do tempo, embutida: o meio-dia solar verdadeiro se afasta do médio
  // em até ~16 min ao longo do ano.
  const seedTransit = approx + 0.0053 * Math.sin(m) - 0.0069 * Math.sin(2 * lambda);
  const dec = declination(lambda, obliquity(approx));

  const phi = RAD * coords.lat;
  const cosH =
    (Math.sin(RAD * altitudeDeg) - Math.sin(phi) * Math.sin(dec)) /
    (Math.cos(phi) * Math.cos(dec));

  const transit = refineTransit(dateFromDays(seedTransit), coords);
  // |cosH| > 1 é a assinatura de dia ou noite polar: não há ângulo horário em
  // que o sol cruze aquele limiar. Não é erro nem borda — é o Ártico.
  if (!(cosH > -1 && cosH < 1)) {
    return { rise: null, set: null, transit, polar: true };
  }

  const halfDayMs = (Math.acos(cosH) / (2 * Math.PI)) * DAY_MS;
  return {
    rise: refineCrossing(new Date(transit.getTime() - halfDayMs), coords, altitudeDeg),
    set: refineCrossing(new Date(transit.getTime() + halfDayMs), coords, altitudeDeg),
    transit,
    polar: false,
  };
}

/** Empurra o chute até o ângulo horário zerar — o meio-dia solar de verdade. */
function refineTransit(seed: Date, coords: Coords): Date {
  let t = seed.getTime();
  for (let i = 0; i < 2; i += 1) {
    const { hourAngle } = sunPosition(new Date(t), coords);
    t -= (hourAngle / HOUR_ANGLE_DEG_PER_HOUR) * 3_600_000;
  }
  return new Date(t);
}

/**
 * Empurra o chute até a altitude bater no limiar.
 *
 * A derivada sai por diferença finita de um minuto em vez de analiticamente:
 * são duas linhas em vez de uma dúzia, o custo é uma avaliação a mais por
 * passo, e não há uma segunda expressão para divergir da primeira.
 *
 * O passo é limitado a 30 min porque em latitude alta, no dia em que o sol
 * raspa o horizonte, a derivada quase zera e Newton dispara para longe. Com o
 * limite, o pior caso é convergir devagar; sem ele, é devolver um horário de
 * outro dia.
 */
function refineCrossing(seed: Date, coords: Coords, altitudeDeg: number): Date {
  let t = seed.getTime();
  for (let i = 0; i < 3; i += 1) {
    const here = solarAltitude(new Date(t), coords);
    const ahead = solarAltitude(new Date(t + 60_000), coords);
    const slope = (ahead - here) / 60_000; // graus por milissegundo
    if (Math.abs(slope) < 1e-12) break;
    const step = (altitudeDeg - here) / slope;
    t += Math.max(-1_800_000, Math.min(1_800_000, step));
  }
  return new Date(t);
}

function dateFromDays(days: number): Date {
  return new Date(J2000_MS + days * DAY_MS);
}

/**
 * Próximo instante em que o sol cruza `altitudeDeg`, depois de `date`.
 *
 * `null` em dia ou noite polar — não há travessia para prever, e quem agenda
 * deve reconsultar mais tarde em vez de esperar por um instante que não vem.
 * Percorre no máximo três ciclos para não voltar `null` por um empate de borda
 * (o instante consultado cair exatamente sobre um evento).
 */
export function nextSolarCrossing(
  date: Date,
  coords: Coords,
  altitudeDeg: number = SUNRISE_DEG,
): Date | null {
  const cycle = cycleNear(date, coords);
  for (let i = 0; i <= 2; i += 1) {
    const { rise, set } = eventsForCycle(cycle + i, coords, altitudeDeg);
    if (!rise || !set) return null;
    if (rise > date) return rise;
    if (set > date) return set;
  }
  return null;
}
