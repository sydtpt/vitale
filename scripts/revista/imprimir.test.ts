/**
 * O script que imprime a edição fora do telefone (Story 2.2).
 *
 * **O caminho de verdade, sem rede.** A nuvem é `motoresDaBancada` — o ponto de
 * injeção da bancada, o mesmo do executável — com a chamada HTTP falsa, que responde
 * pelo transporte da fixture do núcleo. O banco é o da fixture: as nove leituras, as
 * atividades, a edição e o `rpc` passam por `data/` como em produção, e
 * `portasDaEdicao` grava nele. O resultado tem de bater o `GABARITO` — o **mesmo** que
 * o núcleo e o celular cobram (`packages/shared/src/period/__tests__/contrato-da-edicao.ts`).
 *
 * Depois, a matriz da spec: o período já impresso, o `--sem-gravar`, o período
 * inválido, a credencial que falta, o reprovado e a impressão concorrente.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { EdicaoMudouNaImpressao, hashCurto, type CadernoId, type CorpoDoPedido } from '@vitale/shared';
import {
  AGORA,
  GABARITO,
  INICIO,
  TEXTOS,
  TIPO,
  USUARIO,
  bancoFalso,
  cadernoDoCorpo,
  cadernoImpressoDeMaio,
  transporteDaFixture,
  type BancoFalso,
} from '../../packages/shared/src/period/__tests__/contrato-da-edicao.ts';
import { motoresDaBancada, type Buscar } from '../bancada/motores.ts';
import type { Sessao } from '../bancada/supabase.ts';
import {
  ajuda,
  gruposDaImpressao,
  imprimirPeriodo,
  lerBandeiras,
  principal,
  problemaDoFuso,
  validarPeriodo,
  type Processo,
} from './imprimir.ts';

/* ── o hospedeiro falso ──────────────────────────────────────────────────── */

const PROJETO = 'https://projeto.supabase.co';
const SESSAO_DA_NUVEM = { url: PROJETO, tokenAtual: async () => 'jwt-do-usuario', chaveAnonima: 'chave-anonima' };

/**
 * A chamada HTTP da nuvem, falsa: lê o corpo que o transporte da bancada montou e
 * responde pelo transporte da fixture — um 200 da function por caderno. `texto`
 * troca o que a nuvem escreve (para reprovar todos); `aoPedir`, o que acontece no
 * meio (outro hospedeiro gravando).
 */
function nuvemFalsa(o: { texto?: (c: CadernoId | null) => string; aoPedir?: (c: CadernoId | null) => void } = {}) {
  const pedidos: (CadernoId | null)[] = [];
  const transporte = transporteDaFixture({
    aoPedir: (c) => {
      pedidos.push(c);
      o.aoPedir?.(c);
    },
  });
  const buscar: Buscar = async (_url, init) => {
    const corpo = JSON.parse(init.body) as CorpoDoPedido;
    const r = await transporte(corpo);
    if (!('status' in r)) throw new Error('a fixture não simula falta de rede');
    const resposta = o.texto ? { ...(r.corpo as Record<string, unknown>), texto: o.texto(cadernoDoCorpo(corpo)) } : r.corpo;
    return { status: r.status, text: async () => JSON.stringify(resposta) };
  };
  return { buscar, pedidos };
}

function terminal() {
  const out: string[] = [];
  const err: string[] = [];
  return { out, err, escrever: (l: string) => void out.push(l), avisar: (l: string) => void err.push(l) };
}

const PERIODO = (() => {
  const v = validarPeriodo(TIPO, INICIO, AGORA);
  assert.ok(v.ok, 'maio não fechou em AGORA — a fixture mudou?');
  return v.periodo;
})();

