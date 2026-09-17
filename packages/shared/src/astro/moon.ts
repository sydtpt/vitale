/**
 * Fase da lua — puro, offline, sem dependência.
 *
 * ## Por que calcular em vez de baixar
 *
 * A NASA publica um render por hora do ano inteiro (`api/dialamoon`), com
 * relevo e libração reais. Seria mais bonito e é inviável: dependeria de rede
 * no caminho de render do cabeçalho, ou de embutir ~8.700 quadros no bundle.
 * O caminho escolhido é uma foto só de lua cheia (LRO/NASA, domínio público) e
 * a sombra desenhada por cima — o que exige saber a fração iluminada.
 *
 * ## A precisão que isto tem
 *
 * Meeus de baixa precisão: posição do Sol, posição da Lua com os seis termos
 * principais, elongação, ângulo de fase. Conferido contra a efeméride da NASA
 * em sete instantes espalhados por 2026, o **erro máximo é de 0,13 ponto
 * percentual** de iluminação (`moon.test.ts`). A 64 pt de diâmetro, isso é
 * menos de um pixel de terminador — não há motivo para ir a Meeus completo.
 *
 * O que este módulo **não** devolve é a idade em dias. Ela sai da elongação com
 * até ~0,8 dia de erro, porque a lua não percorre a órbita em velocidade
 * constante; quem precisar de idade precisa dos termos que ficaram de fora.
 *
 * ## O instante das fases é outra conta, e não a idade por outro caminho
 *
 * Quem precisa saber *quanto falta para a cheia* — o teste lunar da revista, que
 * separa as cinco noites antes dela — não pode tirar isso da fração iluminada:
 * 0,8 dia numa janela de cinco noites embaralha a coluna testada com a de
 * controle, e nenhum teste de formato reprova. Por isso as fases principais têm
 * conta própria, `lunarPhaseInstant()`: Meeus cap. 49, com as correções
 * periódicas, as planetárias e o `W` dos quartos. Contra as 247 fases do USNO de
 * 2023 a 2027, `moon.test.ts` cobra **2 min por fase** e, sobre os erros com
 * sinal de todas elas, **|média| ≤ 30 s e RMS ≤ 30 s** — a tolerância por fase
 * sozinha deixava passar o ΔT zerado e os termos planetários removidos. O teste
 * imprime o pior erro, a média e o RMS medidos.
 *
 * A média medida é de **+10 s** (a conta depois do USNO), e isso **não** é o
 * arredondamento do USNO ao minuto: arredondamento uniforme dá σ ≈ 17,3 s por
 * fase e erro-padrão da média ≈ 1,1 s sobre 247 fases, e +10 s fica a ~9 erros-
 * padrão de zero. É viés sistemático, de causa não determinada — o USNO pode
 * truncar em vez de arredondar, ou o viés pode ser da própria série de Meeus — e
 * fica dentro do limite de 30 s. `moonPhase()` não
 * foi tocada: ela continua servindo o desenho, e serve de conferência cruzada —
 * no instante da cheia ela tem de dizer cheia.
 *
 * O que sai é o **instante** de cada fase, nunca uma idade: a distância até ele
 * é conta de quem chama, com o instante certo nas mãos.
 *
 * ## Hemisfério
 *
 * `waxing` significa "iluminada à direita", que é a leitura do **hemisfério
 * norte** — onde o app é usado. No sul a imagem é espelhada. Se um dia isso
 * importar, o espelho é do desenho (inverter o `x` do caminho), não da conta.
 */

const RAD = Math.PI / 180;

export interface MoonPhase {
  /** Fração iluminada do disco, 0 (nova) a 1 (cheia). */
  illuminated: number;
  /** `true` quando a lua está crescendo — iluminada à direita, no norte. */
  waxing: boolean;
}

