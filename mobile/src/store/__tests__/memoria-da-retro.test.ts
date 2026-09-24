/**
 * **O que torna velho tudo que a Retrospectiva deriva** (Story 2.4a).
 *
 * O defeito que este arquivo existe para impedir não é um erro: é um **silêncio**.
 * O resumo da edição e a grade da capa memoizam contas que leem a store por fora,
 * então a lista de dependências não é derivável do corpo do `useMemo` — ela era
 * escrita à mão, com `react-hooks/exhaustive-deps` desligado. Tirar um item dali
 * não quebra `tsc`, não quebra teste nenhum e não imprime nada: a conta
 * simplesmente congela no estado em que a tela montou, e a grade mostra o mês como
 * ele era quando o app abriu.
 *
 * Aqui a lista virou regra pura, e é o `useMemoriaDaRetro` que a transforma num
 * número. O que se mede é só isto: **duas leituras descrevem o mesmo estado?**
 *
 * Nenhuma rede, nenhum React e nenhum mock: `memoria-da-retro.ts` importa só
 * tipos, de propósito — um módulo que precisasse do cliente Supabase para ser
 * testado seria um módulo que ninguém testa.
 */
import { describe, it, expect } from '@jest/globals';
import type { Activity, DadosDaRetro } from '@vitale/shared';
import { mesmaMemoria, type MemoriaDaRetro } from '../memoria-da-retro';

const DADOS = {} as DadosDaRetro;
const OUTROS_DADOS = {} as DadosDaRetro;

function atividade(id: string): Activity {
  return { id } as Activity;
}

const UMA = [atividade('a-1')];

function memoria(over: Partial<MemoriaDaRetro> = {}): MemoriaDaRetro {
  return {
    loaded: true,
    loading: false,
    loadedSince: '2026-01-01',
    dados: DADOS,
    atividades: UMA,
    ...over,
  };
}

describe('mesmaMemoria — o selo do que a Retrospectiva derivou', () => {
  it('a mesma leitura, duas vezes: nada envelheceu', () => {
    expect(mesmaMemoria(memoria(), memoria())).toBe(true);
  });

  it('a busca terminando muda a memória — é quando a janela nova chega', () => {
    expect(mesmaMemoria(memoria({ loading: true }), memoria({ loading: false }))).toBe(false);
  });

  it('janela mais larga muda a memória', () => {
    expect(mesmaMemoria(memoria({ loadedSince: '2026-01-01' }), memoria({ loadedSince: '2025-01-01' }))).toBe(false);
  });

  it('o primeiro carregamento muda a memória', () => {
    expect(mesmaMemoria(memoria({ loaded: false }), memoria({ loaded: true }))).toBe(false);
  });

  it('dados novos mudam a memória, mesmo com os três estados iguais', () => {
    expect(mesmaMemoria(memoria(), memoria({ dados: OUTROS_DADOS }))).toBe(false);
  });

  /**
   * **A razão de ser identidade, e não contagem.** Renomear uma atividade,
   * escondê-la ou ligar uma bicicleta troca a lista inteira por outra **do mesmo
   * tamanho** — e esconder é exatamente o que muda a grade da capa, porque o que o
   * dono escondeu não marca dia. Um selo por `length` diria "nada mudou".
   */
  it('lista trocada por outra do MESMO tamanho muda a memória', () => {
    const escondida = [{ ...atividade('a-1'), hidden: true } as Activity];
    expect(escondida.length).toBe(UMA.length);
    expect(mesmaMemoria(memoria(), memoria({ atividades: escondida }))).toBe(false);
  });

  it('a mesma lista, pela referência, não envelhece nada', () => {
    expect(mesmaMemoria(memoria({ atividades: UMA }), memoria({ atividades: UMA }))).toBe(true);
  });
});
