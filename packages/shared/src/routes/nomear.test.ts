/**
 * O caminho inteiro do nome (ADR 0042).
 *
 * O que estes testes protegem:
 *  1. Rota degenerada **não gasta uma chamada**. O portão sai antes, e o teste
 *     conta as chamadas — não basta o nome sair nulo.
 *  2. Recusa (permanente) e erro (transitório) são coisas diferentes: a primeira
 *     vira meta gravada, a segunda sobe como exceção. Confundir as duas queima a
 *     rota para sempre por causa de um timeout.
 *  3. A meta carrega o que a auditoria precisa: forma, língua, região, versão do
 *     prompt, provedor, modelo e tokens.
 *  4. O feliz produz o nome que o dono aprovou.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { derivarAncoras } from './anchor';
import { nomearRota, type ChamadorDeModelo } from './nomear';
import type { RouteFacts } from './types';

const rides: RouteFacts[] = JSON.parse(
  readFileSync(join(import.meta.dirname, '__fixtures__', 'rides.json'), 'utf8'),
);

let passed = 0;
const testes: { nome: string; fn: () => Promise<void> }[] = [];
function check(nome: string, fn: () => Promise<void>): void {
  testes.push({ nome, fn });
}

const ancoras = derivarAncoras(
  rides.flatMap((r) => [
    { startAt: r.startAt, lat: r.lat0, lng: r.lng0 },
    { startAt: r.startAt, lat: r.lat1, lng: r.lng1 },
  ]),
);

const acharRota = (dia: string, km: number) =>
  rides.find((r) => r.startAt.slice(0, 10) === dia && Math.round(r.distanceM / 1000) === km)!;

const pajottenland = acharRota('2026-08-15', 75);
const degenerada = acharRota('2026-08-31', 5);
const agora = () => new Date('2026-09-07T12:00:00Z');

/** Chamador falso que conta quantas vezes foi acionado. */
function falso(texto: string, extra: Record<string, unknown> = {}) {
  const chamadas: unknown[] = [];
  const chamar: ChamadorDeModelo = async (p) => {
    chamadas.push(p);
    return { texto, provedor: 'fake', modelo: 'fake-1', motivoDeParada: 'STOP', tokens: { entrada: 120, saida: 40 }, ...extra };
  };
  return { chamar, chamadas };
}

const BOA = JSON.stringify({
  regiao: 'Pajottenland',
  artigo: 'le',
  justificativa: ['Sint-Martens-Lennik', 'Strijtem', 'Pamel'],
});

check('o feliz produz o nome aprovado e a meta completa', async () => {
  const { chamar, chamadas } = falso(BOA);
  const r = await nomearRota(pajottenland, ancoras, chamar, { agora });
  assert.equal(r.nome, 'Tour du Pajottenland');
  assert.equal(chamadas.length, 1);
  assert.equal(r.meta.recusa, undefined);
  assert.equal(r.meta.forma, 'casa-b');
  assert.equal(r.meta.lingua, 'fr');
  assert.equal(r.meta.regiao, 'Pajottenland');
  assert.equal(r.meta.artigo, 'le');
  assert.equal(r.meta.versaoPrompt, 1);
  assert.equal(r.meta.provedor, 'fake');
  assert.equal(r.meta.modelo, 'fake-1');
  assert.deepEqual(r.meta.tokens, { entrada: 120, saida: 40 });
  assert.equal(r.meta.em, '2026-09-07T12:00:00.000Z');
});

check('rota degenerada não gasta uma chamada', async () => {
  const { chamar, chamadas } = falso(BOA);
  const r = await nomearRota(degenerada, ancoras, chamar, { agora });
  assert.equal(r.nome, null);
  assert.equal(r.meta.recusa, 'degenerada');
  assert.equal(chamadas.length, 0, 'o portão deixou passar uma chamada que não devia existir');
});

check('resposta truncada é recusada, e a causa fica nomeada', async () => {
  const { chamar } = falso('{"regiao":"Pajotten', { motivoDeParada: 'MAX_TOKENS' });
  const r = await nomearRota(pajottenland, ancoras, chamar, { agora });
  assert.equal(r.nome, null);
  assert.equal(r.meta.recusa, 'truncado');
  assert.equal(r.meta.detalhe, 'MAX_TOKENS');
});

check('resposta ilegível vira recusa registrada', async () => {
  const { chamar } = falso('não consigo nomear este percurso');
  const r = await nomearRota(pajottenland, ancoras, chamar, { agora });
  assert.equal(r.nome, null);
  assert.equal(r.meta.recusa, 'ilegivel');
});

check('região inventada é reprovada, e a meta guarda o que o modelo tentou', async () => {
  const { chamar } = falso(JSON.stringify({ regiao: 'Toscana', artigo: 'la', justificativa: ['Siena'] }));
  const r = await nomearRota(pajottenland, ancoras, chamar, { agora });
  assert.equal(r.nome, null);
  assert.equal(r.meta.recusa, 'reprovado');
  assert.equal(r.meta.regiao, 'Toscana', 'a tentativa tem de ficar registrada para auditoria');
  assert.match(r.meta.detalhe ?? '', /Siena/);
});

check('cidade da rota vendida como região é reprovada', async () => {
  const { chamar } = falso(JSON.stringify({ regiao: 'Ninove', justificativa: ['Ninove'] }));
  const r = await nomearRota(pajottenland, ancoras, chamar, { agora });
  assert.equal(r.nome, null);
  assert.equal(r.meta.recusa, 'reprovado');
  assert.match(r.meta.detalhe ?? '', /não é uma região|regiao-e-cidade/);
});

check('erro de rede SOBE — não vira recusa gravada', async () => {
  const chamar: ChamadorDeModelo = async () => {
    throw new Error('provedor google HTTP 429: cota');
  };
  await assert.rejects(
    () => nomearRota(pajottenland, ancoras, chamar, { agora }),
    /429/,
    'timeout não pode queimar a rota para sempre',
  );
});

check('sem região o trajeto assume, e o nome sai mesmo assim', async () => {
  const halle = acharRota('2026-07-27', 50);
  const { chamar } = falso(JSON.stringify({ destino: 'Hal', justificativa: ['Halle'] }));
  const r = await nomearRota(halle, ancoras, chamar, { agora });
  assert.equal(r.nome, 'Aller à Hal');
  assert.equal(r.meta.regiao, null);
});

(async () => {
  for (const t of testes) {
    await t.fn();
    passed += 1;
    console.log(`  ok ${t.nome}`);
  }
  console.log(`\n${passed} checagens de orquestração ok`);
})();
