/**
 * Quanto falta, em palavras — puro, e sem importar nada.
 *
 * Vive sozinho porque é formatação de texto e precisa ser testável: quando
 * morava dentro de `FaixaDeTrabalho`, importá-lo num teste arrastava o tema, a
 * store de configurações e o cliente do Supabase, e a suíte nem subia.
 */

/**
 * Em horas acima de uma hora, e não em minutos: a espera do piso é de 6 h, e a
 * primeira versão escreveu **"aguarde 360 min"** na tela do dono (10/10/2026).
 * Minuto é a unidade de "daqui a pouco"; passada a hora, ninguém converte de
 * cabeça.
 */
export function esperaEmPalavras(ate: number, agora: number): string {
  const faltam = Math.max(0, ate - agora);
  const min = Math.ceil(faltam / 60_000);
  if (min <= 1) return 'menos de 1 min';
  if (min < 60) return `${min} min`;
  const h = Math.round(min / 60);
  return h === 1 ? '1 hora' : `${h} horas`;
}
