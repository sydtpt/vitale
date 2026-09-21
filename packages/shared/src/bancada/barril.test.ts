import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import * as barril from '../index';

/**
 * A régua inteira chega ao barril (story 5.13).
 *
 * O `index.ts` exporta a bancada **nome por nome**: entre dois `export *` um nome repetido
 * some em silêncio, e o hospedeiro que o importa passa a ver `undefined` — o tipo de
 * defeito que só aparece no iPhone, em execução. Lista explícita troca isso por erro de
 * compilação; este teste cobra a outra metade: um export novo no módulo não pode ficar de
 * fora da lista sem ninguém ver.
 *
 * Os valores são conferidos em execução (estão mesmo no objeto do barril); os tipos, pelo
 * texto do `index.ts` — em execução tipo não existe.
 */

const DIR = import.meta.dirname;
const RAIZ = join(DIR, '..');

const DECLARA =
  /^[ \t]*export\s+(?:declare\s+)?(?:async\s+)?(?:function\*?\s*|const\s+enum\s+|enum\s+|const\s+|let\s+|var\s+|(?:abstract\s+)?class\s+|interface\s+|type\s+)([A-Za-z_$][\w$]*)/gm;

/** Os nomes que os fontes da régua exportam, com o arquivo de cada um. */
function exportados(): { nome: string; arquivo: string; valor: boolean }[] {
  const out: { nome: string; arquivo: string; valor: boolean }[] = [];
  for (const arquivo of readdirSync(DIR).filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts'))) {
    const src = readFileSync(join(DIR, arquivo), 'utf8');
    for (const m of src.matchAll(DECLARA)) {
      const linha = m[0];
      out.push({ nome: m[1]!, arquivo, valor: !/\b(?:interface|type)\s+$/.test(linha.replace(m[1]!, '')) });
    }
  }
  return out;
}

describe('o barril leva a régua da bancada inteira', () => {
  const nomes = exportados();

  it('o módulo existe e exporta o que a story move para cá', () => {
    const soNomes = nomes.map((n) => n.nome);
    for (const esperado of ['enumerarJanelas', 'amostraDaNuvem', 'linhaDaMedicao', 'medidasDoPortao', 'foraEmTexto']) {
      assert.ok(soNomes.includes(esperado), `packages/shared/src/bancada/ não exporta mais ${esperado}`);
    }
    assert.ok(nomes.length >= 40, `a leitura achou só ${nomes.length} exports — o detector quebrou?`);
  });

  it('cada valor da régua está no barril, e é o mesmo objeto', () => {
    const doBarril = barril as unknown as Record<string, unknown>;
    const fora = nomes.filter((n) => n.valor && !(n.nome in doBarril)).map((n) => `${n.arquivo}: ${n.nome}`);
    assert.deepEqual(
      fora,
      [],
      `valor da régua fora do barril: ${fora.join(', ')}. Acrescente-o ao export nomeado de index.ts — ` +
        'sem isso o hospedeiro importa `undefined` e só descobre em execução.',
    );
  });

  it('cada tipo da régua está nomeado no export do index.ts', () => {
    const indice = readFileSync(join(RAIZ, 'index.ts'), 'utf8');
    // O bloco de exports da bancada — nome por nome, e é nele que o tipo tem de aparecer.
    const blocos = [...indice.matchAll(/export\s*\{([^}]*)\}\s*from\s*'\.\/bancada\/[\w-]+';/g)].map((m) => m[1]!);
    assert.ok(blocos.length >= 4, 'o index.ts não exporta a bancada nome por nome — voltou o `export *`?');
    const listados = new Set(
      blocos.flatMap((b) => b.split(',').map((x) => x.replace(/^\s*type\s+/, '').trim()).filter(Boolean)),
    );
    const fora = nomes.filter((n) => !listados.has(n.nome)).map((n) => `${n.arquivo}: ${n.nome}`);
    assert.deepEqual(fora, [], `export da régua fora da lista do index.ts: ${fora.join(', ')}`);
  });
});
