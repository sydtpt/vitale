/**
 * A regra "de qual bicicleta foi esta pedalada" (ADR 0034).
 *
 * O que estes testes protegem:
 *  1. A fronteira é em DIAS LOCAIS e inclusiva nas duas pontas — a primeira
 *     pedalada da Nuroad foi em 30/05/2026 e tem de cair na Nuroad; a de 29/05,
 *     na antiga. Um `<` no lugar de `<=` move uma pedalada de bike.
 *  2. O override explícito vence a herança, e um override para gear desconhecido
 *     devolve "não sei" — nunca cai na herança em silêncio.
 *  3. Tipo de atividade fora de `activityTypes` não herda (uma corrida não é de
 *     bicicleta nenhuma).
 *  4. Janelas sobrepostas não derrubam nada: vence a vigência mais recente.
 */
import assert from 'node:assert/strict';
import type { Activity, Gear } from '../models';
import {
  activityLocalDate,
  dayBefore,
  gearForActivity,
  gearUsage,
  gearWindowContains,
  isGearOpen,
  planDefaultGear,
} from './assign';

const antiga: Gear = {
  id: 'g-antiga', userId: 'u', kind: 'bike', name: 'Antiga',
  activeFrom: '2025-01-01', activeTo: '2026-05-29', activityTypes: [13],
};
const nuroad: Gear = {
  id: 'g-nuroad', userId: 'u', kind: 'bike', name: 'Cube Nuroad SLX',
  activeFrom: '2026-05-30', activeTo: null, activityTypes: [13],
};
const gears = [antiga, nuroad];

/** Instante local do aparelho às 09:00 do dia — evita depender do fuso da máquina de teste. */
function ride(day: string, over: Partial<Activity> = {}): Activity {
  const start = new Date(`${day}T09:00:00`); // hora local
  return {
    id: `a-${day}`, userId: 'u', activityId: 13, calories: 0,
    startAt: start.toISOString(), endAt: start.toISOString(), durationS: 3600, hasRoute: true,
    distanceM: 30_000,
    ...over,
  };
}

// 1. fronteira inclusiva, em dia local
assert.equal(gearForActivity(gears, ride('2026-05-29'))?.id, 'g-antiga', '29/05 é o último dia da antiga');
assert.equal(gearForActivity(gears, ride('2026-05-30'))?.id, 'g-nuroad', '30/05 é o primeiro dia da Nuroad');
assert.equal(gearForActivity(gears, ride('2025-01-24'))?.id, 'g-antiga', 'a primeira pedalada do histórico');
assert.equal(gearForActivity(gears, ride('2026-08-31'))?.id, 'g-nuroad', 'activeTo nulo = em uso');
assert.equal(gearForActivity(gears, ride('2024-12-31')), undefined, 'antes de qualquer bike');

// o dia local é o que vale — meia-noite e meia local em Bruxelas é o dia anterior em UTC
{
  const start = new Date('2026-05-30T00:30:00'); // local
  assert.equal(activityLocalDate(start.toISOString()), '2026-05-30');
  assert.equal(gearForActivity(gears, ride('2026-05-30', { startAt: start.toISOString() }))?.id, 'g-nuroad');
}

assert.equal(gearWindowContains(antiga, '2026-05-29'), true);
assert.equal(gearWindowContains(antiga, '2026-05-30'), false);
assert.equal(gearWindowContains(nuroad, '2099-01-01'), true);

// 2. override explícito vence; desconhecido não cai na herança
assert.equal(gearForActivity(gears, ride('2026-08-31', { gearId: 'g-antiga' }))?.id, 'g-antiga', 'override vence a data');
assert.equal(gearForActivity(gears, ride('2026-08-31', { gearId: 'g-emprestada' })), undefined, 'override para gear ausente = não sei');

// 3. tipo fora de activityTypes não herda
assert.equal(gearForActivity(gears, ride('2026-08-31', { activityId: 37 })), undefined, 'corrida não é de bicicleta');

