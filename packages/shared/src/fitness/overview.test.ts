/**
 * O portão da unificação do `buildOverview`.
 *
 * Este arquivo nasceu para uma mudança específica: em 27/08/2026 a função vivia
 * duplicada na web e no mobile, 98,5% idêntica, e foi movida para cá. Mover
 * agregação é o tipo de refactor que "compila e parece certo" enquanto muda um
 * total em silêncio — ninguém confere 13 barras × 4 métricas × 5 períodos a olho.
 *
 * Então o comportamento antigo foi **congelado antes de mover**: o fixture em
 * `__fixtures__/overview-golden.json` foi gerado rodando a implementação do
 * mobile, intocada, sobre o dataset determinístico abaixo. Se a versão movida
 * divergir em qualquer célula, o teste aponta o cenário e o campo.
 *
 * O fixture guarda um **digest**, não a saída inteira: os segmentos repetiam
 * rótulo e cor em cada bucket e inflavam o arquivo a ~96 KB sem detectar nada a
 * mais. Cor e rótulo agora vêm do `metaOf` injetado — não é o núcleo que os
 * decide. O núcleo decide quais buckets, com que total, em que ordem, quantas
 * séries dentro, quanto de esforço, e as metas. É isso que está congelado.
 *
 * `previous` ficou de fora do fixture de propósito: é comportamento **novo**,
 * que não existia na versão congelada, e tem seus próprios casos mais abaixo.
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  buildOverview,
  earliestActivityYear,
  overviewYears,
  totalsDelta,
  type ActivityMetaLookup,
  type Metric,
  type Period,
} from './overview';
import type { Activity } from '../models';

let passed = 0;
function check(name: string, fn: () => void): void {
  fn();
  passed += 1;
  console.log(`  ok ${name}`);
}

// ── o mesmo dataset que gerou o fixture ─────────────────────────────────────
// Qualquer mudança aqui invalida o congelamento: regerar o fixture contra a
// implementação NOVA seria congelar o bug, não detectá-lo.

const NOW = new Date('2026-08-20T14:30:00.000Z');
/** Ids reais do HealthKit: 37 corrida, 13 ciclismo, 50 musculação, 52 caminhada. */
const TYPES = [37, 13, 50, 52];

function act(i: number, daysAgo: number, activityId: number): Activity {
  const start = new Date(NOW.getTime() - daysAgo * 86_400_000 - i * 3_600_000);
  const durationS = 1800 + ((i * 7) % 11) * 600;
  return {
    id: `a${i}`,
    userId: 'u',
    activityId,
    calories: 200 + ((i * 13) % 17) * 25,
    startAt: start.toISOString(),
    endAt: new Date(start.getTime() + durationS * 1000).toISOString(),
    durationS,
    distanceM: activityId === 50 ? undefined : 3000 + ((i * 11) % 9) * 1500,
    hasRoute: activityId !== 50,
  };
}

const ACTIVITIES: Activity[] = Array.from({ length: 160 }, (_, i) =>
  act(i, Math.floor((i * 6.9) % 1000), TYPES[i % TYPES.length]),
);

/** O adaptador que o fixture usou: os rótulos vêm do núcleo nas duas plataformas. */
const LABELS: Record<number, string> = {
  37: 'Corrida', 13: 'Ciclismo', 50: 'Musculação', 52: 'Caminhada',
};
const COLORS: Record<number, string> = {
  37: '#F25C2B', 13: '#6E8CC9', 50: '#B4825B', 52: '#6FA86A',
};
const metaOf: ActivityMetaLookup = (id) => ({
  label: LABELS[id] ?? 'Treino',
  color: COLORS[id] ?? '#B4825B',
});

/**
 * O fixture nasceu de um `JSON.stringify`, que **apaga** chaves com `undefined`
 * — `currentTargetS` ausente num ano fechado é exatamente esse caso. Comparar o
 * objeto vivo contra ele acusaria diferença onde não há: `{a: undefined}` e
 * `{}` não são iguais para o `deepEqual` estrito. A ida e volta por JSON põe os
 * dois lados na mesma forma.
 */
