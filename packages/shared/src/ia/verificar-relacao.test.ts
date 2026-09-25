/**
 * As regras 7 e 8 — a relação e o período.
 *
 * As seis primeiras regras conferem se o **número** está no pacote. Estas duas
 * conferem o que se **afirma** dele: o verbo contra o sinal do delta, e o nome do
 * período contra o tipo do caderno. As duas nasceram de medição — a corrida de
 * 25/09/2026 está em `verificar-corrida.test.ts`, com os textos de verdade.
 *
 * ## O que este arquivo mede, e o outro não
 *
 * Lá está a **evidência**: os textos reais reprovando pelo motivo certo. Aqui
 * estão os **silêncios**, que a evidência não consegue cobrir porque os modelos
 * não escreveram todos os casos de borda. Falso positivo numa regra destas joga
 * fora uma edição inteira e uma chamada paga — é o que a regra 5 já diz de si —,
 * então cada silêncio tem um teste com o nome do motivo.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { PeriodKind } from '../period/bounds';
import { BASE_ROTULO, PACOTE_VERSAO } from './pacote';
import type { Base, BaseId, FatoNumero, PacoteDeFatos } from './pacote';
import { verificarTexto } from './verificar';

/* ───────────────────────────── a bancada ───────────────────────────── */

/** Uma métrica: rótulo, atual, anterior — e o grupo, quando o rótulo repete. */
type Linha = readonly [rotulo: string, atual: number, anterior: number | null, grupo?: string];

function ausente(id: BaseId): Base {
  return {
    id, rotulo: BASE_ROTULO[id], existe: false, valor: null, delta: null, deltaPct: null,
    motivo: 'não há',
  };
}

function fato([rotulo, atual, anterior, grupo]: Linha, casas: number): FatoNumero {
  const b1: Base = anterior == null ? ausente('B1') : {
    id: 'B1',
    rotulo: BASE_ROTULO.B1,
    existe: true,
    valor: anterior,
    delta: Number((atual - anterior).toFixed(casas)),
    // `null` quando o anterior é zero — é o que a produção faz, e é o caso em que
    // qualquer movimento é material porque não há percentual que o meça.
    deltaPct: anterior === 0 ? null : Number((((atual - anterior) / anterior) * 100).toFixed(1)),
  };
  return {
    chave: `${grupo ?? ''}${rotulo}`.toLowerCase(),
    rotulo,
    ...(grupo ? { grupo } : {}),
    atual,
    bases: [b1, ausente('B2'), ausente('B3')],
    unidade: '',
    casas,
    amostra: null,
    comparavel: true,
  };
}

function pacote(
  linhas: readonly Linha[], tipo: PeriodKind = 'week', casas = 0,
): PacoteDeFatos {
  return {
    versao: PACOTE_VERSAO,
    caderno: 'movimento',
    rotulo: 'Movimento',
    periodo: {
      tipo,
      rotulo: tipo === 'week' ? '14/09 – 20/09' : 'Setembro',
      rotuloAnterior: tipo === 'week' ? '07/09 – 13/09' : 'Agosto 2026',
      inicioISO: '2026-09-14',
      fimISO: '2026-09-20',
      fechado: true,
      diasNoPeriodo: 7,
      luz: null,
    },
    metricas: linhas.map((l) => fato(l, casas)),
    tendencias: [],
    textos: [],
    lapides: [],
    cobertura: null,
    correlacoes: [],
    eventos: [],
    lacunas: [],
    semDado: false,
  };
}

/** Só os problemas da regra em teste — o resto do portão não é o assunto aqui. */
function daRegra(regra: 'relacao' | 'periodo', texto: string, p: PacoteDeFatos): string[] {
  return verificarTexto(texto, p).problemas.filter((x) => x.regra === regra).map((x) => x.detalhe);
}

const relacao = (texto: string, p: PacoteDeFatos) => daRegra('relacao', texto, p);
const periodo = (texto: string, p: PacoteDeFatos) => daRegra('periodo', texto, p);

/* ────────────────────── 7 — a relação: o que ela morde ────────────────────── */

