/**
 * A store da edição — a máquina de estados que a Retrospectiva desenha.
 *
 * Escrita porque a camada de medição mostrou que inverter o `length > 0` daqui
 * mantinha as quatro suítes verdes: "o período fechou e não foi escrito" e "o
 * período tem quatro cadernos" trocariam de lugar sem nada acusar.
 *
 * O que mais importa aqui é o **cache**: `ausente` e `nao-escrita` são respostas
 * sobre o relógio e sobre o arquivo, e os dois mudam. Guardá-los como
 * definitivos esconderia a edição pelo resto da sessão.
 */
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

const mockLeitura: {
  resposta: { estado: 'ausente' } | { estado: 'ok'; edicao: unknown[] };
  erro: Error | null;
  chamadas: number;
} = { resposta: { estado: 'ausente' }, erro: null, chamadas: 0 };

/**
 * A impressão falsa: um roteiro de avisos e um resultado. `pausa` segura a
 * impressão no meio, para medir o que a tela vê enquanto ela corre.
 */
type AvisoFalso = { tipo: 'comecar'; caderno: string; fila: string[] } | { tipo: 'ler'; caderno: string; desfecho: unknown };
const mockImpressao: {
  avisos: AvisoFalso[];
  resultado: unknown;
  erro: Error | null;
  chamadas: number;
  pausa: Promise<void> | null;
} = { avisos: [], resultado: { estado: 'nada-gravado', desfechos: [] }, erro: null, chamadas: 0, pausa: null };

jest.mock('../../lib/edicao-ia', () => ({
  buscarEdicao: async () => {
    mockLeitura.chamadas += 1;
    if (mockLeitura.erro) throw mockLeitura.erro;
    return mockLeitura.resposta;
  },
  imprimirEdicao: async (
    _uid: string,
    _entrada: unknown,
    avisos: { aoComecar?: (c: string, f: string[]) => void; aoLer?: (c: string, d: unknown) => void },
  ) => {
    mockImpressao.chamadas += 1;
    for (const a of mockImpressao.avisos) {
      if (a.tipo === 'comecar') avisos.aoComecar?.(a.caderno, a.fila);
      else avisos.aoLer?.(a.caderno, a.desfecho);
    }
    if (mockImpressao.pausa) await mockImpressao.pausa;
    if (mockImpressao.erro) throw mockImpressao.erro;
    return mockImpressao.resultado;
  },
  // O motivo em palavras tem teste próprio (`lib/__tests__/edicao-ia.test.ts`); aqui
  // basta um que distinga o que saiu do que não saiu.
  naoImpressoDe: (d: { tipo: string; causa?: string }) => (d.tipo === 'escrito' ? null : `motivo:${d.causa ?? d.tipo}`),
}));

/**
 * Quem está logado, e se o app já sabe disso. Mutável, porque a identidade é
 * metade do que se mede aqui — e `isLoading` é a diferença entre "ainda não sei
 * quem é você" e "não há sessão".
 */
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
  chaveDe, dadosProntosParaImprimir, estadoDe, podeEscrever, useEdicaoStore, type EstadoEdicao,
} from '../edicao.store';

/**
 * **O que a TELA calcula** — e é por aqui que este arquivo mede.
 *
 * `estado()` da store existe, é testado e **produção não o chama**: a
 * Retrospectiva assina `porPeriodo`, monta a chave e deriva com `estadoDe`.
 * Asserção que passasse por `estado()` mediria um caminho que ninguém percorre,
 * que é como um teste fica verde enquanto a tela quebra.
 */
function naTela(entrada: Entrada = ENTRADA): EstadoEdicao {
  const { porPeriodo } = useEdicaoStore.getState();
  return estadoDe(
    porPeriodo,
    mockAuth.uid ? chaveDe(mockAuth.uid, entrada) : null,
    mockAuth.isLoading,
  );
}

type Entrada = Parameters<ReturnType<typeof useEdicaoStore.getState>['carregar']>[0];

const ENTRADA = {
  resumo: { kind: 'month', startISO: '2026-08-01', endISO: '2026-08-31' },
  // Componentes locais, não string: este repositório já teve CI vermelho por
  // data de teste que muda de dia conforme o `TZ` do processo. (8 = setembro.)
  agora: new Date(2026, 8, 6, 19, 0, 0),
} as unknown as Entrada;

