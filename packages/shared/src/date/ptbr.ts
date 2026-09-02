/**
 * Nomes de calendário pt-BR — fonte única.
 *
 * Antes disto o app carregava cinco cópias de 'jan…dez' e três convenções de
 * dia da semana espalhadas por shared e mobile; a quinta cópia (detalhe de
 * Registros) foi a gota. Dois ordenamentos convivem de propósito: os arrays
 * sem sufixo são indexados por `Date.getDay()` (domingo primeiro, como o JS
 * devolve), e os `_SEG` começam na segunda — a ordem em que as grades do app
 * desenham a semana (retro, heatmap, detalhe). Exportar os dois torna a
 * escolha visível no import; converter com `(getDay()+6)%7` no ponto de uso a
 * escondia.
 */

export const MESES_ABREV = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

export const MESES_COMPLETOS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

/** Iniciais para eixos apertados (sazonalidade) — ambíguas de propósito, o eixo dá o contexto. */
export const MESES_INICIAIS = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];

/** Indexados por `Date.getDay()`: domingo primeiro. */
export const DIAS_LETRAS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];
export const DIAS_ABREV = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];

/** Segunda-first: a ordem das grades (retro, heatmap, detalhe, semana). */
export const DIAS_LETRAS_SEG = ['S', 'T', 'Q', 'Q', 'S', 'S', 'D'];
export const DIAS_ABREV_SEG = ['seg', 'ter', 'qua', 'qui', 'sex', 'sáb', 'dom'];
export const DIAS_COMPLETOS_SEG = ['segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado', 'domingo'];
