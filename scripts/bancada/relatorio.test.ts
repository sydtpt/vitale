/**
 * A forma do relatório e a identidade do manifesto — puro, offline.
 *
 * O que importa provar aqui: o manifesto **identifica** a execução (mesmo export e
 * mesmas janelas → mesmo hash; qualquer coisa diferente → hash diferente), os
 * agregados contam o que o AC manda contar, e a comparação **recusa** manifestos
 * diferentes em vez de somar maçã com laranja.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { CASOS_DA_SAUDE, NUVEM_PADRAO, SEM_MODELO, type MotorId } from '@vitale/shared';
import {
  ORDEM_DOS_CASOS,
  REGRAS_DE_AMOSTRA,
  VEREDITOS,
  agregar,
  corpoDoManifesto,
  hashDoCorpo,
  chaveDaColuna,
  compararRelatorios,
  hashCurto,
  montarManifesto,
  montarRelatorio,
  relatorioEmMarkdown,
  sha256De,
  vereditoDe,
  type CorpoDoManifesto,
  type LinhaDoRelatorio,
  type Manifesto,
} from './relatorio.ts';

/* ── os fixtures ── */

const CORPO: CorpoDoManifesto = {
  recurso: 'saude-do-sono',
  versaoDoDescritor: 1,
  hoje: '2026-09-10',
  acervo: {
    noites: { arquivo: 'sleep_periods.json', linhas: 293, sha256: sha256De('as noites') },
    notas: { arquivo: 'daily_ratings.json', linhas: 89, sha256: sha256De('as notas') },
    sha256: sha256De('o acervo'),
  },
  janelas: [
    { range: '7d', passos: 73 },
    { range: '4s', passos: 19 },
    { range: '12m', passos: 2 },
    { range: 'ultima', passos: 293 },
  ],
  amostra: { regra: 'recentes-por-caso-e-alcance', versaoDaRegra: 1, limite: 2, janelas: 24 },
  motores: [SEM_MODELO, NUVEM_PADRAO],
};

function linha(p: Partial<LinhaDoRelatorio> = {}): LinhaDoRelatorio {
  return {
    range: '7d',
    offset: 0,
    alcance: 'periodo',
    caso: 'duas',
    hashDoPedido: sha256De('um pedido'),
    desfecho: 'ok',
    ms: 812,
    template: 'A duração e a regularidade empatam no ponto mais baixo.',
    ...p,
  };
}

const MANIFESTO = montarManifesto(CORPO);

/** O item `i` de uma lista, provando que ele existe. */
function um<T>(xs: readonly T[], i = 0): T {
  const x = xs[i];
  assert.ok(x !== undefined, `a lista não tem item ${i}`);
  return x;
}

function relatorio(colunas: readonly { motor: MotorId; linhas: readonly LinhaDoRelatorio[] }[], m: Manifesto = MANIFESTO) {
  return montarRelatorio({
    recurso: 'saude-do-sono',
    sistema: { plataforma: 'darwin', versao: '25.6.0' },
    manifesto: m,
    geradoEm: '2026-09-12T10:00:00.000Z',
    pedidos: { [sha256De('um pedido')]: { sistema: 'as regras', usuario: 'o caso' } },
    colunas,
  });
}

/* ── o manifesto ── */