async function imprimirPeloScript(
  o: { banco?: BancoFalso; semGravar?: boolean; reimprimir?: boolean; nuvem?: ReturnType<typeof nuvemFalsa> } = {},
) {
  const banco = o.banco ?? bancoFalso();
  const nuvem = o.nuvem ?? nuvemFalsa();
  const t = terminal();
  const relatorio = await imprimirPeriodo(
    { periodo: PERIODO, semGravar: o.semGravar ?? false, reimprimir: o.reimprimir ?? false },
    {
      db: banco.db,
      userId: USUARIO,
      motorPara: motoresDaBancada(SESSAO_DA_NUVEM, nuvem.buscar),
      agora: AGORA,
      relogio: () => AGORA,
      escrever: t.escrever,
      avisar: t.avisar,
    },
  );
  return { relatorio, banco, nuvem, t };
}

const hashesDe = (cadernos: readonly { caderno: CadernoId; hash: string | null }[]) =>
  Object.fromEntries(cadernos.map((c) => [c.caderno, c.hash]));

/** Nenhum texto de caderno no terminal — nem no stdout, nem no stderr. */
function semTexto(t: { out: string[]; err: string[] }): void {
  const tudo = [...t.out, ...t.err].join('\n');
  for (const [caderno, texto] of Object.entries(TEXTOS)) {
    assert.ok(!tudo.includes(texto), `o texto de ${caderno} apareceu no terminal`);
  }
}

/* ── o contrato ──────────────────────────────────────────────────────────── */

describe('o script imprime a fixture do contrato', () => {
  it('bate o GABARITO: hash por caderno, ordem e as linhas com a assinatura inteira', async () => {
    const { relatorio, banco, t } = await imprimirPeloScript();
    assert.equal(relatorio.codigo, 0);
    assert.equal(relatorio.estado, GABARITO.estado);
    assert.deepEqual(hashesDe(relatorio.cadernos), GABARITO.hashes);
    assert.equal(banco.rpcs.length, 1);
    assert.equal(banco.rpcs[0]!.fn, 'edicao_imprimir');
    assert.deepStrictEqual(banco.rpcs[0]!.args, GABARITO.carga);
    assert.deepEqual(relatorio.ordem, GABARITO.carga.p_ordem);
    semTexto(t);
  });

  it('o terminal mostra caderno, desfecho, hash curto e métrica líder — e o fuso no cabeçalho', async () => {
    const { t } = await imprimirPeloScript();
    const saida = t.out.join('\n');
    for (const [caderno, hash] of Object.entries(GABARITO.hashes)) {
      const linha = t.out.find((l) => l.trimStart().startsWith(caderno) && l.includes(hashCurto(hash)));
      assert.ok(linha, `sem a linha de ${caderno} com o hash curto`);
    }
    assert.match(saida, /rotina\s+escrito\s+\S+\s+líder tarefas/);
    assert.match(saida, /coracao\s+reprovada\s+\S+\s+líder —\s+\(numero ×1\)/);
    // O deslocamento é o de agora, e o rótulo diz isso — não passa por deslocamento do período.
    assert.match(t.out[1] ?? '', /fuso: .+\(UTC[+−]\d\d:\d\d agora\)/);
    assert.match(saida, /janela: desde 2026-03-12/);
  });

  it('as ocultas saem da entrada do script também: a leitura as conta, e o Movimento não as vê', async () => {
    const { t, relatorio } = await imprimirPeloScript();
    assert.match(t.out.join('\n'), /\(1 oculta, fora\)/);
    assert.equal(hashesDe(relatorio.cadernos)['movimento'], GABARITO.hashes.movimento);
  });

  it('não toca na capa, nem em tabela nenhuma fora da edição, e lê o acervo uma vez', async () => {
    const { banco } = await imprimirPeloScript();
    // O banco da fixture não tem `edicoes_capa`: uma leitura dela explodiria.
    assert.equal(banco.leituras['health_daily'], 1);
    assert.equal(banco.leituras['activities'], 1);
  });
});

/* ── a matriz ────────────────────────────────────────────────────────────── */

