import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  TAMANHO_MAXIMO_DA_FRASE, conferirInterpolado, interpolar, limparResposta, marcador, marcadoresEm,
  type RegraInterpolada,
} from './interpolar';
import { VOCABULARIO_PROIBIDO, type SubconjuntoProibido } from './verificar';

/**
 * O regime interpolado (AD-6, ADR 0049): a sintaxe do marcador, a troca, e a
 * conferência que exige presença. Genérico — os itens aqui são de mentira de
 * propósito: `ia/interpolar.ts` não sabe o que é sono, e o teste também não.
 */

const TODOS = Object.keys(VOCABULARIO_PROIBIDO) as SubconjuntoProibido[];

/**
 * Três itens nomeáveis; o caso exige `alfa`, deixa citar `beta`, e `gama` é a
 * mais. `alfa` declara as formas (o plural conta); `gama` não (só o rótulo).
 */
const REGRA: RegraInterpolada = {
  valores: { alfa: '7h20', beta: '± 22 min', medidas: 'quatro' },
  itens: [
    { chave: 'alfa', rotulo: 'duração', formas: ['duração', 'durações'] },
    { chave: 'beta', rotulo: 'horário' },
    { chave: 'gama', rotulo: 'percepção' },
  ],
  citaveis: ['beta'],
  exigidos: [{ item: 'alfa' }],
  vocabulario: TODOS,
};

const regras = (c: ReturnType<typeof conferirInterpolado>) => (c.ok ? [] : c.problemas.map((p) => p.regra));
const detalhes = (c: ReturnType<typeof conferirInterpolado>) => (c.ok ? [] : c.problemas.map((p) => p.detalhe));

/** Um caractere pelo código — o fonte não carrega invisível nenhum. */
const cp = (n: number) => String.fromCodePoint(n);

describe('a sintaxe do marcador', () => {
  it('é {nome}, com o nome em [a-z]+', () => {
    assert.equal(marcador('regularidade'), '{regularidade}');
    for (const ruim of ['', 'Regularidade', 'duração', 'dois1', 'a b', 'a-b', '{x}']) {
      assert.throws(() => marcador(ruim), TypeError, ruim);
    }
  });

  it('marcadoresEm acha os bem formados, sem repetição, na ordem', () => {
    assert.deepEqual(marcadoresEm('A {beta} e a {alfa}, e de novo {beta}.'), ['beta', 'alfa']);
    assert.deepEqual(marcadoresEm('Nada {Alfa} {al fa} {} {alfa1} { alfa } aqui.'), []);
    assert.deepEqual(marcadoresEm('sem marcador'), []);
  });
});

describe('interpolar', () => {
  it('troca cada marcador pelo valor, numa passada só', () => {
    assert.equal(
      interpolar('A dimensão mais baixa é a regularidade: {regularidade}.', { regularidade: 'SRI 50 · 7 seguidas' }),
      'A dimensão mais baixa é a regularidade: SRI 50 · 7 seguidas.',
    );
    // Valor com chaves não é interpolado de novo; `$&` não vira padrão de replace.
    assert.equal(interpolar('{a} e {b}', { a: '{b}', b: '$& 3,3/5' }), '{b} e $& 3,3/5');
  });

  it('põe em maiúscula a primeira letra — só ela, e só se o texto começa por letra', () => {
    assert.equal(interpolar('{janela} têm a duração abaixo.', { janela: 'os últimos 7 dias' }), 'Os últimos 7 dias têm a duração abaixo.');
    assert.equal(interpolar('{quando}, a duração.', { quando: 'nos 7 dias de 28/08 a 03/09' }), 'Nos 7 dias de 28/08 a 03/09, a duração.');
    assert.equal(interpolar('{duracao} de sono.', { duracao: '7h20 · 86% ≥ 7h' }), '7h20 · 86% ≥ 7h de sono.');
    assert.equal(interpolar('ótimo', {}), 'Ótimo');
    assert.equal(interpolar('', {}), '');
  });

  it('texto sem marcador sai como entrou; chave malformada não é tocada', () => {
    assert.equal(interpolar('Este período não tem noite gravada.', {}), 'Este período não tem noite gravada.');
    assert.equal(interpolar('{Alfa} {}', { alfa: 'x' }), '{Alfa} {}');
  });

  it('marcador sem valor é defeito de quem chamou, e lança — o protótipo não é valor', () => {
    assert.throws(() => interpolar('As {medidas} dimensões.', {}), RangeError);
    assert.throws(() => interpolar('{constructor}', {}), RangeError);
  });
});

