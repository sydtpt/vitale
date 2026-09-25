/**
 * A store da edição — a máquina de estados que a porta e a rota da revista desenham.
 *
 * Desde a 1.11 o estado é **por caderno** e vem de duas fontes: o banco (o que está
 * impresso) e a sessão (o que acabou de acontecer). O que se mede aqui:
 *
 * - o **cache** — `ausente` e "nada impresso" são respostas sobre o relógio e o
 *   arquivo, e os dois mudam; a edição impressa congela;
 * - as duas **impressões** — a edição inteira e um caderno só —, que relêem antes
 *   de pagar, ignoram o segundo toque, preenchem a sessão caderno a caderno e
 *   relêem o banco no fim;
 * - as duas **derivações puras** que as telas desenham, `vistaDaEdicao` e
 *   `portaDe`, contra a matriz da spec, linha a linha.
 *
 * O banco e a sequência do núcleo são falsos; o vocabulário (`classeDoDesfecho`, a
 * frase, os problemas, os rótulos) é o de verdade — por isso os desfechos abaixo
 * têm a forma real.
 */
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import {
  AGG_VERSION,
  NUVEM_PADRAO,
  cadernosVisiveis,
  resolveRetroPrefs,
  type CadernoId,
  type CadernoImpresso,
  type Causa,
  type DesfechoDoCaderno,
} from '@vitale/shared';

/**
 * As leituras do banco. `respostas` é uma fila consumida chamada a chamada, na ordem
 * das chamadas (e a última fica valendo); `pausas` segura uma chamada no meio, pela
 * ordem.
 */
type RespostaFalsa =
  | { estado: 'ausente' }
  | { estado: 'ok'; edicao: unknown[]; capa?: unknown }
  | Error;
const mockLeitura: {
  respostas: RespostaFalsa[];
  chamadas: number;
  pausas: (Promise<void> | null)[];
} = { respostas: [{ estado: 'ausente' }], chamadas: 0, pausas: [] };

type AvisoFalso = { tipo: 'comecar'; caderno: string; fila: string[] } | { tipo: 'ler'; caderno: string; desfecho: unknown };
const mockImpressao: {
  avisos: AvisoFalso[];
  resultado: unknown;
  erro: Error | null;
  chamadas: number;
  pedidos: (readonly string[] | undefined)[];
  pausa: Promise<void> | null;
} = { avisos: [], resultado: { estado: 'nada-gravado', desfechos: [] }, erro: null, chamadas: 0, pedidos: [], pausa: null };

/**
 * Quem tem o que dizer, como o núcleo responderia. A entrada falsa daqui não monta
 * pacote, então a resposta é injetada; a de verdade tem teste em `edicao-ia.test.ts`.
 */
const mockComDado: { valor: readonly string[] } = { valor: ['sono', 'movimento', 'coracao', 'rotina'] };

/**
 * O carimbo da capa (Story 1.13). O que se mede aqui é **quem** o chama: a
 * impressão inteira sim, a de um caderno não. A escolha em si tem teste no núcleo
 * (`revista/capa.test.ts`) e a ligação com as fotos em `edicao-ia.test.ts`.
 */
const mockCarimbo: { chamadas: number; erro: Error | null; capa: unknown } =
  { chamadas: 0, erro: null, capa: null };

/**
 * A fita do que aconteceu, na ordem — **e ela é o teste, não decoração**.
 *
 * O carimbo tem de acontecer ANTES da releitura do fim, senão a rota mostra a
 * edição recém-impressa com a capa da impressão anterior até o próximo foco. Sem
 * esta fita, mover a chamada para depois — ou soltar o `await` — mantinha os
 * quatro testes do carimbo verdes.
 */
const mockFita: string[] = [];

/**
 * A troca da capa (Story 1.16) — a porta de `lib/edicao-ia`. O que se mede aqui é
 * a AÇÃO da store: quando ela chama, o que ela faz com o estado no sucesso e o que
 * ela NÃO faz na falha. A troca em si tem teste em `edicao-ia.test.ts`, e a capa
 * trocada, no núcleo.
 */
const mockTroca: {
  chamadas: number;
  fotos: unknown[];
  erro: Error | null;
  capa: unknown;
  pausa: Promise<void> | null;
} = { chamadas: 0, fotos: [], erro: null, capa: null, pausa: null };

// O ponto de injeção dos motores e o cliente do banco não carregam aqui.
jest.mock('../../lib/supabase', () => ({ supabase: {} }));
jest.mock('../../lib/motores', () => ({ motorPara: () => undefined }));

jest.mock('../../lib/edicao-ia', () => {
  const real = jest.requireActual('../../lib/edicao-ia') as Record<string, unknown>;
  return {
    ...real,
    comDadoDaEntrada: (_entrada: unknown, dadosProntos: boolean) => (dadosProntos ? mockComDado.valor : null),
    carimbarCapa: async () => {
      // **Uma volta antes de marcar a fita, e isso é o teste.** Marcando na
      // entrada, um `void carimbarCapa(...)` — sem o `await` — ainda escreveria
      // 'carimbo' antes de a releitura começar, e a ordem passaria verde com a
      // capa chegando depois da tela. Suspenso aqui, quem não espera é flagrado.
      await Promise.resolve();
      mockFita.push('carimbo');
      mockCarimbo.chamadas += 1;
      // O de verdade nunca rejeita; este rejeita para provar que a store não
      // deixa uma falha de capa virar "a impressão não terminou".
      if (mockCarimbo.erro) throw mockCarimbo.erro;
      return mockCarimbo.capa;
    },
    trocarCapa: async (_uid: string, _entrada: unknown, foto: unknown) => {
      mockTroca.chamadas += 1;
      mockTroca.fotos.push(foto);
      if (mockTroca.pausa) await mockTroca.pausa;
      if (mockTroca.erro) throw mockTroca.erro;
      return mockTroca.capa;
    },
    buscarEdicao: async () => {
      mockFita.push('leitura');
      const i = mockLeitura.chamadas;
      mockLeitura.chamadas += 1;
      // A resposta é a da ordem da CHAMADA, não a da ordem em que ela resolve: uma
      // leitura presa numa pausa leva a resposta que era dela.
      const r = mockLeitura.respostas.length > 1 ? mockLeitura.respostas.shift()! : mockLeitura.respostas[0];
      const pausa = mockLeitura.pausas[i];
      if (pausa) await pausa;
      if (r instanceof Error) throw r;
      return r;
    },
    imprimirEdicao: async (
      _uid: string,
      _entrada: unknown,
      pedido: {
        cadernos?: readonly string[];
        aoComecar?: (c: string, f: string[]) => void;
        aoLer?: (c: string, d: unknown) => void;
      },
    ) => {
      mockImpressao.chamadas += 1;
      mockImpressao.pedidos.push(pedido.cadernos);
      for (const a of mockImpressao.avisos) {
        if (a.tipo === 'comecar') pedido.aoComecar?.(a.caderno, a.fila);
        else pedido.aoLer?.(a.caderno, a.desfecho);
      }
      if (mockImpressao.pausa) await mockImpressao.pausa;
      if (mockImpressao.erro) throw mockImpressao.erro;
      return mockImpressao.resultado;
    },
  };
});

/** Quem está logado, e se o app já sabe disso. */
const mockAuth: { uid: string | undefined; isLoading: boolean } = { uid: 'u-1', isLoading: false };

jest.mock('../auth.store', () => ({
  useAuthStore: {
    getState: () => ({
      user: mockAuth.uid ? { id: mockAuth.uid } : null,
      isLoading: mockAuth.isLoading,
    }),
  },
}));

/**
 * Os cadernos que o dono silenciou (Story 2.5), como a `settings.store` os guarda.
 *
 * `null` é "não há preferência carregada ainda" — e a ação tem que tratar isso
 * como os quatro, não como silêncio.
 *
 * **`cru` existe para a ação não ser poupada.** A `settings.store` de verdade tem
 * DOIS caminhos até `preferences`: `loadSettings` resolve (`resolveRetroPrefs(pr.retro_prefs)`),
 * mas a hidratação do boot **não** — ela põe no estado o que o `getJSON` devolveu do
 * cache local, que pode ter sido gravado por uma versão anterior do app. Um mock que
 * resolvesse sempre esconderia por construção o bug que a P1 achou: a ação lendo o
 * valor cru enquanto as telas leem o resolvido. Com `cru: true`, o que chega à ação é
 * o mesmo lixo que chegaria do disco.
 */
const mockPrefs: { retroPrefs: unknown; cru: boolean } = { retroPrefs: null, cru: false };

jest.mock('../settings.store', () => ({
  useSettingsStore: {
    getState: () => {
      if (mockPrefs.retroPrefs === null) return { preferences: null };
      const { resolveRetroPrefs } = jest.requireActual('@vitale/shared') as {
        resolveRetroPrefs: (raw: unknown) => unknown;
      };
      return {
        preferences: {
          retroPrefs: mockPrefs.cru ? mockPrefs.retroPrefs : resolveRetroPrefs(mockPrefs.retroPrefs),
        },
      };
    },
  },
}));

import { TrocaRecusada } from '../../lib/edicao-ia';
import {
  AVISO_SILENCIO_PARCIAL,
  AVISO_TUDO_SILENCIADO,
  chaveDe,
  dadosProntosParaImprimir,
  estadoDe,
  podeImprimir,
  podeTrocarCapa,
  precisaGarantirJanela,
  portaDe,
  useEdicaoStore,
  vistaDaEdicao,
  type EstadoEdicao,
  type SessaoDaEdicao,
} from '../edicao.store';

type Entrada = Parameters<ReturnType<typeof useEdicaoStore.getState>['carregar']>[0];
type Lida = Extract<EstadoEdicao, { fase: 'lida' }>;

const ENTRADA = {
  resumo: { kind: 'month', startISO: '2026-08-01', endISO: '2026-08-31' },
  // Componentes locais, não string: o dia não pode depender do `TZ`. (8 = setembro.)
  agora: new Date(2026, 8, 6, 19, 0, 0),
} as unknown as Entrada;

/** **O que a TELA calcula** — a porta e a rota assinam `porPeriodo` e derivam com `estadoDe`. */
function naTela(entrada: Entrada = ENTRADA): EstadoEdicao {
  const { porPeriodo } = useEdicaoStore.getState();
  return estadoDe(porPeriodo, mockAuth.uid ? chaveDe(mockAuth.uid, entrada) : null, mockAuth.isLoading);
}

function lida(): Lida {
  const e = naTela();
  if (e.fase !== 'lida') throw new Error(`esperava lida, veio ${JSON.stringify(e)}`);
  return e;
}

/** Um caderno impresso, com a forma da leitura do banco. */
function impresso(caderno: CadernoId, posicao: number, extra: Partial<CadernoImpresso> = {}): CadernoImpresso {
  return {
    tipoPeriodo: 'month', inicio: '2026-08-01', fim: '2026-08-31', caderno, posicao,
    texto: `A chamada de ${caderno}, inteira. E o resto do texto.`,
    provedor: 'prov-a', modelo: 'modelo-1', promptVersao: 1, pacoteVersao: 1,
    aggVersionNoMomento: AGG_VERSION, metricaLider: null,
    // Meio-dia UTC: o mesmo dia de parede em qualquer fuso razoável.
    geradoEm: '2026-09-07T12:00:00.000Z',
    ...extra,
  };
}

/* ── os desfechos, com a forma real ──────────────────────────────────────── */

const escrito = (texto: string): DesfechoDoCaderno => ({
  tipo: 'escrito',
  leitura: {
    origem: 'motor', frase: texto, valor: texto, motor: NUVEM_PADRAO, trilha: [],
    resposta: {
      texto,
      assinatura: { tipo: 'nuvem', provedor: 'prov-a', modelo: 'modelo-1', versaoDoDescritor: 5003, instante: '2026-09-16T09:00:00.000Z' },
      tokens: { entrada: 10, saida: 5 },
    },
  },
} as unknown as DesfechoDoCaderno);

const piso = (causa: Causa, problemas: string[] = []): DesfechoDoCaderno => ({
  tipo: 'nao-escrito',
  leitura: {
    origem: 'piso', causa, ausencia: 'a revista não imprime sem modelo',
    trilha: causa === 'mudo' || causa === 'preferencia' ? [] : [{
      motor: NUVEM_PADRAO, desfecho: causa, ms: 1_000,
      ...(problemas.length > 0 ? { problemas: problemas.map((detalhe) => ({ regra: 'numero', detalhe })) } : {}),
    }],
  },
} as unknown as DesfechoDoCaderno);

const REPROVADA = 'O texto não passou na conferência e foi descartado.';
const TRANSITORIA = 'O caderno não foi escrito: a nuvem falhou por agora.';

/** Deixa as promessas em curso andarem uma volta. */
async function drenar(): Promise<void> {
  await new Promise<void>((r) => setImmediate(r));
}

function segurar(): { pausa: Promise<void>; soltar: () => void } {
  let soltar!: () => void;
  const pausa = new Promise<void>((r) => { soltar = r; });
  return { pausa, soltar };
}

beforeEach(() => {
  mockLeitura.respostas = [{ estado: 'ausente' }];
  mockLeitura.chamadas = 0;
  mockLeitura.pausas = [];
  mockImpressao.avisos = [];
  mockImpressao.resultado = { estado: 'nada-gravado', desfechos: [] };
  mockImpressao.erro = null;
  mockImpressao.chamadas = 0;
  mockImpressao.pedidos = [];
  mockImpressao.pausa = null;
  mockAuth.uid = 'u-1';
  mockAuth.isLoading = false;
  mockPrefs.retroPrefs = null;
  mockPrefs.cru = false;
  mockComDado.valor = ['sono', 'movimento', 'coracao', 'rotina'];
  mockCarimbo.chamadas = 0;
  mockCarimbo.erro = null;
  mockCarimbo.capa = null;
  mockFita.length = 0;
  mockTroca.chamadas = 0;
  mockTroca.fotos = [];
  mockTroca.erro = null;
  mockTroca.capa = null;
  mockTroca.pausa = null;
  useEdicaoStore.setState({ porPeriodo: {} });
});

/** Um período fechado lido com estes impressos (vazio: não escrito). */
async function lidoCom(edicao: CadernoImpresso[] = []): Promise<void> {
  mockLeitura.respostas = [{ estado: 'ok', edicao }];
  await useEdicaoStore.getState().carregar(ENTRADA);
  expect(naTela().fase).toBe('lida');
}

/* ── a leitura ───────────────────────────────────────────────────────────── */

