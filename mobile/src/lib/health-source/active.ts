/**
 * Ponto único de troca da fonte de saúde.
 *
 * Fase 1B do plano de migração: `kingstinctHealthSource` está ativo.
 * `legacyHealthSource` continua no repositório — reverter é trocar a linha
 * abaixo de volta, sem revert de migração.
 *
 * Nenhum consumidor importa um adaptador direto; todos passam por aqui.
 */
import type { HealthSource } from './contract';
import { kingstinctHealthSource } from './kingstinct-provider';

export const healthSource: HealthSource = kingstinctHealthSource;

export * from './contract';
