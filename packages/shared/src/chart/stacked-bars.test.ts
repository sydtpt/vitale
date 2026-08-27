/**
 * O modelo do gráfico empilhado, contra a geometria congelada.
 *
 * `__fixtures__/stacked-bars-golden.json` foi gerado a partir das **duas cópias
 * originais**, antes de qualquer linha sair delas: uma transcrição fiel da parte
 * pura do `StackedBarChart.tsx` do mobile e das `computed()` do
 * `stacked-bar-chart.component.ts` da web. Doze cenários, cada um com a
 * geometria dos dois lados.
 *
 * É por isto que este arquivo existe: uma unificação de gráfico não se confere a
 * olho, e "parece igual" num print não é evidência. Se alguém mexer no modelo e
 * a barra sair um pixel fora do lugar, quebra aqui.
 *
 * Fica de fora do congelado, de propósito, o que **mudou por decisão**: os
 * rótulos, que passaram a ser pt-BR nas duas plataformas, têm testes próprios
 * mais abaixo.
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  buildStackedBars,
  formatAxisLabel,
  formatCompactLabel,
  formatMetricShort,
  interpolateStackedBars,
  isHexColor,
  stackedGradientId,
  stackedGradientStops,
  topRoundedRectPath,
  type StackedBar,
  type StackedBarsGeometry,
  type StackedBucket,
  type StackedMetric,
} from './stacked-bars';

let passed = 0;
function check(name: string, fn: () => void): void {
  fn();
  passed += 1;
  console.log(`  ok ${name}`);
}

/** A geometria que o mobile desenhava. */
const MOBILE: Omit<StackedBarsGeometry, 'width' | 'height'> = {
  padTop: 16,
  padRight: 0,
  padBottom: 22,
  padLeft: 36,
  minSlot: 44,
  topRadius: 7,
  maxBarWidth: { normal: 42, emphasis: 52, comparison: 26 },
};

/** A geometria que a web desenhava. */
const WEB: StackedBarsGeometry = {
  width: 600,
  height: 240,
  padTop: 18,
  padRight: 14,
  padBottom: 28,
  padLeft: 40,
  minSlot: 0,
  topRadius: 6,
  maxBarWidth: { normal: 42, emphasis: 56, comparison: 30 },
};

interface Caso {
  nome: string;
  buckets: StackedBucket[];
  metric: StackedMetric;
  width: number;
  height: number;
  noScroll: boolean;
  goal?: number;
  showEffort: boolean;
  effortFlat?: number;
  currentGoal?: number;
}

/**
 * Os cenários do congelado, redeclarados aqui.
 *
 * Duplicar os dados de entrada é de propósito: o fixture guarda a **saída**, e
 * gerar a entrada a partir dele deixaria os dois lados do teste concordando por
 * construção.
 */
function seg(label: string, value: number, color: string) {
  return { label, value, color };
}
function bucket(
  key: string,
  label: string,
  segs: { label: string; value: number; color: string }[],
  extra: Partial<StackedBucket> = {},
): StackedBucket {
  return { key, label, segments: segs, total: segs.reduce((s, x) => s + x.value, 0), ...extra };
}

const SIMPLES = [
  bucket('w1', '01/06', [seg('Corrida', 7200, '#F25C2B'), seg('Yoga', 1800, '#6FA86A')], { effectiveS: 5400 }),
  bucket('w2', '08/06', [seg('Corrida', 3600, '#F25C2B')], { effectiveS: 3000 }),
  bucket('w3', '15/06', [], { effectiveS: 0 }),
  bucket('w4', '22/06', [seg('Corrida', 10800, '#F25C2B'), seg('Ciclismo', 5400, '#6E8CC9')], { effectiveS: 9000 }),
];
const COM_COMPARACAO = [
  ...SIMPLES,
  bucket('cmp', '2025', [seg('Corrida', 5000, '#F25C2B')], { comparison: true }),
];
const COM_DESTAQUE = [
  bucket('m1', 'jan', [seg('Corrida', 36000, '#F25C2B')], { effectiveS: 30000 }),
  bucket('m2', 'fev', [seg('Corrida', 21600, '#F25C2B')], { effectiveS: 18000, emphasis: true }),
  bucket('m3', 'mar', [seg('Yoga', 7200, '#6FA86A')], { effectiveS: 3600 }),
];
const DOZE = Array.from({ length: 12 }, (_, i) =>
  bucket(`d${i}`, `${i + 1}`, [seg('Corrida', 1800 * (i + 1), '#F25C2B')], { effectiveS: 1500 * (i + 1) }),
);
const VAZIO = [bucket('z1', 'seg', []), bucket('z2', 'ter', [])];