describe('as fases que a leitura produz', () => {
  it('antes de qualquer leitura, `carregando` — que não desenha nada', () => {
    expect(naTela()).toEqual({ fase: 'carregando' });
  });

  it('ausente vira `ausente`', async () => {
    await useEdicaoStore.getState().carregar(ENTRADA);
    expect(naTela()).toEqual({ fase: 'ausente' });
  });

  it('lista VAZIA é o período lido e não escrito, com a sessão vazia', async () => {
    await lidoCom([]);
    expect(naTela()).toEqual({
      fase: 'lida', tipo: 'month', inicio: '2026-08-01', edicao: [], capa: null, sessao: {}, imprimindo: null,
    });
  });

  it('lista COM cadernos, na ordem em que o banco a entregou', async () => {
    await lidoCom([impresso('rotina', 1), impresso('sono', 2)]);
    expect(lida().edicao.map((c) => c.caderno)).toEqual(['rotina', 'sono']);
  });

  it('o erro vira frase, não código do PostgREST', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    mockLeitura.respostas = [new Error('PGRST116: JSON object requested, multiple rows returned')];
    await useEdicaoStore.getState().carregar(ENTRADA);
    expect(naTela()).toEqual({ fase: 'erro', mensagem: 'Não foi possível ler a edição agora.' });
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});

describe('o que o cache guarda, e o que ele NÃO guarda', () => {
  it('a edição impressa não relê — período fechado congela', async () => {
    await lidoCom([impresso('sono', 1)]);
    await useEdicaoStore.getState().carregar(ENTRADA);
    expect(mockLeitura.chamadas).toBe(1);
  });

  it('`ausente` relê: o mês em curso fecha', async () => {
    await useEdicaoStore.getState().carregar(ENTRADA);
    mockLeitura.respostas = [{ estado: 'ok', edicao: [impresso('sono', 1)] }];
    await useEdicaoStore.getState().carregar(ENTRADA);
    expect(mockLeitura.chamadas).toBe(2);
    expect(lida().edicao).toHaveLength(1);
  });

  it('nada impresso relê — e em silêncio: a capa com o convite não some durante a leitura', async () => {
    await lidoCom([]);
    const { pausa, soltar } = segurar();
    mockLeitura.pausas = [null, pausa];
    mockLeitura.respostas = [{ estado: 'ok', edicao: [impresso('sono', 1)] }];
    const p = useEdicaoStore.getState().carregar(ENTRADA);
    await drenar();
    expect(naTela().fase).toBe('lida');
    soltar();
    await p;
    expect(lida().edicao).toHaveLength(1);
  });

  it('dois focos seguidos não empilham consultas', async () => {
    await lidoCom([]);
    const { pausa, soltar } = segurar();
    mockLeitura.pausas = [null, pausa];
    const a = useEdicaoStore.getState().carregar(ENTRADA);
    const b = useEdicaoStore.getState().carregar(ENTRADA);
    soltar();
    await Promise.all([a, b]);
    expect(mockLeitura.chamadas).toBe(2);
  });

  it('`erro` NÃO relê sozinho — o toque é que relê', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    mockLeitura.respostas = [new Error('rede'), { estado: 'ok', edicao: [] }];
    await useEdicaoStore.getState().carregar(ENTRADA);
    await useEdicaoStore.getState().carregar(ENTRADA);
    await useEdicaoStore.getState().carregar(ENTRADA);
    expect(mockLeitura.chamadas).toBe(1);
    expect(naTela().fase).toBe('erro');
    await useEdicaoStore.getState().recarregar(ENTRADA);
    expect(mockLeitura.chamadas).toBe(2);
    expect(naTela().fase).toBe('lida');
    warn.mockRestore();
  });
});

describe('a sessão de login — o mapa é do usuário, não do app', () => {
  it('sem sessão, `sem-sessao`, e nenhuma consulta', async () => {
    mockAuth.uid = undefined;
    await useEdicaoStore.getState().carregar(ENTRADA);
    expect(mockLeitura.chamadas).toBe(0);
    expect(naTela()).toEqual({ fase: 'sem-sessao' });
  });

  it('durante a hidratação, silêncio', () => {
    mockAuth.uid = undefined;
    mockAuth.isLoading = true;
    expect(naTela()).toEqual({ fase: 'carregando' });
  });

  it('a sessão que chega tarde ainda é lida', async () => {
    mockAuth.uid = undefined;
    mockAuth.isLoading = true;
    await useEdicaoStore.getState().carregar(ENTRADA);
    expect(mockLeitura.chamadas).toBe(0);
    mockAuth.uid = 'u-1';
    mockAuth.isLoading = false;
    await lidoCom([impresso('sono', 1)]);
    expect(mockLeitura.chamadas).toBe(1);
  });

  it('a edição de um dono é INALCANÇÁVEL pelo outro', async () => {
    await lidoCom([impresso('sono', 1)]);
    mockAuth.uid = 'u-2';
    expect(naTela().fase).toBe('carregando');
    await lidoCom([]);
    expect(lida().edicao).toEqual([]);
    mockAuth.uid = 'u-1';
    expect(lida().edicao).toHaveLength(1);
  });

  it('o uid entra na chave', () => {
    expect(chaveDe('u-1', ENTRADA)).toBe('u-1|month|2026-08-01|2026-08-31');
  });

  it('`estadoDe` é a mesma resposta que o `estado()` da store', async () => {
    await lidoCom([impresso('sono', 1)]);
    expect(naTela()).toEqual(useEdicaoStore.getState().estado(ENTRADA));
    expect(estadoDe({}, null, false)).toEqual({ fase: 'sem-sessao' });
    expect(estadoDe({}, null, true)).toEqual({ fase: 'carregando' });
  });
});

describe('recarregar — o toque do leitor', () => {
  it('põe a leitura em `relendo`, que é a fase que desenha', async () => {
    await lidoCom([]);
    const { pausa, soltar } = segurar();
    mockLeitura.pausas = [null, pausa];
    const p = useEdicaoStore.getState().recarregar(ENTRADA);
    await drenar();
    expect(naTela()).toEqual({ fase: 'relendo' });
    soltar();
    await p;
  });

  it('relê mesmo a partir de uma edição impressa — é ato explícito', async () => {
    await lidoCom([impresso('sono', 1)]);
    await useEdicaoStore.getState().recarregar(ENTRADA);
    expect(mockLeitura.chamadas).toBe(2);
  });
});

/* ── a impressão da edição inteira ───────────────────────────────────────── */

describe('imprimir — "Escrever a edição"', () => {
  it('só age no período lido, sem nada impresso, com dados prontos', async () => {
    // Sem leitura.
    await useEdicaoStore.getState().imprimir(ENTRADA, true);
    // Ausente.
    await useEdicaoStore.getState().carregar(ENTRADA);
    await useEdicaoStore.getState().imprimir(ENTRADA, true);
    // Impressa.
    useEdicaoStore.setState({ porPeriodo: {} });
    await lidoCom([impresso('sono', 1)]);
    await useEdicaoStore.getState().imprimir(ENTRADA, true);
    expect(mockImpressao.chamadas).toBe(0);
  });

  it('com os dados pela metade, nada acontece — nem a releitura', async () => {
    await lidoCom([]);
    await useEdicaoStore.getState().imprimir(ENTRADA, false);
    expect(mockImpressao.chamadas).toBe(0);
    expect(mockLeitura.chamadas).toBe(1);
  });

  it('sem sessão, não imprime', async () => {
    await lidoCom([]);
    mockAuth.uid = undefined;
    await useEdicaoStore.getState().imprimir(ENTRADA, true);
    expect(mockImpressao.chamadas).toBe(0);
  });

  it('o segundo toque é ignorado — e nenhum caderno começa durante ela', async () => {
    await lidoCom([]);
    const { pausa, soltar } = segurar();
    mockImpressao.pausa = pausa;
    const primeiro = useEdicaoStore.getState().imprimir(ENTRADA, true);
    const segundo = useEdicaoStore.getState().imprimir(ENTRADA, true);
    const caderno = useEdicaoStore.getState().imprimirCaderno(ENTRADA, true, 'sono');
    expect(lida().imprimindo).toBe('edicao');
    soltar();
    await Promise.all([primeiro, segundo, caderno]);
    expect(mockImpressao.chamadas).toBe(1);
    expect(mockImpressao.pedidos).toEqual([undefined]);
  });

  it('preenche a sessão caderno a caderno: na fila, escrevendo, escrito, reprovado, erro', async () => {
    await lidoCom([]);
    const { pausa, soltar } = segurar();
    mockImpressao.pausa = pausa;
    const fila = ['movimento', 'coracao', 'sono', 'rotina'];
    mockImpressao.avisos = [
      { tipo: 'comecar', caderno: 'movimento', fila },
      { tipo: 'ler', caderno: 'movimento', desfecho: escrito('Foram 21 atividades.') },
      { tipo: 'comecar', caderno: 'coracao', fila },
      { tipo: 'ler', caderno: 'coracao', desfecho: piso('reprovada', ['"186" não está no pacote']) },
      { tipo: 'comecar', caderno: 'sono', fila },
      { tipo: 'ler', caderno: 'sono', desfecho: piso('transitoria') },
      { tipo: 'comecar', caderno: 'rotina', fila },
    ];
    const p = useEdicaoStore.getState().imprimir(ENTRADA, true);
    await drenar();
    expect(lida().sessao).toEqual({
      movimento: { fase: 'escrito', texto: 'Foram 21 atividades.' },
      coracao: { fase: 'reprovada', motivo: REPROVADA, problemas: ['"186" não está no pacote'] },
      sono: { fase: 'erro', motivo: TRANSITORIA },
      rotina: { fase: 'escrevendo' },
    });
    soltar();
    await p;
  });

  it('o primeiro aviso põe a fila inteira em `na-fila`', async () => {
    await lidoCom([]);
    const { pausa, soltar } = segurar();
    mockImpressao.pausa = pausa;
    mockImpressao.avisos = [{ tipo: 'comecar', caderno: 'movimento', fila: ['movimento', 'sono'] }];
    const p = useEdicaoStore.getState().imprimir(ENTRADA, true);
    await drenar();
    expect(lida().sessao).toEqual({ movimento: { fase: 'escrevendo' }, sono: { fase: 'na-fila' } });
    soltar();
    await p;
  });

  it('relê o banco no fim: a edição e a ordem são as da releitura, e a sessão guarda só o que falhou', async () => {
    await lidoCom([]);
    mockImpressao.avisos = [
      { tipo: 'ler', caderno: 'movimento', desfecho: escrito('a') },
      { tipo: 'ler', caderno: 'rotina', desfecho: escrito('b') },
      { tipo: 'ler', caderno: 'coracao', desfecho: piso('reprovada', ['"186" não está no pacote']) },
      { tipo: 'ler', caderno: 'sono', desfecho: piso('mudo') },
    ];
    // O que a função do banco devolveu não é o que a tela usa: é a releitura.
    mockImpressao.resultado = { estado: 'gravada', edicao: [impresso('movimento', 1)], desfechos: [] };
    mockLeitura.respostas = [
      { estado: 'ok', edicao: [] },                                            // antes de pagar
      { estado: 'ok', edicao: [impresso('rotina', 1), impresso('movimento', 2)] }, // no fim
    ];
    await useEdicaoStore.getState().imprimir(ENTRADA, true);
    expect(mockLeitura.chamadas).toBe(3);
    const e = lida();
    expect(e.imprimindo).toBeNull();
    expect(e.edicao.map((c) => [c.caderno, c.posicao])).toEqual([['rotina', 1], ['movimento', 2]]);
    expect(e.sessao).toEqual({
      coracao: { fase: 'reprovada', motivo: REPROVADA, problemas: ['"186" não está no pacote'] },
      sono: { fase: 'mudo' },
    });
  });

  it('`nada-gravado` também relê, e a sessão diz por quê', async () => {
    await lidoCom([]);
    mockImpressao.avisos = [{ tipo: 'ler', caderno: 'sono', desfecho: piso('indisponivel') }];
    await useEdicaoStore.getState().imprimir(ENTRADA, true);
    expect(mockLeitura.chamadas).toBe(3);
    expect(lida().sessao).toEqual({ sono: { fase: 'erro', motivo: 'O caderno não foi escrito: a nuvem não atendeu.' } });
    // E a edição pode ser tentada de novo.
    await useEdicaoStore.getState().imprimir(ENTRADA, true);
    expect(mockImpressao.chamadas).toBe(2);
  });

  it('uma edição nova recomeça a sessão', async () => {
    await lidoCom([]);
    mockImpressao.avisos = [{ tipo: 'ler', caderno: 'sono', desfecho: piso('indisponivel') }];
    await useEdicaoStore.getState().imprimir(ENTRADA, true);
    mockImpressao.avisos = [{ tipo: 'ler', caderno: 'rotina', desfecho: piso('guarda') }];
    await useEdicaoStore.getState().imprimir(ENTRADA, true);
    expect(Object.keys(lida().sessao)).toEqual(['rotina']);
  });

  it('`aberto` vira `ausente`', async () => {
    await lidoCom([]);
    mockImpressao.resultado = { estado: 'aberto' };
    await useEdicaoStore.getState().imprimir(ENTRADA, true);
    expect(naTela()).toEqual({ fase: 'ausente' });
  });

  it('`sem-caderno` relê e volta ao convite, sem sessão', async () => {
    await lidoCom([]);
    mockImpressao.resultado = { estado: 'sem-caderno' };
    await useEdicaoStore.getState().imprimir(ENTRADA, true);
    expect(lida()).toMatchObject({ edicao: [], sessao: {}, imprimindo: null });
  });
});

describe('a releitura antes de pagar — a memória pode ser velha', () => {
  it('o banco já tem a edição: ela, e a sequência nunca é chamada', async () => {
    await lidoCom([]);
    mockLeitura.respostas = [{ estado: 'ok', edicao: [impresso('movimento', 1), impresso('sono', 2)] }];
    await useEdicaoStore.getState().imprimir(ENTRADA, true);
    expect(mockImpressao.chamadas).toBe(0);
    expect(lida().edicao.map((c) => c.caderno)).toEqual(['movimento', 'sono']);
    expect(lida().imprimindo).toBeNull();
  });

  it('a releitura diz ausente: `ausente`, sem sequência', async () => {
    await lidoCom([]);
    mockLeitura.respostas = [{ estado: 'ausente' }];
    await useEdicaoStore.getState().imprimir(ENTRADA, true);
    expect(mockImpressao.chamadas).toBe(0);
    expect(naTela()).toEqual({ fase: 'ausente' });
  });

  it('a releitura falha: erro de leitura (nada começou), sem sequência', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    await lidoCom([]);
    mockLeitura.respostas = [new Error('rede')];
    await useEdicaoStore.getState().imprimir(ENTRADA, true);
    expect(mockImpressao.chamadas).toBe(0);
    expect(naTela()).toMatchObject({ fase: 'erro', mensagem: 'Não foi possível ler a edição agora.' });
    expect('aposImpressao' in naTela()).toBe(false);
    warn.mockRestore();
  });
});

