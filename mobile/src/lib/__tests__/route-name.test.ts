/**
 * O hospedeiro do nome de rota, depois da porta (story 5.7; as duas frentes e todo
 * GPS desde 23/09).
 *
 * O que este arquivo mede é **o que só o hospedeiro pode errar**: o corpo que sai
 * para a `ia-narrar`, o que ele grava e o que ele deixa de gravar, e se a
 * preferência do dono é respeitada. O juízo (prompt, conferência, molde) tem
 * teste no núcleo, sobre dado real — repeti-lo aqui seria medir duas vezes a
 * mesma coisa e nenhuma vez o hospedeiro.
 *
 * Desde 23/09 há duas coisas a mais que só o hospedeiro pode errar, e as duas têm
 * bloco próprio no fim:
 *
 *  - **o gatilho por língua**: quem já tem o nome local e não tem o português paga
 *    só a segunda chamada. Uma marca só faria as 135 pedaladas já nomeadas nunca
 *    ganharem legenda, e o sintoma seria "o português não aparece nas antigas";
 *  - **a queda do crivo de bicicleta**: caminhada e corrida com rota passam a
 *    precisar de nome. São 138 atividades que hoje se chamam "Walking" e "Running".
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
 * **fiação de produção** (no fim do arquivo) chama `nomearRotaSePreciso`
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
  frentesQueFaltam,
  limparCacheDeAncoras,
  nomearRotaSePreciso,
  precisaDeAlgumNome,
  precisaDeNome,
  type DepsDoNome,
  type FrenteDoNome,
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

/**
 * A mesma pedalada com a frente do **português já visitada**.
 *
 * É ela que os blocos abaixo usam quando o que está sob teste é **uma** frente: com
 * as duas faltando, cada caso mediria duas chamadas e duas gravações, e as
 * asserções sobre "o corpo que sai" passariam a contar corpos em vez de olhar o
 * primeiro. As duas frentes juntas têm bloco próprio no fim.
 *
 * E o cenário é real: são as 135 pedaladas com nome francês no acervo, pelo avesso.
 */
const SO_O_LOCAL = { ...PEDALADA, routeNamePtChecked: true } as Activity;

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

interface Gravacao {
  frente: FrenteDoNome;
  id: string;
  nome: string | null;
  meta: Record<string, unknown>;
}

interface Cenario {
  readonly deps: DepsDoNome;
  readonly corpos: readonly CorpoDoPedido[];
  readonly eventos: readonly EventoDoAnel[];
  readonly gravou: Gravacao[];
  /** Quais frentes pediram a preferência, na ordem — o que prova a leitura por recurso. */
  readonly preferenciasLidas: FrenteDoNome[];
}

/**
 * `preferencia` aceita **um mapa por frente** além de um id só: é assim que o caso
 * central da decisão do dono — dois motores diferentes para as duas línguas — se
 * escreve sem um segundo montador de cenário.
 */