const CASOS: Caso[] = [
  { nome: 'duração simples', buckets: SIMPLES, metric: 'duration', width: 340, height: 200, noScroll: true, showEffort: false },
  { nome: 'duração com meta e esforço', buckets: SIMPLES, metric: 'duration', width: 340, height: 200, noScroll: true, goal: 5700, showEffort: true, effortFlat: 4200 },
  { nome: 'meta com degrau no bucket em curso', buckets: SIMPLES, metric: 'duration', width: 340, height: 200, noScroll: true, goal: 5700, currentGoal: 2400, showEffort: true },
  { nome: 'degrau com barra de comparação depois', buckets: COM_COMPARACAO, metric: 'duration', width: 340, height: 200, noScroll: true, goal: 5700, currentGoal: 2400, showEffort: true },
  { nome: 'destaque no mês corrente', buckets: COM_DESTAQUE, metric: 'duration', width: 340, height: 200, noScroll: true, showEffort: true },
  { nome: 'distância', buckets: SIMPLES, metric: 'distance', width: 340, height: 200, noScroll: true, showEffort: false },
  { nome: 'calorias (eixo inteiro)', buckets: SIMPLES, metric: 'calories', width: 340, height: 200, noScroll: true, showEffort: false },
  { nome: 'contagem (eixo inteiro)', buckets: SIMPLES, metric: 'count', width: 340, height: 200, noScroll: true, showEffort: false },
  { nome: 'vazio cai no piso do eixo', buckets: VAZIO, metric: 'duration', width: 340, height: 200, noScroll: true, showEffort: false },
  { nome: 'doze buckets com rolagem', buckets: DOZE, metric: 'duration', width: 340, height: 200, noScroll: false, showEffort: true },
  { nome: 'doze buckets sem rolagem', buckets: DOZE, metric: 'duration', width: 340, height: 200, noScroll: true, showEffort: true },
  { nome: 'meta acima da maior barra', buckets: SIMPLES, metric: 'duration', width: 340, height: 200, noScroll: true, goal: 72000, showEffort: false },
];

const GOLDEN = JSON.parse(
  readFileSync(join(__dirname, '__fixtures__', 'stacked-bars-golden.json'), 'utf8'),
) as {
  nome: string;
  mobile: Record<string, unknown>;
  web: Record<string, unknown>;
}[];

/**
 * Arredonda todo número da estrutura a seis casas.
 *
 * O congelado veio de expressões escritas em outra ordem (`center − barW/2` de
 * um lado, `x0 + (slot − barW)/2` do outro). São o mesmo ponto; podem diferir no
 * último bit do double. Um milionésimo de unidade de SVG não é uma mudança de
 * comportamento — e uma mudança de verdade não se esconde nessa casa.
 */
function round(v: unknown): unknown {
  if (typeof v === 'number') return Math.round(v * 1e6) / 1e6;
  // Os `path` carregam coordenadas dentro da string; a mesma regra vale para elas.
  if (typeof v === 'string') {
    return v.replace(/-?\d+\.\d+/g, (n) => String(Math.round(Number(n) * 1e6) / 1e6));
  }
  if (Array.isArray(v)) return v.map(round);
  if (v && typeof v === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, val] of Object.entries(v as Record<string, unknown>)) out[k] = round(val);
    return out;
  }
  return v;
}

