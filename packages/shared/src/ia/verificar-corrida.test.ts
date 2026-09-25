/**
 * A corrida de 25/09/2026 — cinco motores, um caderno, os textos de verdade.
 *
 * `__fixtures__/corrida-movimento-2026-09-25.json` é o relatório da bancada tal
 * como ela o escreveu: cinco motores sobre o **mesmo** pacote do caderno
 * Movimento da semana de 14 a 20 de setembro, com o texto cru de cada um, o
 * desfecho que o portão deu naquele dia e o hash do pedido. Nada dele foi
 * editado — é evidência, não fixture escrito à mão.
 *
 * Ele existe porque a medição achou o portão **ao contrário**: as duas cópias
 * literais do pedido foram aprovadas e o único texto bom foi reprovado. Copiar
 * era a estratégia perfeita, porque todo número de uma cópia vem do pacote por
 * definição.
 *
 * ## O pacote é reconstruído, e a reconstrução se prova
 *
 * O relatório guarda o hash do pedido, não o corpo dele — então o pacote é
 * remontado aqui. A prova de que ele é o certo não é "os números parecem bater":
 * é que `montarPrompt(PACOTE).usuario` **é** o texto que o Tucano2 devolveu, a
 * menos de duas coisas que o modelo fez (trocou "Escreva" por "Escreve" e comeu
 * uma linha em branco). Uma cópia literal é o pedido de volta, e por isso ela
 * serve de espelho.
 *
 * ## As três mudanças que esta corrida motivou
 *
 * 1. a máscara das datas do período em **toda grafia** — o texto da Apple era
 *    reprovado por escrever "14 a 20 de setembro de 2026", que é o período;
 * 2. a **aproximação marcada** — "mais de 12 mil" para 12.338;
 * 3. a **regra do eco** — cópia é cópia, medida em janelas de quatro palavras.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { BASE_ROTULO, PACOTE_VERSAO, type Base, type BaseId, type FatoNumero, type PacoteDeFatos } from './pacote';
import { montarPrompt } from './prompt';
import { descritorDaRetrospectiva } from './retrospectiva';
import { ecoDoPedido, verificarTexto, type AproximacaoAceita } from './verificar';

/* ───────────────────────────── a evidência ───────────────────────────── */

interface ColunaDaCorrida {
  readonly motor: string;
  readonly nome: string;
  readonly desfecho: string;
  readonly cru?: string;
  readonly problemas?: ReadonlyArray<{ readonly regra: string; readonly detalhe: string }>;
}

const CORRIDA = JSON.parse(
  readFileSync(join(import.meta.dirname, '__fixtures__', 'corrida-movimento-2026-09-25.json'), 'utf8'),
) as { readonly colunas: readonly ColunaDaCorrida[] };

function coluna(motor: string): ColunaDaCorrida {
  const c = CORRIDA.colunas.find((x) => x.motor === motor);
  assert.ok(c, `o motor ${motor} saiu do relatório da corrida`);
  return c;
}

const APPLE = 'aparelho:sistema';
const QWEN17 = 'aparelho:coreai/qwen3-1.7b';
const TUCANO = 'aparelho:coreai/tucano2-1.5b';
const QWEN4B = 'aparelho:coreai/qwen3-4b';
const QWEN4B_MISTO = 'aparelho:coreai/qwen3-4b-misto';

/** O texto que o motor escreveu, cru. */
function texto(motor: string): string {
  const { cru } = coluna(motor);
  assert.ok(cru != null && cru !== '', `o motor ${motor} não deixou texto`);
  return cru;
}

/* ─────────────────────────── o pacote da corrida ─────────────────────────── */

function bases(anterior: number | null, deltaPct: number | null): Base[] {
  const ausente = (id: BaseId, motivo: string): Base =>
    ({ id, rotulo: BASE_ROTULO[id], existe: false, valor: null, delta: null, deltaPct: null, motivo });
  const b1: Base = anterior == null
    ? ausente('B1', 'sem período anterior')
    : { id: 'B1', rotulo: BASE_ROTULO.B1, existe: true, valor: anterior, delta: 0, deltaPct };
  // B2 e B3 declaradas como inexistentes — é o que produz a seção "Comparações
  // sem número neste caderno" que as duas cópias trazem.
  return [b1, ausente('B2', 'sem ano anterior'), ausente('B3', 'sem normal do período')];
}