describe('o manifesto', () => {
  it('mesmo corpo, mesmo hash — é o que torna duas execuções comparáveis', () => {
    assert.equal(montarManifesto(CORPO).hash, montarManifesto({ ...CORPO }).hash);
    // E a ordem das chaves do objeto não conta: o hash é de JSON canônico.
    const trocado: CorpoDoManifesto = {
      motores: CORPO.motores,
      amostra: CORPO.amostra,
      janelas: CORPO.janelas,
      acervo: CORPO.acervo,
      hoje: CORPO.hoje,
      versaoDoDescritor: CORPO.versaoDoDescritor,
      recurso: CORPO.recurso,
    };
    assert.equal(montarManifesto(trocado).hash, MANIFESTO.hash);
  });

  it('cada coisa que muda a leitura muda o hash', () => {
    const variantes: readonly CorpoDoManifesto[] = [
      { ...CORPO, hoje: '2026-09-09' },
      { ...CORPO, versaoDoDescritor: 2 },
      { ...CORPO, acervo: { ...CORPO.acervo, sha256: sha256De('outro acervo') } },
      { ...CORPO, janelas: [...CORPO.janelas.slice(0, 3), { range: 'ultima', passos: 292 }] },
      { ...CORPO, amostra: { ...CORPO.amostra, limite: 4 } },
      { ...CORPO, amostra: { ...CORPO.amostra, janelas: 28 } },
      { ...CORPO, motores: [SEM_MODELO] },
    ];
    const hashes = variantes.map((c) => montarManifesto(c).hash);
    assert.equal(new Set([...hashes, MANIFESTO.hash]).size, variantes.length + 1);
  });

  it('o hash é um sha256, e o curto é prefixo dele', () => {
    assert.match(MANIFESTO.hash, /^[0-9a-f]{64}$/);
    assert.ok(MANIFESTO.hash.startsWith(hashCurto(MANIFESTO.hash)));
  });

  it('não carrega dado de saúde — só contagens e hashes', () => {
    const texto = JSON.stringify(MANIFESTO);
    for (const proibido of ['asleepH', 'wakeDay', 'onsetAt', 'awakenings', 'sleepQuality']) {
      assert.equal(texto.includes(proibido), false, `${proibido} apareceu no manifesto`);
    }
  });
});

/* ── os agregados ── */

describe('agregar', () => {
  it('classifica cada desfecho no veredito que o dono vai ler', () => {
    assert.equal(vereditoDe('ok'), 'aprovada');
    assert.equal(vereditoDe('reprovada'), 'reprovada');
    assert.equal(vereditoDe('recusa-do-modelo'), 'recusa');
    assert.equal(vereditoDe('template'), 'template');
    assert.equal(vereditoDe('mudo'), 'mudo');
    for (const d of ['indisponivel', 'capacidade', 'janela', 'guarda', 'saida-invalida', 'transitoria', 'defeito'] as const) {
      assert.equal(vereditoDe(d), 'falha', d);
    }
  });

  it('fecha com aprovadas, reprovadas e recusas por caso', () => {
    const a = agregar([
      linha({ caso: 'duas', desfecho: 'ok' }),
      linha({ caso: 'duas', desfecho: 'reprovada', problemas: [{ regra: 'algarismo', detalhe: 'escreveu 7' }] }),
      linha({ caso: 'duas', desfecho: 'recusa-do-modelo', problemas: [{ regra: 'recusa', detalhe: 'desculpe' }] }),
      linha({ caso: 'uma', desfecho: 'ok' }),
      linha({ caso: 'uma', desfecho: 'transitoria' }),
    ]);
    assert.equal(a.total, 5);
    assert.equal(a.porVeredito.aprovada, 2);
    assert.equal(a.porVeredito.reprovada, 1);
    assert.equal(a.porVeredito.recusa, 1);
    assert.equal(a.porVeredito.falha, 1);
    const duas = a.porCaso.find((c) => c.caso === 'duas')!;
    assert.equal(duas.total, 3);
    assert.deepEqual(
      [duas.porVeredito.aprovada, duas.porVeredito.reprovada, duas.porVeredito.recusa],
      [1, 1, 1],
    );
    // O total por caso fecha com o total geral — nenhuma linha cai fora.
    assert.equal(a.porCaso.reduce((s, c) => s + c.total, 0), a.total);
    assert.equal(VEREDITOS.reduce((s, v) => s + a.porVeredito[v], 0), a.total);
  });

  it('conta quantas vezes cada regra reprovou, da mais frequente para a menos', () => {
    const a = agregar([
      linha({ desfecho: 'reprovada', problemas: [{ regra: 'algarismo', detalhe: 'x' }, { regra: 'contradicao', detalhe: 'y' }] }),
      linha({ desfecho: 'reprovada', problemas: [{ regra: 'algarismo', detalhe: 'z' }] }),
      linha({ desfecho: 'ok' }),
    ]);
    assert.deepEqual(a.porRegra, [
      { regra: 'algarismo', vezes: 2 },
      { regra: 'contradicao', vezes: 1 },
    ]);
  });

  it('conta a classe de cada falha, e só as falhas', () => {
    const a = agregar([
      linha({ desfecho: 'indisponivel' }),
      linha({ desfecho: 'indisponivel' }),
      linha({ desfecho: 'transitoria' }),
      linha({ desfecho: 'defeito' }),
      linha({ desfecho: 'ok' }),
      linha({ desfecho: 'reprovada' }),
      linha({ desfecho: 'template' }),
    ]);
    assert.deepEqual(a.porClasse, [
      { classe: 'indisponivel', vezes: 2 },
      { classe: 'defeito', vezes: 1 },
      { classe: 'transitoria', vezes: 1 },
    ]);
  });

  it('lista vazia agrega em zero, sem lançar', () => {
    const a = agregar([]);
    assert.equal(a.total, 0);
    assert.deepEqual(a.porCaso, []);
    assert.deepEqual(a.porRegra, []);
    assert.deepEqual(a.porClasse, []);
  });
});

