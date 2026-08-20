/**
 * BARREIRA — nenhum seletor de store chama função que deriva coleção.
 *
 * As stores são Zustand 5, que por baixo usa `useSyncExternalStore`. O React
 * chama o seletor durante o render e compara o resultado com o anterior por
 * identidade. Um seletor como:
 *
 *     useActivitiesStore((s) => s.activities())   // activities() = _all.filter(...)
 *
 * devolve um array NOVO a cada avaliação, então a comparação nunca bate: o
 * React re-renderiza, o seletor roda de novo, devolve outro array novo, e o
 * app **trava em loop de render**. Foi exatamente o que aconteceu com a tela
 * "Sync de atividades" (`fitness/index.tsx`), que congelava ao abrir.
 *
 * O modo de falha é cruel: nenhum teste de lógica quebra, o tsc passa, e o
 * bundle builda. Só aparece no device, como app travado — por isso a guarda
 * é de código-fonte, e não de comportamento.
 *
 * A forma correta (e que o resto do app já usa) é selecionar a fatia crua e
 * derivar no `useMemo`:
 *
 *     const all = useActivitiesStore((s) => s._all);
 *     const visible = useMemo(() => all.filter((a) => !a.hidden), [all]);
 *
 * Chamar `activities()` via `getState()` FORA do render segue válido (sem
 * subscription, sem comparação de snapshot) — por isso a guarda só olha
 * seletores.
 */
import { describe, it, expect } from '@jest/globals';
import { readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';

const SRC = join(__dirname, '..', '..');
const SCANNED_DIRS = ['app', 'components', 'hooks'];

/** Seletor cujo corpo é uma CHAMADA de função: `(s) => s.algumaCoisa()`. */
const CALL_IN_SELECTOR = /use\w*Store\s*\(\s*\(\s*\w+\s*\)\s*=>\s*\w+\.\w+\s*\(\s*\)/g;

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      out.push(...sourceFiles(full));
    } else if (/\.tsx?$/.test(entry) && !entry.endsWith('.d.ts')) {
      out.push(full);
    }
  }
  return out;
}

describe('BARREIRA — seletor de store devolve referência estável', () => {
  it('nenhum seletor chama função derivadora (trava o app em loop de render)', () => {
    const offenders: string[] = [];

    for (const dir of SCANNED_DIRS) {
      for (const file of sourceFiles(join(SRC, dir))) {
        const contents = readFileSync(file, 'utf8');
        for (const line of contents.split('\n')) {
          // Comentários explicando a regra não contam como violação.
          if (/^\s*(\/\/|\*|\/\*)/.test(line)) continue;
          if (CALL_IN_SELECTOR.test(line)) {
            offenders.push(`${file.slice(SRC.length + 1)}: ${line.trim()}`);
          }
          CALL_IN_SELECTOR.lastIndex = 0;
        }
      }
    }

    expect(offenders).toEqual([]);
  });
});
