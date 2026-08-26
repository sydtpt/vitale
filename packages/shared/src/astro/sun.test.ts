/**
 * Testes de posição do Sol — puros, sem framework. Rodar com:
 *   cd packages/shared && npx tsx src/astro/sun.test.ts
 *
 * Os valores de referência vieram da efeméride do **USNO** (Astronomical
 * Applications Department da Marinha dos EUA, `aa.usno.navy.mil/api/rstt`),
 * consultada em 26/08/2026 com `tz=0`. São a única fonte de verdade aqui.
 *
 * A escolha da fonte não foi indiferente: a primeira referência usada foi o
 * `sunrise-sunset.org`, e contra ele o erro chegava a 2min18s — sempre no
 * nascer e no pôr, quase nunca no crepúsculo, o que é um padrão estranho
 * demais para ser erro de quem calcula. Conferindo os dois contra o USNO, é o
 * `sunrise-sunset.org` que se afasta: ele implementa o algoritmo simplificado
 * do *Almanac for Computers*, de 1990. Duas fontes que discordam entre si não
 * viram uma média — vira uma pergunta de qual delas é a efeméride.
 *
 * O USNO publica ao **minuto**, então a tolerância de 60 s abaixo já inclui o
 * arredondamento dele. O erro medido de fato aparece no fim da execução.
 */
import assert from 'node:assert/strict';
import {
  CIVIL_TWILIGHT_DEG,
  SUNRISE_DEG,
  nextSolarCrossing,
  solarAltitude,
  solarEvents,
  type Coords,
} from './sun';

let passed = 0;
function check(name: string, fn: () => void): void {
  fn();
  passed += 1;
  console.log(`  ok ${name}`);
}

const BRUXELAS: Coords = { lat: 50.85, lon: 4.35 };
const NOVA_YORK: Coords = { lat: 40.71, lon: -74.01 };
const SAO_PAULO: Coords = { lat: -23.55, lon: -46.63 };
const TROMSO: Coords = { lat: 69.65, lon: 18.96 };
const SINGAPURA: Coords = { lat: 1.35, lon: 103.82 };
const SYDNEY: Coords = { lat: -33.87, lon: 151.21 };
const LONGYEARBYEN: Coords = { lat: 78.22, lon: 15.63 };

/**
 * Um dia solar conferido. `anchor` é qualquer instante dentro dele — usamos o
 * meio-dia solar do próprio USNO.
 *
 * Longitudes longe de Greenwich espalham um dia solar por **duas** datas UTC:
 * em Singapura o sol nasce dia 25 e se põe dia 26. Por isso cada evento carrega
 * a data inteira em vez de só a hora — foi preciso consultar o USNO nos dois
 * dias para montar cada uma dessas linhas.
 */
interface DiaSolar {
  nome: string;
  coords: Coords;
  anchor: string;
  transit: string;
  rise: string;
  set: string;
  dawn: string;
  dusk: string;
}

