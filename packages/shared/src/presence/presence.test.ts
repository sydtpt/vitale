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
import { rollup, segundosDoDiaLocal, segundosNaoCobertos } from './rollup';
import { blocoDePresenca, MIN_DIAS_PARA_MEDIANA, MIN_DIAS_PARA_TAXA } from './retro';

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

// -------------------------------------------------------------------- rollup

const COLADO = colar(parear(EVENTOS).visitas);
const LINHAS = rollup(COLADO, { tz: FIXTURE_TZ, janela: JANELA });

check('a invariante fecha nos 25 dias do log real', () => {
  const dias = [...new Set(LINHAS.map((l) => l.day))];
  assert.equal(dias.length, 25);
  for (const d of dias) {
    const presenca = LINHAS.filter((l) => l.day === d).reduce((s, l) => s + l.seconds, 0);
    const naoCoberto = segundosNaoCobertos(LINHAS, d, FIXTURE_TZ);
    assert.equal(
      Math.round(presenca + naoCoberto),
      Math.round(segundosDoDiaLocal(d, FIXTURE_TZ)),
      `${d}: presença + fora + não coberto tem de dar o dia`,
    );
  }
});

check('o dia não tem 24 h duas vezes por ano — e o rollup mede em vez de supor', () => {
  assert.equal(segundosDoDiaLocal('2026-03-29', FIXTURE_TZ), 23 * 3600, 'primavera: 23 h');
  assert.equal(segundosDoDiaLocal('2026-10-25', FIXTURE_TZ), 25 * 3600, 'outono: 25 h');
  assert.equal(segundosDoDiaLocal('2026-09-15', FIXTURE_TZ), 24 * 3600);
});

check('visita que atravessa a meia-noite é dividida, e a chegada conta UMA vez', () => {
  const visitas = [
    {
      placeId: 'casa',
      arrivedAt: '2026-06-01T20:00:00.000Z', // 22h local
      departedAt: '2026-06-02T06:00:00.000Z', // 08h local
      departedSource: 'geofence' as const,
    },
  ];
  const l = rollup(visitas, { tz: 'Europe/Brussels' });
  const d1 = l.find((x) => x.day === '2026-06-01' && x.placeId === 'casa')!;
  const d2 = l.find((x) => x.day === '2026-06-02' && x.placeId === 'casa')!;
  assert.equal(d1.seconds, 2 * 3600, '22h → meia-noite');
  assert.equal(d2.seconds, 8 * 3600, 'meia-noite → 08h');
  assert.equal(d1.arrivals, 1);
  assert.equal(d2.arrivals, 0, 'atravessar a noite não é chegar de novo');
});

check('o lugar nulo é o vão entre visitas, não ausência de dado', () => {
  const visitas = [
    { placeId: 'casa', arrivedAt: '2026-06-01T06:00:00.000Z', departedAt: '2026-06-01T08:00:00.000Z', departedSource: 'geofence' as const },
    { placeId: 'casa', arrivedAt: '2026-06-01T17:00:00.000Z', departedAt: '2026-06-01T20:00:00.000Z', departedSource: 'geofence' as const },
  ];
  const l = rollup(visitas, { tz: 'Europe/Brussels', janela: { inicio: '2026-06-01T06:00:00.000Z', fim: '2026-06-01T20:00:00.000Z' } });
  const fora = l.find((x) => x.placeId === null)!;
  assert.equal(fora.seconds, 9 * 3600, 'as nove horas entre as duas estadias');
  assert.equal(l.reduce((s, x) => s + x.seconds, 0), 14 * 3600, 'a janela inteira');
});

check('a borda estimada aparece no dia em que fechou', () => {
  const p = parear([
    { at: '2026-06-01T06:00:00.000Z', placeId: 'casa', kind: 'enter' },
    { at: '2026-06-01T09:00:00.000Z', placeId: 'trabalho', kind: 'enter' },
  ]);
  const l = rollup(p.visitas, { tz: 'Europe/Brussels' });
  const casa = l.find((x) => x.placeId === 'casa')!;
  assert.equal(casa.inferredEdges, 1, 'a saída de casa foi deduzida da chegada no trabalho');
  assert.equal(l.find((x) => x.placeId === 'trabalho')!.inferredEdges, 0);
});

