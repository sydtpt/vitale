/**
 * Paridade do kernel shared (`fitness/streams.ts`) com as implementações
 * originais do mobile: mesmo track sintético ⇒ mesmos resultados. Se estes
 * testes quebrarem, o kernel (usado pelas edge functions) divergiu do app.
 */
import { describe, it, expect } from '@jest/globals';
import { computeBestEffortsFromPoints, computeHrZonesFromSamples, elevationGainFromPoints, fitnessMaxHrFromAge, HR_ZONES, movingTimeFromPoints, movingTimeFromTrack, type FitnessPoint } from '@vitale/shared';
import { computeBestEfforts } from '../best-efforts';
import { computeHrZones, maxHrFromAge, type HrSample } from '../heart-rate-zones';
import { elevationGain, resolveElevationM, type RoutePoint } from '../workout-types';

const BASE_MS = Date.UTC(2026, 6, 1, 8, 0, 0);

/**
 * Track sintético indo para o norte: `stepM` metros a cada `stepS` segundos
 * (1e-5 grau de latitude ≈ 1.11 m). Inclui uma pausa de 120 s no meio.
 */
function makeTrack(count: number, stepM: number, stepS: number): {
  shared: FitnessPoint[];
  mobile: RoutePoint[];
} {
  const shared: FitnessPoint[] = [];
  const mobile: RoutePoint[] = [];
  let tMs = BASE_MS;
  for (let i = 0; i < count; i++) {
    const lat = -23.55 + (i * stepM) / 111320; // metros → graus de latitude
    const lng = -46.63;
    const alt = 700 + Math.sin(i / 10) * 30;
    if (i === Math.floor(count / 2)) tMs += 120_000; // pausa (parado no lugar)
    shared.push({ lat, lng, alt, t: tMs });
    mobile.push({ latitude: lat, longitude: lng, altitude: alt, timestamp: new Date(tMs).toISOString() });
    tMs += stepS * 1000;
  }
  return { shared, mobile };
}