describe('a matriz da impressão', () => {
  it('já impresso, sem bandeira: recusa depois de ler o banco e antes de chamar o modelo', async () => {
    const banco = bancoFalso({ edicao: [cadernoImpressoDeMaio('sono', 1), cadernoImpressoDeMaio('rotina', 2)] });
    const { relatorio, nuvem, t } = await imprimirPeloScript({ banco });
    assert.equal(relatorio.codigo, 1);
    assert.equal(relatorio.estado, 'ja-impresso');
    assert.equal(nuvem.pedidos.length, 0, 'o modelo foi chamado');
    assert.equal(banco.leituras['edicoes_ia'], 1, 'não leu a edição');
    assert.equal(banco.leituras['health_daily'], undefined, 'leu o acervo antes de recusar');
    assert.equal(banco.rpcs.length, 0);
    const err = t.err.join('\n');
    assert.match(err, /--reimprimir/);
    assert.match(err, /--sem-gravar/);
  });

  it('--reimprimir: imprime de novo, e o caderno antigo que reprova agora fica com o texto de antes', async () => {
    const banco = bancoFalso({ edicao: [cadernoImpressoDeMaio('coracao', 1), cadernoImpressoDeMaio('rotina', 2)] });
    const { relatorio, t } = await imprimirPeloScript({ banco, reimprimir: true });
    assert.equal(relatorio.codigo, 0);
    assert.equal(relatorio.estado, 'gravada');
    assert.equal(banco.rpcs.length, 1);
    const carga = banco.rpcs[0]!.args;
    assert.deepEqual(carga.p_linhas.map((l) => l['caderno']), ['movimento', 'rotina', 'sono']);
    assert.ok(carga.p_ordem.includes('coracao'), 'o Coração impresso saiu da ordem por uma reprovação');
    const coracao = banco.tabelas.edicoes_ia.find((l) => l['caderno'] === 'coracao');
    assert.equal(coracao?.['texto'], 'texto antigo de coracao');
    // Os três grupos: o Coração é MANTIDO — texto e assinatura de antes, agg_version antiga.
    assert.deepEqual(relatorio.grupos, { escritos: ['movimento', 'rotina', 'sono'], mantidos: ['coracao'], sairam: [] });
    const linha = t.out.find((l) => l.includes('gravou:'));
    assert.ok(linha, 'sem a linha final dos grupos');
    assert.match(linha, /gravou: movimento, rotina, sono \/ manteve: coracao \(com o texto e a assinatura de antes — a agg_version deles é a antiga\) \/ saíram: nenhum/);
  });

  it('--sem-gravar com o Coração impresso que reprova: gravaria / manteria / sairiam, e nada gravado', async () => {
    const banco = bancoFalso({ edicao: [cadernoImpressoDeMaio('coracao', 1)] });
    const { relatorio, t } = await imprimirPeloScript({ banco, semGravar: true });
    assert.equal(relatorio.estado, 'ensaio');
    assert.deepEqual(relatorio.grupos, { escritos: ['movimento', 'rotina', 'sono'], mantidos: ['coracao'], sairam: [] });
    assert.ok(t.out.some((l) => /gravaria: movimento, rotina, sono \/ manteria: coracao \(.+agg_version.+\) \/ sairiam: nenhum — nada foi gravado/.test(l)));
    assert.equal(banco.rpcs.length, 0);
  });

  it('--sem-gravar: chama o modelo e confere, e nunca chega ao rpc — o estado é ensaio, não gravada', async () => {
    const { relatorio, banco, nuvem, t } = await imprimirPeloScript({ semGravar: true });
    assert.equal(relatorio.codigo, 0);
    assert.equal(relatorio.estado, 'ensaio');
    assert.equal(banco.rpcs.length, 0);
    assert.equal(banco.tabelas.edicoes_ia.length, 0);
    assert.equal(nuvem.pedidos.length, 4);
    assert.deepEqual(hashesDe(relatorio.cadernos), GABARITO.hashes);
    assert.deepEqual(relatorio.ordem, GABARITO.carga.p_ordem);
    semTexto(t);
  });

  it('--sem-gravar sobre um período já impresso: a tabela compara posição, provedor, modelo, versões, agg e líder', async () => {
    const banco = bancoFalso({
      edicao: [
        cadernoImpressoDeMaio('sono', 1, { provedor: 'provedor-sintetico', modelo: 'modelo-sintetico-1', metrica_lider: 'sono' }),
        cadernoImpressoDeMaio('rotina', 2),
      ],
    });
    const { relatorio, banco: depois, t } = await imprimirPeloScript({ banco, semGravar: true });
    assert.equal(relatorio.codigo, 0);
    assert.equal(relatorio.estado, 'ensaio');
    assert.equal(depois.rpcs.length, 0);
    const c = relatorio.comparacao ?? [];
    assert.deepEqual(
      [...new Set(c.map((l) => l.campo))],
      ['posição', 'provedor', 'modelo', 'prompt_versao', 'pacote_versao', 'agg_version', 'métrica líder'],
    );
    const de = (caderno: string, campo: string) => c.find((l) => l.caderno === caderno && l.campo === campo);
    assert.deepEqual(de('sono', 'provedor'), { caderno: 'sono', campo: 'provedor', novo: 'provedor-sintetico', banco: 'provedor-sintetico', igual: true });
    assert.deepEqual(de('sono', 'posição'), { caderno: 'sono', campo: 'posição', novo: '3', banco: '1', igual: false });
    assert.equal(de('rotina', 'provedor')?.igual, false);
    assert.equal(de('rotina', 'agg_version')?.novo, '9');
    assert.equal(de('rotina', 'agg_version')?.banco, '1');
    // O movimento não tem linha no banco: comparado com nada.
    assert.equal(de('movimento', 'posição')?.banco, '—');
    assert.ok(t.out.some((l) => l.includes('≠')), 'a diferença não foi marcada');
    // Na ordem que a edição teria — o Movimento na frente pela lápide do período (Story 2.7).
    assert.deepEqual([...new Set(c.map((l) => l.caderno))], ['movimento', 'rotina', 'sono']);
    semTexto(t);
  });

  it('--sem-gravar: o caderno impresso que reprova agora fica, com a linha de antes — "mantida", sem diferença', async () => {
    const banco = bancoFalso({ edicao: [cadernoImpressoDeMaio('coracao', 1)] });
    const { relatorio } = await imprimirPeloScript({ banco, semGravar: true });
    assert.equal(relatorio.estado, 'ensaio');
    assert.deepEqual(relatorio.ordem, ['movimento', 'rotina', 'sono', 'coracao']);
    const doCoracao = (relatorio.comparacao ?? []).filter((l) => l.caderno === 'coracao');
    assert.deepEqual(doCoracao.find((l) => l.campo === 'posição'), { caderno: 'coracao', campo: 'posição', novo: '4', banco: '1', igual: false });
    for (const l of doCoracao.filter((x) => x.campo !== 'posição')) {
      assert.equal(l.novo, 'mantida', l.campo);
      assert.equal(l.igual, true, l.campo);
    }
  });

  it('reprovado em todos: nada gravado, e sai com erro', async () => {
    const nuvem = nuvemFalsa({ texto: () => 'Foram 999 coisas, contra 998 em abril.' });
    const { relatorio, banco, t } = await imprimirPeloScript({ nuvem });
    assert.equal(relatorio.estado, 'nada-gravado');
    assert.equal(relatorio.codigo, 1);
    assert.equal(banco.rpcs.length, 0);
    assert.ok(relatorio.cadernos.every((c) => c.desfecho === 'reprovada'));
    assert.match(t.err.join('\n'), /nada foi gravado/);
  });

  /**
   * A corrida do "já impresso". A recusa do começo lê a edição **antes** das leituras
   * do acervo, e o `buscar` da sequência só roda depois delas: se o telefone imprimir
   * nesse intervalo, sem a segunda recusa o script regeneraria e gravaria por cima
   * sem `--reimprimir`. O banco ganha o caderno quando o acervo começa a ser lido.
   */
  const imprimeNoMeioDaLeitura = () =>
    bancoFalso({
      aoLer: (tabela, vez, tabelas) => {
        if (tabela === 'health_daily' && vez === 1) tabelas.edicoes_ia.push(cadernoImpressoDeMaio('rotina', 1));
      },
    });

  it('já impresso entre a checagem e o buscar, sem bandeira: recusa, 0 chamadas ao motor, 0 rpc', async () => {
    const banco = imprimeNoMeioDaLeitura();
    const { relatorio, nuvem, t } = await imprimirPeloScript({ banco });
    assert.equal(relatorio.codigo, 1);
    assert.equal(relatorio.estado, 'ja-impresso');
    assert.deepEqual(relatorio.ordem, ['rotina']);
    assert.equal(banco.leituras['edicoes_ia'], 2, 'o buscar não releu a edição');
    assert.equal(nuvem.pedidos.length, 0, 'o modelo foi chamado');
    assert.equal(banco.rpcs.length, 0);
    assert.match(t.err.join('\n'), /já tem edição \(rotina\)/);
    assert.equal(banco.tabelas.edicoes_ia[0]!['texto'], 'texto antigo de rotina', 'a edição do outro hospedeiro mudou');
  });

  it('já impresso entre a checagem e o buscar, com --sem-gravar: a comparação mostra o caderno novo', async () => {
    const banco = imprimeNoMeioDaLeitura();
    const { relatorio, t } = await imprimirPeloScript({ banco, semGravar: true });
    assert.equal(relatorio.estado, 'ensaio');
    assert.match(t.out.join('\n'), /no banco: 0 cadernos impressos/);
    const daRotina = (relatorio.comparacao ?? []).filter((l) => l.caderno === 'rotina');
    assert.equal(daRotina.find((l) => l.campo === 'provedor')?.banco, 'provedor-de-antes');
    assert.equal(daRotina.find((l) => l.campo === 'posição')?.banco, '1');
    assert.equal(banco.rpcs.length, 0);
  });

  it('uma leitura do acervo falha: rejeita com o erro do banco, e nada é gravado', async () => {
    const erro = new Error('PostgREST recusou sleep_periods');
    const banco = bancoFalso({ falhar: { sleep_periods: erro } });
    const nuvem = nuvemFalsa();
    await assert.rejects(() => imprimirPeloScript({ banco, nuvem }), (e: unknown) => e === erro);
    assert.equal(banco.rpcs.length, 0);
    assert.equal(nuvem.pedidos.length, 0);
  });

  it('concorrência: outro hospedeiro grava entre o buscar e o gravar — lança, e a função não é chamada', async () => {
    const banco = bancoFalso();
    const nuvem = nuvemFalsa({
      aoPedir: () => {
        if (nuvem.pedidos.length === 2) banco.tabelas.edicoes_ia.push(cadernoImpressoDeMaio('coracao', 1));
      },
    });
    await assert.rejects(() => imprimirPeloScript({ banco, nuvem }), EdicaoMudouNaImpressao);
    assert.equal(banco.rpcs.length, 0);
  });
});

