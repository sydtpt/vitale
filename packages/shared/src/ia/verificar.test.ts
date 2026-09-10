import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { PeriodKind } from '../period/bounds';
import {
  MONTHS_PT, periodLabel, periodProseLabel, previousPeriodLabel,
} from '../period/bounds';
import type { Base, BaseId, FatoNumero, PacoteDeFatos } from './pacote';
import { BASE_ROTULO, TEXTO_DA_ESTACAO } from './pacote';
import {
  formatarNumero, montarPrompt, montarPromptDaEdicao, PROMPT_VERSAO,
} from './prompt';
import { verificarTexto } from './verificar';

/**
 * Pacotes mínimos com os números reais de agosto/2026 que o parágrafo da §6 do
 * spec usa. Montados à mão para o teste medir a VERIFICAÇÃO, não a montagem —
 * essa já tem os testes dela em `pacote.test.ts`.
 *
 * São **dois cadernos**, e o texto a conferir é um só: é o grão em que o
 * celular ainda opera até a sequência da impressão por caderno (Story 1.10).
 */
function fato(
  chave: string, rotulo: string, atual: number, anterior: number,
  unidade = '', casas = 0, grupo?: string,
): FatoNumero {
  return {
    chave,
    rotulo,
    ...(grupo ? { grupo } : {}),
    atual,
    // Só B1 existe neste fixture — B2 e B3 vão declaradas, que é a forma da
    // versão 2: base que não existe entra dizendo que não existe.
    bases: [
      {
        id: 'B1', rotulo: BASE_ROTULO.B1, existe: true, valor: anterior,
        delta: Number((atual - anterior).toFixed(casas)),
        deltaPct: Number((((atual - anterior) / anterior) * 100).toFixed(1)),
      },
      { id: 'B2', rotulo: BASE_ROTULO.B2, existe: false, valor: null, delta: null, deltaPct: null, motivo: 'sem ano anterior' },
      { id: 'B3', rotulo: BASE_ROTULO.B3, existe: false, valor: null, delta: null, deltaPct: null, motivo: 'sem dois anos' },
    ],
    unidade,
    casas,
  };
}

const PERIODO = {
  tipo: 'month' as const, rotulo: 'Agosto',
  // O nome REAL do anterior, como `previousPeriodLabel` o produz — é o que
  // permite a "21 atividades contra 17 em julho" nomear B1.
  rotuloAnterior: 'Julho 2026' as string | null,
  inicioISO: '2026-08-01', fimISO: '2026-08-31',
  fechado: true, diasNoPeriodo: 31,
  // Estes pacotes medem a CONFERÊNCIA, não a luz — `null` é "sem estação a
  // relatar", e é o que mantém cada teste daqui sobre o que ele sempre mediu.
  luz: null,
};

function pacoteAgosto(opts: { correlacaoFraca?: boolean; lacuna?: boolean } = {}): PacoteDeFatos[] {
  const f = fato;
  const periodo = PERIODO;
  return [
    {
      versao: 2, caderno: 'movimento', rotulo: 'Movimento', periodo,
      metricas: [
        f('atividades', 'Atividades', 21, 17),
        f('distancia', 'Distância', 435, 862, 'km'),
        f('tempo', 'Tempo', 40.1, 68.2, 'h', 1),
      ],
      tendencias: [], textos: [], cobertura: null,
      correlacoes: [],
      eventos: [{ dia: '2026-08-30', tipo: 'marco', rotulo: 'Meia maratona' }],
      lacunas: [], semDado: false,
    },
    {
      versao: 2, caderno: 'sono', rotulo: 'Sono', periodo,
      metricas: [f('nota_sono', 'Nota de sono', 3.72, 3.39, '', 2)],
      tendencias: [], textos: [],
      cobertura: {
        diasComDado: 27, diasNoPeriodo: 31,
        diasComDadoAnterior: 14, diasNoPeriodoAnterior: 31,
        comparavel: false,
      },
      correlacoes: opts.correlacaoFraca
        ? [{
          gatilho: 'cerveja', metrica: 'sono', rotulo: 'cerveja',
          deltaPct: -12.4, nCom: 2, nSem: 25, dentroDoPortao: false,
        }]
        : [],
      eventos: [],
      lacunas: opts.lacuna
        ? [{ caderno: 'sono', diasSemDado: 4, motivo: 'relógio sem carga' }]
        : [],
      semDado: false,
    },
  ];
}

/**
 * O caderno Movimento como a montagem real o produz: um bloco geral e dois
 * grupos, com **três "Distância"** no mesmo caderno.
 *
 * Existe porque é a única forma de exercitar o ramo agrupado de
 * `blocoDeCaderno`. Sem ele, apagar os subtítulos não reprovaria nada — e o
 * modelo passaria a ler três linhas "Distância" seguidas, atribuiria os 333 km
 * de bicicleta à corrida, e `verificarTexto` não pegaria: os três números estão
 * todos autorizados.
 */
function pacoteMovimentoAgrupado(): PacoteDeFatos {
  return {
    versao: 2, caderno: 'movimento', rotulo: 'Movimento', periodo: PERIODO,
    metricas: [
      fato('distancia', 'Distância', 435, 862, 'km'),
      fato('ciclismo.distancia', 'Distância', 333, 820, 'km', 0, 'Ciclismo'),
      fato('corrida.distancia', 'Distância', 101, 21, 'km', 0, 'Corrida'),
    ],
    tendencias: [], textos: [], cobertura: null,
    correlacoes: [], eventos: [], lacunas: [], semDado: false,
  };
}

/* ── formatação ── */

describe('formatarNumero — pt-BR', () => {
  it('vírgula decimal e ponto de milhar', () => {
    assert.equal(formatarNumero(40.1, 1), '40,1');
    assert.equal(formatarNumero(17350, 0), '17.350');
    assert.equal(formatarNumero(3.72, 2), '3,72');
    assert.equal(formatarNumero(435, 0), '435');
  });

  it('negativo usa o sinal de menos tipográfico', () => {
    assert.equal(formatarNumero(-49.5, 1), '−49,5');
  });
});

/* ── regra 1: números ── */

describe('verificarTexto — números', () => {
  const p = pacoteAgosto();

  it('aceita o parágrafo escrito à mão (§6 do spec)', () => {
    const texto = 'Agosto foi o mês em que você fez mais e pediu menos. '
      + '21 atividades contra 17 em julho — e, ainda assim, 435 km no lugar de 862, '
      + 'e 40,1 h no lugar de 68,2. A nota de sono subiu de 3,39 para 3,72. '
      + 'Ressalva: a cobertura foi de 27 dias contra 14.';
    const v = verificarTexto(texto, p);
    assert.deepEqual(v.problemas, []);
    assert.equal(v.ok, true);
  });

  it('reprova número que ninguém calculou', () => {
    const texto = 'Você percorreu 999 km em agosto. Cobertura de 27 contra 14 dias.';
    const v = verificarTexto(texto, p);
    assert.ok(v.problemas.some((x) => x.regra === 'numero' && x.detalhe.includes('999')));
  });

  it('reprova a média que o modelo fez de cabeça', () => {
    // 435 ÷ 21 = 20,7 — plausível, correto, e NÃO está no pacote.
    const texto = 'Foram 435 km em 21 saídas, média de 20,7 km. Cobertura 27 contra 14.';
    const v = verificarTexto(texto, p);
    assert.ok(
      v.problemas.some((x) => x.regra === 'numero' && x.detalhe.includes('20,7')),
      'derivar é proibido mesmo quando a conta está certa',
    );
  });

  it('deixa passar data ISO — ela veio do próprio pacote', () => {
    // Falso positivo real, pego na primeira chamada ao provedor em 06/09/2026:
    // "2026-08-01" virava "01" para o varredor e era reprovado como métrica
    // inventada, sendo que a data é do período.
    const texto = 'No período de 2026-08-01 a 2026-08-31 houve 21 atividades, '
      + 'com a meia maratona em 2026-08-30. Cobertura 27 contra 14.';
    const v = verificarTexto(texto, p);
    assert.deepEqual(v.problemas.filter((x) => x.regra === 'numero'), []);
  });

  it('deixa passar ano, hora de relógio e dia do mês', () => {
    const texto = 'Em 2026, dormindo às 22h e acordando 7h02, no dia 30 de agosto. '
      + '21 atividades. Cobertura 27 contra 14.';
    const v = verificarTexto(texto, p);
    assert.deepEqual(v.problemas.filter((x) => x.regra === 'numero'), []);
  });
});

/* ── regra 2: causa ── */

describe('verificarTexto — causa', () => {
  const p = pacoteAgosto();
  const base = ' 21 atividades. Cobertura 27 contra 14.';

  for (const termo of ['porque', 'por causa', 'devido a', 'resultou em', 'fez com que']) {
    it(`reprova "${termo}"`, () => {
      const v = verificarTexto(`Você dormiu melhor ${termo} correu mais.${base}`, p);
      assert.ok(v.problemas.some((x) => x.regra === 'causa'), `"${termo}" deveria reprovar`);
    });
  }

  it('aceita coincidência temporal — "quando" e "depois de" não são causa', () => {
    const texto = `Quando você correu mais, dormiu melhor. Depois de agosto, a nota subiu.${base}`;
    const v = verificarTexto(texto, p);
    assert.deepEqual(v.problemas.filter((x) => x.regra === 'causa'), []);
  });
});

/* ── regra 3: correlação fora do portão ── */

describe('verificarTexto — correlação sem amostra', () => {
  const p = pacoteAgosto({ correlacaoFraca: true });
  const base = ' 21 atividades. Cobertura 27 contra 14.';

  it('reprova quando a correlação fraca vira afirmação', () => {
    const v = verificarTexto(`Nas noites com cerveja você dormiu menos.${base}`, p);
    assert.ok(v.problemas.some((x) => x.regra === 'correlacao'));
  });

  it('aceita quando a ressalva de amostra está no texto', () => {
    const v = verificarTexto(
      `Nas noites com cerveja o sono foi menor, mas a amostra é pequena demais para afirmar.${base}`,
      p,
    );
    assert.deepEqual(v.problemas.filter((x) => x.regra === 'correlacao'), []);
  });
});

/* ── regra 4: ressalva obrigatória ── */

describe('verificarTexto — ressalva de cobertura', () => {
  const p = pacoteAgosto();

  it('reprova o texto que compara sem declarar 27 contra 14', () => {
    const v = verificarTexto('A nota de sono subiu de 3,39 para 3,72. 21 atividades.', p);
    assert.ok(
      v.problemas.some((x) => x.regra === 'ressalva'),
      'comparar meio mês com um mês inteiro sem dizer é o erro que o campo existe para pegar',
    );
  });
});

/* ── regra 5: a base citada tem que ser nomeada, e nomeada certo ── */

function baseAusente(id: 'B2' | 'B3'): Base {
  return {
    id, rotulo: BASE_ROTULO[id], existe: false,
    valor: null, delta: null, deltaPct: null, motivo: 'não existe neste fixture',
  };
}

/** O mesmo fato com B2 preenchida — para o empate e para a inversão. */
function comB2(f: FatoNumero, valor: number): FatoNumero {
  return {
    ...f,
    bases: f.bases.map((b) => (b.id === 'B2'
      ? {
        id: 'B2' as const, rotulo: BASE_ROTULO.B2, existe: true, valor,
        delta: f.atual == null ? null : Number((f.atual - valor).toFixed(f.casas)),
        deltaPct: f.atual == null || valor === 0
          ? null
          : Number((((f.atual - valor) / valor) * 100).toFixed(1)),
      }
      : b)),
  };
}

/**
 * Um caderno com um fato só: 435 km agora, 380 na base.
 *
 * 380 não empata com nada — nem com o delta (55) nem com o percentual (14,5) —,
 * o que é a condição para a regra opinar. Um número que também é `atual` ou
 * delta de outro fato é indecidível, e a regra cala.
 */
function pacoteDeBase(
  metricas: FatoNumero[], tipo: PeriodKind = 'month', rotuloAnterior: string | null = 'Julho 2026',
): PacoteDeFatos {
  return {
    versao: 2, caderno: 'movimento', rotulo: 'Movimento',
    periodo: { ...PERIODO, tipo, rotuloAnterior },
    metricas,
    tendencias: [], textos: [], cobertura: null,
    correlacoes: [], eventos: [], lacunas: [], semDado: false,
  };
}

