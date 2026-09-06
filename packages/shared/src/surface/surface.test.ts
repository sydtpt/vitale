/**
 * Piso das rotas — o que estes testes protegem:
 *  1. A tabela OSM→categoria: `sett;concrete_plates` é pavé, `paving_stones:30` é
 *     bloco, tag exótica é "desconhecido" (nunca chute), e sem tag o `tracktype`
 *     vem antes do `highway`.
 *  2. A escolha da via: ciclovia a ≤ 12 m vence a rua; calçada perde para
 *     qualquer outra; escada nunca é chão.
 *  3. Amostragem: espaçamento por distância acumulada, e um salto > 500 m vira
 *     buraco, não crédito para a via mais próxima (regra do VeloViewer).
 *  4. Segmentos e soma: o inferido conta no total E no `inferido`; o
 *     "desconhecido" nunca some.
 */
import assert from 'node:assert/strict';
import {
  classifyOsmTags,
  pickWay,
  sampleRoute,
  segmentsFromSamples,
  surfaceMix,
  surfaceShares,
  sumSurfaceMix,
  type OsmWay,
} from './classify';

// 1. tabela
assert.deepEqual(classifyOsmTags({ surface: 'asphalt' }), { cat: 'liso', inferred: false });
assert.deepEqual(classifyOsmTags({ surface: 'concrete:plates' }), { cat: 'liso', inferred: false });
assert.deepEqual(classifyOsmTags({ surface: 'paving_stones:30' }), { cat: 'blocos', inferred: false });
assert.deepEqual(classifyOsmTags({ surface: 'sett;concrete_plates' }), { cat: 'pave', inferred: false });
assert.deepEqual(classifyOsmTags({ surface: 'cobblestone:lanes' }), { cat: 'pave', inferred: false });
assert.deepEqual(classifyOsmTags({ surface: 'compacted' }), { cat: 'cascalho', inferred: false });
assert.deepEqual(classifyOsmTags({ surface: 'ground' }), { cat: 'terra', inferred: false });
assert.deepEqual(classifyOsmTags({ surface: 'lava_rock' }), { cat: 'desconhecido', inferred: true }, 'exótica não vira chute');
assert.deepEqual(classifyOsmTags({ tracktype: 'grade2', highway: 'track' }), { cat: 'cascalho', inferred: true });
assert.deepEqual(classifyOsmTags({ highway: 'cycleway' }), { cat: 'liso', inferred: true });
assert.deepEqual(classifyOsmTags({ highway: 'path' }), { cat: 'terra', inferred: true });
assert.deepEqual(classifyOsmTags({}), { cat: 'desconhecido', inferred: true });

// 2. escolha da via — Bruxelas, rua e ciclovia paralela a ~8 m
const rua: OsmWay = { tags: { highway: 'tertiary', surface: 'asphalt' }, geometry: [{ lat: 50.85, lng: 4.35 }, { lat: 50.85, lng: 4.36 }] };
const ciclovia: OsmWay = { tags: { highway: 'cycleway', surface: 'paving_stones' }, geometry: [{ lat: 50.85007, lng: 4.35 }, { lat: 50.85007, lng: 4.36 }] };
const calcada: OsmWay = { tags: { highway: 'footway', footway: 'sidewalk', surface: 'paving_stones' }, geometry: [{ lat: 50.85003, lng: 4.35 }, { lat: 50.85003, lng: 4.36 }] };
const escada: OsmWay = { tags: { highway: 'steps' }, geometry: [{ lat: 50.85001, lng: 4.35 }, { lat: 50.85001, lng: 4.36 }] };
const p = { lat: 50.85002, lng: 4.355 }; // a 2 m da rua, 5,5 m da ciclovia
{
  const m = pickWay(p, [rua, ciclovia, calcada, escada]);
  assert.equal(m?.way, ciclovia, 'ciclovia a ≤ 12 m vence a rua mais próxima');
}
{
  const longe: OsmWay = { ...ciclovia, geometry: [{ lat: 50.8502, lng: 4.35 }, { lat: 50.8502, lng: 4.36 }] }; // ~20 m
  assert.equal(pickWay(p, [rua, longe])?.way, rua, 'ciclovia a 20 m não vence');
}
assert.equal(pickWay(p, [calcada, escada])?.way, calcada, 'calçada só quando é a única');
assert.equal(pickWay(p, [escada]), null, 'escada nunca é chão');
assert.equal(pickWay({ lat: 50.86, lng: 4.355 }, [rua, ciclovia]), null, 'fora do raio');

