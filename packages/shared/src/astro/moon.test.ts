/**
 * Testes de moonPhase — puros, sem framework. Rodar com:
 *   cd packages/shared && npx tsx src/astro/moon.test.ts
 *
 * Os valores de referência vieram da efeméride oficial da NASA
 * (`svs.gsfc.nasa.gov/api/dialamoon`, visualização "Moon Phase and Libration
 * 2026"), consultada em 26/08/2026. São a única fonte de verdade aqui: se um
 * refinamento na conta afastar qualquer instante além da tolerância, é a conta
 * que está errada, não o teste.
 *
 * O instante das fases (story 4.1) tem outra referência: o **USNO**
 * (`aa.usno.navy.mil/api/moon/phases/year`), consultado em 17/09/2026 para 2023 a
 * 2027 e transcrito em `moon-usno.data.ts`. O USNO publica em UT e ao **minuto**.
 * A tolerância é de 2 min por fase e, sobre os erros com sinal das 247, de 30 s
 * para a média e para o RMS; o pior erro, a média e o RMS medidos aparecem no fim
 * da execução.
 *
 * A média medida (+10 s) **não** é o arredondamento ao minuto: arredondamento
 * uniforme daria média perto de zero, com erro-padrão de ~1,1 s sobre 247 fases
 * (σ ≈ 17,3 s por fase), e +10 s fica a ~9 erros-padrão disso. É viés
 * sistemático de causa não determinada — o USNO pode truncar em vez de
 * arredondar, ou o viés pode ser da própria série —, dentro do limite de 30 s.
 */
import assert from 'node:assert/strict';
import * as moon from './moon';
import {
  MOON_SHADE_ALPHA,
  lunarPhaseInstant,
  lunarPhasesBetween,
  moonPhase,
  moonPhaseLabel,
  moonPhaseName,
  moonShadeAlphaFor,
  moonShadowPath,
  nextLunarPhase,
  type LunarPhaseKind,
} from './moon';
import { USNO_FASES_2023_2027 } from './moon-usno.data';

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

/* ─────────────────────── O instante das fases (Meeus 49) ─────────────────────── */

const MIN_MS = 60_000;
const DAY_MS = 86_400_000;
/** 2 min: a resolução do USNO ao minuto cabe inteira, arredonde ele ou trunque, e sobra para a conta. */
const TOLERANCIA_FASE_MS = 2 * MIN_MS;
/**
 * 30 s para o viés (|média|) e para a dispersão (RMS) dos erros com sinal.
 *
 * Os 2 min por fase sozinhos não bastavam, e isso foi provado na revisão: com o
 * ΔT zerado o pior erro dava exatamente 120 s e passava; sem os 14 termos
 * planetários, 113 s, e passava também. Um defeito que empurra **todas** as
 * fases fica escondido num limite por fase e aparece na média. Medido na revisão
 * (média / RMS): a conta certa, 10,4 s / 21,1 s; ΔT zerado, 79,6 s / 81,7 s; sem
 * os planetários, 41,9 s / 49,4 s.
 */
const TOLERANCIA_VIES_S = 30;
const TOLERANCIA_RMS_S = 30;
const ORDEM: readonly LunarPhaseKind[] = ['new', 'firstQuarter', 'full', 'lastQuarter'];

let piorFaseMs = 0;
let piorFase = '';
/** Erro com sinal de cada fase, em segundos: positivo é a conta depois do USNO. */
const errosComSinalS: number[] = [];
let mediaS = Number.NaN;
let rmsS = Number.NaN;

