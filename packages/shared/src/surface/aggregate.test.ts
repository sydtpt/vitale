/**
 * A visão global do piso — o que estes testes protegem:
 *  1. A janela: 4 semanas são 28 dias INCLUSIVOS terminando hoje; o ano é
 *     calendário; "tudo" não filtra.
 *  2. A soma ignora pedaladas sem piso mas as CONTA — a tela diz "12 de 15 com piso".
 *  3. A legenda funde blocos e pavé num degrau só e só mostra "não especificado"
 *     quando existe.
 *  4. A rampa é monotônica e nunca inventa hex: tudo sai do mix.
 *  5. A estação: o corte é do hemisfério norte, e `surfaceBySeason` devolve só
 *     as estações que a janela CONTÉM — é o que decide se o cartão desenha uma
 *     barra ou quatro colunas.
 */
import assert from 'node:assert/strict';
import type { Activity } from '../models';
import {
  inSurfaceWindow,
  seasonAccessibilityLabel,
  seasonOf,
  summarizeSurface,
  surfaceBySeason,
  surfaceLegend,
  surfaceWindow,
} from './aggregate';
import { surfaceRamp } from './colors';
import { relativeLuminance as luminance } from '../theme/color';

function ride(day: string, mix?: Partial<Activity['surfaceMix']>): Activity {
  const start = new Date(`${day}T09:00:00`);
  const base = { liso: 0, blocos: 0, pave: 0, cascalho: 0, terra: 0, desconhecido: 0, inferido: 0, total: 0 };
  const m = mix ? { ...base, ...mix } : undefined;
  if (m) m.total = m.liso + m.blocos + m.pave + m.cascalho + m.terra + m.desconhecido;
  return {
    id: `a-${day}`, userId: 'u', activityId: 13, calories: 0, startAt: start.toISOString(), endAt: start.toISOString(),
    durationS: 3600, hasRoute: true, distanceM: 30_000, surfaceMix: m,
  };
}

const today = new Date('2026-09-06T12:00:00');

// 1. janela
{
  const w = surfaceWindow('4s', today);
  assert.equal(w.from, '2026-08-10');
  assert.equal(w.to, '2026-09-06');
  assert.equal(inSurfaceWindow(ride('2026-08-10'), w), true, 'o primeiro dia entra');
  assert.equal(inSurfaceWindow(ride('2026-08-09'), w), false, 'o dia anterior não');
  assert.equal(surfaceWindow('12s', today).from, '2026-06-15');
  assert.deepEqual(surfaceWindow('ano', today), { from: '2026-01-01', to: '2026-12-31', label: '2026' });
  assert.equal(inSurfaceWindow(ride('2025-01-24'), surfaceWindow('tudo', today)), true);
}

// 2. soma conta as sem piso
{
  const acts = [
    ride('2026-09-01', { liso: 8000, cascalho: 2000 }),
    ride('2026-09-02', { liso: 5000, pave: 1000, blocos: 1000, terra: 3000 }),
    ride('2026-09-03'), // sem piso ainda
    ride('2026-07-01', { terra: 9000 }), // fora das 4 semanas
  ];
  const s = summarizeSurface(acts, surfaceWindow('4s', today));
  assert.equal(s.count, 3);
  assert.equal(s.withSurface, 2);
  assert.equal(s.mix.total, 20_000);
  assert.ok(Math.abs(s.pavedShare - 15_000 / 20_000) < 1e-9);
  assert.ok(Math.abs(s.offroadShare - 5_000 / 20_000) < 1e-9);
  assert.equal(s.mostOffroad?.activity.id, 'a-2026-09-02', 'a mais fora do asfalto é a de 30%');
  const all = summarizeSurface(acts, surfaceWindow('tudo', today));
  assert.equal(all.mix.terra, 12_000);
}

// 3. legenda
{
  const rows = surfaceLegend({ liso: 100, blocos: 30, pave: 20, cascalho: 40, terra: 10, desconhecido: 0, inferido: 0, total: 200 });
  assert.deepEqual(rows.map((r) => r.key), ['liso', 'blocos', 'cascalho', 'terra']);
  assert.equal(rows[1]!.meters, 50, 'blocos + pavé');
  const withUnknown = surfaceLegend({ liso: 100, blocos: 0, pave: 0, cascalho: 0, terra: 0, desconhecido: 25, inferido: 25, total: 125 });
  assert.equal(withUnknown[withUnknown.length - 1]!.key, 'desconhecido');
}

