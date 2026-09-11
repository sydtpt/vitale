import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { APARELHO_SISTEMA, NUVEM_PADRAO, SEM_MODELO } from './fio';
import { hashDoPedido } from './motor';
import { ELOS_DE_PADRAO, type Descritor } from './orquestrar';
import { BASE_ROTULO, type PacoteDeFatos } from './pacote';
import { CATALOGO_DE_RECURSOS, RECURSOS, validarDescritor, type RecursoId } from './recursos';
import { descritorDaRetrospectiva } from './retrospectiva';

/**
 * `validarDescritor` se prova com descritores falsos, que exercitam cada
 * problema; e o teste que percorre o catálogo morde desde a 5.2, quando a
 * retrospectiva entrou nele.
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
  it('não é vácuo: a retrospectiva está nele desde a 5.2', () => {
    assert.ok(CATALOGO_DE_RECURSOS.length > 0, 'o catálogo está vazio — o teste abaixo percorreria nada');
    assert.ok(CATALOGO_DE_RECURSOS.includes(descritorDaRetrospectiva as Qualquer));
  });

  it('todo descritor registrado é válido, e cada recurso aparece uma vez', () => {
    for (const d of CATALOGO_DE_RECURSOS) assert.deepEqual(validarDescritor(d), [], d.recurso);
    const ids = CATALOGO_DE_RECURSOS.map((d) => d.recurso);
    assert.equal(new Set(ids).size, ids.length, `recurso registrado duas vezes: ${ids.join(', ')}`);
  });
});

/* ── o golden do pedido ── */

/**
 * O caderno fixo da retrospectiva: montado à mão, sem relógio, com fato e período
 * fechado — e com as seções que o prompt sabe escrever (grupo, trajetória, fato
 * sem número, cobertura desigual, comparação sem número, evento, luz), para o
 * golden morder em qualquer uma delas.
 */
const CADERNO_FIXO: PacoteDeFatos = {
  versao: 2, caderno: 'movimento', rotulo: 'Movimento',
  periodo: {
    tipo: 'month', rotulo: 'Agosto 2026', rotuloAnterior: 'Julho 2026',
    inicioISO: '2026-08-01', fimISO: '2026-08-31', fechado: true, diasNoPeriodo: 31, luz: 'dias longos',
  },
  metricas: [
    {
      chave: 'atividades', rotulo: 'Atividades', atual: 21, unidade: '', casas: 0,
      bases: [
        { id: 'B1', rotulo: BASE_ROTULO.B1, existe: true, valor: 17, delta: 4, deltaPct: 23.5 },
        { id: 'B2', rotulo: BASE_ROTULO.B2, existe: false, valor: null, delta: null, deltaPct: null, motivo: 'sem ano anterior' },
        { id: 'B3', rotulo: BASE_ROTULO.B3, existe: true, valor: null, delta: null, deltaPct: null },
      ],
    },
    {
      chave: 'ciclismo.distancia', rotulo: 'Distância', grupo: 'Ciclismo', atual: 333, unidade: 'km', casas: 0,
      bases: [
        { id: 'B1', rotulo: BASE_ROTULO.B1, existe: true, valor: 820, delta: -487, deltaPct: -59.4 },
        { id: 'B2', rotulo: BASE_ROTULO.B2, existe: false, valor: null, delta: null, deltaPct: null, motivo: 'sem ano anterior' },
        { id: 'B3', rotulo: BASE_ROTULO.B3, existe: true, valor: null, delta: null, deltaPct: null },
      ],
    },
  ],
  tendencias: [{ chave: 'atividades', rotulo: 'Atividades', direcao: 'sobe', periodos: 3, desde: 'junho' }],
  textos: [{ chave: 'piso', rotulo: 'Piso', valor: 'a maior parte do percurso era pavimentada' }],
  cobertura: { diasComDado: 27, diasNoPeriodo: 31, diasComDadoAnterior: 14, diasNoPeriodoAnterior: 31, comparavel: false },
  correlacoes: [],
  eventos: [{ dia: '2026-08-30', tipo: 'marco', rotulo: 'Meia maratona' }],
  lacunas: [],
  semDado: false,
};

/**
 * Por recurso: a entrada fixa, a versão do descritor em que o golden foi tirado
 * e o hash do pedido de então. Pedido idêntico é mesmo hash (AD-11) — e é por
 * ele que a assinatura, o anel e a bancada dizem "o mesmo pedido".
 */
const GOLDENS: Readonly<Partial<Record<RecursoId, { fatos: unknown; versao: number; hash: string }>>> = {
  retrospectiva: {
    fatos: CADERNO_FIXO,
    versao: 4002,
    hash: '805456ebf9eb8d6acea511fd2801fec4ea8bdde8d24b5a4d372edde6e7271be4',
  },
};

