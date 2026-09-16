import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ABREVIACOES_DA_CHAMADA, chamadaDoTexto } from './chamada';
import { terminaFrase } from '../format/frase';
import type { CadernoImpresso, Edicao } from '../data/edicoes-ia';
import type { CadernoId } from '../period/cadernos';

/**
 * A chamada de um caderno (story 1.8): a matriz congelada, cada borda das Design
 * Notes, e a propriedade sobre uma bateria sintética semeada — nos dois sentidos,
 * e idempotente.
 *
 * Todo número aqui é sintético, fora os da matriz que o dono aprovou.
 */

/**
 * A lista fechada, escrita aqui de novo e comparada **item a item** com a do
 * código (`ABREVIACOES_DA_CHAMADA`). É o gatilho mecânico do Ask First congelado:
 * pôr na lista do código uma abreviação que pode terminar frase (`min.`, `km.`)
 * sem mexer nesta deixa o teste vermelho. A mesma lista alimenta o oráculo da
 * propriedade, que diz quais cortes a chamada tem licença de pular.
 */
const ABREVIACOES_DO_TESTE = ['aprox.', 'p.ex.', 'p. ex.', 'vs.', 'i.e.', 'cf.', 'p.p.'];

/* ── a matriz congelada ── */

describe('chamadaDoTexto — a matriz de I/O', () => {
  const MATRIZ: readonly (readonly [string, string | null | undefined, string | null])[] = [
    ['frase simples', 'O sono caiu. Depois subiu.', 'O sono caiu.'],
    ['milhar com ponto', '1.210 fotos em 2026. Mais \u2026', '1.210 fotos em 2026.'],
    ['decimal com vírgula', 'Dormiu 7,2 h em média. \u2026', 'Dormiu 7,2 h em média.'],
    ['abreviação que precede', 'Foram aprox. 40 min a menos. \u2026', 'Foram aprox. 40 min a menos.'],
    ['abreviação com ponto interno', 'Houve p.ex. 3 noites curtas. \u2026', 'Houve p.ex. 3 noites curtas.'],
    ['reticências', 'Dormiu pouco... e acordou.', 'Dormiu pouco...'],
    ['interrogação', 'Foi a menor? Sim.', 'Foi a menor?'],
    ['exclamação', 'Foi a menor! Sim.', 'Foi a menor!'],
    ['sem terminador', 'O sono foi estável', 'O sono foi estável'],
    ['quebra de parágrafo antes do ponto', 'Sono estável\nDepois \u2026', 'Sono estável'],
    ['espaço à frente', '  \n O sono caiu. \u2026', 'O sono caiu.'],
    ['texto vazio', '', null],
    ['só espaço', '   ', null],
    ['sem caderno: null', null, null],
    ['sem caderno: undefined', undefined, null],
  ];
  for (const [nome, entrada, saida] of MATRIZ) {
    it(`${nome}: ${JSON.stringify(entrada)} → ${JSON.stringify(saida)}`, () => {
      assert.equal(chamadaDoTexto(entrada), saida);
    });
  }

  it('numa edição impressa, o caderno sem linha (sendo escrito, reprovado, não impresso) dá null, e o com linha dá a chamada', () => {
    const impresso = (caderno: CadernoId, posicao: number, texto: string): CadernoImpresso => ({
      tipoPeriodo: 'month',
      inicio: '2031-03-01',
      fim: '2031-03-31',
      caderno,
      posicao,
      texto,
      provedor: 'sintetico',
      modelo: 'sintetico',
      promptVersao: 1,
      pacoteVersao: 3,
      aggVersionNoMomento: 1,
      metricaLider: null,
      geradoEm: '2031-04-01T08:00:00Z',
    });
    const edicao: Edicao = [
      impresso('movimento', 1, 'Foram 57 km em 9 saídas. Depois veio a chuva.'),
      impresso('rotina', 2, '1. Tarefas em dia na semana 3.\n2. O resto ficou.'),
    ];
    const chamada = (id: CadernoId) => chamadaDoTexto(edicao.find((c) => c.caderno === id)?.texto);
    assert.equal(chamada('movimento'), 'Foram 57 km em 9 saídas.');
    assert.equal(chamada('rotina'), 'Tarefas em dia na semana 3.');
    // Os três estados sem texto colapsam na ausência da linha — e dão null, não ''.
    assert.equal(chamada('sono'), null);
    assert.equal(chamada('coracao'), null);
    const naoImpressa: Edicao = [];
    assert.equal(chamadaDoTexto(naoImpressa.find((c) => c.caderno === 'movimento')?.texto), null);
  });
});

/* ── as abreviações ── */

