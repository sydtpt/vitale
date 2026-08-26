/**
 * Testes do esquema solar e da tabela de fusos — puros, sem framework:
 *   cd packages/shared && npx tsx src/astro/solar-scheme.test.ts
 *
 * O que estes testes protegem é diferente do que `sun.test.ts` protege. Lá o
 * risco é errar a conta; aqui é errar a **decisão** — devolver claro à
 * meia-noite, deixar o app sem próxima virada, ou chutar uma coordenada para um
 * fuso que não é lugar nenhum.
 */
import assert from 'node:assert/strict';
import { msUntilSolarChange, solarSchemeAt } from './solar-scheme';
import { coordsForTimeZone } from './timezone-coords';
import { TIMEZONE_ALIASES_DATA, TIMEZONE_COORDS_DATA } from './timezone-coords.data';
import { solarAltitude, CIVIL_TWILIGHT_DEG } from './sun';

let passed = 0;
function check(name: string, fn: () => void): void {
  fn();
  passed += 1;
  console.log(`  ok ${name}`);
}

/* ─────────────────────── Tabela de fusos ─────────────────────── */

check('fuso — os canônicos que o app mais vê têm coordenada plausível', () => {
  // Conferidos contra o `zone.tab`: se o gerador quebrar o parse do ISO 6709,
  // é aqui que aparece, e não numa tela escurecendo na hora errada.
  const esperado: Record<string, [number, number]> = {
    'Europe/Brussels': [50.83, 4.33],
    'America/New_York': [40.71, -74.01],
    'America/Sao_Paulo': [-23.53, -46.62],
    'Asia/Tokyo': [35.65, 139.75],
    'Australia/Sydney': [-33.87, 151.21],
    'Atlantic/Reykjavik': [64.15, -21.85],
  };
  for (const [zona, [lat, lon]] of Object.entries(esperado)) {
    const c = coordsForTimeZone(zona);
    assert.ok(c, `${zona}: sem coordenada`);
    assert.ok(Math.abs(c.lat - lat) < 0.02, `${zona}: lat ${c.lat} ≠ ${lat}`);
    assert.ok(Math.abs(c.lon - lon) < 0.02, `${zona}: lon ${c.lon} ≠ ${lon}`);
  }
});

check('fuso — apelidos antigos resolvem para o mesmo lugar do canônico', () => {
  // Qual desses nomes o aparelho devolve depende da versão do ICU embutida
  // nele, não de escolha de ninguém. Um `Asia/Calcutta` sem entrada derrubaria
  // o esquema solar para `system` calado, na Índia inteira.
  const pares: [string, string][] = [
    ['Asia/Calcutta', 'Asia/Kolkata'],
    ['US/Eastern', 'America/New_York'],
    ['Europe/Kiev', 'Europe/Kyiv'],
    ['Asia/Saigon', 'Asia/Ho_Chi_Minh'],
    ['America/Buenos_Aires', 'America/Argentina/Buenos_Aires'],
    ['Brazil/East', 'America/Sao_Paulo'],
  ];
  for (const [apelido, canonico] of pares) {
    assert.deepEqual(
      coordsForTimeZone(apelido),
      coordsForTimeZone(canonico),
      `${apelido} deveria cair em ${canonico}`,
    );
  }
});

check('fuso — offset puro devolve null em vez de chutar o meridiano', () => {
  // `Etc/GMT+3` não é um lugar. Chutar latitude zero daria noites de 12 h o ano
  // todo para quem pode estar em qualquer lugar do planeta; `null` faz o app
  // cair no esquema do sistema, que ao menos é uma escolha de alguém.
  for (const zona of ['UTC', 'Etc/GMT', 'Etc/GMT+3', 'Etc/UTC', 'Factory']) {
    assert.equal(coordsForTimeZone(zona), null, `${zona} não deveria ter coordenada`);
  }
  assert.equal(coordsForTimeZone(''), null);
  assert.equal(coordsForTimeZone(undefined), null);
  assert.equal(coordsForTimeZone('Nao/Existe'), null);
});

check('fuso — a tabela cobre todos os fusos canônicos que o ICU conhece', () => {
  // A barreira que impede a tabela de envelhecer calada: fuso novo no tzdata do
  // Node e ausente daqui vira uma região inteira sem esquema solar, sem erro.
  const conhecidos: string[] =
    typeof Intl.supportedValuesOf === 'function' ? Intl.supportedValuesOf('timeZone') : [];
  const faltando = conhecidos.filter((z) => !coordsForTimeZone(z));
  assert.deepEqual(
    faltando,
    [],
    `fusos sem coordenada: ${faltando.join(', ')}\n` +
      `  Rode: node packages/shared/scripts/build-timezone-coords.mjs`,
  );
});

check('fuso — o arquivo gerado está bem formado', () => {
  for (const linha of TIMEZONE_COORDS_DATA.split('\n')) {
    const partes = linha.split(' ');
    assert.equal(partes.length, 3, `linha malformada: "${linha}"`);
    const lat = Number(partes[1]);
    const lon = Number(partes[2]);
    assert.ok(lat >= -90 && lat <= 90, `latitude fora de faixa em "${linha}"`);
    assert.ok(lon >= -180 && lon <= 180, `longitude fora de faixa em "${linha}"`);
  }
  for (const linha of TIMEZONE_ALIASES_DATA.split('\n')) {
    const [apelido, alvo] = linha.split(' ');
    assert.ok(alvo, `apelido sem alvo: "${linha}"`);
    assert.ok(coordsForTimeZone(alvo), `${apelido} aponta para ${alvo}, que não tem coordenada`);
  }
});

