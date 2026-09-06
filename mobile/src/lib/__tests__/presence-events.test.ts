import { describe, it, expect } from '@jest/globals';
import {
  PRESENCE_LOG_CAP,
  SHORT_GAP_MIN,
  SHORT_STAY_MIN,
  appendPresenceEvent,
  clearPresenceLog,
  presenceDay,
  presenceEventId,
  readPresenceLog,
  summarizePresence,
  vitalsByPlace,
  type PresenceEvent,
  type PresenceEventKind,
} from '../presence-events';
import type { KVStore } from '../local-store';

function memStore(): KVStore {
  const map = new Map<string, string>();
  return {
    getItem: async (k) => map.get(k) ?? null,
    setItem: async (k, v) => void map.set(k, v),
    removeItem: async (k) => void map.delete(k),
  };
}

/** `at` em hora local de Bruxelas para o dia fixo abaixo, para o fuso importar. */
function ev(
  placeId: string,
  kind: PresenceEventKind,
  at: string,
  extra: Partial<PresenceEvent> = {},
): PresenceEvent {
  return {
    id: presenceEventId(placeId, kind, at),
    placeId,
    kind,
    at,
    tz: 'Europe/Brussels',
    appState: 'background',
    ...extra,
  };
}

describe('presence-events · log', () => {
  it('grava e deduplica pelo id', async () => {
    const s = memStore();
    const e = ev('casa', 'enter', '2026-09-06T08:00:00.000Z');
    await appendPresenceEvent(e, s);
    await appendPresenceEvent(e, s); // o iOS reentrega; não pode dobrar
    expect(await readPresenceLog(s)).toHaveLength(1);
  });

  it('distingue enter de exit no mesmo instante e lugar', async () => {
    const s = memStore();
    const at = '2026-09-06T08:00:00.000Z';
    await appendPresenceEvent(ev('casa', 'exit', at), s);
    await appendPresenceEvent(ev('casa', 'enter', at), s);
    expect(await readPresenceLog(s)).toHaveLength(2);
  });

  it('respeita o teto descartando o mais antigo', async () => {
    const s = memStore();
    for (let i = 0; i < PRESENCE_LOG_CAP + 5; i += 1) {
      const at = new Date(Date.UTC(2026, 8, 6, 0, i)).toISOString();
      await appendPresenceEvent(ev('casa', 'enter', at), s);
    }
    const log = await readPresenceLog(s);
    expect(log).toHaveLength(PRESENCE_LOG_CAP);
    // Os cinco primeiros saíram; o primeiro sobrevivente é o minuto 5.
    expect(log[0].at).toBe(new Date(Date.UTC(2026, 8, 6, 0, 5)).toISOString());
  });

  it('limpa sem apagar nada além do log', async () => {
    const s = memStore();
    await appendPresenceEvent(ev('casa', 'enter', '2026-09-06T08:00:00.000Z'), s);
    await clearPresenceLog(s);
    expect(await readPresenceLog(s)).toEqual([]);
  });
});

describe('presence-events · dia local', () => {
  it('usa o fuso gravado no evento, não o do processo', () => {
    // 22:30 UTC é 00:30 do dia seguinte em Bruxelas (verão, UTC+2).
    const e = ev('casa', 'enter', '2026-09-06T22:30:00.000Z');
    expect(presenceDay(e)).toBe('2026-09-07');
  });

  it('degrada para UTC quando o fuso é inválido', () => {
    const e = ev('casa', 'enter', '2026-09-06T22:30:00.000Z', { tz: 'Nao/Existe' });
    expect(presenceDay(e)).toBe('2026-09-06');
  });
});

