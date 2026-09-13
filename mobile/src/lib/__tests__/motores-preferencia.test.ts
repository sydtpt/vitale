/**
 * A preferência de motor por recurso (story 5.5).
 *
 * Duas coisas aqui podem falhar caladas, e as duas custam a escolha do dono:
 *
 *  1. **A corrida.** `AsyncStorage` não tem read-modify-write atômico, e o dono
 *     toca duas linhas do seletor em sequência. Sem a fila, a segunda escrita lê o
 *     mapa antes de a primeira ter gravado e apaga a escolha do primeiro recurso —
 *     sem erro nenhum. É o mesmo defeito que as migalhas do sync já pagaram, e é
 *     por isso que o teste usa um store **lento**: sem latência, a corrida não se
 *     manifesta.
 *  2. **O valor que não se lê.** Ele não pode virar preferência (senão a cadeia
 *     levaria um id inventado) nem ser apagado (senão arrumar o formato destruiria
 *     a escolha). Devolve `null`, e continua no disco.
 */
import { describe, it, expect } from '@jest/globals';
import { NUVEM_PADRAO, SEM_MODELO } from '@vitale/shared';
import type { KVStore } from '../local-store';
import { gravarPreferencia, lerPreferencia, lerPreferencias } from '../motores/preferencia';

const CHAVE = 'vitale:motores-preferencia';

/** Store com latência: sem ela, a corrida não se manifesta em teste. */
function storeLento(delayMs = 1): KVStore & { bruto: () => string | null } {
  const map = new Map<string, string>();
  const espera = () => new Promise((r) => setTimeout(r, delayMs));
  return {
    getItem: async (k) => {
      await espera();
      return map.get(k) ?? null;
    },
    setItem: async (k, v) => {
      await espera();
      map.set(k, v);
    },
    removeItem: async (k) => {
      await espera();
      map.delete(k);
    },
    bruto: () => map.get(CHAVE) ?? null,
  };
}

function storeCom(valor: string): KVStore {
  return {
    getItem: async (k) => (k === CHAVE ? valor : null),
    setItem: async () => undefined,
    removeItem: async () => undefined,
  };
}

describe('a preferência de motor', () => {
  it('grava e lê a escolha de um recurso', async () => {
    const store = storeLento();
    await gravarPreferencia('saude-do-sono', NUVEM_PADRAO, store);
    expect(await lerPreferencia('saude-do-sono', store)).toBe(NUVEM_PADRAO);
    expect(await lerPreferencias(store)).toEqual({ 'saude-do-sono': NUVEM_PADRAO });
  });

  it('recurso sem escolha devolve null — e é isso que faz a cadeia usar o padrão', async () => {
    const store = storeLento();
    expect(await lerPreferencia('saude-do-sono', store)).toBeNull();
    expect(await lerPreferencias(store)).toEqual({});
  });

  it('null apaga a escolha, sem tocar nas outras', async () => {
    const store = storeLento();
    await gravarPreferencia('saude-do-sono', NUVEM_PADRAO, store);
    await gravarPreferencia('retrospectiva', SEM_MODELO, store);
    await gravarPreferencia('saude-do-sono', null, store);
    expect(await lerPreferencias(store)).toEqual({ retrospectiva: SEM_MODELO });
  });

  it('duas escritas em paralelo não se perdem — o par que o seletor produz', async () => {
    const store = storeLento();
    // Exatamente o que acontece no seletor: nada aguarda a escrita anterior.
    await Promise.all([
      gravarPreferencia('saude-do-sono', NUVEM_PADRAO, store),
      gravarPreferencia('retrospectiva', SEM_MODELO, store),
    ]);
    expect(await lerPreferencias(store)).toEqual({
      'saude-do-sono': NUVEM_PADRAO,
      retrospectiva: SEM_MODELO,
    });
  });

  it('valor ilegível devolve null — e NÃO é apagado', async () => {
    const store = storeLento();
    await store.setItem(CHAVE, JSON.stringify({ 'saude-do-sono': 'nuvem', retrospectiva: SEM_MODELO }));

    expect(await lerPreferencia('saude-do-sono', store)).toBeNull();
    // A outra escolha continua legível: um id ruim não contamina o mapa.
    expect(await lerPreferencia('retrospectiva', store)).toBe(SEM_MODELO);

    // E uma escrita em outro recurso preserva o ilegível, em vez de limpar o mapa.
    await gravarPreferencia('retrospectiva', NUVEM_PADRAO, store);
    expect(JSON.parse(store.bruto() ?? '{}')).toEqual({
      'saude-do-sono': 'nuvem',
      retrospectiva: NUVEM_PADRAO,
    });
  });

  it('JSON corrompido, ou que não é objeto, lê como vazio sem lançar', async () => {
    for (const valor of ['{não é json', '42', '["lista"]', 'null']) {
      expect(await lerPreferencias(storeCom(valor))).toEqual({});
      expect(await lerPreferencia('saude-do-sono', storeCom(valor))).toBeNull();
    }
  });

  it('armazenamento quebrado não lança na leitura — a cadeia cai no padrão', async () => {
    const quebrado: KVStore = {
      getItem: async () => {
        throw new Error('storage indisponível');
      },
      setItem: async () => {
        throw new Error('storage indisponível');
      },
      removeItem: async () => undefined,
    };
    await expect(lerPreferencia('saude-do-sono', quebrado)).resolves.toBeNull();
  });

  it('uma escrita que falha não envenena a fila: a seguinte grava', async () => {
    const store = storeLento();
    let quebrar = true;
    const intermitente: KVStore = {
      getItem: store.getItem,
      setItem: async (k, v) => {
        if (quebrar) throw new Error('storage indisponível');
        await store.setItem(k, v);
      },
      removeItem: store.removeItem,
    };

    await expect(gravarPreferencia('saude-do-sono', NUVEM_PADRAO, intermitente)).rejects.toThrow();
    quebrar = false;
    await gravarPreferencia('saude-do-sono', SEM_MODELO, intermitente);
    expect(await lerPreferencia('saude-do-sono', store)).toBe(SEM_MODELO);
  });
});
