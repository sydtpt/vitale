/**
 * A janela da Retrospectiva quando a busca **falha**.
 *
 * **O defeito que este arquivo existe para impedir.** `ensure` marcava
 * `loading: true`, esperava nove buscas em paralelo e só desmarcava no caminho
 * feliz. Uma rejeição — rede fora, PostgREST em 500, sessão expirada — deixava
 * `loading` preso em `true` pelo resto da sessão, e a guarda de reentrada da
 * própria função (`if (loading) return`) transformava **toda** tentativa seguinte
 * em no-op. Nada disso aparecia como erro: a Retrospectiva ficava sem números e a
 * rota da revista mostrava "Este período fechou e ainda não foi escrito" — sem
 * botão, sem explicação e sem fim de carregamento — até o app reiniciar. Era o
 * único caminho em que um botão que **paga uma chamada de modelo** ficava atrás de
 * um estado que não se recuperava sozinho.
 *
 * O contrário também se mede: soltar o `loading` sem marcar a janela que falhou
 * daria um laço quente, porque o efeito que chama `ensure` reage a `loading` voltar
 * a falso. Por isso `falhouEm` — e por isso a tentativa seguinte, a do foco da
 * tela, tem de funcionar.
 *
 * Nenhuma rede: os nove fetchers do `@vitale/shared` são falsos, e o acervo é vazio
 * de propósito — o que se mede aqui é o estado da store, não o conteúdo da janela.
 */
import { describe, it, expect, beforeEach, jest } from '@jest/globals';

jest.mock('../../lib/supabase', () => ({ supabase: {} }));

jest.mock('../auth.store', () => {
  const estado: { user: { id: string } | null } = { user: { id: 'u1' } };
  return { useAuthStore: { getState: () => ({ user: estado.user }), __estado: estado } };
});

// A store dispara o carregamento das atividades em paralelo, sem esperar por ele.
jest.mock('../activities.store', () => ({
  useActivitiesStore: { getState: () => ({ load: async () => {} }) },
}));

jest.mock('@vitale/shared', () => {
  const real = jest.requireActual('@vitale/shared') as Record<string, unknown>;
  const estado = {
    /** Qual busca falha na próxima chamada: nenhuma, ou a primeira da lista. */
    falhar: false,
    /** Quantas vezes a janela foi pedida ao "banco". */
    pedidos: 0,
  };
  const vazio = async () => {
    estado.pedidos += 1;
    if (estado.falhar) throw new Error('PostgREST caiu');
    return [];
  };
  return {
    ...real,
    __fake: estado,
    fetchHealthDailyValues: vazio,
    fetchDailyRatingScores: vazio,
    fetchHabitSummaries: vazio,
    fetchHabitLogsSince: vazio,
    fetchRegistroSummaries: vazio,
    fetchRegistroLogsSince: vazio,
    fetchTodoTemplateSummaries: vazio,
    fetchDoneTodoOccurrencesSince: vazio,
    fetchSleepPeriodsSince: vazio,
  };
});

import * as shared from '@vitale/shared';
import { useRetroStore } from '../retro.store';

const fake = (shared as unknown as { __fake: { falhar: boolean; pedidos: number } }).__fake;

const SINCE = '2026-06-01';

beforeEach(() => {
  fake.falhar = false;
  fake.pedidos = 0;
  useRetroStore.setState({ loading: false, loaded: false, loadedSince: null, falhouEm: null });
});

describe('ensure — a janela que não chegou', () => {
  it('a busca que rejeita solta o `loading` e marca a janela', async () => {
    fake.falhar = true;

    await useRetroStore.getState().ensure(SINCE);

    const s = useRetroStore.getState();
    expect(s.loading).toBe(false);
    expect(s.falhouEm).toBe(SINCE);
    // Nada de meia-verdade: uma janela que falhou não conta como carregada.
    expect(s.loaded).toBe(false);
    expect(s.loadedSince).toBeNull();
  });

  it('a rejeição não escapa para quem chamou — `void ensure(...)` é o padrão das telas', async () => {
    fake.falhar = true;
    await expect(useRetroStore.getState().ensure(SINCE)).resolves.toBeUndefined();
  });

  /**
   * O caso do defeito, ponta a ponta: é esta segunda chamada — a do foco da tela —
   * que antes morria na guarda de reentrada, porque `loading` nunca voltava a falso.
   */
  it('depois da falha, a tentativa seguinte busca de verdade e limpa a marca', async () => {
    fake.falhar = true;
    await useRetroStore.getState().ensure(SINCE);
    expect(useRetroStore.getState().falhouEm).toBe(SINCE);

    fake.falhar = false;
    fake.pedidos = 0;
    await useRetroStore.getState().ensure(SINCE);

    const s = useRetroStore.getState();
    expect(fake.pedidos).toBeGreaterThan(0);
    expect(s.loaded).toBe(true);
    expect(s.loadedSince).toBe(SINCE);
    expect(s.falhouEm).toBeNull();
    expect(s.loading).toBe(false);
  });

  it('a janela que deu certo não deixa marca de falha para trás', async () => {
    await useRetroStore.getState().ensure(SINCE);
    expect(useRetroStore.getState().falhouEm).toBeNull();
    expect(useRetroStore.getState().loaded).toBe(true);
  });

  /**
   * A guarda de reentrada continua valendo: ela é o que impede duas buscas da mesma
   * janela em voo. O que mudou é só o destravamento na falha.
   */
  it('com uma busca em voo, a segunda chamada não pede nada', async () => {
    const primeira = useRetroStore.getState().ensure(SINCE);
    const pedidosNaPrimeira = fake.pedidos;
    await useRetroStore.getState().ensure(SINCE);
    expect(fake.pedidos).toBe(pedidosNaPrimeira);
    await primeira;
  });
});