function fato(
  chave: string, rotulo: string, atual: number, anterior: number | null,
  deltaPct: number | null, unidade: string, casas: number, grupo?: string,
): FatoNumero {
  return {
    chave, rotulo, ...(grupo ? { grupo } : {}), atual,
    bases: bases(anterior, deltaPct), unidade, casas, amostra: null, comparavel: true,
  };
}

/**
 * O caderno Movimento de 14–20/09/2026, como a corrida o deu aos cinco motores.
 *
 * Cada linha sai da cópia literal do Tucano2, que é o pedido de volta — não de
 * uma leitura do banco nem de um palpite. O teste logo abaixo prova o encaixe.
 */
const PACOTE: PacoteDeFatos = {
  versao: PACOTE_VERSAO, caderno: 'movimento', rotulo: 'Movimento',
  periodo: {
    tipo: 'week', rotulo: '14/09 – 20/09', rotuloAnterior: '07/09 – 13/09',
    inicioISO: '2026-09-14', fimISO: '2026-09-20',
    fechado: true, diasNoPeriodo: 7, luz: 'dias em transição',
  },
  metricas: [
    fato('atividades', 'Atividades', 3, 1, 200, '', 0),
    fato('distancia', 'Distância', 56, 0, null, 'km', 0),
    fato('tempo', 'Tempo', 2.8, 1, 180, 'h', 1),
    fato('passos', 'Passos por dia', 12338, 9189, 34.3, '', 0),
    fato('andares', 'Andares', 115, 69, 66.7, '', 0),
    fato('ciclismo.sessoes', 'Sessões', 3, 0, null, '', 0, 'Ciclismo'),
    fato('ciclismo.distancia', 'Distância', 56, 0, null, 'km', 0, 'Ciclismo'),
    fato('ciclismo.movimento', 'Tempo em movimento', 2.6, 0, null, 'h', 1, 'Ciclismo'),
    fato('ciclismo.elevacao', 'Elevação', 218, 0, null, 'm', 0, 'Ciclismo'),
  ],
  tendencias: [], textos: [],
  lapides: [
    { metrica: 'vo2max', ultimaMedidaISO: '2026-07-14' },
    { metrica: 'aneis', ultimaMedidaISO: '2026-08-17' },
  ],
  cobertura: null, correlacoes: [], eventos: [], lacunas: [], semDado: false,
};

const PEDIDO = montarPrompt(PACOTE).usuario;

describe('o pacote da corrida — a reconstrução se prova contra a cópia literal', () => {
  it('o pedido montado É o texto do Tucano2, a menos das duas coisas que o modelo fez', () => {
    // As duas, e só elas: o verbo ("Escreva" virou "Escreve") e as linhas em
    // branco, que o modelo comeu — as duas do pedido, a do cabeçalho e a que
    // separa a seção das ausências da regra dela.
    const doModelo = PEDIDO
      .replace('Escreva o caderno', 'Escreve o caderno')
      .split('\n\n').join('\n');
    assert.equal(
      texto(TUCANO), doModelo,
      'o pacote reconstruído deixou de produzir o pedido que os cinco motores receberam — '
      + 'conserte o PACOTE daqui antes de acreditar em qualquer outro teste deste arquivo',
    );
  });
});

/* ────────────────────────────── a inversão ────────────────────────────── */

