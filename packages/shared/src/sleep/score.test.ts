/**
 * Saúde do sono — a contagem de dimensões.
 *
 * O que estes testes protegem, e cada item é uma decisão que custou medição:
 *
 * 1. **A troca de aparelho não vira mérito.** É o teste central. Uma pessoa que
 *    não mudou nada, mas trocou de relógio, não pode ganhar pontos de
 *    continuidade — a linha de base móvel existe para isso e é a única coisa do
 *    módulo que não é opcional.
 * 2. **A direção de cada escada.** Vigília e desvio de horário pontuam ao
 *    contrário de duração, regularidade e nota. Com uma vigília quase sempre
 *    zero, p25 e mediana empatam, e uma escada que inferisse direção pela ordem
 *    dos limiares premiaria a noite mais fragmentada.
 * 3. **Regularidade não existe numa noite.** A noite tem quatro dimensões; o
 *    período tem cinco. Isso é definição, não configuração.
 * 4. **Buraco não vira regularidade.** O índice roda só no trecho contíguo: uma
 *    semana com dois dias faltando não pode pontuar melhor do que uma completa
 *    só porque a ausência lê como "acordado nos dois lados".
 * 5. **Cobertura trava a contagem, não as medidas.** Abaixo do piso as dimensões
 *    continuam na lista e `scored` cai — é o caso comum no histórico real.
 * 6. **Dado que falta encolhe o denominador.** Uma dimensão não medida sai de
 *    `max`; ela nunca vira zero disfarçado.
 */

import assert from 'node:assert/strict';
import type { SleepPeriod } from '../models';
import {
  BASELINE_MIN_NIGHTS,
  DIMENSION_LABEL,
  SCORE_COVERAGE_FLOOR,
  coverageNote,
  longestRun,
  nightScore,
  periodScore,
  sleepBaseline,
  type SleepDimensionKey,
  type SleepScore,
} from './score';

let passed = 0;
function check(name: string, fn: () => void): void {
  fn();
  passed += 1;
  console.log(`  ok ${name}`);
}

const BXL = 120;

/** Noite que acorda em `wakeDay`, apagando `onsetH` local, com `durH` de sono. */
function night(
  wakeDay: string,
  onsetH = 23.5,
  durH = 7.5,
  awakeMin: number | null = 0,
): SleepPeriod {
  const wake = new Date(`${wakeDay}T12:00:00Z`);
  const onsetLocal = new Date(wake);
  onsetLocal.setUTCDate(onsetLocal.getUTCDate() - 1);
  onsetLocal.setUTCHours(0, 0, 0, 0);
  const onsetMs = onsetLocal.getTime() + onsetH * 3_600_000 - BXL * 60_000;
  const wakeMs = onsetMs + (durH + (awakeMin ?? 0) / 60) * 3_600_000;

  // A vigília mora dentro do período, uma hora depois de apagar.
  let awakenings: SleepPeriod['awakenings'] = null;
  if (awakeMin !== null) {
    awakenings =
      awakeMin === 0
        ? []
        : [
            {
              from: new Date(onsetMs + 3_600_000).toISOString(),
              to: new Date(onsetMs + 3_600_000 + awakeMin * 60_000).toISOString(),
            },
          ];
  }

  return {
    userId: 'u',
    onsetAt: new Date(onsetMs).toISOString(),
    wakeAt: new Date(wakeMs).toISOString(),
    inBedAt: null,
    inBedEnd: null,
    tzOffset: BXL,
    wakeDay,
    asleepH: durH,
    awakenings,
    stages: null,
    stageSegments: null,
  };
}

/** `n` noites terminando em `lastDay`, uma por dia. */
function run(lastDay: string, n: number, onsetH = 23.5, durH = 7.5, awakeMin: number | null = 0): SleepPeriod[] {
  const out: SleepPeriod[] = [];
  const d = new Date(`${lastDay}T12:00:00Z`);
  for (let i = n - 1; i >= 0; i -= 1) {
    const x = new Date(d);
    x.setUTCDate(d.getUTCDate() - i);
    out.push(night(x.toISOString().slice(0, 10), onsetH, durH, awakeMin));
  }
  return out;
}

function dim(s: SleepScore, key: SleepDimensionKey) {
  const d = s.dimensions.find((x) => x.key === key);
  assert.ok(d, `dimensão ${key} ausente`);
  return d!;
}

/* ───────────── 1. a troca de aparelho ───────────── */

