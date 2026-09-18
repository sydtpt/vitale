import React from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { corComAlfa } from '../../lib/veu';
import { colors, onMedia, useThemedStyles } from '../../theme';

/**
 * A marca do toque da capa (Story 1.16) — **a única coisa nova na capa**.
 *
 * Um disco translúcido no canto do véu, com a marca de abrir. Sem ele a capa não
 * anuncia que abre; com um ícone maior ela vira botão e deixa de ser capa
 * (decisão do dono sobre o canvas, 18/09).
 *
 * ## Quem é o botão
 *
 * **Para quem vê, a capa inteira é o alvo** — o disco só avisa. **Para o
 * VoiceOver, o disco é O botão** ("Ver a foto da capa"): embrulhar a capa inteira
 * num botão juntaria período, manchete e legenda num rótulo só, e calaria a
 * manchete como texto de leitura. Por isso a capa em volta é tocável e **não é
 * acessível** como nó, e este disco é.
 *
 * ## As duas superfícies
 *
 * - **sobre a foto** — `onMedia` com alfa, como o véu: a foto não tem tema, então o
 *   disco também não tem (é a isenção declarada de `onMedia`);
 * - **sobre o papel** — a capa de foto cuja imagem não resolveu cai no papel e
 *   continua abrindo (a ficha sabe o que a foto era). Ali o branco translúcido
 *   sumiria, então o disco sai do tema: `surfaceMute` com o traço em `ink2`, que
 *   passa o piso de 3,0 de objeto gráfico.
 */
export function MarcaDoToque({ sobre, onPress }: { sobre: 'foto' | 'papel'; onPress: () => void }) {
  const styles = useThemedStyles(createStyles);
  const naFoto = sobre === 'foto';
  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel="Ver a foto da capa"
      style={({ pressed }) => [
        styles.disco,
        { backgroundColor: naFoto ? corComAlfa(onMedia, 0.16) : colors.surfaceMute },
        pressed && styles.pressionado,
      ]}
    >
      <Ionicons name="resize-outline" size={16} color={naFoto ? onMedia : colors.ink2} />
    </Pressable>
  );
}

/** 32 de diâmetro, como no canvas; o `hitSlop` leva o alvo aos 48. */
const createStyles = () =>
  StyleSheet.create({
    disco: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
    pressionado: { opacity: 0.7 },
  });
