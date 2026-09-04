/**
 * O núcleo de sono.
 *
 * O que estes testes protegem, em ordem de importância:
 *
 * 1. **O formato do `extra`.** A linha diária de `health_daily` passa a ser
 *    derivada dos períodos, e prontidão, retrospectiva, destaques da semana e
 *    notificações leem esse formato hoje. Se ele mudar, quatro features quebram
 *    caladas — o backfill reescreveria 500 dias com um contrato novo.
 *
 * 2. **Os três estados de vigília.** `null` (a fonte não reporta) ≠ `[]` (não
 *    houve) ≠ `[…]`. Colapsar os dois primeiros faz a tela afirmar "você dormiu
 *    direto" quando a verdade é "não sei" — e é o caso de todas as 42 noites da
 *    era Garmin.
 *
 * 3. **O fuso sai do período, não do aparelho.** Ler a hora do dia com os
 *    getters locais do JS faria uma viagem reescrever o passado: a noite de
 *    Bruxelas viraria noite de onde o celular está agora.
 *
 * 4. **A regra de `in_bed_at` degenerado.** Fontes que derivam a janela "na
 *    cama" do próprio sono abrem `INBED` junto com o `onset`. Gravar isso faria
 *    a tela dizer "você deitou 00:08" em 41 das 42 noites medidas.
 */

import assert from 'node:assert/strict';
import type { SleepPeriod } from '../models';
import {
  SLEEP_AXIS_ORIGIN_H,
  axisPosition,
  axisRange,
  bedtimeMeasured,
  clockLabel,
  efficiency,
  latencyMin,
  localHourOf,
  midpointHour,
  toTimingBar,
} from './timing';
import { MIN_LATENCY_MIN, awakeMinOf, deriveSleepDays } from './derive';
import { awakeSeries, buildAwakeClock, peakAwakeWindow } from './awakenings';
import { sleepRegularityIndex, sleepWakeSeries, socialJetlag } from './regularity';

let passed = 0;
function check(name: string, fn: () => void): void {
  fn();
  passed += 1;
  console.log(`  ok ${name}`);
}

/** Bruxelas no verão: UTC+2. É onde o usuário mora. */
const BXL = 120;

function period(over: Partial<SleepPeriod> = {}): SleepPeriod {
  return {
    userId: 'u',
    onsetAt: '2026-08-30T21:40:00.000Z', // 23h40 em Bruxelas
    wakeAt: '2026-08-31T05:00:00.000Z', // 07h00
    inBedAt: null,
    inBedEnd: null,
    tzOffset: BXL,
    wakeDay: '2026-08-31',
    asleepH: 7.333,
    awakenings: null,
    stages: null,
    ...over,
  };
}

/* ───────────────────────── Fuso e eixo ───────────────────────── */

check('hora do dia sai do tzOffset do período, não do relógio do aparelho', () => {
  // Mesmo instante, dois fusos: a hora local tem de mudar com o offset.
  assert.equal(localHourOf('2026-08-30T21:40:00.000Z', 120), 23 + 40 / 60);
  assert.equal(localHourOf('2026-08-30T21:40:00.000Z', 0), 21 + 40 / 60);
  assert.equal(localHourOf('2026-08-30T21:40:00.000Z', -300), 16 + 40 / 60);
});

check('a origem às 18h põe a noite inteira num bloco contínuo', () => {
  const onset = axisPosition('2026-08-30T21:40:00.000Z', BXL); // 23h40
  const wake = axisPosition('2026-08-31T05:00:00.000Z', BXL); // 07h00
  assert.ok(Math.abs(onset - 5.667) < 0.001, `onset ${onset}`);
  assert.equal(wake, 13);
  assert.ok(wake > onset, 'a barra corre para baixo, sem partir na virada do dia');
});

