import type { Activity, ActivityRoutePoint, CityMark } from '@vitale/shared';
import {
  activitiesInCountry,
  citiesInCountry,
  countryAt,
  countryForCity,
  countryShares,
  countryStats,
  countryViewport,
  ridesByCountry,
  routesInCountry,
} from '@vitale/shared';

/** Activity mínima para os testes de agregação por país. */
function act(id: string, cities: CityMark[], extra: Partial<Activity> = {}): Activity {
  return {
    id,
    userId: 'u1',
    activityId: 13,
    calories: 0,
    startAt: extra.startAt ?? '2026-01-01T10:00:00Z',
    endAt: extra.endAt ?? '2026-01-01T11:00:00Z',
    durationS: 3600,
    hasRoute: true,
    cities,
    ...extra,
  };
}

const spCity: CityMark = { name: 'São Paulo', state: 'SP', countryCode: 'BR', lat: -23.55, lng: -46.63 };
const brusselsCity: CityMark = { name: 'Bruxelas', countryCode: 'BE', lat: 50.85, lng: 4.35 };

/** Âncoras do rateio cross-border: uma cidade de cada lado, à mesma longitude,
 *  simétricas em torno do paralelo 50.5 — a "fronteira" efetiva dos testes. */
const beAnchor: CityMark = { name: 'Namur', countryCode: 'BE', lat: 51, lng: 4 };
const frAnchor: CityMark = { name: 'Charleville', countryCode: 'FR', lat: 50, lng: 4 };

/** Linha reta N→S em `lng` fixo, de `fromLat` a `toLat`, em passos de 0.1°.
 *  Com dLng = 0 todos os segmentos têm exatamente o mesmo comprimento, então a
 *  fração esperada é só a contagem de segmentos de cada lado. */
function line(fromLat: number, toLat: number, lng = 4): ActivityRoutePoint[] {
  const pts: ActivityRoutePoint[] = [];
  for (let lat = fromLat; lat >= toLat - 1e-9; lat -= 0.1) {
    pts.push({ lat: Number(lat.toFixed(4)), lng });
  }
  return pts;
}

/** Frações do país como a tela calcula, opcionalmente sem rotas carregadas. */
function sharesFor(
  acts: readonly Activity[],
  code: string,
  routes: ReadonlyMap<string, ActivityRoutePoint[]> = new Map(),
) {
  return countryShares(acts, routes, code);
}

describe('countryForCity', () => {
  it('resolve pelo countryCode explícito', () => {
    expect(countryForCity(spCity)).toBe('BR');
    expect(countryForCity(brusselsCity)).toBe('BE');
  });

  it('cai no bbox quando não há countryCode', () => {
    // São Paulo sem código → deve casar com o bbox do Brasil.
    expect(countryForCity({ name: 'São Paulo', lat: -23.55, lng: -46.63 })).toBe('BR');
  });

  it('null fora de qualquer bbox conhecido (Pacífico)', () => {
    expect(countryForCity({ name: 'Meio do oceano', lat: 0, lng: -140 })).toBeNull();
  });
});

describe('ridesByCountry', () => {
  it('conta a atividade em cada país que ela cruza', () => {
    const crossing = act('a1', [brusselsCity, { name: 'Lille', countryCode: 'FR', lat: 50.63, lng: 3.06 }]);
    const summary = ridesByCountry([crossing]);
    const codes = summary.map((s) => s.code).sort();
    expect(codes).toEqual(['BE', 'FR']);
    expect(summary.find((s) => s.code === 'BE')?.rideCount).toBe(1);
    expect(summary.find((s) => s.code === 'FR')?.rideCount).toBe(1);
  });

  it('rateia a distância entre os países cruzados (grade, sem rotas carregadas)', () => {
    const lille: CityMark = { name: 'Lille', countryCode: 'FR', lat: 50.63, lng: 3.06 };
    const crossing = act('a1', [brusselsCity, beAnchor, lille], { distanceM: 90000 }); // 2 BE, 1 FR
    const summary = ridesByCountry([crossing]);
    expect(summary.find((s) => s.code === 'BE')?.distanceM).toBeCloseTo(60000, 3);
    expect(summary.find((s) => s.code === 'FR')?.distanceM).toBeCloseTo(30000, 3);
  });

  it('pedalada de um país só entra com a distância cheia', () => {
    const summary = ridesByCountry([act('a1', [spCity], { distanceM: 42000 })]);
    expect(summary[0].distanceM).toBe(42000);
  });

  it('ignora atividades sem cities', () => {
    const summary = ridesByCountry([act('a1', []), act('a2', [spCity])]);
    expect(summary.length).toBe(1);
    expect(summary[0].code).toBe('BR');
    expect(summary[0].rideCount).toBe(1);
  });

  it('ordena por nº de pedaladas (desc)', () => {
    const summary = ridesByCountry([
      act('a1', [spCity]),
      act('a2', [spCity]),
      act('a3', [brusselsCity]),
    ]);
    expect(summary[0].code).toBe('BR');
    expect(summary[0].rideCount).toBe(2);
    expect(summary[1].code).toBe('BE');
  });
});

