/**
 * A ponte da Presença — o que **só o hospedeiro** pode errar.
 *
 * O juízo tem teste no núcleo, contra o log real de 24 dias (`presence.test.ts`, 54
 * checagens). Repetir aqui mediria duas vezes a mesma coisa e nenhuma vez a ponte.
 *
 * O que é só daqui, e o que custa errar:
 *
 *  - **o lugar de uma visita é a linha VIGENTE no dia da chegada**, não a de hoje. Errar
 *    isso aponta uma visita de antes da mudança de casa para o endereço novo — e a
 *    feature de nome das rotas passa a responder errado sobre pedaladas antigas;
 *  - **o `client_event_id`**, que é o que faz reenviar ser barato em vez de duplicar;
 *  - **a permissão caída marca os dias como incompletos**, porque o modo de falha nº 1
 *    da feature não é errar, é emudecer;
 *  - **criar o lugar remoto uma vez só**, e gravar o mapa local → remoto de volta no
 *    aparelho.
 */
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

/** Quantos envios chegaram ao banco, e a falha que a leitura dos lugares deve devolver. */
const mockEnvio: { chamadas: number; falha: unknown } = { chamadas: 0, falha: null };

const banco: {
  lugares: Record<string, unknown>[];
  visitasEnviadas: Record<string, unknown>[];
  diasGravados: Record<string, unknown>[];
  criados: Record<string, unknown>[];
  raiosCarimbados: { id: string; raio: number }[];
} = { lugares: [], visitasEnviadas: [], diasGravados: [], criados: [], raiosCarimbados: [] };

const aparelho: {
  lugares: Record<string, unknown>[];
  log: Record<string, unknown>[];
  gravados: Record<string, unknown>[][];
  permissaoBackground: boolean;
} = { lugares: [], log: [], gravados: [], permissaoBackground: true };

jest.mock('../../lib/supabase', () => ({ supabase: { __fake: true } }));
const breadcrumbs: string[] = [];
jest.mock('../../lib/sync-breadcrumbs', () => ({
  recordBreadcrumb: (_e: string, d?: string) => {
    breadcrumbs.push(d ?? '');
    return Promise.resolve();
  },
}));

jest.mock('../presence', () => ({
  getPresencePermission: () =>
    Promise.resolve({ foreground: true, background: aparelho.permissaoBackground, blocked: false }),
}));

jest.mock('../../lib/presence-events', () => ({
  readPresenceLog: () => Promise.resolve(aparelho.log),
}));

jest.mock('../../lib/presence-places', () => ({
  readPresencePlaces: () => Promise.resolve(aparelho.lugares),
  writePresencePlaces: (ls: Record<string, unknown>[]) => {
    aparelho.gravados.push(ls);
    aparelho.lugares = ls;
    return Promise.resolve();
  },
}));

jest.mock('@vitale/shared', () => {
  const real = jest.requireActual<Record<string, unknown>>('@vitale/shared');
  return {
    ...real,
    fetchLugares: () => {
      return mockEnvio.falha ? Promise.reject(mockEnvio.falha) : Promise.resolve(banco.lugares);
    },
    definirRaioDoGeofence: (_db: unknown, _u: string, id: string, raio: number) => {
      banco.raiosCarimbados.push({ id, raio });
      return Promise.resolve();
    },
    criarLugar: (_db: unknown, _u: string, novo: Record<string, unknown>) => {
      const id = `remoto-${banco.criados.length + 1}`;
      banco.criados.push({ ...novo, id });
      banco.lugares.push({
        id,
        identidade: novo['identidade'],
        activeFrom: '2025-01-01',
        activeTo: null,
      });
      return Promise.resolve(id);
    },
    enviarVisitas: (_db: unknown, _u: string, vs: Record<string, unknown>[]) => {
      mockEnvio.chamadas += 1;
      banco.visitasEnviadas.push(...vs);
      return Promise.resolve(vs.length);
    },
    gravarPlaceDays: (_db: unknown, _u: string, ds: Record<string, unknown>[]) => {
      banco.diasGravados.push(...ds);
      return Promise.resolve();
    },
  };
});