describe('limparResposta', () => {
  it('tira o espaço e as aspas que embrulham a resposta inteira', () => {
    assert.equal(limparResposta('  A duração em {alfa}.\n'), 'A duração em {alfa}.');
    // Os sete pares, numa fonte só: o que `aspaQueSobra` reprova, `limparResposta` desembrulha.
    for (const [abre, fecha] of [['"', '"'], ["'", "'"], ['“', '”'], ['‘', '’'], ['«', '»'], ['„', '“'], ['‚', '‘']]) {
      assert.equal(limparResposta(` ${abre} A duração em {alfa}. ${fecha} `), 'A duração em {alfa}.', abre);
      // Desembrulhada, a frase passa — nenhuma aspa sobra.
      assert.deepEqual(conferirInterpolado(limparResposta(`${abre}A duração em {alfa}.${fecha}`), REGRA), { ok: true }, abre);
    }
    // Embrulho dentro de embrulho.
    assert.equal(limparResposta('"“A duração em {alfa}.”"'), 'A duração em {alfa}.');
  });

  it('aspas que não embrulham o texto inteiro são do texto, e ficam', () => {
    assert.equal(limparResposta('"Duração" e "horário" empatam.'), '"Duração" e "horário" empatam.');
    assert.equal(limparResposta('A "duração" ficou.'), 'A "duração" ficou.');
    assert.equal(limparResposta('"'), '"');
  });
});

