import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { PeriodKind } from '../period/bounds';
import { MONTHS_PT, periodLabel, previousPeriodLabel } from '../period/bounds';
import type { Base, FatoNumero, PacoteDeFatos } from './pacote';
import { BASE_ROTULO } from './pacote';
import { formatarNumero, montarPrompt } from './prompt';
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

  it('a forma de B3 — "o que você costuma fazer em agosto" — nomeia B3', () => {
    // A terceira forma prescrita. O nome que aparece nela é o do período
    // corrente; quem nomeia a base é a perífrase.
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
    assert.deepEqual(
      daBase('Foram 435 km, contra os 410 da normal do período para agosto.', comB3),
      [],
    );
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

describe('montarPrompt', () => {
  const p = pacoteAgosto({ correlacaoFraca: true });
  const { sistema, usuario } = montarPrompt(p);

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
   * A B1 renderizada é a ÚNICA comparação que chega ao modelo. Se ela sumisse —
   * trocar `'B1'` por `'B2'` na busca dentro de `bases[]`, ou apagar o bloco —
   * o prompt listaria só valores atuais, a chamada paga sairia igual, e nenhuma
   * outra asserção reprovaria: as que existiam conferiam só o `atual`, e
   * `verificarTexto` lê o pacote, não o prompt.
   */
  it('a comparação com a base anterior CHEGA ao modelo, com valor e percentual', () => {
    assert.ok(
      usuario.includes('(anterior: 862 km, −49,5%)'),
      'sem a B1 renderizada o modelo recebe um período sem nenhuma comparação',
    );
    assert.ok(usuario.includes('(anterior: 68,2 h'), 'e vale para todo fato, não só um');
    assert.ok(usuario.includes('(anterior: 3,39'));
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
    const { usuario } = montarPrompt(pacoteAgosto({ lacuna: true }));
    assert.ok(usuario.includes('### Lacunas'));
    assert.ok(
      usuario.includes('- Sono: 4 dias sem dado (relógio sem carga)'),
      'na v1 a linha saía do campo `modulo`, que não existe mais',
    );
  });

  it('sem lacuna, a seção não aparece', () => {
    assert.equal(montarPrompt(pacoteAgosto()).usuario.includes('### Lacunas'), false);
  });
});