const caderno = (c: string, posicao: number) => ({ caderno: c, posicao, texto: 't' });

beforeEach(() => {
  mockLeitura.resposta = { estado: 'ausente' };
  mockLeitura.erro = null;
  mockLeitura.chamadas = 0;
  mockImpressao.avisos = [];
  mockImpressao.resultado = { estado: 'nada-gravado', desfechos: [] };
  mockImpressao.erro = null;
  mockImpressao.chamadas = 0;
  mockImpressao.pausa = null;
  mockAuth.uid = 'u-1';
  mockAuth.isLoading = false;
  useEdicaoStore.setState({ porPeriodo: {} });
});

describe('as fases que a leitura produz', () => {
  it('antes de qualquer leitura, a fase é `carregando` — e ela não desenha nada', () => {
    expect(naTela()).toEqual({ fase: 'carregando' });
  });

  it('ausente vira `ausente`', async () => {
    await useEdicaoStore.getState().carregar(ENTRADA);
    expect(naTela()).toEqual({ fase: 'ausente' });
  });

  it('lista VAZIA vira `nao-escrita`, não `pronta`', async () => {
    mockLeitura.resposta = { estado: 'ok', edicao: [] };
    await useEdicaoStore.getState().carregar(ENTRADA);
    expect(naTela()).toEqual({ fase: 'nao-escrita' });
  });

  it('lista COM cadernos vira `pronta`, na ordem em que chegou', async () => {
    mockLeitura.resposta = { estado: 'ok', edicao: [caderno('sono', 1), caderno('rotina', 2)] };
    await useEdicaoStore.getState().carregar(ENTRADA);
    const e = naTela();
    expect(e.fase).toBe('pronta');
    if (e.fase !== 'pronta') return;
    expect(e.edicao.map((c) => c.caderno)).toEqual(['sono', 'rotina']);
  });

  /** A frase crua do transporte fica no log; a tela recebe uma frase de jornal. */
  it('o erro vira frase, não código do PostgREST', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    mockLeitura.erro = new Error('PGRST116: JSON object requested, multiple rows returned');
    await useEdicaoStore.getState().carregar(ENTRADA);
    const e = naTela();
    expect(e.fase).toBe('erro');
    if (e.fase !== 'erro') return;
    expect(e.mensagem).not.toMatch(/PGRST/);
    expect(e.mensagem).toBe('Não foi possível ler a edição agora.');
    // O detalhe não se perde: ele vai para onde serve.
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});

describe('o que o cache guarda, e o que ele NÃO guarda', () => {
  it('`pronta` não relê — período fechado congela', async () => {
    mockLeitura.resposta = { estado: 'ok', edicao: [caderno('sono', 1)] };
    await useEdicaoStore.getState().carregar(ENTRADA);
    await useEdicaoStore.getState().carregar(ENTRADA);
    expect(mockLeitura.chamadas).toBe(1);
  });

  /**
   * O período olhado em curso FECHA. Se `ausente` fosse terminal, ele ficaria
   * escondido pelo resto da sessão — inclusive depois de impresso.
   */
  it('`ausente` relê: o mês em curso fecha', async () => {
    await useEdicaoStore.getState().carregar(ENTRADA);
    expect(naTela()).toEqual({ fase: 'ausente' });

    mockLeitura.resposta = { estado: 'ok', edicao: [caderno('sono', 1)] };
    await useEdicaoStore.getState().carregar(ENTRADA);
    expect(mockLeitura.chamadas).toBe(2);
    expect(naTela().fase).toBe('pronta');
  });

  /** E o período fechado e vazio é impresso — pelo backfill, ou pela 1.10. */
  it('`nao-escrita` relê: o período vazio é impresso', async () => {
    mockLeitura.resposta = { estado: 'ok', edicao: [] };
    await useEdicaoStore.getState().carregar(ENTRADA);
    expect(naTela()).toEqual({ fase: 'nao-escrita' });

    mockLeitura.resposta = { estado: 'ok', edicao: [caderno('sono', 1)] };
    await useEdicaoStore.getState().carregar(ENTRADA);
    expect(mockLeitura.chamadas).toBe(2);
    expect(naTela().fase).toBe('pronta');
  });

  /**
   * `erro` NÃO relê sozinho — e isso é a correção da rodada 2.
   *
   * Relendo a cada foco da tela, uma rede caída enche o log de uma linha por
   * folheada e **esvazia o botão "Tentar de novo"**: quando o dedo chega nele, a
   * releitura automática já aconteceu. Releitura de erro é ato do leitor.
   */
  it('`erro` NÃO relê sozinho — o toque é que relê', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    mockLeitura.erro = new Error('rede');
    await useEdicaoStore.getState().carregar(ENTRADA);
    expect(mockLeitura.chamadas).toBe(1);

    mockLeitura.erro = null;
    mockLeitura.resposta = { estado: 'ok', edicao: [] };
    // Três focos da tela: nenhum relê.
    await useEdicaoStore.getState().carregar(ENTRADA);
    await useEdicaoStore.getState().carregar(ENTRADA);
    await useEdicaoStore.getState().carregar(ENTRADA);
    expect(mockLeitura.chamadas).toBe(1);
    expect(naTela().fase).toBe('erro');

    // O botão, sim.
    await useEdicaoStore.getState().recarregar(ENTRADA);
    expect(mockLeitura.chamadas).toBe(2);
    expect(naTela().fase).toBe('nao-escrita');
    warn.mockRestore();
  });
});

