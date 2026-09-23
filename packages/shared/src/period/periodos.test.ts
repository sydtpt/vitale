/**
 * A enumeração dos períodos fechados do arquivo (Story 2.3).
 *
 * É a lista que a impressão em massa percorre, e cada linha dela custa até
 * quatro chamadas pagas: um período a mais ou a menos aqui é dinheiro, e um
 * período **em curso** enumerado seria uma edição congelada sobre meio mês.
 *
 * O relógio é sempre dado em **componentes locais**, nunca um instante: o mês
 * que fechou não pode depender do `TZ` de quem roda a suíte (o CI roda em UTC).
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { periodosFechadosDesde, TIPOS_EM_MASSA, isTipoEmMassa, type PeriodoFechado } from './periodos';

/** O começo do arquivo do dono: o primeiro dia com registro. */
const DESDE = '2023-05-22';

/** 23 de setembro de 2026, meio-dia local — o dia em que a story foi escrita. */
const AGORA = new Date(2026, 8, 23, 12, 0, 0);

const chave = (p: PeriodoFechado): string => `${p.tipo} ${p.inicio}`;
const doTipo = (ps: readonly PeriodoFechado[], t: string) => ps.filter((p) => p.tipo === t);

describe('periodosFechadosDesde — o que entra', () => {
  const ps = periodosFechadosDesde(DESDE, AGORA);

  it('o primeiro mês depois de 22/05/2023 é junho: maio começou antes e fica inteiro de fora', () => {
    const meses = doTipo(ps, 'month');
    assert.equal(meses[0]?.inicio, '2023-06-01');
    assert.equal(meses[0]?.fim, '2023-06-30');
    assert.equal(meses[0]?.rotulo, 'Junho 2023');
    assert.ok(!ps.some((p) => p.inicio === '2023-05-01'), 'maio de 2023 entrou');
  });

  it('o primeiro trimestre é o Q3 de 2023: o Q2 começa em abril, antes do arquivo', () => {
    const trimestres = doTipo(ps, 'season');
    assert.equal(trimestres[0]?.inicio, '2023-07-01');
    assert.equal(trimestres[0]?.fim, '2023-09-30');
    assert.equal(trimestres[0]?.rotulo, 'Q3 2023');
    assert.ok(!ps.some((p) => p.tipo === 'season' && p.inicio === '2023-04-01'), 'o Q2 de 2023 entrou');
  });

  it('o primeiro ano é 2024: 2023 começou em janeiro, antes do arquivo — e ele NÃO é enumerado', () => {
    const anos = doTipo(ps, 'year');
    assert.deepEqual(anos.map((p) => p.inicio), ['2024-01-01', '2025-01-01']);
    assert.ok(!ps.some((p) => p.tipo === 'year' && p.inicio === '2023-01-01'), '2023 entrou');
  });

  it('o período em CURSO fica de fora — mês, trimestre e ano', () => {
    // 23/09/2026: setembro, o Q3 e 2026 ainda não fecharam.
    for (const dentro of ['month 2026-09-01', 'season 2026-07-01', 'year 2026-01-01']) {
      assert.ok(!ps.some((p) => chave(p) === dentro), `${dentro} entrou, e ainda não fechou`);
    }
    // E os últimos fechados de cada tipo são os imediatamente anteriores.
    assert.equal(doTipo(ps, 'month').at(-1)?.inicio, '2026-08-01');
    assert.equal(doTipo(ps, 'season').at(-1)?.inicio, '2026-04-01');
    assert.equal(doTipo(ps, 'year').at(-1)?.inicio, '2025-01-01');
  });

  it('semana nunca entra, e o tipo o diz antes de qualquer laço', () => {
    assert.deepEqual([...TIPOS_EM_MASSA], ['month', 'season', 'year']);
    assert.equal(isTipoEmMassa('week'), false);
    assert.equal(isTipoEmMassa('all'), false);
    assert.equal(isTipoEmMassa('month'), true);
    assert.ok(!ps.some((p) => (p.tipo as string) === 'week'));
  });

  it('a contagem contra a data de hoje: 39 meses, 12 trimestres e 2 anos — 53', () => {
    assert.equal(doTipo(ps, 'month').length, 39);
    assert.equal(doTipo(ps, 'season').length, 12);
    assert.equal(doTipo(ps, 'year').length, 2);
    assert.equal(ps.length, 53);
  });

  it('cada período carrega o offset que o reencontra, e o fim é o último dia', () => {
    for (const p of ps) {
      assert.match(p.inicio, /^\d{4}-\d{2}-\d{2}$/, chave(p));
      assert.match(p.fim, /^\d{4}-\d{2}-\d{2}$/, chave(p));
      assert.ok(p.fim >= p.inicio, chave(p));
      assert.ok(Number.isInteger(p.offset) && p.offset < 0, `${chave(p)} tem offset ${p.offset}`);
    }
    const agosto = ps.find((p) => chave(p) === 'month 2026-08-01');
    assert.equal(agosto?.offset, -1);
    assert.equal(agosto?.fim, '2026-08-31');
    const q4 = ps.find((p) => chave(p) === 'season 2025-10-01');
    assert.equal(q4?.fim, '2025-12-31');
    const ano = ps.find((p) => chave(p) === 'year 2024-01-01');
    assert.equal(ano?.fim, '2024-12-31');
    assert.equal(ano?.offset, -2);
  });
});