import {
  sincronizarPresenca,
  sincronizarPresencaSemRepetir,
  sincronizarPresencaEmSilencio,
  __zerarTravasDoEnvio,
  INTERVALO_DO_ENVIO_MS,
} from '../presence-sync';

const U = 'u-1';
const TZ = 'Europe/Brussels';

function evento(at: string, placeId: string, kind: 'enter' | 'exit', redundant = false) {
  return { id: `${placeId}:${kind}:${at}`, placeId, kind, at, tz: TZ, appState: 'background', redundant };
}

beforeEach(() => {
  __zerarTravasDoEnvio();
  mockEnvio.chamadas = 0;
  mockEnvio.falha = null;
  breadcrumbs.length = 0;
  banco.lugares = [];
  banco.visitasEnviadas = [];
  banco.diasGravados = [];
  banco.criados = [];
  banco.raiosCarimbados = [];
  aparelho.gravados = [];
  aparelho.permissaoBackground = true;
  aparelho.lugares = [{ id: 'local-casa', name: 'Casa', lat: 50.87, lon: 4.37, radiusM: 150 }];
  aparelho.log = [
    evento('2026-09-10T06:00:00.000Z', 'local-casa', 'exit'),
    evento('2026-09-10T16:00:00.000Z', 'local-casa', 'enter'),
    evento('2026-09-11T06:00:00.000Z', 'local-casa', 'exit'),
  ];
});

