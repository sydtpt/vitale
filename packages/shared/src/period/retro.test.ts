import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { Activity } from '../models/index';
import { buildRetrospective, type RetroInput, type RetroMarcos } from './retro';

/**
 * Os marcos da Retrospectiva — **saem do dado** (Story 2.6).
 *
 * O que separa "zero" de "não medido" é quando cada contagem começou a ser
 * registrada, e a regra do épico é uma só: o marco vem do dado, nunca de uma data
 * escrita no código. Aqui se prova que ele vem — e que vem `null` quando o dado
 * não tem nenhum, que é a resposta de "nunca foi registrado".
 *
 * Quem **usa** os marcos é `ia/pacote.ts`, e a matriz inteira está em
 * `ia/pacote.test.ts`. Este arquivo cobre só a origem deles.
 */

/** Outubro de 2026, meio-dia local: o mês anterior (setembro) é o período de `offset: -1`. */
const AGORA = new Date(2026, 9, 6, 12, 0, 0);

let n = 0;
function atividade(dia: string, extra: Partial<Activity> = {}): Activity {
  return {
    id: `a${n += 1}`, userId: 'u', activityId: 13, calories: 0,
    startAt: `${dia}T08:00:00`, endAt: `${dia}T09:00:00`, durationS: 3600,
    distanceM: 20_000, hasRoute: true,
    ...extra,
  };
}

/** O mínimo que `buildRetrospective` exige, com o que o teste quiser por cima. */
function marcosDe(ajuste: Partial<RetroInput> = {}): RetroMarcos {
  const resumo = buildRetrospective({
    now: AGORA,
    kind: 'month',
    offset: -1,
    activities: [],
    health: [],
    habits: [],
    registros: [],
    tasks: [],
    purchases: [],
    ...ajuste,
  });
  assert.equal(resumo.startISO, '2026-09-01', 'o fixture caiu em outro mês');
  assert.ok(resumo.marcos, '`buildRetrospective` deixou de preencher os marcos');
  return resumo.marcos;
}

describe('os marcos da Retrospectiva — a atividade', () => {
  it('acervo vazio: não há marco, e isso é a resposta — nada foi registrado', () => {
    assert.equal(marcosDe().atividades, null);
  });

  it('o marco é a PRIMEIRA atividade, qualquer que seja a ordem da lista', () => {
    const m = marcosDe({
      activities: [atividade('2026-06-10'), atividade('2024-03-02'), atividade('2025-11-20')],
    });
    assert.equal(m.atividades, '2024-03-02');
  });

  it('o marco e a contagem olham a MESMA lista — nem o marco nem `fitness.count` filtram por conta própria', () => {
    // O invariante não é "com as ocultas" nem "sem as ocultas": é que os dois
    // leem `input.activities` como ela chega, qualquer que seja o filtro que o
    // hospedeiro aplicou antes (em produção, `retroInputDe` tira as ocultas).
    // `totalsInRange` não filtra `hidden`, e o marco também não — um marco tirado
    // de outro conjunto poria a contagem e a data dela em desacordo.
    const ocultaPrimeiro = [atividade('2025-01-04', { hidden: true }), atividade('2026-02-02')];
    assert.equal(marcosDe({ activities: ocultaPrimeiro }).atividades, '2025-01-04');
    // E com a mesma lista já filtrada pelo hospedeiro, o marco anda junto.
    assert.equal(marcosDe({ activities: ocultaPrimeiro.filter((a) => !a.hidden) }).atividades, '2026-02-02');
  });

  it('instante que não se lê não vira marco', () => {
    const m = marcosDe({ activities: [atividade('2026-02-02'), atividade('nao-e-data')] });
    assert.equal(m.atividades, '2026-02-02');
  });
});