describe('a sessão — o mapa é do usuário, não do app', () => {
  it('sem sessão, o estado é `sem-sessao`, e não o silêncio de `carregando`', async () => {
    mockAuth.uid = undefined;
    await useEdicaoStore.getState().carregar(ENTRADA);
    // Não há a quem perguntar…
    expect(mockLeitura.chamadas).toBe(0);
    // …e o cartão diz isso, em vez de ficar invisível para sempre.
    expect(naTela()).toEqual({ fase: 'sem-sessao' });
  });

  it('durante a hidratação, silêncio — não a frase de "entre na sua conta"', () => {
    mockAuth.uid = undefined;
    mockAuth.isLoading = true;
    expect(naTela()).toEqual({ fase: 'carregando' });
  });

  /**
   * O arranque a frio inteiro, na ordem em que acontece — é o caso que a rodada
   * 3 achou do lado do efeito: `carregar` desiste sem sessão e, se ninguém o
   * reagendar quando ela chega, o cartão fica invisível pelo resto da montagem.
   * Aqui se mede a metade que é da store: a chamada que chega DEPOIS da sessão
   * lê de verdade. (As deps do `useEffect` da tela são a outra metade.)
   */
  it('a sessão que chega tarde ainda é lida', async () => {
    mockAuth.uid = undefined;
    mockAuth.isLoading = true;
    await useEdicaoStore.getState().carregar(ENTRADA);
    expect(mockLeitura.chamadas).toBe(0);
    expect(naTela()).toEqual({ fase: 'carregando' });

    // `initialize()` voltou, com usuário.
    mockAuth.uid = 'u-1';
    mockAuth.isLoading = false;
    mockLeitura.resposta = { estado: 'ok', edicao: [caderno('sono', 1)] };
    await useEdicaoStore.getState().carregar(ENTRADA);
    expect(mockLeitura.chamadas).toBe(1);
    expect(naTela().fase).toBe('pronta');
  });

  /**
   * O caso que a rodada 2 achou: `pronta` não relê — certo, período fechado
   * congela —, e sem o uid na chave o texto do usuário anterior continuava na
   * tela depois de outro login, já desenhado.
   */
  it('a edição de um dono é INALCANÇÁVEL pelo outro', async () => {
    mockLeitura.resposta = { estado: 'ok', edicao: [caderno('sono', 1)] };
    await useEdicaoStore.getState().carregar(ENTRADA);
    expect(naTela().fase).toBe('pronta');

    // Outro login, sem que nada limpe o mapa.
    mockAuth.uid = 'u-2';
    expect(naTela().fase).toBe('carregando');

    // E o que ele lê é dele: uma leitura nova, sob outra chave.
    mockLeitura.resposta = { estado: 'ok', edicao: [] };
    await useEdicaoStore.getState().carregar(ENTRADA);
    expect(mockLeitura.chamadas).toBe(2);
    expect(naTela().fase).toBe('nao-escrita');

    // O do primeiro dono continua intacto, no lugar dele.
    mockAuth.uid = 'u-1';
    expect(naTela().fase).toBe('pronta');
  });

  it('o uid entra na chave', () => {
    expect(chaveDe('u-1', ENTRADA)).toBe('u-1|month|2026-08-01|2026-08-31');
    expect(chaveDe('u-2', ENTRADA)).not.toBe(chaveDe('u-1', ENTRADA));
  });
});