// 4. sobreposição: vence a vigência mais recente
{
  const emprestada: Gear = { ...nuroad, id: 'g-emprestada', name: 'Emprestada', activeFrom: '2026-07-01', activeTo: '2026-07-10' };
  assert.equal(gearForActivity([antiga, nuroad, emprestada], ride('2026-07-05'))?.id, 'g-emprestada');
  assert.equal(gearForActivity([antiga, nuroad, emprestada], ride('2026-07-11'))?.id, 'g-nuroad');
}

// uso por gear
{
  const acts = [
    ride('2025-06-01', { distanceM: 40_000 }),
    ride('2026-05-29', { distanceM: 29_100 }),
    ride('2026-05-30', { distanceM: 55_200 }),
    ride('2026-08-31', { distanceM: 5_400 }),
    ride('2026-08-21', { activityId: 37, distanceM: 21_000 }), // corrida: fora
  ];
  const usage = gearUsage(gears, acts);
  const byId = Object.fromEntries(usage.map((u) => [u.gear.id, u]));
  assert.equal(byId['g-antiga']!.count, 2);
  assert.equal(byId['g-antiga']!.distanceM, 69_100);
  assert.equal(byId['g-nuroad']!.count, 2);
  assert.equal(byId['g-nuroad']!.distanceM, 60_600);
  assert.equal(activityLocalDate(byId['g-nuroad']!.firstAt!), '2026-05-30');
  assert.equal(activityLocalDate(byId['g-nuroad']!.lastAt!), '2026-08-31');
  // gear sem atividade sai com 0, não some
  assert.equal(gearUsage([antiga], [ride('2026-08-31')])[0]!.count, 0);
}

// 5. "usar como padrão" = abrir a janela desta e fechar a das outras no dia anterior.
//    É o beat que o cadastro precisa acertar: sem ele, as 126 pedaladas antigas
//    passariam a ter duas donas.
assert.equal(dayBefore('2026-05-30'), '2026-05-29');
assert.equal(dayBefore('2026-01-01'), '2025-12-31', 'vira o ano');
assert.equal(dayBefore('2026-03-01'), '2026-02-28', 'fevereiro de ano comum');
assert.equal(isGearOpen(nuroad), true);
assert.equal(isGearOpen(antiga), false);

{
  // a Nuroad entra em 30/05: a antiga (aberta) teria de fechar em 29/05
  const aberta: Gear = { ...antiga, activeTo: null };
  const nova: Gear = { ...nuroad, activeFrom: '2026-05-30' };
  const changes = planDefaultGear([aberta, nova], 'g-nuroad', '2026-05-30');
  assert.deepEqual(changes, [{ id: 'g-antiga', activeTo: '2026-05-29' }]);
}
{
  // já é a padrão e as outras já estão fechadas: nada a fazer
  assert.deepEqual(planDefaultGear([antiga, nuroad], 'g-nuroad', '2026-09-06'), []);
}
{
  // voltar para a aposentada: ela reabre e a atual fecha ontem
  const changes = planDefaultGear([antiga, nuroad], 'g-antiga', '2026-09-06');
  assert.deepEqual(changes, [
    { id: 'g-antiga', activeTo: null },
    { id: 'g-nuroad', activeTo: '2026-09-05' },
  ]);
}
{
  // não inverter janela: fechar uma bike ANTES de ela ter começado seria fim < início
  const futura: Gear = { ...nuroad, id: 'g-futura', activeFrom: '2026-12-01', activeTo: null };
  const changes = planDefaultGear([futura, antiga], 'g-antiga', '2026-06-01');
  assert.deepEqual(
    changes,
    [{ id: 'g-antiga', activeTo: null }],
    'a antiga reabre; a futura não fecha antes de existir',
  );
}
{
  // alvo já aberto e nada mais a fechar: plano vazio, e a tela não escreve nada
  const changes = planDefaultGear([{ ...antiga, activeTo: null }], 'g-antiga', '2026-06-01');
  assert.deepEqual(changes, []);
}
assert.deepEqual(planDefaultGear([antiga], 'g-inexistente', '2026-09-06'), [], 'id desconhecido não muda nada');

console.log('gear/assign: ok');
