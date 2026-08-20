/**
 * BARREIRA — efeito não depende do OBJETO da sessão.
 *
 * O Supabase entrega um objeto `session` novo a cada renovação de token, mesmo
 * sendo o mesmo usuário logado. Um `useEffect(..., [session])` que liga e
 * desliga assinatura de vida longa roda a limpeza e o setup inteiros a cada
 * renovação.
 *
 * O caso que motivou a guarda: `stopActivitySync()` remove o observer de treino
 * do HealthKit, e o `tearDown()` da lib nativa **para as HKObserverQuery**. Uma
 * renovação de token com o app em background derrubaria os observers
 * exatamente quando eles precisam estar vivos — que é a janela inteira do sync
 * em background.
 *
 * O diagnóstico em device pegou o sintoma no cold start:
 *
 *     14:37:04  bg-config    ok
 *     14:37:04  sync-start   state=active
 *     14:37:04  bg-config    ok        ← de novo, um segundo depois
 *     14:37:04  sync-start   state=active
 *
 * A chave certa é `session?.user.id`: entrou alguém, saiu alguém. Renovar
 * credencial do mesmo usuário não é evento para esses efeitos.
 *
 * A guarda é de código-fonte porque o projeto não tem renderer de React — e
 * porque o modo de falha não é de lógica: cada efeito, isolado, está correto.
 * O que erra é a frequência com que ele roda, e isso só aparece em device.
 */
import { describe, it, expect } from '@jest/globals';
import { readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';

const APP = join(__dirname, '..', '..', 'app');

/**
 * Array de dependências que é EXATAMENTE `[session]`. Listas com mais chaves
 * (ex.: `[session, segments, isLoading]`, a navegação de auth) ficam de fora:
 * elas são idempotentes e reexecutar não custa assinatura nenhuma.
 */
const DEP_SO_SESSION = /\}\s*,\s*\[\s*session\s*\]\s*\)/;

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

describe('BARREIRA — efeitos usam id da sessão, não o objeto', () => {
  it('nenhum efeito depende só de `session` (rearma a cada renovação de token)', () => {
    const offenders: string[] = [];

    for (const file of sourceFiles(APP)) {
      const contents = readFileSync(file, 'utf8');
      contents.split('\n').forEach((line, i) => {
        if (/^\s*(\/\/|\*|\/\*)/.test(line)) return;
        if (DEP_SO_SESSION.test(line)) {
          offenders.push(`${file.slice(APP.length + 1)}:${i + 1}: ${line.trim()}`);
        }
      });
    }

    expect(offenders).toEqual([]);
  });
});
