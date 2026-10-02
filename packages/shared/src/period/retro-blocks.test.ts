/**
 * A diagramação da Retrospectiva — e a seta que voltou em 02/10/2026.
 *
 * A Story 2.5 tirou as setas da tela de carona com o fim da "prova de gráfica", e o custo
 * ficou **declarado no cabeçalho de `retro-blocks.ts`**: um bloco criado depois dela entra
 * no fim da `order` já salva e fica lá para sempre. A `order` do dono tem 13 entradas e
 * ele lê as cinco primeiras — o bloco da Presença seria o 14º.
 *
 * Devolver a seta não contraria a 2.5: paga o custo que ela declarou e nunca cobriu.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  RETRO_BLOCKS,
  moveBlock,
  resolveRetroPrefs,
  toggleBlock,
  visibleBlocks,
  type RetroBlockId,
} from './retro-blocks';

const padrao = () => resolveRetroPrefs({});

describe('moveBlock', () => {
  it('sobe um bloco uma posição', () => {
    const p = padrao();
    const antes = p.order.indexOf('sleep');
    const depois = moveBlock(p, 'sleep', -1).order.indexOf('sleep');
    assert.equal(depois, antes - 1);
  });

  it('desce um bloco uma posição', () => {
    const p = padrao();
    const antes = p.order.indexOf('sleep');
    assert.equal(moveBlock(p, 'sleep', 1).order.indexOf('sleep'), antes + 1);
  });

  it('não move a manchete, que é fixa', () => {
    const p = padrao();
    assert.deepEqual(moveBlock(p, 'lede', 1).order, p.order);
  });

  it('não tira a manchete do topo trocando com ela', () => {
    const p = padrao();
    assert.equal(p.order[0], 'lede');
    const movido = moveBlock(p, p.order[1] as RetroBlockId, -1);
    assert.equal(movido.order[0], 'lede', 'o segundo não sobe por cima da manchete');
  });

  it('nas bordas devolve as prefs intactas, em vez de embaralhar as pontas', () => {
    const p = padrao();
    const ultimo = p.order[p.order.length - 1] as RetroBlockId;
    assert.deepEqual(moveBlock(p, ultimo, 1).order, p.order);
  });

  it('bloco que não está na ordem não move nada', () => {
    const p = { ...padrao(), order: ['lede', 'kpis'] as RetroBlockId[] };
    assert.deepEqual(moveBlock(p, 'sleep', -1).order, p.order);
  });

  it('mover preserva o conjunto: nada some, nada duplica', () => {
    const p = padrao();
    const movido = moveBlock(p, 'habits', -1);
    assert.deepEqual([...movido.order].sort(), [...p.order].sort());
  });

  it('não mexe no que está escondido', () => {
    const p = toggleBlock(padrao(), 'tasks', '2026-10-02');
    assert.deepEqual(moveBlock(p, 'sleep', -1).hidden, p.hidden);
  });
});

describe('o bloco da Presença', () => {
  it('existe no catálogo e vale para todas as recorrências', () => {
    const def = RETRO_BLOCKS.find((b) => b.id === 'presence');
    assert.ok(def, 'o catálogo tem o bloco');
    assert.equal(def!.kinds, undefined, 'sem `kinds`: semana, mês, trimestre, ano e total');
    assert.ok(!def!.fixed);
  });

  it('entra no fim de uma ordem salva antiga — e é por isso que a seta precisou voltar', () => {
    const antiga = { order: ['lede', 'kpis', 'sleep'], hidden: {} };
    const p = resolveRetroPrefs(antiga);
    assert.equal(p.order[p.order.length - 1], 'presence');
  });

  it('aparece em todas as recorrências', () => {
    const p = padrao();
    for (const kind of ['week', 'month', 'season', 'year', 'all'] as const) {
      assert.ok(
        visibleBlocks(p, kind).some((b) => b.id === 'presence'),
        `${kind} mostra o bloco`,
      );
    }
  });

  it('e some quando o leitor o esconde', () => {
    const p = toggleBlock(padrao(), 'presence', '2026-10-02');
    assert.ok(!visibleBlocks(p, 'month').some((b) => b.id === 'presence'));
  });
});
