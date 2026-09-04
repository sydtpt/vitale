/**
 * Rotas recorrentes.
 *
 * O que se protege aqui: a ligação **completa** (que impede o encadeamento por
 * transitividade que fundiu 36 corridas de 5 a 12 km num grupo só), o filtro de
 * distância como parte da definição — e não refinamento —, e o posto por ritmo,
 * em que quem não tem tempo fica **sem** posto em vez de em último.
 */

import assert from 'node:assert/strict';
import {
  ROUTE_CELL_M,
  ROUTE_MIN_GROUP,
  ROUTE_MIN_OVERLAP,
  effortOf,
  groupRecurringRoutes,
  routeCells,
  routeOf,
  routeOverlap,
  type RouteActivity,
} from './recurring-routes';

let passed = 0;
function check(name: string, fn: () => void): void {
  fn();
  passed += 1;
  console.log(`  ok ${name}`);
}

/** Traçado reto a partir de Bruxelas, `n` pontos separados por ~`stepM` metros. */
function track(n: number, stepM = 100, offsetM = 0): [number, number][] {
  const lat0 = 50.85;
  const lng0 = 4.35;
  const dLat = stepM / 111_320;
  const dLng = offsetM / (111_320 * Math.cos((lat0 * Math.PI) / 180));
  return Array.from({ length: n }, (_, i) => [lat0 + i * dLat, lng0 + dLng] as [number, number]);
}

/**
 * Trecho da **mesma** reta, dos passos `from` a `to`. Serve para montar traçados
 * que se sobrepõem parcialmente — o que um deslocamento lateral não faz, porque
 * joga tudo em células disjuntas.
 */
function segment(from: number, to: number, stepM = 200): [number, number][] {
  const lat0 = 50.85;
  const dLat = stepM / 111_320;
  return Array.from(
    { length: to - from },
    (_, i) => [lat0 + (from + i) * dLat, 4.35] as [number, number],
  );
}

let seq = 0;
function act(partial: Partial<RouteActivity> = {}): RouteActivity {
  seq += 1;
  return {
    id: `a${seq}`,
    points: track(60),
    distanceM: 6000,
    movingTimeS: 2160,
    startAt: `2026-0${1 + (seq % 9)}-1${seq % 10}T08:00:00Z`,
    ...partial,
  };
}

/* ───────────────────────── células e sobreposição ───────────────────────── */

check('células ignoram ponto malformado sem quebrar', () => {
  const bad = [[50.85, 4.35], [Number.NaN, 4.35], null, [50.86]] as unknown as [number, number][];
  const cells = routeCells(bad);
  assert.equal(cells.size, 1, 'só o ponto válido entra');
});

check('par e objeto produzem as mesmas células', () => {
  // A coluna guarda pares; `fetchRouteOverviews` entrega objetos. As duas formas
  // precisam cair nas mesmas células, senão o agrupamento depende de quem leu.
  const pares = track(40);
  const objetos = pares.map(([lat, lng]) => ({ lat, lng }));
  assert.deepEqual([...routeCells(pares)].sort(), [...routeCells(objetos)].sort());
  assert.equal(routeOverlap(routeCells(pares), routeCells(objetos)), 1);
});

check('o mesmo traçado tem sobreposição 1', () => {
  const c = routeCells(track(60));
  assert.equal(routeOverlap(c, c), 1);
});

check('traçados distantes não se sobrepõem', () => {
  const a = routeCells(track(60));
  const b = routeCells(track(60, 100, 5000));
  assert.equal(routeOverlap(a, b), 0);
});

check('conjunto vazio não divide por zero', () => {
  assert.equal(routeOverlap(new Set(), routeCells(track(20))), 0);
  assert.equal(routeOverlap(new Set(), new Set()), 0);
});

check('sentido invertido é a mesma rota', () => {
  const ida = track(60);
  const volta = [...ida].reverse();
  assert.equal(routeOverlap(routeCells(ida), routeCells(volta)), 1);
});

check('a célula tem o tamanho declarado', () => {
  // Dois pontos separados por bem mais que uma célula caem em células diferentes.
  const longe = routeCells(track(2, ROUTE_CELL_M * 3));
  assert.equal(longe.size, 2);
  // E dois pontos quase colados caem na mesma.
  const perto = routeCells(track(2, 1));
  assert.equal(perto.size, 1);
});