describe('citiesInCountry', () => {
  it('dedupe por nome normalizado somando visitCount', () => {
    const cities = citiesInCountry(
      [
        act('a1', [spCity]),
        act('a2', [{ name: 'Sao Paulo', countryCode: 'BR', lat: -23.56, lng: -46.64 }]),
      ],
      'BR',
    );
    expect(cities.length).toBe(1);
    expect(cities[0].visitCount).toBe(2);
  });

  it('lista só cidades do país: exclui cidade de outro país cruzada pela rota', () => {
    // Rota BE→FR: a cidade francesa NÃO deve aparecer na lista da Bélgica.
    const lille: CityMark = { name: 'Lille', countryCode: 'FR', lat: 50.63, lng: 3.06 };
    const cities = citiesInCountry([act('a1', [brusselsCity, lille])], 'BE');
    const names = cities.map((c) => c.name);
    expect(names).toContain('Bruxelas');
    expect(names).not.toContain('Lille');
  });

  it('sem countryCode (marca antiga): cai no bbox do país', () => {
    const legacy: CityMark = { name: 'Gent', lat: 51.05, lng: 3.72 }; // dentro da BE, sem código
    const cities = citiesInCountry([act('a1', [legacy])], 'BE');
    expect(cities.map((c) => c.name)).toContain('Gent');
  });
});

describe('countryViewport', () => {
  const brBbox = { south: -33.75, west: -73.99, north: 5.27, east: -28.84 };

  it('sem rotas → bbox do país inteiro (fallback)', () => {
    const vp = countryViewport('BR', []);
    expect(vp).toEqual([
      [brBbox.south, brBbox.west],
      [brBbox.north, brBbox.east],
    ]);
  });

  it('enquadra às rotas: uma volta em SP fica muito menor que o país todo', () => {
    // Laço bem dentro do BR (~11 km em lat, ~10 km em lng).
    const route: ActivityRoutePoint[] = [
      { lat: -23.5, lng: -46.7 },
      { lat: -23.6, lng: -46.6 },
      { lat: -23.55, lng: -46.65 },
    ];
    const vp = countryViewport('BR', [route])!;
    // Centrado no laço, não no país.
    expect((vp[0][0] + vp[1][0]) / 2).toBeCloseTo(-23.55, 3); // centro lat
    expect((vp[0][1] + vp[1][1]) / 2).toBeCloseTo(-46.65, 3); // centro lng
    // Span uma pequena fração do país (BR ≈ 39° de latitude).
    const latSpan = vp[1][0] - vp[0][0];
    expect(latSpan).toBeGreaterThan(0.1);
    expect(latSpan).toBeLessThan(0.2); // ~0.1° + margem, longe dos ~39° do país
    expect(latSpan).toBeLessThan((brBbox.north - brBbox.south) / 100);
  });

  it('inclui um ponto ~30 km além da borda (dentro do buffer)', () => {
    // Rota com extensão real: um trecho no BR + um ponto ~30 km ao norte da borda.
    const route: ActivityRoutePoint[] = [
      { lat: 4.5, lng: -50 },
      { lat: 5.54, lng: -50 }, // ~30 km além do norte (5.27), dentro do buffer
    ];
    const vp = countryViewport('BR', [route])!;
    expect(vp[1][0]).toBeGreaterThanOrEqual(5.54); // norte alcança o ponto além
  });

  it('ponto a ~200 km fora do buffer é ignorado → país inteiro', () => {
    const route: ActivityRoutePoint[] = [{ lat: 7.07, lng: -50 }]; // ~200 km ao norte
    const vp = countryViewport('BR', [route])!;
    expect(vp[1][0]).toBeCloseTo(brBbox.north, 2); // sem ponto válido → fallback
  });

  it('span mínimo: rota degenerada não faz over-zoom', () => {
    const route: ActivityRoutePoint[] = [
      { lat: -23.55, lng: -46.65 },
      { lat: -23.5501, lng: -46.6501 }, // ~10 m de distância
    ];
    const vp = countryViewport('BR', [route])!;
    // ≥ MIN_VIEWPORT_SPAN_KM (2 km ≈ 0.018°) em latitude.
    expect(vp[1][0] - vp[0][0]).toBeGreaterThan(0.015);
  });

  it('null para país fora do dataset', () => {
    expect(countryViewport('ZZ', [])).toBeNull();
  });
});

