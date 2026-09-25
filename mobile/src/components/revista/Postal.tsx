import React, { useCallback, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { rotuloDoCaderno, type FatoDoPostal } from '@vitale/shared';
import type { CadernoGuardado } from '../../store/edicao.store';
import { colors, fonts, radii, spacing, useThemedStyles } from '../../theme';

/**
 * O **postal da semana** (Story 3.1) — uma tela, capa pequena, três fatos.
 *
 * A semana abria a mesma edição do mês: sumário, quatro cadernos, faixa colorida
 * e botão de escrever. O contrato do Épico 2 diz o contrário desde sempre — *"a
 * semana não grava edição; o postal calcula na hora"* —, e este componente é o
 * que a semana passa a ser.
 *
 * ## Três decisões de desenho, e o porquê de cada uma
 *
 * - **Acromático, e em papéis de tinta.** Nenhuma cor de módulo entra aqui:
 *   `surface`, `ink`, `ink2`, `ink3` e `line`, e nada mais. O precedente está
 *   escrito no `SleepRatingCard` — *"nenhuma cor de sono, porque o bloco é
 *   legenda, não gráfico"* —, e vale em dobro no postal: a faixa colorida da
 *   edição pinta o **caderno**, e o postal não tem cadernos. Pintar os três
 *   fatos de treino-laranja e sono-vermelho inventaria uma seção que não existe.
 *   Há barreira no `architecture.test.ts` para isso não voltar;
 * - **o número antes do nome.** O valor é o que o postal tem a dizer; o rótulo
 *   só diz do que ele é. Mono no número (tabular, alinha em coluna quando os
 *   três empilham) e versalete no rótulo, que é o token do `eyebrow`;
 * - **sem comparação nenhuma** — decisão do dono, 25/09. Quem decide quais três
 *   e escreve os valores é o núcleo (`montarPostal`); aqui não se calcula nada,
 *   nem se formata número.
 *
 * ## A linha do texto guardado
 *
 * Cinco semanas foram escritas antes de a porta fechar, e o texto delas **não se
 * apaga**. O caminho até ele é **uma linha**, e não um segundo layout: tocá-la
 * abre os cadernos guardados logo abaixo, na mesma tela. Sem texto legível a
 * linha some e o postal fica igual ao das outras semanas — que é a promessa da
 * matriz: *"o postal é igual ao das outras, mais uma linha"*.
 *
 * Quem decide o que é "legível" é `guardadosDoPostal`, na store: regra tem teste
 * enquanto render não tem.
 */
export function Postal({ periodo, fatos, guardados }: {
  /** O período por extenso, como a capa o imprime. */
  periodo: string;
  /**
   * De zero a três, já escolhidos e já escritos pelo núcleo — ou **`null`
   * enquanto a memória da Retrospectiva não fechou**.
   *
   * `null` e `[]` desenham coisas diferentes de propósito, e é a diferença entre
   * não saber e saber que não houve: com `null` o postal cala sobre os fatos;
   * com a lista vazia ele **diz** que a semana não deixou nenhum. Sem a
   * distinção, a janela em voo faria o cartão afirmar a ausência um instante
   * antes de mostrar três fatos.
   */
  fatos: readonly FatoDoPostal[] | null;
  /**
   * Os cadernos que esta semana chegou a ter escritos, na ordem gravada — ou
   * vazio, e aí não há linha nenhuma. Vazio também é a resposta de uma leitura
   * que falhou: a linha some, o postal fica.
   */
  guardados: readonly CadernoGuardado[];
}) {
  const styles = useThemedStyles(createStyles);
  const [aberto, setAberto] = useState(false);
  const alternar = useCallback(() => setAberto((a) => !a), []);

  return (
    <View style={styles.postal}>
      {/* O mastro — a "capa pequena" do mockup (`.postal-mast`): o versalete e o
          período em serifada, e nada mais. A edição põe a manchete aqui, que é a
          chamada do caderno em `posicao` 1; o postal não tem cadernos, então o
          mastro carrega só o período. */}
      <Text style={styles.eyebrow}>Nota da semana</Text>
      <Text style={styles.periodo} accessibilityRole="header">{periodo}</Text>

      {/* `null` é "ainda apurando": nem os fatos, nem a frase da ausência. */}
      {fatos === null ? null : fatos.length > 0 ? (
        <View style={styles.fatos}>
          {fatos.map((f, i) => (
            // Um nó só para o leitor de tela: "Treinos, 3" em vez de dois
            // fragmentos soltos. O valor vem primeiro na tela e o rótulo
            // primeiro na voz, porque sem o rótulo o número não diz nada.
            <View
              key={f.id}
              style={[styles.fato, i > 0 && styles.fatoSeguinte]}
              accessible
              accessibilityLabel={`${f.rotulo}: ${f.valor}`}
            >
              <Text style={styles.valor}>{f.valor}</Text>
              <Text style={styles.rotulo}>{f.rotulo}</Text>
            </View>
          ))}
        </View>
      ) : (
        // Semana magra com **nada**: a frase, e não três caixas vazias. Encher o
        // postal de espaços reservados afirmaria que faltou medida.
        <Text style={styles.vazio}>Esta semana não deixou nenhum fato apurado.</Text>
      )}

      {guardados.length > 0 ? (
        <View style={styles.guardado}>
          <Pressable
            onPress={alternar}
            accessibilityRole="button"
            accessibilityState={{ expanded: aberto }}
            accessibilityLabel={aberto ? 'Esconder o texto guardado desta semana' : 'Ler o texto guardado desta semana'}
            style={({ pressed }) => [styles.linha, pressed && styles.pressed]}
          >
            <Text style={styles.linhaTxt}>
              {aberto ? 'Esconder o texto guardado' : 'Esta semana já foi escrita — ler o texto guardado'}
            </Text>
            {/* Decorativa: mora dentro do nó acessível da linha, e o rótulo já
                diz o que o toque faz. */}
            <Ionicons name={aberto ? 'chevron-up' : 'chevron-down'} size={16} color={colors.ink3} />
          </Pressable>

          {aberto ? (
            <View style={styles.textos}>
              {guardados.map((c) => (
                <View key={c.caderno} style={styles.textoDoCaderno}>
                  {/* O nome do caderno em versalete, **sem a faixa colorida**: é
                      arquivo, não seção de uma edição que a semana não tem. */}
                  <Text style={styles.nomeDoCaderno}>{rotuloDoCaderno(c.caderno)}</Text>
                  <Text style={styles.texto}>{c.texto}</Text>
                </View>
              ))}
            </View>
          ) : null}
        </View>
      ) : null}

      {/* O **colofão** (`.postal-foot` do mockup) — o sinal, em palavras, de que
          aqui não se grava edição. A edição assina modelo e data porque foi
          impressa e arquivada; o postal declara o contrário. É a única linha
          desta tela que fala do mecanismo, e ela existe porque o leitor não tem
          outra forma de saber por que esta semana não tem botão de escrever.

          **Ele muda quando há texto guardado**, e isso não é zelo: *"nota não
          arquivada"* logo abaixo de *"esta semana já foi escrita"* seria a única
          linha cuja função é explicar o mecanismo descrevendo-o errado — e
          justamente no caso que a story existe para preservar. Com arquivo, o
          colofão fala dos **fatos** (que são recalculados) e do que mudou (a
          semana não arquiva **mais**); sem arquivo, ele fala do postal inteiro.

          A **picotagem** do mockup (a folha arrancada, `.tear`) diz a mesma coisa
          em desenho e ficou de fora: é decoração que se calibra no aparelho, e o
          que ela significa já está dito aqui. */}
      <Text style={styles.colofao}>
        {guardados.length > 0
          ? 'os fatos acima são recalculados a cada leitura · a semana não arquiva mais edição'
          : 'nota não arquivada · recalculada a cada leitura'}
      </Text>
    </View>
  );
}

const createStyles = () =>
  StyleSheet.create({
    /* ── a geometria é a do mockup aprovado ──────────────────────────────────
     *
     * Os números soltos daqui — 27, 33, 17, 14, 13, 10,5 — **são a geometria de
     * `mockups/key-formas.html`** (`.postal-card`, `.postal-mast`,
     * `.postal-week`, `.fact`, `.fact-n`, `.fact-d`, `.postal-foot`), julgada em
     * tela na passagem de UX de 07/09. Eles não viram `spacing.*` porque a
     * escala não tem esses degraus, e arredondá-los seria redesenhar o cartão
     * por conveniência de token — a mesma decisão que o sumário da 1.14 tomou.
     *
     * O que ficou **fora** do mockup, e por quê: a capa pequena de foto
     * (`.cover-sm`) — a capa é carimbada **na impressão**, e a semana não
     * imprime, então não existe foto carimbada para uma semana; escolher uma na
     * hora seria inventar comportamento que esta story não pede. E a picotagem
     * (`.tear`), decoração que se calibra no aparelho; o colofão diz em palavras
     * o que ela dizia em desenho.
     */

    /**
     * O postal inteiro é **uma** superfície — e não uma pilha de cards.
     *
     * A edição é um documento com seções que sangram; o postal é um cartão só, e
     * o que separa um fato do outro é um filete de 1 px, como no mockup. Três
     * cards empilhados leriam como três módulos, que é justamente a leitura que
     * o acromático existe para não dar.
     */
    postal: {
      backgroundColor: colors.surface,
      marginHorizontal: 14,
      marginTop: 6,
      borderRadius: radii.lg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.line,
      paddingHorizontal: 18,
      paddingTop: 16,
      paddingBottom: 22,
    },
    eyebrow: {
      fontSize: 11, fontFamily: fonts.sansSemiBold, textTransform: 'uppercase',
      letterSpacing: 1.1, color: colors.ink3, marginBottom: 7,
    },
    // `.postal-week` — 27 px em serifada, contra os 38 da capa de meia tela da
    // edição: o postal é cartão, e o período não disputa a tela com os fatos.
    periodo: { fontSize: 27, lineHeight: 30, fontFamily: fonts.serif, color: colors.ink },

    // `.facts` — o bloco começa colado no mastro; quem dá o respiro é o `padding`
    // de cada fato, para o filete entre dois deles ficar no meio do vão.
    fatos: { marginTop: spacing.md },
    fato: { paddingVertical: 17 },
    // `.fact{border-top}` — no fato **seguinte**, nunca no primeiro: com o filete
    // embaixo, o último fato teria um traço solto contra o pé do cartão.
    fatoSeguinte: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line },
    /**
     * `.fact-n` — mono porque é medida, e no maior corpo da tela: é o que o
     * postal tem a dizer. **Sem `lineHeight` fixo**: dp fixo não acompanha o tipo
     * dinâmico, e em AX3 o número cresceria dentro de uma linha que não cresce.
     */
    valor: { fontSize: 33, fontFamily: fonts.mono, color: colors.ink, letterSpacing: -0.5 },
    /**
     * `.fact-d` — o nome do que se mediu. Sans 13, e **não** o versalete do
     * `eyebrow`: no mockup a descrição do fato é uma frase curta em caixa normal,
     * e versalete a leria como título de seção, que é o que o postal não tem.
     *
     * `ink2`, e nunca `ink3`: sem ele o número não diz nada, então é informação
     * obrigatória — e informação obrigatória não fica na tinta mais fraca.
     */
    rotulo: { fontSize: 13, lineHeight: 18, fontFamily: fonts.sansMedium, color: colors.ink2, marginTop: 5 },
    vazio: { marginTop: spacing.lg, fontSize: 14, lineHeight: 21, fontFamily: fonts.sans, color: colors.ink2 },

    // A linha do arquivo, separada dos fatos pelo filete: ela fala de outra
    // coisa — do que esta semana já foi — e não de o que ela teve.
    guardado: {
      marginTop: spacing.xl,
      borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line,
    },
    // Alvo de toque acima do piso de 44, e `minHeight` para crescer com o texto.
    linha: {
      flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
      minHeight: 48, paddingTop: spacing.md,
    },
    linhaTxt: { flex: 1, fontSize: 12.5, lineHeight: 18, fontFamily: fonts.sans, color: colors.ink2 },
    pressed: { opacity: 0.7 },

    textos: { gap: spacing.lg, paddingBottom: spacing.sm },
    textoDoCaderno: { gap: spacing.xs },
    // O nome do caderno guardado, em versalete: aqui ele **é** título de seção —
    // de uma seção de arquivo, e não de um caderno desta semana.
    nomeDoCaderno: {
      fontSize: 11, fontFamily: fonts.sansBold, textTransform: 'uppercase',
      letterSpacing: 1.1, color: colors.ink2,
    },
    // A mesma serifada do miolo da edição: é texto para ler, e ele foi escrito
    // como edição — só que a semana não escreve mais nenhum.
    texto: { fontSize: 15, lineHeight: 23, fontFamily: fonts.serif, color: colors.ink },

    /**
     * `.postal-foot` — mono, porque é carimbo, do mesmo tipo da assinatura que a
     * edição imprime no pé de cada caderno. Aqui ele diz o contrário dela.
     *
     * **`ink2`, divergindo do `ink3` do mockup**: no mockup o colofão fica fora
     * do cartão, sobre o `bg`; aqui ele fica dentro, sobre o `surface`, e `ink3`
     * mede 3,05 ali — piso de objeto gráfico, não de letra. É texto, e texto
     * quer 4,5.
     */
    colofao: {
      marginTop: spacing.lg, fontSize: 10.5, lineHeight: 16,
      fontFamily: fonts.mono, color: colors.ink2,
    },
  });