/** Fase da lua no instante dado. */
export function moonPhase(date: Date): MoonPhase {
  const d = (date.getTime() - Date.UTC(2000, 0, 1, 12)) / 86_400_000;

  // Sol (Meeus 25, baixa precisão).
  const sunAnomaly = RAD * (357.5291 + 0.98560028 * d);
  const sunMeanLon = RAD * (280.459 + 0.98564736 * d);
  const sunLon =
    sunMeanLon +
    RAD *
      (1.9148 * Math.sin(sunAnomaly) +
        0.02 * Math.sin(2 * sunAnomaly) +
        0.0003 * Math.sin(3 * sunAnomaly));
  const sunDist =
    (1.00014 - 0.01671 * Math.cos(sunAnomaly) - 0.00014 * Math.cos(2 * sunAnomaly)) *
    149_597_870.7; // UA → km

  // Lua (Meeus 47, os seis termos que dominam).
  const meanLon = RAD * (218.316 + 13.176396 * d);
  const anomaly = RAD * (134.963 + 13.064993 * d);
  const elong = RAD * (297.8502 + 12.19074912 * d);
  const argLat = RAD * (93.272 + 13.22935 * d);

  const moonLon =
    meanLon +
    RAD *
      (6.289 * Math.sin(anomaly) +
        1.274 * Math.sin(2 * elong - anomaly) +
        0.658 * Math.sin(2 * elong) +
        0.214 * Math.sin(2 * anomaly) -
        0.186 * Math.sin(sunAnomaly) -
        0.114 * Math.sin(2 * argLat));
  const moonLat =
    RAD *
    (5.128 * Math.sin(argLat) +
      0.281 * Math.sin(anomaly + argLat) -
      0.278 * Math.sin(argLat - anomaly));
  const moonDist =
    385_001 -
    20_905 * Math.cos(anomaly) -
    3_699 * Math.cos(2 * elong - anomaly) -
    2_956 * Math.cos(2 * elong);

  const delta = moonLon - sunLon;
  const cosPsi = Math.cos(moonLat) * Math.cos(delta);
  const psi = Math.acos(Math.max(-1, Math.min(1, cosPsi)));
  const phaseAngle = Math.atan2(sunDist * Math.sin(psi), moonDist - sunDist * cosPsi);

  return {
    illuminated: (1 + Math.cos(phaseAngle)) / 2,
    waxing: Math.sin(delta) > 0,
  };
}

/**
 * Nome da fase, para rótulo acessível.
 *
 * As faixas não são iguais: "nova" e "cheia" ganham 2% cada porque a olho nu
 * (e a 64 pt) nada distingue 99% de 100%, enquanto os quartos ganham 5% para
 * cada lado porque é onde o terminador vira uma reta e a leitura muda de
 * caráter.
 */
export function moonPhaseName(phase: MoonPhase): string {
  const { illuminated: k, waxing } = phase;
  if (k < 0.02) return 'Lua nova';
  if (k > 0.98) return 'Lua cheia';
  if (Math.abs(k - 0.5) < 0.05) return waxing ? 'Quarto crescente' : 'Quarto minguante';
  if (k < 0.5) return waxing ? 'Crescente côncava' : 'Minguante côncava';
  return waxing ? 'Crescente gibosa' : 'Minguante gibosa';
}

/** Rótulo completo — "Crescente gibosa, 83% iluminada". */
export function moonPhaseLabel(phase: MoonPhase): string {
  return `${moonPhaseName(phase)}, ${Math.round(phase.illuminated * 100)}% iluminada`;
}

/**
 * Caminho SVG da parte **não** iluminada, num disco de raio `r` centrado na
 * origem, com o eixo `y` para baixo (a convenção do SVG).
 *
 * A geometria é de duas peças: metade do limbo, que é um semicírculo de raio
 * `r`, e o terminador, que é meia elipse de semieixo `r·(1−2k)` — a projeção do
 * círculo que separa dia e noite na esfera. O sinal desse semieixo é o que faz
 * a sombra ser côncava ou convexa; quando `k = 0,5` ele zera e a elipse degenera
 * numa reta, que é exatamente o que o `A` do SVG desenha com `rx = 0`.
 */
