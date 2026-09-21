/**
 * O hospedeiro do nome de rota, depois da porta (story 5.7).
 *
 * O que este arquivo mede é **o que só o hospedeiro pode errar**: o corpo que sai
 * para a `ia-narrar`, o que ele grava e o que ele deixa de gravar, e se a
 * preferência do dono é respeitada. O juízo (prompt, conferência, molde) tem
 * teste no núcleo, sobre dado real — repeti-lo aqui seria medir duas vezes a
 * mesma coisa e nenhuma vez o hospedeiro.
 *
 * O motor entra pelas deps, e o `motorPara` real é mockado: nada aqui abre rede.
 */
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

/** O banco falso: `places` (as âncoras) e o `update` de `activities`. */
const mockBanco: {
  places: Record<string, unknown>[];
  erroAoLerPlaces: Error | null;
  updates: { tabela: string; valores: Record<string, unknown>; filtros: Record<string, unknown> }[];
  erroAoGravar: Error | null;
} = { places: [], erroAoLerPlaces: null, updates: [], erroAoGravar: null };

jest.mock('../supabase', () => ({
  supabase: {
    from(tabela: string) {
      const filtros: Record<string, unknown> = {};
      let valores: Record<string, unknown> = {};
      let escrita = false;
      const alvo: Record<string, unknown> = {
        select: () => alvo,
        update: (v: Record<string, unknown>) => {
          escrita = true;
          valores = v;
          return alvo;
        },
        eq: (c: string, v: unknown) => {
          filtros[c] = v;
          if (escrita) mockBanco.updates[mockBanco.updates.length - 1] = { tabela, valores, filtros };
          return alvo;
        },
        order: async () => ({
          data: mockBanco.erroAoLerPlaces ? null : mockBanco.places,
          error: mockBanco.erroAoLerPlaces,
        }),
        // O `update(...).eq().eq()` é um thenable: quem o espera recebe o erro.
        then: (resolver: (r: unknown) => unknown) =>
          Promise.resolve({ error: mockBanco.erroAoGravar }).then(resolver),
      };
      if (tabela === 'activities') mockBanco.updates.push({ tabela, valores: {}, filtros: {} });
      return alvo;
    },
  },
}));

/**
 * O ponto de injeção carrega o módulo nativo e constrói o motor de nuvem na
 * carga; aqui ninguém fala com rede. O motor é configurável porque o bloco da
 * **fiação de produção** (no fim do arquivo) chama `nomearPedaladaSePreciso`
 * *sem* deps, e aí quem entrega o motor é este mock, não o teste.
 */
const mockMotores: { motor: unknown } = { motor: undefined };

jest.mock('../motores', () => ({
  motorPara: (id: string) => (id === 'nuvem:padrao' ? mockMotores.motor : undefined),
  catalogoDoRecurso: async () =>
    (jest.requireActual('../motores/catalogo') as { idsConhecidos: readonly string[] }).idsConhecidos,
}));

import {
  APARELHO_SISTEMA,
  CONCLUSAO,
  NUVEM_PADRAO,
  SEM_MODELO,
  criarMotorDeNuvem,
  type Activity,
  type CorpoDoPedido,
  type EventoDoAnel,
  type Motor,
  type MotorId,
  type RespostaDoTransporte,
} from '@vitale/shared';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { gravarPreferencia } from '../motores/preferencia';
import {
  limparCacheDeAncoras,
  nomearPedaladaSePreciso,
  precisaDeNome,
  type DepsDoNome,
} from '../../services/route-name';

/* ── o cenário ───────────────────────────────────────────────────────────── */

/** Uma pedalada de verdade: Pajottenland, saindo de casa. */
const PEDALADA: Activity = {
  id: 'act-1',
  userId: 'u1',
  activityId: 13,
  activityName: 'Cycling',
  startAt: '2026-08-15T08:00:00Z',
  endAt: '2026-08-15T11:00:00Z',
  durationS: 10_800,
  movingTimeS: 10_000,
  calories: 1800,
  distanceM: 75_000,
  elevationM: 600,
  hasRoute: true,
  cities: [
    { name: 'Sint-Martens-Lennik', country: 'Belgique', lat: 50.81, lng: 4.16 },
    { name: 'Strijtem', country: 'Belgique', lat: 50.84, lng: 4.11 },
    { name: 'Pamel', country: 'Belgique', lat: 50.85, lng: 4.13 },
  ],
} as Activity;

