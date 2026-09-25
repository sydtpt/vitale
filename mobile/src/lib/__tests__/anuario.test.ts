/**
 * As transições do anuário do ano (Story 3.2) — **carregando × vazio**, que é a
 * linha da matriz de I/O que a tela sozinha não consegue provar, e **de quem é o
 * que está na tela**.
 *
 * *"O ano não afirma silêncio antes de saber."* Com os meses em voo, desenhar a
 * frase "nenhum mês de 2024 reuniu medida bastante para liderar" seria afirmar
 * sobre um arquivo que ninguém leu — e ela piscaria na abertura de **todo** ano,
 * inclusive nos de doze líderes. Aqui se prova que as duas fases existem e não
 * se confundem.
 *
 * Elas moram fora do hook pela razão medida da parede: enquanto as transições
 * ficavam dentro dele, nada as executava, e trocar uma deixava a tela mentindo
 * com a suíte inteira verde — este workspace não tem renderizador de teste.
 */
import { describe, it, expect } from '@jest/globals';
import type { EdicaoNoArquivo } from '@vitale/shared';
import {
  anuarioInicial,
  anuarioValePara,
  chaveDoAnuario,
  proximoAnuario,
  type AcaoDoAnuario,
  type EstadoDoAnuario,
} from '../anuario';

const mes = (ano: number, m: number): EdicaoNoArquivo => ({
  tipoPeriodo: 'month',
  inicio: `${ano}-${String(m + 1).padStart(2, '0')}-01`,
  fim: `${ano}-${String(m + 1).padStart(2, '0')}-28`,
  cadernos: [{ caderno: 'sono', posicao: 1, promptVersao: 6, pacoteVersao: 4, metricaLider: 'sono.duracao' }],
});

const DELE_2025 = chaveDoAnuario('dono-1', 2025);
const DELE_2024 = chaveDoAnuario('dono-1', 2024);
const DE_OUTRO = chaveDoAnuario('dono-2', 2025);

/** A sequência de ações, aplicada sobre o estado inicial. */
function apos(acoes: readonly AcaoDoAnuario[]): EstadoDoAnuario {
  return acoes.reduce(proximoAnuario, anuarioInicial());
}

describe('o anuário começa sem saber', () => {
  it('o estado inicial é `carregando`, e nunca "sem tiras"', () => {
    expect(anuarioInicial()).toEqual({ fase: 'carregando', carga: 0, chave: chaveDoAnuario(null, null) });
  });

  /**
   * A distinção que a story pede, escrita como teste: enquanto a leitura corre,
   * a fase **não** é a mesma de "não há nada a mostrar".
   */
  it('`carregando` e `sem-tiras` são fases distintas', () => {
    const emVoo = apos([{ tipo: 'ler', carga: 1, chave: DELE_2025 }]);
    const semNada = apos([{ tipo: 'ler', carga: 1, chave: DELE_2025 }, { tipo: 'sem-tiras', carga: 1 }]);
    expect(emVoo.fase).toBe('carregando');
    expect(semNada.fase).toBe('sem-tiras');
    expect(emVoo.fase).not.toBe(semNada.fase);
  });
});

describe('o que cada resposta faz', () => {
  it('o arquivo que chega vira a fase pronta, com as linhas cruas', () => {
    const arquivo = [mes(2025, 0), mes(2025, 1)];
    const estado = apos([{ tipo: 'ler', carga: 1, chave: DELE_2025 }, { tipo: 'arquivo', carga: 1, arquivo }]);
    expect(estado).toEqual({ fase: 'pronto', arquivo, carga: 1, chave: DELE_2025 });
  });

  /**
   * A leitura que falhou e a sessão ausente caem no **mesmo** lugar, e é de
   * propósito: nos dois casos a edição abre sem as tiras, sem alarme no topo
   * sobre uma coisa que o leitor não pediu. O motivo vai para o log.
   */
  it('sem sessão e leitura falha caem na mesma fase', () => {
    expect(apos([{ tipo: 'ler', carga: 1, chave: DELE_2025 }, { tipo: 'sem-tiras', carga: 1 }]).fase)
      .toBe('sem-tiras');
  });

  /**
   * **`ler` sempre volta para `carregando`** — e aqui isso é o contrário da
   * parede. Lá a releitura a cada foco não podia apagar as capas já desenhadas;
   * aqui, uma leitura nova só acontece quando o ano do endereço muda ou a conta
   * troca, e nos dois casos o arquivo anterior é de outro ano ou de outro dono.
   */
  it('uma leitura nova apaga o arquivo anterior — ele é de outro ano ou de outro dono', () => {
    const estado = apos([
      { tipo: 'ler', carga: 1, chave: DELE_2025 },
      { tipo: 'arquivo', carga: 1, arquivo: [mes(2025, 0)] },
      { tipo: 'ler', carga: 2, chave: DELE_2024 },
    ]);
    expect(estado).toEqual({ fase: 'carregando', carga: 2, chave: DELE_2024 });
  });
});

