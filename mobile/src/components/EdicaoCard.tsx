import React from 'react';
import { View, Text, Pressable, ActivityIndicator, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { Edicao, Problema } from '@vitale/shared';
import { colors, fonts, radii, shadows, spacing, useThemedStyles } from '../theme';

/**
 * A edição — o parágrafo de abertura escrito por modelo (ADRs 0038 e 0040).
 *
 * Três decisões de tela que vêm do desenho, não do gosto:
 *
 * 1. **Período em curso não aparece.** Não é botão desabilitado nem aviso: é
 *    ausência. Um jornal não anuncia a edição que ainda não fechou.
 * 2. **Imprimir é ato, não efeito colateral.** O botão existe porque a chamada
 *    custa dinheiro; folhear o histórico não pode gastar. Uma vez impressa, a
 *    edição congela e nunca é reescrita sozinha.
 * 3. **A assinatura fica visível.** Provedor, modelo e data embaixo do texto.
 *    O leitor precisa saber que aquilo foi escrito por máquina, e qual — é a
 *    mesma razão pela qual jornal assina coluna.
 */

export type FaseEdicao =
  | { fase: 'vazio' }
  | { fase: 'carregando' }
  | { fase: 'gerando' }
  | { fase: 'pronta'; edicao: Edicao }
  | { fase: 'aberto' }
  | { fase: 'reprovada'; problemas: Problema[] }
  | { fase: 'erro'; mensagem: string };

interface Props {
  estado: FaseEdicao;
  onGerar: () => void;
  /** Marca a edição como possivelmente defasada — o dado embaixo dela mudou. */
  errata?: boolean;
}

const DATA = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });

function assinatura(e: Edicao): string {
  const quando = DATA.format(new Date(e.geradoEm));
  return `${e.modelo} · ${quando}`;
}

export function EdicaoCard({ estado, onGerar, errata }: Props) {
  const styles = useThemedStyles(createStyles);

  // Edição em curso não existe. Sem cartão, sem aviso, sem espaço reservado.
  if (estado.fase === 'aberto' || estado.fase === 'carregando') return null;

  if (estado.fase === 'pronta') {
    return (
      <View style={styles.card}>
        <Text style={styles.eyebrow}>A edição</Text>
        {errata ? (
          <View style={styles.errata}>
            <Ionicons name="alert-circle-outline" size={13} color={colors.ink3} />
            <Text style={styles.errataTxt}>
              Os números abaixo foram reprocessados depois desta edição.
            </Text>
          </View>
        ) : null}
        <Text style={styles.texto}>{estado.edicao.texto}</Text>
        <Text style={styles.assinatura}>{assinatura(estado.edicao)}</Text>
      </View>
    );
  }

  if (estado.fase === 'gerando') {
    return (
      <View style={styles.card}>
        <Text style={styles.eyebrow}>A edição</Text>
        <View style={styles.linha}>
          <ActivityIndicator size="small" color={colors.ink3} />
          <Text style={styles.lab}>Escrevendo…</Text>
        </View>
      </View>
    );
  }

  if (estado.fase === 'reprovada') {
    // Reprovada não é "erro do app": é a conferência funcionando. O texto foi
    // descartado de propósito, e dizer por quê é mais honesto que "tente de novo".
    return (
      <View style={styles.card}>
        <Text style={styles.eyebrow}>A edição</Text>
        <Text style={styles.lab}>
          O texto não passou na conferência e foi descartado.
        </Text>
        {estado.problemas.slice(0, 3).map((p, i) => (
          <Text key={i} style={styles.problema}>· {p.detalhe}</Text>
        ))}
        <Pressable style={styles.botao} onPress={onGerar}>
          <Text style={styles.botaoTxt}>Tentar de novo</Text>
        </Pressable>
      </View>
    );
  }

  if (estado.fase === 'erro') {
    return (
      <View style={styles.card}>
        <Text style={styles.eyebrow}>A edição</Text>
        <Text style={styles.lab}>{estado.mensagem}</Text>
        <Pressable style={styles.botao} onPress={onGerar}>
          <Text style={styles.botaoTxt}>Tentar de novo</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.card}>
      <Text style={styles.eyebrow}>A edição</Text>
      <Text style={styles.lab}>Este período fechou e ainda não foi escrito.</Text>
      <Pressable style={styles.botao} onPress={onGerar}>
        <Ionicons name="create-outline" size={15} color={colors.primaryOn} />
        <Text style={styles.botaoTxt}>Escrever a edição</Text>
      </Pressable>
    </View>
  );
}

const createStyles = () =>
  StyleSheet.create({
    card: {
      backgroundColor: colors.surface, borderRadius: radii['2xl'],
      padding: spacing.lg, gap: 6, ...shadows.card,
    },
    eyebrow: {
      fontSize: 11, fontFamily: fonts.sansBold, textTransform: 'uppercase',
      letterSpacing: 1.1, color: colors.ink3, marginBottom: 2,
    },
    // Serifada e com entrelinha larga: é texto para ler, não dado para conferir.
    texto: { fontSize: 15, lineHeight: 23, fontFamily: fonts.serif, color: colors.ink },
    assinatura: {
      fontSize: 11, fontFamily: fonts.mono, color: colors.ink4,
      marginTop: spacing.sm,
    },
    lab: { fontSize: 12.5, color: colors.ink3, fontFamily: fonts.sans, lineHeight: 18 },
    problema: { fontSize: 11.5, color: colors.ink4, fontFamily: fonts.mono, lineHeight: 17 },
    linha: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    errata: {
      flexDirection: 'row', alignItems: 'center', gap: 6,
      paddingVertical: 6, paddingHorizontal: 8,
      backgroundColor: colors.surfaceMute, borderRadius: radii.md, marginBottom: 4,
    },
    errataTxt: { flex: 1, fontSize: 11.5, color: colors.ink3, fontFamily: fonts.sans, lineHeight: 16 },
    botao: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
      backgroundColor: colors.primary, borderRadius: radii.lg,
      paddingVertical: 10, marginTop: spacing.sm,
    },
    botaoTxt: { fontSize: 13.5, fontFamily: fonts.sansSemiBold, color: colors.primaryOn },
  });
