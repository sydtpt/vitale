/**
 * O anel das leituras (story 5.5).
 *
 * Ele é o único diagnóstico de uma leitura que caiu no piso em produção, então o
 * que importa é que ele **não perca o evento recente** — o que explica a tela que
 * o dono está olhando — e que o teto corte o lado velho, não o novo.
 */
import { describe, it, expect } from '@jest/globals';
import type { EventoDoAnel } from '@vitale/shared';
import { criarAnel } from '../motores/anel';

function evento(n: number): EventoDoAnel {
  return {
    recurso: 'saude-do-sono',
    versaoDoDescritor: 1,
    modo: 'produto',
    instante: new Date(Date.UTC(2026, 8, 12, 7, 0, n)).toISOString(),
    trilha: [{ motor: 'nuvem:padrao', desfecho: 'ok', ms: n }],
  };
}

describe('o anel', () => {
  it('lê do mais recente para o mais antigo', () => {
    const anel = criarAnel(10);
    anel.registrar(evento(1));
    anel.registrar(evento(2));
    expect(anel.ler().map((e) => e.trilha[0].ms)).toEqual([2, 1]);
  });

  it('corta no teto mantendo as mais recentes', () => {
    const anel = criarAnel(3);
    for (let i = 1; i <= 5; i += 1) anel.registrar(evento(i));
    expect(anel.ler().map((e) => e.trilha[0].ms)).toEqual([5, 4, 3]);
  });

  it('limpar esvazia', () => {
    const anel = criarAnel(3);
    anel.registrar(evento(1));
    anel.limpar();
    expect(anel.ler()).toEqual([]);
  });

  it('a leitura é uma cópia: mexer nela não mexe no anel', () => {
    const anel = criarAnel(3);
    anel.registrar(evento(1));
    const lido = anel.ler() as EventoDoAnel[];
    lido.pop();
    expect(anel.ler()).toHaveLength(1);
  });
});
