/**
 * A lista de motores de nuvem aprovados, por recurso (ADR 0048, story 5.6).
 *
 * Vem de um `secret` — `NUVEM_MOTORES_APROVADOS`, JSON de
 * `MotorDeNuvemAprovado[]` — e não de código: trocar quem está aprovado para
 * quê é `supabase secrets set`, não deploy. `ia-narrar` expõe esta lista ao
 * app (GET, sem corpo) e a lê de novo para decidir se um `motor` pedido no
 * corpo do POST é aceito.
 *
 * **Nunca lança, e nunca derruba `nuvem:padrao`.** Secret ausente, JSON
 * inválido ou entrada malformada devolvem lista vazia — `nuvem:padrao`
 * continua elegível por conta própria (é o hospedeiro, não esta lista, que
 * decide isso). Ver `packages/shared/src/ia/fio.ts#lerMotoresDeNuvemAprovados`,
 * que faz a leitura de verdade — este arquivo só sabe o nome do secret.
 *
 * ## O formato, para quem for rodar `supabase secrets set`
 *
 *     NUVEM_MOTORES_APROVADOS='[
 *       {"motor":"nuvem:google/gemini-2.5-flash","recursos":["saude-do-sono","retrospectiva"]}
 *     ]'
 *
 * `motor` é sempre `nuvem:<provedor>/<modelo>` — o `<provedor>` tem de ser um
 * dos adaptadores de `narrador.ts`, e `<modelo>` o id que aquele provedor
 * atende. `recursos` são os `RecursoId` para os quais a bancada aprovou esse
 * motor (ADR 0048, decisão 6): a aprovação é **por recurso**, não global.
 *
 * `nuvem:padrao`, `sem-modelo` e `aparelho:*` **não entram** e são descartados
 * na leitura: o padrão não depende de lista, e os outros dois tipos não são
 * desta lista.
 *
 * **Provedor novo entra com regime** (ADR 0048, decisão 5, e a pendência da
 * ADR 0040). Antes de um `<provedor>` novo aparecer aqui, a tabela de regime
 * dele — tier exigido, o que pode ser enviado, retenção, DPA, uso para treino e
 * o que ele faz com o guardrail — tem de estar versionada em `docs/`. Modelo
 * novo de um provedor que já tem adaptador e regime é configuração; provedor
 * novo é um adaptador **mais** um documento. Esta função não tem como cobrar
 * isso — a lista mora num `secret`, fora do git —, e um cabeçalho de `.ts` não é
 * o caminho de quem roda `supabase secrets set`. Por isso a regra mora, como
 * item de checklist, no runbook do deploy:
 *
 *   `_bmad-output/implementation-artifacts/motores-5-6/deploy-da-lista.md`
 *
 * É lá que está o formato do secret, a ordem (deploy antes do build) e os seis
 * campos que a tabela de regime precisa ter.
 */
import {
  lerMotoresDeNuvemAprovados,
  type MotorDeNuvemAprovado,
} from '../../../../packages/shared/src/ia/fio.ts';

const SECRET = 'NUVEM_MOTORES_APROVADOS';

/**
 * A lista aprovada, lida do ambiente. Nunca lança.
 *
 * **Toda entrada descartada vira log.** O secret é editado à mão, e uma entrada
 * que some em silêncio é o motor que o dono aprovou e nunca aparece no seletor —
 * sem erro, sem rastro, e sem nada para procurar. O que o log carrega é o id do
 * motor e o motivo; `sistema` e `usuario` não passam por aqui e nunca passarão.
 */
export function lerMotoresAprovados(): readonly MotorDeNuvemAprovado[] {
  const bruto = Deno.env.get(SECRET);
  if (!bruto) return [];
  try {
    return lerMotoresDeNuvemAprovados(JSON.parse(bruto), (motivo, item) => {
      console.error(`${SECRET}: entrada descartada (${motivo}):`, item);
    });
  } catch (e) {
    // JSON quebrado no secret é erro de operação, não do chamador — mas não é
    // motivo para a function inteira parar de narrar. Só a lista fica vazia.
    console.error(`${SECRET} ilegível:`, e);
    return [];
  }
}

// Quem decide se um motor pedido está aprovado é `alvoDoMotorPedido`, no núcleo
// (`ia/fio.ts`), recebendo esta lista por parâmetro. Este arquivo só sabe o nome
// do secret e como lê-lo: a decisão mora onde há teste.