describe('as portas falham durante a impressão', () => {
  it('a sequência rejeita: `erro` da impressão, sem prometer escrita — e a releitura devolve a sessão', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    await lidoCom([]);
    mockImpressao.avisos = [
      { tipo: 'ler', caderno: 'movimento', desfecho: escrito('a') },
      { tipo: 'ler', caderno: 'coracao', desfecho: piso('reprovada', ['x']) },
    ];
    mockImpressao.erro = new Error('linha recusada');
    await useEdicaoStore.getState().imprimir(ENTRADA, true);
    expect(naTela()).toEqual({
      fase: 'erro',
      mensagem: 'A impressão não terminou. Parte dela pode ter ficado gravada.',
      aposImpressao: true,
      // O escrito não sobrevive: só o banco diz se ele ficou. A reprovação, sim.
      sessao: { coracao: { fase: 'reprovada', motivo: REPROVADA, problemas: ['x'] } },
    });
    expect(warn).toHaveBeenCalled();
    // "Ver o que ficou gravado": relê, e a chave não fica presa.
    mockLeitura.respostas = [{ estado: 'ok', edicao: [impresso('movimento', 1)] }];
    await useEdicaoStore.getState().recarregar(ENTRADA);
    expect(lida().edicao.map((c) => c.caderno)).toEqual(['movimento']);
    expect(lida().sessao).toEqual({ coracao: { fase: 'reprovada', motivo: REPROVADA, problemas: ['x'] } });
    warn.mockRestore();
  });

  it('a releitura do fim falha: erro de leitura, com a sessão guardada para o toque', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    await lidoCom([]);
    mockImpressao.avisos = [{ tipo: 'ler', caderno: 'sono', desfecho: piso('transitoria') }];
    mockLeitura.respostas = [{ estado: 'ok', edicao: [] }, new Error('rede'), { estado: 'ok', edicao: [] }];
    await useEdicaoStore.getState().imprimir(ENTRADA, true);
    expect(naTela()).toEqual({
      fase: 'erro', mensagem: 'Não foi possível ler a edição agora.', sessao: { sono: { fase: 'erro', motivo: TRANSITORIA } },
    });
    await useEdicaoStore.getState().recarregar(ENTRADA);
    expect(lida().sessao).toEqual({ sono: { fase: 'erro', motivo: TRANSITORIA } });
    warn.mockRestore();
  });

  it('estado inesperado da sequência não deixa a chave presa em impressão', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    await lidoCom([]);
    mockImpressao.resultado = { estado: 'estranho' };
    await useEdicaoStore.getState().imprimir(ENTRADA, true);
    expect(naTela()).toMatchObject({
      fase: 'erro', aposImpressao: true, mensagem: 'A impressão devolveu uma resposta que o app não sabe ler.',
    });
    await useEdicaoStore.getState().recarregar(ENTRADA);
    expect(naTela().fase).toBe('lida');
    warn.mockRestore();
  });
});

describe('uma impressão em curso não é relida por cima', () => {
  it('o foco da tela e o toque de reler, no meio dela, não consultam', async () => {
    await lidoCom([]);
    const { pausa, soltar } = segurar();
    mockImpressao.pausa = pausa;
    const p = useEdicaoStore.getState().imprimir(ENTRADA, true);
    await drenar();
    await useEdicaoStore.getState().carregar(ENTRADA);
    await useEdicaoStore.getState().recarregar(ENTRADA);
    // A leitura da tela e a de antes de pagar — nenhuma do foco.
    expect(mockLeitura.chamadas).toBe(2);
    expect(lida().imprimindo).toBe('edicao');
    soltar();
    await p;
  });

  it('a leitura silenciosa que termina depois de a impressão começar é descartada', async () => {
    await lidoCom([]);
    const leituraDoFoco = segurar();
    const impressao = segurar();
    mockLeitura.pausas = [null, leituraDoFoco.pausa];
    mockImpressao.pausa = impressao.pausa;
    const foco = useEdicaoStore.getState().carregar(ENTRADA);          // chamada 2, presa
    await drenar();
    const toque = useEdicaoStore.getState().imprimir(ENTRADA, true);   // chamada 3 (antes de pagar)
    await drenar();
    leituraDoFoco.soltar();
    await foco;
    // A resposta velha não apagou a impressão.
    expect(lida().imprimindo).toBe('edicao');
    impressao.soltar();
    await toque;
    expect(lida().imprimindo).toBeNull();
  });
});

/* ── um caderno só ───────────────────────────────────────────────────────── */

describe('imprimirCaderno — "Escrever este caderno de novo"', () => {
  const MISTO = [impresso('movimento', 1), impresso('rotina', 2)];

  async function comCoracaoReprovado(): Promise<void> {
    await lidoCom(MISTO.slice());
    useEdicaoStore.setState((s) => {
      const chave = chaveDe('u-1', ENTRADA);
      const e = s.porPeriodo[chave] as Lida;
      return {
        porPeriodo: {
          ...s.porPeriodo,
          [chave]: { ...e, sessao: { coracao: { fase: 'reprovada', motivo: REPROVADA, problemas: ['"186" não está no pacote'] } } },
        },
      };
    });
  }

  it('só aquele caderno é pedido à sequência', async () => {
    await comCoracaoReprovado();
    mockLeitura.respostas = [
      { estado: 'ok', edicao: MISTO },
      { estado: 'ok', edicao: [impresso('coracao', 1), ...MISTO.map((c, i) => ({ ...c, posicao: i + 2 }))] },
    ];
    mockImpressao.avisos = [{ tipo: 'ler', caderno: 'coracao', desfecho: escrito('O coração.') }];
    mockImpressao.resultado = { estado: 'gravada', edicao: [], desfechos: [] };
    await useEdicaoStore.getState().imprimirCaderno(ENTRADA, true, 'coracao');
    expect(mockImpressao.pedidos).toEqual([['coracao']]);
  });

  it('só ele escrevendo; os outros intactos durante a impressão', async () => {
    await comCoracaoReprovado();
    const { pausa, soltar } = segurar();
    mockImpressao.pausa = pausa;
    mockLeitura.respostas = [{ estado: 'ok', edicao: MISTO }];
    mockImpressao.avisos = [{ tipo: 'comecar', caderno: 'coracao', fila: ['coracao'] }];
    const p = useEdicaoStore.getState().imprimirCaderno(ENTRADA, true, 'coracao');
    await drenar();
    const e = lida();
    expect(e.imprimindo).toBe('coracao');
    expect(e.sessao).toEqual({ coracao: { fase: 'escrevendo' } });
    expect(e.edicao).toEqual(MISTO);
    soltar();
    await p;
  });

  it('a releitura traz a ordem nova — e os outros sem texto nem assinatura novos', async () => {
    await comCoracaoReprovado();
    const depois = [
      impresso('movimento', 1),
      impresso('coracao', 2, { texto: 'O coração ficou em 48 bpm.', geradoEm: '2026-09-17T12:00:00.000Z' }),
      impresso('rotina', 3),
    ];
    mockLeitura.respostas = [{ estado: 'ok', edicao: MISTO }, { estado: 'ok', edicao: depois }];
    mockImpressao.avisos = [{ tipo: 'ler', caderno: 'coracao', desfecho: escrito('O coração ficou em 48 bpm.') }];
    mockImpressao.resultado = { estado: 'gravada', edicao: depois, desfechos: [] };
    await useEdicaoStore.getState().imprimirCaderno(ENTRADA, true, 'coracao');
    const e = lida();
    expect(e.edicao.map((c) => [c.caderno, c.posicao])).toEqual([['movimento', 1], ['coracao', 2], ['rotina', 3]]);
    expect(e.sessao).toEqual({});
    const antes = new Map(MISTO.map((c) => [c.caderno, c]));
    for (const c of e.edicao.filter((x) => x.caderno !== 'coracao')) {
      expect({ texto: c.texto, modelo: c.modelo, geradoEm: c.geradoEm }).toEqual({
        texto: antes.get(c.caderno)!.texto, modelo: antes.get(c.caderno)!.modelo, geradoEm: antes.get(c.caderno)!.geradoEm,
      });
    }
  });

  it('o segundo toque é ignorado, e nenhum outro caderno nem a edição começam', async () => {
    await comCoracaoReprovado();
    const { pausa, soltar } = segurar();
    mockImpressao.pausa = pausa;
    mockLeitura.respostas = [{ estado: 'ok', edicao: MISTO }];
    const a = useEdicaoStore.getState().imprimirCaderno(ENTRADA, true, 'coracao');
    const b = useEdicaoStore.getState().imprimirCaderno(ENTRADA, true, 'coracao');
    const c = useEdicaoStore.getState().imprimirCaderno(ENTRADA, true, 'sono');
    await drenar();
    soltar();
    await Promise.all([a, b, c]);
    expect(mockImpressao.chamadas).toBe(1);
  });

  it('caderno impresso não se reimprime por aqui; o mudo também não', async () => {
    await lidoCom(MISTO.slice());
    await useEdicaoStore.getState().imprimirCaderno(ENTRADA, true, 'movimento');
    expect(mockImpressao.chamadas).toBe(0);
    const chave = chaveDe('u-1', ENTRADA);
    useEdicaoStore.setState((s) => ({
      porPeriodo: { ...s.porPeriodo, [chave]: { ...(s.porPeriodo[chave] as Lida), sessao: { sono: { fase: 'mudo' } } } },
    }));
    await useEdicaoStore.getState().imprimirCaderno(ENTRADA, true, 'sono');
    expect(mockImpressao.chamadas).toBe(0);
  });

  it('relê antes de pagar: o caderno já impresso em outro lugar não é pago de novo', async () => {
    await comCoracaoReprovado();
    mockLeitura.respostas = [{ estado: 'ok', edicao: [...MISTO, impresso('coracao', 3)] }];
    await useEdicaoStore.getState().imprimirCaderno(ENTRADA, true, 'coracao');
    expect(mockImpressao.chamadas).toBe(0);
    expect(lida().edicao.map((c) => c.caderno)).toEqual(['movimento', 'rotina', 'coracao']);
    expect(lida().sessao).toEqual({});
  });

  it('o erro passageiro de outro caderno continua enquanto um é tentado de novo', async () => {
    await lidoCom([]);
    mockImpressao.avisos = [
      { tipo: 'ler', caderno: 'sono', desfecho: piso('indisponivel') },
      { tipo: 'ler', caderno: 'movimento', desfecho: piso('indisponivel') },
    ];
    await useEdicaoStore.getState().imprimir(ENTRADA, true);
    mockImpressao.avisos = [{ tipo: 'ler', caderno: 'sono', desfecho: escrito('O sono.') }];
    mockImpressao.resultado = { estado: 'gravada', edicao: [], desfechos: [] };
    mockLeitura.respostas = [{ estado: 'ok', edicao: [] }, { estado: 'ok', edicao: [impresso('sono', 1)] }];
    await useEdicaoStore.getState().imprimirCaderno(ENTRADA, true, 'sono');
    expect(mockImpressao.pedidos).toEqual([undefined, ['sono']]);
    expect(lida().sessao).toEqual({ movimento: { fase: 'erro', motivo: 'O caderno não foi escrito: a nuvem não atendeu.' } });
  });
});

describe('relançamento — a reprovação vive uma sessão (decisão declarada)', () => {
  it('depois de reabrir o app, o reprovado volta a ser um caderno não escrito, com o convite', async () => {
    await lidoCom([impresso('movimento', 1)]);
    mockImpressao.avisos = [{ tipo: 'ler', caderno: 'coracao', desfecho: piso('reprovada', ['"186" não está no pacote']) }];
    mockLeitura.respostas = [{ estado: 'ok', edicao: [impresso('movimento', 1)] }];
    await useEdicaoStore.getState().imprimirCaderno(ENTRADA, true, 'coracao');
    expect(lida().sessao.coracao?.fase).toBe('reprovada');

    // O app fecha e abre: a memória some, e o banco nunca soube da reprovação.
    useEdicaoStore.setState({ porPeriodo: {} });
    await useEdicaoStore.getState().carregar(ENTRADA);
    const vista = vistaDaEdicao(naTela(), ['sono', 'movimento', 'coracao'], AGG_VERSION);
    expect(vista.tipo === 'edicao' && vista.cadernos.find((c) => c.caderno === 'coracao')).toEqual({
      caderno: 'coracao', estado: 'nao-escrito', acao: 'escrever',
    });
  });
});

/* ── as derivações puras ─────────────────────────────────────────────────── */

/** Um estado lido, montado à mão. */
function estadoLido(o: Partial<Lida> = {}): Lida {
  return {
    fase: 'lida', tipo: 'month', inicio: '2026-08-01', edicao: [], capa: null,
    sessao: {}, imprimindo: null, ...o,
  };
}

const TODOS: readonly CadernoId[] = ['sono', 'movimento', 'coracao', 'rotina'];

