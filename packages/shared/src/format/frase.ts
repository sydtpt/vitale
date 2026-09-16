/**
 * Onde uma frase termina, com um dono só (story 1.8).
 *
 * Morava dentro de `limitesDaFrase`, em `ia/verificar.ts`, como a regra inline
 * `corta` da conferência da base (story 1.4). Saiu para cá quando ganhou um
 * segundo leitor: a **chamada** (`revista/chamada.ts`), a primeira frase de um
 * caderno lida sozinha na capa, no sumário e na parede. A conferência decide qual
 * base está colada a um número pelos limites da frase; se a chamada cortasse num
 * ponto em que a conferência não corta, um número chegaria à capa separado da
 * base que a conferência achou na mesma frase. Com uma regra só, as duas nunca
 * discordam sobre onde uma frase acaba.
 *
 * **Refatoração pura.** O corpo é o de `corta`, sem mudança nenhuma: mudar o que
 * termina frase aqui muda o que a conferência reprova — e isso só se faz
 * perguntando ao dono. A chamada pode **pular** um corte daqui (abreviação,
 * ponto colado a letra), e fica mais longa; nunca corta onde esta regra não corta.
 *
 * **Interna ao núcleo.** Não sai pelo barril, e o `architecture.test.ts` barra o
 * import profundo dela fora de `packages/shared`: quem precisa de uma frase pede
 * a chamada, não escreve um corte à mão sobre esta regra.
 *
 * Sem imports: é folha, e continua folha.
 */

/**
 * O caractere na posição `i` (índice UTF-16) termina uma frase?
 *
 * Termina em quebra de linha, `!`, `?` e `.` — exceto o ponto entre dois
 * dígitos, que é milhar em pt-BR. Não sabe de abreviação: "aprox." termina frase
 * aqui, e é a chamada quem a pula.
 */
export function terminaFrase(texto: string, i: number): boolean {
  const c = texto[i];
  if (c === '\n' || c === '!' || c === '?') return true;
  if (c !== '.') return false;
  // Ponto de milhar não termina frase: "16.315" é um número, não duas frases.
  const a = texto[i - 1] ?? '';
  const b = texto[i + 1] ?? '';
  return !(/\d/.test(a) && /\d/.test(b));
}
