import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { terminaFrase } from './frase';
import { verificarTexto } from '../ia/verificar';
import type { Base, FatoNumero, PacoteDeFatos } from '../ia/pacote';
import { BASE_ROTULO } from '../ia/pacote';

/**
 * A regra de fim de frase, e a prova de que a conferência continua cortando
 * exatamente onde ela diz.
 *
 * A concordância é provada **pelo comportamento** de `verificarTexto`, não pelo
 * texto de `ia/verificar.ts`: um teste que lesse o arquivo ficaria verde com
 * `limitesDaFrase` parando de cortar num terminador. Cada caso abaixo vira
 * vermelho se o laço **da frente** ou o laço **de trás** de `limitesDaFrase`
 * deixar de cortar naquele terminador. As asserções olham **só os problemas da
 * regra da base** — a regra que lê `limitesDaFrase` —, e não o veredito inteiro,
 * para não amarrar este arquivo às outras quatro regras da conferência.
 *
 * ## A dependência que estes casos carregam — leia antes de mexer na regra da base
 *
 * O caso separado ("Foram 57 km. No ano passado …") dá **zero** problemas de base
 * por causa do **segundo passe** da regra: nada nomeado colado ao número, o
 * parágrafo nomeia **outra** base (B2, para um valor de B1), e a regra se cala —
 * o "Cala 3" de `verificarTexto`. O caso junto dá **um** problema porque a
 * nomeação cai na janela da frase, no primeiro passe.
 *
 * A entrada adiada da 1.8 (`deferred-work.md`) propõe que a conferência pare de
 * deixar o parágrafo absolver o número da **primeira frase**. Quando isso for
 * feito, os casos "para a frente" — em que o 57 está na primeira frase — ficam
 * vermelhos **por um motivo que não é `terminaFrase`**, e a construção deles
 * precisa ser refeita (por exemplo, com uma frase antes do número). Um vermelho
 * aqui depois dessa mudança não é a regra de fim de frase quebrada.
 */

/** Todos os cortes de um texto, em índice UTF-16 — o índice que `texto[i]` lê. */
const cortes = (texto: string): number[] =>
  Array.from({ length: texto.length }, (_, i) => i).filter((i) => terminaFrase(texto, i));

describe('terminaFrase — a regra', () => {
  it('corta em quebra de linha, exclamação, interrogação e ponto', () => {
    assert.deepEqual(cortes('Sono. Foi? Sim! Fim\nOutro'), [4, 9, 14, 19]);
  });

  it('o ponto entre dois dígitos é milhar e não corta', () => {
    assert.deepEqual(cortes('Foram 12.345 km.'), [15]);
    assert.equal(terminaFrase('9.876', 1), false);
  });

  it('o ponto com dígito de um lado só corta', () => {
    assert.equal(terminaFrase('5.', 1), true);
    assert.equal(terminaFrase('.5', 0), true);
    assert.equal(terminaFrase('v.2', 1), true);
    assert.equal(terminaFrase('2.v', 1), true);
    assert.equal(terminaFrase('2. 3', 1), true);
  });

  it('não sabe de abreviação: "aprox." termina frase aqui, e é a chamada quem pula', () => {
    assert.deepEqual(cortes('aprox. 4'), [5]);
  });

  it('nada mais corta — vírgula, ponto e vírgula, dois-pontos, reticência, retorno de carro, separador Unicode', () => {
    for (const c of [',', ';', ':', '\u2026', '\r', '\u2028', '\u2029', ' ', '\t', ')', '"']) {
      assert.equal(terminaFrase(`a${c}b`, 1), false, JSON.stringify(c));
    }
  });

  it('fora do texto não corta', () => {
    assert.equal(terminaFrase('Sono.', 5), false);
    assert.equal(terminaFrase('Sono.', -1), false);
    assert.equal(terminaFrase('', 0), false);
  });

  it('o índice é UTF-16, como o de texto[i] — não o de [...texto]', () => {
    const texto = '\u{1F634} Dormiu. Sim';
    // A prova de que o caso separa as duas contagens: o emoji ocupa duas unidades.
    assert.notEqual(texto.indexOf('.'), [...texto].indexOf('.'));
    assert.deepEqual(cortes(texto), [texto.indexOf('.')]);
  });
});

/* ── a concordância com a conferência ── */

/**
 * Um pacote **sintético e mínimo**, montado aqui. Nenhum número vem das edições
 * do dono: o que importa é a forma — um valor que é base B1, um `atual` sem
 * base, e um período cujo anterior tem nome próprio.
 */
