/**
 * O anuário do ano — a matriz de I/O da Story 3.2 sobre o núcleo.
 *
 * O que se prova aqui são as duas perguntas que a rota faz antes de desenhar
 * qualquer pixel: *este ano tem série?* e *o que ele diz quando não tem?* — mais
 * a fala do leitor de tela, que é onde a tira deixa de ser bonita e muda.
 *
 * O desenho não passa por aqui: altura, vão e cor são da tela, e a barreira que
 * prova que a tira do anuário **não é tocável** mora no celular
 * (`mobile/src/lib/__tests__/anuario-nao-e-tocavel.test.ts`), que é onde o
 * `Pressable` poderia voltar.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  anoDoAnuario,
  anuarioEmPalavras,
  fraseDoAnoSemLider,
  montarAnuario,
  tiraEmPalavras,
} from './anuario';
import { MESES_DO_ANO, tirasDoAno } from './parede';
import type { EdicaoNoArquivo } from '../data/edicoes-ia';
import { CADERNO_IDS, type CadernoId } from '../period/cadernos';

const ultimoDia = (ano: number, mes: number): string =>
  `${ano}-${String(mes + 1).padStart(2, '0')}-${String(new Date(ano, mes + 1, 0).getDate()).padStart(2, '0')}`;

/** Uma edição de mês no arquivo, com um caderno por par `[caderno, métrica]`. */
function mes(
  ano: number,
  m: number,
  cadernos: readonly (readonly [CadernoId, string | null])[] = [['sono', 'sono.duracao']],
): EdicaoNoArquivo {
  return {
    tipoPeriodo: 'month',
    inicio: `${ano}-${String(m + 1).padStart(2, '0')}-01`,
    fim: ultimoDia(ano, m),
    cadernos: cadernos.map(([caderno, metricaLider], i) => ({
      caderno, posicao: i + 1, promptVersao: 6, pacoteVersao: 4, metricaLider,
    })),
  };
}

/** A edição do **ano** — a que a rota abre, e que não tem doze valores dentro. */
function anuarioImpresso(ano: number): EdicaoNoArquivo {
  return {
    tipoPeriodo: 'year',
    inicio: `${ano}-01-01`,
    fim: `${ano}-12-31`,
    cadernos: [{ caderno: 'sono', posicao: 1, promptVersao: 6, pacoteVersao: 4, metricaLider: 'sono.duracao' }],
  };
}

/** Os doze meses de um ano, cada um com um caderno e a métrica passada. */
function anoInteiro(
  ano: number,
  caderno: CadernoId,
  metrica: string | null,
): EdicaoNoArquivo[] {
  return Array.from({ length: MESES_DO_ANO }, (_, m) => mes(ano, m, [[caderno, metrica]]));
}

describe('anoDoAnuario — o ano que o endereço nomeia', () => {
  it('lê o ano do início do período', () => {
    assert.equal(anoDoAnuario('2025-01-01'), 2025);
  });

  it('data ilegível é `null`, e não uma exceção dentro do render', () => {
    for (const ruim of ['2025', '2025-1-1', 'ontem', '']) assert.equal(anoDoAnuario(ruim), null);
  });
});

