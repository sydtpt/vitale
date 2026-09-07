/**
 * Narração da camada de IA analítica (verify_jwt=true).
 * Spec: docs/specs/ia-analitica/spec.md · ADRs 0038 e 0040.
 *
 *   POST /ia-narrar   (JWT do usuário)
 *     body { sistema: string, usuario: string }
 *     → { texto, provedor, modelo, tokens: { entrada, saida } }
 *
 * ## Por que esta function é burra de propósito
 *
 * Ela não monta o pacote de fatos, não escreve o prompt e não confere a resposta.
 * Tudo isso é derivação pura e mora em `packages/shared/src/ia/`, onde roda no
 * aparelho — que é onde a Retrospectiva já é calculada (1.177 linhas de núcleo no
 * telefone). Duplicar essa lógica aqui criaria duas implementações da mesma conta,
 * e é assim que a manchete passa a divergir da tela que o usuário está olhando.
 *
 * O que sobra para o servidor é a única coisa que o cliente não pode fazer:
 * **guardar a chave**. É o mesmo motivo pelo qual a `cultura-search` existe
 * (CAP-7, segredo do TMDB) — precedente já julgado neste repositório.
 *
 * Consequência de arquitetura: esta function **não importa nada de
 * `packages/shared`**. A barreira do `architecture.test.ts` exige que módulo do
 * núcleo consumido pelo Deno não tenha import nenhum, e `ia/pacote.ts` tem
 * imports de tipo. Como o pacote atravessa como JSON já serializado em prompt,
 * não há tipo a compartilhar em tempo de execução.
 *
 * `verify_jwt=true` não é sobre dado do usuário — o corpo já chega pronto. É para
 * a function não virar proxy aberto queimando o crédito Prepay dele.
 *
 * Segredos: AI_PROVIDER, AI_MODEL e a credencial do provedor (ver `_shared/ia/narrador.ts`).
 */
import { json, preflight } from '../_shared/auth.ts';
import { resolverNarrador } from '../_shared/ia/narrador.ts';

/** Teto de entrada. O pacote de um período fechado não passa disso nem de longe. */
const MAX_CHARS = 60_000;

Deno.serve(async (req: Request): Promise<Response> => {
  const pre = preflight(req);
  if (pre) return pre;

  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  let body: { sistema?: unknown; usuario?: unknown; json?: unknown };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'json_invalido' }, 400);
  }

  const sistema = typeof body.sistema === 'string' ? body.sistema : '';
  const usuario = typeof body.usuario === 'string' ? body.usuario : '';
  // Repassa a intenção sem interpretá-la — a function continua burra (ADR 0042).
  const querJson = body.json === true;

  if (!sistema.trim() || !usuario.trim()) return json({ error: 'prompt_vazio' }, 400);
  if (sistema.length + usuario.length > MAX_CHARS) {
    return json({ error: 'prompt_muito_longo', max: MAX_CHARS }, 413);
  }

  let resolvido: ReturnType<typeof resolverNarrador>;
  try {
    resolvido = resolverNarrador();
  } catch (e) {
    // Configuração faltando é erro de operação, não do chamador — e a mensagem
    // diz qual segredo falta, para não virar caça ao tesouro.
    console.error('ia-narrar config:', e);
    return json({ error: 'provedor_nao_configurado', detalhe: String(e) }, 503);
  }

  try {
    const n = await resolvido.narrador.narrar(
      { sistema, usuario, json: querJson },
      resolvido.modelo,
      resolvido.chave,
    );
    return json(n);
  } catch (e) {
    // 502 e não 500: quem falhou foi o provedor. A mensagem carrega o status e o
    // corpo dele — sem isso, cota esgotada e chave inválida chegam idênticas no
    // aparelho (a lição do Overpass, 06/09).
    console.error('ia-narrar:', e);
    return json({ error: 'narracao_falhou', detalhe: String(e) }, 502);
  }
});