describe('o portão estava ao contrário, e deixou de estar', () => {
  /**
   * O teste mais valioso do lote: a inversão de 25/09 lida do **relatório**, e o
   * veredito de hoje sobre os mesmos textos.
   *
   * O "antes" não é reproduzido por código — se fosse, bastaria mexer no código
   * para a prova mudar de lado. Ele é lido do JSON que a bancada escreveu.
   */
  it('antes: as duas cópias aprovadas, o melhor texto reprovado por número', () => {
    assert.equal(coluna(TUCANO).desfecho, 'ok', 'a cópia literal passava');
    assert.equal(coluna(QWEN4B).desfecho, 'ok', 'a cópia em negrito passava');

    assert.equal(coluna(APPLE).desfecho, 'reprovada', 'a prosa de revista era reprovada');
    assert.deepEqual(
      coluna(APPLE).problemas?.map((p) => p.detalhe),
      ['"14" não está no pacote', '"12" não está no pacote'],
      'as duas reprovações do melhor texto: a data do período e a aproximação marcada',
    );
  });

  it('depois: as duas cópias reprovam por eco, e os dois textos de prosa passam', () => {
    const veredito = (motor: string) => verificarTexto(texto(motor), PACOTE, PEDIDO);

    for (const motor of [TUCANO, QWEN4B]) {
      const v = veredito(motor);
      assert.equal(v.ok, false, `${coluna(motor).nome}: a cópia tem de reprovar`);
      assert.deepEqual(
        v.problemas.map((p) => p.regra), ['eco'],
        `${coluna(motor).nome}: a cópia reprova POR ECO — se reprovasse por outra regra, `
        + 'a regra do eco não estaria provada',
      );
    }

    for (const motor of [APPLE, QWEN17]) {
      const v = veredito(motor);
      assert.deepEqual(
        v.problemas.filter((p) => p.regra === 'eco'), [],
        `${coluna(motor).nome}: prosa não é eco`,
      );
    }
  });

  /**
   * Os cinco, um a um, com o veredito de hoje inteiro. É a tabela que o dono lê.
   *
   * O Qwen3 1.7B passa a **passar**, e não por causa do eco: a única reprovação
   * dele era o `"14"` de *"No período de 14 a 20 de setembro"*, que é o período
   * que o pacote deu. Ele continua sendo prosa ruim com fatos errados — *"a
   * distância permaneceu estática"* sobre uma distância que foi de 0 a 56 km —, e
   * isso é o que a §0 deste módulo diz que não se automatiza: julgamento do
   * leitor, que é uma pessoa só e está disponível.
   */
  it('a tabela dos cinco, depois da mudança', () => {
    const regras = (motor: string) => verificarTexto(texto(motor), PACOTE, PEDIDO).problemas.map((p) => p.regra);
    assert.deepEqual(regras(APPLE), [], 'a prosa de revista passa inteira');
    assert.deepEqual(regras(QWEN17), [], 'a prosa ruim passa nas regras mecânicas — o resto é do leitor');
    assert.deepEqual(regras(TUCANO), ['eco']);
    assert.deepEqual(regras(QWEN4B), ['eco']);
    // O truncado em 9 tokens: "**Movimento**\n**202". O `202` não é ano nem data,
    // e o texto tem duas palavras — longe do piso do eco.
    assert.deepEqual(regras(QWEN4B_MISTO), ['numero']);
  });

  it('e o caminho de produção passa o pedido — senão a sexta regra nunca rodaria', () => {
    // A conferência do descritor da revista, que é quem a sequência da impressão
    // chama. Se alguém tirar o pedido de lá, este teste fica vermelho.
    const c = descritorDaRetrospectiva.conferir(texto(TUCANO), PACOTE);
    assert.equal(c.ok, false);
    assert.deepEqual(!c.ok && c.problemas.map((p) => p.regra), ['eco']);
  });
});

/* ────────────────── 1: a máscara das datas, em toda grafia ────────────────── */

describe('as datas do período saem de cena em toda grafia que a prosa admite', () => {
  /** O texto conferido com uma linha de prosa em volta, para não depender do resto. */
  const numeros = (t: string) => verificarTexto(t, PACOTE).problemas
    .filter((p) => p.regra === 'numero').map((p) => p.detalhe);

  it('a forma que reprovou o melhor texto: "14 a 20 de setembro de 2026"', () => {
    assert.deepEqual(numeros('# Movimento – 14 a 20 de setembro de 2026'), []);
  });

  for (const forma of [
    // por extenso, cada ponta sozinha
    '14 de setembro de 2026', '20 de setembro de 2026', '14 de setembro', '20 de setembro',
    // o intervalo contraído, com os conectores que a prosa usa
    '14 a 20 de setembro', '14 e 20 de setembro', '14 até 20 de setembro',
    '14 - 20 de setembro', '14 – 20 de setembro', '14—20 de setembro',
    '14 a 20 de setembro de 2026',
    // a caixa não importa
    '14 A 20 DE SETEMBRO DE 2026', '14 de Setembro',
    // as formas que já passavam, e que têm de continuar passando
    '2026-09-14', '2026-09-20', '14/09', '20/09', '14/09/2026', '20/09/2026', '14/09 – 20/09',
  ]) {
    it(`dispensa "${forma}"`, () => {
      assert.deepEqual(numeros(`No período de ${forma} houve 3 atividades.`), [], forma);
    });
  }

  it('NÃO abre buraco: par de algarismos que não é a data do período continua número', () => {
    // A mesma garantia de `verificar.test.ts`, repetida aqui porque a máscara
    // mudou de mecanismo (uma alternação só, com `\b`) e a garantia é sobre o
    // mecanismo novo. Os números escolhidos não estão no alfabeto deste caderno —
    // o `7` dele está, porque é o `diasNoPeriodo` da semana.
    const d = numeros('Cobertura de 8/8 dias, com a saída de 05/11.');
    assert.ok(d.some((x) => x.includes('8')), 'o 8/8 tem de ser conferido');
    assert.ok(d.some((x) => x.includes('05') || x.includes('5')), 'a data de outro mês também');
    assert.ok(d.some((x) => x.includes('11')), 'e o mês dela');
  });

  it('e não come dígito alheio: a fronteira de palavra segura as duas pontas', () => {
    // Sem `\b`, `14/09` casaria dentro de `114/09` e sobraria um "1" solto.
    assert.ok(numeros('Foram 114/09 sessões.').length > 0, 'o 114 tem de ser conferido');
  });

  it('a data de uma lápide passa sem máscara, pela dispensa do "de"', () => {
    // E é isso que protege o nome do mês, que a quinta regra lê: mascarar a data
    // da lápide apagaria "julho" junto.
    assert.deepEqual(numeros('O consumo máximo de oxigênio parou de chegar em 14 de julho de 2026.'), []);
  });
});

