import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import {
  MESES_INICIAIS,
  anuarioEmPalavras,
  rotuloDoCaderno,
  type Anuario,
} from '@vitale/shared';
import { colors, fonts, spacing, useThemedStyles } from '../../theme';
import { CelulasDaTira } from './CelulasDaTira';
import { COLUNA_DO_MES } from './geometria-da-tira';

/**
 * **O anuário do ano, na edição** — quatro tiras de doze meses, antes de
 * qualquer texto (Story 3.2).
 *
 * O ano abria como um mês grande: capa, sumário, quatro cadernos, procurando uma
 * manchete que ele não tem. *Um ano não tem um fato: tem doze formas.* Elas já
 * existiam em miniatura na parede (`TirasDoAnuario`, 2.4b), que era a única peça
 * do app capaz de ler o ano como série — e a rota, que é onde ele se lê, não.
 *
 * Aqui as tiras entram **antes da capa**, a 34 px, e o resto da edição continua
 * exatamente como estava: a mesma rota, a mesma edição, o mesmo texto. Elas
 * acrescentam; não substituem — e por isso aparecem **mesmo quando o texto não
 * veio** (ver o ramo do ano na rota).
 *
 * ## O que ele não faz, e isso é o desenho
 *
 * - **Não é tocável.** Sem `Pressable`, sem toque, sem tooltip, sem scrub. A
 *   tira da parede é um botão porque ela *leva* à edição; esta **é** a edição —
 *   não há para onde ir, e um alvo que não leva a lugar nenhum é uma promessa
 *   falsa. Uma barreira de código-fonte cobra isso
 *   (`lib/__tests__/anuario-nao-e-tocavel.test.ts`), inclusive no chamador.
 * - **Não tem legenda de parede nem versalete.** Elas são da miniatura, que
 *   aparece no meio de uma grade de capas e precisa se apresentar. Aqui as tiras
 *   abrem a página inteira, e o nome de cada caderno ao lado já diz o que é.
 * - **Não recalcula nada.** Cada célula é a `metrica_lider` carimbada na edição
 *   daquele mês. Recalcular seria inventar um ranqueamento novo a cada abertura
 *   — reescrita silenciosa de período fechado, proibida desde a 1.9.
 * - **Não mede grandeza.** A tira fala de **identidade**: qual fato liderou, e
 *   quando ele trocou. Altura de barra por valor foi recusada pelo dono em
 *   25/09; reabrir isso exige medição nova, não um `flex`.
 *
 * ## Um nó, um rótulo
 *
 * O bloco inteiro é **um** elemento para o leitor de tela, com as quatro tiras
 * na mesma frase (`anuarioEmPalavras`, no núcleo — a mesma voz da parede). Quatro
 * nós fariam o VoiceOver parar quatro vezes num bloco que nem é tocável, e o ano
 * — que é o assunto — nunca seria dito.
 */
export interface AnuarioDaEdicaoProps {
  anuario: Anuario;
}

/**
 * A altura de uma tira aqui — **34 px**, contra os 16 da miniatura da parede.
 *
 * É o `BAR_H` do `ConsistencyCard`, o precedente do app para altura de barra
 * declarada em pixel, e o número que o critério da story pede. Pouco mais que o
 * dobro da miniatura, porque o papel é outro: lá a tira é um ladrilho numa grade
 * de capas e cabe em quatro linhas de 16; aqui ela é a **capa do ano**, a
 * primeira coisa da página, e o que se pede dela é que o `accent` e o `tint` se
 * distingam de relance e que o filete da ausência leia como pausa, e não como
 * sujeira. O filete daqui mede 9 px (`round(34 / 4)`), contra 4 na parede.
 *
 * Não vira token de escala: `tokens.ts` não tem degrau de altura de barra, e
 * arredondá-lo para um `spacing` seria redesenhar o bloco por conveniência.
 */
const ALTURA_DA_TIRA = 34;

/**
 * A coluna dos nomes dos cadernos.
 *
 * **Não são os 74 da parede.** Lá o nome sai em 11 px dentro de um ladrilho de
 * largura de tela; aqui ele sobe para 12,5 porque a tira dobrou de altura e um
 * versalete de 11 ao lado de uma barra de 34 lê como legenda de rodapé.
 * "Movimento" é o mais longo dos quatro — nove caracteres —, e 84 o acomoda com
 * folga no tipo padrão.
 *
 * Fixa, e não `auto`: é ela que faz as quatro tiras começarem na mesma coluna, e
 * é esse alinhamento que torna os "quatro batimentos paralelos" comparáveis.
 * Para o tipo dinâmico grande, ver {@link NomeDoCaderno}.
 */
const LARGURA_DO_NOME = 84;

export const AnuarioDaEdicao = React.memo(function AnuarioDaEdicao({ anuario }: AnuarioDaEdicaoProps) {
  // `useThemedStyles` já assina o tema por dentro, e quem lê cor de célula é a
  // `CelulasDaTira`, que assina por conta própria. Uma terceira assinatura aqui
  // seria re-render por um valor que nenhum pixel deste arquivo desenha.
  const styles = useThemedStyles(createStyles);

  return (
    // Um nó, um rótulo — ver o cabeçalho. `accessible` agrupa; **não** torna
    // tocável, e não há `onPress` em lugar nenhum deste arquivo.
    <View style={styles.bloco} accessible accessibilityLabel={anuarioEmPalavras(anuario)}>
      {anuario.estado === 'sem-lider' ? (
        /* A linha em palavras, **no lugar das faixas**. Quatro tiras de filetes
           leriam como tela quebrada, não como "não houve líder" — e a frase é do
           núcleo, porque é veredito sobre o dado e não rótulo de tela. */
        <Text style={styles.silencio}>{anuario.frase}</Text>
      ) : (
        <>
          {anuario.tiras.map((t) => (
            <View key={t.caderno} style={styles.linha}>
              <NomeDoCaderno rotulo={rotuloDoCaderno(t.caderno)} styles={styles} />
              {/* **`fixas`**, e não a grade da parede: é isto que faz as doze
                  colunas serem as mesmas nas quatro tiras, e sem isso nenhuma
                  régua de meses cairia sobre elas. Ver `geometria-da-tira.ts`. */}
              <CelulasDaTira celulas={t.celulas} caderno={t.caderno} altura={ALTURA_DA_TIRA} colunas="fixas" />
            </View>
          ))}
          <ReguaDosMeses styles={styles} />
        </>
      )}
    </View>
  );
});