/* ── as bandeiras e as recusas antes da rede ─────────────────────────────── */

describe('as bandeiras', () => {
  it('lê tipo pela tabela ou pela rota, início e os dois modos', () => {
    assert.deepEqual(lerBandeiras(['--tipo', 'mes', '--inicio', INICIO, '--sem-gravar']), {
      tipo: 'month', inicio: INICIO, semGravar: true, reimprimir: false, ajuda: false,
    });
    assert.equal(lerBandeiras(['--tipo', 'season']).tipo, 'season');
    assert.equal(lerBandeiras(['--tipo', 'ano']).tipo, 'year');
    assert.equal(lerBandeiras(['--reimprimir']).reimprimir, true);
  });

  it('recusa o Total, o tipo desconhecido, a repetida, a sem valor — e as que a spec não quer', () => {
    assert.throws(() => lerBandeiras(['--tipo', 'all']), /Total nunca fecha/);
    assert.throws(() => lerBandeiras(['--tipo', 'mensal']), /não é tipo de período/);
    assert.throws(() => lerBandeiras(['--inicio', '2026-05-01', '--inicio', '2026-04-01']), /mais de uma vez/);
    assert.throws(() => lerBandeiras(['--inicio']), /precisa de um valor/);
    // A cadeia é a padrão do descritor, e a edição é inteira: nem motor, nem cadernos.
    assert.throws(() => lerBandeiras(['--motor', 'nuvem:padrao']), /bandeira desconhecida: --motor/);
    assert.throws(() => lerBandeiras(['--cadernos', 'sono']), /bandeira desconhecida: --cadernos/);
  });

  it('--ajuda sai da mesma lista que a leitura', () => {
    const texto = ajuda();
    for (const b of ['--tipo', '--inicio', '--sem-gravar', '--reimprimir', '--ajuda']) assert.ok(texto.includes(b), b);
  });
});