describe('vistaDaEdicao — a matriz da rota', () => {
  it('rota, não escrito, dados prontos: capa em papel, o convite e o botão; miolo vazio', () => {
    expect(vistaDaEdicao(estadoLido(), ['sono', 'movimento', 'coracao'], AGG_VERSION)).toEqual({
      tipo: 'edicao',
      capa: {
        periodo: 'Agosto de 2026', impressa: false, manchete: null,
        carimbada: null, comFoto: false, natureza: null, legenda: null,
        escrevendo: false, escrever: true, semCaderno: false,
      },
      cadernos: [],
      avisoDoSilencio: null,
    });
  });

  it('dados não prontos: sem botão — nem desabilitado', () => {
    const v = vistaDaEdicao(estadoLido(), null, AGG_VERSION);
    expect(v).toMatchObject({ tipo: 'edicao', capa: { escrever: false, semCaderno: false }, cadernos: [] });
  });

  it('nenhum caderno com o que dizer: o aviso, sem botão', () => {
    expect(vistaDaEdicao(estadoLido(), [], AGG_VERSION)).toMatchObject({ capa: { escrever: false, semCaderno: true } });
  });

  it('impressa: a manchete é a chamada do caderno em posição 1, inteira; os impressos em posição e os sem linha no catálogo', () => {
    const longa = 'O tempo de sono subiu para 7,1 h e a variabilidade da frequência cardíaca alcançou 71 ms, '
      + 'enquanto a frequência cardíaca em repouso chegou a 52 bpm. E depois disso mais nada.';
    const v = vistaDaEdicao(
      estadoLido({ edicao: [impresso('rotina', 1, { texto: longa }), impresso('movimento', 2)] }),
      TODOS, AGG_VERSION,
    );
    if (v.tipo !== 'edicao') throw new Error(v.tipo);
    expect(v.capa).toEqual({
      periodo: 'Agosto de 2026', impressa: true,
      carimbada: null, comFoto: false, natureza: null, legenda: null,
      escrevendo: false, escrever: false, semCaderno: false,
      manchete: 'O tempo de sono subiu para 7,1 h e a variabilidade da frequência cardíaca alcançou 71 ms, '
        + 'enquanto a frequência cardíaca em repouso chegou a 52 bpm.',
    });
    expect(v.cadernos.map((c) => [c.caderno, c.estado])).toEqual([
      ['rotina', 'pronta'], ['movimento', 'pronta'], ['sono', 'nao-escrito'], ['coracao', 'nao-escrito'],
    ]);
    expect(v.cadernos[1]).toEqual({
      caderno: 'movimento', estado: 'pronta', texto: impresso('movimento', 2).texto,
      chamada: 'A chamada de movimento, inteira.',
      assinatura: 'modelo-1 · 07 set 2026', errata: false,
    });
    expect(v.cadernos[2]).toEqual({ caderno: 'sono', estado: 'nao-escrito', acao: 'escrever' });
  });

  it('estado misto: Movimento impresso, Sono escrevendo, Coração reprovado, Rotina com errata', () => {
    const sessao: SessaoDaEdicao = {
      sono: { fase: 'escrevendo' },
      coracao: { fase: 'reprovada', motivo: REPROVADA, problemas: ['"186" não está no pacote'] },
    };
    const edicao = [impresso('movimento', 1), impresso('rotina', 2, { aggVersionNoMomento: AGG_VERSION - 1 })];
    const correndo = vistaDaEdicao(estadoLido({ edicao, sessao, imprimindo: 'sono' }), TODOS, AGG_VERSION);
    if (correndo.tipo !== 'edicao') throw new Error(correndo.tipo);
    expect(correndo.cadernos).toEqual([
      {
        caderno: 'movimento', estado: 'pronta', texto: edicao[0].texto,
        chamada: 'A chamada de movimento, inteira.', assinatura: 'modelo-1 · 07 set 2026', errata: false,
      },
      {
        caderno: 'rotina', estado: 'pronta', texto: edicao[1].texto,
        chamada: 'A chamada de rotina, inteira.', assinatura: 'modelo-1 · 07 set 2026', errata: true,
      },
      { caderno: 'sono', estado: 'escrevendo' },
      // Durante a impressão, nenhum botão de escrever.
      { caderno: 'coracao', estado: 'reprovada', motivo: REPROVADA, problemas: ['"186" não está no pacote'] },
    ]);

    // Quando ela termina, o Coração ganha a ação dele.
    const parado = vistaDaEdicao(
      estadoLido({ edicao, sessao: { coracao: sessao.coracao! } }), TODOS, AGG_VERSION,
    );
    if (parado.tipo !== 'edicao') throw new Error(parado.tipo);
    expect(parado.cadernos.find((c) => c.caderno === 'coracao')).toEqual({
      caderno: 'coracao', estado: 'reprovada', motivo: REPROVADA, problemas: ['"186" não está no pacote'],
      acao: 'escrever-de-novo',
    });
  });

  it('erro passageiro: a frase e "Tentar de novo"', () => {
    const v = vistaDaEdicao(
      estadoLido({ edicao: [impresso('movimento', 1)], sessao: { sono: { fase: 'erro', motivo: TRANSITORIA } } }),
      TODOS, AGG_VERSION,
    );
    if (v.tipo !== 'edicao') throw new Error(v.tipo);
    expect(v.cadernos.find((c) => c.caderno === 'sono')).toEqual({
      caderno: 'sono', estado: 'erro', motivo: TRANSITORIA, acao: 'tentar-de-novo',
    });
  });

  it('caderno sem dado não aparece, e o mudo some', () => {
    const v = vistaDaEdicao(
      estadoLido({ edicao: [impresso('movimento', 1)], sessao: { coracao: { fase: 'mudo' } } }),
      ['sono', 'movimento', 'coracao'], AGG_VERSION,
    );
    if (v.tipo !== 'edicao') throw new Error(v.tipo);
    expect(v.cadernos.map((c) => c.caderno)).toEqual(['movimento', 'sono']);
  });

  it('errata só no caderno cuja agregação mudou — o texto fica como está', () => {
    const edicao = [impresso('movimento', 1), impresso('sono', 2, { aggVersionNoMomento: AGG_VERSION - 1 })];
    const v = vistaDaEdicao(estadoLido({ edicao }), TODOS, AGG_VERSION);
    if (v.tipo !== 'edicao') throw new Error(v.tipo);
    const prontas = v.cadernos.filter((c) => c.estado === 'pronta');
    expect(prontas.map((c) => c.estado === 'pronta' && [c.caderno, c.errata, c.texto])).toEqual([
      ['movimento', false, edicao[0].texto], ['sono', true, edicao[1].texto],
    ]);
  });

  it('a edição inteira escrevendo: os cadernos com dado na fila, e a capa diz "Escrevendo a edição…", sem botão', () => {
    const v = vistaDaEdicao(
      estadoLido({ imprimindo: 'edicao', sessao: { movimento: { fase: 'escrevendo' } } }),
      ['sono', 'movimento', 'rotina'], AGG_VERSION,
    );
    expect(v).toEqual({
      tipo: 'edicao',
      capa: {
        periodo: 'Agosto de 2026', impressa: false, manchete: null,
        carimbada: null, comFoto: false, natureza: null, legenda: null,
        escrevendo: true, escrever: false, semCaderno: false,
      },
      cadernos: [
        { caderno: 'sono', estado: 'na-fila' },
        { caderno: 'movimento', estado: 'escrevendo' },
        { caderno: 'rotina', estado: 'na-fila' },
      ],
      avisoDoSilencio: null,
    });
  });

  it('o escrito que espera a gravação aparece, sem assinatura', () => {
    const v = vistaDaEdicao(
      estadoLido({ imprimindo: 'edicao', sessao: { movimento: { fase: 'escrito', texto: 'Foram 21.' } } }),
      ['movimento'], AGG_VERSION,
    );
    if (v.tipo !== 'edicao') throw new Error(v.tipo);
    expect(v.cadernos).toEqual([{
      caderno: 'movimento', estado: 'pronta', texto: 'Foram 21.',
      chamada: 'Foram 21.', assinatura: null, errata: false,
    }]);
  });

  it('nada impresso, mas algo aconteceu nesta sessão: o miolo mostra o que falhou e convida os outros', () => {
    const v = vistaDaEdicao(
      estadoLido({ sessao: { sono: { fase: 'erro', motivo: TRANSITORIA } } }),
      ['sono', 'movimento'], AGG_VERSION,
    );
    expect(v).toEqual({
      tipo: 'edicao',
      capa: {
        periodo: 'Agosto de 2026', impressa: false, manchete: null,
        carimbada: null, comFoto: false, natureza: null, legenda: null,
        escrevendo: false, escrever: true, semCaderno: false,
      },
      cadernos: [
        { caderno: 'sono', estado: 'erro', motivo: TRANSITORIA, acao: 'tentar-de-novo' },
        { caderno: 'movimento', estado: 'nao-escrito', acao: 'escrever' },
      ],
      avisoDoSilencio: null,
    });
  });

  it('com os dados pela metade, o que aconteceu continua dito — sem ação nenhuma', () => {
    const v = vistaDaEdicao(
      estadoLido({ edicao: [impresso('movimento', 1)], sessao: { coracao: { fase: 'reprovada', motivo: REPROVADA, problemas: [] } } }),
      null, AGG_VERSION,
    );
    if (v.tipo !== 'edicao') throw new Error(v.tipo);
    expect(v.cadernos.map((c) => ('acao' in c ? `${c.caderno}:${c.acao}` : c.caderno))).toEqual(['movimento', 'coracao']);
  });

  it('as fases sem edição', () => {
    expect(vistaDaEdicao({ fase: 'carregando' }, TODOS, AGG_VERSION)).toEqual({ tipo: 'nada' });
    expect(vistaDaEdicao({ fase: 'ausente' }, TODOS, AGG_VERSION)).toEqual({ tipo: 'nada' });
    expect(vistaDaEdicao({ fase: 'relendo' }, TODOS, AGG_VERSION)).toEqual({ tipo: 'lendo' });
    expect(vistaDaEdicao({ fase: 'sem-sessao' }, TODOS, AGG_VERSION)).toEqual({ tipo: 'sem-sessao' });
    expect(vistaDaEdicao({ fase: 'erro', mensagem: 'm' }, TODOS, AGG_VERSION)).toEqual({ tipo: 'erro', mensagem: 'm', aposImpressao: false });
    expect(vistaDaEdicao({ fase: 'erro', mensagem: 'm', aposImpressao: true }, TODOS, AGG_VERSION))
      .toEqual({ tipo: 'erro', mensagem: 'm', aposImpressao: true });
  });
});

/**
 * A chamada de cada caderno — o que o **sumário** da rota desenha (Story 1.14).
 *
 * Ela nasce aqui e não no render pela mesma razão que "foto ou papel" da 1.13:
 * regra tem teste, render não tem. E cai ao lado da manchete da capa, que sai da
 * mesma `chamadaDoTexto` — se um dia o corte da frase mudar, muda num lugar só.
 *
 * O sumário em si é uma linha por caderno **do miolo**, na ordem deste vetor:
 * quem não está `pronta` entra igual, só sem chamada. Por isso o que se mede aqui
 * é a lista inteira, e não só as prontas.
 */
describe('a chamada no miolo — a linha do sumário', () => {
  it('edição cheia: uma linha por caderno impresso, na ordem em que a leitura os entregou, com nome e chamada', () => {
    // **A ordem aqui não é garantia desta função**: `vistaDaEdicao` não ordena —
    // ela percorre `edicao` como recebeu, e é isso que este caso prende. Quem
    // garante que a leitura chega em `posicao` é `fetchEdicao`
    // (`packages/shared/src/data/edicoes-ia.ts`, `.order('posicao')`), com teste
    // próprio em `edicoes-ia.test.ts`. Mexer na ordem da fixture abaixo não
    // provaria nada sobre o banco.
    const edicao = [
      impresso('movimento', 1), impresso('sono', 2), impresso('coracao', 3), impresso('rotina', 4),
    ];
    const v = vistaDaEdicao(estadoLido({ edicao }), TODOS, AGG_VERSION);
    if (v.tipo !== 'edicao') throw new Error(v.tipo);
    expect(v.cadernos.map((c) => [c.caderno, c.estado === 'pronta' ? c.chamada : null])).toEqual([
      ['movimento', 'A chamada de movimento, inteira.'],
      ['sono', 'A chamada de sono, inteira.'],
      ['coracao', 'A chamada de coracao, inteira.'],
      ['rotina', 'A chamada de rotina, inteira.'],
    ]);
    // A repetição capa × linha 1 é forma, não defeito: as duas ficam.
    expect(v.capa.manchete).toBe('A chamada de movimento, inteira.');
  });

  it('a chamada é a PRIMEIRA frase, não o texto inteiro nem um corte de tamanho', () => {
    const texto = 'Você pedalou 435 km, metade de julho — e é o terceiro mês seguido caindo. '
      + 'O resto do caderno continua depois disso, e não entra na linha do sumário.';
    const v = vistaDaEdicao(estadoLido({ edicao: [impresso('movimento', 1, { texto })] }), TODOS, AGG_VERSION);
    if (v.tipo !== 'edicao') throw new Error(v.tipo);
    const c = v.cadernos[0];
    expect(c.estado === 'pronta' && c.chamada)
      .toBe('Você pedalou 435 km, metade de julho — e é o terceiro mês seguido caindo.');
    // O texto do caderno não é tocado: quem corta é só a linha do sumário.
    expect(c.estado === 'pronta' && c.texto).toBe(texto);
  });

  it('estado misto: as linhas FICAM, com o nome e sem chamada', () => {
    const sessao: SessaoDaEdicao = {
      sono: { fase: 'escrevendo' },
      coracao: { fase: 'reprovada', motivo: REPROVADA, problemas: [] },
    };
    const v = vistaDaEdicao(
      estadoLido({ edicao: [impresso('movimento', 1)], sessao, imprimindo: 'sono' }), TODOS, AGG_VERSION,
    );
    if (v.tipo !== 'edicao') throw new Error(v.tipo);
    expect(v.cadernos.map((c) => [c.caderno, c.estado === 'pronta' ? c.chamada : null])).toEqual([
      ['movimento', 'A chamada de movimento, inteira.'],
      ['sono', null],
      ['coracao', null],
      ['rotina', null],
    ]);
  });

  it('texto sem frase fechada: a linha fica com o nome e sem chamada — null, nunca string vazia', () => {
    const v = vistaDaEdicao(
      // Nenhuma letra: `chamadaDoTexto` não acha frase nenhuma. O CHECK do banco
      // proíbe texto vazio, então este é o piso do que pode chegar impresso.
      estadoLido({ edicao: [impresso('sono', 1, { texto: '7,1 · 52 · 71' })] }), TODOS, AGG_VERSION,
    );
    if (v.tipo !== 'edicao') throw new Error(v.tipo);
    const c = v.cadernos[0];
    expect(c.estado === 'pronta' && c.chamada).toBeNull();
  });

  it('edição rasa: um caderno só, e o sumário é de uma linha', () => {
    const v = vistaDaEdicao(estadoLido({ edicao: [impresso('sono', 1)] }), ['sono'], AGG_VERSION);
    if (v.tipo !== 'edicao') throw new Error(v.tipo);
    expect(v.cadernos).toEqual([{
      caderno: 'sono', estado: 'pronta', texto: impresso('sono', 1).texto,
      chamada: 'A chamada de sono, inteira.', assinatura: 'modelo-1 · 07 set 2026', errata: false,
    }]);
  });

  it('miolo vazio: a vista não devolve caderno nenhum — é o que apaga o sumário na rota', () => {
    // O que se mede é a vista, não o render: quem decide desenhar o sumário é o
    // `cadernos.length > 0` da rota, e nada aqui o exercita.
    const v = vistaDaEdicao(estadoLido(), TODOS, AGG_VERSION);
    if (v.tipo !== 'edicao') throw new Error(v.tipo);
    expect(v.cadernos).toEqual([]);
  });

  it('o escrito que espera a gravação já tem chamada — mostrar é progressivo', () => {
    const v = vistaDaEdicao(
      estadoLido({
        imprimindo: 'edicao',
        sessao: { coracao: { fase: 'escrito', texto: 'A frequência em repouso caiu para 48 bpm. E o resto.' } },
      }),
      ['coracao'], AGG_VERSION,
    );
    if (v.tipo !== 'edicao') throw new Error(v.tipo);
    const c = v.cadernos[0];
    expect(c.estado === 'pronta' && c.chamada).toBe('A frequência em repouso caiu para 48 bpm.');
  });
});

describe('portaDe — o cartão da Retrospectiva', () => {
  it('impressa: a miniatura com o período curto e a chamada inteira do caderno em posição 1', () => {
    expect(portaDe(estadoLido({ edicao: [impresso('movimento', 1), impresso('sono', 2)] }))).toEqual({
      tipo: 'impressa', periodo: 'ago 2026', chamada: 'A chamada de movimento, inteira.',
    });
  });

  it('não escrita: a frase e a seta — mesmo com falhas nesta sessão', () => {
    expect(portaDe(estadoLido())).toEqual({ tipo: 'nao-escrita' });
    expect(portaDe(estadoLido({ sessao: { sono: { fase: 'erro', motivo: TRANSITORIA } } }))).toEqual({ tipo: 'nao-escrita' });
  });

  it('escrevendo: nada impresso e uma impressão correndo', () => {
    expect(portaDe(estadoLido({ imprimindo: 'edicao' }))).toEqual({ tipo: 'escrevendo' });
  });

  it('a reimpressão de um caderno não tira a chamada do que está impresso', () => {
    expect(portaDe(estadoLido({ edicao: [impresso('movimento', 1)], imprimindo: 'coracao' })).tipo).toBe('impressa');
  });

  it('em curso, Total e a primeira leitura: nada', () => {
    expect(portaDe({ fase: 'ausente' })).toEqual({ tipo: 'nada' });
    expect(portaDe({ fase: 'carregando' })).toEqual({ tipo: 'nada' });
    expect(portaDe({ fase: 'relendo' })).toEqual({ tipo: 'nada' });
  });

  it('sem sessão e erro', () => {
    expect(portaDe({ fase: 'sem-sessao' })).toEqual({ tipo: 'sem-sessao' });
    expect(portaDe({ fase: 'erro', mensagem: 'Não foi possível ler a edição agora.' }))
      .toEqual({ tipo: 'erro', mensagem: 'Não foi possível ler a edição agora.' });
  });
});