function asJson<T>(v: T): T {
  return JSON.parse(JSON.stringify(v));
}

function digest(o: ReturnType<typeof buildOverview>) {
  return {
    granularity: o.granularity,
    totals: o.totals,
    currentTargetS: o.currentTargetS,
    targetS: o.targetS,
    effortAvgS: o.effortAvgS,
    effortTotalS: o.effortTotalS,
    legend: o.legend.map((l) => l.label),
    buckets: o.buckets.map((b) => [
      b.key,
      b.label,
      b.total,
      b.segments.map((s) => `${s.label}:${s.value}`).join('|'),
      b.effectiveS ?? null,
      b.comparison ? 'cmp' : b.emphasis ? 'emp' : '',
    ]),
  };
}

const GOLDEN: Record<string, ReturnType<typeof digest>> = JSON.parse(
  readFileSync(join(import.meta.dirname, '__fixtures__', 'overview-golden.json'), 'utf8'),
);

const PERIODS: Period[] = ['semana', 'mes', 'meses12', 'ano', 'sempre'];
const METRICS: Metric[] = ['distance', 'duration', 'calories', 'count'];

check('BARREIRA — os 20 cenários período × métrica batem com o congelado', () => {
  const diverged: string[] = [];
  for (const p of PERIODS) {
    for (const m of METRICS) {
      const key = `${p}/${m}`;
      const got = asJson(digest(buildOverview(ACTIVITIES, p, m, { metaOf, now: NOW })));
      try {
        assert.deepEqual(got, GOLDEN[key]);
      } catch {
        // Aponta o primeiro campo divergente em vez de despejar dois objetos.
        const campo = (Object.keys(got) as (keyof typeof got)[]).find(
          (k) => JSON.stringify(got[k]) !== JSON.stringify(GOLDEN[key][k]),
        );
        diverged.push(
          `${key} → campo '${String(campo)}'\n      esperado ${JSON.stringify(GOLDEN[key][campo!]).slice(0, 200)}\n      obtido   ${JSON.stringify(got[campo!]).slice(0, 200)}`,
        );
      }
    }
  }
  assert.deepEqual(
    diverged,
    [],
    `a agregação mudou ao ser movida para o núcleo:\n    ${diverged.join('\n    ')}\n` +
      `  O fixture é a implementação de antes da mudança. Se a diferença for intencional,\n` +
      `  regere o fixture DE PROPÓSITO e diga por quê no commit.`,
  );
});

check('BARREIRA — os casos de borda da UI batem com o congelado', () => {
  const casos: [string, ReturnType<typeof buildOverview>][] = [
    ['semana/duration/oculto-corrida',
      buildOverview(ACTIVITIES, 'semana', 'duration', { metaOf, now: NOW, hidden: new Set(['Corrida']) })],
    ['ano/count/offset-1',
      buildOverview(ACTIVITIES, 'ano', 'count', { metaOf, now: NOW, weeklyTargetMin: 150, yearOffset: -1 })],
    ['sempre/distance/2025-oculto',
      buildOverview(ACTIVITIES, 'sempre', 'distance', { metaOf, now: NOW, weeklyTargetMin: 150, hiddenYears: new Set(['2025']) })],
    ['vazio',
      buildOverview([], 'meses12', 'duration', { metaOf, now: NOW })],
  ];
  for (const [key, o] of casos) {
    assert.deepEqual(asJson(digest(o)), GOLDEN[key], `caso '${key}' divergiu do congelado`);
  }
});

// ── comportamento novo: a janela anterior ───────────────────────────────────

check('previous — "sempre" não tem janela anterior', () => {
  const o = buildOverview(ACTIVITIES, 'sempre', 'count', { metaOf, now: NOW });
  assert.equal(o.previous, undefined, 'não existe um "antes de todo o histórico"');
});

