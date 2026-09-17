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
type RespostaFalsa = { estado: 'ausente' } | { estado: 'ok'; edicao: unknown[] } | Error;
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

// O ponto de injeção dos motores e o cliente do banco não carregam aqui.
jest.mock('../../lib/supabase', () => ({ supabase: {} }));
jest.mock('../../lib/motores', () => ({ motorPara: () => undefined }));

jest.mock('../../lib/edicao-ia', () => {
  const real = jest.requireActual('../../lib/edicao-ia') as Record<string, unknown>;
  return {
    ...real,
    comDadoDaEntrada: (_entrada: unknown, dadosProntos: boolean) => (dadosProntos ? mockComDado.valor : null),
    buscarEdicao: async () => {
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

import {
  chaveDe,
  dadosProntosParaImprimir,
  estadoDe,
  podeImprimir,
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
  mockComDado.valor = ['sono', 'movimento', 'coracao', 'rotina'];
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
      fase: 'lida', tipo: 'month', inicio: '2026-08-01', edicao: [], sessao: {}, imprimindo: null,
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
  return { fase: 'lida', tipo: 'month', inicio: '2026-08-01', edicao: [], sessao: {}, imprimindo: null, ...o };
}

const TODOS: readonly CadernoId[] = ['sono', 'movimento', 'coracao', 'rotina'];

describe('vistaDaEdicao — a matriz da rota', () => {
  it('rota, não escrito, dados prontos: capa em papel, o convite e o botão; miolo vazio', () => {
    expect(vistaDaEdicao(estadoLido(), ['sono', 'movimento', 'coracao'], AGG_VERSION)).toEqual({
      tipo: 'edicao',
      capa: { periodo: 'Agosto de 2026', impressa: false, manchete: null, escrevendo: false, escrever: true, semCaderno: false },
      cadernos: [],
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
      periodo: 'Agosto de 2026', impressa: true, escrevendo: false, escrever: false, semCaderno: false,
      manchete: 'O tempo de sono subiu para 7,1 h e a variabilidade da frequência cardíaca alcançou 71 ms, '
        + 'enquanto a frequência cardíaca em repouso chegou a 52 bpm.',
    });
    expect(v.cadernos.map((c) => [c.caderno, c.estado])).toEqual([
      ['rotina', 'pronta'], ['movimento', 'pronta'], ['sono', 'nao-escrito'], ['coracao', 'nao-escrito'],
    ]);
    expect(v.cadernos[1]).toEqual({
      caderno: 'movimento', estado: 'pronta', texto: impresso('movimento', 2).texto,
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
      { caderno: 'movimento', estado: 'pronta', texto: edicao[0].texto, assinatura: 'modelo-1 · 07 set 2026', errata: false },
      { caderno: 'rotina', estado: 'pronta', texto: edicao[1].texto, assinatura: 'modelo-1 · 07 set 2026', errata: true },
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
      capa: { periodo: 'Agosto de 2026', impressa: false, manchete: null, escrevendo: true, escrever: false, semCaderno: false },
      cadernos: [
        { caderno: 'sono', estado: 'na-fila' },
        { caderno: 'movimento', estado: 'escrevendo' },
        { caderno: 'rotina', estado: 'na-fila' },
      ],
    });
  });

  it('o escrito que espera a gravação aparece, sem assinatura', () => {
    const v = vistaDaEdicao(
      estadoLido({ imprimindo: 'edicao', sessao: { movimento: { fase: 'escrito', texto: 'Foram 21.' } } }),
      ['movimento'], AGG_VERSION,
    );
    if (v.tipo !== 'edicao') throw new Error(v.tipo);
    expect(v.cadernos).toEqual([{ caderno: 'movimento', estado: 'pronta', texto: 'Foram 21.', assinatura: null, errata: false }]);
  });

  it('nada impresso, mas algo aconteceu nesta sessão: o miolo mostra o que falhou e convida os outros', () => {
    const v = vistaDaEdicao(
      estadoLido({ sessao: { sono: { fase: 'erro', motivo: TRANSITORIA } } }),
      ['sono', 'movimento'], AGG_VERSION,
    );
    expect(v).toEqual({
      tipo: 'edicao',
      capa: { periodo: 'Agosto de 2026', impressa: false, manchete: null, escrevendo: false, escrever: true, semCaderno: false },
      cadernos: [
        { caderno: 'sono', estado: 'erro', motivo: TRANSITORIA, acao: 'tentar-de-novo' },
        { caderno: 'movimento', estado: 'nao-escrito', acao: 'escrever' },
      ],
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