describe('sincronizarPresenca', () => {
  it('cria o lugar remoto uma vez e grava o mapa de volta no aparelho', async () => {
    const r = await sincronizarPresenca(U);
    expect(r.lugaresCriados).toBe(1);
    expect(banco.criados[0]).toMatchObject({ identidade: 'casa', kind: 'home', label: 'Casa' });
    // O raio que sobe é o do geofence, não o da âncora de rota.
    expect(banco.criados[0]!['geofenceRadiusM']).toBe(150);
    // E o mapa local → remoto fica persistido, senão a próxima sync cria de novo.
    expect(aparelho.lugares[0]).toMatchObject({ id: 'local-casa', remoteId: 'remoto-1', identidade: 'casa' });
  });

  it('o papel do lugar sai da identidade — "Trabalho" é work, não "other"', async () => {
    // Nascer `other` deixava a tela procurando `kind = 'work'` e mostrando dois traços:
    // implementado e mudo, que parece defeito de dado.
    aparelho.lugares = [{ id: 'local-trab', name: 'Trabalho', lat: 50.8, lon: 4.4, radiusM: 220 }];
    aparelho.log = [
      evento('2026-09-10T08:00:00.000Z', 'local-trab', 'enter'),
      evento('2026-09-10T17:00:00.000Z', 'local-trab', 'exit'),
    ];
    await sincronizarPresenca(U);
    expect(banco.criados[0]).toMatchObject({ identidade: 'trabalho', kind: 'work' });
  });

  it('o papel ESCOLHIDO pelo dono ganha do palpite do mapa', async () => {
    aparelho.lugares = [
      { id: 'local-x', name: 'Padaria do Zé', lat: 50.8, lon: 4.4, radiusM: 150, kind: 'food' },
    ];
    aparelho.log = [
      evento('2026-09-10T08:00:00.000Z', 'local-x', 'enter'),
      evento('2026-09-10T09:00:00.000Z', 'local-x', 'exit'),
    ];
    await sincronizarPresenca(U);
    expect(banco.criados[0]!['kind']).toBe('food');
  });

  it('identidade que o mapa não conhece vira "other", que é o honesto para "não sei"', async () => {
    aparelho.lugares = [{ id: 'local-x', name: 'Padaria do Zé', lat: 50.8, lon: 4.4, radiusM: 150 }];
    aparelho.log = [
      evento('2026-09-10T08:00:00.000Z', 'local-x', 'enter'),
      evento('2026-09-10T09:00:00.000Z', 'local-x', 'exit'),
    ];
    await sincronizarPresenca(U);
    expect(banco.criados[0]!['kind']).toBe('other');
  });

  it('o lugar criado vale desde o PRIMEIRO EVENTO dele, não desde hoje', async () => {
    // O defeito de 02/10: o Trabalho nasceu valendo a partir de hoje e as seis visitas
    // dele, de 08/09 em diante, ficaram fora da vigência do próprio lugar.
    await sincronizarPresenca(U);
    expect(banco.criados[0]!['activeFrom']).toBe('2026-09-10');
  });

  it('adotar um lugar que já existia carimba o raio do geofence que faltava', async () => {
    banco.lugares = [
      { id: 'remoto-ja', identidade: 'casa', activeFrom: '2025-01-01', activeTo: null, geofenceRadiusM: null },
    ];
    aparelho.lugares = [{ ...aparelho.lugares[0]!, identidade: 'casa' }];
    await sincronizarPresenca(U);
    expect(banco.raiosCarimbados).toEqual([{ id: 'remoto-ja', raio: 150 }]);
  });

  it('não recarimba o raio quando ele já está lá', async () => {
    banco.lugares = [
      { id: 'remoto-ja', identidade: 'casa', activeFrom: '2025-01-01', activeTo: null, geofenceRadiusM: 150 },
    ];
    aparelho.lugares = [{ ...aparelho.lugares[0]!, identidade: 'casa' }];
    await sincronizarPresenca(U);
    expect(banco.raiosCarimbados).toEqual([]);
  });

  it('não recria o lugar quando ele já existe no banco', async () => {
    banco.lugares = [{ id: 'remoto-ja', identidade: 'casa', activeFrom: '2025-01-01', activeTo: null, geofenceRadiusM: 150 }];
    aparelho.lugares = [{ ...aparelho.lugares[0]!, identidade: 'casa' }];
    const r = await sincronizarPresenca(U);
    expect(r.lugaresCriados).toBe(0);
    expect(banco.visitasEnviadas[0]!['placeId']).toBe('remoto-ja');
  });

  it('o client_event_id é o id do evento de chegada — é o que faz reenviar não duplicar', async () => {
    await sincronizarPresenca(U);
    expect(banco.visitasEnviadas).toHaveLength(1);
    expect(banco.visitasEnviadas[0]).toMatchObject({
      clientEventId: 'local-casa:enter:2026-09-10T16:00:00.000Z',
      arrivedAt: '2026-09-10T16:00:00.000Z',
      source: 'geofence',
    });
  });

  it('reenviar é idempotente: a segunda chamada manda o MESMO client_event_id', async () => {
    await sincronizarPresenca(U);
    const primeira = banco.visitasEnviadas.map((v) => v['clientEventId']);
    banco.visitasEnviadas = [];
    await sincronizarPresenca(U);
    expect(banco.visitasEnviadas.map((v) => v['clientEventId'])).toEqual(primeira);
  });

  it('a visita vai para a linha VIGENTE no dia da chegada, não para a de hoje', async () => {
    banco.lugares = [
      { id: 'casa-antiga', identidade: 'casa', activeFrom: '2025-01-24', activeTo: '2026-09-10' },
      { id: 'casa-nova', identidade: 'casa', activeFrom: '2026-09-11', activeTo: null },
    ];
    aparelho.lugares = [{ ...aparelho.lugares[0]!, identidade: 'casa', remoteId: 'casa-nova' }];
    aparelho.log = [
      evento('2026-09-09T06:00:00.000Z', 'local-casa', 'exit'),
      evento('2026-09-09T16:00:00.000Z', 'local-casa', 'enter'),
      evento('2026-09-09T20:00:00.000Z', 'local-casa', 'exit'),
      evento('2026-09-12T06:00:00.000Z', 'local-casa', 'enter'),
      evento('2026-09-12T20:00:00.000Z', 'local-casa', 'exit'),
    ];
    await sincronizarPresenca(U);
    const por = Object.fromEntries(
      banco.visitasEnviadas.map((v) => [String(v['arrivedAt']).slice(0, 10), v['placeId']]),
    );
    expect(por['2026-09-09']).toBe('casa-antiga');
    expect(por['2026-09-12']).toBe('casa-nova');
  });

  it('sem permissão de fundo, os dias sobem INCOMPLETOS — buraco, não número menor', async () => {
    aparelho.permissaoBackground = false;
    const r = await sincronizarPresenca(U);
    expect(r.incompletos).toBeGreaterThan(0);
    expect(banco.diasGravados.every((d) => d['incomplete'] === true)).toBe(true);
  });

  it('com permissão em pé, nenhum dia é marcado incompleto', async () => {
    const r = await sincronizarPresenca(U);
    expect(r.incompletos).toBe(0);
    expect(banco.diasGravados.some((d) => d['incomplete'] === true)).toBe(false);
  });

  it('o rollup carrega a identidade, que é por onde a métrica agrega', async () => {
    await sincronizarPresenca(U);
    const comLugar = banco.diasGravados.filter((d) => d['placeId'] !== null);
    expect(comLugar.length).toBeGreaterThan(0);
    expect(comLugar.every((d) => d['identidade'] === 'casa')).toBe(true);
    // E o "fora" sobe com os dois nulos — é um lugar, não ausência de dado.
    const fora = banco.diasGravados.filter((d) => d['placeId'] === null);
    expect(fora.every((d) => d['identidade'] === null)).toBe(true);
  });

  it('relatório de estado não vira visita', async () => {
    aparelho.log = [
      ...aparelho.log,
      evento('2026-09-10T17:00:00.000Z', 'local-casa', 'enter', true),
      evento('2026-09-10T18:00:00.000Z', 'local-casa', 'enter', true),
    ];
    await sincronizarPresenca(U);
    expect(banco.visitasEnviadas).toHaveLength(1);
  });

  it('log vazio não fala com o banco', async () => {
    aparelho.log = [];
    const r = await sincronizarPresenca(U);
    expect(r).toEqual({ visitas: 0, dias: 0, lugaresCriados: 0, incompletos: 0 });
    expect(banco.visitasEnviadas).toHaveLength(0);
  });
});