/* ── o relatório ── */

describe('o relatório', () => {
  const r = relatorio([
    { motor: SEM_MODELO, linhas: [linha({ desfecho: 'template', frase: 'A duração e a regularidade empatam no ponto mais baixo.' })] },
    { motor: NUVEM_PADRAO, linhas: [linha({ desfecho: 'ok', frase: 'Nos últimos 7 dias, a duração e a regularidade ficam no ponto mais baixo.', tokens: { entrada: 310, saida: 24 } })] },
  ]);

  it('é chaveado por recurso, MotorId e build do sistema, com o manifesto', () => {
    assert.deepEqual(chaveDaColuna(r, NUVEM_PADRAO), {
      recurso: 'saude-do-sono',
      motor: NUVEM_PADRAO,
      sistema: { plataforma: 'darwin', versao: '25.6.0' },
      manifesto: MANIFESTO.hash,
    });
  });

  it('cada coluna vem com os próprios agregados', () => {
    assert.equal(r.colunas.length, 2);
    assert.equal(um(r.colunas, 0).agregados.porVeredito.template, 1);
    assert.equal(um(r.colunas, 1).agregados.porVeredito.aprovada, 1);
  });

  it('os pedidos saem por hash, ordenados — um por caso, não um por linha', () => {
    assert.equal(r.pedidos.length, 1);
    assert.equal(um(r.pedidos).hash, sha256De('um pedido'));
    assert.deepEqual(r.pedidos.map((p) => p.hash), [...r.pedidos.map((p) => p.hash)].sort());
  });
});

/* ── a comparação ── */

