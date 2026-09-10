import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  APARELHO_SISTEMA, CLASSES_DE_FALHA, NUVEM_PADRAO, SEM_MODELO, STATUS_POR_CLASSE, TIPOS_DE_MOTOR,
  conformeAoEsquema, ehClasseDeFalha, formatarMotorId, lerMotorId, validarEsquema,
  type Esquema,
} from './fio';

/**
 * O fio é o que tem de ser igual nas três pontas. O que se prova aqui é a
 * gramática (um id lê e escreve do mesmo jeito, e o ilegível não é adivinhado),
 * as sete classes e o subconjunto fechado de esquema.
 */

describe('as classes de falha', () => {
  it('são as sete da espinha, sem repetição', () => {
    assert.deepEqual([...CLASSES_DE_FALHA].sort(), [
      'capacidade', 'guarda', 'indisponivel', 'janela', 'recusa-do-modelo', 'saida-invalida', 'transitoria',
    ]);
    assert.equal(new Set(CLASSES_DE_FALHA).size, 7);
  });

  it('ehClasseDeFalha reconhece só elas', () => {
    for (const c of CLASSES_DE_FALHA) assert.ok(ehClasseDeFalha(c));
    for (const x of ['erro', 'Transitoria', '', null, undefined, 3, {}]) assert.equal(ehClasseDeFalha(x), false);
  });

  it('toda classe tem status fixado, e o status é de erro', () => {
    assert.deepEqual(Object.keys(STATUS_POR_CLASSE).sort(), [...CLASSES_DE_FALHA].sort());
    assert.equal(STATUS_POR_CLASSE.indisponivel, 503);
    assert.equal(STATUS_POR_CLASSE.capacidade, 422);
    assert.equal(STATUS_POR_CLASSE.guarda, 422);
    assert.equal(STATUS_POR_CLASSE['recusa-do-modelo'], 422);
    assert.equal(STATUS_POR_CLASSE.janela, 413);
    assert.equal(STATUS_POR_CLASSE['saida-invalida'], 502);
    assert.equal(STATUS_POR_CLASSE.transitoria, 502);
  });
});

describe('a gramática de MotorId', () => {
  it('os tipos vêm em ordem de exposição', () => {
    assert.deepEqual([...TIPOS_DE_MOTOR], ['sem-modelo', 'aparelho', 'nuvem']);
  });

  it('lê as cinco formas', () => {
    assert.deepEqual(lerMotorId(SEM_MODELO), { tipo: 'sem-modelo' });
    assert.deepEqual(lerMotorId(APARELHO_SISTEMA), { tipo: 'aparelho', variante: 'sistema' });
    assert.deepEqual(lerMotorId(NUVEM_PADRAO), { tipo: 'nuvem', variante: 'padrao' });
    assert.deepEqual(lerMotorId('aparelho:local/pesos-a'), {
      tipo: 'aparelho', variante: 'pesos', provedor: 'local', pesos: 'pesos-a',
    });
    assert.deepEqual(lerMotorId('nuvem:prov-a/modelo-1'), {
      tipo: 'nuvem', variante: 'modelo', provedor: 'prov-a', modelo: 'modelo-1',
    });
  });

  it('o tipo vai até o primeiro ":", o provedor até o primeiro "/", e o resto é literal', () => {
    assert.deepEqual(lerMotorId('nuvem:prov/familia/modelo:versao'), {
      tipo: 'nuvem', variante: 'modelo', provedor: 'prov', modelo: 'familia/modelo:versao',
    });
    assert.deepEqual(lerMotorId('aparelho:org/repo/pesos-4bit'), {
      tipo: 'aparelho', variante: 'pesos', provedor: 'org', pesos: 'repo/pesos-4bit',
    });
  });

  it('não adivinha: o que não se lê é null', () => {
    const ilegiveis: unknown[] = [
      '', 'lixo', 'sem-modelo:x', 'Nuvem:padrao', 'nuvem:', 'nuvem:prov', 'nuvem:/modelo', 'nuvem:prov/',
      'aparelho:', 'aparelho:x', 'aparelho:sistema/x', 'nuvem:padrao/x', 'nuvem:sistema/x',
      // P9: a palavra reservada vale em qualquer caixa — "Padrao" não vira provedor.
      'nuvem:Padrao/x', 'nuvem:PADRAO/x', 'aparelho:Sistema/x', 'nuvem:SiStEmA/x',
      'ceu:prov/modelo', ' nuvem:padrao', 'nuvem:prov /m', 'nuvem:prov/m m', null, undefined, 42, {},
    ];
    for (const x of ilegiveis) assert.equal(lerMotorId(x), null, `leu ${JSON.stringify(x)}`);
  });

  it('formatar desfaz ler, sem transformar o id', () => {
    const ids = [
      SEM_MODELO, APARELHO_SISTEMA, NUVEM_PADRAO, 'aparelho:local/pesos-a', 'nuvem:prov-a/modelo-1',
      'nuvem:prov/familia/modelo:versao',
    ];
    for (const id of ids) assert.equal(formatarMotorId(lerMotorId(id)!), id);
  });
});

