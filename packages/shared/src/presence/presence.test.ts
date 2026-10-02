/**
 * O núcleo da Presença, cobrado contra os 24 dias reais do dono.
 *
 * Cada bloco aqui existe porque o log real derrubou alguma coisa:
 *
 *   - o teto de 16 h aparando **borda medida** fazia as 34 visitas saírem todas com
 *     a saída errada — a primeira execução do fixture pegou;
 *   - o primeiro evento do log é um `exit`, e tratá-lo como anomalia acusava a borda
 *     da janela em vez de um defeito do sensor;
 *   - o mesmo primeiro evento fazia 07/09 contar como "não saiu" **no dia em que o
 *     aparelho viu ele sair** — daí a janela decidir cobertura;
 *   - o limiar de saída não muda nada entre 26 e 64 min, e é isso que torna o 45
 *     seguro. Um fixture inventado concordaria com qualquer número.
 */
import assert from 'node:assert/strict';
import { LOG_24_DIAS, FIXTURE_TZ, type EventoBruto } from './fixture-24-dias';
import { parear, duracaoMin, TETO_ORFA_H, type PresenceEvent } from './eventos';
import { colar, ausencias, ehPassagem, contaComoSaida, COLAGEM_MIN, SAIDA_MIN_PADRAO } from './regras';
import { diasDePresenca, contagemDosDias, diaLocal } from './dias';

let passed = 0;
function check(name: string, fn: () => void): void {
  fn();
  passed += 1;
  console.log(`  ok ${name}`);
}

const evento = ([at, placeId, kind, redundant]: EventoBruto): PresenceEvent => ({
  at,
  placeId,
  kind,
  redundant,
});

const EVENTOS = LOG_24_DIAS.map(evento);
const JANELA = (() => {
  const t = EVENTOS.filter((e) => !e.redundant)
    .map((e) => e.at)
    .sort();
  return { inicio: t[0]!, fim: t[t.length - 1]! };
})();

// ---------------------------------------------------------------- pareamento

check('relatório de estado nunca vira visita — são 298 contra 74', () => {
  const p = parear(EVENTOS);
  assert.equal(p.relatorios, 298);
  assert.equal(EVENTOS.length - p.relatorios, 74);
  assert.equal(p.visitas.length, 34);
});

check('a borda MEDIDA não é aparada pelo teto de 16 h', () => {
  // 07/09 14:33 → 08/09 09:28 são 18h55 em casa, e o `exit` é um fato observado.
  // A versão que aparava os dois devolvia 06:33 — uma saída que ninguém viu.
  const p = parear(EVENTOS);
  const primeira = p.visitas.find((v) => v.placeId === 'casa')!;
  assert.equal(primeira.departedSource, 'geofence');
  assert.ok(duracaoMin(primeira)! > TETO_ORFA_H * 60, 'visita medida pode passar do teto');
});

check('o teto só apara borda inferida', () => {
  const p = parear([
    { at: '2026-01-01T00:00:00.000Z', placeId: 'casa', kind: 'enter' },
    { at: '2026-01-02T20:00:00.000Z', placeId: 'trabalho', kind: 'enter' },
  ]);
  const casa = p.visitas[0]!;
  assert.equal(casa.departedSource, 'inferred');
  assert.equal(duracaoMin(casa), TETO_ORFA_H * 60);
});

check('o primeiro evento do log não é anomalia — é a borda da janela', () => {
  const p = parear(EVENTOS);
  assert.ok(
    !p.anomalias.some((a) => a.ate === JANELA.inicio),
    'o `exit` que abre o log não acusa chegada perdida',
  );
});

check('as 6 anomalias reais do aparelho, 5 delas chegadas perdidas', () => {
  const p = parear(EVENTOS);
  assert.equal(p.anomalias.length, 6);
  assert.equal(p.anomalias.filter((a) => a.kind === 'chegada-perdida').length, 5);
  assert.equal(p.anomalias.filter((a) => a.kind === 'saida-perdida').length, 1);
  // 17/09 sozinho produz três: é o dia que fabrica uma ausência parecendo noite fora.
  assert.equal(p.anomalias.filter((a) => a.de.startsWith('2026-09-17')).length, 3);
});