/** Um processo falso: o `abrir` que reprova o teste se for chamado, a menos que se dê um. */
function processo(env: Record<string, string>, extra: Partial<Processo> = {}) {
  const t = terminal();
  let abriu = 0;
  const p: Processo = {
    env,
    agora: AGORA,
    escrever: t.escrever,
    avisar: t.avisar,
    abrir: async () => {
      abriu += 1;
      throw new Error('abriu rede num caso que devia parar antes');
    },
    ...extra,
  };
  return { p, t, abriu: () => abriu };
}

const PROJETO_NO_AMBIENTE = { ORBE_SUPABASE_URL: PROJETO, ORBE_SUPABASE_ANON_KEY: 'chave-anonima-secreta' };

function sessaoDo(banco: BancoFalso): Sessao & { fechada: () => boolean } {
  let fechada = false;
  return {
    db: banco.db,
    userId: USUARIO,
    url: PROJETO,
    chaveAnonima: 'chave-anonima-secreta',
    via: 'token',
    expiraEm: new Date(AGORA.getTime() + 3_600_000),
    podeRenovar: true,
    segredos: ['chave-anonima-secreta'],
    tokenAtual: async () => 'jwt-do-usuario',
    fechar: () => {
      fechada = true;
    },
    fechada: () => fechada,
  };
}