check('fases — as 247 de 2023 a 2027 batem com o USNO dentro de 2 min', () => {
  assert.equal(USNO_FASES_2023_2027.length, 247, 'a tabela do USNO perdeu linha');
  // A lista calculada em volta da tabela inteira, e não fase por fase: assim uma
  // fase que a conta inventasse, ou perdesse, aparece como contagem errada em vez
  // de passar por não ter com quem ser comparada.
  const primeira = new Date(USNO_FASES_2023_2027[0][1]).getTime();
  const ultima = new Date(USNO_FASES_2023_2027[USNO_FASES_2023_2027.length - 1][1]).getTime();
  const calc = lunarPhasesBetween(new Date(primeira - DAY_MS), new Date(ultima + DAY_MS));
  assert.equal(calc.length, USNO_FASES_2023_2027.length, 'a conta e o USNO não têm as mesmas fases');
  USNO_FASES_2023_2027.forEach(([kind, iso], i) => {
    const got = calc[i];
    assert.equal(got.kind, kind, `${iso}: USNO diz ${kind}, a conta diz ${got.kind}`);
    const comSinal = got.instant.getTime() - new Date(iso).getTime();
    errosComSinalS.push(comSinal / 1000);
    const dif = Math.abs(comSinal);
    if (dif > piorFaseMs) {
      piorFaseMs = dif;
      piorFase = `${kind} de ${iso}`;
    }
    assert.ok(
      dif <= TOLERANCIA_FASE_MS,
      `${kind} ${iso}: calculado ${got.instant.toISOString()} — ${(dif / 1000).toFixed(0)} s de diferença`,
    );
    // E o instante isolado é o mesmo que a lista devolve.
    assert.equal(lunarPhaseInstant(got.kind, got.lunacao).getTime(), got.instant.getTime());
  });
});

check('fases — viés e dispersão contra o USNO: |média| ≤ 30 s e RMS ≤ 30 s nas 247', () => {
  assert.equal(errosComSinalS.length, 247, 'a comparação por fase não rodou sobre a tabela inteira');
  mediaS = errosComSinalS.reduce((a, b) => a + b, 0) / errosComSinalS.length;
  rmsS = Math.sqrt(errosComSinalS.reduce((a, b) => a + b * b, 0) / errosComSinalS.length);
  assert.ok(
    Math.abs(mediaS) <= TOLERANCIA_VIES_S,
    `viés de ${mediaS.toFixed(1)} s contra o USNO — todas as fases andaram juntas (ΔT? termos planetários?)`,
  );
  assert.ok(rmsS <= TOLERANCIA_RMS_S, `RMS de ${rmsS.toFixed(1)} s contra o USNO`);
});

check('fases — nova → crescente → cheia → minguante, sem buraco nem repetição', () => {
  const fases = lunarPhasesBetween(new Date('2023-01-01T00:00:00Z'), new Date('2028-01-01T00:00:00Z'));
  for (let i = 1; i < fases.length; i += 1) {
    const [a, b] = [fases[i - 1], fases[i]];
    const esperada = ORDEM[(ORDEM.indexOf(a.kind) + 1) % 4];
    assert.equal(b.kind, esperada, `${b.instant.toISOString()}: depois de ${a.kind} veio ${b.kind}`);
    // A lunação só vira na nova, e vira de um em um.
    assert.equal(b.lunacao, b.kind === 'new' ? a.lunacao + 1 : a.lunacao, b.instant.toISOString());
    // Entre duas fases principais vão de 6,6 a 8,2 dias (medido de 2023 a 2027);
    // um buraco de fase inteira daria ~15, e uma repetição, ~0.
    const dias = (b.instant.getTime() - a.instant.getTime()) / DAY_MS;
    assert.ok(dias > 5 && dias < 9, `${a.kind} → ${b.kind} em ${dias.toFixed(2)} dias`);
  }
});

check('fases — anos encostados não contam a mesma fase duas vezes: [de, ate)', () => {
  // As contagens por ano são as do USNO: 49, 50, 49, 50, 49.
  const porAno = [2023, 2024, 2025, 2026, 2027].map(
    (a) => lunarPhasesBetween(new Date(Date.UTC(a, 0, 1)), new Date(Date.UTC(a + 1, 0, 1))).length,
  );
  const porAnoUsno = [2023, 2024, 2025, 2026, 2027].map(
    (a) => USNO_FASES_2023_2027.filter(([, iso]) => iso.startsWith(String(a))).length,
  );
  assert.deepEqual(porAno, porAnoUsno);
  // A borda: o próprio instante entra à esquerda e sai à direita.
  const cheia = lunarPhaseInstant('full', 320);
  const t = cheia.getTime();
  assert.equal(lunarPhasesBetween(cheia, new Date(t + 1)).length, 1);
  assert.equal(lunarPhasesBetween(new Date(t - 1), cheia).length, 0);
  assert.deepEqual(lunarPhasesBetween(cheia, cheia), []);
  assert.deepEqual(lunarPhasesBetween(new Date(t + DAY_MS), cheia), [], 'intervalo invertido é vazio');
});