describe('regra 7 — a estase que é mentira', () => {
  it('"inalterada" sobre métrica que subiu', () => {
    const p = pacote([['Elevação', 218, 0]]);
    const d = relacao('A elevação permaneceu inalterada.', p);
    assert.equal(d.length, 1);
    assert.match(d[0], /"inalterada" afirma estabilidade em Elevação, mas o pacote diz que subiu/);
  });

  it('"estática" sobre métrica que caiu', () => {
    const p = pacote([['Elevação', 40, 200]]);
    assert.match(relacao('A elevação seguiu estática.', p)[0], /o pacote diz que caiu/);
  });

  it('a forma que o 1.7B usou sobre o zero: 0 → 56 não é estase', () => {
    // Sem `deltaPct` (o anterior é zero), então o piso de 10% não pode julgar. É
    // por isso que o piso tem a exceção do anterior zero.
    const p = pacote([['Distância', 56, 0]]);
    assert.equal(relacao('A distância permaneceu inalterada.', p).length, 1);
  });

  it('as onze formas de estase que o vocabulário cobre', () => {
    const p = pacote([['Elevação', 218, 0]]);
    for (const forma of [
      'permaneceu inalterada', 'ficou inalterada', 'seguiu estática', 'não mudou',
      'não variou', 'não se alterou', 'permaneceu igual', 'permaneceu estável',
      'permaneceu a mesma', 'continuou igual', 'continuou estável', 'manteve-se estável',
    ]) {
      assert.equal(
        relacao(`A elevação ${forma} no período.`, p).length, 1,
        `"${forma}" tinha de ser cobrada`,
      );
    }
  });
});

describe('regra 7 — a direção invertida', () => {
  it('"aumentou" sobre métrica que caiu', () => {
    const p = pacote([['Andares', 40, 115]]);
    assert.match(relacao('O número de andares aumentou.', p)[0], /afirma alta.*diz que caiu/);
  });

  it('"reduzido" sobre métrica que subiu — o caso do 1.7B', () => {
    const p = pacote([['Tempo', 3, 1]]);
    assert.match(relacao('O tempo foi reduzido.', p)[0], /afirma queda.*diz que subiu/);
  });

  it('"cresceu" sobre métrica que não se moveu', () => {
    const p = pacote([['Andares', 115, 115]]);
    assert.match(relacao('O número de andares cresceu.', p)[0], /diz que não mudou/);
  });

  it('a direção certa passa, nas duas direções', () => {
    assert.deepEqual(relacao('A elevação subiu no período.', pacote([['Elevação', 218, 10]])), []);
    assert.deepEqual(relacao('A elevação caiu no período.', pacote([['Elevação', 10, 218]])), []);
  });
});

describe('regra 7 — o múltiplo', () => {
  it('"dobrou" sobre 1 → 3 é triplicou', () => {
    const p = pacote([['Atividades', 3, 1]]);
    assert.match(
      relacao('O número de atividades dobrou.', p)[0],
      /"dobrou" promete 2× em Atividades, mas a razão real é 3\.0×/,
    );
  });

  it('"dobrou" sobre 1 → 2 passa, e sobre 1 → 2,4 também', () => {
    assert.deepEqual(relacao('As atividades dobraram? Sim: dobrou.', pacote([['Atividades', 2, 1]])), []);
    assert.deepEqual(relacao('O tempo dobrou.', pacote([['Tempo', 2.4, 1]], 'week', 1)), []);
  });

  it('"triplicou" sobre 1 → 3 passa', () => {
    assert.deepEqual(relacao('As atividades triplicou.', pacote([['Atividades', 3, 1]])), []);
  });

  it('"dobrou" sobre anterior zero: zero não se multiplica', () => {
    const p = pacote([['Elevação', 218, 0]]);
    assert.match(relacao('A elevação dobrou.', p)[0], /o anterior é zero, e zero não se multiplica/);
  });
});

describe('regra 7 — o crescimento vestido de fração', () => {
  it('o caso medido: "66,7% do total do mês anterior"', () => {
    const p = pacote([['Andares', 115, 69]]);
    const d = relacao('Os andares subiram para 115, representando 66,7% do total do mês anterior.', p);
    assert.equal(d.length, 1);
    assert.match(d[0], /"66,7" é o crescimento, não uma fração/);
  });

  it('a prosa certa passa: "66,7% acima do período anterior"', () => {
    const p = pacote([['Andares', 115, 69]]);
    assert.deepEqual(relacao('Os andares subiram 66,7% acima do período anterior.', p), []);
  });

  it('cala quando o mesmo número também é valor de outra coisa', () => {
    // 66,7 é o `deltaPct` dos andares E o `atual` de outra métrica: não se sabe em
    // que papel a frase o citou, e chutar é adivinhar.
    const p = pacote([['Andares', 115, 69], ['Aproveitamento', 66.7, 10]], 'week', 1);
    assert.deepEqual(relacao('O aproveitamento foi 66,7% do total.', p), []);
  });
});