describe('presence-events · resumo', () => {
  it('conta uma permanência curta como passagem', () => {
    const r = summarizePresence([
      ev('mercado', 'enter', '2026-09-06T10:00:00.000Z'),
      ev('mercado', 'exit', '2026-09-06T10:05:00.000Z'), // 5 min < 8
    ]);
    expect(r.shortStays).toBe(1);
    expect(r.shortGaps).toBe(0);
    expect(r.openEnters).toBe(0);
  });

  it('não conta permanência acima do limiar', () => {
    const r = summarizePresence([
      ev('mercado', 'enter', '2026-09-06T10:00:00.000Z'),
      ev('mercado', 'exit', '2026-09-06T10:30:00.000Z'),
    ]);
    expect(r.shortStays).toBe(0);
  });

  it('conta um retorno rápido como colagem', () => {
    const r = summarizePresence([
      ev('casa', 'enter', '2026-09-06T08:00:00.000Z'),
      ev('casa', 'exit', '2026-09-06T09:00:00.000Z'),
      ev('casa', 'enter', '2026-09-06T09:10:00.000Z'), // 10 min < 20: jogou o lixo
      ev('casa', 'exit', '2026-09-06T18:00:00.000Z'),
    ]);
    expect(r.shortGaps).toBe(1);
    expect(r.shortStays).toBe(0);
  });

  it('não pareia lugares diferentes', () => {
    // Sair de casa e entrar no escritório não é permanência curta em lugar nenhum.
    const r = summarizePresence([
      ev('casa', 'enter', '2026-09-06T08:00:00.000Z'),
      ev('casa', 'exit', '2026-09-06T08:02:00.000Z'),
      ev('escritorio', 'enter', '2026-09-06T08:04:00.000Z'),
    ]);
    expect(r.shortStays).toBe(1); // só o de casa
    expect(r.shortGaps).toBe(0);
  });

  it('conta enter sem exit como borda a inferir, menos o que está em curso', () => {
    const r = summarizePresence([
      ev('casa', 'enter', '2026-09-06T08:00:00.000Z'), // nunca fechou
      ev('casa', 'enter', '2026-09-06T12:00:00.000Z'),
      ev('casa', 'exit', '2026-09-06T13:00:00.000Z'),
      ev('escritorio', 'enter', '2026-09-06T14:00:00.000Z'), // a visita de agora
    ]);
    expect(r.openEnters).toBe(1);
  });

  it('ordena antes de parear — evento entregue fora de ordem não vira duração negativa', () => {
    const r = summarizePresence([
      ev('mercado', 'exit', '2026-09-06T10:05:00.000Z'),
      ev('mercado', 'enter', '2026-09-06T10:00:00.000Z'),
    ]);
    expect(r.shortStays).toBe(1);
    expect(r.openEnters).toBe(0);
  });

  it('agrupa por dia local e aponta o pior', () => {
    const r = summarizePresence([
      ev('casa', 'enter', '2026-09-06T08:00:00.000Z'),
      ev('casa', 'exit', '2026-09-06T09:00:00.000Z'),
      ev('casa', 'enter', '2026-09-07T08:00:00.000Z'),
    ]);
    expect(r.days).toBe(2);
    expect(r.perDay).toEqual([
      { day: '2026-09-06', count: 2 },
      { day: '2026-09-07', count: 1 },
    ]);
    expect(r.busiestDay).toEqual({ day: '2026-09-06', count: 2 });
  });

  it('conta fix velho — coordenada de mais de 5 min não serve para nomear lugar', () => {
    const r = summarizePresence([
      ev('casa', 'enter', '2026-09-06T08:00:00.000Z', { fixAgeS: 30 }),
      ev('casa', 'exit', '2026-09-06T09:00:00.000Z', { fixAgeS: 900 }),
      ev('casa', 'enter', '2026-09-06T10:00:00.000Z'), // sem fix nenhum
    ]);
    expect(r.staleFixes).toBe(1);
  });

  it('resume um log vazio sem quebrar', () => {
    const r = summarizePresence([]);
    expect(r).toMatchObject({ total: 0, days: 0, busiestDay: null, openEnters: 0 });
  });

  it('conta e último evento por lugar', () => {
    const v = vitalsByPlace([
      ev('casa', 'enter', '2026-09-06T08:00:00.000Z'),
      ev('casa', 'exit', '2026-09-06T09:00:00.000Z'),
      ev('escritorio', 'enter', '2026-09-06T09:30:00.000Z'),
    ]);
    expect(v.get('casa')).toEqual({ count: 2, lastAt: '2026-09-06T09:00:00.000Z' });
    expect(v.get('escritorio')?.count).toBe(1);
  });

  it('o lugar mudo não aparece — é o que a lista precisa distinguir', () => {
    const v = vitalsByPlace([ev('casa', 'enter', '2026-09-06T08:00:00.000Z')]);
    expect(v.get('academia')).toBeUndefined();
  });

  it('o último é o mais recente mesmo com evento fora de ordem', () => {
    const v = vitalsByPlace([
      ev('casa', 'exit', '2026-09-06T18:00:00.000Z'),
      ev('casa', 'enter', '2026-09-06T08:00:00.000Z'),
    ]);
    expect(v.get('casa')?.lastAt).toBe('2026-09-06T18:00:00.000Z');
  });

  it('mediana da precisão ignora evento sem fix e resiste a um fix péssimo', () => {
    const r = summarizePresence([
      ev('casa', 'enter', '2026-09-06T08:00:00.000Z', { accuracyM: 30 }),
      ev('casa', 'exit', '2026-09-06T09:00:00.000Z', { accuracyM: 40 }),
      // O fix de 800 m ao sair do metrô puxaria a média; a mediana o ignora.
      ev('casa', 'enter', '2026-09-06T10:00:00.000Z', { accuracyM: 800 }),
      ev('casa', 'exit', '2026-09-06T11:00:00.000Z'), // sem fix: não entra
    ]);
    expect(r.medianAccuracyM).toBe(40);
  });

  it('sem nenhum fix a mediana é null, não zero', () => {
    const r = summarizePresence([ev('casa', 'enter', '2026-09-06T08:00:00.000Z')]);
    expect(r.medianAccuracyM).toBeNull();
  });

  it('os limiares são os que a proposta assumiu', () => {
    // Se a fase 0 os desmentir, este teste muda junto com a proposta.
    expect(SHORT_STAY_MIN).toBe(8);
    expect(SHORT_GAP_MIN).toBe(20);
  });
});
