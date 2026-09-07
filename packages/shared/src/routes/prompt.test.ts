/**
 * O prompt e a leitura da resposta (ADR 0041, Fase 3).
 *
 * O que estes testes protegem:
 *  1. O prompt leva as cidades **na ordem** e na grafia do banco — é essa grafia
 *     que a `justificativa` tem de devolver, e é sobre ela que a conferência roda.
 *  2. O prompt NUNCA leva os pontos do GPX. Foi a proposta inicial e foi
 *     rejeitada na ADR; se um dia alguém a reintroduzir, aqui quebra.
 *  3. Resposta ilegível vira `null`, não exceção — recusar é resultado válido.
 *  4. O caminho inteiro fecha: resposta crua → peças → conferência → frase.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { derivarAncoras } from './anchor';
import { lerRespostaDoModelo, montarPromptDeNome, PROMPT_NOME_VERSAO } from './prompt';
import { montarNome } from './molde';
import { lerRota } from './shape';
import { verificarNome } from './verificar';
import type { RouteFacts } from './types';

const rides: RouteFacts[] = JSON.parse(
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

/** A do Pajottenland: 75 km, 14 cidades, a que o dono citou como o caso ruim. */
const pajottenland = rides.find(
  (r) => r.startAt.slice(0, 10) === '2026-08-15' && Math.round(r.distanceM / 1000) === 75,
)!;

check('o prompt leva as cidades na ordem e na grafia do banco', () => {
  const p = montarPromptDeNome(lerRota(pajottenland, ancoras), pajottenland);
  const linhas = p.usuario.split('\n');
  const numeradas = linhas.filter((l) => /^\d+\. /.test(l)).map((l) => l.replace(/^\d+\. /, ''));
  assert.deepEqual(numeradas, pajottenland.cities.map((c) => c.name));
  // Grafia flamenga preservada: é ela que a justificativa devolve.
  assert.ok(numeradas.includes('Sint-Martens-Lennik'));
});

check('o prompt diz a língua, a forma, a distância e a subida', () => {
  const p = montarPromptDeNome(lerRota(pajottenland, ancoras), pajottenland);
  assert.match(p.usuario, /Língua do nome: francês/);
  assert.match(p.usuario, /saiu de casa e terminou em outro lugar/);
  assert.match(p.usuario, /75,2 km/);
  assert.match(p.usuario, /Subida: 413 m/);
});

check('o prompt NUNCA leva os pontos do GPX', () => {
  const p = montarPromptDeNome(lerRota(pajottenland, ancoras), pajottenland);
  const tudo = `${p.sistema}\n${p.usuario}`;
  // Coordenada solta tem ponto decimal com 4+ casas; nome de cidade não tem.
  assert.doesNotMatch(tudo, /-?\d+\.\d{4,}/, 'coordenada vazou para o prompt');
  assert.doesNotMatch(tudo, /\blat\b|\blng\b|\bgpx\b/i);
});

check('o prompt pede JSON e carrega versão', () => {
  const p = montarPromptDeNome(lerRota(pajottenland, ancoras), pajottenland);
  assert.equal(p.json, true);
  assert.equal(PROMPT_NOME_VERSAO, 1);
});

check('a travessia de três países nomeia os três', () => {
  const meuseRhin = rides.find((r) => r.startAt.slice(0, 10) === '2026-07-18')!;
  const p = montarPromptDeNome(lerRota(meuseRhin, ancoras), meuseRhin);
  assert.match(p.usuario, /Países atravessados:/);
  assert.match(p.usuario, /Deutschland/);
  assert.match(p.usuario, /Nederland/);
});

/* ─────────────── a leitura da resposta ─────────────── */

check('JSON limpo vira peças', () => {
  const r = lerRespostaDoModelo(
    '{"regiao":"Pajottenland","artigo":"le","via":null,"justificativa":["Pamel","Strijtem"]}',
  );
  assert.equal(r?.regiao, 'Pajottenland');
  assert.equal(r?.artigo, 'le');
  assert.equal(r?.via, undefined);
  assert.deepEqual(r?.justificativa, ['Pamel', 'Strijtem']);
});

check('JSON dentro de cerca de código também é lido', () => {
  const r = lerRespostaDoModelo('```json\n{"regiao":"Hageland","justificativa":["Lubbeek"]}\n```');
  assert.equal(r?.regiao, 'Hageland');
});

check('resposta ilegível vira null, não exceção', () => {
  assert.equal(lerRespostaDoModelo('desculpe, não sei nomear este percurso'), null);
  assert.equal(lerRespostaDoModelo(''), null);
  assert.equal(lerRespostaDoModelo('[1,2,3]'), null);
  assert.equal(lerRespostaDoModelo('null'), null);
});

check('JSON sem justificativa vira null — sem lastro não há nome', () => {
  assert.equal(lerRespostaDoModelo('{"regiao":"Pajottenland","artigo":"le"}'), null);
  assert.equal(lerRespostaDoModelo('{"regiao":"X","justificativa":[]}'), null);
  assert.equal(lerRespostaDoModelo('{"regiao":"X","justificativa":["  "]}'), null);
});

check('string vazia em campo opcional não vira topônimo vazio', () => {
  const r = lerRespostaDoModelo('{"regiao":"","destino":"  ","justificativa":["Pamel"]}');
  assert.equal(r?.regiao, undefined);
  assert.equal(r?.destino, undefined);
});

check('o caminho inteiro fecha: resposta crua → peças → conferência → frase', () => {
  const leitura = lerRota(pajottenland, ancoras);
  const bruto = JSON.stringify({
    regiao: 'Pajottenland',
    artigo: 'le',
    justificativa: ['Sint-Martens-Lennik', 'Strijtem', 'Pamel'],
  });
  const pecas = lerRespostaDoModelo(bruto)!;
  assert.equal(verificarNome(pajottenland, leitura, pecas).ok, true);
  assert.equal(
    montarNome(leitura, pecas, pajottenland.distanceM),
    'Tour du Pajottenland',
    'o nome que o dono aprovou tem de sair do caminho completo',
  );
});

check('região inventada é barrada antes de virar nome', () => {
  const leitura = lerRota(pajottenland, ancoras);
  const pecas = lerRespostaDoModelo(
    '{"regiao":"Toscana","artigo":"la","justificativa":["Siena"]}',
  )!;
  const v = verificarNome(pajottenland, leitura, pecas);
  assert.equal(v.ok, false);
  assert.match(v.problemas[0].detalhe, /Siena/);
});

console.log(`\n${passed} checagens de prompt ok`);
