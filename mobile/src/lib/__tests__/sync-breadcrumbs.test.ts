/**
 * As migalhas existem para diagnosticar o sync em background — o cenário em que
 * nenhuma outra ferramenta alcança. Se elas próprias perderem eventos, o
 * diagnóstico mente, e mente na direção mais cara: "nenhuma migalha" seria lido
 * como "o iOS não acordou o app" quando na verdade o registro é que se perdeu.
 *
 * Por isso o que precisa de cobertura aqui não é o formato, é a **corrida**:
 * `app-launch` e `sync-start` saem quase juntas, e `AsyncStorage` não tem
 * read-modify-write atômico.
 */
import { describe, it, expect, beforeEach } from '@jest/globals';
import {
  recordBreadcrumb,
  readBreadcrumbs,
  clearBreadcrumbs,
  BREADCRUMB_CAP,
} from '../sync-breadcrumbs';
import type { KVStore } from '../local-store';

/** Store com latência: sem ela, a corrida não se manifesta em teste. */
function slowStore(delayMs = 1): KVStore {
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
  };
}

describe('migalhas do sync', () => {
  let store: KVStore;
  beforeEach(async () => {
    store = slowStore();
    await clearBreadcrumbs(store);
  });

  it('registra evento e detalhe, do mais recente para o mais antigo', async () => {
    await recordBreadcrumb('app-launch', 'state=background', store);
    await recordBreadcrumb('sync-start', 'state=background', store);

    const log = await readBreadcrumbs(store);
    expect(log.map((m) => m.event)).toEqual(['sync-start', 'app-launch']);
    expect(log[1].detail).toBe('state=background');
    expect(Date.parse(log[0].at)).not.toBeNaN();
  });

  it('não perde eventos disparados em paralelo — o par que dá o diagnóstico', async () => {
    // Exatamente o que acontece no boot: nada aguarda a migalha anterior.
    await Promise.all([
      recordBreadcrumb('app-launch', 'state=background', store),
      recordBreadcrumb('sync-start', undefined, store),
      recordBreadcrumb('observer', undefined, store),
      recordBreadcrumb('delta', '120ms', store),
    ]);

    const log = await readBreadcrumbs(store);
    expect(log).toHaveLength(4);
    expect(new Set(log.map((m) => m.event))).toEqual(
      new Set(['app-launch', 'sync-start', 'observer', 'delta']),
    );
  });

  it('corta no teto mantendo as mais recentes', async () => {
    for (let i = 0; i < BREADCRUMB_CAP + 5; i++) {
      await recordBreadcrumb('delta', `n=${i}`, store);
    }

    const log = await readBreadcrumbs(store);
    expect(log).toHaveLength(BREADCRUMB_CAP);
    expect(log[0].detail).toBe(`n=${BREADCRUMB_CAP + 4}`);
  });

  it('falha de storage não propaga — diagnóstico não derruba o sync', async () => {
    const quebrado: KVStore = {
      getItem: async () => {
        throw new Error('storage indisponível');
      },
      setItem: async () => {
        throw new Error('storage indisponível');
      },
      removeItem: async () => {},
    };

    await expect(recordBreadcrumb('observer', undefined, quebrado)).resolves.toBeUndefined();
  });
});