/**
 * `estadoDe` é a função que a tela e a store dividem. Antes eram dois caminhos:
 * o da tela, montando a chave à mão e sem teste nenhum, e o `estado()` da store,
 * testado e sem chamador de produção.
 */
describe('estadoDe — a derivação que a tela e a store dividem', () => {
  it('chave nula, com a sessão já lida, é ausência de sessão', () => {
    expect(estadoDe({}, null, false)).toEqual({ fase: 'sem-sessao' });
  });

  /**
   * **As duas ausências não são a mesma.** No arranque a frio o auth nasce sem
   * usuário e só ganha um quando `initialize()` volta do disco; tratar isso como
   * "não há sessão" mostraria "Entre na sua conta" nos primeiros quadros de todo
   * arranque, para quem está logado.
   */
  it('chave nula, com a sessão AINDA HIDRATANDO, é silêncio', () => {
    expect(estadoDe({}, null, true)).toEqual({ fase: 'carregando' });
  });

  it('chave sem entrada no mapa é `carregando`, que não desenha nada', () => {
    expect(estadoDe({}, 'u-1|month|2026-08-01|2026-08-31', false)).toEqual({ fase: 'carregando' });
  });

  it('devolve o que está no mapa', () => {
    const mapa = { 'u-1|month|2026-08-01|2026-08-31': { fase: 'nao-escrita' as const } };
    expect(estadoDe(mapa, 'u-1|month|2026-08-01|2026-08-31', false)).toEqual({ fase: 'nao-escrita' });
  });

  /**
   * A tela e a store têm de responder o mesmo — senão haveria de novo dois
   * caminhos, que é o defeito que `estadoDe` fechou.
   */
  it('é a MESMA resposta que o `estado()` da store — um caminho só', async () => {
    mockLeitura.resposta = { estado: 'ok', edicao: [caderno('sono', 1)] };
    await useEdicaoStore.getState().carregar(ENTRADA);
    expect(naTela()).toEqual(useEdicaoStore.getState().estado(ENTRADA));
  });
});

describe('recarregar — o toque do leitor', () => {
  /**
   * `carregando` é silencioso de propósito (senão o cartão pisca a cada foco da
   * tela). A releitura pedida por toque não pode ser: um toque que apaga o
   * cartão e não devolve nada é um toque perdido.
   */
  it('põe a leitura em `relendo`, que é a fase que desenha', async () => {
    mockLeitura.resposta = { estado: 'ok', edicao: [] };
    await useEdicaoStore.getState().carregar(ENTRADA);

    let faseEmVoo: string | undefined;
    const naoResolve = new Promise<void>((resolve) => {
      queueMicrotask(() => {
        faseEmVoo = naTela().fase;
        resolve();
      });
    });
    const p = useEdicaoStore.getState().recarregar(ENTRADA);
    await naoResolve;
    await p;
    expect(faseEmVoo).toBe('relendo');
  });

  it('relê mesmo a partir de `pronta` — é ato explícito do leitor', async () => {
    mockLeitura.resposta = { estado: 'ok', edicao: [caderno('sono', 1)] };
    await useEdicaoStore.getState().carregar(ENTRADA);
    await useEdicaoStore.getState().recarregar(ENTRADA);
    expect(mockLeitura.chamadas).toBe(2);
  });
});


/* ── a impressão ─────────────────────────────────────────────────────────── */

/** Um desfecho falso: `escrito` com texto, ou `nao-escrito` com a causa que o motivo falso lê. */
const escrito = (texto: string) => ({ tipo: 'escrito', leitura: { frase: texto } });
const naoEscrito = (causa: string) => ({ tipo: 'nao-escrito', causa });

