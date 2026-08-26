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
