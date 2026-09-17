import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { offsetDoInicio, periodBounds, type PeriodKind } from './bounds';

/**
 * `offsetDoInicio` — o inverso de `periodBounds`, que a rota da revista usa para
 * sair do endereço (`/revista/mes/2026-08-01`) e chegar à mesma entrada que a
 * Retrospectiva monta (Story 1.11).
 *
 * **Relógios por componentes locais**, nunca por string com fuso: o dia que a
 * função lê é o da parede de quem roda, e este repositório já teve CI vermelho
 * por data de teste que mudava de dia conforme o `TZ`. (Mês é base zero.)
 */

/** Quinta, 17 de setembro de 2026, 10h. */
const AGORA = new Date(2026, 8, 17, 10, 0, 0);

const iso = (d: Date): string => {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

describe('offsetDoInicio — o mês', () => {
  it('o anterior, o corrente, o seguinte e um de outro ano', () => {
    assert.equal(offsetDoInicio(AGORA, 'month', '2026-08-01'), -1);
    assert.equal(offsetDoInicio(AGORA, 'month', '2026-09-01'), 0);
    assert.equal(offsetDoInicio(AGORA, 'month', '2026-10-01'), 1);
    assert.equal(offsetDoInicio(AGORA, 'month', '2025-12-01'), -9);
  });

  it('um dia que não é o primeiro não é início de mês', () => {
    assert.equal(offsetDoInicio(AGORA, 'month', '2026-08-02'), null);
    assert.equal(offsetDoInicio(AGORA, 'month', '2026-08-31'), null);
  });
});

describe('offsetDoInicio — a estação (trimestre civil)', () => {
  it('Q2, Q3 e o Q4 do ano anterior', () => {
    assert.equal(offsetDoInicio(AGORA, 'season', '2026-04-01'), -1);
    assert.equal(offsetDoInicio(AGORA, 'season', '2026-07-01'), 0);
    assert.equal(offsetDoInicio(AGORA, 'season', '2025-10-01'), -3);
  });

  it('o primeiro dia de um mês do meio do trimestre não é início de estação', () => {
    assert.equal(offsetDoInicio(AGORA, 'season', '2026-05-01'), null);
    assert.equal(offsetDoInicio(AGORA, 'season', '2026-08-01'), null);
    assert.equal(offsetDoInicio(AGORA, 'season', '2026-04-02'), null);
  });
});

describe('offsetDoInicio — o ano', () => {
  it('o anterior e o corrente', () => {
    assert.equal(offsetDoInicio(AGORA, 'year', '2025-01-01'), -1);
    assert.equal(offsetDoInicio(AGORA, 'year', '2026-01-01'), 0);
  });

  it('fora do 1º de janeiro, não', () => {
    assert.equal(offsetDoInicio(AGORA, 'year', '2025-02-01'), null);
    assert.equal(offsetDoInicio(AGORA, 'year', '2025-01-02'), null);
  });
});

describe('offsetDoInicio — a semana', () => {
  it('a segunda-feira da semana anterior e a da corrente', () => {
    assert.equal(offsetDoInicio(AGORA, 'week', '2026-09-07'), -1);
    assert.equal(offsetDoInicio(AGORA, 'week', '2026-09-14'), 0);
  });

  it('outro dia da semana não é início', () => {
    assert.equal(offsetDoInicio(AGORA, 'week', '2026-09-08'), null);
    assert.equal(offsetDoInicio(AGORA, 'week', '2026-09-13'), null);
  });

  /**
   * **Num fuso com horário de verão, e não no do processo.** O CI roda em UTC, onde
   * nenhuma semana tem 23 nem 25 horas — um caso que dependesse do `TZ` do processo
   * passaria lá sem nunca atravessar a troca. O Node aplica a mudança de
   * `process.env.TZ` em tempo de execução; o fuso volta ao que era no fim, e os
   * relógios são montados **depois** da troca, para os componentes locais serem os
   * de Bruxelas.
   *
   * O que ele protege: a conta de semanas por dias de calendário (componentes em
   * UTC). Pela diferença de milissegundos locais, a semana da troca de março tem
   * uma hora a menos, e 13,96 dias arredondados para baixo não são duas semanas.
   */
  it('atravessa a troca de horário de verão sem errar a conta de dias (em Europe/Brussels)', () => {
    const tzAntes = process.env.TZ;
    process.env.TZ = 'Europe/Brussels';
    try {
      // A troca aconteceu mesmo: o deslocamento de março e o de abril diferem.
      assert.notEqual(new Date(2026, 2, 23).getTimezoneOffset(), new Date(2026, 3, 9).getTimezoneOffset());
      // Quinta, 5/11/2026: o fim do horário de verão europeu (25/10) fica no meio.
      const novembro = new Date(2026, 10, 5, 10, 0, 0);
      assert.equal(offsetDoInicio(novembro, 'week', '2026-10-19'), -2);
      // E o início dele (29/03/2026), a partir de abril.
      const abril = new Date(2026, 3, 9, 10, 0, 0);
      assert.equal(offsetDoInicio(abril, 'week', '2026-03-23'), -2);
    } finally {
      if (tzAntes === undefined) delete process.env.TZ;
      else process.env.TZ = tzAntes;
    }
  });

  it('atravessa a virada do ano', () => {
    assert.equal(offsetDoInicio(new Date(2027, 0, 6, 10, 0, 0), 'week', '2026-12-28'), -1);
  });
});

describe('offsetDoInicio — o que não é endereço de período', () => {
  it("'all' não tem início que o localize", () => {
    assert.equal(offsetDoInicio(AGORA, 'all', '2000-01-01'), null);
  });

  it('data que não existe, ou fora do formato', () => {
    for (const s of ['2026-02-30', '2026-13-01', '2026-00-01', '2026-8-01', '26-08-01', 'agosto', '', '2026-08-01T00:00:00']) {
      assert.equal(offsetDoInicio(AGORA, 'month', s), null, JSON.stringify(s));
    }
  });

  /**
   * `new Date(99, 0, 1)` é 1999. Sem o cuidado, `0099-01-01` viraria o offset de
   * 1999 (−27) e a rota abriria outro ano. No tipo `year`, `periodBounds` também
   * cai nessa armadilha e não sabe representar o ano 99 — a última palavra é dele,
   * e não é endereço. No mês ele sabe (o ano entra inteiro e o mês é que desloca),
   * e o offset é o do ano 99 de verdade, nunca o de 1999.
   */
  it('ano com zeros à frente não vira 19xx', () => {
    assert.equal(offsetDoInicio(AGORA, 'year', '0099-01-01'), null);
    assert.equal(offsetDoInicio(AGORA, 'month', '0099-08-01'), (99 - 2026) * 12 + (7 - 8));
  });
});

describe('offsetDoInicio — ida e volta com periodBounds', () => {
  /**
   * A propriedade inteira: para todo tipo e todo offset, o início que
   * `periodBounds` devolve volta ao mesmo offset. É a garantia de que a rota e a
   * Retrospectiva falam do mesmo período.
   */
  it('periodBounds(now, kind, o).start → o, em quatro relógios', () => {
    const relogios = [
      AGORA,
      new Date(2026, 0, 1, 0, 30, 0),   // primeiro minuto do ano
      new Date(2026, 2, 29, 12, 0, 0),  // domingo da troca de horário
      new Date(2024, 1, 29, 23, 0, 0),  // 29 de fevereiro
    ];
    const tipos: PeriodKind[] = ['week', 'month', 'season', 'year'];
    for (const now of relogios) {
      for (const kind of tipos) {
        for (let o = -60; o <= 3; o += 1) {
          const inicio = iso(periodBounds(now, kind, o).start);
          const volta = offsetDoInicio(now, kind, inicio);
          assert.ok(Object.is(volta, o), `${iso(now)} ${kind} ${o}: ${inicio} voltou como ${String(volta)}`);
        }
      }
    }
  });
});