describe('as abreviações da lista não cortam', () => {
  it('a lista do código é exatamente esta — mudá-la é pergunta ao dono (Ask First)', () => {
    assert.deepEqual([...ABREVIACOES_DA_CHAMADA], ABREVIACOES_DO_TESTE);
    assert.ok(Object.isFrozen(ABREVIACOES_DA_CHAMADA), 'a lista do código pode ser alterada em tempo de execução');
  });

  for (const a of ABREVIACOES_DO_TESTE) {
    it(`"${a}" no meio da frase`, () => {
      assert.equal(chamadaDoTexto(`Houve ${a} 3 noites curtas. Depois veio outra.`), `Houve ${a} 3 noites curtas.`);
    });
    it(`"${a}" em maiúsculas — a casa da letra não decide`, () => {
      const A = a.toUpperCase();
      assert.equal(chamadaDoTexto(`Houve ${A} 3 noites curtas. Depois.`), `Houve ${A} 3 noites curtas.`);
    });
  }

  it('"p.p." é casada inteira: não corta nem dentro dela', () => {
    assert.equal(
      chamadaDoTexto('A nota subiu 3 p.p. em relação a julho. Depois.'),
      'A nota subiu 3 p.p. em relação a julho.',
    );
  });

  it('"vs." leva a base junto com o número', () => {
    assert.equal(chamadaDoTexto('Foram 4,1 h vs. 3,6 h no mês. Depois.'), 'Foram 4,1 h vs. 3,6 h no mês.');
  });

  it('o espaço de "p. ex." é qualquer espaço que não seja corte da regra', () => {
    assert.equal(chamadaDoTexto('Houve p.  ex. 3 noites. Depois.'), 'Houve p.  ex. 3 noites.');
    assert.equal(chamadaDoTexto('Houve p.\u00A0ex. 3 noites. Depois.'), 'Houve p.\u00A0ex. 3 noites.');
    // O separador de linha Unicode não é corte de terminaFrase — então é espaço.
    assert.equal(terminaFrase('p.\u2028ex.', 2), false);
    assert.equal(chamadaDoTexto('Houve p.\u2028ex. 3 noites. Depois.'), 'Houve p.\u2028ex. 3 noites.');
    // A quebra de linha é corte: a abreviação não a atravessa, e a chamada corta onde a conferência corta.
    assert.equal(chamadaDoTexto('Houve p.\nex. 3 noites. Depois.'), 'Houve p.');
  });

  it('entre as partes de "p.p." e "i.e." cabe o mesmo espaço — o número não chega à capa sem a base', () => {
    assert.equal(
      chamadaDoTexto('Subiu 3 p. p. em relação a julho. Depois.'),
      'Subiu 3 p. p. em relação a julho.',
    );
    assert.equal(chamadaDoTexto('Foi assim, i. e. 3 noites curtas. Depois.'), 'Foi assim, i. e. 3 noites curtas.');
    assert.equal(chamadaDoTexto('Subiu 3 p.\u00A0p. no mês. Depois.'), 'Subiu 3 p.\u00A0p. no mês.');
    // E a quebra de linha continua sendo corte.
    assert.equal(chamadaDoTexto('Subiu 3 p.\np. no mês. Depois.'), 'Subiu 3 p.');
  });

  it('o espaço de dentro é o da borda: inclui largura zero', () => {
    assert.equal(chamadaDoTexto('Houve p.\u200Bex. 3 noites. Depois.'), 'Houve p.\u200Bex. 3 noites.');
    assert.equal(chamadaDoTexto('Houve p. \uFEFFex. 3 noites. Depois.'), 'Houve p. \uFEFFex. 3 noites.');
    assert.equal(chamadaDoTexto('Subiu 3 p.\u2060p. no mês. Depois.'), 'Subiu 3 p.\u2060p. no mês.');
    assert.equal(chamadaDoTexto('Foi, i.\u200Ce. 3 noites. Depois.'), 'Foi, i.\u200Ce. 3 noites.');
    assert.equal(chamadaDoTexto('Foi, i.\u200De. 3 noites. Depois.'), 'Foi, i.\u200De. 3 noites.');
  });

  it('a palavra começa em fronteira: letra, dígito ou marca combinante logo antes não vale', () => {
    assert.equal(chamadaDoTexto('Foi xaprox. Depois veio.'), 'Foi xaprox.');
    assert.equal(chamadaDoTexto('Foi 3vs. Depois veio.'), 'Foi 3vs.');
    assert.equal(chamadaDoTexto('Foi e\u0301vs. Depois veio.'), 'Foi e\u0301vs.');
    // Uma letra fora do plano básico ocupa duas unidades; a de baixo, sozinha, não é letra.
    assert.equal(chamadaDoTexto('Foi \u{1D49C}vs. Depois veio.'), 'Foi \u{1D49C}vs.');
    // Pontuação e começo de texto são fronteira.
    assert.equal(chamadaDoTexto('Foi (vs. 4 noites). Depois.'), 'Foi (vs. 4 noites).');
    assert.equal(chamadaDoTexto('Cf. a noite anterior. Depois.'), 'Cf. a noite anterior.');
  });

  it('abreviação que termina frase junta a seguinte — a direção segura', () => {
    assert.equal(
      chamadaDoTexto('Foram 40 min a menos, aprox. Depois veio a queda.'),
      'Foram 40 min a menos, aprox. Depois veio a queda.',
    );
  });

  it('abreviação no fim do texto não engole nada: a chamada é o texto', () => {
    assert.equal(chamadaDoTexto('Foram 40 min a menos, aprox.'), 'Foram 40 min a menos, aprox.');
    assert.equal(chamadaDoTexto('Foram 40 min a menos, aprox.  \n'), 'Foram 40 min a menos, aprox.');
  });

  it('as que terminam frase mais do que precedem cortam: etc., máx., mín., min., km. e os tratamentos', () => {
    assert.equal(chamadaDoTexto('Foram 3 noites, etc. Depois veio.'), 'Foram 3 noites, etc.');
    assert.equal(chamadaDoTexto('Chegou a 9 h, máx. Depois veio.'), 'Chegou a 9 h, máx.');
    assert.equal(chamadaDoTexto('Ficou em 5 h, mín. Depois veio.'), 'Ficou em 5 h, mín.');
    assert.equal(chamadaDoTexto('Foram 40 min. Depois veio.'), 'Foram 40 min.');
    assert.equal(chamadaDoTexto('Foram 12 km. Depois veio.'), 'Foram 12 km.');
    for (const t of ['Sr.', 'Sra.', 'Dr.', 'Dra.']) {
      assert.equal(chamadaDoTexto(`Consulta com a ${t} Depois o sono caiu.`), `Consulta com a ${t}`);
    }
  });
});