describe('verificarTexto — a base tem que ser nomeada', () => {
  const soB1 = pacoteDeBase([fato('distancia', 'Distância', 435, 380, 'km')]);
  const daBase = (t: string, p = soB1) => verificarTexto(t, p).problemas.filter((x) => x.regra === 'base');

  it('aprova quando a frase nomeia a base certa', () => {
    assert.deepEqual(daBase('Foram 435 km, contra 380 no período anterior.'), []);
  });

  it('reprova o valor de base citado sem nomeação nenhuma', () => {
    const ps = daBase('Foram 435 km, contra 380.');
    assert.equal(ps.length, 1, '380 é B1 e a frase não diz de quê');
    assert.match(ps[0].detalhe, /sem nomear a base/);
  });

  /*
   * O TESTE QUE PROVA QUE A STORY EXISTE.
   *
   * "435 km, contra 380 no ano passado" é uma frase bem-formada: 380 está no
   * pacote, não há palavra de causa, não há correlação fraca, não há ressalva
   * pendente. Ela passa nas quatro primeiras regras e está errada — 380 é o
   * período anterior, não o ano. Uma quinta regra que só cobrasse a AUSÊNCIA de
   * nome deixaria passar exatamente a metade que importa, porque a inversão é a
   * que parece certa.
   */
  it('reprova a INVERSÃO — o número é B1 e a frase diz B2', () => {
    const ps = daBase('Foram 435 km, contra 380 no ano passado.');
    assert.equal(ps.length, 1);
    assert.match(ps[0].detalhe, /é valor de B1 .*mas a frase nomeia B2/);
  });

  it('não opina sobre o `atual` — ele não exige nomeação', () => {
    assert.deepEqual(daBase('Foram 435 km em agosto.'), []);
  });

  it('empate entre bases: nomear qualquer uma das duas aprova', () => {
    const empate = pacoteDeBase([comB2(fato('distancia', 'Distância', 435, 380, 'km'), 380)]);
    assert.deepEqual(daBase('Foram 435 km, contra 380 no período anterior.', empate), []);
    assert.deepEqual(daBase('Foram 435 km, contra 380 no ano passado.', empate), []);
  });

  it('base que não existe: sem valor dela no texto, não há o que nomear', () => {
    // O pacote declara B2 e B3 inexistentes. O texto cita só o atual e a B1
    // nomeada — a regra não inventa uma cobrança sobre a base ausente.
    assert.deepEqual(daBase('Foram 435 km, contra 380 no período anterior.'), []);
    assert.deepEqual(
      soB1.metricas[0].bases.filter((b) => b.existe).map((b) => b.id),
      ['B1'],
      'o fixture perdeu a premissa: B2 e B3 têm que estar declaradas inexistentes',
    );
  });

  it('nomeação longe demais do número: a regra CALA, não adivinha', () => {
    // "ano passado" (B2) abre a frase; o 380 (B1) fecha, a mais de 64 caracteres
    // dele. Perto do número não há nome nenhum, e atribuir a nomeação da abertura
    // a este número seria adivinhar. Falso positivo custa uma edição inteira.
    const texto = 'No ano passado a comparação era outra, e esta frase segue longa o '
      + 'bastante para afastar a nomeação do número que ela cita ao fim: 380';
    const i = texto.indexOf('380');
    assert.ok(i - texto.indexOf('ano passado') > 64, 'o fixture encurtou e virou outro teste');
    assert.deepEqual(daBase(texto), []);
  });

  it('nomeação certa vale em qualquer ponto da frase — a distância só conta contra', () => {
    const texto = 'O período anterior é a referência desta leitura longa o bastante para '
      + 'sair da janela de decisão, e nela a distância foi de 380';
    assert.ok(texto.indexOf('380') - texto.indexOf('período anterior') > 64);
    assert.deepEqual(daBase(texto), []);
  });

  it('a nomeação viaja pelo parágrafo — é como a prosa de jornal escreve', () => {
    // Uma vez nomeada, a base fica implícita nas frases seguintes. Exigir o nome
    // em cada frase reprovaria o parágrafo escrito à mão da §6.
    assert.deepEqual(daBase('O período anterior é a referência. Foram 435 km, contra 380.'), []);
  });

  it('nomeação em OUTRO parágrafo não nomeia este número', () => {
    // Trocar de parágrafo é trocar de assunto: a nomeação não atravessa.
    assert.equal(
      daBase('O período anterior foi outro.\n\nForam 435 km, contra 380.').length,
      1,
    );
  });

  it('o mesmo valor sendo base de um fato e `atual` de outro é indecidível', () => {
    // 380 é a B1 da distância e o atual dos andares. Não dá para saber em que
    // papel a frase o citou.
    const ambiguo = pacoteDeBase([
      fato('distancia', 'Distância', 435, 380, 'km'),
      fato('andares', 'Andares', 380, 200),
    ]);
    assert.deepEqual(daBase('Foram 435 km, contra 380.', ambiguo), []);
  });

  /* ── o nome próprio do período (renegociado em 09/09) ── */

  it('o NOME PRÓPRIO do anterior nomeia B1 — "contra 380 em julho"', () => {
    // A primeira das três formas que a Story 1.5 é obrigada a ensinar ao
    // prompt. Sem isto, a 1.5 seria insatisfazível: o prompt mandaria escrever
    // uma forma que o verificador recusa.
    assert.deepEqual(daBase('Foram 435 km, contra 380 em julho.'), []);
  });

  it('o nome próprio ERRADO é inversão — "em junho", com o anterior sendo julho', () => {
    const ps = daBase('Foram 435 km, contra 380 em junho.');
    assert.equal(ps.length, 1, 'só aceitar o nome certo deixaria passar qualquer mês');
    assert.match(ps[0].detalhe, /a frase nomeia "junho"/);
  });

  it('o nome do período CORRENTE é neutro — não nomeia base nem acusa inversão', () => {
    // "em agosto", numa edição de agosto, nomeia o período do texto. Tratá-lo
    // como nome errado trocaria a acusação: o problema aqui é a ausência.
    const ps = daBase('Foram 435 km em agosto, contra 380.');
    assert.equal(ps.length, 1);
    assert.match(ps[0].detalhe, /sem nomear a base/);
  });

  it('sem `rotuloAnterior` a regra cai no vocabulário genérico, e nada mais', () => {
    // Semana e trimestre não têm forma de prosa enumerável; `all` não tem
    // anterior. Nesses casos o nome próprio nem aprova nem reprova.
    const semNome = pacoteDeBase([fato('distancia', 'Distância', 435, 380, 'km')], 'month', null);
    assert.equal(daBase('Foram 435 km, contra 380 em julho.', semNome).length, 1);
    assert.deepEqual(daBase('Foram 435 km, contra 380 no período anterior.', semNome), []);
  });

  it('a forma de B2 — "agosto do ano passado" — nomeia B2, não o corrente', () => {
    // A segunda forma prescrita pela 1.5. Quem carrega o sentido é o marcador de
    // ano; o nome nu ("em agosto") seria o período do texto, não uma base.
    const comB2Ago = pacoteDeBase([comB2(fato('distancia', 'Distância', 435, 380, 'km'), 300)]);
    assert.deepEqual(daBase('Foram 435 km, contra 300 em agosto do ano passado.', comB2Ago), []);
    // E a inversão continua pega: 380 é B1, não o ano passado.
    const ps = daBase('Foram 435 km, contra 380 em agosto do ano passado.', comB2Ago);
    assert.equal(ps.length, 1);
    assert.match(ps[0].detalhe, /é valor de B1 .*mas a frase nomeia B2/);
  });

  /*
   * Numa edição de ANO, B1 e B2 são o mesmo período: o anterior de 2025 é 2024,
   * e "o mesmo período do ano anterior" também. O nome próprio tem que nomear
   * as duas — sem isso, "contra 3.268 em 2024" é recusado e uma edição de ano
   * inteira é jogada fora, mesmo escrita exatamente como se deve escrever.
   */
  it('num período de ANO o nome próprio nomeia B1 e B2 juntas', () => {
    const f = fato('distancia', 'Distância', 3476, 3268);
    const comDuas: FatoNumero = {
      ...f,
      bases: [
        f.bases[0],
        {
          id: 'B2', rotulo: BASE_ROTULO.B2, existe: true, valor: 3200,
          delta: 276, deltaPct: 8.6,
        },
        f.bases[2],
      ],
    };
    const p2025 = pacoteDeBase([comDuas], 'year', '2024');
    p2025.periodo = { ...p2025.periodo, rotulo: '2025' };

    assert.deepEqual(
      daBase('Foram 3.476 km, contra 3.268 em 2024.', p2025), [],
      '3.268 é B1, e 2024 é o nome do período anterior',
    );
    assert.deepEqual(
      daBase('Foram 3.476 km, contra 3.200 em 2024.', p2025), [],
      '3.200 é B2, e num ano B2 é o MESMO 2024 — recusar aqui joga fora a edição',
    );
    // E o ano errado continua sendo inversão: a co-nomeação não é anistia.
    const ps = daBase('Foram 3.476 km, contra 3.268 em 2019.', p2025);
    assert.equal(ps.length, 1);
    assert.match(ps[0].detalhe, /a frase nomeia "2019"/);
  });

  /*
   * O DEFEITO DE ENCAIXE ENTRE A 1.4 E A 1.5, consertado aqui.
   *
   * Este teste existia e asseria OUTRA frase — "da normal do período para
   * agosto" —, enquanto a forma que o épico prescreve é a perífrase. `B3_VOCAB`
   * não conhecia "costuma", então o prompt v3, ao prescrever a forma do épico,
   * faria todo texto que citasse B3 reprovar: a mesma janela que a Story 1.5
   * existe para fechar, com o sinal invertido. Nenhuma revisão isolada de 1.4 ou
   * de 1.5 pegaria — é quebra ENTRE stories.
   *
   * O conserto é VOCABULÁRIO, não severidade: a perífrase entrou em `B3_VOCAB`,
   * e a inversão continua sendo pega (o teste logo abaixo).
   */
  const comB3 = pacoteDeBase([{
    ...fato('distancia', 'Distância', 435, 380, 'km'),
    bases: [
      ...fato('distancia', 'Distância', 435, 380, 'km').bases.slice(0, 2),
      {
        id: 'B3' as const, rotulo: BASE_ROTULO.B3, existe: true, valor: 410,
        delta: 25, deltaPct: 6.1,
      },
    ],
  }]);

  it('a forma de B3 — "o que você costuma fazer em agosto" — nomeia B3', () => {
    // A terceira forma prescrita. O nome que aparece nela é o do período
    // corrente; quem nomeia a base é a perífrase.
    assert.deepEqual(
      daBase('Foram 435 km, contra o que você costuma fazer em agosto: 410.', comB3),
      [],
      'é a frase que o prompt v3 prescreve — se ela reprova, o prompt é insatisfazível',
    );
    // E o rótulo genérico continua valendo: acrescentar vocabulário não tira.
    assert.deepEqual(
      daBase('Foram 435 km, contra os 410 da normal do período para agosto.', comB3),
      [],
    );
  });

  it('a perífrase de B3 ao lado de um valor de B1 continua sendo INVERSÃO', () => {
    // A prova de que o conserto foi vocabulário e não severidade: 380 é o
    // período anterior, e a frase o entrega à normal do período.
    const ps = daBase('Foram 435 km, contra o que você costuma fazer em agosto: 380.', comB3);
    assert.equal(ps.length, 1);
    assert.match(ps[0].detalhe, /"380" é valor de B1 .*mas a frase nomeia B3/);
  });

  /* ── a ordem: acusar antes de absolver ── */

  /*
   * O DEFEITO QUE A ORDEM CORRIGE.
   *
   * Absolver por parágrafo antes de olhar a vizinhança fazia a primeira
   * nomeação certa cobrir todo valor seguinte — inclusive os rotulados errado.
   * E a forma que a Story 1.5 vai ensinar é exatamente essa: nomear a base uma
   * vez e seguir implícito. A inversão pararia de existir na prosa para a qual
   * o pipeline está sendo dirigido, que é o oposto do que a story promete.
   */
  it('a absolvição do parágrafo NÃO cobre um valor rotulado errado depois dela', () => {
    const p = pacoteAgosto();
    const soBase = (t: string) => verificarTexto(t, p).problemas.filter((x) => x.regra === 'base');

    const inversao = soBase(
      '21 atividades contra 17 em julho — e 40,1 h no lugar de 68,2 no ano passado.',
    );
    assert.equal(inversao.length, 1, '68,2 é B1 e a frase o dá ao ano passado');
    assert.match(inversao[0].detalhe, /"68,2" é valor de B1 .*mas a frase nomeia B2/);

    const mesErrado = soBase(
      '21 atividades contra 17 em julho — e 435 km no lugar de 862 em junho.',
    );
    assert.equal(mesErrado.length, 1, '862 é de julho e a frase o dá a junho');
    assert.match(mesErrado[0].detalhe, /a frase nomeia "junho"/);
  });

  it('quem fala do número é a nomeação MAIS PRÓXIMA, não a primeira do parágrafo', () => {
    // As duas nomeações cabem na janela do 862; a que vale é a colada nele.
    // Sem posição, o conjunto diria "há uma nomeação certa por aqui" e a troca
    // passaria — e, no sentido inverso, um mês citado de passagem reprovaria
    // um número que a frase nomeia certo.
    const p = pacoteAgosto();
    const soBase = (t: string) => verificarTexto(t, p).problemas.filter((x) => x.regra === 'base');
    assert.deepEqual(
      soBase('Foram 435 km, contra 862 em julho — bem abaixo do que junho pedia.'),
      [],
      '"julho" está colado no 862; "junho" está de passagem',
    );
  });

  /* ── o nome próprio errado só conta perto do número ── */

  it('mês solto LONGE do número não desliga a reprovação por ausência', () => {
    // O defeito: a guarda lia o parágrafo enquanto a acusação lia a janela, e
    // qualquer mês citado por motivo narrativo calava a regra no parágrafo
    // inteiro. Um mês que não nomeia base nenhuma não é indício de nomeação.
    const comMes = daBase('Em março a leitura era outra. Foram 435 km, contra 380.');
    const semMes = daBase('A leitura era outra. Foram 435 km, contra 380.');
    assert.equal(comMes.length, 1);
    assert.deepEqual(comMes, semMes, 'o "março" não pode mudar o veredito daqui');
    assert.match(comMes[0].detalhe, /sem nomear a base/);
  });

  it('o mesmo mês DENTRO da janela acusa — é o outro lado da mesma régua', () => {
    const ps = daBase('Foram 435 km, contra 380 em março.');
    assert.equal(ps.length, 1);
    assert.match(ps[0].detalhe, /a frase nomeia "marco"/);
  });

  /*
   * DEFEITO ACHADO PELA MEDIÇÃO DAS 7 EDIÇÕES, não por inspeção.
   *
   * A coluna "nomes próprios" acusou 1 na edição de julho, cuja prosa não cita
   * mês nenhum: `"o ciclismo concentrou a **maio**r parte do volume"` casava
   * com maio por `includes`. Numa edição de mês isso é um nome próprio errado
   * colado num número — uma edição inteira reprovada por uma palavra que não é
   * um mês, que é exatamente o falso positivo que custa uma chamada paga.
   */
  it('"maior" não é o mês de maio — a nomeação casa palavra, não pedaço', () => {
    const ps = daBase('O ciclismo levou a maior parte do volume: 435 km, contra 380.');
    assert.equal(ps.length, 1);
    assert.match(ps[0].detalhe, /sem nomear a base/, 'seria inversão se "maior" virasse maio');
  });

  it('e o mesmo vale para absolver: um mês dentro de outra palavra não nomeia', () => {
    const deMaio = pacoteDeBase([fato('distancia', 'Distância', 435, 380, 'km')], 'month', 'Maio 2026');
    const ps = daBase('O ciclismo levou a maior parte do volume: 435 km, contra 380.', deMaio);
    assert.equal(ps.length, 1, '"maior" não pode absolver um pacote cujo anterior é maio');
    assert.deepEqual(daBase('Foram 435 km, contra 380 em maio.', deMaio), [], 'o mês inteiro, sim');
  });

  /* ── a janela tem tamanho, e ele é medido ── */

  it('a janela de decisão tem tamanho, e ele é medido', () => {
    // Sem este par o valor da janela fica solto: a suíte fica verde de 25 a 126,
    // e o veredito de prosa plausível muda dentro dessa faixa. A aritmética: a
    // frase precisa caber INTEIRA na janela, então um vão de `g` antes de "no
    // ano passado" (14 caracteres) exige janela ≥ g + 14.
    const vao = (n: number) => 'x'.repeat(n);
    const dentro = `Foram 435 km, contra 380${vao(46)}no ano passado.`;
    const fora = `Foram 435 km, contra 380${vao(56)}no ano passado.`;

    assert.equal(daBase(dentro).length, 1, 'a 46 caracteres a troca ainda é deste número');
    assert.match(daBase(dentro)[0].detalhe, /mas a frase nomeia B2/);
    assert.deepEqual(
      daBase(fora), [],
      'a 56 a nomeação está longe demais para ser dele — indecidível, e a regra cala',
    );
    // O par prende a janela em [60, 69]: 46+14 exige ≥ 60, e 56+14 exige ≤ 69
    // para ficar de fora. Mexer nela sem mexer aqui reprova.
  });

  it('o parágrafo da §6 passa INTEIRO — todas as cinco regras', () => {
    // A prova de que a regra não morde demais, no texto que o dono escreveu à
    // mão como alvo de prosa. "em julho" nomeia B1 uma vez e cobre os quatro
    // valores de base do parágrafo.
    const texto = 'Agosto foi o mês em que você fez mais e pediu menos. '
      + '21 atividades contra 17 em julho — e, ainda assim, 435 km no lugar de 862, '
      + 'e 40,1 h no lugar de 68,2. A nota de sono subiu de 3,39 para 3,72. '
      + 'Ressalva: a cobertura foi de 27 dias contra 14.';
    const v = verificarTexto(texto, pacoteAgosto());
    assert.deepEqual(v.problemas, []);
    assert.equal(v.ok, true);
  });

  it('e o mesmo parágrafo com a base genérica também passa inteiro', () => {
    const texto = 'Agosto foi o mês em que você fez mais e pediu menos. '
      + '21 atividades contra 17 no período anterior — e, ainda assim, 435 km no lugar '
      + 'de 862, e 40,1 h no lugar de 68,2. A nota de sono subiu de 3,39 para 3,72. '
      + 'Ressalva: a cobertura foi de 27 dias contra 14.';
    assert.deepEqual(verificarTexto(texto, pacoteAgosto()).problemas, []);
  });
});

