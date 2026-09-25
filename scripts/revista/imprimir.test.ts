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
 *
 * **E a matriz do modo em massa (Story 2.3)**, sobre o mesmo banco e a mesma
 * nuvem falsos: o plano que não chama modelo nenhum, a ordem cronológica, o pulo
 * do já impresso, a reimpressão só do que o dono nomeou, a falha que não derruba
 * a corrida, a retomada e a recusa da semana. O plano é medido contra o
 * **inventário de produção** de 23/09/2026 ({@link ARQUIVO_DE_PRODUCAO}), que é
 * o número que a spec manda conferir à mão: cerca de 50 a imprimir, cinco a
 * reimprimir, o restante a pular.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  CADERNO_IDS,
  EdicaoMudouNaImpressao,
  NUVEM_PADRAO,
  PACOTE_VERSAO,
  PROMPT_VERSAO,
  SEM_MODELO,
  descritorDaRetrospectiva,
  hashCurto,
  periodosFechadosDesde,
  versoesDaRetrospectiva,
  type CadernoId,
  type Capa,
  type CorpoDoPedido,
  type EdicaoNoArquivo,
  type EventoDoAnel,
  type PeriodoFechado,
  type Tentativa,
  type TipoComEdicao,
} from '@vitale/shared';
import {
  AGORA,
  FIM,
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
  A_REIMPRIMIR,
  COMECO_DO_ARQUIVO,
  ajuda,
  bandeirasIncompativeis,
  chamadasPagas,
  portasDaCapa,
  contasDoPlano,
  exportarEmTexto,
  gruposDaImpressao,
  imprimirEmMassa,
  imprimirPeriodo,
  lerBandeiras,
  montarPlano,
  principal,
  problemaDoFuso,
  validarPeriodo,
  nomeadosForaDoPlano,
  type ItemDoPlano,
  type PeriodoNomeado,
  type PortasDaCapa,
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
  o: {
    banco?: BancoFalso;
    semGravar?: boolean;
    reimprimir?: boolean;
    caderno?: CadernoId | null;
    capa?: PortasDaCapa;
    nuvem?: ReturnType<typeof nuvemFalsa>;
  } = {},
) {
  const banco = o.banco ?? bancoFalso();
  const nuvem = o.nuvem ?? nuvemFalsa();
  const t = terminal();
  const relatorio = await imprimirPeriodo(
    {
      periodo: PERIODO,
      semGravar: o.semGravar ?? false,
      reimprimir: o.reimprimir ?? false,
      caderno: o.caderno ?? null,
    },
    {
      db: banco.db,
      userId: USUARIO,
      motorPara: motoresDaBancada(SESSAO_DA_NUVEM, nuvem.buscar),
      agora: AGORA,
      relogio: () => AGORA,
      escrever: t.escrever,
      avisar: t.avisar,
      ...(o.capa ? { capa: o.capa } : {}),
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

  it('sem as portas da capa, não toca nela — e lê o acervo uma vez', async () => {
    const { banco } = await imprimirPeloScript();
    // A fixture TEM as duas tabelas da capa desde a 2.3; o que se mede aqui é
    // que a impressão sem `deps.capa` não as procura.
    assert.equal(banco.leituras['edicoes_capa'], undefined);
    assert.equal(banco.leituras['activity_photos'], undefined);
    assert.equal(banco.escritas.length, 0);
    assert.equal(banco.leituras['health_daily'], 1);
    assert.equal(banco.leituras['activities'], 1);
  });

  /**
   * O caminho de um período só **passou a carimbar** na 2.3, e por tabela de
   * verdade: `portasDaCapa` sobre o banco da fixture, `fetchPhotosForActivities`
   * e `gravarCapa` como em produção. Sem isto, a fiação podia estar quebrada e o
   * teste passaria — porque falha de capa é aviso, por contrato.
   */
  it('com as portas da capa, carimba de verdade: a linha entra em edicoes_capa, sem aviso', async () => {
    const banco = bancoFalso();
    const nuvem = nuvemFalsa();
    const t = terminal();
    const r = await imprimirPeriodo(
      { periodo: PERIODO, semGravar: false, reimprimir: false },
      {
        db: banco.db,
        userId: USUARIO,
        motorPara: motoresDaBancada(SESSAO_DA_NUVEM, nuvem.buscar),
        agora: AGORA,
        relogio: () => AGORA,
        escrever: t.escrever,
        avisar: t.avisar,
        capa: portasDaCapa(banco.db, USUARIO),
      },
    );
    assert.equal(r.codigo, 0);
    assert.equal(r.capa?.aviso, null, 'a capa avisou em vez de carimbar');
    assert.equal(r.capa?.natureza, 'grade');
    assert.equal(r.capa?.mantida, null, 'a capa foi mantida em vez de carimbada');
    // A linha existe no banco, com a chave da edição e a legenda por extenso.
    assert.equal(banco.escritas.length, 1);
    const linha = banco.escritas[0]!.linha;
    assert.equal(banco.escritas[0]!.tabela, 'edicoes_capa');
    assert.equal(linha['tipo_periodo'], TIPO);
    assert.equal(linha['inicio'], INICIO);
    assert.equal(linha['fim'], FIM);
    assert.equal(linha['natureza'], 'grade');
    assert.equal(linha['legenda'], 'Maio de 2026');
    assert.equal(linha['motivo'], 'sem-foto');
    assert.match(t.out.join('\n'), /capa: grade/);
    assert.equal(t.err.length, 0, `avisos inesperados: ${t.err.join(' | ')}`);
  });

  it('o --sem-gravar não toca na capa: não há edição a carimbar', async () => {
    const banco = bancoFalso();
    const nuvem = nuvemFalsa();
    const t = terminal();
    const r = await imprimirPeriodo(
      { periodo: PERIODO, semGravar: true, reimprimir: false },
      {
        db: banco.db, userId: USUARIO, motorPara: motoresDaBancada(SESSAO_DA_NUVEM, nuvem.buscar),
        agora: AGORA, relogio: () => AGORA, escrever: t.escrever, avisar: t.avisar,
        capa: portasDaCapa(banco.db, USUARIO),
      },
    );
    assert.equal(r.capa, null);
    assert.equal(banco.escritas.length, 0);
    assert.equal(banco.leituras['edicoes_capa'], undefined);
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

  /* ── um caderno só (--caderno, Story 2.8) ──────────────────────────────── */

  /**
   * A parcial pelo script, contra o mesmo banco e a mesma nuvem da fixture.
   *
   * Nada disto é reimplementado aqui: `cadernos: [alvo]` é opção da sequência do
   * núcleo, e é ela que mantém os outros. O que estes testes medem é que o
   * script **passa** a lista, que ele não recusa o período já impresso, e que a
   * capa não é tocada.
   */
  it('--caderno: só o pedido é chamado e gravado; os outros mantêm texto, assinatura e posição', async () => {
    const banco = bancoFalso({
      edicao: [
        cadernoImpressoDeMaio('movimento', 1),
        cadernoImpressoDeMaio('rotina', 2),
        cadernoImpressoDeMaio('sono', 3),
      ],
    });
    const { relatorio, nuvem, t } = await imprimirPeloScript({ banco, caderno: 'rotina' });
    assert.equal(relatorio.codigo, 0);
    assert.equal(relatorio.estado, 'gravada');
    // Uma chamada paga, e ela é a do caderno pedido.
    assert.deepEqual(nuvem.pedidos, ['rotina']);
    assert.deepEqual(relatorio.cadernos.map((c) => c.caderno), ['rotina']);
    assert.deepEqual(relatorio.grupos, {
      escritos: ['rotina'],
      mantidos: ['movimento', 'sono'],
      sairam: [],
    });
    // A carga leva UMA linha — a do caderno pedido —, e a ordem do conjunto
    // inteiro: os outros dois continuam na edição, e é a função que os mantém.
    const carga = banco.rpcs[0]!.args;
    assert.equal(banco.rpcs.length, 1);
    assert.deepEqual(carga.p_linhas.map((l) => l['caderno']), ['rotina']);
    assert.deepEqual(relatorio.ordem, ['movimento', 'rotina', 'sono']);
    assert.deepEqual(carga.p_ordem, ['movimento', 'rotina', 'sono']);
    assert.equal(carga.p_linhas[0]!['prompt_versao'], PROMPT_VERSAO);
    assert.match(t.out.join('\n'), /cadernos: só rotina/);
    semTexto(t);
  });

  it('--caderno num período já impresso NÃO é recusado: reescrever um caderno é o caso de uso', async () => {
    const banco = bancoFalso({ edicao: [cadernoImpressoDeMaio('rotina', 1)] });
    const { relatorio, nuvem } = await imprimirPeloScript({ banco, caderno: 'rotina' });
    assert.equal(relatorio.estado, 'gravada', 'a parcial foi recusada como já impressa');
    assert.deepEqual(nuvem.pedidos, ['rotina']);
  });

  it('--caderno --sem-gravar: um caderno na tabela, nada no banco, e a capa intocada', async () => {
    const banco = bancoFalso({ edicao: [cadernoImpressoDeMaio('rotina', 1), cadernoImpressoDeMaio('sono', 2)] });
    const capa = capaFalsa({ existente: { motivo: 'estrela', natureza: 'foto' } });
    const { relatorio, nuvem, t } = await imprimirPeloScript({
      banco, caderno: 'rotina', semGravar: true, capa: capa.portas,
    });
    assert.equal(relatorio.estado, 'ensaio');
    assert.deepEqual(nuvem.pedidos, ['rotina']);
    assert.equal(banco.rpcs.length, 0);
    assert.equal(relatorio.capa, null, 'o --sem-gravar tocou na capa');
    assert.equal(capa.leituras(), 0);
    assert.deepEqual(capa.carimbadas, []);
    // O sono fica: comparado, ele é "mantida" em tudo menos posição.
    const doSono = (relatorio.comparacao ?? []).filter((l) => l.caderno === 'sono' && l.campo !== 'posição');
    assert.ok(doSono.length > 0);
    for (const l of doSono) assert.equal(l.novo, 'mantida', l.campo);
    assert.match(t.out.join('\n'), /capa: não é carimbada por aqui/);
  });

  /**
   * A regra que a spec da 2.8 pôs em *Always*: **parcial nunca troca capa
   * existente**. Em produção há quatro escolhidas à mão — três `trocada` e uma
   * `estrela` (agosto/2026) —, e `estrela` não passa pela guarda da troca. É por
   * isso que a parcial olha só a EXISTÊNCIA da capa, como o telefone faz.
   */
  it('--caderno com capa `estrela`: a linha de edicoes_capa fica idêntica, e o relatório diz por quê', async () => {
    const banco = bancoFalso({ edicao: [cadernoImpressoDeMaio('rotina', 1)] });
    const capa = capaFalsa({ existente: { motivo: 'estrela', natureza: 'foto' } });
    const { relatorio, t } = await imprimirPeloScript({ banco, caderno: 'rotina', capa: capa.portas });
    assert.equal(relatorio.codigo, 0);
    assert.deepEqual(capa.carimbadas, [], 'a parcial recarimbou a capa');
    assert.deepEqual(relatorio.capa, { natureza: 'foto', mantida: 'parcial', aviso: null });
    assert.match(t.out.join('\n'), /capa: foto — mantida, porque esta impressão foi de um caderno só/);
  });

  it('--caderno com capa `trocada`: idem — e o motivo do relatório é a parcial, não a troca', async () => {
    const banco = bancoFalso({ edicao: [cadernoImpressoDeMaio('rotina', 1)] });
    const capa = capaFalsa({ existente: { motivo: 'trocada', natureza: 'tracado' } });
    const { relatorio } = await imprimirPeloScript({ banco, caderno: 'rotina', capa: capa.portas });
    assert.deepEqual(capa.carimbadas, []);
    assert.deepEqual(relatorio.capa, { natureza: 'tracado', mantida: 'parcial', aviso: null });
  });

  it('--caderno sem capa nenhuma: aí sim carimba — senão a edição fica em papel para sempre', async () => {
    const banco = bancoFalso({ edicao: [cadernoImpressoDeMaio('rotina', 1)] });
    const capa = capaFalsa();
    const { relatorio } = await imprimirPeloScript({ banco, caderno: 'rotina', capa: capa.portas });
    assert.equal(relatorio.capa?.mantida, null);
    assert.deepEqual(capa.carimbadas.map((c) => c.inicio), [INICIO]);
  });

  /**
   * O caderno pedido ficou sem dado: a sequência não tem o que pôr na fila e sai
   * em `sem-caderno` **antes do `buscar`** — nada é chamado, nada é gravado, e a
   * linha antiga dele **continua no banco**.
   *
   * Isto é o contrário do que parece: a parcial não apaga o caderno que emudeceu.
   * Quem tira um caderno da edição é a impressão **inteira**, que recalcula a
   * ordem sobre os quatro. O README diz isso, e é este teste que o prende.
   *
   * O acervo do Rotina é esvaziado antes da leitura: sem hábito, registro, série
   * nem nota do dia, o pacote dele é vazio (`cadernoVazio`).
   */
  it('--caderno num caderno que ficou sem dado: nada é chamado, nada é gravado, e a linha de antes fica', async () => {
    // Tudo o que alimenta o Rotina: hábitos, registros, tarefas e a nota do dia.
    // (Compras não têm tabela na fixture, e já chegam sem medida.)
    const semRotina = new Set([
      'habits', 'habit_logs', 'registros', 'registro_logs', 'todo_templates', 'todo_occurrences', 'daily_ratings',
    ]);
    const banco = bancoFalso({
      edicao: [cadernoImpressoDeMaio('movimento', 1), cadernoImpressoDeMaio('rotina', 2)],
      aoLer: (tabela, _vez, tabelas) => {
        if (semRotina.has(tabela)) tabelas[tabela].length = 0;
      },
    });
    const { relatorio, nuvem, t } = await imprimirPeloScript({ banco, caderno: 'rotina' });
    assert.deepEqual(nuvem.pedidos, [], 'um caderno vazio foi pago');
    assert.equal(relatorio.estado, 'sem-caderno');
    assert.equal(relatorio.codigo, 1);
    assert.equal(banco.rpcs.length, 0, 'nada a escrever virou uma gravação');
    // A linha antiga do rotina continua lá — a parcial não a apagou.
    assert.deepEqual(banco.tabelas.edicoes_ia.map((l) => l['caderno']), ['movimento', 'rotina']);
    assert.match(t.err.join('\n'), /nenhum caderno de .* tem o que dizer/);
  });

  it('--caderno num período SEM edição avisa: a edição nasce com um caderno só', async () => {
    const { relatorio, t } = await imprimirPeloScript({ caderno: 'rotina' });
    assert.equal(relatorio.codigo, 0);
    assert.match(t.err.join('\n'), /não tem edição, e --caderno rotina vai criar uma com um caderno só/);
  });

  it('o aviso da edição de um caderno só sai no ENSAIO também — é o efeito irreversível da bandeira', async () => {
    const { relatorio, banco, t } = await imprimirPeloScript({ caderno: 'rotina', semGravar: true });
    assert.equal(banco.rpcs.length, 0);
    assert.equal(relatorio.estado, 'ensaio');
    assert.match(t.err.join('\n'), /--caderno rotina criaria uma com um caderno só/);
    assert.match(t.err.join('\n'), /passaria a contar esse período como impresso/);
  });

  /**
   * O caminho natural para **religar** um caderno que reprovou numa impressão
   * anterior: a edição existe sem ele, e `--caderno` o acrescenta.
   *
   * No `--massa` este caso é pulado de propósito (a campanha corrige o que está
   * escrito, e ali não há nada escrito para corrigir). Num período só, ele é o
   * uso legítimo — e sem teste ninguém garantiria que a ordem do conjunto é
   * recalculada em vez de o caderno novo ser jogado no fim.
   */
  it('--caderno num caderno que a edição NÃO tem: ele é acrescentado, e a ordem é recalculada', async () => {
    const banco = bancoFalso({
      edicao: [cadernoImpressoDeMaio('movimento', 1), cadernoImpressoDeMaio('sono', 2)],
    });
    const { relatorio, nuvem, banco: b } = await imprimirPeloScript({ banco, caderno: 'rotina' });
    assert.equal(relatorio.codigo, 0);
    assert.deepEqual(nuvem.pedidos, ['rotina']);
    // A ordem do conjunto vem do ranqueamento sobre os três, e não "o novo no fim".
    assert.deepEqual(relatorio.ordem, ['movimento', 'rotina', 'sono']);
    assert.deepEqual(relatorio.grupos, { escritos: ['rotina'], mantidos: ['movimento', 'sono'], sairam: [] });
    const carga = b.rpcs[0]!.args;
    assert.deepEqual(carga.p_linhas.map((l) => l['caderno']), ['rotina']);
    assert.deepEqual([...carga.p_ordem], ['movimento', 'rotina', 'sono']);
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

/* ── o modo em massa (Story 2.3) ─────────────────────────────────────────── */

/** Uma linha de `edicoes_ia` de qualquer período — o inventário do arquivo. */
function edicaoNoBanco(
  tipo: string,
  inicio: string,
  fim: string,
  cadernos: readonly CadernoId[],
  pacoteVersao = 3,
): Record<string, unknown>[] {
  return cadernos.map((caderno, k) => ({
    user_id: USUARIO, tipo_periodo: tipo, inicio, fim, caderno, posicao: k + 1,
    texto: `texto antigo de ${caderno} em ${inicio}`, provedor: 'provedor-de-antes', modelo: 'modelo-de-antes',
    prompt_versao: 4, pacote_versao: pacoteVersao, motivo_de_parada: 'STOP', tokens_entrada: 10, tokens_saida: 5,
    agg_version_no_momento: 8, metrica_lider: null, gerado_em: '2026-06-02T08:00:00+00:00',
  }));
}

/**
 * As portas da capa, falsas: nada abre rede, e o que foi carimbado fica
 * registrado. `existente` é a capa que já está no banco — é por ela que o caso
 * da troca à mão (`motivo: 'trocada'`) tem prova.
 */
function capaFalsa(o: { falhar?: Error; falharLeitura?: Error; existente?: Partial<Capa> } = {}) {
  const carimbadas: { inicio: string; natureza: string }[] = [];
  let leituras = 0;
  const portas: PortasDaCapa = {
    lerCapa: async (p) => {
      leituras += 1;
      if (o.falharLeitura) throw o.falharLeitura;
      if (!o.existente) return null;
      return {
        tipoPeriodo: p.tipoPeriodo, inicio: p.inicio, fim: p.fim,
        natureza: 'foto', fotoId: 'p-1', fotoTakenAt: '2026-05-14T10:38:00.000Z',
        rotaActivityId: null, legenda: 'Ittre · km 31,1 · 12:38',
        carimbadaEm: '2026-06-01T08:00:00.000Z', motivo: 'trocada', fotoActivityId: 'a-1',
        ...o.existente,
      };
    },
    buscarFotos: async () => [],
    carimbar: async (capa) => {
      if (o.falhar) throw o.falhar;
      carimbadas.push({ inicio: capa.inicio, natureza: capa.natureza });
      return capa;
    },
  };
  return { portas, carimbadas, leituras: () => leituras };
}

/** Maio de 2026 — o único período que a fixture tem acervo para narrar. */
const MAIO = { ...PERIODO, tipo: 'month' as const };
/**
 * Janeiro de 2025 — fechado, dentro do arquivo, e **sem acervo**.
 *
 * Desde a Story 2.8 ele é **pulado**, não falho: nenhum caderno tem o que dizer,
 * custa zero chamadas e nunca se resolve. Ver o ramo `sem-caderno` da corrida.
 */
const JANEIRO_2025 = { tipo: 'month' as const, inicio: '2025-01-01', fim: '2025-01-31', offset: -17, rotulo: 'Janeiro 2025' };

/**
 * Um período que **falha de verdade**: o começo não abre mês, e `validarPeriodo`
 * o recusa antes de qualquer leitura.
 *
 * Ele existe porque "sem acervo" deixou de ser falha (2.8), e o freio precisa
 * continuar tendo alvo. Este é o caso real que o plano descreve — "o período do
 * arquivo não se localiza no relógio de hoje" —, e é falha porque **algo está
 * errado**, não porque não havia o que contar.
 */
const invalido = (inicio: string, rotulo: string) =>
  ({ tipo: 'month' as const, inicio, fim: '2025-01-31', offset: -17, rotulo });

async function massaPeloScript(
  o: {
    banco?: BancoFalso;
    nuvem?: ReturnType<typeof nuvemFalsa>;
    capa?: ReturnType<typeof capaFalsa>;
    sim?: boolean;
    tipo?: 'month' | 'season' | 'year' | null;
    limite?: number | null;
    exportar?: string | null;
    caderno?: CadernoId | null;
    semCapa?: boolean;
    enumerar?: (agora: Date) => readonly PeriodoFechado[];
    nomeados?: readonly PeriodoNomeado[];
    arquivos?: Record<string, string>;
  } = {},
) {
  const banco = o.banco ?? bancoFalso();
  const nuvem = o.nuvem ?? nuvemFalsa();
  const capa = o.capa ?? capaFalsa();
  const arquivos = o.arquivos ?? {};
  const t = terminal();
  const relatorio = await imprimirEmMassa(
    {
      sim: o.sim ?? false,
      tipo: o.tipo ?? null,
      limite: o.limite ?? null,
      exportar: o.exportar ?? null,
      caderno: o.caderno ?? null,
    },
    {
      db: banco.db,
      userId: USUARIO,
      motorPara: motoresDaBancada(SESSAO_DA_NUVEM, nuvem.buscar),
      agora: AGORA,
      relogio: () => AGORA,
      escrever: t.escrever,
      avisar: t.avisar,
      ...(o.semCapa ? {} : { capa: capa.portas }),
      escreverArquivo: (caminho, conteudo) => {
        arquivos[caminho] = conteudo;
      },
      arquivoExiste: (caminho) => caminho in arquivos,
      ...(o.enumerar ? { enumerar: o.enumerar } : {}),
      ...(o.nomeados ? { nomeados: o.nomeados } : {}),
    },
  );
  return { relatorio, banco, nuvem, capa, arquivos, t };
}

/** Um nomeado do teste, no molde de {@link A_REIMPRIMIR} — a versão de antes é a 3. */
const nomeado = (tipo: 'month' | 'season' | 'year', inicio: string, motivo = 'motivo do teste'): PeriodoNomeado =>
  ({ tipo, inicio, pacoteImpresso: 3, motivo });

/**
 * O inventário de produção em 23/09/2026 — onze edições, todas no pacote 3.
 *
 * É contra ele que o plano da spec é medido: cerca de 50 a imprimir, **cinco** a
 * reimprimir e o restante a pular. Cinco delas são semanas, que a massa nunca
 * toca; o ano de 2023 não é enumerado (começa antes do arquivo) e só aparece
 * porque o dono o nomeou.
 */
const ARQUIVO_DE_PRODUCAO: readonly { tipoPeriodo: TipoComEdicao; inicio: string; fim: string }[] = [
  { tipoPeriodo: 'week', inicio: '2026-08-03', fim: '2026-08-09' },
  { tipoPeriodo: 'week', inicio: '2026-08-10', fim: '2026-08-16' },
  { tipoPeriodo: 'week', inicio: '2026-08-17', fim: '2026-08-23' },
  { tipoPeriodo: 'week', inicio: '2026-08-24', fim: '2026-08-30' },
  { tipoPeriodo: 'week', inicio: '2026-09-07', fim: '2026-09-13' },
  { tipoPeriodo: 'month', inicio: '2026-06-01', fim: '2026-06-30' },
  { tipoPeriodo: 'month', inicio: '2026-07-01', fim: '2026-07-31' },
  { tipoPeriodo: 'month', inicio: '2026-08-01', fim: '2026-08-31' },
  { tipoPeriodo: 'month', inicio: '2023-09-01', fim: '2023-09-30' },
  { tipoPeriodo: 'month', inicio: '2023-10-01', fim: '2023-10-31' },
  { tipoPeriodo: 'year', inicio: '2023-01-01', fim: '2023-12-31' },
];

/**
 * Uma edição do arquivo, com uma versão por caderno. Os números posicionais são
 * `pacote_versao` (o critério da campanha da 2.3); `prompt` cobre os mesmos
 * cadernos pela ordem quando o teste é da campanha de um caderno só (2.8) — e o
 * padrão dele, 5, é o prompt de antes da concordância.
 */
const noArquivo = (
  e: { tipoPeriodo: TipoComEdicao; inicio: string; fim: string },
  ...pacotes: number[]
): EdicaoNoArquivo => comPrompt(e, [], ...pacotes);

const CADERNOS_DO_ARQUIVO = ['sono', 'movimento', 'rotina', 'coracao'] as const;

const comPrompt = (
  e: { tipoPeriodo: TipoComEdicao; inicio: string; fim: string },
  prompts: readonly number[],
  ...pacotes: number[]
): EdicaoNoArquivo => ({
  ...e,
  cadernos: (pacotes.length === 0 ? [3] : pacotes).map((pacoteVersao, k) => ({
    caderno: CADERNOS_DO_ARQUIVO[k]!,
    posicao: k + 1,
    promptVersao: prompts[k] ?? 5,
    pacoteVersao,
    // A coluna da Story 2.4b: ela entrou no arquivo para as quatro tiras do
    // anuário e **não decide reimpressão nenhuma** — nula aqui, que é o valor
    // que a massa ignora do mesmo jeito que ignoraria uma chave.
    metricaLider: null,
  })),
});

describe('montarPlano — o inventário de hoje, contra a lista da spec', () => {
  // O dia em que a story foi escrita: é dele que sai a conta de 53 períodos.
  const HOJE = new Date(2026, 8, 23, 12);
  const plano = montarPlano(
    periodosFechadosDesde(COMECO_DO_ARQUIVO, HOJE),
    ARQUIVO_DE_PRODUCAO.map((e) => noArquivo(e)),
    HOJE,
  );
  const contas = contasDoPlano(plano);
  const de = (tipo: string, inicio: string): ItemDoPlano | undefined =>
    plano.find((i) => i.tipo === tipo && i.inicio === inicio);

  it('cerca de 50 a imprimir, CINCO a reimprimir e o restante a pular', () => {
    assert.equal(contas.imprimir, 48);
    assert.equal(contas.reimprimir, 5);
    assert.equal(contas.pular, 6);
    // 53 enumerados + o ano de 2023 e as 5 semanas, que só o arquivo tem.
    assert.equal(plano.length, 59);
  });

  it('as cinco reimpressões são exatamente as que o dono nomeou', () => {
    const reimpressas = plano.filter((i) => i.acao === 'reimprimir').map((i) => `${i.tipo} ${i.inicio}`);
    assert.deepEqual([...reimpressas].sort(), [...A_REIMPRIMIR].map((n) => `${n.tipo} ${n.inicio}`).sort());
    assert.equal(A_REIMPRIMIR.length, 5);
    // E cada uma carrega o motivo do dono, que vai para a tela.
    for (const i of plano.filter((x) => x.acao === 'reimprimir')) assert.ok(i.motivo, `${i.rotulo} sem motivo`);
  });

  it('junho de 2026 é pulado: existe, e o dono decidiu que nada nela muda', () => {
    const junho = de('month', '2026-06-01');
    assert.equal(junho?.acao, 'pular');
    assert.match(junho?.motivo ?? '', /já impresso/);
  });

  it('as cinco semanas do arquivo são puladas, e nenhuma é impressa nem reimpressa', () => {
    const semanas = plano.filter((i) => i.tipo === 'week');
    assert.equal(semanas.length, 5);
    for (const s of semanas) {
      assert.equal(s.acao, 'pular', s.inicio);
      assert.match(s.motivo ?? '', /semana não grava edição/);
    }
  });

  it('o ano de 2023 entra pelo arquivo, embora comece antes do começo do arquivo', () => {
    assert.ok(!periodosFechadosDesde(COMECO_DO_ARQUIVO, HOJE).some((p) => p.inicio === '2023-01-01'));
    assert.equal(de('year', '2023-01-01')?.acao, 'reimprimir');
  });

  it('a conta de chamadas e o tempo saem do que a corrida vai tocar', () => {
    assert.equal(contas.chamadas, (48 + 5) * 4);
    // 212 chamadas × 13,6 s ≈ 48 min — o tamanho que vai para a tela antes do "sim".
    assert.equal(contas.minutos, 48);
  });

  it('a ordem é cronológica pelo fim do período, semanas incluídas', () => {
    for (let k = 1; k < plano.length; k += 1) {
      assert.ok(plano[k - 1]!.fim <= plano[k]!.fim, `${plano[k - 1]!.rotulo} veio depois de ${plano[k]!.rotulo}`);
    }
    assert.equal(plano[0]?.inicio, '2023-06-01');
  });
});

describe('montarPlano — o recorte por tipo (--tipo)', () => {
  const HOJE = new Date(2026, 8, 23, 12);
  const planoDeAno = montarPlano(
    periodosFechadosDesde(COMECO_DO_ARQUIVO, HOJE).filter((p) => p.tipo === 'year'),
    ARQUIVO_DE_PRODUCAO.map((e) => noArquivo(e)),
    HOJE,
    A_REIMPRIMIR,
    'year',
  );

  /**
   * O furo que a revisão reproduziu: o recorte valia só para a enumeração, e o
   * arquivo entrava inteiro — os quatro **meses** nomeados viravam `reimprimir`
   * sob `--tipo year`, 16 chamadas pagas de um tipo excluído.
   */
  it('os meses nomeados NÃO viram reimpressão sob --tipo year', () => {
    const contas = contasDoPlano(planoDeAno);
    assert.equal(contas.reimprimir, 1, 'só o ano de 2023 pode ser reimpresso sob --tipo year');
    for (const n of A_REIMPRIMIR.filter((x) => x.tipo === 'month')) {
      const item = planoDeAno.find((i) => i.tipo === n.tipo && i.inicio === n.inicio);
      assert.equal(item?.acao, 'pular', `${n.tipo} ${n.inicio}`);
      assert.match(item?.motivo ?? '', /fora do --tipo ano/);
    }
  });

  it('o que fica fora do recorte continua aparecendo no plano, como pulado', () => {
    // O inventário não some: o dono vê as 11 edições do arquivo de qualquer jeito.
    for (const e of ARQUIVO_DE_PRODUCAO) {
      assert.ok(planoDeAno.some((i) => i.tipo === e.tipoPeriodo && i.inicio === e.inicio), `${e.tipoPeriodo} ${e.inicio}`);
    }
    assert.deepEqual(planoDeAno.filter((i) => i.acao === 'imprimir').map((i) => i.inicio), ['2024-01-01', '2025-01-01']);
  });
});

describe('nomeadosForaDoPlano — o erro de digitação que somia calado', () => {
  const HOJE = new Date(2026, 8, 23, 12);
  const plano = montarPlano(
    periodosFechadosDesde(COMECO_DO_ARQUIVO, HOJE),
    ARQUIVO_DE_PRODUCAO.map((e) => noArquivo(e)),
    HOJE,
  );

  it('a lista do dono está inteira no plano de hoje', () => {
    assert.deepEqual(nomeadosForaDoPlano(plano), []);
  });

  it('um começo que não abre período nenhum é acusado', () => {
    // `2023-09-02` não abre mês, não é enumerado e não está no arquivo.
    const errado = [...A_REIMPRIMIR, nomeado('month', '2023-09-02')];
    const semPlano = montarPlano(periodosFechadosDesde(COMECO_DO_ARQUIVO, HOJE), ARQUIVO_DE_PRODUCAO.map((e) => noArquivo(e)), HOJE, errado);
    assert.deepEqual(nomeadosForaDoPlano(semPlano, errado).map((n) => n.inicio), ['2023-09-02']);
  });

  it('o que o --tipo excluiu não é acusado: ele não sumiu, foi recortado', () => {
    const doAno = montarPlano(
      periodosFechadosDesde(COMECO_DO_ARQUIVO, HOJE).filter((p) => p.tipo === 'year'),
      ARQUIVO_DE_PRODUCAO.map((e) => noArquivo(e)), HOJE, A_REIMPRIMIR, 'year',
    );
    assert.deepEqual(nomeadosForaDoPlano(doAno, A_REIMPRIMIR, 'year'), []);
  });
});

describe('montarPlano — a retomada é o banco', () => {
  const HOJE = new Date(2026, 8, 23, 12);
  const comPacote = (...pacotes: number[]) =>
    montarPlano(
      periodosFechadosDesde(COMECO_DO_ARQUIVO, HOJE),
      ARQUIVO_DE_PRODUCAO.map((e) => (e.inicio === '2023-09-01' ? noArquivo(e, ...pacotes) : noArquivo(e))),
      HOJE,
    );

  it('o limiar de cada nomeada é anterior ao pacote de hoje — senão a reimpressão nunca conta', () => {
    // Derivado do núcleo, não fixado à mão: `PACOTE_VERSAO` é a versão que a
    // reimpressão vai gravar, e ela tem de ficar ACIMA do que está no banco.
    for (const n of A_REIMPRIMIR) {
      assert.ok(
        PACOTE_VERSAO > n.pacoteImpresso,
        `${n.tipo} ${n.inicio}: pacoteImpresso ${n.pacoteImpresso} não é menor que o PACOTE_VERSAO ${PACOTE_VERSAO} de hoje`,
      );
    }
  });

  it('a nomeada que JÁ foi reimpressa vira "pular" — rodar de novo não a paga outra vez', () => {
    const antes = comPacote(3).find((i) => i.inicio === '2023-09-01');
    assert.equal(antes?.acao, 'reimprimir');
    const depois = comPacote(PACOTE_VERSAO).find((i) => i.inicio === '2023-09-01');
    assert.equal(depois?.acao, 'pular');
    assert.match(depois?.motivo ?? '', /já reimpressa/);
    assert.equal(contasDoPlano(comPacote(PACOTE_VERSAO)).reimprimir, 4);
  });

  /**
   * O defeito que a revisão achou: com `some`, **um** caderno reescrito pelo
   * telefone (a errata por caderno da 1.11) fazia a edição inteira passar por
   * renovada, e os outros três ficavam com o zero falso para sempre.
   */
  it('um caderno na versão nova NÃO basta: a edição só conta como renovada por inteiro', () => {
    const meiaReimpressa = comPacote(PACOTE_VERSAO, 3, 3, 3).find((i) => i.inicio === '2023-09-01');
    assert.equal(meiaReimpressa?.acao, 'reimprimir', 'um caderno novo já valeu pela edição inteira');
    const inteira = comPacote(PACOTE_VERSAO, PACOTE_VERSAO, PACOTE_VERSAO, PACOTE_VERSAO)
      .find((i) => i.inicio === '2023-09-01');
    assert.equal(inteira?.acao, 'pular');
  });

  it('o que já foi impresso nesta corrida some da lista na corrida seguinte', () => {
    const arquivo = ARQUIVO_DE_PRODUCAO.map((e) => noArquivo(e));
    const antes = montarPlano(periodosFechadosDesde(COMECO_DO_ARQUIVO, HOJE), arquivo, HOJE);
    assert.equal(antes.find((i) => i.inicio === '2024-03-01' && i.tipo === 'month')?.acao, 'imprimir');
    // A corrida gravou março de 2024; a enumeração seguinte o acha no arquivo.
    const depois = montarPlano(
      periodosFechadosDesde(COMECO_DO_ARQUIVO, HOJE),
      [...arquivo, noArquivo({ tipoPeriodo: 'month', inicio: '2024-03-01', fim: '2024-03-31' }, PACOTE_VERSAO)],
      HOJE,
    );
    assert.equal(depois.find((i) => i.inicio === '2024-03-01' && i.tipo === 'month')?.acao, 'pular');
    assert.equal(contasDoPlano(depois).imprimir, 47);
  });

  it('um período nomeado que ainda não existe é impressão normal, não reimpressão', () => {
    // Sem o ano de 2023 no arquivo, ele some do plano: não é enumerado.
    const semAno = ARQUIVO_DE_PRODUCAO.filter((e) => e.inicio !== '2023-01-01').map((e) => noArquivo(e));
    const plano = montarPlano(periodosFechadosDesde(COMECO_DO_ARQUIVO, HOJE), semAno, HOJE);
    assert.equal(plano.find((i) => i.tipo === 'year' && i.inicio === '2023-01-01'), undefined);
    // Mas um mês nomeado e ainda não impresso é "imprimir", com o motivo do dono à vista.
    const semJulho = ARQUIVO_DE_PRODUCAO.filter((e) => e.inicio !== '2026-07-01').map((e) => noArquivo(e));
    const outro = montarPlano(periodosFechadosDesde(COMECO_DO_ARQUIVO, HOJE), semJulho, HOJE);
    const julho = outro.find((i) => i.tipo === 'month' && i.inicio === '2026-07-01');
    assert.equal(julho?.acao, 'imprimir');
    assert.match(julho?.motivo ?? '', /lápide/);
  });
});

/* ── o plano de um caderno só (--massa --caderno, Story 2.8) ─────────────── */

/**
 * A campanha de **palavras**: o prompt mudou, o pacote não, e o que precisa ser
 * reescrito é quem tem *aquele* caderno abaixo do prompt de hoje.
 *
 * O critério troca por inteiro — a lista nomeada em `A_REIMPRIMIR` é de outra
 * campanha, e os ~48 períodos por imprimir não entram: um caderno só não é uma
 * edição para nascer.
 */
describe('montarPlano — o critério de um caderno só', () => {
  const HOJE = new Date(2026, 8, 23, 12);
  const OS_QUATRO = ['sono', 'movimento', 'rotina', 'coracao'] as const;
  const VELHO = PROMPT_VERSAO - 1;

  /** O arquivo de produção, com os prompts que cada edição tiver. */
  const planoDe = (prompts: (e: { inicio: string }) => readonly number[], caderno: CadernoId = 'rotina') =>
    montarPlano(
      periodosFechadosDesde(COMECO_DO_ARQUIVO, HOJE),
      ARQUIVO_DE_PRODUCAO.map((e) => comPrompt(e, prompts(e), 3, 3, 3, 3)),
      HOJE,
      A_REIMPRIMIR,
      null,
      caderno,
    );

  const todosVelhos = () => planoDe(() => OS_QUATRO.map(() => VELHO));

  /**
   * O script não importa `PROMPT_VERSAO`: ele decodifica a versão do **descritor**
   * que já entrega à sequência, que é a mesma conta com que a sequência escreve a
   * coluna `prompt_versao` (a guarda (7) do `architecture.test.ts` barra o caminho
   * direto — AD-2). Este teste prende os dois números um ao outro: se um dia eles
   * discordarem, o plano classificaria o arquivo por um número que a gravação não
   * carimba, e a corrida nunca convergiria.
   */
  it('o prompt de hoje que o plano usa é o que a gravação carimba', () => {
    assert.equal(versoesDaRetrospectiva(descritorDaRetrospectiva.versao).prompt, PROMPT_VERSAO);
  });

  it('reimprime só as edições que TÊM o caderno abaixo do prompt de hoje', () => {
    const plano = todosVelhos();
    const reimpressas = plano.filter((i) => i.acao === 'reimprimir');
    // As onze edições do arquivo, menos as cinco semanas — que nunca entram.
    assert.equal(reimpressas.length, 6);
    assert.ok(reimpressas.every((i) => i.tipo !== 'week'));
    for (const i of reimpressas) assert.match(i.motivo ?? '', new RegExp(`rotina no prompt ${VELHO} \\(hoje ${PROMPT_VERSAO}\\)`));
  });

  /**
   * A semana é pulada **pelo motivo dela**, e não por acaso — ela tem `rotina`
   * no prompt velho, e o critério de versão a classificaria como `reimprimir`.
   * O critério parcial precisa da mesma guarda que o nomeado, e ela precisa dizer
   * a mesma frase: as duas saem de `SEMANA_FORA`.
   */
  it('a semana é pulada POR SER semana, e com a mesma frase dos dois critérios', () => {
    const semanas = todosVelhos().filter((i) => i.tipo === 'week');
    assert.equal(semanas.length, 5);
    for (const s of semanas) {
      assert.equal(s.acao, 'pular', s.inicio);
      assert.match(s.motivo ?? '', /semana não grava edição em massa — o postal da Retrospectiva a calcula na hora/);
    }
    // A mesma frase, palavra por palavra, nos dois critérios.
    const peloNomeado = montarPlano(periodosFechadosDesde(COMECO_DO_ARQUIVO, HOJE), ARQUIVO_DE_PRODUCAO.map((e) => noArquivo(e)), HOJE)
      .find((i) => i.tipo === 'week');
    assert.equal(semanas[0]?.motivo, peloNomeado?.motivo);
  });

  it('período SEM edição é pulado: --caderno corrige o que existe, não faz nascer edição de um caderno', () => {
    const plano = todosVelhos();
    // Abril de 2024 é enumerado e não está no arquivo — na campanha da 2.3 ele seria "imprimir".
    const abril = plano.find((i) => i.tipo === 'month' && i.inicio === '2024-04-01');
    assert.equal(abril?.acao, 'pular');
    assert.match(abril?.motivo ?? '', /sem edição — --caderno rotina só corrige o que já está impresso/);
    assert.equal(plano.filter((i) => i.acao === 'imprimir').length, 0, 'a campanha de um caderno mandou imprimir algo novo');
  });

  it('a edição que não TEM o caderno pedido é pulada, e o motivo diz quais ela tem', () => {
    const plano = montarPlano(
      periodosFechadosDesde(COMECO_DO_ARQUIVO, HOJE),
      // Só dois cadernos gravados: sono e movimento.
      ARQUIVO_DE_PRODUCAO.map((e) => comPrompt(e, [VELHO, VELHO], 3, 3)),
      HOJE, A_REIMPRIMIR, null, 'rotina',
    );
    const setembro = plano.find((i) => i.tipo === 'month' && i.inicio === '2023-09-01');
    assert.equal(setembro?.acao, 'pular');
    assert.match(setembro?.motivo ?? '', /a edição não tem o caderno rotina \(sono, movimento\)/);
  });

  /** A terceira linha da aceitação: a segunda corrida não gasta nada. */
  it('rodado duas vezes, a segunda não tem nada a fazer — a retomada é o banco', () => {
    const antes = todosVelhos();
    assert.ok(contasDoPlano(antes, null, 1).reimprimir > 0);
    // A corrida gravou: o `rotina` de cada edição nasceu no prompt corrente, e
    // os outros três continuam no de antes, porque a parcial não os tocou.
    const depois = planoDe(() => OS_QUATRO.map((c) => (c === 'rotina' ? PROMPT_VERSAO : VELHO)));
    const contas = contasDoPlano(depois, null, 1);
    assert.equal(contas.reimprimir, 0);
    assert.equal(contas.imprimir, 0);
    assert.equal(contas.chamadas, 0, 'a segunda corrida gastaria chamadas');
    assert.match(
      depois.find((i) => i.tipo === 'month' && i.inicio === '2023-09-01')?.motivo ?? '',
      new RegExp(`rotina já está no prompt ${PROMPT_VERSAO}`),
    );
  });

  /**
   * O motivo do `pular` cita **a versão da linha**, e não o limiar.
   *
   * O caso que separa os dois é a linha **à frente** do prompt de hoje — o que se
   * vê ao rodar um binário antigo depois de um mais novo ter gravado. Dizer "já
   * está no prompt 6" sobre uma linha no 7 esconde justamente isso.
   */
  it('o motivo do pular cita a versão DA LINHA, e distingue "em dia" de "à frente"', () => {
    const emDia = planoDe(() => OS_QUATRO.map((c) => (c === 'rotina' ? PROMPT_VERSAO : VELHO)));
    assert.match(
      emDia.find((i) => i.tipo === 'month' && i.inicio === '2023-09-01')?.motivo ?? '',
      new RegExp(`^rotina já está no prompt ${PROMPT_VERSAO}$`),
    );
    const adiante = planoDe(() => OS_QUATRO.map((c) => (c === 'rotina' ? PROMPT_VERSAO + 1 : VELHO)));
    const motivo = adiante.find((i) => i.tipo === 'month' && i.inicio === '2023-09-01')?.motivo ?? '';
    assert.match(motivo, new RegExp(`rotina está no prompt ${PROMPT_VERSAO + 1}, à frente do de hoje \\(${PROMPT_VERSAO}\\)`));
    // E o número da LINHA aparece, não só o limiar.
    assert.ok(motivo.includes(String(PROMPT_VERSAO + 1)), motivo);
    assert.equal(adiante.find((i) => i.tipo === 'month' && i.inicio === '2023-09-01')?.acao, 'pular');
  });

  it('a lista nomeada da 2.3 não é o critério: julho de 2026 é pulado se o rotina dele já está em dia', () => {
    const plano = planoDe((e) => (e.inicio === '2026-07-01'
      ? OS_QUATRO.map((c) => (c === 'rotina' ? PROMPT_VERSAO : VELHO))
      : OS_QUATRO.map(() => VELHO)));
    const julho = plano.find((i) => i.tipo === 'month' && i.inicio === '2026-07-01');
    // Ele é uma das cinco de `A_REIMPRIMIR`, e mesmo assim é pulado aqui.
    assert.ok(A_REIMPRIMIR.some((n) => n.inicio === '2026-07-01'));
    assert.equal(julho?.acao, 'pular');
  });

  it('a conta de chamadas é UMA por período — é isso que o dono autoriza', () => {
    const plano = todosVelhos();
    assert.equal(contasDoPlano(plano, null, 1).chamadas, contasDoPlano(plano, null, 1).aFazer);
    // A mesma lista pelos quatro cadernos custaria quatro vezes.
    assert.equal(contasDoPlano(plano).chamadas, contasDoPlano(plano, null, 1).chamadas * 4);
  });

  it('outro caderno, outra lista: o pedido é que decide, e não uma campanha global', () => {
    const plano = planoDe(() => OS_QUATRO.map((c) => (c === 'sono' ? PROMPT_VERSAO : VELHO)), 'sono');
    assert.equal(plano.filter((i) => i.acao === 'reimprimir').length, 0);
    const porRotina = planoDe(() => OS_QUATRO.map((c) => (c === 'sono' ? PROMPT_VERSAO : VELHO)), 'rotina');
    assert.equal(porRotina.filter((i) => i.acao === 'reimprimir').length, 6);
  });
});

describe('a corrida em massa', () => {
  it('o plano, sem o "sim": lista tudo, não chama modelo nenhum e não grava nada', async () => {
    const banco = bancoFalso({
      edicao: [
        ...edicaoNoBanco('month', INICIO, FIM, ['sono']),
        ...edicaoNoBanco('week', '2026-05-25', '2026-05-31', ['rotina']),
        ...edicaoNoBanco('month', '2023-09-01', '2023-09-30', ['rotina']),
        ...edicaoNoBanco('month', '2023-10-01', '2023-10-31', ['rotina']),
        ...edicaoNoBanco('year', '2023-01-01', '2023-12-31', ['rotina']),
      ],
    });
    const { relatorio, nuvem, capa, t } = await massaPeloScript({ banco });
    assert.equal(relatorio.codigo, 0);
    assert.equal(relatorio.corrida, null, 'a corrida rodou sem o "sim"');
    assert.equal(nuvem.pedidos.length, 0, 'o modelo foi chamado no plano');
    assert.equal(banco.rpcs.length, 0, 'algo foi gravado no plano');
    assert.equal(capa.carimbadas.length, 0);
    // 49 períodos fechados em 10/06/2026, mais o ano de 2023 e a semana, que só o arquivo tem.
    assert.equal(relatorio.contas.imprimir, 46);
    assert.equal(relatorio.contas.reimprimir, 3);
    assert.equal(relatorio.contas.pular, 2);
    const saida = t.out.join('\n');
    assert.match(saida, /imprimir: 46 · reimprimir: 3 · pular: 2/);
    assert.match(saida, /até 196 chamadas de nuvem/);
    assert.match(saida, /--sim-gastar-chamadas/);
    semTexto(t);
  });

  it('com o "sim": imprime pela mesma porta, grava o GABARITO e carimba a capa', async () => {
    const { relatorio, banco, nuvem, capa } = await massaPeloScript({
      sim: true,
      enumerar: () => [MAIO],
    });
    assert.equal(relatorio.codigo, 0);
    assert.equal(nuvem.pedidos.length, 4);
    assert.equal(banco.rpcs.length, 1);
    assert.deepStrictEqual(banco.rpcs[0]!.args, GABARITO.carga);
    assert.deepEqual(relatorio.corrida?.map((c) => [c.acao, c.inicio, c.desfecho, c.chamadas]), [
      ['imprimir', INICIO, 'gravada', 4],
    ]);
    // A capa é carimbada na impressão que gravou, e nunca depois. `grade` porque
    // a fixture não tem foto nem rota — que é exatamente o caso dos períodos
    // antigos do arquivo, e o que faz a fronteira de 2025 ser visível na parede.
    assert.deepEqual(capa.carimbadas, [{ inicio: INICIO, natureza: 'grade' }]);
  });

  it('a reimpressão nomeada: sobre a edição que já existe, escreve os cadernos e recarimba a capa', async () => {
    const banco = bancoFalso({ edicao: [cadernoImpressoDeMaio('coracao', 1), cadernoImpressoDeMaio('rotina', 2)] });
    const { relatorio, nuvem, capa, t } = await massaPeloScript({
      banco,
      sim: true,
      enumerar: () => [MAIO],
      nomeados: [nomeado('month', INICIO, 'zero falso, para o teste')],
    });
    assert.equal(relatorio.codigo, 0);
    assert.equal(relatorio.corrida?.[0]?.acao, 'reimprimir');
    assert.equal(relatorio.corrida?.[0]?.desfecho, 'gravada');
    // Os quatro cadernos foram pedidos — não é impressão parcial.
    assert.equal(nuvem.pedidos.length, 4);
    assert.equal(banco.rpcs.length, 1);
    // E a capa é recarimbada pela reimpressão, como no telefone.
    assert.deepEqual(capa.carimbadas.map((c) => c.inicio), [INICIO]);
    assert.match(t.out.join('\n'), /zero falso, para o teste/);
    semTexto(t);
  });

  it('nada é reimpresso sem ser nomeado: o já impresso fora da lista é pulado, sem chamada paga', async () => {
    const banco = bancoFalso({ edicao: [cadernoImpressoDeMaio('rotina', 1)] });
    const { relatorio, nuvem } = await massaPeloScript({
      banco,
      sim: true,
      enumerar: () => [MAIO],
      nomeados: [],
    });
    assert.equal(relatorio.codigo, 0);
    assert.deepEqual(relatorio.corrida, []);
    assert.equal(nuvem.pedidos.length, 0);
    assert.equal(banco.rpcs.length, 0);
    assert.equal(relatorio.plano[0]?.acao, 'pular');
  });

  it('a falha de um período não derruba a corrida: ela segue, e o relatório diz quais falharam', async () => {
    const { relatorio, banco, capa, t } = await massaPeloScript({
      sim: true,
      // Ordem cronológica: o inválido (fim em janeiro de 2025) vem antes de maio de 2026.
      enumerar: () => [MAIO, invalido('2025-01-15', 'Janeiro 2025')],
    });
    assert.equal(relatorio.codigo, 1, 'a corrida com falha tem de sair ≠ 0');
    assert.deepEqual(relatorio.corrida?.map((c) => c.inicio), ['2025-01-15', INICIO]);
    assert.equal(relatorio.corrida?.[0]?.desfecho, 'falhou');
    assert.equal(relatorio.corrida?.[1]?.desfecho, 'gravada');
    // O que falhou não gravou nada, e o que veio depois gravou.
    assert.equal(banco.rpcs.length, 1);
    assert.equal(banco.rpcs[0]!.args.p_inicio, INICIO);
    assert.deepEqual(capa.carimbadas.map((c) => c.inicio), [INICIO]);
    const saida = t.out.join('\n');
    assert.match(saida, /gravadas: 1 · puladas: 0 · falhadas: 1/);
    assert.match(saida, /as que falharam, e que rodar de novo tenta outra vez/);
    assert.match(saida, /2025-01-15/);
  });

  /**
   * **Mudez não é falha** (Story 2.8): o período sem nada a dizer é `pulada`, a
   * corrida sai 0 e o freio não o conta.
   *
   * Antes da 2.8 ele era `falhou`, e isso tinha duas consequências ruins — a
   * corrida saía ≠ 0 por um período que não tinha problema nenhum, e três meses
   * vazios em sequência (o começo do arquivo, em 2023) paravam a corrida
   * anunciando "o token que venceu, cota, ou a nuvem recusando".
   */
  it('período sem nada a dizer é PULADO, não falha — e não alimenta o freio', async () => {
    const vazios = ['2025-01-01', '2025-02-01', '2025-03-01', '2025-04-01'].map((inicio, k) => ({
      tipo: 'month' as const, inicio, fim: `2025-0${k + 1}-28`, offset: -17 + k, rotulo: `Mês ${k + 1} de 2025`,
    }));
    const { relatorio, nuvem, banco, t } = await massaPeloScript({ sim: true, enumerar: () => vazios });
    assert.equal(relatorio.codigo, 0, 'quatro períodos mudos fizeram a corrida sair ≠ 0');
    assert.equal(relatorio.freada, false, 'a mudez alimentou o freio');
    assert.equal(relatorio.corrida?.length, 4, 'a corrida parou antes do fim');
    for (const c of relatorio.corrida ?? []) {
      assert.equal(c.desfecho, 'pulada', c.rotulo);
      assert.equal(c.chamadas, 0, 'um período mudo custou chamada');
      assert.match(c.erro ?? '', /nada a dizer/);
    }
    assert.equal(nuvem.pedidos.length, 0);
    assert.equal(banco.rpcs.length, 0);
    assert.match(t.out.join('\n'), /falhadas: 0/);
    assert.doesNotMatch(t.err.join('\n'), /falhas seguidas/);
    // **Pulado não é escondido.** Sair 0 sobre quatro períodos que não gravaram
    // nada só é honesto se eles aparecerem nomeados, com o motivo.
    const saida = t.out.join('\n');
    assert.match(saida, /as que a corrida pulou, e por quê \(nenhuma é falha\)/);
    for (const c of relatorio.corrida ?? []) assert.ok(saida.includes(c.rotulo), c.rotulo);
  });

  /**
   * O irmão de cima, no outro estado: o caderno **foi lido e caiu no piso**
   * (`nada-gravado`). Custou chamada, a linha antiga dele fica, e a corrida
   * seguinte o tenta de novo — mas também não é causa comum, e não freia.
   */
  it('período em que nenhum caderno passou na conferência é PULADO, e custou as chamadas', async () => {
    const nuvem = nuvemFalsa({ texto: () => 'Foram 999 coisas, contra 998 em abril.' });
    const { relatorio, banco, t } = await massaPeloScript({ sim: true, nuvem, enumerar: () => [MAIO] });
    assert.equal(relatorio.codigo, 0);
    assert.equal(relatorio.corrida?.[0]?.desfecho, 'pulada');
    assert.match(relatorio.corrida?.[0]?.erro ?? '', /nenhum caderno passou na conferência/);
    assert.equal(relatorio.corrida?.[0]?.chamadas, 4, 'o piso não cobra as chamadas que foram pagas');
    assert.equal(banco.rpcs.length, 0, 'gravou apesar de nada ter passado');
    assert.match(t.out.join('\n'), /falhadas: 0/);
  });

  it('a retomada: a segunda corrida pula o que a primeira gravou, sem chamada nova', async () => {
    const banco = bancoFalso();
    const primeira = await massaPeloScript({ banco, sim: true, enumerar: () => [MAIO] });
    assert.equal(primeira.relatorio.codigo, 0);
    assert.equal(banco.rpcs.length, 1);

    const segunda = await massaPeloScript({ banco, sim: true, enumerar: () => [MAIO] });
    assert.equal(segunda.relatorio.codigo, 0);
    assert.equal(segunda.nuvem.pedidos.length, 0, 'a segunda corrida chamou o modelo de novo');
    assert.equal(banco.rpcs.length, 1, 'a segunda corrida gravou de novo');
    assert.equal(segunda.relatorio.contas.pular, 1);
    assert.deepEqual(segunda.relatorio.corrida, []);
    assert.equal(segunda.capa.carimbadas.length, 0);
  });

  it('a capa que falha vira aviso: a edição fica gravada, e a corrida sai 0', async () => {
    const capa = capaFalsa({ falhar: new Error('o carimbo recusou') });
    const { relatorio, banco, t } = await massaPeloScript({ sim: true, capa, enumerar: () => [MAIO] });
    assert.equal(relatorio.codigo, 0, 'a falha da capa derrubou a corrida');
    assert.equal(banco.rpcs.length, 1, 'a edição não foi gravada');
    assert.equal(relatorio.corrida?.[0]?.desfecho, 'gravada');
    assert.match(relatorio.corrida?.[0]?.avisoDaCapa ?? '', /o carimbo recusou/);
    assert.match(t.err.join('\n'), /não foi carimbada/);
    assert.match(t.out.join('\n'), /sem capa/);
  });

  it('--tipo recorta a enumeração, e o arquivo continua sendo lido inteiro', async () => {
    const banco = bancoFalso({ edicao: edicaoNoBanco('week', '2026-05-25', '2026-05-31', ['rotina']) });
    const { relatorio } = await massaPeloScript({ banco, tipo: 'year' });
    // Só os dois anos fechados (2024 e 2025) — mais a semana do arquivo, pulada.
    assert.equal(relatorio.contas.imprimir, 2);
    assert.equal(relatorio.contas.pular, 1);
    assert.deepEqual(
      relatorio.plano.filter((i) => i.acao === 'imprimir').map((i) => i.inicio),
      ['2024-01-01', '2025-01-01'],
    );
  });

  it('--exportar grava o texto de agora das nomeadas, e não chama nem grava nada', async () => {
    const banco = bancoFalso({
      edicao: [
        ...edicaoNoBanco('month', '2023-09-01', '2023-09-30', ['rotina', 'movimento']),
        ...edicaoNoBanco('month', '2023-10-01', '2023-10-31', ['sono']),
      ],
    });
    const { relatorio, nuvem, arquivos, capa } = await massaPeloScript({ banco, exportar: '/tmp/edicoes.md' });
    assert.equal(relatorio.codigo, 0);
    assert.equal(relatorio.exportado, '/tmp/edicoes.md');
    assert.equal(relatorio.corrida, null);
    assert.equal(nuvem.pedidos.length, 0);
    assert.equal(banco.rpcs.length, 0);
    assert.equal(capa.carimbadas.length, 0);
    const md = arquivos['/tmp/edicoes.md'] ?? '';
    // O texto aparece no arquivo — é o destino dele —, com a assinatura de cada caderno.
    assert.match(md, /texto antigo de rotina em 2023-09-01/);
    assert.match(md, /texto antigo de movimento em 2023-09-01/);
    assert.match(md, /texto antigo de sono em 2023-10-01/);
    assert.match(md, /pacote_versao 3/);
    assert.match(md, /gramática da ausência/);
  });

  /* ── o que a revisão da 2.3 fechou ─────────────────────────────────────── */

  it('a capa que o dono trocou à mão é MANTIDA — a reimpressão não a desfaz', async () => {
    const banco = bancoFalso({ edicao: [cadernoImpressoDeMaio('rotina', 1)] });
    const capa = capaFalsa({ existente: { motivo: 'trocada', natureza: 'foto' } });
    const { relatorio, t } = await massaPeloScript({
      banco, capa, sim: true, enumerar: () => [MAIO], nomeados: [nomeado('month', INICIO)],
    });
    assert.equal(relatorio.codigo, 0);
    assert.equal(relatorio.corrida?.[0]?.desfecho, 'gravada', 'a edição não foi gravada');
    assert.deepEqual(capa.carimbadas, [], 'a troca do dono foi sobrescrita');
    assert.match(t.out.join('\n'), /capa: foto — mantida, porque você a trocou à mão/);
  });

  it('a capa escolhida pelo app é recarimbada: só `trocada` é mantida', async () => {
    const banco = bancoFalso({ edicao: [cadernoImpressoDeMaio('rotina', 1)] });
    const capa = capaFalsa({ existente: { motivo: 'rajada', natureza: 'foto' } });
    await massaPeloScript({ banco, capa, sim: true, enumerar: () => [MAIO], nomeados: [nomeado('month', INICIO)] });
    assert.deepEqual(capa.carimbadas.map((c) => c.inicio), [INICIO]);
  });

  it('a leitura da capa que falha não carimba nada — apagar a troca é pior que ficar sem capa', async () => {
    const capa = capaFalsa({ falharLeitura: new Error('a leitura da capa caiu') });
    const { relatorio, banco, t } = await massaPeloScript({ capa, sim: true, enumerar: () => [MAIO] });
    assert.equal(relatorio.codigo, 0);
    assert.equal(banco.rpcs.length, 1, 'a edição não foi gravada');
    assert.deepEqual(capa.carimbadas, []);
    assert.match(relatorio.corrida?.[0]?.avisoDaCapa ?? '', /para não apagar uma troca sua/);
    assert.match(t.err.join('\n'), /não foi carimbada/);
  });

  it('a corrida recusa começar sem as portas da capa — nada é chamado nem gravado', async () => {
    const { relatorio, banco, nuvem, t } = await massaPeloScript({
      sim: true, semCapa: true, enumerar: () => [MAIO],
    });
    assert.equal(relatorio.codigo, 1);
    assert.equal(relatorio.corrida, null);
    assert.equal(nuvem.pedidos.length, 0);
    assert.equal(banco.rpcs.length, 0);
    assert.match(t.err.join('\n'), /faltam as portas da capa/);
  });

  it('o plano NÃO exige as portas da capa: ele não grava nada', async () => {
    const { relatorio } = await massaPeloScript({ semCapa: true, enumerar: () => [MAIO] });
    assert.equal(relatorio.codigo, 0);
    assert.equal(relatorio.contas.imprimir, 1);
  });

  it('--limite recorta a corrida, e a conta de chamadas do plano acompanha', async () => {
    const { relatorio, banco, nuvem, t } = await massaPeloScript({
      sim: true, limite: 1, enumerar: () => [MAIO, JANEIRO_2025],
    });
    // Janeiro de 2025 vem primeiro na ordem cronológica, e é o único tentado.
    assert.equal(relatorio.corrida?.length, 1);
    assert.equal(relatorio.corrida?.[0]?.inicio, '2025-01-01');
    assert.equal(relatorio.contas.imprimir, 2);
    assert.equal(relatorio.contas.aFazer, 1);
    assert.equal(relatorio.contas.chamadas, 4);
    assert.equal(banco.rpcs.length, 0, 'maio foi impresso, e o limite era 1');
    assert.equal(nuvem.pedidos.length, 0, 'janeiro de 2025 não tem o que narrar');
    assert.match(t.out.join('\n'), /--limite 1: a corrida toca só 1 período/);
  });

  it('o período que outro hospedeiro imprimiu no meio é PULADO, não falha — e a corrida sai 0', async () => {
    // A edição de maio aparece entre o plano e a corrida: o `buscar` da sequência a acha.
    const banco = bancoFalso({
      aoLer: (tabela, vez, tabelas) => {
        if (tabela === 'health_daily' && vez === 1) tabelas.edicoes_ia.push(cadernoImpressoDeMaio('rotina', 1));
      },
    });
    const { relatorio, t } = await massaPeloScript({ banco, sim: true, enumerar: () => [MAIO] });
    assert.equal(relatorio.codigo, 0, 'o já impresso por outro hospedeiro contou como falha');
    assert.equal(relatorio.corrida?.[0]?.desfecho, 'pulada');
    assert.match(relatorio.corrida?.[0]?.erro ?? '', /outro hospedeiro/);
    assert.match(t.out.join('\n'), /falhadas: 0/);
  });

  it('três falhas seguidas param a corrida: causa comum não custa os cinquenta', async () => {
    // Cinco períodos que não se validam: falha de verdade, uma atrás da outra.
    // (Desde a 2.8 "sem acervo" não serve aqui — é mudez, e mudez não freia.)
    const ruins = ['2024-01-15', '2024-02-15', '2024-03-15', '2024-04-15', '2024-05-15'].map(
      (inicio, k) => ({ ...invalido(inicio, `Mês ${k + 1} de 2024`), fim: `2024-0${k + 1}-28`, offset: -29 + k }),
    );
    const { relatorio, t } = await massaPeloScript({ sim: true, enumerar: () => ruins });
    assert.equal(relatorio.codigo, 1);
    assert.equal(relatorio.freada, true);
    assert.equal(relatorio.corrida?.length, 3, 'a corrida não parou na terceira falha seguida');
    assert.match(t.err.join('\n'), /parou depois de 3 falhas seguidas/);
    assert.match(t.out.join('\n'), /não tentadas: 2/);
  });

  it('falha isolada NÃO para a corrida: o contador zera a cada sucesso', async () => {
    const { relatorio } = await massaPeloScript({
      sim: true,
      // falha, sucesso, falha — nunca três seguidas.
      enumerar: () => [invalido('2025-01-15', 'Janeiro 2025'), MAIO, invalido('2025-02-15', 'Fevereiro 2025')],
    });
    assert.equal(relatorio.freada, false);
    assert.equal(relatorio.corrida?.length, 3, 'a corrida parou antes do fim');
    assert.equal(relatorio.codigo, 1);
  });

  /**
   * O caso que a 2.8 fechou, em massa e com `--caderno`: períodos mudos em
   * sequência **não** param a campanha. Com um caderno só, mudez é corriqueira —
   * é só aquele caderno não ter o que dizer —, e parar ali travaria a correção
   * para sempre, porque `sem-caderno` custa zero e o período é o mesmo amanhã.
   */
  it('--massa --caderno: três períodos mudos em sequência NÃO param a campanha', async () => {
    const semRotina = new Set([
      'habits', 'habit_logs', 'registros', 'registro_logs', 'todo_templates', 'todo_occurrences', 'daily_ratings',
    ]);
    const banco = bancoFalso({
      edicao: edicaoNoBanco('month', INICIO, FIM, ['movimento', 'rotina']),
      aoLer: (tabela, _vez, tabelas) => {
        if (semRotina.has(tabela)) tabelas[tabela].length = 0;
      },
    });
    // O mesmo período mudo quatro vezes: o que se mede é o contador, não a lista.
    const { relatorio, nuvem, t } = await massaPeloScript({
      banco, caderno: 'rotina', sim: true, enumerar: () => [MAIO, MAIO, MAIO, MAIO],
    });
    assert.equal(relatorio.freada, false, 'a campanha parcial parou por mudez');
    assert.equal(relatorio.codigo, 0);
    assert.equal(nuvem.pedidos.length, 0);
    assert.doesNotMatch(t.err.join('\n'), /o token que/, 'anunciou causa comum sobre mudez');
  });

  it('--exportar recusa sobrescrever: o arquivo é a única cópia do texto', async () => {
    const banco = bancoFalso({ edicao: edicaoNoBanco('month', '2023-09-01', '2023-09-30', ['rotina']) });
    const arquivos = { '/tmp/ja-existe.md': 'o texto de antes' };
    const { relatorio, t } = await massaPeloScript({ banco, exportar: '/tmp/ja-existe.md', arquivos });
    assert.equal(relatorio.codigo, 1);
    assert.equal(relatorio.exportado, null);
    assert.equal(arquivos['/tmp/ja-existe.md'], 'o texto de antes', 'o arquivo foi sobrescrito');
    assert.match(t.err.join('\n'), /já existe, e nada foi escrito/);
  });

  it('--exportar sem nada a exportar avisa e sai ≠0, em vez de escrever só o cabeçalho', async () => {
    const { relatorio, arquivos, t } = await massaPeloScript({ exportar: '/tmp/vazio.md' });
    assert.equal(relatorio.codigo, 1);
    assert.equal(relatorio.exportado, null);
    assert.deepEqual(Object.keys(arquivos), []);
    assert.match(t.err.join('\n'), /não há nada a exportar/);
  });

  it('--exportar avisa quando uma edição da lista volta sem caderno — o texto dela não foi salvo', async () => {
    // As duas existem no arquivo (o plano as nomeia), e o telefone apaga uma
    // delas entre a leitura do arquivo e a do texto: `fetchEdicao` a acha vazia.
    const banco = bancoFalso({
      edicao: [
        ...edicaoNoBanco('month', '2023-09-01', '2023-09-30', ['rotina']),
        ...edicaoNoBanco('month', '2023-10-01', '2023-10-31', ['sono']),
      ],
      aoLer: (tabela, vez, tabelas) => {
        // Vez 1 é a leitura do arquivo; da 2 em diante são as do texto.
        if (tabela === 'edicoes_ia' && vez === 2) {
          const k = tabelas.edicoes_ia.findIndex((l) => l['inicio'] === '2023-10-01');
          if (k >= 0) tabelas.edicoes_ia.splice(k, 1);
        }
      },
    });
    const { relatorio, arquivos, t } = await massaPeloScript({
      banco,
      exportar: '/tmp/parcial.md',
      nomeados: [nomeado('month', '2023-09-01'), nomeado('month', '2023-10-01')],
    });
    assert.equal(relatorio.codigo, 1, 'a exportação incompleta saiu 0');
    assert.equal(relatorio.exportado, '/tmp/parcial.md');
    // O arquivo SAI — o que foi salvo tem valor —, e o aviso diz o que falta.
    assert.match(arquivos['/tmp/parcial.md'] ?? '', /texto antigo de rotina em 2023-09-01/);
    assert.match(t.err.join('\n'), /voltou sem caderno nenhum/);
    assert.match(t.err.join('\n'), /Outubro 2023/);
  });

  it('o plano avisa quando um período nomeado não aparece nele', async () => {
    const { relatorio, t } = await massaPeloScript({
      enumerar: () => [MAIO],
      nomeados: [nomeado('month', '2023-09-02')],
    });
    assert.equal(relatorio.codigo, 0);
    assert.match(t.err.join('\n'), /não está no plano/);
    assert.match(t.err.join('\n'), /2023-09-02/);
  });

  /* ── a corrida de um caderno só (Story 2.8) ────────────────────────────── */

  /**
   * O caminho inteiro da correção de `1 dias`, sem rede: o plano vê a edição de
   * maio com o `rotina` no prompt 4, a corrida chama **uma** vez e grava, os
   * outros cadernos ficam, e a capa que o dono escolheu não é tocada.
   */
  const bancoDeMaioImpresso = () =>
    bancoFalso({ edicao: edicaoNoBanco('month', INICIO, FIM, ['movimento', 'rotina', 'sono']) });

  it('--massa --caderno: uma chamada por período, só no caderno pedido, e os outros ficam', async () => {
    const banco = bancoDeMaioImpresso();
    const { relatorio, nuvem, t } = await massaPeloScript({
      banco, caderno: 'rotina', sim: true, enumerar: () => [MAIO],
    });
    assert.equal(relatorio.codigo, 0);
    assert.equal(relatorio.contas.reimprimir, 1);
    assert.equal(relatorio.contas.imprimir, 0);
    assert.equal(relatorio.contas.chamadas, 1, 'o plano anunciou mais de uma chamada por período');
    assert.deepEqual(nuvem.pedidos, ['rotina']);
    assert.equal(relatorio.corrida?.[0]?.desfecho, 'gravada');
    assert.equal(relatorio.corrida?.[0]?.chamadas, 1);
    const carga = banco.rpcs[0]!.args;
    assert.deepEqual(carga.p_linhas.map((l) => l['caderno']), ['rotina']);
    assert.deepEqual([...carga.p_ordem], ['movimento', 'rotina', 'sono']);
    assert.match(t.out.join('\n'), /--caderno rotina: a corrida reescreve só esse caderno/);
    semTexto(t);
  });

  it('--massa --caderno não troca a capa que o dono escolheu — nem a `estrela`, que a guarda da troca não pega', async () => {
    const banco = bancoDeMaioImpresso();
    const capa = capaFalsa({ existente: { motivo: 'estrela', natureza: 'foto' } });
    const { relatorio, t } = await massaPeloScript({
      banco, capa, caderno: 'rotina', sim: true, enumerar: () => [MAIO],
    });
    assert.equal(relatorio.corrida?.[0]?.desfecho, 'gravada');
    assert.deepEqual(capa.carimbadas, [], 'a corrida parcial recarimbou a capa');
    assert.match(t.out.join('\n'), /capa: foto — mantida, porque esta impressão foi de um caderno só/);
  });

  it('a segunda corrida não gasta nada: o rotina já está no prompt de hoje', async () => {
    const banco = bancoFalso({
      edicao: [
        ...edicaoNoBanco('month', INICIO, FIM, ['movimento', 'sono']),
        // O `rotina` já reimpresso, no prompt corrente.
        ...edicaoNoBanco('month', INICIO, FIM, ['rotina']).map((l) => ({ ...l, prompt_versao: PROMPT_VERSAO })),
      ],
    });
    const { relatorio, nuvem, t } = await massaPeloScript({
      banco, caderno: 'rotina', sim: true, enumerar: () => [MAIO],
    });
    assert.equal(relatorio.codigo, 0);
    assert.equal(relatorio.contas.chamadas, 0);
    assert.equal(nuvem.pedidos.length, 0, 'a segunda corrida chamou o modelo');
    assert.equal(banco.rpcs.length, 0, 'a segunda corrida gravou');
    assert.match(t.out.join('\n'), new RegExp(`rotina já está no prompt ${PROMPT_VERSAO}`));
  });

  it('--massa --caderno não avisa sobre os nomeados da 2.3: eles são de outra campanha', async () => {
    const { t } = await massaPeloScript({
      banco: bancoDeMaioImpresso(), caderno: 'rotina', enumerar: () => [MAIO],
      nomeados: [nomeado('month', '2023-09-02')],
    });
    assert.equal(t.err.length, 0, `avisos inesperados: ${t.err.join(' | ')}`);
  });

  it('--exportar com --caderno diz no arquivo que só aquele caderno sai do ar', async () => {
    const { relatorio, arquivos } = await massaPeloScript({
      banco: bancoDeMaioImpresso(), caderno: 'rotina', exportar: '/tmp/so-rotina.md', enumerar: () => [MAIO],
    });
    assert.equal(relatorio.exportado, '/tmp/so-rotina.md');
    const md = arquivos['/tmp/so-rotina.md'] ?? '';
    assert.match(md, /reescreve \*\*só o caderno `rotina`\*\*/);
    assert.ok(!md.includes('gramática da ausência'), 'o motivo da campanha da 2.3 vazou para a exportação parcial');
    // O texto de TODOS os cadernos sai: o arquivo é a cópia da edição de hoje.
    assert.match(md, /texto antigo de sono/);
  });

  it('exportarEmTexto: sem caderno gravado, o arquivo diz isso em vez de mentir por omissão', () => {
    const item: ItemDoPlano = {
      acao: 'reimprimir', tipo: 'month', inicio: '2023-09-01', fim: '2023-09-30',
      offset: -36, rotulo: 'Setembro 2023', cadernos: [], motivo: 'zero falso',
    };
    const md = exportarEmTexto([{ item, cadernos: [] }], AGORA);
    assert.match(md, /Setembro 2023 · 2023-09-01 → 2023-09-30/);
    assert.match(md, /Sem cadernos gravados no momento da exportação/);
  });
});

/* ── as bandeiras e as recusas antes da rede ─────────────────────────────── */

describe('as bandeiras', () => {
  it('lê tipo pela tabela ou pela rota, início e os dois modos', () => {
    assert.deepEqual(lerBandeiras(['--tipo', 'mes', '--inicio', INICIO, '--sem-gravar']), {
      tipo: 'month', inicio: INICIO, caderno: null, semGravar: true, reimprimir: false,
      massa: false, sim: false, limite: null, exportar: null, ajuda: false,
    });
    assert.equal(lerBandeiras(['--tipo', 'season']).tipo, 'season');
    assert.equal(lerBandeiras(['--tipo', 'ano']).tipo, 'year');
    assert.equal(lerBandeiras(['--reimprimir']).reimprimir, true);
  });

  it('as do modo em massa: --massa, o "sim", --limite e --exportar', () => {
    const b = lerBandeiras(['--massa', '--sim-gastar-chamadas', '--limite', '2']);
    assert.equal(b.massa, true);
    assert.equal(b.sim, true);
    assert.equal(b.limite, 2);
    assert.equal(lerBandeiras(['--exportar', '/tmp/x.md']).exportar, '/tmp/x.md');
    assert.throws(() => lerBandeiras(['--exportar']), /precisa de um valor/);
  });

  it('--limite recusa o que não é um inteiro maior que zero', () => {
    // Zero e negativo seriam uma corrida que não acontece, com cara de que rodou.
    for (const ruim of ['0', '-1', '2.5', 'dois', 'NaN']) {
      assert.throws(() => lerBandeiras(['--limite', ruim]), /não é um inteiro maior que zero/, ruim);
    }
    assert.equal(lerBandeiras(['--limite', '1']).limite, 1);
  });

  it('as incompatíveis são recusadas antes de tudo, dos dois lados', () => {
    const massa = (extra: readonly string[]) => bandeirasIncompativeis(lerBandeiras(['--massa', ...extra]));
    assert.match(massa(['--inicio', INICIO]) ?? '', /--inicio não vale com --massa/);
    assert.match(massa(['--reimprimir']) ?? '', /--reimprimir não vale com --massa/);
    assert.match(massa(['--sem-gravar']) ?? '', /--sem-gravar não vale com --massa/);
    // A semana: recusada pelo tipo, com o motivo — ela não grava edição.
    assert.match(massa(['--tipo', 'semana']) ?? '', /semana não grava edição/);
    assert.equal(massa(['--tipo', 'mes']), null);
    assert.equal(massa([]), null);
    // E o contrário: o "sim", o --limite e o --exportar só valem na massa.
    assert.match(bandeirasIncompativeis(lerBandeiras(['--sim-gastar-chamadas'])) ?? '', /só vale com --massa/);
    assert.match(bandeirasIncompativeis(lerBandeiras(['--exportar', '/tmp/x.md'])) ?? '', /só vale com --massa/);
    assert.match(bandeirasIncompativeis(lerBandeiras(['--limite', '2'])) ?? '', /só vale com --massa/);
    assert.equal(bandeirasIncompativeis(lerBandeiras(['--tipo', 'mes', '--inicio', INICIO])), null);
  });

  /**
   * O "sim" junto do `--exportar` era descartado **em silêncio**: a exportação
   * sai antes de imprimir, e o dono ficaria conferindo uma corrida que nunca
   * aconteceu.
   */
  it('--exportar não vale com o "sim" nem com --limite: a exportação não roda corrida', () => {
    assert.match(
      bandeirasIncompativeis(lerBandeiras(['--massa', '--exportar', '/tmp/x.md', '--sim-gastar-chamadas'])) ?? '',
      /não valem juntos/,
    );
    assert.match(
      bandeirasIncompativeis(lerBandeiras(['--massa', '--exportar', '/tmp/x.md', '--limite', '2'])) ?? '',
      /não valem juntos/,
    );
    assert.equal(bandeirasIncompativeis(lerBandeiras(['--massa', '--limite', '2', '--sim-gastar-chamadas'])), null);
  });

  it('recusa o Total, o tipo desconhecido, a repetida, a sem valor — e as que a spec não quer', () => {
    assert.throws(() => lerBandeiras(['--tipo', 'all']), /Total nunca fecha/);
    assert.throws(() => lerBandeiras(['--tipo', 'mensal']), /não é tipo de período/);
    assert.throws(() => lerBandeiras(['--inicio', '2026-05-01', '--inicio', '2026-04-01']), /mais de uma vez/);
    assert.throws(() => lerBandeiras(['--inicio']), /precisa de um valor/);
    // A cadeia é a padrão do descritor: motor não se escolhe aqui. `--cadernos`
    // no plural continua não existindo — a bandeira é `--caderno`, um só.
    assert.throws(() => lerBandeiras(['--motor', 'nuvem:padrao']), /bandeira desconhecida: --motor/);
    assert.throws(() => lerBandeiras(['--cadernos', 'sono']), /bandeira desconhecida: --cadernos/);
  });

  /**
   * A recusa do `--caderno` acontece na **leitura**, antes de qualquer rede.
   *
   * Um `--caderno rotinas` que atravessasse viraria uma lista de candidatos que a
   * sequência do núcleo esvazia, e o desfecho seria *"nenhum caderno tem o que
   * dizer"* — a mensagem errada para um erro de digitação, depois de abrir sessão.
   */
  it('--caderno: lê os quatro válidos, e recusa o que não é caderno nomeando-os', () => {
    assert.equal(lerBandeiras(['--caderno', 'rotina']).caderno, 'rotina');
    for (const c of CADERNO_IDS) assert.equal(lerBandeiras(['--caderno', c]).caderno, c);
    assert.throws(() => lerBandeiras(['--caderno', 'rotinas']), /--caderno rotinas não é caderno/);
    assert.throws(() => lerBandeiras(['--caderno', 'rotinas']), new RegExp(CADERNO_IDS.join(', ')));
    assert.throws(() => lerBandeiras(['--caderno', 'financas']), /não é caderno/);
    assert.throws(() => lerBandeiras(['--caderno']), /precisa de um valor/);
    assert.throws(() => lerBandeiras(['--caderno', 'sono', '--caderno', 'rotina']), /mais de uma vez/);
  });

  it('--caderno vale nos dois modos, e não com --reimprimir', () => {
    const com = (extra: readonly string[]) => bandeirasIncompativeis(lerBandeiras(extra));
    assert.equal(com(['--tipo', 'mes', '--inicio', INICIO, '--caderno', 'rotina']), null);
    assert.equal(com(['--massa', '--caderno', 'rotina']), null);
    assert.equal(com(['--massa', '--caderno', 'rotina', '--sim-gastar-chamadas']), null);
    assert.match(com(['--reimprimir', '--caderno', 'rotina']) ?? '', /--reimprimir e --caderno não valem juntos/);
  });

  it('--ajuda sai da mesma lista que a leitura', () => {
    const texto = ajuda();
    for (const b of ['--tipo', '--inicio', '--caderno', '--sem-gravar', '--reimprimir', '--massa', '--sim-gastar-chamadas', '--exportar', '--ajuda']) {
      assert.ok(texto.includes(b), b);
    }
    // Os quatro ids saem na ajuda: quem lê o `--ajuda` sabe o que pode escrever.
    for (const c of CADERNO_IDS) assert.ok(texto.includes(c), c);
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

/**
 * A conta de chamadas **pagas** de um caderno, sobre a trilha do anel.
 *
 * Ela existe porque o relatório do fim promete "pagas, tenham gravado ou não", e
 * a primeira versão contava "houve hash": um por caderno, sempre — o que perde a
 * repetição com o pedido curto e dá 1 para o caderno que não chegou a pagar nada.
 */
describe('chamadasPagas — o que de fato custou', () => {
  const evento = (trilha: readonly Partial<Tentativa>[], hash?: string): EventoDoAnel => ({
    recurso: 'retrospectiva',
    versaoDoDescritor: 5004,
    modo: 'produto',
    instante: '2026-06-10T10:00:00.000Z',
    trilha: trilha.map((t) => ({ motor: NUVEM_PADRAO, desfecho: 'ok', ms: 1200, ...t }) as Tentativa),
    ...(hash === undefined ? {} : { hash }),
  });

  it('a chamada que deu certo conta', () => {
    assert.equal(chamadasPagas(evento([{ desfecho: 'ok' }], 'h')), 1);
  });

  it('a que estourou o prazo ou voltou com erro conta — ela foi paga do mesmo jeito', () => {
    assert.equal(chamadasPagas(evento([{ desfecho: 'transitoria' }], 'h')), 1);
    assert.equal(chamadasPagas(evento([{ desfecho: 'capacidade' }], 'h')), 1);
    // E mesmo sem hash no evento: o pedido saiu, e o hash é outro assunto.
    assert.equal(chamadasPagas(evento([{ desfecho: 'transitoria' }])), 1);
  });

  it('a repetição com o pedido curto conta duas vezes — são duas chamadas', () => {
    assert.equal(chamadasPagas(evento([{ desfecho: 'janela' }, { desfecho: 'ok', curto: true }], 'h')), 2);
  });

  it('a tentativa sintética não conta: o hospedeiro não entregou o motor, e nada saiu', () => {
    assert.equal(chamadasPagas(evento([{ desfecho: 'indisponivel', sintetica: true }])), 0);
  });

  it('o `sem-modelo` não conta: é o template, e ele não custa nada', () => {
    assert.equal(
      chamadasPagas(evento([{ motor: NUVEM_PADRAO, desfecho: 'transitoria' }, { motor: SEM_MODELO, desfecho: 'ok' }], 'h')),
      1,
    );
    assert.equal(chamadasPagas(evento([{ motor: SEM_MODELO, desfecho: 'ok' }], 'h')), 0);
  });

  it('o caderno mudo, sem tentativa nenhuma, custa zero', () => {
    assert.equal(chamadasPagas(evento([])), 0);
  });
});

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

  it('--caderno inválido: recusa antes da rede e antes da credencial, nomeando os quatro', async () => {
    const { p, t, abriu } = processo({});
    assert.equal(await principal(['--tipo', 'month', '--inicio', INICIO, '--caderno', 'rotinas'], p), 1);
    assert.equal(abriu(), 0, 'abriu rede com um caderno que não existe');
    const err = t.err.join('\n');
    assert.match(err, /--caderno rotinas não é caderno/);
    assert.match(err, new RegExp(CADERNO_IDS.join(', ')));
  });

  it('--caderno com --reimprimir: recusa antes da rede', async () => {
    const { p, t, abriu } = processo({});
    assert.equal(await principal(['--tipo', 'month', '--inicio', INICIO, '--caderno', 'rotina', '--reimprimir'], p), 1);
    assert.equal(abriu(), 0);
    assert.match(t.err.join('\n'), /--reimprimir e --caderno não valem juntos/);
  });

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

  it('--massa --tipo semana: recusado antes de qualquer leitura, com o motivo', async () => {
    const { p, t, abriu } = processo({ ...PROJETO_NO_AMBIENTE, ORBE_ACCESS_TOKEN: 'token-secreto' });
    assert.equal(await principal(['--massa', '--tipo', 'semana'], p), 1);
    assert.equal(abriu(), 0);
    assert.match(t.err.join('\n'), /semana não grava edição/);
  });

  it('--massa com --inicio, --reimprimir ou --sem-gravar: recusado antes da rede', async () => {
    for (const extra of [['--inicio', INICIO], ['--reimprimir'], ['--sem-gravar']]) {
      const { p, t, abriu } = processo({ ...PROJETO_NO_AMBIENTE, ORBE_ACCESS_TOKEN: 'token-secreto' });
      assert.equal(await principal(['--massa', ...extra], p), 1, extra.join(' '));
      assert.equal(abriu(), 0, extra.join(' '));
      assert.match(t.err.join('\n'), /não vale com --massa/, extra.join(' '));
    }
  });

  it('--massa sem refresh token: recusa antes da rede, e nomeia só a variável', async () => {
    const { p, t, abriu } = processo({ ...PROJETO_NO_AMBIENTE, ORBE_ACCESS_TOKEN: 'token-secreto' });
    assert.equal(await principal(['--massa'], p), 1);
    assert.equal(abriu(), 0);
    const err = t.err.join('\n');
    assert.match(err, /ORBE_REFRESH_TOKEN/);
    assert.match(err, /perto de uma hora/);
    assert.ok(!err.includes('token-secreto'));
  });

  it('--massa com os dois tokens: mostra o plano, sai 0 e não chama modelo nenhum', async () => {
    const banco = bancoFalso();
    const sessao = sessaoDo(banco);
    const nuvem = nuvemFalsa();
    const { p, t } = processo(
      { ...PROJETO_NO_AMBIENTE, ORBE_ACCESS_TOKEN: 'token-secreto', ORBE_REFRESH_TOKEN: 'refresh-secreto' },
      { abrir: async () => sessao, buscar: nuvem.buscar },
    );
    assert.equal(await principal(['--massa'], p), 0);
    assert.equal(nuvem.pedidos.length, 0, 'o plano chamou o modelo');
    assert.equal(banco.rpcs.length, 0);
    assert.ok(sessao.fechada(), 'a sessão não foi fechada');
    assert.match(t.out.join('\n'), /massa — o arquivo desde 2023-05-22/);
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
 * corpo de erro, tradução de classe, a função do banco e o manifesto da bancada são
 * de outros donos (as barreiras do `architecture.test.ts` cobram parte disto no
 * repositório inteiro; esta é a lista da spec, para este arquivo).
 *
 * **A capa saiu desta lista na Story 2.3**, e de propósito: a impressão que grava
 * passou a carimbá-la. O que continua proibido é *escrever* em `edicoes_capa` por
 * fora — e quem cobra isso é a barreira "só `gravarCapa` escreve `edicoes_capa`",
 * no repositório inteiro. A régua aqui é a que sobrou: o nome da tabela não
 * aparece neste arquivo.
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
    ['nomear a tabela da capa', /edicoes_capa/],
    ['escolher a capa por conta própria', /coverOf|legendaDaFoto|legendaDaRota|'tracado'|'grade'/],
    ['mexer no manifesto da bancada', /manifesto/],
    // `--motor` continua fora: a cadeia é a padrão do descritor, e escolher um
    // motor aqui seria uma segunda edição possível para o mesmo período.
    // `--cadernos`, no plural, também: desde a Story 2.8 há `--caderno`, **um**,
    // e uma lista traria de volta "quais três dos quatro", que ninguém pediu.
    ['aceitar motor ou uma lista de cadernos', /'--motor'|'--cadernos'/],
  ];
  for (const [nome, re] of proibidos) {
    it(`não há ${nome} em revista/imprimir.ts`, () => {
      assert.doesNotMatch(fonte, re);
    });
  }
});