/* ── ponto colado a letra ── */

describe('ponto colado a letra não termina frase', () => {
  it('"intervals.icu" é uma frase só', () => {
    assert.equal(
      chamadaDoTexto('Dados do intervals.icu mostram queda. Depois.'),
      'Dados do intervals.icu mostram queda.',
    );
  });

  it('"1.º" também', () => {
    assert.equal(chamadaDoTexto('Foi o 1.º lugar do ano. Depois.'), 'Foi o 1.º lugar do ano.');
  });

  it('a letra fora do plano básico conta como letra', () => {
    assert.equal(chamadaDoTexto('Foi a.\u{1D49C} de novo. Depois.'), 'Foi a.\u{1D49C} de novo.');
  });

  it('só o ponto: interrogação e exclamação coladas a letra cortam', () => {
    assert.equal(chamadaDoTexto('Foi?Sim. Depois.'), 'Foi?');
    assert.equal(chamadaDoTexto('Foi!Sim. Depois.'), 'Foi!');
  });

  it('ponto seguido de dígito não é colado a letra: corta', () => {
    assert.equal(chamadaDoTexto('Foi a versão v.2 do plano. Depois.'), 'Foi a versão v.');
  });
});

/* ── onde a chamada começa ── */

describe('marcador de lista e fragmento sem letra não são frase', () => {
  const MARCADORES = [
    '1. ', '12. ', '123. ', '1) ', '42) ', 'a. ', 'B) ', 'z) ', 'II. ', 'VI. ', 'XVI. ', 'XXXIX. ', 'IV) ',
    'iv) ', 'viii) ', 'xii) ', '- ', '\u2022 ', '\u2013 ', '\u2014 ', '1.\n', '- \n ',
  ];
  for (const m of MARCADORES) {
    it(`o marcador ${JSON.stringify(m)} sai`, () => {
      assert.equal(chamadaDoTexto(`${m}O sono caiu. Depois.`), 'O sono caiu.');
    });
  }

  it('os marcadores seguidos saem todos — "1. a." não deixa "a." na capa', () => {
    assert.equal(chamadaDoTexto('1. a. O sono caiu.'), 'O sono caiu.');
    assert.equal(chamadaDoTexto('II. b) - O sono caiu. Depois.'), 'O sono caiu.');
    assert.equal(chamadaDoTexto('\u2022 3) iv) O sono caiu. Depois.'), 'O sono caiu.');
  });

  it('não é marcador sem o espaço depois — é o que protege o milhar', () => {
    assert.equal(chamadaDoTexto('1.210 fotos em 2026. Depois.'), '1.210 fotos em 2026.');
    assert.equal(chamadaDoTexto('-O sono caiu. Depois.'), '-O sono caiu.');
    assert.equal(chamadaDoTexto('a)O sono caiu. Depois.'), 'a)O sono caiu.');
  });

  it('não é marcador: quatro dígitos, duas letras que não são romano, romano acima de 39', () => {
    assert.equal(chamadaDoTexto('1234) O sono caiu. Depois.'), '1234) O sono caiu.');
    assert.equal(chamadaDoTexto('ab. O sono caiu. Depois.'), 'ab.');
    assert.equal(chamadaDoTexto('Ok. O sono caiu.'), 'Ok.');
    assert.equal(chamadaDoTexto('XL. O sono caiu. Depois.'), 'XL.');
    assert.equal(chamadaDoTexto('a: O sono caiu. Depois.'), 'a: O sono caiu.');
  });

  it('não é marcador: a letra que não é ASCII — "É." é frase', () => {
    assert.equal(chamadaDoTexto('É. O sono caiu.'), 'É.');
    assert.equal(chamadaDoTexto('\u00E9) O sono caiu.'), '\u00E9) O sono caiu.');
  });

  it('não é marcador: o romano em caixa mista, nem o minúsculo com ponto — "Vi." e "vi." são frase', () => {
    assert.equal(chamadaDoTexto('Vi. Depois caiu.'), 'Vi.');
    assert.equal(chamadaDoTexto('vi. Depois caiu.'), 'vi.');
    assert.equal(chamadaDoTexto('iv. Depois caiu.'), 'iv.');
    assert.equal(chamadaDoTexto('Iv) Depois caiu.'), 'Iv) Depois caiu.');
  });

  it('o marcador só sai no começo', () => {
    assert.equal(chamadaDoTexto('Houve a) três noites curtas. Depois.'), 'Houve a) três noites curtas.');
  });

  it('abreviação no começo não é marcador: "P. ex." e "I. e." ficam', () => {
    assert.equal(chamadaDoTexto('P. ex. 3 noites curtas. Depois.'), 'P. ex. 3 noites curtas.');
    assert.equal(chamadaDoTexto('I. e. 3 noites curtas. Depois.'), 'I. e. 3 noites curtas.');
  });

  it('trecho sem letra até o corte é pulado, e a busca continua', () => {
    assert.equal(chamadaDoTexto('... e o sono caiu 40 min.'), 'e o sono caiu 40 min.');
    assert.equal(chamadaDoTexto('2026. O sono caiu. Depois.'), 'O sono caiu.');
    assert.equal(chamadaDoTexto('?! O sono caiu. Depois.'), 'O sono caiu.');
    assert.equal(chamadaDoTexto('12,5 \u2014 3!\nDepois veio. Fim.'), 'Depois veio.');
    assert.equal(chamadaDoTexto('1. ... O sono caiu. Depois.'), 'O sono caiu.');
    // Depois de pular, um marcador no novo começo sai também.
    assert.equal(chamadaDoTexto('...\na. O sono caiu. Depois.'), 'O sono caiu.');
  });

  it('texto sem letra é null', () => {
    assert.equal(chamadaDoTexto('... 40. 12?'), null);
    assert.equal(chamadaDoTexto('1. 2. 3.'), null);
    assert.equal(chamadaDoTexto('\u200B\uFEFF'), null);
    assert.equal(chamadaDoTexto('\u2014 7,5!'), null);
  });

  it('texto sem conteúdo é null: a letra de um marcador não conta', () => {
    assert.equal(chamadaDoTexto('a) 40'), null);
    assert.equal(chamadaDoTexto('a) '), null);
    assert.equal(chamadaDoTexto('a. 2. 3.'), null);
    assert.equal(chamadaDoTexto('II. ... 7,5!'), null);
    // Sem o espaço, "a)" não é marcador: é o conteúdo, e é a chamada.
    assert.equal(chamadaDoTexto('a)'), 'a)');
  });

  it('espaço de largura zero e BOM à frente saem junto com o espaço comum', () => {
    assert.equal(chamadaDoTexto('\u200B\uFEFF O sono caiu. Depois.'), 'O sono caiu.');
    assert.equal(chamadaDoTexto('\u2060\u200C\u200DO sono caiu. Depois.'), 'O sono caiu.');
    assert.equal(chamadaDoTexto('O sono caiu\u200B\nDepois.'), 'O sono caiu');
  });
});