/* ── a medição: a quinta regra sobre as sete primeiras edições ── */

/**
 * **Isto é entrega, não bônus.**
 *
 * As sete edições de `docs/specs/revista-retrospectiva/primeiras-edicoes-prompt-v2.md`
 * são a única amostra de texto verdadeiro que existe — impressas entre 06 e
 * 07/09/2026, sob o prompt v2, que não pede nomeação nenhuma. Medir a regra
 * contra elas é medir o falso positivo dela contra prosa real em vez de contra
 * prosa que o autor da regra escreveu.
 *
 * ## Como o pacote de cada edição foi reconstruído
 *
 * Os pacotes de produção não foram preservados — a tabela guarda o texto, não o
 * que o gerou. Então cada fixture carrega **só o que o próprio texto prova**: os
 * pares (atual, anterior) que a frase explicita, e nada mais. Onde o texto cita
 * um valor sem revelar a base, a B1 entra declarada inexistente, porque inventar
 * um valor anterior seria fabricar o que se quer medir.
 *
 * Só a B1 aparece: o `linhaDeFato` do prompt v2 renderiza `(anterior: …)` e mais
 * nada, então nenhuma dessas edições podia citar B2 ou B3. **Inversão é
 * impossível nesta amostra**; o que se mede aqui é a ausência de nome.
 *
 * A conferência é filtrada por `regra: 'base'` de propósito. As outras quatro
 * reprovariam por causa do fixture parcial — todo número que a reconstrução não
 * inclui é, para elas, um número que não está no pacote.
 */
type Rotulado = readonly [chave: string, atual: number, b1?: number];

const decimais = (v: number) => (String(v).split('.')[1] ?? '').length;

function fatoRotulado([chave, atual, b1]: Rotulado): FatoNumero {
  const casas = Math.max(decimais(atual), b1 == null ? 0 : decimais(b1));
  const b1Base: Base = b1 == null
    ? {
      id: 'B1', rotulo: BASE_ROTULO.B1, existe: false, valor: null,
      delta: null, deltaPct: null, motivo: 'o texto não revela o valor anterior',
    }
    : {
      id: 'B1', rotulo: BASE_ROTULO.B1, existe: true, valor: b1,
      delta: Number((atual - b1).toFixed(casas)),
      deltaPct: b1 === 0 ? null : Number((((atual - b1) / b1) * 100).toFixed(1)),
    };
  return {
    chave, rotulo: chave, atual,
    bases: [b1Base, baseAusente('B2'), baseAusente('B3')],
    unidade: '', casas,
  };
}

interface EdicaoReal {
  titulo: string;
  tipo: PeriodKind;
  /** Os limites reais do cabeçalho de cada edição, em `primeiras-edicoes-prompt-v2.md`. */
  inicio: string;
  fim: string;
  dias: number;
  texto: string;
  fatos: readonly Rotulado[];
  cobertura?: { comDado: number; dias: number };
}

const EDICOES: readonly EdicaoReal[] = [
  {
    titulo: 'Semana 03–09/08',
    tipo: 'week',
    inicio: '2026-08-03',
    fim: '2026-08-09',
    dias: 7,
    texto: 'A rotina dos últimos dias apresentou um contraste claro entre a movimentação '
      + 'cotidiana e a dedicação aos exercícios estruturados. A média de passos por dia subiu '
      + 'de 16.315 para 22.373, enquanto o volume de tarefas concluídas passou de 8 para 16. '
      + 'Em sentido totalmente oposto, a distância total percorrida em atividades caiu de 86 km '
      + 'para 23 km, e a duração do tempo em atividade encolheu de 9,2 h para 3,8 h.\n\n'
      + 'A modalidade de corrida voltou ao calendário com 2 sessões, somando 23 km e 2,6 h em '
      + 'movimento, após registrar 0 km na etapa anterior. No mesmo período, os indicadores de '
      + 'recuperação física apontaram retração simultânea: o tempo diário de sono reduziu de '
      + '7,1 h para 5,6 h, a variabilidade da frequência cardíaca oscilou de 72 ms para 56 ms '
      + 'e a frequência cardíaca de repouso subiu de 47 bpm para 50 bpm.',
    fatos: [
      ['passos', 22373, 16315], ['tarefas', 16, 8], ['distancia', 23, 86],
      ['tempo', 3.8, 9.2], ['corrida.sessoes', 2], ['corrida.distancia', 23, 0],
      ['corrida.tempo', 2.6], ['sono', 5.6, 7.1], ['vfc', 56, 72], ['fc', 50, 47],
    ],
  },
  {
    titulo: 'Semana 24–30/08',
    tipo: 'week',
    inicio: '2026-08-24',
    fim: '2026-08-30',
    dias: 7,
    texto: 'A corrida teve uma retratação expressiva ao somar 11 km, realizados em 1 sessão, '
      + 'enquanto o ciclo anterior reuniu 45 km em 3 sessões. Em direção contrária, o ciclismo '
      + 'subiu para 120 km ao longo de 2 sessões, assumindo a liderança do volume percorrido '
      + 'na semana encerrada em 30 de agosto.\n\n'
      + 'O período também apresentou métricas fisiológicas em recuperação, com a VFC em 66 ms '
      + 'e a frequência cardíaca de repouso em 47 bpm. No mesmo intervalo, o consumo de cerveja '
      + 'ocorreu em 4 dias e o volume de tarefas concluídas totalizou 22.',
    fatos: [
      ['corrida.distancia', 11, 45], ['corrida.sessoes', 1, 3], ['ciclismo.distancia', 120],
      ['ciclismo.sessoes', 2], ['vfc', 66], ['fc', 47], ['habito.cerveja', 4], ['tarefas', 22],
    ],
  },
  {
    titulo: 'Semana 31/08–06/09',
    tipo: 'week',
    inicio: '2026-08-31',
    fim: '2026-09-06',
    dias: 7,
    texto: 'A desconexão entre o recuo brusco no volume de movimento e a estabilidade nos '
      + 'indicadores de descanso é o ponto mais notável da semana. A distância total percorrida '
      + 'em atividades caiu para 5 km, em contraste com os 131 km do período anterior, enquanto '
      + 'a duração do sono atingiu 6,9 h e a nota atribuída ao repouso permaneceu em 3,86.\n\n'
      + 'A avaliação geral do dia recuou para 3,33, após atingir 4,00 na semana anterior. '
      + 'A média diária de passos passou para 8.668, e o total de tarefas concluídas somou 12.\n\n'
      + 'No pedal, a distância percorrida somou 5 km em 1 sessão. A manutenção do consumo de '
      + 'água e café permaneceu constante ao longo de 7 dias, enquanto o registro do símbolo '
      + '🤷🏻‍♂️ ocorreu em 7 dias.',
    fatos: [
      ['distancia', 5, 131], ['sono', 6.9], ['nota_sono', 3.86], ['nota_dia', 3.33, 4],
      ['passos', 8668], ['tarefas', 12], ['ciclismo.distancia', 5], ['ciclismo.sessoes', 1],
      ['habito.agua', 7], ['registro.shrug', 7],
    ],
  },
  {
    titulo: 'Mês de julho',
    tipo: 'month',
    inicio: '2026-07-01',
    fim: '2026-07-31',
    dias: 31,
    texto: 'O tempo de sono subiu para 7,1 h e a variabilidade da frequência cardíaca alcançou '
      + '71 ms, enquanto a frequência cardíaca em repouso chegou a 52 bpm. O comportamento '
      + 'dessas métricas fisiológicas seguiu na direção oposta à percepção individual, na qual '
      + 'a nota de sono caiu para 3,39 e a nota do dia recuou para 3,82.\n\n'
      + 'No treino, o ciclismo concentrou a maior parte do volume, somando 821 km ao longo de '
      + '11 sessões e 45,2 h em movimento. A corrida seguiu o caminho inverso, reduzindo a '
      + 'presença na rotina para 21 km distribuídos em 2 sessões e 2,3 h em movimento.',
    fatos: [
      ['sono', 7.1], ['vfc', 71], ['fc', 52], ['nota_sono', 3.39], ['nota_dia', 3.82],
      ['ciclismo.distancia', 821], ['ciclismo.sessoes', 11], ['ciclismo.tempo', 45.2],
      ['corrida.distancia', 21], ['corrida.sessoes', 2], ['corrida.tempo', 2.3],
    ],
  },
  {
    titulo: 'Mês de agosto',
    tipo: 'month',
    inicio: '2026-08-01',
    fim: '2026-08-31',
    dias: 31,
    texto: 'O ponto mais notável do mês aparece no desacoplamento entre o número de exercícios '
      + 'e o volume acumulado. O total de atividades subiu para 21, mas a distância total caiu '
      + 'para 435 km e o tempo em movimento reduziu para 40,1 h.\n\n'
      + 'O movimento se deu simultaneamente à alteração no perfil do treino. O ciclismo '
      + 'encolheu para 7 sessões e 333 km, enquanto a corrida subiu para 8 sessões e 102 km. '
      + 'Na rotina a pé, a média de passos por dia avançou para 17.350.\n\n'
      + 'Outro comportamento inverso ocorreu na saúde: a média de sono caiu para 6,6 h, '
      + 'enquanto a nota de sono subiu para 3,72. Nas tarefas e finanças, o período teve '
      + '85 tarefas concluídas, 0 compras e 0,00 de gasto.',
    fatos: [
      ['atividades', 21], ['distancia', 435], ['tempo', 40.1], ['ciclismo.sessoes', 7],
      ['ciclismo.distancia', 333], ['corrida.sessoes', 8], ['corrida.distancia', 102],
      ['passos', 17350], ['sono', 6.6], ['nota_sono', 3.72], ['tarefas', 85],
      ['compras', 0], ['gasto', 0],
    ],
  },
  {
    titulo: 'Trimestre Q2',
    tipo: 'season',
    inicio: '2026-04-01',
    fim: '2026-06-30',
    dias: 91,
    texto: 'O volume de corridas subiu para 28 sessões e 266 km, ao mesmo tempo em que a média '
      + 'de sono caiu para 4,9 h por noite. A intensificação do treino físico conviveu com o '
      + 'relato de hábitos como fumo em 36 dias e consumo de água em 38 dias.\n\n'
      + 'Ao todo, a movimentação acumulou 889 km em 54 atividades. O pedal somou 14 sessões e '
      + '611 km, mantendo a maior parcela do deslocamento acumulado, enquanto a média diária '
      + 'de passos alcançou 13.444.\n\n'
      + 'A rotina diária incluiu 91 tarefas concluídas. Os dados referentes à saúde cobriram '
      + '84 de 91 dias.',
    fatos: [
      ['corrida.sessoes', 28], ['corrida.distancia', 266], ['sono', 4.9],
      ['habito.fumo', 36], ['habito.agua', 38], ['distancia', 889], ['atividades', 54],
      ['ciclismo.sessoes', 14], ['ciclismo.distancia', 611], ['passos', 13444],
      ['tarefas', 91],
    ],
    cobertura: { comDado: 84, dias: 91 },
  },
  {
    titulo: 'Ano de 2025',
    tipo: 'year',
    inicio: '2025-01-01',
    fim: '2025-12-31',
    dias: 365,
    texto: 'O ciclismo dominou o volume de exercícios ao acumular 3.268 km divididos em '
      + '107 sessões. Em sentido oposto, a corrida manteve presença discreta, com 79 km em '
      + '11 sessões. Ao todo, o ano somou 240 atividades, com 3.476 km percorridos e 359,4 h '
      + 'de duração total.\n\n'
      + 'Na área da saúde, a medição cobriu 231 de 365 dias. Os indicadores desse período '
      + 'monitorado mostram média de sono de 6,2 h, frequência cardíaca de repouso de 55 bpm '
      + 'e variabilidade da frequência cardíaca de 54 ms.',
    fatos: [
      ['ciclismo.distancia', 3268], ['ciclismo.sessoes', 107], ['corrida.distancia', 79],
      ['corrida.sessoes', 11], ['atividades', 240], ['distancia', 3476], ['tempo', 359.4],
      ['sono', 6.2], ['fc', 55], ['vfc', 54],
    ],
    cobertura: { comDado: 231, dias: 365 },
  },
];