const PONTOS = [
  { lat: 50.8503, lng: 4.3517 },
  { lat: 50.85, lng: 4.13 },
];

const CASA = {
  id: 'p1', user_id: 'u1', kind: 'home', label: 'casa',
  lat: 50.8503, lng: 4.3517, radius_m: 400,
  active_from: '2020-01-01', active_to: null, derived: true,
};

const BOA = JSON.stringify({
  regiao: 'Pajottenland',
  artigo: 'le',
  justificativa: ['Sint-Martens-Lennik', 'Strijtem', 'Pamel'],
});

function corpoBom(texto: string, extra: Record<string, unknown> = {}): RespostaDoTransporte {
  return {
    status: 200,
    corpo: {
      texto, provedor: 'fake', modelo: 'fake-1',
      motivoDeParada: CONCLUSAO, tokens: { entrada: 120, saida: 40 }, ...extra,
    },
  };
}

/** O motor de nuvem de verdade sobre um transporte falso — o corpo fica visível. */
function nuvemFalsa(...roteiro: readonly RespostaDoTransporte[]) {
  const corpos: CorpoDoPedido[] = [];
  let i = 0;
  const motor = criarMotorDeNuvem(async (corpo) => {
    corpos.push(corpo);
    const r = roteiro[Math.min(i, roteiro.length - 1)];
    i += 1;
    return r;
  });
  return { motor, corpos };
}

interface Cenario {
  readonly deps: DepsDoNome;
  readonly corpos: readonly CorpoDoPedido[];
  readonly eventos: readonly EventoDoAnel[];
  readonly gravou: { id: string; nome: string | null; meta: Record<string, unknown> }[];
}

function cenario(
  roteiro: readonly RespostaDoTransporte[],
  preferencia: MotorId | null = null,
  motores: readonly MotorId[] = [NUVEM_PADRAO],
): Cenario {
  const { motor, corpos } = nuvemFalsa(...roteiro);
  const eventos: EventoDoAnel[] = [];
  const gravou: { id: string; nome: string | null; meta: Record<string, unknown> }[] = [];
  const porId: Partial<Record<MotorId, Motor>> = {};
  for (const id of motores) porId[id] = motor;
  return {
    corpos,
    eventos,
    gravou,
    deps: {
      motorPara: (id) => porId[id],
      registrar: (e) => {
        eventos.push(e);
      },
      agora: () => new Date('2026-09-21T12:00:00Z'),
      lerPreferencia: async () => preferencia,
      catalogo: async () => [SEM_MODELO, APARELHO_SISTEMA, NUVEM_PADRAO],
      salvar: async (id, nome, meta) => {
        gravou.push({ id, nome, meta: meta as Record<string, unknown> });
      },
    },
  };
}

beforeEach(() => {
  mockBanco.places = [CASA];
  mockBanco.erroAoLerPlaces = null;
  mockBanco.updates = [];
  mockBanco.erroAoGravar = null;
  limparCacheDeAncoras();
});

/* ── o gatilho ───────────────────────────────────────────────────────────── */

describe('o gatilho', () => {
  it('só pedalada com rota, sem nome e sem marca', () => {
    expect(precisaDeNome(PEDALADA)).toBe(true);
    expect(precisaDeNome({ ...PEDALADA, activityId: 37 } as Activity)).toBe(false);
    expect(precisaDeNome({ ...PEDALADA, routeName: 'Tour du Pajottenland' } as Activity)).toBe(false);
    expect(precisaDeNome({ ...PEDALADA, routeNameChecked: true } as Activity)).toBe(false);
    expect(precisaDeNome({ ...PEDALADA, hasRoute: false } as Activity)).toBe(false);
  });

  it('sem as pontas do traçado não sai chamada nenhuma', async () => {
    const c = cenario([corpoBom(BOA)]);
    expect(await nomearPedaladaSePreciso(PEDALADA, undefined, 'u1', c.deps)).toBeNull();
    expect(await nomearPedaladaSePreciso(PEDALADA, [], 'u1', c.deps)).toBeNull();
    expect(c.corpos).toHaveLength(0);
    expect(c.gravou).toHaveLength(0);
  });
});

