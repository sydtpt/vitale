import React, { useId, useMemo } from 'react';
import { Image, StyleSheet, View, type ViewStyle } from 'react-native';
import Svg, { Defs, RadialGradient, Path, Rect, Stop } from 'react-native-svg';
import {
  moonPhase,
  moonPhaseLabel,
  moonShadowPath,
  MOON_GLOW_ALPHA,
  MOON_SHADE_ALPHA,
  type MoonPhase,
} from '@vitale/shared';
import { useTheme } from '../theme';

/**
 * A lua da fase do dia, no cabeçalho da Home.
 *
 * ## O que é foto e o que é desenho
 *
 * A foto é uma **lua cheia** do LRO/NASA (domínio público), recortada em disco
 * com alfa. A fase não vem da foto: é um caminho de sombra por cima, calculado
 * em `astro/moon.ts`. Uma imagem só cobre as 29,5 dias da lunação inteira, e o
 * que se perde é o relevo real junto ao terminador — que a 64 pt não existe.
 *
 * ## A sombra tende ao fundo, não ao preto
 *
 * `colors.moonShade` é o `bg` do tema. No escuro isso deixa a parte não
 * iluminada sumir e sobra o crescente, como no céu; no claro ela dissolve na
 * página em vez de virar uma mancha — um preto cravado media 17,79:1 de
 * contraste contra o branco do tema Clean, seis vezes mais que a própria lua
 * iluminada. As opacidades por esquema estão em `MOON_SHADE_ALPHA`, com a
 * justificativa de cada uma.
 *
 * ## O halo
 *
 * Um gradiente radial atrás do disco, com a força acompanhando a iluminação —
 * a lua cheia brilha, a nova quase some. Ele é o que segura o canto nos ~3 dias
 * de lua nova, em que não sobra lua nenhuma para desenhar.
 */

interface Props {
  /** Instante a representar. Padrão: agora. */
  date?: Date;
  /**
   * Diâmetro do disco, em pt. O padrão é o do cabeçalho: 42 é a altura da caixa
   * da serifa da saudação (`lineHeight` 42), então a lua ocupa exatamente a
   * linha e não sobra acima nem abaixo dela. Calibrado no aparelho — 64 e 52
   * mediam bem no monitor e puxavam o olho antes do texto na tela do telefone.
   */
  size?: number;
  style?: ViewStyle;
}

/** Quanto o halo se estende além do disco. */
const HALO_SCALE = 2.7;

export function MoonBadge({ date, size = 42, style }: Props) {
  const { colors, scheme } = useTheme();
  // O `id` do gradiente é global no documento SVG; duas luas na mesma tela com
  // o mesmo id fariam a segunda herdar o halo da primeira.
  const gradientId = `moonHalo-${useId()}`;

  // `date` costuma vir de um `new Date()` do chamador, então a identidade muda
  // a cada render dele; a fase depende do dia, não do milissegundo.
  const stamp = date ? Math.floor(date.getTime() / 3_600_000) : Math.floor(Date.now() / 3_600_000);
  const phase: MoonPhase = useMemo(() => moonPhase(new Date(stamp * 3_600_000)), [stamp]);

  const halo = HALO_SCALE * size;
  const shadow = moonShadowPath(100, phase);
  // A força acompanha a iluminação, mas com piso: na lua nova o halo fica
  // discreto em vez de apagar, porque nesses dias ele é a única coisa no canto.
  const haloOpacity = MOON_GLOW_ALPHA[scheme] * (0.3 + 0.7 * phase.illuminated);

  return (
    <View
      style={[styles.root, { width: size, height: size }, style]}
      accessible
      accessibilityRole="image"
      accessibilityLabel={moonPhaseLabel(phase)}
    >
      {/* Deslocamento em pt, não em porcentagem: o halo é maior que o pai e o
          `overflow` visível de um filho posicionado por `%` diverge entre as
          plataformas. */}
      <Svg
        width={halo}
        height={halo}
        style={[styles.abs, { left: (size - halo) / 2, top: (size - halo) / 2 }]}
        pointerEvents="none"
      >
        <Defs>
          <RadialGradient id={gradientId} cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={colors.moonGlow} stopOpacity={haloOpacity} />
            <Stop offset="0.72" stopColor={colors.moonGlow} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect x="0" y="0" width={halo} height={halo} fill={`url(#${gradientId})`} />
      </Svg>

      <Image
        source={require('../../assets/images/moon.png')}
        style={{ width: size, height: size }}
        resizeMode="contain"
      />

      {/* O caminho da sombra é fechado pelo limbo, então nunca escapa do disco;
          só o desfoque do terminador precisa do recorte redondo do `root`. */}
      <Svg
        width={size}
        height={size}
        viewBox="-100 -100 200 200"
        style={[styles.abs, { left: 0, top: 0 }]}
        pointerEvents="none"
      >
        <Path d={shadow} fill={colors.moonShade} opacity={MOON_SHADE_ALPHA[scheme]} />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { position: 'relative', alignItems: 'center', justifyContent: 'center' },
  abs: { position: 'absolute' },
});