/* ───────────────────────────── agrupamento ───────────────────────────── */

check('três corridas iguais viram uma rota recorrente', () => {
  const r = groupRecurringRoutes([act(), act(), act()]);
  assert.equal(r.length, 1);
  assert.equal(r[0].count, 3);
});

check('duas repetições não bastam para o padrão', () => {
  assert.deepEqual(groupRecurringRoutes([act(), act()]), []);
  assert.equal(ROUTE_MIN_GROUP, 3, 'o padrão continua declarado');
});

check('rotas diferentes não se juntam', () => {
  const casa = [act(), act(), act()];
  const parque = [
    act({ points: track(60, 100, 4000) }),
    act({ points: track(60, 100, 4000) }),
    act({ points: track(60, 100, 4000) }),
  ];
  const r = groupRecurringRoutes([...casa, ...parque]);
  assert.equal(r.length, 2);
});

check('distância muito diferente separa, mesmo pisando as mesmas ruas', () => {
  // Duas voltas no mesmo quarteirão contra uma: as células coincidem, a
  // distância não. É a razão de o filtro fazer parte da definição.
  const uma = [act({ distanceM: 6000 }), act({ distanceM: 6000 }), act({ distanceM: 6000 })];
  const duas = [act({ distanceM: 12000 }), act({ distanceM: 12000 }), act({ distanceM: 12000 })];
  const r = groupRecurringRoutes([...uma, ...duas]);
  assert.equal(r.length, 2, 'dois grupos, não um');
});

check('ligação completa impede o encadeamento por transitividade', () => {
  // A parece com B, B parece com C, mas A não parece com C. Ligação simples
  // juntaria os três; completa não pode.
  // Três trechos da mesma reta, deslizando: A e B compartilham metade, B e C
  // também, A e C quase nada.
  const a = act({ points: segment(0, 60), distanceM: 6000 });
  const b = act({ points: segment(20, 80), distanceM: 6000 });
  const c = act({ points: segment(40, 100), distanceM: 6000 });
  const ab = routeOverlap(routeCells(a.points), routeCells(b.points));
  const bc = routeOverlap(routeCells(b.points), routeCells(c.points));
  const ac = routeOverlap(routeCells(a.points), routeCells(c.points));
  assert.ok(ab > 0.4 && bc > 0.4 && ac < 0.3, `corrente: ab=${ab} bc=${bc} ac=${ac}`);
  const r = groupRecurringRoutes([a, b, c], { minOverlap: 0.4, minGroup: 3 });
  assert.ok(
    r.every((g) => !(g.efforts.some((e) => e.id === a.id) && g.efforts.some((e) => e.id === c.id))),
    'A e C não podem cair no mesmo grupo',
  );
});

check('traçado curto demais fica de fora', () => {
  const curto = act({ points: track(2, 10) });
  assert.deepEqual(groupRecurringRoutes([curto, act(), act()]), []);
});

check('distância zero ou ausente fica de fora', () => {
  const r = groupRecurringRoutes([act({ distanceM: 0 }), act(), act()]);
  assert.deepEqual(r, [], 'sobram duas, abaixo do mínimo');
});

/* ─────────────────────────── ritmo e postos ─────────────────────────── */

check('o posto 1 é o ritmo mais rápido', () => {
  const rapido = act({ movingTimeS: 1800 });
  const medio = act({ movingTimeS: 2160 });
  const lento = act({ movingTimeS: 2400 });
  const [g] = groupRecurringRoutes([lento, medio, rapido]);
  assert.equal(g.best?.id, rapido.id);
  assert.equal(g.efforts.find((e) => e.id === rapido.id)?.rank, 1);
  assert.equal(g.efforts.find((e) => e.id === lento.id)?.rank, 3);
});

check('o típico é a mediana, não a média', () => {
  // Uma corrida catastrófica não pode arrastar o "típico".
  const [g] = groupRecurringRoutes([
    act({ movingTimeS: 1800 }),
    act({ movingTimeS: 1860 }),
    act({ movingTimeS: 1920 }),
    act({ movingTimeS: 1980 }),
    act({ movingTimeS: 7200 }),
  ]);
  assert.equal(g.count, 5);
  assert.equal(g.median?.movingTimeS, 1920);
});