export function moonShadowPath(r: number, phase: MoonPhase): string {
  const k = Math.max(0, Math.min(1, phase.illuminated));
  const offset = r * (1 - 2 * k);
  const rx = Math.abs(offset);

  // Varredura do limbo: 0 passa pela esquerda, 1 pela direita. A sombra fica do
  // lado oposto ao iluminado.
  const limb = phase.waxing ? 0 : 1;
  // Varredura do terminador: com `offset > 0` (lua fina) ele avança por cima do
  // hemisfério iluminado, e a varredura inverte.
  const term = phase.waxing ? (offset > 0 ? 0 : 1) : offset > 0 ? 1 : 0;

  return (
    `M 0 ${-r} A ${r} ${r} 0 0 ${limb} 0 ${r} ` +
    `A ${rx} ${r} 0 0 ${term} 0 ${-r} Z`
  );
}

/**
 * Opacidade da sombra por esquema.
 *
 * A sombra é preenchida com o **fundo do tema** (`moonShade`), não com preto:
 * a parte não iluminada dissolve na página em vez de virar um buraco. No escuro
 * isso sempre foi verdade por acaso — preto sobre fundo preto — e é por isso que
 * lá parecia certo; no claro, o mesmo preto media 17,79:1 de contraste contra o
 * branco, contra 2,81:1 da própria lua iluminada.
 *
 * Os dois valores são escolha visual, não medição:
 *
 * - **0,75 no claro** guarda o disco inteiro como um fantasma, que é o que se
 *   quis. Abaixo de ~15% de iluminação isso lê ao contrário — um disco pálido
 *   com uma mordida escura em vez de um crescente — porque a parte dissolvida
 *   fica mais clara que a iluminada e ainda tem borda. São ~3 dias por lunação.
 *   `moonShadeAlphaFor()` existe para quem quiser fechar esse buraco.
 * - **0,90 no escuro** apaga a parte não iluminada por completo, deixando o
 *   crescente sozinho no preto, como no céu.
 */
export const MOON_SHADE_ALPHA: Readonly<Record<'light' | 'dark', number>> = {
  light: 0.75,
  dark: 0.9,
};

/**
 * Opacidade do halo por esquema, na força "forte" — a escolhida.
 *
 * Assimétrica de propósito, e não por capricho: o halo é `moonGlow`, que é a
 * tinta do tema, e ele rende coisas muito diferentes nos dois esquemas. No
 * escuro é luar sobre preto e aparece com pouco; no claro é uma sombra sobre
 * branco, onde o mesmo valor seria invisível.
 */
export const MOON_GLOW_ALPHA: Readonly<Record<'light' | 'dark', number>> = {
  light: 0.22,
  dark: 0.48,
};

/**
 * Opacidade com rampa nas fases finas — a alternativa ao valor fixo.
 *
 * Mantém o `MOON_SHADE_ALPHA` do esquema no grosso do ciclo e sobe para 0,90
 * conforme a lua afina, onde o valor do claro inverteria a leitura. A rampa vai
 * de 20% a 10% de iluminação: acima disso a sombra não domina o disco e não há
 * o que corrigir; abaixo, já é crescente puro nos dois esquemas.
 */
export function moonShadeAlphaFor(scheme: 'light' | 'dark', phase: MoonPhase): number {
  const base = MOON_SHADE_ALPHA[scheme];
  const k = phase.illuminated;
  if (k >= 0.2) return base;
  const t = Math.max(0, Math.min(1, (0.2 - k) / 0.1));
  return base + (0.9 - base) * t;
}

// ── O instante das fases (Meeus 49) ────────────────────────

const DAY_MS = 86_400_000;

/** 2000-01-01 12:00 — a origem dos dias julianos de J2000.0, na convenção de `sun.ts`. */
const J2000_MS = Date.UTC(2000, 0, 1, 12);

/**
 * ΔT = TT − UT, em segundos, **constante**.
 *
 * As séries de Meeus devolvem o instante em Tempo Dinâmico (TT), e o USNO e o
 * relógio de quem chama falam em UT. De jan/2022 a abr/2026 o ΔT medido ficou
 * entre **69,09 s e 69,29 s** (USNO, `maia.usno.navy.mil/ser7/deltat.data`,
 * consultado em 17/09/2026), e o IERS Bulletin A de 10/09/2026 dá TAI − UTC = 37 s
 * com UT1 − UTC ≈ 0,00 s, o que fecha 32,184 + 37 − 0 ≈ 69,18 s. A variação é de
 * dois décimos de segundo — mais de cem vezes menor que o limite de 30 s do viés
 * que o teste cobra —, e por isso é constante declarada e não tabela. Longe desta
 * década ela deixa de valer (era 47,5 s em 1977), e o instante anda junto, na casa
 * dos segundos. Zerá-la desloca todas as fases ~69 s no mesmo sentido, e são os
 * limites sobre as 247 fases, não o de 2 min por fase, que reprovam isso.
 */