describe('montarAnuario — ano com série', () => {
  /**
   * O caso de 2025 em produção: 20 dos 41 pares com líder. Aqui basta **um**
   * mês liderado para o ano ter série — o corte é "algum mês liderou?".
   */
  it('quatro tiras de doze células, na ordem do catálogo', () => {
    const a = montarAnuario([...anoInteiro(2025, 'sono', 'sono.duracao'), anuarioImpresso(2025)], 2025);
    assert.equal(a.estado, 'tiras');
    if (a.estado !== 'tiras') return;
    assert.equal(a.ano, 2025);
    assert.deepEqual(a.tiras.map((t) => t.caderno), [...CADERNO_IDS]);
    assert.ok(a.tiras.every((t) => t.celulas.length === MESES_DO_ANO));
  });

  /** As quatro **sempre** aparecem: três tiras não podem parecer os quatro cadernos. */
  it('o caderno que não saiu no ano tem tira, e ela é toda ausência', () => {
    const a = montarAnuario([mes(2025, 0, [['sono', 'sono.duracao']])], 2025);
    assert.equal(a.estado, 'tiras');
    if (a.estado !== 'tiras') return;
    assert.equal(a.tiras.length, CADERNO_IDS.length);
    for (const t of a.tiras.slice(1)) {
      assert.equal(t.meses, 0);
      assert.ok(t.celulas.every((c) => c.estado === 'ausente'), `${t.caderno} deveria ser toda ausência`);
    }
  });

  /**
   * **Mês sem carimbo é lacuna declarada** — a edição impressa antes da coluna
   * `metrica_lider` existir. Ela é `sem-metrica`, e nunca um valor recalculado
   * fingindo ser o de então; quem a separa do mês em que o caderno não saiu é a
   * **forma** (bloco contra filete), porque a cor não dá conta: `tint` × `line`
   * fica abaixo de ΔE 10 nas 144 combinações (`theme.test.ts`).
   */
  it('o mês sem carimbo é `sem-metrica`, distinto do mês ausente', () => {
    const a = montarAnuario(
      [mes(2025, 0, [['sono', 'sono.duracao']]), mes(2025, 1, [['sono', null]])],
      2025,
    );
    assert.equal(a.estado, 'tiras');
    if (a.estado !== 'tiras') return;
    const sono = a.tiras[0]!;
    assert.deepEqual(sono.celulas[1], { estado: 'sem-metrica' });
    assert.deepEqual(sono.celulas[2], { estado: 'ausente' });
  });

  /** A troca de líder é o que a tira existe para dizer — e ela vem do carimbo. */
  it('a troca de líder chega marcada na célula', () => {
    const a = montarAnuario(
      [
        mes(2025, 0, [['movimento', 'distancia']]),
        mes(2025, 1, [['movimento', 'atividades']]),
      ],
      2025,
    );
    assert.equal(a.estado, 'tiras');
    if (a.estado !== 'tiras') return;
    const movimento = a.tiras[1]!;
    assert.deepEqual(movimento.celulas[0], { estado: 'metrica', metrica: 'distancia', mudou: false });
    assert.deepEqual(movimento.celulas[1], { estado: 'metrica', metrica: 'atividades', mudou: true });
  });

  /**
   * A montagem é **a mesma** da parede, sem uma linha de cópia: duas montagens
   * do mesmo ano seriam duas respostas possíveis, e a que ficaria congelada é a
   * de quem desenhou primeiro.
   */
  it('as tiras são as de `tirasDoAno`, e não uma segunda montagem', () => {
    const arquivo = [...anoInteiro(2025, 'coracao', 'fcRepouso'), mes(2025, 5, [['sono', 'sono.duracao']])];
    const a = montarAnuario(arquivo, 2025);
    assert.equal(a.estado, 'tiras');
    if (a.estado !== 'tiras') return;
    assert.deepEqual(a.tiras, tirasDoAno(arquivo, 2025));
  });

  /** Os doze valores saem dos doze MESES; a edição do ano tem um valor só. */
  it('a edição do ano sozinha não desenha série nenhuma', () => {
    const a = montarAnuario([anuarioImpresso(2025)], 2025);
    assert.equal(a.estado, 'sem-lider');
  });
});

describe('montarAnuario — ano sem líder nenhum', () => {
  /**
   * O caso de 2024 em produção: 23 pares (edição, caderno) e **zero** líderes,
   * porque a coluna `metrica_lider` nasceu depois. Quatro faixas de filetes
   * leriam como tela quebrada; a linha em palavras ocupa o lugar delas.
   */
  it('doze meses impressos e nenhuma métrica ⇒ a frase, no lugar das faixas', () => {
    const a = montarAnuario([...anoInteiro(2024, 'sono', null), anuarioImpresso(2024)], 2024);
    assert.equal(a.estado, 'sem-lider');
    if (a.estado !== 'sem-lider') return;
    assert.equal(a.ano, 2024);
    assert.equal(a.meses, MESES_DO_ANO);
    assert.equal(a.frase, 'Nenhum mês de 2024 reuniu medida bastante para liderar.');
  });

  /**
   * **Dois silêncios, duas frases.** Dizer "nenhum mês reuniu medida bastante"
   * sobre um ano sem edição nenhuma afirma que os meses existiram e ficaram
   * aquém — medida que não houve (a regra da 2.6).
   */
  it('ano sem mês impresso diz outra coisa — ausência não vira "ficou aquém"', () => {
    const a = montarAnuario([], 2019);
    assert.equal(a.estado, 'sem-lider');
    if (a.estado !== 'sem-lider') return;
    assert.equal(a.meses, 0);
    assert.equal(a.frase, 'Nenhum mês de 2019 tem edição impressa.');
  });

  /** Quatro cadernos no mesmo mês são **um** mês: a contagem é a união, não a soma. */
  it('conta meses, não pares (edição, caderno)', () => {
    const a = montarAnuario(
      [mes(2024, 0, CADERNO_IDS.map((c) => [c, null] as const))],
      2024,
    );
    assert.equal(a.estado === 'sem-lider' ? a.meses : null, 1);
  });

  it('a frase é a mesma função, para a tela e para o teste', () => {
    assert.equal(fraseDoAnoSemLider(2024, 12), 'Nenhum mês de 2024 reuniu medida bastante para liderar.');
    assert.equal(fraseDoAnoSemLider(2024, 0), 'Nenhum mês de 2024 tem edição impressa.');
  });

  /** Um líder só já é série: o corte não é "quantos", é "algum". */
  it('um único mês liderado tira o ano do silêncio', () => {
    const arquivo = [...anoInteiro(2024, 'sono', null), mes(2024, 6, [['rotina', 'habitos']])];
    assert.equal(montarAnuario(arquivo, 2024).estado, 'tiras');
  });
});