function pacoteDaEdicao(e: EdicaoReal): PacoteDeFatos {
  return {
    versao: 2, caderno: 'movimento', rotulo: 'Movimento',
    periodo: {
      tipo: e.tipo,
      // Os DOIS rótulos derivados, não escritos à mão: é o caminho que a
      // montagem real usa, e um fixture com o título do documento no lugar do
      // rótulo (`'Mês de agosto'` em vez de `'Agosto 2026'`) mede o nome do
      // período corrente errado — justo o que torna esse nome neutro.
      rotulo: periodLabel(e.tipo, new Date(`${e.inicio}T00:00:00`)),
      rotuloAnterior: previousPeriodLabel(e.tipo, e.inicio),
      inicioISO: e.inicio, fimISO: e.fim,
      fechado: true, diasNoPeriodo: e.dias,
      // As edições reais foram escritas pelo prompt v2, que não tinha luz.
      luz: null,
    },
    metricas: e.fatos.map(fatoRotulado),
    tendencias: [], textos: [],
    cobertura: e.cobertura
      ? {
        diasComDado: e.cobertura.comDado, diasNoPeriodo: e.cobertura.dias,
        diasComDadoAnterior: e.cobertura.comDado, diasNoPeriodoAnterior: e.cobertura.dias,
        comparavel: true,
      }
      : null,
    correlacoes: [], eventos: [], lacunas: [], semDado: false,
  };
}

/**
 * Quantos nomes próprios de período a prosa desta edição escreve, no tipo dela.
 *
 * Existe para tornar VISÍVEL o que a medição não cobre. A metade renegociada em
 * 09/09 — nome próprio nomeia B1, nome próprio errado é inversão — só tem efeito
 * em `month` e `year`, e é medida contra esta coluna. Se ela é zero em toda a
 * amostra, dizer "nenhuma edição reprova por nome próprio errado" é verdade
 * vazia, e é melhor a saída dizer isso do que uma asserção verde escondê-lo.
 */
function nomesDePeriodoNoTexto(e: EdicaoReal): number {
  const t = e.texto.toLowerCase();
  if (e.tipo === 'month') {
    // Fronteira de palavra, e não `includes`: "a maior parte do volume" não é
    // uma citação do mês de maio. Foi assim que esta coluna achou o defeito.
    return MONTHS_PT.filter((m) => new RegExp(`\\b${m.toLowerCase()}\\b`).test(t)).length;
  }
  if (e.tipo === 'year') return [...e.texto.matchAll(/\b(?:19|20)\d{2}\b/g)].length;
  return 0;
}

describe('a quinta regra sobre as sete primeiras edições', () => {
  const medida = EDICOES.map((e) => {
    const p = pacoteDaEdicao(e);
    const problemas = verificarTexto(e.texto, p).problemas.filter((x) => x.regra === 'base');
    const basesCitadas = new Set(
      p.metricas.flatMap((f) => f.bases)
        .filter((b) => b.existe && b.valor != null)
        .map((b) => b.valor as number),
    );
    return {
      titulo: e.titulo,
      basesCitadas: basesCitadas.size,
      nomesProprios: nomesDePeriodoNoTexto(e),
      rotulos: `${p.periodo.rotulo} ← ${p.periodo.rotuloAnterior}`,
      problemas,
    };
  });
  const passam = medida.filter((m) => m.problemas.length === 0);
  const comBase = medida.filter((m) => m.basesCitadas > 0);

  // A publicação. Sai no corpo do módulo de propósito: é entrega, e tem que
  // aparecer mesmo quando toda asserção passa.
  const pad = (s: string | number, n: number) => String(s).padStart(n);
  console.log('\n── a quinta regra sobre as 7 edições reais (prompt v2, sem nomeação) ──');
  console.log(
    `   ${'edição'.padEnd(22)}${pad('bases', 6)}${pad('reprovas', 10)}`
    + `${pad('nomes próprios', 16)}   período ← anterior`,
  );
  for (const m of medida) {
    console.log(
      `   ${m.titulo.padEnd(22)}${pad(m.basesCitadas, 6)}${pad(m.problemas.length, 10)}`
      + `${pad(m.nomesProprios, 16)}   ${m.rotulos}`,
    );
  }
  console.log(`   passariam: ${passam.length} de ${EDICOES.length}.`);
  for (const m of medida.filter((x) => x.problemas.length > 0)) {
    console.log(`   ${m.titulo} reprova por:`);
    for (const p of m.problemas) console.log(`     · ${p.detalhe}`);
  }
  console.log(
    `   ${comBase.length} das 7 citam valor de base; as outras ${7 - comBase.length} escrevem só o atual\n`
    + '   ("subiu para X", sem dizer de quanto), então a regra não tem sobre o que opinar.\n'
    + '   nenhuma reprova por INVERSÃO: o prompt v2 renderiza só a B1, então nenhuma\n'
    + '   dessas edições tinha como citar B2 ou B3. O que se mede aqui é a ausência.\n'
    + '   O NOME PRÓPRIO não tem amostra: a coluna acima é zero em toda a linha, e as\n'
    + '   três edições com valor de base são de SEMANA, tipo em que nome próprio não\n'
    + '   é lido. previousPeriodLabel/MONTHS_PT/rotuloAnterior estão medidos só pelos\n'
    + '   testes sintéticos acima — a prosa real de 06–07/09 não os exercita.\n',
  );

  /*
   * O número medido, congelado. Mexer na regra e ver este teste virar vermelho é
   * a única forma de saber que a calibragem andou — e para que lado.
   *
   * As seis que passam não passam por sorte: QUATRO delas não citam valor de
   * base nenhum (só o atual), e DUAS nomeiam a base sem que ninguém tenha
   * pedido — "o ciclo anterior", "do período anterior", "na semana anterior".
   * A terceira que nomeia é a de 03–09/08, e ela é justamente a que reprova:
   * nomeia num parágrafo e cala no outro. São a medida do falso positivo
   * contra prosa de verdade.
   */
  it('seis das sete passam', () => {
    assert.equal(
      passam.length, 6,
      `passaram ${passam.length}: ${passam.map((m) => m.titulo).join(', ')}`,
    );
  });

  it('as que nomeiam a base sozinhas passam — é a medida do falso positivo', () => {
    for (const titulo of ['Semana 24–30/08', 'Semana 31/08–06/09']) {
      const m = medida.find((x) => x.titulo === titulo);
      assert.ok(m, `sumiu a edição ${titulo}`);
      assert.ok(m.basesCitadas > 0, 'esta edição cita valor de base — senão não mede nada');
      assert.deepEqual(m.problemas, [], `${titulo} nomeia a base e não pode reprovar`);
    }
  });

  /*
   * A única que reprova é a de 03–09/08, e ela reprova pelo motivo declarado em
   * `primeiras-edicoes-prompt-v2.md`: *"nenhuma nomeia a base ... é precisamente
   * a lacuna que a quinta regra do verificar.ts passa a reprovar"*. Ela cita
   * oito valores de base e nomeia um só ("na etapa anterior"), que a regra
   * aprova. É a janela declarada entre esta story e a 1.5 — reprovar significa
   * não gravar, e é o prompt que ainda não foi ensinado.
   */
  it('a que reprova é a que cita oito bases e nomeia uma', () => {
    // Os três valores que reprovam estão no parágrafo que NÃO nomeia base
    // nenhuma; os do parágrafo com "na etapa anterior" são absolvidos por ele.
    // Foram seis reprovas enquanto a absolvição era por frase — a mudança para
    // parágrafo não trocou o veredito da edição, só a contagem dentro dela.
    const m = medida.find((x) => x.titulo === 'Semana 03–09/08');
    assert.ok(m);
    assert.equal(m.problemas.length, 3);
    for (const p of m.problemas) assert.match(p.detalhe, /sem nomear a base/);
  });

  it('a amostra real não exercita o NOME PRÓPRIO — medido, não presumido', () => {
    // Sem esta asserção, "nenhuma reprova por nome próprio errado" é verdade
    // vazia: apagar o ramo `year` de `nomesProprios` deixaria a suíte verde.
    // Aqui a vacuidade é o que está sendo afirmado, e ela reprova se mudar.
    assert.deepEqual(
      medida.filter((m) => m.nomesProprios > 0).map((m) => m.titulo), [],
      'se alguma edição passar a escrever nome de mês ou de ano, a coluna deixa de ser zero',
    );
    assert.deepEqual(
      comBase.map((m) => m.titulo),
      ['Semana 03–09/08', 'Semana 24–30/08', 'Semana 31/08–06/09'],
      'só as três de semana citam base, e semana não lê nome próprio',
    );
  });

  it('nenhuma edição reprova por inversão — o prompt v2 só renderizava a B1', () => {
    for (const m of medida) {
      for (const p of m.problemas) {
        assert.doesNotMatch(p.detalhe, /a frase nomeia/, `${m.titulo}: inversão impossível aqui`);
      }
    }
  });
});

/* ── o prompt carrega o que a verificação vai cobrar ── */

describe('montarPromptDaEdicao — a união, que o celular ainda manda', () => {
  const p = pacoteAgosto({ correlacaoFraca: true });
  const { sistema, usuario } = montarPromptDaEdicao(p);

  it('não nomeia fornecedor nenhum — ADR 0040', () => {
    const tudo = `${sistema} ${usuario}`.toLowerCase();
    for (const f of ['google', 'gemini', 'anthropic', 'claude', 'openai', 'mistral']) {
      assert.equal(tudo.includes(f), false, `o prompt não pode nomear ${f}`);
    }
  });

  it('escreve os números em pt-BR, o mesmo formato que a verificação lê', () => {
    assert.ok(usuario.includes('40,1'));
    assert.ok(usuario.includes('435'));
    assert.ok(usuario.includes('3,72'));
  });

  it('marca a cobertura desigual e exige a ressalva, pelo nome do CADERNO', () => {
    assert.ok(usuario.includes('COBERTURA DESIGUAL'));
    assert.ok(usuario.includes('Ressalvas obrigatórias'));
    // Era 'Percepção', o módulo da v1. A cobertura de noites é do caderno Sono.
    assert.ok(usuario.includes('Sono'));
  });

  it('cada caderno abre o próprio bloco', () => {
    assert.ok(usuario.includes('### Movimento'));
    assert.ok(usuario.includes('### Sono'));
  });

  it('marca a correlação fraca como amostra insuficiente', () => {
    assert.ok(usuario.includes('AMOSTRA INSUFICIENTE'));
  });

  it('o evento sobrevive ao prompt', () => {
    assert.ok(usuario.includes('Meia maratona'));
  });

  it('a lei do jornal está no sistema', () => {
    assert.ok(sistema.includes('informa, não aconselha'));
  });

  /*
   * A B1 renderizada é a ÚNICA comparação que chega ao modelo neste fixture. Se
   * ela sumisse — trocar `'B1'` por `'B2'` na busca dentro de `bases[]`, ou
   * apagar o bloco — o prompt listaria só valores atuais, a chamada paga sairia
   * igual, e nenhuma outra asserção reprovaria: as que existiam conferiam só o
   * `atual`, e `verificarTexto` lê o pacote, não o prompt.
   *
   * Na v3 ela chega COM NOME — `(contra julho: …)` —, que é a frase que a
   * conferência aceita. Era `(anterior: …)`, que ela não aceita.
   */
  it('a comparação com a base anterior CHEGA ao modelo, NOMEADA, com valor e percentual', () => {
    assert.ok(
      usuario.includes('(contra julho: 862 km, −49,5%)'),
      'sem a B1 renderizada o modelo recebe um período sem nenhuma comparação',
    );
    assert.ok(usuario.includes('(contra julho: 68,2 h'), 'e vale para todo fato, não só um');
    assert.ok(usuario.includes('(contra julho: 3,39'));
  });
});

describe('montarPrompt — os subtítulos de grupo', () => {
  const { usuario } = montarPrompt(pacoteMovimentoAgrupado());

  it('cada grupo abre com o próprio subtítulo', () => {
    assert.ok(usuario.includes('#### Ciclismo'), 'sem subtítulo a lista tem três "Distância"');
    assert.ok(usuario.includes('#### Corrida'));
  });

  it('o subtítulo PRECEDE a distância dele — é o que evita atribuir 333 km à corrida', () => {
    const iGeral = usuario.indexOf('435 km');
    const iCiclismo = usuario.indexOf('#### Ciclismo');
    const i333 = usuario.indexOf('333 km');
    const iCorrida = usuario.indexOf('#### Corrida');
    const i101 = usuario.indexOf('101 km');
    for (const [nome, i] of [['435', iGeral], ['Ciclismo', iCiclismo], ['333', i333], ['Corrida', iCorrida], ['101', i101]] as const) {
      assert.ok(i >= 0, `"${nome}" não saiu no prompt`);
    }
    assert.ok(iGeral < iCiclismo, 'o total do caderno abre, antes dos grupos');
    assert.ok(iCiclismo < i333, 'os 333 km têm que vir DEPOIS do subtítulo Ciclismo');
    assert.ok(i333 < iCorrida, 'e antes do subtítulo Corrida');
    assert.ok(iCorrida < i101);
  });

  it('os três números estão autorizados — por isso o subtítulo é a única defesa', () => {
    // Trocar "333" por "101" numa frase sobre corrida passa nas cinco regras.
    const v = verificarTexto('Foram 435 km, dos quais 333 e 101.', pacoteMovimentoAgrupado());
    assert.deepEqual(v.problemas.filter((x) => x.regra === 'numero'), []);
  });
});