/* ── o corpo ─────────────────────────────────────────────────────────────── */

describe('o corpo que chega à function', () => {
  it('é o par do prompt com json — e não nomeia motor, porque o padrão é o servidor', async () => {
    const c = cenario([corpoBom(BOA)]);
    await nomearPedaladaSePreciso(PEDALADA, PONTOS, 'u1', c.deps);

    expect(c.corpos).toHaveLength(1);
    const corpo = c.corpos[0];
    expect(Object.keys(corpo).sort()).toEqual(['esquema', 'json', 'sistema', 'usuario']);
    expect(corpo.json).toBe(true);
    expect(corpo.sistema).toMatch(/^Você nomeia percursos de bicicleta/);
    // A lista de cidades, na ordem, como o prompt de hoje a escreve.
    expect(corpo.usuario).toContain('1. Sint-Martens-Lennik');
    expect(corpo.usuario).toContain('3. Pamel');
    expect(corpo.usuario).toContain('Distância: 75,0 km. Subida: 600 m.');
  });
});

/* ── o que grava, e o que não grava ──────────────────────────────────────── */

describe('as permanentes gravam', () => {
  it('o nome sai, e a meta leva provedor, modelo e tokens', async () => {
    const c = cenario([corpoBom(BOA)]);
    const nome = await nomearPedaladaSePreciso(PEDALADA, PONTOS, 'u1', c.deps);

    expect(nome).toBe('Tour du Pajottenland');
    expect(c.gravou).toHaveLength(1);
    expect(c.gravou[0].id).toBe('act-1');
    expect(c.gravou[0].nome).toBe('Tour du Pajottenland');
    expect(c.gravou[0].meta).toMatchObject({
      forma: 'casa-b',
      regiao: 'Pajottenland',
      versaoPrompt: 2,
      provedor: 'fake',
      modelo: 'fake-1',
      tokens: { entrada: 120, saida: 40 },
      em: '2026-09-21T12:00:00.000Z',
    });
  });

  it('a resposta ilegível grava a recusa — é o que impede a pedalada de voltar todo dia', async () => {
    const c = cenario([corpoBom('não consigo nomear este percurso')]);
    expect(await nomearPedaladaSePreciso(PEDALADA, PONTOS, 'u1', c.deps)).toBeNull();
    expect(c.gravou).toHaveLength(1);
    expect(c.gravou[0].nome).toBeNull();
    expect(c.gravou[0].meta).toMatchObject({ recusa: 'ilegivel', provedor: 'fake' });
  });

  it('a conferência que reprova grava o que o modelo tentou', async () => {
    const c = cenario([corpoBom(JSON.stringify({ regiao: 'Toscana', justificativa: ['Siena'] }))]);
    expect(await nomearPedaladaSePreciso(PEDALADA, PONTOS, 'u1', c.deps)).toBeNull();
    expect(c.gravou[0].meta).toMatchObject({ recusa: 'reprovado', regiao: 'Toscana', provedor: 'fake' });
  });

  it('a rota degenerada grava sem gastar chamada', async () => {
    const c = cenario([corpoBom(BOA)]);
    const curta = { ...PEDALADA, distanceM: 900, cities: [PEDALADA.cities![0]] } as Activity;
    expect(await nomearPedaladaSePreciso(curta, PONTOS, 'u1', c.deps)).toBeNull();
    expect(c.corpos).toHaveLength(0);
    expect(c.gravou[0].meta).toMatchObject({ recusa: 'degenerada' });
  });
});

