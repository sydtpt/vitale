import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { APARELHO_SISTEMA, NUVEM_PADRAO, SEM_MODELO } from './fio';
import { ELOS_DE_PADRAO, type Descritor } from './orquestrar';
import { CATALOGO_DE_RECURSOS, RECURSOS, validarDescritor, type RecursoId } from './recursos';

/**
 * O catálogo nasce vazio (a retrospectiva entra na 5.2, a Saúde do sono na 5.3),
 * então `validarDescritor` se prova aqui com descritores falsos — e o teste que
 * percorre o catálogo passa a morder no dia em que o primeiro descritor entrar.
 */

type Qualquer = Descritor<unknown, unknown>;

const valido = (extra: Record<string, unknown> = {}): Qualquer => ({
  recurso: 'saude-do-sono',
  versao: 1,
  regimeDeNumeros: 'interpolado',
  regimeMaximo: 'aparelho',
  cadeiaPadrao: [APARELHO_SISTEMA, SEM_MODELO],
  grava: false,
  montarPedido: () => null,
  interpretar: () => ({}),
  conferir: () => ({ ok: true }),
  montarFrase: () => '',
  semModelo: () => ({ ausencia: 'nada a dizer' }),
  ...extra,
}) as Qualquer;

describe('os recursos', () => {
  it('são os três da espinha, sem repetição', () => {
    assert.deepEqual([...RECURSOS], ['retrospectiva', 'saude-do-sono', 'nome-de-rota']);
    const r: RecursoId = 'nome-de-rota';
    // @ts-expect-error — recurso fora do catálogo não é RecursoId.
    const fora: RecursoId = 'presenca';
    assert.ok(r && fora);
  });

  it('os elos de padrão são sem-modelo e as duas variantes simbólicas', () => {
    assert.deepEqual([...ELOS_DE_PADRAO].sort(), [APARELHO_SISTEMA, NUVEM_PADRAO, SEM_MODELO].sort());
  });
});

describe('o catálogo', () => {
  it('todo descritor registrado é válido, e cada recurso aparece uma vez', () => {
    for (const d of CATALOGO_DE_RECURSOS) assert.deepEqual(validarDescritor(d), [], d.recurso);
    const ids = CATALOGO_DE_RECURSOS.map((d) => d.recurso);
    assert.equal(new Set(ids).size, ids.length, `recurso registrado duas vezes: ${ids.join(', ')}`);
  });
});

describe('validarDescritor', () => {
  it('aceita um descritor bem formado, com ou sem gravação e pedido curto', () => {
    assert.deepEqual(validarDescritor(valido()), []);
    assert.deepEqual(validarDescritor(valido({ grava: { recusaEResultado: true }, pedidoCurto: () => null })), []);
    assert.deepEqual(validarDescritor(valido({
      recurso: 'retrospectiva', regimeDeNumeros: 'copiado-e-conferido', regimeMaximo: 'nuvem',
      cadeiaPadrao: [NUVEM_PADRAO, APARELHO_SISTEMA, SEM_MODELO], grava: { recusaEResultado: false },
    })), []);
    assert.deepEqual(validarDescritor(valido({ regimeMaximo: 'sem-modelo', cadeiaPadrao: [SEM_MODELO] })), []);
  });

  const reprova = (extra: Record<string, unknown>, trecho: RegExp) => {
    const p = validarDescritor(valido(extra));
    assert.ok(p.some((x) => trecho.test(x)), `${JSON.stringify(extra)} → ${JSON.stringify(p)}`);
  };

  it('recurso, versão e regimes desconhecidos', () => {
    reprova({ recurso: 'presenca' }, /recurso fora do catálogo/);
    for (const versao of [0, -1, 1.5, NaN, '1']) reprova({ versao }, /versão/);
    reprova({ regimeDeNumeros: 'livre' }, /regime de números/);
    reprova({ regimeDeNumeros: undefined }, /regime de números/);
    reprova({ regimeMaximo: 'servidor' }, /regimeMaximo desconhecido/);
  });

  it('a cadeia padrão termina em sem-modelo uma vez', () => {
    reprova({ cadeiaPadrao: [] }, /não termina em sem-modelo/);
    reprova({ cadeiaPadrao: [APARELHO_SISTEMA] }, /não termina em sem-modelo/);
    reprova({ cadeiaPadrao: [SEM_MODELO, APARELHO_SISTEMA, SEM_MODELO] }, /repete/);
    reprova({ cadeiaPadrao: 'sem-modelo' }, /não é lista/);
  });

  it('a cadeia padrão só nomeia os três elos de padrão', () => {
    reprova({ cadeiaPadrao: ['nuvem:prov-a/modelo-1', SEM_MODELO] }, /só sem-modelo, aparelho:sistema e nuvem:padrao/);
    reprova({ cadeiaPadrao: ['aparelho:local/pesos-a', SEM_MODELO] }, /só sem-modelo/);
    reprova({ cadeiaPadrao: ['lixo', SEM_MODELO] }, /só sem-modelo/);
  });

  it('a cadeia padrão não sobe a exposição nem passa do regimeMaximo', () => {
    reprova({ regimeMaximo: 'nuvem', cadeiaPadrao: [APARELHO_SISTEMA, NUVEM_PADRAO, SEM_MODELO] }, /aumenta a exposição/);
    reprova({ regimeMaximo: 'aparelho', cadeiaPadrao: [NUVEM_PADRAO, SEM_MODELO] }, /passa do regimeMaximo/);
    reprova({ regimeMaximo: 'sem-modelo', cadeiaPadrao: [APARELHO_SISTEMA, SEM_MODELO] }, /passa do regimeMaximo/);
  });

  it('grava é false ou declara se recusa é resultado', () => {
    for (const grava of [true, {}, { recusaEResultado: 'sim' }, null, undefined]) {
      reprova({ grava }, /grava não é false/);
    }
  });

  it('as funções do caminho existem — o piso inclusive', () => {
    for (const nome of ['montarPedido', 'interpretar', 'conferir', 'montarFrase', 'semModelo']) {
      reprova({ [nome]: undefined }, new RegExp(`${nome} não é função`));
    }
    reprova({ pedidoCurto: 'curto' }, /pedidoCurto não é função/);
  });
});