/**
 * Silenciar um caderno (Story 2.5) — a matriz de I/O da spec, do lado do
 * hospedeiro.
 *
 * O guarda do jsonb e o seletor estão em `retro.test.ts`; aqui mede-se o que a
 * revista faz com a lista: a manchete, o miolo, o sumário, os botões e — o que
 * custa dinheiro — **os candidatos que chegam à sequência**.
 */
describe('o caderno silenciado (Story 2.5)', () => {
  /** A edição de um período em que sono lidera: a manchete é dele. */
  const COM_SONO_NA_FRENTE = [impresso('sono', 1), impresso('movimento', 2), impresso('coracao', 3)];

  it('some do miolo e do sumário, e os outros mantêm a ordem relativa', () => {
    const v = vistaDaEdicao(estadoLido({ edicao: COM_SONO_NA_FRENTE }), TODOS, AGG_VERSION, ['movimento', 'coracao', 'rotina']);
    if (v.tipo !== 'edicao') throw new Error('esperava edição');
    // A ordem gravada (2 e 3) sobrevive: quem pula o buraco é a leitura.
    expect(v.cadernos.filter((c) => c.estado === 'pronta').map((c) => c.caderno)).toEqual(['movimento', 'coracao']);
    expect(v.cadernos.some((c) => c.caderno === 'sono')).toBe(false);
  });

  /**
   * **A armadilha da manchete.** `find(c => c.posicao === 1)` devolve `undefined`
   * com o líder silenciado, e a capa ficaria muda sobre uma edição que fala.
   */
  it('a manchete passa para o primeiro caderno visível, nunca nula nem a do silenciado', () => {
    const v = vistaDaEdicao(estadoLido({ edicao: COM_SONO_NA_FRENTE }), TODOS, AGG_VERSION, ['movimento', 'coracao', 'rotina']);
    if (v.tipo !== 'edicao') throw new Error('esperava edição');
    expect(v.capa.manchete).toBe('A chamada de movimento, inteira.');
    // E o cartão da Retrospectiva conta a mesma história — é a mesma manchete.
    expect(portaDe(estadoLido({ edicao: COM_SONO_NA_FRENTE }), ['movimento', 'coracao', 'rotina']))
      .toMatchObject({ tipo: 'impressa', chamada: 'A chamada de movimento, inteira.' });
  });

  it('sem caderno visível impresso, a capa fica sem manchete — e continua impressa', () => {
    const v = vistaDaEdicao(estadoLido({ edicao: [impresso('sono', 1)] }), TODOS, AGG_VERSION, ['movimento']);
    if (v.tipo !== 'edicao') throw new Error('esperava edição');
    expect(v.capa.manchete).toBeNull();
    // Impressa continua: o texto está gravado. Silenciar não devolve o período ao convite.
    expect(v.capa.impressa).toBe(true);
    // E o miolo não fica órfão: movimento entra como não escrito, com o botão dele.
    expect(v.cadernos).toContainEqual({ caderno: 'movimento', estado: 'nao-escrito', acao: 'escrever' });
  });

  it('o silenciado não aparece nem por dado, nem pelo que a sessão diz dele', () => {
    const v = vistaDaEdicao(
      estadoLido({ sessao: { sono: { fase: 'reprovada', motivo: REPROVADA, problemas: ['x'] } }, imprimindo: null }),
      TODOS, AGG_VERSION, ['movimento', 'coracao', 'rotina'],
    );
    if (v.tipo !== 'edicao') throw new Error('esperava edição');
    expect(v.cadernos.some((c) => c.caderno === 'sono')).toBe(false);
    expect(v.cadernos.map((c) => c.caderno)).toEqual(['movimento', 'coracao', 'rotina']);
  });

  it('todos silenciados: nenhum botão de imprimir, e nenhum aviso falso', () => {
    const v = vistaDaEdicao(estadoLido(), TODOS, AGG_VERSION, []);
    if (v.tipo !== 'edicao') throw new Error('esperava edição');
    expect(v.capa.escrever).toBe(false);
    expect(v.cadernos).toEqual([]);
    // `semCaderno` fala do PERÍODO, e o núcleo diz que os quatro têm o que dizer.
    expect(v.capa.semCaderno).toBe(false);
  });

  it('dessilenciar traz de volta o texto já impresso, sem reimprimir nada', () => {
    const calado = vistaDaEdicao(estadoLido({ edicao: COM_SONO_NA_FRENTE }), TODOS, AGG_VERSION, ['movimento', 'coracao', 'rotina']);
    const solto = vistaDaEdicao(estadoLido({ edicao: COM_SONO_NA_FRENTE }), TODOS, AGG_VERSION);
    if (calado.tipo !== 'edicao' || solto.tipo !== 'edicao') throw new Error('esperava edição');
    expect(calado.cadernos).not.toContainEqual(expect.objectContaining({ caderno: 'sono' }));
    expect(solto.cadernos[0]).toMatchObject({ caderno: 'sono', estado: 'pronta' });
    expect(solto.capa.manchete).toBe('A chamada de sono, inteira.');
  });

  it('sem lista, a vista é EXATAMENTE a de antes da story — ausente é "os quatro"', () => {
    const e = estadoLido({ edicao: COM_SONO_NA_FRENTE });
    expect(vistaDaEdicao(e, TODOS, AGG_VERSION)).toEqual(vistaDaEdicao(e, TODOS, AGG_VERSION, TODOS));
  });

  /** O par do teste acima, para a outra derivação: o padrão de `portaDe` é o mesmo. */
  it('sem lista, a porta é EXATAMENTE a de antes da story', () => {
    for (const e of [
      estadoLido({ edicao: COM_SONO_NA_FRENTE }),
      estadoLido(),
      estadoLido({ imprimindo: 'edicao' }),
      { fase: 'erro', mensagem: 'm' } as EstadoEdicao,
    ]) {
      expect(portaDe(e)).toEqual(portaDe(e, TODOS));
    }
  });

  /* ── o beco: miolo vazio por silêncio (P9) ─────────────────────────────── */

  it('tudo silenciado e algo impresso: o aviso diz de quem é a decisão e onde se desfaz', () => {
    const v = vistaDaEdicao(estadoLido({ edicao: COM_SONO_NA_FRENTE }), TODOS, AGG_VERSION, []);
    if (v.tipo !== 'edicao') throw new Error('esperava edição');
    expect(v.cadernos).toEqual([]);
    expect(v.capa.escrever).toBe(false);
    expect(v.avisoDoSilencio).toBe(AVISO_TUDO_SILENCIADO);
  });

  it('parte silenciada, e o que sobrou não tem o que dizer: o aviso parcial', () => {
    // Só sono tem dado, e sono está calado: movimento/coracao/rotina não aparecem.
    const v = vistaDaEdicao(estadoLido(), ['sono'], AGG_VERSION, ['movimento', 'coracao', 'rotina']);
    if (v.tipo !== 'edicao') throw new Error('esperava edição');
    expect(v.cadernos).toEqual([]);
    expect(v.capa.escrever).toBe(false);
    expect(v.avisoDoSilencio).toBe(AVISO_SILENCIO_PARCIAL);
  });

  it('sem silêncio, o miolo vazio NÃO ganha aviso — o convite está na capa', () => {
    const v = vistaDaEdicao(estadoLido(), TODOS, AGG_VERSION);
    if (v.tipo !== 'edicao') throw new Error('esperava edição');
    expect(v.cadernos).toEqual([]);
    expect(v.capa.escrever).toBe(true);
    expect(v.avisoDoSilencio).toBeNull();
  });

  it('com convite ou impressão correndo, o aviso cala — a tela já responde', () => {
    // Um silenciado, os outros com dado: a capa oferece "Escrever a edição".
    const comConvite = vistaDaEdicao(estadoLido(), TODOS, AGG_VERSION, ['movimento', 'coracao', 'rotina']);
    // Tudo calado, mas uma impressão corre: a capa já diz "Escrevendo a edição…".
    const correndo = vistaDaEdicao(estadoLido({ imprimindo: 'edicao' }), TODOS, AGG_VERSION, []);
    if (comConvite.tipo !== 'edicao' || correndo.tipo !== 'edicao') throw new Error('esperava edição');
    expect(comConvite.avisoDoSilencio).toBeNull();
    expect(correndo.avisoDoSilencio).toBeNull();
  });

  /* ── o que custa dinheiro ──────────────────────────────────────────────── */

  it('a impressão da edição pede só os cadernos abertos — 3 candidatos, não 4', async () => {
    mockPrefs.retroPrefs = { cadernosOcultos: { sono: '2026-09-23' } };
    await lidoCom([]);
    mockImpressao.resultado = { estado: 'nada-gravado', desfechos: [] };
    await useEdicaoStore.getState().imprimir(ENTRADA, true);
    expect(mockImpressao.chamadas).toBe(1);
    expect(mockImpressao.pedidos[0]).toEqual(['movimento', 'coracao', 'rotina']);
  });

  it('sem silêncio nenhum, a lista fica AUSENTE — ausente é "os quatro" (1.10)', async () => {
    await lidoCom([]);
    await useEdicaoStore.getState().imprimir(ENTRADA, true);
    expect(mockImpressao.pedidos[0]).toBeUndefined();
  });

  /**
   * `imprimirCom` lança `TypeError` com a lista vazia — ausente é "os quatro",
   * vazia é chamada errada. A guarda é `podeImprimir` com o `comDado` já filtrado:
   * a sequência nunca chega a ser chamada.
   */
  it('com os quatro silenciados, a sequência NUNCA é chamada', async () => {
    mockPrefs.retroPrefs = {
      cadernosOcultos: { sono: '2026-09-23', movimento: '2026-09-23', coracao: '2026-09-23', rotina: '2026-09-23' },
    };
    await lidoCom([]);
    await useEdicaoStore.getState().imprimir(ENTRADA, true);
    expect(mockImpressao.chamadas).toBe(0);
  });

  it('a preferência ainda não carregada não é silêncio: imprime os quatro', async () => {
    mockPrefs.retroPrefs = null;
    await lidoCom([]);
    await useEdicaoStore.getState().imprimir(ENTRADA, true);
    expect(mockImpressao.chamadas).toBe(1);
    expect(mockImpressao.pedidos[0]).toBeUndefined();
  });

  /**
   * Chamada direta da ação, sem passar por botão nenhum — que é o caminho que
   * sobra quando alguém liga uma tela nova. Os dois alvos de `imprimirCaderno`:
   * o caderno **sem linha** (primeira impressão) e o **já impresso**
   * (reimpressão). Silenciado, nenhum dos dois paga.
   */
  it('um caderno silenciado não imprime nem reimprime por chamada direta da ação', async () => {
    mockPrefs.retroPrefs = { cadernosOcultos: { sono: '2026-09-23' } };

    // (a) primeira impressão: sono sem linha, movimento impresso.
    await lidoCom([impresso('movimento', 1)]);
    await useEdicaoStore.getState().imprimirCaderno(ENTRADA, true, 'sono');
    expect({ caso: 'sem linha', chamadas: mockImpressao.chamadas }).toEqual({ caso: 'sem linha', chamadas: 0 });

    // (b) reimpressão: sono JÁ impresso — a fixture que o nome promete.
    useEdicaoStore.setState({ porPeriodo: {} });
    mockLeitura.chamadas = 0;
    await lidoCom([impresso('sono', 1), impresso('movimento', 2)]);
    await useEdicaoStore.getState().imprimirCaderno(ENTRADA, true, 'sono');
    expect({ caso: 'reimpressão', chamadas: mockImpressao.chamadas }).toEqual({ caso: 'reimpressão', chamadas: 0 });
  });

  /* ── a preferência crua, que só a ação vê (P1) ─────────────────────────── */

  /**
   * **O caminho que gasta dinheiro é o que não pode dispensar a resolução.**
   *
   * `settings.store` tem dois caminhos até `preferences`: `loadSettings` resolve, a
   * hidratação do boot não — ela põe no estado o que o `getJSON` devolveu do cache
   * local, gravado talvez por uma versão anterior do app. Com `{ sono: 42 }` cru, um
   * `!ocultos[id]` sem resolver lê `42` como silêncio; as telas, que resolvem, leem
   * como ruído e mostram Sono com o botão. A ação recusaria calada: botão morto.
   */
  it('jsonb cru do cache: a ação enxerga a MESMA lista que as telas', async () => {
    mockPrefs.cru = true;
    mockPrefs.retroPrefs = { cadernosOcultos: { sono: 42, movimento: '', coracao: '2026-09-23' } };
    await lidoCom([]);
    await useEdicaoStore.getState().imprimir(ENTRADA, true);

    // O que as telas veem, pela mesma porta que elas usam.
    const daTela = cadernosVisiveis(resolveRetroPrefs(mockPrefs.retroPrefs));
    expect(daTela).toEqual(['sono', 'movimento', 'rotina']);
    expect(mockImpressao.pedidos[0]).toEqual(daTela);
  });

  /** String vazia é o outro lado da P4: o guarda e o leitor têm que concordar. */
  it('carimbo vazio não silencia — nem para a ação, nem para as telas', async () => {
    mockPrefs.cru = true;
    mockPrefs.retroPrefs = { cadernosOcultos: { sono: '' } };
    await lidoCom([]);
    await useEdicaoStore.getState().imprimir(ENTRADA, true);
    // Nada silenciado ⇒ a lista fica ausente, que é "os quatro".
    expect(mockImpressao.pedidos[0]).toBeUndefined();
  });

  /* ── silenciar no meio de uma impressão (P11) ──────────────────────────── */

  /**
   * **Comportamento declarado, não acidente.** `visiveisAgora()` é um retrato
   * tirado no topo de `imprimirAlvo`; silenciar depois dele não cancela a
   * impressão em curso. O caderno continua sendo pago e gravado, e some da tela no
   * mesmo quadro — mas nada se perde: dessilenciar devolve o texto.
   *
   * O painel não trava durante uma impressão, e é este teste que prende a escolha:
   * se um dia ela virar travamento, ele reprova e a decisão volta à mesa.
   */
  it('silenciar no meio da impressão não tira o caderno da corrida já paga', async () => {
    await lidoCom([]);
    const { pausa, soltar } = segurar();
    // A releitura "antes de pagar" fica presa; os candidatos saem depois dela.
    mockLeitura.pausas[1] = pausa;
    mockLeitura.respostas = [{ estado: 'ok', edicao: [] }];

    const corrida = useEdicaoStore.getState().imprimir(ENTRADA, true);
    await drenar();
    // O dono silencia AGORA, com a impressão já marcada.
    mockPrefs.retroPrefs = { cadernosOcultos: { sono: '2026-09-23' } };
    soltar();
    await corrida;

    // O retrato valia: a lista ficou ausente (os quatro), sono incluído.
    expect(mockImpressao.chamadas).toBe(1);
    expect(mockImpressao.pedidos[0]).toBeUndefined();
  });
});