describe('montarPrompt — lacunas', () => {
  it('a lacuna sai com o nome do CADERNO, não com um campo `modulo` que morreu', () => {
    const { usuario } = montarPromptDaEdicao(pacoteAgosto({ lacuna: true }));
    assert.ok(usuario.includes('### Lacunas'));
    assert.ok(
      usuario.includes('- Sono: 4 dias sem dado (relógio sem carga)'),
      'na v1 a linha saía do campo `modulo`, que não existe mais',
    );
  });

  it('sem lacuna, a seção não aparece', () => {
    assert.equal(montarPromptDaEdicao(pacoteAgosto()).usuario.includes('### Lacunas'), false);
  });
});

/* ── o prompt v3: a frase que ele prescreve é a que a conferência aceita ── */

/**
 * **A ida e volta lê o PROMPT RENDERIZADO**, extraindo a frase da linha do fato.
 *
 * Nunca chamando a função que rotula: isso faria os dois lados do teste
 * concordarem sobre uma frase que o texto renderizado não contém, que é a forma
 * exata do defeito que a Story 1.4 deixou — um teste verde sobre uma frase que a
 * produção não emite.
 */
function linhaDoFato(usuario: string, rotulo: string): string {
  const linha = usuario.split('\n').find((l) => l.startsWith(`- ${rotulo}: `));
  assert.ok(linha, `a linha de "${rotulo}" não saiu no prompt`);
  return linha;
}

/** As cláusulas de comparação da linha renderizada: a frase e a cauda dela. */
interface Clausula { frase: string; cauda: string | null }

function clausulas(usuario: string, rotulo: string): Clausula[] {
  const m = /\(([^)]*)\)$/.exec(linhaDoFato(usuario, rotulo));
  if (!m) return [];
  return m[1].split('; ').map((c) => {
    const i = c.indexOf(': ');
    return i < 0 ? { frase: c, cauda: null } : { frase: c.slice(0, i), cauda: c.slice(i + 2) };
  });
}

/**
 * A cauda da cláusula **é** um número pt-BR? Existir não basta.
 *
 * A guarda da iteração 1 perguntava `cauda != null`, e por isso era **inerte**:
 * `contra …: não foi medida` volta com cauda não-nula e passava. Ela só disparava
 * em cláusula sem dois-pontos — forma que `linhaDeFato` não produz. O mesmo
 * regex de número do `verificar.ts`, ancorado no começo.
 */
function comecaComNumero(cauda: string | null): boolean {
  return cauda != null && /^−?(?:\d{1,3}(?:\.\d{3})+|\d+,\d+|\d+)/.test(cauda);
}

function quantas(texto: string, agulha: string): number {
  return texto.split(agulha).length - 1;
}

/**
 * A ida e volta: cada frase que o prompt rotulou, escrita com o número que ela
 * rotula, tem que passar em `verificarTexto`.
 *
 * A primeira asserção é a regra GERAL da iteração 2: uma linha de fato só nomeia
 * uma base quando o número daquela base vem logo em seguida. Nome de base sem
 * número atrás fica a poucos caracteres do valor de OUTRA base — dentro da
 * janela de decisão de 64 —, e é o convite para o modelo escrever a inversão.
 *
 * Roda sobre o `usuario` já renderizado, e por isso serve aos dois grãos: o
 * caderno (o alvo da frente) e a união (o que a produção manda hoje).
 */
function idaEVolta(
  usuario: string, contra: PacoteDeFatos | readonly PacoteDeFatos[], f: FatoNumero,
): void {
  assert.ok(f.atual != null, `o fixture não tem "${f.rotulo}" com valor`);
  const atual = `${formatarNumero(f.atual, f.casas)}${f.unidade ? ` ${f.unidade}` : ''}`;
  const cs = clausulas(usuario, f.rotulo);
  assert.ok(cs.length > 0, 'a linha do fato não trouxe comparação nenhuma');

  for (const c of cs) {
    assert.ok(
      comecaComNumero(c.cauda),
      `a cláusula "${c.frase}" nomeia uma base e o que vem depois dela NÃO é um número `
      + `("${c.cauda}"). Declaração sem número — inexistente ou sem medida — desce para o `
      + 'bloco do caderno: aqui ela põe vocabulário de base dentro da janela de decisão do '
      + 'valor de outra.',
    );
    const texto = `Foram ${atual}, ${c.frase}: ${c.cauda}.`;
    const v = verificarTexto(texto, contra);
    assert.deepEqual(
      v.problemas.filter((x) => x.regra === 'base'), [],
      `a frase que o prompt prescreve reprovou na quinta regra: "${texto}"`,
    );
    assert.deepEqual(
      v.problemas.filter((x) => x.regra === 'numero'), [],
      `a frase que o prompt prescreve citou número fora do alfabeto: "${texto}"`,
    );
  }
}

/**
 * A vizinhança que a emenda evita: a ÚLTIMA cláusula da linha com o único número
 * dela.
 *
 * Com uma declaração sem número de volta inline, a última cláusula passa a ser
 * o nome de uma base e o único número da linha continua sendo o de outra —
 * exatamente o par que reprova, e a frase que a iteração 1 reproduziu à mão:
 * *"Sem a normal do período, o único contraste é 862."*
 */
function ultimaClausulaComOUnicoNumero(
  usuario: string, contra: PacoteDeFatos | readonly PacoteDeFatos[], rotulo: string,
): void {
  const cs = clausulas(usuario, rotulo);
  const ultima = cs[cs.length - 1];
  const comNumero = cs.find((c) => comecaComNumero(c.cauda));
  assert.ok(ultima && comNumero?.cauda, 'a linha do fato não tem cláusula com número');
  const texto = `${ultima.frase}, e o único contraste é ${comNumero.cauda}.`;
  assert.deepEqual(
    verificarTexto(texto, contra).problemas.filter((x) => x.regra === 'base'), [],
    `a linha do fato termina numa frase que reprova ao lado do próprio número: "${texto}"`,
  );
}

const LIMITES: Readonly<Record<string, { inicio: string; fim: string; dias: number }>> = {
  month: { inicio: '2026-08-01', fim: '2026-08-31', dias: 31 },
  year: { inicio: '2025-01-01', fim: '2025-12-31', dias: 365 },
  week: { inicio: '2026-08-03', fim: '2026-08-09', dias: 7 },
  season: { inicio: '2026-04-01', fim: '2026-06-30', dias: 91 },
  all: { inicio: '2000-01-01', fim: '2026-08-31', dias: 9740 },
};

const B2_VALORADA: Base = {
  id: 'B2', rotulo: BASE_ROTULO.B2, existe: true, valor: 300, delta: 135, deltaPct: 45,
};
const B3_VALORADA: Base = {
  id: 'B3', rotulo: BASE_ROTULO.B3, existe: true, valor: 410, delta: 25, deltaPct: 6.1,
};

/**
 * Um fato com as bases valoradas — a linha da matriz da story.
 *
 * Em `all` a B1 **não existe**, por definição: o histórico completo não tem
 * período anterior. É o único tipo assim, e o único que emite a redação de B3
 * *"contra o que você costuma fazer neste período"* — daí ele estar aqui.
 */
function pacoteTresBases(tipo: PeriodKind): PacoteDeFatos {
  const { inicio, fim, dias } = LIMITES[tipo];
  const f = fato('distancia', 'Distância', 435, 862, 'km');
  const b1: Base = tipo === 'all'
    ? {
      id: 'B1', rotulo: BASE_ROTULO.B1, existe: false, valor: null,
      delta: null, deltaPct: null, motivo: 'o histórico completo não tem período anterior',
    }
    : f.bases[0];
  return {
    versao: 2, caderno: 'movimento', rotulo: 'Movimento',
    periodo: {
      tipo,
      rotulo: periodLabel(tipo, new Date(`${inicio}T00:00:00`)),
      rotuloAnterior: previousPeriodLabel(tipo, inicio),
      inicioISO: inicio, fimISO: fim, fechado: true, diasNoPeriodo: dias,
      luz: null,
    },
    metricas: [{ ...f, bases: [b1, B2_VALORADA, B3_VALORADA] }],
    tendencias: [], textos: [], cobertura: null,
    correlacoes: [], eventos: [], lacunas: [], semDado: false,
  };
}

describe('o rótulo do período em prosa — dono único em period/bounds.ts', () => {
  it('mês vira o nome do mês, minúsculo e COM ACENTO', () => {
    // Com acento porque quem escreve é o prompt; quem normaliza é a conferência.
    assert.equal(periodProseLabel('month', 'Março 2026'), 'março');
    assert.equal(periodProseLabel('month', 'Julho 2026'), 'julho');
  });

  it('os outros tipos saem inteiros, só em minúsculas', () => {
    assert.equal(periodProseLabel('year', '2025'), '2025');
    assert.equal(periodProseLabel('season', 'Q1 2026'), 'q1 2026');
    assert.equal(periodProseLabel('week', '27/07 – 02/08'), '27/07 – 02/08');
  });

  it('sem rótulo não há prosa', () => {
    assert.equal(periodProseLabel('month', null), null);
    assert.equal(periodProseLabel('month', '   '), null);
  });
});

describe('montarPrompt — as três bases nomeadas na linha do fato', () => {
  const { usuario } = montarPrompt(pacoteTresBases('month'));

  it('a linha mostra as três, cada uma com a frase prescrita e o percentual', () => {
    assert.equal(
      linhaDoFato(usuario, 'Distância'),
      '- Distância: 435 km (contra julho: 862 km, −49,5%;'
      + ' contra agosto do ano passado: 300 km, 45,0%;'
      + ' contra o que você costuma fazer em agosto: 410 km, 6,1%)',
    );
  });

  it('as três frases são as que o épico prescreve', () => {
    assert.deepEqual(clausulas(usuario, 'Distância').map((c) => c.frase), [
      'contra julho',
      'contra agosto do ano passado',
      'contra o que você costuma fazer em agosto',
    ]);
  });

  /*
   * O TESTE QUE FECHA A JANELA 1.4 → 1.5.
   *
   * A story existe porque o verificador cobra uma nomeação que o prompt não
   * mandava fazer. A prova de que ela fechou não é leitura: é escrever a frase
   * que o prompt rotulou, com o valor que ela rotula, e a conferência aprovar —
   * nos CINCO tipos de período. `all` entrou na iteração 2: é o único em que B1
   * nunca existe, e o único que emite a redação genérica de B3.
   */
  for (const tipo of ['month', 'year', 'week', 'season', 'all'] as const) {
    it(`a ida e volta das formas prescritas, em ${tipo}`, () => {
      const p = pacoteTresBases(tipo);
      idaEVolta(montarPrompt(p).usuario, p, p.metricas[0]);
    });
  }

  it('em `all` a B1 não existe: ela desce para o bloco, e B3 sai na forma genérica', () => {
    const p = pacoteTresBases('all');
    const { usuario } = montarPrompt(p);
    assert.deepEqual(clausulas(usuario, 'Distância').map((c) => c.frase), [
      'contra o mesmo período do ano anterior',
      'contra o que você costuma fazer neste período',
    ]);
    assert.ok(usuario.includes(`sem ${BASE_ROTULO.B1}: não existe`));
  });

  it('semana e trimestre caem no rótulo genérico, que a conferência aceita', () => {
    // "contra 27/07 – 02/08" poria dígitos que o pacote não autoriza, e a frase
    // reprovaria na PRIMEIRA regra, não na quinta.
    for (const tipo of ['week', 'season'] as const) {
      const cs = clausulas(montarPrompt(pacoteTresBases(tipo)).usuario, 'Distância');
      assert.equal(cs[0].frase, 'contra o período anterior', `${tipo} inventou nome próprio`);
      assert.equal(/\d/.test(cs[0].frase), false, `${tipo} pôs dígito na frase da base`);
    }
  });

  it('num ANO o nome próprio é o do ano anterior, e ele nomeia B1 e B2 juntas', () => {
    const cs = clausulas(montarPrompt(pacoteTresBases('year')).usuario, 'Distância');
    assert.equal(cs[0].frase, 'contra 2024');
  });

  /*
   * O MÊS ACENTUADO — a metade da redução que ficou no verificador.
   *
   * `periodProseLabel` devolve o rótulo COM acento, porque quem o escreve é o
   * prompt; `nomeEmProsa` normaliza essa saída antes de procurá-la no texto do
   * modelo. As duas metades vivem em arquivos diferentes, e só uma estava presa:
   * o teste de `periodProseLabel` cobra o acento, e nenhuma ida e volta passava
   * por um mês acentuado — `Março` é o único em `MONTHS_PT`, e nenhum fixture o
   * usava como período anterior.
   *
   * Sem esta asserção, apagar a normalização de `nomeEmProsa` deixa a suíte
   * inteira verde e reprova TODA edição de abril: o prompt prescreve "contra
   * março", a agulha fica com acento, o texto normalizado não a contém, e
   * `nomesProprios` ainda acha "marco" e o denuncia como nome próprio ERRADO —
   * silêncio virando acusação.
   */
  it('a ida e volta sobrevive ao mês acentuado — abril, cujo anterior é março', () => {
    const base = pacoteTresBases('month');
    const abril: PacoteDeFatos = {
      ...base,
      periodo: {
        ...base.periodo,
        rotulo: periodLabel('month', new Date('2026-04-01T00:00:00')),
        rotuloAnterior: previousPeriodLabel('month', '2026-04-01'),
        inicioISO: '2026-04-01', fimISO: '2026-04-30', diasNoPeriodo: 30,
      },
    };
    assert.equal(abril.periodo.rotuloAnterior, 'Março 2026', 'o fixture perdeu o acento');
    const { usuario } = montarPrompt(abril);
    assert.equal(clausulas(usuario, 'Distância')[0].frase, 'contra março');
    idaEVolta(usuario, abril, abril.metricas[0]);
  });
});