check('a troca de relógio não vira mérito: a base móvel absorve o salto de vigília', () => {
  // 30 noites de Apple: 70 min acordado, como no histórico real (mediana 71,5).
  const apple = run('2026-07-17', 30, 23.5, 7.5, 70);
  // Primeira noite de Garmin: 13 min — o salto que a troca produz sozinha.
  const primeira = night('2026-07-18', 23.5, 7.5, 13);

  const logo = nightScore(primeira, apple, 4);
  assert.equal(dim(logo, 'continuidade').points, 2, 'contra a base Apple, 13 min é excelente');

  // Um mês depois a base já é toda Garmin, e 13 min virou o normal dele.
  const garmin = run('2026-08-17', 30, 23.5, 7.5, 13);
  const depois = nightScore(night('2026-08-18', 23.5, 7.5, 13), garmin, 4);
  assert.equal(
    dim(depois, 'continuidade').points,
    2,
    'com base achatada em 13, p25 = mediana = 13 e a noite ainda empata no limiar',
  );

  // O que não pode acontecer: a mesma noite de 70 min continuar valendo 2 pontos
  // depois que a base virou Garmin. Aí o score estaria medindo o relógio.
  const velha = nightScore(night('2026-08-18', 23.5, 7.5, 70), garmin, 4);
  assert.equal(dim(velha, 'continuidade').points, 0, '70 min contra base Garmin é ruim');
});

check('sem noites anteriores suficientes, continuidade e horário saem NÃO MEDIDAS', () => {
  const poucas = run('2026-08-10', BASELINE_MIN_NIGHTS - 1, 23.5, 7.5, 10);
  const s = nightScore(night('2026-08-11', 23.5, 7.5, 10), poucas, 4);

  assert.equal(dim(s, 'continuidade').points, null);
  assert.match(dim(s, 'continuidade').absent!, /noites anteriores/);
  assert.equal(dim(s, 'horario').points, null);
  // Duas dimensões medidas de quatro → o máximo encolhe, não vira zero.
  assert.equal(s.max, 4);
  assert.equal(s.points, 4, 'duração 7h30 e nota 4 valem dois cada');
});

check('a base olha só para trás — a própria noite nunca entra nela', () => {
  const hist = [...run('2026-08-10', 20, 23.5, 7.5, 5), night('2026-08-11', 23.5, 7.5, 999)];
  const base = sleepBaseline(hist, '2026-08-11');
  assert.ok(base);
  assert.equal(base!.nights, 20, 'a noite de 11/08 fica fora da base de 11/08');
  assert.equal(base!.wasoMedian, 5);
});

/* ───────────── 2. a direção de cada escada ───────────── */

check('menor é melhor na vigília, mesmo quando p25 e mediana empatam em zero', () => {
  const zeradas = run('2026-08-10', 20, 23.5, 7.5, 0);
  assert.equal(dim(nightScore(night('2026-08-11', 23.5, 7.5, 0), zeradas, 4), 'continuidade').points, 2);
  assert.equal(
    dim(nightScore(night('2026-08-11', 23.5, 7.5, 50), zeradas, 4), 'continuidade').points,
    0,
    'uma escada que inferisse direção daria 2 aqui — é o bug que este teste tranca',
  );
});

check('duração: 7h vale 2, 6h vale 1, abaixo vale 0 (AASM/SRS 2015)', () => {
  const h = run('2026-08-10', 20, 23.5, 7.5, 5);
  const pts = (durH: number) => dim(nightScore(night('2026-08-11', 23.5, durH, 5), h, 4), 'duracao').points;
  assert.equal(pts(7), 2);
  assert.equal(pts(8.5), 2);
  assert.equal(pts(6.5), 1);
  assert.equal(pts(5.9), 0);
});

check('nota: 4 e 5 valem 2, 3 vale 1, 1 e 2 valem 0; sem nota é não medida', () => {
  const h = run('2026-08-10', 20, 23.5, 7.5, 5);
  const pts = (n: number | null) => dim(nightScore(night('2026-08-11', 23.5, 7.5, 5), h, n), 'percepcao').points;
  assert.equal(pts(5), 2);
  assert.equal(pts(4), 2);
  assert.equal(pts(3), 1);
  assert.equal(pts(2), 0);
  assert.equal(pts(null), null);
});

check('horário: o desvio é circular — 23h50 dista 20 min de 00h10, não 23h40', () => {
  // Base com midpoint às 03:15 (apaga 23:30, dorme 7,5 h).
  const h = run('2026-08-10', 20, 23.5, 7.5, 5);
  // Apagar 40 min mais tarde move o midpoint 40 min: passa de 30 e cai para 1 ponto.
  assert.equal(dim(nightScore(night('2026-08-11', 23.5, 7.5, 5), h, 4), 'horario').points, 2);
  const tarde = dim(nightScore(night('2026-08-11', 23.5 + 40 / 60, 7.5, 5), h, 4), 'horario').points;
  assert.equal(tarde, 1);
  // E atravessar a meia-noite não explode a distância.
  const base = run('2026-08-10', 20, 20.5, 7.5, 5); // midpoint 00:15
  const cruza = dim(nightScore(night('2026-08-11', 20.5 - 20 / 60, 7.5, 5), base, 4), 'horario').points;
  assert.equal(cruza, 2, 'vinte minutos antes continua sendo vinte minutos');
});

