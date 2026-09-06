import React, { useState, type ReactNode } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import { colors, fonts, radii, shadows, spacing, useThemedStyles } from '../../theme';

export interface Panel {
  key: string;
  label: string;
  /** Só é chamado quando a aba está ativa — painel escondido não calcula série. */
  render: () => ReactNode;
}

/**
 * Vários painéis de leitura no mesmo lugar, um por vez.
 *
 * Nasceu na tela de um tipo de atividade, onde Evolução e Piso empilhados
 * custavam 500 pt e **competiam entre si**: dois cartões densos, um atrás do
 * outro, e nenhum dos dois ganhava. Em abas custam 276 e se revezam. A lista de
 * pedaladas — que é o nome da tela — volta para dentro da primeira rolagem.
 *
 * Duas escolhas de desenho, ambas deliberadas:
 *
 * - **Retângulo, não pílula.** O `Segmented` (trilho de pílulas) já é o seletor
 *   de *leitura* — período, métrica, distância — e mora **dentro** de um cartão.
 *   Este troca o cartão inteiro e mora **fora** dele. Se os dois tivessem a
 *   mesma forma, o seletor de período do Piso apareceria logo abaixo da barra
 *   de abas como um irmão gêmeo, e nada diria qual manda em qual.
 * - **Rola quando não cabe.** Até três abas dividem a largura em partes iguais;
 *   da quarta em diante a barra vira rolagem horizontal com abas do tamanho do
 *   texto. É o caso da Corrida, que tem quatro painéis — Evolução, Curva,
 *   Melhor por mês e Rotas — contra os dois do Ciclismo.
 *
 * Uma aba só não desenha barra: barra de uma aba é moldura, não escolha.
 */
export function PanelTabs({
  panels,
  initialKey,
}: {
  /** Já filtrados: painel que não tem o que mostrar não vira aba. */
  panels: Panel[];
  /** Aba inicial; sem isso, a primeira. */
  initialKey?: string;
}) {
  const styles = useThemedStyles(createStyles);
  const [key, setKey] = useState<string | undefined>(initialKey);

  if (panels.length === 0) return null;

  // A aba lembrada pode ter sumido (troquei a lente e o Piso ficou sem dado):
  // cair na primeira é melhor que mostrar vazio.
  const active = panels.find((p) => p.key === key) ?? panels[0];

  if (panels.length === 1) return <>{active.render()}</>;

  const scroll = panels.length > 3;

  const tab = (p: Panel) => {
    const on = p.key === active.key;
    return (
      <Pressable
        key={p.key}
        onPress={() => setKey(p.key)}
        accessibilityRole="button"
        accessibilityState={{ selected: on }}
        style={({ pressed }) => [
          styles.tab,
          scroll ? styles.tabAuto : styles.tabEven,
          on && styles.tabOn,
          pressed && styles.pressed,
        ]}
      >
        <Text style={[styles.tabText, on && styles.tabTextOn]} numberOfLines={1}>
          {p.label}
        </Text>
      </Pressable>
    );
  };

  return (
    <View>
      {scroll ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.bar}
        >
          {panels.map(tab)}
        </ScrollView>
      ) : (
        <View style={styles.bar}>{panels.map(tab)}</View>
      )}
      {active.render()}
    </View>
  );
}

const createStyles = () =>
  StyleSheet.create({
    bar: { flexDirection: 'row', gap: 6, marginBottom: 10 },
    tab: {
      paddingVertical: spacing.sm + 1,
      paddingHorizontal: spacing.md,
      borderRadius: radii.md,
      alignItems: 'center',
      backgroundColor: colors.surfaceMute,
    },
    tabEven: { flex: 1 },
    tabAuto: { flexGrow: 0 },
    tabOn: { backgroundColor: colors.surface, ...shadows.sm },
    // `ink3` → `ink` no ativo. A marca não entra: aba é leitura, não ação, e a
    // catraca da ADR 0024 não deixa o acento crescer como cor de letra.
    tabText: { fontSize: 13, color: colors.ink3, fontFamily: fonts.sansSemiBold },
    tabTextOn: { color: colors.ink },
    pressed: { opacity: 0.7 },
  });