const EPHEMERIS: readonly DiaSolar[] = [
  {
    nome: 'Bruxelas — solstício de junho',
    coords: BRUXELAS,
    anchor: '2026-06-21T11:44:00Z',
    transit: '2026-06-21T11:44:00Z',
    rise: '2026-06-21T03:29:00Z',
    set: '2026-06-21T20:00:00Z',
    dawn: '2026-06-21T02:42:00Z',
    dusk: '2026-06-21T20:46:00Z',
  },
  {
    nome: 'Bruxelas — fim de agosto',
    coords: BRUXELAS,
    anchor: '2026-08-26T11:44:00Z',
    transit: '2026-08-26T11:44:00Z',
    rise: '2026-08-26T04:47:00Z',
    set: '2026-08-26T18:41:00Z',
    dawn: '2026-08-26T04:12:00Z',
    dusk: '2026-08-26T19:16:00Z',
  },
  {
    nome: 'Bruxelas — solstício de dezembro',
    coords: BRUXELAS,
    anchor: '2026-12-21T11:41:00Z',
    transit: '2026-12-21T11:41:00Z',
    rise: '2026-12-21T07:43:00Z',
    set: '2026-12-21T15:39:00Z',
    dawn: '2026-12-21T07:03:00Z',
    dusk: '2026-12-21T16:18:00Z',
  },
  {
    nome: 'Nova York — longitude oeste',
    coords: NOVA_YORK,
    anchor: '2026-08-26T16:58:00Z',
    transit: '2026-08-26T16:58:00Z',
    rise: '2026-08-26T10:17:00Z',
    set: '2026-08-26T23:38:00Z',
    dawn: '2026-08-26T09:49:00Z',
    // O USNO do dia 26 também lista um "End Civil Twilight 00:08", e ele é uma
    // armadilha: é o crepúsculo do dia solar **anterior**, que cai no começo
    // daquela data UTC. O que fecha este dia solar está na consulta do dia 27.
    dusk: '2026-08-27T00:06:00Z',
  },
  {
    nome: 'São Paulo — hemisfério sul',
    coords: SAO_PAULO,
    anchor: '2026-08-26T15:08:00Z',
    transit: '2026-08-26T15:08:00Z',
    rise: '2026-08-26T09:23:00Z',
    set: '2026-08-26T20:54:00Z',
    dawn: '2026-08-26T09:00:00Z',
    dusk: '2026-08-26T21:17:00Z',
  },
  {
    nome: 'Tromsø — 69°N, sol raso',
    coords: TROMSO,
    anchor: '2026-09-25T10:36:00Z',
    transit: '2026-09-25T10:36:00Z',
    rise: '2026-09-25T04:36:00Z',
    set: '2026-09-25T16:34:00Z',
    dawn: '2026-09-25T03:35:00Z',
    dusk: '2026-09-25T17:34:00Z',
  },
  {
    nome: 'Singapura — equador, dia solar em duas datas',
    coords: SINGAPURA,
    anchor: '2026-08-26T05:07:00Z',
    transit: '2026-08-26T05:07:00Z',
    rise: '2026-08-25T23:02:00Z',
    set: '2026-08-26T11:11:00Z',
    dawn: '2026-08-25T22:41:00Z',
    dusk: '2026-08-26T11:32:00Z',
  },
  {
    nome: 'Sydney — inverno austral',
    coords: SYDNEY,
    anchor: '2026-06-21T01:57:00Z',
    transit: '2026-06-21T01:57:00Z',
    rise: '2026-06-20T21:00:00Z',
    set: '2026-06-21T06:54:00Z',
    dawn: '2026-06-20T20:32:00Z',
    dusk: '2026-06-21T07:22:00Z',
  },
  {
    nome: 'Sydney — verão austral',
    coords: SYDNEY,
    anchor: '2026-12-21T01:53:00Z',
    transit: '2026-12-21T01:53:00Z',
    rise: '2026-12-20T18:41:00Z',
    set: '2026-12-21T09:05:00Z',
    dawn: '2026-12-20T18:11:00Z',
    dusk: '2026-12-21T09:34:00Z',
  },
];

/** Tolerância: o USNO publica ao minuto, então 30 s já saem do arredondamento. */
const TOLERANCIA_S = 60;

let piorErro = 0;
let piorCaso = '';

function confere(nome: string, got: Date | null, want: string): void {
  assert.ok(got, `${nome}: evento não calculado`);
  const dif = Math.abs(got.getTime() - new Date(want).getTime()) / 1000;
  if (dif > piorErro) {
    piorErro = dif;
    piorCaso = nome;
  }
  assert.ok(
    dif <= TOLERANCIA_S,
    `${nome}: ${got.toISOString()} vs USNO ${want} — ${dif.toFixed(0)} s de diferença`,
  );
}

for (const dia of EPHEMERIS) {
  check(`efeméride — ${dia.nome}`, () => {
    const anchor = new Date(dia.anchor);
    const sol = solarEvents(anchor, dia.coords, SUNRISE_DEG);
    const crep = solarEvents(anchor, dia.coords, CIVIL_TWILIGHT_DEG);
    assert.equal(sol.polar, false, `${dia.nome}: não deveria ser polar`);
    confere(`${dia.nome} · meio-dia solar`, sol.transit, dia.transit);
    confere(`${dia.nome} · nascer`, sol.rise, dia.rise);
    confere(`${dia.nome} · pôr`, sol.set, dia.set);
    confere(`${dia.nome} · alvorada civil`, crep.rise, dia.dawn);
    confere(`${dia.nome} · crepúsculo civil`, crep.set, dia.dusk);
  });
}

/* ─────────────────────── Dia e noite polares ─────────────────────── */

check('polar — Longyearbyen em junho não tem pôr do sol', () => {
  const e = solarEvents(new Date('2026-06-21T11:00:00Z'), LONGYEARBYEN, SUNRISE_DEG);
  assert.equal(e.polar, true);
  assert.equal(e.rise, null);
  assert.equal(e.set, null);
  // O USNO diz "continuously above the Horizon": à meia-noite local o sol ainda
  // está acima. É exatamente o caso que quebraria um app que decide o esquema
  // pela ausência de nascer do sol.
  assert.ok(solarAltitude(new Date('2026-06-21T23:00:00Z'), LONGYEARBYEN) > 0);
});

check('polar — Longyearbyen em dezembro não tem nascer do sol', () => {
  const e = solarEvents(new Date('2026-12-21T11:00:00Z'), LONGYEARBYEN, SUNRISE_DEG);
  assert.equal(e.polar, true);
  // "continuously below the Horizon": nem no meio-dia solar o sol aparece.
  assert.ok(solarAltitude(e.transit, LONGYEARBYEN) < 0);
});