describe('podeImprimir — a regra que as ações conferem e que decide os botões', () => {
  it('a edição inteira', () => {
    expect(podeImprimir(estadoLido(), TODOS, 'edicao')).toBe(true);
    // Sem resposta do núcleo (dados não prontos), não.
    expect(podeImprimir(estadoLido(), null, 'edicao')).toBe(false);
    // Nenhum caderno com o que dizer, não.
    expect(podeImprimir(estadoLido(), [], 'edicao')).toBe(false);
    expect(podeImprimir(estadoLido({ imprimindo: 'sono' }), TODOS, 'edicao')).toBe(false);
    expect(podeImprimir(estadoLido({ edicao: [impresso('sono', 1)] }), TODOS, 'edicao')).toBe(false);
    for (const e of [undefined, { fase: 'carregando' }, { fase: 'relendo' }, { fase: 'ausente' }, { fase: 'sem-sessao' },
      { fase: 'erro', mensagem: 'x' }] as (EstadoEdicao | undefined)[]) {
      expect({ e, pode: podeImprimir(e, TODOS, 'edicao') }).toEqual({ e, pode: false });
    }
  });

  it('um caderno', () => {
    const e = estadoLido({ edicao: [impresso('movimento', 1)], sessao: { rotina: { fase: 'mudo' } } });
    expect(podeImprimir(e, TODOS, 'coracao')).toBe(true);
    expect(podeImprimir(e, TODOS, 'movimento')).toBe(false);
    expect(podeImprimir(e, TODOS, 'rotina')).toBe(false);
    expect(podeImprimir(e, null, 'coracao')).toBe(false);
    // Sem dado, não.
    expect(podeImprimir(e, ['sono', 'movimento'], 'coracao')).toBe(false);
    expect(podeImprimir({ ...e, imprimindo: 'sono' }, TODOS, 'coracao')).toBe(false);
  });

  /** A vista não tem regra própria: todo botão que ela desenha, a ação aceita. */
  it('todo botão da vista é uma impressão que podeImprimir aceita, e vice-versa', () => {
    const estados: Lida[] = [
      estadoLido(),
      estadoLido({ sessao: { sono: { fase: 'erro', motivo: TRANSITORIA }, rotina: { fase: 'mudo' } } }),
      estadoLido({ edicao: [impresso('movimento', 1)], sessao: { coracao: { fase: 'reprovada', motivo: REPROVADA, problemas: [] } } }),
      estadoLido({ edicao: [impresso('movimento', 1)], imprimindo: 'coracao' }),
    ];
    const respostas: (readonly CadernoId[] | null)[] = [null, [], ['movimento'], ['sono', 'coracao'], TODOS];
    for (const e of estados) {
      for (const comDado of respostas) {
        const v = vistaDaEdicao(e, comDado, AGG_VERSION);
        if (v.tipo !== 'edicao') throw new Error(v.tipo);
        expect(v.capa.escrever).toBe(podeImprimir(e, comDado, 'edicao'));
        for (const caderno of TODOS) {
          const naVista = v.cadernos.find((c) => c.caderno === caderno);
          const temBotao = naVista !== undefined && 'acao' in naVista && naVista.acao !== undefined;
          if (temBotao) expect({ caderno, pode: podeImprimir(e, comDado, caderno) }).toEqual({ caderno, pode: true });
          if (naVista !== undefined && naVista.estado !== 'pronta' && podeImprimir(e, comDado, caderno)) {
            expect({ caderno, temBotao }).toEqual({ caderno, temBotao: true });
          }
        }
      }
    }
  });
});

describe('precisaGarantirJanela — o efeito que pede a janela da Retrospectiva', () => {
  const since = '2026-06-01';

  it('com a janela carregada e cobrindo o período, não', () => {
    expect(precisaGarantirJanela({ loaded: true, loading: false, loadedSince: '2026-05-01' }, since)).toBe(false);
    expect(precisaGarantirJanela({ loaded: true, loading: false, loadedSince: since }, since)).toBe(false);
  });

  it('com uma busca em voo, não — é o fim dela que chama de novo', () => {
    expect(precisaGarantirJanela({ loaded: false, loading: true, loadedSince: null }, since)).toBe(false);
    expect(precisaGarantirJanela({ loaded: true, loading: true, loadedSince: '2026-08-01' }, since)).toBe(false);
  });

  /**
   * O caso do defeito: a busca em voo era de uma janela mais estreita. Quando ela
   * termina (`loading` volta a falso), a janela ainda não cobre o período — e a
   * resposta muda para "precisa", o que dispara o efeito.
   */
  it('a busca estreita terminou sem cobrir o período: precisa', () => {
    expect(precisaGarantirJanela({ loaded: true, loading: false, loadedSince: '2026-08-01' }, since)).toBe(true);
  });

  it('nada carregado ainda: precisa', () => {
    expect(precisaGarantirJanela({ loaded: false, loading: false, loadedSince: null }, since)).toBe(true);
  });

  /**
   * O freio do laço quente: a busca falhou, `loading` voltou a falso e a janela
   * segue descoberta — as duas condições que dariam "precisa". Se a resposta fosse
   * sim, o efeito pediria de novo no mesmo quadro, e de novo, enquanto a rede
   * estivesse fora. Quem tenta outra vez é o foco da tela, que chama `ensure` direto.
   */
  it('a janela que falhou não é pedida de novo sozinha', () => {
    expect(precisaGarantirJanela({ loaded: false, loading: false, loadedSince: null, falhouEm: since }, since)).toBe(false);
    expect(precisaGarantirJanela({ loaded: true, loading: false, loadedSince: '2026-08-01', falhouEm: since }, since)).toBe(false);
  });

  it('a falha é de uma janela, não da store: outro período segue pedindo', () => {
    expect(precisaGarantirJanela({ loaded: false, loading: false, loadedSince: null, falhouEm: '2026-01-01' }, since)).toBe(true);
  });
});

describe('dadosProntosParaImprimir', () => {
  const PRONTA = { loaded: true, loading: false, loadedSince: '2026-05-01' };
  const ATIVIDADES = { loaded: true, loading: false };

  it('só com a retro carregada, parada, cobrindo o período, e as atividades idem', () => {
    const since = '2026-06-01';
    expect(dadosProntosParaImprimir(PRONTA, ATIVIDADES, since)).toBe(true);
    expect(dadosProntosParaImprimir({ ...PRONTA, loadedSince: since }, ATIVIDADES, since)).toBe(true);
    expect(dadosProntosParaImprimir({ ...PRONTA, loaded: false }, ATIVIDADES, since)).toBe(false);
    expect(dadosProntosParaImprimir({ ...PRONTA, loading: true }, ATIVIDADES, since)).toBe(false);
    expect(dadosProntosParaImprimir({ ...PRONTA, loadedSince: null }, ATIVIDADES, since)).toBe(false);
    expect(dadosProntosParaImprimir({ ...PRONTA, loadedSince: '2026-07-01' }, ATIVIDADES, since)).toBe(false);
    expect(dadosProntosParaImprimir(PRONTA, { ...ATIVIDADES, loaded: false }, since)).toBe(false);
    expect(dadosProntosParaImprimir(PRONTA, { ...ATIVIDADES, loading: true }, since)).toBe(false);
  });
});

/* ── os remendos da revisão da 1.11 ──────────────────────────────────────── */

describe('a leitura lenta não sobrescreve a edição que a impressão acabou de gravar', () => {
  /**
   * A ordem exata: (1) o foco dispara uma leitura silenciosa, e ela é lenta; (2) o
   * dono imprime, a impressão termina e a releitura final grava a edição; (3) a
   * leitura lenta volta com a lista vazia de antes. Sem a geração, a rota voltava a
   * dizer "ainda não foi escrito", com o botão.
   */
  it('a resposta que chega depois de a impressão terminar é descartada', async () => {
    await lidoCom([]);                                                   // chamada 1
    const lenta = segurar();
    mockLeitura.pausas = [null, lenta.pausa];
    mockLeitura.respostas = [
      { estado: 'ok', edicao: [] },                                      // 2: a lenta (velha)
      { estado: 'ok', edicao: [] },                                      // 3: antes de pagar
      { estado: 'ok', edicao: [impresso('movimento', 1)] },              // 4: a releitura final
    ];
    const foco = useEdicaoStore.getState().carregar(ENTRADA);
    await drenar();
    mockImpressao.avisos = [{ tipo: 'ler', caderno: 'movimento', desfecho: escrito('a') }];
    mockImpressao.resultado = { estado: 'gravada', edicao: [], desfechos: [] };
    await useEdicaoStore.getState().imprimir(ENTRADA, true);
    expect(lida().edicao.map((c) => c.caderno)).toEqual(['movimento']);
    expect(lida().imprimindo).toBeNull();

    lenta.soltar();
    await foco;
    expect(mockLeitura.chamadas).toBe(4);
    expect(lida().edicao.map((c) => c.caderno)).toEqual(['movimento']);
    const v = vistaDaEdicao(naTela(), TODOS, AGG_VERSION);
    expect(v.tipo === 'edicao' && v.capa.impressa).toBe(true);
  });

  it('e a falha da leitura lenta também não troca a edição impressa por erro', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    await lidoCom([]);
    const lenta = segurar();
    mockLeitura.pausas = [null, lenta.pausa];
    mockLeitura.respostas = [new Error('rede lenta'), { estado: 'ok', edicao: [] }, { estado: 'ok', edicao: [impresso('sono', 1)] }];
    const foco = useEdicaoStore.getState().carregar(ENTRADA);
    await drenar();
    await useEdicaoStore.getState().imprimir(ENTRADA, true);
    lenta.soltar();
    await foco;
    expect(lida().edicao.map((c) => c.caderno)).toEqual(['sono']);
    warn.mockRestore();
  });
});

describe('a falha na reimpressão de um caderno é do caderno', () => {
  const MISTO = [impresso('movimento', 1), impresso('rotina', 2)];
  const SESSAO_ANTES: SessaoDaEdicao = { coracao: { fase: 'reprovada', motivo: REPROVADA, problemas: ['"186" não está no pacote'] } };

  async function comCoracaoReprovado(): Promise<void> {
    await lidoCom(MISTO.slice());
    const chave = chaveDe('u-1', ENTRADA);
    useEdicaoStore.setState((s) => ({
      porPeriodo: { ...s.porPeriodo, [chave]: { ...(s.porPeriodo[chave] as Lida), sessao: SESSAO_ANTES } },
    }));
  }

  it('a releitura antes de pagar falha: a edição fica, e o Coração vai para o erro passageiro', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    await comCoracaoReprovado();
    mockLeitura.respostas = [new Error('rede')];
    await useEdicaoStore.getState().imprimirCaderno(ENTRADA, true, 'coracao');
    expect(mockImpressao.chamadas).toBe(0);
    const e = lida();
    expect(e.edicao).toEqual(MISTO);
    expect(e.imprimindo).toBeNull();
    expect(e.sessao).toEqual({
      coracao: { fase: 'erro', motivo: 'O caderno não foi escrito: não foi possível ler a edição agora.' },
    });
    const v = vistaDaEdicao(e, TODOS, AGG_VERSION);
    if (v.tipo !== 'edicao') throw new Error(v.tipo);
    expect(v.cadernos.map((c) => [c.caderno, c.estado])).toEqual([
      ['movimento', 'pronta'], ['rotina', 'pronta'], ['sono', 'nao-escrito'], ['coracao', 'erro'],
    ]);
    expect(v.cadernos.find((c) => c.caderno === 'coracao')).toMatchObject({ acao: 'tentar-de-novo' });
    warn.mockRestore();
  });

  it('a sequência lança: a edição fica, e o motivo não promete escrita', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    await comCoracaoReprovado();
    mockLeitura.respostas = [{ estado: 'ok', edicao: MISTO }];
    mockImpressao.avisos = [{ tipo: 'ler', caderno: 'coracao', desfecho: escrito('O coração.') }];
    mockImpressao.erro = new Error('linha recusada');
    await useEdicaoStore.getState().imprimirCaderno(ENTRADA, true, 'coracao');
    const e = lida();
    expect(e.edicao).toEqual(MISTO);
    expect(e.imprimindo).toBeNull();
    expect(e.sessao).toEqual({
      coracao: { fase: 'erro', motivo: 'A impressão deste caderno não terminou. Ele pode ter ficado gravado.' },
    });
    warn.mockRestore();
  });

  it('o estado inesperado da sequência também fica no caderno', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    await comCoracaoReprovado();
    mockLeitura.respostas = [{ estado: 'ok', edicao: MISTO }];
    mockImpressao.resultado = { estado: 'estranho' };
    await useEdicaoStore.getState().imprimirCaderno(ENTRADA, true, 'coracao');
    expect(lida()).toMatchObject({ edicao: MISTO, imprimindo: null, sessao: { coracao: { fase: 'erro' } } });
    warn.mockRestore();
  });

  it('a releitura do fim falha depois de o caderno escrever: a edição fica, e ele pode ter ficado gravado', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    await comCoracaoReprovado();
    mockLeitura.respostas = [{ estado: 'ok', edicao: MISTO }, new Error('rede')];
    mockImpressao.avisos = [{ tipo: 'ler', caderno: 'coracao', desfecho: escrito('O coração.') }];
    mockImpressao.resultado = { estado: 'gravada', edicao: [], desfechos: [] };
    await useEdicaoStore.getState().imprimirCaderno(ENTRADA, true, 'coracao');
    const e = lida();
    expect(e.edicao).toEqual(MISTO);
    expect(e.imprimindo).toBeNull();
    expect(e.sessao).toEqual({
      coracao: { fase: 'erro', motivo: 'Não foi possível ler a edição depois da impressão. O caderno pode ter ficado gravado.' },
    });
    // "Tentar de novo" relê antes de pagar: se ele ficou gravado, aparece sem custo.
    mockLeitura.respostas = [{ estado: 'ok', edicao: [...MISTO, impresso('coracao', 3)] }];
    await useEdicaoStore.getState().imprimirCaderno(ENTRADA, true, 'coracao');
    expect(mockImpressao.chamadas).toBe(1);
    expect(lida().edicao.map((c) => c.caderno)).toEqual(['movimento', 'rotina', 'coracao']);
    warn.mockRestore();
  });

  it('a releitura do fim falha depois de o caderno reprovar: a reprovação, que é verdade, fica', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    await comCoracaoReprovado();
    mockLeitura.respostas = [{ estado: 'ok', edicao: MISTO }, new Error('rede')];
    mockImpressao.avisos = [{ tipo: 'ler', caderno: 'coracao', desfecho: piso('guarda') }];
    await useEdicaoStore.getState().imprimirCaderno(ENTRADA, true, 'coracao');
    expect(lida()).toMatchObject({
      edicao: MISTO, imprimindo: null,
      sessao: { coracao: { fase: 'reprovada', motivo: 'O caderno não foi escrito: a proteção da nuvem bloqueou o pedido.' } },
    });
    warn.mockRestore();
  });

  it('a releitura silenciosa sobre uma edição lida que falha deixa a capa como está', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    await lidoCom([]);
    const antes = naTela();
    mockLeitura.respostas = [new Error('rede')];
    await useEdicaoStore.getState().carregar(ENTRADA);
    expect(mockLeitura.chamadas).toBe(2);
    expect(naTela()).toEqual(antes);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('a edição inteira continua indo para o erro da edição', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    await lidoCom([]);
    mockLeitura.respostas = [new Error('rede')];
    await useEdicaoStore.getState().imprimir(ENTRADA, true);
    expect(naTela().fase).toBe('erro');
    warn.mockRestore();
  });
});