describe('periodosFechadosDesde — a ordem', () => {
  const ps = periodosFechadosDesde(DESDE, AGORA);

  it('é cronológica pelo FIM, e o mais curto vem primeiro no empate', () => {
    for (let k = 1; k < ps.length; k += 1) {
      assert.ok(ps[k - 1]!.fim <= ps[k]!.fim, `${chave(ps[k - 1]!)} veio antes de ${chave(ps[k]!)}`);
    }
    // 31/12/2024 fecha os três de uma vez: o mês, o trimestre e o ano, nessa ordem.
    const naVirada = ps.filter((p) => p.fim === '2024-12-31').map(chave);
    assert.deepEqual(naVirada, ['month 2024-12-01', 'season 2024-10-01', 'year 2024-01-01']);
  });

  it('o primeiro da lista é junho de 2023, e o último é agosto de 2026', () => {
    assert.equal(chave(ps[0]!), 'month 2023-06-01');
    assert.equal(chave(ps.at(-1)!), 'month 2026-08-01');
  });
});

describe('periodosFechadosDesde — as bordas', () => {
  it('um começo que não é data recusa alto, em vez de enumerar desde o ano 2000', () => {
    for (const ruim of ['2023-5-22', '2023-05', '22/05/2023', '', 'ontem']) {
      assert.throws(() => periodosFechadosDesde(ruim, AGORA), RangeError, ruim);
    }
  });

  it('um começo no futuro devolve lista vazia — e não um laço sem fim', () => {
    assert.deepEqual(periodosFechadosDesde('2027-01-01', AGORA), []);
  });

  it('o dia 1º é o limite: um período que começa NO `desde` entra', () => {
    // Com o arquivo começando em 1º de junho de 2023, junho entra pela igualdade.
    const ps = periodosFechadosDesde('2023-06-01', AGORA);
    assert.equal(ps[0]?.inicio, '2023-06-01');
    // Um dia depois, junho sai e julho vira o primeiro.
    const depois = periodosFechadosDesde('2023-06-02', AGORA);
    assert.equal(depois[0]?.inicio, '2023-07-01');
  });

  it('no primeiro dia de um mês, o mês anterior já fechou e entra', () => {
    // 1º de julho de 2023, 00:30 local: junho fechou na véspera.
    const ps = periodosFechadosDesde(DESDE, new Date(2023, 6, 1, 0, 30));
    assert.deepEqual(ps.map(chave), ['month 2023-06-01']);
  });
});