const DELTA_T_S = 69.2;

/** As quatro fases principais, na ordem em que acontecem dentro de uma lunação. */
export type LunarPhaseKind = 'new' | 'firstQuarter' | 'full' | 'lastQuarter';

/** Fração da lunação em que cada fase cai — o `k` de Meeus é `lunação + fração`. */
const PHASE_FRACTION: Readonly<Record<LunarPhaseKind, number>> = {
  new: 0,
  firstQuarter: 0.25,
  full: 0.5,
  lastQuarter: 0.75,
};

const PHASE_ORDER: readonly LunarPhaseKind[] = ['new', 'firstQuarter', 'full', 'lastQuarter'];

/** Mês sinódico médio, em dias (Meeus 49.1). */
const SYNODIC_DAYS = 29.530588861;

/** Uma fase principal: qual, de que lunação, e quando. */
export interface LunarPhaseEvent {
  kind: LunarPhaseKind;
  /**
   * A lunação na contagem de Meeus: a **0** começa na lua nova de 6/1/2000, e as
   * quatro fases de uma lunação dividem o mesmo número, na ordem nova →
   * crescente → cheia → minguante.
   */
  lunacao: number;
  /** O instante da fase, em UT. */
  instant: Date;
}

/**
 * O instante verdadeiro de uma fase principal da lua, em UT.
 *
 * Meeus, *Astronomical Algorithms*, 2ª ed., cap. 49: o instante médio (49.1), as
 * correções periódicas da fase — que são **outras** para os quartos, e é por
 * isso que eles ganham a sua tabela e o termo `W` —, e as 14 correções
 * planetárias, comuns às quatro. A série dá Tempo Dinâmico; o `DELTA_T_S` traz
 * para UT.
 *
 * `lunacao` é inteiro: `lunarPhaseInstant('new', 0)` é a lua nova de
 * 6/1/2000, e `lunarPhaseInstant('full', 0)` a cheia que vem depois dela.
 */
