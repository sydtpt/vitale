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

jest.mock('../../lib/edicao-ia', () => ({
  buscarEdicao: async () => {
    mockLeitura.chamadas += 1;
    if (mockLeitura.erro) throw mockLeitura.erro;
    return mockLeitura.resposta;
  },
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

import { chaveDe, estadoDe, useEdicaoStore, type EstadoEdicao } from '../edicao.store';

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
