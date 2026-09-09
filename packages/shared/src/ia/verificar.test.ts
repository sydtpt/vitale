import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { FatoNumero, PacoteDeFatos } from './pacote';
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
