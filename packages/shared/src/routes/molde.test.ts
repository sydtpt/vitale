/**
 * O molde e o golden set (ADR 0041, invariante 2 · spec §6).
 *
 * `__fixtures__/golden.json` são as **20 pedaladas reais** cujos nomes o dono
 * aprovou em 07/09/2026, com as peças que o modelo teria devolvido. É o que
 * impede uma troca de fornecedor, uma subida de versão do prompt ou um ajuste de
 * limiar de degradarem os nomes em silêncio.
 *
 * A parte que mais paga são as contrações: em francês *de* + *le* = **du**,
 * *de* + vogal = **d'**. Um `+` ingênuo escreveria "Tour de le Pajottenland" e
 * nenhum teste de tipo pegaria.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { derivarAncoras } from './anchor';
import { montarNome } from './molde';
import { lerRota } from './shape';
import type { NomePreenchido, RouteFacts, RouteReading } from './types';

const rides: RouteFacts[] = JSON.parse(
  readFileSync(join(import.meta.dirname, '__fixtures__', 'rides.json'), 'utf8'),
);

interface GoldenRow {
  dia: string;
  km: number;
  preenchido: NomePreenchido;
  esperado: string | null;
  nota?: string;
}

const golden: GoldenRow[] = JSON.parse(
  readFileSync(join(import.meta.dirname, '__fixtures__', 'golden.json'), 'utf8'),
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

/** Dia em UTC + km arredondado identificam uma rota; o fixture tem dias com duas. */
function acharRota(dia: string, km: number): RouteFacts {
  const achadas = rides.filter(
    (r) => r.startAt.slice(0, 10) === dia && Math.round(r.distanceM / 1000) === km,
  );
  assert.equal(achadas.length, 1, `${dia} / ${km} km casou com ${achadas.length} rotas`);
  return achadas[0];
}

check('o golden set tem as 20 pedaladas aprovadas', () => {
  assert.equal(golden.length, 20);
});

for (const g of golden) {
  check(`${g.dia} · ${g.km} km → ${g.esperado ?? '(sem nome)'}`, () => {
    const rota = acharRota(g.dia, g.km);
    const leitura = lerRota(rota, ancoras);
    assert.equal(montarNome(leitura, g.preenchido, rota.distanceM), g.esperado);
  });
}

/* ─────────────── contrações, uma a uma ─────────────── */

const leituraFr = (forma: RouteReading['forma']): RouteReading => ({
  forma,
  lingua: 'fr',
  origem: 'X',
  destino: 'Y',
  cidadeDistante: 'Y',
  distanciaCasaInicioM: 0,
  distanciaCasaFimM: 0,
});

const so = (p: Partial<NomePreenchido>): NomePreenchido => ({ justificativa: ['X'], ...p });

check('francês: de + le = du', () => {
  assert.equal(
    montarNome(leituraFr('casa-b'), so({ regiao: 'Pajottenland', artigo: 'le' }), 60000),
    'Tour du Pajottenland',
  );
});

check('francês: de + la fica de la', () => {
  assert.equal(
    montarNome(leituraFr('casa-b'), so({ regiao: 'Wallonie picarde', artigo: 'la' }), 60000),
    'Tour de la Wallonie picarde',
  );
});

check("francês: de + l' elide sem espaço", () => {
  assert.equal(
    montarNome(leituraFr('casa-b'), so({ regiao: 'Ardenne', artigo: "l'" }), 60000),
    "Tour de l'Ardenne",
  );
});

check('francês: de + les = des', () => {
  assert.equal(
    montarNome(leituraFr('casa-b'), so({ regiao: 'Fagnes', artigo: 'les' }), 60000),
    'Tour des Fagnes',
  );
});

check("francês: nome próprio com vogal elide em d'", () => {
  assert.equal(
    montarNome(leituraFr('casa-loop-casa'), so({ destino: 'Anvers' }), 20000),
    "Boucle d'Anvers",
  );
});

check('francês: nome próprio com consoante mantém de', () => {
  assert.equal(
    montarNome(leituraFr('a-casa'), so({ origem: 'Malines' }), 20000),
    'Retour de Malines',
  );
});

check('Tour é distância, não topologia — 50 km é o corte', () => {
  const curto = montarNome(leituraFr('a-loop-a'), so({ regiao: 'Hageland', artigo: 'le' }), 49_999);
  const longo = montarNome(leituraFr('a-loop-a'), so({ regiao: 'Hageland', artigo: 'le' }), 50_000);
  assert.equal(curto, 'Boucle du Hageland');
  assert.equal(longo, 'Tour du Hageland');
});

check('um A→B curto nunca vira Boucle, por mais curto que seja', () => {
  assert.equal(
    montarNome(leituraFr('a-b'), so({ regiao: 'Hageland', artigo: 'le' }), 10_000),
    'Tour du Hageland',
  );
});

check('rota degenerada não recebe nome, mesmo com peças preenchidas', () => {
  assert.equal(
    montarNome(leituraFr('degenerada'), so({ regiao: 'Pajottenland', artigo: 'le' }), 60000),
    null,
  );
});

check('neerlandês e português têm molde próprio', () => {
  const nl: RouteReading = { ...leituraFr('a-b'), lingua: 'nl', origem: 'Rotterdam', destino: 'Amsterdam' };
  assert.equal(
    montarNome(nl, so({ via: 'Groene Hart', viaArtigo: 'het' }), 57_000),
    'Van Rotterdam naar Amsterdam door het Groene Hart',
  );
  const pt: RouteReading = { ...leituraFr('a-loop-a'), lingua: 'pt', cidadeDistante: 'São Paulo' };
  assert.equal(montarNome(pt, so({}), 24_000), 'Volta por São Paulo');
});

console.log(`\n${passed} checagens de molde ok`);
