/**
 * Datas e números da tela de Bicicletas — puro, e fora do componente para o
 * formulário e o cartão lerem a mesma régua.
 */
import type { Activity, Gear } from '@vitale/shared';

/** 'dd/mm/aaaa' → 'YYYY-MM-DD'; undefined quando incompleto ou impossível. */
export function parseGearDate(s: string): string | undefined {
  const m = s.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return undefined;
  const [, d, mo, y] = m;
  const iso = `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`;
  return Number.isNaN(new Date(`${iso}T12:00:00Z`).getTime()) ? undefined : iso;
}

export function fmtGearDate(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

export function gearToday(): string {
  const d = new Date();
  const m = d.getMonth() + 1;
  const day = d.getDate();
  return `${d.getFullYear()}-${m < 10 ? '0' + m : m}-${day < 10 ? '0' + day : day}`;
}

/** As pedaladas que caem na janela desta bicicleta (dia local do início). */
export function ridesOfGear(rides: readonly Activity[], gear: Gear): Activity[] {
  return rides.filter((a) => {
    const day = a.startAt.slice(0, 10);
    return day >= gear.activeFrom && (gear.activeTo == null || day <= gear.activeTo);
  });
}

function median(values: number[]): number {
  const v = [...values].sort((a, b) => a - b);
  return v.length ? v[Math.floor(v.length / 2)]! : 0;
}

/** Distância típica (mediana, km). */
export function typicalKm(rides: readonly Activity[]): number {
  return median(rides.map((a) => (a.distanceM ?? 0) / 1000).filter((k) => k > 0));
}

/**
 * Velocidade típica nas saídas longas (km/h, mediana).
 *
 * Só saídas de 40 km ou mais: misturar a ida ao mercado com o passeio de
 * domingo faria a comparação entre bicicletas dizer mais sobre o trajeto que
 * sobre a bicicleta.
 */
export function typicalSpeed(rides: readonly Activity[], minKm = 40): number {
  const v = rides
    .filter((a) => (a.distanceM ?? 0) >= minKm * 1000)
    .map((a) => {
      const t = a.movingTimeS || a.durationS;
      return t > 0 ? (a.distanceM ?? 0) / 1000 / (t / 3600) : 0;
    })
    .filter((s) => s > 5 && s < 45);
  return median(v);
}
