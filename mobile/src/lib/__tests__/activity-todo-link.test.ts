import { describe, it, expect } from '@jest/globals';
import { planLink, activityTodoIcon, type LinkOcc } from '../activity-todo-link';

const DAY = '2026-05-22';

describe('planLink', () => {
  it('sem ocorrências → cria e conclui a do dia', () => {
    expect(planLink([], DAY)).toEqual({ kind: 'create-resolve', dueDate: DAY });
  });

  it('ocorrência pendente no dia → resolve', () => {
    const occs: LinkOcc[] = [{ id: 'a', dueDate: DAY, status: 'pending' }];
    expect(planLink(occs, DAY)).toEqual({ kind: 'resolve', occId: 'a' });
  });

  it('ocorrência pendente atrasada (due < dia) → resolve a atrasada', () => {
    const occs: LinkOcc[] = [{ id: 'a', dueDate: '2026-05-19', status: 'pending' }];
    expect(planLink(occs, DAY)).toEqual({ kind: 'resolve', occId: 'a' });
  });

  it('ocorrência pendente sem data (event) → resolve', () => {
    const occs: LinkOcc[] = [{ id: 'a', dueDate: null, status: 'pending' }];
    expect(planLink(occs, DAY)).toEqual({ kind: 'resolve', occId: 'a' });
  });

  it('só pendente futura (due > dia) → cria e conclui a do dia (não toca a futura)', () => {
    const occs: LinkOcc[] = [{ id: 'fut', dueDate: '2026-05-29', status: 'pending' }];
    expect(planLink(occs, DAY)).toEqual({ kind: 'create-resolve', dueDate: DAY });
  });

  it('já concluída no dia → skip (idempotente, não duplica)', () => {
    const occs: LinkOcc[] = [{ id: 'a', dueDate: DAY, status: 'done' }];
    expect(planLink(occs, DAY)).toEqual({ kind: 'skip' });
  });

  it('concluída em outro dia, nada pendente → cria e conclui a do dia', () => {
    const occs: LinkOcc[] = [{ id: 'a', dueDate: '2026-05-21', status: 'done' }];
    expect(planLink(occs, DAY)).toEqual({ kind: 'create-resolve', dueDate: DAY });
  });

  it('várias pendentes elegíveis → resolve a mais recente (maior due ≤ dia)', () => {
    const occs: LinkOcc[] = [
      { id: 'velha', dueDate: '2026-05-18', status: 'pending' },
      { id: 'recente', dueDate: '2026-05-21', status: 'pending' },
      { id: 'futura', dueDate: '2026-05-30', status: 'pending' },
    ];
    expect(planLink(occs, DAY)).toEqual({ kind: 'resolve', occId: 'recente' });
  });
});

describe('activityTodoIcon', () => {
  it('mapeia tipos conhecidos para ícones Ionicons', () => {
    expect(activityTodoIcon(13)).toBe('bicycle-outline'); // Ciclismo
    expect(activityTodoIcon(46)).toBe('water-outline'); // Natação
    expect(activityTodoIcon(57)).toBe('body-outline'); // Yoga
  });

  it('usa o default genérico para tipos sem mapeamento', () => {
    expect(activityTodoIcon(37)).toBe('barbell-outline'); // Corrida
    expect(activityTodoIcon(999)).toBe('barbell-outline');
  });
});