describe('activitiesInCountry', () => {
  it('filtra por país e ordena por data desc', () => {
    const rides = activitiesInCountry(
      [
        act('a1', [spCity], { startAt: '2026-01-01T10:00:00Z' }),
        act('a2', [brusselsCity], { startAt: '2026-02-01T10:00:00Z' }),
        act('a3', [spCity], { startAt: '2026-03-01T10:00:00Z' }),
      ],
      'BR',
    );
    expect(rides.map((r) => r.id)).toEqual(['a3', 'a1']);
  });
});

describe('countryShares', () => {
  it('pedalada de um país só → 1, sem precisar da rota', () => {
    const solo = act('a1', [brusselsCity]);
    expect(sharesFor([solo], 'BE').get('a1')).toBe(1);
  });

  it('pedalada que não cruza o país → 0', () => {
    const solo = act('a1', [brusselsCity]);
    expect(sharesFor([solo], 'FR').get('a1')).toBe(0);
  });

  it('cross-border com rota → rateia pela geometria', () => {
    // 51.0 → 50.2 = 8 segmentos iguais; pontos médios 50.95…50.25, dos quais 5
    // ficam mais perto da âncora BE (51) e 3 da FR (50).
    const ride = act('a1', [beAnchor, frAnchor]);
    const routes = new Map([['a1', line(51, 50.2)]]);
    expect(sharesFor([ride], 'BE', routes).get('a1')).toBeCloseTo(0.625, 6);
    expect(sharesFor([ride], 'FR', routes).get('a1')).toBeCloseTo(0.375, 6);
  });

  it('as frações de uma atividade somam 1 (nenhum metro se perde ou duplica)', () => {
    const ride = act('a1', [beAnchor, frAnchor]);
    const routes = new Map([['a1', line(51, 50)]]);
    const be = sharesFor([ride], 'BE', routes).get('a1')!;
    const fr = sharesFor([ride], 'FR', routes).get('a1')!;
    expect(be + fr).toBeCloseTo(1, 6);
    expect(be).toBeCloseTo(0.5, 6); // rota simétrica em torno da fronteira
  });

  it('sem rota (carregando ou sem GPS) → fallback por contagem de cidades', () => {
    const lille: CityMark = { name: 'Lille', countryCode: 'FR', lat: 50.63, lng: 3.06 };
    const ride = act('a1', [brusselsCity, beAnchor, lille]); // 2 BE, 1 FR
    expect(sharesFor([ride], 'BE').get('a1')).toBeCloseTo(2 / 3, 6);
    expect(sharesFor([ride], 'FR').get('a1')).toBeCloseTo(1 / 3, 6);
  });

  it('rota degenerada (comprimento total 0) cai no fallback, não divide por zero', () => {
    const ride = act('a1', [beAnchor, frAnchor]);
    const routes = new Map([['a1', [
      { lat: 50.5, lng: 4 },
      { lat: 50.5, lng: 4 },
      { lat: 50.5, lng: 4 },
    ]]]);
    expect(sharesFor([ride], 'BE', routes).get('a1')).toBeCloseTo(0.5, 6); // 1 de 2 cidades
  });
});