function cenario(
  roteiro: readonly RespostaDoTransporte[],
  preferencia: MotorId | null | Partial<Record<FrenteDoNome, MotorId | null>> = null,
  motores: readonly MotorId[] = [NUVEM_PADRAO],
): Cenario {
  const { motor, corpos } = nuvemFalsa(...roteiro);
  const eventos: EventoDoAnel[] = [];
  const gravou: Gravacao[] = [];
  const preferenciasLidas: FrenteDoNome[] = [];
  const porId: Partial<Record<MotorId, Motor>> = {};
  for (const id of motores) porId[id] = motor;
  const escolha = (frente: FrenteDoNome): MotorId | null =>
    typeof preferencia === 'string' || preferencia === null ? preferencia : preferencia[frente] ?? null;
  return {
    corpos,
    eventos,
    gravou,
    preferenciasLidas,
    deps: {
      motorPara: (id) => porId[id],
      registrar: (e) => {
        eventos.push(e);
      },
      agora: () => new Date('2026-09-21T12:00:00Z'),
      lerPreferencia: async (frente) => {
        preferenciasLidas.push(frente);
        return escolha(frente);
      },
      catalogo: async () => [SEM_MODELO, APARELHO_SISTEMA, NUVEM_PADRAO],
      salvar: async (frente, id, nome, meta) => {
        gravou.push({ frente, id, nome, meta: meta as Record<string, unknown> });
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
  it('atividade com rota, sem nome e sem marca — em cada frente a SUA coluna', () => {
    expect(precisaDeNome(PEDALADA, 'nome-de-rota')).toBe(true);
    expect(precisaDeNome(PEDALADA, 'nome-de-rota-pt')).toBe(true);
    expect(precisaDeNome({ ...PEDALADA, routeName: 'Tour du Pajottenland' } as Activity, 'nome-de-rota')).toBe(false);
    expect(precisaDeNome({ ...PEDALADA, routeNameChecked: true } as Activity, 'nome-de-rota')).toBe(false);
    expect(precisaDeNome({ ...PEDALADA, routeNamePt: 'Tour do Pajottenland' } as Activity, 'nome-de-rota-pt')).toBe(false);
    expect(precisaDeNome({ ...PEDALADA, routeNamePtChecked: true } as Activity, 'nome-de-rota-pt')).toBe(false);
    // Sem rota não há forma a derivar: nenhuma frente entra.
    expect(precisaDeAlgumNome({ ...PEDALADA, hasRoute: false } as Activity)).toBe(false);
  });

  /**
   * **Sem cidade, ninguém é julgado** — e isto é regressão de dado, não hipótese.
   *
   * A forma sai das cidades. Uma atividade cujo enriquecimento geográfico ainda não
   * passou tem `cities` vazio, cai em `degenerada` e grava recusa **permanente**:
   * o enriquecimento roda depois, as cidades chegam, e o nome nunca vem porque a
   * marca já está lá.
   *
   * Em produção, 23/09, uma atividade com `recusa: 'degenerada'` gravada tem **16
   * cidades hoje**. O acidente já cobrou uma vez, com o gatilho valendo só para
   * bicicleta; agora ele valeria para 279 atividades e em duas frentes cada.
   */
  it('sem cidade gravada, nenhuma frente entra — esperar é de graça, recusar é para sempre', () => {
    for (const cities of [undefined, []] as const) {
      const cru = { ...PEDALADA, cities } as Activity;
      expect(precisaDeNome(cru, 'nome-de-rota')).toBe(false);
      expect(precisaDeNome(cru, 'nome-de-rota-pt')).toBe(false);
      expect(frentesQueFaltam(cru)).toEqual([]);
      expect(precisaDeAlgumNome(cru)).toBe(false);
    }
    // E a mesma atividade, depois de o enriquecimento passar, volta ao gatilho.
    expect(precisaDeAlgumNome(PEDALADA)).toBe(true);
  });

  /**
   * **A marca é por língua**, e é a razão de haver duas colunas de meta.
   *
   * Com uma marca só, as 135 pedaladas que já têm nome francês ficariam fora do
   * gatilho do português para sempre — e o sintoma seria "a legenda só aparece nas
   * novas", que ninguém liga à marca.
   */
  it('quem tem o nome local e não tem o pt precisa SÓ do pt', () => {
    const local = { ...PEDALADA, routeName: 'Tour du Pajottenland', routeNameChecked: true } as Activity;
    expect(frentesQueFaltam(local)).toEqual(['nome-de-rota-pt']);
    expect(precisaDeAlgumNome(local)).toBe(true);
  });

  it('quem tem o pt e não tem o local precisa SÓ do local', () => {
    expect(frentesQueFaltam(SO_O_LOCAL)).toEqual(['nome-de-rota']);
  });

  it('quem tem as duas marcas não precisa de nada', () => {
    const pronta = { ...PEDALADA, routeNameChecked: true, routeNamePtChecked: true } as Activity;
    expect(frentesQueFaltam(pronta)).toEqual([]);
    expect(precisaDeAlgumNome(pronta)).toBe(false);
  });

  /**
   * **Caiu o crivo de bicicleta** (decisão 4 do plano, 23/09).
   *
   * O filtro de tipo era `activityId === 13`, e com ele as 80 caminhadas e as 58
   * corridas com GPS nunca ganhariam nome: elas se chamam literalmente "Walking" e
   * "Running". O que restou é `hasRoute` — e o portão da rota degenerada, que roda
   * dentro do descritor, antes de qualquer chamada.
   */
  it('uma caminhada com rota passa a precisar de nome, e uma corrida também', () => {
    for (const activityId of [52, 37]) {
      const aPe = { ...PEDALADA, activityId } as Activity;
      expect(frentesQueFaltam(aPe)).toEqual(['nome-de-rota', 'nome-de-rota-pt']);
    }
  });

  it('a caminhada chega ao modelo de verdade — o crivo não sobreviveu em outro lugar', async () => {
    const c = cenario([corpoBom(BOA)]);
    const caminhada = { ...SO_O_LOCAL, activityId: 52 } as Activity;
    const nomes = await nomearRotaSePreciso(caminhada, PONTOS, 'u1', c.deps);
    expect(nomes).toEqual({ 'nome-de-rota': 'Tour du Pajottenland' });
    expect(c.corpos).toHaveLength(1);
  });

  it('sem as pontas do traçado não sai chamada nenhuma', async () => {
    const c = cenario([corpoBom(BOA)]);
    expect(await nomearRotaSePreciso(PEDALADA, undefined, 'u1', c.deps)).toEqual({});
    expect(await nomearRotaSePreciso(PEDALADA, [], 'u1', c.deps)).toEqual({});
    expect(c.corpos).toHaveLength(0);
    expect(c.gravou).toHaveLength(0);
  });
});

/* ── o corpo ─────────────────────────────────────────────────────────────── */

describe('o corpo que chega à function', () => {
  it('é o par do prompt com json — e não nomeia motor, porque o padrão é o servidor', async () => {
    const c = cenario([corpoBom(BOA)]);
    await nomearRotaSePreciso(SO_O_LOCAL, PONTOS, 'u1', c.deps);

    expect(c.corpos).toHaveLength(1);
    const corpo = c.corpos[0];
    expect(Object.keys(corpo).sort()).toEqual(['esquema', 'json', 'sistema', 'usuario']);
    expect(corpo.json).toBe(true);
    expect(corpo.sistema).toMatch(/^Você nomeia percursos de bicicleta/);
    // A lista de cidades, na ordem, como o prompt de hoje a escreve.
    expect(corpo.usuario).toContain('1. Sint-Martens-Lennik');
    expect(corpo.usuario).toContain('3. Pamel');
    expect(corpo.usuario).toContain('Distância: 75,0 km. Subida: 600 m.');
    // A língua é a do país dominante (a Bélgica é francês, por decisão do dono).
    expect(corpo.usuario).toMatch(/^Língua do nome: francês\./);
  });
});

/* ── o que grava, e o que não grava ──────────────────────────────────────── */

describe('as permanentes gravam', () => {
  it('o nome sai, e a meta leva provedor, modelo e tokens', async () => {
    const c = cenario([corpoBom(BOA)]);
    const nomes = await nomearRotaSePreciso(SO_O_LOCAL, PONTOS, 'u1', c.deps);

    expect(nomes).toEqual({ 'nome-de-rota': 'Tour du Pajottenland' });
    expect(c.gravou).toHaveLength(1);
    expect(c.gravou[0].frente).toBe('nome-de-rota');
    expect(c.gravou[0].id).toBe('act-1');
    expect(c.gravou[0].nome).toBe('Tour du Pajottenland');
    expect(c.gravou[0].meta).toMatchObject({
      forma: 'casa-b',
      lingua: 'fr',
      regiao: 'Pajottenland',
      versaoPrompt: 2,
      provedor: 'fake',
      modelo: 'fake-1',
      tokens: { entrada: 120, saida: 40 },
      em: '2026-09-21T12:00:00.000Z',
    });
  });

  it('a resposta ilegível grava a recusa — é o que impede a rota de voltar todo dia', async () => {
    const c = cenario([corpoBom('não consigo nomear este percurso')]);
    expect(await nomearRotaSePreciso(SO_O_LOCAL, PONTOS, 'u1', c.deps)).toEqual({});
    expect(c.gravou).toHaveLength(1);
    expect(c.gravou[0].nome).toBeNull();
    expect(c.gravou[0].meta).toMatchObject({ recusa: 'ilegivel', provedor: 'fake' });
  });

  it('a conferência que reprova grava o que o modelo tentou', async () => {
    const c = cenario([corpoBom(JSON.stringify({ regiao: 'Toscana', justificativa: ['Siena'] }))]);
    expect(await nomearRotaSePreciso(SO_O_LOCAL, PONTOS, 'u1', c.deps)).toEqual({});
    expect(c.gravou[0].meta).toMatchObject({ recusa: 'reprovado', regiao: 'Toscana', provedor: 'fake' });
  });

  it('a rota degenerada grava sem gastar chamada', async () => {
    const c = cenario([corpoBom(BOA)]);
    const curta = { ...SO_O_LOCAL, distanceM: 900, cities: [PEDALADA.cities![0]] } as Activity;
    expect(await nomearRotaSePreciso(curta, PONTOS, 'u1', c.deps)).toEqual({});
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
    it(`${nome}: nada gravado, e a rota volta ao gatilho`, async () => {
      const c = cenario([resposta]);
      expect(await nomearRotaSePreciso(SO_O_LOCAL, PONTOS, 'u1', c.deps)).toEqual({});
      expect(c.gravou).toHaveLength(0);
    });
  }

  it('a gravação que falha não derruba a tela — devolve nada escrito', async () => {
    const c = cenario([corpoBom(BOA)]);
    const deps: DepsDoNome = {
      ...c.deps,
      salvar: async () => {
        throw new Error('PostgREST 500');
      },
    };
    expect(await nomearRotaSePreciso(SO_O_LOCAL, PONTOS, 'u1', deps)).toEqual({});
  });

  it('a consulta das âncoras que falha não derruba a tela, e não chama motor nenhum', async () => {
    const c = cenario([corpoBom(BOA)]);
    mockBanco.erroAoLerPlaces = new Error('PostgREST 500');
    expect(await nomearRotaSePreciso(PEDALADA, PONTOS, 'u1', c.deps)).toEqual({});
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
    expect(await nomearRotaSePreciso(SO_O_LOCAL, PONTOS, 'u1', c.deps)).toEqual({});
    expect(c.corpos).toHaveLength(0);
    expect(c.gravou).toHaveLength(0);
    expect(c.eventos[0].trilha.map((t) => [t.motor, t.desfecho])).toEqual([[APARELHO_SISTEMA, 'indisponivel']]);
  });

  it('sem-modelo escolhido não chama ninguém e não grava', async () => {
    const c = cenario([corpoBom(BOA)], SEM_MODELO);
    expect(await nomearRotaSePreciso(SO_O_LOCAL, PONTOS, 'u1', c.deps)).toEqual({});
    expect(c.corpos).toHaveLength(0);
    expect(c.gravou).toHaveLength(0);
  });

  it('a preferência ilegível não vira o padrão: ninguém é chamado', async () => {
    // Ilegível **não** é "use o padrão" (ADR 0048): um id que não se lê não tem
    // exposição a oferecer, e a cadeia fica só no piso. Cair no padrão aqui
    // mandaria dado para a nuvem por causa de um armazenamento corrompido.
    const c = cenario([corpoBom(BOA)], 'lixo' as MotorId);
    expect(await nomearRotaSePreciso(SO_O_LOCAL, PONTOS, 'u1', c.deps)).toEqual({});
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
    expect(await nomearRotaSePreciso(SO_O_LOCAL, PONTOS, 'u1', deps)).toEqual({});
    expect(c.corpos).toHaveLength(0);
    expect(c.gravou).toHaveLength(0);
  });

  it('o catálogo que não se lê ABORTA a nomeação — a variante aprovada não some calada', async () => {
    const c = cenario([corpoBom(BOA)]);
    const deps: DepsDoNome = {
      ...c.deps,
      catalogo: () => Promise.reject(new Error('sem rede')),
    };
    expect(await nomearRotaSePreciso(SO_O_LOCAL, PONTOS, 'u1', deps)).toEqual({});
    expect(c.corpos).toHaveLength(0);
    expect(c.gravou).toHaveLength(0);
  });
});

/* ── as duas frentes, com motores diferentes ──────────────────────────────── */

/**
 * O ponto central da decisão do dono: **os motores podem ser diferentes**.
 *
 * Os dois recursos resolvem a cadeia por conta própria, então cada um lê a
 * preferência **dele**. Ler uma só faria a segunda frente herdar calada a escolha da
 * primeira, e o dono só descobriria lendo a meta no banco.
 */
describe('as duas frentes', () => {
  it('rodam uma vez cada, em sequência, e gravam em colunas diferentes', async () => {
    const c = cenario([corpoBom(BOA), corpoBom(JSON.stringify({ ...JSON.parse(BOA), artigo: 'o' }))]);
    const nomes = await nomearRotaSePreciso(PEDALADA, PONTOS, 'u1', c.deps);

    expect(nomes).toEqual({
      'nome-de-rota': 'Tour du Pajottenland',
      'nome-de-rota-pt': 'Tour do Pajottenland',
    });
    // O local primeiro: é ele que manda, e o português é legenda.
    expect(c.gravou.map((g) => g.frente)).toEqual(['nome-de-rota', 'nome-de-rota-pt']);
    expect(c.corpos).toHaveLength(2);
    expect(c.corpos[0].usuario).toMatch(/^Língua do nome: francês\./);
    expect(c.corpos[1].usuario).toMatch(/^Língua do nome: português\./);
    // A meta de cada coluna diz a língua que o pedido dela disse.
    expect(c.gravou[0].meta).toMatchObject({ lingua: 'fr' });
    expect(c.gravou[1].meta).toMatchObject({ lingua: 'pt' });
    // Um evento no anel por frente, com o recurso de cada uma.
    expect(c.eventos.map((e) => e.recurso)).toEqual(['nome-de-rota', 'nome-de-rota-pt']);
  });

  it('cada frente lê a preferência DELA — e uma pode calar sem calar a outra', async () => {
    // Nome local em sem-modelo, legenda na nuvem: só a segunda chama alguém.
    const c = cenario([corpoBom(JSON.stringify({ ...JSON.parse(BOA), artigo: 'o' }))], {
      'nome-de-rota': SEM_MODELO,
      'nome-de-rota-pt': NUVEM_PADRAO,
    });
    const nomes = await nomearRotaSePreciso(PEDALADA, PONTOS, 'u1', c.deps);

    expect(c.preferenciasLidas).toEqual(['nome-de-rota', 'nome-de-rota-pt']);
    expect(nomes).toEqual({ 'nome-de-rota-pt': 'Tour do Pajottenland' });
    expect(c.corpos).toHaveLength(1);
    expect(c.gravou.map((g) => g.frente)).toEqual(['nome-de-rota-pt']);
  });

  it('a falha de uma frente não cancela a outra', async () => {
    // A gravação do nome local estoura; a legenda em português continua e grava.
    const c = cenario([corpoBom(BOA), corpoBom(JSON.stringify({ ...JSON.parse(BOA), artigo: 'o' }))]);
    const gravou: Gravacao[] = [];
    const deps: DepsDoNome = {
      ...c.deps,
      salvar: async (frente, id, nome, meta) => {
        if (frente === 'nome-de-rota') throw new Error('PostgREST 500');
        gravou.push({ frente, id, nome, meta: meta as Record<string, unknown> });
      },
    };
    const nomes = await nomearRotaSePreciso(PEDALADA, PONTOS, 'u1', deps);

    expect(nomes).toEqual({ 'nome-de-rota-pt': 'Tour do Pajottenland' });
    expect(gravou.map((g) => g.frente)).toEqual(['nome-de-rota-pt']);
  });
});

/* ── o anel ──────────────────────────────────────────────────────────────── */

describe('o anel', () => {
  it('recebe um evento por execução, com o recurso do núcleo', async () => {
    const c = cenario([corpoBom(BOA)]);
    await nomearRotaSePreciso(SO_O_LOCAL, PONTOS, 'u1', c.deps);
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
 *  - trocar `lerPreferencia(frente)` por `lerPreferencia('saude-do-sono')` lê a
 *    escolha do recurso errado, e nada reclama. Desde 23/09 há uma terceira
 *    variante disso: ler a escolha do **nome local** na frente do português faria as
 *    duas línguas sempre saírem do mesmo motor, que é exatamente o que o dono pediu
 *    para não acontecer;
 *  - trocar `saveRouteName(supabase, userId, id, …)` por `(supabase, id, userId, …)`
 *    faz o `update` casar **zero linhas**. O PostgREST devolve 204 sem erro, nada
 *    é gravado nunca, e o gatilho redispara a cada abertura — `tsc` limpo e a
 *    suíte inteira verde. E trocar `saveRouteName` por `saveRouteNamePt` gravaria a
 *    legenda por cima do nome local, com o mesmo silêncio.
 *
 * Aqui só o transporte da nuvem e o banco são falsos. A preferência sai do
 * armazenamento (o mock do AsyncStorage do `jest.setup.js`), com os recursos
 * gravados em sentidos opostos — o molde de `edicao-ia.test.ts`.
 */
describe('a fiação de produção — sem deps injetadas', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    mockMotores.motor = undefined;
  });

  /** Os updates de `activities` que de fato escreveram alguma coluna. */
  const escritas = () => mockBanco.updates.filter((u) => u.tabela === 'activities' && Object.keys(u.valores).length > 0);

  it('a preferência lida é a do nome de rota, e o update chega com as colunas e os filtros certos', async () => {
    // Nome de rota na nuvem, Saúde do sono em sem-modelo: ler o recurso errado
    // deixaria a cadeia só no piso, e nada seria gravado.
    await gravarPreferencia('nome-de-rota', NUVEM_PADRAO);
    await gravarPreferencia('saude-do-sono', SEM_MODELO);
    const { motor, corpos } = nuvemFalsa(corpoBom(BOA));
    mockMotores.motor = motor;

    const nomes = await nomearRotaSePreciso(SO_O_LOCAL, PONTOS, 'u1');

    expect(nomes).toEqual({ 'nome-de-rota': 'Tour du Pajottenland' });
    expect(corpos).toHaveLength(1);
    // O `update` de verdade, pelo `saveRouteName` do núcleo.
    const update = escritas()[0];
    expect(update).toBeDefined();
    expect(Object.keys(update!.valores).sort()).toEqual(['route_name', 'route_name_meta']);
    expect(update!.valores.route_name).toBe('Tour du Pajottenland');
    expect(update!.valores.route_name_meta).toMatchObject({ regiao: 'Pajottenland', versaoPrompt: 2 });
    // A ordem dos argumentos: `id` é da atividade, `user_id` é do dono. Trocados,
    // o update casaria zero linhas e ninguém reclamaria.
    expect(update!.filtros).toEqual({ id: 'act-1', user_id: 'u1' });
  });

  /**
   * A mesma prova para a frente do português — e ela é **duas** de uma vez: que a
   * escolha lida é a do recurso `nome-de-rota-pt`, e que o par de colunas é o de lá.
   */
  it('a frente do pt lê a escolha dela e escreve no par de colunas em português', async () => {
    // Só o pt tem motor: o nome local cai em sem-modelo e não chama ninguém.
    await gravarPreferencia('nome-de-rota', SEM_MODELO);
    await gravarPreferencia('nome-de-rota-pt', NUVEM_PADRAO);
    const { motor, corpos } = nuvemFalsa(corpoBom(JSON.stringify({ ...JSON.parse(BOA), artigo: 'o' })));
    mockMotores.motor = motor;

    const nomes = await nomearRotaSePreciso(PEDALADA, PONTOS, 'u1');

    expect(nomes).toEqual({ 'nome-de-rota-pt': 'Tour do Pajottenland' });
    expect(corpos).toHaveLength(1);
    expect(corpos[0].usuario).toMatch(/^Língua do nome: português\./);
    const update = escritas()[0];
    expect(Object.keys(update!.valores).sort()).toEqual(['route_name_pt', 'route_name_pt_meta']);
    expect(update!.valores.route_name_pt).toBe('Tour do Pajottenland');
    expect(update!.valores.route_name_pt_meta).toMatchObject({ lingua: 'pt', regiao: 'Pajottenland' });
    expect(update!.filtros).toEqual({ id: 'act-1', user_id: 'u1' });
  });

  it('o espelho: nome de rota em sem-modelo e Saúde do sono na nuvem — ninguém é chamado, nada gravado', async () => {
    await gravarPreferencia('nome-de-rota', SEM_MODELO);
    await gravarPreferencia('saude-do-sono', NUVEM_PADRAO);
    const { motor, corpos } = nuvemFalsa(corpoBom(BOA));
    mockMotores.motor = motor;

    expect(await nomearRotaSePreciso(SO_O_LOCAL, PONTOS, 'u1')).toEqual({});
    expect(corpos).toHaveLength(0);
    expect(escritas()).toEqual([]);
  });

  it('o erro do banco na gravação não derruba a tela', async () => {
    await gravarPreferencia('nome-de-rota', NUVEM_PADRAO);
    const { motor } = nuvemFalsa(corpoBom(BOA));
    mockMotores.motor = motor;
    mockBanco.erroAoGravar = new Error('PostgREST 500');
    expect(await nomearRotaSePreciso(SO_O_LOCAL, PONTOS, 'u1')).toEqual({});
  });
});