describe('Esquema — o subconjunto fechado', () => {
  const bom: Esquema = {
    type: 'object',
    properties: {
      dimensao: { type: 'string', enum: ['duracao', 'continuidade'] },
      nota: { type: 'integer', minimum: 0, maximum: 2 },
      medida: { type: 'boolean' },
      cidades: { type: 'array', items: { type: 'string' }, minItems: 1, maxItems: 5 },
    },
    required: ['dimensao', 'nota'],
  };

  it('aceita todas as palavras do subconjunto', () => {
    assert.deepEqual(validarEsquema(bom), []);
    assert.deepEqual(validarEsquema({ type: 'string' }), []);
    assert.deepEqual(validarEsquema({ type: 'integer' }), []);
    assert.deepEqual(validarEsquema({ type: 'array', items: { type: 'boolean' } }), []);
  });

  it('palavra desconhecida reprova — inclusive as que o JSON Schema tem e o subconjunto não', () => {
    for (const palavra of ['format', '$ref', 'oneOf', 'description', 'additionalProperties', 'pattern']) {
      const p = validarEsquema({ type: 'string', [palavra]: 'x' });
      assert.ok(p.some((x) => x.includes(`"${palavra}"`)), `${palavra}: ${p.join(' | ')}`);
    }
    // Palavra de outro tipo também é desconhecida aqui.
    assert.ok(validarEsquema({ type: 'string', minimum: 1 }).length > 0);
    // E o erro aparece com o caminho de onde ele está.
    const fundo = validarEsquema({ type: 'object', properties: { a: { type: 'string', format: 'date' } } });
    assert.deepEqual(fundo, ['$.properties.a: palavra desconhecida "format"']);
  });

  it('null, união de tipos e tipo inventado ficam fora', () => {
    for (const e of [{ type: 'null' }, { type: ['string', 'null'] }, { type: 'number' }, { type: 'toString' }, {}]) {
      assert.ok(validarEsquema(e).length > 0, JSON.stringify(e));
    }
    for (const e of [null, 'string', [], 3]) assert.ok(validarEsquema(e).length > 0);
  });

  it('cobra a forma de cada palavra', () => {
    const casos: unknown[] = [
      { type: 'object', properties: {} },
      { type: 'object' },
      { type: 'object', properties: { a: { type: 'string' } }, required: ['b'] },
      { type: 'object', properties: { a: { type: 'string' } }, required: ['a', 'a'] },
      { type: 'object', properties: { a: { type: 'string' } }, required: ['toString'] },
      { type: 'object', properties: { a: { type: 'string' } }, required: 'a' },
      { type: 'string', enum: [] },
      { type: 'string', enum: ['a', 'a'] },
      { type: 'string', enum: [1] },
      { type: 'integer', minimum: 0.5 },
      { type: 'integer', minimum: 3, maximum: 2 },
      { type: 'array' },
      { type: 'array', items: { type: 'string' }, minItems: -1 },
      { type: 'array', items: { type: 'string' }, minItems: 3, maxItems: 1 },
      { type: 'array', items: { type: 'null' } },
    ];
    for (const e of casos) assert.ok(validarEsquema(e).length > 0, JSON.stringify(e));
  });

  it('conformeAoEsquema aceita o que cabe', () => {
    assert.ok(conformeAoEsquema({ dimensao: 'duracao', nota: 1 }, bom));
    assert.ok(conformeAoEsquema({ dimensao: 'continuidade', nota: 2, medida: true, cidades: ['Lennik'] }, bom));
  });

  it('conformeAoEsquema recusa o que não cabe', () => {
    const fora: unknown[] = [
      null, [], 'texto',
      { nota: 1 },                                             // falta a obrigatória
      { dimensao: 'duracao', nota: 3 },                        // acima do máximo
      { dimensao: 'duracao', nota: 1.5 },                      // não é inteiro
      { dimensao: 'sono', nota: 1 },                           // fora do enum
      { dimensao: 'duracao', nota: 1, extra: true },           // propriedade não declarada
      { dimensao: 'duracao', nota: 1, medida: null },          // null não existe no subconjunto
      { dimensao: 'duracao', nota: 1, cidades: [] },           // abaixo de minItems
      { dimensao: 'duracao', nota: 1, cidades: [1] },          // item fora do tipo
      { dimensao: 'duracao', nota: 1, toString: 'x' },         // nome do protótipo não é propriedade
    ];
    for (const v of fora) assert.equal(conformeAoEsquema(v, bom), false, JSON.stringify(v));
    const comObrigatoriaDoProtótipo: Esquema = {
      type: 'object', properties: { a: { type: 'string' } }, required: ['a'],
    };
    assert.equal(conformeAoEsquema({}, comObrigatoriaDoProtótipo), false);
  });

  it('conformeAoEsquema diz "não" — nunca undefined — a um type fora do subconjunto', () => {
    // P9: um esquema que chegou pelo fio sem passar por validarEsquema.
    for (const type of ['null', 'number', 'oneOf', '']) {
      const fora = { type } as unknown as Esquema;
      assert.strictEqual(conformeAoEsquema('qualquer', fora), false, type);
    }
  });
});