describe('routesInCountry', () => {
  it('recorta a rota cross-border: só o trecho do país vira linha', () => {
    const ride = act('a1', [beAnchor, frAnchor]);
    const routes = new Map([['a1', line(51, 50.2)]]); // 5 segmentos BE + 3 FR

    const be = routesInCountry([ride], routes, 'BE');
    expect(be.length).toBe(1);
    expect(be[0][0].lat).toBeCloseTo(51, 6); // começa no início da rota
    expect(be[0][be[0].length - 1].lat).toBeCloseTo(50.5, 6); // para na fronteira
    expect(be[0].length).toBe(6); // 5 segmentos = 6 pontos

    const fr = routesInCountry([ride], routes, 'FR');
    expect(fr.length).toBe(1);
    expect(fr[0][0].lat).toBeCloseTo(50.5, 6); // retoma exatamente onde a BE parou
    expect(fr[0][fr[0].length - 1].lat).toBeCloseTo(50.2, 6);
  });

  it('rota que sai e volta ao país vira mais de uma linha', () => {
    // Desce da BE até a FR e volta: dois trechos belgas separados por um francês.
    const ride = act('a1', [beAnchor, frAnchor]);
    const there = line(51, 50.2); // desce 51 → 50.2 (cruza a fronteira em 50.5)
    const back = line(51, 50.3).reverse(); // sobe 50.3 → 51, cruzando de volta
    const routes = new Map([['a1', [...there, ...back]]]);

    const be = routesInCountry([ride], routes, 'BE');
    expect(be.length).toBe(2);
    expect(be.every((piece) => piece.length >= 2)).toBe(true);
    // Nenhum ponto desenhado fica do lado francês da fronteira. A folga de 1e-5°
    // (~1 m) é a bissecção: ela converge PARA a fronteira, podendo parar um
    // triz de qualquer um dos lados.
    expect(be.flat().every((p) => p.lat >= 50.5 - 1e-5)).toBe(true);
  });

  it('pedalada de um país só entra inteira, sem recorte', () => {
    const solo = act('a1', [brusselsCity]);
    const route = line(51, 50.2);
    const be = routesInCountry([solo], new Map([['a1', route]]), 'BE');
    expect(be.length).toBe(1);
    expect(be[0].length).toBe(route.length);
  });

  it('ignora treinos sem rota carregada e os que não cruzam o país', () => {
    const withoutRoute = act('a1', [brusselsCity]);
    const elsewhere = act('a2', [spCity]);
    const routes = new Map([['a2', line(-23.5, -23.9, -46.6)]]);
    expect(routesInCountry([withoutRoute, elsewhere], routes, 'BE')).toEqual([]);
  });
});

describe('fronteira real (countryAt)', () => {
  // O caso que motivou os polígonos: Aachen (DE) e Vaals (NL) ficam a ~11 km, e
  // a bissetriz entre as duas corre ~2 km DENTRO da Alemanha. A fronteira de
  // verdade passa no Vaalserberg, em ~6.02.
  const aachen: CityMark = { name: 'Aachen', countryCode: 'DE', lat: 50.7753, lng: 6.0834 };
  const vaals: CityMark = { name: 'Vaals', countryCode: 'NL', lat: 50.7714, lng: 5.9214 };

  it('classifica pontos dos dois lados do tripoint de Vaals', () => {
    expect(countryAt(6.04, 50.77, ['DE', 'NL'])).toBe('DE');
    expect(countryAt(6.01, 50.77, ['DE', 'NL'])).toBe('NL');
    expect(countryAt(4.3517, 50.8503, ['BE', 'NL', 'DE'])).toBe('BE'); // Bruxelas
  });

  it('null quando nenhum candidato contém o ponto', () => {
    expect(countryAt(-30, 40, ['DE', 'NL'])).toBeNull(); // meio do Atlântico
  });

  it('corta na fronteira de verdade, não na bissetriz entre as cidades', () => {
    // Linha reta Aachen → Vaals, passando pela fronteira real em ~6.02.
    const route: ActivityRoutePoint[] = [];
    for (let lng = 6.08; lng >= 5.93 - 1e-9; lng -= 0.005) {
      route.push({ lat: 50.772, lng: Number(lng.toFixed(4)) });
    }
    const ride = act('a1', [aachen, vaals]);
    const routes = new Map([['a1', route]]);

    const de = routesInCountry([ride], routes, 'DE', countryAt);
    expect(de.length).toBe(1);
    const cut = de[0][de[0].length - 1].lng;
    expect(cut).toBeGreaterThan(6.01); // fronteira real, não a bissetriz (~6.00)
    expect(cut).toBeLessThan(6.03);

    // Sem o resolvedor, o corte cai na bissetriz — ~2 km mais a oeste.
    const semResolver = routesInCountry([ride], routes, 'DE');
    expect(semResolver[0][semResolver[0].length - 1].lng).toBeLessThan(cut);
  });

  it('o rateio usa a mesma fronteira: DE + NL reconstroem a pedalada', () => {
    const route: ActivityRoutePoint[] = [];
    for (let lng = 6.08; lng >= 5.93 - 1e-9; lng -= 0.005) {
      route.push({ lat: 50.772, lng: Number(lng.toFixed(4)) });
    }
    const ride = act('a1', [aachen, vaals], { distanceM: 12000 });
    const routes = new Map([['a1', route]]);

    const de = countryShares([ride], routes, 'DE', countryAt).get('a1')!;
    const nl = countryShares([ride], routes, 'NL', countryAt).get('a1')!;
    expect(de + nl).toBeCloseTo(1, 6);
    expect(de).toBeGreaterThan(0.3); // ~6.08→6.02 de 6.08→5.93
    expect(de).toBeLessThan(0.5);
  });
});