/* ── o que entra junto do corte ── */

describe('terminadores e fechamentos colados entram inteiros', () => {
  const FECHAMENTOS = ['"', "'", '\u201D', '\u2019', '\u00BB', '\u203A', ')', ']'];
  for (const f of FECHAMENTOS) {
    it(`o fechamento ${JSON.stringify(f)} logo depois do terminador entra`, () => {
      assert.equal(chamadaDoTexto(`Foi assim.${f} Depois veio.`), `Foi assim.${f}`);
      assert.equal(chamadaDoTexto(`Foi assim?${f}\nDepois veio.`), `Foi assim?${f}`);
    });
  }

  it('a sequência de terminadores colados entra: "?!", "...!"', () => {
    assert.equal(chamadaDoTexto('Sério?! Sim.'), 'Sério?!');
    assert.equal(chamadaDoTexto('Foi...! Sim.'), 'Foi...!');
  });

  it('vários fechamentos seguidos entram', () => {
    assert.equal(chamadaDoTexto('Ele disse (\u201Cbasta?!\u201D) Depois.'), 'Ele disse (\u201Cbasta?!\u201D)');
  });

  it('só entra o que está colado: espaço separa', () => {
    assert.equal(chamadaDoTexto('Foi assim. " Depois.'), 'Foi assim.');
  });

  it('a quebra de linha corta e fica de fora; no Windows, o \\r não entra', () => {
    assert.equal(chamadaDoTexto('O sono caiu\r\nDepois subiu.'), 'O sono caiu');
    assert.equal(chamadaDoTexto('O sono caiu.\r\nDepois subiu.'), 'O sono caiu.');
  });

  it('a reticência de um caractere não corta — limite conhecido, junta as frases', () => {
    assert.equal(chamadaDoTexto('Dormiu pouco\u2026 E acordou. Fim.'), 'Dormiu pouco\u2026 E acordou.');
  });
});