describe('gruposDaImpressao — escritos, mantidos e os que saem', () => {
  it('os três grupos, na ordem da edição', () => {
    // Coração estava impresso e caiu no piso (fica); Sono estava impresso e saiu da ordem.
    assert.deepEqual(
      gruposDaImpressao(['rotina', 'coracao', 'movimento'], ['movimento', 'rotina'], ['coracao', 'sono']),
      { escritos: ['rotina', 'movimento'], mantidos: ['coracao'], sairam: ['sono'] },
    );
  });

  it('primeira impressão: tudo escrito, nada mantido, nada sai', () => {
    assert.deepEqual(gruposDaImpressao(['sono'], ['sono'], []), { escritos: ['sono'], mantidos: [], sairam: [] });
  });
});

describe('o executável — as recusas antes da rede, e o caminho inteiro', () => {
  // AGORA é quarta, 10/06/2026: a semana de 08/06 e o 2º trimestre estão em curso.
  const invalidos: readonly (readonly [string, string, string, RegExp])[] = [
    ['início que não abre o mês', 'month', '2026-05-02', /não abre um mês/],
    ['o mês em curso', 'month', '2026-06-01', /ainda não fechou/],
    ['um mês no futuro', 'month', '2026-09-01', /ainda não fechou/],
    ['data que não existe', 'month', '2026-02-30', /não abre um mês/],
    ['início que não é segunda-feira', 'semana', '2026-05-05', /não abre uma semana \(ela começa na segunda-feira\)/],
    ['a semana em curso', 'week', '2026-06-08', /ainda não fechou/],
    ['início que não abre trimestre', 'estacao', '2026-05-01', /não abre um trimestre/],
    ['o trimestre em curso', 'season', '2026-04-01', /ainda não fechou/],
    ['início que não abre o ano', 'ano', '2025-02-01', /não abre um ano/],
    ['o ano em curso', 'year', '2026-01-01', /ainda não fechou/],
    ['--inicio sem os zeros', 'month', '2026-5-1', /não é uma data AAAA-MM-DD/],
    ['--inicio só com o mês', 'month', '2026-05', /não é uma data AAAA-MM-DD/],
    ['--inicio em outra grafia', 'month', '05/2026', /não é uma data AAAA-MM-DD/],
  ];
  for (const [nome, tipo, inicio, motivo] of invalidos) {
    it(`período inválido (${nome}): recusa antes de abrir rede, e antes da credencial`, async () => {
      const { p, t, abriu } = processo({});
      assert.equal(await principal(['--tipo', tipo, '--inicio', inicio], p), 1);
      assert.equal(abriu(), 0);
      const err = t.err.join('\n');
      assert.match(err, motivo);
      assert.doesNotMatch(err, /falta/);
    });
  }

  it('os válidos de cada tipo passam pela mesma régua', () => {
    for (const [tipo, inicio] of [['week', '2026-06-01'], ['month', '2026-05-01'], ['season', '2026-01-01'], ['year', '2025-01-01']] as const) {
      const v = validarPeriodo(tipo, inicio, AGORA);
      assert.ok(v.ok, `${tipo} ${inicio}: ${v.ok ? '' : v.motivo}`);
    }
  });

  it('TZ com o nome errado: recusa antes da rede, nomeando a variável', async () => {
    const { p, t, abriu } = processo({ ...PROJETO_NO_AMBIENTE, TZ: 'Europe/Bruxelas' }, { fusoResolvido: undefined });
    assert.equal(await principal(['--tipo', 'month', '--inicio', INICIO], p), 1);
    assert.equal(abriu(), 0);
    const err = t.err.join('\n');
    assert.match(err, /fuso inválido: TZ=Europe\/Bruxelas não é um fuso que o sistema conheça/);
    assert.match(err, /caiu para UTC/);
    assert.doesNotMatch(err, /falta/, 'passou do fuso para a credencial');
  });

  it('TZ de um fuso que não é o do processo: recusa', () => {
    const agora = new Date(2026, 5, 10, 12);
    const doProcesso = -agora.getTimezoneOffset();
    // Um fuso real com outro deslocamento que o do processo, qualquer que seja o do CI.
    const outro = doProcesso === 330 ? 'Europe/Brussels' : 'Asia/Kolkata';
    assert.match(problemaDoFuso({ TZ: outro }, agora, 'Qualquer/Um') ?? '', /agora, e o processo está em/);
  });

  it('TZ ausente ou igual ao do processo: aceito', () => {
    const agora = new Date(2026, 5, 10, 12);
    const resolvido = Intl.DateTimeFormat().resolvedOptions().timeZone;
    assert.equal(problemaDoFuso({}, agora, resolvido), null);
    assert.equal(problemaDoFuso({ TZ: '' }, agora, resolvido), null);
    assert.equal(problemaDoFuso({ TZ: resolvido }, agora, resolvido), null);
  });

  it('--tipo all: recusa na leitura das bandeiras', async () => {
    const { p, t, abriu } = processo({});
    assert.equal(await principal(['--tipo', 'all', '--inicio', '2026-01-01'], p), 1);
    assert.equal(abriu(), 0);
    assert.match(t.err.join('\n'), /Total nunca fecha/);
  });

  it('sem credencial: para antes da rede e nomeia só a variável, nunca o valor', async () => {
    const { p, t, abriu } = processo({ ...PROJETO_NO_AMBIENTE });
    assert.equal(await principal(['--tipo', 'month', '--inicio', INICIO], p), 1);
    assert.equal(abriu(), 0);
    const err = t.err.join('\n');
    assert.match(err, /ORBE_ACCESS_TOKEN/);
    assert.ok(!err.includes('chave-anonima-secreta'), 'o valor de uma variável apareceu na mensagem');
  });

  it('sem projeto nenhum: nomeia as duas variáveis do projeto', async () => {
    const { p, t } = processo({});
    assert.equal(await principal(['--tipo', 'month', '--inicio', INICIO], p), 1);
    assert.match(t.err.join('\n'), /falta ORBE_SUPABASE_URL/);
    assert.match(t.err.join('\n'), /falta ORBE_SUPABASE_ANON_KEY/);
  });

  it('para gravar, o token sozinho não basta: nomeia ORBE_REFRESH_TOKEN, antes da rede', async () => {
    const { p, t, abriu } = processo({ ...PROJETO_NO_AMBIENTE, ORBE_ACCESS_TOKEN: 'token-secreto' });
    assert.equal(await principal(['--tipo', 'month', '--inicio', INICIO], p), 1);
    assert.equal(abriu(), 0);
    const err = t.err.join('\n');
    assert.match(err, /ORBE_REFRESH_TOKEN/);
    assert.ok(!err.includes('token-secreto'));
  });

  it('o token sozinho basta para o --sem-gravar, e o caminho inteiro não grava', async () => {
    const banco = bancoFalso();
    const sessao = sessaoDo(banco);
    const nuvem = nuvemFalsa();
    const { p, t } = processo(
      { ...PROJETO_NO_AMBIENTE, ORBE_ACCESS_TOKEN: 'token-secreto' },
      { abrir: async () => sessao, buscar: nuvem.buscar },
    );
    assert.equal(await principal(['--tipo', 'mes', '--inicio', INICIO, '--sem-gravar'], p), 0);
    assert.equal(banco.rpcs.length, 0);
    assert.equal(nuvem.pedidos.length, 4);
    assert.ok(sessao.fechada(), 'a sessão não foi fechada — o relógio de renovação seguraria o processo');
    semTexto(t);
  });

  it('o caminho inteiro, com sessão que renova: grava o GABARITO e fecha a sessão', async () => {
    const banco = bancoFalso();
    const sessao = sessaoDo(banco);
    const nuvem = nuvemFalsa();
    const { p, t } = processo(
      { ...PROJETO_NO_AMBIENTE, ORBE_ACCESS_TOKEN: 'token-secreto', ORBE_REFRESH_TOKEN: 'refresh-secreto' },
      { abrir: async () => sessao, buscar: nuvem.buscar },
    );
    assert.equal(await principal(['--tipo', 'month', '--inicio', INICIO], p), 0);
    assert.equal(banco.rpcs.length, 1);
    assert.deepStrictEqual(banco.rpcs[0]!.args, GABARITO.carga);
    assert.ok(sessao.fechada());
    const tudo = [...t.out, ...t.err].join('\n');
    for (const segredo of ['token-secreto', 'refresh-secreto', 'chave-anonima-secreta', 'jwt-do-usuario']) {
      assert.ok(!tudo.includes(segredo), `${segredo} apareceu no terminal`);
    }
  });
});