check('sem tempo, a atividade fica sem posto — e não em último', () => {
  const semTempo = act({ movingTimeS: 0 });
  const [g] = groupRecurringRoutes([act(), act(), semTempo]);
  const e = g.efforts.find((x) => x.id === semTempo.id);
  assert.equal(e?.paceSPerKm, null);
  assert.equal(e?.rank, null);
  assert.equal(g.count, 3, 'mas ela conta como repetição');
});

check('grupo inteiro sem tempo não tem melhor nem típico', () => {
  const [g] = groupRecurringRoutes([
    act({ movingTimeS: 0 }),
    act({ movingTimeS: 0 }),
    act({ movingTimeS: 0 }),
  ]);
  assert.equal(g.best, null);
  assert.equal(g.median, null);
});

check('o ritmo é segundos por km', () => {
  const [g] = groupRecurringRoutes([
    act({ distanceM: 10000, movingTimeS: 3000 }),
    act({ distanceM: 10000, movingTimeS: 3000 }),
    act({ distanceM: 10000, movingTimeS: 3000 }),
  ]);
  assert.equal(g.best?.paceSPerKm, 300, '50 min em 10 km = 5:00/km');
});

/* ──────────────────────── identidade e consultas ──────────────────────── */

check('a âncora e as datas vêm da ordem cronológica', () => {
  const velha = act({ startAt: '2025-01-01T08:00:00Z' });
  const meio = act({ startAt: '2025-06-01T08:00:00Z' });
  const nova = act({ startAt: '2026-01-01T08:00:00Z' });
  const [g] = groupRecurringRoutes([nova, velha, meio]);
  assert.equal(g.id, velha.id);
  assert.equal(g.firstAt, velha.startAt);
  assert.equal(g.lastAt, nova.startAt);
  assert.deepEqual(g.efforts.map((e) => e.id), [velha.id, meio.id, nova.id]);
});

check('a ordem da entrada não muda o resultado', () => {
  const xs = [act(), act(), act(), act({ points: track(60, 100, 4000) })];
  const a = groupRecurringRoutes(xs);
  const b = groupRecurringRoutes([...xs].reverse());
  assert.deepEqual(a.map((g) => g.id), b.map((g) => g.id));
  assert.deepEqual(a.map((g) => g.count), b.map((g) => g.count));
});

check('a distância do grupo é a mediana', () => {
  const [g] = groupRecurringRoutes([
    act({ distanceM: 6000 }),
    act({ distanceM: 6100 }),
    act({ distanceM: 6900 }),
  ]);
  assert.equal(g.distanceM, 6100);
});

check('routeOf e effortOf encontram a atividade', () => {
  const alvo = act();
  const rotas = groupRecurringRoutes([act(), act(), alvo]);
  assert.equal(routeOf(rotas, alvo.id)?.count, 3);
  assert.equal(effortOf(rotas, alvo.id)?.effort.id, alvo.id);
  assert.equal(routeOf(rotas, 'nao-existe'), null);
  assert.equal(effortOf(rotas, 'nao-existe'), null);
});

check('lista vazia não quebra', () => {
  assert.deepEqual(groupRecurringRoutes([]), []);
  assert.equal(routeOf([], 'x'), null);
});

check('limiar inválido cai no padrão em vez de juntar tudo', () => {
  const longe = [
    act({ points: track(60, 100, 6000) }),
    act({ points: track(60, 100, 6000) }),
    act({ points: track(60, 100, 6000) }),
  ];
  const perto = [act(), act(), act()];
  for (const bad of [0, -1, 2, Number.NaN]) {
    const r = groupRecurringRoutes([...perto, ...longe], { minOverlap: bad });
    assert.equal(r.length, 2, `minOverlap ${bad} não pode fundir rotas distantes`);
  }
  assert.equal(ROUTE_MIN_OVERLAP, 0.7, 'o padrão escolhido pelo dono continua declarado');
});

console.log(`\n${passed} testes passaram.`);
