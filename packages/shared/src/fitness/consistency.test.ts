/**
 * A grade de consistência.
 *
 * O que estes testes protegem, acima de tudo, é a **escala**: ela existe porque
 * a do `buildHeatmap` da Retrospectiva não servia aqui, e a diferença que
 * importa é um dia de descanso não cair no mesmo passo de um dia fraco. Se
 * alguém "simplificar" reaproveitando a outra escala, é aqui que quebra.
 *
 * Em segundo lugar, a **janela**: corrida, terminando em ontem, sem alinhamento
 * com o dia da semana. As duas consequências que os testes fixam é a grade nunca
 * ter linha pela metade e o dia de hoje — que ainda está correndo — não aparecer.
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

check('a janela é corrida, termina ontem e enche todas as linhas', () => {
  const c = buildActivityConsistency([], TARGET_MIN, 4, NOW);
  assert.equal(c.days.length, 28, 'quatro linhas de sete, sem célula sobrando nem faltando');
  assert.equal(c.days[c.days.length - 1].day, '2026-08-19', 'a última célula é ontem');
  assert.equal(c.days[0].day, '2026-07-23', '27 dias antes dela');
  assert.equal(
    c.days[0].weekday,
    3,
    'a primeira célula cai numa quinta — a grade não é mais um calendário, a coluna não é dia da semana',
  );
});

check('hoje fica de fora — o dia ainda está correndo', () => {
  const c = buildActivityConsistency([act(0, 3600)], TARGET_MIN, 4, NOW);
  assert.ok(
    c.days.every((d) => d.day <= '2026-08-19'),
    'a célula mais visível da grade não pode dizer "parado" sobre um dia que nem terminou',
  );
  assert.equal(c.activeDays, 0, 'o treino de hoje não entra na janela nem no rodapé');
});

check('mais semanas recuam o começo, mantendo o fim em ontem', () => {
  const quatro = buildActivityConsistency([], TARGET_MIN, 4, NOW);
  const oito = buildActivityConsistency([], TARGET_MIN, 8, NOW);
  assert.equal(oito.days.length, 56);
  assert.equal(oito.days[oito.days.length - 1].day, quatro.days[quatro.days.length - 1].day);
  assert.equal(oito.days[0].day, '2026-06-25', 'a âncora recua 28 dias');
});

check('sem atividade nenhuma, todos os dias são descanso', () => {
  const c = buildActivityConsistency([], TARGET_MIN, 4, NOW);
  assert.equal(c.activeDays, 0);
  assert.equal(c.metDays, 0);
  assert.equal(c.longestStreak, 0);
  assert.ok(c.days.every((d) => d.step === -3));
});

check('soma vários treinos no mesmo dia', () => {
  // Dois treinos de 20 min no mesmo dia devem contar juntos contra a meta.
  const c = buildActivityConsistency([act(1, 1200), act(1, 1200)], TARGET_MIN, 2, NOW);
  const ontem = c.days[c.days.length - 1];
  const um = buildActivityConsistency([act(1, 1200)], TARGET_MIN, 2, NOW);
  assert.equal(
    ontem.effectiveS,
    um.days[um.days.length - 1].effectiveS * 2,
    'o dia acumula, não sobrescreve',
  );
});

check('atividade oculta não conta', () => {
  const escondida: Activity = { ...act(1, 3600), hidden: true };
  const c = buildActivityConsistency([escondida], TARGET_MIN, 2, NOW);
  assert.equal(c.activeDays, 0, 'quem está fora das métricas está fora da grade');
});

check('weekday continua com segunda = 0, para a leitura ao tocar a célula', () => {
  const c = buildActivityConsistency([], TARGET_MIN, 2, NOW);
  const ontem = c.days[c.days.length - 1];
  // 19/08/2026 é uma quarta-feira → 2 na convenção seg=0.
  assert.equal(ontem.weekday, 2);
});

check('a maior sequência conta dias consecutivos, não total', () => {
  // treinos em D-6, D-5, D-4 … D-2, D-1: sequências de 3 e 2.
  const c = buildActivityConsistency(
    [act(6, 3600), act(5, 3600), act(4, 3600), act(2, 3600), act(1, 3600)],
    TARGET_MIN, 2, NOW,
  );
  assert.equal(c.activeDays, 5);
  assert.equal(c.longestStreak, 3, 'a maior corrida é a de três, não a soma');
});

check('metDays só conta quem chegou na meta', () => {
  // 3600 s de corrida rende esforço bem acima de 20 min; 60 s, bem abaixo.
  const c = buildActivityConsistency([act(3, 3600), act(2, 60)], TARGET_MIN, 2, NOW);
  assert.equal(c.activeDays, 2, 'os dois dias tiveram treino');
  assert.equal(c.metDays, 1, 'só um bateu a meta diária');
});

check('atividade fora da janela não entra', () => {
  const c = buildActivityConsistency([act(400, 3600)], TARGET_MIN, 4, NOW);
  assert.equal(c.activeDays, 0);
  assert.equal(c.previousTotalS, 0, 'nem pela porta dos fundos da janela anterior');
});

check('os blocos são as linhas da grade, do mais antigo ao mais recente', () => {
  const c = buildActivityConsistency([act(28, 3600), act(1, 3600)], TARGET_MIN, 4, NOW);
  assert.equal(c.blocks.length, 4, 'um bloco por linha');
  assert.equal(c.blocks[0].start, '2026-07-23');
  assert.equal(c.blocks[0].end, '2026-07-29');
  assert.equal(c.blocks[3].end, '2026-08-19', 'o último bloco termina em ontem');
  assert.ok(c.blocks[0].effectiveS > 0, 'o treino da primeira célula caiu no primeiro bloco');
  assert.ok(c.blocks[3].effectiveS > 0, 'o de ontem, no último');
  assert.equal(c.blocks[1].effectiveS, 0);
  assert.equal(
    c.blocks.reduce((s, b) => s + b.effectiveS, 0),
    c.totalS,
    'os blocos particionam a janela — nada sobra e nada conta duas vezes',
  );
});

check('o score compara com a meta da janela inteira', () => {
  const c = buildActivityConsistency([], TARGET_MIN, 4, NOW);
  assert.equal(c.targetTotalS, c.targetS * 28);
  assert.equal(c.targetTotalS, (TARGET_MIN / 7) * 60 * 28, 'quatro semanas de meta semanal');
  assert.equal(c.totalS, 0);
});

check('a janela anterior é a de trás, não um pedaço da de dentro', () => {
  const dentro = act(1, 3600);
  const atras = act(29, 3600); //  um dia antes da primeira célula
  const c = buildActivityConsistency([dentro, atras], TARGET_MIN, 4, NOW);
  assert.ok(c.totalS > 0);
  assert.equal(c.totalS, c.previousTotalS, 'mesmo treino dos dois lados — só mudou a janela');
  const soDentro = buildActivityConsistency([dentro], TARGET_MIN, 4, NOW);
  assert.equal(
    soDentro.previousTotalS,
    0,
    'sem histórico atrás dá zero; é quem exibe que decide não desenhar a seta',
  );
});

console.log(`\n${passed} testes passaram.`);