/** Deixa a impressão andar até a sequência ser chamada (a releitura antes de pagar é uma volta a mais). */
async function drenar(): Promise<void> {
  await new Promise<void>((r) => setImmediate(r));
}

async function naoEscrita(): Promise<void> {
  mockLeitura.resposta = { estado: 'ok', edicao: [] };
  await useEdicaoStore.getState().carregar(ENTRADA);
  expect(naTela().fase).toBe('nao-escrita');
}

describe('imprimir — o toque em "Escrever a edição"', () => {
  it('só age a partir de `nao-escrita`: em `pronta`, `ausente` ou sem leitura, nada acontece', async () => {
    await useEdicaoStore.getState().imprimir(ENTRADA, true);
    expect(mockImpressao.chamadas).toBe(0);

    await useEdicaoStore.getState().carregar(ENTRADA); // ausente
    await useEdicaoStore.getState().imprimir(ENTRADA, true);
    expect(mockImpressao.chamadas).toBe(0);

    useEdicaoStore.setState({ porPeriodo: {} });
    mockLeitura.resposta = { estado: 'ok', edicao: [caderno('sono', 1)] };
    await useEdicaoStore.getState().carregar(ENTRADA); // pronta
    await useEdicaoStore.getState().imprimir(ENTRADA, true);
    expect(mockImpressao.chamadas).toBe(0);
  });

  it('sem sessão, não imprime', async () => {
    await naoEscrita();
    mockAuth.uid = undefined;
    await useEdicaoStore.getState().imprimir(ENTRADA, true);
    expect(mockImpressao.chamadas).toBe(0);
  });

  it('o segundo toque durante a impressão é ignorado — uma impressão, paga uma vez', async () => {
    await naoEscrita();
    let soltar!: () => void;
    mockImpressao.pausa = new Promise<void>((r) => { soltar = r; });
    const primeiro = useEdicaoStore.getState().imprimir(ENTRADA, true);
    const segundo = useEdicaoStore.getState().imprimir(ENTRADA, true);
    expect(naTela().fase).toBe('imprimindo');
    soltar();
    await Promise.all([primeiro, segundo]);
    expect(mockImpressao.chamadas).toBe(1);
  });

  it('`imprimindo` desenha caderno a caderno: na fila, escrevendo, escrito, não escrito', async () => {
    await naoEscrita();
    let soltar!: () => void;
    mockImpressao.pausa = new Promise<void>((r) => { soltar = r; });
    mockImpressao.avisos = [
      { tipo: 'comecar', caderno: 'movimento', fila: ['movimento', 'sono', 'rotina'] },
      { tipo: 'ler', caderno: 'movimento', desfecho: escrito('Foram 21 atividades.') },
      { tipo: 'comecar', caderno: 'sono', fila: ['movimento', 'sono', 'rotina'] },
      { tipo: 'ler', caderno: 'sono', desfecho: naoEscrito('transitoria') },
      { tipo: 'comecar', caderno: 'rotina', fila: ['movimento', 'sono', 'rotina'] },
    ];
    const p = useEdicaoStore.getState().imprimir(ENTRADA, true);
    await drenar();
    expect(naTela()).toEqual({
      fase: 'imprimindo',
      cadernos: [
        { caderno: 'movimento', fase: 'escrito', texto: 'Foram 21 atividades.' },
        { caderno: 'sono', fase: 'nao-escrito', motivo: 'motivo:transitoria' },
        { caderno: 'rotina', fase: 'escrevendo' },
      ],
    });
    soltar();
    await p;
  });

  it('antes do primeiro caderno, `imprimindo` com a fila vazia; o primeiro aviso a preenche como `na-fila`', async () => {
    await naoEscrita();
    let soltar!: () => void;
    mockImpressao.pausa = new Promise<void>((r) => { soltar = r; });
    mockImpressao.avisos = [{ tipo: 'comecar', caderno: 'movimento', fila: ['movimento', 'sono'] }];
    const p = useEdicaoStore.getState().imprimir(ENTRADA, true);
    await drenar();
    expect(naTela()).toEqual({
      fase: 'imprimindo',
      cadernos: [{ caderno: 'movimento', fase: 'escrevendo' }, { caderno: 'sono', fase: 'na-fila' }],
    });
    soltar();
    await p;
  });

  it('`gravada` vira `pronta` com a edição relida — e os que não saíram, com o motivo', async () => {
    await naoEscrita();
    mockImpressao.resultado = {
      estado: 'gravada',
      edicao: [caderno('movimento', 1), caderno('rotina', 2)],
      desfechos: [
        { caderno: 'movimento', desfecho: escrito('a') },
        { caderno: 'sono', desfecho: naoEscrito('reprovada') },
        { caderno: 'rotina', desfecho: escrito('b') },
      ],
    };
    await useEdicaoStore.getState().imprimir(ENTRADA, true);
    expect(naTela()).toEqual({
      fase: 'pronta',
      edicao: [caderno('movimento', 1), caderno('rotina', 2)],
      naoImpressos: [{ caderno: 'sono', motivo: 'motivo:reprovada' }],
    });
  });

  it('`gravada` com todos escritos: `pronta` sem a lista dos que não saíram', async () => {
    await naoEscrita();
    mockImpressao.resultado = {
      estado: 'gravada', edicao: [caderno('movimento', 1)], desfechos: [{ caderno: 'movimento', desfecho: escrito('a') }],
    };
    await useEdicaoStore.getState().imprimir(ENTRADA, true);
    expect(naTela()).toEqual({ fase: 'pronta', edicao: [caderno('movimento', 1)] });
  });

  it('`nada-gravado` volta a `nao-escrita` com os motivos — e o botão continua lá', async () => {
    await naoEscrita();
    mockImpressao.resultado = {
      estado: 'nada-gravado',
      desfechos: [{ caderno: 'movimento', desfecho: naoEscrito('preferencia') }],
    };
    await useEdicaoStore.getState().imprimir(ENTRADA, true);
    expect(naTela()).toEqual({ fase: 'nao-escrita', motivos: [{ caderno: 'movimento', motivo: 'motivo:preferencia' }] });
    // Pode tentar de novo.
    await useEdicaoStore.getState().imprimir(ENTRADA, true);
    expect(mockImpressao.chamadas).toBe(2);
  });

  it('os motivos sobrevivem à releitura do foco da tela', async () => {
    await naoEscrita();
    mockImpressao.resultado = { estado: 'nada-gravado', desfechos: [{ caderno: 'sono', desfecho: naoEscrito('transitoria') }] };
    await useEdicaoStore.getState().imprimir(ENTRADA, true);
    await useEdicaoStore.getState().carregar(ENTRADA);
    // A leitura da tela, a releitura antes de pagar, e a do foco.
    expect(mockLeitura.chamadas).toBe(3);
    expect(naTela()).toEqual({ fase: 'nao-escrita', motivos: [{ caderno: 'sono', motivo: 'motivo:transitoria' }] });
  });

  it('`sem-caderno` vira `nao-escrita` sem botão — e um novo toque não imprime', async () => {
    await naoEscrita();
    mockImpressao.resultado = { estado: 'sem-caderno' };
    await useEdicaoStore.getState().imprimir(ENTRADA, true);
    expect(naTela()).toEqual({ fase: 'nao-escrita', semCaderno: true });
    await useEdicaoStore.getState().imprimir(ENTRADA, true);
    expect(mockImpressao.chamadas).toBe(1);
  });

  it('`aberto` vira `ausente`', async () => {
    await naoEscrita();
    mockImpressao.resultado = { estado: 'aberto' };
    await useEdicaoStore.getState().imprimir(ENTRADA, true);
    expect(naTela()).toEqual({ fase: 'ausente' });
  });

  it('exceção de porta vira `erro` marcado como da impressão — sem prometer escrita, o detalhe no log', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    await naoEscrita();
    mockImpressao.erro = new Error('linha recusada — caderno sono: sem tokens_entrada');
    await useEdicaoStore.getState().imprimir(ENTRADA, true);
    // O `gravar` pode ter feito commit antes de a conexão cair: a frase não diz que
    // não escreveu, e a marca muda o rótulo do botão para "Ver o que ficou gravado".
    expect(naTela()).toEqual({
      fase: 'erro', mensagem: 'A impressão não terminou. Parte dela pode ter ficado gravada.', aposImpressao: true,
    });
    expect(warn).toHaveBeenCalled();
    // E o botão relê: a chave não fica presa.
    mockLeitura.resposta = { estado: 'ok', edicao: [caderno('sono', 1)] };
    await useEdicaoStore.getState().recarregar(ENTRADA);
    expect(naTela().fase).toBe('pronta');
    warn.mockRestore();
  });

  it('o erro de LEITURA continua sem a marca da impressão', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    mockLeitura.erro = new Error('rede');
    await useEdicaoStore.getState().carregar(ENTRADA);
    const e = naTela();
    expect(e).toEqual({ fase: 'erro', mensagem: 'Não foi possível ler a edição agora.' });
    expect('aposImpressao' in e).toBe(false);
    warn.mockRestore();
  });

  it('estado inesperado da sequência não deixa a chave presa em `imprimindo`', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    await naoEscrita();
    mockImpressao.resultado = { estado: 'estranho' };
    await useEdicaoStore.getState().imprimir(ENTRADA, true);
    const e = naTela();
    expect(e.fase).toBe('erro');
    if (e.fase !== 'erro') return;
    expect(e.aposImpressao).toBe(true);
    expect(e.mensagem).toBe('A impressão devolveu uma resposta que o app não sabe ler.');
    // `recarregar` aceita a chave de novo.
    await useEdicaoStore.getState().recarregar(ENTRADA);
    expect(naTela().fase).toBe('nao-escrita');
    warn.mockRestore();
  });

  it('um foco da tela no meio da impressão não relê por cima dela', async () => {
    await naoEscrita();
    let soltar!: () => void;
    mockImpressao.pausa = new Promise<void>((r) => { soltar = r; });
    const p = useEdicaoStore.getState().imprimir(ENTRADA, true);
    await drenar();
    await useEdicaoStore.getState().carregar(ENTRADA);
    await useEdicaoStore.getState().recarregar(ENTRADA);
    // A leitura da tela e a releitura antes de pagar — nenhuma do foco.
    expect(mockLeitura.chamadas).toBe(2);
    expect(naTela().fase).toBe('imprimindo');
    soltar();
    await p;
  });
});