// 3. amostragem — uma linha reta de ~1 km com pontos a cada ~100 m, depois um salto de ~2 km.
// (1° de latitude no haversine com R=6371 km é 111,19 km, então cada passo dá 99,9 m — o
// teste afirma a regra, não um número redondo.)
const STEP_DEG = 100 / 111320;
const pts = Array.from({ length: 11 }, (_, i) => ({ lat: 50.85 + i * STEP_DEG, lng: 4.35 }));
{
  const { samples, gaps, lengthM } = sampleRoute(pts, 400);
  assert.ok(Math.abs(lengthM - 999) < 3, `comprimento ${lengthM}`);
  assert.equal(gaps.length, 0);
  assert.equal(samples[0]!.point, pts[0], 'a amostra é o ponto de INÍCIO do trecho');
  assert.equal(samples[0]!.startM, 0);
  for (let i = 1; i < samples.length; i++) assert.equal(samples[i]!.startM, samples[i - 1]!.endM, 'contíguas');
  for (const s of samples.slice(0, -1)) {
    const len = s.endM - s.startM;
    assert.ok(len >= 400 && len < 500, `cada amostra cobre ≥ 400 m e menos que 400 + um passo (${len})`);
  }
  assert.ok(Math.abs(samples[samples.length - 1]!.endM - lengthM) < 1e-6, 'a última fecha no comprimento');
}
{
  const far = { lat: 50.85 + 30 * STEP_DEG, lng: 4.35 }; // ~2 km depois do último ponto
  const { samples, gaps } = sampleRoute([...pts, far, { lat: far.lat + STEP_DEG, lng: 4.35 }], 400);
  assert.equal(gaps.length, 1, 'salto de 2 km vira buraco');
  assert.ok(gaps[0]![1] - gaps[0]![0] > 1900, 'o buraco tem o tamanho do salto');
  assert.ok(samples.every((s) => s.endM - s.startM < 600), 'nenhuma amostra engole o buraco');
  assert.ok(samples.some((s) => s.startM >= gaps[0]![1] - 1e-6), 'a amostragem recomeça depois do buraco');
}

// 4. segmentos e soma
{
  const segs = segmentsFromSamples([
    { startM: 0, endM: 400, cat: 'liso', inferred: false },
    { startM: 400, endM: 800, cat: 'liso', inferred: false },
    { startM: 800, endM: 1200, cat: 'liso', inferred: true }, // muda só o inferido → segmento novo
    { startM: 1200, endM: 1500, cat: 'pave', inferred: false },
    { startM: 1500, endM: 1700, cat: 'desconhecido', inferred: true },
  ]);
  assert.deepEqual(segs, [
    [0, 800, 'liso', 0],
    [800, 1200, 'liso', 1],
    [1200, 1500, 'pave', 0],
    [1500, 1700, 'desconhecido', 1],
  ]);
  const mix = surfaceMix(segs);
  assert.equal(mix.total, 1700);
  assert.equal(mix.liso, 1200);
  assert.equal(mix.inferido, 600, 'inferido = liso inferido + desconhecido');
  assert.equal(mix.desconhecido, 200, 'o desconhecido nunca some');
  const sh = surfaceShares(mix);
  assert.ok(Math.abs(sh.liso - 1200 / 1700) < 1e-9);
  const soma = sumSurfaceMix([mix, mix, undefined]);
  assert.equal(soma.total, 3400);
  assert.equal(soma.pave, 600);
  assert.equal(surfaceShares(surfaceMix([])).liso, 0, 'sem rota, tudo zero');
}

console.log('surface/classify: ok');