describe('as transitórias não gravam', () => {
  const casos: readonly (readonly [string, RespostaDoTransporte])[] = [
    ['rede caiu', { semRede: true, detalhe: 'Network request failed' }],
    ['prazo estourou', { status: 502, corpo: { classe: 'transitoria', detalhe: 'o prazo de 60 s estourou' } }],
    ['function fora', { status: 503, corpo: { classe: 'indisponivel' } }],
  ];

  for (const [nome, resposta] of casos) {
    it(`${nome}: nada gravado, e a pedalada volta ao gatilho`, async () => {
      const c = cenario([resposta]);
      expect(await nomearPedaladaSePreciso(PEDALADA, PONTOS, 'u1', c.deps)).toBeNull();
      expect(c.gravou).toHaveLength(0);
    });
  }

  it('a gravação que falha não derruba a tela — devolve null', async () => {
    const c = cenario([corpoBom(BOA)]);
    const deps: DepsDoNome = {
      ...c.deps,
      salvar: async () => {
        throw new Error('PostgREST 500');
      },
    };
    expect(await nomearPedaladaSePreciso(PEDALADA, PONTOS, 'u1', deps)).toBeNull();
  });

  it('a consulta das âncoras que falha não derruba a tela, e não chama motor nenhum', async () => {
    const c = cenario([corpoBom(BOA)]);
    mockBanco.erroAoLerPlaces = new Error('PostgREST 500');
    expect(await nomearPedaladaSePreciso(PEDALADA, PONTOS, 'u1', c.deps)).toBeNull();
    expect(c.corpos).toHaveLength(0);
    expect(c.gravou).toHaveLength(0);
  });
});

/* ── a preferência ───────────────────────────────────────────────────────── */

describe('a preferência do dono', () => {
  it('o aparelho escolhido num build sem a ponte NÃO recua para a nuvem', async () => {
    // A nuvem tem motor; o aparelho não. A exposição não sobe: a cadeia resolvida
    // para o aparelho vai só até ele, e o piso é a ausência.
    const c = cenario([corpoBom(BOA)], APARELHO_SISTEMA, [NUVEM_PADRAO]);
    expect(await nomearPedaladaSePreciso(PEDALADA, PONTOS, 'u1', c.deps)).toBeNull();
    expect(c.corpos).toHaveLength(0);
    expect(c.gravou).toHaveLength(0);
    expect(c.eventos[0].trilha.map((t) => [t.motor, t.desfecho])).toEqual([[APARELHO_SISTEMA, 'indisponivel']]);
  });

  it('sem-modelo escolhido não chama ninguém e não grava', async () => {
    const c = cenario([corpoBom(BOA)], SEM_MODELO);
    expect(await nomearPedaladaSePreciso(PEDALADA, PONTOS, 'u1', c.deps)).toBeNull();
    expect(c.corpos).toHaveLength(0);
    expect(c.gravou).toHaveLength(0);
  });

  it('a preferência ilegível não vira o padrão: ninguém é chamado', async () => {
    // Ilegível **não** é "use o padrão" (ADR 0048): um id que não se lê não tem
    // exposição a oferecer, e a cadeia fica só no piso. Cair no padrão aqui
    // mandaria dado para a nuvem por causa de um armazenamento corrompido.
    const c = cenario([corpoBom(BOA)], 'lixo' as MotorId);
    expect(await nomearPedaladaSePreciso(PEDALADA, PONTOS, 'u1', c.deps)).toBeNull();
    expect(c.corpos).toHaveLength(0);
    expect(c.gravou).toHaveLength(0);
  });

  it('a preferência que não se lê ABORTA a nomeação — não vira "sem preferência"', async () => {
    // Sem isto, um AsyncStorage fora faria a rota ir para a nuvem com
    // `sem-modelo` ou `aparelho:sistema` gravados — e o resultado ficaria
    // gravado, sem reprocessamento possível.
    const c = cenario([corpoBom(BOA)]);
    const deps: DepsDoNome = {
      ...c.deps,
      lerPreferencia: () => Promise.reject(new Error('AsyncStorage fora')),
    };
    expect(await nomearPedaladaSePreciso(PEDALADA, PONTOS, 'u1', deps)).toBeNull();
    expect(c.corpos).toHaveLength(0);
    expect(c.gravou).toHaveLength(0);
  });

  it('o catálogo que não se lê ABORTA a nomeação — a variante aprovada não some calada', async () => {
    const c = cenario([corpoBom(BOA)]);
    const deps: DepsDoNome = {
      ...c.deps,
      catalogo: () => Promise.reject(new Error('sem rede')),
    };
    expect(await nomearPedaladaSePreciso(PEDALADA, PONTOS, 'u1', deps)).toBeNull();
    expect(c.corpos).toHaveLength(0);
    expect(c.gravou).toHaveLength(0);
  });
});

/* ── o anel ──────────────────────────────────────────────────────────────── */

