import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { casoDaSaude } from '../sleep/caso';
import { descritorDaSaudeDoSono, type EntradaDaSaude } from '../sleep/leitura';
import type { SonoRange } from '../sleep/ranges';
import { SCORE_COVERAGE_FLOOR, type SleepCoverage, type SleepDimensionKey, type SleepScore } from '../sleep/score';
import { APARELHO_SISTEMA, NUVEM_PADRAO, SEM_MODELO } from './fio';
import { hashDoPedido } from './motor';
import { ELOS_DE_PADRAO, type Descritor } from './orquestrar';
import { BASE_ROTULO, type PacoteDeFatos } from './pacote';
import { CATALOGO_DE_RECURSOS, RECURSOS, validarDescritor, type RecursoId } from './recursos';
import { descritorDaRetrospectiva } from './retrospectiva';
import { sha256Hex } from './sha256';

/**
 * `validarDescritor` se prova com descritores falsos, que exercitam cada
 * problema; e o teste que percorre o catálogo morde desde a 5.2, quando a
 * retrospectiva entrou nele. A Saúde do sono entrou na 5.3.
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
  it('não é vácuo: a retrospectiva está nele desde a 5.2, e a Saúde do sono desde a 5.3', () => {
    assert.ok(CATALOGO_DE_RECURSOS.length > 0, 'o catálogo está vazio — o teste abaixo percorreria nada');
    assert.ok(CATALOGO_DE_RECURSOS.includes(descritorDaRetrospectiva as Qualquer));
    assert.ok(CATALOGO_DE_RECURSOS.includes(descritorDaSaudeDoSono as Qualquer));
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
      amostra: null, comparavel: true,
      bases: [
        { id: 'B1', rotulo: BASE_ROTULO.B1, existe: true, valor: 17, delta: 4, deltaPct: 23.5 },
        { id: 'B2', rotulo: BASE_ROTULO.B2, existe: false, valor: null, delta: null, deltaPct: null, motivo: 'sem ano anterior' },
        { id: 'B3', rotulo: BASE_ROTULO.B3, existe: true, valor: null, delta: null, deltaPct: null },
      ],
    },
    {
      chave: 'ciclismo.distancia', rotulo: 'Distância', grupo: 'Ciclismo', atual: 333, unidade: 'km', casas: 0,
      amostra: null, comparavel: true,
      bases: [
        { id: 'B1', rotulo: BASE_ROTULO.B1, existe: true, valor: 820, delta: -487, deltaPct: -59.4 },
        { id: 'B2', rotulo: BASE_ROTULO.B2, existe: false, valor: null, delta: null, deltaPct: null, motivo: 'sem ano anterior' },
        { id: 'B3', rotulo: BASE_ROTULO.B3, existe: true, valor: null, delta: null, deltaPct: null },
      ],
    },
  ],
  tendencias: [{ chave: 'atividades', rotulo: 'Atividades', direcao: 'sobe', periodos: 3, desde: 'junho' }],
  textos: [{ chave: 'piso', rotulo: 'Piso', valor: 'a maior parte do percurso era pavimentada' }],
  lapides: [],
  cobertura: { diasComDado: 27, diasNoPeriodo: 31, diasComDadoAnterior: 14, diasNoPeriodoAnterior: 31, comparavel: false },
  correlacoes: [],
  eventos: [{ dia: '2026-08-30', tipo: 'marco', rotulo: 'Meia maratona' }],
  lacunas: [],
  semDado: false,
};

/* ── as entradas fixas da Saúde do sono ── */

const DA_NOITE: readonly SleepDimensionKey[] = ['duracao', 'continuidade', 'horario', 'percepcao'];
const DO_PERIODO: readonly SleepDimensionKey[] = ['duracao', 'continuidade', 'horario', 'regularidade', 'percepcao'];
const ROTULO: Readonly<Record<SleepDimensionKey, string>> = {
  duracao: 'Duração', continuidade: 'Continuidade', horario: 'Horário', regularidade: 'Regularidade', percepcao: 'Percepção',
};
const FATO: Readonly<Record<SleepDimensionKey, string>> = {
  duracao: '7h20 · 86% ≥ 7h', continuidade: '14 min', horario: '± 22 min', regularidade: 'SRI 50 · 7 seguidas',
  percepcao: '3,3/5 · 4 notas',
};

/**
 * Uma entrada montada à mão, sem noite nem relógio: os pontos, a cobertura e a
 * janela dados, e a soma e o `scored` como `tally` os faria — com o piso de
 * `score.ts`, nunca um literal. O caso não vem junto — o descritor o tira do
 * `score`.
 */
/** O começo da janela corrente de cada alcance, com `hoje` em 10/09/2026 — a janela combina com o range. */
const DESDE: Readonly<Record<SonoRange, string | null>> = {
  ultima: '2026-09-10', '7d': '2026-09-04', '4s': '2026-08-14', '12m': '2025-09-11', ano: '2026-01-01',
};

