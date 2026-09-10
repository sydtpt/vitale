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
  daylightHours,
  meanDaylightHours,
  nextSolarCrossing,
  resetDaylightMemo,
  solarAltitude,
  solarEvents,
  type Coords,
} from './sun';
import {
  COORDENADA_DA_LUZ, LIMIAR_DIAS_CURTOS_H, LIMIAR_DIAS_LONGOS_H, estacaoDaLuz,
} from './casa';

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

/*
 * ── HORAS DE LUZ, E A ESTAÇÃO QUE A REVISTA LÊ DELAS (Story 1.6) ──
 *
 * O núcleo abaixo passou por três rodadas de revisão numa tentativa anterior e
 * foi reconstruído dela. O que caiu naquela tentativa não foi a astronomia: foi
 * pôr as horas no pacote como NÚMERO. A revista agora lê só a ESTAÇÃO — e é a
 * estação de cada mês que esta suíte publica e cobra, nunca a de um mês só.
 */

const segundos = (h: number) => h * 3600;
const LUZ = COORDENADA_DA_LUZ;
const ANOS = [2023, 2024, 2025, 2026, 2027] as const;

/** Primeiro e último dia de um mês, `YYYY-MM-DD`. */
function mes(ano: number, m: number): readonly [string, string] {
  const mm = String(m).padStart(2, '0');
  const ultimo = new Date(Date.UTC(ano, m, 0)).getUTCDate();
  return [`${ano}-${mm}-01`, `${ano}-${mm}-${String(ultimo).padStart(2, '0')}`];
}

check('luz — valor conhecido: o dia mais longo de Bruxelas bate com o almanaque', () => {
  // USNO 2026-06-21: nascer 03:29Z, pôr 20:00Z ⇒ 16 h 31 min.
  const h = daylightHours('2026-06-21', BRUXELAS);
  assert.ok(
    Math.abs(segundos(h) - segundos(16 + 31 / 60)) <= TOLERANCIA_S,
    `${h.toFixed(4)} h contra 16h31m do USNO`,
  );
});

check('luz — a duração bate com a efeméride nos dias solares da tabela', () => {
  // `set − rise` é diferença de dois valores arredondados ao minuto pelo USNO:
  // carrega até 60 s de arredondamento puro, então a folga é o dobro da de um
  // evento só.
  for (const dia of EPHEMERIS) {
    const esperado = (new Date(dia.set).getTime() - new Date(dia.rise).getTime()) / 3_600_000;
    const got = daylightHours(dia.transit.slice(0, 10), dia.coords);
    assert.ok(
      Math.abs(segundos(got) - segundos(esperado)) <= TOLERANCIA_S * 2,
      `${dia.nome}: ${got.toFixed(4)} h contra ${esperado.toFixed(4)} h do USNO`,
    );
  }
});

check('luz — o limiar é o do almanaque; o crepúsculo daria ~93 min a mais', () => {
  const anchor = new Date('2026-06-21T12:00:00Z');
  const sol = solarEvents(anchor, BRUXELAS, SUNRISE_DEG);
  const crep = solarEvents(anchor, BRUXELAS, CIVIL_TWILIGHT_DEG);
  const dSol = (sol.set!.getTime() - sol.rise!.getTime()) / 60_000;
  const dCrep = (crep.set!.getTime() - crep.rise!.getTime()) / 60_000;
  assert.ok(dCrep - dSol > 85 && dCrep - dSol < 100, `${(dCrep - dSol).toFixed(1)} min de diferença`);
  assert.ok(Math.abs(daylightHours('2026-06-21', BRUXELAS) * 60 - dSol) < 1);
});

check('luz — dia e noite polares têm resposta, não exceção', () => {
  assert.equal(daylightHours('2026-06-21', LONGYEARBYEN), 24, 'sol de meia-noite é 24 h de luz');
  assert.equal(daylightHours('2026-12-21', LONGYEARBYEN), 0, 'noite polar é 0, não NaN');
  assert.equal(meanDaylightHours('2026-06-01', '2026-06-30', LONGYEARBYEN), 24);
});

