/**
 * A Casa derivada das partidas (ADR 0041, invariante 6).
 *
 * O que estes testes protegem:
 *  1. As **138 partidas reais** produzem exatamente DUAS casas. Nem uma (que
 *     apagaria a mudança de junho/2026) nem cinco (que promoveria hotel a casa).
 *  2. As vigências não se sobrepõem e não deixam vão — a véspera fecha a que sai,
 *     mesma regra do `gear`.
 *  3. O corte cai no vão real entre 07/06 e 21/06/2026, que é onde a mudança
 *     aconteceu de fato.
 *  4. Um lugar visitado pouco NÃO vira casa.
 *
 * O fixture é produção, não invenção: `__fixtures__/rides.json` saiu das 138
 * rotas com traçado do banco em 07/09/2026.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ancoraEm, derivarAncoras, MIN_PARTIDAS, RAIO_CASA_M } from './anchor';
import { haversineM } from '../geo/distance';

interface Ride {
  startAt: string;
  lat0: number;
  lng0: number;
  lat1: number;
  lng1: number;
}

const rides: Ride[] = JSON.parse(
  readFileSync(join(import.meta.dirname, '__fixtures__', 'rides.json'), 'utf8'),
);

let passed = 0;
function check(name: string, fn: () => void): void {
  fn();
  passed += 1;
  console.log(`  ok ${name}`);
}

// Os dois extremos de cada rota, como o passe vai alimentar.
const extremos = rides.flatMap((r) => [
  { startAt: r.startAt, lat: r.lat0, lng: r.lng0 },
  { startAt: r.startAt, lat: r.lat1, lng: r.lng1 },
]);
const ancoras = derivarAncoras(extremos);

check('as 138 partidas reais produzem exatamente duas casas', () => {
  assert.equal(rides.length, 138, 'fixture mudou de tamanho');
  assert.equal(ancoras.length, 2, `esperava 2 casas, veio ${ancoras.length}`);
});

check('a primeira casa é a de Schaerbeek, a segunda fica ~3 km a nordeste', () => {
  const [antiga, nova] = ancoras;
  assert.ok(
    haversineM(antiga.lat, antiga.lng, 50.852, 4.344) < 150,
    `casa antiga longe do esperado: ${antiga.lat}, ${antiga.lng}`,
  );
  assert.ok(
    haversineM(nova.lat, nova.lng, 50.872, 4.373) < 150,
    `casa nova longe do esperado: ${nova.lat}, ${nova.lng}`,
  );
  const entre = haversineM(antiga.lat, antiga.lng, nova.lat, nova.lng);
  assert.ok(entre > 2500 && entre < 3500, `distância entre as casas: ${Math.round(entre)} m`);
});

check('as vigências não se sobrepõem, não deixam vão, e a última fica aberta', () => {
  const [antiga, nova] = ancoras;
  assert.equal(antiga.activeTo != null, true, 'a casa que saiu tem de estar fechada');
  assert.equal(nova.activeTo, null, 'a casa vigente fica aberta');
  // A véspera fecha a anterior: sem vão e sem sobreposição.
  const diaSeguinte = new Date(`${antiga.activeTo}T12:00:00Z`);
  diaSeguinte.setUTCDate(diaSeguinte.getUTCDate() + 1);
  assert.equal(diaSeguinte.toISOString().slice(0, 10), nova.activeFrom);
});

check('o corte cai no vão real da mudança (entre 07/06 e 21/06/2026)', () => {
  const corte = ancoras[1].activeFrom;
  assert.ok(corte > '2026-06-07' && corte <= '2026-06-21', `corte inesperado: ${corte}`);
});

check('a casa mais antiga é esticada para trás, cobrindo a primeira pedalada', () => {
  const primeira = rides.map((r) => r.startAt.slice(0, 10)).sort()[0];
  assert.ok(ancoras[0].activeFrom <= primeira, 'a primeira pedalada ficou órfã de casa');
});

check('ancoraEm devolve a casa vigente no dia', () => {
  assert.equal(ancoraEm(ancoras, '2026-01-15'), ancoras[0]);
  assert.equal(ancoraEm(ancoras, '2026-08-15'), ancoras[1]);
  assert.equal(ancoraEm(ancoras, '2020-01-01'), undefined, 'antes de tudo não há casa');
});

check('lugar pouco visitado não vira casa', () => {
  const poucas = Array.from({ length: MIN_PARTIDAS - 1 }, (_, i) => ({
    startAt: `2026-03-0${i + 1}T09:00:00Z`,
    lat: 50.1,
    lng: 4.1,
  }));
  assert.deepEqual(derivarAncoras(poucas), []);
});

check('o raio agrupa a mesma porta espalhada pelo GPS', () => {
  // Cinco partidas dentro de ~200 m: uma casa, não cinco lugares.
  const jitter = [0, 0.0005, -0.0009, 0.0012, -0.0003].map((d, i) => ({
    startAt: `2026-03-1${i}T09:00:00Z`,
    lat: 50.852 + d,
    lng: 4.344,
  }));
  const a = derivarAncoras(jitter);
  assert.equal(a.length, 1, 'o jitter do GPS virou mais de uma casa');
  assert.equal(a[0].radiusM, RAIO_CASA_M);
});

console.log(`\n${passed} checagens de âncora ok`);