/*
 * AS DUAS FORMAS SEM NÚMERO, nos dois grãos.
 *
 * `producao` é o que o celular monta hoje — B1 com valor, B2 e B3 inexistentes,
 * porque `EntradaPacote` vai sem `bases`. `semMedida` é o que ele passa a montar
 * no dia em que alguém popular `bases` sem ter a medida: B3 existe e vale nulo.
 * A iteração 1 tirou da linha só a primeira; a segunda ficou inline sob a frase
 * prescrita, com o nome de B3 a 30 caracteres do valor de B1. A regra é UMA:
 * nomear base na linha exige o número dela em seguida.
 */
function comB3SemMedida(): PacoteDeFatos {
  const f = fato('distancia', 'Distância', 435, 862, 'km');
  return pacoteDeBase([{
    ...f,
    bases: [
      f.bases[0],
      f.bases[1],
      { id: 'B3', rotulo: BASE_ROTULO.B3, existe: true, valor: null, delta: null, deltaPct: null },
    ],
  }]);
}

const SEM_NUMERO: ReadonlyArray<readonly [string, () => PacoteDeFatos]> = [
  ['inexistente (o que a produção emite hoje)',
    () => pacoteDeBase([fato('distancia', 'Distância', 435, 862, 'km')])],
  ['existe e não foi medida', comB3SemMedida],
];

for (const [caso, montarPacote] of SEM_NUMERO) {
  describe(`montarPrompt — declaração sem número: ${caso}`, () => {
    const p = montarPacote();
    const { usuario } = montarPrompt(p);

    it('a linha do fato NÃO carrega nome de base sem o número dela', () => {
      const linha = linhaDoFato(usuario, 'Distância');
      for (const c of clausulas(usuario, 'Distância')) {
        assert.ok(
          comecaComNumero(c.cauda),
          `"${c.frase}" na linha do fato nomeia uma base sem o número dela atrás — põe `
          + `vocabulário de base dentro da janela de decisão do valor de outra: ${linha}`,
        );
      }
      for (const id of ['B1', 'B2', 'B3'] as BaseId[]) {
        assert.equal(linha.includes(BASE_ROTULO[id]), false, 'rótulo genérico na linha do fato');
      }
      assert.equal(linha.includes('não foi medida'), false);
    });

    it('a declaração desce para a seção própria, no pé do caderno', () => {
      assert.ok(usuario.includes('#### Comparações sem número neste caderno'));
      assert.ok(
        usuario.indexOf('#### Comparações sem número neste caderno')
        > usuario.indexOf('- Distância: 435 km'),
        'a declaração vem depois da lista, não antes nem dentro',
      );
    });

    it('a ida e volta, sobre esta forma', () => {
      idaEVolta(usuario, p, p.metricas[0]);
    });

    it('a última cláusula da linha, com o único número dela, não pode reprovar', () => {
      ultimaClausulaComOUnicoNumero(usuario, p, 'Distância');
    });
  });
}

describe('montarPrompt — as duas formas sem número continuam DISTINTAS', () => {
  const inexistente = montarPrompt(
    pacoteDeBase([fato('distancia', 'Distância', 435, 862, 'km')]),
  ).usuario;
  const semMedida = montarPrompt(comB3SemMedida()).usuario;

  it('base que não existe sai como "sem <rótulo>"', () => {
    assert.ok(inexistente.includes(`sem ${BASE_ROTULO.B2}: não existe`));
    assert.ok(inexistente.includes(`sem ${BASE_ROTULO.B3}: não existe`));
  });

  it('base que existe e não foi medida sai como não medida — NÃO como inexistente', () => {
    // Os dois casos da matriz não podem colidir: existir sem medida é outra
    // coisa que não existir, e a revista narraria o silêncio como estabilidade.
    assert.ok(semMedida.includes(`${BASE_ROTULO.B3} existe, mas não foi medida`));
    assert.equal(
      semMedida.includes(`sem ${BASE_ROTULO.B3}`), false,
      'a base que existe foi declarada inexistente — os dois casos colidiram',
    );
    // E a B2, essa sim inexistente no mesmo pacote, continua saindo como tal.
    assert.ok(semMedida.includes(`sem ${BASE_ROTULO.B2}: não existe`));
  });

  it('o bloco usa o rótulo genérico; a linha do fato usa a frase prescrita', () => {
    // Uma base tem um nome POR REGISTRO: a frase prescrita rotula NÚMERO e é o
    // que o modelo copia colado ao valor; o rótulo genérico nomeia a base onde
    // não há número. Os dois registros nunca se misturam.
    for (const u of [inexistente, semMedida]) {
      assert.equal(
        u.includes('contra o que você costuma fazer em agosto: não foi medida'), false,
        'a frase prescrita foi usada onde não há número para copiar',
      );
    }
  });
});

describe('montarPromptDaEdicao — a mesma ida e volta no grão que a PRODUÇÃO usa', () => {
  /*
   * O celular chama `montarPromptDaEdicao` e confere contra a UNIÃO. Um teste que
   * só exercitasse `montarPrompt` mediria o grão que ainda ninguém usa — e é a
   * união que hoje decide se uma edição é gravada ou jogada fora.
   */
  const pacotes = pacoteAgosto();
  const { usuario } = montarPromptDaEdicao(pacotes);

  it('a ida e volta, sobre o prompt da edição inteira', () => {
    idaEVolta(usuario, pacotes, pacotes[0].metricas[1]);   // Distância, do Movimento
  });

  it('a última cláusula da linha, com o único número dela, não pode reprovar', () => {
    ultimaClausulaComOUnicoNumero(usuario, pacotes, 'Distância');
  });

  it('a declaração é uma POR CADERNO — na edição ela aparece uma vez por caderno', () => {
    // "uma vez" é verdade no caderno e falso na edição: cada caderno declara a
    // ausência dele. Afirmar "uma vez" aqui esconderia o grão de que se fala.
    const cadernosQueDeclaram = pacotes.filter(
      (x) => x.metricas.some((m) => m.atual != null
        && m.bases.some((b) => b.id === 'B2' && !b.existe)),
    ).length;
    assert.equal(cadernosQueDeclaram, 2, 'o fixture tem dois cadernos declarando');
    assert.equal(
      quantas(usuario, `sem ${BASE_ROTULO.B2}: não existe`), cadernosQueDeclaram,
    );
    assert.equal(quantas(usuario, '#### Comparações sem número neste caderno'), 2);
  });
});

describe('o bloco de declarações — alcance, nomes e fecho', () => {
  const semB3 = (f: FatoNumero): FatoNumero => ({
    ...f,
    bases: [f.bases[0], f.bases[1], {
      id: 'B3', rotulo: BASE_ROTULO.B3, existe: false, valor: null,
      delta: null, deltaPct: null, motivo: 'sem dois anos',
    }],
  });
  const comB3 = (f: FatoNumero): FatoNumero => ({ ...f, bases: [f.bases[0], f.bases[1], B3_VALORADA] });

  it('quando a ausência é de PARTE dos fatos, ela nomeia quais', () => {
    // Sem isto, trocar `nomeDoFato` por `f.rotulo` — ou o ramo inteiro por uma
    // constante — mantinha a suíte verde.
    const p = pacoteDeBase([
      semB3(fato('distancia', 'Distância', 435, 862, 'km')),
      comB3(fato('tempo', 'Tempo', 40.1, 68.2, 'h', 1)),
    ]);
    const { usuario } = montarPrompt(p);
    assert.ok(usuario.includes(`sem ${BASE_ROTULO.B3}: não existe em Distância.`));
    assert.equal(usuario.includes('em Tempo'), false, 'nomeou um fato que TEM a base');
  });

  it('o grupo desambigua as três "Distância" do caderno Movimento', () => {
    const p = pacoteDeBase([
      comB3(fato('distancia', 'Distância', 435, 862, 'km')),
      semB3(fato('cic.distancia', 'Distância', 333, 820, 'km', 0, 'Ciclismo')),
    ]);
    assert.ok(
      montarPrompt(p).usuario.includes(`sem ${BASE_ROTULO.B3}: não existe em Ciclismo · Distância.`),
      'sem o grupo, a declaração aponta para uma das três "Distância" e não se sabe qual',
    );
  });

  it('nome de fato com DÍGITO não entra — é a mesma guarda do `desde`', () => {
    // "Hábitos ruins · Cerveja 500 ml" poria o 500, fora do alfabeto, a poucos
    // caracteres do vocabulário de B3 — dentro da seção criada para separá-los.
    const p = pacoteDeBase([
      semB3(fato('habito.cerveja', 'Cerveja 500 ml', 12, 9, 'dias', 0, 'Hábitos ruins')),
      comB3(fato('tempo', 'Tempo', 40.1, 68.2, 'h', 1)),
    ]);
    const { usuario } = montarPrompt(p);
    const bloco = usuario.slice(usuario.indexOf('#### Comparações sem número'));
    assert.equal(/\d/.test(bloco), false, 'dígito no bloco de declarações');
    assert.ok(bloco.includes(`sem ${BASE_ROTULO.B3}: não existe em parte dos fatos deste caderno.`));
  });

  it('fato sem `atual` não é declarado — ele não está na lista que o modelo vê', () => {
    // O fato vivo tem as três bases; o morto não tem B3. Sem o filtro `atual !=
    // null`, a seção nasceria para falar de uma linha que o modelo não vê.
    const vivo: FatoNumero = {
      ...fato('distancia', 'Distância', 435, 862, 'km'),
      bases: [fato('distancia', 'Distância', 435, 862, 'km').bases[0], B2_VALORADA, B3_VALORADA],
    };
    const morto: FatoNumero = { ...semB3(fato('vfc', 'VFC', 54, 71)), atual: null };
    const { usuario } = montarPrompt(pacoteDeBase([vivo, morto]));
    assert.equal(usuario.includes('VFC'), false, 'declarou a base de uma linha que não é impressa');
    assert.equal(usuario.includes('#### Comparações sem número neste caderno'), false);
  });

  it('o fecho é regra da SEÇÃO, separado do último item por linha em branco', () => {
    // Emendado ao item por um `\n` só, o Markdown o lê como continuação
    // preguiçosa daquele item — vira texto de uma das bases, não da seção.
    const { usuario } = montarPrompt(pacoteDeBase([fato('distancia', 'Distância', 435, 862, 'km')]));
    assert.ok(usuario.includes(
      `sem ${BASE_ROTULO.B3}: não existe em todos os fatos deste caderno.\n\n`
      + 'As comparações desta seção não têm número neste caderno. Ao escrever, não\n'
      + 'ponha o nome de nenhuma delas junto de um número de outra comparação.',
    ));
  });

  /*
   * O FECHO NOMEIA A SEÇÃO, NÃO UMA POSIÇÃO.
   *
   * "As linhas acima" não é fronteira: acima desta seção estão a lista de fatos
   * e a Cobertura, que TÊM número. E num período sem nome próprio — semana,
   * trimestre, `all` — a frase prescrita É o rótulo genérico, então a mesma base
   * aparece nas duas, uma vez rotulando o valor dela. Dizer "nenhuma das linhas
   * acima tem número" era falso nos dois casos.
   */
  it('o fecho não se refere a "as linhas acima" — isso era falso em três tipos', () => {
    const { usuario } = montarPrompt(pacoteTresBases('week'));
    assert.equal(usuario.includes('linhas acima'), false);
    // A prova de que era falso: na semana a linha do fato usa o rótulo genérico,
    // com o número dela junto — o registro coincide, e o par continua correto.
    assert.equal(clausulas(usuario, 'Distância')[0].frase, `contra ${BASE_ROTULO.B1}`);
  });
});

describe('montarPrompt — caderno sem dado não vira prompt', () => {
  /*
   * A Story 1.10 chama `montarPrompt` QUATRO vezes por edição. Sem contrato,
   * quatro cadernos vazios seriam quatro cabeçalhos, oito leis e zero fatos —
   * quatro chamadas pagas que só podem ser respondidas inventando.
   */
  const vazio: PacoteDeFatos = {
    ...pacoteDeBase([]), caderno: 'rotina', rotulo: 'Rotina', semDado: true,
  };

  it('`usuario` vazio é o sinal de NÃO GASTE CHAMADA', () => {
    assert.equal(montarPrompt(vazio).usuario, '');
    assert.equal(montarPromptDaEdicao([]).usuario, '', 'o mesmo contrato no outro grão');
  });

  it('a lei continua saindo — o vazio é do pacote, não do sistema', () => {
    assert.ok(montarPrompt(vazio).sistema.includes('informa, não aconselha'));
  });

  it('mas um caderno cuja única linha é a lápide É narrado — a lápide vence o vazio', () => {
    const comLapide: PacoteDeFatos = {
      ...vazio,
      textos: [{ chave: 'lapide.spo2', rotulo: 'SpO2', valor: 'sem medida desde o dia 16' }],
      semDado: false,
    };
    const { usuario } = montarPrompt(comLapide);
    assert.ok(usuario.includes('#### Fatos sem número'));
    assert.ok(usuario.includes('SpO2'));
  });

  /*
   * `semDado` NÃO é o vazio inteiro: ele olha `metricas`, `tendencias` e
   * `textos`, e ignora cobertura, lacunas, eventos e correlações. Um caderno de
   * Sono sem uma única métrica pode ter 31 dias de lacuna e cobertura desigual —
   * e a regra 8 obriga a declarar a segunda. Devolver vazio ali calaria uma
   * ressalva obrigatória, e na Story 1.10, onde cada caderno é conferido
   * sozinho, não haveria outro caderno para carregá-la.
   */
  it('mudo não é o mesmo que `semDado`: cobertura e lacuna ainda são narradas', () => {
    const cego: PacoteDeFatos = {
      ...vazio,
      caderno: 'sono',
      rotulo: 'Sono',
      cobertura: {
        diasComDado: 0, diasNoPeriodo: 31,
        diasComDadoAnterior: 22, diasNoPeriodoAnterior: 31,
        comparavel: false,
      },
      lacunas: [{ caderno: 'sono', diasSemDado: 31, motivo: 'relógio sem carga' }],
    };
    const { usuario } = montarPrompt(cego);
    assert.notEqual(usuario, '', 'um caderno com ressalva obrigatória não é mudo');
    assert.ok(usuario.includes('COBERTURA DESIGUAL'), 'a regra 8 precisa do aviso');
    assert.ok(usuario.includes('Ressalvas obrigatórias'));
    assert.ok(usuario.includes('relógio sem carga'), 'a lacuna também some junto');
  });
});

