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
 * Foi CATRACA enquanto as 139 chamadas originais eram migradas: falhava só
 * quando o número crescia, e o teto descia a cada tabela. Chegou a zero e
 * virou barreira, como estava previsto desde que foi escrita.
 */
check('BARREIRA — nenhuma chamada .from() fora do núcleo', () => {
  const offenders = [...webFiles, ...mobileFiles]
    .map((f) => ({ f, n: (readFileSync(f, 'utf8').match(/\.from\('[a-z_]+'/g) ?? []).length }))
    .filter((x) => x.n > 0)
    .map((x) => `${x.f.replace(ROOT + '/', '')} (${x.n})`);
  assert.deepEqual(
    offenders,
    [],
    `acesso a tabela fora de packages/shared/src/data: ${offenders.join(', ')}. ` +
      `Query nova vai no módulo dono da tabela (AD-4); se a tabela ainda não tem módulo, crie um.`,
  );
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

/**
 * `cultura/tipos.ts` é consumido pelo Deno das edge functions por caminho
 * relativo, e o Deno exige extensão explícita em todo specifier. Um import
 * sem `.ts` aqui não quebra `tsc` nem os apps — quebra só no deploy da função,
 * longe de onde a mudança foi feita.
 */
check('BARREIRA — cultura/tipos.ts continua auto-contido (consumido pelo Deno)', () => {
  const src = readFileSync(join(ROOT, 'packages', 'shared', 'src', 'cultura', 'tipos.ts'), 'utf8');
  const imports = src.match(/^\s*import\s.+$/gm) ?? [];
  assert.deepEqual(
    imports,
    [],
    `cultura/tipos.ts ganhou import: ${imports.join(' | ')}. A edge function cultura-search o ` +
      `importa direto, e o Deno não resolve specifier sem extensão. Mantenha o módulo sem imports ` +
      `(mesmo padrão de fitness/dedupe.ts) ou o deploy da função quebra.`,
  );
});

/**
 * A cadeia de provedores tem que ter fonte única entre cliente e servidor. Se
 * a edge function passar a decidir a ordem por conta própria, o fallback
 * diverge calado — e ninguém percebe até uma busca cair no provedor errado.
 */
check('BARREIRA — a edge function lê a cadeia de provedores do núcleo', () => {
  const fn = join(ROOT, 'supabase', 'functions', '_shared', 'providers', 'cultura.ts');
  const src = readFileSync(fn, 'utf8');
  assert.ok(
    /import\s*\{[^}]*cadeiaDeProvedores[^}]*\}\s*from\s*'[^']*packages\/shared\/src\/cultura\/tipos\.ts'/
      .test(src),
    `supabase/functions/_shared/providers/cultura.ts precisa importar cadeiaDeProvedores do ` +
      `núcleo. Redefinir a ordem lá faz cliente e servidor divergirem sem nada acusar.`,
  );
});

console.log(`\n${passed} testes passaram.`);
