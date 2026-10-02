/**
 * Texto legível para o que deu errado — inclusive quando o erro não é um `Error`.
 *
 * ## Por que isto existe
 *
 * O padrão espalhado pelo app é `e instanceof Error ? e.message : String(e)`, e ele tem
 * um buraco que custou caro em 02/10/2026: **o erro do Supabase não é um `Error`**. O
 * `PostgrestError` é um objeto simples — `{ message, code, details, hint }` —, então o
 * `String(e)` cai no `Object.prototype.toString` e a tela mostra, com todas as letras,
 * `[object Object]`.
 *
 * O caso real: o primeiro toque em "Enviar para o banco" falhou com
 * `42P10: there is no unique or exclusion constraint matching the ON CONFLICT
 * specification` — uma causa precisa, com código e tudo — e o que apareceu no aparelho
 * foi `[object Object]`. O erro estava na mão e **a tela o jogou fora**.
 *
 * Um diagnóstico que chega ilegível é um diagnóstico perdido, e perder o do Postgres é
 * caro porque ele é dos poucos que já vêm com código e dica.
 */

/** Campos que o `PostgrestError` traz e que valem a pena mostrar, em ordem de utilidade. */
interface ErroDeBanco {
  message?: unknown;
  code?: unknown;
  details?: unknown;
  hint?: unknown;
}

function texto(v: unknown): string | null {
  return typeof v === 'string' && v.trim().length > 0 ? v.trim() : null;
}

/**
 * Devolve algo que uma pessoa consegue ler e repetir.
 *
 * Ordem: a mensagem, o código entre parênteses (é o que se procura), e os detalhes ou a
 * dica quando existem — o Postgres costuma pôr ali o nome do objeto que faltou.
 */
export function mensagemDeErro(e: unknown): string {
  if (e instanceof Error && texto(e.message)) return e.message;
  if (typeof e === 'string' && texto(e)) return e;

  if (e !== null && typeof e === 'object') {
    const o = e as ErroDeBanco;
    const msg = texto(o.message);
    const code = texto(o.code);
    const extra = texto(o.details) ?? texto(o.hint);
    if (msg) {
      return [msg, code ? `(${code})` : null, extra].filter(Boolean).join(' ');
    }
    // Sem `message`, o JSON ainda é mil vezes melhor que `[object Object]`.
    try {
      const j = JSON.stringify(e);
      if (j && j !== '{}') return j;
    } catch {
      // objeto com ciclo: cai no genérico abaixo
    }
  }

  return String(e);
}
