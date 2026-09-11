/**
 * Número em pt-BR, com um dono só (AD-6).
 *
 * Morava em `ia/prompt.ts`, onde a revista o usa para escrever os fatos. Mudou
 * para cá na story 5.2 porque deixou de ter um consumidor só: na Saúde do sono o
 * motor não escreve algarismo, e todo valor entra por marcador, trocado pelo
 * fato já formatado — por esta função (5.3). Formatação que mora no prompt de um
 * recurso é formatação que o próximo recurso copia.
 *
 * A simetria que ela sustenta continua a mesma: o `ia/verificar.ts` lê de volta
 * no mesmo formato. Se o modelo lê "40,1 h" e escreve "40,1 h", a conferência
 * casa; se um lado usasse ponto e o outro vírgula, toda frase correta seria
 * reprovada.
 *
 * `ia/prompt.ts` a reexporta com o mesmo nome, para os testes da conferência
 * seguirem sem edição, e é por lá que o barril a alcança — um caminho público
 * basta. Por isso, fora do núcleo, a guarda (7) do `architecture.test.ts` ainda a
 * conta como peça de IA, pelo reexporte de `ia/prompt`: o app que precisar dela
 * muda antes o import de `ia/verificar.test.ts` para `format/numero` — aí o
 * reexporte sai de `ia/prompt` e o barril passa a exportá-la daqui.
 */

/** Número em pt-BR: vírgula decimal, ponto de milhar. */
export function formatarNumero(v: number, casas: number): string {
  const fixo = Math.abs(v).toFixed(casas);
  const [inteira, decimal] = fixo.split('.');
  const comMilhar = inteira.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const corpo = decimal ? `${comMilhar},${decimal}` : comMilhar;
  return v < 0 ? `−${corpo}` : corpo;
}
