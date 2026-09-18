import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  APARELHO_SISTEMA, CLASSES_DE_FALHA, CLASSE_POR_STATUS_DO_PROVEDOR, NUVEM_PADRAO, SEM_MODELO,
  STATUS_POR_CLASSE, TIPOS_DE_MOTOR,
  alvoDoMotorPedido, classeDoStatusDoProvedor, conformeAoEsquema, ehClasseDeFalha, formatarMotorId,
  lerMotorId, lerMotoresDeNuvemAprovados, motoresSemRecursoConhecido, validarEsquema,
  type Esquema, type MotorDeNuvemAprovado,
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

/**
 * As duas decisões da borda da nuvem (story 5.6).
 *
 * Vivem no núcleo, e não na `ia-narrar`, justamente para caber aqui: nenhuma
 * suíte deste repositório executa Deno, então uma decisão deixada na function
 * seria uma decisão sem rede — e estas quatro linhas da matriz da 5.6 são o
 * ponto em que um aparelho tenta se autoconceder um destinatário novo para dado
 * de saúde.
 */
describe('alvoDoMotorPedido — o motor que o corpo pede', () => {
  const APROVADOS: readonly MotorDeNuvemAprovado[] = [
    { motor: 'nuvem:acme/modelo-9', recursos: ['saude-do-sono'] },
  ];

  it('corpo sem motor resolve pelo padrão — o caminho de antes da 5.6', () => {
    for (const ausente of [undefined, null]) {
      assert.deepEqual(alvoDoMotorPedido(ausente, APROVADOS), { alvo: undefined });
    }
  });

  it('nuvem:padrao explícito é o mesmo caminho, e não passa pela lista', () => {
    assert.deepEqual(alvoDoMotorPedido(NUVEM_PADRAO, APROVADOS), { alvo: undefined });
    // Sem lista nenhuma continua valendo: o padrão não depende dela.
    assert.deepEqual(alvoDoMotorPedido(NUVEM_PADRAO, []), { alvo: undefined });
  });

  it('o motor aprovado vira alvo, partido em provedor e modelo', () => {
    assert.deepEqual(alvoDoMotorPedido('nuvem:acme/modelo-9', APROVADOS), {
      alvo: { provedor: 'acme', modelo: 'modelo-9' },
    });
  });

  it('fora da lista é recusa — mesmo sendo um id perfeitamente legível', () => {
    const r = alvoDoMotorPedido('nuvem:outro/modelo-1', APROVADOS);
    assert.ok('recusa' in r, 'um motor que ninguém aprovou não pode virar alvo');
    assert.equal(r.recusa, 'motor fora da lista aprovada');
  });

  it('lista vazia recusa todo motor nomeado — só o padrão sobrevive', () => {
    assert.ok('recusa' in alvoDoMotorPedido('nuvem:acme/modelo-9', []));
    assert.deepEqual(alvoDoMotorPedido(undefined, []), { alvo: undefined });
  });

  it('o que não é motor de nuvem é recusado, nunca atendido', () => {
    for (const x of [SEM_MODELO, APARELHO_SISTEMA, 'aparelho:acme/pesos', 'lixo', '', 'nuvem:', 42, {}, []]) {
      const r = alvoDoMotorPedido(x, APROVADOS);
      assert.ok('recusa' in r, `${JSON.stringify(x)} não devia virar alvo`);
    }
  });

  it('a aprovação é por id normalizado — não por comparação de texto solta', () => {
    // `nuvem:Padrao/x` é ilegível (palavra reservada em qualquer caixa): não pode
    // escorregar como se fosse o padrão, nem como um provedor chamado "Padrao".
    assert.ok('recusa' in alvoDoMotorPedido('nuvem:Padrao/x', APROVADOS));
  });

  it('não olha os recursos: quem cruza recurso com motor é o hospedeiro', () => {
    // A entrada aprova o motor só para `saude-do-sono`, e mesmo assim ele vira
    // alvo — a function narra o que lhe pedirem; o filtro por recurso é do
    // catálogo do app, que é onde há um recurso corrente para comparar.
    assert.deepEqual(alvoDoMotorPedido('nuvem:acme/modelo-9', APROVADOS), {
      alvo: { provedor: 'acme', modelo: 'modelo-9' },
    });
  });
});