check('luz — data torta e coordenada fora do globo devolvem NaN, e não sujam o memo', () => {
  assert.ok(Number.isNaN(daylightHours('2025-02-29', LUZ)), '29/02 de ano comum não rola para março');
  assert.ok(!Number.isNaN(daylightHours('2024-02-29', LUZ)), '2024 é bissexto de verdade');
  assert.ok(Number.isNaN(daylightHours('nao-e-data', LUZ)));
  assert.ok(Number.isNaN(meanDaylightHours('2026-08-31', '2026-08-01', LUZ)), 'fim antes do início');
  assert.ok(Number.isNaN(daylightHours('2026-08-15', { lat: Number.NaN, lon: 0 })));
  assert.ok(Number.isNaN(daylightHours('2026-08-15', { lat: 200, lon: 0 })));
  assert.ok(Number.isNaN(daylightHours('2026-08-15', { lat: 50, lon: 364.35 })), 'longitude fora do globo');
});

check('luz — a duração nunca sai de [0, 24], nem junto do círculo polar', () => {
  // Pontos em que o refinamento de nascer e pôr prende eventos de ciclos
  // vizinhos e, sem a guarda, devolve um dia impossível — achados pela revisão.
  // Uma versão anterior deste teste varria uma grade em lon 0 que nunca passava
  // por nenhum deles: a guarda podia ser apagada com a suíte verde.
  //
  // A guarda PRENDE, não CONSERTA: onde o valor bruto passa de 24, a resposta
  // certa costuma estar abaixo (23,79 h num caso medido), e a guarda devolve 24.
  // Isso é erro da efeméride perto do círculo polar, anterior a esta story, e a
  // coordenada da revista (50,8° N) nunca chega perto.
  const pontos: Array<[string, Coords]> = [
    ['2026-05-27', { lat: 67.75, lon: 4.35 }],
    ['2026-07-28', { lat: 70.25, lon: 0 }],
    ['2026-05-19', { lat: -71, lon: 0 }],
    ['2026-12-07', { lat: -66.5, lon: -60 }],
    ['2024-07-05', { lat: 66.5, lon: -170 }],
  ];
  for (const [dia, c] of pontos) {
    const h = daylightHours(dia, c);
    assert.ok(h >= 0 && h <= 24, `${c.lat}°/${c.lon}° em ${dia}: ${h} h`);
  }
});

check('luz — a coordenada é a constante, congelada, e não uma leitura de aparelho', () => {
  // A AD-10 inteira. `COORDENADA_DA_LUZ = deviceCoords()` seria avaliado uma vez
  // no import e passaria no teste de fuso, que só muda o TZ depois; é o valor
  // literal que o denuncia. E congelada, porque o barril a exporta.
  assert.deepEqual({ ...COORDENADA_DA_LUZ }, { lat: 50.8, lon: 4.35 });
  assert.ok(Object.isFrozen(COORDENADA_DA_LUZ), 'um consumidor poderia mudar a estação de toda edição');
});

check('luz — INVARIÂNCIA DE FUSO: o hospedeiro não entra na conta', () => {
  // A promessa da AD-10: o script de backfill e o iPhone podem estar em fusos
  // diferentes e têm que produzir a MESMA edição. A entrada é `YYYY-MM-DD`
  // justamente para isso ser estrutural.
  const tzOriginal = process.env.TZ;
  const fusos = ['UTC', 'Pacific/Kiritimati', 'Pacific/Midway', 'Asia/Tokyo', 'America/Sao_Paulo'];
  const leituras: string[] = [];
  try {
    for (const tz of fusos) {
      process.env.TZ = tz;
      resetDaylightMemo();
      const estacoes = ANOS.flatMap((a) =>
        Array.from({ length: 12 }, (_, i) => estacaoDaLuz(...mes(a, i + 1))));
      // As SEMANAS também. Um deslocamento de um dia não muda a estação de mês
      // nem de trimestre nenhum de 2023 a 2027 — abril fica a 0,19 h do limiar —,
      // mas muda a de semanas: a revisão interpretou as datas em hora local e
      // quatro semanas trocaram de estação entre UTC e Bruxelas, com este teste
      // verde porque só olhava meses. A tela abre na semana.
      const semanas: Array<string | null> = [];
      for (let s = Date.UTC(2023, 0, 2); s <= Date.UTC(2027, 11, 27); s += 7 * 86_400_000) {
        semanas.push(estacaoDaLuz(
          new Date(s).toISOString().slice(0, 10),
          new Date(s + 6 * 86_400_000).toISOString().slice(0, 10),
        ));
      }
      leituras.push(`${daylightHours('2026-08-15', LUZ)}|${estacoes.join(',')}|${semanas.join(',')}`);
    }
  } finally {
    if (tzOriginal == null) delete process.env.TZ;
    else process.env.TZ = tzOriginal;
  }
  assert.equal(new Set(leituras).size, 1, 'o fuso do processo mudou a luz ou a estação de algum mês');
});

