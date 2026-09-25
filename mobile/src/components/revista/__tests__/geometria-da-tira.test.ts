/**
 * A geometria da tira de um caderno (Stories 2.4b e 3.2) — **o vão da troca, o
 * filete da ausência e o alinhamento da régua**.
 *
 * É a metade testável da extração que é o ponto da 3.2: sem ela, a tira do
 * anuário e a da parede dividiriam código que ninguém prova. O que se mede aqui
 * é exatamente o que o desenho promete, e cada asserção nomeia a promessa:
 *
 * - o **vão maior** existe só onde o líder trocou — é a razão declarada de a
 *   tira existir, e sem ele doze meses do mesmo fato e doze meses trocando de
 *   fato desenham a mesma barra;
 * - o **filete** é um quarto do bloco, e não metade — é o que separa "não saiu"
 *   de "saiu";
 * - em `fixas`, **nenhuma célula tem margem** — é isto, e só isto, que faz as
 *   doze colunas serem as mesmas nas quatro tiras e a régua dos meses cair sobre
 *   elas.
 *
 * O módulo é puro de propósito (sem tema, sem React, sem `StyleSheet`), então
 * nada aqui precisa de renderizador — que este workspace não tem.
 */
import { describe, it, expect } from '@jest/globals';
import type { CelulaDaTira } from '@vitale/shared';
import {
  COLUNA_DO_MES,
  alturaDaTira,
  estiloDoVao,
  formaDaTira,
  vaoAntesDaCelula,
} from '../geometria-da-tira';

const AUSENTE: CelulaDaTira = { estado: 'ausente' };
const CALADO: CelulaDaTira = { estado: 'sem-metrica' };
const LIDEROU: CelulaDaTira = { estado: 'metrica', metrica: 'sono.duracao', mudou: false };
const TROCOU: CelulaDaTira = { estado: 'metrica', metrica: 'sono.regularidade', mudou: true };

/** As duas alturas do app: a miniatura da parede e o anuário da edição. */
const PAREDE = 16;
const ANUARIO = 34;

describe('vaoAntesDaCelula — o vão maior é a troca, e nada mais', () => {
  it('a primeira célula não tem vão: não há antes', () => {
    for (const c of [AUSENTE, CALADO, LIDEROU, TROCOU]) expect(vaoAntesDaCelula(c, 0)).toBe(0);
  });

  it('o mês que trocou de líder abre a pausa maior', () => {
    expect(vaoAntesDaCelula(TROCOU, 5)).toBe(7);
  });

  it('o mês que manteve o líder tem o vão pequeno', () => {
    expect(vaoAntesDaCelula(LIDEROU, 5)).toBe(2);
  });

  /**
   * Mês calado **não é troca de líder** — é um mês sem líder. `tirasDoAno` não
   * zera a comparação num mês mudo, e abrir a pausa aqui anunciaria uma troca
   * que não houve.
   */
  it('o mês calado e o mês ausente ficam com o vão pequeno', () => {
    expect(vaoAntesDaCelula(CALADO, 3)).toBe(2);
    expect(vaoAntesDaCelula(AUSENTE, 3)).toBe(2);
  });

  /** A razão entre os dois é o que se lê: um valor só não diria as duas coisas. */
  it('a pausa da troca é várias vezes o respiro do mês', () => {
    expect(vaoAntesDaCelula(TROCOU, 1)).toBeGreaterThan(vaoAntesDaCelula(LIDEROU, 1) * 2);
  });
});

describe('estiloDoVao — onde o vão é gasto decide o alinhamento', () => {
  /**
   * **A invariante do anuário.** Sem margem, as doze células de qualquer tira
   * são doze `flex: 1` idênticos — as colunas não mudam com o número de trocas
   * daquela tira, e por isso uma régua de doze colunas iguais cai sobre as
   * quatro. Uma margem aqui desalinha as letras dos meses em silêncio.
   */
  it('em `fixas` nenhuma célula ganha margem — o vão sai de dentro', () => {
    for (const c of [AUSENTE, CALADO, LIDEROU, TROCOU]) {
      for (const i of [0, 1, 11]) {
        const estilo = estiloDoVao('fixas', vaoAntesDaCelula(c, i));
        expect(estilo?.marginLeft).toBeUndefined();
      }
    }
  });

  it('em `fixas` o vão é padding, e é o mesmo número do vão', () => {
    expect(estiloDoVao('fixas', vaoAntesDaCelula(TROCOU, 4))?.paddingLeft).toBe(7);
    expect(estiloDoVao('fixas', vaoAntesDaCelula(LIDEROU, 4))?.paddingLeft).toBe(2);
  });

  /** A parede continua com a grade aprovada em tela na 2.4b: margem entre as células. */
  it('em `divididas` o vão é margem, e não padding', () => {
    const troca = estiloDoVao('divididas', vaoAntesDaCelula(TROCOU, 4));
    expect(troca?.marginLeft).toBe(7);
    expect(troca?.paddingLeft).toBeUndefined();
    expect(estiloDoVao('divididas', vaoAntesDaCelula(LIDEROU, 4))?.marginLeft).toBe(2);
  });

  it('sem vão não sai estilo nenhum — a primeira célula não recebe caixa a mais', () => {
    expect(estiloDoVao('fixas', 0)).toBeNull();
    expect(estiloDoVao('divididas', 0)).toBeNull();
  });

  /** Os estilos são fixos e compartilhados: o render não cria um por célula. */
  it('o mesmo vão devolve o mesmo objeto', () => {
    expect(estiloDoVao('fixas', 7)).toBe(estiloDoVao('fixas', 7));
    expect(estiloDoVao('fixas', 7)).not.toBe(estiloDoVao('divididas', 7));
  });
});