/* ───────────── 3. regularidade só existe no período ───────────── */

check('a noite tem quatro dimensões; o período tem cinco', () => {
  const h = run('2026-08-10', 20, 23.5, 7.5, 5);
  const n = nightScore(night('2026-08-11', 23.5, 7.5, 5), h, 4);
  assert.deepEqual(n.dimensions.map((d) => d.key), ['duracao', 'continuidade', 'horario', 'percepcao']);
  assert.equal(n.max, 8, 'quatro dimensões medidas × 2');

  const semana = run('2026-08-30', 7, 23.5, 7.5, 5);
  const p = periodScore(semana, 7, {}, h);
  assert.deepEqual(p.dimensions.map((d) => d.key), [
    'duracao', 'continuidade', 'horario', 'regularidade', 'percepcao',
  ]);
  assert.equal(dim(p, 'regularidade').points, 2, 'sete noites idênticas são perfeitamente regulares');
});

check('uma semana de horários iguais pontua regularidade; uma de horários espalhados, não', () => {
  const h = run('2026-07-31', 30, 23.5, 7.5, 5);
  const certa = run('2026-08-30', 7, 23.5, 7.5, 5);
  assert.equal(dim(periodScore(certa, 7, {}, h), 'regularidade').points, 2);

  // Mesma duração, mesma vigília — só o horário de apagar varia em ±3 h.
  const bagunca = run('2026-08-30', 7, 23.5, 7.5, 5).map((p, i) =>
    night(p.wakeDay, 21.5 + (i % 2) * 4, 7.5, 5),
  );
  const s = periodScore(bagunca, 7, {}, h);
  assert.ok((dim(s, 'regularidade').points ?? 2) < 2, 'alternar 21h30 e 01h30 não é regular');
  assert.equal(dim(s, 'duracao').points, 2, 'e a duração continua boa — as dimensões são independentes');
});

/* ───────────── 4. buraco não vira regularidade ───────────── */

check('o índice roda só no trecho contíguo — ausência não conta como constância', () => {
  const semana = run('2026-08-30', 7, 23.5, 7.5, 5); // 24 → 30 de agosto
  const comBuraco = [...semana.slice(0, 2), ...semana.slice(4)]; // 24,25 · buraco · 28,29,30
  assert.equal(longestRun(comBuraco).length, 3, 'o maior trecho seguido tem 3 noites');

  const s = periodScore(comBuraco, 7, {}, run('2026-07-31', 30, 23.5, 7.5, 5));
  assert.equal(dim(s, 'regularidade').points, null);
  assert.match(dim(s, 'regularidade').absent!, /seguidas/);
});

check('longestRun escolhe o maior trecho e devolve uma noite por dia', () => {
  const dias = ['2026-08-01', '2026-08-02', '2026-08-05', '2026-08-06', '2026-08-07', '2026-08-08'];
  const ps = dias.map((d) => night(d, 23.5, 7.5, 5));
  assert.deepEqual(longestRun(ps).map((p) => p.wakeDay), dias.slice(2));

  // Duas noites no mesmo dia: fica a mais longa, e o trecho não quebra.
  const duplicado = [...ps, night('2026-08-06', 3, 1.2, 0)];
  const r = longestRun(duplicado);
  assert.equal(r.length, 4);
  assert.equal(r.find((p) => p.wakeDay === '2026-08-06')!.asleepH, 7.5);
});

/* ───────────── 5. cobertura ───────────── */

check('abaixo do piso de cobertura as medidas ficam e a contagem cai', () => {
  const h = run('2026-06-30', 30, 23.5, 7.5, 5);
  const meio = run('2026-07-14', 14, 23.5, 7.5, 5); // 14 de 31 = 45%, como julho de 2026
  const s = periodScore(meio, 31, {}, h);

  assert.equal(s.coverage!.nights, 14);
  assert.equal(s.coverage!.expected, 31);
  assert.ok(s.coverage!.ratio < SCORE_COVERAGE_FLOOR);
  assert.equal(s.scored, false);
  assert.equal(dim(s, 'duracao').points, 2, 'a medida continua lá — só a contagem não vale');
  assert.match(coverageNote(s)!, /14 de 31 noites/);
  assert.match(coverageNote(s)!, /abaixo do piso/);
});