// 4. rampa monotônica nos dois esquemas (Orbe: acento laranja, superfícies e tintas do tema)
{
  const light = surfaceRamp('light', '#F25C2B', '#FFFFFF', '#1F1B16', '#C6BCAE');
  const L = [light.liso, light.blocos, light.cascalho, light.terra].map(luminance);
  for (let i = 1; i < L.length; i++) assert.ok(L[i]! < L[i - 1]!, `claro: degrau ${i} mais escuro que o anterior`);
  const dark = surfaceRamp('dark', '#F25C2B', '#1E1A15', '#F6EFE6', '#5C554B');
  const D = [dark.liso, dark.blocos, dark.cascalho, dark.terra].map(luminance);
  for (let i = 1; i < D.length; i++) assert.ok(D[i]! < D[i - 1]!, `escuro: degrau ${i} mais escuro que o anterior`);
  assert.ok([light, dark].every((r) => Object.values(r).every((c) => /^#[0-9A-Fa-f]{6}$/.test(c))), 'toda cor é hex derivado');
}

// 5. estação: o corte, o recorte da janela e a frase do VoiceOver
{
  // As fronteiras que erram fácil: dezembro é inverno (não outono) e maio é
  // primavera (não verão).
  assert.equal(seasonOf('2026-12-15T09:00:00'), 'inverno');
  assert.equal(seasonOf('2026-01-15T09:00:00'), 'inverno');
  assert.equal(seasonOf('2026-02-28T09:00:00'), 'inverno');
  assert.equal(seasonOf('2026-03-01T09:00:00'), 'primavera');
  assert.equal(seasonOf('2026-05-31T09:00:00'), 'primavera');
  assert.equal(seasonOf('2026-06-01T09:00:00'), 'verao');
  assert.equal(seasonOf('2026-08-31T09:00:00'), 'verao');
  assert.equal(seasonOf('2026-09-01T09:00:00'), 'outono');
  assert.equal(seasonOf('2026-11-30T09:00:00'), 'outono');

  const acts: Activity[] = [
    ride('2026-01-10', { liso: 9_000, cascalho: 1_000 }), // inverno
    ride('2026-01-20', { liso: 9_000, cascalho: 1_000 }), // inverno
    ride('2026-04-10', { liso: 6_000, cascalho: 4_000 }), // primavera
    ride('2026-07-10', { liso: 8_000, terra: 2_000 }), // verão
  ];

  // "tudo" contém as três estações que existem — outono não entra, porque não
  // há pedalada nele. Barra que não tem dado não vira coluna vazia.
  const todas = surfaceBySeason(acts, surfaceWindow('tudo'));
  assert.deepEqual(todas.map((b) => b.season), ['inverno', 'primavera', 'verao']);
  assert.equal(todas[0]!.rides, 2, 'inverno soma as duas pedaladas');
  assert.equal(todas[0]!.mix.liso, 18_000);
  assert.ok(Math.abs(todas[1]!.offroadShare - 0.4) < 1e-9, 'primavera 40% fora do asfalto');

  // A regra que decide a forma do cartão: uma janela curta contém UMA estação,
  // e aí quem chama desenha a barra única de sempre.
  const jan = surfaceBySeason(acts, { from: '2026-01-01', to: '2026-01-31', label: 'jan' });
  assert.equal(jan.length, 1, 'janela dentro de uma estação devolve uma só');

  // Pedalada sem piso calculado não entra na barra — a coluna afirma o que mediu.
  const comSemPiso = surfaceBySeason([...acts, ride('2026-01-25')], surfaceWindow('tudo'));
  assert.equal(comSemPiso[0]!.rides, 2, 'sem surfaceMix não conta na estação');

  // A alternativa acessível ao gráfico (T2.3): a coluna se lê em voz alta.
  const frase = seasonAccessibilityLabel(todas[1]!);
  assert.match(frase, /^Primavera, 1 pedalada\./, 'singular quando é uma só');
  assert.match(frase, /60% asfalto/);
  assert.match(frase, /40% cascalho/);
  assert.match(seasonAccessibilityLabel(todas[0]!), /^Inverno, 2 pedaladas\./);
}

console.log('surface/aggregate: ok');