check('previous — a janela anterior tem o mesmo tamanho e não se sobrepõe', () => {
  // A soma das duas janelas de 7 dias tem de bater com uma leitura de 14 dias
  // feita a partir de hoje. Se a anterior se sobrepusesse, sobraria contagem.
  const atual = buildOverview(ACTIVITIES, 'semana', 'count', { metaOf, now: NOW });
  const anterior = atual.previous;
  assert.ok(anterior, 'semana tem janela anterior');

  const catorzeDias = ACTIVITIES.filter((a) => {
    const d = new Date(a.startAt).getTime();
    const fim = new Date(NOW.getFullYear(), NOW.getMonth(), NOW.getDate() + 1).getTime();
    return d >= fim - 14 * 86_400_000 && d < fim;
  }).length;

  assert.equal(
    atual.totals.count + anterior.count,
    catorzeDias,
    'as duas janelas de 7 dias deveriam cobrir exatamente 14 dias, sem sobra nem buraco',
  );
});

check('previous — não conta a barra de comparação de "12 meses"', () => {
  // A barra `comparison` é o mesmo mês do ano passado e vive DENTRO da janela
  // anterior. Se ela vazasse para os totais de `previous`, o mês apareceria duas
  // vezes — foi o risco que o review anotou.
  const o = buildOverview(ACTIVITIES, 'meses12', 'count', { metaOf, now: NOW });
  assert.ok(o.previous, '12 meses tem janela anterior');

  const cmp = o.buckets.find((b) => b.comparison);
  assert.ok(cmp, 'o cenário precisa ter barra de comparação para o teste valer');

  // A janela anterior é ela mesma um período de 12 meses; seu próprio bucket de
  // comparação também não pode somar. Conferimos contra a contagem crua.
  const dozeMesesAntes = new Date(NOW.getFullYear() - 1, NOW.getMonth(), NOW.getDate(), NOW.getHours(), NOW.getMinutes());
  const cru = buildOverview(ACTIVITIES, 'meses12', 'count', { metaOf, now: dozeMesesAntes });
  assert.deepEqual(o.previous, cru.totals, 'previous deve ser exatamente os totais da janela deslocada');
});

check('previous — respeita os tipos desligados na legenda', () => {
  const todos = buildOverview(ACTIVITIES, 'semana', 'count', { metaOf, now: NOW });
  const semCorrida = buildOverview(ACTIVITIES, 'semana', 'count', {
    metaOf, now: NOW, hidden: new Set(['Corrida']),
  });
  assert.ok(todos.previous && semCorrida.previous);
  assert.ok(
    semCorrida.previous.count <= todos.previous.count,
    'esconder um tipo não pode aumentar a contagem da janela anterior',
  );
});

check('totalsDelta — sem base não inventa percentual', () => {
  assert.equal(totalsDelta(10, undefined), null, 'sem janela anterior → sem seta');
  assert.equal(totalsDelta(10, 0), null, 'crescer a partir de zero não é "↑ ∞" nem "↑ 100%"');
  assert.equal(totalsDelta(0, 0), null);
});

check('totalsDelta — arredonda em pontos percentuais, nos dois sentidos', () => {
  assert.equal(totalsDelta(112, 100), 12);
  assert.equal(totalsDelta(88, 100), -12);
  assert.equal(totalsDelta(100, 100), 0);
  assert.equal(totalsDelta(1, 3), -67);
});

// ── helpers de navegação ────────────────────────────────────────────────────

check('earliestActivityYear e overviewYears cobrem os buracos do meio', () => {
  const esparso: Activity[] = [
    act(0, 0, 37),           // 2026
    act(1, 900, 13),         // ~2024
  ];
  const anos = overviewYears(esparso);
  assert.equal(earliestActivityYear(esparso), anos[0]);
  assert.equal(anos[anos.length - 1], 2026);
  // Sem dado em 2025, mas o ano existe na régua: some do gráfico e some do
  // seletor seriam coisas diferentes.
  assert.ok(anos.includes(2025), 'anos vazios no meio continuam na lista');
  assert.deepEqual(earliestActivityYear([]), undefined);
  assert.deepEqual(overviewYears([]), []);
});

console.log(`\n${passed} testes passaram.`);
