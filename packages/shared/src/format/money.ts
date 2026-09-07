/**
 * Dinheiro na tela, num lugar só.
 *
 * O app nasceu com `R$` escrito à mão em cada tela, mas quem o usa mora na
 * Bélgica: os 9 itens de Compras com preço, o gasto da semana e o preço médio
 * de um hábito são todos em **euro**. Símbolo espalhado por seis arquivos é
 * como duas telas vizinhas passam a discordar sobre a moeda — o mesmo motivo
 * que fez a cor de célula de hábito virar função única.
 *
 * Não é conversão de moeda: é o símbolo e a pontuação de um único mercado.
 * O dia em que houver mais de um, isto vira o ponto de costura.
 */

/** Símbolo da moeda do app. */
export const CURRENCY = '€';

/** Número em pt-BR (vírgula decimal, ponto de milhar) — a pontuação do resto do app. */
function fmtNum(v: number, decimals: number): string {
  return v.toLocaleString('pt-BR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/**
 * Valor com o símbolo colado à esquerda: `€292`, `€11,00`, `−€8,50`.
 * O sinal fica antes do símbolo (é o valor que é negativo, não a moeda).
 */
export function fmtMoney(v: number, decimals = 0): string {
  const sign = v < 0 ? '−' : '';
  return `${sign}${CURRENCY}${fmtNum(Math.abs(v), decimals)}`;
}

/**
 * Casas decimais escolhidas pela ordem de grandeza: a partir de €10 o centavo
 * é ruído (`≈€292` numa estimativa de ±15% não ganha nada com `,50`), abaixo
 * disso ele é a informação — dois cigarros a €0,45 seriam "€1" sem ele.
 */
export function fmtMoneyAuto(v: number): string {
  return fmtMoney(v, Math.abs(v) >= 10 ? 0 : 2);
}
