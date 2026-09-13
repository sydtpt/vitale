/**
 * O caminho de LEITURA da edição, no celular — o único que a Story 1.9 deixou
 * ligado.
 *
 * Escrito porque a camada de medição mostrou que ele não tinha teste nenhum:
 * inverter a guarda de período em curso, ou o `length > 0` da store, mantinha as
 * quatro suítes verdes. Os dois erros têm o mesmo sintoma em produção — a tela
 * anuncia coisa que não existe, ou esconde a que existe.
 *
 * O client do Supabase é mockado: o que se mede aqui é a decisão, não a rede.
 */
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

/**
 * O mock guarda o que foi pedido ao banco. É por ele que o caso "período em
 * curso" prova o que interessa: **não consultou**. Um teste que só olhasse o
 * estado devolvido passaria igual com a consulta acontecendo à toa a cada
 * folheada do histórico.
 */
// O prefixo `mock` é exigido pelo jest: só variáveis com ele podem ser
// alcançadas de dentro da fábrica de `jest.mock`, que é içada para o topo.
const mockBanco: {
  pedidos: { tabela: string; filtros: Record<string, unknown> }[];
  linhas: Record<string, unknown>[];
  erro: Error | null;
} = { pedidos: [], linhas: [], erro: null };

jest.mock('../supabase', () => ({
  supabase: {
    from(tabela: string) {
      const filtros: Record<string, unknown> = {};
      mockBanco.pedidos.push({ tabela, filtros });
      const alvo = {
        select: () => alvo,
        eq: (c: string, v: unknown) => { filtros[c] = v; return alvo; },
        order: async () => ({
          data: mockBanco.erro ? null : mockBanco.linhas,
          error: mockBanco.erro,
        }),
      };
      return alvo;
    },
  },
}));

import { buscarEdicao } from '../edicao-ia';

/**
 * O relógio: 6 de setembro, 19h. Agosto fechou; setembro, não.
 *
 * **Componentes locais, e não string.** `periodoFechado` compara `diaLocal` —
 * `getFullYear/getMonth/getDate`, o calendário de quem roda — com o `fimISO`, e
 * este repositório já teve o CI vermelho por data de teste que muda de dia
 * conforme o `TZ` do processo. `new Date('…T19:00:00')` sem fuso hoje é lido
 * como local e daria o mesmo dia em toda parte, mas é uma regra de parsing que
 * ninguém lê ao escrever o próximo caso; com `Z` ou com deslocamento fixo, o
 * caso do último dia do período abaixo VIRA o dia seguinte em fuso a leste e a
 * suíte quebra onde o código está certo. O construtor por componentes prende a
 * hora de parede, que é exatamente o que a função lê. (Mês é base zero: 8 = setembro.)
 */
const AGORA = new Date(2026, 8, 6, 19, 0, 0);

function entrada(over: { kind?: string; startISO?: string; endISO?: string } = {}) {
  return {
    resumo: {
      kind: over.kind ?? 'month',
      startISO: over.startISO ?? '2026-08-01',
      endISO: over.endISO ?? '2026-08-31',
    },
    agora: AGORA,
  } as unknown as Parameters<typeof buscarEdicao>[1];
}

function linha(caderno: string, posicao: number): Record<string, unknown> {
  return {
    user_id: 'u-1',
    tipo_periodo: 'month',
    inicio: '2026-08-01',
    fim: '2026-08-31',
    caderno,
    posicao,
    texto: `texto de ${caderno}`,
    provedor: 'p',
    modelo: 'm',
    prompt_versao: 3,
    pacote_versao: 3,
    motivo_de_parada: 'STOP',
    tokens_entrada: 1,
    tokens_saida: 2,
    agg_version_no_momento: 9,
    metrica_lider: null,
    gerado_em: '2026-09-01T00:00:00.000Z',
  };
}

beforeEach(() => {
  mockBanco.pedidos.length = 0;
  mockBanco.linhas = [];
  mockBanco.erro = null;
});

describe('buscarEdicao — ausência antes da consulta', () => {
  it('período em curso é ausência, e NÃO consulta o banco', async () => {
    const r = await buscarEdicao('u-1', entrada({ startISO: '2026-09-01', endISO: '2026-09-30' }));
    expect(r).toEqual({ estado: 'ausente' });
    // Folhear seis meses em curso não pode custar seis consultas.
    expect(mockBanco.pedidos).toHaveLength(0);
  });

  it("'all' nunca tem edição — ausência, e nenhuma consulta", async () => {
    const r = await buscarEdicao('u-1', entrada({ kind: 'all', endISO: '2026-08-31' }));
    expect(r).toEqual({ estado: 'ausente' });
    expect(mockBanco.pedidos).toHaveLength(0);
  });

  it('o último dia do período ainda é período em curso', async () => {
    const r = await buscarEdicao('u-1', {
      ...entrada(),
      // 31/08 às 23h59 — o caso que mais sente fuso, e por isso o que mais
      // precisa da hora de parede fixada por componentes. (7 = agosto.)
      agora: new Date(2026, 7, 31, 23, 59, 0),
    } as unknown as Parameters<typeof buscarEdicao>[1]);
    expect(r).toEqual({ estado: 'ausente' });
    expect(mockBanco.pedidos).toHaveLength(0);
  });
});

describe('buscarEdicao — o que o banco responde', () => {
  it('período fechado e sem linha devolve edição vazia', async () => {
    const r = await buscarEdicao('u-1', entrada());
    expect(r).toEqual({ estado: 'ok', edicao: [] });
    expect(mockBanco.pedidos).toHaveLength(1);
    expect(mockBanco.pedidos[0].tabela).toBe('edicoes_ia');
    expect(mockBanco.pedidos[0].filtros).toEqual({
      user_id: 'u-1',
      tipo_periodo: 'month',
      inicio: '2026-08-01',
      fim: '2026-08-31',
    });
  });

  it('devolve os cadernos na ordem que o banco entregou', async () => {
    mockBanco.linhas = [linha('movimento', 1), linha('sono', 2), linha('coracao', 3)];
    const r = await buscarEdicao('u-1', entrada());
    expect(r.estado).toBe('ok');
    if (r.estado !== 'ok') return;
    expect(r.edicao.map((c) => c.caderno)).toEqual(['movimento', 'sono', 'coracao']);
    expect(r.edicao.map((c) => c.posicao)).toEqual([1, 2, 3]);
  });

  it('propaga o erro do banco', async () => {
    mockBanco.erro = new Error('PGRST116');
    await expect(buscarEdicao('u-1', entrada())).rejects.toThrow('PGRST116');
  });
});