check('posição do eixo fica sempre em [0,24)', () => {
  for (const iso of [
    '2026-08-30T16:00:00.000Z', // 18h local — a própria origem
    '2026-08-30T15:59:00.000Z', // um minuto antes
    '2026-08-31T09:00:00.000Z', // 11h local
  ]) {
    const p = axisPosition(iso, BXL);
    assert.ok(p >= 0 && p < 24, `${iso} → ${p}`);
  }
  assert.equal(axisPosition('2026-08-30T16:00:00.000Z', BXL), 0, 'a origem é o zero');
});

check('a vigília fura a barra, não a encurta', () => {
  const bar = toTimingBar(
    period({
      awakenings: [{ from: '2026-08-31T01:00:00.000Z', to: '2026-08-31T01:30:00.000Z' }],
    }),
  );
  assert.equal(bar.wake, 13, 'a hora de acordar não muda por causa do buraco');
  assert.equal(bar.holes?.length, 1);
  const hole = bar.holes![0];
  assert.ok(hole.from > bar.onset && hole.to < bar.wake, 'o buraco cai dentro da barra');
});

check('holes distingue "não reporta" de "não houve"', () => {
  assert.equal(toTimingBar(period({ awakenings: null })).holes, null);
  assert.deepEqual(toTimingBar(period({ awakenings: [] })).holes, []);
});

check('axisRange enquadra as barras em vez de desenhar 24h para mostrar 8', () => {
  const r = axisRange([toTimingBar(period())]);
  assert.ok(r.from > 5 && r.from < 5.7, `from ${r.from}`);
  assert.ok(r.to > 13 && r.to <= 14, `to ${r.to}`);
  assert.ok(r.to - r.from < 9, 'a janela acompanha a noite, não o eixo inteiro');
});

check('axisRange sem barras utilizáveis cai num default legível', () => {
  const r = axisRange([]);
  assert.deepEqual(r, { from: 4, to: 16 }, '22h → 10h');
});

check('clockLabel escreve a hora no fuso do período, não do aparelho', () => {
  assert.equal(clockLabel('2026-08-30T21:40:00.000Z', 120), '23:40');
  assert.equal(clockLabel('2026-08-30T21:40:00.000Z', 0), '21:40');
  assert.equal(clockLabel('2026-08-31T05:05:00.000Z', 120), '07:05', 'zero à esquerda');
});

check('midpoint é o meio da noite, no fuso do período', () => {
  // 23h40 → 07h00 = 7h20; o meio cai às 03h20.
  assert.ok(Math.abs(midpointHour(period()) - (3 + 20 / 60)) < 0.001);
});

/* ─────────── A regra do in_bed_at degenerado (o caso Garmin) ─────────── */

check('latência nula quando a fonte não mede a hora de deitar', () => {
  assert.equal(latencyMin(period()), null);
  assert.equal(efficiency(period()), null);
});

check('latência real: deitou 22h00, apagou 23h40 → 100 min', () => {
  const p = period({
    inBedAt: '2026-08-30T20:00:00.000Z',
    inBedEnd: '2026-08-31T05:00:00.000Z',
  });
  assert.equal(latencyMin(p), 100);
  // 7,333 h dormindo em 9 h de cama.
  assert.ok(Math.abs(efficiency(p)! - 7.333 / 9) < 1e-9);
});

check('bedtimeMeasured é a única voz sobre mostrar ou não a hora de deitar', () => {
  assert.equal(bedtimeMeasured(period()), false, 'sem janela INBED');
  assert.equal(
    bedtimeMeasured(
      period({ inBedAt: '2026-08-30T21:39:30.000Z', inBedEnd: '2026-08-31T05:12:00.000Z' }),
    ),
    false,
    'janela crua gravada, mas abre junto com o sono — a tela escreve "--:--"',
  );
  assert.equal(
    bedtimeMeasured(
      period({ inBedAt: '2026-08-30T20:00:00.000Z', inBedEnd: '2026-08-31T05:00:00.000Z' }),
    ),
    true,
    '100 min antes de apagar — isso é deitar',
  );
});