/* ──────────────────── 7 — os silêncios, um por motivo ──────────────────── */

describe('regra 7 — os silêncios são desenho', () => {
  it('cala 1: a frase não nomeia métrica alguma', () => {
    const p = pacote([['Elevação', 218, 0]]);
    assert.deepEqual(relacao('O ritmo permaneceu inalterado ao longo do período.', p), []);
  });

  it('cala 2: as métricas de mesmo rótulo discordam — as três Distância', () => {
    // O caderno Movimento tem três `Distância`. Uma subiu e a outra caiu: escolher
    // qual a frase quis dizer seria adivinhar.
    const p = pacote([
      ['Distância', 56, 0],
      ['Distância', 56, 0, 'Ciclismo'],
      ['Distância', 2, 40, 'Corrida'],
    ]);
    assert.deepEqual(relacao('A distância permaneceu inalterada.', p), []);
  });

  it('cala 2b: UNANIMIDADE — uma métrica da janela concordando já absolve', () => {
    // O caso real que impôs a unanimidade, da edição de 03–09/08: *"a distância
    // total percorrida em atividades caiu de 86 km para 23 km"*. Quem está colado
    // no verbo é `Atividades`, que subiu; o sujeito é `Distância`, que caiu de
    // verdade. Escolher a mais próxima reprovaria prosa correta.
    const p = pacote([['Distância', 23, 86], ['Atividades', 16, 8]]);
    assert.deepEqual(relacao('A distância percorrida em atividades caiu no período.', p), []);
  });

  it('cala 2c: rótulo nomeado SEM base comparável também tira a unanimidade', () => {
    // *"O tempo de sono subiu para 7,1 h"* — o `sono` da edição de julho não tem
    // anterior, e o `Tempo` do caderno caiu. Um voto só, com outro assunto na
    // janela, não decide.
    const p = pacote([['Tempo', 3, 9], ['Sono', 7.1, null]], 'week', 1);
    assert.deepEqual(relacao('O tempo de sono subiu no período.', p), []);
  });

  it('cala 2d: a locução não é a métrica — "ao mesmo tempo"', () => {
    // Da edição do Trimestre Q2: *"O volume de corridas subiu …, ao mesmo tempo em
    // que a média de sono caiu"*. O `Tempo` do caderno caiu, e a locução não fala
    // dele. Ver `IDIOMAS_QUE_NAO_SAO_METRICA`.
    const p = pacote([['Tempo', 3, 9]], 'week', 1);
    assert.deepEqual(relacao('O volume subiu, ao mesmo tempo em que a nota caiu.', p), []);
    // E a métrica de verdade, na mesma palavra, continua sendo cobrada.
    assert.equal(relacao('O tempo subiu no período.', p).length, 1);
  });

  it('cala 3: o movimento é pequeno demais para a palavra ser mentira', () => {
    // +4,5% — "praticamente inalterada" é prosa honesta, e o pacote arredonda.
    const p = pacote([['Andares', 115, 110]]);
    assert.deepEqual(relacao('O número de andares permaneceu inalterado.', p), []);
  });

  it('o piso é 10%, e ele é uma borda: 9,1% cala, 11,1% reprova', () => {
    assert.deepEqual(relacao('Os andares permaneceram inalterados.', pacote([['Andares', 120, 110]])), []);
    assert.equal(relacao('Os andares permaneceram inalterados.', pacote([['Andares', 122, 110]])).length, 1);
  });

  it('cala 4: a base B1 não existe — não há com o que comparar', () => {
    const p = pacote([['Elevação', 218, null]]);
    assert.deepEqual(relacao('A elevação permaneceu inalterada.', p), []);
  });

  it('cala 5: a negação apaga a palavra — inverter seria adivinhar', () => {
    const p = pacote([['Andares', 40, 115]]);
    for (const frase of [
      'O número de andares não aumentou.',
      'O número de andares nem aumentou.',
      'O número de andares deixou de aumentar.',
      'O número de andares, longe de aumentar, fechou o período assim.',
    ]) {
      assert.deepEqual(relacao(frase, p), [], frase);
    }
  });

  it('cala 6: rótulo curto demais não casa — três letras é ruído', () => {
    const p = pacote([['Km', 56, 0]]);
    assert.deepEqual(relacao('O km permaneceu inalterado.', p), []);
  });

  it('"foi mantida" fica FORA do vocabulário, de propósito', () => {
    // Em "a elevação foi mantida acima de 200 m" ela não afirma estase nenhuma. O
    // 1.7B a usou uma vez e esta regra a deixa passar — escape que o leitor
    // corrige, contra falso positivo que custa uma edição.
    const p = pacote([['Elevação', 218, 0]]);
    assert.deepEqual(relacao('A elevação foi mantida.', p), []);
  });

  it('a palavra mais longa ganha: "não mudou" não dispara duas vezes', () => {
    const p = pacote([['Elevação', 218, 0]]);
    assert.equal(relacao('A elevação não mudou.', p).length, 1);
  });

  it('o desacordo repetido vira UMA linha com a contagem', () => {
    const p = pacote([['Elevação', 218, 0]]);
    const d = relacao(
      'A elevação permaneceu inalterada. Mais: a elevação permaneceu inalterada. '
      + 'E de novo, a elevação permaneceu inalterada.',
      p,
    );
    assert.equal(d.length, 1);
    assert.match(d[0], /\(3×\)$/);
  });
});