/* ─────────────────────── Decisão do esquema ─────────────────────── */

const BRUXELAS = { lat: 50.85, lon: 4.35 };
const LONGYEARBYEN = { lat: 78.22, lon: 15.63 };

check('esquema — claro ao meio-dia e escuro à meia-noite', () => {
  // Bruxelas em agosto: meio-dia solar 11h44 UTC, crepúsculo 19h17 UTC.
  assert.equal(solarSchemeAt(new Date('2026-08-26T11:44:00Z'), BRUXELAS).scheme, 'light');
  assert.equal(solarSchemeAt(new Date('2026-08-26T23:44:00Z'), BRUXELAS).scheme, 'dark');
});

check('esquema — a virada usa o crepúsculo civil, não o pôr do sol', () => {
  // O pôr do sol em Bruxelas em 26/08 é 18h41 UTC. Às 19h00 o sol já se pôs e o
  // app tem que continuar CLARO — é a diferença que a escolha do limiar faz, e
  // é ela que este teste trava.
  assert.equal(solarSchemeAt(new Date('2026-08-26T19:00:00Z'), BRUXELAS).scheme, 'light');
  assert.equal(solarSchemeAt(new Date('2026-08-26T19:30:00Z'), BRUXELAS).scheme, 'dark');
});

check('esquema — o `until` bate com a virada de verdade', () => {
  for (const hora of ['00:30', '06:00', '11:44', '19:00', '22:00']) {
    const agora = new Date(`2026-08-26T${hora}:00Z`);
    const estado = solarSchemeAt(agora, BRUXELAS);
    assert.ok(estado.until, `${hora}: sem próxima virada`);
    assert.ok(estado.until > agora, `${hora}: virada no passado`);
    // Um minuto depois da virada o esquema tem que ser o outro.
    const depois = solarSchemeAt(new Date(estado.until.getTime() + 60_000), BRUXELAS);
    assert.notEqual(depois.scheme, estado.scheme, `${hora}: o esquema não virou no until`);
  }
});

check('esquema — sol da meia-noite fica claro, sem virada e sem caso especial', () => {
  const estado = solarSchemeAt(new Date('2026-06-21T23:00:00Z'), LONGYEARBYEN);
  assert.equal(estado.scheme, 'light');
  assert.equal(estado.until, null);
  assert.ok(solarAltitude(new Date('2026-06-21T23:00:00Z'), LONGYEARBYEN) > CIVIL_TWILIGHT_DEG);
});

check('esquema — noite polar fica escura o dia todo', () => {
  for (const hora of ['00:00', '11:00', '18:00']) {
    const estado = solarSchemeAt(new Date(`2026-12-21T${hora}:00Z`), LONGYEARBYEN);
    assert.equal(estado.scheme, 'dark', `${hora} deveria ser escuro em Longyearbyen`);
    assert.equal(estado.until, null);
  }
});

check('esquema — o dia inteiro de Bruxelas vira exatamente duas vezes', () => {
  // Varre 24 h de minuto em minuto e conta as trocas. Mais de duas seria
  // instabilidade na borda; menos, um dia que não vira.
  const inicio = new Date('2026-08-26T00:00:00Z').getTime();
  let anterior = solarSchemeAt(new Date(inicio), BRUXELAS).scheme;
  let trocas = 0;
  for (let min = 1; min < 24 * 60; min += 1) {
    const s = solarSchemeAt(new Date(inicio + min * 60_000), BRUXELAS).scheme;
    if (s !== anterior) trocas += 1;
    anterior = s;
  }
  assert.equal(trocas, 2, `${trocas} trocas em 24 h`);
});

/* ─────────────────────── Agendamento ─────────────────────── */

check('agendamento — espera até a virada, com folga', () => {
  const agora = new Date('2026-08-26T11:44:00Z');
  const estado = solarSchemeAt(agora, BRUXELAS);
  const ms = msUntilSolarChange(estado, agora);
  assert.ok(ms > 0);
  // A virada é às 19h17; daqui são ~7h33, acima do teto de 6 h.
  assert.equal(ms, 6 * 3_600_000);
});

check('agendamento — nunca agenda para daqui a nada nem para o passado', () => {
  const agora = new Date('2026-08-26T19:17:00Z');
  const estado = solarSchemeAt(agora, BRUXELAS);
  assert.ok(msUntilSolarChange(estado, agora) >= 60_000);
  // Virada já passada (relógio acertado para frente): ainda assim, nada de
  // timer negativo, que no `setTimeout` viraria disparo imediato em laço.
  const passado = { ...estado, until: new Date(agora.getTime() - 5 * 60_000) };
  assert.ok(msUntilSolarChange(passado, agora) >= 60_000);
});

check('agendamento — dia polar reconsulta por tempo, não por evento', () => {
  const agora = new Date('2026-06-21T12:00:00Z');
  const estado = solarSchemeAt(agora, LONGYEARBYEN);
  assert.equal(estado.until, null);
  assert.equal(msUntilSolarChange(estado, agora), 6 * 3_600_000);
});

check('agendamento — sem estado nenhum ainda reconsulta', () => {
  assert.equal(msUntilSolarChange(null), 6 * 3_600_000);
});

console.log(`\n${passed} testes passaram.`);