const ausente = (id: 'B1' | 'B2' | 'B3'): Base => ({
  id, rotulo: BASE_ROTULO[id], existe: false, valor: null, delta: null, deltaPct: null, motivo: 'sintético',
});

const fato = (chave: string, atual: number, b1: number | null): FatoNumero => ({
  chave,
  rotulo: chave,
  atual,
  bases: [
    b1 == null
      ? ausente('B1')
      : { id: 'B1', rotulo: BASE_ROTULO.B1, existe: true, valor: b1, delta: null, deltaPct: null },
    ausente('B2'),
    ausente('B3'),
  ],
  unidade: 'km',
  casas: 0,
  amostra: null,
  comparavel: true,
});

const PACOTE: PacoteDeFatos = {
  versao: 3,
  caderno: 'movimento',
  rotulo: 'Movimento',
  periodo: {
    tipo: 'month',
    rotulo: 'Março 2031',
    rotuloAnterior: 'Fevereiro 2031',
    inicioISO: '2031-03-01',
    fimISO: '2031-03-31',
    fechado: true,
    diasNoPeriodo: 31,
    luz: null,
  },
  // 57 e 5700 são valores de B1; 64 e 1234 são `atual`, sem base a nomear.
  metricas: [fato('distancia', 64, 57), fato('voltas', 1234, null), fato('elevacao', 64, 5700)],
  tendencias: [],
  textos: [],
  lapides: [],
  cobertura: null,
  correlacoes: [],
  eventos: [],
  lacunas: [],
  semDado: false,
};

const daBase = (texto: string) => verificarTexto(texto, PACOTE).problemas.filter((p) => p.regra === 'base');

/**
 * Colado ao número, "ano passado" (B2) é inversão: o 57 é valor de B1. Separado
 * dele por um fim de frase, a nomeação vai para o parágrafo, que nomeia OUTRA
 * base — e aí a regra cala. A diferença entre um problema e zero é exatamente
 * `limitesDaFrase` cortar ou não naquele terminador.
 */
const TERMINADORES = [
  ['ponto', '.'],
  ['exclamação', '!'],
  ['interrogação', '?'],
  ['quebra de linha', '\n'],
] as const;

describe('a conferência corta onde terminaFrase corta — pelo comportamento de verificarTexto', () => {
  it('o fixture distingue os dois papéis: o valor de B1 sem base nomeada acusa, o atual sem base não', () => {
    // 57 é valor de B1, sem base nomeada e sem nada no parágrafo: um problema de base.
    assert.equal(daBase('Foram 57 km e 1.234 voltas.').length, 1);
    // 64 e 1.234 são `atual`: não exigem nomeação.
    assert.deepEqual(daBase('Foram 64 km e 1.234 voltas.'), []);
  });

  for (const [nome, t] of TERMINADORES) {
    it(`para a frente: a base nomeada na frase SEGUINTE, depois de ${nome}, não é deste número`, () => {
      const separado = `Foram 57 km${t} no ano passado a rota era outra.`;
      assert.deepEqual(daBase(separado), [], JSON.stringify(separado));

      const junto = 'Foram 57 km no ano passado a rota era outra.';
      assert.equal(daBase(junto).length, 1, 'sem o terminador, a nomeação colada acusa a inversão');
    });

    it(`para trás: a base nomeada na frase ANTERIOR, antes de ${nome}, não é deste número`, () => {
      const separado = `No ano passado a rota era outra${t} foram 57 km.`;
      assert.deepEqual(daBase(separado), [], JSON.stringify(separado));

      const junto = 'No ano passado a rota era outra foram 57 km.';
      assert.equal(daBase(junto).length, 1, 'sem o terminador, a nomeação colada acusa a inversão');
    });
  }

  it('o ponto de milhar não corta — nem no laço da frente, nem no de trás', () => {
    // Para a frente: o laço parte do próprio número e atravessa o ponto do 5.700.
    assert.equal(daBase('Foram 5.700 km no ano passado.').length, 1);
    // Para trás: o laço parte do 57 e atravessa o ponto do 1.234.
    assert.equal(daBase('No ano passado 1.234 voltas deram 57 km.').length, 1);
  });

  it('e o que não é terminador não corta: vírgula, ponto e vírgula e reticência mantêm a frase', () => {
    for (const c of [',', ';', '\u2026']) {
      assert.equal(daBase(`Foram 57 km${c} no ano passado a rota era outra.`).length, 1, JSON.stringify(c));
      assert.equal(daBase(`No ano passado a rota era outra${c} foram 57 km.`).length, 1, JSON.stringify(c));
    }
  });
});