check('dois `enter` seguidos no mesmo lugar não abrem visita nova', () => {
  const p = parear([
    { at: '2026-01-01T10:00:00.000Z', placeId: 'casa', kind: 'enter' },
    { at: '2026-01-01T11:00:00.000Z', placeId: 'casa', kind: 'enter' },
    { at: '2026-01-01T12:00:00.000Z', placeId: 'casa', kind: 'exit' },
  ]);
  assert.equal(p.visitas.length, 1);
  assert.equal(p.anomalias[0]!.kind, 'saida-perdida');
  assert.equal(duracaoMin(p.visitas[0]!), 120);
});

check('`exit` sem visita aberta não inventa presença', () => {
  const p = parear([
    { at: '2026-01-01T10:00:00.000Z', placeId: 'casa', kind: 'enter' },
    { at: '2026-01-01T11:00:00.000Z', placeId: 'casa', kind: 'exit' },
    { at: '2026-01-01T15:00:00.000Z', placeId: 'casa', kind: 'exit' },
  ]);
  assert.equal(p.visitas.length, 1, 'nenhuma visita é fabricada para a chegada perdida');
  assert.equal(p.anomalias.length, 1);
  assert.equal(p.anomalias[0]!.kind, 'chegada-perdida');
});

check('visita em curso tem duração nula, não zero', () => {
  const p = parear([{ at: '2026-01-01T10:00:00.000Z', placeId: 'casa', kind: 'enter' }]);
  assert.equal(p.visitas[0]!.departedAt, null);
  assert.equal(duracaoMin(p.visitas[0]!), null);
});

// -------------------------------------------------------------------- regras

check('a colagem funde 3 estadias no log real', () => {
  const p = parear(EVENTOS);
  assert.equal(colar(p.visitas).length, p.visitas.length - 3);
});

check('colagem não emenda visita em curso', () => {
  const visitas = [
    { placeId: 'casa', arrivedAt: '2026-01-01T10:00:00.000Z', departedAt: null, departedSource: null },
    { placeId: 'casa', arrivedAt: '2026-01-01T10:05:00.000Z', departedAt: '2026-01-01T11:00:00.000Z', departedSource: 'geofence' as const },
  ];
  assert.equal(colar(visitas).length, 2);
});

check('passagem é curta e fechada — em curso não é passagem', () => {
  const curta = { placeId: 'x', arrivedAt: '2026-01-01T10:00:00.000Z', departedAt: '2026-01-01T10:05:00.000Z', departedSource: 'geofence' as const };
  const aberta = { placeId: 'x', arrivedAt: '2026-01-01T10:00:00.000Z', departedAt: null, departedSource: null };
  assert.equal(ehPassagem(curta), true);
  assert.equal(ehPassagem(aberta), false);
});

check('o BURACO da distribuição: nada entre 26 e 64 minutos em 24 dias', () => {
  const aus = ausencias(colar(parear(EVENTOS).visitas), 'casa');
  assert.equal(aus.length, 23);
  const mins = aus.map((a) => a.minutos).sort((a, b) => a - b);
  assert.ok(mins[0]! > COLAGEM_MIN, 'a colagem já comeu tudo abaixo de 20 min');
  assert.ok(mins[0]! < 30, `a menor sobrevivente tem ${Math.round(mins[0]!)} min`);
  assert.ok(mins[1]! > 60, `a seguinte salta para ${Math.round(mins[1]!)} min`);
  assert.equal(
    mins.filter((m) => m > 26 && m < 64).length,
    0,
    'é este vazio que torna o limiar de 45 seguro',
  );
});

check('entre 26 e 64 min o limiar não muda resultado nenhum', () => {
  const colado = colar(parear(EVENTOS).visitas);
  const base = { casa: 'casa', tz: FIXTURE_TZ, janela: JANELA };
  const em = (limiarMin: number) => contagemDosDias(diasDePresenca(colado, { ...base, limiarMin }));
  const padrao = em(SAIDA_MIN_PADRAO);
  for (const lim of [20, 30, 45, 60]) assert.deepEqual(em(lim), padrao, `limiar ${lim}`);
  assert.notDeepEqual(em(90), padrao, 'acima de ~90 min o botão passa a mexer');
});

