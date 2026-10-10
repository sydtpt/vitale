/**
 * BARREIRA — a migalha não engole o que o banco disse.
 *
 * Em 10/10/2026 a primeira migalha do piso provou o que nenhuma suposição tinha
 * achado: `saveSurfaceFailure` falhava, e era por isso que `surface_meta` estava
 * nulo nas cinco pedaladas. Mas ela saiu assim:
 *
 *     piso 94E3A0EF-…: falha ao gravar a falha — [object Object]
 *
 * O erro do PostgREST é um objeto simples, não um `Error`, e o
 * `e instanceof Error ? e.message : String(e)` que parece idiomático vira
 * `[object Object]` justamente no caso em que a mensagem mais importa. Custou um
 * build inteiro para descobrir só que havia um erro.
 */
import { describe, it, expect } from '@jest/globals';
import { descreverErro } from '../sync-breadcrumbs';

describe('BARREIRA — descreverErro', () => {
  it('o erro do PostgREST sai legível, não [object Object]', () => {
    const erro = {
      message: 'new row violates row-level security policy',
      code: '42501',
      details: 'for table activity_routes',
      hint: null,
    };
    const texto = descreverErro(erro);

    expect(texto).not.toContain('[object Object]');
    expect(texto).toContain('row-level security');
    expect(texto).toContain('42501');
    expect(texto).toContain('activity_routes');
  });

  it('`Error` continua saindo pela mensagem', () => {
    expect(descreverErro(new Error('geocode HTTP 429'))).toBe('geocode HTTP 429');
  });

  it('objeto sem as chaves conhecidas vira JSON, não [object Object]', () => {
    expect(descreverErro({ status: 503, body: 'nope' })).toBe('{"status":503,"body":"nope"}');
  });

  it('objeto com ciclo ainda diz alguma coisa', () => {
    const ciclico: Record<string, unknown> = { a: 1 };
    ciclico['self'] = ciclico;
    const texto = descreverErro(ciclico);
    expect(texto).not.toContain('[object Object]');
    expect(texto).toContain('a,self');
  });

  it('primitivos passam direto', () => {
    expect(descreverErro('cancelado')).toBe('cancelado');
    expect(descreverErro(undefined)).toBe('undefined');
  });
});
