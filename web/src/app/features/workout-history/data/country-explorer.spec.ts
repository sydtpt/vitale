import type { Activity, ActivityRoutePoint, CityMark } from '@vitale/shared';
import {
  activitiesInCountry,
  citiesInCountry,
  countryForCity,
  countryStats,
  countryViewport,
  ridesByCountry,
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

  it('nunca menor que o bbox do país (sem rotas)', () => {
    const vp = countryViewport('BR', []);
    expect(vp).toEqual([
      [brBbox.south, brBbox.west],
      [brBbox.north, brBbox.east],
    ]);
  });

  it('estica até um ponto ~30 km além da borda (dentro do buffer)', () => {
    const route: ActivityRoutePoint[] = [{ lat: 5.54, lng: -50 }]; // ~30 km ao norte
    const vp = countryViewport('BR', [route])!;
    expect(vp[1][0]).toBeCloseTo(5.54, 2); // north esticado
  });

  it('NÃO estica além do buffer para um ponto a ~200 km', () => {
    const route: ActivityRoutePoint[] = [{ lat: 7.07, lng: -50 }]; // ~200 km ao norte
    const vp = countryViewport('BR', [route])!;
    expect(vp[1][0]).toBeCloseTo(brBbox.north, 2); // permanece no bbox
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

describe('countryStats', () => {
  it('soma distância/elevação/calorias, pega máximos e data mais recente', () => {
    const s = countryStats([
      act('a1', [brusselsCity], {
        distanceM: 40000, elevationM: 300, movingTimeS: 5400, calories: 800,
        startAt: '2026-01-01T10:00:00Z',
      }),
      act('a2', [brusselsCity], {
        distanceM: 60000, elevationM: 500, movingTimeS: 7200, calories: 1200,
        startAt: '2026-02-01T10:00:00Z',
      }),
    ]);
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
    const s = countryStats([
      act('a1', [brusselsCity], { distanceM: 100000, movingTimeS: 18000 }),
    ]);
    expect(s.avgSpeedKmh).toBeCloseTo(20, 5);
  });

  it('campos ausentes contam 0; movingTime cai para durationS; sem tempo → velocidade 0', () => {
    const s = countryStats([
      act('a1', [brusselsCity], { distanceM: 30000, durationS: 3600 }), // sem elevationM/movingTimeS
    ]);
    expect(s.elevationM).toBe(0);
    expect(s.maxClimbM).toBe(0);
    expect(s.movingTimeS).toBe(3600); // fallback durationS
    expect(s.avgSpeedKmh).toBeCloseTo(30, 5); // 30 km / 1h

    const empty = countryStats([]);
    expect(empty.rideCount).toBe(0);
    expect(empty.avgSpeedKmh).toBe(0);
    expect(empty.distanceM).toBe(0);
  });
});