/* ────────────────────── 8 — o período se chama pelo que é ────────────────────── */

describe('regra 8 — a semana que se diz mês', () => {
  const semana = pacote([['Andares', 115, 69]], 'week');
  const mes = pacote([['Andares', 115, 69]], 'month');

  it('reprova "mês anterior" num caderno de semana', () => {
    assert.deepEqual(periodo('Os andares subiram em relação ao mês anterior.', semana), [
      'o caderno é de semana, e o texto diz "mes anterior"',
    ]);
  });

  it('reprova "mês passado", "deste mês", "neste mês", "do mês atual"', () => {
    for (const frase of [
      'Os andares subiram contra o mês passado.',
      'O melhor deste mês foram os andares.',
      'Neste mês os andares subiram.',
      'Os andares do mês atual subiram.',
    ]) {
      assert.equal(periodo(frase, semana).length, 1, frase);
    }
  });

  it('a repetição vira uma linha com a contagem', () => {
    const d = periodo(
      'Contra o mês anterior, os andares subiram. E o mês anterior tinha menos. '
      + 'Ainda: o mês anterior.',
      semana,
    );
    assert.deepEqual(d, ['o caderno é de semana, e o texto diz "mes anterior" (3×)']);
  });

  it('num caderno de MÊS, "mês anterior" é a base — passa', () => {
    assert.deepEqual(periodo('Os andares subiram em relação ao mês anterior.', mes), []);
  });

  it('num caderno de MÊS, "a semana anterior" pode ser uma semana de dentro — passa', () => {
    // Fora de escopo de propósito: cobrar isso inventaria falso positivo sobre
    // prosa boa. Ver `SEMANA_QUE_SE_DIZ_MES`.
    assert.deepEqual(periodo('A semana anterior foi a mais forte.', mes), []);
  });

  it('"ano anterior" passa em qualquer caderno — é B2', () => {
    assert.deepEqual(periodo('Contra o mesmo período do ano anterior, os andares subiram.', semana), []);
    assert.deepEqual(periodo('O ano anterior teve menos.', semana), []);
  });

  it('"no mês de setembro" não é enquadramento de período — passa', () => {
    assert.deepEqual(periodo('No mês de setembro os andares subiram.', semana), []);
  });

  it('a estação passa: ela existe na semana também', () => {
    assert.deepEqual(periodo('A estação virou, e os andares subiram.', semana), []);
  });

  it('e a regra não roda fora da semana — nem no ano, nem no total', () => {
    for (const tipo of ['year', 'season', 'all'] as const) {
      assert.deepEqual(
        periodo('Contra o mês anterior, os andares subiram.', pacote([['Andares', 115, 69]], tipo)),
        [], tipo,
      );
    }
  });
});