check('no piso exato a contagem vale', () => {
  const h = run('2026-07-31', 30, 23.5, 7.5, 5);
  const s = periodScore(run('2026-08-30', 7, 23.5, 7.5, 5), 10, {}, h);
  assert.equal(s.coverage!.ratio, 0.7);
  assert.equal(s.scored, true);
});

check('período vazio: cinco dimensões ausentes, nada pontuado, nada quebra', () => {
  const s = periodScore([], 7);
  assert.equal(s.dimensions.length, 5);
  assert.ok(s.dimensions.every((d) => d.points === null));
  assert.equal(s.max, 0);
  assert.equal(s.scored, false);
});

/* ───────────── 6. o denominador honesto ───────────── */

check('fonte que não reporta vigília: continuidade sai de `max`, não vira zero', () => {
  const h = run('2026-08-10', 20, 23.5, 7.5, 5);
  const semVigilia = night('2026-08-11', 23.5, 7.5, null);
  const s = nightScore(semVigilia, h, 4);

  assert.equal(dim(s, 'continuidade').points, null);
  assert.match(dim(s, 'continuidade').absent!, /não reporta/);
  assert.equal(s.max, 6, 'três dimensões medidas de quatro');
  assert.equal(s.points, 6);
});

check('cada dimensão carrega o fato cru ao lado da contagem', () => {
  const h = run('2026-08-10', 20, 23.5, 7.5, 5);
  const s = nightScore(night('2026-08-11', 23.5, 7.08, 8), h, 3);
  assert.equal(dim(s, 'duracao').fact, '7h05');
  assert.equal(dim(s, 'continuidade').fact, '8 min · 1 despertar');
  assert.match(dim(s, 'horario').fact, /^meio \d{2}:\d{2}$/);
  assert.equal(dim(s, 'percepcao').fact, '3/5');
  // Nenhum rótulo é inventado na tela: eles moram aqui.
  assert.equal(dim(s, 'duracao').label, DIMENSION_LABEL.duracao);
});

check('no período o fato de duração traz a mediana e a fração acima de 7h', () => {
  const h = run('2026-07-31', 30, 23.5, 7.5, 5);
  const mista = [
    ...run('2026-08-27', 4, 23.5, 8, 5),
    ...run('2026-08-30', 3, 23.5, 6, 5),
  ];
  const s = periodScore(mista, 7, { '2026-08-30': 4, '2026-08-29': 3 }, h);
  assert.match(dim(s, 'duracao').fact, /57% ≥ 7h/);
  assert.equal(dim(s, 'percepcao').fact, '3,5/5 · 2 notas', 'pt-BR, com vírgula — o conserto da story 5.3');
  assert.equal(dim(s, 'percepcao').points, 1, 'média 3,5 fica no degrau do meio');
});

check('nenhum fato escreve número com ponto decimal — é pt-BR, e a conferência da leitura não o veria', () => {
  // A regra `algarismo` da leitura lê o texto do **motor**; o fato vem do código e
  // entra por marcador, então um "3.3/5" iria para a frase sem ninguém reprovar.
  const h = run('2026-07-31', 30, 23.5, 7.5, 5);
  const semana = [...run('2026-08-27', 4, 23.5, 8, 5), ...run('2026-08-30', 3, 23.5, 6, 37)];
  const notas: Record<string, number>[] = [
    { '2026-08-30': 4, '2026-08-29': 3 },                               // média 3,5
    { '2026-08-30': 4, '2026-08-29': 3, '2026-08-28': 3, '2026-08-27': 3 }, // média 3,25 → 3,3
    { '2026-08-30': 5, '2026-08-29': 4, '2026-08-28': 4 },               // média 4,33 → 4,3
    {},                                                                  // sem nota
  ];
  const scores: SleepScore[] = [
    ...notas.map((r) => periodScore(semana, 7, r, h)),
    periodScore([], 7),
    periodScore(run('2026-08-07', 3), 7),
    nightScore(night('2026-08-20', 23.5, 7.9, 15), h, 4),
    nightScore(night('2026-08-20', 23.5, 6.2, null), [], null),
  ];
  const textos = [
    ...scores.flatMap((s) => s.dimensions.flatMap((d) => [d.fact, d.absent ?? ''])),
    ...scores.map((s) => coverageNote(s) ?? ''),
  ].filter((t) => t !== '');
  const comPonto = textos.filter((t) => /\d\.\d/.test(t));
  assert.deepEqual(comPonto, [], 'fato com ponto decimal — em pt-BR é vírgula');
  // Não-vácuo: há decimal de verdade no lote, e ele sai com vírgula.
  assert.ok(textos.some((t) => /\d,\d/.test(t)), `nenhum decimal no lote: ${textos.join(' | ')}`);
});

console.log(`\n${passed} testes passaram.`);
