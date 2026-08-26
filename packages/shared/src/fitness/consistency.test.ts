/**
 * A grade de consistência.
 *
 * O que estes testes protegem, acima de tudo, é a **escala**: ela existe porque
 * a do `buildHeatmap` da Retrospectiva não servia aqui, e a diferença que
 * importa é um dia de descanso não cair no mesmo passo de um dia fraco. Se
 * alguém "simplificar" reaproveitando a outra escala, é aqui que quebra.
 */

import assert from 'node:assert/strict';
import { buildActivityConsistency, consistencyStep } from './consistency';
import { weeklyTargetSeconds } from '../health/who-activity';
import type { Activity } from '../models';

let passed = 0;
function check(name: string, fn: () => void): void {
  fn();
  passed += 1;
  console.log(`  ok ${name}`);
}

const NOW = new Date(2026, 7, 20, 14, 0, 0); // 20/08/2026, quinta-feira (local)
const TARGET_MIN = 140; // 20 min/dia cheios — facilita conferir a conta a olho
const DAILY_S = weeklyTargetSeconds('day', NOW, TARGET_MIN);

/** Atividade sem FC: `effectiveSeconds` cai no peso do tipo. */
function act(daysAgo: number, durationS: number, activityId = 37): Activity {
  const d = new Date(NOW.getFullYear(), NOW.getMonth(), NOW.getDate() - daysAgo, 9, 0, 0);
  return {
    id: `a${daysAgo}-${durationS}`,
    userId: 'u',
    activityId,
    calories: 100,
    startAt: d.toISOString(),
    endAt: new Date(d.getTime() + durationS * 1000).toISOString(),
    durationS,
    hasRoute: false,
  };
}

check('a meta diária é a semanal dividida pelos sete dias', () => {
  assert.equal(DAILY_S, (TARGET_MIN / 7) * 60);
});

check('escala — não treinar tem passo próprio, não é "treinou pouco"', () => {
  assert.equal(consistencyStep(0, DAILY_S), -3, 'zero é o passo reservado');
  assert.equal(consistencyStep(1, DAILY_S), -2, 'um segundo já sai do -3');
  assert.notEqual(
    consistencyStep(0, DAILY_S),
    consistencyStep(DAILY_S * 0.74, DAILY_S),
    'descanso e dia fraco não podem cair no mesmo passo — foi por isto que a escala do sono não servia',
  );
});

check('escala — os cortes caem onde a documentação diz', () => {
  assert.equal(consistencyStep(DAILY_S * 0.25, DAILY_S), -2);
  assert.equal(consistencyStep(DAILY_S * 0.75, DAILY_S), -1);
  assert.equal(consistencyStep(DAILY_S, DAILY_S), 0, 'em cima da meta é o neutro');
  assert.equal(DAILY_S * 1.2 / DAILY_S < 1.5, true);
  assert.equal(consistencyStep(DAILY_S * 1.2, DAILY_S), 0);
  assert.equal(consistencyStep(DAILY_S * 2, DAILY_S), 1);
  assert.equal(consistencyStep(DAILY_S * 3, DAILY_S), 2);
});

check('escala — meta zero não divide por zero', () => {
  assert.equal(consistencyStep(500, 0), 0);
  assert.equal(consistencyStep(0, 0), -3, 'zero continua sendo zero');
});

check('a janela tem o tamanho pedido e termina hoje', () => {
  const c = buildActivityConsistency([], TARGET_MIN, 28, NOW);
  assert.equal(c.days.length, 28);
  assert.equal(c.days[c.days.length - 1].day, '2026-08-20', 'a última célula é hoje');
  assert.equal(c.days[0].day, '2026-07-24', '28 dias atrás, inclusive');
});

check('sem atividade nenhuma, todos os dias são descanso', () => {
  const c = buildActivityConsistency([], TARGET_MIN, 28, NOW);
  assert.equal(c.activeDays, 0);
  assert.equal(c.metDays, 0);
  assert.equal(c.longestStreak, 0);
  assert.ok(c.days.every((d) => d.step === -3));
});

check('soma vários treinos no mesmo dia', () => {
  // Dois treinos de 20 min no mesmo dia devem contar juntos contra a meta.
  const c = buildActivityConsistency([act(0, 1200), act(0, 1200)], TARGET_MIN, 7, NOW);
  const hoje = c.days[c.days.length - 1];
  const um = buildActivityConsistency([act(0, 1200)], TARGET_MIN, 7, NOW);
  assert.equal(
    hoje.effectiveS,
    um.days[um.days.length - 1].effectiveS * 2,
    'o dia acumula, não sobrescreve',
  );
});

check('atividade oculta não conta', () => {
  const escondida: Activity = { ...act(0, 3600), hidden: true };
  const c = buildActivityConsistency([escondida], TARGET_MIN, 7, NOW);
  assert.equal(c.activeDays, 0, 'quem está fora das métricas está fora da grade');
});

check('weekday usa segunda = 0, como a grade', () => {
  const c = buildActivityConsistency([], TARGET_MIN, 7, NOW);
  const hoje = c.days[c.days.length - 1];
  // 20/08/2026 é uma quinta-feira → 3 na convenção seg=0.
  assert.equal(hoje.weekday, 3);
  assert.equal(c.pad, c.days[0].weekday, 'o pad alinha a primeira célula na coluna certa');
});

check('a maior sequência conta dias consecutivos, não total', () => {
  // treinos em D-6, D-5, D-4 … D-2, D-1: sequências de 3 e 2.
  const c = buildActivityConsistency(
    [act(6, 3600), act(5, 3600), act(4, 3600), act(2, 3600), act(1, 3600)],
    TARGET_MIN, 7, NOW,
  );
  assert.equal(c.activeDays, 5);
  assert.equal(c.longestStreak, 3, 'a maior corrida é a de três, não a soma');
});

check('metDays só conta quem chegou na meta', () => {
  // 3600 s de corrida rende esforço bem acima de 20 min; 60 s, bem abaixo.
  const c = buildActivityConsistency([act(3, 3600), act(2, 60)], TARGET_MIN, 7, NOW);
  assert.equal(c.activeDays, 2, 'os dois dias tiveram treino');
  assert.equal(c.metDays, 1, 'só um bateu a meta diária');
});

check('atividade fora da janela não entra', () => {
  const c = buildActivityConsistency([act(400, 3600)], TARGET_MIN, 28, NOW);
  assert.equal(c.activeDays, 0);
});

console.log(`\n${passed} testes passaram.`);