describe('o envio automático', () => {
  const T0 = 1_000_000_000_000;

  it('dentro do intervalo não envia de novo — e o botão (forcar) envia', async () => {
    expect(await sincronizarPresencaSemRepetir(U, { agora: T0 })).not.toBeNull();
    expect(await sincronizarPresencaSemRepetir(U, { agora: T0 + 60_000 })).toBeNull();
    expect(mockEnvio.chamadas).toBe(1);

    expect(await sincronizarPresencaSemRepetir(U, { agora: T0 + 60_000, forcar: true })).not.toBeNull();
    expect(await sincronizarPresencaSemRepetir(U, { agora: T0 + 60_000 + INTERVALO_DO_ENVIO_MS })).not.toBeNull();
    expect(mockEnvio.chamadas).toBe(3);
  });

  it('quem chama durante um envio recebe o MESMO envio, não um segundo', async () => {
    const a = sincronizarPresencaSemRepetir(U, { agora: T0 });
    const b = sincronizarPresencaSemRepetir(U, { agora: T0, forcar: true });
    expect(b).toBe(a);
    await a;
    expect(mockEnvio.chamadas).toBe(1);
  });

  it('falha no automático vira breadcrumb, nunca exceção', async () => {
    // O PostgrestError não é um Error — e é ele que tem de chegar legível.
    mockEnvio.falha = { message: 'sem rede', code: 'PGRST000' };
    await expect(sincronizarPresencaEmSilencio(U, { agora: T0 })).resolves.toBeNull();
    expect(breadcrumbs.some((b) => b.startsWith('envio automático falhou') && b.includes('sem rede'))).toBe(true);
  });
});
