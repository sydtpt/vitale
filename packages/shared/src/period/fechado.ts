/**
 * A regra de edição — quando um período **fechou**.
 * Spec: docs/specs/ia-analitica/spec.md, §3 · Story 1.10.
 *
 * ## Por que mora em `period/`, e não em `ia/`
 *
 * Nasceu em `ia/pacote.ts`, porque o pacote é quem carimba `periodo.fechado`.
 * Mas ela não é peça de IA: é a pergunta sobre o **relógio** que separa "não tem
 * edição" de "não tem edição AINDA", e a leitura da edição no celular precisa
 * dela sem montar pacote nenhum. Enquanto ela morava em `ia/`, o app importava
 * uma peça do núcleo de IA só para perguntar a data — e a guarda (7) do
 * `architecture.test.ts` não chegava a zero por causa disso.
 *
 * O pacote continua a chamá-la, daqui. Não há reexporte por `ia/pacote`: um
 * caminho só, para a guarda não ter de adivinhar qual dos dois o app usou.
 */
import type { PeriodKind } from './bounds';

/** `YYYY-MM-DD` local — mesma convenção do `retro.ts`. */
function diaLocal(d: Date): string {
  const p = (n: number) => (n < 10 ? `0${n}` : `${n}`);
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/**
 * Um período está **fechado** quando o último dia dele já passou.
 *
 * É a regra de edição da §3 do spec, e não é otimização: um jornal não reescreve
 * a edição de terça. Período fechado congela; período em curso não ganha
 * parágrafo, porque consultar "setembro" no dia 6 guardaria uma análise de seis
 * dias sob um rótulo de trinta.
 *
 * `all` nunca fecha, por definição — sempre cabe mais um dia.
 */
export function periodoFechado(tipo: PeriodKind, fimISO: string, agora: Date): boolean {
  if (tipo === 'all') return false;
  return diaLocal(agora) > fimISO;
}
