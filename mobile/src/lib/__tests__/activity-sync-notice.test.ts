import { describe, it, expect } from '@jest/globals';
import { activitySyncNotice } from '../activity-sync-notice';

// Códigos HealthKit dos tipos usados aqui (ver ACTIVITY_TYPE_LABELS no shared).
const YOGA = 57;
const CORRIDA = 37;
const MUSCULACAO = 50;
const CICLISMO = 13;
const DESCONHECIDO = 9999;

describe('activitySyncNotice', () => {
  it('sem atividades, não há o que anunciar', () => {
    expect(activitySyncNotice([])).toBeNull();
  });

  it('uma atividade é nomeada pelo tipo', () => {
    expect(activitySyncNotice([YOGA])).toEqual({
      title: 'Atividade sincronizada',
      body: 'Atividade de Yoga sincronizada.',
    });
  });

  it('várias do mesmo tipo concordam em número', () => {
    expect(activitySyncNotice([CORRIDA, CORRIDA])).toEqual({
      title: 'Atividades sincronizadas',
      body: '2 atividades de Corrida sincronizadas.',
    });
  });

  it('tipos misturados listam cada um, com o dominante na frente', () => {
    const notice = activitySyncNotice([YOGA, CORRIDA, CORRIDA]);
    expect(notice?.body).toBe('3 atividades sincronizadas: 2× Corrida e Yoga.');
  });

  it('acima de três tipos, o excedente vira "mais N"', () => {
    const notice = activitySyncNotice([YOGA, CORRIDA, MUSCULACAO, CICLISMO]);
    // Todos com contagem 1: os três primeiros listados, o quarto some no resumo.
    expect(notice?.body).toMatch(/^4 atividades sincronizadas: .+ e mais 1\.$/);
  });

  // "Atividade de Treino sincronizada" é redundante — 'Treino' é o label genérico
  // que o shared usa para os dezenas de códigos raros do HealthKit.
  it('tipo desconhecido cai numa frase que não soa redundante', () => {
    expect(activitySyncNotice([DESCONHECIDO])?.body).toBe('Treino sincronizado.');
    expect(activitySyncNotice([DESCONHECIDO, DESCONHECIDO])?.body).toBe('2 treinos sincronizados.');
  });
});
