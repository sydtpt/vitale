/**
 * A forma do passeio (ADR 0041, invariante 1).
 *
 * O que estes testes protegem:
 *  1. A distribuição das **138 rotas reais** — 76 loops de casa, 23 Casa→B,
 *     18 A→B, 15 A→Casa, 2 loops em viagem, 4 degeneradas. Mexer no raio ou no
 *     limiar move pedalada de balde, e é isso que se quer ver falhar.
 *  2. O portão de degenerescência sai ANTES de qualquer chamada — e o limiar de
 *     cidade única é o que separa Amsterdam (5,3 km, sem nome) de São Paulo
 *     (24 km, com nome).
 *  3. A Bélgica fala francês — inclusive quando a rota é toda flamenga. Decisão
 *     do dono, e é a que mais parece bug para quem chega depois.
 *  4. Sem casa vigente, nada vira `casa-*`.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { derivarAncoras } from './anchor';
import {
  lerRota,
  linguaDoPais,
  MIN_DISTANCIA_CIDADE_UNICA_M,
  MIN_DISTANCIA_M,
  paisDominante,
} from './shape';
import type { RouteFacts, RouteShape } from './types';

const rides: (RouteFacts & { name: string })[] = JSON.parse(
  readFileSync(join(import.meta.dirname, '__fixtures__', 'rides.json'), 'utf8'),
);

let passed = 0;
function check(name: string, fn: () => void): void {
  fn();
  passed += 1;
  console.log(`  ok ${name}`);
}

const ancoras = derivarAncoras(
  rides.flatMap((r) => [
    { startAt: r.startAt, lat: r.lat0, lng: r.lng0 },
    { startAt: r.startAt, lat: r.lat1, lng: r.lng1 },
  ]),
);

check('a distribuição das 138 rotas reais bate com a medida em produção', () => {
  const contagem = new Map<RouteShape, number>();
  for (const r of rides) {
    const f = lerRota(r, ancoras).forma;
    contagem.set(f, (contagem.get(f) ?? 0) + 1);
  }
  const total = [...contagem.values()].reduce((a, b) => a + b, 0);
  assert.equal(total, 138);
  assert.deepEqual(
    Object.fromEntries([...contagem].sort()),
    {
      'a-b': 18,
      'a-casa': 15,
      'a-loop-a': 2,
      'casa-b': 23,
      'casa-loop-casa': 76,
      degenerada: 4,
    },
    'a distribuição mudou — investigar antes de atualizar o número',
  );
  /*
   * Difere da sondagem em SQL da Fase 0 (75/23/19/18/3) por dois motivos, ambos
   * a favor daqui: aquela usava os centros ARREDONDADOS das células de 110 m e um
   * corte de data chutado em 15/06, enquanto o núcleo usa o centroide do cluster
   * e o corte real — 21/06, a primeira chegada na casa nova. As três rotas que
   * trocaram de balde estão todas na faixa de 300–500 m da casa, exatamente onde
   * os dois centros discordam.
   */
});

check('rota sem quilometragem é degenerada e não chega ao modelo', () => {
  const zero = rides.filter((r) => r.distanceM < MIN_DISTANCIA_M);
  assert.equal(zero.length, 2, 'o fixture tem as duas rotas de ~0 km (64 m e 218 m)');
  for (const r of zero) assert.equal(lerRota(r, ancoras).forma, 'degenerada');
});

check('numa cidade só, o corte é 8 km — e é ele que separa Amsterdam de São Paulo', () => {
  const umaCidade = rides.filter((r) => r.cities.length === 1 && r.distanceM >= MIN_DISTANCIA_M);
  assert.ok(umaCidade.length >= 5, 'o fixture deveria ter várias rotas de cidade única');
  for (const r of umaCidade) {
    const esperado =
      r.distanceM < MIN_DISTANCIA_CIDADE_UNICA_M ? 'degenerada' : 'nomeável';
    const veio = lerRota(r, ancoras).forma === 'degenerada' ? 'degenerada' : 'nomeável';
    assert.equal(veio, esperado, `${r.startAt.slice(0, 10)} (${r.distanceM} m)`);
  }
  // As duas pontas do vão que fixou o limiar.
  const amsterdam = rides.find((r) => r.startAt.slice(0, 10) === '2026-08-31')!;
  const saoPaulo = rides.find((r) => r.startAt.slice(0, 10) === '2026-02-23')!;
  assert.equal(lerRota(amsterdam, ancoras).forma, 'degenerada', '5,3 km em Amsterdam: sem nome');
  assert.equal(lerRota(saoPaulo, ancoras).forma, 'a-loop-a', '24 km em São Paulo: tem nome');
});

check('a Bélgica fala francês, inclusive na rota toda flamenga', () => {
  assert.equal(linguaDoPais('België / Belgique / Belgien'), 'fr');
  assert.equal(linguaDoPais('Nederland'), 'nl');
  assert.equal(linguaDoPais('Brasil'), 'pt');
  // País sem molde cai na língua do app em vez de palpitar.
  assert.equal(linguaDoPais('Deutschland'), 'pt');
  assert.equal(linguaDoPais(undefined), 'pt');
});

check('o país dominante desempata pela partida', () => {
  const be = { country: 'België / Belgique / Belgien', lat: 0, lng: 0 };
  const nl = { country: 'Nederland', lat: 0, lng: 0 };
  assert.equal(
    paisDominante([{ ...be, name: 'a' }, { ...nl, name: 'b' }]),
    'België / Belgique / Belgien',
    'empate tinha de ficar com o país da partida',
  );
  assert.equal(
    paisDominante([{ ...be, name: 'a' }, { ...nl, name: 'b' }, { ...nl, name: 'c' }]),
    'Nederland',
  );
});

check('a travessia de três países fica com a Bélgica, e por isso em francês', () => {
  const meuseRhin = rides.find((r) => r.startAt.slice(0, 10) === '2026-07-18');
  assert.ok(meuseRhin, 'a pedalada da Meuse-Rhin sumiu do fixture');
  const l = lerRota(meuseRhin, ancoras);
  assert.match(l.paisDominante ?? '', /Belgi/);
  assert.equal(l.lingua, 'fr');
});

check('sem casa vigente nada vira casa-*', () => {
  const r = rides.find((x) => x.distanceM > 20000)!;
  const forma = lerRota(r, []).forma;
  assert.ok(forma === 'a-b' || forma === 'a-loop-a', `veio ${forma}`);
});

console.log(`\n${passed} checagens de forma ok`);