describe('conferirInterpolado', () => {
  it('o texto bom: sem número, marcador do conjunto, o exigido presente pelo nome', () => {
    assert.deepEqual(conferirInterpolado('A duração ficou em {alfa}.', REGRA), { ok: true });
    // O citável pode vir, pelo nome ou pelo marcador.
    assert.deepEqual(conferirInterpolado('A duração ficou em {alfa}, e o horário em {beta}.', REGRA), { ok: true });
    // O acento é dobrado dos dois lados: "DURACAO" nomeia a duração.
    assert.deepEqual(conferirInterpolado('DURACAO em destaque.', REGRA), { ok: true });
    // A forma declarada conta: o plural nomeia.
    assert.deepEqual(conferirInterpolado('As durações ficaram em {alfa}.', REGRA), { ok: true });
    // Sem pontuação final também é uma frase.
    assert.deepEqual(conferirInterpolado('A duração ficou em {alfa}', REGRA), { ok: true });
  });

  describe('a forma', () => {
    it('quebra de linha reprova — de qualquer tipo', () => {
      for (const q of ['\n', '\r', cp(0x85), cp(0x2028), cp(0x2029)]) {
        assert.deepEqual(regras(conferirInterpolado(`A duração${q}em {alfa}`, REGRA)), ['forma'], JSON.stringify(q));
      }
    });

    it('marcação reprova: asterisco, sublinhado, cerquilha, crase e til', () => {
      for (const m of ['*', '_', '#', '`', '~']) {
        const c = conferirInterpolado(`A ${m}duração${m} em {alfa}.`, REGRA);
        assert.deepEqual(regras(c), ['forma'], m);
        assert.ok(detalhes(c)[0].includes(m));
      }
    });

    it('marcador de lista ou de citação no começo reprova', () => {
      for (const m of ['-', '•', '>', '–', '—']) {
        assert.deepEqual(regras(conferirInterpolado(`${m} A duração ficou em {alfa}.`, REGRA)), ['forma'], m);
      }
      // No meio da frase, o travessão é pontuação.
      assert.deepEqual(conferirInterpolado('A duração — a de sempre — ficou em {alfa}.', REGRA), { ok: true });
    });

    it('caractere de controle reprova, e a quebra de linha segue sendo quebra de linha', () => {
      for (const n of [0x00, 0x0b, 0x0c, 0x09, 0x1b]) {
        const c = conferirInterpolado(`A duração${cp(n)} ficou em {alfa}.`, REGRA);
        assert.deepEqual(regras(c), ['forma'], n.toString(16));
        assert.ok(detalhes(c)[0].startsWith('caractere de controle U+'), detalhes(c)[0]);
      }
      // A quebra de linha é Cc e tem regra própria: um problema, não dois.
      const quebra = conferirInterpolado('A duração\nficou em {alfa}.', REGRA);
      assert.deepEqual(detalhes(quebra), ['quebra de linha']);
    });

    it('caractere invisível de formatação reprova, com o código no detalhe', () => {
      for (const n of [0x200b, 0xfeff, 0x00ad, 0x2060, 0x200e]) {
        const c = conferirInterpolado(`A duração${cp(n)} ficou em {alfa}.`, REGRA);
        assert.deepEqual(regras(c), ['forma'], n.toString(16));
        assert.ok(detalhes(c)[0].includes(`U+${n.toString(16).toUpperCase().padStart(4, '0')}`), detalhes(c)[0]);
      }
    });

    it('rótulo de uma palavra com dois-pontos no começo reprova', () => {
      for (const r of ['Frase', 'Resposta', 'Caso', 'LEITURA']) {
        assert.deepEqual(regras(conferirInterpolado(`${r}: a duração ficou em {alfa}.`, REGRA)), ['forma'], r);
      }
      // O dois-pontos depois da primeira palavra que não é rótulo, não.
      assert.deepEqual(conferirInterpolado('A duração: {alfa}.', REGRA), { ok: true });
    });

    it('rótulo de mais de uma palavra no começo também reprova — e o dois-pontos no meio não', () => {
      for (const r of ['Resposta final', 'Frase única', 'A leitura', 'Texto da frase', 'Caso da noite', 'Saída']) {
        assert.deepEqual(regras(conferirInterpolado(`${r}: a duração ficou em {alfa}.`, REGRA)), ['forma'], r);
      }
      // Sem palavra de rótulo, o começo curto com dois-pontos é frase: é o template de `uma`.
      assert.deepEqual(conferirInterpolado('A dimensão mais baixa é a duração: {alfa}.', REGRA), { ok: true });
      assert.deepEqual(conferirInterpolado('A duração, medida na semana passada sem nenhum susto, ficou assim: {alfa}.', REGRA), { ok: true });
    });

    it('aspa que sobra numa ponta reprova; a que tem par dentro é do texto', () => {
      for (const texto of [
        '"A duração ficou em {alfa}.', 'A duração ficou em {alfa}."', '“A duração ficou em {alfa}.', 'A duração ficou em {alfa}.”',
        '« A duração ficou em {alfa}.', 'A duração ficou em {alfa}. «', 'A "duração" em {alfa}."',
      ]) {
        assert.ok(regras(conferirInterpolado(texto, REGRA)).includes('forma'), texto);
      }
      for (const texto of ['"Duração" e "horário" ficam em {alfa}.', '“Duração” em {alfa}, e o horário.', 'A duração em {alfa}, dita "curta"']) {
        assert.deepEqual(conferirInterpolado(texto, REGRA), { ok: true }, texto);
      }
    });

    it('mais de uma frase reprova: pontuação final antes do fim, reticências inclusive', () => {
      for (const texto of [
        'A duração ficou em {alfa}. O resto também.', 'A duração! Ficou em {alfa}', 'A duração? Em {alfa}.',
        'A duração… ficou em {alfa}.', 'A duração... ficou em {alfa}',
      ]) {
        assert.deepEqual(regras(conferirInterpolado(texto, REGRA)), ['forma'], texto);
      }
      // A pontuação que fecha a frase, com o que vem depois dela, não conta.
      for (const texto of ['A duração ficou em {alfa}!', 'A duração ficou em {alfa}?!', 'A duração (em {alfa}).', 'A duração ficou em {alfa}…']) {
        assert.deepEqual(conferirInterpolado(texto, REGRA), { ok: true }, texto);
      }
    });

    it(`mais de ${TAMANHO_MAXIMO_DA_FRASE} caracteres **na frase interpolada** reprova`, () => {
      const base = 'A duração ficou em {alfa}, ';
      const frase = (texto: string) => interpolar(texto, REGRA.valores);
      // O texto do motor tem 281 caracteres; a frase, com "7h20" no lugar de "{alfa}", 279 — passa.
      const longo = `${base}${'e'.repeat(TAMANHO_MAXIMO_DA_FRASE - base.length)}.`;
      assert.equal([...longo].length, TAMANHO_MAXIMO_DA_FRASE + 1);
      assert.equal([...frase(longo)].length, TAMANHO_MAXIMO_DA_FRASE - 1);
      assert.deepEqual(conferirInterpolado(longo, REGRA), { ok: true });
      // O texto curto cujo valor passa do tamanho: reprova pela frase.
      const r: RegraInterpolada = { ...REGRA, valores: { ...REGRA.valores, alfa: 'x'.repeat(TAMANHO_MAXIMO_DA_FRASE) } };
      const c = conferirInterpolado('A duração ficou em {alfa}.', r);
      assert.deepEqual(regras(c), ['forma']);
      assert.ok(detalhes(c)[0].includes(String(TAMANHO_MAXIMO_DA_FRASE)));
      // No limite exato, passa.
      const noLimite = `A duração ficou em {alfa}, ${'e'.repeat(TAMANHO_MAXIMO_DA_FRASE - frase(base).length - 1)}.`;
      assert.equal([...frase(noLimite)].length, TAMANHO_MAXIMO_DA_FRASE);
      assert.deepEqual(conferirInterpolado(noLimite, REGRA), { ok: true });
    });
  });

  describe('o número', () => {
    it('algarismo reprova — de qualquer escrita, com o separador colado', () => {
      const c = conferirInterpolado('A duração ficou em 6,5 horas, {alfa}.', REGRA);
      assert.deepEqual(regras(c), ['algarismo']);
      assert.ok(detalhes(c)[0].includes('"6,5"'));
      assert.deepEqual(regras(conferirInterpolado(`A duração é ${cp(0x663)}.`, REGRA)), ['algarismo']);
      // \p{N}, não só dígito decimal: fração, índice e romano.
      for (const n of ['½', '²', 'Ⅳ']) assert.deepEqual(regras(conferirInterpolado(`A duração é ${n}.`, REGRA)), ['algarismo'], n);
    });

    it('numeral por extenso reprova fora de marcador — a lista inteira, nos dois gêneros', () => {
      for (const n of [
        'zero', 'dois', 'duas', 'três', 'tres', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove', 'dez',
        'onze', 'doze', 'treze', 'catorze', 'quatorze', 'quinze', 'dezesseis', 'dezessete', 'dezoito', 'dezenove',
        'vinte', 'trinta', 'quarenta', 'cinquenta', 'sessenta', 'setenta', 'oitenta', 'noventa', 'cem', 'cento',
        'duzentos', 'duzentas', 'trezentas', 'quinhentos', 'novecentas', 'mil', 'milhão', 'milhões', 'bilhão', 'bilhões',
        'dezena', 'dúzia', 'metade', 'dobro', 'triplo', 'terço', 'meia hora', 'meia-noite', 'meio-dia', 'por cento',
      ]) {
        const c = conferirInterpolado(`A duração em {alfa}, ${n} vezes.`, REGRA);
        assert.ok(regras(c).includes('extenso'), n);
        assert.deepEqual([...new Set(regras(c))], ['extenso'], n);
      }
      // O de uma palavra casa com o plural: "dezenas", "terços".
      for (const n of ['dezenas', 'terços', 'dúzias']) {
        assert.deepEqual(regras(conferirInterpolado(`A duração em {alfa}, ${n} de vezes.`, REGRA)), ['extenso'], n);
      }
      // "Cinco dimensões" com quatro medidas é a conta que o motor não faz.
      assert.deepEqual(regras(conferirInterpolado('As cinco dimensões, e a duração em {alfa}.', REGRA)), ['extenso']);
    });

    it('um e uma são artigo; e numeral é palavra inteira — "setembro" não é "sete"', () => {
      assert.deepEqual(conferirInterpolado('Uma dimensão, a duração, ficou em {alfa}, e um horário.', REGRA), { ok: true });
      assert.deepEqual(conferirInterpolado('Em setembro, a duração ficou em {alfa}; o dezembro é outro.', REGRA), { ok: true });
    });

    it('o numeral que o caso diz passa — só ele, e só no lugar dele', () => {
      const duas: RegraInterpolada = { ...REGRA, numerais: { duas: ['dimensões'] } };
      assert.deepEqual(conferirInterpolado('Duas dimensões empatam: a duração em {alfa}.', duas), { ok: true });
      assert.deepEqual(conferirInterpolado('DUAS DIMENSOES empatam: a duração em {alfa}.', duas), { ok: true });
      // Fora do lugar: antes de outra palavra, no fim, ou com um marcador no meio.
      for (const texto of [
        'As duas noites, e a duração em {alfa}.', 'A duração em {alfa}, e são duas.', 'Duas {medidas} dimensões, a duração em {alfa}.',
        'Duas, dimensões: a duração em {alfa}.',
      ]) {
        const c = conferirInterpolado(texto, duas);
        assert.ok(regras(c).includes('extenso'), texto);
        assert.ok(detalhes(c).some((d) => d.includes('"duas dimensões"')), texto);
      }
      // O outro numeral segue proibido.
      assert.deepEqual(regras(conferirInterpolado('Dois horários e a duração em {alfa}.', duas)), ['extenso']);
    });

    it('dentro de marcador não é prosa: o nome do marcador não conta como numeral', () => {
      const r: RegraInterpolada = { ...REGRA, valores: { ...REGRA.valores, dez: 'x' } };
      assert.deepEqual(conferirInterpolado('A duração em {alfa}, com {dez}.', r), { ok: true });
    });
  });

  describe('as chaves', () => {
    it('chave malformada reprova: maiúscula, acento, espaço, vazia, sem fechar', () => {
      for (const texto of [
        'A duração em {Alfa}.', 'A duração em {duração}.', 'A duração em { alfa }.', 'A duração em {}.',
        'A duração em {alfa.', 'A duração em alfa}.', 'A duração em {{alfa}}.',
      ]) {
        assert.ok(regras(conferirInterpolado(texto, REGRA)).includes('chave'), texto);
      }
    });

    it('marcador embrulhado reprova como chave: [nome], ${nome}, <nome> e ｛nome｝', () => {
      for (const embrulho of ['[alfa]', '${alfa}', '<alfa>', '｛alfa｝', '[ Alfa ]', '<duração>']) {
        const c = conferirInterpolado(`A duração em ${embrulho}.`, REGRA);
        assert.ok(regras(c).includes('chave'), embrulho);
        assert.ok(detalhes(c).some((d) => d.includes(embrulho)), embrulho);
      }
    });

    it('o ${nome} não passa por marcador, e o marcador não conta como nome', () => {
      // Só o marcador embrulhado, sem o rótulo na prosa: a duração não foi nomeada.
      assert.deepEqual(regras(conferirInterpolado('O ponto mais baixo: ${alfa}.', REGRA)), ['chave', 'ausente']);
    });

    it('o nome colado a $, %, @ ou dois-pontos reprova como chave — e o sinal solto também', () => {
      for (const [texto, achado] of [
        ['A duração em $alfa.', '$alfa'], ['A duração em %alfa%.', '%alfa%'], ['A duração em @alfa.', '@alfa'],
        ['A duração em :alfa.', ':alfa'], ['A duração em alfa$.', 'alfa$'], ['A duração em {alfa}%.', '%'],
        ['A duração em {alfa} %.', '%'],
      ] as const) {
        const c = conferirInterpolado(texto, REGRA);
        assert.ok(regras(c).includes('chave'), texto);
        assert.ok(detalhes(c).includes(`sinal de chave: "${achado}"`), `${texto} → ${detalhes(c).join(' | ')}`);
      }
    });

    it('a chave sem acento de um rótulo com acento, solta na prosa, reprova como chave', () => {
      const r: RegraInterpolada = {
        valores: { duracao: '7h20' },
        itens: [
          { chave: 'duracao', rotulo: 'duração' },
          { chave: 'regularidade', rotulo: 'regularidade' },
        ],
        citaveis: ['regularidade'],
        exigidos: [{ item: 'duracao' }],
        vocabulario: TODOS,
      };
      for (const texto of ['A duracao ficou em {duracao}.', 'A duração ficou em {duracao}, a Duracao.']) {
        const c = conferirInterpolado(texto, r);
        assert.deepEqual(regras(c), ['chave'], texto);
        assert.ok(detalhes(c)[0].includes('"duracao"'), texto);
      }
      // O rótulo com acento é o nome; a chave que é o próprio rótulo também.
      assert.deepEqual(conferirInterpolado('A duração ficou em {duracao}, e a regularidade.', r), { ok: true });
    });
  });

  describe('o conjunto, a repetição e o lugar do marcador', () => {
    it('marcador fora do conjunto reprova — o conjunto é o das chaves dos valores', () => {
      const c = conferirInterpolado('A duração ficou em {alfa}, com {cobertura}.', REGRA);
      assert.deepEqual(regras(c), ['marcador']);
      assert.ok(detalhes(c)[0].includes('{cobertura}'));
    });

    it('cada marcador vai uma vez só', () => {
      const c = conferirInterpolado('A duração em {alfa}, e de novo {alfa}.', REGRA);
      assert.deepEqual(regras(c), ['marcador']);
      assert.ok(detalhes(c)[0].includes('2 vezes'), detalhes(c)[0]);
    });

    it('marcador com lugar só vale logo antes das palavras dele', () => {
      const r: RegraInterpolada = { ...REGRA, antesDe: { medidas: ['dimensões'] } };
      assert.deepEqual(conferirInterpolado('As {medidas} dimensões, e a duração em {alfa}.', r), { ok: true });
      assert.deepEqual(conferirInterpolado('As {medidas} DIMENSOES, a duração em {alfa}.', r), { ok: true });
      for (const texto of [
        'Das {medidas} medidas, a duração em {alfa}.', 'A duração em {alfa}, de {medidas}.', 'A duração em {alfa} e {medidas}',
        'As {medidas}  noites e dimensões, a duração em {alfa}.', 'Só {medidas} dimensão, a duração em {alfa}.',
      ]) {
        const c = conferirInterpolado(texto, r);
        assert.deepEqual(regras(c), ['marcador'], texto);
        assert.ok(detalhes(c)[0].includes('"dimensões"'), texto);
      }
    });

    it('marcador que não vale logo depois de certas palavras', () => {
      const r: RegraInterpolada = {
        ...REGRA,
        valores: { ...REGRA.valores, janela: 'os últimos 7 dias' },
        naoDepoisDe: { janela: ['em', 'de', 'a', 'à', 'por'] },
      };
      for (const antes of ['Em', 'de', 'À', 'a', 'POR']) {
        const c = conferirInterpolado(`${antes} {janela}, a duração ficou em {alfa}.`, r);
        assert.deepEqual(regras(c), ['marcador'], antes);
        assert.ok(detalhes(c)[0].includes(`"${antes}"`), antes);
      }
      for (const texto of [
        '{janela} têm a duração em {alfa}.', 'Durante {janela}, a duração ficou em {alfa}.', 'A duração ficou em {alfa} ao longo {janela}',
      ]) {
        assert.deepEqual(conferirInterpolado(texto, r), { ok: true }, texto);
      }
    });

    it('o que só o marcador diz, dito de outro jeito na prosa, reprova — com o plural', () => {
      const r: RegraInterpolada = {
        ...REGRA,
        valores: { ...REGRA.valores, janela: 'os últimos 7 dias' },
        soPeloMarcador: { janela: ['semana', 'dia', 'mês', 'meses'] },
      };
      for (const [texto, dita] of [
        ['Nesta semana a duração ficou em {alfa}.', 'semana'], ['Nos dias da janela, a duração em {alfa}.', 'dia'],
        // "meses" é o plural de "mês": a lista traz os dois, e a palavra dá um achado só.
        ['No MES, a duração em {alfa}.', 'mês'], ['Nos meses, a duração em {alfa}.', 'mês'],
      ] as const) {
        const c = conferirInterpolado(texto, r);
        assert.deepEqual(regras(c), ['marcador'], texto);
        assert.ok(detalhes(c)[0].includes(`"${dita}"`) && detalhes(c)[0].includes('{janela}'), texto);
      }
      // Dois marcadores dizem a mesma janela: o detalhe nomeia os dois, não só um.
      const comQuando: RegraInterpolada = {
        ...r,
        valores: { ...r.valores, quando: 'nas últimas 4 semanas' },
        soPeloMarcador: { janela: ['semana'], quando: ['semana'] },
      };
      const c = conferirInterpolado('Nesta semana a duração ficou em {alfa}.', comQuando);
      assert.deepEqual(detalhes(c), ['a prosa diz "semana", que só {janela} e {quando} dizem']);
      // Palavra inteira: "semanal" e "diária" não são "semana" e "dia"; o valor não é prosa.
      assert.deepEqual(conferirInterpolado('A duração semanal em {alfa}, diária até.', r), { ok: true });
      assert.deepEqual(conferirInterpolado('{janela} têm a duração em {alfa}.', r), { ok: true });
    });
  });

  describe('os itens, a contradição e o vocabulário', () => {
    it('item a mais reprova — pelo nome ou pelo marcador dele', () => {
      const peloNome = conferirInterpolado('A duração em {alfa}, e a percepção também.', REGRA);
      assert.deepEqual(regras(peloNome), ['a-mais']);
      const peloMarcador = conferirInterpolado('A duração em {alfa}, e {gama}.', REGRA);
      assert.deepEqual(regras(peloMarcador), ['marcador', 'a-mais']);
    });

    it('o nome casa nas formas declaradas, e só nelas: sem formas, só o rótulo', () => {
      // `gama` não declara o plural: "percepções" não é "percepção".
      assert.deepEqual(conferirInterpolado('A duração em {alfa}; percepções à parte.', REGRA), { ok: true });
      // `alfa` declara: "durações" nomeia a duração, e conta como a mais onde ela não é citável.
      const semAlfa: RegraInterpolada = { ...REGRA, citaveis: [], exigidos: [{ item: 'beta' }] };
      assert.deepEqual(regras(conferirInterpolado('O horário, e as durações.', semAlfa)), ['a-mais']);
    });

    it('a expressão que afirma outro caso reprova como contradição — a de uma palavra com o plural', () => {
      const r: RegraInterpolada = { ...REGRA, contradiz: ['máximo', 'mais alta', 'empate', 'mesmo ponto'] };
      for (const [texto, termo] of [
        ['A duração ficou no máximo: {alfa}.', 'máximo'], ['A duração em {alfa}, e os máximos das outras.', 'máximo'],
        ['A duração é a mais alta: {alfa}.', 'mais alta'], ['A duração em {alfa}, sem empates.', 'empate'],
        ['A duração em {alfa}; o resto no MESMO PONTO.', 'mesmo ponto'],
      ] as const) {
        const c = conferirInterpolado(texto, r);
        assert.deepEqual(regras(c), ['contradicao'], texto);
        assert.ok(detalhes(c)[0].includes(`"${termo}"`), texto);
        assert.equal(!c.ok && c.recusa, undefined, 'contradizer não é recusar: é reprovada');
      }
      // A de várias palavras só como está escrita: "as outras são mais altas" é outra coisa.
      assert.deepEqual(conferirInterpolado('A duração ficou em {alfa}; as outras são mais altas.', r), { ok: true });
    });

    it('vocabulário proibido reprova, um problema por termo, com o subconjunto', () => {
      const c = conferirInterpolado('A duração em {alfa}: recomendo dormir mais, e a meta ficou longe, meta mesmo.', REGRA);
      assert.deepEqual(regras(c), ['vocabulario', 'vocabulario']);
      assert.deepEqual(detalhes(c), ['conselho: "recomendo"', 'tendencia-e-meta: "meta"']);
      assert.equal(!c.ok && c.recusa, undefined, 'aconselhar não é recusar: é reprovada');
    });

    it('só os subconjuntos que o recurso compõe', () => {
      const soCausa: RegraInterpolada = { ...REGRA, vocabulario: ['causa'] };
      assert.deepEqual(conferirInterpolado('A duração em {alfa}, rumo à meta.', soCausa), { ok: true });
      assert.deepEqual(regras(conferirInterpolado('A duração em {alfa} porque sim.', soCausa)), ['vocabulario']);
    });

    it('o termo que só nasce na troca reprova; o que está inteiro dentro de um valor, não', () => {
      const r: RegraInterpolada = { ...REGRA, valores: { ...REGRA.valores, janela: 'as últimas 4 semanas' } };
      const c = conferirInterpolado('A duração ficou em {alfa} devido {janela}.', r);
      assert.deepEqual(regras(c), ['vocabulario']);
      assert.deepEqual(detalhes(c), ['causa: "devido a"']);
      // O texto sozinho não tinha o termo — é a troca que o forma.
      assert.deepEqual(conferirInterpolado('A duração ficou em {alfa} devido.', r), { ok: true });
      // O valor que já traz um termo não é culpa do motor.
      const comMeta: RegraInterpolada = { ...REGRA, valores: { ...REGRA.valores, alfa: 'meta batida' } };
      assert.deepEqual(conferirInterpolado('A duração ficou em {alfa}.', comMeta), { ok: true });
    });

    it('só os valores que o texto usou descontam: um valor de fora não esconde o termo da troca', () => {
      // `beta` traz "devido a" e não é usado; `janela` entra na frase e forma o termo.
      const r: RegraInterpolada = {
        ...REGRA,
        valores: { ...REGRA.valores, beta: 'devido a isso', janela: 'as últimas 4 semanas' },
      };
      const c = conferirInterpolado('A duração ficou em {alfa} devido {janela}.', r);
      assert.deepEqual(regras(c), ['vocabulario']);
      assert.deepEqual(detalhes(c), ['causa: "devido a"']);
      // Usado, o valor desconta: o termo está inteiro dentro dele.
      assert.deepEqual(conferirInterpolado('A duração ficou em {alfa}, e o horário em {beta}.', r), { ok: true });
    });
  });

  describe('a recusa', () => {
    it('cada sinal é recusa — com o exigido presente', () => {
      for (const sinal of [
        'Desculpe', 'desculpa', 'Lamento', 'sinto muito', 'não posso', 'NAO CONSIGO', 'não sou capaz', 'não tenho acesso',
        'como modelo', 'como assistente', 'modelo de linguagem', 'inteligência artificial', 'sorry', 'unable', 'as an AI',
        'I cannot',
      ]) {
        const c = conferirInterpolado(`${sinal}: a duração ficou em {alfa}`, { ...REGRA });
        assert.ok(!c.ok && c.recusa === true, sinal);
        assert.ok(regras(c).includes('recusa'), sinal);
        assert.ok(!regras(c).includes('ausente'), `${sinal}: a duração está lá — a recusa é pelo sinal`);
      }
      // Com o plural: "desculpas".
      const c = conferirInterpolado('Peço desculpas, a duração ficou em {alfa}.', REGRA);
      assert.ok(!c.ok && c.recusa === true);
    });

    it('a recusa em texto livre: os sinais e a falta, e é recusa', () => {
      const c = conferirInterpolado('Desculpe, não posso ajudar com isso.', REGRA);
      assert.deepEqual(c, {
        ok: false,
        recusa: true,
        problemas: [
          { regra: 'recusa', detalhe: 'sinal de recusa: "desculpe"' },
          { regra: 'recusa', detalhe: 'sinal de recusa: "não posso"' },
          { regra: 'ausente', detalhe: 'não nomeia duração, que o caso exige' },
        ],
      });
    });

    it('o texto vazio é recusa', () => {
      for (const vazio of ['', '   ']) {
        const c = conferirInterpolado(vazio, REGRA);
        assert.ok(!c.ok && c.recusa === true);
        assert.ok(regras(c).includes('recusa'));
      }
    });

    it('o sinal é palavra inteira: "desculpável" e "lamentoso" não são recusa', () => {
      assert.deepEqual(conferirInterpolado('A duração, desculpável, ficou em {alfa}.', REGRA), { ok: true });
    });
  });

  describe('a presença', () => {
    it('a falta sozinha é recusa; a falta junto de outro erro é reprovada', () => {
      const soFalta = conferirInterpolado('O horário ficou alto.', REGRA);
      assert.ok(!soFalta.ok && soFalta.recusa === true);
      assert.deepEqual(regras(soFalta), ['ausente']);
      // Errar e faltar é texto errado, não recusa — a bancada conta as duas coisas
      // separadas, e trocar de dimensão não é o modelo se recusando.
      const erraEFalta = conferirInterpolado('O horário ficou em 7 horas.', REGRA);
      assert.ok(!erraEFalta.ok && erraEFalta.recusa === undefined, JSON.stringify(erraEFalta));
      assert.deepEqual(regras(erraEFalta), ['algarismo', 'ausente']);
      // A dimensão errada: `a-mais` + `ausente` é reprovada, não recusa.
      const outraDimensao = conferirInterpolado('A percepção ficou em {alfa}.', REGRA);
      assert.ok(!outraDimensao.ok && outraDimensao.recusa === undefined, JSON.stringify(outraDimensao));
      assert.deepEqual(regras(outraDimensao), ['a-mais', 'ausente']);
      // Com sinal de recusa, é recusa mesmo com outro erro ao lado.
      const comSinal = conferirInterpolado('Desculpe, a percepção ficou em {alfa}.', REGRA);
      assert.ok(!comSinal.ok && comSinal.recusa === true);
    });

    it('o item conta pelo nome, na prosa — o marcador dele não conta', () => {
      // O valor ("7h20") não diz de que item é: `{alfa}` sozinho não nomeia a duração.
      const c = conferirInterpolado('O ponto mais baixo: {alfa}.', REGRA);
      assert.ok(!c.ok && c.recusa === true);
      assert.deepEqual(regras(c), ['ausente']);
      // Fora do conjunto, o marcador reprova e ainda falta o nome.
      const semAlfa: RegraInterpolada = { ...REGRA, valores: { beta: '± 22 min' } };
      assert.deepEqual(regras(conferirInterpolado('O ponto mais baixo: {alfa}.', semAlfa)), ['marcador', 'ausente']);
      assert.deepEqual(regras(conferirInterpolado('A duração: {alfa}.', semAlfa)), ['marcador']);
    });

    it('exigido marcador conta só pelo marcador bem formado e do conjunto', () => {
      const r: RegraInterpolada = { ...REGRA, exigidos: [{ marcador: 'medidas' }], citaveis: [] };
      assert.deepEqual(conferirInterpolado('As {medidas} dimensões medidas estão no máximo.', r), { ok: true });
      const falta = conferirInterpolado('As dimensões medidas estão no máximo.', r);
      assert.ok(!falta.ok && falta.recusa === true);
      assert.ok(detalhes(falta)[0].includes('{medidas}'));
      // A palavra "medidas" na prosa não é o marcador.
      assert.ok(!conferirInterpolado('As dimensões medidas.', r).ok);
    });

    it('exigida palavra conta por palavra inteira, com o acento dobrado', () => {
      const r: RegraInterpolada = { ...REGRA, exigidos: [{ palavra: 'período' }], citaveis: [] };
      assert.deepEqual(conferirInterpolado('Este PERIODO não tem noite gravada.', r), { ok: true });
      for (const texto of ['Estes períodos não têm noite.', 'Não tem noite gravada.']) {
        const c = conferirInterpolado(texto, r);
        assert.ok(!c.ok && c.recusa === true, texto);
        assert.deepEqual(detalhes(c), ['não diz "período", que o caso exige'], texto);
      }
      // A recusa que cita a palavra exigida: tem a palavra, e é recusa pelo sinal.
      const cita = conferirInterpolado('Não posso comentar este período.', r);
      assert.ok(!cita.ok && cita.recusa === true);
      assert.deepEqual(regras(cita), ['recusa']);
    });

    it('o que o recurso declara errado é defeito dele, e lança', () => {
      // Item que a regra não declara.
      assert.throws(() => conferirInterpolado('Qualquer coisa.', { ...REGRA, exigidos: [{ item: 'delta' }] }), TypeError);
      // Marcador exigido que não está no conjunto: sem isto, **toda** leitura do caso
      // virava recusa-do-modelo, calada.
      assert.throws(
        () => conferirInterpolado('A duração ficou em {alfa}.', { ...REGRA, exigidos: [{ marcador: 'medidaz' }] }),
        TypeError,
      );
      // Palavra exigida vazia: nada a cumprir.
      for (const palavra of ['', '   ']) {
        assert.throws(() => conferirInterpolado('A duração em {alfa}.', { ...REGRA, exigidos: [{ palavra }] }), TypeError);
      }
      // Nome de valor fora da sintaxe do marcador: entraria no conjunto sem ser alcançável.
      for (const nome of ['Alfa', 'al fa', 'alfa1', 'duração', '']) {
        assert.throws(
          () => conferirInterpolado('A duração em {alfa}.', { ...REGRA, valores: { ...REGRA.valores, [nome]: 'x' } }),
          TypeError,
          nome,
        );
      }
    });

    it('nada exigido: o texto sem item nenhum passa', () => {
      const r: RegraInterpolada = { ...REGRA, exigidos: [], citaveis: [] };
      assert.deepEqual(conferirInterpolado('Este período não tem noite gravada.', r), { ok: true });
    });
  });
});
