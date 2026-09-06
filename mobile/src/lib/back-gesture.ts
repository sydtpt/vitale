/**
 * A faixa da esquerda que pertence ao iOS, e não ao app.
 *
 * **O problema.** O swipe-back do stack nativo é um reconhecedor de *borda*: ele
 * escuta arrastos que começam nos primeiros pontos da tela. Um `PanResponder` do
 * JS que ocupe essa mesma faixa não tira o gesto dele — o sistema de responder
 * do React Native não cancela reconhecedores nativos do `react-native-screens`.
 * Os dois disparam, e o resultado é arrastar o gráfico *e* voltar de tela.
 *
 * Isso atinge qualquer controle horizontal encostado na borda: o scrub do perfil
 * de elevação e o trilho de fotos são de largura de janela inteira, então os
 * ~50 px iniciais deles são a faixa do sistema.
 *
 * **A saída.** Não reivindicar o toque que *nasce* dentro da faixa. Quem começa
 * ali está pedindo para voltar; quem começa fora está arrastando o controle — e,
 * uma vez dono do gesto, o `PanResponder` continua funcionando mesmo que o dedo
 * entre na faixa. O único custo é não poder *iniciar* um scrub nos primeiros
 * 56 px, o que é barato num controle que ocupa a tela toda.
 *
 * **Quando isto não serve.** Se o controle for estreito e o alvo útil cair
 * dentro da faixa — o polegar de um slider no valor mínimo, por exemplo — não há
 * o que guardar: a tela inteira precisa desligar o `gestureEnabled` e oferecer
 * o botão de voltar no cabeçalho.
 */
export const BACK_GESTURE_EDGE = 56;

/** `true` quando o toque nasceu fora da faixa do sistema e pode ser reivindicado. */
export function foraDaBordaDeVoltar(pageX: number): boolean {
  return pageX > BACK_GESTURE_EDGE;
}