describe('countryStats', () => {
  it('soma distância/elevação/calorias, pega máximos e data mais recente', () => {
    const acts = [
      act('a1', [brusselsCity], {
        distanceM: 40000, elevationM: 300, movingTimeS: 5400, calories: 800,
        startAt: '2026-01-01T10:00:00Z',
      }),
      act('a2', [brusselsCity], {
        distanceM: 60000, elevationM: 500, movingTimeS: 7200, calories: 1200,
        startAt: '2026-02-01T10:00:00Z',
      }),
    ];
    const s = countryStats(acts, sharesFor(acts, 'BE'));
    expect(s.rideCount).toBe(2);
    expect(s.distanceM).toBe(100000);
    expect(s.elevationM).toBe(800);
    expect(s.movingTimeS).toBe(12600);
    expect(s.calories).toBe(2000);
    expect(s.longestRideM).toBe(60000);
    expect(s.maxClimbM).toBe(500);
    expect(s.lastRideAt).toBe('2026-02-01T10:00:00Z');
  });

  it('avgSpeedKmh deriva dos totais (100 km em 5h = 20 km/h)', () => {
    const acts = [act('a1', [brusselsCity], { distanceM: 100000, movingTimeS: 18000 })];
    const s = countryStats(acts, sharesFor(acts, 'BE'));
    expect(s.avgSpeedKmh).toBeCloseTo(20, 5);
  });

  it('campos ausentes contam 0; movingTime cai para durationS; sem tempo → velocidade 0', () => {
    const acts = [act('a1', [brusselsCity], { distanceM: 30000, durationS: 3600 })]; // sem elevationM/movingTimeS
    const s = countryStats(acts, sharesFor(acts, 'BE'));
    expect(s.elevationM).toBe(0);
    expect(s.maxClimbM).toBe(0);
    expect(s.movingTimeS).toBe(3600); // fallback durationS
    expect(s.avgSpeedKmh).toBeCloseTo(30, 5); // 30 km / 1h

    const empty = countryStats([], new Map());
    expect(empty.rideCount).toBe(0);
    expect(empty.avgSpeedKmh).toBe(0);
    expect(empty.distanceM).toBe(0);
  });

  it('cross-border: só o trecho do país conta; a pedalada segue contando como 1', () => {
    const ride = act('a1', [beAnchor, frAnchor], {
      distanceM: 80000, elevationM: 1000, movingTimeS: 14400, calories: 2000,
    });
    const routes = new Map([['a1', line(51, 50.2)]]); // 62.5% BE / 37.5% FR

    const be = countryStats([ride], sharesFor([ride], 'BE', routes));
    expect(be.rideCount).toBe(1); // conta inteira nos dois países — foi pedalada nos dois
    expect(be.distanceM).toBeCloseTo(50000, 0); // ±0,5 m: o resto é a bissecção
    expect(be.elevationM).toBeCloseTo(625, 1);
    expect(be.movingTimeS).toBeCloseTo(9000, 1);
    expect(be.calories).toBeCloseTo(1250, 1);
    expect(be.longestRideM).toBeCloseTo(50000, 0); // maior TRECHO, não a pedalada
    expect(be.maxClimbM).toBeCloseTo(625, 1);

    const fr = countryStats([ride], sharesFor([ride], 'FR', routes));
    expect(fr.distanceM).toBeCloseTo(30000, 0);
    // Os dois lados somados reconstroem a pedalada inteira.
    expect(be.distanceM + fr.distanceM).toBeCloseTo(80000, 3);
    expect(be.elevationM + fr.elevationM).toBeCloseTo(1000, 3);

    // Distância e tempo escalam juntos → a velocidade média não muda com o rateio.
    expect(be.avgSpeedKmh).toBeCloseTo(20, 5);
    expect(fr.avgSpeedKmh).toBeCloseTo(20, 5);
  });
});
