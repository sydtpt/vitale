/**
 * O seletor do volume semanal.
 *
 * `buildWeeklyVolume` (um `activityId`) e `buildTypeVolumeSeries` (um rótulo)
 * são a mesma conta com recortes diferentes. O que estes testes garantem é que
 * continuam sendo a mesma conta: o card de tipo e a página daquele tipo mostram
 * a mesma série, e discordarem seria o pior tipo de bug — dois números certos
 * sobre a mesma coisa.
 */

import assert from 'node:assert/strict';
import { buildTypeVolumeSeries, buildVolumeSeries, buildWeeklyVolume } from './weekly-volume';
import type { Activity } from '../models';

let passed = 0;
function check(name: string, fn: () => void): void {
  fn();
  passed += 1;
  console.log(`  ok ${name}`);
}

const NOW = new Date(2026, 7, 20, 14, 0, 0); // quinta, 20/08/2026

/** 37 e 38 são corrida (outdoor/indoor) — colapsam no mesmo rótulo. */
const LABELS: Record<number, string> = { 37: 'Corrida', 38: 'Corrida', 13: 'Ciclismo' };
const labelFor = (id: number) => LABELS[id] ?? 'Treino';

function act(daysAgo: number, activityId: number, distanceM: number, durationS = 1800): Activity {
  const d = new Date(NOW.getFullYear(), NOW.getMonth(), NOW.getDate() - daysAgo, 9, 0, 0);
  return {
    id: `a${daysAgo}-${activityId}-${distanceM}`,
    userId: 'u',
    activityId,
    calories: 100,
    startAt: d.toISOString(),
    endAt: new Date(d.getTime() + durationS * 1000).toISOString(),
    durationS,
    distanceM,
    hasRoute: true,
  };
}

check('a janela tem N semanas e termina na semana atual', () => {
  const s = buildWeeklyVolume([], 37, 'distance', 6, NOW);
  assert.equal(s.length, 6);
  assert.ok(s.every((b) => b.empty));
  // 20/08/2026 é quinta; a segunda daquela semana é 17/08.
  assert.equal(s[s.length - 1].key, '2026-08-17');
});

check('por id: soma só o id pedido, em km com uma casa', () => {
  const s = buildWeeklyVolume(
    [act(0, 37, 5200), act(1, 37, 4800), act(0, 13, 30000)],
    37, 'distance', 2, NOW,
  );
  assert.equal(s[s.length - 1].value, 10, '5,2 + 4,8 = 10 km');
  assert.equal(s[s.length - 1].count, 2, 'o ciclismo do mesmo dia não entra');
});

check('por rótulo: colapsa ids diferentes que compartilham o nome', () => {
  const dados = [act(0, 37, 5000), act(0, 38, 3000), act(0, 13, 20000)];
  const porId = buildWeeklyVolume(dados, 37, 'distance', 2, NOW);
  const porRotulo = buildTypeVolumeSeries(dados, labelFor, 'Corrida', 'distance', 2, NOW);

  assert.equal(porId[porId.length - 1].value, 5, 'só a corrida outdoor');
  assert.equal(porRotulo[porRotulo.length - 1].value, 8, 'outdoor + indoor');
  assert.equal(porRotulo[porRotulo.length - 1].count, 2);
});

check('o card e a página do tipo veem a mesma série, só que com janelas diferentes', () => {
  // É o invariante que interessa: mudar o número de semanas não pode mudar o
  // valor de uma semana que existe nas duas.
  const dados = [act(0, 37, 5000), act(8, 38, 7000), act(20, 37, 3000)];
  const curta = buildTypeVolumeSeries(dados, labelFor, 'Corrida', 'distance', 4, NOW);
  const longa = buildTypeVolumeSeries(dados, labelFor, 'Corrida', 'distance', 12, NOW);

  const porChave = new Map(longa.map((b) => [b.key, b.value]));
  for (const b of curta) {
    assert.equal(b.value, porChave.get(b.key), `semana ${b.key} discordou entre as duas janelas`);
  }
});

check('duração vem em minutos inteiros', () => {
  const s = buildTypeVolumeSeries(
    [act(0, 37, 0, 1800), act(0, 38, 0, 900)],
    labelFor, 'Corrida', 'duration', 2, NOW,
  );
  assert.equal(s[s.length - 1].value, 45, '30 + 15 min');
});

check('oculta não conta em nenhuma das duas portas', () => {
  const escondida: Activity = { ...act(0, 37, 9000), hidden: true };
  assert.equal(buildWeeklyVolume([escondida], 37, 'distance', 2, NOW).at(-1)!.value, 0);
  assert.equal(
    buildTypeVolumeSeries([escondida], labelFor, 'Corrida', 'distance', 2, NOW).at(-1)!.value,
    0,
  );
});

check('rótulo sem nenhuma atividade devolve a janela inteira vazia', () => {
  const s = buildTypeVolumeSeries([act(0, 13, 30000)], labelFor, 'Corrida', 'distance', 6, NOW);
  assert.equal(s.length, 6);
  assert.ok(s.every((b) => b.empty && b.value === 0));
});

check('buildWeeklyVolume é buildVolumeSeries com o seletor de id', () => {
  const dados = [act(0, 37, 5000), act(2, 13, 20000)];
  assert.deepEqual(
    buildWeeklyVolume(dados, 37, 'distance', 3, NOW),
    buildVolumeSeries(dados, (a) => a.activityId === 37, 'distance', 3, NOW),
  );
});

console.log(`\n${passed} testes passaram.`);