check('luz — INVARIÂNCIA DE ORDEM: o memo não carrega a resposta de outro ano', () => {
  // Fevereiro é o caso: 2024 é bissexto, 2023 e 2026 não. Uma chave sem o ano
  // devolveria o fevereiro que tivesse sido calculado primeiro.
  const fev = (ano: number, ultimo: number) =>
    meanDaylightHours(`${ano}-02-01`, `${ano}-02-${ultimo}`, LUZ);
  resetDaylightMemo();
  const direta = [fev(2024, 29), fev(2023, 28), fev(2026, 28)];
  resetDaylightMemo();
  const inversa = [fev(2026, 28), fev(2023, 28), fev(2024, 29)];
  assert.deepEqual([...direta].reverse(), inversa, 'a ordem de cálculo mudou o número');
  for (const [i, [ano, ultimo]] of ([[2024, 29], [2023, 28], [2026, 28]] as const).entries()) {
    resetDaylightMemo();
    assert.equal(fev(ano, ultimo), direta[i], `fevereiro de ${ano} depende de quem veio antes`);
  }
  // Os três são distintos — se fossem iguais, o teste acima não provaria nada.
  assert.equal(new Set(direta).size, 3);
});

check('luz — a LONGITUDE está na chave do memo, e ela não é enfeite', () => {
  // A medição física com o memo LIMPO entre as chamadas: uma chave sem longitude
  // mediria zero aqui e concluiria que a longitude não importa.
  const norte = { lat: 65, lon: 0 };
  const oposto = { lat: 65, lon: 180 };
  resetDaylightMemo();
  const a = daylightHours('2026-08-15', norte);
  resetDaylightMemo();
  const b = daylightHours('2026-08-15', oposto);
  const difS = Math.abs(segundos(a) - segundos(b));
  assert.ok(difS > 100, `a 65° N dois meridianos opostos diferem ${difS.toFixed(0)} s`);
  // Agora sem limpar: o memo tem que devolver as duas respostas, não uma.
  resetDaylightMemo();
  assert.equal(daylightHours('2026-08-15', norte), a);
  assert.equal(daylightHours('2026-08-15', oposto), b, 'o memo confundiu dois lugares na mesma latitude');
  console.log(`     · a 65° N a longitude vale ${difS.toFixed(0)} s de luz`);
});

check('luz — os LIMIARES são a derivação que casa.ts escreve, e não um número solto', () => {
  // `casa.ts` fixa os limiares para não pagar 365 efemérides no import. Se a
  // coordenada mudar e os números não, é aqui que reprova.
  let min = Infinity;
  let max = -Infinity;
  for (let t = Date.UTC(2025, 0, 1, 12); t <= Date.UTC(2025, 11, 31, 12); t += 86_400_000) {
    const h = daylightHours(new Date(t).toISOString().slice(0, 10), LUZ);
    min = Math.min(min, h);
    max = Math.max(max, h);
  }
  const terco = (max - min) / 3;
  assert.ok(Math.abs(LIMIAR_DIAS_CURTOS_H - (min + terco)) < 0.01, `curtos: ${(min + terco).toFixed(4)}`);
  assert.ok(Math.abs(LIMIAR_DIAS_LONGOS_H - (max - terco)) < 0.01, `longos: ${(max - terco).toFixed(4)}`);
  console.log(
    `     · dia mais curto ${min.toFixed(2)} h · mais longo ${max.toFixed(2)} h`
    + ` · limiares ${LIMIAR_DIAS_CURTOS_H} h e ${LIMIAR_DIAS_LONGOS_H} h`,
  );
});