describe('montarPrompt — trajetória, fatos sem número e cobertura', () => {
  const base = pacoteDeBase([fato('distancia', 'Distância', 435, 862, 'km')]);
  const comTendencia: PacoteDeFatos = {
    ...base,
    tendencias: [{
      chave: 'distancia', rotulo: 'Distância', direcao: 'cai', periodos: 3, desde: 'junho',
    }],
  };

  it('a trajetória sai como DIREÇÃO, e o único número dela é a contagem', () => {
    const { usuario } = montarPrompt(comTendencia);
    assert.ok(usuario.includes('#### Trajetória'));
    const linha = usuario.split('\n').find((l) => l.startsWith('- Distância: cai'));
    assert.ok(linha, 'a trajetória não saiu no prompt');
    assert.ok(linha.includes('desde junho'));
    assert.deepEqual(
      linha.match(/\d+/g), ['3'],
      'valor bruto na trajetória: ela põe UM inteiro no alfabeto e mais nada',
    );
  });

  it('`desde` com dígito NÃO vai ao prompt — reprovaria na primeira regra', () => {
    const comDigito: PacoteDeFatos = {
      ...comTendencia,
      tendencias: [{ ...comTendencia.tendencias[0], desde: '27/07 – 02/08' }],
    };
    const { usuario } = montarPrompt(comDigito);
    assert.equal(usuario.includes('27/07'), false);
    assert.ok(usuario.includes('- Distância: cai — 3 períodos seguidos'));
  });

  const comTexto: PacoteDeFatos = {
    ...base,
    textos: [{ chave: 'piso', rotulo: 'Piso', valor: '72% pavimentado' }],
    cobertura: {
      diasComDado: 27, diasNoPeriodo: 31,
      diasComDadoAnterior: 14, diasNoPeriodoAnterior: 31,
      comparavel: false,
    },
  };

  it('os fatos sem número saem por extenso, em seção própria', () => {
    const { usuario } = montarPrompt(comTexto);
    assert.ok(usuario.includes('#### Fatos sem número'));
    assert.ok(usuario.includes('- Piso: 72% pavimentado'));
  });

  it('e o 72 de "72% pavimentado" NÃO está no alfabeto — citá-lo solto reprova', () => {
    // A armadilha da forma: `FatoTexto` não entra no alfabeto numérico, e é
    // justamente por isso que ele existe como forma própria. Ninguém produz
    // `FatoTexto` hoje; quem for produzir precisa saber disto.
    const v = verificarTexto('O piso foi 72% pavimentado, e foram 435 km.', comTexto);
    assert.ok(v.problemas.some((x) => x.regra === 'numero' && x.detalhe.includes('72')));
  });

  it('a Cobertura tem seção PRÓPRIA, e não cai sob o último subtítulo', () => {
    // Sob "Fatos sem número", a regra 5 do SISTEMA proibiria exatamente os dois
    // números que a regra 8 obriga a escrever na ressalva.
    const { usuario } = montarPrompt(comTexto);
    const iTextos = usuario.indexOf('#### Fatos sem número');
    const iCobertura = usuario.indexOf('#### Cobertura');
    const iNumeros = usuario.indexOf('Neste período: 27 de 31 dias');
    assert.ok(iTextos >= 0 && iCobertura > iTextos, 'a Cobertura perdeu a seção própria');
    assert.ok(iNumeros > iCobertura, 'os números da cobertura têm que vir sob o subtítulo dela');
    assert.ok(usuario.includes('COBERTURA DESIGUAL'));
  });

  it('a linha de Cobertura evita o vocabulário de B1 — a redação é escolhida', () => {
    // Estes números não são valor de base nenhuma. Chamá-los de "período
    // anterior" poria a preposição que a quinta regra lê colada a um número que
    // ela não julga — e voltar a `No período anterior:` deixava tudo verde.
    const { usuario } = montarPrompt(comTexto);
    assert.ok(usuario.includes(
      '- Neste período: 27 de 31 dias. No período comparado: 14 de 31 dias.',
    ));
    for (const vocab of ['período anterior', 'período passado', 'ciclo anterior']) {
      assert.equal(
        usuario.slice(usuario.indexOf('#### Cobertura')).includes(vocab), false,
        `a seção Cobertura escreveu "${vocab}", que é vocabulário de B1`,
      );
    }
  });
});

describe('montarPrompt — um caderno, e a união é outra função', () => {
  const [movimento, sono] = pacoteAgosto();

  it('o prompt de um caderno não conhece número nem rótulo do outro', () => {
    const { usuario } = montarPrompt(sono);
    assert.ok(usuario.includes('### Sono'));
    assert.equal(usuario.includes('Movimento'), false);
    for (const n of ['435', '862', '40,1', '68,2']) {
      assert.equal(usuario.includes(n), false, `${n} é de Movimento e vazou para o caderno de Sono`);
    }
    assert.equal(usuario.includes('Meia maratona'), false, 'o evento é de Movimento');
  });

  it('o escopo sai do CABEÇALHO, e os dois grãos o escrevem diferente', () => {
    assert.match(montarPrompt(sono).usuario, /^Escreva o caderno Sono\./m);
    assert.match(
      montarPromptDaEdicao([movimento, sono]).usuario,
      /^Escreva a edição inteira: os cadernos abaixo, num texto só\./m,
    );
  });

  it('a união segue montando os quatro cadernos num texto só — até a Story 1.10', () => {
    const { usuario } = montarPromptDaEdicao([movimento, sono]);
    assert.ok(usuario.includes('### Movimento'));
    assert.ok(usuario.includes('### Sono'));
  });

  it('a edição vazia não vira prompt', () => {
    assert.equal(montarPromptDaEdicao([]).usuario, '');
  });
});

describe('SISTEMA — as leis do jornal', () => {
  const { sistema } = montarPrompt(pacoteTresBases('month'));

  it('a lei serve aos DOIS grãos — não descreve só o caderno nem só a edição', () => {
    // O celular manda os quatro cadernos num texto só até a Story 1.10. Um
    // SISTEMA no singular descreveria errado a chamada que está em produção.
    assert.doesNotMatch(sistema, /você escreve o caderno/i);
    assert.doesNotMatch(sistema, /você escreve a edição/i);
    assert.ok(sistema.includes('O CABEÇALHO da mensagem diz o'));
    assert.ok(sistema.includes('um caderno da revista ou a edição inteira'));
  });

  /*
   * A LEI 2 NÃO PODE SER MAIS ESTRITA QUE O VERIFICADOR.
   *
   * Ela dizia *"uma frase que traz o número de uma comparação não traz o nome de
   * outra"*, e isso proibia prosa que a conferência aprova — inclusive a forma
   * que a própria linha do fato exibe, com três nomes e três números colados aos
   * seus. Lei estrita demais não reprova nada; ela joga fora escrita boa, e o
   * modelo que a obedecesse ao pé da letra não conseguiria comparar duas bases
   * na mesma frase. O perigo real é outro, e agora é ele que está escrito: nome
   * de comparação **sem o número dela** ao lado do número de outra.
   */
  it('manda NOMEAR a comparação, e proíbe só o que é perigoso de verdade', () => {
    assert.ok(sistema.includes('2. NOMEAR A COMPARAÇÃO'));
    assert.ok(sistema.includes('COPIE junto dele a'));
    assert.match(sistema, /PODE pôr mais de uma comparação na mesma frase/);
    assert.match(sistema, /nome de uma comparação\s+SEM o número dela/);
  });

  it('e a prosa que a lei 2 permite é a mesma que a conferência aprova', () => {
    // A prova de que a lei parou de ser mais estrita que a regra que a cobra.
    const p = pacoteTresBases('month');
    const duas = 'Foram 435 km, contra julho: 862 km, e contra agosto do ano passado: 300 km.';
    assert.deepEqual(verificarTexto(duas, p).problemas, [], duas);
  });

  /*
   * AS LEIS FALAM DO TEXTO, NÃO DA LISTA.
   *
   * A linha de fato canônica tem três nomes de comparação e três números numa
   * frase só, e a conferência a aceita — cada nome está colado ao número dele.
   * Uma lei escrita como "nome de comparação não fica perto de número"
   * proibiria o que o próprio prompt exibe, e o modelo que a lesse ao pé da
   * letra não teria como escrever nada.
   */
  it('as leis dizem de quem falam, e distinguem o texto da lista de fatos', () => {
    assert.ok(sistema.includes('As oito regras abaixo falam do TEXTO QUE VOCÊ ESCREVE.'));
    assert.match(sistema, /a lista põe vários rótulos e vários números na mesma linha de\s+propósito/);
    assert.ok(sistema.includes('VOCABULÁRIO.'), 'sem definir "número de comparação" as leis 2-4 são vagas');
    assert.equal(quantas(sistema, 'NÚMERO DE COMPARAÇÃO') >= 3, true);
  });

  it('a regra 3 não é mais estrita que o verificador', () => {
    // `"Sem a normal do período, foram 435 km."` PASSA na conferência — 435 é o
    // `atual`, não valor de base. Uma lei que a proibisse gastaria a permissão
    // que ela concede: numa retro quase toda frase carrega número.
    const p = pacoteDeBase([fato('distancia', 'Distância', 435, 862, 'km')]);
    const v = verificarTexto('Sem a normal do período, foram 435 km.', p);
    assert.deepEqual(v.problemas.filter((x) => x.regra === 'base'), []);
    assert.match(sistema, /Junto dos outros números,\s+pode:/);
  });

  it('a regra 4 fala do texto, e não proíbe o que a própria trajetória renderiza', () => {
    // `- Distância: cai — 3 períodos seguidos, desde junho` põe o `3` a 26
    // caracteres de `junho`. A lei fala do NÚMERO DE COMPARAÇÃO, que o `3` não é.
    assert.match(sistema, /no seu\s+texto, não o ponha na mesma frase que um NÚMERO DE COMPARAÇÃO/);
  });

  it('a regra 5 é satisfazível — cita a ideia, não o número de dentro', () => {
    // "cite por extenso, como está escrito" + "nunca extraia o número de dentro"
    // era insatisfazível para uma linha cujo conteúdo É um percentual.
    assert.ok(sistema.includes('você cita pela IDEIA'));
    assert.doesNotMatch(sistema, /por extenso,\s*\n?\s*como está escrito/);
  });

  /*
   * NENHUM NÚMERO SOLTO NA LEI.
   *
   * Um valor escrito no SISTEMA é um número que o modelo pode copiar e que o
   * pacote não autoriza — reprova na regra 1 e joga fora a edição. Sobram os
   * ordinais das regras e os dois exemplos de data da FORMA, ambos ignoráveis
   * por construção: `ignoravel()` deixa passar dia-do-mês seguido de "de", e a
   * data ISO é mascarada antes da varredura.
   */
  it('a lei não escreve número que o pacote não autoriza', () => {
    const permitidos = new Set(['1', '2', '3', '4', '5', '6', '7', '8', '30', '08', '2026']);
    const soltos = [...new Set(sistema.match(/\d+/g) ?? [])].filter((n) => !permitidos.has(n));
    assert.deepEqual(soltos, [], 'número solto no SISTEMA é número que o modelo pode citar');
  });

  /*
   * PRESCREVER PELA RENDERIZAÇÃO, NÃO PELO EXEMPLO.
   *
   * Um exemplo fixo de base no SISTEMA — "contra julho" — envelheceria em
   * silêncio no dia em que o período mudasse de tipo, ensinando ao modelo uma
   * frase que a conferência recusa. O nome de mês continua sendo cobrado só no
   * parágrafo da regra 2, porque a seção FORMA PRECISA do "30 de agosto".
   */
  it('a regra 2 não dá exemplo de base, e a varredura não condena o "30 de agosto"', () => {
    const i = sistema.indexOf('\n2. NOMEAR');
    const j = sistema.indexOf('\n\n3. ');
    assert.ok(i >= 0 && j > i, 'a regra 2 mudou de forma e a varredura ficou sem alvo');
    const regra2 = sistema.slice(i, j).toLowerCase();
    assert.deepEqual(
      MONTHS_PT.filter((m) => new RegExp(`\\b${m.toLowerCase()}\\b`).test(regra2)), [],
      'nome de mês na regra 2 é exemplo fixo de base — ele envelhece calado',
    );
    assert.ok(sistema.includes('"30 de agosto"'), 'a FORMA precisa do exemplo de data');
  });

  /*
   * E O VOCABULÁRIO DE BASE É COBRADO NO SISTEMA INTEIRO, não num parágrafo.
   *
   * A varredura por nome de mês olhava só a regra 2, e a lei escapava por três
   * seções abaixo: a FORMA proibia planilha com o exemplo "em comparação com o
   * ciclo passado", e `'ciclo passado'` é literalmente `B1_GENERICO` —
   * vocabulário de base dentro da lei que jura não ter nenhum. Quebrado em duas
   * linhas pelo formatador, nem um grep pela frase o achava.
   *
   * O alvo é o texto do `SISTEMA` **normalizado**, do mesmo jeito que a quinta
   * regra lê o texto do modelo: é o único jeito de a varredura enxergar o que a
   * conferência enxergaria.
   */
  it('nenhum vocabulário de base em lugar nenhum do SISTEMA', () => {
    const alvo = sistema
      .toLowerCase()
      .replace(/[áàâã]/g, 'a').replace(/[éê]/g, 'e').replace(/[íì]/g, 'i')
      .replace(/[óôõ]/g, 'o').replace(/[úü]/g, 'u').replace(/ç/g, 'c')
      // A lei é quebrada em linhas; o vocabulário não conhece quebra.
      .replace(/\s+/g, ' ');
    const VOCAB = [
      'periodo anterior', 'periodo passado', 'ciclo anterior', 'ciclo passado',
      'etapa anterior', 'etapa passada', 'semana anterior', 'semana passada',
      'mes anterior', 'mes passado', 'trimestre anterior', 'trimestre passado',
      'estacao anterior', 'ano anterior', 'ano passado', 'mesmo periodo do ano',
      'um ano antes', 'ha um ano', 'normal do periodo', 'normal historica',
      'media historica', 'media dos anos', 'costuma fazer',
    ];
    assert.deepEqual(
      VOCAB.filter((v) => alvo.includes(v)), [],
      'a lei carrega uma frase que a quinta regra lê como nomeação de base',
    );
  });

  it('a PRIMEIRA FRASE é declarada capa e sumário', () => {
    // A chamada de cada caderno é a primeira frase do texto dele, cortada no
    // primeiro ponto. Sem esta lei, o modelo não sabe que ela sai sozinha.
    assert.ok(sistema.includes('A PRIMEIRA FRASE é a manchete'));
    assert.match(sistema, /ela vira a capa e o sumário, lida sozinha e\s+fora de contexto/);
  });

  it('declara a ausência, a trajetória e os fatos sem número', () => {
    assert.ok(sistema.includes('3. COMPARAÇÃO QUE NÃO EXISTE'));
    assert.ok(sistema.includes('4. TRAJETÓRIA'));
    assert.ok(sistema.includes('5. FATOS SEM NÚMERO'));
  });

  it('informa e não aconselha, com os exemplos proibidos por extenso', () => {
    assert.ok(sistema.includes('informa, não aconselha'));
    for (const proibido of ['continue assim', 'tente dormir mais', 'parabéns pelo mês']) {
      assert.ok(sistema.includes(proibido), `o exemplo proibido "${proibido}" sumiu`);
    }
  });

  it('nunca calcula, nunca afirma causa, e a ressalva de cobertura continua obrigatória', () => {
    assert.ok(sistema.includes('Nunca calcule, some, divida ou derive um número novo'));
    assert.ok(sistema.includes('6. CAUSA'));
    assert.ok(sistema.includes('8. RESSALVAS'));
    assert.ok(sistema.includes('COBERTURA DESIGUAL'));
  });

  it('a versão do prompt é 4 — a luz entrou no cabeçalho', () => {
    assert.equal(PROMPT_VERSAO, 4);
  });

  /*
   * A LINHA DA LUZ TEM LEI. Sem ela, o modelo que usasse a luz para o que ela
   * serve — situar a estação — escreveria "a corrida subiu graças aos dias
   * longos", e a regra de causa recusaria a edição. Medido na revisão.
   */
  it('a lei diz o que fazer com a linha da luz: contexto, nunca explicação, nunca horas', () => {
    assert.match(sistema, /"Luz do dia" é CONTEXTO DE ESTAÇÃO/);
    assert.match(sistema, /Nunca a use como\s+explicação/);
    // Outro período também, e não só outro ano: "os dias já encurtam desde
    // julho" põe o nome do mês anterior perto de números, e a quinta regra o lê
    // como nomeação de B1.
    assert.match(sistema, /nunca a compare com outro período ou outro ano/);
    assert.match(sistema, /nunca diga que os\s+dias estão crescendo ou encurtando/);
    assert.match(sistema, /nunca a escreva em horas/);
    // A redação anterior dizia que "qualquer número delas invalida o texto" — e é
    // falso: "16h de sol" passa pela isenção de hora de relógio. Lei que promete
    // o que a conferência não cobra é pior que ausência.
    assert.doesNotMatch(sistema, /qualquer número delas invalida/);
  });

  it('e é por isso que a luz não pode ser explicação: a regra de causa a recusa', () => {
    const p = pacoteTresBases('month');
    const obediente = 'Agosto foi de dias longos. Foram 435 km, contra julho: 862 km.';
    assert.deepEqual(verificarTexto(obediente, p).problemas, [], 'situar a estação passa');
    const explicando = 'Foram 435 km graças aos dias longos, contra julho: 862 km.';
    const regras = verificarTexto(explicando, p).problemas.map((x) => x.regra);
    assert.ok(regras.includes('causa'), 'usar a luz como explicação é causa, e a edição cai');
  });
});

