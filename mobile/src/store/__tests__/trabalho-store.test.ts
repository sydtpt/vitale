/**
 * BARREIRA — a faixa mostra UM trabalho, e a falha ganha.
 *
 * A regra do que aparece é pura (`oQueMostrar`) justamente para caber num
 * teste: ela decide o que o dono lê numa tela que, até 10/10/2026, não dizia
 * nada durante 45 segundos.
 */
import { describe, it, expect, beforeEach } from '@jest/globals';
import {
  oQueMostrar,
  useTrabalhoStore,
  type TrabalhoEmCurso,
  type TrabalhoQueFalhou,
} from '../trabalho.store';

const A = 'atividade-1';
const B = 'atividade-2';

function estado() {
  const { emCurso, falhas } = useTrabalhoStore.getState();
  return { emCurso, falhas };
}

beforeEach(() => {
  useTrabalhoStore.setState({ emCurso: {}, falhas: {} });
});

describe('BARREIRA — o que a faixa mostra', () => {
  it('sem trabalho nenhum, não mostra nada', () => {
    expect(oQueMostrar(A, {}, {})).toBeNull();
  });

  it('com cidades e nome juntos, mostra o de maior espera', () => {
    const s = useTrabalhoStore.getState();
    s.comecar(A, 'nome');
    s.comecar(A, 'cidades');

    const r = oQueMostrar(A, ...Object.values(estado()) as [
      Record<string, TrabalhoEmCurso>,
      Record<string, TrabalhoQueFalhou>,
    ]);
    expect(r?.estado).toBe('curso');
    expect(r && r.estado === 'curso' && r.trabalho.tipo).toBe('cidades');
  });

  it('a falha ganha de um passe em curso — depois de esperar, saber que não deu vale mais', () => {
    const s = useTrabalhoStore.getState();
    s.comecar(A, 'nome');
    s.falhar(A, 'cidades', 'o OpenStreetMap recusou', 123);

    const { emCurso, falhas } = estado();
    const r = oQueMostrar(A, emCurso, falhas);
    expect(r?.estado).toBe('falha');
    expect(r && r.estado === 'falha' && r.falha.motivo).toBe('o OpenStreetMap recusou');
  });

  it('o trabalho de uma atividade não vaza para outra', () => {
    useTrabalhoStore.getState().comecar(A, 'cidades');
    const { emCurso, falhas } = estado();
    expect(oQueMostrar(B, emCurso, falhas)).toBeNull();
  });

  it('começar limpa a falha anterior — a tela não diz "não deu" e "tentando" juntos', () => {
    const s = useTrabalhoStore.getState();
    s.falhar(A, 'cidades', 'não deu para buscar agora');
    s.comecar(A, 'cidades');

    const { emCurso, falhas } = estado();
    const r = oQueMostrar(A, emCurso, falhas);
    expect(r?.estado).toBe('curso');
  });

  it('terminar apaga curso e falha, e some da faixa', () => {
    const s = useTrabalhoStore.getState();
    s.comecar(A, 'piso');
    s.terminar(A, 'piso');

    const { emCurso, falhas } = estado();
    expect(oQueMostrar(A, emCurso, falhas)).toBeNull();
  });

  it('avançar sem começar não inventa trabalho — o passe pode ter sido cancelado', () => {
    useTrabalhoStore.getState().avancar(A, 'cidades', 3, 41);
    const { emCurso, falhas } = estado();
    expect(oQueMostrar(A, emCurso, falhas)).toBeNull();
  });

  it('o avanço chega à faixa, para a barra poder ser determinada', () => {
    const s = useTrabalhoStore.getState();
    s.comecar(A, 'cidades');
    s.avancar(A, 'cidades', 12, 41);

    const { emCurso, falhas } = estado();
    const r = oQueMostrar(A, emCurso, falhas);
    expect(r && r.estado === 'curso' && r.trabalho.feito).toBe(12);
    expect(r && r.estado === 'curso' && r.trabalho.total).toBe(41);
  });
});
