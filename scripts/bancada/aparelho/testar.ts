/**
 * `pnpm --filter @vitale/scripts aparelho:testar` — os testes da ponte Swift, sem modelo.
 *
 * Compila `Engine.swift` + `testes.swift` com **os mesmos argumentos** da CLI
 * (`argumentosDoSwiftc`: o `-O`, o alvo, o modo de linguagem) — um teste compilado de outro
 * jeito provaria outro binário —, e roda. Local, fora do CI: lá não há Swift.
 */
import { spawnSync } from 'node:child_process';
import { BINARIO_DOS_TESTES, ENGINE_SWIFT, TESTES_DA_CLI, prepararBinario } from '../motores.ts';

function principal(): number {
  const preparo = prepararBinario(BINARIO_DOS_TESTES, [ENGINE_SWIFT, TESTES_DA_CLI]);
  if (!preparo.ok) {
    process.stderr.write(`os testes da ponte não compilaram: ${preparo.motivo}\n`);
    return 1;
  }
  if (preparo.compilador) process.stdout.write(`compilado por: ${preparo.compilador}\n`);
  const r = spawnSync(BINARIO_DOS_TESTES, [], { stdio: 'inherit' });
  if (r.error) {
    process.stderr.write(`os testes da ponte não rodaram: ${r.error.message}\n`);
    return 1;
  }
  return r.status ?? 1;
}

process.exitCode = principal();