/* ── a propriedade, sobre uma bateria semeada ── */

/** PRNG pequeno e determinístico (mulberry32): a bateria é a mesma em toda rodada. */
function semente(s: number): () => number {
  let a = s >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const ESPACO = /[\s\u200B\u200C\u200D\u2060\uFEFF]/;
const CLASSE_DE_ESPACO = '[\\s\u200B\u200C\u200D\u2060\uFEFF]';
const LETRA = /\p{L}/u;

/** O caractere logo antes de `k`, lido inteiro — o par substituto não se parte. */
function caractereAntes(texto: string, k: number): string {
  if (k === 0) return '';
  const baixo = texto.charCodeAt(k - 1);
  if (baixo >= 0xdc00 && baixo <= 0xdfff && k >= 2) return String.fromCodePoint(texto.codePointAt(k - 2)!);
  return texto[k - 1];
}

/**
 * O padrão de uma abreviação da lista do teste: o espaço literal de "p. ex." é
 * um ou mais; depois de um ponto de dentro, zero ou mais.
 */
function padraoDaAbreviacao(a: string): RegExp {
  let fonte = '';
  for (let p = 0; p < a.length; p += 1) {
    const c = a[p];
    if (c === ' ') fonte += `${CLASSE_DE_ESPACO}+`;
    else if (c === '.') fonte += p < a.length - 1 && a[p + 1] !== ' ' ? `\\.${CLASSE_DE_ESPACO}*` : '\\.';
    else fonte += c;
  }
  return new RegExp(fonte, 'iy');
}
const PADROES_DO_TESTE = ABREVIACOES_DO_TESTE.map(padraoDaAbreviacao);

/** Os pontos de abreviação da lista num texto, casados em fronteira e sem corte da regra no espaço de dentro. */
function pontosDeAbreviacaoDoTeste(texto: string): ReadonlySet<number> {
  const pontos = new Set<number>();
  for (let k = 0; k < texto.length; k += 1) {
    if (/[\p{L}\p{N}\p{M}]/u.test(caractereAntes(texto, k))) continue;
    for (const padrao of PADROES_DO_TESTE) {
      padrao.lastIndex = k;
      const m = padrao.exec(texto);
      if (!m) continue;
      const fim = k + m[0].length;
      const cortado = Array.from({ length: fim - k }, (_, j) => k + j).some(
        (j) => ESPACO.test(texto[j]) && terminaFrase(texto, j),
      );
      if (cortado) continue;
      for (let j = k; j < fim; j += 1) if (texto[j] === '.') pontos.add(j);
    }
  }
  return pontos;
}

function pontoColadoALetra(texto: string, i: number): boolean {
  const cp = texto.codePointAt(i + 1);
  return texto[i] === '.' && cp !== undefined && LETRA.test(String.fromCodePoint(cp));
}

const FECHA = '"\'\u201D\u2019\u00BB\u203A)]';

/**
 * Onde a chamada que ocupa `[inicio, fim)` cortou — ou `null`, se ela parou num
 * lugar que não é corte da regra (**cortou antes da conferência**).
 *
 * Ou ela termina numa sequência de terminadores (e fechamentos) que contém um
 * corte, e o corte é o primeiro dessa sequência; ou o que vem depois dela é só
 * espaço até um corte da regra (a quebra de linha) ou até o fim do texto.
 */
function corteDaChamada(texto: string, inicio: number, fim: number): number | null {
  let k = fim;
  while (k > inicio && FECHA.includes(texto[k - 1])) k -= 1;
  let sequencia = k;
  while (sequencia > inicio && '.!?'.includes(texto[sequencia - 1])) sequencia -= 1;
  for (let i = sequencia; i < k; i += 1) if (terminaFrase(texto, i)) return i;
  for (let i = fim; i <= texto.length; i += 1) {
    if (i === texto.length || terminaFrase(texto, i)) return fim;
    if (!ESPACO.test(texto[i])) return null;
  }
  return null;
}

type Prefixo = { texto: string; tipo: 'nada' | 'espaco' | 'invisivel' | 'marcador' | 'marcadores' | 'sem-letra' };

const PREFIXOS: readonly Prefixo[] = [
  { texto: '', tipo: 'nada' },
  { texto: '  ', tipo: 'espaco' },
  { texto: '\n ', tipo: 'espaco' },
  { texto: '\u200B', tipo: 'invisivel' },
  { texto: '\uFEFF ', tipo: 'invisivel' },
  { texto: '1. ', tipo: 'marcador' },
  { texto: '12) ', tipo: 'marcador' },
  { texto: 'a. ', tipo: 'marcador' },
  { texto: 'II. ', tipo: 'marcador' },
  { texto: 'XVI) ', tipo: 'marcador' },
  { texto: 'viii) ', tipo: 'marcador' },
  { texto: '- ', tipo: 'marcador' },
  { texto: '\u2022 ', tipo: 'marcador' },
  { texto: '\u2014 ', tipo: 'marcador' },
  { texto: '1. a. ', tipo: 'marcadores' },
  { texto: 'VI. b) - ', tipo: 'marcadores' },
  { texto: '... ', tipo: 'sem-letra' },
  { texto: '?! ', tipo: 'sem-letra' },
  { texto: '2031. ', tipo: 'sem-letra' },
  { texto: '1. ... ', tipo: 'sem-letra' },
];

const INICIAIS = ['Sono', 'Foram', 'Dados', 'Houve', 'Nada', 'Treino', 'Semana'];
const PALAVRAS = ['sono', 'noite', 'rota', 'treino', 'semana', 'dia', 'ritmo', 'volta', 'menos', 'mais'];
const NUMEROS = ['3', '12', '4,5', '9.876', '1.023', '0,8', '31'];
const ABREVIACOES_NA_LISTA = [
  'aprox.', 'Aprox.', 'p.ex.', 'p. ex.', 'P. Ex.', 'p.  ex.', 'p.\u2028ex.', 'p.\nex.', 'p.\u200Bex.',
  'vs.', 'VS.', 'i.e.', 'i. e.', 'I.\uFEFFE.', 'cf.', 'Cf.', 'p.p.', 'p. p.', 'P.\u2060P.', 'p.\np.',
];
const ABREVIACOES_FORA = ['etc.', 'máx.', 'mín.', 'Dra.', 'Sr.', 'min.', 'km.', '\u{1D49C}vs.'];
const COLADOS = ['intervals.icu', '1.º', 'x.y', 'fim.Depois'];
const TERMINADORES = ['.', '.', '.', '!', '?', '...', '?!', '!?', '\u2026'];
const FECHAMENTOS = ['', '', '', '', '"', "'", '\u201D', '\u2019', '\u00BB', '\u203A', ')', ']', '")'];
const SEPARADORES = [' ', ' ', ' ', '\n', '\r\n', '\u2028', '  ', '\u00A0', '\n\n'];
const SEM_LETRA = ['', '   ', '... 40. 12?', '1. 2. 3.', '\u200B', '\u2014 7,5!', '?!\n9.876'];
/** Letra só dentro de marcador: não é conteúdo. */
const SO_MARCADOR = ['a) 40', 'a. 2. 3.', 'II. ... 7,5!', 'b) ', '1. a) - 12?', 'XVI. \u2014 9.876'];

function escolher<T>(r: () => number, xs: readonly T[]): T {
  return xs[Math.floor(r() * xs.length)];
}

function frase(r: () => number, inicial: boolean): string {
  const tokens = [inicial ? escolher(r, INICIAIS) : escolher(r, PALAVRAS)];
  const n = 1 + Math.floor(r() * 6);
  for (let i = 0; i < n; i += 1) {
    const x = r();
    if (x < 0.4) tokens.push(escolher(r, PALAVRAS));
    else if (x < 0.6) tokens.push(escolher(r, NUMEROS));
    else if (x < 0.78) tokens.push(escolher(r, ABREVIACOES_NA_LISTA));
    else if (x < 0.88) tokens.push(escolher(r, ABREVIACOES_FORA));
    else tokens.push(escolher(r, COLADOS));
  }
  return tokens.join(' ');
}

interface Caso {
  texto: string;
  /** Onde a chamada tem de começar, ou `null` se o texto não tem conteúdo. */
  inicio: number | null;
  prefixo: Prefixo['tipo'] | null;
}

function bateria(quantos: number): Caso[] {
  const r = semente(0x1_08);
  const casos: Caso[] = [];
  for (let c = 0; c < quantos; c += 1) {
    if (r() < 0.06) {
      const partes = [escolher(r, SEM_LETRA), escolher(r, r() < 0.5 ? SEM_LETRA : SO_MARCADOR)];
      // O marcador só é marcador no começo: o que tem letra vai na frente.
      partes.sort((a, b) => Number(LETRA.test(b)) - Number(LETRA.test(a)));
      casos.push({ texto: partes.join(escolher(r, SEPARADORES)), inicio: null, prefixo: null });
      continue;
    }
    const p = escolher(r, PREFIXOS);
    const frases = 1 + Math.floor(r() * 3);
    let corpo = '';
    for (let f = 0; f < frases; f += 1) {
      corpo += frase(r, f === 0);
      const ultima = f === frases - 1;
      if (!ultima || r() < 0.7) corpo += escolher(r, TERMINADORES) + escolher(r, FECHAMENTOS);
      if (!ultima) corpo += escolher(r, SEPARADORES);
      else if (r() < 0.2) corpo += escolher(r, [' ', '\n', ' \u200B', '\r\n']);
    }
    casos.push({ texto: p.texto + corpo, inicio: p.texto.length, prefixo: p.tipo });
  }
  return casos;
}

describe('a propriedade — sobre 5.555 textos sintéticos semeados', () => {
  const casos = bateria(5555);
  const caminhos = {
    nulo: 0,
    nuloComLetraDeMarcador: 0,
    abreviacaoPulada: 0,
    abreviacaoComEspacoDeDentro: 0,
    abreviacaoComSeparadorUnicode: 0,
    coladoPulado: 0,
    cortouEmAbreviacaoDeFora: 0,
    cortouNaQuebra: 0,
    chegouAoFim: 0,
    terminadoresColados: 0,
    fechamentos: new Set<string>(),
    prefixos: new Set<string>(),
  };

  it('nos dois sentidos: nunca corta antes de terminaFrase, e todo corte pulado é abreviação da lista ou ponto colado a letra', () => {
    for (const { texto, inicio, prefixo } of casos) {
      const chamada = chamadaDoTexto(texto);
      const rotulo = JSON.stringify(texto);

      if (inicio === null) {
        assert.equal(chamada, null, `texto sem conteúdo deu chamada: ${rotulo}`);
        caminhos.nulo += 1;
        if (LETRA.test(texto)) caminhos.nuloComLetraDeMarcador += 1;
        continue;
      }
      assert.ok(chamada !== null && chamada !== '', `texto com conteúdo sem chamada: ${rotulo}`);
      assert.ok(texto.startsWith(chamada, inicio), `a chamada ${JSON.stringify(chamada)} não começa em ${inicio}: ${rotulo}`);
      assert.ok(!ESPACO.test(chamada[0]) && !ESPACO.test(chamada[chamada.length - 1]), `espaço na ponta: ${rotulo}`);
      caminhos.prefixos.add(prefixo!);

      const fim = inicio + chamada.length;
      const corte = corteDaChamada(texto, inicio, fim);
      // Sentido 1: ela nunca para onde a regra não corta.
      assert.notEqual(corte, null, `a chamada ${JSON.stringify(chamada)} cortou antes de terminaFrase: ${rotulo}`);

      // Sentido 2: todo corte que ela atravessou tem licença.
      const abreviacoes = pontosDeAbreviacaoDoTeste(texto);
      for (let i = inicio; i < corte!; i += 1) {
        if (!terminaFrase(texto, i)) continue;
        const abreviacao = texto[i] === '.' && abreviacoes.has(i);
        const colado = pontoColadoALetra(texto, i);
        assert.ok(
          abreviacao || colado,
          `a chamada ${JSON.stringify(chamada)} pulou o corte em ${i} (${JSON.stringify(texto[i])}), que não é abreviação da lista nem ponto colado a letra: ${rotulo}`,
        );
        if (abreviacao) {
          caminhos.abreviacaoPulada += 1;
          const volta = texto.slice(Math.max(0, i - 3), i + 4);
          if (volta.includes('\u2028')) caminhos.abreviacaoComSeparadorUnicode += 1;
          if (ESPACO.test(texto[i + 1] ?? '') && !colado && /[pie]/i.test(texto[i - 1] ?? '')) caminhos.abreviacaoComEspacoDeDentro += 1;
        } else caminhos.coladoPulado += 1;
      }

      if (corte! < fim) {
        if (fim - corte! > 1 && '.!?'.includes(texto[corte! + 1])) caminhos.terminadoresColados += 1;
        if (FECHA.includes(chamada[chamada.length - 1])) caminhos.fechamentos.add(chamada[chamada.length - 1]);
        if (/(?:etc|máx|mín|Dra|Sr|min|km|vs)$/.test(texto.slice(inicio, corte!))) caminhos.cortouEmAbreviacaoDeFora += 1;
      } else if (texto.slice(fim).trim() === '' && !/\n/.test(texto.slice(fim))) {
        caminhos.chegouAoFim += 1;
      } else {
        caminhos.cortouNaQuebra += 1;
      }
    }
  });

  it('idempotente: se a chamada existe, a chamada dela é ela mesma', () => {
    let conferidas = 0;
    for (const { texto } of casos) {
      const chamada = chamadaDoTexto(texto);
      if (chamada === null) continue;
      assert.equal(chamadaDoTexto(chamada), chamada, `a chamada de ${JSON.stringify(chamada)} mudou — veio de ${JSON.stringify(texto)}`);
      conferidas += 1;
    }
    assert.ok(conferidas > 5000, `só ${conferidas} chamadas conferidas`);
    // Os casos que quebravam antes: a letra do marcador não pode virar chamada que some na segunda leitura.
    for (const t of ['a) 40', 'a. 2. 3.', '1. a. O sono caiu.', 'Vi. Depois caiu.', 'P. ex. 3 noites. Depois.']) {
      const c = chamadaDoTexto(t);
      if (c !== null) assert.equal(chamadaDoTexto(c), c, JSON.stringify(t));
    }
  });

  it('e a bateria passa por cada caminho — sem isto a propriedade podia ficar verde sem exercitar nada', () => {
    assert.equal(casos.length, 5555);
    assert.ok(caminhos.nulo > 50, `nulos: ${caminhos.nulo}`);
    assert.ok(caminhos.nuloComLetraDeMarcador > 20, `nulos só com letra de marcador: ${caminhos.nuloComLetraDeMarcador}`);
    assert.ok(caminhos.abreviacaoPulada > 500, `abreviações puladas: ${caminhos.abreviacaoPulada}`);
    assert.ok(caminhos.abreviacaoComEspacoDeDentro > 100, `abreviações com espaço de dentro: ${caminhos.abreviacaoComEspacoDeDentro}`);
    assert.ok(caminhos.abreviacaoComSeparadorUnicode > 10, `"p. ex." com U+2028: ${caminhos.abreviacaoComSeparadorUnicode}`);
    assert.ok(caminhos.coladoPulado > 200, `pontos colados pulados: ${caminhos.coladoPulado}`);
    assert.ok(caminhos.cortouEmAbreviacaoDeFora > 100, `cortes em abreviação de fora: ${caminhos.cortouEmAbreviacaoDeFora}`);
    assert.ok(caminhos.cortouNaQuebra > 100, `cortes na quebra de linha: ${caminhos.cortouNaQuebra}`);
    assert.ok(caminhos.chegouAoFim > 100, `chamadas até o fim do texto: ${caminhos.chegouAoFim}`);
    assert.ok(caminhos.terminadoresColados > 100, `terminadores colados: ${caminhos.terminadoresColados}`);
    assert.deepEqual([...caminhos.fechamentos].sort(), [...FECHA].sort(), 'algum fechamento não apareceu no fim de uma chamada');
    assert.deepEqual(
      [...caminhos.prefixos].sort(),
      ['espaco', 'invisivel', 'marcador', 'marcadores', 'nada', 'sem-letra'],
      'algum tipo de começo não foi exercitado',
    );
  });
});

/* ── o barril ── */

describe('o barril', () => {
  it('chamadaDoTexto sai pelo index.ts, e terminaFrase e a lista de abreviações não', async () => {
    const barril: Record<string, unknown> = await import('../index');
    assert.equal(barril.chamadaDoTexto, chamadaDoTexto);
    assert.equal('terminaFrase' in barril, false, 'a regra de fim de frase saiu pelo barril');
    assert.equal('ABREVIACOES_DA_CHAMADA' in barril, false, 'a lista de abreviações saiu pelo barril');
    // A prova de que o import leu o barril de verdade, e não um módulo vazio.
    assert.ok('verificarTexto' in barril && 'montarPacotes' in barril);
  });

  it('nenhum valor do barril é a regra, com nome nenhum — um `export *` que a renomeie também reprova', async () => {
    const barril: Record<string, unknown> = await import('../index');
    const valores = Object.values(barril);
    // Controle positivo: a comparação por identidade acha o que está lá.
    assert.ok(valores.some((v) => v === chamadaDoTexto));
    const comOutroNome = Object.entries(barril).filter(([, v]) => v === terminaFrase).map(([nome]) => nome);
    assert.deepEqual(comOutroNome, [], `terminaFrase sai pelo barril como ${comOutroNome.join(', ')}`);
    const listas = Object.entries(barril).filter(([, v]) => v === ABREVIACOES_DA_CHAMADA).map(([nome]) => nome);
    assert.deepEqual(listas, [], `a lista de abreviações sai pelo barril como ${listas.join(', ')}`);
  });
});
