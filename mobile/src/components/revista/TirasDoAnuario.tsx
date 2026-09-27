import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import {
  rotuloDoCaderno,
  tirasEmPalavras,
  type CadernoId,
  type CelulaDaTira,
  type TiraDoAno,
} from '@vitale/shared';
import { colors, fonts, radii, shadows, spacing, useTheme, useThemedStyles } from '../../theme';
import { CelulasDaTira, MarcaDaTira } from './CelulasDaTira';
import { MUDO } from './constantes-da-capa';

/**
 * **O anuário na parede: quatro tiras, e nenhuma capa** (Story 2.4b).
 *
 * O contrato é literal em `docs/specs/revista-retrospectiva/cadernos.md`: *"São
 * quatro tiras de doze meses, uma por caderno, na cor do caderno. (…) Na parede,
 * o anuário não tem capa: as quatro tiras são a capa do ano."* Por isso o ano
 * ocupa a largura inteira da parede, no lugar onde os meses têm duas colunas —
 * ele não é um mês grande, é outra forma.
 *
 * ## O desenho e a fala moram fora desde a 3.2
 *
 * A tira virou também a abertura da edição do ano, a 34 px — e o que as duas
 * compartilham saiu daqui: a geometria e os dois vãos para `geometria-da-tira.ts`,
 * a célula e a cor para `CelulasDaTira.tsx`, a fala para o **núcleo**
 * (`tirasEmPalavras`), porque é veredito sobre o dado e as duas telas falam com a
 * mesma voz. O que ficou é o que é **da miniatura**: a altura de 16, a grade
 * `divididas` (aprovada em tela na 2.4b), o `Pressable` que abre a edição, o
 * versalete e a legenda das três amostras.
 */
export interface TirasDoAnuarioProps {
  ano: number;
  /** O início do período, para o toque abrir a edição **deste** ano. */
  inicio: string;
  tiras: readonly TiraDoAno[];
  /** Estável por construção: quem o cria é a parede, uma vez. */
  onAbrir: (inicio: string) => void;
}

/** A altura de uma tira — alta o bastante para a cor se ler, baixa para caber quatro. */
const ALTURA_DA_TIRA = 16;

/** A coluna dos nomes: os quatro alinham, e as quatro tiras começam na mesma coluna. */
const LARGURA_DO_NOME = 74;

export const TirasDoAnuario = React.memo(function TirasDoAnuario(
  { ano, inicio, tiras, onAbrir }: TirasDoAnuarioProps,
) {
  const styles = useThemedStyles(createStyles);
  // Assina o tema: é o que faz o `React.memo` continuar respondendo à troca de
  // paleta e de esquema, que não passam por props — a cor das células é lida no
  // render, por fora do React, e nada mais delataria a troca.
  useTheme();

  /**
   * Um alvo de toque só, e um rótulo só. Tiras aninhadas como elementos
   * separados fariam o VoiceOver parar quatro vezes dentro de um botão — e a
   * 1.16 já estabeleceu que a capa é um alvo, com o texto lido como texto.
   *
   * A frase é a do núcleo, a mesma do anuário da edição: duas aberturas para o
   * mesmo desenho eram duas vozes para a mesma coisa.
   */
  const falado = tirasEmPalavras(ano, tiras);

  return (
    <Pressable
      onPress={() => onAbrir(inicio)}
      accessibilityRole="button"
      accessibilityLabel={falado}
      accessibilityHint="Abre a edição"
      style={({ pressed }) => [styles.bloco, pressed && styles.pressionado]}
    >
      <Text style={styles.eyebrow}>O anuário</Text>
      <View {...MUDO}>
        {tiras.map((t) => (
          <View key={t.caderno} style={styles.linha}>
            {/* Encolhe em vez de truncar: o nome é o portador da identidade —
                Movimento e Coração medem ΔE 4,1 a 9,9 em cinco das seis paletas,
                e a cor não os separa sozinha. Ver `AnuarioDaEdicao`. */}
            <Text style={styles.caderno} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>
              {rotuloDoCaderno(t.caderno)}
            </Text>
            <CelulasDaTira celulas={t.celulas} caderno={t.caderno} altura={ALTURA_DA_TIRA} colunas="divididas" />
          </View>
        ))}
      </View>
      {/* A legenda. Sem ela a tira é bonita e muda: três alturas e duas cores não
          se decodificam por conta própria, e o dono não tem onde perguntar. */}
      <View style={styles.legenda} {...MUDO}>
        <Amostra estado="metrica" texto="liderou" styles={styles} />
        <Amostra estado="sem-metrica" texto="sem líder" styles={styles} />
        <Amostra estado="ausente" texto="não saiu" styles={styles} />
        <Text style={styles.legendaNota}>vão maior = o líder mudou</Text>
      </View>
    </Pressable>
  );
});

/** Uma amostra da legenda: a marca do estado, no tamanho em que ela aparece. */
function Amostra({ estado, texto, styles }: {
  estado: CelulaDaTira['estado'];
  texto: string;
  styles: ReturnType<typeof createStyles>;
}) {
  return (
    <View style={styles.amostra}>
      <View style={styles.amostraCaixa}>
        {/* A amostra usa o **primeiro** caderno como cor: ela explica a forma e a
            intensidade, não qual caderno é qual — isso o nome ao lado da tira já
            diz. E usa a MESMA marca da célula, para não haver uma segunda cópia
            da regra forma-vs-cor numa legenda. */}
        <MarcaDaTira estado={estado} caderno={'sono' satisfies CadernoId} altura={ALTURA_DA_TIRA} />
      </View>
      <Text style={styles.legendaTxt}>{texto}</Text>
    </View>
  );
}

const createStyles = () =>
  StyleSheet.create({
    bloco: {
      backgroundColor: colors.surface,
      borderRadius: radii.lg,
      padding: spacing.md,
      gap: spacing.xs,
      ...shadows.card,
    },
    eyebrow: {
      fontSize: 11, fontFamily: fonts.sansBold, textTransform: 'uppercase',
      letterSpacing: 1.1, color: colors.ink3, marginBottom: 2,
    },
    linha: {
      flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
      minHeight: ALTURA_DA_TIRA + 6,
    },
    // Largura fixa: os quatro nomes alinham, e as quatro tiras começam na mesma
    // coluna — é o alinhamento que faz os "batimentos" serem comparáveis.
    caderno: { width: LARGURA_DO_NOME, fontSize: 11, fontFamily: fonts.sansSemiBold, color: colors.ink2 },

    legenda: {
      flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center',
      gap: spacing.md, marginTop: spacing.xs, paddingLeft: LARGURA_DO_NOME + spacing.sm,
    },
    amostra: { flexDirection: 'row', alignItems: 'center', gap: 5 },
    amostraCaixa: { width: 14, height: ALTURA_DA_TIRA, justifyContent: 'center' },
    // Informação obrigatória nunca na tinta mais fraca: a legenda é o que torna a
    // tira legível, não é cromo.
    legendaTxt: { fontSize: 10.5, fontFamily: fonts.sans, color: colors.ink2 },
    legendaNota: { fontSize: 10.5, fontFamily: fonts.sans, color: colors.ink2 },
    pressionado: { opacity: 0.7 },
  });