for (const caso of CASOS) {
  const golden = GOLDEN.find((g) => g.nome === caso.nome);
  assert.ok(golden, `cenário "${caso.nome}" não está no congelado`);

  check(`mobile — ${caso.nome}`, () => {
    const m = buildStackedBars({
      buckets: caso.buckets,
      metric: caso.metric,
      geometry: { ...MOBILE, width: caso.width, height: caso.height, minSlot: caso.noScroll ? 0 : 44 },
      goal: caso.goal,
      currentGoal: caso.currentGoal,
      showEffort: caso.showEffort,
      effortFlat: caso.effortFlat,
    });
    assert.deepEqual(
      round({
        chartW: m.chartW,
        baseY: m.baseY,
        maxV: m.maxV,
        layout: m.bars.map((b) => ({ x0: b.x0, slot: b.slot, center: b.cx })),
        grid: m.grid,
        bars: m.bars.map((b) => ({
          key: b.key, label: b.label, center: b.cx, barW: b.barW, x: b.x,
          comparison: b.comparison, total: b.total, topY: b.topY,
          segs: b.segs, effY: b.effY, effS: b.effS,
        })),
        goalPath: m.goalPath,
        goalY: m.goalY,
        effortFlatY: m.effortFlatY,
      }),
      round(golden!.mobile),
    );
  });

  check(`web — ${caso.nome}`, () => {
    const m = buildStackedBars({
      buckets: caso.buckets,
      metric: caso.metric,
      geometry: WEB,
      goal: caso.goal,
      currentGoal: caso.currentGoal,
      showEffort: caso.showEffort,
      effortFlat: caso.effortFlat,
    });
    assert.deepEqual(
      round({
        chartW: m.chartW,
        baseY: m.baseY,
        maxV: m.maxV,
        grid: m.grid,
        bars: m.bars.map((b) => ({
          key: b.key, label: b.label, cx: b.cx, segs: b.segs, topY: b.topY,
          total: b.total, faded: b.comparison, effY: b.effY, effS: b.effS,
          x0: b.x0, slotW: b.slot,
        })),
        goalLine: m.goalPath === '' ? null : { d: m.goalPath, y: m.goalY },
        effortFlatY: m.effortFlatY,
      }),
      round(golden!.web),
    );
  });
}

// ─────────────────── invariantes que o congelado não nomeia ───────────────────

const G: StackedBarsGeometry = { ...MOBILE, width: 340, height: 200, minSlot: 0 };

check('sem rolagem, a largura do desenho é exatamente a pedida', () => {
  // Sem isto, `chartW` sai um bilionésimo acima de `width` e o mobile liga a
  // rolagem horizontal num gráfico que cabia na tela.
  for (const n of [1, 3, 5, 7, 11, 12]) {
    const bs = Array.from({ length: n }, (_, i) => bucket(`b${i}`, `${i}`, [seg('x', 60, '#000')]));
    const m = buildStackedBars({ buckets: bs, metric: 'duration', geometry: G });
    assert.equal(m.chartW, 340, `${n} buckets`);
  }
});

check('com rolagem, o slot nunca fica abaixo do mínimo', () => {
  const m = buildStackedBars({
    buckets: DOZE,
    metric: 'duration',
    geometry: { ...MOBILE, width: 340, height: 200, minSlot: 44 },
  });
  assert.ok(m.bars.every((b) => b.slot >= 44 - 1e-9));
  assert.ok(m.chartW > 340, 'o desenho passa da tela — é o que faz a rolagem existir');
});

check('a pilha fecha: a soma das alturas é a distância da base ao topo', () => {
  const m = buildStackedBars({ buckets: SIMPLES, metric: 'duration', geometry: G });
  for (const b of m.bars) {
    const soma = b.segs.reduce((s, x) => s + x.h, 0);
    assert.ok(Math.abs(m.baseY - b.topY - soma) < 1e-9, `bucket ${b.key} não fecha`);
  }
});