describe('compararRelatorios', () => {
  const linhas = [linha({ range: '7d', offset: 0 }), linha({ range: '7d', offset: 1, hashDoPedido: sha256De('outro pedido') })];

  it('duas execuções do mesmo manifesto são comparáveis, e iguais quando os hashes batem', () => {
    const c = compararRelatorios(relatorio([{ motor: SEM_MODELO, linhas }]), relatorio([{ motor: SEM_MODELO, linhas }]));
    assert.ok(c.ok);
    assert.equal(c.iguais, true);
    assert.deepEqual(c.diferencas, []);
  });

  it('hash de pedido diferente na mesma janela aparece como diferença', () => {
    const outras = [linhas[0], { ...linhas[1], hashDoPedido: sha256De('mudou') }];
    const c = compararRelatorios(relatorio([{ motor: SEM_MODELO, linhas }]), relatorio([{ motor: SEM_MODELO, linhas: outras }]));
    assert.ok(c.ok);
    assert.equal(c.iguais, false);
    assert.equal(c.diferencas.length, 1);
    assert.match(um(c.diferencas), /^sem-modelo 7d@1: /);
  });

  it('janela que existe só num lado aparece nos dois sentidos', () => {
    const c = compararRelatorios(relatorio([{ motor: SEM_MODELO, linhas }]), relatorio([{ motor: SEM_MODELO, linhas: [linhas[0]] }]));
    assert.ok(c.ok);
    assert.deepEqual(c.diferencas, ['sem-modelo 7d@1: só na primeira execução']);
    const invertido = compararRelatorios(relatorio([{ motor: SEM_MODELO, linhas: [linhas[0]] }]), relatorio([{ motor: SEM_MODELO, linhas }]));
    assert.ok(invertido.ok);
    assert.deepEqual(invertido.diferencas, ['sem-modelo 7d@1: só na segunda execução']);
  });

  it('manifesto diferente é RECUSADO, não comparado', () => {
    const outro = montarManifesto({ ...CORPO, hoje: '2026-09-09' });
    const c = compararRelatorios(relatorio([{ motor: SEM_MODELO, linhas }]), relatorio([{ motor: SEM_MODELO, linhas }], outro));
    assert.equal(c.ok, false);
    assert.ok(!c.ok);
    assert.match(c.motivo, /manifestos diferentes/);
    assert.ok(c.motivo.includes(hashCurto(MANIFESTO.hash)));
    assert.ok(c.motivo.includes(hashCurto(outro.hash)));
  });
});

/* ── o Markdown ── */

describe('relatorioEmMarkdown', () => {
  const r = relatorio([
    {
      motor: SEM_MODELO,
      linhas: [linha({ desfecho: 'template', frase: 'A duração e a regularidade empatam no ponto mais baixo.' })],
    },
    {
      motor: NUVEM_PADRAO,
      linhas: [
        linha({ desfecho: 'ok', frase: 'Nos últimos 7 dias, a duração e a regularidade ficam no ponto mais baixo.', tokens: { entrada: 310, saida: 24 } }),
        linha({
          range: '4s',
          offset: 1,
          caso: 'uma',
          desfecho: 'reprovada',
          textoDoMotor: 'A regularidade ficou 7 pontos abaixo.',
          problemas: [{ regra: 'algarismo', detalhe: 'escreveu "7"' }],
        }),
      ],
    },
  ]);
  const md = relatorioEmMarkdown(r);

  it('põe o template e a frase do motor na mesma linha — é assim que o dono julga', () => {
    const linhaDaTabela = md
      .split('\n')
      .find((l) => l.includes('Nos últimos 7 dias, a duração e a regularidade ficam'));
    assert.ok(linhaDaTabela, md.slice(0, 400));
    assert.ok(linhaDaTabela.includes('A duração e a regularidade empatam no ponto mais baixo.'), linhaDaTabela);
  });

  it('mostra o texto cru quando a conferência reprovou, e os problemas regra por regra', () => {
    assert.ok(md.includes('A regularidade ficou 7 pontos abaixo.'));
    assert.ok(md.includes('| algarismo | escreveu "7" |'));
  });

  it('traz a chave inteira no cabeçalho', () => {
    assert.ok(md.includes(MANIFESTO.hash));
    assert.ok(md.includes('darwin 25.6.0'));
    assert.ok(md.includes('2026-09-10'));
    assert.ok(md.includes('293 noites · 89 notas'));
  });

  it('não fixa limiar nenhum, e diz de quem é', () => {
    assert.ok(/limiar/i.test(md));
    assert.equal(/limiar (de|é) \d/i.test(md), false, 'o Markdown escreveu um limiar');
  });

  it('o `|` de um texto não quebra a tabela', () => {
    const comBarra = relatorio([{ motor: SEM_MODELO, linhas: [linha({ desfecho: 'template', frase: 'a | b', template: 'c | d' })] }]);
    const saida = relatorioEmMarkdown(comBarra);
    assert.ok(saida.includes('a \\| b'));
    assert.ok(saida.includes('c \\| d'));
  });

  it('uma coluna sem linha nenhuma não lança', () => {
    assert.ok(relatorioEmMarkdown(relatorio([{ motor: SEM_MODELO, linhas: [] }])).length > 0);
  });
});