check('polar — nextSolarCrossing devolve null em vez de inventar um horário', () => {
  assert.equal(
    nextSolarCrossing(new Date('2026-06-21T11:00:00Z'), LONGYEARBYEN, SUNRISE_DEG),
    null,
  );
});

/* ─────────────────────── Altitude ─────────────────────── */

check('altitude — máxima no trânsito bate com 90° − |lat − δ|', () => {
  // No solstício de junho a declinação do sol é +23,44°.
  const e = solarEvents(new Date('2026-06-21T11:44:00Z'), BRUXELAS);
  const alt = solarAltitude(e.transit, BRUXELAS);
  const esperado = 90 - Math.abs(BRUXELAS.lat - 23.44);
  assert.ok(
    Math.abs(alt - esperado) < 0.1,
    `altitude no trânsito ${alt.toFixed(2)}° vs ${esperado.toFixed(2)}° esperados`,
  );
});

check('altitude — cruza o limiar exatamente nos eventos calculados', () => {
  // A checagem que amarra as duas metades do módulo: o instante que
  // `solarEvents` devolve tem que ser o instante em que `solarAltitude` cruza
  // o limiar. Se as duas contas divergirem, o app troca de tema num horário e
  // mostra outro na tela.
  for (const dia of EPHEMERIS) {
    const { rise, set } = solarEvents(new Date(dia.anchor), dia.coords, CIVIL_TWILIGHT_DEG);
    for (const evento of [rise, set]) {
      assert.ok(evento);
      const alt = solarAltitude(evento, dia.coords);
      assert.ok(
        Math.abs(alt - CIVIL_TWILIGHT_DEG) < 0.05,
        `${dia.nome}: no evento a altitude é ${alt.toFixed(3)}°, não ${CIVIL_TWILIGHT_DEG}°`,
      );
    }
  }
});

/* ─────────────────────── Próxima virada ─────────────────────── */

check('nextSolarCrossing — sempre no futuro e dentro de ~um dia', () => {
  for (const dia of EPHEMERIS) {
    for (const hora of [0, 5, 11, 17, 23]) {
      const agora = new Date(new Date(dia.anchor).setUTCHours(hora, 7, 0, 0));
      const prox = nextSolarCrossing(agora, dia.coords, CIVIL_TWILIGHT_DEG);
      assert.ok(prox, `${dia.nome} às ${hora}h: sem próxima virada`);
      assert.ok(prox > agora, `${dia.nome} às ${hora}h: virada no passado`);
      const horas = (prox.getTime() - agora.getTime()) / 3_600_000;
      assert.ok(horas < 25, `${dia.nome} às ${hora}h: virada só em ${horas.toFixed(1)} h`);
    }
  }
});

check('nextSolarCrossing — o estado realmente muda ao atravessar a virada', () => {
  // Um minuto antes e um minuto depois têm que cair em lados opostos do limiar.
  // É isto que garante que agendar um timer para a virada acorda o app num
  // instante em que ele tem algo a fazer.
  for (const dia of EPHEMERIS) {
    const agora = new Date(dia.anchor);
    const prox = nextSolarCrossing(agora, dia.coords, CIVIL_TWILIGHT_DEG)!;
    const antes = solarAltitude(new Date(prox.getTime() - 60_000), dia.coords);
    const depois = solarAltitude(new Date(prox.getTime() + 60_000), dia.coords);
    assert.ok(
      antes > CIVIL_TWILIGHT_DEG !== depois > CIVIL_TWILIGHT_DEG,
      `${dia.nome}: a altitude não muda de lado na virada (${antes.toFixed(2)}° → ${depois.toFixed(2)}°)`,
    );
  }
});

check('crepúsculo civil dura mais que o instante do pôr do sol', () => {
  // A razão de o esquema `solar` usar −6° e não 0: o app tem que continuar
  // claro por um bom tempo depois de o sol sumir. Em Bruxelas, no verão, isso
  // vale mais de 40 minutos.
  const anchor = new Date('2026-06-21T11:44:00Z');
  const sol = solarEvents(anchor, BRUXELAS, SUNRISE_DEG);
  const crep = solarEvents(anchor, BRUXELAS, CIVIL_TWILIGHT_DEG);
  const folgaMin = (crep.set!.getTime() - sol.set!.getTime()) / 60_000;
  assert.ok(folgaMin > 40, `só ${folgaMin.toFixed(0)} min de folga no verão de Bruxelas`);
});

console.log(`\n${passed} testes passaram.`);
console.log(
  `Erro máximo contra a efeméride do USNO: ${piorErro.toFixed(0)} s (${piorCaso}).`,
);