check('janela de cama que abre junto com o sono não vira latência', () => {
  // O caso Garmin: INBED começa 30 s antes do onset, em 41 de 42 noites.
  const p = period({
    inBedAt: '2026-08-30T21:39:30.000Z',
    inBedEnd: '2026-08-31T05:12:00.000Z',
  });
  assert.ok(latencyMin(p)! < MIN_LATENCY_MIN, 'abaixo do piso — não é latência');
  const [day] = deriveSleepDays([p]);
  assert.equal(day.extra?.onset, undefined, 'o zero disfarçado não chega ao extra');
  assert.ok(day.extra?.inbed, 'mas a janela de cama continua sendo gravada');
});

/* ───────────────── O formato do extra é contrato ───────────────── */

check('deriveSleepDays reproduz o formato que os consumidores já leem', () => {
  const [day] = deriveSleepDays([
    period({
      stages: { deep: 1.783, rem: 1.911, core: 4.183, unspecified: 0.433 },
      inBedAt: '2026-08-30T20:00:00.000Z',
      inBedEnd: '2026-08-31T05:00:00.000Z',
      asleepH: 8.311,
    }),
  ]);

  assert.equal(day.day, '2026-08-31');
  assert.equal(day.value, 8.311);
  assert.equal(day.count, 1);
  assert.deepEqual(Object.keys(day.extra!).sort(), [
    'core',
    'deep',
    'inbed',
    'onset',
    'rem',
    'unspecified',
  ]);
  assert.equal(day.extra!.deep, 1.783);
  assert.equal(day.extra!.inbed, 9, 'inbed em HORAS, como hoje');
  assert.ok(Math.abs(day.extra!.onset - 100 / 60) < 1e-9, 'onset em HORAS, como hoje');
});

check('extra é null quando a fonte não dá estágio nem cama — não {}', () => {
  const [day] = deriveSleepDays([period()]);
  assert.equal(day.extra, null, '{} seria um estado novo que ninguém espera');
});

check('dois períodos no mesmo dia somam e contam', () => {
  const [day] = deriveSleepDays([
    period({ asleepH: 4.5, stages: { core: 4.5 } }),
    period({
      onsetAt: '2026-08-31T12:00:00.000Z',
      wakeAt: '2026-08-31T14:00:00.000Z',
      asleepH: 2,
      stages: { core: 2 },
    }),
  ]);
  assert.equal(day.value, 6.5);
  assert.equal(day.count, 2);
  assert.equal(day.extra!.core, 6.5);
});

check('dias saem ordenados, para o upsert em lote ser determinístico', () => {
  const days = deriveSleepDays([
    period({ wakeDay: '2026-08-31' }),
    period({ wakeDay: '2026-08-29' }),
    period({ wakeDay: '2026-08-30' }),
  ]);
  assert.deepEqual(
    days.map((d) => d.day),
    ['2026-08-29', '2026-08-30', '2026-08-31'],
  );
});

/* ───────────────── Os três estados de vigília ───────────────── */

check('awakeMinOf distingue "não sei" de "não houve"', () => {
  assert.equal(awakeMinOf(period({ awakenings: null })), null, 'a fonte não reporta');
  assert.equal(awakeMinOf(period({ awakenings: [] })), 0, 'reporta, e não houve');
  assert.equal(
    awakeMinOf(
      period({
        awakenings: [{ from: '2026-08-31T01:00:00.000Z', to: '2026-08-31T01:45:00.000Z' }],
      }),
    ),
    45,
  );
});

check('a era Garmin inteira lê como "unreported", não como zero despertares', () => {
  const clock = buildAwakeClock([period(), period({ wakeDay: '2026-08-30' })]);
  assert.equal(clock.coverage, 'unreported');
  assert.equal(clock.nightsReporting, 0);
  assert.equal(clock.nightsTotal, 2);
  assert.equal(peakAwakeWindow(clock), null, 'sem dado não há padrão a anunciar');
});

check('reportar e não haver despertar é um estado próprio', () => {
  const clock = buildAwakeClock([period({ awakenings: [] })]);
  assert.equal(clock.coverage, 'none');
  assert.equal(clock.nightsReporting, 1);
  assert.equal(clock.peakNights, 0);
});

