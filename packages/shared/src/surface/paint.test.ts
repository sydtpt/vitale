/**
 * Pintar o traçado por trecho — o que estes testes protegem:
 *  1. O corte cai ONDE o trecho acaba, não no vértice seguinte: a fronteira é
 *     interpolada na aresta. Sem isso a cor erra até 400 m no mapa.
 *  2. Os vértices internos sobrevivem — o traço segue a rua, não vira uma reta
 *     entre os dois cortes.
 *  3. Trechos vizinhos de mesma classe NÃO se fundem, porque `inferred` os
 *     distingue: medido e adivinhado não podem virar a mesma coisa.
 *  4. Entrada que não dá para pintar devolve vazio, e nunca cor inventada.
 */
import assert from 'node:assert/strict';
import { paintRoute, type OverviewPoint } from './paint';
import type { SurfaceSegment } from './classify';

/** Uma linha reta para o leste; a 50° de latitude, 0,001° ≈ 71,5 m. */
function eastLine(n: number): OverviewPoint[] {
  return Array.from({ length: n }, (_, i) => [50, 4 + i * 0.001] as OverviewPoint);
}

// 1. o corte é interpolado, não arredondado para o vértice
{
  const line = eastLine(11); // ~715 m em 10 arestas
  const [first] = paintRoute(line, [[0, 100, 'liso', 0]] as SurfaceSegment[]);
  assert.ok(first, 'um trecho pintado');
  const end = first.coords[first.coords.length - 1]!;
  // 100 m fica DENTRO da segunda aresta (71,5 m < 100 < 143 m): o último ponto
  // não pode ser um vértice do overview.
  assert.ok(end[1] > 4.001 && end[1] < 4.002, `corte interpolado, veio ${end[1]}`);
  assert.ok(Math.abs(first.lengthM - 100) < 1e-9);
}

// 2. os vértices internos ficam no traço
{
  const line = eastLine(11);
  const [run] = paintRoute(line, [[0, 500, 'cascalho', 0]] as SurfaceSegment[]);
  // 500 m cobre ~7 arestas: corte inicial + 6 vértices internos + corte final.
  assert.ok(run!.coords.length >= 8, `veio ${run!.coords.length} pontos`);
  const lngs = run!.coords.map((c) => c[1]);
  assert.deepEqual([...lngs].sort((a, b) => a - b), lngs, 'a ordem do percurso é preservada');
}

// 3. mesma classe, procedências diferentes: dois traços, não um
{
  const line = eastLine(11);
  const runs = paintRoute(line, [
    [0, 200, 'liso', 0],
    [200, 400, 'liso', 1],
  ] as SurfaceSegment[]);
  assert.equal(runs.length, 2, 'não funde medido com inferido');
  assert.equal(runs[0]!.inferred, 0);
  assert.equal(runs[1]!.inferred, 1);
  // O fim de um é o começo do outro — sem buraco branco entre as cores.
  assert.deepEqual(runs[0]!.coords[runs[0]!.coords.length - 1], runs[1]!.coords[0]);
}

// 4. o que não dá para pintar não inventa cor
{
  assert.deepEqual(paintRoute([], [[0, 100, 'liso', 0]] as SurfaceSegment[]), []);
  assert.deepEqual(paintRoute(eastLine(11), []), []);
  assert.deepEqual(paintRoute([[50, 4]], [[0, 100, 'liso', 0]] as SurfaceSegment[]), []);
  // Rota parada no mesmo ponto: comprimento zero, nada a dividir.
  assert.deepEqual(paintRoute([[50, 4], [50, 4]], [[0, 100, 'liso', 0]] as SurfaceSegment[]), []);
  // Trecho de comprimento nulo é descartado em vez de virar um ponto solto.
  assert.deepEqual(paintRoute(eastLine(11), [[300, 300, 'terra', 0]] as SurfaceSegment[]), []);
}

// 5. trecho que passa do fim da geometria é aparado, não estoura
{
  const line = eastLine(11);
  const [run] = paintRoute(line, [[600, 99_999, 'terra', 0]] as SurfaceSegment[]);
  assert.ok(run, 'apara em vez de sumir');
  assert.deepEqual(run.coords[run.coords.length - 1], line[line.length - 1], 'termina no último vértice');
}

console.log('surface/paint: ok');
