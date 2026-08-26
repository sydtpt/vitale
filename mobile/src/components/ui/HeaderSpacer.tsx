import React from 'react';
import { View } from 'react-native';

/**
 * O slot vazio à direita do cabeçalho.
 *
 * Todo header do app é uma linha de três slots — `[voltar] [título] [ação]` —
 * e o título é centralizado por `flex: 1` + `textAlign: 'center'`. Isso só
 * centraliza de verdade se os dois lados tiverem a mesma largura, então as
 * telas sem ação à direita precisam de um contrapeso.
 *
 * O contrapeso era escrito como `<View style={styles.backBtn} />`, reaproveitando
 * o estilo do próprio botão de voltar — que traz `backgroundColor: colors.surface`
 * e `...shadows.card`. O resultado eram 18 telas com um disco branco sombreado
 * no canto superior direito, sem conteúdo e sem `onPress`. No detalhe da
 * atividade ele ficava exatamente onde o botão "Salvar" aparece quando há
 * edição, então lia como um botão quebrado.
 *
 * Espaçador é geometria, não superfície: aqui não há cor, e por isso o
 * componente não lê tema.
 *
 * @param size largura/altura do botão que ele contrabalança (padrão 36 — o
 *   tamanho do `backBtn`/`iconBtn` na maioria das telas).
 */
export function HeaderSpacer({ size = 36 }: { size?: number }) {
  return <View style={{ width: size, height: size }} pointerEvents="none" />;
}