/**
 * O nome do caderno — **o portador da identidade**, e por isso ele encolhe em
 * vez de ser cortado.
 *
 * A cor não distingue os quatro sozinha: Movimento (laranja) e Coração
 * (vermelho) medem ΔE 4,1 a 9,9 em cinco das seis paletas, e só a acessível os
 * separa (`period/cadernos.ts`). O nome é quem responde *qual* tira é qual — e
 * um nome truncado em `Movim…` no tipo dinâmico grande tira exatamente de quem
 * tem baixa visão a única coisa que resolve a ambiguidade.
 *
 * Por isso `adjustsFontSizeToFit`: a letra diminui até caber na coluna, em vez
 * de a palavra perder o fim. `minimumFontScale` põe um piso — abaixo dele o nome
 * seria ilegível, e aí truncar e encolher dão no mesmo. Quebrar linha não
 * resolveria: "Movimento" é uma palavra só, e palavra só não quebra.
 */
function NomeDoCaderno({ rotulo, styles }: {
  rotulo: string;
  styles: ReturnType<typeof createStyles>;
}) {
  return (
    <Text style={styles.caderno} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>
      {rotulo}
    </Text>
  );
}

/**
 * Os meses, rotulados **uma vez só**, sob a última tira.
 *
 * Doze iniciais sob cada uma das quatro seriam quarenta e oito letras para doze
 * colunas: a página passaria a ser lida como tabela, e a tira deixaria de ser
 * forma.
 *
 * **A régua não depende de tira nenhuma.** Ela desenha doze {@link COLUNA_DO_MES}
 * — o mesmo objeto que cada célula usa —, e é a grade `fixas` que garante que
 * essas doze colunas sejam as mesmas nas quatro tiras acima. A primeira versão
 * copiava os vãos da última tira, e isso era um alinhamento para uma só: quando
 * a última (`rotina`, sempre a última do catálogo) não tinha troca nenhuma, a
 * régua saía com vãos uniformes enquanto as de cima abriam 7 px em cada troca, e
 * as letras escorregavam para fora da coluna nas quatro.
 *
 * Doze letras porque o ano tem doze meses: a régua é `MESES_INICIAIS`, e não o
 * comprimento de uma tira — uma tira mais curta ou mais longa não pode fazer a
 * régua perder um mês nem inventar um `undefined`.
 */
function ReguaDosMeses({ styles }: { styles: ReturnType<typeof createStyles> }) {
  return (
    <View style={styles.regua}>
      <View style={styles.reguaRecuo} />
      <View style={styles.reguaCelulas}>
        {MESES_INICIAIS.map((inicial, mes) => (
          <View key={mes} style={COLUNA_DO_MES}>
            <Text style={styles.mes}>{inicial}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const createStyles = () =>
  StyleSheet.create({
    /**
     * A mesma superfície da capa e do sumário, com o filete que separa os blocos
     * da edição — as tiras entram na página como mais uma faixa dela, e não como
     * um cartão flutuante por cima. A revista é plana.
     */
    bloco: {
      backgroundColor: colors.surface,
      paddingHorizontal: spacing.xl,
      paddingTop: spacing.lg,
      paddingBottom: spacing.md,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.line,
    },
    /**
     * A altura da linha é a da tira mais o respiro que separa uma da outra —
     * `minHeight` e nunca `height`: com o tipo dinâmico grande o nome do caderno
     * pede mais caixa, e uma altura fixa o cortaria pela metade.
     */
    linha: {
      flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
      minHeight: ALTURA_DA_TIRA + 8,
    },
    /**
     * O nome do caderno — `ink2`, e nunca `ink3`: é o que diz **qual** tira é
     * qual, informação obrigatória. Ver {@link NomeDoCaderno} para por que ele
     * encolhe em vez de truncar.
     */
    caderno: {
      width: LARGURA_DO_NOME, fontSize: 12.5, fontFamily: fonts.sansSemiBold, color: colors.ink2,
    },

    regua: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: 2 },
    // O recuo da régua é a coluna dos nomes, pela MESMA medida: com um
    // `paddingLeft` somado à mão, o dia em que a coluna mudasse deixaria as
    // letras deslocadas por um número escrito noutro lugar.
    reguaRecuo: { width: LARGURA_DO_NOME },
    reguaCelulas: { flex: 1, flexDirection: 'row', alignItems: 'center' },
    /**
     * As iniciais são ambíguas de propósito (`MESES_INICIAIS`: J F M A M J J A S
     * O N D) — a posição na régua é que dá o contexto, como nos eixos de
     * sazonalidade do app. `ink2` pela mesma razão do nome do caderno.
     */
    mes: { fontSize: 10, fontFamily: fonts.sans, color: colors.ink2, textAlign: 'center' },

    // A linha do silêncio: o mesmo corpo e a mesma tinta do convite da capa —
    // é o app falando, e não o texto que a máquina escreveu.
    silencio: { fontSize: 14, lineHeight: 21, fontFamily: fonts.sans, color: colors.ink2 },
  });
