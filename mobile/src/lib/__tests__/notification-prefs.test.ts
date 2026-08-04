import { describe, it, expect } from '@jest/globals';
import { resolveNotificationPrefs, DEFAULT_NOTIFICATION_PREFS } from '@vitale/shared';

describe('resolveNotificationPrefs', () => {
  it('devolve os defaults quando o jsonb é vazio/ausente', () => {
    expect(resolveNotificationPrefs({})).toEqual(DEFAULT_NOTIFICATION_PREFS);
    expect(resolveNotificationPrefs(null)).toEqual(DEFAULT_NOTIFICATION_PREFS);
    expect(resolveNotificationPrefs(undefined)).toEqual(DEFAULT_NOTIFICATION_PREFS);
  });

  it('não muta o objeto default (retorna cópias das agendas)', () => {
    const a = resolveNotificationPrefs({});
    a.weeklyRetro.hour = 23;
    expect(DEFAULT_NOTIFICATION_PREFS.weeklyRetro.hour).toBe(8);
  });

  it('faz merge parcial preservando os defaults das chaves ausentes', () => {
    const out = resolveNotificationPrefs({ activitySync: false, weeklyRetro: { enabled: false } });
    expect(out.activitySync).toBe(false);
    expect(out.dailyDigest).toBe(true); // default preservado
    expect(out.weeklyRetro.enabled).toBe(false);
    expect(out.weeklyRetro.weekday).toBe(1); // default preservado
    expect(out.weeklyRetro.hour).toBe(8);
  });

  it('ignora tipos inválidos e cai nos defaults', () => {
    const out = resolveNotificationPrefs({
      dailyDigest: 'sim',
      monthlyRetro: { day: 'x', hour: 15 },
    });
    expect(out.dailyDigest).toBe(true);
    expect(out.monthlyRetro.day).toBe(1); // 'x' inválido → default
    expect(out.monthlyRetro.hour).toBe(15); // válido → aplicado
  });
});