export function lunarPhaseInstant(kind: LunarPhaseKind, lunacao: number): Date {
  assertKind(kind);
  if (!Number.isInteger(lunacao)) {
    throw new RangeError(`lunação tem de ser inteira: ${lunacao}`);
  }
  const k = lunacao + PHASE_FRACTION[kind];
  const T = k / 1236.85;
  const T2 = T * T;
  const T3 = T2 * T;
  const T4 = T3 * T;

  // Dias desde J2000.0 do instante médio. A constante de Meeus é o JDE
  // 2451550,09766; escrita já descontada de 2451545,0 para não somar e subtrair
  // dois milhões e meio de dias à toa.
  let days = 5.09766 + SYNODIC_DAYS * k + 0.00015437 * T2 - 0.00000015 * T3 + 0.00000000073 * T4;

  // Excentricidade da órbita da Terra: os termos que dependem da anomalia do
  // Sol são multiplicados por ela (47.6).
  const E = 1 - 0.002516 * T - 0.0000074 * T2;
  const M = RAD * (2.5534 + 29.1053567 * k - 0.0000014 * T2 - 0.00000011 * T3);
  const Mp = RAD * (201.5643 + 385.81693528 * k + 0.0107582 * T2 + 0.00001238 * T3 - 0.000000058 * T4);
  const F = RAD * (160.7108 + 390.67050284 * k - 0.0016118 * T2 - 0.00000227 * T3 + 0.000000011 * T4);
  const Om = RAD * (124.7746 - 1.56375588 * k + 0.0020672 * T2 + 0.00000215 * T3);
  const sin = Math.sin;
  const cos = Math.cos;

  if (kind === 'new' || kind === 'full') {
    // Nova e cheia só diferem nos sete primeiros coeficientes (Meeus, tabela 49.A).
    const nova = kind === 'new';
    days +=
      (nova ? -0.4072 : -0.40614) * sin(Mp) +
      (nova ? 0.17241 : 0.17302) * E * sin(M) +
      (nova ? 0.01608 : 0.01614) * sin(2 * Mp) +
      (nova ? 0.01039 : 0.01043) * sin(2 * F) +
      (nova ? 0.00739 : 0.00734) * E * sin(Mp - M) -
      (nova ? 0.00514 : 0.00515) * E * sin(Mp + M) +
      (nova ? 0.00208 : 0.00209) * E * E * sin(2 * M) -
      0.00111 * sin(Mp - 2 * F) -
      0.00057 * sin(Mp + 2 * F) +
      0.00056 * E * sin(2 * Mp + M) -
      0.00042 * sin(3 * Mp) +
      0.00042 * E * sin(M + 2 * F) +
      0.00038 * E * sin(M - 2 * F) -
      0.00024 * E * sin(2 * Mp - M) -
      0.00017 * sin(Om) -
      0.00007 * sin(Mp + 2 * M) +
      0.00004 * sin(2 * Mp - 2 * F) +
      0.00004 * sin(3 * M) +
      0.00003 * sin(Mp + M - 2 * F) +
      0.00003 * sin(2 * Mp + 2 * F) -
      0.00003 * sin(Mp + M + 2 * F) +
      0.00003 * sin(Mp - M + 2 * F) -
      0.00002 * sin(Mp - M - 2 * F) -
      0.00002 * sin(3 * Mp + M) +
      0.00002 * sin(4 * Mp);
  } else {
    days +=
      -0.62801 * sin(Mp) +
      0.17172 * E * sin(M) -
      0.01183 * E * sin(Mp + M) +
      0.00862 * sin(2 * Mp) +
      0.00804 * sin(2 * F) +
      0.00454 * E * sin(Mp - M) +
      0.00204 * E * E * sin(2 * M) -
      0.0018 * sin(Mp - 2 * F) -
      0.0007 * sin(Mp + 2 * F) -
      0.0004 * sin(3 * Mp) -
      0.00034 * E * sin(2 * Mp - M) +
      0.00032 * E * sin(M + 2 * F) +
      0.00032 * E * sin(M - 2 * F) -
      0.00028 * E * E * sin(Mp + 2 * M) +
      0.00027 * E * sin(2 * Mp + M) -
      0.00017 * sin(Om) -
      0.00005 * sin(Mp - M - 2 * F) +
      0.00004 * sin(2 * Mp + 2 * F) -
      0.00004 * sin(Mp + M + 2 * F) +
      0.00004 * sin(Mp - 2 * M) +
      0.00003 * sin(Mp + M - 2 * F) +
      0.00003 * sin(3 * M) +
      0.00002 * sin(2 * Mp - 2 * F) +
      0.00002 * sin(Mp - M + 2 * F) -
      0.00002 * sin(3 * Mp + M);
    // O `W` é o que separa crescente de minguante: sem ele os dois quartos saem
    // deslocados em sentidos opostos, de 3 a 5 min cada.
    const W =
      0.00306 -
      0.00038 * E * cos(M) +
      0.00026 * cos(Mp) -
      0.00002 * cos(Mp - M) +
      0.00002 * cos(Mp + M) +
      0.00002 * cos(2 * F);
    days += kind === 'firstQuarter' ? W : -W;
  }

  // As 14 correções planetárias, iguais para as quatro fases.
  const A = (a0: number, a1: number, a2 = 0) => sin(RAD * (a0 + a1 * k + a2 * T2));
  days +=
    0.000325 * A(299.77, 0.107408, -0.009173) +
    0.000165 * A(251.88, 0.016321) +
    0.000164 * A(251.83, 26.651886) +
    0.000126 * A(349.42, 36.412478) +
    0.00011 * A(84.66, 18.206239) +
    0.000062 * A(141.74, 53.303771) +
    0.00006 * A(207.14, 2.453732) +
    0.000056 * A(154.84, 7.30686) +
    0.000047 * A(34.52, 27.261239) +
    0.000042 * A(207.19, 0.121824) +
    0.00004 * A(291.34, 1.844379) +
    0.000037 * A(161.72, 24.198154) +
    0.000035 * A(239.56, 25.513099) +
    0.000023 * A(331.55, 3.592518);

  // Uma lunação inteira mas enorme (`1e12`) passa no `isInteger` e sai do alcance
  // do `Date`: sem esta guarda, a resposta seria um `Invalid Date` calado.
  const instant = new Date(Math.round(J2000_MS + days * DAY_MS - DELTA_T_S * 1000));
  if (!Number.isFinite(instant.getTime())) {
    throw new RangeError(`a fase ${kind} da lunação ${lunacao} não cabe num Date`);
  }
  return instant;
}