describe('fitness/streams — paridade com o mobile', () => {
  // Corrida ~10.8 km: 3600 pontos, 3 m por segundo.
  const track = makeTrack(3600, 3, 1);

  it('movingTimeFromPoints ≡ movingTimeFromTrack', () => {
    expect(movingTimeFromPoints(track.shared)).toBe(movingTimeFromTrack(track.mobile));
    expect(movingTimeFromPoints(undefined)).toBeUndefined();
    expect(movingTimeFromPoints([])).toBeUndefined();
  });

  it('computeBestEffortsFromPoints ≡ computeBestEfforts', () => {
    const fromShared = computeBestEffortsFromPoints(track.shared);
    const fromMobile = computeBestEfforts(track.mobile);
    expect(fromShared).toEqual(fromMobile);
    expect(fromShared['1000']).toBeGreaterThan(0);
    expect(fromShared['10000']).toBeGreaterThan(0);
    expect(fromShared['20000']).toBeUndefined(); // track não cobre 20 km
  });

  it('elevationGainFromPoints ≡ elevationGain (e undefined sem altitude)', () => {
    expect(elevationGainFromPoints(track.shared)).toBeCloseTo(elevationGain(track.mobile), 6);
    const flat = track.shared.map((p) => ({ lat: p.lat, lng: p.lng, t: p.t }));
    expect(elevationGainFromPoints(flat)).toBeUndefined();
  });

  it('ganho de elevação acumula subidas graduais e ignora descidas/ruído', () => {
    const pt = (i: number, alt: number): FitnessPoint => ({
      lat: -23.55 + i * 1e-5,
      lng: -46.63,
      alt,
      t: BASE_MS + i * 1000,
    });
    // Subida contínua de 30 m em passos de 0,3 m (< limiar por ponto): a
    // histerese acumula quase o total — a suavização come as bordas e a
    // cauda < limiar, mas nada perto dos 100% que o algoritmo pré-histerese
    // (delta consecutivo > 1 m) descartava.
    const climb = Array.from({ length: 101 }, (_, i) => pt(i, 700 + i * 0.3));
    const climbGain = elevationGainFromPoints(climb)!;
    expect(climbGain).toBeGreaterThan(24);
    expect(climbGain).toBeLessThanOrEqual(30);

    // Ida e volta (sobe 30 m, desce 30 m): conta só a subida, não o líquido.
    const outAndBack = [
      ...climb,
      ...Array.from({ length: 100 }, (_, i) => pt(101 + i, 730 - (i + 1) * 0.3)),
    ];
    expect(elevationGainFromPoints(outAndBack)!).toBeCloseTo(climbGain, 1);

    // Ruído oscilando ±0,4 m em torno de 700 m: abaixo do limiar, ganho 0.
    const noise = Array.from({ length: 200 }, (_, i) => pt(i, 700 + (i % 2 === 0 ? 0.4 : -0.4)));
    expect(elevationGainFromPoints(noise)).toBe(0);
  });

  it('suavização mata o jitter de barômetro sem perder a subida real', () => {
    const pt = (i: number, alt: number): FitnessPoint => ({
      lat: -23.55 + i * 1e-5,
      lng: -46.63,
      alt,
      t: BASE_MS + i * 1000,
    });
    // Jitter ±1,5 m a 1 Hz durante 1 h em terreno plano: sem suavização, a
    // histerese de limiar baixo somava cada oscilação (~5.400 m falsos —
    // o bug da pedalada de 124 km gravada com 1.840 m em vez de ~865 m).
    const jitter = Array.from({ length: 3600 }, (_, i) =>
      pt(i, 700 + (i % 2 === 0 ? 1.5 : -1.5)),
    );
    expect(elevationGainFromPoints(jitter)!).toBeLessThan(1);

    // O mesmo jitter em cima de uma subida real de 60 m: o ganho é a subida.
    const noisyClimb = Array.from({ length: 401 }, (_, i) =>
      pt(i, 700 + i * 0.15 + (i % 2 === 0 ? 1.5 : -1.5)),
    );
    const g = elevationGainFromPoints(noisyClimb)!;
    expect(g).toBeGreaterThan(54);
    expect(g).toBeLessThanOrEqual(60);
  });

  it('a janela de suavização é de tempo: mesma subida rende o mesmo em 1 Hz e a 5 s/ponto', () => {
    // Mesmo terreno (60 m em 20 min), gravado em duas densidades — a diferença
    // entre o track do Apple Watch (1 Hz) e o que chega pela ponte Strava.
    // Com janela contada em amostras, o track esparso era suavizado 5× mais
    // forte e perdia relevo real; com janela de tempo, os dois convergem.
    const ramp = (i: number, stepS: number): FitnessPoint => ({
      lat: -23.55 + i * 1e-5 * stepS,
      lng: -46.63,
      alt: 700 + i * stepS * 0.05,
      t: BASE_MS + i * stepS * 1000,
    });
    const denso = Array.from({ length: 1201 }, (_, i) => ramp(i, 1));
    const esparso = Array.from({ length: 241 }, (_, i) => ramp(i, 5));
    const gDenso = elevationGainFromPoints(denso)!;
    const gEsparso = elevationGainFromPoints(esparso)!;
    // Sobra só o efeito de borda da janela (< 1 m em 60 m); com janela em
    // amostras a diferença era de dezenas de metros.
    expect(Math.abs(gDenso - gEsparso)).toBeLessThan(1);
    expect(gEsparso).toBeGreaterThan(55);
  });

  it('rota sem `t` cai na janela em amostras (preserva o valor das rotas antigas)', () => {
    const semT = Array.from({ length: 601 }, (_, i) => ({
      lat: -23.55 + i * 1e-5,
      lng: -46.63,
      alt: 700 + i * 0.05,
    }));
    // Sem timestamp, 15 amostras ≈ 15 s a 1 Hz: mesmo resultado do track com `t`.
    const comT = semT.map((p, i) => ({ ...p, t: BASE_MS + i * 1000 }));
    expect(elevationGainFromPoints(semT)!).toBeCloseTo(elevationGainFromPoints(comT)!, 6);
  });

  it('o limiar sai do tipo de sinal: FIT (múltiplo de 0,2 m) vs GNSS', () => {
    // Mesma subida real de 30 m em 10 min, com ruído de ±1 m. Numa série
    // barométrica (quantizada em 0,2 m) o limiar é 0,7 m e a subida conta quase
    // inteira; na de GNSS o limiar é 3 m e o mesmo ruído não vira subida falsa.
    const serie = (quantizar: boolean) =>
      Array.from({ length: 601 }, (_, i) => {
        const real = 700 + i * 0.05 + (i % 2 === 0 ? 1 : -1);
        return {
          lat: -23.55 + i * 1e-5,
          lng: -46.63,
          alt: quantizar ? Math.round(real * 5) / 5 : real + 0.03137,
          t: BASE_MS + i * 1000,
        };
      });
    const baro = elevationGainFromPoints(serie(true))!;
    const gnss = elevationGainFromPoints(serie(false))!;
    expect(baro).toBeGreaterThan(gnss);
    // Limiar explícito continua mandando — é o que as migrations usam ao fixar
    // um valor histórico.
    expect(elevationGainFromPoints(serie(true), 3)).toBeCloseTo(gnss, 0);
  });

  it('série de altitude constante não é confundida com barométrica', () => {
    // Fonte que grava 0 em vez de omitir a altitude: todo valor é múltiplo de
    // 0,2 por acidente. Sem a guarda de amplitude, cairia no limiar barométrico.
    const chapado = Array.from({ length: 300 }, (_, i) => ({
      lat: -23.55 + i * 1e-5,
      lng: -46.63,
      alt: 0,
      t: BASE_MS + i * 1000,
    }));
    expect(elevationGainFromPoints(chapado)).toBe(0);
  });

  it('resolveElevationM prefere o valor guardado na atividade', () => {
    const track: RoutePoint[] = Array.from({ length: 601 }, (_, i) => ({
      latitude: -23.55 + i * 1e-5,
      longitude: -46.63,
      altitude: 700 + i * 0.05,
      timestamp: new Date(BASE_MS + i * 1000).toISOString(),
    }));
    const calculado = elevationGain(track);
    expect(calculado).toBeGreaterThan(0);

    // Reportado vence, mesmo divergindo muito do cálculo (é o caso real: sobre
    // altitude de GNSS o cálculo fica ~40% abaixo do barômetro da fonte).
    expect(resolveElevationM(142, track)).toBe(142);
    // 0 é "plano medido", não "desconhecido" — não cai no cálculo.
    expect(resolveElevationM(0, track)).toBe(0);
    // Null/undefined ⇒ estimativa do track.
    expect(resolveElevationM(null, track)).toBeCloseTo(calculado, 6);
    expect(resolveElevationM(undefined, track)).toBeCloseTo(calculado, 6);
    // Sem valor e sem track: desconhecido.
    expect(resolveElevationM(null, [])).toBeUndefined();
    expect(resolveElevationM(undefined, undefined)).toBeUndefined();
  });

  it('computeHrZonesFromSamples ≡ computeHrZones (fronteiras pinadas em HR_ZONES)', () => {
    // Série varrendo todas as zonas: 100→180 bpm com FCmáx 190 / FCrep 50.
    const samples: HrSample[] = Array.from({ length: 600 }, (_, i) => ({
      bpm: 100 + Math.floor(i / 60) * 8,
      t: BASE_MS + i * 5000,
    }));
    const params = { maxHr: 190, restHr: 50 };
    const fromShared = computeHrZonesFromSamples(samples, params);
    const fromMobile = computeHrZones(samples, params);
    expect(fromShared).toEqual(fromMobile);
    expect(Object.keys(fromShared).length).toBeGreaterThan(1);
    // Toda chave produzida existe na definição compartilhada de zonas.
    for (const key of Object.keys(fromShared)) {
      expect(HR_ZONES.some((z) => z.key === key)).toBe(true);
    }
  });

  it('fitnessMaxHrFromAge ≡ maxHrFromAge', () => {
    for (const age of [undefined, 0, 25, 34, 119, 130]) {
      expect(fitnessMaxHrFromAge(age)).toBe(maxHrFromAge(age));
    }
  });
});
