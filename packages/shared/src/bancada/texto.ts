/**
 * Como a bancada **escreve** um número — puro, e com um dono só (story 5.13).
 *
 * O relatório do Mac e a tela do iPhone mostram as mesmas medidas; escrever "86,4%" de um
 * lado e "86.4%" do outro, ou "13,6 s" e "13600 ms", faria a comparação passar por uma
 * tradução na cabeça do dono. Estas quatro funções moram aqui pelo mesmo motivo que as
 * medidas: duas cópias divergem na primeira correção de uma delas.
 *
 * Vírgula decimal porque é como ele lê, e `—` para "não há" — nunca `0` nem `NaN`, que se
 * confundem com medida.
 */
import { MOTIVOS_FORA_DA_MEDIDA, type ForaDaMedida } from './medidas';

/** Número com vírgula decimal. */
export function decimal(n: number, casas = 1): string {
  return n.toFixed(casas).replace('.', ',');
}

/** `parte ÷ todo` em por cento — `—` quando não há denominador. */
export function porcento(parte: number, todo: number): string {
  return todo === 0 ? '—' : `${decimal((parte / todo) * 100)}%`;
}

/** Milissegundos em segundos — `—` quando não há medida. */
export function segundos(ms: number | null): string {
  return ms === null ? '—' : `${decimal(ms / 1000)} s`;
}

/**
 * O hash curto, para o cabeçalho do Markdown, o nome de arquivo e a lista da tela — os
 * mesmos 12 primeiros dos dois lados, que é o que faz a comparação por hash (AD-11) ser
 * feita a olho.
 */
export function hashCurto(hash: string): string {
  return hash.slice(0, 12);
}

/**
 * Os motivos de ficar fora da medida, em singular e plural: "1 defeito" e "2 defeitos",
 * "1 sintética" e "3 sintéticas". A concordância importa porque estes números são lidos
 * numa frase, não numa tabela.
 */
const ROTULO_FORA: Readonly<Record<ForaDaMedida, { readonly um: string; readonly muitos: string }>> = {
  semChamada: { um: 'sem chamada', muitos: 'sem chamada' },
  sintetica: { um: 'sintética', muitos: 'sintéticas' },
  defeito: { um: 'defeito', muitos: 'defeitos' },
  indisponivel: { um: 'indisponível', muitos: 'indisponíveis' },
  doHospedeiro: { um: 'do hospedeiro', muitos: 'do hospedeiro' },
};

/**
 * O que ficou fora da medida, por motivo e **na ordem de precedência**
 * ({@link MOTIVOS_FORA_DA_MEDIDA}) — `nenhuma` quando nada ficou.
 */
export function foraEmTexto(fora: Readonly<Record<ForaDaMedida, number>>): string {
  const partes = MOTIVOS_FORA_DA_MEDIDA.filter((m) => fora[m] > 0).map(
    (m) => `${fora[m]} ${fora[m] === 1 ? ROTULO_FORA[m].um : ROTULO_FORA[m].muitos}`,
  );
  return partes.length > 0 ? partes.join(' · ') : 'nenhuma';
}