describe('a ação confere quem tem dado, como o botão', () => {
  it('o caderno sem dado não imprime pela ação', async () => {
    await lidoCom([impresso('movimento', 1)]);
    mockComDado.valor = ['movimento', 'rotina'];
    await useEdicaoStore.getState().imprimirCaderno(ENTRADA, true, 'coracao');
    expect(mockImpressao.chamadas).toBe(0);
    expect(mockLeitura.chamadas).toBe(1);
    expect(lida().imprimindo).toBeNull();
  });

  it('a edição sem nenhum caderno com dado também não', async () => {
    await lidoCom([]);
    mockComDado.valor = [];
    await useEdicaoStore.getState().imprimir(ENTRADA, true);
    expect(mockImpressao.chamadas).toBe(0);
    expect(mockLeitura.chamadas).toBe(1);
  });

  it('com dado, imprime', async () => {
    await lidoCom([impresso('movimento', 1)]);
    mockComDado.valor = ['movimento', 'coracao'];
    mockLeitura.respostas = [{ estado: 'ok', edicao: [impresso('movimento', 1)] }];
    await useEdicaoStore.getState().imprimirCaderno(ENTRADA, true, 'coracao');
    expect(mockImpressao.pedidos).toEqual([['coracao']]);
  });
});

describe('a capa com a impressão correndo', () => {
  it('nada impresso e a edição escrevendo: "Escrevendo a edição…", sem convite nem botão', () => {
    const v = vistaDaEdicao(estadoLido({ imprimindo: 'edicao' }), TODOS, AGG_VERSION);
    expect(v).toMatchObject({ tipo: 'edicao', capa: { escrevendo: true, escrever: false, semCaderno: false } });
  });

  it('nada impresso e um caderno sendo tentado de novo: a mesma frase, como a porta', () => {
    const v = vistaDaEdicao(estadoLido({ imprimindo: 'sono', sessao: { sono: { fase: 'escrevendo' } } }), TODOS, AGG_VERSION);
    expect(v).toMatchObject({ capa: { escrevendo: true, escrever: false } });
    expect(portaDe(estadoLido({ imprimindo: 'sono' }))).toEqual({ tipo: 'escrevendo' });
  });

  it('com algo impresso, a capa é a manchete — não diz que está escrevendo', () => {
    const v = vistaDaEdicao(estadoLido({ edicao: [impresso('movimento', 1)], imprimindo: 'sono' }), TODOS, AGG_VERSION);
    expect(v).toMatchObject({ capa: { impressa: true, escrevendo: false } });
  });
});

/* ── a capa carimbada (Story 1.13) ───────────────────────────────────────── */

/** A capa como o banco a devolve, já mapeada por `toCapa`. */
const CAPA_DE_AGOSTO = {
  tipoPeriodo: 'month', inicio: '2026-08-01', fim: '2026-08-31',
  natureza: 'foto' as const,
  fotoId: 'f-1', fotoTakenAt: '2026-08-14T12:38:00.000Z', rotaActivityId: null,
  legenda: 'Ittre \u00b7 km 31,1 \u00b7 12:38',
  carimbadaEm: '2026-09-01T00:00:00.000Z',
  motivo: 'rajada' as const,
  fotoActivityId: 'a-1',
};

describe('a capa carimbada chega à vista', () => {
  it('a leitura traz a capa do banco, e a vista a passa inteira', async () => {
    mockLeitura.respostas = [{ estado: 'ok', edicao: [impresso('movimento', 1)], capa: CAPA_DE_AGOSTO }];
    await useEdicaoStore.getState().carregar(ENTRADA);
    const v = vistaDaEdicao(naTela(), TODOS, AGG_VERSION);
    expect(v.tipo === 'edicao' && v.capa.carimbada).toEqual(CAPA_DE_AGOSTO);
  });

  /** Edição impressa antes da 1.13, ou carimbo que falhou: a rota cai no papel. */
  it('sem capa gravada, a vista diz nulo — e não inventa uma', async () => {
    await lidoCom([impresso('movimento', 1)]);
    const v = vistaDaEdicao(naTela(), TODOS, AGG_VERSION);
    expect(v.tipo === 'edicao' && v.capa.carimbada).toBeNull();
  });
});

/**
 * **A decisão "foto ou papel" mora aqui, e não na tela.** Ela nasceu no componente
 * e voltou para a vista porque é regra: são as mesmas condições da matriz, e fora
 * daqui ficavam sem teste. O que a tela ainda decide é só o que a vista não pode
 * saber — se o arquivo da biblioteca resolveu.
 */
describe('vistaDaEdicao — foto ou papel, e a legenda', () => {
  const comCapa = (capa: unknown, edicao = [impresso('movimento', 1)]) =>
    vistaDaEdicao(estadoLido({ edicao, capa: capa as never }), TODOS, AGG_VERSION);

  /** Uma capa carimbada sem foto: a `tracado` (com ponteiro) ou a `grade`. */
  const semFoto = (natureza: 'tracado' | 'grade', legenda: string) => ({
    ...CAPA_DE_AGOSTO, natureza, fotoId: null, fotoTakenAt: null, motivo: 'sem-foto', fotoActivityId: null,
    rotaActivityId: natureza === 'tracado' ? 'a-1' : null,
    legenda,
  });

  const daCapa = (v: ReturnType<typeof vistaDaEdicao>) => {
    if (v.tipo !== 'edicao') throw new Error(v.tipo);
    return { comFoto: v.capa.comFoto, natureza: v.capa.natureza, legenda: v.capa.legenda };
  };

  it('capa de foto sobre edição impressa: desenha foto, com a legenda carimbada', () => {
    expect(daCapa(comCapa(CAPA_DE_AGOSTO))).toEqual({
      comFoto: true, natureza: 'foto', legenda: CAPA_DE_AGOSTO.legenda,
    });
  });

  /**
   * `edicoes_capa` não tem chave estrangeira para `edicoes_ia` — o carimbo guarda
   * valor, não ponteiro —, então uma capa sobrevive aos cadernos que cobria (é
   * assim que a edição se reimprime por inteiro: apagando as linhas). Desenhar a
   * foto ali esconderia o convite e o botão: o dono ficaria sem caminho para
   * escrever, olhando uma capa bonita.
   */
  it('capa carimbada sobre edição SEM caderno impresso: papel, e o botão continua lá', () => {
    const v = comCapa(CAPA_DE_AGOSTO, []);
    expect(daCapa(v)).toEqual({ comFoto: false, natureza: null, legenda: null });
    expect(v.tipo === 'edicao' && v.capa.escrever).toBe(true);
  });

  /**
   * **Desenhadas desde a 2.4a**, e não mais só carimbadas: a vista entrega a
   * natureza, e é ela que faz a rota escolher o desenhista. A legenda também passa
   * a chegar — na `tracado` ela legenda o desenho que agora existe; na `grade` ela
   * é o rótulo do período, repetido no pé como carimbo de medida.
   *
   * `comFoto` continua falso nas duas: a capa de foto tem outro caminho, com véu
   * medido e imagem da biblioteca.
   */
  it('capa de traçado e de grade: natureza e legenda chegam à vista, sem virar foto', () => {
    expect(daCapa(comCapa(semFoto('tracado', 'Ittre \u00b7 km 62,4')))).toEqual({
      comFoto: false, natureza: 'tracado', legenda: 'Ittre \u00b7 km 62,4',
    });
    // A `grade` é a exceção: `escolherCapa` carimba o rótulo do período como
    // legenda dela (o CHECK do banco recusa vazio), e a capa já o imprime em
    // serifada logo acima. Repetir escreveria "Agosto de 2026" duas vezes na
    // mesma tela, e o VoiceOver leria duas. O carimbo fica intacto em
    // `carimbada`; o que some é a repetição.
    expect(daCapa(comCapa(semFoto('grade', 'Agosto de 2026')))).toEqual({
      comFoto: false, natureza: 'grade', legenda: null,
    });
  });

  it('a supressão é por TEXTO, não por natureza: legenda diferente do período fica', () => {
    // A rede `comRede` de `escolherCapa` põe o rótulo do período em QUALQUER
    // natureza cuja legenda saia vazia — inclusive na `tracado`. Comparar por
    // natureza deixaria o mesmo defeito voltar pela porta de trás.
    expect(daCapa(comCapa(semFoto('tracado', 'Agosto de 2026'))).legenda).toBeNull();
    expect(daCapa(comCapa(semFoto('grade', 'Ittre \u00b7 km 62,4'))).legenda)
      .toBe('Ittre \u00b7 km 62,4');
  });

  /**
   * A guarda de `comFoto` vale também para a natureza: sem caderno impresso não há
   * desenho, senão a rota pintaria uma capa bonita por cima do convite e do botão.
   */
  it('capa de traçado sobre edição SEM caderno impresso: nem desenho, nem legenda', () => {
    expect(daCapa(comCapa({
      ...CAPA_DE_AGOSTO, natureza: 'tracado', fotoId: null, fotoTakenAt: null,
      motivo: 'sem-foto', fotoActivityId: null, rotaActivityId: 'a-1',
      legenda: 'Ittre \u00b7 km 62,4',
    }, []))).toEqual({ comFoto: false, natureza: null, legenda: null });
  });

  it('edição impressa antes da 1.13, sem capa nenhuma: papel', () => {
    expect(daCapa(comCapa(null))).toEqual({ comFoto: false, natureza: null, legenda: null });
  });
});

describe('quem carimba a capa', () => {
  it('a impressão INTEIRA que gravou carimba, uma vez', async () => {
    await lidoCom([]);
    mockImpressao.resultado = { estado: 'gravada', edicao: [impresso('movimento', 1)], desfechos: [] };
    await useEdicaoStore.getState().imprimir(ENTRADA, true);
    expect(mockCarimbo.chamadas).toBe(1);
  });

  /**
   * **Antes da releitura do fim**, e é a fita que prende isso: com o carimbo
   * depois — ou sem o `await` —, a rota mostraria a edição recém-impressa com a
   * capa da impressão anterior até o próximo foco, e todo o resto continuaria verde.
   */
  it('carimba ANTES de reler o banco', async () => {
    await lidoCom([]);
    mockImpressao.resultado = { estado: 'gravada', edicao: [impresso('movimento', 1)], desfechos: [] };
    mockFita.length = 0;
    await useEdicaoStore.getState().imprimir(ENTRADA, true);
    // A impressão relê antes de pagar, carimba, e só então relê o fim.
    expect(mockFita).toEqual(['leitura', 'carimbo', 'leitura']);
  });

  /**
   * A foto e a legenda são do PERÍODO, não do caderno: reimprimir um caderno não
   * pode trocar a capa que o dono já viu. O que uma parcial move é só a manchete,
   * que continua derivada do caderno em `posicao` 1.
   */
  it('a reimpressão de UM caderno NÃO toca capa existente', async () => {
    mockLeitura.respostas = [{ estado: 'ok', edicao: [impresso('movimento', 1)], capa: CAPA_DE_AGOSTO }];
    await useEdicaoStore.getState().carregar(ENTRADA);
    mockImpressao.resultado = { estado: 'gravada', edicao: [], desfechos: [] };
    await useEdicaoStore.getState().imprimirCaderno(ENTRADA, true, 'sono');
    expect(mockImpressao.chamadas).toBe(1);
    expect(mockCarimbo.chamadas).toBe(0);
  });

  /**
   * Regra renegociada com o dono em 17/09, depois da revisão: quem monta a edição
   * caderno a caderno **nunca volta a ver** o alvo `edicao` — a 1.11 só o oferece
   * com zero cadernos impressos —, então sem isto a edição ficaria em papel para
   * sempre, sem conserto possível pela tela.
   */
  it('a reimpressão de um caderno SEM capa nenhuma carimba', async () => {
    await lidoCom([impresso('movimento', 1)]);
    expect(lida().capa).toBeNull();
    mockImpressao.resultado = { estado: 'gravada', edicao: [], desfechos: [] };
    await useEdicaoStore.getState().imprimirCaderno(ENTRADA, true, 'sono');
    expect(mockCarimbo.chamadas).toBe(1);
  });

  it('impressão que não gravou nada não carimba: não há edição a que a capa pertença', async () => {
    await lidoCom([]);
    mockImpressao.resultado = { estado: 'nada-gravado', desfechos: [] };
    await useEdicaoStore.getState().imprimir(ENTRADA, true);
    expect(mockCarimbo.chamadas).toBe(0);
  });

  /**
   * O preço declarado da escolha de 17/09: o carimbo não é atômico com a
   * impressão. Se ele falha, a edição fica sem capa — nunca sem texto, e nunca
   * com o dono lendo "a impressão não terminou" sobre um texto que ficou gravado.
   */
  it('carimbo que falha não derruba a impressão nem apaga texto', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    await lidoCom([]);
    mockCarimbo.erro = new Error('rls');
    const depois = [impresso('movimento', 1)];
    mockImpressao.resultado = { estado: 'gravada', edicao: depois, desfechos: [] };
    mockLeitura.respostas = [{ estado: 'ok', edicao: [] }, { estado: 'ok', edicao: depois }];
    await useEdicaoStore.getState().imprimir(ENTRADA, true);
    expect(naTela().fase).toBe('lida');
    expect(lida().edicao.map((c) => c.caderno)).toEqual(['movimento']);
    expect(lida().capa).toBeNull();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  /**
   * A leitura da capa degrada para `null` de propósito (`buscarEdicao`), e a
   * releitura do fim é a mais provável de pegar uma rede ruim — logo depois de uma
   * impressão que durou um minuto. Sem a reserva, a edição recém-impressa
   * apareceria em papel apesar de a capa estar gravada.
   */
  it('releitura que não trouxe a capa usa a recém-carimbada como reserva', async () => {
    await lidoCom([]);
    mockCarimbo.capa = CAPA_DE_AGOSTO;
    const depois = [impresso('movimento', 1)];
    mockImpressao.resultado = { estado: 'gravada', edicao: depois, desfechos: [] };
    // A releitura do fim volta com a edição e SEM a capa.
    mockLeitura.respostas = [{ estado: 'ok', edicao: [] }, { estado: 'ok', edicao: depois, capa: null }];
    await useEdicaoStore.getState().imprimir(ENTRADA, true);
    expect(lida().capa).toEqual(CAPA_DE_AGOSTO);
  });

  it('a capa que a releitura trouxe vence a recém-carimbada', async () => {
    await lidoCom([]);
    mockCarimbo.capa = { ...CAPA_DE_AGOSTO, legenda: 'a do carimbo' };
    const depois = [impresso('movimento', 1)];
    mockImpressao.resultado = { estado: 'gravada', edicao: depois, desfechos: [] };
    mockLeitura.respostas = [
      { estado: 'ok', edicao: [] },
      { estado: 'ok', edicao: depois, capa: { ...CAPA_DE_AGOSTO, legenda: 'a do banco' } },
    ];
    await useEdicaoStore.getState().imprimir(ENTRADA, true);
    expect(lida().capa?.legenda).toBe('a do banco');
  });
});

describe('a assinatura sem data', () => {
  it('só o modelo, sem o ponto pendurado', () => {
    const v = vistaDaEdicao(estadoLido({ edicao: [impresso('movimento', 1, { geradoEm: 'não é data' })] }), TODOS, AGG_VERSION);
    if (v.tipo !== 'edicao') throw new Error(v.tipo);
    expect(v.cadernos[0]).toMatchObject({ estado: 'pronta', assinatura: 'modelo-1' });
  });
});

describe('o toque de reler com uma leitura silenciosa em voo', () => {
  it('a fase passa a `relendo` na hora, e a leitura em voo resolve para ela', async () => {
    await lidoCom([]);
    const lenta = segurar();
    mockLeitura.pausas = [null, lenta.pausa];
    mockLeitura.respostas = [{ estado: 'ok', edicao: [impresso('sono', 1)] }];
    const foco = useEdicaoStore.getState().carregar(ENTRADA);
    await drenar();
    expect(naTela().fase).toBe('lida');
    await useEdicaoStore.getState().recarregar(ENTRADA);
    expect(naTela()).toEqual({ fase: 'relendo' });
    lenta.soltar();
    await foco;
    // Uma leitura só, e o toque teve a resposta dela.
    expect(mockLeitura.chamadas).toBe(2);
    expect(lida().edicao.map((c) => c.caderno)).toEqual(['sono']);
  });

  it('e se ela falha, o toque recebe o erro — não o silêncio da releitura do foco', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    await lidoCom([]);
    const lenta = segurar();
    mockLeitura.pausas = [null, lenta.pausa];
    mockLeitura.respostas = [new Error('rede')];
    const foco = useEdicaoStore.getState().carregar(ENTRADA);
    await drenar();
    await useEdicaoStore.getState().recarregar(ENTRADA);
    lenta.soltar();
    await foco;
    expect(naTela()).toMatchObject({ fase: 'erro', mensagem: 'Não foi possível ler a edição agora.' });
    warn.mockRestore();
  });
});

