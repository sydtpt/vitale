/**
 * Testes de moonPhase — puros, sem framework. Rodar com:
 *   cd packages/shared && npx tsx src/astro/moon.test.ts
 *
 * Os valores de referência vieram da efeméride oficial da NASA
 * (`svs.gsfc.nasa.gov/api/dialamoon`, visualização "Moon Phase and Libration
 * 2026"), consultada em 26/08/2026. São a única fonte de verdade aqui: se um
 * refinamento na conta afastar qualquer instante além da tolerância, é a conta
 * que está errada, não o teste.
 */
import assert from 'node:assert/strict';
import {
  MOON_SHADE_ALPHA,
  moonPhase,
  moonPhaseLabel,
  moonPhaseName,
  moonShadeAlphaFor,
  moonShadowPath,
} from './moon';

let passed = 0;
function check(name: string, fn: () => void): void {
  fn();
  passed += 1;
  console.log(`  ok ${name}`);
}

/** [instante UTC, % iluminada segundo a NASA, crescente?] */
const EPHEMERIS: ReadonlyArray<readonly [string, number, boolean]> = [
  ['2026-08-12T22:00:00Z', 0.05, true],
  ['2026-08-16T22:00:00Z', 20.29, true],
  ['2026-08-19T22:00:00Z', 48.21, true],
  ['2026-08-23T22:00:00Z', 83.21, true],
  ['2026-08-26T16:00:00Z', 97.66, true],
  ['2026-09-01T22:00:00Z', 76.09, false],
  ['2026-09-04T22:00:00Z', 43.36, false],
  ['2026-09-08T22:00:00Z', 6.29, false],
  ['2026-12-23T20:00:00Z', 99.79, true],
];

/** Ponto (x, y) do caminho, para conferir geometria sem parsear SVG. */
const TOLERANCE_PP = 0.2;

check('bate com a efeméride da NASA dentro de 0,2 ponto percentual', () => {
  let worst = 0;
  for (const [iso, nasa] of EPHEMERIS) {
    const got = moonPhase(new Date(iso)).illuminated * 100;
    const err = Math.abs(got - nasa);
    worst = Math.max(worst, err);
    assert.ok(
      err <= TOLERANCE_PP,
      `${iso}: calculado ${got.toFixed(2)}%, NASA ${nasa.toFixed(2)}% (erro ${err.toFixed(2)} pp)`,
    );
  }
  console.log(`     erro máximo: ${worst.toFixed(2)} pp`);
});

check('acerta o sentido fora dos extremos', () => {
  for (const [iso, nasa, waxing] of EPHEMERIS) {
    // Na cheia o sentido não significa nada — o terminador não existe.
    if (nasa > 99) continue;
    assert.equal(moonPhase(new Date(iso)).waxing, waxing, iso);
  }
});

check('a fração fica sempre em [0, 1]', () => {
  const start = Date.UTC(2026, 0, 1);
  for (let h = 0; h < 24 * 400; h += 7) {
    const k = moonPhase(new Date(start + h * 3_600_000)).illuminated;
    assert.ok(k >= 0 && k <= 1, `iluminação fora de faixa: ${k}`);
  }
});

check('nomeia as fases', () => {
  assert.equal(moonPhaseName({ illuminated: 0.004, waxing: true }), 'Lua nova');
  assert.equal(moonPhaseName({ illuminated: 0.999, waxing: false }), 'Lua cheia');
  assert.equal(moonPhaseName({ illuminated: 0.5, waxing: true }), 'Quarto crescente');
  assert.equal(moonPhaseName({ illuminated: 0.5, waxing: false }), 'Quarto minguante');
  assert.equal(moonPhaseName({ illuminated: 0.2, waxing: true }), 'Crescente côncava');
  assert.equal(moonPhaseName({ illuminated: 0.83, waxing: false }), 'Minguante gibosa');
  assert.equal(moonPhaseLabel({ illuminated: 0.832, waxing: true }), 'Crescente gibosa, 83% iluminada');
});

check('a sombra cobre o disco na nova e some na cheia', () => {
  // Nova: o terminador tem o mesmo raio do limbo, então a figura é o disco todo.
  assert.match(moonShadowPath(100, { illuminated: 0, waxing: true }), /A 100 100 0 0 0 0 100 A 100 100/);
  // Cheia: o terminador volta pelo mesmo lado do limbo — área zero.
  assert.equal(
    moonShadowPath(100, { illuminated: 1, waxing: true }),
    'M 0 -100 A 100 100 0 0 0 0 100 A 100 100 0 0 1 0 -100 Z',
  );
});

check('no quarto o terminador degenera em reta', () => {
  const d = moonShadowPath(100, { illuminated: 0.5, waxing: true });
  // `rx = 0` é como o SVG desenha um segmento em vez de um arco.
  assert.ok(d.includes('A 0 100'), d);
});

check('crescente e minguante são espelhos na varredura do limbo', () => {
  const cres = moonShadowPath(50, { illuminated: 0.3, waxing: true });
  const ming = moonShadowPath(50, { illuminated: 0.3, waxing: false });
  assert.notEqual(cres, ming);
  assert.ok(cres.includes('A 50 50 0 0 0 0 50'), cres); // limbo pela esquerda
  assert.ok(ming.includes('A 50 50 0 0 1 0 50'), ming); // limbo pela direita
});

check('a rampa de opacidade só age nas fases finas', () => {
  const gorda = { illuminated: 0.6, waxing: true };
  assert.equal(moonShadeAlphaFor('light', gorda), MOON_SHADE_ALPHA.light);
  assert.equal(moonShadeAlphaFor('dark', gorda), MOON_SHADE_ALPHA.dark);

  // No limite de cima ainda é o valor base; no de baixo já chegou a 0,90.
  assert.equal(moonShadeAlphaFor('light', { illuminated: 0.2, waxing: true }), MOON_SHADE_ALPHA.light);
  assert.equal(moonShadeAlphaFor('light', { illuminated: 0.1, waxing: true }), 0.9);
  assert.equal(moonShadeAlphaFor('light', { illuminated: 0, waxing: true }), 0.9);

  // No meio da rampa, monotônica e dentro dos dois extremos.
  const meio = moonShadeAlphaFor('light', { illuminated: 0.15, waxing: true });
  assert.ok(meio > MOON_SHADE_ALPHA.light && meio < 0.9, `rampa fora de faixa: ${meio}`);

  // No escuro a rampa não tem o que corrigir: base e teto coincidem.
  assert.equal(moonShadeAlphaFor('dark', { illuminated: 0.05, waxing: true }), MOON_SHADE_ALPHA.dark);
});

console.log(`\n${passed} testes de moon.ts passaram.`);