/* ── o digest fixado ── */

describe('o digest do manifesto, contra vetor fixo', () => {
  /**
   * Um corpo fixo e o digest dele, escrito à mão — no molde de `ia/sha256.test.ts`.
   *
   * Sem isto, todos os testes do manifesto comparam o hash **contra ele mesmo**:
   * tirar o `.sort()` do `canonico` passaria verde, e dois manifestos iguais em
   * conteúdo deixariam de se reconhecer sem nada acusar. Se este número mudar, a
   * forma canônica mudou — e todo manifesto já gravado deixou de ser comparável.
   */
  const CORPO_FIXO: CorpoDoManifesto = {
    recurso: 'saude-do-sono',
    versaoDoDescritor: 1,
    hoje: '2026-09-10',
    acervo: {
      noites: { arquivo: 'sleep_periods.json', linhas: 293, sha256: 'a'.repeat(64) },
      notas: { arquivo: 'daily_ratings.json', linhas: 89, sha256: 'b'.repeat(64) },
      sha256: 'c'.repeat(64),
    },
    janelas: [
      { range: '7d', passos: 73 },
      { range: '4s', passos: 19 },
      { range: '12m', passos: 2 },
      { range: 'ultima', passos: 293 },
    ],
    amostra: { regra: 'recentes-por-caso-e-alcance', versaoDaRegra: 1, limite: 2, janelas: 22 },
    motores: ['nuvem:padrao', SEM_MODELO],
  };
  const VETOR = 'ed69dd7390ceba79d33e8d728dd3cad5b2e738eb9de7afd4694d19dc8a46d8ec';

  it('o corpo fixo dá o digest fixo', () => {
    assert.equal(montarManifesto(CORPO_FIXO).hash, VETOR);
  });

  it('o sha256 do módulo é o sha256 de verdade', () => {
    assert.equal(sha256De(''), 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
    assert.equal(sha256De('abc'), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });

  it('a ordem das bandeiras não muda o hash — os motores entram ordenados', () => {
    const aoContrario = montarManifesto({ ...CORPO_FIXO, motores: [SEM_MODELO, 'nuvem:padrao'] });
    assert.equal(aoContrario.hash, VETOR);
    assert.deepEqual(aoContrario.motores, ['nuvem:padrao', SEM_MODELO]);
  });

  it('`hashDoCorpo` recalcula o que `montarManifesto` gravou', () => {
    const m = montarManifesto(CORPO_FIXO);
    assert.equal(hashDoCorpo(corpoDoManifesto(m)), m.hash);
  });

  it('a prosa da regra de amostra NÃO entra no hash — só o id e a versão', () => {
    // Reescrever a frase que descreve a regra não pode invalidar manifesto nenhum.
    assert.ok(REGRAS_DE_AMOSTRA['recentes-por-caso-e-alcance'].length > 0);
    assert.equal(JSON.stringify(corpoDoManifesto(montarManifesto(CORPO_FIXO))).includes('as mais recentes'), false);
    // Mas mudar a VERSÃO da regra invalida, que é o papel dela.
    assert.notEqual(montarManifesto({ ...CORPO_FIXO, amostra: { ...CORPO_FIXO.amostra, versaoDaRegra: 2 } }).hash, VETOR);
  });
});

describe('o manifesto versionado, no disco', () => {
  const CAMINHO = join(__dirname, 'manifesto.json');

  it('existe, e o hash dele fecha com o corpo dele', () => {
    // A linha de base versionada tem de ser coerente: se alguém a editar à mão, ou se
    // a forma canônica mudar, é aqui que se descobre — não numa comparação recusada.
    const bruto = JSON.parse(readFileSync(CAMINHO, 'utf8')) as Record<string, unknown> & { hash: string };
    const corpo: CorpoDoManifesto = {
      recurso: bruto['recurso'] as CorpoDoManifesto['recurso'],
      versaoDoDescritor: bruto['versaoDoDescritor'] as number,
      hoje: bruto['hoje'] as string,
      acervo: bruto['acervo'] as CorpoDoManifesto['acervo'],
      janelas: bruto['janelas'] as CorpoDoManifesto['janelas'],
      amostra: bruto['amostra'] as CorpoDoManifesto['amostra'],
      motores: bruto['motores'] as CorpoDoManifesto['motores'],
    };
    assert.equal(hashDoCorpo(corpo), bruto.hash, 'o manifesto versionado não fecha com o próprio corpo');
  });

  it('diz o que é, no próprio arquivo — e não carrega dado de saúde', () => {
    const texto = readFileSync(CAMINHO, 'utf8');
    const bruto = JSON.parse(texto) as { _leia?: unknown };
    assert.ok(Array.isArray(bruto._leia) && bruto._leia.length > 0, 'o manifesto versionado não diz o que é');
    for (const proibido of ['asleepH', 'wakeDay', 'onsetAt', 'awakenings', 'sleepQuality']) {
      assert.equal(texto.includes(proibido), false, `${proibido} apareceu no manifesto versionado`);
    }
  });
});

describe('a ordem dos casos', () => {
  it('é a do núcleo, caso a caso — um caso novo lá derruba isto', () => {
    assert.deepEqual([...ORDEM_DOS_CASOS], [...CASOS_DA_SAUDE]);
  });

  it('o fecho sai nessa ordem, qualquer que seja a ordem das linhas', () => {
    const linhas = [...CASOS_DA_SAUDE].reverse().map((caso) => linha({ caso }));
    assert.deepEqual(agregar(linhas).porCaso.map((c) => c.caso), [...ORDEM_DOS_CASOS]);
  });

  it('um caso fora da lista aparece no fim, em vez de desaparecer', () => {
    const a = agregar([linha({ caso: 'duas' }), linha({ caso: 'inventado' as never })]);
    assert.deepEqual(a.porCaso.map((c) => c.caso), ['duas', 'inventado']);
  });
});

describe('porRegra só conta reprovação', () => {
  it('ressalva em linha aprovada ou em recusa não entra como reprovação', () => {
    const a = agregar([
      linha({ desfecho: 'ok', problemas: [{ regra: 'forma', detalhe: 'uma ressalva' }] }),
      linha({ desfecho: 'recusa-do-modelo', problemas: [{ regra: 'recusa', detalhe: 'desculpe' }] }),
      linha({ desfecho: 'reprovada', problemas: [{ regra: 'algarismo', detalhe: 'escreveu 7' }] }),
    ]);
    assert.deepEqual(a.porRegra, [{ regra: 'algarismo', vezes: 1 }]);
  });
});

/* ── o Markdown, o que o dono de fato lê ── */

describe('o Markdown diz o que é cada coisa', () => {
  const aprovada = linha({
    desfecho: 'ok',
    textoDoMotor: 'A duração e a regularidade ficam no ponto mais baixo {quando}.',
    frase: 'A duração e a regularidade ficam no ponto mais baixo nos últimos 7 dias.',
  });
  const sintetica = linha({ range: '4s', offset: 2, desfecho: 'indisponivel', sintetica: true, detalhe: 'o hospedeiro não entregou este motor' });
  const deRede = linha({ range: '4s', offset: 3, desfecho: 'indisponivel', detalhe: 'HTTP 503' });
  const comDefeito = linha({ range: '12m', offset: 1, desfecho: 'defeito', detalhe: 'RangeError: cobertura incoerente', pilha: 'RangeError: cobertura incoerente\n    at porcentagem (leitura.ts:321)' });
  const md = relatorioEmMarkdown(relatorio([{ motor: NUVEM_PADRAO, linhas: [aprovada, sintetica, deRede, comDefeito] }]));

  it('mostra o CRU do motor ao lado da frase final, também na linha aprovada', () => {
    // É no cru que a paráfrase e o sinônimo que a conferência não pega se escondem.
    const l = md.split('\n').find((x) => x.includes('{quando}'));
    assert.ok(l, 'o texto cru não apareceu na linha aprovada');
    assert.ok(l.includes('nos últimos 7 dias'), 'a frase final não está na mesma linha do cru');
    assert.ok(l.includes(aprovada.template), 'o template não está na mesma linha');
    // E o cabeçalho diz qual coluna é qual.
    assert.ok(md.includes('| template (piso) | cru do motor | frase final |'), md.slice(0, 200));
  });

  it('marca a linha sintética — "nenhuma chamada saiu" não é um indisponivel de rede', () => {
    const daSintetica = md.split('\n').find((x) => x.startsWith('| 4s ◀2 '));
    const daRede = md.split('\n').find((x) => x.startsWith('| 4s ◀3 '));
    assert.ok(daSintetica?.includes('indisponivel (sintética)'), daSintetica);
    assert.ok(daRede?.includes('| indisponivel |'), daRede);
    assert.equal(daRede?.includes('sintética'), false);
  });

  it('leva a pilha do defeito para o Markdown, não só para o JSON', () => {
    assert.ok(md.includes('### Os defeitos, com a pilha'));
    assert.ok(md.includes('at porcentagem (leitura.ts:321)'));
  });

  it('avisa, no cabeçalho, que o arquivo carrega dado de saúde', () => {
    const cabecalho = md.slice(0, md.indexOf('## Coluna'));
    assert.match(cabecalho, /dado de saúde/i);
    assert.match(cabecalho, /não versionar|não versione/i);
  });

  it('o rodapé diz quais alcances NÃO foram medidos, e por quê', () => {
    assert.match(md, /`ano`/);
    assert.match(md, /dois anos parciais/);
    assert.match(md, /a bancada mede quatro/);
  });
});

describe('a cerca do bloco de código é dinâmica', () => {
  it('crases dentro do pedido não fecham a cerca e não viram prosa', () => {
    const comCrases = 'Caso: use ``` e ```` assim, e `um` só.';
    const r = montarRelatorio({
      recurso: 'saude-do-sono',
      sistema: { plataforma: 'darwin', versao: '25.6.0' },
      manifesto: MANIFESTO,
      geradoEm: '2026-09-12T10:00:00.000Z',
      pedidos: { [sha256De('um pedido')]: { sistema: 'as regras', usuario: comCrases } },
      colunas: [{ motor: SEM_MODELO, linhas: [linha({ desfecho: 'template' })] }],
    });
    const md = relatorioEmMarkdown(r);
    assert.ok(md.includes(comCrases), 'o pedido não saiu inteiro');
    // A cerca tem de ser MAIOR que a maior sequência de crases do texto (4 → 5).
    assert.ok(md.includes('`````'), 'a cerca não cresceu além das crases do pedido');
    // E o que vem depois do bloco continua sendo Markdown.
    assert.match(md, /## Os alcances/);
  });
});

describe('o `sistema` do pedido não é afirmado sem conferir', () => {
  const doisPedidos = (s1: string, s2: string) =>
    montarRelatorio({
      recurso: 'saude-do-sono',
      sistema: { plataforma: 'darwin', versao: '25.6.0' },
      manifesto: MANIFESTO,
      geradoEm: '2026-09-12T10:00:00.000Z',
      pedidos: { a: { sistema: s1, usuario: 'caso um' }, b: { sistema: s2, usuario: 'caso dois' } },
      colunas: [{ motor: SEM_MODELO, linhas: [linha({ desfecho: 'template' })] }],
    });

  it('um só: diz que é um só, conferido', () => {
    const md = relatorioEmMarkdown(doisPedidos('as regras', 'as regras'));
    assert.match(md, /um só, conferido/);
    assert.equal(md.includes('distintos'), false);
  });

  it('mais de um: conta e mostra cada um, em vez de mentir', () => {
    const md = relatorioEmMarkdown(doisPedidos('as regras', 'OUTRAS regras'));
    assert.match(md, /Os 2 `sistema` distintos/);
    assert.ok(md.includes('as regras') && md.includes('OUTRAS regras'));
    assert.equal(md.includes('um só, conferido'), false);
  });
});