describe('a releitura antes de pagar — o `nao-escrita` da memória pode ser velho', () => {
  it('o banco já tem a edição: `pronta` com ela, e a sequência nunca é chamada', async () => {
    await naoEscrita();
    // Impressa depois da última leitura — por outro aparelho, ou pelo backfill.
    mockLeitura.resposta = { estado: 'ok', edicao: [caderno('movimento', 1), caderno('sono', 2)] };
    await useEdicaoStore.getState().imprimir(ENTRADA, true);
    expect(mockImpressao.chamadas).toBe(0);
    expect(naTela()).toEqual({ fase: 'pronta', edicao: [caderno('movimento', 1), caderno('sono', 2)] });
  });

  it('a releitura diz ausente: `ausente`, sem sequência', async () => {
    await naoEscrita();
    mockLeitura.resposta = { estado: 'ausente' };
    await useEdicaoStore.getState().imprimir(ENTRADA, true);
    expect(mockImpressao.chamadas).toBe(0);
    expect(naTela()).toEqual({ fase: 'ausente' });
  });

  it('a releitura falha: erro de leitura (nada começou), sem sequência', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    await naoEscrita();
    mockLeitura.erro = new Error('rede');
    await useEdicaoStore.getState().imprimir(ENTRADA, true);
    expect(mockImpressao.chamadas).toBe(0);
    expect(naTela()).toEqual({ fase: 'erro', mensagem: 'Não foi possível ler a edição agora.' });
    warn.mockRestore();
  });

  it('a releitura vem vazia: a impressão segue', async () => {
    await naoEscrita();
    await useEdicaoStore.getState().imprimir(ENTRADA, true);
    expect(mockLeitura.chamadas).toBe(2);
    expect(mockImpressao.chamadas).toBe(1);
  });
});

