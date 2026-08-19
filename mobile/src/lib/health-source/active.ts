/**
 * Ponto único de troca da fonte de saúde.
 *
 * Enquanto houver uma implementação só, isto é uma reexportação. Quando o
 * adaptador sobre `@kingstinct/react-native-healthkit` entrar, a troca acontece
 * **aqui** — em uma linha, com o adaptador antigo ainda no repositório, o que
 * torna o rollback uma reversão de uma linha em vez de um revert de migração.
 *
 * Nenhum consumidor importa um adaptador direto; todos passam por aqui.
 */
import type { HealthSource } from './contract';
import { legacyHealthSource } from './legacy-provider';

export const healthSource: HealthSource = legacyHealthSource;

export * from './contract';