check('fases — o limite de cima de lunarPhasesBetween não perde a fase logo antes de `ate`', () => {
  // Achado da revisão: sem o `+ 1` do limite superior, 33 das 62 luas novas sumiam
  // quando `ate` caía até ~13 h depois delas — e as duas suítes seguiam verdes,
  // porque todo intervalo testado terminava longe de qualquer fase. Aqui `ate` fica
  // colado em cada uma das 247 fases do USNO, das quatro, e não só da nova.
  //
  // `ate = t + 2 min`, e não `t + 60 s`: a tolerância por fase é de 2 min, e um `ate`
  // mais curto reprovaria uma fase atrasada que a tolerância aceita — o teste
  // passaria a medir precisão em vez do limite do intervalo.
  for (const [kind, iso] of USNO_FASES_2023_2027) {
    const t = Date.parse(iso);
    const achadas = lunarPhasesBetween(new Date(t - DAY_MS), new Date(t + TOLERANCIA_FASE_MS))
      .filter((f) => f.kind === kind && Math.abs(f.instant.getTime() - t) <= TOLERANCIA_FASE_MS);
    assert.equal(achadas.length, 1, `${kind} de ${iso}: lunarPhasesBetween(t − 1 d, t + 2 min) não a devolveu`);
  }
});

check('fases — nextLunarPhase e lunarPhasesBetween concordam, a cada 6 h de 2023 a 2027', () => {
  // As duas funções acham a lunação por caminhos diferentes (o chute de uma lunação
  // atrás e os dois limites do intervalo). Um erro de borda em qualquer um deles
  // aparece como discordância em algum destes 7.304 instantes × 4 fases.
  let instantes = 0;
  for (let t = Date.UTC(2023, 0, 1); t < Date.UTC(2028, 0, 1); t += 6 * 3_600_000) {
    const depois = lunarPhasesBetween(new Date(t + 1), new Date(t + 40 * DAY_MS));
    for (const kind of ORDEM) {
      const primeira = depois.find((f) => f.kind === kind);
      assert.ok(primeira, `${new Date(t).toISOString()}: nenhuma ${kind} em 40 dias`);
      const prox = nextLunarPhase(kind, new Date(t));
      assert.equal(
        prox.instant.getTime(),
        primeira.instant.getTime(),
        `${new Date(t).toISOString()} · ${kind}: next ${prox.instant.toISOString()}, between ${primeira.instant.toISOString()}`,
      );
      assert.equal(prox.lunacao, primeira.lunacao);
    }
    instantes += 1;
  }
  assert.equal(instantes, 7304);
});

check('fases — nextLunarPhase é ESTRITAMENTE depois de t', () => {
  for (const f of lunarPhasesBetween(new Date('2025-01-01T00:00:00Z'), new Date('2027-01-01T00:00:00Z'))) {
    const t = f.instant.getTime();
    // Um ms antes, a resposta é a própria fase.
    const antes = nextLunarPhase(f.kind, new Date(t - 1));
    assert.equal(antes.instant.getTime(), t, `${f.kind} ${f.instant.toISOString()}`);
    assert.equal(antes.lunacao, f.lunacao);
    // No instante exato, já é a da lunação seguinte.
    const no = nextLunarPhase(f.kind, f.instant);
    assert.equal(no.lunacao, f.lunacao + 1, `${f.kind} ${f.instant.toISOString()} devolveu a si mesma`);
    assert.ok(no.instant.getTime() > t);
    assert.equal(no.kind, f.kind);
  }
});

