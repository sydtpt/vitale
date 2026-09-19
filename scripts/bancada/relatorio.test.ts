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
import { APARELHO_SISTEMA, CASOS_DA_SAUDE, NUVEM_PADRAO, SEM_MODELO, type MotorId } from '@vitale/shared';
import {
  ORDEM_DOS_CASOS,
  REGRAS_DE_AMOSTRA,
  REGRA_DA_COPIA,
  VEREDITOS,
  agregar,
  copiaDoExemplo,
  formaDaAprovada,
  foraDaMedida,
  mediana,
  medidasDoPortao,
  resumoDaSonda,
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
  type LinhaDaSonda,
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

/* ── a coluna do aparelho, as quatro medidas e a sonda (story 5.10) ── */

const ASSINATURA_DO_APARELHO = {
  tipo: 'aparelho',
  provedor: 'prov-a',
  modelo: 'modelo-do-sistema',
  plataforma: 'macOS 27.0',
  buildDoSistema: '26A428',
} as const;

function linhaDaSonda(p: Partial<LinhaDaSonda> = {}): LinhaDaSonda {
  return {
    range: '7d',
    offset: 0,
    alcance: 'periodo',
    caso: 'uma',
    hashDoPedido: sha256De('o pedido da sonda'),
    desfecho: 'ok',
    ms: 900,
    esperado: ['horario'],
    opcoes: ['duracao', 'horario', 'percepcao'],
    escolha: 'horario',
    ...p,
  };
}

/** A linha sem a escolha — a muda não tem resposta a ler. */
function semEscolha(l: LinhaDaSonda): LinhaDaSonda {
  const { escolha: _escolha, ...resto } = l;
  return resto;
}

describe('mediana', () => {
  it('ímpar é o do meio; par, a média dos dois do meio; vazia, nula', () => {
    assert.equal(mediana([3, 1, 2]), 2);
    assert.equal(mediana([4, 1, 3, 2]), 2.5);
    assert.equal(mediana([]), null);
    assert.equal(mediana([7]), 7);
  });
});

describe('a janela medida — uma regra só', () => {
  it('entra a que chegou ao modelo; fica fora, por motivo e nesta ordem, a que não chegou ou foi do hospedeiro', () => {
    assert.equal(foraDaMedida(linha({ desfecho: 'ok' })), null);
    assert.equal(foraDaMedida(linha({ desfecho: 'reprovada' })), null);
    assert.equal(foraDaMedida(linha({ desfecho: 'transitoria' })), null, 'a transitória do motor é medida');
    assert.equal(foraDaMedida(linha({ desfecho: 'ok', frio: true })), null, 'a fria é medida — só sai da mediana');
    assert.equal(foraDaMedida(linha({ desfecho: 'template' })), 'semChamada');
    assert.equal(foraDaMedida(linha({ desfecho: 'mudo' })), 'semChamada');
    assert.equal(foraDaMedida(linha({ desfecho: 'indisponivel', sintetica: true })), 'sintetica');
    assert.equal(foraDaMedida(linha({ desfecho: 'defeito' })), 'defeito');
    assert.equal(foraDaMedida(linha({ desfecho: 'indisponivel' })), 'indisponivel');
    assert.equal(foraDaMedida(linha({ desfecho: 'transitoria', doHospedeiro: true })), 'doHospedeiro');
  });
});

describe('as quatro medidas da ADR 0050', () => {
  const linhas = [
    linha({ caso: 'uma', alcance: 'noite', range: 'ultima', desfecho: 'ok', ms: 9000, frio: true, frase: 'Uma frase nova.' }),
    linha({ caso: 'uma', alcance: 'periodo', desfecho: 'ok', ms: 3000, frase: 'A duração e a regularidade empatam no ponto mais baixo.' }),
    linha({ caso: 'duas', alcance: 'periodo', desfecho: 'reprovada', ms: 5000 }),
    linha({ caso: 'duas', alcance: 'periodo', desfecho: 'indisponivel', ms: 0, sintetica: true }),
    linha({ caso: 'duas', alcance: 'periodo', desfecho: 'defeito', ms: 0 }),
    linha({ caso: 'duas', alcance: 'periodo', desfecho: 'indisponivel', ms: 40, detalhe: 'modelNotReady' }),
    linha({ caso: 'duas', alcance: 'periodo', desfecho: 'transitoria', ms: 60_000, doHospedeiro: true }),
    linha({ caso: 'duas', alcance: 'noite', range: 'ultima', desfecho: 'transitoria', ms: 7000 }),
  ];
  const m = medidasDoPortao(linhas);

  it('aprovação: ok sobre as MEDIDAS — e o que ficou fora, contado à parte', () => {
    assert.equal(m.janelas, 8);
    assert.equal(m.medidas, 4);
    assert.equal(m.aprovadas, 2);
    assert.deepEqual(m.foraDaMedida, { semChamada: 0, sintetica: 1, defeito: 1, indisponivel: 1, doHospedeiro: 1 });
    // A soma fecha: nada some da conta.
    assert.equal(m.medidas + Object.values(m.foraDaMedida).reduce((a, b) => a + b, 0), m.janelas);
  });

  it('cobertura: a presença na amostra e as aprovadas, noite e período separados', () => {
    assert.deepEqual(m.cobertura.map((c) => c.caso), [...ORDEM_DOS_CASOS]);
    assert.deepEqual(m.cobertura.find((c) => c.caso === 'uma'), {
      caso: 'uma',
      noite: { amostra: 1, aprovadas: 1 },
      periodo: { amostra: 1, aprovadas: 1 },
    });
    assert.deepEqual(m.cobertura.find((c) => c.caso === 'duas'), {
      caso: 'duas',
      noite: { amostra: 1, aprovadas: 0 },
      periodo: { amostra: 5, aprovadas: 0 },
    });
  });

  it('idênticas: a aprovada cuja frase é a do template', () => {
    assert.equal(m.identicasAoTemplate, 1);
  });

  it('mediana: das medidas não frias — e a fria é contada, não escondida', () => {
    assert.equal(m.frias, 1);
    assert.equal(m.naMediana, 3);
    assert.equal(m.medianaMs, 5000, 'a mediana leu a fria, o defeito, a sintética ou a falha do hospedeiro');
  });

  it('não carrega limiar nem veredito — só números', () => {
    assert.deepEqual(Object.keys(m).sort(), [
      'aprovadas', 'cobertura', 'foraDaMedida', 'frias', 'identicasAoTemplate', 'janelas', 'medianaMs', 'medidas', 'naMediana',
    ]);
  });
});

describe('o resumo da sonda', () => {
  const linhas = [
    linhaDaSonda({ desfecho: 'ok' }),
    linhaDaSonda({ desfecho: 'reprovada', escolha: 'duracao', problemas: [{ regra: 'escolha', detalhe: 'x' }] }),
    linhaDaSonda({ desfecho: 'reprovada', escolha: 'regularidade', problemas: [{ regra: 'fora-das-opcoes', detalhe: 'x' }] }),
    linhaDaSonda({ desfecho: 'saida-invalida', escolha: undefined as never }),
    linhaDaSonda({ desfecho: 'indisponivel', sintetica: true }),
    linhaDaSonda({ desfecho: 'defeito', pilha: 'Error: x' }),
    linhaDaSonda({ desfecho: 'recusa-do-modelo' }),
    semEscolha(linhaDaSonda({ caso: 'tudo-no-maximo', desfecho: 'mudo', ms: 0, esperado: [], opcoes: [] })),
    linhaDaSonda({ desfecho: 'ok', esperado: ['duracao', 'horario'], opcoes: ['duracao', 'horario', 'percepcao', 'continuidade'] }),
  ];
  const r = resumoDaSonda(linhas);

  it('fecha a soma — nada some, nem o defeito', () => {
    const falhas = r.falhas.reduce((n, f) => n + f.vezes, 0);
    assert.equal(r.acertos + r.escolhaErrada + r.foraDasOpcoes + r.outraReprovacao + r.recusas + falhas + r.defeitos, r.perguntadas);
    assert.equal(r.perguntadas + r.mudas, r.janelas);
    assert.equal(r.defeitos, 1);
  });

  it('separa a escolha errada da escolha fora das opções', () => {
    assert.equal(r.escolhaErrada, 1);
    assert.equal(r.foraDasOpcoes, 1);
    assert.equal(r.outraReprovacao, 0);
  });

  it('o acerto ao acaso: |nomeadas| ÷ |opções|, somado sobre as perguntas medidas', () => {
    // Medidas: ok (1/3), escolha (1/3), fora (1/3), saída inválida (1/3), recusa (1/3), ok (2/4).
    // Fora: a sintética e o defeito.
    assert.equal(r.medidas, 6);
    assert.ok(Math.abs(r.acertoAoAcaso - (5 / 3 + 2 / 4)) < 1e-9, String(r.acertoAoAcaso));
  });
});

describe('o relatório da coluna de modelo', () => {
  const doAparelho = [
    linha({ desfecho: 'ok', frase: 'Nos últimos 7 dias, a duração fica abaixo.', assinatura: ASSINATURA_DO_APARELHO, ms: 3900, frio: true }),
    linha({ range: '7d', offset: 1, desfecho: 'reprovada', ms: 1500, assinatura: ASSINATURA_DO_APARELHO }),
    linha({ range: '7d', offset: 2, desfecho: 'reprovada', ms: 2500, assinatura: ASSINATURA_DO_APARELHO }),
    // O aparelho fora não é medida: o motor não atendia.
    linha({ range: '4s', offset: 0, desfecho: 'indisponivel', ms: 100, detalhe: 'modelo do sistema indisponível: modelNotReady' }),
  ];
  const sonda = [
    linhaDaSonda({ assinatura: ASSINATURA_DO_APARELHO }),
    linhaDaSonda({
      range: '4s',
      desfecho: 'reprovada',
      escolha: 'duracao',
      esperado: ['horario'],
      problemas: [{ regra: 'escolha', detalhe: 'escolheu duracao; o código nomeia horario (uma)' }],
    }),
    semEscolha(linhaDaSonda({ range: '12m', caso: 'tudo-no-maximo', desfecho: 'mudo', ms: 0, esperado: [], hashDoPedido: '(sem pedido)' })),
  ];
  const comSonda = montarManifesto({ ...CORPO, motores: [SEM_MODELO, APARELHO_SISTEMA], sonda: { versaoDoDescritor: 1 } });
  const r = montarRelatorio({
    recurso: 'saude-do-sono',
    sistema: { plataforma: 'darwin', versao: '27.0.0' },
    manifesto: comSonda,
    geradoEm: '2026-09-19T10:00:00.000Z',
    pedidos: {
      [sha256De('um pedido')]: { sistema: 'as regras', usuario: 'o caso' },
      [sha256De('o pedido da sonda')]: { sistema: 'escolha', usuario: 'Pergunta: …' },
    },
    colunas: [
      { motor: SEM_MODELO, linhas: [linha({ desfecho: 'template', frase: 'x' })] },
      { motor: APARELHO_SISTEMA, linhas: doAparelho, sonda, compilador: 'Apple Swift version 6.4 (swiftlang-6.4.0.34.1)' },
    ],
  });
  const md = relatorioEmMarkdown(r);

  it('a régua não tem medidas nem sonda; a coluna de modelo tem as duas', () => {
    const [regua, aparelho] = r.colunas;
    assert.equal(regua?.medidas, undefined);
    assert.equal(regua?.sonda, undefined);
    assert.ok(aparelho?.medidas);
    assert.equal(aparelho?.sonda?.linhas.length, 3);
    assert.equal(aparelho?.sonda?.agregados.porVeredito.mudo, 1);
  });

  it('diz quem assinou, com a plataforma e o build do sistema', () => {
    assert.deepEqual(r.colunas[1]?.assinaturas, [{ ...ASSINATURA_DO_APARELHO, leitura: 3, sonda: 1 }]);
    assert.ok(md.includes('### Quem respondeu'));
    assert.ok(md.includes('| aparelho | prov-a | modelo-do-sistema | macOS 27.0 | 26A428 | 3 | 1 |'), md);
  });

  it('a coluna do aparelho diz qual swiftc compilou a CLI', () => {
    assert.equal(r.colunas[1]?.compilador, 'Apple Swift version 6.4 (swiftlang-6.4.0.34.1)');
    assert.ok(md.includes('compilada por: `Apple Swift version 6.4 (swiftlang-6.4.0.34.1)`'), md);
  });

  it('mais de uma assinatura na coluna é dita — versões diferentes não se somam', () => {
    const outra = montarRelatorio({
      recurso: 'saude-do-sono',
      sistema: { plataforma: 'darwin', versao: '27.0.0' },
      manifesto: MANIFESTO,
      geradoEm: '2026-09-19T10:00:00.000Z',
      pedidos: {},
      colunas: [
        {
          motor: APARELHO_SISTEMA,
          linhas: [
            linha({ assinatura: ASSINATURA_DO_APARELHO }),
            linha({ offset: 1, assinatura: { ...ASSINATURA_DO_APARELHO, buildDoSistema: '26A500' } }),
          ],
        },
      ],
    });
    assert.equal(outra.colunas[0]?.assinaturas?.length, 2);
    assert.match(relatorioEmMarkdown(outra), /Mais de uma assinatura/);
  });

  it('as quatro medidas saem com os números e sem régua', () => {
    const inicio = md.indexOf('### As quatro medidas da ADR 0050');
    assert.ok(inicio >= 0, 'a seção das medidas não saiu');
    const secao = md.slice(inicio, md.indexOf('### O fecho, por caso', inicio));
    assert.match(secao, /sem limiar e sem veredito/);
    // A regra da janela medida, escrita ao lado dos números.
    assert.ok(secao.includes('Janela medida é a tentativa que chegou ao modelo'), secao);
    assert.ok(secao.includes('| medidas (chegaram ao modelo) | 3 — fora da medida: 1 indisponíveis |'), secao);
    assert.ok(secao.includes('| aprovação (`ok` ÷ medidas) | 1 de 3 (33,3%) |'), secao);
    assert.ok(secao.includes('| aprovadas idênticas ao template | 0 de 1 |'), secao);
    assert.ok(secao.includes('| mediana do tempo por chamada | 2,0 s (2 medidas; 1 fria ficou de fora) |'), secao);
    assert.match(secao, /sem janela: sem-contagem\/noite/);
    assert.ok(secao.includes('| duas | 0 | 0 | 4 | 1 |'), secao);
    assert.ok(secao.includes('| caso | noite: na amostra | noite: aprovadas | período: na amostra | período: aprovadas |'), secao);
    // Nenhum número de corte, nenhuma comparação com ele.
    assert.equal(/[≥≤]|\bpassou\b|\breprovou no portão\b|limiar (de|é) \d/i.test(secao), false, secao);
  });

  it('a sonda sai com a escolha e o que o código nomeia, lado a lado — e a muda fica fora da tabela', () => {
    const inicio = md.indexOf('### A sonda de fidelidade');
    assert.ok(inicio >= 0, 'a seção da sonda não saiu');
    const secao = md.slice(inicio);
    assert.match(secao, /Janelas: 3 = 2 perguntadas \+ 1 mudas\./);
    assert.match(secao, /no que o código nomeia 1 · escolha errada 1 · fora das opções 0 · outra reprovação 0 · recusa 0 · falha 0 · defeito 0\./);
    assert.match(secao, /Acertos entre as medidas: 1 de 2; ao acaso, o esperado seria 0,7/);
    assert.ok(
      secao.includes('| 4s | uma | periodo | reprovada | 900 | duracao, horario, percepcao | duracao | horario | escolha: escolheu duracao; o código nomeia horario (uma) |'),
      secao,
    );
    assert.equal(secao.includes('| 12m | tudo-no-maximo'), false, 'a linha muda entrou na tabela');
  });

  it('o cabeçalho diz que a sonda rodou, e os pedidos dela aparecem marcados', () => {
    assert.ok(md.includes('| sonda de fidelidade | descritor v1, em cada coluna de modelo |'));
    assert.match(md, /### `[0-9a-f]{12}` — 2 linhas · uma\/periodo \(sonda\)/);
  });
});

describe('o manifesto com a sonda', () => {
  it('sem sonda, o hash de antes — a chave nem aparece no corpo', () => {
    assert.equal('sonda' in corpoDoManifesto(MANIFESTO), false);
    assert.equal(montarManifesto({ ...CORPO }).hash, MANIFESTO.hash);
  });

  it('com sonda, outro hash — e a versão do descritor dela conta', () => {
    const v1 = montarManifesto({ ...CORPO, sonda: { versaoDoDescritor: 1 } });
    const v2 = montarManifesto({ ...CORPO, sonda: { versaoDoDescritor: 2 } });
    assert.notEqual(v1.hash, MANIFESTO.hash);
    assert.notEqual(v1.hash, v2.hash);
    assert.equal(hashDoCorpo(corpoDoManifesto(v1)), v1.hash);
  });
});

describe('compararRelatorios com a sonda', () => {
  const comSonda = montarManifesto({ ...CORPO, sonda: { versaoDoDescritor: 1 } });
  const rel = (hashDaSonda: string) =>
    montarRelatorio({
      recurso: 'saude-do-sono',
      sistema: { plataforma: 'darwin', versao: '27.0.0' },
      manifesto: comSonda,
      geradoEm: '2026-09-19T10:00:00.000Z',
      pedidos: {},
      colunas: [{ motor: APARELHO_SISTEMA, linhas: [linha()], sonda: [linhaDaSonda({ hashDoPedido: hashDaSonda })] }],
    });

  it('o pedido da sonda também tem de repetir o hash', () => {
    const iguais = compararRelatorios(rel(sha256De('s')), rel(sha256De('s')));
    assert.ok(iguais.ok && iguais.iguais);
    const diferentes = compararRelatorios(rel(sha256De('s')), rel(sha256De('outro')));
    assert.ok(diferentes.ok);
    assert.deepEqual(
      diferentes.diferencas.map((d) => d.split(':').slice(0, 2).join(':')),
      [`${APARELHO_SISTEMA} sonda 7d@0`],
    );
  });
});

/* ── a cópia do exemplo (story 5.11) ── */

const EXEMPLO = '{quando}, a regularidade ficou abaixo das outras dimensões: {regularidade}.';

describe('a cópia do exemplo do pedido', () => {
  it('a forma de uma aprovada, pela regra escrita no relatório', () => {
    const casos: readonly (readonly [string, ReturnType<typeof formaDaAprovada>])[] = [
      [EXEMPLO, 'identica'],
      [`  ${EXEMPLO}\n`, 'identica'],
      // A pontuação não conta.
      ['{quando} a regularidade ficou abaixo das outras dimensões {regularidade}.', 'quase'],
      // Uma palavra trocada, tirada ou posta.
      ['{quando}, a regularidade está abaixo das outras dimensões: {regularidade}.', 'quase'],
      ['{quando}, a regularidade ficou abaixo das dimensões: {regularidade}.', 'quase'],
      ['{quando}, a regularidade ficou bem abaixo das outras dimensões: {regularidade}.', 'quase'],
      // O exemplo cortado no fim.
      ['{quando}, a regularidade ficou abaixo das outras dimensões.', 'quase'],
      // Duas palavras de diferença já é texto próprio.
      ['{quando}, a regularidade segue abaixo das demais dimensões: {regularidade}.', 'propria'],
      ['A regularidade ficou abaixo das outras dimensões {quando}: {regularidade}.', 'propria'],
      // Maiúscula conta como diferença: uma palavra só, então quase.
      ['{quando}, A regularidade ficou abaixo das outras dimensões: {regularidade}.', 'quase'],
    ];
    for (const [texto, esperado] of casos) assert.equal(formaDaAprovada(texto, EXEMPLO), esperado, texto);
    // Sem exemplo, ou sem texto: nunca um palpite.
    assert.equal(formaDaAprovada(EXEMPLO, undefined), 'semExemplo');
    assert.equal(formaDaAprovada(undefined, EXEMPLO), 'semExemplo');
    assert.equal(formaDaAprovada(EXEMPLO, '   '), 'semExemplo');
    // O texto vazio não é "o exemplo cortado".
    assert.equal(formaDaAprovada('', EXEMPLO), 'propria');
  });

  it('conta só as aprovadas medidas, e a soma fecha', () => {
    const linhas = [
      linha({ desfecho: 'ok', textoDoMotor: EXEMPLO, exemplo: EXEMPLO }),
      linha({ offset: 1, desfecho: 'ok', textoDoMotor: '{quando} a regularidade ficou abaixo das outras dimensões {regularidade}.', exemplo: EXEMPLO }),
      linha({ offset: 2, desfecho: 'ok', textoDoMotor: 'A regularidade ficou abaixo das outras {quando}.', exemplo: EXEMPLO }),
      linha({ offset: 3, desfecho: 'ok', textoDoMotor: EXEMPLO }), // relatório de antes da 5.11
      // Não contam: reprovada com o exemplo, e a aprovada fora da medida.
      linha({ offset: 4, desfecho: 'reprovada', textoDoMotor: EXEMPLO, exemplo: EXEMPLO }),
      linha({ offset: 5, desfecho: 'ok', textoDoMotor: EXEMPLO, exemplo: EXEMPLO, doHospedeiro: true }),
    ];
    const c = copiaDoExemplo(linhas);
    assert.deepEqual(c, { aprovadas: 4, identicas: 1, quase: 1, proprias: 1, semExemplo: 1 });
    assert.equal(c.identicas + c.quase + c.proprias + c.semExemplo, c.aprovadas);
    assert.equal(c.aprovadas, medidasDoPortao(linhas).aprovadas, 'a cópia conta outras aprovadas que as da aprovação');
  });

  it('sai na coluna de modelo, com a regra ao lado e sem régua — e na tabela das linhas', () => {
    const r = montarRelatorio({
      recurso: 'saude-do-sono',
      sistema: { plataforma: 'darwin', versao: '27.0.0' },
      manifesto: MANIFESTO,
      geradoEm: '2026-09-19T10:00:00.000Z',
      pedidos: { [sha256De('um pedido')]: { sistema: 'as regras', usuario: 'o caso' } },
      colunas: [
        { motor: SEM_MODELO, linhas: [linha({ desfecho: 'template', frase: 'x' })] },
        {
          motor: NUVEM_PADRAO,
          linhas: [
            linha({ desfecho: 'ok', textoDoMotor: EXEMPLO, exemplo: EXEMPLO, frase: 'a frase' }),
            linha({ offset: 1, desfecho: 'ok', textoDoMotor: 'A regularidade, sozinha, ficou abaixo {quando}.', exemplo: EXEMPLO, frase: 'outra' }),
          ],
        },
      ],
    });
    assert.equal(r.colunas[0]?.copia, undefined, 'a régua não copia exemplo nenhum');
    assert.deepEqual(r.colunas[1]?.copia, { aprovadas: 2, identicas: 1, quase: 0, proprias: 1, semExemplo: 0 });
    const md = relatorioEmMarkdown(r);
    const inicio = md.indexOf('### A cópia do exemplo do pedido');
    assert.ok(inicio >= 0, 'a seção da cópia não saiu');
    const secao = md.slice(inicio, md.indexOf('### O fecho, por caso', inicio));
    assert.ok(secao.includes(REGRA_DA_COPIA), secao);
    assert.match(secao, /sem limiar e sem veredito/);
    assert.ok(secao.includes('| idênticas ao exemplo | 1 de 2 (50,0%) |'), secao);
    assert.ok(secao.includes('| quase o exemplo | 0 de 2 (0,0%) |'), secao);
    assert.ok(secao.includes('| texto próprio | 1 de 2 (50,0%) |'), secao);
    assert.ok(!secao.includes('sem exemplo para comparar'), secao);
    assert.equal(/[≥≤]|\bpassou\b|limiar (de|é) \d/i.test(secao), false, secao);
    // A linha que a conta contou aparece marcada na tabela.
    assert.ok(md.includes('| ok · idêntica ao exemplo |'), md);
  });
});