describe('a prontidão dos dados — o botão e a ação decidem pela mesma função', () => {
  const PRONTA = { loaded: true, loading: false, loadedSince: '2026-05-01' };
  const ATIVIDADES = { loaded: true, loading: false };

  it('dadosProntosParaImprimir: só com a retro carregada, parada, cobrindo o período, e as atividades idem', () => {
    const since = '2026-06-01';
    expect(dadosProntosParaImprimir(PRONTA, ATIVIDADES, since)).toBe(true);
    // A janela carregada começa exatamente onde o período precisa: cobre.
    expect(dadosProntosParaImprimir({ ...PRONTA, loadedSince: since }, ATIVIDADES, since)).toBe(true);
    // Cada condição, sozinha, derruba.
    expect(dadosProntosParaImprimir({ ...PRONTA, loaded: false }, ATIVIDADES, since)).toBe(false);
    expect(dadosProntosParaImprimir({ ...PRONTA, loading: true }, ATIVIDADES, since)).toBe(false);
    expect(dadosProntosParaImprimir({ ...PRONTA, loadedSince: null }, ATIVIDADES, since)).toBe(false);
    expect(dadosProntosParaImprimir({ ...PRONTA, loadedSince: '2026-07-01' }, ATIVIDADES, since)).toBe(false);
    expect(dadosProntosParaImprimir(PRONTA, { ...ATIVIDADES, loaded: false }, since)).toBe(false);
    expect(dadosProntosParaImprimir(PRONTA, { ...ATIVIDADES, loading: true }, since)).toBe(false);
  });

  it('podeEscrever: só `nao-escrita`, com o que dizer, e com os dados prontos', () => {
    const estados: readonly [EstadoEdicao, boolean][] = [
      [{ fase: 'nao-escrita' }, true],
      [{ fase: 'nao-escrita', motivos: [{ caderno: 'sono', motivo: 'x' }] }, true],
      [{ fase: 'nao-escrita', semCaderno: true }, false],
      [{ fase: 'carregando' }, false],
      [{ fase: 'relendo' }, false],
      [{ fase: 'pronta', edicao: [] }, false],
      [{ fase: 'imprimindo', cadernos: [] }, false],
      [{ fase: 'ausente' }, false],
      [{ fase: 'sem-sessao' }, false],
      [{ fase: 'erro', mensagem: 'x' }, false],
      [{ fase: 'erro', mensagem: 'x', aposImpressao: true }, false],
    ];
    for (const [estado, comDados] of estados) {
      expect({ estado, pode: podeEscrever(estado, true) }).toEqual({ estado, pode: comDados });
      // Sem os dados prontos, nenhum estado mostra o botão.
      expect({ estado, pode: podeEscrever(estado, false) }).toEqual({ estado, pode: false });
    }
  });

  it('a ação confere a prontidão: com os dados pela metade, nada acontece — nem a releitura', async () => {
    await naoEscrita();
    await useEdicaoStore.getState().imprimir(ENTRADA, false);
    expect(mockImpressao.chamadas).toBe(0);
    expect(mockLeitura.chamadas).toBe(1);
    expect(naTela()).toEqual({ fase: 'nao-escrita' });
  });
});

describe('o que faltava medir na impressão', () => {
  it('antes do primeiro caderno, a fila é vazia — e é assim que a tela desenha "Preparando a edição"', async () => {
    await naoEscrita();
    let soltar!: () => void;
    mockImpressao.pausa = new Promise<void>((r) => { soltar = r; });
    const p = useEdicaoStore.getState().imprimir(ENTRADA, true);
    await drenar();
    expect(mockImpressao.chamadas).toBe(1);
    expect(naTela()).toEqual({ fase: 'imprimindo', cadernos: [] });
    soltar();
    await p;
  });

  it('`gravada` com a edição relida vazia vira `nao-escrita` com os motivos', async () => {
    await naoEscrita();
    mockImpressao.resultado = {
      estado: 'gravada',
      edicao: [],
      desfechos: [
        { caderno: 'movimento', desfecho: escrito('a') },
        { caderno: 'sono', desfecho: naoEscrito('transitoria') },
      ],
    };
    await useEdicaoStore.getState().imprimir(ENTRADA, true);
    expect(naTela()).toEqual({ fase: 'nao-escrita', motivos: [{ caderno: 'sono', motivo: 'motivo:transitoria' }] });
  });
});