/**
 * `kind` é tipado, mas um chamador sem tipo (`'Full'`, `'cheia'`) chega aqui em
 * tempo de execução e faria `k` virar `NaN`.
 */
function assertKind(kind: LunarPhaseKind): void {
  if (!Object.prototype.hasOwnProperty.call(PHASE_FRACTION, kind)) {
    throw new RangeError(`fase desconhecida: ${String(kind)}`);
  }
}

/**
 * A lunação média em que o instante cai, contada em lunações fracionárias.
 * Só serve de ponto de partida: o instante verdadeiro se afasta do médio em
 * menos de um dia, e quem usa isto confere contra `lunarPhaseInstant()`.
 */
function meanLunationAt(t: number): number {
  return ((t + DELTA_T_S * 1000 - J2000_MS) / DAY_MS - 5.09766) / SYNODIC_DAYS;
}

function assertInstant(nome: string, t: Date): number {
  const ms = t instanceof Date ? t.getTime() : Number.NaN;
  if (!Number.isFinite(ms)) throw new RangeError(`${nome} não é um instante: ${String(t)}`);
  return ms;
}

/**
 * A próxima fase `kind` **estritamente depois** de `t`.
 *
 * Estritamente: se `t` é o próprio instante da fase, a resposta é a da lunação
 * seguinte. É o que deixa a janela da cheia aberta à direita sem caso especial.
 */
export function nextLunarPhase(kind: LunarPhaseKind, t: Date): LunarPhaseEvent {
  assertKind(kind);
  const ms = assertInstant('t', t);
  // O chute fica uma lunação inteira atrás do médio. Como o verdadeiro se afasta
  // do médio em menos de um dia, a resposta sai no máximo na quarta avaliação
  // (`start + 3`); o laço faz cinco, uma de folga antes do `RangeError`.
  const start = Math.floor(meanLunationAt(ms) - PHASE_FRACTION[kind]) - 1;
  for (let lunacao = start; lunacao <= start + 4; lunacao += 1) {
    const instant = lunarPhaseInstant(kind, lunacao);
    if (instant.getTime() > ms) return { kind, lunacao, instant };
  }
  throw new RangeError(`nenhuma fase ${kind} depois de ${t.toISOString()}`);
}

/**
 * As fases principais com instante em **`[de, ate)`**, em ordem cronológica.
 *
 * Fechado à esquerda e aberto à direita, para que intervalos encostados — um ano
 * e o seguinte — não contem a mesma fase duas vezes.
 */
export function lunarPhasesBetween(de: Date, ate: Date): LunarPhaseEvent[] {
  const a = assertInstant('de', de);
  const b = assertInstant('ate', ate);
  if (b <= a) return [];
  const out: LunarPhaseEvent[] = [];
  const last = Math.floor(meanLunationAt(b)) + 1;
  for (let lunacao = Math.floor(meanLunationAt(a)) - 1; lunacao <= last; lunacao += 1) {
    for (const kind of PHASE_ORDER) {
      const instant = lunarPhaseInstant(kind, lunacao);
      const ms = instant.getTime();
      if (ms >= a && ms < b) out.push({ kind, lunacao, instant });
    }
  }
  return out.sort((x, y) => x.instant.getTime() - y.instant.getTime());
}
