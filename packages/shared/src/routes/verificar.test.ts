/**
 * A conferência da saída do modelo (ADR 0041, invariante 2).
 *
 * O que estes testes protegem:
 *  1. Cidade que não foi enviada é reprovada — é a tradução direta de "todo
 *     número citado existe no pacote" do `ia/verificar.ts`.
 *  2. Uma "região" que é uma das cidades é reprovada. Era exatamente esse
 *     disfarce — o nome da cidade de casa virando nome do passeio — que originou
 *     a feature.
 *  3. Rota degenerada com preenchimento é reprovada: significa que o portão
 *     falhou e alguém gastou uma chamada.
 *  4. Acento e caixa não decidem nada.
 *  5. As 20 do golden passam — a conferência não pode reprovar o que foi aprovado.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { derivarAncoras } from './anchor';
import { lerRota } from './shape';
import { verificarNome } from './verificar';
import type { NomePreenchido, RouteFacts } from './types';

const rides: RouteFacts[] = JSON.parse(
  readFileSync(join(import.meta.dirname, '__fixtures__', 'rides.json'), 'utf8'),
);
const golden: { dia: string; km: number; preenchido: NomePreenchido; esperado: string | null }[] =
  JSON.parse(readFileSync(join(import.meta.dirname, '__fixtures__', 'golden.json'), 'utf8'));

let passed = 0;
function check(name: string, fn: () => void): void {
  fn();
  passed += 1;
  console.log(`  ok ${name}`);
}

const cidade = (name: string) => ({ name, country: 'België / Belgique / Belgien', lat: 0, lng: 0 });
const rota = { cities: [cidade('Ninove'), cidade('Pamel'), cidade('Strijtem')] };
const viva = { forma: 'casa-b' as const };

check('preenchimento consistente passa', () => {
  const v = verificarNome(rota, viva, {
    regiao: 'Pajottenland',
    artigo: 'le',
    justificativa: ['Pamel', 'Strijtem'],
  });
  assert.equal(v.ok, true, JSON.stringify(v.problemas));
});

check('cidade que não foi enviada reprova', () => {
  const v = verificarNome(rota, viva, {
    regiao: 'Pajottenland',
    justificativa: ['Pamel', 'Gooik'],
  });
  assert.equal(v.ok, false);
  assert.equal(v.problemas[0].regra, 'justificativa');
  assert.match(v.problemas[0].detalhe, /Gooik/);
});

check('justificativa vazia reprova', () => {
  const v = verificarNome(rota, viva, { regiao: 'Pajottenland', justificativa: [] });
  assert.equal(v.ok, false);
  assert.equal(v.problemas[0].regra, 'justificativa');
});

check('região que é uma das cidades reprova — é trajeto disfarçado', () => {
  const v = verificarNome(rota, viva, { regiao: 'Ninove', justificativa: ['Ninove'] });
  assert.equal(v.ok, false);
  assert.ok(v.problemas.some((p) => p.regra === 'regiao-e-cidade'));
});

check('rota degenerada com preenchimento reprova', () => {
  const v = verificarNome(rota, { forma: 'degenerada' }, {
    regiao: 'Pajottenland',
    justificativa: ['Pamel'],
  });
  assert.equal(v.ok, false);
  assert.equal(v.problemas[0].regra, 'degenerada');
});

check('acento e caixa não decidem nada', () => {
  const comAcento = { cities: [cidade('São Paulo'), cidade('Anhée')] };
  const v = verificarNome(comAcento, viva, { justificativa: ['sao paulo', 'ANHEE'] });
  assert.equal(v.ok, true, JSON.stringify(v.problemas));
});

check('partida igual à chegada reprova', () => {
  const v = verificarNome(rota, viva, {
    origem: 'Ninove',
    destino: 'Ninove',
    justificativa: ['Ninove'],
  });
  assert.equal(v.ok, false);
  assert.ok(v.problemas.some((p) => p.regra === 'repeticao'));
});

check('as 20 do golden passam na conferência', () => {
  const ancoras = derivarAncoras(
    rides.flatMap((r) => [
      { startAt: r.startAt, lat: r.lat0, lng: r.lng0 },
      { startAt: r.startAt, lat: r.lat1, lng: r.lng1 },
    ]),
  );
  for (const g of golden) {
    const r = rides.find(
      (x) => x.startAt.slice(0, 10) === g.dia && Math.round(x.distanceM / 1000) === g.km,
    )!;
    const leitura = lerRota(r, ancoras);
    const v = verificarNome(r, leitura, g.preenchido);
    // As degeneradas são reprovadas de propósito: elas nunca deveriam ter sido enviadas.
    const esperaOk = leitura.forma !== 'degenerada';
    assert.equal(v.ok, esperaOk, `${g.dia}/${g.km}km: ${JSON.stringify(v.problemas)}`);
  }
});

console.log(`\n${passed} checagens de conferência ok`);