describe('classeDoStatusDoProvedor — o HTTP do fornecedor vira classe', () => {
  it('sem status é saida-invalida: o provedor respondeu e não se lê', () => {
    assert.equal(classeDoStatusDoProvedor(undefined), 'saida-invalida');
  });

  it('a tabela mapeia o que se reconhece', () => {
    assert.equal(classeDoStatusDoProvedor(400), 'capacidade');
    assert.equal(classeDoStatusDoProvedor(401), 'indisponivel');
    assert.equal(classeDoStatusDoProvedor(403), 'indisponivel');
    assert.equal(classeDoStatusDoProvedor(404), 'indisponivel');
    assert.equal(classeDoStatusDoProvedor(413), 'janela');
    assert.equal(classeDoStatusDoProvedor(422), 'capacidade');
    assert.equal(classeDoStatusDoProvedor(429), 'transitoria');
  });

  it('fora da tabela cai em transitoria — o desfecho seguro', () => {
    for (const s of [500, 502, 503, 504, 418, 200, 0, -1]) {
      assert.equal(classeDoStatusDoProvedor(s), 'transitoria', `status ${s}`);
    }
  });

  it('é total: todo status devolve uma das sete, e com status fixado', () => {
    for (const s of [undefined, 400, 401, 403, 404, 413, 422, 429, 500, 999]) {
      const c = classeDoStatusDoProvedor(s);
      assert.ok(ehClasseDeFalha(c), `${s} devolveu algo que não é classe: ${c}`);
      assert.equal(typeof STATUS_POR_CLASSE[c], 'number');
    }
  });

  it('a tabela só fala em classes do núcleo — nenhuma grafia inventada', () => {
    for (const c of Object.values(CLASSE_POR_STATUS_DO_PROVEDOR)) assert.ok(ehClasseDeFalha(c));
  });

  it('não é a tabela do cliente: o 404 do provedor recua, o 502 dele não', () => {
    // Em `ia/nuvem.ts` o status é o da function; aqui é o do fornecedor. Um 404
    // lá seria outra coisa — por isso são duas tabelas, e não uma compartilhada.
    assert.equal(classeDoStatusDoProvedor(404), 'indisponivel');
    assert.equal(classeDoStatusDoProvedor(502), 'transitoria');
  });
});

/**
 * O relator de descarte e o detector de typo (story 5.6, revisão adversarial).
 *
 * O secret é editado à mão e mora fora do git: nenhuma barreira mecânica o
 * alcança. O que resta é não deixar a entrada errada sumir calada — e são dois
 * sumiços diferentes, com donos diferentes.
 */
describe('lerMotoresDeNuvemAprovados — o que é descartado, e quem fica sabendo', () => {
  it('relata cada entrada descartada, com o motivo, sem derrubar as boas', () => {
    const vistos: { motivo: string; item: unknown }[] = [];
    const lidos = lerMotoresDeNuvemAprovados(
      [
        { motor: 'nuvem:acme/modelo-9', recursos: ['saude-do-sono'] },
        { motor: NUVEM_PADRAO, recursos: ['saude-do-sono'] },
        { motor: APARELHO_SISTEMA, recursos: ['saude-do-sono'] },
        { motor: 'nuvem:acme/x' },
        { motor: 'nuvem:acme/y', recursos: [] },
        'nem é objeto',
      ],
      (motivo, item) => vistos.push({ motivo, item }),
    );
    assert.deepEqual(lidos, [{ motor: 'nuvem:acme/modelo-9', recursos: ['saude-do-sono'] }]);
    assert.equal(vistos.length, 5, JSON.stringify(vistos));
    // O relator vê o id, nunca prompt: aqui só circulam motor e motivo.
    assert.ok(vistos.some((v) => v.motivo.includes('recursos ausente')));
    assert.ok(vistos.some((v) => v.motivo.includes('recursos vazio')));
    assert.ok(vistos.some((v) => v.item === NUVEM_PADRAO));
  });

  it('um relator que lança não esvazia o catálogo de quem o passou', () => {
    // Diagnóstico não decide nada — nem o de quem o escreveu mal.
    const lidos = lerMotoresDeNuvemAprovados(
      [{ motor: 'lixo', recursos: ['x'] }, { motor: 'nuvem:acme/modelo-9', recursos: ['saude-do-sono'] }],
      () => {
        throw new Error('o console explodiu');
      },
    );
    assert.equal(lidos.length, 1);
  });

  it('sem relator, se comporta exatamente como antes', () => {
    assert.deepEqual(lerMotoresDeNuvemAprovados([{ motor: 'lixo', recursos: ['x'] }]), []);
    assert.deepEqual(lerMotoresDeNuvemAprovados('nada disso'), []);
  });
});

describe('motoresSemRecursoConhecido — o typo que ninguém veria', () => {
  const CONHECIDOS = ['saude-do-sono', 'retrospectiva'];

  it('acha a entrada cujos recursos não nomeiam recurso nenhum que exista', () => {
    // `saude_do_sono` produz uma entrada perfeitamente VÁLIDA que nunca casa: o
    // motor some do seletor sem erro, sem log e sem nada a que se agarrar.
    const comTypo: MotorDeNuvemAprovado = { motor: 'nuvem:acme/modelo-9', recursos: ['saude_do_sono'] };
    const boa: MotorDeNuvemAprovado = { motor: 'nuvem:acme/modelo-4', recursos: ['saude-do-sono'] };
    assert.deepEqual(motoresSemRecursoConhecido([comTypo, boa], CONHECIDOS), [comTypo]);
  });

  it('basta UM recurso conhecido para a entrada não ser suspeita', () => {
    // Um recurso que este app ainda não conhece pode ser de uma versão futura —
    // e não é motivo para acusar a entrada que também nomeia um que ele conhece.
    const mista: MotorDeNuvemAprovado = {
      motor: 'nuvem:acme/modelo-9',
      recursos: ['recurso-do-futuro', 'saude-do-sono'],
    };
    assert.deepEqual(motoresSemRecursoConhecido([mista], CONHECIDOS), []);
  });

  it('lista vazia não acusa nada', () => {
    assert.deepEqual(motoresSemRecursoConhecido([], CONHECIDOS), []);
  });
});