describe('o golden do pedido', () => {
  it('todo descritor do catálogo tem golden, e o pedido de hoje é o do golden', () => {
    for (const d of CATALOGO_DE_RECURSOS) {
      const g = GOLDENS[d.recurso];
      assert.ok(g, `sem golden para ${d.recurso} — acrescente em GOLDENS a entrada fixa dele e o hash de hoje.`);
      const pedido = d.montarPedido(g.fatos);
      assert.ok(pedido, `a entrada fixa de ${d.recurso} não produz pedido — o golden tem de medir um pedido de verdade.`);
      const hash = hashDoPedido(pedido, d.versao);
      assert.equal(
        d.versao, g.versao,
        `a versão de ${d.recurso} foi de ${g.versao} para ${d.versao}: confira que o pedido novo é o pretendido ` +
          `e atualize o golden — versão ${d.versao}, hash ${hash}.`,
      );
      assert.equal(
        hash, g.hash,
        `o pedido de ${d.recurso} mudou — suba a versão do descritor (na revista, PROMPT_VERSAO ou PACOTE_VERSAO) ` +
          `e só então atualize o golden; sem isso, hash, assinatura e bancada comparam pedidos diferentes ` +
          `como se fossem o mesmo.`,
      );
    }
  });
});

describe('validarDescritor', () => {
  it('aceita um descritor bem formado, com ou sem gravação e pedido curto', () => {
    assert.deepEqual(validarDescritor(valido()), []);
    assert.deepEqual(validarDescritor(valido({
      grava: { admite: ['aparelho'], recusaEResultado: true }, pedidoCurto: () => null,
    })), []);
    assert.deepEqual(validarDescritor(valido({
      recurso: 'retrospectiva', regimeDeNumeros: 'copiado-e-conferido', regimeMaximo: 'nuvem',
      cadeiaPadrao: [NUVEM_PADRAO, APARELHO_SISTEMA, SEM_MODELO], grava: { admite: ['nuvem', 'aparelho'], recusaEResultado: false },
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
    for (const grava of [true, {}, { admite: ['aparelho'], recusaEResultado: 'sim' }, null, undefined]) {
      reprova({ grava }, /grava não é false/);
    }
  });

  describe('o admite de quem grava (AD-12)', () => {
    const grava = (admite: unknown) => ({ grava: { admite, recusaEResultado: false } });

    it('é lista não vazia', () => {
      for (const admite of [undefined, null, [], 'aparelho', {}]) {
        reprova(grava(admite), /grava\.admite não é lista não vazia/);
      }
      reprova({ grava: { recusaEResultado: false } }, /grava\.admite não é lista não vazia/);
    });

    it('sem repetição', () => {
      reprova(grava(['aparelho', 'aparelho']), /grava\.admite repete/);
    });

    it('só aparelho e nuvem gravam — sem-modelo é o piso', () => {
      for (const tipo of ['sem-modelo', 'servidor', APARELHO_SISTEMA, 1]) {
        reprova(grava(['aparelho', tipo]), /só aparelho e nuvem gravam/);
      }
    });

    it('nenhum tipo acima do regimeMaximo', () => {
      // `valido()` tem regimeMaximo aparelho.
      reprova(grava(['aparelho', 'nuvem']), /grava\.admite passa do regimeMaximo em nuvem/);
      assert.deepEqual(validarDescritor(valido({
        regimeMaximo: 'nuvem', cadeiaPadrao: [APARELHO_SISTEMA, SEM_MODELO], ...grava(['aparelho', 'nuvem']),
      })), []);
    });

    it('todo elo do padrão, fora sem-modelo, é admitido', () => {
      reprova({
        regimeMaximo: 'nuvem', cadeiaPadrao: [NUVEM_PADRAO, APARELHO_SISTEMA, SEM_MODELO], ...grava(['nuvem']),
      }, /cadeiaPadrao tem aparelho:sistema, de tipo que grava\.admite não admite/);
      reprova({
        regimeMaximo: 'nuvem', cadeiaPadrao: [NUVEM_PADRAO, SEM_MODELO], ...grava(['aparelho']),
      }, /cadeiaPadrao tem nuvem:padrao/);
      // Só sem-modelo no padrão: nada a admitir, e o admite ainda precisa ser válido.
      assert.deepEqual(validarDescritor(valido({ cadeiaPadrao: [SEM_MODELO], ...grava(['aparelho']) })), []);
    });

    it('quem não grava não declara admite', () => {
      assert.deepEqual(validarDescritor(valido({ grava: false })), []);
    });
  });

  it('as funções do caminho existem — o piso inclusive', () => {
    for (const nome of ['montarPedido', 'interpretar', 'conferir', 'montarFrase', 'semModelo']) {
      reprova({ [nome]: undefined }, new RegExp(`${nome} não é função`));
    }
    reprova({ pedidoCurto: 'curto' }, /pedidoCurto não é função/);
  });
});