check('a barra de comparação fica fora da polilinha de esforço', () => {
  const m = buildStackedBars({
    buckets: COM_COMPARACAO, metric: 'duration', geometry: G, showEffort: true,
  });
  const cmp = m.bars.find((b) => b.key === 'cmp')!;
  assert.equal(cmp.effY, null, 'ela não é cronológica; ligar o ponto ali inventaria uma progressão');
  assert.ok(m.bars.filter((b) => !b.comparison).every((b) => b.effY !== null));
});

check('o degrau da meta cai no último bucket que não é comparação', () => {
  const m = buildStackedBars({
    buckets: COM_COMPARACAO, metric: 'duration', geometry: G, goal: 5700, currentGoal: 2400,
  });
  const emCurso = m.bars.find((b) => b.key === 'w4')!;
  assert.ok(m.goalPath.includes(`M ${emCurso.x0}`), 'o degrau começa na borda do slot de w4');
  assert.equal(m.goalPath.split('M').length - 1, 3, 'sobe de volta depois da barra de comparação');
});

check('meta cheia depois do fim do período não desenha degrau', () => {
  const m = buildStackedBars({
    buckets: SIMPLES, metric: 'duration', geometry: G, goal: 5700, currentGoal: 5700,
  });
  assert.equal(m.goalPath.split('M').length - 1, 1, 'período fechado é uma reta só');
});

check('o eixo absorve a meta em vez de cortá-la fora do plot', () => {
  const m = buildStackedBars({ buckets: SIMPLES, metric: 'duration', geometry: G, goal: 72000 });
  assert.ok(m.maxV >= 72000);
  assert.ok(m.goalY !== null && m.goalY >= m.baseY - m.plotH - 1e-9);
});

check('sem dado nenhum o eixo cai no piso da unidade, não em zero', () => {
  const m = buildStackedBars({ buckets: VAZIO, metric: 'duration', geometry: G });
  assert.ok(m.maxV >= 3600, 'um eixo de 0–1s seria ilegível');
  assert.ok(m.grid.every((g) => Number.isFinite(g.y)), 'e nada divide por zero');
});

check('só o segmento do topo leva cantos arredondados', () => {
  const m = buildStackedBars({ buckets: SIMPLES, metric: 'duration', geometry: G });
  const b = m.bars[0];
  assert.equal(b.segs[0].d, '', 'o de baixo encosta no de cima; arredondar abriria um vão');
  assert.ok(b.segs[1].d.startsWith('M '), 'o de cima é path, não retângulo');
  assert.equal(b.segs[1].top, true);
});

check('o raio nunca ultrapassa metade da largura nem a altura do segmento', () => {
  const d = topRoundedRectPath(0, 0, 4, 1, 7);
  assert.ok(d.includes('Q 0 0 1 0'), `raio deveria ter caído para 1: ${d}`);
});

// ─────────────────────────── interpolação ───────────────────────────

const FALLBACK = '#5C534A';

function barsOf(buckets: StackedBucket[]): StackedBar[] {
  return buildStackedBars({ buckets, metric: 'duration', geometry: G }).bars;
}

check('no meio da animação a série removida ainda está lá, encolhendo', () => {
  const antes = barsOf([bucket('w1', 'a', [seg('Corrida', 7200, '#F25C2B'), seg('Yoga', 1800, '#6FA86A')])]);
  const depois = barsOf([bucket('w1', 'a', [seg('Corrida', 7200, '#F25C2B')])]);
  const meio = interpolateStackedBars(antes, depois, 0.5, 100, 7, FALLBACK);

  const yoga = meio[0].segs.find((s) => s.label === 'Yoga');
  assert.ok(yoga, 'sumir de uma vez faz a pilha saltar; ela encolhe no lugar');
  assert.ok(yoga!.h > 0 && yoga!.h < antes[0].segs[1].h, 'a meio caminho, e menor que antes');
});

check('no fim da animação a saída é o alvo, sem resto da série antiga', () => {
  const antes = barsOf([bucket('w1', 'a', [seg('Corrida', 7200, '#F25C2B'), seg('Yoga', 1800, '#6FA86A')])]);
  const depois = barsOf([bucket('w1', 'a', [seg('Corrida', 7200, '#F25C2B')])]);
  const fim = interpolateStackedBars(antes, depois, 1, 100, 7, FALLBACK);
  const yoga = fim[0].segs.find((s) => s.label === 'Yoga')!;
  assert.equal(yoga.h, 0, 'altura zero — quem desenha não vê nada');
});