check('luz — a ESTAÇÃO de cada mês, de 2023 a 2027: publicada, e estável', () => {
  // Nunca um mês só: duas tentativas anteriores passaram verdes ancoradas no
  // agosto, que era o caso sortudo. Aqui são os 60 meses, e a tabela sai na tela
  // para quem quiser discordar ter com o que discordar.
  const nomes = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  const porMes = new Map<number, Set<string>>();
  for (const ano of ANOS) {
    for (let m = 1; m <= 12; m += 1) {
      const e = estacaoDaLuz(...mes(ano, m));
      assert.ok(e != null, `${ano}-${m} sem estação`);
      const s = porMes.get(m) ?? new Set<string>();
      s.add(e);
      porMes.set(m, s);
    }
  }
  // Estável: nenhum mês muda de estação de um ano para o outro.
  for (const [m, s] of porMes) {
    assert.equal(s.size, 1, `${nomes[m - 1]} mudou de estação entre os anos: ${[...s].join('/')}`);
  }
  const de = (m: number) => [...porMes.get(m)!][0];
  // Os DOZE meses presos em valor literal, e não quatro. Com só a matriz da spec
  // (dezembro, junho, março, setembro), ler a estação só do primeiro ou do
  // último dia do intervalo, ou usar a latitude errada, passava a suíte inteira
  // — abril e outubro viravam transição e ninguém via.
  const ESPERADO = [
    'curtos', 'curtos', 'transicao', 'longos', 'longos', 'longos',
    'longos', 'longos', 'transicao', 'curtos', 'curtos', 'curtos',
  ];
  for (let m = 1; m <= 12; m += 1) assert.equal(de(m), ESPERADO[m - 1], nomes[m - 1]);
  const linha = (e: string) => nomes.filter((_, i) => de(i + 1) === e).join(' ');
  console.log(
    `     · curtos: ${linha('curtos')} · transição: ${linha('transicao')} · longos: ${linha('longos')}`,
  );
});

check('luz — os QUATRO trimestres, em valor literal, nos cinco anos', () => {
  // O trimestre aplaina os equinócios: Q1 e Q3 contêm um cada, e a média os
  // leva para curtos e longos. Preso aqui para que a redução do intervalo não
  // mude calada — ler só a última data transformava Q1 e Q3 em transição.
  const tri = (ano: number, q: number): readonly [string, string] => {
    const ultimo = new Date(Date.UTC(ano, q * 3, 0)).getUTCDate();
    return [`${ano}-${String(q * 3 - 2).padStart(2, '0')}-01`, `${ano}-${String(q * 3).padStart(2, '0')}-${ultimo}`];
  };
  for (const ano of ANOS) {
    assert.deepEqual(
      [1, 2, 3, 4].map((q) => estacaoDaLuz(...tri(ano, q))),
      ['curtos', 'longos', 'longos', 'curtos'],
      `trimestres de ${ano}`,
    );
  }
});

check('luz — POR QUE a luz é texto: quantos meses caem em hora inteira', () => {
  // A medição que derrubou a luz como número. Publicada, não cobrada como
  // limite: ela explica a decisão, e é refeita com o memo de chave completa —
  // uma versão anterior deste número saiu de um memo sem ano, e estava errada.
  resetDaylightMemo();
  let inteiros = 0;
  for (const ano of ANOS) {
    for (let m = 1; m <= 12; m += 1) {
      const h = Math.round(meanDaylightHours(...mes(ano, m), LUZ) * 10) / 10;
      if (Number.isInteger(h)) inteiros += 1;
    }
  }
  assert.ok(inteiros > 0, 'se nenhum mês fosse inteiro, o motivo da decisão teria sumido');
  console.log(
    `     · ${inteiros} de 60 meses arredondam para hora inteira com uma casa decimal`
    + ` — é por isso que o pacote não carrega as horas`,
  );
});

console.log(`\n${passed} testes passaram.`);
console.log(
  `Erro máximo contra a efeméride do USNO: ${piorErro.toFixed(0)} s (${piorCaso}).`,
);
