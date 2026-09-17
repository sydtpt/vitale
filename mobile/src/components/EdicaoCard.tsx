import React from 'react';
import { View, Text, Pressable, ActivityIndicator, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
// **O tipo vem da store, e não é cópia.** Uma união gêmea mantida à mão aqui
// deixaria uma porta nova da store nascer sem desenho, calada. `import type` some
// na compilação: nenhuma dependência de runtime do componente para a store.
import type { PortaDaEdicao } from '../store/edicao.store';
import { baseBg, colors, fonts, radii, shadows, spacing, useTheme, useThemedStyles } from '../theme';

/**
 * A porta da edição — o cartão do bloco `lede` da Retrospectiva que leva à rota
 * da revista (Story 1.11, quadros 1-a e 5 da proposta aprovada em 16/09/2026).
 *
 * Desde a 1.11 a edição não mora mais aqui. A capa disputava o topo com o seletor
 * de período, o botão pago aparecia no meio da lista de cartões e um caderno que
 * falhava não tinha para onde ir. O cartão virou só a porta:
 *
 * 1. **Um alvo de toque só.** Tocar em qualquer parte leva à rota. Nada aqui
 *    escreve: "Escrever a edição" existe só na rota, na página que explica o que
 *    vai acontecer — nunca no meio de uma lista de cartões (decisão 4-a).
 * 2. **Impressa: a miniatura em papel ao lado da chamada** (decisão 1-a). A
 *    miniatura é o período curto em serifada — a foto da capa é da 1.13, e
 *    mostrá-la antes seria mostrar uma escolha que ainda não aconteceu. A chamada
 *    é a do caderno em `posicao` 1, **inteira, sempre** (decisão 6-a): cortar
 *    esconderia o fim da frase, onde costuma estar a base contra a qual o número
 *    compara.
 * 3. **Fechado e não escrito: a frase e a seta**, sem botão.
 * 4. **O que não pode existir não aparece.** Período em curso e Total não são
 *    botão desabilitado nem aviso: são ausência. A primeira leitura também não
 *    desenha nada, para a porta não piscar a cada foco da tela.
 *
 * A decisão de **qual** porta desenhar é `portaDe` (a store), pura e testada.
 */

interface Props {
  porta: PortaDaEdicao;
  /** Abre a rota da revista. **Não** escreve. */
  onAbrir: () => void;
}

/**
 * O ramo que não existe: uma porta nova na store que este `switch` não trate
 * deixa de compilar. Em tempo de execução não lança — a Retrospectiva inteira
 * caindo seria um preço muito acima de um cartão faltando.
 */
/** O que o toque na porta faz, para quem usa leitor de tela. */
const DICA = 'Abre a edição';

function portaNaoTratada(nunca: never): null {
  console.warn('[edicao] porta sem desenho:', nunca);
  return null;
}

export function EdicaoCard({ porta, onAbrir }: Props) {
  const styles = useThemedStyles(createStyles);
  // O papel da miniatura é o fundo **opaco** do esquema: `colors.bg` fica
  // transparente sob papel de parede, e a miniatura sumiria dentro do cartão.
  const { scheme } = useTheme();

  const seta = <Ionicons name="chevron-forward" size={18} color={colors.ink3} style={styles.seta} />;

  switch (porta.tipo) {
    case 'nada':
      return null;

    // Sem sessão não há rota a abrir: a frase, e nenhum alvo de toque.
    case 'sem-sessao':
      return (
        <View style={styles.card}>
          <View style={styles.corpo}>
            <Text style={styles.eyebrow}>A edição</Text>
            <Text style={styles.lab}>Entre na sua conta para ler a edição.</Text>
          </View>
        </View>
      );

    case 'impressa':
      return (
        <Pressable
          onPress={onAbrir}
          accessibilityRole="button"
          accessibilityLabel={porta.chamada ? `A edição de ${porta.periodo}: ${porta.chamada}` : `A edição de ${porta.periodo}`}
          accessibilityHint={DICA}
          style={({ pressed }) => [styles.card, pressed && styles.pressed]}
        >
          <View style={[styles.miniatura, { backgroundColor: baseBg(scheme) }]}>
            {/* A caixa é fixa: rótulo longo ("07/09 – 13/09") e o Dynamic Type do iOS
                encolhem o texto até caber, em vez de vazar a miniatura. */}
            <Text
              style={styles.miniaturaPeriodo}
              numberOfLines={2}
              adjustsFontSizeToFit
              minimumFontScale={0.6}
              maxFontSizeMultiplier={1.3}
            >
              {porta.periodo}
            </Text>
          </View>
          <View style={styles.corpo}>
            <Text style={styles.eyebrow}>A edição</Text>
            {porta.chamada ? <Text style={styles.chamada}>{porta.chamada}</Text> : null}
          </View>
          {seta}
        </Pressable>
      );

    case 'nao-escrita':
    case 'escrevendo':
    case 'erro':
      return (
        <Pressable
          onPress={onAbrir}
          accessibilityRole="button"
          accessibilityLabel={
            porta.tipo === 'nao-escrita' ? 'A edição: este período fechou e ainda não foi escrito.'
              : porta.tipo === 'escrevendo' ? 'A edição: escrevendo a edição.'
                : `A edição: ${porta.mensagem}`
          }
          accessibilityHint={DICA}
          style={({ pressed }) => [styles.card, pressed && styles.pressed]}
        >
          <View style={styles.corpo}>
            <Text style={styles.eyebrow}>A edição</Text>
            {porta.tipo === 'nao-escrita' ? (
              <Text style={styles.lab}>Este período fechou e ainda não foi escrito.</Text>
            ) : null}
            {porta.tipo === 'escrevendo' ? (
              <View style={styles.linha}>
                <ActivityIndicator size="small" color={colors.ink3} />
                <Text style={styles.lab}>Escrevendo a edição…</Text>
              </View>
            ) : null}
            {porta.tipo === 'erro' ? <Text style={styles.lab}>{porta.mensagem}</Text> : null}
          </View>
          {seta}
        </Pressable>
      );

    default:
      return portaNaoTratada(porta);
  }
}

const createStyles = () =>
  StyleSheet.create({
    card: {
      flexDirection: 'row', alignItems: 'center', gap: spacing.md,
      backgroundColor: colors.surface, borderRadius: radii['2xl'],
      padding: spacing.md, ...shadows.card,
    },
    pressed: { opacity: 0.7 },
    // A miniatura em papel: o fundo do app (pintado no render, opaco), com o
    // filete de uma folha. O período é o que a edição é, e vai em serifada — a
    // família do que a revista escreve.
    miniatura: {
      width: 84, height: 84, borderRadius: radii.md,
      borderWidth: StyleSheet.hairlineWidth, borderColor: colors.lineDeep,
      alignItems: 'center', justifyContent: 'center', padding: spacing.sm,
    },
    miniaturaPeriodo: {
      fontSize: 19, lineHeight: 22, fontFamily: fonts.serif, color: colors.ink, textAlign: 'center',
    },
    corpo: { flex: 1, minWidth: 0, gap: 2 },
    // O olho da seção: caixa alta, entreletra larga. É cromo.
    eyebrow: {
      fontSize: 11, fontFamily: fonts.sansBold, textTransform: 'uppercase',
      letterSpacing: 1.1, color: colors.ink3, marginBottom: 4,
    },
    // A chamada inteira, sem `numberOfLines`: cortar esconderia a base.
    chamada: { fontSize: 17, lineHeight: 22, fontFamily: fonts.serif, color: colors.ink },
    // Informação obrigatória nunca na tinta mais fraca.
    lab: { fontSize: 13, lineHeight: 19, fontFamily: fonts.sans, color: colors.ink2 },
    linha: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    seta: { flexShrink: 0 },
  });