/* ───────────────── O relógio de vigília ───────────────── */

check('despertar no mesmo horário em noites diferentes empilha na mesma faixa', () => {
  // Três noites acordando por volta das 03h05 locais (01h05 UTC).
  const nights = ['2026-08-29', '2026-08-30', '2026-08-31'].map((wakeDay, i) =>
    period({
      wakeDay,
      onsetAt: `2026-08-${28 + i}T21:40:00.000Z`,
      awakenings: [
        { from: `2026-08-${29 + i}T01:05:00.000Z`, to: `2026-08-${29 + i}T01:20:00.000Z` },
      ],
    }),
  );
  const clock = buildAwakeClock(nights);
  assert.equal(clock.coverage, 'reported');
  assert.equal(clock.nightsReporting, 3);

  const peak = peakAwakeWindow(clock)!;
  assert.equal(peak.nights, 3, 'as três noites coincidem na mesma faixa');
  assert.equal(peak.density, 1);
  // 03h05 local com origem 18h = 9,08 h de eixo; faixa de 15 min → [9, 9.25).
  assert.equal(peak.from, 9);
});

check('uma noite só não vira padrão', () => {
  const clock = buildAwakeClock([
    period({
      awakenings: [{ from: '2026-08-31T01:05:00.000Z', to: '2026-08-31T01:20:00.000Z' }],
    }),
  ]);
  assert.equal(clock.coverage, 'reported');
  assert.equal(peakAwakeWindow(clock), null, 'piso de 2 noites — um pico de uma é uma noite');
});

check('um despertar longo pinta todas as faixas que atravessa, mas conta uma vez cada', () => {
  // 2 h acordado = 8 faixas de 15 min, todas com nights = 1.
  const clock = buildAwakeClock([
    period({
      awakenings: [{ from: '2026-08-31T01:00:00.000Z', to: '2026-08-31T03:00:00.000Z' }],
    }),
  ]);
  const tocadas = clock.bins.filter((b) => b.nights > 0);
  assert.equal(tocadas.length, 8);
  assert.equal(clock.peakNights, 1, 'uma noite longa não domina o gráfico');
});

check('awakeSeries deixa buraco onde a fonte não reporta, não zero', () => {
  const s = awakeSeries([
    period({ wakeDay: '2026-08-29', awakenings: [] }),
    period({ wakeDay: '2026-08-30', awakenings: null }),
    period({
      wakeDay: '2026-08-31',
      awakenings: [{ from: '2026-08-31T01:00:00.000Z', to: '2026-08-31T01:30:00.000Z' }],
    }),
  ]);
  assert.deepEqual(s, [
    { wakeDay: '2026-08-29', awakeMin: 0 },
    { wakeDay: '2026-08-30', awakeMin: null },
    { wakeDay: '2026-08-31', awakeMin: 30 },
  ]);
});

/* ───────────────── Noites reais do banco ───────────────── */

check('as três últimas noites de agosto derivam o que está gravado hoje', () => {
  // Valores lidos de health_daily em 04/09/2026.
  const reais = [
    { wakeDay: '2026-08-29', asleepH: 8.55, deep: 1.8, rem: 2.133, core: 4.616, inbed: 8.583 },
    { wakeDay: '2026-08-30', asleepH: 8.311, deep: 1.783, rem: 1.911, core: 4.183, inbed: 8.044 },
    { wakeDay: '2026-08-31', asleepH: 6.866, deep: 1.367, rem: 1.55, core: 3.949, inbed: 7.066 },
  ].map((n) =>
    period({
      wakeDay: n.wakeDay,
      asleepH: n.asleepH,
      stages: { deep: n.deep, rem: n.rem, core: n.core },
      // Janela de cama do Garmin: abre junto com o sono e sobra depois de acordar.
      inBedAt: '2026-08-30T21:40:00.000Z',
      inBedEnd: new Date(
        new Date('2026-08-30T21:40:00.000Z').getTime() + n.inbed * 3_600_000,
      ).toISOString(),
    }),
  );

  const days = deriveSleepDays(reais);
  assert.equal(days.length, 3);
  assert.equal(days[2].value, 6.866);
  assert.ok(Math.abs(days[1].extra!.inbed - 8.044) < 1e-9);
  for (const d of days) {
    assert.equal(d.extra!.onset, undefined, 'o Garmin não produz latência — 41 de 42 noites');
  }
});