check('contaComoSaida usa o limiar, não a opinião', () => {
  const a = { placeId: 'casa', saiuEm: 'x', voltouEm: 'y', minutos: 44 };
  assert.equal(contaComoSaida(a), false);
  assert.equal(contaComoSaida(a, 30), true);
});

// ---------------------------------------------------------------------- dias

check('a contagemDosDias real: 3 dias sem sair em 23 cobertos', () => {
  const colado = colar(parear(EVENTOS).visitas);
  const dias = diasDePresenca(colado, { casa: 'casa', tz: FIXTURE_TZ, janela: JANELA });
  const m = contagemDosDias(dias);
  assert.deepEqual(m, { semSair: 3, saiu: 20, semCobertura: 2, maiorSequencia: 2 });
  assert.equal(m.semSair + m.saiu + m.semCobertura, dias.length);
});

check('a borda da janela é sem-cobertura, não "não saiu"', () => {
  const colado = colar(parear(EVENTOS).visitas);
  const dias = diasDePresenca(colado, { casa: 'casa', tz: FIXTURE_TZ, janela: JANELA });
  // 07/09 abre com um `exit`: ele SAIU naquele dia, e a observação começou depois.
  assert.equal(dias[0]!.dia, '2026-09-07');
  assert.equal(dias[0]!.estado, 'sem-cobertura');
  assert.equal(dias[dias.length - 1]!.estado, 'sem-cobertura');
});

check('sem janela declarada, nenhum dia vira sem-cobertura', () => {
  const colado = colar(parear(EVENTOS).visitas);
  const dias = diasDePresenca(colado, { casa: 'casa', tz: FIXTURE_TZ });
  assert.equal(dias.filter((d) => d.estado === 'sem-cobertura').length, 0);
});

check('buraco de cobertura interrompe a sequência em vez de emendá-la', () => {
  const m = contagemDosDias([
    { dia: '2026-01-01', estado: 'nao-saiu', saidas: 0, curtas: 0, maiorMin: null },
    { dia: '2026-01-02', estado: 'sem-cobertura', saidas: 0, curtas: 0, maiorMin: null },
    { dia: '2026-01-03', estado: 'nao-saiu', saidas: 0, curtas: 0, maiorMin: null },
  ]);
  assert.equal(m.maiorSequencia, 1, 'emendar afirmaria reclusão que ninguém mediu');
  assert.equal(m.semSair, 2);
});

check('saída curta vive no detalhe do dia, nunca como quarto estado', () => {
  const colado = colar(parear(EVENTOS).visitas);
  const dias = diasDePresenca(colado, { casa: 'casa', tz: FIXTURE_TZ, janela: JANELA });
  const comCurta = dias.filter((d) => d.curtas > 0);
  assert.equal(comCurta.length, 1);
  assert.equal(comCurta[0]!.dia, '2026-09-30');
  assert.equal(comCurta[0]!.estado, 'saiu', 'o estado continua sendo um dos três');
});

check('o dia da ausência é o dia em que ela COMEÇOU', () => {
  const visitas = [
    { placeId: 'casa', arrivedAt: '2026-06-01T08:00:00.000Z', departedAt: '2026-06-01T21:40:00.000Z', departedSource: 'geofence' as const },
    { placeId: 'casa', arrivedAt: '2026-06-02T00:30:00.000Z', departedAt: null, departedSource: null },
  ];
  const dias = diasDePresenca(visitas, { casa: 'casa', tz: 'Europe/Brussels' });
  // 21h40 UTC = 23h40 local em junho: sair à noite é saída daquela noite.
  assert.equal(dias.find((d) => d.dia === '2026-06-01')!.estado, 'saiu');
  assert.equal(dias.find((d) => d.dia === '2026-06-02')!.estado, 'nao-saiu');
});

check('diaLocal usa o fuso do dado, não o de quem lê', () => {
  assert.equal(diaLocal('2026-09-07T22:30:00.000Z', 'Europe/Brussels'), '2026-09-08');
  assert.equal(diaLocal('2026-09-07T22:30:00.000Z', 'UTC'), '2026-09-07');
});

console.log(`\n${passed} checagens de presença ok`);