/* ──────────────────── 2: a aproximação marcada ──────────────────── */

describe('a aproximação marcada — as três condições valem juntas', () => {
  /**
   * Um pacote de **um número só**, para a exceção ser medida sem o resto do
   * alfabeto interferir.
   *
   * No caderno de verdade isso não dá: "mais de 3 horas" passa a comparação exata
   * porque o `3` das Atividades está no alfabeto, e "cerca de 100 km" é
   * arredondamento legítimo dos 115 andares. A regra 1 julga um **alfabeto de
   * valores**, não um valor por métrica — e é assim de propósito, porque o texto
   * pode citar qualquer fato do caderno.
   *
   * O `7` do `diasNoPeriodo` entra no alfabeto de qualquer jeito, e é inofensivo:
   * nenhuma granularidade da escada o leva a outro número redondo.
   */
  function soUmNumero(valor: number, unidade = '', casas = 0): PacoteDeFatos {
    return { ...PACOTE, metricas: [fato('x', 'Medida', valor, null, null, unidade, casas)], lapides: [] };
  }
  const reprovou = (t: string, p: PacoteDeFatos) =>
    verificarTexto(t, p).problemas.some((x) => x.regra === 'numero');

  const PASSOS = soUmNumero(12338);
  const HORAS = soUmNumero(2.8, 'h', 1);
  const KM = soUmNumero(56, 'km');
  const ANDARES = soUmNumero(115);
  const ELEVACAO = soUmNumero(218, 'm');

  it('o caso que motivou a exceção: "mais de 12 mil" para 12.338 passos', () => {
    assert.equal(reprovou('Os passos diários somaram mais de 12 mil.', PASSOS), false);
  });

  it('(a) sem marca, a comparação segue exata — "12 mil" reprova', () => {
    assert.equal(reprovou('Os passos diários somaram 12 mil.', PASSOS), true);
  });

  it('(b) o número tem de ser arredondamento de um do pacote — "cerca de 15 mil" reprova', () => {
    assert.equal(reprovou('Os passos diários somaram cerca de 15 mil.', PASSOS), true);
  });

  it('(c) o lado tem de bater com a marca', () => {
    // 2,8 h arredondado à unidade é 3. "quase 3" pede que o pacote seja MENOR.
    assert.equal(reprovou('Foram quase 3 horas de atividade.', HORAS), false);
    // "mais de 3" pediria que fosse maior, e 2,8 < 3.
    assert.equal(reprovou('Foram mais de 3 horas de atividade.', HORAS), true);
    // 115 andares: "mais de 100" é verdade, "quase 100" não.
    assert.equal(reprovou('Foram mais de 100 andares.', ANDARES), false);
    assert.equal(reprovou('Foram quase 100 andares.', ANDARES), true);
  });

  it('a marca tem de ser palavra inteira e estar colada ao número', () => {
    // "alguns" termina em "uns" e não é marca.
    assert.equal(reprovou('Foram alguns 100 andares.', ANDARES), true);
    // "demais de" termina em "mais de" e não é marca — e é o caso que prova que o
    // caractere anterior à janela entra nela. No começo do texto não há o que
    // entrar, e aí só o `^` decide.
    assert.equal(reprovou('Andou demais de 100 andares.', ANDARES), true);
    assert.equal(reprovou('mais de 100 andares.', ANDARES), false, 'a marca no começo do texto vale');
    // E a marca não viaja para o número seguinte: aqui ela qualifica o 100.
    assert.equal(reprovou('Foram mais de 100 andares, e 999 deles.', ANDARES), true);
  });

  it('granularidade mais grossa que o número não arredonda — "cerca de 100 km" reprova', () => {
    // 56 km à centena vira 100: isso não é arredondar, é substituir, e a marca
    // simétrica não tem lado para barrá-lo. A distância seria de 44%.
    assert.equal(reprovou('Foram cerca de 100 km.', KM), true);
    // À dezena, 56 → 60, e aí é arredondamento de verdade.
    assert.equal(reprovou('Foram quase 60 km.', KM), false);
  });

  it('a média que o modelo fez de cabeça continua reprovando, marcada ou não', () => {
    // 56 ÷ 3 = 18,7 — plausível, correto, e não está no pacote. Nenhuma
    // granularidade da escada leva um número do pacote a 18,7.
    assert.equal(reprovou('Foram 56 km, com média de cerca de 18,7 km.', KM), true);
    assert.equal(reprovou('Foram 56 km, com média de 18,7 km.', KM), true);
  });

  it('cada aproximação aceita fica registrada, e FORA dos problemas', () => {
    const r = verificarTexto('Os passos diários somaram mais de 12 mil.', PASSOS);
    assert.equal(r.ok, true);
    assert.deepEqual(r.problemas, []);
    const esperada: AproximacaoAceita = {
      bruto: '12', marca: 'mais de', valor: 12000, doPacote: 12338, granularidade: 1000,
    };
    assert.deepEqual(r.aproximacoes, [esperada]);
  });

  it('sem aproximação nenhuma, o campo nem aparece — o caminho de sucesso não muda', () => {
    const r = verificarTexto('Foram 56 km.', KM);
    assert.deepEqual(r, { ok: true, problemas: [] });
    assert.equal('aproximacoes' in r, false);
  });

  it('o texto do modelo do aparelho registra a aproximação que ele escreveu', () => {
    assert.deepEqual(verificarTexto(texto(APPLE), PACOTE, PEDIDO).aproximacoes, [
      { bruto: '12', marca: 'mais de', valor: 12000, doPacote: 12338, granularidade: 1000 },
    ]);
  });

  it('as sete marcas do dono valem, cada uma para o lado dela', () => {
    // 218 m: à centena vira 200 (o pacote é MAIOR), à dezena vira 220 (é MENOR).
    const porLado: ReadonlyArray<readonly [string, number, number | null]> = [
      // marca            aceita              recusa
      ['mais de', 200, 220],
      ['quase', 220, 200],
      ['perto de', 220, 200],
      ['cerca de', 200, null],
      ['aproximadamente', 220, null],
      ['uns', 200, null],
      ['por volta de', 220, null],
    ];
    for (const [marca, aceita, recusa] of porLado) {
      assert.equal(
        reprovou(`A elevação foi de ${marca} ${aceita} metros.`, ELEVACAO), false,
        `a marca "${marca}" deixou de valer para o lado dela`,
      );
      if (recusa != null) {
        assert.equal(
          reprovou(`A elevação foi de ${marca} ${recusa} metros.`, ELEVACAO), true,
          `"${marca} ${recusa}" passou, e o lado dela é o outro`,
        );
      }
    }
    // As duas simétricas aceitam os dois lados, e é o que as separa das outras.
    for (const marca of ['cerca de', 'aproximadamente', 'uns', 'por volta de']) {
      for (const alvo of [200, 220]) {
        assert.equal(reprovou(`A elevação foi de ${marca} ${alvo} metros.`, ELEVACAO), false, `${marca} ${alvo}`);
      }
    }
  });

  it('e nenhuma marca além das sete — crescer a lista é decisão do dono', () => {
    for (const naoMarca of ['por cima de', 'em média', 'algo como', 'aproximado de', 'ao redor de']) {
      assert.equal(
        reprovou(`A elevação foi de ${naoMarca} 200 metros.`, ELEVACAO), true,
        `"${naoMarca}" virou marca sem o dono decidir`,
      );
    }
  });
});

