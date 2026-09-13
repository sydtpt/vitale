import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { HeaderSpacer } from './HeaderSpacer';
import { colors, fonts, radii, spacing, useThemedStyles } from '../../theme';

/**
 * O cabeçalho de uma tela de pilha: `[voltar] [título] [ação]`.
 *
 * O padrão existia em ~20 telas **copiado**, e a cópia já tinha divergido: mesma
 * linha com botão de 36 e de 38, e um `HeaderSpacer` que nasceu justamente de uma
 * cópia que reaproveitou o estilo errado e deixou um disco branco sombreado em 18
 * telas. Enquanto a geometria mora em cada tela, a próxima cópia volta a divergir.
 *
 * O tamanho é **um só** (38, o molde das subviews de sono) nos dois lados, porque o
 * título é centralizado por `flex: 1` + `textAlign: 'center'` — e isso só centraliza
 * de verdade quando os dois lados medem igual.
 *
 * A ação é declarada como dado, não passada como nó, para que o botão dela herde a
 * mesma caixa do botão de voltar: um ícone solto no slot fica fora do eixo.
 */
export const TAMANHO_DO_BOTAO = 38;

export interface AcaoDoCabecalho {
  readonly icone: keyof typeof Ionicons.glyphMap;
  /** O único texto que um botão de ícone tem — é o que o VoiceOver fala. */
  readonly label: string;
  readonly cor: string;
  readonly onPress: () => void;
  readonly desabilitado?: boolean;
  /** Em curso: o VoiceOver anuncia `busy`, e o toque não passa. */
  readonly ocupado?: boolean;
}

export function ScreenHeader({ titulo, acao }: { titulo: string; acao?: AcaoDoCabecalho }) {
  const s = useThemedStyles(createStyles);
  const router = useRouter();
  return (
    <View style={s.header}>
      <Pressable
        onPress={() => router.back()}
        hitSlop={12}
        accessibilityRole="button"
        accessibilityLabel="Voltar"
        style={({ pressed }) => [s.botao, pressed && s.pressed]}
      >
        <Ionicons name="chevron-back" size={22} color={colors.ink} />
      </Pressable>
      <Text style={s.titulo}>{titulo}</Text>
      {acao ? (
        <Pressable
          onPress={acao.onPress}
          disabled={acao.desabilitado}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel={acao.label}
          accessibilityState={
            acao.desabilitado ? { disabled: true, ...(acao.ocupado ? { busy: true } : {}) } : {}
          }
          style={({ pressed }) => [s.botao, pressed && s.pressed]}
        >
          <Ionicons name={acao.icone} size={21} color={acao.cor} />
        </Pressable>
      ) : (
        <HeaderSpacer size={TAMANHO_DO_BOTAO} />
      )}
    </View>
  );
}

const createStyles = () =>
  StyleSheet.create({
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
    },
    botao: {
      width: TAMANHO_DO_BOTAO,
      height: TAMANHO_DO_BOTAO,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: radii.md,
    },
    titulo: { flex: 1, textAlign: 'center', fontSize: 17, fontFamily: fonts.sansBold, color: colors.ink },
    pressed: { opacity: 0.7 },
  });