describe('a régua dos meses cai sobre as tiras', () => {
  /**
   * O alinhamento, escrito como a igualdade que o sustenta: a coluna de um mês
   * na tira e a coluna de um mês na régua são **o mesmo objeto**. Duas
   * definições — uma na célula, outra na régua — divergiriam na primeira edição
   * de qualquer delas, e as letras escorregariam sem nada reprovar.
   */
  it('a célula da tira e a coluna da régua são a MESMA coluna', () => {
    const { celula } = formaDaTira(ANUARIO);
    expect(celula.flex).toBe(COLUNA_DO_MES.flex);
    expect(COLUNA_DO_MES.flex).toBe(1);
    expect(COLUNA_DO_MES.marginLeft).toBeUndefined();
    expect(COLUNA_DO_MES.paddingLeft).toBeUndefined();
  });

  /**
   * E a prova de que a grade da parede **não** serviria: nela o vão é margem, e
   * margem muda a largura das doze colunas com o número de trocas — o que dava
   * uma régua correta para uma tira e errada para as outras três.
   */
  it('a grade da parede move as colunas com as trocas; a do anuário, não', () => {
    const daParede = [TROCOU, LIDEROU].map((c, i) => estiloDoVao('divididas', vaoAntesDaCelula(c, i + 1)));
    const doAnuario = [TROCOU, LIDEROU].map((c, i) => estiloDoVao('fixas', vaoAntesDaCelula(c, i + 1)));
    expect(daParede.some((e) => e?.marginLeft !== undefined)).toBe(true);
    expect(doAnuario.every((e) => e?.marginLeft === undefined)).toBe(true);
  });
});

describe('formaDaTira — a conta do bloco e do filete', () => {
  it('o bloco tem a altura da faixa; o filete, um quarto dela', () => {
    const f = formaDaTira(ANUARIO);
    expect(f.marca.height).toBe(34);
    // `round(34 / 4)` = 9 — a conta, e não um número escrito à mão.
    expect(f.marcaAusente.height).toBe(9);
  });

  it('na miniatura da parede a conta é a mesma', () => {
    const f = formaDaTira(PAREDE);
    expect(f.marca.height).toBe(16);
    expect(f.marcaAusente.height).toBe(4);
  });

  /**
   * Um quarto, e não metade: a metade ainda lê como bloco baixo, e o que se quer
   * é que "não saiu" não seja confundido com "saiu".
   */
  it('o filete é bem menor que metade do bloco', () => {
    const f = formaDaTira(ANUARIO);
    expect(Number(f.marcaAusente.height)).toBeLessThan(Number(f.marca.height) / 2);
  });

  it('o bloco tem raio de um quinto; o filete é capsulado', () => {
    const f = formaDaTira(ANUARIO);
    expect(f.marca.borderRadius).toBeCloseTo(34 / 5);
    expect(f.marcaAusente.borderRadius).toBeCloseTo(9 / 2);
  });

  /** O cache existe pela identidade: doze células por tira não criam doze estilos. */
  it('a mesma altura devolve o mesmo conjunto de estilos', () => {
    expect(formaDaTira(ANUARIO)).toBe(formaDaTira(ANUARIO));
    expect(formaDaTira(ANUARIO)).not.toBe(formaDaTira(PAREDE));
  });
});

/**
 * O grampo da entrada — o cache guarda um conjunto por altura, e uma altura
 * **medida** (de um `onLayout`, de uma fração de densidade de tela) faria o mapa
 * crescer um registro por pixel. `NaN` é pior: altura e raio `NaN`, que o RN
 * desenha como nada, calado.
 */
describe('alturaDaTira — a altura é grampeada antes de virar estilo', () => {
  it('NaN e infinito não viram altura: caem no piso', () => {
    expect(alturaDaTira(Number.NaN)).toBe(4);
    expect(alturaDaTira(Number.POSITIVE_INFINITY)).toBe(4);
    expect(Number.isNaN(Number(formaDaTira(Number.NaN).marca.height))).toBe(false);
  });

  it('a fração é arredondada — o cache não guarda um registro por pixel medido', () => {
    expect(alturaDaTira(33.7)).toBe(34);
    expect(formaDaTira(33.7)).toBe(formaDaTira(34));
  });

  it('zero e negativo sobem ao piso; o absurdo desce ao teto', () => {
    expect(alturaDaTira(0)).toBe(4);
    expect(alturaDaTira(-10)).toBe(4);
    expect(alturaDaTira(10_000)).toBe(240);
  });

  it('as duas alturas do app passam intactas', () => {
    expect(alturaDaTira(PAREDE)).toBe(PAREDE);
    expect(alturaDaTira(ANUARIO)).toBe(ANUARIO);
  });
});