function fixa(
  range: SonoRange,
  pontos: readonly (number | null)[],
  coverage: SleepCoverage | null = range === 'ultima' ? null : { nights: 7, expected: 7, ratio: 1 },
  janela: EntradaDaSaude['janela'] = range === 'ultima'
    ? { since: DESDE.ultima, until: DESDE.ultima }
    : { since: DESDE[range], until: null },
): EntradaDaSaude {
  const chaves = range === 'ultima' ? DA_NOITE : DO_PERIODO;
  // Lista curta dava `points: undefined`, que conta como medida: o golden mediria outra coisa.
  if (pontos.length !== chaves.length) {
    throw new RangeError(`${range} tem ${chaves.length} dimensões, e vieram ${pontos.length} pontos`);
  }
  const dimensions = chaves.map((key, i) => ({
    key, label: ROTULO[key], points: pontos[i], fact: pontos[i] === null ? '—' : FATO[key],
  }));
  const medidas = dimensions.filter((d) => d.points !== null);
  const score: SleepScore = {
    dimensions,
    points: medidas.reduce((s, d) => s + (d.points ?? 0), 0),
    max: medidas.length * 2,
    coverage,
    scored: medidas.length > 0 && (coverage === null || coverage.ratio >= SCORE_COVERAGE_FLOOR),
  };
  return { alcance: range === 'ultima' ? 'noite' : 'periodo', range, hoje: '2026-09-10', janela, score };
}

/**
 * As variantes da Saúde do sono: os sete casos, noite e período, os três
 * motivos de `sem-contagem` (a noite tem dois: sem noite e sem medida) — e os
 * cinco alcances do seletor, porque o pedido diz o gênero e o número do nome da
 * janela. Um golden de uma variante só era cego nos outros seis casos.
 */
const VARIANTES_DA_SAUDE: Readonly<Record<string, EntradaDaSaude>> = {
  'uma, período': fixa('7d', [2, 1, 2, 0, 1]),
  'uma, noite': fixa('ultima', [2, 1, 2, 0]),
  'duas, período': fixa('4s', [0, 1, 2, 0, 1], { nights: 26, expected: 28, ratio: 26 / 28 }),
  'duas, noite': fixa('ultima', [1, 2, 1, 2]),
  'fora-do-empate no máximo, período': fixa('12m', [1, 1, 2, 1, 1], { nights: 300, expected: 365, ratio: 300 / 365 }),
  'fora-do-empate acima, período': fixa('7d', [0, 0, 1, 0, 2]),
  'fora-do-empate, noite': fixa('ultima', [0, 0, 0, 2]),
  'todas-iguais, período': fixa('ano', [1, 1, 1, null, 1], { nights: 200, expected: 253, ratio: 200 / 253 }),
  'todas-iguais, noite': fixa('ultima', [0, null, 0, null]),
  'tudo-no-maximo, período': fixa('7d', [2, 2, 2, 2, 2]),
  'tudo-no-maximo, noite': fixa('ultima', [2, 2, 2, 2]),
  'medidas-insuficientes, período': fixa('7d', [1, null, null, null, null]),
  'medidas-insuficientes, noite': fixa('ultima', [2, null, null, null]),
  'sem-contagem por cobertura, período': fixa('12m', [2, 1, 2, null, 1], { nights: 190, expected: 365, ratio: 190 / 365 }),
  'sem-contagem sem noite, período': fixa('7d', [null, null, null, null, null], { nights: 0, expected: 7, ratio: 0 }),
  'sem-contagem sem noite, noite': fixa('ultima', [null, null, null, null], { nights: 0, expected: 1, ratio: 0 }, { since: null, until: null }),
  'sem-contagem sem medida, noite': fixa('ultima', [null, null, null, null]),
  'sem-contagem sem medida, período': fixa('4s', [null, null, null, null, null], { nights: 28, expected: 28, ratio: 1 }),
};

/**
 * Por recurso: as entradas fixas, a versão do descritor em que o golden foi
 * tirado e o hash de então — do pedido, com uma entrada; do conjunto dos pedidos,
 * com várias. Pedido idêntico é mesmo hash (AD-11) — e é por ele que a
 * assinatura, o anel e a bancada dizem "o mesmo pedido".
 */
type Golden =
  | { readonly fatos: unknown; readonly versao: number; readonly hash: string }
  | {
      readonly variantes: Readonly<Record<string, unknown>>;
      /** Quantas variantes o golden mediu — é o que separa "o pedido mudou" de "o conjunto mudou". */
      readonly quantas: number;
      readonly versao: number;
      readonly hash: string;
    };

const GOLDENS: Readonly<Partial<Record<RecursoId, Golden>>> = {
  retrospectiva: {
    fatos: CADERNO_FIXO,
    versao: 5003,
    hash: 'ea7d1812ac5a16da508e99c232cf7744ea73226ed1b26db51a46a872f4c31534',
  },
  'saude-do-sono': {
    variantes: VARIANTES_DA_SAUDE,
    quantas: 18,
    versao: 1,
    hash: '383022d18e14861afe1439bc93257108b0d8907c75bd6d8b209dd784fe921986',
  },
};