describe('os marcos da Retrospectiva — as séries de tarefa e de compras', () => {
  /*
   * Ausente e vazio são respostas DIFERENTES, e a diferença protege zero
   * legítimo: quem monta o `RetroInput` à mão sem o campo novo (a store da web é
   * um) não pode, por omissão, apagar "0 tarefas" de um mês que tinha to-do.
   */
  it('sem o campo `taskSeries`, os dois marcos NÃO nascem — ninguém informou', () => {
    const m = marcosDe();
    assert.equal('tarefas' in m, false, 'a chave nasceu, e `null` diria "nunca houve série"');
    assert.equal('compras' in m, false);
    assert.equal(m.tarefas, undefined);
    assert.equal(m.compras, undefined);
  });

  it('com `taskSeries` vazia, os dois marcos são `null` — o dado diz que nunca houve série', () => {
    const m = marcosDe({ taskSeries: [] });
    assert.equal(m.tarefas, null);
    assert.equal(m.compras, null);
  });

  it('tarefas é o menor `createdOn` de TODAS as séries; compras, só o das de compras', () => {
    const m = marcosDe({
      taskSeries: [
        { createdOn: '2026-03-01', module: 'compras' },
        { createdOn: '2025-12-10', module: 'casa' },
        { createdOn: '2026-05-04', module: 'compras' },
      ],
    });
    assert.equal(m.tarefas, '2025-12-10', 'a contagem de tarefas conta a ocorrência de qualquer módulo');
    assert.equal(m.compras, '2026-03-01');
  });

  it('séries sem nenhuma de compras: o marco de compras é nulo, o de tarefas não', () => {
    const m = marcosDe({
      taskSeries: [{ createdOn: '2025-12-10', module: 'casa' }, { createdOn: '2026-01-02', module: 'financas' }],
    });
    assert.equal(m.tarefas, '2025-12-10');
    assert.equal(m.compras, null, 'compras que nunca foram registradas não têm marco');
  });

  it('só séries de compras: os dois marcos existem, e são o mesmo dia', () => {
    const m = marcosDe({ taskSeries: [{ createdOn: '2026-03-01', module: 'compras' }] });
    assert.equal(m.tarefas, '2026-03-01');
    assert.equal(m.compras, '2026-03-01');
  });

  it('`createdOn` ilegível é descartado — e se for o único, o marco é nulo', () => {
    // Descartar é o lado conservador: sobra um marco mais tarde, e marco mais
    // tarde nunca autoriza um zero que não existiu. Comparar como texto, não:
    // "10/12/2025" contra "2026-01-02" sai sempre maior, nunca certo.
    const comUmBom = marcosDe({
      taskSeries: [{ createdOn: '10/12/2025', module: 'casa' }, { createdOn: '2026-01-02', module: 'casa' }],
    });
    assert.equal(comUmBom.tarefas, '2026-01-02');

    const soIlegivel = marcosDe({ taskSeries: [{ createdOn: '2026-13-45', module: 'compras' }] });
    assert.equal(soIlegivel.tarefas, null);
    assert.equal(soIlegivel.compras, null);
  });
});

describe('os marcos da Retrospectiva — os dias com valor de passos e andares', () => {
  const dias = (mes: string, de: number, ate: number) =>
    Array.from({ length: ate - de + 1 }, (_, k) => `${mes}-${String(de + k).padStart(2, '0')}`);

  it('conta os dois lados: setembro e agosto, cada um o seu', () => {
    const m = marcosDe({
      stepsByDay: new Map([...dias('2026-09', 1, 12), ...dias('2026-08', 1, 31)].map((d) => [d, 8_000])),
      floorsByDay: new Map(dias('2026-08', 1, 4).map((d) => [d, 3])),
    });
    assert.deepEqual(m.passos, { atual: 12, anterior: 31 });
    assert.deepEqual(m.andares, { atual: 0, anterior: 4 });
  });

  it('dia gravado com 0 conta: foi medido, e a medida deu zero', () => {
    const m = marcosDe({ stepsByDay: new Map([['2026-09-03', 0]]) });
    assert.deepEqual(m.passos, { atual: 1, anterior: 0 });
  });

  it('sem mapa nenhum, os dois lados são 0 — e é isso que diz "sem relógio"', () => {
    const m = marcosDe();
    assert.deepEqual(m.passos, { atual: 0, anterior: 0 });
    assert.deepEqual(m.andares, { atual: 0, anterior: 0 });
  });

  it('dia de fora do período não conta de nenhum dos dois lados', () => {
    const m = marcosDe({ stepsByDay: new Map([['2026-10-01', 9_000], ['2026-07-31', 9_000]]) });
    assert.deepEqual(m.passos, { atual: 0, anterior: 0 });
  });

  it("em 'all' não há período anterior, e o lado anterior fica em 0", () => {
    const resumo = buildRetrospective({
      now: AGORA,
      kind: 'all',
      offset: 0,
      activities: [],
      health: [],
      habits: [],
      registros: [],
      tasks: [],
      purchases: [],
      stepsByDay: new Map(dias('2026-09', 1, 5).map((d) => [d, 8_000])),
    });
    assert.deepEqual(resumo.marcos?.passos, { atual: 5, anterior: 0 });
  });
});