check('fases — conferência cruzada com moonPhase: cheia é cheia, nova é nova, quartos são quartos', () => {
  // Duas contas independentes (Meeus 47 de baixa precisão e Meeus 49) têm de
  // concordar no que o olho vê. Uma troca de sinal na fração da fase — um quarto
  // no lugar do outro — cairia aqui: nos quartos, a iluminação é a mesma e só o
  // `waxing` separa crescente de minguante.
  //
  // A faixa dos quartos é |iluminação − 0,5| ≤ 0,02. Medido de 2023 a 2027, o maior
  // afastamento é de 0,0034 — a faixa passa com folga de ~6 vezes.
  let minCheia = 1;
  let maxNova = 0;
  let maxQuarto = 0;
  for (const f of lunarPhasesBetween(new Date('2023-01-01T00:00:00Z'), new Date('2028-01-01T00:00:00Z'))) {
    const k = moonPhase(f.instant).illuminated;
    if (f.kind === 'full') {
      minCheia = Math.min(minCheia, k);
      assert.ok(k > 0.98, `cheia de ${f.instant.toISOString()} com ${(k * 100).toFixed(1)}%`);
    }
    if (f.kind === 'new') {
      maxNova = Math.max(maxNova, k);
      assert.ok(k < 0.02, `nova de ${f.instant.toISOString()} com ${(k * 100).toFixed(1)}%`);
    }
    if (f.kind === 'firstQuarter' || f.kind === 'lastQuarter') {
      const { waxing } = moonPhase(f.instant);
      maxQuarto = Math.max(maxQuarto, Math.abs(k - 0.5));
      assert.ok(Math.abs(k - 0.5) <= 0.02, `${f.kind} de ${f.instant.toISOString()} com ${(k * 100).toFixed(1)}%`);
      assert.equal(waxing, f.kind === 'firstQuarter', `${f.kind} de ${f.instant.toISOString()} com waxing=${waxing}`);
    }
  }
  console.log(
    `     · cheia com no mínimo ${(minCheia * 100).toFixed(2)}% · nova com no máximo ${(maxNova * 100).toFixed(2)}%`
    + ` · quartos a no máximo ${(maxQuarto * 100).toFixed(2)} pp de 50%`,
  );
});

check('fases — nenhum export fala em idade', () => {
  // A recusa do docblock, cobrada: o instante entrou, a idade não.
  const nomes = Object.keys(moon).filter((n) => /age|idade/i.test(n));
  assert.deepEqual(nomes, [], `export com idade: ${nomes.join(', ')}`);
  const evento = nextLunarPhase('full', new Date('2026-09-17T00:00:00Z'));
  assert.deepEqual(Object.keys(evento).sort(), ['instant', 'kind', 'lunacao']);
});

check('fases — entrada torta é RangeError, não laço nem data inventada', () => {
  assert.throws(() => lunarPhaseInstant('full', 1.5), RangeError);
  assert.throws(() => lunarPhaseInstant('full', Number.NaN), RangeError);
  // Inteira, mas fora do alcance do Date: antes devolvia `Invalid Date` calado.
  assert.throws(() => lunarPhaseInstant('full', 1e12), RangeError);
  // Fase que o tipo não conhece, vinda de um chamador sem tipo.
  assert.throws(() => lunarPhaseInstant('Full' as LunarPhaseKind, 3), RangeError);
  assert.throws(() => nextLunarPhase('cheia' as LunarPhaseKind, new Date('2026-01-01T00:00:00Z')), RangeError);
  assert.throws(() => lunarPhaseInstant('toString' as LunarPhaseKind, 3), RangeError);
  assert.throws(() => nextLunarPhase('full', new Date('nao-e-data')), RangeError);
  assert.throws(() => lunarPhasesBetween(new Date(Number.NaN), new Date('2026-01-01T00:00:00Z')), RangeError);
});

console.log(`\n${passed} testes de moon.ts passaram.`);
console.log(
  `Erro das fases contra o USNO: pior ${(piorFaseMs / 1000).toFixed(0)} s (${piorFase})`
  + ` · média ${mediaS.toFixed(1)} s · RMS ${rmsS.toFixed(1)} s.`,
);