describe('o anel', () => {
  it('recebe um evento por execução, com o recurso do núcleo', async () => {
    const c = cenario([corpoBom(BOA)]);
    await nomearPedaladaSePreciso(PEDALADA, PONTOS, 'u1', c.deps);
    expect(c.eventos).toHaveLength(1);
    expect(c.eventos[0].recurso).toBe('nome-de-rota');
    expect(c.eventos[0].modo).toBe('produto');
  });
});

/* ── a fiação de produção ────────────────────────────────────────────────── */

/**
 * **As deps de verdade**, e não injetadas.
 *
 * Todos os blocos acima passam o quarto argumento, então `depsDoApp` nunca é
 * avaliado — e as linhas que dizem **qual recurso** é lido e **em que ordem** os
 * argumentos vão ao banco ficavam sem teste. As duas erram calado:
 *
 *  - trocar `lerPreferencia(RECURSO)` por `lerPreferencia('saude-do-sono')` lê a
 *    escolha do recurso errado, e nada reclama;
 *  - trocar `saveRouteName(supabase, userId, id, …)` por `(supabase, id, userId, …)`
 *    faz o `update` casar **zero linhas**. O PostgREST devolve 204 sem erro, nada
 *    é gravado nunca, e o gatilho redispara a cada abertura — `tsc` limpo e a
 *    suíte inteira verde.
 *
 * Aqui só o transporte da nuvem e o banco são falsos. A preferência sai do
 * armazenamento (o mock do AsyncStorage do `jest.setup.js`), com os dois recursos
 * gravados em sentidos opostos — o molde de `edicao-ia.test.ts`.
 */
describe('a fiação de produção — sem deps injetadas', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    mockMotores.motor = undefined;
  });

  it('a preferência lida é a do nome de rota, e o update chega com as colunas e os filtros certos', async () => {
    // Nome de rota na nuvem, Saúde do sono em sem-modelo: ler o recurso errado
    // deixaria a cadeia só no piso, e nada seria gravado.
    await gravarPreferencia('nome-de-rota', NUVEM_PADRAO);
    await gravarPreferencia('saude-do-sono', SEM_MODELO);
    const { motor, corpos } = nuvemFalsa(corpoBom(BOA));
    mockMotores.motor = motor;

    const nome = await nomearPedaladaSePreciso(PEDALADA, PONTOS, 'u1');

    expect(nome).toBe('Tour du Pajottenland');
    expect(corpos).toHaveLength(1);
    // O `update` de verdade, pelo `saveRouteName` do núcleo.
    const update = mockBanco.updates.find((u) => u.tabela === 'activities');
    expect(update).toBeDefined();
    expect(Object.keys(update!.valores).sort()).toEqual(['route_name', 'route_name_meta']);
    expect(update!.valores.route_name).toBe('Tour du Pajottenland');
    expect(update!.valores.route_name_meta).toMatchObject({ regiao: 'Pajottenland', versaoPrompt: 2 });
    // A ordem dos argumentos: `id` é da pedalada, `user_id` é do dono. Trocados,
    // o update casaria zero linhas e ninguém reclamaria.
    expect(update!.filtros).toEqual({ id: 'act-1', user_id: 'u1' });
  });

  it('o espelho: nome de rota em sem-modelo e Saúde do sono na nuvem — ninguém é chamado, nada gravado', async () => {
    await gravarPreferencia('nome-de-rota', SEM_MODELO);
    await gravarPreferencia('saude-do-sono', NUVEM_PADRAO);
    const { motor, corpos } = nuvemFalsa(corpoBom(BOA));
    mockMotores.motor = motor;

    expect(await nomearPedaladaSePreciso(PEDALADA, PONTOS, 'u1')).toBeNull();
    expect(corpos).toHaveLength(0);
    expect(mockBanco.updates.filter((u) => u.tabela === 'activities' && u.valores.route_name !== undefined)).toEqual([]);
  });

  it('o erro do banco na gravação não derruba a tela', async () => {
    await gravarPreferencia('nome-de-rota', NUVEM_PADRAO);
    const { motor } = nuvemFalsa(corpoBom(BOA));
    mockMotores.motor = motor;
    mockBanco.erroAoGravar = new Error('PostgREST 500');
    expect(await nomearPedaladaSePreciso(PEDALADA, PONTOS, 'u1')).toBeNull();
  });
});