describe('a guarda da carga superada', () => {
  /**
   * A resposta velha chega depois da nova leitura ter começado — troca de conta,
   * ou o ano do endereço mudando. Sem a guarda, ela desenharia os meses de outro
   * ano por cima do que está em voo.
   */
  it('o arquivo de uma carga superada é ignorado', () => {
    const estado = apos([
      { tipo: 'ler', carga: 1, chave: DELE_2025 },
      { tipo: 'ler', carga: 2, chave: DELE_2024 },
      { tipo: 'arquivo', carga: 1, arquivo: [mes(2019, 0)] },
    ]);
    expect(estado).toEqual({ fase: 'carregando', carga: 2, chave: DELE_2024 });
  });

  it('o "sem tiras" de uma carga superada também é ignorado', () => {
    const arquivo = [mes(2025, 0)];
    const estado = apos([
      { tipo: 'ler', carga: 1, chave: DELE_2025 },
      { tipo: 'ler', carga: 2, chave: DELE_2025 },
      { tipo: 'arquivo', carga: 2, arquivo },
      { tipo: 'sem-tiras', carga: 1 },
    ]);
    expect(estado).toEqual({ fase: 'pronto', arquivo, carga: 2, chave: DELE_2025 });
  });

  /** A prova de que a guarda morde na direção certa: a carga em dia passa. */
  it('a resposta da carga em curso passa', () => {
    const estado = apos([
      { tipo: 'ler', carga: 1, chave: DELE_2025 },
      { tipo: 'ler', carga: 2, chave: DELE_2025 },
      { tipo: 'arquivo', carga: 2, arquivo: [mes(2025, 0)] },
    ]);
    expect(estado.fase).toBe('pronto');
  });
});

/**
 * **O quadro de atraso**, que a carga sozinha não cobre.
 *
 * O efeito que dispara a releitura roda **depois** do render. Na troca de conta
 * — e na troca de ano por um `replace` de rota — o primeiro quadro ainda tem o
 * estado `pronto` da leitura anterior: sem esta guarda, o ano novo desenharia os
 * doze meses do dono anterior antes de qualquer coisa acontecer.
 */
describe('a chave — de quem e de que ano é o que está na tela', () => {
  const pronto = (chave: string) => apos([
    { tipo: 'ler', carga: 1, chave },
    { tipo: 'arquivo', carga: 1, arquivo: [mes(2025, 0)] },
  ]);

  it('o estado do dono anterior não vale para o dono novo', () => {
    expect(anuarioValePara(pronto(DELE_2025), DE_OUTRO)).toBe(false);
  });

  it('o estado de um ano não vale para outro', () => {
    expect(anuarioValePara(pronto(DELE_2025), DELE_2024)).toBe(false);
  });

  it('para a própria chave, vale', () => {
    expect(anuarioValePara(pronto(DELE_2025), DELE_2025)).toBe(true);
  });

  /** Sem sessão e sem ano são chaves de verdade, e não colidem entre si. */
  it('a chave separa o que parece igual', () => {
    expect(chaveDoAnuario(null, 2025)).not.toBe(chaveDoAnuario('2025', null));
    expect(chaveDoAnuario(undefined, null)).toBe(chaveDoAnuario(null, null));
  });
});
