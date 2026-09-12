import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { SleepPeriod } from '../models';
import { APARELHO_SISTEMA, NUVEM_PADRAO, SEM_MODELO, type MotorId } from '../ia/fio';
import {
  hashDoPedido, resolverCadeia, type Cadeia, type Falha, type Motor, type Pedido, type Resposta,
} from '../ia/motor';
import {
  ler, type Leitura, type LeituraDoPiso, type Medicao, type OpcoesDeMedicao, type OpcoesDeProduto,
} from '../ia/orquestrar';
import { CATALOGO_DE_RECURSOS, validarDescritor } from '../ia/recursos';
import { casaPorPalavra, termosProibidosEm, VOCABULARIO_PROIBIDO, type SubconjuntoProibido } from '../ia/verificar';
import { porExtenso } from '../format/numero';
import { casoDaSaude, type CasoDaSaude } from './caso';
import {
  descritorDaSaudeDoSono as saude, entradaDaSaude, templateDaSaude, type AlcanceDaSaude, type EntradaDaSaude,
} from './leitura';
import { filterByRange, rangeBounds, rangeNights, type SonoRange } from './ranges';
import {
  DIMENSION_LABEL, SCORE_COVERAGE_FLOOR, nightScore, periodScore, type SleepCoverage, type SleepDimensionKey,
  type SleepScore,
} from './score';

/**
 * A leitura da Saúde do sono sem modelo (story 5.3): a entrada, o template e o
 * descritor, linha a linha da matriz de I/O — com o orquestrador de verdade e
 * motores falsos.
 *
 * Roda igual em `TZ=UTC` (o CI) e em `Europe/Brussels`: o "hoje" é um dia local,
 * as noites carregam o próprio `tzOffset`, e nada aqui lê o relógio. Um teste
 * troca o fuso do processo no meio para provar isso, e o devolve.
 */

/* ── as noites ── */

const BXL = 120;

/**
 * Noite que acorda em `wakeDay`, apagando às `onsetH` locais. `onsetH >= 12` cai
 * na véspera; abaixo disso é a madrugada do próprio `wakeDay`.
 */
function noite(wakeDay: string, onsetH = 23.5, durH = 7.5, awakeMin = 0): SleepPeriod {
  const ancora = new Date(`${wakeDay}T00:00:00Z`);
  if (onsetH >= 12) ancora.setUTCDate(ancora.getUTCDate() - 1);
  const onsetMs = ancora.getTime() + onsetH * 3_600_000 - BXL * 60_000;
  const wakeMs = onsetMs + (durH + awakeMin / 60) * 3_600_000;
  return {
    userId: 'u', onsetAt: new Date(onsetMs).toISOString(), wakeAt: new Date(wakeMs).toISOString(),
    inBedAt: null, inBedEnd: null, tzOffset: BXL, wakeDay, asleepH: durH,
    awakenings: awakeMin === 0 ? [] : [{
      from: new Date(onsetMs + 3_600_000).toISOString(),
      to: new Date(onsetMs + 3_600_000 + awakeMin * 60_000).toISOString(),
    }],
    stages: null, stageSegments: null,
  };
}