/* ── o que o script não faz ──────────────────────────────────────────────── */

/**
 * O script só injeta: sessão, transporte e portas. Cliente da function, leitura de
 * corpo de erro, tradução de classe, a função do banco, a capa e o manifesto da
 * bancada são de outros donos (as barreiras do `architecture.test.ts` cobram parte
 * disto no repositório inteiro; esta é a lista da spec, para este arquivo).
 */
describe('o que o script não faz', () => {
  const fonte = readFileSync(join(__dirname, 'imprimir.ts'), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');
  const proibidos: readonly (readonly [string, RegExp])[] = [
    ['o nome da function', /ia-narrar|functions\/v1/],
    ['construir motor de nuvem ou traduzir resposta', /criarMotorDeNuvem|traduzirDaNuvem|CLASSE_POR_STATUS|STATUS_POR_CLASSE/],
    ['ler status ou corpo de erro', /\.status\b|\.corpo\b|\bclasse\b/],
    ['nomear a função do banco', /edicao_imprimir/],
    ['acessar tabela direto', /\.from\(/],
    ['ler a porta de gravação', /\.gravar\b/],
    ['tocar na capa', /edicoes_capa|carimbar|gravarCapa/],
    ['mexer no manifesto da bancada', /manifesto/],
    ['aceitar motor ou cadernos', /'--motor'|'--cadernos'/],
  ];
  for (const [nome, re] of proibidos) {
    it(`não há ${nome} em revista/imprimir.ts`, () => {
      assert.doesNotMatch(fonte, re);
    });
  }
});