describe('tiraEmPalavras — a fala do leitor de tela', () => {
  const tiraDe = (arquivo: readonly EdicaoNoArquivo[], caderno: CadernoId, ano = 2025) =>
    tirasDoAno(arquivo, ano).find((t) => t.caderno === caderno)!;

  it('o caderno que não saiu no ano diz isso, e nada mais', () => {
    assert.equal(tiraEmPalavras(tiraDe([mes(2025, 0)], 'rotina')), 'Rotina: não saiu no ano');
  });

  it('fala os três estados e as trocas', () => {
    const arquivo = [
      mes(2025, 0, [['movimento', 'distancia']]),
      mes(2025, 1, [['movimento', 'atividades']]),
      mes(2025, 2, [['movimento', null]]),
    ];
    assert.equal(
      tiraEmPalavras(tiraDe(arquivo, 'movimento')),
      'Movimento: liderou em 2 meses, saiu sem líder em 1 mês, não saiu em 9 meses, o líder mudou uma vez',
    );
  });

  /**
   * **Nunca "em 0 meses"** (matriz de I/O da 3.2). A parte que conta zero é
   * ruído que obriga quem ouve a subtrair de cabeça — e *"liderou em 0 meses"* é
   * pior que ruído: anuncia liderança e entrega nenhuma.
   */
  it('nenhuma parte que conte zero é dita', () => {
    const doze = tiraDe(anoInteiro(2025, 'sono', 'sono.duracao'), 'sono');
    assert.equal(tiraEmPalavras(doze), 'Sono: liderou em 12 meses');

    const calado = tiraDe(anoInteiro(2025, 'sono', null), 'sono');
    assert.equal(tiraEmPalavras(calado), 'Sono: saiu sem líder em 12 meses');

    for (const t of tirasDoAno(anoInteiro(2025, 'sono', null), 2025)) {
      assert.ok(!tiraEmPalavras(t).includes('0 meses'), `"${tiraEmPalavras(t)}" conta zero`);
    }
  });

  it('o plural das trocas concorda', () => {
    const arquivo = [
      mes(2025, 0, [['coracao', 'fcRepouso']]),
      mes(2025, 1, [['coracao', 'vfc']]),
      mes(2025, 2, [['coracao', 'fcRepouso']]),
    ];
    assert.ok(tiraEmPalavras(tiraDe(arquivo, 'coracao')).endsWith('o líder mudou 2 vezes'));
  });

  it('um mês é "1 mês", e não "1 meses"', () => {
    assert.ok(tiraEmPalavras(tiraDe([mes(2025, 0)], 'sono')).includes('liderou em 1 mês,'));
  });
});

describe('anuarioEmPalavras — a abertura do bloco', () => {
  /** No silêncio, a voz é **a mesma frase** que está escrita na tela. */
  it('no estado sem líder, repete a frase da tela', () => {
    const a = montarAnuario([], 2019);
    assert.equal(anuarioEmPalavras(a), a.estado === 'sem-lider' ? a.frase : '');
  });

  /**
   * Com série, o bloco é **um nó só**: o ano, e as quatro tiras na mesma frase.
   * Quatro nós separados fariam o VoiceOver parar quatro vezes num bloco que não
   * é tocável, e o ano — que é o assunto — nunca seria dito.
   */
  it('com série, diz o ano e as quatro tiras num rótulo só', () => {
    const a = montarAnuario([mes(2025, 0)], 2025);
    assert.equal(
      anuarioEmPalavras(a),
      'O ano de 2025. Sono: liderou em 1 mês, não saiu em 11 meses. '
      + 'Movimento: não saiu no ano. Coração: não saiu no ano. Rotina: não saiu no ano.',
    );
  });

  /** A régua de "nunca em 0 meses" vale no rótulo do bloco inteiro. */
  it('o rótulo do bloco nunca conta zero', () => {
    const a = montarAnuario(anoInteiro(2025, 'sono', 'sono.duracao'), 2025);
    assert.ok(!anuarioEmPalavras(a).includes('0 meses'));
  });
});