/**
 * O hash de um golden: o do pedido, ou o dos pedidos das variantes, na ordem
 * declarada. **Sem os nomes do fixture:** renomear uma variante não é mudar
 * pedido, e mandava subir a versão do descritor por nada. Quem conta as variantes
 * é `quantas`, para o conjunto que muda ter mensagem própria.
 */
function hashDoGolden(d: Descritor<unknown, unknown>, g: Golden): { hash: string; porVariante: string[]; quantas: number } {
  const pedidoDe = (fatos: unknown, nome: string) => {
    const pedido = d.montarPedido(fatos);
    assert.ok(pedido, `a entrada fixa ${nome} de ${d.recurso} não produz pedido — o golden tem de medir um pedido de verdade.`);
    return hashDoPedido(pedido, d.versao);
  };
  if ('fatos' in g) return { hash: pedidoDe(g.fatos, 'única'), porVariante: [], quantas: 1 };
  const entradas = Object.entries(g.variantes);
  const hashes = entradas.map(([nome, fatos]) => pedidoDe(fatos, nome));
  return {
    hash: sha256Hex(hashes.join('\n')),
    porVariante: entradas.map(([nome], i) => `${nome}: ${hashes[i]}`),
    quantas: hashes.length,
  };
}

describe('as entradas fixas', () => {
  it('as da Saúde do sono cobrem os sete casos, a noite e o período, os três motivos e os cinco alcances', () => {
    const casos = Object.values(VARIANTES_DA_SAUDE).map((e) => ({ e, c: casoDaSaude(e.score) }));
    assert.deepEqual(
      [...new Set(casos.map(({ c }) => c.caso))].sort(),
      ['duas', 'fora-do-empate', 'medidas-insuficientes', 'sem-contagem', 'todas-iguais', 'tudo-no-maximo', 'uma'],
    );
    assert.deepEqual(
      [...new Set(casos.flatMap(({ c }) => (c.caso === 'sem-contagem' ? [c.motivo] : [])))].sort(),
      ['cobertura', 'sem-medida', 'sem-noite'],
    );
    for (const alcance of ['noite', 'periodo'] as const) {
      assert.equal(new Set(casos.filter(({ e }) => e.alcance === alcance).map(({ c }) => c.caso)).size, 7, alcance);
    }
    assert.deepEqual(
      [...new Set(casos.map(({ e }) => e.range))].sort(), ['12m', '4s', '7d', 'ano', 'ultima'],
    );
  });

  it('o ajudante lança quando faltam pontos — senão a variante mede uma dimensão que não existe', () => {
    assert.throws(() => fixa('7d', [2, 1, 2]), RangeError);
    assert.throws(() => fixa('ultima', [2, 1, 2, 0, 1]), RangeError);
  });

  it('a janela de cada variante combina com o alcance dela', () => {
    for (const [nome, e] of Object.entries(VARIANTES_DA_SAUDE)) {
      if (e.janela.since === null) continue;
      assert.equal(e.janela.since, DESDE[e.range], nome);
    }
  });

  it('cada variante tem um pedido próprio — nenhuma é redundante no golden', () => {
    const d = descritorDaSaudeDoSono as Descritor<unknown, unknown>;
    const hashes = Object.values(VARIANTES_DA_SAUDE).map((e) => hashDoPedido(d.montarPedido(e)!, d.versao));
    assert.equal(new Set(hashes).size, hashes.length);
  });
});

describe('o golden do pedido', () => {
  it('todo descritor do catálogo tem golden, e o pedido de hoje é o do golden', () => {
    for (const d of CATALOGO_DE_RECURSOS) {
      const g = GOLDENS[d.recurso];
      assert.ok(g, `sem golden para ${d.recurso} — acrescente em GOLDENS a entrada fixa dele e o hash de hoje.`);
      const { hash, porVariante, quantas } = hashDoGolden(d, g);
      if (hash !== g.hash && porVariante.length > 0) console.log(`     · pedidos de ${d.recurso}:\n       ${porVariante.join('\n       ')}`);
      assert.equal(
        d.versao, g.versao,
        `a versão de ${d.recurso} foi de ${g.versao} para ${d.versao}: confira que o pedido novo é o pretendido ` +
          `e atualize o golden — versão ${d.versao}, hash ${hash}.`,
      );
      if ('quantas' in g) {
        assert.equal(
          quantas, g.quantas,
          `o conjunto de variantes de ${d.recurso} mudou: ${g.quantas} → ${quantas}. Isto **não** é mudança de ` +
            `pedido — não suba a versão do descritor; confira que a variante nova (ou a que saiu) é o pretendido ` +
            `e atualize quantas e hash (hash de hoje: ${hash}).`,
        );
      }
      assert.equal(
        hash, g.hash,
        `o pedido de ${d.recurso} mudou (hash ${hash}) — suba a versão do descritor (na revista, PROMPT_VERSAO ` +
          `ou PACOTE_VERSAO; na Saúde do sono, VERSAO em sleep/leitura.ts) ` +
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