/* ────────────────────────────── 3: o eco ────────────────────────────── */

describe('a regra do eco — o limiar e a margem, medidos nos textos reais', () => {
  /**
   * A MARGEM, afirmada em teste e não só em comentário: se um dia a régua ou os
   * textos mudarem, é aqui que se vê de quanto era o vão.
   *
   * Pior caso legítimo 21,0% (o Qwen3 1.7B, que copia a seção das lápides inteira
   * e ainda assim é prosa) · melhor cópia 77,6% (o Qwen3 4B) · **56,6 pontos**. O
   * limiar em 50% fica quase no meio.
   */
  it('a margem entre o pior legítimo e a melhor cópia é de ~56 pontos', () => {
    const eco = (motor: string) => ecoDoPedido(texto(motor), PEDIDO);

    assert.ok(eco(APPLE) < 0.01, `prosa de revista: ${(eco(APPLE) * 100).toFixed(1)}%`);
    const piorLegitimo = Math.max(eco(APPLE), eco(QWEN17));
    const melhorCopia = Math.min(eco(TUCANO), eco(QWEN4B));

    assert.ok(piorLegitimo > 0.18 && piorLegitimo < 0.24, `pior legítimo: ${(piorLegitimo * 100).toFixed(1)}%`);
    assert.ok(melhorCopia > 0.74 && melhorCopia < 0.81, `melhor cópia: ${(melhorCopia * 100).toFixed(1)}%`);
    assert.ok(
      melhorCopia - piorLegitimo > 0.5,
      `a margem encolheu para ${((melhorCopia - piorLegitimo) * 100).toFixed(1)} pt — `
      + 'com o vão estreito, o limiar de 50% deixa de ser defensável e precisa de outra régua',
    );
  });

  it('o limiar está entre os dois — bracketado, não escolhido no ar', () => {
    const reprova = (t: string) => verificarTexto(t, PACOTE, PEDIDO).problemas.some((p) => p.regra === 'eco');
    assert.equal(reprova(texto(QWEN17)), false, 'o pior legítimo está abaixo do limiar');
    assert.equal(reprova(texto(QWEN4B)), true, 'a melhor cópia está acima');
  });

  it('a marcação não salva a cópia: o Qwen3 4B devolveu o pedido todo em negrito', () => {
    // Comparar caracteres chamaria isto de texto novo. A conta é sobre palavras.
    assert.ok(texto(QWEN4B).includes('**Atividades:**'), 'o fixture perdeu o negrito');
    assert.ok(ecoDoPedido(texto(QWEN4B), PEDIDO) > 0.7);
  });

  it('o piso: o que a FORMA manda repetir fica abaixo dele', () => {
    // As duas linhas de lápide do caderno, na forma que a FORMA prescreve: 31
    // palavras, e eco quase total — o que escapa são as janelas que atravessam a
    // fronteira entre as duas frases, onde o pedido tem a marca ("— antes deste
    // período") que a prosa não copia.
    const lapides = 'Consumo máximo de oxigênio parou de chegar em 14 de julho de 2026.\n'
      + 'Anéis de atividade pararam de chegar em 17 de agosto de 2026.';
    assert.ok(ecoDoPedido(lapides, PEDIDO) > 0.8, 'a repetição prescrita é eco quase puro');
    assert.deepEqual(
      verificarTexto(lapides, PACOTE, PEDIDO).problemas, [],
      'e o piso é o único que a impede de reprovar — um caderno não pode ter mais de duas lápides',
    );
  });

  it('o piso não é desculpa para prosa de tamanho de revista', () => {
    // Os quatro textos não truncados da corrida têm 211, 222, 255 e 331 palavras —
    // o piso é 100, e nenhum deles se esconde atrás dele.
    for (const motor of [APPLE, QWEN17, TUCANO, QWEN4B]) {
      const palavras = texto(motor).split(/[^\p{L}\p{N}]+/u).filter((w) => w !== '').length;
      assert.ok(palavras > 200, `${coluna(motor).nome}: ${palavras} palavras`);
    }
  });

  it('sem o pedido, a sexta regra não roda — é o que as frases sintéticas querem', () => {
    assert.deepEqual(verificarTexto(texto(TUCANO), PACOTE).problemas, []);
  });

  it('texto curto não vira medida: o truncado em 9 tokens não é eco', () => {
    assert.equal(ecoDoPedido(texto(QWEN4B_MISTO), PEDIDO), 0);
    assert.equal(ecoDoPedido('uma', PEDIDO), 0, 'menos palavras que a janela');
  });
});
