/**
 * Carga semanal por zona de FC — a derivação mora no núcleo
 * (`fitness/weekly-load.ts`), onde o mobile também a lê. Este arquivo só
 * preserva os imports que a web já fazia: o card e o spec continuam apontando
 * para cá. `mondayOf` é o do núcleo (`week/recap`) — a cópia local que havia
 * aqui era a mesma conta.
 */
export {
  buildWeeklyLoad,
  mondayOf,
  type Polarization,
  type WeekLoadBucket,
  type WeeklyLoad,
} from '@vitale/shared';