check('durante o encolhimento os cantos passam para quem virou o topo', () => {
  const antes = barsOf([bucket('w1', 'a', [seg('Corrida', 7200, '#F25C2B'), seg('Yoga', 1800, '#6FA86A')])]);
  const depois = barsOf([bucket('w1', 'a', [seg('Corrida', 7200, '#F25C2B')])]);
  const fim = interpolateStackedBars(antes, depois, 1, 100, 7, FALLBACK);
  const corrida = fim[0].segs.find((s) => s.label === 'Corrida')!;
  assert.equal(corrida.top, true, 'senão a barra termina com o topo reto');
  assert.ok(corrida.d.startsWith('M '));
});

check('um bucket novo cresce da base, não aparece no lugar final', () => {
  const depois = barsOf([bucket('novo', 'n', [seg('Corrida', 7200, '#F25C2B')])]);
  const meio = interpolateStackedBars([], depois, 0.5, 100, 7, FALLBACK);
  assert.ok(meio[0].segs[0].h < depois[0].segs[0].h);
  assert.ok(meio[0].segs[0].h > 0);
});

check('o ponto de esforço acompanha as barras', () => {
  const alvo = buildStackedBars({
    buckets: SIMPLES, metric: 'duration', geometry: G, showEffort: true,
  }).bars;
  const meio = interpolateStackedBars([], alvo, 0.5, 178, 7, FALLBACK);
  const a = alvo[0].effY!;
  assert.ok(meio[0].effY! > a, 'a meio caminho está mais perto da base (y maior)');
  assert.ok(meio[0].effY! < 178);
});

// ─────────────────────────── rótulos e cor ───────────────────────────

check('rótulo curto usa a vírgula do pt-BR nas duas plataformas', () => {
  // O mobile imprimia "1.5h" — não por escolha, mas por a cópia dele nunca ter
  // recebido o `toLocaleString` que a web ganhou.
  assert.equal(formatMetricShort(5400, 'duration'), '1,5h');
  assert.equal(formatMetricShort(12500, 'distance'), '13km', 'acima de 10 km some a casa decimal');
  assert.equal(formatMetricShort(5500, 'distance'), '5,5km');
  assert.equal(formatMetricShort(36000, 'duration'), '10h');
});

check('o eixo compacta métrica inteira e só ela', () => {
  assert.equal(formatAxisLabel(17426, 'calories'), '17k', '"17.426" rouba a largura do eixo');
  assert.equal(formatAxisLabel(12, 'count'), '12');
  assert.equal(formatAxisLabel(5400, 'duration'), '1,5h', 'duração não vira "5k"');
});

check('rótulo de referência abaixo de uma hora vira minutos', () => {
  assert.equal(formatCompactLabel(1260, 'duration'), '21 min', 'a meta diária não pode virar "0,4h"');
  assert.equal(formatCompactLabel(5400, 'duration'), '1,5h');
  assert.equal(formatCompactLabel(300, 'calories'), '300', 'a regra é só de duração');
});

check('o degradê clareia em direção à superfície, não a um creme cravado', () => {
  const claro = stackedGradientStops('#F25C2B', '#FFFFFF');
  const escuro = stackedGradientStops('#F25C2B', '#16130F');
  assert.notEqual(claro.top, escuro.top, 'no escuro a barra não pode lavar para bege');
  assert.notEqual(claro.top, claro.base, 'o topo é mais lavado que a base');
});

check('só hex ganha degradê', () => {
  assert.equal(isHexColor('#F25C2B'), true);
  assert.equal(isHexColor('#abc'), true);
  assert.equal(isHexColor('var(--primary)'), false, 'não dá para interpolar uma variável CSS');
  assert.equal(stackedGradientId('#F25C2B'), 'sbc-grad-F25C2B');
});

console.log(`\n${passed} testes passaram.`);