/*
 * QUANTO DE CADA LEI A CONFERÊNCIA REALMENTE COBRA.
 *
 * O comentário do `SISTEMA` afirmava que "cada uma tem um teste correspondente em
 * verificar.ts". É falso para as leis 3, 4 e 8, e afirmação falsa aqui é pior que
 * ausência: faz quem lê acreditar que o prompt está atrás de uma rede que não
 * existe. Estes testes medem a afirmação corrigida, em vez de a deixarem de pé.
 */
describe('o que a conferência NÃO cobra — a rede que o SISTEMA não tem', () => {
  const p = pacoteDeBase([fato('distancia', 'Distância', 435, 862, 'km')]);
  const semRegra = (t: string) => verificarTexto(t, p).problemas.map((x) => x.regra);

  it('lei 4 (trajetória): a conferência não olha direção nem `desde` — zero cobertura', () => {
    const comTendencia: PacoteDeFatos = {
      ...p,
      tendencias: [{ chave: 'distancia', rotulo: 'Distância', direcao: 'cai', periodos: 3, desde: 'junho' }],
    };
    // Direção invertida e `desde` de outro período: nada disso é conferível.
    const v = verificarTexto('A distância sobe há 3 períodos, desde março.', comTendencia);
    assert.deepEqual(v.problemas.filter((x) => x.regra !== 'base'), [], 'só a base opina aqui');
  });

  it('lei 8 (ressalva): a conferência procura PALAVRA-CHAVE e nunca compara os números', () => {
    const comCobertura: PacoteDeFatos = {
      ...p,
      cobertura: {
        diasComDado: 27, diasNoPeriodo: 31,
        diasComDadoAnterior: 14, diasNoPeriodoAnterior: 31, comparavel: false,
      },
    };
    // A palavra "cobertura" basta; os dois números que a lei 8 exige podem faltar.
    const v = verificarTexto('A cobertura foi desigual. Foram 435 km.', comCobertura);
    assert.deepEqual(
      v.problemas.filter((x) => x.regra === 'ressalva'), [],
      'se isto passar a reprovar, a lei 8 ganhou rede e a tabela do SISTEMA envelheceu',
    );
  });

  it('lei 3 (ausência): declarar longe de número de base passa — a cobertura é parcial', () => {
    assert.deepEqual(semRegra('Sem a normal do período, foram 435 km.'), []);
  });

  it('as leis 1, 2, 6 e 7 têm rede, e ela morde', () => {
    assert.ok(semRegra('Foram 999 km.').includes('numero'));
    assert.ok(semRegra('Foram 435 km, contra 862 no ano passado.').includes('base'));
    assert.ok(semRegra('Dormiu melhor porque correu.').includes('causa'));
  });
});

/*
 * ── A LUZ DO PERÍODO É INVISÍVEL PARA A CONFERÊNCIA (Story 1.6) ──
 *
 * A segunda tentativa da camada de luz escrevia *"a mesma luz de agosto do ano
 * passado"* — que é literalmente a frase prescrita de B2 — e a quinta regra
 * capturava números de B1 com ela, mesmo com "julho" na frase: *"Sob a mesma
 * luz de agosto do ano passado, 820 km em julho viraram 333"* era recusado.
 * Os testes daquela tentativa conferiam a STRING do prompt e nunca passavam o
 * texto pelo verificador. Estes passam.
 */
describe('a luz do período — invisível para a quinta regra', () => {
  /** Como a quinta regra lê: minúsculas, sem acento, sem quebra de linha. */
  const normalizado = (s: string) => s.toLowerCase()
    .replace(/[áàâã]/g, 'a').replace(/[éê]/g, 'e').replace(/[íì]/g, 'i')
    .replace(/[óôõ]/g, 'o').replace(/[úü]/g, 'u').replace(/ç/g, 'c')
    .replace(/\s+/g, ' ');

  // O mesmo vocabulário que a quinta regra usa para nomear B1, B2 e B3.
  const VOCAB_DE_BASE = [
    'periodo anterior', 'periodo passado', 'ciclo anterior', 'ciclo passado',
    'etapa anterior', 'etapa passada', 'semana anterior', 'semana passada',
    'mes anterior', 'mes passado', 'trimestre anterior', 'trimestre passado',
    'estacao anterior', 'ano anterior', 'ano passado', 'mesmo periodo do ano',
    'um ano antes', 'ha um ano', 'normal do periodo', 'a normal', 'normal historica',
    'media historica', 'media dos anos', 'costuma fazer',
  ];

  const TEXTOS = Object.values(TEXTO_DA_ESTACAO);

  it('cada texto de estação: sem dígito, sem vocabulário de base, sem nome de mês', () => {
    assert.equal(TEXTOS.length, 3);
    // Congelado: o barril o exporta, e `Readonly` é só de tipo — sem o freeze,
    // um consumidor poria dígito ou "ano passado" no cabeçalho de toda edição.
    assert.ok(Object.isFrozen(TEXTO_DA_ESTACAO));
    for (const t of TEXTOS) {
      const n = normalizado(t);
      assert.equal(/\d/.test(n), false, `"${t}" tem dígito`);
      assert.deepEqual(VOCAB_DE_BASE.filter((v) => n.includes(v)), [], `"${t}" nomeia base`);
      assert.deepEqual(
        MONTHS_PT.filter((m) => new RegExp(`\\b${normalizado(m)}\\b`).test(n)), [],
        `"${t}" tem nome de mês`,
      );
    }
  });

  /*
   * IDA E VOLTA, e é ela que importa: o mesmo texto, com e sem a frase da luz,
   * tem que ter o MESMO veredito — nas frases que passam, nas que reprovam por
   * ausência e nas que reprovam por inversão. A frase é posta no começo, colada
   * ANTES do número de base e colada DEPOIS dele, que é a vizinhança onde a
   * tentativa anterior capturava.
   */
  it('copiar a frase da luz não muda o veredito de frase nenhuma, em nenhum tipo de período', () => {
    const casos: Array<[string, PacoteDeFatos, string[]]> = [
      ['mês', pacoteTresBases('month'), [
        'Foram 435 km, contra julho: 862 km.',
        'Foram 435 km, contra 862.',
        'Foram 435 km, contra 862 em agosto do ano passado.',
        'Foram 435 km, contra agosto do ano passado: 300 km.',
        'Foram 435 km, contra o que você costuma fazer em agosto: 410 km.',
        'Em julho foram 862 km; em agosto, 435.',
      ]],
      ['ano', pacoteTresBases('year'), [
        'Foram 435 km, contra 2024: 862 km.',
        'Foram 435 km, contra 862.',
      ]],
      ['semana', pacoteTresBases('week'), [
        'Foram 435 km, contra o período anterior: 862 km.',
        'Foram 435 km, contra 862.',
        'Foram 435 km, contra 862 no ano passado.',
      ]],
      ['trimestre', pacoteTresBases('season'), [
        'Foram 435 km, contra o período anterior: 862 km.',
        'Foram 435 km, contra 862.',
      ]],
    ];
    let conferidos = 0;
    for (const [tipo, p, frases] of casos) {
      for (const frase of frases) {
        const antes = verificarTexto(frase, p).problemas;
        for (const luz of TEXTOS) {
          // Colada antes e depois de CADA número — não só do primeiro, que é o
          // `atual` em quase toda frase: a vizinhança que a tentativa anterior
          // capturava é a dos valores de BASE, e B2 e B3 vêm por último.
          const variantes = [`Em ${luz}, ${frase.charAt(0).toLowerCase()}${frase.slice(1)}`];
          for (const m of frase.matchAll(/\d[\d.,]*\d|\d/g)) {
            const a = m.index ?? 0;
            const b = a + m[0].length;
            variantes.push(`${frase.slice(0, a)}${luz}, ${frase.slice(a)}`);
            variantes.push(`${frase.slice(0, b)}, com ${luz},${frase.slice(b)}`);
          }
          for (const v of variantes) {
            assert.deepEqual(
              verificarTexto(v, p).problemas, antes,
              `${tipo}: a luz mudou o veredito\n  sem: ${frase}\n  com: ${v}`,
            );
            conferidos += 1;
          }
        }
      }
    }
    assert.ok(conferidos >= 200, `só ${conferidos} variantes conferidas`);
  });

  it('o prompt escreve a luz UMA vez, no cabeçalho — nos dois grãos', () => {
    const p = pacoteTresBases('month');
    const comLuz: PacoteDeFatos = { ...p, periodo: { ...p.periodo, luz: TEXTO_DA_ESTACAO.longos } };
    const outro: PacoteDeFatos = { ...comLuz, caderno: 'sono', rotulo: 'Sono' };
    const vezes = (s: string) => s.split(TEXTO_DA_ESTACAO.longos).length - 1;
    assert.equal(vezes(montarPrompt(comLuz).usuario), 1, 'no caderno');
    assert.equal(vezes(montarPromptDaEdicao([comLuz, outro]).usuario), 1, 'na edição, com dois cadernos');
    const cabecalho = montarPromptDaEdicao([comLuz, outro]).usuario.split('\n###')[0];
    assert.ok(cabecalho.includes(`Luz do dia: ${TEXTO_DA_ESTACAO.longos}.`), 'mora no cabeçalho, não num caderno');
  });

  it('sem estação, o prompt não escreve linha de luz nenhuma', () => {
    const p = pacoteTresBases('year');
    assert.equal(p.periodo.luz, null);
    assert.equal(montarPrompt(p).usuario.includes('Luz do dia'), false);
  });
});