/* ── a troca da capa (Story 1.16) ────────────────────────────────────────── */

/** A foto que o dono escolheu no seletor — a forma basta; quem a confere é a porta. */
const FOTO_ESCOLHIDA = { id: 'p-9', activityId: 'a-1' } as unknown as Parameters<
  ReturnType<typeof useEdicaoStore.getState>['trocarCapa']
>[1];

/** A capa que a porta devolve depois de recarimbar. */
const CAPA_TROCADA = {
  ...CAPA_DE_AGOSTO,
  fotoId: 'p-9', fotoTakenAt: '2026-08-14T15:22:00.000Z',
  legenda: 'Ittre · km 62,4 · 15:22',
  carimbadaEm: '2026-09-18T10:00:00.000Z',
  motivo: 'trocada' as const,
};

/** Agosto impresso, com a capa de foto (`CAPA_DE_AGOSTO`) — o estado em que a ficha abre. */
async function impressaComCapaDeFoto(): Promise<void> {
  mockLeitura.respostas = [{
    estado: 'ok', edicao: [impresso('movimento', 1), impresso('sono', 2)], capa: CAPA_DE_AGOSTO,
  }];
  await useEdicaoStore.getState().carregar(ENTRADA);
  expect(lida().capa).toEqual(CAPA_DE_AGOSTO);
}

describe('podeTrocarCapa — a regra que a ação confere', () => {
  const comFoto = { edicao: [impresso('movimento', 1)], capa: CAPA_DE_AGOSTO as never };

  it('edição impressa, capa de foto, nenhuma impressão correndo: pode', () => {
    expect(podeTrocarCapa(estadoLido(comFoto))).toBe(true);
  });

  it('com uma impressão correndo, não', () => {
    expect(podeTrocarCapa(estadoLido({ ...comFoto, imprimindo: 'sono' }))).toBe(false);
  });

  /** A linha "Capa tracado/grade" da matriz: não há foto a trocar. */
  it('capa de traçado, de grade, ou nenhuma: não', () => {
    for (const natureza of ['tracado', 'grade'] as const) {
      expect(podeTrocarCapa(estadoLido({ ...comFoto, capa: { ...CAPA_DE_AGOSTO, natureza } as never }))).toBe(false);
    }
    expect(podeTrocarCapa(estadoLido({ ...comFoto, capa: null }))).toBe(false);
  });

  it('edição sem caderno impresso: não — a capa sobreviveu aos cadernos, e a ficha não abre', () => {
    expect(podeTrocarCapa(estadoLido({ ...comFoto, edicao: [] }))).toBe(false);
  });

  it('fora da fase lida: não', () => {
    for (const e of [{ fase: 'carregando' }, { fase: 'relendo' }, { fase: 'ausente' }, { fase: 'sem-sessao' }] as const) {
      expect(podeTrocarCapa(e)).toBe(false);
    }
    expect(podeTrocarCapa(undefined)).toBe(false);
  });
});

describe('trocarCapa — recarimba a capa e só', () => {
  /**
   * O critério de aceite: a capa passa a ser a nova, e o texto, a ordem e as
   * assinaturas continuam **idênticos**. A comparação é da edição inteira, objeto
   * a objeto — não do comprimento.
   */
  it('sucesso: a capa nova entra, e a edição e a sessão ficam idênticas', async () => {
    await impressaComCapaDeFoto();
    const antes = lida();
    mockTroca.capa = CAPA_TROCADA;
    const r = await useEdicaoStore.getState().trocarCapa(ENTRADA, FOTO_ESCOLHIDA);
    expect(r).toEqual({ ok: true, capa: CAPA_TROCADA });
    expect(mockTroca.fotos).toEqual([FOTO_ESCOLHIDA]);
    const depois = lida();
    expect(depois.capa).toEqual(CAPA_TROCADA);
    expect(depois.edicao).toBe(antes.edicao);
    expect(depois.sessao).toBe(antes.sessao);
    expect(depois.imprimindo).toBeNull();
    // Nada foi relido nem impresso: a troca não passa pela edição.
    expect(mockLeitura.chamadas).toBe(1);
    expect(mockImpressao.chamadas).toBe(0);
  });

  it('a vista refaz a capa com a legenda nova — e o sumário, a manchete e as assinaturas não mudam', async () => {
    await impressaComCapaDeFoto();
    const antes = vistaDaEdicao(naTela(), TODOS, AGG_VERSION);
    mockTroca.capa = CAPA_TROCADA;
    await useEdicaoStore.getState().trocarCapa(ENTRADA, FOTO_ESCOLHIDA);
    const depois = vistaDaEdicao(naTela(), TODOS, AGG_VERSION);
    if (antes.tipo !== 'edicao' || depois.tipo !== 'edicao') throw new Error('sem edição');
    expect(depois.capa.legenda).toBe(CAPA_TROCADA.legenda);
    expect(depois.capa.comFoto).toBe(true);
    expect(depois.capa.manchete).toBe(antes.capa.manchete);
    expect(depois.cadernos).toEqual(antes.cadernos);
  });

  /**
   * A troca falha **em voz alta** — ao contrário do carimbo da impressão, que só
   * loga. A mensagem volta para o seletor, e o estado não é tocado: a capa, a
   * edição e a sessão ficam como estavam.
   */
  it('falha na gravação: a mensagem volta, e o estado fica intacto', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    await impressaComCapaDeFoto();
    const antes = naTela();
    mockTroca.erro = new Error('PGRST204: coluna motivo não existe');
    const r = await useEdicaoStore.getState().trocarCapa(ENTRADA, FOTO_ESCOLHIDA);
    expect(r).toEqual({ ok: false, mensagem: 'Não foi possível trocar a capa agora. A capa continua a mesma.' });
    expect(naTela()).toBe(antes);
    // O motivo real vai para o log, não para a tela.
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('a recusa antes do banco chega à tela com a frase dela', async () => {
    await impressaComCapaDeFoto();
    const antes = naTela();
    mockTroca.erro = new TrocaRecusada('Esta foto não é de uma atividade deste período, e não pode ser a capa dele.');
    const r = await useEdicaoStore.getState().trocarCapa(ENTRADA, FOTO_ESCOLHIDA);
    expect(r).toEqual({
      ok: false, mensagem: 'Esta foto não é de uma atividade deste período, e não pode ser a capa dele.',
    });
    expect(naTela()).toBe(antes);
  });

  it('não troca com impressão em curso — e nem chama a porta', async () => {
    await impressaComCapaDeFoto();
    useEdicaoStore.setState((s) => ({
      porPeriodo: { ...s.porPeriodo, [chaveDe('u-1', ENTRADA)]: { ...lida(), imprimindo: 'sono' } },
    }));
    const r = await useEdicaoStore.getState().trocarCapa(ENTRADA, FOTO_ESCOLHIDA);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.mensagem).toMatch(/sendo impressa/);
    expect(mockTroca.chamadas).toBe(0);
  });

  it('sem capa de foto não há o que trocar — e nem chama a porta', async () => {
    await lidoCom([impresso('movimento', 1)]);
    const r = await useEdicaoStore.getState().trocarCapa(ENTRADA, FOTO_ESCOLHIDA);
    expect(r.ok).toBe(false);
    expect(mockTroca.chamadas).toBe(0);
  });

  /**
   * Trocar pela foto que já é a capa **não é troca**, e gravá-la apagaria o porquê
   * para sempre: o motivo viraria `trocada` — e nas duas capas de produção, o nulo
   * que declara "impressa antes do porquê" sumiria. A regra é da ação, não só do
   * seletor.
   */
  it('a foto que já é a capa é recusada — e a porta nem é chamada', async () => {
    await impressaComCapaDeFoto();
    const antes = naTela();
    const mesma = { ...FOTO_ESCOLHIDA, id: CAPA_DE_AGOSTO.fotoId };
    const r = await useEdicaoStore.getState().trocarCapa(ENTRADA, mesma);
    expect(r).toEqual({ ok: false, mensagem: 'Esta foto já é a capa.' });
    expect(mockTroca.chamadas).toBe(0);
    expect(naTela()).toBe(antes);
  });

  it('inclusive numa capa anterior à 1.16: o motivo nulo fica', async () => {
    mockLeitura.respostas = [{
      estado: 'ok', edicao: [impresso('movimento', 1)], capa: { ...CAPA_DE_AGOSTO, motivo: null },
    }];
    await useEdicaoStore.getState().carregar(ENTRADA);
    const r = await useEdicaoStore.getState().trocarCapa(ENTRADA, { ...FOTO_ESCOLHIDA, id: CAPA_DE_AGOSTO.fotoId });
    expect(r.ok).toBe(false);
    expect(mockTroca.chamadas).toBe(0);
    expect(lida().capa?.motivo).toBeNull();
  });

  /**
   * Duas trocas no mesmo período, a segunda antes de a primeira voltar: a segunda
   * é recusada sem chamar a porta. Sem a guarda, a capa que fica seria a da
   * gravação que o banco recebeu por último — não a do último toque.
   */
  it('segunda troca na mesma chave, com a primeira em voo: recusada, sem chamar a porta', async () => {
    await impressaComCapaDeFoto();
    const presa = segurar();
    mockTroca.pausa = presa.pausa;
    mockTroca.capa = CAPA_TROCADA;
    const primeira = useEdicaoStore.getState().trocarCapa(ENTRADA, FOTO_ESCOLHIDA);
    await drenar();
    const segunda = await useEdicaoStore.getState().trocarCapa(ENTRADA, { ...FOTO_ESCOLHIDA, id: 'p-10' });
    expect(segunda).toEqual({ ok: false, mensagem: 'A capa já está sendo trocada. Espere a troca terminar.' });
    expect(mockTroca.chamadas).toBe(1);
    presa.soltar();
    expect((await primeira).ok).toBe(true);
    expect(lida().capa).toEqual(CAPA_TROCADA);
  });

  it('a guarda solta a chave no fim — também quando a troca falha', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    await impressaComCapaDeFoto();
    mockTroca.erro = new Error('rede');
    expect((await useEdicaoStore.getState().trocarCapa(ENTRADA, FOTO_ESCOLHIDA)).ok).toBe(false);
    mockTroca.erro = null;
    mockTroca.capa = CAPA_TROCADA;
    expect((await useEdicaoStore.getState().trocarCapa(ENTRADA, FOTO_ESCOLHIDA)).ok).toBe(true);
    expect(mockTroca.chamadas).toBe(2);
    warn.mockRestore();
  });

  /**
   * A geração sobe **só se a capa entra**. Se o leitor pediu uma releitura
   * enquanto a troca gravava, a fase é `relendo` quando a troca volta: a capa não
   * entra (não há edição lida onde pô-la) — e descartar a leitura em voo deixaria
   * a tela presa em `relendo`. É essa leitura que traz do banco a capa já trocada.
   */
  it('a troca que volta com a fase fora de `lida` não descarta a releitura em voo', async () => {
    await impressaComCapaDeFoto();
    const gravando = segurar();
    mockTroca.pausa = gravando.pausa;
    mockTroca.capa = CAPA_TROCADA;
    const troca = useEdicaoStore.getState().trocarCapa(ENTRADA, FOTO_ESCOLHIDA);
    await drenar();

    // O leitor relê; o banco já tem a capa trocada, e a leitura fica presa no meio.
    const lendo = segurar();
    mockLeitura.pausas = [null, lendo.pausa];
    mockLeitura.respostas = [{ estado: 'ok', edicao: [impresso('movimento', 1), impresso('sono', 2)], capa: CAPA_TROCADA }];
    const releitura = useEdicaoStore.getState().recarregar(ENTRADA);
    await drenar();
    expect(naTela()).toEqual({ fase: 'relendo' });

    gravando.soltar();
    expect((await troca).ok).toBe(true);
    lendo.soltar();
    await releitura;
    expect(naTela().fase).toBe('lida');
    expect(lida().capa).toEqual(CAPA_TROCADA);
  });

  it('sem sessão não troca', async () => {
    await impressaComCapaDeFoto();
    mockAuth.uid = undefined;
    const r = await useEdicaoStore.getState().trocarCapa(ENTRADA, FOTO_ESCOLHIDA);
    expect(r.ok).toBe(false);
    expect(mockTroca.chamadas).toBe(0);
  });

  /**
   * **Sucesso sobe a geração da chave.** Uma leitura que já estava em voo quando a
   * troca gravou volta com a capa velha do banco; sem a geração nova, ela a
   * reporia por cima da que o dono acabou de escolher, e a rota voltaria à foto
   * antiga sem ninguém tocar em nada.
   */
  it('uma leitura em voo não repõe a capa velha depois da troca', async () => {
    // Uma leitura silenciosa lenta, presa no meio, que vai voltar com a capa antiga.
    await lidoCom([]);
    const lenta = segurar();
    mockLeitura.pausas = [null, lenta.pausa];
    mockLeitura.respostas = [{ estado: 'ok', edicao: [impresso('movimento', 1)], capa: CAPA_DE_AGOSTO }];
    const foco = useEdicaoStore.getState().carregar(ENTRADA);
    await drenar();
    // Enquanto ela corre, a edição impressa com a capa de foto chega à tela…
    useEdicaoStore.setState((s) => ({
      porPeriodo: {
        ...s.porPeriodo,
        [chaveDe('u-1', ENTRADA)]: estadoLido({ edicao: [impresso('movimento', 1)], capa: CAPA_DE_AGOSTO as never }),
      },
    }));
    // …e o dono troca a capa.
    mockTroca.capa = CAPA_TROCADA;
    const r = await useEdicaoStore.getState().trocarCapa(ENTRADA, FOTO_ESCOLHIDA);
    expect(r.ok).toBe(true);
    lenta.soltar();
    await foco;
    expect(lida().capa).toEqual(CAPA_TROCADA);
  });
});