/* ───────────────── Regularidade (não exibida no V1) ───────────────── */

/** N noites idênticas, começando em `startUtc` e repetindo a cada 24 h. */
function nights(n: number, onsetH: number, durH: number, day0 = 24): SleepPeriod[] {
  return Array.from({ length: n }, (_, i) => {
    const onset = Date.UTC(2026, 7, day0 + i, onsetH, 0, 0);
    return period({
      onsetAt: new Date(onset).toISOString(),
      wakeAt: new Date(onset + durH * 3_600_000).toISOString(),
      wakeDay: `2026-08-${String(day0 + i + 1).padStart(2, '0')}`,
      asleepH: durH,
      awakenings: [],
    });
  });
}

check('série sono/vigília trata a vigília como acordado', () => {
  const s = sleepWakeSeries([
    period({
      onsetAt: '2026-08-30T21:00:00.000Z',
      wakeAt: '2026-08-30T23:00:00.000Z',
      awakenings: [{ from: '2026-08-30T22:00:00.000Z', to: '2026-08-30T22:30:00.000Z' }],
    }),
  ])!;
  const dormindo = s.asleep.reduce((a, b) => a + b, 0);
  assert.equal(dormindo, 90, '2 h de janela menos 30 min acordado');
});

check('SRI de fase perfeita satura em 100', () => {
  assert.equal(sleepRegularityIndex(nights(7, 22, 8)), 100);
});

check('SRI cai quando o horário dança', () => {
  const irregular = nights(7, 22, 8).map((p, i) => {
    if (i % 2 === 0) return p;
    const onset = new Date(p.onsetAt).getTime() + 4 * 3_600_000; // 4 h mais tarde
    return {
      ...p,
      onsetAt: new Date(onset).toISOString(),
      wakeAt: new Date(onset + 8 * 3_600_000).toISOString(),
    };
  });
  const sri = sleepRegularityIndex(irregular)!;
  assert.ok(sri < 100, `dançou, então não é 100 — deu ${sri.toFixed(1)}`);
  assert.ok(sri > -100 && sri <= 100, 'dentro da escala publicada');
});

check('SRI exige mais de 24 h de registro', () => {
  assert.equal(sleepRegularityIndex(nights(1, 22, 8)), null);
  assert.equal(sleepRegularityIndex([]), null);
});

check('jetlag social precisa de dia livre e dia de semana', () => {
  // Onsets 24–26/08/2026 acordam ter/qua/qui — nenhum dia livre na janela.
  assert.equal(socialJetlag(nights(3, 22, 8)), null);
});

check('dormir mais tarde no fim de semana vira SJL', () => {
  // O tipo do dia sai do `wakeAt`, não do `onsetAt`: quem deita na sexta acorda
  // no sábado, e é o sábado que conta como dia livre.
  const semana = nights(4, 22, 8, 24); // deita 22h, acorda ter–sex
  const fds = nights(2, 25, 9, 28); // deita 01h, acorda sáb–dom
  const sj = socialJetlag([...semana, ...fds])!;
  assert.equal(sj.workNights, 4);
  assert.equal(sj.freeNights, 2);
  assert.equal(sj.msw, 4, 'meio da noite às 04h nos dias de semana');
  assert.equal(sj.msf, 7.5, 'e às 07h30 no fim de semana');
  assert.ok(Math.abs(sj.sjl - 3.5) < 1e-9, `SJL = 3h30, deu ${sj.sjl.toFixed(2)}`);
  assert.equal(sj.msfsc, 7, 'a correção desconta o excesso de sono do fim de semana');
});

console.log(`\n${passed} testes passaram.`);
