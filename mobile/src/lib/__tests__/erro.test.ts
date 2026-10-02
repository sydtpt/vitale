/**
 * O que a tela mostra quando algo falha.
 *
 * Existe por um caso real: em 02/10/2026 o primeiro toque em "Enviar para o banco"
 * falhou com `42P10: there is no unique or exclusion constraint matching the ON CONFLICT
 * specification` — causa exata, com código — e o aparelho mostrou `[object Object]`.
 * O erro estava na mão e a tela o jogou fora.
 */
import { describe, it, expect } from '@jest/globals';
import { mensagemDeErro } from '../erro';

describe('mensagemDeErro', () => {
  it('o erro do Supabase NÃO é um Error — e é por isso que este arquivo existe', () => {
    const postgrest = {
      message: 'there is no unique or exclusion constraint matching the ON CONFLICT specification',
      code: '42P10',
      details: null,
      hint: null,
    };
    expect(String(postgrest)).toBe('[object Object]');
    expect(mensagemDeErro(postgrest)).toBe(
      'there is no unique or exclusion constraint matching the ON CONFLICT specification (42P10)',
    );
  });

  it('acrescenta o detalhe, que é onde o Postgres põe o nome do que faltou', () => {
    expect(
      mensagemDeErro({ message: 'violates check constraint', code: '23514', details: 'Failing row…' }),
    ).toBe('violates check constraint (23514) Failing row…');
  });

  it('usa a dica quando não há detalhe', () => {
    expect(mensagemDeErro({ message: 'x', hint: 'tente y' })).toBe('x tente y');
  });

  it('Error comum continua simples', () => {
    expect(mensagemDeErro(new Error('rede caiu'))).toBe('rede caiu');
  });

  it('string passa direto', () => {
    expect(mensagemDeErro('deu ruim')).toBe('deu ruim');
  });

  it('objeto sem message vira JSON — pior que uma frase, melhor que [object Object]', () => {
    expect(mensagemDeErro({ status: 500 })).toBe('{"status":500}');
  });

  it('objeto com ciclo não derruba a tela', () => {
    const ciclo: Record<string, unknown> = {};
    ciclo['eu'] = ciclo;
    expect(() => mensagemDeErro(ciclo)).not.toThrow();
  });

  it('Error sem mensagem não vira string vazia', () => {
    expect(mensagemDeErro(new Error(''))).not.toBe('');
  });
});
