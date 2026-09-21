/**
 * `pnpm --filter @vitale/scripts aparelho:testar` — os testes da ponte Swift, sem modelo.
 *
 * Compila `Engine.swift` + `testes.swift` com **os mesmos argumentos** da CLI
 * (`argumentosDoSwiftc`: o `-O`, o alvo, o modo de linguagem) — um teste compilado de outro
 * jeito provaria outro binário —, e roda. Local, fora do CI: lá não há Swift.
 */
import { spawnSync } from 'node:child_process';
import {
  APOIO_DOS_TESTES,
  BINARIO_DOS_TESTES,
  BINARIO_DOS_TESTES_DO_COREAI,
  ENGINE_SWIFT,
  MOTOR_COREAI_SWIFT,
  TESTES_DA_CLI,
  prepararBinario,
  prepararTestesDoCoreAI,
} from '../motores.ts';

/** Compila e roda um binário de teste. Devolve o status, ou 1 se nem chegou a rodar. */
function rodar(nome: string, binario: string, preparar: () => { ok: boolean; motivo?: string; compilador?: string | null }): number {
  const preparo = preparar();
  if (!preparo.ok) {
    process.stderr.write(`${nome} não compilou: ${preparo.motivo ?? 'sem motivo'}\n`);
    return 1;
  }
  if (preparo.compilador) process.stdout.write(`compilado por: ${preparo.compilador}\n`);
  const r = spawnSync(binario, [], { stdio: 'inherit' });
  if (r.error) {
    process.stderr.write(`${nome} não rodou: ${r.error.message}\n`);
    return 1;
  }
  return r.status ?? 1;
}

/**
 * **Dois binários, e os dois têm de passar.**
 *
 * O primeiro é a ponte sem a biblioteca do Core AI — o modo do simulador, de um clone sem
 * `montar.sh` e deste Mac. O segundo é o ramo **com** `ORBE_COREAI`, contra a casca falsa: sem
 * ele, o caminho que o iPhone de fato percorre não era compilado por nada aqui.
 */
function principal(): number {
  const semBiblioteca = rodar('os testes da ponte', BINARIO_DOS_TESTES, () =>
    prepararBinario(BINARIO_DOS_TESTES, [ENGINE_SWIFT, MOTOR_COREAI_SWIFT, APOIO_DOS_TESTES, TESTES_DA_CLI]),
  );
  process.stdout.write('\n');
  const comBiblioteca = rodar('os testes do Core AI', BINARIO_DOS_TESTES_DO_COREAI, () => prepararTestesDoCoreAI());
  return semBiblioteca !== 0 ? semBiblioteca : comBiblioteca;
}

process.exitCode = principal();