check('visita em curso é cortada no fim da janela — não se inventa futuro', () => {
  const visitas = [
    { placeId: 'casa', arrivedAt: '2026-06-01T06:00:00.000Z', departedAt: null, departedSource: null },
  ];
  const fim = '2026-06-01T10:00:00.000Z';
  const l = rollup(visitas, { tz: 'Europe/Brussels', janela: { inicio: '2026-06-01T06:00:00.000Z', fim } });
  assert.equal(l.length, 1);
  assert.equal(l[0]!.seconds, 4 * 3600);
});

check('não coberto é grande num dia parcialmente observado, e isso é o ponto', () => {
  const naoCob = segundosNaoCobertos(LINHAS, '2026-09-07', FIXTURE_TZ);
  assert.ok(naoCob > 10 * 3600, `07/09 só foi observado a partir das 13h — ${Math.round(naoCob / 3600)} h fora da observação`);
});

// --------------------------------------------------------------- o bloco

const DIAS = diasDePresenca(COLADO, { casa: 'casa', tz: FIXTURE_TZ, janela: JANELA });
const BASE = { casa: 'casa', trabalho: 'trabalho', tz: FIXTURE_TZ } as const;

check('o período inteiro, como ele sairia no jornal', () => {
  const b = blocoDePresenca(DIAS, LINHAS, { ...BASE, de: '2026-09-07', ate: '2026-10-01' });
  assert.deepEqual(b.cobertura, { dias: 25, medidos: 23 });
  assert.equal(b.semSair, 3);
  assert.equal(b.saiu, 20);
  assert.equal(b.maiorSequenciaSemSair, 2);
  assert.equal(b.escritorio.dias, 7);
  assert.equal(b.escritorio.porSemana, 2.1, 'híbrido de 2 a 3 dias, medido');
});

check('contar não estima: a semana mantém a manchete, e perde só o que é distribuição', () => {
  const b = blocoDePresenca(DIAS, LINHAS, { ...BASE, de: '2026-09-14', ate: '2026-09-20' });
  assert.equal(b.cobertura.medidos, 7);
  assert.equal(b.semSair, 1, 'a contagem vale numa semana — é a recorrência que ele mais lê');
  assert.equal(b.saiu, 6);
  assert.equal(b.escritorio.dias, 2);
  assert.equal(b.escritorio.medianaH, null, 'duas idas não descrevem uma jornada típica');
  assert.equal(b.escritorio.porSemana, null, 'uma semana não dá taxa semanal');
  assert.ok(b.escritorio.totalH > 0, 'o total continua: somar não estima');
});

check('sem `trabalho` declarado, o escritório é null — nunca zero', () => {
  const b = blocoDePresenca(DIAS, LINHAS, { casa: 'casa', tz: FIXTURE_TZ, de: '2026-09-07', ate: '2026-10-01' });
  assert.equal(b.escritorio.dias, null);
  assert.equal(b.escritorio.medianaH, null);
  assert.deepEqual(b.escritorio.diasDaSemana, []);
});

check('sem sono, as leituras que dependem dele são null — ADR 0054', () => {
  const b = blocoDePresenca(DIAS, LINHAS, { ...BASE, de: '2026-09-07', ate: '2026-10-01' });
  assert.equal(b.noitesFora, null, 'ausência não vira zero');
  assert.equal(b.emCasaAcordadoH, null);
});

check('com sono, a noite sem presença em casa conta como noite fora', () => {
  const b = blocoDePresenca(DIAS, LINHAS, {
    ...BASE,
    de: '2026-09-07',
    ate: '2026-10-01',
    noites: [
      // 19/09: ele saiu às 19h33 e voltou no dia 20 — a única noite fora de verdade.
      { inicio: '2026-09-19T22:00:00.000Z', fim: '2026-09-20T05:00:00.000Z' },
      { inicio: '2026-09-15T22:00:00.000Z', fim: '2026-09-16T05:00:00.000Z' },
    ],
  });
  assert.equal(b.noitesFora, 0, 'as duas noites têm presença em casa no dia — nenhuma é fora');
  assert.ok(b.emCasaAcordadoH !== null && b.emCasaAcordadoH > 0);
});

check('os pisos vêm da escada do Sono, não de invenção local', () => {
  assert.equal(MIN_DIAS_PARA_MEDIANA, 5, 'mesmo espírito de REGULARITY_MIN_NIGHTS');
  assert.equal(MIN_DIAS_PARA_TAXA, 10, 'mesmo espírito de BASELINE_MIN_NIGHTS');
});

console.log(`\n${passed} checagens de presença ok`);
