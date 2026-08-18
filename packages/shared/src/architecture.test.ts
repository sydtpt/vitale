/**
 * Guarda das fronteiras da arquitetura (AD-7) — puro, sem framework. Rodar com:
 *   cd packages/shared && npx tsx src/architecture.test.ts
 *
 * Duas naturezas de checagem, de propósito:
 *
 * 1. **Barreira** — o que já está limpo e não pode sujar. Falha em qualquer
 *    violação nova.
 * 2. **Catraca** — o que ainda está sendo migrado. Falha quando o número CRESCE.
 *    Trava o passivo no lugar enquanto a CAP-6 anda, e vira barreira quando
 *    chegar a zero. Baixar o teto ao migrar é parte do trabalho.
 *
 * Catraca é honesta onde barreira seria mentira: declarar "nenhum .from() fora
 * do núcleo" hoje derrubaria o build em 132 lugares e o teste seria desligado
 * na primeira hora.
 */
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { basename, join } from 'node:path';

let passed = 0;
function check(name: string, fn: () => void): void {
  fn();
  passed += 1;
  console.log(`  ok ${name}`);
}

const ROOT = join(import.meta.dirname, '..', '..', '..');

function walk(dir: string, out: string[] = []): string[] {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const e of entries) {
    if (e === 'node_modules' || e.startsWith('.')) continue;
    const p = join(dir, e);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.tsx?$/.test(e)) out.push(p);
  }
  return out;
}

const webFiles = walk(join(ROOT, 'web', 'src')).filter((f) => !f.endsWith('.spec.ts'));
const mobileFiles = walk(join(ROOT, 'mobile', 'src')).filter((f) => !/__tests__/.test(f));

/**
 * Stores duplicam por razão arquitetural legítima: a máquina de estado é
 * signals na web e Zustand no mobile (AD-12). Nome novo aqui é exceção, e
 * exceção some de vista — pense duas vezes antes de acrescentar.
 */
const STORE_ALLOWLIST = new Set([
  'activities.store.ts',
  'connections.store.ts',
  'daily-ratings.store.ts',
  'goals.store.ts',
  'habits.store.ts',
  'health.store.ts',
  'planned-workouts.store.ts',
  'registros.store.ts',
  'retro.store.ts',
  'todos.store.ts',
]);

/**
 * Diferido com razão escrita: `ActivityHighlight` carrega `value` e `caption`
 * já formatados, então cálculo e apresentação estão entrelaçados. Separar é o
 * que a AD-2 manda, mas é mudança de design com impacto na UI.
 */
const DEFERRED = new Set(['running-highlights.ts']);

check('BARREIRA — nenhum módulo com o mesmo nome nos dois apps', () => {
  const web = new Set(webFiles.map((f) => basename(f)));
  const dup = [...new Set(mobileFiles.map((f) => basename(f)))]
    .filter((b) => web.has(b))
    .filter((b) => !STORE_ALLOWLIST.has(b) && !DEFERRED.has(b));
  assert.deepEqual(
    dup,
    [],
    `duplicado(s) entre web/src e mobile/src: ${dup.join(', ')}. ` +
      `Se for lógica pura, sobe para @vitale/shared (AD-1). Se o arquivo mistura ` +
      `plataforma e lógica pura, parta-o antes (AD-2). Se os dois módulos não têm ` +
      `relação, o nome é que está errado — renomeie.`,
  );
});

/**
 * Teto do passivo da CAP-6. **Só desce.** Ao mover uma tabela para
 * `shared/src/data/`, baixe este número para o novo total.
 */
const FROM_CALLS_CEILING = 132;

check(`CATRACA — chamadas .from() fora do núcleo não passam de ${FROM_CALLS_CEILING}`, () => {
  const count = [...webFiles, ...mobileFiles]
    .map((f) => (readFileSync(f, 'utf8').match(/\.from\('[a-z_]+'/g) ?? []).length)
    .reduce((a, b) => a + b, 0);
  assert.ok(
    count <= FROM_CALLS_CEILING,
    `${count} chamadas .from() fora de packages/shared/src/data (teto ${FROM_CALLS_CEILING}). ` +
      `Query nova vai no módulo dono da tabela, no núcleo (AD-4).`,
  );
  if (count < FROM_CALLS_CEILING) {
    console.log(
      `     ↓ ${count} agora — baixe FROM_CALLS_CEILING para ${count} neste commit.`,
    );
  }
});

check('BARREIRA — o núcleo não importa dos apps', () => {
  const offenders = walk(join(ROOT, 'packages', 'shared', 'src'))
    .filter((f) => /from '.*(web|mobile)\/src/.test(readFileSync(f, 'utf8')))
    .map((f) => f.replace(ROOT + '/', ''));
  assert.deepEqual(offenders, [], `núcleo importando de app: ${offenders.join(', ')}`);
});

check('BARREIRA — o núcleo não constrói SupabaseClient', () => {
  const offenders = walk(join(ROOT, 'packages', 'shared', 'src'))
    .filter((f) => /createClient\s*\(/.test(readFileSync(f, 'utf8')))
    .map((f) => f.replace(ROOT + '/', ''));
  assert.deepEqual(
    offenders,
    [],
    `núcleo construindo client: ${offenders.join(', ')}. O client vem por parâmetro (AD-4); ` +
      `quem o constrói é o app, porque o adaptador de storage difere.`,
  );
});

console.log(`\n${passed} testes passaram.`);