/** O dia `n` dias depois de `dia`, em calendário — sem fuso. */
function mais(dia: string, n: number): string {
  const d = new Date(`${dia}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** `n` noites idênticas terminando em `ultimo`, uma por dia. */
function noites(ultimo: string, n: number, onsetH = 23.5, durH = 7.5, awakeMin = 0): SleepPeriod[] {
  return Array.from({ length: n }, (_, k) => noite(mais(ultimo, k - (n - 1)), onsetH, durH, awakeMin));
}

/** Hoje como a tela e a bancada o passam: um dia local. */
const HOJE = '2026-09-10';
/** O mesmo dia como a tela o vê hoje, pela `Date` do aparelho. */
const HOJE_DA_TELA = new Date(2026, 8, 10, 12, 0, 0);

/**
 * Um arquivo com textura: onze semanas até hoje, com buracos, horários, durações
 * e vigílias variando, e notas em dois de cada três dias — para as janelas
 * caírem em casos diferentes.
 */
function arquivo(): { noites: SleepPeriod[]; notas: Record<string, number> } {
  const out: SleepPeriod[] = [];
  const notas: Record<string, number> = {};
  for (let i = 0; i < 80; i += 1) {
    const dia = mais('2026-06-23', i);
    if (i % 9 === 4 || (i > 30 && i < 38)) continue; // buracos, e uma semana inteira sem noite
    out.push(noite(dia, 22.6 + (i % 5) * 0.45, 5.6 + (i % 4) * 0.7, (i * 7) % 41));
    if (i % 3 !== 0) notas[dia] = 1 + (i % 5);
  }
  return { noites: out, notas };
}

const { noites: ARQUIVO, notas: NOTAS } = arquivo();

/** A fórmula de `/sono/saude` (`mobile/src/app/sono/saude.tsx`), copiada dela — com a `Date` da tela. */
function formulaDaTela(periods: readonly SleepPeriod[], ratings: Record<string, number>, range: SonoRange, offset: number) {
  const nights = filterByRange(periods, range, HOJE_DA_TELA, offset);
  const expected = rangeNights(range, HOJE_DA_TELA, offset);
  const { since } = rangeBounds(range, HOJE_DA_TELA, offset);
  const history = since === null ? periods : periods.filter((p) => p.wakeDay < since);
  return periodScore(nights, expected, ratings, history);
}

const casoDe = (e: EntradaDaSaude): CasoDaSaude => casoDaSaude(e.score);

/* ── as entradas montadas à mão ── */

const FATO_DO_PERIODO: Readonly<Record<SleepDimensionKey, string>> = {
  duracao: '7h20 · 86% ≥ 7h',
  continuidade: '14 min',
  horario: '± 22 min',
  regularidade: 'SRI 50 · 7 seguidas',
  percepcao: '3,3/5 · 4 notas',
};

const FATO_DA_NOITE: Readonly<Record<SleepDimensionKey, string>> = {
  duracao: '6h40',
  continuidade: '12 min · 2 despertares',
  horario: 'meio 03:40',
  regularidade: '—',
  percepcao: '4/5',
};

const CHAVES_DA_NOITE: readonly SleepDimensionKey[] = ['duracao', 'continuidade', 'horario', 'percepcao'];
const CHAVES_DO_PERIODO = Object.keys(DIMENSION_LABEL) as SleepDimensionKey[];

/** Uma contagem montada à mão, com a mesma soma e o mesmo `scored` de `tally` em `score.ts`. */
function contagem(alcance: AlcanceDaSaude, pontos: readonly (number | null)[], coverage: SleepCoverage | null): SleepScore {
  const chaves = alcance === 'noite' ? CHAVES_DA_NOITE : CHAVES_DO_PERIODO;
  const fatos = alcance === 'noite' ? FATO_DA_NOITE : FATO_DO_PERIODO;
  // Lista curta dava `points: undefined`, que não é `null` e contava como medida: o
  // teste passava medindo outra coisa.
  if (pontos.length !== chaves.length) {
    throw new RangeError(`${alcance} tem ${chaves.length} dimensões, e vieram ${pontos.length} pontos`);
  }
  const dimensions = chaves.map((key, i) => ({
    key, label: DIMENSION_LABEL[key], points: pontos[i],
    fact: pontos[i] === null ? '—' : fatos[key],
    ...(pontos[i] === null ? { absent: 'não medida' } : {}),
  }));
  const medidas = dimensions.filter((d) => d.points !== null);
  return {
    dimensions,
    points: medidas.reduce((s, d) => s + (d.points ?? 0), 0),
    max: medidas.length * 2,
    coverage,
    scored: medidas.length > 0 && (coverage === null || coverage.ratio >= SCORE_COVERAGE_FLOOR),
  };
}

/** Uma entrada com a contagem dada à mão — a semana corrente, ou a noite de hoje. */
function entrada(
  alcance: AlcanceDaSaude,
  pontos: readonly (number | null)[],
  coverage: SleepCoverage | null = alcance === 'noite' ? null : { nights: 7, expected: 7, ratio: 1 },
): EntradaDaSaude {
  return {
    alcance,
    range: alcance === 'noite' ? 'ultima' : '7d',
    hoje: HOJE,
    janela: alcance === 'noite' ? { since: HOJE, until: HOJE } : { since: '2026-09-04', until: null },
    score: contagem(alcance, pontos, coverage),
  };
}

/** A noite que não existe, como `entradaDaSaude` a devolve: sem janela, e uma noite esperada e nenhuma gravada. */
function semNoiteNenhuma(): EntradaDaSaude {
  return {
    ...entrada('noite', [null, null, null, null], { nights: 0, expected: 1, ratio: 0 }),
    janela: { since: null, until: null },
  };
}

/** Uma entrada de cada caso e de cada variante do template — noite e período, os três motivos em cada alcance. */
const VARIANTES: Readonly<Record<string, EntradaDaSaude>> = {
  'uma (período)': entrada('periodo', [2, 1, 2, 0, 1]),
  'uma (noite)': entrada('noite', [2, 1, 2, 0]),
  'duas (período)': entrada('periodo', [0, 1, 2, 0, 1]),
  'duas (noite)': entrada('noite', [1, 2, 1, 2]),
  'fora-do-empate, no máximo': entrada('periodo', [1, 1, 2, 1, 1]),
  'fora-do-empate, acima': entrada('periodo', [0, 0, 1, 0, 2]),
  'fora-do-empate (noite)': entrada('noite', [0, 0, 0, 2]),
  'todas-iguais (período)': entrada('periodo', [1, 1, 1, null, 1]),
  'todas-iguais (noite)': entrada('noite', [0, null, 0, null]),
  'tudo-no-maximo (período)': entrada('periodo', [2, 2, 2, 2, 2]),
  'tudo-no-maximo (noite)': entrada('noite', [2, 2, 2, 2]),
  'medidas-insuficientes (período)': entrada('periodo', [1, null, null, null, null]),
  'medidas-insuficientes (noite)': entrada('noite', [2, null, null, null]),
  'sem-contagem, cobertura': entrada('periodo', [2, 1, 2, null, 1], { nights: 3, expected: 7, ratio: 3 / 7 }),
  'sem-contagem, sem noite': entrada('periodo', [null, null, null, null, null], { nights: 0, expected: 7, ratio: 0 }),
  'sem-contagem, noite sem medida': entrada('noite', [null, null, null, null]),
  'sem-contagem, noite sem noite': semNoiteNenhuma(),
  'sem-contagem, período sem medida': entrada('periodo', [null, null, null, null, null], { nights: 7, expected: 7, ratio: 1 }),
};

/* ── o hospedeiro falso ── */

const resposta = (texto: string, tipo: 'aparelho' | 'nuvem' = 'aparelho'): Resposta => ({
  texto, assinatura: { tipo, provedor: 'prov-a', modelo: 'modelo-1' },
});

function motorFalso(saida: Resposta | Falha) {
  const pedidos: Pedido[] = [];
  const motor: Motor = async (p) => {
    pedidos.push(p);
    return saida;
  };
  return { motor, pedidos };
}

function hospedeiro(motores: Readonly<Record<string, Motor | undefined>>) {
  const comuns = {
    motorPara: (id: MotorId) => motores[id],
    registrar: () => undefined,
    agora: () => new Date(Date.UTC(2026, 8, 11, 9, 0, 0)),
  };
  return {
    produto: (cadeia: Cadeia): OpcoesDeProduto => ({ modo: 'produto', cadeia, ...comuns }),
    medicao: (motor: MotorId): OpcoesDeMedicao => ({ modo: 'medicao', motor, ...comuns }),
  };
}

const CATALOGO: MotorId[] = [APARELHO_SISTEMA, NUVEM_PADRAO];

function piso(l: Leitura<string>): LeituraDoPiso & { frase: string } {
  assert.equal(l.origem, 'piso', JSON.stringify(l));
  assert.ok('frase' in l, 'o piso da Saúde é sempre frase, nunca ausência');
  return l as LeituraDoPiso & { frase: string };
}

function tentativa(m: Medicao<string>) {
  assert.equal(m.tipo, 'tentativa', JSON.stringify(m));
  return m as Extract<Medicao<string>, { tipo: 'tentativa' }>;
}

const frase = (e: EntradaDaSaude): string => {
  const p = saude.semModelo(e);
  assert.ok('frase' in p);
  return p.frase;
};

/** O valor de `{janela}` como o código o escreve — sem a maiúscula de começo de frase. */
const janela = (e: EntradaDaSaude): string => saude.montarFrase('— {janela}', e).slice(2);
/** O valor de `{quando}`, idem. */
const quando = (e: EntradaDaSaude): string => saude.montarFrase('— {quando}', e).slice(2);

/** Mede o texto de um motor falso numa entrada, pelo orquestrador de verdade. */
async function medir(e: EntradaDaSaude, texto: string) {
  const h = hospedeiro({ [APARELHO_SISTEMA]: motorFalso(resposta(texto)).motor });
  return tentativa(await ler(saude, e, h.medicao(APARELHO_SISTEMA)));
}

/** As regras dos problemas de uma medição. */
const regrasDe = (m: Awaited<ReturnType<typeof medir>>): string[] => (m.trilha[0].problemas ?? []).map((p) => p.regra);

/** Os numerais que o pedido nunca escreve — de dois a dez, nos dois gêneros, e os redondos. */
const NUMERAIS_DO_PEDIDO = [
  ...Array.from({ length: 9 }, (_, i) => i + 2).flatMap((n) => [porExtenso(n, 'masculino'), porExtenso(n, 'feminino')]),
  'zero', 'onze', 'doze', 'vinte', 'cem', 'mil', 'metade', 'dobro', 'por cento',
];

/* ── os testes ── */

describe('o descritor', () => {
  it('é válido e está no catálogo', () => {
    assert.deepEqual(validarDescritor(saude), []);
    assert.ok(CATALOGO_DE_RECURSOS.includes(saude as never));
  });

  it('declara o que a espinha fixa: interpolado, gulosa, texto, não grava, até a nuvem, padrão só sem-modelo', () => {
    assert.equal(saude.recurso, 'saude-do-sono');
    assert.equal(saude.regimeDeNumeros, 'interpolado');
    assert.equal(saude.regimeMaximo, 'nuvem');
    assert.deepEqual([...saude.cadeiaPadrao], [SEM_MODELO]);
    assert.equal(saude.grava, false);
    assert.equal(saude.versao, 1);
    for (const [nome, e] of Object.entries(VARIANTES)) {
      const p = saude.montarPedido(e);
      assert.ok(p, `${nome}: todo caso gera pedido`);
      assert.equal(p.amostragem, 'gulosa');
      assert.deepEqual(p.saida, { tipo: 'texto' });
      assert.equal(p.guardrails, 'padrao');
    }
  });

  it('o pedido nunca leva ponto, fato, algarismo, numeral nem termo proibido — só o caso, o alcance, as dimensões e os marcadores', () => {
    const fatos = [...Object.values(FATO_DO_PERIODO), ...Object.values(FATO_DA_NOITE)].filter((f) => f !== '—');
    const TODOS = Object.keys(VOCABULARIO_PROIBIDO) as SubconjuntoProibido[];
    for (const [nome, e] of Object.entries(VARIANTES)) {
      const { sistema, usuario } = saude.montarPedido(e)!;
      const c = casoDe(e);
      assert.ok(!/\p{N}/u.test(sistema) && !/\p{N}/u.test(usuario), `${nome}: número no pedido`);
      for (const n of NUMERAIS_DO_PEDIDO) assert.ok(!casaPorPalavra(usuario, n), `${nome}: "${n}" por extenso no pedido`);
      for (const f of fatos) assert.ok(!usuario.includes(f), `${nome}: o fato "${f}" vazou para o pedido`);
      assert.deepEqual(termosProibidosEm(usuario, TODOS), [], `${nome}: termo proibido no pedido`);
      // O sistema não cita marcador pelo nome: o que cada um traz vai no sentido dele.
      assert.ok(!/[{}]/.test(sistema), 'o sistema cita marcador');
      assert.match(usuario, e.alcance === 'noite' ? /Alcance: uma noite\./ : /Alcance: um período\./);
      assert.ok(usuario.includes('{janela}') && usuario.includes('{quando}'), `${nome}: a janela vai por marcador, sempre`);
      for (const k of c.nomear) assert.ok(usuario.includes(DIMENSION_LABEL[k].toLowerCase()), `${nome}: ${k}`);
      assert.equal(usuario.includes('Não é preciso nomear dimensão.'), c.nomear.length === 0, nome);
      // O marcador de fato só em `uma`, e só o da dimensão nomeada.
      for (const k of CHAVES_DO_PERIODO) {
        assert.equal(usuario.includes(`{${k}}`), c.caso === 'uma' && c.nomear[0] === k, `${nome}: {${k}}`);
      }
      assert.equal(usuario.includes('{medidas}'), c.caso !== 'sem-contagem', `${nome}: {medidas}`);
      assert.equal(
        usuario.includes('{cobertura}'), c.caso === 'sem-contagem' && c.motivo === 'cobertura', `${nome}: {cobertura}`,
      );
    }
    // O empate de duas em palavras, sem o numeral.
    assert.ok(saude.montarPedido(VARIANTES['duas (período)'])!.usuario.includes(
      'Caso: Empatam no ponto mais baixo: a duração e a regularidade.',
    ));
  });

  it('o sentido de {janela} e {quando} diz a forma, que depende só do range', () => {
    const sentido = (e: EntradaDaSaude, m: string) =>
      saude.montarPedido(e)!.usuario.split('\n').find((l) => l.startsWith(`- {${m}}:`))!;
    const noite = VARIANTES['uma (noite)'];
    const semana = VARIANTES['uma (período)'];
    assert.match(sentido(noite, 'janela'), /feminino singular/);
    assert.match(sentido(semana, 'janela'), /masculino plural/);
    assert.match(sentido({ ...semana, range: '4s' }, 'janela'), /feminino plural/);
    assert.match(sentido({ ...semana, range: 'ano' }, 'janela'), /masculino singular/);
    assert.match(sentido(noite, 'quando'), /"na"/);
    assert.match(sentido(semana, 'quando'), /"nos"/);
    assert.match(sentido({ ...semana, range: '4s' }, 'quando'), /"nas"/);
    assert.match(sentido({ ...semana, range: 'ano' }, 'quando'), /"neste" ou por "no"/);
    // {medidas} diz antes de que palavra vai: "dimensão" quando é uma.
    assert.match(sentido(VARIANTES['medidas-insuficientes (período)'], 'medidas'), /logo antes de "dimensão"$/);
    assert.match(sentido(VARIANTES['tudo-no-maximo (período)'], 'medidas'), /logo antes de "dimensões"$/);
  });

  it('o pedido depende só do alcance, do range, do caso e das dimensões — nunca do fato, do passo nem de hoje', () => {
    const e = VARIANTES['uma (período)'];
    assert.deepEqual(saude.montarPedido(e), saude.montarPedido({ ...e }));
    const outroFato: EntradaDaSaude = {
      ...e,
      score: { ...e.score, dimensions: e.score.dimensions.map((d) => (d.key === 'regularidade' ? { ...d, fact: 'SRI 41 · 9 seguidas' } : d)) },
    };
    const outroPasso: EntradaDaSaude = { ...e, janela: { since: '2026-08-28', until: '2026-09-03' } };
    const outroHoje: EntradaDaSaude = { ...e, hoje: '2025-01-02' };
    assert.deepEqual(saude.montarPedido(outroFato), saude.montarPedido(e));
    assert.deepEqual(saude.montarPedido(outroPasso), saude.montarPedido(e));
    assert.deepEqual(saude.montarPedido(outroHoje), saude.montarPedido(e));
    assert.notEqual(frase(outroFato), frase(e), 'o fato muda a frase, e só ela');
    assert.notEqual(janela(outroPasso), janela(e), 'o passo muda o nome da janela, e só ele');
    // Nas janelas de verdade: semanas no mesmo caso têm o mesmo hash. (O
    // contrário não vale: sem contagem, as medidas não entram no pedido, que não
    // cita nenhuma.)
    const hashesPorCaso = (arquivoDe: readonly SleepPeriod[], notasDe: Record<string, number>, passos: number) => {
      const porCaso = new Map<string, Set<string>>();
      for (let offset = 0; offset < passos; offset += 1) {
        const w = entradaDaSaude(arquivoDe, notasDe, { range: '7d', offset, hoje: HOJE });
        const chave = JSON.stringify(casoDe(w));
        const hashes = porCaso.get(chave) ?? new Set<string>();
        hashes.add(hashDoPedido(saude.montarPedido(w)!, saude.versao));
        porCaso.set(chave, hashes);
      }
      return porCaso;
    };
    const texturado = hashesPorCaso(ARQUIVO, NOTAS, 12);
    for (const [chave, hashes] of texturado) assert.equal(hashes.size, 1, chave);
    // Não-vácuo: sessenta noites regulares — seis semanas no mesmo caso, com a
    // janela corrente e cinco de trás, e um pedido só.
    const regular = hashesPorCaso(noites(HOJE, 60), {}, 6);
    assert.equal(regular.size, 1, [...regular.keys()].join(' | '));
    assert.equal([...regular.values()][0].size, 1);
  });

  it('o caso sai do score em cada passo — um caso guardado ao lado não é lido', () => {
    const e = VARIANTES['uma (período)'];
    const comCasoVelho = { ...e, caso: casoDe(VARIANTES['tudo-no-maximo (período)']) } as EntradaDaSaude;
    assert.equal(frase(comCasoVelho), frase(e));
    assert.deepEqual(saude.montarPedido(comCasoVelho), saude.montarPedido(e));
    assert.deepEqual(saude.conferir('A regularidade ficou em {regularidade}.', comCasoVelho), { ok: true });
  });
});

describe('a entrada', () => {
  it('fora de ultima é a fórmula da tela — em toda janela e todo passo para trás', () => {
    const vistos = new Set<string>();
    for (const range of ['7d', '4s', '12m', 'ano'] as SonoRange[]) {
      for (let offset = 0; offset < 12; offset += 1) {
        const e = entradaDaSaude(ARQUIVO, NOTAS, { range, offset, hoje: HOJE });
        const tela = formulaDaTela(ARQUIVO, NOTAS, range, offset);
        const limites = rangeBounds(range, HOJE_DA_TELA, offset);
        assert.equal(e.alcance, 'periodo');
        assert.equal(e.range, range);
        assert.equal(e.hoje, HOJE);
        // A janela é a de rangeBounds — com a corrente aberta, no ano civil também.
        assert.deepEqual(e.janela, { since: limites.since, until: offset === 0 ? null : limites.until }, `${range} ${offset}`);
        assert.deepEqual(e.score, tela, `${range} ${offset}`);
        vistos.add(casoDe(e).caso);
      }
    }
    // Não-vácuo: o arquivo leva as janelas a casos diferentes, com e sem contagem.
    assert.ok(vistos.has('sem-contagem') && vistos.size >= 3, [...vistos].join(', '));
  });

  it('em ultima é a noite, pela nightScore do cartão — quatro dimensões, a nota do dia dela', () => {
    const ordenadas = [...ARQUIVO].sort((a, b) => a.wakeDay.localeCompare(b.wakeDay));
    for (let offset = 0; offset < 5; offset += 1) {
      const e = entradaDaSaude(ARQUIVO, NOTAS, { range: 'ultima', offset, hoje: HOJE });
      const p = ordenadas[ordenadas.length - 1 - offset];
      assert.equal(e.alcance, 'noite');
      assert.equal(e.range, 'ultima');
      assert.equal(e.hoje, HOJE);
      assert.deepEqual(e.janela, { since: p.wakeDay, until: p.wakeDay });
      assert.deepEqual(e.score, nightScore(p, ARQUIVO, NOTAS[p.wakeDay] ?? null));
      assert.deepEqual(e.score.dimensions.map((d) => d.key), CHAVES_DA_NOITE);
    }
  });

  it('ultima sem noite: sem-contagem por sem-noite, as quatro ausentes, uma noite esperada e nenhuma gravada', () => {
    for (const [noitesDe, offset] of [[[], 0], [ARQUIVO, ARQUIVO.length]] as const) {
      const e = entradaDaSaude(noitesDe, NOTAS, { range: 'ultima', offset, hoje: HOJE });
      assert.equal(e.alcance, 'noite');
      assert.deepEqual(e.janela, { since: null, until: null });
      assert.equal(e.score.scored, false);
      assert.deepEqual(e.score.coverage, { nights: 0, expected: 1, ratio: 0 });
      assert.deepEqual(e.score.dimensions.map((d) => [d.key, d.points]), CHAVES_DA_NOITE.map((k) => [k, null]));
      const c = casoDe(e);
      assert.ok(c.caso === 'sem-contagem' && c.motivo === 'sem-noite', JSON.stringify(c));
      assert.equal(frase(e), 'Não há noite gravada.');
      assert.equal(janela(e), 'a última noite');
    }
  });

  it('nada depois de hoje entra: nem a noite que acorda depois dele, nem a nota', () => {
    const antes = '2026-09-01';
    const ateAntes = ARQUIVO.filter((p) => p.wakeDay <= antes);
    const notasAteAntes = Object.fromEntries(Object.entries(NOTAS).filter(([d]) => d <= antes));
    assert.ok(ARQUIVO.length > ateAntes.length, 'não-vácuo: o arquivo tem noites depois do hoje de trás');
    for (const range of ['ultima', '7d', '4s', '12m', 'ano'] as SonoRange[]) {
      for (const offset of [0, 1, 2]) {
        const e = entradaDaSaude(ARQUIVO, NOTAS, { range, offset, hoje: antes });
        assert.deepEqual(e, entradaDaSaude(ateAntes, notasAteAntes, { range, offset, hoje: antes }), `${range} ${offset}`);
        assert.ok(e.janela.until === null || e.janela.until <= antes, `${range} ${offset}`);
      }
    }
    // A última noite de "hoje 01/09" é a de 01/09 — nunca a de 10/09.
    assert.equal(janela(entradaDaSaude(ARQUIVO, NOTAS, { range: 'ultima', offset: 0, hoje: antes })), 'a noite de 01/09');
    // A nota depois de hoje, num dia com noite, não muda a noite de hoje.
    const comNotaDepois = { ...NOTAS, '2026-09-02': 1, '2026-09-03': 5 };
    assert.deepEqual(
      entradaDaSaude(ARQUIVO, comNotaDepois, { range: '7d', offset: 0, hoje: antes }),
      entradaDaSaude(ARQUIVO, NOTAS, { range: '7d', offset: 0, hoje: antes }),
    );
    // O controle: sem o corte, a semana corrente de 01/09 leria as noites de 02 a 10/09.
    const semCorte = periodScore(
      filterByRange(ARQUIVO, '7d', new Date(2026, 8, 1, 12), 0), rangeNights('7d', new Date(2026, 8, 1, 12), 0), NOTAS,
    );
    assert.notDeepEqual(entradaDaSaude(ARQUIVO, NOTAS, { range: '7d', offset: 0, hoje: antes }).score, semCorte);
  });

  it('as notas entram recortadas à janela: a entrada só depende das notas de dentro dela', () => {
    for (const range of ['ultima', '7d', '4s', '12m'] as SonoRange[]) {
      for (const offset of [0, 1, 3]) {
        const e = entradaDaSaude(ARQUIVO, NOTAS, { range, offset, hoje: HOJE });
        const { since, until } = e.janela;
        const dentro = (d: string) => (since === null || d >= since) && (until === null || d <= until);
        const soDaJanela = Object.fromEntries(Object.entries(NOTAS).filter(([d]) => dentro(d)));
        // Uma nota inventada fora da janela, em dia com noite, não muda nada.
        const fora = ARQUIVO.map((p) => p.wakeDay).find((d) => !dentro(d));
        const comFora = fora ? { ...NOTAS, [fora]: NOTAS[fora] === 5 ? 1 : 5 } : NOTAS;
        assert.deepEqual(entradaDaSaude(ARQUIVO, soDaJanela, { range, offset, hoje: HOJE }), e, `${range} ${offset}`);
        assert.deepEqual(entradaDaSaude(ARQUIVO, comFora, { range, offset, hoje: HOJE }), e, `${range} ${offset}`);
      }
    }
    // O controle: a nota de dentro muda a percepção.
    const e = entradaDaSaude(ARQUIVO, NOTAS, { range: '7d', offset: 0, hoje: HOJE });
    const dia = ARQUIVO.map((p) => p.wakeDay).filter((d) => d >= e.janela.since!).pop()!;
    const outra = entradaDaSaude(ARQUIVO, { ...NOTAS, [dia]: NOTAS[dia] === 5 ? 1 : 5 }, { range: '7d', offset: 0, hoje: HOJE });
    assert.notDeepEqual(outra.score.dimensions.find((d) => d.key === 'percepcao'), e.score.dimensions.find((d) => d.key === 'percepcao'));
  });

  it('hoje é um dia local AAAA-MM-DD, e offset um inteiro ≥ 0; outra coisa é defeito de quem chama, e lança', () => {
    for (const ruim of ['2026-9-10', '2026-02-30', '10/09/2026', '', '2026-09-10T12:00:00', '2026-13-01']) {
      assert.throws(() => entradaDaSaude(ARQUIVO, NOTAS, { range: '7d', offset: 0, hoje: ruim }), RangeError, ruim);
    }
    for (const offset of [-1, 1.5, NaN, Infinity, -0.5]) {
      for (const range of ['ultima', '7d'] as SonoRange[]) {
        assert.throws(() => entradaDaSaude(ARQUIVO, NOTAS, { range, offset, hoje: HOJE }), RangeError, `${range} ${offset}`);
      }
    }
  });

  it('o mesmo dia dá a mesma entrada em qualquer fuso — a janela não anda com o relógio de quem roda', () => {
    const antes = process.env.TZ;
    const porFuso = new Map<string, string>();
    try {
      for (const tz of ['UTC', 'Europe/Brussels', 'Pacific/Kiritimati', 'America/Sao_Paulo']) {
        process.env.TZ = tz;
        const leitura = (['ultima', '7d', '4s', '12m', 'ano'] as SonoRange[]).flatMap((range) =>
          [0, 1, 2].map((offset) => {
            const e = entradaDaSaude(ARQUIVO, NOTAS, { range, offset, hoje: HOJE });
            return { e, janela: janela(e), quando: quando(e), frase: frase(e) };
          }),
        );
        porFuso.set(tz, JSON.stringify(leitura));
      }
      // Não-vácuo: o fuso trocou mesmo — meio-dia de hoje é outro instante em cada um.
      process.env.TZ = 'Pacific/Kiritimati';
      const kiritimati = new Date(2026, 8, 10, 12).getTime();
      process.env.TZ = 'America/Sao_Paulo';
      assert.notEqual(new Date(2026, 8, 10, 12).getTime(), kiritimati, 'o processo não trocou de fuso — o teste ficou vácuo');
    } finally {
      if (antes === undefined) delete process.env.TZ;
      else process.env.TZ = antes;
    }
    assert.equal(new Set(porFuso.values()).size, 1, [...porFuso.keys()].join(', '));
  });

  it('é pura: não muda as noites nem as notas, e não lê o relógio', () => {
    const antes = JSON.stringify([ARQUIVO, NOTAS]);
    const ler5 = () => (['ultima', '7d', '4s', '12m', 'ano'] as SonoRange[]).flatMap((range) =>
      [0, 1].map((offset) => {
        const e = entradaDaSaude(ARQUIVO, NOTAS, { range, offset, hoje: HOJE });
        return { e, frase: frase(e), pedido: saude.montarPedido(e) };
      }),
    );
    const esperado = ler5();
    // O relógio sabotado: `Date.now()` e `new Date()` sem argumento lançam.
    const Real = globalThis.Date;
    class Sabotado extends Real {
      constructor(...args: []) {
        if (args.length === 0) throw new Error('a entrada leu o relógio');
        super(...(args as unknown as []));
      }
      static override now(): number {
        throw new Error('a entrada leu o relógio');
      }
    }
    globalThis.Date = Sabotado as DateConstructor;
    let obtido: ReturnType<typeof ler5>;
    try {
      assert.throws(() => new Date(), /leu o relógio/, 'a sabotagem não pegou');
      assert.throws(() => Date.now(), /leu o relógio/, 'a sabotagem não pegou');
      obtido = ler5();
    } finally {
      globalThis.Date = Real;
    }
    assert.deepEqual(obtido, esperado);
    assert.equal(JSON.stringify([ARQUIVO, NOTAS]), antes);
  });
});

describe('a janela', () => {
  it('a corrente se chama pelo tamanho; a de trás, pelas datas; o ano civil, pelo número; a noite, pelo dia', () => {
    const tabela: [SonoRange, number, string, string][] = [
      ['7d', 0, 'os últimos 7 dias', 'nos últimos 7 dias'],
      ['7d', 1, 'os 7 dias de 28/08 a 03/09', 'nos 7 dias de 28/08 a 03/09'],
      ['4s', 0, 'as últimas 4 semanas', 'nas últimas 4 semanas'],
      ['4s', 1, 'as 4 semanas de 17/07 a 13/08', 'nas 4 semanas de 17/07 a 13/08'],
      ['12m', 0, 'os últimos 12 meses', 'nos últimos 12 meses'],
      ['12m', 1, 'os 12 meses de 11/09/2024 a 10/09/2025', 'nos 12 meses de 11/09/2024 a 10/09/2025'],
      ['ano', 0, 'este ano', 'neste ano'],
      ['ano', 1, 'o ano de 2025', 'no ano de 2025'],
    ];
    for (const [range, offset, esperado, esperadoQuando] of tabela) {
      const e = entradaDaSaude(ARQUIVO, NOTAS, { range, offset, hoje: HOJE });
      assert.equal(janela(e), esperado, `${range} ${offset}`);
      assert.equal(quando(e), esperadoQuando, `${range} ${offset}`);
    }
    const hojeComNoite = entradaDaSaude(noites(HOJE, 3), {}, { range: 'ultima', offset: 0, hoje: HOJE });
    assert.equal(janela(hojeComNoite), 'a noite de 10/09');
    assert.equal(quando(hojeComNoite), 'na noite de 10/09');
    const semNoite = entradaDaSaude([], {}, { range: 'ultima', offset: 0, hoje: HOJE });
    assert.equal(janela(semNoite), 'a última noite');
    assert.equal(quando(semNoite), 'na última noite');
  });

  it('a data leva o ano quando a janela atravessa um, ou quando o ano dela não é o de hoje', () => {
    const virada = noites('2026-01-09', 60);
    const e = (range: SonoRange, offset: number, noitesDe = virada) =>
      entradaDaSaude(noitesDe, {}, { range, offset, hoje: '2026-01-09' });
    // Atravessa o ano: as duas pontas com ano.
    assert.equal(janela(e('7d', 1)), 'os 7 dias de 27/12/2025 a 02/01/2026');
    // Inteira no ano passado: o ano dela não é o de hoje.
    assert.equal(janela(e('7d', 2)), 'os 7 dias de 20/12/2025 a 26/12/2025');
    assert.equal(janela(e('4s', 1)), 'as 4 semanas de 15/11/2025 a 12/12/2025');
    // A corrente, que é deste ano, pelo tamanho.
    assert.equal(janela(e('7d', 0)), 'os últimos 7 dias');
    // A noite de outro ano leva o ano; a deste ano, não.
    assert.equal(janela(e('ultima', 20)), 'a noite de 20/12/2025');
    assert.equal(janela(e('ultima', 0)), 'a noite de 09/01');
    assert.equal(quando(e('ultima', 20)), 'na noite de 20/12/2025');
  });

  it('abre a frase com maiúscula quando o motor começa por ela', async () => {
    const e = semanaDaPercepcao();
    const m = await medir(e, '{janela} têm a percepção como a dimensão mais baixa: {percepcao}.');
    assert.equal(m.desfecho, 'ok', JSON.stringify(m.trilha));
    assert.equal(m.frase, 'Os últimos 7 dias têm a percepção como a dimensão mais baixa: 3,3/5 · 4 notas.');
    const q = await medir(e, '{quando}, a percepção ficou abaixo das outras dimensões: {percepcao}.');
    assert.equal(q.desfecho, 'ok', JSON.stringify(q.trilha));
    assert.equal(q.frase, 'Nos últimos 7 dias, a percepção ficou abaixo das outras dimensões: 3,3/5 · 4 notas.');
  });
});

/** A semana da percepção: sete noites iguais e regulares, e quatro notas com média 3,25. */
function semanaDaPercepcao(): EntradaDaSaude {
  const historico = noites('2026-09-03', 20);
  const semana = noites(HOJE, 7);
  const notas = { '2026-09-07': 3, '2026-09-08': 3, '2026-09-09': 3, '2026-09-10': 4 };
  return entradaDaSaude([...historico, ...semana], notas, { range: '7d', offset: 0, hoje: HOJE });
}

describe('a matriz de I/O', () => {
  it('uma no mínimo: período medido, só a regularidade em 0 — o piso nomeia ela com o fato cru', () => {
    const e = VARIANTES['uma (período)'];
    const c = casoDe(e);
    assert.equal(c.caso, 'uma');
    assert.deepEqual([...c.nomear], ['regularidade']);
    assert.equal(frase(e), 'A dimensão mais baixa é a regularidade: SRI 50 · 7 seguidas.');
    assert.equal(frase(VARIANTES['uma (noite)']), 'A dimensão mais baixa é a percepção: 4/5.');
  });

  it('duas: as duas nomeadas', () => {
    assert.equal(casoDe(VARIANTES['duas (período)']).caso, 'duas');
    assert.equal(frase(VARIANTES['duas (período)']), 'A duração e a regularidade empatam no ponto mais baixo.');
    assert.equal(frase(VARIANTES['duas (noite)']), 'A duração e o horário empatam no ponto mais baixo.');
  });

  it('fora do empate: nomeia as de fora — "no máximo" se todas em 2, senão "acima das outras"', () => {
    assert.equal(frase(VARIANTES['fora-do-empate, no máximo']), 'Só o horário está no máximo.');
    assert.equal(frase(VARIANTES['fora-do-empate, acima']), 'Só o horário e a percepção estão acima das outras.');
    assert.equal(frase(VARIANTES['fora-do-empate (noite)']), 'Só a percepção está no máximo.');
  });

  it('todas iguais: com a contagem real, por extenso', () => {
    assert.equal(frase(VARIANTES['todas-iguais (período)']), 'As quatro dimensões medidas estão no mesmo ponto.');
    assert.equal(frase(VARIANTES['todas-iguais (noite)']), 'As duas dimensões medidas estão no mesmo ponto.');
  });

  it('tudo no máximo: sem elogio, com a contagem real', () => {
    assert.equal(frase(VARIANTES['tudo-no-maximo (período)']), 'As cinco dimensões medidas estão no máximo.');
    assert.equal(frase(VARIANTES['tudo-no-maximo (noite)']), 'As quatro dimensões medidas estão no máximo.');
    assert.equal(frase(entrada('noite', [2, null, 2, 2])), 'As três dimensões medidas estão no máximo.');
  });

  it('uma medida só: medidas-insuficientes, no alcance certo', () => {
    assert.equal(frase(VARIANTES['medidas-insuficientes (período)']), 'Só uma dimensão foi medida neste período — não há o que comparar.');
    assert.equal(frase(VARIANTES['medidas-insuficientes (noite)']), 'Só uma dimensão foi medida nesta noite — não há o que comparar.');
  });

  it('sem contagem: diz a cobertura quando houver, e nunca fala em conjunto', () => {
    assert.equal(frase(VARIANTES['sem-contagem, cobertura']), 'Este período tem 42% das noites gravadas — poucas para contar.');
    assert.equal(frase(VARIANTES['sem-contagem, sem noite']), 'Este período não tem noite gravada.');
    assert.equal(frase(VARIANTES['sem-contagem, noite sem noite']), 'Não há noite gravada.');
    assert.equal(frase(VARIANTES['sem-contagem, noite sem medida']), 'Esta noite não tem medida para contar.');
    assert.equal(frase(VARIANTES['sem-contagem, período sem medida']), 'Este período não tem medida para contar.');
    for (const [nome, e] of Object.entries(VARIANTES)) {
      assert.ok(!/conjunto/i.test(frase(e)), `${nome}: "${frase(e)}"`);
      assert.ok(!/conjunto/i.test(saude.montarPedido(e)!.usuario), `${nome}: o pedido fala em conjunto`);
    }
  });

  it('sem contagem pela entrada de verdade: período vazio, abaixo do piso, e o ano com uma noite', () => {
    const vazio = entradaDaSaude(ARQUIVO, NOTAS, { range: '7d', offset: 50, hoje: HOJE });
    assert.equal(frase(vazio), 'Este período não tem noite gravada.');
    const tres = entradaDaSaude(noites(HOJE, 3), {}, { range: '7d', offset: 0, hoje: HOJE });
    assert.equal(frase(tres), 'Este período tem 42% das noites gravadas — poucas para contar.');
    const umaNoAno = entradaDaSaude(noites(HOJE, 1), {}, { range: 'ano', offset: 0, hoje: HOJE });
    assert.equal(frase(umaNoAno), 'Este período tem 1% das noites gravadas — poucas para contar.');
  });

  it('a cobertura é o piso da porcentagem em aritmética inteira, e 1% com noite — contra um oráculo que só soma', () => {
    /** O maior `p` com `p × esperadas ≤ noites × 100`, por soma — sem divisão nem ponto flutuante. */
    const oraculo = (nights: number, expected: number): number => {
      let p = 0;
      while ((p + 1) * expected <= nights * 100) p += 1;
      return Math.max(1, p);
    };
    const pisoPct = oraculo(7, 10);
    assert.equal(pisoPct, Math.round(SCORE_COVERAGE_FLOOR * 100), 'o piso de 70% pelo mesmo oráculo');
    let n = 0;
    for (let expected = 1; expected <= 366; expected += 1) {
      for (let nights = 1; nights <= expected; nights += 1) {
        const ratio = Math.min(1, nights / expected);
        if (ratio >= SCORE_COVERAGE_FLOOR) continue;
        const f = frase(entrada('periodo', [2, 1, 2, null, 1], { nights, expected, ratio }));
        const pct = Number(/tem (\d+)% das noites/.exec(f)?.[1]);
        assert.equal(pct, oraculo(nights, expected), `${nights}/${expected}: "${f}"`);
        assert.ok(pct >= 1 && pct < pisoPct, `${nights}/${expected}: "${f}"`);
        n += 1;
      }
    }
    assert.ok(n > 40_000, `não-vácuo: ${n} coberturas abaixo do piso`);
    // As bordas que o arredondamento e o ponto flutuante erravam.
    const pctDe = (nights: number, expected: number) =>
      frase(entrada('periodo', [2, 1, 2, null, 1], { nights, expected, ratio: nights / expected }));
    assert.match(pctDe(48, 69), /tem 69% das/, '69,6% sai 69%, nunca 70% abaixo do piso');
    assert.match(pctDe(29, 100), /tem 29% das/, '29 de 100 é 29%, e não 28% por 0,29 × 100');
    assert.match(pctDe(1, 365), /tem 1% das/, 'uma noite no ano é 1%, nunca 0%');
  });

  it('percepção do período: notas com média 3,25 viram o fato "3,3/5 · 4 notas"', () => {
    const e = semanaDaPercepcao();
    const d = e.score.dimensions.find((x) => x.key === 'percepcao')!;
    assert.equal(d.fact, '3,3/5 · 4 notas');
    assert.equal(d.points, 1);
    const c = casoDe(e);
    assert.equal(c.caso, 'uma');
    assert.deepEqual([...c.nomear], ['percepcao']);
    assert.equal(frase(e), 'A dimensão mais baixa é a percepção: 3,3/5 · 4 notas.');
  });

  it('produto, sem preferência: a cadeia padrão é só sem-modelo — piso com a frase do template, causa preferência', async () => {
    const e = semanaDaPercepcao();
    const aparelho = motorFalso(resposta('A percepção ficou em {percepcao}.'));
    const h = hospedeiro({ [APARELHO_SISTEMA]: aparelho.motor });
    const cadeia = resolverCadeia(saude, undefined, CATALOGO);
    assert.deepEqual([...cadeia], [SEM_MODELO]);
    const l = piso(await ler(saude, e, h.produto(cadeia)));
    assert.equal(l.causa, 'preferencia');
    assert.equal(l.frase, frase(e));
    assert.deepEqual(aparelho.pedidos, []);
  });

  it('motor bom, na medição: texto sem número com os marcadores do caso — a frase sai interpolada, em pt-BR', async () => {
    const e = semanaDaPercepcao();
    const aparelho = motorFalso(resposta('Das {medidas} dimensões medidas, a percepção é a que ficou mais baixa: {percepcao}.'));
    const m = tentativa(await ler(saude, e, hospedeiro({ [APARELHO_SISTEMA]: aparelho.motor }).medicao(APARELHO_SISTEMA)));
    assert.equal(m.desfecho, 'ok', JSON.stringify(m.trilha));
    assert.equal(m.frase, 'Das cinco dimensões medidas, a percepção é a que ficou mais baixa: 3,3/5 · 4 notas.');
    assert.deepEqual(aparelho.pedidos, [saude.montarPedido(e)]);
  });

  it('motor bom, no produto por escolha explícita: origem motor, a frase interpolada', async () => {
    const e = semanaDaPercepcao();
    const nuvem = motorFalso(resposta('A percepção ficou abaixo das outras dimensões: {percepcao}.', 'nuvem'));
    const cadeia = resolverCadeia(saude, NUVEM_PADRAO, CATALOGO);
    assert.deepEqual([...cadeia], [NUVEM_PADRAO, SEM_MODELO]);
    const l = await ler(saude, e, hospedeiro({ [NUVEM_PADRAO]: nuvem.motor }).produto(cadeia));
    assert.equal(l.origem, 'motor');
    assert.equal(l.origem === 'motor' && l.frase, 'A percepção ficou abaixo das outras dimensões: 3,3/5 · 4 notas.');
  });

  it('a resposta chega com espaço e aspas em volta: a leitura os tira antes de conferir', async () => {
    const m = await medir(semanaDaPercepcao(), '  “Das {medidas} dimensões medidas, a percepção é a mais baixa: {percepcao}.”\n');
    assert.equal(m.desfecho, 'ok', JSON.stringify(m.trilha));
    assert.equal(m.frase, 'Das cinco dimensões medidas, a percepção é a mais baixa: 3,3/5 · 4 notas.');
  });

  it('o motor bom de cada caso passa — as regras não reprovam a redação honesta', async () => {
    const bons: [string, string][] = [
      ['uma (período)', '{janela} têm a regularidade como a dimensão mais baixa: {regularidade}.'],
      ['uma (período)', '{quando}, a regularidade ficou abaixo das outras dimensões, e as outras são mais altas.'],
      ['uma (noite)', 'A percepção é a dimensão mais baixa {quando}: {percepcao}.'],
      ['duas (período)', 'Duas dimensões empatam no ponto mais baixo: a duração e a regularidade.'],
      ['duas (noite)', '{quando}, a duração e o horário empatam no ponto mais baixo.'],
      ['fora-do-empate, acima', 'O horário e a percepção ficam acima das outras dimensões.'],
      ['fora-do-empate, no máximo', 'Das {medidas} dimensões medidas, só o horário está no máximo.'],
      ['todas-iguais (período)', 'Nas {medidas} dimensões medidas, o ponto é o mesmo.'],
      ['tudo-no-maximo (noite)', 'As {medidas} dimensões medidas da noite estão no máximo.'],
      ['tudo-no-maximo (período)', '{quando}, as {medidas} dimensões medidas estão no máximo.'],
      ['medidas-insuficientes (noite)', 'Só {medidas} dimensão foi medida, e não há o que comparar.'],
      ['sem-contagem, cobertura', '{janela} têm {cobertura} das noites gravadas, poucas para contar.'],
      ['sem-contagem, sem noite', 'Não há noite gravada neste período.'],
      ['sem-contagem, noite sem noite', 'Não há noite gravada.'],
      ['sem-contagem, noite sem medida', 'Não há medida para contar nesta noite.'],
    ];
    for (const [nome, texto] of bons) {
      const m = await medir(VARIANTES[nome], texto);
      assert.equal(m.desfecho, 'ok', `${nome}: "${texto}" → ${JSON.stringify(m.trilha[0].problemas)}`);
    }
  });

  for (const [como, texto, regra] of [
    ['calcula', 'A percepção ficou em 3,3 de 5: {percepcao}.', 'algarismo'],
    ['escreve número por extenso', 'Das cinco dimensões, a percepção é a mais baixa: {percepcao}.', 'extenso'],
    ['escreve "duas" fora de duas', 'Duas dimensões ficam acima, e a percepção abaixo: {percepcao}.', 'extenso'],
    ['usa marcador fora do caso', 'A percepção ficou em {percepcao}, com {cobertura}.', 'marcador'],
    ['põe o fato de outra dimensão', 'A percepção ficou em {regularidade}.', 'marcador'],
    ['repete o marcador', 'A percepção ficou em {percepcao}, sim, {percepcao}.', 'marcador'],
    ['põe {medidas} fora do lugar', 'A percepção é a mais baixa das {medidas} medidas: {percepcao}.', 'marcador'],
    ['põe a janela depois de preposição', 'Em {janela}, a percepção ficou em {percepcao}.', 'marcador'],
    ['nomeia a janela de outro jeito', 'Nesta semana, a percepção ficou em {percepcao}.', 'marcador'],
    ['embrulha o marcador', 'A percepção ficou em [percepcao].', 'chave'],
    ['cola o nome ao cifrão', 'A percepção ficou em $percepcao.', 'chave'],
    ['acrescenta a unidade', 'A percepção ficou em {percepcao} %.', 'chave'],
    ['nomeia dimensão a mais', 'A percepção ficou em {percepcao}, abaixo da duração.', 'a-mais'],
    ['nomeia dimensão a mais pelo plural', 'A percepção ficou em {percepcao}, com horários soltos.', 'a-mais'],
    ['escreve duas frases', 'A percepção ficou em {percepcao}. É a mais baixa.', 'forma'],
    ['abre com rótulo', 'Frase: a percepção ficou em {percepcao}.', 'forma'],
    ['abre como lista', '- A percepção ficou em {percepcao}.', 'forma'],
    ['esconde um caractere', `A percepção${String.fromCodePoint(0x200b)} ficou em {percepcao}.`, 'forma'],
    ['passa do tamanho', `A percepção ficou em {percepcao}, ${'e'.repeat(260)}.`, 'forma'],
    ['afirma outro caso', 'A percepção é a dimensão mais alta: {percepcao}.', 'contradicao'],
    ['diz que as outras empatam', 'A percepção ficou abaixo, e as outras empatam: {percepcao}.', 'contradicao'],
    ['aconselha', 'A percepção ficou em {percepcao}; recomendamos dormir mais cedo.', 'vocabulario'],
    ['elogia', 'A percepção ficou em {percepcao}, um resultado ótimo.', 'vocabulario'],
    ['fala em tendência', 'A percepção está piorando: {percepcao}.', 'vocabulario'],
    ['dá placar', 'A percepção ficou em {percepcao}, a menor das pontuações.', 'vocabulario'],
    ['afirma causa pela contração', 'A percepção ficou em {percepcao}, devido ao sono curto.', 'vocabulario'],
    ['forma causa na troca', 'A percepção ficou em {percepcao}, o que resultou {quando}.', 'vocabulario'],
    ['esconde a causa antes da janela', 'A percepção ficou em {percepcao} devido {janela}.', 'marcador'],
  ] as const) {
    it(`motor que ${como}: reprovada — na medição e no produto, que cai no template`, async () => {
      const e = semanaDaPercepcao();
      const aparelho = motorFalso(resposta(texto));
      const h = hospedeiro({ [APARELHO_SISTEMA]: aparelho.motor });

      const m = tentativa(await ler(saude, e, h.medicao(APARELHO_SISTEMA)));
      assert.equal(m.desfecho, 'reprovada', JSON.stringify(m.trilha));
      assert.equal(m.frase, undefined);
      assert.ok(m.trilha[0].problemas?.some((p) => p.regra === regra), JSON.stringify(m.trilha));

      const l = piso(await ler(saude, e, h.produto(resolverCadeia(saude, APARELHO_SISTEMA, CATALOGO))));
      assert.equal(l.causa, 'reprovada');
      assert.equal(l.frase, frase(e));
    });
  }

  it('um termo de cada subconjunto, pelo conferir da Saúde: reprovada, com o subconjunto no detalhe', async () => {
    const porSubconjunto: Readonly<Record<SubconjuntoProibido, string>> = {
      causa: 'A percepção ficou abaixo das outras por conta disso: {percepcao}.',
      conselho: 'A percepção ficou em {percepcao}; tente deitar cedo.',
      elogio: 'A percepção ficou em {percepcao}, uma marca ótima.',
      placar: 'A percepção ficou em {percepcao}, com menos pontos que as outras.',
      'tendencia-e-meta': 'A percepção caiu para {percepcao}.',
      comparacao: 'A percepção ficou em {percepcao}, abaixo de outras pessoas.',
    };
    const e = semanaDaPercepcao();
    for (const [subconjunto, texto] of Object.entries(porSubconjunto)) {
      const c = saude.conferir(texto, e);
      assert.ok(!c.ok && !c.recusa, `${subconjunto}: ${JSON.stringify(c)}`);
      assert.deepEqual(c.problemas.map((p) => p.regra), ['vocabulario'], `${subconjunto}: ${JSON.stringify(c.problemas)}`);
      assert.ok(c.problemas[0].detalhe.startsWith(`${subconjunto}:`), `${subconjunto}: ${c.problemas[0].detalhe}`);
      assert.equal((await medir(e, texto)).desfecho, 'reprovada', subconjunto);
    }
  });

  it('o motor que contradiz o caso: cada caso tem a sua, e a frase do template não se contradiz', async () => {
    const contradicoes: [string, string][] = [
      ['uma (período)', 'A regularidade é a mais baixa, e as outras estão no máximo.'],
      ['uma (noite)', 'A percepção fica abaixo, e a duração é a melhor: {percepcao}.'],
      ['duas (período)', 'A duração e a regularidade estão no máximo.'],
      ['duas (noite)', 'A duração e o horário são a pior parte, no mínimo.'],
      ['fora-do-empate, acima', 'O horário e a percepção estão no máximo.'],
      ['fora-do-empate, no máximo', 'Só o horário fica fora do empate, e o resto está no mínimo.'],
      ['tudo-no-maximo (período)', 'As {medidas} dimensões medidas estão no máximo, nenhuma abaixo.'],
      ['tudo-no-maximo (noite)', 'As {medidas} dimensões medidas estão no máximo, e nenhuma é a mais baixa.'],
      ['todas-iguais (período)', 'As {medidas} dimensões medidas estão no máximo.'],
      ['todas-iguais (noite)', 'As {medidas} dimensões medidas estão no mesmo ponto, acima do resto.'],
      ['medidas-insuficientes (período)', 'Só {medidas} dimensão foi medida, e ela empata.'],
      ['sem-contagem, cobertura', '{janela} têm {cobertura} das noites gravadas, e as dimensões empatam.'],
      ['sem-contagem, sem noite', 'Este período não tem noite gravada, e está tudo no mesmo ponto.'],
    ];
    for (const [nome, texto] of contradicoes) {
      const m = await medir(VARIANTES[nome], texto);
      assert.equal(m.desfecho, 'reprovada', `${nome}: "${texto}" → ${JSON.stringify(m.trilha)}`);
      assert.ok(regrasDe(m).includes('contradicao'), `${nome}: ${JSON.stringify(m.trilha[0].problemas)}`);
    }
    // Não-vácuo nos sete casos.
    assert.equal(new Set(contradicoes.map(([nome]) => casoDe(VARIANTES[nome]).caso)).size, 7);
  });

  it('motor que troca a dimensão: reprovada, não recusa — errar não é recusar', async () => {
    // Nomeia a duração, que o caso não cita, e não nomeia a percepção, que ele exige:
    // `a-mais` + `ausente`. A bancada da 5.4 conta troca de dimensão como texto errado.
    const m = await medir(semanaDaPercepcao(), 'A duração ficou em {percepcao}.');
    assert.equal(m.desfecho, 'reprovada', JSON.stringify(m.trilha));
    assert.deepEqual(regrasDe(m), ['a-mais', 'ausente']);
    const l = piso(await ler(
      saude, semanaDaPercepcao(),
      hospedeiro({ [APARELHO_SISTEMA]: motorFalso(resposta('A duração ficou em {percepcao}.')).motor })
        .produto(resolverCadeia(saude, APARELHO_SISTEMA, CATALOGO)),
    ));
    assert.equal(l.causa, 'reprovada');
  });

  it('motor que omite a dimensão do caso: recusa-do-modelo', async () => {
    const e = semanaDaPercepcao();
    const h = hospedeiro({ [APARELHO_SISTEMA]: motorFalso(resposta('As noites foram regulares {quando}.')).motor });
    const m = tentativa(await ler(saude, e, h.medicao(APARELHO_SISTEMA)));
    assert.equal(m.desfecho, 'recusa-do-modelo');
    assert.ok(m.trilha[0].problemas?.some((p) => p.regra === 'ausente'));
    const l = piso(await ler(saude, e, h.produto(resolverCadeia(saude, APARELHO_SISTEMA, CATALOGO))));
    assert.equal(l.causa, 'recusa-do-modelo');
    assert.equal(l.frase, frase(e));
  });

  it('o marcador da dimensão sozinho não a nomeia: recusa-do-modelo', async () => {
    const m = await medir(semanaDaPercepcao(), 'O ponto mais baixo {quando} fica em {percepcao}.');
    assert.equal(m.desfecho, 'recusa-do-modelo', JSON.stringify(m.trilha));
    assert.deepEqual(regrasDe(m), ['ausente']);
  });

  it('a recusa é recusa-do-modelo em todo caso — a de texto livre, e a que cita o que o caso exige', async () => {
    /** A recusa que traz o exigido do caso: o nome, o marcador ou a palavra do alcance. */
    const citaOExigido = (e: EntradaDaSaude): string => {
      const c = casoDe(e);
      switch (c.caso) {
        case 'uma':
        case 'duas':
        case 'fora-do-empate':
          return `Desculpe, não posso analisar ${c.nomear.map((k) => DIMENSION_LABEL[k].toLowerCase()).join(' e ')}.`;
        case 'medidas-insuficientes':
          return 'Não posso comentar só {medidas} dimensão.';
        case 'tudo-no-maximo':
        case 'todas-iguais':
          return 'Não posso comentar as {medidas} dimensões medidas.';
        case 'sem-contagem':
          return c.motivo === 'cobertura'
            ? 'Não consigo ler {cobertura} das noites gravadas.'
            : `Lamento, ${e.alcance === 'noite' ? 'noite' : 'período'} sem leitura.`;
      }
    };
    const vistos = new Set<string>();
    for (const [nome, e] of Object.entries(VARIANTES)) {
      for (const [texto, comExigido] of [
        ['Desculpe, não posso ajudar com isso.', false], ['Não posso responder a esse pedido.', false], [citaOExigido(e), true],
      ] as const) {
        const h = hospedeiro({ [APARELHO_SISTEMA]: motorFalso(resposta(texto)).motor });
        const m = tentativa(await ler(saude, e, h.medicao(APARELHO_SISTEMA)));
        assert.equal(m.desfecho, 'recusa-do-modelo', `${nome}: "${texto}" → ${JSON.stringify(m.trilha)}`);
        assert.ok(regrasDe(m).includes('recusa'), `${nome}: "${texto}"`);
        // A que cita o exigido não tem falta nenhuma: é recusa só pelo sinal.
        assert.equal(regrasDe(m).includes('ausente'), !comExigido, `${nome}: "${texto}" → ${JSON.stringify(m.trilha[0].problemas)}`);
        const l = piso(await ler(saude, e, h.produto(resolverCadeia(saude, APARELHO_SISTEMA, CATALOGO))));
        assert.equal(l.causa, 'recusa-do-modelo', nome);
        assert.equal(l.frase, frase(e), nome);
      }
      const c = casoDe(e);
      vistos.add(c.caso === 'sem-contagem' ? `${c.caso}:${c.motivo}:${e.alcance}` : `${c.caso}:${e.alcance}`);
    }
    // Os dezessete pares caso × alcance das variantes (fora-do-empate de período
    // aparece duas vezes, com a mesma chave).
    assert.equal(vistos.size, 17, [...vistos].join(', '));
  });

  it('o termo de causa que só nasce na troca reprova — e a janela depois do radical da causa também', async () => {
    // "resultou {quando}" vira "resultou nos últimos 7 dias": "resultou em", pela contração.
    const troca = await medir(semanaDaPercepcao(), 'A percepção ficou em {percepcao}, o que resultou {quando}.');
    assert.equal(troca.desfecho, 'reprovada');
    assert.ok(regrasDe(troca).includes('vocabulario'), JSON.stringify(troca.trilha));
    assert.ok(troca.trilha[0].problemas?.some((p) => p.detalhe === 'causa: "resultou em"'));
    // "resultou {janela}" não forma termo nenhum ("resultou os últimos 7 dias"), e é o
    // radical antes da janela que o pega.
    const comJanela = await medir(semanaDaPercepcao(), 'A percepção ficou em {percepcao}, o que resultou {janela}.');
    assert.equal(comJanela.desfecho, 'reprovada');
    assert.deepEqual(regrasDe(comJanela), ['marcador']);
    // "provocou" e "causou" são termos de uma palavra: o vocabulário os pega no texto.
    for (const verbo of ['provocou', 'causou']) {
      const m = await medir(semanaDaPercepcao(), `A percepção ficou em {percepcao}, o que ${verbo} a noite curta.`);
      assert.equal(m.desfecho, 'reprovada', verbo);
      assert.ok(regrasDe(m).includes('vocabulario'), `${verbo}: ${JSON.stringify(m.trilha[0].problemas)}`);
    }
    // "devido {janela}" nas 4 semanas vira "devido as últimas 4 semanas": o termo nasce na troca.
    const quatro: EntradaDaSaude = { ...semanaDaPercepcao(), range: '4s' };
    const m = await medir(quatro, 'A percepção ficou em {percepcao} devido {janela}.');
    assert.equal(m.desfecho, 'reprovada');
    assert.ok(regrasDe(m).includes('vocabulario') && regrasDe(m).includes('marcador'), JSON.stringify(m.trilha));
    // Nos 7 dias, "devido os últimos 7 dias" não forma termo nenhum — e o radical antes da janela reprova.
    const sete = await medir(semanaDaPercepcao(), 'A percepção ficou em {percepcao} devido {janela}.');
    assert.deepEqual(regrasDe(sete), ['marcador']);
  });

  it('a resposta vazia é recusa-do-modelo', async () => {
    const m = await medir(semanaDaPercepcao(), '  “ ” ');
    assert.equal(m.desfecho, 'recusa-do-modelo', JSON.stringify(m.trilha));
    assert.ok(regrasDe(m).includes('recusa'));
  });

  it('o eco do pedido não é leitura: quebra de linha e mais de uma frase', async () => {
    const e = semanaDaPercepcao();
    const m = await medir(e, saude.montarPedido(e)!.usuario);
    assert.notEqual(m.desfecho, 'ok');
    assert.ok(m.trilha[0].problemas?.some((p) => p.regra === 'forma'), JSON.stringify(m.trilha));
  });
});

describe('os defeitos, que lançam em vez de escrever errado', () => {
  it('cobertura incoerente não vira "NaN%": lança', () => {
    // Sem noites esperadas, e com a razão discordando da divisão.
    for (const coverage of [
      { nights: 3, expected: 0, ratio: 0 },
      { nights: 3, expected: -7, ratio: 0 },
      { nights: 3, expected: 7, ratio: 0.1 },
    ]) {
      const e = entrada('periodo', [2, 1, 2, null, 1], coverage);
      assert.ok(casoDe(e).caso === 'sem-contagem', JSON.stringify(coverage));
      assert.throws(() => frase(e), RangeError, JSON.stringify(coverage));
    }
    // A razão que não é número não chega ao motivo `cobertura`: `NaN < piso` é falso, e
    // o caso sai como `sem-medida` — a frase não inventa cobertura baixa.
    const comNaN = entrada('periodo', [2, 1, 2, null, 1], { nights: 3, expected: 7, ratio: NaN });
    const cNaN = casoDe(comNaN);
    assert.ok(cNaN.caso === 'sem-contagem' && cNaN.motivo === 'sem-medida');
    assert.equal(frase(comNaN), 'Este período não tem medida para contar.');
    // O controle: coerente, escreve a porcentagem.
    assert.match(frase(entrada('periodo', [2, 1, 2, null, 1], { nights: 3, expected: 7, ratio: 3 / 7 })), /42%/);
  });

  it('sem-contagem por cobertura numa noite lança: a noite não tem cobertura de período', () => {
    // O `nightScore` passa `coverage: null`, então isto não existe na vida real — e se
    // existisse, a frase chamaria uma noite de "período".
    const e = entrada('noite', [2, 1, 2, 1], { nights: 3, expected: 7, ratio: 3 / 7 });
    const c = casoDe(e);
    assert.ok(c.caso === 'sem-contagem' && c.motivo === 'cobertura');
    assert.throws(() => frase(e), RangeError);
    assert.throws(() => saude.montarFrase(templateDaSaude(e), e), RangeError);
  });

  it('o ajudante do teste lança quando faltam pontos — senão o teste mede outra coisa', () => {
    assert.throws(() => entrada('periodo', [2, 1, 2]), RangeError);
    assert.throws(() => entrada('noite', [2, 1, 2, 1, 0]), RangeError);
  });
});

describe('o template', () => {
  const TODOS = Object.keys(VOCABULARIO_PROIBIDO) as SubconjuntoProibido[];

  it('cada frase do template, com os marcadores, passa na conferência da Saúde — a contradição do próprio caso inclusive', () => {
    for (const [nome, e] of Object.entries(VARIANTES)) {
      assert.deepEqual(saude.conferir(templateDaSaude(e), e), { ok: true }, `${nome}: "${templateDaSaude(e)}"`);
    }
  });

  it('e as das janelas de verdade também — toda janela do arquivo, em todo alcance', () => {
    const vistos = new Set<string>();
    for (const range of ['ultima', '7d', '4s', '12m', 'ano'] as SonoRange[]) {
      for (let offset = 0; offset < 30; offset += 1) {
        const e = entradaDaSaude(ARQUIVO, NOTAS, { range, offset, hoje: HOJE });
        assert.deepEqual(saude.conferir(templateDaSaude(e), e), { ok: true }, `${range} ${offset}: ${templateDaSaude(e)}`);
        vistos.add(casoDe(e).caso);
      }
    }
    assert.ok(vistos.size >= 4, [...vistos].join(', '));
  });

  it('o piso é o template passado pelo mesmo interpolar: nenhum marcador sobra, e o fato só entra em uma', () => {
    const fatos = new Set([...Object.values(FATO_DO_PERIODO), ...Object.values(FATO_DA_NOITE)].filter((f) => f !== '—'));
    for (const [nome, e] of Object.entries(VARIANTES)) {
      const f = frase(e);
      assert.ok(!/[{}]/.test(f), `${nome}: "${f}"`);
      assert.equal(saude.montarFrase(templateDaSaude(e), e), f, nome);
      const citaFato = [...fatos].some((x) => f.includes(x));
      assert.equal(citaFato, casoDe(e).caso === 'uma', `${nome}: "${f}"`);
    }
  });

  it('nenhuma frase usa termo proibido — por palavra inteira, os seis subconjuntos', () => {
    for (const [nome, e] of Object.entries(VARIANTES)) {
      assert.deepEqual(termosProibidosEm(frase(e), TODOS), [], nome);
    }
  });

  it('as variantes cobrem os sete casos, a noite e o período, e os três motivos', () => {
    const casos = Object.values(VARIANTES).map(casoDe);
    assert.deepEqual(
      [...new Set(casos.map((c) => c.caso))].sort(),
      ['duas', 'fora-do-empate', 'medidas-insuficientes', 'sem-contagem', 'todas-iguais', 'tudo-no-maximo', 'uma'],
    );
    assert.deepEqual(
      [...new Set(casos.flatMap((c) => (c.caso === 'sem-contagem' ? [c.motivo] : [])))].sort(),
      ['cobertura', 'sem-medida', 'sem-noite'],
    );
    for (const alcance of ['noite', 'periodo'] as const) {
      const doAlcance = Object.values(VARIANTES).filter((e) => e.alcance === alcance).map((e) => casoDe(e).caso);
      assert.equal(new Set(doAlcance).size, 7, `${alcance}: ${[...new Set(doAlcance)].join(', ')}`);
    }
  });
});
